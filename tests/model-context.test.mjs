import test from 'node:test';
import assert from 'node:assert/strict';
import { registerGameTools } from '../src/model-context.ts';
import {
  newGame,
  claimPlots,
  beginBuild,
  placeShop,
  finishYear,
  nextYear,
  emptyOffer,
} from '../src/engine.ts';

test('game tools follow replacement state, preserve read-only snapshots, and apply trade effects once', (t) => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete globalThis.window;
  });

  const tools = new Map();
  const signals = [];
  const windowEvents = new EventTarget();
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      modelContext: {
        registerTool(tool, { signal }) {
          tools.set(tool.name, tool);
          signals.push(signal);
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: windowEvents });

  let current = newGame(() => 0.5);
  const original = current;
  const originalSnapshot = structuredClone(original);
  let changed = 0;
  const sounds = [];
  const voices = [];
  registerGameTools({
    getState: () => current,
    claim: (ids) => claimPlots(current, ids, () => 0.5),
    startBuild: () => beginBuild(current),
    buildPiece: (id, shop) => placeShop(current, id, shop),
    act: (action) => {
      if (action === 'confirm-collect') finishYear(current);
      else if (action === 'next') nextYear(current, () => 0.5);
      else assert.fail(`Unexpected action: ${action}`);
    },
    changed: () => changed++,
    playSound: (sound) => sounds.push(sound),
    speak: (mood, player) => voices.push([mood, player]),
  });
  assert.equal(tools.size, 8);
  const run = (name, input = {}) => {
    assert.ok(tools.has(name), `Missing game tool: ${name}`);
    return tools.get(name).execute(input);
  };

  // New Game replaces the object after the tools have already registered.
  current = newGame(() => 0.25);
  current.players[0].cash = 90;
  current.players[1].cash = 70;
  const snapshot = run('get_neighborhood_state');
  assert.equal(snapshot.players[0].cash, 90);
  snapshot.players[0].cash = 999;
  snapshot.players[0].tiles[0] = 999;
  snapshot.lots[0].owner = 3;
  assert.equal(current.players[0].cash, 90);
  assert.notEqual(current.players[0].tiles[0], 999);
  assert.notEqual(current.lots[0].owner, 3);

  const chosen = current.pending.slice(0, current.draftCount);
  const claim = run('claim_neighborhood_plots', { plotIds: chosen });
  assert.equal(claim.phase, 'trade');
  assert.deepEqual(
    [...claim.ownedPlots].sort((a, b) => a - b),
    [...chosen].sort((a, b) => a - b),
  );

  const accepted = {
    partner: 1,
    give: { ...emptyOffer(), cash: 20 },
    take: { ...emptyOffer(), cash: 10 },
  };
  const beforeQuote = structuredClone(current);
  assert.deepEqual(run('quote_neighborhood_trade', accepted), { accepted: true, shortfall: 0 });
  assert.deepEqual(current, beforeQuote);
  assert.equal(changed, 0);
  assert.deepEqual(sounds, []);
  assert.deepEqual(voices, []);

  assert.equal(run('propose_neighborhood_trade', accepted).accepted, true);
  assert.equal(current.players[0].cash, 80);
  assert.equal(current.players[1].cash, 80);
  assert.equal(current.trades, 1);
  assert.equal(changed, 1);
  assert.deepEqual(sounds, ['deal']);
  assert.deepEqual(voices, [['positive', 1]]);

  const rejected = { partner: 1, give: emptyOffer(), take: { ...emptyOffer(), cash: 10 } };
  const beforeRejection = structuredClone(current);
  assert.equal(run('propose_neighborhood_trade', rejected).accepted, false);
  assert.deepEqual(current, beforeRejection);
  assert.equal(changed, 1);
  assert.deepEqual(sounds, ['deal', 'reject']);
  assert.deepEqual(voices, [
    ['positive', 1],
    ['negative', 1],
  ]);

  assert.deepEqual(run('start_neighborhood_build'), { phase: 'build' });
  const shop = current.players[0].tiles.findIndex((count) => count > 0);
  assert.ok(shop >= 0);
  const plot = chosen[0];
  assert.deepEqual(run('place_neighborhood_shop', { plotId: plot, shopIndex: shop }), {
    id: plot,
    shop,
  });
  assert.equal(current.lots[plot].shop, shop);
  const payday = run('collect_neighborhood_income');
  assert.equal(payday.phase, 'income');
  assert.equal(payday.year, 1);
  assert.deepEqual(payday.income, current.lastIncome);
  assert.deepEqual(
    payday.balances,
    current.players.map((player) => player.cash),
  );
  const afterPayday = structuredClone(current);
  assert.throws(() => run('collect_neighborhood_income'), /Finish trading/);
  assert.deepEqual(current, afterPayday);
  const next = run('advance_neighborhood_year');
  assert.equal(next.year, 2);
  assert.equal(next.phase, 'receive');
  assert.deepEqual(next.offeredPlots, current.pending);
  assert.equal(next.keep, current.draftCount);
  assert.deepEqual(original, originalSnapshot);

  assert.ok(signals.every((signal) => !signal.aborted));
  windowEvents.dispatchEvent(new Event('pagehide'));
  assert.ok(signals.every((signal) => signal.aborted));
});

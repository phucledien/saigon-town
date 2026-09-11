import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, claimPlots, holdings, evaluateOffer, trade } from '../src/engine.ts';
import { makeDraft, adjustDraft } from '../src/trading.ts';
function fixture() {
  const s = newGame(() => 0.3);
  claimPlots(s, s.pending.slice(0, s.draftCount), () => 0.2);
  return s;
}
test('plot and shop shortcuts prefill only assets owned by the chosen neighbor', () => {
  const s = fixture(),
    own = holdings(s, 0)[0].id,
    theirs = holdings(s, 1)[0].id,
    shop = s.players[1].tiles.findIndex((n) => n > 0);
  assert.deepEqual(makeDraft(s, 1, theirs, shop).take.lots, [theirs]);
  assert.equal(makeDraft(s, 1, theirs, shop).take.tiles[shop], 1);
  assert.deepEqual(makeDraft(s, 1, own).take.lots, []);
  assert.throws(() => makeDraft(s, 0));
});
test('inventory selection caps quantities and toggles only owned plots without changing the game', () => {
  const s = fixture(),
    before = JSON.stringify(s),
    d = makeDraft(s, 1),
    shop = s.players[0].tiles.findIndex((n) => n > 0),
    own = holdings(s, 0)[0].id;
  for (let i = 0; i < 30; i++) adjustDraft(s, d, 'give', 'tile', shop, 1);
  assert.equal(d.give.tiles[shop], s.players[0].tiles[shop]);
  for (let i = 0; i < 30; i++) adjustDraft(s, d, 'give', 'tile', shop, -1);
  assert.equal(d.give.tiles[shop], 0);
  adjustDraft(s, d, 'give', 'cash', 0, 100);
  assert.equal(d.give.cash, 50);
  adjustDraft(s, d, 'give', 'cash', 0, -100);
  assert.equal(d.give.cash, 0);
  adjustDraft(s, d, 'take', 'lot', own);
  assert.deepEqual(d.take.lots, []);
  adjustDraft(s, d, 'give', 'lot', own);
  assert.deepEqual(d.give.lots, [own]);
  adjustDraft(s, d, 'give', 'lot', own);
  assert.deepEqual(d.give.lots, []);
  assert.equal(JSON.stringify(s), before);
});
test('a visual counteroffer can add the requested cash and complete a real trade', () => {
  const s = fixture(),
    shop = s.players[1].tiles.findIndex((n) => n > 0),
    d = makeDraft(s, 1, null, shop);
  const rejected = trade(s, d);
  assert.equal(rejected.accepted, false);
  adjustDraft(s, d, 'give', 'cash', 0, rejected.shortfall);
  assert.equal(evaluateOffer(s, d).accepted, true);
  const before = s.players[0].tiles[shop];
  assert.equal(trade(s, d).accepted, true);
  assert.equal(s.players[0].tiles[shop], before + 1);
  assert.equal(
    s.players.reduce((n, p) => n + p.cash, 0),
    200,
  );
});

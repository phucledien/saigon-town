import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame,
  claimPlots,
  beginBuild,
  placeShop,
  canPlace,
  finishYear,
  nextYear,
  botBuild,
  income,
  groups,
  neighbors,
  emptyOffer,
  trade,
  evaluateOffer,
  holdings,
  validSave,
  SHOPS,
  rankings,
  updateBoardLayout,
} from '../src/engine.ts';
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
function fixture() {
  const s = newGame(rng(3));
  s.phase = 'build';
  s.pending = [];
  s.lots.forEach((l) => {
    l.owner = null;
    l.shop = null;
  });
  s.players[0].tiles = [20, 20, 20, 20, 20, 20];
  return s;
}
test('six-year games distribute all 72 plots, conserve shop tiles, and pay exactly once each year', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const random = rng(seed),
      s = newGame(random);
    for (let y = 1; y <= 6; y++) {
      assert.equal(s.year, y);
      assert.equal(s.phase, 'receive');
      assert.equal(
        s.pending.length,
        Math.min(s.draftCount + 2, s.lots.filter((l) => l.owner === null).length),
      );
      claimPlots(s, s.pending.slice(0, s.draftCount), random);
      assert.equal(s.phase, 'trade');
      beginBuild(s);
      botBuild(s, 0);
      const pre = s.players.map((p) => p.cash);
      finishYear(s);
      s.players.forEach((p, i) => assert.equal(p.cash, pre[i] + income(s, i)));
      assert.equal(
        s.bag.length +
          s.players.reduce((n, p) => n + p.tiles.reduce((a, b) => a + b, 0), 0) +
          s.lots.filter((l) => l.shop !== null).length,
        120,
      );
      assert.throws(() => finishYear(s));
      if (y < 6) nextYear(s, random);
    }
    assert.equal(s.phase, 'ended');
    assert.equal(s.lots.filter((l) => l.owner === null).length, 0);
    for (let i = 0; i < 4; i++) assert.equal(holdings(s, i).length, 18);
    assert.ok(validSave(s));
  }
});
test('connections share edges, never cross streets or diagonals', () => {
  assert.deepEqual(
    neighbors(3).sort((a, b) => a - b),
    [4, 7],
  );
  assert.deepEqual(
    neighbors(12).sort((a, b) => a - b),
    [13, 14],
  );
  const s = fixture();
  for (const id of [0, 1, 4, 11, 12]) {
    s.lots[id].owner = 0;
    s.lots[id].shop = 0;
  }
  assert.equal(groups(s, 0).length, 3);
  assert.equal(income(s, 0), 70);
  s.lots[1].owner = 1;
  assert.equal(income(s, 0), 40);
});
test('completed businesses get target bonus, individual businesses paid separately', () => {
  const s = fixture();
  for (const id of [0, 1, 2]) {
    s.lots[id].owner = 0;
    s.lots[id].shop = 0;
  }
  assert.equal(income(s, 0), 50);
  s.lots[4].owner = 0;
  assert.equal(canPlace(s, 0, 4, 0), true);
  s.lots[0].shop = 2;
  s.lots[1].shop = 2;
  s.lots[2].shop = 2;
  assert.equal(income(s, 0), 40);
  placeShop(s, 4, 2);
  assert.equal(income(s, 0), 80);
});
test('draft and placement reject invalid requests without mutating state', () => {
  const s = newGame(rng(5)),
    before = JSON.stringify(s);
  assert.throws(() => claimPlots(s, []));
  assert.throws(() => claimPlots(s, Array(s.draftCount).fill(s.pending[0])));
  assert.throws(() => placeShop(s, 0, 0));
  assert.equal(JSON.stringify(s), before);
  claimPlots(s, s.pending.slice(0, s.draftCount));
  beginBuild(s);
  const theirs = s.lots.find((l) => l.owner === 1);
  assert.throws(() => placeShop(s, theirs.id, 0));
});
test('accepted mixed trades conserve cash, shops and plots; rejected deals are atomic', () => {
  const s = newGame(rng(5));
  claimPlots(s, s.pending.slice(0, s.draftCount));
  const take = emptyOffer(),
    give = emptyOffer();
  take.cash = 50;
  const rejected = { partner: 1, take, give };
  const before = JSON.stringify(s);
  assert.equal(trade(s, rejected).accepted, false);
  assert.equal(JSON.stringify(s), before);
  take.cash = 0;
  take.lots = [holdings(s, 1)[0].id];
  give.cash = 50;
  const cash = s.players.reduce((n, p) => n + p.cash, 0);
  assert.equal(trade(s, { partner: 1, give, take }).accepted, true);
  assert.equal(s.lots[take.lots[0]].owner, 0);
  assert.equal(
    s.players.reduce((n, p) => n + p.cash, 0),
    cash,
  );
  const prior = JSON.stringify(s);
  assert.throws(() =>
    trade(s, {
      partner: 1,
      give: { ...emptyOffer(), cash: 0.5 },
      take: emptyOffer(),
    }),
  );
  assert.equal(JSON.stringify(s), prior);
});
test('income after ownership transfer follows connected owner groups', () => {
  const s = fixture();
  [0, 1, 2].forEach((id) => {
    s.lots[id].owner = 0;
    s.lots[id].shop = 0;
  });
  s.phase = 'trade';
  const give = emptyOffer();
  give.lots = [1];
  assert.equal(trade(s, { partner: 1, give, take: emptyOffer() }).accepted, true);
  assert.equal(s.lots[1].shop, 0);
  assert.equal(income(s, 0), 20);
  assert.equal(income(s, 1), 10);
});
test('cash counteroffer supplies exactly enough for acceptance', () => {
  const s = newGame(rng(8));
  claimPlots(s, s.pending.slice(0, s.draftCount));
  const take = emptyOffer();
  take.tiles[s.players[2].tiles.findIndex((n) => n > 0)] = 1;
  const give = emptyOffer(),
    o = { partner: 2, take, give };
  give.cash = evaluateOffer(s, o).shortfall;
  assert.ok(give.cash <= 50);
  assert.equal(evaluateOffer(s, o).accepted, true);
});

test('overflow scoring keeps a complete business and pays for the remainder', () => {
  const s = fixture();
  [0, 1, 2, 4].forEach((id) => (s.lots[id].owner = 0));
  for (const id of [0, 1, 2, 4]) placeShop(s, id, 0);
  assert.equal(groups(s, 0).length, 1);
  assert.equal(income(s, 0), 60);
});

test('equal cash is ranked by placed shop tiles', () => {
  const s = fixture();
  s.players.forEach((p) => (p.cash = 100));
  s.lots[0].owner = 2;
  s.lots[0].shop = 0;
  assert.equal(rankings(s)[0].id, 2);
});

test('a corner bridge changes income only along visible irregular edges', () => {
  const s = fixture();
  [3, 4, 11].forEach((id) => {
    s.lots[id].owner = 0;
    s.lots[id].shop = 0;
  });
  assert.equal(income(s, 0), 30);
  s.lots[8].owner = 0;
  placeShop(s, 8, 0);
  assert.equal(groups(s, 0).length, 1);
  assert.equal(income(s, 0), 60);
  s.phase = 'trade';
  const give = emptyOffer();
  give.lots = [8];
  trade(s, { partner: 1, give, take: emptyOffer() });
  assert.equal(income(s, 0), 30);
  assert.equal(income(s, 1), 10);
});

test('irregular map revision preserves saved assets, cash, phase and previous payouts', () => {
  const s = fixture();
  s.boardRevision = undefined;
  s.year = 4;
  s.lastIncome = [70, 50, 80, 90];
  s.lots[3].owner = 0;
  s.lots[3].shop = 2;
  const before = structuredClone(s);
  assert.equal(updateBoardLayout(s), true);
  assert.deepEqual(s.players, before.players);
  assert.deepEqual(s.lots, before.lots);
  assert.deepEqual(s.pending, before.pending);
  assert.deepEqual(s.lastIncome, before.lastIncome);
  assert.equal(s.year, 4);
  assert.equal(s.phase, 'build');
  assert.equal(s.boardRevision, 2);
  const once = JSON.stringify(s);
  assert.equal(updateBoardLayout(s), false);
  assert.equal(JSON.stringify(s), once);
  assert.ok(validSave(s));
});

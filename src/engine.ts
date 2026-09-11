import { BOARD_REVISION, plotNeighbors } from './board-layout';
import type {
  GamePhase,
  GameState,
  Lot,
  OfferSide,
  Player,
  RandomSource,
  Shop,
  ShopGroup,
  TradeEvaluation,
  TradeOffer,
} from './types';

export const SHOPS: Shop[] = [
  { id: 'coffee', name: 'Cà phê', english: 'Coffee house', code: 'CF', size: 3, color: '#825d43' },
  {
    id: 'banhmi',
    name: 'Bánh mì',
    english: 'Sandwich shop',
    code: 'BM',
    size: 3,
    color: '#b7782c',
  },
  { id: 'pho', name: 'Phở', english: 'Noodle kitchen', code: 'PH', size: 4, color: '#b85539' },
  {
    id: 'flowers',
    name: 'Tiệm hoa',
    english: 'Flower shop',
    code: 'HO',
    size: 4,
    color: '#a16586',
  },
  { id: 'tailor', name: 'Tiệm may', english: 'Tailor', code: 'MA', size: 5, color: '#587c9a' },
  {
    id: 'grocery',
    name: 'Tạp hóa',
    english: 'Corner grocer',
    code: 'TH',
    size: 6,
    color: '#648454',
  },
];

export const DISTRICTS = [
  'Tân Định',
  'Bến Thành',
  'Thảo Điền',
  'Chợ Lớn',
  'Bình Thạnh',
  'Phú Nhuận',
];
export const COLORS = ['#39a883', '#eec353', '#dc6f57', '#7fb5cf'];
export const KEEP = [5, 4, 3, 2, 2, 2];
export const COMPLETE = [0, 0, 0, 50, 80, 110, 140];
export const INCOMPLETE = [0, 10, 20, 40, 60, 80];

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  return items
    .map((value) => ({ key: rng(), value }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.value);
}

export const neighbors = plotNeighbors;

export function groups(state: GameState, player: number): ShopGroup[] {
  const seen = new Set<number>();
  const result: ShopGroup[] = [];

  for (const lot of state.lots) {
    if (lot.owner !== player || lot.shop === null || seen.has(lot.id)) continue;

    const stack = [lot.id];
    const ids: number[] = [];
    seen.add(lot.id);

    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined) break;
      ids.push(id);

      for (const neighbor of neighbors(id)) {
        const next = state.lots[neighbor];
        if (next.owner === player && next.shop === lot.shop && !seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }

    result.push({ shop: lot.shop, lots: ids, size: ids.length });
  }

  return result;
}

export function groupIncome(shop: number, count: number): number {
  const target = SHOPS[shop].size;
  return Math.floor(count / target) * COMPLETE[target] + INCOMPLETE[count % target];
}

export function income(state: GameState, player: number): number {
  return groups(state, player).reduce(
    (total, group) => total + groupIncome(group.shop, group.size),
    0,
  );
}

export function holdings(state: GameState, player: number): Lot[] {
  return state.lots.filter((lot) => lot.owner === player);
}

export function newGame(rng: RandomSource = Math.random): GameState {
  const state: GameState = {
    version: 1,
    boardRevision: BOARD_REVISION,
    year: 1,
    phase: 'receive',
    players: ['You', 'Linh', 'Minh', 'An'].map((name, id) => ({
      id,
      name,
      cash: 50,
      tiles: [0, 0, 0, 0, 0, 0],
    })),
    lots: Array.from({ length: 72 }, (_, id) => ({ id, owner: null, shop: null })),
    bag: shuffle(
      Array.from({ length: 120 }, (_, index) => index % 6),
      rng,
    ),
    pending: [],
    draftCount: 0,
    logs: [],
    lastIncome: [],
    trades: 0,
  };

  startYear(state, rng);
  return state;
}

export function updateBoardLayout(state: GameState): boolean {
  if (state.boardRevision === BOARD_REVISION) return false;
  state.boardRevision = BOARD_REVISION;

  if (state.lots.some((lot) => lot.owner !== null)) {
    log(
      state,
      'The city map now has irregular blocks. Plot numbers, owners, shops and cash are unchanged; future business income follows the new shared edges.',
    );
  }

  return true;
}

function drawTiles(state: GameState, player: number, count: number): void {
  for (let index = 0; index < count && state.bag.length > 0; index++) {
    const shop = state.bag.pop();
    if (shop === undefined) break;
    state.players[player].tiles[shop]++;
  }
}

function plotScore(state: GameState, id: number, player: number): number {
  return neighbors(id).reduce((score, neighbor) => {
    const owner = state.lots[neighbor].owner;
    return score + (owner === player ? 3 : owner === null ? 1 : 0);
  }, 0);
}

function botDraft(state: GameState, player: number, count: number, rng: RandomSource): void {
  const offered = shuffle(
    state.lots
      .filter((lot) => lot.owner === null && !state.pending.includes(lot.id))
      .map((lot) => lot.id),
    rng,
  ).slice(0, count + 2);

  for (let index = 0; index < count && offered.length > 0; index++) {
    offered.sort((a, b) => plotScore(state, b, player) - plotScore(state, a, player));
    const id = offered.shift();
    if (id === undefined) break;
    state.lots[id].owner = player;
  }
}

export function startYear(state: GameState, rng: RandomSource = Math.random): void {
  state.phase = 'receive';
  state.lastIncome = [];
  const count = KEEP[state.year - 1];
  state.draftCount = count;
  state.pending = shuffle(
    state.lots.filter((lot) => lot.owner === null).map((lot) => lot.id),
    rng,
  ).slice(0, count + 2);

  for (let player = 0; player < 4; player++) {
    drawTiles(state, player, state.year === 1 ? 5 : 4);
  }

  log(
    state,
    `Year ${state.year}: new addresses and ${state.year === 1 ? 5 : 4} shop tiles arrived.`,
  );
}

export function claimPlots(
  state: GameState,
  ids: number[],
  rng: RandomSource = Math.random,
): number[] {
  if (state.phase !== 'receive') {
    throw Error('You can choose addresses only at the start of a year.');
  }

  if (
    !Array.isArray(ids) ||
    ids.length !== state.draftCount ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !state.pending.includes(id) || state.lots[id].owner !== null)
  ) {
    throw Error(`Choose exactly ${state.draftCount} of your offered plots.`);
  }

  for (const id of ids) state.lots[id].owner = 0;
  state.pending = [];

  for (let player = 1; player < 4; player++) {
    botDraft(state, player, state.draftCount, rng);
  }

  state.phase = 'trade';
  log(state, `You claimed plots ${ids.map((id) => id + 1).join(', ')}.`);
  return ids;
}

export function beginBuild(state: GameState): void {
  if (state.phase !== 'trade') throw Error('Finish choosing your plots first.');
  state.phase = 'build';
  log(state, 'Trading closed. Time to open your shops.');
}

export function canPlace(state: GameState, player: number, id: number, shop: number): boolean {
  if (!Number.isInteger(id) || !state.lots[id] || !Number.isInteger(shop) || !SHOPS[shop]) {
    return false;
  }

  const lot = state.lots[id];
  return lot.owner === player && lot.shop === null && state.players[player].tiles[shop] >= 1;
}

export function placeShop(
  state: GameState,
  id: number,
  shop: number,
  player = 0,
): { id: number; shop: number } {
  if (state.phase !== 'build') throw Error('Shops open during the Build phase.');
  if (!canPlace(state, player, id, shop)) {
    throw Error('Choose your own empty plot and a tile you have in hand.');
  }

  state.lots[id].shop = shop;
  state.players[player].tiles[shop]--;
  log(state, `${state.players[player].name} opened ${SHOPS[shop].name} on plot ${id + 1}.`);
  return { id, shop };
}

export function botBuild(state: GameState, player: number): void {
  let guard = 0;
  while (guard++ < 30) {
    let best: { id: number; shop: number; score: number } | null = null;

    for (const lot of holdings(state, player).filter((candidate) => candidate.shop === null)) {
      for (let shop = 0; shop < SHOPS.length; shop++) {
        if (!canPlace(state, player, lot.id, shop)) continue;

        const adjacent = neighbors(lot.id).filter(
          (id) => state.lots[id].owner === player && state.lots[id].shop === shop,
        ).length;
        const possible = neighbors(lot.id).filter(
          (id) => state.lots[id].owner === player && state.lots[id].shop === null,
        ).length;
        const before = income(state, player);
        lot.shop = shop;
        const delta = income(state, player) - before;
        lot.shop = null;
        const score =
          delta * 2 +
          adjacent * 8 +
          possible * 2 +
          state.players[player].tiles[shop] -
          SHOPS[shop].size;

        if (!best || score > best.score) best = { id: lot.id, shop, score };
      }
    }

    if (!best) break;
    placeShop(state, best.id, best.shop, player);
  }
}

export function finishYear(state: GameState): number[] {
  if (state.phase !== 'build') throw Error('Finish trading before collecting income.');

  for (let player = 1; player < 4; player++) botBuild(state, player);
  state.lastIncome = state.players.map((player) => income(state, player.id));
  for (let player = 0; player < 4; player++) {
    state.players[player].cash += state.lastIncome[player];
  }

  log(state, `Year ${state.year} closed. You earned ${state.lastIncome[0]} đ.`);
  state.phase = state.year === 6 ? 'ended' : 'income';
  return state.lastIncome;
}

export function nextYear(state: GameState, rng: RandomSource = Math.random): void {
  if (state.phase !== 'income') throw Error('Collect this year’s income first.');
  state.year++;
  startYear(state, rng);
}

export function log(state: GameState, message: string): void {
  state.logs.unshift(message);
  if (state.logs.length > 100) state.logs.length = 100;
}

function sideValue(state: GameState, side: OfferSide, recipient: number): number {
  const tiles = side.tiles.reduce(
    (value, count, shop) =>
      value +
      count *
        (10 +
          state.players[recipient].tiles[shop] * 1.5 +
          groups(state, recipient).filter(
            (group) => group.shop === shop && group.size < SHOPS[shop].size,
          ).length *
            6),
    0,
  );

  const lots = side.lots.reduce((value, id) => {
    const lot = state.lots[id];
    const adjacency = neighbors(id).filter(
      (neighbor) => state.lots[neighbor].owner === recipient,
    ).length;
    return value + 18 + adjacency * 14 + (lot.shop === null ? 0 : 15 + 10 * (7 - state.year));
  }, 0);

  return side.cash + tiles + lots;
}

export function emptyOffer(): OfferSide {
  return { cash: 0, tiles: [0, 0, 0, 0, 0, 0], lots: [] };
}

export function validateOffer(state: GameState, offer: TradeOffer): boolean {
  if (state.phase !== 'trade') throw Error('Deals are available only during the Trade phase.');
  if (!offer || !Number.isInteger(offer.partner) || offer.partner < 1 || offer.partner > 3) {
    throw Error('Choose a trading partner.');
  }

  const sides: [OfferSide, number][] = [
    [offer.give, 0],
    [offer.take, offer.partner],
  ];
  for (const [side, player] of sides) {
    if (
      !side ||
      !Number.isInteger(side.cash) ||
      side.cash < 0 ||
      side.cash > state.players[player].cash
    ) {
      throw Error('Cash must be a whole number within the owner’s balance.');
    }
    if (
      !Array.isArray(side.tiles) ||
      side.tiles.length !== 6 ||
      side.tiles.some(
        (count, shop) =>
          !Number.isInteger(count) || count < 0 || count > state.players[player].tiles[shop],
      )
    ) {
      throw Error('A player cannot trade more shop tiles than they hold.');
    }
    if (
      !Array.isArray(side.lots) ||
      new Set(side.lots).size !== side.lots.length ||
      side.lots.some(
        (id) => !Number.isInteger(id) || !state.lots[id] || state.lots[id].owner !== player,
      )
    ) {
      throw Error('Each plot can be offered once by its current owner.');
    }
  }

  if (
    ![offer.give, offer.take].some(
      (side) => side.cash || side.lots.length || side.tiles.some(Boolean),
    )
  ) {
    throw Error('Add cash, a shop tile, or a plot to the deal.');
  }
  return true;
}

export function evaluateOffer(state: GameState, offer: TradeOffer): TradeEvaluation {
  validateOffer(state, offer);
  const offered = sideValue(state, offer.give, offer.partner);
  const requested = sideValue(state, offer.take, offer.partner);
  const margin = [0, 1.04, 1.09, 1.01][offer.partner];

  return {
    accepted: offered >= requested * margin,
    shortfall: Math.max(0, Math.ceil(requested * margin - offered)),
  };
}

export function trade(state: GameState, offer: TradeOffer): TradeEvaluation {
  const result = evaluateOffer(state, offer);
  if (!result.accepted) return result;

  const you = state.players[0];
  const partner = state.players[offer.partner];
  you.cash += offer.take.cash - offer.give.cash;
  partner.cash += offer.give.cash - offer.take.cash;

  for (let shop = 0; shop < 6; shop++) {
    you.tiles[shop] += offer.take.tiles[shop] - offer.give.tiles[shop];
    partner.tiles[shop] += offer.give.tiles[shop] - offer.take.tiles[shop];
  }

  for (const id of offer.give.lots) state.lots[id].owner = offer.partner;
  for (const id of offer.take.lots) state.lots[id].owner = 0;
  state.trades++;
  const plots = offer.give.lots.length + offer.take.lots.length;
  const tiles =
    offer.give.tiles.reduce((total, count) => total + count, 0) +
    offer.take.tiles.reduce((total, count) => total + count, 0);
  log(
    state,
    `Deal ${state.trades}: you and ${partner.name} traded ${plots} plots, ${tiles} tiles and cash.`,
  );
  return result;
}

export function rankings(state: GameState): Player[] {
  return [...state.players].sort(
    (a, b) =>
      b.cash - a.cash ||
      state.lots.filter((lot) => lot.owner === b.id && lot.shop !== null).length -
        state.lots.filter((lot) => lot.owner === a.id && lot.shop !== null).length,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNonnegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isPhase(value: unknown): value is GamePhase {
  return (
    value === 'receive' ||
    value === 'trade' ||
    value === 'build' ||
    value === 'income' ||
    value === 'ended'
  );
}

function isPlayer(value: unknown, index: number): value is Player {
  return (
    isRecord(value) &&
    value.id === index &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    isNonnegativeFinite(value.cash) &&
    isArray(value.tiles) &&
    value.tiles.length === 6 &&
    value.tiles.every(isNonnegativeInteger)
  );
}

function isLot(value: unknown, index: number): value is Lot {
  return (
    isRecord(value) &&
    value.id === index &&
    (value.owner === null || (isNonnegativeInteger(value.owner) && value.owner < 4)) &&
    (value.shop === null || (isNonnegativeInteger(value.shop) && value.shop < 6))
  );
}

export function validSave(value: unknown): value is GameState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.boardRevision === undefined || isNonnegativeInteger(value.boardRevision)) &&
    isNonnegativeInteger(value.year) &&
    value.year >= 1 &&
    value.year <= 6 &&
    isPhase(value.phase) &&
    isArray(value.players) &&
    value.players.length === 4 &&
    value.players.every(isPlayer) &&
    isArray(value.lots) &&
    value.lots.length === 72 &&
    value.lots.every(isLot) &&
    isArray(value.bag) &&
    value.bag.every((shop) => isNonnegativeInteger(shop) && shop < 6) &&
    isArray(value.pending) &&
    value.pending.every((id) => isNonnegativeInteger(id) && id < 72) &&
    isArray(value.logs) &&
    value.logs.every((message) => typeof message === 'string') &&
    isArray(value.lastIncome) &&
    value.lastIncome.every(isNonnegativeFinite) &&
    isNonnegativeInteger(value.draftCount) &&
    value.draftCount >= 2 &&
    value.draftCount <= 5 &&
    isNonnegativeInteger(value.trades)
  );
}

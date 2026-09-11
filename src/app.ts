import { registerGameTools } from './model-context';
import { query as $, required as get, eventElement, errorMessage } from './dom';
import type { GameState, GamePhase, Lot, ShopGroup, TradeOffer } from './types';
import type { SoundEffect } from './audio';
import type { Camera, Point } from './camera';
import { researchMarkup } from './ui/research';
import {
  SHOPS,
  DISTRICTS,
  COLORS,
  COMPLETE,
  INCOMPLETE,
  KEEP,
  newGame,
  groups,
  groupIncome,
  income,
  holdings,
  claimPlots,
  beginBuild,
  canPlace,
  placeShop,
  finishYear,
  nextYear,
  emptyOffer,
  evaluateOffer,
  trade,
  rankings,
  validSave,
  updateBoardLayout,
} from './engine';
import { createGameAudio } from './audio';
import { createTrading } from './trading';
import { zodiacImages } from './zodiac';
import { BLOCK_LAYOUTS, PLOT_LAYOUT } from './board-layout';
import { cameraFor, dragCamera, wheelCamera } from './camera';
import { MapInput } from './map-input';
import { preloadGameImages, GAME_IMAGES } from './preload';
import { installMobileGuards } from './mobile';
const KEY = 'vietnamtown-save-v1';
let state: GameState;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  state = validSave(saved) ? saved : newGame();
} catch {
  state = newGame();
}
const layoutUpdated = updateBoardLayout(state);
let ledgerPage = 0;
let language: 'vi' | 'en' = 'vi';
try {
  language = localStorage.getItem('vietnamtown-language') === 'en' ? 'en' : 'vi';
} catch {}
const tr = (en: string, vi: string) => (language === 'vi' ? vi : en);
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
const money = (n: number) => `${n.toLocaleString('en-US')} <span class="money-symbol">đ</span>`;
const SPRITES = ['coffee', 'banhmi', 'pho', 'flowers', 'tailor', 'grocery'];
const LANDMARKS = ['tan-dinh', 'ben-thanh', 'thao-dien', 'cho-lon', 'binh-thanh', 'phu-nhuan'];
const ZODIAC = [
  ['Tỵ', 'Snake', 'snake'],
  ['Ngọ', 'Horse', 'horse'],
  ['Mùi', 'Goat', 'goat'],
  ['Thân', 'Monkey', 'monkey'],
  ['Dậu', 'Rooster', 'rooster'],
  ['Tuất', 'Dog', 'dog'],
] as const;
const TOKEN_COLORS = ['#39a883', '#eec353', '#dc6f57', '#7fb5cf'];
type Timer = ReturnType<typeof setTimeout>;
interface PieceDrag {
  type: 'shop' | 'counter';
  index: number;
  el: HTMLElement;
  id: number;
  x: number;
  y: number;
  active: boolean;
}
let view: 'play' | 'research' = 'play';
let selectedShop: number | null = null;
let selectedLot: number | null = null;
let chosen: number[] = [];
let partner = 1;
let lastFocus: HTMLElement | null = null;
let toastTimer: Timer | undefined;
let freshLots: number[] = [];
let drag: PieceDrag | null = null;
let suppressClick = false;
let rackOpen = state.phase === 'build';
let menuOpen = true;
let sessionStarted = false;
let assetsReady = false;
let assetFailures: string[] = [];
let loadingCount = 0;
let loadingPromise: Promise<void> | null = null;
let cameraCenter: Point = { x: 550, y: 365 };
let camera: Camera | null = null;
let cameraInitialized = false;
let cameraScale: number | null = null;
let lastInputType = 'mouse';
const mapInput = new MapInput();
let mapTapBlockUntil = 0;
let hudResizeObserver: ResizeObserver | null = null;
let observedPhase = '';
let renderedYear = state.year;
let phaseTimer: Timer | undefined;
let phaseDelay: Timer | undefined;
let cashFrame = 0;
let payout: { before: number[]; start: number } | null = null;
let freshTimer: Timer | undefined;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gameAudio = createGameAudio({ onChange: () => updateSoundButton() });
const trading = createTrading({
  getState: () => state,
  tr,
  sprite,
  token,
  modal,
  closeModal,
  onChanged: () => changed(),
  playSound,
  onTrading: (v) => gameAudio.setTrading(v),
  speak: (m, p) => gameAudio.speak(m, p),
});
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    toast(
      tr(
        'Progress cannot be saved. Keep this tab open.',
        'Không lưu được tiến độ. Hãy giữ thẻ này mở.',
      ),
    );
  }
}
function changed() {
  save();
  render();
}
function toast(message: string) {
  get('#toast').textContent = message;
  get('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => get('#toast').classList.remove('show'), 3800);
}
function modal(title: string, content: string, eyebrow = 'SAIGON TOWN') {
  cancelMapGesture();
  dismissPhase();
  delete get('#modal').dataset.settings;
  get('#modal').classList.remove('ledger-dialog');
  if (trading.isOpen()) trading.cancel();
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  get('#modal').setAttribute('aria-label', title);
  get('#modal').innerHTML =
    `<div class="modal-header"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><button class="close" aria-label="${tr('Close dialog', 'Đóng')}" data-action="close">×</button></div><div class="modal-body">${content}</div>`;
  if (!get('#modal').open) get('#modal').showModal();
  get('#modal').scrollTop = 0;
}
function closeModal() {
  trading.dismiss();
  get('#modal').close();
  lastFocus?.focus?.();
}
function sprite(kind: string, name: string, cls = '', extra = '') {
  return `<img class="pixel ${cls}" src="/assets/${kind}/${name}.png" alt="" draggable="false" ${extra}>`;
}
function zodiacSprite(index: number, cls = '') {
  return `<img class="pixel ${cls}" src="${zodiacImages[ZODIAC[index][2]]}" alt="${ZODIAC[index][0]}" draggable="false">`;
}
function token(player: number, cls = '') {
  return sprite('materials', 'stool-' + player + '-v8', 'owner-token ' + cls);
}
function lotLabel(l: Lot) {
  return `${tr('Plot', 'Lô')} ${l.id + 1}, ${DISTRICTS[Math.floor(l.id / 12)]}, ${l.owner === null ? tr('unclaimed', 'chưa có chủ') : l.owner === 0 ? tr('yours', 'của bạn') : state.players[l.owner].name}${l.shop === null ? '' : ', ' + SHOPS[l.shop].name}`;
}
function phaseName(p: GamePhase = state.phase) {
  return {
    receive: tr('Receive', 'Nhận lộc'),
    trade: tr('Trade', 'Thương lượng'),
    build: tr('Build', 'Mở tiệm'),
    income: tr('Payday', 'Thu tiền'),
    ended: tr('Finale', 'Tổng kết'),
  }[p];
}
function board() {
  return DISTRICTS.map((name, b) => {
    const layout = BLOCK_LAYOUTS[b];
    return `<section class="district district-${b}" style="left:${layout.x}px;top:${layout.y}px" aria-label="${name}"><div class="district-identity"><span class="landmark-medallion">${sprite('signs', LANDMARKS[b] + '-v6')}</span><strong>${name}</strong><span class="district-number">${String(b + 1).padStart(2, '0')}</span></div><div class="district-grid">${state.lots
      .slice(b * 12, b * 12 + 12)
      .map((l) => {
        const cell = PLOT_LAYOUT[l.id],
          offered = state.pending.includes(l.id),
          picked = chosen.includes(l.id),
          shop = l.shop === null ? null : SHOPS[l.shop],
          valid =
            state.phase === 'build' &&
            selectedShop !== null &&
            canPlace(state, 0, l.id, selectedShop);
        return `<button data-lot="${l.id}" class="lot ${l.owner !== null ? 'owned' : ''} ${l.owner === 0 ? 'mine' : ''} ${offered ? 'offered' : ''} ${picked ? 'picked' : ''} ${selectedLot === l.id ? 'inspected' : ''} ${shop ? 'built' : ''} ${valid ? 'buildable' : ''} ${freshLots.includes(l.id) ? 'fresh' : ''} ${state.phase === 'build' && l.owner === 0 && l.shop === null ? 'ready-plot' : ''}" aria-label="${lotLabel(l)}" aria-pressed="${picked || selectedLot === l.id}" style="grid-column:${cell.col + 1};grid-row:${cell.row + 1};--piece-delay:${Math.max(0, Math.min(12, freshLots.indexOf(l.id))) * 40}ms"><span class="plot-number">${l.id + 1}</span>${shop && l.shop !== null ? sprite('shops', SPRITES[l.shop], 'built-shop') : '<span class="plot-edge"></span>'}${l.owner !== null ? token(l.owner) : picked ? token(0, 'draft-token') : ''}${valid && selectedShop !== null ? sprite('shops', SPRITES[selectedShop], 'build-ghost') : ''}${shop ? `<span class="plot-target" title="${tr('Complete with', 'Đủ bộ khi có')} ${shop.size} ${tr('connected shops', 'tiệm liền kề')}">${shop.size}</span>` : ''}</button>`;
      })
      .join('')}</div></section>`;
  }).join('');
}
function calendar() {
  const z = ZODIAC[state.year - 1],
    label = `${tr('Year', 'Năm')} ${state.year}/6 · ${z[0]}`;
  return `<aside class="calendar paper-calendar" aria-label="${tr('Saigon year calendar', 'Lịch năm Sài Gòn')}"><div class="calendar-sheet"><button class="calendar-date" data-action="years" aria-label="${label}. ${tr('View all six years', 'Xem cả sáu năm')}"><span class="calendar-heading">SÀI GÒN</span><small class="calendar-caption">${tr('YEAR', 'NĂM')}</small><strong class="calendar-digit">${state.year}</strong><span class="calendar-animal">${zodiacSprite(state.year - 1)}<b>${z[0]}</b></span><span class="calendar-footnote">${state.year} / 6 · ${tr('View years', 'Xem lịch')}</span></button></div></aside>`;
}

function playerCard() {
  return `<div class="player-rail">${state.players.map((p, i) => `<div class="player-pocket ${i === 0 ? 'your-pocket' : ''}" style="--player-color:${TOKEN_COLORS[i]}"><button class="pocket-main" data-action="${i !== 0 && state.phase === 'trade' ? 'trade-player' : 'player-info'}" data-player="${i}" aria-label="${i === 0 ? tr('Your inventory', 'Kho của bạn') : p.name}, ${p.cash} đ"><span class="pocket-token">${token(i)}<b>${i === 0 ? tr('YOU', 'BẠN') : p.name.toUpperCase()}</b></span><span class="wallet"><strong data-wallet="${i}">${money(p.cash)}</strong><span class="hand-total" aria-label="${p.tiles.reduce((n, x) => n + x, 0)} ${tr('shop pieces', 'mảnh tiệm')}">▧ ${p.tiles.reduce((n, x) => n + x, 0)}</span><small>+${income(state, i)} đ / ${tr('yr', 'năm')}</small></span></button><div class="pocket-inventory" aria-label="${tr('Unused shop pieces', 'Mảnh tiệm chưa dùng')}">${p.tiles.map((n, s) => (n ? `<button data-action="glance-shop" data-player="${i}" data-shop-index="${s}" title="${SHOPS[s].name} ×${n}" aria-label="${p.name}, ${SHOPS[s].name}, ${n}">${sprite('shops', SPRITES[s])}<b>${n}</b></button>` : '')).join('') || `<span>${tr('Empty rack', 'Hết mảnh tiệm')}</span>`}<button class="inventory-more" data-action="player-info" data-player="${i}" aria-label="${tr('View inventory', 'Xem kho')}">⋯</button></div></div>`).join('')}</div>`;
}
function phaseCard() {
  let title, body, action;
  switch (state.phase) {
    case 'receive':
      title = tr('Claim your corner.', 'Chọn góc phố của bạn.');
      body = tr(
        `Put stools on ${state.draftCount} glowing plots.`,
        `Đặt ghế lên ${state.draftCount} lô đang sáng.`,
      );
      action = `<div class="claim-tools"><button data-drag-token="0" class="counter-stack" aria-label="${tr('Drag your stool onto a glowing plot', 'Kéo ghế của bạn lên lô sáng')}">${[0, 1, 2, 3].map((n) => token(0, `stack-${n}`)).join('')}</button><div class="address-strip">${state.pending.map((id) => `<button data-lot="${id}" class="address-slip ${chosen.includes(id) ? 'selected' : ''}" aria-pressed="${chosen.includes(id)}" aria-label="${tr('Plot', 'Lô')} ${id + 1}, ${DISTRICTS[Math.floor(id / 12)]}">${sprite('ui', 'plot-mini-v9', 'draft-ground')}<span class="draft-address">${id + 1}</span>${chosen.includes(id) ? token(0, 'draft-stool') : ''}<span class="draft-district">${String(Math.floor(id / 12) + 1).padStart(2, '0')}</span></button>`).join('')}</div><button class="primary" data-action="claim" ${chosen.length !== state.draftCount ? 'disabled' : ''}>${tr('Keep', 'Giữ')} ${chosen.length}/${state.draftCount} ✓</button></div>`;
      break;
    case 'trade':
      title = tr('Who has your missing piece?', 'Ai đang giữ mảnh bạn cần?');
      body = tr(
        'Tap a neighbor, their shop piece, or their plot.',
        'Chạm hàng xóm, mảnh tiệm hoặc lô của họ để trả giá.',
      );
      action = `<button class="primary" data-action="trade">${tr('Bargain', 'Trả giá')} ⇄</button><button class="secondary" data-action="build">${tr('Build', 'Mở tiệm')} →</button>`;
      break;
    case 'build':
      title = tr('Open for business.', 'Khai trương thôi!');
      body = tr(
        'Choose a piece below, or tap your plot for a quick build menu.',
        'Chọn mảnh bên dưới, hoặc chạm lô của bạn để mở menu xây.',
      );
      action = `<span class="payday-preview">${tr('Next payday', 'Sắp thu')} <b>${income(state, 0)} đ</b></span><button class="primary" data-action="collect">${tr('Finish & collect', 'Xong rồi, thu tiền')} →</button>`;
      break;
    case 'income':
      title = tr('A good year in the neighborhood.', 'Một năm buôn may bán đắt.');
      body = tr(
        `Your shops brought in ${state.lastIncome[0]} đ.`,
        `Các tiệm mang về ${state.lastIncome[0]} đ.`,
      );
      action = `<button class="primary" data-action="next">${tr('Welcome year', 'Sang năm')} ${state.year + 1} →</button><button class="secondary" data-action="income">${tr('Earnings', 'Sổ thu')}</button>`;
      break;
    default:
      title = tr('Six years. One thriving town.', 'Sáu năm, phố mình đổi khác.');
      body = tr('Time to see who grew the biggest fortune.', 'Cùng xem ai có nhiều tiền nhất nhé.');
      action = `<button class="primary" data-action="results">${tr('Final standings', 'Xem kết quả')} ★</button>`;
  }
  return `<section class="turn-scroll"><div class="phase-heading"><span class="phase-medal">${{ receive: '01', trade: '02', build: '03', income: '04', ended: '★' }[state.phase]}</span><div><small>${phaseName()}</small><h2>${title}</h2></div><button class="replay-guide" data-action="guide" aria-label="${tr('Replay phase guide', 'Xem lại hướng dẫn bước này')}">?</button></div><p>${body}</p><div class="phase-actions">${action}</div></section>`;
}
function hand() {
  return `<section class="tile-rack" aria-label="${tr('Your shop pieces', 'Mảnh tiệm của bạn')}"><div class="rack-label"><span>${tr('YOUR SHOP PIECES', 'MẢNH TIỆM TRONG KHO')}</span><button class="ledger-shortcut" data-action="businesses"><span aria-hidden="true">▤</span> ${tr('Open ledger', 'Mở sổ tiệm')} ↗</button></div><div class="shop-tray">${SHOPS.map((s, i) => `<button class="shop-piece ${selectedShop === i ? 'active' : ''} ${state.players[0].tiles[i] === 0 ? 'depleted' : ''}" data-shop="${i}" data-drag-shop="${i}" aria-pressed="${selectedShop === i}" aria-label="${s.name}: ${state.players[0].tiles[i]} ${tr('in your rack. Connect', 'trong kho. Ghép đủ')} ${s.size} ${tr('matching shops of your color for', 'tiệm cùng loại, cùng chủ để thu')} ${COMPLETE[s.size]} đ ${tr('each year', 'mỗi năm')}"><span class="piece-count"><small>${tr('Have', 'Còn')}</small> ${state.players[0].tiles[i]}</span>${sprite('shops', SPRITES[i])}<strong>${s.name}</strong><small class="shop-requirement"><span>${tr('Connect', 'Ghép đủ')}</span> <b>${s.size}</b> <span class="requirement-tail">${tr('tiles', 'mảnh liền kề')}</span></small><span class="shop-payout">${COMPLETE[s.size]} đ <em>/ ${tr('year', 'năm')}</em></span></button>`).join('')}</div><div class="rack-hint">${tr('Same shop + your color + a shared edge. Smaller groups also earn income.', 'Cùng loại + cùng chủ + chung cạnh. Chưa đủ bộ vẫn có thu nhập.')}</div></section>`;
}
function selection() {
  if (selectedLot === null) return '';
  const l = state.lots[selectedLot],
    g =
      l.shop === null || l.owner === null
        ? null
        : groups(state, l.owner).find((g) => g.lots.includes(l.id));
  const build =
    state.phase === 'build' && l.owner === 0
      ? `<div class="quick-build"><small>${l.shop === null ? tr('OPEN HERE', 'MỞ TIỆM TẠI ĐÂY') : tr('CONTINUE THIS BUSINESS', 'MỞ RỘNG TIỆM NÀY')}</small><div>${
          SHOPS.map((s, i) => {
            if (!state.players[0].tiles[i] || (l.shop !== null && i !== l.shop)) return '';
            return `<button data-action="quick-build" data-id="${l.id}" data-index="${i}" aria-label="${l.shop === null ? tr('Build', 'Xây') : tr('Select', 'Chọn')} ${s.name}">${sprite('shops', SPRITES[i])}<strong>${s.name}</strong><small>×${state.players[0].tiles[i]} · ${s.size} → ${COMPLETE[s.size]} đ</small></button>`;
          }).join('') ||
          `<span>${tr('No matching pieces in your rack.', 'Kho chưa có mảnh phù hợp.')}</span>`
        }</div></div>`
      : '';
  return `<div class="plot-inspector"><div class="inspector-top"><span class="inspector-address">${l.id + 1}</span><div><strong>${DISTRICTS[Math.floor(l.id / 12)]}</strong><small>${l.owner === null ? tr('Unclaimed', 'Chưa có chủ') : l.owner === 0 ? tr('Your plot', 'Lô của bạn') : state.players[l.owner].name}${l.shop !== null ? ' · ' + SHOPS[l.shop].name : ''}</small>${g ? `<small>${g.size}/${SHOPS[g.shop].size} ${tr('connected', 'liền kề')} · ${groupIncome(g.shop, g.size)} đ/${tr('yr', 'năm')}</small>` : ''}</div>${state.phase === 'trade' && l.owner !== null && l.owner !== 0 ? `<button class="primary" data-action="trade-lot" data-id="${l.id}">${tr('Bargain', 'Trả giá')} ⇄</button>` : ''}<button class="close" data-action="deselect" aria-label="${tr('Close', 'Đóng')}">×</button></div>${build}</div>`;
}
function streetScene() {
  return `<div class="map-terrain" aria-hidden="true">${sprite('city', 'saigon-city-board-v6', 'city-background')}<span class="street-name street-top">LÊ VĂN DUYỆT</span><span class="street-name street-mid">NGUYỄN TRÃI</span><span class="street-name street-bottom">VÕ VĂN KIỆT</span><span class="river-name">SÔNG SÀI GÒN</span><div class="vehicle ninja-ride">${sprite('life', 'ninja-lead')}</div><div class="vehicle ninja-return">${sprite('life', 'ninja-lead')}</div><div class="vehicle city-bus">${sprite('life', 'city-bus')}</div><div class="walker crossing-one"><span></span></div><div class="walker crossing-two"><span></span></div><div class="walker crossing-three"><span></span></div></div>`;
}
// Keep the street scene and its ancestors connected: detaching them restarts CSS traffic animations.
function mountGame() {
  if ($('.game-shell')) return;
  get('#app').innerHTML =
    `<div class="game-shell"><header class="game-hud-top"></header><div class="play-stage"><section class="board-area"><div class="board-frame"><div class="map-viewport" tabindex="0"><div class="game-world">${streetScene()}<div class="plot-layer"></div></div></div></div><div class="calendar-layer"></div><span class="camera-hint"></span><div class="inspector-layer"></div></section></div><div class="game-hud-bottom"></div></div>`;
  hudResizeObserver?.disconnect();
  hudResizeObserver = new ResizeObserver(fitMap);
  hudResizeObserver.observe(get('.map-viewport'));
}
function render() {
  cancelMapGesture();
  document.documentElement.lang = language;
  document.body.dataset.phase = state.phase;
  document.body.classList.toggle('notebook-open', view === 'research');
  gameAudio.setPhase(state.phase);
  if (view === 'research') {
    hudResizeObserver?.disconnect();
    dismissPhase();
    renderResearch();
    return;
  }
  const oldYear = renderedYear,
    oldTray = $('.shop-tray')?.scrollLeft || 0;
  const key = state.year + ':' + state.phase,
    phaseChanged = observedPhase !== key;
  if (phaseChanged) {
    rackOpen = state.phase === 'build';
    if (state.phase === 'receive' || state.phase === 'build') cameraInitialized = false;
  }
  mountGame();
  get('.game-shell').inert = menuOpen;
  document.body.classList.toggle('menu-open', menuOpen);
  renderStartMenu();
  get('.board-area').setAttribute('aria-label', tr('Neighborhood game board', 'Bàn chơi khu phố'));
  get('.map-viewport').setAttribute(
    'aria-label',
    tr(
      'Town map. Drag to move; scroll or pinch to zoom. Arrow keys move; plus and minus zoom; zero shows the whole town on desktop.',
      'Bản đồ phố. Kéo để di chuyển; cuộn hoặc chụm hai ngón để thu phóng. Phím mũi tên di chuyển, cộng/trừ thu phóng, phím 0 xem toàn phố trên máy tính.',
    ),
  );
  get('.game-hud-top').innerHTML =
    `<div class="game-brand">SAIGON<span>TOWN</span></div>${playerCard()}<button class="hud-menu" data-action="menu" aria-label="${tr('Game menu', 'Menu trò chơi')}">☰<small>${tr('Menu', 'Menu')}</small></button>`;
  get('.plot-layer').innerHTML = board();
  get('.calendar-layer').innerHTML = calendar();
  get('.camera-hint').textContent =
    selectedShop !== null && state.phase === 'build'
      ? SHOPS[selectedShop].name +
        ' · ' +
        SHOPS[selectedShop].size +
        ' ' +
        tr('connected', 'liền kề') +
        ' → ' +
        COMPLETE[SHOPS[selectedShop].size] +
        ' đ/' +
        tr('yr', 'năm')
      : desktopMap()
        ? tr(
            'Drag to move · scroll to zoom · 0: whole town',
            'Kéo để di chuyển · cuộn để thu phóng · 0: toàn phố',
          )
        : tr('Swipe to move · pinch to zoom', 'Vuốt di chuyển · chụm 2 ngón thu phóng');
  get('.inspector-layer').innerHTML = selection();
  get('.game-hud-bottom').innerHTML =
    `<div class="rack-drawer ${rackOpen ? 'open' : ''}" id="shop-drawer">${hand()}</div><div class="action-belt"><button class="belt-button ${rackOpen ? 'active' : ''}" data-action="rack" aria-expanded="${rackOpen}" aria-controls="shop-drawer" aria-label="${tr('Your shop pieces', 'Mảnh tiệm của bạn')}">${selectedShop !== null && state.phase === 'build' ? sprite('shops', SPRITES[selectedShop], 'selected-piece-icon') : '▧'}<small class="selected-piece-label">${selectedShop !== null && state.phase === 'build' ? SHOPS[selectedShop].name : tr('Rack', 'Kho') + ' ' + state.players[0].tiles.reduce((a, b) => a + b, 0)}</small></button>${phaseCard()}<button class="belt-button" data-action="businesses" aria-label="${tr('Open shop ledger', 'Mở sổ tiệm')}">▤<small>${tr('Ledger', 'Sổ tiệm')}</small></button></div>`;
  get('.shop-tray').scrollLeft = oldTray;
  updateHeader();
  requestAnimationFrame(() => {
    fitMap();
    updateGuides();
    animateWallets();
    if (oldYear !== state.year) animateYear(oldYear);
  });
  renderedYear = state.year;
  if (phaseChanged) {
    observedPhase = key;
    dismissPhase();
    if (!['income', 'ended'].includes(state.phase)) {
      clearTimeout(phaseDelay);
      phaseDelay = setTimeout(() => showPhase(), oldYear === state.year ? 200 : 1100);
    }
  }
}
function updateHeader() {
  const p = $('#phase-ribbon');
  if (p) p.innerHTML = `<b>${tr('YEAR', 'NĂM')} ${state.year} / 6</b><span>${phaseName()}</span>`;
  const lang = $('#language-toggle');
  if (lang) lang.textContent = language === 'vi' ? 'VI · EN' : 'EN · VI';
  updateSoundButton();
}
function moveCamera(center: Point) {
  const world = $('.game-world'),
    before = world?.style.transform;
  cameraCenter = center;
  cameraInitialized = true;
  fitMap();
  if (world && before && !reducedMotion())
    world.animate([{ transform: before }, { transform: world.style.transform }], {
      duration: 300,
      easing: 'cubic-bezier(.2,.7,.2,1)',
    });
}
function focusDistrict(b: number) {
  const layout = BLOCK_LAYOUTS[b];
  moveCamera({ x: layout.x + 103, y: layout.y + 103 });
}
function focusLot(id: number) {
  const cell = PLOT_LAYOUT[id];
  moveCamera({ x: cell.x + 25, y: cell.y + 25 });
}
function desktopMap() {
  return globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
}
function fitMap() {
  const vp = $('.map-viewport'),
    world = $('.game-world');
  if (!vp || !world) return;
  if (!cameraInitialized) {
    const id =
      state.phase === 'receive'
        ? state.pending[0]
        : state.lots.find((l) => l.owner === 0 && l.shop === null)?.id;
    const cell = id === undefined ? null : PLOT_LAYOUT[id];
    cameraCenter = cell
      ? { x: BLOCK_LAYOUTS[cell.block].x + 103, y: BLOCK_LAYOUTS[cell.block].y + 103 }
      : { x: 550, y: 365 };
    cameraInitialized = true;
  }
  camera = cameraFor(
    vp.clientWidth,
    vp.clientHeight,
    cameraCenter,
    cameraScale,
    desktopMap() ? 'contain' : 'cover',
  );
  cameraCenter = { x: camera.x, y: camera.y };
  world.style.transform = `translate(${camera.left}px,${camera.top}px) scale(${camera.scale})`;
}
function hasProgress() {
  return (
    sessionStarted ||
    state.year > 1 ||
    state.phase !== 'receive' ||
    state.lots.some((l) => l.owner !== null)
  );
}
function renderStartMenu() {
  const menu = get('#start-screen');
  menu.hidden = !menuOpen;
  if (!menuOpen) return;
  menu.innerHTML = `<div class="menu-scene" aria-hidden="true"></div><div class="start-panel"><p class="start-kicker">BUÔN CÓ BẠN · BÁN CÓ PHƯỜNG</p><h1 class="start-logo">SAIGON<span>TOWN</span></h1><div class="menu-shops" aria-hidden="true">${sprite('shops', 'banhmi')}${sprite('shops', 'coffee')}${sprite('shops', 'pho')}</div><p class="start-description">${tr('Make a deal. Open a shop. Grow your corner of Saigon.', 'Chốt một kèo. Mở một tiệm. Gầy dựng góc phố Sài Gòn.')}</p><div class="start-actions"><button class="primary start-play" data-action="resume" ${assetsReady ? '' : 'disabled'}>${hasProgress() ? tr('Continue game', 'Chơi tiếp') : tr('Start game', 'Bắt đầu chơi')} <span>▶</span></button>${hasProgress() ? `<span class="save-caption">${tr('Year', 'Năm')} ${state.year}/6 · ${phaseName()} · ${state.players[0].cash} đ</span><button class="menu-option" data-action="new">${tr('New game', 'Ván mới')}</button>` : ''}<button class="menu-option" data-action="settings">${tr('Settings', 'Cài đặt')}</button><button class="menu-option" data-action="rules">${tr('How to play', 'Cách chơi')}</button></div><div class="load-status" role="status" aria-live="polite"><progress max="${GAME_IMAGES.length}" value="${loadingCount}"></progress><span data-load-label></span><button data-action="retry-assets" hidden>${tr('Retry', 'Thử tải lại')}</button></div><p class="start-foot">${tr('One player · Three neighbors · Six years', 'Một người chơi · Ba hàng xóm · Sáu năm')}</p>${hasProgress() ? `<button class="artbook-link" data-action="businesses">${tr('Shop ledger', 'Sổ tiệm')}</button> · <button class="artbook-link" data-action="history">${tr('Town journal', 'Nhật ký khu phố')}</button> · ` : ''}<button class="artbook-link" data-action="research">${tr('Aseprite artbook & credits', 'Sổ tranh Aseprite & tác giả')}</button></div>`;
  updateLoading();
}
function updateLoading() {
  const root = $('#start-screen');
  if (!root || root.hidden) return;
  const label = root.querySelector<HTMLElement>('[data-load-label]'),
    progress = root.querySelector('progress'),
    start = root.querySelector<HTMLButtonElement>('[data-action="resume"]'),
    retry = root.querySelector<HTMLButtonElement>('[data-action="retry-assets"]');
  if (progress) {
    progress.value = loadingCount;
    progress.hidden = assetsReady;
  }
  if (start) start.disabled = !assetsReady;
  if (retry) retry.hidden = !assetFailures.length;
  if (label)
    label.textContent = assetFailures.length
      ? tr(
          'Some artwork could not load. Tap Retry.',
          'Chưa tải được vài hình ảnh. Bấm Thử tải lại.',
        )
      : assetsReady
        ? tr('The neighborhood is ready', 'Phố mình sẵn sàng rồi')
        : tr('Opening the neighborhood…', 'Đang mở phố…') +
          ` ${loadingCount}/${GAME_IMAGES.length}`;
}
function warmAssets() {
  if (loadingPromise) return loadingPromise;
  assetsReady = false;
  assetFailures = [];
  loadingCount = 0;
  updateLoading();
  loadingPromise = preloadGameImages((count) => {
    loadingCount = count;
    updateLoading();
  })
    .then((result) => {
      assetFailures = result.failed;
      assetsReady = !assetFailures.length;
      updateLoading();
    })
    .finally(() => (loadingPromise = null));
  return loadingPromise;
}
function gameMenu() {
  cancelMapGesture();
  cancelDrag();
  dismissPhase();
  if (get('#modal').open) closeModal();
  menuOpen = true;
  render();
  requestAnimationFrame(() =>
    $('#start-screen [data-action="resume"]')?.focus({ preventScroll: true }),
  );
}
function audioSettings() {
  const a = gameAudio.getSettings();
  modal(
    tr('Make yourself at home', 'Chỉnh theo ý bạn'),
    `<div class="settings-switches"><button class="setting-switch" data-action="music" id="music-toggle" aria-pressed="${a.music}"><span><strong>♫ ${tr('Saigon lo-fi', 'Sài Gòn lofi')}</strong><small>${tr('Music changes with each phase', 'Giai điệu thay đổi theo từng bước')}</small></span><b data-audio-state></b></button><button class="setting-switch" data-action="sound" id="sound-toggle" aria-pressed="${a.sfx}"><span><strong>♪ ${tr('Game sounds', 'Âm thanh trò chơi')}</strong><small>${tr('Taps, shop openings, bargaining voices', 'Chạm, khai trương, giọng trả giá')}</small></span><b data-audio-state></b></button><button class="setting-switch" data-action="language"><span><strong>${tr('Language', 'Ngôn ngữ')}</strong><small>Tiếng Việt / English</small></span><b>${language === 'vi' ? 'VI' : 'EN'} ⇄</b></button></div><p class="audio-note">${tr('Preferences are saved on this device.', 'Lựa chọn được lưu trên thiết bị này.')}</p><div class="modal-actions"><button class="primary" data-action="close">${tr('Done', 'Xong rồi')} ✓</button></div>`,
    'SAIGON TOWN · ' + tr('SETTINGS', 'CÀI ĐẶT'),
  );
  get('#modal').dataset.settings = 'true';
  updateSoundButton();
}
function yearBook() {
  modal(
    tr('Six years in Saigon', 'Sáu năm ở Sài Gòn'),
    `<div class="year-list">${ZODIAC.map((z, i) => `<button class="${i + 1 === state.year ? 'current' : ''}" data-action="year-info" data-year="${i + 1}">${zodiacSprite(i)}<span>${tr('Year', 'Năm')} ${i + 1} · ${z[0]}</span><span>${i + 1 === state.year ? tr('Now', 'Hiện tại') : i + 1 < state.year ? '✓' : ''}</span></button>`).join('')}</div>`,
    tr('THE SAIGON CALENDAR', 'LỊCH NĂM SÀI GÒN'),
  );
}
function updateGuides() {
  document
    .querySelectorAll<HTMLElement>('.guide-target')
    .forEach((e) => e.classList.remove('guide-target'));
  const selector = {
    receive:
      chosen.length === state.draftCount ? '[data-action="claim"]' : '.lot.offered:not(.picked)',
    trade: '.player-pocket:not(.your-pocket) .pocket-main',
    build: selectedShop === null ? '.shop-piece:not(.depleted)' : '.lot.buildable',
    income: '[data-action="next"]',
    ended: '[data-action="results"]',
  }[state.phase];
  document.querySelectorAll(selector).forEach((e) => e.classList.add('guide-target'));
}
function showPhase() {
  clearTimeout(phaseDelay);
  if (view !== 'play' || menuOpen || get('#modal').open) return;
  clearTimeout(phaseTimer);
  const descriptions: Record<GamePhase, [string, string]> = {
    receive: [
      `Choose ${state.draftCount} of these addresses. Place your green stools, then keep your selection.`,
      `Chọn ${state.draftCount} địa chỉ bên dưới. Đặt ghế xanh, rồi bấm Giữ để bắt đầu thương lượng.`,
    ],
    trade: [
      'Tap a neighbor or one of their plots. Put your offer on the table and bargain for the missing pieces.',
      'Chạm hàng xóm hoặc lô của họ. Đặt tài sản lên bàn rồi trả giá để lấy mảnh còn thiếu.',
    ],
    build: [
      'Pick a shop from your rack and tap your empty plot. Or tap your plot first to open the quick build menu.',
      'Chọn mảnh tiệm rồi chạm lô trống của bạn. Hoặc chạm lô trước để mở menu xây nhanh.',
    ],
    income: [
      'Every business has paid its owner. Start the next year when you are ready.',
      'Mỗi tiệm đã trả tiền cho chủ. Khi sẵn sàng, bấm Sang năm để mở trang lịch mới.',
    ],
    ended: [
      'The final payday is here. Open the standings to find the winner.',
      'Đã đến lần thu tiền cuối cùng. Mở kết quả để xem ai thắng nhé.',
    ],
  };
  get('#phase-cue').innerHTML =
    `<section class="phase-announcement"><button data-action="dismiss-phase" class="close" aria-label="${tr('Dismiss guide', 'Đóng hướng dẫn')}">×</button><small>${tr('YEAR', 'NĂM')} ${state.year} · ${ZODIAC[state.year - 1][0]}</small><h2>${phaseName()}</h2><p>${tr(...descriptions[state.phase])}</p>${state.phase === 'receive' ? `<div class="deal-reels">${state.pending.map((id, i) => `<span style="--deal-delay:${i * 90}ms"><b>${id + 1}</b></span>`).join('')}</div>` : state.phase === 'build' ? `<div class="cue-sprites">${sprite('shops', 'coffee')}${sprite('shops', 'banhmi')}${sprite('shops', 'pho')}</div>` : state.phase === 'trade' ? `<div class="cue-tokens">${token(0)}<b>⇄</b>${token(1)}</div>` : ''}<button class="primary" data-action="dismiss-phase">${tr('Let’s go', 'Bắt đầu nào')} →</button><div class="cue-countdown"></div></section>`;
  get('#phase-cue').classList.add('show');
  playSound('phase');
  phaseTimer = setTimeout(dismissPhase, 6500);
}
function dismissPhase() {
  clearTimeout(phaseTimer);
  clearTimeout(phaseDelay);
  $('#phase-cue')?.classList.remove('show');
}
function animateYear(from: number) {
  playSound('year');
  if (reducedMotion()) return;
  $('.calendar-sheet')?.animate(
    [
      { transform: 'perspective(350px) rotateX(-45deg)', filter: 'brightness(1.35)' },
      { transform: 'perspective(350px) rotateX(0deg)', filter: 'brightness(1)' },
    ],
    { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
}
function clickLot(id: number) {
  dismissPhase();
  if (state.phase === 'receive') {
    if (!state.pending.includes(id)) {
      selectedLot = id;
      render();
      return;
    }
    selectedLot = null;
    if (chosen.includes(id)) chosen = chosen.filter((x) => x !== id);
    else if (chosen.length < state.draftCount) {
      chosen.push(id);
      freshLots = [id];
      playSound('place');
    } else
      toast(
        tr(
          `Keep ${state.draftCount} addresses. Lift a stool first.`,
          `Chỉ giữ ${state.draftCount} địa chỉ. Nhấc một ghế trước nhé.`,
        ),
      );
    render();
    scheduleFreshClear();
    return;
  }
  if (state.phase === 'build' && selectedShop !== null && canPlace(state, 0, id, selectedShop)) {
    buildPiece(id, selectedShop);
    return;
  }
  selectedLot = id;
  render();
}
function buildPiece(id: number, shop: number) {
  const before = income(state, 0);
  placeShop(state, id, shop);
  selectedLot = null;
  freshLots = [id];
  playSound('build');
  if (!state.players[0].tiles[shop]) selectedShop = null;
  changed();
  scheduleFreshClear();
  const g = groups(state, 0).find((g) => g.lots.includes(id));
  toast(
    `${SHOPS[shop].name} · ${g?.size ?? 1}/${SHOPS[shop].size} ${tr('connected', 'liền kề')} · +${income(state, 0) - before} đ/${tr('yr', 'năm')}`,
  );
  return { id, shop, annualIncome: income(state, 0) };
}
function scheduleFreshClear() {
  clearTimeout(freshTimer);
  freshTimer = setTimeout(() => {
    freshLots = [];
    document.querySelectorAll<HTMLElement>('.fresh').forEach((el) => el.classList.remove('fresh'));
  }, 1800);
}
function updateSoundButton() {
  const a = gameAudio.getSettings();
  for (const [selector, on, label] of [
    ['#music-toggle', a.music, tr('Music', 'Nhạc')],
    ['#sound-toggle', a.sfx, tr('Game sounds', 'Âm thanh')],
  ] as const) {
    const el = $(selector);
    if (!el) continue;
    el.setAttribute('aria-pressed', String(on));
    el.setAttribute('aria-label', label + ': ' + (on ? tr('on', 'bật') : tr('off', 'tắt')));
    const stateLabel = el.querySelector<HTMLElement>('[data-audio-state]');
    if (stateLabel) stateLabel.textContent = on ? tr('On', 'Bật') : tr('Off', 'Tắt');
  }
}

function playSound(kind: SoundEffect = 'tap') {
  gameAudio.play(kind);
}
function animateWallets() {
  if (!payout) return;
  cancelAnimationFrame(cashFrame);
  const p = payout,
    elapsed = performance.now() - p.start,
    t = reducedMotion() ? 1 : Math.min(1, Math.max(0, (elapsed - 350) / 1600)),
    ease = 1 - Math.pow(1 - t, 3);
  state.players.forEach((player, i) => {
    const el = $(`[data-wallet="${i}"]`);
    if (el) {
      el.innerHTML = money(Math.round(p.before[i] + (player.cash - p.before[i]) * ease));
      el.classList.toggle('wallet-counting', t < 1);
    }
  });
  if (t < 1) cashFrame = requestAnimationFrame(animateWallets);
  else payout = null;
}
function celebratePayday(before: number[]) {
  dismissPhase();
  payout = { before, start: performance.now() };
  playSound('income');
  animateWallets();
  const fx = get('#effects');
  fx.innerHTML = '';
  if (!reducedMotion())
    state.players.forEach((p, i) => {
      const to = $(`[data-wallet="${i}"]`)?.getBoundingClientRect();
      if (!to) return;
      const sources = holdings(state, i)
        .filter((l) => l.shop !== null)
        .slice(0, 5);
      sources.forEach((l, n) => {
        const r = $(`[data-lot="${l.id}"]`)?.getBoundingClientRect();
        if (!r) return;
        const el = document.createElement('div');
        el.className = 'flying-note';
        el.innerHTML = sprite('life', 'game-banknote');
        fx.append(el);
        const sx = r.x + r.width / 2,
          sy = r.y + r.height / 2,
          tx = to.x + to.width / 2,
          ty = to.y + to.height / 2;
        const anim = el.animate(
          [
            { transform: `translate(${sx}px,${sy}px) rotate(-18deg) scale(.6)`, opacity: 0 },
            {
              offset: 0.18,
              transform: `translate(${sx}px,${sy - 40}px) rotate(8deg) scale(1.1)`,
              opacity: 1,
            },
            { transform: `translate(${tx}px,${ty}px) rotate(0) scale(.5)`, opacity: 0 },
          ],
          {
            duration: 1500,
            delay: n * 100 + i * 70,
            easing: 'cubic-bezier(.3,.1,.4,1)',
            fill: 'both',
          },
        );
        anim.onfinish = () => el.remove();
      });
    });
  const banner = document.createElement('div');
  banner.className = 'payday-banner';
  banner.innerHTML = `<small>${tr('YEAR-END PAYDAY', 'THU TIỀN CUỐI NĂM')}</small><strong>+${state.lastIncome[0]} đ</strong><span>${tr('Your shops are paying off', 'Buôn may bán đắt!')}</span>`;
  fx.append(banner);
  setTimeout(() => banner.remove(), 3200);
}
function openTrade(prefillLot: number | null = null, prefillShop: number | null = null) {
  if (state.phase !== 'trade')
    return toast(
      tr(
        'Trading opens after you claim your addresses.',
        'Thương lượng mở sau khi bạn nhận mặt bằng.',
      ),
    );
  if (prefillLot !== null) partner = state.lots[prefillLot].owner ?? partner;
  trading.open(partner, prefillLot, prefillShop);
}
function playerInfo(id: number) {
  const p = state.players[id];
  modal(
    id === 0 ? tr('Your inventory.', 'Kho của bạn.') : `${p.name} · ${tr('Inventory', 'Tài sản')}`,
    `<div class="neighbor-summary">${token(p.id)}<strong>${money(p.cash)}</strong><span>${holdings(state, id).length} ${tr('plots', 'lô')} · ${income(state, id)} đ/${tr('yr', 'năm')}</span></div><p>${id === 0 ? tr('Choose a shop piece to build during the Build phase.', 'Chọn mảnh tiệm để đặt ở bước Mở tiệm.') : state.phase === 'trade' ? tr('Tap a shop to start a trade for that piece.', 'Chạm mảnh tiệm để bắt đầu đổi lấy mảnh đó.') : tr('Their unused pieces. You can bargain for these during Trade.', 'Mảnh tiệm chưa dùng của hàng xóm. Bạn có thể đổi lấy ở bước Thương lượng.')}</p><div class="neighbor-shop-grid">${SHOPS.map((s, i) => `<button data-action="glance-shop" data-player="${id}" data-shop-index="${i}" ${p.tiles[i] === 0 ? 'disabled' : ''}>${sprite('shops', SPRITES[i])}<strong>${s.name} ×${p.tiles[i]}</strong><small>${s.size} ${tr('tiles', 'mảnh')} → ${COMPLETE[s.size]} đ</small></button>`).join('')}</div><p class="mini-label">${tr('ADDRESSES', 'MẶT BẰNG')}</p><div class="neighbor-lots">${
      holdings(state, id)
        .map(
          (l) =>
            `<button data-action="inspect-player-lot" data-id="${l.id}">${l.shop !== null ? sprite('shops', SPRITES[l.shop]) : token(id)}<b>${l.id + 1}</b></button>`,
        )
        .join('') || tr('None yet.', 'Chưa có.')
    }</div>${state.phase === 'trade' && id !== 0 ? `<button class="primary wide" data-action="trade-player" data-player="${id}">${tr('Bargain with', 'Thương lượng với')} ${p.name} ⇄</button>` : ''}${id === 0 ? `<button class="secondary wide" data-action="businesses">${tr('Business ledger', 'Sổ tiệm')}</button>` : ''}`,
  );
}
function rules() {
  modal(
    'Build a street worth coming back to.',
    `<p>You and three computer neighbors have six years to grow a business community. The most cash after the sixth payday wins.</p><ol><li><strong>Receive.</strong> Choose from your offered addresses, then receive shop tiles. You keep ${KEEP.join(', ')} plots in years 1–6. Tiles: 5 in year one, then 4 each year.</li><li><strong>Trade.</strong> Make as many deals as you like. Exchange cash, empty plots, built plots, and unused shop tiles. Both sides must accept; our computer neighbors assess each proposal.</li><li><strong>Build.</strong> Place any number of tiles on your own empty plots for free. Drag a shop from your rack to your empty address, or select the shop and tap its plot. Placement is permanent. Unused tiles carry over.</li><li><strong>Collect.</strong> Every business pays every year, even one just opened. The game ends after year six’s income.</li></ol><h3>What counts as one business?</h3><p>Tiles of the same shop type and owner connect along shared edges inside one block. Diagonals and streets don’t connect. Match the shop’s target size to complete it.</p><table><thead><tr><th>Tiles</th><th>Incomplete income</th><th>Complete income</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map((n) => `<tr><td>${n}</td><td>${n === 6 ? '—' : INCOMPLETE[n] + ' đ'}</td><td>${n >= 3 ? COMPLETE[n] + ' đ' : '—'}</td></tr>`).join('')}</tbody></table><p class="rules-note">Example: three connected Cà phê tiles earn 50 đ every year. Three connected Phở tiles earn 40 đ; add a fourth to earn 80 đ. Separate businesses are paid separately.</p><h3>Small but useful details</h3><ul><li>You start with 50 đ. All amounts are fictional đồng; these are game values.</li><li>No building costs, rent, interest, or end-game resale value. Tied cash is broken by most shop tiles on the board; an exact tie is shared.</li><li>A group larger than its target pays as complete target-sized sets plus an incomplete remainder. You can keep growing along the block.</li><li>Switching to Build closes trading for that year. Check your deals first.</li><li>Progress saves only in this browser. These are local computer opponents, not online players. Cash is visible in this adaptation.</li></ul><button class="primary wide" data-action="close">Back to the neighborhood</button>`,
    'HOW TO PLAY',
  );
}
function incomeModal() {
  modal(
    tr('This year’s earnings.', 'Sổ thu năm nay.'),
    `<p>${tr('Every business has paid its owner.', 'Mỗi tiệm đã trả tiền cho chủ.')}</p>${state.players.map((p, i) => `<div class="score-row">${token(i)}<span>${i === 0 ? tr('You', 'Bạn') : escape(p.name)}</span><strong>+${money(state.lastIncome[i] ?? 0)}</strong><span class="muted">${tr('Total', 'Tổng')} ${p.cash} đ</span></div>`).join('')}<div class="modal-actions"><button class="primary" data-action="${state.phase === 'ended' ? 'results' : 'next'}">${state.phase === 'ended' ? tr('Final standings', 'Xem kết quả') : tr('Begin year ', 'Sang năm ') + (state.year + 1)} →</button></div>`,
    phaseName('income'),
  );
}
function results() {
  const ranked = rankings(state),
    top = ranked[0].cash,
    topTiles = state.lots.filter((l) => l.owner === ranked[0].id && l.shop !== null).length,
    winners = ranked.filter(
      (p) =>
        p.cash === top &&
        state.lots.filter((l) => l.owner === p.id && l.shop !== null).length === topTiles,
    );
  modal(
    winners.length > 1
      ? tr('A shared victory.', 'Cùng chia chiến thắng.')
      : ranked[0].id === 0
        ? tr('This neighborhood is yours!', 'Phố này là của bạn!')
        : `${escape(ranked[0].name)} ${tr('wins!', 'chiến thắng!')}`,
    `<p>${tr('The final payday is counted.', 'Đã tính lần thu tiền cuối cùng.')}</p>${ranked.map((p, i) => `<div class="score-row ${winners.some((w) => w.id === p.id) ? 'winner' : ''}"><span>${i + 1}</span>${token(p.id)}<span>${p.id === 0 ? tr('You', 'Bạn') : escape(p.name)}</span><strong>${money(p.cash)}</strong></div>`).join('')}<p class="muted">${tr(`You completed ${state.trades} trades. Your businesses earned ${income(state, 0)} đ in the last year. Cash ties are broken by placed shop pieces.`, `Bạn đã chốt ${state.trades} giao dịch. Các tiệm thu ${income(state, 0)} đ ở năm cuối. Nếu bằng tiền, ai đã xây nhiều mảnh hơn xếp trên.`)}</p><div class="modal-actions"><button class="secondary" data-action="close">${tr('Explore the town', 'Ngắm khu phố')}</button><button class="primary" data-action="new">${tr('Play again', 'Chơi ván mới')}</button></div>`,
    tr('SIX YEARS · FINAL STANDINGS', 'SÁU NĂM · KẾT QUẢ'),
  );
}
function shopEntry(g: ShopGroup, index: number) {
  const shop = SHOPS[g.shop],
    target = shop.size,
    completed = Math.floor(g.size / target),
    remainder = g.size % target,
    earned = groupIncome(g.shop, g.size);
  return `<article class="ledger-entry"><div class="entry-illustration">${sprite('shops', SPRITES[g.shop])}<span>${String(index + 1).padStart(2, '0')}</span></div><div class="entry-writing"><div class="entry-title"><h3>${shop.name}</h3><strong>${earned}<small> đ/${tr('yr', 'năm')}</small></strong></div><p class="entry-address">${DISTRICTS[Math.floor(g.lots[0] / 12)]} · ${tr('Plots', 'Lô')} ${g.lots.map((x) => x + 1).join(', ')}</p><div class="entry-progress"><span>${g.size} / ${target} ${tr('connected', 'liền kề')}</span><span class="ink-stamp ${completed ? 'complete' : ''}">${completed ? tr('COMPLETE', 'ĐỦ BỘ') : tr('GROWING', 'ĐANG GHÉP')}</span></div><p class="entry-note">${completed ? tr(`${completed} complete set${completed > 1 ? 's' : ''}${remainder ? ' + ' + remainder + ' extra tiles' : ''}.`, `${completed} bộ hoàn chỉnh${remainder ? ' + ' + remainder + ' mảnh dư' : ''}.`) : tr(`Add ${target - g.size} matching, connected tile${target - g.size > 1 ? 's' : ''} to earn ${COMPLETE[target]} đ/year.`, `Thêm ${target - g.size} mảnh cùng loại liền kề để thu ${COMPLETE[target]} đ/năm.`)}</p></div></article>`;
}
function businesses(page = 0) {
  const all = groups(state, 0),
    count = Math.max(1, Math.ceil(all.length / 6));
  ledgerPage = Math.max(0, Math.min(count - 1, page));
  const start = ledgerPage * 6,
    spread = all.slice(start, start + 6),
    left = spread.slice(0, 3),
    right = spread.slice(3),
    total = income(state, 0);
  modal(
    tr('Your shop ledger', 'Sổ tiệm của bạn'),
    `<div class="ledger-binding"><span class="book-ribbon" aria-hidden="true"></span><div class="book-spread"><section class="book-page left-page"><div class="page-heading"><span>SAIGON TOWN</span><span>${tr('YEAR', 'NĂM')} ${state.year}</span></div>${ledgerPage === 0 ? `<div class="ledger-book-title"><small>${tr('THE NEIGHBORHOOD ACCOUNTS', 'SỔ GHI CHÉP KHU PHỐ')}</small><h2>${tr('Your shop ledger', 'Sổ tiệm của bạn')}</h2><p>${tr('Shops, addresses & yearly earnings', 'Tiệm nhà mình · Mặt bằng · Tiền thu')}</p></div>` : `<h2 class="ledger-continuation">${tr('The accounts continue…', 'Ghi tiếp sổ tiệm…')}</h2>`}${left.map((g, i) => shopEntry(g, start + i)).join('') || `<div class="empty-ledger">${sprite('shops', 'coffee')}<h3>${tr('A blank page. A new beginning.', 'Trang sổ mới, tiệm đầu tiên.')}</h3><p>${tr('Open a shop on one of your plots. Its address and yearly income will be recorded here.', 'Mở tiệm trên lô của bạn. Địa chỉ và tiền thu mỗi năm sẽ được ghi vào đây.')}</p></div>`}<span class="page-number">${ledgerPage * 2 + 1}</span></section><section class="book-page right-page"><div class="page-heading"><span>${tr('BUSINESS INCOME', 'THU NHẬP TỪ TIỆM')}</span><span>${tr('Ledger', 'Sổ số')} 01</span></div>${right.map((g, i) => shopEntry(g, start + 3 + i)).join('')}${right.length < 3 ? `<div class="book-margin-note"><strong>${tr('A note for tomorrow', 'Ghi nhớ cho ngày mai')}</strong><p>${tr('Matching shops of your color must share an edge. Roads, courtyards and diagonal corners do not connect.', 'Tiệm cùng loại, cùng chủ phải chung cạnh. Qua đường, sân trống hoặc chéo góc không nối thành cụm.')}</p><p>${tr('Smaller groups still pay. Complete the target shown on the shop piece for a higher yearly income.', 'Chưa đủ bộ vẫn có tiền. Ghép đủ số mảnh ghi trên tiệm để tăng tiền thu mỗi năm.')}</p></div>` : ''}<div class="ledger-tally"><span>${tr('ALL YOUR SHOPS · EACH YEAR', 'TẤT CẢ TIỆM · MỖI NĂM')}</span><strong>${total}<small> đ</small></strong><div>${all.length} ${tr('business groups', 'cụm tiệm')} · ${holdings(state, 0).filter((l) => l.shop !== null).length} ${tr('placed pieces', 'mảnh đã xây')}</div></div><div class="ledger-signature">${tr('Recorded in Saigon', 'Ghi tại Sài Gòn')}</div><span class="page-number">${ledgerPage * 2 + 2}</span></section></div></div><nav class="book-navigation" aria-label="${tr('Ledger pages', 'Lật trang sổ')}"><button data-action="ledger-prev" class="book-tab" ${ledgerPage === 0 ? 'disabled' : ''}>← ${tr('Previous', 'Trang trước')}</button><span>${ledgerPage + 1} / ${count}</span><button data-action="ledger-next" class="book-tab" ${ledgerPage === count - 1 ? 'disabled' : ''}>${tr('Next', 'Trang sau')} →</button></nav>`,
    tr('THE OLD SHOPKEEPER’S BOOK', 'CUỐN SỔ NGƯỜI BUÔN'),
  );
  get('#modal').classList.add('ledger-dialog');
}
function renderResearch() {
  get('#app').innerHTML = researchMarkup(state, sprite, token, tr);
}
function act(action: string | undefined, el?: HTMLElement) {
  const data = el?.dataset ?? {};
  switch (action) {
    case 'close':
      closeModal();
      break;
    case 'play':
      view = 'play';
      gameMenu();
      break;
    case 'resume':
      if (!assetsReady) return;
      void gameAudio.unlock();
      menuOpen = false;
      sessionStarted = true;
      view = 'play';
      render();
      requestAnimationFrame(() => {
        $('.map-viewport')?.focus({ preventScroll: true });
        showPhase();
      });
      break;
    case 'retry-assets':
      void warmAssets();
      break;
    case 'research':
      closeModal();
      menuOpen = false;
      get('#start-screen').hidden = true;
      document.body.classList.remove('menu-open');
      view = 'research';
      render();
      window.scrollTo({ top: 0 });
      break;
    case 'language': {
      const inSettings = get('#modal').dataset.settings === 'true';
      language = language === 'vi' ? 'en' : 'vi';
      try {
        localStorage.setItem('vietnamtown-language', language);
      } catch {}
      closeModal();
      dismissPhase();
      render();
      if (inSettings) audioSettings();
      break;
    }
    case 'rules':
      if (language === 'en') rules();
      else rulesVietnamese();
      break;
    case 'sound':
      gameAudio.setSfx(!gameAudio.getSettings().sfx);
      void gameAudio.unlock().then(() => playSound());
      toast(
        gameAudio.getSettings().sfx
          ? '♪ ' + tr('Tap sounds on', 'Đã bật âm thanh chạm')
          : tr('Tap sounds off', 'Đã tắt âm thanh chạm'),
      );
      break;
    case 'music':
      gameAudio.setMusic(!gameAudio.getSettings().music);
      void gameAudio.unlock();
      toast(
        gameAudio.getSettings().music
          ? '♫ ' +
              tr(
                'Saigon lo-fi · music follows each phase',
                'Sài Gòn lofi · nhạc đổi theo từng bước',
              )
          : tr('Music off', 'Đã tắt nhạc'),
      );
      break;
    case 'guide':
      if (get('#modal').open) closeModal();
      showPhase();
      break;
    case 'dismiss-phase':
      dismissPhase();
      updateGuides();
      break;
    case 'menu':
      gameMenu();
      break;
    case 'settings':
    case 'audio-settings':
      audioSettings();
      break;
    case 'rack':
      rackOpen = !rackOpen;
      render();
      break;
    case 'years':
      yearBook();
      break;
    case 'year-info': {
      const y = Number(data.year),
        z = ZODIAC[y - 1];
      modal(
        `${tr('Year', 'Năm')} ${y} · ${z[0]}`,
        `<div class="zodiac-detail">${zodiacSprite(y - 1)}<p>${tr('The year of the ' + z[1].toLowerCase() + '.', 'Năm ' + z[0] + '.')}</p></div><p>${y === state.year ? tr('Your current year.', 'Bạn đang ở năm này.') : y < state.year ? tr('This year is complete.', 'Năm này đã qua.') : tr('Finish this year to turn the next calendar page.', 'Hoàn thành năm hiện tại để sang trang lịch mới.')}</p><div class="year-rewards"><strong>${KEEP[y - 1]} <small>${tr('new plots', 'lô mới')}</small></strong><span>+</span><strong>${y === 1 ? 5 : 4} <small>${tr('shop pieces', 'mảnh tiệm')}</small></strong></div><p class="rules-note">${tr('Six successive zodiac animals beginning with Snake. This is a game calendar.', 'Sáu con giáp liên tiếp, bắt đầu từ Tỵ. Đây là lịch riêng của trò chơi.')}</p>`,
        'VÒNG NĂM CON GIÁP',
      );
      break;
    }
    case 'player-info':
      playerInfo(Number(data.player));
      break;
    case 'glance-shop': {
      const id = Number(data.player),
        shop = Number(data.shopIndex);
      if (id === 0) {
        closeModal();
        selectedShop = shop;
        selectedLot = null;
        rackOpen = true;
        render();
        if (state.phase !== 'build')
          toast(tr('You can place this during Build.', 'Bạn có thể đặt mảnh này ở bước Mở tiệm.'));
      } else if (state.phase === 'trade') {
        partner = id;
        openTrade(null, shop);
      } else playerInfo(id);
      break;
    }
    case 'inspect-player-lot': {
      const id = Number(data.id);
      closeModal();
      if (state.phase === 'trade' && state.lots[id].owner !== 0) openTrade(id);
      else {
        selectedLot = id;
        render();
        focusLot(id);
      }
      break;
    }
    case 'trade-player':
      partner = Number(data.player);
      openTrade();
      break;
    case 'claim': {
      freshLots = [...chosen];
      claimPlots(state, chosen);
      chosen = [];
      selectedLot = null;
      changed();
      scheduleFreshClear();
      playSound('build');
      toast(
        tr(
          'Addresses claimed. Your new shop pieces are in the rack.',
          'Đã nhận mặt bằng. Mảnh tiệm mới đã vào kho.',
        ),
      );
      break;
    }
    case 'trade':
      openTrade();
      break;
    case 'trade-lot':
      openTrade(Number(data.id));
      break;
    case 'build':
      modal(
        tr('All deals done?', 'Chốt hết rồi chứ?'),
        `<p>${tr('Building closes trading for this year. Shop placement is permanent.', 'Bắt đầu xây sẽ đóng thương lượng trong năm này. Mảnh tiệm đã đặt sẽ giữ nguyên vị trí.')}</p><div class="modal-actions"><button class="secondary" data-action="close">${tr('Keep bargaining', 'Trả giá tiếp')}</button><button class="primary" data-action="confirm-build">${tr('Open the shops', 'Mở tiệm thôi')} →</button></div>`,
        phaseName('build'),
      );
      break;
    case 'confirm-build':
      beginBuild(state);
      selectedLot = null;
      selectedShop = null;
      closeModal();
      changed();
      break;
    case 'quick-build': {
      const id = Number(data.id),
        shop = Number(data.index);
      if (state.lots[id].shop === null) buildPiece(id, shop);
      else {
        selectedShop = shop;
        selectedLot = null;
        render();
        toast(
          tr(
            'Tap one of your empty plots beside this business.',
            'Chạm một lô trống của bạn cạnh tiệm này.',
          ),
        );
      }
      break;
    }
    case 'place':
      if (selectedLot !== null && selectedShop !== null) buildPiece(selectedLot, selectedShop);
      break;
    case 'deselect':
      selectedLot = null;
      render();
      break;
    case 'collect': {
      const possible = holdings(state, 0).some((l) =>
        SHOPS.some((_, s) => canPlace(state, 0, l.id, s)),
      );
      if (possible)
        modal(
          tr('Close up for the year?', 'Nghỉ bán để thu tiền nhé?'),
          `<p>${tr('You can still build. Keep unused pieces for next year, or open more shops now.', 'Bạn vẫn còn mảnh có thể xây. Giữ lại cho năm sau, hoặc mở thêm tiệm ngay bây giờ.')}</p><div class="modal-actions"><button class="secondary" data-action="close">${tr('Keep building', 'Xây tiếp')}</button><button class="primary" data-action="confirm-collect">${tr('Collect income', 'Thu tiền năm nay')}</button></div>`,
        );
      else act('confirm-collect');
      break;
    }
    case 'confirm-collect': {
      const built = new Set(state.lots.filter((l) => l.shop !== null).map((l) => l.id)),
        cash = state.players.map((p) => p.cash);
      finishYear(state);
      freshLots = state.lots.filter((l) => l.shop !== null && !built.has(l.id)).map((l) => l.id);
      selectedLot = null;
      selectedShop = null;
      closeModal();
      changed();
      scheduleFreshClear();
      celebratePayday(cash);
      break;
    }
    case 'income':
      incomeModal();
      break;
    case 'next': {
      cancelAnimationFrame(cashFrame);
      payout = null;
      get('#effects').innerHTML = '';
      nextYear(state);
      chosen = [];
      selectedLot = null;
      selectedShop = null;
      closeModal();
      changed();
      break;
    }
    case 'results':
      results();
      break;
    case 'businesses':
      businesses();
      break;
    case 'ledger-prev':
      businesses(ledgerPage - 1);
      playSound('place');
      break;
    case 'ledger-next':
      businesses(ledgerPage + 1);
      playSound('place');
      break;
    case 'history':
      modal(
        tr('The neighborhood journal.', 'Nhật ký khu phố.'),
        `<ul class="history">${state.logs.map((l) => `<li>${escape(l)}</li>`).join('')}</ul>`,
      );
      break;
    case 'new':
      if (!assetsReady) {
        toast(tr('Let the artwork finish loading first.', 'Đợi hình ảnh tải xong một chút nhé.'));
        break;
      }
      modal(
        tr('Start a new neighborhood?', 'Bắt đầu khu phố mới?'),
        `<p>${tr('This replaces the game saved in this browser.', 'Ván đang lưu trên trình duyệt sẽ được thay thế.')}</p><div class="modal-actions"><button class="secondary" data-action="close">${tr('Keep this game', 'Giữ ván này')}</button><button class="primary" data-action="confirm-new">${tr('A fresh beginning', 'Bắt đầu lại')}</button></div>`,
      );
      break;
    case 'confirm-new':
      cancelAnimationFrame(cashFrame);
      payout = null;
      get('#effects').innerHTML = '';
      state = newGame();
      observedPhase = '';
      selectedLot = null;
      selectedShop = null;
      chosen = [];
      freshLots = [];
      cameraInitialized = false;
      cameraScale = null;
      rackOpen = false;
      view = 'play';
      menuOpen = false;
      sessionStarted = true;
      closeModal();
      changed();
      break;
  }
}
function rulesVietnamese() {
  modal(
    'Buôn có bạn, bán có phường.',
    `<p>Bạn cùng Linh, Minh và An xây phố qua sáu năm. Sau lần thu tiền thứ sáu, người nhiều tiền nhất thắng.</p><ol><li><strong>Nhận lộc.</strong> Đặt ghế xanh lên số lô được giữ: ${KEEP.join(', ')} lô ở các năm 1–6. Nhận 5 mảnh tiệm ở năm đầu, rồi 4 mảnh mỗi năm sau.</li><li><strong>Thương lượng.</strong> Chạm hàng xóm, lô hoặc mảnh tiệm của họ. Đặt tiền, mảnh và mặt bằng lên bàn để trao đổi. Bớt mảnh bằng cách chạm vào đồ đã đặt lên bàn. Có thể trả giá nhiều lần.</li><li><strong>Mở tiệm.</strong> Chọn mảnh rồi chạm lô trống của bạn, kéo thả mảnh, hoặc chạm lô để mở menu xây nhanh. Xây miễn phí, không thể di chuyển mảnh đã xây. Mảnh chưa dùng giữ cho năm sau.</li><li><strong>Thu tiền.</strong> Tiệm vừa xây cũng có thu nhập. Thu xong thì chuyển năm.</li></ol><h3>Ghép thế nào để có nhiều tiền?</h3><p>Tiệm cùng loại, cùng chủ và chung cạnh trong một khu phố sẽ nối thành một cụm. Qua đường hoặc chéo góc không nối. Đủ số mảnh ghi trên tiệm sẽ được mức thu nhập hoàn chỉnh.</p><table><thead><tr><th>Số mảnh</th><th>Chưa đủ</th><th>Đã đủ</th></tr></thead><tbody>${[1, 2, 3, 4, 5, 6].map((n) => `<tr><td>${n}</td><td>${INCOMPLETE[n] ?? '—'} đ</td><td>${n >= 3 ? COMPLETE[n] : '—'} đ</td></tr>`).join('')}</tbody></table><p>Tiền là đơn vị đ giả định trong trò chơi. Nếu bằng tiền, ai đã xây nhiều mảnh hơn xếp trên. Đối thủ máy trả giá theo giá trị tài sản và vị trí liền kề.</p>`,
    'CÁCH CHƠI',
  );
}
function preserveControlFocus(el: HTMLElement) {
  if (document.activeElement !== document.body) return;
  for (const attr of ['data-lot', 'data-shop', 'data-action'])
    if (el.hasAttribute(attr)) {
      document
        .querySelector<HTMLElement>(`[${attr}="${el.getAttribute(attr)}"]`)
        ?.focus({ preventScroll: true });
      break;
    }
}
document.addEventListener('click', (e) => {
  if (
    eventElement(e)?.closest<HTMLElement>('.map-viewport') &&
    (mapInput.blocksClick || performance.now() < mapTapBlockUntil)
  ) {
    e.preventDefault();
    return;
  }
  if (suppressClick) {
    suppressClick = false;
    e.preventDefault();
    return;
  }
  const barter = eventElement(e)?.closest<HTMLElement>('[data-bargain]');
  if (barter) {
    trading.handle(barter);
    return;
  }
  const el = eventElement(e)?.closest<HTMLElement>('[data-action],[data-lot],[data-shop]');
  if (!el || el.hasAttribute('disabled')) return;
  try {
    playSound('tap');
    if (el.dataset.lot !== undefined) {
      clickLot(Number(el.dataset.lot));
      if (el.classList.contains('address-slip')) focusLot(Number(el.dataset.lot));
    } else if (el.dataset.shop !== undefined) {
      dismissPhase();
      const shop = Number(el.dataset.shop);
      selectedShop = selectedShop === shop ? null : shop;
      selectedLot = null;
      if (selectedShop !== null && state.phase === 'build' && lastInputType === 'touch')
        rackOpen = false;
      render();
      if (state.phase !== 'build')
        toast(tr('Keep this piece in mind for Build.', 'Để dành mảnh này cho bước Mở tiệm nhé.'));
      else if (state.players[0].tiles[shop] === 0)
        toast(tr('You have none of this piece.', 'Kho chưa có mảnh tiệm này.'));
    } else act(el.dataset.action, el);
    preserveControlFocus(el);
  } catch (error) {
    toast(errorMessage(error));
  }
});
function clearDrop() {
  document
    .querySelectorAll<HTMLElement>('.drop-target')
    .forEach((l) => l.classList.remove('drop-target'));
}
function cancelDrag() {
  drag = null;
  get('#drag-piece').className = '';
  get('#drag-piece').innerHTML = '';
  document.body.classList.remove('dragging');
  clearDrop();
}
function cancelMapGesture() {
  const ids = [...mapInput.points.keys()],
    vp = $('.map-viewport'),
    consumed = mapInput.clear(true);
  if (consumed) mapTapBlockUntil = performance.now() + 450;
  for (const id of ids)
    try {
      if (vp?.hasPointerCapture(id)) vp.releasePointerCapture(id);
    } catch {}
}
function mapPoint(e: MouseEvent, vp: HTMLElement) {
  const r = vp.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function applyMapCamera(next: Camera) {
  cameraScale = next.scale;
  cameraCenter = { x: next.x, y: next.y };
  fitMap();
}
document.addEventListener(
  'wheel',
  (e) => {
    const vp = eventElement(e)?.closest?.<HTMLElement>('.map-viewport');
    if (!vp || menuOpen || get('#modal').open) return;
    if (e.cancelable) e.preventDefault();
    if (drag || mapInput.blocksClick || !Number.isFinite(e.deltaY) || e.deltaY === 0) return;
    if (!camera) fitMap();
    if (!camera) return;
    $('.game-world')
      ?.getAnimations()
      .forEach((a) => a.cancel());
    applyMapCamera(
      wheelCamera(vp.clientWidth, vp.clientHeight, camera, mapPoint(e, vp), e.deltaY, e.deltaMode),
    );
  },
  { passive: false },
);
document.addEventListener('pointerdown', (e) => {
  if (menuOpen || get('#modal').open || e.button !== 0) return;
  const vp = eventElement(e)?.closest<HTMLElement>('.map-viewport');
  if (vp) {
    if (drag) return;
    if (!mapInput.blocksClick) mapTapBlockUntil = 0;
    if (!camera) fitMap();
    if (!camera) return;
    if (
      mapInput.down(e.pointerId, mapPoint(e, vp), { ...camera }, vp.clientWidth, vp.clientHeight)
    ) {
      $('.game-world')
        ?.getAnimations()
        .forEach((a) => a.cancel());
      if (mapInput.active) {
        mapTapBlockUntil = performance.now() + 450;
        for (const id of mapInput.points.keys())
          try {
            vp.setPointerCapture(id);
          } catch {}
      }
    }
    return;
  }
  if (drag || mapInput.points.size || e.pointerType !== 'mouse') return;
  const shop = eventElement(e)?.closest<HTMLElement>('[data-drag-shop]'),
    counter = eventElement(e)?.closest<HTMLElement>('[data-drag-token]');
  let type: PieceDrag['type'] | null = null,
    index = 0;
  if (
    shop &&
    state.phase === 'build' &&
    state.players[0].tiles[Number(shop.dataset.dragShop)] > 0
  ) {
    type = 'shop';
    index = Number(shop.dataset.dragShop);
  } else if (counter && state.phase === 'receive') {
    type = 'counter';
    index = 0;
  }
  const source = shop || counter;
  if (type && source)
    drag = {
      type,
      index,
      el: source,
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      active: false,
    };
});
document.addEventListener(
  'pointermove',
  (e) => {
    if (!mapInput.points.has(e.pointerId)) return;
    const vp = $('.map-viewport');
    if (!vp) {
      cancelMapGesture();
      return;
    }
    const next = mapInput.move(e.pointerId, mapPoint(e, vp));
    if (!next) return;
    if (e.cancelable) e.preventDefault();
    mapTapBlockUntil = performance.now() + 450;
    try {
      vp.setPointerCapture(e.pointerId);
    } catch {}
    applyMapCamera(next);
  },
  { passive: false },
);
document.addEventListener('pointerup', (e) => {
  if (!mapInput.points.has(e.pointerId) && !mapInput.ignored.has(e.pointerId)) return;
  const vp = $('.map-viewport');
  if (camera && mapInput.up(e.pointerId, { ...camera })) mapTapBlockUntil = performance.now() + 450;
  try {
    if (vp?.hasPointerCapture(e.pointerId)) vp.releasePointerCapture(e.pointerId);
  } catch {}
});
document.addEventListener('pointercancel', (e) => {
  if (mapInput.points.has(e.pointerId) || mapInput.ignored.has(e.pointerId)) {
    if (camera) mapInput.up(e.pointerId, { ...camera });
    cancelMapGesture();
  }
});
document.addEventListener('lostpointercapture', (e) => {
  if (eventElement(e)?.matches?.('.map-viewport') && mapInput.points.has(e.pointerId))
    cancelMapGesture();
});
window.addEventListener('blur', () => {
  cancelMapGesture();
  mapInput.clear();
});
window.addEventListener('resize', cancelMapGesture);
document.addEventListener(
  'pointermove',
  (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!drag.active && Math.hypot(dx, dy) < 6) return;
    if (!drag.active) {
      drag.active = true;
      try {
        drag.el.setPointerCapture(e.pointerId);
      } catch {}
      document.body.classList.add('dragging');
      if (drag.type === 'shop') {
        selectedShop = drag.index;
        document
          .querySelectorAll<HTMLElement>('.lot')
          .forEach((l) =>
            l.classList.toggle(
              'buildable',
              canPlace(state, 0, Number(l.dataset.lot), selectedShop ?? -1),
            ),
          );
      }
      {
        get('#drag-piece').innerHTML =
          drag.type === 'shop' ? sprite('shops', SPRITES[drag.index]) : token(0);
        get('#drag-piece').className = 'show' + (drag.type === 'counter' ? ' token-drag' : '');
      }
    }
    if (e.cancelable) e.preventDefault();
    get('#drag-piece').style.left = e.clientX + 'px';
    get('#drag-piece').style.top = e.clientY + 'px';
    clearDrop();
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-lot]');
    if (target) {
      const id = Number(target.dataset.lot),
        valid =
          drag.type === 'counter' ? state.pending.includes(id) : canPlace(state, 0, id, drag.index);
      if (valid) target.classList.add('drop-target');
    }
  },
  { passive: false },
);
document.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const ended = drag;
  const target = document
    .elementFromPoint(e.clientX, e.clientY)
    ?.closest<HTMLElement>('[data-lot]');
  cancelDrag();
  if (!ended.active) return;
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 250);
  try {
    if (!target) {
      render();
      return;
    }
    const id = Number(target.dataset.lot);
    if (ended.type === 'counter') {
      if (!state.pending.includes(id)) toast('Place your stool on one of the glowing addresses.');
      else if (chosen.includes(id)) toast('You already placed a stool here.');
      else clickLot(id);
    } else if (canPlace(state, 0, id, ended.index)) buildPiece(id, ended.index);
    else {
      toast('That shop needs one of your empty addresses.');
      render();
    }
  } catch (error) {
    toast(errorMessage(error));
    render();
  }
});
document.addEventListener('pointercancel', () => {
  if (drag?.active) {
    cancelDrag();
    render();
  } else cancelDrag();
});
window.addEventListener('blur', () => {
  if (drag) {
    cancelDrag();
    render();
  }
});
window.addEventListener('resize', fitMap);
let keyboardNavigation = false;
document.addEventListener(
  'keydown',
  () => {
    keyboardNavigation = true;
  },
  { capture: true },
);
document.addEventListener(
  'pointerdown',
  (e) => {
    keyboardNavigation = false;
    lastInputType = e.pointerType;
  },
  { capture: true, passive: true },
);
document.addEventListener('focusin', (e) => {
  const lot = eventElement(e)?.closest<HTMLElement>('[data-lot]'),
    vp = $('.map-viewport');
  if (!keyboardNavigation || !lot || !vp?.contains(lot)) return;
  requestAnimationFrame(() => {
    if (!lot.isConnected || document.activeElement !== lot) return;
    vp.scrollLeft = 0;
    vp.scrollTop = 0;
    focusLot(Number(lot.dataset.lot));
  });
});
document.addEventListener('keydown', (e) => {
  if (get('#modal').open || menuOpen) return;
  if (e.key === 'Escape') {
    dismissPhase();
    cancelDrag();
    selectedShop = null;
    selectedLot = null;
    render();
  }
  const vp = $('.map-viewport');
  if (!vp || !vp.contains(eventElement(e)) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (['+', '=', '-', '0'].includes(e.key)) {
    e.preventDefault();
    if (drag || mapInput.blocksClick) return;
    if (!camera) fitMap();
    if (!camera) return;
    $('.game-world')
      ?.getAnimations()
      .forEach((a) => a.cancel());
    const w = vp.clientWidth,
      h = vp.clientHeight;
    applyMapCamera(
      e.key === '0'
        ? cameraFor(w, h, { x: 550, y: 365 }, null, desktopMap() ? 'contain' : 'cover')
        : wheelCamera(w, h, camera, { x: w / 2, y: h / 2 }, e.key === '-' ? 100 : -100),
    );
  } else if (
    e.target === vp &&
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
  ) {
    e.preventDefault();
    cameraCenter = dragCamera(
      camera ?? cameraFor(vp.clientWidth, vp.clientHeight),
      e.key === 'ArrowLeft' ? 45 : e.key === 'ArrowRight' ? -45 : 0,
      e.key === 'ArrowUp' ? 45 : e.key === 'ArrowDown' ? -45 : 0,
    );
    fitMap();
  }
});

function sizeOverlays() {
  const vv = window.visualViewport,
    height = vv?.height || window.innerHeight;
  document.documentElement.style.setProperty('--available-height', height + 'px');
  document.documentElement.style.setProperty(
    '--dialog-center',
    (vv?.offsetTop || 0) + height / 2 + 'px',
  );
}
window.visualViewport?.addEventListener('resize', sizeOverlays);
window.visualViewport?.addEventListener('scroll', sizeOverlays);
window.addEventListener('resize', sizeOverlays);
sizeOverlays();

document.addEventListener('change', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.matches('[data-bargain-cash]'))
    trading.cashChanged(e.target);
});
document.addEventListener('input', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.matches('[data-bargain-cash]'))
    trading.cashChanged(e.target, false);
});
get('#modal').addEventListener('cancel', () => trading.dismiss());
get('#modal').addEventListener('close', () => {
  if (!get('#modal').open) trading.cancel();
});
get('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal')) {
    const r = get('#modal').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      closeModal();
  }
});
for (const event of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
  document.addEventListener(
    event,
    (e) => {
      if (event === 'pointerdown' && e instanceof PointerEvent && e.pointerType !== 'mouse') return;
      const s = gameAudio.getSettings();
      if (s.sfx || s.music) void gameAudio.unlock();
    },
    { capture: true, passive: true },
  );
installMobileGuards();
get('#phase-cue').addEventListener('pointerenter', () => clearTimeout(phaseTimer));
get('#phase-cue').addEventListener('focusin', () => clearTimeout(phaseTimer));
get('#phase-cue').addEventListener('pointerleave', () => {
  if (get('#phase-cue').classList.contains('show')) phaseTimer = setTimeout(dismissPhase, 4500);
});
state.logs = state.logs.map((l) => l.replaceAll('million ₫', 'đ').replaceAll('M₫', 'đ'));
render();
save();
void warmAssets();
if (layoutUpdated && state.lots.some((l) => l.owner !== null))
  setTimeout(
    () =>
      toast(
        tr(
          'The map has new corners. Your addresses and cash are kept; businesses connect along the new shared edges.',
          'Bản đồ có góc phố mới. Địa chỉ và tiền được giữ; các cụm tiệm nối theo cạnh chung mới.',
        ),
      ),
    700,
  );
registerGameTools({
  getState: () => state,
  claim: (ids) => {
    claimPlots(state, ids);
    chosen = [];
    changed();
  },
  startBuild: () => {
    beginBuild(state);
    selectedShop = null;
    selectedLot = null;
    changed();
  },
  buildPiece,
  act,
  changed,
  playSound,
  speak: gameAudio.speak,
});

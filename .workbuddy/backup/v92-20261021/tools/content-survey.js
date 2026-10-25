const path = require('path');
global.window = global;
global.location = { search: '', href: 'x' };
global.innerWidth = 1440; global.innerHeight = 900;
global.navigator = { userAgent: 'node' };
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 0; global.setInterval = () => 0; global.clearInterval = () => {};
global.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
function makeEl() {
  return { tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, dataset: {}, style: {}, _attrs: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, addEventListener() {}, appendChild() {},
    setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k] || null; },
    querySelector() { return makeEl(); }, querySelectorAll() { return []; },
    getContext() { const n = () => {}; return new Proxy({ measureText: () => ({ width: 10 }), createLinearGradient: () => ({ addColorStop: n }), createPattern: () => null, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }, { get(t, p) { return p in t ? t[p] : n; } }); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 540 }; } };
}
const cache = {};
global.document = { createElement: makeEl, querySelector: s => (cache[s] = cache[s] || makeEl()), querySelectorAll: () => [],
  getElementById: id => (cache['#' + id] = cache['#' + id] || makeEl()), addEventListener() {}, readyState: 'complete' };
require('../js/bundle.js');
const G = window.GAME, D = G.DATA;
console.log('BUILDINGS', Object.keys(D.BUILDINGS).length, 'EXT', D.EXT_BUILD_ORDER.length);
console.log('TECH', Object.keys(D.TECH).length, 'TROOPS', Object.keys(D.TROOPS).length, 'EQUIP', Object.keys(D.EQUIP).length);
console.log('WONDER', Object.keys(D.WONDER || {}).length, 'WONDERS', (D.WONDERS || []).length, 'SHIP_BP', D.BLUEPRINTS.length);
console.log('BONDS', D.BONDS.length, 'BEAUTIES', D.BEAUTIES.length, 'ENCOUNTERS', D.ENCOUNTERS.length, 'ARTIFACTS', D.ARTIFACTS.length);
console.log('GATHER', Object.keys(D.GATHER).length, 'STORY', Object.keys(D.STORY || {}).length);
const st = G.newGame({ name: '测评', cityName: '灰岗', mapSeed: 20261016 });
console.log('开局 城', st.cities.length, '英雄', st.generals.length, '野地', (st.wilds || []).length, '据点', (st.forts || []).length);
console.log('开局资源', JSON.stringify(st.res));
console.log('开局建筑', Object.keys(st.cities[0].bldg || {}).length);
console.log('存档体积', (Buffer.byteLength(JSON.stringify(st), 'utf8') / 1024).toFixed(1) + 'KB');

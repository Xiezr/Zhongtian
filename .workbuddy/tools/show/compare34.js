/* v34 风格对比：同一批元素，四种画风 —— 现状(西方奇幻金属) / 中国色木刻 / MingCute / IconPark */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const BASE = 'C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules/@iconify-json';
const load = p => JSON.parse(fs.readFileSync(path.join(BASE, p, 'icons.json'), 'utf8'));
const GI = load('game-icons'), MC = load('mingcute'), IP = load('icon-park');
let cid = 0;

/* 中国色（朱红/赭石/靛青/墨/金/米黄/竹青） */
const CN = {
  red: ['#e05a44', '#b02a22', '#6b120d'],
  ochre: ['#d9a05a', '#a8642a', '#5c3616'],
  ink: ['#5a6472', '#333b46', '#161a20'],
  gold: ['#f2d888', '#c89a2a', '#75520e'],
  jade: ['#8fd0a8', '#3f8f68', '#1a4c36'],
  paper: ['#f0e2c4', '#c8ae82', '#7a6440'],
  indigo: ['#7a9ec0', '#3f6688', '#1c3550'],
};

/* 在库里模糊找一个 key */
function find(lib, cands) {
  const ks = Object.keys(lib.icons).filter(k => !lib.icons[k].hidden);
  for (const c of cands) {
    const exact = ks.find(k => k === c);
    if (exact) return exact;
  }
  for (const c of cands) {
    const hit = ks.find(k => k.indexOf(c) >= 0);
    if (hit) return hit;
  }
  return null;
}

/* A. game-icons + 金属浮雕（现状） */
function giMetal(key, tone) {
  const d = GI.icons[key]; if (!d) return null;
  const t = CN[tone] || CN.ink, uid = 'm' + (cid++);
  const body = (d.body || '').replace(/fill="currentColor"/g, 'fill="url(#' + uid + ')"');
  return '<defs><linearGradient id="' + uid + '" x1=".14" y1="0" x2=".84" y2="1">'
    + '<stop offset="0" stop-color="' + t[0] + '"/><stop offset=".44" stop-color="' + t[1] + '"/>'
    + '<stop offset="1" stop-color="' + t[2] + '"/></linearGradient></defs>'
    + '<g filter="url(#emb)"><g transform="scale(.125)">' + body + '</g></g>';
}

/* B. game-icons + 中国色木刻：平涂 + 深墨描边 + 纸色，去掉金属高光 */
function giWoodcut(key, tone) {
  const d = GI.icons[key]; if (!d) return null;
  const t = CN[tone] || CN.ink, uid = 'w' + (cid++);
  /* 主色平涂 + 上部略亮的双色渐变（模拟墨色浓淡，不做金属高光） */
  const body = (d.body || '').replace(/fill="currentColor"/g, 'fill="url(#' + uid + ')"');
  return '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="' + t[0] + '"/><stop offset="1" stop-color="' + t[1] + '"/></linearGradient></defs>'
    + '<g transform="scale(.125)">'
    + body.replace(/fill="url\(#[^)]*\)"/g, 'fill="url(#' + uid + ')"')
      .replace(/<path /g, '<path stroke="#241a12" stroke-width="14" stroke-linejoin="round" ')
    + '</g>';
}

/* C/D. 线条图标库（MingCute / IconPark）：粗描边 + 中国色 */
function lined(lib, key, tone, scale) {
  const d = lib.icons[key]; if (!d) return null;
  const t = CN[tone] || CN.ink;
  const w = d.width || lib.width;
  let body = d.body || '';
  /* 线条图标：把 stroke/fill 统一换成中国色描边 */
  body = body.replace(/currentColor/g, t[1]);
  return '<g transform="scale(' + (64 / w * (scale || 1)) + ')" stroke="' + t[1] + '" fill="none"'
    + ' stroke-width="' + (w * 0.055) + '" stroke-linecap="round" stroke-linejoin="round">'
    + body + '</g>';
}

const ROWS = [
  ['官府', 'palace', ['pagoda', 'indian-palace'], ['palace', 'government'], ['palace', 'court'], 'gold'],
  ['兵营', 'military', ['medieval-barracks', 'barracks'], ['tent', 'camp'], ['tent', 'camp'], 'ink'],
  ['铁匠铺', 'forge', ['anvil', 'blacksmith'], ['hammer'], ['anvil', 'hammer'], 'ink'],
  ['仓库', 'store', ['warehouse', 'cargo-crate'], ['box', 'storage'], ['box', 'storage'], 'ochre'],
  ['书院', 'school', ['bookshelf', 'book-pile'], ['book', 'school'], ['book', 'school'], 'paper'],
  ['市场', 'market', ['shop', 'shopping-bag'], ['shop', 'store'], ['market', 'shop'], 'gold'],
  ['农田', 'farm', ['wheat', 'plow'], ['grass', 'plant'], ['rice', 'plant'], 'ochre'],
  ['林地', 'tree', ['pine-tree', 'forest'], ['tree'], ['tree', 'pine'], 'jade'],
  ['山地', 'mine', ['mountains', 'stone-tower'], ['mountain'], ['mountain'], 'ink'],
  ['湖泊', 'water', ['water-splash', 'wave'], ['water', 'drop'], ['water', 'drop'], 'indigo'],
  ['粮', 'grain', ['wheat', 'granary'], ['bowl'], ['rice', 'bowl'], 'gold'],
  ['木', 'wood', ['log', 'wood-pile'], ['tree'], ['log'], 'ochre'],
  ['铁', 'iron', ['metal-bar', 'ore'], ['ore'], ['iron', 'metal'], 'ink'],
  ['金', 'gold', ['coins-pile', 'two-coins'], ['coin'], ['coin', 'money'], 'gold'],
  ['人口', 'pop', ['farmer', 'person'], ['user'], ['people', 'person'], 'paper'],
  ['剑', 'sword', ['broadsword', 'ancient-sword'], ['sword', 'knife'], ['sword', 'blade'], 'ink'],
  ['长枪', 'spear', ['pikeman', 'barbed-spear'], ['lance'], ['lance', 'pike'], 'ink'],
  ['弓弩', 'bow', ['archer', 'bow-arrow'], ['bow', 'arrow'], ['bow', 'arrow'], 'ochre'],
  ['铠甲', 'armor', ['chest-armor', 'armor-vest'], ['vest'], ['vest', 'chest'], 'ink'],
  ['头盔', 'helmet', ['crested-helmet', 'barbute'], ['hat', 'cap'], ['helmet', 'crown'], 'ink'],
  ['旗帜', 'flag', ['black-flag', 'flag-objective'], ['flag'], ['flag', 'banner'], 'red'],
  ['战鼓', 'drum', ['drum', 'war-drum'], ['drum'], ['drum'], 'red'],
  ['丹药', 'potion', ['round-potion', 'fizzing-flask'], ['bottle', 'flask'], ['medicine', 'pill'], 'jade'],
  ['玉石', 'jade', ['gem-chain', 'mineral-pearls'], ['gem', 'crystal'], ['gem', 'pearl'], 'jade'],
  ['卷轴', 'scroll', ['scroll-quill', 'scroll-unfurled'], ['scroll', 'paper'], ['paper', 'document'], 'paper'],
  ['印章', 'seal', ['seal', 'stamp'], ['seal'], ['seal', 'stamp'], 'red'],
  ['灯笼', 'lantern', ['asian-lantern', 'lantern'], ['lantern', 'lamp'], ['lamp'], 'red'],
];

let rows = '';
ROWS.forEach(r => {
  const giK = find(GI, r[2]), mcK = find(MC, r[3]), ipK = find(IP, r[4]);
  function box(html) {
    return '<td><div class="cell">' + (html ? '<svg viewBox="0 0 64 64">' + html + '</svg>' : '<span class="miss">无</span>') + '</div></td>';
  }
  rows += '<tr><td class="lbl">' + r[0] + '</td>'
    + box(giK && giMetal(giK, r[5]))
    + box(giK && giWoodcut(giK, r[5]))
    + box(mcK && lined(MC, mcK, r[5], 0.86))
    + box(ipK && lined(IP, ipK, r[5], 1.0))
    + '<td class="key">' + (giK || '—') + '<br><span>' + (mcK || '—') + ' / ' + (ipK || '—') + '</span></td></tr>';
});

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{background:#14171d;color:#e8e2d4;font:13px "Microsoft YaHei",sans-serif;margin:0;padding:16px}
h1{font-size:15px;margin:0 0 4px;color:#e8c46a}
p.sub{margin:0 0 12px;color:#8b98ad;font-size:11.5px}
table{border-collapse:collapse}
td,th{border:1px solid #2b323d;padding:4px 8px;text-align:center;vertical-align:middle}
th{background:#222834;color:#9fb0c8;font-size:12px}
.lbl{text-align:right;color:#d8c8a8;white-space:nowrap;font-weight:600;font-size:12.5px;padding-right:12px}
.key{font-size:9.5px;color:#8a96a8;text-align:left;line-height:1.3;max-width:150px}
.key span{color:#5f6a7a}
.cell{width:74px;height:74px;display:flex;align-items:center;justify-content:center}
.cell svg{width:60px;height:60px;display:block}
.miss{color:#5d6570;font-size:10px}
</style></head><body>
<h1>图标画风对比 · 26 个元素 × 4 种处理</h1>
<p class="sub">① 现状：game-icons + 金属浮雕（西方奇幻感）  ② 改造：game-icons + 中国色木刻（平涂 + 墨线描边）
③ MingCute 国风线性（24×24 画布）  ④ IconPark（48×48 画布）</p>
<svg width="0" height="0"><defs>
<filter id="emb" x="-22%" y="-22%" width="144%" height="144%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" result="b"/>
  <feSpecularLighting in="b" surfaceScale="7" specularConstant="1.05" specularExponent="15" lighting-color="#fff" result="sp">
    <feDistantLight azimuth="235" elevation="58"/></feSpecularLighting>
  <feComposite in="sp" in2="SourceAlpha" operator="in" result="spc"/>
  <feComponentTransfer in="spc" result="sp2"><feFuncA type="linear" slope=".8"/></feComponentTransfer>
  <feDropShadow in="SourceGraphic" dx="0" dy="2.5" stdDeviation="2.2" flood-color="#000" flood-opacity=".65" result="bs"/>
  <feMerge><feMergeNode in="bs"/><feMergeNode in="sp2"/></feMerge>
</filter></defs></svg>
<table>
<tr><th>元素</th><th>① 现状 · 金属浮雕</th><th>② 中国色木刻</th><th>③ MingCute</th><th>④ IconPark</th><th>素材 key</th></tr>
${rows}
</table></body></html>`;

fs.writeFileSync('E:/Deepseekdb/.workbuddy/tmp/style.html', html, 'utf8');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 820, height: 1000 }, deviceScaleFactor: 2 });
  await p.goto('file:///E:/Deepseekdb/.workbuddy/tmp/style.html');
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/v34-style.png', fullPage: true });
  await b.close();
  console.log('SHOT_OK v34-style.png  行=' + ROWS.length);
})();

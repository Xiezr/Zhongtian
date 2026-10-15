/* 从 @iconify-json/game-icons 提取项目所需的 81 个图标，生成 js/gicons.js
 * 幂等：重复执行结果一致。
 */
const fs = require('fs'), path = require('path');
const SRC = 'C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules/@iconify-json/game-icons/icons.json';
const OUT = 'E:/Deepseekdb/js/gicons.js';
const GI = JSON.parse(fs.readFileSync(SRC, 'utf8')).icons;

/* ---- 映射表：group → id → [gameIconsKey, tone] ---- */
const MAP = {
  building: {
    guanfu: ['pagoda', 'red'], minfang: ['house', 'wood'], shuyuan: ['bookshelf', 'cloth'],
    junying: ['medieval-barracks', 'metal'], xiaochang: ['archery-target', 'wood'],
    shichang: ['shop', 'gold'], cangku: ['warehouse', 'wood'], chengqiang: ['brick-wall', 'stone'],
    yizhan: ['old-wagon', 'wood'], fenghuotai: ['watchtower', 'stone'], majiu: ['stable', 'wood'],
    kezhan: ['tavern-sign', 'wood'], zhaoxianguan: ['laurel-crown', 'gold'],
    honglusi: ['scroll-quill', 'cloth'], tiejiangpu: ['blacksmith', 'stone'],
    gongjiangzuofang: ['cog', 'metal'],
  },
  ext: {
    farm: ['wheat', 'gold'], forest: ['pine-tree', 'jade'],
    quarry: ['mining', 'stone'], mine: ['mining-helmet', 'metal'],
  },
  res: {
    grain: ['wheat', 'gold'], wood: ['log', 'wood'], stone: ['stone-pile', 'stone'],
    iron: ['ore', 'metal'], gold: ['coins-pile', 'gold'], pop: ['farmer', 'cloth'],
  },
  terrain: {
    plain: ['grass', 'jade'], caoyuan: ['grass', 'jade'], zhaoze: ['swamp', 'jade'],
    lake: ['water-splash', 'metal'], forest: ['pine-tree', 'jade'], desert: ['desert', 'gold'],
    hill: ['mountains', 'stone'], city: ['castle', 'red'],
  },
  troop: {
    minfu: ['farmer', 'cloth'], yibing: ['swordman', 'metal'], chihou: ['spy', 'cloth'],
    changqiang: ['pikeman', 'metal'], daodun: ['checked-shield', 'metal'],
    gongjian: ['archer', 'wood'], qingji: ['cavalry', 'wood'], tieji: ['mounted-knight', 'metal'],
    zhouche: ['boat-fishing', 'wood'], chuangnu: ['crossbow', 'wood'],
    chongche: ['siege-tower', 'wood'], toudan: ['slingshot', 'wood'],
    qingzhoubing: ['guards', 'metal'], tengjiabing: ['spiked-armor', 'jade'],
    tuqibing: ['mounted-knight', 'metal'], hubaoqi: ['tiger', 'red'],
    xiliangtieqi: ['cavalry', 'red'], nanjiangxiangbing: ['elephant', 'metal'],
  },
  mat: {
    iron: ['metal-bar'], wood: ['log'], leather: ['animal-hide'],
    sinew: ['barbed-coil'], jade: ['gem-chain'], silk: ['rolled-cloth'],
  },
  slot: {
    weapon: ['broadsword', 'metal'], head: ['crested-helmet', 'metal'],
    chest: ['chest-armor', 'metal'], shoulder: ['shoulder-armor', 'metal'],
    arm: ['gauntlet', 'metal'], waist: ['belt', 'cloth'], feet: ['boots', 'wood'],
    back: ['cape', 'cloth'], neck: ['gem-necklace', 'gold'], ring: ['diamond-ring', 'gold'],
    pendant: ['gem-pendant', 'jade'], mount: ['horse-head', 'wood'],
  },
  item: {
    jewel: ['gem-chain', 'jade'], blueprint: ['scroll-quill', 'cloth'],
    prod_buff: ['hand-saw', 'metal'], military_buff: ['drum', 'red'],
    boost: ['hourglass', 'gold'], exp: ['scroll-unfurled', 'gold'],
    stamina: ['round-potion', 'jade'], perm: ['gem-pendant', 'gold'],
    mount_buff: ['horse-head', 'wood'], attr_buff: ['scroll-quill', 'jade'],
    build_cost: ['book-cover', 'cloth'],
  },
};

/* ---- 校验：每个 key 必须存在 ---- */
const needed = new Set();
Object.keys(MAP).forEach(g => Object.keys(MAP[g]).forEach(id => needed.add(MAP[g][id][0])));
const missing = [...needed].filter(k => !GI[k]);
if (missing.length) { console.error('缺失: ' + missing.join(', ')); process.exit(1); }

/* ---- 24 阶材料调色（6 系 × 4 阶）---- */
const MAT_HUE = { iron: 212, wood: 26, leather: 20, sinew: 42, jade: 154, silk: 194 };
const MAT_SAT = { iron: 24, wood: 44, leather: 42, sinew: 34, jade: 40, silk: 28 };
const TIER_L = [[47, 31, 17], [55, 38, 21], [63, 45, 25], [73, 55, 32]];
const TIER_S = [0.86, 0.94, 1.02, 1.16];
function matTone(series, tier) {
  const h = MAT_HUE[series] || 30, s = (MAT_SAT[series] || 30) * (TIER_S[tier - 1] || 1);
  const L = TIER_L[tier - 1] || TIER_L[0];
  return 'hsl(' + h + ',' + Math.round(s) + '%,' + L[0] + ') hsl(' + h + ',' + Math.round(s) + '%,' + L[1] + '%) hsl(' + h + ',' + Math.round(s * 0.9) + '%,' + L[2] + '%)';
}

/* ---- 收集 body ---- */
const D = {};
[...needed].sort().forEach(k => { D[k] = (GI[k].body || '').replace(/\s+/g, ' ').trim(); });

const lines = [];
lines.push('/* ============================================================');
lines.push(' * js/gicons.js — game-icons 开源图标素材层（v32）');
lines.push(' * ------------------------------------------------------------');
lines.push(' * 素材来源：https://game-icons.net  （CC BY 3.0，Lorc / Delapouite / contributors）');
lines.push(' * 数据取自 npm 包 @iconify-json/game-icons（经国内镜像 registry.npmmirror.com 获取）。');
lines.push(' * 共 ' + needed.size + ' 个图标，由 .workbuddy/tmp/gen_gicons.js 自动提取 —— 请勿手改本文件。');
lines.push(' *');
lines.push(' * 渲染方式：原始剪影路径（fill="currentColor"）→ 换成按语义分配的斜向渐变，');
lines.push(' * 再套一层 SVG feSpecularLighting 光照滤镜（"光照浮雕"），得到金属/木石质感。');
lines.push(' * 渐变与滤镜定义由 defsHTML() 输出，页面只需注入一次（见 ui.ensureIconDefs）。');
lines.push(' * ============================================================ */');
lines.push('var GICONS = (function () {');
lines.push('  var D = {');
Object.keys(D).forEach(k => { lines.push('    ' + JSON.stringify(k) + ': ' + JSON.stringify(D[k]) + ','); });
lines.push('  };');
lines.push('');
lines.push('  /* 7 种语义色调 [高光, 中间调, 暗部] */');
lines.push('  var TONE = {');
lines.push("    metal: ['#f4f8fc', '#8ea6c0', '#33445c'],");
lines.push("    gold: ['#fff3b8', '#e6ba52', '#8a5f18'],");
lines.push("    wood: ['#e8b87e', '#a4713c', '#503014'],");
lines.push("    stone: ['#e6e2da', '#a8a299', '#54504a'],");
lines.push("    jade: ['#b6f0ce', '#4fae7c', '#125a3c'],");
lines.push("    cloth: ['#f8dfc4', '#c68e5c', '#6e421f'],");
lines.push("    red: ['#ff9d7c', '#c8422a', '#67150c'],");
lines.push('  };');
lines.push('  var TONE_IDS = [' + Object.keys({ metal: 1, gold: 1, wood: 1, stone: 1, jade: 1, cloth: 1, red: 1 }).map(k => "'" + k + "'").join(', ') + '];');
lines.push('');
lines.push('  /* 24 阶材料色（6 系 × 4 品阶），tier 越高越亮越饱和 */');
lines.push('  var MAT_TONE = {');
Object.keys(MAT_HUE).forEach(s => {
  const row = [1, 2, 3, 4].map(t => JSON.stringify([matTone(s, t)])).join(', ');
  lines.push("    " + s + ': [' + row + '],');
});
lines.push('  };');
lines.push('');
lines.push('  var MAP = ' + JSON.stringify(MAP, null, 2).split('\n').map((l, i) => i ? '  ' + l : l).join('\n') + ';');
lines.push('');
lines.push('  /* 页面级渐变 + 光照滤镜定义（只需输出一次） */');
lines.push('  function defsHTML() {');
lines.push("    var s = '<defs>';");
lines.push('    TONE_IDS.forEach(function (t) {');
lines.push('      var c = TONE[t];');
lines.push("      s += '<linearGradient id=\"giT-' + t + '\" x1=\"0.14\" y1=\"0\" x2=\"0.84\" y2=\"1\">'");
lines.push("        + '<stop offset=\"0\" stop-color=\"' + c[0] + '\"/>'");
lines.push("        + '<stop offset=\".44\" stop-color=\"' + c[1] + '\"/>'");
lines.push("        + '<stop offset=\"1\" stop-color=\"' + c[2] + '\"/></linearGradient>';");
lines.push('    });');
lines.push('    Object.keys(MAT_TONE).forEach(function (s0) {');
lines.push('      MAT_TONE[s0].forEach(function (c, i) {');
lines.push('        var p = c[0].split(\' \');');
lines.push("        s += '<linearGradient id=\"giM-' + s0 + (i + 1) + '\" x1=\"0.14\" y1=\"0\" x2=\"0.84\" y2=\"1\">'");
lines.push("          + '<stop offset=\"0\" stop-color=\"' + p[0] + '\"/>'");
lines.push("          + '<stop offset=\".44\" stop-color=\"' + p[1] + '\"/>'");
lines.push("          + '<stop offset=\"1\" stop-color=\"' + p[2] + '\"/></linearGradient>';");
lines.push('      });');
lines.push('    });');
lines.push("    s += '<filter id=\"giEmb\" x=\"-22%\" y=\"-22%\" width=\"144%\" height=\"144%\">'");
lines.push("      + '<feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"3.5\" result=\"b\"/>'");
lines.push("      + '<feSpecularLighting in=\"b\" surfaceScale=\"7\" specularConstant=\"1.05\" specularExponent=\"15\" lighting-color=\"#fff\" result=\"sp\">'");
lines.push("      +   '<feDistantLight azimuth=\"235\" elevation=\"58\"/>'");
lines.push("      + '</feSpecularLighting>'");
lines.push("      + '<feComposite in=\"sp\" in2=\"SourceAlpha\" operator=\"in\" result=\"spc\"/>'");
lines.push("      + '<feComponentTransfer in=\"spc\" result=\"sp2\"><feFuncA type=\"linear\" slope=\".8\"/></feComponentTransfer>'");
lines.push("      + '<feDropShadow in=\"SourceGraphic\" dx=\"0\" dy=\"2.5\" stdDeviation=\"2.2\" flood-color=\"#000\" flood-opacity=\".65\" result=\"bs\"/>'");
lines.push("      + '<feMerge><feMergeNode in=\"bs\"/><feMergeNode in=\"sp2\"/></feMerge>'");
lines.push("      + '</filter>';");
lines.push("    s += '</defs>';");
lines.push('    return s;');
lines.push('  }');
lines.push('');
lines.push('  /* ⚠ 坐标系：game-icons 原始画布是 512×512，而本项目 wrap() 输出的是');
lines.push('     <svg viewBox="0 0 64 64">。直接把 512 路径塞进去只会显示左上角 1/8（表现为');
lines.push('     "图标全没了"）。必须按 64/512 缩放后再交给 wrap()。 */');
lines.push('  var GI_VB = 512, GI_SCALE = 64 / GI_VB;');
lines.push('  function paint(body, fill) {');
lines.push("    return '<g filter=\"url(#giEmb)\"><g transform=\"scale(' + GI_SCALE + ')\">'");
lines.push("      + body.replace(/fill=\"currentColor\"/g, 'fill=\"' + fill + '\"')");
lines.push("      + '</g></g>';");
lines.push('  }');
lines.push('');
lines.push('  /* 取图：group + id → SVG 片段（未命中返回空串，交由上层回退手绘） */');
lines.push('  function draw(group, id) {');
lines.push('    var m = MAP[group]; if (!m) return \'\';');
lines.push('    var e = m[id]; if (!e) return \'\';');
lines.push('    var b = D[e[0]]; if (!b) return \'\';');
lines.push("    if (group === 'mat') return paint(b, 'url(#giM-' + id + '1)');");
lines.push('    var t = TONE[e[1]] ? e[1] : \'metal\';');
lines.push("    return paint(b, 'url(#giT-' + t + ')');");
lines.push('  }');
lines.push('');
lines.push('  /* 材料专用：按系列 + 品阶取渐变 */');
lines.push('  function matDraw(series, tier) {');
lines.push('    var e = MAP.mat[series]; if (!e) return \'\';');
lines.push('    var b = D[e[0]]; if (!b) return \'\';');
lines.push("    var k = 'giM-' + series + (tier >= 1 && tier <= 4 ? tier : 1);");
lines.push("    return paint(b, 'url(#' + k + ')');");
lines.push('  }');
lines.push('');
lines.push('  return {');
lines.push('    D: D, TONE: TONE, MAT_TONE: MAT_TONE, MAP: MAP,');
lines.push('    defsHTML: defsHTML, draw: draw, matDraw: matDraw,');
lines.push('    has: function (k) { return !!D[k]; },');
lines.push('    count: ' + needed.size + ',');
lines.push('    credit: \'game-icons.net · CC BY 3.0\',');
lines.push('  };');
lines.push('})();');
lines.push('');
lines.push('/* v36：CommonJS 桥接 —— smoke 用 require 加载，裸 var 不可见 */');
lines.push("if (typeof window !== 'undefined') window.GICONS = GICONS;");
lines.push('');
lines.push('/* 页面加载时自动注入渐变与光照滤镜定义（只注入一次）。');
lines.push('   测试环境的简化 DOM 可能缺 API，静默忽略即可。 */');
lines.push('(function () {');
lines.push('  try {');
lines.push("    if (typeof document === 'undefined' || !document.body) return;");
lines.push("    var host = document.getElementById('giDefs');");
lines.push('    if (!host) {');
lines.push("      host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');");
lines.push("      host.setAttribute('id', 'giDefs');");
lines.push("      host.setAttribute('width', '0'); host.setAttribute('height', '0');");
lines.push("      host.setAttribute('aria-hidden', 'true');");
lines.push("      host.style.position = 'absolute'; host.style.left = '-9999px';");
lines.push('      document.body.appendChild(host);');
lines.push('    }');
lines.push('    if (!host.firstChild) host.innerHTML = GICONS.defsHTML();');
lines.push('  } catch (e) { /* 测试桩无 DOM 能力时忽略 */ }');
lines.push('})();');
lines.push('');

fs.writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('生成 ' + OUT + '  图标数=' + needed.size + '  字节=' + fs.statSync(OUT).size);

/* ---- 署名文件 ---- */
const cred = [
  '# 图标素材署名（game-icons.net）', '',
  '本项目 `js/gicons.js` 中的图标矢量路径来自 **game-icons.net**，',
  '经 npm 包 `@iconify-json/game-icons` 提取（国内镜像 registry.npmmirror.com）。', '',
  '- 许可：**CC BY 3.0**（https://creativecommons.org/licenses/by/3.0/）',
  '- 作者：Lorc、Delapouite 及 game-icons.net 贡献者',
  '- 站点：https://game-icons.net',
  '- 用量：本作共使用 ' + needed.size + ' 个图标', '',
  'CC BY 3.0 允许免费商用与修改，**要求保留署名**。本文件即为署名声明，请随作品一并保留。',
  '', '## 使用清单', '',
  '| 分组 | 元素 | game-icons key |', '|---|---|---|',
].join('\n');
const rows = [];
Object.keys(MAP).forEach(g => Object.keys(MAP[g]).forEach(id => rows.push('| ' + g + ' | ' + id + ' | `' + MAP[g][id][0] + '` |')));
fs.writeFileSync('E:/Deepseekdb/docs/game-icons-CREDITS.md', cred + '\n' + rows.join('\n') + '\n', 'utf8');
console.log('生成署名文件 docs/game-icons-CREDITS.md');

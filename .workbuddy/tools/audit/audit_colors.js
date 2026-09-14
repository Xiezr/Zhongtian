/* 配色审计：把 index.html 里 4 套主题的关键变量解析出来，
   算 HSL 与 WCAG 对比度，按"深色模式设计规范"给判据打分。
   判据来源（多家设计系统共识）：
     · 背景不用纯黑，用深灰蓝（#0f172a / #121212 / #1e293b）
     · 层级靠亮度递进：背景 < 卡片 < 浮层
     · 正文对比度目标 7:1（AAA），最低 4.5:1
     · 大面积背景饱和度不宜过高（>25% 久看疲劳）
     · 强调色在深色下应降饱和 20~40% 并提亮 */
const fs = require('fs');
const html = fs.readFileSync('E:/Deepseekdb/index.html', 'utf8');

function hex2rgb(h) {
  h = h.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lum(rgb) {
  const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(a, b) {
  const l1 = lum(hex2rgb(a)), l2 = lum(hex2rgb(b));
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function hsl(h) {
  const [r0, g0, b0] = hex2rgb(h).map(v => v / 255);
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
  const l = (mx + mn) / 2, d = mx - mn;
  let s = 0, hue = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r0) hue = ((g0 - b0) / d + (g0 < b0 ? 6 : 0));
    else if (mx === g0) hue = (b0 - r0) / d + 2;
    else hue = (r0 - g0) / d + 4;
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/* 解析。:root 是一套（默认"墨蓝"），其余按 data-theme 块 */
function grab(re) {
  const m = html.match(re);
  if (!m) return null;
  const o = {};
  const re2 = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let x;
  while ((x = re2.exec(m[0]))) o[x[1]] = x[2];
  return o;
}
const themes = [];
const root = grab(/:root\s*\{[\s\S]*?\n\s*\}/);
if (root) themes.push(['墨蓝（默认）', root]);
['silk', 'bamboo', 'night'].forEach(t => {
  const b = grab(new RegExp('html\\[data-theme="' + t + '"\\]\\s*\\{[\\s\\S]*?\\n\\s*\\}'));
  if (b) themes.push([t, b]);
});

const KEYS = ['bg-dark', 'panel-bg', 'surface-2', 'surface-3', 'text', 'text-dim', 'text-strong', 'gold', 'green-ok', 'red', 'blue-info'];
const PAIRS = [
  ['text', 'panel-bg', 4.5, '正文/面板'],
  ['text', 'bg-dark', 4.5, '正文/底色'],
  ['text-dim', 'panel-bg', 4.5, '次文/面板'],
  ['text-strong', 'panel-bg', 4.5, '强调文/面板'],
  ['gold', 'panel-bg', 3.0, '金/面板'],
];
const NAME = { '墨蓝（默认）': '默认', silk: '素绢', bamboo: '青竹', night: '夜阑' };

themes.forEach(([name, T]) => {
  console.log('\n══════ ' + name + ' ══════');
  console.log('变量'.padEnd(12) + '色值'.padEnd(11) + 'H'.padStart(4) + 'S'.padStart(4) + 'L'.padStart(4) + '   说明');
  KEYS.forEach(k => {
    if (!T[k]) return;
    const c = hsl(T[k]);
    let note = '';
    if (/^bg|^panel|^surface/.test(k)) {
      /* 判据用**色差绝对值**（max-min）而不是 HSL 饱和度：
         接近白色时（L>90）微小 RGB 差会算出很高的 HSL 饱和度，
         例如 #fbfaf6 (251,250,246) 的 S 是 38%，但它看起来就是白。
         色差 ≤18 即"大面上不觉得偏色"。 */
      const rgb = hex2rgb(T[k]);
      const chroma = Math.max.apply(null, rgb) - Math.min.apply(null, rgb);
      if (chroma > 18) note = '⚠ 大面积偏色重（色差 ' + chroma + ' > 18）';
      if (c.l > 20 && c.l < 80) note += ' ⚠ 中间亮度 ' + c.l + '%（既非浅也非深，易显脏）';
      if (c.l <= 6) note += ' ⚠ 接近纯黑（halation/OLED smear）';
    }
    console.log(k.padEnd(12) + T[k].padEnd(11) + String(c.h).padStart(4) + String(c.s).padStart(4) + String(c.l).padStart(4) + '   ' + note);
  });
  console.log('  对比度检查：');
  PAIRS.forEach(([a, b, min, label]) => {
    if (!T[a] || !T[b]) return;
    const r = contrast(T[a], T[b]);
    let verdict = r >= 7 ? 'AAA ✓' : (r >= min ? 'AA ✓' : '✗ 不足');
    if (a === 'gold') verdict = r >= min ? '✓' : '✗ 不足';
    console.log('    ' + label.padEnd(14) + r.toFixed(2) + ':1   ' + verdict);
  });
  /* 层级亮度跨度 */
  const ls = ['bg-dark', 'panel-bg', 'surface-2'].map(k => T[k] ? hsl(T[k]).l : null).filter(v => v !== null);
  if (ls.length === 3) {
    console.log('  层级亮度：' + ls.join(' → ') + (ls[0] < ls[1] && ls[1] <= ls[2] ? '  ✓ 递进' : '  ⚠ 非单调递进'));
  }
});

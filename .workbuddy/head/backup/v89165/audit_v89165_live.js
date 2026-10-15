/* v89.165 清点器（递归版）：**实时读秒类弹窗** —— 含硬时序特征（进度条/读秒/attr）
   的弹窗 × 是否接入 live / 等价刷新机制。
   用法：node .workbuddy/tools/audit/audit_v89165_live.js
   判据：硬特征 = 真调用 durExact( / progressOf / class="pbar"|"qbar" / data-*-progress|bar|left
        （"剩余/倒计时"等**文案词**不算 —— v89.165 首版把说明文字全误报过一遍）。
   扫描深度 = 弹窗函数 → 子函数 → 孙函数（BFS 3 层；首版只扫 1 层 → 漏了 openBattleList）。
   只读，不改产品。 */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var ui = fs.readFileSync(path.join(R, 'js', 'ui.js'), 'utf8');

/* ---- 函数体抽取（括号配平） ---- */
var BODY = {};
(function build() {
  var re = /ui\.([A-Za-z0-9_]+) = function/g, m;
  while ((m = re.exec(ui)) !== null) {
    var name = m[1];
    if (BODY[name]) continue;
    var j = ui.indexOf('{', m.index + m[0].length);   /* ⚠️ RegExpExecArray 没有 .end —— 用 index+len */
    if (j < 0) continue;
    var depth = 0;
    for (var k = j; k < ui.length; k++) {
      var ch = ui[k];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { BODY[name] = ui.slice(j, k + 1); break; } }
    }
  }
})();

/* ---- 硬时序特征（真调用/真 attr；不收"剩余/倒计时"这类文案词） ---- */
var HARD = [
  ['progressOf', /GAME\.march\.progressOf/],
  ['durExact(真调用)', /durExact\(/],
  ['pbar/qbar 条', /class="(pbar|qbar)"/],
  ['进度 attr', /data-(build|ext|modal)-(progress|bar)|data-farm-(left|bar)|data-build-bar/],
];
/* 基础设施（被所有弹窗调用的公共宿主）——递归时不进入，否则特征会传染给全部弹窗 */
var EXCLUDE = {
  openModal: '统一入口（含 live 机制本体）', openShell: '通用壳（转发 openModal）',
  closeModal: '关闭出口', closeAllModals: '全关出口', modalShell: '壳渲染',
  liveModalTick: 'live 机制本体', updateProgress: 'attr 细粒度刷新本体',
  renderView: '视图分发', renderSide: '侧栏渲染', toast: '轻提示',
};
function hardFeatsIn(body, depth, seen) {
  var out = [];
  HARD.forEach(function (f) { if (f[1].test(body) && out.indexOf(f[0]) < 0) out.push(f[0]); });
  if (depth > 0) {
    var re = /ui\.([A-Za-z0-9_]+)\(/g, m;
    while ((m = re.exec(body)) !== null) {
      var cn = m[1];
      if (seen[cn] || !BODY[cn] || EXCLUDE[cn]) continue;
      seen[cn] = 1;
      hardFeatsIn(BODY[cn], depth - 1, seen).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    }
  }
  return out;
}
/* live 判定：**递归沿调用链**（openTroops → openPanel 的 live 算已覆盖）；
   识别三种写法：`live: function` / `live: ui.x` / `o165.live = function`。 */
function hasLive(body, depth, seen) {
  if (/live\s*[:=]\s*function|live\s*[:=]\s*ui\./.test(body)) return true;
  if (depth <= 0) return false;
  var re = /ui\.([A-Za-z0-9_]+)\(/g, m, found = false;
  while ((m = re.exec(body)) !== null) {
    var cn = m[1];
    if (seen[cn] || !BODY[cn] || EXCLUDE[cn]) continue;
    seen[cn] = 1;
    if (hasLive(BODY[cn], depth - 1, seen)) { found = true; break; }
  }
  return found;
}

/* ---- 豁免表（每条写清"等价刷新机制"；空 = 无豁免） ---- */
var EXEMPT = {
  openExtModal: '施工进度走 data-modal-progress + data-build-bar（updateProgress 每秒原地刷）',
  openFarm: '种田 attr（data-farm-left / data-farm-bar）由 updateProgress 原地刷（成熟还会自动换收获键）',
  openExpModal: '出征面板的 durExact 是**出发前静态预估**（不随时间走），非读秒',
  openAutoMarch: '同上（amEstHTML = 自动出征的静态预估行）',
  openEquipPanel: 'equip 分支纯静态；特征来自 openPanel 的**其他分支**（troops/ext，运行时不会渲染）',
  openItemsPanel: '转发背包（纯静态）；特征来源同上',
  openBuildModal: '同上（且自身也有 live）',
};

var names = Object.keys(BODY).filter(function (n) { return /^open[A-Z]/.test(n); }).sort();
var withLive = [], suspects = [], plain = [];
names.forEach(function (n) {
  var body = BODY[n];
  var seen = {}; seen[n] = 1;
  var feats = hardFeatsIn(body, 3, seen);
  if (!feats.length) { plain.push(n); return; }
  var seenL = {}; seenL[n] = 1;
  if (hasLive(body, 3, seenL)) { withLive.push(n + '  ⟨' + feats.join(' · ') + ' ⟩'); return; }
  suspects.push({ n: n, feats: feats });
});

console.log('===== 实时读秒清点（v89.165 · 递归 3 层） =====\n');
console.log('— 已接 live（' + withLive.length + '）—');
withLive.forEach(function (x) { console.log('   ✅ ' + x); });
console.log('\n— 含硬时序特征但无 live（' + suspects.length + ' · 须逐条给豁免理由或修）—');
suspects.forEach(function (s) {
  var ex = EXEMPT[s.n];
  console.log('   ' + (ex ? '•' : '⛔') + ' ' + s.n + '  ⟨' + s.feats.join(' · ') + '⟩' + (ex ? '  → ' + ex : ''));
});
console.log('\n— 纯静态（无硬特征 · ' + plain.length + '，不列名）—');
var un = suspects.filter(function (s) { return !EXEMPT[s.n]; });
console.log('\n结论：漏网（无 live 且无豁免）= ' + un.length +
  (un.length ? ' → ' + un.map(function (s) { return s.n; }).join(', ') : ' ✓'));
process.exit(un.length ? 1 : 0);

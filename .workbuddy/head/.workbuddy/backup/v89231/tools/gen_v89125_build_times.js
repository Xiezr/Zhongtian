/* v89.125：生成 docs/v89125-建筑建造时间表.md
   数字全部从游戏数据直读（levelCost / extBuildCost / buildCapOf / DATA.*）——
   改数值后重跑本脚本即可刷新产物，勿手改。
   复跑：node .workbuddy/tools/gen/gen_v89125_build_times.js */
var R = 'E:/Deepseekdb/';
var fs = require('fs'), path = require('path');
eval(fs.readFileSync(path.join(R, '.workbuddy/tmp/smoke_env_head.js'), 'utf8'));
['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'icons',
  'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main']
  .forEach(function (f) { require(path.join(R, 'js', f + '.js')); });
var G = global.GAME, DATA = G.DATA, U = G.utils;

var TS = DATA.DEFAULT_SETTINGS.timeScale;   /* 120：1 现实秒 = 120 游戏秒 */
var FLOOR_SEC = 5;                          /* 最短 5 现实秒（= GAME.buildMinTime() = 5×timeScale 游戏秒） */

/* 基准游戏秒 → 约合现实（@默认倍率，含 5 秒地板；不含城主/科技/道具加成） */
function realText(sec) {
  var r = Math.max((sec || 0) / TS, FLOOR_SEC);
  if (r < 60) return (r < 10 ? r.toFixed(1) : String(Math.round(r))) + ' 秒';
  if (r < 3600) return (r / 60 >= 10 ? String(Math.round(r / 60)) : (r / 60).toFixed(1)) + ' 分';
  return (r / 3600 >= 10 ? String(Math.round(r / 3600)) : (r / 3600).toFixed(1)) + ' 时';
}
/* 总览用：游戏秒 → 游戏小时（自适应精度：<100 时 2/1 位小数，防小值显示成 0.0） */
function hrs(t) {
  var v = (t || 0) / 3600;
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}
/* 逐建筑表：升级 | 基准（游戏时间，U.dur 同款）| 约合现实 | 累计 */
function levelTable(getCost, fromLv, toLv) {
  var lines = ['| 升级 | 基准耗时（游戏时间） | 约合现实（@' + TS + '×） | 累计（游戏时间） |',
    '|---|---|---|---|'];
  var acc = 0;
  for (var lv = fromLv; lv < toLv; lv++) {
    var c = getCost(lv);
    var t = c ? (c.time || 0) : 0;
    acc += t;
    lines.push('| ' + lv + '→' + (lv + 1) + ' | ' + U.dur(t) + ' | ' + realText(t) + ' | ' + U.dur(acc) + ' |');
  }
  return lines;
}

var out = [];
out.push('# v89.125 建筑建造时间表（各级建筑 × 建造 / 升级耗时）');
out.push('');
out.push('> **本文件由脚本生成**：`node .workbuddy/tools/gen/gen_v89125_build_times.js`。');
out.push('> 数字全部从游戏数据（`levelCost` / `extBuildCost` / `buildCapOf`）直读 —— 改数值后重跑刷新，勿手改本文件。');
out.push('');
out.push('## 一、口径（先读这段）');
out.push('');
out.push('| 项 | 口径 |');
out.push('|---|---|');
out.push('| 时间单位 | **游戏秒**（游戏时间 = 现实时间 × 倍率，默认 120×；`U.dur` 同款显示） |');
out.push('| 实际耗时 | `max(基准 × 城建倍率, 最短 5 现实秒)` |');
out.push('| 城建倍率 | `1 / [(1 + 城主内政×1%（封顶 +150%）) × (1 + 建筑技术等级×5%)]`，最低约 0.32（−68%） |');
out.push('| 最短 5 现实秒 | `GAME.buildMinTime() = 5 × 倍率`（默认 120× → 600 游戏秒）—— 低档位（如校场 1→2、农田 1→2）会被它抬到 5 现实秒 |');
out.push('| 新建 Lv1 | 所有城内建筑与城外建筑统一 **60 游戏秒**基准（`buildCost` 不含时间字段时的兜底） |');
out.push('| 12 级后 | 资源封顶在「11→12」档（改需珠宝）；**时间走 12 级循环**（13-24 复用 1-12 的时长，25-36 再循环，v89.128） |');
out.push('| 加速手段 | 城主（内政）/ 建筑技术（书院科技，−5%/级，5 级）/ 鲁班残页·书册·全集（单项道具） |');
out.push('');
out.push('## 二、等级上限（`buildCapOf` 唯一出口）');
out.push('');
out.push('| 城池类型 | 建筑等级上限 | 主城 + 爵位满档（+21） |');
out.push('|---|---|---|');
var tiers = ['self', 'county', 'jun', 'zhou', 'capital'];
tiers.forEach(function (t) {
  var base = DATA.MAX_BLEVEL + (DATA.CITY_BUILD_BONUS[t] || 0);
  out.push('| ' + (DATA.CITY_TIER[t] || t) + ' ' + t + ' | ' + base + ' | ' + (base + DATA.RANK_BUILD_LIFT_MAX) + ' |');
});
out.push('');
out.push('- **主城**（玩家设定的一座城）额外享受「每 1 档爵位 +1 级」（封顶 +' + DATA.RANK_BUILD_LIFT_MAX + '）——`rankBuildCapOf` 非主城恒 0。');
out.push('- **城内建筑（除官府）** 另被「官府等级 + 爵位上限」卡：`cap = min(cap, 官府等级 + 爵位加成)`。');
out.push('- **城外建筑**（农田/伐木场/采石场/铁矿场）不受官府闸，直接随城池 / 爵位上限。');
out.push('- 全部等级表按 `MAX_LEVEL_ABS = ' + DATA.MAX_LEVEL_ABS + '`（12 基准 + 12 都城 + 21 爵位）一次性外推。');
out.push('');
out.push('## 三、城内建筑（' + Object.keys(DATA.BUILDINGS).length + ' 座，Lv1→Lv12）');
out.push('');

var names = Object.keys(DATA.BUILDINGS);
/* 总览（游戏小时，1 位小数） */
out.push('### 3.1 总览（单位：游戏小时）');
out.push('');
var head = '| 建筑 |';
var sep = '|---|';
for (var lv12 = 1; lv12 < 12; lv12++) { head += ' ' + lv12 + '→' + (lv12 + 1) + ' |'; sep += '---|'; }
head += ' 满 12 累计 |';
sep += '---|';
out.push(head);
out.push(sep);
names.forEach(function (k) {
  var b = DATA.BUILDINGS[k];
  var line = '| ' + b.name + ' |';
  var acc = 0;
  for (var lv = 1; lv < 12; lv++) {
    var c = b.levelCost ? b.levelCost(lv) : null;
    var t = c ? (c.time || 0) : 0;
    /* v89.128：时间列全部走 buildTimeSec 曲线（含城墙）——不需要任何特例兜底 */
    acc += t;
    line += ' ' + hrs(t) + ' |';
  }
  line += ' ' + hrs(acc) + ' |';
  out.push(line);
});
out.push('');
out.push('> 时间列走**建造时间曲线**（v89.128：12 级循环 × 各建筑区分度 × 单次 ≤24h，唯一出口 DATA.buildTimeSec）—— 见 §五 口径说明。');
out.push('');
out.push('### 3.2 逐建筑明细');
out.push('');
names.forEach(function (k) {
  var b = DATA.BUILDINGS[k];
  out.push('#### ' + b.name + '（`' + k + '`）');
  if (k === 'chengqiang') {
    out.push('');
    out.push('- v89.128：城墙以**环城一圈的结构**作为一个建筑（不占城内格）——与城内建筑同一套出口管理。');
    out.push('- 时间走**曲线**（同一出口 buildTimeSec）——城墙 T_max = **24h（全表顶格）**、独立**线性**形态（起 2h → 终 24h），12 级一循环。');
    out.push('- 环城视觉只在**修建后**绘制；点环城 = 城墙面板（未建 → 修建；已建 → 升级/拆除）。');
    out.push('- 城防技术减城墙资源成本（−5%/级，封顶 −60%），**不减时间**。');
    out.push('');
    return;
  }
  out.push('');
  out.push(levelTable(function (lv) { return b.levelCost(lv); }, 1, 12).join('\n'));
  out.push('');
});
out.push('## 四、城外建筑（4 座，建造 + Lv1→Lv12）');
out.push('');
DATA.EXT_BUILD_ORDER.forEach(function (eid) {
  var eb = DATA.EXT_BUILDINGS[eid];
  out.push('#### ' + eb.name + '（`' + eid + '`）');
  out.push('');
  var lines = ['| 建造/升级 | 基准耗时（游戏时间） | 约合现实（@' + TS + '×） | 累计（游戏时间） |',
    '|---|---|---|---|'];
  var acc = 0;
  for (var lv = 0; lv < 12; lv++) {
    var c = G.extBuildCost(eid, lv);
    var t = c ? (c.time || 0) : 0;
    acc += t;
    lines.push('| ' + (lv === 0 ? '建造 0→1' : lv + '→' + (lv + 1)) + ' | ' + U.dur(t) + ' | ' + realText(t) + ' | ' + U.dur(acc) + ' |');
  }
  out.push(lines.join('\n'));
  out.push('');
});
out.push('## 五、城墙（环城结构 · 不占格）');
out.push('');
out.push('- v89.128：城墙以**环城一圈的结构**作为一个建筑（地位与城内建筑同）——');
out.push('  不占城内地块；建造/升级/拆除走通用出口（`cellOf(city, \'wall\')` = 环城槽）。');
out.push('- v89.129（老板「结合现实里耗材，耗资，耗时的特点」）：**双料之王** ——');
out.push('  时间 = T_max 24h 顶格 + 独立**线性**曲线（其他建筑是 1.5 次幂）：现实城墙无"廉价期"，');
out.push('  起 2h/级均匀加固到 24h（单次 ≤24h · 12 级循环不变）；');
out.push('  资源 = 11→12 档 3,482 万（**全表之最**，超驿站 2,355 万）、石料占 66%（砖石工程主材）。');
out.push('- 环城视觉（isoWallSVG）只在**修建后**绘制；点环城 = 城墙面板。');
out.push('- 老档迁移：格子里的城墙 / wallLv → 环城槽（等级保留、格释放，消息流有提示）。');
out.push('');
out.push('## 六、复现');
out.push('');
out.push('```bash');
out.push('node .workbuddy/tools/gen/gen_v89125_build_times.js      # 重新生成本文件');
out.push('node .workbuddy/tools/probe/probe_v89125_build_time_migration.js   # 探针：城墙旧/新外推对照 + 移民令新语义');
out.push('node smoke-test.js | tail -3                            # §104/§108 口径守卫（曲线 · 循环 · ≤24h）');
out.push('```');
out.push('');

var dst = path.join(R, 'docs', 'v89125-建筑建造时间表.md');
fs.writeFileSync(dst, out.join('\n'), 'utf8');

/* 写后自检：非空 + 关键标题在位 */
var chk = fs.readFileSync(dst, 'utf8');
if (chk.length < 3000 || chk.indexOf('## 五、城墙') < 0 || chk.indexOf('逐建筑明细') < 0) {
  console.error('✗ 自检失败：产物异常（len=' + chk.length + '）');
  process.exit(1);
}
console.log('✓ 已生成 ' + dst);
console.log('  行长 ' + chk.split('\n').length + ' · 城内 ' + names.length + ' 座 · 城外 ' + DATA.EXT_BUILD_ORDER.length + ' 座');
process.exit(0);

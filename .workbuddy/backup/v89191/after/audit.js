/* ============================================================
 * audit.js —— 静态审计（逻辑层之外的结构性检查）
 *
 * 用途：抓「测试测不出来」的一类问题 ——
 *   ① 定义了但没人调用的函数（死代码 / 功能没接上）
 *   ② 界面上有按钮但后端没处理（点了没反应）
 *   ③ 数据里有效果字段但没有任何消费点（空承诺）
 *   ④ 同一声明存在两份（改 data 不生效的陷阱）
 *
 * 与两套测试的分工：
 *   smoke-test.js  逻辑正确性（917 项断言）
 *   e2e-test.js    真实 DOM 交互（321 项断言）
 *   audit.js       结构完整性（本文件）—— 建议每次改动后一并运行
 *
 * 用法：node audit.js            正常输出
 *       node audit.js --strict   有「孤儿按钮」或「新增死函数」时以非 0 退出
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const FS = require('fs');
const JSDIR = path.join(__dirname, 'js');
const MODULES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'icons', 'story', 'ui', 'main'];

const src = {};
MODULES.forEach(m => { src[m] = fs.readFileSync(path.join(JSDIR, m + '.js'), 'utf8'); });
const htmlSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const allJs = MODULES.map(m => src[m]).join('\n');
const all = allJs + '\n' + htmlSrc;

const STRICT = process.argv.indexOf('--strict') >= 0;
let problems = 0;

function head(title) { console.log('\n' + title); console.log('─'.repeat(Math.min(72, title.length + 4))); }

/* ─────────────────────────────────────────────
 * ①  死函数：命名空间函数定义 vs 引用
 * ───────────────────────────────────────────── */
head('① 函数引用完整性');
const defRe = /^\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.([A-Za-z_$][\w$]*)\s*=\s*function\s*\(/gm;
const defs = [];
MODULES.forEach(m => {
  let re = new RegExp(defRe.source, 'gm'), x;
  while ((x = re.exec(src[m])) !== null) defs.push({ file: m, ns: x[1], name: x[2], full: x[1] + '.' + x[2] });
});

/* 重复定义 */
const byFull = {};
defs.forEach(d => { (byFull[d.full] = byFull[d.full] || []).push(d.file); });
const dupDefs = Object.keys(byFull).filter(k => byFull[k].length > 1);
if (dupDefs.length) {
  console.log('  ⚠ 同名函数被多次定义（后定义会覆盖前者）：');
  dupDefs.forEach(k => { console.log('     ' + k + '  ←  ' + byFull[k].join(', ')); problems++; });
} else {
  console.log('  ✅ 无重复定义（' + defs.length + ' 个函数名唯一）');
}

/* 无引用 */
const testAll = fs.readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8')
  + fs.readFileSync(path.join(__dirname, 'e2e-test.js'), 'utf8');
/* 单字母命名空间（icons.js 内的图标表 B/E/T/W 等）由查表函数统一派发，
   静态看不到直接调用，属内部实现，不计入死代码 */
const localTable = d => /^[A-Z]$/.test(d.ns.split('.')[0]) || d.ns === 'ICON';

const dead = [], testOnly = [], internal = [];
defs.forEach(d => {
  const esc = d.name.replace(/\$/g, '\\$');
  const callRe = new RegExp('\\.' + esc + '\\s*[\\s(,;)\\]}]', 'g');
  const defLineRe = new RegExp('^\\s*' + d.full.replace(/\./g, '\\.').replace(/\$/g, '\\$') + '\\s*=\\s*function', 'gm');
  let self = 0;
  MODULES.forEach(m => { self += (src[m].match(defLineRe) || []).length; });
  const net = Math.max(0, (all.match(callRe) || []).length - self);
  const inTest = (testAll.match(callRe) || []).length > 0;
  /* 字符串引用：分发式调用（如 questMetric 的指标名、动作名） */
  const asString = new RegExp("['\"]" + esc + "['\"]").test(all) || new RegExp("['\"]" + esc + "['\"]").test(testAll);
  if (localTable(d)) internal.push(d);
  else if (net <= 0 && !asString) (inTest ? testOnly : dead).push(d);
});
console.log('  函数总数 ' + defs.length + ' · 有引用 ' + (defs.length - dead.length - testOnly.length - internal.length)
  + ' · 仅测试引用 ' + testOnly.length + ' · 无引用 ' + dead.length
  + ' · 内部图表 ' + internal.length);
if (dead.length) {
  console.log('  ⚠ 无任何引用的函数（死代码，或功能未接线）：');
  dead.forEach(d => console.log('     ' + d.full.padEnd(28) + '[' + d.file + '.js]'));
} else console.log('  ✅ 无死函数');
if (testOnly.length) {
  console.log('  · 仅测试引用（生产代码未用，可考虑收敛）：');
  testOnly.forEach(d => console.log('     ' + d.full.padEnd(28) + '[' + d.file + '.js]'));
}

/* ─────────────────────────────────────────────
 * ②  动作绑定：data-action ↔ main.js case
 * ───────────────────────────────────────────── */
head('② 按钮动作绑定');
const acts = new Set();
const attrUsed = {};   /* 属性名 → 是否在界面出现（data-view 映射到 case 'view'） */
const SCAN = htmlSrc + '\n' + MODULES.map(m => src[m]).join('\n');
['data-action', 'data-view', 'data-side', 'data-tab'].forEach(attr => {
  attrUsed[attr] = new RegExp(attr + '=').test(SCAN);
});
/* data-action 的值直接对应 case 名 */
{
  const re = /data-action=(?:\\?["'])([a-z0-9-]+)(?:\\?["'])/g;
  let x;
  while ((x = re.exec(SCAN)) !== null) acts.add(x[1]);
}
/* data-view / data-side 由 case 'view' / case 'side' 统一分发 */
if (attrUsed['data-view']) acts.add('view');
if (attrUsed['data-side']) acts.add('side');
if (attrUsed['data-tab']) acts.add('tab');
/* v40：扫 case 之前先剥离注释 —— 注释里提到 `case 'xxx'`（说明某分支已被删掉）
   会被当成一个真分支，于是永远报"不可达分支"。v39 的 smoke 也栽过同一个跟头：
   **静态检查一律先剥注释再看代码**。 */
const noComment = s => String(s)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
const cases = new Set();
{ const re = /case\s+'([a-z0-9-]+)'/g; let x;
  while ((x = re.exec(noComment(src.main))) !== null) cases.add(x[1]); }

const orphanBtn = [...acts].filter(a => !cases.has(a)).sort();
/* 反向：case 名是否作为字符串出现在界面代码里（模板拼接触发的动作） */
const orphanCase = [...cases].filter(a =>
  !acts.has(a) && !new RegExp("['\"]" + a + "['\"]").test(htmlSrc + src.ui)
).sort();
console.log('  data-action ' + acts.size + ' 个 · main.js case ' + cases.size + ' 个');
if (orphanBtn.length) {
  console.log('  ❌ 有按钮但无处理器（点了没反应）：');
  orphanBtn.forEach(a => console.log('     ' + a));
  problems += orphanBtn.length;
} else console.log('  ✅ 所有按钮都有处理器');
if (orphanCase.length) {
  console.log('  ⚠ 下列 case 在界面代码中查无触发点（不可达分支，建议清理）：');
  console.log('     ' + orphanCase.join(', '));
}

/* ─────────────────────────────────────────────
 * ③  科技效果消费点
 * ───────────────────────────────────────────── */
head('③ 科技效果消费点');
/* 先找出「科技取值包装函数」：形如  function TB(type){ return ...techBonus(type) }
   业务代码常会包一层做判空，直接用 techBonus('x') 字面量去搜会全部漏判。
   若再包一层（TB → techB → techBonus），递归两轮即可覆盖常见写法。 */
function findTechAccessors() {
  const names = new Set(['techBonus']);
  for (let pass = 0; pass < 1; pass++) {
    const snapshot = [...names];
    MODULES.forEach(m => {
      const re = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{[\s\S]{0,400}?\}/g;
      let x;
      while ((x = re.exec(src[m])) !== null) {
        const body = x[0];
        if (snapshot.some(n => new RegExp('\\b' + n + '\\s*\\(').test(body))) names.add(x[1]);
      }
    });
  }
  return [...names].filter(n => n !== 'techBonus');
}
const TECH_ACCESSORS = findTechAccessors();
const techBlock = src.data.match(/DATA\.TECH = \[([\s\S]*?)\n  \];/);
if (techBlock) {
  const techs = [];
  techBlock[1].split('\n').forEach(line => {
    const m = line.match(/id: '([a-z]+)', name: '([^']+)', lv: (\d+), type: '([a-z]+)'/);
    if (m) techs.push({ id: m[1], name: m[2], lv: +m[3], type: m[4] });
  });
  /* 通用路径：techMult 覆盖的资源四类（无独立读取点，由 techMult 统一遍历） */
  const GENERIC = ['grain', 'wood', 'stone', 'iron'];
  const alive = [], deadT = [];
  techs.forEach(t => {
    let ok = GENERIC.indexOf(t.type) >= 0;
    /* v89.191：读取点带城参（techB('store', city)）—— 闭合括号放宽为 `'[,)]`。 */
    const probes = ["techBonus\\('" + t.type + "'[,)]"]
      .concat(TECH_ACCESSORS.map(a => "\\b" + a + "\\('" + t.type + "'[,)]"))
      .concat(["techLevel\\('" + t.id + "'[,)]"]).concat(TECH_ACCESSORS.map(a => "\\b" + a + "\\('" + t.id + "'[,)]"));
    MODULES.forEach(m => {
      if (m === 'data') return;
      if (probes.some(p => new RegExp(p).test(src[m]))) ok = true;
    });
    (ok ? alive : deadT).push(t);
  });
  console.log('  科技 ' + techs.length + ' 项 · 有效果 ' + alive.length + ' · 无消费点 ' + deadT.length);
  if (TECH_ACCESSORS.length) console.log('  （已识别科技取值包装函数：' + TECH_ACCESSORS.join(', ') + '）');
  if (deadT.length) {
    console.log('  ⚠ 下列科技研究了但不产生任何效果（花费黄金却无收益）：');
    deadT.forEach(t => console.log('     ' + t.name.padEnd(8) + '[' + t.type.padEnd(9) + '] 需书院 Lv' + t.lv));
  } else console.log('  ✅ 全部科技均有消费点');
}

/* ─────────────────────────────────────────────
 * ④  叙事层修正值消费点（国策 / 天气 / 羁绊）
 * ───────────────────────────────────────────── */
head('④ 叙事层修正值消费点');
function consumed(name) {
  const re = new RegExp('\\.' + name + '\\s*\\(');
  const defLine = new RegExp('\\.' + name + '\\s*=\\s*function');
  let n = 0;
  MODULES.forEach(m => { const s = src[m].replace(defLine, ''); n += (s.match(re) || []).length; });
  return n;
}
const storyFns = ['prodMult', 'atkMult', 'defMult', 'siegeMult', 'researchMult',
  'leadMult', 'trainMult', 'cityDefMult', 'heartsPerHour', 'combatMod'];
const deadStory = storyFns.filter(f => consumed(f) === 0);
console.log('  STORY 修正函数 ' + storyFns.length + ' 个 · 无消费点 ' + deadStory.length);
if (deadStory.length) deadStory.forEach(f => console.log('     ⚠ STORY.' + f + '()'));
else console.log('  ✅ 全部有消费点');

/* 国策 boon 键 */
const boonKeys = [...new Set((src.data.match(/boon: \{[^}]*\}/g) || [])
  .flatMap(s => (s.match(/[a-z_]+: [0-9.]+/g) || []).map(x => x.split(':')[0])))].filter(k => k !== 'text');
const deadBoon = boonKeys.filter(k => !new RegExp("boon\\." + k).test(allJs) && !new RegExp("boon\\['" + k + "'\\]").test(allJs) && !new RegExp("'" + k + "'").test(allJs.replace(src.data, '')));
console.log('  国策 boon 键 ' + boonKeys.length + ' 个（' + boonKeys.join('/') + '）· 无消费 ' + deadBoon.length);
if (deadBoon.length) deadBoon.forEach(k => console.log('     ⚠ boon.' + k));

/* 天气字段 */
/* 天气字段：只看是否被「读取」，且要排除「重新打包」行。
   坑一：combatMod(){ return { fire: we.fire, ambush: we.ambush, ... } }
        这行看起来像消费（确实读了 we.fire），但它只是把字段换个壳，**下游没人用**。
        若不排除，天气 4 项空转会被判成"已消费"——工具给出假绿比报错更危险。
   坑二：业务代码常写 `var cmW = GAME.story.combatMod()`，再用 `cmW.fire`。
        硬编码 `cm.` 会漏判 → 用一次轻量数据流分析：先扫出所有「从
        combatMod()/currentWeather() 接值的变量名」，再据此匹配属性访问。 */
const weaKeys = ['archerRange', 'fire', 'ambush', 'scout', 'move', 'grain'];
/* 摘掉 story.js 里 combatMod 的函数体（那是生产端，不是消费端） */
const storyNoRepack = src.story.replace(/STORY\.combatMod = function[\s\S]*?\n  \};/, '/* combatMod body removed */');
const weaPool = { ...src, story: storyNoRepack };
/* 数据流：哪些变量承接了天气对象 */
const weatherVars = new Set();
Object.keys(weaPool).forEach(m => {
  const re = /\b([A-Za-z_$][\w$]*)\s*=\s*(?:[A-Za-z_$][\w$]*\.)*(?:combatMod|currentWeather)\s*\(\s*\)/g;
  let x; while ((x = re.exec(weaPool[m])) !== null) weatherVars.add(x[1]);
});
const readRe = k => [
  new RegExp('combatMod\\(\\)\\.' + k + '\\b'),
  new RegExp('\\b(?:' + [...weatherVars, 'cm', 'cmW', 'we', 'weather', 'WE'].join('|') + ')\\.' + k + '\\b'),
];
const deadWea = weaKeys.filter(k => !Object.keys(weaPool).some(m => readRe(k).some(re => re.test(weaPool[m]))));
console.log('  天气字段 ' + weaKeys.length + ' 个 · 无消费 ' + deadWea.length
  + (weatherVars.size ? '  （天气变量：' + [...weatherVars].join(',') + '）' : ''));
if (deadWea.length) deadWea.forEach(k => console.log('     ⚠ weather.' + k + '  （数据里声明了，战斗/生产里没人读）'));
else console.log('  ✅ 全部天气字段均有消费点');

/* ─────────────────────────────────────────────
 * ⑤  数据字段与逻辑双份 / 零引用字段
 * ───────────────────────────────────────────── */
head('⑤ 数据字段引用检查');
/* 语义：字段在 data.js 声明后，是否被**其它模块**读取。
   只出现在 data.js（或只出现在生产者文件里）即为「改它不生效」。 */
const watchFields = ['extraLand', 'wildCap', 'goldCap', 'techLv', 'marches', 'rep_gain', 'siegeEra'];
let zeroRef = 0;
watchFields.forEach(f => {
  const hits = MODULES.filter(m => new RegExp('\\b' + f + '\\b').test(src[m]));
  if (!hits.length) return;                    // 字段已彻底移除 → 无需检查
  const outside = hits.filter(m => m !== 'data');
  if (!outside.length) {
    console.log('  ⚠ ' + f.padEnd(12) + ' 仅 data.js 出现 → 改它不生效（逻辑在别处硬编码，或已废弃）');
    zeroRef++;
  } else if (outside.length === 1) {
    console.log('  · ' + f.padEnd(12) + ' 只出现在 ' + outside[0] + '.js（自产自销，需人工确认是否真有消费点）');
  } else {
    console.log('  ✅ ' + f.padEnd(12) + ' 消费于 ' + outside.join(', '));
  }
});

/* ─────────────────────────────────────────────
 * ⑥  引用了不存在的成员（GAME / DATA / U）
 *
 * 来历（v89.116）：`var g = GAME.guardOf ? GAME.guardOf(city) : null;`
 *   —— `GAME.guardOf` **全仓不存在**（真名 guardGeneralOf），三元判断把"没有这个函数"
 *   静默吞掉 → 守将永不进守城战斗、战报永远写"（无守将）"、防守体检那列恒为"未任命"。
 * 同类一次清出四处：itemCount（锦囊数恒 0）· energyMax（体力上限恒 100）·
 *   CITY_TIER_NAME（提示里显示英文键）· EQUIP_SLOT_ICON（死兜底且会抛错）。
 * 这类 bug 语法过、测试过、只在观感上体现 —— 只能静态挡。
 * ───────────────────────────────────────────── */
head('⑥ 引用了不存在的成员（拼错 / 未接线）');
const REF_NS = ['GAME', 'DATA', 'U'];
/* 白名单：白名单必须有**理由**，且理由得是"这里确实有人定义它" */
const REF_OK = {
  'GAME.onLog': '试玩工具挂的钩子（tools/playtest/*.js 里 G.onLog = …）',
  'GAME._realNowOf': '测试拨钟钩子（smoke/e2e 覆写它把"现实时间"固定住，见 GAME.realNow）',
  'GAME.icons': 'icons.js 挂载', 'GAME.gicons': 'gicons.js 挂载',
  'GAME.bitmaps': 'bitmaps.js 挂载', 'GAME.portraits': 'portraits.js 挂载',
};
/* 本节的模块清单**独立于①的 MODULES**：引用扫描要把 tactic / gicons / bitmaps /
   portraits 也算进来（它们也是 GAME.* 的生产者与消费者）。 */
const REF_MODULES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
  'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'];
/* 剥注释（audit.js 里没有共用版；注释里提到旧名不应算引用 —— 本项目踩过多次） */
const stripC = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const refSrc = {};
let refAll = '';
REF_MODULES.forEach(m => {
  const p = path.join(__dirname, 'js', m + '.js');
  refSrc[m] = stripC(fs.readFileSync(p, 'utf8'));
  refAll += refSrc[m] + '\n';
});
function refDefined(ns, name) {
  return [
    new RegExp('\\b' + ns + '\\.' + name + '\\s*='),
    new RegExp('\\b' + ns + '\\.' + name + '\\s*:'),
    new RegExp('[\\{,\\s]' + name + '\\s*:'),
    new RegExp('\\b' + name + '\\s*=[^=]'),
    new RegExp('function\\s+' + name + '\\s*\\('),
  ].some(re => re.test(refAll));
}
const undefRefs = [];
let refChecked = 0;
REF_NS.forEach(ns => {
  const seen = {};
  const re = new RegExp('\\b' + ns + '\\.([A-Za-z_$][\\w$]*)', 'g');
  let m;
  while ((m = re.exec(refAll)) !== null) {
    const name = m[1];
    /* ⚠️ 这里必须 continue —— while 循环写在 forEach 回调里，`return` 会**退出整个回调**
       （= 这个命名空间只扫到第一个重复名就停），v89.116 首版就踩了：只报了 13 个成员名。 */
    if (seen[name]) continue;
    seen[name] = 1;
    refChecked++;
    const full = ns + '.' + name;
    if (REF_OK[full]) continue;
    if (!refDefined(ns, name)) undefRefs.push(full);
  }
});
console.log('  去重后 ' + refChecked + ' 个成员名（GAME / DATA / U）');
if (undefRefs.length) {
  console.log('  ❌ 引用了不存在的成员（三元判断会把它静默吞掉）：');
  undefRefs.forEach(full => {
    const at = [];
    REF_MODULES.forEach(m => {
      const i = refSrc[m].indexOf(full);
      if (i >= 0 && at.length < 2) at.push(m + '.js:' + (refSrc[m].slice(0, i).split('\n').length));
    });
    console.log('     ' + full.padEnd(26) + at.join(' · '));
  });
} else {
  console.log('  ✅ 未发现"引用了不存在的成员"');
}

/* ─────────────────────────────────────────────
 * ⑦ 「把函数当布尔传」的恒真断言（v89.119）
 * ───────────────────────────────────────────── */
head('⑦ 恒真断言（check 第二参传函数引用）');
function scanChecks(file) {
  const f = fs.existsSync(path.join(__dirname, file)) ? path.join(__dirname, file) : null;
  if (!f) return [];
  const s = fs.readFileSync(f, 'utf8');
  const out = [];
  let i = 0;
  while ((i = s.indexOf('check(', i)) >= 0) {
    i += 'check('.length;
    /* 括号配平扫描，提取整段实参（跳过字符串里的括号） */
    let depth = 1, j = i, inS = null;
    while (j < s.length && depth > 0) {
      const ch = s[j];
      if (inS) { if (ch === inS && s[j - 1] !== '\\') inS = null; }
      else if (ch === '"' || ch === "'" || ch === '`') inS = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
      j++;
    }
    const argsStr = s.slice(i, j - 1);
    /* 顶层逗号切分 */
    const args = [];
    let d2 = 0, k = 0, last = 0, s2 = null;
    for (k = 0; k < argsStr.length; k++) {
      const ch = argsStr[k];
      if (s2) { if (ch === s2 && argsStr[k - 1] !== '\\') s2 = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { s2 = ch; continue; }
      if (ch === '(' || ch === '{' || ch === '[') d2++;
      else if (ch === ')' || ch === '}' || ch === ']') d2--;
      else if (ch === ',' && d2 === 0) { args.push(argsStr.slice(last, k)); last = k + 1; }
    }
    args.push(argsStr.slice(last));
    const cond = (args[1] || '').trim();
    /* 坏形态：`function ...` 开头（函数引用，不是调用结果）；
       合规：`(function ...)()` 或 `function ... }()`（立即调用的表达式）。 */
    if (/^function\b/.test(cond) && !/\}\s*\(\s*\)$/.test(cond)) {
      out.push({ file: file, line: s.slice(0, i).split('\n').length, head: (args[0] || '').slice(0, 60) });
    }
  }
  return out;
}
const badChecks = scanChecks('smoke-test.js').concat(scanChecks('e2e-test.js'));
if (badChecks.length) {
  console.log('  ❌ check 第二参是**函数引用**（if(cond) 不调用它 → 断言恒过）：');
  badChecks.forEach(b => console.log('     ' + b.file + ':' + b.line + '  ' + b.head));
} else {
  console.log('  ✅ 未发现"把函数当布尔传"的恒真断言（IIFE / 求值写法合规）');
}

/* ─────────────────────────────────────────────
 * 汇总
 * ───────────────────────────────────────────── */
head('汇总');
console.log('  死函数 ' + dead.length + ' · 孤儿按钮 ' + orphanBtn.length
  + ' · 重复定义 ' + dupDefs.length + ' · 零引用字段 ' + zeroRef
  + ' · 未定义引用 ' + undefRefs.length + ' · 恒真断言 ' + badChecks.length);
console.log('  提示：本脚本只做结构检查，「有没有效果」仍需 smoke/e2e 的断言兜底。');
if (STRICT && (orphanBtn.length || dupDefs.length || undefRefs.length || badChecks.length)) {
  console.log('\n  ❌ --strict 模式下存在须修复项，退出码 1');
  process.exit(1);
}
console.log('\n  审计完成。');

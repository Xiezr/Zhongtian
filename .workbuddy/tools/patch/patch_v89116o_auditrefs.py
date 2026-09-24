# -*- coding: utf-8 -*-
"""v89.116 补丁 O：把"未定义引用"审计**接进 audit.js**（同族 bug 的制度性防护）

背景：`GAME.guardOf`（守将）与后面清出的四处（itemCount / energyMax / CITY_TIER_NAME /
EQUIP_SLOT_ICON）都是同一类病：**引用了从不存在的成员，被三元判断静默吞掉**。
语法过、测试过、只在观感上体现 —— 只能靠静态审计挡。
"""
import io, os, sys

R = 'E:/Deepseekdb/'

# ---------- ① state.js：把 onLog 钩子的来由写清（防后人当死代码删掉） ----------
P1 = R + 'js/state.js'
s = io.open(P1, encoding='utf-8').read()
OLD = """    if (GAME.onLog) GAME.onLog(msg);
  };"""
NEW = """    /* v89.116：`GAME.onLog` 是**试玩工具挂的钩子**（
       .workbuddy/tools/playtest/play_600x.js 等：`G.onLog = msg => EV.push(...)`，
       用来在跑测里收集全量日志）—— 本仓**故意不定义**它，不是死代码。
       静态审计 audit.js ⑥ 把它列在白名单里（原因同此）。 */
    if (GAME.onLog) GAME.onLog(msg);
  };"""
if s.count(OLD) != 1:
    print('!! onLog 锚点 %d' % s.count(OLD)); sys.exit(1)
s = s.replace(OLD, NEW, 1)
b = io.open(R + '.workbuddy/backup/v89116/state.js', encoding='utf-8').read()
if (s.count('{') - s.count('}')) != (b.count('{') - b.count('}')):
    print('!! state.js 花括号净变化'); sys.exit(1)
tmp = P1 + '.tmp116o'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s); os.replace(tmp, P1)
print('  ✓ state.js onLog 注明来由')

# ---------- ② audit.js：新增第 ⑥ 节 ----------
P2 = R + 'audit.js'
a = io.open(P2, encoding='utf-8').read()

# 2.1 声明计数变量（放在 ⑤ 段之后、汇总之前）
OLD2 = """/* ─────────────────────────────────────────────
 * 汇总
 * ───────────────────────────────────────────── */
head('汇总');
console.log('  死函数 ' + dead.length + ' · 孤儿按钮 ' + orphanBtn.length
  + ' · 重复定义 ' + dupDefs.length + ' · 零引用字段 ' + zeroRef);
console.log('  提示：本脚本只做结构检查，「有没有效果」仍需 smoke/e2e 的断言兜底。');
if (STRICT && (orphanBtn.length || dupDefs.length)) {
  console.log('\\n  ❌ --strict 模式下存在须修复项，退出码 1');
  process.exit(1);
}"""
NEW2 = """/* ─────────────────────────────────────────────
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
  'GAME.icons': 'icons.js 挂载', 'GAME.gicons': 'gicons.js 挂载',
  'GAME.bitmaps': 'bitmaps.js 挂载', 'GAME.portraits': 'portraits.js 挂载',
};
const refSrc = {};
let refAll = '';
MODULES.forEach(m => {
  const p = path.join(__dirname, 'js', m + '.js');
  refSrc[m] = stripComment(fs.readFileSync(p, 'utf8'));
  refAll += refSrc[m] + '\\n';
});
function refDefined(ns, name) {
  return [
    new RegExp('\\\\b' + ns + '\\\\.' + name + '\\\\s*='),
    new RegExp('\\\\b' + ns + '\\\\.' + name + '\\\\s*:'),
    new RegExp('[\\\\{,\\\\s]' + name + '\\\\s*:'),
    new RegExp('\\\\b' + name + '\\\\s*=[^=]'),
    new RegExp('function\\\\s+' + name + '\\\\s*\\\\('),
  ].some(re => re.test(refAll));
}
const undefRefs = [];
let refChecked = 0;
REF_NS.forEach(ns => {
  const seen = {};
  const re = new RegExp('\\\\b' + ns + '\\\\.([A-Za-z_$][\\\\w$]*)', 'g');
  let m;
  while ((m = re.exec(refAll)) !== null) {
    const name = m[1];
    if (seen[name]) return;
    seen[name] = 1;
    refChecked++;
    const full = ns + '.' + name;
    if (REF_OK[full]) return;
    if (!refDefined(ns, name)) undefRefs.push(full);
  }
});
console.log('  去重后 ' + refChecked + ' 个成员名（GAME / DATA / U）');
if (undefRefs.length) {
  console.log('  ❌ 引用了不存在的成员（三元判断会把它静默吞掉）：');
  undefRefs.forEach(full => {
    const at = [];
    MODULES.forEach(m => {
      const i = refSrc[m].indexOf(full);
      if (i >= 0 && at.length < 2) at.push(m + '.js:' + (refSrc[m].slice(0, i).split('\\n').length));
    });
    console.log('     ' + full.padEnd(26) + at.join(' · '));
  });
} else {
  console.log('  ✅ 未发现"引用了不存在的成员"');
}

/* ─────────────────────────────────────────────
 * 汇总
 * ───────────────────────────────────────────── */
head('汇总');
console.log('  死函数 ' + dead.length + ' · 孤儿按钮 ' + orphanBtn.length
  + ' · 重复定义 ' + dupDefs.length + ' · 零引用字段 ' + zeroRef
  + ' · 未定义引用 ' + undefRefs.length);
console.log('  提示：本脚本只做结构检查，「有没有效果」仍需 smoke/e2e 的断言兜底。');
if (STRICT && (orphanBtn.length || dupDefs.length || undefRefs.length)) {
  console.log('\\n  ❌ --strict 模式下存在须修复项，退出码 1');
  process.exit(1);
}"""
if a.count(OLD2) != 1:
    print('!! audit 汇总锚点 %d' % a.count(OLD2)); sys.exit(1)
a = a.replace(OLD2, NEW2, 1)
tmp2 = P2 + '.tmp116o'
io.open(tmp2, 'w', encoding='utf-8', newline='\n').write(a); os.replace(tmp2, P2)
print('  ✓ audit.js 新增第 ⑥ 节')

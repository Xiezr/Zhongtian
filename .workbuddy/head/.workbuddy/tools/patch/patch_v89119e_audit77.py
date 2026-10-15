# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119e_audit77.py — audit.js 加第 ⑦ 节：恒真断言扫描（v89.119）
# ----------------------------------------------------------------
# 来历：smoke 的 `check(name, cond, extra)` 里 `if (cond)` **不调用函数** ——
#   把 `function () { return X; }` 当第二参传进去 → 函数对象恒 truthy → **断言恒过**。
#   本轮在 §98（上轮遗留）与 §100（本轮）共抓到 6 处，全部改成 IIFE/求值。
# 本节点把它做成制度：扫 smoke-test.js / e2e-test.js 的每个 check 调用，
#   第二参以 `function` 开头且**不是立即调用**（不带 `}()`）→ 报"恒真断言"。
# ================================================================
import io, os, sys

P = 'E:/Deepseekdb/audit.js'
BAK = 'E:/Deepseekdb/.workbuddy/backup/v89119/audit.js'
if not os.path.exists(BAK):
    # audit.js 上一轮没进 v89119 备份（本轮首次改它）→ 就地备份
    io.open(BAK, 'w', encoding='utf-8', newline='\n').write(io.open(P, encoding='utf-8').read())
    print('（audit.js 已补备份到 .workbuddy/backup/v89119/）')

s = io.open(P, encoding='utf-8').read()

ANCHOR = "/* ─────────────────────────────────────────────\n * 汇总\n"
i = s.index(ANCHOR)

SEC7 = r'''/* ─────────────────────────────────────────────
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

'''

s = s[:i] + SEC7 + s[i:]

# 汇总行加计数
OLD_SUM = ("console.log('  死函数 ' + dead.length + ' · 孤儿按钮 ' + orphanBtn.length\n"
           "  + ' · 重复定义 ' + dupDefs.length + ' · 零引用字段 ' + zeroRef\n"
           "  + ' · 未定义引用 ' + undefRefs.length);")
NEW_SUM = ("console.log('  死函数 ' + dead.length + ' · 孤儿按钮 ' + orphanBtn.length\n"
           "  + ' · 重复定义 ' + dupDefs.length + ' · 零引用字段 ' + zeroRef\n"
           "  + ' · 未定义引用 ' + undefRefs.length + ' · 恒真断言 ' + badChecks.length);")
assert s.count(OLD_SUM) == 1, '汇总行锚点 %d' % s.count(OLD_SUM)
s = s.replace(OLD_SUM, NEW_SUM, 1)

# strict 条件加 badChecks
OLD_STRICT = "if (STRICT && (orphanBtn.length || dupDefs.length || undefRefs.length)) {"
NEW_STRICT = "if (STRICT && (orphanBtn.length || dupDefs.length || undefRefs.length || badChecks.length)) {"
assert s.count(OLD_STRICT) == 1, 'strict 锚点 %d' % s.count(OLD_STRICT)
s = s.replace(OLD_STRICT, NEW_STRICT, 1)

# 自检 + 落盘
b = io.open(BAK, encoding='utf-8').read()
d = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
print('花括号净变化 %+d' % d)
assert '<<<<<<<' not in s
tmp = P + '.tmp119e'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('audit.js 第 ⑦ 节已加')

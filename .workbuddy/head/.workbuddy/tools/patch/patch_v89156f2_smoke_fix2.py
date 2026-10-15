# -*- coding: utf-8 -*-
# v89.156 patch F2（稳健版）：smoke ⑤ v89.66 升级
# ⚠️ 教训：配平扫描器会被**正则里的转义括号**带偏（`/minmax\(0, 1fr\)/` 里的 \( \)）——
#    首版据此把 25K 字符的后续内容当"语句的一部分"整段替换，切坏了文件（靠 before 备份回滚）。
#    改用「下一个 check( 行首」为上界的稳健法（此处两 check 之间只有换行）。
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

if u'v89.156：出征四块**逐行**' in s:
    print('⑤ skip（已落盘）')
else:
    a = s.index(u"check('v89.66：出征四块")
    b = s.index(u"\n  check(", a)          # 下一个 check 的行首（此处两 check 间只有换行）
    SEG = s[a:b]
    assert u'exp-quad' in SEG and u'exp-a-est' in SEG, 'seg check'
    assert SEG.count(u'check(') == 1, 'seg contains extra check: ' + str(SEG.count(u'check('))
    assert len(SEG) < 5000, 'seg too long: ' + str(len(SEG))
    SEG_END = u"\n"                        # 保留换行

    NEW = u"""check('v89.156：出征四块**逐行**（单列）+ 可用道具紧随其后（预估搬右列 · 原 v89.66 2×2 退役）', (function () {
    var body = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8').replace(/\\s+/g, ' ');
    var exp = codeOf(uS, 'ui.openExpModal = function');
    /* v89.66 立（2×2 子网格）→ v89.156 改（老板 3：「不再分两列，逐行显示即可」）。
       判据（结构，不用注释当锚点）：.exp-quad 之后第 1~5 个 `class="exp-sec ` 必须是
         计略/出征方式/方案/出征战术/**可用道具**（v89.156 从右列挪入）；
       预估改用**函数调用点**定位（块已抽到 ui.expEstBlockHTML，字面量不在本函数里）：
         调用点在右列（exp-col-r）之后 + 仅在战斗型任务渲染。 */
    var q = exp.indexOf('class="exp-quad"');
    if (q < 0) return false;
    var OFF = 'class="exp-sec '.length;          /* exp-a-* 相对 `class="exp-sec ` 的偏移 */
    var secs = [], p = q;
    while ((p = exp.indexOf('class="exp-sec ', p + 1)) >= 0) secs.push(p);
    var idx = ['exp-a-tactic', 'exp-a-modes', 'exp-a-plan', 'exp-a-tacmenu', 'exp-a-items']
      .map(function (k) { return exp.indexOf(k, q); });
    var iR = exp.indexOf('exp-col-r', q);
    var iEstCall = exp.indexOf('ui.expEstBlockHTML()', q);
    return secs.length >= 5
      && idx[0] === secs[0] + OFF && idx[1] === secs[1] + OFF
      && idx[2] === secs[2] + OFF && idx[3] === secs[3] + OFF
      && idx[4] === secs[4] + OFF                               /* 第 5 块 = 可用道具 */
      && iR > 0 && iEstCall > iR                                /* 预估调用点在右列 */
      && /if \\(!ui\\._expOwn && !isOwnWild137\\) html \\+= ui\\.expEstBlockHTML\\(\\);/.test(exp)
      && /\\.exp-quad \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\);/.test(body)
      && /\\.exp-quad > \\.exp-sec \\{ margin-bottom: 0; \\}/.test(body)
      /* 只换容器：四块的 id 与 handler 一个都不能丢 */
      && /id="exp-scheme-sel"/.test(exp) && /id="exp-mode"/.test(exp)
      && /id="exp-plan"/.test(exp) && /id="exp-tactic"/.test(exp) && /id="exp-tac-sum"/.test(exp);
  })());"""
    s = s[:a] + NEW + SEG_END + s[b + 1:]
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('⑤ v89.66 升级 OK（稳健抓段 %d 字符）, len %d -> %d' % (len(SEG), orig, len(s)))

# -*- coding: utf-8 -*-
"""v90.94：版本守卫升级。
   §199④ 由「锁死字面量 v89.240」改为「锁格式 v\\d+\\.\\d+」（先例 §139.5 / §229c⑧）；
   新增 §199⑤ 发版脚本在岗 · §199⑥ 版本三处自洽（GAME.VERSION 必须已录进需求档案）。
   走：备份 -> 内存替换 -> 锚点唯一 -> 原子落盘 -> 写后自检。"""
import io
import os
import shutil

P = r'E:\Deepseekdb\smoke-test.js'
BK = r'E:\Deepseekdb\.workbuddy\backup\v90.94-lordbreak\smoke-test.js.preVer2'

OLD = r"""    check('§199④ 版本标识：GAME.VERSION 在册 + 设置页显示 + 强制刷新指引', (function () {
      return /GAME\.VERSION = 'v89\.240'/.test(mS199)   /* v89.223：版本号每轮迭代更新（本条随轮升级） */
        && uS199.indexOf('🧩 运行版本') >= 0
        && uS199.indexOf('Ctrl + F5') >= 0;
    })());
"""

NEW = r"""    check('§199④ 版本标识：GAME.VERSION 在册 + 格式合法 + 设置页显示 + 强制刷新指引', (function () {
      /* v90.94：由「锁死字面量 v89.240」改为「锁格式」—— 升版本不必再改测试
         （先例 §139.5 / §229c⑧：历史断言放宽为 v\d+\.\d+）。
         具体版本号的自洽改由 §199⑥ 保证（必须已录进需求档案）。 */
      return /GAME\.VERSION = 'v\d+\.\d+';/.test(mS199)
        && uS199.indexOf('🧩 运行版本') >= 0
        && uS199.indexOf('Ctrl + F5') >= 0;
    })());
    check('§199⑤ 发版脚本在岗（版本三连的唯一出口 · 防「机制蒸发」）', (function () {
      /* v90.94（老板「形成一个更加稳健的解决方案」）：`?v=` 只在**值变化**时才击穿浏览器缓存，
         值不变 = 浏览器继续吃旧文件 —— 这一步只能靠机制，不能靠人记得按 Ctrl+F5
         （v89.77 老板连报三轮「还是不对」的根因）。
         旧脚本躺在 .workbuddy/tmp/（会被清理）且有 3 处缺陷，故本条钉「新脚本在岗且已修好」。 */
      var fs5 = require('fs'), p5 = require('path');
      var f5 = p5.join(__dirname, '.workbuddy', 'tools', 'patch', 'bump_version.py');
      if (!fs5.existsSync(f5)) return false;
      var s5 = fs5.readFileSync(f5, 'utf8');
      return s5.indexOf('def find_root') >= 0     /* 自定位仓库根（不写死路径） */
        && s5.indexOf('未写盘') >= 0               /* 自检未过 → 不落盘 */
        && s5.indexOf('(?:js|story)') < 0          /* 已去掉漏 vendor/three.min.js 的前缀约束 */
        && s5.indexOf('GAME.VERSION') >= 0         /* 代管第 ① 处 */
        && s5.indexOf('MIN_TAGS') >= 0;            /* 断言带下限（防平凡解） */
    })());
    check('§199⑥ 版本三处自洽：GAME.VERSION 必须已录进需求档案（防「代码升了、档案没升」）', (function () {
      var fs6 = require('fs'), p6 = require('path');
      var m6 = /GAME\.VERSION = '(v\d+\.\d+)';/.exec(mS199);
      if (!m6) return false;
      var arc6 = fs6.readFileSync(p6.join(__dirname, '需求档案.md'), 'utf8');
      return arc6.indexOf(m6[1]) >= 0;
    })());
"""

s = io.open(P, encoding='utf-8', newline='').read()
n0 = len(s)
c = s.count(OLD)
assert c == 1, '锚点计数 %d（应 1）' % c
s = s.replace(OLD, NEW, 1)

# 写后自检：三条新守卫的关键字必须在位，旧的耦合字面量必须消失
for k in ['§199④ 版本标识', '§199⑤ 发版脚本在岗', '§199⑥ 版本三处自洽',
          'v\\d+\\.\\d+', 'bump_version.py', 'MIN_TAGS']:
    assert k in s, '自检失败，缺：' + k
assert "GAME\\.VERSION = 'v89\\.240'" not in s, '自检失败：旧的字面量锁仍在'

if not os.path.exists(BK):
    shutil.copy2(P, BK)
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('[OK] smoke-test.js %d -> %d 字符' % (n0, len(s)))

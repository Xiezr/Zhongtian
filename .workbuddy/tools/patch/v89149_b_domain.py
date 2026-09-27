# -*- coding: utf-8 -*-
"""v89.149 批 B：domain.js —— 兵种一字简称唯一出口 `GAME.troopAbOf`
（数据在 DATA.TROOPS[].ab，缺字段时兜底取名字首字；界面/探针/断言读同一处）"""
import io

P = 'E:/Deepseekdb/js/domain.js'
BAK = 'E:/Deepseekdb/backup/v89149/domain.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()

ANCHOR = """  /* v89.136（老板 4）：出征战斗的**唯一读口** —— 细分覆盖通用（逐兵种回退）。
     · modeId = 'raid' / 'occupy'（其余一律按占领：scout 不开战，不入此路）；
     · 返回**新对象**（只读视图 —— 写入走 tacticsOf(side)/setTactic，勿写回本对象）。 */
  GAME.tacticsFor = function (modeId) {"""

NEW = """  /* ============================================================
   * v89.149（老板 3）：「为兵种设置一个**一字简称**，不要挤压行动设置和目标设置」
   * ------------------------------------------------------------
   * 战场两侧列表每格只有 ~105px（2 列 × 侧栏 211px），兵种全称（3~4 字 = 约 60px）
   * 把两个下拉挤到 31px / 57px（实测）—— 名字一字化后，两份宽度都归下拉。
   * 简称表在 `DATA.TROOPS[].ab`（数据层唯一来源，不在这里另抄一张）；
   * 缺字段时兜底取名字首字（新增兵种忘了写 ab 也不会留空）。
   * 界面用简称、`title` 悬停给全名与最终属性（信息不丢）。
   * ============================================================ */
  GAME.troopAbOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return '';
    return t.ab || (t.name || '').charAt(0);
  };
  /* v89.136（老板 4）：出征战斗的**唯一读口** —— 细分覆盖通用（逐兵种回退）。
     · modeId = 'raid' / 'occupy'（其余一律按占领：scout 不开战，不入此路）；
     · 返回**新对象**（只读视图 —— 写入走 tacticsOf(side)/setTactic，勿写回本对象）。 */
  GAME.tacticsFor = function (modeId) {"""

if 'GAME.troopAbOf = function' in s and ANCHOR not in s:
    print('SKIP(已落) troopAbOf')
else:
    n = s.count(ANCHOR)
    assert n == 1, '锚点不唯一/缺失 count=' + str(n)
    s = s.replace(ANCHOR, NEW)
    print('OK troopAbOf')

assert s.count('GAME.troopAbOf = function') == 1
assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏不一致'
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('domain.js 落盘 · len=' + str(len(s)))

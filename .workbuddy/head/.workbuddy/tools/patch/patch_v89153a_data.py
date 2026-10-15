# -*- coding: utf-8 -*-
# v89.153a：data.js —— MSG_KINDS 重排（系统/战报/侦查 + task 并入）、新增 MSG_SUBS/标签色表、
#            "元宝"口径清理（3 处注释）
import io, re

P = 'E:/Deepseekdb/js/data.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
n = 0

def rep(tag, old, new, guard):
    global s, n
    if guard in s:
        print('  skip ' + tag); return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    s = s.replace(old, new)
    n += 1
    print('  OK   ' + tag)

# ---------- ① MSG_KINDS 重排（老板 1：系统，战报，侦查）+ task 并入系统（老板 2） ----------
OLD_K = u"""  DATA.MSG_KINDS = [
    { id: 'war',    name: '战报', icon: '⚔️', desc: '出征 / 攻城 / 行军 / 调防 / 缴获 —— 战报列表 + 军事流水' },
    { id: 'scout',  name: '侦查', icon: '🔭', desc: '侦查回报：守军 / 守将 / 库藏 / 布防（按侦察技巧分层解锁）' },
    { id: 'beacon', name: '烽火', icon: '🔥', doc: false,
      desc: '预警与来袭：犯境预警 / 击退或被破 / 防守计（**流水在军务 · 烽火**，不在公文）' },
    { id: 'task',   name: '任务', icon: '📜', desc: '任务完成 / 随机任务 / 时代之志与改元' },
    { id: 'sys',    name: '系统', icon: '📣', desc: '内政 / 经济 / 建设 / 江湖与其余提示' }
  ];"""
NEW_K = u"""  /* v89.153（老板 1/2）：页签顺序 = **系统 / 战报 / 侦查**（老板原话排序）；
     「任务」并入「系统」页（`doc:false` —— 不另立页签，但仍是合法类别、消息照收）——
     与 v89.116 烽火移出同一套机制（`doc:false` = 不出页签）。 */
  DATA.MSG_KINDS = [
    { id: 'sys',    name: '系统', icon: '📣', desc: '系统汇总：军情 / 任务 / 改元 / 天时 / 建造 / 采集收获…… 按小标签筛选' },
    { id: 'war',    name: '战报', icon: '⚔️', desc: '出征 / 攻城 / 行军 / 调防 / 缴获 —— 战报列表（军事流水在「系统 · 军情」）' },
    { id: 'scout',  name: '侦查', icon: '🔭', desc: '侦查回报：守军 / 守将 / 库藏 / 布防（按侦察技巧分层解锁）' },
    { id: 'beacon', name: '烽火', icon: '🔥', doc: false,
      desc: '预警与来袭：犯境预警 / 击退或被破 / 防守计（**流水在军务 · 烽火**，不在公文）' },
    { id: 'task',   name: '任务', icon: '📜', doc: false,
      desc: '任务完成 / 随机任务 / 时代之志与改元（**v89.153 起并入「系统」页**）' }
  ];
  /* ============================================================
   * 消息主题（v89.153 · 老板 2：「小标签包含全部，改元，天时，建造，
   *   采集收获等整合，字体颜色不同」）
   * ------------------------------------------------------------
   * 第三条分类维度：`kind`（大类 = 页签归属）之外再加 `sub`（主题 = 系统页小标签）。
   *   · 发射点声明：`GAME.log(msg, kind, sub)`（sub ∈ 本表 id，非法则无主题）；
   *   · 系统页取用走**唯一出口** `GAME.msgSubOf(rec)`：有 sub 按 sub，否则按 kind
   *     （war → 军情 / task → 任务 / sys → 系统）；
   *   · **颜色是数据的属性**（`color`）—— chips 与消息行的字体色都从这读，
   *     不在 CSS 里各写一份（改色只改本表）。
   * ============================================================ */
  DATA.MSG_SUBS = [
    { id: 'era',     name: '改元',     color: '#edd08a', desc: '时代之志与改元' },
    { id: 'weather', name: '天时',     color: '#8fd0e8', desc: '季节与天气变化' },
    { id: 'build',   name: '建造',     color: '#c9a06a', desc: '建筑落成与升级' },
    { id: 'gather',  name: '采集收获', color: '#7bc96f', desc: '采集开始 / 收获 / 自动采集' }
  ];
  DATA.MSG_SUB_BY = {};
  DATA.MSG_SUBS.forEach(function (k) { DATA.MSG_SUB_BY[k.id] = k; });
  /* 系统页标签的"别名与颜色"（kind 级）—— war 在系统页里叫「军情」（页签名才是"战报"）。 */
  DATA.MSG_TAG_NAME = { war: '军情' };
  DATA.MSG_TAG_COLOR = { war: '#e0a83c', task: '#6fb7e0', sys: '#a8a7af' };"""

rep('msg-kinds', OLD_K, NEW_K, u"'v89.153 起并入「系统」页'")

# ---------- ② v89.139 历史注释里的"元宝"与旧珠宝名（清理） ----------
OLD_H = u"""       v89.135 的地形表只覆盖前 8 种 —— 夜明珠**没有任何采集来源**，
       爵位「公乘」（玉石×10 + 夜明珠×5）以后的晋升只能商城买（48 元宝/颗，
       裂土封王要 50 颗 = 2400 元宝）—— 这就是"没合理安排"。"""
NEW_H = u"""       v89.135 的地形表只覆盖前 8 种 —— 夜明珠**没有任何采集来源**，
       爵位后段的部分珠宝只能商城购买 —— 这就是"没合理安排"。
       （v89.152 已整体重设珠宝体系：18 种各归其位，见 DATA.ITEMS 珠宝段。）"""
rep('hist-note', OLD_H, NEW_H, u'v89.152 已整体重设珠宝体系')

# ---------- ③ 练兵经验表注释里的"元宝" ----------
rep('price-note',
    u"""     * ⚠️ 价格（元宝）同比下调：曲线缩了 32 倍，价格不缩的话最小的练兵经验""",
    u"""     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）同比下调：曲线缩了 32 倍，价格不缩的话最小的练兵经验""",
    u'内部价 · 商城实售 = price × 100 金')
rep('price-note2',
    u"""     * 调平衡只改这张表（pct = 占曲线比例，price = 元宝价，金 = price × 100）。""",
    u"""     * 调平衡只改这张表（pct = 占曲线比例，price = 内部价，商城实售 = price × 100 金）。""",
    u'price = 内部价，商城实售')

# ---------- ④ 珠宝段注释：价格口径写清楚（老板问"240 是什么意思"） ----------
rep('jewel-price',
    u"""         · loyalty = 赏赐忠诚值（5 -> 100，随 price 递增）；price = 商城价（阶梯的锚）。""",
    u"""         · loyalty = 赏赐忠诚值（5 -> 100，随 price 递增）；
         · price = **内部定价单位**（阶梯的锚）—— 商城实售 = price × 100 **金**
           （例：独山玉 price 240 → 商城 24000 金；蚌珠 price 2 → 200 金）。""",
    u'商城实售 = price × 100 **金**')
rep('jewel-price-k',
    u"""           ⚠️ 宝箱/缴获按**数组顺序**切"最便宜的 N 档"，故本数组必须保持价格升序；""",
    u"""           ⚠️ 宝箱/缴获按**数组顺序**切"最便宜的 N 档"，故本数组必须保持价格升序；
           （价格两轮示例：蚌珠 2 → 200 金、夜明珠 150 → 15000 金、独山玉 240 → 24000 金）""",
    u'价格两轮示例：蚌珠 2 → 200 金')

# ---------- 写盘 + 自检 ----------
def cb(t):
    return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
_bk = io.open(P, encoding='utf-8', newline='').read()
assert (cb(s)[0] - cb(s)[1]) == (cb(_bk)[0] - cb(_bk)[1]), \
    'brace imbalance: %d -> %d' % (cb(_bk)[0] - cb(_bk)[1], cb(s)[0] - cb(s)[1])
io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert u"DATA.MSG_SUBS" in chk and u"DATA.MSG_TAG_COLOR" in chk
assert u'48 元宝' not in chk and u'元宝价' not in chk, 'still has 元宝口径'
assert chk.count(u'元宝') == 1, 'sole 元宝 = 老板原话引用'
assert chk.count(u"doc: false") == 2, 'doc:false count=' + str(chk.count(u"doc: false"))
print('OK len %d -> %d (segs %d)' % (orig, len(chk), n))

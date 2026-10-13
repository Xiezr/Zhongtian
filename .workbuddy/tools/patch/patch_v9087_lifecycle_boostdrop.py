# -*- coding: utf-8 -*-
"""
v90.87 复核补丁 · lifecycle_v89121.js（宝物全生命周期探针）

问题（复核发现的 9 条假红断链）：
  v89.179c 起，pct≥0.5 的高阶加速宝物（hanxin_dianbing / tiangong / hetu /
  jiangzuo_chi / hufu_junling / shiwan_jiabing / tongshang_quan / taozhu_mishu /
  muniuliuma，共 9 件）被**移出游商**，改走 `DATA.BOOST_DROP` 掉落表
  （采集归来为主渠 / 出征缴获为次渠，唯一出口 GAME.grantBoostDrop）。
  探针（v89.121 年代）未同步：
    ① 渠道表只登记了 SEED_DROP，漏了 BOOST_DROP；
    ② `inShop()` 用 raw `price>0 && !noShop` —— 把 dropOnly 件误当"在售"（盲区），
       于是走"真买"分支 → 产品正确拒卖 → src=n → 整条链断（假红）。
  口径与 smoke §102② 完全一致（smoke 在 v89.179c 已补 BOOST_DROP + 改用 ui.shopItems()）。

修法（跟随产品口径，不新增第二套判据）：
  ① `inShop(it)` 改用产品唯一出口 `GAME.ui.shopItems()` 的成员判定
     （它已排除 dropOnly / noShop，与玩家实际看到的游商同口径）；
  ② 渠道表补登记 `DATA.BOOST_DROP.table`。

纪律：先备份 → 锚点计数断言 → 原子落盘 → 写后自检。
"""
import io, os, sys, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
TARGET = os.path.join(ROOT, '.workbuddy', 'tools', 'play', 'lifecycle_v89121.js')
BACKUP = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.87', 'lifecycle_v89121.js')

if not os.path.isfile(TARGET):
    sys.exit('❌ 目标不存在：' + TARGET)

# ---- 备份（若尚未备份） ----
if not os.path.isfile(BACKUP):
    os.makedirs(os.path.dirname(BACKUP), exist_ok=True)
    shutil.copy2(TARGET, BACKUP)
    print('🗂  已备份 →', BACKUP)

# ---- 先读进变量（⛔ 绝不"边打开写边读同一文件"） ----
with io.open(TARGET, 'r', encoding='utf-8') as f:
    s = f.read()

orig = s

# ================= 锚点 1：补 BOOST_DROP + 改 inShop =================
A1 = u"""  var CH_BY_ID = {};
  ((DATA.SEED_DROP || {}).table || []).forEach(function (r) { CH_BY_ID[r.id] = '采集/缴获(种子掉落表)'; });
"""
A1_NEW = u"""  var CH_BY_ID = {};
  /* v89.224：DATA.SEED_DROP 已退役（种子体系删除）—— 保留此行仅为兼容旧档口径，读到 undefined 即空跑。 */
  ((DATA.SEED_DROP || {}).table || []).forEach(function (r) { CH_BY_ID[r.id] = '采集/缴获(种子掉落表)'; });
  /* v90.87（复核修复）：v89.179c 起 pct≥0.5 的高阶加速宝物（dropOnly）移出游商、
     改走 DATA.BOOST_DROP（采集归来主渠 / 出征缴获次渠 · 唯一出口 GAME.grantBoostDrop）。
     探针渠道表未同步 → 9 件被误标"游商"并买失败（假红断链）。与 smoke §102② 同口径补齐。 */
  ((DATA.BOOST_DROP || {}).table || []).forEach(function (r) { CH_BY_ID[r.id] = '采集/缴获(加速宝物掉落表)'; });
"""
assert s.count(A1) == 1, '❌ 锚点1 命中 %d 次（应为 1）' % s.count(A1)
s = s.replace(A1, A1_NEW, 1)

A2 = u"""  function inShop(it) { return it.price > 0 && !it.noShop && !!(G.ui.SHOP_CATS || {})[it.type]; }
"""
A2_NEW = u"""  /* v90.87（复核修复）：在售判据改用产品唯一出口 `GAME.ui.shopItems()`（已排除 dropOnly / noShop）——
     raw `price>0 && !noShop` 会把 dropOnly 件误当"在售"（盲区，smoke §102② 早就点过）。
     探针必须跟随产品口径，不另起第二套判据。 */
  var _ONSALE87 = null;
  function inShop(it) {
    if (_ONSALE87 === null) {
      _ONSALE87 = {};
      (G.ui.shopItems() || []).forEach(function (x) { _ONSALE87[x.id] = 1; });
    }
    return !!_ONSALE87[it.id];
  }
"""
assert s.count(A2) == 1, '❌ 锚点2 命中 %d 次（应为 1）' % s.count(A2)
s = s.replace(A2, A2_NEW, 1)

if s == orig:
    sys.exit('❌ 无改动（锚点未生效）')

# ---- 原子落盘 ----
tmp = TARGET + '.tmp9087'
with io.open(tmp, 'w', encoding='utf-8') as f:
    f.write(s)
os.replace(tmp, TARGET)
print('✅ 已写入', TARGET)

# ---- 写后自检 ----
with io.open(TARGET, 'r', encoding='utf-8') as f:
    ck = f.read()
problems = []
if ck.count("BOOST_DROP || {}).table") != 1:
    problems.append('BOOST_DROP 登记缺失/重复')
if ck.count("_ONSALE87") != 5:   # var + 3 处使用 + return（共 5）
    problems.append('_ONSALE87 计数异常 = %d' % ck.count("_ONSALE87"))
if 'it.price > 0 && !it.noShop' in ck:
    problems.append('旧 inShop 判据仍在')
if ck.count('function inShop') != 1:
    problems.append('inShop 定义数异常')
if ck.count('{') != ck.count('}'):
    problems.append('花括号不配平 %d/%d' % (ck.count('{'), ck.count('}')))
if ck.count('(') != ck.count(')'):
    problems.append('圆括号不配平 %d/%d' % (ck.count('('), ck.count(')')))

if problems:
    print('❌ 自检失败：' + ' · '.join(problems))
    sys.exit(1)
print('🔎 自检通过：BOOST_DROP 已登记 · inShop 走 ui.shopItems() · 括号配平')

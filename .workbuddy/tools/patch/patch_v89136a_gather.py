# -*- coding: utf-8 -*-
# v89.136 批0-a：domain.js —— 驻军丢失修复 + 采集体系合并（唯一形态=带将驻军原地开工）
# 规矩：读 newline='' / 写 newline='' / 写后自检（node --check 由调用方跑）
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

d = rd('js/domain.js')

# ============================================================
# ① v89.63 注释块 → v89.136 合并说明（语义已变：唯一形态=带将驻军）
# ============================================================
a0 = d.find('/* v89.63（老板「野地驻军可以选择采集或召回」）：')
assert a0 > 0, 'v89.63 注释头未找到'
a0 -= 2  # 含前导两空格
a1 = d.find('/* ============================================================\n   * v89.87（老板需求 2）：采集**出发** —— 走行军通道')
assert a1 > a0, 'v89.87 注释头未找到'
new_note = '''  /* ============================================================
   * 采集（v89.136 合并定型）：**唯一形态 = 带将驻军原地开工**
   * ------------------------------------------------------------
   * 老板令：「'野地采集（0/3队）'这个弹窗界面不需要」「地块操作界面加一个采集操作
   *   （提供采集，收获按钮和采集进度显示）」「己方野地只有在有将领带领驻军的时候才可采集」。
   * 于是"将领带队从城里出发采集"（v89.87 行军通道）整条退役：
   *   · 旧入口已删 —— openGatherModal / dispatchGather / doStartGather / openGathers 弹窗
   *     （墓碑见 ui.js 与 main.js）；
   *   · 采集资格：该野地**有驻军且驻军有将领**（garrison.genId）；
   *   · 兵**不离开驻军**（原地开工）——记录带 `inPlace:true`，采力动态读驻军；
   *   · 记录 `origin:'garrison'` 保留：老档迁移与"回城/回驻军"分流仍读它。
   * ============================================================ */
'''
d = d[:a0] + new_note + d[a1:]

# ============================================================
# ② v89.87 注释块 + dispatchGather → 墓碑
# ============================================================
b0 = d.find('/* ============================================================\n   * v89.87（老板需求 2）：采集**出发** —— 走行军通道')
assert b0 > 0, 'v89.87 注释头未找到（第二轮）'
b0 -= 2
b1 = d.find('  GAME.startGather = function', b0)
assert b1 > b0, 'startGather 起点未找到'
grave = '''  /* ⛔ v89.136 移除：`GAME.dispatchGather`（将领带队采集 · 行军通道）——
     采集已合并为「带将驻军原地开工」（见上方说明）。旧链路清点：
     ① 本函数；② `doStartGather`（main.js）；③ `openGatherModal`（ui.js）；
     ④ `case 'gather-open' / 'gather-start'`；
     ⑤ battle.js 的 arrive gather 分支**保留**（仅服务老档在途行军 —— 抵达时兵并入驻军）。
     `mode 'gather'`（data.js）保留：老档在途行军的显示兜底，不再有新出发。 */
'''
d = d[:b0] + grave + d[b1:]

# ============================================================
# ③ startGather 全函数替换（配平法定位，签名 (x,y,army,opts)）
# ============================================================
sig = '  GAME.startGather = function (x, y, genId, army, opts) {'
i = d.find(sig)
assert i > 0, 'startGather 签名未找到'
# 花括号配平（字符串/注释感知）
j = d.find('{', i + len(sig) - 1)
depth = 0; k = j; n = len(d)
inStr = None; inBlock = False; inLine = False
while k < n:
    c = d[k]; c2 = d[k+1] if k+1 < n else ''
    if inBlock:
        if c == '*' and c2 == '/': inBlock = False; k += 2; continue
        k += 1; continue
    if inLine:
        if c == '\n': inLine = False
        k += 1; continue
    if inStr:
        if c == '\\': k += 2; continue
        if c == inStr: inStr = None
        k += 1; continue
    if c in '"\'`': inStr = c; k += 1; continue
    if c == '/' and c2 == '*': inBlock = True; k += 2; continue
    if c == '/' and c2 == '/': inLine = True; k += 2; continue
    if c == '{': depth += 1
    elif c == '}':
        depth -= 1
        if depth == 0: break
    k += 1
assert depth == 0, 'startGather 配平失败'
end = d.find(';', k)
assert end > k, 'startGather 尾分号未找到'
old_len = end + 1 - i
assert old_len > 3000, 'startGather 函数体过短 ' + str(old_len)

new_sg = '''  GAME.startGather = function (x, y, army, opts) {
    var s = GAME.state, G = DATA.GATHER;
    opts = opts || {};
    var chk = GAME.canStartGather(x, y);
    if (!chk.ok) return chk;
    var w = chk.wild;
    var gar = GAME.wildGarrisonAt(x, y);
    if (!gar || !GAME.wildGarrisonTotal(gar)) return { ok: false, msg: '此地没有驻军可开采' };
    /* v89.135（老板第 5 条）：「己方野地只有在**有将领带领驻军**的时候才可采集，
       否则不可采集，只可驻留军队」—— 无将驻军（纯增援叠上来的）只可驻留。 */
    if (!gar.genId) return { ok: false, msg: '驻军须有将领带队方可开采（增派一名将领驻守后再开采）' };
    var troops = 0;
    for (var k in (army || {})) troops += Math.floor(army[k] || 0);
    if (troops <= 0) return { ok: false, msg: '请派遣兵力（兵越多收成越高）' };
    var city = (opts.cityId && GAME.cityById(opts.cityId)) || GAME.currentCity();
    if (!city) return { ok: false, msg: '城池不存在' };
    var rec = {
      id: 'ga' + (s._gatherSeq = (s._gatherSeq || 0) + 1),
      x: x, y: y, type: w.type, level: w.level || 0,
      /* 带队将领 = 驻军将领（采集卡显示其名） */
      genId: gar.genId || null,
      army: U.deep(army), troops: troops,
      cityId: (gar.cityId || city.id), elapsed: 0,
      origin: 'garrison',
      /* v89.136：**兵在驻军（原地开工）** —— 收获/召回不搬兵。
         老档里"兵在队里"的旧式记录由 migrateLegacyGathers 迁移成此形态。 */
      inPlace: true,
    };
    GAME.gatherList().push(rec);
    GAME.statBump('gathers', 1);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';
    var _genName136 = '';
    (s.generals || []).forEach(function (g3) { if (g3.id === gar.genId) _genName136 = g3.name; });
    GAME.log('⛏️ 驻军（' + (_genName136 || '无将') + '带队）' + troops + ' 兵开采 ' + tn
      + ' Lv' + rec.level + '（满 1 小时方有收成，24 小时封顶）');
    return { ok: true, msg: '开始采集：' + troops + ' 兵（1 小时后可收获）', gather: rec };
  };'''
d = d[:i] + new_sg + d[end+1:]

# ============================================================
# ④ finishGather：兵力归还段 → 三态（含老档旧式防御）
# ============================================================
old_fg = '''    /* 兵力与将领归还 —— v89.135：**驻军开采 = 原地开工**（兵从未离开驻军，无需归还）；
       将领带队那条老路照旧回城。 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (g.origin === 'garrison') {
      /* 原地开工：兵就在驻军里，什么都不用搬（v89.63 的"回驻军"段因此退役）。 */
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }'''
new_fg = '''    /* 兵力与将领归还 —— v89.136 三态：
       ① origin==='garrison' && inPlace（新式）：兵在驻军里，什么都不搬；
       ② origin==='garrison' && !inPlace（**老档旧式**：v89.135 前"从驻军抽兵"的记录）：
          兵在队里 → **回驻军**（溢出回城）。⚠ 这正是老板报「驻军丢失」的路径 ——
          v89.135 的"不搬"逻辑撞上旧式记录 = 兵凭空消失；此分支为**防御兜底**
          （正常已被 migrateLegacyGathers 迁移为 inPlace —— 防御只为"迁移未跑到"时保命）；
       ③ 其余（将领带队老记录）：兵回城。 */
    var city = GAME.cityById(g.cityId) || GAME.currentCity();
    if (g.origin === 'garrison') {
      if (!g.inPlace && GAME.wildGarrisonAdd) {
        var _bk136 = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId);
        if (_bk136 && _bk136.overflow) {
          for (var _ao136 in _bk136.overflow) {
            if (city) city.army[_ao136] = (city.army[_ao136] || 0) + _bk136.overflow[_ao136];
          }
        }
      }
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }'''
assert d.count(old_fg) == 1, 'finishGather 归还段锚点 = ' + str(d.count(old_fg))
d = d.replace(old_fg, new_fg)

# ============================================================
# ⑤ abandonGather：同款防御
# ============================================================
old_ab = '''    if (g.origin === 'garrison') {
      /* v89.135：原地开工 —— 兵从未离开驻军，撤回只是**停止开采**（无兵可还）。 */
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }'''
new_ab = '''    if (g.origin === 'garrison') {
      /* v89.136：新式（inPlace）= 兵从未离开驻军，召回只是停止开采；
         **老档旧式（!inPlace）** = 兵在队里 → 回驻军（溢出回城） ——
         与 finishGather 同一防御（老板「驻军丢失」的另一条路径）。 */
      if (!g.inPlace && GAME.wildGarrisonAdd) {
        var _bk136b = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId);
        if (_bk136b && _bk136b.overflow) {
          for (var _ao136b in _bk136b.overflow) {
            if (city) city.army[_ao136b] = (city.army[_ao136b] || 0) + _bk136b.overflow[_ao136b];
          }
        }
      }
    } else if (city) { for (var a in g.army) city.army[a] = (city.army[a] || 0) + g.army[a]; }'''
assert d.count(old_ab) == 1, 'abandonGather 锚点 = ' + str(d.count(old_ab))
d = d.replace(old_ab, new_ab)

# ============================================================
# ⑥ migrateLegacyGathers 插入（abandonGather 之后）
# ============================================================
anchor6 = '''  /* 按「由弱到强」抽调兵力（采集用；采集收益只看兵力总数，不看兵种）。
     这样玩家只需填一个数字，不必逐兵种分配。 */'''
assert d.count(anchor6) == 1, 'autoPickTroops 锚点 = ' + str(d.count(anchor6))
mig = '''  /* ============================================================
   * v89.136（老板报「驻军丢失」）—— **老档采集队迁移**（唯一出口）
   * ------------------------------------------------------------
   * 病根：v89.135 把"驻军开采"从「从驻军抽兵、收获时还兵」改成「原地开工、不抽不还」，
   *   但**两代记录形状相同**（都是 origin:'garrison' + army）——旧档里"兵在队里"的
   *   采集队，在新代码下点收获 = 兵不回驻军 = **兵力凭空消失**（老板实测「驻军丢失」）。
   * 修法（双保险）：
   *   ① 本函数（迁移）：读档/首 tick 把旧式记录**就地转为新形态** —— 兵按 noCap 加回驻军
   *      （它们本来就是从这个驻军的编制里抽出去的；野地易主则回城），标记 `inPlace:true`；
   *   ② finishGather / abandonGather 的防御分支：万一仍有旧式记录被结算，按旧口径还兵。
   * 幂等：处理完置 `s._gatherMigrated`（入档）—— 重复调用零成本。
   * ============================================================ */
  GAME.migrateLegacyGathers = function () {
    var s = GAME.state;
    if (!s || s._gatherMigrated) return 0;
    var list = GAME.gatherList();
    var n = 0;
    list.slice().forEach(function (g) {
      if (g.origin !== 'garrison' || g.inPlace) return;   /* 只转"兵在队里"的旧式 */
      var w = (GAME.map && GAME.map.wildAt) ? GAME.map.wildAt(g.x, g.y) : null;
      var city = GAME.cityById(g.cityId) || GAME.currentCity() || (s.cities || [])[0] || null;
      if (!w) {
        /* 野地已非我方：兵回城，该队移除（不丢兵） */
        if (city) { for (var a in (g.army || {})) city.army[a] = (city.army[a] || 0) + (g.army[a] || 0); }
        var ii = list.indexOf(g);
        if (ii >= 0) list.splice(ii, 1);
        GAME.log('🧭 老档迁移：采集队（' + g.x + ',' + g.y + '）所在野地已易主，兵力已回城');
        n++;
        return;
      }
      /* 兵回驻军（noCap：占领可超上限 —— 这些兵本来就驻在这里） */
      var bk = GAME.wildGarrisonAdd(g.x, g.y, g.army, g.cityId, { noCap: true });
      if (bk && bk.overflow) {
        for (var ao in bk.overflow) {
          if (city) city.army[ao] = (city.army[ao] || 0) + bk.overflow[ao];
        }
      }
      g.inPlace = true;
      n++;
    });
    s._gatherMigrated = true;   /* 放最后：中途异常则下次重试（已转的会跳过） */
    if (n) GAME.log('🧭 老档采集队迁移完成：' + n + ' 支（兵力已归驻军，采集照常 · 原地开工）', 'war');
    return n;
  };
''' + anchor6
d = d.replace(anchor6, mig)

# ============================================================
# ⑦ autoGatherTick 调用点：新签名
# ============================================================
old_call = "      var r2 = GAME.startGather(w.x, w.y, null, army, { from: 'garrison', cityId: w.garrison.cityId });"
new_call = "      var r2 = GAME.startGather(w.x, w.y, army, { cityId: w.garrison.cityId });   /* v89.136：新签名（唯一形态） */"
assert d.count(old_call) == 1, 'autoGatherTick 调用锚点 = ' + str(d.count(old_call))
d = d.replace(old_call, new_call)

# ============================================================
# 写后自检
# ============================================================
for sent in ['GAME.migrateLegacyGathers = function',
             'GAME.startGather = function (x, y, army, opts) {',
             'inPlace: true,',
             '⛔ v89.136 移除：`GAME.dispatchGather`',
             'if (!g.inPlace && GAME.wildGarrisonAdd) {']:
    assert d.count(sent) >= 1, '丢失哨兵: ' + sent
assert 'GAME.dispatchGather = function' not in d, 'dispatchGather 未删净'
assert 'startGather = function (x, y, genId' not in d, '旧签名残留'
# 花括号净差自检（改动前 vs 改动后必须一致 —— 字符串里的单侧花括号会干扰绝对值）
import re, io as _io
_before = _io.open(ROOT + 'js/domain.js', 'r', encoding='utf-8', newline='').read()
def _bd(x):
    return (len(re.findall(r'(?<![\^\\])\{', x)) - len(re.findall(r'(?<![\^\\])\}', x)))
print('braces diff before/after =', _bd(_before), _bd(d))
assert _bd(_before) == _bd(d), '花括号净差变了（改了非法结构？）'

wr('js/domain.js', d)
print('OK · domain.js', len(d))

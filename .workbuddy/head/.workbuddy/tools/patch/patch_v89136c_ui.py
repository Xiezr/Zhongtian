# -*- coding: utf-8 -*-
# v89.136 批0-c：ui.js —— openGatherModal/openGathers 退役 + 地块界面新增「采集」区 + 野地总览按钮清
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

u = rd('js/ui.js')

# ============================================================
# ① openGatherModal + openGathers 整段 → 墓碑
# ============================================================
s0 = u.find('  /* ============================================================\n   * 野地采集（v15）')
assert s0 > 0, '野地采集注释块未找到'
s1 = u.find('  /* 野外城池弹窗 */')
assert s1 > s0, '下一个函数标记未找到'
old_seg_len = s1 - s0
assert old_seg_len > 6000, '段落长度异常 ' + str(old_seg_len)
grave = '''  /* ⛔ v89.136 移除：`ui.openGatherModal`（派军采集）与 `ui.openGathers`（"野地采集（N/3队）"弹窗）。
     老板令：「'野地采集（0/3队）'这个弹窗界面不需要」「地块操作界面加一个采集操作
     （提供采集，收获按钮和采集进度显示），与地块操作，危险操作并列」——
     · 采集的**全部操作**收敛到地块界面（openLandModal 的「采集」区：开始采集 / 收获 / 召回 / 进度）；
     · 采集队上限的可见性：军务总览 ③ 采集队表头（N / maxActive 队）；
     · 派军采集（将领带队）并入「带将驻军原地开工」（GAME.startGather 唯一形态）；
     · 采集队总览的"定位"能力：地块界面即野地本体（无需定位跳转）。 */
'''
u = u[:s0] + grave + u[s1:]

# ============================================================
# ② 地块界面：ops 注释块更新
# ============================================================
old_note = '''    /* v89.83（老板「已占领的野地，其入口操作应只保留派驻」）——
       已占野地是「我的地盘」，入口只该有一件事：**派兵进去**。
       改前这里并排着 派军采集 / 派遣驻守 / 出兵 / 筑城 / 放弃 —— 五种入口各说各话，
       而其中「出兵」在"占领即驻军"之后已经与「派驻」同义（点了也是到了就驻下来），
       属于同一件事的两种说法。现在：
         无驻军 → 🛡️ 派驻（唯一入口）
         有驻军 → 🛡️ 增派驻军 · 📦 驻军开采（有可采之物且未在采） · 🏳️ 召回驻军
       「派军采集」（将领带队、有宝物加成）**没有删**，只是搬去了它该在的地方 ——
         采集面板（📦 野地采集）里新增的「派军采集」入口，那里才是采集队的总入口。 */'''
new_note = '''    /* v89.83（老板「已占领的野地，其入口操作应只保留派驻」）—— 已占野地是「我的地盘」。
       v89.136（老板「'野地采集（0/3队）'这个弹窗界面不需要」+「地块操作界面加一个采集操作」）：
       采集从"弹窗总入口"**收敛回地块界面**（见上方 gatherBox · 独立「采集」区）——
       开始采集 / 收获 / 召回三件事都在这块地上直接完成；
       本区（地块操作）只留：派驻 / 增派驻军 / 召回驻军 / 筑城。 */'''
assert u.count(old_note) == 1, 'v89.83 注释锚点 = ' + str(u.count(old_note))
u = u.replace(old_note, new_note)

# ============================================================
# ③ 地块界面：ops 删两按钮（查看采集进度 / 驻军开采）
# ============================================================
old_ops_head = '''    var ops = '<div class="op-zone"><div class="op-zone-t">地块操作</div><div class="op-row">' +
      (at ? '<button class="btn gold" data-action="open-gathers">📦 查看采集进度</button>' : '') +
      (garN
        ? ((gatherRes && !at && gar && gar.genId)
            ? '<button class="btn gold" data-action="wild-garrison-gather" data-x="' + x + '" data-y="' + y + '">📦 驻军开采</button>'
            /* v89.135（老板 5）：无将驻军不可开采 —— 就地说明原因 */
            : ((gatherRes && !at && gar && !gar.genId)
                ? '<span class="op-hint">开采须有将领带队驻守（再次「派驻」选一位将领补驻）</span>'
                : '')) +
          '<button class="btn" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 增派驻军</button>' +'''
new_ops_head = '''    var ops = '<div class="op-zone"><div class="op-zone-t">地块操作</div><div class="op-row">' +
      (garN
        ? '<button class="btn" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 增派驻军</button>' +'''
assert u.count(old_ops_head) == 1, 'ops 头锚点 = ' + str(u.count(old_ops_head))
u = u.replace(old_ops_head, new_ops_head)

# ============================================================
# ④ 地块界面：gatherBox 定义 + 组装行
# ============================================================
anchor_def = '''    var ops = '<div class="op-zone"><div class="op-zone-t">地块操作</div><div class="op-row">' +'''
gbox = '''    /* v89.136（老板）：「地块操作界面加一个采集操作（提供采集，收获按钮和采集进度显示），
       与地块操作，危险操作并列」——"野地采集"弹窗退役后，采集的全部操作收敛到这块地上。 */
    var gatherBox = '';
    if (gatherRes) {
      gatherBox = '<div class="op-zone"><div class="op-zone-t">采集</div>';
      if (at) {
        var gy136 = GAME.gatherYield(at);
        var gLeftH136 = Math.max(0, DATA.GATHER.minHours - gy136.hours);
        var gName136 = '（无将）';
        (GAME.state.generals || []).forEach(function (g0) { if (g0.id === at.genId) gName136 = g0.name; });
        gatherBox +=
          '<div class="attr"><span class="k">进度</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + gy136.pct + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '已采 ' + gy136.hours.toFixed(2) + ' / ' + DATA.GATHER.maxHours + ' 游戏时　' +
            (gy136.capReached ? '<span style="color:var(--gold-light);">已封顶</span>'
              : gy136.ready ? '<span style="color:var(--green-ok);">可收获</span>'
              : '<span style="color:var(--text-dim);">还需 ' + U.dur(gLeftH136 * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">预计收成</span><span class="v">' +
            U.numText(gy136.amount, 0) + ' ' + (RES_NAME[gy136.res] || gy136.res || '') +
            '　<span class="ui-sub">带队 ' + U.escape(gName136) + '</span>' +
          '</span></div>' +
          '<div class="op-row">' +
            '<button class="btn gold" data-action="gather-finish" data-id="' + at.id + '"' + (gy136.ready ? '' : ' disabled') + '>📦 收获</button>' +
            '<button class="btn" data-action="gather-abandon-ask" data-id="' + at.id + '">🏳️ 召回</button>' +
          '</div>';
      } else if (garN > 0 && gar && gar.genId) {
        gatherBox += '<div class="op-row">' +
          '<button class="btn gold" data-action="wild-garrison-gather" data-x="' + x + '" data-y="' + y + '">⛏️ 开始采集</button>' +
          '<span class="op-hint">由驻守将领带队 · 原地开工（驻军不移动）</span></div>';
      } else if (garN > 0) {
        gatherBox += '<div class="q-empty">驻军无将领 —— 补驻一位将领后即可开采（「增派驻军」时选将）</div>';
      } else {
        gatherBox += '<div class="q-empty">暂无驻军 —— 先「派驻」（须选带队将领）</div>';
      }
      gatherBox += '</div>';
    }

''' + anchor_def
assert u.count(anchor_def) == 1, 'ops 定义锚点 = ' + str(u.count(anchor_def))
u = u.replace(anchor_def, gbox)

# 组装行：stat + ops → stat + gatherBox + ops
old_join = '''      stat + ops +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>','''
new_join = '''      stat + gatherBox + ops +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>','''
assert u.count(old_join) == 1, '组装行锚点 = ' + str(u.count(old_join))
u = u.replace(old_join, new_join)

# ============================================================
# ⑤ 野地总览：删「采集队」按钮 + gN/gMax 定义
# ============================================================
old_wb = '''    var gN = GAME.gatherList().length, gMax = DATA.GATHER.maxActive;
    ui.openModal('''
new_wb = '''    ui.openModal('''
n5 = u.count(old_wb)
assert n5 == 1, '野地总览 gN 锚点 = ' + str(n5)
u = u.replace(old_wb, new_wb)

old_btn = '''      '<div style="text-align:center;margin-bottom:8px;">' +
        '<button class="btn sm' + (gN ? ' gold' : '') + '" data-action="open-gathers">📦 采集队 ' + gN + '/' + gMax + '</button>' +
        '</div>' +
'''
assert u.count(old_btn) == 1, '野地总览按钮锚点 = ' + str(u.count(old_btn))
u = u.replace(old_btn, '')

# ============================================================
# ⑥ 军务 ③ 采集队：撤回 → 召回（文案）
# ============================================================
old_ab = '''          '<button class="btn sm red" data-action="gather-abandon-ask" data-id="' + g.id + '">撤回</button></td>' +'''
new_ab = '''          '<button class="btn sm red" data-action="gather-abandon-ask" data-id="' + g.id + '">召回</button></td>' +'''
assert u.count(old_ab) == 1, '军务撤回锚点 = ' + str(u.count(old_ab))
u = u.replace(old_ab, new_ab)

# ---------- 写后自检 ----------
for sent in ['⛔ v89.136 移除：`ui.openGatherModal`', 'var gatherBox = \'\';', 'stat + gatherBox + ops +',
             '⛏️ 开始采集', '🏳️ 召回</button>']:
    assert u.count(sent) >= 1, '丢失哨兵: ' + sent
assert 'ui.openGatherModal = function' not in u, 'openGatherModal 未删净'
assert 'ui.openGathers = function' not in u, 'openGathers 未删净'
assert 'data-action="open-gathers"' not in u, 'open-gathers 按钮残留（ui）'

import re, io as _io
_before = _io.open(ROOT + 'js/ui.js', 'r', encoding='utf-8', newline='').read()
def _bd(x):
    return (len(re.findall(r'(?<![\^\\])\{', x)) - len(re.findall(r'(?<![\^\\])\}', x)))
print('braces diff before/after =', _bd(_before), _bd(u))
assert _bd(_before) == _bd(u), '花括号净差变了'

wr('js/ui.js', u)
print('OK · ui.js', len(u))

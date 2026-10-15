# -*- coding: utf-8 -*-
"""v89.144 老板 4 条 —— main.js 补丁（分段落盘 · 幂等守卫）
   ② 行内 [上限][清空]：exp-max 改语义（min(拥有, 额度−其他行)）+ 新增 exp-zero；
      两枚全局键（v74 起就有的那对）整条退役
   ④ exp-act-pick：空值 = 取消选择；选定后立刻 refreshView（live 刷新）
"""
import io

P = 'E:/Deepseekdb/js/main.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ② 删两枚全局键（整条退役）----------
rep(
"""      /* v74：全带 / 清空（只改输入框值，刷新仍走 updateExpMarch）
         v89.142（老板 6）：「全带」→「**上限**」—— 按 ui.expFillCapOf（唯一出口）的总人数额度，
         按兵种表顺序（= 表格行序）依次取 min(拥有, 剩余额度) 自动填入；
         额度为 null（不限：无校场等）时退回"全带"语义。 */
      case 'exp-fill-all': (function () {
        var c74 = GAME.currentCity();
        var cap142 = ui.expFillCapOf ? ui.expFillCapOf(c74, ui._expRes, ui._expMode) : null;
        var remain142 = (cap142 == null) ? null : cap142;
        Object.keys(DATA.TROOPS).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (!i74 || i74.disabled) return;
          var own74 = Number(i74.max) || 0;
          var n74 = own74;
          if (remain142 != null) n74 = Math.min(n74, remain142);
          i74.value = n74;
          if (remain142 != null) remain142 -= n74;
        });
        ui.updateExpMarch();
        if (cap142 != null) {
          var men142 = 0;
          Object.keys(DATA.TROOPS).forEach(function (id) {
            var i75 = document.getElementById('exp-' + id);
            if (i75) men142 += Number(i75.value) || 0;
          });
          ui.toast('已按上限填入（额度 ' + U.fmt(cap142) + ' 人 · 实填 ' + U.fmt(men142) + ' 人）');
        } else {
          ui.toast('已全带（本次不设上限）');
        }
      })(); break;
      case 'exp-clear-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = 0;
        });
        ui.updateExpMarch();
      })(); break;
""",
"""      /* ⛔ v89.144（老板 2）退役：标题栏那对**全局**兵力键（「全带→上限」逐行分配 + 全局清空）——
         两个操作挪进**每个兵种行**（行内上限 = 下面的 exp-max 改语义；行内清空 = exp-zero）。 */
""",
    '②-1 删两枚全局键',
    done_when='⛔ v89.144（老板 2）退役：标题栏那对**全局**兵力键')

# ---------- ② exp-max 改语义 + exp-zero ----------
rep(
"""      case 'exp-max': { var ei = document.getElementById('exp-' + el.dataset.troop); if (ei) ei.value = ei.max; break; }""",
"""      /* v89.144（老板 2）：行内「上限」—— 该兵种上限 = min(拥有, 总额度 − **其他行**已填)
         （唯一出口 ui.expTroopMaxOf；不限（无校场等）→ 拥有数）。
         分配顺序由玩家"点哪行"决定 —— 不再有全局一键分配（老板明确不要强兵优先之类约定）。 */
      case 'exp-max': {
        var ei = document.getElementById('exp-' + el.dataset.troop);
        if (ei) {
          var m144 = ui.expTroopMaxOf(el.dataset.troop, GAME.currentCity(), ui._expMode);
          ei.value = m144;
          ui.updateExpMarch();
          ui.toast('「' + ((DATA.TROOPS[el.dataset.troop] || {}).name || el.dataset.troop)
            + '」按上限填入 ' + U.fmt(m144) + ' 人');
        }
        break;
      }
      /* v89.144（老板 2）：行内「清空」—— 只清该兵种这一行（不影响其他兵种） */
      case 'exp-zero': {
        var zi = document.getElementById('exp-' + el.dataset.troop);
        if (zi) { zi.value = 0; ui.updateExpMarch(); }
        break;
      }""",
    '②-2 exp-max 改语义 + exp-zero',
    done_when="case 'exp-zero': {")

# ---------- ④ exp-act-pick：空值 + live 刷新 ----------
rep(
"""      case 'exp-act-pick': ui._actPick = { grp: el.dataset.grp || '', idx: Number(el.value) || 0 }; break;""",
"""      /* v89.144（老板 4）：选定后**立刻 live 刷新**（下方「当前目标 / 进入军事行动」随之更新）；
         空首项 = 取消选择（该行选回空 → 清空 _actPick）；
         在**另一行**选择 → 原来那一行自动回到空（_actPick 只有一份，渲染读同一出口）。 */
      case 'exp-act-pick': {
        var g144 = el.dataset.grp || '';
        if (el.value === '') {
          if (ui._actPick && ui._actPick.grp === g144) ui._actPick = null;
        } else {
          ui._actPick = { grp: g144, idx: Number(el.value) || 0 };
        }
        GAME.refreshView();
        break;
      }""",
    '④ exp-act-pick 空值+live',
    done_when='var g144 = el.dataset.grp')

save('main.js 全部')

print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))

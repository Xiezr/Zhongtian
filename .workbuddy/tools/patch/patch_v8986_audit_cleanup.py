# -*- coding: utf-8 -*-
"""v89.86 顺手修复 · audit 两告警（均由 v89.4x~8x 未提交改动引入，非本批新增）
   ① ui.openTacticModal 重复定义：v89.59 的"战术预设管理"占了同名函数位，
      把 v26 的"逐兵种编辑器"整个盖掉 —— 「逐兵种调整」按钮实际打不开编辑器。
      修法：预设管理更名 ui.openTacticSets，三个该去预设的调用点改指新名。
   ② main.js 注释里出现 data-action="exp-mode" 字面量 → audit 误报孤儿按钮。
      修法：改写注释，不再含该字面模式。
"""
import io
import os
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ① 预设管理更名
edit(UI, r"""  ui.openTacticModal = function () {
    var list = ui.tacticSetsOf();""",
     r"""  /* v89.86（顺手修复）：本函数原名为 `ui.openTacticModal` —— 与 v26 的「逐兵种编辑器」
     同名，后定义把前者整个盖掉，「逐兵种」入口实际打开的是本页（一直打不开编辑器）。
     更名 `ui.openTacticSets`（战术**预设**管理），与逐兵种编辑器各归各位；
     改名的三个调用点：main.js 的 open-tactic-set / expSaveTactic / expDeleteTactic。 */
  ui.openTacticSets = function () {
    var list = ui.tacticSetsOf();""",
     'audit · 预设管理更名 openTacticSets')

edit(UI, r"""    ui.toast('已存战术：' + nm);
    ui.openTacticModal();
  };""",
     r"""    ui.toast('已存战术：' + nm);
    ui.openTacticSets();      /* v89.86：预设管理（原同名覆盖问题见 openTacticSets 注释） */
  };""",
     'audit · expSaveTactic 改指新名')

edit(UI, r"""    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticModal();""",
     r"""    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticSets();   /* v89.86：预设管理 */""",
     'audit · expDeleteTactic 改指新名')

edit(MA, r"""      case 'open-tactic-set': {
        ui._tacSnap = U.deep(GAME.state.tactics || {});
        ui.openTacticModal();
        break;
      }""",
     r"""      case 'open-tactic-set': {
        ui._tacSnap = U.deep(GAME.state.tactics || {});
        ui.openTacticSets();      /* v89.86：改指预设管理（原同名覆盖导致「逐兵种」打不开编辑器） */
        break;
      }""",
     'audit · open-tactic-set 改指新名')

# ② 注释去字面量
edit(MA, r"""      /* v89.58：出征方式已改下拉框（change 事件在 openExpModal 内挂），旧 data-action="exp-mode" 退场 */""",
     r"""      /* v89.58：出征方式已改下拉框（change 事件在 openExpModal 内挂），旧「exp-mode」动作退场
         （v89.86：本行不再写字面 data-action 模式 —— audit 的孤儿按钮扫描不剥注释，会被误报） */""",
     'audit · 注释去字面量')

u = read(UI)
print('openTacticModal 定义数 = %d（应为 1）' % u.count('ui.openTacticModal = function'))
print('openTacticSets 出现 = %d 次' % u.count('openTacticSets'))

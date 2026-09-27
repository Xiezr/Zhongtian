# -*- coding: utf-8 -*-
# v89.156 patch A：ui.js —— 弹窗层级栈修复（live 重绘不压栈 / sameAs 接线 / 弹栈即新数据）
# 病根：openWilds 标题含动态数字（N/M），数据变化 → live 每秒重绘被"标题不同=进下级"
#       误判压栈 → 关闭键每点一次只弹一层（旧快照含已删行）→ "闪烁、行又出现、点几下才关"。
import io

P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

# ---------- ① _liveRedraw 标志声明 ----------
OLD1 = u"""  ui._liveReopen = null;
  ui._modalCloseAll = false;"""
NEW1 = u"""  ui._liveReopen = null;
  ui._modalCloseAll = false;
  /* v89.156（老板 1 · debug）：live 重绘**进行中**标志 —— 期间 openModal 一律走
     "同级 replace"，绝不判"进下级"压栈。
     病根：`openWilds` 的标题含动态数字「附属野地（N/M）」—— 放弃一片后 N 变，
     live 每秒重绘时标题与当前不同 → 被当成"进下级"**每秒压一层** →
     关闭键每点一次只弹一层（弹出的还是**旧快照**，含已删除的行）→
     玩家看到"闪烁一下维持在界面中、被删的行又出现、要点几下才关掉"。
     同类受害面：一切标题含动态数据的 live 面板（行军队列（N）等）。 */
  ui._liveRedraw = false;"""
c = s.count(OLD1)
assert c == 1, 'A1 count=' + str(c)
s = s.replace(OLD1, NEW1)
done.append('A1 _liveRedraw 声明')

# ---------- ② openModal：live 重绘 / sameAs 不压栈 ----------
OLD2 = u"""      /* 标题不同 = 进下级 → 当前层压栈（同级刷新同一标题，不入栈） */
      if (title && curTitle && title !== curTitle) {"""
NEW2 = u"""      /* 标题不同 = 进下级 → 当前层压栈（同级刷新同一标题，不入栈）。
         v89.156：两个例外 ——
           · `o.sameAs`（v89.117 立的旗，此前**从未被消费** = 空承诺，本轮接线）；
           · `ui._liveRedraw`（live 每秒重绘：标题里的动态数字变了 ≠ 进下级）。 */
      if (title && curTitle && title !== curTitle && !o.sameAs && !ui._liveRedraw) {"""
c = s.count(OLD2)
assert c == 1, 'A2 count=' + str(c)
s = s.replace(OLD2, NEW2)
done.append('A2 openModal 守卫')

# ---------- ③ closeModal 弹栈：立即按新数据重绘（若该层 live） ----------
OLD3 = u"""        ui._modalTitle = lv.title;
        ui._modalMarksRestore(lv.marks);
        ui._liveReopen = lv.live || null;       /* v89.135：回退恢复该层的实时刷新 */
        ui._modalCloseAll = lv.closeAll || false;
        ui._paintModalX();
        ui._visible = true;
        return;"""
NEW3 = u"""        ui._modalTitle = lv.title;
        ui._modalMarksRestore(lv.marks);
        ui._liveReopen = lv.live || null;       /* v89.135：回退恢复该层的实时刷新 */
        ui._modalCloseAll = lv.closeAll || false;
        ui._paintModalX();
        ui._visible = true;
        /* v89.156（老板 1）：弹栈恢复的是**旧快照**（下级改过的数据还是旧值 —— 例如
           放弃一片野地后，回退那一屏还画着已删的那一行）。若该层是 live 层，
           立即重绘一次（走"同级 replace"不闪）：直接显示新数据，
           不再"闪一下旧快照、被删的行又出现"。 */
        if (ui._liveReopen) {
          try { ui._liveRedraw = true; ui._liveReopen(); }
          catch (e2) { /* 重绘失败：保留旧快照（与 v89.117 的诚实缺口同口径） */ }
          finally { ui._liveRedraw = false; }
        }
        return;"""
c = s.count(OLD3)
assert c == 1, 'A3 count=' + str(c)
s = s.replace(OLD3, NEW3)
done.append('A3 弹栈即新数据')

# ---------- ④ liveModalTick：回调期间置 _liveRedraw ----------
OLD4 = u"""    var snap = ui._liveSnap();
    try { ui._liveReopen(); } catch (e1) { ui._liveReopen = null; return; }
    ui._liveRestore(snap);"""
NEW4 = u"""    var snap = ui._liveSnap();
    /* v89.156：重绘期间置 _liveRedraw —— 标题里的动态数字变化不得被当成"进下级"压栈 */
    try { ui._liveRedraw = true; ui._liveReopen(); }
    catch (e1) { ui._liveRedraw = false; ui._liveReopen = null; return; }
    ui._liveRedraw = false;
    ui._liveRestore(snap);"""
c = s.count(OLD4)
assert c == 1, 'A4 count=' + str(c)
s = s.replace(OLD4, NEW4)
done.append('A4 liveModalTick 标志')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js patch A done:', done, 'len', orig, '->', len(s))

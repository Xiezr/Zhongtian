# -*- coding: utf-8 -*-
# v89.156 patch B（幂等版）：放弃野地改「一击执行」——上膛式（_wildArm154 / -arm）整条退役
# 老板原话：「在附属野地界面，点击放弃，弹窗出来的放弃按钮点击直接执行即可，本身已经是 2 次确认了。」
# 幂等规则：每段 = 「旧锚点在 → 替换；旧锚点不在但新特征在 → 跳过；都不在 → 报错」。
import io

def seg(s, old, new, tag, marks=None):
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        return s.replace(old, new), tag + ' OK'
    for mk in (marks or []):
        if mk in s:
            return s, tag + ' skip（已落盘）'
    raise AssertionError(tag + ' anchor missing & new mark missing')

# ---------- ① ui.js ----------
P = 'E:/Deepseekdb/js/ui.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
done = []

s, t = seg(s,
  u"""  ui.openAbandonWildAsk = function (x, y) {
    ui._wildArm154 = null;      /* v89.154：打开即复位 —— 关窗再开必须重新上膛（防误触） */
    var w = GAME.map.wildAt(x, y);""",
  u"""  ui.openAbandonWildAsk = function (x, y) {
    /* v89.156（老板 1）：上膛式（连点两次）退役 —— 老板令「弹窗出来的放弃按钮点击
       直接执行即可，本身已经是 2 次确认了」（操作列一次 + 本确认窗一次）。 */
    var w = GAME.map.wildAt(x, y);""",
  'B1', [u'上膛式（连点两次）退役'])
done.append(t)

s, t = seg(s,
  u"""        '。<b>此操作不可撤销</b> —— 确认按钮需连点两次。</div>' +""",
  u"""        '。<b>此操作不可撤销</b>。</div>' +""",
  'B2', [u"'。<b>此操作不可撤销</b>。</div>' +"])
done.append(t)

s, t = seg(s,
  u"""        '<button class="btn red" data-action="wild-abandon-arm" data-x="' + x + '" data-y="' + y + '">确定放弃</button>' +""",
  u"""        '<button class="btn red" data-action="wild-abandon-do" data-x="' + x + '" data-y="' + y + '">确定放弃</button>' +""",
  'B3', [u'data-action="wild-abandon-do" data-x='])
done.append(t)

s, t = seg(s,
  u"""        /* v89.154（老板 1）：「附属野地界面，操作栏中增加一个放弃野地按钮，按钮应该采用防误触设计」——
           防误触四层：① 红色 + 与正向动作留间距（.wild-drop，可换行分组）
           ② 只触发二次确认窗（wild-abandon-ask，绝不一键执行）
           ③ 确认窗内红按钮**上膛式**（wild-abandon-arm 连点两次才执行，与弃城同规 §89.138）
           ④ 确认窗明写「不可撤销」+ 逐项列出失去/撤回什么。 */""",
  u"""        /* v89.154（老板 1）：「附属野地界面，操作栏中增加一个放弃野地按钮，按钮应该采用防误触设计」——
           防误触三层（v89.156 收敛）：① 红色 + 与正向动作留间距（.wild-drop，可换行分组）
           ② 只触发二次确认窗（wild-abandon-ask，绝不一键执行）
           ③ 确认窗明写「不可撤销」+ 逐项列出失去/撤回什么，窗内红键**一击执行**
              （v89.156 老板：「本身已经是 2 次确认了」—— 上膛式退役）。 */""",
  'B4', [u'防误触三层（v89.156 收敛）'])
done.append(t)

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('ui.js patch B:', done, 'len', orig, '->', len(s))

# ---------- ② main.js ----------
PM = 'E:/Deepseekdb/js/main.js'
m = io.open(PM, encoding='utf-8', newline='').read()
morig = len(m)

m, t = seg(m,
  u"""      /* v89.154（老板 1）：放弃野地改**上膛式**（与弃城同规）——
         第一次点击只"上膛"（变文案 + toast 警告），再点一次才执行。
         触发端分布在：地块面板「危险操作」区 + 附属野地操作列（v89.154 新增）。 */
      case 'wild-abandon-arm': {
        var _wxy154 = el.dataset.x + ',' + el.dataset.y;
        if (ui._wildArm154 !== _wxy154) {
          ui._wildArm154 = _wxy154;
          el.innerHTML = '⚠️ 再点一次 —— 放弃该野地（不可撤销）';
          ui.toast('⚠️ 危险操作：再点一次才真的放弃');
          break;
        }
        ui._wildArm154 = null;
        var wa = GAME.doAbandonWild(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wa.msg);
        ui.closeModal();
        GAME.refreshAll();
        break;
      }""",
  u"""      /* v89.156（老板 1）：「弹窗出来的放弃按钮点击直接执行即可，本身已经是 2 次确认了」——
         上膛式（连点两次）整条退役：操作列「🗑️ 放弃」→ 二次确认窗 → 窗内红键**一击执行**。
         `-arm` → `-do` 改名收敛回 §14.1 的「xxx-ask → xxx-do」两段式；
         旧 `ui._wildArm154` 标记随本需求退役（零残留）。 */
      case 'wild-abandon-do': {
        var wa = GAME.doAbandonWild(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wa.msg);
        ui.closeModal();
        GAME.refreshAll();
        break;
      }""",
  'B5', [u"case 'wild-abandon-do': {"])
print('main.js patch B:', t, 'len', morig, '->', len(m))
io.open(PM, 'w', encoding='utf-8', newline='').write(m)

# ---------- 自检（可执行形态 —— 注释里的名字不算残留，§68.2） ----------
chi = io.open(P, encoding='utf-8', newline='').read()
chm = io.open(PM, encoding='utf-8', newline='').read()
assert u'_wildArm154 =' not in chi and u'_wildArm154 !==' not in chi
assert u'_wildArm154 =' not in chm and u'_wildArm154 !==' not in chm
assert u'wild-abandon-arm"' not in chi and u"case 'wild-abandon-arm'" not in chm
assert chi.count(u'data-action="wild-abandon-do"') == 1
assert chm.count(u"case 'wild-abandon-do': {") == 1
print('SELF-CHECK PASS（-arm 零执行残留 · -do 各一处）')

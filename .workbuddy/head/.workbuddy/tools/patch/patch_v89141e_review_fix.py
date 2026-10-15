# -*- coding: utf-8 -*-
# v89.141 批 D（复核修复）：
#   · domain.js：doAbandonWild 误引已退役的 doAbandonGather（真 bug · audit ⑥ 抓出）
#   · main.js：city-abandon-do 残余 case 删（v89.138 两段确认后已无触发点）
#   · main.js：bulk-use-ask case 删（触发在 contextmenu 委托 · 直调 ui 出口，不留无触发 case）
import io, os

ROOT = 'E:/Deepseekdb/'
ok = []

def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:40]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(rel + ':' + tag)
    assert '\r\n' not in s, rel + ' 行尾混入 CRLF'
    tmp = p + '.tmp141'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    assert len(chk) == len(s)
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))

patch('js/domain.js', [
    ("""    var gth = GAME.gatherAt(x, y);
    if (gth) {
      back += gth.troops || 0;
      GAME.doAbandonGather(gth.id);
    }""",
     """    var gth = GAME.gatherAt(x, y);
    if (gth) {
      back += gth.troops || 0;
      /* ⛔ v89.141（复核修复）：此处曾引 `GAME.doAbandonGather` —— 那是 v89.138
         已退役的提交端（main.js 有墓碑），**运行时 TypeError**（放弃野地时若恰好
         有采集记录就崩）；正确出口是域侧保留的 `abandonGather`（单纯停采，
         满 1h 先自动收获的语义在 doWildWithdraw 主路径已处理）。 */
      GAME.abandonGather(gth.id);
    }""",
     'doAbandonWild 修复'),
])

patch('js/main.js', [
    # ① city-abandon-do 残余 case（v89.138 两段确认后执行已并入 arm 分支）
    ("""      case 'city-abandon-do': {
        var acR = GAME.abandonCity(el.dataset.city);
        ui.toast(acR.msg);
        if (acR.ok) { ui.closeModal(); GAME.refreshAll(); }
        else { ui.openAbandonCityAsk(el.dataset.city); }
        break;
      }""",
     """      /* ⛔ v89.141（复核）：`city-abandon-do` 残余 case 删除 ——
         v89.138 弃城改两段确认后，执行已并入 `city-abandon-arm`（第二次点击），
         本 case 在界面查无触发点（audit ② 报"不可达分支"）。 */""",
     'city-abandon-do 删'),

    # ② bulk-use-ask：触发在 contextmenu 委托（无 data-action 触发点）→ 直调 ui 出口
    ("""    document.addEventListener('contextmenu', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('[data-bulk]') : null;
      if (!t) return;
      e.preventDefault();
      GAME.action('bulk-use-ask', t);
    });""",
     """    document.addEventListener('contextmenu', function (e) {
      var t = (e.target && e.target.closest) ? e.target.closest('[data-bulk]') : null;
      if (!t) return;
      e.preventDefault();
      /* 直调 ui 出口（右键是**补充入口**、格子自身仍带 use-bag-item 动作）——
         不另立 `bulk-use-ask` case（它永远没有 data-action 触发点，audit 会报不可达）。 */
      G.ui.openBulkUse(t.dataset.key);
    });""",
     'contextmenu 直调'),
    ("""      /* v89.141（老板 0 · 按建议执行）：宝物整叠使用（右键开小窗 → 一次用 N 个） */
      case 'bulk-use-ask': ui.openBulkUse(el.dataset.key); break;
      case 'bulk-use-do': {""",
     """      /* v89.141（老板 0 · 按建议执行）：宝物整叠使用（入口在 contextmenu 委托 ·
         执行仍走统一分发：数量框 → doBagUse） */
      case 'bulk-use-do': {""",
     'bulk-use-ask 删'),
])

print('✅ 批 D 完成：' + ' / '.join(ok))

# -*- coding: utf-8 -*-
"""v89.194 批次B：口径变更的判据跟进（autoUpgrade 资源类判定 + costJewelText 复用）"""
import io

R = 'E:/Deepseekdb/'
DOM = R + 'js/domain.js'
UI = R + 'js/ui.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag + '（已落盘）'); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + '（期望 ' + str(cnt) + '）'
    s = s.replace(old, new)
    wr(path, s)
    s2 = rd(path)
    assert s2.count(mark) >= 1, tag + ' 写后自检失败：mark 未落盘'
    print('[ok] ' + tag)

# ─────────────────────────────────────────────
# B1. domain.js：autoUpgrade 的"资源类失败"判定跟进新文案
# ─────────────────────────────────────────────
B1_OLD = "      if (r && !r.ok && /不足/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };"
B1_NEW = """      /* v89.194：缺料提示统一走 costLackMsg（"缺 粮食 …"/"缺 金 …"）——资源类判定跟进；
         旧的"…不足"（珠宝不足 / 本城资源不足 / 可征人口不足等）一并兼容。 */
      if (r && !r.ok && /(不足|缺 )/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };"""
rep(DOM, 'B1 autoUpgrade 资源判据', B1_OLD, B1_NEW, 'if (r && !r.ok && /(不足|缺 )/.test(r.msg)')

# ─────────────────────────────────────────────
# B2. ui.js：costJewelText 支持 lackOnly（costLackMsg 复用同一出口，格式统一）
# ─────────────────────────────────────────────
B2_OLD = """  GAME.costJewelText = function (cost) {
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var out = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      out.push(jn + ' ' + (inv[jid] || 0) + '/' + need[jid]);
    }
    return out.join('　');"""
B2_NEW = """  /* 造价里的珠宝清单（唯一出口）—— v89.194：加 lackOnly 参数
     （costLackMsg 的缺料提示复用同一出口，不再自写第二份遍历）；格式统一为
     '💎名 ×N（持 M）'。 */
  GAME.costJewelText = function (cost, lackOnly) {
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var out = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var have = inv[jid] || 0;
      if (lackOnly && have >= need[jid]) continue;
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      out.push('💎' + jn + ' ×' + need[jid] + '（持 ' + have + '）');
    }
    return out.join('　');"""
rep(UI, 'B2 costJewelText lackOnly', B2_OLD, B2_NEW, 'GAME.costJewelText = function (cost, lackOnly) {')

# ─────────────────────────────────────────────
# B3. domain.js：costLackMsg 的珠宝段改调 costJewelText
# ─────────────────────────────────────────────
B3_OLD = """    var need = GAME.jewelNeedOf(cost);
    for (var jid in need) {
      var have = ((s0.items || {})[jid] || 0);
      if (have < need[jid]) {
        var jn = jid;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
        lacks.push('💎' + jn + ' ×' + need[jid] + '（持 ' + have + '）');
      }
    }
    if (!lacks.length) return '';"""
B3_NEW = """    /* 珠宝段复用 costJewelText（唯一出口 · lackOnly 只列缺的） */
    var jt194 = GAME.costJewelText ? GAME.costJewelText(cost, true) : '';
    if (jt194) lacks.push(jt194);
    if (!lacks.length) return '';"""
rep(DOM, 'B3 costLackMsg 珠宝段复用', B3_OLD, B3_NEW, 'var jt194 = GAME.costJewelText ? GAME.costJewelText(cost, true) : \'\';')

print('\n批次 B 全部完成。')

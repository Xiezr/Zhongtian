# -*- coding: utf-8 -*-
"""v89.197 批次E：全局悬停规范（老板 5）
① ui.js：tipFor 加 [title] 兜底 —— 全站 117 处原生 title 统一走 #tip-layer（规格一致）
② main.js：mouseover 摘 title（防原生双显）/ mouseout 恢复
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(p, tag, old, new, mark, cnt=1):
    s = rd(p)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + ' (expect ' + str(cnt) + ')'
    wr(p, s.replace(old, new))
    print('[ok] ' + tag)

# ══════════ E1：ui.tipFor 加 title 兜底 ══════════
rep('js/ui.js', 'E1 tipFor title 兜底',
    u"""  ui.tipFor = function (node) {
    if (!node || !node.closest) return null;
    var host = node.closest('[data-tip-el]');
    if (host) {
      var src = host.querySelector('.tip-src, .bag-tip, .tcard-tip');
      if (src && (src.textContent || '').trim()) return { html: src.innerHTML, anchor: host };
    }
    var t = node.closest('[data-tip]');
    if (t) {
      var txt = t.getAttribute('data-tip') || '';
      if (txt) return { html: U.escape(txt), anchor: t };
    }
    return null;
  };""",
    u"""  ui.tipFor = function (node) {
    if (!node || !node.closest) return null;
    var host = node.closest('[data-tip-el]');
    if (host) {
      var src = host.querySelector('.tip-src, .bag-tip, .tcard-tip');
      if (src && (src.textContent || '').trim()) return { html: src.innerHTML, anchor: host };
    }
    var t = node.closest('[data-tip]');
    if (t) {
      var txt = t.getAttribute('data-tip') || '';
      if (txt) return { html: U.escape(txt), anchor: t };
    }
    /* ============================================================
     * v89.197（老板 5）：**原生 title 兜底升级** —— 全站 title 统一走 #tip-layer
     *   （规格一致：同宽域/同字号/同配色，不再"浏览器原生小方框"与浮层两套观感）。
     * 防"原生 + 浮层"双显：main.js 的委托在悬停时把 title 摘到 data-title-bk、
     *   移开时恢复（本函数只负责读出内容；摘/恢复都在委托里，行为集中一处）。
     * 已摘（悬停中）时走 data-title-bk 分支 —— 悬停期间浮层内容稳定不闪。
     * ============================================================ */
    var n = node.closest('[title]');
    if (n) {
      var txt2 = n.getAttribute('title') || '';
      if (txt2) return { html: U.escape(txt2), anchor: n, native: true };
    }
    var n2 = node.closest('[data-title-bk]');
    if (n2) {
      var txt3 = n2.getAttribute('data-title-bk') || '';
      if (txt3) return { html: U.escape(txt3), anchor: n2, native: true };
    }
    return null;
  };""",
    'v89.197（老板 5）：**原生 title 兜底升级**')

# ══════════ E2：main.js 委托摘/恢复 ══════════
rep('js/main.js', 'E2a mouseover 摘 title',
    u"""    document.addEventListener('mouseover', function (e) {
      var tip = GAME.ui.tipFor(e.target);
      if (tip) GAME.ui.tipShow(tip.html, tip.anchor);
      else GAME.ui.tipHide();
    });""",
    u"""    document.addEventListener('mouseover', function (e) {
      var tip = GAME.ui.tipFor(e.target);
      if (tip) {
        /* v89.197（老板 5）：title 兜底升级 —— 悬停时把原生 title 暂存到
           data-title-bk 后摘除（防"浏览器原生提示 + #tip-layer 浮层"双显，
           且原生 title 约 1 秒后才出现，会盖在浮层上方）；mouseout 负责恢复。 */
        if (tip.native && tip.anchor.getAttribute && tip.anchor.getAttribute('title')) {
          tip.anchor.setAttribute('data-title-bk', tip.anchor.getAttribute('title'));
          tip.anchor.removeAttribute('title');
        }
        GAME.ui.tipShow(tip.html, tip.anchor);
      } else GAME.ui.tipHide();
    });""",
    'E2a title 兜底升级')

rep('js/main.js', 'E2b mouseout 恢复',
    u"""    document.addEventListener('mouseout', function (e) {
      if (!GAME.ui.tipFor(e.target)) return;
      /* 移进同一浮层源的子元素不算离开 */
      if (e.relatedTarget && GAME.ui.tipFor(e.relatedTarget)) return;
      GAME.ui.tipHide();
    });""",
    u"""    document.addEventListener('mouseout', function (e) {
      /* v89.197（老板 5）：离开"暂存过 title"的元素 → 恢复原生 title
         （只在该元素确实没有新 title 时写回 —— 悬停期间被代码更新过 title 的，以新的为准）。 */
      var bkEl = (e.target.closest) ? e.target.closest('[data-title-bk]') : null;
      if (bkEl && !(e.relatedTarget && bkEl.contains && bkEl.contains(e.relatedTarget))) {
        var bkV = bkEl.getAttribute('data-title-bk');
        if (bkV != null && !bkEl.getAttribute('title')) bkEl.setAttribute('title', bkV);
        bkEl.removeAttribute('data-title-bk');
      }
      if (!GAME.ui.tipFor(e.target)) return;
      /* 移进同一浮层源的子元素不算离开 */
      if (e.relatedTarget && GAME.ui.tipFor(e.relatedTarget)) return;
      GAME.ui.tipHide();
    });""",
    'E2b：离开"暂存过 title"的元素')

print('批次 E 完成')

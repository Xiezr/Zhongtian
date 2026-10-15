# -*- coding: utf-8 -*-
"""v89.117 补丁 A —— 弹窗**层级栈** + 同级重绘去闪（老板需求 6）

病根（探针 probe_v89117_flicker.js 实测）：
  ① 同级重绘 = `root.innerHTML = ...` **整个 mask 被销毁重建**
     → mask 的入场动画（mModalIn .13s / mModalRise .15s）每次重播 = 视觉闪烁；
     实测连点 4 次换页 → mask 被重建 4 次。
  ② 没有层级概念：从 A 面板点进 B 面板，B 关闭 = 清空 modal-root
     → 直接落到城池视图（老板：「关闭的时候不回到上一级界面」）。
     实测：铁匠铺 Lv3 →「套装效果一览」→ 关闭 → 弹窗全没了。

改法（**不改上百个调用点**）：
  · 已开窗时**只换内容**（mask 与 .modal 元素保留 → 动画不重播、无闪烁）；
  · 进下级 = 把当前层压栈（HTML 快照 + 尺寸类 + 标题 + 认窗标记），关闭时弹栈；
  · 同级/下级判别 = **标题相同即同级刷新**（.m-title / .gold-heading 去标签文本）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点匹配 %d 次' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ---------------------------------------------------------------- ui.js
u = load('js/ui.js')

edit('js/ui.js', """  ui.openModal = function (html, opts) {
    var root = $('#modal-root');
    var o = (typeof opts === 'string') ? { size: opts } : (opts || {});
    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
    /* ============================================================
     * v89.114（老板「所有弹窗型窗口（比如建筑）的关闭按钮不再在底部显示，
     *   改为弹窗右上角的关闭按钮（圆形套个叉叉）」）""",
     """  /* ============================================================
   * v89.117（老板「一些弹窗界面在点击操作时会闪烁…多层点击进入下级界面之后，
   *   关闭的时候不回到上一级界面，而是会到城池内界面」）
   * ------------------------------------------------------------
   * 探针实测（probe_v89117_flicker.js）两个机制性病根：
   *   ① **闪烁**：同级重绘走的是 `root.innerHTML = …` —— **整个 mask 被销毁重建**，
   *      mask 的入场动画（mModalIn .13s + mModalRise .15s）每次重播；
   *      实测"连点 4 次换页/换类" → mask 被重建 4 次（4 次闪）。
   *   ② **层级丢失**：没有"层"的概念 —— 从 A 面板点进 B 面板，B 一关就清空
   *      modal-root，直接落到城池视图（实测：铁匠铺 → 套装效果 → 关闭 → 弹窗全没）。
   *
   * 改法（**不动上百个调用点**，判别放在唯一入口）：
   *   · 已开窗时**只换内容**：mask 与 .modal 元素**保留**（元素还在 → 动画不重播）；
   *     只有"从无到有"那一次才建 mask 并播入场动画；
   *   · **进下级** = 把当前层压栈（HTML 快照 + 尺寸类 + 标题 + 认窗标记），
   *     `closeModal` 弹栈回上一级；
   *   · 同级/下级的判别 = **标题**（`.m-title` / `.gold-heading` 去标签后的文本）：
   *     相同 → 同级刷新（replace，不入栈）；不同 → 进下级（push）。
   *     这样换页/换类/改数值这类重绘天然是 replace，而"点进详情"天然是 push。
   *
   * ⚠️ 诚实缺口：压栈的是上一级的 **HTML 快照**，不是"重新调用它的开启函数" ——
   *   若下级改了上一级要显示的数据（例如在详情里拆解了装备），回退时那一屏的
   *   数字仍是旧的（关窗后 `GAME.refreshAll` 会刷新底下的视图，但弹窗快照不重算）。
   *   要"回退即重算"得让每个开启函数自带重开钩子（opts.reopen），本轮未做。
   * ============================================================ */
  ui._modalStack = [];
  ui._modalTitle = null;
  /* 弹窗标题（去标签、压空白）：同级/下级判别的唯一出口。
     `.m-title` 是新式三段式；`.gold-heading` 是老式（80 处）——两者都认。 */
  ui.modalTitleOf = function (html) {
    var s = String(html == null ? '' : html);
    var m = /class="m-title"[^>]*>([\\s\\S]*?)<\\/span>/.exec(s);
    if (!m) m = /class="gold-heading"[^>]*>([\\s\\S]*?)<\\/div>/.exec(s);
    if (!m) return '';
    return m[1].replace(/<[^>]*>/g, '').replace(/[\\s\\u3000]+/g, ' ').trim();
  };
  /* 认窗标记（关闭时会清的那几个 `ui._*`）—— 压栈/弹栈时一起存还原 */
  ui._modalMarks = function () {
    return { kind: ui._modalKind || null, grid: ui._curGrid || null,
      npc: ui._attackNpc || null, wild: ui._attackWild || null };
  };
  ui._modalMarksRestore = function (m) {
    if (!m) return;
    ui._modalKind = m.kind; ui._curGrid = m.grid;
    ui._attackNpc = m.npc; ui._attackWild = m.wild;
  };
  /* 右上角 × 的提示语：有上级时说明"返回"，顶层时是"关闭" */
  ui._paintModalX = function () {
    var x = document.querySelector('#modal-root .modal-x');
    if (!x) return;
    var st = ui._modalStack || [];
    var top = st.length ? st[st.length - 1] : null;
    x.setAttribute('title', top ? ('返回《' + (top.title || '上一级') + '》') : '关闭');
  };

  ui.openModal = function (html, opts) {
    var root = $('#modal-root');
    var o = (typeof opts === 'string') ? { size: opts } : (opts || {});
    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
    /* ============================================================
     * v89.114（老板「所有弹窗型窗口（比如建筑）的关闭按钮不再在底部显示，
     *   改为弹窗右上角的关闭按钮（圆形套个叉叉）」）""",
     'openModal 注释头')

edit('js/ui.js', """    var shelled = /class="m-head"/.test(body);
    root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
      '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn + '</div></div>';
    root._visible = true;
  };""",
     """    var shelled = /class="m-head"/.test(body);
    var title = ui.modalTitleOf(body);
    var mask = root.querySelector('.modal-mask');
    if (!mask) {
      /* 从无到有：建 mask，播一次入场动画（此后同级重绘不再重建 → 不闪） */
      ui._modalStack = [];
      root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
        '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn + '</div></div>';
      ui._modalTitle = title;
    } else {
      var box = mask.querySelector('.modal');
      var curTitle = ui._modalTitle || '';
      /* 标题不同 = 进下级 → 当前层压栈（同级刷新同一标题，不入栈） */
      if (title && curTitle && title !== curTitle) {
        var inner0 = box.querySelector('.inner-panel');
        ui._modalStack.push({ html: inner0 ? inner0.innerHTML : '', cls: box.className,
          title: curTitle, marks: ui._modalMarks() });
      }
      if (title) ui._modalTitle = title;
      box.className = 'modal wood-frame' + sizeCls;
      box.innerHTML = '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn;
    }
    ui._paintModalX();
    root._visible = true;
  };""",
     'openModal 主体（内容替换 + 压栈）')

edit('js/ui.js', """  ui.closeModal = function () {
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();
    if (ui.replayStop) ui.replayStop();      /* v89.94：关窗即停战报回放（不留空转定时器） */
    if (ui.sdStop) ui.sdStop();              /* v89.102：沙盘播放同样关窗即停 */
    ui._sd = null;
    $('#modal-root').innerHTML = '';
    ui._visible = false;
    ui._modalKind = null;          /* v54：认窗标记（见 openExpPick / openGiftPick） */
    ui._curGrid = null;
    ui._attackNpc = null;
    ui._attackWild = null;
  };""",
     """  ui.closeModal = function () {
    /* v89.117：**先弹栈** —— 有上级就回到上一级（老板：「关闭的时候不回到上一级界面」）；
       只有顶层关闭才真的清空 modal-root（并做收尾：战场转后台 / 回放·沙盘停表）。
       ⚠️ 弹栈时**不做**收尾：下层可能还开着战场/回放，收尾会把它掐死。 */
    var _root = $('#modal-root');
    var _st = ui._modalStack || [];
    if (_st.length) {
      var lv = _st.pop();
      var _mask = _root.querySelector('.modal-mask');
      if (_mask) {
        var _box = _mask.querySelector('.modal');
        if (_box) {
          _box.className = lv.cls;
          _box.innerHTML = '<div class="inner-panel">' + lv.html + '</div>' +
            '<button class="modal-x" data-action="close-modal" title="关闭" aria-label="关闭">✕</button>';
        }
        ui._modalTitle = lv.title;
        ui._modalMarksRestore(lv.marks);
        ui._paintModalX();
        ui._visible = true;
        return;
      }
      _st.length = 0;                          /* mask 不在了（异常态）：走完整关闭 */
    }
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();
    if (ui.replayStop) ui.replayStop();      /* v89.94：关窗即停战报回放（不留空转定时器） */
    if (ui.sdStop) ui.sdStop();              /* v89.102：沙盘播放同样关窗即停 */
    ui._sd = null;
    _root.innerHTML = '';
    ui._visible = false;
    ui._modalStack = [];
    ui._modalTitle = null;
    ui._modalKind = null;          /* v54：认窗标记（见 openExpPick / openGiftPick） */
    ui._curGrid = null;
    ui._attackNpc = null;
    ui._attackWild = null;
  };""",
     'closeModal 弹栈')

# ---------------------------------------------------------------- openShell 传标记
edit('js/ui.js', """  ui.openShell = function (opts) {
    var sh = ui.modalShell(opts);
    ui.openModal(sh.html, { size: opts.size || 'md' });
  };""",
     """  ui.openShell = function (opts) {
    var sh = ui.modalShell(opts);
    /* v89.117：`sameAs` 显式声明"这是同一级"（极少数标题会变的同级重绘用它兜底） */
    ui.openModal(sh.html, { size: opts.size || 'md', sameAs: opts.sameAs });
  };""",
     'openShell 透传')

# ---------------------------------------------------------------- index.html：动画抑制
h = load('index.html')
edit('index.html', """  .modal-mask { animation: mModalIn .13s ease-out; }
  @keyframes mModalIn { from { opacity: 0; } }
  .modal-mask > * { animation: mModalRise .15s cubic-bezier(.16,1,.3,1); }
  @keyframes mModalRise { from { opacity: 0; transform: translateY(7px) scale(.985); } }""",
     """  .modal-mask { animation: mModalIn .13s ease-out; }
  @keyframes mModalIn { from { opacity: 0; } }
  .modal-mask > * { animation: mModalRise .15s cubic-bezier(.16,1,.3,1); }
  @keyframes mModalRise { from { opacity: 0; transform: translateY(7px) scale(.985); } }
  /* v89.117（老板「点击操作时会闪烁」）：入场动画**只在开窗那一次**播。
     ui.openModal 现在同级重绘只换 inner-panel 内容（元素不重建 → 动画本就不会重播），
     这两条是**兜底**：万一路径上重建了 mask/弹窗体，也别再闪一次。 */
  .modal-mask.no-anim, .modal-mask.no-anim > * { animation: none !important; }
  /* 右上角 ×：有上级时是「返回」（ui._paintModalX 改 title），视觉上加一个"返回"意符 */
  .modal-x.has-up::after { content: '↩'; position: absolute; right: 30px; top: 4px;
    font-size: var(--fs-cap); color: var(--gold-light); pointer-events: none; }""",
     'index.html 动画抑制 + 返回意符')

# ---------------------------------------------------------------- 写盘
for p, s in files.items():
    assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
    tmp = R + p + '.tmp117a'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 A 完成')

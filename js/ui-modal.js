/* ============================================================
 * ui-modal.js　弹窗框架 · 格局 / 键盘流 / 实时刷新 / 悬停保护 / 整体缩放
 * ------------------------------------------------------------
 * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序
 *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。
 * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。
 * ============================================================ */
import './ui.js';
(function () {
  var GAME = window.GAME;
  var DATA = GAME.DATA, U = GAME.utils;
  var ui = GAME.ui;
  var $ = ui._dom.$, $$ = ui._dom.$$;

  /* ============================================================
   * v89.189（老板 1）：「无法采取的操作，弹窗提示原因，比如无法改建，资源不足等等」
   * ------------------------------------------------------------
   * 病根：全站"条件不足"的按钮/卡片用 `disabled` 属性（或 .disabled 类）渲染 ——
   *   浏览器**不派发点击**（disabled）或委托直接 return（类），玩家看到灰按钮
   *   点不动、不知道差什么。v89.179c 给灰兵种卡加的原因机制（train-locked）
   *   甚至被委托的 class 拦截**拦死，从不可达**（本轮探针实锤）。
   * 口径（唯一出口组）：
   *   · `ui.softenBlocked(root)`：渲染之后统一跑 —— 把 `button[disabled]` 与
   *     `[data-action].disabled` 转为「可点击 + 说明」：移除 disabled 属性
   *     （卡片保留类名维持视觉）、挂 `data-why`（原因 = 显式属性 > title > 兜底）；
   *   · `ui.openWhyAsk(el)`：点击受阻元素的**统一弹窗**（标题 + 操作名 + 原因）；
   *   · main.js 委托：`data-why` 分支**优先于一切**（含原 class 拦截）。
   * 白名单：`data-no-why`（分页等"到头"语义）；输入框 / select 不软化。
   * 挂载点：openModal（两级重绘收口） + renderView —— 新增按钮自动覆盖。
   * ============================================================ */
  ui.openWhyAsk = function (el) {
    var why = (el && el.getAttribute && el.getAttribute('data-why')) || '当前条件不满足';
    var what = el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (what.length > 16) what = what.slice(0, 16) + '…';
    /* v91.00（老板）：**否决性弹窗**用小档 xs —— 只有一句原因，不必占 660×620；
       点弹窗外 / Esc 均可关闭（openModal 统一注入，见 ui.openModal 的 mask 点击）。 */
    ui.openModal(
      '<div class="gold-heading">⛔ 无法执行</div>' +
      (what ? '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">操作：<b style="color:var(--text-strong);">' + U.escape(what) + '</b></div>' : '') +
      '<div class="note">' + U.escape(why).replace(/\n/g, '<br>') + '</div>', { size: 'xs' });
  };
  ui.softenBlocked = function (root) {
    root = root || document;
    if (!root || !root.querySelectorAll) return 0;
    var list = root.querySelectorAll('button[disabled], [data-action].disabled');
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('data-no-why') != null) continue;    /* 白名单：到头语义不弹 */
      if (el.disabled) {
        /* ⚠️ disabled 必须摘除（无论是否已显式给过 data-why）—— 真实浏览器对
           disabled 控件**不派发点击**，留着它就等于"点了没反应"（b7 修正：
           初版对已带 data-why 的按钮直接跳过 → 渲染代码补过原因的那批仍点不动）。 */
        if (el.getAttribute('data-why') == null) {
          el.setAttribute('data-why', el.getAttribute('title') || '当前条件不满足');
        }
        el.removeAttribute('disabled');
        if (!el.classList.contains('dim')) el.classList.add('dim');
        n++;
      } else if (el.getAttribute('data-why') == null) {
        /* 卡片类（.disabled 类名、无 disabled 属性）：补 data-why 即可（类保留视觉） */
        el.setAttribute('data-why', el.getAttribute('title') || '当前条件不满足');
        n++;
      }
    }
    return n;
  };
  /* v89.190（上轮遗留「受阻弹窗长尾穷尽」）：**兜底扫掠** ——
     两大通道（openModal / renderView）之外，任何"局部增量重绘 / 未来新通道"
     产生的 disabled 按钮，由主循环每 2 秒兜底软化一次（幂等；常态命中 0 个，
     一次 querySelectorAll 的开销可忽略）。分页器等 data-no-why 白名单不受影响；
     输入框 / select 不软化（软化器既有约定）。 */
  ui._blockedSweepAt = 0;
  ui.blockedSweep = function (nowMs) {
    var t = nowMs || U.now();
    if (t - (ui._blockedSweepAt || 0) < 2000) return 0;
    ui._blockedSweepAt = t;
    try { return ui.softenBlocked(document); } catch (e) { return 0; }
  };

  ui.openModal = function (html, opts) {
    var root = $('#modal-root');
    var o = (typeof opts === 'string') ? { size: opts } : (opts || {});
    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
    /* v91.00（老板）：**点弹窗外（遮罩）→ 关闭** —— noClose 的窗（必须做选择才能继续）**不给关**。
       「必须选择」的窗本来就该拦住"点外面溜走"，与"连右上角 × 都不给"同一语义。
       `_prevNoOut` = 父层（旧）的值 → 压栈时随层记下，弹栈时还原（否则子层关掉后父层误变可关）。 */
    var _prevNoOut = ui._noOutsideClose;
    ui._noOutsideClose = !!o.noClose;
    /* v89.119：opts.tall —— 在档位基础上**放开高度**（战报正文页专属，见 index.html 的
       `.modal.modal-tall` 规则）。已开窗分支用 className 全量覆盖 → 跳回普通页自动摘掉；
       层级栈存完整 className → 回退时一起还原。 */
    if (o.tall) sizeCls += ' modal-tall';
    /* ============================================================
     * v89.114（老板「所有弹窗型窗口（比如建筑）的关闭按钮不再在底部显示，
     *   改为弹窗右上角的关闭按钮（圆形套个叉叉）」）
     * ------------------------------------------------------------
     * 关闭键只在右上角，全站一个样（本函数统一注入）：
     *   · html 里原有的关闭键（无论文案是"关闭/取消/知道了/合上册子"）就地剥离 ——
     *     全仓 97 处，一条条删必漏；在这里删才是"一个出口删干净"；
     *   · 剥空的底栏容器（.modal-foot / .m-foot / .bldg-foot / .panel-foot）一并撤除，
     *     不留空行占版面；
     *   · 还含**动作键**（确定/升级/提速/完成…）的底栏原样保留 —— 确认键仍在原处。
     * `data-action="close-modal"` 保持不变：事件派发与既有选择器全兼容。
     * noClose 语义不变（连右上角也不给）：必须做选择才能继续的流程。
     * ============================================================ */
    var body = ui.stripFootClose(html);
    var xBtn = o.noClose ? ''
      : '<button class="modal-x" data-action="close-modal" title="关闭" aria-label="关闭">✕</button>';
    /* v19：使用 modalShell 的弹窗自带 head/body/foot，内层换成 flex 列布局
       （标题与操作栏固定、只有内容区滚动）。
       ⚠️ × 挂在 .inner-panel **外面**：.inner-panel 是滚动容器（overflow-y:auto），
       放里面会随内容滚走。 */
    var shelled = /class="m-head"/.test(body);
    var title = ui.modalTitleOf(body);
    var mask = (ui._maskEl && ui._maskEl.isConnected) ? ui._maskEl : null;
    if (!mask) {
      /* 从无到有：建 mask，播一次入场动画（此后同级重绘不再重建 → 不闪） */
      ui._modalStack = [];
      root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
        '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn + '</div></div>';
      ui._modalTitle = title;
      ui._maskEl = (root.querySelector && root.querySelector('.modal-mask')) || null;
      ui._liveReopen = o.live || null;          /* v89.135 */
      ui._modalCloseAll = !!o.closeAll;
    } else {
      var box = mask.querySelector('.modal');
      var curTitle = ui._modalTitle || '';
      /* 标题不同 = 进下级 → 当前层压栈（同级刷新同一标题，不入栈）。
         v89.156：两个例外 ——
           · `o.sameAs`（v89.117 立的旗，此前**从未被消费** = 空承诺，本轮接线）；
           · `ui._liveRedraw`（live 每秒重绘：标题里的动态数字变了 ≠ 进下级）。 */
      if (title && curTitle && title !== curTitle && !o.sameAs && !ui._liveRedraw) {
        /* v89.135（老板 8）：「操作后回到某面板」不压新层 —— 要开的面板**已在栈中**时，
           截断栈回到那一层并用新内容重绘（不播动画）。
           病根（老板报的"基因实验室↔立项窗死循环"）：立项弹窗把实验室压成
           第三层 → 关闭一次弹回立项窗、再关回实验室、再关又回立项窗……永远出不去。 */
        var _hit135 = -1;
        for (var _hi135 = ui._modalStack.length - 1; _hi135 >= 0; _hi135--) {
          if (ui._modalStack[_hi135].title === title) { _hit135 = _hi135; break; }
        }
        if (_hit135 >= 0) {
          var _lv135 = ui._modalStack[_hit135];
          ui._modalStack.length = _hit135;      /* 弹掉该层之上的一切 */
          ui._modalTitle = title;
          ui._liveReopen = o.live || null;
          ui._modalCloseAll = !!o.closeAll;
          ui._modalMarksRestore(_lv135.marks);  /* 回到该层 → 恢复该层的认窗标记 */
          box.className = 'modal wood-frame' + sizeCls;
          box.innerHTML = '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn;
          ui.softenBlocked(root);               /* v89.189：受阻按钮转「可点+说明」 */
          ui._paintModalX();
          root._visible = true;
          ui.modalFocusInit();   /* v89.210：回到该层也给焦点（键盘流） */
          return;
        }
        var inner0 = box.querySelector('.inner-panel');
        ui._modalStack.push({ html: inner0 ? inner0.innerHTML : '', cls: box.className,
          title: curTitle, marks: ui._modalMarks(),
          /* v89.210：栈层记"输入值 / 滚动位 / 焦点"快照 —— 弹栈时回填（键盘流手感连续） */
          snap: ui._liveSnap(),
          live: ui._liveReopen, closeAll: ui._modalCloseAll, noOut: _prevNoOut });   /* v89.135 · v91.00 */
      }
      if (title) ui._modalTitle = title;
      ui._liveReopen = o.live || null;          /* v89.135：同级重绘同样更新回调 */
      ui._modalCloseAll = !!o.closeAll;
      box.className = 'modal wood-frame' + sizeCls;
      box.innerHTML = '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn;
    }
    ui.softenBlocked(root);                   /* v89.189：分支 1/2 统一收口 */
    ui._paintModalX();
    root._visible = true;
    ui.modalFocusInit();   /* v89.210：开窗即给焦点（键盘流）——焦点已在窗内则不动 */
  };

  /* 关闭键统一上移（openModal 专用）：剥掉 html 内的关闭键 + 清空掉的底栏。
     底栏不清会剩一条空白（gap/padding 都还在）；含动作键的底栏完整保留。 */
  ui.stripFootClose = function (html) {
    var s = String(html == null ? '' : html);
    /* ① 删关闭键（按钮内可能带 <span>，非贪婪到最近的 </button>）*/
    s = s.replace(/<button\b[^>]*data-action="close-modal"[^>]*>[\s\S]*?<\/button>/g, '');
    /* ② 删"只装关闭键"后空掉的底栏容器 —— 只认这四个底栏类名，别的一律不动。
       判空：去掉标签与空白/装饰点后什么都不剩才算空（"只剩一行 op-hint"的不算空）。 */
    s = s.replace(/<div class="(modal-foot|m-foot|bldg-foot|panel-foot)"([^>]*)>([\s\S]*?)<\/div>/g,
      function (m, cls, attrs, inner) {
        var bare = inner.replace(/<[^>]*>/g, '').replace(/[\s\u3000·　]+/g, '');
        return bare === '' ? '' : m;
      });
    return s;
  };

  /* ============================================================
   * 弹窗统一格局（v19 · 需求 4/5）
   *   modalShell({ title, sub, body, foot, size, noClose })
   * 统一：标题栏 / 内容区 / 操作栏三段式；尺寸走固定档位（与 CSS 同源）
   *   sm 440×420 · 默认 660×620 · lg 860×600 · xl 960×700 · xxl 980×800（v75 征召大厅）
   * 目的：君主、背包、游商、公文等所有弹窗**格局一致**，
   *      且尺寸不随内容变化、任何视口下都不超出边界。
   * ============================================================ */
  ui.modalShell = function (opts) {
    var o = opts || {};
    var head = '<div class="m-head"><span class="m-title">' + (o.title || '') + '</span>' +
      (o.sub ? '<span class="m-sub">' + o.sub + '</span>' : '') + '</div>';
    /* v89.114（老板）：关闭键统一在右上角（openModal 注入 ×）—— 默认不再生成底部关闭条。
       调用方仍可传 foot 放**动作键**（确定/完成/取消…），纯关闭键会被 openModal 剥掉。 */
    var foot = (o.foot != null) ? o.foot : '';
    return { html: head + '<div class="m-body">' + (o.body || '') + '</div>' + foot, size: o.size || 'md' };
  };
  /* 便捷入口：直接打开三段式弹窗 */
  ui.openShell = function (opts) {
    var sh = ui.modalShell(opts);
    /* v89.117：`sameAs` 显式声明"这是同一级"（极少数标题会变的同级重绘用它兜底） */
    /* v89.135：live / closeAll 一并透传给 openModal（用 openShell 的面板也能实时/全关） */
    ui.openModal(sh.html, { size: opts.size || 'md', sameAs: opts.sameAs,
      live: opts.live, closeAll: opts.closeAll });
  };
  ui.closeModal = function () {
    /* v89.135（老板 8）：closeAll 层（基因实验室这类"独立空间"）的关闭键 = **全关回视图** ——
       "基因实验室关闭后直接会到城市界面才对"（而不是弹回进实验室前的建筑面板）。 */
    if (ui._modalCloseAll) { ui.closeAllModals(); return; }
    /* v89.117：**先弹栈** —— 有上级就回到上一级（老板：「关闭的时候不回到上一级界面」）；
       只有顶层关闭才真的清空 modal-root（并做收尾：战场转后台 / 回放·沙盘停表）。
       ⚠️ 弹栈时**不做**收尾：下层可能还开着战场/回放，收尾会把它掐死。 */
    var _root = $('#modal-root');
    var _st = ui._modalStack || [];
    if (_st.length) {
      var lv = _st.pop();
      var _mask = (ui._maskEl && ui._maskEl.isConnected) ? ui._maskEl : null;
      if (_mask) {
        var _box = _mask.querySelector('.modal');
        if (_box) {
          _box.className = lv.cls;
          _box.innerHTML = '<div class="inner-panel">' + lv.html + '</div>' +
            '<button class="modal-x" data-action="close-modal" title="关闭" aria-label="关闭">✕</button>';
        }
        ui._modalTitle = lv.title;
        ui._modalMarksRestore(lv.marks);
        ui._liveReopen = lv.live || null;       /* v89.135：回退恢复该层的实时刷新 */
        ui._modalCloseAll = lv.closeAll || false;
        ui._noOutsideClose = !!lv.noOut;        /* v91.00：回退恢复该层的"点外关闭"许可 */
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
        /* v89.210：弹栈回填 —— 输入值 / 滚动位 / 焦点（回上一层手感连续；键盘流） */
        try { ui._liveRestore(lv.snap); } catch (eSnap210) { }
        ui.modalFocusInit();
        return;
      }
      _st.length = 0;                          /* mask 不在了（异常态）：走完整关闭 */
    }
    /* v89.87：关战场界面 = 转后台（清倒计时 timer、恢复 rec.anim 防后台停摆） */
    if (ui.btTeardown) ui.btTeardown();
    /* ⛔ v89.150（老板 3）：`ui.replayStop()`（关窗即停战报回放）随「分回合回放」板块一并退役 */
    if (ui.sdStop) ui.sdStop();              /* v89.102：沙盘播放同样关窗即停 */
    ui._sd = null;
    _root.innerHTML = '';
    ui._visible = false;
    ui._modalStack = [];
    ui._modalTitle = null;
    ui._maskEl = null;
    ui._modalKind = null;          /* v54：认窗标记（见 openExpPick / openGiftPick） */
    ui._curGrid = null;
    ui._attackNpc = null;
    ui._attackWild = null;
    ui._liveReopen = null;         /* v89.135：顶层关闭 = 停表 */
    ui._modalCloseAll = false;
    ui._noOutsideClose = false;    /* v91.00：顶层关闭 → 重置"点外关闭"许可 */
  };
  /* v89.117：**关掉所有层级**（closeModal 现在只弹一层 —— 见上面的弹窗栈）。
     语义明确的一个出口：脚本/测试/"一键回城"这类要"全关"的地方用它。
     （UI 里的 ✕ 保持弹一层：老板要的正是"关闭回下级"。） */
  ui.closeAllModals = function () {
    ui._modalStack = [];
    ui._modalCloseAll = false;     /* v89.135：防"closeAll 层调 closeModal"递归 */
    ui._liveReopen = null;
    ui.closeModal();
  };
  /* ============================================================
   * v89.210（规划二 · 键盘流闭环）：弹窗内 Tab 焦点圈 / Enter 激活 / 开窗给焦点。
   * ------------------------------------------------------------
   * 三个具名出口（唯一出口纪律）：
   *   ui.modalFocusables()  收集顶层弹窗内可交互元素（可见、未禁用）——
   *                         div[data-action] 现场补 tabindex=-1 才能被 .focus()；
   *   ui.modalFocusInit()   开窗 / 弹栈 / 回层时给焦点（焦点已在窗内则不动）；
   *   ui.modalKeyNav(e)     main.js keydown 转发：Tab 手动循环（末→首回卷）·
   *                         Enter 只激活 div[data-action]（真 button 交给浏览器默认；
   *                         输入框内 Enter 不劫持；IME 组词不触发）。
   * 桩环境（无 document.activeElement / querySelectorAll 恒空）自然空转 —— 零影响。
   * ============================================================ */
  ui.modalFocusables = function () {
    var out = [];
    try {
      var root = $('#modal-root');
      if (!root || !root.querySelectorAll) return out;
      var box = root.querySelector('.modal') || root;
      if (!box || !box.querySelectorAll) return out;
      var list = box.querySelectorAll('button, input, select, textarea, [data-action]');
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (!el || el.disabled === true) continue;
        if (el.classList && el.classList.contains('hidden')) continue;
        if (el.style && (el.style.display === 'none' || el.style.visibility === 'hidden')) continue;
        if (el.getAttribute && el.getAttribute('type') === 'hidden') continue;
        /* 非原生可聚焦元素（div[data-action]）补 tabindex，使其可被 .focus() */
        var tag = el.tagName || '';
        if (tag !== 'BUTTON' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA' && tag !== 'A'
            && el.setAttribute && !el.getAttribute('tabindex')) {
          try { el.setAttribute('tabindex', '-1'); } catch (eT) { }
        }
        out.push(el);
      }
    } catch (e) { }
    return out;
  };
  ui.modalFocusInit = function () {
    try {
      var ae = document.activeElement;
      if (ae && ae !== document.body && ui._maskEl && ui._maskEl.isConnected
          && ui._maskEl.contains && ui._maskEl.contains(ae)) return;   /* 焦点已在弹窗内：不动 */
      var list = ui.modalFocusables();
      if (!list.length) return;
      if (list[0].focus) list[0].focus();
    } catch (e) { }
  };
  ui.modalKeyNav = function (e) {
    if (!e || e.isComposing) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (!(ui._maskEl && ui._maskEl.isConnected)) return false;
    if (e.key === 'Tab') {
      var list = ui.modalFocusables();
      if (!list.length) return false;
      var cur = null;
      try { cur = document.activeElement; } catch (e0) { cur = null; }
      var idx = -1;
      for (var i = 0; i < list.length; i++) if (list[i] === cur) { idx = i; break; }
      var next = idx < 0 ? 0 : ((idx + (e.shiftKey ? -1 : 1)) % list.length + list.length) % list.length;
      try { if (list[next].focus) list[next].focus(); } catch (e1) { return false; }
      if (e.preventDefault) e.preventDefault();
      return true;
    }
    if (e.key === 'Enter') {
      var ae = null;
      try { ae = document.activeElement; } catch (e2) { ae = null; }
      if (!ae || !ae.getAttribute) return false;
      var tag = ae.tagName || '';
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A') return false;
      if (!ae.getAttribute('data-action')) return false;
      if (ae.click) {
        ae.click();
        if (e.preventDefault) e.preventDefault();
        return true;
      }
    }
    return false;
  };
  /* 焦点描述 / 回找（v89.210 · live 重建与弹栈回填共用）——按"稳定描述"重查：
     优先 id；否则 tag + data-action + 同类序号（不赌节点引用，重建后仍可寻回）。 */
  ui._focusDescOf = function () {
    try {
      var ae = document.activeElement;
      if (!ae || ae === document.body || !ae.getAttribute) return null;
      var root = $('#modal-root');
      if (!root || !root.contains || !root.contains(ae)) return null;
      if (ae.id) return { id: ae.id };
      var act = ae.getAttribute('data-action');
      if (!act) return null;
      var tag = ae.tagName || '';
      var sel = tag + '[data-action="' + act + '"]';
      var all = root.querySelectorAll(sel);
      var idx = 0;
      for (var i = 0; i < all.length; i++) if (all[i] === ae) { idx = i; break; }
      return { sel: sel, idx: idx };
    } catch (e) { return null; }
  };
  ui._focusFindOf = function (d) {
    try {
      if (!d) return null;
      var root = $('#modal-root');
      if (!root || !root.querySelector) return null;
      var el = null;
      if (d.id) {
        try { el = root.querySelector('[id="' + d.id + '"]'); } catch (e1) { el = null; }
      } else if (d.sel) {
        var all = root.querySelectorAll(d.sel);
        el = all[d.idx] || all[0] || null;
      }
      if (el && el.focus) { el.focus(); return el; }
      return null;
    } catch (e2) { return null; }
  };

  /* ============================================================
   * v89.135（老板 7）：「为啥界面不实时（募兵/用道具后队列还在、计时不显示）」——
   * **弹窗实时刷新**：面板可声明 `opts.live = function () { ui.openXXX(); }`（重开回调），
   * 主循环每秒调 liveModalTick()：
   *   ① 守卫：无弹窗自灭 / 有输入焦点（正在打字）跳过 → 不打断用户；
   *   ② 快照：输入值（按 id）+ 滚动位置（.inner-panel/.modal-scroll）；
   *   ③ 重开：调回调（内部走"同级 replace"路径，不闪、不重建 mask）；
   *   ④ 回填：快照写回。
   * 桩 DOM 环境（_maskEl 没有 isConnected）自动跳过 —— 与 §24 的能力判据同一套。
   * ============================================================ */
  ui.liveModalTick = function () {
    if (!ui._liveReopen) return;
    if (!(ui._maskEl && ui._maskEl.isConnected)) { ui._liveReopen = null; return; }
    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT' || ae.tagName === 'TEXTAREA')) return;
    } catch (e0) { /* 桩环境无 activeElement：继续 */ }
    /* v89.158（老板 2）：悬停弹窗内 → 本秒不重绘（保持"悬停那一刻"的数据；
       否则每秒重建会把悬停的物品/按钮节点换掉，浮层与悬停态闪烁）。 */
    if (ui.hoverHold('#modal-root')) return;
    var snap = ui._liveSnap();
    /* v89.156：重绘期间置 _liveRedraw —— 标题里的动态数字变化不得被当成"进下级"压栈 */
    try { ui._liveRedraw = true; ui._liveReopen(); }
    catch (e1) { ui._liveRedraw = false; ui._liveReopen = null; return; }
    ui._liveRedraw = false;
    ui._liveRestore(snap);
  };
  ui._liveSnap = function () {
    var out = { vals: {}, scrolls: [], focus: null };
    try {
      var root = $('#modal-root');
      if (!root || !root.querySelectorAll) return out;
      var els = root.querySelectorAll('input[id], select[id], textarea[id]');
      for (var i = 0; i < els.length; i++) {
        if (els[i].id != null) out.vals[els[i].id] = els[i].value;
      }
      /* v89.201（老板 3）修 bug：**真正的弹窗滚动容器是 `.m-body`**
         （`.inner-shell` 是 overflow:hidden 的弹性列，滚动发生在其中的 m-body）——
         旧清单漏了它 → live 快照/回填与 reopenKeepScroll 全都保不住滚动位
         （熔铸强化实测：点一次就回顶部）。补进唯一清单。 */
      var scs = root.querySelectorAll('.inner-panel, .m-body, .panel-body, .modal-scroll');
      for (var j = 0; j < scs.length; j++) out.scrolls.push(scs[j].scrollTop || 0);
      out.focus = ui._focusDescOf();   /* v89.210：焦点描述（重建后回填） */
    } catch (e) { }
    return out;
  };
  ui._liveRestore = function (snap) {
    if (!snap) return;
    try {
      var root = $('#modal-root');
      if (!root || !root.querySelector) return;
      Object.keys(snap.vals || {}).forEach(function (id2) {
        var el = null;
        try { el = root.querySelector('[id="' + id2 + '"]'); } catch (e) { }
        if (el && typeof el.value === 'string') el.value = snap.vals[id2];
      });
      var scs = root.querySelectorAll('.inner-panel, .m-body, .panel-body, .modal-scroll');   /* v89.201：+.m-body（真滚动容器） */
      for (var j = 0; j < scs.length && j < (snap.scrolls || []).length; j++) {
        if (snap.scrolls[j]) scs[j].scrollTop = snap.scrolls[j];
      }
      if (snap.focus) ui._focusFindOf(snap.focus);   /* v89.210：焦点回填（键盘流） */
    } catch (e) { }
  };
  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };
  /* v89.201（老板 3）：**重开弹窗保留滚动位置** ——
     病根：操作后 `ui.openXxx()` 重开面板 → `.inner-panel` 被重建 → scrollTop 归零
     （熔铸强化"点一次、滚动条就自动回到顶部，又得手动滚动下来"）。
     做法：复用 live 机制的快照/回填两个出口（_liveSnap 收滚动位、_liveRestore 写回）——
     一处定义、任何"操作后重开"的面板都能用。 */
  ui.reopenKeepScroll = function (fn) {
    var snap = null;
    try { snap = ui._liveSnap(); } catch (e) { }
    fn();
    if (snap) { try { ui._liveRestore(snap); } catch (e2) { } }
  };

  /* ================= 创建角色 ================= */
  var avatarIdx = 0, gender = 'male';
  /* v70（老板需求 5）：「头像与英雄可选头像不一致」——
     创建界面的头像改用**与英雄同一套**的头像池（assets/portraits/pool），
     idx 直接就是 portraitSeed（池内下标）→ 创建后君主的脸与顶栏 / 英雄页**同一张**。
     emoji 池（DATA.AVATARS）只留作池子不可用时的兜底。 */
  ui.avatarPool = function () {
    var P = GAME.portraits;
    var list = (P && P.POOL && P.POOL[gender === 'female' ? 'f' : 'm']) || [];
    return list;
  };
  ui.paintCreateAvatar = function () {
    var el = $('#create-avatar');
    if (!el) return;
    var pool = ui.avatarPool();
    avatarIdx = U.clamp(avatarIdx, 0, Math.max(0, pool.length - 1));
    var file = pool[avatarIdx];
    el.innerHTML = file
      ? '<img src="' + GAME.portraits.DIR + 'pool/' + file + '" alt="头像">'
      : '<span>🧔</span>';
  };
  ui.setCreate = function () {
    /* v91.36：创建屏默认 hidden（启动不再闪现）—— 这里是**唯一的揭开点**。 */
    $('#screen-create').classList.remove('hidden');
    ui.paintCreateAvatar();
    /* v70（老板需求 5）：归属选项改成**十三区** —— 说明给「首府 + 特产 + 风土」，
       出生城由 GAME.pickStartPos 落在该区首府近旁（不再是三句空文案）。 */
    var region = $('#create-region').value;
    var txt;
    if (region === 'random' || !DATA.STATE_SPECIALTY[region]) {
      txt = '（随机择一区落籍 · 出生城落在该区首府近旁的平原）';
    } else {
      var sp = DATA.STATE_SPECIALTY[region];
      var mat = DATA.MATERIAL_BY_ID[sp.mat];
      var seat = null;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (!seat && c.state === region && (c.type === 'zhou' || c.type === 'capital')) seat = c;
      });
      txt = '（' + region + ' · 首府' + (seat ? seat.name : '—') + ' · 特产' +
        (mat ? mat.name : sp.mat) + '　' + sp.lore + '）';
    }
    $('#create-map-preview').textContent = txt;
    /* 存档选择：有档则亮出「继续上次的游戏」并显示存档概要 */
    var btnC = $('#create-continue'), note = $('#create-save-note');
    var meta = GAME.readMeta ? GAME.readMeta() : null;
    if (btnC) btnC.classList.toggle('hidden', !meta);
    if (note) {
      note.innerHTML = meta
        ? ('上一次：' + U.escape(meta.name) + '　第 ' + (meta.year || 1) + ' 年　城' + meta.cities + '座　兵 ' + U.fmt(meta.army) + '<br><span style="opacity:.7">' + meta.savedAt + '</span>')
        : '尚无存档，输入君主之名开始新的征程';
      if (meta && meta.savedAt && GAME.metaTimeText) {
        note.innerHTML = note.innerHTML.replace(String(meta.savedAt), GAME.metaTimeText(meta.savedAt));
      }
    }
  };

  /* 继续上次的游戏 */
  ui.doContinue = function () {
    var st = GAME.loadGame();
    if (!st) { ui.toast('存档读取失败'); ui.setCreate(); return; }
    ui.enterLoaded('📂 已载入存档');   // v67：进游戏的三件事统一在这里
  };

  /* v67 · 读取存档的二次确认。**当前进度会被完全替换**，属于不可逆操作，
     照「放弃野地」同一套写法：把代价写在正文里，让玩家看得见。 */
  ui.openLoadSlotAsk = function (slotId) {
    var s = GAME.slotOf(slotId);
    if (!s) { ui.toast('槽位不存在'); return; }
    var m = GAME.slotMetaOf(slotId);
    ui._svLoadTarget = slotId;
    ui.openModal(
      '<div class="gold-heading">📂 读取「' + s.name + '」</div>' +
      '<div class="note">读取后，**当前进度会被这一份完全替换**。' +
        '如果当前进度还没存过，返回值前先「存入」一个空槽位。</div>' +
      (m ? '<div class="attr"><span class="k">君主</span><span class="v">' + U.escape(m.name) + '</span></div>' +
           '<div class="attr"><span class="k">进度</span><span class="v">第 ' + (m.year || 1) +
             ' 年　城 ' + m.cities + '　将 ' + m.gens + '</span></div>' +
           '<div class="attr"><span class="k">存档时间</span><span class="v">' +
             (GAME.metaTimeText ? GAME.metaTimeText(m.savedAt) : m.savedAt) + '</span></div>'
         : '<div class="note">这个槽位是空的。</div>') +
      '<div class="modal-foot">' +
        (m ? '<button class="btn gold" data-action="save-slot-load-do">确定读取</button>' : '') +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };
  ui.openDropSlotAsk = function (slotId) {
    var s = GAME.slotOf(slotId);
    if (!s) return;
    ui._svDropTarget = slotId;
    ui.openModal(
      '<div class="gold-heading">🗑️ 清空「' + s.name + '」</div>' +
      '<div class="note">清空后这个槽位变回空的，<b>无法撤销</b>（主档不在可清空之列）。</div>' +
      '<div class="modal-foot">' +
        '<button class="btn gold" data-action="save-slot-drop-do">确定清空</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };
  /* ============================================================
   * v89.89（A2）：离线「归来报告」—— 分类弹窗
   * ------------------------------------------------------------
   * 数据源 = GAME._offlineReport（offlineCatchup 补算前后快照归集，纯读取）。
   * 分四段：资源净变 / 在办完成 / 战报与事件 / 军务摘要。
   * 触发：ui.enterLoaded 里 off >= 60 秒时自动弹（toast 轻提示同时保留）。
   * 不进存档（会话级展示物；下次归来必有一份新的）。
   * ============================================================ */
  ui.offlineReportHTML = function () {
    var rp = GAME._offlineReport;
    if (!rp) return '';
    var durTxt = rp.secReal >= 3600 ? (rp.secReal / 3600).toFixed(1) + ' 时'
                                    : Math.round(rp.secReal / 60) + ' 分';
    var gDays = rp.applied * GAME.timeScale() / 86400;
    /* v89.207（老板 2）：来源分流 —— 读档归来 = 「归来报告」；睡眠/息屏在线补算 = 「离线纪要」
       （同一份报告数据，rp.via 标记来源；均不落档）。 */
    var _online207 = rp.via === 'online';
    var head = (_online207 ? '息屏 ' : '离城 ') + durTxt + ' · 推演 ' + (gDays >= 1 ? Math.round(gDays) + ' 游戏日' : '不足 1 游戏日');
    if (rp.overflow > 0 && rp.capDays > 0) {
      head += '（推进上限 ' + rp.capDays + ' 日；超出 ' +
        (rp.overflow >= 3600 ? (rp.overflow / 3600).toFixed(1) + ' 时' : Math.round(rp.overflow / 60) + ' 分') +
        ' 已五折折算）';
    }
    var h = '<div class="gold-heading">🕰️ ' + (_online207 ? '离线纪要' : '归来报告') + '</div>' +
      '<div class="note">' + head + '</div>';

    /* ① 资源净变（全城合计） */
    var resRows = '';
    DATA.RES_ORDER.forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */
      var d = rp.res[k] || 0;
      if (!d) return;
      resRows += '<div class="res-line"><span class="lbl">' + (ui.RES_ICON[k] || '') + ' ' +
        (ui.RES_NAME[k] || k) + '</span><span class="val" style="color:' +
        (d > 0 ? 'var(--green-ok)' : 'var(--red-light)') + ';">' +
        (d > 0 ? '+' : '') + U.numText(d, 0) + '</span></div>';
    });
    h += ui.sealH('资源净变', '全城合计') +
      (resRows || '<div class="q-empty">资源无变化。</div>');

    /* ② 在办完成 */
    var dn = [];
    if (rp.done.build) dn.push('🏗️ 建造完工 ' + rp.done.build + ' 项');
    if (rp.done.tech) dn.push('📚 研究完成 ' + rp.done.tech + ' 项');
    if (rp.done.train) dn.push('⚔️ 募兵完成 ' + rp.done.train + ' 队');
    h += ui.sealH('在办完成') +
      (dn.length ? '<div class="op-hint">' + dn.join('　·　') + '</div>'
                 : '<div class="q-empty">无事办结。</div>');

    /* ③ 战报与事件 */
    var rpRows = rp.reports.map(function (t) {
      return '<div class="op-hint">• ' + U.escape(t || '') + '</div>';
    }).join('');
    h += ui.sealH('战报与事件', rp.reportsN ? '新增 ' + rp.reportsN + ' 份' : '') +
      (rpRows || '<div class="q-empty">天下无事。</div>') +
      (rp.reportsN > rp.reports.length
        ? '<div class="ui-sub">……共 ' + rp.reportsN + ' 份，详见「公文」。</div>' : '');

    /* ④ 军务摘要 */
    var mil = [];
    if (rp.wounded) {
      mil.push('<div class="res-line"><span class="lbl">🩹 伤兵</span><span class="val" style="color:' +
        (rp.wounded > 0 ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        (rp.wounded > 0 ? '+' : '') + U.numText(rp.wounded, 0) + '</span></div>');
    }
    /* v89.200（老板 2）：睡眠/离线期间自动打完的挂起战斗（0 场不显示） */
    if (rp.autoBattles) mil.push('<div class="op-hint">⚔️ ' + rp.autoBattles
      + ' 场战斗已自动打完（全程回见「公文 → 战报」）</div>');
    if (rp.marchMsg) mil.push('<div class="op-hint">🚩 ' + U.escape(rp.marchMsg) + '</div>');
    if (mil.length) h += ui.sealH('军务') + mil.join('');

    h += '<div class="modal-foot"><button class="btn gold" data-action="close-modal">知道了</button></div>';
    return h;
  };
  ui.openOfflineReport = function () {
    if (!GAME._offlineReport) return;
    ui.openModal(ui.offlineReportHTML());
  };

  /* 载入完成后的统一入口：doContinue（主档）与 doLoadSlot（任意槽位）共用，
     免得"进游戏要做的几件事"写成两份（本项目最忌的失效模式）。 */
  ui.enterLoaded = function (label) {
    if (GAME.map) GAME.map.generate();
    ui.enterGame();
    GAME.refreshAll();
    var off = GAME._offlineSec || 0;
    var offTxt = '';
    if (off >= 60) {
      offTxt = off >= 3600 ? ('离城 ' + (off / 3600).toFixed(1) + ' 时，已补算')
                           : ('离城 ' + Math.round(off / 60) + ' 分，已补算');
      /* v89.86（整改 P-17）：触发推进上限时明示（超限段五折折算） */
      if ((GAME._offlineOverflow || 0) > 0) {
        offTxt += '·上限 ' + GAME.offlineCapDays() + ' 日，超出五折折算';
      }
    }
    ui.toast((label || '📂 已载入存档') + (GAME._scaleMigrated ? ' · 时间倍率已提升' : '') +
      (offTxt ? '　' + offTxt : ''));
    /* v89.89（A2）：离线归来 → 弹分类「归来报告」（toast 只是轻提示；报告是明细） */
    if (off >= 60 && GAME._offlineReport) ui.openOfflineReport();
  };

  ui.avatarShift = function (dir) {
    var n = ui.avatarPool().length || 1;
    avatarIdx = (avatarIdx + dir + n) % n;
    ui.paintCreateAvatar();
  };
  ui.setGender = function (g) {
    gender = g; avatarIdx = 0;
    $$('#screen-create .guse').forEach(function (el) {
      el.classList.toggle('active', el.dataset.gender === g);
    });
    ui.setCreate();
  };
  ui.doCreate = function () {
    var name = ($('#create-name').value || '').trim();
    if (!name) { ui.toast('请先输入君主名字'); return; }
    /* 已移除"玩家守则"勾选：本项目无需该门禁，首页直接提供存档选择 */
    var list = DATA.AVATARS[gender];
    var avatar = list[avatarIdx % list.length];
    /* v70（老板需求 5）：portraitSeed = 头像池下标（就是玩家挑的那张脸），
       落位交给 newGame 按所选区算；avatar（emoji）保留为旧字段兜底。 */
    GAME.newGame({
      name: name, avatar: avatar, gender: gender,
      region: $('#create-region').value,
      portraitSeed: avatarIdx,
      /* ⛔ v157.85（老板「去掉前传的任务机制」→ 确认口径：**整段前传**）：
         原来这里传 `prologue: true` —— 从界面进来的玩家先玩"无城荒野"，
         打怪升到 Lv20 才立城。前传整段退役后，新局**一律直接有城**。 */
    });
    GAME.map.generate();
    GAME.log('欢迎 ' + name + ' 踏上争霸之路！');
    GAME.saveGame();
    ui.enterGame();
    /* v92.244：开局引导改成**连续弹窗**（不再占用左侧统计栏那一行）*/
    ui.maybeTutorial();
    ui.toast('创建成功，开始争霸！');
  };
  ui.enterGame = function () {
    $('#screen-create').classList.add('hidden');
    $('#screen-game').classList.remove('hidden');
    /* ⛔ v157.85：原来按 `GAME.prologue.on()` 决定进地图还是进城市 ——
       前传退役后新局一定有城，直接进城市管理。 */
    ui.setView('city');
    /* v91.36（老板）：「不要在首次载入主页/城市管理界面时预加载别的了，太影响心情」——
       v91.33 的后台预建（即便 v91.35 已分帧 + 遮罩）仍会在进城市管理时占用 CPU、
       给低配机带来可感的迟滞。**整段撤除**：3D 地图改为**首次进地图时**才构建
       （用户明确要看地图才会等，且那时本就有明确预期）。`#boot-loading` 遮罩随之不再触发。 */
  };
  /* v91.36：**首次进地图**时的分帧构建 + 过场（原 v91.33/35 挂在进游戏路径上，老板嫌"进主页就卡"）。
     现在只在用户**主动点地图**时跑一次：分帧让出事件循环（进度条可动），跑完再撤遮罩；
     此后进地图因版本戳已预盖而**零重建**。 */
  ui.ensureMap3D = function () {
    var M = GAME.map3d;
    if (!M || M._preloaded) return;
    var steps = (M.preloadSteps && M.preloadSteps()) || null;
    if (!steps || !steps.length) {      /* 无 WebGL / 已建 → 直接放行（renderMapCanvas 自己处理） */
      M._preloaded = true; return;
    }
    M._preloaded = true;
    var ov = (document.getElementById && document.getElementById('boot-loading'));
    var fill = (document.getElementById && document.getElementById('bl-fill'));
    var pctE = (document.getElementById && document.getElementById('bl-pct'));
    var subE = (document.getElementById && document.getElementById('bl-sub'));
    var titleE = (document.getElementById && document.getElementById('boot-title'));
    function paint(p) { if (fill) fill.style.width = p + '%'; if (pctE) pctE.textContent = Math.round(p) + '%'; }
    function hide() { if (ov) ov.classList.remove('on'); }
    if (titleE) titleE.textContent = '🪐 正在构建星球…';
    if (subE) subE.textContent = '首次进入 3D 地图需构建星球地形（仅此一次 · 之后秒开）';
    if (ov) ov.classList.add('on'); paint(3);
    var i = 0;
    function next() {
      if (i >= steps.length) { paint(100); setTimeout(hide, 240); return; }
      var st = steps[i++];
      try { st.run(); } catch (e) { }
      paint(3 + 94 * (i / steps.length));
      /* v91.46：若该步标了 `waitFor`（如"等奇观异步加载就绪"），**轮询等待**——
         轮询期间主线程空闲 → 奇观 .glb.js 的 onload + atob + 解析得以执行，
         于是**地图首帧就带着奇观一起出现**（不再"地图先出、奇观过一会突然蹦出来"）。
         给上限 maxWait（默认 2.5s）：超大 glb 也不至于把地图卡太久，超时则先出地图、奇观随后到。 */
      if (st.waitFor) {
        var _w0 = Date.now(), _mw = st.maxWait || 2500;
        (function poll() {
          if (st.waitFor() || (Date.now() - _w0) > _mw) { setTimeout(next, 0); return; }
          setTimeout(poll, 40);
        })();
        return;
      }
      setTimeout(next, 0);             /* 让出事件循环 → 遮罩/进度条可刷新 */
    }
    setTimeout(next, 40);
  };

  /* ================= 主界面 ================= */
  /* 导航提醒：有事情等你处理 → 页签图标闪黄 */
  ui.syncBadges = function () {
    if (!GAME.state) return;
    /* ⛔ v90.92：任务页签（#topnav .tab[data-view="tasks"] 及 .fresh 闪烁）随任务系统退役。 */
    /* v41（需求 3）：行军角标**已撤**。老板原话「不要给在行军这个菜单名上产生数值」——
       顶栏提醒的语义是"有事情等你处理"（任务可领取）；行军只是"部队在外面"，
       属状态不属待办，挂在菜单名上会误导。队列数在行军菜单里本来就有。
       v41（需求 4）：公文改用**图标闪黄**（有新战报时），见下。 */
    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
    /* v156.31（老板 2026-11-02「把世界账本去掉，放行政里边就行，那就里边图标闪烁」）：
       顶栏的 #nav-ev 已整条退役，入口只剩「行政」页那一个按钮。
       行政页**不随 tick 重绘**，所以玩家停在那儿时来了新事件，需要这里补一刀 class；
       平时它由 ui-view.js 渲染时自己带上（两处都写是为了"切进去"和"停在上面"都对）。 */
    var evEl = document.querySelector('#view-container [data-action="open-world"]');
    if (evEl) {
      var evCur = (GAME.events && GAME.events.current) ? GAME.events.current() : null;
      if (evCur && evCur.def) {
        evEl.classList.add('ev-on');
        evEl.innerHTML = '⚡ ' + U.escape(evCur.def.name || '有件事');
      } else {
        evEl.classList.remove('ev-on');
        evEl.innerHTML = '🌍 世界的账本';
      }
    }
    /* ⛔ v89.218：待阅逸闻徽标（tab-badge-story）随故事系统退役。 */
  };

  /* 顶栏菜单图标：静态 HTML 里只放占位 <i class="ti" data-nav="...">，
     进游戏时填一次即可（图标与文字同源同色，不需要每秒重画）。 */
  ui.paintNav = function () {
    if (ui._navPainted) return;          // 一次性：顶栏是静态结构，画过就不再查 DOM
    var els = document.querySelectorAll('.topnav .ti[data-nav]');
    if (!els.length) return;
    for (var i = 0; i < els.length; i++) {
      els[i].innerHTML = GAME.icons.nav(els[i].getAttribute('data-nav'));
      els[i].setAttribute('data-painted', '1');
    }
    ui._navPainted = true;
  };

  /* ============================================================
   * 说明（v25 · 需求 12/13）
   * ------------------------------------------------------------
   * 判据：**玩家需要直接获知的信息才常驻**；解释规则/换算的"备注型"文字
   * 一律从这里出 —— 悬停出浮层，点击出小窗（平板无 hover，必须有第二条路）。
   * ============================================================ */
  /* ============================================================
   * 悬停浮层（v37 · 需求 2）—— 全站**唯一**一层
   * ------------------------------------------------------------
   * 内容源三选一（都留在原地，只是不再自己显示）：
   *   · [data-tip-el] 容器内的 .bag-tip / .tcard-tip / .tip-src  → HTML 浮层
   *   · [data-tip] 属性                                          → 纯文本浮层（\n 保留）
   * 显示层固定是 body 上的 #tip-layer（position:fixed、z-index 9000）。
   * 位置由 ui.tipPos 算：默认贴下方 → 下方不够翻上方 → 四面夹进视口。
   * ============================================================ */
})();

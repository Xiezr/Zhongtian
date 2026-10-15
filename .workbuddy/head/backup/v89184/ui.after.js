/* ============================================================
 * ui.js  界面渲染与模态框（真实数值版）
 * 面板：城内/城外/军队/将领/装备/科技/宝物/爵位/地图/任务/统计/公文/设置
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  var ui = GAME.ui = {
    view: 'city', side: 'res',
    _curGrid: null, _attackNpc: null, _attackWild: null, _cityId: null,
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ============================================================
   * v89.93（整改 E5）：**里程碑演出层** —— ui.moment(spec)
   * ------------------------------------------------------------
   * 改前：全站唯一有演出的地方是江湖剧本；攻占城池/爵位晋升/时代之志
   *       全部只有一行日志（"重大时刻零演出"）。
   * 三档：inline（横幅条 2.2s 自动过）· card（居中卡，手动关）·
   *       full（全屏，手动关）。全部复用既有令牌与金色系，不新增素材。
   * 铁律：① 不阻塞操作（inline 可点穿；card/full 可 Esc / 点关闭）；
   *       ② 内容全部来自调用方传入的既有出口数据，不写死字面量。
   * ============================================================ */
  ui._momentTimer = null;
  ui.momentClose = function () {
    clearTimeout(ui._momentTimer);
    var fx = document.getElementById('moment-fx');
    if (fx) { fx.className = ''; fx.innerHTML = ''; }
  };
  ui.moment = function (spec) {
    spec = spec || {};
    var kind = spec.kind || 'inline';
    var fx = document.getElementById('moment-fx');
    if (!fx) {
      fx = document.createElement('div');
      fx.id = 'moment-fx';
      var _root150c = ui.layerRoot();
      if (_root150c && _root150c.appendChild) _root150c.appendChild(fx);
    }
    var head = (spec.icon ? '<span class="mo-ico">' + spec.icon + '</span>' : '') +
      '<span class="mo-title">' + U.escape(spec.title || '') + '</span>';
    var sub = spec.sub ? '<div class="mo-sub">' + U.escape(spec.sub) + '</div>' : '';
    var body = (spec.lines && spec.lines.length)
      ? '<div class="mo-lines">' + spec.lines.map(function (t) { return '<div>' + U.escape(t) + '</div>'; }).join('') + '</div>' : '';
    var foot = (kind === 'inline')
      ? ''
      : '<div class="mo-foot"><button class="btn sm gold" data-action="moment-close">知道了</button></div>';
    fx.className = 'mo mo-' + kind;
    fx.innerHTML = '<div class="mo-box mo-box-' + kind + '"><div class="mo-head">' + head + '</div>' + sub + body + foot + '</div>';
    clearTimeout(ui._momentTimer);
    if (kind === 'inline') {
      ui._momentTimer = setTimeout(function () { ui.momentClose(); }, (spec.ms) || 2200);
    }
    return fx;
  };

  /* ============================================================
   * v89.93（整改 E4）：**反馈分层** —— 四型通知 + 数值浮字 + 程序化音效
   * ------------------------------------------------------------
   * 改前：全站只有一个 toast（单元素、textContent 直接覆盖、2200ms、无类型/队列），
   *       连续操作时后一条吃掉前一条，成功与失败长得一模一样；且**全站零音效**。
   * 现在：① ui.notify(type,msg) 四型（success/info/warn/danger）+ 最多 3 条堆叠；
   *       ② ui.floatGain(el, delta) 数值上浮；③ GAME.audio.play(key) Web Audio 合成。
   * 旧入口 ui.toast 保留为 info 的别名 —— 200+ 调用点零迁移。
   * ============================================================ */
  ui._notes = [];
  ui.notify = function (type, msg, opt) {
    type = (['success', 'info', 'warn', 'danger'].indexOf(type) >= 0) ? type : 'info';
    msg = String(msg == null ? '' : msg);
    ui._notes.push({ type: type, msg: msg });
    var keep = (opt && opt.keep) || 3;
    while (ui._notes.length > keep) ui._notes.shift();
    var el = $('#toast');
    el.innerHTML = ui._notes.map(function (n) {
      return '<div class="toast-line t-' + n.type + '">' + U.escape(n.msg) + '</div>';
    }).join('');
    el.classList.add('show');
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(function () {
      el.classList.remove('show');
      ui._notes = [];
    }, (opt && opt.ms) || 2200);
  };
  /* 兼容别名：旧调用点（200+）一律走 info 型 */
  ui.toast = function (msg) { ui.notify('info', msg); };

  /* v89.93（E4）：数值浮字 —— el 可为元素或选择器；delta 正绿负红 */
  ui.floatGain = function (el, delta, opt) {
    if (!delta) return;
    var host = (typeof el === 'string') ? $(el) : el;
    if (!host || !host.getBoundingClientRect || !document.body) return;
    try {
      var r = host.getBoundingClientRect();
      var d = document.createElement('div');
      d.className = 'float-gain' + (delta < 0 ? ' neg' : '');
      d.textContent = (delta > 0 ? '+' : '') + GAME.utils.fmt(Math.abs(delta) === delta ? delta : delta);
      /* v89.150（老板 2）：浮字在画布坐标系里 absolute 定位 → rect 先换算成画布坐标 */
      var _p150 = ui.toCanvasXY(r.left + r.width / 2, r.top);
      d.style.left = Math.round(_p150.x) + 'px';
      d.style.top = Math.round(_p150.y) + 'px';
      var _root150b = ui.layerRoot();
      if (!_root150b || !_root150b.appendChild) return;
      _root150b.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, (opt && opt.ms) || 950);
    } catch (e) { /* 浮字永不阻塞玩法 */ }
  };

  /* ------------------------------------------------------------
   * v89.93（E4）：程序化音效（零素材 · Web Audio 合成）
   * ------------------------------------------------------------
   * 与项目"程序化绘制地图/场景"同一条路线：oscillator + envelope，不落任何素材文件。
   * · 音频不可用（无 AudioContext / 被策略拦截 / 用户关了）→ **静默降级**，不抛错、不影响玩法
   * · 开关与音量入档：settings.sfx（默认开）/ settings.sfxVol（默认 0.5）
   * ------------------------------------------------------------ */
  GAME.audio = (function () {
    var AC = (typeof window !== 'undefined') ? (window.AudioContext || window.webkitAudioContext || null) : null;
    var ctx = null;
    /* 音符表：[频率, 时长秒, 波形] —— 一句 1~3 个音，克制、不聒噪 */
    var SPEC = {
      click:   [[660, 0.05, 'triangle']],
      build:   [[520, 0.07, 'triangle'], [780, 0.09, 'triangle']],
      train:   [[300, 0.07, 'sawtooth'], [420, 0.08, 'sawtooth']],
      march:   [[240, 0.09, 'sine'], [180, 0.12, 'sine']],
      win:     [[523, 0.09, 'triangle'], [659, 0.09, 'triangle'], [784, 0.16, 'triangle']],
      lose:    [[392, 0.12, 'sawtooth'], [262, 0.20, 'sawtooth']],
      levelup: [[659, 0.07, 'triangle'], [880, 0.12, 'triangle']],
      rank:    [[523, 0.08, 'sine'], [659, 0.08, 'sine'], [880, 0.08, 'sine'], [1046, 0.18, 'sine']],
      wonder:  [[784, 0.08, 'triangle'], [988, 0.08, 'triangle'], [1174, 0.14, 'triangle']],
      alarm:   [[440, 0.13, 'square'], [330, 0.13, 'square'], [440, 0.13, 'square']],
    };
    function on() {
      var s = GAME.state;
      if (s && s.settings && s.settings.sfx === false) return false;
      return true;
    }
    function vol() {
      var s = GAME.state;
      var v = (s && s.settings && s.settings.sfxVol != null) ? s.settings.sfxVol : 0.5;
      return Math.max(0, Math.min(1, Number(v) || 0));
    }
    return {
      keys: function () { return Object.keys(SPEC); },
      available: function () { return !!AC; },
      play: function (key) {
        try {
          if (!on()) return false;
          var spec = SPEC[key];
          if (!spec) return false;
          if (!AC) return false;
          if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
          if (!ctx) return false;
          if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e2) {} }
          var start = ctx.currentTime + 0.01, v = vol() * 0.22;
          for (var i = 0; i < spec.length; i++) {
            var n = spec[i];
            var o = ctx.createOscillator(), g = ctx.createGain();
            o.type = n[2] || 'triangle';
            o.frequency.value = n[0];
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), start + 0.012);
            g.gain.exponentialRampToValueAtTime(0.0001, start + n[1]);
            o.connect(g); g.connect(ctx.destination);
            o.start(start); o.stop(start + n[1] + 0.02);
            start += n[1] + 0.03;
          }
          return true;
        } catch (e) { return false; }   /* 音频永不影响玩法 */
      }
    };
  })();
  /* 便捷播放入口（调用点一律走它，缺失时静默） */
  ui.sfx = function (key) { try { if (GAME.audio) GAME.audio.play(key); } catch (e) {} };
  GAME.sfx = ui.sfx;   /* 域层（state/battle/systems）调用入口 —— 音频永不阻塞玩法 */

  /* ============================================================
   * 点选控件（v22 · 需求 1：全站不用下拉框）
   * 下拉框有四个问题：① 要两次点击才选得中（展开 + 选中）
   *   ② 展开层会盖住下方内容 ③ 在弹窗里与外层滚动容器互相打架
   *   ④ 只有 4~5 个选项时纯属杀鸡用牛刀
   * 统一改成「点一下就选中」的可见选项组；点选后就地切换高亮，
   * 并把值回写**同名隐藏域** —— 所有读取端（getElementById）一行都不用改。
   * ============================================================ */
  /* ============================================================
   * 界面主题（v39 · 需求 1）
   * ------------------------------------------------------------
   * 落点只有一个：`<html data-theme="...">`。CSS 里的主题块负责换值，
   * 所以 JS 这边**不需要知道任何色值** —— 加第五套主题时，
   * 只需在 DATA.THEMES 添一项、在 index.html 添一块 CSS。
   * applyTheme 做成幂等：值没变就不碰 DOM（renderView 每帧都会调 syncTheme）。
   * ============================================================ */
  ui.themeDef = function (id) {
    var list = (typeof DATA !== 'undefined' && DATA.THEMES) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || { id: 'ink', name: '墨玉', desc: '' };
  };
  ui.theme = function () {
    var s = (typeof GAME !== 'undefined' && GAME.state) ? GAME.state.settings : null;
    return (s && s.theme) || 'ink';
  };
  ui.applyTheme = function (t) {
    try {
      var el = document.documentElement;
      if (!el || typeof el.setAttribute !== 'function') return;
      if (el.getAttribute('data-theme') !== t) el.setAttribute('data-theme', t);
    } catch (e) { /* 无 DOM 环境（测试桩）时静默跳过 */ }
  };
  /* 每次渲染前同步一次：读档 / 新游戏 / 换肤三条路径共用这一处落点 */
  ui.syncTheme = function () { ui.applyTheme(ui.theme()); };

  ui.chips = function (o) {
    return '<span class="chips' + (o.cls ? ' ' + o.cls : '') + '">' +
      o.opts.map(function (x) {
        return '<span class="chip' + (x.on ? ' on' : '') +
          '" data-action="chip-set" data-v="' + x.v + '"' +
          (o.k ? ' data-k="' + o.k + '"' : '') +
          (o.target ? ' data-target="' + o.target + '"' : '') +
          (o.store ? ' data-store="' + o.store + '"' : '') +
          (o.refresh ? ' data-refresh="' + o.refresh + '"' : '') +
          (o.after ? ' data-after="' + o.after + '"' : '') +
          '>' + x.label + '</span>';
      }).join('') + '</span>';
  };

  /* 点选后就地切换高亮 + 回写隐藏域/状态。**不重绘** —— 同屏可能有输入框
     （市集数量、出征兵力），重绘会清空玩家刚填的内容。 */
  ui.chipSet = function (el) {
    var box = el.parentNode;
    if (box && box.classList && box.classList.contains('chips')) {
      var kids = box.querySelectorAll('.chip');
      for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('on', kids[i] === el);
    }
    var v = el.dataset.v;
    if (el.dataset.target) {
      var hid = document.getElementById(el.dataset.target);
      if (hid) hid.value = v;
    }
    if (el.dataset.store) ui[el.dataset.store] = v;
    if (el.dataset.refresh === 'view') GAME.refreshView();
    return v;
  };

  /* 肖像入口（v22 · 需求 2）：portraits 模块缺席时退回旧 emoji，
     保证任何加载顺序下界面都不崩、不空白。 */
  ui.faceOf = function (g, size) {
    size = size || 56;
    if (GAME.portraits && GAME.portraits.html) {
      GAME.portraits.ensure(g);
      return GAME.portraits.html(g, size);
    }
    return '<span style="font-size:' + Math.round(size * 0.7) + 'px;line-height:1;">' +
      ((g && g.avatar) || '🧔') + '</span>';
  };

  /* 选将领的统一入口（出征 / 采集 / 装备 / 宝物 四处共用）
     sub 可传函数，把「体力/精力/统率」这类关键信息带在选项上，信息不丢。 */
  /* v89.112（老板「条目过多的分页」）：将领选择器支持**分页**。
     166 位将领 × `.gen-chips` 两列网格 = 83 行 2356px —— 装备/宝物面板被它顶爆。
     用法：per=每页数（0/不传 = 不分页）；modal=true 走弹窗内翻页（mpage），
     否则走视图内联分页条（page → refreshView）。wide=true 用 4 列（见 CSS）。 */
  ui.genChips = function (o) {
    var opt = o || {};
    var list = opt.list || (GAME.state.generals || []);
    var ST = { guard: '守', march: '征', gather: '采' };
    var slice = list, pager = '';
    var per = opt.per || 0;
    if (per > 0 && list.length > per) {
      var key = opt.key || ('gchips_' + (opt.store || opt.target || 'x'));
      var p = ui.pageOf(key, list.length, per);
      slice = list.slice(p.from, p.to);
      pager = opt.modal ? ui.modalPagerHTML(key, list.length, per)
                        : ui.pagerInnerHTML(key, list.length, per);
    }
    return ui.chips({
      cls: (opt.cls || 'gen-chips') + (opt.wide ? ' wide' : ''),
      target: opt.target, store: opt.store, refresh: opt.refresh, after: opt.after,
      opts: slice.map(function (g) {
        var sub = opt.sub ? opt.sub(g) : ('Lv' + g.level);
        return {
          v: g.id, on: g.id === opt.value,
          label: U.escape(g.name) + '<span class="chip-sub">' + sub +
            (ST[g.status] ? ' ' + ST[g.status] : '') + '</span>'
        };
      })
    }) + pager;
  };

  /* 附属界面统一规范（v14.1，v43 修订，**v89.114 再修订**）
     · **关闭一律在右上角**（圆形套叉，v89.114 老板令）——
       由本函数统一注入 `.modal-x`；html 里原有的底部关闭键就地剥离（见 stripFootClose）
     · 支持尺寸档位 sm / md / lg …，统一 max-height 88vh + 内部滚动 ——
       不再超屏、不再无限下拉
     opts 可为字符串（等价 size）或 { size:'sm'|'md'|'lg', noClose:true } */
  /* ============================================================
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
  /* ⚠️ 能力判据：`mask` 只认**我们亲手建的那一个**（`ui._maskEl`），
     且必须 `isConnected === true` 才算"现场可用"。
     原因：smoke 的 DOM 桩把 querySelector 实现成"永远返回一个假元素"——
     靠 `root.querySelector('.modal-mask')` 判"有没有开窗"会永远判真
     （首版就这么写的，26 条断言当场翻红）。假元素没有 isConnected → 走重建路径。 */
  ui._maskEl = null;
  /* v89.135（老板 7/8）：
     · `ui._liveReopen` —— 当前顶层弹窗的**实时重开回调**（opts.live）。主循环每秒
       调 ui.liveModalTick()：快照输入值/滚动 → 重开（同级 replace 不闪）→ 回填。
     · `ui._modalCloseAll` —— 当前层的"关闭=全关"标记（opts.closeAll，种田秘境这类
       "独立空间"：关闭键直接回游戏视图，而不是弹回进秘境前那一层）。 */
  ui._liveReopen = null;
  ui._modalCloseAll = false;
  /* v89.156（老板 1 · debug）：live 重绘**进行中**标志 —— 期间 openModal 一律走
     "同级 replace"，绝不判"进下级"压栈。
     病根：`openWilds` 的标题含动态数字「附属野地（N/M）」—— 放弃一片后 N 变，
     live 每秒重绘时标题与当前不同 → 被当成"进下级"**每秒压一层** →
     关闭键每点一次只弹一层（弹出的还是**旧快照**，含已删除的行）→
     玩家看到"闪烁一下维持在界面中、被删的行又出现、要点几下才关掉"。
     同类受害面：一切标题含动态数据的 live 面板（行军队列（N）等）。 */
  ui._liveRedraw = false;
  /* 弹窗标题（去标签、压空白）：同级/下级判别的唯一出口。
     `.m-title` 是新式三段式；`.gold-heading` 是老式（80 处）——两者都认。 */
  ui.modalTitleOf = function (html) {
    var s = String(html == null ? '' : html);
    var m = /class="m-title"[^>]*>([\s\S]*?)<\/span>/.exec(s);
    if (!m) m = /class="gold-heading"[^>]*>([\s\S]*?)<\/div>/.exec(s);
    if (!m) return '';
    return m[1].replace(/<[^>]*>/g, '').replace(/[\s\u3000]+/g, ' ').trim();
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
    if (!x || !x.setAttribute) return;
    var st = ui._modalStack || [];
    var top = st.length ? st[st.length - 1] : null;
    x.setAttribute('title', top ? ('返回《' + (top.title || '上一级') + '》') : '关闭');
    if (x.classList && x.classList.toggle) x.classList.toggle('has-up', !!top);
  };

  ui.openModal = function (html, opts) {
    var root = $('#modal-root');
    var o = (typeof opts === 'string') ? { size: opts } : (opts || {});
    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
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
           病根（老板报的"种田秘境↔选种死循环"）：种下种子后 openFarm() 把秘境压成
           第三层 → 关闭一次弹回选种、再关回秘境、再关又回选种……永远出不去。 */
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
          ui._paintModalX();
          root._visible = true;
          return;
        }
        var inner0 = box.querySelector('.inner-panel');
        ui._modalStack.push({ html: inner0 ? inner0.innerHTML : '', cls: box.className,
          title: curTitle, marks: ui._modalMarks(),
          live: ui._liveReopen, closeAll: ui._modalCloseAll });   /* v89.135 */
      }
      if (title) ui._modalTitle = title;
      ui._liveReopen = o.live || null;          /* v89.135：同级重绘同样更新回调 */
      ui._modalCloseAll = !!o.closeAll;
      box.className = 'modal wood-frame' + sizeCls;
      box.innerHTML = '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn;
    }
    ui._paintModalX();
    root._visible = true;
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
   *   sm 440×420 · 默认 660×620 · lg 860×600 · xl 960×700 · xxl 980×800（v75 客栈）
   * 目的：君主、背包、商城、公文等所有弹窗**格局一致**，
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
    /* v89.135（老板 8）：closeAll 层（种田秘境这类"独立空间"）的关闭键 = **全关回视图** ——
       "种田秘境关闭后直接会到城池界面才对"（而不是弹回进秘境前的官府面板）。 */
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
    var out = { vals: {}, scrolls: [] };
    try {
      var root = $('#modal-root');
      if (!root || !root.querySelectorAll) return out;
      var els = root.querySelectorAll('input[id], select[id], textarea[id]');
      for (var i = 0; i < els.length; i++) {
        if (els[i].id != null) out.vals[els[i].id] = els[i].value;
      }
      var scs = root.querySelectorAll('.inner-panel, .panel-body, .modal-scroll');
      for (var j = 0; j < scs.length; j++) out.scrolls.push(scs[j].scrollTop || 0);
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
      var scs = root.querySelectorAll('.inner-panel, .panel-body, .modal-scroll');
      for (var j = 0; j < scs.length && j < (snap.scrolls || []).length; j++) {
        if (snap.scrolls[j]) scs[j].scrollTop = snap.scrolls[j];
      }
    } catch (e) { }
  };
  ui.modalVisible = function () { return !!$('#modal-root').innerHTML; };

  /* ================= 创建角色 ================= */
  var avatarIdx = 0, gender = 'male';
  /* v70（老板需求 5）：「头像与将领可选头像不一致」——
     创建界面的头像改用**与将领同一套**的头像池（assets/portraits/pool），
     idx 直接就是 portraitSeed（池内下标）→ 创建后君主的脸与顶栏 / 将领页**同一张**。
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
    ui.paintCreateAvatar();
    /* v70（老板需求 5）：归属选项改成**十三州** —— 说明给「州治 + 特产 + 风土」，
       出生城由 GAME.pickStartPos 落在该州州治近旁（不再是三句空文案）。 */
    var region = $('#create-region').value;
    var txt;
    if (region === 'random' || !DATA.STATE_SPECIALTY[region]) {
      txt = '（随机择一州落籍 · 出生城落在该州州治近旁的平原）';
    } else {
      var sp = DATA.STATE_SPECIALTY[region];
      var mat = DATA.MATERIAL_BY_ID[sp.mat];
      var seat = null;
      (DATA.NPC_CITIES || []).forEach(function (c) {
        if (!seat && c.state === region && (c.type === 'zhou' || c.type === 'capital')) seat = c;
      });
      txt = '（' + region + ' · 州治' + (seat ? seat.name : '—') + ' · 特产' +
        (mat ? mat.name : sp.mat) + '　' + sp.lore + '）';
    }
    $('#create-map-preview').textContent = txt;
    /* 存档选择：有档则亮出「继续上次的游戏」并显示存档概要 */
    var btnC = $('#create-continue'), note = $('#create-save-note');
    var meta = GAME.readMeta ? GAME.readMeta() : null;
    if (btnC) btnC.classList.toggle('hidden', !meta);
    if (note) {
      note.innerHTML = meta
        ? ('上一次：' + U.escape(meta.name) + '　' + meta.era + '·' + meta.yearName + '年　城' + meta.cities + '座　兵 ' + U.fmt(meta.army) + '<br><span style="opacity:.7">' + meta.savedAt + '</span>')
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
           '<div class="attr"><span class="k">进度</span><span class="v">' + (m.era || '') + '·' + (m.yearName || '') +
             '年　城 ' + m.cities + '　将 ' + m.gens + '</span></div>' +
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
    var head = '离城 ' + durTxt + ' · 推演 ' + (gDays >= 1 ? Math.round(gDays) + ' 游戏日' : '不足 1 游戏日');
    if (rp.overflow > 0 && rp.capDays > 0) {
      head += '（推进上限 ' + rp.capDays + ' 日；超出 ' +
        (rp.overflow >= 3600 ? (rp.overflow / 3600).toFixed(1) + ' 时' : Math.round(rp.overflow / 60) + ' 分') +
        ' 已五折折算）';
    }
    var h = '<div class="gold-heading">🕰️ 归来报告</div>' +
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
       落位交给 newGame 按所选州算；avatar（emoji）保留为旧字段兜底。 */
    GAME.newGame({
      name: name, avatar: avatar, gender: gender,
      region: $('#create-region').value,
      portraitSeed: avatarIdx,
    });
    GAME.map.generate();
    GAME.log('欢迎 ' + name + ' 踏上争霸之路！');
    GAME.saveGame();
    ui.enterGame();
    ui.toast('创建成功，开始争霸！');
  };
  ui.enterGame = function () {
    $('#screen-create').classList.add('hidden');
    $('#screen-game').classList.remove('hidden');
    ui.setView('city');
  };

  /* ================= 主界面 ================= */
  /* 导航红点：可领取任务数 */
  ui.syncBadges = function () {
    if (!GAME.state) return;
    var el = $('#tab-badge-task');
    if (el) {
      var n = GAME.questSummary().ready;
      el.textContent = n > 99 ? '99+' : n;
      el.classList.toggle('hidden', n <= 0);
    }
    /* v41（需求 3）：行军角标**已撤**。老板原话「不要给在行军这个菜单名上产生数值」——
       顶栏徽标的语义是"有事情等你处理"（任务可领取）；行军只是"部队在外面"，
       属状态不属待办，挂在菜单名上会误导。队列数在行军菜单里本来就有。
       v41（需求 4）：公文改用**图标闪黄**（有新战报时），见下。 */
    var docTab = document.querySelector('#topnav .tab[data-view="reports"]');
    if (docTab) docTab.classList.toggle('fresh', (GAME.state.repUnread || 0) > 0);
    /* v89.86（整改 P-06）：待阅逸闻 —— 顶栏「史册」徽标（触发的逸闻不再全屏弹出） */
    var elS = $('#tab-badge-story');
    if (elS) {
      var ns = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending().length : 0;
      elS.textContent = ns > 99 ? '99+' : ns;
      elS.classList.toggle('hidden', ns <= 0);
    }
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
  /* ============================================================
   * v89.150（老板 2）：「让玩家面对的游戏画面如同图片一样整体缩放」——
   *   下面三个出口是**画布坐标系**的公共设施（浮层挂载 / 坐标换算 / 画布尺寸），
   *   凡"按鼠标或元素位置摆浮层"的代码一律走它们，不各写一份换算。
   * ============================================================ */
  /* 画布尺寸（JS 侧唯一出口）：读 --app-w/--app-h 令牌（CSS 是源头），
     桩环境读不到（getComputedStyle 不支持自定义属性）→ 回落设计常量 1440×900。 */
  ui.canvasSize = function () {
    var w = 1440, h = 900;
    try {
      var cs = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
      if (cs && cs.getPropertyValue) {
        var tw = parseFloat(cs.getPropertyValue('--app-w'));
        var th = parseFloat(cs.getPropertyValue('--app-h'));
        if (isFinite(tw) && tw > 0) w = tw;
        if (isFinite(th) && th > 0) h = th;
      }
    } catch (e) { /* 桩环境：用默认 */ }
    return { w: w, h: h };
  };
  /* 浮层挂载点（唯一出口）：整幅画面统一缩放后，所有浮层都要挂在缩放容器
     #app-scale 里（画布坐标系）；挂 body 会跑到缩放容器外 —— 字号不随缩放、
     坐标也是错的。桩环境没有容器 → 兜底 body（行为与旧版一致）。 */
  ui.layerRoot = function () {
    var sc = null;
    try { sc = (document.getElementById && document.getElementById('app-scale')) || null; } catch (e) { sc = null; }
    if (sc) return sc;
    return (typeof document !== 'undefined') ? document.body : null;
  };
  /* "视口坐标 → 画布坐标"的唯一换算：元素 rect 给的是**视觉坐标**（含 transform
     缩放）；画布内 absolute 定位要的是画布坐标 —— 减去缩放容器原点、除以缩放比。
     桩环境（rect 恒 0 / 无容器 / k=1）原样返回。 */
  ui.toCanvasXY = function (clientX, clientY) {
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) {
        var r = sc.getBoundingClientRect();
        if (r) { ox = r.left || 0; oy = r.top || 0; }
      }
    } catch (e) { ox = 0; oy = 0; }
    return { x: (clientX - ox) / k, y: (clientY - oy) / k, k: k };
  };

  /* ============================================================
   * v89.158（老板 2）：**悬停保护**（唯一出口）——
   *   鼠标悬停在该容器内时，本秒的"周期性重绘"让位（整块跳过），
   *   悬停期间保持"悬停那一刻"的数据呈现（老板口径：无需刷新悬停信息）。
   * ------------------------------------------------------------
   * 病根：主循环每秒用 innerHTML 重建侧栏/公文/弹窗 → 鼠标下的节点被替换 →
   *   ① 原生 title 提示与 #tip-layer 浮层因节点消失而收起
   *      （鼠标不动时浏览器不会再触发 mouseover）→ 视觉"闪烁"（实测复现）；
   *   ② CSS :hover 高亮同秒重置。
   * 口径：只有**周期性重绘**（主循环置 ui._tickPaint）让位；
   *   操作驱动的重绘（点"+"用宝物 → refreshAll）永远放行 ——
   *   否则"操作后的界面刷新"会被悬停挡住（点了 1 秒后才更新）。
   * 桩环境（jsdom 无 :hover 支持）→ 返回 false = 不保护（行为与旧版一致）；
   *   测试用 ui._hoverOf 注入悬停节点。
   * ⚠️ 取 :hover 链的**最深**元素必须用 querySelectorAll 取**最后一个** ——
   *   querySelector(':hover') 返回文档序第一个（html），永远判不中（本函数第一版就这么错）。
   * ============================================================ */
  ui._tickPaint = false;          /* 主循环每秒置 true（窗口内的重绘属"周期性"） */
  ui._hoverOf = null;             /* 测试注入点：返回悬停节点（桩环境用） */
  ui.hoverHold = function (sel) {
    if (!ui._tickPaint) return false;
    var box = null;
    try {
      box = (typeof sel === 'string')
        ? ((document.querySelector && document.querySelector(sel)) || null) : sel;
    } catch (e) { box = null; }
    if (!box || !box.contains) return false;
    var hv = null;
    try {
      if (ui._hoverOf) hv = ui._hoverOf();
      else if (document.querySelectorAll) {
        var all = document.querySelectorAll(':hover');
        hv = (all && all.length) ? all[all.length - 1] : null;
      }
    } catch (e2) { hv = null; }
    return !!(hv && box.contains(hv));
  };

  ui.TIP_ID = 'tip-layer';
  ui.tipEl = function () {
    var el = document.getElementById(ui.TIP_ID);
    if (el) return el;
    /* 兜底自建：测试环境（jsdom / 桩文档）里 index.html 的挂载点可能不存在。
       缺了它浮层就静默不显示 —— 这类"少个 DOM 就无声失败"最该有兜底。 */
    if (typeof document === 'undefined' || !document.body || !document.createElement) return null;
    el = document.createElement('div');
    el.id = ui.TIP_ID; el.className = 'tip-layer';
    el.setAttribute('aria-hidden', 'true');
    /* v89.150：挂缩放容器（画布坐标系）—— 见 ui.layerRoot 注释 */
    var _root150 = ui.layerRoot();
    if (!_root150 || !_root150.appendChild) return null;
    _root150.appendChild(el);
    return el;
  };
  /* 落位**纯函数**（便于断言）：给锚点矩形/浮层尺寸/视口，返回左上角坐标。
     ① 默认贴锚点正下方 ② 下方空间不够则翻到上方 ③ 左右上下四面夹进视口 */
  ui.tipPos = function (a, tw, th, vw, vh) {
    var gap = 10, pad = 8;
    var top = a.bottom + gap;
    if (top + th > vh - pad) top = a.top - gap - th;
    var left = a.left + a.width / 2 - tw / 2;
    left = Math.max(pad, Math.min(left, Math.max(pad, vw - pad - tw)));
    top = Math.max(pad, Math.min(top, Math.max(pad, vh - pad - th)));
    return { left: Math.round(left), top: Math.round(top) };
  };
  ui.tipHide = function () {
    var el = ui.tipEl();
    if (el) el.classList.remove('on');
  };
  ui.tipShow = function (html, anchor) {
    var el = ui.tipEl();
    if (!el || !anchor) return;
    el.innerHTML = html;
    el.classList.add('on');
    ui.tipPlace(anchor);
  };
  ui.tipPlace = function (anchor) {
    var el = ui.tipEl();
    if (!el || !anchor || !anchor.getBoundingClientRect || !el.getBoundingClientRect) return;
    var r = anchor.getBoundingClientRect();
    var t = el.getBoundingClientRect();
    /* v89.150（老板 2）：整体缩放后 —— 锚点/浮层 rect 是**视觉坐标**，
       而浮层在画布坐标系里 absolute 定位 → 先换算到画布坐标再落位；
       夹取范围也换成**画布尺寸**（"视口"对界面已不存在）。
       换算后与旧行为在 k=1、容器原点 (0,0) 时**逐像素一致**（测试口径不变）。 */
    var k = (GAME.appKOf ? GAME.appKOf() : 1) || 1;
    var ox = 0, oy = 0;
    try {
      var sc = document.getElementById && document.getElementById('app-scale');
      if (sc && sc.getBoundingClientRect) { var sr = sc.getBoundingClientRect(); if (sr) { ox = sr.left || 0; oy = sr.top || 0; } }
    } catch (e2) { ox = 0; oy = 0; }
    var a = { left: (r.left - ox) / k, top: (r.top - oy) / k, width: r.width / k,
      height: r.height / k, bottom: (r.bottom - oy) / k };
    var _cs150 = ui.canvasSize();
    var pos = ui.tipPos(a, t.width / k, t.height / k, _cs150.w, _cs150.h);
    el.style.left = pos.left + 'px';
    el.style.top = pos.top + 'px';
  };
  /* 从事件目标解析浮层内容：先找容器里的内容源，再退到 data-tip 属性 */
  ui.tipFor = function (node) {
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
  };

  /* ============================================================
   * v89.88（老板需求 4）：大地图悬浮浮层的内容 —— 「坐标 + 等级」
   * ------------------------------------------------------------
   * 输入 = `GAME.map.pick` 的命中对象（与点击走**同一条**拾取路径）。
   * 等级一律走既有唯一出口，不另造一份：
   *   · 城池     → `GAME.cityLvOf`（城等级 = 官府 = 建筑，一号到底）
   *   · 野外城池 → `fort.level`（等级每日变化）
   *   · 野地     → `GAME.map.wildLevelNow`（已占读记录值、无主读日盐值）
   * 输出用既有浮层类（.tip-t / .tip-l），与 data-tip 提示同一套样式 ——
   * 一层、一套定位规则（tipPos 四面夹进视口），不会飞出屏幕。
   * ============================================================ */
  ui.mapTipFor = function (hit) {
    if (!hit || hit.x == null) return null;
    var head = '', rows = [];
    function line(txt) { rows.push('<div class="tip-l">' + txt + '</div>'); }
    if (hit.kind === 'player' && hit.city) {
      head = '🏯 ' + U.escape(hit.city.name) + '（己方）';
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · 点击进入城池面板');
    } else if (hit.kind === 'npc' && hit.city) {
      var tier = (DATA.CITY_TIER || {})[hit.city.type] || '名城';
      head = '🏯 ' + U.escape(GAME.cityFullName(hit.city));
      line('城等级 <b>Lv' + GAME.cityLvOf(hit.city) + '</b> · ' + U.escape(tier) + '　点击可出征');
    } else if (hit.kind === 'fort' && hit.fort) {
      head = '🏕 ' + U.escape(GAME.fortLabelOf(hit.fort));
      line('野外城池 <b>Lv' + hit.fort.level + '</b> · 等级每日变化　点击可出征');
    } else {
      var tile = GAME.map.tile(hit.x, hit.y);
      var ter = (tile && DATA.TERRAIN[tile.terrain]) || null;
      var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(hit.x, hit.y) : 0;
      var own = GAME.map.wildAt(hit.x, hit.y);
      head = (ter ? ter.name : '空地') + (own ? '（己方 · 已占）' : '');
      line('野地 <b>Lv' + lv + '</b>' + (lv > 0 ? ' · 点击可出征' : ' · 无守军'));
    }
    var cur = GAME.currentCity && GAME.currentCity();
    var d = cur ? Math.max(Math.abs(cur.x - hit.x), Math.abs(cur.y - hit.y)) : null;
    line('📍 坐标 <b>(' + hit.x + ', ' + hit.y + ')</b>'
      + (d == null ? '' : '　距 ' + U.escape(cur.name) + ' ' + d + ' 格'));
    return '<div class="tip-t">' + head + '</div>' + rows.join('');
  };

  ui.help = function (text, label) {
    var t = U.escape(text);
    return '<span class="help-chip" data-tip="' + t + '" data-action="show-help" data-help="' + t + '" title="">'
      + (label || '?') + '</span>';
  };
  ui.openHelp = function (text) {
    ui.openShell({
      title: 'ⓘ 说明',
      size: 'sm',
      body: '<div class="help-body">' + U.escape(text) + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">知道了</button></div>'
    });
  };

  ui.syncHeader = function () {
    var s = GAME.state;
    ui.paintNav();
    /* v25（需求 9）：头像换成程序化立绘（不再用 emoji）。
       v45（需求 2）：老板要求**主角头像也从 20 张头像池里随机取一张** ——
       与麾下将领同一套美术。种子存在 `state.ruler.portraitSeed`（开局摇一次，
       之后每局固定），所以整局游戏里君主的脸不会变。
       池子为空时 `portraits.html` 自动退回程序化立绘，界面不会开天窗。 */
    var av = $('#lord-avatar');
    if (av && GAME.portraits) {
      var rulerGen = {
        name: s.ruler.name || '君主', gender: s.ruler.gender || 'male',
        portraitSeed: s.ruler.portraitSeed,
        rank: 'tian',                       /* 程序化立绘兜底时君主用天授冠 */
        tong: 92, nz: 84, yw: 86, zm: 88,   /* 兜底立绘：四维最高的"统率"→金甲 */
      };
      /* v89.158：内容不变不重建（每秒重建会让悬停态/子节点被打断） */
      var _avSig = (s.ruler.name || '') + '|' + (s.ruler.gender || '') + '|' + (s.ruler.portraitSeed || '');
      if (av._sig !== _avSig) { av._sig = _avSig; av.innerHTML = GAME.portraits.html(rulerGen, 68); }
    }
    /* v26（需求 3）：顶栏天时。放在 syncHeader 里而不是单独定时器 ——
       主循环每秒都会调 syncHeader，季节/天候/年号一切换这里就跟着变。 */
    var sky = $('#nav-sky');
    if (sky) {
      var line = GAME.story ? GAME.story.skyLine() : '';
      /* v89.158：内容不变不重建（同头像 —— 内容变（换季/换天候）才重画） */
      if (sky._sig !== (line || '')) {
        sky._sig = (line || '');
        sky.innerHTML = '<span class="ns-k">天时</span>' + U.escape(line || '—');
      }
    }
    /* v81（老板）：「官职这行放玩家名称」—— 官职行退役（游戏里没有官职体系），
       君主名落在信息表首行；#lord-office 不再存在、也不再写。 */
    $('#lord-name').textContent = s.ruler.name;
    $('#lord-rep').textContent = U.fmt(s.rep);
    $('#lord-rank').textContent = (s.rank || 0);
  };

  /* ============================================================
   * 队列总览（v24 · 需求 9）
   * ------------------------------------------------------------
   * 原先屏幕下方常驻一条「建造队列实时播报」，把募兵、自动升级、行军全挤在
   * 一行里滚动 —— 既是"永远在动的噪音"，又占掉棋盘的高度。
   * 现在统一收进「公文」页的「队列」一节：要看时打开公文，平时界面干净。
   * 地块上的行内进度（施工 % / 募兵 %）**保留**，进度信息并不丢失。
   * ============================================================ */
  /* v29（需求 6）：`ui.renderQueue` 随公文的队列段一并删除 ——
     它原本只是个"仅当 #doc-queues 存在时才刷新"的挂钩，
     而 #doc-queues 已经不存在了，留着就是一段永不生效的死代码。
     队列现在按归口分散展示：官府（建造/募兵）、行军菜单、自动菜单。 */

  /* ============================================================
   * 在办事项（v29 · 需求 6）：建造 / 募兵 / 自动升级 / 行军 一览
   * ------------------------------------------------------------
   * 原先挂在「公文」页，公文的职责是"报告与消息"，队列是"正在办的活"，
   * 性质不同、也不该占公文半屏。现在迁到**官府弹窗**（城务的归口）——
   * 玩家想查"还在建什么、还在募什么"时，去城务面板看，符合直觉。
   * ============================================================ */
  /* `limit` 可选：官府面板只列前 N 条（v65 收口）——
     面板的高度必须可控（老板硬规矩：弹窗内不许有下拉条），
     而"在办事项"是最容易无限长的一块（募兵一排队就十几条）。 */
  ui.queueBody = function (limit) {
    var s = GAME.state;
    if (!s) return '';
    var rows = [];
    /* ① 建造 / 升级 */
    (s.queues.build || []).forEach(function (q) {
      var b = DATA.BUILDINGS[q.buildId] || DATA.EXT_BUILDINGS[q.buildId];
      var city = GAME.cityById(q.cityId);
      var tail = q.type === 'ext_build' ? ' 新建' : (q.type === 'ext_upgrade' ? ' 升 Lv' + q.targetLevel : '');
      rows.push({
        kind: '🏗️ 建造',
        what: (city ? U.escape(city.name) + ' · ' : '') + (b ? b.name : '建筑') + tail,
        pct: Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100)),
      });
    });
    /* ② 募兵：按军营分列，标明执行中 / 排队等待 */
    var byBar = {};
    (s.queues.train || []).forEach(function (q) {
      var k = GAME.trainQueueKey(q);
      byBar[k] = byBar[k] || [];
      byBar[k].push(q);
    });
    Object.keys(byBar).forEach(function (k) {
      var list = byBar[k];
      var city = GAME.cityById(list[0].cityId);
      var bIdx = (list[0].bIdx == null ? -1 : list[0].bIdx);
      var lv = city ? GAME.barracksLevel(city, bIdx) : 0;
      list.forEach(function (q, i) {
        var t = DATA.TROOPS[q.troopId];
        rows.push({
          kind: '⚔️ 募兵',
          what: (city ? U.escape(city.name) + ' · ' : '') +
            (bIdx >= 0 ? '军营' + (lv ? ' Lv' + lv : '') + '（城内第 ' + (bIdx + 1) + ' 格） · ' : '') +
            (t ? t.name : q.troopId) + ' ×' + U.numText(q.count, 0) +
            (i === 0 ? '' : '<span class="ui-sub">（排队第 ' + (i + 1) + '）</span>'),
          pct: i === 0 ? Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100)) : -1,
        });
      });
    });
    /* ③ 自动升级（只在开启时出现） */
    if (s.settings && s.settings.autoUpgrade) {
      var as2 = s.autoState || {};
      rows.push({ kind: '🔨 自动升级', what: U.escape(as2.msg || '待命'), pct: -1 });
    }
    /* ④ 行军 */
    (s.marches || []).forEach(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      rows.push({ kind: '🛫 行军', what: U.escape(m.name) + '（' + md.name + '）' + pr.label, pct: -1 });
    });

    if (!rows.length) return '<div class="q-empty">队列空闲：没有在建、在募、在途的任务。</div>';
    var shown = limit ? rows.slice(0, limit) : rows;
    var more = (limit && rows.length > limit)
      ? '<div class="op-hint">另有 ' + (rows.length - limit) + ' 条在办（按入队顺序推进，完成后自动接续）</div>'
      : '';
    return '<table class="tbl"><thead><tr><th>类别</th><th>内容</th><th style="width:130px;">进度</th></tr></thead><tbody>' +
      shown.map(function (r) {
        return '<tr><td>' + r.kind + '</td><td>' + r.what + '</td><td class="num">' +
          (r.pct < 0 ? '—'
            : '<span class="qbar" style="display:inline-block;width:64px;vertical-align:middle;margin-right:6px;">' +
              '<i style="width:' + r.pct + '%"></i></span>' + r.pct + '%') +
          '</td></tr>';
      }).join('') + '</tbody></table>' + more;
    /* 注（v64）试过给这张表加分页 —— **没用**：分页条自己 ~50px，
       而队列常只有 1~2 行、根本不触发分页，净效果更高。
       v65 换成"只列前 N 条 + 摘要一行"，高度才真正可控。 */
  };

  /* ============================================================
   * 行军队列面板（v18）
   * 出征不再是「点一下就出结果」，而是先出发、再抵达 —— 这里能看到每支队伍
   * 走到哪了，并支持召回（无收益）与急行军令（立即抵达）。
   * ============================================================ */
  /* ============================================================
   * 伤兵营（v21 · 需求 1）
   * 原先挂在「设置」里 —— 位置本身就是错的：伤兵是**战斗产物**，
   * 不是系统配置项，玩家打完仗在设置里翻找才治得了伤。
   * 现归属两处：**校场**（军事建筑）与**行军菜单**（战果结算处）。
   * host 决定治疗后重绘谁：'xiaochang' → 校场弹窗 · 'marches' → 行军队列弹窗
   * ============================================================ */
  /* ============================================================
   * v89.116（老板「伤兵营放在军务处下，俘虏营也是。出现伤病或俘虏时，
   *   列出具体兵种及数量，不要一个总数量」）
   * ------------------------------------------------------------
   * 改前：伤兵营在**四处**各摆一套（设置→校场→行军队列弹窗→行军视图→军务处），
   *   除军务处外都只给一个总数，治疗按钮也散着放 —— 老板要的是"一个落点 + 逐兵种"。
   * 现在：**唯一落点 = 军务 · 军务处**（`ui.marchAffairsHTML` 里的两营卡片）；
   *   本函数降级为**一行指引**（保留计数 + 一键跳转），供校场 / 行军 / 行军弹窗使用。
   * ============================================================ */
  ui.WOUNDED_HOME_TXT = '伤兵营与俘虏营统一在「军务 · 军务处」——逐兵种清单、治疗归队、收编 / 释放都在那里。';
  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = GAME.healFeeOf ? GAME.healFeeOf(n) : n * 10;   /* v89.115：走唯一出口 */
    return '<div class="wounded-box"' + (host ? ' data-heal-host="' + host + '"' : '') + '>' +
      '<div class="wb-head">' +
        '<span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(n, 0) + ' 名</span></div>' +
      '<div class="attr"><span class="k">治疗费</span><span class="v">' +
        (n ? (U.numText(fee, 0) + ' 金') : '—') + '</span></div>' +
      '<div class="wb-act">' +
        '<button class="btn' + (n ? ' gold' : '') + '" data-action="go-affairs">🏥 去军务处' +
          (n ? '（治疗 / 逐兵种清单）' : '（伤兵营）') + '</button>' +
      '</div></div>';
  };

  /* ⛔ v89.133（v89.128 第二批第 10 条 · 老板）：「校场不要现在的界面功能，点击建筑功能
     直接进入'军务'界面」—— 校场面板（openXiaochang）整条退役：
       · 出征 / 出征战术 → 「军务 · 出征 / 出征战术」页（main.js 的 open-xiaochang 改跳转）；
       · 伤兵营 → 「军务 · 军务处」（v89.116 起的唯一落点）；
       · 演武 / 阅兵（v89.80 练兵）→ 迁到「出征战术」页尾（见 ui.trainBlockHTML）。 */
  /* ⛔ v89.136 移除：`ui.trainBlockHTML`（练兵块 · 演武 / 阅兵）——
     老板第 4 条：「不要练兵 · 校场这个菜单和演武和阅兵，相应功能去除」。
     随本块一并退役：动作 `xc-spar` / `xc-review` / `xc-gen-pick`（main.js 墓碑）、
     域函数组 `GAME.xcSpar / xcReview / …`（domain.js 墓碑）、数据表 `DATA.XIAOCHANG`（data.js 墓碑）。
     校场建筑本身保留（出征队列 / 每队兵力上限的限额职能不变，见 BLDG_FUNC）。 */

  ui.openMarches = function () {
    var s = GAME.state;
    var list = s.marches || [];
    /* v20（需求 9）：弹窗内分页，重绘弹窗自身 */
    var pgM = ui.modalPage('marches', list, 8, function () { ui.openMarches(); });
    list = pgM.slice;
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var city = GAME.cityById(m.cityId);
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="ctr">' + (city ? U.escape(city.name) : '—') + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td class="ctr">' + md.name + '</td>' +
        '<td style="min-width:120px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.label + '</span></td>' +
        '<td class="ctr"><button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td>' +
        '</tr>';
    }).join('');
    var body = list.length
      ? '<table class="tbl"><thead><tr><th>目标</th><th>主将</th><th>出发城</th><th>兵力</th><th>方式</th><th>行军进度</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<div class="q-empty">当前没有行军队列</div>';
    ui.openModal(
      '<div class="gold-heading">🛫 行军队列（' + list.length + '）</div>' +
      ui.woundedBlock('marches') +
      body +
      pgM.pager +
      (list.length ? '<div style="text-align:center;margin-top:10px;"><button class="btn gold" data-action="march-rush">⚡ 急行军令（立即抵达）</button></div>' : '') +
      '<div style="text-align:center;margin-top:10px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.135（老板 7）：行军进度/倒计时逐秒刷新（分页状态在 _pages，重开不丢） */
      { live: function () { ui.openMarches(); } }
    );
  };

  /* ============================================================
   * 行军视图（v19 · 需求 6）：监控**本城在外军队**
   *   ① 行军中：出发 → 抵达的队列（可召回）
   *   ② 在外驻军：野地采集队（可收获/撤回）
   * ============================================================ */
  /* ============================================================
   * v89.86（整改 P-20）：行军视图 → **军务总览**
   * ------------------------------------------------------------
   * 老板实测：91 兵散在 4 块野地、2 支采集队在外，全站没有一个页面能
   * 一眼看全"我的兵都在哪"（只能逐块点开野地弹窗）。
   * 本页收敛为五段：城内 / 驻守野地 / 采集队 / 行军 / 伤兵。
   * data-view="marches" 与既有动作（召回 / 收获 / 治疗）一字未动 —— 只换内容。
   * ============================================================ */
  /* ============================================================
   * 战场界面（v89.87 · 老板需求 4）：实时观战 + 逐回合指挥
   * ------------------------------------------------------------
   * · 距离轴战场：左我军 / 右敌军，位置 = 推进度（adv）映射；
   *   CSS `transition: left` 做位移动画 —— 每回合结算后两军"看着走"；
   * · 逐兵种指令：前进 / 驻守 / 后退 + 指定目标（敌方兵种 / 城防箭塔）；
   * · 读秒：`settings.battleSec` 真实秒（默认 60）—— 到点自动结算本回合，
   *   点「完成回合」立即结算（老板需求：完成后立即完成该回合）；
   * · 「自动战斗」一键跑完；关闭 = 转后台（军务总览「征战中」可再进）；
   * · 单例：同一时刻只展示一个战场（其他挂起战斗在军务里切换）。
   * ============================================================ */
  ui._bt = null;                    /* { id, lastRound, playing, timer } */
  ui.btStanceName = { advance: '前进', hold: '驻守', retreat: '后退' };
  ui.btSideName = function (side) { return side === 'atk' ? '我军' : '敌军'; };

  /* ---- 按推进度映射横轴位置（%）：我军 4→46，敌军 96→54 ---- */
  /* ============================================================
   * v89.103（老板「两方应该在同一片战场上战斗」）：**共享距离轴**
   * ------------------------------------------------------------
   * 改前：我军钉在 4%→46%、敌军钉在 96%→54% —— 各自只走半个场，
   *       中间 8% 是**永久空档**，两半的兵永远不接触（老板原话）。
   * 现在：两个方向共用一条轴（0 = 我军出发线，D = 敌军出发线），
   *       映射到 4%..96% —— 双方都推进到中线就**照面**，
   *       谁的前沿被歼，谁的线就往自己出发线退。
   * ⚠️ 唯一出口：实时战场（bt-field）与战报沙盘（sd-field）都读它。
   * ============================================================ */
  ui.btPosPct = function (side, adv, D) {
    var f = Math.max(0, Math.min(1, (adv || 0) / (D || 1)));
    return side === 'atk' ? (4 + f * 92) : (96 - f * 92);
  };
  /* 共享轴坐标（0 = 我军出发线，D = 敌军出发线）→ 屏上 % —— 接触线/前线画在轴上 */
  ui.sdAxisPct = function (pos, D) {
    return ui.btPosPct('atk', Math.max(0, Math.min(D || 1, pos || 0)), D);
  };

  /* 间距读数（唯一出口）：**开打前**也要给真间距，不能拿"纵深"顶替 ——
     v89.116（老板「战场间距似乎不对，确认间距规则」）实证：
       旧代码 `rec.gapLast == null ? snap.field : rec.gapLast` 在第一帧之前
       显示的是**纵深 1400**（整片战场），而真实间距是 1400−100−100 = **1200**。
     间距规则（引擎 frontsOf 唯一出口）：
       posA = 我方最前推进度；posD = 纵深 − 敌方最前推进度；
       gap = max(0, posD − posA)；两军各自推进到"进入自己有效射程"就停 → gap 会稳定在
       较近战的一方射程上（长枪对长枪实测稳定在 50）。 */
  ui.btGapOf = function (rec, snap) {
    if (rec && rec.gapLast != null) return rec.gapLast;
    try { return GAME.tactic.frontsOf(snap.atk || [], snap.def || [], snap.field || 1).gap; }
    catch (e) { return null; }
  };
  /* v89.149（老板 7）：「左上备注：间距 30，**这里的间距统一设置为最近距离/全局战场距离**」——
     读数文案**唯一出口**（战场顶栏 / 沙盘顶栏 / 实时刷新都读它，不再各写一串）：
       最近距离 = 两军最前线之间的距离（= 引擎 frontsOf 的 gap；推进到进入射程即停）
       全局     = 战场纵深（由双方配兵决定，见 tactic.battlefieldOf）
     改前只写"间距 30" —— 玩家不知道 30 是什么尺度、更不知道战场有多深。 */
  ui.gapReadOf = function (gap, D) {
    /* v89.151（老板旧账 7）：「读数统一，**距离 XX/XX**」——
       v89.149 曾作「最近距离 X / 全局 D」两段标签，现收敛为**一段双数**：
       前数 = 两军最前线距离（引擎 frontsOf 的 gap）· 后数 = 战场纵深（双方配兵决定）。
       详细解释仍走 title（btGapTextOf），读数本身只留数字。 */
    var near = (gap == null) ? '—' : U.numText(gap, 0);
    return '距离 <b>' + near + '</b>' + (D ? ' / <b>' + U.numText(D, 0) + '</b>' : '');
  };
  ui.btGapTextOf = function (rec, snap, rGap) {
    var gp = (rGap == null) ? ui.btGapOf(rec, snap) : rGap;
    var D = (snap && snap.field) || null;
    return '<span id="bt-gap" title="距离 = 两军最前线之间的距离（纵深 − 双方推进度；'
      + '推进到进入射程即停）/ 后数 = 战场纵深（双方配兵决定）">'
      + ui.gapReadOf(gp, D) + '</span>';
  };
  /* ---- 顶部条 ---- */
  /* v89.175：智能指示 span 的**唯一出口**（btTopHTML 首绘 + btAfterStep 每回合同步）。
     老板「每回合我要看见调整（可以不动，但需要显示智能调兵完成）」：
     文本 = "⚡ 智能 · 调整 N / 维持"（读 rec.smartNote 快照）；
     title = 赛马采用的目标策略 + 本回合明细（前 6 条）。 */
  ui.btSmartHTML = function (rec) {
    if (!(GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf() && rec && rec.side === 'atk')) return '';
    var sn175 = rec.smartNote;
    var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[rec.smartRule] || rec.smartRule || '静态表';
    var tip175 = '智能战斗：赛马采用「' + rc175 + '」——' + (sn175 && sn175.n
      ? ('本回合调整 ' + sn175.n + ' 项：' + (sn175.notes || []).slice(0, 6).join('；'))
      : '本回合维持阵型（无需调整）')
      + '。切换在「出征 / 自动出征 · 战术」下拉。';
    return '<span class="bt-smart" title="' + U.escape(tip175) + '">⚡ 智能'
      + (sn175 ? (' · ' + (sn175.n ? ('调整 ' + sn175.n) : '维持')) : '') + '</span>';
  };
  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    /* v89.120（老板「那三个雷霆大按钮，完成回合、自动战斗、撤回。缩小，
       放到战场上方读秒那行正中间」）：三键从弹窗底栏移到读秒行 ——
       `.bt-top` 改 grid 三列（左=读数 / 中=三键 / 右=提示），按钮降为 btn sm；
       长说明挪进 title（别与中间按钮挤）。 */
    return '<div class="bt-top">' +
      '<span class="bt-left">' +
        '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
        '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
        /* v89.164（老板 3）：智能战斗指示 —— 开着时玩家能看出"为什么接敌自动变防御"；
           切换入口在出征 / 自动出征面板的「战术」下拉。守城战不受托管（不显示）。
           v89.175（老板 1）：指示带**本回合调整**（"调整 N"/"维持"）+ 赛马策略；
           唯一出口 ui.btSmartHTML —— 首绘与每回合同步共用（见 btAfterStep）。
           ⚠️ 顶栏首绘于"进战场"那一刻、打回合时**不整体重建** —— 所以 btAfterStep
           必须显式同步这个 span（否则后缀停在上一次快照 = "看不见调整"）。 */
        ui.btSmartHTML(rec) +
        ui.btGapTextOf(rec, snap) +
        ui.btLossHTML(rec, snap) +
      '</span>' +
      '<span class="bt-acts" id="bt-acts">' +
        '<button class="btn sm gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn sm" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn sm" data-action="bt-retreat">🏳️ 撤退</button>' +
      '</span>' +
      /* ⛔ v89.149（老板 6）「不要这个备注：左侧设动作/目标」整条退役 ——
         动作/目标就在两侧下拉里（点一下就知道）；右列留空后三键仍居中（grid 1fr auto 1fr）。 */
      '</div>';
  };

  /* ---- 战场条：**只画兵种图标**（数量在两侧列表的图标下 —— 老板需求 8） ---- */
  ui.btFieldHTML = function (snap) {
    var D = snap.field || 1;
    /* v89.103：两军共用一条距离轴 → 交战时会在同一 x 上照面。
       于是敌方每队**下移半行**（21px）——"我方第 i 队 vs 敌方第 i 队"上下相邻，
       兵牌不会互相遮住，接触时看起来就是"贴上了"。
       v89.116：令牌内容收敛为**一枚图标** —— 名称与数量都不在场上（数量看左右列表）。 */
    /* v89.149（老板 5）：「中间战场区域的下方**拉到回合记录的上方**（高度拉高）」——
       改前：高度 = 兵种行数 × 42 + 35（内容撑高）——3 队时只有 203px，而 board 行 339px
       → 战场条底边离回合记录留 **140px** 空白（实机实测）。
       改后：高度交给 CSS（`.bt-field { height: 100% }` 填满 board 行），兵牌按 `--rel` **纵向铺满**：
         atk 第 i 队 → rel = i / n；def 第 i 队 → rel = (i + 0.5) / n（错半行，与 v89.103 同规）。
       `--rel` 是无单位数，CSS 用 `top: calc((100% - 牌高) * var(--rel))`；
       兵种数 > 8 队时挂 `dense` 档（牌与图标缩一档），12 队也能一屏放下。 */
    /* v89.176（老板「谁在下一回合接敌」）：接敌预测一次算好 ——
       兵牌角标（本函数）与顶栏读数（btLossHTML）读同一个出口（contactForecast）。 */
    var _inc176 = {};
    try {
      var _fc176 = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      if (_fc176) _inc176 = _fc176.engage || {};
    } catch (e) { _inc176 = {}; }
    function uHTML(u, idx, side, denom) {
      /* v89.117（老板「兵种数量降为 0（该兵种被消灭后），战场上的兵种图标变暗」）：
         初绘就带 dead（后台推进时可能"没动过就全灭"），后续由 btSyncCounts 增删。 */
      var rel = ((idx + (side === 'def' ? 0.5 : 0)) / denom).toFixed(4);
      /* v89.150（老板 1）：兵牌外框按兵种三档（步 / 骑 / 器械）—— 形态走唯一出口
         GAME.troopShapeOf（界面只回显；宽度差由 CSS 的 --u-w 三档实现）。 */
      var _sh150 = (GAME.troopShapeOf ? GAME.troopShapeOf(u.id) : 'inf');
      /* v89.151（老板 5）：悬停从 title（纯文本）改**富浮层**（#tip-layer 走 data-tip-el 机制）
         —— 克制/被克要绿字红字，title 装不下颜色。文案与侧栏共用同一出口 `ui.btUnitTip`。 */
      return '<div class="bt-unit ' + side + ' ' + _sh150 + (u.count > 0 ? '' : ' dead')
        + (_inc176[side + '|' + u.id] ? ' incoming' : '') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'data-tip-el="1" ' +
        'style="left:' + ui.btPosPct(side, u.adv, D) + '%;--rel:' + rel + ';">' +
        '<span class="bt-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></div>';
    }
    var nA = (snap.atk || []).length, nD = (snap.def || []).length;
    /* v89.149：铺满口径 —— 分母 = max(两侧行数) − 0.5（def 侧错半行，末位正好落 1.0 = 贴底）
       → 第一枚贴顶、最后一枚贴底，整叠**纵向铺满**；单兵种（rows=1）时退化为"上半场"，
       不把两支孤军甩到战场两端（分母下限 1）。 */
    var _rows149 = Math.max(1, Math.max(nA, nD));
    var denom149 = Math.max(1, _rows149 - 0.5);
    var atkH = (snap.atk || []).map(function (u, i) { return uHTML(u, i, 'atk', denom149); }).join('');
    var defH = (snap.def || []).map(function (u, i) { return uHTML(u, i, 'def', denom149); }).join('');
    var cast = snap.towers
      ? '<div class="bt-castle">🏯 箭塔 <b id="bt-tower">' + snap.towers.left + '</b> / ' + snap.towers.start + '</div>'
      : '';
    return '<div class="bt-field' + ((Math.max(nA, nD) > 8) ? ' dense' : '') + '" id="bt-field">'
      + atkH + defH + cast
      /* v89.176（老板「沙盘与战场沙盘统一化」）：与战报沙盘共用三线 + 标尺
         （同一把 frontsOf 口径；line/scale 的唯一出口在 fieldLinesHTML/fieldScaleHTML） */
      + ui.fieldLinesHTML(ui.btSideName, snap.atk || [], snap.def || [], D, 'bt-fl')
      + ui.fieldScaleHTML(ui.btSideName, D) + '</div>';
  };

  /* ============================================================
   * v89.116（老板需求 8）：两侧兵种列表（各占 1/4）
   * ------------------------------------------------------------
   * 一行 = 图标 + **图标下的数量** + 动作下拉 + 目标下拉。
   *  · 我方（atk）：两个下拉都可改（动作 = 前进 / 驻守 / 后退；目标 = 敌方兵种 / 箭塔）；
   *  · 敌方（def）：**只读**，默认动作=前进、目标=我方同兵种（引擎级默认，见 tactic.unitsOf）。
   * 动作从"三个并排按钮"改成**一个下拉框**（老板：「不要直接列出，节省空间」）——
   * 下拉走既有 `change → GAME.action` 分发（main.js），动作名 `bt-stance` 不变。
   * ============================================================ */
  /* ============================================================
   * v89.136（老板 2）：「军队战斗界面我军和敌军上方显示双方将领，悬停可显示将领六维」
   * ------------------------------------------------------------
   * 数据来源（同一出口）：
   *   · 我方 = rec.genId → state.generals（实时对象，含装备加成后的六维）；
   *   · 敌方 = rec.sim.scGen（**确定性守将快照** —— 与侦查/战斗同一个 guard）。
   * 六维悬停 = ui.GEN_DIMS × GAME.genAttrs（不手抄字段，防漂移）。
   * ============================================================ */
  /* ============================================================
   * v89.137（老板 2）：「军队战斗界面，鼠标悬停兵种时，显示其**最终属性**
   *   （各种科技，将领等加成后）」——
   * 唯一出口 = GAME.battle.unitFinalOf（它再读引擎的 perAtk / perDef / perHp，
   * 悬停与结算同一把尺）；本函数只负责"取该单位所属方的将领 + 排版"。
   * 将领来源与 btGenLine 同源：我方 = rec.genId；敌方 = rec.sim.scGen。
   * ============================================================ */
  /* ============================================================
  /* v89.179：克制系统全撤 —— `ui.troopCounterOf`（克制/抗性/被克反查，v89.151 唯一出口）
     随两张相克表一并退役；兵种悬停不再有"克制 / 抗性 / 被克"三行
     （v89.157 的"无相克不显示"至此演进为"全局无相克"）。 */
  ui.btUnitTip = function (u, side) {
    if (!u) return '';
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var gen = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) gen = x; });
      } else {
        gen = (rec.sim && rec.sim.scGen) || null;
      }
    }
    var f = GAME.battle.unitFinalOf ? GAME.battle.unitFinalOf(u, gen) : null;
    if (!f) return U.escape(u.name || '');
    /* v89.151（老板 5）：改成**富浮层 HTML** —— 排版按老板指定自上而下：
       兵种 → 数量 → 射程（并速度）→ 全军血量 → 全军攻击 → 全军防御 →
       收尾一行带队与加成说明（v89.179：克制三行随全撤删除）。
       ⛔ 显示"计算值"：血/攻/防都走 unitFinalOf（同一把尺，含科技/将领/装备加成）。 */
    var h = '<div class="tip-t">' + U.escape(f.name) + '</div>';
    h += '<div class="tip-l">数量 <b>' + U.fmt(f.count) + '</b> 名</div>';
    h += '<div class="tip-l">射程 <b>' + U.fmt(f.range) + '</b>　速度 <b>' + U.fmt(f.spd) + '</b></div>';
    h += '<div class="tip-l">全军血量 <b>' + U.fmt(f.totalHp) + '</b></div>';
    h += '<div class="tip-l">全军攻击 <b>' + U.fmt(f.totalAtk) + '</b></div>';
    h += '<div class="tip-l">全军防御 <b>' + U.fmt(f.totalDef) + '</b></div>';
    /* v89.180（老板 1）：拆械特性行（床弩专属 · 有才显示） */
    var _tt180 = DATA.TROOPS[u.id];
    if (_tt180 && _tt180.vsMech) h += '<div class="tip-l">拆械 对器械伤害 ×' + _tt180.vsMech + '</div>';
    /* v89.179：克制/抗性/被克三行随全撤删除。 */
    h += '<div class="tip-a">' + (gen ? '带队 ' + U.escape(gen.name) + '（Lv' + (gen.level || 1) + '）· ' : '（无将领带队）· ')
      + '已含科技 / 将领 / 装备加成</div>';
    return h;
  };

  ui.btGenTip = function (g) {
    if (!g) return '';
    var a = GAME.genAttrs(g);
    return (ui.GEN_DIMS || []).map(function (d) {
      return d.n + ' ' + (a[d.val || d.k] || 0);
    }).join(' · ');
  };
  ui.btGenLine = function (side) {
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var g = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) g = x; });
      } else {
        g = (rec.sim && rec.sim.scGen) || null;
      }
    }
    if (!g) return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '">' +
      '<span class="bt-gen-q">将领：—</span></div>';
    var tip = '将领 ' + (g.name || '—') + '（Lv' + (g.level || 1) + '）\n' + ui.btGenTip(g);
    return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '" title="' + U.escape(tip) + '">' +
      '⚔ ' + U.escape(g.name || '—') + '<span class="bt-gen-lv">Lv' + (g.level || 1) + '</span></div>';
  };

    /* ============================================================
   * v89.149（老板 4）：「不要再显示"目标："这样的标识」——
   *   目标文案**唯一出口**（战场两侧只读行 + 沙盘只读行都读它）：
   *     同兵种（打对面同名兵种）/ 城头箭塔 / 兵种名 / 任意。
   *   ⚠️ "同兵种"的判定 = `target === 自己的兵种 id`（引擎的匹配规则就是按 id 找对面那支），
   *   不是界面自造的语义 —— 界面只做回显。
   * ============================================================ */
  ui.btTargetLabelOf = function (u, foeList) {
    var tg = (u && u.target) || '';
    if (!tg) return '任意';
    if (tg === DATA.TARGET_WALL) return '城头箭塔';
    if (u && tg === u.id) return '同兵种';
    var hit = (foeList || []).filter(function (x) { return x.id === tg; })[0];
    return hit ? U.escape(hit.name) : U.escape(tg);
  };
  ui.btSideHTML = function (snap, side) {
    var foeList = (side === 'atk') ? (snap.def || []) : (snap.atk || []);
    var mine = (side === 'atk');
    var myList = mine ? (snap.atk || []) : (snap.def || []);
    /* v89.140（老板 1）：「左右的兵种设置这里建议不要图标了，直接**第一行是兵种名称+行动，
       第二行是数量+目标**。然后还是**只显示在场的兵种**吧，没有的就不要了」——
       于是：① 去掉 `.bt-ico`；② 每格两行（名+动作 / 数+目标）；③ 只遍历**参战**列表
       （v89.139 的"全兵种 + 灰暗占位"整段退役）。 */
    var rows = myList.map(function (u) {
      var alive = u.count > 0;
      var stOpts = ['advance', 'hold', 'retreat'].map(function (s) {
        return '<option value="' + s + '"' + ((u.stance || 'advance') === s ? ' selected' : '') + '>'
          + ui.btStanceName[s] + '</option>';
      }).join('');
      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**……
         不要再显示'目标：'这样的标识」——选项 = 同兵种（默认）/ 任意 / 各敌兵种（只写名字）/ 城防箭塔。
         默认值不在界面造：**引擎**里给（`unitsOf`：未设目标 → 打同兵种），界面如实回显 ——
         史实与沙盘重跑才同源（§20.5 v89.116 的规矩）。 */
      var tOpts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foeList.forEach(function (d) {
        if (d.id === u.id) return;                    /* 同兵种已在首项，不重复列 */
        tOpts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (snap.towers && snap.towers.left > 0) {
        tOpts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '')
          + '>城防箭塔</option>';
      }
      /* 悬停"最终属性"移到**名称**上（图标没了，名称即靶心）；
         v89.149（老板 3）：「为兵种设置一个**一字简称**，不要挤压行动设置和目标设置」——
         名称改简称（`GAME.troopAbOf` 唯一出口），全名与最终属性都还在悬停里（信息不丢）。
         实测改前：格子 105px，名字吃掉 60px → 两个下拉只剩 31px / 57px。 */
      return '<div class="bt-card' + (alive ? '' : ' dead') + '" data-row="' + side + '-' + u.id + '">' +
        '<span class="bt-l1">' +
          /* v89.151（老板 5）：同走富浮层（与兵牌同一出口）—— 简称是悬停靶心 */
          '<i class="bt-rnm" data-tip-el="1">' + U.escape(GAME.troopAbOf(u.id))
            + '<span class="tip-src">' + ui.btUnitTip(u, side) + '</span></i>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-stance" data-troop="' + u.id + '" id="bt-s-' + u.id + '">'
                + stOpts + '</select>'
            : '<span class="bt-ro">' + (ui.btStanceName[u.stance] || u.stance) + '</span>') +
        '</span>' +
        '<span class="bt-l2">' +
          '<b class="bt-rn" id="bt-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
          (mine
            ? '<select class="bt-sel" data-action="bt-target" data-troop="' + u.id + '" id="bt-t-' + u.id + '">'
                + tOpts + '</select>'
            : '<span class="bt-ro">' + ui.btTargetLabelOf(u, foeList) + '</span>') +
        '</span></div>';
    }).join('');
    return '<div class="bt-side ' + (mine ? 'mine' : 'foe') + '" id="bt-side-' + side + '">' +
      /* v89.148（老板 3）：「上方这个备注去掉：我军（3 队）、敌军（5 队）」——
         表头只留"我军 / 敌军"（队数在下方各兵种卡上一目了然）。 */
      '<div class="bt-side-h">' + ui.btSideName(side) + '</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方将领，悬停可显示将领六维」 */
      ui.btGenLine(side) +
      '<div class="bt-cards">' + (rows || '<div class="q-empty">无</div>') + '</div></div>';
  };
  /* ============================================================
   * v89.176（老板「减少伤亡很重要」+「让问题记录和暴露，以便分析和改进」）：
   * **损失读数**（唯一出口）——从快照的 start↔count 算双方损失率
   * （v89.151 起快照带 start）；无 start（老快照/桩数据）→ 返回 null 不渲染。
   * ============================================================ */
  ui.btLossOf = function (snap) {
    if (!snap) return null;
    function sum(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? { pct: (s0 - s1) / s0, s0: s0, s1: s1 } : null;
    }
    var a = sum(snap.atk), d = sum(snap.def);
    return (a || d) ? { a: a, d: d } : null;
  };
  /* 顶栏损失 span：常态 / .warn（近撤退线）/ .danger（达线）；含接敌计数（与角标同源） */
  ui.btLossHTML = function (rec, snap) {
    var L = ui.btLossOf(snap);
    if (!L) return '';
    var aPct = L.a ? Math.round(L.a.pct * 100) : 0;
    var dPct = L.d ? Math.round(L.d.pct * 100) : 0;
    var incN = 0;
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast((snap && snap.atk) || [], (snap && snap.def) || [],
            (snap && snap.field) || 1) : null;
      Object.keys((fc && fc.engage) || {}).forEach(function (kq) {
        if (kq.indexOf('atk|') === 0) incN++;
      });
    } catch (e) { incN = 0; }
    var ra = GAME.battle.retreatAtOf(), wa = GAME.battle.warnAtOf();
    var cls = (aPct / 100 >= ra) ? ' danger' : ((aPct / 100 >= wa) ? ' warn' : '');
    var tip = '我军损失 ' + aPct + '%（撤退线 ' + Math.round(ra * 100) + '% —— 到线且非名城目标将自动撤退）'
      + ' · 敌军损失 ' + dPct + '%' + (incN ? ' · 下一回合 ' + incN + ' 支将交手' : '');
    return '<span class="bt-loss' + cls + '" id="bt-loss" title="' + U.escape(tip) + '">📉 我损 '
      + aPct + '% · 敌损 ' + dPct + '%' + (incN ? ' · ⚔ ' + incN : '') + '</span>';
  };
  /* 接敌角标随回合同步（btAfterStep 调）——预测重算 + DOM 类增删（与初绘同出口） */
  ui.btMarkIncoming = function (snap) {
    if (!snap || !document.querySelectorAll) return;
    var D = snap.field || 1;
    var inc = {};
    try {
      var fc = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(snap.atk || [], snap.def || [], D) : null;
      inc = (fc && fc.engage) || {};
    } catch (e) { inc = {}; }
    [['atk', snap.atk || []], ['def', snap.def || []]].forEach(function (pair) {
      pair[1].forEach(function (u) {
        var fu = document.querySelector('#bt-field .bt-unit[data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('incoming', !!inc[pair[0] + '|' + u.id]);
      });
    });
  };

  /* 上部分整块（左我军 · 中战场 · 右敌军） */
  ui.btBoardHTML = function (snap) {
    return '<div class="bt-board" id="bt-board">' +
      ui.btSideHTML(snap, 'atk') + ui.btFieldHTML(snap) + ui.btSideHTML(snap, 'def') + '</div>';
  };

  /* ⛔ v89.116：`ui.btCmdHTML`（旧"逐兵种指令"块：三个并排按钮 + 目标下拉）**整条退役** ——
     动作/目标的设置全部搬进两侧兵种列表（`ui.btSideHTML`，动作改下拉框）。
     老板：「前进驻守撤退通过下拉框选择，不要直接列出，节省空间」。 */

  /* ============================================================
   * v89.142（老板 7）：「斗将战从未触发。**直接在回合战况这里播报即可**。
   *   斗将后自动开始军队战」
   * ------------------------------------------------------------
   * 病根（探针 probe_v89142b 实证）：斗将掷了、日志也写了，但
   *   ① 挂起会话 rec.sim **漏存 duel/genSim** → 结算后战报没有【斗将】段、
   *      我方斗将加成丢失（只有守方 scGen 带加成生效）；
   *   ② 回合战况（本函数下方的 #bt-log）**从来没有斗将行** —— 玩家全程看不见。
   * 播报口径：斗将不属于任何回合 → 固定压在播报窗**最底 = 时间最早**处；
   *   数据源 = `rec.sim.duel`（挂起时随会话保存的权威结果，绝不重掷）。
   *   新回合块插到顶部，这一行自然随之下沉，最后与最旧回合一起被 BT_LOG_MAX 裁掉。
   * ============================================================ */
  /* v89.144（老板 1）：斗将结果**文案的唯一出口**（顶部固定行与回合战况行同源 —— 改文案只改这里） */
  ui.btDuelLine = function (rec) {
    var d = (rec && rec.sim && rec.sim.duel) || null;
    if (!d || !d.done) return '';
    var side = (d.winner === 'atk') ? '我方' : '敌方';
    var pct = Math.round((d.bonusPct == null ? 0.10 : d.bonusPct) * 100);
    return '⚔ 战前斗将：' + (d.rounds || 3) + ' 合，' + side + '将领 ' + (d.winnerName || '') +
      ' 胜（' + (d.wa || 0) + ' : ' + (d.wb || 0) + '）· 其全军 +' + pct + '%（限本战）';
  };
  ui.btDuelHTML = function (rec) {
    var line = ui.btDuelLine(rec);
    return line ? '<div class="bt-ev duel">' + U.escape(line) + '</div>' : '';
  };
  /* ⛔ v89.148（老板 2）退役：`ui.btDuelBarHTML`（战场最顶的固定斗将行）——
     老板原话：「这个播报出现在 2 处，**保留回合记录中的就行**」。
     保留的那一处 = `ui.btDuelHTML`（#bt-log 里的 `.bt-ev.duel` 行）；
     文案唯一出口 `ui.btDuelLine` 不变（两处曾同源，现在只剩一处读它）。 */
  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    /* v89.116（老板需求 8）：上 = 三列（兵种列表 · 战场 · 兵种列表）；
       下 = **战况回合播报**（一回合一行，行动与战果同行）。
       v89.142：播报窗**预置战前斗将行**（重绘即恢复，不额外挂载）。 */
    return ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log">' + ui.btDuelHTML(rec) + '</div>';
  };

  /* ============ 打开 / 关闭 ============ */
  /* ============================================================
   * v89.150（老板 5）：「不要主动直接弹出战斗界面，如果目前触发新战斗，提供一个弹窗，
   *   假设同时有多场战斗，简洁提供上方标题，下方表格样式的：目标，战斗类型，是否观战按钮」
   * ------------------------------------------------------------
   * 旧：行军抵达（`onMarchArrive`）→ **直接进战场**（玩家正在做别的事也被拽走）。
   * 新：弹本清单 —— **所有待指挥战斗**（`state === 'live'`）一处列出，多场并列；
   *   点「观战」才进战场。不点也行：战斗按 `settings.battleSec` 逐回合自动推进
   *   （后台照打，只是没有即时指挥）。
   * ============================================================ */
  ui.battleListOf = function () {
    return (((GAME.state || {}).battles) || []).filter(function (b) { return b.state === 'live'; });
  };
  /* 目标名：`rec.target` 存的是**原始目标**（`{kind:'wild',x,y}` —— 没有 name），
     名字要经 `GAME.battle.resolveTarget` 解析（与出征面板/预估**同一出口**，
     §18.2 的老规矩：界面读数一律用解析后的对象）。 */
  ui.battleListNameOf = function (t) {
    if (!t) return '（未知目标）';
    if (t.name) return t.name;
    try {
      var rt = (GAME.battle && GAME.battle.resolveTarget) ? GAME.battle.resolveTarget(t) : null;
      if (rt && rt.name) return rt.name;
    } catch (e) { /* 目标已不存在（被占/被拔）→ 落兜底 */ }
    return '（目标已变更）';
  };
  ui.battleListRowsHTML = function (list) {
    return (list || []).map(function (b) {
      var t = b.target || {};
      var mode = (GAME.battle && GAME.battle.modeOf) ? GAME.battle.modeOf(b.modeId) : null;
      var type = (b.side === 'def') ? '守城' : (((mode || {}).name) || '战斗');
      return '<tr>' +
        '<td>' + U.escape(ui.battleListNameOf(t)) + '</td>' +
        '<td>' + U.escape(type) + '</td>' +
        '<td class="num"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">👁 观战</button></td>' +
        '</tr>';
    }).join('');
  };
  /* ============================================================
   * v89.163（老板 1）：「导航栏 · 指挥战斗，将行军中的军队也显示在这个菜单中，多一个入口」——
   *   清单从"只有待指挥战斗"扩为**两段**：⚔ 战斗待指挥（观战）+ 🛫 行军中的军队（召回）。
   *   两段的只读出口各自唯一：`ui.battleListOf`（战斗 live）/ `ui.marchListOf`（行军中）。
   *   抵达自动弹（main.onMarchArrive）与底栏按钮共用本出口 —— 一份清单，两处入口。
   * ============================================================ */
  ui.marchListOf = function () {
    return (((GAME.state || {}).marches) || []);
  };
  ui.marchRowsHTML = function (list) {
    var s = GAME.state || {};
    return (list || []).map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td style="min-width:120px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.label + '</span></td>' +
        '<td class="ctr"><button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td>' +
        '</tr>';
    }).join('');
  };
  ui.battleListHTML = function () {
    var list = ui.battleListOf();
    var mList = ui.marchListOf();
    var sec = ((GAME.state || {}).settings || {}).battleSec || 60;
    var h = '<div class="war-list">';
    h += '<div class="gold-heading">⚔ 战斗待指挥（' + list.length + '）</div>';
    if (list.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:10px;">' +
        '共 <b style="color:var(--gold-light);">' + list.length + '</b> 场 ——— ' +
        '点「观战」进场指挥；不观战也会每 ' + sec + ' 秒自动推进一回合（后台照打）。</div>' +
        '<table class="tbl"><thead><tr><th>目标</th><th>战斗类型</th><th>是否观战</th></tr></thead>' +
        '<tbody>' + ui.battleListRowsHTML(list) + '</tbody></table>';
    } else {
      h += '<div class="q-empty">当前没有待指挥的战斗</div>';
    }
    h += '<div class="gold-heading" style="margin-top:16px;">🛫 行军中的军队（' + mList.length + '）</div>';
    if (mList.length) {
      h += '<table class="tbl"><thead><tr><th>军队</th><th class="ctr">主将</th><th class="num">兵力</th>' +
        '<th>行军进度</th><th class="ctr">操作</th></tr></thead>' +
        '<tbody>' + ui.marchRowsHTML(mList) + '</tbody></table>';
    } else {
      h += '<div class="q-empty">当前没有行军中军队（地图上对野地 / 据点 / 城池「出兵」即进入行军）</div>';
    }
    h += '</div>';
    return h;
  };
  ui.openBattleList = function () {
    /* v89.163：两段都空才不弹（改前只判战斗 —— 只有行军时也该进得来）。
       弹窗**已开着**时（.war-list 在）即使两段都空也**原地重绘** ——
       否则在清单里召回最后一条行军后会留下"幽灵行"（弹窗不刷新）。
       未开着且两段全空 → 只 toast。 */
    var opened = false;
    /* ⚠️ 用 querySelectorAll.length 而非 querySelector 真值 —— smoke 的 DOM 桩
       querySelector 恒返回假元素（永远 truthy），只有 querySelectorAll 会如实给 []。 */
    try { opened = !!(document && document.querySelectorAll
      && document.querySelectorAll('#modal-root .war-list').length > 0); } catch (e0) { opened = false; }
    if (!ui.battleListOf().length && !ui.marchListOf().length && !opened) {
      ui.toast('当前没有待指挥的战斗与行军中军队');
      return;
    }
    /* v89.165（老板：「指挥战斗界面的行军读秒和进度条不动」）：行军段含
       pbar + 「余 X」读秒 —— 与「行军队列」（openMarches）同口径接入 live
       每秒重开：读秒/进度条逐秒跳动；战斗段的行数增减也随之即时可见。 */
    ui.openModal(ui.battleListHTML(), {
      size: 'md',
      live: function () { ui.openBattleList(); },
    });
  };

  ui.openBattlefield = function (id) {
    var rec = GAME.battle._recOf(id);
    if (!rec) { ui.toast('战斗已结束（战报见公文）'); return; }
    ui.btTeardown();                             /* 单例：先拆旧的 */
    var ses = GAME._bsess && GAME._bsess[id];
    if (!ses) {
      try {
        GAME._bsess = GAME._bsess || {};
        GAME._bsess[id] = GAME.battle._makeEnv(rec);
        ses = GAME._bsess[id];
      } catch (e) { ui.toast('战斗会话不可用'); return; }
    }
    var snap = rec.snapLast || ses.snap();
    ui._bt = { id: id, lastRound: snap.round || rec.round || 0, playing: false, timer: null };
    ui._btRetreatArmed = false;                   /* v89.94：撤退两段确认，开界面即复位 */
    /* v89.139（老板 1）：副标题备注整条去掉（老板原话点名那行说明）——
       回合秒数由读秒行（bt-cd）表达、"转后台"由底栏按钮自身表达，不必再写一行副标题。 */
    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      /* v89.150（老板 4）：「战场战斗界面铺满界面，目前主要是左右留空了，导致战场画面被压缩」
         —— 档位 xxl(1200×850) → **max**（画布 − 16px，实测 1424×884）：
         左右留白清零、中间战场随宽度长出来（列宽见 index.html 的 .bt-board）。 */
      size: 'max',
      body: '<div id="bt-wrap">' + ui.battlefieldHTML(rec) + '</div>',
      /* v89.120：三键已移到读秒行（.bt-acts，见 ui.btTopHTML）——
         底栏只留"后台运行"（它是关闭键，由 openModal 统一剥离） */
      foot: '<button class="btn" data-action="close-modal">后台运行</button>',
      /* v89.150（老板 6）：「关闭战场后，不返回目标界面（野地或某城池）而会到点开弹窗的
         大界面，在哪里点开就回到哪里（如地图，城内或城外）」——
         `closeAll` = 该层关闭键走 closeAllModals（一次关净 → 回视图层）；
         否则会弹回上一级面板（出征界面/野地面板那类"中间界面"）。 */
      closeAll: true,
    });
    ui._bt.timer = setInterval(ui.btTick, 500);
  };

  /* 拆装（关闭界面 / 切换战斗）：恢复 rec.anim，防"动画卡住 → 后台停摆" */
  ui.btTeardown = function () {
    var bt = ui._bt;
    if (!bt) return;
    if (bt.timer) clearInterval(bt.timer);
    var rec = GAME.battle._recOf(bt.id);
    if (rec) rec.anim = false;
    ui._bt = null;
  };

  /* ---- 每 500ms：倒计时数字 + 检测"结算追上来"（后台/自动推进时补播） ---- */
  ui.btTick = function () {
    var bt = ui._bt;
    if (!bt) return;
    var rec = GAME.battle._recOf(bt.id);
    if (!rec) { ui.btShowEnd(bt); return; }
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = Math.max(0, Math.ceil(rec.cnt == null ? 0 : rec.cnt));
    if (!bt.playing && rec.round > bt.lastRound) {
      ui.btAfterStep(rec, { r: rec.round, gap: rec.gapLast, events: rec.evLast || [], snap: rec.snapLast });
    }
  };

  /* ---- 指令写入（chips / 下拉）→ 会话即时生效（本回合结算用得上） ---- */
  ui.btSetCmd = function (rec, troopId, patch) {
    rec.cmd = rec.cmd || {};
    var c = rec.cmd[troopId] = rec.cmd[troopId] || {};
    if (patch && patch.s) c.s = patch.s;
    if (patch && patch.t !== undefined) c.t = patch.t;
    var ses = GAME._bsess && GAME._bsess[rec.id];
    if (ses) ses.setCmd('atk', troopId, c);
    /* v89.149（老板 2）：「动作设置……**每回合可以重新设置**，如不动，则继承上回合设置」——
       重绘棋盘必须读**会话快照**（它含刚下达的待生效指令），不能读 `rec.snapLast`
       （那是**上一回合结束时**的快照 —— 实机实测：改成"后退"后棋盘立刻跳回"前进"，
        玩家以为"改了不生效"，而会话里其实已生效、下一回合按新指令打）。
       回读顺序反过来：`ses.snap() || rec.snapLast`。播放动画期间不重绘（位移动画正在跑）。 */
    var box = document.getElementById('bt-board');
    var snap = ses ? ses.snap() : (rec.snapLast || null);
    if (box && snap && !(ui._bt && ui._bt.playing)) box.outerHTML = ui.btBoardHTML(snap);
  };

  /* ---- 一回合结算后：更新顶栏 → 位移动画 → 逐条事件字幕 ---- */
  ui.btAfterStep = function (rec, r) {
    var bt = ui._bt;
    if (!bt || bt.id !== rec.id) return;
    bt.lastRound = r.r;
    var rd = document.getElementById('bt-round');
    if (rd) rd.textContent = r.r;
    var gp = document.getElementById('bt-gap');
    /* v89.149（老板 7）：实时刷新也走同一出口（最近距离 / 全局） */
    if (gp) gp.innerHTML = ui.gapReadOf(r.gap, (r.snap || rec.snapLast || {}).field);
    /* v89.175（老板 1）：智能指示随回合同步 —— 顶栏只在"进战场"时整绘一次，
       打回合不重建它，必须在这里显式刷新（否则"调整 N/维持"停在旧快照）。 */
    var smEl = document.querySelector('#modal-root .bt-smart');
    if (smEl) {
      var smNew = ui.btSmartHTML(rec);
      if (smNew && smEl.outerHTML !== undefined) smEl.outerHTML = smNew;
    }
    /* v89.176：损失读数与接敌角标随回合同步（顶栏不整体重建 —— 与 bt-smart 同规） */
    var _snap176 = r.snap || rec.snapLast || null;
    var lsEl = document.getElementById('bt-loss');
    if (lsEl && _snap176) {
      var lsNew = ui.btLossHTML(rec, _snap176);
      if (lsNew) lsEl.outerHTML = lsNew;
      else if (lsEl.parentNode) lsEl.parentNode.removeChild(lsEl);
    }
    if (_snap176) ui.btMarkIncoming(_snap176);
    /* v89.116：位移动画后再次对齐间距读数（r.gap 与 frontsOf 同源，此处只做同值确认） */
    ui.btPlay(rec, r, bt);
  };

  ui.btPlay = function (rec, r, bt) {
    bt.playing = true;
    rec.anim = true;                             /* 动画期间倒计时暂停 */
    var snap = r.snap || ((GAME._bsess[rec.id]) ? GAME._bsess[rec.id].snap() : null);
    if (snap) ui.btPlace(snap);                  /* ① 位置过渡（CSS transition） */
    var evs = (r.events || []).slice();
    /* v89.116（老板需求 8）：「战况回合播报放在下部分，行动和战果写在同一行，避免太多行」
       —— 一个回合**只写一行**（先把该回合的逐条事件压成一句话），
       逐条事件仍逐条播（只做受击闪烁），不再一行一条地刷屏。 */
    ui.btRoundLine(r, snap);
    var i = 0;
    function fin() {
      if (ui._bt && ui._bt.id === rec.id) ui._bt.playing = false;
      if (snap) ui.btSyncCounts(snap);
      rec.anim = false;
    }
    function next() {
      if (!ui._bt || ui._bt.id !== rec.id || i >= evs.length) { fin(); return; }
      ui.btEvent(evs[i++], true);                /* true = 静默（不写日志，只闪烁） */
      setTimeout(next, 260);
    }
    setTimeout(next, 620);
  };

  /* ============================================================
   * v89.117（老板需求 7）：「每回合一行太紧凑，可以每兵种各一行，兵种的移动、
   *   战斗动作放在同一行，根据出手时间先后，行数错开；不同回合之间虚线间隔」
   * v89.119（老板）：「反击应该在敌方出手后，而不是己方移动后直接反击…
   *   我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。
   *   反击和对方出手记录在同一行」
   * ------------------------------------------------------------
   * 唯一出口：本函数返回**结构化行**（side / name / txt / indent / cls），
   * 界面按它落 DOM，断言直接读返回值（不必赌 DOM）。
   *   · 分组键 = `side|兵种id`（引擎事件里带 id，见 tactic.js 的 events.push）；
   *   · **反击不再自建行** —— 并入"引发它的那次出手"（同一行、紧跟其后）：
   *     `进 30 · → 轻骑兵 歼 784（轻骑兵反击 歼 374）`；
   *   · **出手顺序** = 该兵种在本回合事件流里**首次出现**的下标（这就是引擎的结算顺序）；
   *   · 错开 = 按该下标递进缩进（每级 14px，最多 5 级 —— 再多就贴到右边缘了）。
   * ============================================================ */
  ui.btRoundLines = function (r, snap) {
    var evs = (r && r.events) || [];
    var foeName = {};
    ((snap && snap.atk) || []).forEach(function (u) { foeName[u.id] = u.name; });
    ((snap && snap.def) || []).forEach(function (u) { foeName[u.id] = u.name; });
    var order = [], by = {}, hostOf = {};
    function rowOf(side, id, name) {
      var key = side + '|' + (id == null ? (name || '_') : id);
      if (!by[key]) {
        by[key] = { side: side, id: id, name: name, moves: [], acts: [] };
        order.push(key);
      }
      return { key: key, g: by[key] };
    }
    evs.forEach(function (e) {
      if (!e || e.side == null) return;
      if (e.kind === 'counter') {
        /* 宿主键 = **对面阵营 + 出手者 id**（同名兵种互射也不串台） */
        var hKey = (e.side === 'atk' ? 'def' : 'atk') + '|' +
          (e.targetId == null ? (e.target || '_') : e.targetId);
        var host = hostOf[hKey];
        /* v89.136：带阵营 —— 文案按**反击者阵营**给词（我方行里的反击 = 敌方反击，反之亦然） */
        if (host) host.counters.push({ name: e.name, kill: e.kill, side: e.side });
        else {
          /* 兜底：找不到引发它的那次出手（异常数据）→ 独立成格，不静默丢事件 */
          var fr = rowOf(e.side, e.id, e.name);
          fr.g.acts.push({ txt: '反击 → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0) });
        }
        return;
      }
      var row = rowOf(e.side, e.id, e.name), g = row.g;
      if (e.kind === 'move') g.moves.push('进 ' + U.numText(e.step, 0));
      else if (e.kind === 'retreat') g.moves.push('退 ' + U.numText(e.step, 0));
      else if (e.kind === 'attack') {
        var act = { target: (e.target || foeName[e.targetId] || '敌'), kill: e.kill, counters: [] };
        g.acts.push(act);
        hostOf[row.key] = act;
      } else if (e.kind === 'tower') {
        g.acts.push({ txt: '拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）' });
      } else if (e.kind === 'wall') {
        g.name = '城头箭塔';
        g.moves.push('→ ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      } else if (e.kind === 'duel') {
        g.acts.push({ txt: '斗将：' + (e.txt || (e.win ? '胜' : '负')) });
      }
    });
    return order.map(function (key, i) {
      var g = by[key];
      var bits = g.moves.slice();
      g.acts.forEach(function (a) {
        if (a.txt != null) { bits.push(a.txt); return; }
        var s = '→ ' + a.target + ' 歼 ' + U.numText(a.kill, 0);
        if (a.counters && a.counters.length) {
          /* v89.136（老板 3）：①「'对方'应该是'我方'才对」——按反击者阵营给词；
             ②「这句应以白色字体显示，因为是我方动作」——我方片段包 U+0001/U+0002
             受控标记（渲染层 btLogItem 转 span.bt-me，白色）。 */
          s += '（' + a.counters.map(function (c) {
            var _txt = (c.side === 'atk' ? '我方' : '敌方') + c.name + '反击 歼 ' + U.numText(c.kill, 0);
            return c.side === 'atk' ? ('\u0001' + _txt + '\u0002') : _txt;
          }).join('，') + '）';
        }
        bits.push(s);
      });
      return {
        side: g.side,
        cls: g.side === 'atk' ? 'atk' : 'def',
        name: g.name || '—',
        txt: '[' + (g.side === 'atk' ? '我' : '敌') + '] ' + (g.name || '—') + '　' +
          (bits.length ? bits.join(' · ') : '待命'),
        indent: Math.min(5, i) * 14,
      };
    });
  };

  /* 兼容出口：旧调用点（ui.btPlay）读的是这一个 —— 返回结构化行文本数组。
     v89.120（老板「回合记录倒叙记录，最新战况显示在最上方」）：
     整回合**整块插到最前** —— 块内部保持"回合头 → 逐兵种行"的正序，
     块与块之间 = 最新在上（每条块自带一条虚线，即块间分隔线）。 */
  ui.btRoundLine = function (r, snap, recIn) {
    var lines = ui.btRoundLines(r, snap);
    var log = document.getElementById('bt-log');
    if (!log || !log.insertBefore) return lines.map(function (L) { return L.txt; });
    var frag = document.createDocumentFragment();
    frag.appendChild(ui.btLogItem('', 'sep'));
    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　最近距离 '
      + U.numText((r && r.gap) || 0, 0), 'hdr'));
    /* v89.175（老板 1）：「每回合我要看见调整（可以不动，但需要显示智能调兵完成，
       开始回合战斗）」—— 智能行的**判据 = 该回合有 smartLog 记录**（有记录=智能开过）
       recIn 可选参：正常从 ui._bt 取；测试/回放可显式传入。 */
    (function () {
      var rec175 = recIn || ((ui._bt && GAME.battle && GAME.battle._recOf) ? GAME.battle._recOf(ui._bt.id) : null);
      if (!rec175 || rec175.side !== 'atk' || !(rec175.smartLog || []).length) return;
      var sn175 = null;
      (rec175.smartLog || []).forEach(function (x) { if (x.r === ((r && r.r) || 0)) sn175 = x; });
      if (!sn175) return;
      var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[sn175.rule] || sn175.rule || '静态表';
      /* v89.176（老板「总体策略」）：阵型模式并入策略名（"错落有致 · 静态表"） */
      var mc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.modeCN || {})[sn175.mode] || '';
      var strat175 = mc175 ? (mc175 + ' · ' + rc175) : rc175;
      /* v89.176：保兵撤退行（损失达线 · 本波收兵）——与"智能调兵完成"并列的可见事件 */
      if (sn175.retreat) {
        frag.appendChild(ui.btLogItem('🏳️ 智能撤退：' + ((sn175.notes || []).join('；')
          || '损失达线') + ' —— 残部带回 · 本波收兵（破防按半计）', 'smart'));
        return;
      }
      var det175 = (sn175.notes || []).slice(0, 4).join('；');
      if ((sn175.notes || []).length > 4) det175 += ' 等 ' + sn175.notes.length + ' 项';
      frag.appendChild(ui.btLogItem('🤖 智能调兵完成（' + (sn175.n
        ? ('调整 ' + sn175.n + ' 项：' + det175) : '维持阵型')
        + '）· 采用「' + strat175 + '」· 开始回合战斗', 'smart'));
    })();
    lines.forEach(function (L) { frag.appendChild(ui.btLogItem(L.txt, L.cls, L.indent)); });
    if (!lines.length) frag.appendChild(ui.btLogItem('[我] 待命　　[敌] 待命', 'atk', 0));
    log.insertBefore(frag, log.firstChild);                   /* 新回合置顶（倒叙） */
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;  /* 视口钉在最新（顶部） */
    return lines.map(function (L) { return L.txt; });          /* 数组：调用方/断言可直接读 */
  };
  /* 播报窗行元素**唯一工厂**（格式只在这里定义一处 —— 回合块与逐条流共用） */
  ui.btLogItem = function (line, cls, indent) {
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    /* v89.136（老板 3）：我方动作片段白色 —— U+0001 / U+0002 受控标记 → span.bt-me。
       先整串 escape 再替换标记：标记之外的任何字符都不会变成 HTML（无注入面）。 */
    if (line != null && line.indexOf('\u0001') >= 0) {
      d.innerHTML = U.escape(line)
        .replace(/\u0001/g, '<span class="bt-me">')
        .replace(/\u0002/g, '</span>');
    } else {
      d.textContent = line;
    }
    return d;
  };
  /* 播报窗行数上限：一场 6 兵种 ≈ 8 行/回合，64 行 ≈ 看得见 7~8 个回合；
     与 .bt-log 的 336px 视高（16 行 · v89.137 老板 3）配套。
     倒叙后**最旧的在最下**，裁剪从末尾删。 */
  ui.BT_LOG_MAX = 64;
  ui.btLogTrim = function (log) {
    var kids = log && log.children;
    /* ⚠️ 测试桩的 DOM 可能给一个"没有 children"的壳元素 —— 判能力再动手 */
    if (!kids || typeof kids.length !== 'number') return;
    while (kids.length > ui.BT_LOG_MAX && log.lastChild) log.removeChild(log.lastChild);
  };
  /* 往播报窗推一行（逐条流；**最新在上**，与回合块同口径） */
  ui.btLogPush = function (line, cls, indent) {
    var log = document.getElementById('bt-log');
    if (!log || (!line && cls !== 'sep') || !log.insertBefore) return;
    log.insertBefore(ui.btLogItem(line, cls, indent), log.firstChild);
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;
  };

  ui.btPlace = function (snap) {
    var D = snap.field || 1;
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (el) el.style.left = ui.btPosPct(pair[0], u.adv, D) + '%';
      });
    });
    if (snap.towers) {
      var tw = document.getElementById('bt-tower');
      if (tw) tw.textContent = snap.towers.left;
    }
  };

  ui.btSyncCounts = function (snap) {
    /* v89.116：数量在**两侧列表**（图标下），战场只画图标 —— id 不变，逻辑照旧 */
    [['atk', snap.atk], ['def', snap.def]].forEach(function (pair) {
      (pair[1] || []).forEach(function (u) {
        var el = document.getElementById('bt-n-' + pair[0] + '-' + u.id);
        if (el) el.textContent = U.fmt(u.count);
        var row = document.querySelector('#bt-board [data-row="' + pair[0] + '-' + u.id + '"]');
        if (row && row.classList) row.classList.toggle('dead', !(u.count > 0));
        /* v89.117：**战场上那枚令牌**同样变暗（此前只暗列表行，场上还是亮的） */
        var fu = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('dead', !(u.count > 0));
      });
    });
  };

  /* 单条事件：目标闪烁（`quiet` = 只闪不写日志 —— 日志已由 ui.btRoundLine 压成一行） */
  ui.btEvent = function (e, quiet) {
    var line = '';
    if (e.kind === 'move') line = '🚶 ' + ui.btSideName(e.side) + ' ' + e.name + ' 前进 ' + U.numText(e.step, 0) + '（最近距离 ' + U.numText(e.gap, 0) + '）';
    else if (e.kind === 'retreat') line = '↩️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 后退 ' + U.numText(e.step, 0);
    else if (e.kind === 'attack') line = '⚔️ ' + ui.btSideName(e.side) + ' ' + e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'counter') line = '🛡️ ' + ui.btSideName(e.side) + ' ' + e.name + ' 反击 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    else if (e.kind === 'tower') line = '🏯 ' + e.name + ' 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）';
    else if (e.kind === 'wall') line = '🏯 城头火力 → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0);
    if (!line) return;
    if (e.targetId) {
      var tEl = document.querySelector('#bt-field [data-bside="' + (e.side === 'atk' ? 'def' : 'atk') +
        '"][data-troop="' + e.targetId + '"]');
      if (tEl && tEl.classList) {
        tEl.classList.add('hit');
        setTimeout(function () { tEl.classList.remove('hit'); }, 360);
      }
    }
    if (quiet) return;
    ui.btLogPush(line, e.kind);
  };

  /* ---- 结束：播报窗收束（v89.136 起不再开"战果"面板） ----
     老板令：「（最后一回合）无需弹窗，直接在下方回合记录里记录回合结束」。
     三个动作：
       ① **补最后一回合** —— 它此前必被吞掉：`onBattleDone` 在 `stepBattle` 内部同步触发
          （finishBattle → _settleBattle），先把 `ui._bt` 置空，main.js 随后的
          `btAfterStep(rec, r)` 检查 `ui._bt` 直接 return（老板实测"最后一回合没有完整显示"的病根）；
       ② 战果写成播报窗的最后一行（含损失/回合数/战报去向）；
       ③ 三键收成提示（防"点了没反应"）。 */
  ui.btShowEnd = function (bt) {
    if (bt && bt.timer) clearInterval(bt.timer);
    var res = GAME._battleJustDone;
    if (ui._bt && (!bt || ui._bt.id === bt.id)) ui._bt = null;
    var same = res && bt && res.id === bt.id;
    if (same && res.lastStep && res.lastStep.snap) {
      ui.btRoundLine(res.lastStep, res.lastStep.snap);   /* ① 补最后一回合 */
    }
    var txt;
    if (same) {
      txt = '🏁 战斗结束：' + (!res.ok ? '战斗中止（大军折返）'
        : (res.winner === 'atk' ? '我军得胜' : '我军失利'))
        + '　·　共 ' + (res.rounds || 0) + ' 回合　·　我军损失 ' + U.numText(res.atkLoss || 0, 0)
        + '　·　敌军损失 ' + U.numText(res.defLoss || 0, 0) + '　·　战报已入公文';
    } else {
      txt = '🏁 战斗已结束（战报见「公文」）';
    }
    ui.btLogPush(txt, 'end');                            /* ② 结束行 */
    var acts = document.getElementById('bt-acts');
    if (acts) acts.innerHTML = '<span class="bt-hint">战斗已结束 —— 战报见「公文」；右上角 ✕ 关闭</span>';
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = '0';
  };

  /* finishBattle 的统一回调（battle.js 调用）：界面开着 → 战果面板；否则 toast */
  ui.onBattleDone = function (res) {
    var bt = ui._bt;
    if (bt && bt.id === res.id) { ui.btShowEnd(bt); return; }
    if (!res.ok) { ui.toast('⚠️ 战斗中止，大军折返'); return; }
    ui.toast('⚔️ 战斗结束：' + (res.winner === 'atk' ? '我军得胜' : '我军失利') +
      '（我方损失 ' + U.numText(res.atkLoss || 0, 0) + '，战报见公文）');
  };

  /* ---- 军务总览：征战中段（供 marchesHTML 调用） ---- */
  ui.btPendingBlock = function () {
    var s = GAME.state;
    var n = GAME.battle.pendingCount();          /* 计数走唯一出口 */
    if (!n) return null;
    var list = (s.battles || []).filter(function (b) { return b.state === 'live'; });
    var rows = list.map(function (b) {
      return '<tr><td>⚔ ' + U.escape((b.target && b.target.name) || '目标') + '</td>' +
        '<td class="ctr">第 ' + (b.round || 0) + ' 回合</td>' +
        '<td class="ctr"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">进入战场</button></td></tr>';
    }).join('');
    return { n: n,
      html: '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' };
  };

  /* ============================================================
   * v89.104（老板）：「在军务这里，增加几个军务总览并列的界面。包括出征（链接出征界面），
   * 防守，军务处（伤病，逃兵，降兵管理）」
   * ------------------------------------------------------------
   * 口径：军务页顶部一条**页签**（军务总览 / 出征 / 防守 / 军务处）——
   *   · 总览 = 原来的内容（在城兵力 / 驻守野地 / 行军队列），一字未动；
   *   · 出征 = 附近可打目标（据点/同县名城/己方城池）一键进**出征界面** + 在途队列；
   *   · 防守 = 逐城防御体检（驻军 / 城墙 / 箭塔 / 守将 / 防御力 + 风险提示）；
   *   · 军务处 = 两营左右分列（伤兵营 + 俘虏营，逐兵种清单；
   *     治疗 / 收编 / 释放都在这里）—— v89.132 起「兵源与征募」「军心」两卡退役。
   * ⚠️ 四个页签只换正文，动作全部复用既有出口（openExpModal / heal-wounded / …）。
   * ============================================================ */
  /* v89.133（v89.128 第二批第 9 条）：菜单改名 + 新增「出征」——
     exp = 出征战术（原「出征」改）、def = 防守战术（原「防守」改）、act = 出征（新）。 */
  /* v89.144（老板 3）：「编制 · 出战能力」改名**军队校场扩容**、整块搬出出征页，
     作为独立页签放在**军务总览右边**。 */
  ui.MARCH_TABS = [['over', '军务总览'], ['expand', '军队校场扩容'], ['act', '出征'], ['exp', '出征战术'], ['def', '防守战术'], ['beacon', '烽火'], ['affairs', '军务处']];
  /* v89.116（老板「烽火相关流水已经存在于军务的烽火中」）：烽火流水窗口 ——
     公文不再给烽火页签，这条流水就是它的**唯一落点**，窗口从 12 提到 24 条。 */
  ui.BEACON_FLOW = 24;
  ui.marchTabHTML = function () {
    var cur = ui._marchTab || 'over';
    /* v89.117（老板「还是没有俘虏营…要让玩家看得到」）：
       「军务处」页签挂**两营合计角标**（伤兵 + 俘虏）—— 有货才显示。
       玩家点进军务第一眼就知道"营里有东西"，不必先切页签才知道。 */
    var badge = (ui.campBadgeN ? ui.campBadgeN() : 0);
    return '<div class="march-tabs">' + ui.MARCH_TABS.map(function (t) {
      return '<span class="mt' + (cur === t[0] ? ' on' : '') + '" data-action="march-tab" data-v="' + t[0] + '">' +
        t[1] + (t[0] === 'affairs' && badge > 0
          ? '<i class="mt-n" title="伤兵 / 俘虏待处理">' + U.fmt(badge) + '</i>' : '') + '</span>';
    }).join('') + '</div>';
  };
  /* ============================================================
   * v89.133（v89.128 第二批第 9/11 条 · 老板）：「增加一个新的'出征'菜单 ——
   *   这个菜单就是点击野地进行出征行动（掠夺，占领等）后弹出的军队行动界面，
   *   直接引用这个界面作为功能即可」＋「出征界面作为一切军事行动的入口，包括对外出征
   *   或对内的城池/野地间操作。出征目标目前提供的是哪些目标，一定距离内吗」。
   * ------------------------------------------------------------
   * 口径：**出征页 = 一切军事行动的入口** —— 先选目标（下拉），再进军队行动界面
   *   （`ui.openExpModal` **原样引用** —— 不另造第二套编队界面）。
   * 目标范围（回答老板「一定距离内吗」）：
   *   · 我方野地 / 我方城池 —— **全境**（不限距离）；
   *   · 同县普通城池 —— 同县（不限距离）；
   *   · 野外据点 —— 当前城 **14 格内**（半径在 `expTargetCandidates` 唯一出口里）;
   *   · 其余任意目标（名城 / 远据点 / 中立野地）—— **地图点选**（本页给指路，不另列）。
   * ============================================================ */
  /* ============================================================
   * v89.142（老板 2）：「目标分成 5 类，分行显示：我方城池 / 我方野地 / 名城 /
   *   野地 / 野外据点。进入军事行动这个按钮放在界面底部」
   * ------------------------------------------------------------
   * **分组候选的唯一出口**（渲染 / 提交 / 探针 / 断言全读它，不许各列一份）：
   *   · 我方城池 / 我方野地 —— **全境**（不限距离）；
   *   · 名城（NPC 县·郡·州·都）—— 按距离排序取**最近 N_LIST**处（全图百余座，全列没意义）；
   *   · 野地（中立）—— 本城周边（半径 SCAN）内按距离取**最近 N_LIST**处；
   *   · 野外据点 —— 本城 **14 格内**（与 expTargetCandidates 同一把尺），取最近 N_LIST。
   * 每组带 `total`（截断前的总数）—— 界面用「共 N 处 · 列出最近 24」如实交代，
   * 不给"列了 24 个就以为全图只有 24 个"的假象。
   * 旧的 `ui.actTargetsOf`（v89.133 的"一锅烩扁平列表"）随本需求整条退役。
   * ============================================================ */
  ui.ACT_LIST_N = 24;
  ui.actTargetGroups = function (c) {
    var s = GAME.state;
    c = c || GAME.currentCity();
    if (!c) return [];
    var N = ui.ACT_LIST_N;
    var dist = function (x, y) { return Math.max(Math.abs(x - c.x), Math.abs(y - c.y)); };
    var groups = [
      { key: 'owncity', label: '🏯 我方城池', targets: [] },
      { key: 'ownwild', label: '🌾 我方野地', targets: [] },
      { key: 'npc', label: '🏛️ 名城', targets: [] },
      { key: 'wild', label: '🗺️ 野地', targets: [] },
      { key: 'fort', label: '🏕️ 野外据点', targets: [] },
    ];
    var by = {};
    groups.forEach(function (g) { by[g.key] = g; });
    /* ① 我方城池（全境）—— 派遣 / 运输都从这里发起 */
    (s.cities || []).forEach(function (mc) {
      if (mc.id === c.id) return;
      by.owncity.targets.push({ d: dist(mc.x, mc.y),
        label: '🏯 ' + mc.name + '（己方 · 城池间操作）',
        tg: { kind: 'own', id: mc.id } });
    });
    /* ② 我方野地（全境）—— 驻军 / 采集 / 撤回 */
    (s.wilds || []).forEach(function (w) {
      var t = DATA.TERRAIN[w.type] || { name: w.type };
      var gn = GAME.wildGarrisonTotal(w.garrison);
      by.ownwild.targets.push({ d: dist(w.x, w.y),
        label: '🌾 ' + t.name + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）'
          + (gn > 0 ? '　· 驻军 ' + U.numText(gn, 0) : '　· 无驻军'),
        tg: { kind: 'wild', x: w.x, y: w.y } });
    });
    /* ③ 名城（NPC 城池 —— 县/郡/州/都，按距离取最近 N 处） */
    (s.map.cities || []).forEach(function (nc) {
      by.npc.targets.push({ d: dist(nc.x, nc.y),
        label: ui.expTargetLabel({ kind: 'city', id: nc.id, npc: nc }),
        tg: { kind: 'city', id: nc.id, npc: nc } });
    });
    /* ④ 野地（中立）—— 本城周边扫一圈（半径 20），按距离取最近 N 处。
       排除：我方野地格 / NPC 城池格 / 据点格（那些格子另有归组）。 */
    var SCAN = 20;
    for (var dy = -SCAN; dy <= SCAN; dy++) {
      for (var dx = -SCAN; dx <= SCAN; dx++) {
        var x = c.x + dx, y = c.y + dy;
        if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
        if (GAME.map.wildAt(x, y)) continue;                        /* 我方野地 → ② */
        if (GAME.map.npcAt && GAME.map.npcAt(x, y)) continue;       /* 名城格 → ③ */
        if (GAME.map.fortAt && GAME.map.fortAt(x, y)) continue;     /* 据点格 → ⑤ */
        var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : 0;
        if (!(lv > 0)) continue;
        by.wild.targets.push({ d: Math.max(Math.abs(dx), Math.abs(dy)),
          label: '🗺️ 野地 Lv' + lv + '（' + x + ',' + y + '）',
          tg: { kind: 'wild', x: x, y: y } });
      }
    }
    /* ⑤ 野外据点（本城 14 格内 —— 与 expTargetCandidates 同一半径） */
    var R = 14;
    for (var fy = -R; fy <= R; fy++) {
      for (var fx = -R; fx <= R; fx++) {
        var fxx = c.x + fx, fyy = c.y + fy;
        if (fxx < 0 || fyy < 0 || fxx >= DATA.MAP_W || fyy >= DATA.MAP_H) continue;
        var f = GAME.map.fortAt ? GAME.map.fortAt(fxx, fyy) : null;
        if (!f) continue;
        by.fort.targets.push({ d: Math.max(Math.abs(fx), Math.abs(fy)),
          label: '🏕️ ' + GAME.fortLabelOf(f) + '（Lv' + (f.level || 1) + '）',
          tg: { kind: 'fort', x: fxx, y: fyy } });
      }
    }
    groups.forEach(function (g) {
      g.targets.sort(function (a, b) { return a.d - b.d; });
      g.total = g.targets.length;
      if (g.targets.length > N) g.targets = g.targets.slice(0, N);
    });
    return groups;
  };
  /* 当前选中的目标（**唯一出口**）：`ui._actPick = {grp, idx}` 由下拉 change 落库，
     按钮与断言都读这里 —— 不许渲染时"看着像选中"而提交时另算一个（v89.30 的教训）。 */
  ui._actPick = null;
  ui.actPickOf = function () {
    /* v89.144（老板 4）：「默认显示为空」—— **删掉"兜底选第一个有货组第一项"**：
       只有玩家真的在下拉里选过（_actPick 落库）才返回目标；目标失效则自动清空。 */
    if (!ui._actPick) return null;
    var groups = ui.actTargetGroups(GAME.currentCity());
    var g2 = null;
    groups.forEach(function (x) { if (x.key === ui._actPick.grp) g2 = x; });
    if (!g2 || !g2.targets[ui._actPick.idx]) { ui._actPick = null; return null; }
    return { tg: g2.targets[ui._actPick.idx].tg, label: g2.targets[ui._actPick.idx].label, grp: g2.key };
  };
  ui.marchActHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var groups = ui.actTargetGroups(c);
    var pick = ui.actPickOf();
    /* v89.144（老板 3）：本城出征容量与校场扩编的数据**整块随卡片搬去独立页签**
       （ui.marchExpandHTML）—— 本页只剩"选目标 → 进入军事行动"。 */
    /* v89.142（老板 2）：目标**分 5 类、各占一行**（我方城池 / 我方野地 / 名城 /
       野地 / 野外据点）—— 每类一个下拉，选中项落库 ui._actPick；
       「进入军事行动」按钮移到**界面底部**（页面最末）。 */
    /* v89.144（老板 4）：
       · **固定下拉框位置与长度** —— 5 行用同一结构（.act-row：label 定宽 + 下拉定宽 20 个中文），
         起点一律对齐「我方城池」那行；
       · **默认显示为空** —— 每行首项 = 空 option（不预选）；actPickOf 也不再兜底选第一个；
       · 去掉「共 N · 列最近 24」备注（目标只在（对应行的）下拉框里出现）；
       · 选定后立刻 live 刷新（main.js 的 exp-act-pick → GAME.refreshView）——
         在**另一行**再选一个目标时，原来那一行自动回到空（_actPick 只有一份）。 */
    var rows = groups.map(function (g) {
      var sel = (ui._actPick && ui._actPick.grp === g.key) ? ui._actPick.idx : -1;
      var ctrl = g.targets.length
        ? '<select class="city-select act-sel" data-action="exp-act-pick" data-grp="' + g.key + '">' +
            '<option value=""' + (sel < 0 ? ' selected' : '') + '></option>' +
            g.targets.map(function (o, i) {
              return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
                U.escape(o.label) + '</option>';
            }).join('') + '</select>'
        : '<span class="ui-sub act-none">（无）</span>';
      return '<div class="exp-sel act-row"><label>' + g.label + '</label>' + ctrl + '</div>';
    }).join('');
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '一切军事行动的入口：选目标 → 进军队行动界面（编队 / 战术 / 计略都在里面）</div>' +
      '<div class="story-card"><div class="gold-heading">⚔️ 出征 · 目标' +
        ui.help('目标按**五类分行**列出：\n· 我方城池 / 我方野地 —— 全境（不限距离）；\n'
          + '· 名城（县·郡·州·都）/ 野地（中立）—— 按距离列出最近 ' + ui.ACT_LIST_N + ' 处；\n'
          + '· 野外据点 —— 本城 14 格内。\n'
          + '选定后进入**军队行动界面**（与地图点野地弹出的是同一个界面）。') + '</div>' +
      rows +
      '<div class="ui-sub" style="margin-top:4px;">目标范围：我方城池 / 我方野地 —— <b>全境</b>；'
        + '名城 / 野地 —— 按距离取最近 ' + ui.ACT_LIST_N + ' 处；野外据点 —— 本城 <b>14 格内</b>；'
        + '其余远处目标仍可<b>在地图上点选</b>。</div></div>' +
      /* v89.144（老板 3）：原「编制 · 出战能力」卡片已搬去独立页签「军队校场扩容」
         （ui.marchExpandHTML，军务总览右边）。 */
      /* v89.142（老板 2）：**「进入军事行动」按钮放界面底部** —— 页面最末的独立操作条；
         上方一行写明"当前选中的是哪个目标"（5 个下拉，必须说清按钮会去哪一个）。 */
      '<div class="ui-sub" style="text-align:center;margin:10px 0 2px;">当前目标：<b>' +
        (pick ? U.escape(pick.label) : '（尚未选择）') + '</b></div>' +
      '<div class="exp-foot" style="justify-content:center;">' +
        /* v89.144（老板 4）：按钮可用性只看**是否真的选了目标**（默认空 → 置灰；
           选定后 live 刷新即亮起）。 */
        '<button class="btn gold" data-action="exp-act-go"' + (pick ? '' : ' disabled') +
          ' style="min-width:240px;font-size:var(--fs-h1);">⚔️ 进入军事行动 →</button></div>';
  };
  /* ============================================================
   * v89.144（老板 3）：「军务，出征这里，编制·出战能力改成**军队校场扩容**，
   *   整体挪到作为一个单独菜单放在**军务总览右边**」
   * ------------------------------------------------------------
   * 独立页签（march-tab 动作复用）· 内容 = 本城出征容量 + 节钺 · 校场扩编入口。
   * 数据全读既有唯一出口（marchCapOf / buildingLevel / jieyueExpandOf / jieyueOf），
   * 界面不自己算任何口径。
   * ============================================================ */
  ui.marchExpandHTML = function () {
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    var cap = GAME.battle.marchCapOf(c);
    var xcLv = GAME.buildingLevel(c, 'xiaochang') || 0;
    var jx = GAME.jieyueExpandOf(c, 'xc');
    var _jxTxt = (jx.used >= jx.max)
      ? '本城已满 ' + jx.used + '/' + jx.max
      : '本城 ' + jx.used + '/' + jx.max + '　持符 ' + GAME.jieyueOf();
    return '<div class="story-card"><div class="gold-heading">🪓 军队校场扩容' +
        ui.help('出征容量 = 校场等级 × 1 万 × 加成；节钺 · 校场扩编每次 +1 万人马'
          + '（等效校场 +1 级，每城至多 ' + ((DATA.JIEYUE || {}).xcMax || 2) + ' 次）。\n'
          + '节钺来源：首占名城 / 爵位赏赐（黄金买不到）。') + '</div>' +
      '<div class="res-line"><span class="lbl">本城出征容量</span><span class="val">' +
        U.numText(cap, 0) + ' 人马' + (xcLv > 0 ? '（校场 Lv' + xcLv + ' + 扩编 ' + (c.jieyueXc || 0) + '）'
          : '（尚无校场）') + '</span></div>' +
      '<div class="auto-line"><button class="btn" data-action="jieyue-xc" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 校场扩编（' + _jxTxt + '）</button>' +
        '<span class="ui-sub">出征容量 +1 万人马（等效校场 +1 级）</span></div></div>';
  };

  /* —— 出征页（v89.109 · 老板「军务的出征菜单不是给地址栏的，而是设置出征战术的地方」）：
     主体 = **出征战术设置**（全兵种 × 动作 × 首选歼敌目标）；在途队列保留（召回/急行军在那儿）。
     "近处可打目标"列表已删 —— 出征目标在地图上点选（城池 / 据点 / 野地）。 —— */
  ui.marchExpHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术……**不要在途的行军队列**」——
     *   在途队列本页撤除（在途信息仍在「军务总览 · ④ 行军」段，一处不丢）。
     * 页面 = 出征战术（两列下拉）+ 练兵块（校场面板退役后演武/阅兵的新家）。
     * ============================================================ */
    var c = GAME.currentCity();
    if (!c) return '<div class="q-empty">尚无城池。</div>';
    /* v89.136（老板 4）：「出征战术**细分掠夺，占领**，分别允许进行相应的默认战术设置」——
       本页改**两小页**（掠夺 / 占领，样式与「防守战术」页内小页同构）：
       每页只设该模式下的默认战术；未单独设置的兵种**沿用通用表**（老档数据所在）。
       页面显示"生效值"（细分覆盖通用 —— 与战斗读取同一口径 GAME.tacticsFor）。 */
    var tsub = (ui._expTac === 'raid') ? 'raid' : 'occupy';
    var tabs = '<div class="def-tabs">' +
      [['occupy', '🚩 占领战术'], ['raid', '🔥 掠夺战术']].map(function (t) {
        return '<span class="dt' + (tsub === t[0] ? ' on' : '') + '" data-action="exp-tac-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    return '<div class="story-card"><div class="gold-heading">⚔️ 出征战术' +
      ui.help('出征战术**按出征方式细分**（「掠夺 / 占领」两个小页分别设置）。\n'
        + '每兵种两栏下拉：**动作**（前进 / 防御 / 后退 —— 决定初始站位与推进方式）＋ '
        + '**目标**（敌方某一兵种 / 箭塔 / 自动）。\n'
        + '动作：前进 = 每回合推进（到射程即停）；防御 = 原地不动、**受伤减半**；'
        + '后退 = 每回合后撤（躲箭塔双倍攻击区）。\n'
        + '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转打守军）。\n'
        + '未单独设置的兵种**沿用通用战术**（老档的设置继续生效）；'
        + '「恢复默认」只清本小页的细分设置；防守战术在「防守战术」页单独设。') + '</div>' +
      '<div class="ui-sub" style="margin:2px 0 6px;">当前（' +
        (tsub === 'raid' ? '掠夺' : '占领') + '）：' + GAME.tacticSummary(tsub) + '</div>' +
      ui.tacticBlockHTML(tsub) + '</div>' +
      /* v89.142（老板 3）：「掠夺战术和占领战术按钮放在界面底部」
         —— 与防守战术页的小页按钮**位置与图标风格保持一致**（都在卡片下方） */
      tabs;
  };
  /* —— 防守页：逐城防御体检 + **防守战术设置**（v89.109） —— */
  ui._defSub = 'over';
  ui.marchDefHTML = function () {
    /* ============================================================
     * v89.133（v89.128 第二批第 14 条 · 老板）：「军务的防守战术，在底下分两个小页面
     *   （避免后边城池过多，显示不过来），第一个是目前的全境体检，改名为**全境防御**
     *   （按目前方式显示城池清单）。第二个是**防守战术**，参考调整后的出征战术缩略显示」。
     * 两小页共用页内切换（ui._defSub）—— 城多时体检表再长，也不再与战术设置互相顶屏。
     * ============================================================ */
    var s = GAME.state;
    var sub = ui._defSub === 'tac' ? 'tac' : 'over';
    var tabs = '<div class="def-tabs">' +
      [['over', '🛡️ 全境防御'], ['tac', '⚔️ 防守战术']].map(function (t) {
        return '<span class="dt' + (sub === t[0] ? ' on' : '') + '" data-action="def-sub" data-v="' + t[0] +
          '">' + t[1] + '</span>';
      }).join('') + '</div>';
    if (sub === 'tac') {
      /* v89.142（老板 4）：「防守战术和全境防御按钮放在界面底部」—— 与出征战术页同款位置 */
      return '<div class="story-card"><div class="gold-heading">⚔️ 防守战术' +
        ui.help('我方城池被攻打时，守军按**这套设置**作战（NPC 守方不用你的设置）。\n'
          + '每兵种两栏下拉：动作 + 目标，与出征战术同一套控件。\n'
          + '「**出城迎战**」= 该兵种前出城墙之外迎敌：攻方必须先把它打完，才够得着城墙拆工事；\n'
          + '但它也吃不到城墙护佑 —— 是把前线前移的进攻性防御，代价与收益都归自己。') + '</div>' +
        ui.tacticBlockHTML('def') + '</div>' + tabs;
    }
    var rows = (s.cities || []).map(function (ct) {
      var army = GAME.armyTotal(ct);
      var wall = GAME.buildingLevel(ct, 'chengqiang') || 0;   /* v89.126：城墙占格后同一读法 */
      var towers = GAME.towerCountOf ? (GAME.towerCountOf(ct) || 0) : 0;
      var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(ct) : null;   /* v89.116：函数名笔误修正 */
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      var risks = [];
      if (army <= 0) risks.push('无驻军');
      if (wall <= 0) risks.push('无城墙');
      if (!guard) risks.push('未任命守将');
      /* v89.113：城主缺席 = 内政/智谋加成为零（城池面板会写明），体检里点出来 */
      var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(ct) : null;
      if (!mayor) risks.push('未任命城主');
      return '<tr><td>' + U.escape(ct.name) + '</td>' +
        '<td class="num">' + U.numText(army, 0) + '</td>' +
        '<td class="num">' + (wall > 0 ? 'Lv' + wall : '—') + '</td>' +
        '<td class="num">' + towers + '</td>' +
        '<td>' + (mayor ? U.escape(mayor.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td>' + (guard ? U.escape(guard.name) : '<span style="color:var(--red-light);">未任命</span>') + '</td>' +
        '<td class="num">' + U.numText(def, 0) + '</td>' +
        '<td style="color:' + (risks.length ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
          (risks.length ? risks.join(' · ') : '齐备') + '</td></tr>';
    }).join('');
    return '<div class="story-card"><div class="gold-heading">🛡️ 全境防御' +
      ui.help('防御力 = 驻军 × 兵种战力 × (1 + 城墙/城主智谋加成)（与来袭结算同一出口 defensePowerOf）。\n'
        + '城主（文治）= 内政→产量/建造/税收、智谋→研究/城防；守将（武功）= 勇武→征兵、战时对阵。\n'
        + '"齐备"= 有驻军 + 有城墙 + 有城主 + 有守将；缺哪项就在那行里点出来。') +
      '</div>' + (rows ? '<table class="tbl"><thead><tr><th>城池</th><th class="num">驻军</th><th class="num">城墙</th>' +
        '<th class="num">箭塔</th><th>城主</th><th>守将</th><th class="num">防御力</th><th>风险</th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="q-empty">尚无城池。</div>') + '</div>' + tabs;
  };
  /* —— 军务处：两营并列（v89.132 起只此两块；动作全部复用既有出口） —— */
  /* 逐兵种清单（两个营共用）：把 { 兵种: 数量 } 摊成若干行 ——
     老板：「列出具体兵种及数量，不要一个总数量」。行序按数量降序（多的在前）。 */
  /* v89.118（老板「俘虏营直接文字显示就行，放图标太大了」）：
     opts.textOnly = 纯文字行（不摆兵种图标）—— 俘虏营用。
     伤兵营仍带图标（本轮指令只点名俘虏营；要统一改一处调用即可）。 */
  ui.armyBreakdownRows = function (map, emptyTxt, extraOf, opts) {
    var _o = opts || {};
    var arr = [];
    Object.keys(map || {}).forEach(function (k) {
      var v = Math.max(0, Math.floor(map[k] || 0));
      if (v > 0) arr.push([k, v]);
    });
    if (!arr.length) return '<div class="res-line"><span class="lbl">明细</span><span class="val" ' +
      'style="color:var(--text-dim);">' + U.escape(emptyTxt || '（空）') + '</span></div>';
    arr.sort(function (a, b) { return b[1] - a[1]; });
    return arr.map(function (x) {
      var nm = DATA.TROOPS[x[0]] ? DATA.TROOPS[x[0]].name : (x[0] === 'unknown' ? '来历不明' : x[0]);
      return '<div class="res-line"><span class="lbl">'
        + (_o.textOnly ? '' :
          (((GAME.icons && GAME.icons.forTroop && GAME.icons.forTroop(x[0])) || '') + ' '))
        + U.escape(nm) + '</span><span class="val">' + U.numText(x[1], 0) + ' 人'
        + (extraOf ? (extraOf(x[0], x[1]) || '') : '') + '</span></div>';
    }).join('');
  };
  /* ============================================================
   * v89.117（老板「还是没有俘虏营或者降兵营，目前俘虏设置是什么，要让玩家看得到」）
   * ------------------------------------------------------------
   * 伤兵营 / 俘虏营的**唯一落点**仍是「军务 · 军务处」，但两处不达标（本轮诊断）：
   *   ① 军务的默认页签是「军务总览」—— 玩家点进军务**看不到两营**；
   *   ② 俘虏规则（8% / 单场上限 3000 / 来源 / 收编口径）只写在**悬停提示**里，
   *      不悬停就看不见（老板原话：「目前俘虏设置是什么，要让玩家看得到」）。
   * 改：本函数收成**唯一组件**（军务处唯一形态 = camp-card 卡片），
   *     规则一律**可见文字**，数字读唯一出口（DATA.CAPTIVE / healFeeOf），不抄文案。
   * v89.132（老板）：「军务总览里边，不需要两营这个菜单，只在军务处即可」——
   *     总览页的 compact 档与 ⑤ 区一并退役（不留第二个形态 = 不留第二个出口）。
   * ============================================================ */
  ui.campCard = function (kind) {
    var s = GAME.state;
    var C = DATA.CAPTIVE || {};
    var ratePct = Math.round((C.rate == null ? 0.08 : C.rate) * 100);
    var capN = C.cap == null ? 3000 : C.cap;
    var srcNames = { wild: '野地', fort: '据点', city: '名城', defense: '守城得手' };
    var srcTxt = (C.kinds || []).map(function (k) { return srcNames[k] || k; }).join(' / ');
    if (kind === 'wounded') {
      var wn = s.wounded || 0;
      var fee = GAME.healFeeOf ? GAME.healFeeOf(wn) : wn * 10;
      var wr = Math.round(((DATA.EXPEDITION || {}).woundedRate || 0.45) * 100);
      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(wn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.woundedArmy, '伤兵营已空 —— 打完仗有了伤兵会列在这里') +
        '<div class="camp-rule"><b>规则</b>　来源：战斗阵亡者按 <b>' + wr + '%</b> 折为伤兵（受伤者不当场消失）　·　' +
          '归队：花黄金一次性治疗，按兵种加回本城　·　' +
          '自动化：「自动化 · 治疗伤兵」可托管</div>' +
        '<div class="auto-line"><button class="btn' + (wn ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (wn ? '' : ' disabled') + '>治疗伤兵（归队）</button>' +
          '<span class="ui-sub">治疗费 ' + U.numText(fee, 0) + ' 金</span></div></div>';
    }
    /* 俘虏营 —— v89.142（老板 5）：收编 = **直接转入本城相应兵种** + 支金（造价 50%）；
       花费与明细一律读唯一出口 conscriptPlanOf（界面不自己折算，防两处漂移）。 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var plan = GAME.conscriptPlanOf ? GAME.conscriptPlanOf(s.captives) : { men: cn, cost: 0, pct: 0.5 };
    var pctN = Math.round((plan.pct == null ? 0.5 : plan.pct) * 100);
    var goldN = (s.res && s.res.gold) || 0;
    var afford = cn > 0 && goldN >= plan.cost;
    var kkN = Object.keys(plan.byType || {}).length;
    var rep = Math.max(1, Math.round(cn / 50));
    return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
      '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中<b>不限量</b>）　·　' +
        '<b>收编入军</b>：**逐兵种直接转入本城军队**（数量 +N，共 ' + kkN + ' 类）；' +
        '支金 = 各兵种造价的 <b>' + pctN + '%</b>（资源按市场平价折金）　·　' +
        '<b>释放</b>：不添兵，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (afford ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (afford ? '' : ' disabled') + ' title="' + (cn
          ? (goldN >= plan.cost ? '逐兵种转入本城军队' : '黄金不足：需 ' + U.numText(plan.cost, 0) + '，现有 ' + U.numText(goldN, 0))
          : '俘虏营为空') + '">收编入军（兵 ' + U.numText(cn, 0) + ' · 费 ' + U.numText(plan.cost, 0) + ' 金）</button>' +
        '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
        (cn ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';
  };
  /* 两营合计（页签角标 + 总览摘要共读的唯一出口） */
  ui.campBadgeN = function () {
    var s = GAME.state || {};
    return Math.max(0, s.wounded || 0) + (GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0);
  };

  ui.marchAffairsHTML = function () {
    /* v89.132（老板「军务处伤兵营和俘虏营左右分列，均列出详细兵种。
       兵源与征募这个菜单不要，军心这个菜单也不要」）——
       军务处 = 两营左右分列（.camp-cards），其余卡片一概不留。 */
    return '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '两营的唯一落点：逐兵种清单、治疗归队、收编 / 释放都在这里</div>' +
      '<div class="camp-cards">' + ui.campCard('wounded') + ui.campCard('captive') + '</div>';
  };

  /* ============================================================
   * 军务 · 烽火页（v89.107 · 老板）
   * ------------------------------------------------------------
   * 老板令：「左侧统计栏的烽火警报（含策略布防）放到军务中，与出征防守等并列，
   *          有警报时，建筑烽火台颜色明暗闪烁」。
   * 于是左侧「城池属性」不再有烽火横幅与「计略布防」行 —— 两者整体搬到这里：
   *   ① 预警 = 各城下次来袭（invasionDueAt 唯一出口）+ 守备力（defensePowerOf）
   *      + 是否在预警窗内（invasionAlertOf，与烽火台闪烁同源）+ 烽火台等级；
   *   ② 布防 = 空城计 / 坚壁清野（schemeDefOf 读状态，布防走既有 openCityScheme）；
   *   ③ 流水 = 烽火类消息最近 12 条（预警 / 击退或被破 / 防守计）。
   * ============================================================ */
  /* 下次来袭的显示文本（v89.115）：**现实时间口径** —— 剩余 M 分 S 秒。
     due / now 皆为现实毫秒（now 缺省取当前）；不再显示"今日/明日 9 时"（那是游戏时口径）。 */
  ui.invDueText = function (due, now) {
    var n0 = (now == null ? GAME.realNow() : now);
    var left = Math.max(0, Math.round((due - n0) / 1000));
    return '<b>' + U.dur(left) + '</b> 后' +
      '<br><span style="color:var(--text-dim);font-size:var(--fs-sub);">（现实时间）</span>';
  };
  /* ============================================================
   * v89.118（老板需求 3）：「外敌来犯」的**介绍（触发与规则）**与**烽火流水**——
   *   原先在「军务 · 烽火」页（v89.113 落的），本轮迁到「自动化 · 外敌来犯」：
   *   烽火页只留**预警（排期表）+ 布防**；规则与流水跟"开关"同页
   *   （管开不开的人，才最需要知道规则与历史）。
   * 字段全部动态引用 DATA.INVASION（改数值这里自动跟，不抄第二份）。
   * ============================================================ */
  ui.invasionRulesHTML = function () {
    var I = DATA.INVASION || {};
    var rMin0 = (I.realMin == null ? 30 : I.realMin);
    var wMin0 = (I.warnMin == null ? 5 : I.warnMin);
    var lo0 = Math.round((I.ratioMin == null ? 0.28 : I.ratioMin) * 100);
    var hi0 = Math.round((I.ratioMax == null ? 0.45 : I.ratioMax) * 100);
    return '<div class="story-card" style="margin-top:var(--sp-4);">' +
      '<div class="gold-heading">📜 来犯 · 触发与规则' +
      ui.help('本栏为「外敌来犯」的全局规则（与开关同页）。\n' +
        '各城排期与布防见「军务 · 烽火」。\n' +
        '规则字段与 DATA.INVASION 同源（改数据这里自动跟）。') + '</div>' +
      '<div class="res-line"><span class="lbl">触发点</span><span class="val">' +
        U.escape((I.sources || ['流寇']).join(' ／ ')) + '　（诸方势力轮番来犯）</span></div>' +
      '<div class="res-line"><span class="lbl">开战门槛</span><span class="val">拥有 <b>' +
        (I.unlockCities == null ? 2 : I.unlockCities) + '</b> 座以上城池后，始有兵戈之扰</span></div>' +
      '<div class="res-line"><span class="lbl">时机</span><span class="val">每 <b>' + rMin0 +
        ' 分钟</b>一场（<b>现实时间</b> —— 与本作倍速无关）；目标城<b>按场轮转</b> —— 人人有份，可预判</span></div>' +
      '<div class="res-line"><span class="lbl">规模</span><span class="val">来袭战力约为全境战力的 <b>' +
        lo0 + '%~' + hi0 + '%</b> —— 兵收拢、墙修高，便守得住</span></div>' +
      '<div class="res-line"><span class="lbl">预警</span><span class="val">提前 <b>' + wMin0 +
        ' 分钟</b>（现实时间）烽火一次；烽火台越高，警讯里的敌情越细</span></div>' +
      '<div class="res-line"><span class="lbl">离线</span><span class="val">离城期间最多补算 <b>' +
        (I.catchUpMax == null ? 3 : I.catchUpMax) + ' 场</b>，其余敌军自行散去（不翻旧账）</span></div>' +
      '<div class="res-line"><span class="lbl">底线</span><span class="val">' +
        (I.loseCity ? '城破丢城' : '<b style="color:var(--green-ok);">城破不丢城</b>') +
        ' —— 只损资源 / 兵力 / 城墙等级</span></div>' +
      '<div class="ui-sub" style="margin-top:6px;">防御三件套：驻军 · 城墙箭塔 · 城主（智谋加到城防）与守将（战时对阵）。' +
        '布防（空城计 / 坚壁清野）在「军务 · 烽火」。</div>' +
      '</div>';
  };
  /* 烽火流水（唯一落点：自动化 · 外敌来犯 —— 与开关同页） */
  ui.beaconFlowHTML = function () {
    var flow = GAME.msgsOf('beacon').slice(0, ui.BEACON_FLOW);
    if (!flow.length) return '';
    return ui.sealH('烽火流水', '最近 ' + flow.length + ' 条 · 烽火与来犯消息的唯一落点（军务·烽火 只留预警与布防）') +
      '<div class="msg-log">' + flow.map(function (m) {
        var d = new Date(m.t);
        return '<div class="bb-line beacon"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
          U.pad(d.getMinutes()) + '</span>' + U.escape(m.msg) + '</div>';
      }).join('') + '</div>';
  };

  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* v89.133（v89.128 第二批第 15 条 · 老板）：「军方的烽火，去掉这种备注行」——
       指路行退役（规则与流水仍在「自动化 · 外敌来犯」，位置没变，只是不再占页头）。 */
    /* ① 预警 —— v89.115（老板「为啥每分钟都被打一次」）：改**现实时间**节奏（每 realMin 分钟一场） */
    var rows = [];
    var nowR = GAME.realNow();
    (s.cities || []).forEach(function (ct) {
      var due = GAME.invasionDueAt(ct);
      if (!due) return;
      var al = GAME.invasionAlertOf(ct);
      var w = GAME.invasionWarnSec(ct);
      var def = GAME.defensePowerOf ? Math.round(GAME.defensePowerOf(ct) || 0) : 0;
      rows.push({ ct: ct, al: al, due: due, def: def, bc: w.bc,
        left: Math.round((due - nowR) / 1000) });
    });
    rows.sort(function (a, b) { return a.left - b.left; });
    var next = rows[0];
    var rMin = (DATA.INVASION.realMin == null ? 30 : DATA.INVASION.realMin);
    out += '<div class="story-card"><div class="gold-heading">🔥 烽火 · 预警' +
      ui.help('来犯每 **' + rMin + ' 分钟**一场（**现实时间**，与倍速无关），目标城按场轮转。\n提前 ' +
        (DATA.INVASION.warnMin == null ? 5 : DATA.INVASION.warnMin) +
        ' 分钟（现实）**只报一次**，警讯里含来袭剩余时间。\n进窗后：城内烽火台会明暗闪烁。\n' +
        '烽火台越高 → 警讯里的敌情越细（Lv1 +战力 · Lv2 +兵种明细）。') + '</div>';
    if (!rows.length) {
      out += '<div class="q-empty">暂无排期 —— 拥有 2 座以上城池后，敌军每 ' + rMin +
        ' 分钟（现实时间）来犯一场（目标城按场轮转）。</div></div>';
    } else {
      out += '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' +
        (next.al ? '<b style="color:var(--red-light);">⚠ 警报中</b>：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left)) + '（现实时间）'
          : '最近一场：' + U.escape(next.ct.name) +
            ' · 剩余 ' + U.dur(Math.max(0, next.left)) + '（现实时间）') + '</div>' +
        '<table class="tbl"><thead><tr><th>城池</th><th class="ctr">下次来袭</th>' +
        '<th>来犯</th><th class="ctr">烽火台</th><th class="num">守备力</th><th class="ctr">状态</th></tr></thead><tbody>' +
        rows.slice(0, 12).map(function (r) {
          return '<tr><td>' + (r.al ? '🔥 ' : '') + U.escape(r.ct.name) + '</td>' +
            '<td class="ctr">' + ui.invDueText(r.due, nowR) + '</td>' +
            '<td>' + U.escape(GAME.invasionIntelTextOf(r.ct, GAME.invasionSlotOf(r.due))) + '</td>' +
            '<td class="ctr">' + (r.bc > 0 ? 'Lv' + r.bc : '<span style="color:var(--text-dim);">无</span>') + '</td>' +
            '<td class="num">' + U.fmt(r.def) + '</td>' +
            '<td class="ctr">' + (r.al
              ? '<b style="color:var(--red-light);">警报中（闪烁）</b>'
              : '<span style="color:var(--text-dim);">待命</span>') + '</td></tr>';
        }).join('') + '</tbody></table>' +
        (rows.length > 12 ? '<div class="ui-sub" style="text-align:center;">另有 ' + (rows.length - 12) + ' 城未列出</div>' : '') +
        '</div>';
    }
    /* ② 布防（策略布防 —— 从左侧统计栏搬来） */
    if (c && GAME.schemeDefOf) {
      var kc = GAME.schemeDefOf(c, 'kongcheng', now);
      var jb = GAME.schemeDefOf(c, 'jianbi', now);
      /* v89.116：这里原写 `GAME.itemCount ? GAME.itemCount('jinang') : 0` ——
         该函数**全仓不存在**（同 `guardOf` 那一类"拼错就被三元吞掉"）→ 锦囊数恒 0。
         真口径 = 背包里的数量（与"背包点锦囊用掉"同一份数据）。 */
      var ja = (GAME.state.items || {}).jinang || 0;
      out += '<div class="story-card"><div class="gold-heading">🎴 策略布防 · ' + U.escape(c.name) +
        ui.help('防御计布防于本城，持续期内自动生效（与来袭结算同一套出口）。\n' +
          '空城计：下一次来犯不战而退；坚壁清野：遭来犯时损失 −40%。\n锦囊可用 ' + ja + ' 个。') + '</div>' +
        '<div class="res-line"><span class="lbl">🎭 空城计</span><span class="val">' +
          (kc ? '<b style="color:var(--green-ok);">布防中（余 ' + Math.ceil(kc.left / 3600) + ' 时）</b>'
              : '<span style="color:var(--text-dim);">未布防</span>') + '</span></div>' +
        '<div class="res-line"><span class="lbl">🏜️ 坚壁清野</span><span class="val">' +
          (jb ? '<b style="color:var(--green-ok);">布防中（余 ' + Math.ceil(jb.left / 3600) + ' 时）</b>'
              : '<span style="color:var(--text-dim);">未布防</span>') + '</span></div>' +
        '<div class="auto-line"><button class="btn gold" data-action="city-scheme">🎴 布防 / 更换</button>' +
          '<span class="ui-sub">锦囊现有 ' + ja + ' 个（商城 / 战利品可得）</span></div></div>';
    }
    /* ③ v89.118（老板需求 3）：流水**已迁至「自动化 · 外敌来犯」**（与开关同页）——
       函数 ui.beaconFlowHTML() 是它的新家，本页不再渲染。 */
    return out;
  };

  ui.marchesHTML = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var tab = ui._marchTab || 'over';
    if (tab === 'expand') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchExpandHTML() + '</div>';
    if (tab === 'act') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchActHTML() + '</div>';
    if (tab === 'exp') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchExpHTML() + '</div>';
    if (tab === 'def') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchDefHTML() + '</div>';
    if (tab === 'beacon') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchBeaconHTML() + '</div>';
    if (tab === 'affairs') return '<div class="ui-page">' + ui.marchTabHTML() + ui.marchAffairsHTML() + '</div>';

    /* ---------- ① 城内（v89.140 老板 2：表头 = 各兵种名称，逐格显示数量） ----------
       老板原话：「兵种明显直接增加表头为各兵种名称，分别显示数量。**固定行宽**，
       超过 1W 的以万缩略显示」——
       · 列 = 全境**出现过**的兵种（按 DATA.TROOPS 顺序；没兵的兵种不占列）；
       · 数量一律走 `U.fmt`（≥1 万 → X.X 万；< 1 万千分位）；
       · 列宽固定（CSS `.mc-tbl`，table-layout: fixed）—— 数量长短不再撑动版式。 */
    var troopCols = Object.keys(DATA.TROOPS).filter(function (tid) {
      if (DATA.TROOPS[tid].nocombat) return false;
      return (s.cities || []).some(function (ct) { return ((ct.army || {})[tid] || 0) > 0; });
    });
    var cityRows = (s.cities || []).map(function (ct) {
      var cells = troopCols.map(function (tid) {
        var n = (ct.army || {})[tid] || 0;
        return '<td class="num">' + (n > 0 ? U.fmt(n) : '<span style="opacity:.25;">—</span>') + '</td>';
      }).join('');
      return '<tr><td class="mc-name">' + U.escape(ct.name) +
        ((GAME.isMainCity && GAME.isMainCity(ct)) ? ' <span class="city-tier mt">主城</span>' : '') +
        ((c && ct.id === c.id) ? ' <span style="color:var(--gold-light);font-size:var(--fs-cap);">当前</span>' : '') + '</td>' +
        '<td class="num">' + U.fmt(GAME.armyTotal(ct)) + '</td>' + cells + '</tr>';
    }).join('');
    var cityBlock = (s.cities || []).length
      ? '<table class="tbl mc-tbl"><thead><tr><th class="mc-name">城池</th><th class="num">合计</th>' +
        troopCols.map(function (tid) { return '<th class="num">' + U.escape(DATA.TROOPS[tid].name) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + cityRows + '</tbody></table>'
      : '<div class="q-empty">尚无城池。</div>';

    /* ⛔ v89.140（老板 2）：「军务总览中，**不再显示驻守野地和采集队菜单**」——
       两块（含各自的列表与合计）整段退役：驻军的唯一落点 = **附属野地界面**
       （每野地一行：将领 / 驻军 / 操作），采集的唯一落点 = 地块与军务处。
       合计值 `garTot` 随统计行一并退役（那个统计行也在本轮删掉）。 */

    /* ⛔ v89.140（老板 2）：采集队块同上退役（"不再显示…采集队菜单"）——
       采集的进度/收获统一在**地块界面**与**军务处**操作；
       全境采集一览在「附属野地」（已含带领将领与驻军数）。 */

    /* ---------- v89.87（老板需求 4）：④′ 征战中（待指挥的观战战斗） ---------- */
    var btPend = ui.btPendingBlock();

    /* ---------- ④ 行军（**全境**队列，不只看当前城） ---------- */
    var list = (s.marches || []).slice();
    var marchTot = 0;
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      marchTot += n;
      var left = Math.max(0, (m.totalTime - m.elapsed) / GAME.timeScale());
      var from = GAME.cityById(m.cityId);
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
        '<td class="ctr">' + (from ? U.escape(from.name) : '—') + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="ctr">' + md.name + '</td>' +
        '<td class="num">' + U.numText(n, 0) + '</td>' +
        '<td style="min-width:150px;">' +
          '<div class="pbar"><i style="width:' + pr.pct + '%"></i></div>' +
          '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + pr.pct + '% · 余 ' + U.durExact(left) + '</span></td>' +
        '<td class="ctr"><button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td>' +
        '</tr>';
    }).join('');
    var marchBlock = list.length
      ? '<table class="tbl"><thead><tr><th>目标</th><th class="ctr">出发</th><th class="ctr">主将</th><th class="ctr">方式</th><th class="num">兵力</th><th>行军进度</th><th class="ctr">操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="text-align:center;margin-top:10px;"><button class="btn gold" data-action="march-rush">⚡ 急行军令（立即抵达）</button></div>'
      : '<div class="q-empty">当前没有在途行军队列。在地图上对野地 / 据点 / 城池点「出兵」即会进入行军。</div>';

    /* v89.140（老板 2）：① 统计行（"在城 X · 驻守 Y · 采集 Z …"）**整行去掉**；
       ② 驻守野地 / 采集队两块去掉；③ 编号重排为 ① 城内 / ② 征战中 / ③ 行军。 */
    return '<div class="ui-page">' + ui.marchTabHTML() +
      '<div class="gold-heading">⚔ 军务总览</div>' +
      '<div class="q-sec" style="margin-top:6px;"><span class="q-sec-t">① 城内</span><span class="q-sec-n">' + (s.cities || []).length + ' 城</span></div>' +
      cityBlock +
      (btPend ? '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">② ⚔ 征战中</span><span class="q-sec-n">' + btPend.n + ' 处</span></div>' + btPend.html : '') +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">' + (btPend ? '③' : '②') + ' 行军</span><span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +
      /* v89.132（老板「军务总览里边，不需要两营（伤兵·俘虏）这个菜单，只在军务处即可」）：
         ⑤ 两营区整体退役 —— 两营（含逐兵种清单与操作）的**唯一落点** = 军务 · 军务处；
         军务处页签角标（campBadgeN）仍提示待处理数，点进军务一眼就知道有没有活。 */
      '</div>';
  };

  /* 实时刷新建造进度（格子/城外地块/弹窗倒计时 + 进度条，不整页重绘） */
  ui.updateProgress = function () {
    ['data-build-progress', 'data-ext-progress', 'data-modal-progress'].forEach(function (attr) {
      var els = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) {
        var key = els[i].getAttribute(attr); // "city:3" / "city:wall"（v89.174：'wall' 槽）
        var p = key.split(':');
        /* v89.174：非数字槽位原样传 —— 改前 Number('wall')=NaN，城墙行会永远显示 '…' */
        var pv174 = /^\d+$/.test(p[1]) ? Number(p[1]) : p[1];
        els[i].textContent = GAME.buildPct(p[0], pv174) || '…';
      }
    });
    /* v82：征收退役 —— 按钮冷却同步随功能撤除。 */
    /* 进度条宽度 */
    var bars = document.querySelectorAll('[data-build-bar]');
    for (var b = 0; b < bars.length; b++) {
      var bk = bars[b].getAttribute('data-build-bar');
      var bp = bk.split(':');
      var pr = GAME.buildProgress(bp[0], Number(bp[1]));
      bars[b].style.width = (pr ? pr.pct : 100) + '%';
    }
    /* v73：种田秘境 —— 面板开着时倒计时每秒走、成熟即换出「收获」按钮
       （与征收冷却同一套"弹窗不整页重绘、靠这里每秒同步"的口径）。 */
    var fLeft = document.querySelectorAll('[data-farm-left]');
    for (var f1 = 0; f1 < fLeft.length; f1++) {
      var fi1 = Number(fLeft[f1].getAttribute('data-farm-left'));
      var fs1 = GAME.farmPlotState(fi1);
      fLeft[f1].textContent = fs1.state === 'ripe'
        ? '✨ 已成熟'
        : ('成熟还需 ' + U.durExact(fs1.left / GAME.timeScale()));
    }
    var fBars = document.querySelectorAll('[data-farm-bar]');
    for (var f2 = 0; f2 < fBars.length; f2++) {
      var fi2 = Number(fBars[f2].getAttribute('data-farm-bar'));
      fBars[f2].style.width = GAME.farmPlotState(fi2).pct + '%';
    }
    if (document.querySelector('.farm-space')) {
      var fr = GAME.farmOf(), ripeN = 0;
      for (var f3 = 0; f3 < fr.plots.length; f3++) {
        if (GAME.farmPlotState(f3).state === 'ripe') ripeN++;
      }
      var shownN = document.querySelectorAll('.farm-cell [data-action="farm-harvest"]').length;
      if (ripeN !== shownN) ui.openFarm();
    }
  };

  /* 公文页正文的实时刷新（v16 起消息流整合进公文）
     v89.107：刷新的是**当前页签的正文**（#doc-body）；页签本身不由这里重画 ——
     它带条数，每秒重画会把 hover 态和位置一起抖没。 */
  ui.renderLog = function () {
    var el = $('#doc-body');
    if (!el) return;                     // 仅在公文档可见时刷新
    if (ui.hoverHold(el)) return;        /* v89.158：悬停保护（消息行/按钮的悬停不被打断） */
    el.innerHTML = ui.docBodyHTML(ui._docTab || 'war');
  };

  /* ================= 侧栏 ================= */
  ui.setCity = function (id) {
    if (GAME.cityById(id)) { ui._cityId = id; ui.renderView('city'); ui.renderSide(); }
  };

  /* 侧栏渲染（三段式：城池属性 / 资源 / 驻军）
     v16 起侧栏为常驻固定布局，不再有页签切换 */
  ui.renderSide = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!s || !c) return;
    ui.renderCityAttrs(c, s);
    ui.renderWildPick(c, s);
    ui.renderResBar(c, s);
    ui.renderGarrison(c, s);
  };

  /* ============================================================
   * 附属野地下拉框（v77 · 老板）
   * ------------------------------------------------------------
   * 资源区一行：「附属野地」+ 下拉框（地形 等级（坐标））+「进入」。
   * 进入 = openWilds（野地界面：加成一览 / 采集队 / 定位）。
   * 签名不变则不重绘 —— 下拉展开与选择不会被每秒刷新合上（同 #city-switch-host 套路）。
   * ============================================================ */
  ui._wildSig = null;   /* null 而非 ''：首帧必然渲染（哪怕"暂无野地"） */
  ui._wildSel = 0;
  ui.renderWildPick = function (c, s) {
    var box = $('#wild-pick-host');
    if (!box) return;
    if (ui.hoverHold(box)) return;     /* v89.158：悬停保护（下拉展开/悬停期间不重绘） */
    /* v89.154（老板 3）：下拉框与「附属野地面板」**同用** ui.wildSortedOf（唯一排序出口）——
       两处顺序一致，ui._wildSel 的显示序下标语义才一致（否则「进入」高亮会指错行）。 */
    var wilds = ui.wildSortedOf(s && s.wilds);
    /* v89.137（清单①）：采集"在采"状态在此可见 —— 选项带 ⛏ 标记；
       签名把"是否在采 + 是否驻军（都影响排序档位）"也算进去（否则开/停时下拉不刷新）。 */
    var _gatherFlag137 = function (w) { return (GAME.gatherAt && GAME.gatherAt(w.x, w.y)) ? 'g' : ''; };
    var _garFlag154 = function (w) { return (GAME.wildGarrisonTotal(GAME.wildGarrisonAt(w.x, w.y)) > 0) ? 'G' : ''; };
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level + _gatherFlag137(w) + _garFlag154(w); }).join('|');
    if (sig === ui._wildSig) return;
    ui._wildSig = sig;
    if (ui._wildSel >= wilds.length) ui._wildSel = 0;
    var sel = ui._wildSel || 0;
    var opts = wilds.map(function (w, i) {
      var t = DATA.TERRAIN[w.type];
      var _inGather137 = !!_gatherFlag137(w);
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + ' title="' +
        ((t ? t.name : w.type) + ' Lv' + w.level + (w.garrison ? '　驻军 ' + U.fmt(GAME.wildGarrisonTotal(w.garrison)) : '') +
          (_inGather137 ? '　⛏ 采集中' : '')) + '">' +
        (t ? t.name : w.type) + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）' +
        (_inGather137 ? ' ⛏' : '') + '</option>';
    }).join('') || '<option value="">暂无野地</option>';
    /* v89.128（老板）：「附属野地改成野地，现在换行了有点难看」——短标签 + 小按钮，一行放得下。 */
    box.innerHTML = '<div class="res-line" title="已占野地（官府等级决定上限）。选一块点「进入」查看加成与采集。">' +
      '<span class="lbl">野地</span>' +
      '<span class="val" style="display:flex;align-items:center;gap:6px;">' +
        '<select class="city-select wild-select" id="wild-pick" data-action="wild-pick"' +
          (wilds.length ? '' : ' disabled') + '>' + opts + '</select>' +
        /* v89.128（老板）：「进入按钮太大了点，适当缩小」 */
        '<button class="btn sm gold wild-go" data-action="open-wilds">进入</button>' +
      '</span></div>';
  };

  /* ============================================================
   * 城池操作栏（v22 · 需求 3）
   * 原先这些控件全挤在棋盘上方（征收黄金 / 显示比例 / 州郡岁贡），
   * 中央视图被压得只剩半屏。现在下沉到左侧栏 ——
   * 「看的」放中央，「操作的」放侧栏，界面才纯粹。
   * ============================================================ */
  /* v27（需求 1）：`renderCityTools` 整段删除。
     原板块仅剩"切换城池"，且只有多城时才渲染 —— 空着的时候还占一个带标题的分区。
     切城现在并进「城池属性」顶部（见 renderCityAttrs），侧栏从此只有三块：
     君主卡 / 城池属性（含切城）/ 资源与驻军。 */

  /* ============================================================
   * 侧栏驻军栏（v16 · 需求 #17）
   * 固定在资源栏下方、固定高度；列出当前城池各兵种数量（v89.36 起耗粮列退役），
   * 空城也占位（不塌陷），可折叠。
   * ============================================================ */
  ui._garrisonOpen = true;
  ui.renderGarrison = function (c, s) {
    var el = $('#garrison-bar');
    if (!el || !c) return;
    if (ui.hoverHold(el)) return;      /* v89.158：悬停保护（同资源栏） */
    var ids = Object.keys(c.army || {}).filter(function (k) { return (c.army[k] || 0) > 0; });
    var open = ui._garrisonOpen !== false;
    /* v65（老板）：「左侧统计的驻军，只留驻军 2 个字就行了，
       总数、种类、总体耗粮都不需要」——
       原先标题是「⚔ 许都 · 驻军　12,345　8 种 · 耗粮 1,234/h」，一行塞了四件事；
       城名在上方「城池属性」栏已有，数量在下面的明细里逐行可见。标题只留两个字。
       v89.36：军粮维持退役，明细的「耗粮」列一并移除（原来那两列而今只剩数量一列）。 */
    var head = '<div class="gb-head" data-action="toggle-garrison">' +
      '<span>⚔ 驻军</span>' +
      '<span class="gb-arrow">' + (open ? '▾' : '▸') + '</span></div>';
    var body = '';
    if (open) {
      body = ids.length
        ? '<div class="gb-list">' + ids.map(function (k) {
            var t = DATA.TROOPS[k];
            return '<div class="gb-row"><span class="gb-n">' + (t ? t.name : k) + '</span>' +
              '<span class="gb-c">' + U.numText(c.army[k], 0) + '</span></div>';
          }).join('') + '</div>'
        : '<div class="gb-empty">本城暂无驻军（军营可募兵）</div>';
    }
    el.innerHTML = head + body;
  };

  /* 城池名 + 等级标注（v29 · 需求 9）：
     [都城] / [州城] / [郡城] / [县城]，自建城不标（"自建城"三个字没有信息量）。 */
  ui.cityLabelHTML = function (c, short) {
    if (!c) return '';
    var tn = GAME.cityTierName ? GAME.cityTierName(c) : '';
    /* v70（老板）：地名走**全称**（州 · 郡 · 县，唯一出口 GAME.cityFullName）。
       v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
       窄处（侧栏）传 short=true 走**短名**：城名 + 档位标，与 GAME.cityLabel 同规则；
       全称仍供统计表格 / 出征目标等需要"这是哪一州的城"的地方使用。 */
    var name = short ? U.escape(c.name) : U.escape(GAME.cityFullName(c));
    /* v79（老板）：「主城名称后有【主城】标识」—— 全站走这一个出口 */
    var mt = (GAME.isMainCity && GAME.isMainCity(c)) ? '<span class="city-tier mt">主城</span>' : '';
    return name + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '') + mt;
  };

  /* ② 城池属性栏：民心/民怨/税率/黄金/人口 */
  ui.renderCityAttrs = function (c, s) {
    var box = $('#city-attrs');
    if (!box) return;
    /* v89.158：悬停保护 —— 城池下拉/🎲📍 按钮/属性行的悬停态不被每秒重绘打断 */
    if (ui.hoverHold(box)) return;
    var maxPop = GAME.maxPopOf(c);
    var hearts = Math.round(s.hearts || 100);
    var minyuan = Math.max(0, 100 - hearts);
    /* v27（需求 1）：多城时的「切换城池」并入本栏顶部 ——
       它本来就是"这座城的属性"的一部分（换城就是换一整套属性）。
       单城时不渲染，省一行高度。
       v45（需求 3）：由 chips 改为**原生下拉框** ——
       城池数会随进程不断增长，chips 在窄侧栏里折行会把城池属性挤下去；
       下拉框恒定一行，且"我有哪些城"一眼看全。 */
    /* v71（老板）：「即使只有一个城池，也保留这个城池下拉框，在这里可以显示州郡县坐标」
       —— 城池属性行瘦身后（只显城名），下拉框升格为「选址信息」的出口：
       单城也照常渲染；选项文案 = 州郡县全称 + 坐标（在哪建城，一眼可鉴）。 */
    var switcher = '<div class="city-switch"><span class="cs-lbl">城池</span>' +
      '<select class="city-select" data-action="switch-city" title="切换当前经营的城池">' +
      s.cities.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' +
          U.escape(GAME.cityFullName(x))
          + ((GAME.isMainCity && GAME.isMainCity(x)) ? '【主城】' : '')
          + ' ' + U.escape(GAME.coordText(x)) + '</option>';
      }).join('') +
      '</select></div>';
    /* v53（老板："点出来列表马上收回去了"）：**城池清单必须与每秒重绘解耦**。
       主循环每秒调一次 renderSide → renderCityAttrs，改前 switcher 拼在下面的 html 里，
       `box.innerHTML = html` 会把 <select> 整块销毁重建 ——
       原生下拉列表挂在那个元素上，元素一没、列表立刻合上，根本来不及选。
       （还有一处：点 select 展开时那个 click 会被共用委托 dispatch 掉，同样触发重绘；
        已在 main.js 的 click 委托里对 SELECT 直接放行。）
       现在它走**自己的静态节点** #city-switch-host，只在
       "城池清单或当前城池变了"时才重建；城池属性正文照旧每帧重建（正文没有交互态）。 */
    var host = $('#city-switch-host');
    /* v71（老板）：选项文案含城名 / 坐标 —— 签名跟着文案走，
       改名、迁址后下一帧即刷新；否则下拉框会停在旧文案上。 */
    var sig = (s.cities || []).map(function (x) {
      return x.id + ':' + (x.name || '') + ':' + x.x + ',' + x.y;
    }).join(',') + '|' + c.id + '|' + (s.mainCityId || '');   /* v79：主城变更也要刷新 */
    if (host) {
      if (ui._citySwSig !== sig) {         /* 没变 → 一个字节都不碰这个 select */
        ui._citySwSig = sig;
        host.innerHTML = switcher;
      }
    } else if (switcher) {
      /* 节点缺失只可能是 index.html 被改坏 —— 不许静默 */
      if (typeof console !== 'undefined') console.warn('renderCityAttrs: 缺少 #city-switch-host，城池清单未渲染');
    }
    var html = '' +
      /* v22（需求 3）：城池身份从棋盘上方下沉到这里 */
      '<div class="res-line" style="border-bottom:1px solid var(--sep-gold);padding-bottom:5px;margin-bottom:3px;">' +
        '<span class="lbl" style="color:var(--gold-light);font-weight:700;">🏯 ' +
          ui.cityLabelHTML(c, true) + '</span>' +
        /* v70（老板）：「城池的主界面提供其坐标……一键随机……坐标切换（除名城，名城固定）」。
           v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
           坐标 / 官府 Lv 文字从本行撤下（迁址弹窗里仍能看到当前坐标）；
           🎲/📍 两个**操作入口**保留（它们不是"显示"），名城仍只标注不可迁。
           两钮都走唯一出口 GAME.canCityMoveTo。 */
        '<span class="val" style="font-weight:400;color:var(--text-dim);">' +
          (GAME.isMovableCity(c)
            ? '<button class="btn sm" data-action="city-random" title="一键随机：迁到一处空闲平原">🎲</button>' +
              '<button class="btn sm" data-action="city-move-ask" title="坐标切换：输入坐标迁址">📍</button>'
            : '<span style="opacity:.7">名城固定</span>') +
        '</span></div>' +
      /* v26（需求 3）：天时已移到顶栏 —— 它是全局信息，不该占城池属性的位置 */
      /* v28（需求 3）：民心与民怨合并成一行「xx / xx」——
         两者本是同一枚硬币（民怨 = 100 − 民心），各占一行纯粹浪费侧栏高度。 */
      /* v89.128（老板）：「民心/税率/人口前边的小图标去掉」 */
      '<div class="res-line"><span class="lbl">民心 / 民怨</span><span class="val">' +
        '<b style="color:' + (hearts > 60 ? 'var(--green-ok)' : hearts > 30 ? '#e6a400' : 'var(--red-light)') + ';font-variant-numeric:tabular-nums;">' + hearts + '</b>' +
        ' <span style="color:var(--text-dim);">/</span> ' +
        '<span style="font-variant-numeric:tabular-nums;">' + minyuan + '</span></span></div>' +
      /* v89.104（老板）：「税率调整直接放左侧统计栏的税率处，将目前的数值显示
         改成可调节的税率数值」—— 就地点 −/＋（步长 5%，0~100%），值走 GAME.doSetTax。 */
      '<div class="res-line"><span class="lbl">税率</span><span class="val">' +
        /* v89.128（老板）：「可点击的功能按钮参考资源那里的按钮，统一图标风格大小和颜色」 */
        '<span class="plus-btn" data-action="tax-step" data-d="-5" title="税率 −5%">−</span>' +
        '<b style="font-variant-numeric:tabular-nums;margin:0 6px;">' + Math.round((s.tax || 0) * 100) + '%</b>' +
        '<span class="plus-btn" data-action="tax-step" data-d="5" title="税率 +5%">＋</span>' +
      '</span></div>' +
      /* v20（需求 5/12）：黄金存量、税收速率、可征人口**全部去掉** ——
         · 黄金与资源栏重复
         · 税收（金/时）数值不准且与资源栏的 /秒 增速口径不一致，删掉避免误导
         · 可征人口 信息密度低，需要时在人口统计面板看 */
      /* v89.124（老板「人口增速也按小时显示。界面规划参考资源」）：
         人口行补**增速列**（/时），排版对齐资源行三列（名称 | 存量·上限 | 增速）——
         增速走唯一出口 GAME.popGrowthOf（**现实每小时**口径 v89.126，无需换算）；
         已到上限显示 +0/时（与 tickOnce 的"超上限不增长"同判据）；
         悬停给增速来源分解（与募兵面板 pop-3 同一份 popSourcesOf）。 */
      (function () {
        var popNow = Math.floor(s.res.pop || 0);
        var grow = Math.floor(GAME.popGrowthOf(c));
        if (popNow >= maxPop) grow = 0;
        var popSrc = '';
        try {
          (GAME.popSourcesOf(c) || []).forEach(function (x) {
            if (Math.abs(x.v) > 1e-9) popSrc += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
          });
        } catch (e) {}
        /* v89.126：补满预计（现实时间）—— "固定时间速率"的可读化 */
        var popEta = (popNow < maxPop && grow > 0)
          ? '\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';
        /* v89.128（老板）：「悬停显示"建筑人口/上限人口"，建筑人口就是各建筑固定占据的
           人口数，这部分人口不可征兵」—— 劳作占用的**展示名**定为"建筑人口"。 */
        var popLab = GAME.popLaborOf(c);
        var popLabLine = '\n建筑人口 ' + U.fmt(popLab) + ' / 上限人口 ' + U.numText(maxPop, 0)
          + '（建筑人口为各建筑固定占用，不可征兵）';
        return '<div class="res-line pop-line"><span class="lbl">人口</span><span class="val">' +
          /* v89.128（老板）：「人口只显示当前人口数，不显示上限，节约空间」——
             上限迁入悬停（与建筑人口合并给）。
             ⚠️ 存量仍是**一个** .amt 块（裸文本会变独立网格项、把后续列顶错位）。 */
          '<span class="amt">' + U.numHTML(popNow, 0) + '</span>' +
          '<span class="rate-wrap" data-tip="人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)
            + ' 小时补满）：民房上限决定速率' + popSrc + popEta + popLabLine +
            (popNow >= maxPop ? '\n已到上限 —— 不再增长（建/升民房可提上限）' : '') + '">' +
          '<span class="num-rate' + (grow > 0 ? '' : ' zero') + '">+' + U.perHourText(grow) + '/时</span>' +
          '</span>' +
          /* v89.128（老板）：「人口增速这里加个类似资源增速的加号按钮，用于使用相关道具
             （不要显示现有道具数量）」——与资源 "+" 同款（plus-btn）。 */
          '<span class="plus-btn" data-action="quick-pop" title="使用人口道具（增民令 / 移民令）">+</span>' +
          '</span></div>';
      })() +
      /* v24（需求 6）：再删两行 ——
         · 「🧱 城防 · 驻军」：驻军栏就在正下方（含兵种与耗粮），城防在「统计」页；
         · 「🌾 城外地块」：城外视图的棋盘本身就是这块数据，重复且挤。
         侧栏从此只留下"本城当下最该一眼看到"的几项。 */
      /* v89.36：断粮警示随军粮维持退役（军队不再吃粮，不存在"粮尽"状态）。 */
      /* ============================================================
       * v89.107（老板）：「左侧统计栏的烽火警报（含策略布防）放到军务中，
       *   与出征防守等并列」—— 原先挂在这里的两块**整体搬走**：
       *     · 烽火预警横幅（本段 IIFE）      → 军务 · 烽火页「① 预警」
       *     · `ui.citySchemeHTML` 计略布防行 → 军务 · 烽火页「② 策略布防」
       *   搬走的原因：预警与布防都是**军事决策**，与出征/防守同一层；
       *   留在左侧栏会让它和"人口/税率"这类本城日常挤在一起，也看不见别城。
       *   两个出口（invasionDueAt / defensePowerOf）的界面消费点改在
       *   `ui.marchBeaconHTML`，删这里不会让 audit 报死函数。
       * ============================================================ */
      '';
    box.innerHTML = html;
  };

  /* ============================================================
   * 出征战术（v59 · 阵位与指挥指令的设置界面）
   * ------------------------------------------------------------
   * 原版把这件事放在「校场 → 出征 → 出征战术」里设默认动作，防守方在
   * 「校场 → 防守战术」里设。本作**只有攻方需要指挥**（守方 NPC 用默认动作，
   * 见 GAME.tacticOf 的注释：做了没有消费点的入口就是死数据），所以只做一个入口。
   *
   * 每兵种两项（照搬原版 §九）：
   *   · 动作 —— 前进 / 防御 / 后退，**决定初始站位**（100 / 50 / 0）与每回合怎么动
   *   · 目标 —— 「自动」或敌方某一兵种，另有「箭塔」（攻城时拆工事，原版的核心动作）
   * 点选即存、只切 class 不重绘（与全站点选一致），下次出征生效。
   * ============================================================ */
  ui.TAC_PER = 4;                    // 弹窗每页 4 个兵种（页面内嵌不分页，全列）
  /* 战术 chip —— side 必填（v89.109 起战术分侧：atk = 出征 / def = 防守）。
     ⚠️ `data-g` 必须带 side 前缀：出征页与防守页的 chip 若同名，互斥组会串台。 */
    /* ⛔ v89.133 退役：`tacticChip`（chip 按钮组）—— 第 13 条改下拉框后无调用点。
     原实现：`<span class="chip" data-action="tactic-set" data-f=… data-v=…>`（v89.109 版）。 */

  /* 会出现在战场上的兵种（与 tactic.unitsOf 的判据一致：非 nocombat）——
     斥候不上阵、指挥它没有意义，所以战术表里也不该有它。 */
  ui.tacticTroopIds = function () {
    return Object.keys(DATA.TROOPS).filter(function (id) { return !DATA.TROOPS[id].nocombat; });
  };
  /* 单兵种战术块（页面与弹窗共用 —— **唯一渲染口**，改样式只改这一处）。
     未设置时高亮该侧**默认**（防守侧 = 攻城固守；出征侧 = 前进）——
     "高亮的就是下场时生效的"，不留给玩家"我到底设没设"的疑问。 */
  ui.tacticBlockOf = function (side, id) {
    /* v89.136（老板 4）：'raid'/'occupy' 是**出征细分页** ——
       显示走合并视图（细分覆盖通用 · 与战斗读取同一口径），写入 data-tside 落细分表。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var tr = DATA.TROOPS[id];
    var set = (isSub ? GAME.tacticsFor(side) : GAME.tacticsOf(side))[id] || {};
    /* v89.137（清单②）：细分页显示"这条是细分里设的，还是跟随通用"——
       ownSub137 = 细分表（raid/occupy）里有该兵种的记录（写入端 data-tside 即落该表）。 */
    var ownSub137 = isSub
      ? !!(GAME.state && GAME.state.tactics && GAME.state.tactics[side] && GAME.state.tactics[side][id])
      : false;
    var curS = set.s || (isDef ? 'hold' : 'advance');
    var curT = (typeof set.t === 'string') ? set.t : '';
    var sortieOn = !!set.sortie;
    var ids = ui.tacticTroopIds();
    /* v89.149（老板 4）：默认目标 = 同兵种（引擎层），战术页的「自动」即此义；
       「任意」= 显式不指定（哨兵 DATA.TARGET_ANY）—— 保住"打最近的"这条既有能力。 */
    var tgt = [{ v: '', label: '自动（同兵种）' }]
      .concat([{ v: DATA.TARGET_ANY, label: '任意（打最近）' }])
      .concat(ids.map(function (x) {
        return { v: x, label: DATA.TROOPS[x].name };
      })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);
    /* ============================================================
     * v89.133（v89.128 第二批第 13 条 · 老板）：「军务中出征战术，动作和目标均以下拉框
     *   显示，不直接全部列出，分左右两列显示」——
     *   chip 按钮组（一排 3~6 个）→ **原生 select**；行内只留「名称 · 动作 · 目标」（防守侧 + 出城）。
     * 一份实现两处宿主：**出征战术页**与**页内弹窗**（openTacticModal 复用本函数）——
     *   change 由 main.js 的全局委托转 GAME.action（与页内其它 select 同一机制）。
     * ============================================================ */
    var sel = function (k, cur, opts) {
      return '<select class="city-select tl-sel" data-action="tactic-set" data-tside="' + side +
        '" data-troop="' + id + '" data-f="' + k + '">' +
        opts.map(function (o) {
          return '<option value="' + o.v + '"' + (cur === o.v ? ' selected' : '') + '>' +
            U.escape(o.label) + '</option>';
        }).join('') + '</select>';
    };
    /* v89.138（清单①）：细分页"本页单独设置"的行加**左侧金边**（own-sub）——
       改细分下拉后整行立刻带金边（与行尾小标两层视觉），一眼分清哪几行覆盖了通用。 */
    return '<div class="tac-line' + (isSub && ownSub137 ? ' own-sub' : '') + '">' +
      '<span class="tl-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</span>' +
      sel('s', curS, DATA.STANCES.map(function (st) { return { v: st.id, label: st.icon + st.name }; })) +
      sel('t', curT, tgt) +
      (isDef ? '<label class="tl-sortie" title="出城迎战：出城部队前出到城墙之外 —— 攻方必须先把它打完，'
        + '才够得着城墙；它也吃不到城墙护佑">' +
        '<input type="checkbox" data-action="tactic-set" data-tside="' + side + '" data-troop="' + id +
        '" data-f="sortie"' + (sortieOn ? ' checked' : '') + '>出城</label>' : '') +
      /* v89.137：细分页的小标（"跟随通用" / "细分"）—— 一眼分清哪几行是本页设的 */
      (isSub
        ? '<span class="tl-sub-tag' + (ownSub137 ? ' own' : '') + '" title="' +
          U.escape(ownSub137
            ? '本页单独设置 —— 覆盖通用出征战术（战斗按本页执行）'
            : '未单独设置 —— 跟随通用的出征战术（改这里的下拉即在本页单独设置）') +
          '">' + (ownSub137 ? '细分' : '跟随通用') + '</span>'
        : '') +
      '</div>';
  };
  /* 全表（页面内嵌用） */
  ui.tacticBlockHTML = function (side) {
    /* v89.133（第 13 条）：**分左右两列** —— 每个兵种一行（名称 · 动作 · 目标）。 */
    return '<div class="tac-grid">' +
      ui.tacticTroopIds().map(function (id) { return ui.tacticBlockOf(side, id); }).join('') + '</div>';
  };
  ui.openTacticModal = function (side) {
    /* v89.136（老板 4）：支持细分（'raid'/'occupy'）—— 出征面板的「逐兵种」按当前出征方式打开。 */
    if (side !== 'def' && side !== 'raid' && side !== 'occupy') side = 'atk';
    var isDef = side === 'def';
    var isSub = (side === 'raid' || side === 'occupy');
    var ids = ui.tacticTroopIds();
    var pg = ui.modalPage('tactic' + side, ids, ui.TAC_PER, function () { ui.openTacticModal(side); });
    var body = pg.slice.map(function (id) { return ui.tacticBlockOf(side, id); }).join('');
    ui.openShell({
      title: isDef ? '🛡️ 防守战术'
        : (side === 'raid' ? '⚔️ 出征战术 · 掠夺'
          : (side === 'occupy' ? '⚔️ 出征战术 · 占领' : '⚔️ 出征战术')),
      sub: '当前：' + GAME.tacticSummary(side) + ui.help(
        '每兵种：**动作**（前进 / 防御 / 后退）+ **目标**（敌方某一兵种，或攻城时的**箭塔**）。' +
        (isDef ? '\n防守侧另有「**出城迎战**」：出城部队前出到城墙之外 —— 攻方必须先把它打完，\n才够得着城墙（拆不了工事）；它也吃不到城墙护佑（风险与收益都归自己）。' : '') +
        '\n动作决定**初始站位**：前进 = 第一排（100）、防御 = 第二排（50）、后退 = 第三排（0）。\n' +
        '· **前进**：每回合向敌阵推进（推进到刚好能开火就停）\n' +
        '· **防御**：原地不动，**受到的伤害减半**（远程原地对射就是选它）\n' +
        '· **后退**：每回合向己方后撤，用来躲开箭塔的**双倍攻击区**\n' +
        '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转为打守军）。\n' +
        (isDef ? '我方城池被攻打时用**你设的这套**；NPC 守方用默认（攻城固守 / 野地迎击）。'
               : '守方（NPC 城池 / 野地）用默认动作：攻城时固守（依城而战），野地时迎击。')),
      body: body + pg.pager,
      foot: '<div class="m-foot">' +
        '<button class="btn" data-action="tactic-reset" data-tside="' + side + '">恢复默认</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>',
    });
  };
  /* ③ 资源栏：每项数量+时产+「+」快捷道具 */
  var RES_QUICK_ITEM = { grain: 'shennongchu', wood: 'lubanfu', stone: 'kaishanchui', iron: 'xuantielu', gold: 'shuilibian' };
  /* ============================================================
   * 侧栏资源栏（v29 建 · v60 改口径）
   * ------------------------------------------------------------
   * v29：产量取 `GAME.productionPerSec()` 是**全境合计**，切城时资源栏一个数字
   *   都不动；于是改成本城产量，栏首写明"本城产量 · 全境存量"。
   * v89.123（老板「资源产量以每小时产量呈现，过万以"万"显示」）：
   *   增速由「/秒」改「/时」（`U.rateHTML` 内换算，入参 *每秒* 口径不变），
   *   数值过万进「万」档（`U.perHourText` 唯一出口）；悬停明细与主显示同口径。
   * v60（需求 4）：**存量也归属城池了** —— s.res 现在就是当前城的库存
   *   （见 state.js 的 attachRes 访问器）。所以：
   *     · 栏首报"本城"；
   *     · 存量 = 本城库存（不是全境共享）；
   *     · 悬停里仍给出"本城构成 / 全境合计"两把尺子，方便对比；
   *     · 上限取本城仓容（GAME.storeCap 已按城）。
   * ============================================================ */
  ui.renderResBar = function (c, s) {
    var box = $('#res-bar');
    if (!box) return;
    /* v89.158（老板 2）：悬停保护 —— 鼠标在资源栏内时本秒不重绘
       （否则每秒重建会把悬停的 .amt / .rate-wrap 节点换掉 → 容量悬停闪烁）。 */
    if (ui.hoverHold(box)) return;
    var prodAll = GAME.productionPerSec();
    var prodCity = GAME.cityProdPerSec(c);
    /* v77（老板）：「资源这里的备注：本城 新城池改成附属野地 下拉框」——
       原「本城 · 城名」表头退役；附属野地选择器在独立静态节点
       #wild-pick-host（ui.renderWildPick 渲染），不会被每秒重绘打断。 */
    var html = '';
    DATA.RES_ORDER.forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      var perSec = prodCity[k] || 0;          // 本城产量（随切城变化）
      var perSecAll = prodAll[k] || 0;        // 全境合计（悬停里给出）
      var val = s.res[k] || 0;
      /* v19：资源行**只用文字**（去掉图标）；存量取整到个位
         （小数在每秒刷新的画面上一直在闪，没有信息量）；增速仍按 /秒。 */
      /* v20（需求 11）：产量悬停显示构成明细（基础产量 + 各类加成/扣除） */
      /* v20（需求 11）：产量悬停显示构成明细（基础 + 各类加成/扣除）
         U.rateHTML 产出的是 <span class="num-rate">，外面再包一层带 data-tip 的容器。 */
      var bd = GAME.prodBreakdown ? GAME.prodBreakdown(k, c) : null;
      var tipLines = ['本城产量构成（/时）'];
      var _ts = GAME.timeScale();
      if (bd && bd.length) {
        bd.forEach(function (x) {
          /* v89.123：明细与主显示同口径 —— /时（游戏时间，×3600÷ts）+ 过万以万 */
          tipLines.push(x.name + '：' + (x.val >= 0 ? '+' : '-') + U.perHourText(Math.abs(x.val) * 3600 / _ts));
        });
        tipLines.push('本城合计：+' + U.perHourText(perSec * 3600 / _ts));
      } else {
        tipLines.push('本城暂无产量');
      }
      tipLines.push('———');
      tipLines.push('全境合计：+' + U.perHourText(perSecAll * 3600 / _ts));
      var rateHtml = '<span class="rate-wrap" data-tip="' + U.escape(tipLines.join('\n')) + '">'
        + U.rateHTML(perSec) + '</span>';
      /* v89.158（老板 1「左侧资源统计的容量显示仍然不对」）：容量悬停改**分账**——
         上限 = 仓库/基础 + 城外堆场，两行相加自洽（唯一出口 GAME.storePartsOf）；
         改前只写"其中城外堆场 +Y"，另外的 200 万基础没有出处（账对不上）。
         已占 ≥100% 显示"已满"（不再出现"已占 123%"这类读数）。
         黄金是货币，不受仓库上限约束（同前口径）。 */
      var sp = GAME.storePartsOf ? GAME.storePartsOf(GAME.currentCity()) : null;
      var cap = (k === 'gold') ? 0 : (sp ? sp.total : (GAME.storeCap ? GAME.storeCap() : 0));
      var _pct = (cap > 0) ? Math.round(val / cap * 100) : 0;
      var amtTip = (k === 'gold')
        ? ('黄金：全境通用（各城共用这一口池子 —— 任何城池的建造 / 募兵 / 花销都从这里扣）'
          + '\n货币，不受仓储上限约束；无需运输。'
          + '\n现有 ' + U.numText(val, 0))
        : ((meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（' + (_pct >= 100 ? '已满' : '已占 ' + _pct + '%') + '）'
          + '\n· ' + ((sp && sp.lv > 0)
              ? ('仓库（' + sp.lv + ' 级合计）：' + U.amtText(sp.base))
              : ('基础储量：' + U.amtText(sp ? sp.base : cap)))
          + ((sp && sp.ext > 0) ? ('\n· 城外堆场：+' + U.amtText(sp.ext) + '（资源建筑按等级所出 · 不吃仓储加成）') : '')
          /* v89.160（老板 1）：逾溢折损 —— **机制在界面可见**（读数与结算同源 DATA.OVERFLOW） */
          + (_pct >= 100 ? ('\n· ⚠️ 已超上限：超出部分每游戏日折损 '
              + Math.round(((DATA.OVERFLOW || {}).ratio == null ? 0.25 : DATA.OVERFLOW.ratio) * 100) + '%'
              + '（现实约 ' + ui.rotPeriodRealText() + '）（'
              + (((DATA.OVERFLOW || {}).events) || []).map(function (e) { return e.name; }).join(' / ') + '）') : '')
          + '\n现有 ' + U.numText(val, 0));
      html += '<div class="res-line">' +
        '<span class="lbl">' + (meta ? meta.name : k) + '</span>' +
        '<span class="val">' +
          '<span class="amt" title="' + U.escape(amtTip) + '">' + U.amtHTML(val) + '</span>' +
          rateHtml +
          /* v89.128（老板）：「不要显示现有道具数量，纯粹一个加号按钮就行」 */
          '<span class="plus-btn" data-action="quick-item" data-res="' + k + '" title="使用辅助宝物">+</span>' +
        '</span></div>';
    });
    box.innerHTML = html;
  };

  /* 「+」号：弹出该资源对应的辅助宝物 */
  ui.openQuickItem = function (res) {
    var s = GAME.state;
    var itemId = RES_QUICK_ITEM[res];
    var cands = DATA.ITEMS.filter(function (it) { return it.type === 'prod_buff' && it.res === res; });
    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === res) resName = r.name; });
    var rows = cands.map(function (it) {
      var have = (s.items && s.items[it.id]) || 0;
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:var(--gold-light);">' + it.name + ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">持有 ' + have + '</span></span>' +
          (have ? '<button class="btn sm gold" data-action="use-item-quick" data-item="' + it.id + '">使用</button>'
                : '<button class="btn sm gold" data-action="shop-buy" data-item="' + it.id + '">购买 ' + U.fmt(it.price * 100) + '金</button>') +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + it.desc + '</div>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">加快' + resName + '产量</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* ============================================================
   * v89.128（老板 需求 7）：「人口增长速度这里加个类似资源增速的加号按钮，
   *   用于使用相关道具（不要显示现有道具数量）」—— 人口道具快用：
   *   增民令（增速 buff）/ 移民令（一次性注入）。与资源 "+" 同款交互；
   *   左侧栏按钮上**不显数量**，持有与否在弹窗里说明。
   * ============================================================ */
  ui.openQuickPop = function () {
    var s = GAME.state;
    var cands = DATA.ITEMS.filter(function (it) {
      return (it.type === 'pop_boost' || it.type === 'pop_fill') && !it.noShop;
    });
    var rows = cands.map(function (it) {
      var have = (s.items && s.items[it.id]) || 0;
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-weight:700;color:var(--gold-light);">' + it.name + ' <span style="color:var(--text-dim);font-size:var(--fs-cap);">持有 ' + have + '</span></span>' +
          (have ? '<button class="btn sm gold" data-action="use-item-quick" data-item="' + it.id + '">使用</button>'
                : '<span style="color:var(--text-dim);font-size:var(--fs-sub);">未持有（商城 · 民生页有售）</span>') +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + it.desc + '</div>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">人口道具（增民令 / 移民令）</div>' + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* 装备/宝物面板快捷入口 */
  /* ============================================================
   * 功能面板：统一以弹窗形式打开，均带「关闭」按钮
   * 功能归属建筑（避免顶部菜单与建筑入口重复）
   * ============================================================ */
  ui.PANEL_TITLE = {
    troops: '⚔️ 军队（军营）', tech: '📜 科技（书院）', equip: '🎽 装备（铁匠铺）',
    items: '💎 宝物', generals: '🧑‍✈️ 将领（招贤馆）', stats: '📊 统计',
    rank: '🏅 爵位', story: '📖 史册', ext: '🌾 城外',
  };
  /* 募兵面板的**弹窗级重绘**（v20）
     原写法在 select-train 里调 GAME.refreshView()，它只重绘中央视图 ——
     而募兵面板开在弹窗里，于是「点了兵种没反应、训练永远是最初那个兵」。
     选中兵种/改数量后必须重绘弹窗本体。 */
  /* ============================================================
   * 募兵面板（v24 · 需求 8）
   * 入口一律带**军营下标** —— 募兵是某座军营的行为，队列也挂在它身上。
   * idx == null 时兜底取本城第一座军营（旧入口 / 中央视图直达）。
   * ============================================================ */
  ui.openTroops = function (idx, filter) {
    /* v80（老板）：「目前选择数量后会跳回到页面顶端，要求取消跳转这个动作」——
       重绘前把两级滚动容器的位置记下来（.inner-panel 与 .panel-body），重绘后原样还回去；
       仅当旧窗本来就是募兵面板（有 #train-count）时才恢复，从别处打开时仍从顶端开始。 */
    var prevRoot = $('#modal-root');
    var keep = null;
    if (prevRoot && prevRoot.querySelector('#train-count')) {
      var pIp = prevRoot.querySelector('.inner-panel');
      var pPb = prevRoot.querySelector('.panel-body');
      keep = { ip: pIp ? pIp.scrollTop : 0, pb: pPb ? pPb.scrollTop : 0 };
    }
    ui._trainBIdx = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    ui._trainFilter = (filter === 'siege') ? 'siege' : 'normal';
    ui.openPanel('troops', ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募');
    if (keep) {
      var nIp = $('#modal-root .inner-panel');
      var nPb = $('#modal-root .panel-body');
      if (nIp) nIp.scrollTop = keep.ip;
      if (nPb) nPb.scrollTop = keep.pb;
    }
  };
  ui.renderTroopsModal = function () { ui.openTroops(ui._trainBIdx, ui._trainFilter); };

  /* 当前面板对应的**工位**：募兵 → 军营，制造器械 → 工匠作坊（v29 需求 13）。
     找不到时回退该类的第一座。 */
  ui.trainBarracks = function () {
    var c = GAME.currentCity();
    var isCraft = ui._trainFilter === 'siege';
    var list = isCraft ? GAME.craftWorkshopsOf(c) : GAME.barracksOf(c);
    if (!list.length) return null;
    if (ui._trainBIdx != null) {
      for (var i = 0; i < list.length; i++) if (list[i].idx === ui._trainBIdx) return list[i];
    }
    return list[0];
  };

  /* 本营募兵队列（执行中 / 排队等待） */
  ui.trainQueueBlock = function (bar, city, kind) {
    kind = GAME.queueKindOf ? GAME.queueKindOf(kind) : 'train';
    var isCraft = kind === 'craft';
    var qs = GAME.trainQueuesOf(city, bar.idx, kind);
    var slots = GAME.trainQueueSlots(bar.lvl, city);
    var title = isCraft ? '本作坊制造队列' : '本营募兵队列';
    if (!qs.length) {
      return '<div class="q-sec" style="margin-top:14px;"><span class="q-sec-t">' + title + '</span>' +
        '<span class="q-sec-n">0 / ' + slots + ' 条</span></div>' +
        '<div class="q-empty">' + (isCraft ? '本作坊暂无制造任务' : '本营暂无募兵任务') + '</div>';
    }
    /* v28（需求 8）：补一列「加速」—— 只有正在执行的那条能加速
       （排队的还没开始走表，加速它没有意义）。 */
    var hasBoost = GAME.systems.trainBoostItems && GAME.systems.trainBoostItems().length > 0;
    var rows = qs.map(function (q, i) {
      var t = DATA.TROOPS[q.troopId];
      var pct = Math.min(100, Math.floor((q.elapsed || 0) / q.totalTime * 100));
      var running = (i === 0);
      var left = Math.max(0, (q.totalTime - (q.elapsed || 0)) / GAME.timeScale());
      return '<tr><td class="ctr">' + (i + 1) + '</td>' +
        '<td>' + (t ? t.name : q.troopId) + ' ×' + U.numText(q.count, 0) + '</td>' +
        '<td class="ctr">' + (running
          ? '<b style="color:var(--green-ok)">' + (kind === 'craft' ? '制造中' : '募兵中') + '</b>'
          : '排队等待') + '</td>' +
        '<td class="num">' + (running
          ? '<span class="qbar" style="display:inline-block;width:64px;vertical-align:middle;margin-right:6px;">' +
            '<i style="width:' + pct + '%"></i></span>' + pct + '%' +
            '<span class="ui-sub" style="margin-left:6px;">余 ' + U.durExact(left) + '</span>'
          : '—') + '</td>' +
        /* v89.49：按钮**不再因"没宝物"而禁用** —— 面板里有花金提速那条路
           （v28 的 disabled 就是老板"不可加速"的直接原因）。 */
        '<td class="ctr">' + (running
          ? '<button class="btn sm gold" data-action="train-boost" data-idx="' + bar.idx + '">加速</button>'
          : '—') + '</td></tr>';
    }).join('');
    return '<div class="q-sec" style="margin-top:14px;"><span class="q-sec-t">本营募兵队列</span>' +
      '<span class="q-sec-n">' + qs.length + ' / ' + slots + ' 条</span></div>' +
      '<table class="tbl"><thead><tr><th>序</th><th>兵种</th><th>状态</th><th>进度</th><th>操作</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      /* v89.49：两条路都写清楚（原先只在"没宝物"时报一句，且按钮是灰的） */
      '<div class="ui-sub" style="margin-top:4px;">' + (hasBoost
        ? '可提速：宝物加速（更划算）· 花金买时间'
        : '背包没有加速宝物，仍可**花金买时间**') +
        ui.help('提速面板里有两条路：\n' +
          '① 花金买时间 —— 价 = 该批军资 ×20% × 还能缩短的比例，随时可用\n' +
          '② 宝物加速 —— 韩信三篇 −30%（每队列限 1 次）· 韩信点兵术 −50%，商城「加速」类购得，更划算') +
      '</div>';
  };

  ui.openPanel = function (view, title, size) {
    var box = ui['PANEL_TITLE'] || {};
    var body = '';
    if (view === 'troops') body = ui.troopsHTML();
    else if (view === 'tech') body = ui.techHTML();
    else if (view === 'equip') body = ui.equipHTML(true);    /* v89.112：弹窗模式（分页走弹窗内） */
    else if (view === 'items') { ui.openBag('item'); return; }
    else if (view === 'generals') body = ui.generalsHTML();
    /* v89.104：`stats` 视图（黄册）已退役 —— 弹窗入口同步撤除 */
    else if (view === 'rank') body = ui.rankHTML();
    else if (view === 'story') body = ui.storyHTML();
    else if (view === 'ext') body = ui.extHTML();
    else body = '<div style="padding:20px;text-align:center;color:var(--text-dim);">此功能暂未开放</div>';
    /* v89.165（老板：「查看所有类似实时读秒设置」）：含读秒/进度的子视图接入
       live 每秒重开 —— troops（募兵队列「余 X」+ 队列条）/ tech（研究中 X%）/
       ext（城外施工总览）。纯静态子视图（equip / rank / story）不接，省每秒重建。 */
    var o165 = size ? { size: size } : {};
    if (view === 'troops' || view === 'tech' || view === 'ext') {
      o165.live = function () { ui.openPanel(view, title, size); };
    }
    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：`.panel-body` 有 558px 硬上限，默认档(620→正文 603)里
         34(标题) + 558 + 47(操作栏) = 639 > 603 → 必然冒滚动条。
         加一个可选尺寸参数，让"内容确实高"的面板（装备 12 格 + 说明）走 xl。 */
      (o165.size || o165.live) ? o165 : null
    );
  };

  ui.openEquipPanel = function () { ui.openPanel('equip', null, 'xxl'); };   /* v89.112：选择器分页后仍 900+，升 xxl */
  ui.openItemsPanel = function () { ui.openPanel('items'); };

  /* ============================================================
   * 背包（v13）：按类型拆分页签 → 组内分组 → 组内可排序
   *   · 页签：装备 / 材料 / 宝物 / 图纸
   *   · 拆分：不同类型分置于不同页签与分组，互不混杂
   *   · 排序：装备按 品质/价值/套件/部位；材料按 系列/品阶/数量；宝物按 类型/价值
   *   · 每行 5 格，属性走悬停浮层，点击开详情
   * ============================================================ */
  /* v89.115（老板）：「背包分成装备和宝物，宝物参考商城的分类进行划分，
     以便快速检索拥有的材料和宝物」——
     顶层改**两类**（装备 / 宝物）；宝物页内用**二级分类条**（材料 / 珠宝 / 符类 / …）
     按类型名出口 `BAG_ITEM_CN`（与商城分类对齐）切分，只列**有货**的类。 */
  var BAG_TABS = [['equip', '装备'], ['treasure', '宝物']];
  /* 二级分类的默认值：全部（= 材料 + 宝物 + 图纸，分三段） */
  ui._bagSub = ui._bagSub || 'all';
  var EQUIP_SLOT_ORDER = ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist',
    'feet', 'back', 'neck', 'ring', 'pendant', 'mount'];
  var BAG_SORT_OPTS = {
    equip: [['q', '品质'], ['val', '价值'], ['set', '套件'], ['slot', '部位']],
    /* 宝物页四类排序：材料看系列/品阶，宝物看类型/价值，通用"数量"两端都能用 */
    treasure: [['type', '类型'], ['series', '系列'], ['tier', '品阶'], ['val', '价值'], ['have', '数量']],
  };
  ui._bagSort = ui._bagSort || { equip: 'q', treasure: 'type' };
  /* 旧顶层页签值 → 新的「类 + 二级分类」映射（老深链/老测试不炸；见 setBagTab） */
  /* v89.143（老板 1）：'item'（老深链）不再落到「全部」—— 落**第一个有货分类**（null = 归一） */
  var BAG_LEGACY_TAB = { mat: ['treasure', 'material'], item: ['treasure', null], bp: ['treasure', 'blueprint'] };

  /* 背包（v25 · 需求 2）：与商城一起由弹窗改为**整页视图** */
  ui.bagHTML = function () {
    var s = GAME.state;
    var t = ui._bagTab || 'equip';
    /* 旧值兜底（v89.115）：直接赋内部变量（老脚本/老用例）也走得通 —— 一次迁移到位 */
    if (BAG_LEGACY_TAB[t]) { ui._bagSub = BAG_LEGACY_TAB[t][1]; t = BAG_LEGACY_TAB[t][0]; ui._bagTab = t; }
    if (t !== 'equip' && t !== 'treasure') t = 'equip';
    var sk = (t === 'equip') ? 'equip' : 'treasure';          /* 排序按「类」存，不按二级分类 */
    var sort = ui._bagSort[sk] || (BAG_SORT_OPTS[sk] || [['q', '']])[0][0];

    var html = '';
    /* 页签（v89.115：两类 —— 装备 / 宝物） */
    html += '<div class="subtabs" style="margin:0 0 8px;justify-content:center;">' +
      BAG_TABS.map(function (x) {
        return '<span class="sub' + (t === x[0] ? ' active' : '') + '" data-action="bag-tab" data-v="' + x[0] + '">' + x[1] + '</span>';
      }).join('') + '</div>';
    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索）；
       v89.143：进页先归一（删「全部」后，失效值一律落到第一个有货分类）。 */
    if (t === 'treasure') { ui._bagSub = ui.bagSubNorm(ui._bagSub); html += ui.bagSubChipsHTML(); }
    /* v89.117（老板「参考铁匠铺分类，增加更细致的划分」）：装备页三排筛选 */
    if (t === 'equip') html += ui.bagEqChipsHTML();
    /* 排序条 */
    html += '<div class="bag-sortbar"><span class="lb">排序</span>' +
      (BAG_SORT_OPTS[sk] || []).map(function (o) {
        return '<span class="chip' + (sort === o[0] ? ' on' : '') + '" data-action="bag-sort" data-v="' + o[0] + '">' + o[1] + '</span>';
      }).join('') +
      '<span class="bag-total">' + ui.bagSummary(t) + '</span></div>';
    html += '<div class="bag-body">';

    if (t === 'equip') html += ui.bagEquipHTML(sort);
    else html += ui.bagTreasureHTML(sort);

    html += '</div>';
    /* v89.145（老板 2）：背包页改**.bag-page**（满高 flex 列）——
       顶部（标题 / 页签 / 分类条 / 排序条）冻结不动，只有 `.bag-body`（底下细分物品区）
       内部滚动；不再是 .view-box 整页滚。 */
    return '<div class="ui-page bag-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (t === 'treasure' ? '宝物' : '装备') +
        ui.help('悬停格子看属性\n点格子开详情\n' +
          '宝物页顶部的分类条按**商城分类**切分（只列有货的）—— 材料 / 珠宝 / 符类…\n' +
          '装备可穿戴，也可拆解回收材料') +
      '</div>' + html + '</div>';
  };
  ui.openBag = function (tab) {
    /* v89.115：旧值（'mat'/'item'/'bp'）自动迁移到「宝物 + 二级分类」—— 深链与脚本不炸 */
    if (tab) {
      if (BAG_LEGACY_TAB[tab]) {
        ui._bagTab = BAG_LEGACY_TAB[tab][0];
        ui._bagSub = BAG_LEGACY_TAB[tab][1];
      } else {
        ui._bagTab = (tab === 'treasure') ? 'treasure' : 'equip';
      }
    }
    ui.setView('bag');
  };
  /* ============================================================
   * 视图内重绘（v29 · 需求 3/4）
   * ------------------------------------------------------------
   * ⚠ 这类重绘**不经过 ui.renderView**（切页签、换排序、翻页都走这里），
   *   而分页条是 renderView 收尾时才落到底部条的 —— 于是切页签后
   *   正文换了、底部条还挂着上一个页签的页码，点下去就翻错了列表。
   *   统一收敛到这一个函数：先清空本帧的分页收集，再重画正文、刷新底部条。
   * ============================================================ */
  ui.repaintView = function (fn) {
    var box = $('#view-container');
    if (!box) return;
    ui._bottom = [];
    box.innerHTML = fn();
    ui.paintBottom();
  };

  ui.renderBag = function () {
    if (ui.view !== 'bag') return;
    ui.repaintView(function () { return ui.bagHTML(); });
  };

  /* 背包总量摘要（v89.115：按「类 + 二级分类」给） */
  ui.bagSummary = function (t) {
    var s = GAME.state;
    if (t === 'equip') {
      var _all = ui.bagEquipEntries ? ui.bagEquipEntries() : [];
      var _worn = _all.filter(function (e) { return !!e.wornBy; }).length;
      return '装备 ' + _all.length + ' 件（未穿戴 ' + (_all.length - _worn) + ' · 已穿戴 ' + _worn + '）';
    }
    /* v89.143（老板 1）：无「全部」后，摘要 = **当前分类 + 全量兜底**
       （'all' 仍是计数出口 bagSubCountOf 的合法入参，只是不再是一个分类页）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    var nm2 = (sub === 'material') ? '材料'
      : (sub === 'blueprint') ? '图纸'
      : ((ui.BAG_ITEM_CN[sub] || sub) + '').replace(/（.*/, '');
    return nm2 + ' ' + ui.bagSubCountOf(sub) + ' 件（宝物共 ' + ui.bagSubCountOf('all') + ' 件）';
  };
  /* 某一类宝物有多少件（**唯一出口**：分类条角标、摘要、断言共读）。
     材料归 'material'；其余按 ITEMS[].type；'all' = 材料 + 全部宝物（含图纸）。 */
  ui.bagSubCountOf = function (ty) {
    var s = GAME.state || {}, items = s.items || {}, n = 0;
    if (ty === 'all' || ty === 'material') {
      (DATA.MATERIALS || []).forEach(function (m) { n += items[m.id] || 0; });
    }
    if (ty !== 'material' && ty !== 'blueprint') {
      for (var k in items) {
        if (DATA.MATERIAL_BY_ID[k]) continue;
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === k) it = x; });
        if (!it || it.type === 'blueprint') continue;
        if (ty === 'all' || it.type === ty) n += items[k] || 0;
      }
    }
    if (ty === 'all' || ty === 'blueprint') {
      (DATA.BLUEPRINTS || []).forEach(function (b) { n += items[b.id] || 0; });
    }
    return n;
  };
  /* 二级分类条（宝物页顶部）：全部 + 有货的分类（"快速检索拥有的"）；
     分类顺序 = BAG_ITEM_CN 的键序（与商城分类对齐）；材料/图纸各单列。 */
  /* ============================================================
   * v89.143（老板 1）：「背包宝物界面均参考 7 列空间设计，**不要"全部"这个分类**」
   * ------------------------------------------------------------
   * 两件事一起：
   *   ① 物品（宝物）子页改走 `pageBag`（.bag-grid **7 列**）—— 改前它走 `pageRows`
   *      （**4 列**的 .shop-rows），只有材料 / 图纸 / 装备页才是 7 列 —— 这就是
   *      老板看到的"没按 7 列"；统一后四页同一个网格、同一个每页格数（28 = 4×7）。
   *   ② 「全部」分类条整条退役（含"三段并排"的渲染分支）——
   *      归一出口 `bagSubNorm`：任何"老的 / 空的 / 失效的"分类值 → **第一个有货分类**
   *      （材料 → 类型序 → 图纸）；全空时仍给材料页（空态文案最合适）。
   * ============================================================ */
  ui.bagSubFirstOf = function () {
    if (ui.bagSubCountOf('material') > 0) return 'material';
    var hit = null;
    Object.keys(ui.BAG_ITEM_CN).forEach(function (ty) {
      if (!hit && ui.bagSubCountOf(ty) > 0) hit = ty;
    });
    if (hit) return hit;
    if (ui.bagSubCountOf('blueprint') > 0) return 'blueprint';
    return 'material';
  };
  ui.bagSubNorm = function (v) {
    if (!v || v === 'all') return ui.bagSubFirstOf();
    if (v === 'material' || v === 'blueprint') return v;
    if (ui.BAG_ITEM_CN[v]) return v;
    return ui.bagSubFirstOf();
  };
  ui.bagSubChipsHTML = function () {
    var sub = ui.bagSubNorm(ui._bagSub);
    var list = [];
    var mn = ui.bagSubCountOf('material');
    if (mn > 0) list.push(['material', '材料', mn]);
    Object.keys(ui.BAG_ITEM_CN).forEach(function (ty) {
      var n = ui.bagSubCountOf(ty);
      if (n > 0) list.push([ty, (ui.BAG_ITEM_CN[ty] + '').replace(/（.*/, ''), n]);
    });
    var bn = ui.bagSubCountOf('blueprint');
    if (bn > 0) list.push(['blueprint', '图纸', bn]);
    /* v89.147（老板 2）：分类条从**界面左侧**开始（原来 inline-flex 居中）——
       行容器与装备页同款（.bag-filterrow：块级占满 + 左起 + 不换行）→ 两页排序框同位置。 */
    return '<div class="chips chips-xs bag-filterrow">' +
      list.map(function (x) {
        return '<span class="chip' + (sub === x[0] ? ' on' : '') +
          '" data-action="bag-sub" data-v="' + x[0] + '">' + x[1] + ' <i>' + x[2] + '</i></span>';
      }).join('') + '</div>';
  };
  /* 宝物页（按二级分类分派）：material → 材料页 · blueprint → 图纸页 ·
     单一类型 → 宝物页（过滤）· all → 三段并排（材料 / 宝物 / 图纸） */
  ui.bagTreasureHTML = function (sort) {
    /* v89.143（老板 1）：「全部」退役 —— 分类恒为**一个**具体类目（归一出口保证）。 */
    var sub = ui.bagSubNorm(ui._bagSub);
    ui._bagSub = sub;
    if (sub === 'material') return ui.bagMatHTML(sort);
    if (sub === 'blueprint') return ui.bagBpHTML(sort);
    return ui.bagItemHTML(sort, sub);
  };

  /* ============================================================
   * 背包分页（v29 · 需求 4）
   * ------------------------------------------------------------
   * 旧版只有「装备」页有分页，而且分页条**长在内容末尾** —— 一屏装不下，
   * 就得先滚到底才够得着翻页；材料/图纸/宝物三页干脆直接长列表铺到底。
   * 现在四处一起改：
   *   · 四个页签**都分页**，每页 20 格（4 行 × 5 格，正好整行不截断）；
   *   · 分页条统一送到屏幕下方的固定导航条（ui.pagerHTML → #bottom-bar），
   *     内容区永远不必为了翻页而滚动；
   *   · 分页单位是**格子**而不是"分组"，所以一页里可能跨两个分组 ——
   *     pageBag 在拼接时按需补分组标题，不会出现"页首是一排没有归属的裸格子"。
   * ============================================================ */
  /* v89.143（老板 1）：7 列网格下每页必须是**整行** —— 16 = 2 行 + 2 格（末行缺 5 格），
     与"7 列空间设计"不符。改 28 = **4 行 × 7 列**（与商城 4 行同高节奏，铺满一屏）。 */
  ui.BAG_PER_PAGE = 28;
  ui.pageBag = function (key, rows) {
    var cells = rows.filter(function (r) { return r.cell != null; });
    var p = ui.pageOf(key, cells.length, ui.BAG_PER_PAGE);
    var html = '', lastSec = null, open = false;
    for (var i = p.from; i < p.to; i++) {
      var r = cells[i];
      /* 一个分组 = 「标题 + 一个 .bag-grid」；换组时先把上一格网格闭合，
         再开新的一格 —— 分页切在分组中间时，页首同样会有标题跟着。 */
      if (r.sec !== lastSec) {
        if (open) { html += '</div>'; open = false; }
        html += r.secHTML + '<div class="bag-grid">';
        open = true; lastSec = r.sec;
      }
      html += r.cell;
    }
    if (open) html += '</div>';
    ui.pagerHTML(key, cells.length, ui.BAG_PER_PAGE);
    return html || '<div class="q-empty">本页无内容。</div>';
  };
  /* 通用"行分页"（v29）：给物品行（.item-row）用 ——
     pageBag 是给格子（.bag-grid）用的，两者 DOM 结构不同，不能混用。
     分页条同样送到屏幕下方的固定条。 */
  ui.pageRows = function (key, rows, perPage, cls) {
    var per = perPage || 8;
    var p = ui.pageOf(key, rows.length, per);
    var html = rows.slice(p.from, p.to).map(function (r) { return r.cell; }).join('');
    ui.pagerHTML(key, rows.length, per);
    return html ? ('<div class="' + (cls || 'shop-rows') + '">' + html + '</div>')
      : '<div class="q-empty">本页无内容。</div>';
  };

  /* 一组格子（secHTML 为该组标题）→ 行数组 */
  ui.bagRows = function (secHTML, sec, cells) {
    return cells.map(function (c) { return { sec: sec, secHTML: secHTML, cell: c }; });
  };

  /* ---------- 装备页（v79：按**件**列格 —— 同名以 甲/乙/丙 序号 + 强化 +N 区分） ---------- */
  /* ============================================================
   * v89.117（老板「背包的装备中列出所有装备（包括将领穿戴的），如正在穿戴，
   *   显示对应将领名称即可」）—— 装备清单**唯一出口**：
   *     背包件（s.inventory） + **全体将领两套装备位**（equip / lingEquip）。
   * 病根：穿戴时 domain 会把件从 inventory 里 splice 掉（脱下才 push 回来），
   *   所以"已经穿在身上的那一半家当"在背包里根本看不到。
   * 顺序：背包件在前、穿戴件在后（同一件只出现一次 —— 穿戴件不在背包里）。
   * ============================================================ */
  ui.bagEquipEntries = function () {
    var s = GAME.state || {};
    var out = [];
    (s.inventory || []).forEach(function (inst) {
      if (!inst || !DATA.EQUIP[GAME.eqId(inst)]) return;
      out.push({ inst: inst, wornBy: '', from: 'bag' });
    });
    (s.generals || []).forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {
        var bag = g[bk] || {};
        for (var sl in bag) {
          var inst2 = bag[sl];
          if (!inst2 || !DATA.EQUIP[GAME.eqId(inst2)]) continue;
          out.push({ inst: inst2, wornBy: g.name, from: 'worn', genId: g.id, slot: sl });
        }
      });
    });
    return out;
  };
  /* 装备页筛选状态（唯一出口：chips / 渲染 / 断言都读它） */
  ui._bagEq = ui._bagEq || { cls: 'all', set: '', state: 'all', q: 'all' };
  ui.bagEqFiltered = function () {
    var f = ui._bagEq || {};
    return ui.bagEquipEntries().filter(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      if (!it) return false;
      if (f.state === 'worn' && !e.wornBy) return false;
      if (f.state === 'free' && e.wornBy) return false;
      if (f.q !== 'all' && it.q !== Number(f.q)) return false;
      if (f.cls === 'set' && !it.set) return false;
      if (f.cls === 'solo' && it.set) return false;
      if (f.cls === 'set' && f.set && it.set !== f.set) return false;
      return true;
    });
  };
  /* 筛选条（三排：类别 / 状态 / 品质；只在装备页出现） */
  /* ============================================================
   * v89.147（老板 1）：「背包，装备界面，**上边分类栏保持在一行，位于界面左侧**，
   *   状态，品质，散件，全部这 4 个作为**主类**，依次往右排列」
   * ------------------------------------------------------------
   * 原来 = **两排居中**（row1 类别 / row2「状态」+「品质」标签+选项）——
   * 现在合并为**一行 4 组、左侧起**：
   *   ① 状态（全部 / 未穿戴 / 已穿戴）
   *   ② 品质（全部 / Q1…，按持有情况列）
   *   ③ 散件（全部 / 套装 / 散件 + 选中「套装」时追加套名细化）
   *   ④ 全部（一键把三个维度还原 —— 激活态 = 当前即"全默认"）
   * 行容器 `.chips.bag-filterrow`（块级占满 + 左起 + 不换行）——与宝物页同款，
   *   两页行高一致（排序框同位置）。
   * ============================================================ */
  ui.bagEqChipsHTML = function () {
    var f = ui._bagEq || {};
    var all = ui.bagEquipEntries();
    var setsIn = [];
    all.forEach(function (e) {
      var sid = (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set;
      if (sid && setsIn.indexOf(sid) < 0) setsIn.push(sid);
    });
    function chip(k, v, label, n, on) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="bag-eq-f" data-k="' + k +
        '" data-v="' + v + '">' + label + ' <i>' + n + '</i></span>';
    }
    var cnt = function (pred) { return all.filter(pred).length; };
    var qsIn = [1, 2, 3, 4].filter(function (q) {
      return all.some(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; });
    });
    /* 第 4 主类「全部」的激活态 = 三个维度都处于"全部"（即当前显示的就是全部装备） */
    var isAll = (f.state === 'all' || !f.state) && (f.q === 'all' || f.q == null)
      && (f.cls === 'all' || !f.cls);
    return '<div class="chips chips-xs bag-filterrow">' +
      '<span class="lb">状态</span>' +
      chip('state', 'all', '全部', all.length, f.state === 'all' || !f.state) +
      chip('state', 'free', '未穿戴', cnt(function (e) { return !e.wornBy; }), f.state === 'free') +
      chip('state', 'worn', '已穿戴', cnt(function (e) { return !!e.wornBy; }), f.state === 'worn') +
      '<span class="lb">品质</span>' +
      chip('q', 'all', '全部', all.length, f.q === 'all' || f.q == null) +
      qsIn.map(function (q) {
        return chip('q', q, DATA.Q_NAME[q] || ('Q' + q),
          cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; }), Number(f.q) === q);
      }).join('') +
      '<span class="lb">散件</span>' +
      chip('cls', 'all', '全部', all.length, f.cls === 'all' || !f.cls) +
      chip('cls', 'set', '套装', cnt(function (e) { return !!(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'set') +
      chip('cls', 'solo', '散件', cnt(function (e) { return !(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'solo') +
      (f.cls === 'set' && setsIn.length
        ? setsIn.map(function (sid) {
            return chip('set', sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
              cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set === sid; }), f.set === sid);
          }).join('') : '') +
      chip('reset', 'all', '全部', all.length, isAll) +
      '</div>';
  };
  ui.setBagEqFilter = function (k, v) {
    ui._bagEq = ui._bagEq || {};
    /* v89.147（老板 1）：第 4 主类「全部」= 一键把三个维度还原（state/q/cls → all）。
       v89.147 前这里不接受 'reset'（会把它当普通键存进 _bagEq）—— 现在显式分支。 */
    if (k === 'reset') {
      ui._bagEq = { cls: 'all', set: '', state: 'all', q: 'all' };
    } else if (k === 'q') {
      ui._bagEq.q = (v === 'all') ? 'all' : Number(v);
    } else {
      ui._bagEq[k] = v;
    }
    if (k === 'cls' && v !== 'set') ui._bagEq.set = '';
    ui._pages['bag-equip'] = 1;                  /* 换筛选回第一页（分页键 = bag-equip） */
    ui.renderBag();
  };

  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var entries = ui.bagEqFiltered();
    if (!entries.length) {
      var anyEq = ui.bagEquipEntries().length;
      return '<div class="q-empty">' + (anyEq
        ? '当前筛选下没有装备 —— 换一档筛选试试（类别 / 状态 / 品质）。'
        : '尚无装备。点城内「铁匠铺」打造，或攻占城池缴获。') + '</div>';
    }
    var inv = entries;
    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(e);
    });
    var keys = Object.keys(groups);
    if (sort === 'slot') {
      keys.sort(function (a, b) { return EQUIP_SLOT_ORDER.indexOf(a) - EQUIP_SLOT_ORDER.indexOf(b); });
    } else if (sort === 'set') {
      keys.sort(function (a, b) { return (a === 'solo' ? 1 : 0) - (b === 'solo' ? 1 : 0); });
    }
    var rows = [];
    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) {
        return ui.bagCmp('equip', sort, GAME.eqId(x.inst), GAME.eqId(y.inst))
          || (GAME.eqEnhOf(y.inst) - GAME.eqEnhOf(x.inst));
      });
      var title, sub;
      if (k.indexOf('set:') === 0) {
        var sn = DATA.SETS[k.slice(4)];
        title = (sn ? sn.name : k.slice(4)) + ' 套件';
        sub = arr.length + ' 件';
      } else if (k === 'solo') {
        title = '散件（无套装）'; sub = arr.length + ' 件';
      } else {
        title = (DATA.EQUIP_SLOT_NAMES[k] || k); sub = arr.length + ' 件';
      }
      var cells = arr.map(function (e) {
        var inst = e.inst;
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          /* v89.116：`DATA.EQUIP_SLOT_ICON` 不存在 —— 旧兜底一旦被走到就是**抛错**；
             真出口 `icons.forEquip` 恒在（icons.js），缺了也只是空图标、不炸。 */
          cls: 'q' + it.q, ico: (GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : ''),
          name: GAME.eqLabel(inst),
          q: it.q,
          /* v89.117：穿戴角标改**将领全名**（原只显示首字，张飞/张辽分不出） */
          worn: e.wornBy || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : '') + (e.wornBy ? ' · ' + e.wornBy + ' 着' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)) + (e.wornBy ? '　·　穿戴：' + e.wornBy : ''),
          attr: GAME.equipDesc(it),
          /* 穿戴件点击 = 开详情（卸下/强化/分解都在那里）；背包件保持"一键穿上"。
             —— 已穿在身上的再"穿上"没有意义，详情才是要去的下一级。 */
          act: e.wornBy ? 'bag-detail' : 'open-bag-equip', key: (u != null ? u : id),
        });
      });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + title + ' <span class="n">' + sub + '</span></div>', k, cells));
    });
    return ui.pageBag('bag-equip', rows);
  };

  /* ---------- 材料页 ---------- */
  ui.bagMatHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    if (sort === 'have') {
      var owned2 = DATA.MATERIALS.filter(function (m) { return items[m.id] > 0; })
        .sort(function (a, b) { return (items[b.id] || 0) - (items[a.id] || 0); });
      if (!owned2.length) return '<div class="q-empty">尚无材料。攻打野地可按地形采集，攻占城池亦可缴获。</div>';
      return ui.pageBag('bag-mat', ui.bagRows(
        '<div class="bag-sec">按持有量排序 <span class="n">' + owned2.length + ' 种</span></div>', 'have',
        owned2.map(function (m) { return ui.matCell(m, items[m.id], false, sort); })));
    }
    var rows = [];
    (DATA.MAT_SERIES || []).forEach(function (ser) {
      var arr = DATA.MATERIALS.filter(function (m) { return m.series === ser.id; });
      arr.sort(function (a, b) { return sort === 'tier' ? b.tier - a.tier : a.tier - b.tier; });
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec" style="color:' + ser.tone + ';">' + ser.name +
        ' <span class="n">' + ser.use + ' · 持有 ' + arr.filter(function (m) { return items[m.id] > 0; }).length + '/' + arr.length + '</span></div>',
        ser.id, arr.map(function (m) { return ui.matCell(m, items[m.id] || 0, false, sort); })));
    });
    return ui.pageBag('bag-mat', rows);
  };

  /* ---------- 图纸页 ---------- */
  ui.bagBpHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    var arr = (DATA.BLUEPRINTS || []).filter(function (b) { return items[b.id] > 0; });
    arr.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    if (!arr.length) {
      return '<div class="q-empty">尚无装备图纸。<br>来源：商城购买 · 攻占名城缴获（郡城 18% / 州城 40% / 都城 80%）· 奇遇古冢</div>';
    }
    return ui.pageBag('bag-bp', ui.bagRows(
      '<div class="bag-sec">装备图纸 <span class="n">凭图纸可于铁匠铺打造对应套装</span></div>', 'bp',
      arr.map(function (b) {
        var q = b.forgeLv >= 7 ? 4 : b.forgeLv >= 5 ? 3 : 2;
        return ui.bagCell({
          cls: 'q' + q,
          ico: GAME.icons.forItem ? GAME.icons.forItem('blueprint', b.id) : '📜',
          name: b.name, cnt: items[b.id], q: q, noStar: true,
          title: b.name, lore: '需铁匠铺 Lv' + b.forgeLv + ' · 持有 ' + items[b.id],
          attr: b.desc, act: 'open-bp-detail', key: b.id,
        });
      })));
  };

  /* ---------- 宝物页 ---------- */
  /* ---------- 宝物页（v29 · 需求 14 改版式） ----------
     与商城同一套「物品行」：左贴图 / 右介绍 / 下方 数量输入框 + 使用按钮。
     数量以**本行输入框**为准（不再是全局的一个"使用数量"档位）。 */
  /* 背包宝物页的类型分组表（v89.51：提为**出口常量**，门禁可直接断言闭环）
     —— 凡是「能在背包里用」的类型必须在此有分组；material / blueprint 走专属页签。
     改前缺 chest / neigong / corvee / talis / build_cost 五类：宝箱、秘籍、政令、
     锦囊、营造物**买得到、看得见单价，却在背包里根本不显示** ——
     老板点的「买了用不了」正是这里。 */
  /* ============================================================
   * v89.104（老板）：「背包里的宝物界面不要设置将领清单，点击使用的时候，
   * 如果是直接消耗的无对象物品，直接使用并生效即可；有使用对象的物品，做好提示，
   * 比如『请在XX界面使用』『请对将领使用』『请在什么建筑中使用』等等，
   * 匹配其使用界面或场景」
   * ------------------------------------------------------------
   * `ITEM_USE_ROUTE` 是**唯一出口**：type → 去处。
   *   · direct: true      = 无对象，就地使用（systems.useItem 里不需要将领的那些分支）
   *   · hint/btn/view     = 有对象或场景：按钮改成"去往该界面"，背包里不再选人
   * 依据：systems.useItem 里**调用 _findGen 的分支**才需要将领
   *   （jewel / attr_buff / exp / stamina / perm / rank_up / mount_buff / neigong）。
   * ⚠️ 新增道具类型必须在这张表里登记 —— smoke 有一条"路由表覆盖全部 type"的门禁。
   * ============================================================ */
  ui.ITEM_USE_ROUTE = {
    /* 无对象：就地生效 */
    prod_buff: { direct: true },
    build_cost: { direct: true },
    military_buff: { direct: true },
    boost: { direct: true },
    corvee: { direct: true },
    chest: { direct: true },
    pop_boost: { direct: true },
    pop_fill: { direct: true },
    /* 有对象：去将领面板（背包不选人） */
    jewel: { hint: '赏赐忠诚：请对将领使用', view: 'generals', btn: '去将领面板' },
    attr_buff: { hint: '符类加属性：请对将领使用', view: 'generals', btn: '去将领面板' },
    exp: { hint: '加经验：请对将领使用', view: 'generals', btn: '去将领面板' },
    stamina: { hint: '恢复体力：请对将领使用', view: 'generals', btn: '去将领面板' },
    energy: { hint: '恢复精力：请对将领使用', view: 'generals', btn: '去将领面板' },
    perm: { hint: '永久丹药：请对将领使用', view: 'generals', btn: '去将领面板' },
    mount_buff: { hint: '坐骑道具：请对将领使用', view: 'generals', btn: '去将领面板' },
    neigong: { hint: '秘籍传授：请对将领使用', view: 'generals', btn: '去将领面板' },
    rank_up: { hint: '提升资质：请对将领使用', view: 'generals', btn: '去将领面板' },
    /* 有场景：去对应玩法界面 */
    seed: { hint: '请到种田秘境播种', act: 'open-farm', btn: '去播种' },
    essence: { hint: '请到蕴养界面使用', act: 'ling-temper-open', btn: '去蕴养' },
    talis: { hint: '锦囊在出征时随计略消耗，无需手动使用', view: 'city', btn: '去城池' },
  };
  /* 某件道具的"去处"（未知类型一律当"无对象"处理 —— 宁可给个使用按钮，
     也不要让它变成一件看得见、点不动的死物） */
  ui.itemRouteOf = function (it) {
    var R = ui.ITEM_USE_ROUTE[it && it.type];
    return R || { direct: true };
  };
  /* v89.115（老板「宝物参考商城的分类进行划分」）：本表即**宝物二级分类名**，
     与商城分类（ui.SHOP_CATS）对齐 —— 商城的每个页签在这里都有对应一类
     （material / blueprint 走专属渲染，另有 rank_up / essence / pop_fill 三类是背包专有：
     商城不售、只能征战/秘境所得）。**新增可上架类型时两处都要有**。 */
  ui.BAG_ITEM_CN = {
    jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',
    boost: '加速', exp: '经验', stamina: '体力', perm: '永久丹药', mount_buff: '坐骑',
    /* v89.131：精力族（清心丸等）单独一组 —— 与将领页的「体力 / 精力」两行同名对应 */
    energy: '精力',
    rank_up: '灵草（提升资质）',
    seed: '种子（种田秘境）',
    essence: '精华（蕴养修炼装备）',
    chest: '宝箱', neigong: '秘籍', corvee: '政令', talis: '锦囊', build_cost: '营造',
    /* v89.99（老板「增加道具如增民令」）：民生 —— 人口增速道具；
       v89.104：移民令（一次性人口注入）同属民生族 */
    pop_boost: '民生（人口增速）',
    pop_fill: '民生（移民令）',
  };
  ui.bagItemHTML = function (sort, onlyType) {
    var s = GAME.state, items = s.items || {};
    var CN = ui.BAG_ITEM_CN;
    var groups = {};
    Object.keys(items).forEach(function (id) {
      if ((items[id] || 0) <= 0) return;
      if (DATA.MATERIAL_BY_ID[id]) return;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type === 'blueprint') return;
      if (onlyType && it.type !== onlyType) return;      /* v89.115：二级分类过滤 */
      (groups[it.type] = groups[it.type] || []).push(it);
    });
    var order = Object.keys(CN);
    if (sort === 'val') order.sort(function (a, b) {
      var va = Math.max.apply(null, (groups[a] || [{ price: 0 }]).map(function (x) { return x.price || 0; }));
      var vb = Math.max.apply(null, (groups[b] || [{ price: 0 }]).map(function (x) { return x.price || 0; }));
      return vb - va;
    });
    var rows = [], any = false;
    order.forEach(function (tp) {
      var arr = groups[tp];
      if (!arr || !arr.length) return;
      any = true;
      if (sort === 'val') arr = arr.slice().sort(function (a, b) { return (b.price || 0) - (a.price || 0); });

      /* v89.155（老板 4）：默认（按类型）排序 = 内置标号（同功能相邻 · 由小到大） */
      else arr = arr.slice().sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });
      var segCells = [];
      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var tplName = (CN[tp] || tp).replace(/（.*/, '');
        /* v89.140（老板 7）：「背包中的宝物也是，**建立统一的物品框和规格样式**，
           按每行可为 **7 个物品**并列的宽度设计。物品介绍**悬停显示**」——
           行卡片（.item-row + 数量框 + 按钮）整体退役，改与材料页同一个 `ui.bagCell`
           （统一物品框：图标 + 名称 + 数量角标 + 悬停介绍；容量条见 CSS `.bag-grid` 7 列）。
           动作按 ITEM_USE_ROUTE 分流（就地使用 / 指路），不另立规则：
             direct → 点击就地使用 1 个；route.act → 该动作；否则 → 跳到对应视图。 */
        var route = ui.itemRouteOf(it);
        var cell = {
          cls: 'q' + (((it.price || 0) >= 60) ? 4 : ((it.price || 0) >= 26) ? 3 : ((it.price || 0) >= 10) ? 2 : 1),
          ico: (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') || '💎',
          name: it.name, cnt: have,
          q: 1, noStar: true,
          title: it.name + '（' + tplName + '）',
          lore: '持有 ' + U.numText(have, 0) + (it.price ? '　估值 ' + U.fmt(it.price * 100) + ' 金' : ''),
          attr: (GAME.itemEffect(it) || '') +
            (route.direct ? '　（点击使用 1 个 · 右键批量）' : ('　↳ ' + (route.hint || '需在对应界面使用'))),
          key: it.id,
        };
        if (route.direct) { cell.act = 'use-bag-item'; cell.bulk = 1; }   /* v89.141：右键 = 批量小窗 */
        else if (route.act) { cell.act = route.act; }
        else { cell.act = 'bag-go'; cell.view = route.view; }
        segCells.push(ui.bagCell(cell));
      });
      /* v89.143：每个类型**一段**（标题 + .bag-grid 7 列）—— 与材料 / 图纸页同构 */
      rows = rows.concat(ui.bagRows(
        '<div class="bag-sec">' + U.escape((CN[tp] || tp).replace(/（.*/, '')) +
        ' <span class="n">' + segCells.length + ' 种</span></div>', tp, segCells));
    });
    if (!any) return '<div class="q-empty">此类暂无宝物 —— 换一个分类看看。</div>';
    /* v89.104（老板）：「背包里的宝物界面**不要设置将领清单**」——
       原来那排"使用对象"将领 chips 整段撤除：需要对象的道具在背包里**不给使用按钮**，
       改给"去将领面板"的指路（见 ITEM_USE_ROUTE）；无对象道具就地使用。
       于是背包页不再替玩家挑人，也不会再把道具静默发给第一位将领。 */
    ui._itemGen = ui._itemGen || (s.generals[0] ? s.generals[0].id : '');
    /* v89.143（老板 1）：改走 `pageBag`（.bag-grid **7 列**，每页 28 = 4×7）——
       改前走 `pageRows`（4 列的 .shop-rows），是"宝物页不是 7 列"的病根所在。
       分页 key 带二级分类（换分类回第 1 页，不会停在越界页码上）。 */
    return ui.pageBag('bag-item-' + (onlyType || ui.bagSubNorm(ui._bagSub)), rows);
  };

  /* v89.141（老板 0 · 按建议执行）：「宝物整叠使用」——
     单击仍 = 使用 1 个（v89.140 既定交互不变）；**右键**（contextmenu，见 main.js 委托）
     打开本窗 → 一次用 N 个（「最多」= 全部用完）。
     出口复用 GAME.doBagUse：≥2 走 useItemMany（与旧"数量框"时代同一出口，不另立规则）。 */
  ui.openBulkUse = function (itemId) {
    var s = GAME.state, have = (s.items || {})[itemId] || 0;
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it) { ui.toast('无此物品'); return; }
    if (have <= 0) { ui.toast('数量为 0，无法使用'); return; }
    var route = ui.itemRouteOf(it);
    if (!route.direct) { ui.toast(route.hint || '该物品需在对应界面使用'); return; }
    ui.openShell({
      title: '批量使用 · ' + U.escape(it.name),
      sub: '持有 ×' + have + '　（单击 = 用 1 个 · 右键 = 本窗）',
      size: 'sm',
      body: '<div class="attr"><span class="k">效果</span><span class="v good">' +
          U.escape(GAME.itemEffect(it) || '—') + '</span></div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('bulk-q', 1, 0, have) +
          '<span class="op-hint">用几个就生效几次（「最多」= 全部用完）</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="bulk-use-do" data-key="' + itemId + '">使用</button>' +
        '</div>',
    });
  };

  ui.matCell = function (m, have, dim, sort) {
    return ui.bagCell({
      cls: 'q' + m.tier + (have > 0 ? '' : ' dim'),
      ico: GAME.icons.forMat ? GAME.icons.forMat(m.id) : '🪨',
      name: m.name, cnt: have > 0 ? have : '',
      q: m.tier, noStar: true,
      title: m.name + '（' + m.seriesName + ' · 第' + m.tier + '品）',
      lore: have > 0 ? ('持有 ' + have + '　单价 ' + U.fmt(m.price * 100) + '金') : '尚未获得',
      attr: m.desc + '　' + ui.matUseText(m),
      act: 'open-mat-detail', key: m.id,
    });
  };

  ui.matUseText = function (m) {
    var slots = [];
    for (var sl in DATA.FORGE.matBySlot) {
      if (DATA.FORGE.matBySlot[sl].indexOf(m.series) >= 0) slots.push(DATA.EQUIP_SLOT_NAMES[sl] || sl);
    }
    return slots.length ? ('用于：' + slots.join('、')) : '';
  };

  /* ---------- 排序比较器 ---------- */
  ui.bagCmp = function (tab, sort, x, y) {
    if (tab === 'equip') {
      var A = DATA.EQUIP[x], B = DATA.EQUIP[y];
      if (sort === 'q') return (B.q - A.q) || (GAME.itemValue(y) - GAME.itemValue(x));
      if (sort === 'val') return GAME.itemValue(y) - GAME.itemValue(x);
      if (sort === 'set') return (A.set ? 0 : 1) - (B.set ? 0 : 1) || (B.q - A.q);
      if (sort === 'slot') return EQUIP_SLOT_ORDER.indexOf(A.slot) - EQUIP_SLOT_ORDER.indexOf(B.slot) || (B.q - A.q);
    }
    return 0;
  };

  /* 背包格子（含悬停浮层）。o.noStar 时不显示品质星（材料/宝物用色阶表示） */
  ui.bagCell = function (o) {
    /* v89.140：补 `data-view`（"指路类"用品的格子 → bag-go 需要目标视图） */
    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' + (o.view ? ' data-view="' + o.view + '"' : '') : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '') + (o.bulk ? ' data-bulk="1"' : '');
    return '<div class="bag-cell ' + (o.cls || '') + '"' + actAttr + ' data-tip-el="1">' +
      (!o.noStar && o.q ? '<span class="bag-q">' + '★'.repeat(Math.min(4, o.q)) + '</span>' : '') +
      (o.cnt ? '<span class="bag-cnt">×' + o.cnt + '</span>' : '') +
      (o.worn ? '<span class="bag-worn" title="' + U.escape(o.worn) + ' 着">' + U.escape(o.worn) + '</span>' : '') +
      '<span class="bag-ico">' + o.ico + '</span>' +
      '<span class="bag-name">' + U.escape(o.name) + '</span>' +
      '<div class="bag-tip"><div class="tip-t">' + U.escape(o.title) + '</div>' +
        '<div class="tip-l">' + U.escape(o.lore || '') + '</div>' +
        (o.attr ? '<div class="tip-a">' + U.escape(o.attr) + '</div>' : '') + '</div>' +
      '</div>';
  };

  /* 装备详情（点背包格子）—— v79：**单件视角**。
     ref 可以是 件号（实例）/ 装备 id（旧入口兼容，取第一件）。 */
  ui.openEquipDetail = function (ref) {
    var inst = GAME.eqFind(ref);
    var itemId = inst ? GAME.eqId(inst) : ref;
    var it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var lv = GAME.eqEnhOf(inst), sn = inst ? GAME.eqSerial(inst) : '';
    var label = it.name + (lv ? ' +' + lv : '') + (sn ? '·' + sn : '');
    var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : null;
    var html = '<div class="gold-heading">' + U.escape(label) + (setNm ? ' · ' + setNm : '') + '</div>';
    html += '<div class="attr"><span class="k">部位</span><span class="v">' + (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + '</span></div>';
    html += '<div class="attr"><span class="k">品质</span><span class="v">' + (DATA.Q_NAME[it.q] || "") + ' ' + '★'.repeat(it.q) + '</span></div>';
    /* v79：百炼等级**按件** —— 这一件自己升到几级就显示几级 */
    if (lv) {
      html += '<div class="attr"><span class="k">百炼</span><span class="v good">+' + lv +
        '（装备属性 +' + Math.round(lv * ((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%，仅此件）</span></div>';
    }
    html += '<div class="attr"><span class="k">属性</span><span class="v good">' + GAME.equipDesc(it) + '</span></div>';
    if (setNm) {
      var sd = DATA.SETS[it.set];
      var lines = [];
      for (var k in sd.bonus) lines.push(k + ' 件：' + sd.bonus[k]);
      html += '<div class="note">套装加成（穿齐件数生效）<br>' + lines.join('<br>') + '</div>';
    }
    html += '<div class="attr"><span class="k">估值</span><span class="v">' + U.fmt(GAME.itemValue(itemId)) + ' 金</span></div>';
    var s = GAME.state, inv = s.inventory || [];
    var group = GAME.eqGroupOf(itemId);
    var inInv = inst ? (inv.indexOf(inst) >= 0) : false;
    var wornBy = null;
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都查 */
        for (var sl in (g[bk] || {})) {
          var v = g[bk][sl];
          var hit = inst ? (v === inst) : (GAME.eqId(v) === itemId);
          if (hit) wornBy = wornBy || g.name;
        }
      });
    });
    var gIdx = '';
    if (sn && group.length > 1) {
      var gi = -1;
      for (var q = 0; q < group.length; q++) if (GAME.eqUidOf(group[q]) === GAME.eqUidOf(inst)) { gi = q + 1; break; }
      gIdx = '（同种第 ' + gi + ' / ' + group.length + ' 件）';
    }
    html += '<div class="attr"><span class="k">持有</span><span class="v">' + group.length + ' 件' + gIdx +
      (wornBy ? '（' + U.escape(wornBy) + ' 已穿）' : '') + '</span></div>';
    /* v78（老板需求 3）：「装备不要『穿给谁』这种」—— 名单式穿戴整块撤除；
       穿戴统一在**将领侧**完成：将领档案点部位换装（openEqSlot），或「装备」页选将后点装备。 */
    html += '<div class="note" style="margin-top:8px;">穿戴：到「将领」面板点对应部位换装（或「装备」页选将后点装备）。</div>';
    if (inInv) {
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;
      var mats = GAME.forgeMaterials(itemId), mtx = [];
      for (var mk in mats) {
        mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
          + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
      }
      html += '<div class="note" style="margin-top:12px;">拆解可回收 40% 打造材料：' + mtx.join('、') + '</div>';
      html += '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn sm gold" data-action="open-enhance" style="margin-right:6px;">⚒ 前往铁匠铺强化</button>' +
        /* v89.110：拆解 = 销毁该件（不可逆）—— 改走二次确认（ui.openSalvageConfirm）。 */
        '<button class="btn red" data-action="salvage-equip-ask" data-key="' + key + '">拆解回收</button></div>';
    } else if (inst) {
      html += '<div class="note">此件正穿在 ' + U.escape(wornBy || '将领') + ' 身上。可在「将领」面板卸下（强化等级随件保留）。</div>';
    } else {
      html += '<div class="note">尚未拥有此装备（先打造或缴获）。</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料详情 */
  ui.openMatDetail = function (mid) {
    var m = DATA.MATERIAL_BY_ID[mid];
    if (!m) { ui.toast('无此材料'); return; }
    var have = (GAME.state.items || {})[mid] || 0;
    var html = '<div class="gold-heading">' + GAME.icons.forMat(mid) + ' ' + m.name + '</div>';
    html += '<div class="attr"><span class="k">系列</span><span class="v" style="color:' + (DATA.MAT_SERIES_BY_ID[m.series] || {}).tone + ';">'
      + m.seriesName + ' 第' + m.tier + ' 品</span></div>';
    html += '<div class="attr"><span class="k">持有</span><span class="v good">' + have + '</span></div>';
    html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(m.price * 100) + ' 金 / 个</span></div>';
    html += '<div class="note">' + U.escape(m.desc) + '</div>';
    var slots = [];
    for (var sl in DATA.FORGE.matBySlot) {
      if (DATA.FORGE.matBySlot[sl].indexOf(m.series) >= 0) slots.push(DATA.EQUIP_SLOT_NAMES[sl] || sl);
    }
    html += '<div class="note">用于打造：' + (slots.join('、') || '—') + '<br>用量：'
      + ['1', '2', '3', '4'].map(function (q) {
        return DATA.Q_NAME[q] + ' ' + (DATA.FORGE.qtyByQ[q][DATA.FORGE.matBySlot.weapon.indexOf(m.series)] || DATA.FORGE.qtyByQ[q][0]);
      }).join(' · ') + '（视部位而定）</div>';
    html += '<div class="note">来源：' + ui.matSourceText(m) + '</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 材料来源文案 */
  ui.matSourceText = function (m) {
    var out = [];
    for (var t in DATA.WILD_MATERIAL) {
      if (DATA.WILD_MATERIAL[t][m.id]) out.push((DATA.TERRAIN[t] ? DATA.TERRAIN[t].name : t) + '野地');
    }
    var cityName = { fort: '野外城池', county: '县城', jun: '郡城', zhou: '州城', capital: '都城' };
    for (var ct in DATA.CITY_MATERIAL) {
      if (DATA.CITY_MATERIAL[ct][m.id]) out.push(cityName[ct] || ct);
    }
    /* v14 州特产：占该州城池可获持续岁贡（高阶材料的主要长期来源） */
    var spStates = [];
    for (var st in DATA.STATE_SPECIALTY) {
      if (DATA.STATE_SPECIALTY[st].mat === m.id) spStates.push(st);
    }
    if (spStates.length) out.push(spStates.join('/') + '岁贡');
    return out.length ? out.join(' · ') : '商城购买';
  };

  /* 该材料的州特产归属（打造面板用：告诉玩家缺料去哪儿打） */
  ui.matSpecialtyStates = function (matId) {
    var out = [];
    for (var st in (DATA.STATE_SPECIALTY || {})) {
      if (DATA.STATE_SPECIALTY[st].mat === matId) out.push(st);
    }
    return out;
  };
  /* v89.89（A4）：材料产地跳转目标 —— 已据该州 → 自己的城；未据 → 州治（NPC 州城）。
     州城被占后不在 NPC 列表里，但从自己的城（同州）找得到。返回 null = 无产地记录。 */
  ui.matGoTargetOf = function (matId) {
    var states = ui.matSpecialtyStates(matId);
    if (!states.length) return null;
    var st0 = states[0];
    var mine = (GAME.state.cities || []);
    for (var j = 0; j < mine.length; j++) {
      if (mine[j].state === st0) {
        return { x: mine[j].x, y: mine[j].y, name: mine[j].name, state: st0, owned: true };
      }
    }
    /* 州治 = 州城（zhou）或都城（capital —— 司隶的州治是洛阳）；
       两者都不在（已被占 / 无记录）→ 退到该州任何 NPC 城（郡 / 县）。 */
    var list = ((GAME.state.map || {}).cities || []).filter(function (x) { return x.state === st0; });
    if (!list.length) return null;
    var rank = { zhou: 0, capital: 1, jun: 2, county: 3 };
    list.sort(function (a, b) {
      return (rank[a.type] == null ? 9 : rank[a.type]) - (rank[b.type] == null ? 9 : rank[b.type]);
    });
    var best = list[0];
    return { x: best.x, y: best.y, name: best.name, state: st0, owned: false };
  };

  /* 图纸详情 */
  ui.openBpDetail = function (bid) {
    var b = null;
    (DATA.BLUEPRINTS || []).forEach(function (x) { if (x.id === bid) b = x; });
    if (!b) { ui.toast('无此图纸'); return; }
    var have = (GAME.state.items || {})[bid] || 0;
    var html = '<div class="gold-heading">📜 ' + b.name + '</div>';
    html += '<div class="attr"><span class="k">持有</span><span class="v good">' + have + '</span></div>';
    html += '<div class="attr"><span class="k">用途</span><span class="v">解锁该套装的打造资格</span></div>';
    html += '<div class="note">' + U.escape(b.desc || '') + '</div>';
    html += '<div class="note">来源：商城购买 · 攻占名城缴获（郡城 18% / 州城 40% / 都城 80%）· 奇遇古冢<br>打造套装件<b>每件消耗图纸 1 张</b>（商城可购，亦可持续缴获）。</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 宝物详情 */
  ui.openItemDetail = function (itemId) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it) { ui.toast('无此宝物'); return; }
    var html = '<div class="gold-heading">' + GAME.itemIcon(it) + ' ' + it.name + '</div>';
    html += '<div class="attr"><span class="k">类别</span><span class="v">' + (it.type || '') + '</span></div>';
    if (it.type === 'seed') {
      /* v89.87（老板拍板 · 需求 1）：种子开售（配合"快购全覆盖"）——
         v78 的"不售"已按最新拍板解除；来源标注保留 */
      html += '<div class="attr"><span class="k">来源</span><span class="v good">采集归来 · 出征缴获 · 商城可购</span></div>';
      if (it.price) html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(it.price * 100) + ' 金</span></div>';
    } else if (it.price) {
      html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(it.price * 100) + ' 金</span></div>';
    }
    html += '<div class="note">' + U.escape(GAME.itemEffect(it) || '无特别效果') + '</div>';
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* 宝物图标（按类型） */
  GAME.itemIcon = function (it) {
    var m = {
      jewel: { zhenzhu: '🫧', shanhu: '🪸', liuli: '🔮', hupo: '🟠', manao: '🔴', shuijing: '💎', feicui: '🟢', yushi: '⚪', yemingzhu: '🌟' },
      blueprint: '📜', prod_buff: '🌾', military_buff: '🎖️', boost: '⚡',
      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',
      rank_up: '🌿',
      /* v89.51：补六类此前落 💠 兜底的（宝箱/秘籍/政令/锦囊/灵气精华/营造） */
      chest: '📦', neigong: '📕', corvee: '📋', talis: '🎴', essence: '✨', build_cost: '📐',
      /* v78：种子按品种给图标（与作物同款，一眼对上） */
      seed: { seed_fan: '🌾', seed_yunling: '🌱', seed_xisui: '🍄', seed_hualong: '🪷', seed_tianshou: '🍑' },
    };
    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';
    if (it.type === 'seed') return (m.seed && m.seed[it.id]) || '🌰';
    return (m[it.type] && typeof m[it.type] === 'string') ? m[it.type] : '💠';
  };
  /* 宝物效果文案 —— **唯一出口**（物品行、悬停浮层、详情弹窗都读它）
     ⚠️ v51 修重复（老板：「物品备注信息是重复了的」）：
       改前这里会拼三段 `赏赐忠诚 +N` ＋ `it.desc` ＋ `商城价 N金`，
       而调用点又自己拼了一遍 `it.desc` —— 于是同一段说明在卡片里出现**三遍**：
         「赏赐忠诚 +5（爵位晋升亦需）」
         「赏赐忠诚 +5　赏赐忠诚 +5（爵位晋升亦需）　商城价 200金」
       根因是**同一个概念有两个出口**（数据里的 desc 与这里重新拼的文案）。
       现在收敛：效果文案 = `it.desc`（数据里已写全，含数值与时长），
       价格由 meta 显示（商城「单价」/ 背包「估值」），忠诚数值也在 desc 里，一律不再重复。 */
  GAME.itemEffect = function (it) {
    if (!it) return '';
    return it.desc || '';
  };

  /* 君主信息弹窗（原版「君主」按钮） */
    ui.openLordInfo = function () {
    var s = GAME.state;
    var totalPop = GAME.totalPopCap();   /* v60：全境人口上限（唯一出口） */
    var popNow = GAME.totalPop();
    var heroCount = s.generals.filter(function (g) { return g.hero; }).length;
    var cur = GAME.systems.rankInfo(s.rank);
    var next = GAME.systems.nextRank();
    var chk = next ? GAME.systems.canPromote() : null;
    var curCity = GAME.currentCity() || {};
    /* 晋升条件整句（悬停用）——「现有 / 所需」都带上，鼠标一放一目了然 */
    var condTitle = '已登顶「裂土封王」';
    if (next) {
      var jewParts = Object.keys(next.jewel || {}).map(function (j) {
        var it = null;
        (DATA.ITEMS || []).forEach(function (x) { if (x.id === j) it = x; });
        return (it ? it.name : j) + ' ' + ((s.items && s.items[j]) || 0) + '/' + next.jewel[j];
      });
      condTitle = '晋升「' + next.name + '」条件：声望 ' + U.fmt(s.rep) + '/' + U.fmt(next.rep)
        + '　城池 ' + s.cities.length + '/' + next.city
        + '　黄金 ' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold)
        + (jewParts.length ? '　珠宝 ' + jewParts.join('、') : '')
        + (chk && !chk.ok ? '（' + chk.msg + '）' : '（条件已满足）');
    }
    var lg = GAME.lordGeneralOf();
    var salaryTotal = GAME.genSalaryTotal ? GAME.genSalaryTotal() : 0;
    /* v77（老板）：「君主界面分左右两半：左边城池列表（加进入按钮），右边两列信息表
       （姓名+改名 / 爵位+晋升（悬停见条件）/ 声望 / 人口总和 / 将领总和 / 状态）」。
       旧版（单列 + chips + 城池表 + rankBlock）整段退役；爵位区块并入右表。 */
    ui.openShell({
      title: '👤 君主',
      sub: (cur ? cur.name : '平民') + ' · 声望 ' + U.fmt(s.rep) + ' · ' + s.cities.length + ' 城',
      size: 'xxl',      /* v89.105：实测 690px —— xl(700) 只差 10px，但正文会冒滚动条；升一档 */
      body: '<div class="lord-split">' +
        '<div class="ls-left"><div class="m-sec">城池一览（' + s.cities.length + '）</div>' +
          (s.cities.length
            ? s.cities.map(function (c2) {
                return '<div class="lord-city' + (c2.id === curCity.id ? ' cur' : '') + '">' +
                  '<span class="ls-nm">🏯 ' + U.escape(c2.name) +
                    (GAME.isMainCity(c2) ? ' <span class="city-tier mt">主城</span>' : '') + '</span>' +
                  /* v82（老板）：「不要显示（自建城）这种文字」—— 档位文字撤下，坐标与人口保留 */
                  '<span class="ls-meta">[' + c2.x + ',' + c2.y + '] · 人口上限 ' + U.fmt(GAME.maxPopOf(c2)) + '</span>' +
                  '<button class="btn sm gold" data-action="lord-city-enter" data-city="' + c2.id + '">进入</button>' +
                  '</div>';
              }).join('')
            : '<div class="gb-empty" style="height:110px;">当前无城池</div>') +
        '</div>' +
        '<div class="ls-right"><div class="m-sec">君主信息</div>' +
        '<table class="tbl lord-tbl"><tbody>' +
          '<tr><td class="k">君主姓名</td><td><b>' + U.escape(s.ruler.name) + '</b>　' +
            '<button class="btn sm" data-action="open-rename-lord">改名</button></td></tr>' +
          /* v89.7（老板「头像可更换」）：头像行 —— 现脸缩略图 + 更换入口 */
          '<tr><td class="k">头像</td><td>' + (function () {
            var face = GAME.portraits ? GAME.portraits.poolFile({
              gender: s.ruler.gender, portraitSeed: s.ruler.portraitSeed }) : '';
            return (face ? '<img class="lord-av-mini" src="' + face + '" alt="君主头像">' : '') +
              '<button class="btn sm" data-action="open-avatar-pick">更换</button>';
          })() + '</td></tr>' +
          '<tr><td class="k">爵位</td><td>' + (cur ? cur.name : '平民') +
            ' <span class="ui-sub">（' + (s.rank || 0) + ' / ' + (DATA.RANK.length - 1) + '）</span>　' +
            (next
              ? '<button class="btn sm' + (chk && chk.ok ? ' gold' : '') + '" data-action="lord-promote" title="' +
                  U.escape(condTitle) + '">晋升：' + next.name + '</button>'
              : '<span style="color:var(--gold-light);">已登顶</span>') +
            '</td></tr>' +
          /* v79（老板）：爵位加成 / 主城 / 神器 —— 三条新系统的入口与现况 */
          '<tr><td class="k">爵位加成</td><td style="color:var(--green-ok);">' + GAME.rankBonusText() + '</td></tr>' +
          /* v89.131（老板「只有攻打名城才给的那什么'节X'，列出其设定」）：
             节钺余额 + 一条式来源进表（此前只在城池面板的「扩编」按钮悬停里可见 ——
             玩家看不到自己有几枚、从哪来）。悬停给 DATA.JIEYUE.desc 全文。 */
          /* v89.132（老板「节钺设计再开拓一下」）：整行改为**面板入口** ——
             余额 + 来源 + 四种用途 + 全境进度都在 ui.openJieyue 里。 */
          '<tr><td class="k">节钺</td><td title="' +
            U.escape((DATA.JIEYUE || {}).desc || '') + '">' +
            '<button class="btn sm" data-action="open-jieyue">' +
            ((DATA.JIEYUE || {}).icon || '🪓') + ' ×<b>' + GAME.jieyueOf() + '</b>' +
            '　查看用途</button>' +
            ' <span class="ui-sub">（攻占名城 / 爵位每 ' +
            ((DATA.JIEYUE || {}).rankEvery || 4) + ' 档 +1）</span></td></tr>' +
          '<tr><td class="k">主城</td><td>' + (function () {
            var mc = GAME.mainCityOf();
            return mc
              ? ('🏯 ' + U.escape(mc.name) + ' <span class="ui-sub">（驻跸加成中）</span>')
              : '<span class="ui-sub">未设 —— 到目标城的官府点「设为主城」</span>';
          })() + '</td></tr>' +
          '<tr><td class="k">神器</td><td>供奉 ' + U.fmt(GAME.artPts()) + '　' +
            (DATA.ARTIFACTS || []).map(function (a) {
              return a.icon + a.name.slice(0, 2) + ' Lv' + GAME.artLevelOf(a.id);
            }).join(' · ') +
            '　<button class="btn sm gold" data-action="open-artifacts">查看</button></td></tr>' +
          '<tr><td class="k">声望</td><td style="color:var(--green-ok);">' + U.fmt(s.rep) + '</td></tr>' +
          '<tr><td class="k">人口总和</td><td>' + U.fmt(popNow) + ' / ' + U.fmt(totalPop) + '</td></tr>' +
          '<tr><td class="k">将领总和</td><td>' + s.generals.length + '（名将 ' + heroCount + '）</td></tr>' +
          '<tr><td class="k">月俸支出</td><td>' + U.fmt(salaryTotal) + ' 金 / 7 游戏日' +
            ' <span class="ui-sub">（月俸结算时从各城府库扣除）</span></td></tr>' +
          (lg ? (function () {
            /* v89.65（老板「君主练功然后突破」）：修行行 —— 境界 / 修为 / 两个动作。
               「能不能按」一律交给出口去判（按了不可行会返回原因并 toast），
               界面不预判 —— 否则就是"界面判一遍、后端判一遍"两个出口。 */
            var bCap = GAME.genLevelCap(lg), bNeed = GAME.lordCultivNeed(lg);
            var bCur = Math.round(lg.cultiv || 0), atTop = (lg.level || 1) >= bCap;
            var canBreak = atTop && bNeed != null && bCur >= bNeed;
            /* v89.177（老板「综合考验」）：五关进度（政/城/军/资/宝）——未过项红字。
               口径 = GAME.lordTrialOf（唯一出口）；按钮高亮仍只看修为（界面不预判全部门槛）。 */
            var _trial177 = GAME.lordTrialOf ? GAME.lordTrialOf(lg) : null;
            var _trialHTML177 = _trial177 ? ('<div class="ui-sub">突破考验（第 ' + _trial177.n + ' 次 · '
              + (_trial177.ok ? '五关俱过' : '未过') + '）：'
              + _trial177.rows.map(function (r2) {
                return '<span style="color:' + (r2.ok ? 'var(--green-ok)' : 'var(--red-light)') + ';">'
                  + r2.label + ' ' + U.fmt(r2.cur) + '/' + U.fmt(r2.goal) + (r2.ok ? '✓' : '✗') + '</span>';
              }).join('　') + '</div>') : '';
            return '<tr><td class="k">君主领兵</td><td>Lv' + lg.level + ' / ' + bCap + ' · ' +
              ui.genStatusName(lg) + '（不可解雇）</td></tr>' +
              '<tr><td class="k">君主修行</td><td>境界 <b>' + GAME.lordRealmOf(lg) + '</b>' +
              '　修为 <b>' + U.fmt(bCur) + '</b>' + (bNeed == null ? '（已至顶）' : ' / ' + U.fmt(bNeed)) +
              '　<button class="btn sm' + (atTop ? '' : ' gold') + '" data-action="lord-train">🧘 练功</button>' +
              ' <button class="btn sm' + (canBreak ? ' gold' : '') + '" data-action="lord-break">⚡ 突破</button>' +
              '<div class="ui-sub">每 ' + DATA.LORD_BREAK.step + ' 级一段：练功攒修为，段顶须突破方可续升' +
              (bNeed == null ? '　·　已至天授上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div>' + _trialHTML177 +
              '</td></tr>';
          })() : '') +
          '<tr><td class="k">状态</td><td>正常</td></tr>' +
        '</tbody></table></div>' +
      '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

    /* ============================================================
   * 神器面板（v79 · 老板「神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），
   * 神器界面在君主菜单中」）
   * ------------------------------------------------------------
   * 三件神器**共用一池供奉值**（s.artifacts.pts）：
   *   · 游戏时长（主要）—— 主循环与离线补算各推一次（GAME.artTick）
   *   · 特殊活动（加速）—— 攻占城池 / 爵位晋升大额入账（GAME.artGain）
   * 等级 = 供奉值翻过的门槛数（DATA.ARTIFACT.pts）；加成走 GAME.artifactBonusNum。
   * ============================================================ */
  ui.openArtifacts = function () {
    var pts = GAME.artPts();
    var A = DATA.ARTIFACT || {};
    var maxLv = A.maxLv || 10;
    var lv = GAME.artLevelOf();
    var next = lv < maxLv ? (A.pts || [])[lv] : null;
    var pct = next ? Math.min(100, Math.floor(pts / next * 100)) : 100;
    var rows = (DATA.ARTIFACTS || []).map(function (a) {
      var l = GAME.artLevelOf(a.id);
      return '<div class="art-row">' +
        '<div class="art-ic">' + a.icon + '</div>' +
        '<div class="art-main">' +
          '<div class="art-nm">' + U.escape(a.name) + ' <span class="art-lv">Lv' + l + '</span>' +
            ' <span class="ui-sub">' + U.escape(a.theme || '') + '</span></div>' +
          '<div class="ui-sub">' + U.escape(a.desc || '') + '</div>' +
          '<div class="ui-sub" style="color:var(--gold-light);">现效力：' + GAME.artEffText(a, l) + '</div>' +
        '</div>' +
        '<div class="art-side">满级 Lv' + maxLv + '</div>' +
        '</div>';
    }).join('');
    var srcLine = '供奉来源：游戏时长 +' + (A.perGameHour || 0) + '/游戏小时（主）　·　攻占城池 '
      + '（县 ' + ((A.capturePts || {}).county || 0) + ' / 郡 ' + ((A.capturePts || {}).jun || 0)
      + ' / 州 ' + ((A.capturePts || {}).zhou || 0) + ' / 都城 ' + ((A.capturePts || {}).capital || 0)
      + '）　·　爵位晋升 +' + (A.promotePts || 0);
    ui.openModal('<div class="gold-heading">🏺 神器 · 供奉值 ' + U.fmt(pts) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">' + srcLine + '</div>' +
      '<div class="pbar" style="margin:8px 0 2px;"><i style="width:' + pct + '%;"></i></div>' +
      '<div class="ui-sub" style="text-align:center;">' +
        (next ? ('距 Lv' + (lv + 1) + '：' + U.fmt(pts) + ' / ' + U.fmt(next)) : '已至最高 Lv' + lv) +
      '</div>' +
      rows +
      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城池与爵位晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165：供奉值随游戏时间累积（3 点/游戏小时）—— 接入 live 每秒重开，
         总量与进度条随秒推进（120× 下约每 10 秒 +1 点，肉眼可见）。 */
      { size: 'xl', live: function () { ui.openArtifacts(); } });
  };

  /* ============================================================
   * 头像更换面板（v89.7 · 老板「头像可更换」）
   * ------------------------------------------------------------
   * 与创建界面 / 麾下将领同一套头像池（assets/portraits/pool，按性别 20 张）。
   * 点选即换：改的是唯一事实源 `s.ruler.portraitSeed`（GAME.setLordAvatar）——
   * 顶栏立绘、君主面板预览、将领页的脸全部同源生效。
   * 「完成」回君主面板（与改名同一套流程：动作后回到原面板）。
   * ============================================================ */
  ui.openAvatarPick = function () {
    var s = GAME.state;
    var gender = (s.ruler && s.ruler.gender === 'female') ? 'f' : 'm';
    var pool = (GAME.portraits && GAME.portraits.POOL && GAME.portraits.POOL[gender]) || [];
    var seed = (s.ruler && s.ruler.portraitSeed) || 0;
    var cur = pool.length ? (seed % pool.length) : 0;
    var body;
    if (!pool.length) {
      body = '<div class="q-empty">头像池不可用（assets/portraits/pool 缺失）。</div>';
    } else {
      body = '<div class="ui-sub" style="text-align:center;">共 ' + pool.length +
          ' 张 · 与麾下将领同一套画师　—— 点一张即换，换错再点一张就行。</div>' +
        '<div class="av-grid">' +
        pool.map(function (file, i) {
          return '<div class="av-cell' + (i === cur ? ' cur' : '') +
            '" data-action="pick-lord-avatar" data-idx="' + i + '" title="第 ' + (i + 1) + ' 张">' +
            '<img src="' + GAME.portraits.DIR + 'pool/' + file + '" alt="头像 ' + (i + 1) + '"></div>';
        }).join('') +
        '</div>';
    }
    var sh = ui.modalShell({
      title: '👤 更换头像', sub: '点选即换 · 随档保存',
      body: body, size: 'md',
      foot: '<div class="m-foot"><button class="btn" data-action="close-avatar-pick">完成</button></div>'
    });
    /* noClose：底部由本面板自管（「完成」要回君主面板，不是单纯关窗） */
    ui.openModal(sh.html, { size: 'md', noClose: true });
  };

    /* ============================================================
   * v89.138（老板 3）：「如果提速后完成了募兵，剩余时长为 0，则应**自动关闭**提速小弹窗」——
   * 判据：该营（或作坊）的"正在执行"队列已无剩余（`trainRushRemain ≤ 0`）
   *   或干脆已没有在办队列。完成 → 关窗；没完成 → 留在面板里（剩余变短看得见）。
   * ============================================================ */
  ui.queueDone138 = function (bIdx) {
    var c = GAME.currentCity();
    if (!c) return true;
    var kinds = ['train', 'craft'];
    for (var i = 0; i < kinds.length; i++) {
      var run = GAME.trainRunningOf(c.id, bIdx, kinds[i]);
      if (run && GAME.trainRushRemain(run) > 0) return false;
    }
    return true;
  };

  /* ============================================================
   * 募兵提速（v28 起 · v89.49 改双路）
   * ------------------------------------------------------------
   * v28 原设计：列出背包里 target=train 的宝物，点一下加速。
   * **v89.49 病根**（老板「募兵队列怎么不可加速了？」）：
   *   只有宝物一条路 —— 背包没有韩信三篇/点兵术时，队列里的「加速」是 disabled，
   *   玩家看到的直接是"不可加速"（灰按钮，点了没反应）。
   * 现在面板分两段：
   *   ① 💰 花金买时间（永远可用，三档，价随"还能缩短多少"浮动）
   *   ② 🎁 宝物加速（有则列出，没有则说明去哪买）
   * 计价与结算全部读 GAME.trainRush* 出口，界面不自己算。
   * ============================================================ */
  ui.openTrainBoost = function (bIdx) {
    var c = GAME.currentCity();
    var bar = null;
    GAME.barracksOf(c).forEach(function (x) { if (x.idx === bIdx) bar = x; });
    var kind = 'train';
    if (!bar) {
      /* v89.49：也可能是工匠作坊（器械队列）—— 两套队列共用本面板 */
      GAME.craftWorkshopsOf(c).forEach(function (x) { if (x.idx === bIdx) { bar = x; kind = 'craft'; } });
    }
    if (!bar) { ui.toast('未找到该军营'); return; }
    var label = kind === 'craft' ? '工匠作坊' : '军营';
    var run = GAME.trainRunningOf(c.id, bIdx, kind);
    var head = '<div class="gold-heading">⚡ 提速 · 城内第 ' + (bIdx + 1) + ' 格' + label + '</div>';
    /* v89.49：队列刚好走完、还没被主循环扫走时（remain = 0）也按空态显示 ——
       否则三档都会报「0 金」，点了回一句"已完工"，很难看。 */
    if (!run || GAME.trainRushRemain(run) <= 0) {
      ui.openModal(head + '<div class="q-empty">本' + (kind === 'craft' ? '作坊' : '营') +
        '当前没有进行中的' + (kind === 'craft' ? '制造' : '募兵') + '任务</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var t = DATA.TROOPS[run.troopId] || {};
    var left = Math.max(0, (run.totalTime - (run.elapsed || 0)) / GAME.timeScale());
    var pctDone = Math.min(100, Math.floor((run.elapsed || 0) / run.totalTime * 100));
    /* ---- ① 花金买时间 ---- */
    var steps = GAME.trainRushCfg().steps || [];
    var goldBtn = steps.map(function (st) {
      var cost = GAME.trainRushCost(run, st.pct);
      var afford = (GAME.state.res.gold || 0) >= cost;
      return '<button class="btn sm' + (afford ? ' gold' : ' dim') + '" data-action="train-rush"'
        + ' data-pct="' + st.pct + '" data-idx="' + bIdx + '" data-kind="' + kind + '"'
        + (afford ? '' : ' disabled') + '>' + st.label + '<br><span class="tr-cost">' + U.numText(cost, 0) + ' 金</span></button>';
    }).join('');
    /* ---- ② 宝物加速 ---- */
    var list = GAME.systems.trainBoostItems();
    var itemHtml = list.length
      ? '<div class="xc-list" style="margin-top:8px;">' + list.map(function (it) {
          var used = run.boost && run.boost[it.id];
          var dis = it.once && used;
          return '<div class="xc-row">' +
            '<div class="xc-ico">' + (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') + '</div>' +
            '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + (GAME.state.items[it.id] || 0) + '</b>' +
              '<span class="xc-prod">' + U.escape(it.desc || '') + '</span></div>' +
            '<button class="btn sm' + (dis ? ' dim' : ' gold') + '" data-action="do-train-boost" data-item="' + it.id +
              '" data-idx="' + bIdx + '"' + (dis ? ' disabled' : '') + '>' + (dis ? '已用过' : '加速') + '</button>' +
            '</div>';
        }).join('') +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>' + '</div>'
      : '<div class="q-empty" style="margin-top:8px;">背包里没有训练加速宝物 —— 可就地购买（见下）</div>' +
        '<div style="text-align:center;margin-top:6px;">' +
          '<button class="btn sm gold" data-action="qb-cat" data-cat="boost" data-scope="train">🛒 购买训练宝物</button></div>';
    var body =
      '<div class="attr"><span class="k">进行中</span><span class="v">' +
        (t.name || run.troopId) + ' ×' + U.numText(run.count, 0) + '</span></div>' +
      '<div class="attr"><span class="k">剩余</span><span class="v good">' + U.durExact(left) + '</span></div>' +
      '<div class="attr"><span class="k">进度</span><span class="v">' + pctDone + '%</span></div>' +
      /* ⛔ v89.138（老板 3）：「已用宝物 hanxin_dianbing，这行不要，而且为啥是拼音」——
         该行显示的是**内部 id**（拼音），既是信息噪声又不像中文界面。
         宝物"用过没"已由宝物行自身的「已用过」禁用态表达（不需要第二处）。 */
      '<div class="op-zone" style="margin-top:10px;"><div class="op-zone-t">💰 花金买时间' +
        ui.help('价格 = 该批军资 ×20% × 还能缩短的比例\n' +
          '（军资 = 兵种单价 × 数量；越接近完工越便宜）\n' +
          '宝物加速更划算，但需商城购得、且受"每队列限 1 次"限制') + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' + goldBtn + '</div>' +
        '<div class="ui-sub" style="text-align:center;margin-top:6px;">现有黄金 ' +
          U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '</div>' +
      '<div class="op-zone" style="margin-top:10px;"><div class="op-zone-t">🎁 宝物加速（更划算）</div>' +
        itemHtml + '</div>';
    ui.openShell({
      title: '', sub: '',
      size: 'md',
      body: head + body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.165（老板：「查看所有类似实时读秒设置」）：本窗上文写着「剩余变短看得见」
         —— 但此前没接 live，读秒是静止的。现补上：逐秒重开（剩余/进度实时走）；
         队列走完（trainRushRemain ≤ 0）→ 自动关窗（v89.138 原意，覆盖"开着等自然完成"）。 */
      live: function () {
        if (ui.queueDone138(bIdx)) ui.closeModal();
        else ui.openTrainBoost(bIdx);
      }
    });
  };

  /* 资源显示名与图标（模块级共享：野地面板 / 采集面板等多处复用） */
  ui.RES_NAME = { grain: '粮', wood: '木', stone: '石', iron: '铁', gold: '金' };
  ui.RES_ICON = { grain: '🌾', wood: '🪵', stone: '⛰️', iron: '🔩', gold: '💰' };

  /* v87「地形专属场景区块」-> v88.1 整合：
     ui.wildSceneHTML / ui.doWildScene / _wsGen / _wsResult 已全部删除 ——
     六地形场景并入下方「江湖游历区块」（ui.jianghuHTML，kind:'scene' 活动）。 */

  /* ============================================================
   * v88（老板「修炼培养系统」）：江湖游历区块
   * ------------------------------------------------------------
   * 嵌在野地弹窗（openLandModal 未占/已占两分支）内、地形场景之下：
   *   活动菜单（每处**每活动**每日一次）+ 带队将领 + 结果回显。
   * 逻辑出口 GAME.jianghuCheck / jianghuDo（state.js，唯一）。
   * ============================================================ */
  ui._jhGen = null;
  ui._jhResult = null;
  ui.jianghuHTML = function (x, y) {
    if (!GAME.jianghuActsAt) return '';
    var tile = GAME.map.tile(x, y);
    if (!tile) return '';
    var acts = GAME.jianghuActsAt(x, y);   /* v89.4：逐地分布（同格恒同貌） */
    /* v88.1：地形专属（scene）排最前 —— 本地的「招牌」 */
    acts.sort(function (p1, p2) {
      return ((p2.def.kind === 'scene') ? 1 : 0) - ((p1.def.kind === 'scene') ? 1 : 0);
    });
    var s = GAME.state;
    var day = Math.floor(((s.world && s.world.elapsed) || 0) / 86400);
    var home = GAME.currentCity();
    /* v89：修炼线君主专属 —— 江湖游历只由君主亲往（主角单修） */
    var own = (s.generals || []).filter(function (g) { return g.cityId === home.id && GAME.isLordGeneral(g); });
    if (!ui._jhGen || !own.some(function (g) { return g.id === ui._jhGen; })) {
      ui._jhGen = own[0] ? own[0].id : '';
    }
    var res = (ui._jhResult && ui._jhResult.xy === (x + ',' + y)) ? ui._jhResult : null;
    /* v89.4：野地生态 —— 逐地随缘（荒僻 / 1~3 事）· 等级联动（难度 / 收益） */
    var lv4 = GAME.map.wildLevelNow(x, y);
    var sp4 = DATA.JH_SPREAD || {};
    var lvN4 = 1 + lv4 * (sp4.lvNeed || 0), lvR4 = 1 + lv4 * (sp4.lvRew || 0);
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 逐地随缘而生 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">野地 Lv' + lv4 +
        ' · 难度 ×' + lvN4.toFixed(1) + ' · 收益 ×' + lvR4.toFixed(1) +
        '　—— 江湖诸事随缘而现，精华用于蕴养修炼装备</div>';
    /* v89.6：奇遇入口 —— 已现形才露面；未现形不给任何暗示（隐藏点是探索层的地基） */
    var ws6 = GAME.wonderSiteOf ? GAME.wonderSiteOf(x, y) : null;
    if (ws6) {
      var cost6 = (DATA.WONDER && DATA.WONDER.cost) || { energy: 6, stam: 2 };
      if (ws6.done) {
        h += '<div class="wnr-line wnr-done">✦ 此地奇遇已探 —— 缘止于此</div>';
      } else if (ws6.revealed) {
        h += '<div class="wnr-line">✦ 此地似有异象未探　' +
          '<button class="btn sm wnr-btn" data-action="do-wonder" data-x="' + x + '" data-y="' + y + '">' +
          '探奇（精' + cost6.energy + ' · 体' + cost6.stam + '）</button></div>';
      }
    }
    if (res) {
      h += '<div class="note" style="margin:4px 0;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        U.escape(res.name + '：' + res.text) + '</div>';
    }
    if (!acts.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0;">此处野地荒僻，暂无江湖之事 —— 野地之事随缘而现，换一处看看。</div>';
    } else if (!own.length) {
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);">君主不在此城 —— 江湖之事，需君主亲至。</div>';
    } else {
      h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;">' +
        '<label style="color:var(--text-dim);">君主亲往</label>' +
        '<input type="hidden" id="jh-gen" value="' + ui._jhGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'jh-gen', value: ui._jhGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0) + ' 体' + Math.round(GAME.staNow(g)) + ' 灵' + GAME.lingPowerOf(g); } }) +
        '</div>';
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      acts.forEach(function (a) {
        var done = GAME.jianghuDone(s, x, y, a.id, day);
        h += done
          ? '<span class="op-done" style="font-size:var(--fs-sub);padding:5px 8px;">' + a.def.icon + ' ' + a.def.name + '（今日已做）</span>'
          : '<button class="btn sm" data-action="do-jianghu" data-x="' + x + '" data-y="' + y + '" data-act="' + a.id + '"' +
              ' title="' + U.escape(a.def.desc || '') + '">' + a.def.icon + ' ' + a.def.name + '（精' + a.def.energy + ' · 体' + a.def.stam + '）</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    return h;
  };
  /* v89（老板）：「为每项活动做专属全屏交互界面 + 特定退出」——
     活动按钮 → 全屏剧本（对话 / 事件 2~3 幕）→ 专属退出结算屏。
     全屏层 #scene-fx 挂在 body 上（z=1500：高于弹窗 1000、低于 toast 2000），
     不占 modal-root —— 弹窗是单根替换系统，两者互不干扰。 */
  ui._sceneFx = null;
  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var lg = GAME.lordGeneralOf();       /* v89：君主专属（闸门在 jianghuCheck，这里便于兜底） */
    if (lg && (!gid || gid !== lg.id)) gid = lg.id;
    if (!(DATA.SCENE_FLOW || {})[actId]) {
      /* 无剧本兜底（未来新增活动）：直接一次性结算 —— one-shot 出口保留 */
      var r0 = GAME.jianghuDo(x, y, gid, actId);
      if (!r0.ok) { ui.toast(r0.msg); return; }
      ui._jhResult = { xy: x + ',' + y, name: r0.name, text: r0.text, bad: r0.bad };
      ui.toast('☯ ' + r0.name + (r0.text ? '（' + r0.text + '）' : ''));
      GAME.refreshAll();
      ui.openLandModal(x, y);
      return;
    }
    var r = GAME.sceneStart(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('剧本缺失'); return; }
    ui.openSceneFx(r.fx);
  };
  /* v89.6：探奇 —— 已现形点位 → 奇遇全屏剧本（君主亲往；扣费与锁在首次选择时落） */
  ui.doWonder = function (x, y) {
    var lg = GAME.lordGeneralOf();
    var r = GAME.wonderStart(x, y, lg ? lg.id : '');
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('奇物未载于册'); return; }
    ui.openSceneFx(r.fx);
  };
  ui.openSceneFx = function (fx) { ui._sceneFx = fx; ui.renderSceneFx(); };
  ui.renderSceneFx = function () {
    var fx = ui._sceneFx;
    if (!fx) return;
    var el = document.getElementById('scene-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scene-fx';
      /* v89.150（老板 2）：fixed → absolute（挂缩放容器 = 画布坐标系，铺满画布） */
      el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      var _root150d = ui.layerRoot();
      if (_root150d && _root150d.appendChild) _root150d.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = ui.sceneFxHTML(fx);
    el.scrollTop = 0;
    /* v89.2：把场景画到画布上；时机幕启动指针计时器 */
    ui.paintSceneFx();
    ui.sxfTimingClear();
    if (fx.phase === 'stage') {
      var st0 = fx.fly.stages[fx.stage];
      if (st0 && st0.t2) ui.sxfTimingStart();
    }
  };
  /* v89.1（老板：「只有文字，能不能再丰富一点」）——
     剧本视觉化：幕景横幅（地形染色 + 大字水印 + 活动徽记 + 君主头像 + 天时日号）、
     行程时间线、幕题条、对白高亮、选项倾向徽章、专属退出结算卡（光晕 + 战果 + 账单）。
     全部复用现有素材与主题变量（地形色 / 天气 / 头像），零新资源。 */
  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采撷', cultivate: '修真', visit: '访贤', scene: '游历', wonder: '奇遇' };
  /* 选项倾向徽章：由修正系数直接生成（攻/获 = 增益 · 险/稳 = 负伤变化 · 缘 = 小幸运） */
  ui.sxfBadges = function (e) {
    e = e || {};
    var out = [];
    var pct = function (x) { return (x > 1 ? ' +' : ' -') + Math.abs(Math.round((x - 1) * 100)) + '%'; };
    if (e.pow && e.pow !== 1) out.push('<span class="sxf-bdg" style="color:var(--gold-light);">攻' + pct(e.pow) + '</span>');
    if (e.reward && e.reward !== 1) out.push('<span class="sxf-bdg" style="color:var(--green-ok);">获' + pct(e.reward) + '</span>');
    if (e.wound && e.wound !== 1) {
      out.push(e.wound > 1
        ? '<span class="sxf-bdg" style="color:var(--red-light);">险' + pct(e.wound) + '</span>'
        : '<span class="sxf-bdg" style="color:var(--blue-info);">稳' + pct(e.wound) + '</span>');
    }
    if (e.luck) out.push('<span class="sxf-bdg" style="color:var(--amber);">缘 +' + Math.round(e.luck * 100) + '</span>');
    return out.join('');
  };
  /* 对白高亮：先转义、再把「……」独立成段（避免注入） */
  ui.sxfQuote = function (t) {
    return U.escape(t).replace(/「[^」]*」/g, '<span class="sxf-q">$&</span>');
  };
  /* v89.2（老板「纯选择，缺少场景交互 …… 我想看见个湖，而不是一行字」）——
     两个新交互原语（数据驱动、引擎零改动）：
       · spot   —— 第 1 幕变成**场景热点**：在画里点地点，而不是读三个按钮；
       · timing —— 关键一幕变成**时机条**：看准了再停手，命中三档（正中/不错/脱手）。
     选项编号仍是 scenePick(i) 的 i，三档即三个选项 —— 可复现不变式保持。 */
  ui.SXF_ANCHORS = {
    lake:    [[0.13, 0.62], [0.53, 0.56], [0.86, 0.60]],
    fort:    [[0.31, 0.62], [0.62, 0.50], [0.86, 0.58]],
    array:   [[0.27, 0.60], [0.52, 0.54], [0.76, 0.58]],
    meadow:  [[0.22, 0.54], [0.52, 0.68], [0.80, 0.56]],
    grove:   [[0.28, 0.62], [0.55, 0.52], [0.78, 0.60]],
    cottage: [[0.37, 0.60], [0.56, 0.50], [0.80, 0.62]],
    road:    [[0.30, 0.62], [0.50, 0.54], [0.80, 0.60]],
    marsh:   [[0.22, 0.58], [0.52, 0.50], [0.80, 0.62]],
    ruin:    [[0.42, 0.58], [0.62, 0.58], [0.82, 0.64]],
    hunt:    [[0.25, 0.62], [0.52, 0.54], [0.80, 0.64]],
    steppe:  [[0.26, 0.58], [0.55, 0.50], [0.80, 0.60]],
    yard:    [[0.28, 0.60], [0.55, 0.52], [0.78, 0.62]]
  };
  /* 一幕用哪种交互：时机 > 场景热点（第 1 幕，2~3 个选项）> 常规按钮 */
  ui.sxfStageMode = function (fly, idx, st) {
    if (st && st.t2) return 'timing';
    if (idx === 0 && st && st.o && st.o.length >= 2 && st.o.length <= 3
        && ui.SXF_ANCHORS[fly.scene]) return 'spot';
    return 'choice';
  };
  /* 时机判定（纯函数）：正中 / 不错 / 脱手 → 选项 0 / 1 / 2 */
  ui.sxfTimingGrade = function (pos) {
    if (pos >= 0.44 && pos <= 0.56) return 0;
    if (pos >= 0.28 && pos <= 0.72) return 1;
    return 2;
  };
  ui._sxfTick = null; ui._sxfT0 = 0; ui._sxfPos = 0;
  /* 指针位置：三角波 0→1→0，周期 1.6 秒 */
  ui.sxfTimingPos = function () {
    var per = 1600, t = (Date.now() - ui._sxfT0) % (per * 2);
    if (t < 0) t += per * 2;
    return t <= per ? t / per : (per * 2 - t) / per;
  };
  ui.sxfTimingStart = function () {
    ui._sxfT0 = Date.now(); ui._sxfPos = 0;
    if (ui._sxfTick) return;
    ui._sxfTick = setInterval(function () {
      var el = document.getElementById('sxf-mark');
      if (!el) return;
      ui._sxfPos = ui.sxfTimingPos();
      el.style.left = (4 + ui._sxfPos * 92) + '%';
    }, 40);
  };
  ui.sxfTimingClear = function () {
    if (ui._sxfTick) { clearInterval(ui._sxfTick); ui._sxfTick = null; }
  };
  /* 停手 → 按命中档选对应选项（pos 可注入：测试用） */
  ui.sxfTimingStop = function (pos) {
    var fx = ui._sceneFx;
    if (!fx || fx.phase !== 'stage') return;        /* 防误触：流程已结束 */
    var st = fx.fly.stages[fx.stage];
    if (!st || !st.t2) return;                      /* 只在时机幕生效（连点不越幕） */
    var p = (typeof pos === 'number') ? pos : ui.sxfTimingPos();
    ui.sxfTimingClear();
    GAME.doScenePick(ui.sxfTimingGrade(p));
  };
  /* 选项图标：由修正系数派生，让同一幕几个选项一眼不同 */
  ui.sxfOptIcon = function (e) {
    e = e || {};
    if (e.wound && e.wound > 1) return '🔥';
    if (e.wound && e.wound < 1) return '🛡️';
    if (e.pow && e.pow > 1) return '⚔️';
    if (e.reward && e.reward > 1) return '🎁';
    if (e.luck) return '🍀';
    return '·';
  };
  /* 把当前场景画到画布上（ctx 缺失时静默跳过：测试桩环境安全） */
  ui.paintSceneFx = function () {
    var el = document.getElementById('scene-fx');
    var fx = ui._sceneFx;
    if (!el || !fx || !GAME.map || !GAME.map.paintScene) return;
    var cv = el.querySelector ? el.querySelector('canvas.sxf-canvas') : null;
    if (!cv || !cv.getContext) return;
    var ctx = null;
    try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return;
    GAME.map.paintScene(ctx, fx.fly.scene || 'meadow', fx.chk.x * 31 + fx.chk.y * 17);
  };
  ui.sceneFxHTML = function (fx) {
    var a = fx.chk.act;
    var fly = fx.fly;
    var gen = fx.chk.gen;
    var tile = GAME.map.tile(fx.chk.x, fx.chk.y) || {};
    var tdef = DATA.TERRAIN[tile.terrain] || {};
    var total = fly.stages.length;
    var dayN = (fx.chk.day || 0) + 1;
    /* 幕景横幅底纹：地形染色（hex → rgba；无颜色定义时退回面板色） */
    var tint = '';
    if (tdef.color) {
      var v = parseInt(tdef.color.slice(1), 16);
      var rgb = (v >> 16) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
      tint = 'background:linear-gradient(135deg,rgba(' + rgb + ',.24),rgba(' + rgb + ',.04) 62%),var(--panel-bg);';
    }
    /* v89.6：奇遇横幅改「奇缘紫」底纹 —— 与江湖活动一眼区分（看颜色就知道是奇遇） */
    if (fx.kind === 'wonder') {
      tint = 'background:linear-gradient(135deg,rgba(var(--wonder-rgb),.26),rgba(var(--wonder-rgb),.05) 62%),var(--panel-bg);';
    }
    /* 天时（story 缺席时静默省略） */
    var we = (GAME.story && GAME.story.currentWeather) ? GAME.story.currentWeather() : null;
    var se = (GAME.story && GAME.story.currentSeason) ? GAME.story.currentSeason() : null;
    var meta = [];
    if (tdef.name) meta.push(U.escape(tdef.name) + '（' + fx.chk.x + ',' + fx.chk.y + '）');
    meta.push('野地 Lv' + fx.chk.lv);
    meta.push('第 ' + dayN + ' 日' + (se && se.name ? ' · ' + U.escape(se.name) : ''));
    if (we) meta.push(we.icon + U.escape(we.name || ''));
    var st = (fx.phase === 'stage') ? fly.stages[fx.stage] : null;
    var mode = st ? ui.sxfStageMode(fly, fx.stage, st) : '';

    var h = '<div class="sxf-wrap">';
    /* —— 顶栏：活动 / 门类 / 君主 / 天时 —— */
    h += '<div class="sxf-hero"' + (tint ? ' style="' + tint + '"' : '') + '>';
    h += '<span class="sxf-hero-art" aria-hidden="true">' + (fly.art || '📜') + '</span>';
    h += '<div class="sxf-hero-top">';
    h += '<span class="sxf-act-ic">' + a.icon + '</span>';
    h += '<span class="sxf-hero-name">' + U.escape(a.name) + '</span>';
    /* v89.3：雅名（alias）与门类章（cat 兜底 kind）—— 命名体系统一 */
    if (a.alias) h += '<span class="sxf-hero-alias">' + U.escape(a.alias) + '</span>';
    h += '<span class="sxf-hero-kind">' + U.escape(a.cat || ui.SXF_KIND[a.kind] || '江湖') + '</span>';
    h += '<span class="sxf-hero-lord">' + ui.faceOf(gen, 44) +
      '<span class="sxf-lord-meta"><b>' + U.escape(gen.name) + '</b>' +
      '<span class="sxf-lord-sub">灵力 ' + GAME.lingPowerOf(gen) + ' · 精力 ' + Math.round(gen.energy || 0) +
      ' · 体力 ' + Math.round(GAME.staNow(gen)) + '</span></span></span>';
    h += '</div>';
    h += '<div class="sxf-hero-meta">' + meta.join('　·　') + '</div>';
    if (fx.phase === 'stage') {
      var dots = '';
      for (var i = 0; i < total; i++) dots += '<span class="sxf-dot' + (i <= fx.stage ? ' on' : '') + '">' + (i <= fx.stage ? '◆' : '◇') + '</span>';
      h += '<div class="sxf-hero-foot"><span class="sxf-dots">' + dots + '</span>' +
        '<button class="btn sm" data-action="sxf-escape">' + U.escape(fly.escLabel || '就此离去') + '</button></div>';
    }
    h += '</div>';
    /* —— v89.2 场景插画（看见湖，而不是一行字；第 1 幕直接点画选点）—— */
    h += '<div class="sxf-scene' + (fx.phase === 'result' ? ' is-done' : '') + '">';
    h += '<canvas class="sxf-canvas" width="1720" height="520" aria-hidden="true"></canvas>';
    if (mode === 'spot') {
      var anchors = ui.SXF_ANCHORS[fly.scene] || [];
      h += '<div class="sxf-spots">';
      for (var si = 0; si < st.o.length; si++) {
        var op0 = st.o[si];
        var pt = anchors[si] || [0.25 + si * 0.25, 0.62];
        h += '<button class="btn sxf-opt sxf-spot" data-action="sxf-choice" data-i="' + si + '"' +
          ' style="left:' + (pt[0] * 100).toFixed(1) + '%;top:' + (pt[1] * 100).toFixed(1) + '%;"' +
          ' title="' + U.escape(op0.d || op0.l) + '">' +
          '<span class="sxf-spot-hit" aria-hidden="true"></span>' +
          '<span class="sxf-spot-lb"><b>' + U.escape(op0.l) + '</b>' + ui.sxfBadges(op0.e) + '</span>' +
          '</button>';
      }
      h += '</div>';
      h += '<div class="sxf-sc-tip">点画中之处 —— 落子于此</div>';
    }
    h += '</div>';
    /* —— 行程时间线（已走过的幕题与当时抉择）—— */
    if (fx.picks.length) {
      h += '<div class="sxf-timeline"><span class="sxf-tl-cap">行程</span>';
      for (var pi = 0; pi < fx.picks.length; pi++) {
        var stDef = fly.stages[pi] || {};
        h += '<span class="sxf-tl-item">' + U.escape(stDef.s || ('第' + (pi + 1) + '幕')) +
          '<span class="sxf-tl-l">' + U.escape(fx.picks[pi].l) + '</span></span>';
        if (pi < fx.picks.length - 1) h += '<span class="sxf-tl-sep">›</span>';
      }
      h += '</div>';
    }
    if (fx.phase === 'stage') {
      /* —— 当前幕：幕题条 + 叙事卡 + 交互区（热点 / 时机 / 按钮）—— */
      h += '<div class="sxf-stage">';
      h += '<div class="sxf-stage-tag"><span class="sxf-stage-no">第 ' + (fx.stage + 1) + ' / ' + total + ' 幕</span>' +
        (st.s ? '<span class="sxf-stage-tt">' + U.escape(st.s) + '</span>' : '') + '</div>';
      h += '<div class="sxf-narr">' + ui.sxfQuote(st.t) + '</div>';
      if (mode === 'timing') {
        h += '<div class="sxf-timing">' +
          '<div class="sxf-tk"><span class="sxf-zone sxf-zone-g" aria-hidden="true"></span>' +
          '<span class="sxf-zone sxf-zone-p" aria-hidden="true"></span>' +
          '<span class="sxf-mark" id="sxf-mark" aria-hidden="true"></span></div>' +
          '<div class="sxf-tm-row">' +
          '<span class="sxf-tm-hint">看准时机 —— 正中者事半功倍，脱手者得不偿失</span>' +
          '<button class="btn gold lg" data-action="sxf-stop">' + U.escape(st.t2 || '就是现在！') + '</button>' +
          '</div></div>';
      } else if (mode === 'choice') {
        h += '<div class="sxf-opts">' + st.o.map(function (op, oi) {
          return '<button class="btn sxf-opt" data-action="sxf-choice" data-i="' + oi + '">' +
            '<span class="sxf-opt-ic" aria-hidden="true">' + ui.sxfOptIcon(op.e) + '</span>' +
            '<span class="sxf-opt-l"><b>' + U.escape(op.l) + '</b>' +
            (op.d ? '<span class="sxf-opt-d">' + U.escape(op.d) + '</span>' : '') + '</span>' +
            '<span class="sxf-opt-b">' + ui.sxfBadges(op.e) + '</span></button>';
        }).join('') + '</div>';
      }
      h += '<div class="sxf-note">' +
        (fx.spent ? '已动身 —— 中途罢手，所耗精力体力不返；此地此事今日即算已过。'
                  : '尚未动身 —— 此时离去，无任何消耗。') + '</div>';
      h += '</div>';
    } else {
      /* —— 专属退出结算卡 —— */
      var ex = fly.exits[fx.grade] || fly.exits.win || fly.exits.escape;
      var res = fx.result || {};
      var gcol = fx.grade === 'win' ? 'var(--gold)' : (fx.grade === 'lose' ? 'var(--red-light)' : 'var(--text-dim)');
      h += '<div class="sxf-result">';
      h += '<div class="sxf-emblem" style="color:' + gcol + ';">' + ex.ic + '</div>';
      h += '<div class="sxf-exit-t" style="color:' + gcol + ';">' + U.escape(ex.t) + '</div>';
      h += '<div class="sxf-exit-s">' + U.escape(ex.s || '') + '</div>';
      h += '<div class="sxf-loot">';
      if (res.escaped) {
        h += '<div class="sxf-loot-row' + (fx.spent ? ' bad' : '') + '">' +
          (fx.spent ? '审时度势，中途罢手 —— 所耗不返，此地此事今日已计入。'
                    : '尚未动身，转身离去 —— 未有任何消耗。') + '</div>';
      } else if (res.ok) {
        if (res.name) h += '<div class="sxf-loot-hd">' + U.escape(res.name) + '</div>';
        if (res.text) h += res.text.split('、').map(function (t2) {
          return '<div class="sxf-loot-row' + (res.bad ? ' bad' : '') + '">' + U.escape(t2) + '</div>';
        }).join('');
      }
      h += '</div>';
      if (res.clue) h += '<div class="sxf-clue">' + U.escape(res.clue) + '</div>';
      if (!res.escaped || fx.spent) {
        h += '<div class="sxf-cost">耗：精力 -' + a.energy + ' · 体力 -' + a.stam +
          '　│　余：精力 ' + Math.round(gen.energy || 0) + ' · 体力 ' + Math.round(GAME.staNow(gen)) +
          (res.escaped ? '　（所耗不返）' : '') + '</div>';
      }
      h += '<div class="sxf-exit-row"><button class="btn gold lg" data-action="sxf-exit">' + U.escape(fly.backLabel || '打道回府') + '</button></div>';
      h += '</div>';
    }
    h += '</div>';
    return h;
  };
  ui.closeSceneFx = function () {
    var fx = ui._sceneFx;
    ui._sceneFx = null;
    GAME.sceneFx = null;
    ui.sxfTimingClear();          /* v89.2：时机条计时器随层关闭清零 */
    var el = document.getElementById('scene-fx');
    if (el) el.style.display = 'none';
    if (!fx || !fx.chk) return;
    if (fx.result && fx.result.escaped && !fx.spent) return;   /* 未动身退出：状态无变化，原地不动 */
    if (fx.result) {
      ui._jhResult = {
        xy: fx.chk.x + ',' + fx.chk.y,
        name: fx.result.escaped ? '中途罢手' : fx.result.name,
        text: fx.result.escaped ? '所耗不返，今日已计入' : fx.result.text,
        bad: fx.result.escaped ? true : fx.result.bad
      };
    }
    GAME.refreshAll();
    ui.openLandModal(fx.chk.x, fx.chk.y);   /* 原地回野地弹窗（显示结果与「今日已做」） */
  };

  /* ============================================================
   * v89.6（老板：「探索性和趣味性」）：见闻录 —— 奇遇图鉴
   * ------------------------------------------------------------
   * 三档分组（逸闻 / 奇珍 / 绝景）；未录者只留「？？？」剪影；
   * 已现形未探的点位列「待探线索」，带「前往」（回地图居中赴线索）。
   * ============================================================ */
  ui.openJournal = function () {
    /* v89.105：见闻/日志三段网格实测 774px —— 默认档(620)装不下，xxl(800) 才够 */
    ui.openModal(ui.journalHTML(), { size: 'xxl' });
  };
  ui.journalHTML = function () {
    var ws = GAME.wonderState ? GAME.wonderState() : { r: {}, d: {}, j: {} };
    var all = DATA.WONDERS || {};
    var ids = Object.keys(all);
    var got = ids.filter(function (id) { return ws.j[id]; }).length;
    var sites = GAME.wonderSites ? GAME.wonderSites() : [];
    var pending = [];
    var known = 0;
    sites.forEach(function (it) {
      var k = it.x + ',' + it.y;
      if (ws.d[k]) known++;
      else if (ws.r[k]) { known++; pending.push(it); }
    });
    pending.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    var h = '<div class="gold-heading">📜 见闻录 · 天下奇遇</div>';
    h += '<div class="jnl-stat">奇遇点位 <b>' + sites.length + '</b> 处　·　已知 <b>' + known +
      '</b>　未探 <b>' + pending.length + '</b>　·　已录见闻 <b>' + got + ' / ' + ids.length + '</b></div>';
    h += '<div class="jnl-sec">✦ 待探线索</div>';
    if (pending.length) {
      h += '<div class="jnl-list">';
      pending.slice(0, 10).forEach(function (it) {
        h += '<div class="jnl-row"><span class="jnl-nm">' + it.x + ',' + it.y + ' · ' +
          GAME.wonderBandName(it.band) + '</span>' +
          '<button class="btn sm wnr-btn" data-action="journal-go" data-x="' + it.x + '" data-y="' + it.y + '">前往</button></div>';
      });
      h += '</div>';
    } else {
      h += '<div class="jnl-empty">暂无线索 —— 江湖诸事走完，或可闻得异迹</div>';
    }
    ['small', 'rare', 'epic'].forEach(function (t) {
      var list = ids.filter(function (id) { return (all[id] || {}).tier === t; });
      var g2 = list.filter(function (id) { return ws.j[id]; }).length;
      h += '<div class="jnl-sec">' + GAME.wonderTierName(t) + '（' + g2 + '/' + list.length + '）</div><div class="jnl-grid">';
      list.forEach(function (id) {
        var w = all[id] || {};
        var has = !!ws.j[id];
        h += '<div class="jnl-card' + (has ? ' has' : '') + '">' +
          '<span class="jnl-ic">' + (has ? w.ic : '？') + '</span>' +
          '<span class="jnl-nm">' + (has ? U.escape(w.name) : '？？？') + '</span>' +
          '<span class="jnl-txt">' + (has ? U.escape(w.txt || '') : '未录 · 江湖之行或可闻得') + '</span>' +
          '</div>';
      });
      h += '</div>';
    });
    h += '<div class="modal-foot"><button class="btn" data-action="close-modal">合上册子</button></div>';
    return h;
  };

  /* ============================================================
   * v89.154（老板 3）：附属野地**显示排序**（唯一出口）
   * ------------------------------------------------------------
   * 老板原话：「附属野地界面，有采集的野地排序最上方，有驻军的接着，
   *   无驻军的野地按地形，等级（高到低）排序」。
   * 三档：① 采集中（gatherAt 非空）→ ② 有驻军（wildGarrisonTotal > 0）
   *       → ③ 其余：地形（DATA.TERRAIN 表序）→ 同地形按等级**降序**。
   * 读的两处（资源区下拉框 / 附属野地面板）**同用本出口** ——
   * ui._wildSel 是"显示序下标"，两处顺序不一致时「进入」高亮会指错行。
   * 只排显示副本（slice），不改 s.wilds 本身（占领先后是数据，显示序是视图）。
   * ============================================================ */
  ui.wildSortedOf = function (wilds) {
    var tOrder = {};
    Object.keys(DATA.TERRAIN).forEach(function (k, i) { tOrder[k] = i; });
    var prioOf = function (w) {
      if (GAME.gatherAt(w.x, w.y)) return 0;                                   /* ① 采集中 */
      if (GAME.wildGarrisonTotal(GAME.wildGarrisonAt(w.x, w.y)) > 0) return 1; /* ② 有驻军 */
      return 2;
    };
    /* 先算一次优先级（sort 比较函数会被调 O(n log n) 次，别在里面反复查表） */
    var list = (wilds || []).map(function (w) {
      return { w: w, p: prioOf(w) };
    });
    list.sort(function (a, b) {
      if (a.p !== b.p) return a.p - b.p;
      if (a.p === 2) {
        var ta = tOrder[a.w.type] == null ? 99 : tOrder[a.w.type];
        var tb = tOrder[b.w.type] == null ? 99 : tOrder[b.w.type];
        if (ta !== tb) return ta - tb;                       /* 地形（表序）为主键 */
        if ((b.w.level || 0) !== (a.w.level || 0)) return (b.w.level || 0) - (a.w.level || 0);
      }
      return 0;                                              /* 稳定：同档保持原序 */
    });
    return list.map(function (x) { return x.w; });
  };

  /* ============================================================
   * v89.155（老板 2）：野地「召回驻军」按钮的**唯一渲染出口**（三态）
   * ------------------------------------------------------------
   * 老板原话：「召回军队时，第一次点击变黄色，第二次点击执行召回并变回无驻军的绿色，
   *   2 秒内无点击则返回红色（己方野地界面的召回驻军同步调整，就不要显示一大段说明
   *   或者文字弹窗了）。召回后不要弹窗己方小野地界面，直接执行召回即可」。
   * 三态：无驻军 = 绿（disabled）；有驻军 = 红；已上膛（_wdArm138 命中本坐标）= 黄。
   * 两处消费（附属野地操作列 / 地块面板「地块操作」）**同读本出口** ——
   * live 逐秒重绘时按钮按状态重建（上膛的黄色不会被每秒重绘冲掉）。
   * `data-lbl` 存原始文案（wdRepaint 重绘时回传，列表"🏳️ 召回"与地块"🏳️ 召回驻军"各保持）。
   * ============================================================ */
  ui.WD_LABELS = { w: '🏳️ 召回', g: '🏳️ 召回驻军' };   /* 两种场景的基础文案（w=野地列表 / g=地块面板） */
  ui.wildWdBtnHTML = function (x, y, opts) {
    opts = opts || {};
    var hasGar = (opts.hasGar != null) ? opts.hasGar
      : GAME.wildGarrisonTotal(GAME.wildGarrisonAt(x, y)) > 0;
    var armed = hasGar && ui._wdArm138 === (x + ',' + y);
    var sz = opts.xs ? ' xs' : '';
    var mode = (opts.lblMode === 'g') ? 'g' : 'w';
    var lbl = ui.WD_LABELS[mode];
    if (!hasGar) {
      return '<button class="btn' + sz + ' green" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
        '" data-lblmode="' + mode + '" disabled title="该野地没有驻军">' + lbl + '</button>';
    }
    return '<button class="btn' + sz + (armed ? ' gold' : ' red') + '" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
      '" data-lblmode="' + mode + '" title="' + (armed ? '再点一次执行（2 秒内有效）' : '撤回驻军（将领随军回城）—— 连点两次执行') + '">' +
      (armed ? '⚠️ 再点一次' : lbl) + '</button>';
  };
  /* 上膛/回落的**就地重绘**（唯一出口）—— 点击与 2 秒超时都调它；
     按坐标找当前屏幕上的召回按钮（列表 / 地块面板同屏至多一处），用同一渲染出口重建。
     桩环境（无 querySelectorAll）自动跳过 —— 不影响测试口径。 */
  ui.wdRepaint = function (x, y) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var root = null;
    try { root = document.getElementById('modal-root') || document.body; } catch (e) { return; }
    if (!root || !root.querySelectorAll) return;
    var btns = root.querySelectorAll('[data-action="wild-withdraw"]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!b.dataset || Number(b.dataset.x) !== Number(x) || Number(b.dataset.y) !== Number(y)) continue;
      b.outerHTML = ui.wildWdBtnHTML(x, y, {
        xs: !!(b.classList && b.classList.contains('xs')),
        lblMode: b.dataset.lblmode || 'w'
      });
    }
  };

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {
    var s = GAME.state;
    /* v89.154（老板 3）：显示序 = wildSortedOf（采集/驻军/地形+等级） */
    var wilds = ui.wildSortedOf(s.wilds);
    var RES_NAME = ui.RES_NAME, RES_ICON = ui.RES_ICON;

    /* 野地对各类资源的贡献折算（用总产量反推：贡献 = 总产 × m/(1+m)） */
    var prod = GAME.productionPerSec();
    var wm = (GAME.wildMult && GAME.wildMult()) || {};
    var contrib = {};
    DATA.RES_ORDER.forEach(function (k) {   /* v89.134：读 DATA.RES_ORDER */
      var m = wm[k] || 0;
      contrib[k] = m > 0 ? prod[k] * m / (1 + m) * 3600 / GAME.timeScale() : 0;
    });

    /* v89.112（老板：条目过多的分页）：30 片野地平铺 = 675px 溢出。
       改 xxl 档 + 弹窗内翻页（每页 13 行；分页条走 mpage → 重开本弹窗）。 */
    var pgW = ui.modalPage('wilds', wilds, 13, function () { ui.openWilds(); });
    var rows = pgW.slice.map(function (w, wi) {
      var t = DATA.TERRAIN[w.type];
      var addStr = '—', resStr = '—';
      var ga = GAME.gatherAt(w.x, w.y);
      if (ga) {
        var gy = GAME.gatherYield(ga);
        addStr = '采集中 ' + gy.pct + '%';
      } else if (t && t.add) {
        /* v15：加成按「每级 × 等级」线性计算 */
        var add = GAME.wildAddOf(w.type, w.level) || {};
        var parts = [], names = [];
        for (var r in add) {
          parts.push(RES_ICON[r] + RES_NAME[r] + ' +' + Math.round(add[r] * 100) + '%');
          names.push(RES_NAME[r]);
        }
        addStr = parts.join(' ');
        resStr = names.join('/');
      }
      /* ============================================================
       * v89.137（老板 6）：「进入附属野地界面，上边对各野地分别同步增加操作列，
       *   设置派驻，采集，收获，召回按钮」——
       *   · 派驻 → 出征界面（station · 与地块/军务同一条唯一入口）
       *   · 采集 → 原地开工（须驻军**有将**；已在采集中则禁用）
       *   · 收获 → 满 1 小时方可（判据与 gather-finish 同源：gatherYield().ready）
       *   · 召回 → 撤回驻军（将领随军回城）
       * 禁用态一律**写清原因**（悬停），不做"点了才报错"。
       * ============================================================ */
      var _hasGar137 = GAME.wildGarrisonTotal(w.garrison) > 0;
      var _hasGen137 = !!(w.garrison && w.garrison.genId);
      var _gy137 = ga ? GAME.gatherYield(ga) : null;
      /* v89.138（清单②）：操作列走 flex + wrap —— 4 颗刚好一行；将来加第 5 颗会自动换行，
         不会把"加成/采集"列挤没（列宽兜底写进 CSS `.wild-ops`）。 */
      var _opsCell = '<td class="ctr wild-ops">' +
        '<button class="btn xs" data-action="wild-garrison-open" data-x="' + w.x + '" data-y="' + w.y +
          '" title="派驻 / 增派驻军 —— 走出征界面（驻守·增援）">🛡️ 派驻</button> ' +
        ((_hasGen137 && !ga)
          ? '<button class="btn xs gold" data-action="wild-garrison-gather" data-x="' + w.x + '" data-y="' + w.y +
            '" title="驻军原地开工开采（不抽兵）">⛏️ 采集</button>'
          : '<button class="btn xs" data-action="wild-garrison-gather" disabled title="' +
            (_hasGar137 ? (ga ? '已在采集中' : '驻军须有将领带队（派驻时选一位将领补驻）') : '先派驻军（首次须带将）')
            + '">⛏️ 采集</button>') + ' ' +
        ((_gy137 && _gy137.ready)
          ? '<button class="btn xs gold" data-action="gather-finish" data-id="' + ga.id + '" title="收成入城">📦 收获</button>'
          : '<button class="btn xs" data-action="gather-finish" disabled title="满 1 小时方可收获">📦 收获</button>') + ' ' +
        /* v89.155（老板 2）：三态按钮（红→黄→绿）走唯一出口；上膛态进 live 渲染 */
        ui.wildWdBtnHTML(w.x, w.y, { xs: true, hasGar: _hasGar137 }) +
        /* v89.154（老板 1）：「附属野地界面，操作栏中增加一个放弃野地按钮，按钮应该采用防误触设计」——
           防误触三层（v89.156 收敛）：① 红色 + 与正向动作留间距（.wild-drop，可换行分组）
           ② 只触发二次确认窗（wild-abandon-ask，绝不一键执行）
           ③ 确认窗明写「不可撤销」+ 逐项列出失去/撤回什么，窗内红键**一击执行**
              （v89.156 老板：「本身已经是 2 次确认了」—— 上膛式退役）。 */
        '<button class="btn xs red wild-drop" data-action="wild-abandon-ask" data-x="' + w.x + '" data-y="' + w.y +
          '" title="放弃该野地 —— 需二次确认，且不可撤销（驻军与采集队会先撤回城内）">🗑️ 放弃</button>' +
        '</td>';
      /* v89.140（老板 8）：「附属野地界面，在**操作列的左边**增加一列将领和一列驻军，
         分别显示将领和军队总数」——驻军将领走 wildGarrisonAt().genId（唯一来源），
         数量走 wildGarrisonTotal（与地块界面/军务同源）。 */
      var _garW = GAME.wildGarrisonAt(w.x, w.y);
      var _garN = GAME.wildGarrisonTotal(_garW);
      var _genW = null;
      if (_garW && _garW.genId) {
        (s.generals || []).forEach(function (g0) { if (g0.id === _garW.genId) _genW = g0; });
      }
      return '<tr' + ((pgW.from + wi) === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td>' +
        '<td class="ctr">' + (_genW ? U.escape(_genW.name) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        '<td class="num">' + (_garN > 0 ? U.fmt(_garN) : '<span style="color:var(--text-dim);">—</span>') + '</td>' +
        _opsCell + '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">尚未占领野地（在地图点击野地格派兵占领）</td></tr>';

    /* 野地合计贡献 */
    var totalLine = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var v = contrib[k];
      return '<span class="wild-res">' + RES_ICON[k] + RES_NAME[k] +
        ' <b>' + (v > 0 ? '+' + U.fmt(v) : '0') + '</b>/时</span>';
    }).join('');

    var cap = GAME.buildingLevel(GAME.currentCity(), 'guanfu') || 1;
    var sky = GAME.story ? GAME.story.skyLine() : '';
    ui.openModal(
      '<div class="gold-heading">🏕️ 附属野地（' + wilds.length + '/' + cap + '）</div>' +
      (sky ? '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' + sky + '</div>' : '') +
      /* v89.140（老板 8）：表头补「将领」「驻军」两列（与数据行同列数——
         第一版只加了单元格忘了表头，实机判据当场抓出） */
      '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th><th>产出资源</th><th>加成 / 采集</th>' +
        '<th class="ctr">将领</th><th class="num">驻军</th><th class="ctr">操作</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      /* v89.112：分页条（>1 页才出按钮；单页只显示"共 N 项"） */
      (wilds.length > 13 ? pgW.pager : '') +
      '<div class="wild-total"><span style="color:var(--text-dim);font-size:var(--fs-sub);">野地贡献合计</span>' + totalLine + '</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.136（清单①）：live 逐秒刷新（产量加成/等级衰减随日推进实时） */
      { size: 'xxl', live: function () { ui.openWilds(); } }
    );
  };


  /* 商城弹窗（原版右下功能入口） */
  /* ============================================================
   * 商城（v18 重制）
   * 旧版把 73 件商品一次性铺成一长条 —— 弹窗里要滚很久才能看到底，
   * 与"附属窗口固定大小"的要求冲突。改为：
   *   · 顶部分类页签（每类显示件数）
   *   · 固定 2 列 × 8 行网格（每页 16 件，不足则留白，尺寸不跳）
   *   · 底部分页条
   * ============================================================ */
  ui._shopCat = null;
  ui.SHOP_PER_PAGE = 16;
  ui.SHOP_CATS = {
    material: '材料', jewel: '珠宝', attr_buff: '符类', prod_buff: '生产',
    military_buff: '军事', boost: '加速', exp: '经验', stamina: '体力',
    perm: '丹药', mount_buff: '坐骑', blueprint: '图纸',
    /* v77（老板「丰富商场道具」）：宝箱 / 内功秘籍 / 政令（徭役令）三类新货 */
    chest: '宝箱', neigong: '秘籍', corvee: '政令',
    /* v86（老板「按计划进行」· G1）：锦囊 —— 施展计谋所需 */
    talis: '锦囊',
    /* v89.51（老板「别买了用不了」）：营造 —— 工事图/营造方略一类。
       此前该类型不在任何页签里 → 有 price 却渲染不出来（玩家看不见也买不到）。 */
    build_cost: '营造',
    /* v89.87（老板拍板 · 需求 1）：**种子开售** —— 配合"就地快购全覆盖"。
       v78 曾定"种子不售、仅采集/征战产出"；本批按最新拍板开售（价格早已在表中）。 */
    seed: '种子',
    /* v89.99（老板「增加道具如增民令」）：民生 —— 人口类道具。 */
    pop_boost: '民生',
    /* v89.121（全生命周期模拟抓出的断链）：**移民令此前没有页签** ——
       它有价（120 元宝）、无 noShop 标记，但「在售 == 有页签」（v89.51 的判据）下
       **商城与快购都渲染不出来** → 有定价却永远买不到（"半上架"）。
       并入「民生」页签（与增民令同族）后：商城可见、可比价。 */
    pop_fill: '民生',
    /* v89.131（老板「体力精力应当设计加号按钮，供道具使用」）：
       精力族（清心丸/提神散/养神丹/凝神玉露）—— 新 type 'energy'，
       **在售 == 有页签**（v89.51 判据）：漏了这行就是"半上架"（有价却渲染不出来）。 */
    energy: '精力',
  };
  /* v89.51：**在售 == 有页签**（唯一判据）。
     改前只按 `price > 0` 收件 —— 「有价但不在任何页签」的类型（营造/种子/灵草）
     会静默消失：数据以为上架了，玩家永远看不见。
     现在把规则钉死：想上架 → 先进 SHOP_CATS；不想卖（种子/灵草，price 仅供背包「估值」）
     自然被排除，不会再出现"半上架"状态。 */
  /* ============================================================
   * v89.155（老板 4）：商品/背包的**内置排序标号**（不显示）
   * ------------------------------------------------------------
   * 老板原话：「改变商品排序规则，同功能商品按其功能由小到大相邻排序。
   *   建议内置一套通用性强的内置排序标号（不直接显示在商品或背包界面）」。
   * 口径：标号 = 功能族 × 1000 + 族内强度档（0~999）——
   *   · 功能族 = 效果维度（eff 的键；产量宝物的维度在 `res` 字段）；
   *     同族商品必然相邻（例：攻击四鼓 atk 0.10/0.15/0.25/0.35 连排升序）；
   *   · 族内档位 = 效果值 ×1000；无效果的商品（珠宝/图纸/加速…）用 price 当档位；
   *   · 想手动指定顺序：在物品上写 `ord`（数字）→ 直接生效（覆盖派生）。
   * 消费点三处（同读本出口）：商城营业顺序 / 背包宝物页组内顺序 / 快购列表。
   * ⚠️ 下表值 = **基族号**：实际族号 = 基族 × 10（单键/单值）或 × 10 + 1（复合变体）。
   * ============================================================ */
  ui.ITEM_FAM = {
    /* 军事 buff：按效果维度分族 */
    atk: 101, def: 102, wound: 103, cap: 104,
    /* 属性符：按四维/速度分族 */
    tong_mult: 201, yw_mult: 202, zm_mult: 203, nz_mult: 204, spd: 205,
    /* 产量宝物：按资源维度分族（itemFamOf 用 'res_' 前缀查表） */
    res_grain: 301, res_wood: 302, res_stone: 303, res_iron: 304, res_gold: 305,
    /* 建造减耗：单族 */
    build: 401
  };
  ui.ITEM_TYPE_FAM = {
    jewel: 501, talis: 502, boost: 503, exp: 504, stamina: 505, energy: 506, chest: 507,
    neigong: 508, perm: 509, rank_up: 510, seed: 511, mount_buff: 512, corvee: 513,
    essence: 514, pop_boost: 515, pop_fill: 516, material: 517, blueprint: 518
  };
  ui.itemFamOf = function (it) {
    if (!it) return 9990;
    if (it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      /* v89.155：**复合效果（多键）归"首键的复合变体族"**（基族 × 10 + 1）——
         "同功能相邻"的精确含义 = 功能组合相同者才相邻：
         否则"攻守符（攻+防）"会插进纯攻击四鼓中间把它们劈开（本段注释来自实测抓出）。
         复合件在变体族内按首键值升序（攻守符 15% → 全军令/万全策 20% → 天时令 30%）。 */
      if (ks.length > 1) {
        var f0 = ui.ITEM_FAM[ks[0]];
        if (f0 != null) return f0 * 10 + 1;
      }
      for (var i = 0; i < ks.length; i++) if (ui.ITEM_FAM[ks[i]] != null) return ui.ITEM_FAM[ks[i]] * 10;
    }
    if (it.res && ui.ITEM_FAM['res_' + it.res] != null) return ui.ITEM_FAM['res_' + it.res] * 10;
    if (it.type === 'build_cost') return ui.ITEM_FAM.build * 10;
    if (ui.ITEM_TYPE_FAM[it.type] != null) return ui.ITEM_TYPE_FAM[it.type] * 10;
    return 9000;                                  /* 未知新类型：统一殿后（族内按 price） */
  };
  ui.itemPowOf = function (it) {
    var v = null;
    if (it && it.eff && typeof it.eff === 'object') {
      var ks = Object.keys(it.eff);
      if (ks.length) v = Math.abs(Number(it.eff[ks[0]]) || 0);
    } else if (it && typeof it.eff === 'number') v = Math.abs(it.eff);
    if (v == null) v = ((it && it.price) || 0) / 1000;      /* 无效果 → 价格当档位 */
    return Math.max(0, Math.min(999, Math.round(v * 1000)));
  };
  ui.itemOrdOf = function (it) {
    if (it && typeof it.ord === 'number') return it.ord;    /* 手写标号优先 */
    return ui.itemFamOf(it) * 1000 + ui.itemPowOf(it);
  };

  ui.shopItems = function () {
    /* v89.104（老板「商场同类产品档次太多了…最多分 4 档」）：
       `noShop: true` 的档位**不上架** —— 这里是唯一过滤口，商城页与快购都读它。
       v89.121（老板拍板「承认绝版」）：下架 = 停止产出（掉落/任务/炼制亦不给），
       仅老存档已持有的可用；详见 data.js「宝物」段头。 */
    return DATA.ITEMS.filter(function (it) {
      /* v89.179：dropOnly 的宝物（pct ≥ 0.5 的高阶加速）只走采集/战役掉落，
         不上架商城（也不进快购）—— 与 noShop 不同：noShop 是"全网下架且不产出"，
         dropOnly 是"商城不卖但可掉落"（老板「移出商城，改采集/战役掉落」）。 */
      return it.price > 0 && !it.noShop && !it.dropOnly && !!ui.SHOP_CATS[it.type];
    });
  };
  /* ============================================================
   * 快购（v89.87 · 老板需求 1）：消耗点就地直购
   * ------------------------------------------------------------
   * 老板原话：「在消耗宝物的地方提供按钮，可以直接购物，避免每次都去商城」。
   * 两种形态：
   *   · openQuickBuy(itemId, need, back) —— 单物品（材料/图纸/锦囊/种子），
   *     默认数量 = 缺口；back 是"购买成功后重开的来源面板"回调。
   *   · openQuickCat(cat) —— 整类快购（加速宝物等多种同类选购）。
   * 购买走商城的**同一出口 GAME.doShopping** —— 价格/校验/扣款/日志完全一致，
   * 不存在"快购价"与"商城价"两套。种子页签同步开售（ui.SHOP_CATS）。
   * ============================================================ */
  ui._qbItem = null; ui._qbBack = null;
  /* 快购贴图：材料/图纸走各自专用画法，其余走宝物画法 */
  ui.qbArt = function (it) {
    var k = (it.type === 'material') ? 'mat' : (it.type === 'blueprint' ? 'bp' : 'qb-item');
    return ui.itemArt(k, it.id, 1);
  };
  ui.openQuickBuy = function (itemId, need, back) {
    var it = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) it = x; });
    if (!it || !it.price) { ui.toast('该物品暂不可购买（仅产出获得）'); return; }
    /* v89.121（老板「承认绝版」）：下架档 = 绝版 —— 商城页本就不列，
       这里把"就地快购"也堵上（noShop 必须在**所有购买口**生效）。 */
    if (it.noShop) { ui.toast('「' + it.name + '」已下架（绝版），不再出售 —— 仅旧藏可用'); return; }
    ui._qbItem = itemId;
    ui._qbBack = back || null;
    var have = (GAME.state.items || {})[itemId] || 0;
    var gap = Math.max(1, (need || 1) - have);
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape(it.name) + '</div>' +
      '<div class="item-row" style="border:none;">' +
        '<div class="ir-art">' + ui.qbArt(it) + '</div>' +
        '<div class="ir-info">' +
          '<div class="ir-name">' + U.escape(it.name) + '</div>' +
          '<div class="ir-meta">单价 ' + U.numText(it.price * 100, 0) + ' 金　·　持有 ' + have +
            '　·　需求 ' + (need || 1) + '（缺 ' + gap + '）</div>' +
          (it.desc ? '<div class="ir-desc">' + U.escape(it.desc) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ui-sub" style="margin-top:4px;">购买数量</div>' +
      ui.qtyInput('qb-qty', gap, it.price * 100, 9999) +
      '<div class="ir-total" id="qb-qty-total" data-label="合计" style="text-align:right;color:var(--gold-light);"></div>' +
      '<div class="op-hint" style="margin-top:4px;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0) + '</div>' +
      '<div class="m-foot"><button class="btn gold" data-action="qb-buy">购买</button>' +
      '<button class="btn" data-action="close-modal">取消</button></div>');
  };
  /* v89.116（老板「快购没有针对性，我加速兵种招募的怎么还买到缩短建造、行军什么的」）
     —— **病根**：`boost` 类里混装了研究 / 建造 / 训练 / 行军 / 市场五种用途的宝物，
     快购却整类端上来（点"购买加速宝物"给的是**全部加速宝物**）。
     口径：调用点必须声明**用途**（= `DATA.ITEMS[].target`，与"背包里可用于加速募兵的宝物"
     `S.trainBoostItems` 同一字段），快购只列该用途的；
     另给一个「看全部加速宝物」的显式入口 —— 想通买的人有路，但不能默认塞给玩家。 */
  ui.QB_SCOPE_CN = { research: '研究', build: '建造', train: '募兵训练', march: '行军', trade: '市场交易' };
  ui.qbScopeItemsOf = function (cat, scope) {
    return (DATA.ITEMS || []).filter(function (x) {
      if (!(x.price > 0) || x.type !== cat) return false;
      if (x.noShop) return false;    /* v89.121：快购列表与商城同口径（下架=绝版，不列） */
      /* v89.179（老板「高阶比例道具移出商城」）：dropOnly 的高阶加速宝物（pct ≥ 0.5）
         与商城同口径 —— 快购也不卖，只能在采集 / 战役里掉（GAME.grantBoostDrop）。 */
      if (x.dropOnly) return false;
      if (scope && x.target !== scope) return false;
      return true;
    }).sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });   /* v89.155：与商城同一标号 */
  };
  ui.openQuickCat = function (cat, scope) {
    var list = ui.qbScopeItemsOf(cat, scope);
    if (!list.length) {
      ui.toast(scope ? ('该用途暂无可购之物（' + (ui.QB_SCOPE_CN[scope] || scope) + '）') : '该类别暂无可购之物');
      return;
    }
    var rows = list.map(function (it) {
      var have = (GAME.state.items || {})[it.id] || 0;
      return '<div class="xc-row">' +
        '<div class="xc-ico">' + ui.qbArt(it) + '</div>' +
        '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + have + '</b>' +
          '<span class="xc-prod">' + U.numText(it.price * 100, 0) + ' 金 · ' + U.escape(it.desc || '') + '</span></div>' +
        '<input type="number" id="qbq-' + it.id + '" min="1" value="1" style="width:64px;padding:4px;' +
          'background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm gold" data-action="qb-cat-buy" data-item="' + it.id + '" data-cat="' + cat + '" data-scope="' + (scope || '') + '">买入</button>' +
        '</div>';
    }).join('');
    var scopeCn = scope ? (ui.QB_SCOPE_CN[scope] || scope) : '';
    var allN = ui.qbScopeItemsOf(cat, null).length;
    ui.openModal(
      '<div class="gold-heading">🛒 快购 · ' + U.escape((ui.SHOP_CATS && ui.SHOP_CATS[cat]) || cat)
        + (scopeCn ? '（' + scopeCn + '专用）' : '') + '</div>' +
      '<div class="ui-sub" style="text-align:center;">现有黄金 ' + U.numText(GAME.state.res.gold || 0, 0)
        + (scope ? '　·　此处只列<b>' + scopeCn + '</b>用途的宝物（共 ' + list.length + ' / ' + allN + ' 种）' : '') + '</div>' +
      '<div class="modal-scroll">' + rows + '</div>' +   /* v89.112：撤内联 440px 上限 */
      '<div class="m-foot">' +
        (scope ? '<button class="btn" data-action="qb-cat" data-cat="' + cat + '">看全部加速宝物</button>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>');
  };

  /* v89.121：页签分组（按**显示名**聚合 —— 多个 type 可共享一页，
     如「民生」= pop_boost + pop_fill；key 取组内第一个 type，`_shopCat` 语义不变）。 */
  ui.shopCatOf = function (all) {
    var seen = {}, out = [];
    Object.keys(ui.SHOP_CATS).forEach(function (tp) {
      if (!all.some(function (it) { return it.type === tp; })) return;
      var nm = ui.SHOP_CATS[tp];
      if (seen[nm]) { seen[nm].types.push(tp); return; }
      var g = { key: tp, name: nm, types: [tp] };
      seen[nm] = g;
      out.push(g);
    });
    return out;
  };
  /* 组内任一 type → 组的 key（老调用点全传 type；找不到返回 null） */
  ui.shopCatKey = function (c) {
    if (!c) return null;
    var cats = ui.shopCatOf(ui.shopItems());
    for (var i = 0; i < cats.length; i++) if (cats[i].types.indexOf(c) >= 0) return cats[i].key;
    return null;
  };
  ui.openShop = function (cat) {
    var cats = ui.shopCatOf(ui.shopItems());
    ui._shopCat = ui.shopCatKey(cat) || ui.shopCatKey(ui._shopCat) || (cats[0] ? cats[0].key : 'material');
    ui._pages['shop-items'] = 1;
    ui.setView('shop');
  };
  ui.renderShop = function () {
    if (ui.view !== 'shop') return;
    ui.repaintView(function () { return ui.shopHTML(); });
  };
  ui.setShopCat = function (c) { ui._shopCat = c; ui._pages['shop-items'] = 1; ui.renderShop(); };

  /* ============================================================
   * 物品贴图（v29 · 需求 14：「图标整好看一点」）
   * ------------------------------------------------------------
   * 改前是**光秃秃一枚图标**直接贴在卡片上：不同品阶看不出差别，
   * 24 个材料格子看上去像同一批小方块。
   * 现在统一加一层「贴图承台」：
   *   · 品阶底纹（凡/良/珍/神 四档渐变，与装备品质色一致）
   *   · 内高光 + 外投影，把图标从背景里"抬"起来
   *   · 右下角品阶珠（1~4 颗），远看就能分档
   * 图标本身仍由 icons.js 手绘 SVG 提供 —— 这里只做承台，不重画图形。
   * ============================================================ */
  ui.itemArt = function (kind, id, q) {
    var svg = '', slot = null, icoType = null, matId = null;
    if (kind === 'equip') {
      var e = DATA.EQUIP[id];
      slot = e && e.slot;
      svg = (GAME.icons.forEquip && slot) ? GAME.icons.forEquip(slot) : '';
    } else if (kind === 'mat') {
      matId = id;
      svg = (GAME.icons.forMat ? GAME.icons.forMat(matId) : '') || '';
    } else if (kind === 'bp') {
      icoType = 'blueprint';
      svg = (GAME.icons.forItem ? GAME.icons.forItem('blueprint', id) : '') || '';
    } else {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      icoType = it ? it.type : 'jewel';
      svg = (GAME.icons.forItem ? GAME.icons.forItem(icoType, id) : '') || '';
    }
    var qq = Math.max(1, Math.min(6, q || 1));   /* v88：修炼装备品质到 6（军装 q<=4 不受影响） */
    /* 材料自带品阶珠（icons.js 里已画），不再重复叠一层 */
    var gems = (kind === 'mat') ? '' : new Array(qq + 1).join('<i></i>');
    return '<span class="ia q' + qq + '">' +
      '<span class="ia-art">' + svg + '</span>' +
      '<span class="ia-gem">' + gems + '</span></span>';
  };

  /* ============================================================
   * 物品行（v29 · 需求 14）
   * ------------------------------------------------------------
   * 商城与背包共用：**左侧贴图 · 右侧介绍 · 下方操作栏**
   * （左＝数量输入框 + −/＋/最多；右＝主操作按钮）。
   * 数量输入框是"带加减号的输入框"：既能一键微调，也能直接键入大数，
   * 不像一堆固定档位的 chip 那样"想买 37 个就只能买 50 个"。
   * ============================================================ */
  ui.itemRow = function (o) {
    /* v89.117：可选**整行点选**（铁匠铺把"逐卡打造键"收成"选一件 + 底部一个键"）——
       只有传了 pickAction 才挂 data-action，既有调用点不受影响。 */
    var pick = o.pickAction ? ' data-action="' + o.pickAction + '" data-item="' + o.pickItem + '"' : '';
    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + (o.sel ? ' on' : '') + '"' + pick + '>' +
      '<div class="ir-art">' + ui.itemArt(o.kind, o.id, o.q) + '</div>' +
      /* v89.140（老板 6）：「物品简介改**悬停显示**」——hoverDesc 时 desc 走 title
         （卡片内不再占一行 → 卡片等高、位置固定）。 */
      '<div class="ir-info"' + ((o.hoverDesc && o.desc)
        ? ' title="' + U.escape(String(o.desc).replace(/<[^>]+>/g, '')) + '"' : '') + '>' +
        '<div class="ir-name">' + o.name + (o.tagHtml || '') + '</div>' +
        '<div class="ir-meta">' + (o.meta || '') + '</div>' +
        ((!o.hoverDesc && o.desc) ? '<div class="ir-desc">' + o.desc + '</div>' : '') +
      '</div>' +
      '<div class="ir-foot">' +
        '<div class="ir-left">' + (o.qtyHtml || '') + (o.totalHtml || '') + '</div>' +
        '<div class="ir-right">' + (o.actHtml || '') + '</div>' +
      '</div></div>';
  };
  /* 数量输入框 + 加减 + 最多（inputId 同时也是"合计"文本节点的前缀） */
  ui.qtyInput = function (inputId, init, unit, cap, noMax) {
    return '<span class="qty-input">' +
      '<button class="qi-btn" data-action="qty-step" data-for="' + inputId + '" data-d="-1">−</button>' +
      '<input type="number" id="' + inputId + '" min="1" value="' + init + '" ' +
        'data-unit="' + (unit || 0) + '" data-cap="' + (cap || 0) + '">' +
      '<button class="qi-btn" data-action="qty-step" data-for="' + inputId + '" data-d="1">＋</button>' +
      (noMax ? '' : '<button class="qi-btn max" data-action="qty-max" data-for="' + inputId + '">最多</button>') +
      '</span>';
  };
  /* 加减 / 最多：只改**输入框的值与合计文字**，不重绘 ——
     重绘会把玩家刚键入的数字清掉（募兵数量上踩过这个坑）。 */
  ui.qtyStep = function (el) {
    var id = el.getAttribute('data-for');
    var inp = document.getElementById(id);
    if (!inp) return;
    var d = Number(el.getAttribute('data-d')) || 0;
    inp.value = Math.max(1, Math.floor(Number(inp.value) || 1) + d);
    ui.qtySync(id);
  };
  ui.qtyMax = function (el) {
    var id = el.getAttribute('data-for');
    var inp = document.getElementById(id);
    if (!inp) return;
    inp.value = Math.max(1, Math.floor(Number(inp.getAttribute('data-cap')) || 1));
    ui.qtySync(id);
  };
  ui.qtySync = function (inputId) {
    var inp = document.getElementById(inputId);
    var tot = document.getElementById(inputId + '-total');
    if (!inp || !tot) return;
    var unit = Number(inp.getAttribute('data-unit')) || 0;
    var cap = Number(inp.getAttribute('data-cap')) || 0;
    var n = Math.max(1, Math.floor(Number(inp.value) || 1));
    if (cap > 0 && n > cap) { n = cap; inp.value = n; }
    tot.textContent = (tot.getAttribute('data-label') || '合计') + ' ' + U.numText(unit * n, 0) + ' 金';
  };
  /* 读某行的数量（实付/使用以**输入框当前值**为准） */
  ui.qtyValueOf = function (inputId) {
    var el = document.getElementById(inputId);
    return Math.max(1, Math.floor(Number(el && el.value) || 1));
  };

  /* ============================================================
   * 商城（v25 起为整页视图；v29 · 需求 14 换版式）
   * ------------------------------------------------------------
   * 版式由"竖卡 + 一颗按钮"改为**物品行**：左贴图 / 右介绍 / 下方操作栏。
   * 两列铺排、每页 8 行；分页条仍统一在屏幕下方的固定条里。
   * 每行自带数量输入框 —— 买几个就在那一行填，不必先选一个"全局数量"。
   * ============================================================ */
  ui.SHOP_COLS = 2;
  ui.shopQtyCapOf = function (it) {
    var unit = (it && it.price ? it.price : 0) * 100;
    if (unit <= 0) return 1;
    return Math.max(1, Math.floor((GAME.state.res.gold || 0) / unit));
  };
  ui.shopHTML = function () {
    var s = GAME.state;
    var all = ui.shopItems();
    var cats = ui.shopCatOf(all);
    var cat = ui._shopCat || (cats[0] && cats[0].key);
    /* v89.121：同一显示名下的多个 type 合并成一页（如「民生」= pop_boost + pop_fill）。
       `_shopCat` 的语义**保持 type**（组的 key = 该组第一个 type）——既有断言零改动。 */
    var cur = null;
    for (var ci = 0; ci < cats.length; ci++) {
      if (cats[ci].key === cat || cats[ci].types.indexOf(cat) >= 0) cur = cats[ci];
    }
    if (!cur) cur = cats[0] || { key: cat, name: ui.SHOP_CATS[cat] || cat, types: [cat] };
    /* v89.155（老板 4）：同功能相邻、由小到大（内置标号，不显示） */
    var items = all.filter(function (it) { return cur.types.indexOf(it.type) >= 0; })
      .sort(function (a, b) { return ui.itemOrdOf(a) - ui.itemOrdOf(b); });
    var per = ui.SHOP_PER_PAGE;
    var p = ui.pageOf('shop-items', items.length, per);
    var slice = items.slice(p.from, p.to);
    ui.pagerHTML('shop-items', items.length, per);

    var tabs = cats.map(function (g) {
      var n = all.filter(function (it) { return g.types.indexOf(it.type) >= 0; }).length;
      return '<span class="shop-cat' + (g.key === cur.key ? ' on' : '') + '" data-action="shop-cat" data-c="' + g.key + '">'
        + g.name + '<i>' + n + '</i></span>';
    }).join('');

    var rows = slice.map(function (it) {
      var price = it.price * 100;
      var cap = ui.shopQtyCapOf(it);
      var canBuy = (s.res.gold || 0) >= price;
      var have = (s.items || {})[it.id] || 0;
      var inputId = 'sq-' + it.id;
      return ui.itemRow({
        kind: 'item', id: it.id, q: 1,
        name: U.escape(it.name),
        /* v51：meta 只留两个不断变化的数 —— 单价与持有。
           删掉「分类名」（当前分类在标题和页签上都写着，卡内第三遍）与
           「可买 N」（老板点名：商城不显示可买数量；上限仍在，"最多"按钮照用）。 */
        meta: '单价 <b>' + U.numText(price, 0) + '</b> 金　持有 ' + U.numText(have, 0),
        desc: GAME.itemEffect(it) || '',
        hoverDesc: true,          /* v89.140（老板 6）：简介悬停显示（卡片固定高、位置固定） */
        /* v89.145（老板 1）：「购买数量那里不要**最多**这个功能 —— 总不能那点金币
           全买了同一件商品，日子还过不过了」。第 5 参 noMax=true → 不渲染「最多」键；
           −/＋ 与直接键入都在（数量上限 data-cap 仍守着 qtySync 的越界钳制）。 */
        qtyHtml: ui.qtyInput(inputId, 1, price, cap, true),
        totalHtml: '<span class="ir-total" id="' + inputId + '-total" data-label="合计">合计 ' +
          U.numText(price, 0) + ' 金</span>',
        actHtml: '<button class="btn' + (canBuy ? ' gold' : ' dim') + '" data-action="shop-buy" data-item="' + it.id + '"' +
          (canBuy ? '' : ' disabled') + '>购买</button>',
      });
    }).join('');

    /* v89.145（老板 1）：「不足 4 行时仍会下方留白 —— 要不要无论如何都撑满？」→ **撑满**。
       `shop-fill` 从"满页才挂"改成**恒定挂**：3 行 / 2 行 / 1 行的分类同样铺满可视区
       （行高按行数平分；窗口矮到 <116px/行 时物品区内部滚动，见 CSS）。
       v89.143 的"不满不硬拉"是旧口径 —— 本轮按老板拍板整条改掉。 */
    return '<div class="ui-page shop-page">' +
      '<div class="gold-heading">🛒 商城 · ' + (ui.SHOP_CATS[cat] || cat) +
        ui.help('每行左侧贴图、右侧说明；下方填数量（可点 −/＋ 微调，或直接键入）后点「购买」。\n' +
          '单价 = 元宝价 × 100 金；分页条固定在屏幕下方。') +
      '</div>' +
      '<div class="shop-cats">' + tabs + '</div>' +
      (rows ? '<div class="shop-rows shop-fill">' + rows + '</div>'
        : '<div class="q-empty">该分类暂无商品。</div>') +
      '</div>';
  };

  /* ============================================================
   * 铁匠铺 · 打造（v29 · 需求 12）
   * ------------------------------------------------------------
   * 改前：一个 48 件的长列表塞在弹窗里，每件一行小字 + 一颗按钮，
   *   品质、材料、图纸三种"能不能造"的原因挤在同一段文字里，
   *   而且**弹窗尺寸随品阶分页变化**，翻页时窗口会跳。
   * 改后照商城的样子重做：固定尺寸弹窗 + 品质点选 + 物品行
   *   （左贴图 / 右：部位·品质·属性·材料需求 / 下：数量 + 打造）。
   * ============================================================ */
  ui._forgeQ = 1;
  /* 每页件数：3 列 × 2 行（列数见 index.html 的 .forge-rows）。
     定 6 的依据是**弹窗正文的可视高度**，不是手感 —— 实测 lg(860×600) 下正文只有 433px，
     而底部「套装效果」表就要 105px，再加两行卡片必然溢出（改前溢出 576px，弹窗内出现滚动条）。
     换 xl(960×660) 后正文约 493px，2 行卡片 + 套装表 + 分页条刚好放得下。 */
  ui.FORGE_PER_PAGE = 6;
  /* 切品质 / 切类别 → **页码归零**。
     否则在"全部·3 页"里翻到第 3 页再切到只有 1 页的品质，会停在一个越界页上
     （ui.pageOf 只会把它夹到末页，夹完显示的是"最后一页"而不是第一页，读起来像丢了内容）。 */
  ui.setForgeQ = function (q) {
    ui._forgeQ = Number(q) || 1;
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* v89.117：点选一件（再按底部「打造」）—— 只重绘面板，不弹新窗（同级刷新） */
  ui.forgePick = function (itemId) {
    if (!itemId) return;
    ui._forgeSel = (ui._forgeSel === itemId) ? '' : String(itemId);
    ui.openForge();
  };
  /* v89.117：具体套装筛选（唯一出口：chips、断言都读它） */
  ui.setForgeSet = function (sid) {
    ui._forgeSet = String(sid || '');
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  ui.setForgeKind = function (k) {
    ui._forgeKind = (k === 'set' || k === 'solo') ? k : 'all';
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  /* 套装效果一览（打造界面底部）—— 数据全部来自 DATA.SETS，无第二份 */
  ui.forgeSetNote = function () {
    return '<div class="fsn-t">套装效果（同套件数达标即生效，逐档累计）</div>' +
      Object.keys(DATA.SETS).map(function (sk) {
        var d = DATA.SETS[sk];
        var tiers = Object.keys(d.eff).map(Number).sort(function (a, b) { return a - b; });
        return '<div class="fsn-row"><span class="fsn-name">' + d.name + '</span>' +
          '<span class="fsn-n">' + GAME.setPiecesOf(sk) + ' 件</span>' +
          '<span class="fsn-tiers">' + tiers.map(function (t) {
            return '<i>' + t + ' 件　' + d.bonus[t] + '</i>';
          }).join('') + '</span></div>';
      }).join('');
  };
  ui.forgeRow = function (f, lv) {
    var it = f.item;
    var qName = DATA.Q_NAME[f.q] || ('Q' + f.q);
    var slotName = DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot;
    /* 材料需求逐项列出，缺的标红 —— 一眼看出"差哪一味"，
       并顺带标出**这一味出自哪个州**、自己有没有据其州城 ——
       三/四阶材料是长线目标，玩家最常卡在"不知道去哪弄"。
       （这也是 ui.matSpecialtyStates 的消费点：此前它只被旧打造面板用过。） */
    var myStates = {};
    (GAME.state.cities || []).forEach(function (c) { if (c.state) myStates[c.state] = 1; });
    var matParts = Object.keys(f.mats || {}).map(function (mk) {
      var md = DATA.MATERIAL_BY_ID[mk];
      var have = (GAME.state.items || {})[mk] || 0;
      var need = f.mats[mk];
      var states = ui.matSpecialtyStates(mk);
      var src = '';
      if (states.length) {
        var held = states.filter(function (st) { return myStates[st]; });
        src = '（' + states.join('/') + '特产' +
          (held.length ? '　<b style="color:var(--green-ok);">已据' + held.join('/') + '</b>' : '') + '）';
      }
      /* v89.89（A4 · 100+ 轮实玩期待）：产地就地可查 + 点击跳转 ——
         悬停出完整产地说明（哪些州 / 是否已据 / 跳转指引）；🗺️ 一键定位产地
         （已据 → 自己的城；未据 → 州治，照 journal-go 时序）。 */
      var mtip = states.length
        ? ' data-tip="产地：' + states.join('、') + '（州城特产）' +
          (held.length ? '；已据 ' + held.join('、') : '；尚未据有 —— 点 🗺️ 定位该州') + '"'
        : '';
      var mgo = states.length
        ? '<span class="mat-go" data-action="mat-go" data-mat="' + mk +
          '" title="前往产地（州城）">🗺️</span>'
        : '';
      return '<span class="' + (have >= need ? '' : 'lack') + '"' + mtip + '>' +
        (md ? md.name : mk) + ' ' + have + '/' + need + src + mgo + '</span>';
    });
    var blockers = [];
    if (!f.tierOk) blockers.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[f.q - 1] || 7));
    if (!f.bpOk) blockers.push('缺图纸「' + (f.bp ? f.bp.name : '') + '」');
    if (!f.matsOk) blockers.push('材料不足');
    if (!GAME.canAfford(f.cost)) blockers.push('资材不足');
    var ok = !blockers.length;
    /* v89.87（老板需求 1）：缺什么就地可买（只在真缺时渲染 —— 不占常态高度） */
    var qbBtns = '';
    Object.keys(f.mats || {}).forEach(function (mk) {
      var have = (GAME.state.items || {})[mk] || 0, need2 = f.mats[mk];
      if (have < need2) {
        var mnm = DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk;
        qbBtns += '<button class="btn xs" data-action="qb-item" data-item="' + mk +
          '" data-need="' + (need2 - have) + '">🛒' + mnm + '×' + (need2 - have) + '</button> ';
      }
    });
    if (!f.bpOk && f.bp && f.bp.id) {
      qbBtns += '<button class="btn xs" data-action="qb-item" data-item="' + f.bp.id + '" data-need="1">🛒图纸×1</button>';
    }
    /* 打造是**一次一件**（套装件每件都要消耗一张图纸），所以这里不放数量框 ——
       放了反而会让人以为能一次造十个。数量框留给"买/用"这类可批量的事。 */
    return ui.itemRow({
      kind: 'equip', id: f.id, q: f.q,
      name: U.escape(it.name),
      tagHtml: '<span class="ir-tag">' + qName + '</span>' +
        (it.set && DATA.SETS[it.set]
          ? '<span class="ir-tag set">' + U.escape(DATA.SETS[it.set].name) + '</span>'
          : '<span class="ir-tag">散件</span>'),
      meta: slotName + '　' + U.escape(GAME.equipDesc(it) || '') +
        '<br>造价 ' + U.escape(GAME.costString(f.cost) || '—'),
      /* v51：卡片瘦身两处 —— 都是"同一条信息已有别的出处"，删掉不丢东西：
         ① meta 里原有一行「套装门槛 x/y/z 件」：套装的 tag 已标出套名，
            底部的「套装效果」表也逐档列了门槛与加成，这里第三遍；
         ② desc 原本**总是**两行（材料 ＋ 条件结论），其中"条件齐备，可以打造"
            只是复述按钮状态（可造时按钮是金色、不可造时是灰的且禁用）。
            改成**只在有阻塞时才写字**——缺料/缺图纸/资材不足这些"差什么"必须一眼看到，
            而"什么都不缺"不需要文字。
         两处合起来给每张卡省约 38px：208 → 170。这不是审美，是能否放下两行的硬数
         （正文 434px 里 2×208 = 416 差 1px 装不下，2×170 = 340 才有余量）。 */
      desc: '材料：' + (matParts.join('　') || '无') +
        (ok ? '' : '<br><span style="color:var(--red-light);">' + blockers.join('　') + '</span>') +
        (qbBtns ? '<br>' + qbBtns : ''),
      /* v89.117（老板「太多打造按钮了，统一成一个放在底部」）：
         逐卡「打造」键退役 —— 卡片改为**可点选**，底部只有一个打造键（动作名沿用
         `forge-item`，改从 `ui._forgeSel` 取件）。"点选"提示占位极小，
         而省下的是每张卡一整个按钮的高度。 */
      actHtml: '<span class="ir-pick">' + (ui._forgeSel === f.id ? '✔ 已选' : '点选') + '</span>',
      pickAction: 'forge-pick', pickItem: f.id, sel: (ui._forgeSel === f.id),
    });
  };
  ui.openForge = function () {
    var lv = GAME.forgeLevel();
    if (lv <= 0) {
      ui.openShell({
        title: '⚒️ 铁匠铺', size: 'sm',
        body: '<div class="q-empty">尚未建造铁匠铺。<br>在城内空地上建造「铁匠铺」后即可打造装备。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var maxQ = GAME.forgeMaxQ();
    var list = GAME.forgeList();
    var s = GAME.state;
    /* v38（需求 3）：先分「套装 / 散件」，再按品质分页 ——
       原先两者混在一张长单列里，挑一套要整页翻。 */
    var kind = ui._forgeKind || 'all';
    var isSet = function (f) { return !!(f.item && f.item.set); };
    var setsOnly = list.filter(isSet);
    var soloOnly = list.filter(function (f) { return !isSet(f); });
    var pool = kind === 'set' ? setsOnly : (kind === 'solo' ? soloOnly : list);
    /* v89.117（老板「上方的类别选择，再加一个具体套装，方便制作同一套装下的装备」）：
       按**套装 id** 再筛一道（只列这批可打造件里真出现的套装）。 */
    var setIdCur = ui._forgeSet || '';
    var setIdsInPool = [];
    setsOnly.forEach(function (f) {
      var sid = f.item.set;
      if (sid && setIdsInPool.indexOf(sid) < 0) setIdsInPool.push(sid);
    });
    if (setIdCur && setIdsInPool.indexOf(setIdCur) < 0) { setIdCur = ''; ui._forgeSet = ''; }
    if (kind === 'set' && setIdCur) pool = pool.filter(function (f) { return f.item.set === setIdCur; });
    var kindHtml = [['all', '全部', list.length], ['set', '套装', setsOnly.length], ['solo', '散件', soloOnly.length]]
      .map(function (k) {
        return '<span class="shop-cat' + (kind === k[0] ? ' on' : '') +
          '" data-action="forge-kind" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');
    var setRow = (kind !== 'set' || !setIdsInPool.length) ? ''
      : '<span class="ff-k">套装</span><span class="shop-cats">' +
        [['', '全部', setsOnly.length]].concat(setIdsInPool.map(function (sid) {
          return [sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
            setsOnly.filter(function (f) { return f.item.set === sid; }).length];
        })).map(function (k) {
          return '<span class="shop-cat' + (setIdCur === k[0] ? ' on' : '') +
            '" data-action="forge-set" data-s="' + k[0] + '">' + U.escape(k[1]) + '<i>' + k[2] + '</i></span>';
        }).join('') + '</span>';
    var curQ = ui._forgeQ;
    var qs = [1, 2, 3, 4].filter(function (q) { return pool.some(function (f) { return f.q === q; }); });
    if (qs.indexOf(curQ) < 0) { curQ = qs[0] || 1; ui._forgeQ = curQ; }
    var rows = pool.filter(function (f) { return f.q === curQ; });
    /* v51（老板：**稍微放大一点、调节一下、搞成翻页**）：
       改前 size 'lg'（860×600）+ 4 列 + 不分页 —— 实测正文只有 433px、
       内容却有 1009px（**溢出 576px**，弹窗里出现滚动条，也违反"弹窗内一律分页"的约定）；
       而且 4 列挤在 822px 里每格只剩 198px，卡片的部位/造价/材料三行全在折行，
       卡片被撑到 265px 高 —— 越挤越高，越发放不下。
       改后：① 弹窗提到 **xl**（960×660，正文 ~493px）；② 列表换**独立类 `.forge-rows` = 3 列**
       （每格 ≈300px，接近商城主视图 317px 的舒适宽度，卡片反而变矮）；
       ③ 走 `ui.modalPage` 分页，**3 列 × 2 行 = 6 件/页**。 */
    /* 选中件：只认**在册**的那一件（换筛选/换品质后，选中的东西可能不在当前页） */
    var selF = null;
    list.forEach(function (f) { if (f.id === ui._forgeSel) selF = f; });
    if (!selF) { ui._forgeSel = ''; }
    var selOk = false, selWhy = '';
    if (selF) {
      var b2 = [];
      if (!selF.tierOk) b2.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[selF.q - 1] || 7));
      if (!selF.bpOk) b2.push('缺图纸');
      if (!selF.matsOk) b2.push('材料不足');
      if (!GAME.canAfford(selF.cost)) b2.push('资材不足');
      selOk = !b2.length; selWhy = b2.join('　');
    }
    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });
    var tabHtml = qs.map(function (q) {
      var n = pool.filter(function (f) { return f.q === q; }).length;
      var okN = pool.filter(function (f) { return f.q === q && f.tierOk; }).length;
      return '<span class="shop-cat' + (q === curQ ? ' on' : '') + '" data-action="forge-q" data-q="' + q + '">' +
        (DATA.Q_NAME[q] || ('Q' + q)) + '<i>' + okN + '/' + n + '</i></span>';
    }).join('');
    ui.openShell({
      /* v89.136（上轮清单① live 续铺）：逐秒刷新（黄金/铁/木/石随打造即时变） */
      live: function () { ui.openForge(); },
      title: '⚒️ 铁匠铺 · Lv' + lv,
      sub: '可打造至「' + (DATA.Q_NAME[maxQ] || '—') + '」　黄金 ' + U.numText(s.res.gold || 0, 0) +
        '　铁 ' + U.numText(s.res.iron || 0, 0) + '　木 ' + U.numText(s.res.wood || 0, 0) +
        '　石 ' + U.numText(s.res.stone || 0, 0),
      size: 'xl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">类别</span><span class="shop-cats">' + kindHtml + '</span>' +
          setRow +
          '<span class="ff-k">品质</span><span class="shop-cats">' + tabHtml + '</span>' +
          /* v51：两段常驻说明搬进帮助入口（原本占正文 146px，约等于一整行卡片，
             而正文高度是这条面板最稀缺的资源 —— 一屏能不能放两行就卡在这）。
             搬走的是**参考资料**（材料去哪打、套装各档加多少），不是操作项：
             材料需求与缺料原因仍在每张卡片上；套名与门槛在卡片 tag 上。 */
          ui.help('打造是**一次一件**（套装件每件消耗图纸 1 张）。\n' +
            '材料来源：攻打野地按地形采集 · 攻占城池缴获 · 已占**州城**的岁贡持续供应本州特产（三、四阶材料的主要活路）。\n' +
            '套装件另需**图纸**：商城可购，攻占郡城 18% / 州城 40% / 都城 80% 缴获，奇遇古冢亦有。') +
        '</div>' +
        (rows.length ? '<div class="forge-rows">' + pg.slice.map(function (f) { return ui.forgeRow(f, lv); }).join('') + '</div>'
          : '<div class="q-empty">' + (kind === 'set' ? '该品质暂无套装件。'
            : kind === 'solo' ? '该品质暂无散件。' : '该品质暂无可打造之物。') + '</div>'),
      /* v89.117（老板「统一成一个放在底部，跟百炼强化啥的放一起就行」）：
         底部三个键：**打造**（唯一入口，认选中件）/ 百炼强化 / 套装效果一览。
         动作名仍叫 `forge-item`（既有派发与选择器零改动），件号改从 ui._forgeSel 取。 */
      /* v89.140（老板 5）：「翻页设置放在当前界面的**底部**」——分页条从正文末尾
         挪到 foot（弹窗下沿固定区），翻页不用再滚到底。
         v89.140（老板 4）：底部的「百炼强化」按钮**删去**（已搬到铁匠铺建筑菜单上）。 */
      foot: '<div class="m-foot">' + (rows.length ? pg.pager : '') +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled') + '>⚒ 打造' +
          (selF ? '：' + U.escape(selF.item.name) : '（先在下方点选一件）') + '</button>' +
        (selF && selWhy ? '<span class="op-hint">' + U.escape(selWhy) + '</span>' : '') +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  /* 套装效果一览（从打造面板正文移到独立小窗）——
     它是**查得到的参考表**，不是每次打造都要盯着的东西；
     正文放不下两行卡片的根源就是它那 105px。数据仍只有 DATA.SETS 一份。 */
  ui.openForgeSetInfo = function () {
    ui.openShell({
      title: '📖 套装效果',
      sub: '同套件数达标即生效，逐档累计',
      size: 'lg',
      body: '<div class="forge-set-note">' + ui.forgeSetNote() + '</div>' +
        '<div class="auto-note">套装件每件消耗图纸 1 张 · 图纸来源见打造面板的「?」</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };


  /* ============================================================
   * 百炼强化（v77 · 老板「铁匠铺加入装备强化系统，装备可进行强化」）
   * ------------------------------------------------------------
   * 列出**已拥有**的装备种（背包 + 已穿戴；GAME.enhList），每行给下一级成本。
   * 等级与效果都走唯一出口（GAME.enhOf / genEquipBonus），这里只做呈现。
   * ============================================================ */
  ui.openEnhance = function () {
    if (GAME.forgeLevel() <= 0) {
      ui.openShell({
        title: '⚒ 百炼强化', size: 'sm',
        body: '<div class="q-empty">尚未建造铁匠铺。<br>在城内空地上建造「铁匠铺」后即可打造与强化装备。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var list = GAME.enhList();
    var perLv = Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100);
    var rows = list.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.enhOf(inst), max = GAME.enhMax();
      var cost = lv < max ? GAME.enhCost(inst) : null;
      var okA = cost ? GAME.canAfford(cost) : false;
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(GAME.eqLabel(inst)) +
          (it.set && DATA.SETS[it.set] ? ' <span class="ui-sub">（' + U.escape(DATA.SETS[it.set].name) + '）</span>' : '') +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 ' + GAME.costString(cost)) : ('已至 +' + max + '（满级）')) +
            '　<span class="ui-sub">每级全属性 +' + perLv + '%（按件记，同名各升各的）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="enhance-item" data-item="' + key + '"' +
              (okA ? '' : ' disabled') + '>强化 +' + (lv + 1) + '</button>'
          : '<span class="op-done">满级</span>') +
        '</div>';
    }).join('') || '<div class="q-empty">背包与穿戴中还没有可强化的装备（先在左侧打造几件）。</div>';
    ui.openShell({
      title: '⚒ 百炼强化',
      sub: '**按件**强化（同名以 甲/乙/丙 区分）　满级 +' + GAME.enhMax() + '　黄金 ' + U.numText(GAME.state.res.gold || 0, 0),
      size: 'lg',
      body: '<div class="enh-list">' + rows + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ============================================================
   * v88 · 蕴养（修炼装备强化 —— 与百炼强化平行的独立面板）
   * ------------------------------------------------------------
   * 列出**已拥有**的修炼装备（背包 + 穿戴；GAME.lingTemperList），
   * 每行给下一级精华成本。等级与效果都走唯一出口（eqEnhOf / genEquipBonus /
   * lingPowerOf），这里只做呈现。
   * ============================================================ */
  ui.openLingTemper = function () {
    /* v89：蕴养君主专属 —— 无君主直接拒开 */
    if (!GAME.lordGeneralOf()) { ui.toast('君主不在，无从蕴养'); return; }
    var list = GAME.lingTemperList();
    var perLv = Math.round(((DATA.LING_TEMPER || {}).perLv || 0.08) * 100);
    var ess = (GAME.state.items || {}).lingsui || 0;
    var rows = list.map(function (inst) {
      var id = GAME.eqId(inst);
      var it = DATA.EQUIP[id], lv = GAME.eqEnhOf(inst), max = GAME.lingTemperMax();
      var cost = lv < max ? GAME.lingTemperCost(inst) : null;
      var okA = cost != null && ess >= cost;
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
      return '<div class="enh-row">' +
        '<span class="enh-art">' + ui.itemArt('equip', id, it.q) + '</span>' +
        '<span class="enh-nm">' + U.escape(GAME.eqLabel(inst)) +
          '<span class="enh-tag">+' + lv + '</span>' +
          '<div class="enh-cost">' + (cost ? ('下一级 灵气精华 ' + cost) : ('已至 +' + max + '（圆满）')) +
            '　<span class="ui-sub">每级修炼属性 +' + perLv + '%（按件记，同名各蕴各的）</span></div></span>' +
        (cost
          ? '<button class="btn sm' + (okA ? ' gold' : '') + '" data-action="ling-temper-item" data-key="' + key + '"' +
              (okA ? '' : ' disabled') + '>蕴养 +' + (lv + 1) + '</button>'
          : '<span class="op-done">圆满</span>') +
        '</div>';
    /* v89.45：空态指引随挂载开关走 —— 剥离时不再把玩家指向已下架的野地入口 */
    }).join('') || '<div class="q-empty">' + (GAME.jianghuWildMounted
      ? '还没有修炼装备。到野地「江湖游历」讨伐/试炼/采集，可得修炼装备与灵气精华。'
      : '还没有修炼装备。') + '</div>';
    ui.openShell({
      title: '☯ 蕴养 · 修炼装备',
      sub: '**按件**蕴养（同名以 甲/乙/丙 区分）　满级 +' + GAME.lingTemperMax() + '　灵气精华 ' + ess + '（野地采集 · 征战所得）',
      size: 'lg',
      body: '<div class="enh-list">' + rows + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 排行榜（原版右下功能入口） */
  /* 公告牌已并入「公文」页（v19 需求 6）—— 不再单独开弹窗，避免与公文重复。 */

  /* 底部信息流频道切换（实现见 renderLog 处） */


  /* ================= 中央视图 ================= */
  ui.setView = function (v) {
    ui.view = v;
    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。 */
    /* v41（需求 4）：进公文页即视为「已读」—— 闪黄提醒的寿命到玩家看一眼为止。
       清零后立刻同步一次徽标，否则要等主循环下一拍才灭（体感像"点了没反应"）。
       v82：收编同段重复块（v67 基线带来的逐字双份）。 */
    if (v === 'reports' && GAME.state && GAME.state.repUnread) {
      GAME.state.repUnread = 0;
      ui.syncBadges();
    }
    /* v20（需求 7）：左侧栏只在**城池场景**显示 ——
       地图/将领/任务等页面要的是整屏空间，挂一条城池资源栏既占地方又容易误读。
       v26：显隐判断**只在 renderView 里做一次** —— 原先 setView 与 renderView
       各写一份，改"哪些视图算城池场景"时必然只改到一处（renderView 后跑，
       于是错误被掩盖，但另一处已成死逻辑）。 */
    $$('#topnav .tab[data-view]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === v);
    });
    ui.renderView(v);
  };

  /* 背包页签 */
  /* v29（需求 4）：切页签 / 换排序一律回到第 1 页 ——
     否则从"材料第 2 页"切到"图纸"再切回来，会停在一个已经没有内容的页码上
     （分页条看着有页码、正文却是空的）。 */
  ui.setBagTab = function (t) {
    /* v89.115：顶层两类（装备 / 宝物）；旧值 'mat' / 'item' / 'bp' 自动迁移到
       「宝物 + 对应二级分类」（老深链、老测试、老脚本都不炸）。 */
    if (BAG_LEGACY_TAB[t]) {
      ui._bagTab = BAG_LEGACY_TAB[t][0];
      ui._bagSub = BAG_LEGACY_TAB[t][1] || ui.bagSubFirstOf();
    } else {
      ui._bagTab = (t === 'treasure') ? 'treasure' : 'equip';
    }
    ui._pages['bag-equip'] = 1;
    ui._pages['bag-treasure'] = 1;
    ui.renderBag();
  };
  /* 宝物二级分类切换（v89.115）：回到第 1 页（同 bag-tab 口径）
     v89.143：走归一出口（老的 'all' / 失效值 → 第一个有货分类） */
  ui.setBagSub = function (v) {
    ui._bagSub = ui.bagSubNorm(v);
    ui._pages['bag-item'] = 1;
    ui._pages['bag-item-' + ui._bagSub] = 1;
    ui._pages['bag-mat'] = 1;
    ui._pages['bag-bp'] = 1;
    ui.renderBag();
  };
  ui.setBagSort = function (v) {
    var sk = ((ui._bagTab || 'equip') === 'equip') ? 'equip' : 'treasure';
    ui._bagSort[sk] = v;
    ui._pages['bag-' + sk] = 1;
    ui.openBag(ui._bagTab);
  };
  /* ================= 史册（天时 / 年号 / 编年史 / 战力折算） ================= */
  ui.storyHTML = function () {
    var s = GAME.state, ST = GAME.story;
    if (!ST || !s.world) return '<div style="padding:20px;color:var(--text-dim);">叙事层未就绪…</div>';

    var era = ST.currentEra(), se = ST.currentSeason(), we = ST.currentWeather();
    var goal = ST.eraGoalProgress();
    var pb = ST.powerBreakdown();
    var title = ST.evaluateTitle();

    var sky =
      '<div class="story-card">' +
        '<div class="gold-heading">🕰️ 天时</div>' +
        '<div class="sky-big">' + era.name + '·' + ST.yearName() + '年　' + se.name + '　' + we.icon + we.name + '</div>' +
        '<div class="sky-sub">' + se.desc + '　|　' + we.desc + '</div>' +
        '<div class="sky-boon">' + (era.boon ? era.boon.text : '') + '</div>' +
      '</div>';

    var gp = goal ? Math.round(goal.ratio * 100) : 0;
    var goalHtml =
      '<div class="story-card">' +
        '<div class="gold-heading">🎏 时代之志 · ' + era.name + '</div>' +
        '<div class="goal-line"><span>' + (goal ? goal.text : '—') + '</span>' +
          '<span class="' + (goal && goal.ok ? 'good' : '') + '">' + (goal ? U.fmt(goal.cur) + ' / ' + U.fmt(goal.target) : '') + '</span></div>' +
        '<div class="prog"><i style="width:' + gp + '%"></i></div>' +
        '<div class="hint">' + (goal && goal.ok ? '✅ 已达成，改元时结算赏赐' : '未达成') +
          ui.help('达成可得黄金与声望；未达成亦只作史书一笔，不罚') + '</div>' +
      '</div>';

    var power =
      '<div class="story-card">' +
        '<div class="gold-heading">⚔️ 实力折算</div>' +
        '<div class="res-line"><span class="lbl">甲兵战力</span><span class="val">' + U.numHTML(pb.army, 0) + '</span></div>' +
        '<div class="res-line"><span class="lbl">可动员战力</span><span class="val">' + U.numHTML(pb.reserve, 0) + '</span></div>' +
        '<div class="res-line"><span class="lbl">国力指数</span><span class="val" style="color:var(--gold-light);">' + U.numHTML(pb.index, 0) + '</span></div>' +
        '<div class="res-line"><span class="lbl">建筑等级 / 科技等级</span><span class="val">' + pb.buildings + ' / ' + pb.tech + '</span></div>' +
      '</div>';

    var titleHtml =
      '<div class="story-card">' +
        '<div class="gold-heading">🏛️ 当前评定 · ' + title.rank + '</div>' +
        '<div class="sky-big">' + title.name + '</div>' +
        '<div class="sky-sub">' + title.desc + '</div>' +
      '</div>';

    /* ⛔ v89.104（老板）：「不要史书纪事了，没有什么实质内容。故事集做成另一个
       单独界面与待阅逸闻这个界面并列」——
       ① 史书纪事（chronicle 列表 + 分页）整段撤出史册页（数据仍照常记录，
          只是不再占版面：改元/纪事仍进 `s.chronicle`，留给以后要用时再展示）；
       ② 故事集（SG 篇目收集）搬到**独立视图** `ui.storiesHTML()`（顶栏「故事集」），
          与史册页的「待阅逸闻」并列。 */
    return '<div class="ui-page">' +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      ui.sgPendingHTML() +
      '</div>';
  };

  /* v89.104（老板）：**故事集**独立成页（与「史册 · 待阅逸闻」并列的那个界面）——
     已读回看 + 收集进度，按锚点类别归组；未读不剧透。 */
  ui.storiesHTML = function () {
    var ST = GAME.story;
    if (!ST || !GAME.state.world) return '<div style="padding:20px;color:var(--text-dim);">叙事层未就绪…</div>';
    var allSt = (GAME.SG && GAME.SG.list) ? GAME.SG.list() : [];
    var prS = GAME.SG.progress();
    var kindsOrd = ['building', 'ext', 'wild', 'city', 'misc'];
    var byK = {};
    var readCnt = 0, endGot = 0, endTot = 0;
    allSt.forEach(function (st) {
      var r = prS[st.id] || {};
      var tot = (st.endings || []).length;
      var got = (r.done || []).length;
      var isRead = got > 0 || (r.n || 0) > 0;
      if (isRead) { readCnt++; endGot += got; endTot += tot; }
      var k = ((st.anchor || {}).kind) || 'misc';
      if (kindsOrd.indexOf(k) < 0) k = 'misc';
      (byK[k] = byK[k] || []).push({ st: st, tot: tot, got: got, read: isRead });
    });
    var sgRows = kindsOrd.map(function (k) {
      var arr = (byK[k] || []).slice().sort(function (a, b) {
        if (a.read !== b.read) return a.read ? -1 : 1;
        return a.st.id < b.st.id ? -1 : 1;
      });
      if (!arr.length) return '';
      var rN = arr.filter(function (x) { return x.read; }).length;
      return '<div class="sg-row"><span class="sg-k">' + (ui.SG_KIND[k] || k) + '</span>' +
        '<span class="sg-items">' + arr.map(function (x) {
          return x.read
            ? '<span class="sg-item" data-action="story-read-at" data-sid="' + x.st.id +
              '" title="重读《' + U.escape(x.st.title) + '》（已阅 ' + x.got + '/' + x.tot + ' 结局）">《' +
              U.escape(x.st.title) + '》<i>' + x.got + '/' + x.tot + '</i></span>'
            : '<span class="sg-item dim" title="尚未得见 —— 随建筑 / 野地 / 城池的首次互动触发">《？？？》</span>';
        }).join('') + '</span><span class="sg-n">' + rN + '/' + arr.length + '</span></div>';
    }).join('');
    return '<div class="ui-page">' +
      '<div class="gold-heading">📚 故事集 · 收集与回看' +
        ui.help('点已读篇目可重读（收集全部结局）。\n未读者不剧透；故事随建筑 / 野地 / 城池首访与世事触发。\n' +
          '「待阅逸闻」在隔壁的「史册」页。') + '</div>' +
      (allSt.length
        ? '<div class="story-card"><div class="res-line"><span class="lbl">收集进度</span><span class="val">已读 ' +
          readCnt + ' / ' + allSt.length + ' 篇　·　结局 ' + endGot + ' / ' + endTot + '</span></div>' + sgRows + '</div>'
        : '<div class="q-empty">故事集尚空 —— 与建筑 / 野地 / 城池首次互动时会有故事找上门。</div>') +
      '</div>';
  };

  /* ================= 客栈：招募 / 相亲 ================= */
  /* v89.62（老板「增加自动招募按钮，可设置当客栈刷新出什么品质的时候自动招募，
     直至达到招贤馆空位上限」）—— 客栈面板顶部的自动招募条：
       开关（点按钮翻转）+ 资质门槛（点选 chip，从良材起，不新增下拉框）。
     执行与择优全在 GAME.innAutoRun（唯一出口），界面只写 s.settings.innAuto 这一个对象。 */
  ui.autoRecruitHTML = function () {
    /* v89.73（老板：「自动招募做到顶部的『自动』菜单下，不要放客栈里」）
       —— 从客栈搬到「自动」页，与自动升级/研究/出征同处（都是"挂机自动"这一族）。
       门槛只列**客栈出得到的档位**（≤ 英杰）：v89.73 起客栈封顶英杰，
       若还把名世/天授列出来，那就是两个**永远招不到的死选项**，
       开了自动招募会静默地永不触发 —— 比没有这个开关更糟。 */
    var c = GAME.innAutoCfg();
    var capName = (DATA.GEN_RANK_BY_ID[GAME.INN_RANK_CAP] || {}).name || '英杰';
    var capI = GAME.rankIndex(GAME.INN_RANK_CAP);
    var ranks = (DATA.GEN_RANKS || []).filter(function (r) {
      var i = GAME.rankIndex(r.id);
      return i >= 1 && i <= capI;
    });
    /* v89.115：去外壳（.auto-card / 标题 / 开关按钮）—— 新的自动化界面由右侧详情 pane
       统一提供外壳与开关（ui.autoPaneHTML），这里只出**设置正文**，避免两个开关并排。 */
    return '<div class="auto-state">开启后：客栈每批候选到手即自动招募<b>达到门槛者</b>，资质高者优先，' +
          '直至招贤馆空位满 / 金不足为止。</div>' +
        '<div class="auto-line"><span class="al-k">资质门槛</span>' +
          '<div class="chips chips-xs" style="justify-content:flex-start;">' +
            ranks.map(function (r) {
              return '<span class="chip' + (c.min === r.id ? ' on' : '') +
                '" data-action="auto-recruit-min" data-v="' + r.id + '">' + r.name + '及以上</span>';
            }).join('') +
          '</div></div>' +
        '<div class="auto-state">客栈候选资质上限 <b>' + capName +
          '</b>　·　名世 / 天授不直接招募，只能靠<b>灵草升档</b>。</div>';
  };
  ui.openInn = function () {
    var s = GAME.state;
    var city = GAME.currentCity();
    var lv = GAME.innLevel(city);
    if (lv <= 0) {
      ui.openModal('<div class="gold-heading">🍶 客栈</div>' +
        '<div class="q-empty">尚未建造客栈</div>' +
        '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var list = GAME.innRefresh();
    /* v64：招贤以**这座城 + 这座城的空位**为准 */
    var chk = GAME.canRecruitGeneral(city);
    var cap = GAME.genSlotsOf(city);
    var usedIn = GAME.generalsIn(city).length;
    var left = Math.ceil(GAME.innRefreshLeft() / 1000);
    var leftTxt = left > 0 ? (left + ' 秒后自动更换') : '可更换';
    /* v89.86（整改 P-15）：无空位时的**升级引导** —— 此前只有一句"已无空位"，
       新手不知道升到几级、按钮禁用旁也没有原因（引导链断在这里）。 */
    var slotGuide = '';
    if (cap > 0 && usedIn >= cap) {
      var zxgLv15 = GAME.buildingLevel(city, 'zhaoxianguan') || 0;
      var zxgCap15 = GAME.buildCapOf(city, 'zhaoxianguan');
      var govLv15 = GAME.buildingLevel(city, 'guanfu') || 0;
      var govCap15 = GAME.buildCapOf(city, 'guanfu');
      if (zxgLv15 < zxgCap15) {
        slotGuide = '升招贤馆至 Lv' + (zxgLv15 + 1) + ' 可添 1 席';
      } else if (govLv15 < govCap15) {
        /* v68 规则：城内建筑等级被官府压顶 —— 招贤馆想再升，得官府先升 */
        slotGuide = '先升官府至 Lv' + (govLv15 + 1) + '，再升招贤馆可添 1 席';
      } else {
        slotGuide = '招贤馆已至上顶（Lv' + zxgCap15 + '）—— 可把将领派往他城腾位';
      }
    }

    /* v77（老板）：「将领招募字太密了，整成列表，表头比如将领，等级，资质，专长，
       统率……俸禄」——候选改**表格**：表头 + 每位一行；
       新增「月俸」列（与月俸体系同源：GAME.genSalaryOf）。
       v75 的两条仍立着：单行显示 / 成长备注只在资质徽章悬停里。 */
    var STYLE_NAME = {};
    (DATA.GEN_STYLES || []).forEach(function (x) { STYLE_NAME[x.id] = x.name; });
    var rows = list.map(function (c) {
      var can = chk.ok && (s.res.gold || 0) >= c.cost;
      return '<tr class="inn-tr' + (can ? '' : ' off') + '">' +
        '<td><span class="inn-face-cell"><span class="inn-avatar">' + ui.faceOf(
          { name: c.name, rank: c.rank, beauty: c.beauty, portraitSeed: c.portraitSeed }, 28) + '</span>' +
          /* v80（老板）：「不要将领名称后边的『史实名将』这种标签，在将领界面显示就好」——
             招募行去标；将领档案清单里那枚（gcard-tag hero）保留。 */
          '<span class="inn-name" style="white-space:nowrap;">' + U.escape(c.name) + '</span></span></td>' +
        '<td class="ctr">Lv' + c.level + '</td>' +
        '<td class="ctr">' + ui.rankBadge(c) + '</td>' +
        '<td class="ctr">' + (STYLE_NAME[c.style] || '均衡') + '</td>' +
        '<td class="num">' + c.tong + '</td>' +
        '<td class="num">' + c.nz + '</td>' +
        '<td class="num">' + c.yw + '</td>' +
        '<td class="num">' + c.zm + '</td>' +
        '<td class="num" title="每 7 游戏日结算一次（按等级、属性与资质定价）">' +
          U.fmt(GAME.genSalaryOf(c)) + '</td>' +
        '<td><span class="inn-act">' +
          '<span class="inn-cost' + ((s.res.gold || 0) >= c.cost ? '' : ' short') + '">' + U.fmt(c.cost) + ' 金</span>' +
          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') +
            /* v89.86（整改 P-15）：按钮旁给出禁用原因（无空位 → 升级引导；缺金 → 金不足） */
            (can ? '' : ' title="' + U.escape(slotGuide || chk.msg || ('金不足（需 ' + U.fmt(c.cost) + '）')) + '"') +
            '>' + (c.beauty ? '相亲' : '招募') + '</button>' +
        '</span></td></tr>';
    }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">客栈中暂无贤士，稍候再来。</td></tr>';

    /* v75（老板）：「客栈的招募界面大一点，尽量所有候选都能在同一页」
       「地下的各资质四维，成长和概率也不显示」——
       ① 改走三段式（v19 的 m-head / m-body / m-foot）：标题与按钮固定，只有候选区滚动
          （旧版「列表 414px 上限 + 面板滚动」两道滚动条并存，这里收敛成一处）；
       ② 尺寸用新档 xxl（980×800）：候选行紧凑单行（36px），14 位（客栈 Lv12 + 专精 2）
          与 16 位（县城上限）真机一页装下；
       ③ 资质一览（rk-box / rankTable）整块退役。 */
    ui.openShell({
      /* v89.136（清单①）：逐秒刷新（候选/空位/刷新次数实时） */
      live: function () { ui.openInn(); },
      title: '🍶 客栈 · Lv' + lv,
      sub: '每级 1 位候选　|　' + U.escape(city.name) + ' 招贤馆空位 ' + usedIn + '/' + cap +
        '　|　' + leftTxt,
      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + (slotGuide ? '　·　' + slotGuide : '') + '</div>') +
        /* v89.73（老板）：自动招募条**从客栈搬到「自动」菜单** —— 见 ui.autoRecruitHTML。
           客栈只管"这一批候选、招谁"，挂机自动化统一归「自动」页。 */
        /* v80（老板）：「招募界面的表格行宽相对固定，根据字串长度搞个适合的固定表，
           在换人时框架不动，只有将领信息变动」——colgroup + table-layout: fixed，
           列宽只认表头这一次声明，换批只动内容（列宽表在 index.html 的 .inn-tbl 段）。 */
        '<table class="tbl inn-tbl"><colgroup>' +
          '<col class="c-name"><col class="c-lv"><col class="c-rank"><col class="c-style">' +
          '<col class="c-attr"><col class="c-attr"><col class="c-attr"><col class="c-attr">' +
          '<col class="c-salary"><col class="c-act"></colgroup>' +
          '<thead><tr>' +
          '<th>将领</th><th class="ctr">等级</th><th class="ctr">资质</th><th class="ctr">专长</th>' +
          '<th class="num">统率</th><th class="num">内政</th><th class="num">勇武</th><th class="num">智谋</th>' +
          '<th class="num">月俸</th><th class="ctr">招募</th></tr></thead><tbody>' + rows + '</tbody></table>',
      foot: '<div class="m-foot">' +
        '<button class="btn sm" data-action="inn-reroll">另请一批（' + U.fmt(GAME.innRefreshCost()) + ' 金）</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      size: 'xxl'
    });
  };

  /* ================= 市场：4 资源 ↔ 黄金（v89.60 单块重做） =================
     老板：「市场的界面太杂了，4资源+黄金可买卖就行，没必要分成 3 个板块」。
     旧版三块（① 资源互换 ② 售卖换金 ③ 金换物资）合并为**一张表**：
       · 每行一个资源：库存 / 卖出（每千得金）/ 买入（每千耗金）/ 行尾「卖出·买入」；
       · 黄金只作计价（顶栏一行显示），数量由**共用输入框**给出（单位 = 资源单位数）；
       · 比价与折损只在表下说明一次 —— 不再分散到三个板块各写一遍。
     **资源互换（粮→木）入口退役**：后端 GAME.marketTrade 保留（历史 API 与 smoke 覆盖），
     UI 不再暴露 —— 卖粮得金再买木，口径统一到这一张表里。
     口径**只读出口**：卖价 marketSellGold / 买价 marketBuyGoldFor，界面不自己算
     （"算第二遍"是本项目最经典的失效模式）。 */
  /* ============================================================
   * 门派驻地 · 门派面板（v89.74 · P0）
   * ------------------------------------------------------------
   * 入口 = 城内**门派建筑格的建筑面板** → 「⚔️ 门派」按钮（见 BLDG_FUNC.honglusi）。
   * 老板原话是「点击地块时提供可选项」，所以**不新造入口**，挂在既有的建筑面板上 ——
   * 全站建筑都是这个走法，门派不该例外。
   * 三种形态：未入派（六派名录 + 开山立派）/ 已入派（品阶 · 声望 · 门派任务）/ 退派（底栏危险操作）。
   * 文案口径：门派声望与**君主声望分家**（前者定品阶，不参与爵位）——两套数字不许互相折算。
   * ============================================================ */
  ui.openSect = function () {
    var S = DATA.SECTS || [], st = GAME.sectState(), sc = GAME.sectOf();
    var lv = GAME.sectBldLv();
    var rk = GAME.sectRankOf(), nx = GAME.sectNextRankOf();
    var cd = GAME.sectLeaveCd();
    var F = DATA.SECT_FOUND || {};
    /* v89.105：这条说明原占 55px（整段 q-empty）—— 门派面板本就"六派 + 开山"两节，
       多这 55px 就装不下。收进标题旁的 ?；面板同时升到 xxl（两列后 790px）。 */
    var html = '<div class="gold-heading">⚔️ 门派驻地' + (lv ? ' · Lv' + lv : '') +
      ui.help('门派声望与君主声望各记各的：前者定你在门中的品阶，不参与爵位。') + '</div>';

    if (!sc) {
      if (cd > 0) {
        html += '<div class="note-warn">退派未满 ' + DATA.SECT_LEAVE.cooldownDay + ' 日（余 ' + cd + ' 日），暂不可入派。</div>';
      }
      var chkLv = lv >= (F.bldLv || 1), chkCost = GAME.canAfford(F.cost);
      /* v89.105（老板「内容紧凑有序」）：六派此前纵向各占一行（实测 517px），
         加上"开山立派"一节共 703px —— 默认档(620)装不下、必冒滚动条。
         改**两列网格**：六派 → 三行，517 → 约 260px，一眼看全，也更好比。 */
      html += '<div class="op-zone"><div class="op-zone-t">江湖六派 · 择一入派</div>' +
        '<div class="sect-grid">';
      S.forEach(function (x) {
        html += '<div class="op-row sect-card">' +
          '<div><b>' + x.icon + ' ' + U.escape(x.name) + '</b>　<span class="ui-sub">' + U.escape(x.style) + '</span></div>' +
          /* v89.86（门派 P1）：被动加成上架 —— 入派前就能看见将得到什么 */
          '<div class="op-hint">被动：<b style="color:var(--gold-light);">' + U.escape(GAME.sectTraitText(x)) + '</b>　·　' +
            U.escape(x.desc) + '</div>' +
          '<button class="btn gold" data-action="sect-join" data-v="' + x.id + '"' + (cd > 0 ? ' disabled' : '') + '>入派</button>' +
          '</div>';
      });
      html += '</div></div>';
      html += '<div class="op-zone"><div class="op-zone-t">开山立派</div>' +
        '<div class="op-hint">自成一门：你是开山祖师，门派任务声望 <b>×1.5</b>。' +
          '须门派驻地 <b>Lv' + F.bldLv + '</b>（现 Lv' + lv + '）　·　本钱 ' + GAME.costString(F.cost) + '</div>' +
        '<div class="op-row">' + S.map(function (x) {
          return '<button class="btn" data-action="sect-found" data-v="' + x.id + '"' +
            ((cd > 0 || !chkLv) ? ' disabled' : '') + '>' + x.icon + ' 立' + U.escape(x.name) + '</button>';
        }).join('') + '</div>' +
        (cd > 0 ? '<div class="op-hint">冷却中，暂不可立派。</div>' : '') +
        ((cd > 0 || chkLv) ? '' : '<div class="op-hint">门派驻地 Lv 不足。</div>') +
        (chkCost ? '' : '<div class="op-hint">本钱不足。</div>') +
        '</div>';
    } else {
      html += '<div class="op-zone"><div class="op-zone-t">' + sc.icon + ' ' + U.escape(sc.name) +
        (st.founder ? '（开山祖师）' : '') + '</div>' +
        '<div class="op-hint">' + U.escape(sc.desc) + '</div>' +
        '<div class="op-row"><span class="op-kv">门中品阶 <b>' + U.escape((rk && rk.name) || '') + '</b></span>' +
          '<span class="op-kv">门派声望 <b>' + U.fmt(st.rep) + '</b></span></div>' +
        /* v89.86（门派 P1）：门派被动 —— 加成已实装（走既有消费链） */
        '<div class="op-hint">门派被动：<b style="color:var(--gold-light);">' + U.escape(GAME.sectTraitText(sc)) + '</b></div>' +
        (nx ? '<div class="op-hint">晋「' + U.escape(nx.name) + '」还需 ' +
              U.fmt(Math.max(0, nx.rep - st.rep)) + ' 声望。</div>'
            : '<div class="op-hint">已至门中最高品阶。</div>') +
        /* v89.89（C3）：声望来源透明化 —— 来源扩容后明示两条来路（任务 / 占城） */
        '<div class="op-hint" style="color:var(--text-dim);">声望来源：门派任务（每日）· 开疆拓土（占城一次性入账）</div>' +
        '</div>';
      html += '<div class="op-zone"><div class="op-zone-t">门派任务（今日余 ' +
        GAME.sectTaskLeftToday() + ' / ' + DATA.SECT_TASK_PER_DAY + '）</div>';
      (DATA.SECT_TASKS || []).forEach(function (t) {
        var gain = st.founder ? Math.round(t.rep * 1.5) : t.rep;
        var can = GAME.canAfford(t.cost) && GAME.sectTaskLeftToday() > 0;
        html += '<div class="op-row" style="display:block;">' +
          '<div><b>' + U.escape(t.name) + '</b>　<span class="ui-sub">声望 +' + gain +
            '　·　' + GAME.costString(t.cost) + '</span></div>' +
          '<div class="op-hint">' + U.escape(t.desc) + '</div>' +
          /* v89.86（整改 P-21）：连做 —— 复用「去做」同一出口逐次调用，结算汇总一条 toast */
          '<span style="display:inline-flex;gap:6px;align-items:center;">' +
          '<button class="btn' + (can ? ' gold' : '') + '" data-action="sect-task" data-v="' + t.id + '"' +
            (can ? '' : ' disabled') + '>去做</button>' +
          '<button class="btn sm" data-action="sect-task-bulk" data-v="' + t.id + '" data-n="10"' +
            (can ? '' : ' disabled') + '>连做 ×10</button>' +
          '<button class="btn sm" data-action="sect-task-bulk" data-v="' + t.id + '" data-n="0"' +
            (can ? '' : ' disabled') + ' title="按今日剩余次数连续执行，直到日额用尽或资源不够">一键做完</button>' +
          '</span>' +
          '</div>';
      });
      html += '</div>';
      html += '<div class="bldg-foot"><button class="btn sm red" data-action="sect-leave">退出' +
        U.escape(sc.name) + '（声望清零）</button></div>';
    }
    html += '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xxl', live: function () { ui.openSect(); } });
    /* v89.105：六派两列后实测 790px；v89.136（清单①）：live 逐秒刷新（声望/任务/冷却实时） */
  };

  ui.openMarket = function () {
    var s = GAME.state;
    var lv = GAME.marketLevel();
    /* v89.62（老板「市场去除商队计数和限制，去除相应标注」）：
       · 撤掉"尚未建造市场 → 直接挡在门外"这道门槛：**无市场也能买卖**，只是折损最大
         （marketRate 的 0.6 底）；市场等级的作用收敛为**只影响折损**。
       · 标题里的「（商队 N）」连同"商队"这个概念一并退场，改标**折损系数**。 */
    var rate = GAME.marketRate();
    var loss = Math.round((GAME.marketBuyCfg().loss || 0) * 100);
    var metaOf = function (k) {
      var m = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) m = r; });
      return m;
    };
    var rows = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var meta = metaOf(k);
      return '<tr>' +
        '<td class="ms-name">' + (meta ? meta.icon + ' ' + meta.name : k) + '</td>' +
        '<td class="ms-stock">' + U.fmt(s.res[k] || 0) + '</td>' +
        '<td class="ms-gold">' + U.fmt(GAME.marketSellGold(k, 1000)) + '</td>' +
        '<td class="ms-cost">' + U.fmt(GAME.marketBuyGoldFor(k, 1000)) + '</td>' +
        '<td class="ms-act">' +
          '<button class="btn xs" data-action="market-sell" data-res="' + k + '">卖出</button>' +
          '<button class="btn xs" data-action="market-buy" data-res="' + k + '">买入</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🏪 市集' + (lv > 0 ? ' · Lv' + lv : '') +
        '　<span style="font-size:var(--fs-sub);font-weight:400;color:var(--text-dim);">折损 ×' +
        rate.toFixed(2) + '</span></div>' +
      '<div class="res-line" style="margin-top:2px;border:none;"><span class="lbl">黄金</span><span class="val">💰 ' +
        U.fmt(s.res.gold || 0) + '</span></div>' +
      /* v89.95（A2/A3）：物多价贱 —— 今日已售/当前汇率/通商券免折额度 */
      '<div class="ms-note" style="margin-top:2px;">📉 ' + U.escape(GAME.mktSlipText ? GAME.mktSlipText() : '') + '</div>' +
      /* v89.100：资源表专属 class（ms-res-table）—— 市集里新增"寄售"表后，
         e2e 的"四行表"判据必须能精确选中资源表（数 .ms-table 会把寄售表也算进去）。 */
      '<table class="ms-table ms-res-table"><thead><tr>' +
        '<th>资源</th><th>库存</th><th>卖出·每千得金</th><th>买入·每千耗金</th><th>交易</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="mk-row"><input type="number" id="mk-amount" min="1" value="100000" placeholder="数量">' +
        '<span class="mk-hint">交易数量（资源单位）</span></div>' +
      /* v89.62（老板「买卖数量以 10万，百万，千万，亿量级加减」）：
         四档量级一键设定 + ÷10 / ×10 两键按量级增减；数量框仍可直接手填（两条路并存）。 */
      '<div class="mk-presets">' +
        [[100000, '10 万'], [1000000, '百万'], [10000000, '千万'], [100000000, '亿']].map(function (m) {
          return '<button class="btn sm" data-action="mk-preset" data-target="mk-amount" data-v="' + m[0] + '">' + m[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="mk-presets" style="margin-top:4px;">' +
        '<button class="btn sm" data-action="mk-scale" data-target="mk-amount" data-v="0.1">− 10 倍</button>' +
        '<button class="btn sm" data-action="mk-scale" data-target="mk-amount" data-v="10">+ 10 倍</button>' +
      '</div>' +
      /* v89.105：比价细则原为两行（38px）—— 市集是"两段表格"的大面板，
         多这两行就到不了头。压成一行摘要，细则挂标题旁的 ?（信息一字不删）。 */
      '<div class="ms-note">比价 <b>粮 1 : 木 2 : 石 3 : 铁 4</b>（粮最便宜）' +
        ui.help('卖出折损后系数 ×' + rate.toFixed(2) + '（市场等级越高折损越小）\n'
          + '买入再扣 ' + loss + '%（金 → 物资吃亏，城池间运输更划算，市场只作应急）'
          + (lv > 0 ? '' : '\n未建市场：折损最大，建市场可提高折损系数')) + '</div>' +
      /* v89.100：寄售战利品（按购买价 75% 回收）—— 价/校验全走 systems.consign* 出口 */
      (function () {
        var list = (GAME.systems.consignList ? GAME.systems.consignList() : []);
        if (!list.length) return '';
        /* v89.105：原列 12 种（表高 230px）—— 12 行 + 两段表把市集顶出窗外。
           收到 8 种（154px）：按价值降序，前 8 种已覆盖绝大部分可得金；
           真要全卖有「一键寄售全部」，能力不减，只少占版面。 */
        var top = list.slice(0, 8);
        var sumAll = 0;
        list.forEach(function (x) { sumAll += x.total; });
        return '<div class="gold-heading" style="margin-top:10px;">🎒 寄售战利品' +
            '　<span style="font-size:var(--fs-sub);font-weight:400;color:var(--text-dim);">按购买价 75% 回收</span></div>' +
          '<table class="ms-table"><thead><tr><th>道具</th><th>持有</th><th>单价</th><th>全卖得金</th><th></th></tr></thead><tbody>' +
          top.map(function (x) {
            return '<tr><td class="ms-name">' + U.escape(x.name) + '</td>' +
              '<td class="ms-stock">' + U.fmt(x.qty) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.unit) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.total) + '</td>' +
              '<td class="ms-act"><button class="btn xs gold" data-action="consign-sell" data-item="' + x.id + '">寄售</button></td></tr>';
          }).join('') +
          '</tbody></table>' +
          (list.length > 8 ? '<div class="ms-note">…按价值列前 8 种（共 ' + list.length + ' 种，可一键全售）</div>' : '') +
          /* v89.105：按钮行贴紧它作用的那张表（间距 6→2）—— 合"邻近原则"，也收回最后 4px */
          '<div class="mk-presets" style="margin-top:2px;">' +
            '<button class="btn sm gold" data-action="consign-all">一键寄售全部（共得 ' + U.fmt(sumAll) + ' 金）</button>' +
          '</div>' +
          '<div class="ms-note">装备请用「拆解」回收材料；灵草 / 灵气精华无购买价，不参与寄售。</div>';
      })() +
      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：内容实测 786px（两段表格纵向叠放）—— lg(600) 装不下、xl(700) 差 90、
         xxl(800) 才容得下。选档依据写在 docs/v89105，改内容时**重新量**再选档。
         v89.136（清单①）：live 逐秒刷新（报价 / 折损 / 库存随交易即时变）。 */
      { size: 'xxl', live: function () { ui.openMarket(); } }
    );
  };


  /* ================= 仓库：储量上限 ================= */
  ui.openStore = function () {
    var s = GAME.state;
    /* v89.158（老板 1）：口径统一 —— ① 等级取**等级和**（多仓叠加才是容量口径；
       改前 buildingLevel 只给"最高一座"，2 座 Lv1 显示 Lv1 而容量按 2 级算，两把尺）；
       ② "基础储量"拆账（不再把城外堆场算进"基础"）；③ 标题按有无仓库分形态。 */
    var sp = GAME.storePartsOf(GAME.currentCity());
    var lv = sp.lv;
    var cap = sp.total;
    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(sp.base)
      + '；城外堆场另计 +' + U.fmt(sp.ext) + '，合计 ' + U.fmt(sp.total) + '（超出部分将停止增长）</div>';
    /* v89.160（老板 1）：逾溢折损（唯一出口 GAME.overflowRotOf / DATA.OVERFLOW）——
       涨不动就罢了，超出上限的部分还会被"天灾"慢慢吃掉：规则与**当前超出量**写在这里。 */
    var _C160 = DATA.OVERFLOW || {};
    var _rotEx160 = GAME.overflowRotOf(GAME.currentCity()).reduce(function (t, x) { return t + x.excess; }, 0);
    var rotNote = '<div class="note-warn" style="margin-top:6px;">⚠️ 逾溢折损：超出仓容上限的部分，每 '
      + ((_C160.periodGameHours || 24) / 24) + ' 游戏日（现实约 ' + ui.rotPeriodRealText() + '）折损 ' + Math.round((_C160.ratio == null ? 0.25 : _C160.ratio) * 100) + '%'
      + '（' + ((_C160.events || []).map(function (e) { return e.name; }).join(' / ')) + '）'
      + '　·　当前超出上限：<b>' + (_rotEx160 > 0 ? U.fmt(_rotEx160) : '无') + '</b></div>';
    var rows = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      var v = s.res[k] || 0;
      var pct = Math.min(100, Math.round(v / cap * 100));
      return '<div class="store-row"><span class="lbl">' + (meta ? meta.icon + meta.name : k) + '</span>' +
        '<span class="prog" style="flex:1;margin:0 10px;"><i style="width:' + pct + '%' + (pct > 90 ? ';background:linear-gradient(90deg,#a33,#e66)' : '') + '"></i></span>' +
        '<span class="val">' + U.numHTML(v, 0) + ' <span class="cap">/ ' + U.numText(cap, 0) + '</span></span></div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🏚️ 仓库 · ' + (lv > 0 ? ('Lv' + lv + '（多仓叠加）') : '未建') + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">每级 +' + U.fmt(GAME.DATA.BASE_STORE || 2000000) + ' 储量上限</div>' +
      near + rotNote + rows +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* ================= 将领资质徽章 ================= */
  ui.rankBadge = function (gen) {
    var rk = GAME.rankOf(gen);
    if (!rk) return '';
    var style = '';
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === gen.style) style = x.name; });
    /* v75（老板）：「成长 +2/级这个备注也去掉，改成鼠标悬停在资质上时浮现备注」——
       成长备注收进徽章悬停（desc 里本就有等级上限）；将领清单 / 派遣 / 解雇弹窗同步受益。 */
    return '<span class="rank-badge r-' + rk.id + '" title="' + U.escape(rk.desc || '') +
      '每级属性成长 +' + rk.grow + '。">' +
      rk.name + ' ' + '★'.repeat(rk.star) + (style ? ' · ' + style : '') + '</span>';
  };

  /* v75（老板）：「地下的各资质四维，成长和概率也不显示」——
     资质一览（ui.rankTable / .rk-box）整块退役：候选行的资质徽章 + 悬停备注已够用。 */

  /* ================= 招贤馆：将领名录 ================= */
  /* ============================================================
   * 招贤馆（v29 · 需求 15）
   * ------------------------------------------------------------
   * 改前：这里是**将领名录** —— 与顶栏「将领」菜单一字不差地重复一份。
   * 同一份数据摆两个入口，代价是"改了一处忘另一处"（两边的排序、分页、
   * 忠诚告警都要各维护一遍），收益为零。
   * 现在招贤馆只讲它**自己**负责的事：房间数（将领容量）、建筑专精、
   * 缺房时该怎么办。要看谁在帐下 → 去「将领」菜单。
   * ============================================================ */
  /* ============================================================
   * v89.132（老板「节钺设计再开拓一下」）：节钺专属面板 ——
   * 「余额 · 来源 · 四种用途 · 全境扩编进度」一屏说完。
   * 数字一律读唯一出口（jieyueOf / jieyueExpandOf / DATA.JIEYUE），不抄文案。
   * ============================================================ */
  ui.openJieyue = function () {
    var s = GAME.state;
    var C = DATA.JIEYUE || {};
    var kinds = ['city', 'xc', 'gen'];
    var used = 0, max = 0;
    (s.cities || []).forEach(function (c) {
      kinds.forEach(function (k) {
        var st = GAME.jieyueExpandOf(c, k);
        used += st.used; max += st.max;
      });
    });
    var man = C.byTier || {};
    var rankN = Math.floor(((DATA.RANK || []).length - 1) / (C.rankEvery || 4));
    var body =
      '<div class="res-line"><span class="lbl">余额</span><span class="val">' + (C.icon || '🪓') +
        ' ×<b>' + GAME.jieyueOf() + '</b> 枚</span></div>' +
      '<div class="note">黄金买不到的「开门」资源 —— 不解锁强度，只解锁「再往上走」的资格：' +
        '顶档资质、编制扩张，都要它放行。</div>' +
      '<div class="gold-heading" style="margin-top:10px;">🪙 获得（只能打出来 / 赐下来）</div>' +
      '<div class="res-line"><span class="lbl">首占名城</span><span class="val">县 +' +
        (man.county || 1) + ' · 郡 +' + (man.jun || 2) + ' · 州 +' + (man.zhou || 3) + ' · 都 +' +
        (man.capital || 5) + '　（同一座城只算一次）</span></div>' +
      '<div class="res-line"><span class="lbl">爵位赏赐</span><span class="val">每 ' +
        (C.rankEvery || 4) + ' 档 +1（共 ' + rankN + ' 枚）</span></div>' +
      '<div class="gold-heading" style="margin-top:10px;">🛠️ 用途</div>' +
      '<div class="res-line"><span class="lbl">① 问鼎天授</span><span class="val">1 枚 / 将 —— 名世 → 天授（将领面板 · 资质晋升）</span></div>' +
      '<div class="res-line"><span class="lbl">② 城建扩编</span><span class="val">1 枚 / 次 —— 建造位 +1（城池面板 · 每城 ≤' + (C.citySlotMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">③ 校场扩编</span><span class="val">1 枚 / 次 —— 出征容量 +1 万人马（校场面板 · 每城 ≤' + (C.xcMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">④ 招贤纳士</span><span class="val">1 枚 / 次 —— 将领席位 +1（招贤馆面板 · 每城 ≤' + (C.genMax || 2) + ' 次）</span></div>' +
      '<div class="res-line"><span class="lbl">全境扩编</span><span class="val">已用 ' + used + ' / 上限 ' + max + ' 次</span></div>';
    ui.openShell({
      title: (C.icon || '🪓') + ' 节钺',
      sub: '现有 ' + GAME.jieyueOf() + ' 枚 · 全境扩编 ' + used + '/' + max,
      size: 'sm',
      body: body
    });
  };

  ui.openHostel = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var lv = GAME.buildingLevel(c, 'zhaoxianguan') || 0;
    /* v64：席位是**这座城**的（`genSlotsOf`），在册人数也是**这座城**的 */
    var cap = GAME.genSlotsOf(c);
    var used = GAME.generalsIn(c).length;
    var mTier137 = GAME.masteryTierOf ? GAME.masteryTierOf(c, 'zhaoxianguan') : 0;   /* v89.137：三档 */
    var maxLv = GAME.buildCapOf(c, 'zhaoxianguan');           /* v54：名城上限更高 */
    var full = used >= cap;
    var zIdx = -1;
    (c.cells || []).forEach(function (x, i) {
      if (zIdx < 0 && x.build && x.build.id === 'zhaoxianguan') zIdx = i;
    });
    var body =
      '<div class="attr"><span class="k">房间（本城将领席位）</span><span class="v">' +
        '<b style="color:' + (full ? 'var(--amber)' : 'var(--green-ok)') + ';font-variant-numeric:tabular-nums;">' +
        used + '</b> / ' + cap + '</span></div>' +
      '<div class="attr"><span class="k">本馆等级</span><span class="v">Lv' + lv + ' / ' + maxLv + '</span></div>' +
      '<div class="attr"><span class="k">每级房间</span><span class="v">+1 席</span></div>' +
      /* v89.132（老板「节钺设计再开拓一下」）：节钺 · 招贤纳士入口（唯一落点 = 招贤馆面板） */
      '<div class="auto-line"><button class="btn" data-action="jieyue-gen" data-city="' + c.id +
        '" title="' + U.escape((GAME.jieyueTextOf ? GAME.jieyueTextOf() + '　·　' : '')
          + ((DATA.JIEYUE || {}).desc || '')) + '">🪓 节钺 · 招贤纳士（' +
        (function () {
          var jg = GAME.jieyueExpandOf(c, 'gen');
          return (jg.used >= jg.max)
            ? '本城已满 ' + jg.used + '/' + jg.max
            : '本城 ' + jg.used + '/' + jg.max + '　持符 ' + GAME.jieyueOf();
        })() + '）</button>' +
        '<span class="ui-sub">将领席位 +1（至多 ' + ((DATA.JIEYUE || {}).genMax || 2) + ' 次）</span></div>' +
      (mTier137 > 0
        ? '<div class="attr"><span class="k">建筑专精</span><span class="v good">房间 +' + (2 * mTier137)
          + '<span style="color:var(--text-dim);">（每档 +2 · 现 ×' + mTier137 + ' 档）</span></span></div>'
        : '<div class="attr"><span class="k">建筑专精</span><span class="v" style="color:var(--text-dim);">'
          + 'Lv' + ((DATA.MASTERY_TIERS || [12])[0]) + ' 起：房间 +2（每档 +2）</span></div>') +
      '<div class="attr"><span class="k">全境席位</span><span class="v">' +
        GAME.generalsIn(c).length + ' / ' + cap + '　（各城合计 ' + GAME.genSlotsTotal() + ' 席）</span></div>' +
      '<div class="note" style="margin-top:10px;">招贤馆决定<b>本城能容纳多少将领</b>；' +
        (full
          ? '现已满员，<b>升级招贤馆</b>才能继续招募新将，或把将领派往他城。'
          : '尚有空位，可去<b>客栈</b>招募新将，也可从别城<b>派遣</b>过来。') +
        '<br>席位**按城**计：每座城的招贤馆只管自己这座城的人。名录见顶栏「将领」菜单。</div>' +
      (full && lv < maxLv && zIdx >= 0
        ? '<div style="text-align:center;margin-top:12px;">' +
            /* 走既有的 confirm-upgrade —— 升级只认「当前城池的格位序号」，
               所以这里必须现算招贤馆在第几格，不能凭"建筑 id"假设点得到。 */
            '<button class="btn gold" data-action="confirm-upgrade" data-idx="' + zIdx +
            '">升级招贤馆 → Lv' + (lv + 1) + '</button></div>'
        : '');
    ui.openShell({
      title: '🎎 招贤馆 · Lv' + lv,
      sub: '本城席位 ' + used + ' / ' + cap,
      /* v89.141（复核修复）：sm(433×414) 在基准态溢出 4px；更糟的是"满员可升级"
         分支还要再加一行升级按钮（≈ +42px）→ 那个分支会溢出 ~46px。
         升 md(660×620)：所有分支（含升级按钮）都在框内，长 note 也更舒展。 */
      size: 'md',
      body: body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ================= 铁匠铺 · 打造 ================= */
  ui.renderView = function (v) {
    ui.syncTheme();   /* v39：主题落点（幂等） */
    var box = $('#view-container');
    /* v29（需求 3/4）：本帧重新收集分页条 —— 绝不能沿用上一帧的，
       否则切到没有分页的页面时，底部还挂着上一个视图的页码（点下去会翻错列表）。 */
    ui._bottom = [];
    /* v26（需求 5）：城内（city）与城外（ext）现在是**平级视图**，
       两者同属"我这座城"，所以侧栏（城池属性 / 资源 / 驻军）在两边都保留。 */
    var isCity = (v === 'city' || v === 'ext');
    var side2 = $('.auth-side');
    if (side2) side2.classList.toggle('hidden', !isCity);
    ui.syncHeader();
    /* 侧栏隐藏时主区自动占满整宽（由 .main 的 grid 列数控制） */
    var mainEl = $('.main');
    if (mainEl) mainEl.classList.toggle('solo', !isCity);
    if (v === 'city') box.innerHTML = ui.cityHTML();
    else if (v === 'ext') box.innerHTML = ui.extHTML();
    else if (v === 'troops') box.innerHTML = ui.troopsHTML();
    else if (v === 'generals') box.innerHTML = ui.generalsHTML();
    else if (v === 'marches') box.innerHTML = ui.marchesHTML();
    else if (v === 'equip') box.innerHTML = ui.equipHTML();
    else if (v === 'tech') box.innerHTML = ui.techHTML();
    else if (v === 'items') box.innerHTML = ui.itemsHTML();
    else if (v === 'rank') box.innerHTML = ui.rankHTML();
    else if (v === 'map') box.innerHTML = ui.mapHTML();
    /* v25（需求 2）：商城 / 背包 由弹窗改为整页视图 */
    else if (v === 'shop') box.innerHTML = ui.shopHTML();
    else if (v === 'bag') box.innerHTML = ui.bagHTML();
    else if (v === 'tasks') box.innerHTML = ui.tasksHTML();
    else if (v === 'reports') box.innerHTML = ui.reportsHTML();
    else if (v === 'settings') box.innerHTML = ui.settingsHTML();
    /* v29（需求 5）：自动化独立成菜单（自动升级 / 研究 / 出征） */
    else if (v === 'auto') box.innerHTML = ui.autoHTML();
    else if (v === 'story') box.innerHTML = ui.storyHTML();
    /* v89.104（老板）：故事集独立成页（与史册/待阅逸闻并列） */
    else if (v === 'stories') box.innerHTML = ui.storiesHTML();
    /* v26（需求 5）：子页签与 ui._citySub 一并删除 —— 城内/城外走顶栏 data-view，
       不再有"独立于视图的 sub 状态"，也就不会出现"切了视图但页签还亮着旧值"。 */
    if (v === 'map') requestAnimationFrame(function () { ui.renderMapCanvas(); });
    ui.paintBottom();
  };

  /* --------- 州郡岁贡（v14）：占城的持续收益面板 --------- */
  ui.yieldHTML = function (compact) {
    var sum = GAME.dailyYieldSummary ? GAME.dailyYieldSummary() : null;
    var box = compact
      ? 'border-top:1px solid var(--sep-gold);padding-top:8px;margin-top:10px;'
      : 'background:var(--slab-1);border:1px solid var(--line-strong);border-radius:6px;padding:11px 13px;margin-top:12px;';
    if (!sum || !sum.cities) {
      return '<div style="' + box + '">' +
        '<div style="color:var(--gold);font-size:var(--fs-body);font-weight:700;margin-bottom:5px;">🏛 州郡岁贡</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);line-height:1.7;">尚无归属名城</div>' +
        '</div>';
    }
    var matLine = [];
    for (var mid in sum.mats) {
      var m = DATA.MATERIAL_BY_ID[mid];
      matLine.push('<span style="color:' + (m && m.tier >= 3 ? 'var(--gold-light)' : 'var(--text)') + ';">' +
        (m ? m.name : mid) + '×' + sum.mats[mid] + (m && m.tier === 4 ? '★' : '') + '</span>');
    }
    var stateLine = [];
    for (var st in sum.byState) {
      var b = sum.byState[st];
      var mm = DATA.MATERIAL_BY_ID[b.mat];
      stateLine.push('<span style="display:inline-block;background:var(--slab-3);border:1px solid #464a56;border-radius:9px;' +
        'padding:1px 7px;margin:2px 3px 2px 0;font-size:var(--fs-sub);color:' + (b.seat ? 'var(--gold-light)' : 'var(--text-dim)') + ';">' +
        st + ' · ' + (mm ? mm.name : b.mat) + ' ×' + b.count + '座' + (b.seat ? '（州治 ×' + DATA.STATE_SEAT_BONUS + '）' : '') + '</span>');
    }
    var left = GAME.dailyYieldLeft ? Math.round(GAME.dailyYieldLeft() / 1000) : 0;
    return '<div style="' + box + '">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px;">' +
        '<span style="color:var(--gold);font-size:var(--fs-body);font-weight:700;">🏛 州郡岁贡（每现实日结算）</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">距下次 ' + U.durExact(left) + '</span>' +
      '</div>' +
      '<div style="font-size:var(--fs-sub);line-height:1.8;">' +
        '归属名城 <b>' + sum.cities + '</b> 座' +
        (sum.seats.length ? ' · 州治在握：<span style="color:var(--gold-light)">' + sum.seats.join('、') + '</span>' : '') +
      '</div>' +
      '<div style="font-size:var(--fs-sub);line-height:1.8;">每 日 收 入：金 <b style="color:var(--gold-light)">+' + U.fmt(sum.gold) + '</b>' +
        ' · 声望 <b style="color:var(--gold-light)">+' + U.fmt(sum.rep) + '</b></div>' +
      (matLine.length ? '<div style="font-size:var(--fs-sub);line-height:1.9;">特产材料：' + matLine.join('、') +
        '<span style="color:var(--text-dim);font-size:var(--fs-cap);">（★ 四阶）</span></div>' : '') +
      (stateLine.length ? '<div style="margin-top:6px;line-height:1.9;">' + stateLine.join('') + '</div>' : '') +
      '</div>';
  };

  /* 显示比例（v16）：城内/城外/地图整体缩放，缓解「界面太小费眼睛」 */
  ui.zoom = function () {
    var s = GAME.state;
    return (s && s.settings && s.settings.zoom) || 100;
  };
  /* v89.104（老板）：「显示比例，将数值档次改成连续拖动的进度条样式，
     从 80%-120% 可连续拖动，自由设置它们之间的整数显示比例」——
     唯一出口 = 一个 range 滑块（80~120、step 1），值走既有的 GAME.doSetZoom。
     旧的档次 chips（80/100/120/140/160）退役：上限收到 120，避免把界面缩到不可读。 */
  ui.ZOOM_MIN = 80;
  ui.ZOOM_MAX = 120;
  ui.zoomBarHTML = function () {
    var cur = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, ui.zoom()));
    return '<input type="range" id="zoom-range" class="zoom-range" min="' + ui.ZOOM_MIN + '" max="' + ui.ZOOM_MAX +
      '" step="1" value="' + cur + '">';
  };
  ui.zoomStyle = function () { return 'zoom:' + (ui.zoom() / 100) + ';'; };
  /* ============================================================
   * v89.116（老板「设置里的显示比例实质改不了比例」）—— **病根**：
   *   `ui.zoomBarHTML` 画出了 `#zoom-range` 滑块，但**全仓没有任何 input/change 监听**
   *   （v89.104 把档次 chips 换成 range 时，只删了旧的 `after==='zoom'` 分支，
   *   忘了给新滑块接线）→ 拖动无任何反应，设置里的百分比只是个摆设。
   * 现在两条路：
   *   · `previewZoom(v)` —— input 事件里**只改 DOM**（不重绘），拖动不中断；
   *   · `GAME.doSetZoom(v)` —— change 事件里落库 + 重绘（走既有唯一出口）。
   * ============================================================ */
  ui.previewZoom = function (v) {
    var z = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, Math.round(Number(v) || 100)));
    document.querySelectorAll('.city-iso').forEach(function (el) { el.style.zoom = (z / 100); });
    var t = document.getElementById('zoom-txt');
    if (t) t.textContent = z + '%';
    return z;
  };

  /* --------- 城内（36格：官府占右侧4格 + 32格可建；城墙环绕不占格） --------- */
  ui.cityHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var COLS = c.col || 6, ROWS = c.row || 6;
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    var cells = c.cells.map(function (cell, idx) {
      /* v23（需求 4）：官府 4 格交给宫殿整体渲染，这里跳过 */
      if (cell.official) return '';
      return ui.buildCellHTML(cell, idx, c, { M: M, col: idx % COLS, row: Math.floor(idx / COLS) });
    }).join('') + ui.govPalaceHTML(c, M);
    /* v25（需求 1）：城墙不再挂文字牌 —— 等级与操作都在点击后弹出的城墙面板里 */
    /* v89.128：环城一圈 = **城墙建筑的视觉** —— 修了才画；热区常在（未建时点它=修建） */
    var board = ui.isoBoard(COLS, ROWS, cells, {
      wall: (c.wall && c.wall.build) ? 'full' : 'ghost',   /* v89.169：0 级 = 虚线虚影（可见入口） */
      wallHit: true, wallAction: 'open-wall' });
    GAME.ensureExtGrid(c);
    /* ============================================================
     * v22（需求 3）：**中央只留城池与地块**
     * 原先棋盘上方堆了五样东西 —— 城池名/坐标/官府、人口·驻军·城防·城外、
     * 征收黄金+冷却、显示比例、州郡岁贡 —— 把唯一该看的东西压到屏幕下半截，
     * 而且截图里那句「就绪 · 以民心换金」既不是数据也不是操作提示，纯噪声。
     * 现在：城池身份与数值 → 侧栏「城池属性」；征收/缩放/岁贡 → 侧栏「城池操作」。
     * 连"城内共 N 格 · 点击地块弹出详情"这类玩法说明也一并去掉（需求 5 的延续）。
     * ============================================================ */
    return '<div class="ui-page city-pure">' +
      '<div class="city-iso" style="' + ui.zoomStyle() + '">' + board + '</div>' +
      '</div>';
  };
  /* 注意：GAME.extUsed(city) 已由 domain.js 提供（v14 按城池独立），此处不再重复定义 */

  /* 建筑分类配色（城内）：让空格一眼能分出功能类型 */
  var BLDG_CAT = {
    guanfu: 'gov', minfang: 'prod',
    junying: 'mil', xiaochang: 'mil', chengqiang: 'mil', majiu: 'mil', tiejiangpu: 'mil', gongjiangzuofang: 'mil',
    shuyuan: 'cult', zhaoxianguan: 'cult', kezhan: 'cult',
    shichang: 'com', honglusi: 'com', yizhan: 'com', fenghuotai: 'com',
    cangku: 'store'
  };
  /* 城外资源地块配色：按资源类型分色 */
  var EXT_CAT = { farm: 'farm', forest: 'wood', quarry: 'stone', mine: 'iron' };

  /* ============================================================
   * 等距地块渲染（v16 重制）
   * ------------------------------------------------------------
   * 由 (col,row) 直接算出格心的屏幕坐标（标准 2D 等距投影）：
   *     x = (col - row) * halfW
   *     y = (col + row) * halfH
   * 地块用 clip-path 裁成菱形；建筑 SVG 的**底边对齐格心**，
   * 不再做反向旋转的「立牌」—— 地块与建筑融为一体，不再悬浮错位。
   * 城墙是**外圈一匝墙环**（clip-path 环形，nonzero 挖洞），不占任何格。
   * ============================================================ */
  /* ============================================================
   * 地块投影（v18）：平行四边形剪切投影
   *   · 地块是平行四边形而非菱形 —— 整体轮廓不再是菱形，观感更接近原版斜视棋盘
   *   · 建筑底边落在**格心**（元素盒的 50%/50% 正好是格心），不再悬浮错位
   *   · 有建筑的地块隐去色块（CSS .built），只留建筑 + 基座阴影 —— 不再是"两层"
   *   · 城墙只占一条 13px 窄带，且 z-index 低于地块 → 永不遮挡建筑
   * ============================================================ */
  /* v20：地块是**正方形**（边长 88）。元素盒 = 地块本身，
     格心即元素盒的 50%/50% —— 建筑图标居中就正对格心，几何上不可能错位。
     TILE_SKEW 保留为 0（历史代码可能引用），不再参与定位。 */
  /* v25（需求 4）：地块 88 → 76，按**平板**（1024×768）适配。
     算一遍最宽的一屏：1024 − 左右内边距 24 − 侧栏间距 10 − 侧栏 288 = 702px；
     城外是 8 列：8×76 + 2×26 = 660 ≤ 702 ✓（88 时是 730，会横向溢出）。 */
  ui.TILE_W = 76;
  ui.TILE_H = 76;
  ui.TILE_SKEW = 0;

  /* ------------------------------------------------------------
   * 棋盘尺寸自适应（v27 · 需求 9）
   * ------------------------------------------------------------
   * 设计基准 1180×820，但格子边长**不写死** —— 按实测容器算：
   *   窗口大 → 格子大（更好点、图标更清楚）；窗口小 → 格子小（不溢出）。
   * `ui.viewBoxSize` 在 jsdom 下拿不到布局（clientWidth 恒 0），
   * 于是回落到基准值 —— 测试因此仍然是确定性的。
   * ------------------------------------------------------------ */
  ui.DESIGN = { w: 1180, h: 820 };
  ui.SIDE_W = 283;          /* v43：CSS 侧栏宽度已固定为 283px（原为 clamp(272px,24vw,320px) 浮动值），
                               这里必须与之一致 —— 两处不一致时"按基准算"与"按实测算"会给出不同结果 */
  ui.viewBoxSize = function () {
    var el = null;
    try { el = document.getElementById('view-container'); } catch (e) { el = null; }
    var w = (el && el.clientWidth) ? el.clientWidth : (ui.DESIGN.w - 20 - 8 - ui.SIDE_W);
    var h = (el && el.clientHeight) ? el.clientHeight : (ui.DESIGN.h - 46 - 16);
    return { w: Math.floor(w), h: Math.floor(h) };
  };
  /* 求格边长：把 cols×rows 连同外沿一起塞进可用空间，四周留 16px 呼吸 */
  ui.fitTile = function (cols, rows, opt) {
    opt = opt || {};
    var box = ui.viewBoxSize();
    var availW = box.w - (opt.extraW || 0) - (opt.pad == null ? 0 : opt.pad) - 16;
    var availH = box.h - (opt.extraH || 0) - (opt.pad == null ? 0 : opt.pad) - 16;
    var s = Math.floor(Math.min(availW / cols, availH / rows));
    /* v40（需求 2）：上限 96 → 160。老板要"尽量填充界面" ——
       8 列 × 6 行在 1288×888 的可用区里算出来是 ~140，被 96 卡住后
       棋盘只占屏幕三分之二，剩下的全是留白。上限只作防极端值，实际尺寸
       仍由 availW/cols 与 availH/rows 的较小者决定（小窗口自然变小）。 */
    return Math.max(opt.min || 40, Math.min(opt.max || 160, s));
  };
  /* 城内 / 城外：改的是全局 TILE_W/H（isoMetrics 每次调用时读取，天然跟随） */
  ui.fitBoard = function (cols, rows) {
    var s = ui.fitTile(cols, rows, { pad: ui.WALL_PAD * 2 });
    ui.TILE_W = s;
    ui.TILE_H = s;
    return s;
  };
  /* v25（需求 1）：城墙不再紧贴地块 —— 中间留一段空隙，整体成一圈"环"。
     GAP 是空隙，PX 是带宽（同时也是点击热区厚度）。 */
  ui.WALL_GAP = 8;
  ui.WALL_PX = 18;
  ui.WALL_PAD = 8 + 18;  // = GAP + PX，版面外凸距离
  ui.TILE_R = 10;        // 地块圆角（与 .tile-face 一致）
  /* 保留接口（旧代码/测试引用）；正方面不用 clip-path，靠 border-radius */
  ui.tileClip = function () { return 'none'; };

  /* v20：正方形棋盘度量。棋盘 = cols×W 宽、rows×H 高，行列等距，无错位 */
  ui.isoMetrics = function (cols, rows) {
    var W = ui.TILE_W, H = ui.TILE_H, wp = ui.WALL_PAD;
    var bw = cols * W;                 // 棋盘宽
    var bh = rows * H;                 // 棋盘高
    return {
      w: bw + wp * 2, h: bh + wp * 2,  // 含城墙带的总版面
      bw: bw, bh: bh, W: W, SH: 0, H: H, wall: wp, r: ui.TILE_R,
      /* 地块元素左上角（含城墙边距） */
      x: function (col, row) { return wp + col * W; },
      y: function (col, row) { return wp + row * H; },
      clip: ui.tileClip(),
    };
  };

  /* 棋盘外沿（平行四边形四角，不含城墙带）—— 用于城墙描边 */
  ui.isoOutline = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    return [[0, 0], [cols * M.W, 0], [cols * M.W, rows * M.H], [0, rows * M.H]];
  };

  /* ============================================================
   * 城墙（v25 · 需求 1）
   * ------------------------------------------------------------
   * 改前：一圈 13px 窄带紧贴棋盘，外加一枚「🧱 城墙 Lv9 · 点击升级」文字牌。
   * 改后：
   *   · 与地块**留出空隙**（GAP），整体是一圈独立的"环"
   *   · 环上有城墙该有的东西：夯土墙身、雉堞（垛口）、压顶亮线、四角角楼
   *   · **不再有任何文字** —— 等级在官府屋面板与城墙面板里看；
   *     需要操作时点这圈墙即可（热区见 ui.wallHitHTML）
   * ============================================================ */
  /* v89.169：墙环**几何唯一出口** —— 带参数（WALL_PX）与四角（带中心线）只在这里算。
     实墙（isoWallSVG）与未修建虚影（isoWallGhostSVG）共用同一份，
     保证「待建的墙」与「建成的墙」永远落在同一条带上（改 WALL_PX / 内距只动一处）。 */
  ui.wallRingGeom = function (cols, rows) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    /* 描边以「带中心线」为准：外壁贴容器边，内壁距外壁 w */
    var hw = w / 2;
    var pts = [
      hw.toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + hw.toFixed(2),
      (cw - hw).toFixed(2) + ',' + (ch - hw).toFixed(2),
      hw.toFixed(2) + ',' + (ch - hw).toFixed(2),
    ].join(' ');
    return { w: w, cw: cw, ch: ch, hw: hw, pts: pts };
  };
  ui.isoWallSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var w = _g169.w, cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;
    /* 角楼：四面墙交角处的一座小墩台（含垛口与压顶） */
    var tower = function (x, y) {
      var t = 26;
      return '<g class="wtower">'
        + '<rect x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="' + t + '" rx="3.5" fill="url(#wallBody)"/>'
        + '<rect x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="6" rx="3" fill="url(#wallTop)"/>'
        + '<path d="M' + (x - t / 2 + 2) + ' ' + (y - t / 2 + 6) + ' H' + (x + t / 2 - 2)
          + '" stroke="rgba(0,0,0,.45)" stroke-width="1.4"/>'
        + '<path d="M' + (x - t / 2 + 4) + ' ' + (y - t / 2 + 12) + ' h4 M' + (x - 2) + ' ' + (y - t / 2 + 12)
          + ' h4 M' + (x + t / 2 - 8) + ' ' + (y - t / 2 + 12) + ' h4" stroke="rgba(255,240,205,.20)" stroke-width="2.4"/>'
        + '<rect x="' + (x - 4) + '" y="' + (y + 2) + '" width="8" height="9" rx="4" fill="rgba(0,0,0,.42)"/>'
        + '</g>';
    };
    return '<svg class="iso-wall" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">'
      + '<defs>'
      /* 夯土墙身：上端受光、下端吃影 */
      + '<linearGradient id="wallBody" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#6a6255"/><stop offset=".45" stop-color="#4a4438"/>'
      +   '<stop offset="1" stop-color="#2a251d"/></linearGradient>'
      /* 压顶：暗金一线，这是全图唯一允许的暖色 */
      + '<linearGradient id="wallTop" x1="0" y1="0" x2="0" y2="1">'
      +   '<stop offset="0" stop-color="#c9a24b"/><stop offset="1" stop-color="#6d5220"/></linearGradient>'
      + '</defs>'
      /* ① 墙身 */
      + '<polygon points="' + pts + '" fill="none" stroke="url(#wallBody)" stroke-width="' + w + '"/>'
      /* ② 雉堞：外半侧的垛口（虚线做成垛） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(226,214,180,.34)" stroke-width="'
        + Math.max(4, w - 8) + '" stroke-dasharray="7 6"/>'
      /* ③ 墙根落影（外沿一圈暗线，把墙"压"在地上） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="2" transform="translate(0,2)"/>'
      /* ④ 压顶亮线（外沿） */
      + '<polygon points="' + pts + '" fill="none" stroke="url(#wallTop)" stroke-width="2.4"/>'
      /* ⑤ 内壁收口（与地块之间那圈空隙的边界） */
      + '<polygon points="' + pts + '" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.6"'
        + ' transform="scale(1)" style="transform-box:fill-box;transform-origin:center;"/>'
      /* ⑥ 四角角楼 */
      + tower(hw, hw) + tower(cw - hw, hw) + tower(cw - hw, ch - hw) + tower(hw, ch - hw)
      + '</svg>';
  };

  /* ============================================================
   * v89.169（老板）：「城墙 0 级的时候不明显，整得明显一点」
   * ------------------------------------------------------------
   * 病根：0 级（从未修建 / 破城掉回 0）时 `wall.build = null` → isoWallSVG 整段不画，
   *   城内视角**一无所有**；而城墙的唯一入口就是这圈（空格菜单还把城墙剔除了），
   *   于是"想修墙的人在棋盘上找不到墙"。
   * 现在：未修建 = 一圈**虚线虚影**（墙基土垄 + 虚线墙线 + 四角虚影角楼位），
   *   几何与实墙同源（wallRingGeom）；热区照旧（点虚影 = 打开「修建城墙」）。
   * 口径：实墙（完整形制）↔ 虚影（待修建）—— 虚影**不表示等级**，等级只看面板；
   *   配色走 CSS 的 `--gold-rgb`（暗底发亮 / 浅底加深，四套主题自适应）。
   * ============================================================ */
  ui.isoWallGhostSVG = function (cols, rows) {
    var _g169 = ui.wallRingGeom(cols, rows);
    var cw = _g169.cw, ch = _g169.ch, hw = _g169.hw, pts = _g169.pts;
    var t = 26;                                   /* 角楼墩台尺寸与实墙一致（虚影 = 待建位） */
    var corner = function (x, y) {
      return '<rect class="wghost-corner" x="' + (x - t / 2) + '" y="' + (y - t / 2) + '" width="' + t + '" height="' + t
        + '" rx="3.5" fill="none" stroke="rgba(201,162,75,.55)" stroke-width="1.6" stroke-dasharray="5 4"/>';
    };
    return '<svg class="iso-wall iso-wall-ghost" width="' + cw + '" height="' + ch + '" viewBox="0 0 ' + cw + ' ' + ch + '">'
      + '<polygon class="wghost-base" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.12)" stroke-width="' + _g169.w + '"/>'
      + '<polygon class="wghost-line" points="' + pts + '" fill="none" stroke="rgba(201,162,75,.74)" stroke-width="2.4" stroke-dasharray="10 7"/>'
      + corner(hw, hw) + corner(cw - hw, hw) + corner(cw - hw, ch - hw) + corner(hw, ch - hw)
      + '</svg>';
  };

  /* 城墙点击热区（v25 · 需求 1）：四条独立的带，只覆盖墙环，不侵入棋盘。
     用 HTML 元素而不是 SVG —— SVG 只有描边时命中判定不稳（填充区域才是热区）。 */
  ui.wallHitHTML = function (cols, rows, action) {
    var M = ui.isoMetrics(cols, rows);
    var w = ui.WALL_PX, cw = M.w, ch = M.h;
    var a = ' data-action="' + (action || 'open-wall') + '"';
    return '<div class="wall-hit top"' + a + ' style="left:0;top:0;width:' + cw + 'px;height:' + w + 'px;"></div>'
      + '<div class="wall-hit bottom"' + a + ' style="left:0;top:' + (ch - w) + 'px;width:' + cw + 'px;height:' + w + 'px;"></div>'
      + '<div class="wall-hit left"' + a + ' style="left:0;top:0;width:' + w + 'px;height:' + ch + 'px;"></div>'
      + '<div class="wall-hit right"' + a + ' style="left:' + (cw - w) + 'px;top:0;width:' + w + 'px;height:' + ch + 'px;"></div>';
  };

  ui.isoBoard = function (cols, rows, inner, opt) {
    opt = opt || {};
    var M = ui.isoMetrics(cols, rows);
    /* v42（需求 1）：棋盘不再需要分城内外 —— 留缝已统一为 `.iso-board .tile-face`
       的 1px 内缩（v41 曾用 opt.cls 给城外挂 .ext-board 做特例，现已收掉）。 */
    return '<div class="iso-board" style="width:' + M.w + 'px;height:' + M.h + 'px;'
      + '--tile-clip:' + M.clip.replace(/"/g, '') + ';">'
      /* v89.169：wall 三态 —— 'ghost' = 未修建虚影环；其余真值 = 已修建实墙；假值 = 不画。
         （城墙 0 级的可见入口：以前 0 级整圈不画，棋盘上找不到墙。） */
      + (opt.wall === 'ghost' ? ui.isoWallGhostSVG(cols, rows)
        : (opt.wall ? ui.isoWallSVG(cols, rows) : ''))
      + inner
      + (opt.wallHit ? ui.wallHitHTML(cols, rows, opt.wallAction) : '')
      + '</div>';
  };

  /* 单个地块。o 需带 M（度量）、col、row
     注意：元素盒宽 = W+SKEW、高 = H，其 **50%/50% 正好是格心**，
     所以建筑只需 left/top 50% + translate(-50%,-100%) 就"站"在格心上。 */
  /* ============================================================
   * 格内单元（v20）
   *   · 地块与建筑**同位同尺寸**：图标居中，不再 translateY 上浮
   *   · 名字与等级写在格内底部的一行标签里（需求 1）
   *   · 施工中显示图标 + 居中百分比 + 底部进度条
   * ============================================================ */
  /* ============================================================
   * 建筑「高度」随等级（v39 · 需求 2/3）
   * ------------------------------------------------------------
   * 老板要"从建筑高度…搞出一点区分度"。做法不是把图标整体放大，
   * 而是**底部固定、向上长**（CSS 里 transform-origin: 50% 100%）：
   * 于是 lv1 的小屋与 lv12 的大殿在同一格里的"占地"一样，
   * 只是高出来的部分更多 —— 这才是"建筑长高"的观感。
   * 系数收在唯一一处：0.018/级，满级(lv12) 约 +20%。
   * ============================================================ */
  ui.lvlScale = function (lv) {
    var n = Math.max(1, Math.min(12, Number(lv) || 1));
    return (1 + (n - 1) * 0.018).toFixed(3);
  };

  ui.isoCell = function (o) {
    var M = o.M;
    var left = Math.round(M.x(o.col, o.row));
    var top = Math.round(M.y(o.col, o.row));
    var cls = 'iso-tile ' + (o.cls || '');
    var attr = o.act ? ' data-action="' + o.act + '"' + (o.idx != null ? ' data-idx="' + o.idx + '"' : '') : '';
    var inner = '';
    if (o.pending) {
      /* 升级中：建筑本体仍在（图标 + 名称 + 进度）；新建：施工占位 */
      inner = (o.icon
          ? o.icon + '<span class="tile-pct" data-' + (o.kind === 'ext' ? 'ext' : 'build') + '-progress="' + o.kind + ':' + o.idx + '">' + (o.pct || '…') + '</span>'
          : '<span class="tile-scaf">⚒</span><span class="tile-pct" data-' + (o.kind === 'ext' ? 'ext' : 'build') + '-progress="' + o.kind + ':' + o.idx + '">' + (o.pct || '…') + '</span>') +
        '<span class="tile-pbar"><i data-build-bar="' + o.kind + ':' + o.idx + '" style="width:' + (o.pctNum || 0) + '%"></i></span>' +
        (o.name ? '<span class="tile-label"><span class="nm">' + o.name + '</span></span>' : '');
    } else if (o.addHint) {
      inner = '<span class="iso-add">＋</span>';
    } else {
      /* v23（需求 2/3）：**等级只在格内右上角显示数字**，底部标签只留名字。
         原先等级挤在底部标签里（"军营 3"），一眼扫过去分不清哪个是名字哪个是等级。 */
      var lab = '';
      if (o.name) lab = '<span class="tile-label"><span class="nm">' + o.name + '</span></span>';
      var badge = o.lvl
        ? '<span class="tile-badge' + (o.lvlMax ? ' max' : '') + '">' + o.lvl + '</span>'
        : '';
      inner = (o.icon || '') + badge + lab;
    }
    return '<div class="' + cls + '"' + attr + (o.sel ? ' data-sel="1"' : '') +
      ' style="left:' + left + 'px;top:' + top + 'px;width:' + M.W + 'px;height:' + M.H + 'px;">' +
      '<i class="tile-face"></i>' +
      '<span class="tile-art"' + (o.lvScale ? ' style="--lvs:' + o.lvScale + '"' : '') +
        '>' + inner + '</span>' +
      '</div>';
  };

  ui.buildCellHTML = function (cell, idx, city, pos) {
    var M = pos.M, col = pos.col, row = pos.row;
    if (cell.pending) {
      var pr = GAME.buildProgress('city', idx);
      var isUp16 = (cell.pending.targetLevel || 1) > 1;
      var pb16 = DATA.BUILDINGS[cell.pending.buildId];
      return ui.isoCell({ M: M, col: col, row: row, cls: 'busy', idx: idx, act: 'build-cell', kind: 'city',
        pending: true, pct: (pr ? pr.label : '…'), pctNum: (pr ? pr.pct : 0),
        icon: (isUp16 && cell.build) ? GAME.icons.forBuilding(cell.build.id) : null,
        name: (isUp16 ? ((pb16 ? pb16.name : '建筑') + ' 升级中') : '') });
    }
    if (!cell.build) {
      return ui.isoCell({ M: M, col: col, row: row, cls: 'empty', idx: idx, act: 'build-cell', addHint: true });
    }
    var b = DATA.BUILDINGS[cell.build.id];
    var isGov = cell.official && cell.build.id === 'guanfu';
    /* v20：等级只传数字，满级另行标注（写法从 "Lv3满" 改为 "3 满"） */
    var isMax = cell.build.lvl >= GAME.buildCapOf(city, cell.build.id);
    if (!isGov) {
      /* v23：只传数字（"满"由绿色角标表达，不再拼进文本） */
      /* v39：挂 `ser-<系列>` —— 城内建筑按行当分色（数据侧唯一来源 DATA.SERIES）
         v89.107（老板）：「有警报时，建筑烽火台颜色明暗闪烁」——
         烽火台格在**预警窗内**挂 .alarm（CSS 做明暗呼吸），窗口口径走唯一出口
         GAME.invasionAlertOf（与军务·烽火页、报信消息同源）。 */
      var alarm = (cell.build.id === 'fenghuotai' && GAME.invasionAlertOf && GAME.invasionAlertOf(city)) ? ' alarm' : '';
      return ui.isoCell({ M: M, col: col, row: row,
        cls: 'built ser-' + (b.series || 'gov') + alarm, built: true, idx: idx, act: 'build-cell',
        icon: GAME.icons.forBuilding(cell.build.id), name: b.name,
        lvl: cell.build.lvl, lvlMax: isMax, lvScale: ui.lvlScale(cell.build.lvl) });
    }
    /* 官府 4 格（v23 · 需求 4）：不再逐格渲染 —— 由 ui.govPalaceHTML 跨格画成一座宫殿，
       这里只返回一个占位锚点（保持格序稳定，便于测试与几何断言）。 */
    return '';
  };

  /* ============================================================
   * 官府宫殿（v23 · 需求 4）
   * ------------------------------------------------------------
   * 官府**固定占 4 格**（2×2，位于棋盘正中 —— 第三行 4-5 与第四行 4-5，见 GAME.govCellsOf），
   * 数据上仍是 4 个普通格（建造队列、迁移保护、存档都依赖这个结构），
   * 但视觉上按 4 格的包围盒**融合成一座宫殿**：
   *   台基 → 台阶 → 檐柱 → 一层飞檐 → 二层主体 → 二层飞檐 → 屋脊鸱吻 → 金匾
   * 此前是一格立图标、其余三格压暗当"台基"，看起来像"地砖上插了个图标"。
   * ============================================================ */
  ui.govPalaceHTML = function (city, M, opt) {
    var idxs = [];
    city.cells.forEach(function (x, i) { if (x.official) idxs.push(i); });
    if (!idxs.length) return '';
    var c0 = 99, c1 = -1, r0 = 99, r1 = -1;
    idxs.forEach(function (i) {
      var cc = i % city.col, rr = Math.floor(i / city.col);
      if (cc < c0) c0 = cc; if (cc > c1) c1 = cc;
      if (rr < r0) r0 = rr; if (rr > r1) r1 = rr;
    });
    var left = Math.round(M.x(c0, r0)), top = Math.round(M.y(c0, r0));
    var W = (c1 - c0 + 1) * M.W, H = (r1 - r0 + 1) * M.H;

    var main = city.cells[idxs[0]];
    var lvl = (main.build && main.build.lvl) || 1;
    var b = DATA.BUILDINGS.guanfu;
    var isMax = b && main.build && main.build.lvl >= GAME.buildCapOf(city, 'guanfu');
    var pending = idxs.some(function (i) { return !!city.cells[i].pending; });
    var pr = pending ? GAME.buildProgress('city', idxs[0]) : null;

    /* 宫殿本体：台基 → 台阶 → 柱 → 双层飞檐 → 屋脊 → 匾额 */
    var svg =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" class="gov-svg">' +
      '<defs>' +
        '<linearGradient id="govRoof" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#6b4a3a"/><stop offset="100%" stop-color="#3d2a20"/></linearGradient>' +
        '<linearGradient id="govBody" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#7a3a2c"/><stop offset="100%" stop-color="#4a211a"/></linearGradient>' +
        '<linearGradient id="govBase" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#4a4238"/><stop offset="100%" stop-color="#2a251e"/></linearGradient>' +
        '<linearGradient id="govGold" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#e8c878"/><stop offset="100%" stop-color="#b8892f"/></linearGradient>' +
      '</defs>' +
      /* 台基 */
      '<path d="M6 88 h88 v8 h-88 Z" fill="url(#govBase)"/>' +
      '<path d="M6 88 h88 v1.6 h-88 Z" fill="rgba(255,255,255,.14)"/>' +
      '<path d="M10 86 h80 v2 h-80 Z" fill="rgba(255,255,255,.07)"/>' +
      /* 台阶 */
      '<path d="M40 96 h20 v4 h-20 Z" fill="#3a332b"/>' +
      '<path d="M37 93 h26 v3 h-26 Z" fill="#453d33"/>' +
      /* 檐柱 */
      '<g fill="#6a3a2a">' +
        '<rect x="18" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="34" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="62" y="56" width="4" height="30" rx="1"/>' +
        '<rect x="78" y="56" width="4" height="30" rx="1"/>' +
      '</g>' +
      /* 一层主体 + 门窗 */
      '<rect x="14" y="58" width="72" height="28" fill="url(#govBody)"/>' +
      '<rect x="44" y="66" width="12" height="20" rx="1" fill="#2a1510"/>' +
      '<rect x="26" y="66" width="9" height="9" rx="1" fill="#c9a24b" opacity=".55"/>' +
      '<rect x="65" y="66" width="9" height="9" rx="1" fill="#c9a24b" opacity=".55"/>' +
      /* 一层飞檐（两端上翘） */
      '<path d="M6 58 Q30 46 50 46 Q70 46 94 58 Q72 52 50 52 Q28 52 6 58 Z" fill="url(#govRoof)"/>' +
      '<path d="M6 58 q-4 -3 -6 -7 q6 4 9 5 Z" fill="#6b4a3a"/>' +
      '<path d="M94 58 q4 -3 6 -7 q-6 4 -9 5 Z" fill="#6b4a3a"/>' +
      /* 二层主体 */
      '<rect x="28" y="36" width="44" height="10" fill="url(#govBody)"/>' +
      '<rect x="42" y="36" width="16" height="10" rx="1" fill="url(#govGold)" opacity=".85"/>' +
      /* 二层飞檐 */
      '<path d="M16 36 Q34 24 50 24 Q66 24 84 36 Q68 30 50 30 Q32 30 16 36 Z" fill="url(#govRoof)"/>' +
      '<path d="M16 36 q-4 -3 -6 -7 q6 4 9 5 Z" fill="#6b4a3a"/>' +
      '<path d="M84 36 q4 -3 6 -7 q-6 4 -9 5 Z" fill="#6b4a3a"/>' +
      /* 屋脊 + 鸱吻 */
      '<rect x="42" y="21" width="16" height="3.4" rx="1" fill="url(#govGold)"/>' +
      '<path d="M41 21 q-2 -4 1 -6 q1 3 2 4 Z" fill="#c9a24b"/>' +
      '<path d="M59 21 q2 -4 -1 -6 q-1 3 -2 4 Z" fill="#c9a24b"/>' +
      '<circle cx="50" cy="17" r="2.4" fill="#fff3cf"/>' +
      '</svg>';

    /* ============================================================
     * v36（需求 1「官府的贴图没变」）：官府位图优先
     * ------------------------------------------------------------
     * 官府是全城**唯一**不走 GAME.icons.forBuilding 的建筑 —— 它有下面这段
     * 专属手写 SVG（v23 把 4 格融成一座宫殿）。所以 v35 接入 AI 位图后，
     * 其它建筑都换了皮，只有官府还挂着原来那张手绘图。
     * 修复方式与图标层保持一致：位图优先、手写 SVG 退为兜底
     * （没生成位图 / 位图层未加载时，仍是原来那座宫殿，不会开天窗）。
     * ============================================================ */
    var bmSrc = (GAME.icons && GAME.icons.bitmapSrc) ? GAME.icons.bitmapSrc('building', 'guanfu') : '';
    var art = bmSrc
      ? '<img class="ico ico-img gov-img" src="' + bmSrc + '" alt="" draggable="false">'
      : svg;

    return '<div class="gov-palace' + (pending ? ' busy' : '') + '" data-action="build-cell" data-idx="' + idxs[0] + '"' +
      ' style="left:' + left + 'px;top:' + top + 'px;width:' + W + 'px;height:' + H + 'px;">' +
      '<i class="tile-face"></i>' +
      '<span class="gov-art">' + art + '</span>' +
      (lvl ? '<span class="tile-badge' + (isMax ? ' max' : '') + '">' + lvl + '</span>' : '') +
      '<span class="tile-label"><span class="nm">' + (b ? b.name : '官府') + '</span></span>' +
      (pending ? '<span class="tile-pbar"><i data-build-bar="city:' + idxs[0] + '" style="width:' +
        (pr ? pr.pct : 0) + '%"></i></span>' +
        '<span class="tile-pct" data-build-progress="city:' + idxs[0] + '">' + (pr ? pr.label : '…') + '</span>' : '') +
      '</div>';
  };

  /* 功能建筑 → 功能入口（点建筑直达其功能；功能归属明确）
     v68（老板「操作项命名合理」）：统一命名规范 ——
       · 格式：图标 + 用途短语；多功能面板写「用途A · 用途B」；
       · **名字要覆盖面板的全部内容**（点了名不副实就是误导）——
         例：官府入口原叫「征收」，面板里却有征调民力 / 本城特产 / 岁贡 / 改名，
         已改「官府事务」；校场/军营/作坊去掉与建筑名重复的抬头词。 */
  var BLDG_FUNC = {
    /* ⛔ v89.135 移除：guanfu 条目（"官府事务"按钮）—— 老板 10：「不再设置多一个
       '官府事务'按钮」：改名 / 主城 / 种田秘境**直接显示**在官府格的建筑面板（见官府要务段）。 */
    junying: { label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true },
    xiaochang: { label: "🏹 进入军务（出征 · 伤兵）", act: "open-xiaochang" },
    shuyuan: { label: "📜 科技 · 研究", act: "open-panel", view: "tech" },
    kezhan: { label: "🍶 招募将领", act: "open-inn" },
    zhaoxianguan: { label: "🎎 将领名录", act: "open-hostel" },
    shichang: { label: "🏪 交易", act: "open-market" },
    cangku: { label: "🏚️ 仓储", act: "open-store" },
    /* v89.80（老板）：「马概（厩）去除"坐骑装备"的建筑菜单及相应内容」——
       原菜单项点开的是「装备」总页（view: equip），与将领档案里的装备栏重复，
       且"坐骑"只是装备的一个部位，不值得在建筑里单开一个入口。
       撤掉后点马厩格只显示**属性行**（骑兵解锁 / 建筑专精），不再有功能按钮。
       装备与坐骑仍走两条既有的路：将领档案点部位换装、背包「装备」页选将穿戴。 */
    /* v89.140（老板 4）：「铁匠铺建筑菜单界面，**新增一行增加一个百炼强化按钮**，
       与打造菜单格式相同。将打造界面里的百炼强化按钮删去」——
       铁匠铺格上直接出现两颗功能键（打造 / 百炼强化），打造面板底部不再挂它。 */
    tiejiangpu: [{ label: "⚒️ 打造", act: "open-forge" },
      { label: "⚒️ 百炼强化", act: "open-enhance" }],
    gongjiangzuofang: { label: "🛠️ 器械 · 箭塔", act: "open-workshop", withIdx: true },
    /* v89.74（老板：「鸿胪寺已拆除…点击地块时提供可选项」）—— 门派驻地原本是
       "无功能面板"的 4 座建筑之一；现在它有了门：点城内门派格 → 门派面板
       （入派 / 立派 / 门派任务 / 品阶声望）。 */
    honglusi: { label: "⚔️ 门派", act: "open-sect" },
    /* v85（老板）：「民房不需要人口统计功能」—— 民房入口退役；
       「人口统计」面板本身保留（城防统计仍由此进入）。 */
    chengqiang: { label: "🧱 城防统计", act: "open-panel", view: "stats" }
  };

  /* ============================================================
   * 工匠作坊 · 器械与工事（v62 · 老板）
   * ------------------------------------------------------------
   * 老板：「工匠作坊可以造箭塔，箭塔默认参与防守」。
   *
   * 作坊本来就管"造攻守城器械"（原入口直接跳募兵面板的 siege 模式）；
   * 现在它多了一件事：**造箭塔**。所以入口改成这扇小面板，两块并排：
   *   · 制造器械 → 仍走原来的募兵面板（siege 模式），不复制任何配置；
   *   · 城防工事 → 就地建造箭塔（数量、造价、上限都读 domain 的唯一出口）。
   * ⚠️ 箭塔有**两个来源**（城防折出 / 作坊建造），所以面板必须把来源拆开写清楚，
   *    否则玩家会以为"我造了 6 座，怎么显示 18 座"。
   * ============================================================ */
  ui.openWorkshop = function (idx) {
    var c = GAME.currentCity();
    if (!c) return;
    var lv = GAME.buildingLevel(c, 'gongjiangzuofang');
    ui._workshopIdx = (idx == null || !isFinite(Number(idx))) ? null : Number(idx);
    var TW = DATA.WALL_TOWER;
    var built = GAME.towersBuiltOf(c);
    var fromDef = GAME.towersFromDef(c);
    var total = GAME.towerCountOf(c);
    var cap = GAME.towerCapOf(c);
    var room = GAME.towerRoomOf(c);
    var unit = GAME.towerCostOf(1);
    var costStr = GAME.costString(unit);
    var R = GAME.res(c);
    var afford = true;
    for (var k in unit) if ((R[k] || 0) < unit[k]) afford = false;
    var chips = room > 0
      ? [[1, '造 1 座'], [5, '造 5 座'], [999, '造满（' + room + ' 座）']].map(function (p) {
          return '<span class="chip" data-action="tower-build" data-city="' + c.id +
            '" data-n="' + p[0] + '" data-idx="' + (ui._workshopIdx == null ? '' : ui._workshopIdx) + '">' +
            p[1] + '</span>';
        }).join('')
      : '';
    ui.openShell({
      title: '🛠️ 工匠作坊 · Lv' + lv,
      sub: '器械制造与城防工事',
      /* 尺寸用**默认档**（660×620）而不是 sm：实测 sm（440×420）下正文超出 36px，
         会出现弹窗内滚动条 —— 那是老板明令禁止的（"弹窗内禁止下拉条，一律分页"）。 */
      body:
        '<div class="m-sec">制造器械</div>' +
        '<div class="op-row"><button class="btn gold" data-action="open-siege" data-idx="' +
          (ui._workshopIdx == null ? '' : ui._workshopIdx) + '">🛠️ 造冲车 / 投石车等</button></div>' +
        '<div class="op-zone"><div class="op-hint">器械随军出征，用于拆箭塔、破城墙。</div></div>' +
        '<div class="m-sec" style="margin-top:10px;">城防工事 · ' + TW.name + '</div>' +
        '<div class="attr"><span class="k">本城箭塔</span><span class="v">' +
          '<b style="color:var(--gold-light);">' + total + '</b> 座　<span class="ui-sub">（城防折出 ' +
          fromDef + ' ＋ 作坊自建 ' + built + '）</span></span></div>' +
        '<div class="attr"><span class="k">自建上限</span><span class="v">' +
          built + ' / ' + cap + '　<span class="ui-sub">作坊每级 +' + TW.buildMaxPerLv + ' 座</span></span></div>' +
        '<div class="attr"><span class="k">每座造价</span><span class="v">' + costStr + '</span></div>' +
        '<div class="attr"><span class="k">本城守备力</span><span class="v good">' +
          GAME.cityDefense(c) + '　<span class="ui-sub">每座自建箭塔 +' + TW.homeDef + '</span></span></div>' +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">' +
          '箭塔<b>默认参与防守</b>：造好即计入城头火力与守备力，无须指派。' +
          (room > 0 ? '' : '<br><b style="color:var(--amber);">已达上限 —— 升级作坊可再造。</b>') +
        '</div>' +
        '<div class="op-row" style="margin-top:6px;">' +
          (chips || '<span class="op-done">自建已满</span>') +
        '</div></div>',
      foot: '<div class="m-foot">' +
        (room > 0 && afford ? '' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* v89.86（整改 P-04）：前置未满足时的展示文案 —— 若前置建筑**正在升级中**
     且升完就够（队列 targetLevel ≥ 需求），改报「X 升级中（剩余 T），完成后可建」；
     否则回落标准 short（"需官府 Lv2"）。两个调用点共用：建造菜单卡片 / 建筑面板升级按钮。 */
  ui.prereqText = function (city, pre) {
    if (!pre || pre.ok) return '';
    var list = pre.list || [];
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var q = GAME.pendingUpgradeOf ? GAME.pendingUpgradeOf(city, o.bid) : null;
      if (q && (q.targetLevel || 0) >= o.need) {
        var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
        return o.name + '升级中（剩余 ' + U.durExact(left) + '），完成后可建';
      }
    }
    return pre.short;
  };

  /* ============================================================
   * v89.135（老板 11）：「建筑界面的升级按钮调整，费用改悬停显示，
   *   第一行显示资源，第二行显示所需珠宝，'费用'两个字不要。
   *   按钮变成第一行为升级两个字，第二行参考拆除按钮，LvX 到 LvX+1」——
   * 悬停费用文本的唯一出口（城内升级 / 城墙修建 / 城外升级三处共用）：
   *   第一行 耗时（增值：改前耗时散在别处）
   *   第二行 资源
   *   第三行 💎 珠宝（带持有数 —— 原面板行的"持有/需求"对比不丢）
   * 不出现"费用"二字。
   * ============================================================ */
  /* v89.161：逾溢折损周期的**现实时间换算**（唯一出口）——
     老板问「10 倍速下现实时间是多长」：一段"1 游戏日"在 10× 下 = 2.4 现实小时。
     这里按当前倍速换算，悬停/面板直接读它（改数据只改 DATA.OVERFLOW，文案自动跟）。 */
  ui.rotPeriodRealText = function () {
    var C = (typeof DATA !== 'undefined' && DATA.OVERFLOW) || {};
    var ts = Math.max(1, GAME.timeScale());
    var sec = ((C.periodGameHours == null ? 24 : C.periodGameHours) * 3600) / ts;
    var txt;
    if (sec >= 5400) txt = (Math.round(sec / 360) / 10) + ' 小时';
    else if (sec >= 90) txt = Math.round(sec / 60) + ' 分钟';
    else txt = Math.round(sec) + ' 秒';
    return txt + '（@' + ts + '×）';
  };

  ui.buildCostTip = function (cost) {
    if (!cost) return '—';
    var lines = [];
    if (cost.time) lines.push('耗时 ' + U.durExact(cost.time / Math.max(1, GAME.timeScale())));
    var resParts = [];
    for (var k in cost) {
      if (k === 'time' || k === 'jewel') continue;
      var name = k;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
      resParts.push(name + ' ' + U.fmt(cost[k]));
    }
    if (resParts.length) lines.push(resParts.join(' · '));
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var jp = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      jp.push('💎 ' + jn + ' ×' + need[jid] + '（持 ' + (inv[jid] || 0) + '）');
    }
    if (jp.length) lines.push(jp.join(' · '));
    /* v89.161（老板 5）：费用里含金时注明口径 —— 金全境通用，货品按本城结算 */
    if (cost.gold) lines.push('（金：全境通用 · 粮木石铁：按本城结算）');
    return lines.join('\n') || '—';
  };

  ui.openBuildModal = function (idx, cityId) {
    /* v89.174：cityId 可选 —— 弹窗 **live 每秒重开**时必须**锁定"打开弹窗的那座城"**
       （否则玩家切城后，重开会把同号格子开到另一座城上）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;                   /* 城池不存在（切档/拆除边界）：静默退出 */
    var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' = 环城槽（不占格） */
    ui._curGrid = idx;
    /* ============================================================
     * v89.135（老板 10）：「官府界面简化，首页功能直接显示（城池名称修改，
     *   主城设置，种田秘境入口）。不再设置多一个'官府事务'按钮」——
     * openGuanfu 整条退役，功能直接落进官府格的建筑面板（施工中/已建两分支共用，
     * 升级期间照常可用）；"在办事项"不搬（老板：已有专门菜单）。
     * ============================================================ */
    var guanfuBox = '';
    var _gfBid135 = cell.build ? cell.build.id : (cell.pending ? cell.pending.buildId : null);
    if (_gfBid135 === 'guanfu') {
      var rn135 = GAME.canRenameCity(c);
      var isMain135 = GAME.isMainCity(c);
      var isSelf135 = (c.type || 'self') === 'self';
      var sp135 = isSelf135 ? null : GAME.specialtyOf(c);
      var y135 = isSelf135 ? null : GAME.cityDailyYield(c);
      var m135 = sp135 && DATA.MATERIAL_BY_ID[sp135.mat] ? DATA.MATERIAL_BY_ID[sp135.mat].name : (sp135 ? sp135.mat : '');
      var yParts = [];
      if (y135) {
        yParts.push('金 +' + U.fmt(y135.gold) + ' · 声望 +' + U.fmt(y135.rep));
        if (m135) yParts.push('特产 ' + m135 + ' ×' + y135.qty[0] + '~' + y135.qty[1]);
      }
      /* v89.137（老板 4）：「官府怎么没有设定主城的选项。不要全境营造总览，重复。
         图标大小规格不一样」——
         ① 主城入口**常显**：不再是"已是主城就整条撤掉"（那会让玩家在主城上看不到
            任何"主城"字样、以为没这功能）—— 已是主城 → 状态标记 + 悬停写明迁都方法；
         ② 「全境营造总览」整条退役（`ui.openBuildOverview` / `GAME.buildOverview` /
            `GAME.rushAllBuilds` / 三个动作 case 一并删，防死代码）——老板判定与
            各建筑面板的提速重复；
         ③ 规格统一：四个按钮全部 `btn sm`（原先"种田秘境"用 btn gold = 36 高 / 14px 字，
            其余 26 高 / 12px —— 老板实测的"图标大小规格不一样"），
            图标统一 emoji 族（📝 / 🏛 / 🌾），不再混用 ✎（dingbat）与彩色 emoji。 */
      guanfuBox = '<div class="op-zone"><div class="op-zone-t">官府要务</div>' +
        '<div class="op-row" style="flex-wrap:wrap;">' +
          '<button class="btn sm' + (rn135.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
            (rn135.ok ? '' : ' disabled') + ' title="' +
            U.escape(rn135.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn135.msg) +
            '">📝 修改城名</button>' +
          (isMain135
            ? '<span class="btn sm dim main-here" title="' +
              U.escape('本城即主城。主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + '　（迁都：到目标城的官府点「设为主城」，需 '
                + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）') +
              '">🏛 本城即主城</span>'
            : '<button class="btn sm gold" data-action="set-main-city" title="' +
              U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + (GAME.mainCityOf()
                    ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                    : '　（首设免费）')) +
              '">🏛 设为主城</button>') +
          '<button class="btn sm gold" data-action="open-farm"' +
            ' title="种田秘境：个人田庄灵田种灵植，收高阶打造材料与资质灵草">🌾 种田秘境</button>' +
        '</div>' +
        (sp135 ? '<div class="attr"><span class="k">本城特产</span><span class="v">' + U.escape(m135) +
          '（' + sp135.tier + ' 阶）' +
          ui.help('如何收集本城特产：\n① 州郡岁贡 —— 每现实日自动入府，无需操作\n② 州治加成 —— 握有本州州城时，本州特产产量 ×' + DATA.STATE_SEAT_BONUS) +
          '</span></div>' : '') +
        (yParts.length ? '<div class="attr"><span class="k">岁贡 / 日</span><span class="v good">' +
          yParts.join(' · ') + '</span></div>' : '') +
        '</div>';
    }
    /* ============================================================
     * v89.177（老板「官府界面增加鼓舞民心，消减民怨的措施各 1 个，标题就叫民心/民怨，
     *   显示其值」）：「民心 / 民怨」段 —— 官府要务之下、在建队列之上。
     * 值走唯一出口（heartsOf/minyuanOf，民心=100−税率×100+安抚）；
     * 两个措施各每日一次、耗金币（doHeartsAction 出口，界面不预判可行性——
     * 按了不可行会返回原因并 toast；按钮只按"本日是否已行"置灰）。
     * ============================================================ */
    var heartsBox177 = '';
    if (GAME.heartsOf && GAME.heartsActionOf) {
      var hb177 = GAME.heartsOf(), my177 = GAME.minyuanOf();
      var mkAct177 = function (a) {
        if (!a) return '';
        /* data-action 必须**字面量**（audit 扫静态绑定：动态拼接 'hearts-' + id 会被判孤儿/不可达） */
        var cls177 = 'btn sm' + (a.ready ? ' gold' : '');
        var dis177 = a.ready ? '' : ' disabled';
        var tail177 = '（-' + U.fmt(a.cost) + ' 金 · +' + a.add + '）' + (a.ready ? '' : ' · 本日已行');
        var tip177 = '每日一次 · 消耗 ' + U.fmt(a.cost) + ' 金 · 安抚 +' + a.add + '（民心 / 民怨同步变化）';
        if (a.id === 'soothe') {
          return '<button class="' + cls177 + '"' + dis177
            + ' data-action="hearts-soothe" title="' + tip177 + '">🕊️ 消减民怨' + tail177 + '</button>';
        }
        return '<button class="' + cls177 + '"' + dis177
          + ' data-action="hearts-boost" title="' + tip177 + '">🎺 鼓舞民心' + tail177 + '</button>';
      };
      heartsBox177 = '<div class="op-zone"><div class="op-zone-t">民心 / 民怨</div>' +
        '<div class="attr"><span class="k">民心 / 民怨</span><span class="v"><b>'
          + Math.round(hb177) + '</b> / <b>' + Math.round(my177) + '</b>'
          + '<span class="ui-sub">　税率 ' + Math.round((s.tax || 0) * 100) + '% → 基准 '
          + Math.round(GAME.heartsBaseOf()) + '　安抚 ' + Math.round(GAME.heartsComfortOf())
          + '（随时间回落）</span></span></div>' +
        '<div class="attr"><span class="k">措施</span><span class="v">'
          + mkAct177(GAME.heartsActionOf('boost')) + ' ' + mkAct177(GAME.heartsActionOf('soothe'))
          + '</span></div>' +
        '</div>';
    }
    /* v89.174（老板 1）：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和剩余时间」
       —— 只挂官府格；行内倒计时挂 data-build-progress / data-ext-progress
       （updateProgress 每秒刷），整段由弹窗 live 重开跟随"完成 / 新增"。
       v89.174（老板 2）：「读秒完成后，状态还是在建造中」—— 施工中分支此前**没接 live**
       （正常态 v89.135 已接）：补上，完成瞬间弹窗自动换回功能面板；
       回调统一走 liveFn174（**锁定城池** —— 切城后重开不会把同号格开到别城）。 */
    var queueBox174 = '';
    if (_gfBid135 === 'guanfu') {
      var qs174 = (s.queues.build || []).filter(function (q) { return q.cityId === c.id; });
      queueBox174 = '<div class="op-zone"><div class="op-zone-t">在建队列（' + qs174.length + '）</div>' +
        (qs174.length ? qs174.map(function (q) {
          var bB = DATA.BUILDINGS[q.buildId];
          var bE = (DATA.EXT_BUILDINGS || {})[q.buildId];
          var nm = (bB && bB.name) || (bE && bE.name) || q.buildId;
          var what = q.type === 'build' ? '建造'
            : q.type === 'upgrade' ? ('升级至 Lv' + q.targetLevel)
            : q.type === 'ext_build' ? '城外营建'
            : ('城外升级至 Lv' + q.targetLevel);
          var pr = GAME.buildProgressOf(q);
          var attr = (q.type === 'build' || q.type === 'upgrade')
            ? ('data-build-progress="city:' + q.gridIndex + '"')
            : ('data-ext-progress="ext:' + q.extIdx + '"');
          return '<div class="attr"><span class="k">' + U.escape(nm) + '</span>' +
            '<span class="v">' + what + ' · <b ' + attr + '>' + (pr ? pr.label : '…') + '</b></span></div>';
        }).join('')
          : '<div class="attr"><span class="v" style="color:var(--text-dim);">本城暂无在建工程</span></div>') +
        '</div>';
    }
    var liveFn174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openBuildModal(idx, c.id);
    };
    if (cell.pending) {
      var pb2 = DATA.BUILDINGS[cell.pending.buildId];
      /* v19：升级是**纯后台过程** —— 施工期间该建筑的功能照常可用。
         只有「新建」（地块上还没建筑）才没有任何功能可进。
         判据：cell.build 存在即视为升级（targetLevel>1），
         于是军营施工中仍可募兵、书院施工中仍可研究、铁匠铺施工中仍可打造。 */
      var isUpgrade = !!(cell.build && (cell.pending.targetLevel || 1) > 1);
      var pr16 = GAME.buildProgress('city', idx);
      var progBlock =
        '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-h1);font-weight:800;margin:8px 0;" data-modal-progress="city:' + idx + '">' + (GAME.buildPct('city', idx) || '…') + '</div>' +
        '<div class="pbar" style="width:70%;margin:0 auto 10px;"><i data-build-bar="city:' + idx + '" style="width:' + (pr16 ? pr16.pct : 0) + '%"></i></div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);">后台施工中，倒计时每秒更新，<b style="color:var(--gold-light);">不影响下方操作</b></div>';
      var fn = isUpgrade ? BLDG_FUNC[cell.build.id] : null;
      /* v68（弹窗统一）：施工中弹窗与正常态**同构** ——「名称 · Lv→Lv」+ 描述，
         危险操作进底栏（设计规范 §11）。
         v73（老板）：「建筑点开界面，顶部的图标也不要留，还是旧图标」——
         顶部图标块整体撤除（城内 / 城外 × 正常 / 施工中 四处一起撤），
         v72 的 .dlg-ico 尺寸盒随之退休 —— 没有图标，就没有 1024px 撑爆的土壤。 */
      ui.openModal(
        '<div class="gold-heading">' + (pb2 ? pb2.name : '建筑') +
          (isUpgrade ? (' · Lv' + (cell.pending.targetLevel - 1) + ' → Lv' + cell.pending.targetLevel) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpgrade ? '🛠️ 升级中 · 后台施工，倒计时每秒更新，不影响下方操作'
                     : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        progBlock +
        (fn ? ('<div class="op-zone">' +
            /* v89.138（老板 4）：「建筑界面的"功能"两个字去掉，直接体现即可功能按钮」——
             标题行撤除，按钮直接呈现（施工中照常可用这层含义由上方"不影响下方操作"说明承担）。 */
            '<div class="op-row"><button class="btn gold" data-action="' + fn.act + '"' + (fn.view ? ' data-view="' + fn.view + '"' : '') +
              (fn.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + fn.label + '</button></div>' +
          '</div>')
          : '') +
        guanfuBox + heartsBox177 + queueBox174 +     /* v89.135：官府升级期间，改名/主城/秘境照常可用；v89.174：其下接「在建队列」 */
        '<div class="bldg-foot">' +
          /* v89.179b·P2-9：提速按钮显价（耗金不可逆但金额可见，与卸装/撤回行军同档，不加二次确认） */
          (function () {
            var _q = GAME.queueAt('city', idx);
            var _c = GAME.queueRushCost(_q);
            return '<button class="btn sm gold" data-action="rush-build" data-idx="' + idx + '"'
              + ' title="花金立即完成（工程价 20% × 剩余比例，约 ' + U.fmt(_c) + ' 金）">⚡ 提速'
              + (_c ? ' −' + U.fmt(_c) : '') + '</button>';
          })() +
          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFn174 });
      return;
    }
    if (!cell.build && idx === 'wall') {
      /* v89.128（老板）：「城墙以**环城一圈的城墙结构**作为一个建筑（地位与城内建筑同），
         而不是占据城内一个地块」—— 城墙不占格，没有"空地可选"，入口 = 环城热区；
         这里给「修建」面板（造价 / 前置 / 说明）。 */
      var wb128 = DATA.BUILDINGS.chengqiang;
      var wcost128 = wb128.buildCost;
      if (GAME.systems && GAME.systems.buffActive && GAME.systems.buffActive('buildCost')) wcost128 = GAME.applyBuildCostDiscount(wcost128);
      wcost128 = GAME.cityDefCostOf('chengqiang', wcost128);
      var wpre128 = GAME.buildPrereqOf(c, 'chengqiang', 1);
      var wcan128 = GAME.canAfford(wcost128) && wpre128.ok;
      var wsub128 = !wpre128.ok ? ui.prereqText(c, wpre128)
        : (GAME.canAfford(wcost128) ? ('耗：' + GAME.costString(wcost128) + '（城防技术已折扣）') : '材料不足');
      ui.openModal(
        '<div class="gold-heading">🧱 城墙（未修建）</div>' +
        (wb128.desc ? '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' + U.escape(wb128.desc) + '</div>' : '') +
        '<div class="ui-sub" style="text-align:center;margin-bottom:10px;">环城一圈的城墙结构 · 不占城内地块 · 与城内建筑同一套管理</div>' +
        '<div class="bldg-bottom"><div class="bldg-acts">' +
          /* v89.135（老板 11）：修建键同构 —— 费用进悬停、两行（修建 / Lv0 → Lv1）；
             "材料不足/前置"等无法悬停的即时状态仍留在第二行。 */
          '<button class="btn gold bldg-act"' + (wcan128 ? '' : ' disabled') +
            ' title="' + U.escape(wcan128 ? ui.buildCostTip(wcost128) : wsub128) + '"' +
            ' data-action="confirm-build" data-idx="wall" data-build="chengqiang">修建城墙<span class="ba-sub">' +
            (wcan128 ? 'Lv0 → Lv1' : U.escape(wsub128)) + '</span></button>' +
        '</div><div class="bldg-foot">' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">耐久 100×N 万 · 守军防御 +10N% · 远程射程 +3N%</span>' +
        '</div></div>');
      return;
    }
    if (cell.build) {
      var b = DATA.BUILDINGS[cell.build.id];
      /* v68 · 逐步探索：卡在官府等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */
      /* v89.159（老板 2）：与 upgradeAt 同一把尺 —— 传本座目标等级，
         否则面板会显示"需官府 Lv5"而内核（修好后）放行，界面与执行分裂。 */
      var preUp = GAME.buildPrereqOf(c, cell.build.id, cell.build.lvl + 1);
      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id) ? b.levelCost(cell.build.lvl) : null;
      var costStr = upCost ? GAME.costString(upCost) : (preUp.ok ? '已满级' : preUp.short);
      /* v89.104（老板「换成需要更多其他材料如珍珠等」）：高等级升级的**珠宝**单独一行 ——
         写"持有/需求"，缺料标红（与升级按钮的"材料不足"互相印证）。 */
      /* v89.135（老板 11）：面板上的珠宝行撤除 —— 费用（资源 + 珠宝两行）整体进**按钮悬停**
         （ui.buildCostTip · 含持有数对比，"缺不缺"信息不丢）。 */
      var jewelLine = '';
      var extra = '';
      if (b.id === 'minfang') extra = '<div class="attr"><span class="k">人口上限</span><span class="v good">' + b.pop[cell.build.lvl - 1] + '</span></div>';
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」—— 官府弹窗这两行退役。 */
      /* v89.102（老板）：口径 = **人马**（总兵力数），不是人口 —— 见 GAME.battle.marchCapOf */
      /* v89.132：改读 marchCapOf（唯一出口）—— 节钺校场扩编后，这里与校场面板同数 */
      if (b.id === 'xiaochang') extra = '<div class="attr"><span class="k">出征容量</span><span class="v">' + U.numText(GAME.battle.marchCapOf(c), 0) + ' 人马</span></div>';
      if (b.id === 'chengqiang') extra = '<div class="attr"><span class="k">耐久</span><span class="v">' + (100 * cell.build.lvl) + '万</span></div>' +
        '<div class="attr"><span class="k">守军防御</span><span class="v">+' + (10 * cell.build.lvl) + '%</span></div>';
      var bLv = cell.build.lvl;
      /* v28（需求 4/5）：军营面板必须列出**本营**的队列 ——
         玩家点开军营，看到的却是"可募兵种 12/18"，队列得去别处找。
         （队列数据本来就是按军营分的，只是这里从来没显示过。） */
      var barQueue = '';
      if (b.id === 'junying') {
        barQueue = ui.trainQueueBlock({ idx: idx, lvl: bLv }, c) +
          '<div class="ui-sub" style="margin-top:4px;">队列位 ' + GAME.trainQueueSlots(bLv, c) +
          '　（Lv5 / Lv10 / 满级各 +1 位）</div>';
      }
      if (b.id === 'junying') {
        var allT = Object.keys(DATA.TROOPS);
        var un = allT.filter(function (tid) { var u = DATA.TROOPS[tid].unlock || {}; return u.junying && bLv >= u.junying; });
        var nx = allT.filter(function (tid) { var u = DATA.TROOPS[tid].unlock || {}; return u.junying && u.junying === bLv + 1; });
        extra = '<div class="attr"><span class="k">可募兵种</span><span class="v">' + un.length + ' / ' + allT.length + '</span></div>'
          + (nx.length ? '<div class="attr"><span class="k">升 '+ (bLv+1) +' 级解锁</span><span class="v">' + nx.map(function(t){return DATA.TROOPS[t].name;}).join('、') + '</span></div>' : '');
      }
      if (b.id === 'shuyuan') {
        var tUn = DATA.TECH.filter(function (t) { return bLv >= t.lv; }).length;
        extra = '<div class="attr"><span class="k">可研究科技</span><span class="v">' + tUn + ' / ' + DATA.TECH.length + '</span></div>'
          + '<div class="attr"><span class="k">研究加速</span><span class="v">技巧每级 -5%</span></div>';
      }
      if (b.id === 'kezhan') extra = '<div class="attr"><span class="k">同时候选</span><span class="v">' + bLv + ' 位（每级+1）</span></div>';
      if (b.id === 'zhaoxianguan') extra = '<div class="attr"><span class="k">将领容量</span><span class="v">' + s.generals.length + ' / ' + bLv + '</span></div>';
      /* v89.158（老板 1）：① "本仓储量"改**本座**口径 —— 改前把上限总额 ÷ 等级和，
         还把城外堆场摊了进来（无仓库时干脆显示全额），数字对不上；
         ② "全境储量上限"标签错（v60 起仓储**按城**）→ 改"本城储量上限"。 */
      if (b.id === 'cangku') {
        var _sp158 = GAME.storePartsOf(c);
        var _per158 = _sp158.lv > 0 ? (_sp158.base / _sp158.lv) : _sp158.base;
        extra = '<div class="attr"><span class="k">本座储量</span><span class="v">' + U.fmt(Math.round(_per158 * bLv)) + '（Lv' + bLv + '）</span></div>'
          + '<div class="attr"><span class="k">本城储量上限</span><span class="v good">' + U.fmt(_sp158.total) + '（多仓叠加）</span></div>';
      }
      /* v89.62：去掉「商队 N 支」标注（老板「去除商队计数和限制，去除相应标注」）——
         市场等级真正影响的是**折损**，这里就只报折损。 */
      if (b.id === 'shichang') extra =
        '<div class="attr"><span class="k">卖出折损</span><span class="v">×' + Math.min(0.95, 0.6 + bLv * 0.035).toFixed(2) + '</span></div>' +
        '<div class="attr"><span class="k">买入折损</span><span class="v">再扣 ' + Math.round((GAME.marketBuyCfg().loss || 0) * 100) + '%</span></div>';
      if (b.id === 'majiu') extra = '<div class="attr"><span class="k">骑兵解锁</span><span class="v">轻骑需1级 · 铁骑/突骑需3级 · 虎豹/西凉需4级</span></div>';
      /* v89.157（老板 3）：「城墙等级不能低于官府超过 2 级」—— 面板显式给出"下一级要的城墙等级"，
         判据与升级拦截**同一出口**（buildPrereqOf 的 wallGate），不各算一份。 */
      if (b.id === 'guanfu') {
        var wl157 = GAME.buildingLevel(c, 'chengqiang');
        var need157 = Math.max(0, (cell.build.lvl + 1) - 2);
        var ok157 = wl157 >= need157;
        extra += '<div class="attr"><span class="k">城墙要求</span><span class="v' + (ok157 ? ' good' : '') + '">' +
          (need157 <= 0
            ? ('升 Lv' + (cell.build.lvl + 1) + ' 无城墙要求')
            : ('升 Lv' + (cell.build.lvl + 1) + ' 需城墙 ≥ Lv' + need157 + '（当前 Lv' + wl157 + (ok157 ? ' ✓' : ' ✗') + '）')) +
          '</span></div>';
      }
      /* v89.102（老板「主城随爵位逐步解锁官府及其他建筑等级上限」）：把"这一级上限
         是怎么来的"就地摊开 —— 本城是主城且爵位解锁 > 0 时才出这一行，
         否则玩家只会看到"已达最高等级"，不知道上限已被爵位抬高过。 */
      var _lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(c) : 0;
      if (_lift > 0) {
        var _cap = GAME.buildCapOf(c, b.id);
        /* v89.159（老板 2）：官府总闸（其他建筑 ≤ 官府等级）会先于"档位 + 爵位"生效 ——
           上限被官府压住时把**真正在限制它的那一条**写出来，
           否则玩家看到 Lv12 却读到"档位 24 + 爵位解锁 +3"，数字对不上账。 */
        var _theo = DATA.MAX_BLEVEL + GAME.cityBuildBonus(c) + _lift;
        var _govNow = GAME.buildingLevel(c, 'guanfu');
        var _why = (b.id !== 'guanfu' && _govNow > 0 && _cap <= _govNow && _govNow < _theo)
          ? ('受官府 Lv' + _govNow + ' 限制 · <b>升官府可提升</b>')
          : ('档位 ' + (DATA.MAX_BLEVEL + GAME.cityBuildBonus(c)) + ' + <b>爵位解锁 +' + _lift + '</b>');
        extra += '<div class="attr"><span class="k">等级上限</span><span class="v good">Lv' + _cap +
          '<span style="color:var(--text-dim);">（' + _why + '）</span></span></div>';
      }
      /* v60（需求 3）：**建筑专精写在这里**（老板：「写在对应建筑的介绍里就好，
         不要写在全境汇总」）。数据驱动 —— 本建筑在 DATA.MASTERY 里有条目就显示。
         v89.137（老板 5）：三档（12/24/36）—— 显示逐档进度与"当前 ×N / 下一档"，
         门槛与档数全读 DATA.MASTERY_TIERS / GAME.masteryTierOf（不手抄）。
         不逐个建筑手写文案：那又是一份平行数据，改一处忘一处。 */
      var mast = null;
      (DATA.MASTERY || []).forEach(function (m) { if (m.bid === b.id) mast = m; });
      if (mast) {
        var tiers137 = DATA.MASTERY_TIERS || [DATA.MAX_BLEVEL];
        var t137 = GAME.masteryTierOf(c, b.id);
        var prog137 = tiers137.map(function (t, i) {
          return 'Lv' + t + (t137 > i ? ' <b style="color:var(--green-ok);">✓</b>' : '');
        }).join(' → ');
        extra += '<div class="attr"><span class="k">建筑专精</span><span class="v' + (t137 > 0 ? ' good' : '') + '">'
          + prog137 + '　·　'
          + (t137 > 0 ? ('当前 <b>×' + t137 + '</b>：' + mast.txt) : ('Lv' + tiers137[0] + ' 起：' + mast.txt))
          /* tier 0 时"Lv12 起"本身已是目标，不再重复一条"下一档"；已到档才给"下一档/已满档" */
          + (t137 > 0
              ? (t137 < tiers137.length
                  ? '<span style="color:var(--text-dim);">（下一档 Lv' + tiers137[t137] + ' → ×' + (t137 + 1) + '）</span>'
                  : '<span style="color:var(--text-dim);">（已满档 ×' + tiers137.length + '）</span>')
              : '')
          + '</span></div>';
      }
      /* v89.135（老板 10）：`guanfuBox`（官府要务段）在函数顶部统一定义 ——
         施工中分支与已建分支共用（升级期间改名/主城/秘境照常可用）。 */

      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下）。
           v76（老板）：「这种备注去掉：招募将领…市井传闻查名将坐标」—— 那时撤的是
           **纯功能罗列**（功能各面板都已写明）；v89.113（老板）：「在各建筑名称下
           合适的地方写一个简要的说明…写得有历史感，大气沧桑一点」—— 现将
           **历史感的一句 + 功能要点**（DATA.BUILDINGS[].desc 已整体重写）加回标题正下方，
           与 v76 的诉求不冲突：短、居中小字、不占版面。 */
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +
        (b.desc ? '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">'
          + U.escape(b.desc) + '</div>' : '') +
        extra +
        guanfuBox + heartsBox177 + queueBox174 +
        jewelLine +
        barQueue +
        /* v68（弹窗统一 · 设计规范 §11）动线：① 功能「用建筑」（金色主按钮）；
           v76（老板）：「建筑的升级，拆除（1级，只能逐级拆除），移动/交换放在同一行上，
           并进行你的设计小巧思。建筑界面的关闭按钮在弹窗界面的最底部」——
           ② 操作三键**同排**、等宽，每键带一行小字说明后果（费用 / 降级去向 / 用途）；
           ③ 关闭单独一行、钉在弹窗最底部。 */
        (function () {
          /* v89.140：条目可以是**单条**或**数组**（铁匠铺 = 打造 + 百炼强化两颗） */
          var fs = [].concat(BLDG_FUNC[b.id] || []);
          if (!fs.length) return '';
          return '<div class="op-zone">' +
            /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
            '<div class="op-row">' + fs.map(function (f) {
              return '<button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
                (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>';
            }).join('') + '</div>' +
          '</div>';
        })() +
        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰，
           命中随机抽一篇完整故事直接在面板之上开卷（见本函数尾部）。 */
        /* v80（老板）：「升级，拆除（拆1级），移动/交换固定放在底部，关闭的上方」——
           三键与关闭合成一块**吸底操作区**（.bldg-bottom）：内容再长也钉在弹窗下沿，
           上排＝操作三键，下排＝关闭。 */
        '<div class="bldg-bottom">' +
          '<div class="bldg-acts">' +
          (upCost
            ? '<button class="btn gold bldg-act" data-action="confirm-upgrade" data-idx="' + idx + '"' +
                ' title="' + U.escape(ui.buildCostTip(upCost)) + '">升级' +
                '<span class="ba-sub">Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl + 1) + '</span></button>'
            /* v89.86（P-04）：前置升级中 → 报"X 升级中（剩余 T）"，不再像永久锁 */
            : '<button class="btn bldg-act dim" disabled>⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(ui.prereqText(c, preUp))) + '</span></button>') +
          '<button class="btn red bldg-act" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="拆除需二次确认">⛏ 拆 1 级<span class="ba-sub">' +
            (cell.build.lvl > 1 ? ('Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl - 1)) : '整座移除') + '</span></button>' +
          (b.id === 'guanfu' || b.id === 'chengqiang' ? ''   /* v89.128：城墙不占格，无"互换"可言 */
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      , { live: liveFn174 });
      /* v89.135（老板 7）：live 逐秒刷新 —— 募兵/建造队列完成即变（"队列还在"病根）
         v89.174：回调统一 liveFn174（锁城 + 城池失效自动关闭） */
      ui.sgTryTrigger('building', b.id);   /* v89.29 · 概率奇遇 */
    } else {
      /* 空地：选择建筑（弹窗式） */
      /* v19：**不再复制一份唯一建筑表**（曾因此出现「后端放行、前端禁用」的错位）。
         统一引用 domain.js 的单一数据源。 */
      var UNIQUE = GAME.UNIQUE_BUILDINGS;
      /* v20（需求 9）：分页取代内部滚动条 —— 每页 9 格（3×3），尺寸恒定
         v63（老板）：「在城内空地上选择建造的建筑类型时，把相应建筑的图标同步进去。
           不用写消耗的资源，悬停显示即可」
           → ① 图标换 `GAME.icons.forBuilding`（**与城内棋盘同一套图**：
                 AI 位图优先、矢量兜底；`data.icon` 那个 emoji 只在取不到图时兜底），
             ② 卡片上不再写费用，改为 `title` 悬停显示（作用 + 材料 + 状态）。
           只留"图标 + 名称 + 不可建的原因"：不可建原因是**当前事实**，必须看得见；
           费用是"要花多少"，选的时候看一眼就够，正适合悬停。 */
      /* v89.128：城墙不占格 —— 不在"空格菜单"里（入口 = 环城热区），从候选剔除 */
      var all = DATA.BUILD_ORDER.filter(function (bid) { return bid !== 'chengqiang'; }).map(function (bid) {
        var b = DATA.BUILDINGS[bid];
        var cost = GAME.costString(b.buildCost);
        var lockMsg = '', afford = '', tip = b.desc + '｜耗：' + cost;
        if (!GAME.canAfford(b.buildCost)) { afford = ' disabled'; lockMsg = '材料不足'; tip += '｜材料不足'; }
        if (UNIQUE[bid] && GAME.buildingLevel(c, bid) > 0) { afford = ' disabled'; lockMsg = '已建造(唯一)'; tip += '｜本城已建有（唯一建筑）'; }
        if (bid === 'guanfu') { afford = ' disabled'; lockMsg = '官府初始自带'; tip += '｜官府初始自带'; }
        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需客栈 Lv2"）
           v89.86（P-04）：前置升级中改报动态文案（ui.prereqText），不再像永久锁。 */
        var preB = GAME.buildPrereqOf(c, bid, 1);
        if (!preB.ok) {
          afford = ' disabled';
          var preTxt = ui.prereqText(c, preB);
          lockMsg = preTxt; tip += '｜' + preTxt;
        }
        var ic = GAME.icons.forBuilding(bid) || b.icon;
        return '<div class="troop-card bldg-pick' + afford + '" data-action="confirm-build" data-idx="' + idx +
          '" data-build="' + bid + '" style="cursor:pointer;" title="' + U.escape(tip) + '">' +
          '<div class="ticon">' + ic + '</div><div class="tname">' + b.name + '</div>' +
          (lockMsg ? '<div class="tstat" style="color:var(--red-light);">' + lockMsg + '</div>' : '') + '</div>';
      });
      var pgB = ui.modalPage('buildpick', all, 9, function () { ui.openBuildModal(idx); });
      ui.openShell({
        title: '🏗️ 选择要建造的建筑',
        sub: '城内功能建筑 · 共 ' + all.length + ' 种　·　第 ' + pgB.page + '/' + pgB.maxPage + ' 页',
        /* v63：图标从 emoji 换成与棋盘同一套（84px），卡片比原来高 ——
           实测 lg（860×600）正文超出 18px 会**出现弹窗内滚动条**（老板明令禁止），
           所以提到 xl（960×min(700,88vh)）：三列各宽 ~300px，卡片照样一目了然。 */
        size: 'xl',
        body: '<div class="troop-grid" style="grid-template-columns:repeat(3,1fr);">' + pgB.slice.join('') + '</div>' + pgB.pager,
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
    }
  };

  /* ============================================================
   * 官府面板（v24 · 需求 4/5）：征收
   * ------------------------------------------------------------
   * 征收归属官府（不是侧栏统计）：
   *   · 普通城池 → 5 大资源，以民力换物资
   *   · 名城     → 该州特产高阶材料
   * 顺便把「特产怎么来」讲清楚：岁贡（自动）+ 征收（手动）+ 州治加成。
   * ============================================================ */
  /* ⛔ v89.135 移除：`ui.openGuanfu`（官府面板）—— 老板 10：「官府界面简化，首页功能
     直接显示，不再设置多一个'官府事务'按钮，功能包括城池名称修改，主城设置，种田秘境入口。
     其他'在办事项 · 建造 / 募兵 / 自动 / 行军'这种不需要，已有专门菜单。」
     · 改名 / 主城 / 种田秘境 / 全境营造总览 → 官府格建筑面板的「官府要务」段（openBuildModal）；
     · 本城特产 / 岁贡 → 同段的两行 attr（信息不丢）；
     · 「在办事项」整块退役（建造队列看建筑面板 / 募兵看军营 / 行军看军务总览 —— 各有专门菜单）；
     · 爵位解锁的上限说明原在 liftLine → 早已由 openBuildModal 的 `_lift` 行承接。 */


  /* 城池重命名（v25 · 需求 8）：固定小窗，一个输入框 + 两个按钮 */
  ui.openRenameCity = function () {
    var c = GAME.currentCity();
    var chk = GAME.canRenameCity(c);
    if (!chk.ok) { ui.toast(chk.msg); return; }
    ui.openShell({
      title: '✎ 重命名城池',
      sub: '改名会同步到地图 / 侧栏 / 统计 / 战报等所有引用处',
      size: 'sm',
      body: '<div class="ui-sub" style="margin-bottom:6px;">新名字（12 字以内）</div>' +
        '<input type="text" id="rename-city-input" maxlength="12" value="' + U.escape(c.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-city">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* v77（老板）：「君主姓名（给一个改名按钮）」—— 与城池改名同一套小弹窗版式。
     域侧唯一出口 GAME.renameLord（同时改 ruler.name 与君主将领 g.name，两处同源）。 */
  ui.openRenameLord = function () {
    var s = GAME.state;
    ui.openShell({
      title: '✎ 君主改名',
      sub: '8 字以内 · 改名会同步到所有引用处',
      size: 'sm',
      body: '<input type="text" id="rename-lord-input" maxlength="8" value="' + U.escape(s.ruler.name) + '"' +
        ' style="width:100%;padding:8px;background:var(--slab-1);border:1px solid var(--gold-dark);' +
        'color:var(--text);border-radius:4px;text-align:center;">' +
        '<div class="op-row" style="justify-content:center;margin-top:12px;">' +
          '<button class="btn gold" data-action="do-rename-lord">确定</button>' +
        '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* v89.126：原「城墙」独立面板（openWallModal）退役 ——
     城墙占格后走**通用建筑面板**（ui.openBuildModal，含建造/升级/取消/提速）；
     环城热区 `open-wall` 由 main.js 转发到该面板。 */

  GAME.costString = function (cost) {
    var parts = [];
    for (var k in cost) {
      if (k === 'time') continue;
      if (k === 'jewel') {                    /* v89.104：珠宝需求（高等级建筑） */
        var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
        for (var jid in need) {
          var jn = '';
          (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
          parts.push('💎' + (jn || jid) + ' ' + need[jid]);
        }
        continue;
      }
      var name = '';
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
      if (!name) name = k;
      parts.push(name + ' ' + U.fmt(cost[k]));
    }
    return parts.join(' · ') || '—';
  };
  /* 造价里有没有珠宝（界面据此提示"缺什么珠宝"） */
  GAME.costJewelText = function (cost) {
    var need = GAME.jewelNeedOf ? GAME.jewelNeedOf(cost) : {};
    var out = [];
    var inv = (GAME.state && GAME.state.items) || {};
    for (var jid in need) {
      var jn = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) jn = x.name; });
      out.push(jn + ' ' + (inv[jid] || 0) + '/' + need[jid]);
    }
    return out.join('　');
  };

  /* --------- 城外（地块网格 · 弹窗式） --------- */
  ui.extHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    GAME.ensureExtGrid(c);
    var cap = GAME.extCap(c), used = GAME.extUsed(c);
    var all = GAME.extSummary ? GAME.extSummary() : null;
    var grid = GAME.extGridOf(c);
    /* v89.142（老板 1）：棋盘固定 **12×8**（96 = 整网格；几何常量唯一来源 = DATA.EXT_COLS/ROWS），
       地块落位走 GAME.extSlotOrder（**居中矩形逐圈扩张** · v89.157 老板「地块按建议」）——
       首档 12 块 = 规整 4×3 居中矩形（旧为"缺左上角的半环"）；尚未解锁的位置画**暗格**。
       画布与格子尺寸恒定：官府升级只多"亮"几格，版式不跳、行列不折。 */
    var COLS = DATA.EXT_COLS || 12, ROWS = DATA.EXT_ROWS || 8;
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    var order = GAME.extSlotOrder ? GAME.extSlotOrder() : null;
    var cells = grid.map(function (e, idx) {
      var slot = order ? order[idx] : { col: idx % COLS, row: Math.floor(idx / COLS) };
      var col = slot.col, row = slot.row;
      if (e.pending) {
        var pr = GAME.buildProgress('ext', idx, c.id);
        return ui.isoCell({ M: M, col: col, row: row, cls: 'busy', idx: idx, act: 'ext-cell', kind: 'ext',
          pending: true, pct: (pr ? pr.label : '…'), pctNum: (pr ? pr.pct : 0) });
      }
      if (!e.type) {
        return ui.isoCell({ M: M, col: col, row: row, cls: 'empty', idx: idx, act: 'ext-cell', addHint: true });
      }
      var eb = DATA.EXT_BUILDINGS[e.type];
      /* v20：产量不再单列一行（需求 1：名字与等级一行即可），悬停/点开看详情 */
      return ui.isoCell({
        M: M, col: col, row: row,
        cls: 'built res res-' + e.type, built: true, idx: idx, act: 'ext-cell',
        icon: GAME.icons.forExt(e.type), name: eb.name,
        lvl: e.lv, lvlMax: e.lv >= 10,
      });
    }).join('') + (order ? order.slice(grid.length).map(function (slot) {
      /* 未解锁暗格：不占交互（点了给解锁提示），只是"预留位"的视觉表达 */
      var nxLv = GAME.extNextLvOf ? GAME.extNextLvOf(c) : 0;
      return '<div class="iso-tile locked" data-action="ext-locked" style="left:' +
        Math.round(M.x(slot.col, slot.row)) + 'px;top:' + Math.round(M.y(slot.col, slot.row)) +
        'px;width:' + M.W + 'px;height:' + M.H + 'px;" title="' +
        (nxLv ? '官府 Lv' + nxLv + ' 可解锁更多地块' : '地块已至上限（96 = 12×8 满）') +
        '"><i class="tile-face"></i></div>';
    }).join('') : '');
    var board = ui.isoBoard(COLS, ROWS, cells, {});
    /* v22（需求 3）：与城内一致 —— 中央只留地块；
       城池名/块数在侧栏「城池属性」，显示比例与岁贡在侧栏「城池操作」。
       （all / used / cap 仍用于侧栏渲染，这里不再消费） */
    return '<div class="ui-page city-pure">' +
      '<div class="city-iso" style="' + ui.zoomStyle() + '">' + board + '</div>' +
      '</div>';
  };

  /* 城外地块弹窗：空地→选建 4 种资源建筑；已建→详情/升级 */
  ui.openExtModal = function (idx, cityId) {
    /* v89.174：与城内 openBuildModal 同构 —— 支持锁城重开（live 每秒刷新），
       施工/正常两态接 live（完成瞬间自动换形态，修"读秒完了还写着建造中"）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;
    var e = GAME.extGridOf(c)[idx];
    if (!e) return;
    var liveFnE174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openExtModal(idx, c.id);
    };
    if (e.pending) {
      var pendName = DATA.EXT_BUILDINGS[e.pending] ? DATA.EXT_BUILDINGS[e.pending].name : '建筑';
      var isUpE = !!e.type;
      var prE = GAME.buildProgress('ext', idx);
      /* v19：城外升级同样是后台过程 —— 施工期间**照常产出**（产量按当前等级计），
         只是不能改建/拆毁。面板要让玩家看到这一点，否则会以为停产了。 */
      var prodLine = '';
      if (isUpE) {
        var ebP = DATA.EXT_BUILDINGS[e.type];
        var phP = ebP.prod[e.lv - 1];
        prodLine = '<div class="attr"><span class="k">当前产出（施工中不停产）</span><span class="v good">' + U.perHourText(phP) + '/时</span></div>' +
          '<div class="attr"><span class="k">完工后 Lv' + (e.lv + 1) + '</span><span class="v">' + U.perHourText(ebP.prod[e.lv]) + '/时</span></div>';
      }
      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除） */
        '<div class="gold-heading">' + pendName + (isUpE ? (' · Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpE ? '🛠️ 升级中 · 后台施工，倒计时每秒更新（施工中不停产）' : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        prodLine +
        '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-h1);font-weight:800;margin:8px 0;" data-modal-progress="ext:' + idx + '">' + (GAME.buildPct('ext', idx) || '…') + '</div>' +
        '<div class="pbar" style="width:70%;margin:0 auto 10px;"><i data-build-bar="ext:' + idx + '" style="width:' + (prE ? prE.pct : 0) + '%"></i></div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);">后台施工中，倒计时每秒更新</div>' +
        '<div class="bldg-foot">' +
          (function () {
            var _q = GAME.queueAt('ext', idx);
            var _c = GAME.queueRushCost(_q);
            return '<button class="btn sm gold" data-action="rush-ext" data-idx="' + idx + '"'
              + ' title="花金立即完成（工程价 20% × 剩余比例，约 ' + U.fmt(_c) + ' 金）">⚡ 提速'
              + (_c ? ' −' + U.fmt(_c) : '') + '</button>';
          })() +
          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFnE174 });
      return;
    }
    if (e.type) {
      var eb = DATA.EXT_BUILDINGS[e.type];
      var prodH = eb.prod[e.lv - 1];
      var upCost = e.lv < GAME.buildCapOf(c) ? GAME.extBuildCost(e.type, e.lv) : null;
      var costStr = upCost ? GAME.costString(upCost) : '已满级';
      var eRef = GAME.demolishExtRefund(idx);
      ui.openModal(
        /* v73（老板）：顶部图标不留（与城内两处同批撤除） */
        '<div class="gold-heading">' + eb.name + ' · Lv' + e.lv + '</div>' +
        '<div class="attr"><span class="k">产量</span><span class="v good">' + U.perHourText(prodH) + '/时</span></div>' +
        /* v89.155（老板 5）：本块为全城堆场容量的贡献（唯一出口 extStoreCapOneOf，与总量同尺） */
        '<div class="attr"><span class="k">另加仓储上限</span><span class="v good">+' + U.fmt(GAME.extStoreCapOneOf(e)) + '</span></div>' +
        (eRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(eRef) + '</div>' : '') +
        /* v68（设计规范 §11）：与城内弹窗同一骨架 —— 功能行 / 升级行 / 底栏 */
        '<div class="op-zone">' +
          /* ⛔ v89.138（老板 4）：标题行撤除（同上） */
          '<div class="op-row"><button class="btn gold" data-action="ext-convert-ask" data-idx="' + idx + '">🔧 改建为其他资源建筑</button></div>' +
        '</div>' +
        /* v89.135（老板 11）：与城内同构 —— 费用整体进悬停（资源行 / 珠宝行），
           按钮两行（升级 / LvX → LvX+1）；"费用"字样与面板费用行一并撤除。 */
        '<div class="op-zone">' +
          '<div class="op-zone-t">升级</div>' +
          '<div class="bldg-acts">' +
            (upCost
              ? '<button class="btn gold bldg-act" data-action="ext-upgrade" data-idx="' + idx + '"' +
                  ' title="' + U.escape(ui.buildCostTip(upCost)) + '">升级' +
                  '<span class="ba-sub">Lv' + e.lv + ' → Lv' + (e.lv + 1) + '</span></button>'
              : '<span class="op-done">已达最高等级</span>') +
          '</div></div>' +
        /* v89.29（入口改版）：逸闻不再挂列表块 —— 开面板时由 ui.sgTryTrigger 掷骰（见本函数尾部）。 */
        '<div class="bldg-foot">' +
          (upCost ? '<button class="btn sm red" data-action="demolish-ask" data-kind="ext" data-idx="' + idx + '" title="返还累计投入的 50%（需二次确认）">拆毁</button>' : '<span></span>') +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>', { live: liveFnE174 }
      );
      ui.sgTryTrigger('ext', e.type);   /* v89.29 · 概率奇遇 */
      return;
    }
    /* 空地：选建资源建筑（v63：与城内那处同一套规矩 —— 图标同步、费用改悬停） */
    var used = GAME.extUsed();
    var cap = GAME.extCap(c);
    var list = DATA.EXT_BUILD_ORDER.map(function (eid) {
      var eb2 = DATA.EXT_BUILDINGS[eid];
      var cost0 = eb2.cost[0];
      var afford = GAME.canAfford(GAME.extBuildCost(eid, 0)) ? '' : ' disabled';
      var tip = eb2.desc + '｜耗' + U.fmt(cost0[0]) + '粮 · 产' + eb2.prod[0] + '/时' +
        /* v89.155（老板 5）：desc 已补（原先读 undefined → 悬停显示"undefined｜耗…"）；另加堆场信息 */
        '｜每级另加仓储上限 +' + U.fmt(Math.round((DATA.BASE_STORE || 0) / (DATA.EXT_STORE_DIV || 1))) +
        (afford ? '｜材料不足' : '');
      return '<div class="troop-card bldg-pick' + afford + '" data-action="ext-build" data-idx="' + idx +
        '" data-eid="' + eid + '" style="cursor:pointer;" title="' + U.escape(tip) + '">' +
        '<div class="ticon">' + (GAME.icons.forExt(eid) || eb2.icon) + '</div>' +
        '<div class="tname">' + eb2.name + '</div></div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🌾 选择资源建筑（' + used + '/' + cap + '块）</div>' +
      '<div class="troop-grid" style="grid-template-columns:repeat(2,1fr);">' + list + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* --------- 军队 --------- */
  /* 当前选中的兵种。
     注意：必须挂在 `ui` 上 —— 此处曾误写成 `GAME._trainSel`，而读取处一律是
     `ui._trainSel`（= GAME.ui._trainSel），两者是不同属性。结果是初始值丢失、
     训练按钮渲染成 data-troop="undefined"，点「训练」即报「参数错误」。 */
  ui._trainSel = 'yibing';
  /* v20：募兵数量改为**状态**（原先渲染函数直接读 DOM，导致面板未打开时算不准、
     且加减按钮重绘错对象而毫无反应） */
  ui._trainCount = 10;
  /* v16：募兵按建筑分流 —— 军营募常规兵、工匠作坊造器械（#14） */
  ui._trainFilter = 'normal';
  /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」；
     v81（老板）：「做成3页，第一页为募兵队列」—— 分页改三页制：
     que 募兵队列（首页） / inf 步兵 / cav 骑兵。 */
  ui._trainTab = 'que';
  ui.troopsHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!DATA.TROOPS[ui._trainSel]) ui._trainSel = 'yibing';   // 兜底：选中项必须存在
    /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」——
       常备兵按 DATA.TROOPS[].cat 拆页（inf 步兵 / cav 骑兵），ui._trainTab 记当前页；
       器械页（工匠作坊）维持单列表。选中项若不在本页，自动落到本页首位。
       v81（老板）：「做成3页，第一页为募兵队列，步兵骑兵底下就不要募兵队列了」——
       三页制：que 募兵队列（首页，队列独占一页）/ inf 步兵 / cav 骑兵。 */
    var isQueueTab = (ui._trainFilter !== 'siege' && ui._trainTab === 'que');
    var ids = Object.keys(DATA.TROOPS).filter(function (id) {
      var t = DATA.TROOPS[id];
      if (ui._trainFilter === 'siege') return !!t.craft;
      if (isQueueTab) return false;                 /* 队列页不出兵种卡 */
      if (t.craft) return false;
      return (t.cat || 'inf') === ui._trainTab;
    });
    if (ids.length && ids.indexOf(ui._trainSel) < 0) ui._trainSel = ids[0];
    var cards = ids.map(function (id) {
      var t = DATA.TROOPS[id];
      var chk = GAME.canTrain(id);
      var unlocked = chk.ok;
      /* v37（需求 1）：募兵资源**从卡面移到悬停浮层**（成本是决策信息，不必常驻卡面）。
         v89.114（老板「兵营招募界面，兵种的属性不再直接列出，改悬浮显示」）：
         卡面再撤一行 —— **连属性行一起进悬停浮层**，卡面只剩图标 + 名字；
         属性（含**负重**）与消耗、人口、耗时、未解锁原因全在浮层里，
         走全站唯一的 #tip-layer（v37），不另造弹窗。 */
      return '<div class="troop-card' + (unlocked ? '' : ' disabled') + (ui._trainSel === id ? ' selected' : '') + '" ' +
        'data-action="' + (unlocked ? 'select-train' : 'train-locked') + '" data-troop="' + id + '" data-tip-el="1">' +
        '<div class="ticon">' + GAME.icons.forTroop(t.id) + '</div><div class="tname">' + t.name + '</div>' +
        '<div class="tcard-tip tip-src">' +
          '<div class="tip-t">' + U.escape(t.name) + ' · 兵种属性</div>' +
          '<div class="tip-l">血 ' + t.hp + '　攻 ' + t.atk + '　防 ' + t.def +
            '　射程 ' + t.range + '　速度 ' + t.spd + '</div>' +
          '<div class="tip-l">负重 ' + t.load + '<span style="opacity:.65;">（随军运力 / 掠夺搬运）</span></div>' +
          '<div class="tip-l">募兵消耗：' + GAME.costString(t.cost) + '</div>' +
          '<div class="tip-l">人口 ' + t.pop + ' · 单兵耗时 ' + U.dur(t.time) + '</div>' +
          /* v89.180（老板 1）：拆械特性（床弩专属 · 有才显示） */
          (t.vsMech ? '<div class="tip-l">拆械 对器械伤害 ×' + t.vsMech + '</div>' : '') +
          (unlocked ? '' : '<div class="tip-a" style="color:var(--red-light)">' + U.escape(chk.msg || '') + '</div>') +
        '</div></div>';
    }).join('');
    var sel = DATA.TROOPS[ui._trainSel];
    var afford = GAME.canTrain(ui._trainSel).ok;
    /* v20：数量取自状态，不再读 DOM */
    var qty = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    var timeStr = sel ? U.dur((sel.time * qty) / GAME.timeScale()) : '';
    /* v28（需求 5）：按当前人口与资源算出的**可募上限**
       v89.86（整改 P-19）：上限为 0 时要**说清谁卡住**（人口 vs 资源）——
       归因走 GAME.trainLimitOf 唯一出口（maxTrainCount 是它的 cap 字段）。 */
    var limN = (sel && GAME.trainLimitOf) ? GAME.trainLimitOf(sel.id) : null;
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;
    var haveN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */
    /* v24（需求 8）：面板归属于**某一座军营**，并列出该军营自己的队列 */
    var isSiege = ui._trainFilter === 'siege';
    var kind = isSiege ? 'craft' : 'train';
    var bar = ui.trainBarracks();
    var slotsLeft = bar ? GAME.trainSlotsLeft(c, bar.idx, kind) : 0;
    /* v80（老板）：「募兵军营 城内第 46 格 · Lv11 · 队列位 3 这个也不需要」——
       所属工位的信息行撤除（空态保留：没有对应建筑时按钮会不可用，得让人知道为什么）。 */
    var barLine = bar ? ''
      : '<div class="q-empty">本城尚未建造' + (isSiege ? '工匠作坊，无法制造器械。' : '军营，无法募兵。') + '</div>';
    /* v80（老板）：「兵营招募·LV11这个不需要」—— 本函数里这行与弹窗标题重复，整行撤除
       （弹窗标题已有「⚔️ 兵营招募」，只留一处）；「N / M 种」解锁计数也不要（同批撤除）。 */
    var tabsHtml = ui._trainFilter === 'siege' ? ''
      : '<div class="train-tabs">' +
          '<button class="btn sm' + (ui._trainTab === 'que' ? ' gold' : '') + '" data-action="train-tab" data-page="que">📜 募兵队列</button>' +
          '<button class="btn sm' + (ui._trainTab === 'inf' ? ' gold' : '') + '" data-action="train-tab" data-page="inf">🗡 步兵</button>' +
          '<button class="btn sm' + (ui._trainTab === 'cav' ? ' gold' : '') + '" data-action="train-tab" data-page="cav">🐎 骑兵</button>' +
        '</div>';
    /* v81（老板）：队列独占「第一页」—— 步兵/骑兵页不再拖队列；
       工匠作坊（器械）维持旧结构（底部队列），未在本次改动范围。 */
    if (isQueueTab) {
      return '<div class="ui-page">' + tabsHtml +
        (bar ? ui.trainQueueBlock(bar, c, kind)
             : '<div class="q-empty">本城尚未建造军营，无法募兵。</div>') +
        '</div>';
    }
    return '<div class="ui-page">' + tabsHtml +
      barLine +
      '<div class="troop-grid">' + cards + '</div>' +
      '<div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;">' +
        '<span style="color:var(--gold-light);font-weight:700;">' + (sel ? sel.icon + ' ' + sel.name : '—') + '</span>' +
        '<label style="color:var(--text-dim);">数量</label>' +
        /* v80（老板）：「数量目前是-10，+10这样设计，可以直接输入，上限这个按钮保留」——
           ±10 按钮退役：数量直接输入（input 事件实时同步 ui._trainCount，不重绘、不跳顶）。 */
        '<input type="number" id="train-count" min="1" value="' + qty + '" style="width:96px;padding:6px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
        /* v28（需求 5）：上限按钮 —— 一次填到"人口与资源的短板" */
        '<button class="btn sm" data-action="train-max" title="按可用人口与资源填到最大可募数">上限</button>' +
        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +
        '<span class="ui-sub">驻军 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(haveN, 0) + '</b></span>' +
        /* v89.86（整改 P-19）：上限 0 → 当场归因（人口不足 / 资源不足），不再"静默归零" */
        ((maxN <= 0 && limN)
          ? '<span class="ui-sub" style="color:var(--red-light);">' +
              (limN.reason === 'pop'
                ? '⚠️ 可征人口不足（劳作占用 ' + U.fmt(GAME.popLaborOf(GAME.currentCity()))
                    + ' 不可征兵）—— 建民房或等待人口增长'
                : (limN.reason === 'res'
                    ? '⚠️ 资源不足 —— 缺 ' + ((limN.lack || []).map(function (k) { return GAME.resName(k); }).join('、') || '募兵所需资源')
                    : '当前不可募')) +
            '</span>'
          : '') +
        /* v89.86（整改 P-05）：募兵吃人口的说明常驻（此前零提示，"200→140"一脸问号）。
           v89.89（E3 · 100+ 轮实玩期待）：升级为**三段条**（可征 / 上限 / 增势）+ 进度条 ——
           人口与兵源的关系一眼可见；增势走 GAME.popGrowthOf 唯一出口（与 tickOnce 同源）。 */
        (sel ? (function () {
          var avail = GAME.popFreeOf(c);   /* v89.126：可征 = 人口 − 劳作占用（唯一出口） */
          var capP = GAME.maxPopOf(c) || 0;
          var grow = Math.round(GAME.popGrowthOf(c));
          var pct = capP > 0 ? Math.min(100, Math.round(avail / capP * 100)) : 0;
          /* v89.99：增势的来源分解（内政 / 增民令 / 税制）进悬停 —— 加成显性化 */
          var srcTxt = '';
          try {
            (GAME.popSourcesOf(c) || []).forEach(function (x) {
              if (Math.abs(x.v) > 1e-9) srcTxt += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
            });
          } catch (e) {}
          return '<span class="pop-3" title="可征＝人口 − 劳作占用（城市产业所占，不可征兵 · 当前劳作 '
            + U.fmt(GAME.popLaborOf(c)) + '）· 上限＝民房决定 · 增势＝现实每小时自然增长（基准 2 小时补满）' + srcTxt + '">' +
            '<span class="p3-k">人口</span>' +
            '<span class="p3-seg ok">可征 <b>' + U.numText(avail, 0) + '</b></span>' +
            '<span class="p3-seg">上限 <b>' + U.numText(capP, 0) + '</b></span>' +
            '<span class="p3-seg">增势 <b>+' + grow + '/时</b></span>' +
            '<span class="p3-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="p3-note">每兵占人口 ' + sel.pop + (capP > 0 && avail > capP ? '　· 超上限不增长' : '') + '</span>' +
            '</span>';
        })() : '') +
        /* v89.99（老板「设计兵种解散」）：解散 = 归农（人口返还、军资不退）。
           v89.110（老板「危险按钮能放训练旁边吗？这种人机交互理念符合常理吗」）：
           解散**移出本行** —— 收进下方独立「危险操作」区（红 + 二次确认）。
           主操作行只留正向动作：差点点到解散 = 迟早点到解散。 */
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled') + '>' + (ui._trainFilter === 'siege' ? '制造' : '训练') + '</button>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">约' + timeStr + '</span>' +
        (slotsLeft > 0
          ? '<span class="ui-sub">队列空位 ' + slotsLeft + '</span>'
          : '<span class="ui-sub" style="color:var(--amber);">' + (isSiege ? '本作坊' : '本营') + '队列已满' +
            (bar && GAME.trainNextSlotLv(bar.lvl) ? '（Lv' + GAME.trainNextSlotLv(bar.lvl) + ' 解锁下一个等待位）' : '') + '</span>') +
      '</div>' +
      /* v89.110（老板）：**危险操作独立成区** —— 红框 + 红按钮 + 二次确认，与训练（金）
         之间隔开一整行；确认弹窗写清"失去什么、返还什么"（openDisbandConfirm）。 */
      '<div class="op-zone danger" style="margin-top:var(--sp-mid);padding:var(--sp-2) var(--sp-mid);">' +
        '<div class="op-row">' +
          '<span style="color:var(--red-light);font-size:var(--fs-sub);font-weight:700;">⚠️ 危险操作</span>' +
          '<button class="btn sm red" data-action="troop-disband-ask" data-troop="' + ui._trainSel + '"' +
            (haveN > 0 ? '' : ' disabled') +
            ' title="解散本城驻军并归农（返还人口、军资不退；需二次确认）">解散所选兵种</button>' +
          '<span class="op-hint">归农返还人口 · 军资不退 · 需二次确认</span>' +
        '</div>' +
      '</div>' +
      (isSiege && bar ? ui.trainQueueBlock(bar, c, kind) : '') +
      '</div>';
  };

  /* --------- 将领 --------- */
  /* ============================================================
   * 将领界面（v41 · 需求 2）
   * ------------------------------------------------------------
   * 老板原话：「将领左侧显示姓名清单，右侧显示详细属性和装备图（不需要再整一个
   * 装备图的弹窗），把完整档案的全部信息也整合过来，不需要再整个单独弹窗」。
   *
   * 改前是「上方 3×2 卡片墙 + 下方简档」，再分别点「完整档案」「装备」弹出
   * 两个 lg 弹窗 —— 看全一个将领要开两次弹窗，且弹窗一盖住列表，想换人得先关掉。
   *
   * 改后一屏到底：
   *   左：姓名清单（小头像 / 资质 / 等级 / 装备数 / 忠诚告警 / 状态）
   *   右：该将领的**全部**信息 —— 身份、六维、当前效果、经验（可直接用道具）、
   *       体力·精力·忠诚、守将效果、装备栏（人形）、套装进度、赏赐、操作。
   * 自此将领只有**一个**界面，没有第二个弹窗。
   * ============================================================ */
  ui.GEN_SLOTS = 12;             /* 每页显示席位数（空着也画够 12 格） */
  /* v76（老板）：「左侧将领列表12个空格每页，平分空间吧，当城池超过12个将领，
     自动在底部导航栏产生翻页菜单」—— v45 的"整段滚动"回归**每页 12 席 + 底部条翻页**：
     每页固定 12 行（不足补空席、12 行平分面板高度），超过 12 位将领时
     翻页条登记到底部导航条（与其它长列表同一套机制）。 */
  ui.GEN_PER = 12;               /* 每页 12 席（= GEN_SLOTS） */

  ui.genStatusName = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? '守将' : g.status === 'mayor' ? '城主'
      : g.status === 'march' ? '出征中'
      : g.status === 'gather' ? '采集中'
      : g.status === 'garrison' ? '驻守野地' : '空闲';
  };
  ui.genStatusCls = function (g) {
    if (!g) return '';
    return (g.status === 'guard' || g.status === 'mayor') ? 'st-guard'
      : g.status === 'idle' ? '' : 'st-busy';
  };

  /* 一张席位卡：空席与有将都从这里出，保证尺寸绝对一致 */
  /* 一行席位：空席与有将都从这里出，保证行高绝对一致 */
  ui.genRow = function (g, idx, cap, selId) {
    if (!g) {
      return '<div class="gen-row empty">' +
        '<span class="grow-face">＋</span>' +
        '<span class="grow-main">' +
          '<b class="grow-name">第 ' + (idx + 1) + ' 席</b>' +
          '<span class="grow-sub">' + (idx >= cap
            ? '招贤馆需 ' + (idx + 1) + ' 级（现 ' + cap + ' 席）' : '空位 · 可在客栈招募') + '</span>' +
        '</span></div>';
    }
    var a = GAME.genAttrs(g);
    var rk = GAME.rankOf(g);
    var lowLoy = (g.loyalty || 0) < 50;
    /* v45（需求 1）：左清单"直接显示姓名和他的资质等级就好"，并去掉「装 0/12」。
       砍掉 Lv / 满 / 装 x/12；忠诚只在**低于 50 时**作为告警冒出来
       （正常值不必每行重复，它在右侧档案里）。
       v46（需求 1）：资质**另起一行** —— 并排太拥挤，而且姓名长短不一会让
       资质章左右跳动。这些被砍掉的量都在右侧 gen-pane 里，信息没丢。 */
    return '<div class="gen-row' + (g.id === selId ? ' sel' : '') + '"' +
        ' data-action="gen-pick" data-gen="' + g.id + '" data-tip-el="1">' +
      '<span class="grow-face">' + ui.faceOf(g, 30) + '</span>' +
      '<span class="grow-main">' +
        '<b class="grow-name">' + U.escape(g.name) +
          /* v89.80（老板）：「将领界面左侧将领栏，将领名称后增加 Lv.x 的等级标识」——
             v45 曾把 Lv 砍掉（当时要"只显示姓名与资质"）；现在按老板口径加回，
             放在**姓名之后**（不是资质那行），一眼可比强弱。 */
          '<span class="grow-lv">Lv' + (g.level || 1) + '</span>' +
          (GAME.isLordGeneral(g) ? '<span class="gcard-tag lord">君主</span>' : '') +
          (g.hero ? '<span class="gcard-tag hero">名将</span>' : '') +
          (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + '</b>' +
        '<span class="grow-sub">' + ui.rankBadge(g) +
          (lowLoy ? '<i class="grow-loy">忠 ' + Math.round(g.loyalty || 0) + ' ⚠</i>' : '') +
        '</span>' +
      '</span>' +
      '<span class="grow-st ' + ui.genStatusCls(g) + '">' + ui.genStatusName(g) + '</span>' +
      /* 悬停走全站唯一的 #tip-layer（v37），行内不自己绝对定位 */
      '<span class="tip-src"><div class="tip-t">' + U.escape(g.name) + ' · ' + rk.name + '</div>' +
        '<div class="tip-l">统 ' + a.tong + '　勇 ' + a.yw + '　智 ' + a.zm + '　政 ' + a.nz +
          '　速 ' + (a.spd || 0) + '　体 ' + a.staMax + '</div>' +
        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(GAME.systems.equipBagOf(g)).length + '/12' +
          '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0) +
          (GAME.isLordGeneral(g) ? '' : '　忠诚 ' + Math.round(g.loyalty || 0)) + '</div>' +
      '</span></div>';
  };

  /* ============================================================
   * 右侧详情（v41 · 需求 2）：**原先分散在「下方简档 + 完整档案弹窗 +
   * 装备栏弹窗」三处的信息，全部合并到这里**。
   * 分区顺序按「先看人、再看数、最后动手」排：
   *   身份 → 六维与当前效果 → 经验 → 状态（体力/精力/忠诚/装备属性）
   *   → 守将效果 → 装备栏（人形）→ 赏赐 → 操作
   * ============================================================ */
  ui.genPane = function (g) {
    if (!g) {
      return '<div class="gen-pane">' +
        '<div class="q-empty">左侧点一位将领，这里显示其完整档案与装备栏。</div></div>';
    }
    var s = GAME.state;
    var genId = g.id;
    var a = GAME.genAttrs(g);
    var rk = GAME.rankOf(g);
    var capLv = GAME.genLevelCap(g);
    var atCap = g.level >= capLv;
    var expNeed = GAME.expNeedOf(g);
    var pct = Math.max(0, Math.min(100, Math.round(((g.exp || 0) / Math.max(1, expNeed)) * 100)));
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var staMx = GAME.staMax(g), staNow = GAME.staNow(g);
    var staPct = Math.round(staNow / Math.max(1, staMx) * 100);
    /* v66：装备贡献的体力（走 genAttrs 的 staEq —— 与"装备提供"清单同一口径） */
    var staEqNow = a.staEq || 0;
    var hpBonus = Math.round(GAME.staHpBonus(g) * 100);
    var setB = GAME.systems.genSetBonus(g);
    /* v88：当前生效套（'sha' 军中 / 'ling' 修炼）—— 本面板所有装备读取按它分流；
       v89：非君主恒军装（修炼线君主专属） */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var isCult = GAME.canCultivate(g);
    var eqCnt = Object.keys(((isLing ? g.lingEquip : g.equip) || {})).length;
    /* v89.131（老板「精力的数值设定基于六维设计一个公式」）：
       上限 = GAME.energyMaxOf（六维加权公式，domain.js 唯一出口）。
       沿革：v89.116 曾借 `staMax` 当上限（GAME.energyMax 不存在）——
       那让"精力/上限"跟着体力涨而回复段又硬顶 100（两口径），本轮一并收口。 */
    var enMx = GAME.energyMaxOf(g);
    var enNow = GAME.energyNowOf(g);
    var eParts = GAME.energyPartsOf(g);
    var energyTip = '精力上限 ' + enMx + ' = 基准 ' + eParts.base
      + eParts.items.map(function (x) {
          return ' ＋ ' + x.n + ' ' + x.val + '×' + ((DATA.ENERGY.per || {})[x.k] || 0) + '=' + x.v;
        }).join('')
      + '\n（六维公式 · DATA.ENERGY）回复：现实时间 '
      + ((DATA.GEN_COST.recoverHours || 24)) + ' 小时回满（与倍速无关）';
    var bar = function (v, color) {
      return '<div class="gd-bar"><i style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + color + ';"></i></div>';
    };

    /* v54（老板："将领经验条放在顶上…整个加号，点击加号可以选用经验道具"）：
       经验从"左栏里一个分区 + 平铺每种道具两三个按钮"改成 **身份行内的经验条 + 右端一个「＋」**。
       理由与赏赐那次同源：道具一多就撑成好几行，而且"我还有几个"反而看不出来。 */
    var expItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'exp' && (s.items || {})[it.id] > 0;
    });
    var expHave = 0;
    expItems.forEach(function (it) { expHave += (s.items[it.id] || 0); });
    var atkShow = Math.round(a.atkPct * 1000) / 10;
    var defShow = Math.round(a.defPct * 1000) / 10;

    /* ---------- ① 顶部：汇总信息（身份行）+ 经验条 + 操作 ---------- */
    /* v74（老板需求 3）：「将领的简介…太啰嗦：赵子龙 良材 ★★ 均衡 / 可当一郡之任」
       —— 头部收成两行：
         ① 姓名 + 资质★（悬停 = 等级上限 / 每级成长）+ 类型（均衡 / 猛将…）
         ② 资质描述（截掉"等级上限 N。"那半句 —— 它已进悬停）
       撤下：Lv 行、状态与城池、装备 n/12（装备数在右栏标题里）。
       Lv 挪进经验行；状态非空闲时以小签挂在名字后（出征中 / 守将 这类需要一眼看到）。 */
    var styleName74 = '';
    (DATA.GEN_STYLES || []).forEach(function (x) { if (x.id === g.style) styleName74 = x.name; });
    var rkDesc74 = String(rk.desc || '').replace(/等级上限 \d+。?/, '').trim();
    var statusTag74 = (g.status && g.status !== 'idle')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';
    /* v77（老板）：内功修炼体系 —— 档案里加一行「内功 · 功法 N 重（属性 +X）」，
       悬停给出特性名与修习规则。加成本体在 GAME.genAttrs（唯一出口）。 */
    var ngLine77 = '';
    if (g.ng && g.ng.id) {
      var ngD77 = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD77 = x; });
      if (ngD77) {
        var ATTRS77 = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度' };
        ngLine77 = '<span class="gp-sub gp-ng" title="内功特性「' + ngD77.trait + '」：' +
          ATTRS77[ngD77.attr] + ' +' + ngD77.per + '/重，当前 +' + (ngD77.per * g.ng.lv) +
          '。修习同门秘籍可精进（最高 ' + (ngD77.maxLv || 10) + ' 重），换书即转修。">内功 · <b>' +
          U.escape(ngD77.name) + '</b> ' + g.ng.lv + ' 重（' + ATTRS77[ngD77.attr] + ' +' +
          (ngD77.per * g.ng.lv) + '）</span>';
      }
    }
    /* v89.93（整改 E14）：**资质晋升**一行 —— 下一档 / 所需灵草 / 持有数 / 一步到位。
       改前资质链在界面上没有任何入口（客栈只写"名世/天授只能靠灵草升档"，
       却不说灵草从哪来；实测连推演侧都不知道种子已在商城开售）。 */
    var rankUpLine = '';
    (function () {
      var order = (DATA.GEN_RANKS || []).map(function (x) { return x.id; });
      var ri = order.indexOf(g.rank || 'fan');
      if (ri < 0 || ri >= order.length - 1) return;              /* 已至顶级（天授）→ 不显示 */
      var nxt = DATA.GEN_RANKS[ri + 1];
      var herb = null;
      (DATA.ITEMS || []).forEach(function (it) { if (it.type === 'rank_up' && it.from === (g.rank || 'fan')) herb = it; });
      if (!herb) return;
      var haveH = ((GAME.state && GAME.state.items) || {})[herb.id] || 0;
      var crop = null;
      ((DATA.FARM && DATA.FARM.crops) || []).forEach(function (c) { if (c.herb === herb.id) crop = c; });
      var seed = null;
      if (crop) (DATA.ITEMS || []).forEach(function (it) { if (it.id === crop.seedItem) seed = it; });
      var btn = haveH > 0
        ? '<button class="btn sm gold" data-action="gen-rankup" data-gen="' + genId + '" data-item="' + herb.id + '">用《' + herb.name + '》晋升</button>'
        : (seed ? '<button class="btn sm" data-action="qb-item" data-item="' + seed.id + '" data-need="1">快购种子</button>' : '');
      rankUpLine = '<span class="gp-sub gp-rankup" title="资质晋升：灵草产自「官府 → 种田秘境」（种下种子 → 按游戏时间生长 → 收获即得）。' +
        '\n种子两条来源：商城购买 / 采集·征战缴获。' +
        '\n每次晋升另给**四维各 +' + (nxt.ascend || 0) + '**（灵草淬炼的根基加成，界面不另行提示）。">' +
        '资质晋升 → <b>' + nxt.name + '</b>（上限 Lv' + (nxt.lvCap || '?') + '）需《' + herb.name + '》' +
        ' · 持有 <b>' + haveH + '</b> 株' +
        (crop ? ' · 种子 ' + GAME.utils.fmt((seed ? (seed.price || 0) * 100 : 0)) + ' 金／秘境 ' + crop.hours + ' 游戏时' : '') +
        ' ' + btn + '</span>';
    })();
    var html = '<div class="gen-pane">' +
      '<div class="gp-head">' +
        '<span class="gp-face">' + ui.faceOf(g, 84) + '</span>' +
        '<span class="gp-id">' +
          '<b class="gp-name">' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + statusTag74 +
            /* v89.131（老板）：「解雇放在人名所在行右侧，稍带点距离」——
               从身份行右侧的操作列移进人名行（margin-left:auto 推到行右缘，
               padding-left 留出与姓名/标签的间距）。君主不给（v70 不可解雇）。 */
            (GAME.isLordGeneral(g) ? '' :
              '<span class="gp-nameops"><button class="btn sm" data-action="dismiss-gen"' +
                ' data-gen="' + genId + '">解雇</button></span>') +
          '</b>' +
          '<span class="gp-sub">' +
            '<span class="rank-badge r-' + rk.id + '" title="等级上限 ' + capLv +
              '，每级属性成长 +' + rk.grow + '">' + rk.name + ' ' + '★'.repeat(rk.star) + '</span>' +
            (styleName74 ? '<span class="gp-style">' + U.escape(styleName74) + '</span>' : '') +
          '</span>' +
          '<span class="gp-sub">' + U.escape(rkDesc74) +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
          rankUpLine +
          ngLine77 +
          '<span class="gp-exprow">' +
            '<span class="gd-expbar" title="经验 ' + U.numText(g.exp || 0, 0) + ' / ' +
              U.numText(expNeed, 0) + '"><i style="width:' + pct + '%;"></i></span>' +
            '<span class="gd-exptext">Lv<b>' + g.level + '</b>　经验 <b>' + U.numText(g.exp || 0, 0) + '</b> / ' +
              U.numText(expNeed, 0) + '　（' + pct + '%）</span>' +
            /* v66：到资质上限后按钮变暗并说明原因；**不禁用** ——
               点开能看到为什么不能吃经验（比"点了没反应"清楚）。 */
            '<button class="btn sm ' + (atCap ? 'dim' : 'gold') + ' gp-expadd" data-action="gen-exp-pick" data-gen="' + genId + '"' +
              ' title="' + (atCap ? '已达资质上限 Lv' + capLv + '，不能再使用经验道具'
                : expHave ? '用经验道具　背包 ' + expItems.length + ' 种 / ' + expHave + ' 个'
                : '背包中暂无经验道具') + '">＋</button>' +
            /* v58：这句原来在下面的操作行里，现在跟着经验条走（它讲的就是经验） */
            '<span class="gd-expleft">距 Lv' + (g.level + 1) + ' 还需 <b>' +
              U.numText(leftExp, 0) + '</b></span>' +
          '</span>' +
        '</span>' +
        /* v58（老板："守将和解雇可以放头像所在内容的右边"）：
           操作回到**身份行内部**、紧挨头像与身份信息右侧（v54 曾被移到下面一行）。
           竖排是为了不把身份行撑宽 —— 两个短按钮横排会把"经验条 + 数字"挤窄。 */
        '<span class="gp-ops">' +
          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +
          /* v89.113（老板需求 3）：城主（与守将同级）—— 一人一职，换职自动卸旧职 */
          '<button class="btn sm' + (g.status === 'mayor' ? ' red' : '') + '" data-action="assign-mayor" data-gen="' + genId + '">' +
            (g.status === 'mayor' ? '解除城主' : '任命城主') + '</button>' +
          /* v70（老板）：「不可解雇」—— 君主的档案里**不给解雇按钮**（守卫在域层，这里连入口都不给） */
        '</span>' +
      '</div>' +
      /* v70（老板）：「留可扩张框架」—— 君主特权清单（数据源 DATA.LORD_TRAITS，
         走 GAME.lordTraitsOf）。普通将领返回空数组 → 整块不渲染、不占高度。 */
      (GAME.lordTraitsOf(g).length
        ? '<div class="note" style="margin-top:4px;">👑 君主特权：' +
            GAME.lordTraitsOf(g).map(function (t) {
              return t.icon + ' <b>' + t.name + '</b> ' + t.desc;
            }).join('　') + '</div>'
        : '') +
      /* v46（需求 2）：档案拆成**三块**，位置固定下来 ——
         上＝汇总身份行（横贯全宽）；左下＝六维 / 状态 / 守将效果；右＝装备栏。
         分栏比例：左栏全是文字（表格自己会折行，窄一点无所谓），
         右栏要放人形与放大的将领抠图，必须给够宽度。 */
      '<div class="gp-body">' +
      '<div class="gp-col-l">';

    /* ---------- ② 左下：六维 + 当前效果 ----------
       v58（老板："守将效果…同步写在六维作用那里就好"）：
       该将现任守将时，把它**实际提供的守将加成**并进对应维的"作用"列 ——
       守将加成本来就出自六维（内政→产量/建造/税收、勇武→征兵、智谋→研究/城防），
       再单列一块"守将效果"就是把同一份数据说两遍（本项目最经典的失效模式）。 */
    var gbNow = (g.status === 'guard' && GAME.guardBonus)
      ? GAME.guardBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
    /* v89.113（老板需求 3）：该将现任城主时的**城主加成**（与守将并行、互斥） */
    var mbNow = (g.status === 'mayor' && GAME.mayorBonus)
      ? GAME.mayorBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
    /* v74（老板需求 4/6）：
       ①「每点作用也作为六维名称的鼠标悬停备注」—— 作用文案进名称格 title
         （守将加成同进 title —— 它原本并排显示在作用列里）；
       ②「就在原来每点作用这一列」放 **＋ 加点按钮**（六维都有：道具或自由点二选一）；
       ③「不要这个备注」—— 下方 带兵 / 人口上限 / 本城产量 / 速度 四行整块撤除
         （人口上限那半条随需求 1 一并下线；其余三行的数字在「状态」区与侧栏已有出口）。 */
    var PLUS_STATS74 = ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'];
    html += '<div class="gp-sec">六维</div>' +
      '<table class="tbl gd-dims"><thead><tr><th>六维</th><th class="ctr">数值</th><th class="ctr">加点</th></tr></thead><tbody>' +
        ui.GEN_DIMS.map(function (d) {
          var tip74 = '每点作用：' + d.use;
          var extra = (mbNow && d.mayorUse) ? d.mayorUse(mbNow)
            : ((gbNow && d.guardUse) ? d.guardUse(gbNow) : '');
          if (extra) tip74 += '\n' + extra;
          var plus74 = (PLUS_STATS74.indexOf(d.k) >= 0)
            ? '<button class="btn sm gd-plus" data-action="gen-stat-plus" data-gen="' + genId +
              '" data-stat="' + d.k + '" title="' + U.escape('用自由属性点或道具提升' + d.n) + '">＋</button>'
            : '';
          return '<tr><td title="' + U.escape(tip74) + '"><b style="color:' + d.color + ';">' + d.n + '</b></td>' +
            '<td class="ctr gd-v">' + (a[d.val || d.k] || 0) + '</td>' +
            '<td class="ctr gd-u gd-plus-c">' + plus74 + '</td></tr>';
        }).join('') +
        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」
           v89.131（老板）：「备注去掉：升级获得（每级 = 成长值）…或用道具」
           —— 说明文案撤下，只留数字（点右侧「＋」自然知道怎么用）。 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b></td></tr>' +
      '</tbody></table>';

    /* ---------- 状态（v54 · 老板） ----------
       ①「把总体，攻击，防御，体力（总体体力），精力放上，不要单独列装备的了」——
          老板对"总体"的定义：**将领自身基础 + 丹药 + 装备 + 其他（临时加成）后的总数**。
          四行的数值一律走这个合计口径；装备不再单列，而是作为**构成**写在括号里。
          它能成立是因为数据侧已经把来源合并了：丹药在 v26 就写进 g[attr]，
          临时加成在 genAttrs 里改 a[attr]，所以 a.atkVal / a.defVal / a.staMax 本身就是总数。
       ②「在忠诚右边加赏赐，别在下边整个大按钮」—— 赏赐入口从底部大按钮挪到忠诚行右侧。 */
    var loy = Math.round(g.loyalty == null ? 70 : g.loyalty);
    var loyColor = loy < DATA.LOYALTY.desertAt ? '#c05a4a' : loy < DATA.LOYALTY.warnAt ? '#c98a3a' : '#6a9a4a';
    var jewels = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'jewel' && (s.items || {})[it.id] > 0;
    });
    var jewelTotal = 0;
    jewels.forEach(function (it) { jewelTotal += (s.items[it.id] || 0); });
    /* v89.40（老板）：「君主不会掉忠诚」—— 忠诚行与赏赐入口对君主整体不适用
       （君主忠诚恒为 100：battle 战败守卫 + 本页不出行；普通将领一切照旧）。 */
    var isLordGen = GAME.isLordGeneral(g);
    /* v89.131（老板）：「体力精力应当设计加号按钮，供道具使用，参考赏赐」
       —— 两个「＋」的选择窗与赏赐同构：选项来自 DATA.ITEMS + 背包，不复制配置。 */
    var staItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'stamina' && (s.items || {})[it.id] > 0;
    });
    var staHave = 0;
    staItems.forEach(function (it) { staHave += (s.items[it.id] || 0); });
    var enItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'energy' && (s.items || {})[it.id] > 0;
    });
    var enHave = 0;
    enItems.forEach(function (it) { enHave += (s.items[it.id] || 0); });
    /* v89.131（老板）：「体力，精力列在攻击，防御上方。…忠诚列在最下方」
       —— 新行序：体力 → 精力 → 攻击 → 防御 → 忠诚（君主不适用忠诚行）。 */
    html += '<div class="gp-sec">状态</div>' +
      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，
         "出征消耗 / 低于 25 不可出征 / 侦查消耗"这类**规则解说**不常驻页面。
         v89.133（老板）：「将领的生命，体力行压缩成 1 行」；v89.136（老板 3）：
         「体力精力**只显示当前值**，进度条和加号按钮 —— 体力、精力和忠诚的进度条按钮等长，
         位置统一（不因数值变化而变化，给数值预留足够位置），加号显示在最右端」——
         定稿形态 = 三行同构：`标签 [当前值·定宽 60px] [进度条·定长 132px] …… [＋·贴右]`，
         上限/构成/全军生命/回复规则全部在悬停（.gd-num / .gd-line .gd-bar 见 index.html）。 */
      '<div class="gd-line" title="体力 ' + U.numText(staNow, 0) + ' / ' + U.numText(staMx, 0)
        + '（当前 / 上限）\n上限 = 等级/资质/内政 ' + U.numText(staMx - staEqNow, 0)
        + ' ＋ 装备 ' + U.numText(staEqNow, 0)
        + '\n全军生命 +' + hpBonus + '%（体力直接决定全军生命的厚度）'
        + '\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）">体力 <b class="gd-num">'
        + U.numText(staNow, 0) + '</b>' + bar(staPct, '#6a9a4a') +
        '<button class="btn sm gd-plus' + (staItems.length ? ' gold' : ' dim') + '" data-action="gen-sta-pick"' +
          ' data-gen="' + genId + '"' + (staItems.length ? '' : ' disabled') +
          ' title="' + (staItems.length ? '使用体力道具：背包 ' + staItems.length + ' 种 / ' + staHave + ' 件'
            : '背包中暂无体力道具。商城「体力」页签可购') + '">＋</button></div>' +
      /* 精力：主数字 = 当前值；上限由六维公式给出（悬停给逐项分解，同源 energyPartsOf） */
      /* v89.135（老板 6）：「体力，精力行参考忠诚，前方数值，后方进度条和加号，只占一行空间」——
         精力行去掉了重复的「121 / 291」灰色尾巴（它把行挤到折行），上限并进主数字 = 与体力行完全同构。 */
      '<div class="gd-line" title="' + U.escape('精力 ' + U.numText(enNow, 0) + ' / ' + U.numText(enMx, 0)
        + '（当前 / 上限）\n' + energyTip) + '">精力 <b class="gd-num">' + U.numText(enNow, 0) + '</b>' +
        bar(enNow / Math.max(1, enMx) * 100, '#4a9be0') +
        '<button class="btn sm gd-plus' + (enItems.length ? ' gold' : ' dim') + '" data-action="gen-energy-pick"' +
          ' data-gen="' + genId + '"' + (enItems.length ? '' : ' disabled') +
          ' title="' + (enItems.length ? '使用精力道具：背包 ' + enItems.length + ' 种 / ' + enHave + ' 件'
            : '背包中暂无精力道具。商城「精力」页签可购') + '">＋</button></div>' +
      /* 攻击 / 防御：v89.133（老板）：「'勇武 18,890 ＋ 装备 685'这个备注不要」——
         构成（勇武/智谋 × 系数 ＋ 装备）移入**悬停**；行上只留总数 + 全军加成。
         防御行为对称处理（同族同改，一并压回单行）。 */
      '<div class="gd-line" title="攻击 ' + U.numText(a.atkVal, 0) + ' = 勇武 '
        + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' + U.numText(a.atk, 0) + '">攻击 <b>'
        + U.numText(a.atkVal, 0) + '</b>' +
        '<span class="gd-hint">全军攻击 <b style="color:var(--green-ok);">+' + atkShow + '%</b></span></div>' +
      '<div class="gd-line" title="防御 ' + U.numText(a.defVal, 0) + ' = 智谋 '
        + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' + U.numText(a.def, 0) + '">防御 <b>'
        + U.numText(a.defVal, 0) + '</b>' +
        '<span class="gd-hint">全军防御 <b style="color:var(--green-ok);">+' + defShow + '%</b></span></div>' +
      /* v89.131（老板）：「忠诚列在最下方」—— 行序末位；赏赐入口仍在它右侧。 */
      (isLordGen ? '' :
      /* v89.136（老板 3）：「体力，精力和忠诚的进度条按钮等长，位置统一，加号显示在最右端」——
         忠诚行与另两行完全同构：数值定宽 + 条等长 + 右端「＋」（原「🎁 赏赐」收进悬停说明）。 */
      '<div class="gd-line" title="忠诚 ' + loy + ' / 100（当前 / 上限）\n赏赐珠宝可提升忠诚'
        + (loy < DATA.LOYALTY.warnAt ? '；当前偏低，谨防离心' : '') + '">忠诚 <b class="gd-num" style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm gd-plus' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">＋</button></div>');

    /* ---------- ③ 右侧：装备栏（人形，**内嵌**，不再开弹窗） ---------- */
    html += '</div><div class="gp-col-r">';
    var inv = {};
    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[GAME.eqId(x)];
      if (e && !!e.ling === isLing) inv[e.slot] = (inv[e.slot] || 0) + 1;   /* v88：只数当前套 */
    });
    /* 「装备贡献」= 带装属性 − 裸装属性：同一套取值口，不多算一处。
       v60（需求 1/2）：老板要求「装备栏右侧有重复的总属性…右侧把装备提供的属性
       分行显示即可：统帅 +775.5　勇武 +752.5 等等」。于是：
         ① **删掉那行带装总数**（统2751.5 勇2690.5…）—— 它是"总体"口径，
            与左栏「状态」区的攻击/防御/体力重复（同一组数字两个出口，
            本项目最经典的失效模式）；
         ② 装备贡献从"横排小字"改成**逐行**（全称 + 右对齐数值）——
            横排一多就挤成一团，看不出哪一项是大头。 */
    var bare = GAME.genAttrs({
      level: g.level, tong: g.tong, yw: g.yw, zm: g.zm, nz: g.nz, speed: g.speed,
      attack: g.attack, defense: g.defense, rank: g.rank, style: g.style,
      perm: g.perm || {}, equip: {},
    });
    var GAIN = [['tong', '统帅'], ['yw', '勇武'], ['zm', '智谋'], ['nz', '内政'],
      ['atk', '攻击'], ['def', '防御'], ['spd', '速度'],
      /* v66（老板）：「部分将领的体力没有加上装备的数值」。
         这一行原先读的是 `hp`（装备生命，另一条并行加成），列名却写「体力」，
         而装备体力对上限的贡献只有套装的 25/40/60 —— 两笔账对不上。
         现在装备体力（散件 + 套装件 + 套装档位）已经并进体力上限，
         这一行直接读 `staEq`，与左栏「状态 · 体力」是同一个数。 */
      ['staEq', '体力']];
    var gainRows = GAIN.map(function (p2) {
      /* v65（老板）：属性一律整数 —— genAttrs 已经取整，这里直接相减就是整数 */
      var d = Math.round((a[p2[0]] || 0) - (bare[p2[0]] || 0));
      if (!d) return '';
      return '<div class="eq-grow"><span class="k">' + p2[1] + '</span>' +
        '<span class="v">' + (d > 0 ? '+' : '') + d + '</span></div>';
    }).join('');
    /* v88：修炼侧加一行「灵力」（游历战力；差值法不适用 —— 直接用汇总出口） */
    var lingRow = '';
    if (isLing && GAME.lingPowerOf) {
      var lp = GAME.lingPowerOf(g);
      if (lp) lingRow = '<div class="eq-grow"><span class="k">灵力</span><span class="v">+' + lp + '</span></div>';
    }

    /* v89：双轨 tab 只给君主（修炼线君主专属）；普通将领整块切换行不渲染 */
    html += '<div class="gp-sec" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '装备栏（' + eqCnt + ' / 12）' +
      ui.help(isCult
        ? '军中装备用于攻城野战；修炼装备用于野地征战（灵力判定）。\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。'
        : '军中装备用于攻城野战。\n修炼一途乃君主专属，钦定不假他人。') +
      (isCult ? '<span style="margin-left:auto;display:inline-flex;gap:4px;">' +
        '<button class="btn sm' + (isLing ? '' : ' gold') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="sha">⚔ 军中</button>' +
        '<button class="btn sm' + (isLing ? ' gold' : '') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="ling">☯ 修炼</button>' +
      '</span>' : '') +
      '</div>' +
      '<div class="gp-doll">' +
        '<div class="doll">' +
          /* v46（需求 3）：人形栏加**人体背景图 + 放大的将领抠图**（浅色） ——
             抠图铺在人体剪影之下、槽位之上，让人一眼看出"这是谁的装备"。 */
          ui.dollPortrait(g) + ui.dollFigure() +
          DATA.EQUIP_SLOTS.map(function (slot) { return ui.dollSlot(g, genId, slot, inv); }).join('') +
        '</div>' +
        '<div class="doll-side">' +
          '<div class="eq-gain">装备提供</div>' +
          (gainRows ? '<div class="eq-grows">' + gainRows + '</div>'
            : '<div class="eq-gain"><span class="none">尚未装备任何部位</span></div>') +
          ui.dollSetPanel(g) +
          '<div class="gp-dollops">' +
            '<button class="btn sm gold" data-action="gen-auto-equip" data-gen="' + genId + '">一键最优装备</button>' +
            '<button class="btn sm" data-action="gen-unequip-all" data-gen="' + genId + '">全部卸下</button>' +
            (isLing ? '<button class="btn sm" data-action="ling-temper-open">☯ 蕴养</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>' +           /* gp-col-r */
      '</div>' +           /* gp-body */
      /* v54（老板："在忠诚右边加赏赐，别在下边整个大按钮"）：
         底部的「赏赐（提升忠诚）」分区整个撤掉 —— 入口已经在「状态 · 忠诚」那一行的右侧，
         珠宝种类数/持件数/当前忠诚都在按钮的悬停提示里，不必再占一块版面。 */
      '';

    return html + '</div>';
  };

  /* 赏赐选择窗：挑珠宝 → 挑件数 → 赏。
     可选项来自 DATA.ITEMS + state.items，这里不复制任何配置（加新珠宝自动出现）。 */
  ui.openGiftPick = function (genId) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var jewels = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'jewel' && (s.items || {})[it.id] > 0;
    });
    if (!jewels.length) { ui.toast('背包中暂无珠宝'); return; }
    ui._modalKind = 'gift';
    var want = (ui._giftPick || {})[genId];
    var pick = jewels[0].id;
    jewels.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    jewels.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var loy = Math.round(g.loyalty == null ? 70 : g.loyalty);
    var q = Math.max(1, Math.min(have, Number((ui._giftQ || {})[genId]) || 1));
    var cap = DATA.LOYALTY.cap || 100;
    var after = Math.min(cap, loy + q * (it.loyalty || 0));
    ui.openShell({
      title: '🎁 赏赐 · ' + U.escape(g.name),
      sub: '珠宝提升忠诚　当前忠诚 ' + loy + '　上限 ' + cap,
      size: 'sm',
      body: '<div class="ui-sub">选珠宝</div>' +
        '<div class="gd-chips">' + jewels.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="gift-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">忠+' + x.loyalty + '</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('gift-q-' + genId, q, 0, have) +
          '<span class="op-hint">赏 <b>' + q + '</b> 件　忠诚 ' + loy + ' → <b>' + after + '</b>' +
            (q >= have ? '（已用满持有）' : '') + '</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-gift-do" data-gen="' + genId + '" data-item="' + pick +
          '" data-qty-from="gift-q-' + genId + '">赏赐 ' + q + ' 件</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setGiftItem = function (genId, itemId) {
    ui._giftPick = ui._giftPick || {};
    ui._giftPick[genId] = itemId;
    ui._giftQ = ui._giftQ || {};
    ui._giftQ[genId] = 1;                      /* 换珠宝 → 件数回 1（新珠宝持有数不同） */
    ui.openGiftPick(genId);
  };

  /* 体力 / 精力道具选择窗（v89.131 · 老板「体力精力应当设计加号按钮，供道具使用，参考赏赐」）
     ------------------------------------------------------------
     与赏赐/经验两窗同一套做法：可选项直接来自 DATA.ITEMS + 背包（以后加道具自动出现），
     「用几个」在窗里选；将领页上只留一个 ＋。
     kind: 'sta'（stamina 族 · 体力）/ 'energy'（energy 族 · 精力）—— 一个出口管两个池子。
     上限/当前一律走唯一出口（energyMaxOf/energyNowOf · staMax/staNow），不另算一份。 */
  ui.openRestorePick = function (genId, kind) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var isEn = (kind === 'energy');
    var type = isEn ? 'energy' : 'stamina';
    var cfg = isEn
      ? { label: '精力', maxOf: GAME.energyMaxOf, nowOf: GAME.energyNowOf }
      : { label: '体力', maxOf: GAME.staMax, nowOf: GAME.staNow };
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === type && (s.items || {})[it.id] > 0;
    });
    if (!items.length) { ui.toast('背包中暂无' + cfg.label + '道具'); return; }
    ui._modalKind = 'restore';
    ui._restorePick = ui._restorePick || {};
    var key = genId + '|' + kind;
    var want = ui._restorePick[key];
    var pick = items[0].id;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var mx = cfg.maxOf(g), now = Math.round(cfg.nowOf(g));
    var q = Math.max(1, Math.min(have, Number((ui._restoreQ || {})[key]) || 1));
    var after = Math.min(mx, now + q * Math.round((it.amount || 0) * mx));
    ui.openShell({
      title: '💊 ' + cfg.label + '道具 · ' + U.escape(g.name),
      sub: '按上限百分比回复　当前 ' + now + ' / ' + mx,
      size: 'sm',
      body: '<div class="ui-sub">选道具</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="restore-pick-item"' +
            ' data-gen="' + genId + '" data-kind="' + kind + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">回' + Math.round((x.amount || 0) * 100) + '%</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('restore-q-' + kind + '-' + genId, q, 0, have) +
          '<span class="op-hint">用 <b>' + q + '</b> 件　' + cfg.label + ' ' + now + ' → <b>' + after + '</b>' +
            (q >= have ? '（已用满持有）' : '') + '</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-restore-do" data-gen="' + genId + '" data-kind="' + kind +
          '" data-item="' + pick + '" data-qty-from="restore-q-' + kind + '-' + genId + '">使用 ' + q + ' 件</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setRestoreItem = function (genId, kind, itemId) {
    ui._restorePick = ui._restorePick || {};
    ui._restorePick[genId + '|' + kind] = itemId;
    ui._restoreQ = ui._restoreQ || {};
    ui._restoreQ[genId + '|' + kind] = 1;   /* 换道具 → 件数回 1（新道具回复量不同） */
    ui.openRestorePick(genId, kind);
  };

  /* 经验道具选择窗（v54 · 老板：经验条右端「＋」点开）。
     与赏赐选择窗同一套做法：可选项直接来自 DATA.ITEMS + state.items，不复制配置
     （以后加经验道具自动出现）；「用几个」在弹窗里选，将领页上只留一个 ＋。
     两种用法保留：用 1 个 / 用到升级（后者由 systems 自己算够不够）。 */
  ui.openExpPick = function (genId) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'exp' && (s.items || {})[it.id] > 0;
    });
    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 治军之道 / 兵仙遗篇 / 千古兵圣。'
      + '\n经验道具**不设等级限制**（v89.173）：任何等级都能用，一次加固定经验。');
    ui._modalKind = 'exp';             /* 认窗标记：用完道具要按新经验重画这一扇 */
    /* v66（老板）：「将领等级到上限后不能再使用经验道具」——
       到上限时**根本不给"用几个"的按钮**，只把原因说清楚（资质决定上限）。
       入口本身仍然可点：v45 的教训是"功能像是不存在"比"功能被禁用"更糟。 */
    var blk = GAME.expBlockOf(g);
    if (blk) {
      ui.openShell({
        title: '📖 用经验道具 · ' + U.escape(g.name),
        sub: 'Lv' + g.level + ' / ' + GAME.genLevelCap(g),
        size: 'sm',
        body: '<div class="q-empty">' + U.escape(blk) + '。' +
          ui.help('提升上限只能换更高资质的将领：凡品 60 · 良材 100 · 英杰 140 · 名世 180 · 天授 240。'
            + '\n⚠️ 客栈只招得到**英杰及以下**；名世 / 天授要用**灵草升档**（种田秘境产出）。'
            + '\n手里的经验道具留着给别的将领。') + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    if (!items.length) {
      ui.openShell({
        title: '📖 用经验道具 · ' + U.escape(g.name),
        sub: '当前经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0),
        size: 'sm',
        body: '<div class="q-empty">背包中暂无经验道具。' + help + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    /* v89.173（老板「不作等级限制」）：撤 v89.171 的逐档上限（变暗 / toast / 全到线空态）——
       任何档位都可用；卡面 = 名字 ×持有 +X万（面额短写，全族整数万）。 */
    var want = (ui._expPick || {})[genId];
    var pick = null;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    if (!pick) pick = items[0].id;
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it ? (it.amount || 0) : 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;
    ui.openShell({
      title: '📖 用经验道具 · ' + U.escape(g.name),
      sub: 'Lv' + g.level + '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(expNeed, 0) +
        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具（用了直接加固定经验 · 不设等级限制）</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') +
            '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '"' +
            ' title="' + U.escape('将领经验 +' + U.numText(x.amount || 0, 0)) + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">+' + Math.round((x.amount || 0) / 10000) + '万</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-hint">' +
        '「用到升级」= 一直吃到升过当前等级（持有不够就全吃完）；跨级后需要重新点。' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="one" data-gen="' + genId +
          '" data-item="' + pick + '">用 1 个</button>' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="till" data-gen="' + genId +
          '" data-item="' + pick + '"' + (toLevel > have ? ' title="持有 ' + have + ' 个，不够一路升上去"' : '') +
          '>用到升级</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  ui.setExpItem = function (genId, itemId) {
    /* 闸门预检（v66 起）：不可用就不静默 —— toast 说明原因（v89.173 后只可能是资质上限） */
    var gE = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) gE = x; });
    var itE = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) itE = x; });
    if (gE && itE && GAME.expItemGrantOf) {
      var gtE = GAME.expItemGrantOf(gE, itE);
      if (!gtE.ok) { ui.toast(gtE.msg); return; }
    }
    ui._expPick = ui._expPick || {};
    ui._expPick[genId] = itemId;
    ui.openExpPick(genId);
  };


  /* 下方档案：选中将领的完整速览（六维表 + 状态栏 + 操作） */
  /* UI.v41: genDetailBlock-gone —— 内容已并入 ui.genPane 的右侧栏 */


  /* v60（需求 4）：将领**归属城池** —— 将领页默认只列本城将领。
     老板原话：「将领，人口，资源等是归属于城池的数据，切换城池时，只统计、呈现
     当前的数据即可」。要看全境名单再点 chips 切换 ——
     不能把两套混在一张表里，否则"我这座城到底有几个人"永远说不清。 */
  ui.GEN_SCOPES = [['city', '本城'], ['all', '全境']];
  ui.genScope = function () { return ui._genScope || 'city'; };
  ui.generalsHTML = function () {
    var s = GAME.state;
    var cur = GAME.currentCity();
    var scope = ui.genScope();
    /* 将领归属判据走 GAME.genCityOf（唯一出口）：cityId 为空的将领归当前城，
       不会因为"没写归属"就从名单里消失 */
    var pool = (s.generals || []).filter(function (g) {
      if (scope === 'all') return true;
      var gc = GAME.genCityOf(g);
      return !!(gc && cur && gc.id === cur.id);
    });
    /* v89.80（老板）：「默认按等级从大到小排序」——
       排序放在**分页之前**（否则"第 1 页"里也不是最强者），并带姓名次键
       （同等级按姓名，避免顺序随对象引用抖动、每次重开面板都换位）。
       ⚠️ 不改 pool 的过滤口径，只换顺序；空席补位仍按池长算。 */
    pool = pool.slice().sort(function (a, b) {
      return ((b.level || 1) - (a.level || 1))
        || String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
    /* v64（老板）：「根据**该城的招贤馆等级**有相应空位」——
       席位按城。列表分"本城/全境"两栏，上限就要跟栏内范围一致：
       本城栏比本城席位、全境栏比各城席位数之和（否则两栏共用一个数，必有一栏是错的）。 */
    var cap = (scope === 'all') ? GAME.genSlotsTotal() : GAME.genSlotsOf(cur);
    /* v76（老板）：「12个空格每页，平分空间吧，当城池超过12个将领，
       自动在底部导航栏产生翻页菜单」—— 每页固定 12 席（不足以空席补满），
       超过 12 位将领时把翻页登记到底部导航条；席位号跨页连续（第 N 席 = from + i）。 */
    var pg = ui.pageOf('gen', pool.length, ui.GEN_PER);
    /* 选中将领：默认第一位；无效（被解雇/换档/换范围）时回落 */
    var sel = null;
    pool.forEach(function (g) { if (g.id === ui._genSel) sel = g; });
    if (!sel) sel = pool[pg.from] || pool[0] || null;
    ui._genSel = sel ? sel.id : null;

    var rows = [];
    for (var i = 0; i < ui.GEN_PER; i++) {
      var gi = pg.from + i;
      rows.push(ui.genRow(pool[gi], gi, cap, ui._genSel));
    }
    if (pg.maxPage > 1) ui.pagerHTML('gen', pool.length, ui.GEN_PER);

    var scopeChips = '<span class="chips gen-scope">' + ui.GEN_SCOPES.map(function (p2) {
      return '<span class="chip' + (p2[0] === scope ? ' on' : '') +
        '" data-action="gen-scope" data-v="' + p2[0] + '">' + p2[1] + '</span>';
    }).join('') + '</span>';
    /* v73（老板）：「将领的界面顶部，怎么有个头像加一个飞机啊？不要搞
       （本城 2 / 11 席 · 全境 2 / 11 席）这些文字，直接将领加本城/全境切换按钮就行」
       —— 标题只留「将领」二字 + 本城/全境 chips：🧑‍✈️（人+飞机）/ 席位文字 /
       名将计数一律撤下（席位口径仍在 ⓘ 里说明，具体数字去招贤馆面板看）。 */
    return '<div class="ui-page">' +
      '<div class="gold-heading">将领' + scopeChips +
        ui.help('左侧点姓名切换将领；右侧即其**全部**档案与装备栏（不再另开弹窗）\n' +
          '席位**按城算**：每座城的上限 = 该城招贤馆等级（+建筑专精：每档 +2，满三档 +6）；0 级 = 0 席\n' +
          '已超编不会清退现有将领，但**招募/调入**须先建或升级招贤馆\n' +
          '将领先在客栈招募（本城客栈 + 本城空位），也可「城池面板 → 将领派遣」从别城调入\n' +
          '左侧清单每页 12 席；超过 12 位将领时在底部导航条翻页') +
      '</div>' +
      '<div class="gen-split">' +
        '<div class="gen-list">' + rows.join('') + '</div>' +
        ui.genPane(sel) +
      '</div>' +
      '</div>';
  };


  /* ============================================================
   * 将领属性详情（v14.1）
   * 单个将领的完整档案：资质 / 四维拆分（基础+装备+套装）/ 战斗属性 /
   * 忠诚与状态 / 守将效果 / 装备概览 / 赏赐 / 操作入口
   * 入口：将领列表点姓名，或操作列「详情」
   * ============================================================ */
  /* 城外改建选择面板（v19 · 需求 8）：等级保留，费用 = 目标建筑同等级累计造价 × 60% */
  ui.openExtConvert = function (idx) {
    var c = GAME.currentCity();
    var e = GAME.extGridOf(c)[idx];
    if (!e || !e.type) { ui.toast('该地块没有建筑可改建'); return; }
    var cur = DATA.EXT_BUILDINGS[e.type];
    var list = DATA.EXT_BUILD_ORDER.filter(function (eid) { return eid !== e.type; }).map(function (eid) {
      var eb = DATA.EXT_BUILDINGS[eid];
      var cost = GAME.extConvertCost(idx, eid);
      var afford = GAME.canAfford(cost);
      return '<div class="xc-row">' +
        '<div class="xc-ico">' + GAME.icons.forExt(eid) + '</div>' +
        '<div class="xc-info"><b>' + eb.name + '</b>' +
          '<span class="xc-prod">Lv' + e.lv + ' 产量 ' + U.perHourText(eb.prod[e.lv - 1]) + '/时</span>' +
          '<span class="xc-cost">改建费 ' + GAME.costString(cost) + '</span></div>' +
        '<button class="btn sm' + (afford ? ' gold' : ' dim') + '" data-action="ext-convert" data-idx="' + idx + '" data-eid="' + eid + '"'
          + (afford ? '' : ' disabled') + '>改建</button>' +
        '</div>';
    }).join('');
    ui.openShell({
      title: '🔧 改建 · ' + cur.name + ' Lv' + e.lv,
      sub: '等级保留，只换用途' + ui.help('改建不返还旧建筑投入（与拆毁不同），但省去重新施工的时间'),
      size: 'md',
      body: '<div class="xc-list">' + list + '</div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ------------------------------------------------------------
   * 将领详情（v26 · 需求 1/2 重排）
   * ------------------------------------------------------------
   * 版面：**左头像 · 右五维**。原先头像是竖排里的一大块、属性表在它下面，
   *       看完"是谁"要往下滚才看到"多强"；现在两栏并排，一眼同时读完。
   * 五维：只呈现**一个值** —— 基础 + 装备 + 战斗符，全部求和后的结果。
   *   · 删「装备/丹」列：丹药是**永久加到基础里**的（嗑过药当然就是基础），
   *     单列一列会让人以为还要再加一次；这在旧代码里还真的重复加了（见 domain.genAttrs）。
   *   · 删「合计」列：只剩一个数时，"合计"二字没有意义。
   *   · 「作用」不再拼计算值 —— 写"全军攻击 +86%"会随装备与等级一直变，
   *     那句话读起来像"作用"，其实是"当前值"。改写成该维度的**固定功能说明**，
   *     实时数值集中到下方「当前效果」一栏。
   * 速度升为第五维（求和计算，见 battle.firstStrike / march.speedFactor）。
   * ------------------------------------------------------------ */
  /* 五维定义：作用一律写「每点」，且与代码里的消费点一一对应，不是估算。
     统率 → battle.js covered(tong*100) / domain.js maxPopOf(tong*1000)
     勇武 → atkMult = 1 + a.atkPct × cover（atkPct = 勇武×0.0005 + 装备攻值/1000；v89.96）
     智谋 → battle.js defBonus / defMult += a.defPct（同上）
     内政 → domain.js guardBonus prod / build = nz/100
     速度 → battle.js firstStrike（a += spd）、battle.js march.speedFactor（× (1+spd/300)） */
  /* v65（老板）：「压缩一下六维的作用单元格长度，统率这些属性名都成 2 行了，占空间」——
     原因不是名字长，而是**作用列太长把第一列挤没了**（表格自动分配宽度时，
     内容多的一列抢走空间，"统率"两个字就被迫折行）。
     处置两条：① 文案改短句（下列 `use`）；② CSS 里给第一列固定宽 + nowrap（见 index.html）。
     文案短了但**意思不变**：每个数字都仍与代码里的常量一一对应，
     `smoke` 那条"常量与文案一致性"断言照旧守着。 */
  ui.GEN_DIMS = [
    /* v74（老板需求 1）：「带兵 +100 · 人口上限 +1000」里的**人口上限那半条已撤**
       （人口只由民房决定）；作用文案现在走六维名称的悬停。 */
    { k: 'tong', n: '统率', color: '#d8b04e', use: '带兵 +100' },
    /* v52（老板给定换算链）→ v89.96 改双刻度（见 domain.js atkPctOf 注释）：
       勇武每 20 点 +1%（无上限属性单独降率）、装备每 10 攻值 +1%（v52 保留）。
       这里写的**就是代码里的同一组常量**（GAME.YW_PCT / PCT_PER_ATK 等），
       改常量忘了改文案会被 smoke 的一致性断言拦下。 */
    { k: 'yw', n: '勇武', color: '#c9705a',
      use: '全军攻击 +0.05%/点（每20点+1%）',
      /* v58：`guardUse` = 该将**现任守将**时这一维实际提供的加成（并进"作用"列）。
         映射取自 `GAME.guardBonus`：内政→产量/建造、勇武→征兵、智谋→研究/城防。 */
      guardUse: function (gb) {
        return gb.train ? '守将加成：征兵 +' + Math.round(gb.train * 100) + '%' : '';
      } },
    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '全军防御 +0.05%/点（每20点+1%）',
      /* v89.113（老板需求 3）：智谋的经营项归**城主**（研究/城防） */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.research) p2.push('研究 +' + Math.round(mb.research * 100) + '%');
        if (mb.def) p2.push('城防 +' + Math.round(mb.def * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },
    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      /* v89.113：内政的经营项归**城主**（产量/建造）
         v89.162（老板「内政对税收也应有加成」）：第三处落点 —— **税收**。 */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.prod) p2.push('产量 +' + Math.round(mb.prod * 100) + '%');
        if (mb.build) p2.push('建造 +' + Math.round(mb.build * 100) + '%');
        if (mb.tax) p2.push('税收 +' + Math.round(mb.tax * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },
    { k: 'spd', n: '速度', color: '#b06fd8', use: '全军速度 +1 · 每级另 +1' },
    /* v29（需求 11）：体力升为**第六维** —— 它不再只是"出征的资格值"，
       而是直接决定全军生命的厚度（当前体力越高越耐打）。
       v52：上限成了「等级/资质/内政 + 装备与套装的体力加成」三者之和。
       v66：**表格里显示"总体体力"（= 上限）**，`val` 指定取值键 ——
       与左栏「状态 · 体力」同口径（那边把当前值写在括号里），
       否则六维显示当前值、装备栏显示装备贡献，两处又对不上。 */
    { k: 'sta', n: '体力', val: 'staMax', color: '#d98b4a',
      use: '生命渐近 +80%、高段每千 +2.5%' },
  ];

  /* UI.v41: openGenDetail-gone —— 内容已并入 ui.genPane 的右侧栏 */


  /* ============================================================
   * 将领装备栏（逐槽更换 / 一键最优 / 全部卸下）
   * ============================================================ */
  /* ============================================================
   * 将领人形装备栏（v38 · 需求 2）
   * ------------------------------------------------------------
   * 改前是 4 列 12 格的平铺卡片：能换装，但看不出"哪件穿在哪"。
   * 改后按**人形**摆位 —— 12 个部位贴在人形对应的身体位置上。
   * 落点集中在 ui.DOLL_POS 一张表里（改布局只动这张表，别散在模板里）。
   * ============================================================ */
  /* 落点排列成 **5 行**（每行内部靠横向分开、行与行靠纵向分开），
     这是 54px 方槽在 300×380 人形框里的唯一可行排法：
       行间距 25px，行内 3 列（11% / 50% / 78%）横向间距 ≥ 63px，
       两向都留得住 —— 换成"贴着身体部位随便放"就会出现头压颈那种重叠。
     横向留出槽位半宽（54/2 = 27px）的余量（实测 300px 宽人形框）：
       11% → 33−27 = 6 ≥ 0；78% → 234−27+54 = 261 ≤ 300。
     ⚠️ 改槽位边长或人形框尺寸，都要回来核这两组数（smoke 有一条断言按此复算两两不重叠）。 */
  ui.DOLL_POS = {
    head: [50, 0.8],
    neck: [50, 21.6], shoulder: [22, 21.6], back: [78, 21.6],
    chest: [50, 42.4], arm: [11, 42.4],
    waist: [50, 63.2], ring: [11, 63.2], pendant: [78, 63.2],
    feet: [50, 83.9], weapon: [11, 83.9], mount: [78, 83.9],
  };
  /* 人形剪影（纯几何，跟着设计令牌走；不引外部图） */
  /* v46（需求 3）：人形框里的**大号将领抠图**（浅色底衬）。
     不走 P.html 的原因：那里把尺寸写死在行内 style 上（width/height 像素），
     这里必须让 CSS 用百分比接管，才能跟着人形框一起缩放。
     抠图本身是 512×512 透明 webp，宽高比已统一，所以 `height:auto` 不会变形。 */
  ui.dollPortrait = function (g) {
    if (!g) return '';
    var P = GAME.portraits;
    if (!P) return '';
    var src = P.fileOf ? P.fileOf(g) : '';
    if (src) {
      return '<span class="doll-portrait" aria-hidden="true">' +
        '<img src="' + src + '" alt="" onerror="this.parentNode.style.display=\'none\'">' +
      '</span>';
    }
    /* 池子取不到图（史实名将缺图 / 池被清空）→ 退回程序化立绘，同样缩放 */
    return '<span class="doll-portrait" aria-hidden="true">' + P.svg(g, 240) + '</span>';
  };

  ui.dollFigure = function () {
    return '<svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMid meet" class="doll-fig-svg" aria-hidden="true">' +
      '<g fill="rgba(122,118,94,.34)" stroke="rgba(232,206,136,.30)" stroke-width="1.1" stroke-linejoin="round">' +
        '<circle cx="60" cy="18" r="13"/>' +
        '<rect x="53" y="30" width="14" height="8" rx="3"/>' +
        '<path d="M60 38 L85 53 L81 97 L39 97 L35 53 Z"/>' +
        '<path d="M37 53 L21 68 L17 106 L28 108 L34 76 Z"/>' +
        '<path d="M83 53 L99 68 L103 106 L92 108 L86 76 Z"/>' +
        '<path d="M41 97 L39 141 L53 141 L57 101 Z"/>' +
        '<path d="M79 97 L81 141 L67 141 L63 101 Z"/>' +
        '<rect x="37" y="139" width="19" height="8" rx="2.5"/>' +
        '<rect x="64" y="139" width="19" height="8" rx="2.5"/>' +
      '</g></svg>';
  };
  ui.dollSlot = function (g, genId, slot, inv) {
    var pos = ui.DOLL_POS[slot] || [50, 50];
    /* v88：按**当前生效套**渲染（军装/修炼各 12 槽；槽名/图标/品质色/强化标全同步）。
       附带修复 v79 按件改造的一处遗漏：这里原先直接把实例对象当 DATA.EQUIP 的键
       （装着装备时 it 恒为 null → 格子丢品质色显示 empty 类）。统一走 eqId 规范化。 */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var inst = bag[slot];
    var id = inst ? (GAME.eqId ? GAME.eqId(inst) : inst) : null;
    var it = id ? DATA.EQUIP[id] : null;
    var slotName = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var invN = inv[slot] || 0;
    var setNm = it && it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
    return '<div class="eq-cell doll-slot' + (it ? ' q' + it.q : ' empty') + '"' +
      ' style="left:' + pos[0] + '%;top:' + pos[1] + '%"' +
      ' data-action="eq-slot" data-gen="' + genId + '" data-slot="' + slot + '" data-tip-el="1">' +
      '<span class="eq-slotname">' + slotName + '</span>' +
      '<span class="eq-ico">' + (GAME.icons.forEquip ? GAME.icons.forEquip(slot) : '') + '</span>' +
      '<span class="eq-name' + (it ? '' : ' none') + '">' + (inst ? U.escape(GAME.eqLabel(inst)) : '未着') + '</span>' +
      (invN ? '<span class="eq-inv">+' + invN + '</span>' : '') +
      /* 悬停走全站唯一的 #tip-layer（v37）—— 不在这里自己绝对定位 */
      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (inst ? ' · ' + U.escape(GAME.eqLabel(inst)) : '') + '</div>' +
        '<div class="tip-l">' + (it ? U.escape(GAME.equipDesc(it) || '') : '该部位未着，点击选择') + '</div>' +
        (setNm ? '<div class="tip-a">' + setNm + ' 套装件</div>' : '') +
        (invN ? '<div class="tip-a">背包另有 ' + invN + ' 件可换</div>' : '') +
      '</span></div>';
  };
  /* v88：修炼装备面板（灵力 / 总蕴养 / 精华余额）—— dollSetPanel 的修炼分支 */
  ui.dollLingPanel = function (g) {
    var s = GAME.state;
    var ess = (s.items || {}).lingsui || 0;
    var bag = g.lingEquip || {};
    var cnt = Object.keys(bag).length, total = 0;
    for (var k in bag) total += (GAME.eqEnhOf(bag[k]) || 0);
    var ling = GAME.lingPowerOf ? GAME.lingPowerOf(g) : 0;
    return '<div class="doll-set">' +
      '<div class="ds-block">' +
        '<div class="ds-head"><span class="ds-name">☯ 修炼装备</span><span class="ds-n">' + cnt + ' / 12 件</span></div>' +
        '<div class="ds-tiers">' +
          '<i class="on"><b>灵力</b>' + ling + '</i>' +
          '<i><b>总蕴养</b>+' + total + ' / 120</i>' +
          '<i><b>灵气精华</b>' + ess + '</i>' +
        '</div>' +
      '</div>' +
      '<div class="ds-empty">灵力用于野地征战判定；蕴养每级修炼属性 +8%（灵气精华 · 野地采集与征战所得）。</div>' +
    '</div>';
  };
  /* 套装进度面板：件数 + 四档（已达/未达）+ 下一档提示
     v88：修炼侧无套装档 —— 直接转 dollLingPanel（灵力/蕴养面板） */
  ui.dollSetPanel = function (g) {
    if (g.equipOn === 'ling' && GAME.canCultivate(g)) return ui.dollLingPanel(g);
    var prog = GAME.setProgressOf(g);
    var active = prog.filter(function (p) { return p.n > 0; });
    var out = '<div class="doll-set">';
    if (!active.length) {
      out += '<div class="ds-empty">未着套装件。套装件每满 <b>'
        + (DATA.SET_TIERS || []).join(' / ') + '</b> 件逐档加成，效果累计。</div>';
    }
    active.forEach(function (p) {
      out += '<div class="ds-block">' +
        '<div class="ds-head"><span class="ds-name">' + p.name + '</span>' +
          '<span class="ds-n">' + p.n + ' / ' + p.total + ' 件</span>' +
          (p.next ? '<span class="ds-next">再 ' + (p.next - p.n) + ' 件 → ' + p.bonus[p.next] + '</span>'
                  : '<span class="ds-next done">已满档</span>') +
        '</div>' +
        '<div class="ds-tiers">' + p.tiers.map(function (t) {
          return '<i class="' + (p.n >= t ? 'on' : '') + '"><b>' + t + ' 件</b>' + p.bonus[t] + '</i>';
        }).join('') + '</div></div>';
    });
    /* v52（老板：「装备那里不需要列出其余套装的备注」）：
       这里原本还会列一段「其余套装：名将套（11 件）…加成…」—— 把没穿的套装也铺出来，
       信息量大但**与本将无关**（要凑别的套是另一回事，去铁匠铺的套装表看）。
       整段删掉，只留本将**已着**套装件的进度。 */
    return out + '</div>';
  };

  /* v41（需求 2）：装备栏不再单独弹窗 —— 内容已并入 ui.genPane 的右侧栏。
     这里保留一个**同源**入口：切到将领页并选中该将，
     保证「任何地方点装备都到同一处」。
     （旧实现是第二个弹窗，与右侧栏各维护一份渲染逻辑 ——
      正是本项目最常见的失效模式「同一份数据两个来源」。） */
  // UI.v41:openGenEquip-no-modal
  ui.openGenEquip = function (genId) {
    ui._genSel = genId;
    if (ui.view !== 'generals') ui.setView('generals');
    else GAME.refreshView();
  };


  /* 拆毁二次确认（城内/城外通用） */
  ui.openDemolishConfirm = function (kind, idx) {
    var s = GAME.state, c = GAME.currentCity();
    var name, lv, back;
    if (kind === 'ext') {
      var e = GAME.extGridOf(c)[idx];
      if (!e || !e.type) { ui.toast('该地块无建筑'); return; }
      var eb = DATA.EXT_BUILDINGS[e.type];
      name = eb.name; lv = e.lv; back = GAME.demolishExtRefund(idx);
    } else {
      var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' 槽同样生效 */
      if (!cell || !cell.build) { ui.toast('该地块无建筑'); return; }
      var b = DATA.BUILDINGS[cell.build.id];
      name = b.name; lv = cell.build.lvl; back = GAME.demolishRefund(c, idx);
    }
    /* v76（老板）：「拆除（1级，只能逐级拆除）」——
       城内是**降 1 级**（Lv1 才整座移除）；城外仍为整座拆毁（未动）。 */
    var isCity = (kind !== 'ext');
    var html = '<div class="gold-heading">' + (isCity
      ? ('拆 1 级 · ' + U.escape(name) + ' Lv' + lv + (lv > 1 ? ' → Lv' + (lv - 1) : '（整座移除）'))
      : ('拆毁 ' + U.escape(name) + ' Lv' + lv)) + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">' + (isCity
      ? '逐级拆除：每次只降 1 级，返还本步投入的 50%；拆到 Lv1 再拆即整座移除（腾出地块）。'
      : '返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。') + '</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">' + (isCity && lv > 1 ? '确定拆 1 级' : '确定拆毁') + '</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 解雇二次确认 */
  ui.openDismissConfirm = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var a = GAME.genAttrs(g);
    var eq = [];
    ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套合并列出 */
      for (var sl in (g[bk] || {})) {
        var it2 = DATA.EQUIP[GAME.eqId(g[bk][sl])];
        if (it2) eq.push(it2.name);
      }
    });
    var html = '<div class="gold-heading">解雇 ' + U.escape(g.name) + '</div>';
    html += '<div class="attr"><span class="k">资质</span><span class="v">' + ui.rankBadge(g) + '</span></div>';
    html += '<div class="attr"><span class="k">等级</span><span class="v">Lv' + g.level + '</span></div>';
    html += '<div class="attr"><span class="k">四维</span><span class="v">统' + a.tong + ' 勇' + a.yw + ' 智' + a.zm + ' 政' + a.nz + '</span></div>';
    html += '<div class="note">离去后其装备（' + (eq.length ? eq.join('、') : '无') + '）将全数归还背包。<br>'
      + (g.hero ? '<b style="color:var(--red-light)">名将离去，声望 −50。</b><br>' : '')
      + '民心 −2。此操作不可撤销，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="dismiss-gen-do" data-gen="' + genId + '">确定解雇</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* ============================================================
   * v89.110（老板）：「怎么能把危险按钮放在容易误触的位置…这种人机交互理念符合常理吗？」
   * ------------------------------------------------------------
   * 全站销毁性动作的**统一处置**（复核表见 docs/v89110-危险动作复核与上限核对.md）：
   *   · 两段式：触发按钮 `xxx-ask` → 确认弹窗（写明失去什么 / 返还什么 / 能否撤销）
   *     → 红按钮 `xxx-do`。触发端**没有**一键直达的口子。
   *   · 触发按钮不与高频正向动作并排紧邻（解散移出训练行、单独成「危险操作」区）。
   *   · 可逆 / 低损动作（卸装、撤回行军、市场买卖）保持一键 —— 不为形式加摩擦。
   * ============================================================ */

  /* 解散驻军（兵种）—— 归农返还人口、军资不退（不可撤销） */
  ui.openDisbandConfirm = function (troopId, count) {
    var c = GAME.currentCity();
    var t = DATA.TROOPS[troopId];
    if (!c || !t) { ui.toast('参数错误：未知兵种'); return; }
    var have = (c.army && c.army[troopId]) || 0;
    if (have <= 0) { ui.toast('本城没有' + t.name + '可解散'); return; }
    var n = Math.min(have, Math.max(1, Math.floor(Number(count) || 1)));
    var back = Math.floor(n * (t.pop || 0) * ((DATA.DISBAND || {}).popReturn == null ? 1 : DATA.DISBAND.popReturn));
    var html = '<div class="gold-heading">🕊 解散 ' + U.escape(t.name) + ' ×' + U.fmt(n) + '</div>';
    html += '<div class="attr"><span class="k">本城驻军</span><span class="v">' + U.fmt(have) + ' → ' + U.fmt(have - n) + '</span></div>';
    html += '<div class="attr"><span class="k">归农返还</span><span class="v good">+' + U.fmt(back) + ' 人口</span></div>';
    html += '<div class="attr"><span class="k">军资</span><span class="v" style="color:var(--red-light);">不退</span></div>';
    html += '<div class="note">解散的部队归农（人口入库），<b>不返还募兵时消耗的军资</b>。此操作不可撤销，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="troop-disband-do" data-troop="' + troopId + '" data-n="' + n + '">确定解散 ×' + U.fmt(n) + '</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 拆解回收（装备）—— 该件销毁，只回收 40% 打造材料（不可撤销） */
  ui.openSalvageConfirm = function (ref) {
    var inst = GAME.eqFind(ref);
    if (!inst) { ui.toast('背包中没有这件装备'); return; }
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var mats = GAME.forgeMaterials(itemId), mtx = [];
    for (var mk in mats) {
      mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
        + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
    }
    var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;   /* 与列表入口同一取键口径 */
    var html = '<div class="gold-heading">♻ 拆解回收 · ' + U.escape(it.name) + '</div>';
    html += '<div class="attr"><span class="k">将回收</span><span class="v good">' + (mtx.join('、') || '—') + '</span></div>';
    html += '<div class="attr"><span class="k">这件装备</span><span class="v" style="color:var(--red-light);">销毁（不可撤销）</span></div>';
    html += '<div class="note">拆解后该件从背包消失，只回收 40% 打造材料。想留着就点<b>取消</b>。</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="salvage-equip-do" data-key="' + key + '">确定拆解</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 撤回采集（无收益）—— 兵力归还、本轮采集作废 */
  /* ============================================================
   * ⛔ v89.138（老板 0）：`ui.openGatherAbandonAsk`（撤回采集队确认面板）整条退役 ——
   * 老板：「召回不是从采集变成驻军，而是**采集中的军队回到城市**」。
   * 采集与驻军在 v89.136 已合并（兵在驻军 · 原地开工），"撤回采集队"与"撤回驻军"
   * 本就是同一件事 —— 全站「召回」统一走 `wild-withdraw`（撤回驻军 = 停采 + 兵将回城），
   * 并带**两段确认**（上膛式，见 main.js）。
   * 域侧 `GAME.abandonGather`（单纯停采）**保留**：`doWildWithdraw` 内部照旧调用它
   * （满 1 小时先自动收获，不足 1 小时直接停）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`。 */

  /* 取消建造 / 升级 —— 按剩余进度返还 80%（已投入的 20% 与已耗时间不返还） */
  ui.openCancelBuildAsk = function (kind, idx) {
    var info = GAME.cancelRefundOf ? GAME.cancelRefundOf(kind, idx) : { ok: false, msg: '' };
    if (!info.ok) { ui.toast(info.msg || '没有进行中的建造'); return; }
    var isUp = (info.q.type === 'upgrade' || info.q.type === 'ext_upgrade');
    var kn = kind === 'ext' ? '城外' + (isUp ? '升级' : '建造') : (isUp ? '升级' : '建造');
    var html = '<div class="gold-heading">⏹ 取消' + kn + '</div>';
    html += '<div class="attr"><span class="k">按剩余进度返还</span><span class="v good">'
      + U.fmt(info.total) + ' 资源（' + Math.round(info.remainRatio * 80) + '%）</span></div>';
    html += '<div class="note">已投入的 20% 与已耗时间<b>不返还</b>。取消后地块空出，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="cancel-build-do" data-kind="' + kind + '" data-idx="' + idx + '">确定取消</button>'   /* v89.128：'wall' 原样透传（旧写法把非数字洗成 0） */
      + '<button class="btn" data-action="close-modal">继续施工</button></div>';
    ui.openModal(html);
  };

  /* 随机任务换新（单条 / 全部）—— 付工本费、旧任务作废 */
  ui.openRerollRandAsk = function (qid) {
    var html = '<div class="gold-heading">🔄 放弃并换一条</div>';
    html += '<div class="attr"><span class="k">工本费</span><span class="v">' + U.fmt(GAME.randQuestRerollCost()) + ' 金</span></div>';
    html += '<div class="note">该任务作废，立刻抽取一条新的随机任务。是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="reroll-rand-quest-do" data-q="' + qid + '">确定换一条</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };
  ui.openRerollAllAsk = function () {
    var s = GAME.state, n = ((s && s.quests && s.quests.pool) || []).length;
    var html = '<div class="gold-heading">🔄 全部换新</div>';
    html += '<div class="attr"><span class="k">工本费</span><span class="v">' + U.fmt(GAME.randQuestRerollAllCost()) + ' 金</span></div>';
    html += '<div class="attr"><span class="k">换新数量</span><span class="v">' + n + ' 项（全部作废重抽）</span></div>';
    html += '<div class="note">当前 ' + n + ' 项随机任务将<b>全部作废</b>并重新抽取。是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="reroll-all-rand-do">确定全部换新</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 单槽位更换（v88：按**当前生效套**过滤候选与槽名；修炼件附「蕴养」入口） */
  ui.openEqSlot = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var curInst = bag[slot];
    var cur = curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null;
    var cand = (s.inventory || []).filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return it && it.slot === slot && (!!it.ling === isLing);   /* v88：只列本套件 */
    });
    /* v79：候选是一次**件**（同名各列各的，带 +N 与 甲/乙/丙 序号） */
    cand.sort(function (x, y) {
      var ix = DATA.EQUIP[GAME.eqId(x)], iy = DATA.EQUIP[GAME.eqId(y)];
      return (GAME.systems.equipScore(iy) - GAME.systems.equipScore(ix)) || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
    });
    var slotName2 = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var html = '<div class="gold-heading">' + slotName2 + ' · 更换' + (isLing ? '（☯ 修炼）' : '（⚔ 军中）') + '</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDesc(cur)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
      html += '<button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button>';
      if (isLing) {
        /* v88：修炼件就地蕴养（与军装「百炼强化」同位置的平行操作） */
        var lvT = GAME.eqEnhOf(curInst);
        if (lvT < GAME.lingTemperMax()) {
          var tcost = GAME.lingTemperCost(curInst);
          var tkey = GAME.eqUidOf(curInst) != null ? GAME.eqUidOf(curInst) : GAME.eqId(curInst);
          html += '<button class="btn gold" data-action="ling-temper-item" data-key="' + tkey + '">☯ 蕴养 +' + (lvT + 1) + '（精华 ' + tcost + '）</button>';
        } else {
          html += '<span class="op-done" style="align-self:center;">蕴养已圆满 +' + lvT + '</span>';
        }
      }
      html += '</div>';
    }
    if (!cand.length) {
      html += '<div class="note">背包中没有该部位的' + (isLing ? '修炼' : '') + '装备。</div>';
    } else {
      html += '<div class="bag-sec">背包可选 <span class="n">' + cand.length + ' 件</span></div>';
      html += '<div class="bag-grid">' + cand.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var better = !cur || GAME.systems.equipScore(it) > GAME.systems.equipScore(cur);
        var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : '',
          name: GAME.eqLabel(inst), q: it.q,
          title: GAME.eqLabel(inst) + (better ? '（优于当前）' : ''),
          lore: (GAME.qNameOf ? GAME.qNameOf(it) : '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'gen-equip-item', key: key, gen: genId,
        });
      }).join('') + '</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };



  /* --------- 装备 --------- */
  ui._equipGen = null;
  /* v89.112（老板：「条目过多的分页」）：本函数**视图/弹窗双用** ——
       · 视图（setView('equip')）：分页条走屏幕底部条（pagerHTML）；
       · 弹窗（openEquipPanel）：底部条会被 modal-mask 盖住、**点不到**（旧账本 bug），
         改走 ui.modalPage 弹窗内分页。
     入参 inModal 由调用方声明（openPanel 的 equip 分支传 true）。 */
  ui.EQUIP_PER = 8;    /* v89.112c：装备背包每页 8 件 —— 4 列 = 2 行（10 件时 3 行，
                          实测多出 85px 溢出；8 件恰好两行满排） */
  ui.equipHTML = function (inModal) {
    var s = GAME.state;
    var g = null;
    s.generals.forEach(function (x) { if (x.id === ui._equipGen) g = x; });
    if (!g && s.generals.length) g = s.generals[0];
    if (!g) return '<div class="ui-page"><div class="gold-heading">🎽 装备</div><div class="q-empty">暂无将领</div></div>';
    ui._equipGen = g.id;
    var bonus = GAME.systems.genEquipBonus(g);
    /* v66：算"装备把全军生命推到哪儿"要两个池子 —— 带装与裸装。
       都用 genAttrs（唯一取值口），不自己拼 staBaseMax + sta。 */
    var aEq = GAME.genAttrs(g);
    var aBare = GAME.genAttrs({
      level: g.level, tong: g.tong, yw: g.yw, zm: g.zm, nz: g.nz, speed: g.speed,
      attack: g.attack, defense: g.defense, rank: g.rank, style: g.style,
      perm: g.perm || {}, equip: {},
    });
    /* v88：总览按**当前生效套**（槽名/装备/背包候选全同步） */
    var gIsLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var gBag = (gIsLing ? g.lingEquip : g.equip) || {};
    var gSlotNames = gIsLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES;
    var slotRows = DATA.EQUIP_SLOTS.map(function (slot) {
      var inst = gBag[slot];
      var item = inst ? DATA.EQUIP[GAME.eqId(inst)] : null;
      return '<div class="res-line"><span class="lbl">' + (gSlotNames[slot] || slot) + '</span>' +
        '<span class="val">' + (item ? U.escape(GAME.eqLabel(inst)) + (item.set ? ' <span style="color:var(--hero-tag);">[' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) + ']</span>' : '') +
        (item.slot === 'weapon' && item.atk ? ' 攻' + item.atk : '') + (item.spd ? ' 速' + item.spd : '') : '—') + '</span>' +
        (item ? '<button class="btn sm red" data-action="unequip-item" data-gen="' + g.id + '" data-slot="' + slot + '" style="margin-left:6px;">卸</button>' : '') + '</div>';
    }).join('');
    /* v19：装备背包会随攻城/打造不断增长 → 接分页（每页 10） */
    var invAll = (s.inventory || []).filter(function (x) {
      var it3 = DATA.EQUIP[GAME.eqId(x)];
      return !!it3 && (!!it3.ling === gIsLing);   /* v88：候选只列当前套 */
    });
    var pgE = ui.pageOf('equip', invAll.length, ui.EQUIP_PER);
    var eqSlice = invAll.slice(pgE.from, pgE.to), eqPager = '';
    if (inModal) {
      var pgM = ui.modalPage('equip', invAll, ui.EQUIP_PER, function () { ui.openEquipPanel(); });
      eqSlice = pgM.slice; eqPager = pgM.pager;
    } else {
      ui.pagerHTML('equip', invAll.length, ui.EQUIP_PER);   /* 视图：底部条 */
    }
    var inv = eqSlice.map(function (inst, i) {
      var item = DATA.EQUIP[GAME.eqId(inst)];
      if (!item) return '';
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : GAME.eqId(inst);
      return '<div class="troop-card" style="cursor:pointer;" data-action="equip-item" data-gen="' + g.id + '" data-item="' + key + '">' +
        '<div class="tname">' + U.escape(GAME.eqLabel(inst)) + '</div>' +
        '<div class="tstat">' + (gSlotNames[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +
        '<div class="tstat">' + GAME.equipDesc(item) + '</div></div>';
    }).join('') || '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;padding:10px;">背包暂无装备（占领名城/任务可获得）</div>';
    return '<div class="ui-page">' +
      /* v89.112c：弹窗模式**不重复标题** —— openPanel 的外层已有「装备」，
         内层再来一个 34px 的金头就是纯占位（还顶出一截滚动）。
         视图模式（setView('equip')）没有外层标题，保留。 */
      (inModal ? '' : '<div class="gold-heading">🎽 装备 · ' + U.escape(g.name) + '</div>') +
      '<div style="margin-bottom:8px;"><div class="ui-sub" style="margin-bottom:4px;">选择将领 · 当前 <b style="color:var(--gold-light);">' + U.escape(g.name) + '</b></div>' +
        ui.genChips({ store: '_equipGen', refresh: 'view', value: g.id || (ui._equipGen || ''),
          per: 12, modal: true, key: 'gchips_eq', wide: true }) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">已装备（' + Object.keys(gBag).length + '/12）' + (gIsLing ? '　☯ 修炼' : '　⚔ 军中') + '</div>' + slotRows + '</div>' +
        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">加成汇总</div>' +
          '<div class="res-line"><span class="lbl">统率</span><span class="val">+' + bonus.tong + '</span></div>' +
          '<div class="res-line"><span class="lbl">勇武</span><span class="val">+' + bonus.yw + '</span></div>' +
          '<div class="res-line"><span class="lbl">智谋</span><span class="val">+' + bonus.zm + '</span></div>' +
          '<div class="res-line"><span class="lbl">内政</span><span class="val">+' + bonus.nz + '</span></div>' +
          '<div class="res-line"><span class="lbl">攻击/防御</span><span class="val">+' + bonus.atk + '/+' + bonus.def + '</span></div>' +
          '<div class="res-line"><span class="lbl">速度</span><span class="val">+' + bonus.spd + '</span></div>' +
          /* v66：这一行现在是**真·体力**（并进体力上限），不再是"全军生命 +N%"的第二套说法。
             括号里顺手给出它把全军生命推到哪儿 —— 用 GAME.staHpPct 现算，
             不写第二份双曲公式。 */
          '<div class="res-line"><span class="lbl">体力</span><span class="val">+' + Math.round(bonus.sta || 0) +
            ' <span class="cap">全军生命 +' + Math.round((GAME.staHpPct(aEq.staMax) - GAME.staHpPct(aBare.staMax)) * 100) +
            '%</span></span></div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:12px;"><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">装备背包（点击穿戴）</div>' +
      '<div class="troop-grid" style="grid-template-columns:repeat(4,1fr);">' + inv + '</div>' +
      eqPager + '</div>' +

      '</div>';
  };
  GAME.equipDesc = function (item) {
    var parts = [];
    if (item.tong) parts.push('统+' + item.tong);
    if (item.nz) parts.push('政+' + item.nz);
    if (item.yw) parts.push('勇+' + item.yw);
    if (item.zm) parts.push('智+' + item.zm);
    if (item.atk) parts.push('攻+' + item.atk);
    if (item.def) parts.push('防+' + item.def);
    if (item.spd) parts.push('速+' + item.spd);
    if (item.sta) parts.push('体+' + item.sta);
    if (item.lingv) parts.push('灵+' + item.lingv);   /* v88：灵力（游历战力） */
    return parts.join(' ') || '—';
  };

  /* --------- 科技 --------- */
  ui.techHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var bookLv = GAME.buildingLevel(c, 'shuyuan') || 0;
    var cur = GAME.systems.researching();
    var rows = DATA.TECH.map(function (t) {
      var lv = s.techs[t.id] || 0;
      var locked = bookLv < t.lv;
      var full = lv >= 10;
      var cost = DATA.techCost(t, lv + 1);
      var btn = full ? '<span style="color:var(--text-dim);">已满级</span>' :
        locked ? '<span style="color:var(--red-light);">需书院Lv' + t.lv + '</span>' :
        /* v89.86（整改 P-12）：v16 改黄金口径后 `DATA.techCost` 只返回 {gold,wood,stone}，
           这里仍旧读 `cost.grain` → 每个按钮都印成「研究(NaN粮)」。
           现在：主项黄金短写上屏，完整三项费用进 title 悬停（走 GAME.costString 唯一渲染口）。 */
        '<button class="btn sm" data-action="tech-research" data-tech="' + t.id + '"'
          + ' title="需 ' + GAME.costString(cost) + '"'
          + (cur ? ' disabled' : '') + '>研究(黄金 ' + U.fmt(cost.gold) + ')</button>';
      return '<tr><td>' + t.name + '</td><td class="ctr">' + lv + '/10</td>' +
        '<td style="font-size:var(--fs-sub);color:var(--text-dim);">' + t.desc + '</td>' +
        '<td class="ctr">' + btn + '</td></tr>';
    }).join('');
    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 书院科技（' + bookLv + '级书院 · 23项）</div>' +
      (cur ? '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-body);margin-bottom:8px;">🔬 研究中：' + (function(){ var n=cur.techId; DATA.TECH.forEach(function(x){if(x.id===cur.techId)n=x.name;}); return n; })() + ' ' + Math.min(100, Math.floor(cur.elapsed / cur.totalTime * 100)) + '%' +
        /* v89.179b·P2-9：科技提速按钮显价（与 rush-build/rush-ext 同档） */
        (function () {
          var _c = GAME.queueRushCost(cur);
          return '　<button class="btn sm gold" data-action="rush-tech"'
            + ' title="花金立即完成（研究费 20% × 剩余比例，约 ' + U.fmt(_c) + ' 金）">⚡ 提速'
            + (_c ? ' −' + U.fmt(_c) : '') + '</button>';
        })() + '</div>' : '') +
      '<table class="tbl"><thead><tr><th>科技</th><th>等级</th><th>效果</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>';
  };

  /* --------- 宝物 --------- */
  ui.itemsHTML = function () {
    var s = GAME.state;
    /* v22：原先**每个宝物各带一个下拉框**（一屏 N 个），
       现在改为弹窗顶部选一次「使用对象」，所有物品共用。 */
    if (!ui._itemGen || !s.generals.some(function (g) { return g.id === ui._itemGen; })) {
      ui._itemGen = s.generals[0] ? s.generals[0].id : '';
    }
    var rows = Object.keys(s.items || {}).map(function (itemId) {
      var item = GAME.systems.itemInfo(itemId);
      if (!item) return '';
      var n = s.items[itemId];
      var needGen = ['jewel', 'attr_buff', 'exp', 'stamina', 'perm', 'mount_buff', 'rank_up'].indexOf(item.type) >= 0;
      /* 需要指定对象的宝物：直接用顶部选定的对象
         （按钮不再带 data-gen → main.js 回退到 ui._itemGen） */
      var btn = '<button class="btn sm" data-action="use-item" data-item="' + itemId + '">使用</button>';
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
          '<span style="font-weight:700;color:var(--gold-light);font-size:var(--fs-lead);">' + item.name + ' ×' + n + '</span>' +
          '<span style="display:flex;gap:6px;align-items:center;">' + btn + '</span>' +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + item.desc + '</div>' +
      '</div>';
    }).join('') || '<div class="q-empty">背包暂无宝物</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">💎 宝物背包</div>' +
      (s.generals.length
        ? '<div style="margin-bottom:10px;"><div class="ui-sub" style="margin-bottom:4px;">使用对象</div>' +
          ui.genChips({ store: '_itemGen', value: ui._itemGen,
            per: 16, key: 'gchips_item', wide: true }) + '</div>'
        : '') +
      rows + '</div>';
  };

  /* v77：爵位区块（rankBlock）已并入新的君主面板（左列表 / 右信息表），退役。 */

    ui.rankHTML = function () {
    var s = GAME.state;
    var cur = GAME.systems.rankInfo(s.rank);
    var next = GAME.systems.nextRank();
    var chk = next ? GAME.systems.canPromote() : null;
    var rows = DATA.RANK.map(function (r, i) {
      var isCur = i === s.rank;
      var jewelStr = Object.keys(r.jewel).length ? Object.keys(r.jewel).map(function (j) {
        var name = GAME.systems.itemInfo(j) ? GAME.systems.itemInfo(j).name : j;
        return name + '×' + r.jewel[j];
      }).join(' ') : '—';
      return '<tr' + (isCur ? ' style="background:rgba(201,162,75,.15);"' : '') + '>' +
        '<td>' + r.name + (isCur ? ' <span style="color:var(--green-ok);">←当前</span>' : '') + '</td>' +
        '<td class="ctr">' + r.city + '</td>' +
        '<td class="num">' + U.fmt(r.rep) + '</td>' +
        '<td class="num">' + U.fmt(r.gold) + '</td>' +
        '<td style="font-size:var(--fs-sub);">' + jewelStr + '</td>' +
        '<td class="num">' + U.fmt(r.salary) + '/h</td>' +
        /* v79（老板「爵位加成」）：食邑列（一直是死数据）退役，改列真实加成 */
        '<td style="font-size:var(--fs-sub);">' + GAME.rankBonusText(i) + '</td></tr>';
    }).join('');
    var promoteBtn = next ? '<button class="btn gold lg" data-action="promote"' + (chk && chk.ok ? '' : ' disabled') + '>晋升：' + next.name + '</button>' : '<div style="color:var(--gold-light);">已登顶「裂土封王」</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">👑 爵位 · 当前：' + cur.name + '</div>' +
      (next ? '<div style="background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;margin-bottom:12px;">' +
        '<div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">下一级：' + next.name + '</div>' +
        '<div class="res-line"><span class="lbl">声望</span><span class="val" style="color:' + (s.rep >= next.rep ? 'var(--green-ok)' : 'inherit') + ';">' + U.fmt(s.rep) + '/' + U.fmt(next.rep) + '</span></div>' +
        /* v89.108（老板）：城池数现在是**硬上限**（随爵位解封）——
           这一行同时是"晋爵门槛进度"与"领地上限"（cap = next.city，二者天然同值）。 */
        '<div class="res-line"><span class="lbl">城池（领地上限）</span><span class="val" style="color:' + (s.cities.length >= next.city ? 'var(--green-ok)' : 'inherit') + ';">' + s.cities.length + '/' + next.city + '</span></div>' +
        '<div class="res-line"><span class="lbl">黄金</span><span class="val" style="color:' + ((s.res.gold || 0) >= next.gold ? 'var(--green-ok)' : 'inherit') + ';">' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold) + '</span></div>' +
        (chk && chk.msg && !chk.ok ? '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:6px;">' + chk.msg + '</div>' : '') +
        '<div style="text-align:center;margin-top:12px;">' + promoteBtn + '</div></div>'
        /* v89.108：满档（无下一级）时也要看得到领地上限 */
        : '<div style="background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;margin-bottom:12px;color:var(--gold-light);">已登顶「' + cur.name + '」　·　领地上限 ' + GAME.cityCapOf() + ' 座（封顶）</div>') +
      '<table class="tbl"><thead><tr><th>爵位</th><th>城池</th><th>声望</th><th>黄金</th><th>珠宝需求</th><th>俸禄</th><th>加成</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="note">加成说明：产 = 全境产量 · 税 = 税收 · 储 = 仓储 · 造 = 同时建造 · 野 = 附属野地上限 · 席 = 每城将领席位。<br>' +
        '<b>领地上限随爵位解封</b>：打满上限（= 下一档的城池要求）即达晋爵门槛 —— 平民 2 座起，每晋一档 +1，封顶 22 座。</div>' +
      '</div>';
  };

  /* --------- 地图 --------- */

  /* ================= 地图（12×8 观察框 + 导航） =================
     v26（需求 4）：由 12×12 放宽为 12×8 —— 格子从 44px 放大到 52px。
     实数校验（平板基准 1024×768）：中央可用宽 702 - 28(padding) = 674 ≥ 12×52=624；
     高 530 - 28(padding) - 78(浮标让位) = 424 ≥ 8×52=416。 */
  /* v29（需求 1）：观察框**随窗口自适应**，目标是"尽量满屏"。
     ------------------------------------------------------------
     旧实现把观察框写死 12×8、格距上限 68。实测 1440 宽窗口：
     中央可用宽 ≈ 1048px，而画布只有 12×68 = 816px —— 右侧空出近 300px，
     地图明明有空间却不长。现在改成：
       ① 按理想格距 TARGET 估算能放几行几列（有上限，避免格子小到看不清）；
       ② 再用**实际可用空间回算格距**，把这块地方填满。
     无布局环境（jsdom / 测试）下 viewBoxSize 返回基准值，估算出的行列
     仍是 MAP_SPAN_X × MAP_SPAN_Y，所以测试结果保持确定性。 */
  /* v50：地块改为**菱形等距排布** —— 画布仍是 cols×rows 个"格距"，
     但每块地是宽 cell、高 cell/2 的菱形。于是：
       · 同一块画布能看到 cols 个菱形宽、2×rows 个菱形高；
       · 估行列时的目标格距要放大到 1.41 倍 —— 菱形面积只有同宽正方形的一半
         （cell²/4），不放大就成了"满地碎菱"，既看不清也点不准。 */
  var MAP_SPAN_X = 12, MAP_SPAN_Y = 6;
  /* v45（需求 2）：方向键**一次移动的格数** —— 老板指定"上下 8 格、左右 12 格"。
     v50 菱形下这两个数沿**网格轴**生效，屏幕位移是它们的对角合成：
       左右 → i 轴 +12 / j 轴 −12 → 屏幕水平移 12 个菱形宽（≈一屏宽）
       上下 → 两轴各 +8          → 屏幕垂直移 4 个菱形高 */
  ui.MAP_STEP_X = 12;
  ui.MAP_STEP_Y = 8;
  /* 格距按窗口算；jsdom 无布局时回落到基准值 */
  var MAP_CELL = 52;
  ui.MAP_TARGET_CELL = 88;       /* 正方形时代的理想格距（保留：图标尺寸仍按它对齐） */
  ui.MAP_TARGET_CELL_ISO = 124;  /* v50 菱形等距的理想格距 = 88 × 1.41 */
  ui.MAP_CELL_MIN = 34;          /* 小屏下限：再小就点不准了 */
  /* v89.52（老板：单一地块仍太大 → 整体再缩小为 1/2~1/3）：格距上限由 128 压到 44。
     大屏此前常驻 ~104px，现在最多 44px —— 单一地块约 0.34~0.42 倍（落在 1/2~1/3 区间）。
     配合下方 span 上限放大，画布仍能铺满界面，于是「同屏可见地块数」约 ×4，等于整体缩小了一档视野。 */
  /* v89.104（老板）：「地图能不能放大 20%（视野窄一点，画面大一点），现在感觉太细了没质感」
     —— 口径 = 一个**缩放倍率**同时作用在两处（只放大格距会留白、只收视野会变小图）：
       · 格距上限 ×1.2（44 → 53）：单格更大、图标与文字更清楚；
       · 观察框下限 ÷1.2（12×8 → 10×7）：同屏块数减少 → 视野更窄、画面更满。
     两处都由 `ui.MAP_ZOOM` 派生（改倍率只改一个数）。 */
  /* ============================================================
   * v89.138（老板 1）：「现在地图没有铺满界面，放大一点（不是视窗视野放大，
   *   而是**整体图像放大**）」——
   * 病根（探针实测 · probe_v89138_base.js）：v89.104 的 ZOOM 是**事后**缩放
   *   `cell = min(CELL_MAX, round(cell × ZOOM))`，而 CELL_MAX 本身已含 ZOOM
   *   （= round(44×1.2) = 53）→ 搜索出的 52 × 1.2 = 62 **被同一上限钳回 53**，
   *   只有 cols/rows 的 ÷ZOOM 生效 —— 结果是"视野窄了、格子没大、还留白"
   *   （1680×1000 实测：22×12@53 · 画布 1166×636 · 覆盖率仅 83%/81%）。
   * 修法：ZOOM 抬到 **2.0**（CELL_MAX = 88），并把 fitMapCell 的评分改成
   *   **"先铺满（覆盖率 ≥ 95%），铺满者取格距最大"**（见下）——
   *   铺满与放大同时满足，不再是二选一。
   * ============================================================ */
  ui.MAP_ZOOM = 2.0;
  ui.MAP_CELL_MAX = Math.round(44 * ui.MAP_ZOOM);
  ui.MAP_MIN_COLS = Math.max(8, Math.round(MAP_SPAN_X / ui.MAP_ZOOM));
  ui.MAP_MIN_ROWS = Math.max(5, Math.round(MAP_SPAN_Y / ui.MAP_ZOOM));
  /* 缩小后单格更小，把观察框上限放宽，让更多地块填进同一块画布（仍受 MAP_CELL_MAX 钳住格距）。 */
  ui.MAP_SPAN_MAX_X = 32, ui.MAP_SPAN_MAX_Y = 20;   /* 观察框最大范围 */
  ui.mapFrame = { spanX: MAP_SPAN_X, spanY: MAP_SPAN_Y, cell: MAP_CELL, iso: true };
  /* v85（老板）：「地图目前没有占满界面，建议占满，然后稍微放大一点图像」——
     旧口径"先按理想格距估行列、再回算格距"在 1440 屏给出 12×6@104：
     画布 1248×624 vs 可用 1376×733（右空 154 / 下空 157，且格距被 MAX 卡住）。
     改为**小搜索**：枚举 cols∈[12,22] × rows∈[6,14]，cell = min(availW/cols,
     availH/rows) 钳 [MIN, MAX]；score = 宽/高覆盖率的较小者（留白最均衡地最小）。
     先取 score 最高者；score 差 ≤1.2pp 时取格距更大者（"占满"与"放大"的折中）。
     1440 屏实测输出 13×7@104：画布 1352×728（覆盖 98%/99%，面积 +26%）；
     jsdom 基准下输出见测试（保持确定性）。 */
  ui.fitMapCell = function () {
    var box = ui.viewBoxSize();
    /* v76（老板）：地图导航迁入底部条 —— 不再为右下浮标让位（78 → 10，只留呼吸） */
    var pad = 28, extraH = 10, breath = 16;
    var availW = box.w - pad - breath;
    var availH = box.h - extraH - pad - breath;
    var best = null;
    /* ============================================================
     * v89.138（老板 1）：评分从"覆盖率最高"改为 **"铺满优先 → 铺满者取格距最大"**。
     * ------------------------------------------------------------
     * 旧评分（cov 最大、并列取 cell 更大）在 CELL_MAX 是硬闸时会把格数顶到上限
     * ——覆盖率高但格子小，且 ZOOM 一乘就被钳死（见上）。
     * 新评分两段：
     *   ① 先滤掉"铺不满"的组合（min(宽/高覆盖率) < FILL_MIN = 0.95）；
     *   ② 在铺满的候选里取 **cell 最大**（并列取覆盖面更大者）。
     * 这样 1680×1000 会选 17×9@80（≈99%/98%）而不是 22×12@53（83%/81%）。
     * 兜底：若 window 极端（无任何组合 ≥95%）→ 退化为旧口径（覆盖率最高）。
     * ============================================================ */
    var FILL_MIN = 0.95;
    var fallback = null;
    for (var cols = ui.MAP_MIN_COLS; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = ui.MAP_MIN_ROWS; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        /* 兜底榜（旧口径）：不论铺不铺满，留白最均衡者 */
        if (!fallback || cov > fallback.cov + 0.012
            || (Math.abs(cov - fallback.cov) <= 0.012 && cell > fallback.cell)) {
          fallback = { cols: cols, rows: rows, cell: cell, cov: cov };
        }
        if (cov < FILL_MIN) continue;                     /* ① 铺不满 → 不进主榜 */
        var better = !best || cell > best.cell
          || (cell === best.cell && cov > best.cov);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }
    if (!best) best = fallback;
    if (!best) {   /* 兜底（理论上不可达）：极端窗口下也要有解 */
      best = { cols: ui.MAP_MIN_COLS, rows: ui.MAP_MIN_ROWS,
        cell: Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX,
          Math.floor(Math.min(availW / ui.MAP_MIN_COLS, availH / ui.MAP_MIN_ROWS)))) };
    }
    var cols = best.cols, rows = best.rows, cell = best.cell;
    /* ============================================================
     * v89.104（老板）：「地图能不能放大 20%（视野窄一点，画面大一点），
     * 现在感觉太细了没质感」
     * ------------------------------------------------------------
     * 直接抬格距上限**没用**（实测：fitMapCell 为了"占满"会一直选小格
     * ——1680×1000 下仍是 20×17@41，上限 44→53 根本没被碰到）。
     * 所以放大作用在**搜索结果**上：格距 ×MAP_ZOOM、行列 ÷MAP_ZOOM ——
     * 于是单格更大（更清楚）、同屏块数更少（视野更窄），画布尺寸基本不变
     * （仍铺得满，不会留大片空白）。上/下限照旧夹在 MAP_CELL_MIN/MAX。
     * ============================================================ */
    /* v89.138：ZOOM 已并入上面的"格距上限"（CELL_MAX = 44 × ZOOM），
       这里**不再**对结果做第二次缩放（那正是"格子没大、还留白"的病根）——
       只保留一个幂等护栏：若历史调用方传进来 ZOOM ≠ 2.0 且缩放后仍铺得满，照做。 */
    if (ui.MAP_ZOOM && ui.MAP_ZOOM !== 2.0) {
      var zc = Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX, Math.round(cell * ui.MAP_ZOOM / 2.0)));
      var zcols = Math.max(ui.MAP_MIN_COLS, Math.round(cols * 2.0 / ui.MAP_ZOOM));
      var zrows = Math.max(ui.MAP_MIN_ROWS, Math.round(rows * 2.0 / ui.MAP_ZOOM));
      var zcov = Math.min(zcols * zc >= availW ? 1 : zcols * zc / availW,
        zrows * zc >= availH ? 1 : zrows * zc / availH);
      if (zcov >= 0.95) { cell = zc; cols = zcols; rows = zrows; }
    }
    ui.mapFrame = { spanX: cols, spanY: rows, cell: cell, iso: true };
    MAP_CELL = cell;
    return cell;
  };
  /* v50：mapView 的语义由"视口左上角格"改为**视野中心格** ——
     菱形网格在屏幕上是斜的，"左上角"不再对应任何有意义的格。 */
  ui.mapView = { x: null, y: null };
  /* v89.52（老板：底部导航栏最左按钮一键显示建筑/野地名称与等级）：标注层总开关。
     默认开（沿用野地名称常显），点按在底部条「🏷 名称」上切换；关时整层不画，地图更干净。 */
  ui._mapShowLabels = true;
  /* v89.61（老板「名称按钮应同时控制 城池内 / 城外建筑 / 地图地块 这 3 大部分」）：
     总开关的**唯一出口** —— 一次切换管三处，别再在别处写第二份判断：
       ① 大地图 canvas 标注层（**野地 / 据点**）→ map.render 收 showLabels；
       ② 城内视图（城池）与 ③ 城外视图的建筑名（.tile-label）+ 等级角标（.tile-badge）
          → 由 body.labels-off 一处 CSS 关掉（DOM 节点保留，只是 display:none，
            这样按 id/类名取节点的既有断言与点击逻辑都不受影响）。
     为什么 DOM 侧走 CSS 而不是重渲染：切视图时重渲染会丢选中态、且要碰 4 处调用点；
     加一个根类名是"一处生效、任何视图立即跟随"，也符合"把约束力放在环境上"。

     ⚠️ v89.67（老板「名城的名称永不消失（左下角名称菜单不影响名城的显示，不然地图上看不见了）」）
     —— 三处**例外**，它们**不受**这个开关控制：
       · 大地图上的**城池**名称 + 等级角标 + 都城/州城档位药丸（地图骨架，收掉就认不出哪座是哪座）；
       · 满界面缩略图的**城名层**（那层画的全是名城名称，同上理）；
       · （城内/城外视图不变 —— 那里画的是自家城池的建筑，与名城无关。） */
  ui.applyLabelSwitch = function () {
    var on = ui._mapShowLabels !== false;
    if (document.body && document.body.classList) document.body.classList.toggle('labels-off', !on);
    var btn = document.querySelector('.bb-label-toggle');
    if (btn) btn.classList.toggle('on', on);
  };

  ui.mapHTML = function () {
    ui.fitMapCell();                      /* v27：按窗口算地图格距 */
    var pc = GAME.map.playerCity() || { x: 250, y: 200 };
    /* v50：菱形下视野中心就是玩家城本身，不再需要按观察框做偏移（fr0 已无用） */
    if (ui.mapView.x == null) {
      /* v50：中心格 = 玩家城（菱形下不再需要"减去半个观察框"） */
      ui.mapView.x = U.clamp(pc.x, 0, DATA.MAP_W - 1);
      ui.mapView.y = U.clamp(pc.y, 0, DATA.MAP_H - 1);
    } else {
      /* 窗口变化导致观察框变大时，旧的视野中心可能越界 —— 这里顺手钳一次 */
      ui.mapView.x = U.clamp(ui.mapView.x, 0, DATA.MAP_W - 1);
      ui.mapView.y = U.clamp(ui.mapView.y, 0, DATA.MAP_H - 1);
    }
    var mkBtn = function (cls, dx, dy, txt) {
      return '<button class="map-btn ' + cls + '" data-action="map-pan" data-dx="' + dx + '" data-dy="' + dy + '">' + txt + '</button>';
    };
    /* v24（需求 1/2/3）：地图页只留**棋盘**，其余一律清掉 ——
       原先顶部有「🗺️ 天下大势 · 观察框 12×12 格 · 全图 500×500 · 109 座名城」、
       底部有 9 项地形图例、末尾还有一行操作提示：三段都是备注型文字，
       既占掉小半屏、又把棋盘挤小，读起来还比棋盘本身更抢眼。
       方向键与坐标框改到**右下角**一枚浮标内，不再横占一整行。
       v44（老板要求）：浮标内部**压成一行** —— 原来「方向键 3×2 网格 ＋ 坐标竖排两行」
       共占三行高度。现在：方向键横排 ← ▲ ▼ → ｜ 视野区间 ｜ 点选坐标 ｜ 坐标输入 + 前往/回主城/洛阳，
       全部同一行，上下不再占空间。 */
    /* v76（老板）：「底下有一个导航栏，可以考虑把地图的导航栏（上下左右，坐标之类）
       放到这个导航范围内」—— 导航不再挂地图页浮标，改登记到本帧的**底部固定导航条**
       （ui._bottom → paintBottom）；地图页本身只剩棋盘。 */
    ui._bottom.push('<div class="map-dock">' +
        '<div class="map-pad">' +
          mkBtn('left', -ui.MAP_STEP_X, 0, '◀') + mkBtn('up', 0, -ui.MAP_STEP_Y, '▲') +
          mkBtn('down', 0, ui.MAP_STEP_Y, '▼') + mkBtn('right', ui.MAP_STEP_X, 0, '▶') +
        '</div>' +
        '<span class="mk-sep"></span>' +
        '<span class="map-info" id="map-info">' + ui.mapInfoText() + '</span>' +
        '<span class="map-info mk-pick" id="map-pick-info">' + ui.mapPickText() + '</span>' +
        '<span class="mk-sep"></span>' +
        '<span class="mk-lbl">坐标</span>' +
        '<input id="map-gx" type="number" min="1" max="' + DATA.MAP_W + '" value="' + pc.x + '">' +
        '<span class="mk-lbl">,</span>' +
        '<input id="map-gy" type="number" min="1" max="' + DATA.MAP_H + '" value="' + pc.y + '">' +
        '<button class="btn sm gold" data-action="map-goto">前往</button>' +
        '<button class="btn sm" data-action="map-center">回主城</button>' +
        '<button class="btn sm" data-action="map-capital">洛阳</button>' +
        '<button class="btn sm" data-action="open-journal">📜 见闻录</button>' +
      '</div>');
    return '<div class="map-wrap">' +
      '<canvas id="mapCanvas"></canvas>' +
      '</div>';
  };

  /* ============================================================
   * v85（老板）：缩略地图渲染 —— 底部小图与「天下大势」面板复用同一份离屏图。
   * ------------------------------------------------------------
   * 静态层（地形 × 州染 + 州界/郡界 + 州城/郡城/都城点）画进离屏 canvas，
   * 按 map.seed 缓存；动态层（我城）在每次 drawMini 时叠加。
   * 界线样式：**州界 = 亮金实线（整格满涂）**；**郡界 = 灰白细线（对角 2px，
   * 细一档形成区分）** —— 即老板要的「不同样式的线条」。
   * ============================================================ */
  ui.MINI_PX = 1000;               /* 离屏分辨率 = 2px / 格（世界 500×500） */
  ui.MINI_TINT = [
    '#d4453a', '#4a80c8', '#c8813a', '#4aa06a', '#8a5fc0', '#b0b03a', '#3a9aa8',
    '#7a6ac0', '#c05a8a', '#5ac0a0', '#c0a040', '#6a9a40', '#c06040'
  ];
  ui._miniOff = null; ui._miniSeed = null;
  ui.mixHex = function (a, b, k) {        /* 十六进制色混合：a×(1-k) + b×k */
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round((pa >> 16) * (1 - k) + (pb >> 16) * k);
    var g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
    var bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
    return (r << 16) | (g << 8) | bl;
  };
  ui.miniOff = function () {              /* 离屏静态层（按 seed 缓存） */
    var s = GAME.state;
    if (ui._miniOff && ui._miniSeed === s.map.seed) return ui._miniOff;
    if (!GAME.map.miniBuild) return null;
    var d = GAME.map.miniBuild();
    var W = DATA.MAP_W, H = DATA.MAP_H, P = ui.MINI_PX / W;
    var cv, ctx, img;
    try {
      cv = document.createElement('canvas');
      cv.width = ui.MINI_PX; cv.height = ui.MINI_PX;
      ctx = cv.getContext && cv.getContext('2d');
      if (!ctx || !ctx.createImageData) return null;
      img = ctx.createImageData(ui.MINI_PX, ui.MINI_PX);
    } catch (e) { return null; }          /* jsdom：无 2d 上下文，静默跳过 */
    /* 底色查表：州染 × 地形色（预混，循环内只查表） */
    var baseLUT = [];
    for (var si = 0; si < ui.MINI_TINT.length; si++) {
      baseLUT[si] = {};
      for (var tk in DATA.TERRAIN) {
        var tc = DATA.TERRAIN[tk].color || '#b8a06a';            /* city 无 color → 土金 */
        baseLUT[si][tk] = ui.mixHex(tc, ui.MINI_TINT[si], 0.16);
      }
    }
    var px = img.data;
    var put = function (mx, my, v) {
      var o = (my * ui.MINI_PX + mx) * 4;
      px[o] = (v >> 16) & 255; px[o + 1] = (v >> 8) & 255; px[o + 2] = v & 255; px[o + 3] = 255;
    };
    var gt = s.map.grid || [];
    for (var y = 0; y < H; y++) {
      var row = gt[y] || [];
      for (var x = 0; x < W; x++) {
        var idx = y * W + x;
        var t = (row[x] && row[x].terrain) || 'plain';
        var st = d.state[idx], jn = d.jun[idx];
        var col = (baseLUT[st] && baseLUT[st][t] != null) ? baseLUT[st][t] : 0x808080;
        var rSt = x + 1 < W ? d.state[idx + 1] : st;
        var dSt = y + 1 < H ? d.state[idx + W] : st;
        var rJn = x + 1 < W ? d.jun[idx + 1] : jn;
        var dJn = y + 1 < H ? d.jun[idx + W] : jn;
        var X = x * P, Y = y * P;
        if (rSt !== st || dSt !== st) {                        /* 州界：亮金实线 */
          put(X, Y, 0xf0d060); put(X + 1, Y, 0xf0d060);
          put(X, Y + 1, 0xf0d060); put(X + 1, Y + 1, 0xf0d060);
        } else if (rJn !== jn || dJn !== jn) {                 /* 郡界：灰白细线（对角 2px） */
          put(X + 1, Y, 0xcfcfc0); put(X, Y + 1, 0xcfcfc0);
          put(X, Y, col); put(X + 1, Y + 1, col);
        } else {
          put(X, Y, col); put(X + 1, Y, col); put(X, Y + 1, col); put(X + 1, Y + 1, col);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    /* 城点：都城红 / 州城亮金 / 郡城米白（各带深色描边提升可读性） */
    var cityDot = function (cx, cy, w, fill, stroke) {
      var X = Math.round((cx + 0.5) / W * ui.MINI_PX) - Math.round(w / 2);
      var Y = Math.round((cy + 0.5) / W * ui.MINI_PX) - Math.round(w / 2);
      ctx.fillStyle = stroke; ctx.fillRect(X - 1, Y - 1, w + 2, w + 2);
      ctx.fillStyle = fill; ctx.fillRect(X, Y, w, w);
    };
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (c.type === 'capital') cityDot(c.x, c.y, 6, '#ff5a40', '#3a0f08');
      else if (c.type === 'zhou') cityDot(c.x, c.y, 5, '#ffd76a', '#4a3208');
      else if (c.type === 'jun') cityDot(c.x, c.y, 3, '#f2ead0', '#3a3a2c');
    });
    ui._miniOff = cv; ui._miniSeed = s.map.seed;
    return cv;
  };
  /* ============================================================
   * v89.47（老板 ②）：「增大都、州、郡城的名称与示意点」
   * ------------------------------------------------------------
   * 名称与示意点一律按画布边长的**比例**给尺寸（size = 画布实际边长），
   * 于是 38px 底部小图与 ~900px 满界面档共用同一份口径：
   * 比例尺寸在小图上必然小于 1px（= 噪点），所以只有 labels:true 的大图才走这里。
   *
   * 标定（探针 tools/probe/probe_minimap_labels.js · 实测）：
   *   · 都/州/郡 共 109 座，名字 2 字（105 座）或 3 字（4 座）；
   *   · 平铺字号 20px 时重叠 6 对；22px 起跳到 41 对 —— 2.0% 是「郡」的上限；
   *   · 故取**分级**字形：都 2.7% / 州 2.3% / 郡 2.0%（都城最大，层级一眼可读）；
   *     实测残叠 19 处、最深深 3px（画布 1000px 基准）= 擦边，不糊字；
   *     备选「都 3.2% / 州 2.6% / 郡 2.1%」残叠 31 处、深 7px —— 已否决，别再往上加；
   *   · 「默认标下方、压字就翻上方」的启发式是这些数字成立的前提（见 miniLabels）；
   *   · 县 65 座最近仅相距 10px（画布 1%）→ 县名一律不标（标了必糊成一片）。
   * ============================================================ */
  ui.MINI_LABEL = {
    fontK: { capital: 0.027, zhou: 0.023, jun: 0.020 },   /* 字号 = 画布边长 × 该比例 */
    dotK: { capital: 0.030, zhou: 0.022, jun: 0.015 },    /* 示意点边长（比例） */
    gapK: 0.004,                         /* 城点与标签之间的留白 */
    /* v89.68（老板：缩略图三级下钻筛选）：下钻档的字形/点径 ——
       聚焦档统一尺寸（同一个档位，大小一致才读得出"同一层"）：
         focusX  = 被筛中的那一档（州城 / 郡城 / 县城）
         anchorX = 上级参照城（看郡档时给州城、看县档时给郡城）—— 它稍大一点，
                   因为"我现在在哪个州/哪个郡"必须先看得见，否则一片地形无从定位。
       数值比默认三层略大一档：下钻后视野变小，点与字有地方放大。 */
    focusFontK: 0.022, focusDotK: 0.018,
    anchorFontK: 0.026, anchorDotK: 0.024,
    meFontK: 0.018      /* v89.132：我城名称 —— 比郡城（0.020）小一档，
                           自己的城可能有很多座，字要轻 */
  };

  /* ============================================================
   * v89.68（老板）：缩略图三级下钻筛选 —— 州城 / 郡城 / 县城
   * ------------------------------------------------------------
   * 老板原话：「缩略图加一个筛选按钮，当选择"州城"时，州城所在的点放大，并在缩略图上
   *   显示名称；选择"郡城"时，增加一个可选框选定某个州城，然后仅显示该州，并将郡城
   *   所在的点放大，并在缩略图上显示名称；同理，选择"县城"时，逐级选择州郡，仅显示
   *   该郡地图，并将县城所在的点放大，并在缩略图上显示名称」
   *
   * 抽象成一层 **view = 取景窗 + 聚焦集**（唯一出口 `ui.miniView()`）：
   *   · win    —— 世界格坐标里的**正方形**取景窗（只显示这一块）。全部档位都走它，
   *               默认 = 全图 {0,0,500}（与旧行为逐像素一致）。
   *               为什么必须方：画布是方的，拿非方 bbox 直接 drawImage 会横向拉伸。
   *   · list   —— 这一档要**放大 + 标名**的城。
   *   · anchor —— 上级参照城（郡档给州城、县档给郡城）：不画它，
   *               玩家看到一片地形不知道自己在哪个州/郡。
   * 归属一律走既有唯一出口：**县 → 郡 = `GAME.regionOf`**（"本州内最近的郡城"），
   * 不另写一套就近规则（两套规则 = 两个出口 = 迟早不一致）。
   *
   * ⚠️ 数据现实（探针实测，写在这里免得后人以为是 bug）：
   *   全图 都城1 + 州城12 + **郡城96** + 县城65 —— 县按"就近归属"分下去是
   *   **43 个郡没有任何县城**（42 郡 1 座、10 郡 2 座、1 郡 3 座）。
   *   所以县档在"无县的郡"上会空 —— 面板会明写原因，郡下拉框也带「（N 县）」标注，
   *   让玩家自己挑有县的郡，而不是对着空图猜。
   * ============================================================ */
  ui._miniFilter = { level: '', state: '', jun: '' };
  ui._miniViewCache = null;
  /* 点集 → 正方形取景窗（保持长宽比 · 钳在地图内 · 留边距） */
  ui.miniWindowOf = function (pts, pad) {
    var W = DATA.MAP_W, H = DATA.MAP_H;
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
    (pts || []).forEach(function (p) {
      if (!p) return;
      n++;
      if (p.x < x0) x0 = p.x;
      if (p.x > x1) x1 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.y > y1) y1 = p.y;
    });
    if (!n) return { x0: 0, y0: 0, side: W };
    var pd = pad == null ? 12 : pad;
    x0 -= pd; x1 += pd; y0 -= pd; y1 += pd;
    var side = Math.min(Math.max(x1 - x0, y1 - y0), Math.max(W, H));
    side = Math.max(side, 30);                    /* 下限：放大过头会把底图放成马赛克 */
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return {
      x0: Math.round(U.clamp(cx - side / 2, 0, W - side)),
      y0: Math.round(U.clamp(cy - side / 2, 0, H - side)),
      side: Math.round(side)
    };
  };
  ui.miniStates = function () {                   /* 州列表（按数据顺序，稳定不跳） */
    var out = [], seen = {};
    (DATA.NPC_CITIES || []).forEach(function (c) {
      if (!c.state || seen[c.state]) return;
      seen[c.state] = 1; out.push(c.state);
    });
    return out;
  };
  ui.miniJunsOf = function (state) {
    return (DATA.NPC_CITIES || []).filter(function (c) {
      return c.type === 'jun' && c.state === state;
    });
  };
  /* 某郡所辖县城 —— 走 regionOf（"本州内最近郡城"），不另立就近规则 */
  ui.miniCountiesOf = function (junCity) {
    if (!junCity || !(GAME.regionOf)) return [];
    return (DATA.NPC_CITIES || []).filter(function (c) {
      if (c.type !== 'county') return false;
      var rg = GAME.regionOf(c.x, c.y);
      return !!(rg && rg.junCity && rg.junCity.id === junCity.id);
    });
  };
  ui.miniDefaultState = function () {             /* 默认州：玩家当前城所在州，其次第一个 */
    var states = ui.miniStates();
    var cur = GAME.currentCity && GAME.currentCity();
    var st = cur && cur.state;
    return (st && states.indexOf(st) >= 0) ? st : (states[0] || '');
  };
  ui.miniDefaultJun = function (state) {          /* 默认郡：优先"有县城"的那个（免得一进来是空图） */
    var juns = ui.miniJunsOf(state), hit = null;
    juns.forEach(function (j) { if (!hit && ui.miniCountiesOf(j).length) hit = j; });
    return (hit || juns[0] || {}).id || '';
  };
  /* 当前视图（唯一出口）—— 底图、点选换算、筛选行文案全部读它 */
  ui.miniView = function () {
    var f = ui._miniFilter || { level: '', state: '', jun: '' };
    var sig = (f.level || '') + '|' + (f.state || '') + '|' + (f.jun || '');
    if (ui._miniViewCache && ui._miniViewCache.sig === sig) return ui._miniViewCache.v;
    var all = DATA.NPC_CITIES || [];
    var v = { level: f.level || '', win: { x0: 0, y0: 0, side: DATA.MAP_W },
      list: [], anchor: null, hint: '', sig: sig };
    if (v.level === 'mine') {
      /* v89.139（老板 6）：「在上方筛选处增加『我城』，选中之后在地图上显示我方所有城池的红点」
         —— 取景窗框住全部我方城池（点位很少，pad 给大些，免得贴边）。 */
      v.list = (GAME.state.cities || []).slice();
      v.win = ui.miniWindowOf(v.list, 16);
      v.hint = '我方城池 ' + v.list.length + ' 座（默认档只标当前城）';
    } else if (v.level === 'zhou') {
      v.list = all.filter(function (c) { return c.type === 'zhou' || c.type === 'capital'; });
      v.hint = '全图 · 都城与州城 ' + v.list.length + ' 座';
    } else if (v.level === 'jun' || v.level === 'county') {
      var st = f.state || ui.miniDefaultState();
      var juns = ui.miniJunsOf(st);
      var zc = null;
      all.forEach(function (c) {
        if (!zc && (c.type === 'zhou' || c.type === 'capital') && c.state === st) zc = c;
      });
      if (v.level === 'jun') {
        v.list = juns; v.anchor = zc;
        v.win = ui.miniWindowOf(juns.concat(zc ? [zc] : []), 12);
        v.hint = st + ' · 共 ' + juns.length + ' 郡' + (juns.length ? '' : '（暂无郡城）');
      } else {
        var jc = null;
        juns.forEach(function (j) { if (j.id === f.jun) jc = j; });
        if (!jc) jc = juns[0] || null;
        v.list = ui.miniCountiesOf(jc); v.anchor = jc;
        v.win = ui.miniWindowOf(v.list.concat(jc ? [jc] : []), 14);
        v.hint = jc
          ? (st + ' · ' + GAME.junNameOf(jc.name) + '：' + (v.list.length ? v.list.length + ' 座县城' : '本郡暂无县城（县按就近归属，全图仅 65 座）'))
          : (st + ' · 暂无郡城');
      }
    }
    ui._miniViewCache = { sig: sig, v: v };
    return v;
  };
  ui.setMiniFilter = function (key, val) {
    var f = ui._miniFilter = ui._miniFilter || { level: '', state: '', jun: '' };
    if (key === 'level') {
      f.level = val || '';
      /* 换档时下级**复位到有内容的默认值**，免得一进来就是空视图 */
      f.state = ''; f.jun = '';
      if (f.level === 'jun' || f.level === 'county') {
        f.state = ui.miniDefaultState();
        if (f.level === 'county') f.jun = ui.miniDefaultJun(f.state);
      }
    } else if (key === 'state') {
      f.state = val || '';
      f.jun = (f.level === 'county') ? ui.miniDefaultJun(f.state) : '';
    } else {
      f.jun = val || '';
    }
    ui._miniViewCache = null;
    ui.openMinimap();                    /* 重开面板：画布尺寸与筛选行一起刷新（同出征/自动面板的做法） */
  };
  /* 下钻档的标注层（与默认三层分开 —— 默认那套的字号是探针标定过的，别搅在一起） */
  ui.miniFocusLabels = function (ctx, size, v) {
    var K = ui.MINI_LABEL, win = v.win, W = DATA.MAP_W;
    var COL = {
      capital: { dot: '#ff5a40', line: '#3a0f08', txt: '#ffe0d0' },
      zhou: { dot: '#ffd76a', line: '#4a3208', txt: '#ffe9a8' },
      jun: { dot: '#f2ead0', line: '#3a3a2c', txt: '#f6f2e0' },
      county: { dot: '#9fe08a', line: '#123a10', txt: '#d8ffcf' }   /* 县城：青绿，与郡城米白区分 */
    };
    var items = [];
    if (v.anchor) items.push({ c: v.anchor, anchor: true });        /* 锚点先落，位置优先保障 */
    (v.list || []).forEach(function (c) { items.push({ c: c, anchor: false }); });
    var placed = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    items.forEach(function (it) {
      var c = it.c;
      var cx = (c.x + 0.5 - win.x0) / win.side * size;
      var cy = (c.y + 0.5 - win.y0) / win.side * size;
      if (cx < -30 || cx > size + 30 || cy < -30 || cy > size + 30) return;   /* 窗外的城不画 */
      var fs = Math.max(10, Math.round(size * (it.anchor ? K.anchorFontK : K.focusFontK)));
      var d = Math.max(6, Math.round(size * (it.anchor ? K.anchorDotK : K.focusDotK)));
      var col = COL[c.type] || COL.jun;
      /* 名称一律补上行政后缀：县城数据里存的是裸名（如"乐安"），
         只写"乐安"玩家分不清是县还是郡 —— 而这一档筛选的意义就是分清层级。 */
      var txt = String(c.name || '');
      if (c.type === 'county' && !/[县道]$/.test(txt)) txt += '县';
      else if (c.type === 'jun' && !/[郡国]$/.test(txt)) txt += '郡';
      var w = fs * txt.length, h = fs;
      var dy = d / 2 + h / 2 + Math.round(size * K.gapK);
      var box = function (sign) {
        var ty = cy + sign * dy;
        return { x0: cx - w / 2, y0: ty - h / 2, x1: cx + w / 2, y1: ty + h / 2, ty: ty };
      };
      var ov = function (b) {
        var sum = 0;
        for (var i = 0; i < placed.length; i++) {
          var a = placed[i];
          var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          var oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (ox > 0 && oy > 0) sum += Math.min(ox, oy);
        }
        return sum;
      };
      var down = box(1), up = box(-1);
      var sd = ov(down), su = ov(up);
      var use = (sd === 0) ? down : (su < sd ? up : down);
      placed.push(use);
      ctx.fillStyle = col.line;
      ctx.fillRect(cx - d / 2 - 1, cy - d / 2 - 1, d + 2, d + 2);
      ctx.fillStyle = col.dot;
      ctx.fillRect(cx - d / 2, cy - d / 2, d, d);
      /* v89.132（老板「缩略地图上的字体笔画太厚了」）：bold → normal，
         描边 0.18fs → 0.12fs（原来两样叠加，字看着是被「描粗」的） */
      ctx.font = 'normal ' + fs + 'px sans-serif';
      ctx.lineWidth = Math.max(1.2, fs * 0.12);
      ctx.strokeStyle = 'rgba(18,12,6,.9)';
      ctx.strokeText(txt, cx, use.ty);
      ctx.fillStyle = col.txt;
      ctx.fillText(txt, cx, use.ty);
    });
    return items.length;
  };
  /* 打底：城点 + 名称（唯一出口 —— 别在别处再画一套城名） */
  ui.miniLabels = function (ctx, size) {
    var W = DATA.MAP_W, K = ui.MINI_LABEL;
    var order = { capital: 0, zhou: 1, jun: 2 };
    /* 落位顺序 = 都城 → 州 → 郡（大地名的位置优先保障），组内按名排序保证同 seed 同貌 */
    var list = (DATA.NPC_CITIES || []).filter(function (c) {
      return order[c.type] != null;
    }).slice().sort(function (a, b) {
      return (order[a.type] - order[b.type]) || String(a.name).localeCompare(String(b.name));
    });
    var COL = {
      capital: { dot: '#ff5a40', line: '#3a0f08', txt: '#ffe0d0' },
      zhou: { dot: '#ffd76a', line: '#4a3208', txt: '#ffe9a8' },
      jun: { dot: '#f2ead0', line: '#3a3a2c', txt: '#f6f2e0' }
    };
    var placed = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach(function (c) {
      var cx = (c.x + 0.5) / W * size, cy = (c.y + 0.5) / W * size;
      var fs = Math.max(9, Math.round(size * (K.fontK[c.type] || K.fontK.jun)));
      var d = Math.max(5, Math.round(size * (K.dotK[c.type] || K.dotK.jun)));
      var txt = String(c.name || '');
      var w = fs * txt.length, h = fs;                       /* CJK 字宽 ≈ 1em */
      var dy = d / 2 + h / 2 + Math.round(size * K.gapK);
      var boxAt = function (sign) {
        var ty = cy + sign * dy;
        return { x0: cx - w / 2, y0: ty - h / 2, x1: cx + w / 2, y1: ty + h / 2, ty: ty };
      };
      var ovOf = function (b) {                              /* 与已落标注的重叠深度 */
        var sum = 0;
        for (var i = 0; i < placed.length; i++) {
          var a = placed[i];
          var ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
          var oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (ox > 0 && oy > 0) sum += Math.min(ox, oy);
        }
        return sum;
      };
      var down = boxAt(1), up = boxAt(-1);
      var sd = ovOf(down), su = ovOf(up);
      var use = (sd === 0) ? down : (su < sd ? up : down);
      placed.push(use);
      /* ① 示意点：深色描边方点（与图例 ■ 同形，一眼认同） */
      ctx.fillStyle = COL[c.type].line;
      ctx.fillRect(cx - d / 2 - 1, cy - d / 2 - 1, d + 2, d + 2);
      ctx.fillStyle = COL[c.type].dot;
      ctx.fillRect(cx - d / 2, cy - d / 2, d, d);
      /* ② 名称：先描一圈深色（亮底暗底都读得清），再填亮色 */
      /* v89.132（老板「缩略地图上的字体笔画太厚了」）：bold → normal，
         描边 0.18fs → 0.12fs（原来两样叠加，字看着是被「描粗」的） */
      ctx.font = 'normal ' + fs + 'px sans-serif';
      ctx.lineWidth = Math.max(1.2, fs * 0.12);
      ctx.strokeStyle = 'rgba(18,12,6,.9)';
      ctx.strokeText(txt, cx, use.ty);
      ctx.fillStyle = COL[c.type].txt;
      ctx.fillText(txt, cx, use.ty);
    });
    return list.length;
  };
  /* ============================================================
   * v89.132（老板）：「缩略地图上的字体笔画太厚了。我城的标注不清晰，那个点可以
   *   改成红点，并且当前玩家所在城池的点出现闪烁或者波纹状点晕，提示当前所在位置」。
   * 三个出口（唯一来源）：
   *   · ui.miniMeDot    —— 我城的点：**红点** + 亮描边
   *     （从前是金点 #ffe9a0，与州城金色 #ffd76a 撞色 —— 这正是"标注不清晰"的一因）；
   *     `big` 档给底部条那枚 38px 小图（内部 1000px 画布 → 点要画到 size/16 才看得见）；
   *   · ui.miniMeWave   —— 波纹点晕（**当前城**专属；满界面档由 mini-pulse 动画层重绘）；
   *   · ui.miniMeLabels —— 我城名称（满界面档在红点旁标城名；当前城最后画、压最上层）。
   * 「当前城」= 玩家正在看的那座（`GAME.ui._cityId`）。
   * ============================================================ */
  ui.MINI_ME = { dot: '#ff3a2a', ring: '#ffe6c8', wave: '255,86,56' };
  ui.MINI_WAVE_MS = 1500;               /* 一圈波纹的周期（毫秒） */
  ui.miniMeDot = function (ctx, cx, cy, size, big) {
    var r = big ? Math.max(6, size / 16) : Math.max(3, size / 100);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832);
    ctx.fillStyle = ui.MINI_ME.dot; ctx.fill();
    ctx.lineWidth = Math.max(1, size / 420);
    ctx.strokeStyle = ui.MINI_ME.ring; ctx.stroke();
  };
  ui.miniMeWave = function (ctx, cx, cy, size, t) {
    var r0 = Math.max(3, size / 100), span = Math.max(10, size / 24);
    for (var i = 0; i < 2; i++) {
      var ph = ((t / ui.MINI_WAVE_MS) + i / 2) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, r0 + span * ph, 0, 6.2832);
      ctx.strokeStyle = 'rgba(' + ui.MINI_ME.wave + ',' + ((1 - ph) * 0.6).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1.2, size / 360);
      ctx.stroke();
    }
  };
  ui.miniMeLabels = function (ctx, size, v, win) {
    var s = GAME.state, K = ui.MINI_LABEL;
    /* v89.139（老板 6）：默认档只标当前城名；「我城」档标全部（与红点同一判据）。 */
    var _allMine = (v && v.level === 'mine');
    var list = (s.cities || []).filter(function (c) {
      return _allMine || c.id === ui._cityId;
    }).sort(function (a, b) {
      return ((a.id === ui._cityId) ? 1 : 0) - ((b.id === ui._cityId) ? 1 : 0);   /* 当前城最后画 */
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach(function (c) {
      var p = win(c.x, c.y);
      if (!p) return;                   /* 窗外的我城不标 */
      var isCur = (c.id === ui._cityId);
      var fs = Math.max(9, Math.round(size * K.meFontK));
      var d = Math.max(5, Math.round(size * K.dotK.jun));
      var dy = d / 2 + fs / 2 + Math.round(size * K.gapK);
      var txt = String(c.name || '');
      ctx.font = 'normal ' + fs + 'px sans-serif';
      ctx.lineWidth = Math.max(1.2, fs * 0.12);
      ctx.strokeStyle = 'rgba(30,8,4,.92)';
      ctx.strokeText(txt, p[0], p[1] + dy);
      ctx.fillStyle = isCur ? '#ffd9c0' : '#ffeede';
      ctx.fillText(txt, p[0], p[1] + dy);
    });
  };
  /* 波纹动画层：只清空 + 画当前城的波纹（不重绘底图/城名 —— 所以能 100ms 一跳）。
     面板一关，下一跳 `#mini-pulse` 取不到 → 定时器自灭（不钩 closeModal，少一处耦合）。 */
  ui._miniPulseTimer = null;
  ui.paintMiniPulse = function () {
    var cv = (document.getElementById && document.getElementById('mini-pulse'));
    if (!cv) {
      if (ui._miniPulseTimer) { clearInterval(ui._miniPulseTimer); ui._miniPulseTimer = null; }
      return;
    }
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx || !ctx.clearRect || !ctx.arc) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    var s = GAME.state, cur = null;
    (s.cities || []).forEach(function (c) { if (c.id === ui._cityId) cur = c; });
    if (!cur) return;
    var v = ui.miniView(), side = cv.width;
    var px = (cur.x + 0.5 - v.win.x0) / v.win.side * side;
    var py = (cur.y + 0.5 - v.win.y0) / v.win.side * side;
    if (px < 0 || py < 0 || px > side || py > side) return;   /* 下钻到别处：当前城不在窗内 */
    ui.miniMeWave(ctx, px, py, side, Date.now());
  };
  ui.drawMini = function (canvas, size, opts) { /* 打底 + 动态层（我城金点）+ 可选的城名层 */
    if (!canvas) return false;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || !ctx.drawImage) return false;
    var off = ui.miniOff();
    if (!off) return false;
    var W = DATA.MAP_W, P = ui.MINI_PX / W;
    var v = ui.miniView();                       /* v89.68：取景窗 + 聚焦集（唯一出口） */
    ctx.clearRect(0, 0, size, size);
    /* 底图按**取景窗**裁切绘制。默认窗 = 全图 → 源矩形正好是整张离屏图，
       与 v89.47 的 `drawImage(off, 0, 0, size, size)` 逐像素等价（下钻时才变）。 */
    ctx.drawImage(off, v.win.x0 * P, v.win.y0 * P, v.win.side * P, v.win.side * P,
      0, 0, size, size);
    var s = GAME.state;
    var _win = function (x, y) {            /* 世界格 → 画布坐标；窗外 null */
      var px = (x + 0.5 - v.win.x0) / v.win.side * size;
      var py = (y + 0.5 - v.win.y0) / v.win.side * size;
      return (px < 0 || py < 0 || px > size || py > size) ? null : [px, py];
    };
    /* v89.47：满界面档才画城名与大示意点（小图比例下它们不足 1px）
       v89.68：下钻档走自己的标注层（聚焦档统一放大 + 锚点参照） */
    if (opts && opts.labels) {
      if (v.level) ui.miniFocusLabels(ctx, size, v);
      else ui.miniLabels(ctx, size);
    }
    /* v89.132：我城（红点 + 名称）**压最后一层** —— 自己的位置最优先：
       与名城近邻重合时也不被名城点盖住。实测（diag_v89132_reddot.js）：
       许都紧邻州城，旧顺序下红点被州城金方点整个吃掉 ——
       这正是老板「我城的标注不清晰」的第二重病因（第一重：金点撞色、无名称）。 */
    /* 底部小图的「当前城」1Hz 闪烁（主循环每秒重绘时按秒奇偶取相位） */
    var _blink = (opts && opts.meBlink)
      ? ((Math.floor(Date.now() / 1000) % 2 === 0) ? 1 : 0.42) : 1;
    /* v89.139（老板 6）：「地图缩略图中，我城的红点默认只显示当前玩家所在城池的点。
       在上方筛选处增加『我城』，选中之后…显示我方所有城池的红点」——
       默认档（level=''）只画 `ui._cityId` 那一个；切到「我城」档才画全部。 */
    var _allMine139 = (v.level === 'mine');
    (s.cities || []).forEach(function (c) {
      if (!_allMine139 && c.id !== ui._cityId) return;   /* 默认档：只标当前城 */
      var p = _win(c.x, c.y);
      if (!p) return;                       /* 窗外的我城不画 */
      if (c.id === ui._cityId) ctx.globalAlpha = _blink;
      ui.miniMeDot(ctx, p[0], p[1], size, !!(opts && opts.meBig));
      ctx.globalAlpha = 1;
    });
    if (opts && opts.labels) ui.miniMeLabels(ctx, size, v, _win);   /* 我城名称（红点旁） */
    return true;
  };
  ui.paintMiniBottom = function () {      /* 底部条那枚 38px 小图 */
    var cv = $('#mini-canvas');
    if (!cv) return;
    /* v89.132：meBig = 大号红点（38px 显示下 ~2.4px，才能看清「我在哪」）；
       meBlink = 当前城 1Hz 闪烁（主循环每秒重绘，按秒奇偶取相位）。 */
    try { ui.drawMini(cv, ui.MINI_PX, { meBig: true, meBlink: true }); } catch (e) { /* 画布 stub 环境：静默跳过 */ }
  };
  /* ============================================================
   * v89.47（老板 ①③）：天下大势「满界面」+ 点选跳转
   * ------------------------------------------------------------
   * ① 满界面：弹窗走 modal-max 档（铺满视口），画布边长 = 可用高度反推的方，
   *    且**内部分辨率 1:1 跟随显示尺寸**（不再固定 1000）—— 城名是文字，
   *    放大显示时若内部不跟着涨就会糊；这里按 dpr 取 1:1，字始终锐。
   * ③ 点选跳转：坐标换算**唯一出口** ui.miniPick（事件里不再算第二遍），
   *    跳转时序照抄 journal-go（关面板 → 切地图视图 → 居中 → 提示）。
   * ============================================================ */
  ui.fitMini = function () {              /* 满界面档：把画布内部分辨率对齐显示尺寸 */
    var cv = $('#mini-big');
    if (!cv) return ui.MINI_PX;
    var box = 0;
    /* 优先量 .mini-wrap（弹窗里**真实剩余**的那块地方）——
       CSS 里的 calc(100vh - 190px) 只是首帧兜底，图例换行/字号变化都会让它偏大。 */
    try {
      /* v89.150（老板 2）：改用 **clientWidth/Height**（布局尺寸）——
         getBoundingClientRect 在整体缩放下返回的是**视觉尺寸**（已被 scale 乘过），
         拿它当画布边长会让小地图内部像素与显示尺寸差一个 k。 */
      var wrap = cv.parentNode;
      if (wrap && wrap.clientWidth && wrap.clientHeight) box = Math.min(wrap.clientWidth, wrap.clientHeight);
      if (!box && cv.clientWidth) box = Math.min(cv.clientWidth, cv.clientHeight || cv.clientWidth);
    } catch (e) { box = 0; }
    /* 布局未就绪（stub 环境 / 隐藏中）：按**画布**反推，别退回 1000 硬编码 */
    if (!box || box < 120) {
      var _cs150b = ui.canvasSize();
      box = Math.max(240, Math.min(_cs150b.w - 40, _cs150b.h - 190));
    }
    box = Math.floor(box);
    if (cv.style) { cv.style.width = box + 'px'; cv.style.height = box + 'px'; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var side = Math.round(box * dpr);
    if (cv.width !== side) { cv.width = side; cv.height = side; }
    return side;                          /* 返回值就是画布内部边长，绘制全按它缩放 */
  };
  ui.miniPick = function (clientX, clientY, canvas) {   /* 屏幕坐标 → 世界格坐标 */
    var el = canvas || $('#mini-big');
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var kx = (clientX - r.left) / r.width, ky = (clientY - r.top) / r.height;
    if (kx < 0 || kx > 1 || ky < 0 || ky > 1) return null;
    /* v89.68：点选换算必须反解**取景窗** —— 下钻放大后，屏幕上同一位置对应的世界格
       完全不同；漏了这一步，放大后点谁都会跳到别处（默认窗=全图时与旧行为一致）。 */
    var win = ui.miniView().win;
    return {
      x: U.clamp(Math.floor(win.x0 + kx * win.side), 0, DATA.MAP_W - 1),
      y: U.clamp(Math.floor(win.y0 + ky * win.side), 0, DATA.MAP_H - 1)
    };
  };
  ui.miniGo = function (x, y) {           /* 点选跳转的唯一落点（与 journal-go 同时序） */
    ui.closeModal();
    if (ui.view !== 'map') ui.setView('map');
    ui.mapCenterOn(x, y);
    ui.toast('已定位至 (' + x + ',' + y + ')');
  };
  ui.bindMiniPick = function (canvas) {
    var el = canvas || $('#mini-big');
    if (!el || !el.addEventListener || el._miniBound) return;
    el._miniBound = true;
    el.addEventListener('click', function (e) {
      var g = ui.miniPick(e.clientX, e.clientY, el);
      if (g) ui.miniGo(g.x, g.y);
    });
  };
  ui.openMinimap = function () {          /* 「天下大势」面板（v89.47：满界面 + 可点选；v89.68：三级下钻） */
    var f = ui._miniFilter || { level: '', state: '', jun: '' };
    var v = ui.miniView();
    /* v89.139（老板 6）：加「我城」档（画全部我方城池红点 + 取景窗框住它们） */
    var LV = [['', '全部'], ['mine', '我城'], ['zhou', '州城'], ['jun', '郡城'], ['county', '县城']];
    var o = function (val, label, on) {
      return '<option value="' + val + '"' + (on ? ' selected' : '') + '>' + label + '</option>';
    };
    var states = ui.miniStates();
    var selState = '', selJun = '';
    /* 级联：郡档才给"州"；县档再给"郡"。逐级收敛，正是老板要的"逐级选择州郡"。 */
    if (f.level === 'jun' || f.level === 'county') {
      var cur = f.state || ui.miniDefaultState();
      selState = '<label>州</label><select id="mini-state">' + states.map(function (s) {
        return o(s, s + '（' + ui.miniJunsOf(s).length + ' 郡）', s === cur);
      }).join('') + '</select>';
    }
    if (f.level === 'county') {
      var juns = ui.miniJunsOf(f.state || ui.miniDefaultState());
      selJun = '<label>郡</label><select id="mini-jun">' + juns.map(function (j) {
        var n = ui.miniCountiesOf(j).length;
        return o(j.id, GAME.junNameOf(j.name) + '（' + n + ' 县）', j.id === f.jun);
      }).join('') + '</select>';
    }
    var bar = '<div class="mini-filter">' +
      '<label>筛选</label><select id="mini-level">' +
        LV.map(function (kv) { return o(kv[0], kv[1], (f.level || '') === kv[0]); }).join('') +
      '</select>' + selState + selJun +
      (v.hint ? '<span class="mf-hint">' + U.escape(v.hint) + '</span>' : '') +
      '</div>';
    ui.openModal(
      '<div class="gold-heading">🗺 天下大势</div>' + bar +
      '<div class="mini-full">' +
        '<div class="mini-wrap"><canvas id="mini-big"></canvas>' +
          /* v89.132：波纹层（绝对定位盖在底图上，只画当前城的点晕） */
          '<canvas id="mini-pulse" class="mini-pulse"></canvas></div>' +
        '<div class="mini-legend"><b class="lg-state">━</b> 州界　<b class="lg-jun">┄</b> 郡界　' +
          '<b class="lg-cap">■</b> 都城　<b class="lg-zhou">■</b> 州城　<b class="lg-jun-c">■</b> 郡城　' +
          '<b class="lg-cty">■</b> 县城　<b class="lg-me">●</b> 我城　' +
          '<span class="mini-hit">⊙ 点图上任意一处 → 主地图直达</span></div>' +
      '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      'max');
    var big = $('#mini-big');
    var side = ui.fitMini();
    /* v89.132：波纹层与底图同尺寸（内联宽高照抄 fitMini 写好的那份），
       启动 100ms 动画；面板一关，paintMiniPulse 取不到画布即自灭。 */
    var pulse = document.getElementById && document.getElementById('mini-pulse');
    if (pulse && big) {
      pulse.style.width = big.style.width;
      pulse.style.height = big.style.height;
      pulse.width = big.width; pulse.height = big.height;
    }
    if (ui._miniPulseTimer) { clearInterval(ui._miniPulseTimer); ui._miniPulseTimer = null; }
    ui._miniPulseTimer = setInterval(ui.paintMiniPulse, 100);
    /* v89.67（老板「名城的名称永不消失」）：缩略图的城名层**常开** ——
       这一层画的全是名城（都/州/郡）名称，正是"地图骨架"本身；
       跟着开关一起收掉，缩略图就只剩色块，等于把这层功能删了。
       （v89.61 曾让它跟随总开关，本轮按老板口径改回常开。） */
    try { ui.drawMini(big, side, { labels: true }); } catch (e) { }
    ui.bindMiniPick(big);
    /* 筛选下拉：改完即生效（与出征/自动出征面板同一套做法 —— 写状态 + 重开面板） */
    var bind = function (id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () { ui.setMiniFilter(key, el.value); });
    };
    bind('mini-level', 'level'); bind('mini-state', 'state'); bind('mini-jun', 'jun');
  };

  /* 鼠标点选的地块（v44）：存 pick() 的结果，供状态行显示 */
  ui.mapPick = null;
  ui.mapPickText = function () {
    var p = ui.mapPick;
    if (!p) return '点选 —';
    var tag = ({ player: '我城', npc: '名城', wild: '野地', fort: '据点', land: '空地' })[p.kind] || '';
    var out = '点选 ' + tag + ' (' + p.x + ',' + p.y + ')';
    /* v89.5：野地补一句江湖事 —— 有事报数（灵机者加标），无事报荒僻；
       非野地地形（平原 / 城）没有江湖活动之说，不补后缀。 */
    /* v89.45：野地江湖游历呈现层受 GAME.jianghuWildMounted 控制（false=剥离） */
    var tl = GAME.map.tile(p.x, p.y);
    if (GAME.jianghuWildMounted && tl && GAME.jianghuCands(tl.terrain).length > 0) {
      var jm = GAME.jianghuSpotInfo(p.x, p.y);
      out += jm ? (' · 江湖事 ×' + jm.n + (jm.mark ? ' · 灵机' : '')) : ' · 荒僻';
    }
    return out;
  };
  /* 刷新状态行（视野区间 + 点选坐标）—— 平移 / 跳转 / 点击后都走这里。
     注意用 `$`（= querySelector）而不是 getElementById：
     smoke 的 DOM stub 只实现了 querySelector。 */
  ui.syncMapInfo = function () {
    var a = $('#map-info'), b = $('#map-pick-info');
    if (a) a.textContent = ui.mapInfoText();
    if (b) b.textContent = ui.mapPickText();
  };

  ui.renderMapCanvas = function () {
    var canvas = $('#mapCanvas');
    if (!canvas) return;
    /* v44：点击地图 → 记下点选的地块，并把坐标刷到状态行。
       canvas 每次 setView 都会重建，所以用元素上的标记保证只绑一次。 */
    if (!canvas._pickBound) {
      canvas._pickBound = true;
      canvas.addEventListener('click', function (e) {
        var r = GAME.map.pick(canvas, e.clientX, e.clientY);
        if (!r) return;
        ui.mapPick = r;
        ui.syncMapInfo();
      });
    }
    var fr = ui.mapFrame;
    GAME.map.render(canvas, { vx: ui.mapView.x, vy: ui.mapView.y,
      spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell,
      showLabels: ui._mapShowLabels !== false });
    /* v89.89（A4）：定位标记 —— 材料产地跳转等「已定位」场景的醒目提示。
       双色圆环（金/朱红按 450ms 相位交替），主循环每秒重绘负责"闪"；6 秒自灭。 */
    var mk = ui._mapMark;
    if (mk) {
      if (mk.until > Date.now()) {
        var vw = GAME.map._view;
        var mctx = canvas.getContext && canvas.getContext('2d');
        if (vw && vw.HW && mctx && mctx.beginPath) {
          var cx = vw.ox + (mk.x - mk.y) * vw.HW;
          var cy = vw.oy + (mk.x + mk.y) * vw.HH;
          var phase = Math.floor(Date.now() / 450) % 2 === 0;
          mctx.save();
          mctx.lineWidth = 3;
          mctx.strokeStyle = phase ? 'rgba(232,206,136,.95)' : 'rgba(168,58,44,.95)';
          mctx.beginPath();
          mctx.ellipse(cx, cy, vw.HW * 0.85, vw.HH * 0.85, 0, 0, Math.PI * 2);
          mctx.stroke();
          mctx.beginPath();
          mctx.arc(cx, cy, 3, 0, Math.PI * 2);
          mctx.fillStyle = phase ? 'rgba(232,206,136,.95)' : 'rgba(168,58,44,.95)';
          mctx.fill();
          mctx.restore();
        }
      } else {
        ui._mapMark = null;        /* 过期自灭 */
      }
    }
    ui.syncMapInfo();
  };

  ui.mapInfoText = function () {
    /* v50：视野不再是矩形，"左上—右下"那对坐标已无意义，改报**中心格**。 */
    var v = ui.mapView;
    return '中心 (' + v.x + ',' + v.y + ')';
  };

  ui.mapPan = function (dx, dy) {
    /* v50：菱形下方向键必须按**屏幕方向**走 —— 把两轴位移对角合成：
         右 → i 轴 +Δ、j 轴 −Δ（屏幕水平右移）　下 → 两轴同 +Δ（屏幕垂直下移）
       这样"按右键画面就向右走"，而不是沿网格轴斜着走。 */
    var dgx = (dx || 0) + (dy || 0);
    var dgy = (dy || 0) - (dx || 0);
    ui.mapView.x = U.clamp((ui.mapView.x || 0) + dgx, 0, DATA.MAP_W - 1);
    ui.mapView.y = U.clamp((ui.mapView.y || 0) + dgy, 0, DATA.MAP_H - 1);
    ui.renderMapCanvas();      /* v44：状态行的刷新已收口到 renderMapCanvas */
  };

  ui.mapCenterOn = function (x, y) {
    /* v50：视野中心格 = (x,y)。旧签名后两个参数（spanX/spanY）已无意义 ——
       菱形视野不是矩形，不再需要"减去半屏"；保留形参只为兼容旧调用。 */
    ui.mapView.x = U.clamp(Math.round(x), 0, DATA.MAP_W - 1);
    ui.mapView.y = U.clamp(Math.round(y), 0, DATA.MAP_H - 1);
    ui.renderMapCanvas();
  };

  ui.mapCenter = function () {
    var pc = GAME.map.playerCity();
    if (!pc) return;
    ui.mapCenterOn(pc.x, pc.y);
    ui.toast('已回到主城 (' + pc.x + ',' + pc.y + ')');
  };

  ui.mapGoto = function () {
    var gx = Number(($('#map-gx') || {}).value);
    var gy = Number(($('#map-gy') || {}).value);
    if (!gx || !gy || gx < 1 || gy < 1 || gx > DATA.MAP_W || gy > DATA.MAP_H) {
      ui.toast('请输入 1~' + DATA.MAP_W + ' 之间的坐标');
      return;
    }
    ui.mapCenterOn(gx, gy);
    ui.toast('已定位至 (' + gx + ',' + gy + ')');
  };



  /* --------- 野地/出征 modal --------- */
  /* ============================================================
   * 城池面板 / 资源运输 / 将领派遣（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板原话：「将领，人口，资源等是归属于城池的数据，切换城池时，只统计、呈现
   *   当前的数据即可。城池之间，资源需要运输，将领需要派遣，为自己占据的城池
   *   提供相关功能按钮，**不要一点击地图就直接进入城池**」。
   *
   * 所以点地图上的自家城池，弹的是这扇「城池面板」：先给一张摘要
   * （档位优势 / 本城库存 / 驻军 / 守将），再给四个动作 ——
   * 进入城池 / 资源运输 / 将领派遣 / 改名。
   * "点一下地图"从此不再有副作用（原先直接 setView('city') 会连带换掉当前城）。
   * ============================================================ */
  ui.cityTierName = function (type) {
    return DATA.CITY_TIER ? (DATA.CITY_TIER[type] || '自建城') : (type || '');
  };
  /* v70（老板）：「为玩家城池提供坐标切换」—— 输入坐标迁址（唯一入口）。
     判据与执行都在 GAME.canCityMoveTo / moveCityTo（界面不自己判一遍）。 */
  ui.openCityMoveAsk = function (city) {
    var c = city || GAME.currentCity();
    if (!c) return;
    ui._cityMoveId = c.id;
    var movable = GAME.isMovableCity(c);
    ui.openModal(
      '<div class="gold-heading">📍 迁址 · ' + U.escape(c.name) + '</div>' +
      '<div class="note">迁址后：**原坐标那格归还地图**，新坐标成为你的城池。' +
        '只可迁到**平原**空地（界内 0 ~ ' + GAME.COORD_MAX + '）。名城地望固定，不可迁。</div>' +
      '<div class="attr"><span class="k">当前坐标</span><span class="v">' +
        GAME.coordText(c) + ' / 500×500</span></div>' +
      (movable
        ? '<div class="attr"><span class="k">迁往</span><span class="v">' +
            'X <input type="number" id="move-x" class="qty-input" style="width:76px;" min="0" max="' +
              GAME.COORD_MAX + '" value="' + c.x + '">　' +
            'Y <input type="number" id="move-y" class="qty-input" style="width:76px;" min="0" max="' +
              GAME.COORD_MAX + '" value="' + c.y + '"></span></div>'
        : '<div class="note">这座城是名城 —— 地望固定，不可迁址。</div>') +
      '<div class="modal-foot">' +
        (movable ? '<button class="btn gold" data-action="city-move-do">确认迁址</button>' : '') +
        '<button class="btn" data-action="close-modal">' + (movable ? '取消' : '关闭') + '</button></div>'
    );
  };

  ui.openCityPanel = function (city) {
    var s = GAME.state;
    city = city || GAME.currentCity();
    if (!s || !city) { ui.toast('城池不存在'); return; }
    var R = GAME.res(city);
    var perk = GAME.perkOf(city);
    var isOwn = (s.cities || []).some(function (c) { return c.id === city.id; });
    var guard = GAME.guardGeneralOf ? GAME.guardGeneralOf(city) : null;
    /* v89.113（老板需求 3）：城主（文治）与守将（武功）同级并列 */
    var mayor = GAME.mayorGeneralOf ? GAME.mayorGeneralOf(city) : null;
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    var rows = GAME.TRANSPORT_KEYS.map(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      return '<div class="attr"><span class="k">' + (meta ? meta.icon + ' ' + meta.name : k) + '</span>' +
        '<span class="v">' + U.numText(R[k] || 0, 0) + '</span></div>';
    }).join('');
    ui.openShell({
      /* v89.135（老板 7）：逐秒刷新（驻军/资源/人口实时；有输入焦点时自动跳过） */
      live: function () { ui.openCityPanel(city); },
      title: (isOwn ? '🏯 ' : '🏙 ') + U.escape(city.name),
      sub: ui.cityTierName(city.type) + '　官府 Lv' + lv + '　(' + city.x + ',' + city.y + ')' +
        (GAME.isFamousCity(city) ? '　·　名城' : ''),
      body:
        /* 档位优势（需求 5）：名城与自建城的差别写在这里 —— 玩家点开一座城
           第一眼就该知道"占了它有什么好处"。 */
        '<div class="attr"><span class="k">' + perk.name + '优势</span><span class="v">' +
          U.escape(perk.desc) + '</span></div>' +
        (isOwn ? rows +
          '<div class="attr"><span class="k">👥 人口</span><span class="v">' +
            U.numText(R.pop || 0, 0) + ' / ' + U.numText(GAME.maxPopOf(city), 0) + '</span></div>' +
          '<div class="attr"><span class="k">⚔ 驻军</span><span class="v">' +
            U.numText(GAME.armyTotal(city), 0) + '　城防 ' + GAME.cityDefense(city) + '</span></div>' +
          '<div class="attr"><span class="k">📜 城主</span><span class="v">' +
            (mayor ? (function () {
              /* v89.162（老板「列举城主的六维加成」）：悬停给出城主**全部**加成
                 （内政→产量/建造/税收 · 智谋→研究/城防），小字保持一行不撑版面。 */
              var mbC = GAME.mayorBonus(city);
              var tipC = '内政 → 产量 +' + Math.round(mbC.prod * 100) + '% · 建造 +'
                + Math.round(mbC.build * 100) + '% · 税收 +' + Math.round(mbC.tax * 100) + '%'
                + '\n智谋 → 研究 +' + Math.round(mbC.research * 100) + '% · 城防 +'
                + Math.round(mbC.def * 100) + '%';
              return U.escape(mayor.name) + ' Lv' + mayor.level
                + '　<span class="ui-sub" title="' + U.escape(tipC) + '">内政·智谋</span>';
            })() : '<span class="ui-sub">未任命（内政/智谋加成为零）</span>') + '</span></div>' +
          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? (function () {
              /* v89.115：守城全军加成就地可见（与实战同一原子 genAttrs.atkPct/defPct）——
                 守城战时**不打统率折扣**（全覆盖），界面读的就是这个数。 */
              var ga = GAME.genAttrs(guard);
              return U.escape(guard.name) + ' Lv' + guard.level +
                '　<span class="ui-sub">征兵·对阵　·　守城全军加成：攻 +' +
                Math.round((ga.atkPct || 0) * 100) + '%　防 +' + Math.round((ga.defPct || 0) * 100) +
                '%</span>';
            })() : '<span class="ui-sub">未任命</span>') + '</span></div>'
          : '<div class="q-empty">尚未据有此地。</div>') +
        /* 名城专属选项（v60 · 需求 5）：只有名城才有的额外操作。
           冷却与代价写在悬停里（弹窗正文高度是最稀缺的资源，说明文字不上正文）。 */
        (isOwn ? (function () {
          var opts = GAME.cityOptsOf(city);
          if (!opts.length) return '';
          return '<div class="ui-sub" style="margin-top:10px;">' + perk.name + '专属</div>' +
            '<div class="chips city-opts">' + opts.map(function (o) {
              var cd = GAME.cityOptCdLeft(city, o);
              var costTxt = Object.keys(o.cost || {}).map(function (kk) {
                return GAME.resName(kk) + ' ' + U.fmt(o.cost[kk]);
              }).join('　');
              return '<span class="chip' + (cd ? ' dim' : '') + '" data-action="city-opt"' +
                ' data-city="' + city.id + '" data-opt="' + o.id + '"' +
                ' title="' + U.escape(o.desc + (costTxt ? '\n代价：' + costTxt : '') +
                  (cd ? '\n冷却中：还需 ' + cd + ' 日' : '')) + '">' +
                o.icon + ' ' + o.name + (cd ? ' <i class="chip-sub">' + cd + '日</i>' : '') + '</span>';
            }).join('') + '</div>';
        })() : ''),
      /* ============================================================
       * v89.138（老板 2）：「调兵·运输，将领派遣**合并成"派遣"和"运输"**，均进入出征界面
       *   设定将领和兵种以及携带的资源。**去掉度支归集**。…**去掉改名**菜单。
       *   放弃城池菜单**增加二次确认**。」
       * ------------------------------------------------------------
       * · 派遣 / 运输 = 同一出征界面的两个入口（带各自的操作提示，见 openExpModal 的 opts.hint）——
       *   派遣 = 兵/将随军入城（可不带货）；运输 = 押运资源（先选兵，再填辎重）；
       * · 「将领派遣」独立面板（openDispatch）与「度支归集」「改名」整条退役 ——
       *   改名在**官府面板**（open-rename-city）仍有入口，功能不丢；
       * · 节钺扩编：悬停**第一行先讲"这是干什么用的"**（老板问过一次，说明原文案没讲透）。
       * ============================================================ */
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +
            '<button class="btn" data-action="city-dispatch-exp" data-city="' + city.id + '"' +
              ' title="' + U.escape('派遣：把兵力 / 将领调往本城 —— 在出征界面选主将 + 兵种，抵达即入城（不带货也可发）')
              + '">🛡️ 派遣</button>' +
            '<button class="btn" data-action="city-transport" data-city="' + city.id + '"' +
              ' title="' + U.escape('运输：把资源运往本城 —— 在出征界面先选押运兵力（运力随兵力涨），再到辎重区填资源')
              + '">🚚 运输</button>' +
            /* v89.95（A1）· v89.138：节钺扩编 —— 悬停第一行先答"干什么用的" */
            '<button class="btn" data-action="jieyue-expand" data-city="' + city.id +
              '" title="' + U.escape('【扩编】给本城 +1 个建造位（同时可建工程数 +1，每城至多 '
                + ((DATA.JIEYUE || {}).citySlotMax || 2) + ' 次）—— 消耗 1 枚「节钺」。\n'
                + '节钺是君主符节（' + (GAME.jieyueTextOf ? GAME.jieyueTextOf() : '') + '）：黄金买不到，'
                + '首占名城 / 完成特定功业才得；共 4 种用法 —— 名世→天授、城建扩编（本按钮）、'
                + '校场扩编（出征容量 +1 万人马）、招贤纳士（将领席位 +1）。')
                + '">🪓 节钺扩编 · 建造位 +1（' +
              ((city.jieyueSlots || 0) >= ((DATA.JIEYUE || {}).citySlotMax || 2)
                ? '本城已满 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                : '本城 ' + (city.jieyueSlots || 0) + '/' + ((DATA.JIEYUE || {}).citySlotMax || 2)
                  + '　持符 ' + GAME.jieyueOf()) + '</button>'
          : '') +
        /* v67（老板）：放弃城池 —— 只在还有别的城可去时才出现（否则点了必被拒） */
        (isOwn && (s.cities || []).length > 1
          ? '<button class="btn red" data-action="city-abandon-ask" data-city="' + city.id +
            '">🗑️ 放弃城池</button>'
          : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ⛔ v89.103 退役：**旧的「资源运输」面板**（openTransport / transportEstHTML /
     syncTransportEst / setTrTo / setTrKey / setTrPct / doTransport / TR_PCTS）——
     老板「任意自身城池向其他城池进行资源运输，应当采用出征界面，完成将领，兵种，
     资源数量等确认」。现在：出征界面选己方城池 → 辎重区填资源数量 → 兵力押运、
     走行军通道抵达入城（见 ui.expCargoHTML / GAME.doTransferCargo）。
     ⚠️ 顺带消灭的老 bug：旧面板打开时 `ui._trTo[from.id]` **没有落默认值**，
     而 `doTransport` 又只读它 —— 于是"主城 → 分城点运输"必然报「城池不存在」
     （对象是空 id）。整条路退场后，这类"面板显示 A、提交按 B"的错位不再有落脚点。 */


  /* ============================================================
   * ⛔ v89.138（老板 2）：**「将领派遣」独立面板整条退役** ——
   * 老板：「调兵·运输，将领派遣合并成"派遣"和"运输"，均进入出征界面设定将领和兵种
   *   以及携带的资源」。
   * 本面板（openDispatch）与其助手 setDpGen / setDpTo / doDispatch 一并删除；
   * 「派遣」= 出征界面（本境调运 · 允许 0 兵只派将）——主将下拉即"派谁"、
   * 兵种表即"带多少"，抵达入城（`gen.cityId = 目标城`，见 expedition 的 owncity 分支）。
   * 域侧 `GAME.dispatchableGensOf` / `GAME.doDispatch` 随之退役（见 domain.js 同款墓碑）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`（判据：`ui.openDispatch = function`）。
   * ============================================================ */

  /* ---------- 军队派驻（v89.59 · 老板需求 3）----------
     第三条城池间操作：转移**军队**（资源走运输、将领走派遣）。即时到达、兵士不损耗。 */
  ui._tmTo = ui._tmTo || {};
  ui.openTroopMove = function (fromId) {
    var s = GAME.state;
    var from = GAME.cityById(fromId) || GAME.currentCity();
    if (!s || !from) { ui.toast('城池不存在'); return; }
    var others = (s.cities || []).filter(function (c) { return c.id !== from.id; });
    ui._tmFrom = from.id;
    if (!others.length) {
      ui.openShell({
        title: '⚔ 军队派驻', sub: '自' + from.name + '调出', size: 'sm',
        body: '<div class="q-empty">你只有这一座城 —— 无处可派。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var to = null;
    others.forEach(function (c) { if (c.id === ui._tmTo[from.id]) to = c; });
    if (!to) to = others[0];
    var ids = Object.keys(from.army || {}).filter(function (k) { return (from.army[k] || 0) > 0; });
    var rows = ids.map(function (id) {
      var tr = DATA.TROOPS[id], own = from.army[id];
      return '<div class="res-line" style="align-items:center;"><span class="lbl">' + (tr ? tr.icon + ' ' + tr.name : id) + '</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">拥有 ' + U.fmt(own) + '</span>' +
        '<input type="number" id="tm-' + id + '" min="0" max="' + own + '" value="0" style="width:80px;padding:4px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm" data-action="tm-max" data-troop="' + id + '">全</button></div>';
    }).join('') || '<div class="q-empty">本城无驻军。</div>';
    /* v89.87（需求 2）：调兵改走**行军通道** —— 须选带队将领 */
    var _gens = (s.generals || []).filter(function (g) {
      var gc = GAME.genCityOf ? GAME.genCityOf(g) : null;   /* 返回城对象 */
      return gc && gc.id === from.id && (!g.status || g.status === 'idle') &&
        !(GAME.gatherByGen && GAME.gatherByGen(g.id));
    });
    var genSel = '<select id="tm-gen" style="width:100%;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
      _gens.map(function (g) {
        return '<option value="' + g.id + '">' + U.escape(g.name) + '（Lv' + (g.level || 1) + '）</option>';
      }).join('') + '</select>';
    ui.openShell({
      title: '⚔ 军队派驻',
      sub: '自' + U.escape(from.name) + '调出',
      /* v89.141（复核修复）：`sm`(433×414) 在"5 兵种"真实载荷下纵向溢出 82px
         （modals 审计在第二城可见后当场抓到）→ 升 `md`(660×620)：
         兵力行更舒展、多兵种不再滚动（"弹窗内不许滚动条"）。 */
      size: 'md',
      body:
        '<div class="ui-sub">调往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          return '<span class="chip' + (c.id === to.id ? ' on' : '') + '" data-action="tm-to" data-i="' + from.id +
            '" data-v="' + c.id + '">' + U.escape(c.name) + ' <i class="gd-sub">' + GAME.cityDist(from, c) + ' 格</i></span>';
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">带队将领</div>' +
        (_gens.length ? genSel : '<div class="q-empty">本城无空闲将领 —— 派兵须有将领带队（出征/城主/守将/采集中的不能派）。</div>') +
        '<div class="ui-sub" style="margin-top:8px;">兵力</div>' + rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-hint">兵力按<b>行军通道</b>开拨：有行军时间（军务总览可查看/召回），抵达后入编目标城；校场容量不足会被拒。</div></div>',
      foot: '<div class="m-foot"><button class="btn gold" data-action="tm-do">派兵</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setTmTo = function (i, v) { ui._tmTo = ui._tmTo || {}; ui._tmTo[i] = v; ui.openTroopMove(i); };
  ui.doTroopMove = function () {
    var from = GAME.cityById(ui._tmFrom) || GAME.currentCity();
    if (!from) return;
    var tid = ui._tmTo[from.id], army = {};
    Object.keys(from.army || {}).forEach(function (id) {
      var inp = document.getElementById('tm-' + id);
      var v = inp ? Number(inp.value) : 0;
      if (v > 0) army[id] = Math.floor(v);
    });
    /* v89.87（需求 2）：调兵走行军通道，须带带队将领（老板拍板"一律要选将"） */
    var genEl = document.getElementById('tm-gen');
    var genId = genEl ? genEl.value : null;
    var r = GAME.doTransferTroops(from.id, tid, army, genId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openTroopMove(from.id); }
  };

  /* ⛔ v89.103 退役：**「城池间操作」小面板**（ui.openInterCity + ic-troop / ic-gen / ic-res）——
     它的三件事现在各有更正的入口，留着只会多一条"目标选己方城池 → 跳小面板"的岔路：
       · 派驻军队 / 辎重 / 资源 → **出征界面选己方城池**（本境调运，见 ui._expOwn）
       · 派驻将领 → 城池面板「将领派遣」（ui.openDispatch）
       · 跨城调兵 → 新城落成提示里的一键补防（ui.openTroopMove，v89.86 起）
     老板原话：「任意自身城池向其他城池进行资源运输，应当采用出征界面」。 */


  /* ============================================================
   * v89.86（整改 P-26）：新城落成的守备风险提示 ——
   * 新城初始守备力 0（无驻军、无城墙），实测首波入侵即被攻破
   * （小损 + 声望 −5，城不丢）。此前建成后没有任何提示，玩家第一次
   * 意识到风险往往是在战报里。这里把"当前事实 + 下一步"一次给全，
   * 并**复用跨城调兵出口**（ui._tmTo + openTroopMove）做一键补防。
   * ============================================================ */
  ui.openNewCityNotice = function (city) {
    if (!city) return;
    var from = GAME.mainCityOf() || GAME.currentCity();
    if (from && from.id === city.id) from = null;
    var def = GAME.defensePowerOf ? (GAME.defensePowerOf(city) || 0) : 0;
    ui.openShell({
      title: '🏯 新城落成 · ' + U.escape(city.name),
      sub: '(' + city.x + ',' + city.y + ')　守备力 ' + U.fmt(def),
      size: 'sm',
      body:
        '<div class="note-warn">⚠️ 新城当前守备力 <b>' + U.fmt(def) +
          '</b>（无驻军、无城墙）——若有兵马犯境会被攻破：损失资源与声望，<b>城池不会丢</b>。</div>' +
        '<div class="res-line"><span class="lbl">建议</span><span class="val">尽快派驻军队 / 修建城墙；有条件先建烽火台延长预警</span></div>' +
        (from ? '<div class="res-line" style="border-bottom:0;"><span class="lbl">可调兵来源</span><span class="val">' +
          U.escape(from.name) + '　在城兵力 ' + U.numText(GAME.armyTotal(from), 0) + '</span></div>' : ''),
      foot: '<div class="m-foot">' +
        (from ? '<button class="btn gold" data-action="newcity-send-troop" data-from="' + from.id + '" data-to="' + city.id + '">⚔ 从' + U.escape(from.name) + '调兵</button>' : '') +
        '<button class="btn" data-action="close-modal">稍后再说</button></div>'
    });
  };

  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;
    var tile = GAME.map.tile(x, y);
    /* v89.6：就近探察 —— 开格即见方圆二格内的未现形奇遇点位（探索层的"环顾四周"） */
    var wsurv6 = GAME.wonderSurvey ? GAME.wonderSurvey(x, y) : 0;
    var wsurvLine = wsurv6 > 0
      ? '<div class="wnr-line wnr-new">📜 环顾四周，探得异迹 ' + wsurv6 + ' 处 —— 已记于见闻（图中寻「✦」往探）</div>'
      : '';
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
    /* v89.139 加固（唯一出口）：**已占野地的地形以野地记录为准** ——
       采集记录（startGather 的 `type: w.type`）、产量加成（wildAddOf 传 w.type）、
       珠宝表都读野地记录；面板若读 tile.terrain，一旦两者不一致
       （老档 / 外部写入 / 造局），面板会显示"平原"而没有采集区 —— 实测踩到过。
       未占野地（无记录）仍读地图格地形（它才是"这里是什么地形"的权威）。 */
    var _wRec139 = GAME.map.wildAt(x, y);
    var _terKey139 = (_wRec139 && _wRec139.type) ? _wRec139.type : tile.terrain;
    var ter = DATA.TERRAIN[_terKey139];
    /* v15：加成按「每级 × 等级」线性计算 */
    /* v89.152：加成数据源统一为 _terKey139（野地记录优先）—— 与结算侧（state.js 读 w.type）同源 */
    var add = GAME.wildAddOf(_terKey139, lv) || {};
    var addStr = '';
    /* v89.152：产出行拆行后不再需要括号包裹，多资源用全角空格分隔 */
    for (var r in add) addStr += (addStr ? '　' : '') + (RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%';
    /* v55：守军总数**必须与出征时遇到的同一个来源**。
       改前这里读 `GAME.battle.wildGarrison(lv)` —— 那是另一个公式，
       10 级算出来 6.9 万，而 `wildDefenseAt` 的真实守军只有 4560，**差 15 倍**：
       面板一直在骗人，而且"两个出口"正是本项目最经典的失效模式（已删掉那个公式）。
       现在直接读该地块**当天**的守军，与战斗完全一致。 */
    var base = GAME.wildDefenseAt(x, y, lv).total;
    var owned = !!GAME.map.wildAt(x, y);
    var gatherRes = GAME.gatherResOf(_terKey139);
    var at = GAME.gatherAt(x, y);
    var tbl = DATA.WILD_MATERIAL[_terKey139] || {};
    var matNames = Object.keys(tbl).map(function (mid) {
      return DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid;
    }).join('、');
    ui._buildCityXY = { x: x, y: y };   // v16：平原筑城用
    ui._expTarget = { kind: 'wild', x: x, y: y };
    ui._expMode = 'occupy';

    /* v89.135（老板「为啥没有珠宝（比如湖泊里有珍珠等等）」）：可采清单里的**珠宝行** */
    var jewelNames135 = ((DATA.GATHER.jewelTable || {})[_terKey139] || []).map(function (jid) {
      var n2 = jid;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === jid) n2 = x.name; });
      return n2;
    });
    /* ⛔ v89.152（老板 1）：`addLine139`（产量加成并入 note 行）退役 ——
       产出行拆为独立 4 行（资源/产量加成/材料/珠宝），产量加成有自己的行。 */
    /* v89.139（老板 4）：高档珠宝有野地等级门槛（见 DATA.GATHER.jewelMinLv）——界面写明。
       门槛 = 本地形所有珠宝里**最高**的那道（"要 LvN+ 才可能出全"）。 */
    var jewelLvHint139 = '';
    if (jewelNames135.length) {
      var _minLv139 = 1;
      ((DATA.GATHER.jewelTable || {})[_terKey139] || []).forEach(function (jid) {
        var mv = ((DATA.GATHER.jewelMinLv || {})[jid]) || 1;
        if (mv > _minLv139) _minLv139 = mv;
      });
      jewelLvHint139 = _minLv139 > 1 ? ('（Lv' + _minLv139 + '+ 野地收获偶得）') : '（收获偶得）';
    }
    /* ⛔ v89.152（老板 1）：`note` 单行块退役 —— 未占面板的产出改在下方 prodBox 里**分行呈现**
       （资源 / 产量加成 / 材料 / 珠宝 四行）；已占面板不再显示产出行（老板 5）。 */

    /* ---------- 未占领：产出行（4 行）+ 出兵入口（v89.152 老板 1/3/4） ----------
       老板：「1.产出分行呈现资源，产量加成，材料，珠宝；
       3.不要显示这行备注：🚩 占领：Lv0 无驻军位（军队打完回城；升到 Lv1+ 才有驻军位）　·　🔥 掠夺：打完直接撤军；
       4.侦察，掠夺，占领（不用占领并驻守）固定放菜单底部」——
       原「此地可采…」单行 note 与"占领/掠夺"备注行整条退役；三键固定弹窗底部。 */
    if (!owned) {
      var prodBox =
        '<div class="op-zone op-zone-eq"><div class="op-zone-t">产出</div>' +
        '<div class="attr"><span class="k">资源</span><span class="v">' +
          (gatherRes
            ? '<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>（占领后可派军采集）'
            : '<span class="ui-sub">无可采之物（平原不可采集）</span>') +
        '</span></div>' +
        '<div class="attr"><span class="k">产量加成</span><span class="v">' +
          (addStr || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">材料</span><span class="v">' +
          (matNames || '<span class="ui-sub">—</span>') + '</span></div>' +
        '<div class="attr"><span class="k">珠宝</span><span class="v">' +
          (jewelNames135.length
            ? '<b style="color:var(--gold-light)">' + jewelNames135.join(' · ') + '</b>' + jewelLvHint139
            : '<span class="ui-sub">—</span>') +
        '</span></div>' +
        (tile.terrain === 'plain' ? '<div class="q-empty">💡 平原：占领后可在其上筑新城</div>' : '') +
        '</div>';
      ui.openModal(
        '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        prodBox +
        wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
        /* v89.152（老板 4）：三键固定放菜单底部；文案「占领」（不带"并驻守"） */
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="scout">🔭 侦查</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="raid">🔥 掠夺</button>' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild" data-mode="occupy">🚩 占领</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>'
      );
      return;
    }

    /* ---------- 已占领：管理面板（v23 · 需求 1） ----------
       驻军 / 撤回 / 采集 / 出兵 / 筑城 / 放弃，全部集中在一处；
       并明确指出「驻军守地不衰减」——否则玩家不知道驻军有什么用。 */
    var gar = GAME.wildGarrisonAt(x, y);
    var garN = GAME.wildGarrisonTotal(gar);

    /* v89.135（老板 3）：「在己方野地界面显示**驻军将领，兵种种类及数量**，
       这个板块与"地块操作：危险操作"并列」—— 驻军从一行摘要升格为独立板块。
       ⛔ v89.139（老板 3）：「兵力显示**总数量**即可」—— 兵种明细行整条退役，
       故 v89.135 的 `garRows135`（逐兵种 icon+名+数）一并删除（不留死变量）。 */
    var garGen135 = null;
    if (gar && gar.genId) {
      (GAME.state.generals || []).forEach(function (g) { if (g.id === gar.genId) garGen135 = g; });
    }
    /* v89.139（老板 3）：「驻军菜单下的开采行，等级衰减行，和备注行都不要；
       兵力显示总数量即可」—— 驻军板块收敛成两行：将领 + 兵力（总数）。
       （开采进度移步「采集」区显示；等级衰减与驻守规则从面板撤除，
         相应语义仍在玩法里生效，见 DATA.WILD_GARRISON / wildDecayTick。） */
    var stat = '<div class="op-zone"><div class="op-zone-t">驻军</div>' +
      (garN
        ? '<div class="attr"><span class="k">将领</span><span class="v">' +
            (garGen135
              ? (U.escape(garGen135.name) + ' Lv' + garGen135.level +
                 '　<span class="ui-sub">驻守野地</span>')
              : '<span style="color:var(--warn);">无将领 —— 只可驻留、不可开采（派驻时带将补驻）</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">兵力</span><span class="v"><b>' + U.numText(garN, 0) + '</b> 名' +
            (gar ? '　<span class="ui-sub">来自 ' + U.escape((GAME.cityById(gar.cityId) || {}).name || '本城') + '</span>' : '') +
          '</span></div>'
        : '<div class="q-empty">暂无驻军 —— 点下方「派驻」派兵并选将领入驻（守地不衰减）</div>') +
      '</div>';

    /* v89.83（老板「已占领的野地，其入口操作应只保留派驻」）—— 已占野地是「我的地盘」。
       v89.136（老板「'野地采集（0/3队）'这个弹窗界面不需要」+「地块操作界面加一个采集操作」）：
       采集从"弹窗总入口"**收敛回地块界面**（见上方 gatherBox · 独立「采集」区）——
       开始采集 / 收获 / 召回三件事都在这块地上直接完成；
       本区（地块操作）只留：派驻 / 增派驻军 / 召回驻军 / 筑城。 */
    /* v89.136（老板）：「地块操作界面加一个采集操作（提供采集，收获按钮和采集进度显示），
       与地块操作，危险操作并列」——"野地采集"弹窗退役后，采集的全部操作收敛到这块地上。 */
    /* v89.139（老板 3）：「采集菜单下设置采集和收获两个按钮，**不要召回**」——
       两个按钮**常显**（不可用时置灰 + 悬停写明原因）；
       召回退出本区（撤回驻军仍在地块操作区，语义不变）。 */
    var gatherBox = '';
    if (gatherRes) {
      gatherBox = '<div class="op-zone op-zone-eq"><div class="op-zone-t">采集</div>';
      var gy139 = at ? GAME.gatherYield(at) : null;
      if (at && gy139) {
        var gLeftH139 = Math.max(0, DATA.GATHER.minHours - gy139.hours);
        var gName139 = '（无将）';
        (GAME.state.generals || []).forEach(function (g0) { if (g0.id === at.genId) gName139 = g0.name; });
        gatherBox +=
          '<div class="attr"><span class="k">进度</span><span class="v">' +
            '<span style="display:inline-block;width:132px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + gy139.pct + '%;background:linear-gradient(180deg,var(--gold-light),var(--gold-dark));"></i></span>' +
            '已采 ' + gy139.hours.toFixed(2) + ' / ' + DATA.GATHER.maxHours + ' 游戏时　' +
            (gy139.capReached ? '<span style="color:var(--gold-light);">已封顶</span>'
              : gy139.ready ? '<span style="color:var(--green-ok);">可收获</span>'
              : '<span style="color:var(--text-dim);">还需 ' + U.dur(gLeftH139 * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>') +
          '</span></div>' +
          '<div class="attr"><span class="k">预计收成</span><span class="v">' +
            U.numText(gy139.amount, 0) + ' ' + (RES_NAME[gy139.res] || gy139.res || '') +
            '　<span class="ui-sub">带队 ' + U.escape(gName139) + ' · 负重上限 ' + U.numText(gy139.loadCap || 0, 0) + '</span>' +
          '</span></div>';
      }
      var canSet139 = !at && garN > 0 && gar && gar.genId;
      var canFin139 = !!(at && gy139 && gy139.ready);
      var setTitle139 = at ? '已在采集中'
        : (!garN ? '先派驻军（首次须带将）'
          : (!(gar && gar.genId) ? '驻军须有将领带队（「增派驻军」时选一位将领补驻）' : '由驻守将领带队 · 原地开工'));
      var finTitle139 = !at ? '尚未开始采集'
        : (canFin139 ? '' : '满 1 游戏小时方可收获');
      gatherBox += '<div class="op-row">' +
        '<button class="btn' + (canSet139 ? ' gold' : '') + '" data-action="wild-garrison-gather" data-x="' + x +
          '" data-y="' + y + '"' + (canSet139 ? '' : ' disabled') +
          (setTitle139 ? ' title="' + setTitle139 + '"' : '') + '>⛏️ 采集</button>' +
        '<button class="btn' + (canFin139 ? ' gold' : '') + '" data-action="gather-finish" data-id="' +
          (at ? at.id : '') + '"' + (canFin139 ? '' : ' disabled') +
          (finTitle139 ? ' title="' + finTitle139 + '"' : '') + '>📦 收获</button>' +
        '</div>';
      if (!at && garN > 0 && gar && !gar.genId) {
        gatherBox += '<div class="q-empty">驻军无将领 —— 补驻一位将领后即可开采（「增派驻军」时选将）</div>';
      } else if (!at && !garN) {
        gatherBox += '<div class="q-empty">暂无驻军 —— 先「派驻」（须选带队将领）</div>';
      }
      gatherBox += '</div>';
    }

    var ops = '<div class="op-zone op-zone-eq"><div class="op-zone-t">地块操作</div><div class="op-row">' +
      (garN
        ? '<button class="btn" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 增派驻军</button>' +
          /* v89.155（老板 2）：与附属野地同一条出口（第一次黄 / 第二次执行 / 2 秒回落）；不再有任何说明文字 */
          ui.wildWdBtnHTML(x, y, { hasGar: true, lblMode: 'g' })
        : '<button class="btn gold" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 派驻</button>') +
      (tile.terrain === 'plain'
        ? '<button class="btn gold" data-action="build-city">🏯 筑城（粮木石铁金 各 1 万）</button>' : '') +
      '</div></div>' +
      '<div class="op-zone danger op-zone-eq"><div class="op-zone-t">危险操作</div><div class="op-row">' +
      '<button class="btn red" data-action="wild-abandon-ask" data-x="' + x + '" data-y="' + y + '">🗑️ 放弃该野地</button>' +
      '<span class="op-hint">失去产量加成' + (gatherRes ? '与采集权' : '') + '，驻军与采集队会先撤回城内</span>' +
      '</div></div>';

    /* v89.139（老板 3）：「湖泊 Lv10（已占），不要（已占）」+「都己方了，怎么还显示守军约多少名」
       —— 已占面板不再自称"已占"（入口本来就是己方野地），也不再显示守军数
       （守军只在**未占领**时的出击面板里有意义）。
       v89.152（老板 5）：**已占野地不显示产出行**（产出是"要不要打"的决策信息，
       已在占领那一刻完成使命）—— 原 note 整行退役。 */
    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
      wsurvLine + (GAME.jianghuWildMounted ? ui.jianghuHTML(x, y) : '') +
      stat + gatherBox + ops +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.135（老板 7）：逐秒刷新 —— 采集时间/驻军/开采状态实时 */
      { live: function () { ui.openLandModal(x, y); } }
    );
  };

  /* ============================================================
   * ⛔ v89.137（老板 7）：**派驻面板整条退役** ——
   * 老板：「派驻弹出出征界面（即侦察/掠夺/占领界面）…所有军队操作均以出征界面进行，
   *   除非像采集，收获，召回这种默认全军操作」。
   * 本面板（派兵表格 + 选将 + 确定派驻）与其 9 个界面助手（wgOwn / wgRoom / wgSum /
   * wgSet / wgStep / wgMax / wgFill / wgClear / updateWgTotal）一并删除；
   * 「派驻 / 增派驻军」按钮改走 `ui.openExpModal({kind:'wild'})`（方式 = 驻守·增援），
   * 提交链路 = dispatch → prepare（上限预检 + 无将硬闸）→ 抵达 station 分支 → wildGarrisonAdd。
   * 如需恢复：本段代码见 `backup/v89137/ui.js`（判据：`ui.openWildGarrison = function`）。
   * ============================================================ */

  /* 放弃野地二次确认（v23）：不可逆操作必须说清代价 */
  ui.openAbandonWildAsk = function (x, y) {
    /* v89.156（老板 1）：上膛式（连点两次）退役 —— 老板令「弹窗出来的放弃按钮点击
       直接执行即可，本身已经是 2 次确认了」（操作列一次 + 本确认窗一次）。 */
    var w = GAME.map.wildAt(x, y);
    if (!w) { ui.toast('该野地尚未占领'); return; }
    var ter = DATA.TERRAIN[w.type];
    var gar = GAME.wildGarrisonAt(x, y);
    var garN = GAME.wildGarrisonTotal(gar);
    var at = GAME.gatherAt(x, y);
    ui.openModal(
      '<div class="gold-heading">🗑️ 放弃 ' + (ter ? ter.name : w.type) + ' Lv' + w.level + '</div>' +
      '<div class="note">放弃后该地块恢复为无主野地，<b>产量加成与采集权一并失去</b>' +
        (garN || at ? '；驻军与采集队会先撤回城内，不会损失兵力' : '') +
        '。<b>此操作不可撤销</b>。</div>' +
      '<div class="attr"><span class="k">将失去加成</span><span class="v">' + (function () {
        var add = GAME.wildAddOf(w.type, w.level) || {}, out = [];
        for (var r in add) out.push((ui.RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%');
        return out.join('　') || '—';
      })() + '</span></div>' +
      (garN ? '<div class="attr"><span class="k">撤回驻军</span><span class="v good">' + U.numText(garN, 0) + ' 名</span></div>' : '') +
      (at ? '<div class="attr"><span class="k">撤回采集队</span><span class="v good">' + U.numText(at.troops || 0, 0) + ' 名</span></div>' : '') +
      '<div class="modal-foot">' +
        '<button class="btn red" data-action="wild-abandon-do" data-x="' + x + '" data-y="' + y + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };

  /* 放弃城池二次确认（v67 · 老板）——
     不可逆操作必须说清代价：与「放弃野地」同一套写法（note + 逐项 attr + 红按钮）。
     判据与业务共用 GAME.abandonCityCheck（不能放弃时只说明原因，不给确认按钮）。 */
  ui.openAbandonCityAsk = function (cityId) {
    ui._abandonArm138 = null;   /* v89.154：打开即复位 —— 关窗再开必须重新上膛（防误触漏洞一体修） */
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) { ui.toast('城池不存在'); return; }
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) {
      ui.openShell({
        title: '🗑️ 放弃城池 · ' + U.escape(city.name),
        size: 'sm',
        body: '<div class="q-empty">' + U.escape(chk.msg) + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var R = GAME.res(city), recv = chk.receiver;
    var resTxt = GAME.TRANSPORT_KEYS.map(function (k) {
      return GAME.resName(k) + ' ' + U.amtText(R[k] || 0);
    }).join('　');
    var gens = (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length;
    var nb = (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length;
    var nt = (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length;
    var garN = 0;
    (s.wilds || []).forEach(function (w) {
      if (w.garrison && w.garrison.cityId === city.id) garN += GAME.wildGarrisonTotal(w.garrison);
    });
    ui.openShell({
      title: '🗑️ 放弃 ' + U.escape(city.name),
      sub: ui.cityTierName(city.type) + '　官府 Lv' + (GAME.buildingLevel(city, 'guanfu') || 1) +
        '　(' + city.x + ',' + city.y + ')',
      size: 'sm',
      body:
        '<div class="note">放弃后这座城与它之上的一切<b>永久失去</b>：建筑、城墙、外城地块、' +
          '库存与驻军。原地块恢复为无主之地；攻占来的城池会重新变成可被攻打的系统城。</div>' +
        '<div class="attr"><span class="k">失去库存</span><span class="v">' + resTxt + '</span></div>' +
        '<div class="attr"><span class="k">失去驻军</span><span class="v">' +
          U.numText(GAME.armyTotal(city), 0) + ' 名</span></div>' +
        '<div class="attr"><span class="k">将领随迁</span><span class="v good">' +
          gens + ' 名 → ' + U.escape(recv.name) + '</span></div>' +
        (garN ? '<div class="attr"><span class="k">野地驻军归城</span><span class="v good">' +
          U.numText(garN, 0) + ' 名 → ' + U.escape(recv.name) + '</span></div>' : '') +
        ((nb || nt) ? '<div class="attr"><span class="k">在建 / 在募</span><span class="v">' +
          (nb ? nb + ' 项建造' : '') + (nb && nt ? '、' : '') + (nt ? nt + ' 项募兵' : '') +
          '　一并取消（材料不退）</span></div>' : ''),
      /* v89.138（老板 2）：「放弃城池菜单**增加二次确认**」——
         按钮改上膛式：点第一次只"上膛"（变文案、变红、toast 警告），**再点一次**才执行；
         执行仍走原出口 `GAME.abandonCity`（业务侧照 CITY_SCOPED 表批量清理）。 */
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-arm" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* ⛔ v89.136 移除：`ui.openGatherModal`（派军采集）与 `ui.openGathers`（"野地采集（N/3队）"弹窗）。
     老板令：「'野地采集（0/3队）'这个弹窗界面不需要」「地块操作界面加一个采集操作
     （提供采集，收获按钮和采集进度显示），与地块操作，危险操作并列」——
     · 采集的**全部操作**收敛到地块界面（openLandModal 的「采集」区：开始采集 / 收获 / 召回 / 进度）；
     · 采集队上限的可见性：军务总览 ③ 采集队表头（N / maxActive 队）；
     · 派军采集（将领带队）并入「带将驻军原地开工」（GAME.startGather 唯一形态）；
     · 采集队总览的"定位"能力：地块界面即野地本体（无需定位跳转）。 */
  /* 野外城池弹窗 */
  /* ============================================================
   * 满配城的城内布局（v61 · 老板）
   * ------------------------------------------------------------
   * 老板：「野地里的城池，应默认其建筑全都建满了，城内所有建筑各1个，
   *   兵营2个，其他建民房，位置也相对固定一下」。
   * 规则本身在 `DATA.CITY_PLAN` / `GAME.cityPlanOf`（唯一出口），这里只管呈现 ——
   * **野外城池与未占据名城共用这一份**，免得两处各写一遍数字对不上。
   * ⚠️ 这是"当前事实"（这城里有什么），不是"怎么运作"，所以留在正文而不进 ui.help。
   * ============================================================ */
  ui.planHTML = function (p) {
    if (!p) return '';
    var names = p.items.map(function (it) {
      return it.name + (it.n > 1 ? ' ×' + it.n : '');
    }).join(' · ');
    return '<div class="plan-box">' +
      '<div class="attr"><span class="k">城内建筑</span><span class="v plan-v">' + names +
        '　<span class="plan-dim">（皆 Lv' + p.level + '）</span></span></div>' +
      '<div class="attr"><span class="k">民房 / 城墙</span><span class="v plan-v">民房 ×' + p.minfang +
        ' Lv' + p.level + '　城墙 Lv' + p.wallLv + '<span class="plan-dim">（占城内 1 格）</span></span></div>' +
      '<div class="attr"><span class="k">地块 / 人口</span><span class="v plan-v">' +
        p.col + ' × ' + p.row + ' = ' + p.total + ' 格　人口上限 ' + U.numText(p.popCap, 0) +
        '　城防 ' + p.def + '</span></div>' +
      '</div>';
  };

  ui.openFortModal = function (f) {
    ui._fortTarget = f;
    ui._expMode = 'occupy';      /* v89.58：打开目标弹窗时方式复位（与 openLandModal 一致） */
    var s = GAME.state;
    var g = GAME.map.fortGarrison(f.level), gNum = 0, parts = [];
    for (var k in g) { gNum += g[k]; if (g[k] > 0) parts.push((DATA.TROOPS[k] ? DATA.TROOPS[k].name : k) + ' ' + U.fmt(g[k])); }
    var c = GAME.currentCity();
    var dist = Math.abs(c.x - f.x) + Math.abs(c.y - f.y);
    /* v61：城内布局（老板要求"默认建筑全满"）—— 打完能拿到什么，先摆出来 */
    var plan = GAME.fortPlanOf(f);
    /* v63（老板）：「野外城每天只能被掠夺一次」——先在这里说清楚，
       否则玩家点掠夺被拦下来会以为功能坏了（真正的拦截在 battle.prepare）。 */
    var raided = GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(f.x, f.y);
    /* v89.108（老板）：领地上限判据（据守 = 一座新城）—— 下面按钮与提示共读一次 */
    var cc108f = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    ui.openModal(
      '<div class="gold-heading">🏕️ 野外城池 · ' + U.escape(GAME.fortLabelOf(f)) + ' Lv' + f.level + '</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' + gNum.toLocaleString() + ' 名 · 距主城 ' + dist + ' 格</div>' +
      ui.planHTML(plan) +
      '<div class="note">守军：' + parts.join('　') + '<br>' +
        '据点等级<b style="color:var(--gold-light)">每日变化</b>，位置固定；城内建筑按等级<b>建满</b>（军营两座，其余为民房）。掠夺可获厚利（材料、资源、珠宝），据点次日重置。<br>' +
        (raided
          ? '<b style="color:var(--red-light);">今日已掠夺此据点 —— 每处每日限一次，明日可再来。</b><br>'
          : '掠夺<b>每日每处限一次</b>（得手才计数）。<br>') +
        '可采材料（一阶）：凡铁 · 松木 · 粗革 · 兽筋 · 河石 · 麻布</div>' +
      /* v89.108（老板）：领地上限 —— 到顶时「拔除并占据」当场置灰 + 写明原因
         （据点转正 = 一座新城；与 battle.prepare 的硬闸同一判据）。 */
      (cc108f.ok ? '' : '<div class="note-warn" style="margin-top:6px;">' + U.escape(cc108f.msg) + '</div>') +
      '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn gold" data-action="fort-exp" data-mode="scout">🔭 侦查</button>' +
        '<button class="btn gold" data-action="fort-exp" data-mode="raid">🔥 掠夺</button>' +
        /* v89.103（老板「拔除据点可以占据该据点（成为自己的城池）」）：
           占领 = 拔除并**据为己有**（多波次磨守备值 → 城垣破 → 就地转成我方一座城）。 */
        '<button class="btn gold" data-action="fort-exp" data-mode="occupy"' +
          (cc108f.ok ? '' : ' disabled title="' + U.escape(cc108f.msg) + '"') +
          '>🚩 拔除并占据</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>' +
      '<div class="op-hint" style="text-align:center;margin-top:6px;">🚩 <b>拔除并占据</b>：围攻磨掉守备值 → 城垣一破，全城建筑转正、人口归附，<b>从此是我的一座城</b>（该地不再生成据点）；野地占领才会就地驻军</div>'
    );
  };

  /* 已探明的野外城池一览（视口范围） */
  ui.openForts = function () {
    var v = GAME.map._view || { vx: 0, vy: 0, span: 12 };
    var list = GAME.map.fortsInView(v.vx, v.vy, v.span);
    var s = GAME.state;
    var day = GAME.questDayIndex ? GAME.questDayIndex() : 0;
    var razed = Object.keys(s.fortsRazed || {}).filter(function (k) { return s.fortsRazed[k] === day; });
    var raided = Object.keys(s.fortRaids || {}).filter(function (k) { return s.fortRaids[k] === day; });
    var html = '<div class="gold-heading">🏕️ 周边野外城池（' + list.length + ' 座）</div>';
    html += '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">' +
      '范围 (' + v.vx + ',' + v.vy + ') — (' + (v.vx + v.span - 1) + ',' + (v.vy + v.span - 1) + ')　' +
      '全图密度约 1/12（每 12×12 约 12 座）　今日已攻取 ' + razed.length + ' 处 · 今日已掠夺 ' + raided.length + ' 处</div>';
    if (!list.length) {
      html += '<div class="q-empty">本视野内暂无野外城池，可用坐标框移动观察框后再看。</div>';
    } else {
      /* v63：加「地块」列 —— 老板问「现在都是32格的吧，没看懂」，
         格数档位是这轮刚统一的规则，那就该在列表里直接看得见（每两级一档）。
         ⚠️ 同时改成**分页**：列一多、行一多，整块面板就会超出弹窗高度 →
         弹窗内冒出滚动条（老板明令禁止：「弹窗内禁止下拉条，一律分页」）。
         几何探针实测：不分页在 1600×950 超 108px、720p 超 256px；
         8 行/页在 720p 仍超 44px（矮屏弹窗本身就矮）→ 定 6 行/页，三种分辨率全部不超。 */
      var rowList = list.sort(function (a, b) { return a.level - b.level; }).map(function (f) {
        var gg = GAME.map.fortGarrison(f.level), num = 0;
        for (var k in gg) num += gg[k];
        var fp = GAME.fortPlanOf(f);
        var st = GAME.map.fortRaidedToday(f.x, f.y)
          ? '<span style="color:var(--red-light);">今日已掠夺</span>' : '<span style="color:var(--green-ok);">可掠夺</span>';
        return '<tr><td>' + U.escape(f.name) + '</td><td class="ctr">' + f.x + ',' + f.y + '</td>' +
          '<td class="ctr">Lv' + f.level + '</td>' +
          '<td class="ctr">' + fp.col + '×' + fp.row + '（' + fp.total + ' 格）</td>' +
          '<td class="ctr">' + U.fmt(num) + '</td>' +
          '<td class="ctr">' + st + '</td>' +
          '<td class="ctr"><button class="btn sm" data-action="fort-goto" data-x="' + f.x + '" data-y="' + f.y + '">定位</button> ' +
          '<button class="btn sm gold" data-action="fort-pick" data-x="' + f.x + '" data-y="' + f.y + '">出兵</button></td></tr>';
      });
      var pgF = ui.modalPage('forts', rowList, 6, function () { ui.openForts(); });
      html += '<table class="tbl"><thead><tr><th>名称</th><th>坐标</th><th>等级</th><th>地块</th><th>守军</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
        pgF.slice.join('') + '</tbody></table>' + pgF.pager;
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };

  /* ============================================================
   * 统一出征面板（侦查 / 掠夺 / 占领）
   * ============================================================ */
  /* v63（老板：「野外城每天只能被掠夺一次」）：出征方式的**可选项锁定**判据。
     唯一出口 —— 界面提示与真正的拦截（`GAME.battle.prepare`）说明同一件事，
     免得"按钮能点但打了被拒"或"按钮灰了却不知道为什么"。
     返回 '' 表示可用，否则返回原因。 */
  ui.expModeLockOf = function (modeId) {
    var tg = ui._expTarget;
    /* v89.108（老板）：领地上限 —— 占城 / 拔除据点都会产出一座新城，
       到顶时在**方式下拉框**里直接置灰 + 写明原因（与 battle.prepare 的硬闸同一判据）。 */
    if (modeId === 'occupy' && tg && (tg.kind === 'city' || tg.kind === 'fort')) {
      var cc108 = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!cc108.ok) return cc108.msg;
    }
    if (!tg || modeId !== 'raid' || tg.kind !== 'fort') return '';
    if (!(GAME.map && GAME.map.fortRaidedToday)) return '';
    return GAME.map.fortRaidedToday(tg.x, tg.y) ? '此据点今日已掠夺（每日限一次）' : '';
  };

  /* ============================================================
   * v86（老板「按计划进行」· G1）：计略选择（出征面板）
   * ------------------------------------------------------------
   * attack/march 计随出征携带（校验不通过给原因；含每日锁）；
   * defense 计在「城池面板 → 布防计略」单独布防（见 ui.openCityScheme）。
   * ============================================================ */
  ui._expScheme = null;
  ui.expSchemeLabel = function () {
    var sid = ui._expScheme;
    if (!sid) return '未用计';
    var sc = GAME.schemeOf(sid);
    return sc ? (sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）') : '未用计';
  };
  ui.setExpSchemeLabel = function () {
    var lb = $('#exp-scheme-label');
    if (lb) lb.textContent = ui.expSchemeLabel();
  };
  ui.expSchemeGenOf = function () {
    var s = GAME.state, gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === ui._expGen) gen = g; });
    return gen;
  };
  ui.expSchemePanelHTML = function () {
    var s = GAME.state;
    var t = ui._expRes;
    if (!t) return '';
    var gen = ui.expSchemeGenOf();
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; });
    return list.map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, gen);
      var on = ui._expScheme === sc.id;
      var extra = '';
      if (sc.id === 'tiaobo' && t.npc) {
        var n = GAME.schemeMarksOf(GAME.schemeKeyOf(t), 'tiaobo');
        extra = '　<b style="color:var(--gold-light);font-weight:400;">该城守将忠诚 ' + Math.max(0, 100 - 25 * n) + '</b>';
      }
      var btn = chk.ok
        ? '<button class="btn sm' + (on ? '' : ' gold') + '" data-action="exp-scheme-pick" data-v="' + sc.id + '">' + (on ? '撤下' : '选择') + '</button>'
        : '<button class="btn sm" disabled title="' + U.escape(chk.msg) + '">不可用</button>';
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span>' +
          (on ? '　<span style="color:var(--green-ok);">已选</span>' : '') + extra + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        (chk.ok ? '' : '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:2px;">' + U.escape(chk.msg) + '</div>') +
        '</div>' + btn + '</div>';
    }).join('');
  };
  /* 面板内展开/收起（不用子弹窗：弹窗是单根系统，切换会丢出征面板） */
  ui.toggleExpScheme = function () {
    var box = $('#exp-scheme-box');
    if (!box) return;
    if (box.classList.contains('hidden')) {
      box.innerHTML = ui.expSchemePanelHTML();
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  };
  /* 布防计略（城池面板）——防御计布在自己城上，持续期内自动生效 */
  ui._csGen = null;
  ui.openCityScheme = function () {
    var c = GAME.currentCity();
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var ja = (s.items && s.items.jinang) || 0;
    var own = (s.generals || []).filter(function (g) { return g.cityId === c.id; });
    if (!ui._csGen || !own.some(function (g) { return g.id === ui._csGen; })) {
      ui._csGen = own[0] ? own[0].id : '';
    }
    var list = (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'defense'; });
    var rows = list.map(function (sc) {
      var act = GAME.schemeDefOf(c, sc.id, now);
      var btn = act
        ? '<span style="color:var(--green-ok);white-space:nowrap;">布防中（余 ' + Math.ceil(act.left / 3600) + ' 时）</span>'
        : '<button class="btn sm gold" data-action="city-scheme-pick" data-v="' + sc.id + '">布防</button>';
      return '<div class="inn-card"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">' + sc.icon + ' ' + sc.name +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">精' + sc.energy + ' · 囊' + sc.jinang + '</span></div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(sc.tip) + '</div>' +
        '</div>' + btn + '</div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🎴 布防计略 · ' + U.escape(c.name) + '</div>' +
      '<div class="note">防御计布防于本城，持续期内自动生效。锦囊现有 <b>' + ja + '</b> 个。' +
        '<button class="btn xs" data-action="qb-item" data-item="jinang" data-need="1" style="margin-left:6px;">🛒 购锦囊</button></div>' +
      '<div class="mk-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;">' +
        '<label style="color:var(--text-dim);">施计将领</label>' +
        '<input type="hidden" id="cs-gen" value="' + ui._csGen + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'cs-gen', value: ui._csGen, list: own,
          sub: function (g) { return '精' + Math.round(g.energy || 0); } }) +
      '</div>' +
      rows +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };
  ui.doExpSchemePick = function (sid) {
    ui._expScheme = (ui._expScheme === sid) ? null : sid;   /* 再点一次 = 撤下 */
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box');
    if (box) box.innerHTML = ui.expSchemePanelHTML();       /* 原地刷新（面板不丢） */
    var sel = document.getElementById('exp-scheme-sel');    /* v89.57：同步下拉框 */
    if (sel) sel.value = ui._expScheme || '';
  };
  ui.doCitySchemePick = function (sid) {
    var c = GAME.currentCity();
    var sc = GAME.schemeOf(sid);
    var s = GAME.state;
    var gsel = document.getElementById('cs-gen');
    var gid = gsel ? gsel.value : ui._csGen;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    if (!sc) return;
    if (!gen) { ui.toast('请选择施计将领'); return; }
    if ((gen.energy || 0) < sc.energy) { ui.toast(gen.name + ' 精力不足（' + Math.round(gen.energy || 0) + '/' + sc.energy + '），可服清心丸'); return; }
    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('锦囊不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可点「🛒 购锦囊」就地购买'); return; }
    GAME.schemeDefSet(c, sc.id, gen);
    ui._csGen = gen.id;
    ui.closeModal();
    ui.toast('已布防「' + sc.name + '」');
    GAME.refreshAll();
  };

  /* v89.52：出征面板的「可用道具」实时条 —— 锦囊存量 + 主将精力/体力 + 背包里的体力丹一键服用。
     只读展示资源；体力丹提供「用」按钮，直接作用于所选主将，且不关闭出征面板。 */
  ui.refreshExpItems = function () {
    /* v89.156（老板 2）：「可用道具」由右列顶部挪入左列，且**收成下拉框**（不再全列 chips）——
       · select：列出可对主将使用的道具（体力丹类）×数量；数量为 0 的不出现；
       · 信息行：锦囊 / 精力 / 体力（出征决策的关键读数，保留）。 */
    var box = document.getElementById('exp-items');
    var sel = document.getElementById('exp-item-sel');
    if (!box && !sel) return;
    var s = GAME.state;
    var genEl = document.getElementById('exp-gen');
    var gid = (genEl && genEl.value) || ui._expGen || '';
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === gid) gen = g; });
    var jinang = (s.items && s.items.jinang) || 0;
    var parts = ['<b>锦囊</b> ×' + jinang];
    if (gen) {
      parts.push('<b>精力</b> ' + Math.round(gen.energy || 0));
      parts.push('<b>体力</b> ' + Math.round(GAME.staNow(gen)) + '/' + Math.round(GAME.staMax(gen)));
    }
    if (box) box.innerHTML = parts.join('　·　');
    if (sel) {
      var pills = (DATA.ITEMS || []).filter(function (it) {
        return it.type === 'stamina' && (s.items && s.items[it.id] > 0);
      });
      var keep = sel.value;
      sel.innerHTML = '<option value="">' + (pills.length ? '（选择道具）' : '（无可用道具）') + '</option>' +
        pills.map(function (it) {
          return '<option value="' + it.id + '">' + U.escape(it.name) + ' ×' + s.items[it.id] + '</option>';
        }).join('');
      /* 保持已选项（数量变了仍在）；被用光的项自然消失 → 回落空 */
      if (keep && pills.some(function (it) { return it.id === keep; })) sel.value = keep;
    }
  };

  /* ============================================================
   * v89.57（老板「出征界面多选项尽量用下拉框」）—— 真实出征决策的接线口
   * ------------------------------------------------------------
   * 全部复用既有机制，不新建规则（本项目铁律：写进界面而无消费 = 死数据）：
   *   · 目标候选   → GAME.battle.resolveTarget（城 / 据点 / 野地同一出口）
   *   · 全体站位   → DATA.STANCES + GAME.setTactic / clearTactics（前进 / 防御 / 后退）
   *   · 计略       → DATA.SCHEMES + GAME.schemePrepare（沿用 #exp-scheme-label 与详情面板）
   * ============================================================ */
  ui._expTargets = [];
  /* v89.59（老板需求 1/3）：目标候选三类 ——
     · 当前目标（置顶）
     · **自身城池**（城池间操作：派驻 / 运输）
     · **同一县下的普通城池**（县城 / 郡城；不含名城 州·都）+ 附近野外据点
     普通城池按老板要求**在标签上显示等级**。 */
  ui.expTargetCandidates = function (city, cur) {
    var s = GAME.state, list = [], seen = {};
    function push(tg, d) {
      var key = tg.kind + ':' + (tg.id != null ? tg.id : (tg.x + ',' + tg.y));
      if (seen[key]) return; seen[key] = 1;
      list.push({ tg: tg, d: d == null ? 0 : d });
    }
    if (cur) push(cur, -1);                       /* 当前目标永远置顶 */
    if (city) {
      var rg0 = GAME.regionOf ? GAME.regionOf(city.x, city.y) : null;
      var myCounty = (rg0 && rg0.countyCity) ? rg0.countyCity.id : null;
      /* ① 自身城池（城池间操作入口） */
      (s.cities || []).forEach(function (mc) {
        if (mc.id === city.id) return;
        push({ kind: 'own', id: mc.id }, Math.max(Math.abs(mc.x - city.x), Math.abs(mc.y - city.y)));
      });
      /* ② 同一县下的普通城池（县城 / 郡城；名城州·都排除） */
      (s.map.cities || []).forEach(function (nc) {
        if (nc.type === 'zhou' || nc.type === 'capital') return;
        var rgc = GAME.regionOf ? GAME.regionOf(nc.x, nc.y) : null;
        var cid = (rgc && rgc.countyCity) ? rgc.countyCity.id : null;
        if (myCounty != null && cid != null && cid !== myCounty) return;   /* 不同县 → 不列 */
        push({ kind: 'city', id: nc.id, npc: nc }, Math.max(Math.abs(nc.x - city.x), Math.abs(nc.y - city.y)));
      });
      /* ③ 附近野外据点（原有能力保留，排在同县城池之后） */
      var R = 14;
      for (var dy = -R; dy <= R; dy++) {
        for (var dx = -R; dx <= R; dx++) {
          var x = city.x + dx, y = city.y + dy;
          if (x < 0 || y < 0 || x >= DATA.MAP_W || y >= DATA.MAP_H) continue;
          var f = GAME.map.fortAt ? GAME.map.fortAt(x, y) : null;
          if (f) push({ kind: 'fort', x: x, y: y }, Math.max(Math.abs(dx), Math.abs(dy)) + 100);
        }
      }
    }
    list.sort(function (a, b) { return a.d - b.d; });
    return list.slice(0, 40).map(function (o) { return o.tg; });
  };
  /* 目标标签（v89.59）：普通城池 / 据点 一律带等级；自身城池标注「己方 · 城池间操作」 */
  ui.expTargetLabel = function (tg) {
    if (tg.kind === 'own') {
      var mc = GAME.cityById(tg.id);
      return mc ? ('🏯 ' + mc.name + '（己方 · 城池间操作）') : '（己方城池）';
    }
    var t = GAME.battle.resolveTarget(tg);
    if (!t.ok) return '（不可达）';
    if (t.kind === 'fort' && t.fort) return '🏕 ' + GAME.fortLabelOf(t.fort) + '（Lv' + (t.fort.level || 1) + '）';
    /* v89.74：目标标签上的等级 = 该城**自己的等级**（与守军同一个数）。
       v89.70 曾改显示档位满配（县城就写 Lv14），会与"守军按 Lv9 算"当场打架 —— 已回退。 */
    if (t.npc) return '🏯 ' + GAME.cityFullName(t.npc) + '（Lv' + GAME.cityLvOf(t.npc) + '）';
    return t.name;
  };
  /* v89.59：原「全体站位」取值口（expStanceValue）已随站位行并入「出征战术」菜单而退场 */
  /* 计略下拉框选项（攻 / 行军计随出征携带；不可用项标因由并禁用） */
  ui.expSchemeOptionsHTML = function () {
    var t = ui._expRes, head = '<option value="">未用计</option>';
    if (!t) return head;
    return head + (DATA.SCHEMES || []).filter(function (sc) {
      return sc.kind === 'attack' || sc.kind === 'march';
    }).map(function (sc) {
      var chk = GAME.schemePrepare(sc.id, t, ui.expSchemeGenOf());
      return '<option value="' + sc.id + '"' + (ui._expScheme === sc.id ? ' selected' : '') + (chk.ok ? '' : ' disabled') + '>' +
        sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）' + (chk.ok ? '' : '　— ' + U.escape(chk.msg)) + '</option>';
    }).join('');
  };
  /* 将领变 → 计略可用性可能变：重建下拉框；原选中的计若失效则撤下 */
  ui.refreshExpSchemeSel = function () {
    var sel = document.getElementById('exp-scheme-sel');
    if (!sel) return;
    if (ui._expScheme) {
      var chk = GAME.schemePrepare(ui._expScheme, ui._expRes || {}, ui.expSchemeGenOf());
      if (!chk.ok) { ui._expScheme = null; ui.setExpSchemeLabel(); }
    }
    sel.innerHTML = ui.expSchemeOptionsHTML();
  };
  /* 计略 = 显式设定（与 doExpSchemePick 的「再点撤下」区分开，供下拉框用） */
  ui.setExpScheme = function (sid) {
    ui._expScheme = sid || null;
    ui.setExpSchemeLabel();
    var box = $('#exp-scheme-box'); if (box) box.innerHTML = ui.expSchemePanelHTML();
    var sel = document.getElementById('exp-scheme-sel');
    if (sel && sel.value !== (ui._expScheme || '')) sel.value = ui._expScheme || '';
    /* v89.94（E2）：计略变 → 战法解锁态跟着变（奇袭须有计略；撤了计略则奇袭置灰） */
    if (ui.setExpOps) ui.setExpOps(ui._expOps);
  };

  /* ============================================================
   * v89.59（老板需求 6）：出征「方案」与「出征战术」两套预设
   * ------------------------------------------------------------
   *   方案 plan      = { id, name, troops:{兵种:数量}, tactics:{兵种:{s,t}} }  ← 固定兵力 + 战术
   *   战术 tacticSet = { id, name, tactics:{兵种:{s,t}} }                       ← 只固定战斗指令
   * 下拉框**套用**（就地生效）；「设置」走弹窗（弹窗单根，会替换出征面板 →
   * 保存/删除后由 GAME 侧重开面板；套用则在重开后再落地）。
   * ============================================================ */
  ui.plansOf = function () { var s = GAME.state; if (s) s.plans = s.plans || []; return (s && s.plans) || []; };
  ui.tacticSetsOf = function () { var s = GAME.state; if (s) s.tacticSets = s.tacticSets || []; return (s && s.tacticSets) || []; };
  ui.expCurrentTroops = function () {
    var city = GAME.currentCity(), out = {};
    Object.keys((city && city.army) || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      if (v > 0) out[id] = Math.floor(v);
    });
    return out;
  };
  ui.expPlanOptionsHTML = function () {
    return '<option value="">（不套用）</option>' + ui.plansOf().map(function (p) {
      return '<option value="' + p.id + '">📋 ' + U.escape(p.name) + '</option>';
    }).join('');
  };
  ui.expTacticOptionsHTML = function () {
    /* v89.164（老板 3）：首项 = 「⚡ 智能战斗（通用方案）」——选中即开智能托管；
       选中任何其他项 = 关（回到手动战术）。选中态由 settings.smartBattle 决定。 */
    var smartOn = !!(GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf());
    return '<option value="smart"' + (smartOn ? ' selected' : '') + '>⚡ 智能战斗（通用方案）</option>' +
      '<option value=""' + (smartOn ? '' : ' selected') + '>默认（全体前进）</option>' +
      (DATA.STANCES || []).map(function (st) {
        return '<option value="u:' + st.id + '">' + st.icon + ' 全体' + st.name + '</option>';
      }).join('') +
      ui.tacticSetsOf().map(function (t) {
        return '<option value="s:' + t.id + '">📋 ' + U.escape(t.name) + '</option>';
      }).join('');
  };
  ui.expApplyPlan = function (id) {
    var p = null; ui.plansOf().forEach(function (x) { if (x.id === id) p = x; });
    if (!p) return;
    var city = GAME.currentCity();
    Object.keys((city && city.army) || {}).forEach(function (tid) {
      var inp = document.getElementById('exp-' + tid);
      if (!inp) return;
      inp.value = Math.min((p.troops && p.troops[tid]) || 0, city.army[tid] || 0);
    });
    if (p.tactics) GAME.state.tactics = U.deep(p.tactics);
    ui.syncExpTacticRow();
    ui.updateExpMarch();
    ui.toast('已套用方案：' + p.name);
  };
  ui.expApplyTactic = function (v) {
    /* v89.164（老板 3）：「⚡ 智能战斗」= 开智能托管（逐回合自动指挥）；
       选中任何其他项 = 关智能（回到原手动战术逻辑）。 */
    if (v === 'smart') {
      if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(true);
      ui.syncExpTacticRow();
      ui.toast('⚡ 智能战斗已开启：接敌自动转防御 · 按克制逐回合指派目标');
      return;
    }
    if (GAME.battle && GAME.battle.setSmartBattle) GAME.battle.setSmartBattle(false);
    if (!v) { GAME.clearTactics(); }
    else if (v.indexOf('u:') === 0) {
      var sid = v.slice(2), city = GAME.currentCity();
      Object.keys((city && city.army) || {}).forEach(function (id) { GAME.setTactic(id, { s: sid }); });
    } else if (v.indexOf('s:') === 0) {
      var tid = v.slice(2);
      ui.tacticSetsOf().forEach(function (x) { if (x.id === tid) GAME.state.tactics = U.deep(x.tactics || {}); });
    }
    ui.syncExpTacticRow();
  };
  /* 阵位摘要刷新（设置/套用后调用，不重绘弹窗） */
  ui.syncExpTacticRow = function () {
    var sum = document.getElementById('exp-tac-sum');
    if (!sum) return;
    /* v89.164：智能开启时摘要行直接写"智能战斗"（手动战术表另存着，随时可切回） */
    sum.textContent = (GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf())
      ? '⚡ 智能战斗（接敌转守 · 逐回合自动指挥）'
      : GAME.tacticSummary();
  };
  ui.openPlanModal = function () {
    var list = ui.plansOf();
    var rows = list.length ? list.map(function (p) {
      var n = 0; for (var k in (p.troops || {})) n += p.troops[k];
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">📋 ' + U.escape(p.name) +
          '　<span style="color:var(--text-dim);font-size:var(--fs-sub);">兵力 ' + U.fmt(n) + '</span></div></div>' +
        '<button class="btn sm gold" data-action="plan-apply" data-v="' + p.id + '">套用</button>' +
        '<button class="btn sm red" data-action="plan-del" data-v="' + p.id + '">删除</button></div>';
    }).join('') : '<div class="q-empty">暂无方案 —— 配好兵力与战术后「存为新方案」。</div>';
    ui.openShell({
      title: '📋 出征方案',
      sub: '固定「兵力 + 战术」的一套配置',
      body: rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">存为新方案</div>' +
        '<div class="mk-row"><input type="text" id="plan-name" placeholder="方案名（如：攻城主力）" style="flex:1;"></div>' +
        '<div style="text-align:center;margin-top:6px;"><button class="btn gold" data-action="plan-save">' +
          '存为新方案（取打开弹窗前配置）</button></div></div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  /* v89.86（顺手修复）：本函数原名为 `ui.openTacticModal` —— 与 v26 的「逐兵种编辑器」
     同名，后定义把前者整个盖掉，「逐兵种」入口实际打开的是本页（一直打不开编辑器）。
     更名 `ui.openTacticSets`（战术**预设**管理），与逐兵种编辑器各归各位；
     改名的三个调用点：main.js 的 open-tactic-set / expSaveTactic / expDeleteTactic。 */
  ui.openTacticSets = function () {
    var list = ui.tacticSetsOf();
    var rows = list.length ? list.map(function (t) {
      return '<div class="inn-card" style="margin-bottom:6px;"><div class="inn-info" style="flex:1;">' +
        '<div class="inn-name">📋 ' + U.escape(t.name) + '</div></div>' +
        '<button class="btn sm gold" data-action="tac-apply" data-v="' + t.id + '">套用</button>' +
        '<button class="btn sm red" data-action="tac-del" data-v="' + t.id + '">删除</button></div>';
    }).join('') : '<div class="q-empty">暂无战术 —— 用「逐兵种」调好后「存为新战术」。</div>';
    ui.openShell({
      title: '🎯 出征战术',
      sub: '固定「前进 / 防御 / 后退 + 目标」的一套指令',
      body: rows +
        '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">存为新战术</div>' +
        '<div class="mk-row"><input type="text" id="tac-name" placeholder="战术名（如：弓兵后退）" style="flex:1;"></div>' +
        '<div style="text-align:center;margin-top:6px;">' +
        '<button class="btn gold" data-action="tac-save">存为新战术（取打开弹窗前指令）</button>' +
        '<button class="btn" data-action="open-tactic">逐兵种调整</button></div></div>',
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };
  ui.expSavePlan = function () {
    var el = document.getElementById('plan-name'), nm = el ? String(el.value || '').trim() : '';
    if (!nm) { ui.toast('请填方案名'); return; }
    var s = GAME.state; s.plans = s.plans || [];
    var snap = ui._planSnap || {};
    s.plans.push({ id: 'pl' + (s.plans.length + 1) + '_' + Date.now(), name: nm,
      troops: snap.troops || {}, tactics: snap.tactics || {} });
    ui.toast('已存方案：' + nm);
    ui.openPlanModal();
  };
  ui.expSaveTactic = function () {
    var el = document.getElementById('tac-name'), nm = el ? String(el.value || '').trim() : '';
    if (!nm) { ui.toast('请填战术名'); return; }
    var s = GAME.state; s.tacticSets = s.tacticSets || [];
    s.tacticSets.push({ id: 'ts' + (s.tacticSets.length + 1) + '_' + Date.now(), name: nm,
      tactics: ui._tacSnap || {} });
    ui.toast('已存战术：' + nm);
    ui.openTacticSets();      /* v89.86：预设管理（原同名覆盖问题见 openTacticSets 注释） */
  };
  ui.expDeletePlan = function (id) {
    var s = GAME.state; s.plans = (s.plans || []).filter(function (p) { return p.id !== id; }); ui.openPlanModal();
  };
  ui.expDeleteTactic = function (id) {
    var s = GAME.state; s.tacticSets = (s.tacticSets || []).filter(function (t) { return t.id !== id; }); ui.openTacticSets();   /* v89.86：预设管理 */
  };

  /* ============================================================
   * v89.94（B2 · E2）：战法三选（强攻 / 围困 / 奇袭）—— 出兵前最后一次决断
   * ------------------------------------------------------------
   * 选中即写入随军 `opts.ops`（与计略同一通道：出发校验 → 抵达生效）。
   * 不可用项置灰、悬停写明原因（唯一判据 GAME.opsConfigIssueOf）。
   * ============================================================ */
  ui._expOps = 'assault';
  ui.expOpsLockOf = function (id) {
    return GAME.opsConfigIssueOf(id, ui._expRes, ui._expScheme || null);
  };
  ui.expOpsChipsHTML = function () {
    var cur = GAME.opsIdOf(ui._expOps);
    return (DATA.OPS || []).map(function (o) {
      var lock = ui.expOpsLockOf(o.id);
      return '<span class="ch' + (cur === o.id ? ' active' : '') + ((lock && o.id !== cur) ? ' off' : '') +
        '" data-action="exp-ops" data-v="' + o.id + '" title="' + U.escape(lock || o.desc) + '">' +
        o.icon + ' ' + o.name + '</span>';
    }).join('');
  };
  ui.expOpsNoteHTML = function () {
    var o = GAME.opsOf(GAME.opsIdOf(ui._expOps));
    var out = o.desc;
    var t = ui._expRes;
    if (t && GAME.siegeScopeOf && GAME.siegeScopeOf(t)) {
      out += '<br>🧱 ' + GAME.siegeTextOf(t) + '　占领＝围攻（每波破防、守备归零即下城）；掠夺不破防。';
    }
    return out;
  };
  ui.expOpsBlockHTML = function () {
    return '<div class="exp-ops-row"><span class="exp-ops-lab">战法</span>' +
      '<span id="exp-ops">' + ui.expOpsChipsHTML() + '</span></div>' +
      '<div class="exp-info exp-info-l" id="exp-ops-note" style="color:var(--text-dim);margin:2px 0 0;">' +
      ui.expOpsNoteHTML() + '</div>';
  };
  ui.setExpOps = function (id) {
    var lock = ui.expOpsLockOf(id);
    if (lock && GAME.opsIdOf(id) !== GAME.opsIdOf(ui._expOps)) { ui.toast('⚠️ ' + lock); return; }
    ui._expOps = GAME.opsIdOf(id);
    var box = document.getElementById('exp-ops');
    if (box) box.innerHTML = ui.expOpsChipsHTML();
    var note = document.getElementById('exp-ops-note');
    if (note) note.innerHTML = ui.expOpsNoteHTML();
    ui.updateExpMarch();          /* 围困改行军时长 → 预估行实时刷新（同一出口） */
  };

  /* ============================================================
   * v89.103：**辎重（资源调配）** —— 出征界面里的"运多少东西"三件套
   * ------------------------------------------------------------
   * · expArmyOf()    —— 从输入框收兵力（发兵与算运力**同一个来源**，不各收一份）
   * · expCargoHTML() —— 资源 + 数量框（只在"本境调运"时出现）
   * · syncCargoEst() —— 实时算运力 / 载重 / 逐项预计实收（与抵达落账同一函数）
   * ============================================================ */
  ui.expArmyOf = function () {
    var out = {};
    var city = GAME.currentCity();
    if (!city) return out;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Math.floor(Number(inp.value) || 0) : 0;
      if (v > 0) out[id] = v;
    });
    return out;
  };
  ui.expCargoHTML = function (c) {
    var R = GAME.res(c);
    var rows = GAME.TRANSPORT_KEYS.map(function (k) {
      var meta = null;
      (DATA.RESOURCES || []).forEach(function (r) { if (r.key === k) meta = r; });
      var have = Math.floor(R[k] || 0);
      return '<tr><td class="et-name">' + (meta ? (meta.icon + ' ' + meta.name) : GAME.resName(k)) + '</td>' +
        '<td class="et-own num">' + U.fmt(have) + '</td>' +
        '<td class="et-in"><input type="number" id="cg-' + k + '" min="0" max="' + have + '" value="0"' +
          (have > 0 ? '' : ' disabled') + '></td>' +
        '<td class="et-act"><button class="btn sm" data-action="cg-max" data-k="' + k + '"' +
          (have > 0 ? '' : ' disabled') + '>全</button></td>' +
        '<td class="cg-est num" id="cg-est-' + k + '">—</td></tr>';
    }).join('');
    return '<div class="exp-sec exp-a-cargo"><div class="exp-sec-t" style="display:flex;align-items:center;gap:8px;">辎重 · 资源调配' +
      '<button class="btn sm" data-action="cg-clear">清空</button>' +
      '<span class="ui-sub" id="exp-cargo-cap" style="margin-left:auto;">运力 —</span></div>' +
      '<table class="tbl exp-tbl cg-tbl"><colgroup>' +
        '<col class="cg-c-n"><col class="cg-c-own"><col class="cg-c-in"><col class="cg-c-act"><col class="cg-c-est">' +
      '</colgroup><thead><tr>' +
        '<th>物资</th><th class="num">拥有</th><th class="ctr">起运</th><th class="ctr">全</th><th class="num">实收</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  };
  /* 实时刷新（只改文字，不重建弹窗 —— 与面板"点选不重绘"的约定一致） */
  ui.syncCargoEst = function () {
    if (!ui._expOwn) return;
    var from = GAME.currentCity();
    var to = (ui._expTarget && ui._expTarget.kind === 'owncity') ? GAME.cityById(ui._expTarget.id) : null;
    if (!from || !to) return;
    var cap = GAME.cargoCapOf(ui.expArmyOf());
    var load = 0;
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      load += el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
    });
    var capEl = document.getElementById('exp-cargo-cap');
    if (capEl) {
      capEl.innerHTML = '运力 <b style="color:' + (load > cap ? 'var(--red-light)' : 'var(--gold-light)') + ';">'
        + U.fmt(load) + '</b> / ' + U.fmt(cap)
        + (load > cap ? '　⚠ 载不动' : (cap <= 0 ? '　（先选随行兵力）' : ''));
    }
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      var out = document.getElementById('cg-est-' + k);
      if (!out) return;
      var qty = el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
      if (qty <= 0) { out.innerHTML = '—'; return; }
      var pl = GAME.transportPlanOf(from, to, k, qty);
      out.innerHTML = '<b style="color:var(--green-ok);">' + U.fmt(pl.landed) + '</b>'
        + (pl.stay > 0 ? '<br><span style="color:var(--amber);">' + U.fmt(pl.stay) + ' 装不下</span>' : '')
        + (pl.lost > 0 ? '<br><span style="color:var(--text-dim);">损耗 ' + U.fmt(pl.lost) + '</span>' : '');
    });
  };
  /* 「全」= 实有量与**余下运力**的较小者（多运的部分反正载不动） */
  ui.cgFillMax = function (k) {
    var from = GAME.currentCity();
    if (!from || !k) return;
    var cap = GAME.cargoCapOf(ui.expArmyOf());
    var used = 0;
    GAME.TRANSPORT_KEYS.forEach(function (kk) {
      if (kk === k) return;
      var el = document.getElementById('cg-' + kk);
      used += el ? Math.max(0, Math.floor(Number(el.value) || 0)) : 0;
    });
    var have = Math.floor(GAME.res(from)[k] || 0);
    var el = document.getElementById('cg-' + k);
    if (el) el.value = Math.max(0, Math.min(have, cap - used));
    ui.syncCargoEst();
  };
  ui.cgClear = function () {
    GAME.TRANSPORT_KEYS.forEach(function (k) {
      var el = document.getElementById('cg-' + k);
      if (el) el.value = 0;
    });
    ui.syncCargoEst();
  };

  /* ============================================================
   * v89.142（老板 6）：「出征界面右侧派遣兵力这里，全带这列表头改成"上限"，
   *   出征地为己方野地时，按野地派驻上限自动填入数量。出征地为其他时，
   *   按校场上限（各种加成后），本城军队最大数量，或其他限制设定自动填入数量」
   * ------------------------------------------------------------
   * **总人数上限的唯一出口**（按钮、探针、断言都读它）—— 返回 null 表示"不限"：
   *   · 目标 = 我方野地（驻守 · 增援）：野地派驻上限 − 现有驻军
   *       （与 prepare 的 station 预检、wildGarrisonAdd 的抵达闸**同一把尺**）；
   *   · 目标 = 我方城池（调兵 · 辎重）：目标城出征容量 − 目标城现有兵力
   *       （与 expedition 的 owncity 抵达闸同源）；
   *   · 其余（出征类）：本城出征容量 marchCapOf（校场 ×1 万 × 专精/年号/增益 —— 唯一出口）；
   *       无校场（cap = 0）→ **不限**（与 prepare 的 `cap > 0` 判据同规：没校场不设限）。
   * 逐兵种分配：按兵种表顺序（= 右列表格的行序）依次取 min(拥有, 剩余额度)。
   * ============================================================ */
  ui.expFillCapOf = function (city, t, modeId) {
    city = city || GAME.currentCity();
    t = t || ui._expRes || null;
    if (!city || !t) return null;
    if (modeId === 'station' && t.kind === 'wild') {
      var w = GAME.map.wildAt(t.x, t.y);
      if (!w) return 0;
      return Math.max(0, GAME.wildGarrisonCap(w.level) - GAME.wildGarrisonTotal(w.garrison));
    }
    if (t.kind === 'owncity' && t.city) {
      var cap2 = GAME.battle.marchCapOf(t.city);
      if (!(cap2 > 0)) return null;
      return Math.max(0, cap2 - GAME.battle.marchMenOf(t.city.army));
    }
    var cap = GAME.battle.marchCapOf(city);
    return cap > 0 ? cap : null;
  };
  /* 按钮悬停的算法说明（把"这次的上限是怎么来的"写清楚，数字同源） */
  ui.expFillTipOf = function (city, modeId) {
    var t = ui._expRes || null;
    var cap = ui.expFillCapOf(city, t, modeId);
    if (cap == null) return '上限：不限（按各兵种拥有数填满）';
    if (modeId === 'station' && t && t.kind === 'wild') {
      var w = GAME.map.wildAt(t.x, t.y);
      return '上限 = 野地派驻上限 ' + U.numText(GAME.wildGarrisonCap(w ? w.level : 0), 0)
        + '（Lv' + (w ? w.level : 0) + '）− 现有驻军 '
        + U.numText(GAME.wildGarrisonTotal(w ? w.garrison : null), 0) + ' = ' + U.numText(cap, 0);
    }
    if (t && t.kind === 'owncity' && t.city) {
      return '上限 = ' + t.city.name + ' 出征容量 ' + U.numText(GAME.battle.marchCapOf(t.city), 0)
        + ' − 现有兵力 ' + U.numText(GAME.battle.marchMenOf(t.city.army), 0) + ' = ' + U.numText(cap, 0);
    }
    return '上限 = 本城出征容量 ' + U.numText(cap, 0) + '（校场 ×1万 × 各种加成）';
  };

  /* v89.156（老板 2）：派遣兵力标题里的**额度标签**（唯一出口）——
     「校场出征上限」= 行内「上限」按钮的总额度（expFillCapOf），随方式/目标变：
       · 出征类：校场出征上限（marchCapOf × 各种加成）；
       · 己方野地（驻守）：派驻上限余量；己方城池（调兵）：目标城余量；
       · 无校场 = 不设上限。 */
  ui.expCapLabelOf = function (city, t, modeId) {
    var cap = ui.expFillCapOf(city, t, modeId);
    if (cap == null) return '不设上限';
    var md = modeId || ui._expMode || 'occupy';
    if (md === 'station' && t && t.kind === 'wild') return '派驻上限 ' + U.numText(cap, 0);
    if (t && t.kind === 'owncity') return '目标城余量 ' + U.numText(cap, 0);
    return '校场出征上限 ' + U.numText(cap, 0);
  };
  ui.refreshExpCapLabel = function () {
    var el = document.getElementById('exp-cap-t');
    if (el) el.textContent = ui.expCapLabelOf(GAME.currentCity(), ui._expRes, ui._expMode);
  };
  /* v89.156（老板 3）：右列」预估」块（原左列整段搬来；exp-wildcap 行退役——
     它的内容并入目标区「限制性信息」）。仅战斗型任务渲染（见 openExpModal）。 */
  ui.expEstBlockHTML = function () {
    var h = '<div class="exp-sec exp-a-est"><div class="exp-sec-t">预估</div>';
    h += '<div class="exp-info exp-info-l" id="exp-march" style="margin-bottom:4px;"></div>';
    h += '<div class="exp-info exp-info-l" id="exp-power" style="margin-bottom:4px;"></div>';
    h += '<div class="exp-info exp-info-l" id="exp-haul" style="margin-bottom:0;"></div>';
    h += '</div>';
    return h;
  };
  /* ============================================================
   * v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」
   * ------------------------------------------------------------
   * **行内「上限」的唯一出口**（按钮 / 探针 / 断言都读它）：
   *   该行上限 = min(该兵种拥有, 总额度 − **其他行**已填合计)；
   *   总额度 = ui.expFillCapOf（同一把尺：野地派驻余量 / 目标城余量 / 校场容量 / 不限）；
   *   不限（null）→ 上限 = 该兵种拥有数（旧「全带」语义）。
   * 逐行点「上限」= 玩家自己决定分配顺序（点哪行算哪行）—— 不再有"全局一键分配"，
   * 因此也不存在"强兵优先 / 表序优先"之类需要额外约定的分配序（老板 2 明确不要）。
   * ============================================================ */
  ui.expTroopMaxOf = function (troopId, city, modeId) {
    var ei = document.getElementById('exp-' + troopId);
    var own = ei ? (Number(ei.max) || 0) : 0;
    var cap = ui.expFillCapOf(city || GAME.currentCity(), ui._expRes, modeId);
    if (cap == null) return own;
    var used = 0;
    Object.keys(DATA.TROOPS).forEach(function (id) {
      if (id === troopId) return;
      var o = document.getElementById('exp-' + id);
      if (o) used += Number(o.value) || 0;
    });
    return Math.max(0, Math.min(own, cap - used));
  };
  /* 行内「上限」按钮的悬停说明（数字同源：拥有 + 额度口径，含本次总额度的来源） */
  ui.expTroopTipOf = function (city, troopId, modeId) {
    var ct = city || GAME.currentCity();
    var own = (ct && ct.army && ct.army[troopId]) || 0;
    var cap = ui.expFillCapOf(ct, ui._expRes, modeId);
    if (cap == null) return '上限：该兵种全部拥有数 ' + U.numText(own, 0) + '（本次不设总上限）';
    return '上限 = min(该兵种拥有 ' + U.numText(own, 0) + '，本次总额度 ' + U.numText(cap, 0)
      + ' − 其他兵种已填)。　' + ui.expFillTipOf(ct, modeId);
  };

  ui.openExpModal = function (target, opts138) {
    /* v89.138（老板 2）：「派遣」「运输」两个入口共用本界面 ——
       opts138.hint 给一行**入口专属提示**（讲清这次要填什么），不传则不显示。 */
    ui._expHint = (opts138 && opts138.hint) || '';
    /* ============================================================
     * v89.103（老板「任意自身城池向其他城池进行资源运输，应当采用出征界面」
     * ＋「目前主城向分城点击运输时提示城池不存在」）
     * ------------------------------------------------------------
     * 自身城池**不再跳到「城池间操作」小面板** —— 就在出征界面完成：
     * 将领 / 兵种 / 资源数量三确认，走**同一套行军通道**（有行军时间、可召回）。
     * 老面板那条"点运输 → 城池不存在"的路（`ui._trTo` 没落过默认值，
     * 起运时按空 id 查城）随之整条退场 —— 货运现在只有这一个入口。
     * ============================================================ */
    if (target && target.kind === 'own') {
      var _ownTo = GAME.cityById(target.id);
      var _ownFrom = GAME.currentCity();
      if (!_ownTo) { ui.toast('目标城池不存在'); return; }
      if (_ownFrom && _ownFrom.id === _ownTo.id) { ui.toast('请选择另一座己方城池'); return; }
      target = { kind: 'owncity', id: target.id };     /* 交给既有 resolveTarget（同一出口） */
    }
    ui._expOwn = !!(target && target.kind === 'owncity');
    var s = GAME.state, c = GAME.currentCity();
    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) { ui.toast(t.msg); return; }
    ui._expTarget = target;
    ui._expScheme = null;      /* v86：每次打开出征面板重置计略（防上次的计意外带上） */
    /* v89.103：本境调运强制走「调兵 · 辎重」方式（只有这一种方式） */
    if (ui._expOwn) { ui._expMode = 'transfer'; ui._expOps = 'assault'; }
    /* v74：把**已解析的目标**存一份 —— 兵力总览/战力对比要用守军与城防，
       同一份 resolveTarget 结果直接读，不再各算一遍（两个出口必漂移）。 */
    ui._expRes = t;
    /* ============================================================
     * v89.137（老板 7）：「所有军队操作均以出征界面进行（除非采集/收获/召回这类
     *   默认全军操作）」—— 目标是**己方野地**时：
     *   · 方式默认「驻守 · 增援」（station）——见下面的 modes 过滤；
     *   · 离开己方野地时**自动复位**（防"上次选了驻守、这次打敌方被拒"的粘性）。
     * ============================================================ */
    var isOwnWild137 = !!(target && target.kind === 'wild' && GAME.map.wildAt(target.x, target.y));
    ui._expOwnWild137 = isOwnWild137;         /* 主将段/提交端读（一枚标志，一处判定） */
    ui._expMode = ui._expMode || 'occupy';
    if (isOwnWild137 && ui._expMode !== 'station') ui._expMode = 'station';
    /* v89.138 修正（e2e 抓出）：`station` 与 `transfer` 都是**专用方式** ——
       离开对应目标类型时必须复位，否则会粘到下一次出征上
       （实测：先走"运输"（transfer）再打无主野地 → prepare 连报两次"调兵目标须为本境城池"、
       兵根本没发出去）。 */
    if (!isOwnWild137 && !ui._expOwn && (ui._expMode === 'station' || ui._expMode === 'transfer')) {
      ui._expMode = 'occupy';
    }
    /* 己方野地的现役驻将（有 → 纯增援不带将；无 → 首次/补将必选带队将领） */
    var stGen137 = null;
    if (isOwnWild137) {
      var _w137u = GAME.map.wildAt(target.x, target.y);
      if (_w137u.garrison && _w137u.garrison.genId) {
        (s.generals || []).forEach(function (g) { if (g.id === _w137u.garrison.genId) stGen137 = g; });
      }
    }
    if (target.kind === 'city') ui._attackNpc = t.npc;
    /* v89.57：主将缺省必须在**构建计略选项之前**定好（计略可用性要读当前将领） */
    if (!ui._expGen || !s.generals.some(function (g) { return g.id === ui._expGen; })) {
      ui._expGen = s.generals[0] ? s.generals[0].id : '';
    }
    /* v89.117：缺省主将**必须可出征** —— 旧口径取 generals[0]，若那位正在当城主/守将，
       玩家一开面板就"默认选中一个不能出征的人"（点出征才报错，很别扭）。
       这里把不可出征的缺省换成第一位可出征者（一个都没有时保持原样，交给下游报错）。 */
    var _curGen = null;
    s.generals.forEach(function (g) { if (g.id === ui._expGen) _curGen = g; });
    if (GAME.marchIssueOf && GAME.marchIssueOf(_curGen)) {
      var _okGen = GAME.expGeneralsOf()[0];
      if (_okGen) ui._expGen = _okGen.id;
    }
    var gNum = 0;
    for (var k in (t.garrison || {})) gNum += t.garrison[k];
    /* v89.64（老板「将目前所有兵种都列上，做好分列，列间距固定，好看点」）：
       ① **全部兵种**都上表（DATA.TROOPS 全列，不再只看"城内有的"）——
          没有的也列出来、置灰并禁用，一眼看清"这个兵我还没有"；
       ② 走**表格 + colgroup + table-layout:fixed**（与客栈候选表 `.inn-tbl` 同一套做法）：
          列宽只认表头这一次声明，换内容/换城时列**纹丝不动** —— 这正是"列间距固定"；
       ③ 整块搬去**右列**独占（老板：「右边只留兵种及数量」）。 */
    /* v89.144（老板 2）：「上限和清空……放在每个兵种行后边，对单独兵种数量进行操作」——
       每行 = [上限][清空] 两键：
         · 上限 = min(该兵种拥有, 总额度 − **其他行**已填)（唯一出口 ui.expTroopMaxOf；
           不限（无校场等）→ 拥有数）；
         · 清空 = 只清该行（不影响其他兵种）。
       分配顺序 = 玩家点哪行算哪行（没有"全局一键分配"，也就无需约定强兵优先之类）。 */
    var troopBlock =
      '<table class="tbl exp-tbl"><colgroup>' +
        '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in"><col class="et-c-act">' +
      '</colgroup><thead><tr>' +
        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">操作</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).map(function (id) {
        var tr = DATA.TROOPS[id] || {};
        var own = (c.army && c.army[id]) || 0;
        var off = own > 0 ? '' : ' off';
        return '<tr class="et-row' + off + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + own.toLocaleString() + '</td>' +
          '<td class="et-in"><input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '<td class="et-act"><button class="btn sm" data-action="exp-max" data-troop="' + id + '"' +
            ' title="' + U.escape(ui.expTroopTipOf(c, id, ui._expMode)) + '"' +
            (own > 0 ? '' : ' disabled') + '>上限</button>' +
            '<button class="btn sm" data-action="exp-zero" data-troop="' + id + '"' +
            (own > 0 ? '' : ' disabled') + '>清空</button></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';

    /* v89.87（需求 2）：调派类（调兵/驻守/采集）**不列出征面板** ——
       三者各有自己的入口（城池间操作 / 派驻面板 / 采集面板），
       混进"出征方式"只会让每次出征都要先跳过三个无关项。 */
    var modes = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).filter(function (m) {
      /* v89.103（老板「资源运输采用出征界面」）：目标是己方城池时，
         方式只有一种 —— 调兵 · 辎重（transfer：兵力 + 资源一起走行军通道）。 */
      if (ui._expOwn) return m.id === 'transfer';
      /* v89.137（老板 7）：目标 = **己方野地** → 只出「驻守 · 增援」（station）。
         打自家地盘没有侦察/掠夺/占领的语义；采集/收获/召回是默认全军操作，不本面板。 */
      if (isOwnWild137) return m.id === 'station';
      return m.panel !== false;
    });
    /* v89.58（老板「出征界面采用下拉框，三张卡片占位置太大」）：
       出征方式由三张大卡片 → 紧凑下拉框（与目标/站位/计略同款 .exp-sel 行）。 */
    var modeSelHTML = '<div class="exp-sel"><label>方式</label><select id="exp-mode" class="exp-mode-select">' +
      modes.map(function (m) {
        var lock = ui.expModeLockOf(m.id);
        var label = ui._expOwn
          ? '🚚 调兵 · 辎重（不接战 · 兵力押运）'
          : ((isOwnWild137 && m.id === 'station')
            ? '🛡️ 驻守 · 增派驻军（不接战 · 抵达即驻 · 不耗体力精力）'
            : (m.icon + ' ' + m.name + '（体' + m.stamina + ' 精' + m.energy + '）'));
        return '<option value="' + m.id + '"' + (ui._expMode === m.id ? ' selected' : '') + (lock ? ' disabled' : '') + '>' +
          label + (lock ? '　— ' + U.escape(lock) : '') + '</option>';
      }).join('') + '</select></div>';
    var cur = GAME.battle.modeOf(ui._expMode);

    /* v70（老板）：出征目标写**全称** —— 名城给州·郡·县，野外城池带所在县 */
    var _tTitle = (t.kind === 'fort' && t.fort) ? GAME.fortLabelOf(t.fort)
      : (t.npc ? GAME.cityFullName(t.npc) : t.name);

    /* v89.57：三个下拉框的选项 HTML —— 目标候选 / 全体站位 / 计略（全部接既有机制） */
    ui._expTargets = ui.expTargetCandidates(c, target);
    var tgtSel = '';
    if (ui._expTargets.length > 1) {
      tgtSel = '<div class="exp-sel"><label>目标</label><select id="exp-target">' +
        ui._expTargets.map(function (tg, i) {
          return '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' +
            U.escape(ui.expTargetLabel(tg)) + (i === 0 ? '　·当前' : '') + '</option>';
        }).join('') + '</select></div>';
    }
    /* v89.59（需求 6）：站位并入下方「出征战术」菜单（统一进退 + 预设战术），此处不再单列 */
    var schemeSel = '<div class="exp-sel"><label>计略</label><select id="exp-scheme-sel">' +
      ui.expSchemeOptionsHTML() + '</select><span class="exp-tac-link" data-action="exp-scheme">详情</span></div>';

    /* v89.52（老板：出征界面整合为单界面、紧凑有序）：
       目标城池 / 主将+可用道具 / 派遣兵力 / 出征方式 / 战术·计略 / 预估 / 确认，
       六大块用标题小卡分区，一眼扫完；主将改下拉框，可用道具实时可见。 */
    var html = '<div class="gold-heading">⚔️ ' + U.escape(_tTitle) + '</div>';
    /* v89.138：派遣 / 运输 的入口提示（同一界面，两句话说清各自要填的东西） */
    if (ui._expHint) {
      html += '<div class="exp-info exp-info-l" style="text-align:center;color:var(--gold-light);margin-bottom:6px;">'
        + (ui._expHint === 'cargo'
          ? '🚚 运输：先选<b>押运兵力</b>（运力随兵力涨），再到下方辎重区填要运的资源'
          : '🛡️ 派遣：选<b>主将</b>（随军入城）+ 兵种数量 —— 抵达即入城；不带货可直接出征')
        + '</div>';
    }
    /* v89.55（老板：出征界面偏小、每区块占整行不紧凑）→ 改 2 列分区网格 + 弹窗升 xl：
       目标+主将并排、战术+预估并排，派遣兵力/出征方式占满整行（需宽度）。 */
    /* v89.64（老板：「目标这里不用显示目标野地/城池的任何备注性信息，不然还要侦察何用？
       计略，方案，战术也放在左侧边，右边只留兵种及数量」）
       —— 于是版面改为**左列信息 / 右列兵力**两栏：
         左列：目标（只留名称与选择器）· 主将·道具 · 出征方式 · 计略 · 方案 · 出征战术 · 预估
         右列：**兵种及数量**（独占，可滚动） */
    html += '<div class="exp-grid"><div class="exp-col-l">';

    /* ① 目标（左上）—— v89.64：**删掉全部情报备注**（守军/城防/地形/库藏/守将/档位优势/布局），
       只留"打谁"这一件事；想知道守军多少、守将是谁，请去**侦查**。 */
    html += '<div class="exp-sec exp-a-target"><div class="exp-sec-t">目标</div>';
    html += tgtSel;                              /* v89.57：目标下拉框（当前 + 同县普通城 / 据点 / 己方城） */
    /* v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**（领地满 / 野地满 /
       据点今日已掠夺……）—— 常规引导（"情报请用侦查"）退役；
       无限制时这行为空。唯一出口 ui.expLimitsHTML（与执行端判据同源）。 */
    html += '<div class="exp-info exp-info-l" id="exp-limits" style="margin-bottom:0;color:var(--red-light);">' +
      ui.expLimitsHTML() + '</div>';
    html += '</div>';

    /* ② 主将 + 可用道具（左中）—— 主将缺省已在函数开头定好（v89.57） */
    /* v89.156（老板 3）：标题去掉「· 可用道具」（可用道具已独立成块） */
    html += '<div class="exp-sec exp-a-gen"><div class="exp-sec-t">主将</div>';
    /* v89.137（老板 7）：己方野地已有驻将 → 本次是**纯增援**（只并兵、不换驻将）；
       不给选将（选谁都不会被带走），一句话讲清。首次驻军/老档补将仍须选将。 */
    if (stGen137) {
      html += '<div class="exp-info exp-info-l" style="color:var(--gold-light);margin:2px 0 4px;">🛡️ '
        + U.escape(stGen137.name) + ' Lv' + (stGen137.level || 1)
        + ' 驻守中 —— 本次增援<b>不带将</b>（只并兵，不换驻将）</div>';
    }
    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select"' + (stGen137 ? ' disabled' : '') + '>';
    html += s.generals.map(function (g) {
      var a = GAME.genAttrs(g);
      /* v89.59（老板需求 2）：主将选项展示**六维** —— 统率 / 勇武 / 智谋 / 内政 / 速度 / 体力 */
      var six = '统' + (a.tong || 0) + ' 勇' + (a.yw || 0) + ' 智' + (a.zm || 0) + ' 政' + (a.nz || 0) +
        ' 速' + (a.spd || 0) + ' 体' + (a.staMax || 0);
      /* v89.117（老板「城主和守将不能执行出征动作」）：不可出征者**列出来但置灰**
         （比"藏起来"好：玩家一眼看出"他在当城主"）。判据走唯一出口 GAME.marchBlockOf。 */
      var blk = GAME.marchIssueOf ? GAME.marchIssueOf(g) : null;
      return '<option value="' + g.id + '"' + (g.id === ui._expGen ? ' selected' : '') +
        (blk ? ' disabled' : '') + '>' +
        U.escape(g.name) + (blk ? '（' + U.escape(blk) + '）' : '（' + six + '）') + '</option>';
    }).join('');
    html += '</select></div>';
    /* v89.129（老板「根据等级配备相称资质和等级的将领」）：**相称建议**行 ——
       纯按目标等级给"宜派"的档位（守将实情请侦查；软提示、非门槛）。
       目标切换时整窗重绘（目标下拉 change → openExpModal），本行随 t 重建。 */
    var rec129 = GAME.recGenOf(t);
    if (rec129) {
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin:4px 0 0;">'
        + '相称建议：宜 <b>' + U.escape(rec129.text) + '</b> 带队</div>';
    }
    /* v89.112：「可用道具」**移入右列**（原在主将段内）——
       物品多时体力丹 pills 会换行（199 物品环境下 +42px，撑高左列顶穿正文区）。
       右列余量充足；语义上也更顺：它和"派遣兵力"同属"带什么走"。 */
    html += '</div>';

    /* v89.66（老板：「计略，出征方式，方案，出征战术再缩减版面，目前是 1×4，改成 2×2」）
       —— 四块聚成一个 2×2 子网格（.exp-quad），左列由 7 行收到 4 行：
            ① 目标　② 主将·道具　③ [2×2 四块]　④ 预估
         排序按老板点名的顺序：计略 · 出征方式 ／ 方案 · 出征战术。
       ⚠️ 这只是**换容器**：四块的内部结构、id、handler 一字未动
       （#exp-scheme-sel / #exp-scheme-label / #exp-mode / #exp-plan / #exp-tactic / #exp-tac-sum 全照旧）。 */
    html += '<div class="exp-quad">';

    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（计略）——
       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；
       语义也正：transfer 是"兵力押运、不接战"，计略/阵位/阵型配置无用途。 */
    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */
    if (!ui._expOwn && !isOwnWild137) {
      /* ⑤ 计略（2×2 左上）—— v89.59：站位并入「出征战术」菜单，这里只留计略 */
      html += '<div class="exp-sec exp-a-tactic"><div class="exp-sec-t">计略</div>';
      html += schemeSel;                       /* 计略下拉框 + 详情 */
      html += '<div class="exp-info exp-info-l" id="exp-scheme-label" style="color:var(--text-dim);margin-bottom:6px;">' + U.escape(ui.expSchemeLabel()) + '</div>';
      html += '<div id="exp-scheme-box" class="hidden exp-body" style="max-height:210px;margin:0 0 6px;"></div>';
      html += '</div>';

    }
    /* ④ 出征方式（2×2 右上）—— 紧凑下拉框 */
    /* v89.86（整改 P-24）：据点目标的"占领"语义提示；v89.103 改为"据为己有" */
    var fortModeNote = (t.kind === 'fort')
      ? '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">据点：占领=拔除并**据为己有**（全城建筑转正、人口归附，从此是我的一座城，该地不再生成据点）；野地占领才会就地驻军。</div>'
      : '';
    html += '<div class="exp-sec exp-a-modes"><div class="exp-sec-t">出征方式</div>' + modeSelHTML + fortModeNote
      + ui.expOpsBlockHTML() + '</div>';

    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（方案）——
       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；
       语义也正：transfer 是"兵力押运、不接战"，计略/阵位/阵型配置无用途。 */
    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */
    if (!ui._expOwn && !isOwnWild137) {
      /* ⑦ 方案（2×2 左下 · v89.59 需求 6）：固定「兵力 + 战术」的一套配置 */
      html += '<div class="exp-sec exp-a-plan"><div class="exp-sec-t">方案</div>';
      html += '<div class="exp-sel"><label>方案</label><select id="exp-plan">' + ui.expPlanOptionsHTML() + '</select>' +
        '<span class="exp-tac-link" data-action="open-plan">设置</span></div>';
      html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">套用方案即按其配好兵力与战术</div>';
      html += '</div>';

    }
    /* v89.156：调运（transfer · 不接战）**不渲染接战专属三块**（出征战术）——
       原本 2×2 两行、改单列后四块 439px 把左列顶爆（调运面板溢出 141px · modals 审计实锤）；
       语义也正：transfer 是"兵力押运、不接战"，计略/阵位/阵型配置无用途。 */
    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */
    if (!ui._expOwn && !isOwnWild137) {
      /* ⑧ 出征战术（2×2 右下 · v89.59 需求 6）：统一进退 + 预设战术 + 逐兵种 */
      html += '<div class="exp-sec exp-a-tacmenu"><div class="exp-sec-t">出征战术</div>';
      html += '<div class="exp-sel"><label>战术</label><select id="exp-tactic">' + ui.expTacticOptionsHTML() + '</select>' +
        '<span class="exp-tac-link" data-action="open-tactic-set">设置</span></div>';
      html += '<div class="exp-info exp-info-l" style="margin-bottom:0;">阵位 <b id="exp-tac-sum">' + GAME.tacticSummary() + '</b>' +
        '<span class="exp-tac-link" data-action="open-tactic">逐兵种</span></div>';
      html += '</div>';

    }
    html += '</div>';  /* /.exp-quad（四块容器的闭合 —— 必须在 if 外，否则 transfer 时不闭合、布局炸） */

    /* ⑨ 可用道具（v89.156 老板 2：「上方的可用菜单放在左边，做个下拉框不要全列出」）——
       由右列顶部挪入左列 + 收成下拉框（不再全列 chips）；
       信息行（锦囊 · 精力 · 体力）保留 —— 它是出征决策的关键读数。 */
    html += '<div class="exp-sec exp-a-items"><div class="exp-sec-t">可用道具</div>';
    html += '<div class="exp-sel"><label>道具</label>' +
      '<select id="exp-item-sel"><option value="">（选择道具）</option></select>' +
      '<span class="exp-tac-link" id="exp-item-use" data-action="exp-use-item-pick" title="使用所选道具（作用于当前主将）">使用</span></div>';
    html += '<div class="exp-info exp-info-l" id="exp-items" style="margin-bottom:0;"></div>';
    html += '</div>';
    /* ⑩ 本境调运「辎重 · 资源调配」（transfer 专用**操作区**）——
       v89.156 随"预估"挪去右列后独立成块：它不是预估、是操作，不能跟着藏。
       旧账（v89.112）：右列 辎重221 + 兵种655 = 876px 顶穿正文区 —— 辎重始终留左列。 */
    if (ui._expOwn) html += ui.expCargoHTML(c);

    /* 右列（独占）：**兵种及数量** + （战斗型任务）预估
       v89.156 老板 2：可用道具整块搬去左列（下拉框形态），右列不再有它；
       老板 3：预估仅"战斗型任务（非己方）"提供，位于派遣兵力**下方** ——
       己方野地 / 己方城池无需预估（本境调运与驻守没有战果可估）。 */
    html += '</div><div class="exp-col-r' + (ui._expOwn ? ' exp-own' : '') + '">';
    /* v89.144（老板 2）：标题栏的两枚全局键（旧「上限 / 清空」）**整条退役** ——
       两个操作挪进每个兵种行（见 troopBlock）。
       v89.156 老板 2：标题由「派遣兵力 · 兵种数量」改「派遣兵力（校场出征上限：N）」——
       上限数值随方式/目标变（行内「上限」按钮的总额度，同一出口 expFillCapOf）。 */
    html += '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">派遣兵力（<span id="exp-cap-t">' +
      U.escape(ui.expCapLabelOf(c, t, ui._expMode)) + '</span>）</div>';
    html += '<div class="exp-troops exp-body" data-mode="' + cur.id + '">' + troopBlock + '</div>';
    html += '</div>';
    if (!ui._expOwn && !isOwnWild137) html += ui.expEstBlockHTML();
    html += '</div></div>';  /* /.exp-col-r /.exp-grid */

    /* ⑦ 确认 / 取消 */
    html += '<div class="exp-foot"><button class="btn gold" data-action="exp-confirm">'
      + (ui._expOwn ? '🚚 起运（兵 + 辎重）' : (cur.icon + ' ' + cur.name)) + '</button>' +
      '<button class="btn" data-action="close-modal">取消</button></div>';

    ui.openModal(html, { size: 'xxl' });   /* v89.105：内容实测超 xl（出征 711 / 自动出征 815） */
    ui.applyExpMode();
    ui.refreshExpItems();
    ui.updateExpMarch();
    ui.updateExpLimits();           /* v89.156：打开即评估限制性信息（双保险，applyExpMode 已调一次） */
    ui.syncCargoEst();              /* v89.103：辎重运力/实收（本境调运） */
    /* v89.103：辎重数量框 —— 手输即可见运力与实收变化（不重绘弹窗） */
    if (ui._expOwn) {
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el = document.getElementById('cg-' + k);
        if (el) el.addEventListener('input', function () { ui.syncCargoEst(); });
      });
    }
    /* 主将下拉变更：同步 _expGen 并刷新可用道具 / 预估 / 计略可用性（不出重绘，保住出征面板） */
    var _genSel = document.getElementById('exp-gen');
    if (_genSel) _genSel.addEventListener('change', function () {
      ui._expGen = _genSel.value;
      ui.refreshExpItems();
      ui.updateExpMarch();
      var _sb = document.getElementById('exp-scheme-box');
      if (_sb && !_sb.classList.contains('hidden')) _sb.innerHTML = ui.expSchemePanelHTML();
      ui.refreshExpSchemeSel();          /* v89.57：将领变 → 计略下拉可用性重算 */
    });
    /* v89.57：目标切换 → 重开面板（守军 / 库藏 / 计略可用性全变）
       v89.103：切到己方城池 → 同样重开（本境调运：辎重区会随之出现） */
    var _tgtSel = document.getElementById('exp-target');
    if (_tgtSel) _tgtSel.addEventListener('change', function () {
      var tg = ui._expTargets[Number(_tgtSel.value)];
      if (!tg) return;
      ui.openExpModal(tg);
    });
    var _plSel = document.getElementById('exp-plan');
    if (_plSel) _plSel.addEventListener('change', function () { if (_plSel.value) ui.expApplyPlan(_plSel.value); });
    var _tcSel = document.getElementById('exp-tactic');
    if (_tcSel) _tcSel.addEventListener('change', function () { ui.expApplyTactic(_tcSel.value); });
    /* v89.57：计略下拉框 → 显式设定（与面板的「再点撤下」共存） */
    var _scSel = document.getElementById('exp-scheme-sel');
    if (_scSel) _scSel.addEventListener('change', function () { ui.setExpScheme(_scSel.value); });
    /* v89.58：出征方式下拉框 → setExpMode（锁 + 按钮文案 + 兵力区置灰） */
    var _mdSel = document.getElementById('exp-mode');
    if (_mdSel) _mdSel.addEventListener('change', function () { ui.setExpMode(_mdSel.value); });
  };

  /* ============================================================
   * v89.86（整改 P-23）：兵力悬殊二次确认 —— 战力比的**唯一出口** + 按钮两态
   * ------------------------------------------------------------
   * 实测代价（老板试玩）：0.02:1 出兵 → 200 长枪全灭、敌损 0。
   * 预估行与确认闸必须读同一个战力比 —— 各自算一遍就会"面板报悬殊、确认却没拦住"。
   * ============================================================ */
  /* 战力比：我方 = 各兵种填报量 × troopPower；守方 = 守军 × troopPower × (1 + 城防/defDivisor)。
     口径与 v74 预估行完全一致（原逻辑迁移到此处，两处共用）。 */
  /* v89.94（B2 · E2）：情报等级 → 估算误差（±）—— 侦察技巧越高，区间越窄。
     Lv0 ±55% / Lv3 ±34% / Lv6 ±13% / Lv8+ ±10%（下限 10%：军师也不是神仙）。 */
  ui.expEstErrOf = function (lv) {
    lv = Math.max(0, Number(lv) || 0);
    return Math.max(0.10, Math.min(0.55, 0.55 - 0.07 * lv));
  };
  /* 军师估算（v89.94 · E2 改造）：**不再给一键正解** —— 给人一个区间。
     · 点估计 = 兵种加权（与来袭/家底同一把尺），守方含城防；
     · 围攻目标（据点/县城）：守军与城防按**当前守备值**折算（与战斗入参同一出口）；
     · 误差 ±err 由侦察技巧等级决定 —— 情报越细，区间越窄，"判断"才有价值。 */
  ui.expPowerOf = function () {
    var tp = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
    var city = GAME.currentCity();
    if (!tp || !city) return null;
    var mine = 0, n = 0;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) || 0 : 0;
      n += v;
      mine += v * tp(id);
    });
    var res = ui._expRes;
    var def = 0, sgS = null;
    if (res) {
      var div = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
      var wall = (res.def || 0) / div;
      var base = 0;
      for (var k in (res.garrison || {})) base += tp(k) * (res.garrison[k] || 0);
      if (GAME.siegeScopeOf && GAME.siegeScopeOf(res)) {
        sgS = GAME.siegeScaleOf(res);
        base *= sgS.garrison;                 /* 守军随破防衰减 */
        wall *= sgS.def;                      /* 城防同步衰减 */
      }
      def = Math.round(base * (1 + wall));
    }
    var lv = (GAME.battle.intelTiersOf ? GAME.battle.intelTiersOf().lv : 0);
    var err = ui.expEstErrOf(lv);
    var out = {
      mine: Math.round(mine), def: def, n: n,
      ratio: def > 0 ? mine / def : null,
      intelLv: lv, err: err,
      lo: def > 0 ? Math.round(def * (1 - err)) : 0,
      hi: def > 0 ? Math.round(def * (1 + err)) : 0,
      siege: sgS ? { hold: sgS.hold } : null,
    };
    out.ratioLo = out.hi > 0 ? mine / out.hi : null;   /* 最坏情形（守军偏强） */
    out.ratioHi = out.lo > 0 ? mine / out.lo : null;   /* 最好情形（守军偏弱） */
    return out;
  };
  /* "上膛"标记：兵力悬殊时第一次点击置 true（只警告不发兵） */
  ui._expForceArmed = false;
  /* 还原确认按钮（正常态）+ 清"上膛" —— 兵力/方式一变就调它 */
  ui.resetExpConfirm = function () {
    ui._expForceArmed = false;
    var btn = document.querySelector('#modal-root [data-action="exp-confirm"]');
    if (!btn) return;
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    btn.className = 'btn gold';
    btn.innerHTML = cur.icon + ' ' + cur.name;
  };

  /* 行军队列预估（出征弹窗内实时显示）
     行军速度由**最慢兵种**决定，所以必须等玩家填完兵力才准；
     未填时按城内现有兵种占位估算，并标注说明。 */
  ui.updateExpMarch = function () {
    var box = $('#exp-march');
    if (!box) return;
    /* v89.86（P-23）：兵力/将领一变，二次确认重新计数并还原按钮（防"上膛"状态残留） */
    if (ui._expForceArmed) ui.resetExpConfirm();
    /* ⚠️ v89.115：目标一律用 `resolveTarget` 解析后的那份（`ui._expRes`，含 x/y/lv/npc）——
       原始 target 可能是 `{kind:'city', id}` 这种**没有坐标**的入参，直接拿它算会
       在"目标无坐标"处早退，整个预估区（行军/军师估算/搬运）全是空白
       （实机诊断：`🛫 目标无坐标，无法估算行军` → power/haul 三框皆空）。
       与 v89.114 的 haul 预估同一条口径：面板读的就是结算读的那个 t。 */
    var t = ui._expRes || ui._expTarget;
    var city = GAME.currentCity();
    if (!t || !city) { box.textContent = ''; ui.updateExpHaul(); return; }
    var army = {}, any = false;
    Object.keys(city.army || {}).forEach(function (id) {
      var inp = document.getElementById('exp-' + id);
      var v = inp ? Number(inp.value) : 0;
      if (v > 0) { army[id] = v; any = true; }
    });
    var fallback = !any;
    if (fallback) army = city.army || {};
    var from = { x: city.x, y: city.y, cityId: city.id };
    if (t.x == null || t.y == null) { box.innerHTML = '🛫 目标无坐标，无法估算行军'; return; }
    var to = { x: t.x, y: t.y };
    var dist = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
    /* v26（需求 2）：主将速度参与行军，预估必须带上这名将领，否则与实际耗时不符 */
    var egEl = document.getElementById('exp-gen');
    var eGen = null;
    if (egEl) {
      (GAME.state.generals || []).forEach(function (x) { if (x.id === egEl.value) eGen = x; });
    }
    var real = GAME.march.travelTime(from, to, army, null, eGen) / GAME.timeScale();
    box.innerHTML = '🛫 行军 <b>' + dist + '</b> 格　速度系数 <b>' + GAME.march.speedText(army, from, to, eGen) + '</b>　'
      + '预计 <b style="color:var(--gold-light)">' + U.durExact(real) + '</b>'
      + (fallback ? '<span style="opacity:.6;">（按城内现有兵种估算）</span>' : '');
    /* v74（老板：完善出征界面）：兵力总览 + 战力对比（估算）。
       v89.36：军粮维持退役 —— 总览不再列「耗粮 X/时」。
       战力走 STORY.troopPower（与来袭/家底评估同一出口）；
       守军侧对城池/据点吃城防系数（与 defensePowerOf 同一个 defDivisor 常量）。 */
    /* v89.178（老板：「👥 共派遣 N 兵，这不明摆着吗」）——「共派遣」整行退役（#exp-sum 元素同删）；兵力在各兵种输入框上本就可数。 */
    var pow73 = $('#exp-power');
    if (pow73) {
      var tp74 = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
      var mine74 = 0;
      Object.keys(city.army || {}).forEach(function (id) {
        var inp74 = document.getElementById('exp-' + id);
        var v74 = inp74 ? Number(inp74.value) || 0 : 0;
        var tr74 = DATA.TROOPS[id];
        if (tp74) mine74 += v74 * tp74(id);
      });
      if (pow73) {
        /* v89.103：本境调运不接战 —— 这里改说"辎重与运力"（战报口径里没有守军） */
        if (ui._expOwn) {
          var _capW = GAME.cargoCapOf(ui.expArmyOf ? ui.expArmyOf() : {});
          pow73.innerHTML = '🚚 本境调运：<b>不接战</b>　随军载重 <b style="color:var(--gold-light);">'
            + U.fmt(_capW) + '</b>（民夫 ' + DATA.TROOPS.minfu.load + ' / 辎重车 ' + DATA.TROOPS.zhouche.load
            + ' —— 想多运就多带挑夫）';
        } else {
        /* v89.94（B2 · E2）：**军师估算** —— 给区间不给答案（误差随侦察技巧收窄）。
           区间跨过 1:1 时提示"凶险"：胜则可入史册 —— 把"势均力敌"框成机会而非劝退。 */
        var pw74 = ui.expPowerOf ? ui.expPowerOf() : null;
        if (pw74 && pw74.def > 0 && pw74.mine > 0) {
          var rLo = pw74.ratioLo, rHi = pw74.ratioHi;
          var lv74 = (rLo != null && rLo >= 1.6) ? ['兵力充足', 'var(--green-ok)']
            : (rLo != null && rLo >= 1.0) ? ['势均力敌 · 胜负由临阵决断', 'var(--gold-light)']
            : (rHi != null && rHi < 0.6) ? ['兵力悬殊', 'var(--red-light)']
            /* v89.178（老板：「此战凶险」加到「兵力偏少」后边，只写「兵力偏少，此战凶险」）——
               原单独一行「⚑ 此战凶险：胜则可入史册」退役，并入本标签。 */
            : ['兵力偏少，此战凶险', 'var(--gold-light)'];
          pow73.innerHTML = '⚔️ 军师估算　我方 <b style="color:var(--blue-info)">' + U.numText(pw74.mine, 0) +
            '</b>　vs　守军 约 <b style="color:var(--red-light)">' + U.numText(pw74.def, 0) + '</b>' +
            '<span style="opacity:.7;">（误差 ±' + Math.round(pw74.err * 100) + '%）</span>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '</span>' +
            /* v89.178（老板：「区间…情报 Lv（升侦察技巧可收窄）这个也没必要」）——区间/情报条退役。 */
            (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '')
            /* v89.115：斗将预告（我方主将 vs 守将；无守将则空） */
            + ((GAME.battle.duelPreviewOf && ui._expRes && ui._expRes.guard)
              ? (function () {
                  var eg = null, sel = document.getElementById('exp-gen');
                  (GAME.state.generals || []).forEach(function (x) { if (sel && x.id === sel.value) eg = x; });
                  var s0 = eg ? GAME.battle.duelPreviewOf(eg, ui._expRes.guard) : '';
                  return s0 ? '<br><span style="color:var(--gold-light);">' + s0 + '</span>' : '';
                })()
              : '');
        } else {
          pow73.innerHTML = '⚔️ 军师估算　' + ((pw74 && pw74.mine > 0) ? '守军兵力未知（先派侦察）' : '填入兵力后显示对比');
        }
        }   /* /else —— 非本境调运（普通出征才谈守军对比） */
      }
    }
    /* v89.114：搬运预估（随军载重 vs 目标可掠量）—— 兵力一变就重算。
       ⚠️ 放在最外层：不挂在预估块的存在性上（那条链一断，这里就静默失效）。 */
    ui.updateExpHaul();
  };

  /* ============================================================
   * v89.114（老板「掠夺返回的物资数量，与军队总负重有关」）：出征面板**搬运预估**
   * ------------------------------------------------------------
   * 口径与结算同源，一个数都不另算：
   *   · 载重 = GAME.cargoCapOf(ui.expArmyOf())（与随军辎重运力同一个出口）；
   *   · 目标量 = 名城走 GAME.npcLoot（派生库存，精确）；野地/据点走
   *     GAME.battle.lootEstOf（genLoot 同一公式的期望口径，不掷骰不落账）。
   * 只在「掠夺 / 占领」且目标可掠时出现；占领不取财货（mul=0）会明说，
   * 免得玩家以为"占领也能搬库藏"。超载黄字预警 + 给出路（编辎重车/民夫）。
   * ============================================================ */
  ui.updateExpHaul = function () {
    var box = document.getElementById('exp-haul');
    if (!box) return;
    /* ⚠️ 目标一律用 `resolveTarget` 解析后的那份（`ui._expRes`，含真实 lv / dropType / npc）——
       原始 target 没有 lv 字段，拿它估算会把 Lv10 野地按 Lv1 算
       （实机首版栽在这：面板报"约 19 万"、真打却是 365 万）。
       `ui._expRes` 也正是 expedition 结算时用的那个 t —— 面板与战果同一份。 */
    var t = ui._expRes || ui._expTarget, city = GAME.currentCity();
    if (!t || !t.kind || !city || ui._expOwn) { box.innerHTML = ''; return; }
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    var tbl = (t.kind === 'wild') ? DATA.EXPEDITION.wildResMul : DATA.EXPEDITION.cityResMul;
    var mul = (tbl || {})[mode.id];
    if (mul == null) mul = 0;
    var army = ui.expArmyOf ? ui.expArmyOf() : {};
    var any = false;
    for (var k in army) { if (army[k] > 0) { any = true; break; } }
    if (!any) {
      box.innerHTML = '🚚 搬运力 <b style="color:var(--text-dim);">—</b>' +
        '<span style="opacity:.7;">（先选随行兵力：随军载重决定这一趟能搬回多少战利品）</span>';
      return;
    }
    var cap = GAME.cargoCapOf(army);
    if (mul <= 0) {
      box.innerHTML = '🚚 随军载重 <b style="color:var(--gold-light);">' + U.fmt(cap) + '</b>' +
        '<span style="opacity:.7;">（此方式不取财货 —— 载重只用于随军辎重）</span>';
      return;
    }
    var est = 0, i, keys = GAME.TRANSPORT_KEYS;
    if (t.kind === 'city' && t.npc) {
      var lo = GAME.npcLoot(t.npc, mode.id);
      for (i = 0; i < keys.length; i++) est += Math.max(0, Math.floor(lo[keys[i]] || 0));
    } else if (GAME.battle.lootEstOf) {
      est = GAME.battle.lootWeightOf(GAME.battle.lootEstOf(t, mul));
    }
    var over = est > cap;
    box.innerHTML = '🚚 随军载重 <b style="color:var(--gold-light);">' + U.fmt(cap) + '</b>' +
      '　目标估掠 约 <b>' + U.fmt(est) + '</b>' +
      (over
        ? '　<span style="color:var(--red-light);font-weight:700;">⚠ 库藏超出运力，只能搬回载重内的部分' +
          '（编入辎重车 / 民夫可提高搬运量）</span>'
        : '　<span style="color:var(--green-ok);">✓ 运力可尽取</span>');
  };

  /* ============================================================
   * 加点弹窗（v74 · 老板需求 4/5）：自由属性点 或 道具，二选一
   * ------------------------------------------------------------
   * 入口 = 六维表「加点」列的 ＋ 按钮。六维都开放：
   *   · 四项主属性 —— 自由点 g[stat]+1；道具走 systems.useItem（perm 型，沿用 50 上限）
   *   · 速度 / 体力 —— 只有自由点（无对应道具；分别落到 spdAdd / staAdd，
   *     由 genAttrs 与 staBaseMax 吃进），**只能加、不能减**（老板明示）。
   * ============================================================ */
  ui.STAT_NAMES74 = { tong: '统率', nz: '内政', yw: '勇武', zm: '智谋', spd: '速度', sta: '体力' };
  ui.openStatPlus = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var nm = ui.STAT_NAMES74[stat] || stat;
    var a = GAME.genAttrs(g);
    var fp = Math.round(g.freePts || 0);
    var curVal = (stat === 'spd') ? (a.spd || 0) : (stat === 'sta') ? (a.staMax || 0) : (a[stat] || 0);
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'perm' && it.attr === stat;
    });
    var rows = items.length ? items.map(function (it) {
      var have = (s.items || {})[it.id] || 0;
      var used = (g.perm || {})[it.attr] || 0;
      var capped = used >= 50;
      return '<div class="stat-row"><span class="sr-name">' + GAME.itemIcon(it) + ' ' + U.escape(it.name) +
        ' <i class="gd-sub">×' + have + '</i></span>' +
        '<span class="sr-sub">已用 ' + used + ' / 50</span>' +
        '<button class="btn sm' + (have > 0 && !capped ? ' gold' : ' dim') + '" data-action="stat-plus-item"' +
          ' data-gen="' + genId + '" data-stat="' + stat + '" data-item="' + it.id + '"' +
          (have > 0 && !capped ? '' : ' disabled') +
          ' title="' + (capped ? '该将领此项丹药已达上限 50'
            : (have > 0 ? '使用 1 个：' + nm + ' +1（永久）' : '背包中没有该道具（商城有售）')) + '">＋1</button></div>';
    }).join('') : '<div class="q-empty">此属性暂无对应道具（用自由属性点即可）。</div>';
    ui.openShell({
      title: '＋ ' + nm + ' · ' + U.escape(g.name),
      sub: '自由属性点 ' + fp + '　·　' + nm + ' 现 ' + curVal +
        ui.help('自由属性点：每升 1 级获得 = 资质成长值（凡品 +1 … 天授 +8）。\n' +
          '支持一次加多点：填数量（或点「最多」）后点「加点」；只能加、不能减。\n' +
          '四项主属性另有永久丹药（商城 · 丹药），每将每项上限 50。'),
      size: 'sm',
      body:
        '<div class="ui-sub">自由属性点</div>' +
        /* v89.40（老板）：「输入计划增加的数量，一次加点」—— ＋1 按钮升级为
           数量框 +「加点」：单点默认 1 仍一键，批量填数或点「最多」后一次到账。 */
        '<div class="stat-row"><span class="sr-name">🎯 一次加点</span>' +
          '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
          ui.qtyInput('fp-add-' + genId, 1, 0, fp) +
          '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
            ' data-gen="' + genId + '" data-stat="' + stat + '" data-qty-from="fp-add-' + genId + '"' +
            (fp > 0 ? '' : ' disabled') +
            ' title="' + (fp > 0 ? nm + ' 一次加点（填数量或点「最多」，只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">加点</button></div>' +
        '<div class="ui-sub" style="margin-top:10px;">道具</div>' + rows,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* 切换出征方式（只更新界面，不重开弹窗） */
  ui.setExpMode = function (m) {
    /* v63：不可用的方式点不动（并说明原因）——不能点进去、填完兵才被拦下来 */
    var lock = ui.expModeLockOf(m);
    if (lock) { ui.toast(lock); return; }
    ui._expMode = m;
    var msel = document.getElementById('exp-mode');   /* v89.58：下拉框与内部状态同步 */
    if (msel && msel.value !== m) msel.value = m;
    /* v89.86（P-23）：换方式 → 二次确认重新计数 + 按钮还原（原为直接改 innerHTML，改走唯一出口） */
    ui.resetExpConfirm();
    var body = $('#modal-root .exp-body');
    if (body) body.dataset.mode = m;
    ui.applyExpMode();
  };

  ui.applyExpMode = function () {
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    var box = $('#modal-root .exp-troops');
    if (box) box.style.opacity = cur.battle ? '1' : '.55';
    ui.updateExpLimits();           /* v89.156：方式变更 → 重算限制性信息（原野地上限预警） */
    ui.refreshExpCapLabel();        /* v89.156：限额标签随方式刷新（校场 / 派驻 / 目标城余量） */
  };

  /* ============================================================
   * v89.156（老板 3）：「目标」的备注**只提示出征限制性信息**——
   *   · 领地满（占城 / 拔据点都会产出一座新城）；
   *   · 野地满（占领将转为就地取材）；
   *   · 据点今日已掠夺（每处每日限一次）。
   * 判据全部读**执行端同一出口**（cityCapChk / 官府+wildCap / fortRaidedToday）——
   * 界面提示与真拦截不许各算一份。无限制时返回空串（该行不占位）。
   * ============================================================ */
  ui.expLimitsHTML = function () {
    var t = ui._expRes;
    var city = GAME.currentCity();
    if (!t || !city) return '';
    var mode = GAME.battle.modeOf(ui._expMode || 'occupy');
    var out = [];
    /* ① 领地上限（占城 / 拔除据点 = 一座新城；与 battle.prepare 硬闸同一判据） */
    if (mode.occupy && (t.kind === 'city' || t.kind === 'fort')) {
      var cc = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
      if (!cc.ok) out.push('⚠️ ' + U.escape(cc.msg) + ' —— 此战攻克也无法纳入版图');
    }
    /* ② 野地上限（占领未占野地；上限口径与 battle 里"转为就地取材"的判定同源：
       官府等级 + 爵位/主城加成 cityBonusNum('wildCap')） */
    if (mode.occupy && t.kind === 'wild' && !GAME.map.wildAt(t.x, t.y)) {
      var limit = (GAME.buildingLevel(city, 'guanfu') || 1) + GAME.cityBonusNum(city, 'wildCap');
      var have = ((GAME.state && GAME.state.wilds) || []).length;
      if (have >= limit) {
        out.push('⚠️ 野地已达上限（' + have + ' / ' + limit + '）：本次占领将<b>转为就地取材</b>' +
          '（不再取得产量加成与采集权）——可先放弃一处野地，或升官府提高上限。');
      }
    }
    /* ③ 据点今日已掠夺（每处每日限一次；与 raid 方式锁同一判据） */
    if (mode.raid && t.kind === 'fort' && GAME.map.fortRaidedToday && GAME.map.fortRaidedToday(t.x, t.y)) {
      out.push('⚠️ 此据点今日已掠夺（每处每日限一次），明日可再来。');
    }
    return out.map(function (x) { return '<div>' + x + '</div>'; }).join('');
  };
  ui.updateExpLimits = function () {
    var box = document.getElementById('exp-limits');
    if (box) box.innerHTML = ui.expLimitsHTML();
  };

  /* 旧接口兼容 */
  /* v89.58（老板「侦查/掠夺/占领 的选项做在 野地/城池/名城 的点击界面中」）：
     点 NPC 城不再直进大面板，先给「城池点击界面」—— 摘要 + 三个方式按钮，选完再进出征面板。 */
  ui.openAttackModal = function (npcCity) {
    ui._attackNpc = npcCity;
    ui._expMode = 'occupy';
    ui._expTarget = { kind: 'city', id: npcCity.id, npc: npcCity };
    var nci = GAME.npcCityInfo(npcCity);
    var tier = npcCity.type === 'capital' ? '都城' : npcCity.type === 'zhou' ? '州城'
      : npcCity.type === 'jun' ? '郡城' : '县城';
    var g = npcCity.garrison || {}, gNum = 0;
    for (var k in g) gNum += g[k];
    var ng = nci.guard;
    var html = '<div class="gold-heading">⚔️ ' + U.escape(GAME.cityFullName(npcCity)) +
      '（' + tier + ' · <b>城等级 Lv' + GAME.cityLvOf(npcCity) + '</b>）</div>';
    /* v89.73（老板：「地图点选城池时，弹窗界面显示其坐标」）——
       坐标 + 距主城格数一起给：前者用于报点/对齐，后者用于估行军耗时。
       （v71 那条"城池属性不显示坐标"说的是**自己的城池面板**，与这里的
        "点地图上别人家的城"是两回事，不冲突。） */
    var _myc = GAME.currentCity();
    var _dist = _myc ? (Math.abs(_myc.x - npcCity.x) + Math.abs(_myc.y - npcCity.y)) : null;
    html += '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">' +
      '📍 坐标 (' + npcCity.x + ', ' + npcCity.y + ')' +
      (_dist != null ? '　·　距主城 ' + _dist + ' 格' : '') +
      '　·　守军约 ' + gNum.toLocaleString() + ' 名　·　城防 <b style="color:var(--gold-light)">' +
      (npcCity.def || 0) + '</b></div>';
    /* v89.74（老板：「究竟是显示问题还是等级没有按上表执行变更？」）：这里回答它。
       弹窗里是**两个不同的量**，现在两处都带上了名字，不再让人误以为是同一个数写错：
         · **城等级**（标题）→ 这座城本身的等级，1~10 分布（v89.72 老板要的"越低越弱"），
           守军 / 库藏 / 自动出征的"威胁等级"筛选都按它算；
         · **建筑等级**（下一行）→ 城内建筑盖到几级，**按档位固定**（v89.76 老板：
           县城 12 · 郡城 16 · 州城 20 · 都城 24，与城等级无关）。
       两者混进同一个数字里，就会反复出现"Lv16 的城怎么守军才 26 万"这类错觉。 */
    var _blv = GAME.npcBuildLvOf(npcCity);
    var _bcap = DATA.MAX_BLEVEL + GAME.cityBuildBonus(npcCity);
    html += '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:8px;">' +
      '城内建筑 Lv' + _blv + '（' +
      (_blv >= _bcap ? '该档上限 · 满配' : ('按城等级 · 该档上限 Lv' + _bcap)) + '）</div>';
    if (ng) {
      html += '<div class="exp-info exp-info-l" style="margin-bottom:6px;">守将　<b>' + U.escape(ng.name) + '</b>（' +
        U.escape(ng.title || '守将') + ' Lv' + ng.level + '）</div>';
    }
    html += '<div class="exp-info exp-info-l" style="margin-bottom:6px;">库藏　粮 <b>' + U.fmt(nci.res.grain) + '</b>' +
      '　木 ' + U.fmt(nci.res.wood) + '　石 ' + U.fmt(nci.res.stone) + '　铁 ' + U.fmt(nci.res.iron) +
      '　金 <b>' + U.fmt(nci.res.gold) + '</b>　人口 ' + U.fmt(nci.res.pop) + '</div>';
    html += '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:8px;">' +
      U.escape(nci.perk.name) + '：' + U.escape(nci.perk.desc) + '　·　攻占后库藏尽归我有</div>';
    /* v89.108（老板）：领地上限 —— 到顶时「占领」当场置灰 + 写明原因
       （与 battle.prepare 的硬闸同一判据 cityCapChk；侦查/掠夺不受影响，它们不产城）。 */
    var _ccAtk = GAME.cityCapChk ? GAME.cityCapChk() : { ok: true };
    if (!_ccAtk.ok) {
      html += '<div class="note-warn" style="margin-bottom:6px;">' + U.escape(_ccAtk.msg) + '</div>';
    }
    html += '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
      '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="scout">🔭 侦查</button>' +
      '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="raid">🔥 掠夺</button>' +
      '<button class="btn gold" data-action="exp-open" data-kind="city" data-mode="occupy"' +
        (_ccAtk.ok ? '' : ' disabled title="' + U.escape(_ccAtk.msg) + '"') + '>🚩 占领</button>' +
      '<button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };


  /* --------- 任务 --------- */
  /* ================= 任务（随机任务 + 成长任务 + 已完成） ================= */
  ui._showDone = false;

  /* v25（需求 11）：旧的卡片墙渲染器已删除 —— 任务列表只给一行名称，
     领取/放弃/进度全部进详情弹窗，卡片不再有使用场景。 */


  /* ============================================================
   * 通用分页（v14.1）
   * 长列表不再无限下拉：每页固定条数，翻页控件统一。
   * 用法：ui.pagerHTML(key, total, perPage) 取分页条；
   *       切片用 ui.pageOf(key, total, perPage) 返回的 from/to。
   * ============================================================ */
  ui._pages = ui._pages || {};
  ui.PAGE_SIZE = 12;
  ui.pageOf = function (key, total, perPage) {
    var size = perPage || ui.PAGE_SIZE;
    var maxPage = Math.max(1, Math.ceil((total || 0) / size));
    var cur = ui._pages[key] || 1;
    if (cur > maxPage) cur = maxPage;
    if (cur < 1) cur = 1;
    ui._pages[key] = cur;
    return { page: cur, size: size, maxPage: maxPage, from: (cur - 1) * size, to: Math.min(total || 0, cur * size) };
  };
  /* 翻页条现在**不留在内容里**，而是登记到 ui._bottom，由 renderView 收尾时
     一次性画进屏幕下方的固定条 #bottom-bar（需求 3：位置固定，不随内容滚动）。
     返回空串 —— 内容区再也不需要为翻页控件预留位置，也就不会"必须滚到底才能翻页"。 */
  ui._bottom = [];
  ui.pagerHTML = function (key, total, perPage) {
    ui._bottom.push(ui.pagerInnerHTML(key, total, perPage));
    return '';
  };
  /* 纯函数：只产出分页条的 HTML（供底部条与测试直接调用） */
  ui.pagerInnerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var btn = function (n, label, extra) {
      return '<button class="btn sm' + (extra || '') + '" data-action="page" data-key="' + key + '" data-n="' + n + '">' + label + '</button>';
    };
    var h = btn(1, '« 首页');
    h += '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page - 1) + '"' + (p.page <= 1 ? ' disabled' : '') + '>‹ 上页</button>';
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) h += btn(i, String(i), i === p.page ? ' gold' : '');
    h += '<button class="btn sm" data-action="page" data-key="' + key + '" data-n="' + (p.page + 1) + '"' + (p.page >= p.maxPage ? ' disabled' : '') + '>下页 ›</button>';
    h += btn(p.maxPage, '末页 »');
    h += '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>';
    return '<div class="pager">' + h + '</div>';
  };
  /* 画底部条：有分页就画分页，没有就留一行极淡的占位（位置照留、高度不变）。
     v85（老板）：「底部导航栏增加一个缩略地图」—— 每次落画都**固定拼**一枚 38px
     缩略图（绝对定位在条尾，不参与居中排版），点击展开「天下大势」面板。
     ⚠ 它只能在 paintBottom 里拼 —— 若在某视图 _bottom.push，会被下一次落画覆盖。 */
  ui.paintBottom = function () {
    var bar = $('#bottom-bar');
    if (!bar) return;
    var arr = ui._bottom || [];
    /* ============================================================
     * v89.151（老板 3）：底部导航栏左侧统一为 `.bb-tools` 容器（两枚**同级图标按钮**）——
     *   ① 「名称」改名随状态走：「🏷 隐藏名称」（显示中）/「🏷 显示名称」（已隐藏）；
     *   ② 新增同级菜单「⚔ 指挥战斗」= 战斗待指挥清单入口（`ui.openBattleList`）——
     *      **有正在进行的战斗时闪烁**（`.blink`，由 ui.paintWarBeacon 每秒切换，不重建 DOM）。
     * 沿用 v89.52 的定位套路（贴底栏最左、不挤占居中的分页/地图导航），
     * v89.67 的 title 规矩照旧：写清"哪些能收、哪些永远在"。
     * ============================================================ */
    var show = ui._mapShowLabels !== false;
    var lblBtn = '<button class="bb-label-toggle' + (show ? ' on' : '') +
      '" data-action="map-toggle-labels" title="' + (show
        ? '点击隐藏：野地 · 据点 · 城内建筑 的名称与等级（城池名称与等级永远显示，不受影响）'
        : '当前已隐藏 —— 点击恢复显示：野地 · 据点 · 城内建筑 的名称与等级') +
      '">🏷 ' + (show ? '隐藏名称' : '显示名称') + '</button>';
    var warBtn = '<button class="bb-war" data-action="battle-list-open" ' +
      'title="指挥战斗：查看正在进行的战斗与行军中的军队（有战斗待指挥时闪烁）">⚔ 指挥战斗</button>';
    bar.innerHTML = '<div class="bb-tools">' + lblBtn + warBtn + '</div>'
      + (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<button class="bb-mini" data-action="open-minimap" title="缩略地图：点击看天下大势">'
      + '<canvas id="mini-canvas" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas>'
      + '</button>';
    ui.paintMiniBottom();
    ui.paintWarBeacon();
  };
  /* v89.151（老板 3）：「指挥战斗（有正在进行的战斗时发生闪烁）」——
     只切 class（**不重建按钮**），主循环每秒调用；paintBottom 收尾也调一次（首绘即正确）。
     判据走唯一出口 ui.battleListOf（state === 'live'），与清单弹窗同源。 */
  ui.paintWarBeacon = function () {
    var btn = (document.querySelector ? document.querySelector('#bottom-bar .bb-war') : null);
    if (!btn || !btn.classList) return;
    var on = ui.battleListOf().length > 0;
    if (on !== btn.classList.contains('blink')) btn.classList.toggle('blink', on);
  };
  ui.setPage = function (key, n) {
    ui._pages[key] = Math.max(1, Number(n) || 1);
    GAME.refreshView();
  };

  /* ============================================================
   * 弹窗内分页（v20 · 需求 9）
   *   「弹窗里避免下拉条，改用翻页」
   *
   * ⚠ 这里有个**必须记住的坑**：ui.setPage 走的是 GAME.refreshView()，
   *   它只重绘**中央视图**。弹窗内的翻页若复用它，点了不会有任何反应 ——
   *   这与「兵营点兵种没反应」是同一类 bug。
   *   所以弹窗分页单独一套：记录当前弹窗的重绘回调，翻页时重绘弹窗。
   * ============================================================ */
  ui._modalPageRender = null;      // 当前弹窗的重绘回调（由各弹窗自己登记）
  ui.setModalPage = function (key, n) {
    ui._pages[key] = Math.max(1, Number(n) || 1);
    if (ui._modalPageRender) ui._modalPageRender();
  };
  /* 弹窗分页条（按钮走 action=mpage → ui.setModalPage） */
  ui.modalPagerHTML = function (key, total, perPage) {
    var p = ui.pageOf(key, total, perPage);
    var btn = function (n, label, off) {
      return '<button class="btn sm' + (off ? ' off' : '') + '" data-action="mpage" data-key="' + key + '" data-n="' + n + '"'
        + (off ? ' disabled' : '') + '>' + label + '</button>';
    };
    if (!total) return '<div class="pager"><span class="pg-info">暂无记录</span></div>';
    if (p.maxPage <= 1) return '<div class="pager"><span class="pg-info">共 ' + total + ' 项</span></div>';
    var h = btn(1, '« 首页', p.page <= 1) + btn(p.page - 1, '‹ 上页', p.page <= 1);
    var lo = Math.max(1, p.page - 2), hi = Math.min(p.maxPage, lo + 4);
    lo = Math.max(1, hi - 4);
    for (var i = lo; i <= hi; i++) h += btn(i, String(i), false).replace('class="btn sm"', 'class="btn sm' + (i === p.page ? ' gold' : '') + '"');
    h += btn(p.page + 1, '下页 ›', p.page >= p.maxPage) + btn(p.maxPage, '末页 »', p.page >= p.maxPage);
    h += '<span class="pg-info">第 ' + p.page + '/' + p.maxPage + ' 页 · 共 ' + total + ' 项</span>';
    return '<div class="pager">' + h + '</div>';
  };
  /* 切片 + 登记重绘回调 + 返回分页条 */
  ui.modalPage = function (key, list, perPage, renderFn) {
    var p = ui.pageOf(key, list.length, perPage);
    ui._modalPageRender = renderFn;
    return {
      slice: list.slice(p.from, p.to),
      pager: ui.modalPagerHTML(key, list.length, perPage),
      page: p.page, maxPage: p.maxPage, from: p.from,
    };
  };

  /* ============================================================
   * 任务（v25 · 需求 11）
   * ------------------------------------------------------------
   * 改前是"卡片墙"：每张卡上塞了标题 / 类型 / 说明 / 进度条 / 奖励 / 按钮 /
   * 小字引导，一屏八九张，扫一眼全是小字。
   * 改后：**列表只给名称与状态**，点名称弹出一个**固定尺寸的详情窗**，
   * 版式统一为「背景 → 需求 → 奖励 → 操作」，看哪一条都一样大。
   * ============================================================ */
  ui.tasksHTML = function () {
    var s = GAME.state;
    var sum = GAME.questSummary();
    var pool = s.quests.pool || [];
    var cap = (DATA.QUEST_DAILY && DATA.QUEST_DAILY.maxActive) || 5;

    /* 列表行（点名称进详情） */
    var rowHtml = function (o) {
      return '<div class="q-row" data-action="quest-detail"'
        + ' data-kind="' + o.kind + '" data-id="' + o.id + '">'
        + '<span class="q-row-n">' + U.escape(o.title) + '</span>'
        + (o.tag ? '<span class="q-tag ' + (o.tagCls || '') + '">' + o.tag + '</span>' : '')
        + '<span class="q-row-p">' + o.cur + ' / ' + o.goal + '</span>'
        + '</div>';
    };
    /* v69（老板「已完成的任务自动浮动到最上方，右侧直接添加领取按钮」）：
       达标任务浮到顶部「可领取奖励」块，行右侧直接挂「领取」——
       一步领取，不必再进详情；行本身仍可点（想看背景 / 奖励明细照旧）。
       按钮复用既有 action（claim-quest / claim-rand-quest），不新造出口。 */
    var readyRowHtml = function (o) {
      return '<div class="q-row ready" data-action="quest-detail"'
        + ' data-kind="' + o.kind + '" data-id="' + o.id + '">'
        + '<span class="q-row-n">' + U.escape(o.title) + '</span>'
        + (o.tag ? '<span class="q-tag ' + (o.tagCls || '') + '">' + o.tag + '</span>' : '')
        + '<span class="q-row-act"><button class="btn gold sm" data-action="'
        + (o.kind === 'random' ? 'claim-rand-quest' : 'claim-quest')
        + '" data-q="' + o.id + '">领取</button></span>'
        + '</div>';
    };
    var notReady = function (o) { return !o.ready; };

    /* ① 随机任务（每日 5 项） */
    var randItems = pool.map(function (entry) {
      var def = GAME.randomQuestDef(entry.id);
      if (!def) return null;
      return {
        kind: 'random', id: entry.id, title: def.title,
        tag: (DATA.QUEST_TYPES[def.type] || def.type), tagCls: 't-' + def.type,
        cur: GAME.randQuestAmount(entry), goal: def.goal, ready: GAME.randQuestReady(entry),
      };
    }).filter(function (o) { return !!o; });

    /* ② 成长任务（进行中） */
    var undone = (DATA.QUESTS || []).filter(function (q) { return !GAME.questDone(q); });
    var growthItems = undone.map(function (q) {
      return {
        kind: 'growth', id: q.id, title: q.title, tag: '成长', tagCls: 't-growth',
        cur: GAME.questAmount(q), goal: GAME.questGoal(q), ready: GAME.questReady(q),
      };
    });

    /* ③ 可领取（自动置顶 · 唯一出口）：随机在前、成长在后（与下方区块同序）。
       浮上去的项**不再**在各自区块重复出现 —— 一处占位，杜绝"同一件事看两遍"。 */
    var readyItems = randItems.filter(function (o) { return o.ready; })
      .concat(growthItems.filter(function (o) { return o.ready; }));
    var readyBlock = readyItems.length
      ? '<div class="q-sec q-sec-ready"><span class="q-sec-t">✅ 可领取奖励</span>'
        + '<span class="q-sec-n">' + readyItems.length + ' 项</span>'
        /* v89.89（B1 · 100+ 轮实玩期待）：一键全领 —— 逐条复用「领取」同一对出口
           （claimQuest / claimRandomQuest），汇总一条 toast，不新造结算路径。 */
        + '<button class="btn gold sm" style="margin-left:auto;" data-action="quest-claim-all">'
        + '一键全领</button></div>'
        + '<div class="q-list">' + readyItems.map(readyRowHtml).join('') + '</div>'
      : '';

    /* ④ 随机任务（剩余 · 未达标） */
    var randWait = randItems.filter(notReady);
    var randRows = randWait.map(rowHtml).join('') || (randItems.length
      ? '<div class="q-empty">本批 ' + randItems.length + ' 项均已可领取 —— 见上方「可领取奖励」。</div>'
      : '<div class="q-empty">今日随机任务已全部完成，明日再来。</div>');

    /* ⑤ 成长任务（剩余 · 未达标 · 分页） */
    var growthWait = growthItems.filter(notReady);
    var gp = ui.pageOf('growth', growthWait.length, 10);
    var growthRows = growthWait.slice(gp.from, gp.to).map(rowHtml).join('') || (undone.length
      ? '<div class="q-empty">进行中的任务均已可领取 —— 见上方「可领取奖励」。</div>'
      : '<div class="q-empty">成长任务已全部完成 —— 功业已成。</div>');

    /* ⑥ 已完成（折叠 · 分页） */
    var log = s.quests.log || [];
    var doneRows = (DATA.QUESTS || []).filter(function (q) { return GAME.questDone(q); })
      .map(function (q) { return { title: q.title, kind: '成长', cls: 't-growth', right: GAME.rewardString(q.reward) }; })
      .concat(log.filter(function (x) { return x.kind === 'random'; })
        .map(function (x) { return { title: x.title, kind: '随机', cls: '', right: ui.timeAgo(x.t) }; }));
    var dp = ui.pageOf('done', doneRows.length, 14);
    var doneList = doneRows.slice(dp.from, dp.to).map(function (r) {
      return '<div class="q-log-row"><span class="q-log-t">' + U.escape(r.title) + '</span>' +
        '<span class="q-tag ' + r.cls + '">' + r.kind + '</span><span class="q-log-r dim">' + r.right + '</span></div>';
    }).join('');

    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 任务' +
        ui.help('点任务名称查看详情（背景 / 需求 / 奖励 / 放弃）\n已完成的任务自动置顶，点右侧「领取」直接领奖\n随机任务每日 5 项，同时在手上限 ' + cap + ' 项') +
        '<span style="font-size:var(--fs-body);color:var(--text-dim);font-weight:400;">　可领取 ' + sum.ready + ' 项</span>' +
      '</div>' +

      /* v69：可领取块在最顶 —— 有奖可领优先于历史记录 */
      readyBlock +

      /* 区块顺序沿用 v16 #9 定下的「已完成 → 随机 → 成长」（v69 起可领取块置其前），
         只是把每项从"卡片墙"压成一行名称（详情进弹窗）。 */
      '<div class="q-sec"><span class="q-sec-t">已完成</span>' +
        '<span class="q-sec-n">共 ' + doneRows.length + ' 项</span>' +
        '<button class="btn sm" data-action="toggle-done-quests" style="margin-left:auto;">' + (ui._showDone ? '收起' : '展开') + '</button></div>' +
      (ui._showDone
        ? '<div class="q-done-box">' + (doneList || '<div class="q-empty">尚无已完成任务。</div>') + '</div>' + ui.pagerHTML('done', doneRows.length, 14)
        : '') +

      '<div class="q-sec" style="margin-top:16px;"><span class="q-sec-t">随机任务</span>' +
        '<span class="q-sec-n">待完成 ' + randWait.length + ' 项 · 当前 ' + pool.length + ' / ' + cap + ' 项</span>' +
        '<button class="btn sm" data-action="reroll-all-rand-ask" style="margin-left:auto;">全部换新（' + U.fmt(GAME.randQuestRerollAllCost()) + '金）</button></div>' +
      '<div class="q-list">' + randRows + '</div>' +

      '<div class="q-sec" style="margin-top:16px;"><span class="q-sec-t">成长任务 · 进行中</span>' +
        '<span class="q-sec-n">' + growthWait.length + ' 项待完成 / 共 ' + (DATA.QUESTS || []).length + ' 项</span></div>' +
      '<div class="q-list">' + growthRows + '</div>' + ui.pagerHTML('growth', growthWait.length, 10) +
      '</div>';
  };

  /* ============================================================
   * 任务详情（v25 · 需求 11）：固定尺寸 + 固定版式
   *   任务背景 → 任务需求 → 任务奖励 → 操作（领取 / 放弃）
   * ============================================================ */
  /* v89.86（整改 P-03）：任务「前往」的去处映射 —— 一处归表，入口与执行共用。
     建筑类能精确定位就精确定位（见 doQuestGo），其余按 metric 归到对应视图。 */
  ui.questJumpOf = function (def) {
    var m = (def && def.metric) || '';
    var CITY = { bldCount: 1, bldLevel: 1, buildDone: 1, res: 1, pop: 1, hearts: 1, gold: 1,
                 matTotal: 1, forgeTotal: 1, equipCount: 1, forgeKinds: 1 };
    var GEN = { recruitCount: 1, genCount: 1, heroCount: 1, rank: 1 };
    if (CITY[m]) return { view: 'city', msg: '前往城池（城内建筑 / 侧栏资源）' };
    if (m === 'extCount' || m === 'extTotal' || m === 'extLevel') return { view: 'ext', msg: '前往城外地块' };
    if (m === 'techLevel' || m === 'techTotal' || m === 'techDone') return { view: 'tech', msg: '前往书院 · 科技' };
    if (m === 'trainTotal' || m === 'troopCount' || m === 'armyTotal') return { view: 'troops', msg: '前往兵营 · 募兵' };
    if (m === 'conquerCount' || m === 'winCount' || m === 'wildCount' || m === 'cityCount') return { view: 'map', msg: '前往地图（选目标出征）' };
    if (GEN[m]) return { view: 'generals', msg: '前往将领' };
    if (m === 'tradeCount') return { view: 'shop', msg: '前往商城' };
    return null;
  };
  /* 「前往」执行：建筑类 → 城池对应格（已有该建筑直开该格；否则开建造选择器）；其余 → 切视图 + 指引 */
  ui.doQuestGo = function (kind, id) {
    var s = GAME.state;
    var def = null;
    if (kind === 'random') {
      var entry = null;
      (s.quests.pool || []).forEach(function (e) { if (e.id === id) entry = e; });
      if (entry && GAME.randomQuestDef) def = GAME.randomQuestDef(entry.id);
    } else {
      (DATA.QUESTS || []).forEach(function (q) { if (q.id === id) def = q; });
    }
    if (!def) { ui.toast('任务不存在'); return; }
    var j = ui.questJumpOf(def);
    ui.closeModal();
    if (!j) { ui.toast('按指引进行：' + (def.guide || '—')); return; }
    if (j.view === 'city' && def.sub && DATA.BUILDINGS[def.sub]) {
      var city = GAME.currentCity();
      var hit = -1, empty = -1;
      (city.cells || []).forEach(function (c, i) {
        if (c && c.build && c.build.id === def.sub && hit < 0) hit = i;
        if (c && !c.build && empty < 0) empty = i;
      });
      ui.setView('city');
      var pick = hit >= 0 ? hit : empty;
      if (pick >= 0) {
        ui.openBuildModal(pick);
        ui.toast('已定位：' + (hit >= 0 ? ((DATA.BUILDINGS[def.sub]).name + ' 所在格') : '城内空地 —— 选择要建造的建筑'));
      } else {
        ui.toast(j.msg + '（' + (def.guide || '按任务指引进行') + '）');
      }
      return;
    }
    ui.setView(j.view);
    ui.toast(j.msg + (def.guide ? '　' + def.guide : ''));
  };

  ui.openQuestDetail = function (kind, id) {
    var s = GAME.state;
    var def = null, entry = null;
    if (kind === 'random') {
      (s.quests.pool || []).forEach(function (e) { if (e.id === id) entry = e; });
      if (!entry) { ui.toast('该任务已过期'); return; }
      def = GAME.randomQuestDef(entry.id);
    } else {
      (DATA.QUESTS || []).forEach(function (q) { if (q.id === id) def = q; });
    }
    if (!def) { ui.toast('任务不存在'); return; }

    var isRandom = (kind === 'random');
    var cur = isRandom ? GAME.randQuestAmount(entry) : GAME.questAmount(def);
    var goal = GAME.questGoal(def);
    var ready = isRandom ? GAME.randQuestReady(entry) : GAME.questReady(def);
    var claimed = !isRandom && GAME.questDone(def);
    var pct = Math.max(0, Math.min(100, Math.round(cur / Math.max(1, goal) * 100)));
    var tname = isRandom ? (DATA.QUEST_TYPES[def.type] || def.type) : '成长';

    var body =
      '<div class="q-det-hero">' +
        '<span class="q-tag ' + (isRandom ? 't-' + def.type : 't-growth') + '">' + tname + '</span>' +
        '<span class="q-det-title">' + U.escape(def.title) + '</span>' +
      '</div>' +

      '<div class="q-det-sec">任务背景</div>' +
      '<div class="q-det-txt">' + U.escape(def.desc || '（无记载）') + '</div>' +

      '<div class="q-det-sec">任务需求</div>' +
      '<div class="q-det-txt">' + U.escape(GAME.questNeedText(def)) +
        '<span class="q-det-prog">　当前 ' + U.numText(cur, 0) + ' / ' + U.numText(goal, 0) + '</span></div>' +
      '<div class="q-bar"><i style="width:' + pct + '%"></i></div>' +
      (def.guide ? '<div class="q-det-tip">' + U.escape(def.guide) + '</div>' : '') +

      '<div class="q-det-sec">任务奖励</div>' +
      '<div class="q-det-txt good">' + GAME.rewardString(def.reward) + '</div>';

    var foot = '<div class="m-foot">';
    /* v89.86（整改 P-03）：任务「前往」—— 建筑类定位到城池对应格，其余切到该管事的视图 */
    if (!claimed && ui.questJumpOf(def)) {
      foot += '<button class="btn gold" data-action="quest-go" data-kind="' + (isRandom ? 'random' : 'growth')
        + '" data-id="' + def.id + '">🧭 前往</button>';
    }
    if (claimed) {
      foot += '<span class="ui-sub">已领取</span>';
    } else if (ready) {
      foot += isRandom
        ? '<button class="btn gold" data-action="claim-rand-quest" data-q="' + def.id + '">领取奖励</button>'
        : '<button class="btn gold" data-action="claim-quest" data-q="' + def.id + '">领取奖励</button>';
    }
    /* 放弃任务：随机任务可以换一条（收工本费）；成长任务不可放弃 —— 它是"功业进程" */
    if (isRandom && entry) {
      foot += '<button class="btn red" data-action="reroll-rand-quest-ask" data-q="' + def.id + '">放弃并换一条（'
        + U.fmt(GAME.randQuestRerollCost()) + '金）</button>';
    } else if (!claimed) {
      foot += '<span class="ui-sub">成长任务不可放弃（它记的是功业进程）</span>';
    }
    foot += '<button class="btn" data-action="close-modal">关闭</button></div>';

    ui.openShell({
      title: '📜 ' + def.title,
      sub: tname + (isRandom ? ' · 今日随机' : ' · 成长过程'),
      size: 'sm',
      body: body,
      foot: foot,
    });
  };

  /* 相对时间（用于已完成列表） */
  ui.timeAgo = function (t) {
    if (!t) return '';
    var d = Math.max(0, Math.round((U.now() - t) / 1000));
    if (d < 60) return d + ' 秒前';
    if (d < 3600) return Math.round(d / 60) + ' 分钟前';
    if (d < 86400) return Math.round(d / 3600) + ' 小时前';
    return Math.round(d / 86400) + ' 天前';
  };

  GAME.rewardString = function (reward) {
    var parts = [];
    for (var k in reward) {
      if (!reward[k]) continue;
      var name = '';
      if (k === 'rep') name = '声望';
      else {
        DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
        if (!name && DATA.MATERIAL_BY_ID && DATA.MATERIAL_BY_ID[k]) name = DATA.MATERIAL_BY_ID[k].name;
        if (!name) (DATA.ITEMS || []).forEach(function (it) { if (it.id === k) name = it.name; });
        if (!name) name = k;
      }
      parts.push(name + ' +' + U.fmt(reward[k]));
    }
    return parts.join(' · ') || '—';
  };

  /* --------- 统计 --------- */
  /* ============================================================
   * 统计（v23 · 需求 5）：顶栏菜单，承载**所有城池的汇总**
   * 侧栏只讲当前城池，全局数字集中到这里，两边不再打架。
   * ============================================================ */
  /* 卷轴壳：上下木轴 + 竹简底 + 朱印标题（统计 / 公文共用） */
  ui.scrollOpen = function (seal, title, right) {
    return '<div class="scroll-page">' +
      '<div class="scroll-axis"></div>' +
      '<div class="scroll-body">' +
        '<div class="scroll-title"><span class="seal">' + seal + '</span>' +
          '<span class="tx">' + title + '</span>' +
          (right ? '<span class="rq">' + right + '</span>' : '') +
        '</div>';
  };
  ui.scrollClose = function () {
    return '</div><div class="scroll-axis"></div></div>';
  };
  /* 简牍分区标题（替代 emoji 小标） */
  ui.sealH = function (label, cnt) {
    return '<div class="seal-h">' + label + (cnt ? '<span class="cnt">' + cnt + '</span>' : '') + '</div>';
  };

  /* ⛔ v89.104（老板）：「统计这个菜单好像没啥用，删掉吧，将将领，军务，任务放一起」
     —— 统计页（黄册 `statsHTML` + `lgSec`/`lgRow`）整体退役。
     为什么可以删：它当年搬走的"别处已有"三块（君主/府库/军民）现在**处处都有**，
     剩下几行汇总（疆域/在外/工役）在侧栏与各专用面板里都看得到 ——
     留一个"看一眼就没别的用"的菜单，只会让顶栏更长。 */

  ui.setRepFilter = function (v) {
    if (['all', 'win', 'lose', 'fav'].indexOf(v) < 0) return;
    ui._repFilter = v;
    ui._pages['rep'] = 1;
    ui.renderView('reports');
  };
  /* v89.89（D4）：收藏切换 —— 存进战报条目自身（s.reports[].fav，随档持久） */
  ui.toggleRepFav = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    r.fav = !r.fav;
    ui.toast(r.fav ? '已收藏该战报（「⭐ 收藏」筛选里可见）' : '已取消收藏');
    ui.renderView('reports');
  };
  ui.MSG_PER = 15;     /* 消息每页 */
  /* v89.107：战报每页 10 份。⚠️ 旧代码里 `ui.DOC_PER` **从来没定义过** ——
     `pageOf(..., ui.DOC_PER)` 悄悄回落到 PAGE_SIZE(12)，而 `n > undefined` 恒 false，
     于是**战报翻页条从来没登记过**：超过一页就只看得到头 12 份。本轮补上定义。 */
  ui.DOC_PER = 10;
  /* ============================================================
   * v89.155（老板 1）：公文**每页条数按可用高度算**（铺满到底，不再固定 15/10）
   * ------------------------------------------------------------
   * 老板原话：「公文的显示没界面底部到底，没铺满界面就分页了」。
   * ⛔ v89.157（老板 1「底部还是不到边」）**单位口径修正**：
   *   旧常量 127/104/28/24.65 是**视觉 px**（含 #app-scale 的 1.111 缩放），
   *   而 `vc.clientHeight` 是**布局 px**（不受 transform 影响）—— 两把尺混算，
   *   预算被低估 ≈11% → 每页少排 4 行、底部空 127px（实测）。
   * 实测（1600×1000 实机 · **布局值**，v89.157 重量）：
   *   #view-container 高 787px；标题+页签+chips 到消息区顶 = 114px；
   *   系统页消息行高 22.4px（任务摘要区另占 ≈93px）；
   *   战报/侦查行（.doc-bar）高 30.0px；底注（"共 N 条"）保留 19px。
   * → 系统页默认（含摘要）= (787−114−19−93)/22.2 = 25 条（余 6px · 底注贴底 ≈5px，实测）；
   *   切到单主题标签（无摘要）= 29 条；战报页 = (787−114−19)/30 = 21 份（余 22px · 底距 26px）。
   * 口径：per = floor((视图高 − 头 − 底注 − 摘要) / 行高)，下限 8 / 上限 60；
   *   余量 < 4px 时让掉一行（GUARD_H）—— 防字体度量抖动撑出滚动条（目标：底注贴底 ≤20px）。
   *   拿不到布局（桩 / jsdom）→ 回落 MSG_PER / DOC_PER（旧值保留为兜底）。
   *   ⚠️ 头/摘要/底注是**实测量值** —— 改公文版式后重跑量测并更新（改动点集中在本段）。
   * ============================================================ */
  ui.DOC_HEAD_H = 114;      /* 标题 + 页签 + chips 到消息区顶（布局 px · 实测 113.7） */
  ui.DOC_TASK_H = 93;       /* 任务摘要区（布局 px · 实测 92.8，仅「全部/任务」标签出现） */
  ui.DOC_FOOT_H = 19;       /* 底注"共 N 条"保留高度（布局 px）；.ui-page 底内边距 14px 会随之滚出 ——
                               视图页允许滚动（§30.3），且容器常驻 12px 滚动槽（scrollbar-gutter），观感不变 */
  ui.DOC_GUARD_H = 4;       /* 余量守卫：除不尽时的最小余量（不足则让掉一行，防抖动溢出） */
  ui.DOC_LINE_H = { sys: 22.2, war: 30.0, scout: 30.0 };   /* 行高（布局 px · 实机重量 22.18/30.0） */
  ui.docPerOf = function (kind) {
    var fb = (kind === 'sys') ? ui.MSG_PER : ui.DOC_PER;
    var vcH = 0;
    try {
      var vc = document.getElementById('view-container');
      if (vc && vc.clientHeight) vcH = vc.clientHeight;
    } catch (e) { vcH = 0; }
    if (!vcH) vcH = 787;      /* 标准画布（1440×900）的实测值兜底 */
    var avail = vcH - ui.DOC_HEAD_H - ui.DOC_FOOT_H;
    if (kind === 'sys' && (ui._msgTag === 'all' || ui._msgTag === 'task')) avail -= ui.DOC_TASK_H;
    if (avail < 120) return fb;                       /* 布局异常（窗口畸形）→ 兜底 */
    var _lh = ui.DOC_LINE_H[kind] || 26;
    var _per = Math.floor(avail / _lh);
    /* v89.157：余量不足 GUARD 时让掉一行（防字体度量抖动把最后一行挤出滚动条） */
    if (_per > 1 && (avail - _per * _lh) < (ui.DOC_GUARD_H || 0)) _per--;
    return Math.max(8, Math.min(60, _per));
  };

  /* ============================================================
   * 公文（v89.107 重做）· 老板：「公文有几种报告类型，按军务那样整几个
   *   独立切换界面 —— 战报，侦查报告，烽火警报，系统消息，等」
   * ------------------------------------------------------------
   * 结构 = 与军务同一套骨架（.march-tabs 页签 + 每页一套正文，互不堆叠）：
   *   战报 = s.reports 里的战报（全部/胜/败/收藏 筛选 + 分页）
   *   侦查 = s.reports 里 type==='scout' 的回报（v89.73 起的结构化工文）
   *   烽火 = kind==='beacon' 的消息（犯境预警 / 击退或被破 / 防守计）
   *   任务 = 可领取摘要 + kind==='task' 的消息
   *   系统 = kind==='sys' 的其余提示
   * 单一来源：类别表 `DATA.MSG_KINDS`（页签名/图标/**顺序**都由它派生 ——
   *   加一行就多一个页签）；消息类别在**发射点**声明（state.js 的 GAME.log）。
   * 退役并删净（不许两套并存）：频道条 msg-channels / setMsgChannel /
   *   msgLines / msgCount / msgPager / `msg-channel` 动作 / `_msgCh` 状态。
   *   旧的"系统·战报·任务·全部"四频道是**扁平流 + 按文本猜颜色**，
   *   与"分类各自成页"是两套结构，留一个必然互相打架。
   * ============================================================ */
  /* v89.153（老板 1/2）：默认落在「系统」页（页签顺序第一 —— 系统 / 战报 / 侦查）。 */
  ui._docTab = 'sys';
  ui.docTabOf = function (id) { return DATA.MSG_KIND_BY[id] || DATA.MSG_KINDS[0]; };
  /* 报告取用：战报 / 侦查是**报告类**（读 s.reports），其余是消息类（读 kind） */
  ui.docReportsOf = function (id) {
    return (GAME.state.reports || []).filter(function (r) {
      return id === 'scout' ? r.type === 'scout' : r.type !== 'scout';
    });
  };
  ui.docCountOf = function (id) {
    if (id === 'war' || id === 'scout') return ui.docReportsOf(id).length;
    if (id === 'sys') return GAME.msgFeedOf().length;      /* v89.153：三源合一（军情/任务/系统） */
    return GAME.msgsOf(id).length;
  };
  /* ⛔ v89.153（老板 2）：「将战报中的军情……整合到系统菜单下」——
     `ui.WAR_FLOW` / `ui.warFlowOf`（战报页下半段的军情流水）整条退役：
     军情（war 类消息）现在落在**系统页**（`GAME.msgFeedOf` 三源合一 + 「军情」小标签）。 */
  /* v89.116：**公文页签只列 doc !== false 的类别**（烽火移出 —— 见 DATA.MSG_KINDS 注释）。
     唯一出口：页签渲染 / 页签切换校验 / 兜底全读它，不在别处写死类名。 */
  ui.docKinds = function () {
    return (DATA.MSG_KINDS || []).filter(function (k) { return k.doc !== false; });
  };
  ui.docTabHTML = function () {
    return '<div class="march-tabs doc-tabs">' + ui.docKinds().map(function (k) {
      return '<span class="mt' + (ui._docTab === k.id ? ' on' : '') + '" data-action="doc-tab" data-v="' +
        k.id + '" title="' + U.escape(k.desc) + '">' + k.icon + ' ' + k.name +
        '<b class="mt-n">' + ui.docCountOf(k.id) + '</b></span>';
    }).join('') + '</div>';
  };
  ui.setDocTab = function (v) {
    if (!DATA.MSG_KIND_BY[v]) return;
    /* v89.116：不在公文页签里的类别（如 beacon）不许切进去 —— 老档 `_docTab='beacon'
       会在渲染时落到"该板块已移出公文"的说明页；切换则直接拒绝（保持现状）。 */
    var _okTab = ui.docKinds().some(function (k) { return k.id === v; });
    if (!_okTab) { ui._docTab = 'sys'; ui._pages['docsys'] = 1; ui.renderView('reports'); return; }
    ui._docTab = v;
    ui._pages['doc' + v] = 1;                      /* 切页签回第 1 页（同 march-tab / bag-tab 口径） */
    ui.renderView('reports');
  };
  /* 一条报告行（战报页 / 侦查页共用；侦查不给收藏 —— 回报是"看过就够"的东西）
     v89.120：行上带 **data-rid**（稳定身份），不再带"渲染时刻的数组下标" ——
     列表在弹窗期间不重绘、而 reports 会被 unshift 位移，旧索引会指到别的报告
     （老板实测：点掠报弹出侦察报告）。取号走唯一出口 GAME.repRidOf。 */
  ui.docRepRowHTML = function (r, withFav) {
    var d = new Date(r.t);
    var rid = GAME.repRidOf(r);
    return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-rid="' + rid + '">' +
      '<span class="db-t">' + (r.underdog ? '🏅 ' : '') + U.escape(r.title) + '</span>' +
      '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      (withFav ? '<span class="db-fav' + (r.fav ? ' on' : '') + '" data-action="rep-fav" data-rid="' + rid +
        '" title="' + (r.fav ? '取消收藏' : '收藏该战报') + '">' + (r.fav ? '⭐' : '☆') + '</span>' : '') +
      '<span class="db-go">' + (withFav ? '查看 ›' : '展开 ›') + '</span></div>';
  };
  /* ============================================================
   * v89.153（老板 2）：系统页**小标签**（参考战报的 全部/胜/败）+ **主题色**
   * ------------------------------------------------------------
   * 标签 id = `GAME.msgSubOf(rec)` 的返回值（era/weather/build/gather/war/task/sys），
   * 界面三处（chips / 筛选 / 行色）全读它 —— 不另立映射表。
   * 颜色是**数据的属性**：主题色在 DATA.MSG_SUBS，大类色在 DATA.MSG_TAG_COLOR
   * （chips 与消息行都从这读；CSS 里不各写一份）。
   * ============================================================ */
  ui._msgTag = 'all';
  /* v89.157：标签序 = 军情 → 任务 → 人事 → 内政 → 建造 → 采集收获 → 市易 → 改元 → 天时 → 系统 */
  ui.MSG_TAG_ORDER = ['war', 'task', 'staff', 'admin', 'build', 'gather', 'trade', 'era', 'weather', 'sys'];
  ui.msgTagNameOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].name;
    return DATA.MSG_TAG_NAME[tag] || (DATA.MSG_KIND_BY[tag] ? DATA.MSG_KIND_BY[tag].name : tag);
  };
  ui.msgTagColorOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].color;
    return DATA.MSG_TAG_COLOR[tag] || 'var(--text-dim)';
  };
  /* 小标签行：**全部** + 有消息的标签（"只列有货的" —— 与宝物页分类同一口径） */
  ui.msgTagChipsHTML = function (feed) {
    var have = {};
    (feed || []).forEach(function (r) { have[GAME.msgSubOf(r)] = 1; });
    var list = ui.MSG_TAG_ORDER.filter(function (t) { return have[t]; });
    var h = '<div class="msg-channels">' +
      '<span class="ch' + (ui._msgTag === 'all' ? ' active' : '') +
        '" data-action="msg-tag" data-v="all">全部</span>';
    list.forEach(function (t) {
      h += '<span class="ch' + (ui._msgTag === t ? ' active' : '') + '" data-action="msg-tag" data-v="' + t +
        '" style="color:' + ui.msgTagColorOf(t) + '">' +
        U.escape(ui.msgTagIconOf(t) + ' ' + ui.msgTagNameOf(t)) + '</span>';
    });
    return h + '</div>';
  };
  /* 主题色 → rgba（徽章底色用；hex 一律 #rrggbb，来自 DATA.MSG_SUBS/TAG_COLOR）。
     var(--xxx) 之类解析失败 → 回落灰（不 throw）。 */
  ui.colorA = function (hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(168,167,175,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  ui.msgTagIconOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].icon || '';
    return (DATA.MSG_TAG_ICON || {})[tag] || '';
  };
  /* 一条系统页消息行（v89.157 老板 1：「各类消息没有有效区分，或区分度不强」）——
     三处同时上色：① 左侧 3px 主题色竖条 ② 主题徽章（图标 + 名）③ 行文本（沿用 v89.153 字体色）。 */
  ui.msgLineHTML = function (l) {
    var d = new Date(l.t);
    var tag = GAME.msgSubOf(l);
    var c = ui.msgTagColorOf(tag);
    return '<div class="bb-line bb-sub" style="color:' + c + ';border-left-color:' + c + ';">' +
      '<span class="bl-t">' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      '<span class="ml-tag" style="color:' + c + ';background:' + ui.colorA(c, 0.12) +
        ';border-color:' + ui.colorA(c, 0.45) + ';">' +
        U.escape(ui.msgTagIconOf(tag) + ' ' + ui.msgTagNameOf(tag)) + '</span>' +
      U.escape(l.msg) + '</div>';
  };
  ui.setMsgTag = function (v) {
    ui._msgTag = v || 'all';
    ui._pages['docsys'] = 1;                    /* 切标签回第 1 页（同页签/背包口径） */
    ui.renderView('reports');
  };
  /* 任务可领取摘要（原「任务」页内容 · v89.153 并入系统页） */
  ui.msgTaskSummaryHTML = function () {
    var s = GAME.state, out = [];
    var sum = GAME.questSummary();
    out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '"><b>任务 · 可领取 ' +
      sum.ready + ' 项</b>（成长 ' + sum.growthReady + ' · 随机 ' + sum.randReady + '）</div>');
    (DATA.QUESTS || []).forEach(function (q) {
      if (!GAME.questDone(q) && GAME.questReady(q)) {
        out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '">· ' +
          U.escape(q.title) + '</div>');
      }
    });
    (s.quests.pool || []).forEach(function (e) {
      var d = GAME.randomQuestDef(e.id);
      if (d && GAME.randQuestReady(e)) {
        out.push('<div class="bb-line task" style="color:' + ui.msgTagColorOf('task') + '">· [随机] ' +
          U.escape(d.title) + '</div>');
      }
    });
    return '<div class="msg-log" id="msg-task">' + out.join('') + '</div>';
  };
  /* 消息流水行（烽火 / 侦查页用）：一行 = 时刻 + 文本，按类别上色
     （沿用 .bb-line 既有配色；时刻只到分 —— 一屏 15 行要扫得动） */
  ui.docLinesHTML = function (id) {
    var list = GAME.msgsOf(id);
    if (!list.length) return '';
    var pg = ui.pageOf('doc' + id, list.length, ui.MSG_PER);
    return '<div class="msg-log" id="msg-log">' + list.slice(pg.from, pg.to).map(function (l) {
      var d = new Date(l.t);
      return '<div class="bb-line ' + id + '"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
        U.pad(d.getMinutes()) + '</span>' + U.escape(l.msg) + '</div>';
    }).join('') + '</div>';
  };
  /* 各页正文（**纯内容**：主循环每秒刷新的 renderLog 也走这里；
     翻页条另由 docPagerReg 在整页渲染时登记一次 —— 每秒登记会把底栏刷爆） */
  ui.docBodyHTML = function (id) {
    var K = ui.docTabOf(id);
    /* v89.116：不进公文的类别（烽火）—— 直调（老档 _docTab 残留 / 测试）时给一句指引，
       而不是照旧渲染一套烽火流水（那正是老板要撤掉的那块）。 */
    if (K && K.doc === false) {
      /* v89.153：task 并入系统页；beacon 另有落点（军务 · 烽火）—— 按类别给不同指引 */
      if (K.id === 'task') {
        return '<div class="q-empty">📜 「任务」已并入「系统」页（v89.153）——' +
          '点上方「系统」页签，可选「任务」小标签筛选。</div>';
      }
      return '<div class="q-empty">🔥 「' + U.escape(K.name) + '」已移出公文 —— 预警与来袭流水在' +
        '「军务 · 烽火」页（点上方页签可回到公文其它板块）。</div>';
    }
    /* ---- 战报：**只列战报**（报告 · 筛选 + 分页）——军情流水 v89.153 起在「系统」页 ---- */
    if (id === 'war') {
      var rf = ui._repFilter;
      if (['all', 'win', 'lose', 'fav'].indexOf(rf) < 0) rf = 'all';
      var allRep = ui.docReportsOf('war');
      var chips = [['all', '全部'], ['win', '🏆 胜'], ['lose', '⚔️ 败'], ['fav', '⭐ 收藏']]
        .map(function (c) {
          return '<span class="ch' + (rf === c[0] ? ' active' : '') + '" data-action="rep-filter" data-v="' +
            c[0] + '">' + c[1] + '</span>';
        }).join('');
      if (!allRep.length) {
        return '<div class="q-empty">尚无战报 —— 出征 / 攻城 / 防守的战果都会记在这里' +
          '（军事流水见「系统 · 军情」）。</div>';
      }
      var hit = allRep.filter(function (r) {
        if (rf === 'win' && !r.win) return false;
        if (rf === 'lose' && r.win) return false;
        if (rf === 'fav' && !r.fav) return false;
        return true;
      });
      var pg = ui.pageOf('docwar', hit.length, ui.docPerOf('war'));
      var rows = hit.slice(pg.from, pg.to).map(function (r) {
        return ui.docRepRowHTML(r, true);      /* v89.120：身份走 rid，不再传数组下标 */
      }).join('');
      return '<div class="msg-channels">' + chips + '</div>' +
        (hit.length ? rows : '<div class="q-empty">此筛选下没有战报。</div>') +
        '<div class="ui-sub">共 ' + allRep.length + ' 份战报 · 收藏 ' +
          allRep.filter(function (r) { return r.fav; }).length + ' 份</div>';
    }
    /* ---- 侦查：回报列表（结构化工文，点开看分层情报） ---- */
    if (id === 'scout') {
      var sc = ui.docReportsOf('scout');
      var flow = ui.docLinesHTML('scout');        /* 当前无发射点，留口：将来有侦查流水也落这页 */
      if (!sc.length && !flow) return '<div class="q-empty">尚无侦查回报 —— 派斥候探一次，回报会落在这里。</div>';
      var rows = '', prev = 0;
      var pg2 = ui.pageOf('docscout', sc.length, ui.docPerOf('scout'));
      sc.slice(pg2.from, pg2.to).forEach(function (r) { rows += ui.docRepRowHTML(r, false); });
      return rows + (sc.length ? '<div class="ui-sub">共 ' + sc.length + ' 份回报 · 点一行展开分层情报</div>' : '') + flow;
    }
    /* ---- 系统：军情 / 任务 / 系统**三源合一** + 小标签筛选（v89.153 老板 2） ---- */
    if (id === 'sys') {
      var feed = GAME.msgFeedOf();
      var tag = ui._msgTag;
      if (tag !== 'all' && !feed.some(function (r) { return GAME.msgSubOf(r) === tag; })) {
        tag = 'all'; ui._msgTag = 'all';          /* 标签失效（消息被滚动清掉）→ 回落"全部" */
      }
      var hit = (tag === 'all') ? feed
        : feed.filter(function (r) { return GAME.msgSubOf(r) === tag; });
      var h = ui.msgTagChipsHTML(feed);
      /* 任务可领取摘要（原「任务」页内容）—— 只在「全部 / 任务」标签下置顶 */
      if (tag === 'all' || tag === 'task') h += ui.msgTaskSummaryHTML();   /* #msg-task：摘要区 */
      if (!feed.length) {
        return h + '<div class="q-empty">暂无消息 —— 军情 / 任务 / 内政与其余提示都会汇总到这里。</div>';
      }
      var pg = ui.pageOf('docsys', hit.length, ui.docPerOf('sys'));
      h += hit.length
        ? '<div class="msg-log" id="msg-feed">' + hit.slice(pg.from, pg.to).map(ui.msgLineHTML).join('') + '</div>'
        : '<div class="q-empty">此标签下暂无消息。</div>';
      h += hit.length ? '<div class="ui-sub">共 ' + hit.length + ' 条（军情 / 任务 / 系统三源合一 · 按最近 ' +
        GAME.msgDays() + ' 游戏天滚动保留）</div>' : '';
      return h;
    }
    /* ---- 烽火等其余消息类：流水（直调兜底） ---- */
    var rows2 = ui.docLinesHTML(id);
    if (!rows2) {
      return '<div class="q-empty">' + (id === 'beacon'
        ? '烽火未起 —— 敌军来犯前会在这里预警（烽火台等级越高，预警越早）。'
        : '暂无系统提示。') + '</div>';
    }
    return rows2;
  };
  /* 翻页条登记：**整页渲染时调一次**（不能进 docBodyHTML —— 主循环每秒会重复登记） */
  ui.docPagerReg = function (id) {
    var total, per;
    /* v89.155（老板 1）：每页条数与正文同源（docPerOf）—— 翻页条与列表不许两把尺 */
    if (id === 'war' || id === 'scout') { total = ui.docCountOf(id); per = ui.docPerOf(id); }
    else { total = ui.docCountOf(id); per = ui.docPerOf('sys'); }   /* v89.153：task 页退役，系统页照常分页 */
    if (total > per) ui.pagerHTML('doc' + id, total, per);
    return '';
  };
  ui.reportsHTML = function () {
    var id = ui._docTab, K = ui.docTabOf(id);
    /* v29（需求 6）：公文**只留报告与消息** —— 队列整段撤销：
       建造 / 募兵 → 官府弹窗「在办事项」；行军 → 顶栏「行军」；自动 → 顶栏「自动」。
       v39（需求 4）：不套卷轴壳 —— 内容只有几块，套壳就成了"框里装框"。 */
    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 公文 · ' + K.name +
        ui.help(K.desc + '\n三类独立成页（系统 / 战报 / 侦查），顶部页签切换。\n' +
          '系统页按小标签筛选：军情 / 任务 / 人事 / 内政 / 建造 / 采集收获 / 市易 / 改元 / 天时（只列有消息的）。\n' +
          '战报支持「胜 / 败 / 收藏」筛选与分页。') + '</div>' +
      ui.docTabHTML() +
      '<div id="doc-body">' + ui.docBodyHTML(id) + '</div>' +
      ui.docPagerReg(id) +
      '</div>';
  };
  /* ------------------------------------------------------------
   * 战报详情（v27 · 需求 4/5）
   * ------------------------------------------------------------
   *   ① 战况正文（含兵种损耗）
   *   ② **战斗场景** —— 文字网格：每回合一行条带，左边我军、右边敌军，
   *      中间的点就是两军之间的间距（缩到没有就接上了）
   *   ③ 回合纪要表 —— 逐回合双方兵力与间距
   *   ④ 兵种损耗表 —— 初始 / 损失 / 剩余（需求 4 的正面回答）
   * ------------------------------------------------------------ */
  /* ============================================================
   * v89.102（老板需求 2）：战报**沙盘**（固定沙盘 · 逐兵种逐帧）
   * ------------------------------------------------------------
   * 老板原话：「战斗报告的界面大一点，分回合回放创建一个固定沙盘，界面为战场，
   *   左侧为我方各兵种及数量，竖排，逐个兵种以一小图标显示（就兵种图标）
   *   附带动作和目标选项框。右侧则为敌军兵种……回放精细度更高一点，
   *   每个兵种的移动和攻击作为一帧……如此直至一方兵员消耗完毕」。
   *
   * 格局（max 档 = 铺满视口；**不做弹窗内下拉**——泳道高度按行数自适应）：
   *   ┌ 顶栏：回合 / 间距 / 帧号 / 双方兵力 / 箭塔 ─────────────────┐
   *   │ 我方竖排（图标·兵力·动作三选·目标框）│ 沙盘 │ 敌军竖排      │
   *   └ 帧流（逐帧一行）──────────────────────────────────────────┘
   * · 沙盘 = **距离轴**：0 在左（我军出发线）→ 纵深在右（敌阵）。
   *   每支部队一条**固定泳道**，令牌只在自己那条泳道上左右移动 ——
   *   这就是"固定沙盘"：版式不随帧重排，只有令牌在动。
   * · 一帧 = 一次行动：move/retreat 走位、attack/counter/wall 结算杀伤、
   *   tower 拆塔。帧序列由**同一把引擎**重跑得出（见 battle.js sandboxOf）。
   * · 动作三选与目标框：**回放态**显示该兵种当回合的实际动作/目标（只读）；
   *   **推演态**可改 —— 改完点「完成回合」，引擎按新指令结算并出下一帧，
   *   直至一方兵员耗尽（这就是老板说的"直至一方兵员消耗完毕"）。
   * ============================================================ */
  ui._sd = null;                 /* { ri, rep, sb, i, cur, timer, mode, sim } */
  ui.SD_STANCE = { advance: '前进', hold: '驻守', retreat: '后退' };
  ui.sdTroopName = function (sb, idx) {
    var id = (idx >= 0) ? sb.ids[idx] : '';
    return (DATA.TROOPS[id] && DATA.TROOPS[id].name) || id || '';
  };

  /* 初始战场态（每个兵团一份可变副本；adv = 动作行位的推进量）
     v89.104：带 **er（有效射程）** —— 接触判定按双方位移（间距 ≤ 双方最前部队射程），
     不再用"有没有开过火"的锁（老板：「接触判定按双方位移」）。 */
  ui.sdStateInit = function (sb) {
    function cp(u) {
      /* v89.176：补 `spd`（接敌预测的推进预演要读）与 `start`（损失读数）——
         与 snapUnits/unitsInit 的字段清单对齐（v89.151 手写清单漏字段的同族教训：
         打包函数漏一个字段 = 一个功能静默失真）。 */
      return { id: u.id, name: u.name, count: u.count, adv: u.adv, spd: u.spd || 0,
        start: (u.start != null ? u.start : u.count),
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };
    }
    return { atk: (sb.init.atk || []).map(cp), def: (sb.init.def || []).map(cp),
      towers: sb.towers || 0, round: 0 };
  };
  /* 应用一帧（就地改 st；返回该帧的施动者） */
  ui.sdApply = function (st, sb, f) {
    var mine = f[1] === 0;
    var own = mine ? st.atk : st.def, foe = mine ? st.def : st.atk;
    var uid = (f[2] >= 0) ? sb.ids[f[2]] : '', tid = (f[4] >= 0) ? sb.ids[f[4]] : '';
    var k = f[3], v1 = f[5], v2 = f[6], i, u = null, t = null;
    for (i = 0; i < own.length; i++) if (own[i].id === uid) u = own[i];
    for (i = 0; i < foe.length; i++) if (foe[i].id === tid) t = foe[i];
    if (k === 'm' && u) { u.adv += v1; u.stance = 'advance'; }
    else if (k === 'r' && u) { u.adv -= v1; u.stance = 'retreat'; }
    else if ((k === 'a' || k === 'c' || k === 'w') && t) {
      t.count = Math.max(0, t.count - v1);
      t.hit = k === 'c' ? 'counter' : 'attack';
    } else if (k === 't') { st.towers = v2; }
    if (u) { u.act = k; u.actVal = v1; if (t && (k === 'a')) u.lastTgt = t.id; }
    st.round = f[0] || st.round;
    return u;
  };
  ui.sdStateAt = function (sb, k) {
    var st = ui.sdStateInit(sb);
    for (var i = 0; i < k && i < sb.frames.length; i++) ui.sdApply(st, sb, sb.frames[i]);
    return st;
  };
  /* 快照（推演态）→ 战场态；acts = 该回合事件（标出"谁动了"） */
  ui.sdStateFromSnap = function (snap, sb, acts) {
    var st = { atk: [], def: [], towers: snap.towers ? snap.towers.left : 0,
      round: snap.round || 0 };
    function cp(u) {
      /* v89.176：补 `spd`（接敌预测的推进预演要读）与 `start`（损失读数）——
         与 snapUnits/unitsInit 的字段清单对齐（v89.151 手写清单漏字段的同族教训：
         打包函数漏一个字段 = 一个功能静默失真）。 */
      return { id: u.id, name: u.name, count: u.count, adv: u.adv, spd: u.spd || 0,
        start: (u.start != null ? u.start : u.count),
        er: (u.er != null ? u.er : (u.range || 0)), range: u.range || 0,
        stance: u.stance || 'advance', target: u.target || '', act: '', lastTgt: '' };
    }
    st.atk = (snap.atk || []).map(cp);
    st.def = (snap.def || []).map(cp);
    (acts || []).forEach(function (e) {
      var list = (e.side === 'atk') ? st.atk : st.def;
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === e.id) {
          list[i].act = ({ move: 'm', retreat: 'r', attack: 'a', counter: 'c', tower: 't', wall: 'w' })[e.kind] || '';
          list[i].actVal = Math.round(e.step || e.kill || e.destroy || 0);
          if (e.kind === 'attack') list[i].lastTgt = e.targetId || '';
        }
      }
    });
    return st;
  };

  /* 一帧 → 一行文字（帧流用） */
  ui.sdLine = function (sb, f) {
    if (!f) return '';
    var D = DATA.TROOPS || {};
    var nm = ui.sdTroopName(sb, f[2]), tn = ui.sdTroopName(sb, f[4]);
    /* v89.116：`sdSideName` 现在是 (sb, side) —— 这里必须把 sb 传进去，
       否则视角是空的：守城仗里"我方"会被叫成"敌军"。 */
    var side = ui.sdSideName(sb, f[1] === 0 ? 'atk' : 'def'), k = f[3], v1 = f[5], v2 = f[6];
    if (k === 'm') return '🚶 第' + f[0] + '回合 ' + side + ' ' + nm + ' 前进 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';
    if (k === 'r') return '↩️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 后退 ' + U.numText(v1, 0) + '（最近距离 ' + U.numText(v2, 0) + '）';
    if (k === 'a') return '⚔️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' → ' + tn + '　杀伤 ' + U.numText(v1, 0);
    if (k === 'c') return '🛡️ 第' + f[0] + '回合 ' + side + ' ' + nm + ' 反击 → ' + tn + '　杀伤 ' + U.numText(v1, 0);
    if (k === 't') return '🏯 第' + f[0] + '回合 ' + side + ' ' + nm + ' 拆箭塔 ' + U.numText(v1, 0) + ' 座（余 ' + U.numText(v2, 0) + '）';
    /* 城头火力打的是**攻方**（墙在守方那一侧）→ 文字按视角给 */
    if (k === 'w') return '🏯 第' + f[0] + '回合 城头火力 → ' + (tn || ui.sdSideName(sb, 'atk')) + '　杀伤 ' + U.numText(v1, 0);
    return '';
  };

  /* 令牌在沙盘上的横向位置（%）：与本方出发线同一条映射（唯一出口 btPosPct） */
  ui.sdPct = function (side, adv, D) { return ui.btPosPct(side, adv, D); };

  /* 前线画在"最前部队**前方**"多少 %（纯画面偏移，不参与任何计算） */
  ui.SD_FL_AHEAD = 2.0;

  /* 军阵泳道（v89.103）：我方占偶数道、敌方占奇数道 —— **交错**。
     为什么交错：两军现在共用一条距离轴，交战时会走到同一 x，
     若同一泳道就会叠在一起（两个兵牌互相遮住）；交错之后
     "我方第 i 队 vs 敌方第 i 队"恰好上下相邻，接触时看得见"贴上了"。 */
  ui.sdLaneOf = function (side, i) { return i * 2 + (side === 'atk' ? 0 : 1); };
  ui.sdLanesOf = function (st) { return 2 * Math.max(st.atk.length, st.def.length); };

  /* 前线几何（唯一出口在引擎：GAME.tactic.frontsOf）——
     沙盘只是把它画出来，不在界面里另算一套。 */
  ui.sdFrontsOf = function (st, sb) {
    return GAME.tactic.frontsOf(st.atk, st.def, sb.field || 1);
  };

  /* 三条线（我军前线 / 敌军前线 / 接触线）—— 位置与可见性都由 frontsOf 决定：
     · 未接触：两条虚线各在本军最前部队前方；
     · 已接触：两条合成**一条实线**（接触线，画在两线中点）；
     · 一方被歼：线推到该方出发线（被攻入大军腹地），战斗结束。 */
  /* ============================================================
   * v89.176（老板「公文战报里的沙盘与战场沙盘进行一下统一化」）：
   * **战场三线**的唯一出口 —— 实时战场（bt-field）与战报沙盘（sd-field）
   * 共用同一份渲染（同一把 GAME.tactic.frontsOf 口径）：
   *   · 未接触：两条虚线各在本军最前部队前方；
   *   · 已接触：合成一条实线（接触线，画在两线中点）；
   *   · 一方被歼：线推到该方出发线（"被攻入腹地"）。
   * `nameOf(side)` 给称谓（战场固定"我军/敌军"；沙盘随视角）；
   * `pfx` = id 前缀（'sd-fl' / 'bt-fl' —— 两个弹窗各自独立，不抢 id）。
   * 入参 units 只须 {count, adv, er}（快照与沙盘态都满足）。
   * ============================================================ */
  ui.fieldLinesHTML = function (nameOf, atkUnits, defUnits, D, pfx) {
    var fr = GAME.tactic.frontsOf(atkUnits || [], defUnits || [], D || 1);
    var contact = fr.contact || !!fr.broke;
    var aPct = um01(ui.btPosPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD);
    var dPct = um01(ui.btPosPct('def', fr.dFront, D) - ui.SD_FL_AHEAD);
    var cPct = fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : um01(ui.sdAxisPct(fr.mid, D)));
    function el(cls, id, pct, label, show) {
      return '<div class="sd-fl ' + cls + (show ? '' : ' hide') + '" id="' + id + '"' +
        ' style="left:' + (Math.round(pct * 10) / 10) + '%;"><span>' + label + '</span></div>';
    }
    return el('atk', pfx + '-a', aPct, nameOf('atk') + '前线', !contact)
      + el('def', pfx + '-d', dPct, nameOf('def') + '前线', !contact)
      + el('hit' + (fr.broke ? ' broke' : ''), pfx + '-c', cPct,
        fr.broke ? nameOf(fr.broke) + '被攻入腹地' : '接触线', contact);
  };
  /* v89.176：**战场标尺**的唯一出口（沙盘/战场共用）——两端出发线 + 纵深读数 */
  ui.fieldScaleHTML = function (nameOf, D) {
    return '<div class="sd-scale"><span>' + nameOf('atk') + '出发线</span><span>纵深 '
      + U.numText(D || 0, 0) + '</span><span>' + nameOf('def') + '出发线</span></div>';
  };
  ui.sdLineHTML = function (st, sb) {
    /* v89.176：转发到共享出口（输出与改前逐字一致 —— 仅供既有断言/调用方兼容） */
    return ui.fieldLinesHTML(function (sd2) { return ui.sdSideName(sb, sd2); },
      st.atk, st.def, sb.field || 1, 'sd-fl');
  };
  function um01(x) { return Math.max(1, Math.min(99, x)); }

  /* 沙盘本体：泳道 + 双方令牌（绝对定位，left 过渡即位移演出） */
  ui.sdFieldHTML = function (st, sb, lane) {
    var D = sb.field || 1;
    var n = Math.max(st.atk.length, st.def.length);
    var lenes = '', toks = '';
    for (var i = 0; i < n; i++) {
      /* 一条"对阵带" = 我方第 i 队 + 敌方第 i 队（两条泳道），带底一条虚线 */
      lenes += '<div class="sd-lane" style="top:' + ((i + 1) * 2 * lane) + 'px;"></div>';
    }
    /* v89.176：接敌角标（与战场同源：contactForecast）——下一回合将交手的令牌亮圈 */
    var sdInc = {};
    try {
      var fcSd = (GAME.tactic && GAME.tactic.contactForecast)
        ? GAME.tactic.contactForecast(st.atk, st.def, D) : null;
      if (fcSd) sdInc = fcSd.engage || {};
    } catch (e) { sdInc = {}; }
    function tok(u, side, i) {
      return '<div class="sd-tok ' + side + (sdInc[side + '|' + u.id] ? ' incoming' : '') + '" id="sd-k-' + side + '-' + u.id + '"' +
        ' data-bside="' + side + '" data-troop="' + u.id + '"' +
        ' style="top:' + (ui.sdLaneOf(side, i) * lane + 2) + 'px;left:' + ui.sdPct(side, u.adv, D) + '%;">' +
        '<span class="sd-tico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b id="sd-n-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b></div>';
    }
    st.atk.forEach(function (u, i) { toks += tok(u, 'atk', i); });
    st.def.forEach(function (u, i) { toks += tok(u, 'def', i); });
    /* 底图：地形材质铺满（AI 位图，缺图则纯渐变兜底）；攻城时右缘画城墙 */
    var tex = '';
    if (GAME.icons.bitmapSrc) {
      var src = GAME.icons.bitmapSrc('terrain', 'plain');
      if (sb.place && sb.place.kind === 'wild' && sb.place.terrain) {
        src = GAME.icons.bitmapSrc('terrain', sb.place.terrain) || src;
      }
      if (src) tex = ' style="background-image:url(' + src + ')"';
    }
    /* v89.116（老板「增加右侧（我方守城）的城墙示意」）：
       城墙画在**守方那一侧**（共享轴的右端）：
         · 守城仗（ourSide='def'）：那是我方城墙 —— 带上等级文字；
         · 攻城仗（ourSide='atk'）：那是敌方城墙，照旧只画工事。
       城墙**有没有**由 `sb.wall`（守城仗必给）或箭塔数决定 —— 0 级墙 + 0 塔的空城不画。 */
    var hasWall = !!(sb.wall ? (sb.wall.lv > 0 || sb.wall.towers > 0) : (sb.towers > 0));
    var wallImg = (hasWall && GAME.icons.bitmapSrc && GAME.icons.bitmapSrc('building', 'chengqiang'))
      ? '<img class="sd-wall" src="' + GAME.icons.bitmapSrc('building', 'chengqiang') + '" alt="">' : '';
    var wallLv = (sb.wall && sb.wall.lv) || 0;
    var wallTxt = hasWall
      ? '<div class="sd-castle">🧱 ' + (ui.sdOurSide(sb) === 'def' ? '我方城墙' : '敌方城墙')
          + (wallLv > 0 ? ' Lv' + wallLv : '')
          + (sb.towers > 0 ? '　🏯 箭塔 <b id="sd-tower">' + st.towers + '</b> / ' + sb.towers : '')
        + '</div>' + wallImg : '';
    return '<div class="sd-field" id="sd-field" style="height:' + (n * 2 * lane) + 'px;">' +
      '<div class="sd-ground"' + tex + '></div>' + lenes + toks + ui.sdLineHTML(st, sb) + wallTxt +
      ui.fieldScaleHTML(function (sd2) { return ui.sdSideName(sb, sd2); }, D) +
      '</div>';
  };
  /* 泳道高度：按**总泳道数**（双方交错后 = 2 × 大的一方）自适应 ——
     保证「弹窗内不做下拉」这条硬规矩（总高上限 420px）。 */
  ui.sdLaneH = function (n) {
    var maxH = 420;
    return Math.max(20, Math.min(34, Math.floor(maxH / Math.max(1, n))));
  };

  /* ============================================================
   * v89.116（老板需求 4）：**沙盘视角** —— "哪一边是我"
   * ------------------------------------------------------------
   * 出征口径：我方 = atk（左）。来袭 / 守城口径：我方 = def（右，城墙那一侧）。
   * 一个字段决定四件事：标签（我军/敌军）、可操作侧、城墙画哪边、列宽配比。
   * 唯一出口 = 本函数组，界面各处不许再写死 'atk'。
   * ============================================================ */
  ui.sdOurSide = function (sb) { return (sb && sb.ourSide === 'def') ? 'def' : 'atk'; };
  ui.sdIsMine = function (sb, side) { return ui.sdOurSide(sb) === side; };
  /* 显示名：视角中性（"我军"永远指玩家那一侧） */
  ui.sdSideName = function (sb, side) { return ui.sdIsMine(sb, side) ? '我军' : '敌军'; };
  /* 沙盘列宽：可操作的一侧给宽列（左宽右窄 / 左窄右宽，随视角翻） */
  ui.sdBoardCols = function (sb) {
    return ui.sdOurSide(sb) === 'def' ? '190px 1fr 306px' : '306px 1fr 190px';
  };

  /* 侧栏（我方 = 可操作；敌军 = 只读） */
  ui.sdRosterHTML = function (st, sb, side, lane) {
    var list = (side === 'atk') ? st.atk : st.def;
    var foe = (side === 'atk') ? st.def : st.atk;
    var mine = ui.sdIsMine(sb, side);
    var rows = list.map(function (u) {
      var sts = '';
      if (mine) {
        sts = ['advance', 'hold', 'retreat'].map(function (s) {
          return '<span class="sd-chip' + (u.stance === s ? ' on' : '') + '" data-action="sd-stance"' +
            ' data-t="' + u.id + '" data-s="' + s + '">' + ui.SD_STANCE[s] + '</span>';
        }).join('');
      } else {
        sts = '<span class="sd-chip on ro">' + (ui.SD_STANCE[u.stance] || u.stance) + '</span>';
      }
      /* v89.149（老板 4）：与战场同一口径 —— 同兵种（默认）/ 任意 / 兵种名 / 城防箭塔，
         不写"目标："前缀；默认值照样由**引擎**给（unitsOf），这里只回显。 */
      var opts = '<option value="' + u.id + '"' + (u.target === u.id ? ' selected' : '') + '>同兵种</option>'
        + '<option value=""' + (!u.target ? ' selected' : '') + '>任意</option>';
      foe.forEach(function (d) {
        if (d.id === u.id) return;
        opts += '<option value="' + d.id + '"' + (u.target === d.id ? ' selected' : '') + '>'
          + U.escape(d.name) + '</option>';
      });
      if (st.towers > 0) {
        opts += '<option value="' + DATA.TARGET_WALL + '"' + (u.target === DATA.TARGET_WALL ? ' selected' : '') +
          '>城防箭塔</option>';
      }
      return '<div class="sd-row" data-row="' + side + '-' + u.id + '">' +
        '<span class="sd-ico">' + ((GAME.icons.forTroop && GAME.icons.forTroop(u.id)) || '') + '</span>' +
        '<b class="sd-cnt" id="sd-c-' + side + '-' + u.id + '">' + U.fmt(u.count) + '</b>' +
        '<span class="sd-chips">' + sts + '</span>' +
        (mine
          /* id 实名在册（sd-t- 前缀，与战场界面同一命名习惯） */
          ? '<select class="sd-sel" id="sd-t-' + u.id + '" data-action="sd-target" data-t="' + u.id + '">' + opts + '</select>'
          /* v89.116：敌军侧也给一行只读的"目标"读数 —— 此前整列不显示目标，
             玩家看不出"它到底在打谁" */
          : '<span class="sd-sel ro">' + ui.btTargetLabelOf(u, foe) + '</span>') +
        '</div>';
    }).join('');
    return '<div class="sd-col ' + (mine ? 'sd-mine' : 'sd-foe') + '" style="--lane:' + lane + 'px;">' + rows + '</div>';
  };

;

  ui.sdHTML = function () {
    var sd = ui._sd, sb = sd.sb, st = sd.cur;
    var lane = ui.sdLaneH(ui.sdLanesOf(st));
    var fr = ui.sdFrontsOf(st, sb);
    return '<div class="sd-top">' +
        '<span>第 <b id="sd-round">' + (st.round || 0) + '</b> / ' + sb.maxRounds + ' 回合</span>' +
        /* v89.149（老板 7）：与战场顶栏同一口径「最近距离 / 全局」 */
        '<span>最近距离 <b id="sd-gap">' + U.numText(Math.round(fr.gap), 0) + '</b> / 全局 <b>'
          + U.numText(Math.round(sb.field || 0), 0) + '</b></span>' +
        '<span id="sd-phase">' + ui.sdPhaseText(fr, sb) + '</span>' +
        '<span>帧 <b id="sd-pos">' + sd.i + '</b> / ' + sb.frames.length + '</span>' +
        '<span id="sd-side-txt">' + ui.sdSideTotals(st, sb) + '</span>' +
        /* v89.176（老板「减少伤亡」）：沙盘**损失读数**（与战场同源口径：start↔count） */
        '<span id="sd-loss">' + ui.sdLossHTML(st, sb) + '</span>' +
        '<span class="sd-hint" id="sd-hint">' + (sd.mode === 'sim'
          ? '推演：改动作/目标后点「完成回合」' : '回放：逐帧看那一仗怎么打的') + '</span>' +
      '</div>' +
      '<div class="sd-board" id="sd-board" style="grid-template-columns:' + ui.sdBoardCols(sb) + ';">' +
        ui.sdRosterHTML(st, sb, 'atk', lane) +
        ui.sdFieldHTML(st, sb, lane) +
        ui.sdRosterHTML(st, sb, 'def', lane) +
      '</div>' +
      '<div class="sd-log" id="sd-log"></div>';
  };
  /* 战况一句话（顶部）：接敌中 / 两军接触 / 被攻入腹地（战斗结束）
     v89.116：口径按**视角**给（守城仗里"被攻入腹地"的是我方守军） */
  ui.sdPhaseText = function (fr, sb) {
    if (fr.broke) return '💥 ' + ui.sdSideName(sb, fr.broke) + '被攻入腹地';
    if (fr.contact) return '⚔ 两军接触中';
    return '➤ 接敌中';
  };
  /* v89.176：沙盘损失读数（我方/敌方损失 %）——无 start 的旧沙盘态 → 空串不渲染 */
  ui.sdLossHTML = function (st, sb) {
    function calc(list) {
      var s0 = 0, s1 = 0, has = false;
      (list || []).forEach(function (u) {
        if (u.start == null) return;
        has = true; s0 += u.start || 0; s1 += u.count || 0;
      });
      return (has && s0 > 0) ? Math.round((s0 - s1) / s0 * 100) : null;
    }
    var aP = calc(st.atk), dP = calc(st.def);
    if (aP == null && dP == null) return '';
    var mineA = ui.sdOurSide(sb) === 'atk';
    return '· 损失 我 <b id="sd-loss-m">' + ((mineA ? aP : dP) == null ? 0 : (mineA ? aP : dP))
      + '%</b> / 敌 <b id="sd-loss-f">' + ((mineA ? dP : aP) == null ? 0 : (mineA ? dP : aP)) + '%</b>';
  };
  ui.sdSideTotals = function (st, sb) {
    var a = 0, d = 0;
    st.atk.forEach(function (u) { a += u.count; });
    st.def.forEach(function (u) { d += u.count; });
    var mine = ui.sdOurSide(sb) === 'atk' ? a : d;
    var foe = ui.sdOurSide(sb) === 'atk' ? d : a;
    return '我 <b id="sd-ta">' + U.fmt(mine) + '</b>　敌 <b id="sd-td">' + U.fmt(foe) + '</b>';
  };

  /* ---- 底部动态操作条（帧导航 + 推演切换；放在正文区内，随模式重绘） ---- */
  ui.sdFootHTML = function () {
    var sd = ui._sd, sb = sd.sb;
    var sim = sd.mode === 'sim';
    return '<div class="sd-foot" id="sd-foot-dyn">' +
      '<button class="btn sm" data-action="sd-first">⏮ 首帧</button>' +
      '<button class="btn sm" data-action="sd-prev">◀ 上一帧</button>' +
      '<button class="btn sm gold" id="sd-play" data-action="sd-play"' + (sim ? ' disabled' : '') + '>▶ 播放</button>' +
      '<button class="btn sm" data-action="sd-next">下一帧 ▶</button>' +
      '<input type="range" id="sd-range" class="rp-range" min="0" max="' + sb.frames.length + '" value="' + sd.i + '" step="1">' +
      '<span class="rp-pos" id="sd-slider-pos">' + sd.i + ' / ' + sb.frames.length + '</span>' +
      (sim
        ? '<button class="btn sm gold" data-action="sd-done">✅ 完成回合</button>' +
          '<button class="btn sm" data-action="sd-sim-exit">↩ 回到史实回放</button>'
        : '<button class="btn sm gold" data-action="sd-sim"' + (sb.verify ? '' : ' disabled') + '>🔮 沙盘推演</button>') +
      '</div>';
  };

  /* ---- 只改值、不重建 DOM（保 left 过渡动画；与战场界面同一手法） ---- */
  ui.sdPaint = function (frame) {
    var sd = ui._sd;
    if (!sd) return;
    var st = sd.cur, sb = sd.sb;
    [['atk', st.atk], ['def', st.def]].forEach(function (pair) {
      pair[1].forEach(function (u) {
        var k = document.getElementById('sd-k-' + pair[0] + '-' + u.id);
        if (k) {
          k.style.left = ui.sdPct(pair[0], u.adv, sb.field) + '%';
          /* 打光的部队压暗（看得见"这一支已经没了"），但令牌留位不消失 —— 版式不动 */
          if (u.count <= 0) { if (k.classList) k.classList.add('dead'); }
          else if (k.classList) k.classList.remove('dead');
        }
        var n = document.getElementById('sd-n-' + pair[0] + '-' + u.id);
        if (n) n.textContent = U.fmt(u.count);
        var c = document.getElementById('sd-c-' + pair[0] + '-' + u.id);
        if (c) c.textContent = U.fmt(u.count);
        /* 令牌被击中：闪光（复用战场界面的 .hit 动画） */
        if (u.hit && k) {
          k.classList.add('hit');
          (function (el) { setTimeout(function () { if (el.classList) el.classList.remove('hit'); }, 360); })(k);
          u.hit = '';
        }
      });
    });
    /* 动作 chips（回放 = 该兵种当回合的实际动作；推演 = 玩家指令）
       v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def 那一列） */
    (ui.sdOurSide(sb) === 'atk' ? st.atk : st.def).forEach(function (u) {
      var row = document.querySelector('#sd-board [data-row="' + ui.sdOurSide(sb) + '-' + u.id + '"]');
      if (!row) return;
      var chips = row.querySelectorAll('.sd-chip');
      var eff = sd.mode === 'sim' ? u.stance
        : (u.act === 'm' ? 'advance' : (u.act === 'r' ? 'retreat' : u.stance));
      for (var i = 0; i < chips.length; i++) {
        var s = chips[i].getAttribute('data-s');
        if (s) chips[i].className = 'sd-chip' + (s === eff ? ' on' : '');
      }
    });
    var rd = document.getElementById('sd-round');
    if (rd) rd.textContent = st.round || 0;
    /* 前线 / 接触线（与 sdLineHTML 同一套口径：引擎 frontsOf 说了算） */
    var D = sb.field || 1;
    var fr = ui.sdFrontsOf(st, sb);
    var contact = fr.contact || !!fr.broke;
    function setLine(id, pct, show, label) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.left = (Math.round(Math.max(1, Math.min(99, pct)) * 10) / 10) + '%';
      if (el.classList) { if (show) el.classList.remove('hide'); else el.classList.add('hide'); }
      var tx = el.querySelector('span');
      if (tx && label) tx.textContent = label;
    }
    setLine('sd-fl-a', ui.sdPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'atk') + '前线');
    setLine('sd-fl-d', ui.sdPct('def', fr.dFront, D) - ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'def') + '前线');
    setLine('sd-fl-c', fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : ui.sdAxisPct(fr.mid, D)),
      contact, fr.broke ? ui.sdSideName(sb, fr.broke) + '被攻入腹地' : '接触线');
    var gp = document.getElementById('sd-gap');
    if (gp) gp.textContent = U.numText(Math.round(fr.gap), 0);
    var ph = document.getElementById('sd-phase');
    if (ph) ph.textContent = ui.sdPhaseText(fr, sb);
    var ps = document.getElementById('sd-pos');
    if (ps) ps.textContent = sd.i;
    var sp = document.getElementById('sd-slider-pos');
    if (sp) sp.textContent = sd.i + ' / ' + sb.frames.length;
    var rg = document.getElementById('sd-range');
    if (rg && document.activeElement !== rg) rg.value = sd.i;
    var tw = document.getElementById('sd-tower');
    if (tw) tw.textContent = st.towers;
    var stx = document.getElementById('sd-side-txt');
    if (stx) stx.innerHTML = ui.sdSideTotals(st, sb);
    /* 帧流：本帧一行（跳帧时由 sdSet 重建近 20 行） */
    if (frame) {
      var log = document.getElementById('sd-log');
      if (log) {
        var d = document.createElement('div');
        d.className = 'sd-line';
        d.textContent = ui.sdLine(sb, frame) || ('第 ' + frame[0] + ' 回合');
        log.appendChild(d);
        while (log.children.length > 60) log.removeChild(log.firstChild);
        log.scrollTop = log.scrollHeight;
      }
    }
  };
  ui.sdRebuildLog = function () {
    var sd = ui._sd, sb = sd.sb, log = document.getElementById('sd-log');
    if (!log) return;
    var from = Math.max(0, sd.i - 19);
    var html = '';
    for (var i = from; i < sd.i; i++) {
      html += '<div class="sd-line">' + U.escape(ui.sdLine(sb, sb.frames[i])) + '</div>';
    }
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
  };

  ui.sdSet = function (k) {
    var sd = ui._sd;
    if (!sd || sd.mode === 'sim') return;
    var K = sd.sb.frames.length;
    k = U.clamp(Math.round(k), 0, K);
    var frame = (k > 0) ? sd.sb.frames[k - 1] : null;
    var seq = (k === sd.i + 1);
    if (seq && sd.cur) ui.sdApply(sd.cur, sd.sb, frame);    /* 前进一帧：增量 */
    else sd.cur = ui.sdStateAt(sd.sb, k);                   /* 跳帧：整态重建 */
    sd.i = k;
    ui.sdPaint(seq ? frame : null);
    if (!seq) ui.sdRebuildLog();
  };
  ui.sdStep = function (d) { ui.sdSet((ui._sd ? ui._sd.i : 0) + d); };
  ui.sdStop = function () {
    if (ui._sd && ui._sd.timer) clearInterval(ui._sd.timer);
    if (ui._sd) ui._sd.timer = null;
    var b = document.getElementById('sd-play');
    if (b) b.textContent = '▶ 播放';
  };
  ui.sdToggle = function () {
    var sd = ui._sd;
    if (!sd || sd.mode === 'sim') return;
    if (sd.timer) { ui.sdStop(); return; }
    var ms = (DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420;   /* 权威值在 DATA.SANDBOX（v89.116），420 仅防御 */
    if (sd.i >= sd.sb.frames.length) ui.sdSet(0);
    sd.timer = setInterval(function () {
      if (!ui._sd || ui._sd.mode !== 'replay') { ui.sdStop(); return; }
      if (ui._sd.i >= ui._sd.sb.frames.length) { ui.sdStop(); return; }
      ui.sdSet(ui._sd.i + 1);
    }, ms);
    var b = document.getElementById('sd-play');
    if (b) b.textContent = '⏸ 暂停';
  };

  /* ---- 推演：从**同一份配方**起一个真会话（引擎同一把，不是另写一套规则） ---- */
  ui.sdSimEnter = function () {
    var sd = ui._sd, sb = sd.sb;
    if (!sb.verify) { ui.toast('沙盘校验未过（史实与重跑不一致），不能推演'); return; }
    /* 视角：可操作侧由 sb.ourSide 决定（守城仗里推演的是守军） */
    var rc = sd.rep.sandbox;
    var o = JSON.parse(JSON.stringify(rc.simOpts || {}));
    /* 起点阵位照史实（否则推演一开始就与那一仗列阵不同） */
    o.stances = { atk: {}, def: {} };
    (((rc.init || {}).atk) || []).forEach(function (u) { o.stances.atk[u.id] = { s: u.s, t: u.t }; });
    (((rc.init || {}).def) || []).forEach(function (u) { o.stances.def[u.id] = { s: u.s, t: u.t }; });
    var env = null;
    try {
      /* v89.179b·P1-3：推演会话建立也装回史实加成快照（否则推演与那场仗的结算不同源）。
        rc.boost 为空（旧档/沙盘）时直接跑，与既有行为一致。 */
      env = GAME.battle.withBoost(rc.boost, function () {
        return GAME.tactic.begin(rc.atkArmy || {}, rc.gen || null, rc.scArmy || {}, rc.scVal || 0,
          rc.scGen || null, o);
      });
    } catch (e) { env = null; }
    if (!env) { ui.toast('推演会话不可用'); return; }
    ui.sdStop();
    sd.mode = 'sim';
    sd.sim = { env: env, cmds: {}, frames: [], per: [], over: false };
    sd.cur = ui.sdStateFromSnap(env.snap(), sb, []);
    sd.i = 0;
    ui.sdRepaintAll('已进入沙盘推演：改' + (ui.sdOurSide(sb) === 'def' ? '守军' : '我军')
      + '的动作 / 目标 → 点「完成回合」，直至一方兵员耗尽。');
  };
  ui.sdSimExit = function () {
    var sd = ui._sd;
    sd.mode = 'replay';
    sd.sim = null;
    sd.cur = ui.sdStateAt(sd.sb, sd.i);
    ui.sdRepaintAll('已回到史实回放。');
  };
  /* 推演推进一步（一回合） */
  ui.sdSimStep1 = function () {
    var sd = ui._sd;
    if (!sd || sd.mode !== 'sim' || !sd.sim || sd.sim.over) return;
    var sim = sd.sim, env = sim.env, sb = sd.sb;
    var _our = ui.sdOurSide(sb);
    for (var tid in sim.cmds) env.setCmd(_our, tid, sim.cmds[tid]);
    /* v89.179b·P1-3：推演每回合推进也装回史实加成快照（与 sdSimEnter 同一把尺）。 */
    var r = GAME.battle.withBoost(sd.sb.boost, function () { return env.step(); });
    if (!r) { sim.over = true; return; }
    /* 本回合的事件也压成"帧"（与回放态同一套结构）——帧流与帧号才连续 */
    (r.events || []).forEach(function (e) {
      var tgt = e.targetId || '';
      if (e.kind === 'wall' && e.hits && e.hits[0]) tgt = e.hits[0].id;
      sim.frames.push([r.r || 0, e.side === 'atk' ? 0 : 1,
        sb.ids.indexOf(e.id || ''), (GAME.battle.SANDBOX_KIND || {})[e.kind] || '?',
        tgt ? sb.ids.indexOf(tgt) : -1,
        Math.round(e.step || e.kill || e.destroy || 0),
        Math.round(e.kind === 'tower' ? (e.left || 0) : (e.gap || 0))]);
    });
    sim.per.push([r.r, r.a, r.d, r.gap]);
    sim.over = !!r.over;
    sd.cur = ui.sdStateFromSnap(r.snap || env.snap(), sb, r.events || []);
    sd.i = sim.frames.length;
    ui.sdPaint(sim.frames[sim.frames.length - 1] || null);
    if (sim.over) ui.sdSimEnd();
  };
  /* 推演结束：史实 vs 推演 对照 */
  ui.sdSimEnd = function () {
    var sd = ui._sd, sb = sd.sb, sim = sd.sim;
    var fin = null;
    try { fin = sim.env.finish(); } catch (e) { fin = null; }
    if (!fin) return;
    var h = sb.hist || {};
    var log = document.getElementById('sd-log');
    if (log) {
      var d = document.createElement('div');
      d.className = 'sd-line sd-fin';
      /* v89.116：对照按视角给（"我损"= 我方那一侧的损失） */
      var _o = ui.sdOurSide(sb) === 'atk';
      d.textContent = '🏁 推演结束：' + fin.rounds + ' 回合　我军损失 '
        + U.numText(_o ? fin.atkLoss : fin.defLoss, 0)
        + '　敌军损失 ' + U.numText(_o ? fin.defLoss : fin.atkLoss, 0)
        + '（史实：' + (h.rounds || 0) + ' 回合　我损 ' + U.numText(_o ? (h.atkLoss || 0) : (h.defLoss || 0), 0)
        + '　敌损 ' + U.numText(_o ? (h.defLoss || 0) : (h.atkLoss || 0), 0) + '）';
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
    }
    var hint = document.getElementById('sd-hint');
    if (hint) hint.textContent = '推演已结束（一方兵员耗尽 / 满 30 回合）——「回到史实回放」可对照原仗';
  };
  /* 整屏重画（模式切换 / 推演每回合）——此时重建 DOM 是对的（版式可能变） */
  ui.sdRepaintAll = function (hint) {
    var sd = ui._sd;
    if (!sd) return;
    var wrap = document.getElementById('sd-wrap');
    if (!wrap) return;
    wrap.innerHTML = ui.sdHTML() + ui.sdFootHTML();
    if (hint) {
      var h = document.getElementById('sd-hint');
      if (h) h.textContent = hint;
    }
    ui.sdRebuildLog();
  };
  /* ---- 指令写入（设定即生效） ---- */
  ui.sdSetCmd = function (tid, patch) {
    var sd = ui._sd;
    if (!sd) return;
    /* v89.120（老板「战场推演…兵种实际行为和设定不一样」）：
       改前 replay 态**静默 return** —— 老板在默认的"史实回放"里改动作/目标，
       界面显示新选中值、设定却完全没生效（推演态本身没问题，探针实证过）。
       现在：**设定即生效** —— 回放态改设定自动进入推演；不能推演（校验未过）
       则明确拒绝并**重绘回弹**（别让 select 停在假值上）。 */
    if (sd.mode !== 'sim' || !sd.sim) {
      ui.sdSimEnter();                       /* 内部含 verify 校验与 toast */
      if (sd.mode !== 'sim' || !sd.sim) {    /* 进不去 → 不假装成功 */
        if (ui.sdRepaintAll) ui.sdRepaintAll('此战不可推演（史实与重跑不一致），设定不生效。');
        return;
      }
    }
    var c = sd.sim.cmds[tid] = sd.sim.cmds[tid] || {};
    if (patch.s) c.s = patch.s;
    if (patch.t !== undefined) c.t = patch.t;
    var u = null;
    /* v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def） */
    (ui.sdOurSide(sd.sb) === 'atk' ? sd.cur.atk : sd.cur.def).forEach(function (x) { if (x.id === tid) u = x; });
    if (u) { if (patch.s) u.stance = patch.s; if (patch.t !== undefined) u.target = patch.t; }
    ui.sdPaint(null);
  };

  /* ---- 打不开沙盘时的说明（旧档战报 / 输入不全 / 校验不过） ---- */
  ui.sdUnavailable = function (rep) {
    var rc = rep && rep.sandbox;
    var why;
    if (!rc) why = '这份战报没有沙盘数据（旧档战报）';
    else if (!rc.result || !(rc.result.rounds >= 1)) {
      why = '此战未能取到完整的开打前输入（双方列阵为空）';
    } else why = '史实与重跑不一致（战后科技 / 加成已变）';
    return '<div class="note-warn" style="margin:8px 0;">📽 逐帧沙盘不可用：' + why + ' —— 下方按关键帧回放。</div>';
  };

  /* ---- 打开沙盘（战报详情 → 新格局：max 档 + 固定沙盘） ---- */
  ui.openSandbox = function (rid) {
    var rep = GAME.repByRid(rid);
    if (!rep) return;
    ui.sdStop();
    ui._repId = rid;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) { ui.viewReportText(rid); return; }
    ui._sd = { rid: rid, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };
    ui._sd.cur = ui.sdStateInit(sb);
    ui.openShell({
      title: '🎬 沙盘 · ' + U.escape(rep.title),
      sub: '共 ' + sb.rounds + ' 回合 · ' + sb.frames.length + ' 帧（每个兵种的每次移动 / 攻击各一帧）'
        + '　·　' + (sb.verify ? '✅ 与史实逐项一致' : '⚠ 与史实不一致（战后加成已变，画面仅示意）')
        + (ui.sdOurSide(sb) === 'def'
          ? '　·　守城视角：敌在左、我在右（城墙在我方一侧；出城迎战的部队照常逐回合前进接战）'
          : ''),
      size: 'max',
      body: '<div id="sd-wrap">' + ui.sdHTML() + ui.sdFootHTML() + '</div>',
      foot: '<button class="btn" data-action="sd-text">📜 战报正文</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>',
    });
    ui.sdRebuildLog();
  };

  /* ============================================================
   * ⛔ v89.137（老板 4）：「不要全境营造总览，重复」——整条退役。
   * 删净：本面板函数 + 官府入口按钮 + 动作 open-build-ov / rush-ov /
   * rush-ov-all + 数据层 GAME.buildOverview / rushAllBuilds / buildQueueOf
   * （见 domain.js 同款墓碑）。单体提速不受影响（建筑面板「⚡ 提速」）。
   * ============================================================ */

  /* ---- 战报正文（原详情页；沙盘界面里的「📜 战报正文」走这里） ---- */
  /* v89.119：战报正文页的**去重** —— 简报里由 battle.js 写出的「【兵种损耗】…」
     段，与下方结构化表（rp-tbl）是同一份信息的两次呈现（实机量：251px 的简报里
     约 110~150px 是它，而整页在 13 回合 / 7 兵种的载荷下溢出 200px+）。
     这里只在**渲染时**剥掉文本版；`report.body` 本体不动 ——
     列表摘要 / 旧存档等其它入口照旧能看到损耗。 */
  /* ============================================================
   * v89.150（老板 3）：「战报正文里不要**分回合回放**、**回合纪要**这 2 个板块。
   *   保留/设置：**战斗总结，战斗收获，兵种损耗**。其中目前的战斗总结和收获太杂乱了，
   *   组织一下分类分行呈现」
   * ------------------------------------------------------------
   * 改前：正文是一整块灰底文本（主文＋经验＋声望＋事件＋战利品全混在一起），
   *   下面接「分回合回放」「回合纪要」「兵种损耗」三块 —— 前两块逐回合刷屏。
   * 改后只剩**三块**，且前两块分类分行：
   *   ① 战斗总结 —— 每行一条（胜负 / 将领 / 回合 / 双方损失 + 斗将·计谋·撤退·围攻）
   *   ② 战斗收获 —— **两列网格（类别 │ 内容）**：经验 / 声望 / 战利品 / 材料 / 军械 /
   *      俘虏 / 运力 / 备注 —— 一行一类，扫读即可
   *   ③ 兵种损耗 —— 结构化表（原样保留）
   * 分段走唯一出口 `ui.reportSectOf`（正文格式由 battle.js 的 reportText/report 一处生成，
   * 新档旧档同一把尺 —— 不解析结构化字段之外的任何东西）。
   * ============================================================ */
  /* 一行 → { label, body }：前缀形式「XXX：内容」拆两列；声望这类带 HTML 的行按文本判类。
     ⚠️ 前缀正则排除 `<` 与 `：`，保证只吃**纯文本前缀**（不误吞 HTML 标签里的冒号）。 */
  /* 事件标记**白名单**（唯一出处）：只有这些【】算"战况事件"，
     其余【】一律当主文 —— ⚠️ reportText 的 line1 就是「【城名】攻城胜利」，
     用"凡是【】都算事件"会把主文全吞掉（本补丁第一版就这么错的）。
     白名单来自全仓 grep：出征（斗将/计谋/撤退/围攻）· 守城（守土/遭劫/未破防）·
     侦查（情报层级）。 */
  ui.REPORT_EV_TAGS = { '斗将': 1, '计谋': 1, '撤退': 1, '围攻': 1,
    '守土': 1, '遭劫': 1, '未破防': 1, '情报层级': 1 };
  /* 归"收获"的标记（战利品 + 侦查顺手所得）；💡 守城的【遭劫】是损失，不归收获 */
  ui.REPORT_GAIN_TAGS = { '战利品': 1, '顺手所得': 1, '意外发现': 1, '顺手拾获': 1 };
  ui._repId = 0;                 /* v89.120：当前查看的战报**身份**（rid），不再是数组下标
                                    （v89.150：随回放块退役被误删一次，这里补回 —— 初始化仍要） */
  ui.reportSplitLine = function (t) {
    var s2 = String(t || '');
    var m = s2.match(/^([^：:<]{1,8})：\s*([\s\S]*)$/);
    if (m) return { label: m[1], body: m[2] };
    var plain = s2.replace(/<[^>]+>/g, '');
    if (/声望/.test(plain)) return { label: '声望', body: s2 };
    if (/经验/.test(plain)) return { label: '经验', body: s2 };
    return { label: '', body: s2 };
  };
  /* 正文 → 四段（唯一出口）：
       summary = 主文（胜负/将领/回合/损失）+ 不带标记的续行
       events  = 【斗将】【计谋】【撤退】【围攻】（分行、带标记）
       loss    = 【兵种损耗】段（渲染另有结构化表，此处只做归类）
       gain    = 【战利品】段（按「；」拆行）+ 经验/声望两行 */
  ui.reportSectOf = function (r) {
    var raw = String((r && r.body) || '');
    var segs = raw.split(/<br\s*\/?>/i);
    var out = { summary: [], events: [], loss: [], gain: [] };
    var cur = 'summary';
    segs.forEach(function (seg) {
      var t = String(seg || '').trim();
      if (!t) return;
      var m = t.match(/^【([^】]+)】([\s\S]*)$/);
      if (m) {
        var tag = m[1], rest = m[2];
        /* 白名单判类（唯一出处 ui.REPORT_EV_TAGS / REPORT_GAIN_TAGS）——
           其余【】（如「【许都】攻城胜利」）**当主文**，不进事件段。 */
        cur = (tag === '兵种损耗') ? 'loss'
          : ui.REPORT_GAIN_TAGS[tag] ? 'gain'
            : ui.REPORT_EV_TAGS[tag] ? 'events' : 'summary';
        if (cur === 'summary') { out.summary.push(t); return; }
        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行"。
             ⚠️ 必须**括号感知**：单条内部也有「；」（如"（已入许都府库；随军载重 …）"）——
             裸 split 会把一条劈成两半（第二半变成无类别的孤儿行）。 */
          ui.reportSplitSemi(rest).forEach(function (x) {
            if (String(x).trim()) out.gain.push(String(x).trim());
          });
        } else if (cur === 'loss') {
          out.loss.push(rest);
        } else {
          out.events.push('【' + tag + '】' + rest);
        }
        return;
      }
      /* 经验 / 声望两行（reportText 的 line4/line5）不带【】标记 → 按文本特征归**收获** */
      if (cur === 'summary' && (/^经验：/.test(t) || /声望<\/span> \+/.test(t))) { out.gain.unshift(t); return; }
      out[cur].push(t);
    });
    return out;
  };
  /* 「；」拆行（**括号深度感知**）：只在括号外断开 —— lootLines.join('；') 拼的行里，
     单条内部还嵌着「（…；…）」，裸 split 会把一条劈两半。 */
  ui.reportSplitSemi = function (t) {
    var out = [], cur = '', depth = 0;
    String(t || '').split('').forEach(function (ch) {
      if (ch === '（' || ch === '(') depth++;
      else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
      if (ch === '；' && depth === 0) { if (cur.trim()) out.push(cur); cur = ''; return; }
      cur += ch;
    });
    if (cur.trim()) out.push(cur);
    return out;
  };
  ui.reportLinesHTML = function (lines, cls) {
    return '<div class="rp-lines ' + (cls || '') + '">' + (lines || []).map(function (t) {
      return '<div class="rp-line">' + t + '</div>';
    }).join('') + '</div>';
  };
  ui.reportGainHTML = function (lines) {
    if (!lines || !lines.length) {
      return '<div class="rp-lines"><div class="rp-line" style="color:var(--text-dim);">（此役无收获）</div></div>';
    }
    return '<div class="rp-gain">' + lines.map(function (t) {
      var sp = ui.reportSplitLine(t);
      return '<div class="rp-glabel">' + U.escape(sp.label) + '</div>' +
        '<div class="rp-gtext">' + sp.body + '</div>';
    }).join('') + '</div>';
  };

  ui.viewReportText = function (rid) {
    var r = GAME.repByRid(rid);              /* v89.120：按稳定身份取（数组位移不再错位） */
    if (!r) return;
    /* v89.102：正文页是"沙盘不可用"时的落脚点 —— 把原因写在最上面，
       不让玩家以为"回放功能坏了"（旧档战报没有配方 / 重跑与史实不一致）。 */
    var _sbNow = null;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      try { _sbNow = GAME.battle.sandboxOf(r); } catch (e) { _sbNow = null; }
    }
    ui._repId = rid;
    var _sect150 = ui.reportSectOf(r);
    var html = (_sbNow ? '' : (r.sandbox ? ui.sdUnavailable(r) : '')) +
      '<div class="gold-heading">' + U.escape(r.title) + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        new Date(r.t).toLocaleString() + '</div>';

    /* v89.94（B2 · E3）：以少胜多（以弱胜强才值得晒）+ 围攻战果（还差多少） */
    if (r.underdog) html += '<div class="rp-under">🏅 以少胜多 —— 此役以弱胜强，宜入简册</div>';
    if (r.siege) {
      html += '<div class="rp-under">🧱 围攻：本波破防 ' + r.siege.chip + '% → 守备余 '
        + Math.round(r.siege.hold) + '%（第 ' + r.siege.waves + ' 波'
        + (r.siege.broke ? ' · 城垣已破' : ' · 守军退守内城') + '）</div>';
    }

    /* ---- ① 战斗总结（分类分行） ---- */
    html += ui.sealH('战斗总结', '胜负 · 将领 · 回合 · 双方兵力');
    html += ui.reportLinesHTML(_sect150.summary, 'rp-sum');
    if (_sect150.events.length) html += ui.reportLinesHTML(_sect150.events, 'rp-evts');

    /* ---- ② 战斗收获（两列：类别 │ 内容） ---- */
    html += ui.sealH('战斗收获', '经验 · 声望 · 战利品');
    html += ui.reportGainHTML(_sect150.gain);

    /* ---- ③ 兵种损耗表（初始 → 剩余，逐项核对） ---- */
    var bk = ui._reportLoss(r);
    if (bk) {
      html += ui.sealH('兵种损耗', '初始 → 剩余（损失）');
      html += '<table class="tbl rp-tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
        '<th>我方剩余</th><th>敌军初始</th><th>敌军损失</th><th>敌军剩余</th></tr></thead><tbody>';
      bk.ids.forEach(function (id) {
        var nm = DATA.TROOPS[id] ? DATA.TROOPS[id].name : id;
        html += '<tr><td>' + nm + '</td>' +
          '<td class="num">' + U.numText(bk.as[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--red-light);">' + (bk.al[id] ? '−' + U.numText(bk.al[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.as[id] || 0) - (bk.al[id] || 0), 0) + '</td>' +
          '<td class="num">' + U.numText(bk.ds[id] || 0, 0) + '</td>' +
          '<td class="num" style="color:var(--green-ok);">' + (bk.dl[id] ? '−' + U.numText(bk.dl[id], 0) : '—') + '</td>' +
          '<td class="num">' + U.numText((bk.ds[id] || 0) - (bk.dl[id] || 0), 0) + '</td></tr>';
      });
      html += '</tbody></table>';
    }

    /* v89.102（老板「侦查报告不要自动冒出来」）：侦查公文里留一个**手动入口** ——
       自动弹窗退役了，但"当场那份分层情报"（已解锁的准确值 + 未解锁的锁定行）
       必须还能一键看全，否则等于把功能删了。 */
    if (r.type === 'scout' && r.scout) {
      html += '<div style="text-align:center;margin-top:12px;">' +
        '<button class="btn gold" data-action="scout-open">🔭 展开侦查面板（分层情报）</button></div>';
    }

    /* v89.102（老板「战斗报告的界面大一点」）：沙盘入口摆在最上面（一仗打完先看怎么打的），
       正文页也升到 xxl 档 */
    /* v89.157（老板「逐回合文字复盘」）：顶部入口行 = 沙盘（有配方才给）+ 逐回合文字（有回合记录才给）——
       文字数据走唯一出口 GAME.battle.roundLinesOf（与关键帧摘要同源）；
       正文页仍只有 战斗总结 / 战斗收获 / 兵种损耗 三块，文字复盘在独立弹窗里分页。 */
    var _rl157 = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
    var _top157 = '';
    if (r.sandbox) {
      _top157 += '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>';
    }
    if (_rl157.length >= 2) {
      _top157 += (r.sandbox ? '　' : '') +
        '<button class="btn' + (r.sandbox ? '' : ' gold') + '" data-action="report-rounds" data-rid="' + rid + '">' +
        '📜 逐回合文字复盘（' + _rl157.length + ' 回合）</button>';
    }
    if (_top157) html = '<div style="text-align:center;margin:0 0 8px;">' + _top157 + '</div>' + html;
    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    /* v89.112（老板：「小小弹窗，一堆右侧下拉条」）：战报详情**一律 xxl** ——
       旧逻辑只对 war 用 xxl，defense/scout 落在默认 md(660×620)：
       防战报（总结 + 收获 + 损耗表）在 md 里溢出且**双层滚动**。
       v89.150（老板 3）：删掉回放/纪要两块后信息量下降，但仍保留 tall（长战报不挤）。 */
    ui.openModal(html, { size: 'xxl', tall: true });
  };

  /* v89.157（老板「逐回合文字复盘」）：**逐回合文字**的独立弹窗 ——
     每回合一行（唯一出口 GAME.battle.roundLinesOf），弹窗内分页（每页 12 回合）；
     与正文页三块互不干扰（老板 v89.150：「不要分回合回放、回合纪要这 2 个板块」）。 */
  ui.REPORT_ROUND_PER = 12;
  ui.openReportRounds = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    var lines = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
    if (!lines.length) { ui.toast('这份战报没有逐回合记录（旧档战报或非战斗类）'); return; }
    var pg = ui.modalPage('rtr' + rid, lines, ui.REPORT_ROUND_PER, function () { ui.openReportRounds(rid); });
    var html = '<div class="gold-heading">📜 逐回合文字复盘</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        U.escape(r.title) + '　·　共 ' + lines.length + ' 回合（一回合一行 · 措辞与关键帧同源）</div>' +
      '<div class="rt-rounds">' +
        pg.slice.map(function (t) {
          return '<div class="rt-round">' + U.escape(t) + '</div>';
        }).join('') +
      '</div>' + pg.pager +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
  };

  /* v89.102：战报入口路由 —— 战斗类公文（有沙盘配方）直接进**大沙盘**；
     侦查/旧档及其它仍走正文页。两页之间可互相跳（正文页顶部有沙盘按钮）。 */
  ui.viewReport = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    if (r.sandbox && GAME.battle && GAME.battle.sandboxOf) {
      var sb = null;
      try { sb = GAME.battle.sandboxOf(r); } catch (e) { sb = null; }
      if (sb && sb.frames.length) { ui.openSandbox(rid); return; }
    }
    ui.viewReportText(rid);
  };

  /* 从战报正文里解析不出损耗明细，所以由 battle.js 写进 report.loss。
     这里只做取值与整理（老战报没有该字段时返回 null，界面自然不显示该段）。 */
  ui._reportLoss = function (r) {
    var L = r && r.loss;
    if (!L) return null;
    var ids = {};
    [L.atkStart, L.atkLoss, L.defStart, L.defLoss].forEach(function (m) {
      Object.keys(m || {}).forEach(function (k) { ids[k] = 1; });
    });
    var list = Object.keys(ids);
    if (!list.length) return null;
    return { ids: list, as: L.atkStart || {}, al: L.atkLoss || {}, ds: L.defStart || {}, dl: L.defLoss || {} };
  };

  /* ============================================================
   * 设置（v29 · 需求 5）
   * ------------------------------------------------------------
   * ① 「时间倍率 / 显示比例 / 税率」三行**改用同一套点选控件**（ui.chips）——
   *    改前时间倍率是 <button>、显示比例是 chip、税率又是 <button>：
   *    三行三个模样，明明都是"从几个百分数里挑一个"。
   * ② ~~三个自动化开关并排一行~~ → **v36 整段撤出**：
   *    自动化只在「自动」菜单（开关 + 全部参数同处一地）。
   *    设置页该管"一次性偏好"（倍率/比例/税率）与存档，不管自动化。
   * ③ 「存档 / 新游戏」留在这里（顶栏的那一份已删）。
   * ============================================================ */
  /* ⛔ v89.115：`ui.autoSwitchBtn` 退役 —— 自动化界面改成「左名单 + 右详情」后，
     开关按钮由 `ui.autoPaneHTML` 的 ap-head 统一画（每个功能一个，样式同一处），
     这个"并排开关条"的零件没有消费点了（audit 死函数门禁抓的正是它）。 */
  /* ============================================================
   * v89.115（老板）：「整合界面，左三分之一为自动功能列表（简洁），
   *   右侧三分之二为介绍展示和详细设置面板（类似将领界面），
   *   通过切换左侧自动化功能浏览和设置」+「自动菜单增加一个自动治疗伤兵」
   * ------------------------------------------------------------
   * 版式 = 将领界面同款左右分栏（.auto-grid：左 1fr 名单 / 右 2fr 详情）：
   *   左 = 七项自动化的**清单**（图标 + 名称 + 开/关圆点 + 一行摘要）—— 简洁；
   *   右 = 选中项的**介绍 + 详细设置**（开关 / 参数 / 上次结果 / 入口）+ 红线说明。
   * 状态：`ui._autoSel`（当前选中项 id，界面态不落存档 —— 与 ui._trainTab 同类）。
   * 单一出口：开/关判据 `ui.autoOnOf(id)`、状态摘要 `ui.autoMsgOf(id)` —— 左右两侧同读它，
   *   不许各写一份（改一处两边一起对）。
   * ============================================================ */
  ui.AUTO_ITEMS = [
    { id: 'upgrade', icon: '🔨', name: '自动升级', act: 'toggle-auto-upgrade' },
    { id: 'research', icon: '📜', name: '自动研究', act: 'toggle-auto-research' },
    { id: 'march', icon: '⚔️', name: '自动出征', act: 'toggle-auto-march' },
    { id: 'lord', icon: '🧘', name: '自动练功', act: 'toggle-auto-lord' },
    /* v89.128（需求 5）：自动采集/收获（每 24 游戏小时一轮） */
    { id: 'gather', icon: '🌾', name: '自动采集/收获', act: 'toggle-auto-gather' },
    { id: 'recruit', icon: '🧲', name: '自动招募', act: 'auto-recruit-toggle' },
    { id: 'heal', icon: '🏥', name: '自动治疗', act: 'toggle-auto-heal' },
    /* v89.118（老板需求 3）：外敌来犯的**接受开关** + 介绍 + 烽火流水（从军务·烽火迁来） */
    { id: 'invasion', icon: '🔥', name: '外敌来犯', act: 'toggle-auto-invasion' },
  ];
  /* 开/关判据（唯一出口） */
  ui.autoOnOf = function (id) {
    var s = GAME.state || {};
    var cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    if (id === 'upgrade') return !!(s.settings && s.settings.autoUpgrade);
    if (id === 'research') return !!(s.settings && s.settings.autoResearch);
    if (id === 'march') return !!(cfg && cfg.on);
    if (id === 'lord') return !!(s.settings && s.settings.autoLordTrain);
    if (id === 'recruit') return !!(GAME.innAutoCfg && GAME.innAutoCfg().on);
    if (id === 'heal') return !!(s.settings && s.settings.autoHeal);
    if (id === 'gather') return !!(s.settings && s.settings.autoGather);
    if (id === 'invasion') return GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
    return false;
  };
  /* 状态摘要（唯一出口） */
  ui.autoMsgOf = function (id) {
    var s = GAME.state || {};
    if (id === 'upgrade') return (s.autoState && s.autoState.msg) || '未开启';
    if (id === 'research') return (s.autoTechState && s.autoTechState.msg) || '未开启';
    if (id === 'march') return (s.autoMarchInfo && s.autoMarchInfo.msg) || '未开启';
    if (id === 'lord') return (s.autoLordState && s.autoLordState.msg) || '未开启';
    if (id === 'gather') return (s.autoGatherState && s.autoGatherState.msg) || '未开启';
    if (id === 'recruit') {
      var c = GAME.innAutoCfg ? GAME.innAutoCfg() : null;
      return (c && c.on) ? ('门槛 ' + ((DATA.GEN_RANK_BY_ID[c.min] || {}).name || c.min)) : '未开启';
    }
    if (id === 'heal') return (s.autoHealState && s.autoHealState.msg) || '未开启';
    if (id === 'invasion') {
      if (!(GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true)) return '已拒战 —— 外敌不来犯';
      var soon = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soon || due < soon) soon = due;
      });
      if (!soon) return '已接受 · 暂无排期（城池数不够）';
      return '已接受 · 下一场 ' +
        U.dur(Math.max(0, Math.round((soon - GAME.realNow()) / 1000))) + ' 后（现实时间）';
    }
    return '';
  };
  /* 左侧清单（简洁：图标 + 名称 + 圆点 + 摘要） */
  ui.autoSideHTML = function () {
    return ui.AUTO_ITEMS.map(function (it) {
      var on = ui.autoOnOf(it.id);
      return '<div class="auto-item' + (on ? ' on' : '') + (ui._autoSel === it.id ? ' sel' : '') + '"' +
        ' data-action="auto-pick" data-key="' + it.id + '">' +
        '<span class="ai-dot"></span>' +
        '<span class="ai-ico">' + it.icon + '</span>' +
        '<span class="ai-main"><b class="ai-name">' + it.name + '</b>' +
          '<span class="ai-sub">' + U.escape(ui.autoMsgOf(it.id)) + '</span></span>' +
        '</div>';
    }).join('');
  };
  /* 右侧详情（介绍 + 详细设置） */
  /* v89.116（老板「自动治疗下放一个触发记录，如果进行了自动治疗，显示具体兵种及数量」）
     —— 触发记录：每条 = 时间 + 兵种 × 数量 + 治疗费 + 归入城池。
     数据在 `s.autoHealLog`（`GAME.autoHeal` 写入，上限 DATA.AUTO_HEAL_LOG_MAX），
     本函数只负责画（不在界面里另存一份状态）。 */
  ui.autoHealLogHTML = function () {
    var s = GAME.state || {};
    var log = s.autoHealLog || [];
    if (!log.length) {
      return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b></div>' +
        '<div class="auto-note" style="margin:0;">尚无自动治疗记录 —— 开启后每次真治成了都会记一条' +
        '（含兵种与人数）。</div></div>';
    }
    var rows = log.map(function (rec) {
      var d = new Date(rec.t || U.now());
      var by = rec.by || {};
      var items = [];
      Object.keys(by).sort(function (a, b) { return (by[b] || 0) - (by[a] || 0); }).forEach(function (k) {
        var nm = DATA.TROOPS[k] ? DATA.TROOPS[k].name : (k === 'unknown' ? '来历不明' : k);
        items.push(U.escape(nm) + ' ×' + U.numText(by[k], 0));
      });
      if (!items.length) items.push('（无兵种记录，已遣散）');
      return '<div class="res-line"><span class="lbl">🕒 ' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes())
        + ':' + U.pad(d.getSeconds()) + '</span><span class="val">'
        + (items.length ? items.join('、') : '（无兵种记录，已遣散）')
        + '　<span class="ui-sub">' + U.numText(rec.n || 0, 0) + ' 人 · ' + U.numText(rec.gold || 0, 0)
        + ' 金' + (rec.city ? ' · 归入' + U.escape(rec.city) : '') + '</span></span></div>';
    }).join('');
    return '<div class="auto-note" style="margin-top:var(--sp-4);"><b>触发记录</b>（最近 ' + log.length
      + ' 次 · 逐次列出兵种与人数）</div>' + rows;
  };

  ui.autoPaneHTML = function (id) {
    var s = GAME.state || {}, cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    var it = null;
    ui.AUTO_ITEMS.forEach(function (x) { if (x.id === id) it = x; });
    if (!it) it = ui.AUTO_ITEMS[0];
    var on = ui.autoOnOf(it.id);
    var head = '<div class="ap-head"><span class="ap-ico">' + it.icon + '</span>' +
      '<span class="ap-name">' + it.name + '</span>' +
      '<button class="btn sm' + (on ? ' gold' : '') + '" data-action="' + it.act + '">' +
      (on ? '已开启' : '已关闭') + '</button></div>' +
      '<div class="ap-state">' + U.escape(ui.autoMsgOf(it.id)) + '</div>';
    var body = '';
    if (it.id === 'upgrade') {
      body = '<div class="auto-note">按等级从低到高（<b>不再区分城内城外</b>）；' +
        '<b>每城独立建造位</b> —— 逐城遍历、各自排满（不会几座城合抢一个额度）。' +
        '某项资源不足就<b>顺延试下一项</b>，全部试遍都升不动才暂停（开关不关，资源恢复后自动继续）；' +
        '全部满级则停止。只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';
    } else if (it.id === 'research') {
      body = '<div class="auto-note">从书院当前能研究的科技里挑最便宜的一项；' +
        '资源不足则暂停等待，不影响开关状态。</div>';
    } else if (it.id === 'march') {
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<button class="btn gold" data-action="open-auto-march">⚙️ 详细配置</button>' +
          '<button class="btn" data-action="auto-march-once">⚔️ 立即出征</button>' +
          '<span class="ui-sub">距离 ' + GAME.autoMarchRadius(cfg) + ' 格　·　今日 ' +
            (cfg.todayCount || 0) + (cfg.dailyMax > 0 ? '/' + cfg.dailyMax : '（不限）') + ' 次　·　' +
            '下次 ' + (cfg.on ? ('约 ' + cfg.everyMin + ' 分钟后（或体力恢复后）') : '未开启') + '</span></div>' +
        '<div class="auto-note"><b>红线（不可关闭）</b>：' +
          '① 只派<b>空闲</b>将领，出征中/守将/采集中一律跳过；' +
          '② 体力不足以支付本次出征就不出发；' +
          '③ 器械（床弩/冲车/投石车）、斥候、辎重<b>不编入</b>自动队伍 —— ' +
          '它们拖慢行军，且是守城家底；' +
          '④ 只从<b>当前城池</b>取兵；' +
          '⑤ 已占野地与今日已攻破的据点不会被重复打。</div>';
    } else if (it.id === 'lord') {
      body = '<div class="auto-note">君主<b>体力过半</b>时自动练一次（每 30 秒最多一次）：' +
        '产修为、未到段顶还给经验。过半才练是为了<b>把体力留给玩家</b> —— ' +
        '君主的体力也是出征与演武的本钱，自动化不该把它抢光。' +
        '粮草不足或体力不足时<b>暂停但不关开关</b>，恢复后自动继续。</div>';
    } else if (it.id === 'gather') {
      var _ws128 = (s.wilds || []).filter(function (w) { return GAME.wildGarrisonTotal(w.garrison) > 0; });
      var _gn128 = GAME.gatherList().length, _gm128 = DATA.GATHER.maxActive;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">有驻军野地 <b>' + _ws128.length + '</b> · 采集队 <b>' + _gn128 + '/' + _gm128 + '</b>' +
          (s.autoGatherState && s.autoGatherState.at ? '　·　上次执行 ' + U.dur((U.now() - s.autoGatherState.at) / 1000) + '前' : '') +
          '</span></div>' +
        '<div class="auto-note">每 <b>24 游戏小时</b>一轮：先<b>自动收获</b>（满 1 游戏小时即可收，24 小时封顶），' +
          '再把<b>有驻军的可采野地</b>全部转入采集（驻军全员入队，采完自动回驻军）。' +
          '目标已有采集队 / 野地不可采 / 无驻军 → 自动跳过；与手动采集共用同一套结算出口。</div>';
    } else if (it.id === 'recruit') {
      /* 招募门槛/说明的正文由 ui.autoRecruitHTML 提供（去壳版：外壳与开关由本 pane 统一给） */
      body = ui.autoRecruitHTML();
    } else if (it.id === 'heal') {
      var n0 = s.wounded || 0;
      var fee0 = GAME.healFeeOf ? GAME.healFeeOf(n0) : n0 * 10;
      var gold0 = (GAME.res(GAME.currentCity()) || {}).gold || 0;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">伤兵 <b>' + U.fmt(n0) + '</b> 名　·　治疗费 <b>' + U.fmt(fee0) +
            '</b> 金　·　现存黄金 <b>' + U.fmt(gold0) + '</b></span>' +
          '<button class="btn" data-action="heal-wounded"' + (n0 > 0 ? '' : ' disabled') +
            '>立即治疗</button></div>' +
        '<div class="auto-note">伤兵营有伤兵、黄金够治疗费 → <b>自动治完全部</b>' +
          '（花金一次结清，15 现实秒最多尝试一次）。' +
          '黄金不足时<b>暂停但不关开关</b>，金恢复后自动继续。' +
          '治疗即归队：按兵种把伤兵加回城池，不是"清个数字"。</div>' +
        ui.autoHealLogHTML();
    } else if (it.id === 'invasion') {
      var acc = GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
      /* 最近一场（多城取最早）—— 与烽火页、预警同一批出口，界面不另算一份 */
      var soonCt = null, soonDue = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soonDue || due < soonDue) { soonDue = due; soonCt = ct; }
      });
      var need0 = (DATA.INVASION || {}).unlockCities == null ? 2 : DATA.INVASION.unlockCities;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">' + (acc
            ? (soonCt
              ? '最近一场：<b>' + U.escape(soonCt.name) + '</b> · 剩余 <b>' +
                U.dur(Math.max(0, Math.round((soonDue - GAME.realNow()) / 1000))) + '</b>（现实时间）'
              : '已接受 · 暂无排期（拥有 <b>' + need0 + '</b> 座以上城池后开始）')
            : '已拒战：烽火无排期、敌军不来（随时可重开）') + '</span>' +
          '<button class="btn" data-action="go-beacon">🔥 去烽火页看预警与布防</button></div>' +
        '<div class="auto-note"><b>开关含义</b>：<b>开启</b> = 接受外敌来犯 —— ' +
          '诸方势力按<b>现实时间</b>轮番来袭；被击破会损资源 / 兵力 / 城墙等级，' +
          '守城得手则有俘获。' +
          '<b>关闭</b> = 拒战 —— 不再有任何来犯与预警（也没有守城俘获）。' +
          (acc ? '' : '<br><b style="color:var(--red-light);">当前：拒绝来犯</b> —— 想恢复历练点上面的按钮重开。') +
        '</div>' +
        ui.invasionRulesHTML() +
        ui.beaconFlowHTML();
    }
    return head + body;
  };
  /* 组装：左 1/3 名单 + 右 2/3 详情 */
  ui.autoHTML = function () {
    if (!ui._autoSel) ui._autoSel = 'upgrade';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🤖 自动化' +
        ui.help('左侧切换自动化功能，右侧看介绍与详细设置。\n' +
          '七项彼此独立；「暂停」只发生在资源/条件不足时 —— 开关不会自己关掉。\n' +
          '自动出征只派空闲将领、器械与斥候不编入，且只从当前城池取兵。') +
      '</div>' +
      '<div class="auto-grid">' +
        '<div class="auto-side">' + ui.autoSideHTML() + '</div>' +
        '<div class="auto-pane">' + ui.autoPaneHTML(ui._autoSel) + '</div>' +
      '</div></div>';
  };
  /* 点选控件（时间倍率 / 税率）—— 与显示比例同款，全站一套 */
  /* ⛔ v89.104：`ui.optBar` 退役 —— 它只服务"设置页税率"那一个点选行，
     税率已移到侧栏（−/＋ 就地调），点选行随之退场。 */

  /* --------- 设置 --------- */

  /* ============================================================
   * v67 · 存档管理面板
   * ------------------------------------------------------------
   * 一屏放 7 个槽位 + 导入区，**不出下拉条**（老板的硬规矩）。
   * 每行的判据：有档才亮「读取/导出/删除」，空槽只留「存入」。
   * 导入走"第一个空的手动槽"，**绝不覆盖**已有档（覆盖式导入是数据事故的常见来源）。
   * ============================================================ */
  ui._svPaste = false;
  ui.svRowHTML = function (s) {
    var m = s.meta;
    var kindTxt = (s.kind === 'main' ? '主档 · 进游戏时读它'
      : (s.kind === 'auto' ? '自动备份' : '手动'));
    var sum;
    if (m) {
      sum = U.escape(m.name) + '　' + (m.era || '') + '·' + (m.yearName || '') + '年　' +
        '城 ' + m.cities + '　将 ' + m.gens + '　' + (m.size / 1024).toFixed(1) + 'KB';
      if (m.savedAt && GAME.metaTimeText) sum += '　' + GAME.metaTimeText(m.savedAt);
    } else {
      sum = '<span class="sv-empty">（空）</span>';
    }
    var b = '';
    b += '<button class="btn sm' + (s.kind === 'main' ? ' gold' : '') +
      '" data-action="save-slot-write" data-slot="' + s.id + '">存入</button>';
    if (m) {
      if (s.kind !== 'auto') b += '<button class="btn sm" data-action="save-slot-load" data-slot="' + s.id + '">读取</button>';
      b += '<button class="btn sm" data-action="save-slot-export" data-slot="' + s.id + '">导出</button>';
    }
    if (s.kind !== 'main') {
      b += '<button class="btn sm dim" data-action="save-slot-drop" data-slot="' + s.id + '"' +
        (m ? '' : ' disabled') + '>清空</button>';
    }
    return '<div class="sv-row"><div class="sv-n">' + s.name +
      '<div class="sv-s">' + kindTxt + '</div></div>' +
      '<div class="sv-s">' + sum + '</div><div class="sv-b">' + b + '</div></div>';
  };
  ui.openSaveManager = function () {
    var list = GAME.slotList();
    var body = ui.help('存档存在本浏览器里（localStorage）：关网页、关浏览器都还在，' +
      '但**换浏览器、清缓存、或换一个打开方式**（双击文件 vs 本地服务）就看不到了。' +
      '要带走就用「导出」，在另一台机器上用「导入」——导入只会写进空的手动槽，不会覆盖你已有的档。') +
      '<div class="sv-list">' + list.map(ui.svRowHTML).join('') + '</div>' +
      '<div class="sv-imp">' +
        '<div class="auto-line">' +
          '<button class="btn sm" data-action="save-import-file">📂 选择存档文件…</button>' +
          '<button class="btn sm" data-action="save-import-toggle">' +
            (ui._svPaste ? '收起粘贴框' : '✍️ 粘贴存档文本…') + '</button>' +
        '</div>' +
        (ui._svPaste
          ? '<textarea id="sv-paste" class="sv-ta" placeholder="把导出的存档文本整段粘贴到这里"></textarea>' +
            '<div class="auto-line" style="margin-top:6px;">' +
            '<button class="btn sm gold" data-action="save-import-text">导入</button></div>'
          : '') +
      '</div>';
    ui._modalKind = 'saves';
    ui.openShell({
      title: '💾 存档管理', sub: '主档 + 3 手动槽 + 3 自动备份',
      body: body, size: 'xl',
      /* ⚠️ openShell 的 foot 是 **HTML 字符串**（modalShell 直接拼接），不是数组 */
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  ui.settingsHTML = function () {
    /* ============================================================
     * v89.104（老板）：「设置界面的内容搞紧凑一点，就这么几样东西都搞出下拉框来了」
     *   ＋「设置里不要音效」＋「存档管理有两处，统一一下」
     *   ＋「税率调整直接放左侧统计栏的税率处」＋「离线推进上限解除，设置里不要这个」
     *   ＋「显示比例…连续拖动 80%-120%」
     * ------------------------------------------------------------
     * 结果：设置页只剩 **四行**（显示比例 / 时间倍率 / 界面主题 / 存档管理），
     * 全部就地点选（chips）或拖动（range），没有下拉框；
     * 音效、离线上限、税率三块整体撤出（音效一律不播、离线上限=不限、税率移到侧栏）。
     * ============================================================ */
    var s = GAME.state;
    var ts = s.settings.timeScale || 1;
    var z = Math.max(ui.ZOOM_MIN, Math.min(ui.ZOOM_MAX, ui.zoom()));
    var nSlot = 0;
    GAME.slotList().forEach(function (x) { if (x.meta) nSlot++; });
    return '<div class="ui-page">' +
      '<div class="gold-heading">⚙️ 设置</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🔍 显示比例</span><span class="val" id="zoom-txt">' + z + '%</span></div>' +
        '<div class="auto-line">' + ui.zoomBarHTML() + '</div>' +
      '</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">⏱️ 时间倍率</span><span class="val">' + ts + '×</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'timescale',
          opts: [1, 10, 30, 120, 300, 600].map(function (v) {
            return { v: v, on: ts === v, label: v + '×' };
          })
        }) + '</div>' +
      '</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🎨 界面主题</span><span class="val">' +
          ui.themeDef(ui.theme()).name + '</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'theme',
          opts: (DATA.THEMES || []).map(function (t) {
            return { v: t.id, on: ui.theme() === t.id, label: t.name };
          })
        }) + '</div>' +
      '</div>' +
      /* 存档管理：**唯一入口**（原先页首与页尾各一张卡，现在合并成一张） */
      '<div class="set-card" style="margin-bottom:0;">' +
        '<div class="res-line"><span class="lbl">💾 存档管理</span><span class="val">' + nSlot + ' / 7 有档</span></div>' +
        '<div class="auto-line">' +
          '<button class="btn gold" data-action="open-saves">存档 / 读取 / 导出 / 导入</button>' +
          '<button class="btn" data-action="save">保存进度</button>' +
          '<button class="btn red" data-action="new-game">新游戏（清档）</button>' +
        '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">自动存档每 5 分钟一次（覆盖式写入，只保留最新一档）' +
          ui.help('存档 v3。导入走"第一个空的手动槽"，绝不覆盖已有档。') + '</div>' +
      '</div>' +
      '</div>';
  };

  /* ============================================================
   * 自动化（v29 · 需求 5）—— 顶栏「自动」菜单
   * ------------------------------------------------------------
   * 三件事放在一起：自动升级 / 自动研究 / **自动出征**。
   * 自动出征的参数（将领 · 兵力 · 目标 · 目标等级 · 出征类型 · 频率）
   * 全部在下面这六个点选行里给出，改完立即生效、下一轮按新参数执行。
   * 面板里同时把"红线"写清楚（只派空闲将、体力不足不出征、器械不编入），
   * 免得玩家以为系统会无条件地把家底打光。
   * ============================================================ */
  /* ⛔ v89.104（老板）：`autoReserveLine` 退役 —— 预算闸门与"自动研究上限"
     两个设置项整体撤除（自动化只挑候选，不再自己设线）。 */

  /* ============================================================
   * 自动出征「详细配置」弹窗（v89.65 · 老板：「自动出征精细化，
   *   根据现有出征界面形成弹窗即可……加入自动出征特有的字段」）
   * ------------------------------------------------------------
   * 版面**照抄出征面板**：同一个 .exp-grid 两栏 + .exp-sec / .exp-sel / .exp-tbl，
   * 所以两处看起来是一家人。差别只在内容：
   *   左栏 = **策略**：执行将领 / 目标与等级 / 出征方式 / 兵力与留守 / 频率与上限；
   *   右栏 = **只读编成表**：自动编队按 DATA.AUTO_MARCH.troopOrder 取，
   *          器械／斥候／辎重不编入 —— 刻意**没有输入框**：无人值守时"派多少兵"
   *          由策略决定，逐兵种手填是出征面板的事（一件事只在一个地方说）。
   * 自动出征**特有**的字段（出征面板没有的）：
   *   ① 出征频率（现实分钟节流）　② 每日次数上限　③ 城内留守兵力。
   * 「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，
   * 于是可派兵力、今日次数、守军等随之刷新（与出征面板同一套做法）。
   * ============================================================ */
  /* v89.83（老板「自动出征的界面再依据出征界面进行修整，再加入其他自动化选项。
     目标的选择可以加上距离，等级的选择直接给出等级列表，无需兵力留守这个菜单项」）
     ------------------------------------------------------------
     与出征面板的关系：**同一套版面、同一套出口**（.exp-grid 两栏 / .exp-sec / .exp-sel / .exp-tbl），
     差别只在内容 —— 出征面板是"这一趟怎么打"，这里是"无人值守时每趟都怎么打"。
       左栏 = 策略：执行将领 · 目标（类型/等级/距离）· 出征方式 · 计略 · 出征战术 · 频率与上限
       右栏 = 兵力：单次兵力 + 只读编成表 + 今日次数 / 上次结果
       底部 = 预估（与出征面板同源的 travelTime / 编队 / 守军出口）
     本轮的四处改动：
       ① 目标加**距离**（搜索半径，唯一出口 autoMarchRadius）；
       ② 等级改**按目标类型给真实等级列表**（野地/据点 1~10，名城 12/16/20/24）——
          改前一张通用表 [12,16,20,24] 在选「野地」时**一个目标都筛不出来**；
       ③ 补上出征面板有、这里缺的**计略**与**出征战术**（都走既有出口，
          计略在出发时校验、不通过则本次不用计并写明原因 —— 无人值守不能被计略卡死）；
       ④ 退役「城内留守」：它与「单次兵力」是同一件事的两种说法。
     「改完即生效」：下拉 change → 写 cfg → **就地重开本弹窗**，于是预估、可派兵、
     今日次数随之刷新（与出征面板同一套做法）。 */
  ui.amEstHTML = function (pv) {
    if (!pv) return '';
    if (!pv.ok) return '<div class="exp-info exp-info-l" style="color:var(--warn);margin-bottom:0;">' + U.escape(pv.msg) + '</div>';
    var genTxt = pv.gen ? U.escape(pv.gen.name) : '（未指定将领）';
    return '<div class="exp-info exp-info-l" style="margin-bottom:4px;">🛫 目标 <b>' + U.escape(pv.label) + '</b>' +
      '　距离 <b>' + pv.dist + '</b> 格　·　' + genTxt + ' 率 <b>' + U.numText(pv.total, 0) + '</b> 兵' +
      '　·　预计 <b style="color:var(--gold-light)">' + U.durExact(pv.travel) + '</b></div>' +
      '<div class="exp-info exp-info-l" style="margin-bottom:0;">👥 守军约 <b>' + U.numText(pv.def, 0) + '</b> 名' +
      (pv.total > 0 && pv.def > 0
        ? '　·　兵力比 <b style="color:' + (pv.total >= pv.def ? 'var(--green-ok)' : 'var(--red-light)') + ';">' +
          (pv.total / pv.def).toFixed(2) + ' : 1</b>'
        : '') + '</div>';
  };
  ui.openAutoMarch = function () {
    var s = GAME.state, A = DATA.AUTO_MARCH, cfg = GAME.autoMarchCfg();
    if (!cfg) return;
    var city = GAME.currentCity();
    var mode = GAME.battle.modeOf(cfg.mode);
    var have = city ? GAME.armyTotal(city) : 0;
    var idle = (s.generals || []).filter(function (g) { return !g.status || g.status === 'idle'; });
    var left = GAME.autoMarchTodayLeft(cfg);
    var rad = GAME.autoMarchRadius(cfg);
    var lvList = GAME.autoMarchLevelOpts(cfg);
    var pv = GAME.autoMarchPreview(cfg);

    /* 下拉行拼装（唯一出口 —— 每行同形，只这里写一次） */
    var sel = function (id, label, opts) {
      return '<div class="exp-sel"><label>' + label + '</label><select id="' + id + '">' +
        opts.map(function (o) {
          return '<option value="' + o.v + '"' + (o.on ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('') + '</select></div>';
    };

    var genOpts = (s.generals || []).map(function (g) {
      var busy = g.status && g.status !== 'idle';
      return { v: g.id, on: g.id === cfg.genId,
        label: U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : '') };
    });
    if (!genOpts.length) genOpts = [{ v: '', on: true, label: '帐下暂无将领' }];

    var tgtOpts = A.targetOptions.map(function (x) { return { v: x[0], on: cfg.target === x[0], label: x[1] }; });
    /* v89.83：等级候选按**当前目标类型**给（野地/据点 1~10；名城 12/16/20/24） */
    var lvOpts = lvList.map(function (v) {
      return { v: v, on: v === cfg.maxLevel, label: '≤ Lv' + v };
    });
    var radOpts = (A.radiusOptions || []).map(function (v) {
      return { v: v, on: v === rad, label: v + ' 格' + (v === A.defaultRadius ? '（默认）' : '') };
    });
    var modeOpts = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).map(function (m) {
      return { v: m.id, on: cfg.mode === m.id,
        label: m.icon + ' ' + m.name + '（体' + m.stamina + ' 精' + m.energy + '）' };
    });
    var schemeOpts = [{ v: '', on: !cfg.scheme, label: '未用计（不耗锦囊）' }].concat(
      (DATA.SCHEMES || []).filter(function (sc) { return sc.kind === 'attack' || sc.kind === 'march'; })
        .map(function (sc) {
          return { v: sc.id, on: cfg.scheme === sc.id,
            label: sc.icon + ' ' + sc.name + '（精' + sc.energy + ' · 囊' + sc.jinang + '）' };
        }));
    /* ⛔ v89.140（老板 7'）：`troopOpts`（单次兵力下拉的选项）随该块退役 */
    var freqOpts = A.freqOptions.map(function (v) { return { v: v, on: v === cfg.everyMin, label: v + ' 分钟' }; });
    var dailyOpts = (A.dailyOptions || [0]).map(function (v) {
      return { v: v, on: v === cfg.dailyMax, label: v ? ('每日 ' + v + ' 次') : '不限次数' };
    });

    /* 右栏编成表（v89.140 老板 7'）：「兵种编成这里保留 **3 列**：兵种、拥有（改成**驻军数量**）、
       **自动出征数量**（各兵种提供数量输入框）」——
       输入框直接写 cfg.army[tid]（`army:<tid>` 键，经 doSetAutoMarch）；
       只列"可编入"的兵种（与 autoMarchPickArmy 同口径：器械/斥候/辎重不编入）。
       v89.93 的"自动编入/顺位"只读两列随"单次兵力"一并退役。 */
    var troopBlock = '<table class="tbl exp-tbl"><colgroup>' +
      '<col class="et-c-name"><col class="et-c-own"><col class="et-c-in">' +
      '</colgroup><thead><tr><th>兵种</th><th class="num">驻军数量</th><th class="ctr">自动出征数量</th>' +
      '</tr></thead><tbody>' +
      Object.keys(DATA.TROOPS).filter(function (id) {
        var t = DATA.TROOPS[id];
        return t && !t.nocombat && !t.craft;
      }).map(function (id) {
        var tr = DATA.TROOPS[id] || {}, own = (city && city.army && city.army[id]) || 0;
        var cfgN = (cfg.army && cfg.army[id]) || 0;
        return '<tr class="et-row' + (own <= 0 ? ' off' : '') + '">' +
          '<td class="et-name">' + (tr.icon || '') + ' ' + U.escape(tr.name || id) + '</td>' +
          '<td class="et-own num">' + U.fmt(own) + '</td>' +
          '<td class="et-in"><input type="number" id="am-a-' + id + '" min="0" max="' + own + '" value="' + cfgN + '"' +
            (own > 0 ? '' : ' disabled') + '></td>' +
          '</tr>';
      }).join('') + '</tbody></table>';

    var html = '<div class="gold-heading">⚔️ 自动出征 · 详细配置' +
      '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
      '（无人值守按下列策略循环出征）</span>' + ui.help(
        '与出征面板同源：兵力取法、出征方式、目标搜索都走同一套出口。\n' +
        '自动出征特有的：出征频率 / 每日次数上限 / 搜索距离。\n' +
        '计略在**每次出发时**校验，不通过则本次不用计并写明原因 —— 不会因为没锦囊就不动。') + '</div>' +
      '<div class="exp-grid">' +
        '<div class="exp-col-l">' +
          /* ① 执行将领 */
          /* v89.105：这条规则原占一整行（17px）—— 挂到分区标题的 ? 上 */
          '<div class="exp-sec"><div class="exp-sec-t">执行将领' +
            ui.help('只派空闲将领；出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）') +
            '</div>' + sel('am-gen', '将领', genOpts) + '</div>' +
          /* ② 目标：类型 · 等级 · 距离 */
          '<div class="exp-sec"><div class="exp-sec-t">目标' +
            ui.help('以「' + (city ? GAME.cityLabel(city) : '—') + '」为起点，' + rad +
              ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）') +
            '</div>' + sel('am-target', '类型', tgtOpts) + sel('am-level', '等级', lvOpts) + sel('am-radius', '距离', radOpts) + '</div>' +
          /* ③ 2×2：出征方式 · 计略 ／ 出征战术 · 频率上限（与出征面板同款 .exp-quad） */
          '<div class="exp-quad">' +
            '<div class="exp-sec"><div class="exp-sec-t">出征方式</div>' + sel('am-mode', '方式', modeOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
              U.escape(mode.desc || '') + '</div></div>' +
            '<div class="exp-sec"><div class="exp-sec-t">计略</div>' + sel('am-scheme', '计略', schemeOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">' +
              '出发时校验，不通过则本次不用计</div></div>' +
            /* 出征战术行**直接复用出征面板的选项出口**（expTacticOptionsHTML）——
               两处各写一份选项 = 两个出口，加一种战术就会漏一处。 */
            '<div class="exp-sec"><div class="exp-sec-t">出征战术</div>' +
              '<div class="exp-sel"><label>战术</label><select id="am-tactic">' + ui.expTacticOptionsHTML() + '</select></div>' +
              '<div class="exp-info exp-info-l" style="margin-bottom:0;">阵位 <b id="am-tac-sum">' +
              U.escape(GAME.tacticSummary()) + '</b>' +
              '<span class="exp-tac-link" data-action="open-tactic">逐兵种</span></div></div>' +
            '<div class="exp-sec"><div class="exp-sec-t">频率 · 上限</div>' +
              sel('am-freq', '频率', freqOpts) + sel('am-daily', '上限', dailyOpts) +
              '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">今日已出征 ' +
              (cfg.todayCount || 0) + ' 次' +
              (left === Infinity ? '（不限次数）' : '，尚可 ' + left + ' 次') + '</div></div>' +
          '</div>' +
          /* ④ 预估（与出征面板同源） */
          '<div class="exp-sec"><div class="exp-sec-t">预估</div>' + ui.amEstHTML(pv) + '</div>' +
        '</div>' +
        '<div class="exp-col-r">' +
          /* v89.140（老板 7'）：「右侧，**单次兵力这个菜单去除**」——整块退役；
             每次带多少改由下方编成表**逐兵种**指定（cfg.army）。 */
          '<div class="exp-sec exp-a-troops"><div class="exp-sec-t">兵种编成（自动）</div>' +
            '<div class="exp-troops exp-body">' + troopBlock + '</div>' +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">城内现有 ' +
            U.fmt(have) + ' 兵；**逐兵种填数量**（0 = 不带），器械／斥候／辎重不编入</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="exp-foot">' +
        '<button class="btn' + (cfg.on ? ' gold' : '') + '" data-action="am-toggle">' +
          (cfg.on ? '⏸ 关闭自动出征' : '▶️ 开启自动出征') + '</button>' +
        '<button class="btn" data-action="am-once">立即出征一次</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>';
    /* v89.140（老板 7'）：「不要这种播报：上次结果：杨秀 率 500 兵 侦查 善无」——
       该行整条删除（结果仍在公文/日志里可查，主面板不再常驻一行噪声）。 */

    ui.openModal(html, { size: 'xxl' });   /* v89.105：内容实测超 xl（出征 711 / 自动出征 815） */
    /* 下拉「改完即生效」：写 cfg → 就地重开（数值字段一律走 doSetAutoMarch 的转换，
       界面不自己 Number()，免得"界面转一遍、分发器转一遍"两个出口） */
    var bind = function (id, key) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        GAME.doSetAutoMarch(key, el.value);
        ui.openAutoMarch();
      });
    };
    bind('am-gen', 'genId'); bind('am-target', 'target'); bind('am-level', 'maxLevel');
    bind('am-radius', 'radius'); bind('am-mode', 'mode'); bind('am-scheme', 'scheme');
    /* v89.140（老板 7'）：`am-troops`（单次兵力）退役 —— 改为逐兵种输入框（`am-a-<tid>`）。
       写值走 doSetAutoMarch('army:<tid>')，界面不自己拼 cfg（保留"唯一出口"）。 */
    bind('am-freq', 'everyMin'); bind('am-daily', 'dailyMax');
    (function () {
      var ins = document.querySelectorAll('[id^="am-a-"]');
      for (var ii = 0; ii < ins.length; ii++) {
        (function (el2) {
          el2.addEventListener('change', function () {
            GAME.doSetAutoMarch('army:' + el2.id.slice(5), el2.value);
          });
        })(ins[ii]);
      }
    })();
    /* 出征战术不存 cfg —— 它写的是全局战术（GAME.state.tactics），
       与出征面板共用同一个出口 ui.expApplyTactic（"一处设定、两处生效"）。 */
    var _tacSel = document.getElementById('am-tactic');
    if (_tacSel) _tacSel.addEventListener('change', function () {
      ui.expApplyTactic(_tacSel.value);
      ui.openAutoMarch();
    });
  };

  /* ============================================================
   * 种田秘境（v73 · 老板需求 3）：官府 → 另一个菜单
   * ------------------------------------------------------------
   * 「背景是个人种田空间」：整页暖土渐变（金色三元组低透明 → 四主题自适配），
   * 六格灵田。空地 → 选种（即买即种）；生长中 → 进度 + 倒计时（每秒刷新）；
   * 成熟 → 收获。面板只管展示与派发 data-action，逻辑全在 GAME.farm*（域层）。
   * ============================================================ */
  ui.openFarm = function () {
    ui.openModal('<div class="ui-page farm-space">' + ui.farmHTML() + '</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl', closeAll: true });
      /* v89.112：xl(700 高) 里溢 38px → 升 xxl；
         v89.135（老板 8）：「种田秘境关闭后直接会到城池界面」—— closeAll 语义：
         关闭键 = 全关回游戏视图（不弹回进秘境前的官府面板）。 */
  };
  ui.farmHTML = function () {
    var f = GAME.farmOf();
    var ripeN = 0;
    var cells = f.plots.map(function (p, i) {
      var st = GAME.farmPlotState(i);
      var body, act = '';
      if (st.state === 'empty') {
        body = '<div class="farm-ic">🟫</div><div class="farm-crop">空地</div>' +
          '<div class="farm-sub">待播种</div>';
        act = '<button class="btn sm gold" data-action="farm-seeds" data-idx="' + i + '">播种</button>';
      } else if (st.state === 'growing') {
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="pbar"><i data-farm-bar="' + i + '" style="width:' + st.pct + '%;"></i></div>' +
          '<div class="farm-sub" data-farm-left="' + i + '">成熟还需 ' +
            U.durExact(st.left / GAME.timeScale()) + '</div>';
      } else {
        ripeN++;
        body = '<div class="farm-ic">' + st.crop.icon + '</div>' +
          '<div class="farm-crop">' + st.crop.name + '</div>' +
          '<div class="farm-sub" style="color:var(--gold-light);">✨ 已成熟</div>';
        act = '<button class="btn sm gold" data-action="farm-harvest" data-idx="' + i + '">收获</button>';
      }
      return '<div class="farm-cell' + (st.state === 'ripe' ? ' ripe' : '') + '">' + body + act + '</div>';
    }).join('');
    return '<div class="gold-heading">🌾 种田秘境</div>' +
      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种子由采集/征战获得，也可直接购买；生长走游戏时间</div>' +
      '<div class="op-row" style="justify-content:center;margin:4px 0 8px;">' +
        '<button class="btn sm" data-action="qb-cat" data-cat="seed">🛒 购买种子</button></div>' +
      '<div class="farm-grid">' + cells + '</div>' +
      (ripeN
        ? '<div class="op-row" style="justify-content:flex-end;">' +
            '<button class="btn gold" data-action="farm-harvest-all">一键收获（' + ripeN + '）</button></div>'
        : '') +
      '<div class="op-zone"><div class="op-zone-t">作物与去向</div>' +
        /* v78（老板需求 1）：种子在手一览 —— 种子的唯一来源是采集与征战 */
        '<div class="attr"><span class="k">在手种子</span><span class="v">' + (function () {
          var items = GAME.state.items || {}, parts = [];
          (DATA.SEED_DROP && DATA.SEED_DROP.table || []).forEach(function (row) {
            var n = items[row.id] || 0;
            if (n > 0) parts.push(row.name + '×' + n);
          });
          return parts.length ? parts.join('　') : '暂无 —— 派军采集 / 出征获胜可得';
        })() + '</span></div>' +
        '<div class="attr"><span class="k">材料作物</span><span class="v">3 阶打造主料（镔铁 / 檀木 / 犀革 / 蛟筋 / 羊脂玉 / 蜀锦），有机率出 4 阶</span></div>' +
        '<div class="attr"><span class="k">灵草作物</span><span class="v">蕴灵草 / 洗髓芝 / 化龙参 / 天授果 —— 将领资质逐档提升</span></div>' +
        '<div class="attr"><span class="k">去向</span><span class="v">材料 → 铁匠铺打造；灵草 → 宝物背包 → 选将领使用</span></div>' +
      '</div>';
  };
  /* 选种弹窗：列出全部作物（6 材料 + 4 灵草），消耗对应**种子**（v78 · 不再花黄金） */
  ui.openFarmSeeds = function (idx) {
    var items = GAME.state.items = GAME.state.items || {};
    var seedOf = function (c) {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === c.seedItem) it = x; });
      return it || { name: c.seedItem || '种子' };
    };
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var sd = seedOf(c);
      var have = items[c.seedItem] || 0;
      var afford = have >= 1;
      var yieldTxt;
      if (c.herb) {
        yieldTxt = '收 灵草 ×1（将领资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '收 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-seed">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-seed-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
          /* v78：种子持有数一眼可见（缺种的人知道去哪儿找） */
          '<div class="farm-sub">🌰 ' + U.escape(sd.name) + ' 持有 <b>' + have + '</b></div>' +
        '</div>' +
        '<button class="btn sm' + (afford ? ' gold' : '') + '" data-action="farm-plant" data-idx="' + idx +
          '" data-crop="' + c.id + '"' + (afford ? '' : ' disabled') + '>' +
          (afford ? '种下（' + U.escape(sd.name) + ' -1）' : '缺 ' + U.escape(sd.name)) + '</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🌱 第 ' + (idx + 1) + ' 块地 · 选种</div>' +
      '<div class="ui-sub" style="text-align:center;">种子由将领活动获得（采集归来 / 出征缴获）；成熟后回秘境面板收获。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };
  /* ============================================================
   * Text game reader (content layer: story/vol-*.js; engine: GAME.SG)
   * Entries: building modal / wild modal / city panel.
   * Full-screen layer #story-fx, same spec as #scene-fx (body, z=1500).
   * ============================================================ */
  ui.SG_KIND = { building: '城内', ext: '城外', wild: '野地', city: '城池', misc: '世事' };

  /* ============================================================
   * 壁画库（v89.8 · 老板「背景壁画的变换」）
   * ------------------------------------------------------------
   * 每张一段程序化 SVG（满幅 · slice 裁切），数据里每幕/结局声明 `bg`。
   * 画法约定：底色吃主题变量（明暗四主题都成立），剪影用半透明墨色，
   * 灯火/月/水光用暖色低透明 —— 与项目「程序化绘制、零外链素材」同路线。
   * 键名与 story/tools/check.py 的白名单一致（新增壁画须两处同更）。
   * ============================================================ */
  ui.SG_MURAL = {
    /* 衙堂 · 烛夜：红柱、横梁、匾影、公案与烛光 */
    yat:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="540" width="1200" height="260" fill="var(--bg-3)"/>' +
      '<rect y="300" width="1200" height="12" fill="rgba(0,0,0,.45)"/>' +
      '<rect x="470" y="212" width="260" height="86" rx="6" fill="rgba(0,0,0,.5)" stroke="rgba(190,150,84,.45)" stroke-width="2"/>' +
      '<rect x="150" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="400" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="766" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="1016" y="312" width="34" height="430" fill="rgba(96,42,28,.72)"/>' +
      '<rect x="430" y="612" width="340" height="26" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="452" y="638" width="296" height="10" fill="rgba(0,0,0,.4)"/>' +
      '<circle cx="512" cy="564" r="46" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="512" cy="570" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<circle cx="688" cy="564" r="46" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="688" cy="570" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<rect x="536" y="588" width="24" height="34" rx="3" fill="rgba(20,16,12,.6)"/>' +
      '<rect x="640" y="588" width="24" height="34" rx="3" fill="rgba(20,16,12,.6)"/>' +
      '</svg>',
    /* 库仓 · 灯影：梁、垛、粮袋、吊灯 */
    ku:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="520" width="1200" height="280" fill="var(--bg-3)"/>' +
      '<rect y="150" width="1200" height="18" fill="rgba(0,0,0,.45)"/>' +
      '<rect y="250" width="1200" height="12" fill="rgba(0,0,0,.35)"/>' +
      '<rect x="240" y="290" width="26" height="240" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="934" y="290" width="26" height="240" fill="rgba(0,0,0,.4)"/>' +
      '<g fill="rgba(60,46,30,.66)">' +
        '<rect x="120" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="290" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="120" y="500" width="150" height="94" rx="10"/>' +
        '<rect x="760" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="930" y="600" width="150" height="110" rx="10"/>' +
        '<rect x="930" y="500" width="150" height="94" rx="10"/>' +
      '</g>' +
      '<circle cx="600" cy="330" r="60" fill="rgba(255,190,90,.10)"/>' +
      '<rect x="596" y="210" width="8" height="90" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="600" cy="316" r="14" fill="rgba(255,210,130,.8)"/>' +
      '<rect x="470" y="640" width="260" height="12" fill="rgba(0,0,0,.3)"/>' +
      '</svg>',
    /* 书斋 · 灯下：窗格、案、卷、灯 */
    zhai:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<rect x="660" y="140" width="330" height="270" fill="rgba(255,196,110,.10)"/>' +
      '<g stroke="rgba(0,0,0,.4)" stroke-width="8" fill="none">' +
        '<rect x="660" y="140" width="330" height="270" rx="6"/>' +
        '<path d="M715 140v270M770 140v270M825 140v270M880 140v270M935 140v270"/>' +
        '<path d="M660 210h330M660 280h330M660 350h330"/>' +
      '</g>' +
      '<rect x="250" y="560" width="420" height="26" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="270" y="586" width="380" height="10" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="300" y="520" width="120" height="34" rx="6" fill="rgba(214,200,168,.4)"/>' +
      '<rect x="330" y="500" width="120" height="34" rx="6" fill="rgba(214,200,168,.32)"/>' +
      '<circle cx="600" cy="500" r="52" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="600" cy="512" r="10" fill="rgba(255,214,140,.85)"/>' +
      '</svg>',
    /* 夜院 · 月下：矮墙、老树、灯、月 */
    yuan:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="880" cy="190" r="54" fill="rgba(255,240,205,.82)"/>' +
      '<circle cx="880" cy="190" r="96" fill="rgba(255,240,205,.08)"/>' +
      '<rect y="470" width="1200" height="90" fill="rgba(0,0,0,.35)"/>' +
      '<path d="M0 470h1200v22H0z" fill="rgba(0,0,0,.3)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M210 470c0-70 10-120 26-160l16 6c-12 38-20 92-20 154z" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="252" cy="270" r="86" fill="rgba(0,0,0,.42)"/>' +
      '<circle cx="180" cy="310" r="54" fill="rgba(0,0,0,.36)"/>' +
      '<circle cx="320" cy="316" r="48" fill="rgba(0,0,0,.34)"/>' +
      '<rect x="1044" y="470" width="16" height="90" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="1052" cy="560" r="34" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="1052" cy="556" r="8" fill="rgba(255,214,140,.8)"/>' +
      '</svg>',
    /* 酒肆 · 灯市：布棚、酒旗、灯笼、桌 */
    jiu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M0 150h1200v40H0z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M60 190h240l-24 150H84z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M340 190h240l-24 150H364z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M620 190h240l-24 150H644z" fill="rgba(120,60,40,.4)"/>' +
      '<path d="M900 190h240l-24 150H924z" fill="rgba(120,60,40,.4)"/>' +
      '<rect x="1024" y="240" width="10" height="330" fill="rgba(0,0,0,.5)"/>' +
      '<rect x="964" y="256" width="96" height="64" rx="4" fill="rgba(140,50,34,.62)"/>' +
      '<circle cx="600" cy="250" r="42" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="600" cy="262" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<circle cx="220" cy="250" r="42" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="220" cy="262" r="9" fill="rgba(255,214,140,.85)"/>' +
      '<rect x="180" y="640" width="240" height="20" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="780" y="640" width="240" height="20" rx="4" fill="rgba(0,0,0,.55)"/>' +
      '<rect x="190" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="394" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="790" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="994" y="660" width="16" height="60" fill="rgba(0,0,0,.4)"/>' +
      '</svg>',
    /* 雨巷 · 夜行：檐、雨线、灯、水光 */
    xiang:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="600" width="1200" height="200" fill="var(--bg-3)"/>' +
      '<path d="M0 120h520l-40 120H0z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M1200 90H700l36 130h464z" fill="rgba(0,0,0,.42)"/>' +
      '<g stroke="rgba(200,214,228,.14)" stroke-width="3">' +
        '<path d="M140 200l-60 220M300 190l-60 230M470 210l-60 220M660 180l-60 240M840 200l-60 230M1010 190l-60 230M1130 220l-56 210"/>' +
      '</g>' +
      '<circle cx="600" cy="330" r="66" fill="rgba(255,190,90,.12)"/>' +
      '<rect x="592" y="252" width="14" height="70" fill="rgba(0,0,0,.5)"/>' +
      '<circle cx="599" cy="336" r="13" fill="rgba(255,214,140,.8)"/>' +
      '<path d="M180 640h420v10H180z" fill="rgba(190,208,224,.10)"/>' +
      '<path d="M700 700h360v10H700z" fill="rgba(190,208,224,.08)"/>' +
      '</svg>',
    /* 湖夜 · 渔火：月、水、舟、苇 */
    hu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="840" cy="180" r="60" fill="rgba(255,240,205,.85)"/>' +
      '<circle cx="840" cy="180" r="110" fill="rgba(255,240,205,.07)"/>' +
      '<rect y="430" width="1200" height="370" fill="var(--bg-3)"/>' +
      '<path d="M0 430h1200v6H0z" fill="rgba(0,0,0,.3)"/>' +
      '<g fill="rgba(205,222,236,.16)">' +
        '<rect x="810" y="470" width="70" height="7" rx="3"/>' +
        '<rect x="836" y="500" width="52" height="6" rx="3"/>' +
        '<rect x="820" y="532" width="88" height="6" rx="3"/>' +
        '<rect x="846" y="566" width="60" height="5" rx="3"/>' +
        '<rect x="300" y="520" width="90" height="6" rx="3"/>' +
        '<rect x="330" y="560" width="64" height="5" rx="3"/>' +
      '</g>' +
      '<path d="M560 520c30 16 84 16 114 0l-10 22H570z" fill="rgba(0,0,0,.58)"/>' +
      '<circle cx="600" cy="500" r="30" fill="rgba(255,190,90,.14)"/>' +
      '<circle cx="614" cy="494" r="7" fill="rgba(255,214,140,.85)"/>' +
      '<g stroke="rgba(0,0,0,.42)" stroke-width="5" fill="none">' +
        '<path d="M120 620c6-60 4-108-6-150M170 630c2-52 8-96 18-136M76 640c8-48 8-88 0-126"/>' +
        '<path d="M1080 610c-6-56-2-100 8-140M1130 622c-2-48-8-88-16-124"/>' +
      '</g>' +
      '</svg>',
    /* 湖晨 · 雾晓：雾带、低日、远鹭 */
    hud:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="880" cy="260" r="70" fill="rgba(255,214,150,.35)"/>' +
      '<circle cx="880" cy="260" r="130" fill="rgba(255,214,150,.08)"/>' +
      '<rect y="440" width="1200" height="360" fill="var(--bg-3)"/>' +
      '<g fill="rgba(220,228,236,.10)">' +
        '<rect y="330" width="1200" height="30" rx="15"/>' +
        '<rect x="120" y="396" width="920" height="26" rx="13"/>' +
        '<rect x="420" y="452" width="760" height="22" rx="11"/>' +
      '</g>' +
      '<path d="M330 300c22-4 40-4 60 0l-8 14c-16-3-32-3-44 0z" fill="rgba(240,244,248,.5)"/>' +
      '<path d="M430 250c18-3 34-3 50 0l-6 12c-14-3-26-3-38 0z" fill="rgba(240,244,248,.4)"/>' +
      '<g stroke="rgba(0,0,0,.4)" stroke-width="5" fill="none">' +
        '<path d="M150 620c4-52 2-94-6-130M196 628c0-44 6-82 14-116"/>' +
      '</g>' +
      '</svg>',
    /* 山道 · 云雾：叠峰、雾带、松、径 */
    shan:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<path d="M0 470L250 210l210 260z" fill="rgba(0,0,0,.34)"/>' +
      '<path d="M300 470L620 130l340 340z" fill="rgba(0,0,0,.42)"/>' +
      '<path d="M760 470L980 250l220 220z" fill="rgba(0,0,0,.3)"/>' +
      '<rect y="470" width="1200" height="330" fill="var(--bg-3)"/>' +
      '<g fill="rgba(220,228,236,.08)">' +
        '<rect x="140" y="430" width="820" height="26" rx="13"/>' +
        '<rect x="430" y="500" width="700" height="22" rx="11"/>' +
      '</g>' +
      '<path d="M240 470c0-64 6-110 16-146l14 4c-8 34-14 84-14 142z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M232 360l40-70 40 70z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M236 420l36-62 36 62z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M540 800c30-90 90-170 190-240" stroke="rgba(0,0,0,.35)" stroke-width="26" fill="none"/>' +
      '<circle cx="860" cy="430" r="34" fill="rgba(255,190,90,.10)"/>' +
      '<circle cx="858" cy="436" r="7" fill="rgba(255,214,140,.75)"/>' +
      '</svg>',
    /* 山营 · 火：帐、火、旗、戈 */
    ying:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="560" width="1200" height="240" fill="var(--bg-3)"/>' +
      '<path d="M180 560l130-150 130 150z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M760 560l124-140 124 140z" fill="rgba(0,0,0,.4)"/>' +
      '<path d="M540 560l90-104 90 104z" fill="rgba(0,0,0,.34)"/>' +
      '<circle cx="600" cy="600" r="90" fill="rgba(255,150,60,.14)"/>' +
      '<circle cx="600" cy="606" r="34" fill="rgba(255,150,60,.22)"/>' +
      '<path d="M600 560c10 18 16 32 16 46a16 16 0 01-32 0c0-12 6-28 16-46z" fill="rgba(255,170,70,.6)"/>' +
      '<circle cx="574" cy="540" r="3" fill="rgba(255,190,90,.7)"/>' +
      '<circle cx="628" cy="524" r="3" fill="rgba(255,190,90,.6)"/>' +
      '<circle cx="610" cy="500" r="2.4" fill="rgba(255,190,90,.5)"/>' +
      '<rect x="1050" y="300" width="8" height="270" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M1058 306h86l-20 34 20 34h-86z" fill="rgba(140,50,34,.6)"/>' +
      '<path d="M120 620l-26-140M190 630l-6-150M262 620l16-140" stroke="rgba(0,0,0,.42)" stroke-width="6"/>' +
      '</svg>',
    /* 城楼 · 宵禁：垛口、门楼、旗、月 */
    men:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<circle cx="260" cy="170" r="52" fill="rgba(255,240,205,.8)"/>' +
      '<circle cx="260" cy="170" r="92" fill="rgba(255,240,205,.07)"/>' +
      '<rect y="430" width="1200" height="370" fill="var(--bg-3)"/>' +
      '<rect y="360" width="1200" height="70" fill="rgba(0,0,0,.4)"/>' +
      '<g fill="rgba(0,0,0,.4)">' +
        '<rect x="60" y="330" width="40" height="40"/><rect x="160" y="330" width="40" height="40"/>' +
        '<rect x="260" y="330" width="40" height="40"/><rect x="360" y="330" width="40" height="40"/>' +
        '<rect x="460" y="330" width="40" height="40"/><rect x="560" y="330" width="40" height="40"/>' +
        '<rect x="660" y="330" width="40" height="40"/><rect x="760" y="330" width="40" height="40"/>' +
        '<rect x="860" y="330" width="40" height="40"/><rect x="960" y="330" width="40" height="40"/>' +
        '<rect x="1060" y="330" width="40" height="40"/>' +
      '</g>' +
      '<path d="M480 430v128h120V430z" fill="rgba(0,0,0,.6)"/>' +
      '<path d="M440 430l40-64h240l40 64z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M500 366l100-52 100 52z" fill="rgba(0,0,0,.44)"/>' +
      '<rect x="700" y="230" width="7" height="130" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M707 238h72l-16 28 16 28h-72z" fill="rgba(140,50,34,.6)"/>' +
      '<circle cx="540" cy="500" r="30" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="540" cy="506" r="7" fill="rgba(255,214,140,.78)"/>' +
      '</svg>',
    /* 郡府 · 飞檐：双层檐、阶、双灯 */
    fu:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="520" width="1200" height="280" fill="var(--bg-3)"/>' +
      '<path d="M300 420h600l-70 60H370z" fill="rgba(0,0,0,.45)"/>' +
      '<path d="M260 360h680l-60 60H320z" fill="rgba(0,0,0,.5)"/>' +
      '<path d="M540 300h120l40 60H500z" fill="rgba(0,0,0,.5)"/>' +
      '<rect x="360" y="480" width="30" height="120" fill="rgba(96,42,28,.6)"/>' +
      '<rect x="810" y="480" width="30" height="120" fill="rgba(96,42,28,.6)"/>' +
      '<rect x="450" y="540" width="300" height="80" fill="rgba(0,0,0,.4)"/>' +
      '<rect x="520" y="560" width="160" height="60" fill="rgba(255,196,110,.08)"/>' +
      '<circle cx="330" cy="470" r="40" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="330" cy="478" r="9" fill="rgba(255,214,140,.8)"/>' +
      '<circle cx="870" cy="470" r="40" fill="rgba(255,190,90,.12)"/>' +
      '<circle cx="870" cy="478" r="9" fill="rgba(255,214,140,.8)"/>' +
      '<path d="M300 640h600v24H300zM340 664h520v20H340z" fill="rgba(0,0,0,.28)"/>' +
      '</svg>',
    /* 晨光 · 收束：天光、远郭、归雁 */
    xiao:
      '<svg viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="1200" height="800" fill="var(--bg-dark)"/>' +
      '<rect y="140" width="1200" height="200" fill="rgba(255,190,120,.07)"/>' +
      '<rect y="260" width="1200" height="200" fill="rgba(255,170,110,.06)"/>' +
      '<circle cx="760" cy="420" r="84" fill="rgba(255,214,150,.5)"/>' +
      '<circle cx="760" cy="420" r="150" fill="rgba(255,214,150,.10)"/>' +
      '<rect y="480" width="1200" height="320" fill="var(--bg-3)"/>' +
      '<path d="M120 480h170v-40h40v40h130v-56h44v56h150v-34h36v34h160v-48h44v48h140" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="10"/>' +
      '<path d="M420 360l14-9 14 9-14-3zM500 320l14-9 14 9-14-3zM580 350l12-8 12 8-12-2z" fill="rgba(0,0,0,.42)"/>' +
      '<rect y="560" width="1200" height="240" fill="rgba(0,0,0,.16)"/>' +
      '</svg>'
  };

  /* v89.29（入口改版）：逸闻入口从「列表菜单」改为「概率奇遇」——
     点开建筑 / 地块时由 ui.sgTryTrigger 掷骰（GAME.SG.roll），命中即随机抽一篇
     完整故事（每篇 = 一份独立资产），在弹窗之上直接开卷；掩卷后回到原面板。
     v89.29 起：旧的「入口块 / 清单弹窗 / 对应动作分发」已整体收敛。 */

  /* open one story (full-screen reader) */
  ui.openStory = function (sid, keepModal) {
    var r = GAME.SG.begin(sid);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!keepModal) ui.closeModal();
    ui.sgRender();
  };
  /* v89.86（整改 P-06）：触发的逸闻**入待阅**（不再全屏弹出 —— 实测 25 分钟触发 7 次，
     全屏层反复打断操作流）。点了史册页的「待阅逸闻」再开卷；顶栏徽标 +1 提示。
     同一篇已在待阅中则不重复入列、不再提示（徽标不变）。 */
  ui.sgDefer = function (sid) {
    var r = GAME.SG.defer(sid);
    if (!r.ok) return false;
    ui.syncBadges();
    if (ui.view === 'story') GAME.refreshView();      /* 正停在史册页 → 顺手刷新待阅列表 */
    if (!r.dup) {
      ui.sfx('wonder');                               /* v89.93（E4）：奇遇有声音 */
      ui.notify('success', '📖 得逸闻一则《' + r.st.title + '》—— 已入待阅（史册 → 待阅逸闻）');
    }
    return true;
  };
  /* 概率奇遇：点开建筑 / 地块后掷骰；命中入待阅（v89.86 起不再直接开卷） */
  ui.sgTryTrigger = function (kind, id) {
    if (!GAME.SG || !GAME.SG.roll || !id) return false;
    var r = GAME.SG.roll(kind, id);
    if (!r.fire) return false;
    return ui.sgDefer(r.sid);
  };
  /* v89.31 · 动作触发：战事 / 营造 / 民生 / 成长等动作结算后调用（见 GAME.SG.ACT 表）；
     命中即入待阅（v89.86 起不再直接开卷）。 */
  ui.sgTryAct = function (key, ctx) {
    if (!GAME.SG || !GAME.SG.rollAct || !key) return false;
    var r = GAME.SG.rollAct(key, ctx);
    if (!r.fire) return false;
    return ui.sgDefer(r.sid);
  };
  /* v89.86（整改 P-06）：待阅区（史册页顶部；有才出）—— 阅读 / 忽略
     v89.93（整改 E10）：补「往事」折叠区 —— 待阅超限的条目不再丢失，在此仍可读到。 */
  ui.sgPendingHTML = function () {
    /* ============================================================
     * v89.116（老板）：「待阅轶闻，名称怎么比阅读和忽略按钮还小呢？设计更紧凑，
     *   如 5 行*6 列，增加翻页，全部列出，分页显示」
     * ------------------------------------------------------------
     * 三件事：
     *   ① 版面 4×5 = 20 格 → **6 列 × 5 行 = 30 格**（每页 30 篇）；
     *   ② 篇名字号必须**大于**按钮字号（.sg-t = --fs-lead 14px 粗体；
     *      按钮降为 .btn.xs = --fs-cap 11px）—— "名称比按钮还小"从字号上钉死，由 §96 断言守；
     *   ③ 超过一页 → **底部条翻页**（ui.pageOf + ui.pagerHTML，与全站同一套分页口径），
     *      "全部列出"成立：不再有"另有 N 篇未列出"的死角。
     * ============================================================ */
    var list = (GAME.SG && GAME.SG.pending) ? GAME.SG.pending() : [];
    var arch = (GAME.SG && GAME.SG.archived) ? GAME.SG.archived() : [];
    if (!list.length && !arch.length) return '';
    var PER = ui.SG_PER_PAGE;                        /* 30 = 6 列 × 5 行 */
    var pg = ui.pageOf('sg', list.length, PER);
    var cells = '';
    for (var i = 0; i < PER; i++) {
      var x = list[pg.from + i];
      cells += x
        ? '<div class="sg-cell"><span class="sg-t" title="' + U.escape(x.title) + '">《' + U.escape(x.title) + '》</span>' +
          '<span class="sg-a"><button class="btn xs gold" data-action="story-read" data-sid="' + x.sid + '">阅读</button>' +
          '<button class="btn xs" data-action="story-drop" data-sid="' + x.sid + '">忽略</button></span></div>'
        : '<div class="sg-cell empty"><span class="sg-t">待触发</span></div>';
    }
    var html = '<div class="story-card">' +
      '<div class="gold-heading">📖 待阅逸闻（' + list.length + '）' +
        ui.help('触发的逸闻不再全屏弹出（免得打断操作）。\n在此逐条阅读；读一篇移出一篇，「忽略」直接移除。\n' +
          '版面固定 6×5 = ' + PER + ' 格一页，新逸闻逐个填补；超过一页用**底部条翻页**看全。\n待阅超过 ' +
          ((GAME.SG && GAME.SG.PENDING_CAP) || 60) + ' 条后，早先的自动折入「往事」——不再丢失，随时可读。') + '</div>' +
      '<div class="sg-grid">' + cells + '</div>' +
      (pg.maxPage > 1
        ? '<div class="ui-sub" style="text-align:center;margin-top:4px;">第 ' + pg.page + ' / ' + pg.maxPage
          + ' 页（共 ' + list.length + ' 篇 · 每页 ' + PER + ' 篇，翻页在底部条）</div>' : '');
    if (pg.maxPage > 1) ui.pagerHTML('sg', list.length, PER);   /* 底部条翻页（全站同一套） */
    if (arch.length) {
      html += '<div class="note" style="margin-top:6px;">' +
        ('另有 ' + arch.length + ' 篇早先的逸闻折入「往事」，未读不丢 —— ' +
          '去「故事集」页可按篇回看。') + '</div>';
    }
    return html + '</div>';
  };
  ui.SG_GRID_COLS = 6;        /* v89.116：待阅逸闻固定 6 列（老板点名） */
  ui.SG_GRID_ROWS = 5;
  ui.SG_PER_PAGE = ui.SG_GRID_COLS * ui.SG_GRID_ROWS;    /* 30 篇/页（单一出口） */
  ui.SG_GRID_SLOTS = ui.SG_PER_PAGE;                     /* 兼容旧名（= 每页格数） */
  ui.sgReadPending = function (sid) {
    var rec = GAME.SG.takePending(sid);
    if (!rec) { ui.toast('该逸闻已不在待阅'); ui.syncBadges(); GAME.refreshView(); return; }
    ui.syncBadges();
    ui.openStory(sid, false);
  };
  ui.sgDropPending = function (sid) {
    GAME.SG.takePending(sid);
    ui.syncBadges();
    ui.toast('已从待阅移除');
    GAME.refreshView();
  };
  /* 换壁画：两层交叉淡入（同键不闪；首帧自 0 淡入）。层序由数据里的 bg 驱动。 */
  ui._sgBgKey = '';
  ui.sgBg = function (key) {
    var el = document.getElementById('story-fx');
    if (!el) return;
    if (!ui.SG_MURAL[key]) key = 'yuan';
    if (ui._sgBgKey === key) return;
    ui._sgBgKey = key;
    var layers = el.querySelectorAll('.sgr-bg');
    if (layers.length < 2) return;
    var cur = layers[0].dataset.on ? layers[0] : (layers[1].dataset.on ? layers[1] : null);
    var next = (cur === layers[0]) ? layers[1] : layers[0];
    next.innerHTML = ui.SG_MURAL[key];
    next.dataset.key = key;
    next.dataset.on = '1';
    if (cur) delete cur.dataset.on;
  };
  ui.sgRender = function () {
    var run = GAME.SG._run;
    if (!run) return;
    var el = document.getElementById('story-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-fx';
      /* v89.150（老板 2）：fixed → absolute（挂缩放容器 = 画布坐标系，铺满画布） */
      el.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      var _root150e = ui.layerRoot();
      if (_root150e && _root150e.appendChild) _root150e.appendChild(el);
    }
    /* v89.8：骨架一次建成 —— 壁画两层 + 沙幕 + 正文层；
       之后每段只换 .sgr-body 与壁画，不整体重建（否则淡入动效与层状态全丢）。 */
    if (!el.querySelector('.sgr-body')) {
      el.innerHTML = '<div class="sgr-bg"></div><div class="sgr-bg"></div>' +
        '<div class="sgr-scrim"></div><div class="sgr-body"></div>';
      ui._sgBgKey = '';
    }
    el.style.display = 'block';
    var cur = (run.phase === 'end') ? (run.ending || {}) : (GAME.SG.nodeOf(run, run.nodeId) || {});
    ui.sgBg(cur.bg || 'yuan');
    el.querySelector('.sgr-body').innerHTML = ui.sgHTML();
    el.scrollTop = 0;
  };
  /* 幕 / 结局两态；正文换行交给 .sgr-text 的 white-space: pre-wrap（不转 <br>） */
  ui.sgHTML = function () {
    var run = GAME.SG._run;
    if (!run) return '';
    var st = run.st;
    /* v89.8：段进度（第 N 段 · 共 M 段 + 进度点）—— 段数从数据逐层推（rankCount）。 */
    var total = GAME.SG.rankCount ? GAME.SG.rankCount(st) : 0;
    var seg = run.path.length + 1;
    var prog = '终';
    if (run.phase !== 'end') {
      var dots = '';
      for (var i = 0; i < total; i++) dots += '<i' + (i < Math.min(seg, total) ? ' class="on"' : '') + '></i>';
      prog = '第 ' + seg + ' 段 · 共 ' + total + ' 段' +
        (dots ? '<span class="sgr-dots">' + dots + '</span>' : '');
    }
    var h = '<div class="sgr-wrap">' +
      '<div class="sgr-banner">' +
        '<span class="ui-sub">' + (ui.SG_KIND[(st.anchor || {}).kind] || '逸闻') + '</span>' +
        '<span class="gold-heading sgr-title">' + U.escape(st.title) + '</span>' +
        '<span class="sgr-prog">' + prog + '</span>' +
        '<button class="btn sm" data-action="story-exit">' + (run.phase === 'end' ? '收起' : '掩卷') + '</button>' +
      '</div>';
    if (run.phase === 'end') {
      var e = run.ending || {};
      var g = run.got || { got: [] };
      var grade = e.grade === 'win' ? '善终' : (e.grade === 'lose' ? '遗憾' : '将就');
      h += '<div class="sgr-end sgr-g-' + (e.grade || 'win') + '">' +
        '<div class="side-title">' + grade + '</div>' +
        '<div class="sgr-text">' + U.escape(e.t || '') + '</div>' +
        (g.got && g.got.length ? '<div class="sgr-got">' + g.got.map(function (x) {
          return '<span class="sgr-gv"><i>' + U.escape(x.k) + '</i>' + U.numText(x.v, 0) + '</span>';
        }).join('') + '<span class="sgr-note">' + (g.first ? '初读此结局' : '重读') + '　已阅 ' +
          g.done + ' / ' + g.total + ' 个结局</span></div>' : '') +
        '<div class="sgr-ops"><button class="btn gold" data-action="story-exit">回到城中</button></div>' +
        '</div></div>';
      return h;
    }
    var node = GAME.SG.nodeOf(run, run.nodeId);
    if (!node) return h + '<div class="q-empty">幕文缺失</div></div>';
    h += '<div class="side-title">' + U.escape(node.s || '') + '</div>' +
      '<div class="sgr-text">' + U.escape(node.t || '') + '</div>' +
      '<div class="sgr-ops">' + (node.o || []).map(function (op, i) {
        return '<button class="btn sgr-opt" data-action="story-pick" data-i="' + i + '">' +
          '<span class="sgr-l">' + U.escape(op.l || '') + '</span>' +
          (op.d ? '<span class="sgr-d">' + U.escape(op.d) + '</span>' : '') + '</button>';
      }).join('') + '</div></div>';
    return h;
  };
  ui.sgPick = function (i) {
    var r = GAME.SG.choose(i);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui.sgRender();
  };
  ui.sgClose = function () {
    var el = document.getElementById('story-fx');
    if (el) el.style.display = 'none';
    GAME.SG.close();
    if (GAME.refreshAll) GAME.refreshAll();
  };
})();

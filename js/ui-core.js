/* ============================================================
 * ui-core.js　基础件 · 点选控件 / 主题 / 闪烁 / 无法操作提示
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

  /* 选英雄的统一入口（出征 / 采集 / 装备 / 宝物 四处共用）
     sub 可传函数，把「体力/精力/指挥」这类关键信息带在选项上，信息不丢。 */
  /* v89.112（老板「条目过多的分页」）：英雄选择器支持**分页**。
     166 位英雄 × `.gen-chips` 两列网格 = 83 行 2356px —— 装备/宝物面板被它顶爆。
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
   *   关闭的时候不回到上一级界面，而是会到城市内界面」）
   * ------------------------------------------------------------
   * 探针实测（probe_v89117_flicker.js）两个机制性病根：
   *   ① **闪烁**：同级重绘走的是 `root.innerHTML = …` —— **整个 mask 被销毁重建**，
   *      mask 的入场动画（mModalIn .13s + mModalRise .15s）每次重播；
   *      实测"连点 4 次换页/换类" → mask 被重建 4 次（4 次闪）。
   *   ② **层级丢失**：没有"层"的概念 —— 从 A 面板点进 B 面板，B 一关就清空
   *      modal-root，直接落到城市视图（实测：制造厂 → 套装效果 → 关闭 → 弹窗全没）。
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
     · `ui._modalCloseAll` —— 当前层的"关闭=全关"标记（opts.closeAll，基因实验室这类
       "独立空间"：关闭键直接回游戏视图，而不是弹回进基因实验室前那一层）。 */
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

})();

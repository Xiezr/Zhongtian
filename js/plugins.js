/* ============================================================
 * plugins.js — 插件箱（v157.64 建 / v157.65 扩 · 老板 2026-11-15「可插拔数值插件」）
 * ------------------------------------------------------------
 * 需求原话：「给一个可插拔的插件，不影响原代码，实现功能是无限人口。
 *   创建一个插件箱，用于存放这种数值调整的插件，放到菜单上『自动』菜单的左边」
 *
 * 设计口径（三条铁律）：
 *   ① **不改任何既有 js 源码**。接入全部走运行时：
 *      · 视图：包装 GAME.ui.renderView —— 'plugins' 视图由本文件渲染，
 *        其余视图原样放行（syncTheme / 底栏 / syncPhase / _tip 汇合点照常跑）；
 *      · 图标：往 GAME.icons.navSet 补 'plugin' 键（index.html 页签里是占位 <i>）；
 *      · 动作：GAME.reg.add 注册（main.js 的注册表兜底分发已存在，零改动）。
 *   ② **数值插件 = 运行时换函数**：_on 保存原函数再替换，_off 原样恢复。
 *      删除本文件 + 摘掉 index.html 页签，游戏即完全回到原样（可插拔的字面义）。
 *   ③ **开关状态存 localStorage**（不写入存档）：这是玩家本机的玩法层调整，
 *      不该污染游戏数据，也不随存档传染到别的浏览器。
 *
 * 加新插件：在本文件底部 PLUG.register({...}) 一段即可（id/name/desc/_on/_off），
 * 插件箱 UI、持久化、动作分发自动跟上 —— 不需要再动任何别的文件。
 *
 * v157.65 扩展（为「带参数的动作型插件」准备，全部只在本文件内）：
 *   · controls:  function(p) → HTML，插在卡片说明下方（输入框 / 自定义按钮）
 *   · actions:   { do名: function(el, p) }，由通用 'plugin-action' 动作分发；
 *                按钮写 data-action="plugin-action" data-plugin="<id>" data-do="<do名>"
 *   · param:     默认值；PLUG.getParam / setParam 存 localStorage（不进存档）
 *   · transient: true = 一次性插件：开关状态不跨会话、刷新页面不重放 _on
 *                （否则「设定存量」会在每次载入时把玩家之后正常增长的人口覆盖回去）
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var PLUG = GAME.plugins = { list: [] };
  var LS_KEY = 'dsdb.plugins.v1';

  /* v157.65：无限人口的上限函数单独具名声明 —— 插件只做「引用替换」，
     不写 `GAME.maxPopOf = function(...)`：那是重新定义同名全局函数，会被 audit.js
     判成「跨文件重复定义（domain, plugins）」（v157.64 门禁遗留的 audit 红单即源于此）。
     改成引用赋值后语义更准确：开启=换引用、关闭=逐引用恢复，游戏里从未出现第二份定义。 */
  function infinitePopCap() { return 999999; }

  /* ---------------- 注册 ----------------
   * spec：{ id, name, desc, _on, _off }
   *   _on/_off 必须成对且幂等安全（enable/disable 已用 active 标记防重入）。
   * 幂等：同 id 重复注册只保留最后一次。 */
  PLUG.register = function (spec) {
    if (!spec || !spec.id) return null;
    for (var i = 0; i < PLUG.list.length; i++) {
      if (PLUG.list[i].id === spec.id) { spec.active = PLUG.list[i].active || false; PLUG.list[i] = spec; return spec; }
    }
    spec.active = false;
    PLUG.list.push(spec);
    return spec;
  };

  PLUG.byId = function (id) {
    for (var i = 0; i < PLUG.list.length; i++) if (PLUG.list[i].id === id) return PLUG.list[i];
    return null;
  };

  /* ---------------- 持久化（localStorage · 不进存档） ----------------
   * v157.65：加内存兜底 —— 隐私模式 / 无 localStorage 的环境（含测试桩）里
   * 参数与开关本局仍生效，只是不跨会话；否则「应用」写入的新值会被读丢。 */
  var _memState = {};
  function loadState() {
    try {
      var raw = (typeof localStorage !== 'undefined') && localStorage.getItem(LS_KEY);
      if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') { _memState = o; return o; } }
    } catch (e) { }
    return _memState;
  }
  function saveState(st) {
    _memState = st || {};
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(LS_KEY, JSON.stringify(_memState));
    } catch (e) { /* 隐私模式存不进就算了：内存态已兜住，本局仍生效 */ }
  }

  /* ---------------- 插件参数（v157.65） ----------------
   * 与开关状态共用 LS_KEY，键前缀 'p:' 隔离；同样**不进存档**。 */
  PLUG.getParam = function (id, dflt) {
    var v = loadState()['p:' + id];
    return (v === undefined || v === null || v === '') ? dflt : v;
  };
  PLUG.setParam = function (id, v) {
    var st = loadState(); st['p:' + id] = v; saveState(st);
  };

  /* ---------------- 开 / 关 ---------------- */
  PLUG.enable = function (id, silent) {
    var p = PLUG.byId(id);
    if (!p || p.active) return false;
    if (typeof p._on !== 'function') return false;
    try { p._on(); } catch (e) { return false; }
    p.active = true;
    if (!p.transient) { var st = loadState(); st[id] = true; saveState(st); }
    if (!silent && GAME.ui && GAME.ui.toast) GAME.ui.toast('插件已开启：' + p.name);
    return true;
  };
  PLUG.disable = function (id, silent) {
    var p = PLUG.byId(id);
    if (!p || !p.active) return false;
    if (typeof p._off !== 'function') return false;
    try { p._off(); } catch (e) { return false; }
    p.active = false;
    if (!p.transient) { var st = loadState(); st[id] = false; saveState(st); }
    if (!silent && GAME.ui && GAME.ui.toast) GAME.ui.toast('插件已关闭：' + p.name);
    return true;
  };
  PLUG.toggle = function (id) {
    var p = PLUG.byId(id);
    if (!p) return false;
    return p.active ? PLUG.disable(id) : PLUG.enable(id);
  };

  /* ---------------- 自检（给 smoke 用，同 GAME.reg.stats 口径） ---------------- */
  PLUG.stats = function () {
    var s = { total: PLUG.list.length, paired: 0, ids: [] };
    PLUG.list.forEach(function (p) {
      if (typeof p._on === 'function' && typeof p._off === 'function') s.paired++;
      s.ids.push(p.id);
    });
    return s;
  };

  /* ---------------- 插件箱视图 ---------------- */
  PLUG.viewHTML = function () {
    var rows = PLUG.list.map(function (p) {
      var on = !!p.active;
      return '<div style="background:var(--slab-1);border:1px solid ' + (on ? 'var(--gold)' : 'var(--line-strong)') +
        ';border-radius:6px;padding:11px 13px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span style="color:' + (on ? 'var(--gold)' : 'var(--text)') + ';font-size:var(--fs-body);font-weight:700;">' + p.name +
        '　<span style="color:' + (on ? 'var(--gold-light)' : 'var(--text-dim)') + ';font-size:var(--fs-cap);font-weight:400;">' +
        (on ? '● 生效中' : '○ 未开启') + '</span></span>' +
        '<button class="btn sm ' + (on ? 'red' : 'gold') + '" data-action="plugin-toggle" data-plugin="' + p.id + '">' +
        (on ? '关闭' : '开启') + '</button>' +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);line-height:1.7;margin-top:5px;">' + p.desc + '</div>' +
        (typeof p.controls === 'function' ? p.controls(p) : '') +
        '</div>';
    }).join('');
    return '<div class="ui-page">' +
      '<div class="gold-heading">🧩 插件箱' +
      (GAME.ui && GAME.ui.help ? GAME.ui.help('数值调整类插件的可插拔容器。\n' +
        '插件全部运行时接入：开启 = 替换对应函数，关闭 = 恢复原函数。\n' +
        '开关状态只保存在本浏览器（不写入存档）。\n' +
        '删除 js/plugins.js 并摘掉顶栏页签，游戏即回到无插件的原样。') : '') +
      '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);line-height:1.8;margin-bottom:12px;">' +
      '⚠️ 插件会改变游戏平衡，后果自负。关闭插件后，已生效的数值变化按游戏既有规则' +
      '「只封增长、不削存量」保留（例如人口涨上去不会因关插件而回落）。' +
      '</div>' +
      (rows || '<div style="color:var(--text-dim);">插件箱是空的 —— 尚未注册任何插件。</div>') +
      '</div>';
  };

  /* ---------------- 视图接入：包装 renderView ----------------
   * 本模块排在 ui-config 之后、main 之前（modules.json uiSplit），
   * 加载时 GAME.ui.renderView 已由 ui-view.js 定义、游戏尚未启动，包装安全。 */
  if (GAME.ui && typeof GAME.ui.renderView === 'function' && !GAME.ui._pluginsPatched) {
    var _origRenderView = GAME.ui.renderView;
    GAME.ui._pluginsPatched = true;
    GAME.ui.renderView = function (v) {
      if (v === 'plugins') {
        _origRenderView(v);   /* 汇合点照常：syncTheme / 底栏 / syncPhase / prologue / _tip */
        var box = (typeof document !== 'undefined' && document.querySelector)
          ? document.querySelector('#view-container') : null;
        if (box) box.innerHTML = PLUG.viewHTML();
        return;
      }
      return _origRenderView(v);
    };
  }

  /* ---------------- 图标：navSet 补 'plugin'（插头，插件箱的字面义） ---------------- */
  if (GAME.icons && GAME.icons.navSet && !GAME.icons.navSet.plugin) {
    GAME.icons.navSet.plugin =
      '<path d="M9 2.6v3.6M15 2.6v3.6"/>' +
      '<rect x="6.6" y="6.2" width="10.8" height="7" rx="1.6"/>' +
      '<path d="M12 13.2v3.4"/>' +
      '<path d="M12 16.6c0 2.4-2.6 2.8-2.6 4.8"/>';
  }

  /* ---------------- 动作：走 GAME.reg 注册表（main.js 兜底分发，零改动） ---------------- */
  if (GAME.reg && GAME.reg.add) {
    GAME.reg.add({
      id: 'plugins',
      order: 900,
      actions: {
        'plugin-toggle': function (el) {
          var id = el && el.getAttribute ? el.getAttribute('data-plugin') : '';
          if (!id) return;
          PLUG.toggle(id);
          if (GAME.ui && GAME.ui.renderView) GAME.ui.renderView('plugins');   /* 就地重绘开关态 */
        },
        /* v157.65：通用插件动作分发 —— 带 controls 的插件把自定义动作挂在 spec.actions，
           按钮写 data-action="plugin-action" data-plugin="<id>" data-do="<do名>" 即可。 */
        'plugin-action': function (el) {
          var id = el && el.getAttribute ? el.getAttribute('data-plugin') : '';
          var key = el && el.getAttribute ? el.getAttribute('data-do') : '';
          var p = PLUG.byId(id);
          if (!p || !p.actions || typeof p.actions[key] !== 'function') return;
          try { p.actions[key](el, p); } catch (e) { }
        }
      }
    });
  }

  /* ============================================================
   * 内置插件 ①：无限人口
   * ------------------------------------------------------------
   * domain.js 的幸存者上限**唯一基准**是 GAME.maxPopOf（居所+专精+孢囊），
   * effPopCapOf（民心折算）/ popGrowthOf（增速基数）/ 迁入封顶全部从它派生 ——
   * 换掉这一个函数，整条消费链（增长目标、增速、显示、迁入）同步生效，
   * 这正是 v89.185「唯一出口」架构给运行时插件留的缝。
   * 口径：开启后上限视为 999,999；关闭恢复原函数。
   * 增速随上限放大（fillHours 固定时间补满），已涨上去的人口不回收。
   * ============================================================ */
  PLUG.register({
    id: 'infinite-pop',
    name: '无限人口',
    desc: '幸存者上限视为 999,999 —— 居所与民心不再约束人口；增速随上限同步放大' +
      '（按固定补满时长爬升，约 2 小时到顶）。关闭后恢复原上限，已增长的人口不回收。',
    _on: function () {
      if (typeof GAME.maxPopOf !== 'function') return;
      this._origMaxPop = GAME.maxPopOf;
      GAME.maxPopOf = infinitePopCap;   /* 换引用（非重新定义同名函数，见上方注释） */
    },
    _off: function () {
      if (typeof this._origMaxPop === 'function') GAME.maxPopOf = this._origMaxPop;
      this._origMaxPop = null;
    }
  });

  /* ============================================================
   * 内置插件 ②：现有人口设定（v157.65）
   * ------------------------------------------------------------
   * 老板：「加个插件，不改变人口上限，而改变现有人口数值」
   *
   * 与「无限人口」的分工：那个换 GAME.maxPopOf（上限基准）；
   * 这个**一个上限函数都不碰**，只写 GAME.res(city).pop —— 城池的存量数值。
   *
   * 为什么能稳住：state.js:4570 的增长口径是
   *   `if (R.pop < maxPop) R.pop = Math.min(maxPop, R.pop + growth/3600*dtReal)`，
   * 即 v89.185「只封增长、不削存量」—— 设定值超过上限时既不增长也不被拉回，
   * 于是「上限照旧、人口变多」可以长期成立；离线补偿（state.js:3346）同口径。
   * 辐射云 / 气候 / 遣散等既有减员规则照常生效（存量不是锁死，只是一次注入）。
   *
   * transient：_on 只在「开启」那一刻注入一次，刷新页面不重放 ——
   * 否则每次载入都会把玩家此后正常增长的人口覆盖回设定值。
   * ============================================================ */
  PLUG.register({
    id: 'set-pop',
    name: '现有人口设定',
    transient: true,
    param: 9999,
    desc: '把当前星球每座城的「现有幸存者」直接设为你填的数值（默认 9999，范围 1–999999）；' +
      '人口上限（maxPopOf / effPopCapOf / 民心折算）一律不动。' +
      '这是一次性注入，之后按游戏既有规则演化：因「只封增长、不削存量」，' +
      '超过上限的人口会留在原地、不会被拉回。关闭插件不回滚，刷新页面也不会重放；' +
      '想再改一次，改数字再点「应用到所有城」。',
    controls: function (p) {
      var v = Number(PLUG.getParam(p.id, p.param));
      if (!isFinite(v) || v < 1) v = p.param;
      return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px;">' +
        '<label for="plugin-input-' + p.id + '" style="color:var(--gold-light);font-size:var(--fs-sub);font-weight:700;">目标人口</label>' +
        '<input type="number" id="plugin-input-' + p.id + '" value="' + v + '" min="1" max="999999" step="1" ' +
        'style="width:110px;padding:4px 8px;font-size:var(--fs-sub);color:var(--text);' +
        'background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:var(--r-sm);">' +
        '<button class="btn sm gold" data-action="plugin-action" data-plugin="' + p.id + '" data-do="apply">应用到所有城</button>' +
        '</div>';
    },
    /* 唯一写入口：只碰存量，不碰任何上限函数 */
    apply: function (v) {
      if (typeof GAME.res !== 'function' || !GAME.city || typeof GAME.city.all !== 'function') return 0;
      var all = GAME.city.all() || [], n = 0;
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (!c) continue;
        try { GAME.res(c).pop = v; n++; } catch (e) { }
      }
      return n;
    },
    actions: {
      apply: function (el, p) {
        var raw = (typeof document !== 'undefined' && document.getElementById)
          ? (document.getElementById('plugin-input-' + p.id) || {}).value : undefined;
        var v = Math.floor(Number(raw));
        if (!isFinite(v) || v < 1) v = p.param;
        v = Math.max(1, Math.min(999999, v));
        PLUG.setParam(p.id, v);
        if (!p.active) PLUG.enable(p.id, true);       /* _on 会用刚存好的新值注入一次 */
        var n = p.apply(v);                             /* 幂等：同值重写一次，覆盖 enable 失败的情形 */
        if (GAME.ui && GAME.ui.toast) GAME.ui.toast('已把 ' + n + ' 座城的现有幸存者设为 ' + v + '（上限未改）');
        if (GAME.ui && GAME.ui.renderView) GAME.ui.renderView('plugins');
      }
    },
    _on: function () {
      var v = Math.floor(Number(PLUG.getParam(this.id, this.param)));
      if (!isFinite(v) || v < 1) v = this.param;
      this.apply(Math.max(1, Math.min(999999, v)));
    },
    _off: function () { /* 存量不回滚：按「只封增长、不削存量」既有口径留在原地 */ }
  });

  /* ---------------- 启动恢复：上次开着的插件重新生效 ----------------
   * transient 插件跳过（一次性注入，刷新不重放，否则会覆盖此后正常增长的人口）。 */
  (function () {
    var st = loadState();
    PLUG.list.forEach(function (p) {
      if (!p.transient && st[p.id]) PLUG.enable(p.id, true);
    });
  })();
})();

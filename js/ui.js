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

  ui.toast = function (msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(ui._toastTimer);
    ui._toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  };

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
  ui.genChips = function (o) {
    var opt = o || {};
    var list = opt.list || (GAME.state.generals || []);
    var ST = { guard: '守', march: '征', gather: '采' };
    return ui.chips({
      cls: opt.cls || 'gen-chips',
      target: opt.target, store: opt.store, refresh: opt.refresh, after: opt.after,
      opts: list.map(function (g) {
        var sub = opt.sub ? opt.sub(g) : ('Lv' + g.level);
        return {
          v: g.id, on: g.id === opt.value,
          label: U.escape(g.name) + '<span class="chip-sub">' + sub +
            (ST[g.status] ? ' ' + ST[g.status] : '') + '</span>'
        };
      })
    });
  };

  /* 附属界面统一规范（v14.1，v43 修订）
     · **关闭一律在弹窗底部**，不再有右上角 ×（老板要求）
     · 若传入的 html 内没有关闭按钮，底部**自动补一个「关闭」**
     · 支持尺寸档位 sm / md / lg，统一 max-height 88vh + 内部滚动 ——
       不再超屏、不再无限下拉
     opts 可为字符串（等价 size）或 { size:'sm'|'md'|'lg', noClose:true } */
  ui.openModal = function (html, opts) {
    var root = $('#modal-root');
    var o = (typeof opts === 'string') ? { size: opts } : (opts || {});
    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
    var hasFootClose = /data-action="close-modal"/.test(html);
    /* v43（老板要求）：**取消右上角 ×**，关闭一律走底部按钮。
       底部若没有关闭动作就自动补一个，保证每个弹窗都能从底部关掉。
       （noClose 仍保留原语义：连底部也不补，用于必须做选择才能继续的流程。） */
    var foot = (hasFootClose || o.noClose) ? ''
      : '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    /* v19：使用 modalShell 的弹窗自带 head/body/foot，内层换成 flex 列布局
       （标题与操作栏固定、只有内容区滚动） */
    var shelled = /class="m-head"/.test(html);
    root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
      '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + html + foot + '</div></div></div>';
    root._visible = true;
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
    var foot = o.foot != null ? o.foot
      : '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    return { html: head + '<div class="m-body">' + (o.body || '') + '</div>' + foot, size: o.size || 'md' };
  };
  /* 便捷入口：直接打开三段式弹窗 */
  ui.openShell = function (opts) {
    var sh = ui.modalShell(opts);
    ui.openModal(sh.html, { size: opts.size || 'md' });
  };
  ui.closeModal = function () {
    $('#modal-root').innerHTML = '';
    ui._visible = false;
    ui._modalKind = null;          /* v54：认窗标记（见 openExpPick / openGiftPick） */
    ui._curGrid = null;
    ui._attackNpc = null;
    ui._attackWild = null;
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
    }
    ui.toast((label || '📂 已载入存档') + (GAME._scaleMigrated ? ' · 时间倍率已提升' : '') +
      (offTxt ? '　' + offTxt : ''));
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
    document.body.appendChild(el);
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
    var vw = (typeof window !== 'undefined' && window.innerWidth) || 1280;
    var vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
    var pos = ui.tipPos(r, t.width, t.height, vw, vh);
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
      av.innerHTML = GAME.portraits.html(rulerGen, 68);
    }
    /* v26（需求 3）：顶栏天时。放在 syncHeader 里而不是单独定时器 ——
       主循环每秒都会调 syncHeader，季节/天候/年号一切换这里就跟着变。 */
    var sky = $('#nav-sky');
    if (sky) {
      var line = GAME.story ? GAME.story.skyLine() : '';
      sky.innerHTML = '<span class="ns-k">天时</span>' + U.escape(line || '—');
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
  ui.woundedBlock = function (host) {
    var n = GAME.state.wounded || 0;
    var fee = n * 10;
    return '<div class="wounded-box"' + (host ? ' data-heal-host="' + host + '"' : '') + '>' +
      '<div class="wb-head">' +
        '<span class="wb-t">🏥 伤兵营</span>' +
        '<span class="wb-n">' + U.numText(n, 0) + ' 名</span></div>' +
      '<div class="attr"><span class="k">治疗费</span><span class="v">' +
        (n ? (U.numText(fee, 0) + ' 金') : '—') + '</span></div>' +
      '<div class="wb-act">' +
        '<button class="btn' + (n ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (n ? '' : ' disabled') + '>治疗全部伤兵</button>' +
      '</div></div>';
  };

  /* 校场（v21 · 需求 1）：出征 + 伤兵营 */
  ui.openXiaochang = function () {
    var s = GAME.state, c = GAME.currentCity();
    var lv = GAME.buildingLevel(c, 'xiaochang') || 0;
    if (!lv) {
      ui.openModal('<div class="gold-heading">🏹 校场</div>' +
        '<div class="q-empty">尚未建造校场</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var marching = (s.marches || []).filter(function (m) { return m.cityId === c.id; }).length;
    ui.openModal(
      '<div class="gold-heading">🏹 校场 · Lv' + lv + '</div>' +
      '<div class="attr"><span class="k">出征队列</span><span class="v">' + marching + ' / ' + lv + ' 队</span></div>' +
      '<div class="attr"><span class="k">每队兵力上限</span><span class="v">' + U.numText(lv * 10000, 0) + ' 人口</span></div>' +
      ui.woundedBlock('xiaochang') +
      '<div class="modal-foot">' +
        '<button class="btn gold" data-action="xiaochang-exp">出兵地图</button>' +
        /* v59：原版把"出征战术"设在「校场 → 出征」里，这里照此 */
        '<button class="btn" data-action="open-tactic">⚔️ 出征战术</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>' +
      '</div>'
    );
  };

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
      '<div style="text-align:center;margin-top:10px;"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* ============================================================
   * 行军视图（v19 · 需求 6）：监控**本城在外军队**
   *   ① 行军中：出发 → 抵达的队列（可召回）
   *   ② 在外驻军：野地采集队（可收获/撤回）
   * ============================================================ */
  ui.marchesHTML = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var list = (s.marches || []).filter(function (m) { return !c || m.cityId === c.id; });
    var rows = list.map(function (m) {
      var pr = GAME.march.progressOf(m);
      var md = GAME.battle.modeOf(m.modeId);
      var gen = null;
      (s.generals || []).forEach(function (g) { if (g.id === m.genId) gen = g; });
      var n = 0;
      for (var k in m.army) n += m.army[k] || 0;
      var left = Math.max(0, (m.totalTime - m.elapsed) / GAME.timeScale());
      return '<tr>' +
        '<td>' + md.icon + ' ' + U.escape(m.name) + '</td>' +
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
      ? '<table class="tbl"><thead><tr><th>目标</th><th>主将</th><th>方式</th><th>兵力</th><th>行军进度</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div style="text-align:center;margin-top:10px;"><button class="btn gold" data-action="march-rush">⚡ 急行军令（立即抵达）</button></div>'
      : '<div class="q-empty">本城暂无出征军队。在地图上对野地 / 据点 / 城池点「出兵」即会进入行军。</div>';

    var glist = GAME.gatherList();
    var grows = glist.map(function (g) {
      var y = GAME.gatherYield(g);
      var gen = null;
      (s.generals || []).forEach(function (x) { if (x.id === g.genId) gen = x; });
      var tn = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : g.type;
      return '<tr>' +
        '<td>' + tn + ' Lv' + (g.level || 1) + '</td>' +
        '<td class="ctr">' + g.x + ',' + g.y + '</td>' +
        '<td class="ctr">' + (gen ? U.escape(gen.name) : '—') + '</td>' +
        '<td class="num">' + U.numText(g.troops, 0) + '</td>' +
        '<td class="num">' + U.numText(y.amount, 0) + ' ' + (ui.RES_NAME[y.res] || '') + '</td>' +
        '<td class="ctr"><button class="btn sm gold" data-action="gather-finish" data-id="' + g.id + '">收获</button> ' +
          '<button class="btn sm red" data-action="gather-abandon" data-id="' + g.id + '">撤回</button></td>' +
        '</tr>';
    }).join('');
    var gatherBlock = glist.length
      ? '<table class="tbl"><thead><tr><th>野地</th><th>坐标</th><th>带队</th><th>兵力</th><th>预计收成</th><th>操作</th></tr></thead><tbody>' + grows + '</tbody></table>'
      : '<div class="q-empty">暂无在外采集队。</div>';

    return '<div class="ui-page">' +
      '<div class="gold-heading">🛫 行军 · ' + U.escape(c ? c.name : '本城') + ' 在外军队</div>' +
      ui.woundedBlock('view') +
      '<div class="q-sec"><span class="q-sec-t">行军中</span>' +
        '<span class="q-sec-n">' + list.length + ' 队</span></div>' +
      marchBlock +
      '<div class="q-sec" style="margin-top:18px;"><span class="q-sec-t">在外驻军 · 采集</span>' +
        '<span class="q-sec-n">' + glist.length + ' / ' + DATA.GATHER.maxActive + ' 队</span></div>' +
      gatherBlock +
      '</div>';
  };

  /* 实时刷新建造进度（格子/城外地块/弹窗倒计时 + 进度条，不整页重绘） */
  ui.updateProgress = function () {
    ['data-build-progress', 'data-ext-progress', 'data-modal-progress'].forEach(function (attr) {
      var els = document.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) {
        var key = els[i].getAttribute(attr); // "city:3"
        var p = key.split(':');
        els[i].textContent = GAME.buildPct(p[0], Number(p[1])) || '…';
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

  /* 底部信息流（原版分频道：系统/战报/任务/全部）
     v16 起消息流已整合进「公文」页，这里只负责刷新该页的消息容器 */
  ui.renderLog = function () {
    var el = $('#msg-log');
    if (!el) return;                     // 仅在公文档可见时刷新
    el.innerHTML = ui.msgLines(ui._msgCh || 'sys');
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
    var wilds = (s && s.wilds) || [];
    var sig = wilds.map(function (w) { return w.x + ',' + w.y + ',' + w.level; }).join('|');
    if (sig === ui._wildSig) return;
    ui._wildSig = sig;
    if (ui._wildSel >= wilds.length) ui._wildSel = 0;
    var sel = ui._wildSel || 0;
    var opts = wilds.map(function (w, i) {
      var t = DATA.TERRAIN[w.type];
      return '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' +
        (t ? t.name : w.type) + ' Lv' + w.level + '（' + w.x + ',' + w.y + '）</option>';
    }).join('') || '<option value="">暂无附属野地</option>';
    box.innerHTML = '<div class="res-line" title="已占野地（官府等级决定上限）。选一块点「进入」查看加成与采集。">' +
      '<span class="lbl">附属野地</span>' +
      '<span class="val" style="display:flex;align-items:center;gap:6px;">' +
        '<select class="city-select wild-select" id="wild-pick" data-action="wild-pick"' +
          (wilds.length ? '' : ' disabled') + '>' + opts + '</select>' +
        '<button class="btn sm gold" data-action="open-wilds">进入</button>' +
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
   * 固定在资源栏下方、固定高度；列出当前城池各兵种数量与耗粮，
   * 空城也占位（不塌陷），可折叠。
   * ============================================================ */
  ui._garrisonOpen = true;
  ui.renderGarrison = function (c, s) {
    var el = $('#garrison-bar');
    if (!el || !c) return;
    var ids = Object.keys(c.army || {}).filter(function (k) { return (c.army[k] || 0) > 0; });
    var total = 0, feed = 0;
    ids.forEach(function (k) {
      total += c.army[k];
      feed += (DATA.TROOPS[k] ? DATA.TROOPS[k].food : 0) * c.army[k];
    });
    var open = ui._garrisonOpen !== false;
    /* v65（老板）：「左侧统计的驻军，只留驻军 2 个字就行了，
       总数、种类、总体耗粮都不需要」——
       原先标题是「⚔ 许都 · 驻军　12,345　8 种 · 耗粮 1,234/h」，一行塞了四件事；
       城名在上方「城池属性」栏已有，总数与种类在下面的明细里逐行可见，
       总体耗粮自己加也行（明细每行都写着）。标题只留两个字。
       ⚠️ `total` / `feed` 仍在算 —— 它们是明细行的数据源，只是不再上标题。 */
    var head = '<div class="gb-head" data-action="toggle-garrison">' +
      '<span>⚔ 驻军</span>' +
      '<span class="gb-arrow">' + (open ? '▾' : '▸') + '</span></div>';
    var body = '';
    if (open) {
      body = ids.length
        ? '<div class="gb-list">' + ids.map(function (k) {
            var t = DATA.TROOPS[k];
            return '<div class="gb-row"><span class="gb-n">' + (t ? t.name : k) + '</span>' +
              '<span class="gb-c">' + U.numText(c.army[k], 0) + '</span>' +
              '<span class="gb-f">-' + U.numText((t ? t.food : 0) * c.army[k], 0) + '/h</span></div>';
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
      '<div class="res-line"><span class="lbl">❤️ 民心 / 民怨</span><span class="val">' +
        '<b style="color:' + (hearts > 60 ? 'var(--green-ok)' : hearts > 30 ? '#e6a400' : 'var(--red-light)') + ';font-variant-numeric:tabular-nums;">' + hearts + '</b>' +
        ' <span style="color:var(--text-dim);">/</span> ' +
        '<span style="font-variant-numeric:tabular-nums;">' + minyuan + '</span></span></div>' +
      '<div class="res-line"><span class="lbl">💰 税率</span><span class="val">' + Math.round((s.tax || 0) * 100) + '%</span></div>' +
      /* v20（需求 5/12）：黄金存量、税收速率、可征人口**全部去掉** ——
         · 黄金与资源栏重复
         · 税收（金/时）数值不准且与资源栏的 /秒 增速口径不一致，删掉避免误导
         · 可征人口 信息密度低，需要时在人口统计面板看 */
      '<div class="res-line"><span class="lbl">👥 人口</span><span class="val">' + U.numHTML(s.res.pop || 0, 0) + '<span class="cap"> / ' + U.numText(maxPop, 0) + '</span></span></div>' +
      /* v24（需求 6）：再删两行 ——
         · 「🧱 城防 · 驻军」：驻军栏就在正下方（含兵种与耗粮），城防在「统计」页；
         · 「🌾 城外地块」：城外视图的棋盘本身就是这块数据，重复且挤。
         侧栏从此只留下"本城当下最该一眼看到"的几项。 */
      /* 断粮警示（v65 老板改了规则）：粮尽**不会立刻**掉兵 ——
         先饿满 24 游戏小时才哗变，之后每 24 小时各兵种逃 20%。
         所以文案必须报"还能撑多久"，否则这条新规则玩家看不见
         （项目规矩：新机制上线，它的输出值要能被看见）。 */
      (function () {
        if (!(GAME.isStarving && GAME.isStarving())) return '';
        var need = (DATA.STARVE && DATA.STARVE.hours) || 24;
        var leftH = Math.max(0, need - Math.floor(c.starveHours || 0));
        return '<div class="note-warn" style="margin-top:6px;text-align:left;">🕯 <b>粮尽</b>，无法出征。' +
          '守军尚可支撑 <b>' + leftH + '</b> 游戏小时，逾将哗变逃散' +
          '（每 ' + need + ' 小时各兵种逃 ' + Math.round((DATA.STARVE.mutinyPct || 0.2) * 100) + '%）。<br>' +
          '宜速运粮入城、增产粮草，或裁减军伍。</div>';
      })();
      /* 定期来袭警示（第 2 期 · 防守）—— 与断粮警示**同一个 `.note-warn`**，
         不新增 CSS、不新增板块，只在「已有排期」时渲染。
         项目规矩：新机制上线，它的输出值要能被看见（否则玩家永远不知道
         自己在被谁打、还有多久、守不守得住）。
         ⚠️ 这里是 `GAME.invasionDueAt` 与 `GAME.defensePowerOf` 的**界面消费点**，
            删掉这段 audit.js 会报死函数。 */
      (function () {
        if (!GAME.invasionDueAt || !GAME.defensePowerOf) return '';
        var due = GAME.invasionDueAt(c);
        if (!due) return '';
        var now = (s.world && s.world.elapsed) || 0;
        var leftH = Math.max(0, Math.round((due - now) / 3600));
        var I = DATA.INVASION || {};
        var bc = Math.min(I.warnBeaconMax || 3, GAME.buildingLevel(c, 'fenghuotai') || 0);
        return '<div class="note-warn" style="margin-top:6px;text-align:left;">🔥 <b>烽火</b>，约 ' +
          leftH + ' 游戏时后有兵马犯境。<br>本城守备力 <b>' +
          U.fmt(GAME.defensePowerOf(c)) + '</b>' +
          (bc > 0 ? '（烽火台 Lv' + bc + ' 提前预警）' : '（无烽火台，预警偏迟）') +
          '　宜收拢兵力、修葺城墙。</div>';
      })();
    html += ui.citySchemeHTML(c);
    box.innerHTML = html;
  };

  /* v86：城池面板的计略布防行（生效中显示倒计时；未挂给入口按钮）。
     输出值可被看见：空城计/坚壁清野剩余时长在此处常显。 */
  ui.citySchemeHTML = function (c) {
    if (!GAME.schemeDefOf) return '';
    var s = GAME.state;
    var now = (s.world && s.world.elapsed) || 0;
    var parts = [];
    var kc = GAME.schemeDefOf(c, 'kongcheng', now);
    var jb = GAME.schemeDefOf(c, 'jianbi', now);
    if (kc) parts.push('🎭 空城计（余 ' + Math.ceil(kc.left / 3600) + ' 时）');
    if (jb) parts.push('🏜️ 坚壁清野（余 ' + Math.ceil(jb.left / 3600) + ' 时）');
    return '<div class="res-line" style="align-items:center;"><span class="lbl">🎴 计略布防</span>' +
      '<span class="val" style="display:flex;align-items:center;gap:6px;">' +
      (parts.length ? '<span style="color:var(--green-ok);font-size:var(--fs-sub);">' + parts.join('　') + '</span>'
                    : '<span style="color:var(--text-dim);font-size:var(--fs-sub);">未布防</span>') +
      '<button class="btn sm" data-action="city-scheme">布防</button></span></div>';
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
  ui.TAC_PER = 4;                    // 每页 4 个兵种（两行 chips，再多会撑爆弹窗）
  ui.tacticChip = function (troop, field, val, label, on) {
    return '<span class="chip' + (on ? ' on' : '') + '" data-action="tactic-set"' +
      ' data-troop="' + troop + '" data-g="tac-' + field + '-' + troop + '"' +
      ' data-f="' + field + '" data-v="' + val + '">' + label + '</span>';
  };
  /* 会出现在战场上的兵种（与 tactic.unitsOf 的判据一致：非 nocombat）——
     斥候不上阵、指挥它没有意义，所以战术表里也不该有它。 */
  ui.tacticTroopIds = function () {
    return Object.keys(DATA.TROOPS).filter(function (id) { return !DATA.TROOPS[id].nocombat; });
  };
  ui.openTacticModal = function () {
    var ids = ui.tacticTroopIds();
    var pg = ui.modalPage('tactic', ids, ui.TAC_PER, function () { ui.openTacticModal(); });
    /* 目标选项：自动 / 每个上阵兵种 / 箭塔 */
    var tgt = [{ v: '', label: '自动' }].concat(ids.map(function (id) {
      return { v: id, label: DATA.TROOPS[id].name };
    })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);
    var body = pg.slice.map(function (id) {
      var tr = DATA.TROOPS[id], cur = GAME.tacticOf('atk', id);
      return '<div class="tac-block">' +
        '<div class="tac-row">' +
          '<span class="tac-name">' + (tr.icon || '') + ' ' + tr.name + '</span>' +
          '<span class="chips">' + DATA.STANCES.map(function (st) {
            return ui.tacticChip(id, 's', st.id, st.icon + st.name, cur.s === st.id);
          }).join('') + '</span>' +
        '</div>' +
        '<div class="tac-row"><span class="tac-k">目标</span><span class="chips">' +
          tgt.map(function (o) {
            return ui.tacticChip(id, 't', o.v, o.label, String(cur.t || '') === o.v);
          }).join('') + '</span></div>' +
        '</div>';
    }).join('');
    ui.openShell({
      title: '⚔️ 出征战术',
      sub: '当前：' + GAME.tacticSummary() + ui.help(
        '每兵种两项：**动作**（前进 / 防御 / 后退）+ **目标**（敌方某一兵种，或攻城时的**箭塔**）。\n' +
        '动作决定**初始站位**：前进 = 第一排（100）、防御 = 第二排（50）、后退 = 第三排（0）。\n' +
        '· **前进**：每回合向敌阵推进（推进到刚好能开火就停）\n' +
        '· **防御**：原地不动，**受到的伤害减半**（远程原地对射就是选它）\n' +
        '· **后退**：每回合向己方后撤，用来躲开箭塔的**双倍攻击区**（原版攻城战的核心操作）\n' +
        '目标：指定兵种在射程内就优先打它；选**箭塔**则专拆城防工事（拆完自动转为打守军）。\n' +
        '守方（NPC 城池 / 野地）用默认动作：攻城时固守（依城而战），野地时迎击。'),
      body: body + pg.pager,
      foot: '<div class="m-foot">' +
        '<button class="btn" data-action="tactic-reset">恢复默认</button>' +
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
   *   都不动；于是把「/秒」改成本城产量，栏首写明"本城产量 · 全境存量"。
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
    var prodAll = GAME.productionPerSec();
    var prodCity = GAME.cityProdPerSec(c);
    /* v77（老板）：「资源这里的备注：本城 新城池改成附属野地 下拉框」——
       原「本城 · 城名」表头退役；附属野地选择器在独立静态节点
       #wild-pick-host（ui.renderWildPick 渲染），不会被每秒重绘打断。 */
    var html = '';
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      var perSec = prodCity[k] || 0;          // 本城产量（随切城变化）
      var perSecAll = prodAll[k] || 0;        // 全境合计（悬停里给出）
      var itemId = RES_QUICK_ITEM[k];
      var have = (s.items && s.items[itemId]) || 0;
      var val = s.res[k] || 0;
      /* v19：资源行**只用文字**（去掉图标）；存量取整到个位
         （小数在每秒刷新的画面上一直在闪，没有信息量）；增速仍按 /秒。 */
      /* v20（需求 11）：产量悬停显示构成明细（基础产量 + 各类加成/扣除） */
      /* v20（需求 11）：产量悬停显示构成明细（基础 + 各类加成/扣除）
         U.rateHTML 产出的是 <span class="num-rate">，外面再包一层带 data-tip 的容器。 */
      var bd = GAME.prodBreakdown ? GAME.prodBreakdown(k, c) : null;
      var tipLines = ['本城产量构成（/秒）'];
      if (bd && bd.length) {
        bd.forEach(function (x) {
          tipLines.push(x.name + '：' + (x.val >= 0 ? '+' : '') + (Math.abs(x.val) >= 10 ? x.val.toFixed(1) : x.val.toFixed(2)));
        });
        tipLines.push('本城合计：+' + (perSec >= 10 ? perSec.toFixed(1) : perSec.toFixed(2)));
      } else {
        tipLines.push('本城暂无产量');
      }
      tipLines.push('———');
      tipLines.push('全境合计：+' + (perSecAll >= 10 ? perSecAll.toFixed(1) : perSecAll.toFixed(2)));
      var rateHtml = '<span class="rate-wrap" data-tip="' + U.escape(tipLines.join('\n')) + '">'
        + U.rateHTML(perSec) + '</span>';
      /* v40（需求 1）：存量悬停从「精确值」改为**仓储上限** ——
         老板要看的是"还能装多少"，精确到小数没有信息量（数字本来就在实时涨）。
         黄金是货币，不受仓库上限约束（见 domain 的岁贡注释），单独注明。
         上限口径走唯一来源 GAME.storeCap()。 */
      var cap = (k === 'gold') ? 0 : (GAME.storeCap ? GAME.storeCap() : 0);
      /* v65（老板）：「资源数量超过 1 万以万显示，超过 1 亿以亿显示，现在有点占位置」。
         屏幕上改用短写，**精确值进悬停**（想知道确切数目时把鼠标放上去）——
         这样既能一眼比大小，又不丢"到底多少"这个信息。 */
      var amtTip = ((k === 'gold')
        ? '黄金：货币，不受仓储上限约束'
        : (meta ? meta.name : k) + '　上限 ' + U.amtText(cap)
          + '（已占 ' + (cap > 0 ? Math.round(val / cap * 100) : 0) + '%）')
        + '\n现有 ' + U.numText(val, 0);
      html += '<div class="res-line">' +
        '<span class="lbl">' + (meta ? meta.name : k) + '</span>' +
        '<span class="val">' +
          '<span class="amt" title="' + U.escape(amtTip) + '">' + U.amtHTML(val) + '</span>' +
          rateHtml +
          '<span class="plus-btn" data-action="quick-item" data-res="' + k + '" title="使用辅助宝物">+</span>' +
          (have ? '<span class="item-badge">×' + have + '</span>' : '') +
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
        '<td class="ctr">' + (running
          ? '<button class="btn sm' + (hasBoost ? ' gold' : ' dim') + '" data-action="train-boost" data-idx="' + bar.idx + '"'
            + (hasBoost ? '' : ' disabled') + '>加速</button>'
          : '—') + '</td></tr>';
    }).join('');
    return '<div class="q-sec" style="margin-top:14px;"><span class="q-sec-t">本营募兵队列</span>' +
      '<span class="q-sec-n">' + qs.length + ' / ' + slots + ' 条</span></div>' +
      '<table class="tbl"><thead><tr><th>序</th><th>兵种</th><th>状态</th><th>进度</th><th>操作</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      (hasBoost ? '' : '<div class="ui-sub" style="margin-top:4px;">背包中没有可加速募兵的宝物'
        + ui.help('韩信三篇 −30%（每队列限 1 次）\n韩信点兵术 −50%\n均可在商城购得') + '</div>');
  };

  ui.openPanel = function (view, title) {
    var box = ui['PANEL_TITLE'] || {};
    var body = '';
    if (view === 'troops') body = ui.troopsHTML();
    else if (view === 'tech') body = ui.techHTML();
    else if (view === 'equip') body = ui.equipHTML();
    else if (view === 'items') { ui.openBag('item'); return; }
    else if (view === 'generals') body = ui.generalsHTML();
    else if (view === 'stats') body = ui.statsHTML();
    else if (view === 'rank') body = ui.rankHTML();
    else if (view === 'story') body = ui.storyHTML();
    else if (view === 'ext') body = ui.extHTML();
    else body = '<div style="padding:20px;text-align:center;color:var(--text-dim);">此功能暂未开放</div>';
    ui.openModal(
      '<div class="gold-heading">' + (title || box[view] || view) + '</div>' +
      '<div class="panel-body">' + body + '</div>' +
      '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  ui.openEquipPanel = function () { ui.openPanel('equip'); };
  ui.openItemsPanel = function () { ui.openPanel('items'); };

  /* ============================================================
   * 背包（v13）：按类型拆分页签 → 组内分组 → 组内可排序
   *   · 页签：装备 / 材料 / 宝物 / 图纸
   *   · 拆分：不同类型分置于不同页签与分组，互不混杂
   *   · 排序：装备按 品质/价值/套件/部位；材料按 系列/品阶/数量；宝物按 类型/价值
   *   · 每行 5 格，属性走悬停浮层，点击开详情
   * ============================================================ */
  var BAG_TABS = [['equip', '装备'], ['mat', '材料'], ['item', '宝物'], ['bp', '图纸']];
  var EQUIP_SLOT_ORDER = ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist',
    'feet', 'back', 'neck', 'ring', 'pendant', 'mount'];
  var BAG_SORT_OPTS = {
    equip: [['q', '品质'], ['val', '价值'], ['set', '套件'], ['slot', '部位']],
    mat: [['series', '系列'], ['tier', '品阶'], ['have', '数量']],
    item: [['type', '类型'], ['val', '价值']],
    bp: [['val', '价值']],
  };
  ui._bagSort = ui._bagSort || { equip: 'q', mat: 'series', item: 'type', bp: 'val' };

  /* 背包（v25 · 需求 2）：与商城一起由弹窗改为**整页视图** */
  ui.bagHTML = function () {
    var s = GAME.state;
    var t = ui._bagTab || 'equip';
    var sort = ui._bagSort[t] || (BAG_SORT_OPTS[t] || [['q', '']])[0][0];

    var html = '';
    /* 页签 */
    html += '<div class="subtabs" style="margin:0 0 8px;justify-content:center;">' +
      BAG_TABS.map(function (x) {
        return '<span class="sub' + (t === x[0] ? ' active' : '') + '" data-action="bag-tab" data-v="' + x[0] + '">' + x[1] + '</span>';
      }).join('') + '</div>';
    /* 排序条 */
    html += '<div class="bag-sortbar"><span class="lb">排序</span>' +
      (BAG_SORT_OPTS[t] || []).map(function (o) {
        return '<span class="chip' + (sort === o[0] ? ' on' : '') + '" data-action="bag-sort" data-v="' + o[0] + '">' + o[1] + '</span>';
      }).join('') +
      '<span class="bag-total">' + ui.bagSummary(t) + '</span></div>';
    html += '<div class="bag-body">';

    if (t === 'equip') html += ui.bagEquipHTML(sort);
    else if (t === 'mat') html += ui.bagMatHTML(sort);
    else if (t === 'bp') html += ui.bagBpHTML(sort);
    else html += ui.bagItemHTML(sort);

    html += '</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🎒 背包 · ' + (BAG_TABS.filter(function (x) { return x[0] === t; })[0] || ['', ''])[1] +
        ui.help('悬停格子看属性\n点格子开详情\n装备可穿戴，也可拆解回收材料') +
      '</div>' + html + '</div>';
  };
  ui.openBag = function (tab) {
    if (tab) ui._bagTab = tab;
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

  /* 背包总量摘要 */
  ui.bagSummary = function (t) {
    var s = GAME.state;
    if (t === 'equip') return '装备 ' + (s.inventory || []).length + ' 件';
    if (t === 'mat') {
      var n = 0;
      DATA.MATERIALS.forEach(function (m) { n += (s.items || {})[m.id] || 0; });
      var kinds = DATA.MATERIALS.filter(function (m) { return (s.items || {})[m.id] > 0; }).length;
      return '材料 ' + n + ' 个 / ' + kinds + ' 种';
    }
    var cnt = 0;
    for (var k in (s.items || {})) {
      if (DATA.MATERIAL_BY_ID[k]) continue;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === k) it = x; });
      if (!it) continue;
      if (t === 'bp' && it.type !== 'blueprint') continue;
      if (t === 'item' && it.type === 'blueprint') continue;
      cnt += s.items[k] || 0;
    }
    return (t === 'bp' ? '图纸 ' : '宝物 ') + cnt + ' 个';
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
  ui.BAG_PER_PAGE = 16;
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
  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var inv = (s.inventory || []).filter(function (x) { return !!DATA.EQUIP[GAME.eqId(x)]; });
    if (!inv.length) return '<div class="q-empty">背包暂无装备。点城内「铁匠铺」打造，或攻占城池缴获。</div>';
    /* 已穿戴件号（角标/提示用） */
    var wornByU = {};
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都标记 */
        for (var sl in (g[bk] || {})) {
          var u = GAME.eqUidOf(g[bk][sl]);
          if (u != null) wornByU[u] = g.name;
        }
      });
    });
    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (inst) {
      var it = DATA.EQUIP[GAME.eqId(inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(inst);
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
        return ui.bagCmp('equip', sort, GAME.eqId(x), GAME.eqId(y))
          || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
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
      var cells = arr.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : (DATA.EQUIP_SLOT_ICON[it.slot] || ''),
          name: GAME.eqLabel(inst),
          q: it.q, worn: wornByU[u] || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'open-bag-equip', key: (u != null ? u : id),
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
  ui.bagItemHTML = function (sort) {
    var s = GAME.state, items = s.items || {};
    var CN = {
      jewel: '珠宝（赏赐忠诚）', attr_buff: '符类', prod_buff: '生产', military_buff: '军事',
      boost: '加速', exp: '经验', stamina: '体力精力', perm: '永久丹药', mount_buff: '坐骑',
      rank_up: '灵草（提升资质）',
      seed: '种子（种田秘境）',
    };
    var groups = {};
    Object.keys(items).forEach(function (id) {
      if ((items[id] || 0) <= 0) return;
      if (DATA.MATERIAL_BY_ID[id]) return;
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === id) it = x; });
      if (!it || it.type === 'blueprint') return;
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
      arr.forEach(function (it) {
        var have = items[it.id] || 0;
        var inputId = 'ui-' + it.id;
        rows.push(ui.itemRow({
          kind: 'item', id: it.id, q: 1,
          name: U.escape(it.name),
          tagHtml: '<span class="ir-tag">' + CN[tp].replace(/（.*/, '') + '</span>',
          /* v51：同商城 —— desc 只出一次（改前 desc 与 itemEffect 各拼一遍，卡里出现三遍）。
             估值保留：它是背包特有的量（持有 X　估值 Y），与商城的「单价」不是同一张卡里的重复。 */
          meta: '持有 <b>' + U.numText(have, 0) + '</b>' + (it.price ? '　估值 ' + U.fmt(it.price * 100) + ' 金' : ''),
          desc: '<span style="color:var(--gold-light);">' +
            U.escape(GAME.itemEffect(it) || '') + '</span>',
          /* v78：种子不"使用"—— 按钮直接指路种田秘境；数量输入框对种子无意义，撤 */
          qtyHtml: it.type === 'seed' ? '' : ui.qtyInput(inputId, 1, 0, Math.max(1, have), true),
          totalHtml: '',
          actHtml: it.type === 'seed'
            ? '<button class="btn gold" data-action="open-farm">去播种</button>'
            : '<button class="btn gold" data-action="use-bag-item" data-key="' + it.id +
              '" data-qty-from="' + inputId + '">使用</button>',
        }));
      });
    });
    if (!any) return '<div class="q-empty">背包中暂无宝物。</div>';
    /* v29（需求 4）：宝物页同样分页（每页 8 行），翻页条在底部固定条 */
    return ui.pageRows('bag-item', rows.map(function (h) { return { cell: h }; }), 16);
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
    var actAttr = (o.act ? ' data-action="' + o.act + '" data-key="' + o.key + '"' : ' data-action="bag-detail" data-key="' + o.key + '"') + (o.gen ? ' data-gen="' + o.gen + '"' : '');
    return '<div class="bag-cell ' + (o.cls || '') + '"' + actAttr + ' data-tip-el="1">' +
      (!o.noStar && o.q ? '<span class="bag-q">' + '★'.repeat(Math.min(4, o.q)) + '</span>' : '') +
      (o.cnt ? '<span class="bag-cnt">×' + o.cnt + '</span>' : '') +
      (o.worn ? '<span class="bag-worn">' + U.escape(o.worn.charAt(0)) + '</span>' : '') +
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
        '<button class="btn red" data-action="salvage-equip" data-key="' + key + '">拆解回收</button></div>';
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
      /* v78（老板需求 1）：种子**不售** —— 来源写清楚（商城价一栏对种子没有意义） */
      html += '<div class="attr"><span class="k">来源</span><span class="v good">采集归来 · 出征缴获（不售）</span></div>';
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
      size: 'xl',
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
          '<tr><td class="k">爵位</td><td>' + (cur ? cur.name : '平民') +
            ' <span class="ui-sub">（' + (s.rank || 0) + ' / ' + (DATA.RANK.length - 1) + '）</span>　' +
            (next
              ? '<button class="btn sm' + (chk && chk.ok ? ' gold' : '') + '" data-action="lord-promote" title="' +
                  U.escape(condTitle) + '">晋升：' + next.name + '</button>'
              : '<span style="color:var(--gold-light);">已登顶</span>') +
            '</td></tr>' +
          /* v79（老板）：爵位加成 / 主城 / 神器 —— 三条新系统的入口与现况 */
          '<tr><td class="k">爵位加成</td><td style="color:var(--green-ok);">' + GAME.rankBonusText() + '</td></tr>' +
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
          (lg ? '<tr><td class="k">君主领兵</td><td>Lv' + lg.level + ' · ' +
            ui.genStatusName(lg) + '（不可解雇）</td></tr>' : '') +
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
      { size: 'xl' });
  };

    /* ============================================================
   * 募兵加速（v28 · 需求 8）
   * ------------------------------------------------------------
   * 列出背包里所有 target=train 的宝物，点一下给**这座军营正在跑的那条队列**加速。
   * 弹窗里同时显示该队列的剩余时间，加速后再刷新一次 —— 让"提前了多少"看得见。
   * ============================================================ */
  ui.openTrainBoost = function (bIdx) {
    var c = GAME.currentCity();
    var bar = null;
    GAME.barracksOf(c).forEach(function (x) { if (x.idx === bIdx) bar = x; });
    if (!bar) { ui.toast('未找到该军营'); return; }
    var qs = GAME.trainQueuesOf(c, bIdx);
    var run = null;
    for (var i = 0; i < qs.length; i++) if (!qs[i].waiting) { run = qs[i]; break; }
    if (!run) run = qs[0];
    var head = '<div class="gold-heading">⚡ 募兵加速 · 城内第 ' + (bIdx + 1) + ' 格军营</div>';
    if (!run) {
      ui.openModal(head + '<div class="q-empty">本营当前没有进行中的募兵任务</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var t = DATA.TROOPS[run.troopId] || {};
    var left = Math.max(0, (run.totalTime - (run.elapsed || 0)) / GAME.timeScale());
    var list = GAME.systems.trainBoostItems();
    var body = '<div class="attr"><span class="k">募兵中</span><span class="v">' +
      (t.name || run.troopId) + ' ×' + U.numText(run.count, 0) + '</span></div>' +
      '<div class="attr"><span class="k">剩余</span><span class="v good">' + U.durExact(left) + '</span></div>' +
      (run.boost && Object.keys(run.boost).length
        ? '<div class="attr"><span class="k">已用加速</span><span class="v">' +
          Object.keys(run.boost).join('、') + '</span></div>' : '');
    if (!list.length) {
      body += '<div class="q-empty" style="margin-top:10px;">背包中没有可加速募兵的宝物（商城 · 加速 一类）</div>';
    } else {
      body += '<div class="xc-list" style="margin-top:8px;">' + list.map(function (it) {
        var used = run.boost && run.boost[it.id];
        var dis = it.once && used;
        return '<div class="xc-row">' +
          '<div class="xc-ico">' + (GAME.icons.forItem ? GAME.icons.forItem(it.type, it.id) : '') + '</div>' +
          '<div class="xc-info"><b>' + U.escape(it.name) + ' ×' + (GAME.state.items[it.id] || 0) + '</b>' +
            '<span class="xc-prod">' + U.escape(it.desc || '') + '</span></div>' +
          '<button class="btn sm' + (dis ? ' dim' : ' gold') + '" data-action="do-train-boost" data-item="' + it.id +
            '" data-idx="' + bIdx + '"' + (dis ? ' disabled' : '') + '>' + (dis ? '已用过' : '加速') + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }
    ui.openShell({
      title: '', sub: '',
      size: 'md',
      body: head + body,
      foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
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
    var acts = GAME.jianghuActsAt(tile.terrain);
    if (!acts.length) return '';
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
    var h = '<div class="op-zone" style="margin-top:8px;">' +
      '<div class="op-zone-t">☯ 江湖游历　<span style="color:var(--text-dim);font-weight:400;font-size:var(--fs-sub);">君主亲往 · 每事每日一次 · 看灵力判定</span></div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin:4px 0 6px;">江湖诸事皆由君主亲历：讨伐切磋、采药静修、拜访奇人——点开即入全屏剧情，精华用于蕴养修炼装备。</div>';
    if (res) {
      h += '<div class="note" style="margin:4px 0;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">' +
        U.escape(res.name + '：' + res.text) + '</div>';
    }
    if (!own.length) {
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
  ui.openSceneFx = function (fx) { ui._sceneFx = fx; ui.renderSceneFx(); };
  ui.renderSceneFx = function () {
    var fx = ui._sceneFx;
    if (!fx) return;
    var el = document.getElementById('scene-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scene-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);
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
  ui.SXF_KIND = { fight: '征伐', trial: '试炼', gather: '采撷', cultivate: '修真', visit: '访贤', scene: '游历' };
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

  /* 附属野地弹窗（原版「附属野地」） */
  ui.openWilds = function () {
    var s = GAME.state;
    var wilds = s.wilds || [];
    var RES_NAME = ui.RES_NAME, RES_ICON = ui.RES_ICON;

    /* 野地对各类资源的贡献折算（用总产量反推：贡献 = 总产 × m/(1+m)） */
    var prod = GAME.productionPerSec();
    var wm = (GAME.wildMult && GAME.wildMult()) || {};
    var contrib = {};
    ['grain', 'wood', 'stone', 'iron', 'gold'].forEach(function (k) {
      var m = wm[k] || 0;
      contrib[k] = m > 0 ? prod[k] * m / (1 + m) * 3600 / GAME.timeScale() : 0;
    });

    var rows = wilds.map(function (w, wi) {
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
      return '<tr' + (wi === (ui._wildSel || 0) ? ' style="background:rgba(201,162,75,.10);"' : '') +
        '><td>' + (t ? t.name : w.type) + '</td><td class="ctr">' + w.x + ',' + w.y + '</td>' +
        '<td class="ctr">Lv' + w.level + '</td><td class="ctr">' + resStr + '</td>' +
        '<td class="ctr" style="color:' + (ga ? 'var(--gold-light)' : 'var(--green-ok)') + ';">' + addStr + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:var(--sp-5);">尚未占领野地（在地图点击野地格派兵占领）</td></tr>';

    /* 野地合计贡献 */
    var totalLine = ['grain', 'wood', 'stone', 'iron'].map(function (k) {
      var v = contrib[k];
      return '<span class="wild-res">' + RES_ICON[k] + RES_NAME[k] +
        ' <b>' + (v > 0 ? '+' + U.fmt(v) : '0') + '</b>/时</span>';
    }).join('');

    var cap = GAME.buildingLevel(GAME.currentCity(), 'guanfu') || 1;
    var sky = GAME.story ? GAME.story.skyLine() : '';
    var gN = GAME.gatherList().length, gMax = DATA.GATHER.maxActive;
    ui.openModal(
      '<div class="gold-heading">🏕️ 附属野地（' + wilds.length + '/' + cap + '）</div>' +
      (sky ? '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">' + sky + '</div>' : '') +
      '<div style="text-align:center;margin-bottom:8px;">' +
        '<button class="btn sm' + (gN ? ' gold' : '') + '" data-action="open-gathers">📦 采集队 ' + gN + '/' + gMax + '</button>' +
        '</div>' +
      '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th><th>产出资源</th><th>加成 / 采集</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="wild-total"><span style="color:var(--text-dim);font-size:var(--fs-sub);">野地贡献合计</span>' + totalLine + '</div>' +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>'
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
  };
  ui.shopItems = function () {
    return DATA.ITEMS.filter(function (it) { return it.price > 0; });
  };
  ui.openShop = function (cat) {
    var all = ui.shopItems();
    var catKeys = Object.keys(ui.SHOP_CATS).filter(function (c) {
      return all.some(function (it) { return it.type === c; });
    });
    if (cat && catKeys.indexOf(cat) >= 0) ui._shopCat = cat;
    if (!ui._shopCat || catKeys.indexOf(ui._shopCat) < 0) ui._shopCat = catKeys[0] || 'material';
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
    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<div class="ir-art">' + ui.itemArt(o.kind, o.id, o.q) + '</div>' +
      '<div class="ir-info">' +
        '<div class="ir-name">' + o.name + (o.tagHtml || '') + '</div>' +
        '<div class="ir-meta">' + (o.meta || '') + '</div>' +
        (o.desc ? '<div class="ir-desc">' + o.desc + '</div>' : '') +
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
    var catKeys = Object.keys(ui.SHOP_CATS).filter(function (c) {
      return all.some(function (it) { return it.type === c; });
    });
    var cat = ui._shopCat || catKeys[0];
    var items = all.filter(function (it) { return it.type === cat; });
    var per = ui.SHOP_PER_PAGE;
    var p = ui.pageOf('shop-items', items.length, per);
    var slice = items.slice(p.from, p.to);
    ui.pagerHTML('shop-items', items.length, per);

    var tabs = catKeys.map(function (c) {
      var n = all.filter(function (it) { return it.type === c; }).length;
      return '<span class="shop-cat' + (c === cat ? ' on' : '') + '" data-action="shop-cat" data-c="' + c + '">'
        + ui.SHOP_CATS[c] + '<i>' + n + '</i></span>';
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
        desc: '<span style="color:var(--gold-light);">' +
          U.escape(GAME.itemEffect(it) || '') + '</span>',
        qtyHtml: ui.qtyInput(inputId, 1, price, cap),
        totalHtml: '<span class="ir-total" id="' + inputId + '-total" data-label="合计">合计 ' +
          U.numText(price, 0) + ' 金</span>',
        actHtml: '<button class="btn' + (canBuy ? ' gold' : ' dim') + '" data-action="shop-buy" data-item="' + it.id + '"' +
          (canBuy ? '' : ' disabled') + '>购买</button>',
      });
    }).join('');

    return '<div class="ui-page">' +
      '<div class="gold-heading">🛒 商城 · ' + (ui.SHOP_CATS[cat] || cat) +
        ui.help('每行左侧贴图、右侧说明；下方填数量（可点 −/＋ 微调，或直接键入）后点「购买」。\n' +
          '单价 = 元宝价 × 100 金；分页条固定在屏幕下方。') +
      '</div>' +
      '<div class="shop-cats">' + tabs + '</div>' +
      (rows ? '<div class="shop-rows">' + rows + '</div>'
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
      return '<span class="' + (have >= need ? '' : 'lack') + '">' +
        (md ? md.name : mk) + ' ' + have + '/' + need + src + '</span>';
    });
    var blockers = [];
    if (!f.tierOk) blockers.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[f.q - 1] || 7));
    if (!f.bpOk) blockers.push('缺图纸「' + (f.bp ? f.bp.name : '') + '」');
    if (!f.matsOk) blockers.push('材料不足');
    if (!GAME.canAfford(f.cost)) blockers.push('资材不足');
    var ok = !blockers.length;
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
        (ok ? '' : '<br><span style="color:var(--red-light);">' + blockers.join('　') + '</span>'),
      actHtml: '<button class="btn' + (ok ? ' gold' : ' dim') + '" data-action="forge-item" data-item="' + f.id +
        '"' + (ok ? '' : ' disabled') + '>打造</button>',
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
    var kindHtml = [['all', '全部', list.length], ['set', '套装', setsOnly.length], ['solo', '散件', soloOnly.length]]
      .map(function (k) {
        return '<span class="shop-cat' + (kind === k[0] ? ' on' : '') +
          '" data-action="forge-kind" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');
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
    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });
    var tabHtml = qs.map(function (q) {
      var n = pool.filter(function (f) { return f.q === q; }).length;
      var okN = pool.filter(function (f) { return f.q === q && f.tierOk; }).length;
      return '<span class="shop-cat' + (q === curQ ? ' on' : '') + '" data-action="forge-q" data-q="' + q + '">' +
        (DATA.Q_NAME[q] || ('Q' + q)) + '<i>' + okN + '/' + n + '</i></span>';
    }).join('');
    ui.openShell({
      title: '⚒️ 铁匠铺 · Lv' + lv,
      sub: '可打造至「' + (DATA.Q_NAME[maxQ] || '—') + '」　黄金 ' + U.numText(s.res.gold || 0, 0) +
        '　铁 ' + U.numText(s.res.iron || 0, 0) + '　木 ' + U.numText(s.res.wood || 0, 0) +
        '　石 ' + U.numText(s.res.stone || 0, 0),
      size: 'xl',
      body: '<div class="forge-filter">' +
          '<span class="ff-k">类别</span><span class="shop-cats">' + kindHtml + '</span>' +
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
            : kind === 'solo' ? '该品质暂无散件。' : '该品质暂无可打造之物。') + '</div>') +
        (rows.length ? pg.pager : ''),
      foot: '<div class="m-foot"><button class="btn gold" data-action="open-enhance">⚒ 百炼强化</button>' +
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
    }).join('') || '<div class="q-empty">还没有修炼装备。到野地「江湖游历」讨伐/试炼/采集，可得修炼装备与灵气精华。</div>';
    ui.openShell({
      title: '☯ 蕴养 · 修炼装备',
      sub: '**按件**蕴养（同名以 甲/乙/丙 区分）　满级 +' + GAME.lingTemperMax() + '　灵气精华 ' + ess + '（野地游历获得）',
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
    ui._bagTab = t;
    ui._pages['bag-' + t] = 1;
    ui.renderBag();
  };
  ui.setBagSort = function (v) {
    var t = ui._bagTab || 'equip';
    ui._bagSort[t] = v;
    ui._pages['bag-' + t] = 1;
    ui.openBag(t);
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

    /* v19：史册是**只增不减**的记账（一条不删），必须分页（每页 20），
       否则玩得越久这一页越长。 */
    var items = (s.chronicle || []).slice().reverse();
    var pgS = ui.pageOf('chronicle', items.length, 20);
    var chron = items.length ? items.slice(pgS.from, pgS.to).map(function (e) {
      return '<div class="chron-item tag-' + e.tag + '">' +
        '<span class="chron-era">' + e.era + '·' + e.seasonName + '</span>' +
        '<span class="chron-txt">' + U.escape(e.text) + '</span></div>';
    }).join('') : '<div style="color:var(--text-dim);padding:12px;text-align:center;">史册尚空，待君书写。</div>';

    var chronHtml =
      '<div class="story-card">' +
        '<div class="gold-heading">📜 史书纪事（' + items.length + ' 条）</div>' +
        '<div class="chron-list">' + chron + '</div>' +
        ui.pagerHTML('chronicle', items.length, 20) +
      '</div>';

    return '<div class="ui-page">' +
      '<div class="story-grid"><div>' + sky + goalHtml + '</div><div>' + power + titleHtml + '</div></div>' +
      chronHtml +
      '</div>';
  };

  /* ================= 客栈：招募 / 相亲 ================= */
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
            (can ? '' : ' disabled') + '>' + (c.beauty ? '相亲' : '招募') + '</button>' +
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
      title: '🍶 客栈 · Lv' + lv,
      sub: '每级 1 位候选　|　' + U.escape(city.name) + ' 招贤馆空位 ' + usedIn + '/' + cap +
        '　|　' + leftTxt,
      body:
        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +
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

  /* ================= 市场：资源互换 ================= */
  ui.openMarket = function () {
    var s = GAME.state;
    var lv = GAME.caravanCount();
    if (lv <= 0) {
      ui.openModal('<div class="gold-heading">🏪 市集</div>' +
        '<div class="q-empty">尚未建造市场</div>' +
        '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    var resChips = function (sel, target) {
      return ui.chips({
        cls: 'res-chips', target: target, after: 'market',
        opts: ['grain', 'wood', 'stone', 'iron'].map(function (k) {
          var meta = null;
          DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
          return { v: k, on: k === sel, label: (meta ? meta.icon + meta.name : k) };
        })
      });
    };
    var rate = GAME.marketRate();
    ui.openModal(
      '<div class="gold-heading">🏪 市集 · Lv' + lv + '（商队 ' + lv + '）</div>' +
      '<div class="note-warn" style="background:rgba(90,164,105,.12);border-color:rgba(90,164,105,.4);color:var(--green-ok);">' +
        '当前汇率：1 : ' + rate.toFixed(2) + '（折损 ' + Math.round((1 - rate) * 100) + '%，市场等级越高折损越小）</div>' +
      '<input type="hidden" id="mk-from" value="grain"><input type="hidden" id="mk-to" value="wood">' +
      '<div class="mk-row mk-pick">' +
        resChips('grain', 'mk-from') +
        '<span class="mk-arrow">→</span>' +
        resChips('wood', 'mk-to') +
      '</div>' +
      '<div class="mk-row"><input type="number" id="mk-amount" min="1" value="1000" placeholder="数量"><span class="mk-hint">投入数量</span></div>' +
      '<div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px;">' +
        [1000, 5000, 10000, 50000].map(function (v) {
          return '<button class="btn sm" data-action="mk-preset" data-v="' + v + '">' + U.fmt(v) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="res-line" style="margin-top:10px;border:none;"><span class="lbl">库存</span><span class="val">粮 ' + U.fmt(s.res.grain) + '　木 ' + U.fmt(s.res.wood) + '　石 ' + U.fmt(s.res.stone) + '　铁 ' + U.fmt(s.res.iron) + '</span></div>' +
      '<div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;">' +
        '<button class="btn gold" data-action="market-trade">确认兑换</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* ================= 仓库：储量上限 ================= */
  ui.openStore = function () {
    var s = GAME.state;
    var lv = GAME.buildingLevel(GAME.currentCity(), 'cangku') || 0;
    var cap = GAME.storeCap();
    var near = lv > 0 ? '' : '<div class="note-warn">未建仓库：仅保有基础储量 ' + U.fmt(cap) + '，超出部分将停止增长</div>';
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
      '<div class="gold-heading">🏚️ 仓库 · Lv' + lv + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:8px;">每级 +' + U.fmt(2000000) + ' 储量上限</div>' +
      near + rows +
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
   * 现在招贤馆只讲它**自己**负责的事：房间数（将领容量）、满级专精、
   * 缺房时该怎么办。要看谁在帐下 → 去「将领」菜单。
   * ============================================================ */
  ui.openHostel = function () {
    var s = GAME.state;
    var c = GAME.currentCity();
    var lv = GAME.buildingLevel(c, 'zhaoxianguan') || 0;
    /* v64：席位是**这座城**的（`genSlotsOf`），在册人数也是**这座城**的 */
    var cap = GAME.genSlotsOf(c);
    var used = GAME.generalsIn(c).length;
    var mp = GAME.masteryOf ? GAME.masteryOf(c, 'zhaoxianguan') : false;
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
      (mp ? '<div class="attr"><span class="k">满级专精</span><span class="v good">房间 +2</span></div>' : '') +
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
      size: 'sm',
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
    else if (v === 'stats') box.innerHTML = ui.statsHTML();
    else if (v === 'reports') box.innerHTML = ui.reportsHTML();
    else if (v === 'settings') box.innerHTML = ui.settingsHTML();
    /* v29（需求 5）：自动化独立成菜单（自动升级 / 研究 / 出征） */
    else if (v === 'auto') box.innerHTML = ui.autoHTML();
    else if (v === 'story') box.innerHTML = ui.storyHTML();
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
  ui.zoomBarHTML = function () {
    var cur = ui.zoom();
    return '<div class="zoom-bar">' + ui.chips({
      cls: 'chips-xs', after: 'zoom',
      opts: (DATA.ZOOM_LEVELS || [80, 100, 120, 140, 160]).map(function (z) {
        return { v: z, on: z === cur, label: z + '%' };
      })
    }) + '</div>';
  };
  ui.zoomStyle = function () { return 'zoom:' + (ui.zoom() / 100) + ';'; };

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
    var board = ui.isoBoard(COLS, ROWS, cells, { wall: true, wallAction: 'open-wall' });
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
  ui.isoWallSVG = function (cols, rows) {
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
      + (opt.wall ? ui.isoWallSVG(cols, rows) : '')
      + inner
      + (opt.wall ? ui.wallHitHTML(cols, rows, opt.wallAction) : '')
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
      /* v39：挂 `ser-<系列>` —— 城内建筑按行当分色（数据侧唯一来源 DATA.SERIES） */
      return ui.isoCell({ M: M, col: col, row: row,
        cls: 'built ser-' + (b.series || 'gov'), built: true, idx: idx, act: 'build-cell',
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
    guanfu: { label: "🏯 官府事务", act: "open-guanfu" },
    junying: { label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true },
    xiaochang: { label: "🏹 出征 · 伤兵", act: "open-xiaochang" },
    shuyuan: { label: "📜 科技 · 研究", act: "open-panel", view: "tech" },
    kezhan: { label: "🍶 招募将领", act: "open-inn" },
    zhaoxianguan: { label: "🎎 将领名录", act: "open-hostel" },
    shichang: { label: "🏪 交易", act: "open-market" },
    cangku: { label: "🏚️ 仓储", act: "open-store" },
    majiu: { label: "🐎 坐骑装备", act: "open-panel", view: "equip" },
    tiejiangpu: { label: "⚒️ 打造", act: "open-forge" },
    gongjiangzuofang: { label: "🛠️ 器械 · 箭塔", act: "open-workshop", withIdx: true },
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

  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var cell = c.cells[idx];
    ui._curGrid = idx;
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
            '<div class="op-zone-t">功能（升级中照常可用）</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + fn.act + '"' + (fn.view ? ' data-view="' + fn.view + '"' : '') +
              (fn.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + fn.label + '</button></div>' +
          '</div>')
          : '') +
        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');
      return;
    }
    if (cell.build) {
      var b = DATA.BUILDINGS[cell.build.id];
      /* v68 · 逐步探索：卡在官府等级上时，'已满级' 会误导 —— 用前置检查给出准确原因 */
      var preUp = GAME.buildPrereqOf(c, cell.build.id);
      var upCost = cell.build.lvl < GAME.buildCapOf(c, cell.build.id) ? b.levelCost(cell.build.lvl) : null;
      var costStr = upCost ? GAME.costString(upCost) : (preUp.ok ? '已满级' : preUp.short);
      var extra = '';
      if (b.id === 'minfang') extra = '<div class="attr"><span class="k">人口上限</span><span class="v good">' + b.pop[cell.build.lvl - 1] + '</span></div>';
      /* v82（老板）：「不需要显示附属野地/城外空地及其数量」—— 官府弹窗这两行退役。 */
      if (b.id === 'xiaochang') extra = '<div class="attr"><span class="k">出征</span><span class="v">' + cell.build.lvl + '队 ×' + (cell.build.lvl * 10000).toLocaleString() + '人口</span></div>';
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
      if (b.id === 'cangku') extra = '<div class="attr"><span class="k">本仓储量</span><span class="v">' + U.fmt(GAME.storeCap() / Math.max(1, GAME.buildingLevelSum(c, 'cangku')) || 0) + '</span></div>'
        + '<div class="attr"><span class="k">全境储量上限</span><span class="v good">' + U.fmt(GAME.storeCap()) + '（多仓叠加）</span></div>';
      if (b.id === 'shichang') extra = '<div class="attr"><span class="k">商队</span><span class="v">' + bLv + ' 支</span></div>'
        + '<div class="attr"><span class="k">交易汇率</span><span class="v">1 : ' + Math.min(0.95, 0.6 + bLv * 0.035).toFixed(2) + '</span></div>';
      if (b.id === 'majiu') extra = '<div class="attr"><span class="k">骑兵解锁</span><span class="v">轻骑需1级 · 铁骑/突骑需3级 · 虎豹/西凉需4级</span></div>';
      /* v60（需求 3）：**满级专精写在这里**（老板：「写在对应建筑的介绍里就好，
         不要写在全境汇总」）。数据驱动 —— 本建筑在 DATA.MASTERY 里有条目就显示，
         未满级报"目标"、已满级报"已达成"。
         不逐个建筑手写文案：那又是一份平行数据，改一处忘一处。 */
      var mast = null;
      (DATA.MASTERY || []).forEach(function (m) { if (m.bid === b.id) mast = m; });
      if (mast) {
        var gotM = GAME.masteryOf(c, b.id);
        extra += '<div class="attr"><span class="k">满级专精</span><span class="v' + (gotM ? ' good' : '') + '">'
          + (gotM ? '已达成 · ' : 'Lv' + DATA.MAX_BLEVEL + ' 达成 · ') + mast.txt + '</span></div>';
      }
      ui.openModal(
        /* v73（老板）：顶部图标不留（旧 emoji 图标本就不如棋盘位图，索性撤下）。
           v76（老板）：「这种备注去掉：招募将领（每级+1停留将领），市井传闻查名将坐标」——
           标题下的建筑描述（b.desc）连同「拆毁可返还累计投入的 50%：粮…」长备注一并撤除。 */
        '<div class="gold-heading">' + b.name + ' · Lv' + cell.build.lvl + '</div>' +
        extra +
        barQueue +
        /* v68（弹窗统一 · 设计规范 §11）动线：① 功能「用建筑」（金色主按钮）；
           v76（老板）：「建筑的升级，拆除（1级，只能逐级拆除），移动/交换放在同一行上，
           并进行你的设计小巧思。建筑界面的关闭按钮在弹窗界面的最底部」——
           ② 操作三键**同排**、等宽，每键带一行小字说明后果（费用 / 降级去向 / 用途）；
           ③ 关闭单独一行、钉在弹窗最底部。 */
        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button></div>' +
          '</div>') : ''; })() +
        /* v80（老板）：「升级，拆除（拆1级），移动/交换固定放在底部，关闭的上方」——
           三键与关闭合成一块**吸底操作区**（.bldg-bottom）：内容再长也钉在弹窗下沿，
           上排＝操作三键，下排＝关闭。 */
        '<div class="bldg-bottom">' +
          '<div class="bldg-acts">' +
          (upCost
            ? '<button class="btn gold bldg-act" data-action="confirm-upgrade" data-idx="' + idx + '">⬆ 升级 → Lv' + (cell.build.lvl + 1) +
                '<span class="ba-sub">费用 ' + costStr + '</span></button>'
            : '<button class="btn bldg-act dim" disabled>⬆ 升级<span class="ba-sub">' +
                (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span></button>') +
          '<button class="btn red bldg-act" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="拆除需二次确认">⛏ 拆 1 级<span class="ba-sub">' +
            (cell.build.lvl > 1 ? ('Lv' + cell.build.lvl + ' → Lv' + (cell.build.lvl - 1)) : '整座移除') + '</span></button>' +
          (b.id === 'guanfu' ? ''
            : '<button class="btn bldg-act" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换<span class="ba-sub">与地块互换</span></button>') +
          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      );
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
      var all = DATA.BUILD_ORDER.map(function (bid) {
        var b = DATA.BUILDINGS[bid];
        var cost = GAME.costString(b.buildCost);
        var lockMsg = '', afford = '', tip = b.desc + '｜耗：' + cost;
        if (!GAME.canAfford(b.buildCost)) { afford = ' disabled'; lockMsg = '材料不足'; tip += '｜材料不足'; }
        if (UNIQUE[bid] && GAME.buildingLevel(c, bid) > 0) { afford = ' disabled'; lockMsg = '已建造(唯一)'; tip += '｜本城已建有（唯一建筑）'; }
        if (bid === 'guanfu') { afford = ' disabled'; lockMsg = '官府初始自带'; tip += '｜官府初始自带'; }
        /* v68 · 逐步探索：前置不满足 → 置灰并写明原因（"需客栈 Lv2"） */
        var preB = GAME.buildPrereqOf(c, bid, 1);
        if (!preB.ok) { afford = ' disabled'; lockMsg = preB.short; tip += '｜' + preB.msg; }
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
  ui.openGuanfu = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!c) return;
    var lv = GAME.buildingLevel(c, 'guanfu') || 1;
    var isSelf = (c.type || 'self') === 'self';
    var stateName = GAME.stateOfCity(c);            /* 特产 / 州治判定与岁贡同源 */
    var rn = GAME.canRenameCity(c);
    var isMain = GAME.isMainCity(c);

    /* v45（需求 4）：**重命名入口提到身份行旁边**（面板一长就落到折叠线以下，
       老板因此以为"官府根本没有改名功能"）；v79：主城设置按钮随行。
       v82（老板）：「不需要显示"本城"，城市名称居中，字体稍大即可」——
       档位括注（自建城）/「本城」标签 / 原名标注全部撤下，只留居中放大的城名
       （主城徽记保留），操作按钮另起一行居中。 */
    var mainBtn = isMain
      ? ''
      : ' <button class="btn sm" data-action="set-main-city" title="' +
          U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
            + (GAME.mainCityOf()
                ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                : '　（首设免费）')) +
        '">设为主城</button>';
    var head = '<div class="gold-heading">🏯 官府 · Lv' + lv + '</div>' +
      '<div class="city-title">' + U.escape(c.name) +
        (isMain ? ' <span class="city-tier mt">主城</span>' : '') + '</div>' +
      '<div class="city-sub">' +
        '<button class="btn sm' + (rn.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
        (rn.ok ? '' : ' disabled') + ' title="' +
        U.escape(rn.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn.msg) +
        '">✎ 重命名</button>' + mainBtn +
      '</div>';

    /* v82（老板）：「官府不需要征收物质这个功能去除」——
       征收（物资/特产表 + 立即征收按钮 + 冷却同步）整段退役；
       种田秘境入口（v73 原与征收同排）独立成区保留。 */
    var farmBox = '<div class="op-zone"><div class="op-row">' +
      '<button class="btn gold" data-action="open-farm"' +
        ' title="种田秘境：个人田庄灵田种灵植，收高阶打造材料与资质灵草">🌾 种田秘境</button>' +
      '<span class="op-hint">灵田种灵植：打造材料 + 资质灵草</span>' +
      '</div></div>';

    /* 需求 5 的正面回答直接写进面板：特产到底怎么收集。
       v65（老板「按建议执行」）：**说明性文字全部进 ui.help** ——
       原先这三条各占一个 `.attr` 行（+ lore 两行）约 140px，
       把官府面板顶出弹窗可视高度（几何探针实测 1600×950 就超 29px、720p 超 87px）。
       按老板的界面规范「弹窗正文是最稀缺的资源，说明一律进 help」收进标题旁的 ⓘ，
       面板正文只留**当前事实**：特产是什么、本州归谁。 */
    var sp = isSelf ? null : GAME.specialtyOf(c);    /* v82：原走 levyPlan，随征收退役改直读 */
    var spBox = '';
    if (sp) {
      var m = DATA.MATERIAL_BY_ID[sp.mat];
      spBox = '<div class="op-zone"><div class="op-zone-t">本城特产 · ' + (m ? m.name : sp.mat) +
          '（' + sp.tier + ' 阶）' +
          ui.help('如何收集本城特产：\n' +
            '① 州郡岁贡 —— 每现实日自动入府，无需操作\n' +
            '② 州治加成 —— 握有本州州城时，本州特产产量 ×' + DATA.STATE_SEAT_BONUS +
            (sp.lore ? '\n\n' + sp.lore : '')) +
        '</div>' +
        '<div class="attr"><span class="k">本州归属</span><span class="v">' + (stateName || '—') +
          (GAME.hasStateSeat(stateName) ? '（州治在握）' : '') + '</span></div>' +
        '</div>';
    } else if (!isSelf) {
      spBox = '<div class="op-zone"><div class="op-zone-t">本城特产</div>' +
        '<div class="q-empty">该城未归属任何州，无特产岁贡。</div></div>';
    }

    /* v25（需求 5）：州郡岁贡收进名城的官府 —— 它是"这块地盘值多少"，
       属于官府的账，不是需要常驻屏幕的信息。 */
    var yieldBox = '';
    if (!isSelf) {
      var y = GAME.cityDailyYield(c);
      if (y) {
        var m = y.mat ? DATA.MATERIAL_BY_ID[y.mat] : null;
        var left = GAME.dailyYieldLeft ? Math.round(GAME.dailyYieldLeft() / 1000) : 0;
        /* v65：黄金与声望合成一行（省 30px）—— 两者都是"这个数会进账"的同类信息 */
        yieldBox = '<div class="op-zone"><div class="op-zone-t">本城岁贡 · 每现实日结算</div>' +
          '<div class="attr"><span class="k">黄金 / 声望</span><span class="v good">+' + U.fmt(y.gold) +
            ' / +' + U.fmt(y.rep) + '</span></div>' +
          (m ? '<div class="attr"><span class="k">特产</span><span class="v">' + m.name + ' ×' +
            y.qty[0] + '~' + y.qty[1] + (y.seat ? '　（州治 ×' + DATA.STATE_SEAT_BONUS + '）' : '') +
            '</span></div>' : '') +
          '<div class="attr"><span class="k">距下次结算</span><span class="v">' + U.durExact(left) + '</span></div>' +
          '</div>';
      }
    }

    /* v29（需求 10）→ v45（需求 4）：改名入口已上移到 head 的"本城"行，
       不再在面板末尾重复一份 —— 面板一长它就会落到折叠线以下，
       那正是老板"没看到这个功能"的原因。 */

    /* v29（需求 6）：队列总览从「公文」迁到这里 —— 建造/募兵本就属城务 */
    /* v65：队列只列前 4 条（多的给一行摘要）—— 面板高度因此可控 */
    var queueBox = '<div class="op-zone"><div class="op-zone-t">在办事项 · 建造 / 募兵 / 自动 / 行军</div>' +
      ui.queueBody(4) + '</div>';

    /* v65：改用 **xl 档**（960×min(700px,88vh)）—— 默认档装不下面板全集。
       v82：征收表退役后内容更少，但档位不动（960 宽是各面板的既定规格）。 */
    ui.openModal(head + farmBox + yieldBox + spBox + queueBox +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };

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

  /* ============================================================
   * 城墙（v16：不占格，环绕城池一圈）
   * 施工中 → 显示进度 + 可取消；未建 → 可修建；已建 → 可升级
   * ============================================================ */
  ui.openWallModal = function () {
    var s = GAME.state, c = GAME.currentCity();
    var b = DATA.BUILDINGS.chengqiang;
    var lv = c.wallLv || 0;
    var q = null;
    (s.queues.build || []).forEach(function (x) {
      if (x.type === 'wall' && (!x.cityId || x.cityId === c.id)) q = x;
    });
    if (q) {
      var pct = Math.min(100, Math.floor(q.elapsed / q.totalTime * 100));
      var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
      ui.openModal('<div class="gold-heading">🧱 城墙施工中</div>' +
        '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-h1);font-weight:800;margin:8px 0;" data-modal-progress="wall:0">' +
          pct + '% · ' + U.durExact(left) + '</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);">' +
          (lv > 0 ? ('Lv' + lv + ' → Lv' + q.targetLevel) : '初次修建') + '　倒计时实时更新…</div>' +
        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="wall">取消施工</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">取消后按剩余时间比例返还 80% 资源</span>' +
        '</div>');
      return;
    }
    var cost = GAME.wallCost(c);
    var next = lv + 1;
    var eff = function (n) {
      return '耐久 ' + (n * 100) + '万 · 守军防御 +' + (n * 10) + '% · 远程射程 +' + (n * 3) + '%';
    };
    ui.openModal('<div class="gold-heading">🧱 城墙 · ' + (lv > 0 ? 'Lv' + lv : '尚未修建') + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:10px;">' + b.desc + '</div>' +
      '<div class="attr"><span class="k">当前效果</span><span class="v' + (lv > 0 ? ' good' : '') + '">' +
        (lv > 0 ? eff(lv) : '无') + '</span></div>' +
      (lv > 0 && lv < GAME.buildCapOf(c, 'chengqiang')
        ? '<div class="attr"><span class="k">升至 Lv' + next + '</span><span class="v good">' + eff(next) + '</span></div>' : '') +
      /* v68（设计规范 §11）：费用与按钮同行、关闭进底栏 —— 与建筑弹窗同骨架 */
      '<div class="op-zone"><div class="op-zone-t">' + (lv > 0 ? '升级' : '修建') + '</div>' +
        '<div class="op-row op-row-between">' +
          '<span class="op-kv">费用 <b>' + (cost ? GAME.costString(cost) : '已满级') + '</b></span>' +
          ((lv < GAME.buildCapOf(c, 'chengqiang') && cost)
            ? '<button class="btn" data-action="wall-build">' + (lv > 0 ? '升级城墙' : '修建城墙') + '</button>'
            : '<span class="op-done">已达最高等级</span>') +
        '</div></div>' +
      '<div class="bldg-foot"><span></span><button class="btn" data-action="close-modal">关闭</button><span></span></div>');
  };

  GAME.costString = function (cost) {
    var parts = [];
    for (var k in cost) {
      if (k === 'time') continue;
      var name = '';
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) name = r.name; });
      if (!name) name = k;
      parts.push(name + ' ' + U.fmt(cost[k]));
    }
    return parts.join(' · ') || '—';
  };

  /* --------- 城外（地块网格 · 弹窗式） --------- */
  ui.extHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    GAME.ensureExtGrid(c);
    var cap = GAME.extCap(c), used = GAME.extUsed(c);
    var all = GAME.extSummary ? GAME.extSummary() : null;
    var grid = GAME.extGridOf(c);
    /* 88px 格子下 6 列要 7 行 = 616px，超出视区；8 列时上限 40 块
       = 5 行 = 440px、宽 704px，在固定视区内正合适。 */
    var COLS = 8;
    var ROWS = Math.max(1, Math.ceil(grid.length / COLS));
    ui.fitBoard(COLS, ROWS);              /* v27：按窗口算格子边长 */
    var M = ui.isoMetrics(COLS, ROWS);
    /* v24（需求 7）：末行不满时**水平居中**。
       左对齐的末行会让人以为"这里还缺几块地"，居中后一眼看出是刻意的排布。 */
    var lastRowN = grid.length - (ROWS - 1) * COLS;
    var colOff = lastRowN < COLS ? (COLS - lastRowN) / 2 : 0;
    var cells = grid.map(function (e, idx) {
      var col = idx % COLS, row = Math.floor(idx / COLS);
      if (row === ROWS - 1) col += colOff;
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
    }).join('');
    var board = ui.isoBoard(COLS, ROWS, cells, {});
    /* v22（需求 3）：与城内一致 —— 中央只留地块；
       城池名/块数在侧栏「城池属性」，显示比例与岁贡在侧栏「城池操作」。
       （all / used / cap 仍用于侧栏渲染，这里不再消费） */
    return '<div class="ui-page city-pure">' +
      '<div class="city-iso" style="' + ui.zoomStyle() + '">' + board + '</div>' +
      '</div>';
  };

  /* 城外地块弹窗：空地→选建 4 种资源建筑；已建→详情/升级 */
  ui.openExtModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var e = GAME.extGridOf(c)[idx];
    if (!e) return;
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
        prodLine = '<div class="attr"><span class="k">当前产出（施工中不停产）</span><span class="v good">' + phP + '/时</span></div>' +
          '<div class="attr"><span class="k">完工后 Lv' + (e.lv + 1) + '</span><span class="v">' + ebP.prod[e.lv] + '/时</span></div>';
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
          '<button class="btn sm red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');
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
        '<div class="attr"><span class="k">产量</span><span class="v good">' + prodH + '/时（' + (prodH / 3600 * GAME.timeScale() > 10 ? Math.round(prodH / 3600 * GAME.timeScale()) : (prodH / 3600 * GAME.timeScale()).toFixed(1)) + '/s）</span></div>' +
        (eRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(eRef) + '</div>' : '') +
        /* v68（设计规范 §11）：与城内弹窗同一骨架 —— 功能行 / 升级行 / 底栏 */
        '<div class="op-zone">' +
          '<div class="op-zone-t">功能</div>' +
          '<div class="op-row"><button class="btn gold" data-action="ext-convert-ask" data-idx="' + idx + '">🔧 改建为其他资源建筑</button></div>' +
        '</div>' +
        '<div class="op-zone">' +
          '<div class="op-zone-t">升级</div>' +
          '<div class="op-row op-row-between">' +
            '<span class="op-kv">费用 <b>' + costStr + '</b></span>' +
            (upCost ? '<button class="btn" data-action="ext-upgrade" data-idx="' + idx + '">升级 → Lv' + (e.lv + 1) + '</button>' : '<span class="op-done">已达最高等级</span>') +
          '</div></div>' +
        '<div class="bldg-foot">' +
          (upCost ? '<button class="btn sm red" data-action="demolish-ask" data-kind="ext" data-idx="' + idx + '" title="返还累计投入的 50%（需二次确认）">拆毁</button>' : '<span></span>') +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>'
      );
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
      /* v37（需求 1）：募兵资源**从卡面移到悬停浮层** —— 卡面少一行，
         省下的空间给图标（.ticon 52 → 84px，见 CSS）。
         移到浮层而不是删掉：成本是募兵的关键决策信息，只是"不该常驻卡面"。 */
      var costStr = GAME.costString(t.cost) + '</div><div class="tip-l">人口 ' + t.pop +
        ' · 耗粮 ' + t.food + '/h · 单兵耗时 ' + U.dur(t.time);
      return '<div class="troop-card' + (unlocked ? '' : ' disabled') + (ui._trainSel === id ? ' selected' : '') + '" ' +
        'data-action="' + (unlocked ? 'select-train' : 'train-locked') + '" data-troop="' + id + '" data-tip-el="1">' +
        '<div class="ticon">' + GAME.icons.forTroop(t.id) + '</div><div class="tname">' + t.name + '</div>' +
        '<div class="tstat">血' + t.hp + ' 攻' + t.atk + ' 防' + t.def + ' 射' + t.range + ' 速' + t.spd + '</div>' +
        /* v84（老板）：「兵种底下不要『拥有：0』这个提示」—— 拥有行整行退役；
           own 读数一并退役；未解锁原因不再挂卡面（悬停浮层照旧给出，信息不丢）。 */
        '<div class="tcard-tip tip-src"><div class="tip-t">' + U.escape(t.name) + ' · 募兵消耗</div>' +
          '<div class="tip-l">' + costStr + '</div>' +
          (unlocked ? '' : '<div class="tip-a" style="color:var(--red-light)">' + U.escape(chk.msg || '') + '</div>') +
        '</div></div>';
    }).join('');
    var sel = DATA.TROOPS[ui._trainSel];
    var afford = GAME.canTrain(ui._trainSel).ok;
    /* v20：数量取自状态，不再读 DOM */
    var qty = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    var timeStr = sel ? U.dur((sel.time * qty) / GAME.timeScale()) : '';
    /* v28（需求 5）：按当前人口与资源算出的**可募上限** */
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;
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
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled') + '>' + (ui._trainFilter === 'siege' ? '制造' : '训练') + '</button>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">约' + timeStr + '</span>' +
        (slotsLeft > 0
          ? '<span class="ui-sub">队列空位 ' + slotsLeft + '</span>'
          : '<span class="ui-sub" style="color:var(--amber);">' + (isSiege ? '本作坊' : '本营') + '队列已满' +
            (bar && GAME.trainNextSlotLv(bar.lvl) ? '（Lv' + GAME.trainNextSlotLv(bar.lvl) + ' 解锁下一个等待位）' : '') + '</span>') +
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
    return g.status === 'guard' ? '守将' : g.status === 'march' ? '出征中'
      : g.status === 'gather' ? '采集中' : '空闲';
  };
  ui.genStatusCls = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? 'st-guard' : g.status === 'idle' ? '' : 'st-busy';
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
          '　忠诚 ' + Math.round(g.loyalty || 0) + '</div>' +
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
    var enMx = GAME.energyMax ? GAME.energyMax(g) : 100;
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
    var html = '<div class="gen-pane">' +
      '<div class="gp-head">' +
        '<span class="gp-face">' + ui.faceOf(g, 84) + '</span>' +
        '<span class="gp-id">' +
          '<b class="gp-name">' + U.escape(g.name) +
            (g.hero ? '<span class="gcard-tag hero">史实名将</span>' : '') +
            (g.beauty ? '<span class="gcard-tag beauty">美人</span>' : '') + statusTag74 + '</b>' +
          '<span class="gp-sub">' +
            '<span class="rank-badge r-' + rk.id + '" title="等级上限 ' + capLv +
              '，每级属性成长 +' + rk.grow + '">' + rk.name + ' ' + '★'.repeat(rk.star) + '</span>' +
            (styleName74 ? '<span class="gp-style">' + U.escape(styleName74) + '</span>' : '') +
          '</span>' +
          '<span class="gp-sub">' + U.escape(rkDesc74) +
            (atCap ? '　<span class="gd-warn">已达资质上限</span>' : '') + '</span>' +
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
          /* v70（老板）：「不可解雇」—— 君主的档案里**不给解雇按钮**（守卫在域层，这里连入口都不给） */
          (GAME.isLordGeneral(g) ? '' :
            '<button class="btn sm" data-action="dismiss-gen" data-gen="' + genId + '">解雇</button>') +
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
       守将加成本来就出自六维（内政→产量/建造、勇武→征兵、智谋→研究/城防），
       再单列一块"守将效果"就是把同一份数据说两遍（本项目最经典的失效模式）。 */
    var gbNow = (g.status === 'guard' && GAME.guardBonus)
      ? GAME.guardBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
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
          var extra = (gbNow && d.guardUse) ? d.guardUse(gbNow) : '';
          if (extra) tip74 += '\n' + extra;
          var plus74 = (PLUS_STATS74.indexOf(d.k) >= 0)
            ? '<button class="btn sm gd-plus" data-action="gen-stat-plus" data-gen="' + genId +
              '" data-stat="' + d.k + '" title="' + U.escape('用自由属性点或道具提升' + d.n) + '">＋</button>'
            : '';
          return '<tr><td title="' + U.escape(tip74) + '"><b style="color:' + d.color + ';">' + d.n + '</b></td>' +
            '<td class="ctr gd-v">' + (a[d.val || d.k] || 0) + '</td>' +
            '<td class="ctr gd-u gd-plus-c">' + plus74 + '</td></tr>';
        }).join('') +
        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b><span class="gd-free-hint">升级获得（每级 = 成长值）　' +
          '点右侧 ＋ 逐点分配，或用道具</span></td></tr>' +
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
    html += '<div class="gp-sec">状态</div>' +
      /* v20（需求 5）的规矩在这里同样适用：**页面只放信息型内容**，
         "出征消耗 / 低于 25 不可出征 / 侦查消耗"这类**规则解说**不常驻页面。 */
      '<div class="gd-line">忠诚 <b style="color:' + loyColor + '">' + loy + '</b>' + bar(loy, loyColor) +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城池缴获或商城购买') + '">🎁 赏赐</button></div>' +
      /* 攻击 / 防御：**合计值 + 构成**（勇武 3,300 ＋ 装备 8,148 = 11,448）——
         老板要的"总数"，同时一眼能看出装备贡献了多少，不必再单列一行。
         v66：**体力同口径** —— 主数字改成"总体体力"（= 上限，含装备与套装），
         当前值退到右边括号里。改前主数字是"当前值"，于是老板看到
         「装备栏写着体力 +600，六维/状态里的体力却一点没变」→
         「部分将领的体力没有加上装备的数值」。 */
      '<div class="gd-line">攻击 <b>' + U.numText(a.atkVal, 0) + '</b>' +
        '<span class="gd-hint">勇武 ' + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' +
          U.numText(a.atk, 0) + '</span>' +
        '<span class="gd-hint">全军攻击 <b style="color:var(--green-ok);">+' + atkShow + '%</b></span></div>' +
      '<div class="gd-line">防御 <b>' + U.numText(a.defVal, 0) + '</b>' +
        '<span class="gd-hint">智谋 ' + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' +
          U.numText(a.def, 0) + '</span>' +
        '<span class="gd-hint">全军防御 <b style="color:var(--green-ok);">+' + defShow + '%</b></span></div>' +
      /* v66：主数字 = 总体体力（上限，含装备与套装）；当前值单独写在右边。
         装备构成（等级/资质/内政多少 + 装备多少）进 title ——
         1366/1280 下三组小字会把这一行挤成两行（几何探针实测 41px vs 17px），
         而装备贡献的逐行清单本来就在右栏「装备提供」里，不必在这里再说一遍。 */
      '<div class="gd-line" title="体力上限 ' + U.numText(staMx, 0) + ' = 等级/资质/内政 '
        + U.numText(staMx - staEqNow, 0) + ' ＋ 装备 ' + U.numText(staEqNow, 0) + '">体力 <b>'
        + U.numText(staMx, 0) + '</b>' + bar(staPct, '#6a9a4a') +
        '<span class="gd-hint">当前 ' + U.numText(staNow, 0) +
          '　全军生命 <b style="color:var(--green-ok);">+' + hpBonus + '%</b></span></div>' +
      '<div class="gd-line">精力 <b>' + Math.round(g.energy || 0) + '</b>' +
        bar((g.energy || 0) / Math.max(1, enMx) * 100, '#4a9be0') +
        '<span class="gd-hint">' + Math.round(g.energy || 0) + ' / ' + Math.round(enMx) + '</span></div>';

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
        ? '军中装备用于攻城野战；修炼装备用于野地游历（灵力判定）。\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。'
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
    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 兵法心得 / 治军之道。');
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
          ui.help('提升上限只能换更高资质的将领：凡品 60 · 良材 100 · 英杰 140 · 名世 180 · 天授 240。' +
            '\n手里的经验道具留着给别的将领。') + '</div>',
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
    var want = (ui._expPick || {})[genId];
    var pick = items[0].id;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it.amount || 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;
    ui.openShell({
      title: '📖 用经验道具 · ' + U.escape(g.name),
      sub: 'Lv' + g.level + '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(expNeed, 0) +
        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">+' + U.numText(x.amount, 0) + '/个</i></button>';
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
          '席位**按城算**：每座城的上限 = 该城招贤馆等级（+满级专精 2）；0 级 = 0 席\n' +
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
          '<span class="xc-prod">Lv' + e.lv + ' 产量 ' + eb.prod[e.lv - 1] + '/时</span>' +
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
     勇武 → battle.js atkMult = 1 + a.atkPct × cover（atkPct = 攻值/10/100，v52 换算链）
     智谋 → battle.js defBonus / atkDefBonus += a.defPct（同上）
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
    /* v52（老板给定换算链）：属性不再"一点一趴"直接进乘区，
       而是先折算成攻防值，再按"每 10 点 = +1%"进全军。
       这里写的**就是代码里的同一组常量**（GAME.ATK_PER_YW / PCT_PER_ATK 等），
       改常量忘了改文案会被 smoke 的一致性断言拦下。 */
    { k: 'yw', n: '勇武', color: '#c9705a',
      use: '攻击值 +10 · 每 10 攻值→全军攻 +1%',
      /* v58：`guardUse` = 该将**现任守将**时这一维实际提供的加成（并进"作用"列）。
         映射取自 `GAME.guardBonus`：内政→产量/建造、勇武→征兵、智谋→研究/城防。 */
      guardUse: function (gb) {
        return gb.train ? '守将加成：征兵 +' + Math.round(gb.train * 100) + '%' : '';
      } },
    { k: 'zm', n: '智谋', color: '#4a9be0',
      use: '防御值 +10 · 每 10 防值→全军防 +1%',
      guardUse: function (gb) {
        var p2 = [];
        if (gb.research) p2.push('研究 +' + Math.round(gb.research * 100) + '%');
        if (gb.def) p2.push('城防 +' + Math.round(gb.def * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },
    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      guardUse: function (gb) {
        var p2 = [];
        if (gb.prod) p2.push('产量 +' + Math.round(gb.prod * 100) + '%');
        if (gb.build) p2.push('建造 +' + Math.round(gb.build * 100) + '%');
        return p2.length ? '守将加成：' + p2.join(' ') : '';
      } },
    { k: 'spd', n: '速度', color: '#b06fd8', use: '全军速度 +1 · 每级另 +1' },
    /* v29（需求 11）：体力升为**第六维** —— 它不再只是"出征的资格值"，
       而是直接决定全军生命的厚度（当前体力越高越耐打）。
       v52：上限成了「等级/资质/内政 + 装备与套装的体力加成」三者之和。
       v66：**表格里显示"总体体力"（= 上限）**，`val` 指定取值键 ——
       与左栏「状态 · 体力」同口径（那边把当前值写在括号里），
       否则六维显示当前值、装备栏显示装备贡献，两处又对不上。 */
    { k: 'sta', n: '体力', val: 'staMax', color: '#d98b4a',
      use: '生命渐近 +80% · 上限随等级/资质/内政/装备' },
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
      '<div class="ds-empty">灵力用于野地游历判定；蕴养每级修炼属性 +8%（灵气精华 · 游历获得）。</div>' +
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
      var cell = c.cells[idx];
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
  ui.equipHTML = function () {
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
    var pgE = ui.pageOf('equip', invAll.length, 10);
    var inv = invAll.slice(pgE.from, pgE.to).map(function (inst, i) {
      var item = DATA.EQUIP[GAME.eqId(inst)];
      if (!item) return '';
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : GAME.eqId(inst);
      return '<div class="troop-card" style="cursor:pointer;" data-action="equip-item" data-gen="' + g.id + '" data-item="' + key + '">' +
        '<div class="tname">' + U.escape(GAME.eqLabel(inst)) + '</div>' +
        '<div class="tstat">' + (gSlotNames[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +
        '<div class="tstat">' + GAME.equipDesc(item) + '</div></div>';
    }).join('') || '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;padding:10px;">背包暂无装备（占领名城/任务可获得）</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">🎽 装备 · ' + U.escape(g.name) + '</div>' +
      '<div style="margin-bottom:10px;"><div class="ui-sub" style="margin-bottom:4px;">选择将领</div>' +
        ui.genChips({ store: '_equipGen', refresh: 'view', value: g.id || (ui._equipGen || '') }) + '</div>' +
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
      ui.pagerHTML('equip', invAll.length, 10) + '</div>' +

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
        '<button class="btn sm" data-action="tech-research" data-tech="' + t.id + '"' + (cur ? ' disabled' : '') + '>研究(' + U.fmt(cost.grain) + '粮)</button>';
      return '<tr><td>' + t.name + '</td><td class="ctr">' + lv + '/10</td>' +
        '<td style="font-size:var(--fs-sub);color:var(--text-dim);">' + t.desc + '</td>' +
        '<td class="ctr">' + btn + '</td></tr>';
    }).join('');
    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 书院科技（' + bookLv + '级书院 · 23项）</div>' +
      (cur ? '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-body);margin-bottom:8px;">🔬 研究中：' + (function(){ var n=cur.techId; DATA.TECH.forEach(function(x){if(x.id===cur.techId)n=x.name;}); return n; })() + ' ' + Math.min(100, Math.floor(cur.elapsed / cur.totalTime * 100)) + '%</div>' : '') +
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
          ui.genChips({ store: '_itemGen', value: ui._itemGen }) + '</div>'
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
        '<div class="res-line"><span class="lbl">城池</span><span class="val" style="color:' + (s.cities.length >= next.city ? 'var(--green-ok)' : 'inherit') + ';">' + s.cities.length + '/' + next.city + '</span></div>' +
        '<div class="res-line"><span class="lbl">黄金</span><span class="val" style="color:' + ((s.res.gold || 0) >= next.gold ? 'var(--green-ok)' : 'inherit') + ';">' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold) + '</span></div>' +
        (chk && chk.msg && !chk.ok ? '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:6px;">' + chk.msg + '</div>' : '') +
        '<div style="text-align:center;margin-top:12px;">' + promoteBtn + '</div></div>' : '') +
      '<table class="tbl"><thead><tr><th>爵位</th><th>城池</th><th>声望</th><th>黄金</th><th>珠宝需求</th><th>俸禄</th><th>加成</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="note">加成说明：产 = 全境产量 · 税 = 税收 · 储 = 仓储 · 造 = 同时建造 · 野 = 附属野地上限 · 席 = 每城将领席位。</div>' +
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
  ui.MAP_CELL_MAX = 128;         /* v85：104 → 128 —— 搜索式自适应下上限只防极端（1440 屏输出 104 由可用高度决定） */
  ui.MAP_SPAN_MAX_X = 22, ui.MAP_SPAN_MAX_Y = 14;   /* 观察框最大范围 */
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
    for (var cols = MAP_SPAN_X; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = MAP_SPAN_Y; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        var better = !best || cov > best.cov + 0.012
          || (Math.abs(cov - best.cov) <= 0.012 && cell > best.cell);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }
    if (!best) {   /* 兜底（理论上不可达）：极端窗口下也要有解 */
      best = { cols: MAP_SPAN_X, rows: MAP_SPAN_Y,
        cell: Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX,
          Math.floor(Math.min(availW / MAP_SPAN_X, availH / MAP_SPAN_Y)))) };
    }
    var cols = best.cols, rows = best.rows, cell = best.cell;
    ui.mapFrame = { spanX: cols, spanY: rows, cell: cell, iso: true };
    MAP_CELL = cell;
    return cell;
  };
  /* v50：mapView 的语义由"视口左上角格"改为**视野中心格** ——
     菱形网格在屏幕上是斜的，"左上角"不再对应任何有意义的格。 */
  ui.mapView = { x: null, y: null };

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
  ui.drawMini = function (canvas, size) { /* 打底 + 动态层（我城金点） */
    if (!canvas) return false;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx || !ctx.drawImage) return false;
    var off = ui.miniOff();
    if (!off) return false;
    var W = DATA.MAP_W;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(off, 0, 0, size, size);
    var s = GAME.state;
    (s.cities || []).forEach(function (c) {
      var pxx = (c.x + 0.5) / W * size, pyy = (c.y + 0.5) / W * size;
      ctx.beginPath();
      ctx.arc(pxx, pyy, Math.max(3, size / 110), 0, 6.2832);
      ctx.fillStyle = '#ffe9a0'; ctx.fill();
      ctx.lineWidth = Math.max(1, size / 500); ctx.strokeStyle = '#7a4a12'; ctx.stroke();
    });
    return true;
  };
  ui.paintMiniBottom = function () {      /* 底部条那枚 38px 小图 */
    var cv = $('#mini-canvas');
    if (!cv) return;
    try { ui.drawMini(cv, ui.MINI_PX); } catch (e) { /* 画布 stub 环境：静默跳过 */ }
  };
  ui.openMinimap = function () {          /* 「天下大势」面板 */
    ui.openModal(
      '<div class="gold-heading">🗺 天下大势</div>' +
      '<div class="mini-wrap"><canvas id="mini-big" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas></div>' +
      '<div class="mini-legend"><b class="lg-state">━</b> 州界　<b class="lg-jun">┄</b> 郡界　' +
        '<b class="lg-cap">■</b> 都城　<b class="lg-zhou">■</b> 州城　<b class="lg-jun-c">■</b> 郡城　' +
        '<b class="lg-me">●</b> 我城</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
    var big = $('#mini-big');
    try { ui.drawMini(big, ui.MINI_PX); } catch (e) { }
  };

  /* 鼠标点选的地块（v44）：存 pick() 的结果，供状态行显示 */
  ui.mapPick = null;
  ui.mapPickText = function () {
    var p = ui.mapPick;
    if (!p) return '点选 —';
    var tag = ({ player: '我城', npc: '名城', wild: '野地', fort: '据点', land: '空地' })[p.kind] || '';
    return '点选 ' + tag + ' (' + p.x + ',' + p.y + ')';
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
      spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell });
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
    var lv = GAME.buildingLevel(city, 'guanfu') || 1;
    var rows = GAME.TRANSPORT_KEYS.map(function (k) {
      var meta = null;
      DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
      return '<div class="attr"><span class="k">' + (meta ? meta.icon + ' ' + meta.name : k) + '</span>' +
        '<span class="v">' + U.numText(R[k] || 0, 0) + '</span></div>';
    }).join('');
    ui.openShell({
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
          '<div class="attr"><span class="k">🎖 守将</span><span class="v">' +
            (guard ? U.escape(guard.name) + ' Lv' + guard.level : '<span class="ui-sub">未任命</span>') + '</span></div>'
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
      foot: '<div class="m-foot">' +
        (isOwn
          ? '<button class="btn gold" data-action="city-enter" data-city="' + city.id + '">进入城池</button>' +
            '<button class="btn" data-action="city-transport" data-city="' + city.id + '">资源运输</button>' +
            '<button class="btn" data-action="city-dispatch" data-city="' + city.id + '">将领派遣</button>' +
            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'
          : '') +
        /* v67（老板）：放弃城池 —— 只在还有别的城可去时才出现（否则点了必被拒） */
        (isOwn && (s.cities || []).length > 1
          ? '<button class="btn red" data-action="city-abandon-ask" data-city="' + city.id +
            '">🗑️ 放弃城池</button>'
          : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };

  /* ---------- 资源运输（v60 · 需求 4）----------
     数量用 **chips 选比例**（1/4 · 1/2 · 3/4 · 全部）而不是输入框 ——
     一是全站"点选一律 chips"的约定，二是比例点一下就能把"损耗 / 实收"重算出来，
     不需要"改完数字还得点一下刷新"。 */
  ui.TR_PCTS = [[0.25, '1/4'], [0.5, '1/2'], [0.75, '3/4'], [1, '全部']];
  ui.openTransport = function (fromId) {
    var s = GAME.state;
    var from = GAME.cityById(fromId) || GAME.currentCity();
    if (!s || !from) { ui.toast('城池不存在'); return; }
    var others = (s.cities || []).filter(function (c) { return c.id !== from.id; });
    if (!others.length) {
      ui.openShell({
        title: '🚚 资源运输', sub: '自' + from.name + '起运', size: 'sm',
        body: '<div class="q-empty">你只有这一座城 —— 先攻占或新建一座城池，才能互相运输。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    ui._trTo = ui._trTo || {};
    ui._trKey = ui._trKey || {};
    ui._trPct = ui._trPct || {};
    var to = null;
    others.forEach(function (c) { if (c.id === ui._trTo[from.id]) to = c; });
    if (!to) to = others[0];
    var key = ui._trKey[from.id] || 'grain';
    if (GAME.TRANSPORT_KEYS.indexOf(key) < 0) key = 'grain';
    var pct = ui._trPct[from.id] || 0.5;
    var R = GAME.res(from);
    var avail = Math.floor(R[key] || 0);
    var qty = Math.floor(avail * pct);
    var loss = GAME.transportLossOf(from, to);
    var landed = Math.floor(qty * (1 - loss));
    var nm = GAME.resName(key);
    ui._trFrom = from.id;
    var chip = function (act, dv, label, on, extra) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="' + act + '"' +
        ' data-i="' + from.id + '"' + (extra || '') + '>' + label + '</span>';
    };
    ui.openShell({
      title: '🚚 资源运输',
      sub: '自' + U.escape(from.name) + '（' + from.x + ',' + from.y + '）起运',
      body:
        '<div class="ui-sub">运往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          return chip('tr-to', null, U.escape(c.name) + ' <i class="gd-sub">' + GAME.cityDist(from, c) + ' 格</i>',
            c.id === to.id, ' data-v="' + c.id + '"');
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">物资</div>' +
        '<div class="gd-chips">' + GAME.TRANSPORT_KEYS.map(function (k) {
          var meta = null;
          DATA.RESOURCES.forEach(function (r) { if (r.key === k) meta = r; });
          return chip('tr-key', null, (meta ? meta.icon + meta.name : k) +
            ' <i class="gd-sub">' + U.fmt(R[k] || 0) + '</i>', k === key, ' data-v="' + k + '"');
        }).join('') + '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">数量</div>' +
        '<div class="gd-chips">' + ui.TR_PCTS.map(function (p2) {
          return chip('tr-pct', null, p2[1], Math.abs(p2[0] - pct) < 1e-9, ' data-v="' + p2[0] + '"');
        }).join('') + '</div>' +
        /* 这一行随点选**局部刷新**（见 ui.syncTransportEst）—— 不重建弹窗，
           与"点选后不重绘"的约定一致，也不会闪。 */
        '<div class="op-zone" style="margin-top:10px;"><div class="op-hint" id="tr-est">' +
          ui.transportEstHTML(from, to, key, qty, loss, landed, avail) + '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="tr-do">起运 ' + nm + '</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.transportEstHTML = function (from, to, key, qty, loss, landed, avail) {
    var nm = GAME.resName(key);
    if (avail <= 0) return from.name + '没有' + nm + '可运。';
    return '起运 <b>' + U.numText(qty, 0) + '</b> ' + nm + '　·　路程 ' +
      GAME.cityDist(from, to) + ' 格　·　途中损耗 <b style="color:var(--amber);">' +
      U.numText(qty - landed, 0) + '</b>（' + Math.round(loss * 1000) / 10 + '%）　·　' +
      to.name + '实收 <b style="color:var(--green-ok);">' + U.numText(landed, 0) + '</b>';
  };
  /* 只改估算行，不重建弹窗 */
  ui.syncTransportEst = function () {
    var box = $('#tr-est');
    var s = GAME.state;
    if (!box || !s) return;
    var from = GAME.cityById(ui._trFrom) || GAME.currentCity();
    if (!from) return;
    var to = GAME.cityById(ui._trTo[from.id]) || from;
    var key = ui._trKey[from.id] || 'grain';
    var pct = ui._trPct[from.id] || 0.5;
    var avail = Math.floor(GAME.res(from)[key] || 0);
    var qty = Math.floor(avail * pct);
    var loss = GAME.transportLossOf(from, to);
    box.innerHTML = ui.transportEstHTML(from, to, key, qty, loss, Math.floor(qty * (1 - loss)), avail);
  };
  ui.setTrTo = function (i, v) { ui._trTo = ui._trTo || {}; ui._trTo[i] = v; ui.syncTransportEst(); };
  ui.setTrKey = function (i, v) { ui._trKey = ui._trKey || {}; ui._trKey[i] = v; ui.syncTransportEst(); };
  ui.setTrPct = function (i, v) { ui._trPct = ui._trPct || {}; ui._trPct[i] = Number(v) || 0.5; ui.syncTransportEst(); };
  ui.doTransport = function () {
    var s = GAME.state;
    var from = GAME.cityById(ui._trFrom) || GAME.currentCity();
    if (!from) return;
    var to = GAME.cityById(ui._trTo[from.id]);
    var key = ui._trKey[from.id] || 'grain';
    var pct = ui._trPct[from.id] || 0.5;
    var avail = Math.floor(GAME.res(from)[key] || 0);
    var r = GAME.doTransport(from.id, to ? to.id : '', key, Math.floor(avail * pct));
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openCityPanel(from); }
  };

  /* ---------- 将领派遣（v60 · 需求 4）----------
     一人一城。守将要先解任 —— 不拦的话会出现"人已被派走、守将加成
     还挂在原城"的静默失效（本项目的老毛病）。 */
  ui.openDispatch = function (fromId) {
    var s = GAME.state;
    var from = GAME.cityById(fromId) || GAME.currentCity();
    if (!s || !from) { ui.toast('城池不存在'); return; }
    var others = (s.cities || []).filter(function (c) { return c.id !== from.id; });
    var gens = GAME.dispatchableGensOf(from);
    ui._dpGen = ui._dpGen || {};
    ui._dpTo = ui._dpTo || {};
    ui._dpFrom = from.id;
    if (!others.length) {
      ui.openShell({
        title: '🎖 将领派遣', sub: '自' + from.name + '调出', size: 'sm',
        body: '<div class="q-empty">你只有这一座城 —— 无处可派。</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var selG = null;
    gens.forEach(function (g) { if (g.id === ui._dpGen[from.id]) selG = g; });
    if (!selG) selG = gens[0] || null;
    var to = null;
    others.forEach(function (c) { if (c.id === ui._dpTo[from.id]) to = c; });
    if (!to) to = others[0];
    var pick = function (act, label, on, extra) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="' + act + '"' +
        ' data-i="' + from.id + '"' + (extra || '') + '>' + label + '</span>';
    };
    ui.openShell({
      title: '🎖 将领派遣',
      /* v64：席位按城 —— 本城在册/上限，调往的城市还剩几个位置 */
      sub: '自' + U.escape(from.name) + '调出　·　本城 ' + GAME.generalsIn(from).length
        + '/' + GAME.genSlotsOf(from) + ' 席，可派 ' + gens.length + ' 人',
      body:
        (gens.length
          ? '<div class="ui-sub">选将领</div><div class="gd-chips">' + gens.map(function (g) {
              return pick('dp-gen', ui.rankBadge(g) + ' ' + U.escape(g.name) +
                ' <i class="gd-sub">Lv' + g.level + (g.status === 'guard' ? ' · 守将' : '') + '</i>',
                selG && selG.id === g.id, ' data-v="' + g.id + '"');
            }).join('') + '</div>'
          : '<div class="q-empty">本城暂无可派遣的将领（出征中 / 采集中的不可派遣）。</div>') +
        '<div class="ui-sub" style="margin-top:8px;">调往</div>' +
        '<div class="gd-chips">' + others.map(function (c) {
          /* v64：调往的城市必须还有席位居（席位 = 该城招贤馆等级 + 满级专精） */
          var n = GAME.generalsIn(c).length, cap = GAME.genSlotsOf(c), free = GAME.genFreeOf(c);
          return pick('dp-to', U.escape(c.name) + ' <i class="gd-sub">' + n + '/' + cap + ' 席'
            + (free > 0 ? '（空 ' + free + '）' : '（已满）') + '</i>',
            c.id === to.id, ' data-v="' + c.id + '"');
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:10px;"><div class="op-hint">' +
          '将领随城而属：调往新城后，其内政/统帅等加成一并跟过去。' +
          '<br>席位**按城算**：目标城上限 = 该城招贤馆等级（+满级专精 2）；已满则先升级其招贤馆。' +
          (selG && selG.status === 'guard'
            ? '<br><b style="color:var(--amber);">' + U.escape(selG.name) +
              ' 现任守将，需先解除任命才能调走。</b>' : '') +
        '</div></div>',
      foot: '<div class="m-foot">' +
        (gens.length
          ? '<button class="btn gold" data-action="dp-do">派遣</button>' : '') +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setDpGen = function (i, v) { ui._dpGen = ui._dpGen || {}; ui._dpGen[i] = v; ui.openDispatch(i); };
  ui.setDpTo = function (i, v) { ui._dpTo = ui._dpTo || {}; ui._dpTo[i] = v; ui.openDispatch(i); };
  ui.doDispatch = function () {
    var from = GAME.cityById(ui._dpFrom) || GAME.currentCity();
    if (!from) return;
    var gid = ui._dpGen[from.id], tid = ui._dpTo[from.id];
    var r = GAME.doDispatch(gid, tid);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openCityPanel(from); }
  };

  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;
    var tile = GAME.map.tile(x, y);
    var lv = GAME.map.wildLevelNow ? GAME.map.wildLevelNow(x, y) : GAME.map.wildLevel(x, y);
    var ter = DATA.TERRAIN[tile.terrain];
    /* v15：加成按「每级 × 等级」线性计算 */
    var add = GAME.wildAddOf(tile.terrain, lv) || {};
    var addStr = '';
    for (var r in add) addStr += '（' + (RES_NAME[r] || r) + ' +' + Math.round(add[r] * 100) + '%）';
    /* v55：守军总数**必须与出征时遇到的同一个来源**。
       改前这里读 `GAME.battle.wildGarrison(lv)` —— 那是另一个公式，
       10 级算出来 6.9 万，而 `wildDefenseAt` 的真实守军只有 4560，**差 15 倍**：
       面板一直在骗人，而且"两个出口"正是本项目最经典的失效模式（已删掉那个公式）。
       现在直接读该地块**当天**的守军，与战斗完全一致。 */
    var base = GAME.wildDefenseAt(x, y, lv).total;
    var owned = !!GAME.map.wildAt(x, y);
    var gatherRes = GAME.gatherResOf(tile.terrain);
    var at = GAME.gatherAt(x, y);
    var tbl = DATA.WILD_MATERIAL[tile.terrain] || {};
    var matNames = Object.keys(tbl).map(function (mid) {
      return DATA.MATERIAL_BY_ID[mid] ? DATA.MATERIAL_BY_ID[mid].name : mid;
    }).join('、');
    ui._buildCityXY = { x: x, y: y };   // v16：平原筑城用
    ui._expTarget = { kind: 'wild', x: x, y: y };
    ui._expMode = 'occupy';

    var note = gatherRes
      ? '此地可采：<b style="color:var(--gold-light)">' + (RES_NAME[gatherRes] || gatherRes) + '</b>' +
        (matNames ? '　材料：' + matNames : '')
      : '此地为平地，<b>无可采之物</b>，仅提供产量加成（已占后可筑新城）。';

    /* ---------- 未占领：只给出兵入口 ---------- */
    if (!owned) {
      ui.openModal(
        '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
          base.toLocaleString() + ' 名</div>' +
        '<div class="note">' + note + '</div>' +
        ui.jianghuHTML(x, y) +
        '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="exp-open" data-kind="wild">出兵（侦查 / 掠夺 / 占领）</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>'
      );
      return;
    }

    /* ---------- 已占领：管理面板（v23 · 需求 1） ----------
       驻军 / 撤回 / 采集 / 出兵 / 筑城 / 放弃，全部集中在一处；
       并明确指出「驻军守地不衰减」——否则玩家不知道驻军有什么用。 */
    var gar = GAME.wildGarrisonAt(x, y);
    var garN = GAME.wildGarrisonTotal(gar);

    var stat = '<div class="wild-stat">' +
      '<div class="res-line"><span class="lbl">🛡️ 驻军</span><span class="val">' +
        (garN ? (U.numText(garN, 0) + ' 名' + (gar ? '　来自 ' + ((GAME.cityById(gar.cityId) || {}).name || '本城') : '')) : '无') +
      '</span></div>' +
      (at
        ? '<div class="res-line"><span class="lbl">📦 采集</span><span class="val">' +
            U.durExact((at.elapsed || 0) / Math.max(1, GAME.timeScale())) + ' / ' +
            DATA.GATHER.maxHours + ' 小时</span></div>'
        : '') +
      '<div class="res-line" style="border-bottom:0;"><span class="lbl">📉 等级衰减</span><span class="val" style="color:' +
        (garN ? 'var(--green-ok)' : 'var(--warn)') + ';">' +
        (garN ? '驻军守地 · 不衰减' : '每现实日 −1 级（派军驻守可免除）') + '</span></div>' +
      '</div>';

    var ops = '<div class="op-zone"><div class="op-zone-t">地块操作</div><div class="op-row">' +
      (gatherRes
        ? (at ? '<button class="btn gold" data-action="open-gathers">查看采集进度</button>'
              : '<button class="btn gold" data-action="gather-open" data-x="' + x + '" data-y="' + y + '">📦 派军采集</button>')
        : '') +
      (garN
        ? '<button class="btn" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y + '">🏳️ 撤回驻军</button>'
        : '<button class="btn gold" data-action="wild-garrison-open" data-x="' + x + '" data-y="' + y + '">🛡️ 派军驻守</button>') +
      (tile.terrain === 'plain'
        ? '<button class="btn gold" data-action="build-city">🏯 筑城（粮木石铁金 各 1 万）</button>' : '') +
      '<button class="btn" data-action="exp-open" data-kind="wild">⚔️ 出兵</button>' +
      '</div></div>' +
      '<div class="op-zone danger"><div class="op-zone-t">危险操作</div><div class="op-row">' +
      '<button class="btn red" data-action="wild-abandon-ask" data-x="' + x + '" data-y="' + y + '">🗑️ 放弃该野地</button>' +
      '<span class="op-hint">失去产量加成' + (gatherRes ? '与采集权' : '') + '，驻军与采集队会先撤回城内</span>' +
      '</div></div>';

    ui.openModal(
      '<div class="gold-heading">🏕️ ' + ter.name + ' Lv' + lv + '（已占）</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' +
        base.toLocaleString() + ' 名　·　产量加成 ' + (addStr || '无') + '</div>' +
      '<div class="note">' + note + '</div>' +
      ui.jianghuHTML(x, y) +
      stat + ops +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    );
  };

  /* 派军驻守面板（v23 · 需求 1） */
  ui.openWildGarrison = function (x, y) {
    var s = GAME.state, c = GAME.currentCity();
    var w = GAME.map.wildAt(x, y);
    if (!w) { ui.toast('该野地尚未占领'); return; }
    var ids = Object.keys(c.army || {}).filter(function (k) { return (c.army[k] || 0) > 0; });
    var ter = DATA.TERRAIN[w.type];
    if (!ids.length) {
      ui.openModal('<div class="gold-heading">🛡️ 派军驻守</div>' +
        '<div class="q-empty">城内无兵可派</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
      return;
    }
    ui._wildGarXY = { x: x, y: y };
    var rows = ids.map(function (k) {
      var t = DATA.TROOPS[k];
      return '<div class="res-line" style="align-items:center;">' +
        '<span class="lbl">' + (t ? t.icon + ' ' + t.name : k) + '</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">城内 ' + U.numText(c.army[k], 0) + '</span>' +
        '<input type="number" id="wg-' + k + '" min="0" max="' + c.army[k] + '" value="0" ' +
          'style="width:80px;padding:4px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm" data-action="wg-max" data-troop="' + k + '">全</button></div>';
    }).join('');
    ui.openModal(
      '<div class="gold-heading">🛡️ 派军驻守 · ' + (ter ? ter.name : w.type) + ' Lv' + w.level + '</div>' +
      '<div class="ui-sub" style="text-align:center;margin-bottom:8px;">出发地：' + U.escape(c.name) +
        '　·　驻守后该地等级不再衰减</div>' +
      '<div class="modal-scroll">' + rows + '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn gold" data-action="wild-garrison-do">确定驻守</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };

  /* 放弃野地二次确认（v23）：不可逆操作必须说清代价 */
  ui.openAbandonWildAsk = function (x, y) {
    var w = GAME.map.wildAt(x, y);
    if (!w) { ui.toast('该野地尚未占领'); return; }
    var ter = DATA.TERRAIN[w.type];
    var gar = GAME.wildGarrisonAt(x, y);
    var garN = GAME.wildGarrisonTotal(gar);
    var at = GAME.gatherAt(x, y);
    ui.openModal(
      '<div class="gold-heading">🗑️ 放弃 ' + (ter ? ter.name : w.type) + ' Lv' + w.level + '</div>' +
      '<div class="note">放弃后该地块恢复为无主野地，<b>产量加成与采集权一并失去</b>' +
        (garN || at ? '；驻军与采集队会先撤回城内，不会损失兵力' : '') + '。</div>' +
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
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-do" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* ============================================================
   * 野地采集（v15）
   *   openGatherModal —— 派军前往某块已占野地采集
   *   openGathers     —— 进行中的采集队：进度 / 预计收成 / 收获 / 撤回
   * ============================================================ */
  ui.openGatherModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;
    var s = GAME.state, G = DATA.GATHER;
    var chk = GAME.canStartGather(x, y);
    if (!chk.ok) { ui.toast(chk.msg); return; }
    var w = chk.wild, c = GAME.currentCity();
    var res = GAME.gatherResOf(w.type);
    var add = GAME.wildAddOf(w.type, w.level) || {};
    var gens = s.generals.filter(function (g) { return g.status === 'idle' && GAME.staNow(g) >= G.stamina; });
    if (!gens.length) {
      ui.openModal('<div class="gold-heading">🔍 派军采集</div>' +
        '<div class="note">暂无可用将领（需空闲且体力 ≥ ' + G.stamina + '）。</div>');
      return;
    }
    ui._gatherGen = (ui._gatherGen && gens.some(function (g) { return g.id === ui._gatherGen; })) ? ui._gatherGen : gens[0].id;
    ui._gatherXY = { x: x, y: y };
    var maxTroop = 0;
    for (var id in (c.army || {})) maxTroop += c.army[id];
    var suggest = Math.min(G.troopCap, maxTroop);

    var genOpts = gens.map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === ui._gatherGen ? ' selected' : '') + '>' +
        U.escape(g.name) + '（Lv' + g.level + ' 体' + Math.round(GAME.staNow(g)) + '）</option>';
    }).join('');

    var perHour = G.basePerHour * (1 + (w.level || 0) * G.levelBonus);
    var sample = Math.min(G.troopCap, suggest || G.troopCap);
    var tn = DATA.TERRAIN[w.type] ? DATA.TERRAIN[w.type].name : '';

    ui.openModal(
      '<div class="gold-heading">🔍 派军采集 · ' + tn + ' Lv' + w.level + '</div>' +
      '<div class="attr"><span class="k">可采</span><span class="v good">' + (RES_NAME[res] || res) + '</span></div>' +
      '<div class="attr"><span class="k">野地加成</span><span class="v">' + (function () {
        var a = []; for (var r in add) a.push('+' + Math.round(add[r] * 100) + '%'); return a.join(' ') || '—';
      })() + '</span></div>' +
      '<div class="attr"><span class="k">收成公式</span><span class="v">' + G.basePerHour + ' × (1+' +
        Math.round((w.level || 0) * G.levelBonus * 100) + '%) × 兵力 × 时长(时)</span></div>' +
      '<div class="attr"><span class="k">每千兵·每小时</span><span class="v">' +
        U.numText(Math.round(perHour * 1000), 0) + '</span></div>' +
      '<div class="mk-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0;">' +
        '<label style="color:var(--text-dim);">带队将领</label>' +
        '<input type="hidden" id="gather-gen" value="' + (ui._gatherGen || '') + '">' +
        ui.genChips({ cls: 'gen-chips inline', target: 'gather-gen', value: ui._gatherGen, list: gens,
          sub: function (g) { return '体' + Math.round(GAME.staNow(g)); } }) +
        '<label style="color:var(--text-dim);margin-left:8px;">派兵</label>' +
        '<input type="number" id="gather-troops" min="1" max="' + maxTroop + '" value="' + suggest + '" style="width:110px;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">城内共 ' + U.numText(maxTroop, 0) + '</span>' +
      '</div>' +
      '<div class="note">有效兵力上限 <b>' + G.troopCap + '</b>　·　24 小时封顶　·　以 ' + U.numText(sample, 0) +
        ' 兵采满预计可得 <b>' + U.numText(Math.round(perHour * sample * G.maxHours), 0) + '</b> ' + (RES_NAME[res] || res) + '。</div>' +
      '<div class="modal-foot">' +
        '<button class="btn gold" data-action="gather-start">开始采集</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    );
  };

  ui.openGathers = function () {
    var RES_NAME = ui.RES_NAME;
    var s = GAME.state, G = DATA.GATHER;
    var list = GAME.gatherList();
    var body;
    if (!list.length) {
      body = '<div class="q-empty">当前没有采集队</div>';
    } else {
      body = list.map(function (g) {
        var y = GAME.gatherYield(g);
        var gen = null;
        s.generals.forEach(function (x) { if (x.id === g.genId) gen = x; });
        var tn = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : g.type;
        var resName = RES_NAME[y.res] || y.res || '—';
        var leftH = Math.max(0, G.minHours - y.hours);
        var state = y.capReached ? '<span style="color:var(--gold-light);">已满 24 小时（收益封顶）</span>'
          : y.ready ? '<span style="color:var(--green-ok);">可收获</span>'
          : '<span style="color:var(--text-dim);">还需 ' + U.dur(leftH * 3600 / GAME.timeScale()) + ' 现实时间满 1 小时</span>';
        return '<div class="inn-card">' +
          '<div class="inn-info" style="flex:1;">' +
            '<div class="inn-name">' + tn + ' Lv' + g.level + '　' + U.escape(gen ? gen.name : '（将已不在）') + '　' + state + '</div>' +
            '<div class="q-bar" style="margin:6px 0;"><i style="width:' + y.pct + '%"></i></div>' +
            '<div style="color:var(--text-dim);font-size:var(--fs-sub);">驻军 ' + U.numText(g.troops, 0) +
              '　已采 ' + y.hours.toFixed(2) + '/' + G.maxHours + ' 游戏时　预计 ' + resName + ' <b style="color:var(--gold-light)">' +
              U.numText(y.amount, 0) + '</b>　宝物率 ' +
              Math.round(GAME.gatherTreasureChance(g, gen ? gen.level : 0) * 100) + '%</div>' +
            '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
              '<button class="btn sm gold" data-action="gather-finish" data-id="' + g.id + '"' + (y.ready ? '' : ' disabled') + '>收获</button>' +
              '<button class="btn sm" data-action="gather-abandon" data-id="' + g.id + '">撤回（无收益）</button>' +
              '<button class="btn sm" data-action="gather-locate" data-x="' + g.x + '" data-y="' + g.y + '">定位</button>' +
            '</div>' +
          '</div></div>';
      }).join('');
    }
    ui.openModal(
      '<div class="gold-heading">📦 野地采集（' + list.length + '/' + G.maxActive + ' 队）</div>' +
      body, 'lg');
  };

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
        ' Lv' + p.level + '　城墙 Lv' + p.wallLv + '<span class="plan-dim">（不占格）</span></span></div>' +
      '<div class="attr"><span class="k">地块 / 人口</span><span class="v plan-v">' +
        p.col + ' × ' + p.row + ' = ' + p.total + ' 格　人口上限 ' + U.numText(p.popCap, 0) +
        '　城防 ' + p.def + '</span></div>' +
      '</div>';
  };

  ui.openFortModal = function (f) {
    ui._fortTarget = f;
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
    ui.openModal(
      '<div class="gold-heading">🏕️ 野外城池 · ' + U.escape(GAME.fortLabelOf(f)) + ' Lv' + f.level + '</div>' +
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-body);margin-bottom:8px;">守军约 ' + gNum.toLocaleString() + ' 名 · 距主城 ' + dist + ' 格</div>' +
      ui.planHTML(plan) +
      '<div class="note">守军：' + parts.join('　') + '<br>' +
        '据点等级<b style="color:var(--gold-light)">每日变化</b>，位置固定；城内建筑按等级<b>建满</b>（军营两座，其余为民房）。攻取后可获声望与厚利（材料、资源、珠宝），据点次日重置。<br>' +
        (raided
          ? '<b style="color:var(--red-light);">今日已掠夺此据点 —— 每处每日限一次，明日可再来。</b><br>'
          : '掠夺<b>每日每处限一次</b>（得手才计数）。<br>') +
        '可采材料（一阶）：凡铁 · 松木 · 粗革 · 兽筋 · 河石 · 麻布</div>' +
      '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="btn gold" data-action="fort-exp">出兵</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
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
      '<div class="note">防御计布防于本城，持续期内自动生效。锦囊现有 <b>' + ja + '</b> 个。</div>' +
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
    if (((s.items || {}).jinang || 0) < sc.jinang) { ui.toast('锦囊不足（' + ((s.items || {}).jinang || 0) + '/' + sc.jinang + '），可去商城购买'); return; }
    GAME.schemeDefSet(c, sc.id, gen);
    ui._csGen = gen.id;
    ui.closeModal();
    ui.toast('已布防「' + sc.name + '」');
    GAME.refreshAll();
  };

  ui.openExpModal = function (target) {
    var s = GAME.state, c = GAME.currentCity();
    var t = GAME.battle.resolveTarget(target);
    if (!t.ok) { ui.toast(t.msg); return; }
    ui._expTarget = target;
    ui._expScheme = null;      /* v86：每次打开出征面板重置计略（防上次的计意外带上） */
    /* v74：把**已解析的目标**存一份 —— 兵力总览/战力对比要用守军与城防，
       同一份 resolveTarget 结果直接读，不再各算一遍（两个出口必漂移）。 */
    ui._expRes = t;
    ui._expMode = ui._expMode || 'occupy';
    if (target.kind === 'city') ui._attackNpc = t.npc;
    var gNum = 0;
    for (var k in (t.garrison || {})) gNum += t.garrison[k];
    var troopRows = Object.keys(c.army || {}).map(function (id) {
      var tr = DATA.TROOPS[id];
      var own = c.army[id];
      return '<div class="res-line" style="align-items:center;"><span class="lbl">' + (tr ? tr.icon + ' ' + tr.name : id) + '</span>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">拥有 ' + own + '</span>' +
        '<input type="number" id="exp-' + id + '" min="0" max="' + own + '" value="0" style="width:70px;padding:4px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;">' +
        '<button class="btn sm" data-action="exp-max" data-troop="' + id + '">全</button></div>';
    }).join('') || '<div class="q-empty">城内无军队</div>';

    var modes = (DATA.EXPEDITION && DATA.EXPEDITION.modes) || [];
    var mtabs = modes.map(function (m) {
      var lock = ui.expModeLockOf(m.id);
      return '<div class="exp-mode' + (ui._expMode === m.id ? ' on' : '') + (lock ? ' locked' : '') +
        '" data-action="exp-mode" data-v="' + m.id + '"' +
        (lock ? ' title="' + U.escape(lock) + '"' : '') + '>' +
        '<span class="em-ico">' + m.icon + '</span><span class="em-name">' + m.name + '</span>' +
        '<span class="em-cost">' + (lock ? lock : ('体' + m.stamina + ' 精' + m.energy)) + '</span></div>';
    }).join('');
    var cur = GAME.battle.modeOf(ui._expMode);

    /* v70（老板）：出征目标写**全称** —— 名城给州·郡·县，野外城池带所在县 */
    var _tTitle = (t.kind === 'fort' && t.fort) ? GAME.fortLabelOf(t.fort)
      : (t.npc ? GAME.cityFullName(t.npc) : t.name);
    var html = '<div class="gold-heading">⚔️ ' + U.escape(_tTitle) + '</div>';
    html += '<div class="exp-info">守军约 <b>' + gNum.toLocaleString() + '</b>　' +
      (t.kind === 'wild' ? ('地形加成' + (t.terrain ? '' : '')) : ('城防 <b>' + (t.def || 0) + '</b>')) + '</div>';
    /* ============================================================
     * v60（需求 6）：未占据城池的**库藏与守将**要能预先看到
     * ------------------------------------------------------------
     * 老板给这些城定了"按等级派生的资源量 + 建筑全满 + 有守将"，
     * 那就必须**看得见** —— 否则玩家凭什么判断"这座城值不值得打"。
     * 数据来自 GAME.npcCityInfo（纯派生、不入存档）：
     * 侦查时看到的、出征时打的、打下来继承的，是同一份数（一个出口）。
     * ============================================================ */
    if (t.kind === 'city' && t.npc) {
      var nci = GAME.npcCityInfo(t.npc);
      var ng = nci.guard;
      html += '<div class="exp-info exp-npc">库藏　粮 <b>' + U.fmt(nci.res.grain) + '</b>' +
        '　木 ' + U.fmt(nci.res.wood) + '　石 ' + U.fmt(nci.res.stone) + '　铁 ' + U.fmt(nci.res.iron) +
        '　金 <b>' + U.fmt(nci.res.gold) + '</b>　人口 ' + U.fmt(nci.res.pop) + '</div>';
      if (ng) {
        html += '<div class="exp-info exp-npc">守将　<b>' + U.escape(ng.name) + '</b>（' +
          U.escape(ng.title || '守将') + ' Lv' + ng.level + '）　统' + ng.tong + '　勇' + ng.yw +
          '　智' + ng.zm + '　政' + ng.nz + '</div>';
      }
      html += '<div class="exp-info exp-npc" style="color:var(--text-dim);">' +
        U.escape(nci.perk.name) + '：' + U.escape(nci.perk.desc) +
        '　·　建筑皆已 Lv' + (t.npc.level || 1) + ' 满配' +
        '　·　攻占后其中库藏尽归我有</div>';
    } else if (t.kind === 'fort' && t.plan) {
      /* v61（老板）：野外城池也"建筑全满"（各 1 座 · 军营 2 座 · 余为民房），
         出征前先让玩家看见它是什么成色 —— 数据来自 GAME.fortPlanOf（唯一出口）。 */
      html += ui.planHTML(t.plan);
    }
    /* v18：行军预估（随兵力输入实时更新 —— 由最慢兵种决定，所以填兵后才准）
       v74（老板：完善出征界面）：紧跟两行 ——
         · #exp-sum   兵力总览：共派遣 N 兵 · 耗粮 X/时
         · #exp-power 战力对比：我方 vs 守军（估算，同一套 troopPower 口径） */
    html += '<div class="exp-info" id="exp-march"></div>';
    html += '<div class="exp-info" id="exp-sum"></div>';
    html += '<div class="exp-info" id="exp-power"></div>';
    /* v59：本次出征带的战术（在「校场 → 出征战术」里调）——
       写在这里是因为"我这次是不是让弓兵防御了"是出征前必须确认的一件事 */
    html += '<div class="exp-info">战术 <b>' + GAME.tacticSummary() + '</b>' +
      '<span class="exp-tac-link" data-action="open-tactic">调整</span></div>';
    /* v86（老板「按计划进行」· G1）：计略 —— 本次出征携一门计（主将施计） */
    html += '<div class="exp-info">计略 <b id="exp-scheme-label">' + ui.expSchemeLabel() + '</b>' +
      '<span class="exp-tac-link" data-action="exp-scheme">选择</span></div>';
    /* v86：计略选择 = 面板内嵌展开区（复用 .exp-body 的滚动样式，不新增 CSS） */
    html += '<div id="exp-scheme-box" class="hidden exp-body" style="max-height:210px;margin:0 0 6px;"></div>';
    html += '<div class="exp-modes">' + mtabs + '</div>';
    html += '<div class="exp-body" data-mode="' + cur.id + '">';
    if (!ui._expGen || !s.generals.some(function (g) { return g.id === ui._expGen; })) {
      ui._expGen = s.generals[0] ? s.generals[0].id : '';
    }
    html += '<div style="margin-bottom:8px;">'
      + '<div class="ui-sub" style="margin-bottom:4px;">主将</div>'
      + '<input type="hidden" id="exp-gen" value="' + ui._expGen + '">'
      + ui.genChips({ target: 'exp-gen', value: ui._expGen,
          sub: function (g) { return '统' + GAME.genAttrs(g).tong + ' 体' + Math.round(GAME.staNow(g)) + ' 精' + Math.round(g.energy || 0); } })
      + '</div>';
    html += '<div class="exp-troops">';
    /* v74：全带 / 清空 —— 一格一格点「全」太慢；这两个按钮只改输入框的值，
       统一走 updateExpMarch 的实时口径（不藏第二份状态）。 */
    html += '<div class="ui-sub" style="margin-bottom:6px;display:flex;align-items:center;gap:8px;">派遣兵力' +
      '<button class="btn sm" data-action="exp-fill-all">全带</button>' +
      '<button class="btn sm" data-action="exp-clear-all">清空</button></div>';
    html += troopRows + '</div></div>';
    html += '<div style="text-align:center;margin-top:14px;display:flex;gap:8px;justify-content:center;">' +
      '<button class="btn gold" data-action="exp-confirm">' + cur.icon + ' ' + cur.name + '</button>' +
      '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
    ui.applyExpMode();
    ui.updateExpMarch();
  };

  /* 行军队列预估（出征弹窗内实时显示）
     行军速度由**最慢兵种**决定，所以必须等玩家填完兵力才准；
     未填时按城内现有兵种占位估算，并标注说明。 */
  ui.updateExpMarch = function () {
    var box = $('#exp-march');
    if (!box) return;
    var t = ui._expTarget;
    var city = GAME.currentCity();
    if (!t || !city) { box.textContent = ''; return; }
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
       战力走 STORY.troopPower（与来袭/家底评估同一出口）；
       守军侧对城池/据点吃城防系数（与 defensePowerOf 同一个 defDivisor 常量）。 */
    var sum73 = $('#exp-sum'), pow73 = $('#exp-power');
    if (sum73 || pow73) {
      var tp74 = (GAME.story && GAME.story.troopPower) ? GAME.story.troopPower : null;
      var n74 = 0, feed74 = 0, mine74 = 0;
      Object.keys(city.army || {}).forEach(function (id) {
        var inp74 = document.getElementById('exp-' + id);
        var v74 = inp74 ? Number(inp74.value) || 0 : 0;
        var tr74 = DATA.TROOPS[id];
        n74 += v74;
        if (tr74) feed74 += v74 * (tr74.food || 0);
        if (tp74) mine74 += v74 * tp74(id);
      });
      if (sum73) {
        sum73.innerHTML = '👥 共派遣 <b>' + U.numText(n74, 0) + '</b> 兵　' +
          '耗粮 <b>' + U.numText(feed74, 0) + '</b>/时' +
          (fallback ? '<span style="opacity:.6;">（未填兵力，按现有兵种展示守军对比）</span>' : '');
      }
      if (pow73) {
        var res74 = ui._expRes;
        var def74 = 0;
        if (res74 && tp74) {
          var div74 = (DATA.INVASION && DATA.INVASION.defDivisor) || 480;
          var wall74 = (res74.def || 0) / div74;
          for (var k74 in (res74.garrison || {})) def74 += tp74(k74) * (res74.garrison[k74] || 0);
          def74 = Math.round(def74 * (1 + wall74));
        }
        if (def74 > 0 && mine74 > 0) {
          var ratio74 = mine74 / def74;
          var lv74 = ratio74 >= 1.6 ? ['兵力充足', 'var(--green-ok)']
            : ratio74 >= 1.0 ? ['势均力敌', 'var(--gold-light)']
            : ratio74 >= 0.6 ? ['兵力偏少', 'var(--amber, #e0a83c)']
            : ['兵力悬殊', 'var(--red-light)'];
          pow73.innerHTML = '⚔️ 战力估算　我方 <b style="color:var(--blue-info)">' + U.numText(mine74, 0) +
            '</b>　vs　守军 <b style="color:var(--red-light)">' + U.numText(def74, 0) + '</b>' +
            '　<span style="color:' + lv74[1] + ';font-weight:700;">' + lv74[0] + '（' +
            (Math.round(ratio74 * 100) / 100) + ' : 1）</span>' +
            '<span style="opacity:.6;">　估算口径：兵种属性加权，守方含城防</span>';
        } else {
          pow73.innerHTML = '⚔️ 战力估算　' + (mine74 > 0 ? '守军兵力未知' : '填入兵力后显示对比');
        }
      }
    }
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
          '只能加、不能减；四项主属性另有永久丹药（商城 · 丹药），每将每项上限 50。'),
      size: 'sm',
      body:
        '<div class="ui-sub">自由属性点</div>' +
        '<div class="stat-row"><span class="sr-name">🎯 消耗 1 点</span>' +
          '<span class="sr-sub">剩 ' + fp + ' 点</span>' +
          '<button class="btn sm' + (fp > 0 ? ' gold' : ' dim') + '" data-action="stat-plus-free"' +
            ' data-gen="' + genId + '" data-stat="' + stat + '"' + (fp > 0 ? '' : ' disabled') +
            ' title="' + (fp > 0 ? nm + ' +1（只增不减）' : '自由属性点不足：升级获得，每级 = 资质成长值') + '">＋1</button></div>' +
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
    var tabs = $$('#modal-root .exp-mode');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('on', tabs[i].dataset.v === m);
    }
    var cur = GAME.battle.modeOf(m);
    var btn = $('#modal-root [data-action="exp-confirm"]');
    if (btn) btn.innerHTML = cur.icon + ' ' + cur.name;
    var body = $('#modal-root .exp-body');
    if (body) body.dataset.mode = m;
    ui.applyExpMode();
  };

  ui.applyExpMode = function () {
    var cur = GAME.battle.modeOf(ui._expMode || 'occupy');
    var box = $('#modal-root .exp-troops');
    if (box) box.style.opacity = cur.battle ? '1' : '.55';
  };

  /* 旧接口兼容 */
  ui.openAttackModal = function (npcCity) { ui.openExpModal({ kind: 'city', id: npcCity.id, npc: npcCity }); };


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
    bar.innerHTML = (arr.length ? arr.join('')
      : '<span class="bb-hint">—</span>')
      + '<button class="bb-mini" data-action="open-minimap" title="缩略地图：点击看天下大势">'
      + '<canvas id="mini-canvas" width="' + ui.MINI_PX + '" height="' + ui.MINI_PX + '"></canvas>'
      + '</button>';
    ui.paintMiniBottom();
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
      page: p.page, maxPage: p.maxPage,
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
        + '<span class="q-sec-n">' + readyItems.length + ' 项</span></div>'
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
        '<button class="btn sm" data-action="reroll-all-rand" style="margin-left:auto;">全部换新（' + U.fmt(GAME.randQuestRerollAllCost()) + '金）</button></div>' +
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
    if (claimed) {
      foot += '<span class="ui-sub">已领取</span>';
    } else if (ready) {
      foot += isRandom
        ? '<button class="btn gold" data-action="claim-rand-quest" data-q="' + def.id + '">领取奖励</button>'
        : '<button class="btn gold" data-action="claim-quest" data-q="' + def.id + '">领取奖励</button>';
    }
    /* 放弃任务：随机任务可以换一条（收工本费）；成长任务不可放弃 —— 它是"功业进程" */
    if (isRandom && entry) {
      foot += '<button class="btn red" data-action="reroll-rand-quest" data-q="' + def.id + '">放弃并换一条（'
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

  /* ------------------------------------------------------------
   * 黄册（v27 · 需求 7）：统计页的信息呈现
   * ------------------------------------------------------------
   * `ui.lgSec` 一段之首（甲/乙/丙…），`ui.lgRow` 一行账目：
   *   「项目 …… 数值」——中间那串点用一条虚线撑开（引线），
   *   数值右对齐、等宽数字，读数时眼睛顺着引线走，不会串行。
   * 只有墨线与朱点，没有卡片：信息密度高、落点唯一。
   * ------------------------------------------------------------ */
  ui.lgSec = function (title) {
    return '<div class="ledger-sec">' + U.escape(title) + '</div>';
  };
  ui.lgRow = function (k, v, sub, hero) {
    return '<div class="lg-row' + (hero ? ' hero' : '') + '">' +
      '<span class="lg-k">' + k + '</span><span class="lg-fill"></span>' +
      '<span class="lg-v">' + v + (sub ? '<span class="lg-sub">　' + sub + '</span>' : '') + '</span></div>';
  };

  ui.statsHTML = function () {
    var s = GAME.state, main = GAME.map.playerCity();
    var cur = GAME.currentCity() || main;
    var extAll = GAME.extSummary ? GAME.extSummary() : null;
    var wildCap = GAME.buildingLevel(main, 'guanfu') || 1;
    var rankName = DATA.RANK[s.rank] ? DATA.RANK[s.rank].name : '平民';
    /* ============================================================
     * 全境汇总（v29 建，v54 老板精简）
     * ------------------------------------------------------------
     * v29 是"左右分列、同类同侧"，一共十一节；v54 老板点名删掉**别处已有的**三块
     *   · 君主（爵位/威望/民心/将领/科技）→ 顶栏、君主面板、各玩法菜单里都有
     *   · 府库（粮木石铁金）→ 侧栏资源栏常驻
     *   · 军民（总人口/总驻军/合计城防/伤兵）→ 侧栏人口与驻军栏常驻
     * 删完之后只剩三节，再分左右两栏必然"一边长一边短、底下留一大块"（老板原话），
     * 所以改成**单本账册**：`.ledger` 本身就是两列的（一行放两笔），
     * 节标题横贯全宽，甲乙丙顺序自上而下读，多一节少一节都不会歪。
     * ============================================================ */
    var ledger = '<div class="ledger">' +
      ui.lgSec('甲 · 疆域') +
      ui.lgRow('城池', (s.cities || []).length + ' 座', rankName) +
      ui.lgRow('已占野地', (s.wilds || []).length + ' 块', '上限 ' + wildCap) +
      ui.lgRow('城外地块', (extAll ? extAll.used : GAME.extUsed(main)) + ' / ' +
        (extAll ? extAll.cap : GAME.extCap(main)) + ' 块') +

      ui.lgSec('乙 · 在外') +
      ui.lgRow('采集队', GAME.gatherList().length + ' / ' + DATA.GATHER.maxActive + ' 队') +
      ui.lgRow('行军中', (s.marches || []).length + ' 队') +
      /* v60（需求 3）：老板要求「满级专精写在对应建筑的介绍里就好，不要写在全境汇总」。
         原先这一节（丙 · 满级专精）已删 —— 专精是**某座建筑**的属性，
         它的说明就该长在那座建筑的面板上（见点开建筑格时的「满级专精」行），
         摊到全境账册里既脱离了"哪座建筑、哪座城"，又和工作量无关。
         ⚠️ 门槛仍是**基准上限 12**（DATA.MAX_BLEVEL）：名城上限提高（v54）
         只是"能继续往上盖"，专精含义不跟着动 —— 否则洛阳的民房从 Lv12 变成
         "没满级"，已到手的 +20% 人口会凭空消失。 */
      '</div>';

    var cityRows = s.cities.map(function (c) {
      var isCur = cur && c.id === cur.id;
      return '<tr' + (isCur ? ' class="row-cur"' : '') + '>' +
        '<td>' + (isCur ? '▶ ' : '') + ui.cityLabelHTML(c) + '</td>' +
        '<td class="ctr">' + (DATA.CITY_TIER[c.type] || '自建城') + '</td>' +
        '<td class="ctr">' + c.x + ',' + c.y + '</td>' +
        '<td class="num">Lv' + (GAME.buildingLevel(c, 'guanfu') || 1) + '</td>' +
        '<td class="num">' + U.fmt(GAME.maxPopOf(c)) + '</td>' +
        '<td class="num">' + U.numText(GAME.armyTotal(c), 0) + '</td>' +
        '<td class="num">' + GAME.cityDefense(c) + '</td>' +
        '<td class="num">' + GAME.extUsed(c) + '/' + GAME.extCap(c) + '</td>' +
        '<td class="ctr">' + (isCur ? '<span class="ui-sub">当前</span>'
          : '<button class="btn sm" data-action="stats-goto" data-city="' + c.id + '">进入</button>') + '</td></tr>';
    }).join('');
    var wildRows = (s.wilds || []).map(function (w) {
      var t = DATA.TERRAIN[w.type];
      return '<tr><td>' + (t ? t.name : w.type) + '</td><td>' + w.x + ',' + w.y + '</td><td>Lv' + w.level + '</td></tr>';
    }).join('');
    return '<div class="ui-page">' +
      ui.scrollOpen('册', '全境汇总', '据有 ' + s.cities.length + ' 城　·　' + rankName) +
      ledger +
      ui.sealH('城池明细', '共 ' + s.cities.length + ' 座 · 点「进入」切换到该城') +
      '<table class="tbl"><thead><tr><th>城池</th><th>类型</th><th>坐标</th><th>官府</th>' +
        '<th>人口上限</th><th>驻军</th><th>城防</th><th>外城</th><th>操作</th></tr></thead>' +
        '<tbody>' + cityRows + '</tbody></table>' +
      ui.sealH('已占野地', (s.wilds || []).length + ' 个 / 上限 ' + (GAME.buildingLevel(main, 'guanfu') || 1)) +
      (wildRows ? '<table class="tbl"><thead><tr><th>地形</th><th>坐标</th><th>等级</th></tr></thead><tbody>' + wildRows + '</tbody></table>' : '<div style="color:var(--text-dim);font-size:var(--fs-sub);">尚未占领野地</div>') +
      ui.scrollClose() +
      '</div>';
  };

  /* --------- 公文 --------- */
  /* v43：公文两个列表的每页条数 —— 统一在此定义，reportsHTML / msgLines / msgPager 共用，
     避免"两处各写一个数"导致翻页条与内容对不上。 */
  ui.DOC_PER = 8;      /* 战报每页 */
  ui.MSG_PER = 15;     /* 消息每页 */
  ui.reportsHTML = function () {
    var s = GAME.state;
    var ch = ui._msgCh || 'sys';
    /* ---- 战报列表 ---- */
    /* v43（老板要求）：战报**分页** —— 原来整卷列出，打过几十场仗以后
       这一页就是一条望不到头的清单。每页 8 份，翻页走底部固定条。 */
    var rPg = ui.pageOf('rep', s.reports.length, ui.DOC_PER);
    var repTable = s.reports.length
      ? s.reports.slice(rPg.from, rPg.to).map(function (r, i) {
          var idx = rPg.from + i;
          var d = new Date(r.t);
          /* v39（需求 4）：去框 —— 不再有底色/边框/圆角，也不用每行一个「查看」按钮
           （按钮本身就是一个个小框）。整行可点，右侧给一个"查看 ›"文字提示。 */
        return '<div class="doc-bar' + (r.win ? ' win' : '') + '" data-action="view-report" data-i="' + idx + '">' +
            '<span class="db-t">' + U.escape(r.title) + '</span>' +
            '<span class="db-d">' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
              U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
            '<span class="db-go">查看 ›</span></div>';
        }).join('')
      : '<div class="q-empty">尚无战报。出征与攻城的战果会记在这里。</div>';
    if (s.reports.length > ui.DOC_PER) ui.pagerHTML('rep', s.reports.length, ui.DOC_PER);
    /* ---- 消息流 ---- */
    var tabs = [['sys', '系统'], ['war', '战报'], ['task', '任务'], ['all', '全部']].map(function (t) {
      return '<span class="ch' + (ch === t[0] ? ' active' : '') + '" data-action="msg-channel" data-ch="' + t[0] + '">' + t[1] + '</span>';
    }).join('');
    var n = GAME.msgLog().length;
    /* ============================================================
     * v29（需求 6）：公文**只留报告与消息** —— 队列整段撤掉。
     * ------------------------------------------------------------
     * 队列信息各自归位，不再挤在公文里当"第二份真相"：
     *   · 建造 / 募兵 → 官府弹窗的「在办事项」（城务的归口）
     *   · 行军        → 顶栏「行军」菜单（本来就有队列与召回）
     *   · 自动升级/研究/出征 → 顶栏新的「自动」菜单
     * 地块上的行内进度（施工 % / 募兵 %）本来就一直在，进度并不丢失。
     * ============================================================ */
    /* v39（需求 4）：公文页不再套卷轴壳 —— 老板说"公文好多下拉框"，
       指的是这一层层带底色的框（卷轴壳 + 战报框 + 消息滚动框）。
       内容本来就只有两块，套大壳反而像"框里装框"。改扁平：
       页标题 + 两个分区，与背包/任务等页同一套骨架。
       （统计页仍用卷轴壳 —— 那是"册页"，内容多，壳有承载感。） */
    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 公文 · 报告与消息' +
        ui.help('战报按胜负分色，点一行看详情\n消息是系统提示流，可用频道筛选') + '</div>' +
      ui.sealH('战报', '共 ' + s.reports.length + ' 份') +
      repTable +
      ui.sealH('消息', '保留最近 ' + GAME.msgDays() + ' 游戏天内的全部提示 · 现有 ' + n + ' 条') +
      '<div class="msg-channels">' + tabs + '</div>' +
      '<div class="msg-log" id="msg-log">' + ui.msgLines(ch) + '</div>' +
      ui.msgPager(ch) +
      '</div>';
  };

  /* 消息条数 —— msgLines 与 msgPager 必须同口径，抽出来共用 */
  ui.msgCount = function (ch) {
    ch = ch || 'sys';
    return (ch === 'war') ? ((GAME.state.reports || []).length) : GAME.msgLog().length;
  };

  /* 消息行（公文页渲染 + 主循环实时刷新共用）
     v43（老板要求）：**改分页** —— 原来一次取 300 条塞进固定高度里滚动
     （原话："公文的行太多了，说了尽量避免下拉框"）。
     现在每页 15 条；翻页条由 msgPager 单独登记。 */
  ui.msgLines = function (ch) {
    ch = ch || 'sys';
    var s = GAME.state, out = [];
    if (ch === 'sys' || ch === 'all') {
      var all = GAME.msgLog().slice().reverse();      // 不再截断，交给分页
      var pg = ui.pageOf('msg' + ch, all.length, ui.MSG_PER);
      all.slice(pg.from, pg.to).forEach(function (l) {
        var cls = /战|攻|败|损/.test(l.msg) ? 'war' : (/任务|史册|改元/.test(l.msg) ? 'task' : 'sys');
        out.push('<div class="bb-line ' + cls + '">· ' + U.escape(l.msg) + '</div>');
      });
      if (pg.from >= all.length) out.push('<div class="bb-line sys">· 暂无系统提示</div>');
    } else if (ch === 'war') {
      var reps = (s.reports || []);
      var pgr = ui.pageOf('msgwar', reps.length, ui.MSG_PER);
      var rp = reps.slice(pgr.from, pgr.to);
      if (rp.length) rp.forEach(function (r) { out.push('<div class="bb-line war">' + (r.win ? '🏆 ' : '💥 ') + U.escape(r.title) + '</div>'); });
      else out.push('<div class="bb-line">暂无战报</div>');
    } else if (ch === 'task') {
      var sum = GAME.questSummary();
      out.push('<div class="bb-line task">可领取 ' + sum.ready + ' 项（成长 ' + sum.growthReady + ' · 随机 ' + sum.randReady + '）</div>');
      (DATA.QUESTS || []).forEach(function (q) {
        if (!GAME.questDone(q) && GAME.questReady(q)) out.push('<div class="bb-line task">· ' + U.escape(q.title) + '</div>');
      });
      (s.quests.pool || []).forEach(function (e) {
        var d = GAME.randomQuestDef(e.id);
        if (d && GAME.randQuestReady(e)) out.push('<div class="bb-line task">· [随机] ' + U.escape(d.title) + '</div>');
      });
    }
    return out.join('');
  };

  /* 消息分页条登记（返回空串，只为整页渲染时调用一次）。
     **不能写进 msgLines** —— 它被主循环每秒调用，会反复登记同一个分页条。 */
  ui.msgPager = function (ch) {
    ch = ch || 'sys';
    if (ch === 'task') return '';                  // 任务频道内容有限，一次列完
    var total = ui.msgCount(ch);
    if (total > ui.MSG_PER) ui.pagerHTML('msg' + ch, total, ui.MSG_PER);
    return '';
  };

  ui.setMsgChannel = function (ch) {
    ui._msgCh = ch;
    ui._pages['msg' + ch] = 1;                     // v43：切频道回到第一页
    GAME.refreshView();
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
  ui.viewReport = function (i) {
    var r = GAME.state.reports[i];
    if (!r) return;
    var html = '<div class="gold-heading">' + U.escape(r.title) + '</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        new Date(r.t).toLocaleString() + '</div>' +
      '<div style="background:rgba(var(--sh-rgb),.3);border-radius:6px;padding:12px;font-size:var(--fs-lead);line-height:1.8;">' +
        r.body + '</div>';

    var sc = r.scene;
    if (sc) {
      html += ui.sealH('战斗场景', '战场纵深 ' + U.numText(sc.field, 0)
        + '　·　共 ' + sc.rounds + ' 回合　·　▓ 部队　· 间距　▕▏ 两军间距');
      html += '<div class="bt-scene"><div class="bt-head">' +
        '<span>我方</span><span class="bt-scale">战场纵深 ' + U.numText(sc.field, 0) + '</span><span>敌军</span>' +
        '</div>';
      var last = -1;
      (sc.rows || []).forEach(function (row) {
        if (last >= 0 && row.r > last + 1) html += '<div class="bt-gap">……</div>';
        html += '<div class="bt-row">' +
          '<span class="bt-r">' + row.r + '</span>' +
          '<span class="bt-strip">' + String(row.s)
            .replace(/▓/g, '<i>▓</i>').replace(/·/g, '<u>·</u>') + '</span>' +
          '<span class="bt-n">我 ' + U.fmt(row.a) + '　敌 ' + U.fmt(row.d) + '</span>' +
          '<span class="bt-g">间距 ' + U.numText(row.gap, 0) + '</span></div>';
        last = row.r;
      });
      html += '</div>';

      html += ui.sealH('回合纪要', '速度高的兵种先行动；接敌即开火');
      html += '<div class="bt-log">' + (sc.roundsText || []).map(function (l) {
        return '<div class="bt-line">' + U.escape(l) + '</div>';
      }).join('') + '</div>';
    }

    /* 兵种损耗表：从正文里已经有的信息再结构化一遍，便于逐项核对 */
    var bk = ui._reportLoss(r);
    if (bk) {
      html += ui.sealH('兵种损耗', '初始 → 剩余（损失）');
      html += '<table class="tbl"><thead><tr><th>兵种</th><th>我方初始</th><th>我方损失</th>' +
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

    html += '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
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
  ui.autoSwitchBtn = function (key, label, on, action) {
    return '<button class="btn' + (on ? ' auto-on' : '') + '" data-action="' + action + '">' +
      label + ' · ' + (on ? '已开启' : '已关闭') + '</button>';
  };
  ui.autoSwitchRow = function () {
    var s = GAME.state;
    var cfg = GAME.autoMarchCfg ? GAME.autoMarchCfg() : null;
    return '<div class="auto-switches">' +
      ui.autoSwitchBtn('up', '🔨 自动升级', s.settings.autoUpgrade, 'toggle-auto-upgrade') +
      ui.autoSwitchBtn('tech', '📜 自动研究', s.settings.autoResearch, 'toggle-auto-research') +
      ui.autoSwitchBtn('march', '⚔️ 自动出征', !!(cfg && cfg.on), 'toggle-auto-march') +
      '</div>';
  };
  ui.autoStateLine = function () {
    var s = GAME.state;
    var parts = [];
    parts.push('升级：' + ((s.autoState && s.autoState.msg) || '未开启'));
    parts.push('研究：' + ((s.autoTechState && s.autoTechState.msg) || '未开启'));
    parts.push('出征：' + ((s.autoMarchInfo && s.autoMarchInfo.msg) || '未开启'));
    return parts.join('　｜　');
  };
  /* 点选控件（时间倍率 / 税率）—— 与显示比例同款，全站一套 */
  ui.optBar = function (after, opts, cur) {
    return ui.chips({
      cls: 'chips-xs', after: after,
      opts: opts.map(function (v) { return { v: v, on: v === cur, label: v + '%' }; })
    });
  };

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
    var s = GAME.state;
    var ts = s.settings.timeScale || 1;
    var taxPct = Math.round((s.tax || 0) * 100);
    return '<div class="ui-page">' +
      '<div class="gold-heading">⚙️ 设置</div>' +
      /* v67：存档入口放**第一张卡**（老板的规矩：重要入口不许放在面板末尾） */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">💾 存档管理</span><span class="val">' +
          (function () { var n = 0; GAME.slotList().forEach(function (x) { if (x.meta) n++; });
            return n + ' / 7 有档'; })() + '</span></div>' +
        '<div class="auto-line">' +
          '<button class="btn sm gold" data-action="open-saves">存档 / 读取 / 导出 / 导入</button>' +
        '</div>' +
      '</div>' +
      /* v39（需求 1）：界面主题 —— 老板要的「几个颜色模式，护眼、适宜长玩」。
         放在设置页第一张：它是界面外观的总开关，改一次全局生效。 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🎨 界面主题</span><span class="val">' +
          ui.themeDef(ui.theme()).name + '</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'theme',
          opts: (DATA.THEMES || []).map(function (t) {
            return { v: t.id, on: ui.theme() === t.id, label: t.name };
          })
        }) + '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">' + ui.themeDef(ui.theme()).desc + '</div>' +
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
      /* v25（需求 3）：显示比例从侧栏移到这里 —— 它是"一次性偏好"，不是每局都在看的东西 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🔍 显示比例</span><span class="val">' + ui.zoom() + '%</span></div>' +
        '<div class="auto-line">' + ui.zoomBarHTML() + '</div>' +
      '</div>' +
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">💰 税率</span><span class="val">' + taxPct + '%</span></div>' +
        '<div class="auto-line">' + ui.optBar('tax', [0, 20, 40, 50, 60, 80, 100], taxPct) + '</div>' +
      '</div>' +
      /* v36（需求 2）：自动化整段撤出设置页 —— 只在顶栏「自动」菜单。
         同一个开关摆在两个菜单里，是"改一处、忘一处"的温床：
         设置页改的是 s.settings，自动菜单改的也是它，但两处渲染时机与措辞
         各写一遍，迟早对不上。现在**开关与参数同处一地**，设置页只管
         一次性偏好（倍率/比例/税率）与存档。 */
      '<div class="set-card" style="margin-bottom:0;">' +
        '<div style="color:var(--gold-light);font-weight:700;margin-bottom:8px;">💾 存档管理</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button class="btn gold" data-action="save">保存进度</button>' +
          '<button class="btn red" data-action="new-game">新游戏（清档）</button>' +
        '</div>' +
        '<div class="ui-sub" style="margin-top:8px;">存档 v3' + ui.help('自动存档每 5 分钟一次（覆盖式写入，只保留最新一档）') + '</div>' +
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
  ui.autoHTML = function () {
    var s = GAME.state;
    var cfg = GAME.autoMarchCfg();
    var A = DATA.AUTO_MARCH;
    var city = GAME.currentCity();
    var idle = (s.generals || []).filter(function (g) { return !g.status || g.status === 'idle'; });
    var mode = GAME.battle.modeOf(cfg.mode);

    /* 将领候选：全部列出，但把非空闲的标出来（选了也不会出发，会写明原因） */
    var genOpts = (s.generals || []).map(function (g) {
      var busy = g.status && g.status !== 'idle';
      return {
        v: g.id, on: g.id === cfg.genId,
        label: U.escape(g.name) + (busy ? '（' + ui.genStatusName(g) + '）' : ''),
      };
    });
    if (!genOpts.length) genOpts = [{ v: '', on: true, label: '帐下暂无将领' }];

    /* 兵力候选：只列举"当前城拿得出"的档位，够不着的置灰 */
    var have = city ? GAME.armyTotal(city) : 0;
    var troopOpts = A.troopOptions.map(function (v) {
      var ok = have >= v;
      return { v: v, on: v === cfg.troops, label: U.fmt(v) + (ok ? '' : '（不足）') };
    });

    var html = '<div class="ui-page">' +
      '<div class="gold-heading">🤖 自动化' +
        ui.help('三个开关彼此独立。\n自动出征只派空闲将领、体力不足不出征、器械与斥候不编入，\n且只从当前城池取兵 —— 不会把别的城掏空。') +
      '</div>' +
      '<div class="auto-card">' +
        '<div class="ac-title">总览</div>' +
        ui.autoSwitchRow() +
        '<div class="auto-state">' + U.escape(ui.autoStateLine()) + '</div>' +
      '</div>' +

      /* ---- 自动升级 ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">🔨 自动升级</div>' +
        '<div class="auto-state">' + U.escape((s.autoState && s.autoState.msg) || '未开启') + '</div>' +
        '<div class="auto-note">按等级从低到高、同级城内优先；受建造队列上限约束。' +
          '资源不足时<b>暂停但不关开关</b>，资源恢复后自动继续；全部满级则停止。' +
          '只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>' +
      '</div>' +

      /* ---- 自动研究 ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">📜 自动研究</div>' +
        '<div class="auto-state">' + U.escape((s.autoTechState && s.autoTechState.msg) || '未开启') + '</div>' +
        '<div class="auto-note">从书院当前能研究的科技里挑最便宜的一项；' +
          '资源不足则暂停等待，不影响开关状态。</div>' +
      '</div>' +

      /* ---- 自动出征 ---- */
      '<div class="auto-card">' +
        '<div class="ac-title">⚔️ 自动出征' +
          '<span style="font-weight:400;font-size:var(--fs-sub);color:var(--text-dim);">' +
            '以「' + (city ? U.escape(GAME.cityLabel(city)) : '—') + '」为起点，' +
            A.searchRadius + ' 格内自动找目标，用来刷将领经验</span></div>' +

        '<div class="auto-line"><span class="al-k">执行将领</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'genId', opts: genOpts }) + '</div>' +

        '<div class="auto-line"><span class="al-k">单次兵力</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'troops', opts: troopOpts }) +
          '<span class="ui-sub">当前城池可派 ' + U.numText(have, 0) + ' 兵</span></div>' +

        '<div class="auto-line"><span class="al-k">目标类型</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'target',
            opts: A.targetOptions.map(function (x) {
              return { v: x[0], on: cfg.target === x[0], label: x[1] };
            }) }) + '</div>' +

        '<div class="auto-line"><span class="al-k">目标等级</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'maxLevel',
            opts: A.levelOptions.map(function (v) {
              return { v: v, on: v === cfg.maxLevel, label: '≤ Lv' + v };
            }) }) + '</div>' +

        '<div class="auto-line"><span class="al-k">出征类型</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'mode',
            opts: ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).map(function (m) {
              return { v: m.id, on: cfg.mode === m.id, label: m.icon + ' ' + m.name };
            }) }) +
          '<span class="ui-sub">体力门槛 ' + mode.stamina + '　' + U.escape(mode.desc || '') + '</span></div>' +

        '<div class="auto-line"><span class="al-k">出征频率</span>' +
          ui.chips({ cls: 'chips-xs', after: 'automarch', k: 'everyMin',
            opts: A.freqOptions.map(function (v) {
              return { v: v, on: v === cfg.everyMin, label: v + ' 分钟' };
            }) }) + '</div>' +

        '<div class="auto-state">上次结果：' +
          U.escape((s.autoMarchInfo && s.autoMarchInfo.msg) || '尚未执行') + '</div>' +
        '<div class="auto-line" style="margin-top:10px;">' +
          '<button class="btn" data-action="auto-march-once">立即出征一次</button>' +
          '<span class="ui-sub">空闲将领 ' + idle.length + ' 位　·　' +
            '下次执行 ' + (cfg.on ? ('约 ' + cfg.everyMin + ' 分钟后（或体力恢复后）') : '未开启') + '</span></div>' +

        '<div class="auto-note"><b>红线（不可关闭）</b>：' +
          '① 只派<b>空闲</b>将领，出征中/守将/采集中一律跳过；' +
          '② 体力不足以支付本次出征就不出发；' +
          '③ 器械（床弩/冲车/投石车）、斥候、辎重<b>不编入</b>自动队伍 —— ' +
          '它们拖慢行军，且是守城家底；' +
          '④ 只从<b>当前城池</b>取兵；' +
          '⑤ 已占野地与今日已攻破的据点不会被重复打。</div>' +
      '</div>' +
      '</div>';
    return html;
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
      { size: 'xl' });
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
      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种子由采集与征战获得，生长走游戏时间</div>' +
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
})();

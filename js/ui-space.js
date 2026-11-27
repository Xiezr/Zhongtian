/* ============================================================
 * ui-space.js　星空 · 星系 / 空间站 / 殖民 / 深空远征 / 3D 预览
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
   * v91.30 星系界面（一级视图 · 纯 canvas 径向渐变画球）
   * ------------------------------------------------------------
   * 中央大太阳（球·发黄光·无数据·留 starData 占位）+ 各星球缩球绕太阳（各带"进入"）。
   * 点击某星球 → 进现有单星球管理界面（setView('map')）。本视图不改单星球逻辑。
   * 用 2D canvas（不依赖 THREE · 测试可跑 · 稳）；3D 无头进不了此处也无妨。
   * ============================================================ */
  ui.galaxyHTML = function () {
    return '<div class="galaxy-wrap" style="position:relative;width:100%;height:100%;min-height:520px;">' +
      '<canvas id="galaxyCanvas" style="width:100%;height:100%;display:block;background:radial-gradient(circle at 50% 45%,#0b1220,#05070c 70%);"></canvas>' +
      '<div class="galaxy-tip" style="position:absolute;left:12px;bottom:10px;color:var(--text-dim);font-size:var(--fs-sub);">点击星球进入其单星球管理界面　·　太阳（无数据·预留）</div>' +
      '</div>';
  };
  ui.renderGalaxy = function () {
    var cv = document.getElementById('galaxyCanvas'); if (!cv) return;
    var box = cv.parentNode; var W = box.clientWidth || 900, H = box.clientHeight || 560;
    /* 允许传 opts 覆写（供测试/无布局环境）：ui._galaxyW/H */
    if (ui._galaxyW) W = ui._galaxyW; if (ui._galaxyH) H = ui._galaxyH;
    if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
    var ctx = cv.getContext('2d'); if (!ctx || !ctx.createRadialGradient) return;
    ctx.clearRect(0, 0, W, H);
    var cx = W / 2, cy = H / 2;
    /* 中央太阳（大球 · 发黄光）— 恒星数据占位：本帧不承载任何数据。 */
    var sr = Math.min(W, H) * 0.13;
    var sg = ctx.createRadialGradient(cx, cy, sr * 0.2, cx, cy, sr * 3.2);
    sg.addColorStop(0, 'rgba(255,236,170,0.95)');
    sg.addColorStop(0.18, 'rgba(255,200,90,0.55)');
    sg.addColorStop(0.5, 'rgba(255,160,60,0.16)');
    sg.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    var sun = ctx.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, sr * 0.1, cx, cy, sr);
    sun.addColorStop(0, '#fffbe6'); sun.addColorStop(0.6, '#ffdf7a'); sun.addColorStop(1, '#e8a63a');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, 6.283); ctx.fill();
    /* 各星球缩球绕太阳 */
    var ps = (GAME.planetsOf && GAME.planetsOf()) || [];
    var act = (GAME.activePlanetOf && GAME.activePlanetOf()) || null;
    var orbR = Math.min(W, H) * 0.36, pr = Math.min(W, H) * 0.055;
    ui._galaxyPlanets = [];
    ps.forEach(function (p, i) {
      var ang = -Math.PI / 2 + (i / Math.max(1, ps.length)) * 6.283;
      var px = cx + Math.cos(ang) * orbR, py = cy + Math.sin(ang) * orbR;
      ui._galaxyPlanets.push({ id: p.id, x: px, y: py, r: pr });
      var on = act && p.id === act.id;
      /* 星球球体：径向渐变（亮面朝太阳）。 */
      var g = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
      g.addColorStop(0, on ? '#cfe8ff' : '#9fb6cc'); g.addColorStop(0.7, on ? '#5c86ad' : '#5a6b7c'); g.addColorStop(1, '#2a3441');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.283); ctx.fill();
      if (on) { ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(px, py, pr + 4, 0, 6.283); ctx.stroke(); }
      /* 名称 */
      try {
        ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = on ? '#ffe6a8' : '#c3d2e0';
        ctx.fillText((p.name || ('星球 ' + p.id)) + (on ? '（当前）' : ''), px, py + pr + 6);
      } catch (e) { }
    });
  };
  /* 星系点击：命中某星球 → 进入其管理界面（切到该星球 + 地图视图）。 */
  ui.galaxyClick = function (clientX, clientY) {
    var cv = document.getElementById('galaxyCanvas'); if (!cv) return false;
    var r = cv.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0 };
    var x = clientX - r.left, y = clientY - r.top;
    var hit = null;
    (ui._galaxyPlanets || []).forEach(function (pp) { if (!hit && Math.hypot(x - pp.x, y - pp.y) <= pp.r + 6) hit = pp; });
    if (!hit) return false;
    if (hit.id !== (GAME.state.activePlanet || 0) && GAME.enterPlanet) GAME.enterPlanet(hit.id);
    ui.setView('map'); GAME.refreshAll();
    return true;
  };

  /* ============================================================
   * v91.71（老板）：「先建造空间站，再建造战舰；12 种 3*4 白蓝紫红；
   *   建造/管理采用**卡牌式**；先构造船体，再升级其他部件。」——**空间站视图**。
   * ------------------------------------------------------------
   * 旧「奇观建造场」（buildHTML）退役：它是"摆块换平 buff"，不是战舰。
   * 本视图 = 空间站（等级/船坞位）+ 卡牌船坞（12 舰种）+ 选中舰详情（部件/属性）。
   * ============================================================ */
  ui._stationSel = null;   /* 选中的舰种 classId（造舰用） */
  ui._shipSel = null;      /* 选中的战舰实例 id（升级部件用） */
  /* v145（E 期 · 星际投送）：面板态 —— 选船 / 选目标星球 / 带多少人（兵走出征界面） */
  ui._ixShipId = null;
  ui._ixPid = null;
  ui._ixCols = 0;

  /* ============================================================
   * v145：**星际投送 / 殖民**面板（空间站内一块）
   * ------------------------------------------------------------
   * 老板：「主题 = 军事投送」；E 期接力卡 = 投送 + 殖民。
   * 新星球不再白送前哨城 → 这里就是**唯一的开荒入口**：
   *   选一艘母舰 → 选目标星球 → 看航程/运力/燃料 → 带人（滑块）→ 启航；
   *   抵达即把人/兵落到目标（有城入城、没城圈锚地），返航把该星物资带回。
   * 兵的编成走**出征界面**（那边有兵种面板与预备兵上限），这里给入口与在途清单。
   * 所有数字读 `GAME.colony`（唯一出口 · 唯一算法），界面不另算。
   * ============================================================ */
  ui.colonyHTML = function () {
    var CO = GAME.colony, SH = GAME.ship;
    if (!CO || !SH) return '<div class="q-empty">投送模块未加载</div>';
    var IBY = DATA.ITEM_BY_ID || {};
    var from = GAME.currentCity();
    var here = GAME.curPid ? GAME.curPid() : 1;
    var ps = (GAME.planetsOf && GAME.planetsOf()) || [];
    var ships = CO.carrierShips ? CO.carrierShips() : [];
    var fuelItem = CO.fuelItem ? CO.fuelItem() : 'w_he3';
    var fuelN = GAME.items ? GAME.items.count(fuelItem) : 0;
    var fuelName = (IBY[fuelItem] || {}).name || fuelItem;

    /* ---- 在途投送 ---- */
    var ms = CO.missions ? CO.missions() : [];
    var rows = ms.map(function (m) {
      var pl = CO.planetOf ? CO.planetOf(m.pid) : null;
      var cls = SH.classOf(m.classId) || {};
      var prog = Math.round((CO.progressOf ? CO.progressOf(m) : 0) * 100);
      var ph = (CO.phaseOf ? CO.phaseOf(m) : 'out');
      var phTxt = ph === 'out' ? '飞行中' : ph === 'survey' ? '抵达勘测中' : '返航中';
      var left = Math.max(0, Math.round(((CO.returnAtOf ? CO.returnAtOf(m) : m.arriveAt) - U.now()) / 1000));
      return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);">' +
        '<span>' + (cls.icon || '🛸') + ' ' + U.escape(cls.name || m.classId) + '</span>' +
        '<span class="ui-sub" style="flex:1;">→ ' + U.escape(pl ? pl.name : ('星球 ' + m.pid)) +
          '　·　' + U.numText(m.colonists, 0) + ' 人 · ' + U.numText(CO.armyN(m.army), 0) + ' 兵　·　' + phTxt +
          '　<b style="color:var(--gold-light);">' + prog + '%</b></span>' +
        /* v151（老板「投送落地后就地操作」）：**已经落地的**，给一个"去这颗星球办事"的入口 ——
           以前只能等它勘测完自动返航，人到了却什么都干不了。 */
        (ph !== 'out' && m._arrived
          ? '<button class="btn sm gold" data-action="ix-goto" data-pid="' + m.pid +
            '" title="切到这颗星球：锚地就地立城 / 有城就进城">去看看</button>'
          : '') +
        (ph === 'out'
          ? '<button class="btn sm" data-action="ix-cancel" data-id="' + m.id + '" title="前段飞行期内中止（人/兵原路归城，燃料不退）">中止</button>'
          : '<span class="ui-sub">' + U.dur(left) + '</span>') +
        '</div>';
    }).join('') || '<div class="ui-sub">目前在途：0 批</div>';

    /* ---- ① 选船 ---- */
    var shipCards = ships.map(function (sh) {
      var cls = SH.classOf(sh.classId) || {};
      var busy = CO.shipBusy ? CO.shipBusy(sh.id) : false;
      var on = ui._ixShipId === sh.id;
      var capN = CO.capacityOf ? CO.capacityOf(sh) : 0;
      return '<div' + (busy ? '' : ' data-action="ix-ship" data-ship="' + sh.id + '"') +
        ' style="' + (busy ? '' : 'cursor:pointer;') + 'padding:8px 10px;border:1px ' + (busy ? 'dashed' : 'solid') + ' ' + (on ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);background:' + (on ? 'rgba(var(--gold-rgb),.14)' : 'var(--bg-2)') + ';' + (busy ? 'opacity:.45;' : '') + '">' +
        '<div style="display:flex;align-items:center;gap:6px;"><span>' + (cls.icon || '🛸') + '</span><b>' + U.escape(cls.name || sh.classId) + '</b></div>' +
        '<div class="ui-sub" style="font-size:var(--fs-cap);">运力 ' + U.numText(capN, 0) + ' 人/兵' +
          (busy ? '　·　在执行投送' : '') + '</div>' +
        '</div>';
    }).join('');
    if (!ships.length) {
      shipCards = '<div class="ui-sub">船坞里还没有运输系（母舰）—— 白档「运输梭」即可开始投送' +
        '（母舰 = 突击/护卫之外的第三系，白蓝紫红各一艘）。</div>';
    }

    /* ---- ② 选目标星球 ---- */
    var selShip = null;
    ships.forEach(function (x) { if (x.id === ui._ixShipId) selShip = x; });
    var pidSel = ui._ixPid;
    var planetRows = ps.filter(function (p) { return p.id !== here; }).map(function (p) {
      var on = pidSel === p.id;
      var anc = CO.anchorOf ? CO.anchorOf(p.id) : { ok: false };
      var fsec = CO.flightSecOf ? CO.flightSecOf(p.id) : 0;
      var realSec = fsec / (GAME.timeScale ? GAME.timeScale() : 1);
      var fuel = selShip ? (CO.fuelCostOf ? CO.fuelCostOf(selShip, p.id) : 0) : 0;
      return '<div data-action="ix-planet" data-pid="' + p.id + '"' +
        ' style="cursor:pointer;padding:8px 10px;border:1px solid ' + (on ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);background:' + (on ? 'rgba(var(--gold-rgb),.14)' : 'var(--bg-2)') + ';">' +
        '<div style="display:flex;align-items:center;gap:6px;"><b>🪐 ' + U.escape(p.name) + '</b>' +
          '<span class="ui-sub">#' + p.id + (anc.ok === true ? (anc.kind === 'city' ? '　·　已有城「' + U.escape(anc.name || '') + '」' : '　·　已有锚地') : '　·　未开发（首投圈锚地）') + '</span></div>' +
        '<div class="ui-sub" style="font-size:var(--fs-cap);">单程 ' + U.dur(realSec) + '　·　燃料 ' +
          fuelName + ' ×' + U.numText(fuel, 0) + '　·　守军 ×' +
          (GAME.planetScaleOf ? GAME.planetScaleOf(p.id).toFixed(2) : '1') + '</div>' +
        '</div>';
    }).join('') || '<div class="ui-sub">只有一颗星球 —— 先到「星球生成」造一颗新的（副本列表里可进入）。</div>';

    /* ---- ③ 带人 / 带兵（兵+人同占运力） ---- */
    var cap = selShip && CO.capacityOf ? CO.capacityOf(selShip) : 0;
    var pop = from ? Math.floor(GAME.res(from).pop || 0) : 0;
    var cols = Math.min(Math.max(0, ui._ixCols || 0), pop, cap);
    /* 本城驻军 → 可选投送的兵种（每行一个数字框，先按运力封顶；超出由 canSend 拦） */
    var troops = [];
    if (from) {
      Object.keys(from.army || {}).forEach(function (k) {
        var have = Math.floor(from.army[k] || 0);
        if (have <= 0) return;
        var it = (DATA.TROOPS || {})[k] || {};
        var want = Math.max(0, Math.floor((ui._ixArmy || {})[k] || 0));
        want = Math.min(want, have);
        ui._ixArmy = ui._ixArmy || {};
        ui._ixArmy[k] = want;
        troops.push({ k: k, have: have, name: it.name || k });
      });
    }
    var armyN = CO.cargoOf ? (CO.cargoOf(ui._ixArmy || {}, 0)) : 0;
    var overCap = (cols + armyN) > cap;
    var troopsRow = '';
    if (!from) {
      troopsRow = '<div class="ui-sub">（没有出发城 —— 先到城里再投送）</div>';
    } else if (!troops.length) {
      troopsRow = '<div class="ui-sub">本城当前没有驻军（可只投人 —— 到地方再募兵）。</div>';
    } else {
      troopsRow = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">' +
        troops.map(function (t) {
          return '<label style="display:flex;align-items:center;gap:4px;padding:4px 6px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg-1);">' +
            '<span>' + U.escape(t.name) + '</span>' +
            '<input type="number" min="0" max="' + t.have + '" value="' + ((ui._ixArmy || {})[t.k] || 0) + '"' +
              ' data-action="ix-troop" data-troop="' + t.k + '"' +
              ' style="width:72px;padding:2px 4px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;" />' +
            '<span class="ui-sub">/ ' + U.numText(t.have, 0) + '</span>' +
            '</label>';
        }).join('') +
        '<span class="ui-sub" style="align-self:center;">已装 ' + U.numText(cols + armyN, 0) + ' / ' + U.numText(cap, 0) + ' 运力' +
          (overCap ? '（超载）' : '') + '</span>' +
        '</div>';
    }
    var chk = (selShip && pidSel != null && CO.canSend)
      ? CO.canSend({ shipId: selShip.id, pid: pidSel, colonists: cols, army: ui._ixArmy || {} }) : null;
    var colsRow = '';
    if (selShip && pidSel != null) {
      colsRow = '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;">' +
        '<span class="ui-sub">带人</span>' +
        '<input type="range" min="0" max="' + Math.max(0, Math.min(pop, cap)) + '" value="' + cols + '" data-action="ix-cols" style="flex:1;" />' +
        '<b style="color:var(--gold-light);min-width:70px;text-align:right;">' + U.numText(cols, 0) + ' / ' + U.numText(pop, 0) + '</b>' +
        '<span class="ui-sub">（本城幸存者）</span>' +
        '</div>';
    }

    return '<div style="margin-top:16px;padding:var(--sp-3);border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg-2);">' +
      '<div class="gold-heading" style="margin:0;">🚀 星际投送（E 期 · 殖民的唯一入口）' +
        ui.help('新星球**不再白送前哨城**：要人、要地，只能把母舰上的**人和兵**送过去。\n' +
          '· 目标有城 → 人入新城、兵并入城防，返程把该星物资带回；\n' +
          '· 目标没城 → 就地圈一处「星际锚地」，并给首批开拓物资（够立一次城）；\n' +
          '· 陆路不能跨星球：本境调运只在本星，跨星补给一律走这里。') +
      '</div>' +
      '<div class="ui-sub" style="margin:6px 0 8px;">① 选母舰（运输系）</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--sp-1);">' + shipCards + '</div>' +
      '<div class="ui-sub" style="margin:10px 0 8px;">② 选目标星球（单程按跨星距离算，比同星最远还远）</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:var(--sp-1);">' + planetRows + '</div>' +
      colsRow +
      '<div class="ui-sub" style="margin:8px 0 2px;">③ 带兵（本城驻军，可选）—— 兵与人同占运力' +
        (chk && !chk.ok ? '<br><span style="color:var(--red-light);">当前不可投送：' + U.escape(chk.msg || '') + '</span>' : '') +
      '</div>' +
      troopsRow +
      '<div style="margin-top:8px;display:flex;gap:8px;">' +
        '<button class="btn' + (chk && chk.ok && (cols > 0 || armyN > 0) ? ' gold' : ' dim') + '" data-action="ix-go"' +
          (chk && chk.ok && (cols > 0 || armyN > 0) ? '' : ' disabled') +
          (chk && !chk.ok ? ' data-why="' + U.escape(chk.msg || '') + '"' : '') + '>🚀 启航（人 ' + U.numText(cols, 0) + ' · 兵 ' + U.numText(armyN, 0) + '）</button>' +
        '<button class="btn" data-action="ix-exp">⚔️ 出征界面（编成/运货）</button>' +
        '<span class="ui-sub" style="align-self:center;">燃料：' + fuelName + ' 现有 ' + U.numText(fuelN, 0) + '</span>' +
      '</div>' +
      '<div class="ui-sub" style="margin:12px 0 4px;">在途投送</div>' +
      rows +
    '</div>';
  };

  /* 投送面板动作（单独出口，stationHTML 底部的 `+=` 调用它们） */
  ui.ixPickShip = function (shipId) {
    ui._ixShipId = (ui._ixShipId === shipId) ? null : shipId;
    GAME.refreshAll(); ui.renderView('station');
  };
  ui.ixPickPlanet = function (pid) {
    ui._ixPid = (ui._ixPid === Number(pid)) ? null : Number(pid);
    GAME.refreshAll(); ui.renderView('station');
  };
  ui.ixGo = function () {
    var CO = GAME.colony;
    if (!CO) { ui.toast('投送模块未加载'); return; }
    var r = CO.send({ shipId: ui._ixShipId, pid: ui._ixPid, colonists: ui._ixCols || 0, army: ui._ixArmy || {} });
    ui.toast(r.msg);
    if (r.ok) { ui._ixCols = 0; ui._ixArmy = {}; GAME.refreshAll(); ui.renderView('station'); }
  };
  /* 兵种数字框：只记状态 + 让「启航」按钮当场响应（不重绘，输入不丢） */
  ui.ixSetTroop = function (k, n) {
    ui._ixArmy = ui._ixArmy || {};
    ui._ixArmy[k] = Math.max(0, Math.floor(Number(n) || 0));
    ui.ixColsPreview(ui._ixCols || 0);
  };
  ui.ixCancel = function (id) {
    var r = GAME.colony ? GAME.colony.cancel(id) : { ok: false, msg: '投送模块未加载' };
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.renderView('station'); }
  };
  /* 滑块拖动：只改状态 + 让「启航」按钮当场响应（不重绘整页，拖动不断） */
  ui.ixColsPreview = function (n) {
    ui._ixCols = Math.max(0, Math.floor(Number(n) || 0));
    var root = document.getElementById('modal-root');
    var btn = null;
    (root ? root.querySelectorAll('[data-action="ix-go"]') : []).forEach(function (b) { if (!btn) btn = b; });
    if (!btn) btn = document.querySelector('[data-action="ix-go"]');
    if (!btn) return;
    var can = (ui._ixCols > 0 || ui.cargoN(ui._ixArmy)) && ui._ixShipId && ui._ixPid != null && GAME.colony
      && GAME.colony.canSend({ shipId: ui._ixShipId, pid: ui._ixPid, colonists: ui._ixCols, army: ui._ixArmy || {} }).ok;
    btn.disabled = !can;
    btn.classList.toggle('gold', !!can);
    btn.classList.toggle('dim', !can);
  };
  /* 出征界面：目标下拉里挑目标星球的城市/锚地；这里只负责把面板打开 */
  ui.ixOpenExpedition = function () {
    var CO = GAME.colony;
    var pid = ui._ixPid;
    var tg = null;
    if (CO && pid != null) {
      var anc = CO.anchorOf(pid);
      if (anc.ok) {
        tg = (anc.kind === 'city') ? { kind: 'own', id: anc.city.id }
          : { kind: 'wild', ci: anc.ci, pid: pid };
      }
    }
    ui.openExpModal(tg || { kind: 'own' },
      { hint: '星际投送：选「调运 / 运输」把兵与货送上母舰；目标星球有城则入城，没城则落在锚地。' });
  };

  /* 兵总数（投送面板：按钮文案与可用态共用） */
  ui.cargoN = function (army) {
    return GAME.colony ? GAME.colony.armyN(army) : 0;
  };

  /* ============================================================
   * v146（F 期）：**深空远征**面板（空间站内一块）
   * ------------------------------------------------------------
   * 设计提案 5-C：派舰队去深空目标 → 遭遇战 → 带回蓝图/资源（3 点 + 1 Boss）。
   * 面板只做"选舰 / 选目标 / 出港 / 召回 / 看战报"；
   * 数值与判定全读 `GAME.fleet`（唯一出口），界面不另算。
   * ============================================================ */
  ui._dsShips = {};    /* 勾选中的舰 { shipId:true } */
  ui._dsTargetId = null;

  ui.fleetHTML = function () {
    var FL = GAME.fleet, SH = GAME.ship;
    if (!FL || !SH) return '';
    var IBY = DATA.ITEM_BY_ID || {};
    var R = DATA.SHIP_ROLES || {};    /* ⚠️ 舰种系名（实机自检抓到：漏了这句 → 整页白屏） */
    var ships = SH.ships();
    var fleets = FL.fleets();
    var tgts = FL.targets();
    var sel = Object.keys(ui._dsShips || {}).filter(function (k) { return ui._dsShips[k]; });
    var tid = ui._dsTargetId || (tgts[0] && tgts[0].id);

    /* ---- 船坞：勾选编成（已被投送/舰队占用的船置灰） ---- */
    var pickRows = ships.map(function (sh) {
      var cls = SH.classOf(sh.classId) || {};
      var inFleet = FL.fleetOfShip(sh.id);
      var inColony = GAME.colony && GAME.colony.busyOf && GAME.colony.busyOf(sh.id);
      var lock = !!(inFleet || inColony);
      var on = !!ui._dsShips[sh.id] && !lock;
      return '<label style="display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid ' + (on ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);background:' + (on ? 'rgba(var(--gold-rgb),.12)' : 'var(--bg-2)') + ';' + (lock ? 'opacity:.45;' : 'cursor:pointer;') + '">' +
        '<input type="checkbox" data-action="ds-pick" data-ship="' + sh.id + '"' + (on ? ' checked' : '') + (lock ? ' disabled' : '') + ' />' +
        '<span>' + (cls.icon || '🚀') + ' ' + U.escape(cls.name || sh.classId) + '</span>' +
        '<span class="ui-sub" style="font-size:var(--fs-cap);">' + U.escape((R[cls.role] || {}).name || '') +
          '系 · 战力 ' + SH.powerOf(sh) + '</span>' +
        '<span class="ui-sub" style="font-size:var(--fs-cap);margin-left:auto;">' + (inFleet ? '在舰队' : (inColony ? '在投送' : '')) + '</span>' +
        '</label>';
    }).join('') || '<div class="ui-sub">船坞是空的 —— 先在上面造舰。</div>';

    /* ---- 目标 ---- */
    var tgtRows = tgts.map(function (t) {
      var on = tid === t.id;
      var cleared = (FL.state().cleared || {})[t.id];
      return '<div data-action="ds-target" data-id="' + t.id + '" style="cursor:pointer;padding:8px 10px;border:1px solid ' + (on ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);background:' + (on ? 'rgba(var(--gold-rgb),.14)' : 'var(--bg-2)') + ';">' +
        '<div style="display:flex;align-items:center;gap:6px;"><b>' + (t.icon || '🌌') + ' ' + U.escape(t.name) + '</b>' +
          '<span class="ui-sub">单程 ' + U.dur((t.flightSec || 0)) + (cleared ? '　·　已攻克' : '') + '</span></div>' +
        '<div class="ui-sub" style="font-size:var(--fs-cap);">敌 血 ' + U.fmt(t.hp) + ' · 盾 ' + U.fmt(t.shield)
          + ' · 攻 ' + U.fmt(t.atk) + ' · 防 ' + U.fmt(t.def) + '</div>' +
        '<div class="ui-sub" style="font-size:var(--fs-cap);opacity:.8;">' + U.escape(t.desc || '') + '</div>' +
        (t.first ? '<div style="font-size:var(--fs-cap);color:var(--gold-light);">首通：' + Object.keys(t.first.items || {}).map(function (k) { return ((IBY[k] || {}).name || k) + '×' + t.first.items[k]; }).join('、') + '</div>' : '') +
        '</div>';
    }).join('');

    /* ---- 编成 / 在途 / 战报 ---- */
    var fleetRows = fleets.map(function (f) {
      var t = FL.targetOf(f.targetId) || {};
      var txt = FL.previewText(f);
      var op = f.phase === 'ready'
        ? ('<button class="btn sm gold" data-action="ds-launch" data-id="' + f.id + '">出港</button> ' +
           '<button class="btn sm" data-action="ds-disband" data-id="' + f.id + '">解散</button>')
        : (f.phase === 'out'
          ? ('<span class="ui-sub">在途 → ' + U.escape(t.name || f.targetId) + '</span> ' +
             '<button class="btn sm" data-action="ds-cancel" data-id="' + f.id + '">召回</button>')
          : '<span class="ui-sub">返航中</span>');
      var last = (f.log || []).slice(-2).join('　');
      /* v148：阵位三个位子 —— 对口舰种才亮（没对口舰写"空"，并说明该上什么系） */
      var fm = FL.formationOf(f);
      var roleName = { escort: '护卫', assault: '突击', carrier: '母舰' };
      var slotChips = fm.used.map(function (u) {
        var on = !!u.ok;
        var label = u.name + ' · ' + (on ? U.escape(u.shipName || '') : '空');
        var tip = u.desc + (on ? '' : ('　—— 这个位子要「' + (roleName[u.role] || u.role) + '系」舰'));
        return '<span class="chip"' + (f.phase === 'ready' ? ' data-action="ds-slot" data-id="' + f.id +
          '" data-slot="' + u.slot + '"' : '') + ' style="margin-right:6px;cursor:' + (f.phase === 'ready' ? 'pointer' : 'default') +
          ';opacity:' + (on ? '1' : '.55') + ';" title="' + U.escape(tip) + '">' +
          U.escape(label) + '</span>';
      }).join(' ');
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);">' +
        '<span><b>' + U.escape(f.name) + '</b> <span class="ui-sub">' + txt + '</span></span>' +
        '<span style="margin-left:auto;">' + op + '</span>' +
        '</div>' +
        '<div style="padding:0 0 6px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' +
          '<span class="ui-sub" style="font-size:var(--fs-cap);">阵位（点一下换同系舰）</span>' + slotChips +
        '</div>' +
        (last ? '<div class="ui-sub" style="font-size:var(--fs-cap);padding:0 0 4px;">' + U.escape(last) + '</div>' : '');
    }).join('') || '<div class="ui-sub">还没有舰队。</div>';

    var hist = FL.history().slice(0, 5).map(function (h, hi) {
      /* v151：每场合战都带**逐回合**（之前只有"几回合/输赢"，等于黑箱） */
      var rows = (h.rows || []).map(function (x) {
        return '第' + x.r + '合　我打 ' + U.fmt(x.dmgToEnemy) + ' · 挨 ' + U.fmt(x.dmgToFleet)
          + '　·　敌 ' + U.fmt(Math.max(0, x.enemyHp)) + ' / 我 ' + U.fmt(Math.max(0, x.fleetHp));
      }).join('<br>');
      return '<details style="padding:2px 0;">'
        + '<summary style="cursor:pointer;">' + (h.win ? '✅ 胜' : (h.timeout ? '⏳ 未破' : '❌ 败'))
        + ' · ' + U.escape(h.targetName || h.target) + ' · ' + h.rounds + ' 回合'
        + (h.lost && h.lost.length ? (' · 折舰 ' + h.lost.join('、')) : '')
        + '　<span class="ui-sub">（点开看每合）</span></summary>'
        + '<div class="ui-sub" style="font-size:var(--fs-cap);padding:4px 0 4px 12px;line-height:1.7;">'
        + (rows || '（这一场没有逐合记录）') + '</div></details>';
    }).join('') || '<div class="ui-sub">（还没打过）</div>';

    var preview = sel.length && tid ? (function () {
      var st = FL.statsOf({ ships: sel });
      return '预演：' + sel.length + ' 艘 · 合计攻 ' + U.fmt(st.atk) + ' · 血 ' + U.fmt(st.hp)
        + ' · 盾 ' + U.fmt(st.shield) + ' · 甲 ' + U.fmt(st.armor);
    })() : '（先勾选舰、再选目标）';

    return '<div style="margin-top:16px;padding:var(--sp-3);border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg-2);">' +
      '<div class="gold-heading" style="margin:0;">🌌 深空远征（F 期 · 舰队战）' +
        ui.help('把船坞里的舰**编成舰队**（1~5 艘），派往深空目标。\n' +
          '· 出港后舰船锁定：不能拆、不能升部件、不能投送，也不能解散；\n' +
          '· 抵达即打一场**确定性回合战**（同编成同目标 → 结果可复算）；\n' +
          '· 赢了把蓝图/资源带回来；打满回合未破 = 撤回不损舰；被打沉 = 折掉最多一半（先掉僚舰）。') +
      '</div>' +
      '<div class="ui-sub" style="margin:6px 0 6px;">① 选舰（' + sel.length + ' / ' + ((GAME.DATA.DS || {}).maxShips || 5) + '）</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--sp-1);">' + pickRows + '</div>' +
      '<div class="ui-sub" style="margin:10px 0 6px;">② 选目标</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--sp-1);">' + tgtRows + '</div>' +
      '<div class="ui-sub" style="margin:8px 0 4px;">' + U.escape(preview) + '</div>' +
      '<div style="margin-top:6px;display:flex;gap:8px;">' +
        '<button class="btn' + (sel.length && tid ? ' gold' : ' dim') + '" data-action="ds-form"' + (sel.length && tid ? '' : ' disabled') + '>⚓ 编成舰队</button>' +
      '</div>' +
      '<div class="ui-sub" style="margin:12px 0 4px;">舰队</div>' + fleetRows +
      '<div class="ui-sub" style="margin:10px 0 4px;">最近战报（只留 10 场）</div>' + hist +
    '</div>';
  };

  ui.dsPick = function (shipId) {
    var FL = GAME.fleet;
    if (!FL) return;
    ui._dsShips = ui._dsShips || {};
    if (!ui._dsShips[shipId] && FL.fleetOfShip(shipId)) { ui.toast('该舰已在舰队中'); return; }
    ui._dsShips[shipId] = !ui._dsShips[shipId];
    ui.renderView('station');
  };
  ui.dsTarget = function (id) {
    ui._dsTargetId = id;
    ui.renderView('station');
  };
  ui.dsForm = function () {
    var FL = GAME.fleet;
    if (!FL) { ui.toast('舰队模块未加载'); return; }
    var ids = Object.keys(ui._dsShips || {}).filter(function (k) { return ui._dsShips[k]; });
    var r = FL.form({ shipIds: ids, targetId: ui._dsTargetId });
    ui.toast(r.msg);
    if (r.ok) { ui._dsShips = {}; GAME.refreshAll(); ui.renderView('station'); }
  };
  ui.dsLaunch = function (id) { ui.toast(GAME.fleet.launch(id).msg); GAME.refreshAll(); ui.renderView('station'); };
  /* v148：阵位轮换（点一下换同系下一艘；没有同系舰 → 提示该位该上什么） */
  ui.dsSlot = function (id, slotKey) {
    var r = GAME.fleet.cycleSlot(id, slotKey);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.renderView('station'); }
  };
  ui.dsCancel = function (id) { ui.toast(GAME.fleet.cancel(id).msg); GAME.refreshAll(); ui.renderView('station'); };
  ui.dsDisband = function (id) { ui.toast(GAME.fleet.disband(id).msg); GAME.refreshAll(); ui.renderView('station'); };

  ui.stationHTML = function () {
    var SH = GAME.ship;
    if (!SH) return '<div class="q-empty">战舰模块未加载</div>';
    var lv = SH.lv(), cap = SH.tierCapNow(), slots = SH.dockSlots();
    var ships = SH.ships();
    var IBY = DATA.ITEM_BY_ID || {};
    var T = DATA.SHIP_TIERS || [], R = DATA.SHIP_ROLES || {};
    var _bps = SH.bpStatus();
    var _bpAllN = _bps.length, _bpHaveN = _bps.filter(function (x) { return x.has; }).length;

    /* ---- 顶部：空间站状态 ---- */
    var head = '<div style="display:flex;gap:var(--sp-4);flex-wrap:wrap;align-items:center;' +
      'padding:var(--sp-2) var(--sp-3);border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg-2);">' +
      '<span style="font-weight:700;color:var(--gold-light);">🛰️ ' + U.escape(DATA.STATION.name) +
        ' Lv' + lv + '</span>' +
      '<span class="ui-sub">可造最高舰档 <b>' + (T[cap] ? T[cap].name : '白') + '</b>' +
        '　·　船坞 <b>' + ships.length + ' / ' + slots + '</b></span>' +
      '<span class="ui-sub">升级空间站可解锁更高舰档与更多船坞位</span>' +
      '<span class="ui-sub">舰船蓝图 <b>' + _bpHaveN + ' / ' + _bpAllN + '</b>（奇观探索产出 · 白常见红稀有）</span>' +
      '</div>';

    /* ---- 卡牌船坞：12 舰种 ---- */
    var cards = (DATA.SHIP_CLASSES || []).map(function (cls) {
      var tier = T[cls.tier] || T[1], role = R[cls.role] || { name: '', short: '' };
      var chk = SH.canBuild(cls.id);
      var locked = cls.tier > cap;
      var bp = SH.bpOf(cls);
      var hasBp = !bp || (GAME.items && GAME.items.has(bp, 1));
      var owned = ships.filter(function (x) { return x.classId === cls.id; }).length;
      var sel = ui._stationSel === cls.id;
      var op = (chk.ok ? '1' : '.55');
      var tip = cls.name + '（' + tier.name + '档 · ' + role.name + '）\n' + cls.desc +
        (bp ? ('\n蓝图：' + (hasBp ? '已持有' : '未获得')) : '') +
        '\n' + (chk.ok ? ('造舰消耗 ' + ((IBY[chk.mat] || {}).name || chk.mat) + ' ×' + chk.cost)
                        : ('不可建造：' + chk.msg));
      return '<div data-action="sp-pick" data-class="' + cls.id + '" title="' + U.escape(tip) + '"' +
        ' style="display:flex;flex-direction:column;gap:2px;padding:10px 12px;cursor:pointer;' +
        'border:1px solid ' + (sel ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);' +
        'background:' + (sel ? 'rgba(var(--gold-rgb),.14)' : 'var(--bg-2)') + ';opacity:' + op + ';">' +
        '<div style="display:flex;align-items:center;gap:6px;">' +
          '<span style="font-size:var(--fs-lead);">' + cls.icon + '</span>' +
          '<b style="color:' + tier.color + ';">' + U.escape(cls.name) + '</b>' +
        '</div>' +
        '<div style="font-size:var(--fs-cap);color:var(--text-dim);">' +
          tier.name + '档 · ' + role.name + (owned ? ('　×' + owned) : '') +
          (locked ? '　🔒' : '') + (bp ? (hasBp ? '　📜已持有' : '　📜缺蓝图') : '') +
        '</div>' +
        '<div style="font-size:var(--fs-cap);color:var(--text-dim);opacity:.75;">' + U.escape(cls.desc) + '</div>' +
      '</div>';
    }).join('');

    /* ---- 选中舰种 → 造舰面板 ---- */
    var sel = null;
    (DATA.SHIP_CLASSES || []).forEach(function (c) { if (c.id === ui._stationSel) sel = c; });
    var buildBox = '';
    if (sel) {
      var chk2 = SH.canBuild(sel.id);
      buildBox = '<div style="margin-top:var(--sp-3);padding:var(--sp-3);border:1px solid var(--line);' +
        'border-radius:var(--r-sm);background:var(--bg-2);">' +
        '<div style="font-weight:700;">建造 · ' + U.escape(sel.name) + '</div>' +
        '<div class="ui-sub" style="margin-top:4px;">' +
          (chk2.ok ? ('消耗 ' + ((IBY[chk2.mat] || {}).name || chk2.mat) + ' ×' + chk2.cost +
            '（持有 ' + GAME.items.count(chk2.mat) + '）')
                   : U.escape(chk2.msg)) + '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
          '<button class="btn' + (chk2.ok ? ' gold' : ' dim') + '" data-action="sp-build" data-class="' + sel.id + '"' +
            (chk2.ok ? '' : ' disabled data-why="' + U.escape(chk2.msg) + '"') + '>🛠️ 建造船体</button>' +
          '<button class="btn" data-action="sp-clear">取消</button>' +
        '</div></div>';
    }

    /* ---- 已造战舰列表 ---- */
    var shipCards = ships.map(function (ship) {
      var cls = SH.classOf(ship.classId) || {}, tier = T[ship.tier] || T[1];
      var st = SH.statsOf(ship), os = ui._shipSel === ship.id;
      return '<div data-action="sp-ship" data-ship="' + ship.id + '"' +
        ' style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-2) var(--sp-3);cursor:pointer;' +
        'border:1px solid ' + (os ? 'var(--gold)' : 'var(--line)') + ';border-radius:var(--r-sm);' +
        'background:' + (os ? 'rgba(var(--gold-rgb),.14)' : 'var(--bg-2)') + ';">' +
        '<span style="font-size:var(--fs-lead);">' + (cls.icon || '🚀') + '</span>' +
        '<span style="flex:1;min-width:0;"><b style="color:' + tier.color + ';">' + U.escape(cls.name || ship.classId) + '</b>' +
          '<i style="font-style:normal;font-size:var(--fs-cap);color:var(--text-dim);margin-left:8px;">战力 ' +
          SH.powerOf(ship) + '</i></span>' +
        '<span style="font-size:var(--fs-cap);color:var(--text-dim);">' +
          '伤' + st.atk + ' · 命' + Math.round(st.hit * 100) + '% · 血' + st.hp + ' · 盾' + st.shield + '</span>' +
        '</div>';
    }).join('') || '<div class="q-empty">船坞空空 —— 从上方选一个舰种建造。</div>';

    var selShip = null;
    ships.forEach(function (x) { if (x.id === ui._shipSel) selShip = x; });
    var detail = '';
    if (selShip) {
      var clsS = SH.classOf(selShip.classId) || {};
      var stS = SH.statsOf(selShip);
      var statRows = (DATA.SHIP_STATS || []).map(function (sdef) {
        var v = stS[sdef.k] || 0;
        return '<span style="display:inline-block;min-width:96px;font-size:var(--fs-cap);color:var(--text-dim);">' +
          sdef.name + ' <b style="color:var(--text);">' + (sdef.pct ? Math.round(v * 100) + '%' : v) + '</b></span>';
      }).join('');
      /* v144.2（C 期数值）：把"属性为什么是这个数"摊开 ——
         母港共振 / 部件协同 / 编队共鸣都走 SH.mod 管道，玩家不看见就只会觉得数字玄学。
         读 `SH.bonusListOf`（唯一出口），不在界面里另算一遍。 */
      var bonusRows = (SH.bonusListOf ? SH.bonusListOf(selShip) : []).map(function (b) {
        return '<span style="display:inline-block;padding:0 6px;margin:0 4px 2px 0;'
          + 'border:1px solid var(--wood-light);border-radius:var(--r-sm);'
          + 'font-size:var(--fs-cap);color:var(--gold-light);">'
          + U.escape(SH.bonusLabel(b.src)) + ' +' + Math.round(b.pct * 100) + '%</span>';
      }).join('') || '<span class="ui-sub">（无加成：升空间站 / 配平部件 / 凑同系编队）</span>';
      var partRows = (DATA.SHIP_PARTS || []).filter(function (p) { return p.id !== 'hull'; }).map(function (p) {
        var plv = SH.partLvOf(selShip, p.id), mx = p.max || 10;
        var chkP = SH.canUpgrade(selShip.id, p.id);
        var matName = ((IBY[p.mat] || {}).name) || p.mat;
        return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);">' +
          '<span style="width:92px;">' + p.icon + ' ' + U.escape(p.name) + '</span>' +
          '<span style="width:64px;color:var(--gold);">Lv' + plv + ' / ' + mx + '</span>' +
          '<span style="flex:1;font-size:var(--fs-cap);color:var(--text-dim);">' + U.escape(p.desc) + '</span>' +
          '<button class="btn sm' + (chkP.ok ? ' gold' : ' dim') + '" data-action="sp-part" data-part="' + p.id + '"' +
            (chkP.ok ? '' : ' disabled data-why="' + U.escape(chkP.msg) + '"') +
            ' title="' + U.escape(chkP.ok ? (matName + ' ×' + chkP.cost) : chkP.msg) + '">升级</button>' +
          '</div>';
      }).join('');
      detail = '<div style="margin-top:var(--sp-3);padding:var(--sp-3);border:1px solid var(--line);' +
        'border-radius:var(--r-sm);background:var(--bg-2);">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<span style="font-size:var(--fs-lead);">' + (clsS.icon || '🚀') + '</span>' +
          '<b>' + U.escape(clsS.name || '') + '</b>' +
          '<span class="ui-sub">战力 ' + SH.powerOf(selShip) + '</span>' +
          '<button class="btn sm" data-action="sp-scrap" data-ship="' + selShip.id + '" style="margin-left:auto;">♻️ 拆解</button>' +
        '</div>' +
        '<div style="margin:8px 0;display:flex;flex-wrap:wrap;gap:2px 6px;">' + statRows + '</div>' +
        '<div style="margin:0 0 6px;display:flex;flex-wrap:wrap;gap:2px 4px;">' + bonusRows + '</div>' +
        '<div class="ui-sub" style="margin-bottom:4px;">部件（先造好船体，再逐级升级）</div>' +
        partRows +
        '</div>';
    }

    return '<div class="ui-page">' +
      '<div class="gold-heading">🛰️ 空间站 · 星际战舰' +
        ui.help('先在空间站**建造船体**（消耗奇观材料），再逐级**升级部件**提升属性。\n' +
          '舰种按 **白 / 蓝 / 紫 / 红** 四档解锁：升级空间站可解锁更高档与更多船坞位。\n' +
          '蓝图由**奇观探索**产出（白档起步，紫红档稀有）。') +
      '</div>' +
      head +
      '<div class="ui-sub" style="margin:10px 0 6px;">船坞 · 舰种</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:var(--sp-2);">' + cards + '</div>' +
      buildBox +
      '<div class="ui-sub" style="margin:16px 0 6px;">已造战舰（' + ships.length + ' / ' + slots + '）</div>' +
      '<div style="display:flex;flex-direction:column;gap:var(--sp-1);">' + shipCards + '</div>' +
      detail +
      ui.colonyHTML() +
      ui.fleetHTML() +
    '</div>';
  };
  /* 旧建造场：保留函数名以免外部引用断裂，但**视图已改走 station**。 */
  ui.buildHTML = ui.stationHTML;

  /* ============================================================
   * v147（D 期「建造时的 3D 预览」）
   * ------------------------------------------------------------
   * 建造前/升级前进 3D 看一眼它建成后的样子：**不占格、不扣费**。
   * 有 WebGL → `GAME.scene3d.openBuildPreview` 走 v140 那套正交场景；
   * 没有 WebGL（老设备/门禁环境）→ 静态兜底图（CSS 画的一块示意图），
   * 保证"按钮按下去一定有反应"，不会点了没动。
   * ============================================================ */
  ui.openBuildPreview = function (bid, lvl, cityId) {
    var B = (DATA.BUILDINGS || {})[bid];
    if (!B) { ui.toast('没有这个建筑'); return; }
    var L = Math.max(1, Math.min(DATA.MAX_BLEVEL || 24, (lvl | 0) || 1));
    var ok = null;
    try {
      if (typeof THREE !== 'undefined' && GAME.scene3d && GAME.scene3d.openBuildPreview) {
        ok = GAME.scene3d.openBuildPreview(bid, L, cityId);
      }
    } catch (e) { ok = null; }
    if (ok && ok.ok) return ok;
    /* 无 WebGL 兜底：一块静态示意图（颜色/层数照原建筑的分类口径） */
    var cat = (B.mil ? 'mil' : (/minfang|juzhu/.test(bid) ? 'live'
      : (/nongtian|linchang|caikuang|shuijing/.test(bid) ? 'prod'
        : (/tiejiang|gongjiang|zuofang|shuyuan|keyan/.test(bid) ? 'craft'
          : (B.cat === 'gov' ? 'gov' : 'other')))));
    var col = { gov: '#cbb282', prod: '#b08b4e', mil: '#7d8790', live: '#d2bb95', craft: '#b4643a', other: '#9a9384' }[cat] || '#9a9384';
    var hh = 40 + L * 10;
    ui.openModal(
      '<div class="gold-heading">🔍 建造预览 · ' + U.escape(B.name) + ' Lv' + L + '</div>' +
      '<div style="display:flex;justify-content:center;align-items:flex-end;height:220px;'
        + 'background:linear-gradient(#9db0bd,#6f6553);border:1px solid var(--line);border-radius:var(--r-sm);">'
        + '<div style="width:120px;height:' + hh + 'px;background:' + col + ';'
        + 'box-shadow:0 0 0 4px rgba(0,0,0,.18);position:relative;">'
        + '<div style="position:absolute;left:50%;bottom:-18px;transform:translateX(-50%);'
        + 'width:0;height:0;border-left:66px solid transparent;border-right:66px solid transparent;'
        + 'border-bottom:26px solid ' + col + ';"></div></div></div>' +
      '<div class="ui-sub" style="margin-top:8px;">这台设备没有 WebGL —— 用示意图代替 3D 预览。'
        + '（预览不占格、不扣费；真正建造仍走原来的面板。）</div>',
      'sm'
    );
    return { ok: true, fallback: true };
  };

  ui.stationPick = function (classId) {
    ui._stationSel = (ui._stationSel === classId) ? null : classId;
    ui.renderView('station');
  };
  ui.shipPick = function (shipId) {
    ui._shipSel = (ui._shipSel === shipId) ? null : shipId;
    ui.renderView('station');
  };
  ui.stationBuild = function (classId) {
    var r = GAME.ship.build(classId);
    ui.toast(r.msg);
    if (r.ok) { ui._stationSel = null; ui._shipSel = r.ship && r.ship.id; }
    GAME.refreshAll(); ui.renderView('station');
  };
  ui.stationUpgradePart = function (pid) {
    if (!ui._shipSel) { ui.toast('先选一艘战舰'); return; }
    var r = GAME.ship.upgradePart(ui._shipSel, pid);
    ui.toast(r.msg); GAME.refreshAll(); ui.renderView('station');
  };
  ui.stationScrap = function (shipId) {
    var r = GAME.ship.scrap(shipId);
    ui.toast(r.msg);
    if (r.ok && ui._shipSel === shipId) ui._shipSel = null;
    GAME.refreshAll(); ui.renderView('station');
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
    /* v24（需求 1/2/3）：地图页只留**棋盘**，其余一律清掉 ——
       原先顶部有「🗺️ 天下大势 · 观察框 12×12 格 · 全图 500×500 · 109 座名城」、
       底部有 9 项地形图例、末尾还有一行操作提示：三段都是备注型文字，
       既占掉小半屏、又把棋盘挤小，读起来还比棋盘本身更抢眼。
       方向键与坐标框改到**右下角**一枚浮标内，不再横占一整行。
       v44（老板要求）：浮标内部**压成一行** —— 原来「方向键 3×2 网格 ＋ 坐标竖排两行」
       共占三行高度。现在：方向键横排 ← ▲ ▼ → ｜ 视野区间 ｜ 点选坐标 ｜ 坐标输入 + 前往/回主城/灰烬城，
       全部同一行，上下不再占空间。 */
    /* v76（老板）：「底下有一个导航栏，可以考虑把地图的导航栏（上下左右，坐标之类）
       放到这个导航范围内」—— 导航不再挂地图页浮标，改登记到本帧的**底部固定导航条**
       （ui._bottom → paintBottom）；地图页本身只剩棋盘。 */
    /* v90.88（老板）：**去掉上下左右**方向键 + 平面 (x,y) 双输入框，改为经纬度输入 + 前往。
       ⛔ v156.35：那套经纬度输入也退役了（见下方 dock 里的长注释）——
       底栏现在只剩"回主城 / 回本城 / 星系 / 前哨 / 建造 / 灰烬城"。 */
    /* v90.99（老板）：地图在看别颗星球时，基于「当前城」的导航（回主城/回本城）与母星专属的
       「灰烬城」**断开** —— 挂 .dim + data-why（点击弹原因，走全局受阻机制），比"点了没反应"直观。 */
    var _isBuild = !!(GAME.map3d && GAME.map3d.mode === 'build');
    /* ⛔ v158.20（老板「去掉人物模式 · 只提示人物位置」）：原 v158.8 的「🧍 人物」按钮整条退役。
       "人物视角"不该是玩家手动切的一个模式 —— 现在地图上一直有小人（位置提示），
       点哪它就真的走到哪（map3d.walkTo / stepWalkTo），走过去的同时面板照常打开。
       不再有"进入/退出人物视角"这个动作。 */
    var _onAct99 = ui.mapOnActivePlanet();
    var _cap99 = ui.mapOnActivePlanet(1);
    function _nav99(cls, act, label, on, why) {
      return '<button class="btn sm' + cls + (on ? '' : ' dim') + '" data-action="' + act + '"'
        + (on ? '' : ' data-why="' + why + '"') + '>' + label + '</button>';
    }
    ui._bottom.push('<div class="map-dock">' +
        /* ⛔ v156.37（老板 2026-11-02「去掉地图上这些无用：点选 — / 球系坐标 / 经度 / °E / 纬度 / °N / 前往」）
           底栏的**信息区整块**退役：`中心 244°E 17°N`（视野中心坐标）+ `点选 —`（点选格坐标）。
           加上上一轮已删的坐标输入组，底栏现在只剩**动作**，没有一个字是"读数"。
           为什么读数也该走：地图是 3D 球，玩家看的是地形和城，不是经纬；
           真要坐标，点开地块面板里有（`📍 球系坐标`，那是"点了才有"，不是常驻）。
           连带退役：ui.mapInfoText / ui.mapPickText / ui.syncMapInfo / ui.mapPick（唯一读者是它俩）。 */
        '<span class="mk-sep"></span>' +
        /* ⛔ v156.35（老板 2026-11-02「这个已无用，删去：球系坐标 / 经度 / °E / 纬度 / °N / 前往」）
           球系坐标输入组整条退役 —— 「球系坐标」标签 + 经度框 + °E + 纬度框 + °N + 前往按钮。
           老板的导航方式已经是"点地图格 / 星系总览"，手输经纬度这一路没人用，
           却常驻占掉底栏近 300px，把「回主城 / 回本城 / 星系 / 前哨 / 建造」挤到右边。
           连带退役：ui.mapGoto（唯一读者是「前往」按钮）、main.js 的 case 'map-goto'。
           ⚠️ 只删界面入口，**不删能力**：GAME.sphere.xyOfLonLat / lonLatOfXY 仍在
              （prologue / state / surge 还在用），地图左上角那条「球系坐标 12°E 34°N」
              也不动 —— 那是坐标的"读数"，删的是"输入"。 */
        _nav99('', 'map-center', '回主城', _onAct99, '地图在看别颗星球 —— 回主城需先切回本城所在星球') +
        _nav99('', 'map-mycity', '回本城', _onAct99, '本城不在当前地图星球上 —— 回本城需先切回本城所在星球') +
        '<button class="btn sm" data-action="galaxy-open" title="星系总览（太阳 + 各星球绕行 · 点星球进入）">🌌 星系</button>' +
        '<button class="btn sm" data-action="open-outposts">🚩 前哨</button>' +
        /* ============================================================
         * v157v（老板：「下方的"建造"按钮改为建造模式、战略模式切换按钮」）
         * ------------------------------------------------------------
         * 原来它是"打开放置面板"；现在改成**模式开关**：
         * 战略模式 = 大地图（六边形：领地/迷雾/城市/行军）；
         * 建造模式 = 落地施工（只认四边形格，底部出物品/工具/背包栏）。
         * 放置面板的入口移进建造栏里，不再占底栏。
         * ============================================================ */
        '<button class="btn sm' + (_isBuild ? ' gold' : '') + '" data-action="mode-toggle" title="' +
          (_isBuild ? '回到战略模式（大地图：领地 · 迷雾 · 城市）' : '进入建造模式（四边形建造格 · 物品 / 工具 / 背包）') + '">' +
          (_isBuild ? '🌐 战略' : '🧱 建造') + '</button>' +
        /* ⛔ v158.20：「🧍 人物」模式按钮已退役 —— 见上方墓碑注释（改为点地图行走）。 */
        /* v156.52（老板「提供一个正位按钮（把球体摆正）」）——放在动作区，和回主城/星系同排。
           摆正 = 南北轴竖直 + 视角回初始方位 + 清掉自由视线偏移。 */
        '<button class="btn sm" data-action="map-reset" title="把球体摆正：南北轴竖直、视角复位">◎ 正位</button>' +
        /* v157e（老板：「出一个按钮"自转"，点击开启或关闭自转」）——
           默认开启（缓慢自转是这张地图的基础观感），点一下停，再点一下转。
           落地后星球本来就不转（人站在地上转起来会晕），按钮仍可点，只是没视觉变化。 */
        '<button class="btn sm' + (GAME.map3d && GAME.map3d.spinOn ? ' gold' : '') + '" data-action="map-spin" title="' +
          (GAME.map3d && GAME.map3d.spinOn ? '关闭星球自转' : '开启星球自转') + '">' +
          (GAME.map3d && GAME.map3d.spinOn ? '⏸ 停转' : '🌏 自转') + '</button>' +
        (ui._placeItem ? '<button class="btn sm warn" data-action="place-cancel" title="放下手上的东西">✋ 收工</button>' : '') +
        _nav99('', 'map-capital', '灰烬城', _cap99, '灰烬城在母星 —— 当前地图非母星，不可定位') +
      '</div>');
    return '<div class="map-wrap">' +
      '<canvas id="mapCanvas"></canvas>' +
      /* v157v：**建造模式的操作栏**（老板：「在地图内底部…形成一个物品，工具，背包等选项栏」）
         只在建造模式显示；布局贴在画布下沿，不挤压画布。 */
      '<div id="build-bar" class="build-bar"' + (_isBuild ? '' : ' hidden') + '>' +
        '<div class="bb-tabs">' +
          '<button class="bb-tab on" data-action="bb-tab" data-bbtab="item">🎒 物品</button>' +
          '<button class="bb-tab" data-action="bb-tab" data-bbtab="plant">建筑</button>' +
          '<button class="bb-tab" data-action="bb-tab" data-bbtab="tool">🔨 工具</button>' +
          '<button class="bb-tab" data-action="bb-tab" data-bbtab="bag">📦 背包</button>' +
          '<span class="bb-hint" id="bb-hint">按住左键连铺 · 右键放下</span>' +
        '</div>' +
        '<div class="bb-slots" id="bb-slots">' +
          (function () {
            var h = '';
            for (var i = 0; i < 8; i++) h += '<button class="bb-slot" data-action="bb-slot" data-idx="' + i + '"><i>' + (i + 1) + '</i></button>';
            return h;
          })() +
        '</div>' +
      '</div>' +
      /* v91.30：**雷霆大箭头** —— 屏幕内指向今日奇观。
         v91.73（老板「奇观的闪电改成不可点击选择的，老是被选中」）：
         它只是**指路标记**，不再带动作；且 pointer-events/user-select 全关，
         拖动/框选时不会被点中或选中（奇观本体在 3D 场景里仍可点击打开）。 */
      '<div id="wonder-arrow" class="wonder-arrow" aria-hidden="true"' +
        ' style="display:none;pointer-events:none;user-select:none;">⚡</div>' +
      /* v90.85（老板）：「星球切换读条屏」—— 切星球时盖一层进度条，让玩家**确认切换成功**。 */
      '<div id="planet-loading" class="planet-loading"><div class="pl-inner">' +
        '<div class="pl-title">🪐 正在进入星球…</div>' +
        '<div class="pl-name" id="pl-name"></div>' +
        '<div class="pl-bar"><i id="pl-fill"></i></div>' +
        '<div class="pl-pct" id="pl-pct">0%</div>' +
      '</div></div>' +
      /* v90.64（老板）：右上角**分级行政检索** —— 全球→省→市→区；选省/市显示下一级边界+首府+名称 */
      /* v90.68（老板）：加「己方城市 / 己方野地」检索（选中 → 光束定位）；并加**收纳按钮**：
         静止 10 秒后把这一排筛选收进侧边（只留一个按钮），点按钮再展开。 */
      '<div id="adm-search" class="adm-search open">' +
        '<button class="adm-toggle" id="adm-toggle" title="检索栏：展开 / 收起">🔍</button>' +
        '<div class="adm-fields">' +
          '<select id="adm-planet"><option value="0">全球 · 星球 1</option></select>' +
          '<select id="adm-prov"></select>' +
          '<select id="adm-market"></select>' +
          '<select id="adm-district"></select>' +
          /* v90.66（老板 0a）：**地形检索** —— 选中某地形，全星该地形高亮。 */
          '<select id="adm-terrain" title="地形高亮：选中一类地形，全星该地形地块高亮">' +
            '<option value="">地形高亮…</option>' +
            '<option value="hill">山地</option><option value="forest">森林</option>' +
            '<option value="plain">平地</option><option value="caoyuan">草原</option>' +
            '<option value="desert">荒漠</option><option value="zhaoze">沼泽</option>' +
            '<option value="lake">湖泊/海</option>' +
          '</select>' +
          /* v90.68：己方城市 / 己方野地 —— 选中即射出一道提示光束并定位。 */
          '<select id="adm-owncity" title="定位己方城市：选中一座，射出光束提示并定位"></select>' +
          '<select id="adm-ownwild" title="定位己方野地：选中一处，射出光束提示并定位"></select>' +
        '</div>' +
      '</div>' +
      '</div>';
  };
  /* 分级行政检索（级联）：全球 → 省 → 市 → 区；选中即高亮 + 显示下一级边界/首府/名称 */
  /* ============================================================
   * v157.15：建造栏的**页签内容**（工具页签 = 整平工具组）
   * ------------------------------------------------------------
   * 只重写 #bb-slots 这一块 —— 不能整体重绘 map-wrap（会把 canvas 一起重建，
   * 3D 场景整个丢掉）。页签切换时由 main.js 的 case 'bb-tab' 调这里。
   * ============================================================ */
  ui.renderBuildBar = function (tab) {
    var host = (document.getElementById && document.getElementById('bb-slots'));
    if (!host) return;
    var M = GAME.map3d || {};
    if (tab === 'tool') {
      var lv = (M.TERRACE_TARGET == null) ? 8 : M.TERRACE_TARGET;
      var onT = (M.TOOL === 'terrace');
      var _bsz = (M.terraceBrushSize ? M.terraceBrushSize() : 1);
      host.innerHTML =
        '<button class="bb-slot' + (onT ? ' on' : '') + '" data-action="tool-pick" data-tool="terrace"' +
          ' title="整平：把地面削平/填平成平台，按住左键在地面拖动">⛰<i>整平</i></button>' +
        '<button class="bb-slot" data-action="terrace-brush" title="笔刷大小（点一下切换 1 / 7 / 19 格）">◍<i>'
          + _bsz + '格</i></button>' +
        '<button class="bb-slot" data-action="terrace-lv" data-d="-1" title="目标层 −1（每层 1 米）">−<i>降</i></button>' +
        '<button class="bb-slot lv" data-action="terrace-none" title="当前目标层：地面会被削/填到这一层">' + lv + '<i>层</i></button>' +
        '<button class="bb-slot" data-action="terrace-lv" data-d="1" title="目标层 +1（每层 1 米）">＋<i>升</i></button>' +
        '<button class="bb-slot" data-action="terrace-clear" title="复原：把走过的格恢复成自然地形">↩<i>复原</i></button>';
    } else if (tab === 'plant') {
      /* v158.43（老板「把可建造的 4 个资源建筑在这里提供选项」）：
         4 座资源建筑分开提供（净化厂/水培温室/发电站/电弧熔炉），
         另给一枚「智能」通用工具（按资源类型自动匹配，懒人一键）。
         打通勘探 → 建造 → 生产 → 资源值全链路。 */
      var onP = !!ui._plantTool;
      var _pidHold = ui._plantId || '';
      var _EBS = DATA.EXT_BUILDINGS || {};
      var _EBOrd = DATA.EXT_BUILD_ORDER || ['farm', 'forest', 'quarry', 'mine'];
      var hP = '';
      /* 智能匹配（不指定建筑，按资源类型反查） */
      hP += '<button class="bb-slot' + (onP && !_pidHold ? ' on' : '') + '" data-action="plant-pick" data-plant=""'
        + ' title="点资源地自动配对应采集场（不指定种类）">⚒<i>智能</i></button>';
      for (var _pk = 0; _pk < _EBOrd.length; _pk++) {
        var _eb = _EBS[_EBOrd[_pk]];
        if (!_eb) continue;
        var _onB = (onP && _pidHold === _eb.id);
        hP += '<button class="bb-slot' + (_onB ? ' on' : '') + '" data-action="plant-pick" data-plant="' + U.escape(_eb.id) + '"'
          + ' title="' + U.escape(_eb.name + '：' + _eb.desc + '（' + (DATA.RESOURCES || []).filter(function (r) { return r.key === _eb.res; }).map(function (r) { return r.name; })[0] + '）') + '">'
          + (_eb.icon || '▪') + '<i>' + U.escape(_eb.name) + '</i></button>';
      }
      if (onP) hP += '<button class="bb-slot warn" data-action="place-cancel" title="放下手上的建筑">收工<i>放下</i></button>';
      host.innerHTML = hP;
    } else if (tab === 'item') {
      /* ============================================================
       * v157.18：物品页签接上**已有的**放置目录（GAME.place）
       * ------------------------------------------------------------
       * 放置引擎（placement.js）早就建好了，但入口一直挂在旧的地块面板上，
       * 建造栏这 8 个槽是空的 —— 等于"引擎有了没方向盘"。
       * 这里把前 7 件直接做成槽位，第 8 槽给"更多"（完整面板：全部物品 + 已放置清单）。
       * 图标：目录里没有 emoji 字段，用一张小映射表兜底（没登记的就用方块符号）。
       * ============================================================ */
      var PLb = GAME.place;
      var list = (PLb && PLb.list) ? PLb.list() : [];
      var curP = ui._placeItem || null;
      var ICON = {
        tree: '🌳', bush: '🌿', pond: '🐟', fence: '🪵', hut: '🏠',
        cairn: '🪨', totem: '🗿', watchtower: '🗼', banner: '🚩', brazier: '🔥',
        crate: '📦', palisade: '🧱', shrine: '⛩', pontoon: '🛶', boat: '⛵', pier: '🌉'
      };
      var h2 = '';
      for (var k2 = 0; k2 < 7 && k2 < list.length; k2++) {
        var it2 = list[k2];
        var on2 = (curP === it2.id);
        h2 += '<button class="bb-slot' + (on2 ? ' on' : '') + '" data-action="place-pick" data-item="' + U.escape(it2.id) + '"'
          + ' title="' + U.escape(it2.name + '：' + (it2.desc || '')) + '">'
          + (ICON[it2.id] || '▪') + '<i>' + U.escape(it2.name) + '</i></button>';
      }
      h2 += '<button class="bb-slot" data-action="place-open" title="全部物品 + 已放置清单">⋯<i>更多</i></button>';
      /* 手上有东西时给一个"收工" —— 成熟建造游戏都有一键放下的出口，
         不能只靠"再点一次同一件"（玩家记不住）。 */
      if (curP || ui._plantTool) {
        h2 += '<button class="bb-slot" data-action="place-rot-hand" title="旋转 45°（快捷键 R）">↻<i>转'
          + (M.PLACE_YAW ? (' ' + M.PLACE_YAW + '°') : '') + '</i></button>';
        h2 += '<button class="bb-slot warn" data-action="place-cancel" title="放下手上的东西">✋<i>收工</i></button>';
      }
      host.innerHTML = h2;
    } else {
      var h = '';
      for (var i = 0; i < 8; i++) h += '<button class="bb-slot" data-action="bb-slot" data-idx="' + i + '"><i>' + (i + 1) + '</i></button>';
      host.innerHTML = h;
    }
  };

  ui.fillAdmSearch = function () {
    /* v90.99：行政检索读的是**地图星球的行政表**（`_settle`，genSettlements 生成）——
       切星球后须**先重绘地图**（重建该星球的 _settle.package table）再读，否则拿到上一颗星球的省市。 */
    if (GAME.map3d && GAME.map3d.enabled && GAME.map3d.render) {
      var _cv = (document.getElementById && document.getElementById('mapCanvas'));
      if (_cv && _cv.width) { try { GAME.map3d.render(_cv); } catch (e) { } }
    }
    var T = GAME.map3d && GAME.map3d._settle && GAME.map3d._settle.table;
    var g = function (id) { return document.getElementById && document.getElementById(id); };
    var provEl = g('adm-prov'), mktEl = g('adm-market'), distEl = g('adm-district'), plEl = g('adm-planet');
    /* v90.80（老板 2）：**星球副本**下拉 —— 分类菜单须先于行政检索填充（T 依赖当前星球）。 */
    if (plEl) {
      var _planets = GAME.planetsOf ? GAME.planetsOf() : [];
      /* v90.97（双球面）：下拉反映的是**地图在看/渲染的星球**（mapPlanet），非当前城所在星球。 */
      var _mp = GAME.mapPlanetOf ? GAME.mapPlanetOf() : null;
      if (plEl.getAttribute('data-n') !== String(_planets.length) + ':' + (_mp ? _mp.id : -1)) {
        plEl.setAttribute('data-n', String(_planets.length) + ':' + (_mp ? _mp.id : -1));
        plEl.innerHTML = '<option value="-1">全球 · 星球…</option>' + _planets.map(function (p) {
          return '<option value="' + p.id + '"' + (_mp && p.id === _mp.id ? ' selected' : '') + '>🪐 ' + U.escape(p.name) + '</option>';
        }).join('');
      }
    }
    if (!provEl || !T) return;
    var st = ui._adm = ui._adm || { prov: -1, market: -1, district: -1 };
    if (st.prov >= T.prov.length) st = ui._adm = { prov: -1, market: -1, district: -1 };
    /* 省 */
    var po = ['<option value="-1">选择行省…</option>'];
    T.prov.forEach(function (pv, i) { po.push('<option value="' + i + '"' + (i === st.prov ? ' selected' : '') + '>省 · ' + U.escape(pv.name) + '</option>'); });
    provEl.innerHTML = po.join('');
    /* 市（随省）*/
    var mo = ['<option value="-1">选择市…</option>'];
    if (st.prov >= 0) T.prov[st.prov].markets.forEach(function (mi) { mo.push('<option value="' + mi + '"' + (mi === st.market ? ' selected' : '') + '>市 · ' + U.escape(T.market[mi].name) + '</option>'); });
    mktEl.innerHTML = mo.join('');
    /* 区（随市）*/
    var dlist = ['<option value="-1">选择区…</option>'];
    if (st.market >= 0) T.market[st.market].districts.forEach(function (di) { dlist.push('<option value="' + di + '"' + (di === st.district ? ' selected' : '') + '>区 · ' + U.escape(T.district[di].name) + '</option>'); });
    distEl.innerHTML = dlist.join('');
    /* v90.68：己方城市 / 己方野地 选项（不每帧重建 —— 只在选项为空或数量变化时填）。 */
    var cityEl = g('adm-owncity'), wildEl = g('adm-ownwild');
    var _cities = (GAME.state.cities || []), _wilds = (GAME.state.wilds || []);
    if (cityEl && cityEl.getAttribute('data-n') !== String(_cities.length)) {
      cityEl.setAttribute('data-n', String(_cities.length));
      cityEl.innerHTML = '<option value="">定位己方城市…</option>' + _cities.map(function (c) {
        return '<option value="' + c.x + ',' + c.y + '">' + U.escape(c.name) + '（' + GAME.coordText(c) + '）</option>';
      }).join('');
    }
    if (wildEl && wildEl.getAttribute('data-n') !== String(_wilds.length)) {
      wildEl.setAttribute('data-n', String(_wilds.length));
      wildEl.innerHTML = '<option value="">定位己方野地…</option>' + _wilds.map(function (w, i) {
        var nm = (GAME.qNameOf ? GAME.qNameOf({ x: w.x, y: w.y }) : '') || (GAME.map.terrainName ? GAME.map.terrainName(w.type) : '野地');
        return '<option value="' + w.x + ',' + w.y + '">' + U.escape(nm || ('野地' + (i + 1))) + ' Lv' + (w.level || 0) + '（' + GAME.map.coordText(w.x, w.y) + '）</option>';
      }).join('');
    }

    function apply() {
      if (st.district >= 0) GAME.map3d.setHighlight({ level: 'district', index: st.district });
      else if (st.market >= 0) GAME.map3d.setHighlight({ level: 'market', index: st.market });
      else if (st.prov >= 0) GAME.map3d.setHighlight({ level: 'prov', index: st.prov });
      else GAME.map3d.setHighlight(null);
    }
    /* v90.68：绑定**挂在当前检索栏元素上**（每次进地图 mapHTML 会重建 → 重绑），
       而不是全局一次性标记（那样重进地图后计时器指向已卸载的旧元素）。 */
    var box = g('adm-search');
    if (box && !box._admBound) {
      box._admBound = true;
      var _box = box;                                          /* 捕获当前元素 */
      plEl && plEl.addEventListener('change', function () {
        var pid = Number(plEl.value);
        if (pid < 0) return;                                     /* "全球 · 星球…" 占位项不切 */
        if (GAME.map3d && GAME.map3d.setHighlight) GAME.map3d.setHighlight(null);
        ui._adm = { prov: -1, market: -1, district: -1 };
        /* v90.97（双球面）：**只切地图球面**（mapPlanet）—— 不碰当前城/activePlanet，
           城市界面保持；地图重绘为新星球。 */
        GAME.setMapPlanet(pid);
        GAME.refreshAll(); ui.fillAdmSearch(); ui.renderMapCanvas();
        var pl = GAME.mapPlanetOf ? GAME.mapPlanetOf() : null;
        ui.toast('🪐 地图视角：' + (pl ? pl.name : '星球') + '（城市不变）');
      });
      provEl.addEventListener('change', function () { st.prov = +provEl.value; st.market = -1; st.district = -1; ui.fillAdmSearch(); apply(); });
      mktEl.addEventListener('change', function () { st.market = +mktEl.value; st.district = -1; ui.fillAdmSearch(); apply(); });
      distEl.addEventListener('change', function () { st.district = +distEl.value; apply(); });
      /* v90.66（老板 0a）：地形高亮下拉（与行政检索并列，各自独立操作）。 */
      var terEl = g('adm-terrain');
      terEl && terEl.addEventListener('change', function () {
        if (GAME.map3d.setTerrainHighlight) GAME.map3d.setTerrainHighlight(terEl.value || null);
      });
      /* v90.68：己方城市 / 己方野地 —— 选中即光束定位。 */
      var ocEl = g('adm-owncity'), owEl = g('adm-ownwild');
      function _beam(v) { if (!v) { GAME.map3d.beamTo(null); return; } var p = v.split(','); GAME.map3d.beamTo(+p[0], +p[1]); }
      ocEl && ocEl.addEventListener('change', function () { _beam(ocEl.value); });
      owEl && owEl.addEventListener('change', function () { _beam(owEl.value); });
      /* v90.68：收纳按钮 —— 静止 10 秒（无任何下拉操作）自动收进侧边；点按钮展开/收起。 */
      var tog = g('adm-toggle');
      ui._admIdle = function () {                              /* 触碰筛选栏 → 展开并重置 10s 计时 */
        if (_box) _box.classList.add('open');
        if (ui._admIdleT) { clearTimeout(ui._admIdleT); ui._admIdleT = null; }
        ui._admIdleT = setTimeout(function () { if (_box) _box.classList.remove('open'); }, 10000);
      };
      tog && tog.addEventListener('click', function (e) {
        e.stopPropagation();
        if (_box.classList.contains('open')) {                 /* 收起（清计时） */
          _box.classList.remove('open');
          if (ui._admIdleT) { clearTimeout(ui._admIdleT); ui._admIdleT = null; }
        } else { ui._admIdle(); }                              /* 展开（重置 10s 计时） */
      });
      _box.addEventListener('change', ui._admIdle);            /* 操作任一筛选 → 重置计时 */
    }
    if (ui._admIdle) ui._admIdle();                            /* 起一次 10s 计时（静止即收起） */
  };

  /* ⛔ v90.77（老板）：「地图不再保留天下大势，因为已经可以实现手动缩小和检索了，
     导航栏右下角的天下大势缩略图及相关可以去掉」——底部条缩略图（.bb-mini + #mini-canvas）
     与「天下大势」面板（openMinimap / 满界面下钻 / 点选跳转 / 波纹层 / 大图 LOD）整簇退役。
     地图检索（省/市/区 + 己方城/野地光束定位）与 3D 自由缩放已覆盖该能力。 */

  /* ⛔ v156.37（老板「去掉地图上这些无用：点选 — …」）：
     `ui.mapPick` / `ui.mapPickText` 整条退役 —— 它们是底栏那句「点选 —」的唯一来源。
     点选仍然有效（点格子会弹地块面板），只是不再在底栏常驻一行字。
     沿革：v44 用它做"点到了什么"的即时反馈；v90.100 改成球系坐标显示；
     v89.5 还给它加了"荒野事 ×N"后缀 —— 那份信息现在只在**点开面板后**给。 */
  /* ⛔ v156.37：`ui.syncMapInfo`（刷新底栏那两行读数）随信息区一起退役。
     它原先在平移 / 跳转 / 点选后各调一次，现在底栏没有可刷的读数了。 */

  /* 雷霆箭头：把今日奇观的球面位置投影到屏幕 → 定位大片箭头（外向/边缘夹取）。 */
  ui.syncWonderArrow = function (canvas) {
    var el = document.getElementById('wonder-arrow'); if (!el) return;
    var pid = (GAME.state && GAME.state.mapPlanetId != null) ? GAME.state.mapPlanetId : (GAME.state && GAME.state.activePlanet);
    var wd = GAME.wonderOf ? GAME.wonderOf(pid) : null;
    if (!wd || !(GAME.map3d && GAME.map3d.wonderScreen)) { el.style.display = 'none'; return; }
    var sc = GAME.map3d.wonderScreen();
    if (!sc) { el.style.display = 'none'; return; }
    var W = canvas.width, H = canvas.height;
    var x = (sc.ndcX * 0.5 + 0.5) * W, y = (-sc.ndcY * 0.5 + 0.5) * H;
    var behind = sc.behind;
    /* 背面/出屏 → 夹到边缘并转箭头朝外（像"往那边看"）。 */
    var pad = 40, cx = W / 2, cy = H / 2, ang = 0, edge = false;
    if (behind) { var dx0 = x - cx, dy0 = y - cy; var L0 = Math.hypot(dx0, dy0) || 1; x = cx + dx0 / L0 * Math.min(W, H) * 0.42; y = cy + dy0 / L0 * Math.min(W, H) * 0.42; ang = Math.atan2(dy0, dx0) * 180 / Math.PI; edge = true; }
    else if (x < pad || x > W - pad || y < pad || y > H - pad) {
      var lx = Math.max(pad, Math.min(W - pad, x)), ly = Math.max(pad, Math.min(H - pad, y));
      ang = Math.atan2(y - cy, x - cx) * 180 / Math.PI; x = lx; y = ly; edge = true;
    }
    el.style.display = 'block';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    /* 在屏幕上指向奇观：无夹角则指下（▼）；边缘态按角度转。 */
    el.style.transform = 'translate(-50%,-50%) rotate(' + (edge ? ang + 90 : 0) + 'deg) scale(2.4)';
    el.dataset.pid = pid;
  };
  /* ============================================================
   * v92.240k（老板：「在地图界面的地块上进行建造……标准化的物品放置和组件引擎」）
   * ------------------------------------------------------------
   * 交互只有三步：**选一件拿在手上 → 点地图上的格子放下 → 还能转/拆**。
   * 这里只负责"物品栏"这张面板；真正的落位在 `M.pickAt`（map3d.js）里：
   * 手上拿着东西时，点格走 `GAME.place.add`，不走地块原来的面板逻辑。
   * ⚠️ 刻意不加 CSS：全用既有 `btn sm` / `mk-lbl` 类 + 内联布局，
   *    免得再踩「零裸字号」那条门禁。
   * ============================================================ */
  ui.openPlacePanel = function () {
    var PLc = GAME.place, SPn = GAME.sphere;
    if (!PLc) { if (ui.toast) ui.toast('放置引擎还没起来'); return; }
    var h = '<div class="gold-heading">🧱 建造 —— 在地块上放东西</div>';
    h += '<div class="panel-body">';
    h += '<div class="ui-sub">选一件拿在手上，然后<b>点地图上的格子</b>放下。已探明的格子才能放，一格一件。<br>'
      + '建筑<b>要挑地形</b>：结构类只能建在平整的<b>平地/草原</b>（山地立不住），'
      + '浮台/小舟要<b>下水</b>，栈桥要立在水陆交界。</div>';
    var items = PLc.list();
    var gName = PLc.GROUND_NAME || {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i], on = (ui._placeItem === it.id);
      var gTag = it.ground ? (gName[it.ground] || it.ground) : '陆地';
      if (it.ground === 'flat' && it.slopeMax != null) gTag += '·平整 ' + it.slopeMax;
      h += '<button class="btn sm' + (on ? ' gold' : '') + '" style="display:block;width:100%;text-align:left;margin:3px 0;"'
        + ' data-action="place-pick" data-item="' + U.escape(it.id) + '">'
        + (on ? '▶ ' : '') + U.escape(it.name)
        + '　<span style="color:var(--gold-light);">[' + U.escape(gTag) + ']</span>'
        + '　<span class="mk-lbl">' + U.escape(it.desc || '') + '</span>'
        + '</button>';
    }
    /* 已放置清单：按放置时间倒序，只列最近 12 件（多了没意义，还拖慢面板） */
    var all = PLc.all(), keys = [];
    for (var k in all) if (all[k]) keys.push(k);
    keys.sort(function (a, b) { return (all[b].t || 0) - (all[a].t || 0); });
    h += '<div class="mk-sep"></div><div class="mk-lbl">已放置 ' + keys.length + ' 件'
      + (keys.length > 12 ? '（只列最近 12 件）' : '') + '</div>';
    if (!keys.length) h += '<div class="mk-lbl">这块地方还没放过东西。</div>';
    for (var j = 0; j < Math.min(12, keys.length); j++) {
      var key = keys[j], rec = all[key], it2 = PLc.item(rec.i);
      /* v157.26：新键是方格 "i,j"；旧档是六边形 ci（数字）。
         两种都要列得出来 —— 旧档的房子不能因为换了坐标系就"看不见、拆不掉"。 */
      var pos;
      if (String(key).indexOf(',') > 0) {
        var pq = String(key).split(',');
        pos = '方格 (' + pq[0] + ', ' + pq[1] + ')';
      } else {
        var c = (SPn && SPn.cells) ? SPn.cells[+key] : null;
        pos = c ? (Math.round(c.lon) + '°E ' + Math.round(c.lat) + '°N') : ('格 ' + key);
      }
      h += '<div class="mk-lbl" style="margin:4px 0;"><b>' + U.escape(it2 ? it2.name : rec.i) + '</b>　' + U.escape(pos)
        + '　<button class="btn sm" data-action="place-rot" data-key="' + U.escape(String(key)) + '">转 45°</button>'
        + '　<button class="btn sm warn" data-action="place-rm" data-key="' + U.escape(String(key)) + '">拆除</button></div>';
    }
    h += '</div>';
    h += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h);
  };

  /* ============================================================
   * v92.245（老板）：「星空中物体应有体积，并可点击」
   * ------------------------------------------------------------
   * 点中陨石带的一块石头 → 这张卡。数据全部来自 `GAME.belt`（确定性生成、不进存档）：
   *   · 轨道：距球心 = a（同时给出"多少倍星球半径"，玩家好判断远近）
   *   · 体量：半径 / 质量（size 已按 R/300 等比缩放）
   *   · 矿藏：石料 / 铁 / 稀有金属 / 晶石 —— 内圈富金属、外圈富石料与晶石
   * 星际采矿是 P2：这里先把"这块石头有多少东西"如实摆出来，不假装能挖。
   * ============================================================ */
  ui.openBeltRock = function (rock) {
    if (!rock) return;
    var BL = GAME.belt;
    var R = (GAME.sphere && GAME.sphere.R) || 300;
    var oreName = (BL && BL.ORE_NAME) || { stone: '石料', iron: '铁', rare: '稀有金属', crystal: '晶石' };
    var keys = (BL && BL.ORE_KEYS) || ['stone', 'iron', 'rare', 'crystal'];
    var idx = String(rock.id || '').split('_').pop();
    var aMul = (rock.a / R);
    /* v157.53：belt.summary 早已算好整条带子的汇总，此前零调用（机制在、界面零显示）。
       这里只读不改：缓存没生成时返回 null，整行不渲染，不显示 NaN。 */
    var sum = (BL && BL.summary) ? BL.summary() : null;
    var rows = keys.map(function (k) {
      var v = (rock.ore && rock.ore[k]) || 0;
      return '<div class="attr"><span class="k">' + U.escape(oreName[k] || k) + '</span>'
        + '<span class="v"><b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
        + v + '</b> <span class="ui-sub">单位</span></span></div>';
    }).join('');
    var inner = rock.u < 0.34, outer = rock.u > 0.67;
    var h = '<div class="gold-heading">🪨 陨石带 · 第 ' + U.escape(idx) + ' 块</div>'
      + '<div class="panel-body">'
      + '<div class="ui-sub" style="margin-bottom:8px;">'
      + (inner ? '靠内缘的一块 —— 金属多，石料少。'
        : outer ? '靠外缘的一块 —— 石料与晶石多，金属稀。'
          : '带中段的一块 —— 各矿比较平均。') + '</div>'
      + '<div class="attr"><span class="k">轨道半径</span><span class="v">'
      + Math.round(rock.a) + '　<span class="ui-sub">= ' + aMul.toFixed(2) + ' 倍星球半径</span></span></div>'
      + '<div class="attr"><span class="k">轨道倾角</span><span class="v">'
      + Math.round(rock.inc * 180 / Math.PI) + '°</span></div>'
      + '<div class="attr"><span class="k">尺寸</span><span class="v">'
      + rock.size.toFixed(1) + '　<span class="ui-sub">半径（世界单位）</span></span></div>'
      + '<div class="attr"><span class="k">质量</span><span class="v">'
      + GAME.utils.numText(rock.mass, 0) + '</span></div>'
      + '<div class="mk-sep"></div>'
      + '<div class="mk-lbl">矿藏（储量）</div>'
      + rows
      + (sum ? '<div class="ui-sub" style="margin-top:6px;">全带共 ' + sum.count
          + ' 块 · 总质量 ' + GAME.utils.numText(sum.mass, 0)
          + ' · 大型 ' + sum.big + ' 块</div>' : '')
      + '<div class="ui-sub" style="margin-top:8px;color:var(--text-dim);">'
      + '⛏ 星际采矿尚未开放 —— 上面是这块石头的储量，不是现在能挖的量；'
      + '整条带的汇总也已算好，待采矿开放时直接取用。</div>'
      + '</div>'
      + '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h, 'sm');
  };

  ui.renderMapCanvas = function () {
    var canvas = $('#mapCanvas');
    if (!canvas) return;
    /* v44：点击地图 → 记下点选的地块，并把坐标刷到状态行。
       canvas 每次 setView 都会重建，所以用元素上的标记保证只绑一次。
       v151（老板「地图就是游戏本体」）：前传期这个手势 = **走路 / 就地动手**，
       不走 `ui.openLandModalCi` 那套"未占领野地面板"。 */
    if (!canvas._pickBound) {
      canvas._pickBound = true;
      canvas.addEventListener('click', function (e) {
        var r = GAME.map.pick(canvas, e.clientX, e.clientY);
        if (!r) return;
        /* ⛔ v157.85：前传「点击 = 君主走路」分支已删（前传退役）。 */
        /* ============================================================
         * v156.39：**2D 兜底路径的点击要开面板**。
         * ------------------------------------------------------------
         * 由来：v156.37 删底栏读数时，把这里唯一的两行
         *   `ui.mapPick = r; ui.syncMapInfo();`
         * 一起删了（它们只服务已退役的「点选 —」行）。删得对，但**没补替身**，
         * 于是非前传期点地图 = 函数体空了 = 什么都没发生。
         *
         * 而这个洞此前被一条恒真断言盖着：
         *   check('点击地图格子有响应', true, …)
         * —— 它从写下的第一天起就是真的，所以没人发现。
         *
         * 3D 路径（map3d.pickAt → _openCellPanel）本来就开面板；
         * 2D 兜底没有，属**两条路径行为不一致**。这里补上既有入口
         * （openLandModalCi 是 2D 时代就有的野地面板，不是新功能）。
         * ============================================================ */
        if (ui.openLandModalCi) ui.openLandModalCi(r.ci);
      });
    }
    var fr = ui.mapFrame;
    /* v90.61（老板）：「地图画面直接是这个样子」—— 走 Three.js 真 3D 沙盘。
       关掉 GAME.map3d.enabled 即退回 2D 方格图。
       v90.69：3D 依赖球面内核 GAME.sphere（无 THREE 的 node 测试环境无此模块 → 自动退回 2D）。 */
    if (GAME.map3d && GAME.map3d.enabled && GAME.sphere) {
      /* v90.71（老板）：画布**贴边占满** .map-wrap（读容器内框尺寸，去四周/下方留白）——
         退回 fr.spanX×cell 兜底（容器未布局时）。 */
      var _wrap = document.querySelector('.map-wrap');
      var _cw = (_wrap && _wrap.clientWidth) ? _wrap.clientWidth : Math.round(fr.spanX * fr.cell);
      var _chh = (_wrap && _wrap.clientHeight) ? _wrap.clientHeight : Math.round(fr.spanY * fr.cell);
      if (canvas.width !== _cw) canvas.width = _cw;
      if (canvas.height !== _chh) canvas.height = _chh;
      if (GAME.map3d.bindControls) GAME.map3d.bindControls(canvas);   /* 左键拖动平移 · 右键转向 · 滚轮缩放 */
      GAME.map3d.render(canvas, ui.mapView.x, ui.mapView.y, fr.spanX, fr.spanY);
      ui.syncWonderArrow(canvas);   /* v91.30：雷霆箭头指向今日奇观 */
      var _pe = document.getElementById && document.getElementById('adm-prov');
      if (_pe && !_pe.options.length) ui.fillAdmSearch();   /* 首次填充分级检索（不每帧重建）*/
      return;
    }
    /* v90.97（双球面）：2D 兜底渲染读的是 GAME.map（**当前星球**平面投影）—— 不支持地图看别星，
       故退回 2D 时把地图视角钉回 current 星球（避免地图下拉与画面不符）。 */
    if (GAME.state && GAME.mapPlanetOf && GAME.mapPlanetOf()) {
      var _ap97 = GAME.activePlanetOf ? GAME.activePlanetOf() : null;
      if (_ap97 && GAME.state.mapPlanetId !== _ap97.id) GAME.state.mapPlanetId = _ap97.id;
    }
    GAME.map.render(canvas, { vx: ui.mapView.x, vy: ui.mapView.y,
      spanX: fr.spanX, spanY: fr.spanY, cell: fr.cell,
      showLabels: true });   /* v90.88（老板）：名称开关**不再关联地图** —— 地图标注恒显 */
    /* v89.89（A4）：定位标记 —— 材料产地跳转等「已定位」场景的醒目提示。
       双色圆环（金/朱红按 450ms 相位交替），主循环每秒重绘负责"闪"；6 秒自灭。 */
    var mk = ui._mapMark;
    if (mk) {
      if (mk.until > Date.now()) {
        var vw = GAME.map._view;
        var mctx = canvas.getContext && canvas.getContext('2d');
        if (vw && vw.HW && mctx && mctx.beginPath) {
          var cx = vw.ox + mk.x * vw.cell;
          var cy = vw.oy + mk.y * vw.cell;
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
  };

  /* v90.88：ui.mapPan（方向键平移）随方向键退役。 */
  /* v90.99（老板）：**地图是否在看当前城所在星球** —— 双球面下，若地图已切到别星，
     「回主城 / 回本城 / 灰烬城」这些**基于当前城的导航**不适用（城不在当前地图星球上）。
     除非显式传「某城所在星球」，一律返回是否 mapPlanet === activePlanet。 */
  ui.mapOnActivePlanet = function (pid) {
    if (pid == null) pid = (GAME.activePlanetOf && GAME.activePlanetOf()) ? GAME.activePlanetOf().id : null;
    var mp = (GAME.mapPlanetOf && GAME.mapPlanetOf()) ? GAME.mapPlanetOf().id : pid;
    return pid != null && mp === pid;
  };
  ui.mapCenterOn = function (x, y) {    /* v50：视野中心格 = (x,y)。旧签名后两个参数（spanX/spanY）已无意义 ——
       菱形视野不是矩形，不再需要"减去半屏"；保留形参只为兼容旧调用。 */
    ui.mapView.x = U.clamp(Math.round(x), 0, DATA.MAP_W - 1);
    ui.mapView.y = U.clamp(Math.round(y), 0, DATA.MAP_H - 1);
    /* v90.67：3D 下同时把**相机对准该格**（回主城/回本城/灰烬城 → 球面转到该处）*/
    if (GAME.map3d && GAME.map3d.enabled && GAME.map3d.centerOn) GAME.map3d.centerOn(ui.mapView.x, ui.mapView.y);
    ui.renderMapCanvas();
  };

  /* ============================================================
   * v158.17（老板「参考现有成熟设计完善」③）· 导航按钮**同时搬人**
   * ------------------------------------------------------------
   * P0 之前"相机 = 玩家视角"，所以 mapCenterOn 移相机就等于移玩家；
   * 有了独立位姿之后这条链路断了：镜头到城了、人还在野地，
   * 下一帧 followAvatar 又把镜头按人的朝向拽回去（实测城格 NDC y = −1.5 出画）。
   * 三个导航按钮统一补这一步 —— 走 map3d.gotoXY（内部走 setPlayerPose 唯一出口）。
   * ⚠️ 只给"回主城 / 回本城 / 灰烬城"这三个"回我自己的地方"加，
   *    `fort-goto`（定位据点）这类"看一眼"的跳转不动人，半步都不动。
   * ============================================================ */
  function navMovePerson(x, y, ci) {
    if (!GAME.map3d || !GAME.map3d.gotoXY) return;
    try { GAME.map3d.gotoXY(x, y, ci); } catch (e) { }
  }

  ui.mapCenter = function () {
    var pc = GAME.map.playerCity();
    if (!pc) return;
    if (!ui.mapOnActivePlanet()) { ui.toast('地图当前在看别颗星球 —— 回主城需先切回本城所在星球'); return; }
    ui.mapCenterOn(pc.x, pc.y);
    navMovePerson(pc.x, pc.y, pc.ci);
    ui.toast('已回到主城 ' + GAME.map.coordText(pc.x, pc.y));
  };

  /* v89.192（老板 1）：回本城 —— 视野中心跳到**当前操作城市**所在位置
     （回主城 = 首城 / 回本城 = ui._cityId 指的那座；数值全走既有出口 mapCenterOn）。
     v90.99（老板）：**跨星球断开** —— 本城不在当前地图星球上时不可回（否则"回到别星球的坐标"没意义）。 */
  ui.mapMyCity = function () {
    var c = GAME.currentCity();
    if (!c) { ui.toast('尚无城市'); return; }
    if (!ui.mapOnActivePlanet()) { ui.toast('本城不在当前地图星球上 —— 回本城需先切回本城所在星球'); return; }
    ui.mapCenterOn(c.x, c.y);
    navMovePerson(c.x, c.y, c.ci);
    ui.toast('已回到本城（' + (c.name || '') + '）' + GAME.map.coordText(c.x, c.y));
  };
  /* v90.99（老板）：灰烬城（旧都）是**母星专属** —— 地图在看别星时不可回（别星没有灰烬城）。 */
  ui.mapCapitalCity = function () {
    if (!ui.mapOnActivePlanet(1)) { ui.toast('灰烬城在母星 —— 当前地图非母星，不可定位'); return; }
    ui.mapCenterOn(265, 215);
    navMovePerson(265, 215);          /* 旧都只有格坐标、没有城市档 → 让 setPlayerPose 自己反算格锚 */
    ui.toast('已定位至旧都灰烬城 (265,215)');
  };

  /* ⛔ v156.35（老板 2026-11-02「这个已无用，删去：球系坐标 / 经度 / °E / 纬度 / °N / 前往」）
     `ui.mapGoto` 整条退役 —— 它唯一的读者就是被删掉的「前往」按钮。
     球系映射能力本身**没删**：`GAME.sphere.xyOfLonLat / lonLatOfXY` 仍在
     （prologue / state / surge 三处都在用），这里下去的只是"手输经纬度跳转"这个入口。
     导航仍有三条路，都在底栏：回主城 / 回本城 / 灰烬城，外加地图上直接点格子。 */


  /* --------- 野地/出征 modal --------- */
  /* ============================================================
   * 城市面板 / 资源运输 / 英雄派遣（v60 · 需求 4）
   * ------------------------------------------------------------
   * 老板原话：「英雄，幸存者，资源等是归属于城市的数据，切换城市时，只统计、呈现
   *   当前的数据即可。城市之间，资源需要运输，英雄需要派遣，为自己占据的城市
   *   提供相关功能按钮，**不要一点击地图就直接进入城市**」。
   *
   * 所以点地图上的自家城市，弹的是这扇「城市面板」：先给一张摘要
   * （档位优势 / 本城库存 / 驻军 / 守将），再给四个动作 ——
   * 进入城市 / 资源运输 / 英雄派遣 / 改名。
   * "点一下地图"从此不再有副作用（原先直接 setView('city') 会连带换掉当前城）。
   * ============================================================ */
  ui.cityTierName = function (type) {
    return DATA.CITY_TIER ? (DATA.CITY_TIER[type] || '自建城') : (type || '');
  };
  /* v70（老板）：「为玩家城市提供坐标切换」—— 输入坐标迁址（唯一入口）。
     判据与执行都在 GAME.canCityMoveTo / moveCityTo（界面不自己判一遍）。 */
  ui.openCityMoveAsk = function (city) {
    var c = city || GAME.currentCity();
    if (!c) return;
    ui._cityMoveId = c.id;
    var movable = GAME.isMovableCity(c);
    ui.openModal(
      '<div class="gold-heading">📍 迁址 · ' + U.escape(c.name) + '</div>' +
      /* v158.18（老板「新手玩法」）：退役代码术语「球系：填格索引 ci / 格索引」——
         玩家不该看到变量名。改成「格编号」，并告诉他在哪看（地图上点一格的面板里有）。 */
      '<div class="note">迁址后：原来的地块会回到无主状态，新格成为你的城市。' +
        '只可迁到<b>平原</b>空地（地图上点一格，面板里会显示它的格编号）。名城地望固定，不可迁。</div>' +
      '<div class="attr"><span class="k">当前坐标</span><span class="v">' +
        GAME.coordText(c) + '</span></div>' +
      (movable
        ? '<div class="attr"><span class="k">迁往</span><span class="v">' +
            '目标格编号 <input type="number" id="move-ci" class="qty-input" style="width:110px;" min="0" value="' +
              (c.ci != null ? c.ci : 0) + '">　<span class="ui-sub">填地图上那一格的编号</span></span></div>'
        : '<div class="note">这座城是名城 —— 地望固定，不可迁址。</div>') +
      '<div class="modal-foot">' +
        (movable ? '<button class="btn gold" data-action="city-move-do">确认迁址</button>' : '') +
        '<button class="btn" data-action="close-modal">' + (movable ? '取消' : '关闭') + '</button></div>'
    );
  };

})();

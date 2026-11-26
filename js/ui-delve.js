/* ============================================================
 * ui-delve.js　废土 · 营地 / 遗迹 / 斗将 / 村社 / 拓荒队 / 三条线
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
   * v92.4：幸存者营地 —— 招人 还是 抢物资
   * ------------------------------------------------------------
   * 整个决策只有两条路，而且**不可撤销**（处理过就没了）。
   * 这就是"牺牲"落地的地方：抢得快，但风声传开，后面招到的人越来越少。
   * 不做二次确认：面板上两条路和代价都写清了，点下去就是决定。
   * ============================================================ */
  /* ============================================================
   * v92.7：旧世界遗迹 —— 一处只能翻一次，两种翻法互斥
   * ------------------------------------------------------------
   * 和营地面板的分工：营地写"代价是名声"，遗迹写"你只能拿走一样"。
   * 面板上把**两样的产出都摊开**，不藏 —— 藏了就不是取舍，是抽奖。
   * ============================================================ */
  /* ============================================================
   * ⛔ v158.25（老板「旧军械库所在的分支是什么，无用」→ 选 A 退役）
   * ------------------------------------------------------------
   * 这里原本是 `ui.openRuinModal`（旧世界遗迹面板：废弃医院/旧军械库/数据塔，
   * 两个互斥选项：材料 or 资源）。
   * 内容是真的（实测精铁 0→14 到账），但**玩家永远遇不到**：
   *   全图 64 处 · 密度 0.25% · 发现要求已探明 · 开局探明 0.15% → 实测发现 0 处。
   * 老板选 A：整条退役。配套删除 DATA.RUIN / js/ruin.js / map3d 分支 / rival 抢遗迹。
   * ============================================================ */

  /* ============================================================
   * v92.9（构想 C1）：手动斗将 —— 招式心理战
   * ------------------------------------------------------------
   * 玩家出 5 招，对手的招式**当合不显示**，只看得到谁占先。
   * 对手出招按属性倾向加权（`s duelTendency`），观察两合能猜 ——
   * 这既是"看不到"，又不是纯掷骰（文档要的"不可预判 × 可预判"）。
   *
   * ⚠️ 目前只记**履历与胜负**，不接战前士气 —— 面板上明写。
   * ============================================================ */
  /* ============================================================
   * v92.14：派将挑衅一座城 —— 与守将打 5 合，赢了那城胆寒 24 小时
   * ------------------------------------------------------------
   * 与「向势力叫阵」的区别：那个只记履历，这个**真的削弱下一次攻城**
   * （守军 −12%，在 prepare 的 scArmy 上生效，与"妖言惑众"同层）。
   * ⚠️ 输了只掉 20 体力：不做重伤，避免"点一次输一次"的挫败感。
   * ============================================================ */
    ui.openProvoke = function () {
    /* v92.240g：目标城以**开面板时的快照**为准 —— ui.closeModal() 会把 ui._attackNpc
       置 null（ui.js 顶层关闭分支），挑衅过程中若它被清掉，出战会在读 npc.id 处抛
       TypeError，表现为"选完将点出战没反应"。 */
    var npc = ui._provokeNpc || ui._attackNpc;
    if (!npc) return;
    var D = DATA.DUEL || {};
    var MV = Object.assign({}, D.moves || {}, D.skills || {});
    var order = D.moveOrder || [];
    var st = GAME.state;
    var myGens = (st.generals || []).filter(function (g) { return !g.dead; });
    if (!myGens.length) { ui.toast('没有可派的英雄'); return; }
    var enemyGens = GAME.battle.provokeEnemyGens(npc);
    /* v92.240h：空城叫阵无人应 —— 不做选将也不进战斗（否则 him 为空 → 秒胜白送胆寒） */
    if (!enemyGens.length) {
      ui.openModal('<div class="gold-heading">⚔ 派将挑衅</div>'
        + '<div class="panel-body"><div class="ui-sub">该城并无守将，叫阵无人应。</div></div>');
      return;
    }
    if (!ui._provokePick) ui._provokePick = [];
    var S = ui._provoke;

    /* ================= 选将阶段 ================= */
    if (!S) {
      var gatePct = D.provokeStaGatePct || 0;
      var h = '<div class="gold-heading">⚔ 派将挑衅 · ' + U.escape(GAME.cityFullName ? GAME.cityFullName(npc) : (npc.name || '该城')) + '</div>';
      h += '<style>'
        + '.pv-pick-h{font-weight:600;margin:10px 0 6px;color:var(--gold-light);font-size:var(--fs-sub);}'
        + '.pv-pick-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}'
        + '.pv-pick-card{width:150px;padding:8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--wood-light);text-align:center;cursor:pointer;transition:.15s;}'
        + '.pv-pick-card.me:hover{border-color:var(--gold-light);}'
        + '.pv-pick-card.pv-pick-on{border-color:var(--gold-light);box-shadow:0 0 14px 2px rgba(230,164,0,.5);background:rgba(230,164,0,.1);}'
        + '.pv-pick-card.pv-pick-lock{opacity:.45;cursor:not-allowed;filter:grayscale(.5);}'
        + '.pv-pick-card .pv-portrait{display:inline-block;filter:drop-shadow(0 6px 8px rgba(0,0,0,.5));}'
        + '.pv-pick-card.him{border-color:rgba(200,60,60,.5);cursor:default;}'
        + '.pv-locktip{font-size:var(--fs-cap);color:var(--red-light);margin-top:3px;}'
        + '.pv-sel-n{color:var(--gold-light);}'
        + '</style>';
      h += '<div class="panel-body">';
      h += '<div class="pv-pick-h">守军出战（名城固定 3 将）</div>';
      h += '<div class="pv-pick-row">';
      enemyGens.forEach(function (g) {
        var p = GAME.battle.duelProfile(g);
        h += '<div class="pv-pick-card him">'
          + '<div class="pv-portrait">' + ui.faceOf(g, 64) + '</div>'
          + '<div class="pv-name" style="color:var(--red-light);">' + U.escape(g.name) + '</div>'
          + '<div class="pv-title">Lv' + (g.level || 1) + ' · ' + (g.title || '守军') + '</div>'
          + '<div class="pv-stats"><span>攻 <b>' + p.atk + '</b></span><span>防 <b>' + p.def + '</b></span><span>体 <b>' + p.max + '</b></span></div>'
          + '</div>';
      });
      h += '</div>';
      h += '<div class="pv-pick-h">我方出战（勾选 1~3 将，左 3 对右 3）　·　已选 <b class="pv-sel-n">' + ui._provokePick.length + '</b>/3</div>';
      h += '<div class="pv-pick-row">';
      myGens.forEach(function (g) {
        var p = GAME.battle.duelProfile(g);
        var staMax = GAME.staMax ? GAME.staMax(g) : 100;
        var staNow = GAME.staNow ? Math.max(0, GAME.staNow(g)) : staMax;
        var locked = gatePct > 0 && (staNow < staMax * gatePct);
        var sel = ui._provokePick.indexOf(g.id) >= 0;
        var dis = locked && !sel;
        h += '<div class="pv-pick-card me' + (sel ? ' pv-pick-on' : '') + (dis ? ' pv-pick-lock' : '') + '" '
          + 'data-action="provoke-select" data-gid="' + g.id + '"' + (dis ? ' data-locked="1"' : '') + '>'
          + '<div class="pv-portrait">' + ui.faceOf(g, 64) + '</div>'
          + '<div class="pv-name" style="color:var(--gold-light);">' + U.escape(g.name) + (sel ? ' ✓' : '') + '</div>'
          + '<div class="pv-title">Lv' + (g.level || 1) + ' · ' + (g.title || '我方') + '</div>'
          + '<div class="pv-stats"><span>攻 <b>' + p.atk + '</b></span><span>防 <b>' + p.def + '</b></span></div>'
          + '<div class="pv-stats"><span>体力 <b>' + staNow + '/' + staMax + '</b></span></div>'
          + (locked ? '<div class="pv-locktip">体力不足</div>' : '')
          + '</div>';
      });
      h += '</div>';
      var canStart = ui._provokePick.length >= 1 && ui._provokePick.length <= 3;
      h += '<div class="panel-foot"><button class="btn gold" data-action="provoke-start"' + (canStart ? '' : ' disabled') + '>出战（' + ui._provokePick.length + ' 将）</button>'
        + '　<button class="btn" data-action="close-modal">关闭</button>'
        + (ui._provokePick.length > 3 ? ' <span style="color:var(--red-light)">最多 3 将</span>' : '') + '</div>';
      h += '</div>';
      ui.openModal(h);
      return;
    }

    /* ================= 对战 / 结算阶段 ================= */
    var last = S.log[S.log.length - 1];
    function _actCls(isMe) {
      if (!last || S.over) return '';
      if (last.res === 'a') return isMe ? ('pv-act-' + (last.am || 'stab')) : 'pv-hurt';
      if (last.res === 'b') return isMe ? 'pv-hurt' : ('pv-act-' + (last.bm || 'stab'));
      return 'pv-shake';
    }
    function _fxCls(isMe) {
      if (!last || S.over) return '';
      var wm = last.res === 'a' ? last.am : last.res === 'b' ? last.bm : null;
      var sk = wm && MV[wm] && MV[wm].skill;
      if (last.res === 'a') return isMe ? (sk ? 'pv-fx-skill' : ('pv-fx-' + (last.am || 'stab'))) : 'pv-fx-hit';
      if (last.res === 'b') return isMe ? 'pv-fx-hit' : (sk ? 'pv-fx-skill' : ('pv-fx-' + (last.bm || 'stab')));
      return '';
    }
    function _koCls(idx, isMe) {
      var prof = isMe ? S.me[idx] : S.him[idx];
      if (prof && !prof.alive) return 'pv-ko';
      if (S.over) {
        if (S.winner === 'atk') return isMe ? 'pv-win' : 'pv-ko';
        if (S.winner === 'def') return isMe ? 'pv-ko' : 'pv-win';
      }
      return '';
    }
    function _activeIdx(isMe) {
      if (!last) { var a = isMe ? S.me : S.him; for (var i = 0; i < a.length; i++) if (a[i].alive) return i; return 0; }
      return isMe ? last.mi : last.hi;
    }
    function _fig(g, isMe, idx) {
      var prof = isMe ? S.me[idx] : S.him[idx];
      var col = isMe ? 'var(--gold-light)' : 'var(--red-light)';
      var bg = isMe ? 'linear-gradient(90deg,#e6a400,#b9790a)' : 'linear-gradient(90deg,#c83c3c,#7a1f1f)';
      var hp = prof.hp, mx = prof.max;
      var pct = Math.max(0, Math.min(100, hp / mx * 100));
      var act = (_activeIdx(isMe) === idx) ? ' pv-active' : '';
      var ko = _koCls(idx, isMe);
      var glow = (S.over && ((S.winner === 'atk' && isMe) || (S.winner === 'def' && !isMe))) ? ' pv-win-glow' : '';
      var ac = (!S.over && _activeIdx(isMe) === idx) ? _actCls(isMe) : '';
      var flip = isMe ? '' : ' pv-flip';
      var fx = (!S.over && _activeIdx(isMe) === idx) ? _fxCls(isMe) : '';
      return '<div class="pv-fig' + (isMe ? ' pv-me' : ' pv-him') + act + glow + '" data-pi="' + idx + '">'
        + '<div class="pv-portrait pv-idle"><div class="pv-img' + flip + '"><div class="pv-body ' + ko + ' ' + ac + '">' + ui.faceOf(g, 118) + '</div>'
        + (fx ? '<div class="pv-fx ' + fx + '"></div>' : '')
        + '</div></div>'
        + '<div class="pv-name" style="color:' + col + ';">' + U.escape(g.name) + (prof.alive ? '' : '（倒）') + '</div>'
        + '<div class="pv-title">' + U.escape(g.title || (isMe ? '我方' : '守军')) + ' · Lv' + (g.level || 1) + '</div>'
        + '<div class="pv-hpwrap"><div class="pv-hplbl"><span>体力</span><span>' + hp + ' / ' + mx + '</span></div>'
        + '<div class="pv-hpbar"><span class="pv-fill" style="width:' + pct + '%;background:' + bg + ';"></span></div></div>'
        + '<div class="pv-stats"><span>攻 <b>' + prof.atk + '</b></span><span>防 <b>' + prof.def + '</b></span></div>'
        + '</div>';
    }
    var h = '<div class="gold-heading">⚔ 派将挑衅 · ' + U.escape(GAME.cityFullName ? GAME.cityFullName(npc) : (npc.name || '该城')) + '</div>';
    h += '<style>'
      + '.pv-stage{position:relative;padding:8px 4px 0;margin-bottom:8px;border-radius:10px;overflow:hidden;'
      + 'background:radial-gradient(120% 70% at 50% 0%,rgba(230,164,0,.12),transparent 55%),'
      + 'linear-gradient(180deg,rgba(22,17,10,.55),rgba(8,6,4,.92));border:1px solid var(--wood-light);}'
      + '.pv-arena{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;position:relative;min-height:240px;padding:0 4px;}'
      + '.pv-side{display:flex;flex-direction:column;gap:6px;justify-content:flex-end;flex:1;}'
      + '.pv-side.him{align-items:flex-end;}'
      + '.pv-center{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:64px;flex:0 0 auto;}'
      + '.pv-floor{position:absolute;left:0;right:0;bottom:0;height:44px;background:linear-gradient(180deg,rgba(0,0,0,.55),rgba(70,45,22,.12));border-top:1px solid rgba(230,164,0,.22);}'
      + '.pv-fig{position:relative;width:150px;text-align:center;z-index:2;opacity:.42;transition:opacity .2s;}'
      + '.pv-fig.pv-active{opacity:1;}'
      + '.pv-fig.pv-win-glow{filter:drop-shadow(0 0 12px rgba(230,164,0,.7));}'
      + '.pv-portrait{display:inline-block;filter:drop-shadow(0 10px 12px rgba(0,0,0,.65));}'
      + '.pv-portrait.pv-idle{animation:pv-idle 2.6s ease-in-out infinite;}'
      + '@keyframes pv-idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
      + '.pv-img{display:inline-block;}'
      + '.pv-img.pv-flip{transform:scaleX(-1);}'
      + '.pv-body{display:inline-block;transform-origin:50% 100%;will-change:transform;}'
      + '.pv-body img{display:block;}'
      + '.pv-name{font-weight:600;margin-top:2px;position:relative;z-index:3;}'
      + '.pv-title{font-size:var(--fs-cap);color:var(--text-dim);}'
      + '.pv-hpwrap{margin-top:5px;position:relative;z-index:3;}'
      + '.pv-hplbl{display:flex;justify-content:space-between;font-size:var(--fs-cap);color:var(--text-dim);}'
      + '.pv-hpbar{height:13px;background:rgba(0,0,0,.5);border-radius:7px;overflow:hidden;margin-top:2px;border:1px solid rgba(255,255,255,.12);}'
      + '.pv-fill{height:100%;transition:width .45s ease;}'
      + '.pv-stats{display:flex;gap:8px;justify-content:center;font-size:var(--fs-cap);color:var(--text-dim);margin-top:4px;}'
      + '.pv-stats b{color:var(--text);}'
      + '.pv-dmg{position:absolute;left:50%;top:6px;font-weight:800;font-size:var(--fs-h1);color:var(--red-light);z-index:6;pointer-events:none;animation:pv-pop .8s ease forwards;}'
      + '@keyframes pv-pop{0%{opacity:0;transform:translate(-50%,12px) scale(.6)}30%{opacity:1;transform:translate(-50%,-12px) scale(1.2)}100%{opacity:0;transform:translate(-50%,-36px) scale(1)}}'
      + '.pv-act-stab{animation:pv-stab .55s cubic-bezier(.3,1.5,.5,1) forwards;}'
      + '@keyframes pv-stab{0%{transform:translateX(0) rotate(0)}30%{transform:translateX(28px) rotate(-7deg)}60%{transform:translateX(28px) rotate(-7deg)}100%{transform:translateX(0) rotate(0)}}'
      + '.pv-act-guard{animation:pv-guard .6s ease forwards;}'
      + '@keyframes pv-guard{0%{transform:scale(1)}25%{transform:scale(1.12) translateY(-7px)}100%{transform:scale(1) translateY(0)}}'
      + '.pv-act-feint{animation:pv-feint .5s ease forwards;}'
      + '@keyframes pv-feint{0%{transform:translateX(0)}20%{transform:translateX(22px)}45%{transform:translateX(-10px)}70%{transform:translateX(12px)}100%{transform:translateX(0)}}'
      + '.pv-act-charge{animation:pv-charge .7s ease forwards;}'
      + '@keyframes pv-charge{0%{transform:scaleY(1)}40%{transform:scaleY(.8) translateY(9px)}100%{transform:scaleY(1) translateY(0)}}'
      + '.pv-hurt{animation:pv-hurt .5s ease forwards;}'
      + '@keyframes pv-hurt{0%{transform:translateX(0)}20%{transform:translateX(-22px) rotate(-9deg);filter:brightness(2.2) sepia(1) hue-rotate(-35deg) saturate(5)}45%{transform:translateX(7px)}70%{transform:translateX(-5px)}100%{transform:translateX(0);filter:none}}'
      + '.pv-shake{animation:pv-shake .4s ease;}'
      + '@keyframes pv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}50%{transform:translateX(5px)}75%{transform:translateX(-4px)}}'
      + '.pv-fx{position:absolute;left:50%;top:42%;pointer-events:none;z-index:7;}'
      + '.pv-fx-stab{width:84px;height:4px;margin-left:-12px;background:linear-gradient(90deg,transparent,#fff,transparent);border-radius:4px;animation:pv-fx-stab .4s ease forwards;}'
      + '@keyframes pv-fx-stab{0%{transform:scaleX(0);opacity:0}45%{transform:scaleX(1);opacity:1}100%{transform:scaleX(1.25);opacity:0}}'
      + '.pv-fx-guard{width:64px;height:64px;margin:-32px 0 0 -32px;border:3px solid var(--gold-light);border-radius:50%;animation:pv-fx-guard .6s ease forwards;}'
      + '@keyframes pv-fx-guard{0%{transform:scale(.4);opacity:.9}100%{transform:scale(1.5);opacity:0}}'
      + '.pv-fx-charge{width:54px;height:54px;margin:-64px 0 0 -27px;border-radius:50%;background:radial-gradient(circle,rgba(255,180,60,.85),transparent 70%);animation:pv-fx-charge .7s ease forwards;}'
      + '@keyframes pv-fx-charge{0%{transform:translateY(22px) scale(.5);opacity:0}40%{opacity:1}100%{transform:translateY(-32px) scale(1.35);opacity:0}}'
      + '.pv-fx-feint{width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle,rgba(170,215,255,.7),transparent 70%);animation:pv-fx-feint .5s ease forwards;}'
      + '@keyframes pv-fx-feint{0%{transform:scale(.6);opacity:0}40%{opacity:.8}100%{transform:scale(1.5);opacity:0}}'
      + '.pv-fx-hit{width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,80,40,.65),transparent 70%);animation:pv-fx-hit .5s ease forwards;}'
      + '@keyframes pv-fx-hit{0%{transform:scale(.3);opacity:1}100%{transform:scale(2.2);opacity:0}}'
      + '.pv-ko{animation:pv-ko 1s ease forwards;}'
      + '@keyframes pv-ko{0%{transform:rotate(0) translateY(0);filter:none}100%{transform:rotate(82deg) translateY(34px);filter:grayscale(1) brightness(.5);opacity:.55}}'
      + '.pv-win{animation:pv-win .85s ease forwards;}'
      + '@keyframes pv-win{0%{transform:translateY(0)}28%{transform:translateY(-24px) scale(1.09)}60%{transform:translateY(0)}100%{transform:translateY(0)}}'
      + '.pv-dmg-crit{font-size:calc(var(--fs-h1) * 1.5);color:#ffd24a;text-shadow:0 0 12px rgba(255,180,40,.95);}'
      + '.pv-act-skill{animation:pv-skill .6s cubic-bezier(.3,1.4,.5,1) forwards;}'
      + '@keyframes pv-skill{0%{transform:translateX(0) rotate(0) scale(1)}22%{transform:translateX(46px) rotate(-14deg) scale(1.14)}55%{transform:translateX(46px) rotate(-14deg) scale(1.14)}100%{transform:translateX(0) rotate(0) scale(1)}}'
      + '.pv-shake-big{animation:pv-shake-big .45s ease;}'
      + '@keyframes pv-shake-big{0%,100%{transform:translate(0,0)}15%{transform:translate(-10px,4px)}30%{transform:translate(9px,-3px)}45%{transform:translate(-8px,2px)}60%{transform:translate(7px,-2px)}75%{transform:translate(-5px,1px)}}'
      + '.pv-fx-skill{width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;background:radial-gradient(circle,rgba(255,210,90,.95),rgba(255,120,40,.5) 45%,transparent 70%);box-shadow:0 0 34px 10px rgba(255,180,60,.85);animation:pv-fx-skill .6s ease forwards;}'
      + '@keyframes pv-fx-skill{0%{transform:scale(.3);opacity:0}40%{opacity:1}100%{transform:scale(1.7);opacity:0}}'
      + '.pv-hitflash{position:absolute;inset:0;background:radial-gradient(circle at 50% 55%,rgba(210,50,35,.4),transparent 62%);opacity:0;pointer-events:none;z-index:5;}'
      + '.pv-hitflash-on{animation:pv-hitflash .35s ease;}'
      + '@keyframes pv-hitflash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}'
      + '.pv-vs-emblem{font-size:calc(var(--fs-h1) * 2);font-weight:900;color:rgba(255,210,90,.9);text-shadow:0 0 18px rgba(255,180,40,.8);z-index:4;pointer-events:none;}'
      + '.pv-vs-on{animation:pv-vs-flash .7s ease;}'
      + '@keyframes pv-vs-flash{0%{opacity:0;transform:scale(.5)}40%{opacity:1;transform:scale(1.25)}100%{opacity:0;transform:scale(1.6)}}'
      + '.pv-round{font-size:var(--fs-cap);color:var(--text-dim);margin-top:4px;}'
      + '.pv-skill-btn{background:linear-gradient(180deg,#3a2a08,#1c1405);border:1px solid var(--gold-light);color:var(--gold-light);font-weight:700;}'
      + '.pv-skill-btn.pv-skill-cd{opacity:.45;filter:grayscale(.4);cursor:not-allowed;}'
      + '.pv-ctrls{display:flex;gap:10px;align-items:center;justify-content:center;margin:6px 0;}'
      + '.pv-auto{font-size:var(--fs-cap);color:var(--text-dim);}'
      + '.pv-log{margin:8px 0;display:flex;flex-direction:column;gap:4px;max-height:150px;overflow:auto;}'
      + '.pv-row{display:flex;align-items:center;gap:8px;font-size:var(--fs-cap);padding:3px 8px;border-radius:4px;background:rgba(255,255,255,.04);}'
      + '.pv-row.me{border-left:3px solid var(--gold-light);} .pv-row.him{border-left:3px solid var(--red-light);}'
      + '.pv-row .pv-r{color:var(--text-dim);width:36px;} .pv-row .pv-vs{color:var(--text-dim);} .pv-row .pv-d{font-weight:700;margin-left:auto;}'
      + '.pv-result{text-align:center;font-weight:700;font-size:var(--fs-sub);padding:8px;border-radius:6px;margin:6px 0;}'
      + '.pv-result.ok{background:rgba(230,164,0,.14);color:var(--gold-light);border:1px solid var(--gold-light);}'
      + '.pv-result.bad{background:rgba(200,60,60,.14);color:var(--red-light);border:1px solid var(--red-light);}'
      + '.pv-result.draw{background:rgba(255,255,255,.08);color:var(--text-dim);border:1px solid var(--wood-light);}'
      + '</style>';
    h += '<div class="panel-body">';
    h += '<div class="pv-stage"><div class="pv-hitflash"></div><div class="pv-arena">';
    h += '<div class="pv-side me">';
    S.me.forEach(function (x, i) { h += _fig(x.g, true, i); });
    h += '</div>';
    h += '<div class="pv-center"><div class="pv-vs-emblem' + (S.over ? '' : ' pv-vs-on') + '">⚔</div>'
      + '<div class="pv-round">第 ' + S.round + ' 合</div></div>';
    h += '<div class="pv-side him">';
    S.him.forEach(function (x, i) { h += _fig(x.g, false, i); });
    h += '</div>';
    h += '</div><div class="pv-floor"></div></div>';

    if (!S.over) {
      var aMe = S.me[S.mi];
      var pSkillId = aMe ? (aMe.g.skill || D.defaultSkill) : null;
      var pSkill = pSkillId && MV[pSkillId] && MV[pSkillId].skill ? MV[pSkillId] : null;
      var cd = aMe ? aMe.skillCd : 0;
      h += '<div class="pv-ctrls">';
      if (pSkill) {
        var disS = cd > 0 || S.pendingSkill;
        h += '<button class="btn pv-skill-btn' + (disS ? ' pv-skill-cd' : '') + '" data-action="provoke-skill"' + (disS ? ' disabled' : '') + ' title="' + U.escape(pSkill.note || '') + '">'
          + (pSkill.icon ? pSkill.icon + ' ' : '★') + U.escape(pSkill.name)
          + (cd > 0 ? '（冷却 ' + cd + '）' : (S.pendingSkill ? '（待发）' : ' ★')) + '</button>';
      }
      h += '<span class="pv-auto">自动战斗中…（无需操作，可随时放绝活）</span>';
      h += '</div>';
    } else {
      h += '<div class="pv-log">';
      S.log.slice(-12).forEach(function (e) {
        var an = (MV[e.am] || {}).name || e.am, bn = (MV[e.bm] || {}).name || e.bm;
        var ai = (MV[e.am] || {}).icon || '⚔', bi = (MV[e.bm] || {}).icon || '🛡';
        var resTxt = e.res === 'a' ? '<span style="color:var(--gold-light);">我占先</span>' : e.res === 'b' ? '<span style="color:var(--red-light);">我受压</span>' : '<span style="color:var(--text-dim);">相持</span>';
        var dmgTxt = e.res === 'a' ? '<span class="pv-d" style="color:var(--red-light);">敌 -' + e.dmgB + '</span>'
          : e.res === 'b' ? '<span class="pv-d" style="color:var(--gold-light);">我 -' + e.dmgA + '</span>'
          : '<span class="pv-d" style="color:var(--text-dim);">互 -' + e.dmgA + '/' + e.dmgB + '</span>';
        h += '<div class="pv-row ' + (e.res === 'a' ? 'me' : e.res === 'b' ? 'him' : '') + '">'
          + '<span class="pv-r">第' + e.r + '合</span>'
          + '<span>' + ai + ' ' + U.escape(an) + '</span>'
          + '<span class="pv-vs">⚔</span>'
          + '<span>' + bi + ' ' + U.escape(bn) + '</span>'
          + resTxt + dmgTxt + '</div>';
      });
      h += '</div>';
      var ok = S.out && S.out.ok;
      h += '<div class="pv-result ' + (ok ? 'ok' : S.winner === 'draw' ? 'draw' : 'bad') + '">'
        + (ok ? '⚑ 挑衅得手' : S.winner === 'draw' ? '⚖ 两败俱伤' : '✖ 挑衅失手') + '</div>';
      h += '<div class="exp-info" style="margin-top:4px;color:' + (ok ? 'var(--gold-light)' : 'var(--red-light)') + ';">' + U.escape(S.out ? S.out.msg : '') + '</div>';
    }
    if (S.over) {
      h += '<div class="panel-foot"><button class="btn" data-action="provoke-again">再来一次</button>'
        + '　<button class="btn" data-action="close-modal">关闭</button></div>';
    } else {
      h += '<div class="panel-foot"><button class="btn" data-action="close-modal">撤退</button></div>';
    }
    h += '</div>';

    function _pvPlay() {
      try {
        var stage = document.querySelector('.pv-stage');
        if (!stage) return;
        var me = stage.querySelector('.pv-side.me .pv-active .pv-body');
        var him = stage.querySelector('.pv-side.him .pv-active .pv-body');
        if (!me && !him) return;
        var hf = stage.querySelector('.pv-hitflash');
        function _dmg(fig, val, crit) {
          if (!fig || !val || val <= 0) return;
          var d = document.createElement('div');
          d.className = 'pv-dmg' + (crit ? ' pv-dmg-crit' : '');
          d.textContent = (crit ? '暴击! -' : '-') + val;
          fig.parentNode.appendChild(d);
          setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
        }
        function _shake(big) {
          stage.classList.remove('pv-shake', 'pv-shake-big');
          void stage.offsetWidth;
          stage.classList.add(big ? 'pv-shake-big' : 'pv-shake');
        }
        var r = last ? last.res : null;
        if (r === 'a') {
          var _aA = (MV[last.am] && MV[last.am].skill) ? 'pv-act-skill' : ('pv-act-' + (last.am || 'stab'));
          if (me) setTimeout(function () { me.classList.add(_aA); }, 60);
          if (him) setTimeout(function () {
            him.classList.add('pv-hurt'); _shake(false);
            if (hf) { hf.classList.remove('pv-hitflash-on'); void hf.offsetWidth; hf.classList.add('pv-hitflash-on'); }
            _dmg(him, last.dmgB, false);
          }, 320);
        } else if (r === 'b') {
          var _aB = (MV[last.bm] && MV[last.bm].skill) ? 'pv-act-skill' : ('pv-act-' + (last.bm || 'stab'));
          if (him) setTimeout(function () { him.classList.add(_aB); }, 60);
          if (me) setTimeout(function () {
            me.classList.add('pv-hurt'); _shake(false);
            if (hf) { hf.classList.remove('pv-hitflash-on'); void hf.offsetWidth; hf.classList.add('pv-hitflash-on'); }
            _dmg(me, last.dmgA, false);
          }, 320);
        } else if (r === 'tie') {
          if (me) setTimeout(function () { me.classList.add('pv-act-stab'); }, 60);
          if (him) setTimeout(function () { him.classList.add('pv-act-stab'); }, 60);
          setTimeout(function () {
            if (me) me.classList.add('pv-hurt');
            if (him) him.classList.add('pv-hurt');
            _shake(true);
            if (hf) { hf.classList.remove('pv-hitflash-on'); void hf.offsetWidth; hf.classList.add('pv-hitflash-on'); }
            if (me) _dmg(me, last.dmgA, false);
            if (him) _dmg(him, last.dmgB, false);
          }, 320);
        }
      } catch (e) { /* 无布局/探针环境兜底：动画失败不影响战斗逻辑 */ }
    }
    ui.openModal(h);
    if (!S.over) _pvPlay();
  };

  ui._provokeTick = function () {
    var S = ui._provoke;
    if (!S || S.over) return;
    var D = DATA.DUEL || {}, MV = Object.assign({}, D.moves || {}, D.skills || {});
    GAME.battle.provokeStep(S, MV, D);
    if (S.over) {
      var _fn = ui._provokeNpc || ui._attackNpc;
      S.out = _fn ? GAME.battle.provokeFinalize(_fn, S) : { ok: false, msg: '目标城已失效，本次挑衅无收益' };
    }
    ui.openProvoke();
    if (!S.over) ui._provokeTimer = setTimeout(ui._provokeTick, (D.provokeAutoSpeed || 1100));
    else ui._provokeTimer = null;
  };

ui.openDuel = function (fid, moveId) {
    var st = GAME.state;
    if (!st || !GAME.faction) return;
    var D = DATA.DUEL || {}, MV = D.moves || {}, order = D.moveOrder || [];
    var need = D.playRounds || 5;
    var S = ui._duel;
    if (!S || S.fid !== fid) {
      var gens = (st.generals || []).filter(function (g) { return !g.dead; });
      S = ui._duel = { fid: fid, genId: gens.length ? gens[0].id : null, moves: [], seed: String(U.now()), res: null };
    }
    if (moveId && !S.res && S.moves.length < need) {
      S.moves.push(moveId);
      if (S.moves.length >= need) {
        var g0 = null;
        (st.generals || []).forEach(function (x) { if (x.id === S.genId) g0 = x; });
        var rival = GAME.faction.rivalOf(fid);
        S.res = GAME.battle.duelPlay(g0 || { id: 'me', name: '我军主将' }, rival, S.moves, S.seed);
        if (S.res && g0) {
          if (S.res.winner === 'atk') {
            g0.duelW = (g0.duelW || 0) + 1;
            /* v92.13：赢了就带 2 小时士气 —— 下次出征斗将没触发时，算他先声夺人 */
            g0.duelMoraleUntil = Date.now() + ((GAME.battle.MORALE_MS) || 7200000);
          } else if (S.res.winner === 'def') g0.duelL = (g0.duelL || 0) + 1;
        }
      }
    }
    var rival = GAME.faction.rivalOf(fid);
    var me = null;
    (st.generals || []).forEach(function (x) { if (x.id === S.genId) me = x; });

    var h = '<div class="gold-heading">⚔ 向 ' + U.escape((GAME.faction.defOf(fid) || {}).name || fid) + ' 叫阵</div>';
    h += '<div class="panel-body">';
    h += '<div class="exp-info exp-info-l" style="color:var(--text-dim);">'
      + '对手：<b>' + U.escape(rival.name) + '</b>（武 ' + rival.yw + ' · 谋 ' + rival.zm + ' · 统 ' + rival.tong + '）'
      + '　— 他的招式看不到，但**属性高的招他更爱出**。' + '</div>';

    /* 五合进度 */
    h += '<div style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap;">';
    for (var i = 0; i < need; i++) {
      var got = S.moves[i];
      h += '<span style="padding:3px 9px;border:1px solid var(--wood-light);border-radius:3px;font-size:var(--fs-cap);'
        + (got ? 'color:var(--gold-light);' : 'color:var(--text-dim);') + '">'
        + (got ? U.escape((MV[got] || {}).name || got) : ('第 ' + (i + 1) + ' 合')) + '</span>';
    }
    h += '</div>';

    if (!S.res) {
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
      order.forEach(function (mk) {
        var m = MV[mk] || {};
        h += '<button class="btn" data-action="duel-move" data-mv="' + mk + '" title="' + U.escape(m.note || '') + '">'
          + U.escape(m.name || mk) + '</button>';
      });
      h += '</div>';
      h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:8px;">'
        + '突刺克蓄力 · 格挡克突刺 · 佯攻克格挡 · 蓄力克佯攻（同招相持）。出满 ' + need + ' 合即结算，中途不能改。</div>';
    } else {
      h += '<table class="tbl"><thead><tr><th>合</th><th>你</th><th>他</th><th>结果</th></tr></thead><tbody>';
      S.res.rows.forEach(function (r) {
        h += '<tr><td class="num">' + r.r + '</td><td>' + U.escape(r.aName) + '</td><td>' + U.escape(r.bName) + '</td>'
          + '<td style="color:' + (r.res === 'a' ? 'var(--gold-light)' : r.res === 'b' ? 'var(--red-light)' : 'var(--text-dim)') + ';">'
          + (r.res === 'a' ? '占先' : r.res === 'b' ? '被压' : '相持') + '</td></tr>';
      });
      h += '</tbody></table>';
      h += '<div class="exp-info exp-info-l" style="margin-top:8px;color:var(--gold-light);">'
        + U.escape(S.res.winnerName) + ' 胜（' + S.res.wa + ' : ' + S.res.wb + '）'
        + '　· 履历：' + (me ? ((me.duelW || 0) + ' 胜 ' + (me.duelL || 0) + ' 负') : '—') + '</div>';
      h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);margin-top:6px;">'
        + (S.res.winner === 'atk'
          ? '　· 胜者已获 <b>2 小时士气</b>：这段时间他出征时，战前斗将若未触发，算我方先声夺人（+10% 属性）。'
          : '') + '</div>';
      h += '<div style="margin-top:8px;"><button class="btn" data-action="duel-with" data-fid="' + fid + '"'
        + ' data-reset="1">再来一场</button></div>';
    }
    h += '</div><div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h);
  };

  ui.openCampModal = function (ci) {
    var C = GAME.camp;
    if (!C) return;
    var w = C.at(ci);
    if (!w) { ui.toast('这里没有营地'); return; }
    var rec = C.found()[ci] || {};
    var mul = C.waryMul();
    var nRec = Math.max(1, Math.round(w.pop * mul));
    var h = '<div class="gold-heading">🏕 ' + U.escape(w.name) + '</div>';
    h += '<div class="panel-body">';
    if (rec.mode === 'recruit') {
      h += '<div class="q-empty">你从这里带走了 ' + U.numText(rec.n || 0, 0) + ' 人。营地空了。</div>';
    } else if (rec.mode === 'raid') {
      h += '<div class="q-empty">这里被洗劫一空。没有人会再来。</div>';
    } else {
      h += '<div class="exp-info exp-info-l">一处还在运转的幸存者聚落。他们不知道你是谁。</div>';
      h += '<div style="display:flex;gap:10px;margin:12px 0;flex-wrap:wrap;">'
        + '<button class="btn" data-action="camp-act" data-ci="' + ci + '" data-mode="recruit">'
        + '🤝 招募（+' + U.numText(nRec, 0) + ' 人）</button>'
        + '<button class="btn" data-action="camp-act" data-ci="' + ci + '" data-mode="raid">'
        + '🔥 洗劫（粮木石铁各 +' + U.numText(Math.round((w.loot || 0) / 4), 0) + '）</button>'
        + '</div>';
      h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);">'
        + '带走人 = 兵源；拿走物资 = 眼前的建设。两者只能选一个，选了就没有下一次。<br>'
        + '洗劫的消息会传开 —— 之后每一处营地愿意跟你走的人都会少一些'
        + (mul < 0.999 ? '（现在只剩 ' + Math.round(mul * 100) + '%）' : '（目前还没有人知道你的名声）')
        + '。</div>';
    }
    h += '</div><div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h);
  };

  /* ============================================================
   * v93.2：村社面板 —— 废土上还有别人在活
   * ------------------------------------------------------------
   * 三个按钮就是三种"你打算当什么人"：
   *   征召（要人，不算恶） / 保护（给粮，记恩） / 抢（拿物资，记仇）
   * 面板把**每种做法的后果**都摊开写，不藏 —— 藏了就成了抽卡。
   * ============================================================ */
  ui.openVillageModal = function (ci) {
    var V = GAME.village;
    if (!V) return;
    var w = V.at(ci);
    if (!w) { ui.toast('这里没有村社'); return; }
    if (!V.isKnown(ci)) { ui.toast('你还不知道这里有人住'); return; }
    var rec = V.get(ci);
    if (!rec) { ui.toast('这里没有村社'); return; }
    var d = (GAME.DATA && GAME.DATA.VILLAGE) || {};
    var h = '<div class="gold-heading">🏘 ' + U.escape(w.name) + '　<span style="font-size:var(--fs-cap);color:var(--text-dim);">' + U.escape(w.tierName) + '</span></div>';
    h += '<div class="panel-body">';

    if (rec.dead) {
      h += '<div class="q-empty">'
        + (rec.dead === 'fled'
          ? '空了。他们把能带的都带走了，门框上还留着挂过东西的印子。'
          : '没人了。屋顶塌了一半，风从里面穿过去。')
        + '</div>';
    } else {
      var moodText = rec.mood >= 60 ? '他们认得你的旗子，会点头' : rec.mood >= 30 ? '他们不冷不热地看着你' : '他们把孩子往身后藏';
      h += '<div class="exp-info exp-info-l">' + U.numText(Math.round(rec.pop), 0) + ' 人住在这里。' + moodText + '。</div>';
      if (rec.guardAt > 0) {
        h += '<div style="font-size:var(--fs-cap);color:var(--green-ok);margin-top:4px;">🛡 你护着这里（剩 '
          + Math.max(0, rec.guardAt - V.monthNow()) + ' 个月）—— 到期他们会把攒下的粮送来</div>';
      }
      /* v111：他们记得你做过什么 —— 两头都要写出来，不然"关系"只是个数 */
      if (rec.giftAt) {
        var _gm = V.monthNow() - rec.giftAt;
        if (_gm <= 12) {
          h += '<div style="font-size:var(--fs-cap);color:var(--gold-light);margin-top:3px;">🎁 '
            + _gm + ' 个月前他们把攒下的粮送来了 —— 他们记得你护过他们</div>';
        }
      }
      if (rec.raided) {
        var _rm = V.monthNow() - rec.raided;
        h += '<div style="font-size:var(--fs-cap);color:var(--red-bad);margin-top:3px;">🔥 '
          + (_rm <= 0 ? '你刚抢过这里' : _rm + ' 个月前你抢过这里')
          + ' —— 他们一直记得，人还在往外走</div>';
      }
      var will = (GAME.renown ? GAME.renown.willFollow() : 1) * ((GAME.convoy && GAME.convoy.toolMul) ? GAME.convoy.toolMul() : 1);
      var canCall = Math.max(1, Math.round(rec.pop * (d.callRate == null ? 0.3 : d.callRate) * will));
      var guardCost = Math.max(1, Math.round(rec.pop * (d.guardGrainPerPop == null ? 2 : d.guardGrainPerPop))) * (d.guardMonths == null ? 3 : d.guardMonths);
      var loot = Math.max(10, Math.round(rec.pop * (d.raidLootPerPop == null ? 3 : d.raidLootPerPop)));
      h += '<div style="display:flex;gap:10px;margin:12px 0;flex-wrap:wrap;">';
      h += '<button class="btn" data-action="village-act" data-ci="' + ci + '" data-vm="call"'
        + (rec.mood <= 20 ? ' disabled' : '') + '>👥 征召（带走 ' + U.numText(canCall, 0) + ' 人）</button>';
      h += '<button class="btn" data-action="village-act" data-ci="' + ci + '" data-vm="guard"'
        + (rec.guardAt > 0 ? ' disabled' : '') + '>🛡 保护（' + U.numText(guardCost, 0) + ' 粮 / '
        + (d.guardMonths == null ? 3 : d.guardMonths) + ' 个月）</button>';
      h += '<button class="btn" data-action="village-act" data-ci="' + ci + '" data-vm="raid">🔥 抢（粮木石铁各 +'
        + U.numText(Math.round(loot / 4), 0) + '）</button>';
      h += '</div>';
      h += '<div style="font-size:var(--fs-cap);color:var(--text-dim);line-height:1.6;">'
        + '· 征召：带走三成人。他们不会拦你，但也不会送你。<br>'
        + '· 保护：给粮，态度会变好；<b>到期他们会把攒下的粮送来</b>（按人口算）。<br>'
        + '· 抢：物资最多，但这一村**会散** —— 第二天就空了。名声也会跟着走，'
        + '而且<b>他们会一直记得是你抢的</b>（往后每月都有人往外走）。<br>'
        + '<span style="color:var(--gold-light);">这三种都收不回来。</span></div>';
    }
    h += '</div><div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(h);
  };

})();

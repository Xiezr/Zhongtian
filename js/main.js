/* ============================================================
 * main.js  启动入口、事件委托、动作分发、游戏主循环（真实数值版）
 * ============================================================ */
(function () {
  var GAME = window.GAME = window.GAME || {};
  var ui = GAME.ui;
  /* 本文件内的局部变量不与他人共享：用到就得自己声明。
     曾因缺 DATA/U 而在「背包点击物品」「自动存档」「侦查拾宝」等路径抛
     ReferenceError（被随机分支掩盖，长期未被发现）。 */
  var DATA = GAME.DATA, U = GAME.utils;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* --------- 动作分发 --------- */
  GAME.action = function (name, el) {
    switch (name) {
      case 'avatar-prev': ui.avatarShift(-1); break;
      case 'avatar-next': ui.avatarShift(1); break;
      case 'gender-set': ui.setGender(el.dataset.gender); break;
      case 'create-start': ui.doCreate(); break;
      case 'create-continue': ui.doContinue(); break;

      /* v70（老板需求 3/4）：城池坐标 —— 一键随机 / 坐标切换 */
      case 'city-move-ask': ui.openCityMoveAsk(); break;
      case 'city-move-do': GAME.doCityMove(); break;
      case 'city-random': GAME.doRandomCityMove(); break;
      case 'view': ui.setView(el.dataset.view); break;
      case 'page': ui.setPage(el.dataset.key, Number(el.dataset.n)); break;
      /* v20：弹窗内翻页 —— 重绘**弹窗**而非中央视图 */
      case 'mpage': ui.setModalPage(el.dataset.key, Number(el.dataset.n)); break;
      case 'open-wall': ui.openWallModal(); break;
      /* 行军队列（v18） */
      /* v26：v25 把「行军」提升为顶栏视图（data-view="marches"）后，
         这条 case 已无触发点，删除以免审计一直报不可达分支。
         ui.openMarches 仍在用（主循环启动与视图回调会调）。 */
      case 'march-recall': (function () {
        var r = GAME.march.recall(el.dataset.id);
        ui.toast(r.msg);
        ui.openMarches();
        GAME.refreshAll();
      })(); break;
      case 'march-rush': (function () {
        var r = GAME.march.rushAll();
        ui.toast(r.msg);
        ui.closeModal();
        GAME.refreshAll();
      })(); break;
      case 'toggle-auto-research': GAME.state.settings.autoResearch = !GAME.state.settings.autoResearch; GAME.refreshView(); break;
      case 'open-guanfu': ui.openGuanfu(); break;
      /* v73（老板需求 3）：种田秘境（官府 → 另外一个菜单）。
         播种 / 收获后**留在秘境里刷新** —— 地块状态变化要立刻看得见。 */
      case 'open-farm': ui.openFarm(); break;
      case 'farm-seeds': ui.openFarmSeeds(Number(el.dataset.idx)); break;
      case 'farm-plant': {
        var fpr = GAME.farmPlant(Number(el.dataset.idx), el.dataset.crop);
        ui.toast(fpr.msg);
        if (fpr.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }
      case 'farm-harvest': {
        var fhr = GAME.farmHarvest(Number(el.dataset.idx));
        ui.toast(fhr.msg);
        if (fhr.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }
      case 'farm-harvest-all': {
        var far = GAME.farmHarvestAll();
        ui.toast(far.msg);
        if (far.ok) { GAME.refreshAll(); ui.openFarm(); }
        break;
      }
      /* v45（需求 3）：城池下拉框（由 change 监听转交到此，见下方事件委托） */
      case 'switch-city': ui.setCity(el.value); GAME.refreshAll(); break;
      /* v25：说明浮层 / 城池改名 / 任务详情 */
      case 'show-help': ui.openHelp(el.dataset.help || ''); break;
      case 'open-rename-city': ui.openRenameCity(); break;
      case 'do-rename-city': {
        var rin = document.getElementById('rename-city-input');
        var rr = GAME.renameCity(GAME.currentCity().id, rin ? rin.value : '');
        ui.toast(rr.msg);
        if (rr.ok) { ui.closeModal(); GAME.refreshAll(); }
        break;
      }
      case 'quest-detail': ui.openQuestDetail(el.dataset.kind, el.dataset.id); break;
      /* v24（需求 4）：征收开在官府弹窗里 —— 结果只重绘弹窗，refreshView 只管中央视图 */
      case 'do-levy': {
        var rl = GAME.levy();
        ui.toast(rl.msg);
        if (rl.ok) { ui.openGuanfu(); GAME.refreshAll(); }
        break;
      }
      case 'build-city': (function () { var xy = ui._buildCityXY; if (!xy) return; var r = GAME.buildCityAt(xy.x, xy.y); ui.toast(r.msg); if (r.ok) { ui.closeModal(); GAME.refreshAll(); } })(); break;
      /* 工匠作坊 → 器械募兵面板（#14） */
      case 'open-siege': ui.openTroops(ui._trainBIdx, 'siege'); break;
      /* v62（老板）：工匠作坊 → 器械与工事（含造箭塔）。
         建造后重开面板：数量、上限、守备力三个数都要跟着刷新。 */
      case 'open-workshop': ui.openWorkshop(el.dataset.idx); break;
      case 'tower-build': {
        var tbR = GAME.buildTowers(el.dataset.city, Number(el.dataset.n) || 1);
        ui.toast(tbR.msg);
        if (tbR.ok) { GAME.refreshAll(); ui.openWorkshop(el.dataset.idx); }
        break;
      }
      /* v24（需求 8）：从某座军营进入募兵 —— 队列挂在它身上 */
      case 'open-troops': ui.openTroops(Number(el.dataset.idx), 'normal'); break;
      case 'toggle-garrison': ui._garrisonOpen = !(ui._garrisonOpen !== false); ui.renderSide(); break;
      /* v22：缩放按钮改为点选 chip（data-after="zoom"），这条 branch 已无触发点，删除 ——
         留着的坏处是 audit 会一直报「不可达分支」，掩盖真正的新问题。 */
      case 'wall-build': GAME.doBuildWall(); break;

      /* 原版三段式信息区 & 功能入口 */
      case 'open-lord': ui.openLordInfo(); break;
      /* v79（老板）：主城（官府里设；首设免费、迁都收成本） / 神器面板（君主菜单） */
      case 'set-main-city': {
        var mc = GAME.currentCity();
        var mr = GAME.setMainCity(mc ? mc.id : null);
        ui.toast(mr.msg);
        if (mr.ok) { GAME.refreshAll(); ui.openGuanfu(); }
        break;
      }
      case 'open-artifacts': ui.openArtifacts(); break;
      /* v77（老板）：君主面板 —— 进入城池（直跳该城城内界面）/ 晋升 / 改名 */
      case 'lord-city-enter': (function () {
        ui.closeModal();
        ui.setCity(el.dataset.city);
        ui.setView('city');
        GAME.refreshAll();
      })(); break;
      case 'lord-promote': GAME.doLordPromote(); break;
      case 'open-rename-lord': ui.openRenameLord(); break;
      case 'do-rename-lord': GAME.doRenameLord(); break;
      /* v77：附属野地下拉框（资源区）—— 选择即记录，进入按钮开野地界面 */
      case 'wild-pick': ui._wildSel = Number(el.value) || 0; break;
      /* v26：同上，「背包」已是顶栏视图（data-view="bag"）。ui.openBag 仍有调用点。 */
      /* v29（需求 16）：点席位卡切换"下方档案"的对象（不开弹窗，就地换内容） */
      case 'gen-pick': ui._genSel = el.dataset.gen; GAME.refreshView(); break;
      /* v26（需求 1）：将领详情内直接使用经验道具（不用跑去背包选对象）
         v54（老板）：入口从"左栏平铺每种道具两三个按钮"改成**经验条右端的「＋」** ——
         点 ＋ 开选择窗，选道具、选用法，和赏赐同一套做法。 */
      case 'gen-exp-pick': ui.openExpPick(el.dataset.gen); break;
      /* v74（老板需求 4/5）：六维「加点」＋ —— 自由属性点或道具 */
      case 'gen-stat-plus': ui.openStatPlus(el.dataset.gen, el.dataset.stat); break;
      case 'stat-plus-free': GAME.doStatPlusFree(el.dataset.gen, el.dataset.stat); break;
      case 'stat-plus-item': GAME.doStatPlusItem(el.dataset.item, el.dataset.gen, el.dataset.stat); break;
      /* v74（老板：完善出征界面）：全带 / 清空（只改输入框值，刷新仍走 updateExpMarch） */
      case 'exp-fill-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = i74.max;
        });
        ui.updateExpMarch();
      })(); break;
      case 'exp-clear-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = 0;
        });
        ui.updateExpMarch();
      })(); break;
      case 'exp-pick-item': ui.setExpItem(el.dataset.gen, el.dataset.item); break;
      case 'gen-exp-item': {
        var rgex = GAME.systems.gainExpByItem(el.dataset.item, el.dataset.gen, el.dataset.mode);
        ui.toast(rgex.msg);
        /* v41（需求 2）：原先这里"重开详情弹窗"来刷新数字；弹窗已撤，
           改为原地重绘当前视图（将领页右侧档案的数字立刻跟着变）。
           v54：用完还要把**选择窗**按新经验重画一遍 —— 否则「距升级还需」停在旧值。 */
        if (rgex.ok) {
          GAME.refreshView();
          /* v54：用完把**选择窗**按新经验重画一遍 —— 否则「距升级还需」停在旧值，
             玩家只能关掉重开。这里用 ui._modalKind 认窗（不用 querySelector：
             smoke 的 DOM stub 没有它，生产代码一律用 $('#id')）。 */
          if (ui._modalKind === 'exp') ui.openExpPick(el.dataset.gen);
        }
        break;
      }
      /* v52：赏赐从"每个珠宝一个按钮"改成「一个入口 + 选择窗」。
         三个动作：开选择窗 / 换珠宝 / 执行赏赐（可一次赏多件）。 */
      case 'gen-gift-pick': ui.openGiftPick(el.dataset.gen); break;
      case 'gift-pick-item': ui.setGiftItem(el.dataset.gen, el.dataset.item); break;
      case 'gen-gift-do':
        GAME.doGenGift(el.dataset.gen, el.dataset.item,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;
      /* 野地采集（v15） */
      case 'gather-open': ui.openGatherModal(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'open-gathers': ui.openGathers(); break;
      case 'gather-start': GAME.doStartGather(); break;
      case 'gather-finish': GAME.doFinishGather(el.dataset.id); break;
      case 'gather-abandon': GAME.doAbandonGather(el.dataset.id); break;
      case 'gather-locate': ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y)); ui.toast('已定位 (' + el.dataset.x + ',' + el.dataset.y + ')'); break;

      /* 野地管理（v23 · 需求 1）：驻军 / 撤军 / 放弃 */
      case 'wild-garrison-open': ui.openWildGarrison(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'wg-max': { var wi = document.getElementById('wg-' + el.dataset.troop); if (wi) wi.value = wi.max; break; }
      case 'wild-garrison-do': GAME.doWildGarrisonDo(); break;
      case 'wild-withdraw': {
        var wr = GAME.doWildWithdraw(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wr.msg);
        if (wr.ok) { ui.openLandModal(Number(el.dataset.x), Number(el.dataset.y)); GAME.refreshAll(); }
        break;
      }
      case 'wild-abandon-ask': ui.openAbandonWildAsk(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'wild-abandon-do': {
        var wa = GAME.doAbandonWild(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wa.msg);
        ui.closeModal();
        GAME.refreshAll();
        break;
      }
      /* v26（需求 5）：城内/城外 改由顶栏 data-view 切换，city-sub 已无触发点 */
      case 'bag-tab': ui.setBagTab(el.dataset.v); break;
      case 'bag-sort': ui.setBagSort(el.dataset.v); break;
      case 'open-mat-detail': ui.openMatDetail(el.dataset.key); break;
      case 'open-bp-detail': ui.openBpDetail(el.dataset.key); break;
      case 'salvage-equip': GAME.doSalvage(el.dataset.key); break;
      case 'use-bag-item': {
        /* v29（需求 14）：使用数量取本行输入框 */
        var qf = el.getAttribute('data-qty-from');
        GAME.doBagUse(el.dataset.key, qf ? ui.qtyValueOf(qf) : 1);
        break;
      }
      case 'open-bag-equip': GAME.doBagEquip(el.dataset.key); break;
      case 'bag-detail': GAME.doBagDetail(el.dataset.key); break;
      case 'claim-rand-quest': GAME.doClaimRandQuest(el.dataset.q); break;
      case 'reroll-rand-quest': GAME.doRerollRandQuest(el.dataset.q); break;
      case 'reroll-all-rand': GAME.doRerollAllRand(); break;
      case 'toggle-done-quests': ui._showDone = !ui._showDone; ui.renderView('tasks'); break;
      /* v77（老板）：建筑信息 / 资源生产两个入口随城池属性右三按钮一并退役；
         「附属野地」改由资源区下拉框的「进入」按钮触发（动作名不变）。 */
      case 'open-wilds': ui.openWilds(); break;
      case 'map-pan': ui.mapPan(Number(el.dataset.dx), Number(el.dataset.dy)); break;
      case 'map-goto': ui.mapGoto(); break;
      case 'map-center': ui.mapCenter(); break;
      case 'map-capital': ui.mapCenterOn(265, 215); ui.toast('已定位至洛阳 (265,215)'); break;
      case 'open-inn': ui.openInn(); break;
      case 'open-forge': ui.openForge(); break;
      /* v77：百炼强化（铁匠铺底栏入口 + 装备详情入口） */
      case 'open-enhance': ui.openEnhance(); break;
      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;
      case 'forge-item': GAME.doForge(el.dataset.item); break;
      case 'open-hostel': ui.openHostel(); break;
      case 'open-market': ui.openMarket(); break;
      case 'open-store': ui.openStore(); break;
      case 'open-panel': ui.openPanel(el.dataset.view); break;
      case 'inn-recruit': GAME.doInnRecruit(el.dataset.id); break;
      case 'inn-reroll': GAME.doInnReroll(); break;
      case 'mk-preset': { var mkIn = document.getElementById('mk-amount'); if (mkIn) mkIn.value = el.dataset.v; break; }
      case 'market-trade': GAME.doMarketTrade(); break;
      /* v26：同上，「商城」已是顶栏视图（data-view="shop"）。 */
      case 'quick-item': ui.openQuickItem(el.dataset.res); break;
      case 'use-item-quick': GAME.doUseItemQuick(el.dataset.item); break;
      /* v29（需求 14）：数量以**本行输入框**为准（不再有全局的"购买数量"档位） */
      case 'shop-buy': {
        var sbId = 'sq-' + el.dataset.item;
        GAME.doShopping(el.dataset.item, ui.qtyValueOf(sbId));
        break;
      }
      /* v29（需求 14）：数量输入框的 −/＋ 与「最多」——只改输入框的值，不重绘 */
      case 'qty-step': ui.qtyStep(el); break;
      case 'qty-max': ui.qtyMax(el); break;
      /* 商城分类（v18：固定网格 + 分类页签） */
      case 'shop-cat': ui.setShopCat(el.dataset.c); break;
      /* v29（需求 12）：铁匠铺品质页签 */
      case 'forge-q': ui.setForgeQ(el.dataset.q); break;
      case 'msg-channel': ui.setMsgChannel(el.dataset.ch); break;

      /* 城内建筑 */
      case 'build-cell': {
        /* v19：移动模式下点击地块 = 选终点（与空地「搬过去」/ 与建筑「互换」） */
        var mvFrom = ui._moveFrom;
        if (mvFrom != null && mvFrom !== Number(el.dataset.idx)) { ui.openMoveConfirm(mvFrom, Number(el.dataset.idx)); }
        else ui.openBuildModal(Number(el.dataset.idx));
        break;
      }
      case 'move-ask': ui._moveFrom = Number(el.dataset.idx); ui.closeModal(); ui.toast('请点击要移动/交换到的地块（Esc 取消）'); break;
      case 'move-cancel': ui._moveFrom = null; ui.toast('已取消移动'); break;
      case 'move-do': {
        var mm = GAME.moveBuilding(GAME.currentCity().id, Number(el.dataset.from), Number(el.dataset.to));
        ui._moveFrom = null;
        ui.toast(mm.msg);
        if (mm.ok) ui.closeModal();
        GAME.refreshAll();
        break;
      }
      case 'confirm-build': GAME.doBuild(Number(el.dataset.idx), el.dataset.build); break;
      case 'confirm-upgrade': GAME.doUpgrade(Number(el.dataset.idx)); break;
      case 'demolish-ask': ui.openDemolishConfirm(el.dataset.kind, Number(el.dataset.idx)); break;
      case 'demolish-do': GAME.doDemolishDo(el.dataset.kind, Number(el.dataset.idx)); break;
      case 'cancel-build': GAME.doCancelBuild(el.dataset.kind, Number(el.dataset.idx)); break;

      /* 造兵 */
      /* v20：募兵面板在弹窗里 —— 必须重绘**弹窗**，refreshView 只重绘中央视图 */
      case 'select-train': ui._trainSel = el.dataset.troop; ui.renderTroopsModal(); break;
      /* v28（需求 5）：上限 —— 按可用人口与资源的短板一次填满 */
      case 'train-max': {
        var cMx = GAME.currentCity();
        ui._trainCount = Math.max(1, GAME.maxTrainCount(ui._trainSel, cMx.id, ui._trainBIdx));
        var _m = GAME.maxTrainCount(ui._trainSel, cMx.id, ui._trainBIdx);
        if (_m <= 0) ui.toast('人口或资源不足，当前无法募兵');
        else ui.toast('已填上限：' + GAME.utils.numText(_m, 0) + '（受人口与资源短板限制）');
        ui.renderTroopsModal();
        break;
      }
      /* v28（需求 8）：募兵加速 */
      case 'train-boost': ui.openTrainBoost(Number(el.dataset.idx)); break;
      case 'do-train-boost': GAME.doBoostTrain(el.dataset.item, Number(el.dataset.idx)); break;
      case 'train-locked': ui.toast('尚不可训练：' + (el.dataset.why || '条件未满足') + '（升级军营/书院、占领对应州城可解锁）'); break;
      case 'train-qty': GAME.adjustTrainQty(Number(el.dataset.d)); break;
      case 'confirm-train': GAME.doTrain(el.dataset.troop); break;

      /* 将领 */
      case 'assign-guard': GAME.doAssignGuard(el.dataset.gen); break;
      /* v41（需求 2）：gen-detail / gen-equip 两个弹窗入口已撤 —— 完整档案与人形
         装备栏现在都在将领页右侧（ui.genPane），不再跳弹窗。
         此处原有两个分支（详情弹窗 / 装备弹窗），已删除。 */
      case 'eq-slot': ui.openEqSlot(el.dataset.gen, el.dataset.slot); break;
      case 'gen-equip-item': GAME.doGenEquipItem(el.dataset.gen, el.dataset.key); break;
      case 'gen-unequip': GAME.doGenUnequip(el.dataset.gen, el.dataset.slot); break;
      case 'gen-auto-equip': GAME.doGenAutoEquip(el.dataset.gen); break;
      case 'gen-unequip-all': GAME.doGenUnequipAll(el.dataset.gen); break;
      case 'dismiss-gen': ui.openDismissConfirm(el.dataset.gen); break;
      case 'dismiss-gen-do': GAME.doDismissGen(el.dataset.gen); break;

      /* 城外资源建筑 */
      case 'ext-cell': ui.openExtModal(Number(el.dataset.idx)); break;
      case 'ext-build': GAME.doExtBuild(Number(el.dataset.idx), el.dataset.eid); break;
      case 'ext-upgrade': GAME.doExtUpgrade(Number(el.dataset.idx)); break;
      case 'ext-convert-ask': ui.openExtConvert(Number(el.dataset.idx)); break;
      case 'ext-convert': (function () {
        var rr = GAME.convertExt(Number(el.dataset.idx), el.dataset.eid);
        ui.toast(rr.msg);
        if (rr.ok) { ui.closeModal(); GAME.refreshAll(); }
      })(); break;

      /* 装备 */
      case 'equip-item': GAME.doEquip(el.dataset.gen, el.dataset.item); break;
      case 'unequip-item': GAME.doUnequip(el.dataset.gen, el.dataset.slot); break;

      /* 科技 */
      case 'tech-research': GAME.doResearch(el.dataset.tech); break;

      /* 宝物 */
      /* v22：宝物改为顶部统一选「使用对象」，按钮不带 data-gen → 回退到 ui._itemGen */
      case 'use-item': {
        /* v29：数量改由调用处的输入框决定，这里回退 1（该入口在宝物详情弹窗里） */
        var uf = el.getAttribute('data-qty-from');
        GAME.doUseItem(el.dataset.item,
          el.dataset.gen || ui._itemGen || ((GAME.state.generals[0] || {}).id),
          uf ? ui.qtyValueOf(uf) : 1);
        break;
      }

      /* 点选控件（v22 · 需求 1：全站不用下拉框）
         v45 例外：**城池切换**改用原生 `<select>`（见上面的 change 监听）——
         可选项会随游戏进程增长，窄侧栏里 chips 折行反而更占地方。
         除它之外仍然不用下拉框。 */
      /* v59：出征战术（校场入口 / 点选 / 恢复默认） */
      case 'open-tactic': ui.openTacticModal(); break;
      /* v60（需求 4）：城池面板与城池间调拨 ——
         地图上点自家城池先弹面板（不直接进城），面板里再进 / 运 / 派 / 改名。
         chips 一律"只切 class + 写选择"，需要刷新数字的走 ui.syncTransportEst。 */
      case 'city-enter': {
        var ceId = el.dataset.city, ceC = GAME.cityById(ceId);
        if (!ceC) { ui.toast('城池不存在'); break; }
        ui.setCity(ceId);
        GAME.refreshAll();
        ui.toast('已进入 ' + ceC.name);
        break;
      }
      case 'city-transport': ui.openTransport(el.dataset.city); break;
      case 'city-dispatch': ui.openDispatch(el.dataset.city); break;
      case 'city-rename': {
        /* 改名弹窗作用于**当前城** —— 先切过去再开，避免改错城 */
        ui.setCity(el.dataset.city);
        ui.openRenameCity();
        break;
      }
      /* v67（老板）：放弃城池 —— 先二次确认（不可逆），确认后走 GAME.abandonCity
         （业务侧照 CITY_SCOPED 表批量清理，界面不自己动数据）。 */
      case 'city-abandon-ask': ui.openAbandonCityAsk(el.dataset.city); break;
      case 'city-abandon-do': {
        var acR = GAME.abandonCity(el.dataset.city);
        ui.toast(acR.msg);
        if (acR.ok) { ui.closeModal(); GAME.refreshAll(); }
        else { ui.openAbandonCityAsk(el.dataset.city); }
        break;
      }
      case 'tr-to': {
        ui.chipSet(el);
        ui.setTrTo(el.dataset.i, el.dataset.v);
        break;
      }
      case 'tr-key': {
        ui.chipSet(el);
        ui.setTrKey(el.dataset.i, el.dataset.v);
        break;
      }
      case 'tr-pct': {
        ui.chipSet(el);
        ui.setTrPct(el.dataset.i, el.dataset.v);
        break;
      }
      case 'tr-do': ui.doTransport(); break;
      case 'dp-gen': ui.setDpGen(el.dataset.i, el.dataset.v); break;
      case 'dp-to': ui.setDpTo(el.dataset.i, el.dataset.v); break;
      case 'dp-do': ui.doDispatch(); break;
      /* v60（需求 5）：名城专属选项（征调 / 犒军 / 建制）——
         执行后重开面板，冷却与代价措辞随新状态刷新。 */
      case 'city-opt': {
        var coR = GAME.doCityOpt(el.dataset.city, el.dataset.opt);
        ui.toast(coR.msg);
        if (coR.ok) { GAME.refreshAll(); ui.openCityPanel(GAME.cityById(el.dataset.city)); }
        break;
      }
      /* v60（需求 4）：将领页的"本城 / 全境"范围切换 —— 名单变了必须重绘 */
      case 'gen-scope': {
        ui.chipSet(el);
        ui._genScope = el.dataset.v;
        ui.renderView('generals');
        break;
      }
      case 'tactic-set': {
        /* 点选即存：同组互斥只切 class、不重绘（与全站点选一致） */
        var tg = el.dataset.g;
        if (tg) {
          var same = document.querySelectorAll('[data-action="tactic-set"][data-g="' + tg + '"]');
          for (var ti = 0; ti < same.length; ti++) same[ti].classList.toggle('on', same[ti] === el);
        }
        var tp = {};
        if (el.dataset.f === 's') tp.s = el.dataset.v;
        else if (el.dataset.f === 't') tp.t = el.dataset.v;
        GAME.setTactic(el.dataset.troop, tp);
        break;
      }
      case 'tactic-reset': {
        var rrT = GAME.clearTactics();
        ui.toast(rrT.msg);
        ui.openTacticModal();
        break;
      }
      case 'chip-set': {
        ui.chipSet(el);
        var after = el.dataset.after;
        if (after === 'city') { ui.setCity(el.dataset.v); GAME.refreshAll(); }
        /* v77（老板）：资源生产入口退役 —— 开工率调整 UI（after='workrate'）一并下线，
           机制与取值保留在 state.workRate（默认 100%，产物照常计算）。 */
        else if (after === 'region') ui.setCreate();
        else if (after === 'zoom') GAME.doSetZoom(Number(el.dataset.v));
        /* v29（需求 5）：设置里的时间倍率/税率也改用同一套点选控件 */
        else if (after === 'timescale') GAME.doSetTimeScale(Number(el.dataset.v));
        else if (after === 'tax') GAME.doSetTax(Number(el.dataset.v));
        /* v39（需求 1）：界面主题 —— 立即改 html[data-theme]，全站 CSS 变量随之切换 */
        else if (after === 'theme') GAME.doSetTheme(el.dataset.v);
        /* v29（需求 5）：自动出征参数（字段名走 data-k） */
        else if (after === 'automarch') GAME.doSetAutoMarch(el.dataset.k, el.dataset.v);
        break;
      }

      /* 爵位 */
      case 'promote': GAME.doPromote(); break;

      /* 设置 */
      case 'toggle-auto-upgrade': GAME.doToggleAutoUpgrade(); break;
      case 'forge-kind': ui.setForgeKind(el.dataset.k); break;
      /* v51：套装效果表从打造面板正文移到独立小窗（正文腾出 105px 才放得下两行卡片） */
      case 'forge-setinfo': ui.openForgeSetInfo(); break;
      case 'toggle-auto-march': GAME.doToggleAutoMarch(); break;
      case 'auto-march-once': GAME.doAutoMarchOnce(); break;
      /* v40：`case 'set-timescale'` / `case 'set-tax'` 已删 ——
         v22 起税率与倍率改走 `chip-set + data-after='tax'/'timescale'`，
         这两个旧分支在界面上查无触发点（audit 会一直报"不可达分支"）。 */
      /* 校场（v21 需求 1：伤兵营归属军事建筑与行军，不再挂设置） */
      case 'open-xiaochang': ui.openXiaochang(); break;
      case 'xiaochang-exp': ui.closeModal(); ui.setView('map'); break;
      case 'heal-wounded': GAME.doHeal(); break;

      /* 任务 */
      case 'claim-quest': GAME.doClaimQuest(el.dataset.q); break;

      /* 出征（城/野地） */
      case 'exp-open': GAME.doOpenExp(el.dataset.kind); break;
      case 'fort-exp': GAME.doOpenFortExp(); break;
      case 'fort-goto': ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y)); ui.toast('已定位 (' + el.dataset.x + ',' + el.dataset.y + ')'); break;
      case 'fort-pick': {
        var ff = GAME.map.fortAt(Number(el.dataset.x), Number(el.dataset.y));
        if (ff) ui.openExpModal({ kind: 'fort', x: ff.x, y: ff.y }); else ui.toast('此处已无据点');
        break;
      }
      case 'exp-mode': ui.setExpMode(el.dataset.v); break;
      case 'exp-max': { var ei = document.getElementById('exp-' + el.dataset.troop); if (ei) ei.value = ei.max; break; }
      case 'exp-confirm': GAME.doExpConfirm(); break;

      /* 统计页：切到指定城池（v23 · 需求 5） */
      case 'stats-goto': {
        ui.setCity(el.dataset.city);
        ui.setView('city');
        var tc = GAME.currentCity();
        if (tc) ui.toast('已切换到 ' + tc.name);
        break;
      }
      case 'view-report': ui.viewReport(Number(el.dataset.i)); break;
      case 'close-modal': ui.closeModal(); break;
      /* v65：侦查回报面板分两页（满级六层内容装不进一个弹窗） */
      case 'scout-page':
        if (ui._scoutLast) {
          ui.openScoutResult(ui._scoutLast.target, ui._scoutLast.r,
            Number(el.getAttribute('data-v')) || 0);
        }
        break;


      /* v67 · 存档管理 */
      case 'open-saves': ui.openSaveManager(); break;
      case 'save-slot-write': {
        var r1 = GAME.saveTo(el.getAttribute('data-slot'));
        ui.toast(r1.ok ? ('💾 ' + r1.msg) : r1.msg);
        if (r1.ok) ui.openSaveManager();
        break;
      }
      case 'save-slot-load': ui.openLoadSlotAsk(el.getAttribute('data-slot')); break;
      case 'save-slot-load-do': GAME.doLoadSlot(ui._svLoadTarget); break;
      case 'save-slot-drop': ui.openDropSlotAsk(el.getAttribute('data-slot')); break;
      case 'save-slot-drop-do': {
        var r2 = GAME.dropSlot(ui._svDropTarget);
        ui.toast(r2.msg);
        if (r2.ok) ui.openSaveManager();
        break;
      }
      case 'save-slot-export': GAME.doExportSlot(el.getAttribute('data-slot')); break;
      case 'save-import-toggle': ui._svPaste = !ui._svPaste; ui.openSaveManager(); break;
      case 'save-import-file': GAME.doImportPick(); break;
      case 'save-import-text': {
        var ta = $('#sv-paste');
        if (!ta) break;
        var r3 = GAME.importText(ta.value, null);
        ui.toast(r3.ok ? ('📥 ' + r3.msg) : r3.msg);
        if (r3.ok) { ui._svPaste = false; ui.openSaveManager(); }
        break;
      }
      case 'save': GAME.doSave(); break;
      case 'new-game': GAME.doNewGame(); break;
      default: break;
    }
  };

  /* ============================================================
   * v67 · 存档系统的业务动作（界面只发 data-action，逻辑都在这儿）
   * ============================================================ */
  GAME.doLoadSlot = function (slotId) {
    var st = GAME.loadFrom(slotId);
    if (!st) { ui.toast('读取失败：该槽位为空，或存档版本不符'); return; }
    ui.closeModal();
    var s = GAME.slotOf(slotId);
    ui.enterLoaded('📂 已载入「' + (s ? s.name : slotId) + '」');
  };
  /* 导出为文件。文本本身就是完整存档（含 _fmt/_ver/_check 自描述头），
     所以"另存为文件"与"粘贴文本"是同一份东西 —— 不用维护两种格式。 */
  GAME.doExportSlot = function (slotId) {
    var r = GAME.exportText(slotId);
    if (!r.ok) { ui.toast(r.msg); return; }
    try {
      var d = new Date();
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var fn = 'sanguo-' + r.name + '-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
      var blob = new Blob([r.text], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = fn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      ui.toast('📤 已导出 ' + fn + '（' + (r.text.length / 1024).toFixed(1) + 'KB）');
    } catch (e) {
      ui.toast('导出失败：' + ((e && e.message) || '浏览器不支持下载'));
    }
  };
  GAME.doImportPick = function () {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json,text/plain';
    /* ⚠️ 用 addEventListener 而不是 `inp.onchange = …`：audit.js 把
       "赋给对象属性的函数"记成一个具名函数（inp.onchange / reader.onerror），
       然后报"无任何引用"→ 死函数 +2。这俩是**事件处理器**不是死代码。 */
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.addEventListener('load', function () {
        var r = GAME.importText(String(reader.result), null);
        ui.toast(r.ok ? ('📥 ' + r.msg) : ('导入失败：' + r.msg));
        if (r.ok) { ui._svPaste = false; ui.openSaveManager(); }
      });
      reader.addEventListener('error', function () { ui.toast('文件读取失败'); });
      reader.readAsText(f);
    });
    inp.click();
  };

  /* 野外城池出征（三方式） */
  GAME.doOpenFortExp = function () {
    var f = ui._fortTarget;
    if (!f) { ui.toast('未选择野外城池'); return; }
    ui.openExpModal({ kind: 'fort', x: f.x, y: f.y });
  };

  /* --------- 业务动作 --------- */
  GAME.doBuild = function (idx, buildId) {
    var c = GAME.currentCity();
    var r = GAME.buildAt(c.id, idx, buildId);
    ui.toast(r.msg); if (r.ok) ui.closeModal();
    GAME.refreshAll();
  };
  GAME.doUpgrade = function (idx) {
    var c = GAME.currentCity();
    var r = GAME.upgradeAt(c.id, idx);
    ui.toast(r.msg); if (r.ok) ui.closeModal();
    GAME.refreshAll();
  };
  /* 拆毁二次确认 */
  GAME.doDemolishDo = function (kind, idx) {
    var r = kind === 'ext' ? GAME.demolishExt(idx) : GAME.demolishAt(GAME.currentCity().id, idx);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };
  GAME.doCancelBuild = function (kind, idx) {
    var cur = GAME.currentCity();
    var r = GAME.cancelBuild(kind, idx, cur ? cur.id : null);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };
  /* 资源栏「+」快捷用宝物 */
  GAME.doUseItemQuick = function (itemId) {
    var r = GAME.systems.useItem(itemId);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };
  /* v74（老板需求 5）：自由属性点分配（唯一出口 GAME.addFreePoint）；分配后留在弹窗里刷新 */
  GAME.doStatPlusFree = function (genId, stat) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var r = GAME.addFreePoint(g, stat);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };
  /* v74：用永久丹药加点（复用 useItem 的 perm 分支与 50 上限） */
  GAME.doStatPlusItem = function (itemId, genId, stat) {
    var r = GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openStatPlus(genId, stat); }
  };
  /* 募兵加速（v28 · 需求 8）：消费宝物 → 缩短该营当前批次 */
  GAME.doBoostTrain = function (itemId, bIdx) {
    var c = GAME.currentCity();
    var r = GAME.systems.boostTrainQueue(itemId, c.id, bIdx);
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      /* 加速后留在弹窗里刷新 —— 让"剩余时间变短了"直接看得见，
         而不是关掉弹窗再自己去找（本项目吃过"点了没反应"的亏）。 */
      ui.openTrainBoost(bIdx);
    }
  };

  /* 商城购买（黄金结算：元宝价×100） */
  GAME.doShopping = function (itemId, qty) {
    var s = GAME.state;
    var item = GAME.systems.itemInfo(itemId);
    if (!item) { ui.toast('未知物品'); return; }
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var price = (item.price || 0) * 100;
    /* v28（需求 6）：**买得起几个就买几个**，而不是"差一点就一口拒绝"。
       按「最多」时只可能被黄金卡住，这时买满能买的并说明差多少，
       比抛一句"黄金不足"有用得多。 */
    var can = Math.min(qty, Math.floor((s.res.gold || 0) / Math.max(1, price)));
    if (can <= 0) {
      ui.toast('黄金不足（单价 ' + GAME.utils.fmt(price) + ' 金，现有 '
        + GAME.utils.fmt(s.res.gold || 0) + '）');
      return;
    }
    s.res.gold -= price * can;
    s.items[itemId] = (s.items[itemId] || 0) + can;
    GAME.log('商城购买：' + item.name + (can > 1 ? ' ×' + can : ''));
    ui.toast('购买 ' + item.name + ' ×' + can + '（-' + GAME.utils.fmt(price * can) + ' 金）'
      + (can < qty ? '　黄金只够买 ' + can + ' 个' : ''));
    GAME.refreshAll();
    ui.renderShop();          // 只重绘商城（保留当前分类与页码，不要跳回第一页）
  };
  /* v77（老板）：doJumpCell（建筑信息 → 定位地块）与 doSetWorkRate（开工率调整）
     随「建筑信息 / 资源生产」两个入口退役 —— 城内地块本就点得到，无须跳转器。 */
  /* --------- 自动出征（v29 · 需求 5） --------- */
  GAME.doToggleAutoMarch = function () {
    var cfg = GAME.autoMarchCfg();
    if (!cfg) return;
    cfg.on = !cfg.on;
    if (cfg.on) {
      /* 没指定将领时自动挑一个空闲的 —— 否则"开了却永远不动"，很难查 */
      var s = GAME.state;
      if (!cfg.genId || !(s.generals || []).some(function (g) { return g.id === cfg.genId; })) {
        var idle = (s.generals || []).filter(function (g) { return !g.status || g.status === 'idle'; });
        cfg.genId = (idle[0] || s.generals[0] || {}).id || null;
      }
      cfg.last = 0;                       // 开启即视为"该执行了"
      s.autoMarchInfo = { ok: true, msg: '已开启，待命', at: U.now() };
      ui.toast('⚔️ 自动出征已开启（每 ' + cfg.everyMin + ' 分钟一次）');
    } else {
      GAME.state.autoMarchInfo = { ok: false, msg: '已关闭', at: U.now() };
      ui.toast('自动出征已关闭');
    }
    GAME.refreshView();
  };
  GAME.doSetAutoMarch = function (k, v) {
    var cfg = GAME.autoMarchCfg();
    if (!cfg || !k) return;
    if (k === 'troops' || k === 'maxLevel' || k === 'everyMin') cfg[k] = Number(v);
    else cfg[k] = String(v);
    /* 目标类型变了，等级上限沿用旧值可能"一个目标都找不到"，
       这里不动玩家设的等级，只把提示写清楚（面板里本来就列着等级）。 */
    GAME.refreshView();
  };
  GAME.doAutoMarchOnce = function () {
    var r = GAME.autoMarchOnce();
    GAME.state.autoMarchInfo = { ok: r.ok, msg: r.msg, at: U.now() };
    ui.toast((r.ok ? '✅ ' : '⏸ ') + r.msg);
    if (r.ok) GAME.refreshAll(); else GAME.refreshView();
  };

  /* 自动升级开关 */
  GAME.doToggleAutoUpgrade = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoUpgrade = !s.settings.autoUpgrade;
    if (s.settings.autoUpgrade) {
      s.autoState = { paused: false, msg: '已开启，待命' };
      ui.toast('🔨 自动升级已开启（按等级从低到高）');
      GAME.autoUpgrade();
    } else {
      s.autoState = null;
      ui.toast('自动升级已关闭');
    }
    /* v38（需求 1）：**不再跳转设置页** —— 自动化只有「自动」菜单这一条路径。
       原写法不管从哪儿点都会把玩家送到设置页（v36 已把设置页的开关撤走，
       于是"跳过去也看不到开关"，只剩困惑）。这里只原地重绘本视图。 */
    GAME.refreshView();
  };

  /* ---------- 背包动作 ---------- */
  GAME.doBagUse = function (itemId, qty) {
    /* v28（需求 6）：支持一次用 N 个 */
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var genId = (GAME.state.generals[0] || {}).id;
    var r = qty > 1
      ? GAME.systems.useItemMany(itemId, genId, qty)
      : GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg || (r.ok ? '已使用' : '使用失败'));
    if (r.ok) { ui.openBag('item'); GAME.refreshAll(); }
  };
  GAME.doBagDetail = function (itemId) {
    var it = DATA.EQUIP[itemId];
    if (it) { ui.openEquipDetail(itemId); return; }
    if (DATA.MATERIAL_BY_ID && DATA.MATERIAL_BY_ID[itemId]) { ui.openMatDetail(itemId); return; }
    var isBp = (DATA.BLUEPRINTS || []).some(function (b) { return b.id === itemId; });
    if (isBp) { ui.openBpDetail(itemId); return; }
    ui.openItemDetail(itemId);
  };
  /* ---------- 将领装备栏 ---------- */
  GAME.doGenEquipItem = function (genId, itemId) {
    var r = GAME.systems.equipItem(genId, itemId);
    ui.toast(r.msg || (r.ok ? '已装备' : '装备失败'));
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  GAME.doGenUnequip = function (genId, slot) {
    var r = GAME.systems.unequipItem(genId, slot);
    ui.toast(r.msg || (r.ok ? '已卸下' : '卸下失败'));
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  GAME.doGenAutoEquip = function (genId) {
    var r = GAME.systems.autoEquipBest(genId);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  GAME.doGenUnequipAll = function (genId) {
    var r = GAME.systems.unequipAll(genId);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  /* 解雇（二次确认） */
  /* v70（老板需求 3/4）：迁址（坐标切换）与一键随机 —— 唯一执行都走 GAME.moveCityTo */
  GAME.doCityMove = function () {
    var el1 = document.getElementById('move-x'), el2 = document.getElementById('move-y');
    var cur = GAME.currentCity();
    var id = ui._cityMoveId || (cur && cur.id);
    var r = GAME.moveCityTo(id, el1 ? el1.value : NaN, el2 ? el2.value : NaN);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
    }
  };
  GAME.doRandomCityMove = function () {
    var r = GAME.randomMoveCity();
    ui.toast(r.msg);
    if (r.ok) {
      if (ui.view === 'map' && ui.renderMapCanvas) ui.renderMapCanvas();
      GAME.refreshAll();
    }
  };

  GAME.doDismissGen = function (genId) {
    var r = GAME.dismissGeneral(genId);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };

  /* v78（老板需求 3）：doEquipTo 随「穿给谁」一起退役 ——
     穿戴改由将领侧两个既有出口完成（将领档案点部位 / 装备页选将）。 */
  /* 拆解装备回收材料 */
  GAME.doSalvage = function (itemId) {
    var r = GAME.salvageEquip(itemId);
    ui.toast(r.msg);
    if (r.ok) { ui.openBag('equip'); GAME.refreshAll(); }
  };

  GAME.doBagEquip = function (itemId) {
    var s = GAME.state;
    var g = s.generals[0];
    if (!g) { ui.toast('尚无将领'); return; }
    var r = GAME.systems.equipItem(g.id, itemId);
    ui.toast(r.msg || (r.ok ? '已装备' : '装备失败'));
    if (r.ok) { ui.openBag('equip'); GAME.refreshAll(); }
  };

  /* ---------- 随机任务 ---------- */
  GAME.doClaimRandQuest = function (id) {
    var r = GAME.claimRandomQuest(id);
    ui.toast(r.msg);
    ui.renderView('tasks'); GAME.refreshAll();
  };
  GAME.doRerollRandQuest = function (id) {
    var r = GAME.rerollRandomQuest(id);
    ui.toast(r.msg);
    if (r.ok) ui.renderView('tasks');
  };
  GAME.doRerollAllRand = function () {
    var r = GAME.rerollAllRandomQuests();
    ui.toast(r.msg);
    if (r.ok) ui.renderView('tasks');
  };

  /* 铁匠铺打造 */
  GAME.doForge = function (itemId) {
    var r = GAME.forge(itemId);
    ui.toast(r.msg);
    if (r.ok) { ui.openForge(); GAME.refreshAll(); }
  };

  /* 客栈招募 / 相亲 */
  GAME.doInnRecruit = function (cid) {
    /* v64：把**当前城**传进去 —— 客栈在城里，席位也在城里 */
    var c = GAME.currentCity();
    var r = GAME.innRecruit(cid, c ? c.id : null);
    ui.toast(r.msg);
    if (r.ok) { ui.openInn(); GAME.refreshAll(); }
  };
  GAME.doInnReroll = function () {
    var r = GAME.innReroll();
    ui.toast(r.msg);
    if (r.ok) ui.openInn();
  };
  /* 市场兑换 */
  GAME.doMarketTrade = function () {
    var f = document.getElementById('mk-from'), t = document.getElementById('mk-to'), a = document.getElementById('mk-amount');
    if (!f || !t || !a) return;
    if (f.value === t.value) { ui.toast('请选择不同的资源'); return; }
    var r = GAME.marketTrade(f.value, t.value, Number(a.value) || 0);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
  };

  GAME.doExtBuild = function (idx, eid) {
    var r = GAME.buildExt(idx, eid);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };
  GAME.doExtUpgrade = function (idx) {
    var r = GAME.upgradeExt(idx);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); GAME.refreshAll(); }
  };
  /* v20：数量走 ui._trainCount 状态；加减后重绘**弹窗**（原先 refreshView 只重绘中央视图） */
  GAME.adjustTrainQty = function (d) {
    ui._trainCount = Math.max(1, (Number(ui._trainCount) || 1) + d);
    if (ui.renderTroopsModal) ui.renderTroopsModal();
  };
  /* 输入框手动改动 → 同步状态（渲染函数不再读 DOM） */
  GAME.syncTrainQty = function (v) {
    ui._trainCount = Math.max(1, Math.floor(Number(v) || 1));
  };
  GAME.doTrain = function (troopId) {
    var count = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    /* v24（需求 8）：队列归属具体军营 —— 面板里选中的那一座 */
    var r = GAME.train(troopId, count, GAME.currentCity().id, ui._trainBIdx);
    ui.toast(r.msg);
    if (!r.ok) return;
    /* 募兵面板开在弹窗里，只重绘中央视图看不到新队列 */
    ui.openTroops(ui._trainBIdx, ui._trainFilter);
    GAME.refreshAll();
  };
  GAME.doAssignGuard = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    var r = GAME.assignGeneral(genId, g && g.status === 'guard' ? 'idle' : 'guard', GAME.currentCity().id);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* --------- 野地采集（v15） --------- */
  GAME.doStartGather = function () {
    var xy = ui._gatherXY;
    if (!xy) { ui.toast('未指定野地'); return; }
    var genEl = document.getElementById('gather-gen');
    var cntEl = document.getElementById('gather-troops');
    var genId = genEl ? genEl.value : ui._gatherGen;
    var count = cntEl ? Number(cntEl.value) : 0;
    if (!count || count <= 0) { ui.toast('请填写派兵数量'); return; }
    var army = GAME.autoPickTroops(count);
    var total = 0;
    for (var k in army) total += army[k];
    if (total <= 0) { ui.toast('城中无兵可派（请先募兵）'); return; }
    var r = GAME.startGather(xy.x, xy.y, genId, army);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };
  GAME.doFinishGather = function (id) {
    var r = GAME.finishGather(id);
    ui.toast(r.msg);
    GAME.refreshAll();
    ui.openGathers();
  };
  GAME.doAbandonGather = function (id) {
    var r = GAME.abandonGather(id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openGathers(); }
  };

  /* 显示比例（v16）：城内/城外整体缩放 */
  GAME.doSetZoom = function (z) {
    var s = GAME.state;
    if (!s || !s.settings) return;
    s.settings.zoom = z || 100;
    GAME.refreshView();
    ui.toast('显示比例 ' + s.settings.zoom + '%');
  };

  /* --------- 城墙（v16：不占格） --------- */
  GAME.doBuildWall = function () {
    var c = GAME.currentCity();
    if (!c) return;
    var r = (c.wallLv || 0) > 0 ? GAME.upgradeWall(c.id) : GAME.buildWall(c.id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openWallModal(); }
  };

  /* v19：移动/交换的二次确认弹窗 */
  ui.openMoveConfirm = function (from, to) {
    var c = GAME.currentCity();
    var a = c.cells[from], b = c.cells[to];
    var na = a && a.build ? (DATA.BUILDINGS[a.build.id] ? DATA.BUILDINGS[a.build.id].name : a.build.id) : '空地';
    var nb = b && b.build ? (DATA.BUILDINGS[b.build.id] ? DATA.BUILDINGS[b.build.id].name : b.build.id) : '空地';
    var bad = (a && a.pending) || (b && b.pending);
    var body = '<div class="attr"><span class="k">起点</span><span class="v">' + na + '</span></div>' +
      '<div class="attr"><span class="k">终点</span><span class="v">' + nb + '</span></div>' +
      '<div class="note">' + (b && b.build
        ? '两者<b>互换位置</b>，等级与状态随建筑一并迁移。'
        : '将建筑<b>搬迁</b>到空地，原格变为空地。') + '　不消耗资源。</div>' +
      (bad ? '<div class="note-warn">所选地块有建筑正在施工，无法移动。</div>' : '');
    ui.openShell({
      title: '🔄 确认移动',
      size: 'sm',
      body: body,
      foot: '<div class="m-foot">' +
        (bad ? '' : '<button class="btn gold" data-action="move-do" data-from="' + from + '" data-to="' + to + '">确认移动</button>') +
        '<button class="btn" data-action="move-cancel">取消</button></div>'
    });
  };

  GAME.doEquip = function (genId, itemId) {
    var r = GAME.systems.equipItem(genId, itemId);
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  /* 赏赐珠宝提升忠诚（将领详情面板一键操作） */
  /* 赏赐：v52 支持一次赏 N 件（选择窗里填了件数）。
     赏完关闭选择窗并刷新将领页 —— 原来赏一件就重开一次将领详情，选多件时很烦。 */
  GAME.doGenGift = function (genId, itemId, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var r = qty > 1
      ? GAME.systems.useItemMany(itemId, genId, qty)
      : GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg);
    GAME.refreshAll();
    ui.closeModal();
    /* 刷新将领页（忠诚变了、持有数变了） */
    if (ui.view === 'generals') ui.renderView();
  };
  GAME.doUnequip = function (genId, slot) {
    var r = GAME.systems.unequipItem(genId, slot);
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  GAME.doResearch = function (techId) {
    var r = GAME.systems.research(techId, GAME.currentCity() ? GAME.currentCity().id : null);
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  GAME.doUseItem = function (itemId, genId, qty) {
    /* v28（需求 6）：支持一次用 N 个（宝物面板与详情里的「使用」） */
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var r = qty > 1
      ? GAME.systems.useItemMany(itemId, genId || undefined, qty)
      : GAME.systems.useItem(itemId, genId || undefined);
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  GAME.doPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) GAME.refreshAll();
  };
  /* v77（老板）：君主面板 —— 晋升 / 改名（做完就地重开面板，立刻看到新状态） */
  GAME.doLordPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
  };
  GAME.doRenameLord = function () {
    var inp = document.getElementById('rename-lord-input');
    var r = GAME.renameLord(inp ? inp.value : '');
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
  };
  /* v77：百炼强化（唯一出口 GAME.enhance） */
  GAME.doEnhance = function (itemId) {
    var r = GAME.enhance(itemId);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openEnhance(); }
  };
  GAME.doSetTimeScale = function (v) {
    GAME.state.settings.timeScale = v;
    ui.toast('时间倍率：' + v + '×');
    GAME.refreshAll();
  };
  /* 界面主题（v39 · 需求 1）：换肤是"一次性偏好"，写进存档、下次开局沿用 */
  GAME.doSetTheme = function (id) {
    var t = ui.themeDef(id);
    GAME.state.settings.theme = t.id;
    ui.applyTheme(t.id);
    ui.toast('界面主题：' + t.name);
    GAME.refreshView();
  };
  GAME.doSetTax = function (v) {
    GAME.state.tax = v / 100;
    ui.toast('税率：' + v + '%');
    GAME.refreshAll();
  };
  /* 派军驻守：读取面板输入 → 调 domain（v23 · 需求 1） */
  GAME.doWildGarrisonDo = function () {
    var xy = ui._wildGarXY;
    if (!xy) return;
    var c = GAME.currentCity();
    var army = {};
    Object.keys(c.army || {}).forEach(function (k) {
      var el = document.getElementById('wg-' + k);
      var n = el ? parseInt(el.value, 10) || 0 : 0;
      if (n > 0) army[k] = Math.min(n, c.army[k] || 0);
    });
    var r = GAME.doWildGarrison(xy.x, xy.y, army, c.id);
    ui.toast(r.msg);
    if (r.ok) { ui.closeModal(); ui.openLandModal(xy.x, xy.y); GAME.refreshAll(); }
  };

  /* 驻军面板「全」按钮：把该兵种全部填入 */
  GAME.doHeal = function () {
    var r = GAME.battle.heal();
    ui.toast(r.msg);
    if (!r.ok) return;
    GAME.refreshAll();
    /* v21：伤兵营现在开在**弹窗**里（校场 / 行军队列）。refreshAll 只重绘
       中央视图，若不额外重绘弹窗，就会出现「点了治疗、数量纹丝不动」的假象
       —— v20 的募兵面板踩过同一个坑。 */
    var host = document.querySelector('#modal-root [data-heal-host]');
    var k = host ? host.dataset.healHost : '';
    if (k === 'xiaochang') ui.openXiaochang();
    else if (k === 'marches') ui.openMarches();
  };
  GAME.doClaimQuest = function (qid) {
    var r = GAME.claimQuest(qid);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* 打开统一出征面板 */
  GAME.doOpenExp = function (kind) {
    if (kind === 'city') {
      var npc = ui._attackNpc;
      if (!npc) { ui.toast('请先点击目标城池'); return; }
      ui.openExpModal({ kind: 'city', id: npc.id, npc: npc });
      return;
    }
    var t = ui._expTarget;
    if (!t) { ui.toast('请先在地图上选择目标'); return; }
    ui.openExpModal(t);
  };

  /* 确认出征（读取当前方式与兵力） */
  GAME.doExpConfirm = function () {
    var target = ui._expTarget;
    if (!target) { ui.toast('未选择目标'); return; }
    var mode = ui._expMode || 'occupy';
    var genSel = document.getElementById('exp-gen');
    if (!genSel) { ui.toast('请选择将领'); return; }
    var atk = {};
    Object.keys(GAME.currentCity().army || {}).forEach(function (id) {
      var input = document.getElementById('exp-' + id);
      if (input && Number(input.value) > 0) atk[id] = Math.floor(Number(input.value));
    });
    var md = GAME.battle.modeOf(mode);
    if (md.battle && Object.keys(atk).length === 0) { ui.toast('请选择出征兵力'); return; }
    /* v18：出征改为**行军队列** —— 校验/扣除在出发时完成，战斗在抵达时才打。
       于是「速度」这条属性、驿站、烽火台、天气、行军技巧、急行军令才真正有意义。 */
    var r = GAME.march.dispatch(target, mode, atk, genSel.value);
    ui.toast(r.msg);
    if (r.ok) {
      ui.closeModal();
      GAME.refreshAll();
      /* 旧接口兼容：dispatch 不再立刻返回战报，故不再当场弹侦查结果 */
    }
  };

  /* 行军抵达回调（由 GAME.march.arrive 触发） */
  GAME.onMarchArrive = function (m, r) {
    GAME.refreshAll();
    if (!r) return;
    if (r.intel && r.intel.length) {
      /* v65：**新的一次侦查从第 1 页开始**（页签记忆只服务"当次翻页"；
         否则上一次停在"可图之利"，这一次打开就看不到敌情） */
      ui.openScoutResult({ kind: m.kind, name: m.name }, r, 0);
      return;
    }
    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    }
    /* 攻占新城 / 战斗结果都在战报里，这里不重复打扰 */
  };

  /* 侦查结果面板（v65 重做：按侦察技巧分层 × 分两页）
   * ------------------------------------------------------------
   * 老板原话：「不同侦察技巧等级应该可以侦察出**不同类型**的信息」——
   * 于是这个面板不再"一股脑全给"：
   *   · 已解锁的层：给**准确值**（同日同地多次侦查结果一致）；
   *   · 未解锁的层：显示为**锁定行**，写明「侦察技巧 Lv N 可查」——
   *     锁着的东西也要让人看见它在哪儿，玩家才知道该去升什么。
   *
   * ⚠️ 还必须**分页**：满级六层全开时内容高度实测 950 屏溢出 89px、
   *   720 屏溢出 181px。按老板的硬规矩（弹窗内禁止下拉条，一律分页），
   *   拆成「敌情与缴获」/「虚实与可图之利」两页，每页都装得下。
   * ------------------------------------------------------------ */
  ui.SCOUT_PAGES = [
    { id: 'enemy', name: '⚔ 敌情与缴获' },
    { id: 'loot', name: '🔭 虚实与可图之利' },
  ];
  ui._scoutPage = 0;
  ui._scoutLast = null;
  ui.openScoutResult = function (target, r, page) {
    var U = GAME.utils;
    ui._scoutLast = { target: target, r: r };
    if (page == null) page = ui._scoutPage || 0;
    ui._scoutPage = page;
    /* ⚠️ 分层状态在 `r.intelTiers`，**不是** `r.intel` —— 后者早就是
       "战报日志行数组"（v27 就用了这个名字），拿错了会把数组当对象用。 */
    var it = r.intelTiers || { lv: 0, list: [], got: {}, next: null };
    var html = '<div class="gold-heading">🔭 侦查回报 · ' + U.escape(target.name || '') + '</div>';
    /* 顶部：分层进度（这条科技到底给我看什么，一眼可见） */
    var tips = ['侦察技巧 Lv' + it.lv];
    if (it.next) tips.push('下一层：' + it.next.name + '（还差 ' + (it.next.unlock - it.lv) + ' 级）');
    else tips.push('六层情报全开');
    html += '<div class="attr"><span class="k">情报层级</span><span class="v">' + tips.join('　·　') +
      ui.help('侦查情报按**侦察技巧**等级逐层解锁：\n' +
        (it.list || []).map(function (t) {
          return '· Lv' + t.unlock + '　' + t.name + ' —— ' + (t.hint || '');
        }).join('\n') +
        '\n\n顺手所得（材料/宝物）不受分层影响，任何等级都能捡到。') +
      '</span></div>';
    /* 页签（两页都装得下 —— 分页是硬规矩，不是可选项） */
    html += '<div class="chips" style="justify-content:center;margin:4px 0 8px;">' +
      ui.SCOUT_PAGES.map(function (p2, i) {
        return '<span class="chip' + (i === page ? ' on' : '') +
          '" data-action="scout-page" data-v="' + i + '">' + p2.name + '</span>';
      }).join('') + '</div>';

    /* 锁定行：明知有这东西，只是还看不见 */
    var lockRow = function (name, unlock, extra) {
      return '<div class="attr"><span class="k">' + name + '</span>' +
        '<span class="v" style="color:var(--text-dim);">🔒 需侦察技巧 Lv' + unlock +
        '　<span style="font-size:var(--fs-cap);">' + (extra || '') + '</span></span></div>';
    };
    var unlockOf = function (id) {
      var u = 99;
      (it.list || []).forEach(function (t) { if (t.id === id) u = t.unlock; });
      return u;
    };
    var blind = !!r.blinded;

    if (page === 0) {
      /* ---------- 第 1 页：敌情与缴获 ---------- */
      html += ui.sealH('敌情', (r.totalExact ? '准确点验' : '约略估计')
        + (r.field ? '　·　战场纵深 ' + U.numText(r.field, 0) : ''));
      html += '<div class="attr"><span class="k">守军总数</span><span class="v">' +
        (r.totalExact ? U.numText(r.gNum, 0) + ' 名'
          : ('约 ' + U.numText(r.gNum, 0) + ' 名　<span style="color:var(--text-dim);font-size:var(--fs-cap);">'
            + (it.got.total ? '（大雾，看不准）' : '（侦察技巧 Lv' + unlockOf('total') + ' 可点验）') + '</span>')) +
        '</span></div>';
      if (it.got.troops && !blind) {
        var rows = (r.roster || []).map(function (x) {
          return '<tr><td>' + U.escape(x.name) + '</td><td class="num">' + U.numText(x.n, 0) + '</td></tr>';
        }).join('');
        var gNum = (r.roster || []).reduce(function (n, x) { return n + x.n; }, 0);
        html += '<table class="tbl"><thead><tr><th>守军兵种</th><th>准确数量</th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="2" style="color:var(--text-dim);">城中无兵</td></tr>') +
          (rows ? '<tr><td><b>合计</b></td><td class="num"><b>' + U.numText(gNum, 0) + '</b></td></tr>' : '') +
          '</tbody></table>';
      } else {
        html += lockRow('兵种编制', unlockOf('troops'), blind ? '大雾蔽目' : '逐兵种的准确数量');
      }
      if (it.got.guard && !blind) {
        var gd = r.guard;
        html += '<div class="attr"><span class="k">守将</span><span class="v' + (gd ? ' bad' : '') + '">' +
          (gd ? (U.escape(gd.name) + '　' + GAME.rankOf(gd).name + ' Lv' + gd.level
            + '　统' + gd.tong + ' 勇' + gd.yw + ' 智' + gd.zm + ' 政' + gd.nz) : '无（守军无将，即无加成）') +
          '</span></div>';
      } else {
        html += lockRow('守将名册', unlockOf('guard'), blind ? '大雾蔽目' : '姓名 / 资质 / 六维');
      }
      if (r.loot && r.loot.length) html += '<div class="attr"><span class="k">顺手所得</span><span class="v good">' + r.loot.join('、') + '</span></div>';
      if (r.treasure) html += '<div class="attr"><span class="k">意外发现</span><span class="v good">' + U.escape(r.treasure) + '</span></div>';
      if (blind) html += '<div class="note-warn">大雾蔽目：斥候难以细察，只报得出一个大概。</div>';
    } else {
      /* ---------- 第 2 页：城中虚实 + 可图之利 ---------- */
      html += ui.sealH('城中虚实', '点验所得，同日同地一致');
      if (it.got.res && !blind && r.res) {
        html += '<div class="attr"><span class="k">' + r.res.title + '</span><span class="v">' +
          r.res.rows.map(function (x) { return x.name + ' ' + U.amtHTML(x.v); }).join('　') + '</span></div>';
      } else {
        html += lockRow('资源数量', unlockOf('res'), blind ? '大雾蔽目' : '城内库藏与人口');
      }
      if (it.got.build && !blind && r.build) {
        var b = r.build;
        html += '<div class="attr"><span class="k">城池规格</span><span class="v">' +
          b.col + '×' + b.row + '（' + b.total + ' 格）　建筑 Lv' + b.buildLv +
          '　城墙 Lv' + b.wallLv + '</span></div>' +
          '<div class="attr"><span class="k">城防 / 箭塔</span><span class="v">' +
          U.numText(b.def, 0) + ' / ' + b.towers + ' 座</span></div>' +
          '<div class="attr"><span class="k">城内建筑</span><span class="v" style="font-size:var(--fs-sub);">' +
          (b.items || []).map(function (x) { return x.name + '×' + x.n; }).join('　') +
          '　民房×' + b.minfang + '</span></div>';
      } else {
        html += lockRow('建筑工事', unlockOf('build'), blind ? '大雾蔽目' : '城内建筑种类与座数、城墙等级');
      }
      if (it.got.spoils && !blind && r.spoils) {
        var sp = r.spoils;
        html += ui.sealH('可图之利', '掠夺 / 占领的收益');
        html += '<div class="attr"><span class="k">掠夺可得珠宝</span><span class="v">' +
          ((sp.jewels || []).join('、') || '—') + '</span></div>';
        html += '<div class="attr"><span class="k">占领可采资源</span><span class="v">' +
          (sp.gatherName ? ('<b>' + sp.gatherName + '</b>（可派军采集）') : '只产加成，无可采之物') + '</span></div>';
        if (sp.terrainBonus) {
          var pb = [];
          for (var k in sp.terrainBonus) pb.push(({ grain: '粮', wood: '木', stone: '石', iron: '铁', gold: '金' }[k] || k)
            + ' +' + Math.round(sp.terrainBonus[k] * 100) + '%');
          html += '<div class="attr"><span class="k">占领产量加成</span><span class="v">' + pb.join('　') + '</span></div>';
        }
        html += '<div class="attr"><span class="k">可获材料</span><span class="v">' + ((sp.materials || []).join('、') || '—') + '</span></div>';
        html += '<div class="attr"><span class="k">军械</span><span class="v">' + (sp.equip || '—') +
          ui.help('可获宝物类型：\n' + (sp.types || []).join('\n')) + '</span></div>';
      } else {
        html += ui.sealH('可图之利', '掠夺 / 占领的收益');
        html += lockRow('可图之利', unlockOf('spoils'), blind ? '大雾蔽目' : '珠宝 / 材料 / 军械 / 可采资源');
      }
    }

    html += '<div class="modal-foot"><button class="btn" data-action="close-modal">知道了</button></div>';
    /* xl 档：两页都要有富余（内容最多的"满级第 2 页"实测 720 屏仍差 100 余 px） */
    ui.openModal(html, { size: 'xl' });
  };

  /* 兼容旧入口：统一走三方式出征 */
  /* 兼容旧入口：统一走三方式出征 */

  GAME.checkVictory = function () {
    var s = GAME.state;
    /* 胜利：占领洛阳 */
    var hasLuoyang = false;
    s.cities.forEach(function (c) { if (c.origId === 'cap' || (c.origName || c.name) === '洛阳') hasLuoyang = true; });
    if (hasLuoyang && !GAME._won) {
      GAME._won = true;
      ui.openModal(
        '<div style="text-align:center;padding:10px 20px;">' +
        '<div style="font-size:60px;line-height:1;">🏆</div>' +
        '<div class="gold-heading">天下一统 · 问鼎洛阳</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-lead);text-align:center;margin-bottom:16px;">' +
          '你已攻占帝都洛阳，天下归心，真霸主非你莫属！</div>' +
        '<div style="text-align:center;display:flex;gap:10px;justify-content:center;">' +
          '<button class="btn gold" data-action="close-modal">继续游玩</button>' +
          '<button class="btn" data-action="new-game">重新开局</button>' +
        '</div></div>'
      );
      ui.toast('🏆 已问鼎洛阳，统一天下！');
    }
  };

  /* --------- 存档动作 --------- */
  GAME.doSave = function () {
    if (GAME.saveGame()) ui.toast('💾 游戏已保存');
    else ui.toast('保存失败');
  };
  GAME.doNewGame = function () {
    if (!confirm('确定要重新开始吗？当前存档将被清除！')) return;
    GAME.clearSave();
    GAME.state = null;
    location.reload();
  };

  /* --------- 刷新 --------- */
  GAME.refreshView = function () { ui.renderView(ui.view); };
  GAME.refreshAll = function () {
    ui.syncHeader();
    ui.syncBadges();
    ui.renderSide();
    ui.renderView(ui.view);
    ui.renderLog();
  };

  /* --------- 地图点击 --------- */
  function handleCanvasClick(e) {
    var t = e.target;
    if (t && t.id === 'mapCanvas') {
      var G = GAME.map;
      var hit = G.pick(t, e.clientX, e.clientY);
      if (hit) {
        if (hit.kind === 'npc') {
          ui.openAttackModal(hit.city);
        } else if (hit.kind === 'player') {
          /* v60（需求 4）：老板：「**不要一点击地图就直接进入城池**」。
             改前点自己的城会立刻 setView('city') + setCity（副作用：当前城被换掉、
             侧栏数据全变），玩家只想看一眼都得先"进去再出来"。
             现在弹「城池面板」：先看摘要，再自己选 进入 / 运输 / 派遣 / 改名。 */
          ui.openCityPanel(hit.city);
        } else if (hit.kind === 'fort') {
          ui.openFortModal(hit.fort);
        } else if (hit.kind === 'wild') {
          /* v23（需求 1）：已占野地不再是"只弹一句提示"，直接进管理面板 */
          ui.openLandModal(hit.x, hit.y);
        } else {
          ui.openLandModal(hit.x, hit.y);
        }
      }
    }
  }

  /* --------- 事件委托 --------- */
  function bindEvents() {
    /* 会话日志：用户一旦手动滚动，就不再自动拉到底 */
    var logEl = null;
    try { logEl = document.querySelector('#sys-log'); } catch (e) { logEl = null; }
    if (logEl && logEl.addEventListener) logEl.addEventListener('scroll', function () { logEl._touched = true; });

    /* ============================================================
     * 悬停浮层（v37 · 需求 2）：**事件委托**，不逐个元素挂
     * ------------------------------------------------------------
     * 逐个挂会因重绘（翻页/切页签/换排序）而全部失效 —— 本项目在这上面
     * 已经栽过（按钮重绘后点击无反应）。委托在 document 上，与重绘无关。
     * 用 mouseover/mouseout（会冒泡）而不是 mouseenter/mouseleave（不冒泡）。
     * ============================================================ */
    document.addEventListener('mouseover', function (e) {
      var tip = GAME.ui.tipFor(e.target);
      if (tip) GAME.ui.tipShow(tip.html, tip.anchor);
      else GAME.ui.tipHide();
    });
    document.addEventListener('mouseout', function (e) {
      if (!GAME.ui.tipFor(e.target)) return;
      /* 移进同一浮层源的子元素不算离开 */
      if (e.relatedTarget && GAME.ui.tipFor(e.relatedTarget)) return;
      GAME.ui.tipHide();
    });
    /* 滚动 / 改尺寸后浮层位置就失效了 —— 直接收起来，比停在错误位置好 */
    document.addEventListener('scroll', function () { GAME.ui.tipHide(); }, true);
    window.addEventListener('resize', function () { GAME.ui.tipHide(); });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      /* v53：**`<select>` 不走 click 分发**。
         展开列表靠的是"点一下"——那个 click 会命中这个 select 自身（它带 data-action），
         若在这里就 dispatch，处理函数里的重绘会把这个 select 元素换掉，
         原生下拉列表随之立刻合上（老板原话："点出来列表马上收回去了"）。
         下拉框只由下面的 change 监听处理。 */
      if (t && t.tagName === 'SELECT') return;
      if (t) {
        if (t.classList.contains('disabled')) return;
        var action = t.getAttribute('data-action');
        GAME.action(action, t);
        e.preventDefault();
        return;
      }
      handleCanvasClick(e);
    });
    /* v45（需求 3）：`<select>` 触发的是 change 而非 click，走不了上面那套 click 委托。
       这里**仍然转交给同一个 GAME.action 分发**（而不是另写一段 if），
       好处：动作仍集中在一张表里，点选/下拉不会各写一套处理器，
       也不会被 audit 误判成"有按钮但无处理器"的孤儿动作。 */
    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el && el.tagName === 'SELECT' && el.getAttribute && el.getAttribute('data-action')) {
        GAME.action(el.getAttribute('data-action'), el);
      }
    });
    /* 数量输入框：手输后同步到状态（面板重绘时不丢） */
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'train-count') GAME.syncTrainQty(e.target.value);
    });
    document.addEventListener('click', function (e) {
      var tab = e.target.closest('.topnav .tab[data-view]');
      if (tab) { ui.setView(tab.dataset.view); }
    });
    /* 出征弹窗内的兵力输入 → 实时更新行军预估（速度由最慢兵种决定，填兵后才准） */
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.type === 'number' && el.id && el.id.indexOf('exp-') === 0 && ui.updateExpMarch) {
        ui.updateExpMarch();
      }
    });
    /* v27（需求 9）：窗口尺寸变化 → 重绘棋盘。
       棋盘格边长是按实测容器算的（ui.fitBoard / ui.fitMapCell），
       不重绘就会停在旧尺寸上：窗口拉大后棋盘还是小的，四周空一大片。
       只重绘**棋盘类**视图 —— 任务/公文等页面重绘会打断正在填的表单。 */
    var _rsTimer = null;
    window.addEventListener('resize', function () {
      if (_rsTimer) clearTimeout(_rsTimer);
      _rsTimer = setTimeout(function () {
        _rsTimer = null;
        if (ui.view === 'city' || ui.view === 'ext' || ui.view === 'map') ui.renderView(ui.view);
      }, 120);
    });
    /* Esc 关闭当前弹窗（与右上角 × / 底部「关闭」等价）；顺带取消「移动地块」的待选状态 */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (ui._moveFrom != null) { ui._moveFrom = null; ui.toast('已取消移动'); }
        if (ui.modalVisible && ui.modalVisible()) {
          ui.closeModal();
          if (GAME.refreshView) GAME.refreshView();
        }
      }
    });
  }

  var AUTO_SAVE_MS = 5 * 60 * 1000;   // 自动存档间隔：5 分钟

  /* --------- 主循环 --------- */
  function startLoop() {
    setInterval(function () {
      if (!GAME.state) return;
      if (!$('#screen-game').classList.contains('hidden')) {
        GAME.tickOnce();
        ui.updateProgress();
        /* 建造队列完成 → 重绘当前城内/城外面板（让"建设中"变回建筑） */
        var bc = GAME.state.queues.build.length;
        if (GAME._lastBuildCount !== bc) {
          GAME._lastBuildCount = bc;
          if (ui.view === 'city' || ui.view === 'ext') ui.renderView(ui.view);
        }
        /* v69（老板「已完成的任务自动浮动到最上方」）：可领取数量一变，
           正开着任务面板就立即重绘 —— 让"达标即置顶"是真·自动，
           口径与导航徽标（syncBadges 每秒读同一汇总）保持一致。 */
        var qr = GAME.questSummary().ready;
        if (GAME._lastQuestReady !== qr) {
          GAME._lastQuestReady = qr;
          if (ui.view === 'tasks') ui.renderView('tasks');
        }
        ui.renderLog();
        ui.renderSide();
        ui.syncHeader();
        ui.syncBadges();
        if (ui.view === 'map') ui.renderMapCanvas();
      }
    }, 1000);
    /* 自动存档：每 5 分钟一次，覆盖式写入（同键替换，只保留最新一档） */
    setInterval(function () {
      if (!GAME.state || GAME._demo) return;
      if (GAME.autoSave().ok) GAME._lastAutoSave = GAME.utils.now();
    }, AUTO_SAVE_MS);
  }

  /* --------- 启动 --------- */
  function boot() {
    bindEvents();
    GAME._lastBuildCount = 0;
    GAME._lastQuestReady = 0;   /* v69：可领取数变化时重绘任务面板的基准值 */
    var demo = /[?&]demo=1/.test(location.search);
    if (demo) {
      GAME._demo = true;
      GAME.newGame({ name: '演示君主', avatar: '🧔', gender: 'male', region: 'random' });
      GAME.map.generate();
      ui.enterGame();
      GAME.refreshAll();
      ui.toast('演示模式 · 真实数值版');
    } else if (GAME.hasSave()) {
      var st = GAME.loadGame();
      if (st) {
        GAME.map.generate();
        ui.enterGame();
        GAME.refreshAll();
        if (GAME._scaleMigrated) ui.toast('📂 已载入存档 · 时间倍率已提升至 120×');
        else ui.toast('📂 已自动载入存档');
      }
      else ui.setCreate();
    } else {
      ui.setCreate();
    }
    startLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

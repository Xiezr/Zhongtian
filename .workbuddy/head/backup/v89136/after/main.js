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
      case 'open-wall': {
        /* v89.128（老板「城墙以环城一圈的结构作为一个建筑」）：环城热区点击 =
           打开**环城槽**的面板（已建 → 升级/拆除；未建 → 修建）。不占格、不找空地。 */
        ui.openBuildModal('wall');
        break;
      }
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
      /* v89.87（老板需求 4）：战场界面动作 —— 指令 / 完成回合 / 自动 / 军务入口 */
      case 'bt-open': ui.openBattlefield(el.dataset.id); break;
      case 'bt-stance': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        /* v89.116：动作改**下拉框**（老板「不要直接列出，节省空间」）——
           值从 `el.value` 取；仍兼容旧的按钮形态（el.dataset.s）。 */
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { s: el.value || el.dataset.s });
      })(); break;
      case 'bt-target': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) ui.btSetCmd(rec, el.dataset.troop, { t: el.value || '' });
      })(); break;
      case 'bt-done': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (!rec) return;
        if (ui._bt.playing) { ui.toast('本回合结算播放中，稍候…'); return; }
        var r = GAME.battle.stepBattle(rec.id);
        if (r && ui.btAfterStep) ui.btAfterStep(rec, r);
      })(); break;
      /* v89.94（B2 · E1）：主动撤退 —— 两段确认（第一下"上膛"、第二下真撤） */
      case 'bt-retreat': (function () {
        var _bid94 = ui._bt && ui._bt.id;
        if (!_bid94 || !GAME.battle._recOf(_bid94)) { ui.toast('战斗已结束（战报见公文）'); return; }
        if (!ui._btRetreatArmed) {
          ui._btRetreatArmed = true;
          el.className = 'btn red';
          el.innerHTML = '🏳️ 再点一次确认撤退';
          ui.toast('⚠️ 撤退：带残部撤出 —— 本波破防按半计（围攻进度保留）');
          var _el94 = el;
          setTimeout(function () {
            ui._btRetreatArmed = false;
            if (_el94 && _el94.textContent && _el94.textContent.indexOf('再点一次') >= 0) {
              _el94.className = 'btn';
              _el94.innerHTML = '🏳️ 撤退';
            }
          }, 4000);
          return;
        }
        ui._btRetreatArmed = false;
        var _rr94 = GAME.battle.retreatBattle(_bid94);
        if (_rr94 && _rr94.ok === false) ui.toast('撤退未果：' + (_rr94.msg || '战斗已结束'));
      })(); break;
      case 'bt-auto': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) GAME.battle.autoBattle(rec.id);   /* 结束由 ui.onBattleDone 收口 */
      })(); break;
      case 'march-rush': (function () {
        /* v89.104：带 data-id → 只催这一支（军务·出征页逐行「急行军」） */
        var _mrId = el.dataset.id;
        if (_mrId) {
          var _mrs = GAME.state, _mOne = null;
          (_mrs.marches || []).forEach(function (x) { if (x.id === _mrId) _mOne = x; });
          if (_mOne) {
            _mrs.marches = (_mrs.marches || []).filter(function (x) { return x.id !== _mrId; });
            GAME.march.arrive(_mOne);
            ui.toast('⚡ 急行军：' + _mOne.name + ' 即刻抵达');
          } else { ui.toast('该行军已结束'); }
        } else {
          var r = GAME.march.rushAll();
          ui.toast(r.msg);
        }
        ui.closeModal();
        GAME.refreshAll();
      })(); break;
      /* v89.104（老板）军务页签：只换正文，动作全复用既有出口 */
      case 'march-tab': {
        ui._marchTab = el.dataset.v || 'over';
        GAME.refreshView();
        break;
      }
      /* v89.133（第 14 条）：防守页内两小页（全境防御 / 防守战术） */
      case 'def-sub': ui._defSub = el.dataset.v === 'tac' ? 'tac' : 'over'; GAME.refreshView(); break;
      /* v89.116：伤兵营 / 俘虏营的**唯一落点**跳转（校场 / 行军 / 行军弹窗的指引行） */
      case 'go-affairs': {
        ui._marchTab = 'affairs';
        ui.setView('marches');            /* ⚠️ 视图名是 marches（军务），不是 march */
        ui.toast('伤兵营 / 俘虏营在「军务 · 军务处」');
        break;
      }
      /* v89.116：俘虏营的两个出口（收编为民 / 释放） */
      case 'conscript-captives': {
        var _cc = GAME.doConscriptCaptives();
        ui.toast(_cc.msg);
        if (_cc.ok) GAME.refreshAll();
        break;
      }
      case 'release-captives': {
        var _cr = GAME.doReleaseCaptives();
        ui.toast(_cr.msg);
        if (_cr.ok) GAME.refreshAll();
        break;
      }
      /* ⛔ v89.134 移除：`case 'exp-go'` —— v89.133 出征页改造后按钮改为
         「进入军队行动」（exp-act-go，经 ui.actTargetsOf 覆盖 fort/city/own/wild
         全类型）；旧 case 已无界面触发点（audit 判不可达）。 */
      case 'toggle-auto-research': GAME.doToggleAutoResearch(); break;   /* v89.86（P-18）：改函数（带保留线下限提示） */
      /* ⛔ v89.135 移除：`case 'open-guanfu'` —— 官府面板退役（功能直接进官府格建筑面板）。 */
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
      /* v89.86（整改 P-07）：建造 / 科技队列花金提速（黄金消耗出口） */
      case 'rush-build': {
        var _rq1 = GAME.queueRushPay(GAME.queueAt('city', el.dataset.idx), '营造工程');
        ui.toast(_rq1.msg);
        GAME.refreshAll();
        if (GAME.queueAt('city', el.dataset.idx)) ui.openBuildModal(GAME.slotKey(el.dataset.idx));
        break;
      }
      /* v89.102（测评遗留落地）：全境营造总览 —— 跨城队列 + 逐条/一键提速 */
      case 'open-build-ov': ui.openBuildOverview(); break;
      case 'rush-ov': {
        var _q2 = GAME.buildQueueOf(el.dataset.ci, GAME.slotKey(el.dataset.gi));
        var _r2 = GAME.queueRushPay(_q2, '营造工程');
        ui.toast(_r2.msg);
        GAME.refreshAll();
        ui.openBuildOverview();
        break;
      }
      case 'rush-ov-all': {
        var _r3 = GAME.rushAllBuilds();
        ui.toast(_r3.msg);
        GAME.refreshAll();
        ui.openBuildOverview();
        break;
      }
      case 'rush-ext': {
        var _rq2 = GAME.queueRushPay(GAME.queueAt('ext', el.dataset.idx), '城外工程');
        ui.toast(_rq2.msg);
        GAME.refreshAll();
        if (GAME.queueAt('ext', el.dataset.idx)) ui.openExtModal(Number(el.dataset.idx));
        break;
      }
      case 'rush-tech': {
        var _rq4 = GAME.queueRushPay(GAME.queueAt('tech'), '科技研究');
        ui.toast(_rq4.msg);
        GAME.refreshAll();
        ui.openPanel('tech');
        break;
      }
      /* v89.86（整改 P-03）：任务「前往」（建筑类定位到城池对应格；其余切视图） */
      case 'quest-go': ui.doQuestGo(el.dataset.kind, el.dataset.id); break;
      /* v82：征收退役 —— do-levy 分发随功能撤除（官府面板不再产出该按钮）。 */
      /* v89.86（整改 P-26）：筑城成功 → 守备 0 风险提示 + 一键调兵（此前"裸城无提示"） */
      case 'build-city': (function () {
        var xy = ui._buildCityXY; if (!xy) return;
        var r = GAME.buildCityAt(xy.x, xy.y);
        ui.toast(r.msg);
        if (r.ok) {
          ui.closeModal();
          GAME.refreshAll();
          ui.openNewCityNotice(r.city);
          ui.sgTryAct('build-city');
        }
      })(); break;
      /* v89.86（P-26）：新城提示里的"从主城调兵" —— 复用跨城调兵出口（openTroopMove） */
      case 'newcity-send-troop': {
        var _ncFrom = GAME.cityById(el.dataset.from);
        var _ncTo = el.dataset.to;
        if (!_ncFrom || !_ncTo) break;
        ui.closeModal();
        ui._tmTo = ui._tmTo || {}; ui._tmTo[_ncFrom.id] = _ncTo;
        ui.openTroopMove(_ncFrom.id);
        break;
      }
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

      /* 原版三段式信息区 & 功能入口 */
      case 'open-lord': ui.openLordInfo(); break;
      /* v79（老板）：主城（官府里设；首设免费、迁都收成本） / 神器面板（君主菜单） */
      case 'set-main-city': {
        var mc = GAME.currentCity();
        var mr = GAME.setMainCity(mc ? mc.id : null);
        ui.toast(mr.msg);
        /* v89.135：官府面板退役后不再重开面板 —— 建筑面板已挂 live，下一秒自动刷新 */
        if (mr.ok) { GAME.refreshAll(); }
        break;
      }
      case 'open-artifacts': ui.openArtifacts(); break;
      /* v89.7（老板）：「头像可更换」—— 顶栏头像 / 君主面板「更换」都开这面板；
         点选即换（GAME.setLordAvatar 改 portraitSeed，两处同源）；
         「完成」回君主面板（与改名同一套流程）。 */
      case 'open-avatar-pick': ui.openAvatarPick(); break;
      case 'pick-lord-avatar': (function () {
        var avr = GAME.setLordAvatar(el.dataset.idx);
        if (avr.ok) {
          ui.syncHeader();      /* 顶栏立绘立刻换，不等下一拍 */
          ui.openAvatarPick();  /* 面板原地重绘：高亮跟到新脸 */
        }
        ui.toast(avr.msg);
      })(); break;
      case 'close-avatar-pick': ui.openLordInfo(); break;
      /* v77（老板）：君主面板 —— 进入城池（直跳该城城内界面）/ 晋升 / 改名 */
      case 'lord-city-enter': (function () {
        ui.closeModal();
        ui.setCity(el.dataset.city);
        ui.setView('city');
        GAME.refreshAll();
      })(); break;
      case 'lord-promote': GAME.doLordPromote(); break;
      /* v89.65（老板「君主练功然后突破」）：两个动作都就地重开君主面板，
         让玩家立刻看到修为/境界/上限的变化（与「晋升」同一套收尾）。 */
      case 'lord-train': (function () {
        var r = GAME.doLordTrain();
        ui.toast(r.msg);
        if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
      })(); break;
      case 'lord-break': (function () {
        var r = GAME.doLordBreak();
        ui.toast(r.msg);
        if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); }
      })(); break;
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
      /* v89.40（老板）：加点支持一次加 N 点 —— qty 来自加点弹窗的数量框（缺省 1） */
      case 'stat-plus-free':
        GAME.doStatPlusFree(el.dataset.gen, el.dataset.stat,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;
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
      /* v89.131（老板「体力精力应当设计加号按钮，供道具使用，参考赏赐」）：
         两个「＋」→ 同一个选择窗（kind 分流体力/精力）→ 执行 */
      case 'gen-sta-pick': ui.openRestorePick(el.dataset.gen, 'sta'); break;
      case 'gen-energy-pick': ui.openRestorePick(el.dataset.gen, 'energy'); break;
      case 'restore-pick-item': ui.setRestoreItem(el.dataset.gen, el.dataset.kind, el.dataset.item); break;
      case 'gen-restore-do':
        GAME.doGenRestore(el.dataset.gen, el.dataset.kind, el.dataset.item,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;
      case 'gen-gift-do':
        GAME.doGenGift(el.dataset.gen, el.dataset.item,
          el.dataset.qtyFrom ? ui.qtyValueOf(el.dataset.qtyFrom) : 1);
        break;
      /* 野地采集（v15） */
      /* ⛔ v89.136 移除：'gather-open'（派军采集面板）/ 'open-gathers'（野地采集弹窗）/
         'gather-start'（其提交端）—— 采集已合并为「带将驻军原地开工」，
         全部操作收敛到地块界面的「采集」区（见 ui.openLandModal 的 gatherBox）。 */
      case 'gather-finish': GAME.doFinishGather(el.dataset.id); break;
      /* v89.110：撤回采集 = 本轮无收益 —— 两段式 */
      case 'gather-abandon-ask': ui.openGatherAbandonAsk(el.dataset.id); break;
      case 'gather-abandon-do': GAME.doAbandonGather(el.dataset.id); break;
      /* ⛔ v89.136 移除：'gather-locate' —— 采集队总览弹窗退役（地块界面即野地本体，无需定位跳转）。 */

      /* 野地管理（v23 · 需求 1）：驻军 / 撤军 / 放弃 */
      case 'wild-garrison-open': ui.openWildGarrison(Number(el.dataset.x), Number(el.dataset.y)); break;
      /* v87（老板）：野地地形专属场景 */
      /* v88：双轨切换 / 蕴养 / 江湖游历（v88.1：原 do-wild-scene 已并入 do-jianghu） */
      case 'toggle-equip-set': GAME.doToggleEquipSet(el.dataset.gen, el.dataset.set); break;
      case 'ling-temper-open': ui.openLingTemper(); break;
      case 'ling-temper-item': GAME.doLingTemper(el.dataset.key); break;
      case 'do-jianghu': ui.doJianghu(Number(el.dataset.x), Number(el.dataset.y), el.dataset.act); break;
      /* v89：全屏江湖剧本（选择 / 中途退出 / 收尾关闭） */
      case 'sxf-choice': GAME.doScenePick(Number(el.dataset.i)); break;
      case 'sxf-escape': GAME.doSceneEscape(); break;
      case 'sxf-stop': ui.sxfTimingStop(); break;   /* v89.2：时机条停手 */
      case 'sxf-exit': ui.closeSceneFx(); break;
      /* 文字游戏（story/）：清单 / 开卷 / 选择 / 收起 */
      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;
      /* v89.86（整改 P-06）：待阅逸闻 —— 阅读（移出并开卷）/ 忽略 */
      case 'story-read': ui.sgReadPending(el.dataset.sid); break;
      /* v89.89（C4）：故事集 → 已读重读（不经待阅） */
      case 'story-read-at': ui.openStory(el.dataset.sid, false); break;
      case 'story-drop': ui.sgDropPending(el.dataset.sid); break;
      case 'story-exit': ui.sgClose(); break;
      /* v89.6：奇遇 · 见闻录 */
      case 'do-wonder': ui.doWonder(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'open-journal': ui.openJournal(); break;
      /* v89.89（A4）：材料产地跳转 —— 关面板 → 切地图 → 居中 → 标记（照 journal-go 时序） */
      case 'mat-go': GAME.doMatGo(el.dataset.mat); break;
      case 'journal-go':
        ui.closeModal();
        if (ui.view !== 'map') ui.setView('map');
        ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast('已至线索所指（' + el.dataset.x + ',' + el.dataset.y + '）—— 点该格探奇');
        break;
      /* v89.83：派驻面板（兵种 + 数量）—— 加减 / 全带 / 装满 / 清空，
         全部走 ui.wg* 纯界面助手（只改值与合计文字，不重绘）。 */
      case 'wg-step': ui.wgStep(el); break;
      case 'wg-max': ui.wgMax(el); break;
      case 'wg-fill': ui.wgFill(); break;
      case 'wg-clear': ui.wgClear(); break;
      case 'wild-garrison-do': GAME.doWildGarrisonDo(); break;
      case 'wild-withdraw': {
        var wr = GAME.doWildWithdraw(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wr.msg);
        if (wr.ok) { ui.openLandModal(Number(el.dataset.x), Number(el.dataset.y)); GAME.refreshAll(); }
        break;
      }
      /* v89.63（老板「野地驻军可以选择采集或召回」）：驻军就地开采 —— 无将领带队、
         兵从驻军里出、收获回驻军（走 GAME.startGather 的 from:'garrison' 分支） */
      case 'wild-garrison-gather': {
        var _gx = Number(el.dataset.x), _gy = Number(el.dataset.y);
        var _gg = GAME.wildGarrisonAt(_gx, _gy);
        if (!_gg || !GAME.wildGarrisonTotal(_gg)) { ui.toast('此地没有驻军可开采'); break; }
        /* v89.135（老板 5）：无将驻军只可驻留 —— 动作层先拦（startGather 内亦有硬闸） */
        if (!_gg.genId) { ui.toast('驻军须有将领带队方可开采（再次「派驻」选一位将领补驻）'); break; }
        var _gr = GAME.startGather(_gx, _gy, U.deep(_gg.troops), {});   /* v89.136：新签名 */
        ui.toast(_gr.msg);
        if (_gr.ok) { GAME.refreshAll(); ui.openLandModal(_gx, _gy); }
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
      /* v89.115：宝物二级分类条（参考商城分类检索） */
      case 'bag-sub': ui.setBagSub(el.dataset.v); break;
      case 'bag-sort': ui.setBagSort(el.dataset.v); break;
      case 'open-mat-detail': ui.openMatDetail(el.dataset.key); break;
      case 'open-bp-detail': ui.openBpDetail(el.dataset.key); break;
      /* v89.110：拆解 = 销毁该件 —— 两段式（确认弹窗由 ui.openSalvageConfirm 渲染） */
      case 'salvage-equip-ask': ui.openSalvageConfirm(el.dataset.key); break;
      case 'salvage-equip-do': GAME.doSalvage(el.dataset.key); break;
      case 'use-bag-item': {
        /* v29（需求 14）：使用数量取本行输入框 */
        var qf = el.getAttribute('data-qty-from');
        GAME.doBagUse(el.dataset.key, qf ? ui.qtyValueOf(qf) : 1);
        break;
      }
      case 'open-bag-equip': GAME.doBagEquip(el.dataset.key); break;
      case 'bag-detail': GAME.doBagDetail(el.dataset.key); break;
      case 'claim-rand-quest': GAME.doClaimRandQuest(el.dataset.q); break;
      /* v89.110：换任务 = 付工本费 + 旧任务作废 —— 两段式 */
      case 'reroll-rand-quest-ask': ui.openRerollRandAsk(el.dataset.q); break;
      case 'reroll-rand-quest-do': GAME.doRerollRandQuest(el.dataset.q); ui.closeModal(); break;
      case 'reroll-all-rand-ask': ui.openRerollAllAsk(); break;
      case 'reroll-all-rand-do': GAME.doRerollAllRand(); ui.closeModal(); break;
      case 'toggle-done-quests': ui._showDone = !ui._showDone; ui.renderView('tasks'); break;
      /* v77（老板）：建筑信息 / 资源生产两个入口随城池属性右三按钮一并退役；
         「附属野地」改由资源区下拉框的「进入」按钮触发（动作名不变）。 */
      case 'open-wilds': ui.openWilds(); break;
      /* v86（老板「按计划进行」· G1）：计略 */
      case 'exp-scheme': ui.toggleExpScheme(); break;
      case 'exp-scheme-pick': ui.doExpSchemePick(el.dataset.v); break;
      case 'city-scheme': ui.openCityScheme(); break;
      case 'city-scheme-pick': ui.doCitySchemePick(el.dataset.v); break;
      case 'map-pan': ui.mapPan(Number(el.dataset.dx), Number(el.dataset.dy)); break;
      /* v89.52（老板：底部导航栏最左按钮）：切换名称/等级标注层并重绘。
         v89.61：改为走唯一出口 ui.applyLabelSwitch —— 一次同时管
         ① 地图 canvas 标注层 ② 城内视图建筑名/等级 ③ 城外视图建筑名/等级。 */
      case 'map-toggle-labels': {
        ui._mapShowLabels = !ui._mapShowLabels;
        ui.applyLabelSwitch();
        ui.renderMapCanvas();
        break;
      }
      case 'map-goto': ui.mapGoto(); break;
      case 'open-minimap': ui.openMinimap(); break;
      case 'map-center': ui.mapCenter(); break;
      case 'map-capital': ui.mapCenterOn(265, 215); ui.toast('已定位至洛阳 (265,215)'); break;
      case 'open-inn': ui.openInn(); break;
      case 'open-forge': ui.openForge(); break;
      /* v77：百炼强化（铁匠铺底栏入口 + 装备详情入口） */
      case 'open-enhance': ui.openEnhance(); break;
      case 'enhance-item': GAME.doEnhance(el.dataset.item); break;
      case 'forge-item': GAME.doForge(el.dataset.item); break;
      case 'forge-pick': ui.forgePick(el.dataset.item); break;
      case 'forge-set': ui.setForgeSet(el.dataset.s); break;
      case 'bag-eq-f': ui.setBagEqFilter(el.dataset.k, el.dataset.v); break;
      case 'open-hostel': ui.openHostel(); break;
      case 'open-market': ui.openMarket(); break;
      /* v89.74：门派驻地（P0）—— 面板 + 入派/立派/门派任务/退派。
         四个动作都"成功就重开面板"（与客栈/市场同一惯例），失败只弹提示不重开。 */
      case 'open-sect': ui.openSect(); break;
      case 'sect-join': {
        var _sj = GAME.doSectJoin(el.dataset.v); ui.toast(_sj.msg);
        if (_sj.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }
      case 'sect-found': {
        var _sf = GAME.doSectFound(el.dataset.v); ui.toast(_sf.msg);
        if (_sf.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }
      case 'sect-task': {
        var _sk = GAME.doSectTask(el.dataset.v); ui.toast(_sk.msg);
        if (_sk.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }
      /* v89.86（整改 P-21）：门派任务连做（×10 / 一键做完）—— 汇总一条 toast，面板重开刷次数 */
      case 'sect-task-bulk': {
        var _rb = GAME.doSectTaskBulk(el.dataset.v, Number(el.dataset.n) || 0);
        ui.toast((_rb.ok ? '✅ ' : '⏸ ') + _rb.msg);
        if (_rb.ok) GAME.refreshAll();
        ui.openSect();
        break;
      }
      case 'sect-leave': {
        var _sl = GAME.doSectLeave(); ui.toast(_sl.msg);
        if (_sl.ok) { GAME.refreshAll(); ui.openSect(); } break;
      }
      case 'open-store': ui.openStore(); break;
      case 'open-panel': ui.openPanel(el.dataset.view); break;
      case 'inn-recruit': GAME.doInnRecruit(el.dataset.id); break;
      case 'inn-reroll': GAME.doInnReroll(); break;
      /* v89.73（老板）：自动招募从客栈搬到「自动」菜单 —— 改完就地重绘**自动页** */
      case 'auto-recruit-toggle': { var _ia = GAME.innAutoToggle(); ui.toast(_ia.msg); ui.renderView('auto'); break; }
      case 'auto-recruit-min': { var _ib = GAME.innAutoMinSet(el.dataset.v); ui.toast(_ib.msg); ui.renderView('auto'); break; }
      /* 数量预设：data-target 指定输入框（v89.60 市场合并后只剩共用的 mk-amount） */
      case 'mk-preset': { var mkIn = document.getElementById(el.dataset.target || 'mk-amount'); if (mkIn) mkIn.value = el.dataset.v; break; }
      /* v89.62：数量按**量级**缩放（÷10 / ×10）—— 与「10 万/百万/千万/亿」档位配套，
         大手笔买卖不必手打一长串 0。上限钳在 1e15，防 ×10 连点溢出成 Infinity。 */
      case 'mk-scale': {
        var mkEl = document.getElementById(el.dataset.target || 'mk-amount');
        if (!mkEl) break;
        var mv = Math.floor((Number(mkEl.value) || 0) * (Number(el.dataset.v) || 1));
        if (!(mv >= 1)) mv = 1;
        mkEl.value = Math.min(mv, 1e15);
        break;
      }
      /* v89.60：市场合并为单块 —— 买卖按钮各自带 data-res，数量取共用输入框 #mk-amount */
      case 'market-sell': GAME.doMarketSell(el.dataset.res); break;
      case 'market-buy': GAME.doMarketBuy(el.dataset.res); break;
      /* v89.100：道具寄售（价 = 购买价 75%；出口 systems.consign*） */
      case 'consign-sell': GAME.doConsign(el.dataset.item); break;
      case 'consign-all': GAME.doConsignAll(); break;
      /* v26：同上，「商城」已是顶栏视图（data-view="shop"）。 */
      case 'quick-item': ui.openQuickItem(el.dataset.res); break;
      /* v89.128（需求 7）：人口道具快用（人口行 "+" 按钮） */
      case 'quick-pop': ui.openQuickPop(); break;
      case 'use-item-quick': GAME.doUseItemQuick(el.dataset.item); break;
      /* v29（需求 14）：数量以**本行输入框**为准（不再有全局的"购买数量"档位） */
      case 'shop-buy': {
        var sbId = 'sq-' + el.dataset.item;
        GAME.doShopping(el.dataset.item, ui.qtyValueOf(sbId));
        break;
      }
      /* v89.87（老板需求 1）：快购 —— 消耗点就地直购（走商城同一出口 doShopping） */
      case 'qb-item': ui.openQuickBuy(el.dataset.item, Number(el.dataset.need) || 1); break;
      case 'qb-cat': ui.openQuickCat(el.dataset.cat, el.dataset.scope || null); break;
      case 'qb-buy': {
        var _rq = GAME.doShopping(ui._qbItem, ui.qtyValueOf('qb-qty'));
        ui.toast(_rq.msg);
        if (_rq.ok) { var _bk = ui._qbBack; ui.closeModal(); if (_bk) _bk(); }
        break;
      }
      case 'qb-cat-buy': {
        var _rq2 = GAME.doShopping(el.dataset.item, ui.qtyValueOf('qbq-' + el.dataset.item));
        ui.toast(_rq2.msg);
        if (_rq2.ok) ui.openQuickCat(el.dataset.cat, el.dataset.scope || null);
        break;
      }
      /* v29（需求 14）：数量输入框的 −/＋ 与「最多」——只改输入框的值，不重绘 */
      case 'qty-step': ui.qtyStep(el); break;
      case 'qty-max': ui.qtyMax(el); break;
      /* 商城分类（v18：固定网格 + 分类页签） */
      case 'shop-cat': ui.setShopCat(el.dataset.c); break;
      /* v29（需求 12）：铁匠铺品质页签 */
      case 'forge-q': ui.setForgeQ(el.dataset.q); break;
      /* v89.107（老板）：公文五类独立页签 —— 只换正文，动作全复用既有出口 */
      case 'doc-tab': ui.setDocTab(el.dataset.v); break;

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
      case 'confirm-build': GAME.doBuild(GAME.slotKey(el.dataset.idx), el.dataset.build); break;
      case 'confirm-upgrade': GAME.doUpgrade(GAME.slotKey(el.dataset.idx)); break;
      case 'demolish-ask': ui.openDemolishConfirm(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;
      case 'demolish-do': GAME.doDemolishDo(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;
      /* v89.110：取消建造 = 扣 20% 与已耗时间 —— 两段式（先看退多少，再执行） */
      case 'cancel-build-ask': ui.openCancelBuildAsk(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;
      case 'cancel-build-do': GAME.doCancelBuild(el.dataset.kind, GAME.slotKey(el.dataset.idx)); break;

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
      /* v89.49：花金买时间（募兵/制造队列提速的"永远可用"那条路） */
      case 'train-rush': GAME.doTrainRush(Number(el.dataset.pct), Number(el.dataset.idx), el.dataset.kind); break;
      case 'train-locked': ui.toast('尚不可训练：' + (el.dataset.why || '条件未满足') + '（升级军营/书院、占领对应州城可解锁）'); break;
      /* v80（老板）：「步兵 / 骑兵」翻页（±10 退役，数量改直输 —— 见 troopsHTML）；
         v81（老板）：「做成3页，第一页为募兵队列」—— que / inf / cav 三页白名单 */
      case 'train-tab': ui._trainTab = (['que', 'inf', 'cav'].indexOf(el.dataset.page) >= 0) ? el.dataset.page : 'que'; ui.renderTroopsModal(); break;
      case 'confirm-train': GAME.doTrain(el.dataset.troop); break;
      /* v89.99（老板「设计兵种解散」）：解散归农 —— 数量取同一输入框。
         v89.110（老板「危险按钮不能放容易误触的位置」）：改**两段式** ——
         先弹确认（丢失什么 / 返还什么写清楚），确认才执行；一键直达的口子关死。 */
      case 'troop-disband-ask': ui.openDisbandConfirm(el.dataset.troop, ui._trainCount); break;
      case 'troop-disband-do': {
        var dBc = GAME.currentCity();
        var dBr = GAME.disbandAt(dBc && dBc.id, el.dataset.troop, Number(el.dataset.n));
        ui.toast((dBr.ok ? '🕊 ' : '') + dBr.msg);
        ui.closeModal();
        GAME.refreshAll();
        ui.renderTroopsModal();
        break;
      }

      /* 将领 */
      case 'assign-guard': GAME.doAssignGuard(el.dataset.gen); break;
      case 'assign-mayor': GAME.doAssignMayor(el.dataset.gen); break;   /* v89.113 城主 */
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
      case 'open-tactic': ui.openTacticModal(ui._expMode === 'raid' ? 'raid' : 'occupy'); break;
      /* v89.136（老板 4）：出征战术细分小页切换（掠夺 / 占领） */
      case 'exp-tac-sub': ui._expTac = (el.dataset.v === 'raid') ? 'raid' : 'occupy'; GAME.refreshView(); break;
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
      /* v89.103（老板「资源运输应当采用出征界面」）：本城「资源运输」按钮
         → 直接开出征界面（选目标 = 另一座己方城池），在那里填兵力与辎重。
         旧面板（ui.openTransport）整条退场 —— 那个"点运输报城池不存在"的老 bug
         也随之消失（见 ui.js 里的退役注释）。 */
      case 'city-transport': {
        var _ctFrom = GAME.currentCity();
        var _ctTo = el.dataset.city;
        if (!_ctFrom || !_ctTo || _ctTo === _ctFrom.id) { ui.toast('请选择另一座己方城池'); break; }
        ui.openExpModal({ kind: 'own', id: _ctTo });
        break;
      }
      /* v89.93（整改 E11）：度支归集（跨城资金调剂）—— 结果用 toast 回执 */
      case 'budget-gather': {
        var bgR = GAME.budgetGather(el.dataset.city);
        ui.toast((bgR.ok ? '🏛 ' : '') + bgR.msg);
        if (bgR.ok) { GAME.refreshAll(); }
        break;
      }
      case 'city-dispatch': ui.openDispatch(el.dataset.city); break;
      /* v89.95（A1）：节钺扩编（每城 +1 建造位，至多 2 次）—— 结果 toast + 重开面板
         v89.132：改走统一出口 GAME.jieyueExpand（city/xc/gen 三族共用一套判据） */
      case 'jieyue-expand': {
        var _heR = GAME.jieyueExpand('city', el.dataset.city);
        ui.toast((_heR.ok ? '🪓 ' : '⚠️ ') + _heR.msg);
        if (_heR.ok) {
          GAME.refreshAll();
          var _heC = GAME.cityById(el.dataset.city);
          if (_heC) ui.openCityPanel(_heC);
        }
        break;
      }
      /* v89.132（老板「节钺设计再开拓一下」）：校场扩编 / 招贤纳士 / 节钺面板 */
      case 'jieyue-xc': {
        var _jxR = GAME.jieyueExpand('xc', el.dataset.city);
        ui.toast((_jxR.ok ? '🪓 ' : '⚠️ ') + _jxR.msg);
        /* v89.133：入口在「军务 · 出征」页 —— refreshAll 重绘当前视图即可 */
        if (_jxR.ok) GAME.refreshAll();
        break;
      }
      /* v89.133（v89.128 第二批第 9/11 条）：出征页 —— 选目标 / 进军队行动 / 练兵选将 */
      case 'exp-act-target': ui._actTarget = Number(el.value) || 0; break;
      case 'exp-act-go': {
        var _atl = ui.actTargetsOf(GAME.currentCity());
        var _at = _atl[Number(ui._actTarget) || 0];
        if (!_at) { ui.toast('请先选择目标'); break; }
        ui.openExpModal(_at.tg);
        break;
      }
      /* ⛔ v89.136 移除：'xc-gen-pick'（练兵选将）—— 随练兵块退役。 */
      case 'jieyue-gen': {
        var _jgR = GAME.jieyueExpand('gen', el.dataset.city);
        ui.toast((_jgR.ok ? '🪓 ' : '⚠️ ') + _jgR.msg);
        if (_jgR.ok) { GAME.refreshAll(); ui.openHostel(); }
        break;
      }
      case 'open-jieyue': ui.openJieyue(); break;
      /* v89.93（整改 E14）：资质晋升 —— 走既有出口 systems.useItem（rank_up 分支） */
      case 'gen-rankup': {
        var ruR = GAME.systems.useItem(el.dataset.item, el.dataset.gen);
        ui.toast((ruR.ok ? '🧬 ' : '') + ruR.msg);
        if (ruR.ok) { GAME.refreshAll(); }        /* 档案页随刷新重绘（晋升行自动更新） */
        break;
      }
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
      /* ⛔ v89.103：旧运输面板的 tr-to / tr-key / tr-pct / tr-do 四个动作整条退场
         （面板已由出征界面取代，见 city-transport 与 ui.expCargoHTML）。 */
      /* v89.103（老板「资源运输应当采用出征界面」）：辎重区动作
         · cg-max   = 该项"全"（实有量与余下运力的较小者）
         · cg-clear = 清空五项（改走别的货） */
      case 'cg-max': ui.cgFillMax(el.dataset.k); break;
      case 'cg-clear': ui.cgClear(); break;
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
        /* v89.133（第 13 条）：控件 chip → **select / checkbox** ——
           值分别读 el.value / el.checked；旧 chip 的「就地切 class」不再需要
           （原生控件自管选中态）。data-f：s=动作 · t=目标 · sortie=出城迎战。 */
        /* v89.136（老板 4）：tside 值域扩展 —— 'raid'/'occupy' = 出征细分表 */
        var _tRaw = el.dataset.tside;
        var tSide = (_tRaw === 'def' || _tRaw === 'raid' || _tRaw === 'occupy') ? _tRaw : 'atk';
        if (el.dataset.f === 'sortie') {
          var TT = GAME.tacticsOf(tSide)[el.dataset.troop] || {};
          var _sv = (el.tagName === 'INPUT') ? !!el.checked : !TT.sortie;
          GAME.setTactic(tSide, el.dataset.troop, { sortie: _sv });
          if (el.tagName !== 'INPUT') el.classList.toggle('on');
          break;
        }
        var tp = {};
        var _tv = (el.tagName === 'SELECT') ? el.value : el.dataset.v;
        if (el.dataset.f === 's') tp.s = _tv;
        else if (el.dataset.f === 't') tp.t = _tv;
        GAME.setTactic(tSide, el.dataset.troop, tp);
        break;
      }
      case 'tactic-reset': {
        var _rRaw = el.dataset.tside;
        var rSide = (_rRaw === 'def' || _rRaw === 'raid' || _rRaw === 'occupy') ? _rRaw : 'atk';
        var rrT = GAME.clearTactics(rSide);
        ui.toast(rrT.msg);
        /* 弹窗里点的 → 重开弹窗；页面内嵌的 → 就地重绘视图 */
        if (document.querySelector('#modal-root .tac-block')) ui.openTacticModal(rSide);
        else GAME.refreshView();
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
        /* v89.104（老板）：预算闸门 / 离线上限 / 音效开关 三块整体退役 ——
           对应分支随设置项一并删除（doSetAutoFin / doSetOfflineCap / doSetSfx 三个出口同去）。 */
        break;
      }

      /* 爵位 */
      case 'promote': GAME.doPromote(); break;
      /* v89.93（整改 E5）：里程碑演出层关闭 */
      case 'moment-close': ui.momentClose(); break;

      /* v89.104（老板）：背包宝物「有使用对象」的道具 → 指路去对应界面（不就地使用） */
      case 'bag-go': {
        var _bv = el.dataset.view;
        if (_bv) ui.setView(_bv);
        ui.toast(el.dataset.msg || '请在该界面使用该道具');
        break;
      }
      /* 设置 */
      /* v89.104（老板）：税率 ±5%（侧栏就地调）—— 夹在 0~100、步长 5，走同一出口 doSetTax */
      case 'tax-step': {
        var _d5 = Number(el.dataset.d) || 0;
        var _cur5 = Math.round((GAME.state.tax || 0) * 100);
        var _next5 = Math.max(0, Math.min(100, Math.round((_cur5 + _d5) / 5) * 5));
        GAME.doSetTax(_next5);
        break;
      }
      case 'toggle-auto-upgrade': GAME.doToggleAutoUpgrade(); break;
      /* v89.115：自动化界面左右分栏 —— 左名单点选（只重绘本视图，不重开面板） */
      case 'auto-pick': ui._autoSel = el.dataset.key; GAME.refreshView(); break;
      case 'toggle-auto-heal': GAME.doToggleAutoHeal(); break;
      case 'toggle-auto-invasion': GAME.doToggleInvasionAccept(); break;   /* v89.118：外敌来犯 */
      case 'go-beacon': ui._marchTab = 'beacon'; ui.setView('marches'); break;   /* 自动化 → 烽火页 */
      case 'forge-kind': ui.setForgeKind(el.dataset.k); break;
      /* v51：套装效果表从打造面板正文移到独立小窗（正文腾出 105px 才放得下两行卡片） */
      case 'forge-setinfo': ui.openForgeSetInfo(); break;
      case 'toggle-auto-march': GAME.doToggleAutoMarch(); break;
      case 'toggle-auto-lord': GAME.doToggleAutoLord(); break;   /* v89.83：第 4 条自动化 */
      case 'toggle-auto-gather': GAME.doToggleAutoGather(); break;   /* v89.128：自动采集/收获 */
      case 'auto-march-once': GAME.doAutoMarchOnce(); break;
      /* v89.65（老板「自动出征精细化，根据现有出征界面形成弹窗」）：
         弹窗里的三个入口 —— 后端一字未改（仍走 doToggleAutoMarch / doAutoMarchOnce），
         这里只多做一步**就地重开弹窗**，让"今日次数 / 可派兵力 / 上次结果"立刻反映。
         两个入口（页面快速行 + 弹窗）共用同一份后端，不是两套逻辑。 */
      case 'open-auto-march': ui.openAutoMarch(); break;
      case 'am-toggle': GAME.doToggleAutoMarch(); ui.openAutoMarch(); break;
      case 'am-once': GAME.doAutoMarchOnce(); ui.openAutoMarch(); break;
      /* v40：`case 'set-timescale'` / `case 'set-tax'` 已删 ——
         v22 起税率与倍率改走 `chip-set + data-after='tax'/'timescale'`，
         这两个旧分支在界面上查无触发点（audit 会一直报"不可达分支"）。 */
      /* v89.133（v89.128 第二批第 10 条）：「校场不要现在的界面功能，点击建筑功能
         直接进入'军务'界面」—— 校场面板退役，点建筑功能 = 切到军务视图。 */
      case 'open-xiaochang': ui.setView('marches'); ui._marchTab = 'over'; break;
      /* v89.80：校场练兵（演武 / 阅兵）—— 两者都改状态，落地后重开面板刷新可用态 */
      /* v89.133：练兵块迁到「出征战术」页尾 —— 重开面板改重绘当前视图 */
      /* ⛔ v89.136 移除：'xc-spar' / 'xc-review' —— 练兵（演武/阅兵）按老板第 4 条整组退役
         （域函数组墓碑见 domain.js；界面块墓碑见 ui.js 的 trainBlockHTML）。 */
      /* ⛔ v89.133 退役：'xiaochang-exp'（校场面板的「出兵地图」）—— 面板退役，
         出兵入口 = 地图点选 / 「军务 · 出征」页。 */
      case 'heal-wounded': GAME.doHeal(); break;

      /* 任务 */
      case 'claim-quest': GAME.doClaimQuest(el.dataset.q); break;
      /* v89.89（B1）：任务一键全领 */
      case 'quest-claim-all': GAME.doClaimAllQuests(); break;

      /* 出征（城/野地） */
      case 'exp-open': GAME.doOpenExp(el.dataset.kind, el.dataset.mode); break;
      case 'fort-exp': GAME.doOpenFortExp(el.dataset.mode); break;
      case 'fort-goto': ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y)); ui.toast('已定位 (' + el.dataset.x + ',' + el.dataset.y + ')'); break;
      case 'fort-pick': {
        var ff = GAME.map.fortAt(Number(el.dataset.x), Number(el.dataset.y));
        if (ff) ui.openExpModal({ kind: 'fort', x: ff.x, y: ff.y }); else ui.toast('此处已无据点');
        break;
      }
      /* v89.58：出征方式已改下拉框（change 事件在 openExpModal 内挂），旧「exp-mode」动作退场
         （v89.86：本行不再写字面 data-action 模式 —— audit 的孤儿按钮扫描不剥注释，会被误报） */
      case 'exp-max': { var ei = document.getElementById('exp-' + el.dataset.troop); if (ei) ei.value = ei.max; break; }
      case 'exp-confirm': GAME.doExpConfirm(); break;
      /* v89.94（B2 · E2）：战法三选（强攻/围困/奇袭）—— 唯一出口 ui.setExpOps */
      case 'exp-ops': ui.setExpOps(el.dataset.v); break;
      /* v89.94（B2 · E3）：战报回放控制（逐帧 / 播放 / 关键帧跳转） */
      case 'rep-prev': ui.replayStep(-1); break;
      case 'rep-next': ui.replayStep(1); break;
      case 'rep-play': ui.replayToggle(); break;
      case 'rep-jump': ui.replayJump(Number(el.dataset.v)); break;
      /* v89.52（老板：出征界面可用道具）：背包体力丹直接作用于所选主将，刷新道具条与预估，不关闭面板 */
      case 'exp-use-item': {
        var _it = el.dataset.item, _gs = document.getElementById('exp-gen');
        var _gid = (_gs && _gs.value) || ui._expGen || '';
        var _r = GAME.systems.useItem(_it, _gid);
        ui.toast(_r.msg || (_r.ok ? '已使用' : '使用失败'));
        if (_r.ok) { ui.refreshExpItems(); ui.updateExpMarch(); }
        break;
      }

      /* ⛔ v89.103：ic-troop / ic-gen / ic-res 三个动作随「城池间操作」面板一并退役 ——
         派驻军队/辎重/资源 → 出征界面选己方城池；派驻将领 → 城池面板「将领派遣」。 */
      case 'tm-to': ui.setTmTo(el.dataset.i, el.dataset.v); break;
      case 'tm-max': { var _tm = document.getElementById('tm-' + el.dataset.troop); if (_tm) _tm.value = _tm.max; break; }
      case 'tm-do': ui.doTroopMove(); break;

      /* v89.59（老板需求 6）：出征「方案」/「出征战术」预设（设置走弹窗，套用走下拉框） */
      case 'open-plan': {
        ui._planSnap = { troops: ui.expCurrentTroops(), tactics: U.deep(GAME.state.tactics || {}) };
        ui.openPlanModal();
        break;
      }
      case 'open-tactic-set': {
        ui._tacSnap = U.deep(GAME.state.tactics || {});
        ui.openTacticSets();      /* v89.86：改指预设管理（原同名覆盖导致「逐兵种」打不开编辑器） */
        break;
      }
      case 'plan-save': ui.expSavePlan(); break;
      case 'tac-save': ui.expSaveTactic(); break;
      case 'plan-del': ui.expDeletePlan(el.dataset.v); break;
      case 'tac-del': ui.expDeleteTactic(el.dataset.v); break;
      case 'plan-apply': {
        /* 弹窗单根：先重开出征面板，再把方案落到输入框 */
        ui.openExpModal(ui._expTarget);
        ui.expApplyPlan(el.dataset.v);
        break;
      }
      case 'tac-apply': {
        ui.expApplyTactic('s:' + el.dataset.v);
        ui.openExpModal(ui._expTarget);
        break;
      }

      case 'view-report': ui.viewReport(Number(el.dataset.rid)); break;   /* v89.120：身份 rid */
      /* ============================================================
       * v89.102（老板需求 2）：沙盘（固定沙盘 · 逐兵种逐帧）动作组
       * · sd-*：帧导航 / 播放 / 推演推进；`sd-text` 切回正文页
       * · open-sandbox：正文页顶部的「打开沙盘回放」
       * ============================================================ */
      case 'open-sandbox': ui.openSandbox(Number(el.dataset.rid)); break;  /* v89.120：身份 rid */
      case 'sd-text': ui.viewReportText(ui._repId); break;   /* v89.120：_repId（rid） */
      case 'sd-first': ui.sdSet(0); break;
      case 'sd-prev': ui.sdStep(-1); break;
      case 'sd-next': ui.sdStep(1); break;
      case 'sd-play': ui.sdToggle(); break;
      case 'sd-stance':
        ui.sdSetCmd(el.dataset.t, { s: el.dataset.s });
        break;
      case 'sd-target':
        ui.sdSetCmd(el.dataset.t, { t: el.value });
        break;
      case 'sd-sim': ui.sdSimEnter(); break;
      case 'sd-sim-exit': ui.sdSimExit(); break;
      case 'sd-done': ui.sdSimStep1(); break;
      /* v89.102（老板「侦查报告不要自动冒出来」）：公文里的侦查条目 →
         手动展开分层面板（数据随公文存档，见 battle.js 的 report.scout） */
      case 'scout-open': {
        var _sr = GAME.repByRid(ui._repId);        /* v89.120：身份 rid */
        if (_sr && _sr.scout && ui.openScoutResult) {
          ui.openScoutResult({ kind: _sr.scout.kind, name: _sr.scout.name }, _sr.scout, 0);
        } else {
          ui.toast('这条侦查公文没有可展开的面板数据（旧档战报）');
        }
        break;
      }
      /* v89.89（D4）：战报筛选 / 收藏 */
      case 'rep-filter': ui.setRepFilter(el.dataset.v); break;
      case 'rep-fav': ui.toggleRepFav(Number(el.dataset.rid)); break;      /* v89.120：身份 rid */
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
  GAME.doOpenFortExp = function (mode) {
    var f = ui._fortTarget;
    if (!f) { ui.toast('未选择野外城池'); return; }
    if (mode) ui._expMode = mode;    /* v89.58：点击界面直选方式 */
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
  /* v89.40（老板）：支持一次加 N 点（qty 来自加点弹窗的数量框，缺省 1） */
  GAME.doStatPlusFree = function (genId, stat, qty) {
    var s = GAME.state, g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('将领不存在'); return; }
    var r = GAME.addFreePoint(g, stat, qty);
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
  /* v89.49：花金买时间（老板「募兵队列怎么不可加速了？」—— 补上"永远可用"的那条路） */
  GAME.doTrainRush = function (pct, bIdx, kind) {
    var c = GAME.currentCity();
    var r = GAME.trainRush(c.id, bIdx, pct, kind || 'train');
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      ui.openTrainBoost(bIdx);     /* 同样留在面板里，让"剩余变短"看得见 */
    }
  };

  /* 商城购买（黄金结算：元宝价×100） */
  GAME.doShopping = function (itemId, qty) {
    var s = GAME.state;
    var item = GAME.systems.itemInfo(itemId);
    /* v89.87（需求 1）：返回 { ok, msg, bought } —— 快购（qb-buy/qb-cat-buy）与
       商城按钮共用本出口，调用方需要结果来决定"是否重开来源面板"。
       旧调用方无视返回值，行为不变。 */
    if (!item) { ui.toast('未知物品'); return { ok: false, msg: '未知物品' }; }
    /* v89.121（老板「承认绝版」）：下架档 = 绝版 —— **唯一硬闸**。
       商城页（shopItems）与快购列表（qbScopeItemsOf）本就不列，这里再兜底：
       任何调用方（含未来新增的购买口）都不可能把绝版物品卖出去。 */
    if (item.noShop) {
      var jbMsg = '「' + item.name + '」已下架（绝版），不可购买 —— 仅旧藏可用';
      ui.toast(jbMsg);
      return { ok: false, msg: jbMsg };
    }
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var price = (item.price || 0) * 100;
    /* v28（需求 6）：**买得起几个就买几个**，而不是"差一点就一口拒绝"。
       按「最多」时只可能被黄金卡住，这时买满能买的并说明差多少，
       比抛一句"黄金不足"有用得多。 */
    var can = Math.min(qty, Math.floor((s.res.gold || 0) / Math.max(1, price)));
    if (can <= 0) {
      var noMsg = '黄金不足（单价 ' + GAME.utils.fmt(price) + ' 金，现有 '
        + GAME.utils.fmt(s.res.gold || 0) + '）';
      ui.toast(noMsg);
      return { ok: false, msg: noMsg };
    }
    s.res.gold -= price * can;
    s.items[itemId] = (s.items[itemId] || 0) + can;
    GAME.log('商城购买：' + item.name + (can > 1 ? ' ×' + can : ''));
    var okMsg = '购买 ' + item.name + ' ×' + can + '（-' + GAME.utils.fmt(price * can) + ' 金）'
      + (can < qty ? '　黄金只够买 ' + can + ' 个' : '');
    ui.toast(okMsg);
    GAME.refreshAll();
    ui.renderShop();          // 只重绘商城（保留当前分类与页码，不要跳回第一页）
    return { ok: true, msg: okMsg, bought: can };
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
    /* 数值字段一律转 Number。漏一个就会变成字符串：`total - '2000'` 看着对
       （JS 会做减法），但 `>=` 比较会按字符串走，护栏就静默失效了。
       v89.83：`keepHome`（留守）退役；新增 `radius`（搜索距离）与 `scheme`（计略）。 */
    if (k === 'troops' || k === 'maxLevel' || k === 'everyMin'
      || k === 'radius' || k === 'dailyMax') cfg[k] = Number(v);
    else cfg[k] = (v === '' && k === 'scheme') ? null : String(v);
    /* v89.83：目标类型换了 → **等级候选跟着换**（野地/据点 1~10，名城 12/16/20/24）。
       旧值若不在新候选里就归到该类型最高档 —— 否则会"设了等级却一个目标都筛不出"，
       而玩家只会看到"没有符合条件的目标"，根本猜不到是等级选项不同源。 */
    if (k === 'target') {
      var lvs = GAME.autoMarchLevelOpts(cfg);
      if (lvs.indexOf(Number(cfg.maxLevel)) < 0) cfg.maxLevel = lvs[lvs.length - 1];
    }
    GAME.refreshView();
  };
  GAME.doAutoMarchOnce = function () {
    var r = GAME.autoMarchOnce();
    GAME.state.autoMarchInfo = { ok: r.ok, msg: r.msg, at: U.now() };
    ui.toast((r.ok ? '✅ ' : '⏸ ') + r.msg);
    if (r.ok) GAME.refreshAll(); else GAME.refreshView();
  };

  /* v89.83：自动练功开关（与其它开关同形：开启即试一次，关闭只清状态） */
  GAME.doToggleAutoLord = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoLordTrain = !s.settings.autoLordTrain;
    if (s.settings.autoLordTrain) {
      s.lordTrainAt = 0;                        /* 开启即视为"该练了"，立刻试一次 */
      var r = GAME.autoLordTrain();
      ui.toast(r && r.ok ? '🧘 ' + r.msg : '🧘 自动练功已开启（体力过半时自动练）');
    } else {
      s.autoLordState = null;
      ui.toast('自动练功已关闭');
    }
    GAME.refreshView();
  };
  /* v89.118（老板需求 3）：「外敌来犯」开关 —— 与其它自动化开关同形。
     开 = 接受来犯（按现实时间轮番来袭）；关 = 拒战（烽火无排期、敌军不来、也无守城俘获）。 */
  GAME.doToggleInvasionAccept = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    var wasOn = GAME.invasionAcceptOn();
    /* v89.122（老板「自动化·外敌来犯看起来没起作用」）：**写入端反置 bug** ——
       原写 `s.settings.invasion = wasOn`，而判据是 `=== false`（false = 拒战）：
       接受中点一下写进 `true` → 判据不变 → 状态**永远卡在"接受"**，
       而 toast/日志却报"已拒战"（文字与事实脱节 —— 老板正是这么发现的）。
       正确写法 = 写入"目标态"：`!wasOn`（接受中 → false=拒战；拒战中 → true=接受）。 */
    s.settings.invasion = !wasOn;
    GAME.log.beacon(wasOn
      ? '🛡 已拒战：自此烽火无警（「自动化 · 外敌来犯」可随时重开）'
      : '🔥 已接受外敌来犯：诸方势力按期而来（「自动化 · 外敌来犯」可关）');
    ui.toast(wasOn ? '已拒战（外敌不来犯）' : '已接受外敌来犯');
    GAME.refreshView();
  };
  /* v89.115：自动治疗开关（与其它开关同形：开启即试一次，关闭只清状态） */
  /* v89.128（需求 5）：自动采集/收获开关（仿自动治疗） */
  GAME.doToggleAutoGather = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoGather = !s.settings.autoGather;
    if (s.settings.autoGather) {
      s.autoGatherState = { lastAt: ((s.world && s.world.elapsed) || 0) - 86400, msg: '已开启，待命', at: 0 };   /* 立刻试一轮 */
      var r = GAME.autoGatherTick();
      ui.toast(r && r.ok ? ('🌾 ' + r.msg) : '🌾 自动采集/收获已开启（每 24 游戏小时一轮）');
    } else {
      s.autoGatherState = null;
      ui.toast('自动采集/收获已关闭');
    }
    GAME.refreshView();
  };
  GAME.doToggleAutoHeal = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoHeal = !s.settings.autoHeal;
    if (s.settings.autoHeal) {
      s.autoHealState = { msg: '已开启，待命', at: 0 };   /* at=0 → 立刻试一次 */
      var r = GAME.autoHeal();
      ui.toast(r && r.ok ? '🏥 ' + r.msg : '🏥 自动治疗已开启（有伤兵且金够时自动治）');
    } else {
      s.autoHealState = null;
      ui.toast('自动治疗已关闭');
    }
    GAME.refreshView();
  };
  /* 自动升级开关 */
  GAME.doToggleAutoUpgrade = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoUpgrade = !s.settings.autoUpgrade;
    if (s.settings.autoUpgrade) {
      s.autoState = { paused: false, msg: '已开启，待命' };
      /* v89.86（P-18）：开启时提示当前将遵循的预算下限 */
      ui.toast('🔨 自动升级已开启（按等级从低到高、同级城内优先）');
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

  /* ⛔ v89.104（老板）：`doSetSfx` / `doSetOfflineCap` 两个设置出口退役
     （设置页的音效与离线上限两块已撤除）。音效默认关：`DATA.settings.sfx = false`。 */

  /* v89.86（整改 P-18）：自动研究开关（原为一行内联写法 —— 补 toast 与保留线提示） */
  GAME.doToggleAutoResearch = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings.autoResearch = !s.settings.autoResearch;
    if (s.settings.autoResearch) {
      s.autoTechState = { paused: false, msg: '已开启，待命' };
      ui.toast('📜 自动研究已开启（从书院可研究的科技里挑最便宜的）');
      if (GAME.autoResearch) GAME.autoResearch();
    } else {
      s.autoTechState = null;
      ui.toast('自动研究已关闭');
    }
    GAME.refreshView();
  };
  /* ⛔ v89.104（老板）：「不要这个功能组件」—— `doSetAutoFin` 退役
     （预算闸门与"自动研究上限"两个参数一起撤除；自动化只做候选挑选，不再设线）。 */

  /* ---------- 背包动作 ---------- */
  /* v89.51：背包「使用」的目标将领 —— **唯一出口**（门禁直接断言它）。
     规则：优先页面上选定的 ui._itemGen；没有（旧档/未渲染）才退到第一位将领。
     改前 doBagUse 硬编码 generals[0]：玩家在背包里选谁都不作数，
     珠宝/秘籍/丹药全发给第一位将领 —— "买了用不了"的隐形变体（用了，但用错了人）。 */
  GAME.bagTargetGenId = function () {
    var s = GAME.state;
    var ok = s.generals && s.generals.some(function (g) { return g.id === ui._itemGen; });
    return ok ? ui._itemGen : ((s.generals[0] || {}).id);
  };
  GAME.doBagUse = function (itemId, qty) {
    /* v28（需求 6）：支持一次用 N 个 */
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var genId = GAME.bagTargetGenId();
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
  /* v88：双轨切换（改生效套 → 唯一出口分流 → 六维/体力/战斗/界面全链自动同步） */
  GAME.doToggleEquipSet = function (genId, want) {
    var r = GAME.toggleEquipSet(genId, want);
    ui.toast(r.msg);
    if (r.ok) { ui.openGenEquip(genId); GAME.refreshAll(); }
  };
  /* v88：蕴养（修炼装备强化；面板原地重开显示新等级与精华余额） */
  GAME.doLingTemper = function (key) {
    var r = GAME.lingTemper(key);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLingTemper(); }
  };
  /* v89：全屏剧本 —— 选择 / 中途退出（结算屏由 ui.renderSceneFx 就地重绘） */
  GAME.doScenePick = function (i) {
    var r = GAME.scenePick(i);
    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }
    ui.renderSceneFx();
  };
  GAME.doSceneEscape = function () {
    var r = GAME.sceneEscape();
    if (!r.ok) { if (r.msg) ui.toast(r.msg); return; }
    ui.renderSceneFx();
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
      ui.sgTryAct('move-city');   /* v89.31 · 动作触发 */
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
    /* v89.117：底部唯一打造键不带 data-item —— 缺省取**选中件**（ui._forgeSel） */
    if (!itemId && ui._forgeSel) itemId = ui._forgeSel;
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
    if (r.ok) { ui.openInn(); GAME.refreshAll(); ui.sgTryAct('recruit-hero', { cid: cid }); }   /* v89.31 */
  };
  GAME.doInnReroll = function () {
    var r = GAME.innReroll();
    ui.toast(r.msg);
    if (r.ok) ui.openInn();
  };
  /* v89.60（老板「市场的界面太杂了，4资源+黄金可买卖就行，没必要分成 3 个板块」）
     —— 市场合并为单块：两个方向落在**同一行**的按钮上；
        卖 = 出 N 单位资源得金；买 = 花金得 N 单位资源。
     数量只有**一个出口**（#mk-amount，单位 = 资源单位数）；
     买价换算走 GAME.marketBuyGoldFor（界面不自己 ceil，避免"算第二遍"）。
     资源互换（GAME.marketTrade / doMarketTrade）UI 入口退役 —— 后端 API 保留。 */
  GAME.doMarketSell = function (res) {
    var a = document.getElementById('mk-amount');
    if (!a) return;
    var r = GAME.marketSell(res, Number(a.value) || 0);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); ui.sgTryAct('market-trade'); }
  };
  GAME.doMarketBuy = function (res) {
    var a = document.getElementById('mk-amount');
    if (!a) return;
    var units = Number(a.value) || 0;
    if (units <= 0) { ui.toast('数量无效'); return; }
    var need = GAME.marketBuyGoldFor(res, units);        /* 口径唯一出口，界面只读不算 */
    if ((GAME.state.res.gold || 0) < need) { ui.toast('黄金不足 —— 需 ' + U.fmt(need) + ' 金'); return; }
    var r = GAME.marketBuy(res, need);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); ui.sgTryAct('market-trade'); }
  };

  /* v89.100：寄售（UI 包装 —— 唯一出口在 systems.consign*） */
  GAME.doConsign = function (id) {
    var r = GAME.systems.consignItem(id, 0);   /* 0 = 全部 */
    ui.toast((r.ok ? '🎒 ' : '') + r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
    return r;
  };
  GAME.doConsignAll = function () {
    var r = GAME.systems.consignAll();
    ui.toast((r.ok ? '🎒 ' : '') + r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
    return r;
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
  /* v80（老板）：「数量…可以直接输入」—— ±10 的 adjustTrainQty 随按钮一并退役；
     直输由 input 事件同步（GAME.syncTrainQty），不再需要"加减后重绘"这条链。 */
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
  /* v89.113（老板需求 3）：任命城主（与守将同构 —— 点一下任命/再点解除） */
  GAME.doAssignMayor = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    var r = GAME.assignGeneral(genId, g && g.status === 'mayor' ? 'idle' : 'mayor', GAME.currentCity().id);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* --------- 野地采集（v15） --------- */
  /* ⛔ v89.136 移除：`GAME.doStartGather`（派军采集的提交端）—— 随 openGatherModal 退役，
     采集唯一形态 = 带将驻军原地开工（GAME.startGather，由地块界面 / 自动采集调用）。 */
  GAME.doFinishGather = function (id) {
    /* v89.31：先取本次采集的地形（动作触发池要用），再结算（记录会被移除） */
    var _rec31 = null;
    (GAME.gatherList() || []).forEach(function (x) { if (x.id === id) _rec31 = x; });
    var r = GAME.finishGather(id);
    ui.toast(r.msg);
    if (r.ok) ui.sgTryAct('gather-done', { terrain: _rec31 ? _rec31.type : null });
    GAME.refreshAll();
    /* v89.136：不再重开"野地采集"弹窗（已退役）—— 若当前开着地块面板，
       liveModalTick 立即重开一次（状态当场刷新；从军务点则靠其逐秒重绘）。 */
    ui.liveModalTick();
  };
  GAME.doAbandonGather = function (id) {
    var r = GAME.abandonGather(id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.liveModalTick(); }   /* v89.136：同上 */
  };

  /* 显示比例（v16）：城内/城外整体缩放 */
  GAME.doSetZoom = function (z) {
    var s = GAME.state;
    if (!s || !s.settings) return;
    s.settings.zoom = z || 100;
    GAME.refreshView();
    ui.toast('显示比例 ' + s.settings.zoom + '%');
  };

  /* v89.126：`doBuildWall` 退役 —— 城墙走通用建造/升级（confirm-build / confirm-upgrade）。 */

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
  /* v89.131：体力/精力道具的使用出口（与 doGenGift 同构：真调 useItem(+Many) → toast → 刷新） */
  GAME.doGenRestore = function (genId, kind, itemId, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var r = qty > 1
      ? GAME.systems.useItemMany(itemId, genId, qty)
      : GAME.systems.useItem(itemId, genId);
    ui.toast(r.msg);
    GAME.refreshAll();
    ui.closeModal();
    if (ui.view === 'generals') ui.renderView();
  };
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
    if (r.ok) {
      /* v89.93（E5）：爵位晋升 = 22 档仪式感最强的成长 → 全屏演出 */
      var rn = (DATA.RANK[GAME.state.rank] || {}).name || '';
      ui.moment({ kind: 'full', icon: '🏅', title: '晋升 · ' + rn,
        sub: r.msg, lines: ['金印绶带，名位既正。', '新特权已入账（产/税 +1%·仓储 +2%·建造位与将格随档递进）。'] });
      GAME.refreshAll();
    }
  };
  /* v77（老板）：君主面板 —— 晋升 / 改名（做完就地重开面板，立刻看到新状态） */
  GAME.doLordPromote = function () {
    var r = GAME.systems.promote();
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.openLordInfo(); ui.sgTryAct('promote'); }   /* v89.31 */
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
    /* v89.87（需求 2）：驻守走行军通道，须带带队将领 */
    var genEl = document.getElementById('wg-gen');
    var genId = genEl ? genEl.value : null;
    var r = GAME.doWildGarrison(xy.x, xy.y, army, c.id, genId);
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
    /* v89.133：'xiaochang' 宿主随校场面板退役（woundedBlock('xiaochang') 已删）——
       现只剩行军队列弹窗这一个 host。 */
    if (k === 'marches') ui.openMarches();
    ui.sgTryAct('heal-wounded');   /* v89.31 · 动作触发 */
  };
  /* v89.89（A4 · 100+ 轮实玩期待）：材料产地一键定位 ——
     "读'材料不足'后要自己想起去哪弄" → 就地给坐标跳转；时序照 journal-go
     （关面板 → 切地图 → 居中 → 提示），另加 6 秒定位标记。 */
  GAME.doMatGo = function (mk) {
    var md = DATA.MATERIAL_BY_ID ? DATA.MATERIAL_BY_ID[mk] : null;
    var nm = (md && md.name) || mk;
    var t = ui.matGoTargetOf(mk);
    if (!t) { ui.toast(nm + '：暂无州城产地记录'); return; }
    ui.closeModal();
    if (ui.view !== 'map') ui.setView('map');
    ui.mapCenterOn(t.x, t.y);
    ui._mapMark = { x: t.x, y: t.y, until: Date.now() + 6000 };
    ui.renderMapCanvas();
    ui.toast(nm + '：「' + t.state + '」特产' +
      (t.owned ? '（已据）' : '（未据 —— 州治「' + t.name + '」）') +
      ' —— 已定位(' + t.x + ',' + t.y + ')');
  };
  GAME.doClaimQuest = function (qid) {
    var r = GAME.claimQuest(qid);
    ui.toast(r.msg);
    GAME.refreshAll();
  };
  /* v89.89（B1 · 100+ 轮实玩期待）：任务一键全领 ——
     逐条复用 claimQuest / claimRandomQuest 同一对出口（既有校验/结算/防重领全保留），
     汇总一条 toast；不新造批量结算路径（"第二次结算"是本项目最经典失效模式）。 */
  GAME.doClaimAllQuests = function () {
    var s = GAME.state;
    var n = 0;
    (DATA.QUESTS || []).forEach(function (q) {
      if (!GAME.questReady(q)) return;
      var r = GAME.claimQuest(q.id);
      if (r.ok) n++;
    });
    (s.quests.pool || []).slice().forEach(function (entry) {
      if (!GAME.randQuestReady(entry)) return;
      var r = GAME.claimRandomQuest(entry.id);
      if (r.ok) n++;
    });
    ui.toast(n ? ('一键领取 ' + n + ' 项任务奖励') : '暂无可领取的任务奖励');
    if (n) { ui.renderView('tasks'); GAME.refreshAll(); }
  };
  /* 打开统一出征面板 */
  GAME.doOpenExp = function (kind, mode) {
    if (mode) ui._expMode = mode;    /* v89.58：点击界面直选方式（侦查 / 掠夺 / 占领） */
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
    /* v89.103：兵力从输入框收 —— 与辎重运力的算法**同一个来源**（ui.expArmyOf） */
    var atk = ui.expArmyOf ? ui.expArmyOf() : {};
    var md = GAME.battle.modeOf(mode);
    /* ============================================================
     * v89.103（老板「任意自身城池向其他城池进行资源运输，应当采用出征界面，
     * 完成将领，兵种，资源数量等确认」）
     * ------------------------------------------------------------
     * 本境调运：兵 + 辎重一起走行军通道（GAME.doTransferCargo）——
     * 出发扣兵扣货，抵达入城落账（损耗 / 仓容），失败或召回原路退回。
     * ============================================================ */
    if (ui._expOwn) {
      var _from5 = GAME.currentCity();
      var _to5 = (ui._expRes && ui._expRes.city) || GAME.cityById(target.id);
      if (!_from5 || !_to5) { ui.toast('城池不存在'); return; }
      if (!Object.keys(atk).length) {
        /* v89.114：载重数从 DATA 读（此前硬编码 200/5000 —— 负重标定一改就成假文案） */
        ui.toast('请选择随行兵力 —— 辎重靠人挑（民夫载重 ' + DATA.TROOPS.minfu.load
          + ' / 辎重车 ' + DATA.TROOPS.zhouche.load + '）');
        return;
      }
      var _cargo5 = {};
      GAME.TRANSPORT_KEYS.forEach(function (k) {
        var el5 = document.getElementById('cg-' + k);
        var v5 = el5 ? Math.floor(Number(el5.value) || 0) : 0;
        if (v5 > 0) _cargo5[k] = v5;
      });
      var _r5 = GAME.doTransferCargo(_from5.id, _to5.id, atk, genSel.value, _cargo5);
      ui.toast(_r5.msg);
      if (_r5.ok) {
        ui._expForceArmed = false;
        ui.closeModal();
        GAME.refreshAll();
      }
      return;
    }
    if (md.battle && Object.keys(atk).length === 0) { ui.toast('请选择出征兵力'); return; }
    /* v89.86（整改 P-23）：兵力悬殊二次确认 —— 实测代价：0.02:1 出兵 → 200 长枪全灭、敌损 0。
       战力比 < 0.5 时第一次点击只"上膛"（按钮变红复述后果），再点一次才真发兵。
       例外：侦查（不接战）与"占领己方野地"（到了即驻，不接战）不设此闸。 */
    var _tgt86 = ui._expRes;
    var _peaceful86 = !!(_tgt86 && _tgt86.kind === 'wild' && GAME.map.wildAt(_tgt86.x, _tgt86.y));
    /* v89.94（B2 · E2）：闸门改按**最坏情形**拦（区间下界 ratioLo）——
       情报越差区间越宽，警告越容易触发：这是"不确定性"该有的代价。
       文案同时给点估计与误差，玩家知道自己在赌什么。 */
    var _pw86 = (md.battle && !_peaceful86 && ui.expPowerOf) ? ui.expPowerOf() : null;
    var _gateLo86 = (_pw86 && _pw86.ratioLo != null) ? _pw86.ratioLo : (_pw86 ? _pw86.ratio : null);
    if (_pw86 && _pw86.def > 0 && _pw86.mine > 0 && _gateLo86 != null && _gateLo86 < 0.5 && !ui._expForceArmed) {
      ui._expForceArmed = true;
      var _ratioTxt86 = '最坏 ' + (Math.round(_gateLo86 * 100) / 100) + ' : 1'
        + '（军师估算 ' + (Math.round(_pw86.ratio * 100) / 100) + ' ±' + Math.round(_pw86.err * 100) + '%）';
      var _btn86 = document.querySelector('#modal-root [data-action="exp-confirm"]');
      if (_btn86) {
        _btn86.className = 'btn red';
        _btn86.innerHTML = '⚠️ 兵力悬殊（' + _ratioTxt86 + '）—— 再点一次才发兵';
      }
      ui.toast('⚠️ 兵力悬殊（' + _ratioTxt86 + '）：此战恐全军覆没，再点一次才发兵');
      return;
    }
    ui._expForceArmed = false;
    /* v18：出征改为**行军队列** —— 校验/扣除在出发时完成，战斗在抵达时才打。
       于是「速度」这条属性、驿站、烽火台、天气、行军技巧、急行军令才真正有意义。 */
    /* v89.94（B2 · E2）：战法校验（与 prepare/dispatch 同一判据）——
       奇袭没计略 / 围困打野地 → 拦在这里并说明原因，不静默降级。 */
    var _ops94 = GAME.opsIdOf(ui._expOps);
    var _opsIssue94 = GAME.opsConfigIssueOf(_ops94, ui._expRes, ui._expScheme || null);
    if (_opsIssue94) { ui.toast('⚠️ ' + _opsIssue94); return; }
    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null, _ops94);
    ui.toast(r.msg);
    if (r.ok) {
      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */
      ui._expOps = 'assault';    /* v89.94：战法回到默认（防下次误带围困上野地） */
      ui.closeModal();
      GAME.refreshAll();
      /* 旧接口兼容：dispatch 不再立刻返回战报，故不再当场弹侦查结果 */
    }
  };

  /* 行军抵达回调（由 GAME.march.arrive 触发） */
  GAME.onMarchArrive = function (m, r) {
    GAME.refreshAll();
    if (!r) return;
    /* v89.87（老板需求 4）：观战挂起 → 直接进入战场界面（不再只弹 toast） */
    if (r.pending && r.battleId) { ui.openBattlefield(r.battleId); return; }
    if (r.intel && r.intel.length) {
      /* ============================================================
       * v89.102（老板）：「侦查报告不要自动冒出来」
       * ------------------------------------------------------------
       * 改前这里 `ui.openScoutResult(...)` **自动弹面板** —— 玩家正在处理别的
       * 城池（或读战报）也会被盖住，且一次出征带着斥候就弹一次。
       * 现在：只写一条 toast + 落公文（`battle.js` 里已把面板数据随公文存下），
       * 玩家要细看时在**公文页**点开该条 → 「展开侦查面板」。
       * `ui._scoutLast` 仍留一份（分页面板翻页用），但不再由抵达自动触发。
       * ============================================================ */
      ui._scoutLast = { target: { kind: m.kind, name: m.name }, r: r };
      ui.toast('🔭 ' + m.name + ' 侦查回报已入公文（点「公文」查看）');
      return;
    }
    if (r.ok) {
      ui.toast('⚔️ ' + m.name + '：' + r.msg);
    } else if (r.rolled) {
      /* v89.86（整改 P-25）：抵达结算失败、兵力已折返 —— 给玩家一条看得见的回执
         （此前这条路径完全静默，玩家只会发现"兵不见了"） */
      ui.toast('⚠️ ' + m.name + '：' + (r.msg || '目标已不存在') + '，大军折返');
    }
    /* v89.31 · 战事奇遇：胜 / 败 / 占城 / 据地 之后，从「相关建筑」池里偶遇一篇逸闻。
       v89.63：「派遣」到已属我方的野地是**不接战**的（r.peaceful），没有战事，不该触发战事逸闻。 */
    if (r.result && r.result.winner && r.result.winner !== 'scout' && !r.peaceful && GAME.SG && ui.sgTryAct) {
      var _t31 = r.target || {};
      var _m31 = GAME.battle.modeOf(r.mode) || {};
      var _win31 = r.result.winner === 'atk';
      if (_win31 && _m31.occupy && _t31.kind === 'city') {
        ui.sgTryAct('occupy-city', { type: _t31.cityType || 'county' });
      } else if (_win31 && _m31.occupy && _t31.kind === 'wild') {
        ui.sgTryAct('occupy-wild', { terrain: _t31.terrain || 'hill' });
      } else {
        ui.sgTryAct(_win31 ? 'battle-win' : 'battle-lose');
      }
    }
    /* 攻占新城 / 战斗结果都在战报里；逸闻触发单独在上一条处理 */
  };
  /* v89.31 · 引擎侧动作完成桥（营造 / 训练 / 研习在 tick 内结算）→ 逸闻动作触发 */
  GAME.onActionDone = function (key, ctx) {
    if (ui.sgTryAct) ui.sgTryAct(key, ctx);
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
      /* ⚠️ v89.73 修 bug：产出方（battle.js 的 scoutTarget 返回值）给的字段名是
         **`resReport` / `buildReport`**，这里原先读 `r.res` / `r.build` —— 两个名字对不上，
         于是 `r.res` 恒为 undefined → **侦察技巧再高也永远走 else 分支显示"🔒 需 Lv3/Lv9"**，
         玩家看到的就是"资源与建筑怎么点都看不到"。改名对齐，并把这条写进守卫。 */
      if (it.got.res && !blind && r.resReport) {
        var rr = r.resReport;
        html += '<div class="attr"><span class="k">' + rr.title + '</span><span class="v">' +
          rr.rows.map(function (x) { return x.name + ' ' + U.amtHTML(x.v); }).join('　') + '</span></div>';
      } else {
        html += lockRow('资源数量', unlockOf('res'), blind ? '大雾蔽目' : '城内库藏与人口');
      }
      if (it.got.build && !blind && r.buildReport) {
        var b = r.buildReport;
        html += '<div class="attr"><span class="k">城池规格</span><span class="v">' +
          b.col + '×' + b.row + '（' + b.total + ' 格）　建筑 Lv' + b.buildLv +
          '　城墙 Lv' + b.wallLv + '</span></div>' +
          '<div class="attr"><span class="k">城防 / 箭塔</span><span class="v">' +
          U.numText(b.def, 0) + ' / ' + b.towers + ' 座</span></div>' +
          /* v89.77：城外建筑单独报 —— 老板要的是"城**内外**建筑全是 12/16"，
             原先只报城内，他看不到城外那半，没法确认。 */
          '<div class="attr"><span class="k">城外建筑</span><span class="v">Lv' + (b.extLv || b.buildLv) +
          '（共 ' + (b.extN || 0) + ' 块：农田 / 伐木场 / 采石场 / 铁矿场）</span></div>' +
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
        '<div style="font-size:var(--isz-xl);line-height:var(--lh-1);">🏆</div>' +
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
          /* v89.29：概率奇遇 —— 点城池掷骰（命中随机抽一篇，悬于面板之上） */
          ui.sgTryTrigger('city', hit.city.type);
        } else if (hit.kind === 'fort') {
          ui.openFortModal(hit.fort);
        } else if (hit.kind === 'wild') {
          /* v23（需求 1）：已占野地不再是"只弹一句提示"，直接进管理面板 */
          ui.openLandModal(hit.x, hit.y);
          /* v89.29：概率奇遇 —— 点地块掷骰（命中随机抽一篇，悬于面板之上） */
          var _t89a = G.tile(hit.x, hit.y);
          ui.sgTryTrigger('wild', _t89a && _t89a.terrain);
        } else {
          ui.openLandModal(hit.x, hit.y);
          var _t89b = G.tile(hit.x, hit.y);
          ui.sgTryTrigger('wild', _t89b && _t89b.terrain);
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
    /* ============================================================
     * v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」
     * ------------------------------------------------------------
     * 复用既有浮层系统（ui.tipShow / tipHide，与 data-tip 提示同一层渲染）。
     * 按"格"节流：同一格内的 mousemove 不重绘（浮层稳稳停住，不追鼠标抖）；
     * 换格才更新、移出画布即收起。拾取走 GAME.map.pick（与点击同一条路）。
     * ============================================================ */
    var _mapHoverKey = null;
    document.addEventListener('mousemove', function (e) {
      var t = e.target;
      if (!t || t.id !== 'mapCanvas') return;
      var hit = GAME.map.pick(t, e.clientX, e.clientY);
      var key = hit ? (hit.kind + '@' + hit.x + ',' + hit.y) : 'none';
      if (key === _mapHoverKey) return;                       /* 同格：不重绘 */
      _mapHoverKey = key;
      var tip = (hit && GAME.ui.mapTipFor) ? GAME.ui.mapTipFor(hit) : null;
      if (!tip) { GAME.ui.tipHide(); return; }
      GAME.ui.tipShow(tip, {
        getBoundingClientRect: function () {
          return { left: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 };
        },
      });
    });
    document.addEventListener('mouseout', function (e) {
      if (!e.target || e.target.id !== 'mapCanvas') return;
      _mapHoverKey = null;
      GAME.ui.tipHide();
    });
    /* v45（需求 3）：`<select>` 触发的是 change 而非 click，走不了上面那套 click 委托。
       这里**仍然转交给同一个 GAME.action 分发**（而不是另写一段 if），
       好处：动作仍集中在一张表里，点选/下拉不会各写一套处理器，
       也不会被 audit 误判成"有按钮但无处理器"的孤儿动作。 */
    document.addEventListener('change', function (e) {
      var el = e.target;
      /* v89.133：复选框同走动作表（战术「出城迎战」是首个勾选项） */
      var _hit = el && el.getAttribute && el.getAttribute('data-action') &&
        (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'checkbox'));
      if (_hit) GAME.action(el.getAttribute('data-action'), el);
    });
    /* 数量输入框：手输后同步到状态（面板重绘时不丢） */
    /* v89.116（老板「显示比例实质改不了比例」）：滑块此前**没有监听** ——
       input 只做实时预览（不重绘，拖动不断），change 才落库 + 重绘。 */
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'zoom-range' && ui.previewZoom) ui.previewZoom(e.target.value);
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'zoom-range') GAME.doSetZoom(Number(e.target.value));
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.id === 'train-count') GAME.syncTrainQty(e.target.value);
    });
    /* v89.102（沙盘）：帧滑条拖动 → 直接跳帧（回放态） */
    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el && el.id === 'sd-range' && ui.sdSet) ui.sdSet(Number(el.value));
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
        /* v89.87（老板需求 4）：战斗观战倒计时（**真实秒**，不走 timeScale）——
           "后台照常走"：界面关闭也按表推进；动画播放中由 rec.anim 暂停。 */
        GAME.battle.tick(1);
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
        /* v89.132（老板「当前玩家所在城池的点出现闪烁…提示当前所在位置」）：
           底部条缩略图每秒重绘 —— 我城红点随秒交替明暗（1Hz 闪烁）。 */
        ui.paintMiniBottom();
        /* v89.135（老板 7）：**弹窗实时刷新** —— 声明了 opts.live 的面板每秒重开一次
           （快照输入值/滚动回填，不打断打字；桩 DOM 环境自动跳过）。 */
        ui.liveModalTick();
        /* v89.135（老板 7）：军务总览逐秒刷新（在途行军倒计时）—— 带滚动保持 */
        if (ui.view === 'marches' && (ui._marchTab || 'over') === 'over') {
          var _ae135 = document.activeElement;
          if (!_ae135 || ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(_ae135.tagName) < 0) {
            var _vc135 = document.getElementById('view-container');
            var _st135 = _vc135 ? _vc135.scrollTop : 0;
            ui.renderView('marches');
            if (_vc135) _vc135.scrollTop = _st135;
          }
        }
        /* v89.136（上轮未完成清单②）：**将领视图逐秒刷新**（带滚动保持）——
           体力/精力随现实时间回复、经验/忠诚/状态变化即时可见（与军务总览同款守卫）。 */
        if (ui.view === 'generals') {
          var _ae136 = document.activeElement;
          if (!_ae136 || ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(_ae136.tagName) < 0) {
            var _vc136 = document.getElementById('view-container');
            var _st136 = _vc136 ? _vc136.scrollTop : 0;
            ui.renderView('generals');
            if (_vc136) _vc136.scrollTop = _st136;
          }
        }
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
        /* v89.87：读档恢复挂起战斗（按 history 重放重建会话） */
        GAME.battle.restoreBattles();
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

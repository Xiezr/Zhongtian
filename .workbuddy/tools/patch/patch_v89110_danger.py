# -*- coding: utf-8 -*-
"""
v89.110 危险动作两段式改造 —— 代码补丁（ui / domain / main）
纪律：① 先备份 ② 内存里全量替换并逐条 assert ③ 全部命中才落盘（两阶段提交）
     ④ 落盘后自检（node --check + 关键模式复查）
跑法：python .workbuddy/tools/patch/patch_v89110_danger.py
"""
import io, os, shutil, subprocess

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')
NODE = r'C:/Users/18811/.workbuddy/binaries/node/versions/22.22.2-3/node.exe'

files = ['js/ui.js', 'js/domain.js', 'js/main.js']
orig = {}
for f in files:
    p = os.path.join(R, f)
    orig[f] = io.open(p, encoding='utf-8').read()
    shutil.copy2(p, os.path.join(BK, os.path.basename(f).replace('.js', '.v89109.js')))
print('[备份] ' + ' / '.join(os.path.basename(f) + '→.workbuddy/backup/*.v89109.js' for f in files))

new = dict(orig)
def rep(f, a, b, n=1):
    s = new[f]
    assert a in s, '未命中[' + f + ']：' + a[:80].replace('\n', '⏎')
    assert s.count(a) == n, '命中数不符[' + f + '] 期望%d 实际%d：%s' % (n, s.count(a), a[:60].replace('\n', '⏎'))
    new[f] = s.replace(a, b, n)

# ============================================================
# ① js/ui.js
# ============================================================
U = 'js/ui.js'

# ①-1 解散按钮移出主操作行（原来紧挨着「训练」）
rep(U, """        /* v89.99（老板「设计兵种解散」）：解散 = 归农（人口返还、军资不退）。
           与募兵同栏（选中兵种 + 数量即用）—— 人口银行 / 兵种转型都从这里走。 */
        '<button class="btn" data-action="troop-disband" data-troop="' + ui._trainSel + '"' +
          (haveN > 0 ? '' : ' disabled') + ' title="解散本城驻军并归农（返还人口，不返还军资）">解散</button>' +
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +""",
"""        /* v89.99（老板「设计兵种解散」）：解散 = 归农（人口返还、军资不退）。
           v89.110（老板「危险按钮能放训练旁边吗？这种人机交互理念符合常理吗」）：
           解散**移出本行** —— 收进下方独立「危险操作」区（红 + 二次确认）。
           主操作行只留正向动作：差点点到解散 = 迟早点到解散。 */
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +""")

# ①-2 危险操作区（主操作行之后、队列块之前）
rep(U, """      '</div>' +
      (isSiege && bar ? ui.trainQueueBlock(bar, c, kind) : '') +
      '</div>';
  };""",
"""      '</div>' +
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
  };""")

# ①-3 拆解回收 → 走二次确认
rep(U, """        '<button class="btn red" data-action="salvage-equip" data-key="' + key + '">拆解回收</button></div>';""",
"""        /* v89.110：拆解 = 销毁该件（不可逆）—— 改走二次确认（ui.openSalvageConfirm）。 */
        '<button class="btn red" data-action="salvage-equip-ask" data-key="' + key + '">拆解回收</button></div>';""")

# ①-4 撤回采集（两处入口）→ 二次确认
rep(U, """          '<button class="btn sm red" data-action="gather-abandon" data-id="' + g.id + '">撤回</button></td>' +""",
"""          '<button class="btn sm red" data-action="gather-abandon-ask" data-id="' + g.id + '">撤回</button></td>' +""")
rep(U, """              '<button class="btn sm" data-action="gather-abandon" data-id="' + g.id + '">撤回（无收益）</button>' +""",
"""              '<button class="btn sm" data-action="gather-abandon-ask" data-id="' + g.id + '">撤回（无收益）</button>' +""")

# ①-5 取消建造（三处入口）→ 二次确认
rep(U, """'<button class="btn sm red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +""",
"""'<button class="btn sm red" data-action="cancel-build-ask" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +""")
rep(U, """'<button class="btn sm red" data-action="cancel-build" data-kind="wall">取消施工</button>' +""",
"""'<button class="btn sm red" data-action="cancel-build-ask" data-kind="wall">取消施工</button>' +""")
rep(U, """'<button class="btn sm red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +""",
"""'<button class="btn sm red" data-action="cancel-build-ask" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +""")

# ①-6 随机任务换新（单条 / 全部）→ 二次确认
rep(U, """'<button class="btn sm" data-action="reroll-all-rand" style="margin-left:auto;">全部换新（' + U.fmt(GAME.randQuestRerollAllCost()) + '金）</button></div>' +""",
"""'<button class="btn sm" data-action="reroll-all-rand-ask" style="margin-left:auto;">全部换新（' + U.fmt(GAME.randQuestRerollAllCost()) + '金）</button></div>' +""")
rep(U, """foot += '<button class="btn red" data-action="reroll-rand-quest" data-q="' + def.id + '">放弃并换一条（'
        + U.fmt(GAME.randQuestRerollCost()) + '金）</button>';""",
"""foot += '<button class="btn red" data-action="reroll-rand-quest-ask" data-q="' + def.id + '">放弃并换一条（'
        + U.fmt(GAME.randQuestRerollCost()) + '金）</button>';""")

# ①-7 新增「危险动作确认弹窗」段（统一放一处，排在解雇确认之后）
DANGER_SECTION = """
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
  ui.openGatherAbandonAsk = function (id) {
    var g = null;
    (GAME.gatherList() || []).forEach(function (x) { if (x.id === id) g = x; });
    if (!g) { ui.toast('采集队不存在'); return; }
    var tn = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : g.type;
    var y = GAME.gatherYield(g) || {};
    var html = '<div class="gold-heading">🏳 撤回采集队 · ' + U.escape(tn) + ' Lv' + (g.level || 1) + '</div>';
    html += '<div class="attr"><span class="k">兵力</span><span class="v">' + U.fmt(g.troops || 0) + '（撤回后全数归还）</span></div>';
    html += '<div class="attr"><span class="k">本轮预计收成</span><span class="v" style="color:var(--red-light);">'
      + U.fmt(y.amount || 0) + ' ' + (ui.RES_NAME[y.res] || '') + '（放弃）</span></div>';
    html += '<div class="note">撤回后本轮采集<b>无收益</b>（与「收获」不同）。兵力会归还，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="gather-abandon-do" data-id="' + id + '">确定撤回</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 取消建造 / 升级 —— 按剩余进度返还 80%（已投入的 20% 与已耗时间不返还） */
  ui.openCancelBuildAsk = function (kind, idx) {
    var info = GAME.cancelRefundOf ? GAME.cancelRefundOf(kind, idx) : { ok: false, msg: '' };
    if (!info.ok) { ui.toast(info.msg || '没有进行中的建造'); return; }
    var isUp = (info.q.type === 'upgrade' || info.q.type === 'ext_upgrade');
    var kn = kind === 'wall' ? '城墙施工' : (kind === 'ext' ? '城外' + (isUp ? '升级' : '建造') : (isUp ? '升级' : '建造'));
    var html = '<div class="gold-heading">⏹ 取消' + kn + '</div>';
    html += '<div class="attr"><span class="k">按剩余进度返还</span><span class="v good">'
      + U.fmt(info.total) + ' 资源（' + Math.round(info.remainRatio * 80) + '%）</span></div>';
    html += '<div class="note">已投入的 20% 与已耗时间<b>不返还</b>。取消后地块空出，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="cancel-build-do" data-kind="' + kind + '" data-idx="' + (idx == null || isNaN(Number(idx)) ? 0 : Number(idx)) + '">确定取消</button>'
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
    html += '<div class="attr"><span class="k">换新数量</span><span class="v">' + n + ' 项随机任务</span></div>';
    html += '<div class="note">当前 ' + n + ' 项随机任务将<b>全部作废</b>并重新抽取。是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="reroll-all-rand-do">确定全部换新</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 单槽位更换（v88：按**当前生效套**过滤候选与槽名；修炼件附「蕴养」入口） */"""
rep(U, """
  /* 单槽位更换（v88：按**当前生效套**过滤候选与槽名；修炼件附「蕴养」入口） */""",
DANGER_SECTION)

# ============================================================
# ② js/domain.js —— cancelRefundOf 唯一出口（预告与执行同源）
# ============================================================
D = 'js/domain.js'
rep(D, """  GAME.cancelBuild = function (kind, idx, cityId) {
    var s = GAME.state;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var qi = -1, q = null;
    for (var i = 0; i < s.queues.build.length; i++) {
      var x = s.queues.build[i];
      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId；
         城墙（wall）无下标，按类型 + 城池匹配 */
      var hit = kind === 'wall'
        ? (x.type === 'wall' && (!cur || !x.cityId || x.cityId === cur.id))
        : kind === 'city'
          ? (x.gridIndex === idx && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))
          : (x.extIdx === idx && (x.type === 'ext_build' || x.type === 'ext_upgrade') && (!cur || !x.cityId || x.cityId === cur.id));
      if (hit) { qi = i; q = x; break; }
    }
    if (!q) return { ok: false, msg: '没有进行中的建造' };
    /* 反查成本 */
    var cost = null;
    if (q.type === 'build') cost = DATA.BUILDINGS[q.buildId].buildCost;
    else if (q.type === 'upgrade') cost = DATA.BUILDINGS[q.buildId].levelCost(q.targetLevel - 1);
    else if (q.type === 'wall') cost = DATA.BUILDINGS.chengqiang.levelCost(q.targetLevel - 1) || DATA.BUILDINGS.chengqiang.buildCost;
    else if (q.type === 'ext_build') cost = GAME.extBuildCost(q.buildId, 0);
    else if (q.type === 'ext_upgrade') cost = GAME.extBuildCost(q.buildId, q.targetLevel - 1);
    /* 按剩余时间比例返还 80% */
    var remainRatio = Math.max(0, 1 - q.elapsed / q.totalTime);
    var refund = {}, total = 0;
    if (cost) {
      for (var k in cost) {
        if (k === 'time') continue;
        refund[k] = Math.floor(cost[k] * remainRatio * 0.8);
        total += refund[k];
      }
      for (var k2 in refund) s.res[k2] = (s.res[k2] || 0) + refund[k2];
    }
    /* 清除 pending 标记 */
    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      if (c && c.cells[q.gridIndex]) c.cells[q.gridIndex].pending = null;
    } else {
      var qc = GAME.cityById(q.cityId);
      var qg = qc ? GAME.extGridOf(qc) : [];
      if (qg[q.extIdx]) qg[q.extIdx].pending = null;
    }
    s.queues.build.splice(qi, 1);
    GAME.log('取消建造，返还部分资源（' + Math.round(remainRatio * 80) + '%）');
    return { ok: true, msg: '已取消建造，返还 ' + U.fmt(total) + ' 资源' };
  };""",
"""  /* v89.110：「取消退还多少」抽成**唯一出口** —— 确认弹窗（先看退多少）与真执行共用，
     避免出现"面板报一个数、执行按另一个数"（本项目最经典的两出口病）。 */
  GAME.cancelRefundOf = function (kind, idx, cityId) {
    var s = GAME.state;
    var cur = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    var qi = -1, q = null;
    for (var i = 0; i < s.queues.build.length; i++) {
      var x = s.queues.build[i];
      /* 外城地块已按城池独立，同一下标在多城间会重复，必须同时匹配 cityId；
         城墙（wall）无下标，按类型 + 城池匹配 */
      var hit = kind === 'wall'
        ? (x.type === 'wall' && (!cur || !x.cityId || x.cityId === cur.id))
        : kind === 'city'
          ? (x.gridIndex === idx && (x.type === 'build' || x.type === 'upgrade') && (!cur || !x.cityId || x.cityId === cur.id))
          : (x.extIdx === idx && (x.type === 'ext_build' || x.type === 'ext_upgrade') && (!cur || !x.cityId || x.cityId === cur.id));
      if (hit) { qi = i; q = x; break; }
    }
    if (!q) return { ok: false, msg: '没有进行中的建造' };
    /* 反查成本 */
    var cost = null;
    if (q.type === 'build') cost = DATA.BUILDINGS[q.buildId].buildCost;
    else if (q.type === 'upgrade') cost = DATA.BUILDINGS[q.buildId].levelCost(q.targetLevel - 1);
    else if (q.type === 'wall') cost = DATA.BUILDINGS.chengqiang.levelCost(q.targetLevel - 1) || DATA.BUILDINGS.chengqiang.buildCost;
    else if (q.type === 'ext_build') cost = GAME.extBuildCost(q.buildId, 0);
    else if (q.type === 'ext_upgrade') cost = GAME.extBuildCost(q.buildId, q.targetLevel - 1);
    /* 按剩余时间比例返还 80% */
    var remainRatio = Math.max(0, 1 - q.elapsed / q.totalTime);
    var refund = {}, total = 0;
    if (cost) {
      for (var k in cost) {
        if (k === 'time') continue;
        refund[k] = Math.floor(cost[k] * remainRatio * 0.8);
        total += refund[k];
      }
    }
    return { ok: true, qi: qi, q: q, remainRatio: remainRatio, refund: refund, total: total };
  };
  GAME.cancelBuild = function (kind, idx, cityId) {
    var s = GAME.state;
    var info = GAME.cancelRefundOf(kind, idx, cityId);
    if (!info.ok) return info;
    var q = info.q, qi = info.qi, refund = info.refund, total = info.total;
    for (var k2 in refund) s.res[k2] = (s.res[k2] || 0) + refund[k2];
    /* 清除 pending 标记 */
    if (kind === 'city') {
      var c = GAME.cityById(q.cityId);
      if (c && c.cells[q.gridIndex]) c.cells[q.gridIndex].pending = null;
    } else {
      var qc = GAME.cityById(q.cityId);
      var qg = qc ? GAME.extGridOf(qc) : [];
      if (qg[q.extIdx]) qg[q.extIdx].pending = null;
    }
    s.queues.build.splice(qi, 1);
    GAME.log('取消建造，返还部分资源（' + Math.round(info.remainRatio * 80) + '%）');
    return { ok: true, msg: '已取消建造，返还 ' + U.fmt(total) + ' 资源' };
  };""")

# ============================================================
# ③ js/main.js —— 六个动作改两段式分发
# ============================================================
M = 'js/main.js'
rep(M, """      /* v89.99（老板「设计兵种解散」）：解散归农 —— 数量取同一输入框 */
      case 'troop-disband': {
        var dBc = GAME.currentCity();
        var dBn = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
        var dBr = GAME.disbandAt(dBc && dBc.id, el.dataset.troop, dBn);
        ui.toast((dBr.ok ? '🕊 ' : '') + dBr.msg);
        if (dBr.ok) { GAME.refreshAll(); ui.renderTroopsModal(); }
        break;
      }""",
"""      /* v89.99（老板「设计兵种解散」）：解散归农 —— 数量取同一输入框。
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
      }""")

rep(M, """      case 'salvage-equip': GAME.doSalvage(el.dataset.key); break;""",
"""      /* v89.110：拆解 = 销毁该件 —— 两段式（确认弹窗由 ui.openSalvageConfirm 渲染） */
      case 'salvage-equip-ask': ui.openSalvageConfirm(el.dataset.key); break;
      case 'salvage-equip-do': GAME.doSalvage(el.dataset.key); break;""")

rep(M, """      case 'gather-abandon': GAME.doAbandonGather(el.dataset.id); break;""",
"""      /* v89.110：撤回采集 = 本轮无收益 —— 两段式 */
      case 'gather-abandon-ask': ui.openGatherAbandonAsk(el.dataset.id); break;
      case 'gather-abandon-do': GAME.doAbandonGather(el.dataset.id); break;""")

rep(M, """      case 'cancel-build': GAME.doCancelBuild(el.dataset.kind, Number(el.dataset.idx)); break;""",
"""      /* v89.110：取消建造 = 扣 20% 与已耗时间 —— 两段式（先看退多少，再执行） */
      case 'cancel-build-ask': ui.openCancelBuildAsk(el.dataset.kind, Number(el.dataset.idx)); break;
      case 'cancel-build-do': GAME.doCancelBuild(el.dataset.kind, Number(el.dataset.idx)); break;""")

rep(M, """      case 'reroll-rand-quest': GAME.doRerollRandQuest(el.dataset.q); break;
      case 'reroll-all-rand': GAME.doRerollAllRand(); break;""",
"""      /* v89.110：换任务 = 付工本费 + 旧任务作废 —— 两段式 */
      case 'reroll-rand-quest-ask': ui.openRerollRandAsk(el.dataset.q); break;
      case 'reroll-rand-quest-do': GAME.doRerollRandQuest(el.dataset.q); ui.closeModal(); break;
      case 'reroll-all-rand-ask': ui.openRerollAllAsk(); break;
      case 'reroll-all-rand-do': GAME.doRerollAllRand(); ui.closeModal(); break;""")

# ============================================================
# 落盘（两阶段提交：全部命中后才写）
# ============================================================
for f in files:
    p = os.path.join(R, f)
    io.open(p, 'w', encoding='utf-8', newline='').write(new[f])
print('[落盘] 3 个文件已更新')

# ============================================================
# 自检
# ============================================================
ok = True
for f in files:
    r = subprocess.run([NODE, '--check', os.path.join(R, f)], capture_output=True, text=True)
    if r.returncode != 0:
        ok = False
        print('[语法失败] ' + f + '\n' + r.stderr[:500])
print('[自检] node --check：' + ('全部通过' if ok else '有失败'))

ui = new['ui.js']
for pat, want, name in [
    ('data-action="troop-disband"', False, '解散裸入口'),
    ('data-action="troop-disband-ask"', True, '解散 ask'),
    ('data-action="troop-disband-do"', True, '解散 do（在确认弹窗里）'),
    ('op-zone danger', True, '危险区外壳'),
    ('data-action="salvage-equip"', False, '拆解裸入口'),
    ('data-action="gather-abandon"', False, '撤回裸入口'),
    ('data-action="cancel-build"', False, '取消建造裸入口'),
    ('data-action="reroll-all-rand"', False, '批量换新裸入口'),
    ('data-action="reroll-rand-quest"', False, '单条换新裸入口'),
]:
    hit = (pat in ui)
    status = 'OK' if hit == want else '!!异常!!'
    if hit != want:
        ok = False
    print('  [%s] %s（期望%s）' % (status, name, '存在' if want else '不存在'))
print('[完成] ' + ('✔ 全部通过' if ok else '✘ 有异常，检查上方输出'))

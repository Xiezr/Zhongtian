# v89.142 D1：需求 6（全带→上限）+ 需求 7（斗将播报与 rec.sim 修复）
# 跑法：python .workbuddy/tools/patch/v89142_d1_fill_duel.py
import io
PU = 'E:/Deepseekdb/js/ui.js'
PM = 'E:/Deepseekdb/js/main.js'
PB = 'E:/Deepseekdb/js/battle.js'
PH = 'E:/Deepseekdb/index.html'
bu = io.open('E:/Deepseekdb/backup/v89142/ui.js.before', encoding='utf-8', newline='').read()
bm = io.open('E:/Deepseekdb/backup/v89142/main.js.before', encoding='utf-8', newline='').read()
bb = io.open('E:/Deepseekdb/backup/v89142/battle.js.before', encoding='utf-8', newline='').read()
bh = io.open('E:/Deepseekdb/backup/v89142/index.html.before', encoding='utf-8', newline='').read()

def patch(P, bak, pairs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in pairs:
        if new in s and old not in s:      # 幂等守卫：本段已落（重跑时跳过）
            print('SKIP(已落) ' + tag); continue
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        print('OK ' + tag)
    assert '\r\n' not in s
    assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏[' + P + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('WROTE ' + P + ' len ' + str(len(s)))

# ============ battle.js：修复 rec.sim 丢 duel/genSim（斗将真根因） ============
patch(PB, bb, [
 ("""      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             /* v89.118：战斗加成快照随挂起会话走（结算与重跑同源） */
             boost: simIn.boost || null },""",
  """      sim: { scArmy: U.deep(simIn.scArmy || {}), scVal: simIn.scVal || 0,
             scGen: simIn.scGen ? U.deep(simIn.scGen) : null,
             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             /* v89.142（老板 7）：「斗将战从未触发」（真因：这里漏存两字段）——
                挂起前 `_doDuel()` 的成果必须**随会话走**，否则结算读取时：
                  · duel → undefined：战报没有【斗将】段、回合战况无从播报；
                  · genSim → undefined：我方斗将加成丢失（守方 scGen 带加成生效 → 只给对面加成）。
                重放（_makeEnv）同样要读这两份 —— 不然沙盘与史实对不上。 */
             duel: simIn.duel ? U.deep(simIn.duel) : null,
             genSim: simIn.genSim ? U.deep(simIn.genSim) : null,
             /* v89.118：战斗加成快照随挂起会话走（结算与重跑同源） */
             boost: simIn.boost || null },""",
  'b-sim存duel'),
 ("""  GAME.battle._makeEnv = function (rec) {
    var s = GAME.state;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    var env = GAME.tactic.begin(rec.atkArmy, gen, rec.sim.scArmy || {}, rec.sim.scVal || 0,
      rec.sim.scGen || null, rec.sim.simOpts || {});""",
  """  GAME.battle._makeEnv = function (rec) {
    var s = GAME.state;
    var gen = null;
    (s.generals || []).forEach(function (g) { if (g.id === rec.genId) gen = g; });
    /* v89.142（老板 7）：重放用**斗将后的那份主将**（rec.sim.genSim）——
       否则史实（结算读 genSim）与重放（读原件）在将领属性上差一个 +10%，verify 必假红。 */
    var _genSimD = rec.sim.genSim || gen;
    var env = GAME.tactic.begin(rec.atkArmy, _genSimD, rec.sim.scArmy || {}, rec.sim.scVal || 0,
      rec.sim.scGen || null, rec.sim.simOpts || {});""",
  'b-重放用genSim'),
])

# ============ ui.js：需求 7 回合战况播报 + 需求 6 上限出口 ============
patch(PU, bu, [
 ("""  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    /* v89.116（老板需求 8）：上 = 三列（兵种列表 · 战场 · 兵种列表）；
       下 = **战况回合播报**（一回合一行，行动与战果同行）。 */
    return ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log"></div>';
  };""",
  """  /* ============================================================
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
  ui.btDuelHTML = function (rec) {
    var d = (rec && rec.sim && rec.sim.duel) || null;
    if (!d || !d.done) return '';
    var side = (d.winner === 'atk') ? '我方' : '敌方';
    var pct = Math.round((d.bonusPct == null ? 0.10 : d.bonusPct) * 100);
    var line = '⚔ 战前斗将：' + (d.rounds || 3) + ' 合，' + side + '将领 ' + (d.winnerName || '') +
      ' 胜（' + (d.wa || 0) + ' : ' + (d.wb || 0) + '）· 其全军 +' + pct + '%（限本战）';
    return '<div class="bt-ev duel">' + U.escape(line) + '</div>';
  };
  ui.battlefieldHTML = function (rec) {
    var ses = GAME._bsess && GAME._bsess[rec.id];
    var snap = rec.snapLast || (ses ? ses.snap() : null) ||
      { round: rec.round || 0, field: 0, atk: [], def: [], towers: null };
    /* v89.116（老板需求 8）：上 = 三列（兵种列表 · 战场 · 兵种列表）；
       下 = **战况回合播报**（一回合一行，行动与战果同行）。
       v89.142：播报窗**预置战前斗将行**（重绘即恢复，不额外挂载）。 */
    return ui.btTopHTML(rec, snap) + ui.btBoardHTML(snap) +
      '<div class="bt-log" id="bt-log">' + ui.btDuelHTML(rec) + '</div>';
  };""",
  'u-btDuelHTML'),
 ("""        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">全带</th>' +""",
  """        '<th>兵种</th><th class="num">拥有</th><th class="ctr">出征数量</th><th class="ctr">上限</th>' +""",
  'u-表头上限'),
 ("""      '<button class="btn sm" data-action="exp-fill-all">全带</button>' +""",
  """      /* v89.142（老板 6）：表头「全带」→「**上限**」—— 点击按"本次出征的总人数上限"自动填入
         （口径见 ui.expFillCapOf 唯一出口；title 写明本次的算法）。 */
      '<button class="btn sm" data-action="exp-fill-all" title="' + U.escape(ui.expFillTipOf(c, cur.id)) + '">上限</button>' +""",
  'u-按钮改上限'),
 ("""  ui.openExpModal = function (target, opts138) {""",
  """  /* ============================================================
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

  ui.openExpModal = function (target, opts138) {""",
  'u-expFillCapOf'),
])

# ============ main.js：上限按钮的实装 ============
patch(PM, bm, [
 ("""      /* v74（老板：完善出征界面）：全带 / 清空（只改输入框值，刷新仍走 updateExpMarch） */
      case 'exp-fill-all': (function () {
        var c74 = GAME.currentCity();
        Object.keys((c74 && c74.army) || {}).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (i74) i74.value = i74.max;
        });
        ui.updateExpMarch();
      })(); break;""",
  """      /* v74：全带 / 清空（只改输入框值，刷新仍走 updateExpMarch）
         v89.142（老板 6）：「全带」→「**上限**」—— 按 ui.expFillCapOf（唯一出口）的总人数额度，
         按兵种表顺序（= 表格行序）依次取 min(拥有, 剩余额度) 自动填入；
         额度为 null（不限：无校场等）时退回"全带"语义。 */
      case 'exp-fill-all': (function () {
        var c74 = GAME.currentCity();
        var cap142 = ui.expFillCapOf ? ui.expFillCapOf(c74, ui._expRes, ui._expMode) : null;
        var remain142 = (cap142 == null) ? null : cap142;
        Object.keys(DATA.TROOPS).forEach(function (id) {
          var i74 = document.getElementById('exp-' + id);
          if (!i74 || i74.disabled) return;
          var own74 = Number(i74.max) || 0;
          var n74 = own74;
          if (remain142 != null) n74 = Math.min(n74, remain142);
          i74.value = n74;
          if (remain142 != null) remain142 -= n74;
        });
        ui.updateExpMarch();
        if (cap142 != null) {
          var men142 = 0;
          Object.keys(DATA.TROOPS).forEach(function (id) {
            var i75 = document.getElementById('exp-' + id);
            if (i75) men142 += Number(i75.value) || 0;
          });
          ui.toast('已按上限填入（额度 ' + U.fmt(cap142) + ' 人 · 实填 ' + U.fmt(men142) + ' 人）');
        } else {
          ui.toast('已全带（本次不设上限）');
        }
      })(); break;""",
  'm-上限实装'),
])

# ============ index.html：斗将行样式（顺手清一处重复定义） ============
patch(PH, bh, [
 ("""  .bt-ev.round { color: var(--parchment); }
  /* 回合之间的**虚线间隔**（老板原话「不同回合之间虚线间隔」） */
  .bt-ev.sep { height: 0; border-top: 1px dashed rgba(var(--gold-soft-rgb), .38); margin: var(--sp-2) 0; }
  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  .bt-ev.atk { color: var(--parchment); font-variant-numeric: tabular-nums; }
  .bt-ev.def { color: var(--red-light); font-variant-numeric: tabular-nums; }
  /* 回合之间的**虚线间隔**（老板原话「不同回合之间虚线间隔」） */
  .bt-ev.sep { height: 0; border-top: 1px dashed rgba(var(--gold-soft-rgb), .38); margin: var(--sp-2) 0; }
  /* 回合头（第 N 回合 · 间距） */
  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  /* 逐兵种行：我方暖白 / 敌方红 —— 与两侧列表的语义色一致 */
  .bt-ev.atk { color: var(--parchment); font-variant-numeric: tabular-nums; }
  .bt-ev.def { color: var(--red-light); font-variant-numeric: tabular-nums; }""",
  """  .bt-ev.round { color: var(--parchment); }
  /* 回合之间的**虚线间隔**（老板原话「不同回合之间虚线间隔」） */
  .bt-ev.sep { height: 0; border-top: 1px dashed rgba(var(--gold-soft-rgb), .38); margin: var(--sp-2) 0; }
  /* 回合头（第 N 回合 · 间距） */
  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  /* 逐兵种行：我方暖白 / 敌方红 —— 与两侧列表的语义色一致 */
  .bt-ev.atk { color: var(--parchment); font-variant-numeric: tabular-nums; }
  .bt-ev.def { color: var(--red-light); font-variant-numeric: tabular-nums; }
  /* v89.142（老板 7）：战前斗将行 —— 播报窗最底的固定一条（金底左条，与回合行区分）。
     ⛔ 同段原有一处 `.bt-ev.sep/.hdr` 重复定义（逐字节相同、后者空转）随本次一并清掉。 */
  .bt-ev.duel { color: var(--gold-light); border-left: 2px solid var(--gold-dark); padding-left: 6px; margin-bottom: 4px; }""",
  'h-duel行样式'),
])

print('ALL OK')

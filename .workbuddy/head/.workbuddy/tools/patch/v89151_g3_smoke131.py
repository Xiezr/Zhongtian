# -*- coding: utf-8 -*-
"""v89.151 批 G3：smoke 新增 §131 门禁节（本轮 8 条 + 3 条旧账）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()

ANCHOR = """    })());
  })();
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

SEC = """    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §131（v89.151）：老板 8 条 + 3 条旧账 ——
   *   缩放限幅 / 底栏指挥战斗 / 逐回合关键帧 / 悬停重做（血 NaN 根因）/
   *   距离读数 / 声望 500 / 打最近兜底 / 侧栏版式 / 野地按钮规格
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs131 = require('fs'), p131 = require('path');
    var m131 = fs131.readFileSync(p131.join(__dirname, 'js', 'main.js'), 'utf8');
    var t131 = fs131.readFileSync(p131.join(__dirname, 'js', 'tactic.js'), 'utf8');
    var u131s = fs131.readFileSync(p131.join(__dirname, 'js', 'ui.js'), 'utf8');
    var h131 = fs131.readFileSync(p131.join(__dirname, 'index.html'), 'utf8');
    var _r131a = '', _r131c = '', _r131f = '', _r131g = '';

    /* ---- ① 缩放限幅（DATA.APP_SCALE 唯一旋钮 · fitAppSize 读它） ---- */
    check('§131① 缩放限幅 0.6~1.6（DATA.APP_SCALE 唯一旋钮 · fitAppSize 实夹）', (function () {
      var fn = codeOf(m131, 'function fitAppSize()');
      var sc = DATA.APP_SCALE || null;
      _r131a = 'APP_SCALE=' + JSON.stringify(sc);
      return !!sc && sc.min === 0.6 && sc.max === 1.6
        && /Math\\.min\\(w \\/ 1440, h \\/ 900\\)/.test(fn)
        && /Math\\.max\\(_sc151\\.min, Math\\.min\\(_sc151\\.max, k\\)\\)/.test(fn);
    })(), _r131a);

    /* ---- ② 兵牌三档（老板「按目前」= 28/32/36 锁定，本轮不动） ---- */
    check('§131② 兵牌三档维持 28/32/36（老板「按目前」· 三种形态 CSS 在册）', (function () {
      return /\\.bt-unit\\.inf \\{ --u-w: 28px;/.test(h131)
        && /\\.bt-unit\\.cav \\{ --u-w: 32px;/.test(h131)
        && /\\.bt-unit\\.siege \\{ --u-w: 36px;/.test(h131);
    })());

    /* ---- ③ 底栏「指挥战斗」+「隐藏名称」（文案动态 · 闪烁 · case 在册） ---- */
    check('§131③ 底栏 .bb-tools 两枚同级按钮 + 「指挥战斗」case + 闪烁（CSS/主循环/出口）', (function () {
      var pb = codeOf(u131s, 'ui.paintBottom = function');
      var beacon = codeOf(u131s, 'ui.paintWarBeacon = function');
      _r131c = 'pb 含 bb-tools=' + /bb-tools/.test(pb) + ' · 名称动态=' + /隐藏名称/.test(pb) + /显示名称/.test(pb)
        + ' · beacon=' + /battleListOf\\(\\)\\.length > 0/.test(beacon);
      return /bb-tools/.test(pb) && /⚔ 指挥战斗/.test(pb)
        && /隐藏名称/.test(pb) && /显示名称/.test(pb)
        && /data-action="battle-list-open"/.test(pb)
        /* 闪烁出口：只切 class（不重建 DOM） */
        && /ui\\.paintWarBeacon = function/.test(u131s)
        && /classList\\.contains\\('blink'\\)/.test(beacon)
        /* 主循环每秒核对 + case 在册 + CSS 动画 */
        && /ui\\.paintWarBeacon\\(\\);/.test(m131)
        && /case 'battle-list-open': ui\\.openBattleList\\(\\); break;/.test(m131)
        && /\\.bb-war\\.blink \\{ \\//.test(h131.replace(/\\s+/g, ' ')) === false
        && /@keyframes bbWarPulse/.test(h131);
    })(), _r131c);

    /* ---- ④ 逐回合关键帧（老板「逐个回合复盘有作用」→ maxFrames 覆盖回合上限） ---- */
    check('§131④ 关键帧逐回合覆盖（maxFrames=40 ≥ 回合上限 30 · 实调帧数 ≤ maxFrames）', (function () {
      var r = G.battle.simulate({ changqiang: 400 }, null, { yibing: 400 }, 0, null, { kind: 'wild' });
      var rf = G.battle.replayFramesOf(r);
      if (!rf || !rf.frames) { _r131c = 'replayFramesOf 返回空'; return false; }
      _r131c = 'maxFrames=' + DATA.REPLAY.maxFrames + ' rounds=' + (r.rounds || 0) + ' frames=' + rf.frames.length;
      return DATA.REPLAY.maxFrames === 40 && DATA.REPLAY.maxFrames >= 30
        && rf.frames.length >= 2 && rf.frames.length <= DATA.REPLAY.maxFrames
        && rf.frames[0].r >= 1 && rf.frames[rf.frames.length - 1].r === rf.rounds;
    })(), _r131c);

    /* ---- ⑤ 悬停重做：快照字段对账（§56.1 规矩）+ 克制出口 + 五段排版 ---- */
    check('§131⑤ 快照字段对账：snap 含引擎消费的 6 字段 · unitFinalOf.hp 非 NaN · totalDef 在册', (function () {
      var env = G.tactic.begin({ changqiang: 100 }, null, { yibing: 100 }, 0, null, { kind: 'wild' });
      var sn = env.snap();
      var u = sn && sn.atk && sn.atk[0];
      if (!u) { _r131f = '无快照单位'; return false; }
      var need = ['hpPer', 'cover', 'atkPct', 'defPct', 'start', 'sortie'];
      var miss = need.filter(function (k) { return !(k in u); });
      var f = G.battle.unitFinalOf(u, null);
      _r131f = 'miss=' + JSON.stringify(miss) + ' hp=' + (f && f.hp) + ' totalDef=' + (f && f.totalDef);
      return miss.length === 0 && !!f && isFinite(f.hp) && f.hp > 0
        && f.totalDef === f.def * f.count
        /* 源码侧同判（防"快照修了、cp 又漏"） */
        && /hpPer: u\\.hpPer, cover: u\\.cover \\|\\| 0, atkPct: u\\.atkPct \\|\\| 0, defPct: u\\.defPct \\|\\| 0,/.test(t131);
    })(), _r131f);

    check('§131⑤ 克制反查唯一出口 troopCounterOf（长枪克骑 / 刀盾抗箭 / 弓箭被克）', (function () {
      var cq = G.ui.troopCounterOf('changqiang');
      var dd = G.ui.troopCounterOf('daodun');
      var gj = G.ui.troopCounterOf('gongjian');
      _r131f = '枪克=' + (cq ? cq.beats.length : -1) + ' 盾抗=' + (dd ? dd.resists.length : -1)
        + ' 弓被克=' + (gj ? gj.beaten.length : -1);
      return cq && cq.beats.some(function (x) { return x.id === 'qingji' && x.mul === 3; })
        && dd && dd.resists.some(function (x) { return x.id === 'gongjian'; })
        && gj && gj.beaten.some(function (x) { return x.id === 'daodun'; })
        && G.ui.troopCounterOf('__nope__') === null;
    })(), _r131f);

    check('§131⑤ 悬停富浮层：五段排版 + 绿红克制 + 血非零（实调 btUnitTip）', (function () {
      var snap = { field: 1400, towers: null, atk: [], def: [] };
      var u = { id: 'changqiang', name: '长枪兵', count: 6000, hpPer: 1800, cover: 1,
        atkPct: 0, defPct: 0, adv: 100, spd: 300, range: 50, stance: 'advance', target: '' };
      /* btUnitTip 需要 ui._bt 上下文取将领 —— 置空 rec 也要能出 HTML（无将领分支） */
      var btBak = G.ui._bt; G.ui._bt = null;
      var html = G.ui.btUnitTip(u, 'atk');
      G.ui._bt = btBak;
      _r131g = 'tip 长度=' + html.length;
      return /class="tip-t"/.test(html) && /数量 <b>/.test(html) && /射程 <b>/.test(html)
        && /全军血量 <b>/.test(html) && /全军攻击 <b>/.test(html) && /全军防御 <b>/.test(html)
        && /cnt-good/.test(html) && /无将领带队/.test(html)
        /* 兵牌与侧栏两处都挂富浮层（data-tip-el + .tip-src） */
        && (u131s.match(/data-tip-el="1"/g) || []).length >= 2
        && /class="tip-src"/.test(u131s);
    })(), _r131g);

    /* ---- ⑥ 距离读数（旧账 7 · 出口断言） ---- */
    check('§131⑥ 距离读数「距离 XX / XX」唯一出口（无「最近距离/全局」字样）', (function () {
      _r131g = G.ui.gapReadOf(30, 2600);
      return G.ui.gapReadOf(30, 2600) === '距离 <b>30</b> / <b>2,600</b>'
        && G.ui.gapReadOf(30, null) === '距离 <b>30</b>'
        && u131s.indexOf('最近距离 <b>') < 0;
    })(), _r131g);

    /* ---- ⑦ 声望封顶 500（旧账 1） ---- */
    check('§131⑦ 声望单场封顶 500（DATA.REP_RULE.cap）', (function () {
      var big = G.battle.repGainOf({ win: true, mine: { changqiang: 10 }, foe: { changqiang: 400000 }, foeLoss: { changqiang: 400000 } });
      _r131g = 'cap=' + DATA.REP_RULE.cap + ' big=' + big.gain;
      return DATA.REP_RULE.cap === 500 && big.capped === true && big.gain === 500;
    })(), _r131g);

    /* ---- ⑧ 打最近兜底（旧账 4：指定兵种不在场 → 打最近） ---- */
    check('§131⑧ 指定目标不在场 → 回落"打最近的"（实调：指定打"铁骑兵"，敌阵只有义兵）', (function () {
      var r = G.battle.simulate({ changqiang: 400 }, null, { yibing: 400 }, 0, null,
        { kind: 'wild', stances: { atk: { changqiang: { s: 'advance', t: 'tieji' } } } });
      var lost = 0;
      for (var k in (r.defLossBy || {})) lost += r.defLossBy[k] || 0;
      _r131g = 'rounds=' + (r.rounds || 0) + ' defLoss=' + lost + ' winner=' + r.winner;
      /* 敌方义兵被真打掉（不是"站着不动到 30 回合"） */
      return lost > 0 && (r.rounds || 0) >= 1;
    })(), _r131g);

    /* ---- ⑨ 侧栏版式（简称放大 · 同宽 48 · 下拉等长居右 · 居中） ---- */
    check('§131⑨ 侧栏版式：简称 13px/700 与数量同宽 48px · 表头与将领行居中', (function () {
      return /\\.bt-l1 \\.bt-rnm \\{ flex: 0 0 48px; min-width: 0; font-size: var\\(--fs-h3\\); font-weight: 700;/.test(h131)
        && /\\.bt-l2 \\.bt-rn \\{ flex: 0 0 48px; min-width: 0; font-size: var\\(--fs-h3\\); font-weight: 700;/.test(h131)
        && /\\.bt-side-h \\{[^}]*text-align: center;/.test(h131)
        && /\\.bt-gen \\{[^}]*justify-content: center;/.test(h131);
    })());

    /* ---- ⑩ 野地按钮规格（文案 / 等长 / 统一规格 · 其他弹窗共用） ---- */
    check('§131⑩ 野地面板「⛏️ 采集」+ op-zone-eq 等长（半行宽）+ 禁用态统一 + 建筑键共用规格', (function () {
      return u131s.indexOf('>⚙️ 设置采集</button>') < 0
        && (u131s.match(/op-zone-eq/g) || []).length === 3
        && /\\.op-zone-eq \\.op-row > \\.btn \\{ flex: 0 0 auto; width: calc\\(\\(100% - var\\(--sp-3\\)\\) \\/ 2\\); \\}/.test(h131)
        && /\\.op-zone-eq \\.op-row > \\.btn:disabled,\\s*\\n  \\.bldg-acts > \\.btn:disabled,\\s*\\n  \\.bldg-foot > \\.btn:disabled \\{ opacity: \\.55;/.test(h131);
    })());

    /* ---- ⑪ 档案在册 ---- */
    check('§131⑪ 需求档案在册（v89.151 · 指挥战斗 / 逐回合 / 血 NaN / 封顶500）', (function () {
      var a = fs131.readFileSync(p131.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.151') >= 0 && a.indexOf('指挥战斗') >= 0
        && a.indexOf('逐回合') >= 0 && a.indexOf('血都是零') >= 0
        && a.indexOf('500') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

s = s.replace(ANCHOR, SEC)
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke §131 落盘 OK · len=' + str(len(s)))

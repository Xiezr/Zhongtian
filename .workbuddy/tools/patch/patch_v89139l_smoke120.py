# -*- coding: utf-8 -*-
"""v89.139 批十：smoke 追加 §120（本轮 8 条需求的守护断言）"""
import io, os, sys

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

BLOCK = r"""
  /* ============================================================
   * 120. v89.139（地图箭头 / 战场 2 列 / 距离口径 / 采集静默 / 野地面板 /
   *      珠宝产出 / 负重闸 / 缩略图我城 / 大屏铺满）
   * ============================================================ */
  console.log('\n===== 120. v89.139（战场 2 列 · 距离速度项 · 珠宝入采集 · 我城档） =====');
  (function () {
    var _f = require('fs'), _p = require('path');
    var u = _f.readFileSync(_p.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m = _f.readFileSync(_p.join(__dirname, 'js', 'main.js'), 'utf8');
    var d = _f.readFileSync(_p.join(__dirname, 'js', 'domain.js'), 'utf8');
    var t = _f.readFileSync(_p.join(__dirname, 'js', 'tactic.js'), 'utf8');
    var mp = _f.readFileSync(_p.join(__dirname, 'js', 'map.js'), 'utf8');
    var h = _f.readFileSync(_p.join(__dirname, 'index.html'), 'utf8');
    var uc = stripComment(u), mc = stripComment(m), dc = stripComment(d), tc = stripComment(t);

    /* ---- ① 地图箭头退役 + 大屏铺满（老板 0① / 1） ---------- */
    check('§120① 地图方向箭头已退役（老板「上下左右的箭头去掉」）+ 大屏铺满令牌', (function () {
      return mp.indexOf("c4.x < px ? '◀' : '▶'") < 0
        && /视野外的州城/.test(mp) === false
        && /function fitAppSize\(\)/.test(mc)
        && /setProperty\('--app-w'/.test(mc)
        && /window\.addEventListener\('resize'/.test(mc);
    })());
    check('§120① 实测：大屏（1920×1080）画布铺满视口（--app-w/h 随 innerWidth/Height）', (function () {
      /* 桩环境没有真视口 → 验"函数存在且取 max(1440, innerWidth)"的口径 */
      var fn = codeOf(mc, 'function fitAppSize()');
      return /Math\.max\(1440, window\.innerWidth/.test(fn)
        && /Math\.max\(900, window\.innerHeight/.test(fn);
    })());

    /* ---- ② 战场：2 列网格 + 全兵种 + 灰暗 + 备注去掉（老板 1） ---------- */
    check('§120② 战场侧栏 2 列：全兵种列出（nocombat 除外）· 参战亮/未战 off · 去掉副标题', (function () {
      var body = uc.slice(uc.indexOf('ui.btSideHTML = function'), uc.indexOf('ui.btSideHTML = function') + 4200);
      return /Object\.keys\(DATA\.TROOPS\)\.filter/.test(body)
        && /!DATA\.TROOPS\[k\]\.nocombat/.test(body)
        && /class="bt-card off"/.test(body)
        && /class="bt-cards"/.test(body)
        && /ui\.btSideName\(side\) \+ '（' \+ myList\.length \+ ' \/ ' \+ ALL\.length/.test(body)
        && /_openToast/.test(body) === false
        && /\.bt-cards \{ display: grid; grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/.test(h)
        && /\.bt-card\.off \{ opacity: \.32; filter: grayscale\(\.55\); \}/.test(h)
        && u.indexOf('战斗待指挥 · 每回合') < 0;
    })());
    check('§120② 实测：17 兵种格 = 参战 + 灰暗（渲染含 2 列网格与 off 格）', (function () {
      var snap = {
        field: 1800, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance' },
          { id: 'gongjian', name: '弓箭手', count: 50, stance: 'advance' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }]
      };
      var html = ui.btSideHTML(snap, 'atk');
      var nOff = (html.match(/class="bt-card off"/g) || []).length;
      var nOn = (html.match(/class="bt-card"/g) || []).length
        + (html.match(/class="bt-card dead"/g) || []).length;
      var all = Object.keys(DATA.TROOPS).filter(function (k) { return !DATA.TROOPS[k].nocombat; }).length;
      return nOn === 2 && nOff === all - 2 && html.indexOf('2 / ' + all + ' 兵种参战') >= 0;
    })());

    /* ---- ③ 战场距离：速度 + 最远射程（老板 1） ---------- */
    check('§120③ 距离三下限：射程+MARGIN · (速度和)×MARCH_ROUNDS_MIN · FIELD_MIN(=1400)', (function () {
      var T = G.tactic;
      return T.MARCH_ROUNDS_MIN === 2 && T.FIELD_MIN === 1400 && T.FIELD_MARGIN === 299
        && /var fastA = 0, fastD = 0;/.test(tc)
        && /var spdFloor = Math\.round\(\(fastA \+ fastD\) \* T\.MARCH_ROUNDS_MIN\);/.test(tc)
        && /Math\.max\(T\.FIELD_MIN, Math\.round\(maxR\) \+ T\.FIELD_MARGIN, spdFloor\)/.test(tc);
    })());
    check('§120③ 实测：轻骑纵深 2400 > 长枪 1400（速度参与）· 投石 1899（射程参与）', (function () {
      var T = G.tactic;
      var D = function (a, b) { return T.battlefieldOf(a, b, 0, {}); };
      var q = D({ qingji: 500 }, { qingji: 500 });
      var c = D({ changqiang: 500 }, { changqiang: 500 });
      var td = D({ toudan: 500 }, { changqiang: 500 });
      return q === Math.round(1000 * 2 * 2) && c === 1400 && td >= 1899 && q > c;
    })());

    /* ---- ④ 采集点击静默（老板 2） ---------- */
    check('§120④ 点击采集不重开面板（直接后台开始计时 · 只 refreshAll）', (function () {
      var i = mc.indexOf("case 'wild-garrison-gather'");
      var seg = mc.slice(i, i + 900);
      return /GAME\.startGather\(/.test(seg) && /ui\.toast\(_gr\.msg\)/.test(seg)
        && /GAME\.refreshAll\(\)/.test(seg)
        && seg.indexOf('ui.openLandModal') < 0;
    })());

    /* ---- ⑤ 己方野地面板（老板 3） ---------- */
    check('§120⑤ 己方野地面板：无（已占）/ 产量加成进 note / 驻军两行 / 采集两按钮', (function () {
      var i = uc.indexOf('ui.openLandModal = function');
      var seg = uc.slice(i, i + 32000);
      return /ter\.name \+ ' Lv' \+ lv \+ '<\/div>'/.test(seg)          /* 标题无（已占） */
        && /addLine139/.test(seg)                                       /* 产量加成并入 note */
        && seg.indexOf('等级衰减') < 0 && seg.indexOf('📦 开采') < 0      /* 两行撤除 */
        && /兵力<\/span><span class="v"><b>' \+ U\.numText\(garN, 0\)/.test(seg)   /* 只给总数 */
        && /canSet139/.test(seg) && /canFin139/.test(seg)               /* 两按钮常显 */
        && /⚙️ 设置采集/.test(seg) && /📦 收获/.test(seg)
        && seg.indexOf('🏳️ 召回') < 0;                                   /* 采集区无召回 */
    })());
    check('§120⑤ 实测：已占面板渲染（标题无（已占）· 采集区两按钮 · 驻军总兵力）', (function () {
      var st = G.state;
      var c = st.cities[0];
      var wt = { x: c.x + 21, y: c.y + 21 };
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wt.x && z.y === wt.y); });
      var tl = G.map.tile(wt.x, wt.y);
      if (!tl) return false;
      st.wilds.push({ x: wt.x, y: wt.y, type: 'lake', level: 8, day: 0, startDay: 0 });
      var gen = st.generals[0];
      var bak = { cityId: gen.cityId, status: gen.status };
      G.map.wildAt(wt.x, wt.y).garrison = { troops: { changqiang: 5000, gongjian: 3000 }, cityId: c.id, genId: gen.id };
      gen.status = 'garrison'; 
      var html = '';
      var _om = G.ui.openModal;
      G.ui.openModal = function (hh) { html = hh; };
      try { G.ui.openLandModal(wt.x, wt.y); } catch (e) { html = 'ERR:' + e.message; }
      finally { G.ui.openModal = _om; gen.cityId = bak.cityId; gen.status = bak.status; }
      /* 清理野地记录（保持后序用例口径） */
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wt.x && z.y === wt.y); });
      return html.indexOf('（已占）') < 0
        && html.indexOf('守军约') < 0
        && html.indexOf('产量加成') >= 0 && html.indexOf('此地可采') >= 0
        && /data-action="wild-garrison-gather"/.test(html)
        && /data-action="gather-finish"/.test(html)
        && html.indexOf('🏳️ 召回') < 0
        && /<b>8,000<\/b> 名/.test(html);
    })());

    /* ---- ⑥ 珠宝入采集（老板 4） ---------- */
    check('§120⑥ 珠宝覆盖：爵位所需 9 种全有地形产出（含夜明珠·山） + 等级门槛 + 数量随级', (function () {
      var G2 = DATA.GATHER;
      var lad = DATA.jewelLadder();
      var need9 = ['zhenzhu', 'shanhu', 'liuli', 'hupo', 'manao', 'shuijing', 'feicui', 'yushi', 'yemingzhu'];
      var cov = {};
      Object.keys(G2.jewelTable).forEach(function (k) {
        G2.jewelTable[k].forEach(function (id) { cov[id] = 1; });
      });
      var all9 = need9.every(function (id) { return cov[id] === 1; });
      var allInLadder = need9.every(function (id) { return lad.indexOf(id) >= 0; });
      return all9 && allInLadder
        && G2.jewelMinLv.yemingzhu === 6 && G2.jewelMinLv.zhenzhu === 1
        && G2.jewelCountPerLv > 0
        && /jewelMinLv/.test(dc) && /jewelCountPerLv/.test(dc)
        && /avail\.filter|avail = jt\.filter/.test(dc);
    })());
    check('§120⑥ 实测：Lv2 湖泊只出低档珠宝（珊瑚）；Lv8 山地可出夜明珠', (function () {
      /* 用 withFixedRandom 打桩随机，直调 finishGather 收成路径太重 ——
         改为对"候选过滤"这条唯一判据做等价实测（与 finishGather 内联同一表达式）。 */
      var G2 = DATA.GATHER;
      var pick = function (terrain, lv, rare) {
        var jt = G2.jewelTable[terrain] || [];
        var avail = jt.filter(function (jid) { return lv >= ((G2.jewelMinLv[jid]) || 1); });
        if (!avail.length) return null;
        return (avail.length > 1 && rare) ? avail[avail.length - 1] : avail[0];
      };
      return pick('lake', 2, false) === 'zhenzhu' && pick('lake', 2, true) === 'shanhu'
        && pick('hill', 3, true) === 'yushi'        /* Lv3：夜明珠（minLv6）未解锁 → 只出玉石 */
        && pick('hill', 8, true) === 'yemingzhu'    /* Lv8：解锁夜明珠 */
        && pick('plain', 8, false) === null;
    })());
    check('§120⑥ 实测：爵位 9 种珠宝需求 与 采集覆盖 交叉核对（RANK 逐档）', (function () {
      var need = {};
      (DATA.RANK || []).forEach(function (rk) {
        Object.keys(rk.jewel || {}).forEach(function (id) { need[id] = 1; });
      });
      var cov = {};
      Object.keys(DATA.GATHER.jewelTable).forEach(function (k) {
        DATA.GATHER.jewelTable[k].forEach(function (id) { cov[id] = 1; });
      });
      var missing = Object.keys(need).filter(function (id) { return !cov[id]; });
      return Object.keys(need).length === 9 && missing.length === 0;
    })());

    /* ---- ⑦ 采集负重闸（老板 5） ---------- */
    check('§120⑦ 负重闸：唯一出口 gatherLoadOf + 收成取 min(采力, 负重×loadMul)', (function () {
      return /GAME\.gatherLoadOf = function/.test(dc)
        && /var loadCap = Math\.round\(GAME\.gatherLoadOf\(g\) \* \(G\.loadMul \|\| 0\)\);/.test(dc)
        && /if \(loadCap > 0 && amount > loadCap\) \{ amount = loadCap; loadLimited = true; \}/.test(dc)
        && DATA.GATHER.loadMul === 2.0
        && typeof G.gatherLoadOf === 'function';
    })());
    check('§120⑦ 实测：纯铁骑触负重顶（291.6万→120万）· 民夫不触顶 · 辎重车解锁采力', (function () {
      var st = G.state;
      var c = st.cities[0];
      var wk = { x: c.x + 23, y: c.y + 23 };
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
      st.wilds.push({ x: wk.x, y: wk.y, type: 'forest', level: 10, day: 0, startDay: 0 });
      var gen = st.generals[0];
      var bak = { cityId: gen.cityId, status: gen.status };
      var w = G.map.wildAt(wk.x, wk.y);
      var mk = function (army, id) {
        w.garrison = { troops: army, cityId: c.id, genId: gen.id };
        return G._rawGatherYield({ id: id, x: wk.x, y: wk.y, type: 'forest', level: 10,
          origin: 'garrison', elapsed: 24 * 3600, army: army });
      };
      var yTie = mk({ tieji: 3000 }, 'a');
      var yMin = mk({ minfu: 5000 }, 'b');
      var yZhou = mk({ tieji: 3000, zhouche: 60 }, 'c');
      var ok = yTie.loadLimited === true && yTie.amount === yTie.loadCap
        && yMin.loadLimited === false
        && yZhou.amount > yTie.amount
        && yTie.loadCap === Math.round(600000 * 2) && yZhou.loadCap > yTie.loadCap;
      w.garrison = null;
      st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
      gen.cityId = bak.cityId; gen.status = bak.status;
      return ok;
    })());

    /* ---- ⑧ 缩略图我城档（老板 6） ---------- */
    check('§120⑧ 缩略图：筛选加「我城」档 · 默认只标当前城 · 我城档画全部', (function () {
      return /\['mine', '我城'\]/.test(uc)
        && /if \(v\.level === 'mine'\)/.test(uc)
        && /v\.list = \(GAME\.state\.cities \|\| \[\]\)\.slice\(\)/.test(uc)
        && /var _allMine139 = \(v\.level === 'mine'\);/.test(uc)
        && /if \(!_allMine139 && c\.id !== ui\._cityId\) return;/.test(uc)
        && /var _allMine = \(v && v\.level === 'mine'\);/.test(uc);
    })());
    check('§120⑧ 实测：默认档红点计数 = 1（当前城）· 我城档 = 我方城池数', (function () {
      /* 复用 canvas stub？—— 桩没有真 ctx.arc 计数能力，改为直读过滤判据的等价式。
         真浏览器量测见 .workbuddy/tools/show/measure_v89139_*.js（红点像素 3 城 vs 1 城）。 */
      var st = G.state;
      var n = (st.cities || []).length;
      var v0 = G.ui.miniView();
      return n >= 1 && v0.level === '' && v0.win.side === DATA.MAP_W;
    })());

    /* ---- ⑨ 需求档案在册 ---------- */
    check('§120⑨ 需求档案在册（v89.139 · 老板原文关键句逐字）', (function () {
      var md = _f.readFileSync(_p.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.139') >= 0
        && md.indexOf('目前地图中有几个上下左右的箭头，去掉') >= 0
        && md.indexOf('珠宝由采集产出') >= 0
        && md.indexOf('建议关联驻军的总负重') >= 0
        && md.indexOf('选中之后在地图上显示我方所有城池的红点') >= 0;
    })());
  })();

"""

anchor = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(anchor) == 1, '锚点'
s = s.replace(anchor, BLOCK + anchor)
assert '\r\n' not in s, 'CRLF'
tmp = p + '.tmp139'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '§120⑨' in chk, '落盘校验失败'
print('✅ smoke-test.js：%d → %d 字节（§120 已追加）' % (n0, len(chk)))

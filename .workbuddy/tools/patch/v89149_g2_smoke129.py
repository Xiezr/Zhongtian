# -*- coding: utf-8 -*-
"""v89.149 批 G2：smoke 新增 §129 门禁节（七条需求各一组 + 档案在册）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
BAK = 'E:/Deepseekdb/backup/v89149/smoke-test.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()

ANCHOR = """  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

SECTION = """  })();

  /* ═══════════════════════════════════════════════════════════
   * §129（v89.149）：老板 7 条 —— 战斗声望（歼灭军力 × 军力对比）·
   *   动作设置每回合可重设（不动则继承）· 兵种一字简称 · 默认前进+同兵种（去"目标："）·
   *   战场区拉到回合记录上方 · 删「左侧设动作/目标」· 间距统一为「最近距离 / 全局」
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs129 = require('fs'), p129 = require('path');
    var uS129 = fs129.readFileSync(p129.join(__dirname, 'js', 'ui.js'), 'utf8');
    var strip129 = function (x) { return x.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); };
    var u129 = strip129(uS129);
    var bS129 = fs129.readFileSync(p129.join(__dirname, 'js', 'battle.js'), 'utf8');
    var h129 = fs129.readFileSync(p129.join(__dirname, 'index.html'), 'utf8');
    var _r129a = '', _r129c = '', _r129d = '', _r129g = '';

    /* ---- ① 战斗声望（唯一出口 · 公式 · 视角 · 落账） ---- */
    check('§129① 声望公式：基础=歼灭军力（story.troopPower 同尺）· 系数=√兵力比夹取 · 败仗折损 · 单场封顶', (function () {
      var R = DATA.REP_RULE;
      if (!R || R.perPower !== 30000 || R.cap !== 200 || R.coefLo !== 0.4 || R.coefHi !== 2) return false;
      var pCq = G.story.troopPower('changqiang');
      var even = G.battle.repGainOf({ win: true, mine: { changqiang: 1000 }, foe: { changqiang: 1000 }, foeLoss: { changqiang: 1000 } });
      var hard = G.battle.repGainOf({ win: true, mine: { changqiang: 500 }, foe: { changqiang: 1000 }, foeLoss: { changqiang: 1000 } });
      var lose = G.battle.repGainOf({ win: false, mine: { changqiang: 500 }, foe: { changqiang: 1000 }, foeLoss: { changqiang: 1000 } });
      var big = G.battle.repGainOf({ win: true, mine: { changqiang: 10 }, foe: { changqiang: 400000 }, foeLoss: { changqiang: 400000 } });
      var wantEven = Math.round(pCq * 1000 / R.perPower * 1);
      var free = G.battle.repGainOf({ win: true, mine: {}, foe: {}, foeLoss: {} });
      _r129a = 'even=' + even.gain + '/' + wantEven + ' hard=' + hard.gain + '(x' + hard.coef + ') lose=' + lose.gain
        + ' big=' + big.gain + (big.capped ? '封顶' : '') + ' 空=' + free.gain;
      return even.gain === wantEven && even.coef === 1 && even.lost === Math.round(pCq * 1000)
        && hard.gain > even.gain && hard.coef > 1 && hard.coef <= R.coefHi
        && lose.gain > 0 && lose.gain < hard.gain
        && big.capped === true && big.gain === R.cap
        && free.gain === 0;                      /* 零歼灭 → 零声望（平凡解不许通过） */
    })(), _r129a);

    check('§129① 视角显式转参：攻方读 defLossBy / 守方读 atkLossBy（不靠猜 —— v89.116 教训）', (function () {
      var r = { atkStartBy: { changqiang: 100 }, defStartBy: { yibing: 200 },
        atkLossBy: { changqiang: 60 }, defLossBy: { yibing: 150 } };
      var va = G.battle.battleRepView(r, 'atk', true);
      var vd = G.battle.battleRepView(r, 'def', true);
      return va.mine === r.atkStartBy && va.foe === r.defStartBy && va.foeLoss === r.defLossBy
        && vd.mine === r.defStartBy && vd.foe === r.atkStartBy && vd.foeLoss === r.atkLossBy
        && vd.win === true && vd !== va;
    })());

    check('§129① 落账：真调 grantBattleRep → s.rep 真涨 + 写战功日志 + result.repGain 在册', (function () {
      var bkRep = G.state.rep;
      try {
        G.state.rep = 0;
        var res = { atkStartBy: { changqiang: 100 }, defStartBy: { changqiang: 300 }, defLossBy: { changqiang: 300 } };
        var g = G.battle.grantBattleRep(res, 'atk', true, '试野地');
        _r129a2 = 'gain=' + g.gain + ' rep=' + G.state.rep;
        return g.gain > 0 && G.state.rep === g.gain && res.repGain === g
          && /GAME\\.log\\.war\\('🏅 /.test(bS129)                    /* 日志（军事模块命名空间写法） */
          && /GAME\\.battle\\.grantBattleRep = function/.test(bS129)  /* 唯一出口在册 */
          && (bS129.match(/grantBattleRep\\(result, /g) || []).length >= 2;  /* 出征 + 守城两条落账路径 */
      } finally { G.state.rep = bkRep; }
    })());

    check('§129① 战报正文有「声望 +N」行（与经验同一位置 · 悬停解释口径）', (function () {
      var gen = { name: '测试将', level: 1 };
      var txt = G.battle.reportText('试城', {}, gen, { winner: 'atk', rounds: 5, atkLoss: 10, atkRemain: 90,
        defLoss: 100, defRemain: 0,
        repGain: { gain: 7, lost: 123456, ratio: 1.2, coef: 1.1, capped: false, cap: 200 } });
      return txt.indexOf('声望</span> +7') >= 0 && txt.indexOf('歼灭军力') >= 0
        && DATA.REP_RULE.perPower === 30000;
    })());

    /* ---- ② 动作设置：每回合可重设 · 不动则继承 ---- */
    check('§129② 重绘读**会话快照**（含刚下达的待生效指令）—— 修"改完跳回去" · 播放中不重绘', (function () {
      return /var snap = ses \\? ses\\.snap\\(\\) : \\(rec\\.snapLast \\|\\| null\\);/.test(u129)
        && /if \\(box && snap && !\\(ui\\._bt && ui\\._bt\\.playing\\)\\) box\\.outerHTML = ui\\.btBoardHTML\\(snap\\);/.test(u129);
    })());

    check('§129② 继承：改一支 → 步进 → 改的那支生效、**没动的那支原样**（引擎侧实跑）', (function () {
      var env = G.tactic.begin({ changqiang: 5000, gongjian: 2000 }, null,
        { changqiang: 1000, gongjian: 800 }, 0, null, { kind: 'wild' });
      env.setCmd('atk', 'changqiang', { s: 'hold', t: 'gongjian' });
      env.step();
      var s1 = env.snap();
      var cq1 = s1.atk.filter(function (u) { return u.id === 'changqiang'; })[0];
      var gj1 = s1.atk.filter(function (u) { return u.id === 'gongjian'; })[0];
      /* 再改一次（第 2 回合重设）→ 步进 → 新值生效 */
      env.setCmd('atk', 'changqiang', { s: 'retreat' });
      env.step();
      var s2 = env.snap();
      var cq2 = s2.atk.filter(function (u) { return u.id === 'changqiang'; })[0];
      _r129b = 'cq1=' + cq1.stance + '/' + cq1.target + ' gj1=' + gj1.stance + '/' + gj1.target + ' cq2=' + cq2.stance;
      return cq1.stance === 'hold' && cq1.target === 'gongjian'
        && gj1.stance === 'advance' && gj1.target === 'gongjian'   /* 未动者：动作继承 · 默认同兵种 */
        && cq2.stance === 'retreat';                              /* 每回合可再改 */
    })(), _r129b);

    /* ---- ③ 兵种一字简称 ---- */
    check('§129③ 一字简称：18 兵种齐备 · 两两唯一 · 唯一出口 troopAbOf（缺字段兜底首字）', (function () {
      var ids = Object.keys(DATA.TROOPS), seen = {}, bad = [];
      ids.forEach(function (id) {
        var ab = DATA.TROOPS[id].ab;
        if (!ab || ab.length !== 1) bad.push(id + ':' + ab);
        if (seen[ab]) bad.push('重' + ab); else seen[ab] = 1;
      });
      _r129c = 'n=' + ids.length + ' 简称=' + Object.keys(seen).join('') + (bad.length ? ' 坏=' + bad.join(',') : '');
      return bad.length === 0 && ids.length >= 18
        && G.troopAbOf('changqiang') === '枪' && G.troopAbOf('nanjiangxiangbing') === '象'
        && G.troopAbOf('__no_such__') === '';
    })(), _r129c);

    check('§129③ 侧栏名称位 = 简称（全名/最终属性仍在悬停）· 名称列不再抢宽', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance', target: 'changqiang' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }] };
      var html = G.ui.btSideHTML(snap, 'atk');
      return /<i class="bt-rnm" title="[^"]*长枪兵[^"]*">枪<\\/i>/.test(html)
        && /\\.bt-l1 \\.bt-rnm \\{ flex: 0 0 auto;/.test(h129)
        && /\\.bt-card \\.bt-rnm \\{ max-width: none; flex: 0 0 auto; \\}/.test(h129);
    })());

    /* ---- ④ 默认前进 + 同兵种 · 去"目标：" ---- */
    check('§129④ 默认目标 = 同兵种（引擎两侧同规）· 下拉首项「同兵种」· 无「目标：」前缀', (function () {
      var a = G.tactic.unitsOf({ changqiang: 100 }, 'atk', null, {});
      var d = G.tactic.unitsOf({ qingji: 100 }, 'def', null, { foeArmy: { changqiang: 50 } });
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance', target: 'changqiang' }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance' }] };
      var html = G.ui.btSideHTML(snap, 'atk');
      var htmlFoe = G.ui.btSideHTML(snap, 'def');
      _r129d = 'atk.tgt=' + a[0].target + ' def.tgt=' + d[0].target + ' 前缀=' + (html.indexOf('目标：') >= 0);
      return a[0].target === 'changqiang' && a[0].stance === 'advance'
        && d[0].target === 'qingji'
        && html.indexOf('>同兵种</option>') >= 0
        && html.indexOf('目标：') < 0 && htmlFoe.indexOf('目标：') < 0
        /* 只读行（敌军侧）也走同一文案出口 */
        && /ui\\.btTargetLabelOf = function/.test(u129)
        && G.ui.btTargetLabelOf({ id: 'changqiang', target: 'changqiang' }, []) === '同兵种'
        && G.ui.btTargetLabelOf({ id: 'changqiang', target: '' }, []) === '任意'
        && G.ui.btTargetLabelOf({ id: 'changqiang', target: DATA.TARGET_WALL }, []) === '城头箭塔';
    })(), _r129d);

    check('§129④ 哨兵 TARGET_ANY（战术页「任意」）→ 显式清空目标（保住"打最近的"能力）', (function () {
      var ov = { changqiang: { s: 'advance', t: DATA.TARGET_ANY } };
      var u2 = G.tactic.unitsOf({ changqiang: 100 }, 'atk', null, { override: ov });
      var block = G.ui.tacticBlockOf('atk', 'changqiang');
      return DATA.TARGET_ANY === '_any' && u2[0].target === ''
        && /DATA\\.TARGET_ANY/.test(u129) && block.indexOf('任意（打最近）') >= 0;
    })());

    /* ---- ⑤ 战场区拉到回合记录上方 ---- */
    check('§129⑤ 战场条填满 board 行 · 兵牌按 --rel 纵向铺满 · dense 档（>8 队）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, stance: 'advance', adv: 100 },
          { id: 'gongjian', name: '弓箭手', count: 50, stance: 'advance', adv: 100 }],
        def: [{ id: 'yibing', name: '义兵', count: 80, stance: 'advance', adv: 100 }] };
      var html = G.ui.btFieldHTML(snap);
      /* 9 队 → 挂 dense */
      var ids = Object.keys(DATA.TROOPS), many = { field: 1400, towers: null, atk: [], def: [] };
      for (var i = 0; i < 9; i++) many.atk.push({ id: ids[i], name: DATA.TROOPS[ids[i]].name, count: 10, stance: 'advance', adv: 100 });
      var manyH = G.ui.btFieldHTML(many);
      return html.indexOf('height:') < 0                      /* 不再内联定高 */
        && /--rel:0\\.0000/.test(html) && /--rel:0\\.5000/.test(html)
        && /\\.bt-unit \\{[^}]*top: calc\\(\\(100% - 30px\\) \\* var\\(--rel, 0\\)\\);/.test(h129)
        && /\\.bt-field\\.dense \\.bt-unit \\{ height: 24px;/.test(h129)
        && /grid-template-rows: minmax\\(0, 1fr\\);/.test(h129)
        && /class="bt-field dense"/.test(manyH);
    })());

    /* ---- ⑥ 备注退役 ---- */
    check('§129⑥ 「左侧设动作/目标」备注整条退役（顶栏只剩 左读数 + 中三键）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100 }],
        def: [{ id: 'yibing', name: '义兵', count: 80, adv: 100 }] };
      var h = G.ui.btTopHTML({ cnt: 60 }, snap);
      return h.indexOf('bt-hint') < 0 && h.indexOf('左侧设动作') < 0
        && /class="bt-left"/.test(h) && /class="bt-acts"/.test(h);
    })());

    /* ---- ⑦ 间距读数统一 ---- */
    check('§129⑦ 读数统一「最近距离 X / 全局 D」（唯一出口 gapReadOf · 不再各写一串）', (function () {
      var snap = { field: 2600, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100, range: 50 }],
        def: [{ id: 'yibing', name: '义兵', count: 100, adv: 100, range: 20 }] };
      var h = G.ui.btTopHTML({ cnt: 60, gapLast: null }, snap);
      _r129g = '读数=' + G.ui.gapReadOf(30, 2600);
      return /最近距离 <b>2,400<\\/b>/.test(h) && /全局 <b>2,600<\\/b>/.test(h)
        && G.ui.gapReadOf(30, 2600) === '最近距离 <b>30<\\/b> / 全局 <b>2,600<\\/b>'
        && G.ui.gapReadOf(null, 2600).indexOf('—') >= 0
        /* 其余读数（沙盘 / 回放帧 / 事件行）也已统一 —— 渲染文案里不得再有裸「间距 」 */
        && uS129.indexOf("'<span class=\\"bt-g\\">最近距离 ") >= 0
        && uS129.indexOf("（最近距离 '") >= 0
        && uS129.indexOf(">间距 <b") < 0;
    })(), _r129g);

    /* ---- ⑧ 档案在册 ---- */
    check('§129⑧ 需求档案在册（v89.149 · 同兵种 / 最近距离 / 声望）', (function () {
      var a = fs129.readFileSync(p129.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.149') >= 0
        && a.indexOf('同兵种') >= 0
        && a.indexOf('最近距离') >= 0
        && a.indexOf('声望') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

if '§129（v89.149）' in s:
    print('SKIP(已落) §129')
else:
    assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))
    s = s.replace(ANCHOR, SECTION)
    print('OK §129')

import re as _re


def _delta(x):
    return (len(_re.findall(r'(?<![\\^])\{', x)) - len(_re.findall(r'(?<![\\^])\}', x)))


assert _delta(s) == _delta(bak), '花括号盈亏不一致（%d vs %d）' % (_delta(s), _delta(bak))
assert '\r\n' not in s, '行尾被写成 CRLF'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke-test.js 落盘 · len=' + str(len(s)))

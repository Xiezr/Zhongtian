# -*- coding: utf-8 -*-
"""v89 流程引擎（state.js）：jianghuDo 拆 Check/Spend/Roll + sceneStart/Pick/Escape + mods 接线。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()

def sub(old, new, tag, probe):
    global d
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, tag + ' 锚点命中 %d 次' % c
    d = d.replace(old, new, 1)
    print('OK ' + tag)

# ---- 0) 主拆：jianghuDo 三段化 + 双修正头 ----
sub(r"""  GAME.jianghuDo = function (x, y, genId, actId) {
    var s = GAME.state;
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var a = chk.act, gen = chk.gen, day = chk.day, lv = chk.lv;
    var tile = GAME.map.tile(x, y);
    var seedBase = 'jh|' + x + ',' + y + '|' + actId + '|' + day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    /* 扣费 + 锁 */
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    s.jianghu = s.jianghu || {};
    s.jianghu[x + ',' + y + '|' + actId] = day;
    /* 灵力（读修炼装备；与当前生效套无关） */
    var ling = GAME.lingPowerOf(gen);
    var texts = [];
    var bad = false;
    s.items = s.items || {};""",
r"""  /* v89：内核拆三段 —— Check（jianghuCheck）/ Spend（扣费+落锁）/ Roll（抽结果）。
     全屏剧本流程（GAME.scene*，见下）与 one-shot 入口（jianghuDo）共用同一份内核，
     保证「改了判定只改一处」。 */
  GAME.jianghuDo = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    GAME.jianghuSpend(chk);
    return GAME.jianghuRoll(chk);
  };
  GAME.jianghuSpend = function (chk) {
    var s = GAME.state;
    var a = chk.act, gen = chk.gen;
    gen.energy = Math.max(0, (gen.energy || 0) - a.energy);
    GAME.setStaNow(gen, GAME.staNow(gen) - a.stam);
    s.jianghu = s.jianghu || {};
    s.jianghu[chk.x + ',' + chk.y + '|' + chk.actId] = chk.day;
    return { ok: true };
  };
  GAME.jianghuRoll = function (chk, mods) {
    var s = GAME.state;
    var a = chk.act, gen = chk.gen, day = chk.day, lv = chk.lv;
    var x = chk.x, y = chk.y;
    var tile = GAME.map.tile(x, y);
    var seedBase = 'jh|' + x + ',' + y + '|' + chk.actId + '|' + day;
    var roll = function (salt) { return GAME.invasionRoll(seedBase + '|' + salt); };
    var rnd = function (salt, lo, hi) {
      lo = Math.round(lo); hi = Math.round(hi);
      return lo + Math.floor(roll(salt) * (hi - lo + 1));
    };
    /* v89：剧本修正系数（缺省时与 v88 结果逐位一致 —— 可复现不变式） */
    var mo = mods || {};
    var mPow = mo.pow || 1, mRw = mo.reward || 1, mWound = mo.wound || 1, mLuck = mo.luck || 0;
    var mi = function (n) { return Math.max(1, Math.round(n * mRw)); };
    var mw = function (n) { return Math.max(1, Math.round(n * mWound)); };
    /* 灵力（读修炼装备；与当前生效套无关） */
    var ling = GAME.lingPowerOf(gen);
    var texts = [];
    var bad = false;
    s.items = s.items || {};""",
    'F0 三段化+mods 头', 'GAME.jianghuSpend = function (chk)')

# ---- 1) ess 计 reward ----
sub(r"""      var n = rnd(salt || 'ess', lo, hi);""",
r"""      var n = mi(rnd(salt || 'ess', lo, hi));""",
    'F1 ess 计 reward', "var n = mi(rnd(salt || 'ess', lo, hi));")

# ---- 2) tryDrop 计 luck ----
sub(r"""      if (roll(salt + '|hit') >= a.drop) return;""",
r"""      if (roll(salt + '|hit') >= Math.min(0.95, a.drop * (1 + mLuck))) return;""",
    'F2 tryDrop 计 luck', 'Math.min(0.95, a.drop * (1 + mLuck))')

# ---- 3) fight 计 pow ----
sub(r"""      var pow = (ling + (gen.level || 1) * 2) * (0.9 + roll('pow') * 0.2);""",
r"""      var pow = (ling + (gen.level || 1) * 2) * (0.9 + roll('pow') * 0.2) * mPow;""",
    'F3 fight 计 pow', "* (0.9 + roll('pow') * 0.2) * mPow;")

# ---- 4) fight 败退负伤计 wound ----
sub(r"""        if (a.lose.wound) {
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - a.lose.wound));
          texts.push(gen.name + ' 负伤，体力 −' + a.lose.wound);
        }
        bad = true;
        title = '力战不敌';""",
r"""        if (a.lose.wound) {
          var wdA = mw(a.lose.wound);
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdA));
          texts.push(gen.name + ' 负伤，体力 −' + wdA);
        }
        bad = true;
        title = '力战不敌';""",
    'F4 fight 负伤计 wound', 'var wdA = mw(a.lose.wound);')

# ---- 5) trial 计 pow ----
sub(r"""        var p2 = (ling + (gen.level || 1) * 2) * (0.9 + roll('t' + i) * 0.2);""",
r"""        var p2 = (ling + (gen.level || 1) * 2) * (0.9 + roll('t' + i) * 0.2) * mPow;""",
    'F5 trial 计 pow', "* (0.9 + roll('t' + i) * 0.2) * mPow;")

# ---- 6) trial 逐层收益计 reward ----
sub(r"""        for (var j = 1; j <= layer; j++) tot += rnd('te' + j, a.win.ess[0] / 3, a.win.ess[1] / 3);""",
r"""        for (var j = 1; j <= layer; j++) tot += mi(rnd('te' + j, a.win.ess[0] / 3, a.win.ess[1] / 3));""",
    'F6 trial 收益计 reward', "tot += mi(rnd('te' + j,")

# ---- 7) trial 败退负伤计 wound ----
sub(r"""        if (a.lose.wound) {
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - a.lose.wound));
          texts.push(gen.name + ' 负伤，体力 −' + a.lose.wound);
        }
        bad = true;
        title = '第一层便受阻';""",
r"""        if (a.lose.wound) {
          var wdB = mw(a.lose.wound);
          GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdB));
          texts.push(gen.name + ' 负伤，体力 −' + wdB);
        }
        bad = true;
        title = '第一层便受阻';""",
    'F7 trial 负伤计 wound', 'var wdB = mw(a.lose.wound);')

# ---- 8) gather 双收计 luck ----
sub(r"""      if (roll('dbl') < 0.25) ess(a.win.ess[0], a.win.ess[1], 'ess2', '意外双收');""",
r"""      if (roll('dbl') < 0.25 + mLuck) ess(a.win.ess[0], a.win.ess[1], 'ess2', '意外双收');""",
    'F8 gather 计 luck', "< 0.25 + mLuck) ess(")

# ---- 9) cultivate 悟道计 luck ----
sub(r"""      if (roll('wu') < 0.08) {""",
r"""      if (roll('wu') < 0.08 + mLuck) {""",
    'F9 cultivate 计 luck', "< 0.08 + mLuck) {")

# ---- 10) visit 事件偏移计 luck + grade ----
sub(r"""      var ev = pool.length ? pool[Math.floor(roll('ev') * pool.length) % pool.length] : null;""",
r"""      var ev = pool.length ? pool[Math.floor(Math.min(0.999, roll('ev') + mLuck) * pool.length) % pool.length] : null;""",
    'F10 visit 计 luck', 'Math.min(0.999, roll(\'ev\') + mLuck)')

sub(r"""      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false };""",
r"""      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false, grade: 'win' };""",
    'F10b visit 补 grade', "bad: false, grade: 'win' };")

# ---- 11) scene 抽签（luck 重抽） ----
sub(r"""      var rr2 = roll('scene_roll') * tot2;
      var acc2 = 0, out2 = outs2[outs2.length - 1];
      for (var oj2 = 0; oj2 < outs2.length; oj2++) {
        acc2 += outs2[oj2].w;
        if (rr2 < acc2) { out2 = outs2[oj2]; break; }
      }""",
r"""      /* v89：抽签（luck 修正：抽到「遗憾」结果时有一次重抽机会） */
      var pickScene = function (salt) {
        var rr2 = roll(salt) * tot2;
        var acc2 = 0, oo2 = outs2[outs2.length - 1];
        for (var oj2 = 0; oj2 < outs2.length; oj2++) {
          acc2 += outs2[oj2].w;
          if (rr2 < acc2) { oo2 = outs2[oj2]; break; }
        }
        return oo2;
      };
      var out2 = pickScene('scene_roll');
      if ((out2.wound || out2.none) && mLuck > 0 && roll('lr') < mLuck) out2 = pickScene('scene_roll2');""",
    'F11 scene 重抽计 luck', "var pickScene = function (salt) {")

# ---- 12) scene 金/粮/材料计 reward ----
sub(r"""        var gn2 = rnd('gold', out2.gold[0], out2.gold[1]);""",
r"""        var gn2 = mi(rnd('gold', out2.gold[0], out2.gold[1]));""",
    'F12a scene 金计 reward', "var gn2 = mi(rnd('gold',")

sub(r"""        var gr2 = rnd('grain', out2.grain[0], out2.grain[1]);""",
r"""        var gr2 = mi(rnd('grain', out2.grain[0], out2.grain[1]));""",
    'F12b scene 粮计 reward', "var gr2 = mi(rnd('grain',")

sub(r"""          var n2 = rnd('matn', out2.mats[0], out2.mats[1]);""",
r"""          var n2 = mi(rnd('matn', out2.mats[0], out2.mats[1]));""",
    'F12c scene 材料计 reward', "var n2 = mi(rnd('matn',")

# ---- 13) scene 负伤计 wound + grade ----
sub(r"""      if (out2.wound) {
        GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - out2.wound));
        texts.push(gen.name + ' 负伤，体力 −' + out2.wound);
        bad = true;
      }""",
r"""      if (out2.wound) {
        var wdS = mw(out2.wound);
        GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - wdS));
        texts.push(gen.name + ' 负伤，体力 −' + wdS);
        bad = true;
      }""",
    'F13 scene 负伤计 wound', 'var wdS = mw(out2.wound);')

sub(r"""      return { ok: true, name: out2.t, text: texts.join('、'), bad: bad };""",
r"""      return { ok: true, name: out2.t, text: texts.join('、'), bad: bad,
        grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win')) };""",
    'F13b scene 补 grade', "grade: (out2.wound ? 'lose' : (out2.none ? 'partial' : 'win'))")

# ---- 14) 通用返回补 grade + 追加全屏流程引擎 ----
sub(r"""    var body = texts.join('、');
    if (!body) { body = '此行无所获'; bad = true; }
    GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + title + '（' + body + '）');
    return { ok: true, name: a.name + ' · ' + title, text: body, bad: bad };
  };""",
r"""    var body = texts.join('、');
    if (!body) { body = '此行无所获'; bad = true; }
    /* v89：结局分级（全屏剧本据此选专属退出结算屏） */
    var grade = bad ? 'lose' : 'win';
    if (a.kind === 'trial') grade = bad ? 'lose' : ((title === '三层皆过') ? 'win' : 'partial');
    if (a.kind === 'cultivate') grade = bad ? 'lose' : ((title === '悟道时刻') ? 'win' : 'partial');
    GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + title + '（' + body + '）');
    return { ok: true, name: a.name + ' · ' + title, text: body, bad: bad, grade: grade };
  };

  /* --------- v89 · 全屏江湖场景流程（老板：「专属全屏界面 + 特定退出」） --------- */
  GAME.sceneFx = null;
  /* 进入流程：只校验不扣费（「未动身离去免费」的根基）；无剧本 → fx:null 由调用方兜底 */
  GAME.sceneStart = function (x, y, genId, actId) {
    var chk = GAME.jianghuCheck(x, y, genId, actId);
    if (!chk.ok) return chk;
    var fly = (DATA.SCENE_FLOW || {})[actId];
    if (!fly) return { ok: true, fx: null };
    GAME.sceneFx = {
      chk: chk, fly: fly, actId: actId,
      stage: 0, picks: [],
      mods: { pow: 1, reward: 1, wound: 1, luck: 0 },
      spent: false, phase: 'stage', result: null, grade: null
    };
    return { ok: true, fx: GAME.sceneFx };
  };
  /* 选一幕（首次选择才真正扣费+落锁）；末幕选择即结算 */
  GAME.scenePick = function (idx) {
    var fx = GAME.sceneFx;
    if (!fx || fx.phase !== 'stage') return { ok: false, msg: '流程已结束' };
    var st = fx.fly.stages[fx.stage];
    var op = (st && st.o) ? st.o[idx] : null;
    if (!op) return { ok: false, msg: '无此选项' };
    if (!fx.spent) { GAME.jianghuSpend(fx.chk); fx.spent = true; }
    fx.picks.push({ l: op.l, d: op.d || '' });
    var e = op.e || {};
    if (e.pow) fx.mods.pow *= e.pow;
    if (e.reward) fx.mods.reward *= e.reward;
    if (e.wound) fx.mods.wound *= e.wound;
    if (e.luck) fx.mods.luck += e.luck;
    fx.stage += 1;
    var resolved = fx.stage >= fx.fly.stages.length;
    if (resolved) {
      fx.result = GAME.jianghuRoll(fx.chk, fx.mods);
      fx.grade = fx.result.grade || (fx.result.bad ? 'lose' : 'win');
      fx.phase = 'result';
    }
    return { ok: true, resolved: resolved, fx: fx };
  };
  /* 中途退出：未动身 → 零消耗（锁都未落）；已动身 → 所耗不返、今日计入 */
  GAME.sceneEscape = function () {
    var fx = GAME.sceneFx;
    if (!fx || fx.phase !== 'stage') return { ok: false, msg: '流程已结束' };
    fx.phase = 'result';
    fx.grade = 'escape';
    fx.result = { ok: true, name: fx.fly.escLabel || '就此离去', text: '', bad: true, escaped: true, grade: 'escape' };
    return { ok: true, fx: fx };
  };""",
    'F14 grade + 流程引擎', 'GAME.sceneStart = function')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print()
print('全部完成。')

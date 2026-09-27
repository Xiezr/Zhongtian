# -*- coding: utf-8 -*-
# v89.156 patch E2：smoke-test.js 追加 §156 节（插在外层闭合前 —— 尾锚点组合保证唯一）
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

ANCHOR = u"""  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

if u'156. v89.156（弹窗层级栈修复' in s:
    print('§156 skip（已落盘）')
    raise SystemExit(0)

SEC = u"""  })();

  /* ============================================================
   * 156. v89.156（弹窗层级栈修复 / 放弃直执行 / 出征界面改造 / 侦察失败）
   * ============================================================ */
  console.log('\\n===== 156. v89.156（层级栈修复 · 放弃直执行 · 出征界面 · 侦察失败）=====');
  (function () {
    var fs156 = require('fs'), p156 = require('path');
    var u156 = fs156.readFileSync(p156.join(__dirname, 'js', 'ui.js'), 'utf8');
    var b156 = fs156.readFileSync(p156.join(__dirname, 'js', 'battle.js'), 'utf8');
    var d156 = fs156.readFileSync(p156.join(__dirname, 'js', 'data.js'), 'utf8');
    var h156 = fs156.readFileSync(p156.join(__dirname, 'index.html'), 'utf8');
    var _why156 = '';

    /* ---- ① 弹窗层级栈修复（live 重绘不压栈 · sameAs 接线 · 弹栈即新数据） ----
       病根（老板 1 · debug）：「放弃完回到附属野地界面，点击关闭……闪烁一下维持在界面中，
       被删除的那一行又闪烁出现，需要快速点击几下才能关掉」——
       openWilds 标题含动态数字（N/M），数据变化 → live 每秒重绘被"标题不同=进下级"
       误判**压栈** → 关闭键每点一次只弹一层（弹出的还是含已删行的**旧快照**）。 */
    check('§156① live 重绘不压栈（openModal 守卫 !o.sameAs && !ui._liveRedraw）',
      /if \\(title && curTitle && title !== curTitle && !o\\.sameAs && !ui\\._liveRedraw\\) \\{/.test(u156));
    check('§156① liveModalTick 置 _liveRedraw（重绘期间禁止压栈判定）',
      /ui\\._liveRedraw = true; ui\\._liveReopen\\(\\);/.test(u156)
      && /ui\\._liveRedraw = false;/.test(u156));
    check('§156① 弹栈即新数据（closeModal 弹栈分支：live 层立即重绘，不闪旧快照）',
      /if \\(ui\\._liveReopen\\) \\{\\n          try \\{ ui\\._liveRedraw = true; ui\\._liveReopen\\(\\); \\}/.test(u156));
    check('§156① _liveRedraw 声明 + 复位（异常路径 finally 保险）',
      u156.indexOf('ui._liveRedraw = false;') >= 0 && /ui\\._liveRedraw = false;/g.test(u156));

    /* ---- ② 放弃直执行（上膛退役 · -do 唯一出口） ---- */
    check('§156② 放弃 = 窗内一击执行（wild-abandon-do 无上膛分支）',
      /case 'wild-abandon-do': \\{\\n        var wa = GAME\\.doAbandonWild/.test(require('fs').readFileSync(p156.join(__dirname, 'js', 'main.js'), 'utf8'))
      && u156.indexOf('_wildArm154') < 0);

    /* ---- ③ 出征界面结构（真渲染 · 桩捕获） ---- */
    check('§156③ 出征（城池目标）：额度标签 + 限制容器 + 道具下拉（左列） + 预估（右列 · 兵种后）', (function () {
      var keep = { cid: G.ui._cityId, mode: G.ui._expMode, t: G.ui._expTarget, r: G.ui._expRes };
      var ok = false;
      try {
        var npc = (G.state.map && G.state.map.cities || [])[0];
        if (npc) {
          var html = '', _om = G.ui.openModal;
          G.ui.openModal = function (h) { html = h; };
          try { G.ui.openExpModal({ kind: 'city', id: npc.id, npc: npc }); }
          catch (e) { html = 'ERR:' + (e && e.message); }
          G.ui.openModal = _om;
          var iL = html.indexOf('exp-col-l'), iR = html.indexOf('exp-col-r');
          var iIt = html.indexOf('id="exp-item-sel"');
          var iEs = html.indexOf('exp-a-est'), iTr = html.indexOf('exp-a-troops');
          ok = iL >= 0 && iR > iL && iIt > iL && iIt < iR && iEs > iR && iEs > iTr
            && html.indexOf('id="exp-cap-t"') >= 0
            && html.indexOf('id="exp-limits"') >= 0
            && html.indexOf('exp-use-item-pick') >= 0
            && html.indexOf('data-action="exp-use-item"') < 0
            && html.indexOf('id="exp-wildcap"') < 0
            && html.indexOf('主将 · 可用道具') < 0;
          if (!ok) _why156 = 'iL=' + iL + ' iR=' + iR + ' iIt=' + iIt + ' iEs=' + iEs + ' iTr=' + iTr;
        } else { _why156 = 'no npc city'; }
      } catch (e) { _why156 = String(e && e.message); }
      finally { G.ui._cityId = keep.cid; G.ui._expMode = keep.mode; G.ui._expTarget = keep.t; G.ui._expRes = keep.r; G.ui.closeAllModals(); }
      return ok;
    })(), _why156);

    check('§156③ 己方野地（驻守）：无预估块 + 标题「派驻上限」（老板 3：己方无需预估）', (function () {
      var st = G.state, c = G.currentCity();
      if (!st.map.grid) G.map.generate();
      var px = c.x + 3, py = c.y + 3;
      var keep = { wilds: st.wilds, mode: G.ui._expMode, t: G.ui._expTarget, r: G.ui._expRes };
      var ok = false;
      try {
        st.wilds = (st.wilds || []).filter(function (z) { return !(z.x === px && z.y === py); });
        st.wilds.push({ x: px, y: py, type: 'lake', level: 2, day: 0, startDay: 0 });
        var html = '', _om2 = G.ui.openModal;
        G.ui.openModal = function (h) { html = h; };
        try { G.ui.openExpModal({ kind: 'wild', x: px, y: py }); }
        catch (e) { html = 'ERR:' + (e && e.message); }
        G.ui.openModal = _om2;
        ok = html.indexOf('exp-a-est') < 0 && html.indexOf('派驻上限') >= 0 && html.indexOf('exp-a-cargo') < 0;
        if (!ok) _why156 = 'html.len=' + html.length + ' est=' + html.indexOf('exp-a-est');
      } catch (e) { _why156 = String(e && e.message); }
      finally {
        st.wilds = keep.wilds;
        G.ui._expMode = keep.mode; G.ui._expTarget = keep.t; G.ui._expRes = keep.r;
        G.ui.closeAllModals();
      }
      return ok;
    })(), _why156);

    check('§156③ 四块逐行（index.html：.exp-quad 单列）+ 旧 2×2 不留',
      /\\.exp-quad \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\);/.test(h156)
      && !/\\.exp-quad \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\) minmax\\(0, 1fr\\);/.test(h156));

    /* ---- ④ 侦察失败（公式唯一出口 + 无守将必成 + 掷骰实测） ---- */
    check('§156④ 侦察成功率：同资质同等级 85% / 弱将下限 / 无守将必成（唯一出口）', (function () {
      var R = G.DATA.SCOUT_RULE;
      if (!R || typeof G.battle.scoutChanceOf !== 'function') return false;
      var mk = function (lv, rank) { return { id: 'z', name: 'z', level: lv, rank: rank }; };
      var my = mk(20, 'ying');
      var p1 = G.battle.scoutChanceOf(my, { guard: mk(20, 'ying') }).p;
      var p2 = G.battle.scoutChanceOf(my, { guard: mk(60, 'tian') }).p;
      var p3 = G.battle.scoutChanceOf(my, { guard: null }).p;
      return Math.abs(p1 - (R.base + 0)) < 0.011 && p2 === R.lo && p3 === 1;
    })());

    check('§156④ 掷骰实测：失败 = 无情报无拾获（fail） / 成功 = 走分层路径（对照）', (function () {
      var fake = { kind: 'wild', x: 3, y: 3, terrain: 'hill', level: 3,
        guard: { id: 'zf', name: '守将Z', level: 40, rank: 'tian' }, garrison: { changqiang: 100 }, def: 0 };
      var gen = G.state.generals[0];
      var bkItems = JSON.parse(JSON.stringify(G.state.items || {}));
      var ok = false, dbg = '';
      try {
        var failRes = withFixedRandom([0.999], function () { return G.battle.scoutTarget(fake, gen); });
        var okRes = withFixedRandom([0.001], function () { return G.battle.scoutTarget(fake, gen); });
        var f1 = failRes.fail === true && (failRes.roster || []).length === 0 && !failRes.guard
          && (failRes.loot || []).length === 0 && !failRes.food && !failRes.treasure;
        var f2 = !okRes.fail && typeof okRes.intel === 'object';
        ok = f1 && f2;
        dbg = 'fail=' + failRes.fail + ' okFail=' + okRes.fail;
      } catch (e) { dbg = String(e && e.message); }
      finally { G.state.items = bkItems; }
      if (!ok) _why156 = dbg;
      return ok;
    })(), _why156);

    check('§156④ 失败公文（battle.js：侦察失败 · X + 不带 scout 字段 + fail msg）',
      /'侦查失败 · ' \\+ t\\.name/.test(b156)
      && /fail: !!sc\\.fail,/.test(b156)
      && /intel: \\{ lv: itL\\.lv, target: t\\.name \\},/.test(b156));

    check('§156④ 参数表在 DATA（唯一旋钮 · 数据驱动）',
      /DATA\\.SCOUT_RULE = \\{ base: 0\\.85, perLv: 0\\.015, perStar: 0\\.05, lo: 0\\.40, hi: 0\\.97 \\};/.test(d156));

    /* ---- ⑤ 需求档案在册（本轮） ---- */
    check('§156⑤ 需求档案在册（v89.156 · 老板原文关键句逐字）', (function () {
      var md = fs156.readFileSync(p156.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.156') >= 0
        && md.indexOf('弹窗出来的放弃按钮点击直接执行即可') >= 0
        && md.indexOf('被删除的那一行又闪烁出现了') >= 0
        && md.indexOf('改成（校场出征上限：XXX）') >= 0
        && md.indexOf('侦察可能失败，视双方将领资质和等级差设计') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

s = s.replace(ANCHOR, SEC)
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('smoke §156 inserted, len', orig, '->', len(s))

# -*- coding: utf-8 -*-
"""v89.137 补丁 H：smoke-test.js —— 专精三档断言升级 + 全境营造总览退役断言 + 两处旧锚点跟随"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次（须为 1）' % (tag, s.count(old)))
        sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ 1. 专精门槛断言（8465）→ 三档 ══════════
rep(
"""check('满级专精的门槛**仍是基准 12**（不跟名城上限走，否则已到手的专精会凭空消失）', (function () {
  var c = G.makeCity({ id: 'v54_m', name: 'v54专精', x: 1, y: 1, type: 'capital' });
  c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
  var idx = 0;
  c.cells[idx].build = { id: 'minfang', lvl: DATA.MAX_BLEVEL };
  var at12 = G.masteryOf(c, 'minfang');
  /* 若门槛错误地跟着名城上限（24）走，12 级就会变成"没满级" */
  return at12 === true && />= b\\.maxLevel/.test(stripComment(
    require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8')));
})());""",
"""check('建筑专精三档：12/24/36 各记一档 · 第一档值保持原样 · 档数 ×val（v89.137 老板 5）', (function () {
  /* 老板：「建筑的专精改名为"建筑专精"，分别在 12，24，36 级时增加效果
     （因为 12 级不是满级了现在）」——门槛是数据（DATA.MASTERY_TIERS），
     档数判定走唯一出口 masteryTierOf；mastery() 已含档数（val × 档数）。
     ⚠️ 第一档（Lv12）必须**等于原值** —— 不推翻已上线数值。 */
  var c = G.makeCity({ id: 'v137_m', name: 'v137专精', x: 1, y: 1, type: 'capital' });
  c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
  function setLv(lv) {
    c.cells.forEach(function (x) { if (x.build && x.build.id === 'minfang') x.build.lvl = 0; });
    c.cells[0].build = { id: 'minfang', lvl: lv };
  }
  var mf = null; (DATA.MASTERY || []).forEach(function (m) { if (m.bid === 'minfang') mf = m; });
  if (!mf) return false;
  setLv(11); var t0 = G.masteryTierOf(c, 'minfang'), v0 = G.mastery('popPct', c);
  setLv(12); var t1 = G.masteryTierOf(c, 'minfang'), v1 = G.mastery('popPct', c);
  setLv(23); var t1b = G.masteryTierOf(c, 'minfang');
  setLv(24); var t2 = G.masteryTierOf(c, 'minfang'), v2 = G.mastery('popPct', c);
  setLv(35); var t2b = G.masteryTierOf(c, 'minfang');
  setLv(36); var t3 = G.masteryTierOf(c, 'minfang'), v3 = G.mastery('popPct', c);
  return DATA.MASTERY_TIERS.join(',') === '12,24,36'
    && t0 === 0 && v0 === 0
    && t1 === 1 && Math.abs(v1 - mf.val) < 1e-9
    && t1b === 1
    && t2 === 2 && Math.abs(v2 - mf.val * 2) < 1e-9
    && t2b === 2
    && t3 === 3 && Math.abs(v3 - mf.val * 3) < 1e-9;
})(), (function () {
  var c = G.makeCity({ id: 'v137_mx', name: 'x', x: 1, y: 1, type: 'capital' });
  c.cells.forEach(function (x) { if (x.build) x.build.lvl = 0; });
  c.cells[0].build = { id: 'minfang', lvl: 24 };
  return 'Lv24 → popPct ' + G.mastery('popPct', c) + '（档 ' + G.masteryTierOf(c, 'minfang') + '）';
})());""",
'专精三档断言')

# ══════════ 2. 建筑面板结构断言（10599） ══════════
rep(
"""  check('结构：建筑面板按 DATA.MASTERY 数据驱动显示满级专精', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    return /DATA\\.MASTERY/.test(body) && /满级专精/.test(body) && /GAME\\.masteryOf\\(c, b\\.id\\)/.test(body);
  })());""",
"""  check('结构：建筑面板按 DATA.MASTERY 数据驱动显示建筑专精（三档进度）', (function () {
    var body = codeOf(uS, 'ui.openBuildModal = function');
    return /DATA\\.MASTERY/.test(body) && /建筑专精/.test(body)
      && /GAME\\.masteryTierOf\\(c, b\\.id\\)/.test(body) && /DATA\\.MASTERY_TIERS/.test(body);
  })());""",
'建筑面板结构断言')

# ══════════ 3. 建筑面板实测断言（10603） ══════════
rep(
"""  check('实测：建筑面板显示「满级专精 + 达成条件」', (function () {""",
"""  check('实测：建筑面板显示「建筑专精 + 三档进度 + 下一档」', (function () {""",
'面板实测名')
rep(
"""      return html.indexOf('满级专精') >= 0
        && html.indexOf('Lv' + DATA.MAX_BLEVEL + ' 达成') >= 0;""",
"""      /* v89.137：三档形态 —— 标题 + 逐档门槛 + "下一档"提示（1 级民房 = 档 0 时） */
      return html.indexOf('建筑专精') >= 0
        && html.indexOf('Lv12') >= 0 && html.indexOf('下一档 Lv24') >= 0;""",
'面板实测判据')

# ══════════ 4. 段 ③：全境营造总览退役断言（21934-21952） ══════════
rep(
"""    /* ---- ③ 全境营造总览（测评遗留第 1 条落地） ---- */
    console.log('  --- ③ 全境营造总览（跨城队列 + 一键提速） ---');
    S102.res.gold = 5e6;
    S102.res.grain = 5e6; S102.res.wood = 5e6;
    S102.res.stone = 5e6; S102.res.iron = 5e6;
    (function () {
      /* 在两座城里各起一条工程（城流之后"逐城点开"不成立） */
      var c2 = S102.cities[0];
      var free = null, i;
      for (i = 0; i < c2.cells.length; i++) {
        if (!c2.cells[i].build && !c2.cells[i].official) { free = i; break; }
      }
      /* 建造入口的唯一出口是 GAME.buildAt(cityId, gridIndex, buildId) */
      if (free != null) {
        try { GAME.buildAt(c2.id, free, 'minfang'); } catch (e) {}
      }
    })();
    check('③ buildOverview：列出全境在办工程（含城名/建筑/进度/提速价）', (function () {
      var rows = G.buildOverview();
      return rows.length >= 1 && rows[0].city && rows[0].name
        && typeof rows[0].pct === 'number' && rows[0].cost >= 0
        && typeof rows[0].cityId === 'string';
    })(), G.buildOverview().map(function (r) { return r.city + '·' + r.name + '(' + r.pct + '%)'; }).join(' / '));
    check('③ 定位单条：buildQueueOf(城, 格) —— **两字段一起比**（防跨城串号）', (function () {
      var rows = G.buildOverview();
      if (!rows.length) return false;
      var q = G.buildQueueOf(rows[0].cityId, rows[0].gridIndex);
      var wrongCity = G.buildQueueOf('__no_such_city__', rows[0].gridIndex);
      return !!q && wrongCity === null && q.buildId === rows[0].buildId;
    })());
    check('③ rushAllBuilds：一键全提 → 逐条走 queueRushPay（金减少、工程推进）', (function () {
      var before = G.buildOverview().length, gold0 = S102.res.gold;
      var r = G.rushAllBuilds();
      var left = G.buildOverview().filter(function (x) { return x.cost > 0; }).length;
      return r.ok === true && r.n === before && S102.res.gold < gold0;
    })(), 'n=' + G.rushAllBuilds().n);""",
"""    /* ---- ③ 全境营造总览：v89.137（老板 4）整条退役 · 防复活 ---- */
    console.log('  --- ③ 全境营造总览已退役（跨城队列 + 一键提速 · 老板判重） ---');
    check('③ 退役：数据层三函数 + 面板函数 + 动作 case 全部清零（剥注释后查）', (function () {
      var _fs = require('fs'), _p = require('path');
      var d = stripComment(_fs.readFileSync(_p.join(__dirname, 'js/domain.js'), 'utf8'));
      var u = stripComment(_fs.readFileSync(_p.join(__dirname, 'js/ui.js'), 'utf8'));
      var m = stripComment(_fs.readFileSync(_p.join(__dirname, 'js/main.js'), 'utf8'));
      return !/GAME\\.buildOverview = function/.test(d)
        && !/GAME\\.rushAllBuilds = function/.test(d)
        && !/GAME\\.buildQueueOf = function/.test(d)
        && !/ui\\.openBuildOverview = function/.test(u)
        && u.indexOf('open-build-ov') < 0
        && m.indexOf("'rush-ov'") < 0 && m.indexOf("'rush-ov-all'") < 0;
    })());
    check('③ 单体提速不受影响：queueRushPay 仍在（建筑面板 ⚡ 提速 唯一出口）', (function () {
      return typeof G.queueRushPay === 'function'
        && /GAME\\.queueRushPay = function/.test(stripComment(
          require('fs').readFileSync(require('path').join(__dirname, 'js/domain.js'), 'utf8')));
    })());""",
'段③退役断言')

# ══════════ 5. 招贤馆断言的窗口随文本加长（2400 → 3200） ══════════
rep(
"""    var seg = uS33.slice(i, i + 2400);
    return seg.indexOf('inn-card') < 0 && seg.indexOf('modalPage') < 0
      && /房间（本城将领席位）/.test(seg) && /将领」菜单/.test(seg);""",
"""    var seg = uS33.slice(i, i + 3200);   /* v89.137：专精三档显示加长了两行 → 窗口随之放宽 */
    return seg.indexOf('inn-card') < 0 && seg.indexOf('modalPage') < 0
      && /房间（本城将领席位）/.test(seg) && /将领」菜单/.test(seg);""",
'招贤馆窗口')

# ══════════ 写盘 + 自检 ══════════
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
dNow = io.open(os.path.join(ROOT, 'js', 'domain.js'), 'r', encoding='utf-8', newline='').read()
assert 'GAME.buildOverview = function' not in dNow, 'domain 残留'
assert 'GAME.rushAllBuilds = function' not in dNow, 'domain 残留2'
# 测试文件里含大量正则 / 字符串花括号 —— 全局计数天然不配平，判据改用「替换计数 + node --check」
assert len(ok) == 6, "应有 6 段替换，实际 %d" % len(ok)
print('✅ smoke-test.js 补丁完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))

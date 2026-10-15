# -*- coding: utf-8 -*-
"""v89.127 补丁 B：smoke 断言 —— U.fmt 千级逗号 + §107 城墙入城迁移提示（3 条）"""
import io

R = 'E:/Deepseekdb/'
P = R + 'smoke-test.js'
s = io.open(P, encoding='utf-8').read()
orig = s

# ---------- ① U.fmt 千级逗号 ----------
old1 = "  check('U.fmt 仍保留（弹窗/成本对比用缩写）', U.fmt(20000) === '2.0万', U.fmt(20000));"
new1 = (old1 + "\n"
        "  check('U.fmt 千级逗号（v89.127 起 k 退役）', U.fmt(1500) === '1,500', U.fmt(1500));")
assert s.count(old1) == 1, '① 锚点 %d' % s.count(old1)
s = s.replace(old1, new1)

# ---------- ② §107 迁移提示 ----------
anchor2 = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
sect = """  /* ============================================================
   * §107 城墙入城迁移不再静默（v89.127）
   * ------------------------------------------------------------
   * 老档（city.wallLv）读档时城墙搬进格子：无空地会**覆盖**一座原建筑 ——
   * 这条"有损"此前是静默的（v89.126 遗留），现写进公文 / 消息流。判据：
   *   ① 有损迁移 → 消息含「城墙入城」+「原为」；城墙格等级 = 原 wallLv；wallLv 已删
   *   ② 有空地迁移 → 消息不含「原为」（无损失不记账）
   *   ③ 再读一次不产生第二条（迁移只发生一次）
   * ============================================================ */
  (function () {
    var keep127 = G.state;
    /* ① 满格 + wallLv=7 */
    var st127 = G.newGame({ name: 'v127', cityName: '许都', region: '豫州', mapSeed: 1 });
    var c127 = st127.cities[0];
    c127.cells.forEach(function (x) { if (!x.official && !x.build) x.build = { id: 'minfang', lvl: 1 }; });
    c127.wallLv = 7;
    var st127a = G.adoptState(JSON.parse(JSON.stringify(st127)));
    var c127a = st127a.cities[0];
    var w127 = null;
    c127a.cells.forEach(function (x, i) { if (x.build && x.build.id === 'chengqiang') w127 = { i: i, lv: x.build.lvl }; });
    var last127 = (st127a.msgLog || [])[st127a.msgLog.length - 1] || {};
    check('§107① 有损迁移写提示：含「城墙入城」+「原为」· 城墙格 Lv7 · wallLv 已删',
      !!(w127 && w127.lv === 7) && c127a.wallLv === undefined
      && (last127.msg || '').indexOf('城墙入城') >= 0 && (last127.msg || '').indexOf('原为') >= 0,
      (last127.msg || '(无消息)').slice(0, 64));
    /* ② 留两格空地 → 无损失，不应有「原为」 */
    var st127b = G.newGame({ name: 'v127b', cityName: '许都', region: '豫州', mapSeed: 2 });
    var c127b = st127b.cities[0];
    var emp127 = 0;
    c127b.cells.forEach(function (x) { if (!x.official && x.build && emp127 < 2) { delete x.build; emp127++; } });
    c127b.wallLv = 5;
    var st127c = G.adoptState(JSON.parse(JSON.stringify(st127b)));
    var last127c = (st127c.msgLog || [])[st127c.msgLog.length - 1] || {};
    check('§107② 有空地迁移：同写一条但不含「原为」（无损失不记账）',
      (last127c.msg || '').indexOf('城墙入城') >= 0 && (last127c.msg || '').indexOf('原为') < 0,
      (last127c.msg || '(无消息)').slice(0, 64));
    /* ③ 迁移只发生一次 */
    var st127d = G.adoptState(JSON.parse(JSON.stringify(st127a)));
    var n127 = (st127d.msgLog || []).filter(function (m) { return (m.msg || '').indexOf('城墙入城') >= 0; }).length;
    check('§107③ 迁移只发生一次（再读档不重复写）', n127 === 1, n127 + ' 条');
    G.state = keep127;
  })();

"""
assert s.count(anchor2) == 1, '② 锚点 %d' % s.count(anchor2)
s = s.replace(anchor2, sect + anchor2)

# ---------- 写前自检 ----------
assert s != orig
assert s.count('§107①') == 1 and s.count('k 退役') == 1


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '整体括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8').write(s)
print('patch B OK')

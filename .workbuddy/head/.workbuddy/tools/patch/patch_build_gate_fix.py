# -*- coding: utf-8 -*-
"""v68 修正：buildPrereqOf 支持"新建语义"，并适配受影响的既有测试。

修正（真缺陷）：
  buildAt 新建第二座可多建建筑（仓库/民房…）时，`buildingLevel + 1` 会算成 2，
  被官府总闸误拦。新增第三参 nextLv：新建传 1，升级不传（默认 lvl+1）。

测试适配（6 处，均为"官府拉到本城满级"，让老测试回到原语义）：
  · 332 段 队列机制：建筑换成无前置的（规则本身在第 55 节验证）
  · 4307 段 升级中军营：防"if (!r.ok) return true"静默弱化
  · 7415 段 都城/自建城：档位加成不受总闸干扰
  · v54 五档上限值：同上
  · v64wall3 城墙满级：同上
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
DOM_JS = os.path.join(ROOT, 'js', 'domain.js')
UI_JS = os.path.join(ROOT, 'js', 'ui.js')
SMOKE = os.path.join(ROOT, 'smoke-test.js')

MARK = 'nextLv || (GAME.buildingLevel(city, bid) + 1)'

PLAN = [
    # ---------- A. 接口修正 ----------
    (DOM_JS,
     'GAME.buildPrereqOf = function (city, bid) {',
     'GAME.buildPrereqOf = function (city, bid, nextLv) {',
     'domain.js · buildPrereqOf 加 nextLv 参数'),

    (DOM_JS,
     '      var next = GAME.buildingLevel(city, bid) + 1;',
     """      /* nextLv：本次动作要到达的等级。
         新建（buildAt）显式传 1 —— 可多建建筑（仓库/民房…）已有等级时，
         不能用 buildingLevel+1，否则"新建第二座"会被当成"升到 N+1"误拦。
         升级（upgradeAt）不传，默认 lvl+1。 */
      var next = nextLv || (GAME.buildingLevel(city, bid) + 1);""",
     'domain.js · next 语义修正'),

    (DOM_JS,
     '    /* v68 · 逐步探索：建造前置（先 X 后 Y）—— 与升级共用同一判定，见 buildPrereqOf */\n    var pre = GAME.buildPrereqOf(city, buildId);',
     '    /* v68 · 逐步探索：建造前置（先 X 后 Y）—— 与升级共用同一判定，见 buildPrereqOf */\n    var pre = GAME.buildPrereqOf(city, buildId, 1);',
     'domain.js · buildAt 传"新建"语义'),

    (UI_JS,
     '        var preB = GAME.buildPrereqOf(c, bid);',
     '        var preB = GAME.buildPrereqOf(c, bid, 1);',
     'ui.js · 建造卡传"新建"语义'),

    # ---------- B. smoke：helper ----------
    (SMOKE,
     """  /* 在空地上放一座建筑（造测试环境用；找不到空位返回 false） */
  function setBldg(city, bid, lv) {""",
     """  /* v68（逐步探索）：把城的官府设为"该城满级"（12 + 档位加成）——
     让"建筑应能自由升满"的老测试段不受官府总闸影响。
     总闸本身的验证在「第 55 节 · 建造前置」，那里用低级官府做对照。 */
  function govMax(c) {
    var cap = (DATA.BUILDINGS.guanfu.maxLevel || DATA.MAX_BLEVEL) + (GAME.cityBuildBonus(c) || 0);
    ((c && c.cells) || []).forEach(function (x) {
      if (x.build && x.build.id === 'guanfu') x.build.lvl = cap;
    });
    return c;
  }

  /* 在空地上放一座建筑（造测试环境用；找不到空位返回 false） */
  function setBldg(city, bid, lv) {""",
     'smoke · 新增 govMax helper'),

    # ---------- C. smoke：332 段队列机制 ----------
    (SMOKE,
     """  var q1 = G.buildAt(s.cities[0].id, f1, 'kezhan');
  check('第1个建造发起成功', q1.ok === true, q1.msg);
  var q2 = G.buildAt(s.cities[0].id, f2, 'zhaoxianguan');
  check('第2个建造发起成功', q2.ok === true, q2.msg);""",
     """  /* v68：本段只测队列机制 —— 建筑一律选**无前置**的；前置规则本身在「第 55 节」验证 */
  var q1 = G.buildAt(s.cities[0].id, f1, 'junying');
  check('第1个建造发起成功', q1.ok === true, q1.msg);
  var q2 = G.buildAt(s.cities[0].id, f2, 'cangku');
  check('第2个建造发起成功', q2.ok === true, q2.msg);""",
     'smoke · 332 段换无前置建筑'),

    (SMOKE,
     "  var q3 = G.buildAt(s.cities[0].id, f3, 'honglusi');",
     "  var q3 = G.buildAt(s.cities[0].id, f3, 'cangku');",
     'smoke · 332 段 q3'),

    (SMOKE,
     "  var q4 = G.buildAt(s.cities[0].id, f3, 'honglusi');",
     "  var q4 = G.buildAt(s.cities[0].id, f3, 'cangku');",
     'smoke · 332 段 q4'),

    # ---------- D. smoke：4307 升级中军营 ----------
    (SMOKE,
     """  check('实测：升级中军营仍可募兵', (function () {
    var s = G.state, c = s.cities[0];
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;""",
     """  check('实测：升级中军营仍可募兵', (function () {
    var s = G.state, c = s.cities[0];
    govMax(c);   /* v68：官府拉满 —— 本段专注"升级中的军营"，不测总闸；防 if(!r.ok)return true 静默弱化 */
    s.res.grain = 1e8; s.res.wood = 1e8; s.res.stone = 1e8; s.res.iron = 1e8;""",
     'smoke · 4307 段 govMax'),

    # ---------- E. smoke：v54 五档上限值 ----------
    (SMOKE,
     "    return G.buildCapOf(G.makeCity({ id: 'v54_' + t, name: t, x: 1, y: 1, type: t }), 'minfang');",
     "    return G.buildCapOf(govMax(G.makeCity({ id: 'v54_' + t, name: t, x: 1, y: 1, type: t })), 'minfang');",
     'smoke · v54 五档上限 govMax'),

    # ---------- F. smoke：v54 都城/自建城行为 ----------
    (SMOKE,
     """  var doCity = G.makeCity({ id: 'v54_do', name: 'v54都城', x: 500, y: 500, type: 'capital' });
  var selfCity = G.makeCity({ id: 'v54_self', name: 'v54自建', x: 501, y: 501, type: 'self' });
  s.cities.push(doCity, selfCity);""",
     """  var doCity = G.makeCity({ id: 'v54_do', name: 'v54都城', x: 500, y: 500, type: 'capital' });
  var selfCity = G.makeCity({ id: 'v54_self', name: 'v54自建', x: 501, y: 501, type: 'self' });
  /* v68：官府拉满 —— 本段验证的是名城档位加成，不是官府总闸 */
  govMax(doCity); govMax(selfCity);
  s.cities.push(doCity, selfCity);""",
     'smoke · v54 行为段 govMax'),

    # ---------- G. smoke：v64wall3 城墙满级 ----------
    (SMOKE,
     """      var c = st.cities[0];
      c.wallLv = G.buildCapOf(c, 'chengqiang');
      /* 其余建筑也拉满 → 必须报"全部建筑已满级（含城墙）" */""",
     """      var c = st.cities[0];
      govMax(c);   /* v68：官府拉满 —— "全部满级"指该城上限，而不是官府总闸 */
      c.wallLv = G.buildCapOf(c, 'chengqiang');
      /* 其余建筑也拉满 → 必须报"全部建筑已满级（含城墙）" */""",
     'smoke · v64wall3 govMax'),
]


def main():
    texts = {}
    for p in {DOM_JS, UI_JS, SMOKE}:
        texts[p] = io.open(p, 'rb').read().decode('utf-8')

    # 幂等
    if MARK in texts[DOM_JS] and 'function govMax(c)' in texts[SMOKE]:
        print('· v68 修正已存在，跳过（幂等）')
        return 0

    crlf0 = {p: texts[p].count('\r\n') for p in texts}
    done = []
    for path, old, new, tag in PLAN:
        t = texts[path]
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次（应为 1），拒绝写盘' % (tag, c))
            return 1
        if new in t:
            print('· [%s] 已应用' % tag)
            continue
        texts[path] = t.replace(old, new, 1)
        done.append(tag)

    for path in texts:
        out = texts[path].encode('utf-8')
        if out.count(b'\r\n') != crlf0[path]:
            print('✗ 行尾被改写（%s）' % path)
            return 1
        io.open(path, 'wb').write(out)

    print('本次改动: %d 处' % len(done))
    for tag in done:
        print('  ·', tag)
    # 落盘核验
    d = io.open(DOM_JS, encoding='utf-8', newline='').read()
    s = io.open(SMOKE, encoding='utf-8', newline='').read()
    ok = MARK in d and 'govMax(doCity)' in s and "nextLv ||" in d
    if not ok:
        print('✗ 核验未过')
        return 1
    print('✓ 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())

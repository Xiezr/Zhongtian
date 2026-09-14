# -*- coding: utf-8 -*-
"""v68 · 建造前置：e2e 适配 + smoke 第 54 节断言。

① e2e "升级中军营"段：官府拉满（本段测"升级不锁功能"，不测总闸）
② smoke 新增第 54 节：建造前置完整断言（总闸 / 先客栈后招贤馆 / 铁匠铺→工匠作坊 /
   可多建建筑回归 / 表与出口收口 / 无官府豁免）
③ 修正注释里的节号引用（第 55 节 → 第 54 节，2 处）
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
SMOKE = os.path.join(ROOT, 'smoke-test.js')
E2E = os.path.join(ROOT, 'e2e-test.js')

MARK = '第 54 节：建造前置（逐步探索）'

# ---------------------------------------------------------------- ① e2e
E1_OLD = """    /* ---- ① 升级是后台过程：升级中仍能打开功能面板 ---- */
    const junI = findEmpty24();"""

E1_NEW = """    /* v68（逐步探索）：官府拉满 —— 本段专注"升级不锁功能"，不受官府总闸干扰 */
    c24.cells.forEach((x) => { if (x.build && x.build.id === 'guanfu') x.build.lvl = 12; });

    /* ---- ① 升级是后台过程：升级中仍能打开功能面板 ---- */
    const junI = findEmpty24();"""

# ---------------------------------------------------------------- ② smoke 第 54 节
N54 = """  /* ============================================================
   * 54. 建造前置（v68 · 逐步探索）
   * ------------------------------------------------------------
   * 老板三条 + 补充规则，全部走 GAME.buildPrereqOf 单一出口：
   *   ① 其他建筑等级不能超过官府（总闸：buildCapOf 与 prereq 同一判据）
   *   ② 先客栈后招贤馆（招贤馆需客栈 Lv2）
   *   ③ 铁匠铺 Lv3 才能建工匠作坊
   *   ④~⑥ 校场/驿站/鸿胪寺/马厩
   * 建造与升级同一把尺；新建按 1 级算（可多建建筑不被误判为升级）。
   * ============================================================ */
  console.log('\\n--- 第 54 节：建造前置（逐步探索） ---');
  (function () {
    var keep54 = G.state;
    var st54 = G.newGame({ name: 'gate54' });
    G.state = st54;
    if (G.map.generate) G.map.generate();
    var rd54 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var c54 = st54.cities[0];
    st54.res.grain = 5e8; st54.res.wood = 5e8; st54.res.stone = 5e8; st54.res.iron = 5e8; st54.res.gold = 5e8;
    var free54 = function () {
      for (var i = 0; i < c54.cells.length; i++) {
        var x = c54.cells[i];
        if (!x.official && !x.build && !x.pending) return i;
      }
      return -1;
    };
    var fin54 = function () {
      var g = 0;
      while (st54.queues.build.length && g++ < 40) {
        var q = st54.queues.build[0]; q.elapsed = q.totalTime; G.applyBuildDone(q);
        var ix = st54.queues.build.indexOf(q); if (ix >= 0) st54.queues.build.splice(ix, 1);
      }
    };
    var setGov54 = function (lv) {
      c54.cells.forEach(function (x) { if (x.build && x.build.id === 'guanfu') x.build.lvl = lv; });
    };
    var govIdx54 = c54.cells.findIndex(function (x) { return x.build && x.build.id === 'guanfu'; });

    try {
      /* ---- ① 官府总闸：等级 ≤ 官府 ---- */
      var g1 = free54();
      var b1 = G.buildAt(c54.id, g1, 'junying');
      check('官府 Lv1 时：新建筑（1级）可建', b1.ok === true, b1.msg);
      fin54();
      var u1 = G.upgradeAt(c54.id, g1);
      check('★ 官府 Lv1 时军营升 2 级被拦（总闸生效，提示指向官府）',
        u1.ok === false && /官府/.test(u1.msg || ''), u1.msg);
      var gu1 = G.upgradeAt(c54.id, govIdx54);
      check('★ 官府自身不受总闸（它可以先升）', gu1.ok === true, gu1.msg);
      fin54();
      setGov54(2);
      var u2 = G.upgradeAt(c54.id, g1);
      check('★ 官府 Lv2 后军营可升 2 级（总闸打开）', u2.ok === true, u2.msg);
      fin54();
      setGov54(12);
      var gu2 = G.upgradeAt(c54.id, govIdx54);
      check('官府 12 级是它自己的硬顶（报「最高等级」而不是官府）',
        gu2.ok === false && /最高等级/.test(gu2.msg || ''), gu2.msg);

      /* ---- ② 先客栈后招贤馆 ---- */
      var z1 = free54();
      var p1 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('★ 无客栈时招贤馆被拦（先客栈后招贤馆）',
        p1.ok === false && /客栈/.test(p1.msg || ''), p1.msg);
      var k1 = free54();
      var p2 = G.buildAt(c54.id, k1, 'kezhan');
      check('客栈本身可建（无前置）', p2.ok === true, p2.msg);
      fin54();
      var p3 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('客栈 Lv1 仍不够（需 Lv2）', p3.ok === false, p3.msg);
      c54.cells[k1].build.lvl = 2;
      var p4 = G.buildAt(c54.id, z1, 'zhaoxianguan');
      check('★ 客栈到 Lv2 后招贤馆可建', p4.ok === true, p4.msg);
      fin54();
      /* 升级同受前置：把客栈压回 Lv1 */
      c54.cells[k1].build.lvl = 1;
      var p5 = G.upgradeAt(c54.id, z1);
      check('★ 升级同受前置（客栈降级后招贤馆不能升）',
        p5.ok === false && /客栈/.test(p5.msg || ''), p5.msg);
      c54.cells[k1].build.lvl = 2;

      /* ---- ③ 铁匠铺 → 工匠作坊 ---- */
      var t1 = free54();
      var q1g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('★ 无铁匠铺时工匠作坊被拦', q1g.ok === false && /铁匠铺/.test(q1g.msg || ''), q1g.msg);
      var t2 = free54();
      G.buildAt(c54.id, t2, 'tiejiangpu'); fin54();
      c54.cells[t2].build.lvl = 2;
      var q2g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('铁匠铺 Lv2 仍不够（需 Lv3）', q2g.ok === false, q2g.msg);
      c54.cells[t2].build.lvl = 3;
      var q3g = G.buildAt(c54.id, t1, 'gongjiangzuofang');
      check('★ 铁匠铺到 Lv3 后工匠作坊可建', q3g.ok === true, q3g.msg);
      fin54();

      /* ---- ④ 可多建建筑的新建不被误判为升级（真缺陷回归）---- */
      var ck1 = free54();
      var c1b = G.buildAt(c54.id, ck1, 'cangku');
      check('仓库第 1 座可建', c1b.ok === true, c1b.msg);
      fin54();
      var ck2 = free54();
      var c2b = G.buildAt(c54.id, ck2, 'cangku');
      check('★ 仓库第 2 座可建（新建按 1 级算，不被误当升级）', c2b.ok === true, c2b.msg);
      fin54();

      /* ---- ⑤ 表与出口的收口 ---- */
      check('前置表 6 条规则齐备', (function () {
        var P = DATA.BUILD_PREREQ || {};
        return P.zhaoxianguan && P.zhaoxianguan.kezhan === 2
          && P.gongjiangzuofang && P.gongjiangzuofang.tiejiangpu === 3
          && P.xiaochang && P.xiaochang.junying === 2
          && P.yizhan && P.yizhan.shichang === 2
          && P.honglusi && P.honglusi.kezhan === 3
          && P.majiu && P.majiu.junying === 3;
      })());
      check('逐步探索只有一个出口：buildPrereqOf 定义 1 处、内核与 UI 都接',
        (function () {
          var d = stripComment(rd54('domain')), u = stripComment(rd54('ui'));
          return (d.match(/GAME\\.buildPrereqOf\\s*=\\s*function/g) || []).length === 1
            && (d.match(/GAME\\.buildPrereqOf\\(/g) || []).length >= 2
            && (u.match(/GAME\\.buildPrereqOf\\(/g) || []).length >= 2;
        })());
      check('无官府的城不受总闸（异常/测试构造不被误伤）', (function () {
        var cx = G.makeCity({ id: 'nogov54', name: '无官府城', x: 1, y: 1, type: 'self' });
        cx.cells.forEach(function (x) { if (x.build) x.build = null; });
        var cap = G.buildCapOf(cx, 'minfang');
        var pre = G.buildPrereqOf(cx, 'minfang', 3);
        cx.cells[0].build = { id: 'minfang', lvl: 5 };
        st54.cities.push(cx);
        var up = G.upgradeAt(cx.id, 0);
        return cap === DATA.MAX_BLEVEL && pre.ok === true && up.ok === true;
      })());
    } finally {
      G.state = keep54;
    }
  })();

"""

S_OLD = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""

S_NEW = N54 + S_OLD

# ---------------------------------------------------------------- ③ 节号引用修正
REF_OLD = '「第 55 节 · 建造前置」'
REF_NEW = '「第 54 节 · 建造前置」'
REF2_OLD = '前置规则本身在「第 55 节」验证'
REF2_NEW = '前置规则本身在「第 54 节」验证'


def main():
    smoke = io.open(SMOKE, 'rb').read().decode('utf-8')
    e2e = io.open(E2E, 'rb').read().decode('utf-8')

    if MARK in smoke and '官府拉满 —— 本段专注' in e2e:
        print('· 已存在，跳过（幂等）')
        return 0

    crlf_s = smoke.count('\r\n')
    crlf_e = e2e.count('\r\n')
    done = []

    # ① e2e
    if '官府拉满 —— 本段专注' not in e2e:
        if e2e.count(E1_OLD) != 1:
            print('✗ e2e 锚点命中 %d 次' % e2e.count(E1_OLD))
            return 1
        e2e = e2e.replace(E1_OLD, E1_NEW, 1)
        done.append('e2e · 24 段官府拉满')

    # ② smoke 新节
    if MARK not in smoke:
        if smoke.count(S_OLD) != 1:
            print('✗ smoke 尾部锚点命中 %d 次' % smoke.count(S_OLD))
            return 1
        smoke = smoke.replace(S_OLD, S_NEW, 1)
        done.append('smoke · 第 54 节')

    # ③ 节号引用
    if REF_OLD in smoke:
        n = smoke.count(REF_OLD)
        smoke = smoke.replace(REF_OLD, REF_NEW)
        done.append('smoke · 节号引用修正 ×%d' % n)
    if REF2_OLD in smoke:
        smoke = smoke.replace(REF2_OLD, REF2_NEW)
        done.append('smoke · 节号引用修正 2')

    out_s = smoke.encode('utf-8')
    out_e = e2e.encode('utf-8')
    if out_s.count(b'\r\n') != crlf_s or out_e.count(b'\r\n') != crlf_e:
        print('✗ 行尾被改写')
        return 1
    io.open(SMOKE, 'wb').write(out_s)
    io.open(E2E, 'wb').write(out_e)

    print('本次改动: %d 处' % len(done))
    for d in done:
        print('  ·', d)
    chk = io.open(SMOKE, encoding='utf-8', newline='').read()
    ok = MARK in chk and '第 55 节' not in chk
    print('✓ 完成' if ok else '✗ 核验未过（残留第 55 节引用？）')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

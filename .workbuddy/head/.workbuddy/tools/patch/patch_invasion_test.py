# -*- coding: utf-8 -*-
"""补丁 4：给「定期来袭」补 smoke 断言（第 53 节）。

为什么不写"存在即通过"的断言：项目铁律「禁恒真断言；行为断言必须能翻转」。
本节的核心两条都做成**能红**的：
  ★ 城墙 Lv0→12 守备力必须变化  —— 桩掉 cityDefense 立刻红（配套破坏测试 break_invasion.py）
  ★ 兵力越集中在目标城战损越小  —— 这是"收拢 vs 分散"的真实取舍

结构断言一律走 `codeOf()`（内部已 stripComment）——
本轮刚踩过：计数断言不过 stripComment 会把我自己写的注释也数进去。

行尾：smoke-test.js 是纯 LF，newline=''。
用法：python patch_invasion_test.py
"""
import io, os, sys

P = r'E:\Deepseekdb\smoke-test.js'

ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');\n"

SECTION = r"""  console.log('  --- 第 53 节：定期来袭（第 2 期 · 防守） ---');
  (function () {
    var G = GAME, D = DATA;
    var stBackup = G.state;
    var fsx = require('fs'), pathx = require('path');
    var stSrc = stripComment(fsx.readFileSync(pathx.join(__dirname, 'js', 'state.js'), 'utf8'));

    /* ---- 结构：唯一出口与红线 ---- */
    check('四个唯一出口都在（invasionTick / invasionDueAt / defensePowerOf / invasionPowerOf）',
      typeof G.invasionTick === 'function' && typeof G.invasionDueAt === 'function'
      && typeof G.defensePowerOf === 'function' && typeof G.invasionPowerOf === 'function');

    check('DATA.INVASION 存在，且 loseCity===false（体验红线：输了不丢城）',
      !!D.INVASION && D.INVASION.loseCity === false);

    check('invasionTick 全项目只有一处定义（不许多套口径）',
      (stSrc.match(/GAME\.invasionTick\s*=/g) || []).length === 1);

    var tickBody = codeOf(stSrc, 'GAME.tickOnce = function');
    var bulkBody = codeOf(stSrc, 'GAME.simulateBulk = function');
    check('在线 tickOnce 调 invasionTick', tickBody.length > 500 && /GAME\.invasionTick\s*\(/.test(tickBody),
      '体长 ' + tickBody.length);
    check('离线 simulateBulk 调 invasionTick（**同口径**，不许各写一套）',
      bulkBody.length > 300 && /GAME\.invasionTick\s*\(/.test(bulkBody), '体长 ' + bulkBody.length);

    /* ---- 造受控局面：三座城（过解锁门槛；三城才能验"收拢 vs 分散"）---- */
    var st = G.newGame({ name: '守城测试', avatar: '\u{1F9D4}', gender: 'male', region: 'random' });
    G.state = st;                       // ⚠️ newGame 只返回 state，不装进 GAME.state
    G.map.generate();
    st.cities.push(G.makeCity({ id: 'inv2', name: '二城', x: 265, y: 215 }));
    st.cities.push(G.makeCity({ id: 'inv3', name: '三城', x: 266, y: 216 }));
    var c = st.cities[0], c2 = st.cities[1], c3 = st.cities[2];
    st.world = st.world || {}; st.world.elapsed = 0;
    c.army = { yibing: 5000 }; c2.army = {}; c3.army = {};

    check('首次推进后给出排期（invasionDueAt > 0）',
      (function () { G.invasionTick(0); return G.invasionDueAt(c) > 0; })());

    /* ---- ★ 核心一：城防真的被消费（不再是死显示）---- */
    var d0, d12;
    c.wallLv = 0;  d0 = G.defensePowerOf(c);
    c.wallLv = 12; d12 = G.defensePowerOf(c);
    check('★ 城墙 Lv0→12 守备力真的变了（城防被消费，不是只进显示）',
      d12 > d0 * 1.3, d0 + ' → ' + d12);

    /* 快照/还原：invasionResolve 会改 city，连调两次会叠加 */
    var snap = function () {
      return { army: JSON.parse(JSON.stringify(c.army)), wall: c.wallLv,
               res: JSON.parse(JSON.stringify(G.res(c))), rep: st.rep };
    };
    var back = function (s0) {
      c.army = JSON.parse(JSON.stringify(s0.army)); c.wallLv = s0.wall; st.rep = s0.rep;
      var R = G.res(c); for (var k in R) { if (R.hasOwnProperty(k)) delete R[k]; }
      for (var k2 in s0.res) R[k2] = s0.res[k2];
    };
    var s0 = snap();
    c.wallLv = 0;  var r0  = G.invasionResolve(c); back(s0);
    c.wallLv = 12; var r12 = G.invasionResolve(c); back(s0);
    check('★ 同一来袭规模下，城墙等级真的改变战损（不只是显示值）',
      r0.severity !== r12.severity || r0.held !== r12.held,
      'Lv0 sev=' + r0.severity.toFixed(3) + ' / Lv12 sev=' + r12.severity.toFixed(3));

    /* ---- ★ 核心二：兵力越集中，战损越小（收拢 vs 分散）---- */
    c.wallLv = 0;
    c.army = { yibing: 5000 }; c2.army = {}; c3.army = {};
    var sevConc = G.invasionResolve(c); back(s0);
    c.army = { yibing: 1000 }; c2.army = { yibing: 2000 }; c3.army = { yibing: 2000 };
    var sevSpread = G.invasionResolve(c); back(s0);
    check('★ 兵力集中在目标城 → 战损更小（分散挨打，这是机制的真实取舍）',
      sevSpread.ratio > sevConc.ratio,
      '收拢 ratio=' + sevConc.ratio.toFixed(3) + ' vs 分散 ratio=' + sevSpread.ratio.toFixed(3));

    /* ---- 到点必触发 + 不丢城 ---- */
    var cityCount = st.cities.length;
    var now = st.world.elapsed || 0;
    c.inv.nextAt = now - 1;
    var fired = G.invasionTick(0);
    check('时间轮到点必触发（返回触发次数 ≥1）', fired >= 1, 'fired=' + fired);
    check('结算后城池数不变（loseCity=false 的结构保证）', st.cities.length === cityCount,
      st.cities.length + ' 城');

    /* ---- 边界：开关 ---- */
    st.settings.invasion = false;
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('总开关关掉后永不触发', G.invasionTick(0) === 0);
    check('总开关关掉后 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    st.settings.invasion = true;

    /* ---- 边界：城数不足不解锁（别一开局就挨打）---- */
    var saved = st.cities;
    st.cities = [c];
    check('城数不足解锁门槛时 invasionDueAt 返回 0', G.invasionDueAt(c) === 0);
    c.inv.nextAt = (st.world.elapsed || 0) - 1;
    check('城数不足解锁门槛时 invasionTick 不触发', G.invasionTick(0) === 0);
    st.cities = saved;

    /* ---- 可复现随机：断言要能稳定，就不能用真随机 ---- */
    check('invasionRoll 同 seed 同结果（否则断言无法稳定）',
      G.invasionRoll('abc') === G.invasionRoll('abc')
      && G.invasionRoll('abc') !== G.invasionRoll('abd'));
    check('invasionRoll 落在 [0,1)', (function () {
      for (var i = 0; i < 200; i++) { var v = G.invasionRoll('k' + i); if (v < 0 || v >= 1) return false; }
      return true;
    })());

    /* ---- 资源名出口（曾因 DATA.RESOURCES 是数组而 TypeError）---- */
    check('GAME.resName 按 key 取中文名（DATA.RESOURCES 是数组不是字典）',
      G.resName('grain') === '粮食' && G.resName('gold') === '黄金' && G.resName('nope') === 'nope');

    G.state = stBackup;
  })();

"""


def main():
    if not os.path.exists(P):
        print('✗ 找不到', P)
        return 2
    src = io.open(P, encoding='utf-8', newline='').read()

    if '第 53 节：定期来袭' in src:
        print('·  已追加过，跳过')
    else:
        n = src.count(ANCHOR)
        if n != 1:
            print('✗ 锚点出现 %d 次（要求 1 次）—— 未写盘' % n)
            return 1
        after = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        io.open(P, 'w', encoding='utf-8', newline='').write(after)
        back = io.open(P, encoding='utf-8', newline='').read()
        print('✅ 已追加第 53 节 %d → %d 字符（%+d）' % (len(src), len(after), len(after) - len(src)))
        print('   落盘核验：%s  CRLF=%d' % ('一致' if back == after else '不一致', back.count('\r\n')))
        if back != after:
            return 1

    fin = io.open(P, encoding='utf-8', newline='').read()
    print('本节 check 条数：%d' % fin.split('第 53 节：定期来袭')[1].split('console.log')[0].count('check('))
    return 0


if __name__ == '__main__':
    sys.exit(main())

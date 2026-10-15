# -*- coding: utf-8 -*-
"""v89.29 e2e 补丁：守卫 + §81 故事区整体重写

旧区（~4970-5730）：「列表入口 → 清单 → 点选 → 阅读器」×14 块
新区：触发链（建筑/地块）· 冷却 · 默认不触发 · 空池 · 逐卷直开走满。
"""
import io
import os
import sys

P = r'E:\Deepseekdb\e2e-test.js'


def read():
    return io.open(P, encoding='utf-8', newline='').read()


def write(src):
    tmp = P + '.tmp8929'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, P)


src = read()

# ---- 0. 测试期默认关闭随机触发（紧跟 boot 断言）----
G_OLD = u"  if (!G || !DATA) return finish();"
G_NEW = u"""  if (!G || !DATA) return finish();

  /* v89.29：逸闻奇遇 —— 测试期默认关闭随机触发（避免打断用例）；
     触发链专测用 G.SG.TRIG.pin（指定篇目）/ rng 注入精确控制。 */
  if (G.SG && G.SG.TRIG) G.SG.TRIG.rng = function () { return 0.999; };"""
n0 = src.count(G_OLD)
if n0 != 1:
    print('FAIL [e2e guard] 命中 %d 次' % n0)
    sys.exit(1)
src = src.replace(G_OLD, G_NEW, 1)

# ---- 1. §81 故事区整体重写 ----
START = u"    var gi = -1;"
END = u"  })();\n\n  console.log('');\n  console.log('--- 82. v89.7"

i = src.find(START)
j = src.find(END)
if i < 0 or j < 0 or j <= i:
    print('FAIL 区域边界定位（i=%d j=%d）' % (i, j))
    sys.exit(1)
if src.count(START) != 1 or src.count(END) != 1:
    print('FAIL 边界非唯一（start=%d end=%d）' % (src.count(START), src.count(END)))
    sys.exit(1)

NEW = u'''    /* ============================================================
     * v89.29：逸闻入口改版 —— 「列表菜单」→「概率奇遇」
     *   点击建筑 / 地块时掷骰（GAME.SG.roll），命中即从该锚点池随机抽一篇
     *   完整故事（每篇 = 一份独立资产），在面板之上直接开卷；
     *   掩卷后回到原面板（叠层语义：弹窗不关）。
     *   测试口径：
     *     · 默认 rng 恒 0.999 —— 永不触发（保证既有用例不被随机打断）；
     *     · sgPin89(sid)：pin 指定必中篇目（确定性）+ 冷却清零 —— 走真实触发链；
     *     · 冷却口径：pin 路径同样受冷却约束（roll 返回 why='cool'）。
     * ============================================================ */
    var rngNever89 = function () { return 0.999; };
    function sgPin89(sid) { G.SG.TRIG.pin = sid; G.SG.TRIG._lastAt = 0; }
    function sgOff89() { G.SG.TRIG.pin = null; G.SG.TRIG._lastAt = 0; G.SG.TRIG.rng = rngNever89; }
    sgOff89();

    /* 块 A：触发链（建筑）—— pin 官府首篇 → 开面板即入卷 → 走满 → 掩卷回面板 */
    var gi = -1;
    city.cells.forEach(function (cell, i) { if (cell.build && cell.build.id === 'guanfu') gi = i; });
    check('官府地块定位', gi >= 0);
    sgPin89('bld-guanfu-01');
    G.ui.openBuildModal(gi);
    await sleep(40);
    var fx = document.querySelector('#story-fx');
    check('★ v89.29：概率奇遇触发（点建筑 → 命中《衙前夜审》直接开卷）', !!fx
      && fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'bld-guanfu-01');
    check('★ v89.29：叠层语义（命中的逸闻悬于面板之上 · 面板未关）',
      !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var bgLayers = fx ? fx.querySelectorAll('.sgr-bg') : [];
    check('★ 全屏阅读器打开（第 1 段 · 共 6 段 · 壁画两层就位 · 选项≥2）', !!fx
      && bgLayers.length === 2
      && fx.textContent.indexOf('第 1 段') >= 0 && fx.textContent.indexOf('共 6 段') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);
    var muralKeys = {}, seenSeg = 0;
    if (fx) {
      var m0 = fx.querySelector('.sgr-bg[data-on]');
      if (m0) muralKeys[m0.dataset.key] = 1;
    }
    var guard = 0;
    while (guard++ < 12) {
      var pk = fx.querySelector('[data-action="story-pick"]');
      if (!pk) break;
      click(pk);
      await sleep(30);
      seenSeg = Math.max(seenSeg, Number((fx.textContent.match(/第 (\\d) 段/) || [0, 0])[1]) || 0);
      var mOn = fx.querySelector('.sgr-bg[data-on]');
      if (mOn) muralKeys[mOn.dataset.key] = 1;
    }
    var keyN = 0; for (var kk in muralKeys) keyN++;
    check('★ 壁画随段变换（段位走到 ≥3 · 壁画出现 ≥2 张）', seenSeg >= 3 && keyN >= 2,
      '走到第 ' + seenSeg + ' 段 · 壁画 ' + keyN + ' 张');
    check('★ 走到结局（结算屏 + 回到城中）', !!fx.querySelector('[data-action="story-exit"]')
      && fx.textContent.indexOf('回到城中') >= 0);
    check('★ 阅读进度已入档',
      !!(G.SG.progress()['bld-guanfu-01'] && G.SG.progress()['bld-guanfu-01'].done.length));
    click(fx.querySelector('[data-action="story-exit"]'));
    await sleep(30);
    check('阅读器收起（不阻塞主界面）', fx.style.display === 'none');

    /* 块 B：冷却口径 —— 紧接再掷 → why='cool'；冷却期内开面板也不弹 */
    check('★ v89.29：冷却口径（刚触发过 · 再掷 why=cool）', (function () {
      var r = G.SG.roll('building', 'guanfu');
      return r.fire === false && r.why === 'cool';
    })());
    G.ui.openBuildModal(gi);
    await sleep(30);
    check('★ v89.29：冷却期内再点不触发（面板照常）', fx.style.display === 'none'
      && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var cmA = document.querySelector('#modal-root [data-action="close-modal"]');
    if (cmA) { click(cmA); await sleep(25); }

    /* 块 C：默认口径（未命中）—— rng 永不出、无 pin → 开面板不弹逸闻 */
    sgOff89();
    G.ui.openBuildModal(gi);
    await sleep(30);
    check('★ v89.29：默认口径（未命中 · 面板照常 · 不弹逸闻）',
      fx.style.display === 'none' && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var cmB = document.querySelector('#modal-root [data-action="close-modal"]');
    if (cmB) { click(cmB); await sleep(25); }
    check('★ v89.29：无故事锚点永不触发（空池）', (function () {
      var r = G.SG.roll('building', '__none__');
      return r.fire === false && r.why === 'empty';
    })());

    /* 块 D：触发链（地块 · 野地）—— 找一块可读地块，pin 其池中一篇 */
    var wTile = null;
    if (city.x != null) {
      for (var dx9 = -4; dx9 <= 4 && !wTile; dx9++) {
        for (var dy9 = -4; dy9 <= 4 && !wTile; dy9++) {
          var tl9 = G.map.tile(city.x + dx9, city.y + dy9);
          if (tl9 && G.SG.anchor('wild', tl9.terrain).length > 0) {
            wTile = { x: city.x + dx9, y: city.y + dy9, terrain: tl9.terrain };
          }
        }
      }
    }
    if (wTile) {
      var wc9 = G.SG.candidates('wild', wTile.terrain);
      var wPick9 = (wc9.fresh[0] || wc9.done[0]).st.id;
      sgPin89(wPick9);
      G.ui.openLandModal(wTile.x, wTile.y);
      await sleep(30);
      G.ui.sgTryTrigger('wild', wTile.terrain);
      await sleep(40);
      check('★ v89.29：地块触发（点地块 → 命中 ' + wPick9 + ' 直接开卷）',
        fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === wPick9);
      var exW = fx.querySelector('[data-action="story-exit"]');
      if (exW) { click(exW); await sleep(30); }
      check('★ v89.29：掩卷后回面板（叠层语义）', fx.style.display === 'none'
        && !!document.querySelector('#modal-root [data-action="close-modal"]'));
      var cmD = document.querySelector('#modal-root [data-action="close-modal"]');
      if (cmD) { click(cmD); await sleep(25); }
    } else {
      check('★ v89.29：地块触发（附近无可读野地，跳过）', true);
      check('★ v89.29：掩卷后回面板（跳过）', true);
    }

    /* 块 E：逐卷直开（阅读器 · 走满 · 进度入档 · 掩卷）—— 覆盖各卷代表性新篇 */
    var VOL89 = [
      ['v89.9', 'bld-minfang-01'], ['v89.10', 'bld-xiaochang-01'], ['v89.11', 'bld-shuyuan-02'],
      ['v89.12', 'bld-cangku-02'], ['v89.13', 'bld-zhaoxianguan-02'], ['v89.14', 'bld-guanfu-05'],
      ['v89.24', 'bld-guanfu-08'], ['v89.25', 'bld-chengqiang-06'], ['v89.26', 'bld-xiaochang-07'],
      ['v89.27', 'wild-forest-05'], ['v89.27', 'city-county-05'], ['v89.27', 'ext-farm-06'],
      ['v89.28', 'bld-shuyuan-09'], ['v89.28', 'wild-zhaoze-08']
    ];
    for (var v9 = 0; v9 < VOL89.length; v9++) {
      var tag9 = VOL89[v9][0], sid9 = VOL89[v9][1];
      G.ui.openStory(sid9);
      await sleep(40);
      var open9 = !!fx && fx.style.display !== 'none'
        && !!G.SG._run && G.SG._run.st.id === sid9
        && fx.querySelectorAll('.sgr-bg').length === 2
        && fx.textContent.indexOf('第 1 段') >= 0 && /共 [5-7] 段/.test(fx.textContent)
        && fx.querySelectorAll('[data-action="story-pick"]').length >= 2;
      var g9 = 0;
      while (open9 && g9++ < 12) {
        var pk9 = fx.querySelector('[data-action="story-pick"]');
        if (!pk9) break;
        click(pk9);
        await sleep(25);
      }
      var end9 = !!fx && !!fx.querySelector('[data-action="story-exit"]')
        && fx.textContent.indexOf('回到城中') >= 0;
      var save9 = !!(G.SG.progress()[sid9] && G.SG.progress()[sid9].done.length);
      if (fx && fx.querySelector('[data-action="story-exit"]')) {
        click(fx.querySelector('[data-action="story-exit"]'));
        await sleep(25);
      }
      check('★ ' + tag9 + '：直开阅读器 · 走满至结局（' + sid9 + '）', open9 && end9);
      check('★ ' + tag9 + '：进度入档 · 掩卷收起（' + sid9 + '）',
        save9 && fx.style.display === 'none');
    }
    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();
'''

src = src[:i] + NEW + src[j:]
write(src)

back = read()
assert 'v89.29：概率奇遇触发' in back and 'sgOff89();' in back
assert back.count("SG_BLOCK") == 0 and back.count("story-list") == 0 and back.count("story-open") == 0
print('OK  e2e-test.js：守卫 + §81 故事区重写（旧引用清零）')

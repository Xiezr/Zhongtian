# -*- coding: utf-8 -*-
"""v89.86 · e2e 存量失败修复（全部由 v89.4x~v89.85 未提交改动引入，与整改 21 条无关）
   A. 江湖游历 v89.45 起默认剥离（GAME.jianghuWildMounted=false）—— 五个测试块
      测的是该层本身：显式临时挂载 + 跑完还原（与 smoke §v89.45 同一手法）。
   B. v89.49 提速面板改版（「募兵加速」字样退役）—— 断言同步为「提速」。
   C. v89.47 天下大势：jsdom 无布局引擎（rect 全 0），三条"量尺寸"断言在此永远红 ——
      改为判"满界面档位 + fitMini 侧长 + 分辨率对齐"（真机像素复核走几何探针）；
      点选跳转注入 rect 桩（其余用例同法）。
"""
import io
import os
import sys

E2 = r'E:\Deepseekdb\e2e-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ============ A. 19b/19c 块：挂载江湖层 ============
edit(E2, r"""  console.log('\n--- 19b. v89.5 灵机之地（地图悬旗） ---');
  check('v89.5：渲染接线含青旗（render 调 drawJhPennant）', /drawJhPennant\(/.test(G.map.render.toString()));""",
     r"""  console.log('\n--- 19b. v89.5 灵机之地（地图悬旗） ---');
  /* v89.86（测试修复）：v89.45 起野地江湖游历默认剥离（GAME.jianghuWildMounted=false）；
     19b/19c 两段测的是**该层本身** —— 显式临时挂载，跑完还原（与 smoke §v89.45 同一手法）。 */
  const jhWasA = G.jianghuWildMounted;
  G.jianghuWildMounted = true;
  check('v89.5：渲染接线含青旗（render 调 drawJhPennant）', /drawJhPennant\(/.test(G.map.render.toString()));""",
     'e2e · 19b 挂载江湖层')

edit(E2, r"""  G.ui.closeModal();

  console.log('\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');""",
     r"""  G.ui.closeModal();
  G.jianghuWildMounted = jhWasA;   /* v89.86：还原剥离状态 */

  console.log('\n--- 20. 资质分级 / 铁匠铺打造 / 死属性修复 ---');""",
     'e2e · 19c 还原剥离状态')

# ============ A. v88.1 / v88 / v89 三连块 ============
edit(E2, r"""  console.log('\n--- v88.1. 场景整合（真实 DOM） ---');
  {
    let hp = null;""",
     r"""  console.log('\n--- v88.1. 场景整合（真实 DOM） ---');
  /* v89.86（测试修复）：v88.1 / v88 / v89 三块测的是江湖游历与全屏剧本本身 ——
     显式临时挂载 jianghuWildMounted（v89.45 起默认剥离），跑完还原。 */
  const jhWasB = G.jianghuWildMounted;
  G.jianghuWildMounted = true;
  {
    let hp = null;""",
     'e2e · v88.1 挂载江湖层')

edit(E2, r"""      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', false);
    }
  }

  console.log('');
  console.log('--- 81. 文字游戏 · 故事库（真实点击 · v2 结构） ---');""",
     r"""      check('v89.4：有事格 —— 按钮数=分布数（1~3）· 等级收益行在', false);
    }
  }
  G.jianghuWildMounted = jhWasB;   /* v89.86：还原剥离状态 */

  console.log('');
  console.log('--- 81. 文字游戏 · 故事库（真实点击 · v2 结构） ---');""",
     'e2e · v88/v89 块还原剥离状态')

# ============ B. 提速面板文案 ============
edit(E2, r"""    check('点加速弹出宝物选择（含剩余时间）',
      pb28.textContent.indexOf('募兵加速') >= 0 && pb28.textContent.indexOf('剩余') >= 0);""",
     r"""    /* v89.49 改版为「⚡ 提速」面板；v89.86 同步断言（原「募兵加速」字样已退役） */
    check('点加速弹出宝物选择（含剩余时间）',
      pb28.textContent.indexOf('提速') >= 0 && pb28.textContent.indexOf('剩余') >= 0);""",
     'e2e · 提速面板文案')

# ============ C. v89.47 天下大势（jsdom 结构口径） ============
edit(E2, r"""    check('v89.47：面板铺满视口（modal-max · 宽高 ≈ 视口 − 16）', (function () {
      if (!panel || !big) return false;
      const r = panel.getBoundingClientRect();
      return r.width >= window.innerWidth - 24 && r.height >= window.innerHeight - 24;
    })(), panel ? JSON.stringify(panel.getBoundingClientRect()) : 'no panel');
    check('v89.47：缩略图画布显著放大（方且边长 ≥ 视口高 − 200）', (function () {
      if (!big) return false;
      const r = big.getBoundingClientRect();
      return r.width > 620 && Math.abs(r.width - r.height) <= 2;
    })(), big ? JSON.stringify(big.getBoundingClientRect()) : 'no canvas');
    check('v89.47：画布内部分辨率 1:1 跟随显示尺寸（非固定 1000）', (function () {
      if (!big) return false;
      const r = big.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      return Math.abs(big.width - Math.round(r.width * dpr)) <= 2;
    })(), big ? (big.width + ' vs css ' + big.getBoundingClientRect().width) : '');""",
     r"""    /* ⚠️ v89.86：jsdom 没有布局引擎（rect 全 0），原先三条"量尺寸"断言在此**永远红** ——
       改为判"满界面档位 + 画布内部边长 = fitMini 侧长 + 分辨率按 css 宽 × dpr 对齐"
       （任何一处写死 1000 / 不随视口放大都会红）；真机像素级复核走几何探针。 */
    check('v89.47：面板挂「满界面」档（modal-max）', (function () {
      if (!panel || !big) return false;
      return panel.classList.contains('modal-max');
    })(), panel ? panel.className : 'no panel');
    check('v89.47：缩略图画布按视口放大（内部边长 = fitMini 侧长 · 方）', (function () {
      if (!big) return false;
      const side = G.ui.fitMini();
      return big.width === side && big.height === side && big.width >= 400;
    })(), big ? ('side=' + big.width) : 'no canvas');
    check('v89.47：画布内部分辨率 1:1 跟随显示尺寸（非固定 1000）', (function () {
      if (!big) return false;
      const cssW = parseFloat(big.style.width) || 0;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      return cssW > 0 && Math.abs(big.width - Math.round(cssW * dpr)) <= 2 && big.width !== 1000;
    })(), big ? (big.width + ' vs css ' + (big.style ? big.style.width : '')) : '');""",
     'e2e · v89.47 三断言结构口径')

edit(E2, r"""    /* 真点一次：画布中心 → 世界中心格 (250,250) */
    const br = big.getBoundingClientRect();
    big.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      clientX: br.left + br.width / 2, clientY: br.top + br.height / 2
    }));""",
     r"""    /* 真点一次：画布中心 → 世界中心格 (250,250)
       v89.86：jsdom rect 全 0 会让 miniPick 直接返回 null —— 注入 rect 桩再点（其余用例同法）。 */
    const oldRectB = big.getBoundingClientRect;
    big.getBoundingClientRect = () => ({ left: 0, top: 0, width: big.width, height: big.height });
    const br = big.getBoundingClientRect();
    big.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true, cancelable: true, view: window,
      clientX: br.left + br.width / 2, clientY: br.top + br.height / 2
    }));
    big.getBoundingClientRect = oldRectB;""",
     'e2e · v89.47 点选注入 rect 桩')

print('DONE')

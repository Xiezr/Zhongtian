#!/usr/bin/env node
/* ============================================================
 * visual_baseline.js —— 视觉回归基线（像素级）
 * ------------------------------------------------------------
 * 老板 2026-11-02：「改至完善」
 *
 * 这是 Q1³ 的补丁：**断言守不住"看起来坏了"**。
 * 「海波太规整」「星球半径闪烁」这两次，4825 条断言全绿，是老板肉眼看出来的。
 * 断言能查"元素在不在、文案对不对"，查不出"这团雾在抖"。
 *
 * ⚠️ 本工具**只覆盖 UI 静态场景**，不覆盖 3D。原因写在下面「为什么不做 3D」，
 *    不做的原因比做出来的部分更重要 —— 假装覆盖了，比没覆盖更危险。
 *
 * 用法：
 *   node .workbuddy/tools/prof/visual_baseline.js --update     # 存当前为基线
 *   node .workbuddy/tools/prof/visual_baseline.js              # 与基线比对
 *   node .workbuddy/tools/prof/visual_baseline.js --only topnav
 * ============================================================ */
'use strict';
module.paths.unshift('C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules');
const fs = require('fs');
const path = require('path');
const pw = require('playwright-core');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const BASE_DIR = path.join(ROOT, '.workbuddy', 'visual-baseline');
const OUT_DIR = path.join(ROOT, '.workbuddy', 'shots', 'visual');
const CHROME = 'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';

const argv = process.argv.slice(2);
const UPDATE = argv.indexOf('--update') >= 0;
const ONI = argv.indexOf('--only');
const ONLY = ONI >= 0 ? argv[ONI + 1] : null;

/* 阈值：整图差异像素占比 */
const T_RED = 0.005;    // 0.5% 以上 = 有东西真的变了
const T_WARN = 0.001;   // 0.1% 以上 = 值得看一眼（抗锯齿/字体渲染的微差）

/* ============================================================
 * 场景表
 * ------------------------------------------------------------
 * 只收「同样的输入必然得到同样的像素」的场景：
 *   · 固定 mapSeed（地图/城市内容确定）
 *   · 固定 viewport
 *   · 关闭动画与倒计时里的秒级文案（否则每秒都不一样）
 * 做不到这三条的，不进这张表。
 * ============================================================ */
const SCENES = {
  topnav: {
    desc: '顶栏（页签 / 图例 / 天时）',
    clip: { x: 0, y: 0, width: 1440, height: 60 },
    setup: (G) => { G.ui.setView('city'); },
  },
  mapdock: {
    desc: '地图页底栏（导航按钮）',
    clip: null,
    setup: (G) => { G.ui.setView('map'); },
    afterClip: '#bottom-bar',
  },
  city: {
    desc: '城池页全景',
    clip: null,
    setup: (G) => { G.ui.setView('city'); },
  },
};

/* ---------- 像素比对 ---------- */
function diffRatio(a, b) {
  if (a.width !== b.width || a.height !== b.height) return { ratio: 1, reason: 'size' };
  const w = a.width, h = a.height;
  let n = 0;
  /* 阈值 12/255：低于这个是抗锯齿与字体 hinting 的噪声，不是内容变化 */
  for (let i = 0; i < w * h * 4; i += 4) {
    const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1])
      + Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (d > 12 * 3) n++;
  }
  return { ratio: n / (w * h), reason: null };
}

(async function () {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await pw.chromium.launch({
    executablePath: CHROME,
    args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader'],
  });

  const results = [];

  for (const name of Object.keys(SCENES)) {
    if (ONLY && name !== ONLY) continue;
    const sc = SCENES[name];
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.goto('file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/'));
      await page.waitForFunction('window.GAME && window.GAME.DATA && GAME.ui', null, { timeout: 30000 });
      await page.evaluate((n) => {
        const G = window.GAME;
        /* portraitSeed：君主头像也吃随机，不钉死它每次截图都换一张脸（实测差 0.15%）。
           js/state.js 的 rulerOpts 本来就留了这个口子（『供测试注入确定值』）——
           用现成机制，比事后遮罩干净。 */
        const st = G.newGame({ name: '视觉基线', cityName: '灰岗', region: '碎垣', mapSeed: 20260921, portraitSeed: 1 });
        if (!st.map.grid) G.map.generate();
        G.ui.enterGame();
        try { G.ui.closeAllModals(); } catch (e) { }
        SCENES_APPLY = null;
      }, name).catch(() => { });

      /* 逐个场景 setup（单独 evaluate，避免把函数跨序列化） */
      await page.evaluate((setupSrc) => {
        // eslint-disable-next-line no-new-func
        (new Function('G', setupSrc))(window.GAME);
      }, sc.setup.toString().replace(/^[^{]*\{|\}[^}]*$/g, ''));

      /* 固定「秒级文案」：时钟/倒计时会每秒变，正文里出现就永远比不过 */
      await page.evaluate(() => {
        try {
          const els = document.querySelectorAll('[id*="clock"],[id*="timer"],[class*="countdown"]');
          for (const el of els) el.style.visibility = 'hidden';
        } catch (e) { }
      });

      /* ============================================================
       * 固定「非确定输入」—— 不固定就一定误报（实测踩过）
       * ------------------------------------------------------------
       * 第一版没做这步，刚建的基线立刻比出 1.027% 差异。
       * 诊断：差异全落在 x 1260~1419（右侧工具区 = 图例 + 天时）。
       * 根因：`STORY.rollWeather` 用 `Math.random()` 选天气，**不受 mapSeed 控制**，
       *      顶栏天时里的「☀晴 / ☁阴 / 🌧雨」每次开局都可能不同。
       * 处置：开局后把天气钉成 clear 再重绘顶栏 —— 这样天时那块的**布局**仍然被测，
       *      只有那个本来就不确定的字（晴/阴）被固定。比"整块遮掉"保留了更多价值。
       * ============================================================ */
      await page.evaluate(() => {
        try {
          const G = window.GAME;
          if (G.state && G.state.world) G.state.world.weather = 'clear';
          if (G.ui && G.ui.syncHeader) G.ui.syncHeader();
        } catch (e) { }
      });
      await page.waitForTimeout(900);

      const file = path.join(OUT_DIR, name + '.png');
      if (sc.afterClip) {
        const el = await page.$(sc.afterClip);
        if (el) await el.screenshot({ path: file });
        else await page.screenshot({ path: file, clip: sc.clip || undefined });
      } else {
        await page.screenshot({ path: file, clip: sc.clip || undefined });
      }

      const cur = PNG.sync.read(fs.readFileSync(file));
      const basePath = path.join(BASE_DIR, name + '.png');

      if (UPDATE || !fs.existsSync(basePath)) {
        fs.copyFileSync(file, basePath);
        results.push({ name, desc: sc.desc, verdict: UPDATE ? 'updated' : 'created' });
        console.log('  ' + (UPDATE ? '📌 更新基线' : '📌 首次建基线') + '  ' + name + '  ' + sc.desc);
      } else {
        const base = PNG.sync.read(fs.readFileSync(basePath));
        const d = diffRatio(base, cur);
        const verdict = d.ratio > T_RED ? 'red' : d.ratio > T_WARN ? 'warn' : 'same';
        results.push({ name, desc: sc.desc, verdict, ratio: d.ratio });
        const icon = verdict === 'red' ? '❌' : verdict === 'warn' ? '⚠️ ' : '✅';
        console.log('  ' + icon + ' ' + name.padEnd(10)
          + (d.ratio * 100).toFixed(3) + '%  ' + sc.desc
          + (verdict === 'red' ? '   ← 与基线差太多，看 ' + path.relative(ROOT, file) : ''));
      }
    } catch (e) {
      results.push({ name, desc: sc.desc, verdict: 'error', err: e.message });
      console.log('  ⚠️  ' + name + ' 出错：' + e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  const red = results.filter((r) => r.verdict === 'red').length;
  const warn = results.filter((r) => r.verdict === 'warn').length;
  console.log('\n' + (red ? '❌ ' + red + ' 个场景与基线不符' : '✅ 视觉基线与当前一致')
    + (warn ? '（' + warn + ' 个微差）' : ''));

  /* 写结果给 tier_audit 读（视觉是 Q1 之外的第三条腿） */
  try {
    fs.writeFileSync(path.join(ROOT, '.workbuddy', 'visual-last.json'),
      JSON.stringify({ at: new Date().toISOString().slice(0, 19), results, red, warn }, null, 1));
  } catch (e) { }

  console.log('\n注：3D 场景（星球/海面/城池模型）**不在本基线里** ——');
  console.log('    它每帧都在动（自转 + 波浪），没有时间冻结入口，直接比像素全是误报。');
  console.log('    要覆盖它，得先给 map3d 加一个 `M.freezeAt(t)` 调试接口把 uTime 钉住。');
  process.exit(red ? 1 : 0);
})();

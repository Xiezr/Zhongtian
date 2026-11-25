/* v158.18 新手视角全功能走查（老板「假设你对游戏任何设置均未知，新手玩游戏，
 * 探索所有功能，任何卡点都需要解决」）
 * ------------------------------------------------------------
 * 纪律：① 不预设任何设定知识 —— 只记录"我作为一个刚打开游戏的人看到什么、
 *          能做什么、哪里卡住"；② 走**真实 UI 流程**（清档→创角→点按钮），
 *          不调 GAME.newGame() 跳过界面；③ 只读取证，本脚本不改产品代码。
 * 判据一律用数值/DOM 结构，截图只作人眼复核（headless rAF 节流，截图前等真帧）。
 */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/pnewbie';
const EXE = process.env.AUDIT_CHROME ||
  'C:/Users/18811/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe';
const FILE = 'file:///E:/Deepseekdb/index.html';
let pass = 0, fail = 0;
const CARDS = [];            /* 卡点记录 */
function ok(t, c, d) {
  c ? pass++ : fail++;
  console.log('  ' + (c ? 'OK  ' : 'FAIL') + ' ' + t + (d ? '   [' + d + ']' : ''));
}
function note(t, d) { console.log('  ——  ' + t + (d ? '   [' + d + ']' : '')); }
function card(id, kind, where, what, expect) {
  CARDS.push({ id, kind, where, what, expect });
  console.log('  🚧 CARD ' + id + ' [' + kind + '] ' + where + ' → ' + what + (expect ? '  (应为: ' + expect + ')' : ''));
}

/* —— dump 一屏：可见文字（去重复）、按钮、输入框 —— */
const DUMP_SCREEN = () => {
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const txt = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (!vis(el)) return;
    if (el.children.length) return;               /* 只取叶子节点的字 */
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 200) txt.push(t);
  });
  const uniq = [...new Set(txt)];
  const btns = [];
  document.querySelectorAll('button, [data-action], a').forEach((el) => {
    if (!vis(el)) return;
    btns.push({
      tag: el.tagName.toLowerCase(),
      action: el.getAttribute('data-action') || '',
      id: el.id || '',
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      disabled: !!el.disabled,
      title: el.getAttribute('title') || ''
    });
  });
  const inputs = [];
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!vis(el)) return;
    inputs.push({ tag: el.tagName.toLowerCase(), id: el.id || '', type: el.type || '',
      ph: el.placeholder || '', val: String(el.value || '').slice(0, 20) });
  });
  const screens = [];
  document.querySelectorAll('[id^="screen-"], .create-screen, .modal-mask, #top-bar, #bottom-bar, #follow-hud, #street-hud')
    .forEach((el) => { if (vis(el)) screens.push(el.id || el.className); });
  return { text: uniq, buttons: btns, inputs, screens };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--allow-file-access-from-files'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 120)); });

  /* ══════ 阶段 0：清档 = 真新手的第一次启动 ══════ */
  await p.goto(FILE);
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.evaluate(() => {
    try { localStorage.clear(); } catch (e) { }
    try { if (window.indexedDB && indexedDB.databases) indexedDB.databases().then((l) => l.forEach((x) => { try { indexedDB.deleteDatabase(x.name); } catch (e) { } })); } catch (e) { }
  });
  await p.reload();
  await p.waitForFunction('window.GAME && window.GAME.ui', null, { timeout: 30000 });
  await p.waitForTimeout(1500);

  const s0 = await p.evaluate(DUMP_SCREEN);
  await p.screenshot({ path: OUT + '/00_first_screen.png', fullPage: true });
  note('第一屏（无档启动）', 'screens=' + JSON.stringify(s0.screens) + ' 按钮数=' + s0.buttons.length);
  note('第一屏文案', JSON.stringify(s0.text.slice(0, 22)));
  note('第一屏按钮', JSON.stringify(s0.buttons.map((x) => (x.text || x.id) + (x.action ? '@' + x.action : ''))));
  note('第一屏输入', JSON.stringify(s0.inputs));

  /* 新手看到的第一件事：这是个什么游戏？标题给了吗？ */
  const title = await p.evaluate(() => (document.title || '') + ' | ' + ((document.querySelector('#screen-create .gold-heading') || {}).textContent || '').trim());
  note('游戏标题/开场语', title);
  ok('第一屏有明确的游戏名（新手知道这是什么）', /废土|城|纪元/.test(title), title);

  /* 创角屏关键元素 */
  const create = await p.evaluate(() => {
    const g = (s) => document.querySelector(s);
    const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      screenVisible: vis(g('#screen-create')),
      hasName: vis(g('#create-name')),
      hasStart: vis(g('#create-start')),
      startText: (g('#create-start') || {}).textContent || '',
      regionChips: [...document.querySelectorAll('#create-region')].length,
      chipLabels: [...document.querySelectorAll('.chip[data-target="create-region"]')].map((c) => c.textContent.trim()),
      hasContinue: vis(g('#create-continue')),
      saveNote: (g('#create-save-note') || {}).textContent || '',
      mapPreview: (g('#create-map-preview') || {}).textContent || ''
    };
  });
  note('创角屏', JSON.stringify(create));
  ok('创角屏可见且有「开始」按钮', create.screenVisible && create.hasStart, JSON.stringify({ v: create.screenVisible, s: create.startText }));
  ok('创角屏有姓名输入', create.hasName === true, JSON.stringify(create));
  ok('十三区归属可点选', create.chipLabels.length >= 12, 'chips=' + create.chipLabels.length);

  /* ══════ 阶段 1：新手空名字直接点开始（校验/反馈） ══════ */
  await p.click('#create-start');
  await p.waitForTimeout(900);
  const afterEmpty = await p.evaluate(() => {
    const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      stillCreate: vis(document.querySelector('#screen-create')),
      toasts: [...document.querySelectorAll('.toast, #toast-root *')].map((t) => t.textContent.trim()).slice(0, 3),
      bodyHasErr: /名字|不能为空|请填|请输入/.test(document.body.textContent || '')
    };
  });
  note('空名字点「开始」后', JSON.stringify(afterEmpty));
  if (!afterEmpty.stillCreate) {
    card('N1', '真bug/缺校验', '创角屏·空名', '名字留空点「开始」竟直接进了游戏（或无任何提示）', '应提示"请先起名"并留在创角');
  } else if (!afterEmpty.toasts.length && !afterEmpty.bodyHasErr) {
    card('N2', '反馈缺失', '创角屏·空名', '空名点开始没有任何提示（新手不知道为什么没反应）', '有 toast 或输入框红框提示');
  }
  await p.screenshot({ path: OUT + '/01_empty_name.png' });

  /* ══════ 阶段 2：填名字、点开始，进游戏 ══════ */
  await p.fill('#create-name', '阿辰');
  await p.click('#create-start');
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(700);
    const loading = await p.evaluate(() => /正在进入星球|正在构建星球|正在生成/.test(document.body.textContent || ''));
    if (!loading) break;
  }
  await p.waitForTimeout(3000);
  const s1 = await p.evaluate(DUMP_SCREEN);
  await p.screenshot({ path: OUT + '/10_ingame_first.png', fullPage: true });
  note('进游戏后第一眼', 'screens=' + JSON.stringify(s1.screens));
  note('主界面文案', JSON.stringify(s1.text.slice(0, 30)));
  note('主界面按钮', JSON.stringify(s1.buttons.map((x) => (x.text || x.id) + (x.action ? '@' + x.action : ''))));

  /* 新手开局状态：有没有城、资源、引导 */
  const start = await p.evaluate(() => {
    const G = GAME;
    const c = G.state && G.state.cities ? G.state.cities : [];
    const res = G.state && G.state.res ? Object.assign({}, G.state.res) : {};
    const q = (G.questline && G.questline.summary) ? G.questline.summary() : null;
    const hint = (G.questline && G.questline.hint) ? G.questline.hint() : '';
    /* 顶栏/底栏可见性 */
    const vis = (el) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && r.width > 0; };
    return {
      version: G.VERSION, year: (G.state || {}).year,
      skyText: (function () { var el = document.getElementById('nav-sky'); return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; })(),
      cityCount: c.length,
      cityNames: c.map((x) => x.name),
      res, quest: q, questHint: hint,
      topVisible: vis(document.getElementById('top-bar')),
      bottomVisible: vis(document.getElementById('bottom-bar')),
      followHud: vis(document.getElementById('follow-hud')),
      bodyLen: (document.body.textContent || '').length
    };
  });
  note('开局状态', JSON.stringify(start));
  ok('开局后能看到自己的城（标题说「有座城」）', start.cityCount >= 1, 'city=' + JSON.stringify(start.cityNames));
  ok('开局后能看到年份/时间', !!(start.skyText && /\d+年/.test(start.skyText)), 'sky=' + start.skyText);

  /* ══════ 阶段 3：新手引导在哪 ══════ */
  const guide = await p.evaluate(() => {
    const G = GAME;
    const out = { hintInDom: null, hintShown: false, questPanel: false, anyGuideText: false };
    /* Q.hint 的字有没有出现在可见 DOM 里 */
    const hint = (G.questline && G.questline.hint) ? G.questline.hint() : '';
    out.hintInDom = hint;
    if (hint) {
      const body = document.body.textContent || '';
      out.hintShown = body.indexOf(hint.replace(/^\S+\s/, '')) >= 0 || body.indexOf('任务链') >= 0;
    }
    const b = document.body.textContent || '';
    out.questPanel = /大世界引导|任务链|迈出第一步/.test(b);
    out.anyGuideText = /下一步|引导|教程|新手|点击|按 |WASD|试试/.test(b);
    /* 有没有常驻的"当前该做什么"提示条 */
    const bars = ['follow-hud', 'street-hud', 'top-bar', 'bottom-bar'];
    out.barText = {};
    bars.forEach((id) => { const el = document.getElementById(id); out.barText[id] = el && el.offsetParent !== null ? (el.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : '(不可见)'; });
    return out;
  });
  note('新手引导', JSON.stringify(guide));
  ok('开局能看到"我现在该做什么"的引导', guide.questPanel || guide.hintShown || guide.anyGuideText,
    'panel=' + guide.questPanel + ' hintShown=' + guide.hintShown + ' any=' + guide.anyGuideText);

  /* ══════ 阶段 4：把主界面所有入口点一遍（找卡点） ══════ */
  const mainBtns = await p.evaluate(() => {
    const vis = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0; };
    return [...document.querySelectorAll('[data-action]')].filter(vis).map((el) => ({
      action: el.getAttribute('data-action'), text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
    }));
  });
  note('主界面可点入口 ' + mainBtns.length + ' 个', JSON.stringify(mainBtns.map((x) => x.action + '(' + x.text + ')')));

  const openable = [];
  for (const btn of mainBtns) {
    if (!btn.action) continue;
    if (/close|cancel|exit|back|demo|save-game|new-game|load|drop|create/.test(btn.action)) continue;
    const r = await p.evaluate((a) => {
      const el = [...document.querySelectorAll('[data-action="' + a + '"]')].find((x) => {
        const s = getComputedStyle(x), r = x.getBoundingClientRect();
        return s.display !== 'none' && r.width > 0;
      });
      if (!el) return { skipped: 'not-visible' };
      el.click();
      return { clicked: true };
    }, btn.action);
    if (r.skipped) continue;
    await p.waitForTimeout(700);
    const after = await p.evaluate(() => {
      const vis = (el) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && r.width > 0; };
      const modal = document.querySelector('.modal-mask');
      return {
        modalOpen: vis(modal),
        modalTitle: modal ? ((modal.querySelector('.gold-heading, .m-title') || {}).textContent || '').trim() : '',
        modalText: modal ? (modal.textContent || '').replace(/\s+/g, ' ').slice(0, 200) : '',
        screenSwitch: [...document.querySelectorAll('[id^="screen-"]')].filter(vis).map((x) => x.id)
      };
    });
    openable.push({ action: btn.action, text: btn.text, after });
    /* 把弹窗关掉，回到主界面 */
    await p.evaluate(() => {
      const vis = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0; };
      const c = [...document.querySelectorAll('[data-action="close-modal"]')].filter(vis)[0];
      if (c) c.click();
      const m = document.querySelector('.modal-mask');
      if (m && vis(m)) { const c2 = [...document.querySelectorAll('[data-action="close-modal"]')].filter(vis)[0]; if (c2) c2.click(); }
    });
    await p.waitForTimeout(400);
    const stillModal = await p.evaluate(() => {
      const m = document.querySelector('.modal-mask');
      return !!(m && m.getBoundingClientRect().width > 0);
    });
    if (stillModal) {
      await p.keyboard.press('Escape');
      await p.waitForTimeout(400);
    }
    const stuck = await p.evaluate(() => {
      const m = document.querySelector('.modal-mask');
      return !!(m && m.getBoundingClientRect().width > 0);
    });
    if (stuck) {
      card('N3', '死路/误触', '入口 ' + btn.action, '打开面板后点关闭/Esc 都关不掉', '应能关闭回到主界面');
      await p.evaluate(() => { document.querySelectorAll('.modal-mask').forEach((m) => m.remove()); });
    }
  }
  fs.writeFileSync(OUT + '/openable.json', JSON.stringify(openable, null, 2));
  note('遍历入口完成', '记录 ' + openable.length + ' 个面板 → openable.json');

  await p.screenshot({ path: OUT + '/20_after_tour.png', fullPage: true });
  note('运行时错误', JSON.stringify(errs.slice(0, 6)));
  ok('全程无页面运行时错误', errs.length === 0, errs.length + ' 条:' + (errs[0] || ''));

  console.log('\n======== 卡点汇总 ========');
  CARDS.forEach((c) => console.log(' ' + c.id + ' [' + c.kind + '] ' + c.where + ' —— ' + c.what));
  console.log('卡点 ' + CARDS.length + ' 条 / 断言 ' + pass + ' 通过 / ' + fail + ' 失败');
  fs.writeFileSync(OUT + '/cards.json', JSON.stringify({ cards: CARDS, pass, fail }, null, 2));
  await b.close();
  process.exit(0);
})();

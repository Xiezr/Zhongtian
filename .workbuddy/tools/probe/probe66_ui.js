/* ============================================================
 * probe66_ui.js —— v66 界面探针（真实浏览器 + 截图交人眼）
 * 量的是**程序正确性**（不溢出 / 无滚动条 / 数字对得上），
 * 好不好看由老板看截图定 —— 我不下审美结论。
 * 用法: NODE_PATH=<...>/node_modules node .workbuddy/tmp/probe66_ui.js
 * ============================================================ */
const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const b = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, ex) => out.push([ok ? 'OK  ' : 'FAIL', n, ex || '']);
  const SHOT = path.join(__dirname, 'v66');

  const setup = `(function(){ const G=GAME, s=G.state, c=s.cities[0];
    if (!s.map.grid && G.map.generate) G.map.generate();
    /* 客栈要真的建出来，否则 openInn 显示的不是资质概率表 */
    (function () { for (var i = 0; i < c.cells.length; i++) { var x = c.cells[i];
      if (x.official) continue; if (x.build && x.build.id !== 'kezhan') continue;
      x.build = { id: 'kezhan', lvl: 3 }; return true; } return false; })();
    var g = s.generals[0];
    g.status = 'idle'; g.cityId = c.id; g.level = 40; g.nz = 120;
    g.energy = 60;
    /* 让"当前体力 ≠ 上限"：装备 q4 打造件（每件 700 体力）+ 余量留一半 */
    g.equip = { head: 'cr_head_4', chest: 'cr_chest_4', shoulder: 'cr_shoulder_4', arm: 'cr_arm_4',
                waist: 'cr_waist_4', feet: 'cr_feet_4' };
    g.stamina = Math.round(G.staBaseMax(g) * 0.5);
    s.items = s.items || {};
    (GAME.DATA.ITEMS||[]).forEach(function(it){ if (it.type==='exp') s.items[it.id]=5; });
    (GAME.DATA.ITEMS||[]).forEach(function(it){ if (it.type==='stamina') s.items[it.id]=3; });
    G.ui._genSel = g.id;
    G.ui._cityId = c.id; G.refreshAll();
    return { staMax: G.staMax(g), staNow: G.staNow(g), staEq: Math.round(G.staEquipOf(g)),
      cap: G.genLevelCap(g) }; })()`;

  const rowMeasure = `(function(){
    var pane = document.querySelector('.gen-pane');
    var rows = Array.from(document.querySelectorAll('.gd-line'));
    var sta = rows.filter(function(el){ return el.textContent.indexOf('体力') === 0; })[0] || null;
    var others = rows.filter(function(el){ return el !== sta; });
    var h = function(el){ return el ? Math.round(el.getBoundingClientRect().height) : -1; };
    var m = document.querySelector('#modal-root .inner-panel');
    return {
      staText: sta ? sta.textContent.replace(/\\s+/g,' ').trim() : '(未找到)',
      staH: h(sta), otherH: others.length ? h(others[0]) : -1,
      paneH: pane ? Math.round(pane.getBoundingClientRect().height) : -1,
      pageScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      modalScroll: m ? (m.scrollHeight > m.clientHeight + 2) : null,
      modalOver: m ? (m.getBoundingClientRect().bottom > window.innerHeight + 1) : null,
      modalTxt: m ? m.textContent.replace(/\\s+/g,' ').trim().slice(0,80) : ''
    }; })()`;

  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const tag = vp[0] + 'x' + vp[1];
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1300);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程');
    await p.waitForTimeout(1800);
    const st = await p.evaluate(setup);
    await p.evaluate(`GAME.ui.setView('generals')`);
    await p.waitForTimeout(700);

    const r = await p.evaluate(rowMeasure);
    /* 主数字必须是"上限"，且页面不出现横向滚动条、体力行不比其他行高（不折行） */
    const num = (r.staText.match(/^体力\s*([\d,]+)/) || [])[1];
    check(tag + ' 将领页体力主数字 = 上限（含装备）', Number(String(num).replace(/,/g, '')) === st.staMax,
      '页面 ' + num + ' / 上限 ' + st.staMax + '（装备 +' + st.staEq + '，当前 ' + st.staNow + '）');
    check(tag + ' 体力行与其它行同高（文字没被挤折行）',
      r.staH > 0 && r.otherH > 0 && r.staH <= r.otherH + 2, '体力行 ' + r.staH + 'px / 其它行 ' + r.otherH + 'px');
    check(tag + ' 将领页无横向溢出', r.pageScroll === false);
    if (vp[0] === 1600) {
      await p.screenshot({ path: SHOT + '-1-generals-' + tag + '.png' });
    }

    /* ② 经验道具面板：到上限（拒用） */
    await p.evaluate(`(function(){ var G=GAME, g=G.state.generals[0]; g.level = G.genLevelCap(g);
      G.ui.openExpPick(g.id); })()`);
    await p.waitForTimeout(600);
    const e1 = await p.evaluate(rowMeasure);
    check(tag + ' 到上限的经验面板：无使用按钮', e1.modalTxt.indexOf('无法再使用经验道具') >= 0, e1.modalTxt.slice(0, 40));
    check(tag + ' 到上限的经验面板：不溢出、无滚动条', e1.modalOver === false && e1.modalScroll === false);
    if (vp[0] === 1600) await p.screenshot({ path: SHOT + '-2-expcap-' + tag + '.png' });

    /* ③ 经验道具面板：未到上限（对照） */
    await p.evaluate(`(function(){ var G=GAME, g=G.state.generals[0]; g.level = 30;
      G.ui.openExpPick(g.id); })()`);
    await p.waitForTimeout(600);
    const e2 = await p.evaluate(`(function(){ var m=document.querySelector('#modal-root .inner-panel');
      var btn=[].slice.call(document.querySelectorAll('#modal-root [data-action="gen-exp-item"]'));
      return { n: btn.length, txt: m?m.textContent.replace(/\\s+/g,' ').trim().slice(0,60):'',
        over: m? (m.getBoundingClientRect().bottom > window.innerHeight+1):null,
        scroll: m? (m.scrollHeight > m.clientHeight+2):null }; })()`);
    check(tag + ' 未到上限的经验面板：仍有使用按钮', e2.n >= 2, e2.n + ' 个按钮');
    check(tag + ' 未到上限的经验面板：不溢出、无滚动条', e2.over === false && e2.scroll === false);
    if (vp[0] === 1600) await p.screenshot({ path: SHOT + '-3-expok-' + tag + '.png' });

    /* ④ 客栈：资质概率表 */
    await p.evaluate(`GAME.ui.closeModal(); GAME.ui.openInn()`);
    await p.waitForTimeout(600);
    const inn = await p.evaluate(`(function(){ var box=document.querySelector('#modal-root .rk-box');
      var m=document.querySelector('#modal-root .inner-panel');
      var rows=box?[].slice.call(box.querySelectorAll('.rk-row')).map(function(x){return x.textContent.replace(/\\s+/g,' ').trim();}):[];
      var ws=GAME.rankWeights(GAME.buildingLevel(GAME.currentCity(),'kezhan')||1), t=0,v=0;
      ws.forEach(function(x){ t+=x.w; if(x.rank.id==='tian') v=x.w; });
      return { rows: rows, tianPct: v/t*100,
        over: m? (m.getBoundingClientRect().bottom > window.innerHeight+1):null,
        scroll: m? (m.scrollHeight > m.clientHeight+2):null }; })()`);
    const tianRow = inn.rows.filter(x => x.indexOf('天授') >= 0)[0] || '';
    const shown = (inn.tianPct >= 1 ? inn.tianPct.toFixed(1) : inn.tianPct.toFixed(2)) + '%';
    check(tag + ' 客栈资质表显示的天授概率与权重一致', tianRow.indexOf(shown) >= 0,
      '天授 ' + shown + '；行「' + tianRow + '」');
    check(tag + ' 客栈五档资质齐全', ['凡品', '良材', '英杰', '名世', '天授'].every(n => inn.rows.join('').indexOf(n) >= 0));
    check(tag + ' 客栈面板不溢出、无滚动条', inn.over === false && inn.scroll === false);
    if (vp[0] === 1600) await p.screenshot({ path: SHOT + '-4-inn-' + tag + '.png' });

    /* ⑤ 装备页：加成汇总的体力与装备贡献一致 */
    await p.evaluate(`(function(){ var G=GAME; G.ui.closeModal(); G.ui._equipGen=G.state.generals[0].id;
      G.ui.setView('equip'); })()`);
    await p.waitForTimeout(600);
    const eq = await p.evaluate(`(function(){ var rows=[].slice.call(document.querySelectorAll('.res-line'));
      var row=rows.filter(function(el){ return el.textContent.indexOf('体力')>=0; })[0];
      return { txt: row?row.textContent.replace(/\\s+/g,' ').trim():'(未找到)',
        eq: Math.round(GAME.staEquipOf(GAME.state.generals[0])) }; })()`);
    check(tag + ' 装备页加成汇总的体力 = 装备体力贡献', eq.txt.indexOf('+' + eq.eq) >= 0,
      '装备贡献 ' + eq.eq + '；行「' + eq.txt + '」');
    if (vp[0] === 1600) await p.screenshot({ path: SHOT + '-5-equip-' + tag + '.png' });

    await p.close();
  }

  await b.close();
  console.log('');
  let bad = 0;
  out.forEach(r => { if (r[0] !== 'OK  ') bad++; console.log(r[0] + '  ' + r[1] + (r[2] ? '  [' + r[2] + ']' : '')); });
  console.log('');
  console.log('合计 ' + out.length + ' 项，失败 ' + bad + ' 项');
  console.log('截图：' + SHOT + '-1..5-*.png（挑一个分辨率看即可）');
})();

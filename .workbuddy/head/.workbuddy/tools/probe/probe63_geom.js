const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const out = [];
  const check = (n, ok, ex) => out.push([ok ? 'OK  ' : 'FAIL', n, ex || '']);

  /* 统一手法：**先开弹窗 → 等布局稳定 → 再单独量**。
     ⚠️ "开完立刻量"会量到还没加载完的图标、甚至上一次关闭时的残留面板 ——
     上一版探针就是这样给出 8 条假红 + 2 条假绿（v63 记一笔）。 */
  const opens = {
    pick: `(function(){ const G=GAME,s=G.state,c=s.cities[0];
      if (!s.map.grid && G.map.generate) G.map.generate();
      var e=-1; c.cells.forEach(function(x,i){ if(e<0&&!x.official) e=i; });
      c.cells[e]={build:null,pending:null};
      G.ui._cityId=c.id; G.ui.setView('city'); G.refreshAll(); G.ui.openBuildModal(e); })()`,
    forts: `(function(){ const G=GAME; if (G.map.generate) G.map.generate(); G.ui.openForts(); })()`,
    fort: `(function(){ const G=GAME; var fs2=G.map.fortsInView(0,0,60)||[]; if(!fs2.length) return;
      G.map.markFortRaided(fs2[0].x, fs2[0].y); G.ui.openFortModal(fs2[0]); })()`,
    exp: `(function(){ const G=GAME; var fs2=G.map.fortsInView(0,0,60)||[]; if(!fs2.length) return;
      G.ui.openExpModal({kind:'fort', x:fs2[0].x, y:fs2[0].y}); })()`,
    npc: `(function(){ const G=GAME; var z=null; (G.state.map.cities||[]).forEach(function(x){ if(!z&&x.type==='zhou') z=x; });
      if (z) G.ui.openExpModal({kind:'city', id:z.id}); })()`,
  };
  /* 量的是 #modal-root 里的**当前**面板（不是任意 .modal，避免量到残留） */
  const measures = {
    pick: `(function(){
      const m=document.querySelector('#modal-root .inner-panel');
      const cards=Array.prototype.slice.call(document.querySelectorAll('#modal-root .bldg-pick'));
      const hs=cards.map(function(x){ return Math.round(x.getBoundingClientRect().height); });
      const icons=Array.prototype.slice.call(document.querySelectorAll('#modal-root .bldg-pick .ico'));
      const imgs=icons.filter(function(x){ return x.tagName.toLowerCase()==='img'; });
      const rc=m?m.getBoundingClientRect():null;
      return { cards:cards.length, icons:icons.length,
        hMin:hs.length?Math.min.apply(null,hs):0, hMax:hs.length?Math.max.apply(null,hs):0,
        badImg:imgs.filter(function(x){ return !x.complete||x.naturalWidth===0; }).length,
        over: rc ? (rc.bottom>window.innerHeight+1||rc.top<-1) : null,
        scroll: m ? (m.scrollHeight>m.clientHeight+2) : null,
        hasCost: cards.some(function(x){ return x.textContent.indexOf('耗')>=0; }),
        hasTitle: !!document.querySelector('#modal-root .bldg-pick[title*="耗："]'),
        hScroll: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`,
    forts: `(function(){
      const m=document.querySelector('#modal-root .inner-panel');
      const rc=m?m.getBoundingClientRect():null;
      const txt=m?m.textContent:'';
      return { rows:document.querySelectorAll('#modal-root .tbl tbody tr').length,
        over: rc?(rc.bottom>window.innerHeight+1||rc.top<-1):null,
        scroll: m?(m.scrollHeight>m.clientHeight+2):null,
        hasCol:txt.indexOf('地块')>=0 && /（\\d+ 格）/.test(txt),
        hasSt:txt.indexOf('掠夺')>=0, hasPager:!!document.querySelector('#modal-root .pager'),
        hScroll: document.documentElement.scrollWidth>window.innerWidth+1 }; })()`,
    fort: `(function(){
      const m=document.querySelector('#modal-root .inner-panel');
      const rc=m?m.getBoundingClientRect():null;
      return { txt:m?m.textContent.indexOf('今日已掠夺')>=0:false,
        over: rc?(rc.bottom>window.innerHeight+1||rc.top<-1):null,
        scroll: m?(m.scrollHeight>m.clientHeight+2):null }; })()`,
    exp: `(function(){
      const m=document.querySelector('#modal-root .inner-panel');
      const rc=m?m.getBoundingClientRect():null;
      const tab=document.querySelector('#modal-root .exp-mode[data-v="raid"]');
      return { locked: !!tab && /locked/.test(tab.className),
        over: rc?(rc.bottom>window.innerHeight+1||rc.top<-1):null,
        scroll: m?(m.scrollHeight>m.clientHeight+2):null }; })()`,
    npc: `(function(){
      const m=document.querySelector('#modal-root .inner-panel');
      const rc=m?m.getBoundingClientRect():null;
      return { txt:m?m.textContent:'',
        over: rc?(rc.bottom>window.innerHeight+1||rc.top<-1):null,
        scroll: m?(m.scrollHeight>m.clientHeight+2):null }; })()`,
  };

  for (const vp of [[1600, 950], [1366, 768], [1280, 720]]) {
    const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
    await p.goto('file:///E:/Deepseekdb/index.html');
    await p.waitForTimeout(1400);
    const ni = await p.$('input[placeholder*="名字"]'); if (ni) await ni.fill('北辰');
    await p.click('text=开始新的征程'); await p.waitForTimeout(2000);
    const tag = vp[0] + 'x' + vp[1];
    const M = {};
    for (const k of ['pick', 'forts', 'fort', 'exp', 'npc']) {
      await p.evaluate('(function(){ try { GAME.ui.closeModal(); } catch(e){} })()');
      await p.evaluate(opens[k]);
      await p.waitForTimeout(700);
      M[k] = await p.evaluate(measures[k]);
    }
    check(tag + ' 建造选择：卡片等高（图标固定 84px）',
      M.pick.cards > 0 && M.pick.hMin === M.pick.hMax, M.pick.cards + ' 张 · ' + M.pick.hMin + '~' + M.pick.hMax + 'px');
    check(tag + ' 建造选择：每张卡都渲染了图标且无破图',
      M.pick.cards > 0 && M.pick.icons === M.pick.cards && M.pick.badImg === 0,
      M.pick.icons + '/' + M.pick.cards + ' · 破图 ' + M.pick.badImg);
    check(tag + ' 建造选择：正文无费用 · 悬停有费用', M.pick.hasCost === false && M.pick.hasTitle === true);
    check(tag + ' 建造选择：不溢出屏幕 / 无内部滚动条', M.pick.over === false && M.pick.scroll === false);
    check(tag + ' 建造选择：无横向滚动条', M.pick.hScroll === false);

    check(tag + ' 据点一览：含地块列（写出格数）与掠夺状态', M.forts.hasCol === true && M.forts.hasSt === true);
    check(tag + ' 据点一览：**分页**（弹窗内不许有滚动条）',
      M.forts.hasPager === true && M.forts.scroll === false && M.forts.over === false, M.forts.rows + ' 行/页');
    check(tag + ' 据点一览：无横向滚动条', M.forts.hScroll === false);

    check(tag + ' 据点面板：提示今日已掠夺', M.fort.txt === true);
    check(tag + ' 据点面板：不溢出屏幕 / 无内部滚动条', M.fort.over === false && M.fort.scroll === false);

    check(tag + ' 出征面板：掠夺已锁定（已掠夺的据点）', M.exp.locked === true);
    check(tag + ' 出征面板：不溢出屏幕 / 无内部滚动条', M.exp.over === false && M.exp.scroll === false);

    check(tag + ' 名城出征面板：不溢出屏幕 / 无内部滚动条', M.npc.over === false && M.npc.scroll === false);
    check(tag + ' 名城出征面板：写着建筑已补满', M.npc.txt.indexOf('满配') >= 0);
    await p.close();
  }
  await b.close();
  const bad = out.filter(x => x[0] === 'FAIL');
  out.forEach(x => console.log('  ' + x[0] + ' ' + x[1] + (x[2] ? '  [' + x[2] + ']' : '')));
  console.log('\n几何探针：' + (out.length - bad.length) + ' 通过 / ' + bad.length + ' 失败');
})();

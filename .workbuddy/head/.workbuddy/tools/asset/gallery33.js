/* v33 最终验收：99 图标几何验证（getBoundingClientRect，不受承台干扰）+ 总览图 + 城内统计 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/';

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///E:/Deepseekdb/index.html');
  await p.waitForTimeout(1700);
  const ni = await p.$('input[placeholder*="名字"]');
  if (ni) await ni.fill('北辰');
  await p.click('text=开始新的征程');
  await p.waitForTimeout(2500);

  /* ---- 城内 built 统计（排除"只有2个图标是空城"的误判）---- */
  const city = await p.evaluate(() => {
    var t = document.querySelectorAll('.iso-tile');
    var built = 0, empty = 0;
    for (var i = 0; i < t.length; i++) {
      if (/built|gov|plat/.test(t[i].getAttribute('class') || '')) built++; else empty++;
    }
    return { tiles: t.length, built: built, empty: empty, gov: document.querySelectorAll('.gov-svg').length };
  });
  console.log('城内：格' + city.tiles + ' 已建' + city.built + ' 空地' + city.empty + ' 宫殿svg' + city.gov);

  /* ---- 铺开 99 个图标，逐个做几何体检 ---- */
  const g = await p.evaluate(() => {
    var I = window.GAME.icons;
    var groups = [
      ['建筑', ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku', 'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan', 'honglusi', 'tiejiangpu', 'gongjiangzuofang'], I.forBuilding],
      ['城外', ['farm', 'forest', 'quarry', 'mine'], I.forExt],
      ['资源', ['grain', 'wood', 'stone', 'iron', 'gold', 'pop'], I.forRes],
      ['地形', ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill', 'city'], I.forTerrain],
      ['兵种', ['minfu', 'yibing', 'chihou', 'changqiang', 'daodun', 'gongjian', 'qingji', 'tieji', 'zhouche', 'chuangnu', 'chongche', 'toudan', 'qingzhoubing', 'tengjiabing', 'tuqibing', 'hubaoqi', 'xiliangtieqi', 'nanjiangxiangbing'], I.forTroop],
      ['材料', ['fatie', 'jingtie', 'bintie', 'yuntie', 'songmu', 'nanmu', 'tanmu', 'jianmu', 'cuge', 'xiaoge', 'xige', 'jiaoge', 'shoujin', 'niujin', 'jiaojin', 'longjin', 'heshi', 'qingyu', 'yangzhi', 'kunshan', 'mabu', 'xijuan', 'shujin', 'yunjin'], I.forMat],
      ['装备', ['weapon', 'head', 'chest', 'shoulder', 'arm', 'waist', 'feet', 'back', 'neck', 'ring', 'pendant', 'mount'], I.forEquip],
      ['物品', ['jewel', 'blueprint', 'prod_buff', 'military_buff', 'boost', 'exp', 'stamina', 'perm', 'mount_buff', 'attr_buff', 'build_cost'], function (t) { return I.forItem(t, ''); }],
    ];
    var html = '<h1>v33 修复验收 · 全部图标几何体检</h1>'
      + '<p class="sub">判据：每个图标的矢量路径必须完全落在它自己的 64×64 视窗内（越界 = 被裁切 = 看起来"没图标"）</p>';
    var d = document.createElement('div');
    d.id = 'giG';
    d.style.cssText = 'position:fixed;left:0;top:0;width:1420px;z-index:999999;background:#14171d;padding:14px;font-family:"Microsoft YaHei",sans-serif;color:#e8e2d4';
    document.body.appendChild(d);
    var report = [], totalN = 0, badN = 0;
    groups.forEach(function (gr) {
      var sec = document.createElement('div');
      sec.innerHTML = '<h2>' + gr[0] + ' ' + gr[1].length + '</h2>';
      var row = document.createElement('div');
      row.className = 'grow';
      gr[1].forEach(function (id) {
        var box = document.createElement('div');
        box.className = 'gbox';
        box.innerHTML = gr[2](id) || '<span class="miss">空</span>';
        row.appendChild(box);
      });
      sec.appendChild(row);
      d.appendChild(sec);
    });
    /* 体检：逐个路径是否越界 */
    var boxes = d.querySelectorAll('.gbox');
    for (var i = 0; i < boxes.length; i++) {
      var svg = boxes[i].querySelector('svg');
      if (!svg) { report.push('第' + i + '格无 svg'); badN++; continue; }
      var sr = svg.getBoundingClientRect();
      var paths = svg.querySelectorAll('g[transform] path');
      totalN++;
      if (!paths.length) { report.push('第' + i + '格无素材路径'); badN++; continue; }
      var worst = 0;
      for (var k = 0; k < paths.length; k++) {
        var pr = paths[k].getBoundingClientRect();
        var over = Math.max(sr.x - pr.x, sr.y - pr.y, (pr.x + pr.width) - (sr.x + sr.width), (pr.y + pr.height) - (sr.y + sr.height));
        if (over > worst) worst = over;
      }
      if (worst > 3) { report.push('第' + i + '格越界 ' + Math.round(worst) + 'px'); badN++; }
    }
    var st = document.createElement('style');
    st.textContent = '#giG h1{font-size:15px;margin:0 0 3px;color:#e8c46a}'
      + '#giG h2{font-size:12px;margin:10px 0 5px;color:#8fb0d8;border-bottom:1px solid #2c3440;padding-bottom:3px}'
      + '#giG p.sub{margin:0 0 4px;color:#7d8a9e;font-size:11px}'
      + '#giG .grow{display:grid;grid-template-columns:repeat(12,1fr);gap:6px}'
      + '#giG .gbox{height:78px;display:flex;align-items:center;justify-content:center;'
      + 'background:radial-gradient(circle at 50% 40%,#43392c 0%,#292319 68%,#16130e 100%);border-radius:8px;overflow:hidden}'
      + '#giG .gbox svg{width:76%;height:76%}'
      + '#giG .miss{color:#e55;font-size:10px}';
    d.insertBefore(st, d.firstChild);
    var r = d.getBoundingClientRect();
    return { w: Math.ceil(r.width), h: Math.ceil(r.height), checked: totalN, bad: badN, detail: report.slice(0, 12) };
  });
  console.log('=== 99 图标几何体检 ===');
  console.log('  检查=' + g.checked + '  越界=' + g.bad);
  if (g.detail.length) g.detail.forEach(x => console.log('  ' + x));
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'v33-gallery.png', clip: { x: 0, y: 0, width: g.w, height: g.h } });
  await p.screenshot({ path: OUT + 'v33-font.png' });
  console.log('总览图已出：' + g.w + 'x' + g.h + '   页面错误 ' + errs.length + ' 条');
  await b.close();
})().catch(e => { console.error('FATAL ' + e.message); process.exit(1); });

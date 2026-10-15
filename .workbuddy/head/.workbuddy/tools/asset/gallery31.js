/* 图标画廊截图：把全部图标以 96px 网格渲染成单页，便于统一评估设计感 */
const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto('file:///E:/Deepseekdb/index.html');
  await page.waitForTimeout(1200);
  const html = await page.evaluate(() => {
    const ICON = window.GAME.icons;
    const groups = [
      ['城内建筑16', Object.keys(ICON).filter(k => /^b_/.test(k) || /^ic_b_/.test(k)).map(k => k)],
    ];
    // 直接用 forBuilding/forExt/forItem 等 API 生成
    const cells = [];
    function add(label, svg) {
      if (!svg) return;
      cells.push('<div class="cell"><div class="art">' + svg + '</div><div class="lbl">' + label + '</div></div>');
    }
    const BKEYS = ['guanfu','minfang','shuyuan','junying','xiaochang','shichang','cangku','keguan','tiedian','tiejiangpu','gongjiang','jiaochang','hefengguan','shengxianta','zhaixianguan','gongjiangzuofang'];
    BKEYS.forEach(b => add(b, ICON.forBuilding ? ICON.forBuilding(b) : ''));
    ['farm','forest','quarry','mine'].forEach(e => add('ext:' + e, ICON.forExt ? ICON.forExt(e) : ''));
    ['plain','caoyuan','zhaoze','lake','forest','desert','hill'].forEach(t => add('ter:' + t, ICON.forTerrain ? ICON.forTerrain(t) : ''));
    ['grain','wood','stone','iron','gold','pop'].forEach(r => add('res:' + r, ICON.forRes ? ICON.forRes(r) : ''));
    const TROOPS = ['minfu','changqiangbing','daobing','gongjianbing','qingqibing','zhongqibing','qibingwei','nubing','liannubing','toudanbing','qingzhoubing','wudanbing','xiangbing','huangjinjun','tieji','zhouche','chebing','hubaoqi'];
    TROOPS.forEach(t => add('troop:' + t, ICON.forTroop ? ICON.forTroop(t) : ''));
    // 材料 24
    const MATS = ['fatie','jingtie','bintie','yuntie','songmu','nanmu','tanmu','jianmu','cupi','xiaopi','xipi','jiaopi','shoujin','niujin','jiaojin','longjin','heshi','qingyu','yangzhi','kunshan','mabu','xijuan','shujin','yunjin'];
    MATS.forEach(m => add('mat:' + m, ICON.forItem ? ICON.forItem('mat', m) : ''));
    // 装备槽位
    ['weapon','armor','helm','boot','belt','ring','necklace','horse'].forEach(s => add('slot:' + s, ICON.forSlot ? ICON.forSlot(s) : ''));
    // 物品类型（用真实 data.js 中的 type 字符串）
    ['jewel','blueprint','prod_buff','military_buff','boost','exp','stamina','perm','mount_buff','attr_buff','build_cost'].forEach(t => add('item:' + t, ICON.forItem ? ICON.forItem(t, t === 'prod_buff' ? 'shennongchu' : (t === 'military_buff' ? 'xianzhenzhangu' : '')) : ''));
    // 野外城池
    add('fort', ICON.forWild ? ICON.forWild('fort') : '');
    const doc = '<style>' +
      'body{background:#1c1610;margin:0;padding:16px;font:11px/1.3 "Microsoft YaHei",sans-serif;color:#c9b389}' +
      '.wrap{display:flex;flex-wrap:wrap;gap:10px}' +
      '.cell{width:104px;text-align:center}' +
      '.art{width:96px;height:96px;background:#241c12;border-radius:10px;display:flex;align-items:center;justify-content:center;margin:0 auto 4px}' +
      '.art svg{width:88px;height:88px}' +
      '.lbl{color:#a08c66}' +
      '</style><div class="wrap">' + cells.join('') + '</div>';
    return doc;
  });
  await page.setContent(html);
  await page.screenshot({ path: 'E:/Deepseekdb/.workbuddy/tmp/v31-gallery.png', fullPage: true });
  await browser.close();
  console.log('GALLERY_OK');
})().catch(e => { console.error(e.message); process.exit(1); });

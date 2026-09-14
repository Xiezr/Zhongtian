/* v35-f：批量拼图（可复用）—— 传 id:中文列表，输出总览图 */
const fs = require('fs');
const { chromium } = require('playwright-core');
const UI = 'E:/Deepseekdb/assets/icons/ui/';
const OUT = 'E:/Deepseekdb/.workbuddy/tmp/';

/* 用法: node tile_show.js <输出名> <标题> <列数> <id:中文,id:中文,...> */
const outName = process.argv[2] || 'v35-show.png';
const title = process.argv[3] || '图标总览';
const cols = parseInt(process.argv[4] || '8', 10);
const items = (process.argv[5] || '').split(',').map(s => {
  const [id, name] = s.split(':');
  return { id: id.trim(), name: (name || id).trim() };
}).filter(x => x.id);

const missing = items.filter(x => !fs.existsSync(UI + 'ai_' + x.id + '.png'));
console.log('条目 ' + items.length + '  缺图 ' + missing.length + (missing.length ? '：' + missing.map(m => m.id).join(',') : ''));
const ok = items.filter(x => fs.existsSync(UI + 'ai_' + x.id + '.png'));

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const p = await b.newPage({ viewport: { width: 1500, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto('about:blank');
  const r = await p.evaluate((d) => {
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:0;top:0;background:#14171d;padding:18px;font-family:"Microsoft YaHei",sans-serif;color:#e8e2d4;width:' + (d.cols * 158 + 36) + 'px';
    var html = '<h1 style="font-size:16px;margin:0 0 4px;color:#e8c46a">' + d.title + '</h1>'
      + '<p style="margin:0 0 14px;color:#8b98ad;font-size:12px">'
      + 'AI 生成 · 汉代风 · 透明底 PNG（已抠底）· 共 ' + d.items.length + ' 个　｜　'
      + '背景用草地绿模拟城内棋盘，验证"无承台、直接以轮廓摆放"</p>'
      + '<div style="display:grid;grid-template-columns:repeat(' + d.cols + ',1fr);gap:10px">';
    d.items.forEach(function (it) {
      html += '<div style="text-align:center">'
        + '<div style="height:138px;display:flex;align-items:center;justify-content:center;'
        + 'background:linear-gradient(180deg,#3d4d3c 0%,#2f3c2d 62%,#26301f 100%);border-radius:9px;'
        + 'border:1px solid #47533d;overflow:hidden">'
        + '<img src="' + it.src + '" style="max-width:94%;max-height:94%;object-fit:contain"/></div>'
        + '<div style="font-size:11px;color:#b0a084;margin-top:5px">' + it.name + '</div></div>';
    });
    html += '</div>';
    box.innerHTML = html;
    document.body.appendChild(box);
    var rr = box.getBoundingClientRect();
    return { w: Math.ceil(rr.width), h: Math.ceil(rr.height) };
  }, { title, cols, items: ok.map(x => ({ src: 'file:///E:/Deepseekdb/assets/icons/ui/ai_' + x.id + '.png', name: x.name })) });
  await p.waitForTimeout(Math.min(4000, 500 + ok.length * 90));
  await p.screenshot({ path: OUT + outName, clip: { x: 0, y: 0, width: r.w, height: r.h } });
  console.log('输出 ' + outName + '  ' + r.w + 'x' + r.h);
  await b.close();
})().catch(e => console.error('失败: ' + e.message));

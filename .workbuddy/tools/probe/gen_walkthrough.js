/* 把玩家视角走查的截图与结论拼成一页自包含 HTML（图片内联 base64） */
'use strict';
const fs = require('fs');
const DIR = 'E:/Deepseekdb/.workbuddy/tmp/pjourney';
const OUT = DIR + '/玩家视角走查.html';

const A = JSON.parse(fs.readFileSync(DIR + '/rows_a.json', 'utf8'));
const B = JSON.parse(fs.readFileSync(DIR + '/rows_b.json', 'utf8'));

const shots = [
  ['01_first_sight', '第一眼：底栏有「🧍 人物」'],
  ['02_district_hud', '点「人物」→ 自动落街区 + 右下操作条'],
  ['03_district_walked', '按 ↑ 走了 3.24 米'],
  ['05_back_globe', '按 Q 回星球（不再满屏蓝）'],
  ['06_wild_follow', '野地视角：橙色小人背影，看得见自己'],
  ['11c_backcity', '点「回本城」→ 城被送到画面正中（本轮修的）'],
  ['12_land_modal', '点森林：资源地块 · 未勘探 + 🔍 勘探'],
  ['13_scanned', '勘探后：丰度 / 储量 / 建采集场'],
  ['14_plant_modal', '采集场面板：造价 / 工期 / 可采时长'],
  ['31_unfogged', '点未探明的森林：只有出征面板，没有勘探入口']
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = (f) => {
  const j = DIR + '/' + f + '.jpg', q = DIR + '/' + f + '.png';
  if (fs.existsSync(j)) return 'data:image/jpeg;base64,' + fs.readFileSync(j).toString('base64');
  if (fs.existsSync(q)) return 'data:image/png;base64,' + fs.readFileSync(q).toString('base64');
  return '';
};
const row = (r) => {
  const cls = r.kind === 'ok' ? 'ok' : r.kind === 'fail' ? 'bad' : 'note';
  const mark = r.kind === 'ok' ? '✓' : r.kind === 'fail' ? '✗' : '·';
  return '<div class="r ' + cls + '"><b>' + mark + '</b> ' + esc(r.t) +
    (r.d ? '<div class="d">' + esc(r.d) + '</div>' : '') + '</div>';
};

const html = [
  '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>v158.16 玩家视角走查</title>',
  '<style>',
  'body{margin:0;background:#14120f;color:#e6dfd0;font:14px/1.65 "Microsoft YaHei",system-ui,sans-serif;padding:26px 30px 70px;max-width:1180px;margin:0 auto}',
  'h1{font-size:21px;color:#f0d79a;margin:0 0 4px}',
  '.sub{color:#8e8574;font-size:13px;margin-bottom:22px}',
  'h2{font-size:16px;color:#f0d79a;margin:30px 0 10px;border-left:3px solid #8a6d2f;padding-left:10px}',
  '.r{background:#1b1814;border:1px solid #302a22;border-radius:7px;padding:8px 12px;margin:5px 0;font-size:13.5px}',
  '.r.ok{border-color:#2f4a33}.r.ok b{color:#5ddc8a}',
  '.r.bad{border-color:#5a2b2b}.r.bad b{color:#ff7b72}',
  '.r.note b{color:#8e8574}.r.note{background:#191713}',
  '.d{color:#8e8574;font-size:12.5px;margin-top:3px}',
  '.shot{margin:16px 0 26px;border:1px solid #302a22;border-radius:9px;overflow:hidden;background:#1b1814}',
  '.cap{padding:9px 13px;font-size:13px;color:#d9cfb8;border-bottom:1px solid #2a241d}',
  'img{display:block;width:100%;height:auto}',
  '</style></head><body>',
  '<h1>v158.16 · 玩家视角走查</h1>',
  '<div class="sub">扮一个完全不懂这游戏的新玩家：只用屏幕上看得到的字 + 鼠标键盘。' +
    '走动全链 ' + A.pass + ' 通过 / ' + A.fail + ' 失败　·　找矿建厂 ' + B.pass + ' 通过 / ' + B.fail + ' 失败</div>',
  '<h2>画面记录（按玩家真实操作顺序）</h2>'
];
shots.forEach(([f, cap]) => {
  const src = b64(f);
  if (!src) return;
  html.push('<div class="shot"><div class="cap">' + esc(cap) + '</div><img src="' + src + '"></div>');
});
html.push('<h2>走查 A · 走动全链（' + A.pass + '/' + A.fail + '）</h2>');
A.rows.forEach((r) => html.push(row(r)));
html.push('<h2>走查 B · 找矿 → 建厂 / 悬停（' + B.pass + '/' + B.fail + '）</h2>');
B.rows.forEach((r) => html.push(row(r)));
html.push('</body></html>');

fs.writeFileSync(OUT, html.join('\n'), 'utf8');
console.log('生成 ' + OUT + ' · ' + (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');

/* v89.207 快赢①：纯图标按钮 title 审计 —— 扫全仓（js 字符串 + index.html），
   找 data-action 按钮中"文本为纯图标（无中文无字母数字）"且无 title 的。
   用法：node .workbuddy/tools/audit/audit_v89207_icontitle.js */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var FILES = ['index.html', 'js/ui.js', 'js/main.js', 'js/map.js', 'js/battle.js', 'js/state.js', 'js/domain.js', 'js/systems.js'];
var miss = [], total = 0, withTitle = 0, textBtn = 0;

FILES.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(R + f, 'utf8'); } catch (e) { return; }
  var lines = src.split('\n');
  lines.forEach(function (L, i) {
    var re = /data-action="([\w-]+)"/g, m;
    while ((m = re.exec(L)) !== null) {
      /* 取该标签段：从 data-action 往前找 '<'、往后找 '>'（同行的近似） */
      var a = L.lastIndexOf('<', m.index);
      var b = L.indexOf('>', m.index);
      if (a < 0 || b < 0) continue;
      var tag = L.slice(a, b + 1);
      total++;
      var hasTitle = / title="/.test(tag);
      if (hasTitle) { withTitle++; continue; }
      /* 文本 = 标签内去 <...> */
      var txt = tag.replace(/<[^>]*>/g, '').trim();
      var isIcon = txt.length > 0 && txt.length <= 4 && !/[\u4e00-\u9fff0-9A-Za-z]/.test(txt);
      if (isIcon) { textBtn++; miss.push(f + ':' + (i + 1) + ' [' + m[1] + '] 「' + txt + '」'); }
    }
  });
});
console.log('data-action 标签总数 ' + total + ' · 带 title ' + withTitle
  + ' · 纯图标且无 title ' + textBtn);
miss.forEach(function (x) { console.log('  ⚠ ' + x); });

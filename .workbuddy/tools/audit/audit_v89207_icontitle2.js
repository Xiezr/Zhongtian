/* v89.207 快赢① 升级版：跨行匹配 <button ...>...</button>，剥离 JS 拼接符后看可见文本。
   纯图标（≤4 可见字符、无汉字、无 ASCII 字母数字）且无 title → 报缺。 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var FILES = ['index.html', 'js/ui.js', 'js/main.js', 'js/map.js', 'js/battle.js', 'js/state.js'];
var miss = [], total = 0, iconN = 0;
FILES.forEach(function (f) {
  var src;
  try { src = fs.readFileSync(R + f, 'utf8'); } catch (e) { return; }
  var re = /<button[^>]*data-action="([\w-]+)"[^>]*>([\s\S]{0,200}?)<\/button>/g, m;
  while ((m = re.exec(src)) !== null) {
    total++;
    var tagStart = src.lastIndexOf('<button', m.index);
    var tag = src.slice(tagStart, src.indexOf('>', m.index) + 1);
    var hasTitle = / title="/.test(tag);
    var inner = m[2]
      .replace(/<[^>]*>/g, '')            /* 去内层标签 */
      .replace(/'\s*\+\s*'/g, '')         /* 去拼接符 ' + ' */
      .replace(/"\s*\+\s*"/g, '')
      .replace(/\s*\+\s*$/, '')
      .replace(/[\s'"]/g, '');            /* 去空白与引号 */
    if (!inner) { continue; }
    var isIcon = inner.length <= 6 && !/[\u4e00-\u9fff0-9A-Za-z]/.test(inner);
    if (!isIcon) continue;
    iconN++;
    if (!hasTitle) miss.push(f + ' [' + m[1] + '] 「' + inner + '」');
  }
});
console.log('button 标签总数 ' + total + ' · 纯图标 ' + iconN + ' · 其中无 title ' + miss.length);
miss.forEach(function (x) { console.log('  ⚠ ' + x); });

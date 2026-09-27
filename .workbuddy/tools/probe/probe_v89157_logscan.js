/* v89.157：GAME.log 调用点精确分类统计（括号配平 + 字符串感知） */
var fs = require('fs'), path = require('path');
var R = 'E:/Deepseekdb/';
var FILES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic', 'story', 'ui', 'main'];
var kindCount = {}, subCount = {}, unsub = [];
FILES.forEach(function (f) {
  var s = fs.readFileSync(path.join(R, 'js', f + '.js'), 'utf8');
  var re = /GAME\.log\(/g, m;
  while ((m = re.exec(s)) !== null) {
    var i = m.index + 'GAME.log('.length, depth = 1, j = i, str = null, args = [], cur = '';
    while (j < s.length && depth > 0) {
      var ch = s[j];
      if (str) {
        cur += ch;
        if (ch === '\\') { cur += s[j + 1] || ''; j += 2; continue; }
        if (ch === str) str = null;
        j++; continue;
      }
      if (ch === "'" || ch === '"') { str = ch; cur += ch; j++; continue; }
      if (ch === '(') depth++;
      if (ch === ')') { depth--; if (depth === 0) { args.push(cur); break; } }
      if (ch === ',' && depth === 1) { args.push(cur); cur = ''; j++; continue; }
      cur += ch; j++;
    }
    function lits(t) { return (String(t).match(/'[^']*'/g) || []).map(function (x) { return x.slice(1, -1); }); }
    var k = lits(args[1] || '')[0] || '(none)';
    var sub = lits(args[2] || '')[0] || '(none)';
    kindCount[k] = (kindCount[k] || 0) + 1;
    subCount[sub] = (subCount[sub] || 0) + 1;
    if (sub === '(none)') unsub.push(f + ' :: ' + String(args[0] || '').replace(/\s+/g, ' ').slice(0, 56));
  }
});
console.log('kind 分布 = ' + JSON.stringify(kindCount, null, 0));
console.log('sub  分布 = ' + JSON.stringify(subCount, null, 0));
console.log('--- 无 sub 的调用点（' + unsub.length + ' 条，全部）---');
unsub.forEach(function (x) { console.log('  ' + x); });
process.exit(0);

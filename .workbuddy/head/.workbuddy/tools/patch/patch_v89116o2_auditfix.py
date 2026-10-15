# -*- coding: utf-8 -*-
"""v89.116 补丁 O2：audit.js ⑥ 节 —— 补本地 stripComment + 扩全模块扫描清单"""
import io, os, sys

R = 'E:/Deepseekdb/'
P = R + 'audit.js'
a = io.open(P, encoding='utf-8').read()

OLD = """const refSrc = {};
let refAll = '';
MODULES.forEach(m => {
  const p = path.join(__dirname, 'js', m + '.js');
  refSrc[m] = stripComment(fs.readFileSync(p, 'utf8'));
  refAll += refSrc[m] + '\\n';
});"""
NEW = """/* 本节的模块清单**独立于①的 MODULES**：引用扫描要把 tactic / gicons / bitmaps /
   portraits 也算进来（它们也是 GAME.* 的生产者与消费者）。 */
const REF_MODULES = ['data', 'state', 'questdata', 'systems', 'domain', 'map', 'battle', 'tactic',
  'icons', 'gicons', 'bitmaps', 'portraits', 'story', 'ui', 'main'];
/* 剥注释（audit.js 里没有共用版；注释里提到旧名不应算引用 —— 本项目踩过多次） */
const stripC = s => s.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^[ \\t]*\\/\\/.*$/gm, '');
const refSrc = {};
let refAll = '';
REF_MODULES.forEach(m => {
  const p = path.join(__dirname, 'js', m + '.js');
  refSrc[m] = stripC(fs.readFileSync(p, 'utf8'));
  refAll += refSrc[m] + '\\n';
});"""
if a.count(OLD) != 1:
    print('!! 锚点 %d' % a.count(OLD)); sys.exit(1)
a = a.replace(OLD, NEW, 1)
# 报表里的模块名也换成 REF_MODULES（否则 tactic.js 的命中点打不出来）
OLD2 = """    MODULES.forEach(m => {
      const i = refSrc[m].indexOf(full);
      if (i >= 0 && at.length < 2) at.push(m + '.js:' + (refSrc[m].slice(0, i).split('\\n').length));
    });"""
NEW2 = """    REF_MODULES.forEach(m => {
      const i = refSrc[m].indexOf(full);
      if (i >= 0 && at.length < 2) at.push(m + '.js:' + (refSrc[m].slice(0, i).split('\\n').length));
    });"""
if a.count(OLD2) != 1:
    print('!! 报表锚点 %d' % a.count(OLD2)); sys.exit(1)
a = a.replace(OLD2, NEW2, 1)

tmp = P + '.tmp116o2'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(a)
os.replace(tmp, P)
print('  → 落盘 audit.js')

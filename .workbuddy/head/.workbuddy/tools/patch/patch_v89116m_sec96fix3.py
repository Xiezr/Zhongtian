# -*- coding: utf-8 -*-
"""v89.116 §96 修正（三）：btRoundLine 返回行文本（可测）+ 两条判据按"源码可查的事实"重写"""
import io, os, sys

# ---------- ① 源码：btRoundLine 返回行文本（顺带让调用方也能复用） ----------
P1 = 'E:/Deepseekdb/js/ui.js'
s = io.open(P1, encoding='utf-8').read()
OLD = """    var line = '第 ' + ((r && r.r) || 0) + ' 回合　[我] ' + sideTxt('atk') + '　｜　[敌] ' + sideTxt('def')
      + '　·　间距 ' + U.numText((r && r.gap) || 0, 0);
    ui.btLogPush(line, 'round');
  };"""
NEW = """    var line = '第 ' + ((r && r.r) || 0) + ' 回合　[我] ' + sideTxt('atk') + '　｜　[敌] ' + sideTxt('def')
      + '　·　间距 ' + U.numText((r && r.gap) || 0, 0);
    ui.btLogPush(line, 'round');
    return line;                              /* 返回文本：调用方/断言可直接读（不必赌 DOM） */
  };"""
if s.count(OLD) != 1:
    print('!! btRoundLine 锚点 %d' % s.count(OLD)); sys.exit(1)
s = s.replace(OLD, NEW, 1)
b = io.open('E:/Deepseekdb/.workbuddy/backup/v89116/ui.js', encoding='utf-8').read()
if (s.count('{') - s.count('}')) != (b.count('{') - b.count('}')):
    print('!! ui.js 花括号净变化'); sys.exit(1)
tmp = P1 + '.tmp116q'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s); os.replace(tmp, P1)
print('  ✓ ui.js btRoundLine 返回文本')

# ---------- ② §96 三处判据重写 ----------
P2 = 'E:/Deepseekdb/smoke-test.js'
t = io.open(P2, encoding='utf-8').read()
FIX = [
    ("""      return /data-action="bt-stance"/.test(body) && /<option value="advance"/.test(body)
        && /data-action="bt-target"/.test(body)
        && body.indexOf('bt-btn') < 0""",
     """      /* ⚠️ 选项值是**循环拼出来的**（`value="' + s + '"`）—— 不能查字面量
         `<option value="advance"`；查"三个动作的数组在册 + 落到 select 上"。 */
      return /data-action="bt-stance"/.test(body)
        && /\\['advance', 'hold', 'retreat'\\]\\.map/.test(body)
        && /data-action="bt-target"/.test(body)
        && body.indexOf('bt-btn') < 0"""),
    ("""      var line = G.ui.btRoundLine(r, snap);        /* 推入 bt-log 并返回 undefined → 读 DOM */
      var log = global.document.getElementById('bt-log');
      var txt = log ? (log.textContent || '') : '';
      /* ⚠️ 冒烟桩的 DOM 元素没有 children —— "行数"只在真实 DOM 里量得准
         （e2e 那边量的是真 DOM），这里就"桩能力"给判据：有孩子数孩子，没孩子看文字。 */
      var lines = (log && log.children && typeof log.children.length === 'number')
        ? log.children.length : 1;
      return /第 3 回合/.test(txt) && /\\[我\\]/.test(txt) && /\\[敌\\]/.test(txt)
        && /进 200/.test(txt) && /歼 30/.test(txt) && /歼 12/.test(txt)
        && /间距 600/.test(txt) && lines === 1;      /* 三个事件 = 一行 */""",
     """      /* v89.116：`btRoundLine` **返回**这一行的文本（并顺手推入 bt-log）——
         断言直接读返回值，不赌冒烟桩的 DOM 有没有 children。 */
      var one = G.ui.btRoundLine(r, snap);
      var two = G.ui.btRoundLine({ r: 4, gap: 300, events: [] }, snap);
      return typeof one === 'string'
        && /第 3 回合/.test(one) && /\\[我\\]/.test(one) && /\\[敌\\]/.test(one)
        && /进 200/.test(one) && /歼 30/.test(one) && /歼 12/.test(one)
        && /间距 600/.test(one)
        && one.indexOf('\\n') < 0                      /* 一行：不含换行 */
        && /第 4 回合/.test(two) && /待命/.test(two);"""),
    ("""    check('⑨ 每个参战兵种都至少有一条克制关系（后勤/器械除外）', (function () {
      var T = D96.TROOPS, miss = [];
      Object.keys(T).forEach(function (id) {
        var t = T[id];
        if (t.nocombat || t.craft) return;
        var has = !!(D96.COUNTER_ATK[id] || D96.COUNTER_DEF[id]);
        /* 或者"被别人克"（出现在他人的表里）也算有位置 */
        var inOther = false;
        [D96.COUNTER_ATK, D96.COUNTER_DEF].forEach(function (tbl) {
          Object.keys(tbl).forEach(function (k) { if (tbl[k][id]) inOther = true; });
        });
        if (!has && !inOther) miss.push(id);
      });
      if (miss.length) console.log('      无任何克制关系：' + miss.join('、'));
      return miss.length === 0;
    })());""",
     """    check('⑨ **高战力 + 零克制**的漏网之鱼：零（象兵那种"无弱点"的兵种不存在了）', (function () {
      /* 判据（老板要的是"没有无弱点的兵种"，不是"每支都必须在克制表里"）：
         每人口攻击 ≥170 **且** 每人口有效生命 ≥4000 = "高战力档"（铁骑/西凉铁骑/象兵这一档）——
         这一档必须至少有一条克制关系（自己克人、或被人克）。
         低战力兵种（义兵 / 民夫 / 特殊州兵）不在此判据内：它们的取舍在成本与门槛上，
         实测（probe_v89116_stats）：义兵 vs 长枪 5 回合全灭只换 17 人，本就不需要额外克制。 */
      var T = D96.TROOPS, bad = [], noRel = [];
      Object.keys(T).forEach(function (id) {
        var t = T[id];
        if (t.nocombat || t.craft) return;
        var has = !!(D96.COUNTER_ATK[id] || D96.COUNTER_DEF[id]);
        var inOther = false;
        [D96.COUNTER_ATK, D96.COUNTER_DEF].forEach(function (tbl) {
          Object.keys(tbl).forEach(function (k) { if (tbl[k][id]) inOther = true; });
        });
        if (!has && !inOther) noRel.push(id);
        var strong = (t.atk / t.pop) >= 170 && (t.hp * (1 + t.def / 300)) / t.pop >= 4000;
        if (strong && !has && !inOther) bad.push(id);
      });
      console.log('      无克制关系的兵种（低战力档，取舍在成本/门槛）：'
        + (noRel.join('、') || '无'));
      if (bad.length) console.log('      高战力却零克制：' + bad.join('、'));
      return bad.length === 0;
    })());"""),
]
for i, (old, new) in enumerate(FIX):
    n = t.count(old)
    if n != 1:
        print('!! 修正 %d 匹配 %d 次 → 中止' % (i + 1, n)); sys.exit(1)
    t = t.replace(old, new, 1)
    print('  ✓ §96 修正 %d' % (i + 1))
b2 = io.open('E:/Deepseekdb/.workbuddy/backup/v89116/smoke-test.js', encoding='utf-8').read()
d0 = (t.count('{') - t.count('}')) - (b2.count('{') - b2.count('}'))
print('  花括号净变化 %+d' % d0)
tmp2 = P2 + '.tmp116p'
io.open(tmp2, 'w', encoding='utf-8', newline='\n').write(t); os.replace(tmp2, P2)
print('  → 落盘 smoke-test.js')

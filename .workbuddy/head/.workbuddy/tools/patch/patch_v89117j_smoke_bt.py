# -*- coding: utf-8 -*-
"""v89.117 补丁 H1 —— 两条 v89.116 战斗界面断言升级到新口径（需求 7）

① 三列配比：1fr 2fr 1fr（各 1/4、中 1/2）→ **1fr 4fr 1fr**（各 1/6、中 2/3）
② 播报：v89.116 是"一回合一行"（返回字符串），
   v89.117 改成"逐兵种一行 + 回合头 + 虚线"（返回**行数组**）——
   判据随之升级为：行数 = 兵种数、每行含该兵种的移动与战斗、按出手序缩进、回合头在册。
"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

OLD1 = """    check('⑧ 上部分三列：左右各 1/4、中间 1/2（CSS grid 1fr 2fr 1fr）', (function () {
      return /\\.bt-board \\{ display: grid; grid-template-columns: 1fr 2fr 1fr;/.test(h96)
        && /ui\\.btBoardHTML = function/.test(u96)
        && /ui\\.btSideHTML\\(snap, 'atk'\\) \\+ ui\\.btFieldHTML\\(snap\\) \\+ ui\\.btSideHTML\\(snap, 'def'\\)/.test(u96);
    })());"""
NEW1 = """    check('⑧ 上部分三列：左右各 1/6、中间 2/3（CSS grid 1fr 4fr 1fr · v89.117 再压缩）', (function () {
      return /\\.bt-board \\{ display: grid; grid-template-columns: 1fr 4fr 1fr;/.test(h96)
        && /ui\\.btBoardHTML = function/.test(u96)
        && /ui\\.btSideHTML\\(snap, 'atk'\\) \\+ ui\\.btFieldHTML\\(snap\\) \\+ ui\\.btSideHTML\\(snap, 'def'\\)/.test(u96);
    })());"""
if s.count(OLD1) != 1:
    print('!! 段 1 匹配 %d' % s.count(OLD1)); sys.exit(1)
s = s.replace(OLD1, NEW1, 1)
print('  ✓ 段 1 三列配比')

# ---- ② 播报：整段替换（切片定位，避免长锚点写坏） ----
START = "    check('⑧ 战况播报：下部、**一回合一行**（行动与战果同行）', (function () {"
a = s.find(START)
if a < 0:
    print('!! 定位不到播报断言'); sys.exit(1)
b = s.find("\n    })());", a)
if b < 0:
    print('!! 定位不到断言结尾'); sys.exit(1)
b += len("\n    })());")
NEW2 = """    check('⑧ 战况播报：下部、**逐兵种一行**（移动与战斗同行 · 按出手序错开 · 回合间虚线）', (function () {
      var snap = { field: 1400, atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 400 }],
        def: [{ id: 'yibing', name: '义兵', count: 50, adv: 100 }], towers: null };
      var r = { r: 3, gap: 600, events: [
        { kind: 'move', side: 'atk', id: 'changqiang', name: '长枪兵', step: 200, gap: 800 },
        { kind: 'attack', side: 'atk', id: 'changqiang', name: '长枪兵', target: '义兵', kill: 30, targetId: 'yibing' },
        { kind: 'attack', side: 'def', id: 'yibing', name: '义兵', target: '长枪兵', kill: 12, targetId: 'changqiang' }
      ] };
      /* v89.117（老板「每兵种各一行，移动与战斗动作放在同一行，根据出手时间先后，行数错开」）：
         `ui.btRoundLines` 返回**结构化行数组**（side/cls/name/txt/indent）——
         唯一出口：界面按它落 DOM，断言直接读它（不赌 DOM）。 */
      var lines = G.ui.btRoundLines(r, snap);
      var L0 = lines[0] || {}, L1 = lines[1] || {};
      var allTxt = lines.map(function (x) { return x.txt; }).join(' | ');
      /* 三个动作**都在**（没有丢事件），且兵种数 = 2 行（不是"一回合一行"） */
      var okShape = lines.length === 2
        && /长枪兵/.test(L0.txt) && /进 200/.test(L0.txt) && /歼 30/.test(L0.txt)
        && L0.cls === 'atk' && L0.indent === 0
        && /义兵/.test(L1.txt) && /歼 12/.test(L1.txt)
        && L1.cls === 'def' && L1.indent > 0            /* 后出手的错开一行 */
        && /\\[我\\]/.test(allTxt) && /\\[敌\\]/.test(allTxt)
        && lines.every(function (x) { return x.txt.indexOf('\\n') < 0; });
      /* 落 DOM：虚线 + 回合头 + 逐兵种行（btRoundLine 兼容出口仍返回文本数组） */
      var ret = G.ui.btRoundLine(r, snap);
      var src = fs96.readFileSync(path96.join(__dirname, 'js', 'ui.js'), 'utf8');
      var okLog = Array.isArray(ret) && ret.length === 2
        && /\\.bt-ev\\.sep \\{ height: 0; border-top: 1px dashed/.test(h96)
        && /ui\\.btLogPush\\('', 'sep'\\)/.test(src)
        && /'第 ' \\+ \\(\\(r && r\\.r\\) \\|\\| 0\\) \\+ ' 回合/.test(src);
      /* 阵亡变暗：初绘与同步两条路都要有（老板「兵种数量降为 0，战场上的兵种图标变暗」） */
      var okDim = /\\(u\\.count > 0 \\? '' : ' dead'\\)/.test(u96)
        && /#bt-field \\[data-bside="' \\+ pair\\[0\\] \\+ '"\\]\\[data-troop=/.test(u96)
        && /\\.bt-unit\\.dead \\{ opacity: \\.26;/.test(h96);
      return okShape && okLog && okDim;
    })());"""
s = s[:a] + NEW2 + s[b:]
print('  ✓ 段 2 播报断言升级')

tmp = P + '.tmp117h1'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('补丁 H1 完成')

# -*- coding: utf-8 -*-
"""v89.109 收尾：data-tside 改名（避 audit 的 data-side 约定）+ 在途"再出征"入口 + 断言更新"""
import io, os
# ① ui.js：data-side → data-tside（audit 规定 data-side 必须由 case 'side' 分发）
pu = r'E:/Deepseekdb/js/ui.js'
u = io.open(pu, encoding='utf-8').read()
a1 = "      ' data-side=\"' + side + '\"' +"
b1 = "      ' data-tside=\"' + side + '\"' +      /* 不用 data-side：audit 约定它由 case 'side' 分发 */"
assert a1 in u, '①a 未命中'
u = u.replace(a1, b1, 1)
a2 = "        '<button class=\"btn\" data-action=\"tactic-reset\" data-side=\"' + side + '\">恢复默认</button>' +"
b2 = "        '<button class=\"btn\" data-action=\"tactic-reset\" data-tside=\"' + side + '\">恢复默认</button>' +"
assert a2 in u, '①b 未命中'
u = u.replace(a2, b2, 1)

# ② ui.js：在途表加"再出征"（exp-go 的新入口）
a3 = """    var ms = (s.marches || []).map(function (m) {
      return '<tr><td>' + U.escape(m.name) + '</td><td>' + U.escape(m.modeId) + '</td>' +
        '<td class="num">' + U.numText(GAME.armyTotal({ army: m.army }), 0) + '</td>' +
        '<td class="ctr"><button class="btn sm" data-action="march-rush" data-id="' + m.id + '">急行军</button>' +
        '<button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td></tr>';
    }).join('');"""
b3 = """    var ms = (s.marches || []).map(function (m) {
      /* v89.109：行首给「再出征」—— 对**同一目标**再派一队（多波围攻的常用动作）。
         这也是 `exp-go` 动作的入口（原先挂在已退役的"近处可打"列表上）。 */
      var reBtn = '';
      if (m.kind === 'fort') {
        reBtn = '<button class="btn sm" data-action="exp-go" data-kind="fort" data-x="' + m.tx
          + '" data-y="' + m.ty + '">再出征</button>';
      } else if (m.kind === 'city' && m.target && m.target.id) {
        reBtn = '<button class="btn sm" data-action="exp-go" data-kind="city" data-id="'
          + m.target.id + '">再出征</button>';
      }
      return '<tr><td>' + U.escape(m.name) + '</td><td>' + U.escape(m.modeId) + '</td>' +
        '<td class="num">' + U.numText(GAME.armyTotal({ army: m.army }), 0) + '</td>' +
        '<td class="ctr">' + reBtn +
        '<button class="btn sm" data-action="march-rush" data-id="' + m.id + '">急行军</button>' +
        '<button class="btn sm red" data-action="march-recall" data-id="' + m.id + '">召回</button></td></tr>';
    }).join('');"""
assert a3 in u, '② 未命中'
u = u.replace(a3, b3, 1)
io.open(pu + '.tmp', 'w', encoding='utf-8', newline='').write(u)
os.replace(pu + '.tmp', pu)
print('ui.js 收尾完成')

# ③ main.js：dataset.side → dataset.tside
pm = r'E:/Deepseekdb/js/main.js'
m = io.open(pm, encoding='utf-8').read()
a4 = "        var tSide = el.dataset.side === 'def' ? 'def' : 'atk';"
b4 = "        var tSide = el.dataset.tside === 'def' ? 'def' : 'atk';"
assert a4 in m, '③a 未命中'
m = m.replace(a4, b4, 1)
a5 = "        var rSide = el.dataset.side === 'def' ? 'def' : 'atk';"
b5 = "        var rSide = el.dataset.tside === 'def' ? 'def' : 'atk';"
assert a5 in m, '③b 未命中'
m = m.replace(a5, b5, 1)
io.open(pm + '.tmp', 'w', encoding='utf-8', newline='').write(m)
os.replace(pm + '.tmp', pm)
print('main.js 收尾完成')

# ④ smoke：战术弹窗断言更新（分侧 + 唯一渲染口）
ps = r'E:/Deepseekdb/smoke-test.js'
s = io.open(ps, encoding='utf-8').read()
a6 = """check('战术弹窗：每兵种有动作 + 目标（含箭塔），且点选即存、不重绘', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openTacticModal = function');
  if (seg.length < 500) return false;
  return /data-action="tactic-set"/.test(u)
    && /GAME\\.tacticOf\\('atk', id\\)/.test(seg)
    && /DATA\\.TARGET_WALL/.test(seg) && /DATA\\.STANCES\\.map/.test(seg)
    && /ui\\.modalPage\\('tactic'/.test(seg);
})());"""
b6 = """check('战术弹窗：每兵种有动作 + 目标（含箭塔）· **分侧**（v89.109）', (function () {
  var u = fsMod.readFileSync(pathMod.join(__dirname, 'js', 'ui.js'), 'utf8');
  var seg = codeOf(u, 'ui.openTacticModal = function');
  var blk = codeOf(u, 'ui.tacticBlockOf = function');
  if (seg.length < 400 || blk.length < 400) return false;
  return /data-action="tactic-set"/.test(u)
    && /ui\\.tacticBlockOf\\(side, id\\)/.test(seg)          /* 唯一渲染口 */
    && /ui\\.modalPage\\('tactic' \\+ side/.test(seg)          /* 分侧分页键 */
    && /DATA\\.TARGET_WALL/.test(blk) && /DATA\\.STANCES\\.map/.test(blk)
    && /sortie/.test(blk);                                /* 防守侧的出城迎战开关 */
})());"""
assert a6 in s, '④ 未命中'
s = s.replace(a6, b6, 1)
io.open(ps + '.tmp', 'w', encoding='utf-8', newline='').write(s)
os.replace(ps + '.tmp', ps)
print('smoke 断言已更新')

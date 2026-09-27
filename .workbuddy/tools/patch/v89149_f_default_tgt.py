# -*- coding: utf-8 -*-
"""v89.149 批 F：默认目标 = 同兵种（引擎层，两侧同规）
① data.js：DATA.TARGET_ANY 哨兵（战术页"任意"）
② tactic.js unitsOf：未指定 → tgt = id；哨兵 → 空（显式任意）
③ ui.js 战术面板：补「任意」选项（保住既有能力）④ 侧栏名称列不再抢宽（flex 0 0 auto）"""
import io

PD = 'E:/Deepseekdb/js/data.js'
PT = 'E:/Deepseekdb/js/tactic.js'
PU = 'E:/Deepseekdb/js/ui.js'
PH = 'E:/Deepseekdb/index.html'
BD = 'E:/Deepseekdb/backup/v89149/data.js.before'
BT = 'E:/Deepseekdb/backup/v89149/tactic.js.before'
BU = 'E:/Deepseekdb/backup/v89149/ui.js.before'
BH = 'E:/Deepseekdb/backup/v89149/index.html.before'


def load(p):
    return io.open(p, encoding='utf-8', newline='').read()


files = {}
for key, p, b in [('data', PD, BD), ('tactic', PT, BT), ('ui', PU, BU), ('html', PH, BH)]:
    files[key] = [load(p), load(b)]


def rep(key, old, new, tag, cnt=1):
    s = files[key][0]
    if new in s and old not in s:
        print('SKIP(已落) ' + tag)
        return
    n = s.count(old)
    assert n == cnt, '锚点数不对 [' + tag + '] count=' + str(n) + ' 期望=' + str(cnt)
    files[key][0] = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 哨兵 ----------
rep('data', """  DATA.TARGET_WALL = '_tower';""",
    """  DATA.TARGET_WALL = '_tower';
  /* v89.149（老板 4）：目标哨兵「任意」——
     引擎的默认目标从"任意"改成"**同兵种**"之后，想显式表达**不指定目标（打最近的）**
     需要一个不同于空串的值（空串现在 = 未设 → 默认同兵种）。
     战术页的"任意"写这个值；`tactic.unitsOf` 见到它就还原成空串（= 引擎的"自动选靶"）。
     与 TARGET_WALL 同一族（下划线前缀 = 引擎哨兵，不会与兵种 id 撞名）。 */
  DATA.TARGET_ANY = '_any';""", 'TARGET_ANY')

# ---------- ② unitsOf 默认同兵种 ----------
rep('tactic', """      var tgt = tc ? (tc.t || '') : '';
      if (!tgt && ctx && ctx.foeArmy && (ctx.foeArmy[id] || 0) > 0) tgt = id;""",
    """      /* v89.149（老板 4）：「行动和目标设置的下拉框，**默认显示前进和同兵种**，比如开局都是前进，
         **弓箭兵打弓箭兵，轻骑兵打轻骑兵**」——
         v89.116 只给 NPC 一侧这个默认；本版**两侧同规**：未指定目标 → 默认打**对面同名兵种**
         （对面没有该兵种时，选靶逻辑会自然回落到"最近的敌队"，不需要额外兜底）。
         `DATA.TARGET_ANY`（战术页的「任意」）= **显式不指定** → 还原成空串（打最近的）。
         ⚠️ 必须落在**引擎**里（而不是界面）：默认值要进 `unitsInit`，战报沙盘从它重跑 ——
            放界面 = 史实与重跑不同源（v89.116 §20.5 的教训）。 */
      var tgt = tc ? (tc.t || '') : '';
      if (tgt === DATA.TARGET_ANY) tgt = '';
      else if (!tgt) tgt = id;""", 'unitsOf 默认同兵种')

# ---------- ③ 战术面板：补「任意」选项 ----------
rep('ui', """    var tgt = [{ v: '', label: '自动' }].concat(ids.map(function (x) {
      return { v: x, label: DATA.TROOPS[x].name };
    })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);""",
    """    /* v89.149（老板 4）：默认目标 = 同兵种（引擎层），战术页的「自动」即此义；
       「任意」= 显式不指定（哨兵 DATA.TARGET_ANY）—— 保住"打最近的"这条既有能力。 */
    var tgt = [{ v: '', label: '自动（同兵种）' }]
      .concat([{ v: DATA.TARGET_ANY, label: '任意（打最近）' }])
      .concat(ids.map(function (x) {
        return { v: x, label: DATA.TROOPS[x].name };
      })).concat([{ v: DATA.TARGET_WALL, label: '⚙️ ' + DATA.WALL_TOWER.name }]);""", '战术页任意选项')

# ---------- ④ 侧栏名称列不再抢宽 ----------
rep('html', """  .bt-l1 .bt-rnm { flex: 1 1 auto; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);""",
    """  /* v89.149（老板 3）：名称已一字化 → **不再抢宽**（flex 0 0 auto），整份宽度让给两个下拉
     （改前实测：格子 105px，名字抢走 49px，两个下拉只剩 42/57px）。 */
  .bt-l1 .bt-rnm { flex: 0 0 auto; min-width: 0; font-size: var(--fs-cap); color: var(--text-dim);""",
    'rnm flex')
rep('html', """  .bt-card .bt-rnm { max-width: none; flex: 1 1 auto; }""",
    """  .bt-card .bt-rnm { max-width: none; flex: 0 0 auto; }""", 'rnm flex(卡片)')

# 写后哨兵
assert files['data'][0].count('DATA.TARGET_ANY =') == 1
assert files['tactic'][0].count('else if (!tgt) tgt = id;') == 1
assert '自动（同兵种）' in files['ui'][0]
assert '.bt-l1 .bt-rnm { flex: 0 0 auto;' in files['html'][0]
for k in files:
    s, b = files[k]
    assert (s.count('{') - s.count('}')) == (b.count('{') - b.count('}')), k + ' 花括号盈亏不一致'
    assert '\r\n' not in s, k + ' 行尾被写成 CRLF'
io.open(PD, 'w', encoding='utf-8', newline='').write(files['data'][0])
io.open(PT, 'w', encoding='utf-8', newline='').write(files['tactic'][0])
io.open(PU, 'w', encoding='utf-8', newline='').write(files['ui'][0])
io.open(PH, 'w', encoding='utf-8', newline='').write(files['html'][0])
print('批 F 落盘（data/tactic/ui/index）')

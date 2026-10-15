# -*- coding: utf-8 -*-
"""v89.36：军粮口径改造（老板「维持军队无需耗粮食，相应招募提供耗粮3倍」）

改动面：
  · js/data.js    兵种 food 字段移除 ×18；cost.grain ×3 ×18；DATA.STARVE 退役；
                  四季/天气 feed 字段移除；POWER.resToTroop 口径同步；注释订正
  · js/state.js   在线/离线两处军粮扣减移除；foodPerSecOf/foodPerSec/mutinyOf/
                  starveStep/isStarving 整体退役
  · js/story.js   移除 STORY.feedMult
  · js/battle.js  移除出征"断粮门槛"
  · js/ui.js      驻军耗粮列移除；断粮警示移除；兵种悬停去掉耗粮；
                  出征总览去掉"耗粮 X/时"；顺手修复：烽火预警 IIFE 与拼接链脱节
  · index.html    驻军行 CSS 改两列（耗粮列样式移除）
  · audit.js      检查清单同步（STORY 函数表去 feedMult；天气字段表去 feed）

只动上述文件；测试与文档由后续补丁处理。
"""
import io, os, re, sys

R = r'E:\Deepseekdb'
NL = '\n'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8936'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def eol_of(p):
    raw = io.open(p, 'rb').read()
    crlf = raw.count(b'\r\n')
    lf = raw.count(b'\n') - crlf
    return '\r\n' if crlf > lf else '\n'


def edit(p, old, new, tag):
    src = read(p)
    eol = eol_of(p)
    o = old.replace('\n', eol)
    n = new.replace('\n', eol)
    k = src.count(o)
    if k != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, k)); sys.exit(1)
    write(p, src.replace(o, n, 1))
    back = read(p)
    assert n in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


def cut(p, start, end, repl, tag):
    src = read(p)
    eol = eol_of(p)
    s = start.replace('\n', eol)
    e = end.replace('\n', eol)
    r = repl.replace('\n', eol)
    i = src.find(s)
    if i < 0:
        print('FAIL [%s] 找不到起点' % tag); sys.exit(1)
    j = src.find(e, i)
    if j < 0:
        print('FAIL [%s] 找不到终点' % tag); sys.exit(1)
    write(p, src[:i] + r + src[j + len(e):])
    back = read(p)
    assert r in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


D = R + r'\js\data.js'
S = R + r'\js\state.js'
B = R + r'\js\battle.js'
U = R + r'\js\ui.js'
ST = R + r'\js\story.js'
H = R + r'\index.html'
A = R + r'\audit.js'

# ============================================================
# 1) js/data.js
# ============================================================
edit(D,
     u' * 单位约定：产量/耗粮/俸禄 = 每小时；时间 = 游戏秒（受 TIME_SCALE 倍率影响）',
     u' * 单位约定：产量/俸禄 = 每小时；时间 = 游戏秒（受 TIME_SCALE 倍率影响）',
     'data.js 头部单位约定')

edit(D,
     u'''   * 兵种（18种 · 报告8.1/8.2/8.3：hp/atk/def/射程/速度/负重/耗粮h/人口/训练秒）
   * ============================================================ */''',
     u'''   * 兵种（18种 · 报告8.1/8.2/8.3：hp/atk/def/射程/速度/负重/人口/训练秒）
   * ------------------------------------------------------------
   * v89.36（老板「维持军队无需耗粮食，相应招募提供耗粮3倍」）：
   *   · 每兵每小时耗粮（food）与「军队维持耗粮」整体退役（缺粮/哗变一并下线）；
   *   · 粮改为**成军一次性消耗** —— 全部兵种 cost.grain ×3。
   * ============================================================ */''',
     'data.js 兵种头注')

# 1a. 去掉 18 处 food 字段（限 DATA.TROOPS 块内）
src = read(D)
i0 = src.index('DATA.TROOPS = {')
i1 = src.index('\n  };', i0)
block = src[i0:i1]
n = len(re.findall(r'food: \d+,\s*', block))
if n != 18:
    print('FAIL food 字段命中 %d（期望 18）' % n); sys.exit(1)
block2 = re.sub(r'food: \d+,\s*', '', block)
assert 'food:' not in block2
write(D, src[:i0] + block2 + src[i1:])
print('OK  data.js 移除 18 处 food 字段')

# 1b. cost.grain ×3（限 DATA.TROOPS 块内）
src = read(D)
i0 = src.index('DATA.TROOPS = {')
i1 = src.index('\n  };', i0)
block = src[i0:i1]
cnt = len(re.findall(r'(cost: \{ grain: )(\d+)', block))
if cnt != 18:
    print('FAIL cost.grain 命中 %d（期望 18）' % cnt); sys.exit(1)
block2 = re.sub(r'(cost: \{ grain: )(\d+)', lambda m: m.group(1) + str(int(m.group(2)) * 3), block)
write(D, src[:i0] + block2 + src[i1:])
print('OK  data.js 募兵耗粮 ×3（18 处）')

# 1c. DATA.STARVE 退役
edit(D,
     u'''  /* ============================================================
   * 缺粮哗变（v65 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「缺粮 24h 后军队才会哗变，各兵种每 24h 逃离当前剩余数量的 20%」
   *
   * 改前是"粮一断就按缺口比例逃兵"（最多 15%/tick）—— 断粮立刻掉兵，
   * 玩家来不及救；而且逃多少取决于"缺口占需求的比例"，是个说不清的公式。
   * 改后是一条能背下来的规则：**先饿满 24 游戏小时**，之后每满 24 小时逃 20%。
   *   累计计时挂在该城（`city.starveHours`），粮一旦接上就**清零重计**。
   * ============================================================ */
  DATA.STARVE = {
    hours: 24,          // 缺粮多少游戏小时开始哗变
    mutinyPct: 0.2,     // 每次哗变各兵种逃离当前数量的比例
  };''',
     u'''  /* v89.36（老板「维持军队无需耗粮食」）：缺粮哗变系统（DATA.STARVE /
     starveStep / mutinyOf / isStarving）随「军队维持耗粮」一并退役 ——
     军队不再吃粮，断粮与哗变失去触发条件；粮改为**募兵时一次性消耗**。 */''',
     'data.js 移除 DATA.STARVE')

# 1d. 四季 feed 移除 + 冬 desc 订正
edit(D,
     u'''    { id: 'spring', name: '春', desc: '春耕之时，粮产略增', grain: 0.10, feed: 1.00 },
    { id: 'summer', name: '夏', desc: '夏日方长，粮产更盛', grain: 0.15, feed: 1.05 },
    { id: 'autumn', name: '秋', desc: '秋收之际，粮产最丰', grain: 0.25, feed: 1.00 },
    { id: 'winter', name: '冬', desc: '冬寒地冻，粮产锐减、军粮多耗', grain: -0.35, feed: 1.30 },''',
     u'''    { id: 'spring', name: '春', desc: '春耕之时，粮产略增', grain: 0.10 },
    { id: 'summer', name: '夏', desc: '夏日方长，粮产更盛', grain: 0.15 },
    { id: 'autumn', name: '秋', desc: '秋收之际，粮产最丰', grain: 0.25 },
    { id: 'winter', name: '冬', desc: '冬寒地冻，粮产锐减', grain: -0.35 },''',
     'data.js 四季 feed 移除')

# 1e. 雪天 feed 移除 + desc 订正
edit(D,
     u"    snow: { id: 'snow', name: '雪', icon: '❄', grain: -0.30, feed: 0.30, fire: 0, ambush: 1, move: 0.50, weight: 12, desc: '大雪封道：粮产 −30%，军粮多耗 30%，行军 −50%，火攻失效' },",
     u"    snow: { id: 'snow', name: '雪', icon: '❄', grain: -0.30, fire: 0, ambush: 1, move: 0.50, weight: 12, desc: '大雪封道：粮产 −30%，行军 −50%，火攻失效' },",
     'data.js 雪天 feed 移除')

# 1f. POWER.resToTroop 口径同步（粮 80→240，折算分母 ×3）
edit(D,
     u'''    /* 以义兵单位成本(粮80/木100/铁50)为基准，除以资源种类数做加权平均，
       使"可动员战力"贴近实际能养多少兵，避免高估 */
    resToTroop: { grain: 1 / 240, wood: 1 / 300, iron: 1 / 150, stone: 1 / 500, gold: 1 / 400 },''',
     u'''    /* 以义兵单位成本(粮240/木100/铁50 · v89.36 募兵耗粮 ×3)为基准，
       除以资源种类数做加权平均，使"可动员战力"贴近实际能养多少兵，避免高估 */
    resToTroop: { grain: 1 / 720, wood: 1 / 300, iron: 1 / 150, stone: 1 / 500, gold: 1 / 400 },''',
     'data.js POWER 口径')

# 1g. NPC 城注释订正（footPerSecOf 已退役）
edit(D,
     u'''       它不在 `state.cities` 里 → 粮食结算（`GAME.foodPerSecOf`）永远扫不到它，
       所以"被占领前不消耗粮草"是**结构保证**的，不是靠不写代码。 */''',
     u'''       它不在 `state.cities` 里 → 从来不在任何粮食结算口径里（v89.36 起军队整体不耗粮，
       这条从"NPC 特例"变成了通例）。 */''',
     'data.js NPC 注释')

# 1h. 城外规划注释（粮的角色说明更新）
edit(D,
     u'   *   · 粮是养兵主线（见 AI工作备忘 §十五 阶梯复算：缺口卡在粮上）→ 农田恒占 1/3 上下；',
     u'   *   · 粮是养兵主线（v89.36 起"养"由维持耗粮改为**募兵一次性耗粮**，粮依然吃重）→ 农田恒占 1/3 上下；',
     'data.js 农田占比注释')

# ============================================================
# 2) js/state.js
# ============================================================
# 2a. 离线头注 + 声明行
edit(S,
     u'''    /* 资源与耗粮：**逐城**结算（v60 · 需求 4，与在线 tickOnce 同一口径） */
    var offlineFeedTotal = 0, offLostTotal = 0;''',
     u'''    /* 资源：**逐城**结算（v60 · 需求 4，与在线 tickOnce 同一口径）。
       v89.36（老板「维持军队无需耗粮食」）：军队维持耗粮已废除 ——
       离线补算不再扣军粮、不再推缺粮计时（缺粮哗变系统一并退役）。 */''',
     'state.js 离线头注')

# 2b. 离线扣粮块
cut(S,
    u'      var feedC = GAME.foodPerSecOf(ct);',
    u'      if (R.grain < 0) R.grain = 0;\n',
    u'      /* v89.36：军粮维持耗粮已废除（不再扣粮、不再缺粮计时）。 */\n',
    'state.js 离线扣粮块')

# 2c. _offlineStarved 写入点
edit(S,
     u'\n    if (offLostTotal > 0) GAME._offlineStarved = offLostTotal;',
     u'',
     'state.js 移除 _offlineStarved')

# 2d. 在线扣粮块
cut(S,
    u'    /* 2) 军队耗粮（真实：每兵每小时耗粮，出征×2）—— **逐城**扣本城的粮。',
    u'    s.starving = s.cities.some(function (ct) { return ct.starving; });',
    u'''    /* 2) 军队耗粮 —— v89.36（老板「维持军队无需耗粮食」）已废除：
       军队维持不再消耗粮草（粮改为**募兵时一次性消耗**，见 DATA.TROOPS.cost.grain ×3）；
       缺粮钳制 / 缺粮计时 / 哗变（原 v65 规则）随之整体退役。 */''',
    'state.js 在线扣粮块')

# 2e. foodPerSecOf / foodPerSec / mutinyOf / starveStep / isStarving 整体退役
cut(S,
    u'  /* 军队每秒耗粮 */',
    u'    return (R.grain || 0) <= 0 && GAME.foodPerSecOf(c) > prod;\n  };\n',
    u'''  /* v89.36（老板「维持军队无需耗粮食」）：军队维持耗粮整体退役 ——
     `foodPerSecOf` / `foodPerSec` / `mutinyOf` / `starveStep` / `isStarving`
     与 v65 缺粮哗变规则一并移除（军队不再吃粮，断粮没有触发条件）。
     粮改为**募兵时一次性消耗**（DATA.TROOPS.cost.grain ×3）。 */

''',
    'state.js 耗粮/哗变出口退役')

# ============================================================
# 3) js/story.js
# ============================================================
edit(ST,
     u'''  /* 天时对军粮消耗的乘数（冬季更耗粮） */
  STORY.feedMult = function () {
    var se = STORY.currentSeason(), we = STORY.currentWeather();
    var m = (se.feed || 1) * (1 + (we.feed || 0));
    return m;
  };

''',
     u'''  /* v89.36（老板「维持军队无需耗粮食」）：军粮维持耗粮退役 ——
     `STORY.feedMult`（天时对军粮的乘数）随之一并移除；四季/天气的 feed 字段同时下线。 */

''',
     'story.js 移除 feedMult')

# ============================================================
# 4) js/battle.js
# ============================================================
edit(B,
     u'''    /* 断粮门槛：军无粮草不出兵（粮草系统此前只有「扣」没有「拦」）。
       仅在「存粮为 0 且消耗大于产出」时拦截，避免临时缺粮就完全动不了。
       放在目标解析**之前** —— 粮尽是对全军状态的判断，与打哪里无关。 */
    if (!opts.arrived && GAME.isStarving && GAME.isStarving()) {
      return { ok: false, msg: '粮尽，士卒饥疲，无法出征 —— 宜增产粮草、掠夺敌粮或裁减军伍' };
    }

''',
     u'''    /* v89.36（老板「维持军队无需耗粮食」）：断粮门槛随军粮维持一并退役 ——
       军队不再吃粮，出征不再有"粮尽"拦截（缺粮哗变系统同时移出）。 */

''',
     'battle.js 断粮门槛退役')

# ============================================================
# 5) js/ui.js
# ============================================================
# 5a. 驻军栏头注
edit(U,
     u'   * 固定在资源栏下方、固定高度；列出当前城池各兵种数量与耗粮，',
     u'   * 固定在资源栏下方、固定高度；列出当前城池各兵种数量（v89.36 起耗粮列退役），',
     'ui.js 驻军头注')

# 5b. 驻军 feed 统计
edit(U,
     u'''    var total = 0, feed = 0;
    ids.forEach(function (k) {
      total += c.army[k];
      feed += (DATA.TROOPS[k] ? DATA.TROOPS[k].food : 0) * c.army[k];
    });
    var open = ui._garrisonOpen !== false;''',
     u'''    var open = ui._garrisonOpen !== false;''',
     'ui.js 驻军 feed 统计移除')

# 5c. 驻军 v65 注释 + 行模板
edit(U,
     u'''       城名在上方「城池属性」栏已有，总数与种类在下面的明细里逐行可见，
       总体耗粮自己加也行（明细每行都写着）。标题只留两个字。
       ⚠️ `total` / `feed` 仍在算 —— 它们是明细行的数据源，只是不再上标题。 */''',
     u'''       城名在上方「城池属性」栏已有，数量在下面的明细里逐行可见。标题只留两个字。
       v89.36：军粮维持退役，明细的「耗粮」列一并移除（原来那两列而今只剩数量一列）。 */''',
     'ui.js 驻军注释')

edit(U,
     u'''            return '<div class="gb-row"><span class="gb-n">' + (t ? t.name : k) + '</span>' +
              '<span class="gb-c">' + U.numText(c.army[k], 0) + '</span>' +
              '<span class="gb-f">-' + U.numText((t ? t.food : 0) * c.army[k], 0) + '/h</span></div>';''',
     u'''            return '<div class="gb-row"><span class="gb-n">' + (t ? t.name : k) + '</span>' +
              '<span class="gb-c">' + U.numText(c.army[k], 0) + '</span></div>';''',
     'ui.js 驻军行模板')

# 5d. 断粮警示退役（同时把后面"烽火预警"IIFE 接回 html 链 —— 此前它被 ; 断链、横幅从未上屏）
cut(U,
    u'      /* 断粮警示（v65 老板改了规则）：粮尽**不会立刻**掉兵 ——',
    u"'宜速运粮入城、增产粮草，或裁减军伍。</div>';\n      })();\n",
    u'      /* v89.36：断粮警示随军粮维持退役（军队不再吃粮，不存在"粮尽"状态）；\n'
    u'         原先它后面的"烽火预警"IIFE 因拼接符被打断、返回串被丢弃 —— 接回后横幅恢复显示。 */\n',
    'ui.js 断粮警示退役+烽火接链')

# 5e. 烽火预警注释订正
edit(U,
     u'''      /* 定期来袭警示（第 2 期 · 防守）—— 与断粮警示**同一个 `.note-warn`**，
         不新增 CSS、不新增板块，只在「已有排期」时渲染。
         项目规矩：新机制上线，它的输出值要能被看见（否则玩家永远不知道
         自己在被谁打、还有多久、守不守得住）。''',
     u'''      /* 定期来袭警示（第 2 期 · 防守）—— 复用 `.note-warn` 样式，
         不新增 CSS、不新增板块，只在「已有排期」时渲染。
         项目规矩：新机制上线，它的输出值要能被看见（否则玩家永远不知道
         自己在被谁打、还有多久、守不守得住）。
         v89.36 顺带修复：本段此前与拼接链**脱节**（返回串被丢弃、横幅从未上屏），
         借断粮警示退役之机接回 `html` 链 —— 现在预警真的会显示。''',
     'ui.js 烽火注释订正')

# 5f. 兵种悬停去掉"耗粮"
edit(U,
     u'''      var costStr = GAME.costString(t.cost) + '</div><div class="tip-l">人口 ' + t.pop +
        ' · 耗粮 ' + t.food + '/h · 单兵耗时 ' + U.dur(t.time);''',
     u'''      var costStr = GAME.costString(t.cost) + '</div><div class="tip-l">人口 ' + t.pop +
        ' · 单兵耗时 ' + U.dur(t.time);''',
     'ui.js 兵种悬停去耗粮')

# 5g. 出征兵力总览去掉"耗粮 X/时"（3 处）
edit(U,
     u'''    /* v74（老板：完善出征界面）：兵力总览 + 战力对比（估算）。''',
     u'''    /* v74（老板：完善出征界面）：兵力总览 + 战力对比（估算）。
       v89.36：军粮维持退役 —— 总览不再列「耗粮 X/时」。''',
     'ui.js 出征总览注释')

edit(U,
     u'      var n74 = 0, feed74 = 0, mine74 = 0;',
     u'      var n74 = 0, mine74 = 0;',
     'ui.js 出征 feed74 声明')

edit(U,
     u'''        n74 += v74;
        if (tr74) feed74 += v74 * (tr74.food || 0);
        if (tp74) mine74 += v74 * tp74(id);''',
     u'''        n74 += v74;
        if (tp74) mine74 += v74 * tp74(id);''',
     'ui.js 出征 feed74 累计')

edit(U,
     u'''        sum73.innerHTML = '👥 共派遣 <b>' + U.numText(n74, 0) + '</b> 兵　' +
          '耗粮 <b>' + U.numText(feed74, 0) + '</b>/时' +
          (fallback ? '<span style="opacity:.6;">（未填兵力，按现有兵种展示守军对比）</span>' : '');''',
     u'''        sum73.innerHTML = '👥 共派遣 <b>' + U.numText(n74, 0) + '</b> 兵' +
          (fallback ? '<span style="opacity:.6;">（未填兵力，按现有兵种展示守军对比）</span>' : '');''',
     'ui.js 出征总览文案')

# ============================================================
# 6) index.html（驻军行 CSS 两列）
# ============================================================
edit(H,
     u'''  .gb-row { /* v67（老板）：「分一下列」—— 数量与耗粮各自成列，中间发丝竖线 */
    display: grid; grid-template-columns: 1fr 62px 74px; align-items: center; gap: 8px;
    font-size: var(--fs-sub);
    padding: 2px 0; border-bottom: 1px dashed var(--line); }
  .gb-row .gb-n { flex: 1; color: var(--text); }
  .gb-row .gb-c { color: var(--gold-light); font-variant-numeric: tabular-nums;
    text-align: right; }
  .gb-row .gb-f { color: var(--text-dim); font-size: var(--fs-cap);
    text-align: right; border-left: 1px solid var(--line); padding-left: 8px; }''',
     u'''  .gb-row { /* v89.36（老板「维持军队无需耗粮食」）—— 耗粮列随军粮维持退役：
               只剩「名称 | 数量」两列，发丝竖线保留在数量列左侧 */
    display: grid; grid-template-columns: 1fr 74px; align-items: center; gap: 8px;
    font-size: var(--fs-sub);
    padding: 2px 0; border-bottom: 1px dashed var(--line); }
  .gb-row .gb-n { flex: 1; color: var(--text); }
  .gb-row .gb-c { color: var(--gold-light); font-variant-numeric: tabular-nums;
    text-align: right; border-left: 1px solid var(--line); padding-left: 8px; }''',
     'index.html 驻军行 CSS')

# ============================================================
# 7) audit.js（检查清单同步）
# ============================================================
edit(A,
     u"const storyFns = ['prodMult', 'feedMult', 'atkMult', 'defMult', 'siegeMult', 'researchMult',",
     u"const storyFns = ['prodMult', 'atkMult', 'defMult', 'siegeMult', 'researchMult',",
     'audit.js STORY 函数表')

edit(A,
     u"const weaKeys = ['archerRange', 'fire', 'ambush', 'scout', 'move', 'grain', 'feed'];",
     u"const weaKeys = ['archerRange', 'fire', 'ambush', 'scout', 'move', 'grain'];",
     'audit.js 天气字段表')

print()
print('ALL OK —— v89.36 军粮改造补丁执行完毕')

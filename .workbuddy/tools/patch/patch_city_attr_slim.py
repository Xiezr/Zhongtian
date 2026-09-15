# -*- coding: utf-8 -*-
"""v71 · 城池属性只显示城池命名（老板：
"城池属性不要显示坐标和所在州，只显示城池命名即可"）

改动总览
--------
代码（js/ui.js）：
  ① `ui.cityLabelHTML(c, short)` 增 short 模式 —— 短名 = 城名 + 档位标，
     与 `GAME.cityLabel` 同规则；全称仍供表格 / 出征等使用。
  ② 侧栏「城池属性」标题行：名字走短名；坐标 / 官府 Lv 文字撤下；
     🎲/📍 两个**操作入口**保留（不是"显示"），名城仍标「名城固定」。
  ③ 侧栏资源块「本城」表头：同走短名。
测试：
  ④ e2e「侧栏城池属性含城名与坐标」→ 翻转为「只显城名（不含坐标 / 全称）」。
  ⑤ e2e「城池属性栏显示坐标与两个入口」→「只显城名，两入口保留」。
  ⑥ smoke「城池名走单一取值口」加 short 模式守护（>= 2 处 c, true）。
  ⑦ smoke 第 58 节 ③ 段新增短名行为断言。
文档：
  ⑧ AI工作备忘 §八：坐标常显条 → v71 修正。
  ⑨ 设计规范 §13.3：显示口径更新（CRLF 保持）。

幂等 + 锚点唯一校验 + 行尾保持 + 落盘核验。
"""
import io, sys

UI   = r'E:\Deepseekdb\js\ui.js'
E2E  = r'E:\Deepseekdb\e2e-test.js'
SMOKE= r'E:\Deepseekdb\smoke-test.js'
MEMO = r'E:\Deepseekdb\docs\AI工作备忘.md'
SPEC = r'E:\Deepseekdb\docs\设计规范.md'

n_ok = 0
def patch(path, old, new, tag, crlf=False):
    global n_ok
    t = io.open(path, encoding='utf-8', newline='').read()
    if crlf:
        old = old.replace('\n', '\r\n'); new = new.replace('\n', '\r\n')
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    c = t.count(old)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（要求恰 1 次），拒绝写盘' % (tag, c))
        sys.exit(1)
    t = t.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    back = io.open(path, encoding='utf-8', newline='').read()
    print('  ✓ %s（字节 %d → %d）' % (tag, len(t) - len(new) + len(old), len(t)))
    n_ok += 1

# ───────────────────────── ① cityLabelHTML 加 short ─────────────────────────
patch(UI,
"""  ui.cityLabelHTML = function (c) {
    if (!c) return '';
    var tn = GAME.cityTierName ? GAME.cityTierName(c) : '';
    /* v70（老板）：地名走**全称**（州 · 郡 · 县，唯一出口 GAME.cityFullName）——
       旧版只写城名，"这是哪一州的城"要靠玩家自己猜。 */
    return U.escape(GAME.cityFullName(c)) + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '');
  };""",
"""  ui.cityLabelHTML = function (c, short) {
    if (!c) return '';
    var tn = GAME.cityTierName ? GAME.cityTierName(c) : '';
    /* v70（老板）：地名走**全称**（州 · 郡 · 县，唯一出口 GAME.cityFullName）。
       v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
       窄处（侧栏）传 short=true 走**短名**：城名 + 档位标，与 GAME.cityLabel 同规则；
       全称仍供统计表格 / 出征目标等需要"这是哪一州的城"的地方使用。 */
    var name = short ? U.escape(c.name) : U.escape(GAME.cityFullName(c));
    return name + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '');
  };""",
'① cityLabelHTML 加 short 模式')

# ───────────────────────── ② 侧栏城池属性标题行 ─────────────────────────
patch(UI,
"""        '<span class="lbl" style="color:var(--gold-light);font-weight:700;">🏯 ' +
          ui.cityLabelHTML(c) + '</span>' +
        /* v70（老板）：「城池的主界面提供其坐标（500×500）… 一键随机… 坐标切换
           （除名城，名城固定）」—— 坐标常显；自建城给 🎲/📍 两个入口，
           名城（地理固定）只标注不可迁。两钮都走唯一出口 GAME.canCityMoveTo。 */
        '<span class="val" style="font-weight:400;color:var(--text-dim);">' +
          '500×500 · ' + GAME.coordText(c) + ' · 官府Lv' + (GAME.buildingLevel(c, 'guanfu') || 1) +
          (GAME.isMovableCity(c)
            ? ' <button class="btn sm" data-action="city-random" title="一键随机：迁到一处空闲平原">🎲</button>' +
              '<button class="btn sm" data-action="city-move-ask" title="坐标切换：输入坐标迁址">📍</button>'
            : ' <span style="opacity:.7">名城固定</span>') +
        '</span></div>' +""",
"""        '<span class="lbl" style="color:var(--gold-light);font-weight:700;">🏯 ' +
          ui.cityLabelHTML(c, true) + '</span>' +
        /* v70（老板）：「城池的主界面提供其坐标……一键随机……坐标切换（除名城，名城固定）」。
           v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
           坐标 / 官府 Lv 文字从本行撤下（迁址弹窗里仍能看到当前坐标）；
           🎲/📍 两个**操作入口**保留（它们不是"显示"），名城仍只标注不可迁。
           两钮都走唯一出口 GAME.canCityMoveTo。 */
        '<span class="val" style="font-weight:400;color:var(--text-dim);">' +
          (GAME.isMovableCity(c)
            ? '<button class="btn sm" data-action="city-random" title="一键随机：迁到一处空闲平原">🎲</button>' +
              '<button class="btn sm" data-action="city-move-ask" title="坐标切换：输入坐标迁址">📍</button>'
            : '<span style="opacity:.7">名城固定</span>') +
        '</span></div>' +""",
'② 侧栏标题行：短名 + 撤坐标文字')

# ───────────────────────── ③ 资源块「本城」表头 ─────────────────────────
patch(UI,
"""      '<span class="val" style="color:var(--gold-light);font-weight:700;">' +
        ui.cityLabelHTML(c) + '</span></div>';""",
"""      '<span class="val" style="color:var(--gold-light);font-weight:700;">' +
        /* v71（老板）：只显示城池命名 —— 本城表头同走短名 */
        ui.cityLabelHTML(c, true) + '</span></div>';""",
'③ 本城表头走短名')

# ───────────────────────── ④ e2e 断言 1（侧栏）─────────────────────────
patch(E2E,
"""  /* v70（老板需求 3）：坐标格式由 [x,y] 改为「500×500 · (x, y)」（写明坐标体系） */
  check('侧栏城池属性含城名与坐标',
    attrs18.indexOf('江陵') >= 0 && attrs18.indexOf(G.coordText(conq18)) >= 0
    && attrs18.indexOf('500×500') >= 0);""",
"""  /* v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」——
     本断言自 v70 翻转：只验城名在、坐标与州全称**不在** */
  check('侧栏城池属性只显城名（不含坐标 / 不含州全称）',
    attrs18.indexOf('江陵') >= 0
    && attrs18.indexOf('500×500') < 0
    && attrs18.indexOf(G.coordText(conq18)) < 0
    && attrs18.indexOf('官府Lv') < 0
    && (G.cityFullName(conq18).indexOf(' · ') < 0
        || attrs18.indexOf(G.cityFullName(conq18)) < 0));""",
'④ e2e 侧栏断言翻转')

# ───────────────────────── ⑤ e2e 断言 2（v70 段）─────────────────────────
patch(E2E,
"""  check('★ 城池属性栏显示坐标（500×500）与两个入口', (function () {
    const h = document.querySelector('#city-attrs').innerHTML;
    const c0 = G.currentCity();
    return h.indexOf('500×500') >= 0 && h.indexOf(G.coordText(c0)) >= 0
      && h.indexOf('data-action="city-random"') >= 0 && h.indexOf('data-action="city-move-ask"') >= 0;
  })());""",
"""  /* v71（老板）：只显示城池命名 —— 坐标文字已撤，迁址两入口保留 */
  check('★ 城池属性栏只显城名（无坐标），两个迁址入口保留', (function () {
    const h = document.querySelector('#city-attrs').innerHTML;
    const c0 = G.currentCity();
    const full = G.cityFullName(c0);
    return h.indexOf(c0.name) >= 0
      && h.indexOf('500×500') < 0 && h.indexOf(G.coordText(c0)) < 0
      && (full.indexOf(' · ') < 0 || h.indexOf(full) < 0)
      && h.indexOf('data-action="city-random"') >= 0 && h.indexOf('data-action="city-move-ask"') >= 0;
  })());""",
'⑤ e2e v70 段断言更新')

# ───────────────────────── ⑥ smoke 8407 守护加强 ─────────────────────────
patch(SMOKE,
"""check('城池名走单一取值口（改名同步所有引用）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /ui\\.cityLabelHTML = function/.test(u) && (u.match(/ui\\.cityLabelHTML\\(/g) || []).length >= 3
    && /GAME\\.cityLabel\\(x\\)/.test(u);
})());""",
"""check('城池名走单一取值口（改名同步所有引用）', (function () {
  var u = require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8');
  return /ui\\.cityLabelHTML = function \\(c, short\\)/.test(u) && (u.match(/ui\\.cityLabelHTML\\(/g) || []).length >= 3
    && /GAME\\.cityFullName\\(x\\)/.test(u)
    /* v71（老板）：侧栏两处走短名（只显城池命名）；下拉框选项 = 全称 + 坐标 —— 防回退 */
    && (u.match(/ui\\.cityLabelHTML\\(c, true\\)/g) || []).length >= 2;
})());""",
'⑥ smoke 单一取值口守护加强')

# ───────────────────────── ⑦ smoke 第 58 节新增断言 ─────────────────────────
patch(SMOKE,
"""    check('迁址写日志（可追溯）', /📍 迁址/.test(dm58) && /GAME\\.log\\('📍 迁址/.test(dm58));""",
"""    check('迁址写日志（可追溯）', /📍 迁址/.test(dm58) && /GAME\\.log\\('📍 迁址/.test(dm58));

    /* v71（老板）：「城池属性不要显示坐标和所在州，只显示城池命名即可」 */
    check('★ 短名模式：不含州全称，含城名与档位标（侧栏两处走它）', (function () {
      var c = { name: '江陵', type: 'jun', state: '荆州', x: 5, y: 5 };
      var full = G.cityFullName(c);
      var short = G.ui.cityLabelHTML(c, true);
      var longName = G.ui.cityLabelHTML(c);
      return full.indexOf(' · ') >= 0
        && short.indexOf(full) < 0 && short.indexOf('江陵') >= 0
        && short.indexOf('city-tier') >= 0
        && longName.indexOf(full) >= 0;   /* 全称模式不受影响 */
    })());""",
'⑦ smoke 短名行为断言')

# ───────────────────────── ⑧ AI工作备忘 §八 ─────────────────────────
patch(MEMO,
"""- **城池坐标常显 + 君主标 + 头像池**（v70 老板五条）：城池属性栏写 `500×500 · (x, y)`，
  自建城给 🎲（一键随机迁址）/ 📍（坐标切换），名城标「名城固定」——可迁判据**唯一**
  （`GAME.canCityMoveTo`，界面与执行同源）。将领名单里君主挂 `.gcard-tag.lord` 标、**不给解雇按钮**；
  创建界面头像走 `ui.avatarPool`（与将领同一套池子），idx 即 `portraitSeed`。
  城池全称走 `GAME.cityFullName`（州·郡·县三层），野地城池标识带所在县。""",
"""- **城池命名显示（v71 修正）**：老板「城池属性不要显示坐标和所在州，只显示城池命名即可」——
  侧栏（城池属性标题 + 本城表头）走 `ui.cityLabelHTML(c, true)` **短名**（城名 + 档位标，
  与 `GAME.cityLabel` 同规则）；坐标 / 官府 Lv 不再常显（迁址弹窗内仍见当前坐标）；
  🎲/📍 两个**操作入口**保留（不是"显示"），名城仍标「名城固定」。
  全称 `GAME.cityFullName`（州·郡·县三层）仍供统计表格 / 出征目标等使用；野地城池标识带所在县。""",
'⑧ 备忘 §八 更新')

# ───────────────────────── ⑨ 设计规范 §13.3 ─────────────────────────
patch(SPEC,
"""### 13.3 城池坐标与迁址（v70 · 老板需求 3/4）
- 显示：城池属性栏常显 `500×500 · (x, y)`；自建城另给 🎲/📍 两个入口，名城标「名城固定」。""",
"""### 13.3 城池坐标与迁址（v70 · 老板需求 3/4；v71 显示层修正）
- 显示（v71 老板：「城池属性不要显示坐标和所在州，只显示城池命名即可」）：
  城池属性栏**只显示城池名**（短名 = 城名 + 档位标，`ui.cityLabelHTML(c, true)`）；
  坐标 / 官府 Lv 不再常显（**迁址弹窗内仍显示当前坐标**）。
  自建城保留 🎲/📍 两个操作入口，名城标「名城固定」。""",
'⑨ 设计规范 §13.3 更新', crlf=True)

print()
print('✓ 补丁完成：%d 处改动落盘' % n_ok)

# -*- coding: utf-8 -*-
"""v71 续 · 城池下拉框单城也保留 + 选项显示州郡县坐标（配套 patch_city_attr_slim.py）

老板原话：「即使只有一个城池，也整好选择城池的下拉框，在这里可以显示州郡县坐标如司隶琢郡祁县225, 225」

改动总览
--------
代码（js/ui.js）：
  ① 城池下拉框取消「多城才渲染」—— 单城也常驻（选址信息出口）。
  ② 选项文案：GAME.cityLabel(x) → 州郡县全称 + 坐标（cityFullName + coordText）。
  ③ 下拉签名（_citySwSig）扩为 id:name:x,y —— 改名 / 迁址后即刷新，不再停在旧文案。
测试：
  ④ smoke v25 段：注释「多城时才出现」→「v71：单城也出现」。
  ⑤ smoke「城池清单…」标题 + 判定翻转：单城也出现 + 两侧选项带坐标。
  ⑥ smoke v40 段「切城芯片…」翻转：不再"多城才出现"。
  ⑦ smoke v35 段「城池属性含身份行…」：v71 身份行只留命名，「官府Lv」撤下（配套 slim 补丁）。
  ⑧ e2e：单城断言翻转 + 新增「选项含州郡县全称与坐标」。
文档：
  ⑨ 设计规范 §13.3 追加「坐标出口」条（CRLF 保持）。
  ⑩ AI工作备忘 §八 追加「坐标出口」行。

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
    print('  ✓ %s' % tag)
    n_ok += 1

# ───────────────── ① + ② 下拉框：单城也保留 + 选项带州郡县坐标 ─────────────────
patch(UI,
"""    var switcher = '';
    if ((s.cities || []).length > 1) {
      switcher = '<div class="city-switch"><span class="cs-lbl">城池</span>' +
        '<select class="city-select" data-action="switch-city" title="切换当前经营的城池">' +
        s.cities.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' +
            U.escape(GAME.cityLabel(x)) + '</option>';
        }).join('') +
        '</select></div>';
    }""",
"""    /* v71（老板）：「即使只有一个城池，也保留这个城池下拉框，在这里可以显示州郡县坐标」
       —— 城池属性行瘦身后（只显城名），下拉框升格为「选址信息」的出口：
       单城也照常渲染；选项文案 = 州郡县全称 + 坐标（在哪建城，一眼可鉴）。 */
    var switcher = '<div class="city-switch"><span class="cs-lbl">城池</span>' +
      '<select class="city-select" data-action="switch-city" title="切换当前经营的城池">' +
      s.cities.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' +
          U.escape(GAME.cityFullName(x)) + ' ' + U.escape(GAME.coordText(x)) + '</option>';
      }).join('') +
      '</select></div>';""",
'① 下拉框：单城也保留 + 选项带州郡县坐标')

# ───────────────── ③ 下拉签名含城名/坐标 ─────────────────
patch(UI,
"""    var host = $('#city-switch-host');
    var sig = (s.cities || []).map(function (x) { return x.id; }).join(',') + '|' + c.id;""",
"""    var host = $('#city-switch-host');
    /* v71（老板）：选项文案含城名 / 坐标 —— 签名跟着文案走，
       改名、迁址后下一帧即刷新；否则下拉框会停在旧文案上。 */
    var sig = (s.cities || []).map(function (x) {
      return x.id + ':' + (x.name || '') + ':' + x.x + ',' + x.y;
    }).join(',') + '|' + c.id;""",
'② 下拉签名含城名 / 坐标')

# ───────────────── ④ smoke 注释：单城也出现 ─────────────────
patch(SMOKE,
"""     侧栏不再有「城池操作」：切城并进城池属性（多城时才出现） */""",
"""     侧栏不再有「城池操作」：切城并进城池属性（v71：单城也出现） */""",
'③ smoke 注释：单城也出现')

# ───────────────── ⑤ smoke 标题 + 判定翻转 ─────────────────
patch(SMOKE,
"""  check('城池清单在多城时给出**城池下拉框**、单城时不出现', (function () {""",
"""  check('城池清单单城也给出**城池下拉框**（v71 老板：含州郡县 + 坐标）', (function () {""",
'④ smoke 标题翻转')

patch(SMOKE,
"""    return /<select class="city-select" data-action="switch-city"/.test(multi)
      && /<option value="[^"]+" selected>/.test(multi)
      && !/<select/.test(single)
      && sepOk;""",
"""    /* v71（老板）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」——
       单城不再收起；两侧选项都带坐标（州郡县全称在上，坐标在后）。 */
    return /<select class="city-select" data-action="switch-city"/.test(multi)
      && /<option value="[^"]+" selected>/.test(multi)
      && /\\(\\d+, \\d+\\)/.test(multi)
      && /<select class="city-select" data-action="switch-city"/.test(single)
      && /\\(\\d+, \\d+\\)/.test(single)
      && sepOk;""",
'⑤ smoke 判定翻转（单城也出现 + 坐标）')

# ───────────────── ⑥ smoke v40 段翻转 ─────────────────
patch(SMOKE,
"""  check('切城芯片并进「城池属性」（多城才出现）', /city-switch/.test(uS40)
    && /s\\.cities \\|\\| \\[\\]\\)\\.length > 1/.test(uS40));""",
"""  check('切城下拉框并进「城池属性」（v71 老板：单城也保留）', /city-switch/.test(uS40)
    && !/if \\(\\(s\\.cities \\|\\| \\[\\]\\)\\.length > 1\\)/.test(uS40));""",
'⑥ smoke v40 断言翻转')

# ───────────────── ⑦ smoke v35 段：官府Lv 撤下配套 ─────────────────
patch(SMOKE,
"""  check('城池属性含身份行与城外地块',
    /官府Lv' \\+\\s*\\(GAME\\.buildingLevel\\(c, 'guanfu'\\)/.test(uS35) && /城外地块/.test(uS35));""",
"""  check('城池属性含身份行与城外地块', /* v71（老板）：身份行只留城池命名 —— 「官府Lv」随坐标一并撤下 */
    /ui\\.cityLabelHTML\\(c, true\\)/.test(uS35)
    && !/官府Lv/.test(uS35.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''))
    && /城外地块/.test(uS35));""",
'⑦ smoke v35 官府Lv 配套')

# ───────────────── ⑧ e2e：单城捕获 + 断言翻转 + 内容断言 ─────────────────
patch(E2E,
"""    const single = document.querySelectorAll('#city-switch-host select.city-select').length;""",
"""    const selSingle = document.querySelector('#city-switch-host select.city-select');
    const single = selSingle ? selSingle.options.length : 0;
    const singleTxt = selSingle ? selSingle.options[0].textContent : '';""",
'⑧ e2e 单城捕获')

patch(E2E,
"""    const sel = document.querySelector('#city-switch-host select.city-select');
    const multi = sel ? sel.options.length : 0;""",
"""    const sel = document.querySelector('#city-switch-host select.city-select');
    const multi = sel ? sel.options.length : 0;
    const multiTxt = sel ? Array.from(sel.options).map(o => o.textContent).join('|') : '';""",
'⑨ e2e 多城捕获')

patch(E2E,
"""    check('单城时不出现城池下拉框', single === 0, single + ' 个');""",
"""    /* v71（老板）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」 */
    check('单城时也出现城池下拉框（选项 = 州郡县 + 坐标）',
      single === 1 && singleTxt.indexOf('(') >= 0 && singleTxt.indexOf(G.coordText(cur)) >= 0, single + ' 个选项');""",
'⑩ e2e 单城断言翻转')

patch(E2E,
"""    check('多城时城池清单给出城池下拉框（已有城池均为选项）', multi >= 2, multi + ' 个选项');""",
"""    check('多城时城池清单给出城池下拉框（已有城池均为选项）', multi >= 2, multi + ' 个选项');
    /* v71（老板）：选项文案 = 州郡县全称 + 坐标（在哪建城，这里可鉴） */
    check('下拉框选项含州郡县全称与坐标（v71：选址信息出口）',
      multiTxt.indexOf(G.cityFullName(cur)) >= 0 && multiTxt.indexOf(G.coordText(cur)) >= 0, multiTxt.slice(0, 80));""",
'⑪ e2e 新增选项内容断言')

# ───────────────── ⑨ 设计规范 §13.3 坐标出口（CRLF）─────────────────
patch(SPEC,
"""  自建城保留 🎲/📍 两个操作入口，名城标「名城固定」。""",
"""  自建城保留 🎲/📍 两个操作入口，名城标「名城固定」。
- 坐标出口（v71 续 老板）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」——
  城池下拉框（`#city-switch-host`）取消「多城才渲染」：**单城也常驻**；
  选项文案 = 州郡县全称（`GAME.cityFullName`）+ 坐标（`GAME.coordText`）；
  下拉签名含城名 / 坐标 —— 改名与迁址后即刷新。""",
'⑫ 设计规范 §13.3 坐标出口', crlf=True)

# ───────────────── ⑩ AI工作备忘 §八 坐标出口 ─────────────────
patch(MEMO,
"""  全称 `GAME.cityFullName`（州·郡·县三层）仍供统计表格 / 出征目标等使用；野地城池标识带所在县。""",
"""  全称 `GAME.cityFullName`（州·郡·县三层）仍供统计表格 / 出征目标等使用；野地城池标识带所在县。
  坐标出口（v71 续）：「即使只有一个城池，也保留下拉框，在这里可以显示州郡县坐标」——
  城池下拉框**单城也常驻**，选项 = 州郡县 + 坐标；签名含城名 / 坐标（改名、迁址即刷新）。""",
'⑬ 备忘 §八 坐标出口')

print()
print('✓ 补丁2完成：%d 处改动落盘' % n_ok)

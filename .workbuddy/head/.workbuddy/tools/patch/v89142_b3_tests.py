# v89.142 B3：smoke/e2e —— §114 目标入口断言升级（5 类分组）
# 跑法：python .workbuddy/tools/patch/v89142_b3_tests.py
import io
PS = 'E:/Deepseekdb/smoke-test.js'
PE = 'E:/Deepseekdb/e2e-test.js'
bs = io.open('E:/Deepseekdb/backup/v89142/smoke-test.js.before', encoding='utf-8', newline='').read()
be = io.open('E:/Deepseekdb/backup/v89142/e2e-test.js.before', encoding='utf-8', newline='').read()

def patch(P, bak, pairs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in pairs:
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        print('OK ' + tag)
    assert '\r\n' not in s, 'CRLF!'
    assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏[' + P + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('WROTE ' + P + ' len ' + str(len(s)))

patch(PS, bs, [
 ("""    check('§114② 出征页：我方野地进目标列表（全境）+ 目标下拉 + 进入行动键', (function () {
      var arr = G.ui.actTargetsOf(c114);
      var h = G.ui.marchActHTML();
      return arr.length >= 1 && arr[0].tg.kind === 'wild'
        && h.indexOf('data-action="exp-act-target"') >= 0
        && h.indexOf('data-action="exp-act-go"') >= 0;
    })(), '目标 ' + G.ui.actTargetsOf(c114).length + ' 项');""",
  """    check('§114②+§142 出征页：我方野地进目标列表（全境）+ 5 类分组下拉 + 进入行动键', (function () {
      var groups = G.ui.actTargetGroups(c114);
      var gw = groups.filter(function (g) { return g.key === 'ownwild'; })[0];
      var h = G.ui.marchActHTML();
      return groups.length === 5 && !!gw && gw.targets.length >= 1
        && h.indexOf('data-action="exp-act-pick"') >= 0
        && h.indexOf('data-action="exp-act-go"') >= 0;
    })(), '5 类 · 目标 ' + G.ui.actTargetGroups(c114).reduce(function (n, g) { return n + g.targets.length; }, 0) + ' 项');""",
  's1-出征页分组'),
 ("""    check('§114② 目标范围写清楚（全境 / 同县 / 14 格内 / 地图点选）', (function () {
      var h = G.ui.marchActHTML();
      return h.indexOf('全境') >= 0 && h.indexOf('同县') >= 0
        && h.indexOf('14 格内') >= 0 && h.indexOf('地图点选') >= 0;
    })());""",
  """    check('§114② 目标范围写清楚（全境 / 最近 24 / 14 格内 / 地图点选）', (function () {
      var h = G.ui.marchActHTML();
      return h.indexOf('全境') >= 0 && h.indexOf('最近 24') >= 0
        && h.indexOf('14 格内') >= 0 && h.indexOf('地图点选') >= 0;
    })());""",
  's2-范围文案'),
 ("""    check('§114②「进入军队行动」→ openExpModal 原样引用（不另造编队界面）', (function () {
      return /ui\\.openExpModal\\(_at\\.tg\\)/.test(mS114);
    })());""",
  """    check('§114②/§142「进入军事行动」→ openExpModal 原样引用（读 actPickOf 唯一出口）', (function () {
      return /ui\\.openExpModal\\(_pk142\\.tg\\)/.test(mS114) && /ui\\.actPickOf\\(\\)/.test(mS114);
    })());""",
  's3-提交出口'),
])

patch(PE, be, [
 ("""  check('出征页呈现本城出征容量（人马口径）与目标入口（第 9/11 条）',
    act21_v21.indexOf('出征容量') >= 0 && act21_v21.indexOf('人马') >= 0
    && act21_v21.indexOf('data-action="exp-act-target"') >= 0
    && act21_v21.indexOf('data-action="exp-act-go"') >= 0);""",
  """  check('出征页呈现本城出征容量（人马口径）与目标入口（第 9/11 条 + §142 五类分行）',
    act21_v21.indexOf('出征容量') >= 0 && act21_v21.indexOf('人马') >= 0
    && act21_v21.indexOf('data-action="exp-act-pick"') >= 0
    && act21_v21.indexOf('data-action="exp-act-go"') >= 0
    /* v89.142：5 类分行 + 按钮在底部 —— DOM 顺序：按钮出现在最后一个目标下拉之后 */
    && (act21_v21.indexOf('exp-act-go') > act21_v21.lastIndexOf('exp-act-pick')));""",
  'e2e-出征页'),
])

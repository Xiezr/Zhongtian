# -*- coding: utf-8 -*-
# v89.150：列宽断言升级（3 条）+ §130 门禁节（本轮 6 条需求 + 档案）
import io, re


def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in segs:
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)


patch('E:/Deepseekdb/smoke-test.js', [
# ---------- ① ⑧ 上部分三列 ----------
("""    check('⑧ 上部分三列：v89.140 侧栏去图标后改 1.1fr 3.8fr 1.1fr（战场更宽）', (function () {
      /* v89.148（老板 3）：.bt-board 前面加了 `flex: 1 1 auto; ... overflow: hidden;` 前缀 —— 判据放宽为"规则块内含列宽" */
      return /\\.bt-board \\{[^}]*grid-template-columns: 1\\.1fr 3\\.8fr 1\\.1fr;/.test(h96)""",
 """    check('⑧ 上部分三列：v89.150 侧栏**定宽 248**、战场吃满（更宽）', (function () {
      /* v89.148（老板 3）：.bt-board 前面加了 `flex: 1 1 auto; ... overflow: hidden;` 前缀 —— 判据放宽为"规则块内含列宽"
         v89.150（老板 4）：比例分 1.1fr:3.8fr:1.1fr → **248px : 1fr : 248px**（多出来的宽度全给战场） */
      return /\\.bt-board \\{[^}]*grid-template-columns: 248px minmax\\(0, 1fr\\) 248px;/.test(h96)""",
 '① ⑧ 三列'),

# ---------- ② ⑦ 三列 ----------
("""    check('⑦ 三列 1.1fr 3.8fr 1.1fr（v89.140：侧栏收窄、战场放宽 · v89.148 前缀 flex 不判）',
      /\\.bt-board \\{[^}]*grid-template-columns: 1\\.1fr 3\\.8fr 1\\.1fr;/.test(h97));""",
 """    check('⑦ 三列 248px : 1fr : 248px（v89.150 老板 4：侧栏定宽、战场吃满 · 前缀 flex 不判）',
      /\\.bt-board \\{[^}]*grid-template-columns: 248px minmax\\(0, 1fr\\) 248px;/.test(h97));""",
 '② ⑦ 三列'),

# ---------- ③ §121② ----------
("""    check('§121② 战场侧栏两行制 CSS（bt-l1/bt-l2）+ 无图标 + 列宽 1.1/3.8/1.1', (function () {
      return /\\.bt-l1, \\.bt-l2 \\{ display: flex; align-items: center; gap: 4px; min-width: 0; \\}/.test(h)
        && /\\.bt-board \\{[^}]*grid-template-columns: 1\\.1fr 3\\.8fr 1\\.1fr;/.test(h)""",
 """    check('§121② 战场侧栏两行制 CSS（bt-l1/bt-l2）+ 无图标 + 列宽 248/1fr/248（v89.150）', (function () {
      return /\\.bt-l1, \\.bt-l2 \\{ display: flex; align-items: center; gap: 4px; min-width: 0; \\}/.test(h)
        && /\\.bt-board \\{[^}]*grid-template-columns: 248px minmax\\(0, 1fr\\) 248px;/.test(h)""",
 '③ §121② 列宽'),
])

# ============ §130 门禁节 ============
SEC = '''
  /* ═══════════════════════════════════════════════════════════
   * §130（v89.150）：老板 6 条 —— 兵牌三档外框 / 整幅画面等比缩放 /
   *   战报正文三块 / 战场铺满 / 战斗待指挥清单 / 关闭战场回大界面
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs130 = require('fs'), p130 = require('path');
    var u130 = fs130.readFileSync(p130.join(__dirname, 'js', 'ui.js'), 'utf8');
    var u130c = stripComment(u130);
    var m130c = stripComment(fs130.readFileSync(p130.join(__dirname, 'js', 'main.js'), 'utf8'));
    var d130 = fs130.readFileSync(p130.join(__dirname, 'js', 'domain.js'), 'utf8');
    var h130 = fs130.readFileSync(p130.join(__dirname, 'index.html'), 'utf8');
    var h130c = stripComment(h130);
    var dp130 = fs130.readFileSync(p130.join(__dirname, 'js', 'data.js'), 'utf8');

    var _r130a = '', _r130b = '', _r130d = '', _r130e = '', _r130f = '';

    /* ---- ① 兵牌外框按兵种三档 + 战场背景稍淡 ---- */
    check('§130① 兵牌三档（步 inf 28 / 骑 cav 32 / 器械 siege 36）+ 形态唯一出口 troopShapeOf', (function () {
      var okFn = /GAME\\.troopShapeOf = function/.test(d130)
        && /if \\(t\\.craft\\) return 'siege';/.test(d130) && /t\\.cat === 'cav'/.test(d130);
      var okCss = /\\.bt-unit \\{ --u-w: 36px;/.test(h130)
        && /\\.bt-unit\\.inf \\{ --u-w: 28px; \\}/.test(h130)
        && /\\.bt-unit\\.cav \\{ --u-w: 32px; \\}/.test(h130)
        && /\\.bt-unit\\.siege \\{ --u-w: 36px; \\}/.test(h130)
        && /\\.bt-field\\.dense \\.bt-unit \\{ height: 24px; width: calc\\(var\\(--u-w\\) \\* \\.8\\)/.test(h130);
      /* 战场背景稍淡（老板 1）：中间那道深色带 .42 → .26 */
      var okBg = /rgba\\(var\\(--sh-rgb\\), \\.26\\) 50%/.test(h130) && h130.indexOf('rgba(var(--sh-rgb), .42) 50%') < 0;
      /* 形态判定实测：枪=inf / 轻骑=cav / 床弩=siege（读数据表字段，不是名单） */
      var sh = [G.troopShapeOf('changqiang'), G.troopShapeOf('qingji'), G.troopShapeOf('chuangnu')];
      _r130a = '形态 ' + sh.join('/') + ' · 背景 ' + (okBg ? '已淡' : '未变');
      return okFn && okCss && okBg && sh.join('/') === 'inf/cav/siege';
    })(), _r130a);
    /* 兵牌真渲染时挂了对形态类（源码 + 行为两层） */
    check('§130① 兵牌真挂形态类（btFieldHTML 输出含 inf/cav/siege 三档）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'changqiang', name: '长枪兵', count: 100, adv: 100 },
          { id: 'qingji', name: '轻骑兵', count: 100, adv: 100 },
          { id: 'chuangnu', name: '床弩', count: 100, adv: 100 }],
        def: [{ id: 'yibing', name: '义兵', count: 80, adv: 100 }] };
      var h = G.ui.btFieldHTML(snap);
      _r130a = 'bt-unit 类 = ' + (h.match(/bt-unit [a-z]+ (inf|cav|siege)/g) || []).join(' | ');
      return /bt-unit atk inf/.test(h) && /bt-unit atk cav/.test(h) && /bt-unit atk siege/.test(h);
    })(), _r130a);

    /* ---- ② 整幅画面等比缩放 ---- */
    check('§130② 画布等比缩放：外壳 + 令牌 + fitAppSize 算 k + 遮罩/浮层改画布坐标系', (function () {
      var okHtml = /<div id="app-fit">\\s*<div id="app-scale">/.test(h130)
        && /#app-fit \\{ width: calc\\(var\\(--app-w\\) \\* var\\(--app-k, 1\\)\\)/.test(h130)
        && /#app-scale \\{ position: relative; width: var\\(--app-w\\); height: var\\(--app-h\\);\\s*transform: scale\\(var\\(--app-k, 1\\)\\)/.test(h130)
        && /--app-k: 1;/.test(h130);
      var okAbs = /\\.modal-mask \\{[\\s\\S]{0,300}position: absolute; inset: 0;/.test(h130)
        && /\\.tip-layer \\{[\\s\\S]{0,700}position: absolute/.test(h130);
      var fn = codeOf(m130c, 'function fitAppSize()');
      var okK = /Math\\.min\\(w \\/ 1440, h \\/ 900\\)/.test(fn) && /setProperty\\('--app-k'/.test(fn);
      /* 全站不得再有裸 vw/vh（弹窗尺寸一律画布单位） */
      var okNoVh = h130c.indexOf('calc(100vw') < 0 && h130c.indexOf('calc(100vh') < 0;
      _r130b = '外壳' + (okHtml ? '✓' : '✗') + ' 遮罩/浮层' + (okAbs ? '✓' : '✗') + ' k公式' + (okK ? '✓' : '✗') + ' 无裸vh' + (okNoVh ? '✓' : '✗');
      return okHtml && okAbs && okK && okNoVh;
    })(), _r130b);
    check('§130② 浮层换算出口（toCanvasXY / layerRoot / canvasSize）+ 动态层挂画布坐标系', (function () {
      var ok = /ui\\.toCanvasXY = function/.test(u130) && /ui\\.layerRoot = function/.test(u130)
        && /ui\\.canvasSize = function/.test(u130) && /GAME\\.appKOf = function/.test(m130c);
      var okUse = (u130.match(/ui\\.layerRoot\\(\\)/g) || []).length >= 4
        && /ui\\.toCanvasXY\\(r\\.left \\+ r\\.width \\/ 2, r\\.top\\)/.test(u130);
      var okMap = /GAME\\.appKOf \\? GAME\\.appKOf\\(\\) : 1/.test(fs130.readFileSync(p130.join(__dirname, 'js', 'map.js'), 'utf8'));
      _r130b = '出口' + (ok ? '✓' : '✗') + ' 消费' + (u130.match(/ui\\.layerRoot\\(\\)/g) || []).length + '处 · map ' + (okMap ? '✓' : '✗');
      return ok && okUse && okMap;
    })(), _r130b);

    /* ---- ③ 战报正文三块 ---- */
    check('§130③ 战报正文 = 三块（总结/收获/损耗）· 回放与纪要整条退役', (function () {
      var okNew = /ui\\.reportSectOf = function/.test(u130) && /ui\\.reportSplitLine = function/.test(u130)
        && /ui\\.reportLinesHTML = function/.test(u130) && /ui\\.reportGainHTML = function/.test(u130)
        && /ui\\.REPORT_EV_TAGS = \\{/.test(u130) && /ui\\.REPORT_GAIN_TAGS = \\{/.test(u130)
        && /ui\\.sealH\\('战斗总结'/.test(u130) && /ui\\.sealH\\('战斗收获'/.test(u130)
        && /ui\\.sealH\\('兵种损耗'/.test(u130);
      var okGone = u130c.indexOf('ui.stripBodyDup') < 0 && u130c.indexOf('ui.replaySectionHTML') < 0
        && u130c.indexOf('ui.replayToggle') < 0 && u130c.indexOf('ui.replayJump') < 0
        && u130c.indexOf('回合纪要') < 0 && m130c.indexOf("case 'rep-play'") < 0;
      var okCss = /\\.rp-gain \\{ display: grid; grid-template-columns: max-content minmax\\(0, 1fr\\)/.test(h130c)
        && h130c.indexOf('.rp-log') < 0;
      _r130a = '新三块' + (okNew ? '✓' : '✗') + ' 旧退役' + (okGone ? '✓' : '✗') + ' CSS' + (okCss ? '✓' : '✗');
      return okNew && okGone && okCss;
    })(), _r130a);
    /* 分段出口实测：主文/事件/损耗/收获四类，且【城名】不误判成事件 */
    check('§130③ 分段实测（【城名】归主文 · 守城/侦查白名单齐备 · 收获按「；」拆行）', (function () {
      var r = G.ui.reportSectOf({ body: '【许都】攻城胜利。<br>远征将领：赵。<br>【斗将】甲胜乙'
        + '<br>【兵种损耗】我军 枪 1,000 → 800<br>敌军 义 500 → 0<br>【战利品】粮 3,000；【遭劫】粮 −500' });
      _r130d = 'sum=' + r.summary.length + ' ev=' + r.events.length + ' loss=' + r.loss.length + ' gain=' + r.gain.length;
      return r.summary.length === 2 && r.events.length === 2 && r.loss.length === 2 && r.gain.length === 1;
    })(), _r130d);

    /* ---- ④ 战场铺满 ---- */
    check('§130④ 战场弹窗 = max 档（画布铺满）· 侧栏定宽 248 → 战场吃满', (function () {
      var okSize = /size: 'max',/.test(u130) && /ui\\.openBattlefield = function/.test(u130);
      var okCol = /\\.bt-board \\{[^}]*grid-template-columns: 248px minmax\\(0, 1fr\\) 248px;/.test(h130);
      /* modal-max 已是画布单位（铺满 = 画布 − 16） */
      var okMax = /\\.modal-max \\{ width: calc\\(var\\(--app-w\\) - 16px\\); height: calc\\(var\\(--app-h\\) - 16px\\);/.test(h130);
      _r130e = 'max档' + (okSize ? '✓' : '✗') + ' 列宽' + (okCol ? '✓' : '✗') + ' modal-max' + (okMax ? '✓' : '✗');
      return okSize && okCol && okMax;
    })(), _r130e);

    /* ---- ⑤ 战斗待指挥清单 ---- */
    check('§130⑤ 抵达不再直接进战场：弹「战斗待指挥」清单（目标/类型/观战 三列）', (function () {
      var okFn = /ui\\.openBattleList = function/.test(u130) && /ui\\.battleListHTML = function/.test(u130)
        && /ui\\.battleListOf = function/.test(u130) && /ui\\.battleListRowsHTML = function/.test(u130);
      var okRow = /<th>目标<\\/th><th>战斗类型<\\/th><th>是否观战<\\/th>/.test(u130)
        && /data-action="bt-open" data-id=/.test(u130);
      /* main.js：挂起分支改弹清单（**不再**直接 openBattlefield） */
      var seg = m130c.slice(m130c.indexOf('GAME.onMarchArrive = function'),
        m130c.indexOf('GAME.onMarchArrive = function') + 1200);
      var okArrive = /ui\\.openBattleList\\(\\);/.test(seg) && seg.indexOf('ui.openBattlefield(r.battleId)') < 0
        && /if \\(ui\\._bt\\)/.test(seg);
      /* 行为层：造两场 live 战斗 → 清单两行 */
      var st = G.state, bk = st.battles;
      var rows = '';
      try {
        st.battles = [{ id: 'T1', state: 'live', side: 'atk', modeId: 'raid', target: { name: '荒野·甲' } },
          { id: 'T2', state: 'live', side: 'def', modeId: 'raid', target: { name: '许都' } },
          { id: 'T3', state: 'done', side: 'atk', target: { name: '旧仗' } }];
        var html = G.ui.battleListHTML();
        rows = (html.match(/data-action="bt-open"/g) || []).length + '行 / 含旧仗=' + (html.indexOf('旧仗') >= 0);
        var okList = G.ui.battleListOf().length === 2
          && (html.match(/data-action="bt-open"/g) || []).length === 2
          && html.indexOf('守城') >= 0 && html.indexOf('掠夺') >= 0 && html.indexOf('旧仗') < 0;
      } finally { st.battles = bk; }
      _r130f = '清单 ' + rows;
      return okFn && okRow && okArrive && okList;
    })(), _r130f);

    /* ---- ⑥ 关闭战场回大界面 ---- */
    check('§130⑥ 战场关闭 = closeAll（一次关净回视图层，不滞留中间面板）', (function () {
      var seg = u130.slice(u130.indexOf('ui.openBattlefield = function'),
        u130.indexOf('ui.openBattlefield = function') + 2600);
      return /closeAll: true,/.test(seg) && /ui\\._modalCloseAll/.test(u130)
        && /ui\\.closeAllModals = function/.test(u130);
    })());

    /* ---- ⑦ 档案在册 ---- */
    check('§130⑦ 需求档案在册（v89.150 · 兵种三档 / 整体缩放 / 战斗待指挥）', (function () {
      var a = fs130.readFileSync(p130.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.150') >= 0 && a.indexOf('整体缩放') >= 0
        && a.indexOf('战斗待指挥') >= 0 && a.indexOf('兵种形态') >= 0;
    })());
  })();
'''
# 插在 §129 收尾之后（用 §129⑧ 那段做锚点）—— ⚠️ 这里要**重新读**（patch() 里的 s 是局部的）
_P130 = 'E:/Deepseekdb/smoke-test.js'
s = io.open(_P130, encoding='utf-8', newline='').read()
if s.find('§130①') >= 0:
    print('SKIP(已落) §130 门禁节')
else:
    i = s.find("    check('§129⑧ 需求档案在册（v89.149 · 同兵种 / 最近距离 / 声望）', (function () {")
    assert i > 0
    j = s.find('\n', s.find('})());', i))
    assert j > i
    s = s[:j + 1] + SEC + s[j + 1:]
    assert '\r\n' not in s
    assert s.count('§130①') >= 1
    io.open(_P130, 'w', encoding='utf-8', newline='').write(s)
    print('OK §130 门禁节插入')

print('ALL OK · len=' + str(len(s)))

# -*- coding: utf-8 -*-
"""patch_v89235d_sec.py —— §235 守卫段 + 版本三连（v89.234 → v89.235）

用法：python patch_v89235d_sec.py [--apply]
"""
import io, sys
R = 'E:/Deepseekdb/'
APPLY = '--apply' in sys.argv
LOG, FAIL = [], []

SEC = r'''
  /* ============================================================
   * §235（v89.235）：政务厅角标并入名称行 · 城外资源建筑 ≤ 政务厅 · 过时素材清理
   * ------------------------------------------------------------
   * 老板三条：「1.政务厅等级位置不对
   *   2.城外资源建筑等级也不能超过政务厅等级
   *   3.E:\Deepseekdb\assets\icons里边已经过时的，不是废土版本的UI清理掉」
   *   ① 政务厅角标：v89.229 双段合一漏了政务厅专属渲染块（badge 独立在 label 外）
   *   ② 城外闸：upgradeExt 未传 bid + buildCapCoreOf 只认 DATA.BUILDINGS → 天然可超
   *   ③ 清理：raw/1~4.png（Sep 13 老图集源 · 零引用）+ atlas_D_src.jpeg（废弃中间格式）
   * ============================================================ */
  console.log('\n===== §235 政务厅角标 · 城外政务厅闸 · 素材清理 =====');
  (function () {
    var fs235 = require('fs'), path235 = require('path');
    var u235 = fs235.readFileSync(path235.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m235 = fs235.readFileSync(path235.join(__dirname, 'js', 'main.js'), 'utf8');
    var d235 = fs235.readFileSync(path235.join(__dirname, 'js', 'domain.js'), 'utf8');

    /* ① 政务厅角标结构：badge 在 label 之后（= 并入名称行内）；普通格子同构在册 */
    check('§235① 政务厅角标并入名称行（双宿主同构 · badge 在 label 内）', (function () {
      var _gi = u235.indexOf('gov-palace');
      var _gseg = u235.slice(_gi, u235.indexOf('\n  };', _gi));
      var _li = _gseg.indexOf('tile-label');
      var _bi = _gseg.indexOf('tile-badge');
      /* 普通格子（isoCell）：'</span>' + badge + '</span>' 结构保留（同构基准） */
      var _normal = u235.indexOf("'</span>' + badge + '</span>'") >= 0;
      window.__r235a = 'label@' + _li + ' badge@' + _bi + ' normal=' + _normal;
      return _li >= 0 && _bi > _li && _normal;   /* 改前 badge 在 label 之前（_bi < _li）→ 本判据红 */
    })(), window.__r235a || '');

    /* ② 城外闸三处同尺（源码级）：cap 两表并查 · 前置 check · buildCapOf 传 bid */
    check('§235② 城外闸三处同尺（cap 两表并查 · upgradeExt 传 bid · 前置检查在册）', (function () {
      var ok = /var b = DATA\.BUILDINGS\[bid\] \|\| DATA\.EXT_BUILDINGS\[bid\];/.test(d235)
        && /\(DATA\.BUILDINGS\[bid\] \|\| DATA\.EXT_BUILDINGS\[bid\]\) && bid !== 'guanfu'/.test(d235)
        && /var pre = GAME\.buildPrereqOf\(city, e\.type, e\.lv \+ 1, e\);/.test(d235)
        && /e\.lv >= GAME\.buildCapOf\(city, e\.type, e\)/.test(d235);
      window.__r235b = 'ok=' + ok;
      return ok;
    })(), window.__r235b || '');

    /* ③ 城外闸真调四态（独立小局 · 用完还原）：
          Lv1 试升被拒（报"需政务厅"）· cap=政务厅等级 · 抬政务厅后通过 · 推完 lv=2 */
    check('§235③ 城外闸真调四态（拒 → 抬政务厅 → 通过 · cap=政务厅等级）', (function () {
      var keep = G.state;
      var out = {};
      try {
        var st = G.newGame({ name: '§235', cityName: '灰岗', mapSeed: 20261007 });
        var c = st.cities[0];
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 9e7; });
        var eg = GAME.extGridOf(c), idx = -1;
        for (var i = 0; i < eg.length; i++) { if (!eg[i].type && !eg[i].pending) { idx = i; break; } }
        var rb = GAME.buildExt(idx, 'farm');
        for (var t1 = 0; t1 < 300 && st.queues.build.length; t1++) G.tickOnce();
        out.built = eg[idx].type === 'farm' && eg[idx].lv === 1;
        var govLv1 = GAME.buildingLevel(c, 'guanfu');
        var r1 = GAME.upgradeExt(idx);
        out.rej = r1.ok === false && /政务厅/.test(r1.msg || '');
        out.rejMsg = r1.msg || '';
        out.cap1 = GAME.buildCapOf(c, 'farm');
        /* 抬政务厅到 Lv2（升 Lv2 无前置） */
        var gi = -1;
        for (var g2 = 0; g2 < c.cells.length; g2++) {
          if (c.cells[g2].build && c.cells[g2].build.id === 'guanfu') { gi = g2; break; }
        }
        var rg = GAME.upgradeAt(c.id, gi);
        for (var t2 = 0; t2 < 300 && st.queues.build.length; t2++) G.tickOnce();
        var govLv2 = GAME.buildingLevel(c, 'guanfu');
        var r2 = GAME.upgradeExt(idx);
        for (var t3 = 0; t3 < 300 && st.queues.build.length; t3++) G.tickOnce();
        out.govUp = govLv2 === 2;
        out.pass = r2.ok === true && eg[idx].lv === 2;
        out.cap2 = GAME.buildCapOf(c, 'farm');
        window.__r235c = 'gov1=' + govLv1 + ' rej=' + out.rej + ' cap1=' + out.cap1
          + ' gov2=' + govLv2 + ' pass=' + out.pass + ' cap2=' + out.cap2 + ' msg=' + out.rejMsg;
        return out.built && govLv1 === 1 && out.rej && out.cap1 === 1 && out.govUp && out.pass && out.cap2 === 2;
      } catch (e) {
        window.__r235c = 'ERR ' + (e && e.message);
        return false;
      } finally { G.state = keep; }
    })(), window.__r235c || '');

    /* ④ UI 同尺：城外面板 prereq + 卡闸时给准确原因（"已达最高等级"会误导） */
    check('§235④ UI 同尺（城外面板 prereq 检查 + 卡闸文案分支）', (function () {
      var ok = /var upPre = GAME\.buildPrereqOf\(c, e\.type, e\.lv \+ 1, e\);/.test(u235)
        && /GAME\.buildCapOf\(c, e\.type, e\)/.test(u235)
        && /upPre\.ok \? '已达最高等级' : U\.escape\(ui\.prereqText\(c, upPre\)\)/.test(u235);
      window.__r235d = 'ok=' + ok;
      return ok;
    })(), window.__r235d || '');

    /* ⑤ 素材清理在册：5 过时项已删 + 备份留存 + 保留面在岗 + 生成器注释换代 */
    check('§235⑤ 素材清理在册（5 删 · 备份留 · 保留面在岗 · bitmaps 注释换代）', (function () {
      var R2 = __dirname;
      var DEL = ['1.png', '2.png', '3.png', '4.png', 'atlas_D_src.jpeg'];
      var gone = DEL.every(function (f) {
        return !fs235.existsSync(path235.join(R2, 'assets', 'icons', 'raw', f));
      });
      var bak = DEL.every(function (f) {
        return fs235.existsSync(path235.join(R2, '.workbuddy', 'backup', 'v89235s-icons', f));
      });
      var kept = ['atlas_A_src.png', 'atlas_B_src.png', 'atlas_C_src.png', 'atlas_D_src.png'].every(function (f) {
        return fs235.existsSync(path235.join(R2, 'assets', 'icons', 'raw', f));
      }) && fs235.existsSync(path235.join(R2, 'assets', 'icons', 'ui', 'ai_banche.png'));
      var bm = fs235.readFileSync(path235.join(R2, 'js', 'bitmaps.js'), 'utf8');
      var bmOk = bm.indexOf('废土风图标（余烬纪元）') >= 0 && bm.indexOf('汉代') < 0;
      window.__r235e = 'gone=' + gone + ' bak=' + bak + ' kept=' + kept + ' bm=' + bmOk;
      return gone && bak && kept && bmOk;
    })(), window.__r235e || '');

    /* ⑥ 版本与档案在册（v89.235 · 老板三条逐字） */
    check('§235⑥ 版本与档案在册（v89.235 · 老板三条逐字）', (function () {
      var arc = fs235.readFileSync(path235.join(__dirname, '需求档案.md'), 'utf8');
      var ok = /GAME\.VERSION = 'v89\.235'/.test(m235)
        && arc.indexOf('v89.235') >= 0
        && arc.indexOf('政务厅等级位置不对') >= 0;
      window.__r235f = 'ver=' + /GAME\.VERSION = 'v89\.235'/.test(m235)
        + ' 档案=' + (arc.indexOf('v89.235') >= 0);
      return ok;
    })(), window.__r235f || '');
  })();
'''

ANCHOR = "  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"


def rep_file(rel, tag, old, new, mark, cnt=1):
    s = io.open(R + rel, encoding='utf-8', newline='').read()
    if s.count(mark) >= 1:
        LOG.append('[skip] ' + rel + ' | ' + tag)
        return s
    c = s.count(old)
    if c != cnt:
        FAIL.append('!! %s | %s count=%d want=%d' % (rel, tag, c, cnt))
        return s
    s = s.replace(old, new, cnt)
    LOG.append('[ok] %s | %s' % (rel, tag))
    if APPLY:
        io.open(R + rel, 'w', encoding='utf-8', newline='').write(s)
    return s


# ---- §235 段插入（在 console.log 结果 之前）----
rep_file('smoke-test.js', '§235 段',
    ANCHOR,
    SEC.rstrip('\n') + "\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
    '§235 政务厅角标 · 城外政务厅闸 · 素材清理')

# ---- §199④ 版本 ----
rep_file('smoke-test.js', '§199④ v235',
    r"/GAME\.VERSION = 'v89\.234'/",
    r"/GAME\.VERSION = 'v89\.235'/",
    r"/GAME\.VERSION = 'v89\.235'/")

# ---- main.js 版本 ----
rep_file('js/main.js', 'main v235',
    "GAME.VERSION = 'v89.234';",
    "GAME.VERSION = 'v89.235';",
    "GAME.VERSION = 'v89.235';")

if FAIL:
    print('== FAIL ==')
    for x in FAIL:
        print(' ', x)
    sys.exit(1)
print('== %s ==' % ('APPLIED' if APPLY else 'DRY-RUN'))
for x in LOG:
    print(' ', x)

# -*- coding: utf-8 -*-
"""v89.144 —— smoke-test.js 断言升级（D1：5 条打穿面）
   ⑦ 出征界面：全带/清空 → 行内 [上限][清空]
   §113③：节钺入口页签 act → expand
   §114①：页签顺序（7 个）
   §114②：节钺卡迁到独立页签
   §123⑥：行内上限出口 + 三口径（含真调 min(拥有, 额度−其他行)）
"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

def save(tag):
    assert '\r\n' not in s, '行尾被写成 CRLF'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('  [saved] ' + tag + '  len=' + str(len(s)))

def rep(old, new, tag, done_when=None, count=1):
    global s
    if done_when and done_when in s:
        print('  [skip]  ' + tag + '（已落）')
        return
    n = s.count(old)
    assert n == count, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('  [ok]    ' + tag)

# ---------- ⑦ ----------
rep(
"""  check('⑦ 结构：总览/战力行 + 全带/清空按钮 + 动作注册', (function () {
    return /id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)
      && /data-action="exp-fill-all"/.test(uS) && /data-action="exp-clear-all"/.test(uS)
      && /case 'exp-fill-all'/.test(mS) && /case 'exp-clear-all'/.test(mS)
      && /ui\\._expRes = t/.test(uS);
  })());""",
"""  check('⑦ 结构：总览/战力行 + 每兵种行 [上限][清空]（v89.144 起从标题栏挪进行内）+ 动作注册', (function () {
    return /id="exp-sum"/.test(uS) && /id="exp-power"/.test(uS)
      && /data-action="exp-max"/.test(uS) && /data-action="exp-zero"/.test(uS)
      && /case 'exp-max'/.test(mS) && /case 'exp-zero'/.test(mS)
      && /ui\\.expTroopMaxOf = function/.test(uS) && /ui\\.expTroopTipOf = function/.test(uS)
      && /ui\\._expRes = t/.test(uS);
  })());""",
    '⑦ 出征界面结构',
    done_when='每兵种行 [上限][清空]（v89.144 起从标题栏挪进行内）')

save('D1-⑦')

# ---------- §113③ ----------
rep(
"""        /* v89.133：校场面板退役 —— 节钺·校场扩编入口改在「军务 · 出征」页 */
        G.ui._marchTab = 'act';""",
"""        /* v89.144（老板 3）：节钺·校场扩编入口随「军队校场扩容」独立页签（军务总览右边） */
        G.ui._marchTab = 'expand';""",
    '§113③ 页签改 expand',
    done_when="G.ui._marchTab = 'expand';")

save('D1-§113③')

# ---------- §114① ----------
rep(
"""    check('§114① 军务六页签 · 出征/防守战术改名 · 顺序（总览→出征→出征战术→防守战术→烽火→军务处）', (function () {
      var t = G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|');
      return t === '军务总览|出征|出征战术|防守战术|烽火|军务处';
    })(), G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|'));""",
"""    check('§114①/§144 军务七页签 · 顺序（总览→**军队校场扩容**→出征→出征战术→防守战术→烽火→军务处）', (function () {
      var t = G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|');
      return t === '军务总览|军队校场扩容|出征|出征战术|防守战术|烽火|军务处';
    })(), G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|'));""",
    '§114① 页签顺序',
    done_when="t === '军务总览|军队校场扩容|出征|出征战术|防守战术|烽火|军务处'")

save('D1-§114①')

# ---------- §114② ----------
rep(
"""    check('§114② 节钺·校场扩编入口随面板迁到出征页（入口不丢）', (function () {
      var h = G.ui.marchActHTML();
      return h.indexOf('data-action="jieyue-xc"') >= 0 && h.indexOf('校场扩编') >= 0
        && h.indexOf('marchCapOf') < 0;    /* 走 jieyueExpandOf / marchCapOf 出口（界面不自己算） */
    })());""",
"""    check('§114②/§144 节钺·校场扩编入口随「军队校场扩容」独立页签（入口不丢 · 出征页已无此卡）', (function () {
      var h = G.ui.marchExpandHTML();
      var hact = G.ui.marchActHTML();
      return h.indexOf('data-action="jieyue-xc"') >= 0 && h.indexOf('校场扩编') >= 0
        && h.indexOf('marchCapOf') < 0               /* 走 marchCapOf 出口（界面不自己算） */
        && hact.indexOf('jieyue-xc') < 0             /* 整块搬家：出征页不再渲染该卡 */
        && hact.indexOf('作战能力') < 0;
    })());""",
    '§114② 节钺卡搬家',
    done_when='hact.indexOf(\'jieyue-xc\') < 0')

save('D1-§114②')

# ---------- §123⑥ ----------
rep(
"""      var src = rd123('ui.js');
      var okSrc = /上限<\\/button>/.test(src) && !/全带<\\/button>/.test(src)
        && /ui\\.expFillCapOf = function/.test(u123)
        && /ui\\.expFillTipOf = function/.test(u123)
        && /ui\\.expFillCapOf\\(c74, ui\\._expRes, ui\\._expMode\\)/.test(m123);""",
"""      var okSrc = /data-action="exp-max"/.test(u123) && /data-action="exp-zero"/.test(u123)
        && !/data-action="exp-fill-all"/.test(u123) && !/data-action="exp-clear-all"/.test(u123)
        && /ui\\.expFillCapOf = function/.test(u123)
        && /ui\\.expFillTipOf = function/.test(u123)
        && /ui\\.expTroopMaxOf = function/.test(u123)
        && /ui\\.expFillCapOf\\(city \\|\\| GAME\\.currentCity\\(\\), ui\\._expRes, modeId\\)/.test(u123);""",
    '§123⑥ okSrc 升级',
    done_when='ui\\.expTroopMaxOf = function/.test(u123)')

rep(
"""        var capWild = G.ui.expFillCapOf(c, { kind: 'wild', x: wx, y: wy }, 'station');
        w.garrison = null;
        return okSrc
          && capCity === GAME.battle.marchCapOf(tmp) && capCity > 0
          && capWild === GAME.wildGarrisonCap(5) - 8000
          /* 无校场 → null（不设限，与 prepare 的 cap>0 判据同规） */
          && G.ui.expFillCapOf({ id: 'noXc142', cells: [], army: {} }, { kind: 'city', id: 'y' }, 'occupy') === null;""",
"""        var capWild = G.ui.expFillCapOf(c, { kind: 'wild', x: wx, y: wy }, 'station');
        w.garrison = null;
        /* v89.144（老板 2）：**行内「上限」出口**真调 —— min(拥有, 额度 − 其他行已填)。
           桩 DOM 摆 max/value（用完还原，避免污染后续"真开出征面板"的用例）。 */
        var keptRes144 = G.ui._expRes;
        var bk144 = [];
        Object.keys(DATA.TROOPS).forEach(function (id) {
          var elx = global.document.getElementById('exp-' + id);
          bk144.push([elx, elx.max, elx.value]);
          elx.max = 0; elx.value = '0';
        });
        var mOwn144, mOwn2_144, mNoCap144;
        try {
          G.ui._expRes = { kind: 'city', id: 'zzz144' };        /* 非 owncity/ownwild → 落"校场容量"口径 */
          var eOwn144 = global.document.getElementById('exp-yibing');
          var eOther144 = global.document.getElementById('exp-gongjian');
          eOwn144.max = 5000; eOther144.max = 9999; eOther144.value = '1200';
          mOwn144 = G.ui.expTroopMaxOf('yibing', tmp, 'occupy');            /* min(5000, cap−1200) */
          eOwn144.max = 80000;
          mOwn2_144 = G.ui.expTroopMaxOf('yibing', tmp, 'occupy');          /* min(80000, cap−1200) */
          mNoCap144 = G.ui.expTroopMaxOf('yibing', { id: 'noXc144', cells: [], army: {} }, 'occupy');
        } finally {
          G.ui._expRes = keptRes144;
          bk144.forEach(function (r) { r[0].max = r[1]; r[0].value = r[2]; });
        }
        return okSrc
          && capCity === GAME.battle.marchCapOf(tmp) && capCity > 0
          && capWild === GAME.wildGarrisonCap(5) - 8000
          /* 无校场 → null（不设限，与 prepare 的 cap>0 判据同规） */
          && G.ui.expFillCapOf({ id: 'noXc142', cells: [], army: {} }, { kind: 'city', id: 'y' }, 'occupy') === null
          && mOwn144 === Math.min(5000, capCity - 1200)
          && mOwn2_144 === Math.max(0, Math.min(80000, capCity - 1200))
          && mNoCap144 === 80000;""",
    '§123⑥ 行内真调',
    done_when="mOwn144 === Math.min(5000, capCity - 1200)")

save('D1-§123⑥')

print('\nALL OK · len ' + str(orig_len) + ' -> ' + str(len(s)))

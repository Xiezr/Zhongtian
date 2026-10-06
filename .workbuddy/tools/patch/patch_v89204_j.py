# -*- coding: utf-8 -*-
"""v89.204 批次 J：断言升级（smoke 7 处 + e2e 1 处）
  J1 smoke 3793 "大尺寸档位仍在使用"：size:'lg' 随 openForgeSetInfo 退净 -> 改 size:'xxl'
  J2 smoke 7556 独立小窗断言 -> 整条退役断言
  J3 smoke 7573 分栏断言去掉 forgeSetNote 子句
  J4 smoke 7580 实测一览 -> 改验数据本体
  J5 smoke 6117/6118 共享选择器正则去 .fsn-t
  J6 smoke 16666 同
  J7 smoke 25106 切片边界 openForgeSetInfo -> ENH_PER_PAGE
  J8 smoke 27906 同
  J9 e2e 6414 一览断言 -> 退役断言
"""
import io

PS = 'E:/Deepseekdb/smoke-test.js'
PE = 'E:/Deepseekdb/e2e-test.js'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# J1
rep(PS, 'J1 size 档位',
    """  check('大尺寸档位仍在使用（将领已改整页，不再有详情弹窗）',
    /size: 'lg'/.test(uiS) && !/ui\\.openModal\\(html, 'lg'\\)/.test(uiS));""",
    """  /* v89.204（老板 2）规则变更：size:'lg' 的最后使用者（套装一览小窗）随功能退役 ——
     判据改用最高档 xxl（"大尺寸档位仍在使用"的语义不变）。 */
  check('大尺寸档位仍在使用（将领已改整页，不再有详情弹窗）',
    /size: 'xxl'/.test(uiS) && !/ui\\.openModal\\(html, 'lg'\\)/.test(uiS));""",
    "判据改用最高档 xxl")

# J2
rep(PS, 'J2 退役断言',
    """  check('「套装效果一览」从正文移到独立小窗，且动作已接线（不是孤儿按钮）', (function () {
    var m = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');
    return /data-action="forge-setinfo"/.test(fnBody(uS38, 'ui.openForge = function'))
      && /case 'forge-setinfo': ui\\.openForgeSetInfo\\(\\); break;/.test(m)
      && /ui\\.openForgeSetInfo = function/.test(uS38);
  })());""",
    """  /* v89.204（老板 2）：「打造界面不要'套装效果一览'」规则变更 —— 该功能整条退役：
     按钮 / 函数 / case 三处零残留（查定义式与可执行形态，防墓碑注释误判）。 */
  check('v89.204：「套装效果一览」整条退役（按钮/函数/case 零残留 · 数据仍在）', (function () {
    var m = require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8');
    var seg = fnBody(uS38, 'ui.openForge = function');
    return seg.indexOf('data-action="forge-setinfo"') < 0
      && m.indexOf("case 'forge-setinfo':") < 0
      && uS38.indexOf('ui.openForgeSetInfo = function') < 0
      && uS38.indexOf('ui.forgeSetNote = function') < 0
      /* 套装数据与筛选仍在（只是不再有一览表） */
      && /ui\\.setForgeKind = function/.test(uS38) && !!DATA.SETS;
  })());""",
    '整条退役（按钮/函数/case 零残留')

# J3
rep(PS, 'J3 分栏断言',
    """  check('打造界面把套装与散件分开（数据 + 交互）',
    /ui\\.setForgeKind = function/.test(uS38) && /data-action="forge-kind"/.test(uS38)
    && /case 'forge-kind'/.test(mS38) && /ui\\.forgeSetNote = function/.test(uS38));""",
    """  check('打造界面把套装与散件分开（数据 + 交互）· v89.204 起不再依赖一览表',
    /ui\\.setForgeKind = function/.test(uS38) && /data-action="forge-kind"/.test(uS38)
    && /case 'forge-kind'/.test(mS38));""",
    'v89.204 起不再依赖一览表')

# J4
rep(PS, 'J4 数据本体',
    """  check('实测：套装效果一览列出全部套与四档', (function () {
    /* v89.50：原先写死"三套"（fsn-row ×3 / 3 件 ×3 / 11 件 ×3）——
       加新套（v89.50 一次加了 4 套）必假红。改为**按 DATA.SETS 现算**：
       每套一行、每套四档齐全，且七套名字都出现在一览里。 */
    var h = G.ui.forgeSetNote();
    var ids = Object.keys(DATA.SETS);
    var rows = (h.match(/fsn-row/g) || []).length;
    var allNames = ids.every(function (k) { return h.indexOf(DATA.SETS[k].name) >= 0; });
    return ids.length >= 3 && allNames && rows === ids.length
      && (h.match(/3 件/g) || []).length === ids.length
      && (h.match(/11 件/g) || []).length === ids.length;
  })(), Object.keys(DATA.SETS).length + ' 套');""",
    """  /* v89.204 规则变更：一览表退役，但**套装数据与档位机制**（3/5/7/11 累计生效）不动 ——
     改验数据本体（原先的"一行一套 / 四档齐全"验的是一览表渲染，随功能退役）。 */
  check('实测：套装数据仍在（每套有名称与档位加成 · v89.204 一览表退役后）', (function () {
    var ids = Object.keys(DATA.SETS);
    var allNames = ids.every(function (k) { return !!(DATA.SETS[k].name && DATA.SETS[k].bonus); });
    return ids.length >= 3 && allNames;
  })(), Object.keys(DATA.SETS).length + ' 套');""",
    '套装数据仍在（每套有名称与档位加成')

# J5
rep(PS, 'J5 共享标题断言',
    """  check('分区小标题同一规格（v82 扩员：q-det-sec/gp-sec/fsn-t/op-zone-t/seal-h）',
    /\\.q-sec-t, \\.q-det-sec, \\.bag-sec, \\.gd-sec, \\.forge-q, \\.m-sec, \\.side-title, \\.wb-t,[\\s\\S]{0,140}\\.gp-sec, \\.fsn-t, \\.op-zone-t, \\.seal-h \\{[\\s\\S]{0,260}font-size: var\\(--fs-h3\\)/.test(css34));""",
    """  check('分区小标题同一规格（v82 扩员；v89.204 起 .fsn-t 随套装一览退役）',
    /\\.q-sec-t, \\.q-det-sec, \\.bag-sec, \\.gd-sec, \\.forge-q, \\.m-sec, \\.side-title, \\.wb-t,[\\s\\S]{0,140}\\.gp-sec, \\.op-zone-t, \\.seal-h \\{[\\s\\S]{0,260}font-size: var\\(--fs-h3\\)/.test(css34));""",
    'v89.204 起 .fsn-t 随套装一览退役')

# J6
rep(PS, 'J6 §82 断言',
    """      /\\.q-sec-t, \\.q-det-sec, \\.bag-sec[\\s\\S]{0,240}\\.gp-sec, \\.fsn-t, \\.op-zone-t, \\.seal-h \\{/.test(h82)""",
    """      /* v89.204（老板 2）：.fsn-t 随套装一览退役（选择器里已无它） */
      /\\.q-sec-t, \\.q-det-sec, \\.bag-sec[\\s\\S]{0,240}\\.gp-sec, \\.op-zone-t, \\.seal-h \\{/.test(h82)""",
    'v89.204（老板 2）：.fsn-t 随套装一览退役')

# J7
rep(PS, 'J7 切片边界一',
    """      var s2 = u97.slice(u97.indexOf('ui.openForge = function'));
      s2 = s2.slice(0, s2.indexOf('ui.openForgeSetInfo = function'));""",
    """      var s2 = u97.slice(u97.indexOf('ui.openForge = function'));
      /* v89.204：openForgeSetInfo 随套装一览退役 —— 边界改下一个稳定标记（百炼段起点） */
      s2 = s2.slice(0, s2.indexOf('ui.ENH_PER_PAGE'));""",
    '边界改下一个稳定标记（百炼段起点）')

# J8
rep(PS, 'J8 切片边界二',
    """      var s2 = uc.slice(uc.indexOf('ui.openForge = function'), uc.indexOf('ui.openForgeSetInfo = function'));""",
    """      /* v89.204：openForgeSetInfo 随套装一览退役 —— 边界改下一个稳定标记 */
      var s2 = uc.slice(uc.indexOf('ui.openForge = function'), uc.indexOf('ui.ENH_PER_PAGE'));""",
    '边界改下一个稳定标记\n')

# J9 e2e
rep(PE, 'J9 e2e 退役',
    """    check('v89.50：套装效果一览列出 7 套（含四套新套）', (function () {
      const h = G.ui.forgeSetNote();
      const names = ['倚天套', '名将套', '神武套', '游侠套', '陷阵套', '守御套', '天策套'];
      return names.every((n) => h.indexOf(n) >= 0)
        && (h.match(/fsn-row/g) || []).length === 7;
    })());""",
    """    /* v89.204（老板 2）：「套装效果一览」整条退役（函数/按钮/case 全删）——
       改验**数据本体**：七套在册且各有名称（v89.50 的"新套可见"语义由数据侧承载，
       一览表渲染随功能退役）。 */
    check('v89.204：套装效果一览已退役 · 套装数据仍在（7 套）', (function () {
      const names = ['倚天套', '名将套', '神武套', '游侠套', '陷阵套', '守御套', '天策套'];
      const gone = typeof G.ui.forgeSetNote !== 'function' && typeof G.ui.openForgeSetInfo !== 'function';
      const ids = Object.keys(G.DATA.SETS);
      return gone && ids.length === 7
        && names.every((n) => ids.some((k) => G.DATA.SETS[k].name === n));
    })());""",
    '套装效果一览已退役 · 套装数据仍在（7 套）')

print('patch J done')

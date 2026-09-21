# -*- coding: utf-8 -*-
"""v89.86 整改 · P-02 favicon + P-15 客栈空位引导 + P-26 新城裸城提示
   · P-02：index.html 补 data-URI favicon（消除固定 404，零外部文件）
   · P-15：客栈无空位 → 提示"升招贤馆至 LvN 可添 1 席"（按钮 title + 顶部提示）
   · P-26：筑城成功 → 守备 0 风险弹窗 + "从主城调兵"快捷入口（复用 openTroopMove）
"""
import io
import os
import sys

HT = r'E:\Deepseekdb\index.html'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return src
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)
    return back


# ============ P-02 · favicon（data URI，无外部文件） ============
edit(HT, r"""<title>热血三国·单机版</title>""",
     r"""<title>热血三国·单机版</title>
<!-- v89.86（整改 P-02）：补 favicon（data URI，国风红旗 + 金杆）——
     此前每次会话固定一条 404（浏览器自动请求 /favicon.ico），真机上看着像故障。 -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231e222b'/%3E%3Cpath d='M8 26V6h3v20z' fill='%23cfa856'/%3E%3Cpath d='M11 7h13l-3.4 4.6L24 16.2H11z' fill='%23b8342b'/%3E%3C/svg%3E">""",
     'P-02 · favicon')

# ============ P-15 · 客栈空位升级引导 ============
edit(UI, r"""    var left = Math.ceil(GAME.innRefreshLeft() / 1000);
    var leftTxt = left > 0 ? (left + ' 秒后自动更换') : '可更换';""",
     r"""    var left = Math.ceil(GAME.innRefreshLeft() / 1000);
    var leftTxt = left > 0 ? (left + ' 秒后自动更换') : '可更换';
    /* v89.86（整改 P-15）：无空位时的**升级引导** —— 此前只有一句"已无空位"，
       新手不知道升到几级、按钮禁用旁也没有原因（引导链断在这里）。 */
    var slotGuide = '';
    if (cap > 0 && usedIn >= cap) {
      var zxgLv15 = GAME.buildingLevel(city, 'zhaoxianguan') || 0;
      var zxgCap15 = GAME.buildCapOf(city, 'zhaoxianguan');
      slotGuide = (zxgLv15 < zxgCap15)
        ? ('升招贤馆至 Lv' + (zxgLv15 + 1) + ' 可添 1 席')
        : ('招贤馆已至上顶（Lv' + zxgCap15 + '）—— 可把将领派往他城腾位');
    }""",
     'P-15 · 客栈空位引导计算')

edit(UI, r"""          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') + '>' + (c.beauty ? '相亲' : '招募') + '</button>' +""",
     r"""          '<button class="btn sm' + (can ? ' gold' : '') + '" data-action="inn-recruit" data-id="' + c.id + '"' +
            (can ? '' : ' disabled') +
            /* v89.86（整改 P-15）：按钮旁给出禁用原因（无空位 → 升级引导；缺金 → 金不足） */
            (can ? '' : ' title="' + U.escape(slotGuide || chk.msg || ('金不足（需 ' + U.fmt(c.cost) + '）')) + '"') +
            '>' + (c.beauty ? '相亲' : '招募') + '</button>' +""",
     'P-15 · 招募按钮 title')

edit(UI, r"""        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + '</div>') +""",
     r"""        (chk.ok ? '' : '<div class="note-warn">' + U.escape(chk.msg) + (slotGuide ? '　·　' + slotGuide : '') + '</div>') +""",
     'P-15 · 顶部提示补引导')

# ============ P-26 · 新城落成提示 ============
edit(UI, r"""  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;""",
     r"""  /* ============================================================
   * v89.86（整改 P-26）：新城落成的守备风险提示 ——
   * 新城初始守备力 0（无驻军、无城墙），实测首波入侵即被攻破
   * （小损 + 声望 −5，城不丢）。此前建成后没有任何提示，玩家第一次
   * 意识到风险往往是在战报里。这里把"当前事实 + 下一步"一次给全，
   * 并**复用跨城调兵出口**（ui._tmTo + openTroopMove）做一键补防。
   * ============================================================ */
  ui.openNewCityNotice = function (city) {
    if (!city) return;
    var from = GAME.mainCityOf() || GAME.currentCity();
    if (from && from.id === city.id) from = null;
    var def = GAME.defensePowerOf ? (GAME.defensePowerOf(city) || 0) : 0;
    ui.openShell({
      title: '🏯 新城落成 · ' + U.escape(city.name),
      sub: '(' + city.x + ',' + city.y + ')　守备力 ' + U.fmt(def),
      size: 'sm',
      body:
        '<div class="note-warn">⚠️ 新城当前守备力 <b>' + U.fmt(def) +
          '</b>（无驻军、无城墙）——若有兵马犯境会被攻破：损失资源与声望，<b>城池不会丢</b>。</div>' +
        '<div class="res-line"><span class="lbl">建议</span><span class="val">尽快派驻军队 / 修建城墙；有条件先建烽火台延长预警</span></div>' +
        (from ? '<div class="res-line" style="border-bottom:0;"><span class="lbl">可调兵来源</span><span class="val">' +
          U.escape(from.name) + '　在城兵力 ' + U.numText(GAME.armyTotal(from), 0) + '</span></div>' : ''),
      foot: '<div class="m-foot">' +
        (from ? '<button class="btn gold" data-action="newcity-send-troop" data-from="' + from.id + '" data-to="' + city.id + '">⚔ 从' + U.escape(from.name) + '调兵</button>' : '') +
        '<button class="btn" data-action="close-modal">稍后再说</button></div>'
    });
  };

  ui.openLandModal = function (x, y) {
    var RES_NAME = ui.RES_NAME;""",
     'P-26 · openNewCityNotice')

edit(MA, r"""      case 'build-city': (function () { var xy = ui._buildCityXY; if (!xy) return; var r = GAME.buildCityAt(xy.x, xy.y); ui.toast(r.msg); if (r.ok) { ui.closeModal(); GAME.refreshAll(); ui.sgTryAct('build-city'); } })(); break;""",
     r"""      /* v89.86（整改 P-26）：筑城成功 → 守备 0 风险提示 + 一键调兵（此前"裸城无提示"） */
      case 'build-city': (function () {
        var xy = ui._buildCityXY; if (!xy) return;
        var r = GAME.buildCityAt(xy.x, xy.y);
        ui.toast(r.msg);
        if (r.ok) {
          ui.closeModal();
          GAME.refreshAll();
          ui.openNewCityNotice(r.city);
          ui.sgTryAct('build-city');
        }
      })(); break;
      /* v89.86（P-26）：新城提示里的"从主城调兵" —— 复用跨城调兵出口（openTroopMove） */
      case 'newcity-send-troop': {
        var _ncFrom = GAME.cityById(el.dataset.from);
        var _ncTo = el.dataset.to;
        if (!_ncFrom || !_ncTo) break;
        ui.closeModal();
        ui._tmTo = ui._tmTo || {}; ui._tmTo[_ncFrom.id] = _ncTo;
        ui.openTroopMove(_ncFrom.id);
        break;
      }""",
     'P-26 · 筑城成功挂提示 + 调兵入口')

print('DONE')

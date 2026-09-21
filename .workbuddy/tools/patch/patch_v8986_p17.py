# -*- coding: utf-8 -*-
"""v89.86 整改 · P-17 离线推进上限
   现状：离线 10 小时 → 游戏内约 80 年（120×；改元/月俸 7 期/神器连跳），年代感被冲淡。
   修法：设置「离线推进上限」（1/3/7/30 游戏日 / 不限，默认 7 日）——
        超过的部分**不再推进**（历法/年号/月俸/入侵/队列一体受限），
        但按五折折算为资源与神器供奉（不白过）。
"""
import io
import os
import sys

ST = r'E:\Deepseekdb\js\state.js'
UI = r'E:\Deepseekdb\js\ui.js'
MA = r'E:\Deepseekdb\js\main.js'
DA = r'E:\Deepseekdb\js\data.js'


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


# ============ data.js · 默认设置 ============
edit(DA, r"""    /* v89.86（整改 P-18）：自动化预算闸门 —— 每次消费后至少留下花前存量的 pct%；0 = 不设限 */
    autoReservePct: 5, autoTechMaxLv: 0 };""",
     r"""    /* v89.86（整改 P-18）：自动化预算闸门 —— 每次消费后至少留下花前存量的 pct%；0 = 不设限 */
    autoReservePct: 5, autoTechMaxLv: 0,
    /* v89.86（整改 P-17）：离线推进上限（游戏日；0 = 不限）—— 超出部分五折折算资源/供奉 */
    offlineCapDays: 7 };""",
     'P-17 · 默认设置')

# ============ state.js · 上限 + 折算段 + 补算分流 ============
edit(ST, r"""  GAME.offlineCatchup = function (secReal) {
    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    var exact = Math.min(secReal, OFFLINE_EXACT_MAX);
    var bulk = secReal - exact;
    GAME._offline = true;
    if (exact >= 1) GAME.simulateSeconds(Math.floor(exact));
    if (bulk >= 1) GAME.simulateBulk(bulk);
    GAME._offline = false;
    GAME._offlineSec = secReal;   // 供 UI 提示离线补算量""",
     r"""  /* v89.86（整改 P-17）：离线推进上限 —— 单位=游戏日；0=不限（默认 7 日）。
     老板实测：离线 10.16 小时 = 游戏内约 80 年（120×）—— 改元/月俸/神器连跳，
     "离线一夜、人间百年"，长线经营的年代感被冲淡。 */
  GAME.offlineCapDays = function () {
    var s = GAME.state;
    var v = (s && s.settings && s.settings.offlineCapDays);
    if (v == null) return 7;
    return Math.max(0, Math.min(365, Number(v) || 0));
  };
  /* 超限时间段的**五折折算**（v89.86 · P-17）——
     资源 = 产量 × 现实秒 × 0.5（受仓容约束，黄金不设上限，与既有口径一致）；
     供奉值 = 游戏时 × 速率 × 0.5（走 artGain 唯一入口）。
     不推进历法/年号/月俸/入侵/队列 —— 这正是"上限"的本体。 */
  GAME.simulateOfflineOverflow = function (secReal) {
    var s = GAME.state, ts = GAME.timeScale();
    if (!s || secReal <= 0) return;
    var rate = 0.5;
    s.cities.forEach(function (ct) {
      var prod = GAME.cityProdPerSec(ct);
      var cap = GAME.storeCapOf(ct);
      var R = GAME.res(ct);
      for (var k in prod) {
        if (k === 'pop') continue;
        R[k] = (R[k] || 0) + prod[k] * secReal * rate;
        if (k !== 'gold' && cap > 0 && R[k] > cap) R[k] = cap;
      }
    });
    if (GAME.artGain && DATA.ARTIFACT && DATA.ARTIFACT.perGameHour) {
      GAME.artGain(ts * secReal / 3600 * DATA.ARTIFACT.perGameHour * rate, '');
    }
  };
  GAME.offlineCatchup = function (secReal) {
    var s = GAME.state;
    if (!s) return 0;
    secReal = Math.max(0, secReal);
    if (secReal <= 5) return 0;
    /* v89.86（整改 P-17）：先按「离线推进上限」分流 —— 上限内的照常全保真补算；
       超限段只做五折折算（资源/供奉），其余系统不再推进。0 日=不限。 */
    var ts0 = GAME.timeScale();
    var capGameSec = GAME.offlineCapDays() * 86400;
    var applied = secReal, overflow = 0;
    GAME._offlineOverflow = 0;
    if (capGameSec > 0 && secReal * ts0 > capGameSec) {
      applied = capGameSec / ts0;
      overflow = secReal - applied;
      GAME._offlineOverflow = overflow;
    }
    var exact = Math.min(applied, OFFLINE_EXACT_MAX);
    var bulk = applied - exact;
    GAME._offline = true;
    if (exact >= 1) GAME.simulateSeconds(Math.floor(exact));
    if (bulk >= 1) GAME.simulateBulk(bulk);
    if (overflow >= 1) GAME.simulateOfflineOverflow(overflow);
    GAME._offline = false;
    GAME._offlineSec = secReal;   // 供 UI 提示离线补算量""",
     'P-17 · 上限与折算段')

# ============ ui.js · 设置卡 + 载入提示 ============
edit(UI, r"""      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">⏱️ 时间倍率</span><span class="val">' + ts + '×</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'timescale',
          opts: [1, 10, 30, 120, 300, 600].map(function (v) {
            return { v: v, on: ts === v, label: v + '×' };
          })
        }) + '</div>' +
      '</div>' +""",
     r"""      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">⏱️ 时间倍率</span><span class="val">' + ts + '×</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'timescale',
          opts: [1, 10, 30, 120, 300, 600].map(function (v) {
            return { v: v, on: ts === v, label: v + '×' };
          })
        }) + '</div>' +
      '</div>' +
      /* v89.86（整改 P-17）：离线推进上限 —— 防"离线一夜、人间百年"；超出五折折算 */
      '<div class="set-card">' +
        '<div class="res-line"><span class="lbl">🕰️ 离线推进上限</span><span class="val">' +
          (GAME.offlineCapDays() ? (GAME.offlineCapDays() + ' 游戏日') : '不限') + '</span></div>' +
        '<div class="auto-line">' + ui.chips({
          cls: 'chips-xs', after: 'offlinecap',
          opts: [[1, '1 日'], [3, '3 日'], [7, '7 日'], [30, '30 日'], [0, '不限']].map(function (kv) {
            return { v: kv[0], on: GAME.offlineCapDays() === kv[0], label: kv[1] };
          })
        }) + '</div>' +
        '<div class="ui-sub" style="margin-top:6px;">离线补算最多推进这么久（历法 / 年号 / 月俸 / 入侵 / 队列一体受限）；' +
          '超出的时间按<b>五折</b>折算为资源与神器供奉 —— 不白过，也不再"一夜百年"。</div>' +
      '</div>' +""",
     'P-17 · 设置卡')

edit(UI, r"""    var off = GAME._offlineSec || 0;
    var offTxt = '';
    if (off >= 60) {
      offTxt = off >= 3600 ? ('离城 ' + (off / 3600).toFixed(1) + ' 时，已补算')
                           : ('离城 ' + Math.round(off / 60) + ' 分，已补算');
    }""",
     r"""    var off = GAME._offlineSec || 0;
    var offTxt = '';
    if (off >= 60) {
      offTxt = off >= 3600 ? ('离城 ' + (off / 3600).toFixed(1) + ' 时，已补算')
                           : ('离城 ' + Math.round(off / 60) + ' 分，已补算');
      /* v89.86（整改 P-17）：触发推进上限时明示（超限段五折折算） */
      if ((GAME._offlineOverflow || 0) > 0) {
        offTxt += '·上限 ' + GAME.offlineCapDays() + ' 日，超出五折折算';
      }
    }""",
     'P-17 · 载入提示')

# ============ main.js · chip 处理 ============
edit(MA, r"""        /* v89.86（P-18）：自动化预算闸门 / 自动研究上限 */
        else if (after === 'autofin') GAME.doSetAutoFin(el.dataset.k, el.dataset.v);
        break;""",
     r"""        /* v89.86（P-18）：自动化预算闸门 / 自动研究上限 */
        else if (after === 'autofin') GAME.doSetAutoFin(el.dataset.k, el.dataset.v);
        /* v89.86（P-17）：离线推进上限 */
        else if (after === 'offlinecap') GAME.doSetOfflineCap(el.dataset.v);
        break;""",
     'P-17 · chip 分支')

edit(MA, r"""  /* v89.86（整改 P-18）：自动研究开关（原为一行内联写法 —— 补 toast 与保留线提示） */""",
     r"""  /* v89.86（整改 P-17）：离线推进上限（游戏日；0=不限） */
  GAME.doSetOfflineCap = function (v) {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    s.settings.offlineCapDays = Math.max(0, Math.min(365, Number(v) || 0));
    ui.toast(s.settings.offlineCapDays
      ? ('离线推进上限：' + s.settings.offlineCapDays + ' 游戏日（超出部分五折折算）')
      : '离线推进上限：不限（保持原口径）');
    GAME.refreshView();
  };

  /* v89.86（整改 P-18）：自动研究开关（原为一行内联写法 —— 补 toast 与保留线提示） */""",
     'P-17 · doSetOfflineCap')

print('DONE')

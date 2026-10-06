# -*- coding: utf-8 -*-
"""v89.199 批次 P2：时间跳变补偿加固（唯一出口 loopPulse + 唤醒通道 + 版本标识）
   S1  state.js：loopGapCatchup 段 → _gapCatchupOf + 薄包装 + GAME.loopPulse
   M1  main.js：主循环 gap 头 → loopPulse 调用
   M2  main.js：catchup 分支 → 新词表（skip/error → tickOnce；catchup → toast）
   M3  main.js：boot 前插 GAME.VERSION
   M4  main.js：setInterval 后插 _gapToast*/_wakePulse199 + 双通道监听
   U1A ui.js：存档卡去 margin-bottom:0（让位于新版本卡）
   U1B ui.js：插版本卡
   K1  smoke：§193① 升级（loopPulse）
   K2  smoke：插 §199 段
"""
import io

def rd(p): return io.open(p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, path, old, new, guard):
    s = rd(path)
    if s.count(guard) >= 1:
        print('[skip] ' + tag + '（guard 命中，已落）'); return
    c = s.count(old)
    assert c == 1, tag + ' anchor count=' + str(c)
    wr(path, s.replace(old, new, 1))
    print('[ok] ' + tag)

S = 'E:/Deepseekdb/js/state.js'
M = 'E:/Deepseekdb/js/main.js'
U = 'E:/Deepseekdb/js/ui.js'
K = 'E:/Deepseekdb/smoke-test.js'

# ── S1 state.js：唯一出口 ──
rep('S1 loopPulse 唯一出口', S,
u"""  GAME.loopGapCatchup = function (gapSec) {
    var gate = (DATA.LOOP_GAP || {}).gapSec;
    if (gate == null) gate = 5;
    if (!GAME.state || !(gapSec > gate)) return { mode: 'skip', secReal: 0 };
    GAME.offlineCatchup(gapSec, { silent: true });
    return { mode: 'catchup', secReal: gapSec };
  };""",
u"""  /* 时间跳变补算的**唯一实现**（v89.199 从 loopGapCatchup 原地提取）——
     供两条通道共用：GAME.loopPulse（自取真实钟）与 GAME.loopGapCatchup（显式 gap）。 */
  function _gapCatchupOf(gapSec) {
    var gate = (DATA.LOOP_GAP || {}).gapSec;
    if (gate == null) gate = 5;
    if (!GAME.state || !(gapSec > gate)) return { mode: 'skip', secReal: 0 };
    try {
      GAME.offlineCatchup(gapSec, { silent: true });
    } catch (e) {
      /* v89.199（老板）：补算异常**不再让整拍 tick 崩掉** —— 留痕 + 把锚点回退到
         60 秒前（下拍自动重试这一小段；避免"异常一次吃掉 8 小时"的整段丢失，
         也避免锚点不动时每秒重复扛全量）。 */
      if (window.console && window.console.warn) {
        window.console.warn('[时间跳变] 补算失败（将重试）：' + (e && e.message));
      }
      GAME._loopLastAt = GAME.utils.now() - 60000;
      return { mode: 'error', secReal: gapSec, err: (e && e.message) + '' };
    }
    return { mode: 'catchup', secReal: gapSec };
  }
  /* v89.193 的出口改**薄包装**（与 loopPulse 同源 —— 老测试/工具零改动）：
     传显式 gapSec = 手动指定缺口的补算；主循环已改调 loopPulse（见 main.js）。 */
  GAME.loopGapCatchup = function (gapSec) { return _gapCatchupOf(gapSec); };
  /* ============================================================
   * v89.199（老板）：**主循环脉冲 —— 时间推进的唯一出口**。
   * ------------------------------------------------------------
   * 老板实测：「离线补偿在电脑息屏时不生效，真离线了反而可以」。两条通道此前
   * 可能覆盖不到"睡眠唤醒 / 切回标签"的时机：
   *   ① setInterval 在系统睡眠 / 标签冻结期间停摆，恢复后要等下一拍才发现缺口；
   *   ② 页面"长开不刷新"时跑的是旧会话代码（file:// 不刷新不换新 JS）——
   *      这条用户侧靠"强制刷新 + 设置页版本行"自查（GAME.VERSION）。
   * 处置：把 gap 检测抽成唯一出口 loopPulse（记账 + 决策 + 补算），新增两条触发通道：
   *   · setInterval 每秒（原路径 · main.js 主循环）
   *   · visibilitychange / window focus（醒来 / 切回标签 → **立即**检查）
   * checkVisible=false（非游戏界面）只记账不补算（"无游戏时段"不计缺口 —— v89.193 口径）。
   * 幂等：谁先消费 gap，后到者见 ~0 即 skip —— 通道叠加不重复推进。
   * ============================================================ */
  GAME.loopPulse = function (checkVisible) {
    var now = GAME.utils.now();
    var gap = (now - (GAME._loopLastAt || now)) / 1000;
    GAME._loopLastAt = now;
    if (!GAME.state) return { mode: 'none', gap: gap };
    if (checkVisible === false) return { mode: 'hidden', gap: gap };
    var r = _gapCatchupOf(gap);
    r.gap = gap;
    return r;
  };""",
u"GAME.loopPulse = function (checkVisible) {")

# ── M1 main.js：主循环 gap 头 ──
rep('M1 主循环 gap 头', M,
u"""      var _nowMs193 = GAME.utils.now();
      var _gap193 = (_nowMs193 - (GAME._loopLastAt || _nowMs193)) / 1000;
      GAME._loopLastAt = _nowMs193;
      if (!GAME.state) return;
      if (!$('#screen-game').classList.contains('hidden')) {""",
u"""      /* v89.199（老板）：时间推进的唯一出口 = GAME.loopPulse（记账 + 跳变补算）——
         本 tick 只消费它的结论；"醒来/切回标签立即检查"在下面的唤醒通道。 */
      var _vis199 = false;
      try { _vis199 = !$('#screen-game').classList.contains('hidden'); } catch (e199) { _vis199 = false; }
      var _pulse199 = GAME.loopPulse(_vis199);
      if (!GAME.state) return;
      if (_vis199) {""",
u"var _pulse199 = GAME.loopPulse(_vis199);")

# ── M2 main.js：catchup 分支词表 ──
rep('M2 catchup 分支', M,
u"""        var _cp193 = GAME.loopGapCatchup(_gap193);
        if (_cp193.mode === 'skip') {
          GAME.tickOnce();
        } else if (_gap193 >= (((DATA.LOOP_GAP || {}).toastSec) || 300)) {
          ui.toast('🕰️ 检测到时间跳变，已按现实时间补算 '
            + (_gap193 >= 3600 ? (_gap193 / 3600).toFixed(1) + ' 时' : Math.round(_gap193 / 60) + ' 分钟'));
        }""",
u"""        /* v89.199：mode 词表 = none/hidden/skip/catchup/error —— skip（正常 1 秒档）
           与 error（补算异常已回退锚点）都照常 tickOnce；catchup 已含推进。 */
        if (_pulse199.mode === 'skip' || _pulse199.mode === 'error') {
          GAME.tickOnce();
        } else if (_pulse199.mode === 'catchup' && _pulse199.gap >= _gapToastSec199()) {
          _gapToast199(_pulse199.gap);
        }""",
u"_pulse199.mode === 'skip' || _pulse199.mode === 'error'")

# ── M3 main.js：GAME.VERSION（boot 前） ──
rep('M3 GAME.VERSION', M,
u"  function boot() {",
u"""  /* v89.199（老板）：**运行时版本标识**（唯一来源）——设置页末卡显示它。
     浏览器把已打开的页面留在内存里：更新文件后，**长开不刷新的页面仍跑旧会话代码**
     （这解释了"改了却说没生效"的观感）。老板若发现版本 ≠ 最新交付，按 Ctrl+F5
     强制刷新即获得新代码。⚠️ 每轮迭代更新此字面量（写入交付流程）。 */
  GAME.VERSION = 'v89.199';
  function boot() {""",
u"GAME.VERSION = 'v89.199';")

# ── M4 main.js：唤醒通道 + toast 工具（setInterval 尾后） ──
rep('M4 唤醒通道', M,
u"""    }, 1000);
    /* 自动存档：每 5 分钟一次，覆盖式写入（同键替换，只保留最新一档） */""",
u"""    }, 1000);
    /* v89.199（老板）：**睡眠唤醒 / 切回标签的立即检查通道** ——
       setInterval 在系统睡眠 / 标签冻结时停摆，恢复后本通道先到先查；
       两条通道共用 GAME.loopPulse 唯一出口（幂等：谁先消费 gap，后到者见 ~0 即跳过）。
       命中大缺口 → 同款 toast + 立即整屏刷新（醒来第一眼就是最新状态）。 */
    function _gapToastSec199() { return ((DATA.LOOP_GAP || {}).toastSec) || 300; }
    function _gapToast199(gap) {
      ui.toast('🕰️ 检测到时间跳变，已按现实时间补算 '
        + (gap >= 3600 ? (gap / 3600).toFixed(1) + ' 时' : Math.round(gap / 60) + ' 分钟'));
    }
    function _wakePulse199() {
      if (!GAME.state) return;
      var _vis = false;
      try { _vis = !$('#screen-game').classList.contains('hidden'); } catch (e) { _vis = false; }
      var r = GAME.loopPulse(_vis);
      if (r.mode === 'catchup') {
        if (r.gap >= _gapToastSec199()) _gapToast199(r.gap);
        try { GAME.refreshAll(); } catch (e2) { }
      }
    }
    try {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') _wakePulse199();
      });
      window.addEventListener('focus', function () { _wakePulse199(); });
    } catch (e3) { }
    /* 自动存档：每 5 分钟一次，覆盖式写入（同键替换，只保留最新一档） */""",
u"_wakePulse199 = function () {")

# ── U1A ui.js：存档卡去 margin-bottom:0 ──
rep('U1A 存档卡去 mb0', U,
u"""      /* 存档管理：**唯一入口**（原先页首与页尾各一张卡，现在合并成一张） */
      '<div class="set-card" style="margin-bottom:0;">'""",
u"""      /* 存档管理：**唯一入口**（原先页首与页尾各一张卡，现在合并成一张）
         v89.199：margin-bottom:0 让给其后的「运行版本」卡（末卡收底）。 */
      '<div class="set-card">'""",
u"'<div class=\"set-card\">' +\n        '<div class=\"res-line\"><span class=\"lbl\">💾 存档管理")

# ── U1B ui.js：版本卡插入 ──
rep('U1B 版本卡', U,
u"""        '<div class="ui-sub" style="margin-top:6px;">自动存档每 5 分钟一次（覆盖式写入，只保留最新一档）' +
          ui.help('存档 v3。导入走"第一个空的手动槽"，绝不覆盖已有档。') + '</div>' +
      '</div>' +
      '</div>';""",
u"""        '<div class="ui-sub" style="margin-top:6px;">自动存档每 5 分钟一次（覆盖式写入，只保留最新一档）' +
          ui.help('存档 v3。导入走"第一个空的手动槽"，绝不覆盖已有档。') + '</div>' +
      '</div>' +
      /* v89.199（老板）：**运行版本行** —— 页面"长开不刷新"会一直跑旧会话代码
         （更新文件后旧页面不会自动换新代码），版本不一致时强制刷新即获得最新交付。 */
      '<div class="set-card" style="margin-bottom:0;">' +
        '<div class="res-line"><span class="lbl">🧩 运行版本</span><span class="val">' +
          U.escape(GAME.VERSION || '未知') + '</span></div>' +
        '<div class="ui-sub" style="margin-top:6px;">若与最新交付不一致：按 <b>Ctrl + F5</b> 强制刷新后即加载新代码' +
          ui.help('页面运行的是"打开那一刻"的代码；本行为运行时版本（GAME.VERSION）。') + '</div>' +
      '</div>' +
      '</div>';""",
u"🧩 运行版本")

# ── K1 smoke：§193① 升级 ──
rep('K1 §193① 升级', K,
u"""      return mS193.indexOf('GAME._loopLastAt = GAME.utils.now();') >= 0
        && mS193.indexOf('GAME.loopGapCatchup(_gap193)') >= 0
        && sS193.indexOf('GAME.loopGapCatchup = function') >= 0
        && /DATA.LOOP_GAP = \\{ gapSec: 5, toastSec: 300 \\};/.test(dS193);""",
u"""      return mS193.indexOf('GAME._loopLastAt = GAME.utils.now();') >= 0
        && mS193.indexOf('GAME.loopPulse(_vis199)') >= 0        /* v89.199：主循环消费唯一出口 */
        && sS193.indexOf('GAME.loopPulse = function') >= 0
        && sS193.indexOf('function _gapCatchupOf(gapSec)') >= 0
        && sS193.indexOf('GAME.loopGapCatchup = function') >= 0  /* 兼容包装仍在（测试/工具用） */
        && /DATA.LOOP_GAP = \\{ gapSec: 5, toastSec: 300 \\};/.test(dS193);""",
u"v89.199：主循环消费唯一出口")

# ── K2 smoke：§199 段插入 ──
SEC199 = u"""  /* ============================================================
   * §199（v89.199）：时间跳变补偿加固 —— 唯一出口 loopPulse + 唤醒通道 + 版本标识
   *   背景：老板实测「电脑息屏过夜 → 离线补偿不生效（真离线反而可以）」。
   *   本段守护：双通道在册 / 异常防护（回退锚点）/ hidden 只记账 / 版本行。
   * ============================================================ */
  (function () {
    var fs199 = require('fs'), p199 = require('path');
    var mS199 = fs199.readFileSync(p199.join(__dirname, 'js', 'main.js'), 'utf8');
    var sS199 = fs199.readFileSync(p199.join(__dirname, 'js', 'state.js'), 'utf8');
    var uS199 = fs199.readFileSync(p199.join(__dirname, 'js', 'ui.js'), 'utf8');

    console.log('  --- §199 时间跳变加固（老板：息屏过夜 → 醒来立即补算）---');
    check('§199① 唯一出口 loopPulse + 双通道（setInterval 主循环 + visibilitychange/focus 唤醒）', (function () {
      return /GAME\\.loopPulse = function \\(checkVisible\\)/.test(sS199)
        && /function _gapCatchupOf\\(gapSec\\)/.test(sS199)
        && mS199.indexOf('GAME.loopPulse(_vis199)') >= 0
        && mS199.indexOf("addEventListener('visibilitychange'") >= 0
        && mS199.indexOf("window.addEventListener('focus'") >= 0
        && mS199.indexOf('_wakePulse199') >= 0;
    })());
    check('§199② 补算异常防护：不崩 + 锚点回退 60 秒（真调打桩）', (function () {
      var bkF = G.offlineCatchup, bkAt = G._loopLastAt, bkSt = G.state;
      try {
        G.newGame({ name: 'pulse199', region: '司隶' });
        G._loopLastAt = G.utils.now() - 3600 * 1000;      /* 造假 1h 缺口 */
        var fired = false;
        G.offlineCatchup = function () { fired = true; throw new Error('boom199'); };
        var t0 = G.utils.now();
        var r = G.loopPulse(true);
        return fired && r.mode === 'error' && r.err === 'boom199'
          && G._loopLastAt <= t0 - 59000 && G._loopLastAt >= t0 - 61000;
      } catch (e) { return false; }
      finally { G.offlineCatchup = bkF; G._loopLastAt = bkAt; G.state = bkSt; }
    })());
    check('§199③ 非游戏界面（hidden）只记账不补算 · 随后回游戏见小缺口 skip（真调）', (function () {
      var bkF = G.offlineCatchup, bkAt = G._loopLastAt, bkSt = G.state;
      try {
        G.newGame({ name: 'pulse199b', region: '司隶' });
        G._loopLastAt = G.utils.now() - 3600 * 1000;
        var called = 0;
        G.offlineCatchup = function () { called++; };
        var r1 = G.loopPulse(false);
        var r2 = G.loopPulse(true);
        return r1.mode === 'hidden' && called === 0 && r2.mode === 'skip';
      } catch (e) { return false; }
      finally { G.offlineCatchup = bkF; G._loopLastAt = bkAt; G.state = bkSt; }
    })());
    check('§199④ 版本标识：GAME.VERSION 在册 + 设置页显示 + 强制刷新指引', (function () {
      return /GAME\\.VERSION = 'v89\\.199'/.test(mS199)
        && uS199.indexOf('🧩 运行版本') >= 0
        && uS199.indexOf('Ctrl + F5') >= 0;
    })());
  })();

"""
rep('K2 §199 段', K,
u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
SEC199 + u"  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');",
u"§199（v89.199）：时间跳变补偿加固")

print('批次 P2 完成')

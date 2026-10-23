/* ============================================================
 * js/market.js — 集市、行情、作坊（v117）
 * ------------------------------------------------------------
 * 老板 2026-10-23：
 *   「分析如星露谷之类游戏，有没有可移植玩法。废土是一个大世界，
 *     不应该只有建造，战斗，发掘。也不用赋予太沉重的意义。」
 *
 * 星露谷真正让人天天回来的不是种地，是**三层窗口**：
 *
 *   日   —— 一天只有那么多精力，做这个就做不了那个（有取舍）
 *   季   —— 作物有窗口，错过等一年 → 提前囤、提前种（有预判）
 *   冬   —— 外面不长东西 → 强制你换一套玩法（有节奏变化）
 *
 * 废土这边三件事**本来就有**：精力、年景、寒潮。
 * 但它们只决定"能不能活"，不决定"卖不卖得出价"。
 * 于是经济一直是一条直线：产出 → 仓里堆着 → 数字变大。
 * 中间没有"什么时候卖"这个决定。
 *
 * 这一版补的就是那一个洞：
 *
 *   ① 每月三次集市，每次开市二百多秒，错过等下个月；
 *   ② 价格随**寒潮 / 年景 / 月内周期**浮动 —— 同一个东西不同月份差一半；
 *   ③ 作坊把原料变成成品（要时间、要原料），成品只在集市卖得上价。
 *
 * 于是"囤货"第一次有意义：寒潮前把粮压成干粮，等冷月卖。
 * 这不加任何新资源，只给既有资源一个**价格**。
 *
 * ⚠️ 三条刻意的边界：
 *   · 不做期货/K线/贷款 —— 那是另一个游戏；
 *   · 不惩罚囤积（没有仓租），只给"什么时候卖"这一个决定；
 *   · 不写沉重的东西（老板原话）：这里是生意，不是遗志。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
import './items.js';

(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var MK = GAME.market = {};
  var U = GAME.utils;

  function D() { return (GAME.DATA && GAME.DATA.MARKET) || {}; }
  function st0() { return GAME.state; }
  function cal() { return (GAME.DATA && GAME.DATA.CALENDAR) || {}; }

  /* ---------------- 时间 ---------------- */
  function secPerMonth() {
    return (cal().secPerYear || 57600) / 12;      /* 4800 游戏秒 */
  }
  MK.monthNow = function () {
    var st = st0() || {};
    return Math.floor(((st.world && st.world.elapsed) || 0) / secPerMonth());
  };
  /* 月内进度 0~1 */
  function monthFrac() {
    var st = st0() || {};
    var e = (st.world && st.world.elapsed) || 0;
    var spm = secPerMonth();
    return ((e % spm) + spm) % spm / spm;
  }
  MK.monthFrac = monthFrac;

  /* ---------------- 集市窗口 ----------------
   * 一个月切成 perMonth 段，每段开头开市 windowSec 秒。
   * 用"月内剩余秒数"判，不用浮点比例 —— 免得边界抖动。 */
  /* 这个月是不是大集月（第 3 / 第 9 月，0 起算） */
  MK.isFair = function (m) {
    var d = D();
    var mo = ((m == null ? MK.monthNow() : m) % 12 + 12) % 12;
    return (d.fairMonths || [2, 8]).indexOf(mo) >= 0;
  };
  /* 距下次大集还有几个月（0 = 正在大集） */
  MK.fairIn = function () {
    var m = MK.monthNow(), mo = ((m % 12) + 12) % 12;
    for (var i = 0; i < 12; i++) {
      if (MK.isFair(m + i)) return i;
    }
    return -1;
  };

  MK.openInfo = function () {
    var d = D(), spm = secPerMonth();
    var st = st0() || {};
    var e = ((st.world && st.world.elapsed) || 0);
    var inMonth = ((e % spm) + spm) % spm;
    /* 大集月：整月都算开市（不用掐那几百秒） */
    if (MK.isFair()) {
      return { open: true, fair: true, idx: 0,
        left: Math.max(0, Math.round(spm - inMonth)), nextIn: 0 };
    }
    var n = Math.max(1, d.perMonth || 3);
    var seg = spm / n;
    var idx = Math.floor(inMonth / seg);
    var off = inMonth - idx * seg;
    var win = d.windowSec == null ? 260 : d.windowSec;
    var open = off < win;
    return {
      open: open,
      idx: idx,                              /* 本月第几次（0 起） */
      left: Math.max(0, Math.round(win - off)),   /* 还开多久（游戏秒） */
      nextIn: open ? 0 : Math.round(seg - off)    /* 距下次开市 */
    };
  };
  MK.open = function () { return MK.openInfo().open; };

  /* ---------------- 行情 ----------------
   * 价格 = 基准 × 周期波 × 季节/年景 × 抖动
   *
   * 周期波用**两个不同周期的正弦**叠加：
   *   · 6 个月一轮的慢波（大趋势，玩家能看出来"现在偏贵"）
   *   · 2.7 个月一轮的快波（小起伏，让同一个月里也有差别）
   * 全部是确定性的（给定月份就算得出来），所以玩家可以**预判**，
   * 不是老虎机。这是星露谷"查日历"那件事的最小版本。 */
  function seedOf(s) {
    var x = 0;
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
    return x % 997;
  }

  MK.priceOf = function (gid, m) {
    var d = D();
    var g = null;
    (d.goods || []).forEach(function (x) { if (x.id === gid) g = x; });
    if (!g) return 0;
    var mo = (m == null) ? MK.monthNow() : m;

    var ph = seedOf(gid) / 997 * Math.PI * 2;
    var slow = Math.sin(mo * Math.PI * 2 / 6 + ph);
    var fast = Math.sin(mo * Math.PI * 2 / 2.7 + ph * 1.7);
    var wave = slow * 0.7 + fast * 0.3;

    var mul = 1 + (g.swing || 0.3) * wave;

    /* 季节：寒潮月粮贵、丰年粮贱、战年铁贵（都从既有系统读，不另设一套） */
    var cold = (GAME.climate && GAME.climate.isCold) ? GAME.climate.isCold(mo) : false;
    if (cold) mul *= ((d.coldMul || {})[gid] || 1);
    var y = GAME.yearOf ? GAME.yearOf() : null;
    if (y) {
      if (y.id === 'harvest') mul *= ((d.fatMul || {})[gid] || 1);
      if (y.id === 'war' || y.id === 'plague') mul *= ((d.warMul || {})[gid] || 1);
    }

    /* 抖动：同一次集市里价格也会飘（用月 + 分段做种子，确定性的） */
    var seg = Math.floor(monthFrac() * 12);
    var jr = (seedOf(gid + '|' + mo + '|' + seg) / 997) * 2 - 1;
    mul *= 1 + (d.jitter || 0.08) * jr;

    return Math.max(0.2, Math.round(g.base * mul * 100) / 100);
  };

  /* 加工品现价（寒潮月更贵） */
  MK.craftPriceOf = function (cid, m) {
    var d = D(), rec = null;
    (d.craft || []).forEach(function (x) { if (x.id === cid) rec = x; });
    if (!rec) return 0;
    var mo = (m == null) ? MK.monthNow() : m;
    var cold = (GAME.climate && GAME.climate.isCold) ? GAME.climate.isCold(mo) : false;
    var mul = cold ? (d.craftTint || 1.35) : 1;
    var jr = (seedOf(cid + '|' + mo) / 997) * 2 - 1;
    mul *= 1 + (d.jitter || 0.08) * jr;
    return Math.max(1, Math.round(rec.base * mul));
  };

  /* ============================================================
   * v123：**现在卖什么最划算**
   * ------------------------------------------------------------
   * 面板上原来只列五格价格 + 一个"贵/平/贱"。玩家要自己心算：
   * 粮 1.55 贵，但我仓里有 2 万粮；废钢 1.6 平，但只有 800。
   * 「贵」和「值得卖」是两件事 —— 前者看单价，后者看**存量 × 涨幅**。
   *
   * 这一条把两者合起来算一遍，直接说"哪个最该卖"。
   * ============================================================ */
  MK.bestOf = function () {
    var d = D(), city = mainCity();
    if (!city) return null;
    var res = (GAME.res ? GAME.res(city) : {}) || {};
    var best = null;
    (d.goods || []).forEach(function (g) {
      if (g.id === 'gold') return;
      var have = res[g.res] | 0;
      if (have < 100) return;                     /* 太少不值得提 */
      var price = MK.priceOf(g.id);
      var up = price / (g.base || 1);             /* 相对基准的涨幅 */
      if (up < 1.05) return;                      /* 不比平时贵就别催他卖 */
      var worth = have * price;                   /* 真能换多少钱 */
      var score = worth * up;                     /* 既要有货，又要涨得多 */
      if (!best || score > best.score) {
        best = { id: g.id, name: g.name, res: g.res, have: have,
          price: price, up: up, worth: Math.round(worth), score: score };
      }
    });
    return best;
  };

  /* 一句话：现在贵还是贱（面板用，不写数字堆） */
  MK.moodOf = function (gid) {
    var d = D(), g = null;
    (d.goods || []).forEach(function (x) { if (x.id === gid) g = x; });
    if (!g) return '';
    var p = MK.priceOf(gid);
    var r = p / (g.base || 1);
    if (r >= 1.25) return '贵';
    if (r <= 0.8) return '贱';
    return '平';
  };

  /* ---------------- 买卖 ---------------- */
  function mainCity() {
    return (GAME.mainCityOf && GAME.mainCityOf())
      || (GAME.currentCity && GAME.currentCity())
      || (GAME.city && GAME.city.all ? GAME.city.all()[0] : null);
  }

  /* 现在是赶集价还是平时价 */
  MK.sellMul = function () {
    var d = D();
    if (MK.isFair()) return d.fairMul == null ? 1.2 : d.fairMul;
    if (MK.open()) return 1;
    return d.offlineMul == null ? 0.82 : d.offlineMul;
  };

  /* 卖：n 个单位的某货。返回 {ok, got, price} */
  MK.sell = function (gid, n) {
    var d = D(), g = null;
    (d.goods || []).forEach(function (x) { if (x.id === gid) g = x; });
    if (!g) return { ok: false, msg: '没有这种货' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    n = Math.floor(Number(n) || 0);
    var have = (GAME.res(city) || {})[g.res] || 0;
    if (have < n || n <= 0) return { ok: false, msg: '仓里没有那么多' };

    /* 平时也收，但压价 —— 窗口只决定**价格档位**，不决定能不能卖 */
    var base = MK.priceOf(gid);
    var price = Math.round(base * MK.sellMul() * 100) / 100;
    var got = Math.max(1, Math.round(n * price));
    GAME.city.sub(city, g.res, n);
    GAME.city.add(city, 'gold', got);
    return { ok: true, got: got, price: price, n: n, name: g.name };
  };

  /* 买：用旧币换资源（集市上买比平时贵一点 —— 这是"缺货才买"的定价） */
  MK.buy = function (gid, n) {
    if (!MK.open()) return { ok: false, msg: '赶集才有货可买（还有 ' + MK.openInfo().nextIn + ' 秒）' };
    var d = D(), g = null;
    (d.goods || []).forEach(function (x) { if (x.id === gid) g = x; });
    if (!g || g.id === 'gold') return { ok: false, msg: '这种货不卖' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return { ok: false, msg: '数量不对' };
    var price = Math.round(MK.priceOf(gid) * 1.35 * 100) / 100;
    var cost = Math.ceil(n * price);
    if (((GAME.res(city) || {}).gold || 0) < cost) return { ok: false, msg: '旧币不够' };
    GAME.city.sub(city, 'gold', cost);
    GAME.city.add(city, g.res, n);
    return { ok: true, cost: cost, n: n, name: g.name };
  };

  /* ---------------- 大集稀有货 ----------------
   * 每样每次大集只能买一次（记在 s.mkRare，键 = 年-月-货）。
   * 「限一次」不是为了稀缺感，是为了让玩家**必须挑一样**。 */
  function rareKey(it) {
    var m = MK.monthNow();
    return m + '|' + (it.id || it.res);
  }
  MK.rareBought = function (it) {
    var s = st0();
    s.mkRare = s.mkRare || {};
    return !!s.mkRare[rareKey(it)];
  };
  MK.rareList = function () {
    if (!MK.isFair()) return [];
    return (D().rare || []).map(function (it) {
      return { it: it, bought: MK.rareBought(it) };
    });
  };
  MK.buyRare = function (idx) {
    if (!MK.isFair()) return { ok: false, msg: '只有大集月才有这些货' };
    var it = (D().rare || [])[idx | 0];
    if (!it) return { ok: false, msg: '没有这一样' };
    if (MK.rareBought(it)) return { ok: false, msg: '这一样这次大集已经买过了' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    if (((GAME.res(city) || {}).gold || 0) < it.cost) return { ok: false, msg: '旧币不够' };
    GAME.city.sub(city, 'gold', it.cost);
    if (it.id) GAME.items.add(it.id, it.n);
    else if (it.res) GAME.city.add(city, it.res, it.n);
    var s = st0();
    s.mkRare = s.mkRare || {};
    s.mkRare[rareKey(it)] = 1;
    return { ok: true, name: it.name };
  };

  /* ---------------- 作坊 ----------------
   * 一次只能开一炉（工位就那么多），要等 hours 游戏小时。
   * 小时按"游戏秒"折算：一年 57600 秒 = 12 个月 = 360 天 → 一天 160 秒，
   * 一小时 = 160/24 ≈ 6.67 秒。不新造时间尺度，照既有月长推。 */
  function hoursToSec(h) {
    var spm = secPerMonth();
    var daysPerMonth = 30;
    return (h || 0) * (spm / daysPerMonth / 24);
  }

  function jobs() {
    var s = st0();
    if (!s) return [];
    s.mkJobs = s.mkJobs || [];
    return s.mkJobs;
  }

  MK.busy = function () { return jobs().length > 0; };

  MK.craftInfo = function (cid) {
    var rec = null;
    (D().craft || []).forEach(function (x) { if (x.id === cid) rec = x; });
    return rec;
  };

  MK.craft = function (cid) {
    var rec = MK.craftInfo(cid);
    if (!rec) return { ok: false, msg: '没有这个配方' };
    if (MK.busy()) return { ok: false, msg: '作坊正忙着（一次只开一炉）' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    var res = GAME.res(city) || {};
    for (var k in (rec.from || {})) {
      if ((res[k] || 0) < rec.from[k]) return { ok: false, msg: '原料不够' };
    }
    for (var k2 in (rec.from || {})) GAME.city.sub(city, k2, rec.from[k2]);
    var st = st0();
    var now = (st.world && st.world.elapsed) || 0;
    jobs().push({ id: cid, start: now, done: now + hoursToSec(rec.hours) });
    return { ok: true, rec: rec, seconds: Math.round(hoursToSec(rec.hours)) };
  };

  /* 收：到时间了才收得下来 */
  MK.collect = function () {
    var st = st0();
    var now = (st && st.world && st.world.elapsed) || 0;
    var done = jobs().filter(function (j) { return j.done <= now; });
    if (!done.length) return { ok: false, msg: '还没好' };
    var got = [];
    done.forEach(function (j) {
      var rec = MK.craftInfo(j.id);
      if (!rec) return;
      GAME.items.add(rec.id, rec.yield);
      got.push(rec.name + ' ×' + rec.yield);
    });
    /* 只移除已完成的 */
    var s = st0();
    s.mkJobs = jobs().filter(function (j) { return j.done > now; });
    return { ok: true, got: got };
  };

  /* 卖加工品（平时也能卖，压价；赶集全价） */
  MK.sellMade = function (cid, n) {
    var rec = MK.craftInfo(cid);
    if (!rec) return { ok: false, msg: '没有这种成品' };
    var city = mainCity();
    if (!city) return { ok: false, msg: '没有城' };
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return { ok: false, msg: '数量不对' };
    if (!GAME.items.has(cid, n)) return { ok: false, msg: '没有那么多成品' };
    var price = Math.round(MK.craftPriceOf(cid) * MK.sellMul() * 100) / 100;
    var got = Math.max(1, Math.round(n * price));
    GAME.items.sub(cid, n);
    GAME.city.add(city, 'gold', got);
    return { ok: true, got: got, price: price, n: n, name: rec.name };
  };

  /* ---------------- 不必 tick ----------------
   * 集市与价格都是**读时间直接算**的（纯函数），不需要月度推演 ——
   * 少一个 tick 就少一处"顺序被人挪动"的风险（架构体检 v106 的结论）。
   * 作坊的进度也读 elapsed，面板每次刷新自己算。
   *
   * 所以这个模块**不注册 tick**。这是刻意的。 */
  MK.remainOf = function () {
    var st = st0();
    var now = (st && st.world && st.world.elapsed) || 0;
    var arr = jobs();
    if (!arr.length) return null;
    var j = arr[0];
    return { id: j.id, rec: MK.craftInfo(j.id), left: Math.max(0, Math.round(j.done - now)), done: j.done <= now };
  };

  /* ---------------- 面板文案 ---------------- */
  MK.lineOf = function () {
    var oi = MK.openInfo();
    if (oi.fair) {
      return '🎪 换季大集（整月）—— 收购价 ×' + MK.sellMul().toFixed(2)
        + '　本月底收摊，下一次再等半年';
    }
    if (oi.open) return '🏪 赶集中（本月第 ' + (oi.idx + 1) + ' 次，还剩 ' + oi.left + ' 秒）—— 现在是全价';
    return '🏪 平日的收购价（压低 ' + Math.round((1 - MK.sellMul()) * 100) + '%）'
      + '　下次赶集还有 ' + oi.nextIn + ' 秒';
  };

  MK.bodyHTML = function () {
    var d = D();
    var cold = (GAME.climate && GAME.climate.isCold) ? GAME.climate.isCold() : false;
    var y = GAME.yearOf ? GAME.yearOf() : null;
    var bits = [];
    if (cold) bits.push('<b style="color:#9ec5ff;">寒潮月</b>：粮与燃料最贵');
    if (y && y.id === 'harvest') bits.push('丰年：粮贱，别急着卖');
    if (y && (y.id === 'war' || y.id === 'plague')) bits.push(y.name + '：废钢与粮都涨');
    return '<div class="ui-sub" style="margin-top:3px;">'
      + (bits.length ? bits.join('　·　') + '　' : '')
      + '同一样东西不同月份能差一半。囤着，等价格好再卖。</div>';
  };

  /* ============================================================
   * 自注册
   * ============================================================ */
  if (GAME.reg) {
    GAME.reg.add({
      id: 'market',
      order: 30,          /* 比兵源靠后、比开城靠前：它是"过日子"，不是"打天下" */
      panel: function (ctx) {
        var sec = ctx.sec;
        var d = D();
        var rows = (d.goods || []).map(function (g) {
          var p = MK.priceOf(g.id);
          var mood = MK.moodOf(g.id);
          var col = mood === '贵' ? 'var(--gold-light)' : (mood === '贱' ? 'var(--text-dim)' : 'inherit');
          return '<span class="chip" style="color:' + col + ';" data-action="market-sell"'
            + ' data-gid="' + g.id + '" title="点一下把仓里的全卖掉（基准价 ' + g.base + '）">'
            + U.escape(g.name) + ' ' + p.toFixed(2) + '　' + mood + '</span>';
        }).join('');
        var made = (d.craft || []).map(function (c) {
          var have = GAME.items.count(c.id);
          var p = MK.craftPriceOf(c.id);
          return '<span class="chip' + (have ? '' : ' dim') + '"'
            + (have ? ' data-action="market-sell-made" data-cid="' + c.id + '" title="点一下全卖"' : '')
            + '>' + U.escape(c.name) + (have ? ' ×' + have : '') + '　' + p + '</span>';
        }).join('');
        /* 作坊：一次一炉，出货要等；做出来的东西**只在集市卖得上价** */
        var rm = MK.remainOf();
        var craftRow = '';
        if (rm && rm.rec) {
          craftRow = rm.done
            ? '<div style="margin-top:5px;font-size:var(--fs-cap);">🏭 <b>' + U.escape(rm.rec.name)
              + '</b> 已经出货 —— <span class="chip" data-action="market-collect">收下</span></div>'
            : '<div style="margin-top:5px;font-size:var(--fs-cap);">🏭 正在做 <b>'
              + U.escape(rm.rec.name) + '</b>，还要 ' + rm.left + ' 秒</div>';
        } else {
          craftRow = '<div class="chips" style="margin-top:5px;">'
            + (d.craft || []).map(function (c) {
              var need = [];
              for (var k in (c.from || {})) {
                need.push(({ grain: '粮', wood: '木', stone: '石', iron: '铁', gold: '币' }[k] || k)
                  + U.numText(c.from[k], 0));
              }
              return '<span class="chip dim" data-action="market-craft" data-cid="' + c.id + '"'
                + ' title="' + U.escape(c.desc || '') + '">做 ' + U.escape(c.name)
                + '（' + need.join('+') + ' → ' + c.yield + '，' + c.hours + ' 时）</span>';
            }).join('') + '</div>';
        }
        /* 大集：整月高价 + 三样只有这时候买得到的东西（每样限一次） */
        var fairRow;
        if (MK.isFair()) {
          fairRow = '<div class="chips" style="margin-top:5px;">'
            + MK.rareList().map(function (x, i) {
              return '<span class="chip' + (x.bought ? ' dim' : '') + '"'
                + (x.bought ? '' : ' data-action="market-rare" data-idx="' + i + '"')
                + ' title="' + U.escape(x.it.desc || '') + '">'
                + U.escape(x.it.name) + '　' + x.it.cost + ' 币'
                + (x.bought ? ' 已买' : '') + '</span>';
            }).join('') + '</div>';
        } else {
          var fi = MK.fairIn();
          fairRow = '<div class="ui-sub" style="margin-top:4px;">距换季大集 '
            + fi + ' 个月（每年第 3 / 第 9 月，整月全价收，还有平时买不到的三样东西）</div>';
        }
        /* v123：最该卖的那一样，直接点名 —— 不让玩家自己心算五个价格 */
        var best = MK.bestOf();
        var bestRow = best
          ? '<div style="margin-top:4px;font-size:var(--fs-cap);color:var(--gold-light);">'
            + '💡 现在最该卖：<b>' + U.escape(best.name) + '</b>　仓里 '
            + U.numText(best.have, 0) + '　单价 ' + best.price.toFixed(2)
            + '（比平时贵 ' + Math.round((best.up - 1) * 100) + '%）　全卖约 '
            + U.numText(best.worth, 0) + ' 旧币</div>'
          : '<div style="margin-top:4px;font-size:var(--fs-cap);color:var(--text-dim);">'
            + '现在没有哪样比平时贵 —— 不急就压着。</div>';
        return sec('🏪 集市', MK.lineOf(), MK.bodyHTML() + bestRow
          + '<div class="chips" style="margin-top:5px;">' + rows + '</div>'
          + (made ? '<div class="chips" style="margin-top:4px;">' + made + '</div>' : '')
          + craftRow + fairRow);
      },
      /* ⚠️ 提示走 `ctx.toast`，**不直接调界面层** ——
         core 包引用界面包会被架构棘轮拦下（v106 立的规矩），而且
         node 探针里没有 ui，直接调会静默失效。 */
      actions: {
        /* 全卖一种（一次卖光，不做数量输入框 —— 那是最烦的界面） */
        'market-sell': function (el, ctx) {
          var gid = el.getAttribute('data-gid');
          var city = mainCity();
          if (!city) return;
          var d = D(), g = null;
          (d.goods || []).forEach(function (x) { if (x.id === gid) g = x; });
          if (!g) return;
          var n = (GAME.res(city) || {})[g.res] || 0;
          if (!n) { ctx.toast('仓里没有' + g.name); return; }
          var r = MK.sell(gid, n);
          ctx.toast(r.ok ? ('卖了 ' + U.numText(n, 0) + ' ' + g.name + '，得旧币 ' + U.numText(r.got, 0)) : r.msg);
          ctx.refresh();
        },
        'market-sell-made': function (el, ctx) {
          var cid = el.getAttribute('data-cid');
          var have = GAME.items.count(cid);
          if (!have) { ctx.toast('没有成品'); return; }
          var r = MK.sellMade(cid, have);
          ctx.toast(r.ok ? ('卖了 ' + r.name + ' ×' + r.n + '，得旧币 ' + U.numText(r.got, 0)) : r.msg);
          ctx.refresh();
        },
        'market-craft': function (el, ctx) {
          var cid = el.getAttribute('data-cid');
          var r = MK.craft(cid);
          ctx.toast(r.ok ? ('开炉：' + r.rec.name + '，游戏内 ' + r.rec.hours + ' 小时后出货') : r.msg);
          ctx.refresh();
        },
        'market-rare': function (el, ctx) {
          var r = MK.buyRare(el.getAttribute('data-idx'));
          ctx.toast(r.ok ? ('买下 ' + r.name) : r.msg);
          ctx.refresh();
        },
        'market-collect': function (el, ctx) {
          var r = MK.collect();
          ctx.toast(r.ok ? ('收下：' + r.got.join('、')) : r.msg);
          ctx.refresh();
        }
      }
    });
  }
})();

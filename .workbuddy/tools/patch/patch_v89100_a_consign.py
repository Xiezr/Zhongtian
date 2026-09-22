# -*- coding: utf-8 -*-
"""v89.100-A：道具寄售通道（按购买价 75% 回收）
五件：data（配置）/ systems（出口组）/ ui（市场面板区块）/ main（动作）/ smoke（第 100 节断言）
幂等：new 已在文件里 → SKIP。"""
import io, subprocess

BASE = 'E:/Deepseekdb/'
N = [0]

def rep(path, old, new, tag):
    p = BASE + path
    s = io.open(p, encoding='utf-8').read()
    if new in s:
        print('SKIP ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    N[0] += 1
    print('OK   ' + tag)

def add_after(path, anchor, new, tag, key):
    """在 anchor 后插入 new（幂等：key 已在 → SKIP）。
    ⚠️ key 必须显式给（曾经用 new 首行做判据，注释分隔线是通用文本 → 全部误判 SKIP）。"""
    p = BASE + path
    s = io.open(p, encoding='utf-8').read()
    if key in s:
        print('SKIP ' + tag)
        return
    assert anchor in s, 'MISS: ' + tag
    s = s.replace(anchor, anchor + new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    N[0] += 1
    print('OK   ' + tag)

# ============ ① data.js：DATA.ITEM_SELL 配置 ============
add_after('js/data.js',
"""  DATA.MARKET_BUY = {
    res: ['grain', 'wood', 'stone', 'iron'],
    ratio: { grain: 1, wood: 2, stone: 3, iron: 4 },
    per: 20,          /* 基准：20 粮 ≈ 1 金（与售卖同基准） */
    loss: 0.35        /* 买入比例损耗 35%：金 → 物资只值 65%（市场只应急） */
  };""",
"""

  /* ============================================================
   * v89.100（老板假设「战利品以购买价 75% 出售」）：**道具寄售**
   * ------------------------------------------------------------
   * 把背包里有价道具（战利品：珠宝 / 材料 / 种子 / 图纸 / 宝箱…）按
   * **商城购买价的 75%** 回收为黄金。唯一出口 GAME.systems.consign*。
   *   · 价 = item.price × 100（与 doShopping 同口径）× rate（本配置）
   *   · price = 0 的道具（灵草 / 灵气精华）无购买价 → 不可寄售
   *   · 装备实例不在此列（走「拆解」回收打造材料，见 salvageEquip）
   * 调平衡只改本配置（UI / 探针 / 推演全从这里读，别处不许另算价）。
   * ============================================================ */
  DATA.ITEM_SELL = { rate: 0.75 };""",
'data: ITEM_SELL', 'DATA.ITEM_SELL')

# ============ ② systems.js：出口组 ============
add_after('js/systems.js',
"""  S.itemInfo = function (id) {
    for (var i = 0; i < DATA.ITEMS.length; i++) if (DATA.ITEMS[i].id === id) return DATA.ITEMS[i];
    return null;
  };""",
"""

  /* ============================================================
   * v89.100：**道具寄售**（按商城购买价 75% 回收为金）
   * ------------------------------------------------------------
   * 唯一出口组（UI / 推演脑都从这里走，别处不许另算价）：
   *   S.consignCfg()        —— 读 DATA.ITEM_SELL（rate 可调）
   *   S.consignPriceOf(id)  —— 单价（price×100×rate；无价道具返回 0）
   *   S.consignList(opts)   —— 当前可寄售清单（{keep:[id]} 可指定保留）
   *   S.consignItem(id,n)   —— 寄售 n 件（n 省略 / 0 = 全部）
   *   S.consignAll(opts)    —— 一键全部寄售
   * 语义：真金入账（与市场卖货同记账口 s.res.gold），statBump('trades')。
   * ============================================================ */
  S.consignCfg = function () { return DATA.ITEM_SELL || { rate: 0.75 }; };
  S.consignPriceOf = function (id) {
    var it = S.itemInfo(id);
    if (!it || !(it.price > 0)) return 0;
    var rate = S.consignCfg().rate;
    return Math.max(1, Math.floor(it.price * 100 * (rate == null ? 0.75 : rate)));
  };
  S.consignList = function (opts) {
    var s = GAME.state, out = [];
    if (!s || !s.items) return out;
    var keep = (opts && opts.keep) || [];
    for (var id in s.items) {
      var n = s.items[id] || 0;
      if (n <= 0 || keep.indexOf(id) >= 0) continue;
      var unit = S.consignPriceOf(id);
      if (!(unit > 0)) continue;
      var it = S.itemInfo(id);
      out.push({ id: id, name: it ? it.name : id, type: it ? (it.type || '') : '', qty: n, unit: unit, total: unit * n });
    }
    out.sort(function (a, b) { return b.total - a.total; });
    return out;
  };
  S.consignItem = function (id, qty) {
    var s = GAME.state, item = S.itemInfo(id);
    if (!item) return { ok: false, msg: '未知道具' };
    var unit = S.consignPriceOf(id);
    if (!(unit > 0)) return { ok: false, msg: '「' + item.name + '」无购买价，不可寄售（装备请用拆解）' };
    var have = (s.items[id] || 0);
    if (have <= 0) return { ok: false, msg: '背包中没有「' + item.name + '」' };
    qty = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
    var gold = unit * qty;
    s.items[id] = have - qty;
    if (s.items[id] <= 0) delete s.items[id];
    s.res.gold = (s.res.gold || 0) + gold;
    GAME.statBump('trades', 1);
    GAME.log('🎒 寄售「' + item.name + '」×' + qty + ' → 得金 ' + U.fmt(gold) + '（购买价 75% 回收）');
    return { ok: true, msg: '寄售「' + item.name + '」×' + qty + '，得金 ' + U.fmt(gold), gold: gold, n: qty };
  };
  S.consignAll = function (opts) {
    var list = S.consignList(opts), sum = 0, n = 0, cnt = 0;
    for (var i = 0; i < list.length; i++) {
      var r = S.consignItem(list[i].id, list[i].qty);
      if (r && r.ok) { sum += r.gold; n++; cnt += r.n; }
    }
    return { ok: n > 0, gold: sum, n: n, cnt: cnt,
      msg: n > 0 ? ('寄售 ' + n + ' 种 / ' + cnt + ' 件，共得金 ' + U.fmt(sum)) : '没有可寄售的道具' };
  };""",
'systems: consign 出口组', 'S.consignCfg')

# ============ ③ ui.js：市场面板区块 ============
rep('js/ui.js',
"""        (lv > 0 ? '' : '　·　<b>未建市场</b>：折损最大，建市场可提高折损系数') + '</div>' +
      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      'lg'
    );
  };""",
"""        (lv > 0 ? '' : '　·　<b>未建市场</b>：折损最大，建市场可提高折损系数') + '</div>' +
      /* v89.100：寄售战利品（按购买价 75% 回收）—— 价/校验全走 systems.consign* 出口 */
      (function () {
        var list = (GAME.systems.consignList ? GAME.systems.consignList() : []);
        if (!list.length) return '';
        var top = list.slice(0, 12);
        var sumAll = 0;
        list.forEach(function (x) { sumAll += x.total; });
        return '<div class="gold-heading" style="margin-top:10px;">🎒 寄售战利品' +
            '　<span style="font-size:var(--fs-sub);font-weight:400;color:var(--text-dim);">按购买价 75% 回收</span></div>' +
          '<table class="ms-table"><thead><tr><th>道具</th><th>持有</th><th>单价</th><th>全卖得金</th><th></th></tr></thead><tbody>' +
          top.map(function (x) {
            return '<tr><td class="ms-name">' + U.escape(x.name) + '</td>' +
              '<td class="ms-stock">' + U.fmt(x.qty) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.unit) + '</td>' +
              '<td class="ms-gold">' + U.fmt(x.total) + '</td>' +
              '<td class="ms-act"><button class="btn xs gold" data-action="consign-sell" data-item="' + x.id + '">寄售</button></td></tr>';
          }).join('') +
          '</tbody></table>' +
          (list.length > 12 ? '<div class="ms-note">…仅列价值前 12 种（共 ' + list.length + ' 种）</div>' : '') +
          '<div class="mk-presets" style="margin-top:6px;">' +
            '<button class="btn sm gold" data-action="consign-all">一键寄售全部（共得 ' + U.fmt(sumAll) + ' 金）</button>' +
          '</div>' +
          '<div class="ms-note">装备请用「拆解」回收材料；灵草 / 灵气精华无购买价，不参与寄售。</div>';
      })() +
      '<div style="text-align:center;margin-top:10px;">' +
        '<button class="btn" data-action="close-modal">关闭</button></div>',
      'lg'
    );
  };""",
'ui: 市场寄售区块')

# ============ ④ main.js：动作 + UI 包装 ============
rep('js/main.js',
"""      case 'market-sell': GAME.doMarketSell(el.dataset.res); break;
      case 'market-buy': GAME.doMarketBuy(el.dataset.res); break;""",
"""      case 'market-sell': GAME.doMarketSell(el.dataset.res); break;
      case 'market-buy': GAME.doMarketBuy(el.dataset.res); break;
      /* v89.100：道具寄售（价 = 购买价 75%；出口 systems.consign*） */
      case 'consign-sell': GAME.doConsign(el.dataset.item); break;
      case 'consign-all': GAME.doConsignAll(); break;""",
'main: consign 动作')

add_after('js/main.js',
"""  GAME.doMarketBuy = function (res) {
    var a = document.getElementById('mk-amount');
    if (!a) return;
    var units = Number(a.value) || 0;
    if (units <= 0) { ui.toast('数量无效'); return; }
    var need = GAME.marketBuyGoldFor(res, units);        /* 口径唯一出口，界面只读不算 */
    if ((GAME.state.res.gold || 0) < need) { ui.toast('黄金不足 —— 需 ' + U.fmt(need) + ' 金'); return; }
    var r = GAME.marketBuy(res, need);
    ui.toast(r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); ui.sgTryAct('market-trade'); }
  };""",
"""

  /* v89.100：寄售（UI 包装 —— 唯一出口在 systems.consign*） */
  GAME.doConsign = function (id) {
    var r = GAME.systems.consignItem(id, 0);   /* 0 = 全部 */
    ui.toast((r.ok ? '🎒 ' : '') + r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
    return r;
  };
  GAME.doConsignAll = function () {
    var r = GAME.systems.consignAll();
    ui.toast((r.ok ? '🎒 ' : '') + r.msg);
    if (r.ok) { ui.openMarket(); GAME.refreshAll(); }
    return r;
  };""",
'main: doConsign/doConsignAll', 'GAME.doConsign')

# ============ 语法检查 ============
for f in ['js/data.js', 'js/systems.js', 'js/ui.js', 'js/main.js']:
    r = subprocess.run(['node', '--check', BASE + f], capture_output=True)
    print(f + ': ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300]))

print('--- total %d ---' % N[0])

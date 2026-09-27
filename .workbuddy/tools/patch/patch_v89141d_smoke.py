# -*- coding: utf-8 -*-
# v89.141 批 C：smoke 断言跟随（9 条）+ 新增 §122
import io, os

p = 'E:/Deepseekdb/smoke-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag, exp=1):
    global s
    cnt = s.count(old)
    assert cnt == exp, '%s 锚点命中 %d 次（期望 %d）' % (tag, cnt, exp)
    s = s.replace(old, new)
    ok.append(tag)

# ══════ ① 无仓库时为基础储量 ══════
rep("""    return G.storeCap() === Math.round(2000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct')));
  })(), U.fmt(G.storeCap()));""",
"""    /* v89.141：容量多一项"城外露天"（纯加法）——期望值同步加 extStoreCapOf */
    return G.storeCap() === Math.round(2000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct')))
      + G.extStoreCapOf(G.currentCity());
  })(), U.fmt(G.storeCap()));""",
    '无仓库基础量')

# ══════ ② 仓库提升储量上限 ══════
rep("""    G.storeCap() === Math.round(6000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct'))), U.fmt(G.storeCap()));""",
"""    G.storeCap() === Math.round(6000000 * (1 + G.cityBonusNum(G.currentCity(), 'storePct')))
      + G.extStoreCapOf(G.currentCity()), U.fmt(G.storeCap()));""",
    '仓库提升')

# ══════ ③ 实测：储量随仓库等级叠加 ══════
rep("""    return sum >= 2 && cap === Math.round(2000000 * sum * (1 + (G.systems.techBonus ? G.systems.techBonus('store') : 0)));""",
"""    return sum >= 2 && cap === Math.round(2000000 * sum * (1 + (G.systems.techBonus ? G.systems.techBonus('store') : 0)))
      + G.extStoreCapOf(c);   /* v89.141：加法项 */""",
    '储量叠加')

# ══════ ④ 城外 8 列 → 12 列 ══════
rep("""  check('城外 8 列（39 块时 5 行，落在固定视区内）', /var COLS = 8;/.test(uS33));""",
"""  /* v89.141（老板 0）：8 列 → **12 列**（108 = 12×9 整网格；8 列下 96 块要 12 行，高度爆掉） */
  check('城外 12 列（Lv1=12 块 1 整行 · 96 块 8 整行 · 满 108 块 9 整行）', /var COLS = 12;/.test(uS33));""",
    'COLS 12 断言')

# ══════ ⑤ 征收上限表（封顶口径） ══════
rep("""  check('征收上限表按官府等级（10 级 = 40 块，12 级 = 48 块，之后每级 +4 续到都城上限）',
    JSON.stringify(DATA.EXT_CAP_BY_LV.slice(0, 10)) === JSON.stringify([12, 15, 18, 21, 24, 27, 30, 33, 36, 40])
    && DATA.EXT_CAP_BY_LV[11] === 48
    /* v54：官府在名城能盖更高，表跟着长到 MAX_LEVEL_ABS
       v89.102：MAX_LEVEL_ABS 又多了一项"主城爵位解锁"（+21），
       末项按末段步长 +4 续写 → 断言改成**公式**（写死 96 会随上限一起烂）。 */
    && DATA.EXT_CAP_BY_LV.length === DATA.MAX_LEVEL_ABS
    && DATA.EXT_CAP_BY_LV[DATA.MAX_LEVEL_ABS - 1] === 48 + 4 * (DATA.MAX_LEVEL_ABS - 12));""",
"""  check('征收上限表按官府等级（10 级 = 40 块，12 级 = 48 块，之后 +4/级至 108 封顶）',
    JSON.stringify(DATA.EXT_CAP_BY_LV.slice(0, 10)) === JSON.stringify([12, 15, 18, 21, 24, 27, 30, 33, 36, 40])
    && DATA.EXT_CAP_BY_LV[11] === 48
    /* v54：官府在名城能盖更高，表跟着长到 MAX_LEVEL_ABS
       v89.141（老板 0）：「城外地块最多为 12×9 块，后续官府升级不再增加」——
       末项 = EXT_CAP_MAX(108) 平顶（Lv27 到顶），不再是无脑 +4 公式。 */
    && DATA.EXT_CAP_BY_LV.length === DATA.MAX_LEVEL_ABS
    && DATA.EXT_CAP_BY_LV[25] === 104 && DATA.EXT_CAP_BY_LV[26] === 108
    && DATA.EXT_CAP_BY_LV[DATA.MAX_LEVEL_ABS - 1] === DATA.EXT_CAP_MAX
    && DATA.EXT_CAP_MAX === 108);""",
    '征收上限表')

# ══════ ⑥ 末行居中（15 块 · 12 列） ══════
rep("""  check('实测：12 块时末行 4 格右移 2 格居中', (function () {
    var st = G.state, bkId = G.ui._cityId;
    var tmp = G.makeCity({ id: 'tmpExtCap', name: 'tmpExt', col: 6, row: 6 });
    st.cities.push(tmp);
    G.ui._cityId = tmp.id;
    var html = G.ui.extHTML();
    G.ui._cityId = bkId;
    st.cities.pop();
    var M = G.ui.isoMetrics(8, 2);
    var want = 'left:' + Math.round(M.x(2, 1)) + 'px;top:' + Math.round(M.y(2, 1)) + 'px';
    return tmp.extGrid.length === 12 && html.indexOf(want) >= 0;
  })());""",
"""  /* v89.141：12 列下 Lv1（12 块）= 1 整行、无偏移 —— 改用 **Lv2 = 15 块**
     （1 整行 + 3 格，末行居中偏移 (12-3)/2 = 4.5 格）来验证居中逻辑。 */
  check('实测：15 块时末行 3 格右移 4.5 格居中（12 列 · Lv2=15 块）', (function () {
    var st = G.state, bkId = G.ui._cityId;
    var tmp = G.makeCity({ id: 'tmpExtCap', name: 'tmpExt', col: 6, row: 6 });
    st.cities.push(tmp);
    /* 官府抬到 2 级 → 上限 15 块 */
    tmp.cells.forEach(function (x) { if (x.official && x.build) x.build.lvl = 2; });
    G.ui._cityId = tmp.id;
    var html = G.ui.extHTML();
    G.ui._cityId = bkId;
    st.cities.pop();
    var M = G.ui.isoMetrics(12, 2);
    var want = 'left:' + Math.round(M.x(4.5, 1)) + 'px;top:' + Math.round(M.y(4.5, 1)) + 'px';
    return tmp.extGrid.length === 15 && html.indexOf(want) >= 0;
  })());""",
    '末行居中 15 块')

# ══════ ⑦⑧⑨ 三处 bt-log CSS（max-height 340） ══════
rep("""        && /\\.bt-log \\{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h118)
        && /ui\\.BT_LOG_MAX = 64;/.test(uc);""",
"""        && /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h118)
        && /ui\\.BT_LOG_MAX = 64;/.test(uc);""",
    '§118③ bt-log')
rep("""    check('§119⑥ 清单③：战场极端载荷兜底（wrap 自滚 + log 可压缩 min-height 140）', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; \\}/.test(h)
        && /\\.bt-log \\{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h);
    })());""",
"""    check('§119⑥ 清单③：战场极端载荷兜底（wrap 自滚 + log 可压缩 · v89.141 上限 340）', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; \\}/.test(h)
        && /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h);
    })());""",
    '§119⑥ bt-log')
rep("""    check('§121② 回合记录降高（250 理想 / 130 保底，为上方战场腾空间）', (function () {
      return /\\.bt-log \\{ flex: 1 1 250px; max-height: none; min-height: 130px;/.test(h);
    })());""",
"""    check('§121② 回合记录降高（250 理想 / 340 上限 / 130 保底；v89.141 补硬上限）', (function () {
      return /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h);
    })());""",
    '§121② bt-log')

# ══════ ⑩ 新增 §122（插在末尾统计前） ══════
NEW122 = """  })();

  /* ═══════════════════════════════════════════════════════════
   * §122（v89.141）：城外 12×9 / 露天容量 / 宝物整叠 / 记录框上限
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs122 = require('fs'), p122 = require('path');
    var rd122 = function (f) { return fs122.readFileSync(p122.join(__dirname, 'js', f), 'utf8'); };
    var strip122 = function (x) { return x.replace(/\\/\\*[\\s\\S]*?\\*\\//g, ''); };
    var d122 = strip122(rd122('data.js')), do122 = strip122(rd122('domain.js'));
    var u122 = strip122(rd122('ui.js')), m122 = strip122(rd122('main.js'));
    var h122 = fs122.readFileSync(p122.join(__dirname, 'index.html'), 'utf8');

    /* ---- ① 12×9 封顶（表平顶 + 两表联动 + MAX 常量） ---------- */
    check('§122① 城外地块 12×9=108 封顶（Lv27 到顶 · 两表联动 · 官府再升不加地）', (function () {
      var D = DATA, okAll = true;
      for (var lv = 1; lv <= D.MAX_LEVEL_ABS; lv++) {
        var cap = D.EXT_CAP_BY_LV[lv - 1];
        var sum = D.EXT_PLAN_BY_LV[lv - 1].reduce(function (a, b) { return a + b; }, 0);
        if (cap > D.EXT_CAP_MAX || sum !== cap) { okAll = false; break; }
      }
      return D.EXT_CAP_MAX === 108 && okAll
        && D.EXT_CAP_BY_LV[25] === 104 && D.EXT_CAP_BY_LV[26] === 108
        && D.EXT_CAP_BY_LV[D.MAX_LEVEL_ABS - 1] === 108
        && /\\bDATA\\.EXT_CAP_MAX = 108\\b/.test(d122)
        && /Math\\.min\\(DATA\\.EXT_CAP_MAX, prevCap \\+ 4\\)/.test(d122);
    })());

    /* ---- ② 城外露天容量（唯一出口 + 打表 + 纯加法） ---------- */
    check('§122② 城外露天容量（extStoreCapOf 唯一出口 · Lv1/Lv12 打表 · 纯加法不吃加成）', (function () {
      var per = DATA.EXT_STORE_PER_LV;
      if (per !== 20000) return false;
      var hasAdd = /\\+ GAME\\.extStoreCapOf\\(city\\);/.test(do122)
        && /GAME\\.extStoreCapOf = function \\(city\\)/.test(do122);
      var st = G.state, bkId = G.ui._cityId;
      var tmp = G.makeCity({ id: 'extstore141', name: 'T', col: 6, row: 6 });
      st.cities.push(tmp);
      G.ui._cityId = tmp.id;
      var g = G.extGridOf(tmp);
      g.length = 0;
      g.push({ id: 'e1', type: 'farm', lv: 1 }, { id: 'e2', type: 'forest', lv: 1 },
        { id: 'e3', type: 'quarry', lv: 1 }, { id: 'e4', type: 'mine', lv: 12 });
      var n = G.extStoreCapOf(tmp);
      var cap = G.storeCapOf(tmp);
      /* 期望 = round(200万 × (1+科技) × (1+专精) × (1+档位)) + 露天 —— 拆开验"纯加法" */
      var base = Math.round(2000000
        * (1 + (G.systems.techBonus ? G.systems.techBonus('store') : 0))
        * (1 + (G.mastery('storePct', tmp) || 0))
        * (1 + G.cityBonusNum(tmp, 'storePct')));
      G.ui._cityId = bkId;
      st.cities.pop();
      return hasAdd && n === (3 * per + 12 * per) && cap === base + n;
    })());

    /* ---- ③ 宝物整叠（右键入口 + 小窗 + 同一个 doBagUse） ---------- */
    check('§122③ 宝物整叠使用（bagCell data-bulk · openBulkUse · contextmenu 委托 · 复用 doBagUse）', (function () {
      return /\\(o\\.bulk \\? ' data-bulk="1"' : ''\\)/.test(u122)
        && /cell\\.bulk = 1;/.test(u122)
        && /ui\\.openBulkUse = function/.test(u122)
        && /closest\\('\\[data-bulk\\]'\\)/.test(m122)
        && /case 'bulk-use-do'/.test(m122)
        && /GAME\\.doBagUse\\(el\\.dataset\\.key, bq\\);/.test(m122);
    })());
    check('§122③ 实测：openBulkUse 真开窗（数量框 + 执行键 + 用量提示）', (function () {
      var s = G.state;
      var bk = s.items.shennongchu;
      s.items.shennongchu = 5;
      var root = document.getElementById('modal-root');
      try {
        ui.closeAllModals();
        ui.openBulkUse('shennongchu');
        var html = (root && root.innerHTML) || '';
        return html.indexOf('bulk-q') >= 0 && html.indexOf('bulk-use-do') >= 0
          && html.indexOf('全部用完') >= 0;
      } finally {
        if (bk == null) delete s.items.shennongchu; else s.items.shennongchu = bk;
        try { ui.closeAllModals(); } catch (e) {}
      }
    })());

    /* ---- ④ 记录框硬上限 ---------- */
    check('§122④ 战场记录框硬上限 340px（按建议：不硬钉 250、不无限撑到 425）',
      /\\.bt-log \\{ flex: 1 1 250px; max-height: 340px; min-height: 130px;/.test(h122));

    /* ---- ⑤ 射程加数式常数已删 ---------- */
    check('§122⑤ 射程加数式常数已删（查可执行形态 · 墓碑不误伤）', (function () {
      var t = strip122(rd122('tactic.js'));
      return !/T\\.FIELD_MARGIN\\s*=\\s*\\d/.test(t);
    })());

    /* ---- ⑥ 12 列 ---------- */
    check('§122⑥ 城外地块 12 列（108 = 12×9 整网格）', /var COLS = 12;/.test(u122));

    /* ---- ⑦ 需求档案在册 ---------- */
    check('§122⑦ 需求档案在册（v89.141 · 老板原文关键句逐字）', (function () {
      var md = fs122.readFileSync(p122.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.141') >= 0
        && md.indexOf('城外地块最多为12*9块') >= 0
        && md.indexOf('城外资源建筑还自带一点上限容量') >= 0
        && md.indexOf('按建议执行') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

rep("""  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');""",
    NEW122,
    '§122 段')

assert '\r\n' not in s
tmp = p + '.tmp141'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert len(chk) == len(s)
print('✅ smoke-test.js：%d → %d 字节' % (n0, len(chk)))
print('✅ 批 C 完成：' + ' / '.join(ok))

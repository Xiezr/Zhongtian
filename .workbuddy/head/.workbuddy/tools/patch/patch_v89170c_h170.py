# -*- coding: utf-8 -*-
"""v89.170 smoke §170 段：经验曲线上抬 · 道具不再一步登天
   插在文件尾（§169 段之后、结果行之前）—— 自带 require（跨段局部不可见 §74.4）。"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, 'r', encoding='utf-8', newline='').read()

ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(ANCHOR) == 1, '锚点计数=%d' % s.count(ANCHOR)

guard = '170. v89.170 经验曲线'
if guard in s:
    print('  [skip] §170 已存在')
else:
    SECTION = """  /* ============================================================
   * 170. v89.170（老板）：「等级诡异在前期所需经验太低了…曲线应该上抬一点，
   *      比直接线性低…玩家只要花24万金买兵仙遗篇，直升一百多级」
   *   —— 曲线改单段幂律：前期上抬、全程低于线性；道具不再"一步登天"。
   * ============================================================ */
  console.log('\\n===== 170. v89.170 经验曲线（上抬 · 低于线性 · 道具不再一步登天） =====');
  (function () {
    var fs170 = require('fs'), p170 = require('path');

    /* ① 真调：兵仙遗篇（24 万金）从 Lv1 喂下 —— 不再直升一百多级 */
    console.log('  --- ① 兵仙遗篇的真实等级效果 ---');
    (function () {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === 'bingxian_yipian') it = x; });
      var g = { id: 'g170a', name: '样本', rank: 'tian', level: 1, exp: 0, tong: 40, yw: 40, zm: 40, nz: 40,
        speed: 10, attack: 10, defense: 10, hp: 100, stamina: 100, equip: {}, perm: {} };
      var r = G.battle.gainExp(g, it.amount, '§170');
      /* 独立算法对照（逐级扣减），并用"实际入账额"（可能含神器经验加成）：
         这样断言与"曲线形状"同源，又不受神器加成或 round 细节影响。 */
      var amt = it.amount;
      if (G.artifactBonusNum) amt = Math.round(amt * (1 + G.artifactBonusNum('genExpPct')));
      var lv = 1, e = amt;
      while (lv < 240) { var nd = G.expNeedOf({ level: lv }); if (e < nd) break; e -= nd; lv++; }
      check('§170① ★ 兵仙遗篇（24 万金）从 Lv1 → Lv' + g.level + '（旧口径 177 · 上限 Lv90）',
        g.level === lv && g.level <= 90 && g.level >= 80,
        'Lv' + g.level + '（面额 ' + amt + ' · 逐级扣减期望 Lv' + lv + '）');
      check('§170①b 兵仙遗篇商城实售 = 24 万金（内部价 2400 × 100 —— 老板原话口径）',
        it.price === 2400, 'price=' + it.price);
    })();

    /* ② 累计占比：升级体验从"最后 40 级"回到前中段 */
    console.log('  --- ② 累计占比（体验分布） ---');
    (function () {
      var cum = 0, c100 = 0, c150 = 0;
      for (var lv = 1; lv <= 240; lv++) {
        cum += G.expNeedOf({ level: lv });
        if (lv === 100) c100 = cum;
        if (lv === 150) c150 = cum;
      }
      var p100 = c100 / cum, p150 = c150 / cum;
      check('§170② ★ 前 100 级累计占比 ≥ 10%（旧口径 0.59% · 现 ' + (p100 * 100).toFixed(2) + '%）',
        p100 >= 0.10 && p100 < 0.25);
      check('§170②b 前 150 级累计占比 ≥ 30%（旧口径 3.79% · 现 ' + (p150 * 100).toFixed(2) + '%）',
        p150 >= 0.30 && p150 < 0.45);
    })();

    /* ③ 上抬的量级下界（守护：不许改回低曲线） */
    console.log('  --- ③ 上抬量级（下界守卫） ---');
    (function () {
      var n1 = G.expNeedOf({ level: 1 }), n30 = G.expNeedOf({ level: 30 }),
          n100 = G.expNeedOf({ level: 100 }), n240 = G.expNeedOf({ level: 240 });
      check('§170③ 前期已上抬（Lv1≥1千 · Lv30≥5万 · Lv100≥25万 · Lv240=100万）',
        n1 >= 1000 && n30 >= 50000 && n100 >= 250000 && n240 === 1000000,
        'Lv1=' + n1 + ' Lv30=' + n30 + ' Lv100=' + n100);
    })();

    /* ④ 源码级：单段幂律 + 旧字段零残留 */
    console.log('  --- ④ 源码：单段幂律 · 退役字段零残留 ---');
    (function () {
      var dS170 = fs170.readFileSync(p170.join(__dirname, 'js', 'data.js'), 'utf8');
      var doS170 = fs170.readFileSync(p170.join(__dirname, 'js', 'domain.js'), 'utf8');
      check('§170④ 出口 = 单段幂律（needTop × (lv/topLv)^alpha · alpha 1.25）',
        /Math\\.pow\\(lv \\/ C\\.topLv, C\\.alpha\\)/.test(doS170)
        && /alpha: 1\\.25/.test(dS170) && /topLv: 240/.test(dS170));
      /* 负向：查**可执行形态**（剥注释——墓碑注释不误伤，§72.4 老规矩） */
      var exec = (dS170 + '\\n' + doS170).replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
        .split('\\n').map(function (l) { return l.split('//')[0]; }).join('\\n');
      check('§170④b 旧两段字段（seg1To / base / quad / growth）零残留（可执行形态）',
        !/seg1To/.test(exec) && !/C\\.base/.test(exec) && !/C\\.quad/.test(exec)
        && !/C\\.growth/.test(exec));
    })();

    /* ⑤ 相对口径未受影响：战斗封顶仍 = 需求×80%（曲线抬升不动升级节奏的形状） */
    console.log('  --- ⑤ 升级节奏的相对口径（曲线抬升不动它们） ---');
    (function () {
      var R = DATA.EXP_RULE || {};
      check('§170⑤ 战斗经验封顶 = 当前需求 × 80%（相对口径 · 与曲线高低无关）',
        R.capPct === 0.8);
      var lv60 = G.expNeedOf({ level: 60 });
      var raw = 81040;                                   /* 县城级歼灭（探针实测锚） */
      var cap = Math.round(lv60 * R.capPct);
      var gain = Math.min(raw, cap);
      check('§170⑤b 真算一场县城级战斗在 Lv60 的收益（' + (gain / lv60 * 100).toFixed(0)
        + '% 级 · gain=min(raw,cap)）', gain === raw && cap > raw);
    })();

    var arc170 = fs170.readFileSync(p170.join(__dirname, '需求档案.md'), 'utf8');
    check('§170⑥ 需求档案在册（v89.170 · 老板原文关键句逐字）',
      arc170.indexOf('v89.170') >= 0
      && arc170.indexOf('前期所需经验太低了') >= 0
      && arc170.indexOf('直升一百多级') >= 0);
  })();

"""
    s = s.replace(ANCHOR, SECTION + ANCHOR)
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    s2 = io.open(P, 'r', encoding='utf-8', newline='').read()
    assert guard in s2
    print('  [ ok ] §170 段已插入')

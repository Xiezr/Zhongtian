# -*- coding: utf-8 -*-
"""v89.173a · 经验道具：撤等级限制（capLv 退役）+ 固定整数面额
老板拍板：「已下架的就不要拿出来讨论了。那就这样，不作等级限制，对道具经验取整，
         练兵10W，治军100W，兵仙300W，兵圣450W」
覆盖：js/data.js（EXP_CURVE 注释 · expCumOf 退役 · EXP_ITEM_SPEC 全块 · EXP_RULE · EXP_PENALTY）
      js/domain.js（expItemCapOf 删除 + expItemGrantOf 简化）
      js/systems.js（useItem / gainExpByItem 去 capped）
      js/ui.js（openExpPick 重写 · help · setExpItem 注释）
纪律：先全部内存替换（任一锚点不命中即中断，不落盘）；再统一写回；写后跑 node --check。
"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

def edit_range(path, tag, start, end, new):
    s = load(path)
    i = s.index(start)
    j = s.index(end, i) + len(end)
    assert s.count(start) == 1 and s.count(end) == 1, '[%s] 区间锚不唯一(%d/%d)' % (tag, s.count(start), s.count(end))
    FILES[path] = s[:i] + new + s[j:]
    print('  ok  ' + tag + '  (区间 %d 字符 → %d 字符)' % (j - i, len(new)))

# ============================================================
# A. js/data.js
# ============================================================
print('== data.js ==')

# A1. EXP_CURVE 注释里的「道具效果」段 —— 更新为固定面额口径
edit('js/data.js', 'A1 EXP_CURVE 注释·道具效果段', r'''   *   道具效果（v89.171 起：EXP_ITEM_SPEC 按 capLv 累计取额、到线即止 —— 见该表注释）：
   *     练兵经验 800 金 培养至 Lv10 · 兵仙遗篇 24 万金 至 Lv50 ·
   *     千古兵圣 40 万金 至 Lv60（全族封顶 = 凡品段）—— 道具**只服务前期**：
   *     60 级以上一整族都用不了（老板 v89.171：「不然后边纯买道具了」）。
   *   累计（total）= Σ need(1..240)，**加载时累加算出**（经验道具按百分比取额）。''',
     r'''   *   道具效果（v89.173 起：EXP_ITEM_SPEC 用**固定整数面额**、不设等级限制 —— 见该表注释）：
   *     练兵经验 800 金 +10 万 · 治军之道 1.92 万金 +100 万 ·
   *     兵仙遗篇 24 万金 +300 万 · 千古兵圣 40 万金 +450 万
   *     （老板 v89.173：「不作等级限制，对道具经验取整」）。
   *   累计（total）= Σ need(1..240)，**加载时累加算出**（战报/体检引用 · 不再是道具口径）。''')

# A2. expCumOf 退役（墓碑注释 + 函数删除）
edit('js/data.js', 'A2 expCumOf 退役', r'''  /* 从 Lv1（经验 0）培养到 Lv{lv} 所需的**累计经验**（Σ need(1..lv−1)）。
     经验道具的"面额"（v89.171 按 capLv 现算）与「到线即止」判定都读它 ——
     唯一出口，别再各算一份；与上面的 total / domain 的 expNeedOf 同源（逐项 round 后累加）。 */
  DATA.expCumOf = function (lv) {
    var C = DATA.EXP_CURVE, n = Math.max(1, Math.min(C.topLv + 1, Math.round(Number(lv) || 1))), sum = 0;
    for (var i = 1; i < n; i++) sum += Math.round(C.needTop * Math.pow(i / C.topLv, C.alpha));
    return sum;
  };''',
     r'''  /* v89.173：「曲线累计 expCumOf」随道具 capLv 口径一起退役（v89.171 立、v89.173 撤）——
     道具改固定面额后它没有消费者；要算"培养到 LvN 的累计"，请直接用 expNeedOf 逐级求和
     （上面 EXP_CURVE.total 的 IIFE 就是同一算法的范例）。 */''')

# A3. EXP_ITEM_SPEC 大块（注释 + 11 档表 + forEach）—— 区间替换
edit_range('js/data.js', 'A3 EXP_ITEM_SPEC 全块',
  '    /* ============================================================\n     * 经验道具的**量级归一**（v89.73 · 老板报的 bug）',
  "it.desc = '将领经验+' + it.amount + '（最多培养至 Lv' + it.capLv + '）';\n      });\n    })();",
  r'''    /* ============================================================
     * 经验道具的**面额表**（唯一来源 · v89.173 老板拍板）
     * ------------------------------------------------------------
     * 病根史（v89.73）：曲线与道具各改各的 —— 曲线缩小后，道具的 amount
     *   还是缩小前写死的绝对值（兵仙遗篇 +100 万 = 整条曲线），一颗道具一步登天。
     *   此后道具量一直"跟曲线挂钩"：v89.73 按占曲线百分比现算；
     *   v89.171 按 capLv 累计取额 + 到线即止（"只服务前期"）。
     * 老板原话（v89.173）：「已下架的就不要拿出来讨论了。那就这样，不作等级限制，
     *   对道具经验取整，练兵10W，治军100W，兵仙300W，兵圣450W。」
     *   · **脱离曲线**，改固定整数面额；v89.171 的 capLv 与「到线即止」整条退役
     *     （expItemCapOf 删除 · expCumOf 退役 · 闸门只剩资质上限闸，见 domain.js）；
     *   · 在售 4 档 = 老板给定的面额（10 万 / 100 万 / 300 万 / 450 万）；
     *   · 商城下架档（v89.104 起不售 · 仅存量可用）：按同口径**就近代整为整数万**
     *     冻结（如 192,875 → 19 万），不再参与曲线联动 —— 全族面额自此都是整数万。
     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）**未动**（延续 v89.73 / v89.104）。
     * 调平衡只改这张表：amount = 固定面额（整数万），price = 内部价。
     * ============================================================ */
    DATA.EXP_ITEM_SPEC = [
      { id: 'lianbing_jingyan', name: '练兵经验',   amount: 100000,  price: 8,     was: [100, 10] },
      { id: 'pijiang_shouji',   name: '裨将手记',   amount: 190000,  price: 19,    was: [500, 30] },
      { id: 'bingfa_xinde',     name: '兵法心得',   amount: 380000,  price: 36,    was: [1000, 60] },
      { id: 'xiaowei_zhaji',    name: '校尉札记',   amount: 630000,  price: 102,   was: [5000, 200] },
      { id: 'zhijun_zhidao',    name: '治军之道',   amount: 1000000, price: 192,   was: [10000, 300] },
      { id: 'jiangjun_zhanlu',  name: '将军战录',   amount: 1360000, price: 450,   was: [50000, 1200] },
      { id: 'dudu_bingfa',      name: '大都督兵法', amount: 1840000, price: 840,   was: [200000, 3800] },
      { id: 'mingjiang_xinchuan', name: '名将心传', amount: 2410000, price: 1560,  was: [500000, 8000] },
      { id: 'bingxian_yipian',  name: '兵仙遗篇',   amount: 3000000, price: 2400,  was: [1000000, 14000] },
      { id: 'taigong_bingshu',  name: '太公兵书',   amount: 3800000, price: 3300,  was: [5000000, 50000] },
      { id: 'bingsheng',        name: '千古兵圣',   amount: 4500000, price: 4000,  was: [20000000, 150000] },
    ];
    (function () {
      DATA.EXP_ITEM_SPEC.forEach(function (sp) {
        var it = null;
        DATA.ITEMS.forEach(function (x) { if (x.id === sp.id) it = x; });
        if (!it) return;                       /* 表里没有就跳过（不凭空造物品） */
        it.amount = sp.amount;                 /* v89.173：固定面额（唯一来源） */
        it.price = sp.price;
        it.desc = '将领经验+' + it.amount;
      });
    })();''')

# A4. EXP_RULE.perResource：1000 → 500（附 v89.173 注释）
edit('js/data.js', 'A4 EXP_RULE perResource',
  r'''  DATA.EXP_RULE = {
    perResource: 1000,   // 每 1000 资源 = 1 经验
    winMul: 2,           // 胜方 ×2''',
  r'''  DATA.EXP_RULE = {
    /* v89.173（老板）：「出征带来的经验体验调高一点…尽量拿满 0.8 级经验」——
       1000 → **500**（拿满 0.8 级所需的歼灭量减半）：Lv50~150 打 Lv9/Lv10 野地
       从"打不满（52%~86%）"回到可拿满（探针 probe_v89173a 有全表）；
       与 EXP_PENALTY.decay 放宽（0.65→0.8）搭配 = "对象等级要求低一点"。 */
    perResource: 500,    // 每 500 资源 = 1 经验（v89.173：原 1000）
    winMul: 2,           // 胜方 ×2''')

# A5. EXP_PENALTY.decay：0.65 → 0.8
edit('js/data.js', 'A5 EXP_PENALTY decay',
  r'''  DATA.EXP_PENALTY = { tier: 12, maxLv: 10, decay: 0.65, minMul: 0.03 };''',
  r'''  DATA.EXP_PENALTY = {
    tier: 12, maxLv: 10,
    /* v89.173（老板）：「出征对象的等级…可以要求低一点」—— 惩罚幅度放宽：
       0.65 → **0.8**（差 1 档 80% · 2 档 64% · 3 档 51%，原 65% / 42% / 27%）；
       台阶结构（tier / maxLv）与地板（minMul）不动 —— 只"少遭罪"，不改档位设计。 */
    decay: 0.8, minMul: 0.03,
  };''')

# ============================================================
# B. js/domain.js —— expItemCapOf 删除 + expItemGrantOf 简化
# ============================================================
print('== domain.js ==')
edit_range('js/domain.js', 'B1 expItemCapOf/expItemGrantOf 重写',
  '  /* ============================================================\n   * 经验道具的**培养上限**（v89.171 · 老板「经验值设置…看起来很高，建议最多能',
  '    var grant = Math.min(item.amount || 0, Math.ceil(rem / b));\n'
  '    return { ok: true, cap: cap, grant: grant, capped: capped };\n  };',
  r'''  /* ============================================================
   * 经验道具闸门（v66 立 · v89.173 收口）
   * ------------------------------------------------------------
   * **唯一出口** GAME.expItemGrantOf：界面（选择窗）与两个消费点
   * （单个使用 / 批量使用）一律走它 ——「界面与执行同一把尺」是铁律。
   *   · v89.171 曾按 capLv（培养上限 10~60）「到线即止」；
   *   · v89.173（老板拍板：「不作等级限制」）—— capLv 上限闸与额度折算
   *     **整条退役**（`expItemCapOf` 一并删除）：任何等级的将领都能用，
   *     效果 = 面额全额（EXP_ITEM_SPEC 固定整数万）。
   *   · 保留 v66 的**资质上限闸**（expBlockOf）：将领自身的等级上限由资质决定
   *     （凡品 60 … 天授 240），到顶后不能再吃经验 —— 这是将领养成口径，
   *     与"道具限制"是两码事，别混为一谈。
   * ============================================================ */
  GAME.expItemGrantOf = function (g, item) {
    if (!g || !item) return { ok: false, msg: '道具或将领不存在' };
    var blk = GAME.expBlockOf(g);                /* 先过资质/君主段闸（既有口径，消息照旧） */
    if (blk) return { ok: false, msg: blk };
    return { ok: true, grant: item.amount || 0 };
  };''')

# ============================================================
# C. js/systems.js —— 两个消费点去 capped
# ============================================================
print('== systems.js ==')
edit('js/systems.js', 'C1 useItem exp 分支',
  r'''      /* v89.171（老板「道具只能前期升级，不然后边纯买道具」）：
         闸门与额度走**唯一出口** GAME.expItemGrantOf —— 内含 v66 的资质上限闸（expBlockOf），
         并追加**培养上限**（capLv，10~60）与「到线即止」的额度折算（超出部分不生效）。 */
      var gt3 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g3, item) : { ok: true, grant: item.amount };
      if (!gt3.ok) return { ok: false, msg: gt3.msg };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      var rg3 = GAME.battle.gainExp(g3, gt3.grant, '使用 ' + item.name);
      var got3 = (rg3 && rg3.gain) || gt3.grant;
      gain = got3;                       /* v89.171：批量口按**实得**累加（面额可能被上限截断） */
      ok = true;
      msg = g3.name + ' 经验 +' + U.numText(got3, 0)
        + (gt3.capped ? '（已达「' + item.name + '」的培养上限 Lv' + gt3.cap + '）' : '');''',
  r'''      /* v89.173（老板「不作等级限制」）：v89.171 的 capLv 培养上限与到线折算整条退役；
         闸门仍走**唯一出口** GAME.expItemGrantOf（余资质上限闸），grant = 固定面额全额。 */
      var gt3 = GAME.expItemGrantOf ? GAME.expItemGrantOf(g3, item) : { ok: true, grant: item.amount };
      if (!gt3.ok) return { ok: false, msg: gt3.msg };
      /* v26（需求 1）：走唯一入口 gainExp（含升级日志与等级结算） */
      var rg3 = GAME.battle.gainExp(g3, gt3.grant, '使用 ' + item.name);
      var got3 = (rg3 && rg3.gain) || gt3.grant;
      gain = got3;                       /* 按**实得**累加（神器加成在 gainExp 内乘） */
      ok = true;
      msg = g3.name + ' 经验 +' + U.numText(got3, 0);''')

edit('js/systems.js', 'C2 gainExpByItem 注释',
  r'''       v89.171：闸门升级为**唯一出口** GAME.expItemGrantOf（含资质上限 + 培养上限 capLv）。 */''',
  r'''       v89.173：闸门仍是**唯一出口** GAME.expItemGrantOf（v89.171 的培养上限已退役）。 */''')

edit('js/systems.js', 'C3 gainExpByItem 实得注释',
  r'''      gotSum += (r.gain || 0);                       /* v89.171：按实得累加（面额可能被培养上限截断） */''',
  r'''      gotSum += (r.gain || 0);                       /* 按实得累加（神器加成在 gainExp 内乘） */''')

edit('js/systems.js', 'C4 gainExpByItem 结算文案去 capped',
  r'''        + (up > 0 ? '，升至 Lv' + g.level : '（' + U.numText(need - g.exp, 0) + ' 后升级）')
        + ((gt0 && gt0.capped) ? '（已达「' + item.name + '」的培养上限 Lv' + gt0.cap + '）' : ''),''',
  r'''        + (up > 0 ? '，升至 Lv' + g.level : '（' + U.numText(need - g.exp, 0) + ' 后升级）'),''')

# ============================================================
# D. js/ui.js —— 选择窗重写 / help / setExpItem 注释
# ============================================================
print('== ui.js ==')
edit('js/ui.js', 'D1 openExpPick help',
  r'''    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 治军之道 / 兵仙遗篇 / 千古兵圣。'
      + '\n⚠️ v89.171 起：经验道具「只服务前期」——每档带培养上限（10~60），低于上限才能用、到线即止；'
      + '\n60 级以上请靠出征历练；手中道具留给新招的将领。');''',
  r'''    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 治军之道 / 兵仙遗篇 / 千古兵圣。'
      + '\n经验道具**不设等级限制**（v89.173）：任何等级都能用，一次加固定经验。');''')

edit_range('js/ui.js', 'D2 openExpPick 正常分支重写',
  '    /* v89.171（老板「道具只能前期升级，不然后边纯买道具了」）：逐档先问**唯一出口** ——',
  '  ui.setExpItem = function (genId, itemId) {',
  r'''    /* v89.173（老板「不作等级限制」）：撤 v89.171 的逐档上限（变暗 / toast / 全到线空态）——
       任何档位都可用；卡面 = 名字 ×持有 +X万（面额短写，全族整数万）。 */
    var want = (ui._expPick || {})[genId];
    var pick = null;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    if (!pick) pick = items[0].id;
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it ? (it.amount || 0) : 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;
    ui.openShell({
      title: '📖 用经验道具 · ' + U.escape(g.name),
      sub: 'Lv' + g.level + '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(expNeed, 0) +
        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具（用了直接加固定经验 · 不设等级限制）</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') +
            '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '"' +
            ' title="' + U.escape('将领经验 +' + U.numText(x.amount || 0, 0)) + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">+' + Math.round((x.amount || 0) / 10000) + '万</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-hint">' +
        '「用到升级」= 一直吃到升过当前等级（持有不够就全吃完）；跨级后需要重新点。' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="one" data-gen="' + genId +
          '" data-item="' + pick + '">用 1 个</button>' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="till" data-gen="' + genId +
          '" data-item="' + pick + '"' + (toLevel > have ? ' title="持有 ' + have + ' 个，不够一路升上去"' : '') +
          '>用到升级</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

''')

edit('js/ui.js', 'D3 setExpItem 注释',
  r'''    /* v89.171：到线的档位点不动 —— 不静默，toast 说明原因（"为什么没反应"比禁用更糟） */''',
  r'''    /* 闸门预检（v66 起）：不可用就不静默 —— toast 说明原因（v89.173 后只可能是资质上限） */''')

# ============================================================
# 统一落盘
# ============================================================
print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

# 写后哨兵：node --check
print('== 语法哨兵 ==')
ok = True
for p in FILES:
    r = subprocess.run(['node', '--check', os.path.join(ROOT, p)], capture_output=True, text=True)
    print(('  ' + ('PASS ' if r.returncode == 0 else 'FAIL ') + p + ' ' + (r.stderr.strip()[:200] if r.returncode else '')))
    ok = ok and r.returncode == 0
sys.exit(0 if ok else 1)

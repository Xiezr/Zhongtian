# -*- coding: utf-8 -*-
"""v89.86 · 门派 P1 · 六派被动加成实装（老板拍板；走既有消费链，不新增战斗公式）
   xuanhe 玄鹤门  行军速度 +8%      → battle GAME.march.speedFactor
   qingfeng 青锋阁 部队攻击 +6%      → battle 伤害链 atkMult（与科技/宝物/羁绊相乘）
   baicao 百草堂  战后伤兵回复 +15%  → battle returnArmy 回收率
   huxiao 虎啸营  攻城伤害 +8%      → battle siegeMult（仅攻城）
   xuanji 玄机阁  器械打造耗时 −15%  → GAME.train（仅 craft 器械）
   muyun 牧云庄   坐骑装备属性 +20%  → systems 装备汇总（与驯马技巧同链相乘）
   无门派时各链与今日逐字节一致（sectBonus 返回 0）。
"""
import io
import os
import sys

DA = r'E:\Deepseekdb\js\data.js'
DO = r'E:\Deepseekdb\js\domain.js'
BA = r'E:\Deepseekdb\js\battle.js'
SY = r'E:\Deepseekdb\js\systems.js'
UI = r'E:\Deepseekdb\js\ui.js'


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


# ============ data.js · 六派被动 ============
edit(DA, r"""  DATA.SECTS = [
    { id: 'xuanhe',   name: '玄鹤门', icon: '🕊️', style: '轻身',
      desc: '以轻身与阵形见长，门人多习斥候之道，行路迅疾。' },
    { id: 'qingfeng', name: '青锋阁', icon: '🗡️', style: '锋锐',
      desc: '专攻锋锐一击，讲求出鞘必见血，门下多剑客。' },
    { id: 'baicao',   name: '百草堂', icon: '🌿', style: '医道',
      desc: '精于金创与药石，门下常行医于军中，救人无数。' },
    { id: 'huxiao',   name: '虎啸营', icon: '🐯', style: '刚猛',
      desc: '刚猛横练，以硬桥硬马立门，门风最重信义。' },
    { id: 'xuanji',   name: '玄机阁', icon: '🧭', style: '机变',
      desc: '工于机关与推演，善察人所不察，江湖谓之"活舆图"。' },
    { id: 'muyun',    name: '牧云庄', icon: '☁️', style: '耕牧',
      desc: '半耕半牧，庄中粮秣丰足，门人习性近于乡野。' },
  ];""",
     r"""  /* v89.86（门派 P1 · 老板拍板实装）：六派**被动加成** ——
     每个 trait 的 key 都由 `GAME.sectBonus` 唯一发放，消费点全在既有链上
     （行军速度 / 攻击伤害 / 攻城伤害 / 伤兵回收 / 器械耗时 / 坐骑属性），
     **不新增战斗公式、不新增资源类型**（门派系统规则 §十二）。 */
  DATA.SECTS = [
    { id: 'xuanhe',   name: '玄鹤门', icon: '🕊️', style: '轻身',
      trait: { key: 'marchPct', val: 0.08, text: '行军速度 +8%' },
      desc: '以轻身与阵形见长，门人多习斥候之道，行路迅疾。' },
    { id: 'qingfeng', name: '青锋阁', icon: '🗡️', style: '锋锐',
      trait: { key: 'atkPct', val: 0.06, text: '部队攻击 +6%' },
      desc: '专攻锋锐一击，讲求出鞘必见血，门下多剑客。' },
    { id: 'baicao',   name: '百草堂', icon: '🌿', style: '医道',
      trait: { key: 'woundPct', val: 0.15, text: '战后伤兵回复 +15%' },
      desc: '精于金创与药石，门下常行医于军中，救人无数。' },
    { id: 'huxiao',   name: '虎啸营', icon: '🐯', style: '刚猛',
      trait: { key: 'siegePct', val: 0.08, text: '攻城伤害 +8%' },
      desc: '刚猛横练，以硬桥硬马立门，门风最重信义。' },
    { id: 'xuanji',   name: '玄机阁', icon: '🧭', style: '机变',
      trait: { key: 'craftCut', val: 0.15, text: '器械打造耗时 −15%' },
      desc: '工于机关与推演，善察人所不察，江湖谓之"活舆图"。' },
    { id: 'muyun',    name: '牧云庄', icon: '☁️', style: '耕牧',
      trait: { key: 'mountPct', val: 0.20, text: '坐骑装备属性 +20%' },
      desc: '半耕半牧，庄中粮秣丰足，门人习性近于乡野。' },
  ];""",
     '门派P1 · 六派被动数据')

# ============ domain.js · sectBonus 唯一出口 ============
edit(DO, r"""  GAME.sectOf = function () {
    var st = GAME.sectState();
    return st.id ? (DATA.SECT_BY_ID[st.id] || null) : null;
  };""",
     r"""  GAME.sectOf = function () {
    var st = GAME.sectState();
    return st.id ? (DATA.SECT_BY_ID[st.id] || null) : null;
  };
  /* v89.86（门派 P1 · 老板拍板实装）：门派被动加成 —— **唯一出口**（界面只读它，消费点只调它）。
     加成全部落在既有消费链上（不新增战斗公式/资源类型）：
       marchPct  行军速度      → GAME.march.speedFactor
       atkPct    部队攻击      → battle 伤害链 atkMult（与科技/宝物/羁绊相乘）
       siegePct  攻城伤害      → battle siegeMult（仅攻城）
       woundPct  战后伤兵回复  → battle.returnArmy 的回收率
       craftCut  器械打造耗时  → GAME.train（仅 craft 器械）
       mountPct  坐骑装备属性  → systems 装备汇总（与驯马技巧同链相乘）
     无门派 / 无该键 → 0 —— 无门派时各链与今日**逐字节一致**（关键回归判据）。 */
  GAME.sectBonus = function (key) {
    var sc = GAME.sectOf();
    var t = sc && sc.trait;
    if (!t || !key || t.key !== key) return 0;
    return t.val || 0;
  };
  /* 门派被动文案（门派面板读取；别处不要再拼一遍） */
  GAME.sectTraitText = function (sc) {
    sc = sc || GAME.sectOf();
    return (sc && sc.trait && sc.trait.text) || '—';
  };""",
     '门派P1 · sectBonus 出口')

# ============ battle.js · 四个消费点 ============
edit(BA, r"""    /* ③ 天气：雨 −20% / 雪 −50% / 雾 −30% / 大风 +10% */
    if (GAME.story && GAME.story.combatMod) m *= (GAME.story.combatMod().move || 1);""",
     r"""    /* ③ 天气：雨 −20% / 雪 −50% / 雾 −30% / 大风 +10% */
    if (GAME.story && GAME.story.combatMod) m *= (GAME.story.combatMod().move || 1);

    /* ③c 门派被动（v89.86 · 玄鹤门「行军速度 +8%」）—— 唯一出口 sectBonus */
    if (GAME.sectBonus) m *= (1 + GAME.sectBonus('marchPct'));""",
     '门派P1 · 行军速度')

edit(BA, r"""      /* 科技 */
      atkMult *= (1 + GAME.systems.techBonus('atk'));""",
     r"""      /* 科技 */
      atkMult *= (1 + GAME.systems.techBonus('atk'));
      /* 门派被动（v89.86 · 青锋阁「部队攻击 +6%」）—— 与科技/宝物/羁绊同链相乘 */
      if (GAME.sectBonus) atkMult *= (1 + GAME.sectBonus('atkPct'));""",
     '门派P1 · 部队攻击')

edit(BA, r"""    var siegeMult = 1;
    if (opts.sieging && GAME.story && GAME.story.siegeMult) siegeMult = GAME.story.siegeMult();""",
     r"""    var siegeMult = 1;
    if (opts.sieging && GAME.story && GAME.story.siegeMult) siegeMult = GAME.story.siegeMult();
    /* 门派被动（v89.86 · 虎啸营「攻城伤害 +8%」）—— 仅攻城生效 */
    if (opts.sieging && GAME.sectBonus) siegeMult *= (1 + GAME.sectBonus('siegePct'));""",
     '门派P1 · 攻城伤害')

edit(BA, r"""    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));""",
     r"""    if (GAME.systems && GAME.systems.techBonus) rate = Math.min(0.9, rate * (1 + GAME.systems.techBonus('repair')));
    /* 门派被动（v89.86 · 百草堂「战后伤兵回复 +15%」）—— 与军医/维修科技同链 */
    if (GAME.sectBonus) rate = Math.min(0.9, rate * (1 + GAME.sectBonus('woundPct')));""",
     '门派P1 · 伤兵回复')

# ============ systems.js · 坐骑属性 ============
edit(SY, r"""    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它） */
    var horseMul = 1 + S.techBonus('horse');""",
     r"""    /* 驯马技巧：坐骑装备属性 +5%/级（仅军装侧 —— 修炼装备独立体系不吃它）
       v89.86（门派 P1）：牧云庄「坐骑装备属性 +20%」并入同一条乘链（唯一出口 sectBonus） */
    var horseMul = (1 + S.techBonus('horse')) * (1 + (GAME.sectBonus ? GAME.sectBonus('mountPct') : 0));""",
     '门派P1 · 坐骑属性')

# ============ domain.js · 器械打造耗时 ============
edit(DO, r"""    if (t.craft && GAME.masteryOf(city, 'gongjiangzuofang')) totalTime = Math.round(totalTime * 0.85);""",
     r"""    if (t.craft && GAME.masteryOf(city, 'gongjiangzuofang')) totalTime = Math.round(totalTime * 0.85);
    /* 门派被动（v89.86 · 玄机阁「器械打造耗时 −15%」）—— 仅器械（craft）生效 */
    if (t.craft && GAME.sectBonus) totalTime = Math.round(totalTime * (1 - Math.min(0.5, GAME.sectBonus('craftCut'))));""",
     '门派P1 · 器械耗时')

# ============ ui.js · 门派面板显示被动 ============
edit(UI, r"""      S.forEach(function (x) {
        html += '<div class="op-row" style="display:block;">' +
          '<div><b>' + x.icon + ' ' + U.escape(x.name) + '</b>　<span class="ui-sub">' + U.escape(x.style) + '</span></div>' +
          '<div class="op-hint">' + U.escape(x.desc) + '</div>' +
          '<button class="btn gold" data-action="sect-join" data-v="' + x.id + '"' + (cd > 0 ? ' disabled' : '') + '>入派</button>' +
          '</div>';
      });""",
     r"""      S.forEach(function (x) {
        html += '<div class="op-row" style="display:block;">' +
          '<div><b>' + x.icon + ' ' + U.escape(x.name) + '</b>　<span class="ui-sub">' + U.escape(x.style) + '</span></div>' +
          /* v89.86（门派 P1）：被动加成上架 —— 入派前就能看见将得到什么 */
          '<div class="op-hint">被动：<b style="color:var(--gold-light);">' + U.escape(GAME.sectTraitText(x)) + '</b>　·　' +
            U.escape(x.desc) + '</div>' +
          '<button class="btn gold" data-action="sect-join" data-v="' + x.id + '"' + (cd > 0 ? ' disabled' : '') + '>入派</button>' +
          '</div>';
      });""",
     '门派P1 · 名录显示被动')

edit(UI, r"""        '<div class="op-row"><span class="op-kv">门中品阶 <b>' + U.escape((rk && rk.name) || '') + '</b></span>' +
          '<span class="op-kv">门派声望 <b>' + U.fmt(st.rep) + '</b></span></div>' +""",
     r"""        '<div class="op-row"><span class="op-kv">门中品阶 <b>' + U.escape((rk && rk.name) || '') + '</b></span>' +
          '<span class="op-kv">门派声望 <b>' + U.fmt(st.rep) + '</b></span></div>' +
        /* v89.86（门派 P1）：门派被动 —— 加成已实装（走既有消费链） */
        '<div class="op-hint">门派被动：<b style="color:var(--gold-light);">' + U.escape(GAME.sectTraitText(sc)) + '</b></div>' +""",
     '门派P1 · 已入派显示被动')

print('DONE')

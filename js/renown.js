/* ============================================================
 * renown.js — 名声：**世界怎么看你**
 * ------------------------------------------------------------
 * 起因（老板 2026-10-22：「你做的是一整个废土……从大处着眼」）：
 *
 * 这个废土里所有选择都是**散的**：
 *   · 洗劫一处营地 → 只是"后面招的人少 8%"（v92.4 的一个局部乘数）
 *   · 屠一座城     → 只进战报
 *   · 保护一处村社 → 只有那一处记得
 * 玩家做了一百个选择，世界**没有一个统一的反应**。
 * 没有这个，所有"选择"都只是局部数值调整，不是"你成了什么人"。
 *
 * 所以这里只做一件事：**把散落的选择汇总成一个数**，
 * 再让世界按这个数对待你（营地招人 / 村社给不给 / 纳贡要多少）。
 *
 * ⚠️ 刻意不做的事：
 *   · 不做"善恶值"UI 条。数值化会让玩家开始刷分（"再屠一个村就升档"），
 *     那就从"你是什么人"退化成了"你在打成就"。世界用**行为**回答你，
 *     不是用一根进度条。
 *   · 不给加成。名声高不会让你兵更强 —— 它只改变**别人对你的态度**。
 *     这是这个模块唯一允许的因果方向。
 *   · 不惩罚到死。屠夫也能玩（能抢），只是没人愿意跟你走。
 *     两条路都要能走通，否则它不是选择，是正确答案。
 * ============================================================ */
(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var RN = GAME.renown = {};   /* ⚠️ 不用 R：ruin.js 已占 RN.（audit 按字面前缀查重名会误报）*/
  var U = GAME.utils;

  /* 权重：一次屠城的份量远大于一次洗劫 —— 但都不是"一时冲动"能抵消的。
     为什么洗劫营地只有 8：营地是散落的小团伙，抢了是"抢了几个陌生人"；
     屠城是 40：那是"你杀了一城的人"。量级必须差得远，否则两件事等价。 */
  var W = {
    raidCamp: 8,        /* 洗劫幸存者营地 */
    raidVillage: 12,    /* 抢一处村社 */
    callVillage: 3,     /* 从村社征人（不算恶，但也不是善） */
    guardVillage: 6,    /* 保护一处村社（长期给粮） */
    saveVillage: 10,    /* 救活一处要荒废的村社 */
    sackCity: 40,       /* 屠一座城 */
    holdCity: 12,       /* 守住一次来犯（你没有退，城里的人活下来了） */
    abandonCity: 15,    /* 弃城（自己烧掉/放弃） */
    rescueConvoy: 4     /* 拓荒队把人带回来了 */
  };
  RN.W = W;

  function st() { return GAME.state || {}; }

  RN.raw = function () {
    var s = st();
    if (!s.renown) s.renown = { mercy: 0, cruelty: 0 };
    return s.renown;
  };

  /* 记一笔。kind: 'mercy' | 'cruelty' */
  RN.add = function (kind, n) {
    var s = GAME.state;
    if (!s) return 0;
    var r = RN.raw();
    var v = (n == null) ? 0 : n;
    if (kind === 'mercy') r.mercy += v;
    else if (kind === 'cruelty') r.cruelty += v;
    else return RN.score();
    return RN.score();
  };

  /* 净名声。**不裁剪、不回弹** —— 做过的事不会自己消失。
     这是"不可逆"那条尺子在这个模块上的落点：你可以改，但改不掉。 */
  RN.score = function () {
    var r = RN.raw();
    return (r.mercy | 0) - (r.cruelty | 0);
  };

  /* 分档。阈值写在这里（唯一来源），UI 与各系统都读它 */
  var TIERS = [
    { id: 'butcher', min: -1e9, max: -40, name: '屠夫',
      note: '他们听说你来了，会先把粮食藏起来，然后把人藏起来。' },
    { id: 'cold', min: -40, max: -10, name: '心冷',
      note: '没人信你会白帮忙，但也没人怕你 —— 还不算最坏。' },
    { id: 'plain', min: -10, max: 10, name: '无名',
      note: '废土上没人认识你。这既是坏事，也是好事。' },
    { id: 'trusted', min: 10, max: 40, name: '可托付',
      note: '有人说你给过粮。这种话在废土上传得比刀快。' },
    { id: 'saint', min: 40, max: 1e9, name: '仁名',
      note: '孩子们不怕你的旗子。这在这个年代，很稀奇。' }
  ];
  RN.TIERS = TIERS;

  RN.tier = function () {
    var v = RN.score();
    for (var i = 0; i < TIERS.length; i++) {
      if (v >= TIERS[i].min && v < TIERS[i].max) return TIERS[i];
    }
    return TIERS[2];
  };

  /* ============================================================
   * 世界怎么用这个数 —— 三个出口，都在别处被消费
   * ============================================================ */

  /* ① 村社愿不愿意跟你走（征召成功率/人数倍率） */
  RN.willFollow = function () {
    var v = RN.score();
    if (v <= -40) return 0.35;      /* 屠夫：只剩没得选的人 */
    if (v <= -10) return 0.7;
    if (v < 10) return 1;
    if (v < 40) return 1.15;
    return 1.3;
  };

  /* ② 纳贡/结盟的价钱（他们不信你会守约，就要你先付） */
  RN.priceMul = function () {
    var v = RN.score();
    if (v <= -40) return 1.5;
    if (v <= -10) return 1.25;
    if (v < 10) return 1;
    if (v < 40) return 0.9;
    return 0.8;
  };

  /* ③ 村社每月自然流失的额外项（屠夫治下的人都跑，仁名之下有人来投） */
  RN.driftPerMonth = function () {
    var v = RN.score();
    if (v <= -40) return -0.012;
    if (v <= -10) return -0.006;
    if (v < 10) return 0;
    if (v < 40) return 0.004;
    return 0.008;
  };

  /* 一行给人看的话（行政页用，不显示分数 —— 见文件头"不做善恶条"） */
  RN.lineOf = function () {
    var t = RN.tier();
    return t.name + '：' + t.note;
  };

  /* 存档：renown 跟着 state 走，无需 pack/unpack。
     旧档没有该字段 → raw() 首次调用自动补 {0,0}（不迁移、不崩）。 */
})();

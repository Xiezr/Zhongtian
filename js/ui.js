/* ============================================================
 * ui.js　界面层入口 · ui 命名空间初始化（拆分后只剩骨架）
 * ------------------------------------------------------------
 * v156.27：21,456 行的 ui.js 按功能域拆成 19 个文件（本文件 + 18 个 ui-*.js）。
 *   **纯搬运**：所有 ui.xxx 定义及其先后顺序一字未改。
 *   等价性证明：node .workbuddy/tools/prof/snapshot_ui_fns.js --diff before after
 * ⛔ 这个文件只放"全站唯一的东西"：命名空间、$ / $$、跨域共享常量。
 *    具体面板请去对应的 ui-<域>.js，不要往这里加。
 * ============================================================ */
import './core.js';
import './data.js';
import './state.js';
(function () {
  var GAME = window.GAME = window.GAME || {};
  var DATA = GAME.DATA, U = GAME.utils;

  /* 全站唯一的 ui 命名空间。**只在这里初始化一次**；其余 ui-*.js 取引用。 */
  var ui = GAME.ui = {
    view: 'city', side: 'res',
    _curGrid: null, _attackNpc: null, _attackWild: null, _cityId: null,
  };

  /* 两个取元素的小工具：全站唯一实现，挂到 ui._dom 供其余 ui-*.js 取别名。
     ⛔ 不要在各文件里再写一份 —— 那样 18 份实现迟早不一致。 */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  ui._dom = { $: $, $$: $$ };

  /* ============================================================
   * 跨功能域共享的常量表（拆分时前移到这里）
   * ------------------------------------------------------------
   * 它们原来散在 ui.js 各处、被多个功能域引用；拆成独立文件后各自
   * IIFE 互相看不见，所以统一放在**最先执行**的这里。
   * 其余文件用 ui._C 取**同一个对象**（不是副本）。
   * ⛔ 不要在 ui-*.js 里再写一份：多个副本会"改一个不生效"。
   * ============================================================ */
  ui._C = {};
  var EQUIP_SLOT_ORDER = ['weapon', 'head', 'chest', 'waist',
    'arm_up_l', 'arm_up_r', 'arm_low_l', 'arm_low_r',
    'thigh_l', 'thigh_r', 'shin_l', 'shin_r', 'foot_l', 'foot_r',
    'back', 'neck', 'ring', 'pendant', 'mount'];
  ui._C.EQUIP_SLOT_ORDER = EQUIP_SLOT_ORDER;

  var BAG_LEGACY_TAB = { mat: ['treasure', 'material'], item: ['treasure', null], bp: ['treasure', 'blueprint'] };
  ui._C.BAG_LEGACY_TAB = BAG_LEGACY_TAB;

  var BLDG_FUNC = {
    /* ⛔ v89.135 移除：guanfu 条目（"政务厅事务"按钮）—— 老板 10：「不再设置多一个
       '政务厅事务'按钮」：改名 / 主城 / 基因实验室**直接显示**在政务厅格的建筑面板（见政务厅要务段）。 */
    junying: { label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true },
    xiaochang: { label: "🏹 进入军务（出征 · 伤兵）", act: "open-xiaochang" },
    shuyuan: { label: "📜 科技 · 研究", act: "open-panel", view: "tech" },
    kezhan: { label: "🍶 招募英雄", act: "open-inn" },
    zhaoxianguan: { label: "🎎 英雄名录", act: "open-hostel" },
    shichang: { label: "🏪 交易", act: "open-market" },
    cangku: { label: "🏚️ 仓储", act: "open-store" },
    /* v89.80（老板）：「马概（厩）去除"座驾装备"的建筑菜单及相应内容」——
       原菜单项点开的是「装备」总页（view: equip），与英雄档案里的部件栏重复，
       且"座驾"只是装备的一个部位，不值得在建筑里单开一个入口。
       撤掉后点载具研究所格只显示**属性行**（机车解锁 / 建筑专精），不再有功能按钮。
       装备与座驾仍走两条既有的路：英雄档案点部位换装、背包「装备」页选将穿戴。 */
    /* v89.140（老板 4）：「制造厂建筑菜单界面，**新增一行增加一个百炼强化按钮**，
       与打造菜单格式相同。将打造界面里的百炼强化按钮删去」——
       制造厂格上直接出现两颗功能键（打造 / 熔铸强化），打造面板底部不再挂它。 */
    tiejiangpu: [{ label: "⚒️ 打造", act: "open-forge" },
      { label: "⚒️ 熔铸强化", act: "open-enhance" }],
    gongjiangzuofang: { label: "🛠️ 器械 · 箭塔", act: "open-workshop", withIdx: true },
    /* v89.224（老板 1）：本格为**基因实验室的建筑载体**（原在政务厅要务段，已撤）。
       v90.92：原「⚔️ 派系」入口随门派系统整条退役而移除。 */
    honglusi: { label: "🧬 基因实验室", act: "open-lab" },
    /* v85（老板）：「居所不需要幸存者统计功能」—— 居所入口退役；
       「幸存者统计」面板本身保留（城防统计仍由此进入）。 */
    chengqiang: { label: "🧱 城防统计", act: "open-panel", view: "stats" }
  };
  ui._C.BLDG_FUNC = BLDG_FUNC;

})();

# -*- coding: utf-8 -*-
"""v89.165b：smoke 插入 §165（实时读秒五处 live 接入 + 真调 + 档案）。
   运行：python .workbuddy/tools/patch/patch_v89165b_smoke.py"""
import io

R = 'E:/Deepseekdb/'
p = R + 'smoke-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

if '§165① 指挥战斗清单接入 live' in s:
    print('  [skip] §165 已插')
    raise SystemExit(0)

ANCHOR = "\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert s.count(ANCHOR) == 1, '锚点计数=%d' % s.count(ANCHOR)

NEW = '''
  /* ============================================================
   * §165（v89.165）：实时读秒全量排查 —— 五处漏网接入 live 每秒重开
   * 老板原话：「指挥战斗界面的行军为啥读秒和进度条不动的？应该是有在实际计时，
   *   但没有实时显示。查看所有类似实时读秒设置」
   * 清点器：.workbuddy/tools/audit/audit_v89165_live.js（递归 3 层 · 漏网 = 0）
   * ============================================================ */
  (function () {
    var fs165 = require('fs'), p165 = require('path');   /* §165 段自带 require（同 §164 的 fs164/fs-path 形态） */
    var ujs165 = fs165.readFileSync(p165.join(__dirname, 'js', 'ui.js'), 'utf8');
    var mjs165 = fs165.readFileSync(p165.join(__dirname, 'js', 'main.js'), 'utf8');

    console.log('\\n===== §165 实时读秒（五处 live 接入 + 真调） =====');

    check('§165① 指挥战斗清单接入 live（行军读秒/进度条逐秒重开）',
      /live: function \\(\\) \\{ ui\\.openBattleList\\(\\); \\}/.test(ujs165));
    check('§165② 提速小窗接入 live + 完成即关窗（queueDone138 唯一判据）',
      /if \\(ui\\.queueDone138\\(bIdx\\)\\) ui\\.closeModal\\(\\);\\s*\\n\\s*else ui\\.openTrainBoost\\(bIdx\\);/.test(ujs165));
    check('§165③ 通用面板三子视图接入 live（troops/tech/ext · equip/rank/story 保持静态）',
      ujs165.indexOf("if (view === 'troops' || view === 'tech' || view === 'ext') {") >= 0
      && ujs165.indexOf('o165.live = function () { ui.openPanel(view, title, size); };') >= 0);
    check('§165④ 神器面板接入 live（供奉值随游戏时间累积）',
      /live: function \\(\\) \\{ ui\\.openArtifacts\\(\\); \\}/.test(ujs165));
    check('§165⑤ 军务烽火页逐秒刷新（over + beacon · 来袭剩余是现实时间读秒）',
      mjs165.indexOf("['over', 'beacon'].indexOf(ui._marchTab || 'over')") >= 0);

    /* ---- 真调：五处 live 回调可执行 + 读秒随进度变 + 完成即关窗 ---- */
    var keep165 = GAME.state, keepCity165 = GAME.ui._cityId;
    var _om165 = GAME.ui.openModal;
    var log165 = [];
    GAME.ui.openModal = function (h, o) {
      log165.push({ h: String(h), o: o || null });
      return _om165.apply(this, arguments);
    };
    try {
      GAME.newGame({ name: 's165', region: '司隶' });
      var s165 = GAME.state, c165 = GAME.currentCity();
      GAME.ui._cityId = c165.id;

      /* ① 指挥战斗清单：live 重开 + 读秒随推进而变 */
      var m165 = { id: 'M165s', cityId: c165.id, genId: '', modeId: 'raid',
        target: { kind: 'wild', x: 1, y: 1 }, tx: 1, ty: 1, name: '荒野·丁', kind: 'wild',
        army: { yibing: 100 }, elapsed: 96000, totalTime: 600000, scheme: null, ops: 'assault', cargo: null };
      s165.marches.push(m165);
      s165.battles = [];
      log165.length = 0;
      GAME.ui.openBattleList();
      var oB165 = log165[log165.length - 1];
      check('§165⑥ 真调：openBattleList 带 live 且首屏含 16% 读秒',
        !!(oB165 && oB165.o && typeof oB165.o.live === 'function') && /16%/.test(oB165.h));
      m165.elapsed += 120000;
      var ok165 = false;
      try { oB165.o.live(); ok165 = true; } catch (e) { ok165 = false; }
      check('§165⑦ ★ 真调 live 重开：新屏已是 36% 读秒（读秒随进度走）',
        ok165 && /36%/.test(log165[log165.length - 1].h) && log165[log165.length - 1].h.indexOf('16%') < 0);

      /* ② 提速小窗：未完成重开 · 完成即关窗 */
      c165.cells[0].build = { id: 'junying', lvl: 1 };
      s165.queues.train.push({ kind: 'train', cityId: c165.id, bIdx: 0, troopId: 'yibing', count: 5,
        elapsed: 0, totalTime: 600, waiting: false });
      log165.length = 0;
      GAME.ui.openTrainBoost(0);
      var oT165 = log165[log165.length - 1];
      check('§165⑧ 真调：提速小窗带 live（未完成 → 重开不关窗）', (function () {
        if (!(oT165.o && typeof oT165.o.live === 'function')) return false;
        var n0 = log165.length;
        oT165.o.live();
        return log165.length > n0 && GAME.ui._maskEl !== null;
      })());
      s165.queues.train[0].elapsed = s165.queues.train[0].totalTime;
      oT165.o.live();
      check('§165⑨ ★ 真调：队列完成 → live 自动关窗（_maskEl = null）', GAME.ui._maskEl === null);

      /* ③ 通用面板：troops 有 live / equip 对照无 */
      log165.length = 0;
      GAME.ui.openPanel('troops', 't');
      var oP1 = log165[log165.length - 1];
      log165.length = 0;
      GAME.ui.openPanel('equip', null, 'xxl');
      var oP2 = log165[log165.length - 1];
      check('§165⑩ 真调：openPanel(troops) 带 live · openPanel(equip) 不带（对照）',
        !!(oP1.o && typeof oP1.o.live === 'function') && !(oP2.o && oP2.o.live));

      /* ④ 神器 */
      log165.length = 0;
      GAME.ui.openArtifacts();
      check('§165⑪ 真调：神器面板带 live',
        typeof (log165[log165.length - 1].o || {}).live === 'function');
    } finally {
      GAME.state = keep165;
      GAME.ui.openModal = _om165;
      GAME.ui._cityId = keepCity165;
      GAME.ui._maskEl = null;
      GAME.ui._liveReopen = null;
    }

    /* ⑤ 档案在册 */
    var arc165 = fs165.readFileSync(p165.join(__dirname, '需求档案.md'), 'utf8');
    check('§165⑫ 需求档案在册（v89.165 · 老板原文关键句逐字）',
      arc165.indexOf('v89.165') >= 0
      && arc165.indexOf('指挥战斗界面的行军为啥读秒和进度条不动的') >= 0
      && arc165.indexOf('查看所有类似实时读秒设置') >= 0);
  })();
'''
s = s.replace(ANCHOR, NEW + ANCHOR)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('  [ ok ] §165 已插 · 新长度', len(s))

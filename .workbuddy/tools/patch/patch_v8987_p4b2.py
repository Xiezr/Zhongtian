# -*- coding: utf-8 -*-
"""v89.87 需求4b2：观战接入点 —— 设置项 / 初始 state / 主循环 / boot / 测试引导"""
import io

# ---------- 1) data.js：默认设置 ----------
P1 = r'E:\Deepseekdb\js\data.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()
old1 = """    /* v89.86（整改 P-17）：离线推进上限（游戏日；0 = 不限）—— 超出部分五折折算资源/供奉 */
    offlineCapDays: 7 };"""
new1 = """    /* v89.86（整改 P-17）：离线推进上限（游戏日；0 = 不限）—— 超出部分五折折算资源/供奉 */
    offlineCapDays: 7,
    /* v89.87（老板需求 4）：战斗观战 —— 出征战斗抵达后进入战场界面，
       每回合 battleSec 真实秒（60 预设，可提前点「完成」结算）；false = 全自动 */
    battleWatch: true, battleSec: 60 };"""
assert s1.count(old1) == 1, ('data', s1.count(old1))
io.open(P1, 'w', encoding='utf-8', newline='').write(s1.replace(old1, new1, 1))
print('OK data.js')

# ---------- 2) state.js：初始 state 加 battles ----------
P2 = r'E:\Deepseekdb\js\state.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()
old2 = """      queues: { build: [], train: [], tech: [] },
      marches: [],"""
new2 = """      queues: { build: [], train: [], tech: [] },
      marches: [],
      /* v89.87（老板需求 4）：待指挥战斗（观战挂起）—— 纯数据、随存档往返；
         运行时会话挂在内存 GAME._bsess（read 档时由 restoreBattles 重放重建） */
      battles: [],"""
assert s2.count(old2) == 1, ('state', s2.count(old2))
io.open(P2, 'w', encoding='utf-8', newline='').write(s2.replace(old2, new2, 1))
print('OK state.js')

# ---------- 3) main.js：主循环 + boot ----------
P3 = r'E:\Deepseekdb\js\main.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()
old3 = """      if (!$('#screen-game').classList.contains('hidden')) {
        GAME.tickOnce();
        ui.updateProgress();"""
new3 = """      if (!$('#screen-game').classList.contains('hidden')) {
        GAME.tickOnce();
        /* v89.87（老板需求 4）：战斗观战倒计时（**真实秒**，不走 timeScale）——
           "后台照常走"：界面关闭也按表推进；动画播放中由 rec.anim 暂停。 */
        GAME.battle.tick(1);
        ui.updateProgress();"""
assert s3.count(old3) == 1, ('main-loop', s3.count(old3))
s3 = s3.replace(old3, new3, 1)

old4 = """      var st = GAME.loadGame();
      if (st) {
        GAME.map.generate();
        ui.enterGame();"""
new4 = """      var st = GAME.loadGame();
      if (st) {
        GAME.map.generate();
        /* v89.87：读档恢复挂起战斗（按 history 重放重建会话） */
        GAME.battle.restoreBattles();
        ui.enterGame();"""
assert s3.count(old4) == 1, ('main-boot', s3.count(old4))
s3 = s3.replace(old4, new4, 1)
io.open(P3, 'w', encoding='utf-8', newline='').write(s3)
print('OK main.js')

# ---------- 4) smoke-test.js：测试默认关观战 ----------
P4 = r'E:\Deepseekdb\smoke-test.js'
s4 = io.open(P4, encoding='utf-8', newline='').read()
old5 = "  if (global.GAME && global.GAME.SG && global.GAME.SG.TRIG) global.GAME.SG.TRIG.rng = function () { return 0.999; };"
new5 = """  if (global.GAME && global.GAME.SG && global.GAME.SG.TRIG) global.GAME.SG.TRIG.rng = function () { return 0.999; };
  /* v89.87（老板需求 4）：测试默认关闭战斗观战（战斗走即算/自动路径，
     保持既有用例语义）；观战挂起/重放路径由 §87 专项断言另测。 */
  if (global.GAME && global.GAME.DATA && global.GAME.DATA.DEFAULT_SETTINGS) {
    global.GAME.DATA.DEFAULT_SETTINGS.battleWatch = false;
  }"""
assert s4.count(old5) == 1, ('smoke', s4.count(old5))
io.open(P4, 'w', encoding='utf-8', newline='').write(s4.replace(old5, new5, 1))
print('OK smoke-test.js')

# ---------- 5) e2e-test.js：测试默认关观战 ----------
P5 = r'E:\Deepseekdb\e2e-test.js'
s5 = io.open(P5, encoding='utf-8', newline='').read()
old6 = """async function runTests(dom, URL) {
  const { window } = dom;
  const { document } = window;
  const G = window.GAME;
  const DATA = G && G.DATA;"""
new6 = """async function runTests(dom, URL) {
  const { window } = dom;
  const { document } = window;
  const G = window.GAME;
  const DATA = G && G.DATA;

  /* v89.87（老板需求 4）：测试默认关闭战斗观战（走即算路径，既有用例语义不变）；
     观战路径由 §87 专项断言显式开启后测。 */
  if (G.DATA && G.DATA.DEFAULT_SETTINGS) G.DATA.DEFAULT_SETTINGS.battleWatch = false;
  if (G.state && G.state.settings) G.state.settings.battleWatch = false;"""
assert s5.count(old6) == 1, ('e2e', s5.count(old6))
io.open(P5, 'w', encoding='utf-8', newline='').write(s5.replace(old6, new6, 1))
print('OK e2e-test.js')

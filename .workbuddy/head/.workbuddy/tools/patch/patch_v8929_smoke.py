# -*- coding: utf-8 -*-
"""v89.29 smoke 补丁：概率奇遇（引擎口径 / 接线 / 叠层 / ext）+ 测试期默认关随机"""
import io
import os
import sys

P = r'E:\Deepseekdb\smoke-test.js'


def read():
    return io.open(P, encoding='utf-8', newline='').read()


def write(src):
    tmp = P + '.tmp8929'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(src)
    os.replace(tmp, P)


src = read()
EDITS = []

# ---- 0. 测试期默认关闭随机触发（紧跟 require 块）----
EDITS.append((
    u"  require('./js/main.js');",
    u"""  require('./js/main.js');
  /* v89.29：逸闻奇遇 —— 测试期默认关闭随机触发（避免打断用例）；
     需要走触发链的用例自行用 GAME.SG.TRIG.pin / rng 精确控制。 */
  if (global.GAME && global.GAME.SG && global.GAME.SG.TRIG) global.GAME.SG.TRIG.rng = function () { return 0.999; };""",
    'guard'
))

# ---- 1. 入口区块旧断言 → 概率奇遇引擎矩阵 ----
EDITS.append((
    u"""  check('故事库：入口区块（有故事出文案 · 无故事返回空串）', (function () {
    var has = GAME.SG.anchor('building', 'guanfu').length > 0;
    var b1 = GAME.ui.SG_BLOCK('building', 'guanfu', '官府');
    /* v89.9：空态锚点动态选 —— 从 16 座建筑里找一座尚无故事的（全有则此项自动放行） */
    var POOL = ['guanfu', 'minfang', 'shuyuan', 'junying', 'xiaochang', 'shichang', 'cangku',
                'chengqiang', 'yizhan', 'fenghuotai', 'majiu', 'kezhan', 'zhaoxianguan',
                'honglusi', 'tiejiangpu', 'gongjiangzuofang'];
    var emptyId = null;
    for (var i = 0; i < POOL.length; i++) {
      if (GAME.SG.anchor('building', POOL[i]).length === 0) { emptyId = POOL[i]; break; }
    }
    var b2ok = emptyId ? (GAME.ui.SG_BLOCK('building', emptyId, '空') === '') : true;
    return has && b1.indexOf('听一段故事') >= 0 && b1.indexOf('story-list') >= 0 && b2ok;
  })());""",
    u"""  /* v89.29：逸闻奇遇（概率触发入口）—— 引擎口径：候选池 / 掷骰 / 冷却 / 空池 / 固定钩子 */
  check('故事库：概率奇遇引擎（候选池 · 掷骰 · 冷却 · 空池不触发）', (function () {
    var T = GAME.SG.TRIG;
    if (!T || typeof GAME.SG.roll !== 'function' || typeof GAME.SG.candidates !== 'function') return false;
    if (!(T.chance > 0 && T.chance < 1 && T.chanceDone > 0 && T.cooldownMs > 0)) return false;
    var keepRng = T.rng, keepPin = T.pin, keepAt = T._lastAt;
    var ok = true;
    var c = GAME.SG.candidates('building', 'guanfu');
    ok = ok && c.total >= 8 && c.fresh.length >= 1 && (c.fresh.length + c.done.length) === c.total;
    /* 空池永不触发（即使命中钩子开着也不触发） */
    T.pin = '__none-x__'; T._lastAt = 0;
    var e0 = GAME.SG.roll('building', '__none__');
    ok = ok && e0.fire === false && e0.why === 'empty';
    /* rng 恒 1 → 未命中 */
    T.pin = null; T._lastAt = 0; T.rng = function () { return 0.999; };
    var e1 = GAME.SG.roll('building', 'guanfu');
    ok = ok && e1.fire === false && e1.why === 'roll';
    /* rng 恒 0 → 命中 · 取池首（fresh 优先） */
    T._lastAt = 0; T.rng = function () { return 0; };
    var e2 = GAME.SG.roll('building', 'guanfu');
    ok = ok && e2.fire === true && e2.sid === c.fresh[0].st.id;
    /* 冷却：紧接再掷 → cool */
    var e3 = GAME.SG.roll('building', 'guanfu');
    ok = ok && e3.fire === false && e3.why === 'cool';
    /* pin：指定必中（冷却清零后）；pin 不在池中 → pin-miss */
    var pinSid = (c.fresh[1] || c.fresh[0]).st.id;
    T._lastAt = 0; T.pin = pinSid;
    var e4 = GAME.SG.roll('building', 'guanfu');
    ok = ok && e4.fire === true && e4.sid === pinSid;
    T._lastAt = 0; T.pin = '__miss__';
    var e5 = GAME.SG.roll('building', 'guanfu');
    ok = ok && e5.fire === false && e5.why === 'pin-miss';
    T.rng = keepRng; T.pin = keepPin; T._lastAt = keepAt;
    return ok;
  })());""",
    '引擎矩阵'
))

# ---- 2. 接线旧断言 → 新接线 ----
EDITS.append((
    u"""  check('故事库：接线（三处入口 · 四动作 · 奖赏走 STORY.applyReward）', (function () {
    var mS = '';
    try { mS = '' + require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8'); } catch (e) { mS = ''; }
    var okMain = mS.indexOf("case 'story-list'") >= 0 && mS.indexOf("case 'story-open'") >= 0
      && mS.indexOf("case 'story-pick'") >= 0 && mS.indexOf("case 'story-exit'") >= 0;
    var okEntry = GAME.ui.openBuildModal.toString().indexOf("ui.SG_BLOCK('building'") >= 0
      && GAME.ui.openLandModal.toString().indexOf("ui.SG_BLOCK('wild'") >= 0
      && GAME.ui.openCityPanel.toString().indexOf("ui.SG_BLOCK('city'") >= 0;
    var okSettle = GAME.SG.settle.toString().indexOf('applyReward') >= 0;
    return okMain && okEntry && okSettle;
  })());""",
    u"""  check('故事库：接线（v89.29 概率奇遇 · 入口挂点 · 奖赏仍走 STORY.applyReward）', (function () {
    var mS = '', uS = '';
    try { mS = '' + require('fs').readFileSync(require('path').join(__dirname, 'js', 'main.js'), 'utf8'); } catch (e) { mS = ''; }
    try { uS = '' + require('fs').readFileSync(require('path').join(__dirname, 'js', 'ui.js'), 'utf8'); } catch (e) { uS = ''; }
    var okMain = mS.indexOf("case 'story-pick'") >= 0 && mS.indexOf("case 'story-exit'") >= 0
      && mS.indexOf("case 'story-list'") < 0 && mS.indexOf("case 'story-open'") < 0;
    var okEntry = GAME.ui.openBuildModal.toString().indexOf("ui.sgTryTrigger('building', b.id)") >= 0
      && GAME.ui.openExtModal.toString().indexOf("ui.sgTryTrigger('ext', e.type)") >= 0
      && mS.indexOf("ui.sgTryTrigger('city', hit.city.type)") >= 0
      && mS.indexOf("ui.sgTryTrigger('wild', _t89a") >= 0;
    var okOld = uS.indexOf('SG_BLOCK') < 0 && uS.indexOf('openStoryList') < 0
      && uS.indexOf('story-list') < 0 && uS.indexOf('story-open') < 0;
    var okTry = typeof GAME.ui.sgTryTrigger === 'function'
      && ('' + GAME.ui.sgTryTrigger).indexOf('GAME.SG.roll') >= 0;
    var okSettle = GAME.SG.settle.toString().indexOf('applyReward') >= 0;
    return okMain && okEntry && okOld && okTry && okSettle;
  })());""",
    '接线'
))

# ---- 3. 脱三元旧断言 → 叠层语义 ----
EDITS.append((
    u"""  /* v89.9：建筑逸闻块脱三元 —— 无功能建筑（民房 / 驿站 / 烽火台 / 鸿胪寺）也能出入口 */
  check('故事库：建筑逸闻块脱三元（所有建筑统一渲染 · 无功能建筑有入口）', (function () {
    var src = '' + GAME.ui.openBuildModal;
    var ok1 = src.indexOf("ui.SG_BLOCK('building', b.id, b.name)") >= 0;
    var ok2 = src.indexOf("ui.SG_BLOCK('building', b.id, b.name) + '</div>'") < 0;
    var ok3 = GAME.ui.SG_BLOCK('building', 'minfang', '民房').indexOf('story-list') >= 0;
    return ok1 && ok2 && ok3;
  })());""",
    u"""  /* v89.29：叠层语义 —— openStory 支持保留弹窗；sgTryTrigger 命中即开卷（弹窗不关） */
  check('故事库：叠层语义（openStory(keepModal) · sgTryTrigger 命中即开卷）', (function () {
    var oS = '' + GAME.ui.openStory;
    var tS = '' + GAME.ui.sgTryTrigger;
    return oS.indexOf('keepModal') >= 0 && oS.indexOf('if (!keepModal) ui.closeModal()') >= 0
      && tS.indexOf('GAME.SG.roll(kind, id)') >= 0 && tS.indexOf('ui.openStory(r.sid, true)') >= 0;
  })());""",
    '叠层'
))

# ---- 4. ext 入口旧断言 → 改版断言 ----
EDITS.append((
    u"""  /* v89.27：城外建筑入口补齐（openExtModal 挂逸闻块 —— 此前 ext 无入口，写完读不到） */
  check('故事库：城外建筑入口（openExtModal 挂逸闻块 · 无故事返回空串）', (function () {
    var fn = GAME.ui.openExtModal.toString();
    if (fn.indexOf("ui.SG_BLOCK('ext'") < 0) return false;
    var has = GAME.ui.SG_BLOCK('ext', 'farm', '农田');
    var empty = GAME.ui.SG_BLOCK('ext', '__none__', '空');
    return has.indexOf('story-list') >= 0 && has.indexOf('data-kind="ext"') >= 0 && empty === '';
  })());""",
    u"""  /* v89.29：ext 入口改版 —— openExtModal 掷骰（旧入口块已收敛） */
  check('故事库：ext 入口（openExtModal 掷骰 · 无残留旧入口）', (function () {
    var fn = '' + GAME.ui.openExtModal;
    return fn.indexOf("ui.sgTryTrigger('ext', e.type)") >= 0
      && fn.indexOf('SG_BLOCK') < 0 && fn.indexOf('story-list') < 0;
  })());""",
    'ext'
))

for old, new, tag in EDITS:
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    src = src.replace(old, new, 1)

write(src)
back = read()
for _, new, tag in EDITS:
    assert new in back, tag
print('OK  smoke-test.js：guard + 4 块改写')

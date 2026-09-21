# -*- coding: utf-8 -*-
"""v89.86 · P-06 测试同步：触发语义从「命中即开卷」→「入待阅 · 从待阅开卷」
   涉及：smoke §故事库叠层断言；e2e v89.31 战事触发 / 81 块 A·D·F。
"""
import io
import os
import sys

SM = r'E:\Deepseekdb\smoke-test.js'
E2 = r'E:\Deepseekdb\e2e-test.js'


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


# ============ smoke：叠层 → 待阅 ============
edit(SM, r"""  /* v89.29：叠层语义 —— openStory 支持保留弹窗；sgTryTrigger 命中即开卷（弹窗不关） */
  check('故事库：叠层语义（openStory(keepModal) · sgTryTrigger 命中即开卷）', (function () {
    var oS = '' + GAME.ui.openStory;
    var tS = '' + GAME.ui.sgTryTrigger;
    return oS.indexOf('keepModal') >= 0 && oS.indexOf('if (!keepModal) ui.closeModal()') >= 0
      && tS.indexOf('GAME.SG.roll(kind, id)') >= 0 && tS.indexOf('ui.openStory(r.sid, true)') >= 0;
  })());""",
     r"""  /* v89.29 叠层语义 → v89.86（P-06）待阅语义：触发只入待阅（不再直接开卷），
     阅读统一走 openStory（同一阅读器）；两个触发口都必须经过 sgDefer。 */
  check('故事库：待阅语义（触发入待阅 · openStory 仍是唯一阅读器）', (function () {
    var oS = '' + GAME.ui.openStory;
    var tS = '' + GAME.ui.sgTryTrigger;
    var tA = '' + GAME.ui.sgTryAct;
    return oS.indexOf('keepModal') >= 0 && oS.indexOf('if (!keepModal) ui.closeModal()') >= 0
      && tS.indexOf('GAME.SG.roll(kind, id)') >= 0 && tS.indexOf('ui.sgDefer(r.sid)') >= 0
      && tA.indexOf('ui.sgDefer(r.sid)') >= 0
      && tS.indexOf('ui.openStory(') < 0 && tA.indexOf('ui.openStory(') < 0
      && typeof GAME.ui.sgReadPending === 'function' && typeof GAME.SG.defer === 'function';
  })());""",
     'smoke · 待阅语义断言')

# ============ e2e · v89.31 战事触发 ============
edit(E2, r"""        /* v89.31：战事触发链（抵达结算 → 相关建筑池开卷 → 掩卷） */
        const fx31 = document.querySelector('#story-fx');
        check('★ v89.31：战事触发 · 抵达后开卷（相关建筑池 · ' + _pin31 + '）',
          !!fx31 && fx31.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31 && fx31.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.31：战事触发 · 掩卷收起', !!fx31 && fx31.style.display === 'none');
        G.SG.TRIG.pin = null; G.SG.TRIG._actAt = {};""",
     r"""        /* v89.31 战事触发链 → v89.86（P-06）待阅语义：
           抵达结算命中 → 入待阅（不再全屏打断）→ 从待阅开卷 → 掩卷出列 */
        const fx31 = document.querySelector('#story-fx');
        const pend31 = (G.SG.pending() || []).some((x) => x.sid === _pin31);
        check('★ v89.86（P-06）：战事触发 · 入待阅（相关建筑池 · ' + _pin31 + '）',
          pend31 && (!fx31 || fx31.style.display === 'none'));
        G.ui.sgReadPending(_pin31);
        await sleep(40);
        check('★ v89.86（P-06）：从待阅开卷（同一阅读器 · ' + _pin31 + '）',
          !!fx31 && fx31.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);
        const ex31 = fx31 && fx31.querySelector('[data-action="story-exit"]');
        if (ex31) { click(ex31); await sleep(30); }
        check('★ v89.86（P-06）：掩卷收起 · 待阅已出列', !!fx31 && fx31.style.display === 'none'
          && !(G.SG.pending() || []).some((x) => x.sid === _pin31));
        G.SG.TRIG.pin = null; G.SG.TRIG._actAt = {};""",
     'e2e · v89.31 战事触发改待阅')

# ============ e2e · 81 块 A ============
edit(E2, r"""    check('★ v89.29：概率奇遇触发（点建筑 → 命中《衙前夜审》直接开卷）', !!fx
      && fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'bld-guanfu-01');
    check('★ v89.29：叠层语义（命中的逸闻悬于面板之上 · 面板未关）',
      !!document.querySelector('#modal-root [data-action="close-modal"]'));
    var bgLayers = fx ? fx.querySelectorAll('.sgr-bg') : [];
    check('★ 全屏阅读器打开（第 1 段 · 共 6 段 · 壁画两层就位 · 选项≥2）', !!fx
      && bgLayers.length === 2
      && fx.textContent.indexOf('第 1 段') >= 0 && fx.textContent.indexOf('共 6 段') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);""",
     r"""    /* v89.86（P-06）：触发 → **入待阅**（不打断；面板未关；徽标 +1）；从待阅开卷 */
    check('★ v89.86（P-06）：概率奇遇触发 → 入待阅《衙前夜审》（不打断 · 面板未关）',
      (G.SG.pending() || []).some(function (x) { return x.sid === 'bld-guanfu-01'; })
      && fx.style.display === 'none'
      && !!document.querySelector('#modal-root [data-action="close-modal"]'));
    check('★ v89.86（P-06）：顶栏「史册」徽标 = 待阅数',
      (function () {
        var b = document.getElementById('tab-badge-story');
        return !!b && b.classList.contains('hidden') === false && Number(b.textContent) >= 1;
      })());
    G.ui.sgReadPending('bld-guanfu-01');
    await sleep(40);
    var bgLayers = fx ? fx.querySelectorAll('.sgr-bg') : [];
    check('★ v89.86（P-06）：从待阅开卷（阅读器 · 第 1 段 · 共 6 段 · 壁画两层 · 选项≥2）', !!fx
      && fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'bld-guanfu-01'
      && bgLayers.length === 2
      && fx.textContent.indexOf('第 1 段') >= 0 && fx.textContent.indexOf('共 6 段') >= 0
      && fx.querySelectorAll('[data-action="story-pick"]').length >= 2
      && fx.textContent.length > 200);""",
     'e2e · 81 块 A 改待阅')

# ============ e2e · 81 块 D ============
edit(E2, r"""      G.ui.sgTryTrigger('wild', wTile.terrain);
      await sleep(40);
      check('★ v89.29：地块触发（点地块 → 命中 ' + wPick9 + ' 直接开卷）',
        fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === wPick9);
      var exW = fx.querySelector('[data-action="story-exit"]');
      if (exW) { click(exW); await sleep(30); }
      check('★ v89.29：掩卷后回面板（叠层语义）', fx.style.display === 'none'
        && !!document.querySelector('#modal-root [data-action="close-modal"]'));""",
     r"""      G.ui.sgTryTrigger('wild', wTile.terrain);
      await sleep(40);
      check('★ v89.86（P-06）：地块触发 → 入待阅（' + wPick9 + ' · 不打断）',
        (G.SG.pending() || []).some(function (x) { return x.sid === wPick9; })
        && fx.style.display === 'none'
        && !!document.querySelector('#modal-root [data-action="close-modal"]'));
      G.ui.sgReadPending(wPick9);
      await sleep(40);
      check('★ v89.86（P-06）：从待阅开卷（' + wPick9 + '）',
        fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === wPick9);
      var exW = fx.querySelector('[data-action="story-exit"]');
      if (exW) { click(exW); await sleep(30); }
      check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');""",
     'e2e · 81 块 D 改待阅')

# ============ e2e · 81 块 F（动作触发 ×2） ============
edit(E2, r"""    sgPin89(pinF1); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.31：动作触发 · 研习完成 → 相关建筑池开卷（' + pinF1 + '）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === pinF1);
    var exF1 = fx.querySelector('[data-action="story-exit"]');
    if (exF1) { click(exF1); await sleep(30); }
    check('★ v89.31：动作触发 · 掩卷收起', fx.style.display === 'none');""",
     r"""    sgPin89(pinF1); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.86（P-06）：动作触发 · 研习完成 → 入待阅（' + pinF1 + '）',
      (G.SG.pending() || []).some(function (x) { return x.sid === pinF1; })
      && fx.style.display === 'none');
    G.ui.sgReadPending(pinF1);
    await sleep(40);
    check('★ v89.86（P-06）：从待阅开卷（' + pinF1 + '）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === pinF1);
    var exF1 = fx.querySelector('[data-action="story-exit"]');
    if (exF1) { click(exF1); await sleep(30); }
    check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');""",
     'e2e · 81 块 F-1 改待阅')

edit(E2, r"""    sgPin89('misc-06'); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.39：动作偶遇世事 · 研习完成 → 开卷（misc-06）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'misc-06');
    var exM39 = fx.querySelector('[data-action="story-exit"]');
    if (exM39) { click(exM39); await sleep(30); }
    check('★ v89.39：掩卷收起', fx.style.display === 'none');""",
     r"""    sgPin89('misc-06'); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.86（P-06）：动作偶遇世事 → 入待阅（misc-06）',
      (G.SG.pending() || []).some(function (x) { return x.sid === 'misc-06'; })
      && fx.style.display === 'none');
    G.ui.sgReadPending('misc-06');
    await sleep(40);
    check('★ v89.86（P-06）：从待阅开卷（misc-06）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'misc-06');
    var exM39 = fx.querySelector('[data-action="story-exit"]');
    if (exM39) { click(exM39); await sleep(30); }
    check('★ v89.86（P-06）：掩卷收起', fx.style.display === 'none');""",
     'e2e · 81 块 F-2 改待阅')

print('DONE')

# -*- coding: utf-8 -*-
"""v89 全屏场景 UI（ui.js）：活动按钮 → 全屏剧本 → 专属退出结算屏。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\ui.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = r"""  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var r = GAME.jianghuDo(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    ui._jhResult = { xy: x + ',' + y, name: r.name, text: r.text, bad: r.bad };
    ui.toast('☯ ' + r.name + (r.text ? '（' + r.text + '）' : ''));
    GAME.refreshAll();
    ui.openLandModal(x, y);       /* 原地重开：显示结果与「今日已做」态 */
  };"""

NEW = r"""  /* v89（老板）：「为每项活动做专属全屏交互界面 + 特定退出」——
     活动按钮 → 全屏剧本（对话 / 事件 2~3 幕）→ 专属退出结算屏。
     全屏层 #scene-fx 挂在 body 上（z=1500：高于弹窗 1000、低于 toast 2000），
     不占 modal-root —— 弹窗是单根替换系统，两者互不干扰。 */
  ui._sceneFx = null;
  ui.doJianghu = function (x, y, actId) {
    var gsel = document.getElementById('jh-gen');
    var gid = gsel ? gsel.value : ui._jhGen;
    if (gid) ui._jhGen = gid;
    var lg = GAME.lordGeneralOf();       /* v89：君主专属（闸门在 jianghuCheck，这里便于兜底） */
    if (lg && (!gid || gid !== lg.id)) gid = lg.id;
    if (!(DATA.SCENE_FLOW || {})[actId]) {
      /* 无剧本兜底（未来新增活动）：直接一次性结算 —— one-shot 出口保留 */
      var r0 = GAME.jianghuDo(x, y, gid, actId);
      if (!r0.ok) { ui.toast(r0.msg); return; }
      ui._jhResult = { xy: x + ',' + y, name: r0.name, text: r0.text, bad: r0.bad };
      ui.toast('☯ ' + r0.name + (r0.text ? '（' + r0.text + '）' : ''));
      GAME.refreshAll();
      ui.openLandModal(x, y);
      return;
    }
    var r = GAME.sceneStart(x, y, gid, actId);
    if (!r.ok) { ui.toast(r.msg); return; }
    if (!r.fx) { ui.toast('剧本缺失'); return; }
    ui.openSceneFx(r.fx);
  };
  ui.openSceneFx = function (fx) { ui._sceneFx = fx; ui.renderSceneFx(); };
  ui.renderSceneFx = function () {
    var fx = ui._sceneFx;
    if (!fx) return;
    var el = document.getElementById('scene-fx');
    if (!el) {
      el = document.createElement('div');
      el.id = 'scene-fx';
      el.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1500;overflow:auto;'
        + 'background:linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-2) 55%,var(--bg-3) 100%);color:var(--text);';
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = ui.sceneFxHTML(fx);
    el.scrollTop = 0;
  };
  ui.sceneFxHTML = function (fx) {
    var a = fx.chk.act;
    var fly = fx.fly;
    var tile = GAME.map.tile(fx.chk.x, fx.chk.y) || {};
    var ter = (DATA.TERRAIN[tile.terrain] || {}).name || '';
    var total = fly.stages.length;
    var h = '<div style="max-width:860px;margin:0 auto;padding:26px 22px 72px;">';
    /* 顶栏：活动名 · 地点 · 君主 · 进度 · 退出 */
    h += '<div style="display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line-strong);padding-bottom:12px;flex-wrap:wrap;">';
    h += '<span style="font-size:26px;">' + a.icon + '</span>';
    h += '<span style="font-size:var(--fs-h1);font-weight:800;color:var(--gold-light);">' + U.escape(a.name) + '</span>';
    h += '<span style="color:var(--text-dim);font-size:var(--fs-sub);">' + U.escape(ter) + '（' + fx.chk.x + ',' + fx.chk.y + '）· 野地 Lv' + fx.chk.lv + '　君主 ' + U.escape(fx.chk.gen.name) + ' · 灵力 ' + GAME.lingPowerOf(fx.chk.gen) + '</span>';
    if (fx.phase === 'stage') {
      var dots = '';
      for (var i = 0; i < total; i++) dots += '<span style="color:' + (i <= fx.stage ? 'var(--gold)' : 'var(--text-dim)') + ';">' + (i <= fx.stage ? '◆' : '◇') + '</span>';
      h += '<span style="margin-left:auto;display:inline-flex;gap:10px;align-items:center;">';
      h += '<span style="font-size:var(--fs-cap);letter-spacing:3px;">' + dots + '</span>';
      h += '<button class="btn sm" data-action="sxf-escape">' + U.escape(fly.escLabel || '就此离去') + '</button>';
      h += '</span>';
    }
    h += '</div>';
    /* 已走过的选择（一行日志） */
    if (fx.picks.length) {
      h += '<div style="margin:12px 0;color:var(--text-dim);font-size:var(--fs-sub);">'
        + fx.picks.map(function (p, i2) { return '第' + (i2 + 1) + '幕 · ' + U.escape(p.l); }).join('　›　') + '</div>';
    }
    if (fx.phase === 'stage') {
      /* 当前幕：叙事卡 + 选择按钮 */
      var st = fly.stages[fx.stage];
      h += '<div style="background:var(--panel-bg);border:1px solid var(--sep-gold);border-radius:10px;padding:20px 22px;margin:14px 0 4px;">' +
        '<div style="font-size:var(--fs-lead);line-height:1.95;color:var(--text);">' + U.escape(st.t) + '</div></div>';
      h += st.o.map(function (op, i3) {
        return '<button class="btn" data-action="sxf-choice" data-i="' + i3 + '" style="display:block;width:100%;text-align:left;margin:8px 0;padding:12px 14px;font-size:var(--fs-lead);">' +
          '<b style="color:var(--gold-light);">' + U.escape(op.l) + '</b>' +
          (op.d ? '<span style="color:var(--text-dim);font-weight:400;margin-left:10px;font-size:var(--fs-sub);">' + U.escape(op.d) + '</span>' : '') +
          '</button>';
      }).join('');
      h += '<div style="margin-top:12px;color:var(--text-dim);font-size:var(--fs-cap);">' +
        (fx.spent ? '已动身 —— 中途罢手，所耗精力体力不返；此地此事今日即算已过。'
                  : '尚未动身 —— 此时离去，无任何消耗。') + '</div>';
    } else {
      /* 专属退出结算屏 */
      var ex = fly.exits[fx.grade] || fly.exits.win || fly.exits.escape;
      var res = fx.result || {};
      h += '<div style="text-align:center;margin:22px 0 4px;"><div style="font-size:44px;">' + ex.ic + '</div>';
      h += '<div style="font-size:var(--fs-h1);font-weight:800;color:var(--gold);margin-top:8px;">' + U.escape(ex.t) + '</div>';
      h += '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:6px;">' + U.escape(ex.s || '') + '</div></div>';
      h += '<div style="background:var(--panel-bg);border:1px solid var(--sep-gold);border-radius:10px;padding:16px 18px;margin:16px 0;">';
      if (res.escaped) {
        h += '<div style="font-size:var(--fs-body);line-height:1.9;color:var(--text);">'
          + (fx.spent ? '你审时度势，中途罢手。' : '你尚未动身，转身离去。')
          + '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">'
          + (fx.spent ? '所耗精力体力不返；此地此事今日已计入。' : '未有任何消耗。')
          + '</div></div>';
      } else if (res.ok) {
        h += '<div style="font-size:var(--fs-body);color:var(--text-dim);margin-bottom:8px;">' + U.escape(res.name || '') + '</div>';
        h += res.text
          ? res.text.split('、').map(function (t2) {
              return '<div style="font-size:var(--fs-lead);line-height:2;color:' + (res.bad ? 'var(--red-light)' : 'var(--green-ok)') + ';">· ' + U.escape(t2) + '</div>';
            }).join('')
          : '';
      }
      h += '</div>';
      h += '<div style="text-align:center;margin-top:18px;"><button class="btn gold lg" data-action="sxf-exit">' + U.escape(fly.backLabel || '打道回府') + '</button></div>';
    }
    h += '</div>';
    return h;
  };
  ui.closeSceneFx = function () {
    var fx = ui._sceneFx;
    ui._sceneFx = null;
    GAME.sceneFx = null;
    var el = document.getElementById('scene-fx');
    if (el) el.style.display = 'none';
    if (!fx || !fx.chk) return;
    if (fx.result && fx.result.escaped && !fx.spent) return;   /* 未动身退出：状态无变化，原地不动 */
    if (fx.result) {
      ui._jhResult = {
        xy: fx.chk.x + ',' + fx.chk.y,
        name: fx.result.escaped ? '中途罢手' : fx.result.name,
        text: fx.result.escaped ? '所耗不返，今日已计入' : fx.result.text,
        bad: fx.result.escaped ? true : fx.result.bad
      };
    }
    GAME.refreshAll();
    ui.openLandModal(fx.chk.x, fx.chk.y);   /* 原地回野地弹窗（显示结果与「今日已做」） */
  };"""

if 'ui.openSceneFx = function' in d:
    print('SKIP 全屏场景 UI 已存在')
else:
    c = d.count(OLD)
    assert c == 1, 'doJianghu 锚点命中 %d 次' % c
    d = d.replace(OLD, NEW, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK 全屏场景 UI 已写入')

# 幂等复查
d2 = io.open(P, encoding='utf-8', newline='').read()
print('scene 函数数:', sum([d2.count('ui.openSceneFx = function'), d2.count('ui.renderSceneFx = function'),
    d2.count('ui.sceneFxHTML = function'), d2.count('ui.closeSceneFx = function')]), '(期望 4)')
print('sxf 动作数:', d2.count('sxf-choice') + d2.count('sxf-escape') + d2.count('sxf-exit'), '（含 data-action 与说明）')

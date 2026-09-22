# -*- coding: utf-8 -*-
"""v89.94 Patch E —— js/main.js：战法 chip / 撤退 / 回放控制 三个动作 + 确认闸改保守口径。
另 Patch F 一并处理 index.html 的 CSS。"""
import io

# ============ main.js ============
P = 'js/main.js'
src = io.open(P, encoding='utf-8').read()
orig = src
n_ok = 0


def rep(old, new, tag, limit=1):
    global src, n_ok
    if new in src:
        print('SKIP(已打): ' + tag)
        return
    assert old in src, 'ANCHOR MISSING [' + tag + ']'
    src = src.replace(old, new, limit)
    n_ok += 1
    print('OK: ' + tag)


# ① 三个动作：exp-ops / bt-retreat / rep-*
rep(
"""      case 'exp-confirm': GAME.doExpConfirm(); break;""",
"""      case 'exp-confirm': GAME.doExpConfirm(); break;
      /* v89.94（B2 · E2）：战法三选（强攻/围困/奇袭）—— 唯一出口 ui.setExpOps */
      case 'exp-ops': ui.setExpOps(el.dataset.v); break;
      /* v89.94（B2 · E3）：战报回放控制（逐帧 / 播放 / 关键帧跳转） */
      case 'rep-prev': ui.replayStep(-1); break;
      case 'rep-next': ui.replayStep(1); break;
      case 'rep-play': ui.replayToggle(); break;
      case 'rep-jump': ui.replayJump(Number(el.dataset.v)); break;""",
'exp-ops/rep-* 动作')

rep(
"""      case 'bt-auto': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) GAME.battle.autoBattle(rec.id);   /* 结束由 ui.onBattleDone 收口 */
      })(); break;""",
"""      case 'bt-done': if (ui._bt) GAME.battle.stepBattle(ui._bt.id); break;
      /* v89.94（B2 · E1）：主动撤退 —— 两段确认（第一下"上膛"、第二下真撤） */
      case 'bt-retreat': {
        var _bid94 = ui._bt && ui._bt.id;
        if (!_bid94 || !GAME.battle._recOf(_bid94)) { ui.toast('战斗已结束（战报见公文）'); break; }
        if (!ui._btRetreatArmed) {
          ui._btRetreatArmed = true;
          el.className = 'btn red';
          el.innerHTML = '🏳️ 再点一次确认撤退';
          ui.toast('⚠️ 撤退：带残部撤出 —— 本波破防按半计（围攻进度保留）');
          var _el94 = el;
          setTimeout(function () {
            ui._btRetreatArmed = false;
            if (_el94 && _el94.textContent && _el94.textContent.indexOf('再点一次') >= 0) {
              _el94.className = 'btn';
              _el94.innerHTML = '🏳️ 撤退';
            }
          }, 4000);
          break;
        }
        ui._btRetreatArmed = false;
        var _rr94 = GAME.battle.retreatBattle(_bid94);
        if (_rr94 && _rr94.ok === false) ui.toast('撤退未果：' + (_rr94.msg || '战斗已结束'));
        break;
      }
      case 'bt-auto': (function () {
        var rec = ui._bt && GAME.battle._recOf(ui._bt.id);
        if (rec) GAME.battle.autoBattle(rec.id);   /* 结束由 ui.onBattleDone 收口 */
      })(); break;""",
'bt-retreat 动作')

# ② 确认闸：改按**最坏情形**拦（军师估算下界），文案带误差
rep(
"""    var _pw86 = (md.battle && !_peaceful86 && ui.expPowerOf) ? ui.expPowerOf() : null;
    if (_pw86 && _pw86.def > 0 && _pw86.mine > 0 && _pw86.ratio < 0.5 && !ui._expForceArmed) {
      ui._expForceArmed = true;
      var _ratioTxt86 = (Math.round(_pw86.ratio * 100) / 100) + ' : 1';
      var _btn86 = document.querySelector('#modal-root [data-action="exp-confirm"]');
      if (_btn86) {
        _btn86.className = 'btn red';
        _btn86.innerHTML = '⚠️ 兵力悬殊（' + _ratioTxt86 + '）—— 再点一次才发兵';
      }
      ui.toast('⚠️ 兵力悬殊（' + _ratioTxt86 + '）：此战恐全军覆没，再点一次才发兵');
      return;
    }""",
"""    /* v89.94（B2 · E2）：闸门改按**最坏情形**拦（区间下界 ratioLo）——
       情报越差区间越宽，警告就越容易触发：这是"不确定性"该有的代价。
       文案同时给点估计与误差，玩家知道自己在赌什么。 */
    var _pw86 = (md.battle && !_peaceful86 && ui.expPowerOf) ? ui.expPowerOf() : null;
    var _gateLo86 = (_pw86 && _pw86.ratioLo != null) ? _pw86.ratioLo : (_pw86 ? _pw86.ratio : null);
    if (_pw86 && _pw86.def > 0 && _pw86.mine > 0 && _gateLo86 != null && _gateLo86 < 0.5 && !ui._expForceArmed) {
      ui._expForceArmed = true;
      var _ratioTxt86 = '最坏 ' + (Math.round(_gateLo86 * 100) / 100) + ' : 1'
        + '（军师估算 ' + (Math.round(_pw86.ratio * 100) / 100) + ' ±' + Math.round(_pw86.err * 100) + '%）';
      var _btn86 = document.querySelector('#modal-root [data-action="exp-confirm"]');
      if (_btn86) {
        _btn86.className = 'btn red';
        _btn86.innerHTML = '⚠️ 兵力悬殊（' + _ratioTxt86 + '）—— 再点一次才发兵';
      }
      ui.toast('⚠️ 兵力悬殊（' + _ratioTxt86 + '）：此战恐全军覆没，再点一次才发兵');
      return;
    }""",
'确认闸保守口径')

# ③ 发兵：带战法 + 校验 + 发兵后复位
rep(
"""    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null);
    ui.toast(r.msg);
    if (r.ok) {
      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */""",
"""    /* v89.94（B2 · E2）：战法校验（与 prepare/dispatch 同一判据）——
       奇袭没计略 / 围困打野地 → 拦在这里并说明原因，不静默降级。 */
    var _ops94 = GAME.opsIdOf(ui._expOps);
    var _opsIssue94 = GAME.opsConfigIssueOf(_ops94, ui._expRes, ui._expScheme || null);
    if (_opsIssue94) { ui.toast('⚠️ ' + _opsIssue94); return; }
    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null, _ops94);
    ui.toast(r.msg);
    if (r.ok) {
      ui._expScheme = null;      /* v86：计已随军出发，面板状态清空 */
      ui._expOps = 'assault';    /* v89.94：战法回到默认（防下次误带围困上野地） */""",
'发兵带战法')

# ============ index.html ============
P2 = 'index.html'
h = io.open(P2, encoding='utf-8').read()
h0 = h

ANCHOR = """  .bt-gap { color: var(--text-dim); font-size: var(--fs-cap); padding-left: 28px; }"""
CSS = """  .bt-gap { color: var(--text-dim); font-size: var(--fs-cap); padding-left: 28px; }
  /* ============================================================
   * v89.94（B2 · E3/E1）：战报分回合回放 + 围攻/以少胜多标记 + 战法三选
   * ------------------------------------------------------------
   * 帧内容复用上面 .bt-row 的一套（条带/兵力/间距），避免第二套战场样式。
   * ============================================================ */
  .rp-box { background: rgba(var(--sh-rgb),.34); border: 1px solid var(--line-strong);
    border-radius: 7px; padding: 8px 10px; margin: 4px 0 2px; overflow-x: auto; }
  .rp-ev { color: var(--text-dim); font-size: var(--fs-cap); line-height: 1.7;
    padding: 2px 0 6px 28px; border-bottom: 1px dotted rgba(201,162,75,.12); }
  .rp-ctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 6px 0 4px; }
  .rp-range { flex: 1; min-width: 120px; accent-color: var(--gold-dark); }
  .rp-pos { flex: none; color: var(--text-dim); font-size: var(--fs-cap);
    font-variant-numeric: tabular-nums; }
  .rp-keys { display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
    color: var(--text-dim); font-size: var(--fs-cap); margin-bottom: 4px; }
  .rp-key { cursor: pointer; }
  .rp-under { color: var(--gold-light); font-size: var(--fs-sub); text-align: center;
    padding: 4px 0 2px; }
  .exp-ops-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0 0; }
  .exp-ops-lab { flex: none; color: var(--gold-light); font-size: var(--fs-sub); }
  .exp-ops-row .ch.off { opacity: .38; cursor: not-allowed; }"""

if '.rp-box {' in h:
    print('SKIP(已打): index.html CSS')
elif ANCHOR in h:
    h = h.replace(ANCHOR, CSS, 1)
    io.open(P2, 'w', encoding='utf-8', newline='').write(h)
    print('PATCHED index.html CSS  (+%d bytes)' % (len(h.encode('utf-8')) - len(h0.encode('utf-8'))))
else:
    raise SystemExit('ANCHOR MISSING in index.html')

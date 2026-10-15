# -*- coding: utf-8 -*-
"""v89.138 补丁 D：提速面板（老板 3）+ 建筑「功能」标题（老板 4）+ 采集召回统一（老板 0）
  ui：① 删「已用宝物」拼音行 ② queueDone138 helper ③ 三处 op-zone「功能」标题删
      ④ 采集队/采集区「召回」改 wild-withdraw（撤回驻军）⑤ openGatherAbandonAsk 退役
  main：⑥ wild-withdraw 两段确认 ⑦ doBoostTrain/doTrainRush 完成后自动关窗 ⑧ gather-abandon-* 退役
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

def patch_file(path, repl, tag):
    s = io.open(path, 'r', encoding='utf-8', newline='').read()
    for old, new, sub in repl:
        if s.count(old) != 1:
            print('❌ [%s/%s] 锚点命中 %d 次' % (tag, sub, s.count(old))); sys.exit(1)
        s = s.replace(old, new)
    assert '\r\n' not in s, '行尾混入 CRLF'
    tmp = path + '.tmp138'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, path)
    ok.append(tag)
    print('  ✓ ' + tag)

U = os.path.join(ROOT, 'js', 'ui.js')
M = os.path.join(ROOT, 'js', 'main.js')

# ══════════ ① 提速面板：删「已用宝物」行 ══════════
patch_file(U, [(
"""      (run.boost && Object.keys(run.boost).length
        ? '<div class="attr"><span class="k">已用宝物</span><span class="v">' +
          Object.keys(run.boost).join('、') + '</span></div>' : '') +""",
"""      /* ⛔ v89.138（老板 3）：「已用宝物 hanxin_dianbing，这行不要，而且为啥是拼音」——
         该行显示的是**内部 id**（拼音），既是信息噪声又不像中文界面。
         宝物"用过没"已由宝物行自身的「已用过」禁用态表达（不需要第二处）。 */""",
'删已用宝物行')], '提速面板')

# ══════════ ② queueDone138 helper（提速后自动关窗的判据） ══════════
patch_file(U, [(
"""  /* ============================================================
   * 募兵提速（v28 起 · v89.49 改双路）""",
"""  /* ============================================================
   * v89.138（老板 3）：「如果提速后完成了募兵，剩余时长为 0，则应**自动关闭**提速小弹窗」——
   * 判据：该营（或作坊）的"正在执行"队列已无剩余（`trainRushRemain ≤ 0`）
   *   或干脆已没有在办队列。完成 → 关窗；没完成 → 留在面板里（剩余变短看得见）。
   * ============================================================ */
  ui.queueDone138 = function (bIdx) {
    var c = GAME.currentCity();
    if (!c) return true;
    var kinds = ['train', 'craft'];
    for (var i = 0; i < kinds.length; i++) {
      var run = GAME.trainRunningOf(c.id, bIdx, kinds[i]);
      if (run && GAME.trainRushRemain(run) > 0) return false;
    }
    return true;
  };

  /* ============================================================
   * 募兵提速（v28 起 · v89.49 改双路）""",
'queueDone138')], 'queueDone138')

# ══════════ ③ 三处 op-zone「功能」标题删除 ══════════
patch_file(U, [(
"""            '<div class="op-zone-t">功能（升级中照常可用）</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + fn.act + '"'""",
"""            /* v89.138（老板 4）：「建筑界面的"功能"两个字去掉，直接体现即可功能按钮」——
             标题行撤除，按钮直接呈现（施工中照常可用这层含义由上方"不影响下方操作"说明承担）。 */
            '<div class="op-row"><button class="btn gold" data-action="' + fn.act + '"'""",
'施工中功能标题')], '功能标题-施工中')

patch_file(U, [(
"""            '<div class="op-zone-t">功能</div>' +""",
"""            /* ⛔ v89.138（老板 4）：标题行撤除（同上） */""",
'城内功能标题')], '功能标题-城内')

patch_file(U, [(
"""          '<div class="op-zone-t">功能</div>' +""",
"""          /* ⛔ v89.138（老板 4）：标题行撤除（同上） */""",
'城外功能标题')], '功能标题-城外')

# ══════════ ④ 采集队段（军务）「召回」改 wild-withdraw ══════════
patch_file(U, [(
"""        '<td class="ctr"><button class="btn sm gold" data-action="gather-finish" data-id="' + g.id + '">收获</button> ' +
          '<button class="btn sm red" data-action="gather-abandon-ask" data-id="' + g.id + '">召回</button></td>' +""",
"""        '<td class="ctr"><button class="btn sm gold" data-action="gather-finish" data-id="' + g.id + '">收获</button> ' +
          /* v89.138（老板 0）：「召回不是从采集变成驻军，而是**采集中的军队回到城市**」——
             采集与驻军已合并（兵在驻军 · 原地开工），于是「召回」= **撤回驻军**（同一动作同一语义）：
             停采（满 1 小时先自动收获）+ 兵与将回城。 */
          '<button class="btn sm red" data-action="wild-withdraw" data-x="' + g.x + '" data-y="' + g.y +
            '" title="召回：停止开采，兵与将回城（满 1 小时先自动收获）">召回</button></td>' +""",
'军务采集队召回')], '军务采集队召回')

# ══════════ ⑤ 地块采集区「召回」改 wild-withdraw ══════════
patch_file(U, [(
"""            '<button class="btn" data-action="gather-abandon-ask" data-id="' + at.id + '">🏳️ 召回</button>' +""",
"""            /* v89.138（老板 0）：召回 = 撤回驻军（采集中的军队回城）—— 与军务/附属野地同一动作 */
            '<button class="btn" data-action="wild-withdraw" data-x="' + x + '" data-y="' + y +
              '" title="召回：停止开采，兵与将回城（满 1 小时先自动收获）">🏳️ 召回</button>' +""",
'地块采集区召回')], '地块采集区召回')

# ══════════ ⑥ openGatherAbandonAsk 退役 ══════════
s = io.open(U, 'r', encoding='utf-8', newline='').read()
i0 = s.find('  ui.openGatherAbandonAsk = function (id) {')
if i0 < 0:
    print('❌ 找不到 openGatherAbandonAsk'); sys.exit(1)
k0 = s.find('{', i0)
depth, m = 0, k0
while m < len(s):
    if s[m] == '{':
        depth += 1
    elif s[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e0 = s.find(';', m)
assert e0 > 0 and (e0 - m) < 4, '尾异常'
print('  ✓ openGatherAbandonAsk 退役（%d 字节）' % (e0 + 1 - i0))
tomb = """  /* ============================================================
   * ⛔ v89.138（老板 0）：`ui.openGatherAbandonAsk`（撤回采集队确认面板）整条退役 ——
   * 老板：「召回不是从采集变成驻军，而是**采集中的军队回到城市**」。
   * 采集与驻军在 v89.136 已合并（兵在驻军 · 原地开工），"撤回采集队"与"撤回驻军"
   * 本就是同一件事 —— 全站「召回」统一走 `wild-withdraw`（撤回驻军 = 停采 + 兵将回城），
   * 并带**两段确认**（上膛式，见 main.js）。
   * 域侧 `GAME.abandonGather`（单纯停采）**保留**：`doWildWithdraw` 内部照旧调用它
   * （满 1 小时先自动收获，不足 1 小时直接停）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`。 */"""
s = s[:i0] + tomb + s[e0 + 1:]
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = U + '.tmp138'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, U)
ok.append('openGatherAbandonAsk 退役')

# ══════════ ⑦ main.js：提速完成后自动关窗 ══════════
patch_file(M, [(
"""  GAME.doBoostTrain = function (itemId, bIdx) {
    var c = GAME.currentCity();
    var r = GAME.systems.boostTrainQueue(itemId, c.id, bIdx);
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      /* 加速后留在弹窗里刷新 —— 让"剩余时间变短了"直接看得见，
         而不是关掉弹窗再自己去找（本项目吃过"点了没反应"的亏）。 */
      ui.openTrainBoost(bIdx);
    }
  };""",
"""  GAME.doBoostTrain = function (itemId, bIdx) {
    var c = GAME.currentCity();
    var r = GAME.systems.boostTrainQueue(itemId, c.id, bIdx);
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      /* 加速后留在弹窗里刷新 —— 让"剩余时间变短了"直接看得见（v89.49 的诉求）。
         v89.138（老板 3）：「如果提速后完成了募兵，剩余时长为 0，则应**自动关闭**提速小弹窗」——
         完成 → 关窗；没完成 → 照旧留窗。 */
      if (ui.queueDone138(bIdx)) ui.closeModal(); else ui.openTrainBoost(bIdx);
    }
  };""",
'doBoostTrain 自动关窗')], '提速关窗-宝物')

patch_file(M, [(
"""  GAME.doTrainRush = function (pct, bIdx, kind) {
    var c = GAME.currentCity();
    var r = GAME.trainRush(c.id, bIdx, pct, kind || 'train');
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      ui.openTrainBoost(bIdx);     /* 同样留在面板里，让"剩余变短"看得见 */
    }
  };""",
"""  GAME.doTrainRush = function (pct, bIdx, kind) {
    var c = GAME.currentCity();
    var r = GAME.trainRush(c.id, bIdx, pct, kind || 'train');
    ui.toast(r.msg);
    if (r.ok) {
      GAME.refreshAll();
      /* v89.138（老板 3）：完成即关窗；未完成留在面板里（同 doBoostTrain） */
      if (ui.queueDone138(bIdx)) ui.closeModal(); else ui.openTrainBoost(bIdx);
    }
  };""",
'doTrainRush 自动关窗')], '提速关窗-花金')

# ══════════ ⑧ main.js：wild-withdraw 两段确认 ══════════
patch_file(M, [(
"""      case 'wild-withdraw': {
        var wr = GAME.doWildWithdraw(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast(wr.msg);
        if (wr.ok) { ui.openLandModal(Number(el.dataset.x), Number(el.dataset.y)); GAME.refreshAll(); }
        break;
      }""",
"""      case 'wild-withdraw': {
        /* ============================================================
         * v89.138（老板 0/2）：全站「召回」= **撤回驻军（军队回城）**，
         * 且改**两段确认**（上膛式）—— 召回会让采集进度作废、驻军清空，
         * 是"点下去就回不去"的动作；先上膛（改文案 + 警告），再点一次才执行。
         * ============================================================ */
        var _wx138 = Number(el.dataset.x), _wy138 = Number(el.dataset.y);
        var _wk138 = _wx138 + ',' + _wy138;
        if (ui._wdArm138 !== _wk138) {
          ui._wdArm138 = _wk138;
          el.innerHTML = '⚠️ 再点一次 —— 撤军回城（采集中断）';
          ui.toast('⚠️ 撤回驻军：兵与将随之回城，采集进度作废 —— 再点一次执行');
          break;
        }
        ui._wdArm138 = null;
        var wr = GAME.doWildWithdraw(_wx138, _wy138);
        ui.toast(wr.msg);
        if (wr.ok) { ui.openLandModal(_wx138, _wy138); GAME.refreshAll(); }
        break;
      }""",
'wild-withdraw 两段确认')], '召回两段确认')

# ══════════ ⑨ main.js：doAbandonGather + gather-abandon-* 退役 ══════════
patch_file(M, [(
"""      case 'gather-abandon-ask': ui.openGatherAbandonAsk(el.dataset.id); break;
      case 'gather-abandon-do': GAME.doAbandonGather(el.dataset.id); break;""",
"""      /* ⛔ v89.138（老板 0）：case gather-abandon-ask / gather-abandon-do 退役 ——
         「召回」全站统一走 `wild-withdraw`（撤回驻军 = 停采 + 兵将回城，两段确认）。
         见 ui.js 的 openGatherAbandonAsk 墓碑与 GAME.doAbandonGather 墓碑。 */""",
'删 gather-abandon case')], 'gather-abandon case')

patch_file(M, [(
"""  GAME.doAbandonGather = function (id) {
    var r = GAME.abandonGather(id);
    ui.toast(r.msg);
    if (r.ok) { GAME.refreshAll(); ui.liveModalTick(); }   /* v89.136：同上 */
  };""",
"""  /* ⛔ v89.138（老板 0）：`GAME.doAbandonGather`（撤回采集队提交端）随
     `gather-abandon-ask/do` 两个动作一并退役 —— 召回统一走 `wild-withdraw`。
     域侧 `GAME.abandonGather` 保留（`doWildWithdraw` 内部调用：停采，满 1h 先收获）。 */""",
'doAbandonGather 退役')], 'doAbandonGather')

print('✅ 补丁D 完成 · 段: ' + ' / '.join(ok))

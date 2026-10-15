# -*- coding: utf-8 -*-
"""v89.120 补丁 B：需求 2（回放态设定即生效）+ 需求 3（三键上移读秒行）+ 需求 4（回合记录倒叙）

· 需求 2 病根：`ui.sdSetCmd` 在 replay 态**静默 return** —— 老板在默认的"史实回放"里
  改动作/目标，界面显示修改、设定完全没生效（推演态本身是好的，探针实证：
  hold 兵 adv 100→100、其余前进到 410）。现在：回放态改设定 → 自动进入推演。
· 需求 3：完成回合/自动战斗/撤退 从弹窗底栏移到 `.bt-top`（读秒行）正中间，按钮降为 sm；
  `.bt-top` 改 grid 三列（左读数 / 中按钮 / 右提示），正中间且永不与两侧重叠。
· 需求 4：回合记录倒叙 —— 整回合整块插到最前（块内正序），裁剪改从末尾删最旧。

执行：python .workbuddy/tools/patch/patch_v89120b_sim_btn_log.py
"""
import io
import os
import sys

R = 'E:/Deepseekdb/'
REPL = []


def edit(path, old, new, label):
    REPL.append((R + path, old, new, label))


# ================================================================
# ① 需求 2：sdSetCmd 回放态自动进推演
# ================================================================
edit('js/ui.js',
     """  /* ---- 指令写入（推演态） ---- */
  ui.sdSetCmd = function (tid, patch) {
    var sd = ui._sd;
    if (!sd || sd.mode !== 'sim' || !sd.sim) return;
    var c = sd.sim.cmds[tid] = sd.sim.cmds[tid] || {};""",
     """  /* ---- 指令写入（设定即生效） ---- */
  ui.sdSetCmd = function (tid, patch) {
    var sd = ui._sd;
    if (!sd) return;
    /* v89.120（老板「战场推演…兵种实际行为和设定不一样」）：
       改前 replay 态**静默 return** —— 老板在默认的"史实回放"里改动作/目标，
       界面显示新选中值、设定却完全没生效（推演态本身没问题，探针实证过）。
       现在：**设定即生效** —— 回放态改设定自动进入推演；不能推演（校验未过）
       则明确拒绝并**重绘回弹**（别让 select 停在假值上）。 */
    if (sd.mode !== 'sim' || !sd.sim) {
      ui.sdSimEnter();                       /* 内部含 verify 校验与 toast */
      if (sd.mode !== 'sim' || !sd.sim) {    /* 进不去 → 不假装成功 */
        if (ui.sdRepaintAll) ui.sdRepaintAll('此战不可推演（史实与重跑不一致），设定不生效。');
        return;
      }
    }
    var c = sd.sim.cmds[tid] = sd.sim.cmds[tid] || {};""",
     'sdSetCmd 回放态自动进推演')

# ================================================================
# ② 需求 3：btTopHTML 三键（grid 三列：左读数 / 中按钮 / 右提示）
# ================================================================
edit('js/ui.js',
     """  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    var gp = ui.btGapOf(rec, snap);
    return '<div class="bt-top">' +
      '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
      '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
      '<span id="bt-gap" title="两军最前线之间的距离（纵深 − 双方推进度）；推进到进入射程即停">间距 '
        + (gp == null ? '—' : U.numText(gp, 0)) + '</span>' +
      '<span class="bt-hint">动作/目标用左侧下拉框设置；点「完成回合」立即结算，到点自动结算</span>' +
      '</div>';
  };""",
     """  ui.btTopHTML = function (rec, snap) {
    var sec = (GAME.state.settings && GAME.state.settings.battleSec) || 60;
    var cnt = (rec.cnt == null) ? sec : rec.cnt;
    var gp = ui.btGapOf(rec, snap);
    /* v89.120（老板「那三个雷霆大按钮，完成回合、自动战斗、撤回。缩小，
       放到战场上方读秒那行正中间」）：三键从弹窗底栏移到读秒行 ——
       `.bt-top` 改 grid 三列（左=读数 / 中=三键 / 右=提示），按钮降为 btn sm；
       长说明挪进 title（别与中间按钮挤）。 */
    return '<div class="bt-top">' +
      '<span class="bt-left">' +
        '<span class="bt-cd">⏳ <b id="bt-cd">' + Math.max(0, Math.ceil(cnt)) + '</b> 秒</span>' +
        '<span>第 <b id="bt-round">' + (snap.round || 0) + '</b> / ' + (snap.maxRounds || 30) + ' 回合</span>' +
        '<span id="bt-gap" title="两军最前线之间的距离（纵深 − 双方推进度）；推进到进入射程即停">间距 '
          + (gp == null ? '—' : U.numText(gp, 0)) + '</span>' +
      '</span>' +
      '<span class="bt-acts">' +
        '<button class="btn sm gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn sm" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn sm" data-action="bt-retreat">🏳️ 撤退</button>' +
      '</span>' +
      '<span class="bt-hint" title="动作/目标用左侧下拉框设置；点「完成回合」立即结算，到点自动结算">左侧设动作/目标</span>' +
      '</div>';
  };""",
     'btTopHTML 三键居中')

# ================================================================
# ③ 需求 3：openBattlefield 的 foot 去掉三键
# ================================================================
edit('js/ui.js',
     """      foot: '<button class="btn gold" data-action="bt-done">✅ 完成回合</button>' +
        '<button class="btn" data-action="bt-auto">⏩ 自动战斗</button>' +
        '<button class="btn" data-action="bt-retreat">🏳️ 撤退</button>' +
        '<button class="btn" data-action="close-modal">后台运行</button>',""",
     """      /* v89.120：三键已移到读秒行（.bt-acts，见 ui.btTopHTML）——
         底栏只留"后台运行"（它是关闭键，由 openModal 统一剥离；语义在副标题写明） */
      foot: '<button class="btn" data-action="close-modal">后台运行</button>',""",
     'openBattlefield 底栏收窄')

# ================================================================
# ④ 需求 4：回合记录倒叙（整块置顶 + 裁剪方向 + 唯一工厂）
# ================================================================
edit('js/ui.js',
     """  /* 兼容出口：旧调用点（ui.btPlay）读的是这一个 —— 现在它落**多行**并返回同样的文本数组 */
  ui.btRoundLine = function (r, snap) {
    var lines = ui.btRoundLines(r, snap);
    ui.btLogPush('', 'sep');                                  /* 回合之间：虚线间隔 */
    ui.btLogPush('第 ' + ((r && r.r) || 0) + ' 回合　·　间距 ' + U.numText((r && r.gap) || 0, 0), 'hdr');
    lines.forEach(function (L) { ui.btLogPush(L.txt, L.cls, L.indent); });
    if (!lines.length) ui.btLogPush('[我] 待命　　[敌] 待命', 'atk', 0);
    return lines.map(function (L) { return L.txt; });         /* 数组：调用方/断言可直接读 */
  };
  /* 往播报窗推一行（统一入口：所有写日志的地方都走它） */
  ui.btLogPush = function (line, cls, indent) {
    var log = document.getElementById('bt-log');
    /* ⚠️ 测试桩的 DOM 可能给一个"没有 children"的壳元素 —— 逐项判能力再动手 */
    if (!log || (!line && cls !== 'sep') || !log.appendChild) return;
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    d.textContent = line;
    log.appendChild(d);
    var kids = log.children;
    if (kids && typeof kids.length === 'number') {
      /* v89.117：逐兵种一行后每回合行数变多（一场 6 兵种 ≈ 8 行），窗口放到 40 行 */
      while (kids.length > 40 && log.firstChild) log.removeChild(log.firstChild);
    }
    if (typeof log.scrollTop === 'number') log.scrollTop = log.scrollHeight;
  };""",
     """  /* 兼容出口：旧调用点（ui.btPlay）读的是这一个 —— 返回结构化行文本数组。
     v89.120（老板「回合记录倒叙记录，最新战况显示在最上方」）：
     整回合**整块插到最前** —— 块内部保持"回合头 → 逐兵种行"的正序，
     块与块之间 = 最新在上（每条块自带一条虚线，即块间分隔线）。 */
  ui.btRoundLine = function (r, snap) {
    var lines = ui.btRoundLines(r, snap);
    var log = document.getElementById('bt-log');
    if (!log || !log.insertBefore) return lines.map(function (L) { return L.txt; });
    var frag = document.createDocumentFragment();
    frag.appendChild(ui.btLogItem('', 'sep'));
    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　间距 ' + U.numText((r && r.gap) || 0, 0), 'hdr'));
    lines.forEach(function (L) { frag.appendChild(ui.btLogItem(L.txt, L.cls, L.indent)); });
    if (!lines.length) frag.appendChild(ui.btLogItem('[我] 待命　　[敌] 待命', 'atk', 0));
    log.insertBefore(frag, log.firstChild);                   /* 新回合置顶（倒叙） */
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;  /* 视口钉在最新（顶部） */
    return lines.map(function (L) { return L.txt; });          /* 数组：调用方/断言可直接读 */
  };
  /* 播报窗行元素**唯一工厂**（格式只在这里定义一处 —— 回合块与逐条流共用） */
  ui.btLogItem = function (line, cls, indent) {
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    d.textContent = line;
    return d;
  };
  /* 播报窗行数上限：一场 6 兵种 ≈ 8 行/回合，40 行 ≈ 看得见 5 个回合；
     与 .bt-log 的 196px 视高配套。倒叙后**最旧的在最下**，裁剪从末尾删。 */
  ui.BT_LOG_MAX = 40;
  ui.btLogTrim = function (log) {
    var kids = log && log.children;
    /* ⚠️ 测试桩的 DOM 可能给一个"没有 children"的壳元素 —— 判能力再动手 */
    if (!kids || typeof kids.length !== 'number') return;
    while (kids.length > ui.BT_LOG_MAX && log.lastChild) log.removeChild(log.lastChild);
  };
  /* 往播报窗推一行（逐条流；**最新在上**，与回合块同口径） */
  ui.btLogPush = function (line, cls, indent) {
    var log = document.getElementById('bt-log');
    if (!log || (!line && cls !== 'sep') || !log.insertBefore) return;
    log.insertBefore(ui.btLogItem(line, cls, indent), log.firstChild);
    ui.btLogTrim(log);
    if (typeof log.scrollTop === 'number') log.scrollTop = 0;
  };""",
     'btRoundLine/btLogPush 倒叙改造')

# ================================================================
# ⑤ index.html：.bt-top 改 grid 三列 + .bt-acts/.bt-left
# ================================================================
edit('index.html',
     """  .bt-top { display: flex; align-items: center; gap: var(--sp-5); padding: var(--sp-1) var(--sp-0) var(--sp-3);
    font-size: var(--fs-sub); color: var(--text-dim); flex-wrap: wrap; }
  .bt-top .bt-cd b { color: var(--gold-light); font-size: var(--fs-num); }
  .bt-top .bt-hint { margin-left: auto; opacity: .72; font-size: var(--fs-cap); }""",
     """  /* v89.120（老板「三个大按钮缩小，放到读秒那行正中间」）：
     .bt-top 由 flex 改 grid 三列 —— 左=读数 / 中=三键 / 右=提示；
     "正中间"由列结构保证（不是绝对定位），两侧再挤也不会互相盖住。 */
  .bt-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
    gap: var(--sp-4); padding: var(--sp-1) var(--sp-0) var(--sp-3);
    font-size: var(--fs-sub); color: var(--text-dim); }
  .bt-top .bt-cd b { color: var(--gold-light); font-size: var(--fs-num); }
  .bt-top .bt-left { display: flex; align-items: center; gap: var(--sp-5); min-width: 0; flex-wrap: wrap; }
  .bt-top .bt-acts { display: flex; gap: var(--sp-2); justify-self: center; white-space: nowrap; }
  .bt-top .bt-hint { justify-self: end; text-align: right; opacity: .72; font-size: var(--fs-cap); }""",
     'index.html .bt-top 三列')

# ================================================================
# 执行
# ================================================================
def main():
    files = {}
    for p, old, new, label in REPL:
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
    bad = 0
    for p, old, new, label in REPL:
        n = files[p].count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次 → 中止' % (label, n))
            bad += 1
    if bad:
        return 1
    print('预检通过：%d 处锚点全部唯一' % len(REPL))
    for p, old, new, label in REPL:
        files[p] = files[p].replace(old, new, 1)
        print('  ✓ %s' % label)
    ui = files[R + 'js/ui.js']
    checks = [
        ('ui.js 有 btLogItem', 'ui.btLogItem = function' in ui),
        ('ui.js 有 btLogTrim', 'ui.btLogTrim = function' in ui),
        ('ui.js 有 BT_LOG_MAX', 'ui.BT_LOG_MAX = 40' in ui),
        ('ui.js 倒叙：insertBefore(frag, log.firstChild)', 'log.insertBefore(frag, log.firstChild)' in ui),
        ('ui.js 裁剪从末尾', 'log.removeChild(log.lastChild)' in ui),
        ('ui.js sdSetCmd 自动进推演', 'ui.sdSimEnter();                       /* 内部含 verify 校验与 toast */' in ui),
        ('ui.js 三键在读秒行', 'data-action="bt-done">✅ 完成回合</button>' in ui),
    ]
    for label, ok in checks:
        print(('  ✓ ' if ok else '  !! ') + label)
        if not ok:
            return 1
    for p, s in files.items():
        o = (s.count('{'), s.count('}'))
        tmp = p + '.tmp120b'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（{ } = %d/%d）' % (p.split('/')[-1], o[0], o[1]))
    print('补丁 B 完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())

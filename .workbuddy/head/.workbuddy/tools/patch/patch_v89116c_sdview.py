# -*- coding: utf-8 -*-
"""v89.116 补丁 C：沙盘视角的收尾（sdLine / sdPaint / sdSimEnd / 推演入口 / 打开提示）

补丁 B 改了 `ui.sdSideName` 的签名为 (sb, side) —— 本补丁把剩余调用点全部对齐，
并让"战况一句话 / 推演对照 / 打开时的副标题"都按视角说话。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


edit('js/ui.js',
     """    var side = ui.sdSideName(f[1] === 0 ? 'atk' : 'def'), k = f[3], v1 = f[5], v2 = f[6];""",
     """    /* v89.116：`sdSideName` 现在是 (sb, side) —— 这里必须把 sb 传进去，
       否则视角是空的：守城仗里"我方"会被叫成"敌军"。 */
    var side = ui.sdSideName(sb, f[1] === 0 ? 'atk' : 'def'), k = f[3], v1 = f[5], v2 = f[6];""",
     'ui.js sdLine 视角参数')

edit('js/ui.js',
     """    if (k === 'w') return '🏯 第' + f[0] + '回合 城头火力 → ' + (tn || '我军') + '　杀伤 ' + U.numText(v1, 0);""",
     """    /* 城头火力打的是**攻方**（墙在守方那一侧）→ 文字按视角给 */
    if (k === 'w') return '🏯 第' + f[0] + '回合 城头火力 → ' + (tn || ui.sdSideName(sb, 'atk')) + '　杀伤 ' + U.numText(v1, 0);""",
     'ui.js sdLine 城头火力')

edit('js/ui.js',
     """    setLine('sd-fl-a', ui.sdPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD, !contact, '我军前线');
    setLine('sd-fl-d', ui.sdPct('def', fr.dFront, D) - ui.SD_FL_AHEAD, !contact, '敌军前线');
    setLine('sd-fl-c', fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : ui.sdAxisPct(fr.mid, D)),
      contact, fr.broke ? '被攻入腹地' : '接触线');""",
     """    setLine('sd-fl-a', ui.sdPct('atk', fr.aFront, D) + ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'atk') + '前线');
    setLine('sd-fl-d', ui.sdPct('def', fr.dFront, D) - ui.SD_FL_AHEAD, !contact,
      ui.sdSideName(sb, 'def') + '前线');
    setLine('sd-fl-c', fr.broke === 'atk' ? 4 : (fr.broke === 'def' ? 96 : ui.sdAxisPct(fr.mid, D)),
      contact, fr.broke ? ui.sdSideName(sb, fr.broke) + '被攻入腹地' : '接触线');""",
     'ui.js sdPaint 三线标签')

edit('js/ui.js',
     """    /* 动作 chips（回放 = 该兵种当回合的实际动作；推演 = 玩家指令） */
    st.atk.forEach(function (u) {
      var row = document.querySelector('#sd-board [data-row="atk-' + u.id + '"]');""",
     """    /* 动作 chips（回放 = 该兵种当回合的实际动作；推演 = 玩家指令）
       v89.116：可操作侧 = 视角给的"我方"（守城仗里是 def 那一列） */
    (ui.sdOurSide(sb) === 'atk' ? st.atk : st.def).forEach(function (u) {
      var row = document.querySelector('#sd-board [data-row="' + ui.sdOurSide(sb) + '-' + u.id + '"]');""",
     'ui.js sdPaint chips 视角')

edit('js/ui.js',
     """    var stx = document.getElementById('sd-side-txt');
    if (stx) stx.innerHTML = ui.sdSideTotals(st);""",
     """    var stx = document.getElementById('sd-side-txt');
    if (stx) stx.innerHTML = ui.sdSideTotals(st, sb);""",
     'ui.js sdPaint 总数视角')

edit('js/ui.js',
     """    var ph = document.getElementById('sd-phase');
    if (ph) ph.textContent = ui.sdPhaseText(fr);""",
     """    var ph = document.getElementById('sd-phase');
    if (ph) ph.textContent = ui.sdPhaseText(fr, sb);""",
     'ui.js sdPaint 战况视角')

edit('js/ui.js',
     """      d.textContent = '🏁 推演结束：' + fin.rounds + ' 回合　我军损失 ' + U.numText(fin.atkLoss, 0)
        + '　敌军损失 ' + U.numText(fin.defLoss, 0)
        + '（史实：' + (h.rounds || 0) + ' 回合　我损 ' + U.numText(h.atkLoss || 0, 0)
        + '　敌损 ' + U.numText(h.defLoss || 0, 0) + '）';""",
     """      /* v89.116：对照按视角给（"我损"= 我方那一侧的损失） */
      var _o = ui.sdOurSide(sb) === 'atk';
      d.textContent = '🏁 推演结束：' + fin.rounds + ' 回合　我军损失 '
        + U.numText(_o ? fin.atkLoss : fin.defLoss, 0)
        + '　敌军损失 ' + U.numText(_o ? fin.defLoss : fin.atkLoss, 0)
        + '（史实：' + (h.rounds || 0) + ' 回合　我损 ' + U.numText(_o ? (h.atkLoss || 0) : (h.defLoss || 0), 0)
        + '　敌损 ' + U.numText(_o ? (h.defLoss || 0) : (h.atkLoss || 0), 0) + '）';""",
     'ui.js 推演对照视角')

edit('js/ui.js',
     """    sd.sim = { env: env, cmds: {}, frames: [], per: [], over: false };
    sd.cur = ui.sdStateFromSnap(env.snap(), sb, []);
    sd.i = 0;
    ui.sdRepaintAll('已进入沙盘推演：改动作 / 目标 → 点「完成回合」，直至一方兵员耗尽。');""",
     """    sd.sim = { env: env, cmds: {}, frames: [], per: [], over: false };
    sd.cur = ui.sdStateFromSnap(env.snap(), sb, []);
    sd.i = 0;
    ui.sdRepaintAll('已进入沙盘推演：改' + (ui.sdOurSide(sb) === 'def' ? '守军' : '我军')
      + '的动作 / 目标 → 点「完成回合」，直至一方兵员耗尽。');""",
     'ui.js 推演入口提示')

edit('js/ui.js',
     """      sub: '共 ' + sb.rounds + ' 回合 · ' + sb.frames.length + ' 帧（每个兵种的每次移动 / 攻击各一帧）'
        + '　·　' + (sb.verify ? '✅ 与史实逐项一致' : '⚠ 与史实不一致（战后加成已变，画面仅示意）'),""",
     """      sub: '共 ' + sb.rounds + ' 回合 · ' + sb.frames.length + ' 帧（每个兵种的每次移动 / 攻击各一帧）'
        + '　·　' + (sb.verify ? '✅ 与史实逐项一致' : '⚠ 与史实不一致（战后加成已变，画面仅示意）')
        + (ui.sdOurSide(sb) === 'def'
          ? '　·　守城视角：敌在左、我在右（城墙在我方一侧；出城迎战的部队照常逐回合前进接战）'
          : ''),""",
     'ui.js 沙盘副标题视角')

edit('js/ui.js',
     """  ui.sdSimEnter = function () {
    var sd = ui._sd, sb = sd.sb;
    if (!sb.verify) { ui.toast('沙盘校验未过（史实与重跑不一致），不能推演'); return; }""",
     """  ui.sdSimEnter = function () {
    var sd = ui._sd, sb = sd.sb;
    if (!sb.verify) { ui.toast('沙盘校验未过（史实与重跑不一致），不能推演'); return; }
    /* 视角：可操作侧由 sb.ourSide 决定（守城仗里推演的是守军） */""",
     'ui.js 推演入口注释')

# ---------------- 执行 ----------------
def main():
    files = {}
    for path, old, new, tag in EDITS:
        p = R + path
        if p not in files:
            files[p] = io.open(p, encoding='utf-8').read()
        s = files[p]
        n = s.count(old)
        if n != 1:
            print('!! [%s] 锚点匹配 %d 次（要求 1）→ 中止' % (tag, n))
            return 1
        files[p] = s.replace(old, new, 1)
        print('  ✓ %s' % tag)
    bak = R + '.workbuddy/backup/v89116/'
    for p, s in files.items():
        b = io.open(bak + os.path.basename(p), encoding='utf-8').read()
        d0 = (s.count('{') - s.count('}')) - (b.count('{') - b.count('}'))
        if d0 != 0:
            print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
            return 1
        tmp = p + '.tmp116c'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 C 完成')
    return 0


sys.exit(main())

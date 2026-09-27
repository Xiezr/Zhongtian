# -*- coding: utf-8 -*-
# v89.136 批3/4-a：ui.js —— 战斗界面双方将领（悬停六维）+ 反击文案/白色 + 结束不弹窗
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)
def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点 = ' + str(n)
    return s.replace(old, new)

u = rd('js/ui.js')

# ============================================================
# ① 新增 ui.btGenTip / ui.btGenLine（插在 btSideHTML 之前）
# ============================================================
anchor1 = """  ui.btSideHTML = function (snap, side) {"""
new1 = '''  /* ============================================================
   * v89.136（老板 2）：「军队战斗界面我军和敌军上方显示双方将领，悬停可显示将领六维」
   * ------------------------------------------------------------
   * 数据来源（同一出口）：
   *   · 我方 = rec.genId → state.generals（实时对象，含装备加成后的六维）；
   *   · 敌方 = rec.sim.scGen（**确定性守将快照** —— 与侦查/战斗同一个 guard）。
   * 六维悬停 = ui.GEN_DIMS × GAME.genAttrs（不手抄字段，防漂移）。
   * ============================================================ */
  ui.btGenTip = function (g) {
    if (!g) return '';
    var a = GAME.genAttrs(g);
    return (ui.GEN_DIMS || []).map(function (d) {
      return d.n + ' ' + (a[d.val || d.k] || 0);
    }).join(' · ');
  };
  ui.btGenLine = function (side) {
    var bt = ui._bt;
    var rec = bt ? GAME.battle._recOf(bt.id) : null;
    var g = null;
    if (rec) {
      if (side === 'atk') {
        (GAME.state.generals || []).forEach(function (x) { if (x.id === rec.genId) g = x; });
      } else {
        g = (rec.sim && rec.sim.scGen) || null;
      }
    }
    if (!g) return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '">' +
      '<span class="bt-gen-q">将领：—</span></div>';
    var tip = '将领 ' + (g.name || '—') + '（Lv' + (g.level || 1) + '）\\n' + ui.btGenTip(g);
    return '<div class="bt-gen' + (side === 'atk' ? ' mine' : ' foe') + '" title="' + U.escape(tip) + '">' +
      '⚔ ' + U.escape(g.name || '—') + '<span class="bt-gen-lv">Lv' + (g.level || 1) + '</span></div>';
  };

''' + anchor1
u = rep1(u, anchor1, new1, '① btGenLine')

# ============================================================
# ② btSideHTML：列头下加将领行
# ============================================================
old2 = """      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).length + ' 队）</div>' +
      (rows || '<div class="q-empty">无</div>') + '</div>';"""
new2 = """      '<div class="bt-side-h">' + ui.btSideName(side) + '（' + ((side === 'atk') ? (snap.atk || []) : (snap.def || [])).length + ' 队）</div>' +
      /* v89.136（老板 2）：「我军和敌军上方显示双方将领，悬停可显示将领六维」 */
      ui.btGenLine(side) +
      (rows || '<div class="q-empty">无</div>') + '</div>';"""
u = rep1(u, old2, new2, '② 将领行')

# ============================================================
# ③ btRoundLines：反击带阵营 + 文案动态 + 我方片段白色标记
# ============================================================
old3 = """        if (host) host.counters.push({ name: e.name, kill: e.kill });"""
new3 = """        /* v89.136：带阵营 —— 文案按**反击者阵营**给词（我方行里的反击 = 敌方反击，反之亦然） */
        if (host) host.counters.push({ name: e.name, kill: e.kill, side: e.side });"""
u = rep1(u, old3, new3, '③a counters side')

old4 = """        if (a.counters && a.counters.length) {
          s += '（' + a.counters.map(function (c) {
            return '对方' + c.name + '反击 歼 ' + U.numText(c.kill, 0);
          }).join('，') + '）';
        }"""
new4 = """        if (a.counters && a.counters.length) {
          /* v89.136（老板 3）：①「'对方'应该是'我方'才对」——按反击者阵营给词；
             ②「这句应以白色字体显示，因为是我方动作」——我方片段包 U+0001/U+0002
             受控标记（渲染层 btLogItem 转 span.bt-me，白色）。 */
          s += '（' + a.counters.map(function (c) {
            var _txt = (c.side === 'atk' ? '我方' : '敌方') + c.name + '反击 歼 ' + U.numText(c.kill, 0);
            return c.side === 'atk' ? ('\\u0001' + _txt + '\\u0002') : _txt;
          }).join('，') + '）';
        }"""
u = rep1(u, old4, new4, '③b 反击文案')

# ============================================================
# ④ btLogItem：支持受控标记（白色片段）
# ============================================================
old5 = """  ui.btLogItem = function (line, cls, indent) {
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    d.textContent = line;
    return d;
  };"""
new5 = """  ui.btLogItem = function (line, cls, indent) {
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    /* v89.117：**按出手顺序错开** —— indent（px）由 ui.btRoundLines 给 */
    if (indent) d.style.paddingLeft = indent + 'px';
    /* v89.136（老板 3）：我方动作片段白色 —— U+0001 / U+0002 受控标记 → span.bt-me。
       先整串 escape 再替换标记：标记之外的任何字符都不会变成 HTML（无注入面）。 */
    if (line != null && line.indexOf('\\u0001') >= 0) {
      d.innerHTML = U.escape(line)
        .replace(/\\u0001/g, '<span class="bt-me">')
        .replace(/\\u0002/g, '</span>');
    } else {
      d.textContent = line;
    }
    return d;
  };"""
u = rep1(u, old5, new5, '④ btLogItem')

# ============================================================
# ⑤ btShowEnd：不弹窗 → 补最后一回合 + 结束行 + 三键收提示
# ============================================================
old6 = """  /* ---- 结束：战果面板 ---- */
  ui.btShowEnd = function (bt) {
    if (bt && bt.timer) clearInterval(bt.timer);
    if (ui._bt && (!bt || ui._bt.id === bt.id)) ui._bt = null;
    var res = GAME._battleJustDone;
    var body;
    if (res && bt && res.id === bt.id) {
      var head = !res.ok ? '⚑ 战斗中止'
        : (res.winner === 'atk' ? '🎉 我军得胜' : '⚑ 我军失利（战果见战报）');
      body = '<div class="bt-end">' +
        '<div class="bt-end-t">' + head + '</div>' +
        '<div class="bt-end-s">共 ' + (res.rounds || 0) + ' 回合　·　我军损失 ' + U.numText(res.atkLoss || 0, 0) +
          '　·　敌军损失 ' + U.numText(res.defLoss || 0, 0) + '</div>' +
        (res.rolled ? '<div class="bt-end-s">结算异常：大军已原路折返</div>' : '') +
        '<div class="bt-end-s">战报已入公文（「公文」页可回看）。</div></div>';
    } else {
      body = '<div class="bt-end"><div class="bt-end-t">战斗已结束</div>' +
        '<div class="bt-end-s">战报见「公文」页。</div></div>';
    }
    ui.openShell({
      title: '⚔ 战场 · 战果', size: 'sm', body: body,
      foot: '<button class="btn gold" data-action="close-modal">关闭</button>',
    });
  };"""
new6 = """  /* ---- 结束：播报窗收束（v89.136 起不再开"战果"面板） ----
     老板令：「（最后一回合）无需弹窗，直接在下方回合记录里记录回合结束」。
     三个动作：
       ① **补最后一回合** —— 它此前必被吞掉：`onBattleDone` 在 `stepBattle` 内部同步触发
          （finishBattle → _settleBattle），先把 `ui._bt` 置空，main.js 随后的
          `btAfterStep(rec, r)` 检查 `ui._bt` 直接 return（老板实测"最后一回合没有完整显示"的病根）；
       ② 战果写成播报窗的最后一行（含损失/回合数/战报去向）；
       ③ 三键收成提示（防"点了没反应"）。 */
  ui.btShowEnd = function (bt) {
    if (bt && bt.timer) clearInterval(bt.timer);
    var res = GAME._battleJustDone;
    if (ui._bt && (!bt || ui._bt.id === bt.id)) ui._bt = null;
    var same = res && bt && res.id === bt.id;
    if (same && res.lastStep && res.lastStep.snap) {
      ui.btRoundLine(res.lastStep, res.lastStep.snap);   /* ① 补最后一回合 */
    }
    var txt;
    if (same) {
      txt = '🏁 战斗结束：' + (!res.ok ? '战斗中止（大军折返）'
        : (res.winner === 'atk' ? '我军得胜' : '我军失利'))
        + '　·　共 ' + (res.rounds || 0) + ' 回合　·　我军损失 ' + U.numText(res.atkLoss || 0, 0)
        + '　·　敌军损失 ' + U.numText(res.defLoss || 0, 0) + '　·　战报已入公文';
    } else {
      txt = '🏁 战斗已结束（战报见「公文」）';
    }
    ui.btLogPush(txt, 'end');                            /* ② 结束行 */
    var acts = document.getElementById('bt-acts');
    if (acts) acts.innerHTML = '<span class="bt-hint">战斗已结束 —— 战报见「公文」；右上角 ✕ 关闭</span>';
    var cd = document.getElementById('bt-cd');
    if (cd) cd.textContent = '0';
  };"""
u = rep1(u, old6, new6, '⑤ btShowEnd')

# ============================================================
# ⑥ btTopHTML：.bt-acts 加 id（结束时可替换）
# ============================================================
old7 = """      '<span class="bt-acts">' +
        '<button class="btn sm gold" data-action="bt-done">✅ 完成回合</button>' +"""
new7 = """      '<span class="bt-acts" id="bt-acts">' +
        '<button class="btn sm gold" data-action="bt-done">✅ 完成回合</button>' +"""
u = rep1(u, old7, new7, '⑥ bt-acts id')

# ---------- 写后自检 ----------
for sent in ['ui.btGenLine = function', 'ui.btGenTip = function', "ui.btGenLine(side) +",
             "c.side === 'atk' ? ('\\u0001'", "'<span class=\"bt-me\">'", 'ui.btLogPush(txt', 'id="bt-acts"']:
    assert u.count(sent) >= 1, '丢失哨兵: ' + sent
assert "return '对方' + c.name" not in u, '「对方」文案残留（ui）'
assert 'ui.openShell({\n      title: \'⚔ 战场 · 战果\'' not in u, '战果面板残留'

wr('js/ui.js', u)
print('OK · ui.js', len(u))

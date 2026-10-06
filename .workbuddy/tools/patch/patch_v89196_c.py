# -*- coding: utf-8 -*-
"""v89.196 批次C：战斗回看三情形（老板 4）
C1 battle.js _battleJustDone 挂 report（结束瞬间可回看）
C2 ui.js    openSandboxRep 抽取（沙盘呈现唯一渲染段）+ sdOpenDone 新增
C3 ui.js    btShowEnd 加「🎬 回看全程」按钮
C4 ui.js    openBattlefield 早退 toast 升级（导流回看）
C5 main.js  case 'bt-replay'"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- C1 battle.js：_battleJustDone 挂 report ----------------
C1_OLD = """      lastStep: { r: rec.round, gap: rec.gapLast, events: (rec.evLast || []).slice(),
        snap: rec.snapLast ? U.deep(rec.snapLast) : null },
    };"""
C1_NEW = """      lastStep: { r: rec.round, gap: rec.gapLast, events: (rec.evLast || []).slice(),
        snap: rec.snapLast ? U.deep(rec.snapLast) : null },
      /* v89.196（老板 4）：「我想要看到全部战斗过程……战斗已结束……自动战斗直接结算」——
         落账生成的战报（含沙盘配方 sandbox）**挂到结束回执**上：
         结束界面的「🎬 回看全程」据此直接开沙盘（不必再翻公文找战报）。
         同步调用内采集：expedition 落账即 `s.reports.unshift(report)` → reports[0] 就是本条；
         折返/异常（无战报）时为 null。 */
      report: (!err && resp && resp.ok !== false && s.reports && s.reports[0]) ? s.reports[0] : null,
    };"""
rep('js/battle.js', 'C1 挂 report', C1_OLD, C1_NEW, 'report: (!err && resp && resp.ok !== false && s.reports')

# ---------------- C2 ui.js：openSandboxRep 抽取 + sdOpenDone ----------------
C2_OLD = """  ui.openSandbox = function (rid) {
    var rep = GAME.repByRid(rid);
    if (!rep) return;
    ui.sdStop();
    ui._repId = rid;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) { ui.viewReportText(rid); return; }
    ui._sd = { rid: rid, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };
    ui._sd.cur = ui.sdStateInit(sb);
    ui.openShell({"""
C2_NEW = """  ui.openSandbox = function (rid) {
    var rep = GAME.repByRid(rid);
    if (!rep) return;
    if (!ui.openSandboxRep(rep, rid)) ui.viewReportText(rid);
  };
  /* v89.196（老板 4）：沙盘呈现的**唯一渲染段** —— 入口多处共用：
     ① 战报（openSandbox(rid)）② 战斗结束界面「🎬 回看全程」（sdOpenDone）
     ③ 工具/试验（直给 rep）。返回 false = 无回放数据（调用方决定去向）。 */
  ui.openSandboxRep = function (rep, rid) {
    if (!rep) return false;
    ui.sdStop();
    ui._repId = rid || null;
    var sb = (GAME.battle.sandboxOf ? GAME.battle.sandboxOf(rep) : null);
    if (!sb || !sb.frames.length) return false;
    ui._sd = { rid: rid || null, rep: rep, sb: sb, i: 0, timer: null, mode: 'replay', sim: null };
    ui._sd.cur = ui.sdStateInit(sb);
    ui.openShell({"""
rep('js/ui.js', 'C2a openSandboxRep', C2_OLD, C2_NEW, 'ui.openSandboxRep = function (rep, rid) {')

C2B_OLD = """      foot: '<button class="btn" data-action="sd-text">📜 战报正文</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>',
    });
    ui.sdRebuildLog();
  };"""
C2B_NEW = """      foot: '<button class="btn" data-action="sd-text">📜 战报正文</button>' +
        '<button class="btn" data-action="close-modal">关闭</button>',
    });
    ui.sdRebuildLog();
    return true;
  };
  /* v89.196（老板 4）：战斗**结束瞬间**的「回看全程」——
     直接吃 _battleJustDone.report（含沙盘配方）开沙盘；无回执（如重载后）导流公文。 */
  ui.sdOpenDone = function () {
    var jd = GAME._battleJustDone;
    var rep = jd && jd.ok && jd.report;
    if (!rep) { ui.toast('战报尚未落账或已过期 —— 可在「公文」里回看历史战斗'); return false; }
    var rid = GAME.repRidOf ? GAME.repRidOf(rep) : null;
    var ok = ui.openSandboxRep(rep, rid);
    if (!ok) ui.toast('该战报没有回放数据 —— 可在「公文」查看战报正文');
    return ok;
  };"""
rep('js/ui.js', 'C2b sdOpenDone', C2B_OLD, C2B_NEW, 'ui.sdOpenDone = function () {')

# ---------------- C3 ui.js：btShowEnd 加按钮 ----------------
C3_OLD = """    var acts = document.getElementById('bt-acts');
    if (acts) acts.innerHTML = '<span class="bt-hint">战斗已结束 —— 战报见「公文」；右上角 ✕ 关闭</span>';"""
C3_NEW = """    var acts = document.getElementById('bt-acts');
    if (acts) {
      /* v89.196（老板 4）：「我想要看到全部战斗过程……战斗已结束……自动战斗直接结算」——
         结束瞬间直接给「🎬 回看全程」（走 _battleJustDone.report 的沙盘配方）；
         数据过期（页面重载等）时退回"战报见公文"的导流文案。 */
      var canReplay196 = !!(same && res && res.ok && res.report);
      acts.innerHTML = (canReplay196
          ? '<button class="btn sm gold" data-action="bt-replay">🎬 回看全程</button> '
          : '')
        + '<span class="bt-hint">战斗已结束 —— '
        + (canReplay196 ? '可回看全程；' : '')
        + '战报见「公文」；右上角 ✕ 关闭</span>';
    }"""
rep('js/ui.js', 'C3 btShowEnd 按钮', C3_OLD, C3_NEW, "data-action=\"bt-replay\">🎬 回看全程")

# ---------------- C4 ui.js：openBattlefield 早退 toast ----------------
C4_OLD = """    if (!rec) { ui.toast('战斗已结束（战报见公文）'); return; }"""
C4_NEW = """    /* v89.196（老板 4）：已结束的战斗 → 导流「回看全程」（沙盘）——
       v89.150 起战斗类公文默认直进沙盘（ui.viewReport），这里把话说全。 */
    if (!rec) { ui.toast('战斗已结束 —— 可在「公文」点开战报回看全程'); return; }"""
rep('js/ui.js', 'C4 早退 toast', C4_OLD, C4_NEW, '可在「公文」点开战报回看全程')

# ---------------- C5 main.js case ----------------
C5_OLD = """      case 'bt-open': ui.openBattlefield(el.dataset.id); break;"""
C5_NEW = """      case 'bt-open': ui.openBattlefield(el.dataset.id); break;
      /* v89.196（老板 4）：结束界面「🎬 回看全程」→ 用结束回执里的战报直接开沙盘 */
      case 'bt-replay': ui.sdOpenDone(); break;"""
rep('js/main.js', 'C5 case bt-replay', C5_OLD, C5_NEW, "case 'bt-replay': ui.sdOpenDone(); break;")

print('批次C 完成')

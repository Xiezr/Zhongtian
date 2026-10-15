# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119a_counter_order.py — 反击记录配对（v89.119）
# ----------------------------------------------------------------
# 老板：「反击应该在敌方出手后，而不是己方移动后直接反击，回合记录稍微调整。
#   我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。
#   反击和对方出手记录在同一行」
#
# 现状（探针实测）：counter 事件被归到**反击者自己的行**，且因为行内
#   `moves.concat(acts)` 的顺序，它排在自己"出手"之前 ——
#   读起来像"我方（先）反击、（后）出手"，而"引发它的那次出手"根本不在本行里。
#
# 改法（三处同一配对规则）：counter 并入**引发它的那次出手**（同段/同行、紧跟其后）：
#   · 宿主键 = 对面阵营 + 出手者 id（`a|id` / `d|id`）—— 同名兵种互射不串台；
#   · 兜底：找不到宿主（异常数据）→ 独立成段/成格，不静默丢事件。
#
# 三处落点：
#   ① js/tactic.js  引擎纪要（战报正文"第N回合：…"）
#   ② js/ui.js      ui.btRoundLines（实时战斗界面下部分回合记录）
#   ③ js/battle.js  replayFramesOf 的 evLine（战报回放帧摘要）
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
BAK = R + '.workbuddy/backup/v89119/'
files = {}


def load(rel):
    p = R + rel
    files[p] = io.open(p, encoding='utf-8').read()
    return files[p]


def seg_pair_count(seg):
    return seg.count('{') - seg.count('}')


def apply_slice(p, i0, i1, new_seg, tag):
    """[i0, i1) 整段替换 + 自检"""
    s = files[p]
    old_seg = s[i0:i1]
    d_old = seg_pair_count(old_seg)
    d_new = seg_pair_count(new_seg)
    s2 = s[:i0] + new_seg + s[i1:]
    # 写后自检：净括号变化必须等于"新旧段自身差值"（防截断/防漏替换）
    d_file = seg_pair_count(s2) - seg_pair_count(s)
    assert d_file == d_new - d_old, ('%s 括号净变化 %+d ≠ 预期 %+d' % (tag, d_file, d_new - d_old))
    files[p] = s2
    print('  ✓ %s（段长 %d → %d）' % (tag, len(old_seg), len(new_seg)))


# ================================================================
# ① tactic.js —— 引擎纪要
# ================================================================
p = R + 'js/tactic.js'
s = load('js/tactic.js')
MARK_A = "    /* 逐回合纪要（文字）—— 供战报直接展示 */"
END_A = "    if (craftKinds > 0) {"
i0 = s.index(MARK_A)
i1 = s.index(END_A, i0)
old_seg = s[i0:i1]
assert 'roundsLog.forEach' in old_seg and len(old_seg) < 2600, len(old_seg)
assert old_seg.count("e.kind === 'counter'") == 1

NEW_A = '''    /* 逐回合纪要（文字）—— 供战报直接展示 */
    /* 回合纪要：只写**接战结果**，推进过程交给战场条带去看 ——
       把"每支部队这一回合走了多远"也写进正文，会把战报变成流水账。
       v89.119（老板）：「反击应该在敌方出手后…反击和对方出手记录在同一行」——
       反击不再独立成段：并入**引发它的那次出手**（同段、紧跟其后），
       形如「长枪兵(我) → 轻骑兵 杀伤 784（轻骑兵反击 杀伤 374）」。
       宿主判定：counter.targetId === 出手者 id（键带阵营，同名兵种互射不串台）。 */
    roundsLog.forEach(function (rr) {
      var at = [], hostOf = {}, open = {};
      rr.events.forEach(function (e) {
        if (e.kind === 'attack') {
          at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = at.length - 1;
        } else if (e.kind === 'wall') {
          at.push(e.name + ' → ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
        } else if (e.kind === 'counter') {
          var hi = hostOf[(e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId];
          var piece = e.name + '反击 杀伤 ' + U.numText(e.kill, 0);
          if (hi != null) {
            at[hi] += (open[hi] ? '，' : '（') + piece;
            open[hi] = true;
          } else {
            /* 兜底：找不到那次出手（异常数据）→ 才独立成段 */
            at.push(e.name + (e.side === 'atk' ? '(我)' : '(敌)') + ' 反击 ' + e.target + ' 杀伤 ' + U.numText(e.kill, 0));
          }
        } else if (e.kind === 'tower') {
          /* v59：拆箭塔 —— 原版战报写作"[守]箭塔6666-272=6394" */
          at.push(e.name + '(我) 攻箭塔，摧毁 ' + e.destroy + ' 座（余 ' + e.left + ' / ' + e.total + '）');
        }
      });
      Object.keys(open).forEach(function (k) { if (open[k]) at[k] += '）'; });
      log.push('第 ' + rr.r + ' 回合：' + (at.length ? at.join('；')
        : '两军推进（间距 ' + U.numText(Math.max(0, rr.gap), 0) + '）'));
    });

'''
apply_slice(p, i0, i1, NEW_A, '① tactic.js 纪要配对')

# ================================================================
# ② ui.js —— ui.btRoundLines
# ================================================================
p = R + 'js/ui.js'
s = load('js/ui.js')
MARK_B = "  /* ============================================================\n   * v89.117（老板需求 7）：「每回合一行太紧凑"
i0 = s.index(MARK_B)
i1 = s.index("\n  };\n", i0) + len("\n  };")
old_seg = s[i0:i1]
assert 'ui.btRoundLines = function' in old_seg, '锚点错（不是 btRoundLines）'
assert 'indent: Math.min(5, i) * 14' in old_seg
assert old_seg.count("e.kind === 'counter'") == 1

NEW_B = '''  /* ============================================================
   * v89.117（老板需求 7）：「每回合一行太紧凑，可以每兵种各一行，兵种的移动、
   *   战斗动作放在同一行，根据出手时间先后，行数错开；不同回合之间虚线间隔」
   * v89.119（老板）：「反击应该在敌方出手后，而不是己方移动后直接反击…
   *   我方移动，出手，对方反击（如有）；对方移动，出手，我方相应反击（如有）。
   *   反击和对方出手记录在同一行」
   * ------------------------------------------------------------
   * 唯一出口：本函数返回**结构化行**（side / name / txt / indent / cls），
   * 界面按它落 DOM，断言直接读返回值（不必赌 DOM）。
   *   · 分组键 = `side|兵种id`（引擎事件里带 id，见 tactic.js 的 events.push）；
   *   · **反击不再自建行** —— 并入"引发它的那次出手"（同一行、紧跟其后）：
   *     `进 30 · → 轻骑兵 歼 784（轻骑兵反击 歼 374）`；
   *   · **出手顺序** = 该兵种在本回合事件流里**首次出现**的下标（这就是引擎的结算顺序）；
   *   · 错开 = 按该下标递进缩进（每级 14px，最多 5 级 —— 再多就贴到右边缘了）。
   * ============================================================ */
  ui.btRoundLines = function (r, snap) {
    var evs = (r && r.events) || [];
    var foeName = {};
    ((snap && snap.atk) || []).forEach(function (u) { foeName[u.id] = u.name; });
    ((snap && snap.def) || []).forEach(function (u) { foeName[u.id] = u.name; });
    var order = [], by = {}, hostOf = {};
    function rowOf(side, id, name) {
      var key = side + '|' + (id == null ? (name || '_') : id);
      if (!by[key]) {
        by[key] = { side: side, id: id, name: name, moves: [], acts: [] };
        order.push(key);
      }
      return { key: key, g: by[key] };
    }
    evs.forEach(function (e) {
      if (!e || e.side == null) return;
      if (e.kind === 'counter') {
        /* 宿主键 = **对面阵营 + 出手者 id**（同名兵种互射也不串台） */
        var hKey = (e.side === 'atk' ? 'def' : 'atk') + '|' +
          (e.targetId == null ? (e.target || '_') : e.targetId);
        var host = hostOf[hKey];
        if (host) host.counters.push({ name: e.name, kill: e.kill });
        else {
          /* 兜底：找不到引发它的那次出手（异常数据）→ 独立成格，不静默丢事件 */
          var fr = rowOf(e.side, e.id, e.name);
          fr.g.acts.push({ txt: '反击 → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0) });
        }
        return;
      }
      var row = rowOf(e.side, e.id, e.name), g = row.g;
      if (e.kind === 'move') g.moves.push('进 ' + U.numText(e.step, 0));
      else if (e.kind === 'retreat') g.moves.push('退 ' + U.numText(e.step, 0));
      else if (e.kind === 'attack') {
        var act = { target: (e.target || foeName[e.targetId] || '敌'), kill: e.kill, counters: [] };
        g.acts.push(act);
        hostOf[row.key] = act;
      } else if (e.kind === 'tower') {
        g.acts.push({ txt: '拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）' });
      } else if (e.kind === 'wall') {
        g.name = '城头箭塔';
        g.moves.push('→ ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      } else if (e.kind === 'duel') {
        g.acts.push({ txt: '斗将：' + (e.txt || (e.win ? '胜' : '负')) });
      }
    });
    return order.map(function (key, i) {
      var g = by[key];
      var bits = g.moves.slice();
      g.acts.forEach(function (a) {
        if (a.txt != null) { bits.push(a.txt); return; }
        var s = '→ ' + a.target + ' 歼 ' + U.numText(a.kill, 0);
        if (a.counters && a.counters.length) {
          s += '（' + a.counters.map(function (c) {
            return c.name + '反击 歼 ' + U.numText(c.kill, 0);
          }).join('，') + '）';
        }
        bits.push(s);
      });
      return {
        side: g.side,
        cls: g.side === 'atk' ? 'atk' : 'def',
        name: g.name || '—',
        txt: '[' + (g.side === 'atk' ? '我' : '敌') + '] ' + (g.name || '—') + '　' +
          (bits.length ? bits.join(' · ') : '待命'),
        indent: Math.min(5, i) * 14,
      };
    });
  };
'''
apply_slice(p, i0, i1, NEW_B, '② ui.js btRoundLines 配对')

# ================================================================
# ③ battle.js —— replayFramesOf 的 evLine
# ================================================================
p = R + 'js/battle.js'
s = load('js/battle.js')
MARK_C = "    function evLine(rr) {"
i0 = s.index(MARK_C)
i1 = s.index("\n    }\n", i0) + len("\n    }")
old_seg = s[i0:i1]
assert 'parts.length >= 3' in old_seg and "e.kind === 'counter'" in old_seg, '锚点错（不是 evLine）'

NEW_C = '''    function evLine(rr) {
      var parts = [], hostOf = {};
      /* v89.119（老板「反击应该在敌方出手后…反击和对方出手记录在同一行」）：
         反击并入**引发它的那次出手**同一段，口径与回合记录/战报纪要一致
         （唯一配对规则：counter.targetId === 该出手的 id，且阵营相反）。 */
      (rr.events || []).forEach(function (e) {
        if (parts.length >= 3) return;
        if (e.kind === 'attack') {
          parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '→' + (e.target || '')
            + ' 杀 ' + U.numText(e.kill || 0, 0));
          if (e.id != null) hostOf[(e.side === 'atk' ? 'a' : 'd') + '|' + e.id] = parts.length - 1;
        } else if (e.kind === 'counter') {
          var hk = (e.side === 'atk' ? 'd' : 'a') + '|' + e.targetId;
          var hi = hostOf[hk];
          if (hi != null) parts[hi] += '（' + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';
          else parts.push((e.side === 'atk' ? '我' : '敌') + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0));
        } else if (e.kind === 'tower') {
          parts.push('破塔 ' + (e.destroy || 0) + ' 座（余 ' + (e.left || 0) + '）');
        } else if (e.kind === 'wall') {
          parts.push('城头→' + (e.target || '') + ' 杀 ' + U.numText(e.kill || 0, 0));
        }
      });'''
apply_slice(p, i0, i1, NEW_C, '③ battle.js evLine 配对')

# ================================================================
# 落盘（原子 + 自检）
# ================================================================
print('\n落盘：')
for p, s in files.items():
    if '<<<<<<<' in s or '>>>>>>>' in s:
        print('!! 冲突标记残留：%s → 中止' % p)
        sys.exit(1)
    bak = BAK + os.path.basename(p)
    assert os.path.exists(bak), ('缺备份 ' + bak)
    b = io.open(bak, encoding='utf-8').read()
    d_file = seg_pair_count(s) - seg_pair_count(b)
    print('  → %s（相对备份净 { } = %+d）' % (os.path.basename(p), d_file))
    tmp = p + '.tmp119a'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
print('补丁 A 完成')

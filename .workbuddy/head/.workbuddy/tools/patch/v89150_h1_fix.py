# -*- coding: utf-8 -*-
# v89.150 收尾：战斗清单目标名解析 + 收获拆行改「括号感知」
import io, re


def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in segs:
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)


patch('E:/Deepseekdb/js/ui.js', [
# ---------- ① 战斗清单：目标名走 resolveTarget（rec.target 只有 kind/x/y） ----------
("""  ui.battleListRowsHTML = function (list) {
    return (list || []).map(function (b) {
      var t = b.target || {};
      var mode = (GAME.battle && GAME.battle.modeOf) ? GAME.battle.modeOf(b.modeId) : null;
      var type = (b.side === 'def') ? '守城' : (((mode || {}).name) || '战斗');
      return '<tr>' +
        '<td>' + U.escape(t.name || '（未知目标）') + '</td>' +""",
 """  /* 目标名：`rec.target` 存的是**原始目标**（`{kind:'wild',x,y}` —— 没有 name），
     名字要经 `GAME.battle.resolveTarget` 解析（与出征面板/预估**同一出口**，
     §18.2 的老规矩：界面读数一律用解析后的对象）。 */
  ui.battleListNameOf = function (t) {
    if (!t) return '（未知目标）';
    if (t.name) return t.name;
    try {
      var rt = (GAME.battle && GAME.battle.resolveTarget) ? GAME.battle.resolveTarget(t) : null;
      if (rt && rt.name) return rt.name;
    } catch (e) { /* 目标已不存在（被占/被拔）→ 落兜底 */ }
    return '（目标已变更）';
  };
  ui.battleListRowsHTML = function (list) {
    return (list || []).map(function (b) {
      var t = b.target || {};
      var mode = (GAME.battle && GAME.battle.modeOf) ? GAME.battle.modeOf(b.modeId) : null;
      var type = (b.side === 'def') ? '守城' : (((mode || {}).name) || '战斗');
      return '<tr>' +
        '<td>' + U.escape(ui.battleListNameOf(t)) + '</td>' +""",
 '① 清单目标名'),

# ---------- ② 收获拆行改「括号感知」 ----------
("""        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行" */
          rest.split('；').forEach(function (x) { if (String(x).trim()) out.gain.push(String(x).trim()); });
        } else if (cur === 'loss') {""",
 """        if (cur === 'gain') {
          /* battle.js 把多条战利品用「；」拼在一行 → 拆成多行，才能"分类分行"。
             ⚠️ 必须**括号感知**：单条内部也有「；」（如"（已入许都府库；随军载重 …）"）——
             裸 split 会把一条劈成两半（第二半变成无类别的孤儿行）。 */
          ui.reportSplitSemi(rest).forEach(function (x) {
            if (String(x).trim()) out.gain.push(String(x).trim());
          });
        } else if (cur === 'loss') {""",
 '②-a 收获拆行调用'),

("""  ui.reportLinesHTML = function (lines, cls) {""",
 """  /* 「；」拆行（**括号深度感知**）：只在括号外断开 —— lootLines.join('；') 拼的行里，
     单条内部还嵌着「（…；…）」，裸 split 会把一条劈两半。 */
  ui.reportSplitSemi = function (t) {
    var out = [], cur = '', depth = 0;
    String(t || '').split('').forEach(function (ch) {
      if (ch === '（' || ch === '(') depth++;
      else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
      if (ch === '；' && depth === 0) { if (cur.trim()) out.push(cur); cur = ''; return; }
      cur += ch;
    });
    if (cur.trim()) out.push(cur);
    return out;
  };
  ui.reportLinesHTML = function (lines, cls) {""",
 '②-b reportSplitSemi 出口'),
])

# ---------- ③ §130⑤ 加"目标名不是未知"判据 ----------
patch('E:/Deepseekdb/smoke-test.js', [
("""        var okList = G.ui.battleListOf().length === 2
          && (html.match(/data-action="bt-open"/g) || []).length === 2
          && html.indexOf('守城') >= 0 && html.indexOf('掠夺') >= 0 && html.indexOf('旧仗') < 0;""",
 """        var okList = G.ui.battleListOf().length === 2
          && (html.match(/data-action="bt-open"/g) || []).length === 2
          && html.indexOf('守城') >= 0 && html.indexOf('掠夺') >= 0 && html.indexOf('旧仗') < 0
          /* 目标名走 resolveTarget（rec.target 只有 kind/x/y —— 漏解析会显示"（未知目标）"） */
          && /ui\\.battleListNameOf = function/.test(u130)
          && html.indexOf('荒野·甲') >= 0;""",
 '③ §130⑤ 目标名判据'),
])

print('ALL OK')

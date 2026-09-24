# -*- coding: utf-8 -*-
"""v89.117 补丁 G —— 战斗界面再压缩 + 阵亡变暗 + 逐兵种回合行（老板需求 7）

老板令：「战斗界面再压缩，左右分别六分之一作为兵种设置区域，让中间战斗界面尽量大。
          兵种数量降为0（该兵种被消灭后），战场上的兵种图标变暗。
          下方回合记录中，目前分左右侧记录敌我，这个设定不错，但是每回合一行太紧凑，
          可以每兵种各一行，兵种的移动，战斗动作放在同一行，根据出手时间先后，
          行数错开；不同回合之间虚线间隔」

改法：
  · `.bt-board` 1fr:2fr:1fr → **1fr:4fr:1fr**（左右各 1/6、中间 2/3）；
  · 战场令牌 `count<=0` → `.bt-unit.dead`（变暗 + 去饱和），列表侧同步（已有 .dead）；
  · 回合播报重构：虚线分隔 → 回合头 → **逐兵种一行**（移动与战斗同行），
    按事件在引擎里的**出手顺序**递进缩进；唯一出口 `ui.btRoundLines`（返回结构化行，
    界面与断言共读，不必赌 DOM）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点匹配 %d 次' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


load('js/ui.js')
load('index.html')

# ================================================================ G1: 三列 1:4:1
edit('index.html', """  .bt-board { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: var(--sp-3); align-items: start; }""",
     """  /* v89.117（老板「左右分别六分之一作为兵种设置区域，让中间战斗界面尽量大」）：
     1fr : 4fr : 1fr = 1/6 : 2/3 : 1/6（原先 1:2:1 = 各 1/4、中间 1/2）。 */
  .bt-board { display: grid; grid-template-columns: 1fr 4fr 1fr; gap: var(--sp-2); align-items: start; }""",
     'G1：三列配比')

# ================================================================ G2: 战场令牌变暗
edit('js/ui.js', """    function uHTML(u, idx, side) {
      return '<div class="bt-unit ' + side + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'title="' + U.escape(u.name) + '" ' +""",
     """    function uHTML(u, idx, side) {
      /* v89.117（老板「兵种数量降为 0（该兵种被消灭后），战场上的兵种图标变暗」）：
         初绘就带 dead（后台推进时可能"没动过就全灭"），后续由 btSyncCounts 增删。 */
      return '<div class="bt-unit ' + side + (u.count > 0 ? '' : ' dead') + '" data-bside="' + side + '" data-troop="' + u.id + '" ' +
        'title="' + U.escape(u.name) + '" ' +""",
     'G2：初绘 dead')

edit('js/ui.js', """        var row = document.querySelector('#bt-board [data-row="' + pair[0] + '-' + u.id + '"]');
        if (row && row.classList) row.classList.toggle('dead', !(u.count > 0));""",
     """        var row = document.querySelector('#bt-board [data-row="' + pair[0] + '-' + u.id + '"]');
        if (row && row.classList) row.classList.toggle('dead', !(u.count > 0));
        /* v89.117：**战场上那枚令牌**同样变暗（此前只暗列表行，场上还是亮的） */
        var fu = document.querySelector('#bt-field [data-bside="' + pair[0] + '"][data-troop="' + u.id + '"]');
        if (fu && fu.classList) fu.classList.toggle('dead', !(u.count > 0));""",
     'G2：同步 dead')

edit('index.html', """  @keyframes btHit { 0%, 100% { filter: none; } 40% { filter: brightness(1.9) saturate(1.6); } }""",
     """  @keyframes btHit { 0%, 100% { filter: none; } 40% { filter: brightness(1.9) saturate(1.6); } }
  /* v89.117：被歼灭的兵种在**战场上**变暗（与两侧列表的 .bt-rrow.dead 同一语义） */
  .bt-unit.dead { opacity: .26; filter: grayscale(.85); }
  .bt-unit.dead .bt-ico { filter: grayscale(1) brightness(.7); }""",
     'G2：CSS dead')

# ================================================================ G3: 回合播报逐兵种一行
edit('js/ui.js', """  /* ---- 一回合一行：行动 + 战果（老板：「行动和战果写在同一行」）----
     结构：第 N 回合　[我] 动作…　→ 战果…　｜　[敌] 动作…　→ 战果…
     同一兵种的"前进"合并成一条；"攻击"合并成"X → Y 歼 N"；
     一回合一行 = 30 回合也只看 30 行（旧版一回合十几行）。 */
  ui.btRoundLine = function (r, snap) {
    var evs = (r && r.events) || [];
    function sideTxt(side) {
      var move = [], atk = [], hurt = [];
      var foeName = {};
      ((side === 'atk' ? (snap && snap.def) : (snap && snap.atk)) || []).forEach(function (u) { foeName[u.id] = u.name; });
      evs.forEach(function (e) {
        if (e.side !== side) return;
        if (e.kind === 'move') move.push(e.name + ' 进 ' + U.numText(e.step, 0));
        else if (e.kind === 'retreat') move.push(e.name + ' 退 ' + U.numText(e.step, 0));
        else if (e.kind === 'attack' || e.kind === 'counter') {
          atk.push(e.name + ' → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0));
        } else if (e.kind === 'tower') atk.push(e.name + ' 拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）');
        else if (e.kind === 'wall') hurt.push('城头 → ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      });
      var bits = move.concat(atk, hurt);
      return bits.length ? bits.join(' · ') : '待命';
    }
    var line = '第 ' + ((r && r.r) || 0) + ' 回合　[我] ' + sideTxt('atk') + '　｜　[敌] ' + sideTxt('def')
      + '　·　间距 ' + U.numText((r && r.gap) || 0, 0);
    ui.btLogPush(line, 'round');
    return line;                              /* 返回文本：调用方/断言可直接读（不必赌 DOM） */
  };""",
     """  /* ============================================================
   * v89.117（老板需求 7）：「每回合一行太紧凑，可以每兵种各一行，兵种的移动、
   *   战斗动作放在同一行，根据出手时间先后，行数错开；不同回合之间虚线间隔」
   * ------------------------------------------------------------
   * 唯一出口：本函数返回**结构化行**（side / name / txt / indent / cls），
   * 界面按它落 DOM，断言直接读返回值（不必赌 DOM）。
   *   · 分组键 = `side|兵种id`（引擎事件里带 id，见 tactic.js 的 events.push）；
   *   · **出手顺序** = 该兵种在本回合事件流里**首次出现**的下标（这就是引擎的结算顺序）；
   *   · 错开 = 按该下标递进缩进（每级 14px，最多 5 级 —— 再多就贴到右边缘了）；
   *   · 移动与战斗同一行：`长枪兵 ×1200　进 60 · → 刀盾兵 歼 340`。
   * ============================================================ */
  ui.btRoundLines = function (r, snap) {
    var evs = (r && r.events) || [];
    var foeName = {};
    ((snap && snap.atk) || []).forEach(function (u) { foeName[u.id] = u.name; });
    ((snap && snap.def) || []).forEach(function (u) { foeName[u.id] = u.name; });
    var order = [], by = {};
    evs.forEach(function (e) {
      if (!e || e.side == null) return;
      var key = e.side + '|' + (e.id == null ? (e.name || '_') : e.id);
      if (!by[key]) {
        by[key] = { side: e.side, id: e.id, name: e.name, moves: [], acts: [] };
        order.push(key);
      }
      var g = by[key];
      if (e.kind === 'move') g.moves.push('进 ' + U.numText(e.step, 0));
      else if (e.kind === 'retreat') g.moves.push('退 ' + U.numText(e.step, 0));
      else if (e.kind === 'attack') g.acts.push('→ ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0));
      else if (e.kind === 'counter') g.acts.push('反击 → ' + (e.target || foeName[e.targetId] || '敌') + ' 歼 ' + U.numText(e.kill, 0));
      else if (e.kind === 'tower') g.acts.push('拆箭塔 ' + U.numText(e.destroy, 0) + '（余 ' + U.numText(e.left, 0) + '）');
      else if (e.kind === 'wall') {
        g.name = '城头箭塔';
        g.moves.push('→ ' + (e.target || '我军') + ' 歼 ' + U.numText(e.kill, 0));
      } else if (e.kind === 'duel') {
        g.acts.push('斗将：' + (e.txt || (e.win ? '胜' : '负')));
      }
    });
    return order.map(function (key, i) {
      var g = by[key];
      var bits = g.moves.concat(g.acts);
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
  /* 兼容出口：旧调用点（ui.btPlay）读的是这一个 —— 现在它落**多行**并返回同样的文本数组 */
  ui.btRoundLine = function (r, snap) {
    var lines = ui.btRoundLines(r, snap);
    ui.btLogPush('', 'sep');                                  /* 回合之间：虚线间隔 */
    ui.btLogPush('第 ' + ((r && r.r) || 0) + ' 回合　·　间距 ' + U.numText((r && r.gap) || 0, 0), 'hdr');
    lines.forEach(function (L) { ui.btLogPush(L.txt, L.cls, L.indent); });
    if (!lines.length) ui.btLogPush('[我] 待命　　[敌] 待命', 'atk', 0);
    return lines.map(function (L) { return L.txt; });         /* 数组：调用方/断言可直接读 */
  };""",
     'G3：逐兵种回合行')

edit('js/ui.js', """  ui.btLogPush = function (line, cls) {
    var log = document.getElementById('bt-log');
    /* ⚠️ 测试桩的 DOM 可能给一个"没有 children"的壳元素 —— 逐项判能力再动手 */
    if (!log || !line || !log.appendChild) return;
    var d = document.createElement('div');
    d.className = 'bt-ev ' + (cls || 'round');
    d.textContent = line;
    log.appendChild(d);
    var kids = log.children;
    if (kids && typeof kids.length === 'number') {
      while (kids.length > 12 && log.firstChild) log.removeChild(log.firstChild);
    }
    if (typeof log.scrollTop === 'number') log.scrollTop = log.scrollHeight;
  };""",
     """  ui.btLogPush = function (line, cls, indent) {
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
     'G3：btLogPush 支持缩进')

edit('index.html', """  .bt-log { max-height: 150px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-body);
    margin-top: var(--sp-3); }
  .bt-ev.round { color: var(--parchment); }""",
     """  /* v89.117（老板需求 7）：播报窗改**逐兵种一行**（移动与战斗同行、按出手序错开），
     回合之间虚线间隔。高度 150 → 196px（每回合多行，得看得见两个回合）。 */
  .bt-log { max-height: 196px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: var(--r-lg); padding: var(--sp-2) var(--sp-4); font-size: var(--fs-sub); line-height: var(--lh-body);
    margin-top: var(--sp-2); }
  .bt-ev.round { color: var(--parchment); }
  /* 回合之间的**虚线间隔**（老板原话「不同回合之间虚线间隔」） */
  .bt-ev.sep { height: 0; border-top: 1px dashed rgba(var(--gold-soft-rgb), .38); margin: var(--sp-2) 0; }
  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  .bt-ev.atk { color: var(--parchment); font-variant-numeric: tabular-nums; }
  .bt-ev.def { color: var(--red-light); font-variant-numeric: tabular-nums; }
  /* 回合之间的**虚线间隔**（老板原话「不同回合之间虚线间隔」） */
  .bt-ev.sep { height: 0; border-top: 1px dashed rgba(var(--gold-soft-rgb), .38); margin: var(--sp-2) 0; }
  /* 回合头（第 N 回合 · 间距） */
  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  /* 逐兵种行：我方暖白 / 敌方红 —— 与两侧列表的语义色一致 */
  .bt-ev.atk { color: var(--parchment); font-variant-numeric: tabular-nums; }
  .bt-ev.def { color: var(--red-light); font-variant-numeric: tabular-nums; }""",
     'G3：播报窗 CSS')

for p, s in files.items():
    assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
    tmp = R + p + '.tmp117i'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 G 完成')

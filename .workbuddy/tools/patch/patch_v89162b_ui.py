# -*- coding: utf-8 -*-
"""v89.162 补丁 B（界面）：
  ① ui.js · GEN_DIMS 内政行的 mayorUse 加"税收 +X%"（将领详情六维悬停）
  ② ui.js · 城池面板城主行加悬停（全部加成一眼可见）
  ③ ui.js · 防御体检帮助文案「内政→产量/建造」→ 加/税收
  ④ ui.js · genPane 注释同步（防注释误导后人）
"""
import io

R = 'E:/Deepseekdb/'
LOG = []

def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, guard=None):
    s = rd(path)
    g = guard if guard is not None else new
    if g in s:
        LOG.append('  [skip] %s（新内容已在）' % tag)
        return
    c = s.count(old)
    assert c == 1, '%s 锚点数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(path, s)
    LOG.append('  [ ok ] %s' % tag)

# ══════════ ① GEN_DIMS 内政行 mayorUse 加税收 ══════════
rep('js/ui.js', 'ui · GEN_DIMS 内政 mayorUse 加税收',
"""    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      /* v89.113：内政的经营项归**城主**（产量/建造） */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.prod) p2.push('产量 +' + Math.round(mb.prod * 100) + '%');
        if (mb.build) p2.push('建造 +' + Math.round(mb.build * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },""",
"""    { k: 'nz', n: '内政', color: '#7fa85a', use: '本城产量 +1%',
      /* v89.113：内政的经营项归**城主**（产量/建造）
         v89.162（老板「内政对税收也应有加成」）：第三处落点 —— **税收**。 */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.prod) p2.push('产量 +' + Math.round(mb.prod * 100) + '%');
        if (mb.build) p2.push('建造 +' + Math.round(mb.build * 100) + '%');
        if (mb.tax) p2.push('税收 +' + Math.round(mb.tax * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },""")

# ══════════ ② 城池面板城主行（悬停给全部加成） ══════════
rep('js/ui.js', 'ui · 城池面板城主行加悬停',
"""          '<div class="attr"><span class="k">📜 城主</span><span class="v">' +
            (mayor ? U.escape(mayor.name) + ' Lv' + mayor.level
                   + '　<span class="ui-sub">内政·智谋</span>' : '<span class="ui-sub">未任命（内政/智谋加成为零）</span>') + '</span></div>' +""",
"""          '<div class="attr"><span class="k">📜 城主</span><span class="v">' +
            (mayor ? (function () {
              /* v89.162（老板「列举城主的六维加成」）：悬停给出城主**全部**加成
                 （内政→产量/建造/税收 · 智谋→研究/城防），小字保持一行不撑版面。 */
              var mbC = GAME.mayorBonus(city);
              var tipC = '内政 → 产量 +' + Math.round(mbC.prod * 100) + '% · 建造 +'
                + Math.round(mbC.build * 100) + '% · 税收 +' + Math.round(mbC.tax * 100) + '%'
                + '\\n智谋 → 研究 +' + Math.round(mbC.research * 100) + '% · 城防 +'
                + Math.round(mbC.def * 100) + '%';
              return U.escape(mayor.name) + ' Lv' + mayor.level
                + '　<span class="ui-sub" title="' + U.escape(tipC) + '">内政·智谋</span>';
            })() : '<span class="ui-sub">未任命（内政/智谋加成为零）</span>') + '</span></div>' +""")

# ══════════ ③ 防御体检帮助文案 ══════════
rep('js/ui.js', 'ui · 防御体检帮助文案加税收',
"""        + '城主（文治）= 内政→产量/建造、智谋→研究/城防；守将（武功）= 勇武→征兵、战时对阵。\\n'""",
"""        + '城主（文治）= 内政→产量/建造/税收、智谋→研究/城防；守将（武功）= 勇武→征兵、战时对阵。\\n'""")

# ══════════ ④ genPane 注释同步 ══════════
rep('js/ui.js', 'ui · genPane 注释同步（内政→产量/建造/税收）',
"""       守将加成本来就出自六维（内政→产量/建造、勇武→征兵、智谋→研究/城防），""",
"""       守将加成本来就出自六维（内政→产量/建造/税收、勇武→征兵、智谋→研究/城防），""")

print('\n'.join(LOG))
print('补丁 B 完成')

# -*- coding: utf-8 -*-
"""v89.137 补丁 E：ui.js（批一）—— 建筑专精文案/三档显示 + 官府要务段（主城常显 / 删全境营造 / 规格统一）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'js', 'ui.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)
ok = []

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次（须为 1）' % (tag, s.count(old)))
        sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

# ══════════ 1. 官府要务段：主城常显 + 删全境营造总览 + 规格/图标统一 ══════════
rep(
"""      guanfuBox = '<div class="op-zone"><div class="op-zone-t">官府要务</div>' +
        '<div class="op-row" style="flex-wrap:wrap;">' +
          '<button class="btn sm' + (rn135.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
            (rn135.ok ? '' : ' disabled') + ' title="' +
            U.escape(rn135.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn135.msg) +
            '">✎ 修改城名</button>' +
          (isMain135 ? '' :
            '<button class="btn sm" data-action="set-main-city" title="' +
            U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
              + (GAME.mainCityOf()
                  ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                  : '　（首设免费）')) +
            '">设为主城</button>') +
          '<button class="btn gold" data-action="open-farm"' +
            ' title="种田秘境：个人田庄灵田种灵植，收高阶打造材料与资质灵草">🌾 种田秘境</button>' +
          '<button class="btn sm" data-action="open-build-ov" title="跨城摊平所有在办工程，可逐条或一键花金提速">🏗 全境营造总览</button>' +
        '</div>' +""",
"""      /* v89.137（老板 4）：「官府怎么没有设定主城的选项。不要全境营造总览，重复。
         图标大小规格不一样」——
         ① 主城入口**常显**：不再是"已是主城就整条撤掉"（那会让玩家在主城上看不到
            任何"主城"字样、以为没这功能）—— 已是主城 → 状态标记 + 悬停写明迁都方法；
         ② 「全境营造总览」整条退役（`ui.openBuildOverview` / `GAME.buildOverview` /
            `GAME.rushAllBuilds` / 三个动作 case 一并删，防死代码）——老板判定与
            各建筑面板的提速重复；
         ③ 规格统一：四个按钮全部 `btn sm`（原先"种田秘境"用 btn gold = 36 高 / 14px 字，
            其余 26 高 / 12px —— 老板实测的"图标大小规格不一样"），
            图标统一 emoji 族（📝 / 🏛 / 🌾），不再混用 ✎（dingbat）与彩色 emoji。 */
      guanfuBox = '<div class="op-zone"><div class="op-zone-t">官府要务</div>' +
        '<div class="op-row" style="flex-wrap:wrap;">' +
          '<button class="btn sm' + (rn135.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
            (rn135.ok ? '' : ' disabled') + ' title="' +
            U.escape(rn135.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn135.msg) +
            '">📝 修改城名</button>' +
          (isMain135
            ? '<span class="btn sm dim main-here" title="' +
              U.escape('本城即主城。主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + '　（迁都：到目标城的官府点「设为主城」，需 '
                + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）') +
              '">🏛 本城即主城</span>'
            : '<button class="btn sm gold" data-action="set-main-city" title="' +
              U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
                + (GAME.mainCityOf()
                    ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                    : '　（首设免费）')) +
              '">🏛 设为主城</button>') +
          '<button class="btn sm gold" data-action="open-farm"' +
            ' title="种田秘境：个人田庄灵田种灵植，收高阶打造材料与资质灵草">🌾 种田秘境</button>' +
        '</div>' +""",
'官府要务段')

# ══════════ 2. 建筑面板：专精行 → 三档进度 ══════════
rep(
"""      /* v60（需求 3）：**满级专精写在这里**（老板：「写在对应建筑的介绍里就好，
         不要写在全境汇总」）。数据驱动 —— 本建筑在 DATA.MASTERY 里有条目就显示，
         未满级报"目标"、已满级报"已达成"。
         不逐个建筑手写文案：那又是一份平行数据，改一处忘一处。 */
      var mast = null;
      (DATA.MASTERY || []).forEach(function (m) { if (m.bid === b.id) mast = m; });
      if (mast) {
        var gotM = GAME.masteryOf(c, b.id);
        extra += '<div class="attr"><span class="k">满级专精</span><span class="v' + (gotM ? ' good' : '') + '">'
          + (gotM ? '已达成 · ' : 'Lv' + DATA.MAX_BLEVEL + ' 达成 · ') + mast.txt + '</span></div>';
      }""",
"""      /* v60（需求 3）：**满级专精写在这里**（老板：「写在对应建筑的介绍里就好，
         不要写在全境汇总」）。数据驱动 —— 本建筑在 DATA.MASTERY 里有条目就显示。
         v89.137（老板 5）：三档（12/24/36）—— 显示逐档进度与"当前 ×N / 下一档"，
         门槛与档数全读 DATA.MASTERY_TIERS / GAME.masteryTierOf（不手抄）。
         不逐个建筑手写文案：那又是一份平行数据，改一处忘一处。 */
      var mast = null;
      (DATA.MASTERY || []).forEach(function (m) { if (m.bid === b.id) mast = m; });
      if (mast) {
        var tiers137 = DATA.MASTERY_TIERS || [DATA.MAX_BLEVEL];
        var t137 = GAME.masteryTierOf(c, b.id);
        var prog137 = tiers137.map(function (t, i) {
          return 'Lv' + t + (t137 > i ? ' <b style="color:var(--green-ok);">✓</b>' : '');
        }).join(' → ');
        extra += '<div class="attr"><span class="k">建筑专精</span><span class="v' + (t137 > 0 ? ' good' : '') + '">'
          + prog137 + '　·　'
          + (t137 > 0 ? ('当前 <b>×' + t137 + '</b>：' + mast.txt) : ('Lv' + tiers137[0] + ' 起：' + mast.txt))
          + (t137 < tiers137.length
              ? '<span style="color:var(--text-dim);">（下一档 Lv' + tiers137[t137] + ' → ×' + (t137 + 1) + '）</span>'
              : '<span style="color:var(--text-dim);">（已满档 ×' + tiers137.length + '）</span>')
          + '</span></div>';
      }""",
'建筑面板三档')

# ══════════ 3. 招贤馆面板：档位口径 ══════════
rep(
"""    var mp = GAME.masteryOf ? GAME.masteryOf(c, 'zhaoxianguan') : false;""",
"""    var mTier137 = GAME.masteryTierOf ? GAME.masteryTierOf(c, 'zhaoxianguan') : 0;   /* v89.137：三档 */""",
'招贤馆-1')
rep(
"""      (mp ? '<div class="attr"><span class="k">满级专精</span><span class="v good">房间 +2</span></div>' : '') +""",
"""      (mTier137 > 0
        ? '<div class="attr"><span class="k">建筑专精</span><span class="v good">房间 +' + (2 * mTier137)
          + '<span style="color:var(--text-dim);">（每档 +2 · 现 ×' + mTier137 + ' 档）</span></span></div>'
        : '<div class="attr"><span class="k">建筑专精</span><span class="v" style="color:var(--text-dim);">'
          + 'Lv' + ((DATA.MASTERY_TIERS || [12])[0]) + ' 起：房间 +2（每档 +2）</span></div>') +""",
'招贤馆-2')

# ══════════ 4. 其余文案：+满级专精 2 → 每档 +2 ══════════
rep(
"""          '席位**按城算**：每座城的上限 = 该城招贤馆等级（+满级专精 2）；0 级 = 0 席\\n' +""",
"""          '席位**按城算**：每座城的上限 = 该城招贤馆等级（+建筑专精：每档 +2，满三档 +6）；0 级 = 0 席\\n' +""",
'将领页席位说明')
rep(
"""          /* v64：调往的城市必须还有席位居（席位 = 该城招贤馆等级 + 满级专精） */""",
"""          /* v64：调往的城市必须还有席位居（席位 = 该城招贤馆等级 + 建筑专精每档 +2） */""",
'调防-1')
rep(
"""          '<br>席位**按城算**：目标城上限 = 该城招贤馆等级（+满级专精 2）；已满则先升级其招贤馆。' +""",
"""          '<br>席位**按城算**：目标城上限 = 该城招贤馆等级（+建筑专精每档 +2）；已满则先升级其招贤馆。' +""",
'调防-2')

# ══════════ 5. 其余"满级专精"注释更名 ══════════
cnt = s.count('满级专精')
s = s.replace('满级专精', '建筑专精')
ok.append('注释更名×%d' % cnt)

# ══════════ 写盘 + 自检 ══════════
assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)

chk = io.open(p, 'r', encoding='utf-8', newline='').read()
assert '本城即主城' in chk and 'mTier137' in chk, '新段未落盘'
assert 'open-build-ov' not in chk, '官府要务仍引用 open-build-ov'
assert chk.count('{') == chk.count('}'), '花括号不配平 %d/%d' % (chk.count('{'), chk.count('}'))
print('✅ ui.js 批一补丁完成：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))

# -*- coding: utf-8 -*-
"""v89.230 批次 A：产品侧 ——
① 兵牌形态类名同步：.inf/.cav/.siege → walk/ride/craft（domain.js / ui.js / index.html）
② 注释链路清理：main.js 白名单注 · data.js v84/v89.163 注 + 合并去向注（原注被历次改名
   打成了自指：'步行机+步行机→步行机'）· questdata 三注 · AI工作备忘一处
③ JSON 版本号：GAME.VERSION → v89.230
每段 assert count==1；写后由外部跑 node --check。
"""
import io

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

REPORT = []

def rep(path, tag, old, new, cnt=1):
    s = rd(path)
    if new in s and s.count(old) == 0:
        REPORT.append('[skip] %s（已落盘）' % tag)
        return
    c = s.count(old)
    assert c == cnt, '%s count=%d（期望 %d）' % (tag, c, cnt)
    wr(path, s.replace(old, new))
    REPORT.append('[ok] %s' % tag)

# ---------- ① domain.js：troopShapeOf ----------
rep('js/domain.js', 'domain.troopShapeOf',
"""  /* ============================================================
   * v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，
   *   机车比目前稍窄但比步兵宽，如果是器械兵种如无人轰炸机等则维持目前方块大小，
   *   使兵种便于区分」——
   * **兵种形态的唯一出口**（战场兵牌与断言都读它，不各判一份）：
   *   · 'siege' 器械（craft = true：无人轰炸机 / 自行火炮）→ 维持原方块尺寸；
   *   · 'cav'   机车（ride = true —— v89.229 起 cat 退役，改显式字段）→ 比原稍窄、比步兵宽；
   *   · 'inf'   步兵（其余，含板车/侦察单元）→ 窄。
   * 判定只读数据表字段（`ride` / `craft`），不写死 id 名单 —— 以后加兵种自动归类。
   * ============================================================ */
  GAME.troopShapeOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return 'inf';
    if (t.craft) return 'siege';
    if (t.ride) return 'cav';      /* v89.229：cat 退役 → ride 显式字段（机车族） */
    return 'inf';
  };""",
"""  /* ============================================================
   * v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，
   *   机车比目前稍窄但比步兵宽，如果是器械兵种如无人轰炸机等则维持目前方块大小，
   *   使兵种便于区分」——
   * **兵种形态的唯一出口**（战场兵牌与断言都读它，不各判一份）：
   *   · 'craft' 器械（craft = true：无人轰炸机 / 自行火炮）→ 维持原方块尺寸；
   *   · 'ride'  机车（ride = true）→ 比原稍窄、比徒步宽；
   *   · 'walk'  徒步（其余，含板车/侦察单元）→ 窄。
   * 判定只读数据表字段（`ride` / `craft`），不写死 id 名单 —— 以后加兵种自动归类。
   * v89.230：类名随兵种体系同步（原 'inf'/'cav'/'siege' 退役 —— 步兵/骑兵不再区分，
   *   与 CSS 的 .walk/.ride/.craft 三档一一对应）。
   * ============================================================ */
  GAME.troopShapeOf = function (id) {
    var t = DATA.TROOPS[id];
    if (!t) return 'walk';
    if (t.craft) return 'craft';
    if (t.ride) return 'ride';     /* v89.229：cat 退役 → ride 显式字段（机车族） */
    return 'walk';
  };""")

# ---------- ② ui.js：兜底与注释 ----------
rep('js/ui.js', 'ui.sh150',
"""      /* v89.150（老板 1）：兵牌外框按兵种三档（步 / 骑 / 器械）—— 形态走唯一出口
         GAME.troopShapeOf（界面只回显；宽度差由 CSS 的 --u-w 三档实现）。 */
      var _sh150 = (GAME.troopShapeOf ? GAME.troopShapeOf(u.id) : 'inf');""",
"""      /* v89.150（老板 1）：兵牌外框按兵种三档 —— 形态走唯一出口 GAME.troopShapeOf
         （界面只回显；宽度差由 CSS 的 --u-w 三档实现）。
         v89.230：类名同步 —— walk（徒步）/ ride（机车）/ craft（器械）。 */
      var _sh150 = (GAME.troopShapeOf ? GAME.troopShapeOf(u.id) : 'walk');""")

# ---------- ③ index.html：注释 + 三条 CSS ----------
rep('index.html', 'html.shape-comment',
"""  /* v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，机车比目前稍窄但
     比步兵宽，如果是器械兵种如无人轰炸机等则维持目前方块大小，使兵种便于区分」——
     宽度三档（图标 26px **不变**，变的是**框的留白**：窄框贴图标 = 步兵；宽框留白 = 器械）：
       · .inf   步兵（含板车/侦察单元）— 28px（贴边窄框）
       · .cav   机车              — 32px（比改前的 36 稍窄、比步兵宽 4px）
       · .siege 器械（无人轰炸机/自行火炮/自行火炮）— 36px（**维持改前的方块尺寸**）
     形态由 `GAME.troopShapeOf` 判定（唯一出口，读数据表的 cat / craft 字段）。 */""",
"""  /* v89.150（老板 1）：「战场中兵种[周]围的环形框，根据兵种，步兵窄一点，机车比目前稍窄但
     比步兵宽，如果是器械兵种如无人轰炸机等则维持目前方块大小，使兵种便于区分」——
     宽度三档（图标 26px **不变**，变的是**框的留白**：窄框贴图标 = 徒步；宽框留白 = 器械）：
       · .walk  徒步（无 ride/craft，含板车/侦察单元）— 28px（贴边窄框）
       · .ride  机车（ride = true）                 — 32px（比改前的 36 稍窄、比徒步宽 4px）
       · .craft 器械（craft：无人轰炸机/自行火炮）   — 36px（**维持改前的方块尺寸**）
     形态由 `GAME.troopShapeOf` 判定（唯一出口，读数据表的 ride / craft 字段）。
     v89.230：类名随兵种体系同步（原 .inf/.cav/.siege 退役 —— 步兵/骑兵不再区分）。 */""")

rep('index.html', 'html.shape-css',
"""  .bt-unit.inf { --u-w: 28px; }
  .bt-unit.cav { --u-w: 32px; }
  .bt-unit.siege { --u-w: 36px; }""",
"""  .bt-unit.walk { --u-w: 28px; }
  .bt-unit.ride { --u-w: 32px; }
  .bt-unit.craft { --u-w: 36px; }""")

# ---------- ④ main.js：白名单注释 + 版本号 ----------
rep('js/main.js', 'main.tab-comment',
"""      /* v80（老板）：「步兵 / 机车」翻页（±10 退役，数量改直输 —— 见 troopsHTML）；
         v81（老板）：「做成3页，第一页为募兵队列」—— que / inf / cav 三页白名单 */""",
"""      /* v80（老板）：「步兵 / 机车」翻页（±10 退役，数量改直输 —— 见 troopsHTML）；
         v81（老板）：「做成3页，第一页为募兵队列」；v89.229 兵种重构：分页改
         **que / g1 / g2 / g3** 四页（募兵队列 + 三组）—— 白名单见下 */""")

rep('js/main.js', 'main.version', "  GAME.VERSION = 'v89.229';", "  GAME.VERSION = 'v89.230';")

# ---------- ⑤ data.js：三处注释 ----------
rep('js/data.js', 'data.v84-note',
"""  /* v84（老板）：「运输平台是机车吧，侦察单元是步兵」——
     cat 只决定**募兵分页归属**（inf → 步兵页 / cav → 机车页），与战场定位无关：
     侦察单元（侦察）归步兵页，运输平台（后勤货运）归机车页。 */""",
"""  /* v84（老板）：「运输平台是机车吧，侦察单元是步兵」——
     cat 只决定**募兵分页归属**（inf → 步兵页 / cav → 机车页），与战场定位无关：
     侦察单元（侦察）归步兵页，运输平台（后勤货运）归机车页。
     ⛔ v89.229 兵种重构：`cat` 字段退役 —— 分页改读 `grp`（1/2/3）；
     本段为当时沿革（侦察单元 / 运输平台现同归组 1 后勤支援）。 */""")

rep('js/data.js', 'data.map-note',
"""     其中兵种名（重弩车/王牌战车/长枪手…）为当时称谓，现行 id/名映射见 DATA.STROOPS 注释。 */""",
"""     其中兵种名（重弩车/王牌战车/长枪手…）为当时称谓，
     现行 id/名映射见 `GAME.TROOP_MAP_229`（state.js）与 TROOPS 表头注释。 */""")

rep('js/data.js', 'data.time163-note',
"""   * v89.163 按**原排序**压缩并取整到 5 秒：步兵（cat:'inf'）全部 ≤ 60（1 分钟）、
   * 机车（cat:'cav'，含运输车/变异巨兽）全部 ≤ 300（5 分钟）。""",
"""   * v89.163 按**原排序**压缩并取整到 5 秒：步兵（cat:'inf'）全部 ≤ 60（1 分钟）、
   * 机车（cat:'cav'，含运输车/变异巨兽）全部 ≤ 300（5 分钟）。
   * v89.229 兵种重构：`cat` 退役 —— 本口径现按 `craft`/`ride` 三态判定：
   * 徒步（无 ride/craft）≤ 60 · 机车（ride）≤ 300 · 器械（craft）另计（制造品）。""")

rep('js/data.js', 'data.merge-note',
"""     * 数值 = **主原型继承**（不重标定平衡）；18→14 的合并去向（4 个吸收项）：
     *   步行机 + 狂猎 + 步行机 → 步行机（取步行机数值）· 主战机甲 + 主战机甲 → 主战机甲
     *   （取主战机甲数值）· 自行火炮 + 自行火炮 → 自行火炮（取自行火炮数值）· 狂猎 → 狂猎。""",
"""     * 数值 = **主原型继承**（不重标定平衡）；18→14 的合并去向（4 个吸收项 · 取"主原型"数值 ·
     *   逐 id 映射见 `GAME.TROOP_MAP_229`；此处以 id 记，避开显示名换代的干扰）：
     *   yibing + changqiang → buxingji（取 changqiang）·
     *   tieji + xiliangtieqi → zhuzhan（取 xiliangtieqi）·
     *   toudan + chongche → huopao（取 toudan）·
     *   qingzhoubing + hubaoqi → kuanglie（取 hubaoqi）。""")

# ---------- ⑥ questdata.js：三条历史注释补换代说明 ----------
rep('js/questdata.js', 'quest.g22',
"""      /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/50 做不完） */""",
"""      /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/50 做不完）；
         v89.229 兵种重构：'tieji' 并入 'zhuzhan'（主战机甲）—— sub 已随换代 */""")

rep('js/questdata.js', 'quest.r07',
"""    /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/20 做不完） */""",
"""    /* v89.86 修 bug：sub 'tieqi' → 'tieji'（兵种实际 id；原值导致该任务永远 0/20 做不完）；
       v89.229 兵种重构：'tieji' 并入 'zhuzhan'（主战机甲）—— sub 已随换代 */""")

rep('js/questdata.js', 'quest.r09',
"""    /* v89.86 修 bug：sub 'toushiche' → 'toudan'（兵种实际 id；原值导致该任务永远 0/5 做不完） */""",
"""    /* v89.86 修 bug：sub 'toushiche' → 'toudan'（兵种实际 id；原值导致该任务永远 0/5 做不完）；
       v89.229 兵种重构：'toudan' 并入 'huopao'（自行火炮）—— sub 已随换代 */""")

# ---------- ⑦ docs/AI工作备忘.md ----------
rep('docs/AI工作备忘.md', 'memo.ids',
"""   并占每日名额。兵种实际 id 是 `tieji` / `toudan`。""",
"""   并占每日名额。兵种实际 id 是 `tieji` / `toudan`（v89.229 兵种重构后分别并入
   `zhuzhan` / `huopao`）。""")

for line in REPORT:
    print(line)
print('批次 A 完成')

# -*- coding: utf-8 -*-
"""v68 · 弹窗统一（老板 2026-09-14：「点击建筑出来的弹窗……尽量统一」）

考察结论（详见 docs/设计规范.md §11）：
  · 建筑详情弹窗（城内 / 城外 / 城墙）三个族，骨架各不相同：
    城内=图标+名称+费用在上、按钮在下、关闭单独一行；
    城外=操作区+危险区+关闭行；城墙=费用行+按钮混在 foot。
  · 统一骨架：头部（图标+名称·Lv+描述）→ 信息区 → 功能行 → 升级行 → 底栏。
  · 底栏：危险（左）· 关闭（中）· 管理（右）—— 关闭居中天然充当误点缓冲。
  · 升级费用与按钮同行（改前隔着整块信息区）。
  · 页脚样式：bldg-foot 是唯一 dashed 的，并入统一规格（实线）。
  · 操作命名：官府入口「征收」名不副实（面板含征调/特产/岁贡/改名）→「官府事务」；
    全部入口统一为「用途短语」/「用途A · 用途B」。

本补丁只动"点击建筑出来的弹窗"三族 + 命名 + 页脚样式；
功能面板（市集/客栈/军营……）结构各异（功能多），不在本次范围内。
"""
import io
import os
import sys

ROOT = r'E:\Deepseekdb'
UI = os.path.join(ROOT, 'js', 'ui.js')
HTML = os.path.join(ROOT, 'index.html')
SMOKE = os.path.join(ROOT, 'smoke-test.js')

MARK = 'class="op-row op-row-between"'

# ================================================================ ui.js
# ---- 1. BLDG_FUNC 命名统一 ----
U1_OLD = """  /* 功能建筑 → 功能入口（点建筑直达其功能；功能归属明确） */
  var BLDG_FUNC = {
    guanfu: { label: "💰 征收", act: "open-guanfu" },
    junying: { label: "⚔️ 军队 · 募兵", act: "open-troops", withIdx: true },
    xiaochang: { label: "🏹 校场 · 出征与伤兵", act: "open-xiaochang" },
    shuyuan: { label: "📜 科技 · 研究", act: "open-panel", view: "tech" },
    kezhan: { label: "🍶 招募", act: "open-inn" },
    zhaoxianguan: { label: "🎎 名录", act: "open-hostel" },
    shichang: { label: "🏪 交易", act: "open-market" },
    cangku: { label: "🏚️ 仓储", act: "open-store" },
    majiu: { label: "🐎 装备 · 坐骑", act: "open-panel", view: "equip" },
    tiejiangpu: { label: "⚒️ 打造", act: "open-forge" },
    gongjiangzuofang: { label: "🛠️ 器械与工事", act: "open-workshop", withIdx: true },
    minfang: { label: "👥 人口统计", act: "open-panel", view: "stats" },
    chengqiang: { label: "🧱 城防统计", act: "open-panel", view: "stats" }
  };"""
U1_NEW = """  /* 功能建筑 → 功能入口（点建筑直达其功能；功能归属明确）
     v68（老板「操作项命名合理」）：统一命名规范 ——
       · 格式：图标 + 用途短语；多功能面板写「用途A · 用途B」；
       · **名字要覆盖面板的全部内容**（点了名不副实就是误导）——
         例：官府入口原叫「征收」，面板里却有征调民力 / 本城特产 / 岁贡 / 改名，
         已改「官府事务」；校场/军营/作坊去掉与建筑名重复的抬头词。 */
  var BLDG_FUNC = {
    guanfu: { label: "🏯 官府事务", act: "open-guanfu" },
    junying: { label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true },
    xiaochang: { label: "🏹 出征 · 伤兵", act: "open-xiaochang" },
    shuyuan: { label: "📜 科技 · 研究", act: "open-panel", view: "tech" },
    kezhan: { label: "🍶 招募将领", act: "open-inn" },
    zhaoxianguan: { label: "🎎 将领名录", act: "open-hostel" },
    shichang: { label: "🏪 交易", act: "open-market" },
    cangku: { label: "🏚️ 仓储", act: "open-store" },
    majiu: { label: "🐎 坐骑装备", act: "open-panel", view: "equip" },
    tiejiangpu: { label: "⚒️ 打造", act: "open-forge" },
    gongjiangzuofang: { label: "🛠️ 器械 · 箭塔", act: "open-workshop", withIdx: true },
    minfang: { label: "👥 人口统计", act: "open-panel", view: "stats" },
    chengqiang: { label: "🧱 城防统计", act: "open-panel", view: "stats" }
  };"""

# ---- 2. 城内 · 施工中头部 ----
U2_OLD = """      ui.openModal('<div class="gold-heading">🛠️ ' + (isUpgrade ? '升级中' : '建造中') + '</div>' +
        '<div style="text-align:center;font-size:var(--fs-h2);font-weight:800;color:var(--gold-light);margin:8px 0;">' +
          (pb2 ? pb2.name : '建筑') + (isUpgrade ? ('　Lv' + (cell.pending.targetLevel - 1) + ' → Lv' + cell.pending.targetLevel) : '') + '</div>' +
        (isUpgrade
          ? '<div style="text-align:center;font-size:40px;margin-bottom:4px;">' + GAME.icons.forBuilding(cell.build.id) + '</div>'
          : '') +
        progBlock +"""
U2_NEW = """      /* v68（弹窗统一）：施工中弹窗与正常态**同构** ——
         图标 +「名称 · Lv→Lv」+ 描述，危险操作进底栏（设计规范 §11）。 */
      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' +
          GAME.icons.forBuilding(isUpgrade ? cell.build.id : cell.pending.buildId) + '</span></div>' +
        '<div class="gold-heading">' + (pb2 ? pb2.name : '建筑') +
          (isUpgrade ? (' · Lv' + (cell.pending.targetLevel - 1) + ' → Lv' + cell.pending.targetLevel) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpgrade ? '🛠️ 升级中 · 后台施工，倒计时每秒更新，不影响下方操作'
                     : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        progBlock +"""

# ---- 3. 城内 · 施工中尾部（危险区 → 底栏）----
U3_OLD = """        '<div class="op-zone danger">' +
          '<div class="op-zone-t">危险操作</div>' +
          '<div class="op-row">' +
            '<button class="btn red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
            '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
          '</div></div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');"""
U3_NEW = """        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');"""

# ---- 4. 城内 · 有建筑主体 ----
U4_OLD = """        '<div class="attr"><span class="k">升级费用</span><span class="v">' + costStr + '</span></div>' +
        (dRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(dRef) + '</div>' : '') +
        barQueue +
        /* v16：正向操作与拆毁类操作分区，避免误点。
           v28（需求 7）：改前是两个带标题的 op-zone 各占一行 —— "危险操作"四个字
           比按钮本身还显眼，两个按钮还互相挤。现在按用户要的摆位：
           **拆毁在左下角、移动/交换在右下角，两者都收小**，中间留白避免误点。 */
        '<div class="op-zone">' +
          '<div class="op-zone-t">操作</div>' +
          '<div class="op-row">' +
            (function () { var f = BLDG_FUNC[b.id]; return f ? ('<button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
                (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button>') : ''; })() +
            (upCost ? '<button class="btn" data-action="confirm-upgrade" data-idx="' + idx + '">升级 → Lv' + (cell.build.lvl + 1) + '</button>' : '<span class="op-done">' + (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span>') +
          '</div></div>' +
        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="' + (dRef ? '返还累计投入的 50%：' + GAME.costString(dRef) : '不可恢复') + '（需二次确认）">拆毁</button>' +
          (b.id === 'guanfu' ? '<span></span>'
            : '<button class="btn sm" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换</button>') +
        '</div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>'"""
U4_NEW = """        (dRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(dRef) + '</div>' : '') +
        barQueue +
        /* v68（老板「弹窗统一」· 设计规范 §11）：建筑弹窗统一动线三段 ——
           ① 功能行「用建筑」：进功能面板（金色主按钮）；
           ② 升级行「建建筑」：费用与按钮**同行**（改前费用在上、按钮在下，隔着一整块信息区）；
           ③ 底栏「管建筑」：危险（左）· 关闭（中，天然误点缓冲）· 管理（右）
              —— v28「拆毁左下、移动右下、中间留白」的原摆位保留，关闭正好居中。 */
        (function () { var f = BLDG_FUNC[b.id]; return f ? ('<div class="op-zone">' +
            '<div class="op-zone-t">功能</div>' +
            '<div class="op-row"><button class="btn gold" data-action="' + f.act + '"' + (f.view ? ' data-view="' + f.view + '"' : '') +
              (f.withIdx ? ' data-idx="' + idx + '"' : '') + '>' + f.label + '</button></div>' +
          '</div>') : ''; })() +
        '<div class="op-zone">' +
          '<div class="op-zone-t">升级</div>' +
          '<div class="op-row op-row-between">' +
            '<span class="op-kv">费用 <b>' + costStr + '</b></span>' +
            (upCost ? '<button class="btn" data-action="confirm-upgrade" data-idx="' + idx + '">升级 → Lv' + (cell.build.lvl + 1) + '</button>' : '<span class="op-done">' + (preUp.ok ? '已达最高等级' : U.escape(preUp.short)) + '</span>') +
          '</div></div>' +
        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="demolish-ask" data-kind="city" data-idx="' + idx + '"' +
            ' title="' + (dRef ? '返还累计投入的 50%：' + GAME.costString(dRef) : '不可恢复') + '（需二次确认）">拆毁</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          (b.id === 'guanfu' ? '<span></span>'
            : '<button class="btn sm" data-action="move-ask" data-idx="' + idx + '" title="与另一地块互换位置">🔄 移动 / 交换</button>') +
        '</div>'"""

# ---- 5. 城外 · 施工中头部 ----
U5_OLD = """      ui.openModal('<div class="gold-heading">🛠️ ' + (isUpE ? '升级中' : '建造中') + '</div>' +
        '<div style="text-align:center;font-size:var(--fs-h2);font-weight:800;color:var(--gold-light);margin:8px 0;">' +
          pendName + (isUpE ? ('　Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +
        prodLine +"""
U5_NEW = """      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' +
          (GAME.icons.forExt(e.type) || (DATA.EXT_BUILDINGS[e.type] || {}).icon) + '</span></div>' +
        '<div class="gold-heading">' + pendName + (isUpE ? (' · Lv' + e.lv + ' → Lv' + (e.lv + 1)) : '') + '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-body);text-align:center;margin-bottom:12px;">' +
          (isUpE ? '🛠️ 升级中 · 后台施工，倒计时每秒更新（施工中不停产）' : '🏗️ 建造中 · 倒计时每秒更新') + '</div>' +
        prodLine +"""

# ---- 6. 城外 · 施工中尾部 ----
U6_OLD = """        '<div class="op-zone danger">' +
          '<div class="op-zone-t">危险操作</div>' +
          '<div class="op-row">' +
            '<button class="btn red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
            '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
          '</div></div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>');"""
U6_NEW = """        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');"""

# ---- 7. 城外 · 有建筑主体 ----
U7_OLD = """        '<div class="attr"><span class="k">升级费用</span><span class="v">' + costStr + '</span></div>' +
        (eRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(eRef) + '</div>' : '') +
        '<div class="op-zone">' +
          '<div class="op-zone-t">操作</div>' +
          '<div class="op-row">' +
            (upCost ? '<button class="btn" data-action="ext-upgrade" data-idx="' + idx + '">升级 → Lv' + (e.lv + 1) + '</button>' : '<span class="op-done">已达最高等级</span>') +
            '<button class="btn gold" data-action="ext-convert-ask" data-idx="' + idx + '">🔧 改建为其他资源建筑</button>' +
          '</div></div>' +
        '<div class="op-zone danger">' +
          '<div class="op-zone-t">危险操作</div>' +
          '<div class="op-row">' +
            (upCost ? '<button class="btn red" data-action="demolish-ask" data-kind="ext" data-idx="' + idx + '">拆毁</button>' : '') +
            '<span class="op-hint">拆毁返还累计投入的 50%　需二次确认</span>' +
          '</div></div>' +
        '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>'"""
U7_NEW = """        (eRef ? '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-top:10px;">拆毁可返还累计投入的 50%：' + GAME.costString(eRef) + '</div>' : '') +
        /* v68（设计规范 §11）：与城内弹窗同一骨架 —— 功能行 / 升级行 / 底栏 */
        '<div class="op-zone">' +
          '<div class="op-zone-t">功能</div>' +
          '<div class="op-row"><button class="btn gold" data-action="ext-convert-ask" data-idx="' + idx + '">🔧 改建为其他资源建筑</button></div>' +
        '</div>' +
        '<div class="op-zone">' +
          '<div class="op-zone-t">升级</div>' +
          '<div class="op-row op-row-between">' +
            '<span class="op-kv">费用 <b>' + costStr + '</b></span>' +
            (upCost ? '<button class="btn" data-action="ext-upgrade" data-idx="' + idx + '">升级 → Lv' + (e.lv + 1) + '</button>' : '<span class="op-done">已达最高等级</span>') +
          '</div></div>' +
        '<div class="bldg-foot">' +
          (upCost ? '<button class="btn sm red" data-action="demolish-ask" data-kind="ext" data-idx="' + idx + '" title="返还累计投入的 50%（需二次确认）">拆毁</button>' : '<span></span>') +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>'"""

# ---- 8. 城外 · 空地弹窗：取消 → 关闭（纯关窗语义，与城内空地一致）----
U8_OLD = """      '<div style="text-align:center;margin-top:14px;"><button class="btn" data-action="close-modal">取消</button></div>'"""
U8_NEW = """      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'"""

# ---- 9. 城墙 · 施工中尾部 ----
U9_OLD = """        '<div class="modal-foot">' +
          '<button class="btn red" data-action="cancel-build" data-kind="wall">取消施工</button>' +
          '<button class="btn" data-action="close-modal">关闭</button></div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-cap);text-align:center;margin-top:8px;">取消后按剩余时间比例返还 80% 资源</div>');"""
U9_NEW = """        '<div class="bldg-foot">' +
          '<button class="btn sm red" data-action="cancel-build" data-kind="wall">取消施工</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">取消后按剩余时间比例返还 80% 资源</span>' +
        '</div>');"""

# ---- 10. 城墙 · 正常：费用行并入升级行 ----
U10_OLD = """      '<div class="attr"><span class="k">' + (lv > 0 ? '升级费用' : '修建费用') + '</span><span class="v">' +
        (cost ? GAME.costString(cost) : '已满级') + '</span></div>' +

      '<div class="modal-foot">' +
        (lv < GAME.buildCapOf(c, 'chengqiang') && cost
          ? '<button class="btn gold" data-action="wall-build">' + (lv > 0 ? '升级城墙' : '修建城墙') + '</button>' : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>');"""
U10_NEW = """      /* v68（设计规范 §11）：费用与按钮同行、关闭进底栏 —— 与建筑弹窗同骨架 */
      '<div class="op-zone"><div class="op-zone-t">' + (lv > 0 ? '升级' : '修建') + '</div>' +
        '<div class="op-row op-row-between">' +
          '<span class="op-kv">费用 <b>' + (cost ? GAME.costString(cost) : '已满级') + '</b></span>' +
          ((lv < GAME.buildCapOf(c, 'chengqiang') && cost)
            ? '<button class="btn" data-action="wall-build">' + (lv > 0 ? '升级城墙' : '修建城墙') + '</button>'
            : '<span class="op-done">已达最高等级</span>') +
        '</div></div>' +
      '<div class="bldg-foot"><span></span><button class="btn" data-action="close-modal">关闭</button><span></span></div>');"""

# ================================================================ index.html
H1_OLD = """  .bldg-foot { display: flex; justify-content: space-between; align-items: center;
    margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--line-strong); }"""
H1_NEW = """  /* v68（弹窗统一）：与 m-foot 同规格（实线）—— 改前是 dashed，四套页脚里唯一的例外。
     三格摆位保留 v28 的设计：危险（左）· 关闭（中，天然误点缓冲）· 管理（右）。 */
  .bldg-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px;
    margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--line-strong); }"""

H2_OLD = """  .op-done { color: var(--text-dim); font-size: var(--fs-sub); }"""
H2_NEW = """  .op-done { color: var(--text-dim); font-size: var(--fs-sub); }
  /* v68（弹窗统一）：升级行专用 —— 费用靠左、按钮靠右（同一行对齐） */
  .op-row-between { justify-content: space-between; }
  .op-kv { color: var(--text-dim); font-size: var(--fs-sub); }
  .op-kv b { color: var(--text-strong); font-weight: 700; }"""

# ================================================================ smoke 断言适配
S1_OLD = '/junying: \\{ label: "⚔️ 军队 · 募兵", act: "open-troops", withIdx: true \\}/'
S1_NEW = '/junying: \\{ label: "⚔️ 募兵 · 兵种", act: "open-troops", withIdx: true \\}/'

S2A_OLD = """  check('#14 工匠作坊入口为「器械与工事」', (function () {
    return /gongjiangzuofang: \\{ label: "🛠️ 器械与工事", act: "open-workshop"/.test(uS16)
      && /ui\\.openWorkshop = function/.test(uS16);
  })());"""
S2A_NEW = """  check('#14 工匠作坊入口为「器械 · 箭塔」', (function () {
    return /gongjiangzuofang: \\{ label: "🛠️ 器械 · 箭塔", act: "open-workshop"/.test(uS16)
      && /ui\\.openWorkshop = function/.test(uS16);
  })());"""

S2B_OLD = """  check('结构：作坊入口指向"器械与工事"，建造动作已接线', (function () {
    var code = stripComment(uS);
    return /gongjiangzuofang: \\{ label: "🛠️ 器械与工事", act: "open-workshop"/.test(code)"""
S2B_NEW = """  check('结构：作坊入口指向"器械 · 箭塔"，建造动作已接线', (function () {
    var code = stripComment(uS);
    return /gongjiangzuofang: \\{ label: "🛠️ 器械 · 箭塔", act: "open-workshop"/.test(code)"""

S3_OLD = '/xiaochang: \\{ label: "🏹 校场 · 出征与伤兵", act: "open-xiaochang" \\}/'
S3_NEW = '/xiaochang: \\{ label: "🏹 出征 · 伤兵", act: "open-xiaochang" \\}/'

S4_OLD = "  check('官府建筑有征收入口', /guanfu: \\{ label: \"💰 征收\", act: \"open-guanfu\" \\}/.test(uS37)"
S4_NEW = "  check('官府入口覆盖面板全部内容（v68：不再叫「征收」）', /guanfu: \\{ label: \"🏯 官府事务\", act: \"open-guanfu\" \\}/.test(uS37)"

S5_OLD = "  check('#12 建筑面板分「操作 / 危险操作」', /class=\"op-zone-t\">操作</.test(uS16) && /class=\"op-zone-t\">危险操作</.test(uS16));"
S5_NEW = "  check('#12 建筑面板动线三段（功能 / 升级 / 底栏）', /class=\"op-zone-t\">功能</.test(uS16) && /class=\"op-zone-t\">升级</.test(uS16) && /class=\"bldg-foot\"/.test(uS16));"

# 顺手改两处标签文案里的旧名（3601 的 check 标题）
S6_OLD = "  check('#14 工匠作坊入口为「器械与工事」', (function () {"
S6_NEW = "  check('#14 工匠作坊入口为「器械 · 箭塔」', (function () {"

PLAN = [
    (UI, U1_OLD, U1_NEW, 'ui · BLDG_FUNC 命名统一'),
    (UI, U2_OLD, U2_NEW, 'ui · 城内施工头部'),
    (UI, U3_OLD, U3_NEW, 'ui · 城内施工尾部'),
    (UI, U4_OLD, U4_NEW, 'ui · 城内建筑主体'),
    (UI, U5_OLD, U5_NEW, 'ui · 城外施工头部'),
    (UI, U6_OLD, U6_NEW, 'ui · 城外施工尾部'),
    (UI, U7_OLD, U7_NEW, 'ui · 城外建筑主体'),
    (UI, U8_OLD, U8_NEW, 'ui · 城外空地按钮'),
    (UI, U9_OLD, U9_NEW, 'ui · 城墙施工尾部'),
    (UI, U10_OLD, U10_NEW, 'ui · 城墙正常态'),
    (HTML, H1_OLD, H1_NEW, 'html · bldg-foot 实线'),
    (HTML, H2_OLD, H2_NEW, 'html · op-row-between / op-kv'),
    (SMOKE, S1_OLD, S1_NEW, 'smoke · junying label'),
    (SMOKE, S2A_OLD, S2A_NEW, 'smoke · 作坊 label（A）'),
    (SMOKE, S2B_OLD, S2B_NEW, 'smoke · 作坊 label（B）'),
    (SMOKE, S3_OLD, S3_NEW, 'smoke · 校场 label'),
    (SMOKE, S4_OLD, S4_NEW, 'smoke · 官府入口'),
    (SMOKE, S5_OLD, S5_NEW, 'smoke · #12 三段改写'),
]


def main():
    texts = {}
    for p in {UI, HTML, SMOKE}:
        texts[p] = io.open(p, 'rb').read().decode('utf-8')
    if MARK in texts[UI] and '官府事务' in texts[SMOKE]:
        print('· 已存在，跳过（幂等）')
        return 0
    crlf0 = {p: texts[p].count('\r\n') for p in texts}
    done = []
    for path, old, new, tag in PLAN:
        t = texts[path]
        c = t.count(old)
        if c != 1:
            print('✗ [%s] 锚点命中 %d 次（应为 1），拒绝写盘' % (tag, c))
            return 1
        texts[path] = t.replace(old, new, 1)
        done.append(tag)
    for path in texts:
        out = texts[path].encode('utf-8')
        if out.count(b'\r\n') != crlf0[path]:
            print('✗ 行尾被改写（%s）' % path)
            return 1
        io.open(path, 'wb').write(out)
    print('本次改动: %d 处' % len(done))
    for d in done:
        print('  ·', d)
    chk = io.open(UI, encoding='utf-8', newline='').read()
    ok = MARK in chk and '官府事务' in chk
    print('✓ 完成' if ok else '✗ 核验未过')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())

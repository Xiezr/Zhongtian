# -*- coding: utf-8 -*-
"""v89.116 补丁 N：**同族 bug 一次清干净** —— "引用了不存在的成员" 五个修复

来历：`GAME.guardOf`（守城守将）这个 bug 的**同族**问题 —— 全仓扫描 GAME/DATA/U 的成员引用，
发现 5 处"引用了从不存在的成员"（三元判断把它们静默吞掉）：
  · GAME.itemCount    → 锦囊数恒 0（策略布防那行"锦囊可用 0 个"永远是 0）
  · GAME.energyMax    → 将领体力的**上限**恒 100（真名 GAME.staMax：等级/资质/内政 + 装备）
  · DATA.CITY_TIER_NAME → 征服提示里显示原始英文键（county / jun …），真表是 DATA.CITY_TIER
  · DATA.EQUIP_SLOT_ICON → 死兜底（真出口 icons.forEquip 恒在）；万一它不在会**抛错**
  · DATA.ITEM_BY_ID   → 存档/道具摘要里显示原始 id 而不是中文名（补表，与 MATERIAL_BY_ID 同构）
另：`DATA.SANDBOX.frameMs` 从来没定义 → 沙盘帧速的 420 其实写在 ui 里的兜底
  （移到 DATA 表，只留一处权威值）。
`GAME.onLog` 是**真钩子**（试玩工具 play_600x.js 等会挂它）→ 不属于 bug，进审计白名单。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
EDITS = []


def edit(path, old, new, tag):
    EDITS.append((path, old, new, tag))


# ① 锦囊数：走真实数据（s.items）
edit('js/ui.js',
     """      var ja = GAME.itemCount ? GAME.itemCount('jinang') : 0;""",
     """      /* v89.116：这里原写 `GAME.itemCount ? GAME.itemCount('jinang') : 0` ——
         该函数**全仓不存在**（同 `guardOf` 那一类"拼错就被三元吞掉"）→ 锦囊数恒 0。
         真口径 = 背包里的数量（与"背包点锦囊用掉"同一份数据）。 */
      var ja = (GAME.state.items || {}).jinang || 0;""",
     'ui.js 锦囊数')

# ② 将领体力上限：真出口 GAME.staMax
edit('js/ui.js',
     """    var enMx = GAME.energyMax ? GAME.energyMax(g) : 100;""",
     """    /* v89.116：原写 `GAME.energyMax`（不存在）→ 上限恒 100。
       真出口 = `GAME.staMax`（等级/资质/内政 + 装备与套装体力，见 domain.js 的注释）。 */
    var enMx = GAME.staMax ? GAME.staMax(g) : 100;""",
     'ui.js 体力上限')

# ③ 征服提示里的城档中文名：真表 DATA.CITY_TIER / GAME.cityTierName
edit('js/battle.js',
     """        sub: '威望 +' + repGain + '　·　' + (npcCity.state || '') + '　·　' + (DATA.CITY_TIER_NAME ? (DATA.CITY_TIER_NAME[npcCity.type] || npcCity.type) : npcCity.type),""",
     """        /* v89.116：原读 `DATA.CITY_TIER_NAME`（不存在）→ 提示里显示原始英文键。
           真口径 = `GAME.cityTierName`（读 DATA.CITY_TIER，与城池信息面板同源）。 */
        sub: '威望 +' + repGain + '　·　' + (npcCity.state || '') + '　·　'
          + (GAME.cityTierName ? GAME.cityTierName({ type: npcCity.type }) : npcCity.type),""",
     'battle.js 城档中文名')

# ④ 装备槽图标：去掉会抛错的死兜底
edit('js/ui.js',
     """          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : (DATA.EQUIP_SLOT_ICON[it.slot] || ''),""",
     """          /* v89.116：`DATA.EQUIP_SLOT_ICON` 不存在 —— 旧兜底一旦被走到就是**抛错**；
             真出口 `icons.forEquip` 恒在（icons.js），缺了也只是空图标、不炸。 */
          cls: 'q' + it.q, ico: (GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : ''),""",
     'ui.js 装备槽图标')

# ⑤ 物品名表：补 DATA.ITEM_BY_ID（与 MATERIAL_BY_ID 同构）
edit('js/data.js',
     """  DATA.MATERIAL_IDS = DATA.MATERIALS.map(function (m) { return m.id; });""",
     """  /* v89.116（"引用了不存在的成员"同族清剿）：`DATA.ITEM_BY_ID` 一直被 state.js 的
     存档摘要读着（`DATA.ITEM_BY_ID && DATA.ITEM_BY_ID[id] ? .name : id`）——
     表不存在 → 摘要里永远显示原始 id（`chest_tong` 而不是「青铜宝箱」）。
     与 MATERIAL_BY_ID 同构，一次建表、各处直读。 */
  DATA.ITEM_BY_ID = {};
  (DATA.ITEMS || []).forEach(function (it) { DATA.ITEM_BY_ID[it.id] = it; });

  DATA.MATERIAL_IDS = DATA.MATERIALS.map(function (m) { return m.id; });""",
     'data.js ITEM_BY_ID 建表')

# ⑥ 沙盘帧速：进 DATA（原先只有 ui 里的兜底数字）
edit('js/data.js',
     """  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };""",
     """  DATA.CAPTIVE = { rate: 0.08, min: 10, cap: 3000, kinds: ['wild', 'fort', 'city', 'defense'] };
  /* v89.116：沙盘回放的帧间隔（毫秒）—— 原先 `DATA.SANDBOX.frameMs` 从没定义，
     界面里的 `|| 420` 才是真值（常量钉在界面 = 以后没人找得到）。
     现在权威值在本表；界面那处兜底只为防御（注释已标明）。 */
  DATA.SANDBOX = { frameMs: 420 };""",
     'data.js SANDBOX 表')

edit('js/ui.js',
     """    var ms = (DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420;""",
     """    var ms = (DATA.SANDBOX && DATA.SANDBOX.frameMs) || 420;   /* 权威值在 DATA.SANDBOX（v89.116），420 仅防御 */""",
     'ui.js 沙盘帧速注释')

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
        tmp = p + '.tmp116n'
        io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
        os.replace(tmp, p)
        print('  → 落盘 %s（净 %+d）' % (os.path.basename(p), d0))
    print('补丁 N 完成')
    return 0


sys.exit(main())

# -*- coding: utf-8 -*-
"""v88.1 文档：设计规范 §28 批注 + §29.6 / 档案 v88.1 段 / 备忘 §31.4。行尾适配 + 探针幂等。"""
import io

def patch(path, seg, nl, probe, where='tail'):
    t = io.open(path, encoding='utf-8', newline='').read()
    if probe in t:
        print('SKIP ' + path.split(chr(92))[-1] + ':' + where)
        return
    seg2 = seg.replace('\n', nl) if nl != '\n' else seg
    if where == 'tail':
        t = t.rstrip('\r\n') + nl + nl + seg2
    else:
        # 插到指定锚点前（where 传锚点原文）
        assert t.count(where) == 1, '锚点 %d 次' % t.count(where)
        rep = seg2 + nl + nl + where
        t = t.replace(where, rep, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('OK ' + path.split(chr(92))[-1] + ':' + where[:30] if where != 'tail' else 'tail')

# ============ 1) 设计规范：§29.6 追加（tail, CRLF） ============
SEG1 = """### 29.6 v88.1 整合：地形专属并入江湖游历（老板「统一」）
- `DATA.WILD_SCENES` 六场景 -> `DATA.LING_ACT` 的 `<terrain>_scene`（kind: 'scene'，
  单地形 spots + outcomes 权重表）；原 WILD_SCENES 表**删除**。
- `GAME.wildSceneOf / wildSceneCheck / wildSceneDo` -> `GAME.jianghuCheck / jianghuDo`
  的 scene 分支（产出逻辑原样移植：金 / 粮 / WILD_MATERIAL / 珠宝 / 道具 / 豪杰）；
  每日锁统一 `s.jianghu`（旧 `s.wildScenes` 不再读写）。
- UI：`ui.wildSceneHTML / ui.doWildScene` 删除 —— 野地弹窗内**单一区块**「江湖游历」，
  scene 排最前（本地招牌）；事件统一 `do-jianghu`（原 `do-wild-scene` 删除）。
- 守卫：smoke §72 改写为「整合结构 + 六地形招牌 + 豪杰定向（jinghu 链）」；e2e v88.1
  段 3 条；真机 5 项（`_v881_shots/`）。§73 活动表断言同步 6 -> 12 项。
"""
patch(r'E:\Deepseekdb\docs\设计规范.md', SEG1, '\r\n', '### 29.6 v88.1 整合')

# ============ 2) 设计规范 §28 批注（插在 §28 标题后, CRLF） ============
ANCHOR28 = "## 28. v87：野地专属场景（老板「为各类野地设计专属弹窗场景」）"
NOTE28 = "## 28. v87：野地专属场景（老板「为各类野地设计专属弹窗场景」）\n\n> **v88.1 已整合**：本章场景已并入「江湖游历」（见 §29.6），原表/函数/UI 区块均已删除；以下为历史存档。"
t = io.open(r'E:\Deepseekdb\docs\设计规范.md', encoding='utf-8', newline='').read()
if 'v88.1 已整合**：本章场景已并入' in t:
    print('SKIP 设计规范 §28 批注')
else:
    assert t.count(ANCHOR28) == 1
    t = t.replace(ANCHOR28, NOTE28.replace('\n', '\r\n') if '\r\n' in t else NOTE28, 1)
    io.open(r'E:\Deepseekdb\docs\设计规范.md', 'w', encoding='utf-8', newline='').write(t)
    print('OK 设计规范 §28 批注')

# ============ 3) 档案 v88.1 段（tail, CRLF） ============
SEG3 = """### v88.1 · 整合（老板「统一」：野地两套并一套）

> 现在野地有2套（比如森林的林中狩猎和江湖游历），统一，把地形专属活动整合或去除

**处理**（选「整合」——保内容不丢，非删除）：
- 六地形场景并入 `DATA.LING_ACT`（`<terrain>_scene`，kind: 'scene'）：绿林探访 / 垂钓 /
  沼泽寻宝 / 地宫探险 / 林中狩猎 / 草原牧马；原 `DATA.WILD_SCENES` 表删除。
- 全链统一：**一处入口**（江湖游历区块）· **一套锁**（s.jianghu）· **一条链**
  （jianghuCheck / jianghuDo 的 scene 分支，产出原样：金/粮/材料/珠宝/道具/豪杰）。
- 删除：GAME.wildScene 三函数 / ui.wildSceneHTML / ui.doWildScene / do-wild-scene 事件。
- 弹窗呈现：单一区块，本地招牌（scene）排最前 + 通用活动其后。
- 测试：smoke **2184/0**（§72 改写）· e2e **754/0**（v88.1 段 3 条）· 探针 11 条 ·
  真机 5/5（`_v881_shots/`）· audit 全 0。
- 细节：`docs/设计规范.md` §29.6；`docs/AI工作备忘.md` §31.4。
"""
patch(r'E:\Deepseekdb\需求档案.md', SEG3, '\r\n', '### v88.1 · 整合')

# ============ 4) 备忘 §31.4（tail, LF） ============
SEG4 = """### 31.4 「两套入口」的整合式（v88.1 实录）
- 老板说「统一」时：优先**整合**（保内容）而非删除（丢内容）——把后加入的系统当承载器
  （LING_ACT 表 / s.jianghu 锁 / jianghuHTML 区块），被整合侧**数据原样搬、逻辑原样移、旧壳全拆**；
- 整合检查单（漏一处就是半吊子）：
  1. 数据表：搬入 + 删表（留一行说明注释指向新家）；
  2. 函数组：逻辑移入新分支 + 删旧函数（含各自注释头）；
  3. 锁字段：换新锁 + 旧锁不再读写（跨日小影响可接受，单机不做迁移）；
  4. UI 区块：并成单区块 + 删旧渲染函数与两处调用行；
  5. 事件分发：并成单 case + 删旧 case；
  6. 测试：改写被删侧的测试段（保高价值断言：如「权重定向必出豪杰」），数量断言跟进；
  7. 文档：被删章节加「已整合」批注（历史存档），新侧记录整合小节。
- 补丁探针教训（本次两例）：① 负向状态（"某行已删"）无法用正向字符串做 probe —— 用
  `if '旧特征' in d: 处理 else: SKIP` 结构；② `probe 字符串`必须比「旧/新状态都含有的
  中间行」更严——不确定时用**完成后独有文本**（如新注释原文）或**负向判断**。
"""
patch(r'E:\Deepseekdb\docs\AI工作备忘.md', SEG4, '\n', '### 31.4 「两套入口」的整合式')

print()
print('全部完成。')

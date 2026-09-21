# -*- coding: utf-8 -*-
"""v89.86 · 备忘 §十一 登记新增出口（项目铁律：「新增出口必须登记」）"""
import io
import os

P = r'E:\Deepseekdb\docs\AI工作备忘.md'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


OLD = r"""| **v70 新增（地理/坐标/君主）** | `regionOf(x,y)`（州·郡·县唯一出口）· `cityFullName` / `fortLabelOf`（全称）· `junNameOf` / `countyNameOf`（后缀规范化）· `extPlanOf(lv)`（城外铺法，数量表 `EXT_PLAN_BY_LV`）· `COORD_MAX` / `coordText` / `isMovableCity` / `canCityMoveTo` / `moveCityTo` / `randomCityCoord` / `randomMoveCity`（坐标与迁址）· `pickStartPos`（出生坐标）· `isLordGeneral` / `lordGeneralOf` / `lordTraitsOf` / `makeLordGeneral`（君主将领） |"""
NEW = r"""| **v70 新增（地理/坐标/君主）** | `regionOf(x,y)`（州·郡·县唯一出口）· `cityFullName` / `fortLabelOf`（全称）· `junNameOf` / `countyNameOf`（后缀规范化）· `extPlanOf(lv)`（城外铺法，数量表 `EXT_PLAN_BY_LV`）· `COORD_MAX` / `coordText` / `isMovableCity` / `canCityMoveTo` / `moveCityTo` / `randomCityCoord` / `randomMoveCity`（坐标与迁址）· `pickStartPos`（出生坐标）· `isLordGeneral` / `lordGeneralOf` / `lordTraitsOf` / `makeLordGeneral`（君主将领） |
| **v89.86 新增（整改清单）** | `sectBonus(key)` / `sectTraitText(sc)`（**门派被动唯一发放口**，无门派→0）· `trainLimitOf(troopId)`（募兵上限归因；`maxTrainCount` 收编为其 `cap`）· `pendingUpgradeOf(city,bid)`（前置"升级中"）· `autoBudgetCheck(cost)` / `autoReservePct()`（自动化预算闸门）· `offlineCapDays()` / `simulateOfflineOverflow(secReal)`（离线推进上限与五折折算）· `queueAt(kind,ref)` / `queueRushCost(q)` / `queueRushPay(q,what)`（建造/科技队列花金提速；按位置查找不依赖渲染下标）· `SG.pending/defer/takePending(sid)`（故事待阅，上限 30）· `questReachable(def)`（随机任务可达性；生成侧只在 `rollBatch` 拦）· `ui.expPowerOf()`（**战力比唯一出口**，预估行与二次确认共用）· `ui.questJumpOf(def)`（任务前往映射） |"""

src = read(P)
if OLD not in src and NEW in src:
    print('SKIP（已应用）')
else:
    n = src.count(OLD)
    assert n == 1, ('锚点 %d 次' % n)
    write(P, src.replace(OLD, NEW, 1))
    assert NEW in read(P)
    print('OK 备忘 §十一 新增 v89.86 出口行')

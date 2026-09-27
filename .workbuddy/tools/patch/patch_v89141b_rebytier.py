# -*- coding: utf-8 -*-
# v89.141 批 A2：resByTier 随"城外露天容量"重算（连带数值 · 主动声明）
import io, os

ROOT = 'E:/Deepseekdb/'
ok = []

def patch(rel, pairs):
    p = os.path.join(ROOT, rel)
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    n0 = len(s)
    for pr in pairs:
        old, new = pr[0], pr[1]
        tag = pr[2] if len(pr) > 2 else old[:40]
        cnt = s.count(old)
        assert cnt == 1, '%s/%s 锚点命中 %d 次' % (rel, tag, cnt)
        s = s.replace(old, new)
        ok.append(rel + ':' + tag)
    assert '\r\n' not in s, rel + ' 行尾混入 CRLF'
    tmp = p + '.tmp141'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)
    chk = io.open(p, 'r', encoding='utf-8', newline='').read()
    assert len(chk) == len(s)
    print('✅ %s：%d → %d 字节' % (rel, n0, len(chk)))

patch('js/data.js', [
    # 注释：追加 v89.141 增项说明
    ("""       × (1 + 该档 storePct：县6% / 郡12% / 州25% / 都50%)
         ⇒ 县城 2.29亿 · 郡城 3.23亿 · 州城 4.50亿 · 都城 8.64亿
       v89.137：都城那一档随"建筑专精三档"重算 —— 都城建筑 Lv24 = 仓库**第二档**
         （专精 0.50 → 1.00，见 DATA.MASTERY_TIERS），故 6.48亿 → 8.64亿；
         县/郡/州（建筑 Lv12/16/20）仍在第一档，数值不变。
       ⚠️ 这**不是四个随手写的数**，而是上式的**结果**。改了 `DATA.BASE_STORE`、
          `CITY_PLAN.order` 的仓库座数、`DATA.TECH_MAX_LV`、`DATA.MASTERY` 的 cangku 项
          或 `CITY_PERK.storePct` 之后，这四个数必须跟着重算 ——
          smoke 有一条守卫会拿"满科技 + 满配影子城"实算比对，漂移即红。""",
     """       × (1 + 该档 storePct：县6% / 郡12% / 州25% / 都50%)
         ＋ v89.141 城外露天容量（纯加法 · 不吃仓储加成）：
            县 48块×Lv12 = 1152万 / 郡 64×16 = 2048万 /
            州 80×20 = 3200万 / 都 96×24 = 4608万
         ⇒ 县城 2.40亿 · 郡城 3.43亿 · 州城 4.82亿 · 都城 9.10亿
       v89.137：都城那一档随"建筑专精三档"重算 —— 都城建筑 Lv24 = 仓库**第二档**
         （专精 0.50 → 1.00，见 DATA.MASTERY_TIERS），故 6.48亿 → 8.64亿；
         县/郡/州（建筑 Lv12/16/20）仍在第一档，数值不变。
       v89.141（老板 0）：「城外资源建筑自带一点上限容量」→ 上式加 `露天` 一项
         （DATA.EXT_STORE_PER_LV × 地块数 × 建筑等级）→ 四档整体 +5%~7%；
         这是**有意**的连带变更（满配仓容 = 库藏基准），旧值 → 新值的对照：
           县 2.2896亿 → 2.4048亿 · 郡 3.2256亿 → 3.4304亿 ·
           州 4.50亿 → 4.82亿   · 都 8.64亿  → 9.1008亿
       ⚠️ 这**不是四个随手写的数**，而是上式的**结果**。改了 `DATA.BASE_STORE`、
          `CITY_PLAN.order` 的仓库座数、`DATA.TECH_MAX_LV`、`DATA.MASTERY` 的 cangku 项、
          `CITY_PERK.storePct` 或 `DATA.EXT_STORE_PER_LV` 之后，这四个数必须跟着重算 ——
          smoke 有一条守卫会拿"满科技 + 满配影子城"实算比对，漂移即红。""",
     'resByTier 注释'),

    # 数字本体
    ("    resByTier: { capital: 864000000, zhou: 450000000, jun: 322560000, county: 228960000 },",
     "    resByTier: { capital: 910080000, zhou: 482000000, jun: 343040000, county: 240480000 },",
     'resByTier 四数'),
])

print('✅ 批 A2 完成：' + ' / '.join(ok))

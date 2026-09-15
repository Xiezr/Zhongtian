# -*- coding: utf-8 -*-
"""v83 · 夹具修复：§57 任务置顶夹具的存量 flake（r18 与 g01/g02 同指标冲突）。

症状：smoke 偶发 4 条假红（「★ 顶块装的是达标项 / 每行右侧领取按钮 / 领取随机任务 /
领取后自动从顶块与列表消失」），实测约 2~3% 概率 —— 复刻夹具 20 连跑定位：
  · 夹具从随机池里挑「第一条非 abs 任务」做打桩对象；
  · 打桩口按 (metric, sub) 拦截：bldCount/minfang 固定返回 3（g01 恰好达标 / g02 未达标）；
  · r18「广厦之谋」也是 bldCount/minfang（goal 2，base=新城 2）——被抽中时
    打桩返回 3 → amount = 3-2 = 1 < 2 → 未达标 → 顶块里没有它 → 四条连锁假红。
修法：夹具**跳过 bldCount/minfang 类任务**（打桩口无法对同一组指标返回两个值），
退化时保留旧口径兜底。判据本身不放宽（只换打桩对象，防回退意图不变）。
"""
import io
import sys

SMOKE = r'E:\Deepseekdb\smoke-test.js'

OLD = """      /* 夹具：找一条非绝对值的随机任务（可用 base 打桩达标） */
      var rq = null, rdef = null;
      for (var i = 0; i < pool.length; i++) {
        var d = G.randomQuestDef(pool[i].id);
        if (d && !d.abs) { rq = pool[i]; rdef = d; break; }
      }"""

NEW = """      /* 夹具：找一条非绝对值的随机任务（可用 base 打桩达标）
         v83 修复（存量 flake，2~3%）：跳过 bldCount/minfang 类（r18「广厦之谋」）——
         打桩口按 (metric, sub) 拦截、无法对同一组指标返回两个值（g01/g02 已占用该指标），
         抽中同类任务时下面四条断言会连锁假红。 */
      var rq = null, rdef = null;
      for (var i = 0; i < pool.length; i++) {
        var d = G.randomQuestDef(pool[i].id);
        if (d && !d.abs && !(d.metric === 'bldCount' && d.sub === 'minfang')) { rq = pool[i]; rdef = d; break; }
      }
      if (!rq) {   /* 退化兜底：万一池里只剩同指标任务，退回旧口径（不再扩大范围） */
        for (var i2 = 0; i2 < pool.length; i2++) {
          var d2 = G.randomQuestDef(pool[i2].id);
          if (d2 && !d2.abs) { rq = pool[i2]; rdef = d2; break; }
        }
      }"""

t = io.open(SMOKE, encoding='utf-8', newline='').read()
if NEW in t:
    print('· 已改过（跳过）')
    sys.exit(0)
c = t.count(OLD)
if c != 1:
    print('✗ 锚点命中 %d 次，拒绝写盘' % c)
    sys.exit(1)
io.open(SMOKE, 'w', encoding='utf-8', newline='').write(t.replace(OLD, NEW, 1))
print('✓ §57 夹具已加固（跳过 bldCount/minfang 冲突类）')

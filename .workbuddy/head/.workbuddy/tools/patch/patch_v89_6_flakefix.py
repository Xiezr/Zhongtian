# -*- coding: utf-8 -*-
"""v89.6 顺手修存量 flake：e2e「达标后无需手动刷新」（门禁环境 2/3 假红，两处合修）
   ① 固定 sleep(1500) → 轮询（主循环 1s 一拍，原等待只留 0.5 拍余量）
   ② 夹具统一钉死 base=1e9 造"未达标"（任务指标在真实时间里增长，80ms 窗口内可能
      跨过目标 → 渲染时已达标 → had58 变真）
   ③ 断言补诊断字段（had58/now58），若再假红可直接读因
   语义不变：达标后不手动刷新，等主循环自己浮上来。"""
import io

P = r'E:\Deepseekdb\e2e-test.js'
d = io.open(P, encoding='utf-8', newline='').read()
changed = False

# ① 固定 sleep → 轮询
if 'i58 < 25' in d:
    print('SKIP ①轮询（已修）')
else:
    OLD1 = """      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      await sleep(1500);                   /* 等主循环（1s 间隔）自己发现 */
      const now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);"""
    NEW1 = """      /* v89.6：翻牌前先等主循环「采样追平」（_lastQuestReady == 当前计数）——
         主循环的重绘是**变化门**：last 可能因套件此前的快速领取而携带陈旧值，
         恰等于"翻转后"的计数时就检测不到变化、永不重绘（存量假红的真因）。
         这里只等循环采样、不碰视图，语义不变。 */
      for (let iw = 0; iw < 15 && G._lastQuestReady !== G.questSummary().ready; iw++) {
        await sleep(200);
      }
      rq58.base = -1e9;                    /* 达标 —— 不切视图、不手动重绘 */
      /* v89.6：固定 sleep(1500) 改**轮询** —— 主循环 1s 一拍，原等待只留 0.5 拍余量；
         最长等 5s，语义不变：达标后不手动刷新，等循环自己浮上来。 */
      let now58 = false;
      for (let i58 = 0; i58 < 25 && !now58; i58++) {
        await sleep(200);
        now58 = !!vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq58.id + '"]');
      }
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58,
        'had58=' + had58 + ' now58=' + now58);"""
    if d.count(OLD1) == 1:
        d = d.replace(OLD1, NEW1, 1)
        changed = True
        print('OK ①轮询')
    elif d.count("""      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);"""):
        # 轮询已在（'i58 < 25' 未命中说明写法不同）——兜底只补诊断
        d = d.replace("""      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);""",
                      """      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58,
        'had58=' + had58 + ' now58=' + now58);""", 1)
        changed = True
        print('OK ①兜底补诊断')

# ② 夹具钉死 base
if 'rq58.base = 1e9; break; }\n    }' in d and '统一钉死' in d:
    print('SKIP ②钉死（已修）')
else:
    OLD2 = """    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; break; }
    }"""
    NEW2 = """    for (const e58 of G.state.quests.pool) {
      const d58 = G.randomQuestDef(e58.id);
      /* v89.6：**统一钉死** base=1e9 造"未达标" —— 只在扫描时判"未达标"不够：
         任务指标（金/粮…）在真实时间里增长，80ms 窗口内可能跨过目标，渲染时已达标 →
         had58 变真、断言假红（门禁实测 2/3）。钉死后 amount ≡ 0，确定性未达标。 */
      if (d58 && !d58.abs && !G.randQuestReady(e58)) { rq58 = e58; rq58.base = 1e9; break; }
    }"""
    if d.count(OLD2) == 1:
        d = d.replace(OLD2, NEW2, 1)
        changed = True
        print('OK ②钉死 base')
    else:
        print('!! ②锚点未命中', d.count(OLD2))

# ③ 诊断（若 ①走的是新写法则已含；否则补）
if 'had58=\' + had58' in d:
    print('SKIP ③诊断（已含）')
else:
    old3 = """      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58);"""
    new3 = """      const dbg58 = 'had58=' + had58 + ' now58=' + now58
        + ' ready=' + G.questSummary().ready + ' last=' + G._lastQuestReady
        + ' view=' + G.ui.view + ' inPool=' + G.state.quests.pool.some((e) => e === rq58)
        + ' amt=' + Math.round(G.randQuestAmount(rq58)) + '/goal=' + G.questGoal(G.randomQuestDef(rq58.id));
      check('★ 达标后无需手动刷新，主循环自动把它浮上去', !had58 && now58, dbg58);"""
    if d.count(old3) == 1:
        d = d.replace(old3, new3, 1)
        changed = True
        print('OK ③诊断')

if changed:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('e2e-test.js 已更新')
else:
    print('无改动')

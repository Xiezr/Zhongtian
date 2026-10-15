# -*- coding: utf-8 -*-
"""v89.151 批 A：data.js 三处（声望封顶 500 / 逐回合关键帧 / 缩放限幅配置）"""
import io, re, os

P = 'E:/Deepseekdb/js/data.js'
BAK = 'E:/Deepseekdb/backup/v89151/data.js.before'
s = io.open(P, encoding='utf-8', newline='').read()
bak = io.open(BAK, encoding='utf-8', newline='').read()


def rep(old, new, tag):
    global s
    if new in s and old not in s:
        print('SKIP(已落) ' + tag); return
    n = s.count(old)
    assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
    s = s.replace(old, new)
    print('OK ' + tag)


# ---------- ① 声望单场封顶 200 → 500（旧账：老板「封顶500声望吧」）----------
rep(
    """    cap: 200,            // 单场封顶""",
    """    /* v89.151（老板旧账 1）：「封顶500声望吧」—— 单场上限 200 → **500**。
       校准参照（v89.149 实测）：Lv5 野地 +2 · Lv9 +9 · 县城 +41 · 以少打多硬仗 +168；
       500 意味着只有"以寡击众的大歼灭"才摸顶（约占满级爵位门槛的 1/8 一档）。 */
    cap: 500,            // 单场封顶""",
    '① REP_RULE.cap 500')

# ---------- ② 关键帧 → 逐回合全覆盖（老板「逐个回合复盘有作用」）----------
rep(
    """  DATA.REPLAY = { maxFrames: 10, maxEv: 56 };""",
    """  /* v89.151（老板 4）：「关键帧数据影响大吗……我觉得**逐个回合复盘有作用**」——
     `maxFrames` 10 → **40**：战斗回合上限 30（tactic.MAX_ROUNDS），40 帧足以**逐回合全覆盖**
     （挑选逻辑先保首尾、再按关键节点补，超过才裁）。
     实测体积（5 回合 8 兵种一场）：10 帧 = 720 B；按帧均 72 B 外推，30 回合 ≈ 2.2 KB/场，
     战报上限 60 场 ≈ 130 KB —— 与"精确逐回合复盘"的价值比可以忽略（见 docs/v89151）。
     ⛔ 这不是"存全量帧"：帧里只有 军力/间距/条带/摘要（见 battle.replayFramesOf），
        逐兵种逐帧画面仍由**沙盘重跑**（存配方不存帧，v89.102）承担。 */
  DATA.REPLAY = { maxFrames: 40, maxEv: 56 };

  /* v89.151（老板 1）：「缩放加幅按你建议」—— 整幅画面等比缩放的**限幅**（唯一旋钮）：
     4K 屏（k≈2.4）不再无限放大、超小窗口不无限缩小；改这里即全站生效（fitAppSize 读它）。 */
  DATA.APP_SCALE = { min: 0.6, max: 1.6 };""",
    '② REPLAY.maxFrames + APP_SCALE')

assert '\r\n' not in s, '行尾被写成 CRLF'
assert s.count('cap: 500,') == 1 and s.count('maxFrames: 40') == 1 and s.count('DATA.APP_SCALE') == 1
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('data.js 落盘 OK · len=' + str(len(s)))

# -*- coding: utf-8 -*-
"""v89.126 补丁 B：人口增速口径落地（domain/state/ui 三处）
① domain.js    popGrowthOf：公式改「上限 ÷ fillHours（现实小时）」
② state.js     tickOnce：增量从 ×ts（游戏秒）改 ×dtReal（现实秒）
③ ui.js        侧栏悬停（写明现实时间 + 预计补满）、募兵「增势」文案、注释
安全：读→改→原子写→node --check；每处锚点 count==1 断言。
"""
import io, os, subprocess

R = r'E:/Deepseekdb'

def patch(rel, pairs):
    P = os.path.join(R, rel)
    s = io.open(P, encoding='utf-8').read()
    for i, (old, new) in enumerate(pairs):
        c = s.count(old)
        assert c == 1, '[%s] 锚点 %d 计数 %d（应为 1）\n%s' % (rel, i, c, old[:120])
        s = s.replace(old, new)
    tmp = P + '.tmp_v89126'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, P)
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    assert r.returncode == 0, '[%s] node --check 失败：%s' % (rel, r.stderr[:300])
    print('✓ %s（%d 处）' % (rel, len(pairs)))

# ── ① domain.js ──
patch('js/domain.js', [
    ("     现在两处同源：每小时 0.05% 量级，保底 1。 */",
     "     现在两处同源。v89.126（老板）：单位改为**人 / 现实小时**（补满 ≈ 2 小时），\n"
     "     与资源产量的\"游戏小时\"**不是同一把尺子** —— 见 DATA.POP_CFG。 */"),
    ("    var cfg = DATA.POP_CFG || {};\n"
     "    var base = Math.max(cfg.minPerHour == null ? 1 : cfg.minPerHour,\n"
     "      GAME.maxPopOf(city) * (cfg.base == null ? 0.0005 : cfg.base));",
     "    var cfg = DATA.POP_CFG || {};\n"
     "    /* v89.126：增速 = 上限 ÷ fillHours（**现实小时**）—— 固定时间速率，补满时长恒定\n"
     "       （旧公式\"上限 × 0.05%/游戏时 + 保底 1\"已退役：前期保底 1/时 补满要几百小时）。 */\n"
     "    var base = GAME.maxPopOf(city) / Math.max(0.1, cfg.fillHours == null ? 2 : cfg.fillHours);"),
])

# ── ② state.js ──
patch('js/state.js', [
    ("      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源） */\n"
     "      var R = GAME.res(city);\n"
     "      R.pop = R.pop || 0;\n"
     "      if (R.pop < maxPop) R.pop = Math.min(maxPop, R.pop + growth / 3600 * ts);",
     "      var growth = GAME.popGrowthOf(city);   /* v89.89（E3）：唯一出口（与募兵面板同源）；\n"
     "                                                v89.126 起单位 = 人 / **现实小时**（补满 ≈ 2 小时） */\n"
     "      var R = GAME.res(city);\n"
     "      R.pop = R.pop || 0;\n"
     "      /* v89.126：增量随口径改 —— 每现实小时 ÷ 3600 × **现实秒**（不再是 × 游戏秒 ts） */\n"
     "      if (R.pop < maxPop) R.pop = Math.min(maxPop, R.pop + growth / 3600 * dtReal);"),
])

# ── ③ ui.js（三处：注释口径 / 侧栏悬停 / 募兵增势文案） ──
patch('js/ui.js', [
    ("         增速走唯一出口 GAME.popGrowthOf（**每小时**口径，无需换算）；",
     "         增速走唯一出口 GAME.popGrowthOf（**现实每小时**口径 v89.126，无需换算）；"),
    ("        } catch (e) {}\n"
     "        return '<div class=\"res-line pop-line\"><span class=\"lbl\">👥 人口</span><span class=\"val\">' +",
     "        } catch (e) {}\n"
     "        /* v89.126：补满预计（现实时间）—— \"固定时间速率\"的可读化 */\n"
     "        var popEta = (popNow < maxPop && grow > 0)\n"
     "          ? '\\n约 ' + U.dur((maxPop - popNow) / (grow / 3600)) + '后补满（现实时间）' : '';\n"
     "        return '<div class=\"res-line pop-line\"><span class=\"lbl\">👥 人口</span><span class=\"val\">' +"),
    ("          '<span class=\"rate-wrap\" data-tip=\"人口增势（每小时）：民房上限决定基数' + popSrc +",
     "          '<span class=\"rate-wrap\" data-tip=\"人口增势（现实时间：基准 ' + ((DATA.POP_CFG || {}).fillHours || 2)\n"
     "            + ' 小时补满）：民房上限决定速率' + popSrc + popEta +"),
    ("          return '<span class=\"pop-3\" title=\"可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝每小时自然增长' + srcTxt + '\">' +",
     "          return '<span class=\"pop-3\" title=\"可征＝当前可用人口（募兵从此扣）· 上限＝民房决定 · 增势＝现实每小时自然增长（基准 2 小时补满）' + srcTxt + '\">' +"),
])

print('补丁 B 完成。')

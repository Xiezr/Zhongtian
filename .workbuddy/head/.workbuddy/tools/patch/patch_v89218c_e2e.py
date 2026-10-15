# -*- coding: utf-8 -*-
"""v89.218 · 故事系统退役 —— e2e-test.js 断言改写"""
import io

p = 'E:/Deepseekdb/e2e-test.js'
s = io.open(p, encoding='utf-8', newline='').read()
orig = len(s)


def rep(old, new, tag, expect=1):
    global s
    c = s.count(old)
    assert c == expect, '%s count=%d expect=%d' % (tag, c, expect)
    s = s.replace(old, new)
    print('  [ok] %s' % tag)


# ① 头部 rng 钩子
rep("  /* v89.29：逸闻奇遇 —— 测试期默认关闭随机触发（避免打断用例）；\n"
    "     触发链专测用 G.SG.TRIG.pin（指定篇目）/ rng 注入精确控制。 */\n"
    "  if (G.SG && G.SG.TRIG) G.SG.TRIG.rng = function () { return 0.999; };\n",
    "  /* ⛔ v89.218：逸闻奇遇触发钩子随故事系统退役（不再需要测试期 rng 钉死）。 */\n",
    '头部rng')

# ② §15 叙事层可见性（史册页 → 退役守卫）
rep("  console.log('\\n--- 15. 叙事层可见性 ---');\n"
    "  G.ui.setView('story');\n"
    "  await sleep(80);\n"
    "  const storyHtml = vc.innerHTML;\n"
    "  check('史册面板渲染', storyHtml.length > 300, storyHtml.length + ' 字符');\n"
    "  check('史册含天时栏', storyHtml.indexOf('天时') >= 0);\n"
    "  check('史册含时代之志', storyHtml.indexOf('时代之志') >= 0);\n"
    "  check('史册含实力折算', storyHtml.indexOf('实力折算') >= 0);\n"
    "  /* v89.104（老板「不要史书纪事了，没有什么实质内容」）：整段撤出 */\n"
    "  check('史册不含史书纪事（v89.104 已撤出：没有实质内容）', storyHtml.indexOf('史书纪事') < 0);\n"
    "  check('史册含称号评定', storyHtml.indexOf('当前评定') >= 0);\n",
    "  console.log('\\n--- 15. 叙事层可见性（v89.218：史册/故事集退役 · 保留天时） ---');\n"
    "  check('v89.218：史册 / 故事集两页签退役（顶栏无 · 视图函数无）', (function () {\n"
    "    return !document.querySelector('#topnav [data-view=\"story\"]')\n"
    "      && !document.querySelector('#topnav [data-view=\"stories\"]')\n"
    "      && typeof G.ui.storyHTML === 'undefined' && typeof G.ui.storiesHTML === 'undefined';\n"
    "  })());\n",
    '§15叙事层')

# ③ 羁绊断言（不再依赖 storyHtml）
rep("  check('羁绊不在界面暴露', storyHtml.indexOf('羁绊') < 0 && attrHtml.indexOf('羁绊') < 0);",
    "  check('羁绊不在界面暴露（v89.218：原查史册页 → 改查侧栏与顶栏）',\n"
    "    attrHtml.indexOf('羁绊') < 0 && (!skyEl || skyEl.textContent.indexOf('羁绊') < 0));",
    '羁绊断言')

# ④ 战事逸闻链（出兵用例内）—— 去 SG 包装，保留行军断言
rep("      /* v89.31：战事奇遇 —— pin 取「胜/败两池交集」指定必中（无论胜负都能命中） */\n"
    "      const _pw31 = G.SG.actPool('battle-win');\n"
    "      const _pl31 = G.SG.actPool('battle-lose');\n"
    "      const _set31 = {};\n"
    "      _pl31.fresh.concat(_pl31.done).forEach((r) => { _set31[r.st.id] = 1; });\n"
    "      const _ov31 = _pw31.fresh.concat(_pw31.done).filter((r) => _set31[r.st.id]);\n"
    "      const _pin31 = ((_ov31[0] || _pw31.fresh[0] || _pw31.done[0]).st || {}).id;\n"
    "      G.SG.TRIG.pin = _pin31; G.SG.TRIG._actAt = {};\n"
    "      const r23b = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, gen2.id);",
    "      const r23b = G.march.dispatch({ kind: 'wild', x: w23.x, y: w23.y }, 'raid', { yibing: 20000 }, gen2.id);",
    '战事逸闻-前置')
rep("        /* v89.31 战事触发链 → v89.86（P-06）待阅语义：\n"
    "           抵达结算命中 → 入待阅（不再全屏打断）→ 从待阅开卷 → 掩卷出列 */\n"
    "        const fx31 = document.querySelector('#story-fx');\n"
    "        const pend31 = (G.SG.pending() || []).some((x) => x.sid === _pin31);\n"
    "        check('★ v89.86（P-06）：战事触发 · 入待阅（相关建筑池 · ' + _pin31 + '）',\n"
    "          pend31 && (!fx31 || fx31.style.display === 'none'));\n"
    "        G.ui.sgReadPending(_pin31);\n"
    "        await sleep(40);\n"
    "        /* ⚠️ 阅读器元素可能在本用例**首次创建** —— 必须重查，不能沿用开卷前抓的引用（否则是 null） */\n"
    "        const fx31b = document.querySelector('#story-fx');\n"
    "        check('★ v89.86（P-06）：从待阅开卷（同一阅读器 · ' + _pin31 + '）',\n"
    "          !!fx31b && fx31b.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === _pin31);\n"
    "        const ex31 = fx31b && fx31b.querySelector('[data-action=\"story-exit\"]');\n"
    "        if (ex31) { click(ex31); await sleep(30); }\n"
    "        check('★ v89.86（P-06）：掩卷收起 · 待阅已出列', !!fx31b && fx31b.style.display === 'none'\n"
    "          && !(G.SG.pending() || []).some((x) => x.sid === _pin31));\n"
    "        G.SG.TRIG.pin = null; G.SG.TRIG._actAt = {};\n",
    "        /* v89.218：原「战事逸闻触发链」断言（v89.31 / v89.86 P-06）随故事系统退役；\n"
    "           抵达结算本身由上方两条断言守（兵力去向 / 将领恢复）。 */\n",
    '战事逸闻-后置')

# ⑤ 菜单顺序
rep("    check('菜单分组顺序正确（场景→军事[将领/军务/任务]→商背→记录→系统）', (function () {\n"
    "      const order = ['city', 'ext', 'map', null, 'generals', 'marches', 'tasks', null,\n"
    "        'shop', 'bag', null, 'story', 'stories', 'reports', null, 'auto', 'settings'];",
    "    check('菜单分组顺序正确（场景→军事[将领/军务/任务]→商背→公文→系统 · v89.218 史册/故事集退役）', (function () {\n"
    "      const order = ['city', 'ext', 'map', null, 'generals', 'marches', 'tasks', null,\n"
    "        'shop', 'bag', 'collection', null, 'reports', null, 'auto', 'settings'];",
    '菜单顺序')
rep("      return k >= 16;\n"
    "    })());\n"
    "\n"
    "    G.ui.setView('reports');",
    "      return k >= order.length - 1;   /* v89.218：序列长度随页签退役自适应 */\n"
    "    })());\n"
    "\n"
    "    G.ui.setView('reports');",
    '菜单阈值')

# ⑥ e2e §81 整段（真实点击）→ 退役守卫
i0 = s.index("  console.log('');\n"
             "  console.log('--- 81. 文字游戏 · 故事库（真实点击 · v2 结构） ---');")
i1 = s.index("  console.log('');\n"
             "  console.log('--- 82. v89.7 · 头像可更换（真实点击） ---');", i0)
SEC81 = (
    "  console.log('');\n"
    "  console.log('--- 81. 故事库退役（v89.218 · 零残留守卫） ---');\n"
    "  (function () {\n"
    "    check('★ v89.218：故事系统整条退役（SG 引擎 / 阅读器 / 待阅 / 页签 四清）', (function () {\n"
    "      return typeof G.SG === 'undefined'\n"
    "        && typeof G.ui.openStory === 'undefined' && typeof G.ui.sgReadPending === 'undefined'\n"
    "        && typeof G.ui.sgTryAct === 'undefined' && typeof G.ui.sgPendingHTML === 'undefined'\n"
    "        && !document.querySelector('#story-fx')\n"
    "        && !document.querySelector('#topnav [data-view=\"story\"]')\n"
    "        && !document.querySelector('#topnav [data-view=\"stories\"]');\n"
    "    })());\n"
    "  })();\n"
    "\n"
)
s = s[:i0] + SEC81 + s[i1:]
print('  [ok] §81 整段')

# ⑦ C4 故事集 → 退役守卫
i0 = s.index("    /* ④ C4 故事集：渲染 + 点击重读（真实 DOM） */")
i1 = s.index("    /* ⑤ E3 人口三段条（真实 DOM：募兵页兵种卡） */", i0)
SEC_C4 = (
    "    /* ④ C4 故事集（v89.218 退役）：原「渲染 + 点击重读」断言随视图删除 */\n"
    "    check('v89.218：故事集视图退役（真调 setView 不渲染 · 页签不在）', (function () {\n"
    "      G.ui.setView('stories');\n"
    "      var vcC = document.querySelector('#view-container');\n"
    "      var t = (vcC ? vcC.textContent : '') || '';\n"
    "      G.ui.setView('city');\n"
    "      return t.indexOf('故事集') < 0 && typeof G.ui.storiesHTML === 'undefined'\n"
    "        && !document.querySelector('#topnav [data-view=\"stories\"]');\n"
    "    })());\n"
    "\n"
)
s = s[:i0] + SEC_C4 + s[i1:]
print('  [ok] C4')

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('e2e 改写完成（%d → %d 字节）' % (orig, len(s)))

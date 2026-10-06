# -*- coding: utf-8 -*-
"""v89.202 批次C：断言升级 + 版本号 + 侦查面板注释留档
—— e2e §196 用例（清零造局连峰值一起清 · 备份还原）
   main.js 版本号 v89.202 + openScoutResult 头注（可下拉裁决留档）
   smoke §199④ 版本断言随轮升级"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

# ============================================================
# C1 · e2e §196 用例：清零造局连峰值一起清（v89.202 规则变更）
# ============================================================
rep('C1a e2e §196 备份+清零', R + 'e2e-test.js',
    "    const _bkStats196 = G.state.stats, _bkRep196 = G.state.rep, _bkRank196 = G.state.rank,\n"
    "      _bkCollect196 = G.state.collect;\n"
    "    try {\n"
    "      /* ① 清零条件（全锁）→ 打开收藏 → 有 .col-card.locked */\n"
    "      G.state.stats = {}; G.state.rep = 0; G.state.rank = 0; G.state.collect = {};",
    "    const _bkStats196 = G.state.stats, _bkRep196 = G.state.rep, _bkRank196 = G.state.rank,\n"
    "      _bkCollect196 = G.state.collect, _bkPeak196 = G.state.collectPeak;\n"
    "    try {\n"
    "      /* ① 清零条件（全锁）→ 打开收藏 → 有 .col-card.locked\n"
    "         v89.202（峰值机制上线）：条件判定改读\"历史最高\"（s.collectPeak）——\n"
    "         \"清零造局\"必须**连峰值一起清**（否则前序用例记录过的高峰值会让条件保持解锁）；\n"
    "         finally 一并还原（用例自己摆的自己收）。 */\n"
    "      G.state.stats = {}; G.state.rep = 0; G.state.rank = 0; G.state.collect = {};\n"
    "      G.state.collectPeak = {};",
    "G.state.collectPeak = {};")

rep('C1b e2e §196 还原峰值', R + 'e2e-test.js',
    "    } finally {\n"
    "      G.state.stats = _bkStats196; G.state.rep = _bkRep196; G.state.rank = _bkRank196;\n"
    "      G.state.collect = _bkCollect196;\n"
    "    }",
    "    } finally {\n"
    "      G.state.stats = _bkStats196; G.state.rep = _bkRep196; G.state.rank = _bkRank196;\n"
    "      G.state.collect = _bkCollect196; G.state.collectPeak = _bkPeak196;\n"
    "    }",
    "_bkPeak196 = G.state.collectPeak;")

# ============================================================
# C2 · main.js：版本号 v89.202
# ============================================================
rep('C2 版本号', R + 'js/main.js',
    "  GAME.VERSION = 'v89.201';",
    "  GAME.VERSION = 'v89.202';",
    "GAME.VERSION = 'v89.202';")

# ============================================================
# C3 · smoke §199④：版本断言随轮升级
# ============================================================
rep('C3 smoke 版本断言', R + 'smoke-test.js',
    "      return /GAME\\.VERSION = 'v89\\.201'/.test(mS199)   /* v89.201：版本号每轮迭代更新（本条随轮升级） */",
    "      return /GAME\\.VERSION = 'v89\\.202'/.test(mS199)   /* v89.202：版本号每轮迭代更新（本条随轮升级） */",
    "'v89\\.202'/.test(mS199)")

# ============================================================
# C4 · main.js openScoutResult 头注：可下拉裁决留档（含分页备选）
# ============================================================
rep('C4 侦查注释留档', R + 'js/main.js',
    "   *   后实测 over=0。旧硬规矩继续守：弹窗内不滚动；未解锁层显示锁定行\n"
    "   *   （锁着的东西也要让人看见它在哪儿，玩家才知道该去升什么）。\n"
    "   * ------------------------------------------------------------ */",
    "   *   后实测 over=0。旧硬规矩继续守：弹窗内不滚动；未解锁层显示锁定行\n"
    "   *   （锁着的东西也要让人看见它在哪儿，玩家才知道该去升什么）。\n"
    "   * ⛔ v89.202（老板 2）：「侦查报告可下拉，或各板块信息分页（以板块名称为页码）」——\n"
    "   *   采纳**可下拉**（现状即成立：本面板走裸 openModal，.inner-panel 是\n"
    "   *   overflow-y:auto 的滚动容器；诊断实测：内容溢出 237px 时可滚、滚到底内容可见；\n"
    "   *   常规载荷 over=0 零滚动）。与「一页显示」不冲突：装得下零滚动、装满时可下拉看全，\n"
    "   *   信息零隐藏。\n"
    "   *   分页备选（以板块名称为页码）未实施 —— ui.modalPage 组件现成，若要一句话可切。\n"
    "   * ------------------------------------------------------------ */",
    "采纳**可下拉**（现状即成立：本面板走裸 openModal")

print('批次C 完成')

# -*- coding: utf-8 -*-
"""v89.197 批次C：A批红单修复
① ui.js：expDefModsOf 的 defMul → wallMul（撞 §179① 克制负向断言 \bdefMul\b；改名避让）
② smoke 20553：兵仙下架后换在售代表（zhijun_zhidao）
③ smoke 21851：围困注脚改 opsNote 口径（'围困 · 守军与城防疲敝 −12%'）
④ smoke BASELINE102：+bingxian_yipian / bingsheng（下架档基线 23→25）
"""
import io

ROOT = 'E:/Deepseekdb/'

def rd(p):
    return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(p, tag, old, new, mark, cnt=1):
    s = rd(p)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c) + ' (expect ' + str(cnt) + ')'
    wr(p, s.replace(old, new))
    print('[ok] ' + tag)

# ① ui.js 改名（5 处）
rep('js/ui.js', 'C1a 注释',
    u"   * 返回 { garrisonMul, defMul, notes: [...] }（notes 供界面\"已计入\"提示）。",
    u"   * 返回 { garrisonMul, wallMul, notes: [...] }（notes 供界面\"已计入\"提示）。\n   * ⚠ 字段名用 wallMul（城防）不用 defMul —— defMul 是 v89.179 撤除的克制体系旧名，\n   *   smoke §179① 的负向断言按它扫（禁复活），本出口避让命名。",
    'wallMul（城防）不用 defMul')

rep('js/ui.js', 'C1b 初始化',
    u"    var out = { garrisonMul: 1, defMul: 1, notes: [] };",
    u"    var out = { garrisonMul: 1, wallMul: 1, notes: [] };",
    'var out = { garrisonMul: 1, wallMul: 1, notes: [] };')

rep('js/ui.js', 'C1c 围困折',
    u"      out.defMul *= (1 - cut);",
    u"      out.wallMul *= (1 - cut);",
    'out.wallMul *= (1 - cut);')

rep('js/ui.js', 'C1d 火烧折',
    u"          out.defMul *= (1 - Math.min(0.9, sc.eff.defCut * mul));",
    u"          out.wallMul *= (1 - Math.min(0.9, sc.eff.defCut * mul));",
    'out.wallMul *= (1 - Math.min(0.9, sc.eff.defCut * mul));')

rep('js/ui.js', 'C1e 消费点',
    u"      wall *= _mods197.defMul;",
    u"      wall *= _mods197.wallMul;",
    'wall *= _mods197.wallMul;')

# ② smoke 20553
rep('smoke-test.js', 'C2 20553 换在售代表',
    u"    return ['huyi', 'tianshi_ling', 'bingxian_yipian', 'taxue_an', 'corvee5', 'book_wuzi', 'chest_tianlu']",
    u"    /* v89.197（老板 S2）规则变更所致：兵仙遗篇下架（族内只保留练兵/治军）——\n       在售代表换成治军之道（仍验「新物品可在商城买到」的接线）。 */\n    return ['huyi', 'tianshi_ling', 'zhijun_zhidao', 'taxue_an', 'corvee5', 'book_wuzi', 'chest_tianlu']",
    'C2 换在售代表')

# ③ smoke 21851
rep('smoke-test.js', 'C3 21851 opsNote 口径',
    u"      return S94.reports.length === n0 + 1 && !!rep && rep.body.indexOf('围困 · 守军疲敝 −12%') >= 0;",
    u"      /* v89.197（老板 1）规则变更所致：围困注脚独立成【战法】行（全量三条效果）——\n         旧判据查 schemeNote 口径，按 opsNote 口径重写。 */\n      return S94.reports.length === n0 + 1 && !!rep\n        && rep.body.indexOf('【战法】围困 · 守军与城防疲敝 −12% · 破防 +50% · 行军 +50%') >= 0;",
    'C3 opsNote 口径')

# ④ smoke BASELINE102
rep('smoke-test.js', 'C4 基线 +2',
    u"""    var BASELINE102 = ['bingfa_xinde', 'zhixuesan', 'dahuandan', 'hanxue_mabian',
      'chest_jin', 'pijiang_shouji', 'xiaowei_zhaji', 'jiangjun_zhanlu', 'dudu_bingfa',
      'mingjiang_xinchuan', 'taigong_bingshu', 'jinchuang_san', 'shengji_gao', 'huiqi_dan',
      'peiyuan_dan', 'guben_dan', 'shengxin_wan', 'jingxin_dan', 'huanhun_lu',
      'yule_maju', 'zhaoye_an', 'zhuifeng_an', 'chest_zitan'];""",
    u"""    var BASELINE102 = ['bingfa_xinde', 'zhixuesan', 'dahuandan', 'hanxue_mabian',
      'chest_jin', 'pijiang_shouji', 'xiaowei_zhaji', 'jiangjun_zhanlu', 'dudu_bingfa',
      'mingjiang_xinchuan', 'taigong_bingshu', 'jinchuang_san', 'shengji_gao', 'huiqi_dan',
      'peiyuan_dan', 'guben_dan', 'shengxin_wan', 'jingxin_dan', 'huanhun_lu',
      'yule_maju', 'zhaoye_an', 'zhuifeng_an', 'chest_zitan',
      /* v89.197（老板 S2）：兵仙遗篇 / 千古兵圣**下架**（族内只保留练兵/治军两档）——
         与其它下架档同列为渠道缺口基线（存量可用、无新获取渠道）。 */
      'bingxian_yipian', 'bingsheng'];""",
    'v89.197（老板 S2）：兵仙遗篇 / 千古兵圣**下架**')

print('批次 C 完成')

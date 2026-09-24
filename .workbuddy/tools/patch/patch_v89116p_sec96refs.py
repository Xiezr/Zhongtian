# -*- coding: utf-8 -*-
"""v89.116 补丁 P：§96 追加"同族 bug 清剿 + 未定义引用审计"三条断言"""
import io, os, sys

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8').read()

ANCHOR = """    console.log('  --- ＋ bug：守将函数名笔误（guardOf）---');"""
ADD = """    console.log('  --- ＋ 同族 bug 清剿：引用了不存在的成员 ---');
    check('＋ 五处"引用不存在的成员"已换真出口（锦囊 / 体力上限 / 城档名 / 槽图标 / 物品名表）', (function () {
      var uu = stripComment(u96);
      var bb = stripComment(fs96.readFileSync(path96.join(__dirname, 'js', 'battle.js'), 'utf8'));
      var ss = stripComment(fs96.readFileSync(path96.join(__dirname, 'js', 'state.js'), 'utf8'));
      return uu.indexOf('GAME.itemCount') < 0 && /GAME\\.state\\.items \\|\\| \\{\\}\\)\\.jinang/.test(uu)
        && uu.indexOf('GAME.energyMax') < 0 && /GAME\\.staMax \\? GAME\\.staMax\\(g\\)/.test(uu)
        && bb.indexOf('DATA.CITY_TIER_NAME') < 0 && /GAME\\.cityTierName\\(\\{ type: npcCity\\.type \\}\\)/.test(bb)
        && uu.indexOf('DATA.EQUIP_SLOT_ICON') < 0
        && !!D96.ITEM_BY_ID && !!D96.ITEM_BY_ID.chest_tong && D96.ITEM_BY_ID.chest_tong.name === '青铜宝箱'
        && !!D96.SANDBOX && D96.SANDBOX.frameMs > 0
        && /GAME\\._realNowOf \\? GAME\\._realNowOf\\(\\) : U\\.now\\(\\)/.test(ss);   /* 拨钟钩子仍在 */
    })());
    check('＋ audit.js 已内置「引用了不存在的成员」审计（白名单须有理由）', (function () {
      var a = fs96.readFileSync(path96.join(__dirname, 'audit.js'), 'utf8');
      return /引用了不存在的成员/.test(a) && /REF_OK/.test(a)
        && /'GAME\\.onLog':/.test(a) && /'GAME\\._realNowOf':/.test(a)
        && /未定义引用 ' \\+ undefRefs\\.length/.test(a);
    })());
"""

if s.count(ANCHOR) != 1:
    print('!! 锚点 %d' % s.count(ANCHOR))
    sys.exit(1)
s = s.replace(ANCHOR, ADD + ANCHOR, 1)
tmp = P + '.tmp116p2'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
print('  → 落盘 smoke-test.js（§96 追加两条）')

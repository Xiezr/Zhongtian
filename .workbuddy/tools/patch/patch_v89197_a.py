# -*- coding: utf-8 -*-
"""v89.197 批次A：S2 经验道具两档制 + 战法可见性（估算计入 + 战报【战法】行）
① data.js：练兵 1万金 / 治军 50万面额+5万金 / 兵仙·兵圣下架
② battle.js：围困注脚独立成行（opsNote）· 随会话走 · 战报【战法】行
③ ui.js：expDefModsOf（战法/计略守军修正唯一出口）· expPowerOf 计入 · 界面提示
④ smoke-test.js：两条旧断言升级为两档制口径
"""
import io, sys

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

# ══════════ ① data.js ══════════
rep('js/data.js', 'A1a 头注更新',
    u"""     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）**未动**（延续 v89.73 / v89.104）。
     * 调平衡只改这张表：amount = 固定面额（整数万），price = 内部价。""",
    u"""     * ⚠️ 价格（内部价 · 商城实售 = price × 100 金）。
     * ------------------------------------------------------------
     * v89.197（老板 S2 拍板）：「只保留练兵经验，治军之道；治军降低为+50万，
     *   练兵经验1万金，治军价格相应调整」——
     *   · 在售收敛为**两档**：练兵经验（10 万面额 / 实售 1 万金）、
     *     治军之道（面额 100 万 → **50 万** / 实售 5 万金 —— "价格相应调整"
     *     按练兵的新价效比折算：10 万面额 = 1 万金 ⇒ 50 万面额 = 5 万金）；
     *   · 兵仙遗篇 / 千古兵圣 **下架**（noShop，存量可用）——族内在售只余两档；
     *   · 防跳级实算：练兵每金经验 125 → **10**（涨 12.5×）；治军每金经验
     *     52 → **10**（涨 5.2×）——"后期纯买道具跳级"的口子按老板数字收口。
     * 调平衡只改这张表：amount = 固定面额（整数万），price = 内部价。""",
    'v89.197（老板 S2 拍板）')

rep('js/data.js', 'A1b 练兵价',
    u"      { id: 'lianbing_jingyan', name: '练兵经验',   amount: 100000,  price: 8,     was: [100, 10] },",
    u"      { id: 'lianbing_jingyan', name: '练兵经验',   amount: 100000,  price: 100,   was: [100, 10] },   /* v89.197：价 8→100（实售 1 万金） */",
    'v89.197：价 8→100')

rep('js/data.js', 'A1c 治军行',
    u"      { id: 'zhijun_zhidao',    name: '治军之道',   amount: 1000000, price: 192,   was: [10000, 300] },",
    u"      { id: 'zhijun_zhidao',    name: '治军之道',   amount: 500000,  price: 500,   was: [10000, 300] }, /* v89.197：面额 100万→50万 · 价 192→500（实售 5 万金） */",
    'v89.197：面额 100万→50万')

rep('js/data.js', 'A1d 兵仙下架',
    u"    { id: 'bingxian_yipian', name: '兵仙遗篇', type: 'exp', amount: 1000000, price: 14000, desc: '将领经验+1000000' },",
    u"    { id: 'bingxian_yipian', noShop: true, /* v89.197（老板 S2）：族内只保留练兵/治军两档在售 */ name: '兵仙遗篇', type: 'exp', amount: 1000000, price: 14000, desc: '将领经验+1000000' },",
    'v89.197（老板 S2）：族内只保留练兵')

rep('js/data.js', 'A1e 兵圣下架',
    u"    { id: 'bingsheng', name: '千古兵圣', type: 'exp', amount: 20000000, price: 150000, desc: '将领经验+20000000' },",
    u"    { id: 'bingsheng', noShop: true, /* v89.197（老板 S2）：族内只保留练兵/治军两档在售 */ name: '千古兵圣', type: 'exp', amount: 20000000, price: 150000, desc: '将领经验+20000000' },",
    'v89.197（老板 S2）：族内只保留练兵/治军两档在售 */ name: \'千古兵圣\'')

# ══════════ ② battle.js ══════════
rep('js/battle.js', 'A2a opsNote 声明',
    u"    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;",
    u"""    var scArmy = t.garrison, scVal = defBonus, scGen = t.guard || null, scNote = null;
    /* v89.197（老板 1）：战法注脚**独立成行**（战报【战法】行）—— 不再混进【计谋】行，
       让"围困生效了"看得见（与 ui.expDefModsOf 读同一张表）。 */
    var opsNote = null;""",
    'A2a：战法注脚')

rep('js/battle.js', 'A2b 围困注脚拆分',
    u"        scNote = (scNote ? scNote + '；' : '') + '围困 · 守军疲敝 −' + Math.round(_ecCut * 100) + '%';",
    u"""        /* v89.197（老板 1）：独立【战法】行 —— 三条效果全量写出（读同一张表，不手抄数字） */
        var _ecChipM = (_ecCfg.chipMul == null ? 1.5 : _ecCfg.chipMul);
        var _ecMarchM = (_ecCfg.marchMul == null ? 1.5 : _ecCfg.marchMul);
        opsNote = '围困 · 守军与城防疲敝 −' + Math.round(_ecCut * 100) + '% · 破防 +'
          + Math.round((_ecChipM - 1) * 100) + '% · 行军 +' + Math.round((_ecMarchM - 1) * 100) + '%';""",
    'A2b：独立【战法】行')

rep('js/battle.js', 'A2c 重放读 opsNote',
    u"      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;",
    u"""      scGen = opts._sim.scGen || null; scNote = opts._sim.scNote || null;
      opsNote = opts._sim.opsNote || null;     /* v89.197：战法注脚随会话走（重放同源） */""",
    'A2c：战法注脚随会话走（重放同源）')

rep('js/battle.js', 'A2d sim 打包',
    u"             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},",
    u"""             scNote: simIn.scNote || null, simOpts: simIn.simOpts || {},
             opsNote: simIn.opsNote || null,  /* v89.197：围困【战法】注脚（打包不漏字段） */""",
    'A2d：围困【战法】注脚（打包不漏字段）')

rep('js/battle.js', 'A2e simIn 传递',
    u"        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, simOpts: simOpts,",
    u"        { scArmy: scArmy, scVal: scVal, scGen: scGen, scNote: scNote, opsNote: opsNote, simOpts: simOpts,",
    'A2e：optsNote 传递')

rep('js/battle.js', 'A2f result 写入',
    u"    if (scNote) result.schemeNote = scNote;",
    u"""    if (scNote) result.schemeNote = scNote;
    if (opsNote) result.opsNote = opsNote;      /* v89.197：战法注脚（战报【战法】行） */""",
    'A2f：战法注脚（战报')

rep('js/battle.js', 'A2g 战报组装',
    u"        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')",
    u"""        + (result.opsNote ? '<br>【战法】' + result.opsNote : '')
        + (result.schemeNote ? '<br>【计谋】' + result.schemeNote : '')""",
    'A2g：【战法】+')

# ══════════ ③ ui.js ══════════
rep('js/ui.js', 'A3a expDefModsOf',
    u"""  ui.expEstErrOf = function (lv) {
    lv = Math.max(0, Number(lv) || 0);
    return Math.max(0.10, Math.min(0.55, 0.55 - 0.07 * lv));
  };""",
    u"""  ui.expEstErrOf = function (lv) {
    lv = Math.max(0, Number(lv) || 0);
    return Math.max(0.10, Math.min(0.55, 0.55 - 0.07 * lv));
  };
  /* ============================================================
   * v89.197（老板 1）：「战法好像没发挥过作用」——军师估算不读战法/计略，
   *   选了围困守军数字纹丝不动（探针实证：实战效果真实，是**估算没接**）。
   * 本出口 = 战法/计略对守军侧的修正（估算用）——**与结算读同一张表**
   *   （battle._settleBattle 的 scArmy/scVal 修正逐项对应）：
   *   · 围困 → DATA.SIEGE.encircle.garrisonCut 对守军与城防各折一次；
   *   · 计略妖言/火烧 按 scheme.eff；奇袭再乘 DATA.SIEGE.surprise.schemeMul。
   * 返回 { garrisonMul, defMul, notes: [...] }（notes 供界面"已计入"提示）。
   * ============================================================ */
  ui.expDefModsOf = function () {
    var out = { garrisonMul: 1, defMul: 1, notes: [] };
    var S = DATA.SIEGE || {};
    var ops = GAME.opsIdOf(ui._expOps);
    if (ops === 'encircle' && S.encircle) {
      var cut = (S.encircle.garrisonCut == null ? 0.12 : S.encircle.garrisonCut);
      out.garrisonMul *= (1 - cut);
      out.defMul *= (1 - cut);
      out.notes.push('围困 −' + Math.round(cut * 100) + '%');
    }
    if (ui._expScheme && GAME.schemeOf) {
      var sc = GAME.schemeOf(ui._expScheme);
      var mul = (ops === 'surprise')
        ? ((S.surprise || {}).schemeMul == null ? 1.5 : S.surprise.schemeMul) : 1;
      if (sc && sc.eff) {
        if (sc.eff.guardPct) {
          out.garrisonMul *= (1 + sc.eff.guardPct * mul);
          out.notes.push(sc.name + ' −' + Math.round(-sc.eff.guardPct * mul * 100) + '%');
        }
        if (sc.eff.defCut) {
          out.defMul *= (1 - Math.min(0.9, sc.eff.defCut * mul));
          out.notes.push(sc.name + ' 城防 −' + Math.round(Math.min(0.9, sc.eff.defCut * mul) * 100) + '%');
        }
      }
    }
    return out;
  };""",
    'A3a：expDefModsOf')

rep('js/ui.js', 'A3b expPowerOf 计入',
    u"""      if (GAME.siegeScopeOf && GAME.siegeScopeOf(res)) {
        sgS = GAME.siegeScaleOf(res);
        base *= sgS.garrison;                 /* 守军随破防衰减 */
        wall *= sgS.def;                      /* 城防同步衰减 */
      }
      def = Math.round(base * (1 + wall));""",
    u"""      if (GAME.siegeScopeOf && GAME.siegeScopeOf(res)) {
        sgS = GAME.siegeScaleOf(res);
        base *= sgS.garrison;                 /* 守军随破防衰减 */
        wall *= sgS.def;                      /* 城防同步衰减 */
      }
      /* v89.197（老板 1）：**战法/计略修正计入估算**（与结算同一张表）——
         病根：估算不读战法 → 选围困后守军数字原样不动 → "战法好像没发挥作用"的体感来源。 */
      var _mods197 = ui.expDefModsOf();
      base *= _mods197.garrisonMul;
      wall *= _mods197.defMul;
      def = Math.round(base * (1 + wall));""",
    'A3b：计入估算')

rep('js/ui.js', 'A3c out.mods',
    u"      siege: sgS ? { hold: sgS.hold } : null,",
    u"""      siege: sgS ? { hold: sgS.hold } : null,
      mods: _mods197,                       /* v89.197：战法/计略修正（界面"已计入"提示用） */""",
    'A3c：战法/计略修正（界面')

rep('js/ui.js', 'A3d 界面提示行',
    u"""            (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '')""",
    u"""            (pw74.siege ? '<br><span style="opacity:.75;">🧱 围攻：守备 ' + Math.round(pw74.siege.hold)
              + '%（守军与城防已按此衰减）</span>' : '')
            /* v89.197（老板 1）：战法/计略生效提示 —— "估算是把战法算进去的"要说给玩家看 */
            + ((pw74.mods && pw74.mods.notes.length)
              ? '<br><span style="color:var(--green-ok);">⚔️ 战法/计略已计入：'
                + pw74.mods.notes.join(' · ') + '</span>' : '')""",
    'A3d：战法/计略生效提示')

# ══════════ ④ smoke-test.js ══════════
rep('smoke-test.js', 'A4a 9985 面额断言升级',
    u"""check('v89.173 经验道具面额固定（在售 4 档 = 10/100/300/450 万 · 无 capLv · 整数万 · desc 无旧上限文案）', (function () {
  var bad = [];
  var want = { lianbing_jingyan: 100000, zhijun_zhidao: 1000000, bingxian_yipian: 3000000, bingsheng: 4500000 };""",
    u"""check('§197 经验道具两档制（老板 S2：练兵10万/1万金 · 治军50万/5万金 · 兵仙·兵圣下架 · 无 capLv · 整数万）', (function () {
  var bad = [];
  var want = { lianbing_jingyan: 100000, zhijun_zhidao: 500000 };
  /* v89.197（老板 S2）：在售恰为两档 + 价格锚（实售 = 内部价 × 100） */
  var shopExp = [];
  (DATA.ITEMS || []).forEach(function (x) { if (x.type === 'exp' && !x.noShop) shopExp.push(x.id); });
  shopExp.sort();
  if (shopExp.join(',') !== 'lianbing_jingyan,zhijun_zhidao') bad.push('在售:[' + shopExp.join(',') + ']');
  var it197a = DATA.ITEM_BY_ID.lianbing_jingyan, it197b = DATA.ITEM_BY_ID.zhijun_zhidao;
  if (!it197a || it197a.price !== 100 || it197a.price * 100 !== 10000) bad.push('练兵价非1万金');
  if (!it197b || it197b.price !== 500 || it197b.price * 100 !== 50000) bad.push('治军价非5万金');""",
    'A4a：§197 经验道具两档制')

rep('smoke-test.js', 'A4b 31275 断言升级',
    u"""      check('§173① ★ 在售 4 档 = 老板拍板数字（练兵10万/治军100万/兵仙300万/兵圣450万）',
        it10.amount === 100000 && it30.amount === 1000000
        && itBx.amount === 3000000 && it60.amount === 4500000,
        [it10.amount, it30.amount, itBx.amount, it60.amount].join('/'));""",
    u"""      /* v89.197（老板 S2）规则变更所致：在售收敛为两档 —— 治军面额 100万→50万 ·
         练兵/治军价锚 · 兵仙/兵圣下架（旧"4 档 = 10/100/300/450 万"口径按此重写）。 */
      check('§197①（v89.173 口径修订）两档在售 = 老板数字（练兵10万·治军50万）+ 兵仙/兵圣已下架',
        it10.amount === 100000 && it30.amount === 500000
        && itBx.noShop === true && it60.noShop === true,
        [it10.amount, it30.amount, itBx.noShop, it60.noShop].join('/'));""",
    'A4b：§197①（v89.173 口径修订）')

print('批次 A 完成')

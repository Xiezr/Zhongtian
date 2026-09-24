# -*- coding: utf-8 -*-
"""v89.100-E：寄售通道支持类型白名单（only）+ 脑改为只卖战利品
首测发现：loot 无差别全卖 → 把买来的投资品（生产宝物/体力药/加速/符类）也变现了
→ 产线断裂、全面慢于 rush。老板假设的语义是「**攻击获得**的道具」→ 只卖掉落类。
① systems.consignList/consignAll 支持 opts.only（类型白名单）
② smoke 第 100 节加 E 段断言
③ consignBrain 传 only: ['jewel','material','seed','blueprint']"""
import io, subprocess

BASE = 'E:/Deepseekdb/'
S = [0]
def rep(path, old, new, tag):
    p = BASE + path
    s = io.open(p, encoding='utf-8').read()
    if new in s:
        print('SKIP ' + tag)
        return
    assert old in s, 'MISS: ' + tag
    s = s.replace(old, new, 1)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    S[0] += 1
    print('OK   ' + tag)

# ---------- ① systems.js：only 支持 ----------
rep('js/systems.js',
"""  S.consignList = function (opts) {
    var s = GAME.state, out = [];
    if (!s || !s.items) return out;
    var keep = (opts && opts.keep) || [];
    for (var id in s.items) {
      var n = s.items[id] || 0;
      if (n <= 0 || keep.indexOf(id) >= 0) continue;
      var unit = S.consignPriceOf(id);
      if (!(unit > 0)) continue;
      var it = S.itemInfo(id);
      out.push({ id: id, name: it ? it.name : id, type: it ? (it.type || '') : '', qty: n, unit: unit, total: unit * n });
    }""",
"""  S.consignList = function (opts) {
    var s = GAME.state, out = [];
    if (!s || !s.items) return out;
    var keep = (opts && opts.keep) || [];
    /* v89.100b：opts.only = 类型白名单（只列这些类型）。
       "攻击获得的道具变现"应只卖掉落类（jewel/material/seed/blueprint），
       别把买来的投资品（生产/体力/加速/符/内功）也卖了 —— 首测教训。 */
    var only = (opts && opts.only) || null;
    for (var id in s.items) {
      var n = s.items[id] || 0;
      if (n <= 0 || keep.indexOf(id) >= 0) continue;
      var unit = S.consignPriceOf(id);
      if (!(unit > 0)) continue;
      var it = S.itemInfo(id);
      if (only && only.indexOf(it ? (it.type || '') : '') < 0) continue;
      out.push({ id: id, name: it ? it.name : id, type: it ? (it.type || '') : '', qty: n, unit: unit, total: unit * n });
    }""",
'systems: only 支持')

# ---------- ② smoke：E 段断言 ----------
rep('smoke-test.js',
"""      return src.indexOf('data-action="consign-all"') >= 0
        && src.indexOf('data-action="consign-sell"') >= 0
        && srcM.indexOf('case ' + "'" + 'consign-sell' + "'" + ': GAME.doConsign') >= 0;
    })());

    G.state = oldState100;""",
"""      return src.indexOf('data-action="consign-all"') >= 0
        && src.indexOf('data-action="consign-sell"') >= 0
        && srcM.indexOf('case ' + "'" + 'consign-sell' + "'" + ': GAME.doConsign') >= 0;
    })());

    console.log('  --- E 类型白名单（only）：战利品变现只卖掉落类 ---');
    check('E1 only 过滤：只列珠宝/材料（经验书等投资品不列）', (function () {
      S100.items = { zhenzhu: 1, fatie: 1, lianbing_jingyan: 1 };
      var lst = G.systems.consignList({ only: ['jewel', 'material'] });
      var ids = lst.map(function (x) { return x.id; });
      return ids.indexOf('zhenzhu') >= 0 && ids.indexOf('fatie') >= 0
        && ids.indexOf('lianbing_jingyan') < 0;
    })());
    check('E2 only + consignAll：只卖白名单类型，投资品原样留存', (function () {
      S100.items = { zhenzhu: 2, fatie: 2, lianbing_jingyan: 2 };
      var r = G.systems.consignAll({ only: ['jewel', 'material'] });
      return r.ok === true && !S100.items.zhenzhu && !S100.items.fatie
        && S100.items.lianbing_jingyan === 2;
    })());
    S100.items = {};

    G.state = oldState100;""",
'smoke E 段')

# ---------- ③ 脑：only 传参 ----------
rep('.workbuddy/tools/playtest/play_rush_1x.js',
"""  var rich = richCity(); setCity(rich);
  var r = safeCall('loot.consign', function () { return G.systems.consignAll({ keep: keep }); });""",
"""  var rich = richCity(); setCity(rich);
  /* v89.100b：**只卖攻击掉落类**（珠宝/材料/种子/图纸）—— 老板假设 = "攻击获得的道具"。
     首测无差别全卖把买来的投资品（生产宝物/体力药/加速）也变现了 → 产线断裂、
     全面慢于 rush（军 1059 vs 4198）。投资品是买来的，卖掉 = 自断供给。 */
  var r = safeCall('loot.consign', function () {
    return G.systems.consignAll({ keep: keep, only: ['jewel', 'material', 'seed', 'blueprint'] });
  });""",
'脑 only 传参')

for f in ['js/systems.js', 'smoke-test.js']:
    r = subprocess.run(['node', '--check', BASE + f], capture_output=True)
    print(f + ': ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300]))
r = subprocess.run(['node', '--check', BASE + '.workbuddy/tools/playtest/play_rush_1x.js'], capture_output=True)
print('brain: ' + ('OK' if r.returncode == 0 else r.stderr.decode('utf-8', 'replace')[:300]))
print('--- total %d ---' % S[0])

# v89.177 补丁 C：断言升级 —— ① v89.65 突破断言（加"综合考验"闸：先拒后过）
#                            ② §174④ 拼接正则（heartsBox177 插入）
import io

ROOT = 'E:/Deepseekdb/'
p = ROOT + 'smoke-test.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

# ① v89.65 突破断言升级
old = """          /* ③ 段顶 + 修为够：跨段（上限 +60、修为扣掉、发自由点） */
          var need = G.lordCultivNeed(lord);
          lord.cultiv = need;
          var fp0 = lord.freePts || 0;
          var r = G.doLordBreak();
          return r.ok === true && lord.breaks === 1 && lord.cultiv === 0
            && G.genLevelCap(lord) === 120 && (lord.freePts || 0) > fp0;"""
new = """          /* ③ v89.177（老板「综合考验」）：段顶 + 修为够，但五关不过 → **拒**（提示综合考验） */
          var need = G.lordCultivNeed(lord);
          lord.cultiv = need;
          var r0 = G.doLordBreak();
          if (r0.ok !== false || !/综合考验/.test(r0.msg)) return false;
          /* ③b 灌满五关（政务 3 / 城池 2 / 兵力 5k / 持金 5w / 珠宝 2 种）→ 跨段。
                 ⚠️ 用例改状态要还原（§131 纪律）——失败前也要恢复。 */
          var bk = {
            done: G.state.quests.done,
            cities: G.state.cities.slice(),
            army: G.state.cities.map(function (c) { return c.army; }),
            items: JSON.parse(JSON.stringify(G.state.items || {})),
            gold: G.goldOf(),
          };
          var ok = false;
          try {
            G.state.quests.done = { qa: 1, qb: 1, qc: 1 };
            var c2 = JSON.parse(JSON.stringify(G.state.cities[0]));
            c2.id = 'p2-test'; c2.army = { yibing: 3000 };
            G.state.cities.forEach(function (c) { c.army = { yibing: 3000 }; });
            G.state.cities.push(c2);
            G.goldAdd(bk.gold >= 50000 ? 0 : (50000 - bk.gold));
            G.state.items.bengzhu = 2;
            G.state.items.mila = 1;
            var fp0 = lord.freePts || 0;
            var r = G.doLordBreak();
            ok = r.ok === true && lord.breaks === 1 && lord.cultiv === 0
              && G.genLevelCap(lord) === 120 && (lord.freePts || 0) > fp0;
          } finally {
            G.state.quests.done = bk.done;
            G.state.cities = bk.cities;
            bk.cities.forEach(function (c, i2) { c.army = bk.army[i2]; });
            G.state.items = bk.items;
            G.goldAdd(bk.gold - G.goldOf());
          }
          return ok;"""
assert s.count(old) == 1, '突破断言锚点 ' + str(s.count(old))
s = s.replace(old, new)

# ② §174④ 正则升级
old2 = """        && /guanfuBox \\+ queueBox174 \\+/.test(uS)"""
new2 = """        && /guanfuBox \\+ heartsBox177 \\+ queueBox174 \\+/.test(uS)   /* v89.177：「民心/民怨」段居中插入 */"""
assert s.count(old2) == 1, '174 正则锚点 ' + str(s.count(old2))
s = s.replace(old2, new2)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('DONE-C177')

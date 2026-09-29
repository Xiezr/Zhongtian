# -*- coding: utf-8 -*-
"""v89.167c：smoke §167（源码 + 真调三城）+ 需求档案补录。
   运行：python .workbuddy/tools/patch/patch_v89167c_smoke_archive.py"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


# ═══════════ ① smoke §167 ═══════════
sp = 'smoke-test.js'
s = rd(sp)
if '§167① 老全局闸门退役' in s:
    print('  [skip] smoke §167 已插')
else:
    ANCHOR = "\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    assert s.count(ANCHOR) == 1, '锚点=%d' % s.count(ANCHOR)
    NEW = '''
  /* ============================================================
   * §167（v89.167）：自动升级 —— **每城独立建造位**（逐城遍历、各自排满）
   * 老板原话：「自动升级建造，应该每个城池均遍历，分别升级，而不是所有城池一起，
   *   总共只升级 3 个建筑」—— 改前闸门 = 全境队列总数 vs buildSlots(当前城)（=3）。
   * ============================================================ */
  (function () {
    var fs167 = require('fs'), p167 = require('path');
    var d167 = fs167.readFileSync(p167.join(__dirname, 'js', 'domain.js'), 'utf8');
    console.log('\\n===== §167 自动升级 · 每城独立建造位 =====');
    check('§167① 老全局闸门退役（全境队列 vs 单城位 不再存在）+ 新出口 cityRoomOf 就位',
      d167.indexOf('if ((s.queues.build || []).length >= slots)') < 0
      && d167.indexOf('var cityRoomOf = function (ct) {') >= 0);
    check('§167② 每城独立口径：buildQueueUsed / buildSlots 逐城核对',
      /GAME\\.buildQueueUsed\\(ct\\.id\\) < GAME\\.buildSlots\\(ct\\)/.test(d167));
    check('§167③ 循环排满（第一条成功不再 return · doneN167 计数在册）',
      /var first167 = null, last167 = null, doneN167 = 0;/.test(d167)
      && /count: doneN167 \\};/.test(d167));

    /* ② 真调：三城各自排满（改前 count 上限 3） */
    var keep167 = GAME.state;
    try {
      GAME.newGame({ name: 's167', region: '司隶' });
      var sE = GAME.state;
      if (!sE.map.grid) GAME.map.generate();
      sE.rank = 6;                    /* 领地上限随爵位（v89.108）—— 平民只 2 城 */
      ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { GAME.res(GAME.currentCity())[k] = 600000; });
      GAME.res(GAME.currentCity()).gold = 300000;
      var MAXW = Math.min((GAME.DATA.MAP_W || 40) - 1, 60);
      for (var y = 1; y < MAXW && sE.cities.length < 3; y++) {
        for (var x = 1; x < MAXW && sE.cities.length < 3; x++) {
          var t = GAME.map.tile(x, y);
          if (!t || t.terrain !== 'plain') continue;
          var dup = false;
          (sE.wilds || []).forEach(function (w) { if (w.x === x && w.y === y) dup = true; });
          if (dup) continue;
          ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { GAME.res(GAME.currentCity())[k] = 600000; });
          sE.wilds.push({ x: x, y: y, type: 'plain', lv: 3 });   /* 先占野地再筑城（wildAt 查 s.wilds） */
          try { GAME.buildCityAt(x, y); } catch (e) { }
        }
      }
      sE.cities.forEach(function (c) {
        c.cells.forEach(function (x) { if (x.build && !x.official) x.build = null; });
        var gi = -1;
        for (var i = 0; i < c.cells.length; i++) { if (c.cells[i].official) { gi = i; break; } }
        c.cells[gi].build = { id: 'guanfu', lvl: 3 };
        var put = 0;
        for (var i2 = 0; i2 < c.cells.length && put < 4; i2++) {
          if (c.cells[i2].official || c.cells[i2].build) continue;
          c.cells[i2].build = { id: 'minfang', lvl: 1 };
          put++;
        }
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { GAME.res(c)[k] = 600000; });
      });
      check('§167 造局：3 城就绪（官府 lv3 + 民房×4/城）', sE.cities.length === 3, sE.cities.length + ' 城');
      sE.settings.autoUpgrade = true;
      sE.queues.build.length = 0;
      var r167 = GAME.autoUpgrade();
      var byCity167 = {};
      (sE.queues.build || []).forEach(function (q) { byCity167[q.cityId] = (byCity167[q.cityId] || 0) + 1; });
      check('§167④ ★ 真调三城：一次调用排入 > 3（改前全境上限 3 的铁证）',
        !!(r167 && r167.count > 3), 'count=' + (r167 && r167.count));
      check('§167⑤ ★ 每城都被遍历到（每城 ≥1 条）+ 各自封顶（≤ 该城位）',
        sE.cities.every(function (c) {
          var n = byCity167[c.id] || 0;
          return n >= 1 && n <= GAME.buildSlots(c);
        }),
        JSON.stringify(sE.cities.map(function (c) { return byCity167[c.id] || 0; })));
      check('§167⑥ 各城都被排满（= 该城建造位 · 资源/候选充足时）',
        sE.cities.every(function (c) { return (byCity167[c.id] || 0) === GAME.buildSlots(c); }),
        JSON.stringify(sE.cities.map(function (c) { return GAME.buildSlots(c); })));
    } finally { GAME.state = keep167; }

    /* ③ 档案在册 */
    var arc167 = fs167.readFileSync(p167.join(__dirname, '需求档案.md'), 'utf8');
    check('§167⑦ 需求档案在册（v89.167 · 老板原文关键句逐字）',
      arc167.indexOf('v89.167') >= 0
      && arc167.indexOf('每个城池均遍历，分别升级') >= 0
      && arc167.indexOf('总共只升级3个建筑') >= 0);
  })();
'''
    s = s.replace(ANCHOR, NEW + ANCHOR)
    wr(sp, s)
    print('  [ ok ] smoke §167 已插 · 新长度', len(s))

# ═══════════ ② 需求档案 ═══════════
ap = '需求档案.md'
a = rd(ap)
if 'v89.167' in a:
    print('  [skip] 档案 v89.167 已在')
else:
    anchor = '| v89.166 | 2026-09-27 | 1 |'
    i = a.find(anchor)
    assert i >= 0, '找不到 v89.166 总览行'
    j = a.find('\n', i)
    row = ('\n| v89.167 | 2026-09-27 | 1 | **自动升级 · 每城独立建造位**'
           '（老板：「应该每个城池均遍历，分别升级，而不是所有城池一起，总共只升级 3 个建筑」）—— '
           '改前闸门 = **全境队列总数 vs buildSlots(当前城)**（3 = 单城基础位）：全境排满 3 条即"队列已满"，'
           '其余城池永远轮不上；改后 = `cityRoomOf`（buildQueueUsed / buildSlots 逐城核对）+ 试建循环'
           '**排满各城空位**（不再"第一条成功就 return"）· 三城一次调用 **9 条**（改前上限 3） | '
           '已完成（详见 docs/v89167-自动升级每城独立.md） |')
    a = a[:j] + row + a[j:]

    detail = '''

---

## v89.167（自动升级 · 每城独立建造位 · 老板 1 条）

> **老板原文（逐字）**：
> 自动升级建造，应该每个城池均遍历，分别升级，而不是所有城池一起，总共只升级3个建筑

### ① 病根（"3"的来源）

`GAME.autoUpgrade` 的闸门（改前）：
```js
var slots = GAME.buildSlots(city);                        // 当前城的建造位（基础 3）
if ((s.queues.build || []).length >= slots) {             // ⛔ 全境队列总数 vs 单城位
  s.autoState = { paused: false, msg: '队列已满（' + slots + '）' };
  return null;
}
```
**全境一共排 3 条**（3 = 单城基础建造位）就判"队列已满"——其余城池永远轮不上，
玩家看到的就是"所有城池一起，总共只升级 3 个建筑"。且试建循环"第一条成功就 `return`"
（一次只排一条）——两者叠加 = 全境 3 条封顶。

### ② 修法

| # | 改前 | 改后 |
|---|---|---|
| 闸门 | 全境队列总数 vs `buildSlots(当前城)` | **`cityRoomOf(ct)`** = `buildQueueUsed(ct.id) < buildSlots(ct)`（两个既有出口逐城核对）+ "所有城都满"才报「各城队列已满（合 N 位在办）」 |
| 候选收集 | 全城收（满不满都收） | **跳过位满的城**（不是失败） |
| 试建循环 | 第一条成功就 `return`（一次一条） | **排满各城空位**（成功继续试；某城排满后其候选跳过；`doneN167` 计数）；`upgradeAt` 内部自带按城位检查，天然按城封顶 |
| 返回 | `{ ok, target }` | `{ ok, target: 第一条成功, last, count }`（target 语义兼容旧断言） |
| 文案 | "队列已满（3）" | "本轮排入 N 项（各城独立建造位）" / "各城队列已满（合 N 位在办）"；面板说明与开启提示同补 |

**`buildQueueUsed` / `buildSlots` 都是既有出口**（不新造口径）；
暂停语义保持 v89.160（全试遍仍无一可动 → paused；资源不足顺延）。

### ③ 实测证据

- **探针**（`probe_v89167_percity.js` · 10/0）：
  - ① 三城一次调用 → **count=9 · 各城在办 [3,3,3]**（改前上限 3）· 每城遍历 · 各自封顶 · 各城排满；
  - ② 资源只够每城 1 条 → **[1,1,1]**（分别升级 · 公平 —— 改前只排"首个城"的 1 条）；
  - ③ 全城资源清零 → 试遍 32 项 → 暂停（v89.160 语义保持）；
  - ④ 全城队满 → 「各城队列已满（合 9 位在办）」不 paused。
- **smoke**：新增 §167（7 条，含真调三城）；**4 条旧断言随口径升级**（"一次一条"化石：
  §21 三条 + 城墙跨城一条）。
- **e2e**（真 DOM）：造第二城 → 开自动升级 → 真调 → 逐城核对队列（见 §167 用例）。

### ④ 复现与验证

```bash
node .workbuddy/tools/probe/probe_v89167_percity.js    # 探针：10/0
node smoke-test.js                                      # §167 共 7 条
NODE_PATH="C:/Users/18811/.workbuddy/binaries/node/workspace/node_modules" node e2e-test.js
python .workbuddy/tools/git/gate.py --full
```

### ⑤ 诚实缺口

- 一次调用把"各城空位"尽量排满（受各城位与各自资源限）——调用频率仍是主循环每秒一次，
  排满后空转（等待施工完成腾位），行为正确但"每秒一次全量试"的开销随城数线性增长
  （当前量级可忽略；城数极大时可加"全部满位即短路"——已有：`some(cityRoomOf)` 早退）；
- 离线补算（tickOnce 序列）里同样按新口径排布——离线会更快把各城队列排满（设计一致）。
'''
    a = a.rstrip('\n') + detail
    wr(ap, a)
    print('  [ ok ] 档案已补 · 新长度', len(a))

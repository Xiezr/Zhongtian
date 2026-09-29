# -*- coding: utf-8 -*-
"""v89.169 补丁 B：测试与档案
C1. e2e：旧断言"未修建不画环" → 升级为"不画实墙、画虚影"（+虚影结构一条）
C2. smoke：新增 §169 段（8 条断言）
C3. 需求档案：总览行 + 明细段
"""
import io

R = 'E:/Deepseekdb/'
APPLIED = []


def rep(path, tag, old, new, guard=None):
    p = R + path
    s = io.open(p, 'r', encoding='utf-8', newline='').read()
    if guard and guard in s:
        print('  [skip] %s（已落盘）' % tag)
        return
    assert s.count(old) == 1, '%s：锚点计数=%d' % (tag, s.count(old))
    s = s.replace(old, new)
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] %s' % tag)
    APPLIED.append(tag)


# ════════════════ C1. e2e：旧断言升级 ════════════════
OLD1 = """  /* v89.128：环城视觉 = **城墙建筑的外观**（修了才画）—— 先验"未建不画"，再摆上验结构 */
  check('未修建城墙时不画环（v89.128：环城是城墙建筑的外观）', !vc.querySelector('svg.iso-wall'));"""
NEW1 = """  /* v89.128：环城视觉 = **城墙建筑的外观**（修了才画）= 完整形制只在建好后出现。
     v89.169（老板「城墙 0 级的时候不明显」）：0 级改画**虚线虚影环**（可见入口）——
     先验"实墙不画、虚影在"，再摆上验实墙结构。 */
  check('未修建城墙时：不画实墙环、画虚线虚影环（v89.169）',
    !vc.querySelector('svg.iso-wall:not(.iso-wall-ghost)')
    && !!vc.querySelector('svg.iso-wall-ghost'));
  check('虚影环结构：虚线描边 + 四角虚影角楼位（与实墙同一几何出口）', (function () {
    const g169e = vc.querySelector('svg.iso-wall-ghost');
    if (!g169e) return false;
    const p169e = g169e.querySelector('polygon.wghost-line');
    return !!p169e && (p169e.getAttribute('stroke-dasharray') || '').length > 0
      && g169e.querySelectorAll('rect.wghost-corner').length === 4;
  })());"""
rep('e2e-test.js', 'C1 e2e 旧断言升级', OLD1, NEW1,
    guard="未修建城墙时：不画实墙环、画虚线虚影环")

# ════════════════ C2. smoke：新增 §169 ════════════════
OLD2 = """      && arc167.indexOf('总共只升级3个建筑') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
NEW2 = """      && arc167.indexOf('总共只升级3个建筑') >= 0);
  })();

  /* ============================================================
   * §169（v89.169）：城墙 0 级虚影环
   * 老板原话：「城墙0级的时候不明显，整得明显一点」——
   *   改前 0 级（未修建 / 破城掉回 0）= `wall.build = null` → 墙环整段不画，
   *   城内视角一无所有；唯一入口（环城热区）隐形。
   *   现在 0 级画**虚线虚影环**（与实墙同一几何出口 wallRingGeom）。
   * 注：v89.168 为"经验曲线只读取证"轮（无代码变更 · 无断言节）。
   * ============================================================ */
  (function () {
    var fs169 = require('fs'), p169 = require('path');
    console.log('\\n===== §169 城墙 0 级虚影环 =====');
    var keep169 = GAME.state;
    try {
      GAME.newGame({ name: 's169', cityName: '许都', region: '豫州', mapSeed: 13 });
      var c169 = GAME.currentCity();

      var htmlG = GAME.ui.cityHTML();
      var g169 = htmlG.slice(htmlG.indexOf('<svg class="iso-wall iso-wall-ghost"'));
      g169 = g169.slice(0, g169.indexOf('</svg>') + 6);
      check('§169① 0 级（未修建）→ 虚线虚影环（墙基带 + 虚线 + 四角 · 无实墙形制）',
        htmlG.indexOf('iso-wall-ghost') >= 0
        && g169.indexOf('stroke-dasharray') >= 0
        && (g169.match(/wghost-corner/g) || []).length === 4
        && g169.indexOf('wtower') < 0 && g169.indexOf('wallBody') < 0);
      check('§169② 0 级热区不变（4 条 open-wall · 点虚影 = 修建入口）',
        (htmlG.match(/class="wall-hit /g) || []).length === 4);

      GAME.wallSlotOf(c169).build = { id: 'chengqiang', lvl: 3 };
      var htmlW = GAME.ui.cityHTML();
      var w169 = htmlW.slice(htmlW.indexOf('<svg class="iso-wall" '));
      w169 = w169.slice(0, w169.indexOf('</svg>') + 6);
      check('§169③ 已修建（Lv3）→ 实墙形制在位 + 虚影退场',
        htmlW.indexOf('wtower') >= 0 && htmlW.indexOf('url(#wallBody)') >= 0
        && htmlW.indexOf('iso-wall-ghost') < 0);
      check('§169④ ★ 几何同源：虚影与实墙 polygon points 逐字节一致（同一条带）', (function () {
        var a = /class="wghost-line" points="([^"]+)"/.exec(g169);
        var b = /<polygon points="([^"]+)"/.exec(w169);
        return !!a && !!b && a[1] === b[1];
      })());

      GAME.wallSlotOf(c169).build = null;         /* 破城掉回 0 的真实形态 */
      check('§169⑤ 掉回 0（build=null）→ 虚影回归（与未修建同态）',
        GAME.ui.cityHTML().indexOf('iso-wall-ghost') >= 0);

      var ui169 = fs169.readFileSync(p169.join(__dirname, 'js', 'ui.js'), 'utf8');
      check('§169⑥ 源码：几何唯一出口 + 两处 SVG 同读 + isoBoard 三态', (function () {
        return /ui\\.wallRingGeom = function/.test(ui169)
          && /ui\\.isoWallGhostSVG = function/.test(ui169)
          && (ui169.match(/ui\\.wallRingGeom\\(cols, rows\\)/g) || []).length >= 2
          && /opt\\.wall === 'ghost' \\? ui\\.isoWallGhostSVG/.test(ui169);
      })());
      var h169 = fs169.readFileSync(p169.join(__dirname, 'index.html'), 'utf8');
      check('§169⑦ CSS：虚影描边走主题金（4 主题自适应）+ 悬停提亮',
        h169.indexOf('.iso-wall-ghost .wghost-line') >= 0
        && h169.indexOf('.iso-wall-ghost .wghost-corner') >= 0
        && /\\.iso-board:has\\(\\.wall-hit:hover\\) \\.iso-wall-ghost \\{ filter: brightness\\(1\\.45\\); \\}/.test(h169));
    } finally { GAME.state = keep169; }

    var arc169 = fs169.readFileSync(p169.join(__dirname, '需求档案.md'), 'utf8');
    check('§169⑧ 需求档案在册（v89.169 · 老板原文关键句逐字）',
      arc169.indexOf('v89.169') >= 0
      && arc169.indexOf('城墙0级的时候不明显') >= 0
      && arc169.indexOf('整得明显一点') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
rep('smoke-test.js', 'C2 smoke §169 新段（8 条）', OLD2, NEW2,
    guard='§169 城墙 0 级虚影环')

# ════════════════ C3a. 档案总览行 ════════════════
OLD3 = """| v89.167 | 2026-09-27 | 1 | **自动升级 · 每城独立建造位**（老板：「应该每个城池均遍历，分别升级，而不是所有城池一起，总共只升级 3 个建筑」）—— 改前闸门 = **全境队列总数 vs buildSlots(当前城)**（3 = 单城基础位）：全境排满 3 条即"队列已满"，其余城池永远轮不上；改后 = `cityRoomOf`（buildQueueUsed / buildSlots 逐城核对）+ 试建循环**排满各城空位**（不再"第一条成功就 return"）· 三城一次调用 **9 条**（改前上限 3） | 已完成（详见 docs/v89167-自动升级每城独立.md） |"""
NEW3 = OLD3 + """
| v89.169 | 2026-09-27 | 1 | **城墙 0 级虚影环**（老板：「城墙0级的时候不明显，整得明显一点」）—— 改前 0 级（未修建 / 破城掉回 0）= `wall.build = null` → 墙环整段不画，城内视角一无所有、唯一入口（环城热区）隐形；改后 = 0 级画**虚线虚影环**（墙基土垄 + 虚线墙线 + 四角虚影角楼位），几何抽 `ui.wallRingGeom` 唯一出口（虚影与实墙**逐字节同一条带**）· `isoBoard` 三态（'ghost'/真值/假值）· 配色走 `--gold-rgb` 四主题自适应 + 悬停提亮 | 已完成（详见 docs/v89169-城墙0级虚影.md） |"""
rep('需求档案.md', 'C3a 档案总览行', OLD3, NEW3,
    guard='| v89.169 | 2026-09-27 | 1 |')

# ════════════════ C3b. 档案明细段 ════════════════
DETAIL = """
---

## v89.169（城墙 0 级虚影环 · 老板 1 条）

> **老板原文（逐字）**：
> 城墙0级的时候不明显，整得明显一点

### ① 病根（0 级 = 棋盘上"找不到墙"）

城墙 0 级有两个来源：**从未修建**与**破城掉回 0**（`state.js` 破防得手时
`_ws128.build = _nl128 <= 0 ? null : {...}` —— 掉到 0 直接置 `null`）。
而城内视角的墙环是"修了才画"（v89.128 口径）：

```js
wall: !!(c.wall && c.wall.build)     // ⛔ 0 级 → falsy → isoWallSVG 整段不画
```

叠加"城墙不在空格菜单候选里"（v89.128：入口 = 环城热区）→
**0 级时环不画、热区隐形、候选菜单没有它**：想修墙的人无迹可寻。

### ② 修法（0 级 = 虚线虚影环 · 可见入口）

| # | 改前 | 改后 |
|---|---|---|
| 视觉 | 0 级整圈不画 | **虚线虚影环**：墙基土垄带 + 虚线墙线（`stroke-dasharray="10 7"`）+ 四角虚影角楼位（虚线方框 ×4） |
| 几何 | 只在 `isoWallSVG` 内算 | 抽 **`ui.wallRingGeom`** 唯一出口 —— 实墙与虚影共用同一份四角/带宽（输出逐字节一致，改 `WALL_PX` 只动一处） |
| 三态 | `!!build` 二值 | `isoBoard` 认 `'ghost'` / 真值 / 假值三态；`cityHTML` 传 `build ? 'full' : 'ghost'` |
| 配色 | —— | `rgba(var(--gold-rgb), α)` 主题金（暗底发亮 / 浅底加深，四套主题自适应）+ 悬停 `brightness(1.45)` 再提一档 |
| 热区 | 隐形但可点 | **不变**（点虚影 = 打开「修建城墙」面板 · `data-build="chengqiang"`） |

**口径**：实墙（完整形制）↔ 虚影（待修建）—— 虚影**不表示等级**（等级只看面板）。

### ③ 边界与诚实缺口

- 破城掉回 0 与从未修建**同态**（都画虚影）——来源不同、待修建语义相同；
- 施工中（`wall.pending`）与 0 级同画虚影（进度看"在办" chip）——
  "施工中"专属形制（如半透明实体）未做，需要可加；
- 虚影醒目度以静帧为准（虚线 + 四角 + 悬停提亮），不做呼吸动画（全站除告警外无动画惯例）。

### ④ 验证（复现命令）

- 探针：`node .workbuddy/tools/probe/probe_v89169_wall.js`（改前：0 级一无所有）；
- 探针：`node .workbuddy/tools/probe/probe_v89169b_after.js`（改后 15/0 ·
  含「虚影 vs 实墙 polygon 逐字节一致」「破城掉 0 虚影回归」）；
- 实机与像素体检见 `docs/v89169-城墙0级虚影.md`。
"""
p = R + '需求档案.md'
s = io.open(p, 'r', encoding='utf-8', newline='').read()
if '## v89.169（城墙 0 级虚影环' in s:
    print('  [skip] C3b 档案明细段（已落盘）')
else:
    s = s.rstrip('\n') + '\n' + DETAIL
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    print('  [ ok ] C3b 档案明细段')
    APPLIED.append('C3b')

print('\n补丁 B 完成：%d 处落盘' % len(APPLIED))

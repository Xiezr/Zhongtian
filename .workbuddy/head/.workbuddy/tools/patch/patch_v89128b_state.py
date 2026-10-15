# -*- coding: utf-8 -*-
"""v89.128 补丁 B（state.js）：城墙回环城槽
   ① makeCity 初始化 city.wall
   ② 迁移段整合重写（删 v89.126 段；v16/v40 段重写并接管"城墙归一进环城槽"）
   ③ applyBuildDone 走 cellOf（'wall' 槽）
   ④ 守城战读墙等级清掉 wallLv 残留
   ⑤ 队列完成段注释更新
"""
import io

R = 'E:/Deepseekdb/'
P = R + 'js/state.js'
s = io.open(P, encoding='utf-8').read()
orig = s
n = 0


def rep(old, new, tag):
    global s, n
    assert s.count(old) == 1, '%s 锚点 %d 个' % (tag, s.count(old))
    s = s.replace(old, new)
    n += 1
    print('  ✓ ' + tag)


# ---------- ① makeCity 初始化 ----------
old1 = """    var total = city.col * city.row;
    for (var i = 0; i < total; i++) city.cells.push({ build: null, pending: null });
    /* 官府占 4 格：v68（老板）移回**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
       落位公式的唯一出口是 GAME.govCellsOf（makeCity / cityPlanOf / 旧档迁移共用）。
       城墙另存 city.wallLv（不占格，见 GAME.buildingLevel 特判）。 */"""
new1 = """    var total = city.col * city.row;
    for (var i = 0; i < total; i++) city.cells.push({ build: null, pending: null });
    /* v89.128（老板）：「城墙以**环城一圈的城墙结构**作为一个建筑（地位与城内建筑同），
       而不是占据城内一个地块」—— 城墙走**环城槽** `city.wall`（与 cell 同形，
       不占 48 格中的任何一格；建造/升级/拆除统一走 GAME.cellOf）。 */
    city.wall = { build: null, pending: null };
    /* 官府占 4 格：v68（老板）移回**正中央** —— 8×6 时占「第三行 4、5 与第四行 4、5」。
       落位公式的唯一出口是 GAME.govCellsOf（makeCity / cityPlanOf / 旧档迁移共用）。 */"""
rep(old1, new1, '① makeCity 初始化')

# ---------- ②a 删 v89.126 段（wallLv → 格子；新方案直接进槽，此段整删） ----------
m0 = '      /* ---- v89.126 迁移：城墙从 city.wallLv **搬回格子**（与其它建筑并列） ----'
m1 = '        delete c.wallLv;\n      });\n'
i0 = s.index(m0)
i1 = s.index(m1, i0) + len(m1)
s = s[:i0] + s[i1:]
n += 1
print('  ✓ ②a 删除 v89.126 段（含 v89.127 征用提示）')

# ---------- ②b v16/v40 段重写 + 城墙归一 ----------
j0 = s.index('      /* ---- v16 迁移 ----')
j1 = s.index('      /* ---- v68 迁移：官府从"右侧中部"移到"棋盘正中"')
new_block = """      /* ---- v16 / v40 / v89.126 / v89.128 迁移**整合重写**（城墙归一）----
         ① 官府 4 格：6×6 时代的"右侧中部" → 标准位（govCellsOf）
         ② 城内 6×6 → 8×6（48 格；队列 gridIndex 同步重映射）
         ③ 城墙**一律归一进环城槽** `city.wall`（v89.128 定稿：不占城内地块、地位与
            城内建筑同）：v89.126 档的"格子里城墙"与更老档的 `wallLv` 在此合流，
            旧痕（格子占用 / wallLv 字段）全删 —— 不留第二个等级出口。
            在建 / 升级中的城墙队列项，槽位从格号改成 'wall'。 */
      (st.cities || []).forEach(function (c) {
        if (!c || !c.cells) return;
        if (!c.wall) c.wall = { build: null, pending: null };
        /* ① 官府位置（仅 6×6 老档） */
        if (c.cells.length === 36) {
          var want = [4 + 6 * 2, 5 + 6 * 2, 4 + 6 * 3, 5 + 6 * 3];
          var has = [];
          c.cells.forEach(function (x, i) { if (x.official) has.push(i); });
          var same = has.length === want.length && has.every(function (i) { return want.indexOf(i) >= 0; });
          if (!same) {
            var gLv = 1;
            has.forEach(function (i) {
              if (c.cells[i].build && c.cells[i].build.id === 'guanfu') gLv = c.cells[i].build.lvl;
            });
            has.forEach(function (i) { c.cells[i].official = false; c.cells[i].build = null; c.cells[i].pending = null; });
            want.forEach(function (i) {
              c.cells[i].official = true;
              c.cells[i].build = { id: 'guanfu', lvl: gLv };
              c.cells[i].pending = null;
            });
          }
        }
        /* ② 6×6 → 8×6（48 格） */
        if (c.cells.length === 36 && (c.col || 6) === 6 && (c.row || 6) === 6) {
          var old36 = c.cells.slice(), gLv2 = 1;
          old36.forEach(function (x) { if (x.official && x.build) gLv2 = x.build.lvl; });
          var n48 = [];
          for (var i48 = 0; i48 < 48; i48++) n48.push({ build: null, pending: null });
          for (var r48 = 0; r48 < 6; r48++) {
            for (var c48 = 0; c48 < 6; c48++) {
              var fr = old36[r48 * 6 + c48], to = n48[r48 * 8 + c48];
              if (!fr || fr.official) continue;
              to.build = fr.build; to.pending = fr.pending;
            }
          }
          GAME.govCellsOf(8, 6).forEach(function (gi) {
            n48[gi].official = true;
            n48[gi].build = { id: 'guanfu', lvl: gLv2 };
          });
          c.cells = n48; c.col = 8; c.row = 6;
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId !== c.id || typeof q.gridIndex !== 'number' || q.gridIndex >= 36) return;
            q.gridIndex = Math.floor(q.gridIndex / 6) * 8 + (q.gridIndex % 6);
          });
        }
        /* ③ 城墙归一（格子 / wallLv → 环城槽） */
        var wlv128 = (c.wallLv != null) ? (c.wallLv || 0) : 0;
        c.cells.forEach(function (x, i) {
          if (!x.build || x.build.id !== 'chengqiang') return;
          if ((x.build.lvl || 0) > wlv128) wlv128 = x.build.lvl;
          ((st.queues && st.queues.build) || []).forEach(function (q) {
            if (q.cityId === c.id && q.gridIndex === i && q.buildId === 'chengqiang') q.gridIndex = 'wall';
          });
          x.build = null; x.pending = null;
        });
        delete c.wallLv;
        if (wlv128 > 0 && !c.wall.build) {
          /* 不静默（v89.127 精神）：改版提示写进消息流 —— 玩家翻得到"城墙去哪了" */
          c.wall.build = { id: 'chengqiang', lvl: wlv128 };
          var _m128 = '🏯 城墙调整：『' + c.name + '』城墙改为环城结构（不再占城内地块 · Lv' + wlv128 + '）';
          st.log = st.log || [];
          st.log.unshift({ t: U.now(), msg: _m128 });
          if (st.log.length > 40) st.log.pop();
          st.msgLog = st.msgLog || [];
          st.msgLog.push({ t: U.now(), gt: (st.world && st.world.elapsed) || 0, msg: _m128, k: 'sys' });
        }
      });
"""
s = s[:j0] + new_block + s[j1:]
n += 1
print('  ✓ ②b v16/v40 段整合重写')

# ---------- ③ applyBuildDone 走 cellOf ----------
old3 = """    var city = GAME.cityById(q.cityId);
    if (!city) return;
    var idx = q.gridIndex;
    var cell = city.cells[idx];
    if (!cell) return;"""
new3 = """    var city = GAME.cityById(q.cityId);
    if (!city) return;
    var idx = q.gridIndex;
    var cell = GAME.cellOf(city, idx);   /* v89.128：'wall' 槽同样生效 */
    if (!cell) return;"""
rep(old3, new3, '③ applyBuildDone')

# ---------- ④ 守城战读墙等级（清 wallLv 残留） ----------
old4 = "    var wallLv = city.wallLv || (GAME.buildingLevel ? (GAME.buildingLevel(city, 'chengqiang') || 0) : 0);"
new4 = "    var wallLv = GAME.buildingLevel ? (GAME.buildingLevel(city, 'chengqiang') || 0) : 0;   /* v89.128：环城槽经 buildingLevel 统一读 */"
rep(old4, new4, '④ 守城战读墙等级')

# ---------- ⑤ 队列完成段注释更新 ----------
old5 = """    /* v89.126：城墙并入通用路径（type 'build'/'upgrade' 的 cells 流程）——
       原 `type:'wall'` 分支（直接写 city.wallLv）退役，见老档迁移（loadGame）。 */"""
new5 = """    /* v89.126 / v89.128：城墙走通用路径（type 'build'/'upgrade'，槽位 'wall'）——
       环城槽与 cells 共用同一套 cellOf 访问器；两个旧时代的分支
       （wallLv 直写 / 找格）都已退役，见老档迁移（adoptState）。 */"""
rep(old5, new5, '⑤ 队列完成注释')

# ---------- 写前自检 ----------
assert s != orig and n == 6
assert 'city.wall = { build: null, pending: null };' in s
# wallLv 残留审核：逐个打印上下文（合法的：NPC 影子字段 / 迁移读取旧字段；其余必须清零）
import re as _re
_occ = _re.finditer('wallLv', s)
for _m in _occ:
    print('    [wallLv] …' + s[max(0, _m.start() - 50):_m.start() + 40].replace('\n', '⏎') + '…')


def bal(x):
    return (x.count('{') - x.count('}'), x.count('(') - x.count(')'))


assert bal(s) == bal(orig), '括号盈亏被改变 %s vs %s' % (bal(s), bal(orig))
io.open(P, 'w', encoding='utf-8').write(s)
print('patch B(state) OK · %d 处' % n)

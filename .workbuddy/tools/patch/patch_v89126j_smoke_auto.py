# -*- coding: utf-8 -*-
"""v89.126 补丁 J：重写「①城墙纳入自动建造」断言段（v64 旧口径 → v89.126 占格口径）"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

start = "  check('结构：自动升级把城墙当候选（不占格，等级在 city.wallLv）', (function () {"
end = "  })(), '两城各得一次城墙候选');"
assert s.count(start) == 1, 'start 计数 %d' % s.count(start)
i = s.find(start)
j = s.find(end, i)
assert j > i, 'end 未找到'

block = """  check('结构：自动升级把城墙当**普通候选**（cells 扫描天然包含，wall 特例已退役）', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    return body.indexOf("kind: 'wall'") < 0 && body.indexOf('wallPendingOf') < 0
      && /ct\\.cells\\.forEach/.test(body);
  })());
  check('结构：同级排序只剩「城内建筑（含城墙）→ 城外资源」', (function () {
    var body = codeOf(dmS, 'GAME.autoUpgrade = function');
    return /KIND_ORD = \\{ city: 0, ext: 2 \\}/.test(body)
      && /KIND_ORD\\[a\\.kind\\] - KIND_ORD\\[b\\.kind\\]/.test(body);
  })());
  /* 摆场：所有建筑拉高，城墙格 Lv1（最低）→ 自动升级第一目标必是城墙 */
  function putWall(st, name) {
    var c = st.cities[0];
    c.cells.forEach(function (x) {
      if (x.build && !x.official) x.build.lvl = Math.min(5, DATA.BUILDINGS[x.build.id].maxLevel);
    });
    (c.cells || []).forEach(function (x) { if (x.official) x.build.lvl = 12; });
    var put = false;
    for (var i = 0; i < c.cells.length && !put; i++) {
      var x = c.cells[i];
      if (!x.build && !x.official && !x.pending) { x.build = { id: 'chengqiang', lvl: 1 }; put = true; }
    }
    st.settings.autoUpgrade = true;
    st.queues.build.length = 0;
    ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
    return put;
  }
  check('实测：城墙格 Lv1（最低）时，自动升级第一目标就是它（普通候选排序）', (function () {
    return withState('v126wall1', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r = G.autoUpgrade();
      var tgt = r && r.target;
      return !!(r && r.ok && tgt) && c.cells[tgt.idx]
        && c.cells[tgt.idx].build && c.cells[tgt.idx].build.id === 'chengqiang';
    });
  })(), (function () {
    return withState('v126wall1b', function (st) {
      if (!putWall(st)) return '无空地';
      var r = G.autoUpgrade();
      return r && r.target ? (r.target.name + ' Lv' + r.target.lv + ' → Lv' + (r.target.lv + 1)) : '无动作';
    });
  })());
  check('实测：城墙已在施工队列时不再重复排队（cell.pending 与其它建筑同一查法）', (function () {
    return withState('v126wall2', function (st) {
      if (!putWall(st)) return false;
      var c = st.cities[0];
      var r1 = G.autoUpgrade();
      if (!(r1 && r1.ok && r1.target)) return false;
      var idxW = G.wallCellIdxOf(c);
      if (idxW < 0 || !(c.cells[idxW].pending)) return false;
      var r2 = G.autoUpgrade();
      var wallQ = st.queues.build.filter(function (q) { return q.buildId === 'chengqiang'; });
      /* 判据：城墙队列**只有一条**、且第二次不会再挑它（它已 pending） */
      return wallQ.length === 1 && !(r2 && r2.target && r2.target.idx === idxW);
    });
  })());
  check('实测：城墙满级后不再回到候选里（否则"全部满级"永远达不到）', (function () {
    return withState('v126wall3', function (st) {
      var c = st.cities[0];
      govMax(c);   /* 官府拉满 —— "全部满级"指该城上限，而不是官府总闸 */
      var capW = G.buildCapOf(c, 'chengqiang');
      var putW = false;
      for (var i = 0; i < c.cells.length && !putW; i++) {
        if (!c.cells[i].build && !c.cells[i].official) { c.cells[i].build = { id: 'chengqiang', lvl: capW }; putW = true; }
      }
      /* 其余建筑也拉满 → 必须报"全部建筑已满级（含城墙）" */
      c.cells.forEach(function (x) { if (x.build && DATA.BUILDINGS[x.build.id]) x.build.lvl = DATA.BUILDINGS[x.build.id].maxLevel; });
      (G.extGridOf(c) || []).forEach(function (e) { if (e && e.type) e.lv = DATA.MAX_BLEVEL; });
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      var r = G.autoUpgrade();
      return r === null && !!(st.autoState && st.autoState.done) && /含城墙/.test(st.autoState.msg || '');
    });
  })());
  check('实测：两座城各有城墙格时，自动升级按最低等级跨城轮流排（并列管理）', (function () {
    return withState('v126wall4', function (st) {
      var a = st.cities[0];
      var b = G.makeCity({ id: 'v126b', name: '副城', x: 9, y: 9, type: 'county',
        res: { grain: 1, wood: 1, stone: 1, iron: 1, gold: 1, pop: 1 } });
      st.cities.push(b);
      /* 两城都是：城墙 Lv1（最低）+ 其余拉高 */
      [a, b].forEach(function (c) {
        c.cells.forEach(function (x) {
          if (x.build && !x.official) x.build.lvl = Math.min(5, DATA.BUILDINGS[x.build.id].maxLevel);
        });
        (c.cells || []).forEach(function (x) { if (x.official) x.build.lvl = 12; });
        var put = false;
        for (var i = 0; i < c.cells.length && !put; i++) {
          var x = c.cells[i];
          if (!x.build && !x.official && !x.pending) { x.build = { id: 'chengqiang', lvl: 1 }; put = true; }
        }
        ['grain', 'wood', 'stone', 'iron'].forEach(function (k) { c.res[k] = 5000000; });
      });
      st.settings.autoUpgrade = true;
      st.queues.build.length = 0;
      var r1 = G.autoUpgrade();
      var r2 = G.autoUpgrade();
      var ids = [r1, r2].filter(function (r) { return r && r.target; })
        .map(function (r) { return r.target.cityId; });
      return ids.length >= 1 && ids.indexOf(b.id) >= 0 && ids.indexOf(a.id) >= 0;
    });
  })(), '两城各得一次城墙升级候选');"""

s = s[:i] + block + s[j + len(end):]
tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ smoke 补丁 J 完成（自动建造城墙段 5 条重写）')

# -*- coding: utf-8 -*-
"""v89.174a · 建造读秒与弹窗（老板 2 的症状）+ 「在建队列」段（老板 1）—— 主逻辑
复现（实机 3 支）：
  ① 格子："98% · 00:00" 且仍在建造中（round 误差，实测 5/60 帧）
  ② 施工中弹窗：完成后永远"建造中 + …"（该分支**没接 live**；正常态 v89.135 已接）
  ③ 队列完成 + 自动升级同 tick 补队 → length 不变 → 主循环漏刷（隐患）
改动：
  state.js · U.durExact round→ceil（全站倒计时同源）· tickOnce 完成处置 _buildDirty
  domain.js · 抽 GAME.buildProgressOf(q)（buildProgress 与在建队列列表共用唯一出口）
  ui.js   · openBuildModal(idx, cityId) 锁城 · 施工中/正常态统一 liveFn174 · 官府格「在建队列」段
            · updateProgress 非数字槽位原样传（'wall'）
  main.js · 主循环完成判据补 _buildDirty
"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

# ============================================================
# A. state.js
# ============================================================
print('== state.js ==')

edit('js/state.js', 'A1 durExact round→ceil',
  r'''  U.durExact = function (sec) {
    sec = Math.max(0, Math.round(sec));''',
  r'''  /* v89.174（老板 2）：「读秒完成后，状态还是在建造中」——根因之一 = **显示先行**：
     倒计时用 round，"还剩 0.4 秒"被显示成 "00:00"，但 tick 还没到 → 玩家看到
     "00:00 却仍在施工"最多一个 tick（非整除时长时必现，实测 5/60 帧）。
     改 **ceil**（向上取整 = "至少还需这么久"）：显示 0 只在真完成时出现
     （完成即 splice，不再有"00:00 但未完成"）。全站倒计时（建造/行军/成熟）同源受益。 */
  U.durExact = function (sec) {
    sec = Math.max(0, Math.ceil(sec));''')

edit('js/state.js', 'A2 tickOnce 完成脏标记',
  r'''    /* 6) 建造队列 */
    for (var i = s.queues.build.length - 1; i >= 0; i--) {
      var q = s.queues.build[i];
      q.elapsed += dtReal * ts;
      if (q.elapsed >= q.totalTime) {
        s.queues.build.splice(i, 1);
        GAME.applyBuildDone(q);
      }
    }''',
  r'''    /* 6) 建造队列 */
    for (var i = s.queues.build.length - 1; i >= 0; i--) {
      var q = s.queues.build[i];
      q.elapsed += dtReal * ts;
      if (q.elapsed >= q.totalTime) {
        s.queues.build.splice(i, 1);
        GAME.applyBuildDone(q);
        /* v89.174：完成**脏标记** —— 主循环重绘不能只比队列条数：
           完成 1 条 + 自动升级同 tick 补 1 条时 length 不变（"读秒完了还是建造中"的另一成因）。 */
        GAME._buildDirty = true;
      }
    }''')

# ============================================================
# B. domain.js —— buildProgressOf 抽取
# ============================================================
print('== domain.js ==')

edit('js/domain.js', 'B1 buildProgressOf 抽取',
  r'''      if (hit) {
        var pct = Math.min(100, Math.floor(q.elapsed / q.totalTime * 100));
        var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
        return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
      }
    }
    return null;
  };''',
  r'''      if (hit) return GAME.buildProgressOf(q);
    }
    return null;
  };
  /* v89.174：按**队列对象**取进度（唯一出口）—— 按格子查（buildProgress）与
     官府面板「在建队列」列表（按队列逐条列）共用，别处不许各算一份。 */
  GAME.buildProgressOf = function (q) {
    if (!q) return null;
    var pct = Math.min(100, Math.floor(q.elapsed / q.totalTime * 100));
    var left = Math.max(0, (q.totalTime - q.elapsed) / GAME.timeScale());
    return { pct: pct, left: left, label: pct + '% · ' + U.durExact(left) };
  };''')

# ============================================================
# C. ui.js
# ============================================================
print('== ui.js ==')

# C1 签名 + 锁城 + 空城守卫
edit('js/ui.js', 'C1 openBuildModal 签名',
  r'''  ui.openBuildModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' = 环城槽（不占格） */
    ui._curGrid = idx;''',
  r'''  ui.openBuildModal = function (idx, cityId) {
    /* v89.174：cityId 可选 —— 弹窗 **live 每秒重开**时必须**锁定"打开弹窗的那座城"**
       （否则玩家切城后，重开会把同号格子开到另一座城上）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;                   /* 城池不存在（切档/拆除边界）：静默退出 */
    var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' = 环城槽（不占格） */
    ui._curGrid = idx;''')

# C2 guanfuBox 块后插入 queueBox174 + liveFn174
edit('js/ui.js', 'C2 queueBox174 + liveFn174',
  r'''        '</div>';
    }
    if (cell.pending) {''',
  r'''        '</div>';
    }
    /* v89.174（老板 1）：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和剩余时间」
       —— 只挂官府格；行内倒计时挂 data-build-progress / data-ext-progress
       （updateProgress 每秒刷），整段由弹窗 live 重开跟随"完成 / 新增"。
       v89.174（老板 2）：「读秒完成后，状态还是在建造中」—— 施工中分支此前**没接 live**
       （正常态 v89.135 已接）：补上，完成瞬间弹窗自动换回功能面板；
       回调统一走 liveFn174（**锁定城池** —— 切城后重开不会把同号格开到别城）。 */
    var queueBox174 = '';
    if (_gfBid135 === 'guanfu') {
      var qs174 = (s.queues.build || []).filter(function (q) { return q.cityId === c.id; });
      queueBox174 = '<div class="op-zone"><div class="op-zone-t">在建队列（' + qs174.length + '）</div>' +
        (qs174.length ? qs174.map(function (q) {
          var bB = DATA.BUILDINGS[q.buildId];
          var bE = (DATA.EXT_BUILDINGS || {})[q.buildId];
          var nm = (bB && bB.name) || (bE && bE.name) || q.buildId;
          var what = q.type === 'build' ? '建造'
            : q.type === 'upgrade' ? ('升级至 Lv' + q.targetLevel)
            : q.type === 'ext_build' ? '城外营建'
            : ('城外升级至 Lv' + q.targetLevel);
          var pr = GAME.buildProgressOf(q);
          var attr = (q.type === 'build' || q.type === 'upgrade')
            ? ('data-build-progress="city:' + q.gridIndex + '"')
            : ('data-ext-progress="ext:' + q.extIdx + '"');
          return '<div class="attr"><span class="k">' + U.escape(nm) + '</span>' +
            '<span class="v">' + what + ' · <b ' + attr + '>' + (pr ? pr.label : '…') + '</b></span></div>';
        }).join('')
          : '<div class="attr"><span class="v" style="color:var(--text-dim);">本城暂无在建工程</span></div>') +
        '</div>';
    }
    var liveFn174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openBuildModal(idx, c.id);
    };
    if (cell.pending) {''')

# C3 施工中拼接 + live
edit('js/ui.js', 'C3 施工中拼接 queueBox174',
  r'''        guanfuBox +     /* v89.135：官府升级期间，改名/主城/秘境照常可用 */''',
  r'''        guanfuBox + queueBox174 +     /* v89.135：官府升级期间，改名/主城/秘境照常可用；v89.174：其下接「在建队列」 */''')

edit('js/ui.js', 'C4 施工中接 live（城内）',
  r'''          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');''',
  r'''          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="city" data-idx="' + idx + '">取消' + (isUpgrade ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFn174 });''')

# C5 正常态拼接 + live 锁城
edit('js/ui.js', 'C5 正常态拼接 queueBox174',
  r'''        guanfuBox +
        jewelLine +''',
  r'''        guanfuBox + queueBox174 +
        jewelLine +''')

edit('js/ui.js', 'C6 正常态 live 换锁城版',
  r'''      , { live: function () { ui.openBuildModal(idx); } });
      /* v89.135（老板 7）：live 逐秒刷新 —— 募兵/建造队列完成即变（"队列还在"病根） */''',
  r'''      , { live: liveFn174 });
      /* v89.135（老板 7）：live 逐秒刷新 —— 募兵/建造队列完成即变（"队列还在"病根）
         v89.174：回调统一 liveFn174（锁城 + 城池失效自动关闭） */''')

# C7 updateProgress 非数字槽位原样传
edit('js/ui.js', 'C7 updateProgress 宽容解析',
  r'''        var key = els[i].getAttribute(attr); // "city:3"
        var p = key.split(':');
        els[i].textContent = GAME.buildPct(p[0], Number(p[1])) || '…';''',
  r'''        var key = els[i].getAttribute(attr); // "city:3" / "city:wall"（v89.174：'wall' 槽）
        var p = key.split(':');
        /* v89.174：非数字槽位原样传 —— 改前 Number('wall')=NaN，城墙行会永远显示 '…' */
        var pv174 = /^\d+$/.test(p[1]) ? Number(p[1]) : p[1];
        els[i].textContent = GAME.buildPct(p[0], pv174) || '…';''')

# C8 城外弹窗：签名 + 锁城 + live 回调
edit('js/ui.js', 'C8 openExtModal 签名',
  r'''  ui.openExtModal = function (idx) {
    var s = GAME.state, c = GAME.currentCity();
    var e = GAME.extGridOf(c)[idx];
    if (!e) return;''',
  r'''  ui.openExtModal = function (idx, cityId) {
    /* v89.174：与城内 openBuildModal 同构 —— 支持锁城重开（live 每秒刷新），
       施工/正常两态接 live（完成瞬间自动换形态，修"读秒完了还写着建造中"）。 */
    var s = GAME.state, c = cityId ? GAME.cityById(cityId) : GAME.currentCity();
    if (!c) return;
    var e = GAME.extGridOf(c)[idx];
    if (!e) return;
    var liveFnE174 = function () {
      if (!GAME.cityById(c.id)) { ui.closeModal(); return; }
      ui.openExtModal(idx, c.id);
    };''')

# C9 城外施工中接 live
edit('js/ui.js', 'C9 城外施工中接 live',
  r'''          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>');''',
  r'''          '<button class="btn sm red" data-action="cancel-build-ask" data-kind="ext" data-idx="' + idx + '">取消' + (isUpE ? '升级' : '建造') + '</button>' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span class="op-hint">按剩余时间比例返还 80% 资源</span>' +
        '</div>', { live: liveFnE174 });''')

# C10 城外正常态接 live
edit('js/ui.js', 'C10 城外正常态接 live',
  r'''          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>'
      );
      ui.sgTryTrigger('ext', e.type);   /* v89.29 · 概率奇遇 */''',
  r'''          '<button class="btn" data-action="close-modal">关闭</button>' +
          '<span></span>' +
        '</div>', { live: liveFnE174 }
      );
      ui.sgTryTrigger('ext', e.type);   /* v89.29 · 概率奇遇 */''')

# ============================================================
# D. main.js
# ============================================================
print('== main.js ==')

edit('js/main.js', 'D1 主循环完成脏标记',
  r'''        /* 建造队列完成 → 重绘当前城内/城外面板（让"建设中"变回建筑） */
        var bc = GAME.state.queues.build.length;
        if (GAME._lastBuildCount !== bc) {
          GAME._lastBuildCount = bc;
          if (ui.view === 'city' || ui.view === 'ext') ui.renderView(ui.view);
        }''',
  r'''        /* 建造队列完成 → 重绘当前城内/城外面板（让"建设中"变回建筑）
           v89.174：判据补**完成脏标记**（_buildDirty）—— 完成 1 条 + 自动升级同 tick
           补 1 条时 length 不变，只比条数会漏刷（"读秒完了还是建造中"的另一成因）。 */
        var bc = GAME.state.queues.build.length;
        if (GAME._lastBuildCount !== bc || GAME._buildDirty) {
          GAME._lastBuildCount = bc;
          GAME._buildDirty = false;
          if (ui.view === 'city' || ui.view === 'ext') ui.renderView(ui.view);
        }''')

edit('js/main.js', 'D2 初始化补 _buildDirty',
  r'''    GAME._lastBuildCount = 0;''',
  r'''    GAME._lastBuildCount = 0;
    GAME._buildDirty = false;   /* v89.174：完成脏标记初值 */''')

# ============================================================
print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

print('== 语法哨兵 ==')
ok = True
for p in ['js/state.js', 'js/domain.js', 'js/ui.js', 'js/main.js']:
    r = subprocess.run(['node', '--check', os.path.join(ROOT, p)], capture_output=True, text=True)
    print(('  PASS ' if r.returncode == 0 else '  FAIL ') + p + ' ' + (r.stderr.strip()[:200] if r.returncode else ''))
    ok = ok and r.returncode == 0
sys.exit(0 if ok else 1)

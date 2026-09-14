# -*- coding: utf-8 -*-
"""v67 补丁 B：放弃城池（唯一入口 + 城池关联数据登记表 + 界面入口）。"""
import io

ROOT = r'E:\Deepseekdb'
report = []

def rep(rel, old, new, tag, cnt=1):
    p = ROOT + '\\' + rel
    src = io.open(p, 'r', encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in src else '\n'
    o, n = old.replace('\n', nl), new.replace('\n', nl)
    if o not in src:
        report.append(('FAIL', tag, '锚点不在')); return
    if src.count(o) != cnt:
        report.append(('FAIL', tag, '命中 %d 次' % src.count(o))); return
    io.open(p, 'w', encoding='utf-8', newline='').write(src.replace(o, n))
    report.append(('OK  ', tag, ''))

# ============ ① domain.js：登记表 + 放弃城池 ============
DOMAIN = r"""  /* ============================================================
   * 城池关联数据登记表（v67 · 老板）
   * ------------------------------------------------------------
   * 老板原话：「添加放弃城池的功能，注意梳理一下一切伴随城市产生的数据，
   *   既能便于对应产生，又能伴随放弃城市批量清除（本质上是搞好数据库表）」
   * 所以这里先立一张**表**，而不是散着写几个 filter：
   *   · 凡是"按城挂载"的数据，都在 GAME.CITY_SCOPED 里登记一行；
   *   · 放弃城池**照表清理**（clean 按表顺序执行）；
   *   · 测试照表检查：放弃之后 cityRefsOf 必须返回空 —— 漏清一项就红。
   * 新增一类按城挂载的数据时，往表里加一行即可；忘加会在测试里露出来，
   * 而不是变成线上"悬空引用"（某个队列还在指向已删的城）。
   *
   * 字段：
   *   key   state 上的路径（点号），值是数组或对象
   *   path  条目上取"归属城"的字段路径（点号；如 'garrison.cityId'）
   *   label 界面上怎么说（拒绝理由与日志都用它）
   *   hard  true = 有它就不许放弃（清了会丢兵：在途行军 / 在外采集）
   *   clean 清理动作（按表的**顺序**执行；'cities' 必须在最后 —— 前面几项还要用 city/recv）
   * ============================================================ */
  GAME.CITY_SCOPED = [
    { key: 'generals', path: 'cityId', label: '将领',
      clean: function (s, city, recv) {
        (s.generals || []).forEach(function (g) {
          if (g.cityId !== city.id) return;
          g.cityId = recv.id;
          /* 守将随城解任：城都没了，守将位自然不存在 */
          if (g.status === 'guard') g.status = 'idle';
        });
      } },
    { key: 'queues.build', path: 'cityId', label: '建造队列',
      clean: function (s, city) {
        s.queues.build = (s.queues.build || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    { key: 'queues.train', path: 'cityId', label: '募兵队列',
      clean: function (s, city) {
        s.queues.train = (s.queues.train || []).filter(function (q) { return q.cityId !== city.id; });
      } },
    /* 在途部队与在外采集**不许清**：清了兵就凭空消失，所以标 hard（有它就不让放弃） */
    { key: 'marches', path: 'cityId', label: '在途行军', hard: true },
    { key: 'gathers', path: 'cityId', label: '在外采集队', hard: true },
    { key: 'wilds', path: 'garrison.cityId', label: '野地驻军',
      clean: function (s, city, recv) {
        /* 兵不丢：先把归属改到接收城，再走**既有的唯一出口**撤回
           （doWildWithdraw 自己会把兵并进那座城，不另写一份搬兵逻辑）。 */
        (s.wilds || []).forEach(function (w) {
          if (!w.garrison || w.garrison.cityId !== city.id) return;
          w.garrison.cityId = recv.id;
          GAME.doWildWithdraw(w.x, w.y);
        });
      } },
    /* ⚠️ 城池本体放最后：上面的清理还要用 city / recv */
    { key: 'cities', path: 'id', label: '城池本体',
      clean: function (s, city) {
        s.cities = (s.cities || []).filter(function (c) { return c.id !== city.id; });
      } },
  ];
  /* 按点号路径取值（登记表用；对 null/undefined 安全） */
  GAME.cityPath = function (o, p) {
    var a = p.split('.'), v = o, i;
    for (i = 0; i < a.length && v != null; i++) v = v[a[i]];
    return v;
  };
  /* 这座城身上还挂着哪些数据（只读）—— 确认框、日志与测试都读它 */
  GAME.cityRefsOf = function (cityId) {
    var s = GAME.state, out = [];
    if (!s || !cityId) return out;
    GAME.CITY_SCOPED.forEach(function (e) {
      var list = GAME.cityPath(s, e.key);
      if (!list) return;
      if (!(list instanceof Array)) list = [list];
      var n = 0;
      list.forEach(function (it) { if (GAME.cityPath(it, e.path) === cityId) n++; });
      if (n) out.push({ key: e.key, label: e.label, n: n, hard: !!e.hard });
    });
    return out;
  };
  /* 能不能放弃（真实判据的**唯一出口** —— 界面与业务共用，不许各写一份） */
  GAME.abandonCityCheck = function (cityId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!s || !city) return { ok: false, msg: '城池不存在' };
    if ((s.cities || []).length <= 1) {
      return { ok: false, msg: '这是最后一座城池 —— 放弃它就没有立足之地了' };
    }
    var refs = GAME.cityRefsOf(cityId);
    var hard = refs.filter(function (r) { return r.hard; });
    if (hard.length) {
      return { ok: false, msg: '还有 ' + hard.map(function (r) {
        return r.n + ' 支' + r.label;
      }).join('、') + '属于这座城 —— 撤回或等它们回城之后再放弃' };
    }
    var others = (s.cities || []).filter(function (c) { return c.id !== cityId; });
    return { ok: true, city: city, receiver: others[0], others: others, refs: refs };
  };
  /* 把这一格还给地图：攻占来的城 → 系统城回来；自建城 → 回到平原 */
  GAME.restoreCityTile = function (city) {
    var s = GAME.state;
    if (!s.map || !city) return;
    /* 口径与 map.generate 里的剔除**完全一致**（按各城 origId 排除已占的系统城）。
       ⚠️ 不能直接调 map.generate()：grid 已在时它开头就 return（见 map.js）。 */
    if (s.map.cities) {
      var taken = {};
      (s.cities || []).forEach(function (c) { if (c.origId) taken[c.origId] = 1; });
      s.map.cities = GAME.buildNpcCities(s.map.seed).filter(function (c) { return !taken[c.id]; });
    }
    /* 地形：攻占城的格子保持 'city'（回来的正是那座系统城，hasFort 也按 city 认）；
       自建城只可能建在平原上（canBuildCityAt 的硬约束），还回平原。 */
    var t = GAME.map.tile(city.x, city.y);
    if (t && !city.origId) t.terrain = 'plain';
  };
  /* 放弃城池（唯一入口）：照 CITY_SCOPED 表批量清理，再把格子还给地图 */
  GAME.abandonCity = function (cityId) {
    var s = GAME.state;
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) return chk;
    var city = chk.city, recv = chk.receiver;
    var before = {
      army: GAME.armyTotal(city),
      gens: (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length,
      build: (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length,
      train: (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length,
    };
    GAME.CITY_SCOPED.forEach(function (e) { if (e.clean) e.clean(s, city, recv); });
    GAME.restoreCityTile(city);
    /* UI 指针不许指向已删城（否则侧栏/城池视图会拿到一座不存在的城） */
    if (GAME.ui && GAME.ui._cityId === city.id) GAME.ui._cityId = recv.id;
    /* 自检：清完不该再有引用 —— 有的话就是登记表漏了一项（日志里能看见） */
    var left = GAME.cityRefsOf(city.id);
    GAME.log('🗑️ 放弃城池：' + city.name + '（' + U.fmt(before.army) + ' 驻军、' + before.gens
      + ' 将领归 ' + recv.name + '；建造 ' + before.build + ' 项、募兵 ' + before.train
      + ' 项取消）' + (left.length ? '　⚠️ 残留引用 ' + left.length + ' 类：'
        + left.map(function (x) { return x.key; }).join(',') : '　清理干净'));
    return { ok: true, receiver: recv, refs: left, before: before,
      msg: '已放弃 ' + city.name + '：' + U.fmt(before.army) + ' 驻军与 ' + before.gens
        + ' 名将领归 ' + recv.name };
  };

"""
rep('js/domain.js', "  GAME.gatherList = function () {", DOMAIN + "  GAME.gatherList = function () {",
    'domain.js 登记表 + 放弃城池')

# ============ ② ui.js：城池面板入口 + 二次确认 ============
rep('js/ui.js',
"""            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'
          : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
"""            '<button class="btn" data-action="city-rename" data-city="' + city.id + '">改名</button>'
          : '') +
        /* v67（老板）：放弃城池 —— 只在还有别的城可去时才出现（否则点了必被拒） */
        (isOwn && (s.cities || []).length > 1
          ? '<button class="btn red" data-action="city-abandon-ask" data-city="' + city.id +
            '">🗑️ 放弃城池</button>'
          : '') +
        '<button class="btn" data-action="close-modal">关闭</button></div>'""",
    'ui.js 城池面板加「放弃城池」')

rep('js/ui.js',
"""  /* ============================================================
   * 野地采集（v15）""",
"""  /* 放弃城池二次确认（v67 · 老板）——
     不可逆操作必须说清代价：与「放弃野地」同一套写法（note + 逐项 attr + 红按钮）。
     判据与业务共用 GAME.abandonCityCheck（不能放弃时只说明原因，不给确认按钮）。 */
  ui.openAbandonCityAsk = function (cityId) {
    var s = GAME.state, city = GAME.cityById(cityId);
    if (!city) { ui.toast('城池不存在'); return; }
    var chk = GAME.abandonCityCheck(cityId);
    if (!chk.ok) {
      ui.openShell({
        title: '🗑️ 放弃城池 · ' + U.escape(city.name),
        size: 'sm',
        body: '<div class="q-empty">' + U.escape(chk.msg) + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    var R = GAME.res(city), recv = chk.receiver;
    var resTxt = GAME.TRANSPORT_KEYS.map(function (k) {
      return GAME.resName(k) + ' ' + U.amtText(R[k] || 0);
    }).join('　');
    var gens = (s.generals || []).filter(function (g) { return g.cityId === city.id; }).length;
    var nb = (s.queues.build || []).filter(function (q) { return q.cityId === city.id; }).length;
    var nt = (s.queues.train || []).filter(function (q) { return q.cityId === city.id; }).length;
    var garN = 0;
    (s.wilds || []).forEach(function (w) {
      if (w.garrison && w.garrison.cityId === city.id) garN += GAME.wildGarrisonTotal(w.garrison);
    });
    ui.openShell({
      title: '🗑️ 放弃 ' + U.escape(city.name),
      sub: ui.cityTierName(city.type) + '　官府 Lv' + (GAME.buildingLevel(city, 'guanfu') || 1) +
        '　(' + city.x + ',' + city.y + ')',
      size: 'sm',
      body:
        '<div class="note">放弃后这座城与它之上的一切<b>永久失去</b>：建筑、城墙、外城地块、' +
          '库存与驻军。原地块恢复为无主之地；攻占来的城池会重新变成可被攻打的系统城。</div>' +
        '<div class="attr"><span class="k">失去库存</span><span class="v">' + resTxt + '</span></div>' +
        '<div class="attr"><span class="k">失去驻军</span><span class="v">' +
          U.numText(GAME.armyTotal(city), 0) + ' 名</span></div>' +
        '<div class="attr"><span class="k">将领随迁</span><span class="v good">' +
          gens + ' 名 → ' + U.escape(recv.name) + '</span></div>' +
        (garN ? '<div class="attr"><span class="k">野地驻军归城</span><span class="v good">' +
          U.numText(garN, 0) + ' 名 → ' + U.escape(recv.name) + '</span></div>' : '') +
        ((nb || nt) ? '<div class="attr"><span class="k">在建 / 在募</span><span class="v">' +
          (nb ? nb + ' 项建造' : '') + (nb && nt ? '、' : '') + (nt ? nt + ' 项募兵' : '') +
          '　一并取消（材料不退）</span></div>' : ''),
      foot: '<div class="m-foot">' +
        '<button class="btn red" data-action="city-abandon-do" data-city="' + city.id + '">确定放弃</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  /* ============================================================
   * 野地采集（v15）""",
    'ui.js 放弃城池二次确认')

# ============ ③ main.js：接线 ============
rep('js/main.js',
"""      case 'city-rename': {
        /* 改名弹窗作用于**当前城** —— 先切过去再开，避免改错城 */
        ui.setCity(el.dataset.city);
        ui.openRenameCity();
        break;
      }""",
"""      case 'city-rename': {
        /* 改名弹窗作用于**当前城** —— 先切过去再开，避免改错城 */
        ui.setCity(el.dataset.city);
        ui.openRenameCity();
        break;
      }
      /* v67（老板）：放弃城池 —— 先二次确认（不可逆），确认后走 GAME.abandonCity
         （业务侧照 CITY_SCOPED 表批量清理，界面不自己动数据）。 */
      case 'city-abandon-ask': ui.openAbandonCityAsk(el.dataset.city); break;
      case 'city-abandon-do': {
        var acR = GAME.abandonCity(el.dataset.city);
        ui.toast(acR.msg);
        if (acR.ok) { ui.closeModal(); GAME.refreshAll(); }
        else { ui.openAbandonCityAsk(el.dataset.city); }
        break;
      }""",
    'main.js 放弃城池接线')

print('')
for st, tag, extra in report:
    print('%s  %-28s %s' % (st, tag, extra))
print('FAIL %d 条' % len([r for r in report if r[0] == 'FAIL']))

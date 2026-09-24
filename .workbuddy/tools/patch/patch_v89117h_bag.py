# -*- coding: utf-8 -*-
"""v89.117 补丁 F —— 背包装备页：列全（含穿戴）+ 细分类（老板需求 5）

老板令：「背包的装备中列出所有装备（包括将领穿戴的），如正在穿戴，显示对应将领名称即可。
          参考铁匠铺分类，增加更细致的划分，便于进行强化，售卖，分解等装备操作」

病根（读码取证）：
  · `s.inventory` **只装"没穿的"** —— 穿戴时 `inventory.splice(idx,1)`（domain.js:3858），
    脱下才 push 回来 → 背包永远看不到"已经穿在将领身上的那一半家当"；
  · 穿戴标记只显示**首字**（`o.worn.charAt(0)`），谁是"张飞"谁是"张辽"分不出；
  · 只有"排序"（品质/价值/套件/部位），**没有筛选** —— 想"把所有未穿戴的武器挑出来
    强化/售卖/分解"做不到。

改法：
  · `ui.bagEquipEntries()` —— 装备清单**唯一出口** = 背包件 + 全体将领两套装备位的件；
  · 穿戴件角标显示**将领全名**（.bag-worn 放宽 + 省略号）；
  · 顶部三排筛选（类别 / 状态 / 品质）+ 原有排序，全部走 `ui._bagEq` 一份状态；
  · 穿戴件点击走**详情**（`bag-detail`）而不是"一键穿上"（穿上无意义，要的是卸下/强化/分解）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点匹配 %d 次' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


load('js/ui.js')
load('js/main.js')
load('index.html')

# ================================================================ F1: 唯一出口 bagEquipEntries
edit('js/ui.js', """  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var inv = (s.inventory || []).filter(function (x) { return !!DATA.EQUIP[GAME.eqId(x)]; });
    if (!inv.length) return '<div class="q-empty">背包暂无装备。点城内「铁匠铺」打造，或攻占城池缴获。</div>';
    /* 已穿戴件号（角标/提示用） */
    var wornByU = {};
    s.generals.forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套都标记 */
        for (var sl in (g[bk] || {})) {
          var u = GAME.eqUidOf(g[bk][sl]);
          if (u != null) wornByU[u] = g.name;
        }
      });
    });""",
     """  /* ============================================================
   * v89.117（老板「背包的装备中列出所有装备（包括将领穿戴的），如正在穿戴，
   *   显示对应将领名称即可」）—— 装备清单**唯一出口**：
   *     背包件（s.inventory） + **全体将领两套装备位**（equip / lingEquip）。
   * 病根：穿戴时 domain 会把件从 inventory 里 splice 掉（脱下才 push 回来），
   *   所以"已经穿在身上的那一半家当"在背包里根本看不到。
   * 顺序：背包件在前、穿戴件在后（同一件只出现一次 —— 穿戴件不在背包里）。
   * ============================================================ */
  ui.bagEquipEntries = function () {
    var s = GAME.state || {};
    var out = [];
    (s.inventory || []).forEach(function (inst) {
      if (!inst || !DATA.EQUIP[GAME.eqId(inst)]) return;
      out.push({ inst: inst, wornBy: '', from: 'bag' });
    });
    (s.generals || []).forEach(function (g) {
      ['equip', 'lingEquip'].forEach(function (bk) {
        var bag = g[bk] || {};
        for (var sl in bag) {
          var inst2 = bag[sl];
          if (!inst2 || !DATA.EQUIP[GAME.eqId(inst2)]) continue;
          out.push({ inst: inst2, wornBy: g.name, from: 'worn', genId: g.id, slot: sl });
        }
      });
    });
    return out;
  };
  /* 装备页筛选状态（唯一出口：chips / 渲染 / 断言都读它） */
  ui._bagEq = ui._bagEq || { cls: 'all', set: '', state: 'all', q: 'all' };
  ui.bagEqFiltered = function () {
    var f = ui._bagEq || {};
    return ui.bagEquipEntries().filter(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      if (!it) return false;
      if (f.state === 'worn' && !e.wornBy) return false;
      if (f.state === 'free' && e.wornBy) return false;
      if (f.q !== 'all' && it.q !== Number(f.q)) return false;
      if (f.cls === 'set' && !it.set) return false;
      if (f.cls === 'solo' && it.set) return false;
      if (f.cls === 'set' && f.set && it.set !== f.set) return false;
      return true;
    });
  };
  /* 筛选条（三排：类别 / 状态 / 品质；只在装备页出现） */
  ui.bagEqChipsHTML = function () {
    var f = ui._bagEq || {};
    var all = ui.bagEquipEntries();
    var setsIn = [];
    all.forEach(function (e) {
      var sid = (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set;
      if (sid && setsIn.indexOf(sid) < 0) setsIn.push(sid);
    });
    function chip(k, v, label, n, on) {
      return '<span class="chip' + (on ? ' on' : '') + '" data-action="bag-eq-f" data-k="' + k +
        '" data-v="' + v + '">' + label + ' <i>' + n + '</i></span>';
    }
    var cnt = function (pred) { return all.filter(pred).length; };
    var qsIn = [1, 2, 3, 4].filter(function (q) {
      return all.some(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; });
    });
    var row1 = chip('cls', 'all', '全部', all.length, f.cls === 'all') +
      chip('cls', 'set', '套装', cnt(function (e) { return !!(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'set') +
      chip('cls', 'solo', '散件', cnt(function (e) { return !(DATA.EQUIP[GAME.eqId(e.inst)] || {}).set; }), f.cls === 'solo') +
      (f.cls === 'set' && setsIn.length
        ? setsIn.map(function (sid) {
            return chip('set', sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
              cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).set === sid; }), f.set === sid);
          }).join('') : '');
    var row2 = '<span class="lb">状态</span>' +
      chip('state', 'all', '全部', all.length, f.state === 'all') +
      chip('state', 'free', '未穿戴', cnt(function (e) { return !e.wornBy; }), f.state === 'free') +
      chip('state', 'worn', '已穿戴', cnt(function (e) { return !!e.wornBy; }), f.state === 'worn') +
      '<span class="lb" style="margin-left:var(--sp-4);">品质</span>' +
      chip('q', 'all', '全部', all.length, f.q === 'all') +
      qsIn.map(function (q) {
        return chip('q', q, DATA.Q_NAME[q] || ('Q' + q),
          cnt(function (e) { return (DATA.EQUIP[GAME.eqId(e.inst)] || {}).q === q; }), Number(f.q) === q);
      }).join('');
    return '<div class="chips chips-xs" style="justify-content:center;margin-bottom:4px;">' + row1 + '</div>' +
      '<div class="chips chips-xs" style="justify-content:center;margin-bottom:6px;">' + row2 + '</div>';
  };
  ui.setBagEqFilter = function (k, v) {
    ui._bagEq = ui._bagEq || {};
    if (k === 'q') ui._bagEq.q = (v === 'all') ? 'all' : Number(v);
    else ui._bagEq[k] = v;
    if (k === 'cls' && v !== 'set') ui._bagEq.set = '';
    ui._pages['bag-equip'] = 1;                  /* 换筛选回第一页（分页键 = bag-equip） */
    ui.renderBag();
  };

  ui.bagEquipHTML = function (sort) {
    var s = GAME.state;
    var entries = ui.bagEqFiltered();
    if (!entries.length) {
      var anyEq = ui.bagEquipEntries().length;
      return '<div class="q-empty">' + (anyEq
        ? '当前筛选下没有装备 —— 换一档筛选试试（类别 / 状态 / 品质）。'
        : '尚无装备。点城内「铁匠铺」打造，或攻占城池缴获。') + '</div>';
    }
    var inv = entries;""",
     'F：bagEquipEntries 唯一出口 + 筛选')

# ================================================================ F2: 分组与单元格改用 entries
edit('js/ui.js', """    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (inst) {
      var it = DATA.EQUIP[GAME.eqId(inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(inst);
    });""",
     """    /* 分组（按部位 / 按套装）—— 组内按件排 */
    var groups = {};
    inv.forEach(function (e) {
      var it = DATA.EQUIP[GAME.eqId(e.inst)];
      var key = (sort === 'set') ? (it.set ? ('set:' + it.set) : 'solo') : it.slot;
      (groups[key] = groups[key] || []).push(e);
    });""",
     'F：分组用 entries')

edit('js/ui.js', """    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) {
        return ui.bagCmp('equip', sort, GAME.eqId(x), GAME.eqId(y))
          || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
      });""",
     """    keys.forEach(function (k) {
      var arr = groups[k];
      arr.sort(function (x, y) {
        return ui.bagCmp('equip', sort, GAME.eqId(x.inst), GAME.eqId(y.inst))
          || (GAME.eqEnhOf(y.inst) - GAME.eqEnhOf(x.inst));
      });""",
     'F：组内排序取 .inst')

edit('js/ui.js', """      var cells = arr.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          /* v89.116：`DATA.EQUIP_SLOT_ICON` 不存在 —— 旧兜底一旦被走到就是**抛错**；
             真出口 `icons.forEquip` 恒在（icons.js），缺了也只是空图标、不炸。 */
          cls: 'q' + it.q, ico: (GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : ''),
          name: GAME.eqLabel(inst),
          q: it.q, worn: wornByU[u] || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDesc(it),
          act: 'open-bag-equip', key: (u != null ? u : id),
        });
      });""",
     """      var cells = arr.map(function (e) {
        var inst = e.inst;
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var setNm = it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
        var u = GAME.eqUidOf(inst);
        return ui.bagCell({
          /* v89.116：`DATA.EQUIP_SLOT_ICON` 不存在 —— 旧兜底一旦被走到就是**抛错**；
             真出口 `icons.forEquip` 恒在（icons.js），缺了也只是空图标、不炸。 */
          cls: 'q' + it.q, ico: (GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : ''),
          name: GAME.eqLabel(inst),
          q: it.q,
          /* v89.117：穿戴角标改**将领全名**（原只显示首字，张飞/张辽分不出） */
          worn: e.wornBy || '',
          title: GAME.eqLabel(inst) + (setNm ? '（' + setNm + '）' : '') + (e.wornBy ? ' · ' + e.wornBy + ' 着' : ''),
          lore: (DATA.EQUIP_SLOT_NAMES[it.slot] || it.slot) + ' · ' + (DATA.Q_NAME[it.q] || '')
            + ' · 估值 ' + U.fmt(GAME.itemValue(id)) + (e.wornBy ? '　·　穿戴：' + e.wornBy : ''),
          attr: GAME.equipDesc(it),
          /* 穿戴件点击 = 开详情（卸下/强化/分解都在那里）；背包件保持"一键穿上"。
             —— 已穿在身上的再"穿上"没有意义，详情才是要去的下一级。 */
          act: e.wornBy ? 'bag-detail' : 'open-bag-equip', key: (u != null ? u : id),
        });
      });""",
     'F：单元格含穿戴件')

# ================================================================ F3: bagCell 角标显示全名
edit('js/ui.js', """      (o.worn ? '<span class="bag-worn">' + U.escape(o.worn.charAt(0)) + '</span>' : '') +""",
     """      (o.worn ? '<span class="bag-worn" title="' + U.escape(o.worn) + ' 着">' + U.escape(o.worn) + '</span>' : '') +""",
     'F：角标全名')

# ================================================================ F4: 摘要 + 页头插筛选条
edit('js/ui.js', """    if (t === 'equip') return '装备 ' + (s.inventory || []).length + ' 件';""",
     """    if (t === 'equip') {
      var _all = ui.bagEquipEntries ? ui.bagEquipEntries() : [];
      var _worn = _all.filter(function (e) { return !!e.wornBy; }).length;
      return '装备 ' + _all.length + ' 件（未穿戴 ' + (_all.length - _worn) + ' · 已穿戴 ' + _worn + '）';
    }""",
     'F：摘要')

edit('js/ui.js', """    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索） */
    if (t === 'treasure') html += ui.bagSubChipsHTML();""",
     """    /* 二级分类条（仅宝物页）—— 参考商城分类，只列有货的（快速检索） */
    if (t === 'treasure') html += ui.bagSubChipsHTML();
    /* v89.117（老板「参考铁匠铺分类，增加更细致的划分」）：装备页三排筛选 */
    if (t === 'equip') html += ui.bagEqChipsHTML();""",
     'F：页头筛选条')

# ================================================================ F5: main.js 动作
edit('js/main.js', """      case 'forge-set': ui.setForgeSet(el.dataset.s); break;""",
     """      case 'forge-set': ui.setForgeSet(el.dataset.s); break;
      case 'bag-eq-f': ui.setBagEqFilter(el.dataset.k, el.dataset.v); break;""",
     'F：main.js 筛选动作')

# ================================================================ F6: CSS（.ir-pick / worn 放宽）
edit('index.html', """  .bag-cell .bag-worn { position: absolute; left: 4px; bottom: 3px; min-width: 15px; height: 15px; line-height: 15px;
    text-align: center; border-radius: var(--r-lg); background: rgba(var(--rank-liang-rgb),.85); color: var(--ink-on-gold);
    font-size: var(--fs-cap); font-weight: 800; padding: 0 var(--sp-1); }""",
     """  /* v89.117：角标从"首字"改**将领全名** —— 放宽 + 省略号（格宽有限，长名不撑破） */
  .bag-cell .bag-worn { position: absolute; left: 4px; bottom: 3px; min-width: 15px; height: 15px; line-height: 15px;
    max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    text-align: center; border-radius: var(--r-lg); background: rgba(var(--rank-liang-rgb),.85); color: var(--ink-on-gold);
    font-size: var(--fs-cap); font-weight: 800; padding: 0 var(--sp-1); }
  /* v89.117 铁匠铺：整卡点选（打造键收敛到底部后的选中提示） */
  .item-row .ir-pick { font-size: var(--fs-cap); color: var(--text-dim); border: 1px dashed var(--line-strong);
    border-radius: var(--r-md); padding: 1px var(--sp-3); }
  .item-row.on { border-color: rgba(var(--gold-soft-rgb), .85);
    box-shadow: 0 0 0 1px rgba(var(--gold-soft-rgb), .45), 0 0 14px rgba(var(--gold-soft-rgb), .22); }
  .item-row.on .ir-pick { color: var(--gold-light); border-color: rgba(var(--gold-soft-rgb), .8); border-style: solid; }""",
     'F6：CSS')

for p, s in files.items():
    assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
    tmp = R + p + '.tmp117h'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 F 完成')

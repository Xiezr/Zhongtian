# -*- coding: utf-8 -*-
"""v89.117 补丁 E —— 铁匠铺：打造键收敛到底部 + 具体套装筛选（老板需求 4）
   v89.117 补丁 F —— 背包装备列全（含穿戴）+ 细分类（老板需求 5）

E：老板「铁匠铺，太多打造按钮了，统一成一个放在底部，跟百炼强化啥的放一起就行。
     上方的类别选择，再加一个具体套装，方便制作同一套装下的装备」
   · 逐卡「打造」键退役（`.ir-right` 改"点选"提示）；整卡可点选（forge-pick）；
   · 底部**单一**「⚒ 打造」键（动作名仍是 `forge-item`，只认选中件）——
     与「百炼强化 / 套装效果一览」同栏；
   · 类别条下加**具体套装**子条（只在"套装"类别下出现）。

F：老板「背包的装备中列出所有装备（包括将领穿戴的），如正在穿戴，显示对应将领名称即可。
     参考铁匠铺分类，增加更细致的划分，便于进行强化，售卖，分解等装备操作」
   · 装备清单 = 背包 + 全体将领身上（唯一出口 ui.bagEquipEntries）；
   · 穿戴件角标显示**将领全名**（原来只有一个首字）；
   · 顶部加三排筛选：类别（全部/套装/散件 + 具体套装）/ 状态（全部/未穿戴/已穿戴）/ 品质。
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


u = load('js/ui.js')

# ================================================================ E1: itemRow 支持点选
edit('js/ui.js', """  ui.itemRow = function (o) {
    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + '">' +""",
     """  ui.itemRow = function (o) {
    /* v89.117：可选**整行点选**（铁匠铺把"逐卡打造键"收成"选一件 + 底部一个键"）——
       只有传了 pickAction 才挂 data-action，既有调用点不受影响。 */
    var pick = o.pickAction ? ' data-action="' + o.pickAction + '" data-item="' + o.pickItem + '"' : '';
    return '<div class="item-row' + (o.cls ? ' ' + o.cls : '') + (o.sel ? ' on' : '') + pick + '>' +""",
     'itemRow 支持点选')

# ================================================================ E2: forgeRow 去掉逐卡打造键
edit('js/ui.js', """      actHtml: '<button class="btn' + (ok ? ' gold' : ' dim') + '" data-action="forge-item" data-item="' + f.id +
        '"' + (ok ? '' : ' disabled') + '>打造</button>',
    });""",
     """      /* v89.117（老板「太多打造按钮了，统一成一个放在底部」）：
         逐卡「打造」键退役 —— 卡片改为**可点选**，底部只有一个打造键（动作名沿用
         `forge-item`，改从 `ui._forgeSel` 取件）。"点选"提示占位极小，
         而省下的是每张卡一整个按钮的高度。 */
      actHtml: '<span class="ir-pick">' + (ui._forgeSel === f.id ? '✔ 已选' : '点选') + '</span>',
      pickAction: 'forge-pick', pickItem: f.id, sel: (ui._forgeSel === f.id),
    });""",
     'forgeRow 去按钮改点选')

# ================================================================ E3: 选中态 + 套装筛选 + 底部单键
edit('js/ui.js', """    var kind = ui._forgeKind || 'all';
    var isSet = function (f) { return !!(f.item && f.item.set); };
    var setsOnly = list.filter(isSet);
    var soloOnly = list.filter(function (f) { return !isSet(f); });
    var pool = kind === 'set' ? setsOnly : (kind === 'solo' ? soloOnly : list);
    var kindHtml = [['all', '全部', list.length], ['set', '套装', setsOnly.length], ['solo', '散件', soloOnly.length]]
      .map(function (k) {
        return '<span class="shop-cat' + (kind === k[0] ? ' on' : '') +
          '" data-action="forge-kind" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');""",
     """    var kind = ui._forgeKind || 'all';
    var isSet = function (f) { return !!(f.item && f.item.set); };
    var setsOnly = list.filter(isSet);
    var soloOnly = list.filter(function (f) { return !isSet(f); });
    var pool = kind === 'set' ? setsOnly : (kind === 'solo' ? soloOnly : list);
    /* v89.117（老板「上方的类别选择，再加一个具体套装，方便制作同一套装下的装备」）：
       按**套装 id** 再筛一道（只列这批可打造件里真出现的套装）。 */
    var setIdCur = ui._forgeSet || '';
    var setIdsInPool = [];
    setsOnly.forEach(function (f) {
      var sid = f.item.set;
      if (sid && setIdsInPool.indexOf(sid) < 0) setIdsInPool.push(sid);
    });
    if (setIdCur && setIdsInPool.indexOf(setIdCur) < 0) { setIdCur = ''; ui._forgeSet = ''; }
    if (kind === 'set' && setIdCur) pool = pool.filter(function (f) { return f.item.set === setIdCur; });
    var kindHtml = [['all', '全部', list.length], ['set', '套装', setsOnly.length], ['solo', '散件', soloOnly.length]]
      .map(function (k) {
        return '<span class="shop-cat' + (kind === k[0] ? ' on' : '') +
          '" data-action="forge-kind" data-k="' + k[0] + '">' + k[1] + '<i>' + k[2] + '</i></span>';
      }).join('');
    var setRow = (kind !== 'set' || !setIdsInPool.length) ? ''
      : '<span class="ff-k">套装</span><span class="shop-cats">' +
        [['', '全部', setsOnly.length]].concat(setIdsInPool.map(function (sid) {
          return [sid, (DATA.SETS[sid] && DATA.SETS[sid].name) || sid,
            setsOnly.filter(function (f) { return f.item.set === sid; }).length];
        })).map(function (k) {
          return '<span class="shop-cat' + (setIdCur === k[0] ? ' on' : '') +
            '" data-action="forge-set" data-s="' + k[0] + '">' + U.escape(k[1]) + '<i>' + k[2] + '</i></span>';
        }).join('') + '</span>';""",
     'E：套装筛选')

edit('js/ui.js', """    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });""",
     """    /* 选中件：只认**在册**的那一件（换筛选/换品质后，选中的东西可能不在当前页） */
    var selF = null;
    list.forEach(function (f) { if (f.id === ui._forgeSel) selF = f; });
    if (!selF) { ui._forgeSel = ''; }
    var selOk = false, selWhy = '';
    if (selF) {
      var b2 = [];
      if (!selF.tierOk) b2.push('需铁匠铺 Lv' + (DATA.FORGE.tierLv[selF.q - 1] || 7));
      if (!selF.bpOk) b2.push('缺图纸');
      if (!selF.matsOk) b2.push('材料不足');
      if (!GAME.canAfford(selF.cost)) b2.push('资材不足');
      selOk = !b2.length; selWhy = b2.join('　');
    }
    var pg = ui.modalPage('forge', rows, ui.FORGE_PER_PAGE, function () { ui.openForge(); });""",
     'E：选中件解析')

edit('js/ui.js', """      body: '<div class="forge-filter">' +
          '<span class="ff-k">类别</span><span class="shop-cats">' + kindHtml + '</span>' +
          '<span class="ff-k">品质</span><span class="shop-cats">' + tabHtml + '</span>' +""",
     """      body: '<div class="forge-filter">' +
          '<span class="ff-k">类别</span><span class="shop-cats">' + kindHtml + '</span>' +
          setRow +
          '<span class="ff-k">品质</span><span class="shop-cats">' + tabHtml + '</span>' +""",
     'E：body 插套装行')

edit('js/ui.js', """      foot: '<div class="m-foot"><button class="btn gold" data-action="open-enhance">⚒ 百炼强化</button>' +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };""",
     """      /* v89.117（老板「统一成一个放在底部，跟百炼强化啥的放一起就行」）：
         底部三个键：**打造**（唯一入口，认选中件）/ 百炼强化 / 套装效果一览。
         动作名仍叫 `forge-item`（既有派发与选择器零改动），件号改从 ui._forgeSel 取。 */
      foot: '<div class="m-foot">' +
        '<button class="btn' + (selOk ? ' gold' : ' dim') + '" data-action="forge-item"' +
          (selOk ? '' : ' disabled') + '>⚒ 打造' +
          (selF ? '：' + U.escape(selF.item.name) : '（先在下方点选一件）') + '</button>' +
        (selF && selWhy ? '<span class="op-hint">' + U.escape(selWhy) + '</span>' : '') +
        '<button class="btn" data-action="open-enhance">⚒ 百炼强化</button>' +
        '<button class="btn" data-action="forge-setinfo">套装效果一览</button>' +
        '<button class="btn" data-action="close-modal">关闭</button></div>'
    });
  };""",
     'E：底部单键')

# ================================================================ E4: setForgeSet（唯一出口）
edit('js/ui.js', """  ui.setForgeKind = function (k) {""",
     """  /* v89.117：具体套装筛选（唯一出口：chips、断言都读它） */
  ui.setForgeSet = function (sid) {
    ui._forgeSet = String(sid || '');
    ui._pages['forge'] = 1;
    ui.openForge();
  };
  ui.setForgeKind = function (k) {""",
     'E：setForgeSet')

# ================================================================ E5: doForge 兜底取选中件
load('js/main.js')                       # ⚠️ 先在 files 里登记，否则 edit 会 KeyError
edit('js/main.js', """  GAME.doForge = function (itemId) {""",
     """  GAME.doForge = function (itemId) {
    /* v89.117：底部唯一打造键不带 data-item —— 缺省取**选中件**（ui._forgeSel） */
    if (!itemId && ui._forgeSel) itemId = ui._forgeSel;""",
     'E：doForge 取选中件')

# ================================================================ E6: main.js 新动作
edit('js/main.js', """      case 'forge-item': GAME.doForge(el.dataset.item); break;""",
     """      case 'forge-item': GAME.doForge(el.dataset.item); break;
      case 'forge-pick': ui.forgePick(el.dataset.item); break;
      case 'forge-set': ui.setForgeSet(el.dataset.s); break;""",
     'E：main.js 两个 case')

# ================================================================ E7: forgePick 实现
edit('js/ui.js', """  /* v89.117：具体套装筛选（唯一出口：chips、断言都读它） */""",
     """  /* v89.117：点选一件（再按底部「打造」）—— 只重绘面板，不弹新窗（同级刷新） */
  ui.forgePick = function (itemId) {
    if (!itemId) return;
    ui._forgeSel = (ui._forgeSel === itemId) ? '' : String(itemId);
    ui.openForge();
  };
  /* v89.117：具体套装筛选（唯一出口：chips、断言都读它） */""",
     'E：forgePick')

for p, s in files.items():
    assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
    tmp = R + p + '.tmp117g'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 E 完成')

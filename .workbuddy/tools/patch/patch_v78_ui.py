# -*- coding: utf-8 -*-
"""v78 · UI 层：选种改种子制 / 在手种子一览 / 种子背包行（去播种）/ 装备详情撤「穿给谁」。

配套核心层（patch_v78_core.py）：
  · ui.openFarmSeeds  —— 每行显示种子持有数，缺种禁用；不再显示黄金
  · ui.farmHTML       —— 副标题与「在手种子」一览
  · 背包               —— 新增「种子（种田秘境）」分类 + 🌰 系列图标；行内按钮 = 去播种
  · ui.openEquipDetail—— 撤「穿给谁」列表（老板需求 3），留指路说明
  · ui.openItemDetail —— 种子显示「来源」而非「商城价」
  · main.js           —— equip-to / doEquipTo 连根退役
"""
import io
import sys

UI = r'E:\Deepseekdb\js\ui.js'
MAIN = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    # ⚠️ 行尾铁律：先试 LF 变体，找不到才试 CRLF（elif，不是两个都收）
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


def delete(path, old, tag):
    """整行删除（幂等：old 不在 = 已删过）。"""
    t = io.open(path, encoding='utf-8', newline='').read()
    if old not in t:
        print('  · %s：已删过（跳过）' % tag)
        return
    if t.count(old) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old, '', 1))
    print('  ✓ %s' % tag)


print('== F. ui.js ==')
# F1 · 秘境面板副标题
patch(UI,
"""      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种下即扣黄金，生长走游戏时间</div>' +""",
"""      '<div class="ui-sub" style="text-align:center;">个人田庄 · 六块灵田　种子由采集与征战获得，生长走游戏时间</div>' +""",
'F1 面板副标题')

# F2 · 「在手种子」一览（挂在作物与去向区头）
patch(UI,
"""      '<div class="op-zone"><div class="op-zone-t">作物与去向</div>' +
        '<div class="attr"><span class="k">材料作物</span><span class="v">3 阶打造主料（镔铁 / 檀木 / 犀革 / 蛟筋 / 羊脂玉 / 蜀锦），有机率出 4 阶</span></div>' +""",
"""      '<div class="op-zone"><div class="op-zone-t">作物与去向</div>' +
        /* v78（老板需求 1）：种子在手一览 —— 种子的唯一来源是采集与征战 */
        '<div class="attr"><span class="k">在手种子</span><span class="v">' + (function () {
          var items = GAME.state.items || {}, parts = [];
          (DATA.SEED_DROP && DATA.SEED_DROP.table || []).forEach(function (row) {
            var n = items[row.id] || 0;
            if (n > 0) parts.push(row.name + '×' + n);
          });
          return parts.length ? parts.join('　') : '暂无 —— 派军采集 / 出征获胜可得';
        })() + '</span></div>' +
        '<div class="attr"><span class="k">材料作物</span><span class="v">3 阶打造主料（镔铁 / 檀木 / 犀革 / 蛟筋 / 羊脂玉 / 蜀锦），有机率出 4 阶</span></div>' +""",
'F2 在手种子一览')

# F3 · 选种弹窗改种子制
patch(UI,
"""  /* 选种弹窗：列出全部作物（6 材料 + 4 灵草），种下即扣黄金 */
  ui.openFarmSeeds = function (idx) {
    var city = GAME.currentCity();
    var R = GAME.res(city);
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var afford = (R.gold || 0) >= c.seed;
      var yieldTxt;
      if (c.herb) {
        yieldTxt = '收 灵草 ×1（将领资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '收 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-seed">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-seed-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
        '</div>' +
        '<button class="btn sm' + (afford ? ' gold' : '') + '" data-action="farm-plant" data-idx="' + idx +
          '" data-crop="' + c.id + '"' + (afford ? '' : ' disabled') + '>' +
          (afford ? '种下 · ' + U.fmt(c.seed) + ' 金' : '金 ' + U.fmt(c.seed) + ' 不足') + '</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🌱 第 ' + (idx + 1) + ' 块地 · 选种</div>' +
      '<div class="ui-sub" style="text-align:center;">种下即扣黄金；成熟后回秘境面板收获。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };""",
"""  /* 选种弹窗：列出全部作物（6 材料 + 4 灵草），消耗对应**种子**（v78 · 不再花黄金） */
  ui.openFarmSeeds = function (idx) {
    var items = GAME.state.items = GAME.state.items || {};
    var seedOf = function (c) {
      var it = null;
      (DATA.ITEMS || []).forEach(function (x) { if (x.id === c.seedItem) it = x; });
      return it || { name: c.seedItem || '种子' };
    };
    var rows = (DATA.FARM.crops || []).map(function (c) {
      var sd = seedOf(c);
      var have = items[c.seedItem] || 0;
      var afford = have >= 1;
      var yieldTxt;
      if (c.herb) {
        yieldTxt = '收 灵草 ×1（将领资质提升一档）';
      } else {
        var m3 = DATA.MATERIAL_BY_ID[c.mat] || {};
        var m4 = DATA.MATERIAL_BY_ID[c.rare] || {};
        yieldTxt = '收 ' + (m3.name || c.mat) + ' ×' + c.qty[0] + '~' + c.qty[1] +
          '（' + Math.round((c.rareP || 0.15) * 100) + '% 出 ' + (m4.name || c.rare) + '）';
      }
      return '<div class="farm-seed">' +
        '<div class="farm-ic">' + c.icon + '</div>' +
        '<div class="farm-seed-main">' +
          '<div class="farm-crop">' + c.name + '</div>' +
          '<div class="farm-sub">' + U.escape(c.desc) + '</div>' +
          '<div class="farm-sub">⏱ ' + c.hours + ' 游戏小时　' + yieldTxt + '</div>' +
          /* v78：种子持有数一眼可见（缺种的人知道去哪儿找） */
          '<div class="farm-sub">🌰 ' + U.escape(sd.name) + ' 持有 <b>' + have + '</b></div>' +
        '</div>' +
        '<button class="btn sm' + (afford ? ' gold' : '') + '" data-action="farm-plant" data-idx="' + idx +
          '" data-crop="' + c.id + '"' + (afford ? '' : ' disabled') + '>' +
          (afford ? '种下（' + U.escape(sd.name) + ' -1）' : '缺 ' + U.escape(sd.name)) + '</button>' +
      '</div>';
    }).join('');
    ui.openModal('<div class="gold-heading">🌱 第 ' + (idx + 1) + ' 块地 · 选种</div>' +
      '<div class="ui-sub" style="text-align:center;">种子由将领活动获得（采集归来 / 出征缴获）；成熟后回秘境面板收获。</div>' +
      rows +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };""",
'F3 选种弹窗种子制')

# F4 · 背包分类加「种子」
patch(UI,
"""      boost: '加速', exp: '经验', stamina: '体力精力', perm: '永久丹药', mount_buff: '坐骑',
      rank_up: '灵草（提升资质）',
    };""",
"""      boost: '加速', exp: '经验', stamina: '体力精力', perm: '永久丹药', mount_buff: '坐骑',
      rank_up: '灵草（提升资质）',
      seed: '种子（种田秘境）',
    };""",
'F4 背包种子分类')

# F5 · 图标映射加 seed 系列
patch(UI,
"""      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',
      rank_up: '🌿',
    };
    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';""",
"""      exp: '📗', stamina: '🧪', perm: '💊', mount_buff: '🐎', attr_buff: '🔯',
      rank_up: '🌿',
      /* v78：种子按品种给图标（与作物同款，一眼对上） */
      seed: { seed_fan: '🌾', seed_yunling: '🌱', seed_xisui: '🍄', seed_hualong: '🪷', seed_tianshou: '🍑' },
    };
    if (it.type === 'jewel') return (m.jewel && m.jewel[it.id]) || '💠';
    if (it.type === 'seed') return (m.seed && m.seed[it.id]) || '🌰';""",
'F5 种子图标')

# F6 · 背包行：种子 → 去播种（无数量框）
patch(UI,
"""          qtyHtml: ui.qtyInput(inputId, 1, 0, Math.max(1, have), true),
          totalHtml: '',
          actHtml: '<button class="btn gold" data-action="use-bag-item" data-key="' + it.id +
            '" data-qty-from="' + inputId + '">使用</button>',""",
"""          /* v78：种子不"使用"—— 按钮直接指路种田秘境；数量输入框对种子无意义，撤 */
          qtyHtml: it.type === 'seed' ? '' : ui.qtyInput(inputId, 1, 0, Math.max(1, have), true),
          totalHtml: '',
          actHtml: it.type === 'seed'
            ? '<button class="btn gold" data-action="open-farm">去播种</button>'
            : '<button class="btn gold" data-action="use-bag-item" data-key="' + it.id +
              '" data-qty-from="' + inputId + '">使用</button>',""",
'F6 背包种子行')

# F7 · 装备详情撤「穿给谁」
patch(UI,
"""      /* 穿戴：可选将领 */
      html += '<div class="gold-heading" style="font-size:var(--fs-lead);margin-top:12px;">穿给谁</div>';
      html += '<div class="pick-row">' + s.generals.map(function (g) {
        var cur = (g.equip || {})[it.slot];
        var curIt = cur ? DATA.EQUIP[cur] : null;
        return '<button class="btn sm' + (wornBy === g.name ? ' dim' : ' gold') + '" data-action="equip-to" data-key="' + itemId + '" data-gen="' + g.id + '">'
          + U.escape(g.name) + (curIt ? '<span style="opacity:.7;">（现有' + U.escape(curIt.name) + '）</span>' : '') + '</button>';
      }).join('') + '</div>';
      /* 拆解 */""",
"""      /* v78（老板需求 3）：「装备不要『穿给谁』这种」—— 名单式穿戴整块撤除；
         穿戴统一在**将领侧**完成：将领档案点部位换装（openEqSlot），或「装备」页选将后点装备。
         装备详情只留信息 / 强化 / 拆解（两个出口合一，界面不再重复一套选人逻辑）。 */
      html += '<div class="note" style="margin-top:8px;">穿戴：到「将领」面板点对应部位换装（或「装备」页选将后点装备）。</div>';
      /* 拆解 */""",
'F7 撤穿给谁')

# F8 · 物品详情：种子显示来源
patch(UI,
"""    html += '<div class="attr"><span class="k">类别</span><span class="v">' + (it.type || '') + '</span></div>';
    if (it.price) html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(it.price * 100) + ' 金</span></div>';""",
"""    html += '<div class="attr"><span class="k">类别</span><span class="v">' + (it.type || '') + '</span></div>';
    if (it.type === 'seed') {
      /* v78（老板需求 1）：种子**不售** —— 来源写清楚（商城价一栏对种子没有意义） */
      html += '<div class="attr"><span class="k">来源</span><span class="v good">采集归来 · 出征缴获（不售）</span></div>';
    } else if (it.price) {
      html += '<div class="attr"><span class="k">商城价</span><span class="v">' + U.fmt(it.price * 100) + ' 金</span></div>';
    }""",
'F8 种子来源')

print()
print('== G. main.js ==')
# G1 · equip-to 分发退役（整行删）
delete(MAIN,
"""      case 'equip-to': GAME.doEquipTo(el.dataset.key, el.dataset.gen); break;
""",
'G1 equip-to case')
# G2 · doEquipTo 退役
patch(MAIN,
"""  /* 穿给指定将领 */
  GAME.doEquipTo = function (itemId, genId) {
    var r = GAME.systems.equipItem(genId, itemId);
    ui.toast(r.msg || (r.ok ? '已装备' : '装备失败'));
    if (r.ok) { ui.openEquipDetail(itemId); GAME.refreshAll(); }
  };
""",
"""  /* v78（老板需求 3）：doEquipTo 随「穿给谁」一起退役 ——
     穿戴改由将领侧两个既有出口完成（将领档案点部位 / 装备页选将）。 */
""",
'G2 doEquipTo 退役')

print()
print('全部完成。')

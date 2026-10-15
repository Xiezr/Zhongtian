# -*- coding: utf-8 -*-
"""v89.171 补丁 B（界面）：经验道具选择窗 —— 逐档显示培养上限、到线的档位变暗、
   点它 toast 原因；面板全到线时说明"只服务前期"。
   闸门读唯一出口 GAME.expItemGrantOf（界面与执行同一把尺）。"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(tag, old, new, guard):
    s = rd('js/ui.js')
    if guard in s:
        print('  [skip] ' + tag)
        return
    c = s.count(old)
    assert c == 1, '锚点失配 %s count=%d' % (tag, c)
    wr('js/ui.js', s.replace(old, new))
    print('  [ ok ] ' + tag)

# U1. help 文案（title 纯文本，不写 markdown 星号）
rep('U1 help 文案',
    "    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 兵法心得 / 治军之道。');",
    """    var help = ui.help('经验来自出征、侦察、占领城池；也可在「商城 · 经验」购买练兵经验 / 治军之道 / 兵仙遗篇 / 千古兵圣。'
      + '\\n⚠️ v89.171 起：经验道具「只服务前期」——每档带培养上限（10~60），低于上限才能用、到线即止；'
      + '\\n60 级以上请靠出征历练；手中道具留给新招的将领。');""",
    guard='经验道具「只服务前期」')

# U2. 逐档先问闸门 + 默认选中第一个可用档
rep('U2 逐档状态 + 默认选档',
    """    var want = (ui._expPick || {})[genId];
    var pick = items[0].id;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it.amount || 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;""",
    """    /* v89.171（老板「道具只能前期升级，不然后边纯买道具了」）：逐档先问**唯一出口** ——
       到线的档位变暗、点它只 toast 原因；默认选中第一个**可用**的档位。 */
    var capOf171 = GAME.expItemCapOf || function (x) { return (x && x.capLv) || 0; };
    var statOf171 = {};
    items.forEach(function (x) {
      statOf171[x.id] = GAME.expItemGrantOf ? GAME.expItemGrantOf(g, x) : { ok: true };
    });
    var anyUse171 = items.some(function (x) { return statOf171[x.id].ok; });
    var capMax171 = Math.max.apply(null, items.map(function (x) { return capOf171(x); }).concat([0]));
    var want = (ui._expPick || {})[genId];
    var pick = null;
    items.forEach(function (x) { if (x.id === want && statOf171[x.id].ok) pick = x.id; });
    if (!pick) items.forEach(function (x) { if (!pick && statOf171[x.id].ok) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = pick ? (s.items[pick] || 0) : 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it ? (it.amount || 0) : 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;""",
    guard='var statOf171 = {};')

# U3a. 卡面：上限 + 到线变暗 + title 说明原因
rep('U3a 卡面',
    """          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">+' + U.numText(x.amount, 0) + '/个</i></button>';""",
    """          var stt171 = statOf171[x.id];
          return '<button class="btn sm' + (x.id === pick ? ' gold' : (stt171.ok ? '' : ' dim')) +
            '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '"' +
            ' title="' + U.escape(stt171.ok
              ? ('最多培养至 Lv' + capOf171(x) + '（低于 Lv' + capOf171(x) + ' 才能用）')
              : (stt171.msg || '不可用')) + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">最多至 Lv' + capOf171(x) + '</i></button>';""",
    guard='var stt171 = statOf171[x.id];')

# U3b. 正文：可用 → 操作提示；全到线 → 一段说明
rep('U3b 正文两态',
    """        '<div class="op-zone" style="margin-top:12px;"><div class="op-hint">' +
          '「用到升级」= 一直吃到升过当前等级（持有不够就全吃完）；跨级后需要重新点。' +
        '</div></div>',""",
    """        (anyUse171
          ? '<div class="op-zone" style="margin-top:12px;"><div class="op-hint">' +
            '「用到升级」= 一直吃到升过当前等级（持有不够就全吃完）；跨级后需要重新点。' +
            '</div></div>'
          : '<div class="q-empty" style="margin-top:10px;">手中道具的最高培养上限是 Lv' + capMax171 +
            '，本将已 Lv' + g.level + ' —— 经验道具只服务前期，请靠出征历练。</div>'),""",
    guard='手中道具的最高培养上限是 Lv')

# U3c. 底栏：全到线时只给关闭
rep('U3c 底栏两态',
    """      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="one" data-gen="' + genId +
          '" data-item="' + pick + '">用 1 个</button>' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="till" data-gen="' + genId +
          '" data-item="' + pick + '"' + (toLevel > have ? ' title="持有 ' + have + ' 个，不够一路升上去"' : '') +
          '>用到升级</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });""",
    """      foot: anyUse171
        ? '<div class="m-foot">' +
          '<button class="btn gold" data-action="gen-exp-item" data-mode="one" data-gen="' + genId +
            '" data-item="' + pick + '">用 1 个</button>' +
          '<button class="btn gold" data-action="gen-exp-item" data-mode="till" data-gen="' + genId +
            '" data-item="' + pick + '"' + (toLevel > have ? ' title="持有 ' + have + ' 个，不够一路升上去"' : '') +
            '>用到升级</button>' +
          '<button class="btn" data-action="close-modal">取消</button></div>'
        : '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
    });""",
    guard='foot: anyUse171')

# U3d. 小标题（锚点带上一行 sub，避免撞回复类面板的同名"选道具"）
rep('U3d 小标题',
    """        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具</div>' +""",
    """        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具（经验道具只服务前期 · 各档上限见卡）</div>' +""",
    guard='选道具（经验道具只服务前期')

# U4. 点到线档位 → 不静默，toast 原因
rep('U4 setExpItem 守卫',
    """  ui.setExpItem = function (genId, itemId) {
    ui._expPick = ui._expPick || {};
    ui._expPick[genId] = itemId;
    ui.openExpPick(genId);
  };""",
    """  ui.setExpItem = function (genId, itemId) {
    /* v89.171：到线的档位点不动 —— 不静默，toast 说明原因（"为什么没反应"比禁用更糟） */
    var gE = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) gE = x; });
    var itE = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) itE = x; });
    if (gE && itE && GAME.expItemGrantOf) {
      var gtE = GAME.expItemGrantOf(gE, itE);
      if (!gtE.ok) { ui.toast(gtE.msg); return; }
    }
    ui._expPick = ui._expPick || {};
    ui._expPick[genId] = itemId;
    ui.openExpPick(genId);
  };""",
    guard='var gtE = GAME.expItemGrantOf(gE, itE);')

print('OK')

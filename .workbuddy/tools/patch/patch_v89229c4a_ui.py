# -*- coding: utf-8 -*-
# v89.229 批 c4a：ui.js —— 训练面板统一化（三组分页 · 工位按兵种解析 · filter 退役）
import io, os
BASE = 'E:/Deepseekdb/'
DRY = os.environ.get('DRY') == '1'
P = 'js/ui.js'

def rd(): return io.open(BASE + P, encoding='utf-8', newline='').read()

s = rd()

# ============ ① openTroops + renderTroopsModal + trainBarracks 区（整段重写）============
a = s.index('  ui.openTroops = function (idx, filter) {')
b = s.index('  /* 本营募兵队列（执行中 / 排队等待） */')
assert a > 0 and b > a
NEW_A = """  ui.openTroops = function (idx) {
    /* v80（老板）：「目前选择数量后会跳回到页面顶端，要求取消跳转这个动作」——
       重绘前把两级滚动容器的位置记下来（.inner-panel 与 .panel-body），重绘后原样还回去；
       仅当旧窗本来就是募兵面板（有 #train-count）时才恢复，从别处打开时仍从顶端开始。 */
    var prevRoot = $('#modal-root');
    var keep = null;
    if (prevRoot && prevRoot.querySelector('#train-count')) {
      var pIp = prevRoot.querySelector('.inner-panel');
      var pPb = prevRoot.querySelector('.panel-body');
      keep = { ip: pIp ? pIp.scrollTop : 0, pb: pPb ? pPb.scrollTop : 0 };
    }
    /* v89.229（兵种重构）：**统一面板** —— 兵营与机工坊共用一屏（14 兵种三组分页），
       旧 `filter`（'siege'/'normal'）参数退役；工位由**选中兵种**决定
       （trainBarracks 读 sel.craft）。从哪座建筑打开只影响"初始选中"：
       机工坊 → 首个器械兵（组 3）、训练营 → 首个常备兵（组 1）。 */
    var _idx0 = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    if (_idx0 != null) {
      var c0 = GAME.currentCity();
      var inShop = (GAME.craftWorkshopsOf(c0) || []).some(function (x) { return x.idx === _idx0; });
      var _first = Object.keys(DATA.TROOPS).filter(function (id) {
        return !!DATA.TROOPS[id].craft === !!inShop;
      })[0];
      if (_first) ui._trainSel = _first;
      ui._trainTab = inShop ? 'g3' : 'g1';
    }
    ui._trainBIdx = _idx0;
    /* v89.211（老板 3）：入场工位**归一** —— 陈旧/跨类 idx（如上次点的是训练营格）在这里
       回落本类首座，显示（trainBarracks）与提交（doTrain）此后读同一份。
       改前 siege 面板显示正常（有回落），提交却把旧 idx 原样交给 GAME.train →
       明明有作坊却报"本城尚无机工坊"（老板实测）。 */
    var _b211 = ui.trainBarracks();
    ui._trainBIdx = _b211 ? _b211.idx : null;
    ui.openPanel('troops', '⚔️ 兵种整备');
    if (keep) {
      var nIp = $('#modal-root .inner-panel');
      var nPb = $('#modal-root .panel-body');
      if (nIp) nIp.scrollTop = keep.ip;
      if (nPb) nPb.scrollTop = keep.pb;
    }
  };
  ui.renderTroopsModal = function () { ui.openTroops(ui._trainBIdx); };

  /* 当前面板的**工位**（v89.229：统一面板后按**选中兵种**解析 —— 器械兵 → 机工坊，
     常备兵 → 训练营）。显示（troopsHTML）与提交（doTrain）读同一份。
     找不到时回退该类的第一座。 */
  ui.trainBarracks = function () {
    var c = GAME.currentCity();
    var sel = DATA.TROOPS[ui._trainSel];
    var isCraft = !!(sel && sel.craft);
    var list = isCraft ? GAME.craftWorkshopsOf(c) : GAME.barracksOf(c);
    if (!list.length) return null;
    if (ui._trainBIdx != null) {
      for (var i = 0; i < list.length; i++) if (list[i].idx === ui._trainBIdx) return list[i];
    }
    return list[0];
  };

"""
s = s[:a] + NEW_A + s[b:]

# ============ ② _trainFilter 定义区 ============
old_def = """  /* v16：募兵按建筑分流 —— 训练营募常规兵、机工坊造器械（#14） */
  ui._trainFilter = 'normal';
  /* v80（老板）：「页面分成步兵，机车两个界面，翻页」；
     v81（老板）：「做成3页，第一页为募兵队列」—— 分页改三页制：
     que 募兵队列（首页） / inf 步兵 / cav 机车。 */
  ui._trainTab = 'que';"""
new_def = """  /* v89.229（兵种重构）：旧 `_trainFilter`（兵营/机工坊分流）**退役** ——
     统一面板后由选中兵种的 craft 字段决定工位；从哪座建筑打开只影响初始选中。 */
  /* v80/v81（分页沿革）：v80 立"步兵/机车分页" → v81"3 页制（队列/步兵/机车）"
     → **v89.229 新三组制**：que 募兵队列 / g1 后勤支援 / g2 主力战斗 / g3 尖端武装。
     分组由 TROOPS 的 grp 字段驱动 —— 加兵种只填 grp，分页自动收纳（可扩展框架）。 */
  ui._trainTab = 'que';"""
c = s.count(old_def)
assert c == 1, ('trainDef', c)
s = s.replace(old_def, new_def)

# ============ ③ troopsHTML 整函数重写 ============
a = s.index('  ui.troopsHTML = function () {')
b = s.index('  /* --------- 英雄 --------- */')
assert a > 0 and b > a
NEW_C = """  ui.troopsHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    if (!DATA.TROOPS[ui._trainSel]) ui._trainSel = 'buxingji';   // 兜底：选中项必须存在
    /* v89.229（兵种重构）三组分页：que 募兵队列（首页）/ g1 后勤支援 /
       g2 主力战斗 / g3 尖端武装（grp 字段驱动，见 DATA.TROOPS）。
       器械兵（craft）与常备兵同屏：选中后工位自动解析（trainBarracks）。 */
    var isQueueTab = (ui._trainTab === 'que');
    var grpN = Number(String(ui._trainTab).replace('g', '')) || 0;
    var ids = Object.keys(DATA.TROOPS).filter(function (id) {
      if (isQueueTab) return false;                 /* 队列页不出兵种卡 */
      return DATA.TROOPS[id].grp === grpN;
    });
    if (ids.length && ids.indexOf(ui._trainSel) < 0) ui._trainSel = ids[0];
    var cards = ids.map(function (id) {
      var t = DATA.TROOPS[id];
      var chk = GAME.canTrain(id);
      var unlocked = chk.ok;
      /* v37（需求 1）：募兵资源**从卡面移到悬停浮层**（成本是决策信息，不必常驻卡面）。
         v89.114（老板「兵营招募界面，兵种的属性不再直接列出，改悬浮显示」）：
         卡面再撤一行 —— **连属性行一起进悬停浮层**，卡面只剩图标 + 名字；
         属性（含**负重**）与消耗、幸存者、耗时、未解锁原因全在浮层里，
         走全站唯一的 #tip-layer（v37），不另造弹窗。 */
      return '<div class="troop-card' + (unlocked ? '' : ' disabled') + (ui._trainSel === id ? ' selected' : '') + '" ' +
        /* v89.189（老板 1）：灰卡不再挂死掉的 train-locked（case 已退役）—— 无 data-action、
           带 data-why，点击由委托统一弹「无法执行」窗（原因 = canTrain 的 msg）。 */
        (unlocked ? 'data-action="select-train"' : '') + ' data-troop="' + id + '"' +
        /* v89.179c 的原因机制 v89.189 收编：灰卡带 data-why，点击由委托统一弹
           「无法执行」窗（原因与浮层里那行 `chk.msg` 同源 · 唯一出口 GAME.canTrain）。 */
        (unlocked ? '' : ' data-why="' + U.escape(chk.msg || '') + '"') + ' data-tip-el="1">' +
        '<div class="ticon">' + GAME.icons.forTroop(t.id) + '</div><div class="tname">' + t.name + '</div>' +
        '<div class="tcard-tip tip-src">' +
          '<div class="tip-t">' + U.escape(t.name) + ' · 兵种属性</div>' +
          '<div class="tip-l">血 ' + t.hp + '　攻 ' + t.atk + '　防 ' + t.def +
            '　射程 ' + t.range + '　速度 ' + t.spd + '</div>' +
          '<div class="tip-l">负重 ' + t.load + '<span style="opacity:.65;">（随军运力 / 掠夺搬运）</span></div>' +
          '<div class="tip-l">募兵消耗：' + GAME.costString(t.cost) + '</div>' +
          '<div class="tip-l">幸存者 ' + t.pop + ' · 单兵耗时 ' + U.dur(t.time) + '</div>' +
          /* v89.180（老板 1）：拆械特性（无人轰炸机专属 · 有才显示） */
          (t.vsMech ? '<div class="tip-l">拆械 对器械伤害 ×' + t.vsMech + '</div>' : '') +
          (unlocked ? '' : '<div class="tip-a" style="color:var(--red-light)">' + U.escape(chk.msg || '') + '</div>') +
        '</div></div>';
    }).join('');
    var sel = DATA.TROOPS[ui._trainSel];
    var afford = GAME.canTrain(ui._trainSel).ok;
    /* v20：数量取自状态，不再读 DOM */
    var qty = Math.max(1, Math.floor(Number(ui._trainCount) || 1));
    var timeStr = sel ? U.dur((sel.time * qty) / GAME.timeScale()) : '';
    /* v28（需求 5）：按当前幸存者与资源算出的**可募上限**
       v89.86（整改 P-19）：上限为 0 时要**说清谁卡住**（幸存者 vs 资源）——
       归因走 GAME.trainLimitOf 唯一出口（maxTrainCount 是它的 cap 字段）。 */
    var limN = (sel && GAME.trainLimitOf) ? GAME.trainLimitOf(sel.id) : null;
    var maxN = sel ? GAME.maxTrainCount(sel.id, c.id, ui._trainBIdx) : 0;
    var haveN = (sel && c.army && c.army[sel.id]) || 0;   /* v89.99：本城驻军（解散的门槛） */
    /* v89.229：工位类由选中兵种决定（craft → 机工坊；其余 → 训练营）——
       面板归属于**某座工位建筑**，并列出它自己的队列 */
    var kind = (sel && sel.craft) ? 'craft' : 'train';
    var bar = ui.trainBarracks();
    var slotsLeft = bar ? GAME.trainSlotsLeft(c, bar.idx, kind) : 0;
    var barLine = bar ? ''
      : '<div class="q-empty">本城尚未建造' + (kind === 'craft' ? '机工坊，无法制造器械。' : '训练营，无法募兵。') + '</div>';
    var tabsHtml = '<div class="train-tabs">' +
        '<button class="btn sm' + (ui._trainTab === 'que' ? ' gold' : '') + '" data-action="train-tab" data-page="que">📜 募兵队列</button>' +
        '<button class="btn sm' + (ui._trainTab === 'g1' ? ' gold' : '') + '" data-action="train-tab" data-page="g1">🧰 后勤支援</button>' +
        '<button class="btn sm' + (ui._trainTab === 'g2' ? ' gold' : '') + '" data-action="train-tab" data-page="g2">⚔ 主力战斗</button>' +
        '<button class="btn sm' + (ui._trainTab === 'g3' ? ' gold' : '') + '" data-action="train-tab" data-page="g3">💠 尖端武装</button>' +
      '</div>';
    /* v81（老板）：队列独占「第一页」；v89.229：队列页展示**两工位各自的队列**
       （训练营 + 机工坊，各取首座——多座时的选择归位到各自的分组页）。 */
    if (isQueueTab) {
      var _bars = GAME.barracksOf(c) || [], _shops = GAME.craftWorkshopsOf(c) || [];
      var _qblk = (_bars.length ? ui.trainQueueBlock(_bars[0], c, 'train')
        : '<div class="q-empty">本城尚未建造训练营，无法募兵。</div>')
        + (_shops.length ? ui.trainQueueBlock(_shops[0], c, 'craft') : '');
      return '<div class="ui-page">' + tabsHtml + _qblk +
        /* v89.190（老板 2）：自动征兵入口（设置正文在「自动」菜单 · 右详情 ——
           那里与自动升级/治疗等同处一地；这里给募兵场景一个直达快捷键）。 */
        '<div style="text-align:center;margin-top:var(--sp-mid);">' +
          '<button class="btn sm" data-action="go-auto-train" title="自动征兵：按「触发线/目标」逐城自动补单（训练营队列判别 · 可设资源保底）">🤖 自动征兵设置' +
            ((GAME.state.settings && GAME.state.settings.autoTrain) ? '（已开启）' : '') + '</button>' +
        '</div>' +
        '</div>';
    }
    return '<div class="ui-page">' + tabsHtml +
      barLine +
      '<div class="troop-grid">' + cards + '</div>' +
      '<div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;">' +
        '<span style="color:var(--gold-light);font-weight:700;">' + (sel ? sel.icon + ' ' + sel.name : '—') + '</span>' +
        '<label style="color:var(--text-dim);">数量</label>' +
        /* v80（老板）：「数量目前是-10，+10这样设计，可以直接输入，上限这个按钮保留」——
           ±10 按钮退役：数量直接输入（input 事件实时同步 ui._trainCount，不重绘、不跳顶）。 */
        '<input type="number" id="train-count" min="1" value="' + qty + '" style="width:96px;padding:6px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
        /* v28（需求 5）：上限按钮 —— 一次填到"幸存者与资源的短板" */
        '<button class="btn sm" data-action="train-max" title="按可用幸存者与资源填到最大可募数">上限</button>' +
        '<span class="ui-sub">上限 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(maxN, 0) + '</b></span>' +
        '<span class="ui-sub">驻军 <b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">'
          + U.numText(haveN, 0) + '</b></span>' +
        /* v89.86（整改 P-19）：上限 0 → 当场归因（幸存者不足 / 资源不足），不再"静默归零" */
        ((maxN <= 0 && limN)
          ? '<span class="ui-sub" style="color:var(--red-light);">' +
              (limN.reason === 'pop'
                ? '⚠️ 可征幸存者不足（劳作占用 ' + U.fmt(GAME.popLaborOf(GAME.currentCity()))
                    + ' 不可征兵）—— 建居所或等待幸存者增长'
                : (limN.reason === 'res'
                    ? '⚠️ 资源不足 —— 缺 ' + ((limN.lack || []).map(function (k) { return GAME.resName(k); }).join('、') || '募兵所需资源')
                    : '当前不可募')) +
            '</span>'
          : '') +
        /* v89.86（整改 P-05）：募兵吃幸存者的说明常驻（此前零提示，"200→140"一脸问号）。
           v89.89（E3 · 100+ 轮实玩期待）：升级为**三段条**（可征 / 上限 / 增势）+ 进度条 ——
           幸存者与兵源的关系一眼可见；增势走 GAME.popGrowthOf 唯一出口（与 tickOnce 同源）。 */
        (sel ? (function () {
          var avail = GAME.popFreeOf(c);   /* v89.126：可征 = 幸存者 − 劳作占用（唯一出口） */
          /* v89.185（老板 6）：面板"上限"与幸存者行同源（民心折算的有效上限） */
          var capP = GAME.effPopCapOf(c) || 0;
          var grow = Math.round(GAME.popGrowthOf(c));
          var pct = capP > 0 ? Math.min(100, Math.round(avail / capP * 100)) : 0;
          var srcTxt = '';
          try {
            (GAME.popSourcesOf(c) || []).forEach(function (x) {
              if (Math.abs(x.v) > 1e-9) srcTxt += '　· ' + x.name + ' ' + (x.v > 0 ? '+' : '') + Math.round(x.v * 100) + '%';
            });
          } catch (e) {}
          return '<span class="pop-3" title="可征＝幸存者 − 劳作占用（城市产业所占，不可征兵 · 当前劳作 '
            + U.fmt(GAME.popLaborOf(c)) + '）· 上限＝居所决定 · 增势＝现实每小时自然增长（基准 2 小时补满）' + srcTxt + '">' +
            '<span class="p3-k">幸存者</span>' +
            '<span class="p3-seg ok">可征 <b>' + U.numText(avail, 0) + '</b></span>' +
            '<span class="p3-seg">上限 <b>' + U.numText(capP, 0) + '</b></span>' +
            '<span class="p3-seg">增势 <b>+' + grow + '/时</b></span>' +
            '<span class="p3-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="p3-note">每兵占幸存者 ' + sel.pop + (capP > 0 && avail > capP ? '　· 超上限不增长' : '') + '</span>' +
            '</span>';
        })() : '') +
        /* v89.99（老板「设计兵种解散」）：解散 = 归农（幸存者返还、军资不退）。
           v89.110（老板「危险按钮能放训练旁边吗？这种人机交互理念符合常理吗」）：
           解散**移出本行** —— 收进下方独立「危险操作」区（红 + 二次确认）。 */
        '<button class="btn gold" data-action="confirm-train" data-troop="' + ui._trainSel + '"' +
          (slotsLeft > 0 ? '' : ' disabled data-why="本营训练队列已满：等待一个队列完成，或升级训练营解锁等待位"') + '>' + (kind === 'craft' ? '制造' : '训练') + '</button>' +
        '<span style="color:var(--text-dim);font-size:var(--fs-sub);">约' + timeStr + '</span>' +
        (slotsLeft > 0
          ? '<span class="ui-sub">队列空位 ' + slotsLeft + '</span>'
          : '<span class="ui-sub" style="color:var(--amber);">' + (kind === 'craft' ? '本作坊' : '本营') + '队列已满' +
            (bar && GAME.trainNextSlotLv(bar.lvl) ? '（Lv' + GAME.trainNextSlotLv(bar.lvl) + ' 解锁下一个等待位）' : '') + '</span>') +
      '</div>' +
      /* v89.110（老板）：**危险操作独立成区** —— 红框 + 红按钮 + 二次确认，与训练（金）
         之间隔开一整行；确认弹窗写清"失去什么、返还什么"（openDisbandConfirm）。 */
      '<div class="op-zone danger" style="margin-top:var(--sp-mid);padding:var(--sp-2) var(--sp-mid);">' +
        '<div class="op-row">' +
          '<span style="color:var(--red-light);font-size:var(--fs-sub);font-weight:700;">⚠️ 危险操作</span>' +
          '<button class="btn sm red" data-action="troop-disband-ask" data-troop="' + ui._trainSel + '"' +
            (haveN > 0 ? '' : ' disabled') +
            ' title="解散本城驻军并归农（返还幸存者、军资不退；需二次确认）">解散所选兵种</button>' +
          '<span class="op-hint">归农返还幸存者 · 军资不退 · 需二次确认</span>' +
        '</div>' +
      '</div>' +
      '</div>';
  };

  /* --------- 英雄 --------- */
"""
s = s[:a] + NEW_C + s[b:]

if DRY:
    print('[DRY] ui.js 三段命中（openTroops区 / trainDef / troopsHTML区）')
else:
    tmp = BASE + P + '.tmp229c4a'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, BASE + P)
    t = rd()
    assert '_trainFilter' not in t, 'filter 残留'
    assert "'g1'" in t and 'data-page="g1"' in t and "'g3'" in t
    assert 'ui.trainBarracks = function' in t and 'sel.craft' in t
    assert '⚔️ 兵种整备' in t
    print('[OK] ui.js 统一面板已落盘 + 自检通过（_trainFilter 零残留）')
print('C4A DONE%s' % ('（DRY）' if DRY else ''))

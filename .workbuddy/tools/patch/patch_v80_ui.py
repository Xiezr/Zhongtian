# -*- coding: utf-8 -*-
"""v80 · UI 层：客栈固定表 / 建筑吸底操作区 / 兵营步兵骑兵分页与数量直输。

老板三条：
  ① 客栈招募：去「史实名将」标（将领界面保留）；表列宽固定（换人时框架不动）
  ② 建筑弹窗：升级 / 拆 1 级 / 移动交换 固定底部，关闭的上方
  ③ 兵营：去「兵营招募·Lv」重复标题 / 工位行 / 解锁计数；步兵·骑兵两页；数量直输；取消跳顶
"""
import io
import sys

DATA = r'E:\Deepseekdb\js\data.js'
UI = r'E:\Deepseekdb\js\ui.js'
MAIN = r'E:\Deepseekdb\js\main.js'
HTML = r'E:\Deepseekdb\index.html'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    # 行尾铁律：先试 LF 变体，找不到才试 CRLF（elif，不是两个都收）
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


print('== A. data.js：兵种分页字段（步兵 / 骑兵）==')
CAT = {'minfu': 'inf', 'yibing': 'inf', 'chihou': 'cav', 'changqiang': 'inf', 'daodun': 'inf',
       'gongjian': 'inf', 'qingji': 'cav', 'tieji': 'cav', 'zhouche': 'inf', 'qingzhoubing': 'inf',
       'tengjiabing': 'inf', 'tuqibing': 'cav', 'hubaoqi': 'cav', 'xiliangtieqi': 'cav',
       'nanjiangxiangbing': 'cav'}
NAMES = {'minfu': '民夫', 'yibing': '义兵', 'chihou': '斥候', 'changqiang': '长枪兵', 'daodun': '刀盾兵',
         'gongjian': '弓箭手', 'qingji': '轻骑兵', 'tieji': '铁骑兵', 'zhouche': '辎重车',
         'qingzhoubing': '青州兵', 'tengjiabing': '藤甲兵', 'tuqibing': '突骑兵', 'hubaoqi': '虎豹骑',
         'xiliangtieqi': '西凉铁骑', 'nanjiangxiangbing': '南疆象兵'}
for tid, cat in CAT.items():
    patch(DATA,
          "{ id: '%s', name: '%s'," % (tid, NAMES[tid]),
          "{ id: '%s', cat: '%s', name: '%s'," % (tid, cat, NAMES[tid]),
          'A-%s=%s' % (tid, cat))

print()
print('== B. ui.js ==')

# B1 · 客栈：去史实名将标
patch(UI,
"""          '<span class="inn-name" style="white-space:nowrap;">' + U.escape(c.name) +
            (c.hero ? ' <span class="tag-hero">史实名将</span>' : '') + '</span></span></td>' +""",
"""          /* v80（老板）：「不要将领名称后边的『史实名将』这种标签，在将领界面显示就好」——
             招募行去标；将领档案清单里那枚（gcard-tag hero）保留。 */
          '<span class="inn-name" style="white-space:nowrap;">' + U.escape(c.name) + '</span></span></td>' +""",
'B1 客栈去标签')

# B2 · 客栈：固定列宽（colgroup）
patch(UI,
"""        '<table class="tbl inn-tbl"><thead><tr>' +""",
"""        /* v80（老板）：「招募界面的表格行宽相对固定，根据字串长度搞个适合的固定表，
           在换人时框架不动，只有将领信息变动」——colgroup + table-layout: fixed，
           列宽只认表头这一次声明，换批只动内容（列宽表在 index.html 的 .inn-tbl 段）。 */
        '<table class="tbl inn-tbl"><colgroup>' +
          '<col class="c-name"><col class="c-lv"><col class="c-rank"><col class="c-style">' +
          '<col class="c-attr"><col class="c-attr"><col class="c-attr"><col class="c-attr">' +
          '<col class="c-salary"><col class="c-act"></colgroup>' +
          '<thead><tr>' +""",
'B2 客栈固定列宽')

# B3 · 兵营：分页状态声明
patch(UI,
"""  ui._trainFilter = 'normal';""",
"""  ui._trainFilter = 'normal';
  /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」—— 募兵页当前分页（inf 步兵 / cav 骑兵） */
  ui._trainTab = 'inf';""",
'B3 分页状态')

# B4 · 兵营：ids 按页过滤
patch(UI,
"""    var ids = Object.keys(DATA.TROOPS).filter(function (id) {
      var isCraft = !!DATA.TROOPS[id].craft;
      return ui._trainFilter === 'siege' ? isCraft : !isCraft;
    });
    if (ids.length && ids.indexOf(ui._trainSel) < 0) ui._trainSel = ids[0];""",
"""    /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」——
       常备兵按 DATA.TROOPS[].cat 拆两页（inf 步兵 / cav 骑兵），ui._trainTab 记当前页；
       器械页（工匠作坊）维持单列表。选中项若不在本页，自动落到本页首位。 */
    var ids = Object.keys(DATA.TROOPS).filter(function (id) {
      var t = DATA.TROOPS[id];
      if (ui._trainFilter === 'siege') return !!t.craft;
      if (t.craft) return false;
      return (t.cat || 'inf') === ui._trainTab;
    });
    if (ids.length && ids.indexOf(ui._trainSel) < 0) ui._trainSel = ids[0];""",
'B4 分页过滤')

# B5 · 兵营：工位信息行撤除（空态保留）
patch(UI,
"""    var barLine = bar
      ? '<div class="q-sec"><span class="q-sec-t">' + (isSiege ? '工匠作坊' : '募兵军营') + '</span>' +
        '<span class="q-sec-n">城内第 ' + (bar.idx + 1) + ' 格 · Lv' + bar.lvl +
        ' · 队列位 ' + GAME.trainQueueSlots(bar.lvl, c) + '</span></div>'
      /* 无对应建筑时给状态而非沉默：按钮会因此不可用，得让人知道为什么 */
      : '<div class="q-empty">本城尚未建造' + (isSiege ? '工匠作坊，无法制造器械。' : '军营，无法募兵。') + '</div>';""",
"""    /* v80（老板）：「募兵军营 城内第 46 格 · Lv11 · 队列位 3 这个也不需要」——
       所属工位的信息行撤除（空态保留：没有对应建筑时按钮会不可用，得让人知道为什么）。 */
    var barLine = bar ? ''
      : '<div class="q-empty">本城尚未建造' + (isSiege ? '工匠作坊，无法制造器械。' : '军营，无法募兵。') + '</div>';""",
'B5 工位行撤除')

# B6 · 兵营：去重复标题 + 分页按钮
patch(UI,
"""    return '<div class="ui-page">' +
      '<div class="gold-heading">' + (ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募') +
        (bar ? ' · Lv' + bar.lvl : '') + '</div>' +
      barLine +
      '<div class="troop-grid">' + cards + '</div>' +""",
"""    /* v80（老板）：「兵营招募·LV11这个不需要」—— 本函数里这行与弹窗标题重复，整行撤除
       （弹窗标题已有「⚔️ 兵营招募」，只留一处）；「步兵 / 骑兵」两页切换按钮放最上、
       「N / M 种」解锁计数也不要（同批撤除）。 */
    return '<div class="ui-page">' +
      (ui._trainFilter === 'siege' ? ''
        : '<div class="train-tabs">' +
            '<button class="btn sm' + (ui._trainTab === 'cav' ? '' : ' gold') + '" data-action="train-tab" data-page="inf">🗡 步兵</button>' +
            '<button class="btn sm' + (ui._trainTab === 'cav' ? ' gold' : '') + '" data-action="train-tab" data-page="cav">🐎 骑兵</button>' +
          '</div>') +
      barLine +
      '<div class="troop-grid">' + cards + '</div>' +""",
'B6 去标题+分页按钮')

# B7 · 兵营：数量直输（±10 退役）
patch(UI,
"""        '<button class="btn sm" data-action="train-qty" data-d="-10">-10</button>' +
        '<input type="number" id="train-count" min="1" value="' + qty + '" style="width:80px;padding:6px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
        '<button class="btn sm" data-action="train-qty" data-d="10">+10</button>' +""",
"""        /* v80（老板）：「数量目前是-10，+10这样设计，可以直接输入，上限这个按钮保留」——
           ±10 按钮退役：数量直接输入（input 事件实时同步 ui._trainCount，不重绘、不跳顶）。 */
        '<input type="number" id="train-count" min="1" value="' + qty + '" style="width:96px;padding:6px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +""",
'B7 数量直输')

# B8 · 兵营：解锁计数行撤除
patch(UI,
"""      '<div class="ui-sub" style="text-align:center;margin-top:6px;">' +
        '已解锁 <b style="color:var(--gold-light)">' + ids.filter(function (id) { return GAME.canTrain(id).ok; }).length +
        '</b> / ' + ids.length + ' 种</div>' +
      (bar ? ui.trainQueueBlock(bar, c, kind) : '') +""",
"""      (bar ? ui.trainQueueBlock(bar, c, kind) : '') +""",
'B8 计数行撤除')

# B9 · 兵营：重绘不跳顶（滚动位保留）
patch(UI,
"""  ui.openTroops = function (idx, filter) {
    ui._trainBIdx = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    ui._trainFilter = (filter === 'siege') ? 'siege' : 'normal';
    ui.openPanel('troops', ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募');
  };""",
"""  ui.openTroops = function (idx, filter) {
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
    ui._trainBIdx = (idx == null || idx === '' || !isFinite(Number(idx))) ? null : Number(idx);
    ui._trainFilter = (filter === 'siege') ? 'siege' : 'normal';
    ui.openPanel('troops', ui._trainFilter === 'siege' ? '🛠️ 工匠作坊 · 制造器械' : '⚔️ 兵营招募');
    if (keep) {
      var nIp = $('#modal-root .inner-panel');
      var nPb = $('#modal-root .panel-body');
      if (nIp) nIp.scrollTop = keep.ip;
      if (nPb) nPb.scrollTop = keep.pb;
    }
  };""",
'B9 不跳顶')

# B10 · 建筑弹窗：吸底操作区开
patch(UI,
"""        '<div class="bldg-acts">' +""",
"""        /* v80（老板）：「升级，拆除（拆1级），移动/交换固定放在底部，关闭的上方」——
           三键与关闭合成一块**吸底操作区**（.bldg-bottom）：内容再长也钉在弹窗下沿，
           上排＝操作三键，下排＝关闭。 */
        '<div class="bldg-bottom">' +
          '<div class="bldg-acts">' +""",
'B10 吸底区开')

# B11 · 建筑弹窗：吸底操作区收
patch(UI,
"""        '</div>' +
        '<div class="bldg-foot">' +
          '<button class="btn" data-action="close-modal">关闭</button>' +
        '</div>'
      );
    } else {
      /* 空地：选择建筑（弹窗式） */""",
"""          '</div>' +
          '<div class="bldg-foot">' +
            '<button class="btn" data-action="close-modal">关闭</button>' +
          '</div>' +
        '</div>'
      );
    } else {
      /* 空地：选择建筑（弹窗式） */""",
'B11 吸底区收')

print()
print('== C. main.js ==')

# C1 · train-tab 分发（替换 train-qty）
patch(MAIN,
"""      case 'train-qty': GAME.adjustTrainQty(Number(el.dataset.d)); break;""",
"""      /* v80（老板）：「步兵 / 骑兵」翻页（±10 退役，数量改直输 —— 见 troopsHTML） */
      case 'train-tab': ui._trainTab = (el.dataset.page === 'cav') ? 'cav' : 'inf'; ui.renderTroopsModal(); break;""",
'C1 分页分发')

# C2 · adjustTrainQty 退役
patch(MAIN,
"""  /* v20：数量走 ui._trainCount 状态；加减后重绘**弹窗**（原先 refreshView 只重绘中央视图） */
  GAME.adjustTrainQty = function (d) {
    ui._trainCount = Math.max(1, (Number(ui._trainCount) || 1) + d);
    if (ui.renderTroopsModal) ui.renderTroopsModal();
  };""",
"""  /* v80（老板）：「数量…可以直接输入」—— ±10 的 adjustTrainQty 随按钮一并退役；
     直输由 input 事件同步（GAME.syncTrainQty），不再需要"加减后重绘"这条链。 */""",
'C2 函数退役')

print()
print('== D. index.html ==')

# D0 · 去重：v77 CSS 段整段重复（第二份删掉）
h = io.open(HTML, encoding='utf-8', newline='').read()
m1 = "  /* ============================================================\n     v77（老板）"
i1 = h.find(m1)
i2 = h.find(m1, i1 + 1)
if i2 < 0:
    print('  · D0 去重：只有一份（跳过）')
else:
    blk = h[i1:i2]
    if h[i2:i2 + len(blk)] != blk:
        print('  ✗ D0：两份 v77 段内容不一致，拒绝自动去重')
        sys.exit(1)
    h2 = h[:i2] + h[i2 + len(blk):]
    io.open(HTML, 'w', encoding='utf-8', newline='').write(h2)
    print('  ✓ D0 v77 段去重（删第二份，共 %d 字符）' % len(blk))

# D1 · 客栈固定列宽 CSS
patch(HTML,
"""  .inn-tbl { margin: 0; }""",
"""  /* v80（老板）：「表格行宽相对固定，根据字串长度搞个适合的固定表，在换人时框架不动，
     只有将领信息变动」——table-layout: fixed 只认声明过的宽度（colgroup，见 ui.openInn）；
     列宽按各列字串长度分配：将领最宽（头像+姓名）、四维最窄（2~3 位数字）。
     列宽和贴着容器实宽（实测 942px）：不足时浏览器会按比例压列，别随手改单列。 */
  .inn-tbl { margin: 0; table-layout: fixed; }
  .inn-tbl col.c-name { width: 188px; }
  .inn-tbl col.c-lv { width: 58px; }
  .inn-tbl col.c-rank { width: 168px; }
  .inn-tbl col.c-style { width: 66px; }
  .inn-tbl col.c-attr { width: 58px; }
  .inn-tbl col.c-salary { width: 88px; }
  .inn-tbl col.c-act { width: 140px; }""",
'D1 客栈固定列宽')

# D2 · 建筑吸底操作区 CSS（接在 :has(> .bldg-foot) 之后）
patch(HTML,
"""  .modal .inner-panel:has(> .bldg-foot) { display: flex; flex-direction: column; }
  .modal .inner-panel:has(> .bldg-foot) > .bldg-foot { margin-top: auto; }""",
"""  .modal .inner-panel:has(> .bldg-foot) { display: flex; flex-direction: column; }
  .modal .inner-panel:has(> .bldg-foot) > .bldg-foot { margin-top: auto; }
  /* v80（老板）：「升级，拆除（拆1级），移动/交换固定放在底部，关闭的上方」——
     三键与关闭合成一块**吸底操作区**（.bldg-bottom）：几何沿用 v73 校准值
     （出血到面板边缘 + 钉面板下沿），内容短时 margin-top:auto 贴底、长时 sticky 接管。 */
  .bldg-bottom { position: sticky; bottom: -12px; z-index: 3;
    margin: 12px -12px -12px; padding: 8px 12px 22px;
    border-top: 1px solid var(--line-strong);
    background: var(--panel-bg);
    box-shadow: 0 -6px 12px rgba(var(--sh-rgb),.28); }
  .bldg-bottom .bldg-acts { margin-top: 0; }
  .bldg-bottom .bldg-foot { position: static; margin: 8px 0 0; padding: 0;
    border-top: 0; background: transparent; box-shadow: none; }
  .modal .inner-panel:has(> .bldg-bottom) { display: flex; flex-direction: column; }
  .modal .inner-panel:has(> .bldg-bottom) > .bldg-bottom { margin-top: auto; }""",
'D2 吸底操作区')

# D3 · 兵营分页按钮 CSS
patch(HTML,
"""  .troop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }""",
"""  /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」—— 两页切换（选中页走 .btn.gold） */
  .train-tabs { display: flex; justify-content: center; gap: 10px; margin-bottom: 10px; }
  .train-tabs .btn { min-width: 118px; }
  .troop-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }""",
'D3 分页按钮')

print()
print('全部落盘完成。')

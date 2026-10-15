"""v81 · 主补丁：君主卡名称并入信息表首行 / 兵营三页制（队列 · 步兵 · 骑兵）。

老板原文：
1.没有官职，左侧玩家角色这里，官职这行放玩家名称，现在的名称位置去掉
2.兵营招募这里，做成3页，第一页为募兵队列，步兵骑兵底下就不要募兵队列了

- A. index.html：君主头——官职行/旧名称列退役，名称并入 .mrow-name 首行；
     CSS——头像不吃收缩、信息表 flex 伸缩（原 width:100% 把名称挤成 21px 竖条）
- B. ui.js：syncHeader 不再写 #lord-office；troopsHTML 三页制（que/inf/cav），
     队列独占第一页；分页初始态 'que'
- C. main.js：train-tab 三页白名单分发
"""
import io, sys

HTML = r'E:\Deepseekdb\index.html'
UI = r'E:\Deepseekdb\js\ui.js'
MAIN = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    # 行尾铁律：先试 LF 变体，找不到才试 CRLF（避免把新文本强行转行尾）
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


print('== A. index.html ==')

# A1 · 君主头 HTML：官职行 / 旧名称列退役，名称并入信息表首行
patch(HTML,
"""        <!-- v25（需求 9）：头像换成程序化立绘（不再是 emoji）；君主名**单独一行**放在头像下方，
             不再和头像挤在同一行；「城池 N 城」这类统计从这一栏删掉（统计页已有）。 -->
        <div class="lord-head">
          <div class="lord-portrait" id="lord-avatar"></div>
          <div class="lord-name-row"><span class="name" id="lord-name">—</span></div>
          <div class="lord-meta">
            <div class="row"><span>官职</span><span id="lord-office">平民</span></div>
            <div class="row"><span>声望</span><span id="lord-rep">0</span></div>
            <div class="row"><span>爵位</span><span id="lord-rank">0</span></div>
          </div>
        </div>""",
"""        <!-- v25（需求 9）：头像换成程序化立绘（不再是 emoji）；「城池 N 城」这类统计从这一栏删掉。
             v81（老板）：「官职这行放玩家名称，现在的名称位置去掉」—— 游戏里没有官职体系，
             该行退役、君主名并入信息表首行；旧的头像旁名称列一并撤除。 -->
        <div class="lord-head">
          <div class="lord-portrait" id="lord-avatar"></div>
          <div class="lord-meta">
            <div class="row mrow-name"><span class="name" id="lord-name">—</span></div>
            <div class="row"><span>声望</span><span id="lord-rep">0</span></div>
            <div class="row"><span>爵位</span><span id="lord-rank">0</span></div>
          </div>
        </div>""",
 'A1 君主头 HTML')

# A2 · 君主卡 CSS：flex 伸缩 + 名称行样式
patch(HTML,
"""  .lord-meta { width: 100%; font-size: var(--fs-body); line-height: 1.7; }
  .lord-meta .name { font-size: var(--fs-h2); font-weight: 800; color: var(--gold-light); }
  /* v25（需求 9）：立绘 + 名称单独一行 */
  .lord-name-row { text-align: center; margin: 4px 0 2px; }
  .lord-portrait {
    width: 68px; height: 68px; border-radius: 8px; overflow: hidden;
    border: 1px solid var(--gold-dark); background: #0b0e12;
    box-shadow: inset 0 0 0 1px rgba(var(--sh-rgb),.6), 0 2px 8px rgba(var(--sh-rgb),.45);
  }
  .lord-portrait svg { display: block; width: 100%; height: 100%; }
  .lord-meta .row { display: flex; justify-content: space-between; }
  .lord-meta .row span:first-child { color: var(--text-dim); }""",
"""  /* v81（老板）：信息表改 flex 伸缩 —— 原先 width:100% 与头像同抢宽度（名称列被挤成
     21px 竖条、头像压到 45px）；头像不吃收缩、信息表占满余量，名称并入首行。 */
  .lord-meta { flex: 1 1 0; min-width: 0; font-size: var(--fs-body); line-height: 1.7; }
  .lord-meta .name { font-size: var(--fs-h2); font-weight: 800; color: var(--gold-light); }
  .lord-portrait {
    flex: 0 0 auto;
    width: 68px; height: 68px; border-radius: 8px; overflow: hidden;
    border: 1px solid var(--gold-dark); background: #0b0e12;
    box-shadow: inset 0 0 0 1px rgba(var(--sh-rgb),.6), 0 2px 8px rgba(var(--sh-rgb),.45);
  }
  .lord-portrait svg { display: block; width: 100%; height: 100%; }
  .lord-meta .row { display: flex; justify-content: space-between; }
  .lord-meta .row span:first-child { color: var(--text-dim); }
  /* 名称行（信息表首行）：金色标题；行高收紧，与其余行齐平 */
  .lord-meta .row.mrow-name { line-height: 1.4; }
  .lord-meta .row.mrow-name span:first-child { color: var(--gold-light); }""",
 'A2 君主卡 CSS')


print()
print('== B. ui.js ==')

# B1 · syncHeader：不再写 #lord-office
patch(UI,
"""    $('#lord-name').textContent = s.ruler.name;
    $('#lord-office').textContent = (s.rank && DATA.RANK[s.rank]) ? DATA.RANK[s.rank].name : '平民';
    $('#lord-rep').textContent = U.fmt(s.rep);""",
"""    /* v81（老板）：「官职这行放玩家名称」—— 官职行退役（游戏里没有官职体系），
       君主名落在信息表首行；#lord-office 不再存在、也不再写。 */
    $('#lord-name').textContent = s.ruler.name;
    $('#lord-rep').textContent = U.fmt(s.rep);""",
 'B1 syncHeader')

# B2 · 分页初始态：inf → que（第一页 = 募兵队列）
patch(UI,
"""  /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」—— 募兵页当前分页（inf 步兵 / cav 骑兵） */
  ui._trainTab = 'inf';""",
"""  /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」；
     v81（老板）：「做成3页，第一页为募兵队列」—— 分页改三页制：
     que 募兵队列（首页） / inf 步兵 / cav 骑兵。 */
  ui._trainTab = 'que';""",
 'B2 分页初始态')

# B3 · troopsHTML：isQueueTab + 兵种过滤
patch(UI,
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
"""    /* v80（老板）：「页面分成步兵，骑兵两个界面，翻页」——
       常备兵按 DATA.TROOPS[].cat 拆页（inf 步兵 / cav 骑兵），ui._trainTab 记当前页；
       器械页（工匠作坊）维持单列表。选中项若不在本页，自动落到本页首位。
       v81（老板）：「做成3页，第一页为募兵队列，步兵骑兵底下就不要募兵队列了」——
       三页制：que 募兵队列（首页，队列独占一页）/ inf 步兵 / cav 骑兵。 */
    var isQueueTab = (ui._trainFilter !== 'siege' && ui._trainTab === 'que');
    var ids = Object.keys(DATA.TROOPS).filter(function (id) {
      var t = DATA.TROOPS[id];
      if (ui._trainFilter === 'siege') return !!t.craft;
      if (isQueueTab) return false;                 /* 队列页不出兵种卡 */
      if (t.craft) return false;
      return (t.cat || 'inf') === ui._trainTab;
    });
    if (ids.length && ids.indexOf(ui._trainSel) < 0) ui._trainSel = ids[0];""",
 'B3 troopsHTML 过滤')

# B4a · return 头：三页 tabs + 队列页分支
patch(UI,
"""    /* v80（老板）：「兵营招募·LV11这个不需要」—— 本函数里这行与弹窗标题重复，整行撤除
       （弹窗标题已有「⚔️ 兵营招募」，只留一处）；「步兵 / 骑兵」两页切换按钮放最上、
       「N / M 种」解锁计数也不要（同批撤除）。 */
    return '<div class="ui-page">' +
      (ui._trainFilter === 'siege' ? ''
        : '<div class="train-tabs">' +
            '<button class="btn sm' + (ui._trainTab === 'cav' ? '' : ' gold') + '" data-action="train-tab" data-page="inf">🗡 步兵</button>' +
            '<button class="btn sm' + (ui._trainTab === 'cav' ? ' gold' : '') + '" data-action="train-tab" data-page="cav">🐎 骑兵</button>' +
          '</div>') +
      barLine +""",
"""    /* v80（老板）：「兵营招募·LV11这个不需要」—— 本函数里这行与弹窗标题重复，整行撤除
       （弹窗标题已有「⚔️ 兵营招募」，只留一处）；「N / M 种」解锁计数也不要（同批撤除）。 */
    var tabsHtml = ui._trainFilter === 'siege' ? ''
      : '<div class="train-tabs">' +
          '<button class="btn sm' + (ui._trainTab === 'que' ? ' gold' : '') + '" data-action="train-tab" data-page="que">📜 募兵队列</button>' +
          '<button class="btn sm' + (ui._trainTab === 'inf' ? ' gold' : '') + '" data-action="train-tab" data-page="inf">🗡 步兵</button>' +
          '<button class="btn sm' + (ui._trainTab === 'cav' ? ' gold' : '') + '" data-action="train-tab" data-page="cav">🐎 骑兵</button>' +
        '</div>';
    /* v81（老板）：队列独占「第一页」—— 步兵/骑兵页不再拖队列；
       工匠作坊（器械）维持旧结构（底部队列），未在本次改动范围。 */
    if (isQueueTab) {
      return '<div class="ui-page">' + tabsHtml +
        (bar ? ui.trainQueueBlock(bar, c, kind)
             : '<div class="q-empty">本城尚未建造军营，无法募兵。</div>') +
        '</div>';
    }
    return '<div class="ui-page">' + tabsHtml +
      barLine +""",
 'B4a 三页 tabs + 队列页')

# B4b · return 尾：队列只在队列页与器械页（步兵/骑兵页不带）
patch(UI,
"""      (bar ? ui.trainQueueBlock(bar, c, kind) : '') +
      '</div>';
  };""",
"""      (isSiege && bar ? ui.trainQueueBlock(bar, c, kind) : '') +
      '</div>';
  };""",
 'B4b 尾部队列')


print()
print('== C. main.js ==')

patch(MAIN,
"""      /* v80（老板）：「步兵 / 骑兵」翻页（±10 退役，数量改直输 —— 见 troopsHTML） */
      case 'train-tab': ui._trainTab = (el.dataset.page === 'cav') ? 'cav' : 'inf'; ui.renderTroopsModal(); break;""",
"""      /* v80（老板）：「步兵 / 骑兵」翻页（±10 退役，数量改直输 —— 见 troopsHTML）；
         v81（老板）：「做成3页，第一页为募兵队列」—— que / inf / cav 三页白名单 */
      case 'train-tab': ui._trainTab = (['que', 'inf', 'cav'].indexOf(el.dataset.page) >= 0) ? el.dataset.page : 'que'; ui.renderTroopsModal(); break;""",
 'C1 train-tab 三页分发')

print()
print('主补丁完成。')

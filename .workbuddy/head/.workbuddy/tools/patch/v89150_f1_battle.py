# -*- coding: utf-8 -*-
# v89.150（老板 4/5/6）：战场铺满（modal-max + 侧栏定宽）/ 战斗待指挥清单 / 关闭回大界面
import io, re


def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in segs:
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)


# ============ ① ui.js：战场清单 + 战场弹窗改 max + closeAll ============
patch('E:/Deepseekdb/js/ui.js', [
("""  ui.openBattlefield = function (id) {""",
 """  /* ============================================================
   * v89.150（老板 5）：「不要主动直接弹出战斗界面，如果目前触发新战斗，提供一个弹窗，
   *   假设同时有多场战斗，简洁提供上方标题，下方表格样式的：目标，战斗类型，是否观战按钮」
   * ------------------------------------------------------------
   * 旧：行军抵达（`onMarchArrive`）→ **直接进战场**（玩家正在做别的事也被拽走）。
   * 新：弹本清单 —— **所有待指挥战斗**（`state === 'live'`）一处列出，多场并列；
   *   点「观战」才进战场。不点也行：战斗按 `settings.battleSec` 逐回合自动推进
   *   （后台照打，只是没有即时指挥）。
   * ============================================================ */
  ui.battleListOf = function () {
    return (((GAME.state || {}).battles) || []).filter(function (b) { return b.state === 'live'; });
  };
  ui.battleListRowsHTML = function (list) {
    return (list || []).map(function (b) {
      var t = b.target || {};
      var mode = (GAME.battle && GAME.battle.modeOf) ? GAME.battle.modeOf(b.modeId) : null;
      var type = (b.side === 'def') ? '守城' : (((mode || {}).name) || '战斗');
      return '<tr>' +
        '<td>' + U.escape(t.name || '（未知目标）') + '</td>' +
        '<td>' + U.escape(type) + '</td>' +
        '<td class="num"><button class="btn sm gold" data-action="bt-open" data-id="' + b.id + '">👁 观战</button></td>' +
        '</tr>';
    }).join('');
  };
  ui.battleListHTML = function () {
    var list = ui.battleListOf();
    var sec = ((GAME.state || {}).settings || {}).battleSec || 60;
    return '<div class="gold-heading">⚔ 战斗待指挥</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;margin-bottom:10px;">' +
        '共 <b style="color:var(--gold-light);">' + list.length + '</b> 场 ——— ' +
        '点「观战」进场指挥；不观战也会每 ' + sec + ' 秒自动推进一回合（后台照打）。</div>' +
      '<table class="tbl"><thead><tr><th>目标</th><th>战斗类型</th><th>是否观战</th></tr></thead>' +
      '<tbody>' + ui.battleListRowsHTML(list) + '</tbody></table>';
  };
  ui.openBattleList = function () {
    var list = ui.battleListOf();
    if (!list.length) { ui.toast('当前没有待指挥的战斗'); return; }
    ui.openModal(ui.battleListHTML(), { size: 'md' });
  };

  ui.openBattlefield = function (id) {""",
 '①-a 战斗清单出口'),

("""    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      size: 'xxl',
      body: '<div id="bt-wrap">' + ui.battlefieldHTML(rec) + '</div>',
      /* v89.120：三键已移到读秒行（.bt-acts，见 ui.btTopHTML）——
         底栏只留"后台运行"（它是关闭键，由 openModal 统一剥离） */
      foot: '<button class="btn" data-action="close-modal">后台运行</button>',
    });""",
 """    ui.openShell({
      title: '⚔ 战场 · ' + U.escape((rec.target && rec.target.name) || '目标'),
      /* v89.150（老板 4）：「战场战斗界面铺满界面，目前主要是左右留空了，导致战场画面被压缩」
         —— 档位 xxl(1200×850) → **max**（画布 − 16px，实测 1424×884）：
         左右留白清零、中间战场随宽度长出来（列宽见 index.html 的 .bt-board）。 */
      size: 'max',
      body: '<div id="bt-wrap">' + ui.battlefieldHTML(rec) + '</div>',
      /* v89.120：三键已移到读秒行（.bt-acts，见 ui.btTopHTML）——
         底栏只留"后台运行"（它是关闭键，由 openModal 统一剥离） */
      foot: '<button class="btn" data-action="close-modal">后台运行</button>',
      /* v89.150（老板 6）：「关闭战场后，不返回目标界面（野地或某城池）而会到点开弹窗的
         大界面，在哪里点开就回到哪里（如地图，城内或城外）」——
         `closeAll` = 该层关闭键走 closeAllModals（一次关净 → 回视图层）；
         否则会弹回上一级面板（出征界面/野地面板那类"中间界面"）。 */
      closeAll: true,
    });""",
 '①-b 战场改 max + closeAll'),
])

# ============ ② ui.js：onMarchArrive 改弹清单 ============
patch('E:/Deepseekdb/js/main.js', [
("""    /* v89.87（老板需求 4）：观战挂起 → 直接进入战场界面（不再只弹 toast） */
    if (r.pending && r.battleId) { ui.openBattlefield(r.battleId); return; }""",
 """    /* ============================================================
     * v89.150（老板 5）：「不要主动直接弹出战斗界面，如果目前触发新战斗，提供一个弹窗，
     *   假设同时有多场战斗，简洁提供上方标题，下方表格样式的：目标，战斗类型，是否观战按钮」
     * ------------------------------------------------------------
     * 旧（v89.87）：挂起 → `ui.openBattlefield` 直接进战场。
     * 新：弹「战斗待指挥」清单（多场并列）；**正在观战时**不弹窗打断，只 toast 报数
     *   （否则会把正在看的那场压到下层）。
     * ============================================================ */
    if (r.pending && r.battleId) {
      if (ui._bt) {
        ui.toast('⚔ 新的战斗待指挥（待指挥 ' + ui.battleListOf().length + ' 场）—— 关闭当前战场后可查看');
        return;
      }
      ui.openBattleList();
      return;
    }""",
 '② onMarchArrive 弹清单'),
])

# ============ ③ index.html：战场列宽（侧栏定宽 248 · 战场吃满） ============
patch('E:/Deepseekdb/index.html', [
("""  .bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 1.1fr 3.8fr 1.1fr; grid-template-rows: minmax(0, 1fr);
    gap: var(--sp-2); align-items: stretch; }""",
 """  /* v89.150（老板 4）：「战场战斗界面铺满界面，目前主要是左右留空了，导致战场画面被压缩」——
     弹窗升 max 档（1424 宽）后，列宽也从"比例分"改成**侧栏定宽**：
       248px : 1fr : 248px —— 中间战场吃掉全部剩余（实测 730 → 约 916px，+25%）。
     比例分（旧 1.1fr:3.8fr:1.1fr）会把"多出来的宽度"也分给侧栏，战场涨得慢。 */
  .bt-board { flex: 1 1 auto; min-height: 0; overflow: hidden;
    display: grid; grid-template-columns: 248px minmax(0, 1fr) 248px; grid-template-rows: minmax(0, 1fr);
    gap: var(--sp-2); align-items: stretch; }""",
 '③ 战场列宽'),
])

print('ALL OK')

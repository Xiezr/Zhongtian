# -*- coding: utf-8 -*-
"""v69：任务列表 —— 可领取的自动置顶 + 行右侧直接「领取」。

老板原话（2026-09-14）：
  「已完成的任务自动浮动到最上方，右侧直接添加领取按钮」

改动清单：
  ① js/ui.js      ui.tasksHTML 重构：达标项浮到顶部「✅ 可领取奖励」块（一处占位），
                  行右侧挂「领取」按钮（复用 claim-quest / claim-rand-quest，不新造 action）
  ② index.html    CSS：.q-row-act（按钮右推）+ .q-sec-ready（标题着色）
  ③ smoke-test.js 追加「第 57 节」（9 条行为断言 + 5 条源码守卫）
  ④ e2e-test.js   追加「⑥.5」真实 DOM 领取动线（点按钮 → 离池 + 流水 + 不弹详情）
  ⑤ docs/设计规范.md   追加 §12 任务列表规范（注意：本文件是 CRLF 行尾）
  ⑥ docs/AI工作备忘.md §八 追加一条界面约定

用法：python patch_quest_ready.py     （幂等；锚点不唯一就拒绝写盘）
"""
import io
import os
import re
import sys

ROOT = r'E:\Deepseekdb'
J = lambda *a: os.path.join(ROOT, *a)
UI = J('js', 'ui.js')
HTML = J('index.html')
SMOKE = J('smoke-test.js')
E2E = J('e2e-test.js')
SPEC = J('docs', '设计规范.md')
MEMO = J('docs', 'AI工作备忘.md')


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def save_lf(p, s, tag):
    """LF 文件写盘 + 落盘核验（拒绝任何 CR 混入 —— 全仓 -text 字节约定）"""
    if '\r' in s:
        print('!! %s：内容含 CR，拒绝写盘' % tag)
        return False
    io.open(p, 'w', encoding='utf-8', newline='').write(s)
    back = io.open(p, 'rb').read()
    if b'\r' in back:
        print('!! %s：落盘核验失败（出现 CR）' % tag)
        return False
    return True


def cut(src, old, new, tag, optional=False):
    """唯一锚点替换。命中 0 次 → 若 optional 视为已改过；否则拒绝。"""
    n = src.count(old)
    if n == 0:
        if optional:
            print('  · %s：锚点不存在（已改过？跳过）' % tag)
            return src
        print('!! %s：锚点 0 次命中，拒绝写盘' % tag)
        return None
    if n > 1:
        print('!! %s：锚点 %d 次命中（必须唯一），拒绝写盘' % tag % n)
        return None
    print('  ✓ %s' % tag)
    return src.replace(old, new, 1)


# ============================================================
# ① js/ui.js —— ui.tasksHTML 重构
# ============================================================
START = '  ui.tasksHTML = function () {'
END = '  /* ============================================================\n   * 任务详情（v25 · 需求 11）'

NEW_TASKS = """  ui.tasksHTML = function () {
    var s = GAME.state;
    var sum = GAME.questSummary();
    var pool = s.quests.pool || [];
    var cap = (DATA.QUEST_DAILY && DATA.QUEST_DAILY.maxActive) || 5;

    /* 列表行（点名称进详情） */
    var rowHtml = function (o) {
      return '<div class="q-row" data-action="quest-detail"'
        + ' data-kind="' + o.kind + '" data-id="' + o.id + '">'
        + '<span class="q-row-n">' + U.escape(o.title) + '</span>'
        + (o.tag ? '<span class="q-tag ' + (o.tagCls || '') + '">' + o.tag + '</span>' : '')
        + '<span class="q-row-p">' + o.cur + ' / ' + o.goal + '</span>'
        + '</div>';
    };
    /* v69（老板「已完成的任务自动浮动到最上方，右侧直接添加领取按钮」）：
       达标任务浮到顶部「可领取奖励」块，行右侧直接挂「领取」——
       一步领取，不必再进详情；行本身仍可点（想看背景 / 奖励明细照旧）。
       按钮复用既有 action（claim-quest / claim-rand-quest），不新造出口。 */
    var readyRowHtml = function (o) {
      return '<div class="q-row ready" data-action="quest-detail"'
        + ' data-kind="' + o.kind + '" data-id="' + o.id + '">'
        + '<span class="q-row-n">' + U.escape(o.title) + '</span>'
        + (o.tag ? '<span class="q-tag ' + (o.tagCls || '') + '">' + o.tag + '</span>' : '')
        + '<span class="q-row-act"><button class="btn gold sm" data-action="'
        + (o.kind === 'random' ? 'claim-rand-quest' : 'claim-quest')
        + '" data-q="' + o.id + '">领取</button></span>'
        + '</div>';
    };
    var notReady = function (o) { return !o.ready; };

    /* ① 随机任务（每日 5 项） */
    var randItems = pool.map(function (entry) {
      var def = GAME.randomQuestDef(entry.id);
      if (!def) return null;
      return {
        kind: 'random', id: entry.id, title: def.title,
        tag: (DATA.QUEST_TYPES[def.type] || def.type), tagCls: 't-' + def.type,
        cur: GAME.randQuestAmount(entry), goal: def.goal, ready: GAME.randQuestReady(entry),
      };
    }).filter(function (o) { return !!o; });

    /* ② 成长任务（进行中） */
    var undone = (DATA.QUESTS || []).filter(function (q) { return !GAME.questDone(q); });
    var growthItems = undone.map(function (q) {
      return {
        kind: 'growth', id: q.id, title: q.title, tag: '成长', tagCls: 't-growth',
        cur: GAME.questAmount(q), goal: GAME.questGoal(q), ready: GAME.questReady(q),
      };
    });

    /* ③ 可领取（自动置顶 · 唯一出口）：随机在前、成长在后（与下方区块同序）。
       浮上去的项**不再**在各自区块重复出现 —— 一处占位，杜绝"同一件事看两遍"。 */
    var readyItems = randItems.filter(function (o) { return o.ready; })
      .concat(growthItems.filter(function (o) { return o.ready; }));
    var readyBlock = readyItems.length
      ? '<div class="q-sec q-sec-ready"><span class="q-sec-t">✅ 可领取奖励</span>'
        + '<span class="q-sec-n">' + readyItems.length + ' 项</span></div>'
        + '<div class="q-list">' + readyItems.map(readyRowHtml).join('') + '</div>'
      : '';

    /* ④ 随机任务（剩余 · 未达标） */
    var randWait = randItems.filter(notReady);
    var randRows = randWait.map(rowHtml).join('') || (randItems.length
      ? '<div class="q-empty">本批 ' + randItems.length + ' 项均已可领取 —— 见上方「可领取奖励」。</div>'
      : '<div class="q-empty">今日随机任务已全部完成，明日再来。</div>');

    /* ⑤ 成长任务（剩余 · 未达标 · 分页） */
    var growthWait = growthItems.filter(notReady);
    var gp = ui.pageOf('growth', growthWait.length, 10);
    var growthRows = growthWait.slice(gp.from, gp.to).map(rowHtml).join('') || (undone.length
      ? '<div class="q-empty">进行中的任务均已可领取 —— 见上方「可领取奖励」。</div>'
      : '<div class="q-empty">成长任务已全部完成 —— 功业已成。</div>');

    /* ⑥ 已完成（折叠 · 分页） */
    var log = s.quests.log || [];
    var doneRows = (DATA.QUESTS || []).filter(function (q) { return GAME.questDone(q); })
      .map(function (q) { return { title: q.title, kind: '成长', cls: 't-growth', right: GAME.rewardString(q.reward) }; })
      .concat(log.filter(function (x) { return x.kind === 'random'; })
        .map(function (x) { return { title: x.title, kind: '随机', cls: '', right: ui.timeAgo(x.t) }; }));
    var dp = ui.pageOf('done', doneRows.length, 14);
    var doneList = doneRows.slice(dp.from, dp.to).map(function (r) {
      return '<div class="q-log-row"><span class="q-log-t">' + U.escape(r.title) + '</span>' +
        '<span class="q-tag ' + r.cls + '">' + r.kind + '</span><span class="q-log-r dim">' + r.right + '</span></div>';
    }).join('');

    return '<div class="ui-page">' +
      '<div class="gold-heading">📜 任务' +
        ui.help('点任务名称查看详情（背景 / 需求 / 奖励 / 放弃）\\n已完成的任务自动置顶，点右侧「领取」直接领奖\\n随机任务每日 5 项，同时在手上限 ' + cap + ' 项') +
        '<span style="font-size:var(--fs-body);color:var(--text-dim);font-weight:400;">　可领取 ' + sum.ready + ' 项</span>' +
      '</div>' +

      /* v69：可领取块在最顶 —— 有奖可领优先于历史记录 */
      readyBlock +

      /* 区块顺序沿用 v16 #9 定下的「已完成 → 随机 → 成长」（v69 起可领取块置其前），
         只是把每项从"卡片墙"压成一行名称（详情进弹窗）。 */
      '<div class="q-sec"><span class="q-sec-t">已完成</span>' +
        '<span class="q-sec-n">共 ' + doneRows.length + ' 项</span>' +
        '<button class="btn sm" data-action="toggle-done-quests" style="margin-left:auto;">' + (ui._showDone ? '收起' : '展开') + '</button></div>' +
      (ui._showDone
        ? '<div class="q-done-box">' + (doneList || '<div class="q-empty">尚无已完成任务。</div>') + '</div>' + ui.pagerHTML('done', doneRows.length, 14)
        : '') +

      '<div class="q-sec" style="margin-top:16px;"><span class="q-sec-t">随机任务</span>' +
        '<span class="q-sec-n">待完成 ' + randWait.length + ' 项 · 当前 ' + pool.length + ' / ' + cap + ' 项</span>' +
        '<button class="btn sm" data-action="reroll-all-rand" style="margin-left:auto;">全部换新（' + U.fmt(GAME.randQuestRerollAllCost()) + '金）</button></div>' +
      '<div class="q-list">' + randRows + '</div>' +

      '<div class="q-sec" style="margin-top:16px;"><span class="q-sec-t">成长任务 · 进行中</span>' +
        '<span class="q-sec-n">' + growthWait.length + ' 项待完成 / 共 ' + (DATA.QUESTS || []).length + ' 项</span></div>' +
      '<div class="q-list">' + growthRows + '</div>' + ui.pagerHTML('growth', growthWait.length, 10) +
      '</div>';
  };
"""

CSS_OLD = '  .q-row-p b { color: var(--green-ok); }\n'
CSS_NEW = ('  .q-row-p b { color: var(--green-ok); }\n'
           '  /* v69（老板「右侧直接添加领取按钮」）：可领取行 —— 按钮推到最右，一步领取 */\n'
           '  .q-sec-ready .q-sec-t { color: var(--green-ok); }\n'
           '  .q-row-act { margin-left: auto; display: inline-flex; align-items: center; }\n')

SMOKE_ANCHOR = "  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');\n"

SMOKE_SEC = """  console.log('\\n--- 第 57 节：可领取任务置顶 + 行内一键领取（v69） ---');
  (function () {
    var fs57 = function (f) { return require('fs').readFileSync(require('path').join(__dirname, 'js', f + '.js'), 'utf8'); };
    var u57 = stripComment(fs57('ui'));
    var m57 = stripComment(fs57('main'));
    var h57 = require('fs').readFileSync(require('path').join(__dirname, 'index.html'), 'utf8');

    withState('任务置顶', function (st) {
      G.ensureDailyQuests(true);
      var pool = st.quests.pool;

      /* 夹具：找一条非绝对值的随机任务（可用 base 打桩达标） */
      var rq = null, rdef = null;
      for (var i = 0; i < pool.length; i++) {
        var d = G.randomQuestDef(pool[i].id);
        if (d && !d.abs) { rq = pool[i]; rdef = d; break; }
      }
      check('夹具就绪：手上有一条非绝对值随机任务', !!rq, pool.length + ' 项在手');

      /* 指标打桩：g01 民房 3 座（恰好达标）；g02 民房 6 座（未达标）；该随机任务恰好达标 */
      var real = G.questMetric;
      G.questMetric = function (m, sub) {
        if (m === 'bldCount' && sub === 'minfang') return 3;
        if (rdef && m === rdef.metric && (rdef.sub == null || sub === rdef.sub)) return rdef.goal + (rq.base || 0);
        return 0;
      };
      try {
        var html = G.ui.tasksHTML();
        var iReady = html.indexOf('✅ 可领取奖励');
        var iDone = html.indexOf('已完成</span>');
        var iRand = html.indexOf('随机任务</span>');
        var iGrowth = html.indexOf('成长任务 · 进行中');

        check('★ 达标任务自动置顶（可领取块在「已完成」与各区块之上）',
          iReady > 0 && iReady < iDone && iDone < iRand && iRand < iGrowth,
          'ready@' + iReady + ' / done@' + iDone + ' / rand@' + iRand + ' / growth@' + iGrowth);

        check('★ 顶块装的是达标项（g01 立锥之地 + 随机 ' + (rdef ? rdef.title : '—') + '）', (function () {
          var blk = html.slice(iReady, iDone);
          return blk.indexOf('立锥之地') >= 0 && (!rdef || blk.indexOf(rdef.title) >= 0)
            && blk.indexOf('data-action="quest-detail"') >= 0;
        })());

        check('★ 顶块每行右侧都有「领取」按钮（按 kind 分派两个既有 action）',
          html.indexOf('data-action="claim-quest" data-q="g01"') >= 0
          && (!rq || html.indexOf('data-action="claim-rand-quest" data-q="' + rq.id + '"') >= 0)
          && /<span class="q-row-act"><button class="btn gold sm"/.test(html));

        check('★ 浮上去的项不再在原区块重复出现（一处占位）',
          (html.match(/data-id="g01"/g) || []).length === 1
          && (!rq || (html.match(new RegExp('data-id="' + rq.id + '"', 'g')) || []).length === 1));

        check('未达标项不带领取按钮（g02 民居渐稠 无 data-q）',
          html.indexOf('民居渐稠') >= 0 && html.indexOf('data-q="g02"') < 0);

        check('顶块按钮数 == 汇总口径（单一口径，防两处算法漂移）', (function () {
          var n = (html.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length;
          return n === G.questSummary().ready;
        })(), (html.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length + ' 按钮 / 汇总 ' + G.questSummary().ready + ' 项');

        /* ---- 真领取：走业务函数（与按钮同一条链） ---- */
        var r1 = rq ? G.claimRandomQuest(rq.id) : { ok: false };
        check('★ 领取随机任务（离池 + 入流水）',
          r1.ok === true
          && !G.state.quests.pool.some(function (e) { return e.id === rq.id; })
          && !!(G.state.quests.log[0] && G.state.quests.log[0].id === rq.id));

        var r2 = G.claimQuest('g01');
        check('★ 领取成长任务（标记已领取）', r2.ok === true && !!G.state.quests.done.g01);

        var html2 = G.ui.tasksHTML();
        check('★ 领取后自动从顶块与列表消失',
          html2.indexOf('data-q="g01"') < 0
          && html2.indexOf('data-kind="growth" data-id="g01"') < 0
          && (!rq || (html2.indexOf('data-q="' + rq.id + '"') < 0
            && html2.indexOf('data-kind="random" data-id="' + rq.id + '"') < 0)));

        /* ---- 全部达标：原区块不重复渲染、空态指路顶块 ---- */
        G.questMetric = function () { return 1e9; };
        var html3 = G.ui.tasksHTML();
        check('★ 全部达标时：原区块不重复行、空态指向顶块', (function () {
          var n = (html3.match(/data-action="claim-(?:rand-)?quest" data-q=/g) || []).length;
          return /本批 \\d+ 项均已可领取/.test(html3)
            && html3.indexOf('进行中的任务均已可领取') >= 0
            && n === G.questSummary().ready;
        })());

        G.questMetric = function () { return 0; };
        var html4 = G.ui.tasksHTML();
        check('★ 无可领取时顶块整块隐藏（不留空壳）',
          html4.indexOf('✅ 可领取奖励') < 0 && html4.indexOf('data-q=') < 0);
      } finally {
        G.questMetric = real;
      }

      /* ---- 源码层守卫 ---- */
      check('顶块由唯一出口产出（readyItems 一处拼接：随机在前、成长在后）',
        /var readyItems = randItems\\.filter\\(function \\(o\\) \\{ return o\\.ready; \\}\\)[\\s\\S]{0,80}\\.concat\\(growthItems\\.filter/.test(u57));

      check('行内按钮复用既有 action（不新造；main.js 两个 case 都在）',
        /o\\.kind === 'random' \\? 'claim-rand-quest' : 'claim-quest'/.test(u57)
        && /case 'claim-rand-quest'/.test(m57) && /case 'claim-quest'/.test(m57));

      check('CSS：按钮右推 + 置顶标题着色',
        /\\.q-row-act \\{[^}]*margin-left: auto/.test(h57) && /\\.q-sec-ready \\.q-sec-t/.test(h57));

      check('帮助文案同步（置顶 + 直接领取入说明）',
        /已完成的任务自动置顶/.test(u57) && /同时在手上限/.test(u57));
    });
  })();

"""

E2E_ANCHOR = "  /* ⑦ 消息流（v16：已整合进公文，且写入存档） */"

E2E_SEC = """  /* ⑥.5 可领取任务置顶 + 行内一键领取（v69 老板） */
  {
    let rq57 = null, rdef57 = null;
    for (const e57 of G.state.quests.pool) {
      const d57 = G.randomQuestDef(e57.id);
      if (d57 && !d57.abs) { rq57 = e57; rdef57 = d57; break; }
    }
    check('夹具：手上有一条可打桩的随机任务', !!rq57, rq57 ? rq57.id : '（无）');
    if (rq57) {
      rq57.base = -1e9;                       /* 直接达标（base 只对增量型有意义） */
      G.ui.setView('tasks');
      await sleep(90);
      const btn57 = vc.querySelector('.q-sec-ready + .q-list [data-action="claim-rand-quest"]');
      check('★ 达标任务浮到顶块，右侧带「领取」按钮',
        !!btn57 && btn57.getAttribute('data-q') === rq57.id && btn57.textContent.indexOf('领取') >= 0);
      if (btn57) {
        const before57 = G.state.quests.pool.length;
        const gold57 = G.state.res.gold;
        click(btn57);
        await sleep(160);
        check('★ 点「领取」一步到位（不弹详情窗）',
          document.querySelector('#modal-root').innerHTML.indexOf('任务背景') < 0);
        check('★ 领取生效：离池 + 记流水 + 发奖',
          G.state.quests.pool.length === before57 - 1
          && G.state.quests.log.some((x) => x.id === rq57.id)
          && G.state.res.gold >= gold57 + (rdef57.reward.gold || 0));
        check('★ 领取后按钮随之消失（列表已刷新）',
          !vc.querySelector('[data-action="claim-rand-quest"][data-q="' + rq57.id + '"]'));
      }
    }
  }

"""

SPEC_SEC = """## 12. 任务列表规范（v69）

> 由来：老板 2026-09-14「已完成的任务自动浮动到最上方，右侧直接添加领取按钮」。

### 12.1 区块顺序（固定）

```
✅ 可领取奖励 → 已完成 → 随机任务 → 成长任务 · 进行中
```

- 「可领取奖励」块**自动出现 / 自动消失**：无可领取任务时整块隐藏（不留空壳）。
- 达标任务从原区块**浮**到顶块 —— **一处占位**：浮上去的项不再在原区块重复出现。

### 12.2 行内领取

- 顶块行右侧直接挂「领取」按钮（`btn gold sm`）—— **一步领取**，不必再进详情窗。
- 行本身仍可点（`data-action="quest-detail"`）：想看背景 / 需求 / 奖励明细照旧。
- 按钮**复用既有 action**：随机 → `claim-rand-quest`、成长 → `claim-quest`（不新造出口）。
- 非达标行**不带**领取按钮（避免误导），右侧仍显示 `当前 / 目标` 进度。

### 12.3 计数与空态

- 各区块的计数**只算本区块实际渲染的项**（浮上去的不重复计入）。
- 空态文案必须**指路**：`本批 N 项均已可领取 —— 见上方「可领取奖励」`。
"""

MEMO_ANCHOR = '<!-- migrated:v46-pitfall-verify -->'

MEMO_BULLET = """- **任务列表：可领取的自动置顶，右侧一键领取**（v69 老板："已完成的任务自动浮动到最上方，
  右侧直接添加领取按钮"）。达标项从原区块浮到顶部「✅ 可领取奖励」块（**一处占位**：原区块
  不再重复出现），行右侧挂 `btn gold sm`「领取」按钮，复用既有 action
  （`claim-quest` / `claim-rand-quest`）不新造；行本身仍可点开详情。区块顺序固定
  **可领取 → 已完成 → 随机 → 成长**，无可领取时整块隐藏。规范见 `设计规范.md` §12。

"""


def main():
    fails = []

    # ---------- ① ui.js ----------
    ui = read(UI)
    if '✅ 可领取奖励' in ui:
        print('· ui.js：已改过（幂等跳过）')
    else:
        i, j = ui.find(START), ui.find(END)
        if i < 0 or j < 0 or j < i:
            print('!! ui.js：锚点定位失败（start %d / end %d）' % (i, j))
            fails.append('ui')
        elif ui.count(START) != 1 or ui.count(END) != 1:
            print('!! ui.js：锚点不唯一（start %d 次 / end %d 次）'
                  % (ui.count(START), ui.count(END)))
            fails.append('ui')
        elif re.search(r'\bnotReady\b', ui):
            print('!! ui.js：notReady 标识符已被占用，拒绝写盘')
            fails.append('ui')
        else:
            seg = ui[i:j]
            for must in ['var rowHtml', 'q-row-p', 'toggle-done-quests', 'reroll-all-rand']:
                assert must in seg, must
            new = ui[:i] + NEW_TASKS + '\n' + ui[j:]
            if save_lf(UI, new, 'ui.js'):
                print('  ✓ ui.js：tasksHTML 重构（%d → %d 字节）' % (len(ui), len(new)))
            else:
                fails.append('ui')

    # ---------- ② index.html CSS ----------
    html = read(HTML)
    if '.q-row-act' in html:
        print('· index.html：已改过（幂等跳过）')
    else:
        if html.count(CSS_OLD) != 1:
            print('!! index.html：CSS 锚点 %d 次命中，拒绝写盘' % html.count(CSS_OLD))
            fails.append('html')
        else:
            new = html.replace(CSS_OLD, CSS_NEW, 1)
            if save_lf(HTML, new, 'index.html'):
                print('  ✓ index.html：+2 条 CSS（.q-sec-ready / .q-row-act）')
            else:
                fails.append('html')

    # ---------- ③ smoke-test.js ----------
    sm = read(SMOKE)
    if '第 57 节：可领取任务置顶' in sm:
        print('· smoke：已改过（幂等跳过）')
    else:
        if sm.count(SMOKE_ANCHOR) != 1:
            print('!! smoke：结果行锚点 %d 次命中，拒绝写盘' % sm.count(SMOKE_ANCHOR))
            fails.append('smoke')
        else:
            new = sm.replace(SMOKE_ANCHOR, SMOKE_SEC + SMOKE_ANCHOR, 1)
            if save_lf(SMOKE, new, 'smoke'):
                print('  ✓ smoke-test.js：追加第 57 节（%d 字节）' % len(SMOKE_SEC))
            else:
                fails.append('smoke')

    # ---------- ④ e2e-test.js ----------
    e2 = read(E2E)
    if '可领取任务置顶 + 行内一键领取' in e2:
        print('· e2e：已改过（幂等跳过）')
    else:
        if e2.count(E2E_ANCHOR) != 1:
            print('!! e2e：锚点 %d 次命中，拒绝写盘' % e2.count(E2E_ANCHOR))
            fails.append('e2e')
        else:
            new = e2.replace(E2E_ANCHOR, E2E_SEC + E2E_ANCHOR, 1)
            if save_lf(E2E, new, 'e2e'):
                print('  ✓ e2e-test.js：追加 ⑥.5 领取动线')
            else:
                fails.append('e2e')

    # ---------- ⑤ docs/设计规范.md（CRLF！） ----------
    spec = read(SPEC)
    if '## 12. 任务列表规范' in spec:
        print('· 设计规范：已改过（幂等跳过）')
    else:
        add = SPEC_SEC
        if not spec.endswith('\n'):
            add = '\r\n' + add
        add = add.replace('\r\n', '\n').replace('\n', '\r\n')
        old_crlf = spec.count('\r\n')
        new = spec + add
        io.open(SPEC, 'w', encoding='utf-8', newline='').write(new)
        back = io.open(SPEC, 'rb').read().decode('utf-8')
        if '## 12. 任务列表规范' in back and back.count('\r\n') > old_crlf:
            print('  ✓ 设计规范.md：追加 §12（CRLF 保持，%d → %d 行）'
                  % (old_crlf, back.count('\r\n')))
        else:
            print('!! 设计规范.md：落盘核验失败')
            fails.append('spec')

    # ---------- ⑥ docs/AI工作备忘.md ----------
    memo = read(MEMO)
    if '任务列表：可领取的自动置顶' in memo:
        print('· AI工作备忘：已改过（幂等跳过）')
    else:
        if memo.count(MEMO_ANCHOR) != 1:
            print('!! AI工作备忘：锚点 %d 次命中，拒绝写盘' % memo.count(MEMO_ANCHOR))
            fails.append('memo')
        else:
            new = memo.replace(MEMO_ANCHOR, MEMO_BULLET + MEMO_ANCHOR, 1)
            if save_lf(MEMO, new, 'memo'):
                print('  ✓ AI工作备忘.md：§八 追加一条界面约定')
            else:
                fails.append('memo')

    print('')
    if fails:
        print('✗ 未完成：' + ', '.join(fails))
        return 1
    print('✓ 全部完成')
    return 0


if __name__ == '__main__':
    sys.exit(main())

# -*- coding: utf-8 -*-
# v89.157 补丁 J：e2e-test.js —— 无相克断言升级 + 新增 §157 用例（逐回合弹窗 / station / 徽章）
import io
P = 'E:/Deepseekdb/e2e-test.js'

def rd():
    return io.open(P, encoding='utf-8', newline='').read()

def rep(tag, old, new, marks=()):
    s = rd()
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
        print(tag + ' OK')
        return True
    for mk in marks:
        if mk in s:
            print(tag + ' skip（已落盘）')
            return False
    raise AssertionError(tag + ' anchor missing')

# ---------- ① 无相克：不再要求有克制行 ----------
rep('J1',
    u"""          /* 克制行的三种分支都要接受：绿（克制/抗性）/ 红（被克）/ 无相克 ——
             ⚠️ 这支部队（义兵）本身无相克，写死 cnt-good 会误伤 */
          && (/cnt-good|cnt-bad|无相克/.test(nmTip149.innerHTML || ''))""",
    u"""          /* v89.157（老板「无相克不显示」）：零相克兵种（本用例的义兵）**没有**克制行；
             有克制行时必须带 cnt-good / cnt-bad 类（旧的"无相克"占位行已退役）。 */
          && (!/cnt-/.test(nmTip149.innerHTML || '')
            || /cnt-(good|bad)/.test(nmTip149.innerHTML || ''))""",
    [u'旧的"无相克"占位行已退役'])

# ---------- ② 新增 §157 用例（插在 return finish(); 之前） ----------
BLOCK = u"""
  /* ============================================================
   * v89.157（老板：逐回合文字复盘 / 己方野地驻守 / 公文徽章）
   * ============================================================ */
  await (async function () {
    const s = G.state;

    /* ---- ① 逐回合文字复盘：战报页入口 → 独立弹窗（一回合一行） ---- */
    const bkReps157 = s.reports.slice();
    try {
      s.reports.unshift({
        t: Date.now(), title: '§157 测试战报', win: true, type: 'war', fav: false,
        body: '【许都】攻城胜利', engine: 'tactic', rounds: 2, winner: 'atk',
        roundsLog: [
          { r: 1, a: 100, d: 80, events: [{ kind: 'attack', side: 'atk', id: 0, name: '长枪兵', target: '弓兵', kill: 5 }] },
          { r: 2, a: 95, d: 70, events: [] }
        ]
      });
      G.ui.closeAllModals();
      G.ui.viewReportText(GAME.repRidOf(s.reports[0]));
      await sleep(160);
      const btn157 = document.querySelector('#modal-root [data-action="report-rounds"]');
      check('§157：战报正文页出「逐回合文字复盘」入口（有回合记录才给）', !!btn157,
        btn157 ? (btn157.textContent || '').slice(0, 24) : '无按钮');
      if (btn157) {
        btn157.click();
        await sleep(220);
        const rounds157 = document.querySelectorAll('#modal-root .rt-round');
        const box157 = document.querySelector('#modal-root .rt-rounds');
        const txt157 = box157 ? (box157.textContent || '') : '';
        check('§157：逐回合弹窗（一回合一行 · 首行含第1回合与交火事件 · 空回合写无交火）',
          rounds157.length === 2 && txt157.indexOf('第1回合') >= 0
          && txt157.indexOf('长枪兵→弓兵 杀 5') >= 0 && txt157.indexOf('（无交火）') >= 0,
          'rounds=' + rounds157.length + ' txt=' + txt157.slice(0, 80));
      }
    } finally {
      s.reports = bkReps157;
      G.ui.closeAllModals();
    }

    /* ---- ② 己方野地驻守：不接战 → 接战三块隐（真 DOM 渲染） ---- */
    const keepW157 = s.wilds;
    const keepM157 = { mode: G.ui._expMode, t: G.ui._expTarget, r: G.ui._expRes };
    try {
      const c157 = G.currentCity();
      const px157 = c157.x + 4, py157 = c157.y + 4;
      s.wilds = (s.wilds || []).filter(function (z) { return !(z.x === px157 && z.y === py157); });
      s.wilds.push({ x: px157, y: py157, type: 'lake', level: 2, day: 0, startDay: 0 });
      G.ui.closeAllModals();
      G.ui.openExpModal({ kind: 'wild', x: px157, y: py157 });
      await sleep(180);
      const html157 = document.getElementById('modal-root').innerHTML;
      check('§157：己方野地驻守面板隐接战三块（保留 出征方式 / 可用道具 / 无预估）',
        html157.indexOf('exp-a-tactic') < 0 && html157.indexOf('exp-a-plan') < 0
        && html157.indexOf('exp-a-tacmenu') < 0 && html157.indexOf('exp-a-est') < 0
        && html157.indexOf('exp-a-modes') >= 0 && html157.indexOf('exp-a-items') >= 0,
        'tactic=' + html157.indexOf('exp-a-tactic') + ' modes=' + html157.indexOf('exp-a-modes'));
    } finally {
      s.wilds = keepW157;
      G.ui._expMode = keepM157.mode; G.ui._expTarget = keepM157.t; G.ui._expRes = keepM157.r;
      G.ui.closeAllModals();
    }

    /* ---- ③ 公文系统页：消息徽章 + 左侧主题色竖条（真实 DOM） ---- */
    try {
      GAME.log('§157 徽章显示', 'sys', 'build');
      G.ui._docTab = 'sys';
      G.ui.setView('reports');
      G.ui.renderView('reports');
      await sleep(200);
      const line157 = document.querySelector('#msg-feed .bb-line');
      const tag157 = line157 ? line157.querySelector('.ml-tag') : null;
      const st157 = line157 ? (line157.getAttribute('style') || '') : '';
      check('§157：系统页消息 = 主题徽章 + 主题色竖条（bb-sub · 行内注入颜色）',
        !!tag157 && !!line157 && line157.classList.contains('bb-sub')
        && st157.indexOf('border-left-color') >= 0
        && (tag157.textContent || '').indexOf('建造') >= 0,
        tag157 ? ('tag=' + tag157.textContent + ' style=' + st157.slice(0, 40)) : '无徽章');
    } finally {
      G.ui._docTab = 'sys';
      G.ui.closeAllModals();
    }
  })();

  return finish();
"""

rep('J2-block',
    u"""  return finish();
}""",
    BLOCK + u"""}""",
    [u'§157：逐回合弹窗'])

print('J 段完成')

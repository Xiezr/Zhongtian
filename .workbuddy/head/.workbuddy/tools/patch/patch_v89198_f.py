# -*- coding: utf-8 -*-
"""v89.198 批次F：e2e-test.js —— §197 升级 + 新增 §198（真 DOM）"""

import io

def rd(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag + '（已落盘）')
        return
    c = s.count(old)
    assert c == 1, '[FAIL] ' + tag + ' count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

E = 'E:/Deepseekdb/e2e-test.js'

rep(E, 'F1 备份变量去 _expOps',
"""    const _bkGen197 = G.ui._expGen, _bkOps197 = G.ui._expOps;""",
"""    const _bkGen197 = G.ui._expGen;""",
    'const _bkGen197 = G.ui._expGen;')

rep(E, 'F2 §197① 名称列断言升级',
"""      /* ① 统一行：7 个下拉行 + 战法行（名称列 .exp-lab 齐备） */
      const rows197 = panel197.querySelectorAll('.exp-row');
      const labs197 = Array.prototype.map.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim());
      check('§197① 出征面板统一行：7 下拉行 + 战法行（8 个名称列齐备）',
        rows197.length >= 7
        && labs197.indexOf('目标') >= 0 && labs197.indexOf('主将') >= 0
        && labs197.indexOf('计略') >= 0 && labs197.indexOf('出征方式') >= 0
        && labs197.indexOf('战法') >= 0 && labs197.indexOf('方案') >= 0
        && labs197.indexOf('出征战术') >= 0 && labs197.indexOf('可用道具') >= 0,
        'rows=' + rows197.length + ' labs=' + labs197.join(','));""",
"""      /* ① 统一行：7 个名称列（v89.198：战法行已随「清除战法这个玩法」全撤） */
      const rows197 = panel197.querySelectorAll('.exp-row');
      const labs197 = Array.prototype.map.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim());
      check('§197① 出征面板统一行：7 个名称列齐备（战法行已全撤）',
        rows197.length >= 7
        && labs197.indexOf('目标') >= 0 && labs197.indexOf('主将') >= 0
        && labs197.indexOf('计略') >= 0 && labs197.indexOf('出征方式') >= 0
        && labs197.indexOf('战法') < 0 && labs197.indexOf('方案') >= 0
        && labs197.indexOf('出征战术') >= 0 && labs197.indexOf('可用道具') >= 0,
        'rows=' + rows197.length + ' labs=' + labs197.join(','));""",
    '7 个名称列齐备（战法行已全撤）')

rep(E, 'F3 §197② chips 断言升级',
"""      /* ② 战法 chips：3 个 + 默认选中「强攻」on 高亮（旧裸文本 bug 的守护） */
      const chips197 = panel197.querySelectorAll('#exp-ops .chip');
      const on197 = panel197.querySelectorAll('#exp-ops .chip.on');
      check('§197② 战法 chips 标准组件：3 chip + 默认「强攻」on 高亮',
        chips197.length === 3 && on197.length === 1 && on197[0].textContent.indexOf('强攻') >= 0,
        'chips=' + chips197.length + ' on=' + on197.length);""",
"""      /* ②（v89.198 全撤）：战法 chips 退役 —— #exp-ops 零残留 */
      check('§197②（v89.198 全撤）战法 chips 退役：#exp-ops / .exp-ops-cell 零残留',
        panel197.querySelectorAll('#exp-ops').length === 0
        && panel197.querySelectorAll('.exp-ops-cell').length === 0,
        'opsEl=' + panel197.querySelectorAll('#exp-ops').length);""",
    '战法 chips 退役：#exp-ops / .exp-ops-cell 零残留')

rep(E, 'F4 §197③ tip-src 计数升级',
"""      /* ③ 备注悬停源（.tip-src）在册：计略说明 + 战法说明 + 方案说明 ≥ 3 */
      const srcs197 = panel197.querySelectorAll('.exp-row .tip-src');
      check('§197③ 备注悬停源：.tip-src 在册（计略/战法/方案说明 ≥3）',
        srcs197.length >= 3, 'srcs=' + srcs197.length);""",
"""      /* ③ 备注悬停源（.tip-src）在册：计略说明 + 方案说明 ≥2（战法说明随全撤） */
      const srcs197 = panel197.querySelectorAll('.exp-row .tip-src');
      check('§197③ 备注悬停源：.tip-src 在册（计略/方案说明 ≥2）',
        srcs197.length >= 2, 'srcs=' + srcs197.length);""",
    '.tip-src 在册（计略/方案说明 ≥2）')

rep(E, 'F5 §197④ 悬停改方案行',
"""      /* ④ 悬停浮层联通：mouseover 战法名称 → #tip-layer 打开并含强攻 desc */
      const labOps = Array.prototype.find.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim() === '战法');
      const rowOps = labOps ? labOps.closest('.exp-row') : null;
      if (rowOps) {
        rowOps.dispatchEvent(new window.MouseEvent('mouseover',
          { bubbles: true, cancelable: true, view: window }));
        await sleep(50);
        const tipL197 = document.querySelector('#tip-layer');
        check('§197④ 悬停浮层：战法说明经 #tip-layer 显示（统一规格）',
          !!tipL197 && tipL197.classList.contains('on')
          && tipL197.textContent.indexOf('正面决战') >= 0,
          (tipL197 && tipL197.textContent || '').slice(0, 60));
      } else {
        check('§197④ 悬停浮层：战法说明经 #tip-layer 显示（统一规格）', false, '未找到战法行');
      }""",
"""      /* ④ 悬停浮层联通：mouseover 方案名称 → #tip-layer 打开并含方案说明（v89.198：原战法行已撤） */
      const labPlan = Array.prototype.find.call(panel197.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim() === '方案');
      const rowPlan = labPlan ? labPlan.closest('.exp-row') : null;
      if (rowPlan) {
        rowPlan.dispatchEvent(new window.MouseEvent('mouseover',
          { bubbles: true, cancelable: true, view: window }));
        await sleep(50);
        const tipL197 = document.querySelector('#tip-layer');
        check('§197④ 悬停浮层：方案说明经 #tip-layer 显示（统一规格）',
          !!tipL197 && tipL197.classList.contains('on')
          && tipL197.textContent.indexOf('套用方案即按其配好兵力与战术') >= 0,
          (tipL197 && tipL197.textContent || '').slice(0, 60));
      } else {
        check('§197④ 悬停浮层：方案说明经 #tip-layer 显示（统一规格）', false, '未找到方案行');
      }""",
    '方案说明经 #tip-layer 显示（统一规格）')

rep(E, 'F6 finally 去 _expOps 还原',
"""      G.ui._expGen = _bkGen197; G.ui._expOps = _bkOps197;""",
"""      G.ui._expGen = _bkGen197;""",
    'G.ui._expGen = _bkGen197;\n    }')

# ---- 新增 §198 e2e 段 ----
SEC = """  /* ============================================================
   * §198（v89.198）：战法全撤 · 管理弹窗统一行 · 出征备注四项（真 DOM）
   * ============================================================ */
  console.log('\\n===== 198. v89.198（战法全撤 · 管理弹窗 · 备注四项） =====');
  {
    const c198 = G.state.cities[0];
    const _bkGen198 = G.ui._expGen;
    try {
      c198.army = c198.army || {};
      if (!Object.keys(c198.army).length) c198.army = { yibing: 500 };
      if (!(G.state.generals || []).length) {
        G.state.generals.push(G.makeGeneral('测198', 40, 'idle', c198.id, false));
      }
      G.ui._cityId = c198.id;
      G.ui.openExpModal({ kind: 'wild', x: c198.x + 3, y: c198.y + 3 });
      await sleep(140);
      const panel198 = document.querySelector('#modal-root .inner-panel') || document.body;

      /* ① 备注四项（真渲染） */
      const vital198 = panel198.querySelector('#exp-gen-vital');
      const tgtSec198 = panel198.querySelector('.exp-a-target');
      const genSec198 = panel198.querySelector('.exp-a-gen');
      check('§198① 出征面板：精力/体力行在主将区 · 相称建议在目标区 · 无锦囊计数 · 无战法行/阵位行',
        !!vital198 && /精力/.test(vital198.textContent) && /体力/.test(vital198.textContent)
        && !!genSec198 && genSec198.contains(vital198)
        && !!tgtSec198 && /相称建议/.test(tgtSec198.textContent)
        && (panel198.textContent || '').indexOf('锦囊 ×') < 0
        && panel198.querySelectorAll('#exp-ops').length === 0
        && (panel198.textContent || '').indexOf('阵位 ') < 0,
        'vital=' + (vital198 ? vital198.textContent.trim() : 'null'));

      /* ② 管理弹窗统一行（真渲染） */
      G.ui.openAutoMarch();
      await sleep(160);
      const panelAM198 = document.querySelector('#modal-root .inner-panel') || document.body;
      const labsAM198 = Array.prototype.map.call(panelAM198.querySelectorAll('.exp-lab'),
        (x) => x.textContent.trim());
      check('§198② 管理弹窗（自动出征·详细配置）：统一行 9 个名称列 · 阵位行零残留',
        labsAM198.indexOf('执行将领') >= 0 && labsAM198.indexOf('目标类型') >= 0
        && labsAM198.indexOf('目标等级') >= 0 && labsAM198.indexOf('搜索距离') >= 0
        && labsAM198.indexOf('出征方式') >= 0 && labsAM198.indexOf('计略') >= 0
        && labsAM198.indexOf('出征战术') >= 0 && labsAM198.indexOf('出征频率') >= 0
        && labsAM198.indexOf('每日上限') >= 0
        && (panelAM198.textContent || '').indexOf('阵位 ') < 0,
        'labs=' + labsAM198.join(','));
    } finally {
      try { G.ui.closeAllModals(); } catch (e) { }
      G.ui._expGen = _bkGen198;
    }
  }
"""

s = rd(E)
mark = '§198① 出征面板'
if mark in s:
    print('[skip] §198 e2e 段（已落盘）')
else:
    anchor = u"\n\n  return finish();"
    c = s.count(anchor)
    assert c == 1, '[FAIL] §198 e2e anchor count=' + str(c)
    s = s.replace(anchor, u"\n" + SEC.rstrip('\n') + anchor)
    wr(E, s)
    print('[ok] §198 e2e 段插入')

print('批次F 完成')

# -*- coding: utf-8 -*-
"""v89 e2e（e2e-test.js）：v88.1/v88 段剧本化改造 + v89 新段（君主专属 + 全屏交互）。探针幂等。"""
import io

P = r'E:\Deepseekdb\e2e-test.js'
d = io.open(P, encoding='utf-8', newline='').read()
NL = '\r\n' if '\r\n' in d[:4000] else '\n'

def sub(old, new, tag, probe):
    global d
    if probe in d:
        print('SKIP ' + tag)
        return
    c = d.count(old)
    assert c == 1, tag + ' 锚点命中 %d 次' % c
    d = d.replace(old, new, 1)
    print('OK ' + tag)

# ---- 1) v88.1：点击 → 全屏剧本全流程 ----
sub(r"""    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="hill_scene"]'));
    await sleep(300);
    check('v88.1：执行「绿林探访」原地回显（今日已做）', (function () {
      const root = document.querySelector('#modal-root');
      return !!root && root.textContent.indexOf('今日已做') >= 0;
    })());""",
r"""    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="hill_scene"]'));
    await sleep(260);
    check('v88.1/v89：「绿林探访」进入全屏剧本（第 1 幕 + 选择项 + 退出钮）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none'
        && el.textContent.indexOf('绿林探访') >= 0
        && el.querySelectorAll('[data-action="sxf-choice"]').length >= 2
        && !!el.querySelector('[data-action="sxf-escape"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(200);
    check('v88.1/v89：终幕结算屏（专属退出按钮出现）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v88.1：剧本收尾 → 回野地弹窗原地回显（今日已做）', (function () {
      const root = document.querySelector('#modal-root');
      const el = document.getElementById('scene-fx');
      return (!el || el.style.display === 'none') && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());""",
    'E1 v88.1 剧本化', '「绿林探访」进入全屏剧本')

# ---- 2) v88：换君主 ----
sub(r"""    const g88 = G.state.generals[0];""",
r"""    const g88 = G.lordGeneralOf();   /* v89：修炼线君主专属 */""",
    'E2 v88 换君主', 'const g88 = G.lordGeneralOf();')

# ---- 3) v88：xui 点击 → 全屏全流程 ----
sub(r"""    const before88 = G.state.items.lingsui || 0;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="xiu"]'));
    await sleep(300);
    check('v88：执行「修炼」得精华 + 弹窗回显「今日已做」', (function () {
      const root = document.querySelector('#modal-root');
      const gained = (G.state.items.lingsui || 0) - before88;
      return gained > 0 && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());""",
r"""    const before88 = G.state.items.lingsui || 0;
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="xiu"]'));
    await sleep(260);
    check('v88/v89：「修炼」进入全屏剧本', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('修炼') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(200);
    check('v88/v89：结算屏含收获（灵气精华）与专属退出', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.textContent.indexOf('灵气精华') >= 0 && !!el.querySelector('[data-action="sxf-exit"]');
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v88：结算后得精华 + 弹窗回显「今日已做」', (function () {
      const root = document.querySelector('#modal-root');
      const gained = (G.state.items.lingsui || 0) - before88;
      return gained > 0 && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());""",
    'E3 v88 xiu 剧本化', '结算屏含收获（灵气精华）')

# ---- 4) v89 新段 ----
SEC89 = r"""  /* ============================================================
   * v89（老板）：君主专属修炼 + 全屏江湖剧本（真实 DOM）
   * ============================================================ */
  console.log('\n--- v89. 君主专属 + 全屏江湖剧本（真实 DOM） ---');
  {
    const lg89 = G.lordGeneralOf();
    G.state.generals.forEach(function (g) { g.energy = 100; G.setStaNow(g, 100); });

    /* ① 君主有双轨 tab；普通将领没有 + 专属文案 */
    G.ui._genSel = lg89.id;
    G.ui.setView('generals');
    await sleep(220);
    check('v89：君主装备栏有双轨切换（⚔军中 / ☯修炼）', (function () {
      const vc = document.querySelector('#view-container');
      return !!vc.querySelector('[data-action="toggle-equip-set"][data-set="ling"]');
    })());
    /* 注：e2e 尾部主状态可能只剩君主一人（前序测试换过档）——临时补普通将领做负向验证 */
    let ng89 = G.state.generals.filter(g => !g.isLord)[0];
    if (!ng89) {
      ng89 = G.makeGeneral('验士甲', 5, 'idle', G.currentCity().id, false);
      G.state.generals.push(ng89);
    }
    G.ui._genSel = ng89.id;
    G.ui.setView('generals');
    await sleep(220);
    check('v89：普通将领无双轨 tab · 有「君主专属」说明', (function () {
      const vc = document.querySelector('#view-container');
      return !vc.querySelector('[data-action="toggle-equip-set"]')
        && vc.innerHTML.indexOf('君主专属') >= 0;
    })());
    if (ng89.name === '验士甲') G.state.generals = G.state.generals.filter(x => x.id !== ng89.id);

    /* ② 全屏剧本：逃（未动身免费 / 动身后计入） */
    let hp89 = null;
    for (let y = 3; y < 200 && !hp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'hill' && !G.map.fortAt(x, y)) { hp89 = { x, y }; break; }
      }
    }
    G.state.jianghu = {};
    G.ui._jhGen = null;
    G.ui.openLandModal(hp89.x, hp89.y);
    await sleep(200);
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(240);
    check('v89：讨伐进入全屏（对话·事件第 1 幕）· 有「鸣金收兵」', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none'
        && el.textContent.indexOf('斥候') >= 0
        && !!el.querySelector('[data-action="sxf-escape"]');
    })());
    const e089 = lg89.energy;
    click(document.querySelector('#scene-fx [data-action="sxf-escape"]'));
    await sleep(200);
    check('v89：未动身退出 —— 免费（结算屏明示）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.textContent.indexOf('未有任何消耗') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(220);
    check('v89：免费退出后可再入（energy 未扣 · 锁未落）', (function () {
      return lg89.energy === e089 && G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok;
    })());

    /* ③ 动身后退出：所耗不返、今日计入 */
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="tao"]'));
    await sleep(200);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(160);
    check('v89：首次选择即扣精力（15）', lg89.energy === e089 - 15);
    click(document.querySelector('#scene-fx [data-action="sxf-escape"]'));
    await sleep(160);
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(280);
    check('v89：动身后退出 —— 今日计入（不可再入）+ 回弹窗', (function () {
      const root = document.querySelector('#modal-root');
      return !G.jianghuCheck(hp89.x, hp89.y, lg89.id, 'tao').ok
        && !!root && root.textContent.indexOf('今日已做') >= 0;
    })());

    /* ④ 走完一局（地宫探险：全屏 3 幕 → 专属结算 → 收尾） */
    let fp89 = null;
    for (let y = 3; y < 200 && !fp89; y++) {
      for (let x = 3; x < 200; x++) {
        const tl = G.map.tile(x, y);
        if (tl && tl.terrain === 'desert' && !G.map.fortAt(x, y)) { fp89 = { x, y }; break; }
      }
    }
    G.ui.closeModal();
    await sleep(80);
    G.ui.openLandModal(fp89.x, fp89.y);
    await sleep(200);
    click(document.querySelector('#modal-root [data-action="do-jianghu"][data-act="desert_scene"]'));
    await sleep(240);
    check('v89：地宫探险进入全屏（第 1 幕）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && el.style.display !== 'none' && el.textContent.indexOf('地宫') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(120);
    click(document.querySelector('#scene-fx [data-action="sxf-choice"]'));
    await sleep(220);
    check('v89：结算屏出现（专属退出「出宫回城」）', (function () {
      const el = document.getElementById('scene-fx');
      return !!el && !!el.querySelector('[data-action="sxf-exit"]') && el.textContent.indexOf('出宫回城') >= 0;
    })());
    click(document.querySelector('#scene-fx [data-action="sxf-exit"]'));
    await sleep(240);
    G.ui.closeModal();
    await sleep(60);
  }

"""

ANCHOR = r"""  await sleep(30);

  G.ui.setView('city');
  await sleep(60);
  return finish();"""
c = d.count(ANCHOR)
assert c == 1, 'e2e 尾部锚点命中 %d 次' % c
if 'v89. 君主专属 + 全屏江湖剧本' in d:
    print('SKIP v89 段已存在')
else:
    d = d.replace(ANCHOR, SEC89.replace('\n', NL) + ANCHOR, 1)
    print('OK v89 段已写入')

io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('全部完成。')

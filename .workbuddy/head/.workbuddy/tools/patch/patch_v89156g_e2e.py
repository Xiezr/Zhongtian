# -*- coding: utf-8 -*-
# v89.156 patch G：e2e-test.js —— 侦察用例摆前置 + v89.154①组升级（一击执行+层级栈回归）+ 侦察失败真路径
# 分段落盘（每段后立即写，§53.3）。
import io

P = 'E:/Deepseekdb/e2e-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)

def rep(old, new, tag, marks=None):
    global s
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        s = s.replace(old, new)
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print(tag + ' OK')
        return True
    if any(mk in s for mk in (marks or [])):
        print(tag + ' skip（已落盘）')
        return False
    raise AssertionError(tag + ' anchor missing')

# ---------- ① sr27（满级侦查用例）固定随机为成功 ----------
rep(
u"""  g27.stamina = G.staMax(g27);
  g27.energy = 100;
  G.state.world.weather = 'clear';
  const sr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);""",
u"""  g27.stamina = G.staMax(g27);
  g27.energy = 100;
  G.state.world.weather = 'clear';
  /* v89.156（老板 4）：侦察可失败（视双方将领资质/等级差）—— 本组验"分层与面板"，
     摆前置：固定随机为**成功**（失败路径见下方 v89.156④ 真路径用例）。 */
  const _rndBk156a = Math.random;
  Math.random = () => 0.001;
  const sr27 = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
  Math.random = _rndBk156a;""",
'① sr27 摆前置')

# ---------- ② sr27b（技巧 0 级用例）固定随机为成功 ----------
rep(
u"""  G.state.techs['zhencha'] = 0;
  const sr27b = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);""",
u"""  G.state.techs['zhencha'] = 0;
  /* v89.156：同上，固定随机为成功（本用例验"锁定行"，与成败无关） */
  const _rndBk156b = Math.random;
  Math.random = () => 0.001;
  const sr27b = G.battle.expedition({ kind: 'wild', x: probeX, y: probeY }, 'scout', {}, g27.id);
  Math.random = _rndBk156b;""",
'② sr27b 摆前置')

# ---------- ③ 7020 组：上膛 → 一击执行 + 层级栈回归 ----------
rep(
u"""      if (askBtn154) askBtn154.click();
      await sleep(160);
      /* live 重绘的极小竞态兜底：重查一次再点（§65.2：跨操作不持有节点引用） */
      if (document.querySelector('#modal-root').innerHTML.indexOf('wild-abandon-arm') < 0) {
        askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
        if (askBtn154) askBtn154.click();
        await sleep(160);
      }
      const askHtml154 = document.querySelector('#modal-root').innerHTML;
      check('v89.154①：放弃 → 二次确认窗（上膛按钮 + 明写「不可撤销」）',
        askHtml154.indexOf('data-action="wild-abandon-arm"') >= 0 && askHtml154.indexOf('不可撤销') >= 0);
      let armBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
      if (armBtn154) armBtn154.click();
      await sleep(140);
      const armTxt154 = (document.querySelector('#modal-root [data-action="wild-abandon-arm"]') || {}).textContent || '';
      check('v89.154①：第一次点击只「上膛」（文案变「再点一次」· 野地仍在）',
        /再点一次/.test(armTxt154) && !!G.map.wildAt(938, 938), armTxt154.slice(0, 40));
      armBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-arm"]');
      if (armBtn154) armBtn154.click();
      await sleep(200);
      check('v89.154①：第二次点击才执行（野地消失）', !G.map.wildAt(938, 938));
      G.ui.closeAllModals();
      await sleep(60);""",
u"""      if (askBtn154) askBtn154.click();
      await sleep(160);
      /* live 重绘的极小竞态兜底：重查一次再点（§65.2：跨操作不持有节点引用） */
      if (document.querySelector('#modal-root').innerHTML.indexOf('wild-abandon-do') < 0) {
        askBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-ask"]');
        if (askBtn154) askBtn154.click();
        await sleep(160);
      }
      const askHtml154 = document.querySelector('#modal-root').innerHTML;
      check('v89.156①：放弃 → 二次确认窗（一击执行键 + 明写「不可撤销」· 上膛已退役）',
        askHtml154.indexOf('data-action="wild-abandon-do"') >= 0 && askHtml154.indexOf('不可撤销') >= 0
        && askHtml154.indexOf('wild-abandon-arm') < 0);
      const doBtn154 = document.querySelector('#modal-root [data-action="wild-abandon-do"]');
      if (doBtn154) doBtn154.click();
      await sleep(240);
      check('v89.156①：窗内红键**一击执行**（野地消失 · 老板令"本身已经是 2 次确认了"）',
        !G.map.wildAt(938, 938));
      /* v89.156（老板 1 · debug）：弹栈即时 + **关闭一次真关**（层级栈 bug 回归守卫）——
         病根：live 重绘（标题里 N/M 数字变化）被误判"进下级"压栈
         → 关闭键每点一次只弹一层（弹出的还是**旧快照**，含已删行）→ "闪烁、要点几下才关"。
         修复后：弹栈即新数据（不含已删行）→ 点关闭**一次即关净**。 */
      const popHtml156 = document.querySelector('#modal-root').innerHTML;
      check('v89.156①：弹栈即新数据（回退的野地列表不含已删的 938,938）',
        popHtml156.indexOf('938,938') < 0 && popHtml156.indexOf('附属野地') >= 0,
        'len=' + popHtml156.length);
      const xBtn156 = document.querySelector('#modal-root .modal-x');
      if (xBtn156) xBtn156.click();
      await sleep(240);
      check('v89.156①：点关闭**一次即关净**（层级栈零残留 · 旧 bug 回归守卫）',
        !document.querySelector('#modal-root .inner-panel'));
      G.ui.closeAllModals();
      await sleep(60);""",
'③ 7020 组升级')

# ---------- ④ 新增：侦察失败真路径（插在 ③ 组与"改建"之间） ----------
rep(
u"""      G.ui.closeAllModals();
      await sleep(60);

      /* ---- ③ 改建完成 → 直接回城外大界面 ---- */""",
u"""      G.ui.closeAllModals();
      await sleep(60);

      /* ---- ④ v89.156（老板 4）：侦察失败（真路径 —— 带守将的野地 + 固定随机为失败）---- */
      let foeWild156 = null;
      {
        const cc156 = G.currentCity();
        for (let rr = 2; rr <= 30 && !foeWild156; rr++) {
          for (let dy = -rr; dy <= rr && !foeWild156; dy++) {
            for (let dx = -rr; dx <= rr && !foeWild156; dx++) {
              const x = cc156.x + dx, y = cc156.y + dy;
              const tt = G.map.tile(x, y);
              if (!tt || tt.terrain === 'city') continue;
              if (G.map.npcAt(x, y) || G.map.fortAt(x, y) || G.map.wildAt(x, y)) continue;
              const lvv = G.map.wildLevelNow(x, y);
              if (!(lvv > 0)) continue;
              const dfe = G.wildDefenseAt(x, y, lvv);
              if (dfe && dfe.gen) foeWild156 = { x: x, y: y, lv: lvv };
            }
          }
        }
      }
      check('v89.156④：找到带守将的野地（侦察失败用例前置）', !!foeWild156,
        foeWild156 ? '(' + foeWild156.x + ',' + foeWild156.y + ') Lv' + foeWild156.lv : '未找到');
      if (foeWild156) {
        const g156 = G.state.generals[0];
        g156.status = 'idle';
        g156.stamina = G.staMax(g156); g156.energy = 100;
        const rndBk156c = Math.random;
        Math.random = () => 0.999;         /* 0.999 ≥ p（p ≤ 0.97）→ 必定失败 */
        const rf156 = G.battle.expedition({ kind: 'wild', x: foeWild156.x, y: foeWild156.y }, 'scout', {}, g156.id);
        Math.random = rndBk156c;
        await sleep(120);
        check('v89.156④：侦察失败（r.fail · 无情报）',
          rf156.ok === true && rf156.fail === true && !rf156.resReport,
          'msg=' + String(rf156.msg || '').slice(0, 48));
        const repF156 = (G.state.reports || [])[0];
        check('v89.156④：失败落公文「侦查失败 · X」（不带 scout → 不可展开）+ 缘由/建言',
          !!repF156 && /^侦查失败 · /.test(repF156.title) && repF156.scout == null && repF156.win === false
          && /缘由/.test(repF156.body) && /建言/.test(repF156.body),
          repF156 ? repF156.title : '(无)');
      }

      /* ---- ③ 改建完成 → 直接回城外大界面 ---- */""",
'④ 侦察失败真路径')

print('e2e patch G done, len', orig, '->', len(s))

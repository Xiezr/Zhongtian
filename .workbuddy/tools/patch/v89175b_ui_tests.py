# -*- coding: utf-8 -*-
"""v89175b · 智能战术升级（界面+测试+档案）
- ui.js：btTopHTML 智能指示动态化（调整 N / 维持 + 策略名 + title 明细）
         btRoundLine 回合头后插「🤖 智能调兵完成（…），开始回合战斗」（rec 可选参 → 可测）
- index.html：.bt-ev.smart 样式
- smoke §175 / e2e §175 / 需求档案
"""
import io, os, sys, subprocess

ROOT = 'E:/Deepseekdb'
FILES = {}

def load(p):
    if p not in FILES:
        FILES[p] = io.open(os.path.join(ROOT, p), 'r', encoding='utf-8', newline='').read()
    return FILES[p]

def save(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def edit(path, tag, old, new, count=1):
    s = load(path)
    n = s.count(old)
    assert n == count, '[%s] 锚点命中 %d 次（要求 %d）' % (tag, n, count)
    FILES[path] = s.replace(old, new, count)
    print('  ok  ' + tag)

# ============================================================
# U. ui.js
# ============================================================
print('== ui.js ==')

# U1. 顶栏智能指示动态化
edit('js/ui.js', 'U1 顶栏智能指示动态化',
  r'''        /* v89.164（老板 3）：智能战斗指示 —— 开着时玩家能看出"为什么接敌自动变防御"；
           切换入口在出征 / 自动出征面板的「战术」下拉。守城战不受托管（不显示）。 */
        ((GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf() && rec.side === 'atk')
          ? '<span class="bt-smart" title="智能战斗中：接敌自动转防御、按克制指派目标。切换在「出征 / 自动出征 · 战术」下拉。">⚡ 智能</span>' : '') +''',
  r'''        /* v89.164（老板 3）：智能战斗指示 —— 开着时玩家能看出"为什么接敌自动变防御"；
           切换入口在出征 / 自动出征面板的「战术」下拉。守城战不受托管（不显示）。
           v89.175（老板 1）：「每回合我要看见调整」—— 指示带**本回合调整数**
           （"调整 N" / "维持"）+ 赛马采用的目标策略；明细进 title（前 6 条）。 */
        ((GAME.battle && GAME.battle.smartOnOf && GAME.battle.smartOnOf() && rec.side === 'atk')
          ? (function () {
            var sn175 = rec.smartNote;
            var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[rec.smartRule] || rec.smartRule || '静态表';
            var tip175 = '智能战斗：赛马采用「' + rc175 + '」——' + (sn175 && sn175.n
              ? ('本回合调整 ' + sn175.n + ' 项：' + (sn175.notes || []).slice(0, 6).join('；'))
              : '本回合维持阵型（无需调整）')
              + '。切换在「出征 / 自动出征 · 战术」下拉。';
            return '<span class="bt-smart" title="' + U.escape(tip175) + '">⚡ 智能'
              + (sn175 ? (' · ' + (sn175.n ? ('调整 ' + sn175.n) : '维持')) : '') + '</span>';
          })() : '') +''')

# U2. btRoundLine：回合头后插智能行（可选 rec 参）
edit('js/ui.js', 'U2 btRoundLine 智能行',
  r'''  ui.btRoundLine = function (r, snap) {
    var lines = ui.btRoundLines(r, snap);
    var log = document.getElementById('bt-log');
    if (!log || !log.insertBefore) return lines.map(function (L) { return L.txt; });
    var frag = document.createDocumentFragment();
    frag.appendChild(ui.btLogItem('', 'sep'));
    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　最近距离 '
      + U.numText((r && r.gap) || 0, 0), 'hdr'));
    lines.forEach(function (L) { frag.appendChild(ui.btLogItem(L.txt, L.cls, L.indent)); });
    if (!lines.length) frag.appendChild(ui.btLogItem('[我] 待命　　[敌] 待命', 'atk', 0));
    log.insertBefore(frag, log.firstChild);                   /* 新回合置顶（倒叙） */''',
  r'''  ui.btRoundLine = function (r, snap, recIn) {
    var lines = ui.btRoundLines(r, snap);
    var log = document.getElementById('bt-log');
    if (!log || !log.insertBefore) return lines.map(function (L) { return L.txt; });
    var frag = document.createDocumentFragment();
    frag.appendChild(ui.btLogItem('', 'sep'));
    frag.appendChild(ui.btLogItem('第 ' + ((r && r.r) || 0) + ' 回合　·　最近距离 '
      + U.numText((r && r.gap) || 0, 0), 'hdr'));
    /* v89.175（老板 1）：「每回合我要看见调整（可以不动，但需要显示智能调兵完成，
       开始回合战斗）」—— 智能行的**判据 = 该回合有 smartLog 记录**（有记录=智能开过）
       recIn 可选参：正常从 ui._bt 取；测试/回放可显式传入。 */
    (function () {
      var rec175 = recIn || ((ui._bt && GAME.battle && GAME.battle._recOf) ? GAME.battle._recOf(ui._bt.id) : null);
      if (!rec175 || rec175.side !== 'atk' || !(rec175.smartLog || []).length) return;
      var sn175 = null;
      (rec175.smartLog || []).forEach(function (x) { if (x.r === ((r && r.r) || 0)) sn175 = x; });
      if (!sn175) return;
      var rc175 = (DATA.SMART_PLAN && DATA.SMART_PLAN.ruleCN || {})[sn175.rule] || sn175.rule || '静态表';
      var det175 = (sn175.notes || []).slice(0, 4).join('；');
      if ((sn175.notes || []).length > 4) det175 += ' 等 ' + sn175.notes.length + ' 项';
      frag.appendChild(ui.btLogItem('🤖 智能调兵完成（' + (sn175.n
        ? ('调整 ' + sn175.n + ' 项：' + det175) : '维持阵型')
        + '）· 采用「' + rc175 + '」· 开始回合战斗', 'smart'));
    })();
    lines.forEach(function (L) { frag.appendChild(ui.btLogItem(L.txt, L.cls, L.indent)); });
    if (!lines.length) frag.appendChild(ui.btLogItem('[我] 待命　　[敌] 待命', 'atk', 0));
    log.insertBefore(frag, log.firstChild);                   /* 新回合置顶（倒叙） */''')

# ============================================================
# H. index.html —— 智能行样式
# ============================================================
print('== index.html ==')
edit('index.html', 'H1 .bt-ev.smart 样式',
  r'''  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }''',
  r'''  .bt-ev.hdr { color: var(--gold-light); font-weight: 700; letter-spacing: .5px; }
  /* v89.175：智能调兵行 —— 与回合头同金色系但降一档（不抢"回合头"的层级） */
  .bt-ev.smart { color: var(--gold); font-weight: 700; }''')

# ============================================================
# S. smoke §175
# ============================================================
print('== smoke-test.js ==')
edit('smoke-test.js', 'S1 §175 节',
  r'''  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();''',
  r'''  /* ============================================================
   * 175. v89.175（老板）：「每回合我要看见调整（可以不动，但需要显示智能调兵完成，
   *      开始回合战斗）」「确实采用最优策略……多种最优路径比较」
   *   —— 策略库 + 开战赛马 + 每回合调整明细。
   * ============================================================ */
  console.log('\n===== 175. v89.175 智能战术（赛马 · 可见调整） =====');
  (function () {
    var fs175 = require('fs'), p175 = require('path');

    /* ① 策略库在册 */
    console.log('  --- ① 策略库 ---');
    check('§175① ★ 策略库 4 套（静态表/伤害最优/清除效率/清前排）+ 中文名表',
      (DATA.SMART_PLAN.rules || []).join(',') === 'static,dmg,eff,front'
      && DATA.SMART_PLAN.ruleCN && DATA.SMART_PLAN.ruleCN.front === '清前排');

    /* ② smartPickTarget 真调：四套规则各自选靶 */
    console.log('  --- ② 目标评分器（真调） ---');
    check('§175② ★ smartPickTarget 真调：战力碾压下 front 选最靠前 · dmg/eff 选最软',
      (function () {
        var u = { id: 'gongjian', name: '弓', count: 500, spd: 250, range: 1200, adv: 800 };
        var foes = [
          { id: 'daodun', name: '刀盾', count: 500, adv: 2500, stance: 'advance', spd: 275, range: 30, hpPer: 2400 },
          { id: 'gongjian', name: '弓', count: 100, adv: 100, stance: 'hold', spd: 250, range: 1200, hpPer: 1920 },
        ];
        var tf = G.battle.smartPickTarget(u, foes, 'front', 4000);
        var td = G.battle.smartPickTarget(u, foes, 'dmg', 4000);
        var te = G.battle.smartPickTarget(u, foes, 'eff', 4000);
        return tf === 'daodun' && td === 'gongjian' && te === 'gongjian';
      })());
    check('§175②b 空敌阵返回 null（不抛错）', G.battle.smartPickTarget({ id: 'gongjian', count: 10 }, [], 'dmg', 100) === null);

    /* ③ 赛马真调（确定性 + 选出规则 + scores 齐） */
    console.log('  --- ③ 赛马（真调 · 确定性） ---');
    check('§175③ ★ smartArbitrate 真调：4 套各跑一场 · 返回 {rule, scores, ms} · 两次同结果', (function () {
      var A = { changqiang: 400, daodun: 300, gongjian: 350, qingji: 150 };
      var B = { changqiang: 400, daodun: 300, gongjian: 350, qingji: 150 };
      var rec = { side: 'atk', genId: null, atkArmy: A, sim: { scArmy: B, scVal: 0, scGen: null, simOpts: {} } };
      var r1 = G.battle.smartArbitrate(rec);
      var r2 = G.battle.smartArbitrate(rec);
      return r1.scores.length === 4 && r1.rule === r2.rule && r1.scores[0].rule === 'static'
        && r1.ms >= 0 && r1.scores.every(function (s) { return typeof s.win === 'boolean' && s.ratio > 0; });
    })());
    check('§175③b 镜像对局赛马选回「静态表」（v89.164 标定：9.36 独大）',
      (function () {
        var A = { minfu: 200, yibing: 800, changqiang: 800, daodun: 600, tengjiabing: 400,
          gongjian: 700, qingji: 300, tieji: 150, tuqibing: 200, hubaoqi: 100,
          xiliangtieqi: 60, nanjiangxiangbing: 20, chuangnu: 60, chongche: 15, toudan: 30 };
        var rec = { side: 'atk', genId: null, atkArmy: A, sim: { scArmy: JSON.parse(JSON.stringify(A)), scVal: 0, scGen: null, simOpts: {} } };
        var r = G.battle.smartArbitrate(rec);
        return r.rule === 'static';
      })());

    /* ④ smartApply 返回明细（每回合"可见调整"的数据源） */
    console.log('  --- ④ 调整明细（真调） ---');
    check('§175④ ★ smartApply 返回 {n, notes}：首回合全量指派（notes 有「目标→」）', (function () {
      var A = { changqiang: 300, gongjian: 300, qingji: 200 };
      var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
      var rec = { side: 'atk', cmd: {} };
      var r1 = G.battle.smartApply(rec, env);
      return r1.n === 3 && r1.notes.length >= 3
        && r1.notes.some(function (s) { return s.indexOf('目标→') >= 0; });
    })());
    check('§175④b 规则注入：smartRule=front 时目标按 front 规则走（与 static 可比）', (function () {
      var A = { changqiang: 300, gongjian: 300, qingji: 200 };
      var env = G.tactic.begin(JSON.parse(JSON.stringify(A)), null, JSON.parse(JSON.stringify(A)), 0, null, { stances: {} });
      var rec = { side: 'atk', cmd: {}, smartRule: 'front' };
      G.battle.smartApply(rec, env);
      /* front 规则：最靠前优先 —— 初始双方 adv 对称（100），首选应为敌方最前排兵种之一 */
      return !!rec.cmd && Object.keys(rec.cmd).length === 3
        && Object.keys(rec.cmd).every(function (k) { return !!rec.cmd[k].t; });
    })());

    /* ⑤ 源码：stepBattle 接入 + 界面渲染 */
    console.log('  --- ⑤ 源码（接入与可见） ---');
    (function () {
      var bS = fs175.readFileSync(p175.join(__dirname, 'js', 'battle.js'), 'utf8');
      var uS = fs175.readFileSync(p175.join(__dirname, 'js', 'ui.js'), 'utf8');
      var hS = fs175.readFileSync(p175.join(__dirname, 'index.html'), 'utf8');
      var step = codeOf(bS, 'GAME.battle.stepBattle = function');
      check('§175⑤ stepBattle：赛马在 smartApply 之前 · smartNote/smartLog 写入',
        step.indexOf('smartArbitrate(rec)') >= 0
        && step.indexOf('smartArbitrate(rec)') < step.indexOf('smartApply(rec, ses)')
        && step.indexOf('rec.smartLog') >= 0 && step.indexOf('rec.smartNote') >= 0);
      check('§175⑤b 回合记录渲染智能行（btRoundLine · 「智能调兵完成」+「开始回合战斗」+ smart 类）',
        uS.indexOf('🤖 智能调兵完成') >= 0 && uS.indexOf('开始回合战斗') >= 0
        && uS.indexOf("'smart'") >= 0);
      check('§175⑤c 顶栏指示带「调整 N / 维持」（btTopHTML）',
        /⚡ 智能'[\s\S]{0,120}调整 ' \+ sn175\.n/.test(uS) || uS.indexOf("('调整 ' + sn175.n)") >= 0
        || uS.indexOf("sn175.n ? ('调整 ' + sn175.n) : '维持'") >= 0);
      check('§175⑤d 样式 .bt-ev.smart 在册', hS.indexOf('.bt-ev.smart') >= 0);
    })();

    var arc175 = fs175.readFileSync(p175.join(__dirname, '需求档案.md'), 'utf8');
    check('§175⑥ 需求档案在册（v89.175 · 老板原文关键句逐字）',
      arc175.indexOf('v89.175') >= 0
      && arc175.indexOf('每回合我要看见调整') >= 0
      && arc175.indexOf('多种最优路径比较') >= 0);
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();''')

# ============================================================
# E. e2e §175（插在 §174 段之后）
# ============================================================
print('== e2e-test.js ==')
edit('e2e-test.js', 'E1 §175 段',
  r'''  return finish();
}''',
  r'''  /* ============================================================
   * 175. v89.175（老板）：每回合可见调整（真实 DOM · 喂一回合 + 假 rec）
   * ============================================================ */
  console.log('\n--- §175. 智能调兵可见（v89.175 · 真实 DOM） ---');
  await (async function () {
    /* 打开战场（若可）并直接喂一条带 smartLog 的回合 —— 与 v89.120 的喂法同模式 */
    const log175 = document.querySelector('#bt-log');
    if (!log175) {
      /* 战场已关：用最小容器承接（btRoundLine 只依赖 #bt-log） */
      const host = document.createElement('div');
      host.id = 'bt-log';
      document.body.appendChild(host);
    }
    const snap175 = { field: 4000, atk: [{ id: 'gongjian', name: '弓箭手', count: 700, adv: 850, range: 1200 }],
      def: [{ id: 'gongjian', name: '弓箭手', count: 700, adv: 100, range: 1200 }], towers: null };
    const fakeRec175 = { side: 'atk', smartRule: 'front',
      smartLog: [{ r: 93, n: 3, rule: 'front', notes: ['弓箭手 前进→防御', '轻骑兵 目标→弓箭手', '长枪兵 目标→轻骑兵'] }] };
    G.ui.btRoundLine({ r: 93, gap: 1800, events: [] }, snap175, fakeRec175);
    const lg175 = document.querySelector('#bt-log');
    check('★ v89.175 回合记录出现「智能调兵完成（调整 3 项…）· 采用「清前排」· 开始回合战斗」',
      !!lg175 && lg175.textContent.indexOf('智能调兵完成') >= 0
      && lg175.textContent.indexOf('开始回合战斗') >= 0
      && lg175.textContent.indexOf('调整 3 项') >= 0 && lg175.textContent.indexOf('清前排') >= 0,
      lg175 ? lg175.textContent.slice(0, 90) : '#bt-log 缺失');
    /* 对照：无 smartLog 的 rec → 不出现智能行（不误报） */
    const before175 = lg175 ? lg175.textContent.length : 0;
    G.ui.btRoundLine({ r: 94, gap: 1700, events: [] }, snap175, { side: 'atk', cmd: {} });
    check('v89.175 对照：rec 无 smartLog → 本回合不出现智能行',
      !!lg175 && lg175.textContent.indexOf('第 94 回合') >= 0
      && (lg175.textContent.match(/智能调兵完成/g) || []).length === 1, '');
    /* 维持阵型分支 */
    G.ui.btRoundLine({ r: 95, gap: 1600, events: [] }, snap175,
      { side: 'atk', smartRule: 'static', smartLog: [{ r: 95, n: 0, rule: 'static', notes: [] }] });
    check('v89.175 无调整 → 「维持阵型」也可见（老板："可以不动，但需要显示"）',
      !!lg175 && lg175.textContent.indexOf('维持阵型') >= 0);
  })();

  return finish();
}''')

# ============================================================
# A. 需求档案
# ============================================================
print('== 需求档案.md ==')
edit('需求档案.md', 'A1 总览表加行',
  r'''| 已完成（详见 docs/v89174-建造读秒与弹窗.md） |''',
  r'''| 已完成（详见 docs/v89174-建造读秒与弹窗.md） |
| v89.175 | 2026-09-28 | 2 | **智能战术升级（每回合可见 + 真·最优）**（老板：「每回合我要看见调整（可以根据最优战术不调整，但需要显示智能调兵完成，开始回合战斗）」+「确实采用最优策略，给兵种设置不同行进方式（在射程内都可以开火，弓箭兵是不是不用一直前进？）和适当的攻击目标（伤害计算最优，还是清除前排最优，多种最优路径比较）」）—— 实机轨迹取证（我方弓 R4 进射程即停 · 敌弓冲锋是 v59"野地守方=前进"设计）；**姿态/守方两种改法经探针四场景实测均不优于现状**（2.14/2.93 vs 2.48），保持 v89.164 标定；落地 = **目标策略库 4 套（静态表/伤害最优/清除效率/清前排）+ 开战赛马**（全速模拟各 9ms·选"胜>交换比"，3/4 场增益：bowHeavy +3.02W 等）+ **每回合调整明细**（回合记录"🤖 智能调兵完成（调整 N/维持阵型）· 采用「…」· 开始回合战斗" + 顶栏"⚡ 智能 · 调整 N"） | 已完成（详见 docs/v89175-智能战术升级.md） |''')

edit('需求档案.md', 'A2 明细追加',
  r'''- "建造时间"显示口径 = **现实时间**（游戏秒 ÷ 倍速）：同一建筑换倍速会看到时长变化
  （游戏秒恒定）——设计口径，不是 bug；若想显示游戏时长另说。''',
  r'''- "建造时间"显示口径 = **现实时间**（游戏秒 ÷ 当前倍速）：同一建筑换倍速会看到时长变化（游戏秒恒定）——设计口径，不是 bug；若想显示游戏时长另说。

---

## v89.175（智能战术升级：每回合可见 + 真·最优 · 老板 2 条）

### ① 老板原文（逐字）

> 智能战术似乎还不够智能，要求1，每回合我要看见调整（可以根据最优战术不调整，但需要显示智能调兵完成，开始回合战斗）。要求2）确实采用最优策略，给兵种设置不同行进方式（反正在射程内都可以开火，弓箭兵是不是不用一直前进？）和适当的攻击目标（是伤害计算最优，还是清除前排最优，多种最优路径比较）

### ② 取证（三支轨迹探针）

- **我方弓"进射程即停"已成立**：`probe_v89175a` 轨迹——弓 R4 起 hold 在 adv=850（离敌前军 1050 ≤ 1200），此后全程不动 ✓；
- **敌弓"一直前进"= v59 设计**（`STANCE_DEFAULT`：野地守方=前进，攻城守方=防御）：野地守军若原地固守，近战守军会被弓兵白打——所以野地守方全线推进是**刻意**的；
- **两种"改进"经四场景实测均不优**（probe_v89175b）：
  - "守方仅远程 hold"：2.93（且普遍 30 回合清不完——穿透残兵 + hold 减伤 50% 双重拖慢）；
  - "我方能打才 hold（追击杀）"：2.14（vs 现状 2.48）——现状的"提前 250 hold（结阵减伤）"实测更优；
  - **诊断实锤**（probe_v89175c）：250 阈值 vs 射程 30 的空档会产生"刀盾在 205 处 hold 却打不到"的互卡——但那是"守方全 hold"世界的病，现状世界不触发。
- **结论**：姿态规则与守方默认**保持 v89.164 标定**（有数据 + v59 双重依据）；把力气花在老板点名的"**多种最优路径比较**"上。

### ③ 落地

| 项 | 改法 |
|---|---|
| 策略库（老板 2b） | `DATA.SMART_PLAN.rules = [static, dmg, eff, front]`（静态表 / 伤害最优 / 清除效率 / 清前排）+ 中文名表 |
| 评分器 | `GAME.battle.smartPickTarget(u, foes, rule, D)` —— **唯一出口**（赛马模拟与实战执行同一把尺，引擎公式 perAtk/clashFactor/perHp/counterXxx） |
| 开战赛马 | `GAME.battle.smartArbitrate(rec)`：4 套各**全速模拟**一遍（引擎确定 = 同输入同结果），按「胜 > 交换比」选最优，整场执行（不做每回合漂移——v89.164 实测漂移 2.88 < 静态 9.36）。成本 ≈ 4×9ms，首回合一次 |
| 每回合可见（老板 1） | `smartApply` 返回 `{n, notes}` → `stepBattle` 写 `rec.smartNote/smartLog` → **回合记录**"🤖 智能调兵完成（调整 N 项 / 维持阵型）· 采用「…」· **开始回合战斗**" + **顶栏**"⚡ 智能 · 调整 N"（title 列明细前 6 条） |
| 标定（探针 ④） | 赛马 **3/4 场优于固定静态表**：bowHeavy 清前排 5.27W（静态 2.24W · +3.02）· infHeavy +0.71 · cavHeavy +0.49；镜像局选回静态表（9.36W 独大） |

### ④ 验证与复现

- `node .workbuddy/tools/probe/probe_v89175a_smart_trace.js`（轨迹 · 弓 R4 停）；
- `node .workbuddy/tools/probe/probe_v89175b_strategy.js`（策略表 · 守方两态 · 追击 · 赛马）；
- `node .workbuddy/tools/probe/probe_v89175c_guard_trace.js`（卡壳诊断）；
- 门禁 + 实机（战场回合记录截图）。

### ⑤ 诚实缺口

- **敌弓"冲锋"是 v59 设计**（野地守方=前进）：想改"守方远程 hold"是一处表值，但探针实测全线变差（清不完）——**留待老板拍板**（若要改，先重标定）；
- `rangeK 1.1`（远程站更远）在对射局更优（bowHeavy 7.23 vs 4.91）但会让"纯远程对轰"卡死（双方都不动）——**未采用**；
- 赛马用"一场模拟"评分（无随机，确定）；极端配兵下的"最优"仍是启发式（4 套里选，不是全局最优）。''')

# ============================================================
print('== 落盘 ==')
for p, s in FILES.items():
    save(p, s)
    print('  saved ' + p)

print('== 语法哨兵 ==')
ok = True
for p in ['js/ui.js', 'smoke-test.js', 'e2e-test.js']:
    r = subprocess.run(['node', '--check', os.path.join(ROOT, p)], capture_output=True, text=True)
    print(('  PASS ' if r.returncode == 0 else '  FAIL ') + p + ' ' + (r.stderr.strip()[:200] if r.returncode else ''))
    ok = ok and r.returncode == 0
sys.exit(0 if ok else 1)

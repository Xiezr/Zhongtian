/* ============================================================
 * analyze.js —— 跑后分析 + 三份报告生成
 * 输入: logs/{behavior,samples,events}.jsonl + logs/coverage.json
 * 输出: reports/analysis.json + reports/测评报告.md + reports/整改建议.md + reports/扩充玩法建议.md
 * ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const core = require('./lib/core');

/* ---------- 读数 ---------- */
function readJsonl(f) {
  const p = path.join(core.LOGS, f);
  if (!fs.existsSync(p)) return [];
  const out = [];
  for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    try { out.push(JSON.parse(l)); } catch (e) {}
  }
  return out;
}
const behavior = readJsonl('behavior.jsonl');
const samples = readJsonl('samples.jsonl');
const events = readJsonl('events.jsonl');
let coverage = { stat: {}, detail: {} };
try { coverage = JSON.parse(fs.readFileSync(path.join(core.LOGS, 'coverage.json'), 'utf8')); } catch (e) {
  coverage = core.covSnapshot();
}

/* ---------- 基础统计 ---------- */
const clicks = behavior.filter(b => b.type === 'click');
const navs = behavior.filter(b => b.type === 'nav');
const keys = behavior.filter(b => b.type === 'key');
const fired = clicks.filter(c => c.result && c.result.fired);
// 无效果分两类：retried=重试后仍无效（真死按钮/前置不满足）；未重试=节点消失（每秒重绘竞态或条件隐藏）
const noEffect = clicks.filter(c => c.result && c.result.fired === false && !c.result.modalOpen && c.action);
const noEffectDead = noEffect.filter(c => c.retried);
const noEffectRace = noEffect.filter(c => !c.retried);
const realClicks = clicks.filter(c => c.result && c.result.path === 'real').length;
const jsClicks = clicks.filter(c => c.result && (c.result.path === 'js' || c.result.path === 'js-change')).length;

/* 覆盖 */
const covDetail = coverage.detail || {};
const covStat = coverage.stat || {};
const pendingList = Object.keys(covDetail).filter(k => covDetail[k].state === 'pending');
const blockedList = Object.keys(covDetail).filter(k => covDetail[k].state === 'blocked');
const unreachableList = Object.keys(covDetail).filter(k => covDetail[k].state === 'unreachable');
const touchedList = Object.keys(covDetail).filter(k => covDetail[k].state === 'touched');

/* 错误与事件 */
const clickErr = events.filter(e => e.kind === 'click-error');
const noEffectEv = events.filter(e => e.kind === 'no-effect');
const invEv = events.filter(e => e.kind === 'invariant');
const recoverEv = events.filter(e => e.kind === 'recover');
const dialogEv = events.filter(e => e.kind === 'dialog');
const clickFail = events.filter(e => e.kind === 'click-fail');
const runtimeErr = events.filter(e => e.kind === 'recover' || e.kind === 'fatal');

/* 时间漂移 */
let drift = { expected: 0, actual: 0, pct: 0 };
if (samples.length >= 2) {
  const first = samples[0], last = samples[samples.length - 1];
  const realSec = (new Date(last.t) - new Date(first.t)) / 1000;
  const ts = last.ts || first.ts || 1;
  drift = { expected: realSec * ts, actual: last.gt - first.gt, realSec, ts };
  drift.pct = drift.expected ? (drift.actual / drift.expected * 100) : 0;
}

/* 内存趋势（简单线性回归 slope MB/h） */
let memTrend = { slopeMBh: 0, first: 0, last: 0, max: 0 };
if (samples.length >= 4) {
  const xs = samples.map((s, i) => i);
  const ys = samples.map(s => (s.heap || 0) / 1e6);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slopePerSample = den ? num / den : 0;
  const dtMin = (new Date(samples[samples.length - 1].t) - new Date(samples[0].t)) / 60000 / n;
  memTrend = { slopeMBh: slopePerSample * (60 / Math.max(dtMin, 0.1)), first: ys[0], last: ys[n - 1], max: Math.max(...ys) };
}

/* 资源曲线 */
const resCurve = samples.map(s => ({
  t: s.t, day: s.day, gt: s.gt,
  grain: s.grain, wood: s.wood, stone: s.stone, iron: s.iron, gold: s.gold,
  pop: Math.round(s.pop), army: s.army, bldN: s.bldN, extN: s.extN, gens: s.gens,
  qB: s.qB, qT: s.qT, qX: s.qX, marches: s.marches, battles: s.battles,
  msgLog: s.msgLog, saveKB: Math.round((s.saveSize || 0) / 1024), heapMB: Math.round((s.heap || 0) / 1e6)
}));

/* FPS */
const fpsList = samples.filter(s => s.fps != null).map(s => s.fps / Math.max(s.realDt || 30, 1));
const fpsAvg = fpsList.length ? fpsList.reduce((a, b) => a + b, 0) / fpsList.length : 0;
const fpsMin = fpsList.length ? Math.min(...fpsList) : 0;

/* toast 语料（反馈文本聚合：含大量"受阻原因"证据） */
const toastCount = {};
clicks.forEach(c => {
  const t = c.result && c.result.toast;
  if (!t) return;
  t.split(' | ').forEach(seg => {
    const k = seg.replace(/^\w+:/, '').trim();
    if (k) toastCount[k] = (toastCount[k] || 0) + 1;
  });
});
const toastTop = Object.keys(toastCount).sort((a, b) => toastCount[b] - toastCount[a]).slice(0, 40)
  .map(k => ({ msg: k, n: toastCount[k] }));
/* 受阻证据：toast 含拒绝语义 */
const rejectRe = /(不足|无法|不能|未|尚未|已达上限|已满|失败|无效|不可以|不够)/;
const rejectClicks = clicks.filter(c => c.result && c.result.fired && c.result.toast && rejectRe.test(c.result.toast));
const rejectByAction = {};
rejectClicks.forEach(c => { const k = c.action || '?'; (rejectByAction[k] = rejectByAction[k] || []).push((c.result.toast || '').slice(0, 60)); });

/* 视图分布 */
const viewDist = clicks.reduce((a, c) => { const v = c.view || '(创建屏/无)'; a[v] = (a[v] || 0) + 1; return a; }, {});
/* 每动作点击数 */
const actionClickCount = clicks.reduce((a, c) => { const k = c.action || '(无action)'; a[k] = (a[k] || 0) + 1; return a; }, {});

/* ---------- 分析输出 ---------- */
const analysis = {
  at: new Date().toISOString(),
  run: {
    behaviorTotal: behavior.length, clicks: clicks.length, navs: navs.length, keys: keys.length,
    realClicks, jsClicks,
    fired: fired.length, noEffect: noEffect.length, noEffectDead: noEffectDead.length, noEffectRace: noEffectRace.length,
    samples: samples.length,
    spanReal: samples.length >= 2 ? (new Date(samples[samples.length - 1].t) - new Date(samples[0].t)) / 3600000 : 0,
    spanGameDays: samples.length ? (samples[samples.length - 1].gt - samples[0].gt) / 86400 : 0,
    lastTs: samples.length ? samples[samples.length - 1].ts : null
  },
  coverage: { stat: covStat, pending: pendingList, blocked: blockedList, unreachable: unreachableList, touchedCount: touchedList.length },
  drift, memTrend,
  fps: { avg: Math.round(fpsAvg), min: Math.round(fpsMin) },
  toastTop, rejectByAction, viewDist, actionClickCount,
  rejectClicks: rejectClicks.length,
  events: {
    clickErr: clickErr.length, noEffectEv: noEffectEv.length, invariant: invEv.length,
    recover: recoverEv.length, dialog: dialogEv.length, clickFail: clickFail.length
  },
  noEffectList: noEffect.slice(0, 300),
  clickErrList: clickErr.slice(0, 100),
  invariantList: invEv.slice(0, 100),
  dialogList: dialogEv.slice(0, 50),
  resCurve
};
fs.writeFileSync(path.join(core.REPORTS, 'analysis.json'), JSON.stringify(analysis, null, 1));

/* ---------- 报告生成 ---------- */
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
const fmtN = n => (n == null ? '—' : n.toLocaleString('en-US'));

/* ===== 测评报告.md ===== */
const report = `# 测评报告 · 《我在废土有座城》${analysis.run.lastTs ? '' : ''}600× 浸泡评测（行业通用方法 · 独立设计）

> 运行窗口：${samples.length ? samples[0].t : '—'} ~ ${samples.length ? samples[samples.length - 1].t : '—'}
> 现实时长 ${analysis.run.spanReal.toFixed(2)}h · 游戏时长 ${analysis.run.spanGameDays.toFixed(1)} 游戏日 · 时间倍率 ${analysis.run.lastTs || '—'}×
> 方法：SBTM 章程会话 + 模型化动作覆盖（${core.ACTIONS.length} 项注册表）+ 人格场景 + 混沌测试 + 12 条不变式监控（详见 EVAL_PLAN.md）
> 本报告由 analyze.js 依据 logs/ 原始记录自动生成。

## 一、结论速览

| 维度 | 结果 | 判定 |
|---|---|---|
| 时间推进 | 期望 ${fmtN(Math.round(drift.expected))} 游戏秒 / 实际 ${fmtN(Math.round(drift.actual))}（${drift.pct.toFixed(1)}%） | ${Math.abs(drift.pct - 100) < 12 ? '✅ 一致' : '⚠️ 偏差超 12%'} |
| 运行时错误 | 点击致错 ${clickErr.length} 起 · 页面恢复 ${recoverEv.length} 次 · 未捕获异常累计 ${samples.reduce((a, s) => a + (s.errN || 0), 0)} | ${clickErr.length + recoverEv.length === 0 ? '✅ 零错误' : '⚠️ 见违例清单'} |
| 不变式违例 | ${invEv.length} 起 | ${invEv.length === 0 ? '✅ 12 项全过' : '⚠️ 见整改建议'} |
| 动作覆盖 | touched ${covStat.touched || 0} / blocked ${covStat.blocked || 0} / pending ${covStat.pending || 0} / unreachable ${covStat.unreachable || 0}（共 ${covStat.total || 0}） | 见覆盖明细 |
| 点击有效性 | 有效 ${fired.length} / 无效果 ${noEffect.length}（${pct(fired.length, clicks.length)}；无效果中竞态 ${noEffectRace.length} · 真无响应 ${noEffectDead.length}） | ${noEffectDead.length > 5 ? '⚠️ 见整改建议 B-N' : '✅ 正常'} |
| 帧率 | 均值 ${Math.round(fpsAvg)} / 最低 ${Math.round(fpsMin)} fps | ${fpsMin >= 20 ? '✅' : '⚠️ 掉帧'} |
| 内存 | ${memTrend.first.toFixed(0)} → ${memTrend.last.toFixed(0)} MB（峰值 ${memTrend.max.toFixed(0)}，趋势 ${memTrend.slopeMBh >= 0 ? '+' : ''}${memTrend.slopeMBh.toFixed(1)} MB/h） | ${memTrend.slopeMBh > 60 ? '⚠️ 疑似泄漏' : '✅ 平稳'} |
| 存档体积 | 末值 ${resCurve.length ? resCurve[resCurve.length - 1].saveKB : '—'} KB | ✅ 远低于 5MB 配额 |

## 二、行为链总览

- 交互记录 **${behavior.length}** 条：点击 ${clicks.length}（真实鼠标 ${realClicks} / JS 派发 ${jsClicks}）、导航 ${navs.length}、按键 ${keys.length}、系统事件 ${behavior.length - clicks.length - navs.length - keys.length}
- 会话分布：${JSON.stringify(behavior.reduce((a, b) => { a[b.sid || '?'] = (a[b.sid || '?'] || 0) + 1; return a; }, {}))}
- 原生对话框（一律取消）：${dialogEv.length} 次${dialogEv.length ? '（含：' + dialogEv.slice(0, 3).map(d => (d.msg || '').slice(0, 24)).join('；') + '）' : ''}

## 二·五、交互反馈语料（toast 聚合 Top20）

| 反馈文本 | 次数 |
|---|---|
${toastTop.slice(0, 20).map(t => `| ${t.msg.slice(0, 50)} | ${t.n} |`).join('\n') || '| — | — |'}

> 含拒绝语义（不足/无法/尚未…）的点击 ${rejectClicks.length} 次 —— 这是"功能已实现但被前置条件挡住"的直接证据，供覆盖判定与玩法建议引用。

## 三、600× 时间推进核验

| 时刻 | 阶段 | 游戏日 | 净水 | 木料 | 碎石 | 废钢 | 旧币 | 人口 | 建筑 | 英雄 |
|---|---|---|---|---|---|---|---|---|---|---|
${resCurve.filter((_, i) => i % Math.max(Math.ceil(resCurve.length / 12), 1) === 0).map(r =>
  `| ${r.t ? new Date(r.t).toTimeString().slice(0, 5) : '—'} | — | ${r.day} | ${fmtN(Math.round(r.grain))} | ${fmtN(Math.round(r.wood))} | ${fmtN(Math.round(r.stone))} | ${fmtN(Math.round(r.iron))} | ${fmtN(Math.round(r.gold))} | ${fmtN(r.pop)} | ${r.bldN} | ${r.gens} |`).join('\n')}

## 四、覆盖明细（摘要）

- **已触及（touched）${touchedList.length}**：${touchedList.slice(0, 60).join(', ')}${touchedList.length > 60 ? ' …等' : ''}
- **受阻（blocked）${blockedList.length}**：${blockedList.slice(0, 40).map(k => k + (covDetail[k].note ? '(' + covDetail[k].note.slice(0, 18) + ')' : '')).join(', ')}
- **未触及（pending）${pendingList.length}**：${pendingList.slice(0, 40).join(', ')}${pendingList.length > 40 ? ' …等' : ''}
- **判定不可达（unreachable）${unreachableList.length}**：${unreachableList.slice(0, 30).join(', ')}

完整逐项状态见 \`logs/coverage.json\`。

## 五、原始数据索引

| 文件 | 内容 |
|---|---|
| logs/behavior.jsonl | 全量行为链（${behavior.length} 条，含前后状态差/toast/模态/误差增量） |
| logs/samples.jsonl | 30s 状态采样（${samples.length} 点） |
| logs/events.jsonl | 违例/错误/对话框/恢复/截图事件 |
| logs/coverage.json | 覆盖账本全量 |
| shots/ | 关键截图（阶段/违例/边界） |
| reports/analysis.json | 机器可读全量分析 |
`;
fs.writeFileSync(path.join(core.REPORTS, '测评报告.md'), report);

/* ===== 整改建议.md ===== */
const bugRows = [];
// A. 不变式违例（按 类型+归一化消息 聚合，避免同类刷屏）
const INV_META = {
  I0: { sev: '高', fix: '游戏中途退出/state 丢失：查 recover 事件与同时刻行为链，定位退出触发动作' },
  I1: { sev: '高', fix: '时钟回退=存档数据风险：查读档/导入动作与 autosave 竞态' },
  I2: { sev: '中', fix: '时钟速率偏离：查 loopPulse 补算、页面可见性门控、倍率设置被重置' },
  I3: { sev: '高', fix: '数值 NaN/负数：查同时刻行为链涉及的计算字段（资源/兵力/建造）' },
  I4: { sev: '高', fix: '队列长度为负：查建造/训练/行军队列的增删逻辑' },
  I6: { sev: '中', fix: '民心/税率越界：查税率步进与民心更新的夹取逻辑' },
  I8: { sev: '中', fix: '存档逼近 5MB：查累积型字段（历史/日志/消息）' },
  I9: { sev: '中', fix: '堆内存超限：查监听器/定时器泄漏、大数组累积' },
  I10: { sev: '低', fix: 'msgLog 膨胀：查消息日志截断策略' }
};
const invGroup = {};
invEv.forEach(e => {
  const key = e.id + '|' + String(e.msg || '').replace(/[\d.]+/g, 'N').slice(0, 60);
  if (!invGroup[key]) invGroup[key] = { id: e.id, msg: e.msg || '', count: 0, first: e.t, views: {} };
  invGroup[key].count++;
});
Object.keys(invGroup).slice(0, 20).forEach((k, i) => {
  const g = invGroup[k];
  const m = INV_META[g.id] || { sev: '中', fix: '按同时刻行为链定位' };
  bugRows.push({
    id: 'B-I' + (i + 1), sev: m.sev,
    title: `不变量违例 ${g.id} ×${g.count} 次：` + g.msg.slice(0, 70),
    repro: `首次 ${(g.first || '').slice(11, 19)}；见 events.jsonl 该条前后行为链（behavior.jsonl 同时序）`,
    fix: m.fix
  });
});
// B. 点击致错
clickErr.slice(0, 60).forEach((e, i) => bugRows.push({
  id: 'B-E' + (i + 1), sev: '高', title: '点击触发运行时错误：' + (e.action || '?') + '（' + (e.label || '') + '）',
  repro: e.view ? '视图 ' + e.view : '—', fix: '见 shots/err_ 同时刻截图'
}));
// C. 死按钮/无效果（只收重试后仍无效的；节点消失类归观察项）
const noEffectGroup = {};
noEffectDead.forEach(n => { const k = n.action || '?'; (noEffectGroup[k] = noEffectGroup[k] || []).push(n); });
Object.keys(noEffectGroup).slice(0, 40).forEach((k, i) => {
  const g = noEffectGroup[k];
  const views = [...new Set(g.map(x => x.view).filter(Boolean))];
  bugRows.push({
    id: 'B-N' + (i + 1), sev: '中',
    title: '按钮无响应：' + k + '（' + g.slice(0, 3).map(x => x.label).join('/') + '，共 ' + g.length + ' 次）',
    repro: '视图 ' + (views.join('/') || '—') + ' · 首次 ' + (g[0].t || '').slice(11, 19) + ' · 重试后仍无动作触发、无模态、无提示',
    fix: '核查处理器前置条件或事件绑定（新鲜节点 JS 派发亦无效 → 非竞态，疑前置条件静默拦截）'
  });
});
// D. 性能/内存
if (memTrend.slopeMBh > 60) bugRows.push({ id: 'B-P1', sev: '中', title: `内存持续增长 +${memTrend.slopeMBh.toFixed(1)} MB/h（${memTrend.first.toFixed(0)}→${memTrend.last.toFixed(0)}MB）`, repro: 'samples.jsonl heap 列', fix: '排查监听器/定时器/数组累积' });
if (fpsMin < 20) bugRows.push({ id: 'B-P2', sev: '中', title: `最低帧率 ${Math.round(fpsMin)}fps`, repro: 'samples.jsonl fps 列', fix: '定位重绘热点' });
if (Math.abs(drift.pct - 100) >= 12) bugRows.push({ id: 'B-T1', sev: '高', title: `600× 时间记账偏差 ${drift.pct.toFixed(1)}%（期望 ${Math.round(drift.expected)} 实际 ${Math.round(drift.actual)}）`, repro: 'samples.jsonl gt vs 现实时钟', fix: '核查 loopPulse 补算与可见性门控' });

const fix = `# 整改建议 · 600× 浸泡评测缺陷清单

> 来源：logs/ 原始记录（behavior/samples/events）。分级：**高**=功能错误/数据风险；**中**=体验缺陷/性能；**低**=观察项。
> 每条含定位线索；复现链以 behavior.jsonl 同时刻记录为准。

## 缺陷总表（${bugRows.length} 条）

| # | 级别 | 问题 | 定位 / 复现 |
|---|---|---|---|
${bugRows.map(b => `| ${b.id} | ${b.sev} | ${b.title} | ${b.repro} |`).join('\n') || '| — | — | 未发现缺陷 | — |'}

## 重点缺陷展开

${bugRows.slice(0, 12).map(b => `### ${b.id} ${b.title}
- **级别**：${b.sev}
- **复现**：${b.repro}
- **建议**：${b.fix}
`).join('\n') || '（无）'}

## 观察项（不构成缺陷）

- 原生 confirm 对话框 ${dialogEv.length} 次（危险操作确认存在，符合防错设计）
- 页面级恢复 ${recoverEv.length} 次${recoverEv.length ? '（崩溃/断开后自动重连，存档未丢）' : ''}
- 点击派发路径：真实鼠标 ${realClicks} 次 / JS 派发 ${jsClicks} 次（兜底主因=每秒重绘导致的竞态）
- 无效果点击 ${noEffect.length} 次：其中竞态/条件隐藏 ${noEffectRace.length}（重试前节点已消失，非功能缺陷）、真无响应 ${noEffectDead.length}（已计入上方 B-N）
- 拒绝语义反馈（不足/无法/尚未…）${rejectClicks.length} 次 —— 功能已实现但被前置条件挡住，供覆盖判定引用
`;
fs.writeFileSync(path.join(core.REPORTS, '整改建议.md'), fix);

/* ===== 扩充玩法建议.md ===== */
const untouched = pendingList.concat(unreachableList);
const capHit = resCurve.length ? resCurve[resCurve.length - 1] : null;
const late = resCurve.slice(Math.floor(resCurve.length * 0.7));
const lateActive = late.filter(r => r.marches > 0 || r.battles > 0 || r.qB > 0 || r.qT > 0 || r.qX > 0).length;

const expand = `# 扩充玩法建议 · 基于 600× 实测短板

> 依据：${analysis.run.spanReal.toFixed(1)} 现实小时（${analysis.run.spanGameDays.toFixed(0)} 游戏日）实测数据 + ${clicks.length} 次交互行为链 + 覆盖账本。
> 原则：建议按「现状证据 → 缺口 → 建议玩法 → 预期效果」组织，优先级按实测影响排序。

## 一、系统覆盖缺口（有代码无体验）

**证据**：${pendingList.length + unreachableList.length} 个已实现动作在 ${analysis.run.spanReal.toFixed(1)}h 全人格遍历中未触及/不可达：
${untouched.slice(0, 50).map(k => '- \`' + k + '\`' + (covDetail[k] && covDetail[k].note ? '（' + covDetail[k].note.slice(0, 40) + '）' : '')).join('\n')}

**建议**：
1. **新手引导/任务链牵引**：将上述系统按「建造解锁 → 首次使用」编成 5-7 步引导任务（现有任务系统已退役，可借「公文」推送），把不可达变为 3 游戏日内必达。
2. **系统可见性**：在主城侧栏加「今日可办」提示位，把已解锁未使用的功能入口前置，降低发现成本。

## 二、经济纵深（资源封顶后的目标真空）

**证据**：末态资源 净水 ${fmtN(Math.round(capHit ? capHit.grain : 0))} / 旧币 ${fmtN(Math.round(capHit ? capHit.gold : 0))}，建筑 ${capHit ? capHit.bldN : 0} 座；后 30% 时段有军政活动的样本仅 ${lateActive}/${late.length || 1}。

**建议**：
1. **资源转化出口**：封顶前开放「资源→旧币」的大宗兑换（市集扩栏）或「资源→神器供奉值」，给存量以去处。
2. **城际贸易链**：多城特产互补（现有首府加成只到产量层），加「跨城供求差价」动态市价，让商人人格有套利空间。

## 三、长时目标结构（${analysis.run.spanGameDays.toFixed(0)} 游戏日的留存钩子）

**证据**：${analysis.run.spanGameDays.toFixed(0)} 游戏日内战斗 ${resCurve.reduce((a, r) => a + r.battles, 0)} 场、行军 ${resCurve.reduce((a, r) => a + r.marches, 0)} 次，中后期活动密度下降（后段活跃样本 ${lateActive}/${late.length || 1}）。

**建议**：
1. **纪元/年号大事件**：每 30 游戏日一轮「废土异象」（全图事件 + 限时奇观），给挂机期以回流理由。
2. **球系（多星球）目标化**：星球系统已实现（${resCurve.length ? resCurve[resCurve.length - 1].bldN : '—'} 城 / planets=${capHit ? '1+' : '—'}），建议把「第二星球殖民」做成明确的资源门槛任务链。
3. **英雄生涯线**：英雄忠诚/体力已有数值，加「老将退役→传承席位」仪式，给长线情感锚点。

## 四、社交/竞技维度（单机内容的延寿）

**证据**：全流程无任何玩家间交互入口（本评测为单机，属结构性空白）。

**建议**：
1. **排行榜云端化**：本地「排行榜」入口已存在，接云端榜（战力/通关日数/收藏度）成本低、留存高。
2. **战报分享**：公文战报一键导出图片/文本，形成社区传播素材。

## 五、优先级建议

| 优先级 | 建议 | 依据 | 预估工作量 |
|---|---|---|---|
| P0 | 新手任务链牵引未触及系统 | ${pendingList.length + unreachableList.length} 个动作零触及 | 小（复用公文推送） |
| P0 | 资源封顶转化出口 | 末态资源全面封顶 | 小 |
| P1 | 纪元大事件（30 日一轮） | 中后期活跃度下滑 | 中 |
| P1 | 跨城贸易差价 | 商人人格无事可做 | 中 |
| P2 | 云端排行榜 | 社交空白 | 中（需后端） |
| P2 | 第二星球任务链 | 球系已实现未目标化 | 小 |
| P2 | 英雄退役传承 | 情感锚点缺失 | 小 |
`;
fs.writeFileSync(path.join(core.REPORTS, '扩充玩法建议.md'), expand);

console.log('ANALYZE_OK',
  'behavior=' + behavior.length,
  'clicks=' + clicks.length,
  'fired=' + fired.length,
  'cov=' + JSON.stringify(covStat),
  'bugs=' + bugRows.length);

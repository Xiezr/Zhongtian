/* v89.99 定稿三跑对照：rushG_{1x,120x,600x} + A2→A4→E 演进 + 围攻明细归因 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
var BASE = R + '.workbuddy/tmp/playtest600/';
function readJSON(p){ try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }
function rowsOf(tag){
  try {
    return fs.readFileSync(BASE + tag + '/snapshots.jsonl', 'utf8').split('\n').filter(Boolean)
      .map(function(l){ try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}
function logOf(tag){ try { return fs.readFileSync(BASE + tag + '/run.log', 'utf8').split('\n').filter(Boolean); } catch (e) { return []; } }
function battlesOf(tag){
  try {
    return fs.readFileSync(BASE + tag + '/battles.jsonl', 'utf8').split('\n').filter(Boolean)
      .map(function(l){ try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
  } catch (e) { return []; }
}
function blSum(row){ var o = (row && row.bl) || {}; var s = 0; for (var k in o) s += (o[k] || 0); return s; }
var out = [];
out.push('# v89.99 定稿三跑对照（同 seed 20260922 · 各 18.75 游戏年）');
out.push('');

['rushG_1x', 'rushG_120x', 'rushG_600x'].forEach(function(tag){
  var f = readJSON(BASE + tag + '/rush_final.json');
  var g = readJSON(BASE + tag + '/gold_final.json');
  var rows = rowsOf(tag);
  out.push('## ' + tag);
  if (!f) { out.push('（缺 rush_final.json）'); out.push(''); return; }
  var army = f.cities.reduce(function(a, c){ return a + c.army; }, 0);
  var goldAll = f.cities.reduce(function(a, c){ return a + c.gold; }, 0);
  out.push('- 终态：城 ' + f.cities.length + ' · 军 ' + army + ' · 旧币 ' + goldAll
    + ' · 声望 ' + f.rep + ' · 爵位档 ' + f.rank + ' · 建筑等级和 ' + blSum(rows[rows.length - 1]));
  out.push('- rush：围攻 发起' + f.rush.sieRep + '/下城' + f.rush.sieWin + '/败' + f.rush.sieFail
    + ' · 晋爵 ' + f.rush.promote + ' · 节钺用 ' + f.rush.jieyueUsed + ' · 通商券 ' + f.rush.coupon
    + ' · 丹药 ' + f.rush.perm + ' · 大还丹 ' + f.rush.sta);
  out.push('- 阶段：' + f.rush.era + '（切换 ' + (f.rush.eras || []).length + ' 次：'
    + (f.rush.eras || []).map(function(x){ return 'y' + x.y + '→' + x.id; }).join(' · ') + '）');
  out.push('- 民生：增民令 ' + (f.rush.popUses || 0) + ' 张 · 幸存者银行 存'
    + ((f.rush.bank || {}).join || 0) + '/放' + ((f.rush.bank || {}).release || 0)
    + '（峰值幸存者 ' + Math.round((f.rush.bank || {}).peak || 0) + '）· 税制 ' + f.rush.tax);
  if (g) out.push('- 旧币：套现 ' + g.gold.sold + '（' + g.gold.sales + ' 笔）· 花费 ' + JSON.stringify(g.gold.spends)
    + ' · 书 ' + g.gold.books + ' · 换批 ' + g.gold.rerolls);
  f.cities.forEach(function(c){ out.push('  - ' + c.name + '：旧币' + c.gold + ' 幸存者' + c.pop + ' 兵' + c.army + ' 建造位' + c.slots); });
  var bs = battlesOf(tag);
  var wins = bs.filter(function(b){ return b.winner === 'atk'; }).length;
  out.push('- 战斗：' + bs.length + ' 场 · 胜 ' + wins + '（' + (bs.length ? Math.round(wins / bs.length * 100) : 0) + '%）');
  /* 最终围攻档：各据点守备余量（破城则清档 → 这里只剩"没打下来"的） */
  var stf = readJSON(BASE + tag + '/final_state.json');
  var sg = (stf && stf.sieges) || {};
  var sgKeys = Object.keys(sg);
  if (sgKeys.length) {
    out.push('- 未下据点（守备余量）：' + sgKeys.map(function(k){
      return k.replace('f:', '') + '→' + Math.round(sg[k].hold) + '%（' + sg[k].waves + ' 波）';
    }).join(' · '));
  } else {
    out.push('- 未下据点：无（围攻档已清 = 全部下城或未开打）');
  }
  var fortB = bs.filter(function(b){ return b.mode === 'occupy' && (b.rounds || 0) >= 5 && (b.defLoss || 0) >= (b.atkLoss || 0) * 3; });
  out.push('- 据点战样本（occupy · 敌方损失远超我方 · 前 14）：');
  fortB.slice(0, 14).forEach(function(b){
    out.push('  - y' + b.y + ' · ' + b.target + ' · ' + b.rounds + ' 回合 · ' + (b.winner === 'atk' ? '胜' : '败')
      + ' · 我损 ' + b.atkLoss + ' / 敌损 ' + b.defLoss);
  });
  var lg = logOf(tag);
  out.push('- 战事摘要：点火 ' + lg.filter(function(l){ return /围攻线点火/.test(l); }).length
    + ' · 城垣未破 ' + lg.filter(function(l){ return /城垣未破/.test(l); }).length
    + ' · 据点已下 ' + lg.filter(function(l){ return /据点已下/.test(l); }).length);
  var yrs = [0.25, 1, 2, 4, 8, 12, 16];
  out.push('- 曲线（y · 城 · 军 · 幸存者/上限 · 旧币 · 阶段）：');
  yrs.forEach(function(y){
    var best = null;
    rows.forEach(function(r){ if (!best || Math.abs(r.y - y) < Math.abs(best.y - y)) best = r; });
    if (best) out.push('  - y' + best.y + ' · ' + best.cities + '城 · 军' + Math.round(best.army)
      + ' · 人' + Math.round(best.pop) + '/' + Math.round(best.popCap)
      + ' · 旧币' + Math.round((best.res || {}).gold || 0) + ' · ' + (best.era || ''));
  });
  var key = logOf(tag).filter(function(l){ return /阶段切换|自动出征 [开关]|税制切|银行放人|存人|增民令|采集将|体力补给/.test(l); });
  out.push('- 阶段/策略/补给日志（共 ' + key.length + ' 条，前 26）：');
  key.slice(0, 26).forEach(function(l){ out.push('  - ' + l.slice(0, 155)); });
  var err = readJSON(BASE + tag + '/errors.json') || [];
  out.push('- 错误 ' + err.length + ' 次');
  out.push('');
});

out.push('## 1× 演进对照：A2 → A3 → A4 → E（v89.99 定稿）');
[['rushA_1x', 'A2'], ['rushB_1x', 'A3'], ['rushC_1x', 'A4'], ['rushG_1x', 'E（本轮）']].forEach(function(pair){
  var f = readJSON(BASE + pair[0] + '/rush_final.json');
  if (!f) { out.push('- ' + pair[1] + '：缺'); return; }
  var army = f.cities.reduce(function(a, c){ return a + c.army; }, 0);
  var rows = rowsOf(pair[0]); var last = rows[rows.length - 1] || {};
  var topLv = 0;
  var gg = readJSON(BASE + pair[0] + '/gold_final.json');
  if (gg && gg.gens) gg.gens.forEach(function(x){ if ((x.lv || 0) > topLv) topLv = x.lv || 0; });
  out.push('- ' + pair[1] + '：城 ' + f.cities.length + ' · 军 ' + army + ' · 爵 ' + f.rush.rank
    + ' · 建筑和 ' + blSum(last) + ' · 顶将 Lv' + topLv + ' · 幸存者 ' + Math.round(last.pop || 0)
    + ' · 围攻发起 ' + (f.rush.sieRep || 0) + '/下城 ' + (f.rush.sieWin || 0));
});
out.push('');
out.push('## 三倍速 E 跑横比');
['rushG_1x', 'rushG_120x', 'rushG_600x'].forEach(function(tag){
  var f = readJSON(BASE + tag + '/rush_final.json');
  if (!f) return;
  var rows = rowsOf(tag); var last = rows[rows.length - 1] || {};
  out.push('- ' + tag + '：城 ' + f.cities.length + ' · 军 ' + f.cities.reduce(function(a, c){ return a + c.army; }, 0)
    + ' · 建筑和 ' + blSum(last) + ' · 幸存者 ' + Math.round(last.pop || 0) + '/' + Math.round(last.popCap || 0)
    + ' · 增民令 ' + (f.rush.popUses || 0) + ' · 银行放 ' + ((f.rush.bank || {}).release || 0)
    + ' · 围攻 发起' + (f.rush.sieRep || 0) + '/下城' + (f.rush.sieWin || 0)
    + ' · 大还丹 ' + (f.rush.sta || 0));
});
fs.writeFileSync(BASE + 'digest_rush_g.md', out.join('\n'), 'utf8');
console.log(out.join('\n'));

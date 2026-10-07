/* v89.206 玩法功能梳理 · 四链核对脚本（systemmatrix）
   对每个玩法系统核对四条链：① 数据表（DATA 定义）② 玩法出口（GAME./S./T. 函数）
   ③ 界面挂钩（ui. 函数）④ 验证（smoke/e2e 命中）。
   用法：node .workbuddy/tools/audit/audit_v89206_systemmatrix.js（输出重定向再读） */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
var JSS = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main']
  .map(function (f) { return read('js/' + f + '.js'); }).join('\n');
var SMOKE = read('smoke-test.js'), E2E = read('e2e-test.js');

function cnt(re, s) { return (String(s).match(re) || []).length; }

var SYS = [
  { n: '城池建设', d: ['BUILDINGS', 'EXT_BUILDINGS', 'CITY_PLAN', 'MASTERY'], g: ['buildCityAt', 'canBuildCityAt', 'cityPlanOf'], u: ['openBuildModal', 'openCityPanel'], t: ['建造', '城池'] },
  { n: '科技研究', d: ['TECH', 'TECH_MAX_LV', 'GOLD_GATE'], g: ['techCost', 'canResearch', 'techCapOf'], u: ['techHTML', 'openTech'], t: ['科技'] },
  { n: '幸存者居所', d: ['POP_CFG', 'POP_LABOR', 'CITY_YIELD'], g: ['planPopCapOf', 'popOf'], u: ['居所', 'pop'], t: ['居所', '幸存者'] },
  { n: '基因实验室', d: ['FARM', 'SEED_DROP', 'ESSENCE_DROP'], g: ['farm'], u: ['基因实验室', 'farm'], t: ['基因实验室', '灵草'] },
  { n: '官府任免', d: ['MAYOR_CURVE', 'LOYALTY'], g: ['assignMayor', 'genSalaryOf'], u: ['openCourt', '官府'], t: ['城主', '守将'] },
  { n: '征兵练兵', d: ['AUTO_TRAIN', 'TROOPS'], g: ['autoTrain'], u: ['autoTrain', '征兵'], t: ['征兵'] },
  { n: '出征战斗', d: ['STANCES', 'SIEGE', 'DUEL', 'CLASH'], g: ['expedition', 'siegeScaleOf'], u: ['openExpModal', 'expRowHTML'], t: ['出征', '围攻'] },
  { n: '战斗回看', d: ['REPLAY'], g: ['replay'], u: ['replay', '回看'], t: ['回看'] },
  { n: '前哨体系', d: ['FORT', 'FORT_AURA'], g: ['fortEffectOf', 'abandonFort', 'claimFort'], u: ['openOutpost'], t: ['前哨'] },
  { n: '野地流寇', d: ['WILD_DEFENSE', 'WILD_GUARD_LV', 'WILD_DECAY'], g: ['wildDefenseAt', 'wildGuardOf'], u: ['openWild'], t: ['野地', '流寇'] },
  { n: '运输补给', d: ['TRANSPORT'], g: ['transport'], u: ['运输'], t: ['运输'] },
  { n: '来犯防御', d: ['INVASION'], g: ['invasion'], u: ['invasion'], t: ['来犯', '失城'] },
  { n: '英雄招揽', d: ['HEROES', 'ENCOUNTERS', 'WILD_LORD_SURNAME'], g: ['jianghuRoll', 'recruit'], u: ['openJianghu', '酒馆'], t: ['江湖', '招募'] },
  { n: '资质晋升', d: ['GEN_RANKS', 'RANKUP_AWARD', 'EXP_CURVE'], g: ['rankUpUse', 'genAttrs'], u: ['rankBadge', 'gen-rankup'], t: ['晋升', '资质'] },
  { n: '装备锻造', d: ['EQUIP', 'SETS', 'FORGE', 'ENHANCE'], g: ['enhance', 'forge'], u: ['openForge', 'openEnhance'], t: ['打造', '强化'] },
  { n: '宝具挂件', d: ['BAOJU', 'ATTACH_SLOTS', 'BAOJU_FUSE'], g: ['attachEquip', 'baojuFuse'], u: ['openAttachPick'], t: ['宝具'] },
  { n: '内功修炼', d: ['NEIGONG', 'LING_SLOTS', 'LING_TEMPER'], g: ['lingTemper', 'canCultivate'], u: ['ling-temper'], t: ['内功', '蕴养'] },
  { n: '忠诚月俸', d: ['GEN_SALARY', 'LOYALTY'], g: ['salary', 'loyalty'], u: ['gp-sal194'], t: ['忠诚', '月俸'] },
  { n: '精力体力', d: ['STAMINA', 'ENERGY'], g: ['energyMaxOf', 'staMax'], u: ['energy'], t: ['体力', '精力'] },
  { n: '爵位晋升', d: ['RANK', 'RANK_BONUS'], g: ['rankOf', 'cityCapOf'], u: ['rankBadge'], t: ['爵位'] },
  { n: '门派', d: ['SECTS', 'SECT_TASKS', 'SECT_JOIN'], g: ['sect'], u: ['sect', '门派'], t: ['门派'] },
  { n: '声望', d: ['REP_RULE', 'REP_PENALTY'], g: ['rep'], u: ['rep'], t: ['声望'] },
  { n: '宝物收藏', d: ['COLLECT', 'JEWEL_LADDER', 'JEWEL_COST'], g: ['collectCondMetOf', 'collectBuySeries'], u: ['openCollect', '陈列馆'], t: ['收藏', '藏珍'] },
  { n: '奇观', d: ['WONDER', 'WONDERS'], g: ['wonder'], u: ['wonder', '奇观'], t: ['wonder'] },
  { n: '季节天气', d: ['SEASONS', 'WEATHERS'], g: ['season', 'weather'], u: ['season'], t: ['季节', '天气'] },
  { n: '道具材料', d: ['ITEMS', 'MATERIALS', 'BLUEPRINTS'], g: ['useItem', 'addItem'], u: ['openBag', 'openMarket'], t: ['道具', '游商'] },
  { n: '战报消息', d: ['MSG_KINDS', 'SCHEMES'], g: ['notify', 'moment'], u: ['openReport', 'openMessage'], t: ['战报'] },
  { n: '存档', d: ['DEFAULT_SETTINGS'], g: ['savePayload', 'adoptState'], u: ['openSettings', '存档'], t: ['存档'] },
  { n: '离线补偿', d: ['LOOP_GAP'], g: ['offlineCatchup', 'loopPulse'], u: ['loopPulse'], t: ['离线'] },
  { n: '沙盘推演', d: ['SANDBOX', 'SMART_PLAN'], g: ['simulate'], u: ['sandbox', '推演'], t: ['推演'] },
  { n: '纪事剧本', d: ['CHRONICLE_RULES', 'ERAS'], g: ['chronicle'], u: ['chronicle', '纪事'], t: ['纪事'] },
  { n: '城外建筑', d: ['EXT_BUILDINGS', 'EXT_PLAN_BY_LV'], g: ['extGridOf', 'extCap'], u: ['openLandModal', 'extHTML'], t: ['城外', '田地'] },
];

var rows = [];
SYS.forEach(function (s) {
  var dN = 0;
  s.d.forEach(function (x) { if (new RegExp('DATA\\.' + x + '\\s*=').test(JSS) || JSS.indexOf('DATA.' + x + ' ') >= 0) dN++; });
  var gN = 0;
  s.g.forEach(function (x) { gN += cnt(new RegExp('[\\w.]*' + x + '\\s*=\\s*function', 'g'), JSS) || (JSS.indexOf(x) >= 0 ? 1 : 0); });
  var uN = 0;
  s.u.forEach(function (x) { uN += cnt(new RegExp('\\bui\\.[\\w]*' + x, 'g'), JSS) + (JSS.indexOf(x) >= 0 ? 1 : 0); });
  var tS = 0, tE = 0;
  s.t.forEach(function (x) { tS += cnt(new RegExp(x, 'g'), SMOKE); tE += cnt(new RegExp(x, 'g'), E2E); });
  var state = (dN > 0 && gN > 0 && uN > 0 && tS > 0) ? '完整' : (dN === 0 ? '缺数据' : (gN === 0 ? '缺出口' : (uN === 0 ? '缺界面' : (tS === 0 ? '缺测试' : '部分'))));
  rows.push({ n: s.n, d: dN + '/' + s.d.length, g: gN, u: uN, ts: tS, te: tE, st: state });
});

console.log('══════ 玩法系统四链核对矩阵（' + SYS.length + ' 系统）══════');
console.log('  系统'.padEnd(12) + '数据表   出口   UI   smoke  e2e   状态');
rows.forEach(function (r) {
  console.log('  ' + r.n.padEnd(10) + String(r.d).padEnd(9) + String(r.g).padStart(4)
    + String(r.u).padStart(6) + String(r.ts).padStart(7) + String(r.te).padStart(6) + '   ' + r.st);
});
var bad = rows.filter(function (r) { return r.st !== '完整'; });
console.log('\n  完整 ' + (rows.length - bad.length) + ' / ' + rows.length + ' · 待核 ' + bad.length + '：');
bad.forEach(function (r) { console.log('    [' + r.st + '] ' + r.n); });

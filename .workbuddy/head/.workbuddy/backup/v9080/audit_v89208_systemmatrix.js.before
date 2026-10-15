/* v89.208 玩法功能梳理 · 四链核对 + 入口面/关停清单（systemmatrix）
   承接 v89.206 版（四链"在不在"）→ 本轮加"够不够得着 / 有没有关着门"。

   产出：
     ① 四链核对矩阵（32 系统：数据表 / 出口 / UI / smoke / e2e）
     ② 入口面：每系统的 data-action 入口数 + 主界面直达数（可发现性）   【新】
     ③ 关停 / 退役 / 墓碑清单（数据在但入口关）                        【新】
     ④ 数据表引用热力（喂给人工看"哪些表是骨架"）                       【新】

   用法：node .workbuddy/tools/audit/audit_v89208_systemmatrix.js
   数值侧另有现成尺子（本报告直接引用其结果，不重造）：
     node .workbuddy/tools/audit/ladder_audit.js      # 数值阶梯走不走得通
     node .workbuddy/tools/audit/economy_audit.js     # 旧币收入构成
     node .workbuddy/tools/audit/audit_v89134_tables.js  # 数据表卫生四查 */
var fs = require('fs');
var R = 'E:/Deepseekdb/';
function read(p) { try { return fs.readFileSync(R + p, 'utf8'); } catch (e) { return ''; } }
var MOD = ['data', 'state', 'domain', 'systems', 'tactic', 'battle', 'map', 'ui', 'main'];
var JSS = MOD.map(function (f) { return read('js/' + f + '.js'); }).join('\n');
var HTML = read('index.html');
var MAIN = read('js/main.js');
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

/* ── ② 数据动作面：全局 data-action 值 → 按关键词归属系统 ──
   口径声明：这是**关键词归属法**（启发式），不是精确调用图 —— 用于看"哪个系统在界面上
   摊开多少个可点动作"，个别重叠/漏归属不影响量级判断。上一版试过的"case 体引用出口名"
   口径已废弃：它认不出**视图型**系统（如科技是 城池面板 的子视图，动作叫 `tech-research`，
   体里根本不出现 `techHTML`），会把科技算成 0 入口。
   上一版试过的"index.html 直达"口径同样废弃：骨架里只有 9 个 data-action，
   界面按钮绝大多数由 ui.js 运行时生成。 */
var SYS_CK = {
  '城池建设': /^build|^wall|^city-|^demolish|^cancel-build|^open-.*city|^rush-build/,
  '科技研究': /^tech/,
  '幸存者居所': /^pop|^house/,
  '基因实验室': /^farm|^seed|^plant|^harvest/,
  '官府任免': /^mayor|^assign|^court|^salary|^gp-/,
  '征兵练兵': /^train|^conscript|^troop/,
  '出征战斗': /^exp|^march|^atk|^attack|^tactic|^sd-|^bt-|^battle/,
  '战斗回看': /^sd-replay|^bt-replay|^replay/,
  '前哨体系': /^fort|^outpost|^beacon/,
  '野地流寇': /^wild|^land-wild|^sweep|^clear/,
  '运输补给': /^transport|^cargo|^move-|^tm-/,
  '来犯防御': /^invasion|^defend|^garrison/,
  '英雄招揽': /^jianghu|^recruit|^hostel|^inn-|^sg-|^jh-/,
  '资质晋升': /^rank|^stat-|^gen-|^reroll|^artifact/,
  '装备锻造': /^forge|^enh|^eq-|^equip|^bag-eq|^salvage|^bp-|^quick-/,
  '宝具挂件': /^attach|^baoju|^act-/,
  '内功修炼': /^ling|^doll|^cultivate/,
  '忠诚月俸': /^loyal|^salary|^gift/,
  '精力体力': /^energy|^sta-|^heal/,
  '爵位晋升': /^rank-|^jieyue/,
  '门派': /^sect/,
  '声望': /^rep-|^fame/,
  '宝物收藏': /^collect|^jewel|^treasure/,
  '奇观': /^wonder/,
  '季节天气': /^season|^weather/,
  '道具材料': /^bag-|^item-|^mat-|^use-|^shop-|^mk-|^qb-|^bulk/,
  '战报消息': /^doc-|^report|^msg-|^view-report|^tab-report/,
  '存档': /^save|^load|^slot|^theme|^set-/,
  '离线补偿': /^loop|^offline/,
  '沙盘推演': /^sd-sim|^sandbox|^sim-/,
  '纪事剧本': /^story|^chronicle|^journal|^quest/,
  '城外建筑': /^ext|^land|^farm-|^field/,
};
var ALL_ACTIONS = (function () {
  var m = (JSS + HTML).match(/data-action="([\w-]+)"/g) || [];
  var o = {};
  m.forEach(function (x) { o[x.replace(/data-action="|"/g, '')] = 1; });
  return Object.keys(o);
})();

console.log('══════ ① 四链核对矩阵（' + SYS.length + ' 系统）══════');
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
  var state = (dN > 0 && gN > 0 && uN > 0 && tS > 0) ? '完整' : (dN === 0 ? '缺数据' : (gN === 0 ? '缺出口' : (uN === 0 ? '缺界面' : '部分')));
  /* ② 数据动作面（关键词归属法，见文件头口径声明） */
  var ck = SYS_CK[s.n];
  var acts = ck ? ALL_ACTIONS.filter(function (a) { return ck.test(a); }) : [];
  rows.push({ n: s.n, d: dN + '/' + s.d.length, g: gN, u: uN, ts: tS, te: tE, st: state, acts: acts.length, sample: acts.slice(0, 3).join(' ') });
});
console.log('  系统'.padEnd(12) + '数据表   出口   UI   smoke  e2e   动作面  状态');
rows.forEach(function (r) {
  console.log('  ' + r.n.padEnd(10) + String(r.d).padEnd(9) + String(r.g).padStart(4)
    + String(r.u).padStart(6) + String(r.ts).padStart(7) + String(r.te).padStart(6)
    + String(r.acts).padStart(7) + '   ' + r.st);
});
var bad = rows.filter(function (r) { return r.st !== '完整'; });
console.log('\n  四链完整 ' + (rows.length - bad.length) + ' / ' + rows.length + ' · 待核 ' + bad.length);
bad.forEach(function (r) { console.log('    [' + r.st + '] ' + r.n); });
console.log('  e2e = 0 的系统：' + (rows.filter(function (r) { return r.te === 0; }).map(function (r) { return r.n; }).join(' · ') || '无 ✅'));
console.log('  ── 数据动作面：全站唯一 data-action 值 ' + ALL_ACTIONS.length + ' 个 · 已归属 '
  + rows.reduce(function (a, r) { return a + r.acts; }, 0) + ' 个（重叠关键词会重复计数，看量级）');
console.log('  ── 动作面最小 5 个：' + rows.slice().sort(function (a, b) { return a.acts - b.acts; }).slice(0, 5)
  .map(function (r) { return r.n + ' ' + r.acts; }).join(' · '));

console.log('\n══════ ③ 关停 / 退役 / 墓碑清单（数据在但入口关）【新】══════');
(function () {
  var hits = [];
  var RE = /(noShop|下线|下架|退役|墓碑|已废弃|deprecated|不再(开放|提供|产出))/;
  MOD.forEach(function (f) {
    read('js/' + f + '.js').split('\n').forEach(function (L, i) {
      var t = L.trim();
      if (!/^(\/\/|\*)/.test(t)) return;
      if (!RE.test(t)) return;
      hits.push(f + ':' + (i + 1) + '  ' + t.replace(/^(\/\/|\*)\s*/, '').slice(0, 86));
    });
  });
  console.log('  代码注释声明的关停/退役 ' + hits.length + ' 条：');
  hits.slice(0, 40).forEach(function (h) { console.log('     ' + h); });
  if (hits.length > 40) console.log('     …另有 ' + (hits.length - 40) + ' 条');
})();

console.log('\n══════ ④ 数据表引用热力（top 12 · 骨架表 = 被 ≥6 个文件引用）【新】══════');
(function () {
  var names = {};
  (JSS.match(/DATA\.([A-Z][A-Z0-9_]{2,})/g) || []).forEach(function (x) {
    var n = x.replace('DATA.', ''); (names[n] = names[n] || {})['all'] = 1;
  });
  var out = [];
  Object.keys(names).forEach(function (n) {
    var files = 0, tot = 0;
    MOD.forEach(function (f) {
      var c = cnt(new RegExp('DATA\\.' + n + '\\b', 'g'), read('js/' + f + '.js'));
      if (c) { files++; tot += c; }
    });
    out.push({ n: n, files: files, tot: tot });
  });
  out.sort(function (a, b) { return b.files - a.files || b.tot - a.tot; });
  out.slice(0, 12).forEach(function (x) {
    console.log('  ' + x.n.padEnd(22) + ' 跨 ' + x.files + ' 文件 · 引用 ' + x.tot);
  });
  console.log('  ── 被引用的 DATA 表名 ' + out.length + ' 个（表总数 240，脚本写点名口径）');
})();

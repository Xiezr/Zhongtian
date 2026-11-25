/* ============================================================
 * ui-planet.js　星球与英雄 · 星球生成切换 / 英雄界面 / 属性 / 部件栏
 * ------------------------------------------------------------
 * 拆分自 ui.js（v156.27）。**纯搬运** —— 所有 ui.xxx 定义及其先后顺序
 *   一字未改，只是换了文件。等价性由逐条 sha1 比对证明。
 * ⚠️ 这个文件的职责就是「一个功能域的全部面板实现」，不要在这里改引擎逻辑。
 * ============================================================ */
import './ui.js';
(function () {
  var GAME = window.GAME;
  var DATA = GAME.DATA, U = GAME.utils;
  var ui = GAME.ui;
  var $ = ui._dom.$, $$ = ui._dom.$$;

  /* ============================================================
   * v90.81（老板 4）：**星球生成器 · 要素设计器**
   * ------------------------------------------------------------
   * 分层要素 L0 骨架 / L1 形貌 / L2 气候 / L3 生态 / L4 游戏性。
   * #2：多星球作**副本**（不同分类视图），单副本渲染（只载入当前球，防同时跑多个球崩）。
   * #4：要素具体化 + 生态标签（3 轴 + 经典组合）+ 生成后自动奇观 + 星球体检报告。
   * ============================================================ */
  /* 生态三轴（老板原文）*/
  ui.ECO_A = { '': '— 自然生态 —', '以水为主': '以水为主', '以温度为主': '以温度为主', '以地貌为主': '以地貌为主', '以生命为主': '以生命为主' };
  ui.ECO_A_SUB = ['海洋世界', '群岛世界', '沼泽湿地', '潮间带世界', '冰封世界', '干涸海床', '熔岩世界', '温室世界', '苔原世界', '极寒世界', '阴阳脸世界', '沟壑纵横', '沙丘之海', '火山世界', '撞击荒漠', '台地方山', '石林尖塔', '行星级裂谷', '晶体荒原', '洞穴世界', '浮空群岛', '丛林世界', '草原世界', '真菌世界', '发光生态', '礁岩世界', '化能生态', '有机世界'];
  ui.ECO_B = { '': '— 文明开发 —', '军事': '军事', '工业': '工业', '居住': '居住', '科研与遗迹': '科研与遗迹', '状态演进': '状态演进', '特殊': '特殊' };
  ui.ECO_B_SUB = ['行星要塞', '战争前线', '封锁世界', '采矿世界', '铸造世界', '蜂巢都市', '花园世界', '田园世界', '殖民边疆', '游牧世界', '研究站', '上古遗迹', '神殿圣地', '陵墓世界', '戴森残片', '改造中', '改造失败', '乌托邦', '末日后废土', '复苏中', '流放世界', '禁区', '失落世界'];
  ui.ECO_C = ['', '科技未来', '废土末日', '赛博霓虹', '工业粗野', '蒸汽朋克', '生物朋克', '宗教神圣', '暗黑哥特', '极简纯白', '复古未来', '超现实荒诞', '田园牧歌'];
  /* 经典生态组合（老板给的 11 例）*/
  ui.ECO_CLASSIC = [
    { n: '荒漠', c: '行星要塞', m: '科技未来', d: '沙丘之间嵌着巨型护盾穹顶与轨道炮台，要塞的冷白灯光在沙暴里像灯塔。', p: '塔图因 × 帝国基地' },
    { n: '荒漠', c: '游牧世界', m: '废土末日', d: '移动车队追着仅存的水脉跑，锈蚀的巨型机械残骸是唯一的地标。', p: '疯狂的麦克斯' },
    { n: '沟壑纵横', c: '采矿世界', m: '工业粗野', d: '天然沟壑被矿坑加深成悬崖城市，传送带横跨峡谷，空气里全是粉尘。', p: '剥离矿坑 × 垂直贫民窟' },
    { n: '冰封世界', c: '研究站', m: '极简纯白', d: '一栋孤独的白色建筑插在冰原上，方圆千公里只有风雪和读数。', p: '南极站 × 雪国列车' },
    { n: '熔岩世界', c: '铸造世界', m: '宗教神圣', d: '岩浆被当作神迹，烟囱森林之间立着巨型圣像，工人们边祷告边投料。', p: '机械教熔炉世界' },
    { n: '海洋世界', c: '蜂巢都市', m: '赛博霓虹', d: '没有陆地，城市是插进海里的巨型桩柱群，霓虹倒影在永不停歇的雨里。', p: '水上垂直都市 × 雨夜霓虹' },
    { n: '丛林世界', c: '上古遗迹', m: '宗教神圣', d: '石造巨构被树根撑裂，藤蔓盖住铭文，朝圣者仍在废墟里点灯。', p: '吴哥窟 × 幽灵公主' },
    { n: '阴阳脸世界', c: '殖民边疆', m: '科技未来', d: '殖民地只能建在永昼与永夜的夹缝里，那条暮光带是整颗星球唯一能住人的地方。', p: '潮汐锁定宜居环带' },
    { n: '浮空群岛', c: '失落世界', m: '复古未来', d: '岛屿漂浮在浓密的橙色大气里，居民用飞艇往来，已经忘了自己住在天上。', p: '云上遗民 × 蒸汽飞艇' },
    { n: '干涸海床', c: '陵墓世界', m: '暗黑哥特', d: '整片盐原曾经是海，如今立满墓塔。盐柱是死去海水的墓碑。', p: '盐原墓园' },
    { n: '洞穴世界', c: '禁区', m: '生物朋克', d: '地表一片死寂，地下溶洞里长满湿润的发光组织，没人知道那是不是生命。', p: '地下菌毯生态' },
    { n: '晶体荒原', c: '采矿世界', m: '超现实荒诞', d: '晶簇会缓慢生长，把采矿设备连同矿工一起包进透明结晶里。', p: '会吞噬的晶体地貌' }
  ];
  ui.STAR_COLORS = [[0xffe6b8, '黄白（类太阳）'], [0xffc890, '橙红（红矮星）'], [0xcfe0ff, '青白（蓝巨星）'], [0xff9a6a, '暗红（红巨星）'], [0xe8fff0, '翠绿（异星）']];
  ui._planetTab = 'gen';
  ui._planetForm = null;   /* 生成器表单现值（跨标签保留）*/
  ui.openPlanetGen = function () {
    var ps = GAME.planetsOf(), act = GAME.activePlanetOf();
    var tab = ui._planetTab || 'gen';
    /* 副本列表（一屏一球，切「进入」）*/
    var listRows = ps.map(function (p) {
      var on = act && p.id === act.id;
      var rep = (p.report || null);
      return '<div class="attr"><span class="k">' + (on ? '🪐 ' : '· ') + U.escape(p.name) +
        '　<span class="ui-sub">#' + p.id + ' · 种子 ' + p.seed + (rep ? ' · 宜居 ' + rep.habit : '') + '</span></span>' +
        '<span class="v">' + (on ? '<span style="color:var(--gold-light);">当前</span>'
          : '<button class="btn sm" data-action="planet-load" data-pid="' + p.id + '">进入</button>') + '</span></div>';
    }).join('');
    var rep = (GAME.sphere && GAME.sphere.report) ? GAME.sphere.report() : null;
    var eco = (GAME.sphere && GAME.sphere.ecoNatureOf) ? GAME.sphere.ecoNatureOf() : null;
    var curName = act ? act.name : '—';
    var bar = function(v, label, col) {
      return '<div class="attr"><span class="k">' + label + '</span><span class="v">' +
        '<span style="display:inline-block;width:160px;height:9px;background:var(--slab-1);border:1px solid var(--gold-dark);border-radius:4px;overflow:hidden;vertical-align:-1px;margin-right:6px;"><i style="display:block;height:100%;width:' + v + '%;background:' + (col || 'linear-gradient(180deg,var(--gold-light),var(--gold-dark))') + ';"></i></span>' +
        '<b style="color:var(--gold-light);font-variant-numeric:tabular-nums;">' + v + '</b> / 100</span></div>';
    };
    var curHTML = rep ? (
      '<div class="op-zone"><div class="op-zone-t">🪐 ' + U.escape(curName) + ' · 星球体检</div>' +
        '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:6px;">' +
          '宜居 · ' + U.escape(rep.note) + (eco ? ('　｜　' + eco.nature + ' · 主导 ' + eco.dominant + ' · 陆 ' + eco.landPct + '%') : '') + '</div>' +
        bar(rep.habit, '宜居度') + bar(rep.colon, '可殖民性') + bar(rep.danger, '危险等级', 'linear-gradient(180deg,var(--red-light),var(--red))') + bar(rep.res, '资源潜力', 'linear-gradient(180deg,var(--green-ok),#3a6d36)') +
        (function () {
          /* v91.30：今日奇观（每现实日刷新）+ 探索入口。 */
          var _pid = act ? act.id : ((GAME.activePlanetOf() || {}).id);
          var wd = GAME.wonderOf ? GAME.wonderOf(_pid) : null;
          var present = GAME.wonderPresent ? GAME.wonderPresent(_pid) : true;
          var active = GAME.wonderActiveCount ? GAME.wonderActiveCount(_pid) : 0;
          return '<div class="attr"><span class="k">奇观</span><span class="v">' +
            (wd ? '<b style="color:var(--gold-light);">' + wd.icon + ' ' + U.escape(wd.name) + '</b>　<span class="ui-sub">' + U.escape(wd.body) +
              (present ? ' · 今日在场' : ' · <span style="color:var(--red-light);">今日未出现</span>') + ' · 在途 ' + active + ' 队</span>　' +
              '<button class="btn sm gold" data-action="wonder-open" data-pid="' + _pid + '">探索</button>'
              : '<span class="ui-sub">—</span>') + '</span></div>';
        })() +
      '</div>') : '';
    var F = ui._planetForm || {};
    var get = function(k, d) { return F[k] != null ? F[k] : d; };
    var slider = function(id, key, label, min, max, step, dflt, hint) {
      var val = get(key, dflt);
      return '<div class="attr"><span class="k">' + label + '</span><span class="v">' +
        '<input type="range" id="' + id + '" data-pf="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" style="width:180px;vertical-align:-4px;" ' +
          'oninput="var b=this.closest(\'.attr\').querySelector(\'.pgen-val\');if(b)b.textContent=this.value;"> ' +
        '<b class="pgen-val" style="color:var(--gold-light);font-variant-numeric:tabular-nums;">' + val + '</b>' +
        (hint ? '　<span class="ui-sub">' + hint + '</span>' : '') + '</span></div>';
    };
    var sel = function(id, key, label, opts, dflt) {
      var val = get(key, dflt);
      return '<div class="attr"><span class="k">' + label + '</span><span class="v">' +
        '<select id="' + id + '" data-pf="' + key + '" style="padding:4px;background:var(--slab-1);color:var(--text);border:1px solid var(--gold-dark);border-radius:4px;">' +
        opts.map(function(o) { var v = o[0], t = o[1]; return '<option value="' + v + '"' + (String(val) === String(v) ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select></span></div>';
    };
    function optPairs(obj) { return Object.keys(obj).map(function(k) { return [k, obj[k]]; }); }
    var genHTML =
      '<div class="op-zone"><div class="op-zone-t">L0 骨架</div>' +
        slider('pg-radius', 'radius', '半径', 200, 460, 10, 300, '星球大小') +
        slider('pg-spin', 'spinSec', '自转周期', 20, 180, 10, 60, '秒/圈（无操作 10s 后起转）') +
        slider('pg-tilt', 'tilt', '轴倾角', 0, 90, 1, 23, '度') +
        slider('pg-atmo', 'atmo', '大气', 0.0, 2.0, 0.1, 1.0, '浓密度') +
        sel('pg-star', 'starColor', '恒星色温', ui.STAR_COLORS.map(function(c) { return [c[0], c[1]]; }), 0xffe6b8) +
        slider('pg-impact', 'impact', '撞击史', 0, 1, 0.1, 0, '陨击痕迹') +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">L1 形貌</div>' +
        slider('pgen-sea', 'seaFrac', '海洋占比', 0.10, 0.80, 0.01, 0.45, '海陆比') +
        slider('pg-cont', 'contCount', '大陆数量', 0, 12, 1, 0, '0=自然；少=超大陆，多=碎陆') +
        slider('pgen-ridge', 'ridge', '山脉强度', 0.5, 3.0, 0.1, 1.5, '起伏') +
        sel('pg-mtn', 'mountain', '山脉成因', [['fold', '褶皱'], ['volcano', '火山'], ['block', '断块'], ['impact', '撞击']], 'fold') +
        slider('pg-ocean', 'oceanDepth', '海深剖面', 0.4, 1.6, 0.1, 1.0, '浅…深') +
        slider('pgen-detail', 'detail', '颗粒细节', 0.0, 1.5, 0.1, 0.7, '地表斑驳') +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">L2 气候</div>' +
        slider('pgen-temp', 'temp', '纬度温差', 0.5, 1.5, 0.1, 1.0, '两极…赤道') +
        slider('pg-bands', 'tempBands', '温度带数量', 1, 8, 1, 3, '气候带') +
        slider('pg-cloud', 'cloud', '云量', 0.0, 2.0, 0.1, 1.0, '覆盖') +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">L3 生态</div>' +
        sel('pg-ecoA', 'ecoNature', '自然生态', optPairs(ui.ECO_A), '') +
        sel('pg-ecoAsub', 'ecoNatureSub', '　└ 具体', [['']].concat(ui.ECO_A_SUB.map(function(x) { return [x, x]; })), '') +
        sel('pg-ecoB', 'ecoCiv', '文明开发', optPairs(ui.ECO_B), '') +
        sel('pg-ecoBsub', 'ecoCivSub', '　└ 具体', [['']].concat(ui.ECO_B_SUB.map(function(x) { return [x, x]; })), '') +
        sel('pg-ecoC', 'ecoMood', '氛围调性', ui.ECO_C.map(function(x) { return [x, x || '— 氛围 —']; }), '') +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">L5 轨道系 · 陨石带</div>' +
        slider('pg-beltn', 'beltCount', '石块数量', 0, 800, 10, 240, '0=无带（星际采矿的矿源）') +
        slider('pg-beltin', 'beltInner', '内缘半径', 1.20, 2.60, 0.05, 1.55, '×星球半径') +
        slider('pg-beltw', 'beltWidth', '带宽', 0.15, 1.60, 0.05, 0.62, '×星球半径') +
        slider('pg-beltinc', 'beltIncl', '轨道倾角', 0, 45, 1, 16, '度（越大越"斜"）') +
      '</div>' +
      '<div class="op-zone"><div class="op-zone-t">L4 游戏性</div>' +
        '<div class="attr"><span class="k">种子</span><span class="v">' +
          '<input type="number" id="pg-seed" data-pf="seed" value="' + get('seed', (U.now() % 900000) || 1) + '" style="width:130px;padding:5px;background:var(--slab-1);border:1px solid var(--gold-dark);color:var(--text);border-radius:4px;text-align:center;">' +
          '　<span class="ui-sub">同种子同星球</span></span></div>' +
        '<div class="attr"><span class="k">奇观</span><span class="v"><span class="ui-sub">生成时自动产 1 处（按地形/危险度）</span></span></div>' +
        '<div class="op-row" style="margin-top:8px;">' +
          '<button class="btn gold" data-action="planet-create">✨ 生成并进入</button>' +
          '<button class="btn" data-action="planet-create-stay">生成（不进入）</button>' +
        '</div>' +
      '</div>';
    var clHTML = '<div class="op-zone"><div class="op-zone-t">经典生态（点选把三轴填入生成器表单）</div>' +
      ui.ECO_CLASSIC.map(function(c, i) {
        return '<div class="attr" style="cursor:pointer;" data-action="planet-classic" data-idx="' + i + '">' +
          '<span class="k"><b style="color:var(--gold-light);">' + c.n + ' · ' + c.c + ' · ' + c.m + '</b></span>' +
          '<span class="v ui-sub">' + U.escape(c.d) + '　<i>原型 ' + U.escape(c.p) + '</i></span></div>';
      }).join('') + '</div>';
    /* v92.241（老板「把星球生成的流程规定下来」）：**流程页** —— 流水线的唯一可视出口。
       逐级列出：层 / 名字 / 依赖 / 可调参数 / 产出 / 状态。玩家"细调"就看着这一页改。 */
    var flowHTML = (function () {
      var pg = GAME.planetgen;
      if (!pg || !pg.report) return '<div class="op-zone"><div class="op-zone-t">生成流程</div><div class="ui-sub">流水线未装载。</div></div>';
      var rp = pg.report(), au = pg.audit ? pg.audit() : { ok: true, errors: [] };
      var stName = { done: '✅ 已完成', fail: '❌ 失败', skipped: '· 未跑', idle: '· 待运行' };
      var rows = rp.rows.map(function (r) {
        return '<div class="attr" style="align-items:flex-start;">'
          + '<span class="k" style="min-width:150px;"><b style="color:var(--gold-light);">' + U.escape(r.layer) + '</b>'
          + '<br><span class="ui-sub">' + U.escape(r.name) + '</span></span>'
          + '<span class="v" style="text-align:left;">'
          + '<span style="color:' + (r.state === 'done' ? 'var(--green-ok)' : r.state === 'fail' ? 'var(--red-light)' : 'var(--text-dim)') + ';">'
          + (stName[r.state] || r.state) + (r.ms ? '（' + r.ms + 'ms）' : '') + '</span>'
          + '　<span class="ui-sub">依赖 ' + U.escape(r.deps || '—') + '｜可调 ' + U.escape(r.params || '—') + '</span>'
          + '<br><span class="ui-sub">产出：' + U.escape(r.out || '—') + '</span>'
          + '<br><span class="mk-lbl">' + U.escape(r.desc || '') + '</span>'
          + (r.note ? '<br><span style="color:var(--red-light);">' + U.escape(r.note) + '</span>' : '')
          + '</span></div>';
      }).join('');
      var d = rp.derived || {};
      return '<div class="op-zone"><div class="op-zone-t">生成流程（顺序即规范 · ' + rp.rows.length + ' 级）</div>'
        + '<div class="ui-sub" style="margin-bottom:6px;">'
        + '自检：' + (au.ok ? '<b style="color:var(--green-ok);">通过</b>' : '<b style="color:var(--red-light);">' + au.errors.length + ' 处问题</b>')
        + '　｜　上次生成：' + (rp.at ? (new Date(rp.at).toLocaleTimeString()) : '—') + ' · 种子 ' + (rp.seed || '—')
        + '</div>'
        + (au.ok ? '' : '<div class="ui-sub" style="color:var(--red-light);">' + au.errors.map(function (e) { return U.escape(e); }).join('；') + '</div>')
        + '<div class="ui-sub" style="margin:6px 0;">派生量（由星球特征算出）：大气高 <b>' + (d.atmH || '—') + '</b>'
        + '　大气浓度 <b>' + (d.atmA != null ? d.atmA : '—') + '</b>'
        + '　深海占比 <b>' + (d.deepFrac != null ? d.deepFrac : '—') + '</b></div>'
        + rows + '</div>';
    })();
    var body = tab === 'list' ? ('<div class="op-zone"><div class="op-zone-t">星球副本（单副本渲染 · 只载入当前球）</div>' + listRows + '</div>' + curHTML)
      : tab === 'classic' ? clHTML
      : tab === 'flow' ? flowHTML
      : (curHTML + genHTML);
    var tabBtn = function(id, label, on) {
      return '<button class="btn' + (on ? ' gold' : ' sm') + '" data-action="planet-tab" data-ptab="' + id + '">' + label + '</button>';
    };
    ui.openModal(
      '<div class="gold-heading">🪐 星球菜单</div>' +
      '<div style="text-align:center;margin-bottom:8px;">' +
        tabBtn('gen', '生成', tab === 'gen') + tabBtn('list', '副本', tab === 'list')
        + tabBtn('classic', '经典生态', tab === 'classic') + tabBtn('flow', '生成流程', tab === 'flow') +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:6px;">各星球作循环**副本**（不同分类视图，杜绝同时跑多个球）· 间距约 <b>' + U.numText(GAME.STAR_DIST, 0) + '</b> 六边格</div>' +
      '</div>' + body +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      'max'
    );
  };
  /* 生成器表单现值 → params（含 L0~L4）。从 DOM 读（含 data-pf 的 range/select/number）。*/
  ui._planetFormCollect = function () {
    var f = ui._planetForm || {}, root = document.getElementById('modal-root');
    (root ? root.querySelectorAll('[data-pf]') : []).forEach(function(e) {
      var k = e.getAttribute('data-pf');
      f[k] = (e.type === 'number' || e.type === 'range') ? Number(e.value) : e.value;
    });
    ui._planetForm = f;
    return f;
  };
  ui._planetParamsFrom = function () {
    var f = ui._planetFormCollect();
    return {
      radius: f.radius, spinSec: f.spinSec, tilt: f.tilt, atmo: f.atmo, starColor: Number(f.starColor), impact: f.impact,
      seaFrac: f.seaFrac, contCount: f.contCount | 0, ridge: f.ridge, mountain: f.mountain, oceanDepth: f.oceanDepth, detail: f.detail,
      temp: f.temp, tempBands: f.tempBands | 0, cloud: f.cloud,
      ecoNature: f.ecoNatureSub || f.ecoNature || '', ecoCiv: f.ecoCivSub || f.ecoCiv || '', ecoMood: f.ecoMood || '',
      /* v92.241：L5 轨道系（陨石带）—— 只传玩家**真的动过**的项，
         没动就留空 → 由 GAME.belt.SPEC 默认值兜底（避免把 undefined 写进存档）。 */
      belt: {
        count: (f.beltCount != null ? f.beltCount | 0 : null),
        innerMul: (f.beltInner != null ? Number(f.beltInner) : null),
        widthMul: (f.beltWidth != null ? Number(f.beltWidth) : null),
        inclDeg: (f.beltIncl != null ? Number(f.beltIncl) : null)
      }
    };
  };
  ui._planetSeedFrom = function () {
    var f = ui._planetFormCollect();
    return Math.round(Number(f.seed)) || ((U.now() % 900000) || 1);
  };
  /* ============================================================
   * v90.85（老板）：**星球切换读条屏** —— 盖读条 → 后台完成切换 → 走到 100% 再撤，
   * 让玩家**确认切换成功**（也顺带遮住换球瞬间的重算）。
   * 收尾回调 after() 在隐藏读条后执行（用于关弹窗/toast/刷新）。 */
  ui.switchPlanet = function (pid, after) {
    var ov = (document.getElementById && document.getElementById('planet-loading'));
    var fill = (document.getElementById && document.getElementById('pl-fill'));
    var pctE = (document.getElementById && document.getElementById('pl-pct'));
    var nameE = (document.getElementById && document.getElementById('pl-name'));
    var pl = null; try { GAME.planetsOf().forEach(function (x) { if (x.id === pid) pl = x; }); } catch (e) {}
    if (nameE) nameE.textContent = pl ? ('目标：🪐 ' + pl.name + ' · 种子 ' + pl.seed) : ('星球 #' + pid);
    var pct = 0, done = false;
    function paint() { if (fill) fill.style.width = pct + '%'; if (pctE) pctE.textContent = pct + '%'; }
    function finish() { if (done) return; done = true; pct = 100; paint();
      setTimeout(function () { if (ov) ov.classList.remove('on'); if (after) after(); }, 260); }
    if (ov) ov.classList.add('on'); paint();
    var t = setInterval(function () { if (pct < 90) { pct += 9; paint(); } }, 60);
    /* 切换是同步重算 → 先让读条画一帧（~170ms），再执行；执行完走到 100%。 */
    setTimeout(function () {
      var r = { ok: false };
      try { r = GAME.enterPlanet(pid) || r; } catch (e) {}
      clearInterval(t);
      if (r && r.ok) finish();
      else { clearInterval(t); if (ov) ov.classList.remove('on'); if (GAME.ui) GAME.ui.toast('⚠️ ' + ((r && r.msg) || '切换失败')); }
    }, 170);
    return true;   /* 异步：完成后 after() 触发 */
  };
  /* --------- 英雄 --------- */
  /* --------- 英雄 --------- */
  /* ============================================================
   * 英雄界面（v41 · 需求 2）
   * ------------------------------------------------------------
   * 老板原话：「英雄左侧显示姓名清单，右侧显示详细属性和装备图（不需要再整一个
   * 装备图的弹窗），把完整档案的全部信息也整合过来，不需要再整个单独弹窗」。
   *
   * 改前是「上方 3×2 卡片墙 + 下方简档」，再分别点「完整档案」「装备」弹出
   * 两个 lg 弹窗 —— 看全一个英雄要开两次弹窗，且弹窗一盖住列表，想换人得先关掉。
   *
   * 改后一屏到底：
   *   左：姓名清单（小头像 / 资质 / 等级 / 装备数 / 忠诚告警 / 状态）
   *   右：该英雄的**全部**信息 —— 身份、六维、当前效果、经验（可直接用道具）、
   *       体力·精力·忠诚、守将效果、部件栏（人形）、套装进度、赏赐、操作。
   * 自此英雄只有**一个**界面，没有第二个弹窗。
   * ============================================================ */
  ui.GEN_SLOTS = 12;             /* 每页显示席位数（空着也画够 12 格） */
  /* v76（老板）：「左侧英雄列表12个空格每页，平分空间吧，当城市超过12个英雄，
     自动在底部导航栏产生翻页菜单」—— v45 的"整段滚动"回归**每页 12 席 + 底部条翻页**：
     每页固定 12 行（不足补空席、12 行平分面板高度），超过 12 位英雄时
     翻页条登记到底部导航条（与其它长列表同一套机制）。 */
  ui.GEN_PER = 12;               /* 每页 12 席（= GEN_SLOTS） */

  ui.genStatusName = function (g) {
    if (!g) return '';
    return g.status === 'guard' ? '守将' : g.status === 'mayor' ? '城主'
      : g.status === 'march' ? '出征中'
      : g.status === 'gather' ? '采集中'
      : g.status === 'garrison' ? '驻守野地'
      : g.status === 'wonderExplore' ? '奇观探索中' : '空闲';
  };
  ui.genStatusCls = function (g) {
    if (!g) return '';
    return (g.status === 'guard' || g.status === 'mayor') ? 'st-guard'
      : g.status === 'idle' ? '' : 'st-busy';
  };

  /* 一张席位卡：空席与有将都从这里出，保证尺寸绝对一致 */
  /* 一行席位：空席与有将都从这里出，保证行高绝对一致 */
  ui.genRow = function (g, idx, cap, selId) {
    if (!g) {
      return '<div class="gen-row empty">' +
        '<span class="grow-face">＋</span>' +
        '<span class="grow-main">' +
          '<b class="grow-name">第 ' + (idx + 1) + ' 席</b>' +
          '<span class="grow-sub">' + (idx >= cap
            ? '英雄枢纽需 ' + (idx + 1) + ' 级（现 ' + cap + ' 席）' : '空位 · 可在征召大厅招募') + '</span>' +
        '</span></div>';
    }
    var a = GAME.genAttrs(g);
    var rk = GAME.rankOf(g);
    var lowLoy = (g.loyalty || 0) < 50;
    /* v45（需求 1）：左清单"直接显示姓名和他的资质等级就好"，并去掉「装 0/12」。
       砍掉 Lv / 满 / 装 x/12；忠诚只在**低于 50 时**作为告警冒出来
       （正常值不必每行重复，它在右侧档案里）。
       v46（需求 1）：资质**另起一行** —— 并排太拥挤，而且姓名长短不一会让
       资质章左右跳动。这些被砍掉的量都在右侧 gen-pane 里，信息没丢。 */
    return '<div class="gen-row' + (g.id === selId ? ' sel' : '') + '"' +
        ' data-action="gen-pick" data-gen="' + g.id + '" data-tip-el="1">' +
      '<span class="grow-face">' + ui.faceOf(g, 30) + '</span>' +
      '<span class="grow-main">' +
        '<b class="grow-name">' +
          /* v89.80（老板）：姓名后加 Lv 徽标（一眼可比强弱）；
             v89.188（老板 4）：「为名称预留 5 个中文字符位置」——姓名包进定宽 5em 的
             .grow-nm（超出省略、title 给全名），Lv 徽标从此对**所有英雄**横位一致；
             老板 3：撤「美人 / 英雄」标签（hero/beauty 字段保留：立绘与机制仍在用）。 */
          '<span class="grow-nm" title="' + U.escape(g.name) + '">' + U.escape(g.name) + '</span>' +
          '<span class="grow-lv">Lv' + (g.level || 1) + '</span>' +
          (GAME.isLordGeneral(g) ? '<span class="gcard-tag lord">君主</span>' : '') + '</b>' +
        '<span class="grow-sub">' + ui.rankBadge(g) +
          (lowLoy ? '<i class="grow-loy">忠 ' + Math.round(g.loyalty || 0) + ' ⚠</i>' : '') +
        '</span>' +
      '</span>' +
      '<span class="grow-st ' + ui.genStatusCls(g) + '">' + ui.genStatusName(g) + '</span>' +
      /* 悬停走全站唯一的 #tip-layer（v37），行内不自己绝对定位 */
      '<span class="tip-src"><div class="tip-t">' + U.escape(g.name) + ' · ' + rk.name + '</div>' +
        '<div class="tip-l">统 ' + a.tong + '　勇 ' + a.yw + '　智 ' + a.zm + '　政 ' + a.nz +
          '　速 ' + (a.spd || 0) + '　体 ' + a.staMax + '</div>' +
        '<div class="tip-a">Lv' + g.level + '　装备 ' + Object.keys(GAME.systems.equipBagOf(g)).length + '/12' +
          '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0) +
          (GAME.isLordGeneral(g) ? '' : '　忠诚 ' + Math.round(g.loyalty || 0)) + '</div>' +
      '</span></div>';
  };

  /* ============================================================
   * 右侧详情（v41 · 需求 2）：**原先分散在「下方简档 + 完整档案弹窗 +
   * 部件栏弹窗」三处的信息，全部合并到这里**。
   * 分区顺序按「先看人、再看数、最后动手」排：
   *   身份 → 六维与当前效果 → 经验 → 状态（体力/精力/忠诚/装备属性）
   *   → 守将效果 → 部件栏（人形）→ 赏赐 → 操作
   * ============================================================ */
  /* ============================================================
   * v89.186（老板 1）：**挂件**（遗物 = 第一个模块）界面组
   *   · ui.attachEffDesc186 —— 效果摘要唯一出口（面板/选择窗/断言共读）；
   *   · ui.openAttachPick —— 选择窗（通用：按 DATA.ATTACH_SLOTS 渲染，
   *     以后新增挂件模块零改动）；执行走 GAME.attachEquip（同一出口）。
   * ============================================================ */
  ui.ATTACH_CN186 = { tong: '指挥', nz: '治理', yw: '武力', zm: '谋略', spd: '速度', atk: '攻击', def: '防御', sta: '体力' };
  /* v89.187（老板 1）：品质徽标（低/中/高 · 颜色同表）——挂件行/选择窗/合成区共读 */
  ui.baojuQBadgeOf = function (it) {
    var q = GAME.baojuQOf ? GAME.baojuQOf(it) : null;
    if (!q) return '';
    var Q = (DATA.BAOJU_Q || {})[q] || {};
    return '<span style="color:' + (Q.color || 'inherit') + ';font-weight:700;">〔' + (Q.name || q) + '〕</span>';
  };
  ui.attachEffDesc186 = function (it) {
    if (!it || !it.eff) return '';
    var CN = ui.ATTACH_CN186, out = [];
    ['tong', 'yw', 'zm', 'nz', 'spd', 'atk', 'def', 'sta'].forEach(function (k) {
      if (it.eff[k]) out.push(CN[k] + ' +' + it.eff[k]);
    });
    return out.join('　');
  };
  /* v89.187（老板 1）：**合成区**（选择窗底部）——「2 低=中 · 2 中=高」。
     计数走 GAME.baojuCountQOf（唯一出口）；执行走 GAME.baojuFuse（同一出口）。 */
  ui.baojuFuseBoxHTML = function () {
    var F = DATA.BAOJU_FUSE || { need: 2, up: { low: 'mid', mid: 'high' } };
    var Q = DATA.BAOJU_Q || {};
    var line = function (q) {
      var to = (F.up || {})[q];
      var cnt = GAME.baojuCountQOf ? GAME.baojuCountQOf(q) : { n: 0 };
      var need = F.need || 2;
      var srcName = (Q[q] || {}).name || q, dstName = (Q[to] || {}).name || to;
      return '<div class="res-line"><span class="lbl">' + srcName + ' ×' + cnt.n + ' → ' + dstName + '</span><span class="val">' +
        (cnt.n >= need
          ? '<button class="btn sm gold" data-action="bao-fuse" data-q="' + q + '">⚗️ 合成（耗 ' + need + ' 得 1）</button>'
          : '<span style="color:var(--text-dim);">还需 ' + (need - cnt.n) + ' 件</span>') +
        '</span></div>';
    };
    return '<div class="op-zone" style="margin-top:8px;"><div class="op-zone-t">⚗️ 遗物合成（' +
      (F.need || 2) + ' 件同品质 → 1 件高一档）</div>' +
      line('low') + line('mid') +
      '<div class="ui-sub">高为顶阶不可再合；合成随机得目标品质中的一件（同品质任意两件可合）。</div></div>';
  };
  ui.openAttachPick = function (genId, slotId) {
    var slot = GAME.attachSlotOf(slotId);
    var g = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!slot || !g) { ui.toast('数据缺失，无法打开'); return; }
    ui._attachGen186 = genId; ui._attachSlot186 = slotId;   /* 合成后重开本窗（刷新计数） */
    var cur = GAME.attachOf(g, slotId);
    var pool = GAME.attachPoolOf(slotId);
    var rows = pool.map(function (it) {
      var on = !!(cur && cur.id === it.id);
      var have = (GAME.state.items || {})[it.id] || 0;
      return '<div class="xc-row">' +
        '<div class="xc-ico">' + ui.qbArt(it) + '</div>' +
        '<div class="xc-info"><b>' + ui.baojuQBadgeOf(it) + ' ' + U.escape(it.name) + ' ×' + have + '</b>' +
          '<span class="xc-prod">' + U.escape(ui.attachEffDesc186(it)) + (it.desc ? ' · ' + U.escape(it.desc) : '') + '</span></div>' +
        '<button class="btn sm' + (on ? ' dim' : ' gold') + '" data-action="attach-on" data-gen="' + genId +
          '" data-slot="' + slotId + '" data-item="' + it.id + '"' + (on ? ' disabled' : '') + '>' +
          (on ? '已佩' : '佩上') + '</button></div>';
    }).join('');
    if (!rows) rows = '<div class="q-empty">库存中没有可佩的' + U.escape(slot.name) + ' —— ' + U.escape(slot.empty || '可打据点/名城缴获') + '</div>';
    ui.openModal('<div class="gold-heading">' + slot.icon + ' ' + U.escape(g.name) + ' · ' + U.escape(slot.name) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">' +
        /* v89.205（老板）：「英雄名称信息下的这行去掉，只保留部件栏的即可：🔮 遗物」——
           面板挂件行退役，卸下入口迁入本窗「当前件」行。为何不挂列表行：列表只列**库存 > 0**
           的件，单件遗物装上后库存归零、列表为空 —— 卸下必须挂在"当前佩的那一件"上。
           （列表行保留「已佩(置灰) / 佩上」原语义：库里还有同款时的状态表达与再佩入口。） */
        (cur
          ? '当前：<b>' + U.escape(cur.name) + '</b>（' + U.escape(ui.attachEffDesc186(cur)) + '）' +
            '<button class="btn sm red" data-action="attach-off" data-gen="' + genId +
            '" data-slot="' + slotId + '">卸下</button>'
          : '当前未佩') + '</div>' +
      '<div class="modal-scroll">' + rows + ui.baojuFuseBoxHTML() + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>');
  };
  /* v90.16：机甲型制选择窗（多型制缩略图 → 点选更换本品外观） */
  ui.openMechaStylePick = function (genId) {
    var g = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var cur = ui.mechaStyleOf(g);
    var rows = ui.MECHA_STYLES.map(function (st) {
      var on = st.id === cur.id;
      return '<div class="mt-card' + (on ? ' on' : '') + '" data-action="mecha-style-do" data-gen="' + genId +
        '" data-style="' + st.id + '">' +
        '<img src="' + st.file + '" alt="">' +
        '<span class="mt-nm">' + U.escape(st.name) + (on ? ' ·在役' : '') + '</span></div>';
    }).join('');
    ui.openModal('<div class="gold-heading">机甲型制 · ' + U.escape(g.name) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">点选更换本品机甲外观（不影响数值）</div>' +
      '<div class="mecha-style-grid">' + rows + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>', { size: 'lg' });
  };
  /* v90.53（老板）：**按套装装备**选择窗 —— 按品阶列出各套装与已拥有件数，点选即整套装上（避免逐槽混搭）。 */
  ui.openEquipSetPick = function (genId) {
    var g = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var prog = GAME.setProgressOf(g);   /* 唯一来源：每套 {set,name,n,total,...} */
    var rows = (DATA.SET_RANKS || []).map(function (rk) {
      var sets = prog.filter(function (p) { return p.set.indexOf(rk.id) === 0; });
      if (!sets.length) return '';
      var cards = sets.map(function (p) {
        var full = p.n >= p.total;
        return '<div class="set-pick-card' + (full ? ' on' : '') + '" data-action="equip-set-do"'
          + ' data-gen="' + genId + '" data-set="' + p.set + '"'
          + ' title="' + U.escape(p.name) + '：已拥有 ' + p.n + '/' + p.total + ' 件，点选整套装备">'
          + '<span class="sp-name">' + U.escape(p.name) + '</span>'
          + '<span class="sp-n">' + p.n + ' / ' + p.total + '</span></div>';
      }).join('');
      return '<div class="set-pick-rank"><span class="spr-lb">' + rk.name + '</span>'
        + '<div class="set-pick-row">' + cards + '</div></div>';
    }).join('');
    ui.openModal('<div class="gold-heading">按套装装备 · ' + U.escape(g.name) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">点选一套 → 该套**已拥有**的件整套装上（未拥有的槽保留现件），避免逐槽混搭</div>' +
      '<div class="set-pick-grid">' + rows + '</div>' +
      '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>', { size: 'lg' });
  };
  ui.genPane = function (g) {
    if (!g) {
      return '<div class="gen-pane">' +
        '<div class="q-empty">左侧点一位英雄，这里显示其完整档案与部件栏。</div></div>';
    }
    var s = GAME.state;
    var genId = g.id;
    var a = GAME.genAttrs(g);
    var rk = GAME.rankOf(g);
    var capLv = GAME.genLevelCap(g);
    var atCap = g.level >= capLv;
    var expNeed = GAME.expNeedOf(g);
    var pct = Math.max(0, Math.min(100, Math.round(((g.exp || 0) / Math.max(1, expNeed)) * 100)));
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var staMx = GAME.staMax(g), staNow = GAME.staNow(g);
    var staPct = Math.round(staNow / Math.max(1, staMx) * 100);
    /* v66：装备贡献的体力（走 genAttrs 的 staEq —— 与"装备提供"清单同一口径） */
    var staEqNow = a.staEq || 0;
    var hpBonus = Math.round(GAME.staHpBonus(g) * 100);
    var setB = GAME.systems.genSetBonus(g);
    /* v88：当前生效套（'sha' 军中 / 'ling' 改造）—— 本面板所有装备读取按它分流；
       v89：非君主恒机甲（改造线君主专属） */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var isCult = GAME.canCultivate(g);
    var eqCnt = Object.keys(((isLing ? g.lingEquip : g.equip) || {})).length;
    /* v89.131（老板「精力的数值设定基于六维设计一个公式」）：
       上限 = GAME.energyMaxOf（六维加权公式，domain.js 唯一出口）。
       沿革：v89.116 曾借 `staMax` 当上限（GAME.energyMax 不存在）——
       那让"精力/上限"跟着体力涨而回复段又硬顶 100（两口径），本轮一并收口。 */
    var enMx = GAME.energyMaxOf(g);
    var enNow = GAME.energyNowOf(g);
    var eParts = GAME.energyPartsOf(g);
    var energyTip = '精力上限 ' + enMx + ' = 基准 ' + eParts.base
      + eParts.items.map(function (x) {
          return ' ＋ ' + x.n + ' ' + x.val + '×' + ((DATA.ENERGY.per || {})[x.k] || 0) + '=' + x.v;
        }).join('')
      + '\n（六维公式 · DATA.ENERGY）回复：现实时间 '
      + ((DATA.GEN_COST.recoverHours || 24)) + ' 小时回满（与倍速无关）';
    var bar = function (v, color) {
      return '<div class="gd-bar"><i style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + color + ';"></i></div>';
    };

    /* v54（老板："英雄经验条放在顶上…整个加号，点击加号可以选用经验道具"）：
       经验从"左栏里一个分区 + 平铺每种道具两三个按钮"改成 **身份行内的经验条 + 右端一个「＋」**。
       理由与赏赐那次同源：道具一多就撑成好几行，而且"我还有几个"反而看不出来。 */
    var expItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'exp' && (s.items || {})[it.id] > 0;
    });
    var expHave = 0;
    expItems.forEach(function (it) { expHave += (s.items[it.id] || 0); });
    var atkShow = Math.round(a.atkPct * 1000) / 10;
    var defShow = Math.round(a.defPct * 1000) / 10;
    /* v91.92：指挥 = 覆盖 + 溢出减伤。悬停里给人看两件事：
       ① 这一将的指挥最多能让多少兵吃满加成（每个兵种各算）；② 溢出后的减伤上限。
       —— 加成必须看得见，否则玩家没法判断该不该往指挥上投点。 */
    var coverCapShow = Math.round((a.tong || 0) * GAME.COVER_PER_TONG);

    /* ---------- ① 顶部：汇总信息（身份行）+ 经验条 + 操作 ---------- */
    /* v74（老板需求 3）：「英雄的简介…太啰嗦：赵子龙 突变体 ★★ 均衡 / 可当一镇之任」
       —— 头部收成两行：
         ① 姓名 + 资质★（悬停 = 等级上限 / 每级成长）+ 类型（均衡 / 猛将…）
         ② 资质描述（截掉"等级上限 N。"那半句 —— 它已进悬停）
       撤下：Lv 行、状态与城市、装备 n/12（装备数在右栏标题里）。
       Lv 挪进经验行；状态非空闲时以小签挂在名字后（出征中 / 守将 这类需要一眼看到）。 */
    /* ⛔ v89.190（老板 1）退役：styleName74（资质行尾的风格名）—— 与资质徽章内的
       「· 均衡」重复，老板令「均衡这个备注位重复了，去掉」。
       风格名唯一出口 = ui.rankBadge 里的后缀（列表 / 征召大厅 / 详情页同源）。 */
    var rkDesc74 = String(rk.desc || '').replace(/等级上限 \d+。?/, '').trim();
    /* v89.194（老板）：「在右侧英雄详情界面不要城主·XX城这个标签」——
       城主状态不再挂小签（城主身份由下方「解除城主」按钮体现；工资口径另见月俸行 ×1.5）。
       其他状态（守将 / 出征中 / 采集中 / 驻守）保持 v89.113 的"一眼看到"口径。 */
    var statusTag74 = (g.status && g.status !== 'idle' && g.status !== 'mayor')
      ? '<span class="gp-stag">' + U.escape(ui.genStatusName(g)) +
        (g.cityId && GAME.cityById(g.cityId) ? '·' + U.escape(GAME.cityById(g.cityId).name) : '') + '</span>'
      : '';
    /* v77（老板）：战技改造体系 —— 档案里加一行「战技 · 战技 N 重（属性 +X）」，
       悬停给出特性名与修习规则。加成本体在 GAME.genAttrs（唯一出口）。 */
    var ngLine77 = '';
    if (g.ng && g.ng.id) {
      var ngD77 = null;
      (DATA.NEIGONG || []).forEach(function (x) { if (x.id === g.ng.id) ngD77 = x; });
      if (ngD77) {
        var ATTRS77 = { tong: '指挥', nz: '治理', yw: '武力', zm: '谋略', spd: '速度' };
        ngLine77 = '<span class="gp-sub gp-ng" title="战技特性「' + ngD77.trait + '」：' +
          ATTRS77[ngD77.attr] + ' +' + ngD77.per + '/重，当前 +' + (ngD77.per * g.ng.lv) +
          '。修习同门残卷可精进（最高 ' + (ngD77.maxLv || 10) + ' 重），换书即转修。">战技 · <b>' +
          U.escape(ngD77.name) + '</b> ' + g.ng.lv + ' 重（' + ATTRS77[ngD77.attr] + ' +' +
          (ngD77.per * g.ng.lv) + '）</span>';
      }
    }
    /* v89.93（整改 E14）：**资质晋升**一行 —— 下一档 / 所需血清 / 持有数 / 一步到位。
       改前资质链在界面上没有任何入口（征召大厅只写"觉醒体/天启体只能靠血清升档"，
       却不说血清从哪来）。 */
    /* ⛔ v89.205（老板）：「英雄名称信息下的这行去掉，只保留部件栏的即可：🔮 遗物」
       —— 挂件行（.gp-sub.gp-attach186）**整行退役**：已佩回显 / 佩上 / 更换 / 卸下
       四件全部收进部件栏标题行的「🔮 遗物」入口（ui.openAttachPick 选择窗）：
       窗内「当前：X（效果）」承担回显 · 点其他件即更换 · 已佩行改「卸下」按钮（同轮迁入）·
       库存空态文案承担来源说明。沿革：v89.186 建（挂件行 + 面板行内换/卸）→
       v89.194 未佩备注行下线 → v89.205 整行退役。 */
    /* v89.188（老板 2）：「资质晋升……不要那些备注，直接在资质所在行给一个按钮，
       大小位置参考『解雇』」——整行说明文本退役（条件与来源收进按钮悬停），
       按钮改为**袖珍规格**（btn sm mini）挂进资质行（.gp-rankrow）。
       未至顶级时**常显**：缺药草置灰但**可点**，点后由 useItem 返回原因 toast（不静默）。 */
    var rankBtn186 = '';
    (function () {
      var order = (DATA.GEN_RANKS || []).map(function (x) { return x.id; });
      var ri = order.indexOf(g.rank || 'fan');
      if (ri < 0 || ri >= order.length - 1) return;              /* 已至顶级（天启体）→ 不给按钮 */
      var nxt = DATA.GEN_RANKS[ri + 1];
      var herb = null;
      (DATA.ITEMS || []).forEach(function (it) { if (it.type === 'rank_up' && it.from === (g.rank || 'fan')) herb = it; });
      if (!herb) return;
      var haveH = ((GAME.state && GAME.state.items) || {})[herb.id] || 0;
      var crop = null;
      ((DATA.FARM && DATA.FARM.crops) || []).forEach(function (c) { if (c.herb === herb.id) crop = c; });
      var tip186 = '资质晋升 → ' + nxt.name + '（上限 Lv' + (nxt.lvCap || '?') + '）'
        + '\n需《' + herb.name + '》×1 —— 持有 ' + haveH + ' 支'
        + '\n血清产自「基因实验室」（立项 → 按游戏时间研发 → 提取即得）'
        + (crop ? '\n研发耗时 ' + crop.hours + ' 游戏时／座' : '')
        + '\n每次晋升另给四维各 +' + (nxt.ascend || 0);
      rankBtn186 = '<button class="btn sm mini' + (haveH > 0 ? ' gold' : ' dim') + '" data-action="gen-rankup"'
        + ' data-gen="' + genId + '" data-item="' + herb.id + '"'
        + ' title="' + U.escape(tip186) + '">晋升</button>';
    })();
    var html = '<div class="gen-pane">' +
      '<div class="gp-head">' +
        '<span class="gp-face">' + ui.faceOf(g, 84) + '</span>' +
        '<span class="gp-id">' +
          /* v89.188（老板 1）：解雇按钮——「太大」→ 袖珍规格（btn sm mini）；
             「位置放置在英雄名称所在行，界面左三分之一处，达到切换英雄其相对位置不变」——
             姓名区定宽（.gp-nm = --gp-namew）后按钮**紧随其后**：任何英雄 / 窗口下横位恒定
             （旧版 margin-left:auto 贴行右缘，按钮与姓名相隔整行宽）。君主不给（v70）。
             老板 2：资质行同法给「晋升」按钮（大小位置参考解雇）；老板 3：撤 hero/beauty 标签。 */
          '<b class="gp-name">' +
            '<span class="gp-nm" title="' + U.escape(g.name) + '">' + U.escape(g.name) + '</span>' +
            (GAME.isLordGeneral(g) ? '' :
              '<span class="gp-nameops"><button class="btn sm mini" data-action="dismiss-gen"' +
                ' data-gen="' + genId + '">解雇</button></span>') +
            statusTag74 +
          '</b>' +
          '<span class="gp-sub gp-rankrow">' +
            '<span class="gp-rankcol">' + ui.rankBadge(g) + '</span>' +
            /* v89.190（老板 1）：「晋升」与「解雇」同一横位（同一位移变量 var(--gp-ops-shift)），
               并去掉行尾重复的「均衡」位（徽章后缀已显示风格名）。 */
            (rankBtn186 ? '<span class="gp-rankops190">' + rankBtn186 + '</span>' : '') +
          '</span>' +
          /* v90.10（老板 2）：「这行备注不要，目前已有悬停显示：天启体之资，百年一出。已达资质上限」
             ⛔ 原资质描述行（rkDesc74 + 达上限告警）**整行退役** —— 二者均已在悬停中
             （资质徽章 title = 资质 desc；经验「＋」title = 已达资质上限提示）。
             rkDesc74 变量保留（其替换逻辑仍在，便于回溯），此处不再渲染。 */
          ngLine77 +
          /* ⛔ v89.205：attachLines186（挂件行）已整行退役 —— 入口在部件栏「🔮 遗物」按钮
             （点开选择窗：佩 / 换 / 卸 / 合成；详见上方墓碑）。 */
          /* v90.10（老板 3）：「月俸这行备注放在下方状态菜单的底部」——
             月俸行**迁出身份行**，改由 salLine194 在「状态」区末行渲染（见下方）。 */
          '<span class="gp-exprow">' +
            '<span class="gd-expbar" title="经验 ' + U.numText(g.exp || 0, 0) + ' / ' +
              U.numText(expNeed, 0) + '"><i style="width:' + pct + '%;"></i></span>' +
            '<span class="gd-exptext">Lv<b>' + g.level + '</b>　经验 <b>' + U.numText(g.exp || 0, 0) + '</b> / ' +
              /* v89.190（老板 1）：「不要这个备注（65%）」——百分比已由左侧进度条表达。 */
              U.numText(expNeed, 0) + '</span>' +
            /* v66：到资质上限后按钮变暗并说明原因；**不禁用** ——
               点开能看到为什么不能吃经验（比"点了没反应"清楚）。 */
            /* v89.190（老板 1）：「等级升级按钮也是」——并入袖珍规格（btn sm mini）。 */
            '<button class="btn sm mini ' + (atCap ? 'dim' : 'gold') + ' gp-expadd" data-action="gen-exp-pick" data-gen="' + genId + '"' +
              ' title="' + (atCap ? '已达资质上限 Lv' + capLv + '，不能再使用经验道具'
                : expHave ? '用经验道具　背包 ' + expItems.length + ' 种 / ' + expHave + ' 个'
                : '背包中暂无经验道具') + '">＋</button>' +
            /* v58：这句原来在下面的操作行里，现在跟着经验条走（它讲的就是经验） */
            '<span class="gd-expleft">距 Lv' + (g.level + 1) + ' 还需 <b>' +
              U.numText(leftExp, 0) + '</b></span>' +
          '</span>' +
        '</span>' +
        /* v58（老板："守将和解雇可以放头像所在内容的右边"）：
           操作回到**身份行内部**、紧挨头像与身份信息右侧（v54 曾被移到下面一行）。
           竖排是为了不把身份行撑宽 —— 两个短按钮横排会把"经验条 + 数字"挤窄。 */
        '<span class="gp-ops">' +
          '<button class="btn sm' + (g.status === 'guard' ? ' red' : ' gold') + '" data-action="assign-guard" data-gen="' + genId + '">' +
            (g.status === 'guard' ? '解除守将' : '任命守将') + '</button>' +
          /* v89.113（老板需求 3）：城主（与守将同级）—— 一人一职，换职自动卸旧职 */
          '<button class="btn sm' + (g.status === 'mayor' ? ' red' : '') + '" data-action="assign-mayor" data-gen="' + genId + '">' +
            (g.status === 'mayor' ? '解除城主' : '任命城主') + '</button>' +
          /* v70（老板）：「不可解雇」—— 君主的档案里**不给解雇按钮**（守卫在域层，这里连入口都不给） */
        '</span>' +
      '</div>' +
      /* v70（老板）：「留可扩张框架」—— 君主特权清单（数据源 DATA.LORD_TRAITS，
         走 GAME.lordTraitsOf）。普通英雄返回空数组 → 整块不渲染、不占高度。 */
      (GAME.lordTraitsOf(g).length
        ? '<div class="note" style="margin-top:4px;">👑 君主特权：' +
            GAME.lordTraitsOf(g).map(function (t) {
              return t.icon + ' <b>' + t.name + '</b> ' + t.desc;
            }).join('　') + '</div>'
        : '') +
      /* v46（需求 2）：档案拆成**三块**，位置固定下来 ——
         上＝汇总身份行（横贯全宽）；左下＝六维 / 状态 / 守将效果；右＝部件栏。
         分栏比例：左栏全是文字（表格自己会折行，窄一点无所谓），
         右栏要放人形与放大的英雄抠图，必须给够宽度。 */
      '<div class="gp-body">' +
      '<div class="gp-col-l">';

    /* ---------- ② 左下：六维 + 当前效果 ----------
       v58（老板："守将效果…同步写在六维作用那里就好"）：
       该将现任守将时，把它**实际提供的守将加成**并进对应维的"作用"列 ——
       守将加成本来就出自六维（治理→产量/建造/税收、武力→征兵、谋略→研究/城防），
       再单列一块"守将效果"就是把同一份数据说两遍（本项目最经典的失效模式）。 */
    var gbNow = (g.status === 'guard' && GAME.guardBonus)
      ? GAME.guardBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
    /* v89.113（老板需求 3）：该将现任城主时的**城主加成**（与守将并行、互斥） */
    var mbNow = (g.status === 'mayor' && GAME.mayorBonus)
      ? GAME.mayorBonus(GAME.cityById(g.cityId) || GAME.currentCity()) : null;
    /* v74（老板需求 4/6）：
       ①「每点作用也作为六维名称的鼠标悬停备注」—— 作用文案进名称格 title
         （守将加成同进 title —— 它原本并排显示在作用列里）；
       ②「就在原来每点作用这一列」放 **＋ 加点按钮**（六维都有：道具或自由点二选一）；
       ③「不要这个备注」—— 下方 带兵 / 幸存者上限 / 本城产量 / 速度 四行整块撤除
         （幸存者上限那半条随需求 1 一并下线；其余三行的数字在「状态」区与侧栏已有出口）。 */
    var PLUS_STATS74 = ['tong', 'nz', 'yw', 'zm', 'spd', 'sta'];
    html += '<div class="gp-sec">六维</div>' +
      '<table class="tbl gd-dims"><thead><tr><th>六维</th><th class="ctr">数值</th><th class="ctr">加点</th></tr></thead><tbody>' +
        ui.GEN_DIMS.map(function (d) {
          var tip74 = '每点作用：' + d.use;
          var extra = (mbNow && d.mayorUse) ? d.mayorUse(mbNow)
            : ((gbNow && d.guardUse) ? d.guardUse(gbNow) : '');
          if (extra) tip74 += '\n' + extra;
          var plus74 = (PLUS_STATS74.indexOf(d.k) >= 0)
            ? '<button class="btn sm gd-plus" data-action="gen-stat-plus" data-gen="' + genId +
              '" data-stat="' + d.k + '" title="' + U.escape('用自由属性点或道具提升' + d.n) + '">＋</button>'
            : '';
          return '<tr><td title="' + U.escape(tip74) + '"><b style="color:' + d.color + ';">' + d.n + '</b></td>' +
            '<td class="ctr gd-v">' + (a[d.val || d.k] || 0) + '</td>' +
            '<td class="ctr gd-u gd-plus-c">' + plus74 + '</td></tr>';
        }).join('') +
        /* v74（老板需求 5）：「增加一行自由属性点，用于玩家自行决定加点」
           v89.131（老板）：「备注去掉：升级获得（每级 = 成长值）…或用道具」
           —— 说明文案撤下，只留数字（点右侧「＋」自然知道怎么用）。 */
        '<tr class="gd-freep"><td colspan="3">自由属性点 <b class="fp-n">' +
          Math.round(g.freePts || 0) + '</b></td></tr>' +
      '</tbody></table>';

    /* ---------- 状态（v54 · 老板） ----------
       ①「把总体，攻击，防御，体力（总体体力），精力放上，不要单独列装备的了」——
          老板对"总体"的定义：**英雄自身基础 + 丹药 + 装备 + 其他（临时加成）后的总数**。
          四行的数值一律走这个合计口径；装备不再单列，而是作为**构成**写在括号里。
          它能成立是因为数据侧已经把来源合并了：丹药在 v26 就写进 g[attr]，
          临时加成在 genAttrs 里改 a[attr]，所以 a.atkVal / a.defVal / a.staMax 本身就是总数。
       ②「在忠诚右边加赏赐，别在下边整个大按钮」—— 赏赐入口从底部大按钮挪到忠诚行右侧。 */
    var loy = Math.round(g.loyalty == null ? 70 : g.loyalty);
    var loyColor = loy < DATA.LOYALTY.desertAt ? '#c05a4a' : loy < DATA.LOYALTY.warnAt ? '#c98a3a' : '#6a9a4a';
    var jewels = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'jewel' && (s.items || {})[it.id] > 0;
    });
    var jewelTotal = 0;
    jewels.forEach(function (it) { jewelTotal += (s.items[it.id] || 0); });
    /* v89.40（老板）：「君主不会掉忠诚」—— 忠诚行与赏赐入口对君主整体不适用
       （君主忠诚恒为 100：battle 战败守卫 + 本页不出行；普通英雄一切照旧）。 */
    var isLordGen = GAME.isLordGeneral(g);
    /* v89.131（老板）：「体力精力应当设计加号按钮，供道具使用，参考赏赐」
       —— 两个「＋」的选择窗与赏赐同构：选项来自 DATA.ITEMS + 背包，不复制配置。 */
    var staItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'stamina' && (s.items || {})[it.id] > 0;
    });
    var staHave = 0;
    staItems.forEach(function (it) { staHave += (s.items[it.id] || 0); });
    var enItems = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'energy' && (s.items || {})[it.id] > 0;
    });
    var enHave = 0;
    enItems.forEach(function (it) { enHave += (s.items[it.id] || 0); });
    /* v90.10（老板 3）：「月俸这行备注放在下方状态菜单的底部」——
       由身份行迁来，渲染在「状态」区**末行**。读数唯一出口 GAME.genSalaryOf
       （已含资质倍率与城主/守将 ×1.5）；悬停给构成与结算规则。 */
    var salLine194 = '<div class="gd-line gp-sal194" title="' + U.escape(
      '每 7 游戏日随月俸一并结算（从所在城府库扣；府库不足则欠俸）。\n'
      + '构成：底俸 ' + ((DATA.GEN_SALARY || {}).base || 0) + ' ＋ 等级×' + ((DATA.GEN_SALARY || {}).perLevel || 0)
      + ' ＋ 四维和×' + ((DATA.GEN_SALARY || {}).perAttr || 0) + '，再乘资质倍率。\n'
      /* v90.38（老板）：「城主守将乘 1.5 这句也加入悬停显示」—— 恒在悬停（不再挂行内） */
      + '在任城主 / 守将：另 ×' + ((DATA.GEN_SALARY || {}).dutyMul || 1.5)
      + (g.status === 'mayor' || g.status === 'guard' ? '（本将现任，已计）' : '') + '。\n'
      + '欠俸的城：该城英雄忠诚 −10/期（封顶 −20），可用珠宝赏赐安抚。') + '">'
      + '月俸 ' + (GAME.isLordGeneral(g)
        ? '—（君主不领俸）'
        : ('<b>' + U.fmt(GAME.genSalaryOf(g)) + '</b> 旧币'))
      + '</div>';
    /* v89.131（老板）：「体力，精力列在攻击，防御上方。…忠诚列在最下方」
       —— 新行序：体力 → 精力 → 攻击 → 防御 → 忠诚 → 月俸（君主不适用忠诚行）。 */
    html += '<div class="gp-sec">状态</div>' +
      /* v90.33（老板）：「体力/精力/忠诚不再显示进度条，直接数值显示：当前/上限；忠诚放在攻击上方」——
         行序改为 体力 → 精力 → 忠诚 → 攻击 → 防御；三条去掉进度条、改「当前 / 上限」。 */
      '<div class="gd-line" title="体力 ' + U.numText(staNow, 0) + ' / ' + U.numText(staMx, 0)
        + '（当前 / 上限）\n上限 = 等级/资质/治理 ' + U.numText(staMx - staEqNow, 0)
        + ' ＋ 装备 ' + U.numText(staEqNow, 0)
        + '\n全军生命 +' + hpBonus + '%（体力直接决定全军生命的厚度）'
        + '\n回复：现实时间 ' + (DATA.GEN_COST.recoverHours || 24) + ' 小时回满（与倍速无关）">体力 <b class="gd-num">'
        + U.numText(staNow, 0) + '</b><span class="gd-max">/ ' + U.numText(staMx, 0) + '</span>' +
        '<button class="btn sm gd-plus' + (staItems.length ? ' gold' : ' dim') + '" data-action="gen-sta-pick"' +
          ' data-gen="' + genId + '"' + (staItems.length ? '' : ' disabled') +
          ' title="' + (staItems.length ? '使用体力道具：背包 ' + staItems.length + ' 种 / ' + staHave + ' 件'
            : '背包中暂无体力道具。游商「体力」页签可购') + '">＋</button></div>' +
      '<div class="gd-line" title="' + U.escape('精力 ' + U.numText(enNow, 0) + ' / ' + U.numText(enMx, 0)
        + '（当前 / 上限）\n' + energyTip) + '">精力 <b class="gd-num">' + U.numText(enNow, 0) + '</b>' +
        '<span class="gd-max">/ ' + U.numText(enMx, 0) + '</span>' +
        '<button class="btn sm gd-plus' + (enItems.length ? ' gold' : ' dim') + '" data-action="gen-energy-pick"' +
          ' data-gen="' + genId + '"' + (enItems.length ? '' : ' disabled') +
          ' title="' + (enItems.length ? '使用精力道具：背包 ' + enItems.length + ' 种 / ' + enHave + ' 件'
            : '背包中暂无精力道具。游商「精力」页签可购') + '">＋</button></div>' +
      /* v90.33：忠诚**上移到攻击之前**；去掉进度条，显示「当前 / 100」。 */
      (isLordGen ? '' :
      '<div class="gd-line" title="忠诚 ' + loy + ' / 100（当前 / 上限）\n赏赐珠宝可提升忠诚'
        + (loy < DATA.LOYALTY.warnAt ? '；当前偏低，谨防离心' : '') + '">忠诚 <b class="gd-num" style="color:' + loyColor + '">' + loy + '</b><span class="gd-max">/ 100</span>' +
        (loy < DATA.LOYALTY.warnAt ? '<span class="gd-warn">⚠ 偏低</span>' : '') +
        '<button class="btn sm gd-plus' + (jewels.length ? ' gold' : ' dim') + '" data-action="gen-gift-pick"' +
          ' data-gen="' + genId + '"' + (jewels.length ? '' : ' disabled') +
          ' title="' + (jewels.length ? '赏赐珠宝提升忠诚：可赏赐 ' + jewels.length + ' 种（共 ' +
            jewelTotal + ' 件）' : '背包中暂无珠宝。攻打城市缴获或游商购买') + '">＋</button></div>') +
      /* 攻击 / 防御：v89.133 构成进悬停；v90.38（老板）：「全军效果占位置太大，加入悬停显示」——
         「全军攻击/防御 +X%」由行内移到悬停，行上只留总数。 */
      '<div class="gd-line" title="攻击 ' + U.numText(a.atkVal, 0) + ' = 武力 '
        + U.numText(a.yw * GAME.ATK_PER_YW, 0) + ' ＋ 装备 ' + U.numText(a.atk, 0)
        + '\n全军攻击 +' + atkShow + '%'
        + '\n指挥覆盖：' + U.fmt(coverCapShow) + ' 兵/兵种（覆盖内吃满加成）'
        + '；溢出部分转全军减伤，最多 ' + Math.round(GAME.COVER_DR_MAX * 100) + '%">攻击 <b>'
        + U.numText(a.atkVal, 0) + '</b></div>' +
      '<div class="gd-line" title="防御 ' + U.numText(a.defVal, 0) + ' = 谋略 '
        + U.numText(a.zm * GAME.DEF_PER_ZM, 0) + ' ＋ 装备 ' + U.numText(a.def, 0)
        + '\n全军防御 +' + defShow + '%'
        + '\n指挥覆盖：' + U.fmt(coverCapShow) + ' 兵/兵种（覆盖内吃满加成）'
        + '；溢出部分转全军减伤，最多 ' + Math.round(GAME.COVER_DR_MAX * 100) + '%">防御 <b>'
        + U.numText(a.defVal, 0) + '</b></div>' +
      /* v90.10（老板 3）：月俸行钉在「状态」区底部（君主也显示 —— 只是文案为"君主不领俸"）。 */
      salLine194;

    /* ---------- ③ 右侧：部件栏（人形，**内嵌**，不再开弹窗） ---------- */
    html += '</div><div class="gp-col-r">';
    var inv = {};
    (s.inventory || []).forEach(function (x) {
      var e = DATA.EQUIP[GAME.eqId(x)];
      if (e && !!e.ling === isLing) inv[e.slot] = (inv[e.slot] || 0) + 1;   /* v88：只数当前套 */
    });
    /* 「装备贡献」= 带装属性 − 裸装属性：同一套取值口，不多算一处。
       v60（需求 1/2）：老板要求「部件栏右侧有重复的总属性…右侧把装备提供的属性
       分行显示即可：统帅 +775.5　武力 +752.5 等等」。于是：
         ① **删掉那行带装总数**（统2751.5 勇2690.5…）—— 它是"总体"口径，
            与左栏「状态」区的攻击/防御/体力重复（同一组数字两个出口，
            本项目最经典的失效模式）；
         ② 装备贡献从"横排小字"改成**逐行**（全称 + 右对齐数值）——
            横排一多就挤成一团，看不出哪一项是大头。 */
    var bare = GAME.genAttrs({
      level: g.level, tong: g.tong, yw: g.yw, zm: g.zm, nz: g.nz, speed: g.speed,
      attack: g.attack, defense: g.defense, rank: g.rank, style: g.style,
      perm: g.perm || {}, equip: {},
    });
    var GAIN = [['tong', '指挥'], ['yw', '武力'], ['zm', '谋略'], ['nz', '治理'],
      ['atk', '攻击'], ['def', '防御'], ['spd', '速度'],
      /* v66（老板）：「部分英雄的体力没有加上装备的数值」。
         这一行原先读的是 `hp`（装备生命，另一条并行加成），列名却写「体力」，
         而装备体力对上限的贡献只有套装的 25/40/60 —— 两笔账对不上。
         现在装备体力（散件 + 套装件 + 套装档位）已经并进体力上限，
         这一行直接读 `staEq`，与左栏「状态 · 体力」是同一个数。 */
      ['staEq', '体力']];
    var gainRows = GAIN.map(function (p2) {
      /* v65（老板）：属性一律整数 —— genAttrs 已经取整，这里直接相减就是整数 */
      var d = Math.round((a[p2[0]] || 0) - (bare[p2[0]] || 0));
      if (!d) return '';
      return '<div class="eq-grow"><span class="k">' + p2[1] + '</span>' +
        '<span class="v">' + (d > 0 ? '+' : '') + d + '</span></div>';
    }).join('');
    /* v88：改造侧加一行「机能」（探索战力；差值法不适用 —— 直接用汇总出口） */
    var lingRow = '';
    if (isLing && GAME.lingPowerOf) {
      var lp = GAME.lingPowerOf(g);
      if (lp) lingRow = '<div class="eq-grow"><span class="k">机能</span><span class="v">+' + lp + '</span></div>';
    }

    /* v89：双轨 tab 只给君主（改造线君主专属）；普通英雄整块切换行不渲染 */
    html += '<div class="gp-sec" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
      '部件栏（' + eqCnt + ' / ' + (isLing ? 12 : 19) + '）' +
      ui.help(isCult
        ? '机甲部件用于攻城野战；基因强化用于野地征战（机能判定）。\n两套独立养成、整套切换生效 —— 点右侧按钮切换当前生效套。'
        : '机甲部件用于攻城野战。\n基因一途乃君主专属，不假他人。') +
      /* v89.191（老板 3）：「遗物与部件栏的机甲、基因并列，普通英雄只有机甲和遗物」——
         入口同排：机甲/基因是**套装切换**（gold = 当前生效套）；遗物是**挂件入口**
         （点开佩/换/卸选择窗，佩有遗物时按钮高亮）。
         普通英雄只有「⚙ 机甲（静态金刚，本就是他唯一的生效套）」+「🔮 遗物」——
         基因为君主专属（闸门 canCultivate，v89 既定），普通将不出现该按钮。 */
      '<span style="margin-left:auto;display:inline-flex;gap:4px;">' +
        (isCult
          ? '<button class="btn sm mini' + (isLing ? '' : ' gold') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="sha">机甲</button>' +
            '<button class="btn sm mini' + (isLing ? ' gold' : '') + '" data-action="toggle-equip-set" data-gen="' + genId + '" data-set="ling">基因</button>'
          : '<span class="btn sm mini gold" title="普通英雄只行机甲套装；基因一途乃君主专属">机甲</span>') +
        (isLing ? '' :
          '<button class="btn sm mini" data-action="mecha-style" data-gen="' + genId + '"'
          + ' title="切换机甲型制（' + U.escape(ui.mechaStyleOf(g).name) + '）：点选更换本品外观">型制·' + U.escape(ui.mechaStyleOf(g).name) + '</button>') +
        '<button class="btn sm mini' + (GAME.attachOf(g, 'bao') ? ' gold' : '') + '" data-action="attach-pick"'
          + ' data-gen="' + genId + '" data-slot="bao"'
          + ' title="遗物：与装备并行的增幅挂件（打据点 / 名城缴获）。点开可佩 / 换 / 卸（窗内已佩件可卸下）；窗内可合成 2 低=中 · 2 中=高">遗物</button>' +
      '</span>' +
      '</div>' +
      '<div class="gp-doll">' +
        '<div class="doll-col">' +
        '<div class="doll' + (isLing ? '' : ' doll-mechamode') + '">' +
          /* v46（需求 3）：机甲套底衬 = 机甲图；槽位 = 19 部件（对齐机甲轮廓）。
             v90.13：外挂槽落点；v90.20：`.doll-fig` 按框高自适应；
             v90.25（老板）：机甲图只承载**身体 13 槽**（cqw 随图等比）；披风 + 外挂 6 槽
             移到**框相对**的 `.doll-outer` 层 —— 用足左右留白（机甲是竖图、框有余宽）。 */
          '<span class="doll-outer">' +
            (isLing ? '' :
              ui.DOLL_MOD_SLOTS.map(function (slot) { return ui.dollSlot(g, genId, slot, inv, false, true); }).join('')) +
          '</span>' +
          '<span class="doll-fig">' +
            ui.dollPortrait(g, isLing) +
            (isLing ? DATA.LING_SLOTS_ID : DATA.EQUIP_SLOTS.filter(function (s2) {
              return !ui.DOLL_MOD_ART[s2];   /* 外挂槽在 outer 层，不进 fig */
            })).map(function (slot) { return ui.dollSlot(g, genId, slot, inv); }).join('') +
          '</span>' +
        '</div>' +
        '</div>' +
        '<div class="doll-side">' +
          '<div class="eq-gain">部件提供</div>' +
          (gainRows ? '<div class="eq-grows">' + gainRows + '</div>'
            : '<div class="eq-gain"><span class="none">尚未装备任何部位</span></div>') +
          ui.dollSetPanel(g) +
          '<div class="gp-dollops">' +
            '<button class="btn sm gold" data-action="gen-auto-equip" data-gen="' + genId + '">一键装备</button>' +
            '<button class="btn sm" data-action="gen-equip-set-pick" data-gen="' + genId + '">按套装装备</button>' +
            '<button class="btn sm" data-action="gen-unequip-all" data-gen="' + genId + '">全部卸下</button>' +
            (isLing ? '<button class="btn sm" data-action="ling-temper-open">☯ 调校</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>' +           /* gp-col-r */
      '</div>' +           /* gp-body */
      /* v54（老板："在忠诚右边加赏赐，别在下边整个大按钮"）：
         底部的「赏赐（提升忠诚）」分区整个撤掉 —— 入口已经在「状态 · 忠诚」那一行的右侧，
         珠宝种类数/持件数/当前忠诚都在按钮的悬停提示里，不必再占一块版面。 */
      '';

    return html + '</div>';
  };

  /* 赏赐选择窗：挑珠宝 → 挑件数 → 赏。
     可选项来自 DATA.ITEMS + state.items，这里不复制任何配置（加新珠宝自动出现）。 */
  ui.openGiftPick = function (genId) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var jewels = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'jewel' && (s.items || {})[it.id] > 0;
    });
    if (!jewels.length) { ui.toast('背包中暂无珠宝'); return; }
    ui._modalKind = 'gift';
    var want = (ui._giftPick || {})[genId];
    var pick = jewels[0].id;
    jewels.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    jewels.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var loy = Math.round(g.loyalty == null ? 70 : g.loyalty);
    var q = Math.max(1, Math.min(have, Number((ui._giftQ || {})[genId]) || 1));
    var cap = DATA.LOYALTY.cap || 100;
    var after = Math.min(cap, loy + q * (it.loyalty || 0));
    ui.openShell({
      title: '🎁 赏赐 · ' + U.escape(g.name),
      sub: '珠宝提升忠诚　当前忠诚 ' + loy + '　上限 ' + cap,
      size: 'sm',
      body: '<div class="ui-sub">选珠宝</div>' +
        '<div class="gd-chips">' + jewels.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="gift-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">忠+' + x.loyalty + '</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('gift-q-' + genId, q, 0, have) +
          '<span class="op-hint">赏 <b>' + q + '</b> 件　忠诚 ' + loy + ' → <b>' + after + '</b>' +
            (q >= have ? '（已用满持有）' : '') + '</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-gift-do" data-gen="' + genId + '" data-item="' + pick +
          '" data-qty-from="gift-q-' + genId + '">赏赐 ' + q + ' 件</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setGiftItem = function (genId, itemId) {
    ui._giftPick = ui._giftPick || {};
    ui._giftPick[genId] = itemId;
    ui._giftQ = ui._giftQ || {};
    ui._giftQ[genId] = 1;                      /* 换珠宝 → 件数回 1（新珠宝持有数不同） */
    ui.openGiftPick(genId);
  };

  /* 体力 / 精力道具选择窗（v89.131 · 老板「体力精力应当设计加号按钮，供道具使用，参考赏赐」）
     ------------------------------------------------------------
     与赏赐/经验两窗同一套做法：可选项直接来自 DATA.ITEMS + 背包（以后加道具自动出现），
     「用几个」在窗里选；英雄页上只留一个 ＋。
     kind: 'sta'（stamina 族 · 体力）/ 'energy'（energy 族 · 精力）—— 一个出口管两个池子。
     上限/当前一律走唯一出口（energyMaxOf/energyNowOf · staMax/staNow），不另算一份。 */
  ui.openRestorePick = function (genId, kind) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var isEn = (kind === 'energy');
    var type = isEn ? 'energy' : 'stamina';
    var cfg = isEn
      ? { label: '精力', maxOf: GAME.energyMaxOf, nowOf: GAME.energyNowOf }
      : { label: '体力', maxOf: GAME.staMax, nowOf: GAME.staNow };
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === type && (s.items || {})[it.id] > 0;
    });
    if (!items.length) { ui.toast('背包中暂无' + cfg.label + '道具'); return; }
    ui._modalKind = 'restore';
    ui._restorePick = ui._restorePick || {};
    var key = genId + '|' + kind;
    var want = ui._restorePick[key];
    var pick = items[0].id;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var mx = cfg.maxOf(g), now = Math.round(cfg.nowOf(g));
    var q = Math.max(1, Math.min(have, Number((ui._restoreQ || {})[key]) || 1));
    var after = Math.min(mx, now + q * Math.round((it.amount || 0) * mx));
    ui.openShell({
      title: '💊 ' + cfg.label + '道具 · ' + U.escape(g.name),
      sub: '按上限百分比回复　当前 ' + now + ' / ' + mx,
      size: 'sm',
      body: '<div class="ui-sub">选道具</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') + '" data-action="restore-pick-item"' +
            ' data-gen="' + genId + '" data-kind="' + kind + '" data-item="' + x.id + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">回' + Math.round((x.amount || 0) * 100) + '%</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-row">' +
          ui.qtyInput('restore-q-' + kind + '-' + genId, q, 0, have) +
          '<span class="op-hint">用 <b>' + q + '</b> 件　' + cfg.label + ' ' + now + ' → <b>' + after + '</b>' +
            (q >= have ? '（已用满持有）' : '') + '</span>' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-restore-do" data-gen="' + genId + '" data-kind="' + kind +
          '" data-item="' + pick + '" data-qty-from="restore-q-' + kind + '-' + genId + '">使用 ' + q + ' 件</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };
  ui.setRestoreItem = function (genId, kind, itemId) {
    ui._restorePick = ui._restorePick || {};
    ui._restorePick[genId + '|' + kind] = itemId;
    ui._restoreQ = ui._restoreQ || {};
    ui._restoreQ[genId + '|' + kind] = 1;   /* 换道具 → 件数回 1（新道具回复量不同） */
    ui.openRestorePick(genId, kind);
  };

  /* 经验道具选择窗（v54 · 老板：经验条右端「＋」点开）。
     与赏赐选择窗同一套做法：可选项直接来自 DATA.ITEMS + state.items，不复制配置
     （以后加经验道具自动出现）；「用几个」在弹窗里选，英雄页上只留一个 ＋。
     两种用法保留：用 1 个 / 用到升级（后者由 systems 自己算够不够）。 */
  ui.openExpPick = function (genId) {
    var s = GAME.state;
    var g = null;
    (s.generals || []).forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var items = (DATA.ITEMS || []).filter(function (it) {
      return it.type === 'exp' && (s.items || {})[it.id] > 0;
    });
    var help = ui.help('经验来自出征、侦察、占领城市；也可在「游商 · 经验」购买练兵数据 / 治军手册 / 兵道遗篇 / 战史全典。'
      + '\n经验道具**不设等级限制**（v89.173）：任何等级都能用，一次加固定经验。');
    ui._modalKind = 'exp';             /* 认窗标记：用完道具要按新经验重画这一扇 */
    /* v66（老板）：「英雄等级到上限后不能再使用经验道具」——
       到上限时**根本不给"用几个"的按钮**，只把原因说清楚（资质决定上限）。
       入口本身仍然可点：v45 的教训是"功能像是不存在"比"功能被禁用"更糟。 */
    var blk = GAME.expBlockOf(g);
    if (blk) {
      ui.openShell({
        title: '📖 用经验道具 · ' + U.escape(g.name),
        sub: 'Lv' + g.level + ' / ' + GAME.genLevelCap(g),
        size: 'sm',
        body: '<div class="q-empty">' + U.escape(blk) + '。' +
          ui.help('提升上限只能换更高资质的英雄：凡人 60 · 突变体 100 · 进化体 140 · 觉醒体 180 · 天启体 240。'
            + '\n⚠️ 征召大厅只招得到**进化体及以下**；觉醒体 / 天启体要用**血清升档**（基因实验室产出）。'
            + '\n手里的经验道具留着给别的英雄。') + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    if (!items.length) {
      ui.openShell({
        title: '📖 用经验道具 · ' + U.escape(g.name),
        sub: '当前经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(GAME.expNeedOf(g), 0),
        size: 'sm',
        body: '<div class="q-empty">背包中暂无经验道具。' + help + '</div>',
        foot: '<div class="m-foot"><button class="btn" data-action="close-modal">关闭</button></div>'
      });
      return;
    }
    /* v89.173（老板「不作等级限制」）：撤 v89.171 的逐档上限（变暗 / toast / 全到线空态）——
       任何档位都可用；卡面 = 名字 ×持有 +X万（面额短写，全族整数万）。 */
    var want = (ui._expPick || {})[genId];
    var pick = null;
    items.forEach(function (x) { if (x.id === want) pick = x.id; });
    if (!pick) pick = items[0].id;
    var it = null;
    items.forEach(function (x) { if (x.id === pick) it = x; });
    var have = s.items[pick] || 0;
    var expNeed = GAME.expNeedOf(g);
    var leftExp = Math.max(0, expNeed - (g.exp || 0));
    var one = it ? (it.amount || 0) : 0;
    var toLevel = one > 0 ? Math.ceil(leftExp / one) : 0;
    ui.openShell({
      title: '📖 用经验道具 · ' + U.escape(g.name),
      sub: 'Lv' + g.level + '　经验 ' + U.numText(g.exp || 0, 0) + ' / ' + U.numText(expNeed, 0) +
        '　距 Lv' + (g.level + 1) + ' 还需 ' + U.numText(leftExp, 0) + help,
      size: 'sm',
      body: '<div class="ui-sub">选道具（用了直接加固定经验 · 不设等级限制）</div>' +
        '<div class="gd-chips">' + items.map(function (x) {
          return '<button class="btn sm' + (x.id === pick ? ' gold' : '') +
            '" data-action="exp-pick-item"' +
            ' data-gen="' + genId + '" data-item="' + x.id + '"' +
            ' title="' + U.escape('英雄经验 +' + U.numText(x.amount || 0, 0)) + '">' +
            U.escape(x.name) + ' <i class="gd-sub">×' + (s.items[x.id] || 0) + '</i>' +
            ' <i class="gd-sub">+' + Math.round((x.amount || 0) / 10000) + '万</i></button>';
        }).join('') + '</div>' +
        '<div class="op-zone" style="margin-top:12px;"><div class="op-hint">' +
        '「用到升级」= 一直吃到升过当前等级（持有不够就全吃完）；跨级后需要重新点。' +
        '</div></div>',
      foot: '<div class="m-foot">' +
        '<button class="btn gold" data-action="gen-exp-item" data-mode="one" data-gen="' + genId +
          '" data-item="' + pick + '">用 1 个</button>' +
        '<button class="btn gold" data-action="gen-exp-till" data-mode="till" data-gen="' + genId +
          '" data-item="' + pick + '"' + (toLevel > have ? ' title="持有 ' + have + ' 个，不够一路升上去"' : '') +
          '>用到升级</button>' +
        '<button class="btn" data-action="close-modal">取消</button></div>'
    });
  };

  ui.setExpItem = function (genId, itemId) {
    /* 闸门预检（v66 起）：不可用就不静默 —— toast 说明原因（v89.173 后只可能是资质上限） */
    var gE = null;
    (GAME.state.generals || []).forEach(function (x) { if (x.id === genId) gE = x; });
    var itE = null;
    (DATA.ITEMS || []).forEach(function (x) { if (x.id === itemId) itE = x; });
    if (gE && itE && GAME.expItemGrantOf) {
      var gtE = GAME.expItemGrantOf(gE, itE);
      if (!gtE.ok) { ui.toast(gtE.msg); return; }
    }
    ui._expPick = ui._expPick || {};
    ui._expPick[genId] = itemId;
    ui.openExpPick(genId);
  };


  /* 下方档案：选中英雄的完整速览（六维表 + 状态栏 + 操作） */
  /* UI.v41: genDetailBlock-gone —— 内容已并入 ui.genPane 的右侧栏 */


  /* v90.97（老板）：英雄页**只列本城** —— 英雄归属城市，派遣改变归属（调到别城则在本城消失、在彼城出现）。
     旧「本城 / 全境」切换整条退役（老板："本境还看到了所有英雄"）。 */
  ui.generalsHTML = function () {
    var s = GAME.state;
    var cur = GAME.currentCity();
    /* 英雄归属判据走 GAME.genCityOf（唯一出口）：cityId 为空的英雄归当前城，
       不会因为"没写归属"就从名单里消失 */
    var pool = (s.generals || []).filter(function (g) {
      var gc = GAME.genCityOf(g);
      return !!(gc && cur && gc.id === cur.id);
    });
    /* v89.80（老板）：「默认按等级从大到小排序」——
       排序放在**分页之前**（否则"第 1 页"里也不是最强者），并带姓名次键
       （同等级按姓名，避免顺序随对象引用抖动、每次重开面板都换位）。 */
    pool = pool.slice().sort(function (a, b) {
      return ((b.level || 1) - (a.level || 1))
        || String(a.name || '').localeCompare(String(b.name || ''), 'zh');
    });
    /* v64（老板）：「根据**该城的英雄枢纽等级**有相应空位」—— 席位按城。 */
    var cap = GAME.genSlotsOf(cur);
    /* v76（老板）：「12个空格每页…超过12个英雄自动翻页」—— 每页固定 12 席。 */
    var pg = ui.pageOf('gen', pool.length, ui.GEN_PER);
    /* 选中英雄：默认第一位；无效（被解雇/换档/换城）时回落 */
    var sel = null;
    pool.forEach(function (g) { if (g.id === ui._genSel) sel = g; });
    if (!sel) sel = pool[pg.from] || pool[0] || null;
    ui._genSel = sel ? sel.id : null;

    var rows = [];
    for (var i = 0; i < ui.GEN_PER; i++) {
      var gi = pg.from + i;
      rows.push(ui.genRow(pool[gi], gi, cap, ui._genSel));
    }
    if (pg.maxPage > 1) ui.pagerHTML('gen', pool.length, ui.GEN_PER);

    return '<div class="ui-page">' +
      '<div class="gold-heading">英雄' +
        ui.help('左侧点姓名切换英雄；右侧即其**全部**档案与部件栏（不再另开弹窗）\n' +
          '**只列本城英雄**：英雄归属城市，派遣（出征→调兵）改变归属 —— 调到别城则在本城消失、在彼城出现\n' +
          '席位**按城算**：每座城的上限 = 该城英雄枢纽等级（+建筑专精：每档 +2，满三档 +6）；0 级 = 0 席\n' +
          '已超编不会清退现有英雄，但**招募/调入**须先建或升级英雄枢纽\n' +
          '英雄先在征召大厅招募（本城征召大厅 + 本城空位），也可「城市面板 → 英雄派遣」从别城调入\n' +
          '左侧清单每页 12 席；超过 12 位英雄时在底部导航条翻页') +
      '</div>' +
      '<div class="gen-split">' +
        '<div class="gen-list">' + rows.join('') + '</div>' +
        ui.genPane(sel) +
      '</div>' +
      '</div>';
  };


  /* ============================================================
   * 英雄属性详情（v14.1）
   * 单个英雄的完整档案：资质 / 四维拆分（基础+装备+套装）/ 战斗属性 /
   * 忠诚与状态 / 守将效果 / 装备概览 / 赏赐 / 操作入口
   * 入口：英雄列表点姓名，或操作列「详情」
   * ============================================================ */
  /* ⛔ v158.13（S4）退役：城外「改建」选择面板（v19 需求 8）。
     一块地能建哪种厂由地形资源决定（森林→生物质→水培温室），"改成另一种"
     在新模型里没有合法目标 —— 要换用途就拆（dismantlePlant 返还半数）再建。
     原入口：城外地块面板「🔧 改建为其他资源建筑」→ main.js 'ext-convert-ask'。 */

  /* ------------------------------------------------------------
   * 英雄详情（v26 · 需求 1/2 重排）
   * ------------------------------------------------------------
   * 版面：**左头像 · 右五维**。原先头像是竖排里的一大块、属性表在它下面，
   *       看完"是谁"要往下滚才看到"多强"；现在两栏并排，一眼同时读完。
   * 五维：只呈现**一个值** —— 基础 + 装备 + 战斗符，全部求和后的结果。
   *   · 删「装备/丹」列：丹药是**永久加到基础里**的（嗑过药当然就是基础），
   *     单列一列会让人以为还要再加一次；这在旧代码里还真的重复加了（见 domain.genAttrs）。
   *   · 删「合计」列：只剩一个数时，"合计"二字没有意义。
   *   · 「作用」不再拼计算值 —— 写"全军攻击 +86%"会随装备与等级一直变，
   *     那句话读起来像"作用"，其实是"当前值"。改写成该维度的**固定功能说明**，
   *     实时数值集中到下方「当前效果」一栏。
   * 速度升为第五维（求和计算，见 battle.firstStrike / march.speedFactor）。
   * ------------------------------------------------------------ */
  /* 五维定义：作用一律写「每点」，且与代码里的消费点一一对应，不是估算。
     指挥 → battle.js covered(tong*100) / domain.js maxPopOf(tong*1000)
     武力 → atkMult = 1 + a.atkPct × cover（atkPct = 武力×0.0005 + 装备攻值/1000；v89.96）
     谋略 → battle.js defBonus / defMult += a.defPct（同上）
     治理 → domain.js guardBonus prod / build = nz/100
     速度 → battle.js firstStrike（a += spd）、battle.js march.speedFactor（× (1+spd/300)） */
  /* v65（老板）：「压缩一下六维的作用单元格长度，指挥这些属性名都成 2 行了，占空间」——
     原因不是名字长，而是**作用列太长把第一列挤没了**（表格自动分配宽度时，
     内容多的一列抢走空间，"指挥"两个字就被迫折行）。
     处置两条：① 文案改短句（下列 `use`）；② CSS 里给第一列固定宽 + nowrap（见 index.html）。
     文案短了但**意思不变**：每个数字都仍与代码里的常量一一对应，
     `smoke` 那条"常量与文案一致性"断言照旧守着。 */
  ui.GEN_DIMS = [
    /* v74（老板需求 1）：「带兵 +100 · 幸存者上限 +1000」里的**幸存者上限那半条已撤**
       （幸存者只由居所决定）；作用文案现在走六维名称的悬停。 */
    { k: 'tong', n: '指挥', color: '#d8b04e', use: '覆盖100兵/点＋溢出减伤；3000开二阵' },
    /* v52（老板给定换算链）→ v89.96 改双刻度（见 domain.js atkPctOf 注释）：
       武力每 20 点 +1%（无上限属性单独降率）、装备每 10 攻值 +1%（v52 保留）。
       这里写的**就是代码里的同一组常量**（GAME.YW_PCT / PCT_PER_ATK 等），
       改常量忘了改文案会被 smoke 的一致性断言拦下。 */
    { k: 'yw', n: '武力', color: '#c9705a',
      use: '全军攻击 +0.05%/点（每20点+1%）',
      /* v58：`guardUse` = 该将**现任守将**时这一维实际提供的加成（并进"作用"列）。
         映射取自 `GAME.guardBonus`：治理→产量/建造、武力→征兵、谋略→研究/城防。 */
      guardUse: function (gb) {
        return gb.train ? '守将加成：征兵 +' + Math.round(gb.train * 100) + '%' : '';
      } },
    { k: 'zm', n: '谋略', color: '#4a9be0',
      use: '全军防御 +0.05%/点（每20点+1%）',
      /* v89.113（老板需求 3）：谋略的经营项归**城主**（研究/城防） */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.research) p2.push('研究 +' + Math.round(mb.research * 100) + '%');
        if (mb.def) p2.push('城防 +' + Math.round(mb.def * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },
    { k: 'nz', n: '治理', color: '#7fa85a', use: '本城产量 +1%',
      /* v89.113：治理的经营项归**城主**（产量/建造）
         v89.162（老板「内政对税收也应有加成」）：第三处落点 —— **税收**。 */
      mayorUse: function (mb) {
        var p2 = [];
        if (mb.prod) p2.push('产量 +' + Math.round(mb.prod * 100) + '%');
        if (mb.build) p2.push('建造 +' + Math.round(mb.build * 100) + '%');
        if (mb.tax) p2.push('税收 +' + Math.round(mb.tax * 100) + '%');
        return p2.length ? '城主加成：' + p2.join(' ') : '';
      } },
    { k: 'spd', n: '速度', color: '#b06fd8', use: '全军速度 +1 · 每级另 +1' },
    /* v29（需求 11）：体力升为**第六维** —— 它不再只是"出征的资格值"，
       而是直接决定全军生命的厚度（当前体力越高越耐打）。
       v52：上限成了「等级/资质/治理 + 装备与套装的体力加成」三者之和。
       v66：**表格里显示"总体体力"（= 上限）**，`val` 指定取值键 ——
       与左栏「状态 · 体力」同口径（那边把当前值写在括号里），
       否则六维显示当前值、部件栏显示装备贡献，两处又对不上。 */
    { k: 'sta', n: '体力', val: 'staMax', color: '#d98b4a',
      use: '生命渐近 +80%、高段每千 +2.5%' },
  ];

  /* UI.v41: openGenDetail-gone —— 内容已并入 ui.genPane 的右侧栏 */


  /* ============================================================
   * 英雄部件栏（逐槽更换 / 一键最优 / 全部卸下）
   * ============================================================ */
  /* ============================================================
   * 英雄人形部件栏（v38 · 需求 2）
   * ------------------------------------------------------------
   * 改前是 4 列 12 格的平铺卡片：能换装，但看不出"哪件穿在哪"。
   * 改后按**人形**摆位 —— 12 个部位贴在人形对应的身体位置上。
   * 落点集中在 ui.DOLL_POS 一张表里（改布局只动这张表，别散在模板里）。
   * ============================================================ */
  /* 落点排列成 **5 行**（每行内部靠横向分开、行与行靠纵向分开），
     这是 54px 方槽在 300×380 人形框里的唯一可行排法：
       行间距 25px，行内 3 列（11% / 50% / 78%）横向间距 ≥ 63px，
       两向都留得住 —— 换成"贴着身体部位随便放"就会出现头压颈那种重叠。
     横向留出槽位半宽（54/2 = 27px）的余量（实测 300px 宽人形框）：
       11% → 33−27 = 6 ≥ 0；78% → 234−27+54 = 261 ≤ 300。
     ⚠️ 改槽位边长或人形框尺寸，都要回来核这两组数（smoke 有一条断言按此复算两两不重叠）。 */
  /* v90.13（老板 2）：机甲 19 槽全部落进机甲图框内（左上角法）。
     身体 13（fig 相对 %）+ 外挂 6（框相对 %，见 DOLL_OUTER_POS）。
     v90.25（老板）：身体槽随机甲图（`.doll-fig`，cqw）；披风 + 外挂 6 槽放到**框相对**的
     `.doll-outer` 层，用足左右留白（机甲竖图、框有余宽）。 */
  ui.DOLL_POS = {
    head: [50, 2], chest: [50, 18], waist: [50, 34],
    arm_up_l: [21, 16], arm_up_r: [79, 16],
    arm_low_l: [15, 42], arm_low_r: [85, 42],
    thigh_l: [37, 49], thigh_r: [63, 49],
    shin_l: [37, 70], shin_r: [63, 70],
    foot_l: [37, 87], foot_r: [63, 87],
  };
  /* 外挂 6 槽：**框相对**落点（铺进左右留白）。 */
  ui.DOLL_MOD_SLOTS = ['back', 'ring', 'weapon', 'pendant', 'mount', 'neck'];
  /* v90.26（老板）：外挂项**左右各成一竖列**、大小一致 —— 左列 x=13.5%、右列 x=86.5%，
     上（披风）/中（武装）/下（机动·辐射清除）三点同列线。 */
  /* v90.49（老板 3）：外挂 6 模块改**浮层小方框** —— 贴左右两列，上/中/下三行，
     **中间留给机甲本体**；浮于 `.doll-fig`（z2 > z1）。
     v90.51（老板「机甲还是小」）：机甲按高撑满后变宽，模块**再贴到最边**（x≈6%/94%），
     与机甲双臂槽错开，互不遮挡。 */
  ui.DOLL_OUTER_POS = {
    back: [6, 15], ring: [94, 15],
    pendant: [6, 51], weapon: [94, 51],
    neck: [6, 84], mount: [94, 84],
  };
  /* 外挂模块**固定小图**（v90.49：来自散件图标，按类型固定，不随装备变 —— 见 tools/normalize_mods.py）。
     back/ring（披风）共用一张对称披风图。 */
  ui.DOLL_MOD_ART = {
    weapon: 'mod_weapon.png', pendant: 'mod_weapon.png',
    mount: 'mod_mobility.png', neck: 'mod_purge.png',
    back: 'mod_cloak.png', ring: 'mod_cloak.png',
  };
  /* 外挂模块图目录（v90.49：与旧 assets/icons/ui 分离） */
  ui.DOLL_MOD_DIR = 'assets/icons/mecha_mod/';
  /* 机甲外挂 6 槽（在机甲图下方排一条） */
  ui.DOLL_ATTACH = ['weapon', 'pendant', 'mount', 'back', 'ring', 'neck'];
  /* v90.16（老板）：「不同型制的机甲，可以按此前导入装备栏」——机甲 4 型制，
     每将通过 g.mechaStyle 选（1~4）；缺省 1（制式军绿）。 */
  ui.MECHA_STYLES = (function () {
    var names = ['制式', '重装', '装甲', '猩红', '暗红', '联邦', '蓝图', '军绿', '疾风',
      '熔岩', '铁卫', '霜蓝', '曜光', '夜幕', '苍蓝', '赤甲', '斗篷',
      '铁裔', '沙狼', '夜枭', '玄武', '赤鸢', '幽兰', '雷纹', '霜牙'];   /* v90.49：17 → 25 */
    var arr = [];
    for (var i = 1; i <= 25; i++) arr.push({ id: i, name: 'MK-' + i + '·' + (names[i - 1] || ''),
      file: 'assets/mecha/mk' + (i < 10 ? '0' + i : i) + '.png' });   /* v90.37：标准件目录 assets/mecha/ */
    return arr;
  })();
  ui.mechaStyleOf = function (g) {
    var s = Number(g && g.mechaStyle) || 1;
    return ui.MECHA_STYLES.filter(function (x) { return x.id === s; })[0] || ui.MECHA_STYLES[0];
  };
  ui.dollPortrait = function (g, isLing) {
    if (!g) return '';
    if (!isLing) {
      return '<span class="doll-portrait doll-mecha" aria-hidden="true">' +
        '<img src="' + ui.mechaStyleOf(g).file + '" alt="">' +
      '</span>';
    }
    var P = GAME.portraits;
    if (!P) return '';
    var src = P.fileOf ? P.fileOf(g) : '';
    if (src) {
      return '<span class="doll-portrait" aria-hidden="true">' +
        '<img src="' + src + '" alt="" onerror="this.parentNode.style.display=\'none\'">' +
      '</span>';
    }
    /* v89.239（复核）：池子取不到图（池被清空）→ **不铺底衬**（画框照常显示）。
       ⛔ 不许再调 P.svg（程序化立绘出口）—— v90 起该出口已随旧 portraits.js 退役，
       再调即死引用（本批复核抓出的漏网调用者，已清）。 */
    return '';
  };

  /* ⛔ v89.238：ui.dollFigure（几何人形剪影）**整条退役** —— 老板令「装备那里那个
     小人一样的简陋图去掉」。原实现（v38 建 · v46 与抠图叠加，纯几何 SVG）见
     .workbuddy/backup/v89238/ui.js.before；样式 .doll-fig-svg 同步删除。
     底衬改由 .doll-portrait 独立承担（v89.238 同时调亮至 .55 + 画框圆角裁形）。 */
  /* 基因强化 12 槽落点（旧人形布局，机甲扩槽后基因套维持原样） */
  ui.GENE_POS = {
    head: [50, 0.8],
    neck: [50, 21.6], shoulder: [22, 21.6], back: [78, 21.6],
    chest: [50, 42.4], arm: [11, 42.4],
    waist: [50, 63.2], ring: [11, 63.2], pendant: [78, 63.2],
    feet: [50, 83.9], weapon: [11, 83.9], mount: [78, 83.9],
  };
  ui.dollSlot = function (g, genId, slot, inv, inline, outer) {
    /* v90.11：机甲 13 身体槽走 DOLL_POS（对齐机甲图）；基因 12 槽走 GENE_POS。
       v90.25：outer=true = 外挂 6 槽（框相对落点，`.doll-outer` 层）。
       inline=true = 旧外挂条里的流式小槽（已退役，保留兼容）。 */
    var isLing0 = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var pos = inline ? [0, 0]
      : (isLing0 ? (ui.GENE_POS[slot] || [50, 50]) : ui.dollPosOf(slot));   /* v90.31：机甲走 dollPosOf（套编辑器覆盖） */
    if (!isLing0 && !inline && !outer && !ui.DOLL_POS[slot]) return '';   /* 身体 13 槽之外、且非外挂层 */
    var modSlot = outer && !isLing0;
    /* v90.31：编辑器改过的尺寸（%宽=高）内联覆盖 */
    ui.dollLayoutLoad();
    var _lo = ui._dollLayout[slot];
    var osize = (_lo && _lo.w != null) ? _lo.w : 0;
    /* v88：按**当前生效套**渲染（机甲/改造各 12 槽；槽名/图标/品质色/强化标全同步）。
       附带修复 v79 按件改造的一处遗漏：这里原先直接把实例对象当 DATA.EQUIP 的键
       （装着装备时 it 恒为 null → 格子丢品质色显示 empty 类）。统一走 eqId 规范化。 */
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var inst = bag[slot];
    var id = inst ? (GAME.eqId ? GAME.eqId(inst) : inst) : null;
    var it = id ? DATA.EQUIP[id] : null;
    var slotName = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var invN = inv[slot] || 0;
    var setNm = it && it.set && DATA.SETS[it.set] ? DATA.SETS[it.set].name : '';
    /* v90.49（老板 3/4）：
       · 外挂槽 = 固定**模块图**（mod_*.png，来自 DOLL_MOD_DIR），不随装备变；
       · 身体槽**不再显示所装备件的图案**（去掉 eq-ico）—— 只留部位名 + 装备名（文字）；
         所着件的图/属性只在悬停 tip 里给（tip 见下）。 */
    var isMod = modSlot && !!ui.DOLL_MOD_ART[slot];
    var modArt = isMod ? ((ui.DOLL_MOD_DIR || 'assets/icons/mecha_mod/') + ui.DOLL_MOD_ART[slot]) : '';
    var inner = isMod
      ? '<img class="eq-mod-img" src="' + modArt + '" alt="">'
      : ('<span class="eq-slotname">' + slotName + '</span>' +
         '<span class="eq-name' + (it ? '' : ' none') + '">' + (inst ? U.escape(GAME.eqLabel(inst)) : '未着') + '</span>');
    return '<div class="eq-cell doll-slot' + (inline ? ' doll-slot-inline' : '') + (isMod ? ' doll-slot-mod' : '') +
      (it ? ' q' + it.q : ' empty') + '"' +
      (inline ? '' : ' style="left:' + pos[0] + '%;top:' + pos[1] + '%"' +
        (osize ? ';width:' + osize + '%;height:' + osize + '%;margin-left:' + (-osize / 2) + '%;margin-top:' + (-osize / 2) + '%' : '')) +
      ' data-action="eq-slot" data-gen="' + genId + '" data-slot="' + slot + '" data-tip-el="1">' +
      inner +
      /* v90.50（老板 1）：机甲部件上不再显示「+N」（可供更换的件数）—— 该数字移到悬停 tip 里。 */
      /* 悬停走全站唯一的 #tip-layer（v37）—— 不在这里自己绝对定位 */
      '<span class="eq-slot-tip tip-src"><div class="tip-t">' + slotName + (inst ? ' · ' + U.escape(GAME.eqLabel(inst)) : '') + '</div>' +
        /* v89.211：按件描述（强化/调校计入；equipDescOf 为唯一出口）
           v89.214（老板 1）：分行（六维逐行 · 原始值白 + 增强值缀色） */
        (it ? ui.equipStatsHTML(inst) + ui.equipEnhNoteHTML(inst) : '<div class="tip-l">该部位未着，点击选择</div>') +
        (setNm ? '<div class="tip-a">' + setNm + ' 套装件</div>' : '') +
        (invN ? '<div class="tip-a">背包另有 ' + invN + ' 件可换</div>' : '') +
      '</span></div>';
  };
  /* ============================================================
   * v90.31（老板：「能不能直接在界面上移动/缩放」）—— **开发用布局编辑器**。
   * 拖拽移位 / 滚轮缩放每个部件槽，落 localStorage（渲染时套用），可一键输出数值固化进代码。
   * 开关：控制台 `ui.dollEdit(true/false)`，或 URL 带 `?dollEdit=1`。
   * 输出：编辑器工具条「📋 输出布局」→ 打印到控制台 + 复制到剪贴板。
   * ⚠️ 仅开发期使用；玩家不触发（不进设置/界面入口）。
   * ============================================================ */
  ui.dollDefPos = function (slot) {
    return ((ui.DOLL_MOD_SLOTS || []).indexOf(slot) >= 0 ? ui.DOLL_OUTER_POS : ui.DOLL_POS)[slot];
  };
  ui._dollLayout = null;
  ui.dollLayoutLoad = function () {
    if (ui._dollLayout) return ui._dollLayout;
    try { ui._dollLayout = JSON.parse((window.localStorage || {}).getItem('biztrip_doll_layout') || '{}') || {}; }
    catch (e) { ui._dollLayout = {}; }
    return ui._dollLayout;
  };
  ui.dollLayoutSave = function () {
    try { window.localStorage.setItem('biztrip_doll_layout', JSON.stringify(ui._dollLayout || {})); } catch (e) {}
  };
  ui.dollPosOf = function (slot) {
    ui.dollLayoutLoad();
    var o = ui._dollLayout[slot];
    if (o && o.x != null) return [o.x, o.y];
    return ui.dollDefPos(slot) || [50, 50];
  };
  ui.dollEdit = function (on) {
    var wrap = document.querySelector('.gp-doll .doll');
    if (ui._dollEditCleanup) { ui._dollEditCleanup(); ui._dollEditCleanup = null; }
    if (!on || !wrap) return;
    ui.dollLayoutLoad();
    var slots = [].slice.call(wrap.querySelectorAll('.doll-slot'));
    var handlers = [];
    slots.forEach(function (el) {
      var slot = el.getAttribute('data-slot');
      el.style.pointerEvents = 'auto'; el.style.cursor = 'move';
      el.style.outline = '1px dashed rgba(var(--gold-rgb),.7)';
      var drag = null;
      var md = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var r = wrap.getBoundingClientRect();
        var lo = ui._dollLayout[slot] || {};
        var cur = ui.dollPosOf(slot);
        drag = { px: ev.clientX, py: ev.clientY, x: cur[0], y: cur[1], rw: r.width, rh: r.height, el: el };
        window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
      };
      var mm = function (ev) {
        if (!drag) return;
        var nx = Math.round((drag.x + (ev.clientX - drag.px) / drag.rw * 100) * 10) / 10;
        var ny = Math.round((drag.y + (ev.clientY - drag.py) / drag.rh * 100) * 10) / 10;
        ui._dollLayout[slot] = ui._dollLayout[slot] || {};
        ui._dollLayout[slot].x = nx; ui._dollLayout[slot].y = ny;
        drag.el.style.left = nx + '%'; drag.el.style.top = ny + '%';
      };
      var mu = function () { drag = null; window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); ui.dollLayoutSave(); };
      var wh = function (ev) {
        ev.preventDefault();
        var o = ui._dollLayout[slot] = ui._dollLayout[slot] || {};
        var base = o.w || parseFloat((el.style.width) || '0') || 0;
        var w = Math.max(4, Math.min(60, (base || 22) * (ev.deltaY < 0 ? 1.06 : 0.94)));
        o.w = Math.round(w * 10) / 10;
        el.style.width = o.w + '%'; el.style.height = o.w + '%';
        el.style.marginLeft = (-o.w / 2) + '%'; el.style.marginTop = (-o.w / 2) + '%';
        ui.dollLayoutSave();
      };
      el.addEventListener('mousedown', md);
      el.addEventListener('wheel', wh, { passive: false });
      handlers.push([el, md, wh]);
    });
    ui._dollEditCleanup = function () { handlers.forEach(function (h) { h[0].removeEventListener('mousedown', h[1]); h[0].removeEventListener('wheel', h[2]); }); };
    /* 工具条 */
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:99999;background:#1a1f24;border:1px solid #c9a24b;'
      + 'border-radius:8px;padding:8px 10px;font:12px/1.6 "Microsoft YaHei";color:#e8e2d4;display:flex;gap:8px;align-items:center;';
    bar.innerHTML = '<b>布局编辑</b> 拖拽移位 · 滚轮缩放'
      + '<button id="dl-dump" style="padding:2px 8px;cursor:pointer;">📋 输出布局</button>'
      + '<button id="dl-reset" style="padding:2px 8px;cursor:pointer;">↩ 清除</button>'
      + '<button id="dl-off" style="padding:2px 8px;cursor:pointer;">✕ 关闭</button>';
    document.body.appendChild(bar); ui._dollEditBar = bar;
    bar.querySelector('#dl-off').onclick = function () { ui.dollEdit(false); GAME.refreshView(); };
    bar.querySelector('#dl-reset').onclick = function () { ui._dollLayout = {}; ui.dollLayoutSave(); GAME.refreshView(); setTimeout(function () { ui.dollEdit(true); }, 50); };
    bar.querySelector('#dl-dump').onclick = function () { ui.dollEditDump(); };
  };
  ui.dollEditDump = function () {
    ui.dollLayoutLoad();
    var body = ['/* ===== 布局编辑器输出（固化进 ui.DOLL_POS / DOLL_OUTER_POS + 尺寸 CSS）====='];
    var posBody = [], outBody = [];
    Object.keys(ui._dollLayout).forEach(function (slot) {
      var o = ui._dollLayout[slot]; if (o.x == null) return;
      var line = "    " + slot + ": [" + o.x + ", " + o.y + "],";
      ((ui.DOLL_MOD_SLOTS || []).indexOf(slot) >= 0 ? outBody : posBody).push(line);
    });
    if (posBody.length) body.push('  ui.DOLL_POS = {', posBody.join('\n'), '  };');
    if (outBody.length) body.push('  ui.DOLL_OUTER_POS = {', outBody.join('\n'), '  };');
    var sz = Object.keys(ui._dollLayout).filter(function (k) { return ui._dollLayout[k].w != null; })
      .map(function (k) { return '    ' + k + ": " + ui._dollLayout[k].w + "%,  /* 宽=高 */"; });
    if (sz.length) body.push('  /* 尺寸（%宽=高，见 .doll-slot-mod / .doll-cape-slot） */', sz.join('\n'));
    var text = body.join('\n');
    console.log(text);
    try { navigator.clipboard.writeText(text); } catch (e) {}
    if (ui.toast) ui.toast('布局已输出（控制台 + 剪贴板）');
  };
  /* URL ?dollEdit=1 自动开（开发用） */
  try { if (/[?&]dollEdit=1/.test((window.location || {}).search || '')) setTimeout(function () { ui.dollEdit(true); }, 800); } catch (e) {}
  ui.dollLingPanel = function (g) {
    var s = GAME.state;
    var ess = (s.items || {}).lingsui || 0;
    var bag = g.lingEquip || {};
    var cnt = Object.keys(bag).length, total = 0;
    for (var k in bag) total += (GAME.eqEnhOf(bag[k]) || 0);
    var ling = GAME.lingPowerOf ? GAME.lingPowerOf(g) : 0;
    return '<div class="doll-set">' +
      '<div class="ds-block">' +
        '<div class="ds-head"><span class="ds-name">🧬 基因强化</span><span class="ds-n">' + cnt + ' / 12 件</span></div>' +
        '<div class="ds-tiers">' +
          '<i class="on"><b>机能</b>' + ling + '</i>' +
          '<i><b>总调校</b>+' + total + ' / 120</i>' +
          '<i><b>辐能核心</b>' + ess + '</i>' +
        '</div>' +
      '</div>' +
      '<div class="ds-empty">机能用于野地征战判定；调校每级改造属性 +12%~+20% 递增（辐能核心 · 野地采集与征战所得）。' +
        '　<button class="btn sm gold" data-action="ling-fuse-open">🧬 融合淬体</button></div>' +
    '</div>';
  };
  /* 套装进度面板：件数 + 四档（已达/未达）+ 下一档提示
     v88：改造侧无套装档 —— 直接转 dollLingPanel（机能/调校面板） */
  ui.dollSetPanel = function (g) {
    if (g.equipOn === 'ling' && GAME.canCultivate(g)) return ui.dollLingPanel(g);
    var prog = GAME.setProgressOf(g);
    var active = prog.filter(function (p) { return p.n > 0; });
    var out = '<div class="doll-set">';
    if (!active.length) {
      out += '<div class="ds-empty">未着套装件。套装件每满 <b>'
        + (DATA.SET_TIERS || []).join(' / ') + '</b> 件升一档，<b>只生效已达成的最高一档</b>。</div>';
    }
    active.forEach(function (p) {
      /* v90.32（老板）：「只显示当前生效的属性即可，比如满足 7 件，仅展示 7 件的套装效果，
         其他更低级或高级的效果不罗列」—— 取已达成档位里**最高**那个，只显示它。 */
      var reached = (p.tiers || []).filter(function (t) { return p.n >= t; });
      var curT = reached.length ? reached[reached.length - 1] : 0;
      out += '<div class="ds-block">' +
        '<div class="ds-head"><span class="ds-name">' + p.name + '</span>' +
          '<span class="ds-n">' + p.n + ' / ' + p.total + ' 件</span></div>' +
        (curT
          ? '<div class="ds-cur"><i class="on"><b>' + curT + ' 件</b>' + p.bonus[curT] + '</i></div>'
          : '<div class="ds-empty">未满 ' + ((p.tiers || [])[0] || '?') + ' 件，暂无档位加成</div>') +
        '</div>';
    });
    /* v52（老板：「装备那里不需要列出其余套装的备注」）：
       这里原本还会列一段「其余套装：佣兵套（11 件）…加成…」—— 把没穿的套装也铺出来，
       信息量大但**与本将无关**（要凑别的套是另一回事，去制造厂的套装表看）。
       整段删掉，只留本将**已着**套装件的进度。 */
    return out + '</div>';
  };

  /* v41（需求 2）：部件栏不再单独弹窗 —— 内容已并入 ui.genPane 的右侧栏。
     这里保留一个**同源**入口：切到英雄页并选中该将，
     保证「任何地方点装备都到同一处」。
     （旧实现是第二个弹窗，与右侧栏各维护一份渲染逻辑 ——
      正是本项目最常见的失效模式「同一份数据两个来源」。） */
  // UI.v41:openGenEquip-no-modal
  ui.openGenEquip = function (genId) {
    ui._genSel = genId;
    if (ui.view !== 'generals') ui.setView('generals');
    else GAME.refreshView();
  };


  /* 拆毁二次确认（城内/城外通用） */
  ui.openDemolishConfirm = function (kind, idx) {
    var s = GAME.state, c = GAME.currentCity();
    var name, lv, back;
    if (kind === 'ext') {
      var e = GAME.extGridOf(c)[idx];
      if (!e || !e.type) { ui.toast('该地块无建筑'); return; }
      var eb = DATA.EXT_BUILDINGS[e.type];
      name = eb.name; lv = e.lv; back = GAME.demolishExtRefund(idx);
    } else {
      var cell = GAME.cellOf(c, idx);   /* v89.128：'wall' 槽同样生效 */
      if (!cell || !cell.build) { ui.toast('该地块无建筑'); return; }
      var b = DATA.BUILDINGS[cell.build.id];
      name = b.name; lv = cell.build.lvl; back = GAME.demolishRefund(c, idx);
    }
    /* v76（老板）：「拆除（1级，只能逐级拆除）」——
       城内是**降 1 级**（Lv1 才整座移除）；城外仍为整座拆毁（未动）。 */
    var isCity = (kind !== 'ext');
    var html = '<div class="gold-heading">' + (isCity
      ? ('拆 1 级 · ' + U.escape(name) + ' Lv' + lv + (lv > 1 ? ' → Lv' + (lv - 1) : '（整座移除）'))
      : ('拆毁 ' + U.escape(name) + ' Lv' + lv)) + '</div>';
    html += '<div class="attr"><span class="k">返还</span><span class="v good">' + (back ? GAME.costString(back) : '—') + '</span></div>';
    html += '<div class="note">' + (isCity
      ? '逐级拆除：每次只降 1 级，返还本步投入的 50%；拆到 Lv1 再拆即整座移除（腾出地块）。'
      : '返还按<b style="color:var(--gold-light)">累计投入的 50%</b> 计算，损失不可追回。') + '</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="demolish-do" data-kind="' + kind + '" data-idx="' + idx + '">' + (isCity && lv > 1 ? '确定拆 1 级' : '确定拆毁') + '</button>'
      /* v91.15（老板 3）：城内建筑 ≥Lv2 时，加「拆毁」——**直接整座拆除**（不分级）。 */
      + (isCity && lv > 1 ? '<button class="btn red" data-action="demolish-whole-do" data-kind="' + kind + '" data-idx="' + idx + '" title="直接整座拆除（不分级），返还累计投入的 50%">拆毁（整座）</button>' : '')
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 解雇二次确认 */
  ui.openDismissConfirm = function (genId) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var a = GAME.genAttrs(g);
    var eq = [];
    ['equip', 'lingEquip'].forEach(function (bk) {   /* v88：两套合并列出 */
      for (var sl in (g[bk] || {})) {
        var it2 = DATA.EQUIP[GAME.eqId(g[bk][sl])];
        if (it2) eq.push(it2.name);
      }
    });
    var html = '<div class="gold-heading">解雇 ' + U.escape(g.name) + '</div>';
    html += '<div class="attr"><span class="k">资质</span><span class="v">' + ui.rankBadge(g) + '</span></div>';
    html += '<div class="attr"><span class="k">等级</span><span class="v">Lv' + g.level + '</span></div>';
    html += '<div class="attr"><span class="k">四维</span><span class="v">统' + a.tong + ' 勇' + a.yw + ' 智' + a.zm + ' 政' + a.nz + '</span></div>';
    html += '<div class="note">离去后其装备（' + (eq.length ? eq.join('、') : '无') + '）将全数归还背包。<br>'
      /* v89.188（老板 3）：文案中性化（「英雄」字样撤；扣声望 −50 的机制与告知保留） */
      + (g.hero ? '<b style="color:var(--red-light)">其声望素著，离去将折损声望 −50。</b><br>' : '')
      + '民心 −2。此操作不可撤销，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="dismiss-gen-do" data-gen="' + genId + '">确定解雇</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* ============================================================
   * v89.110（老板）：「怎么能把危险按钮放在容易误触的位置…这种人机交互理念符合常理吗？」
   * ------------------------------------------------------------
   * 全站销毁性动作的**统一处置**（复核表见 docs/_史料/交付/v89110-危险动作复核与上限核对.md）：
   *   · 两段式：触发按钮 `xxx-ask` → 确认弹窗（写明失去什么 / 返还什么 / 能否撤销）
   *     → 红按钮 `xxx-do`。触发端**没有**一键直达的口子。
   *   · 触发按钮不与高频正向动作并排紧邻（解散移出训练行、单独成「危险操作」区）。
   *   · 可逆 / 低损动作（卸装、撤回行军、交易站买卖）保持一键 —— 不为形式加摩擦。
   * ============================================================ */

  /* 解散驻军（兵种）—— 归农返还幸存者、军资不退（不可撤销） */
  ui.openDisbandConfirm = function (troopId, count) {
    var c = GAME.currentCity();
    var t = DATA.TROOPS[troopId];
    if (!c || !t) { ui.toast('参数错误：未知兵种'); return; }
    var have = (c.army && c.army[troopId]) || 0;
    if (have <= 0) { ui.toast('本城没有' + t.name + '可解散'); return; }
    var n = Math.min(have, Math.max(1, Math.floor(Number(count) || 1)));
    var back = Math.floor(n * (t.pop || 0) * ((DATA.DISBAND || {}).popReturn == null ? 1 : DATA.DISBAND.popReturn));
    var html = '<div class="gold-heading">🕊 解散 ' + U.escape(t.name) + ' ×' + U.fmt(n) + '</div>';
    html += '<div class="attr"><span class="k">本城驻军</span><span class="v">' + U.fmt(have) + ' → ' + U.fmt(have - n) + '</span></div>';
    html += '<div class="attr"><span class="k">归农返还</span><span class="v good">+' + U.fmt(back) + ' 幸存者</span></div>';
    html += '<div class="attr"><span class="k">军资</span><span class="v" style="color:var(--red-light);">不退</span></div>';
    html += '<div class="note">解散的部队归农（幸存者入库），<b>不返还募兵时消耗的军资</b>。此操作不可撤销，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="troop-disband-do" data-troop="' + troopId + '" data-n="' + n + '">确定解散 ×' + U.fmt(n) + '</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };

  /* 拆解回收（装备）—— 该件销毁，只回收 40% 打造材料（不可撤销） */
  ui.openSalvageConfirm = function (ref) {
    var inst = GAME.eqFind(ref);
    if (!inst) { ui.toast('背包中没有这件装备'); return; }
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var mats = GAME.forgeMaterials(itemId), mtx = [];
    for (var mk in mats) {
      mtx.push((DATA.MATERIAL_BY_ID[mk] ? DATA.MATERIAL_BY_ID[mk].name : mk)
        + '×' + Math.max(1, Math.floor(mats[mk] * (DATA.FORGE.salvageRate || 0.4))));
    }
    var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;   /* 与列表入口同一取键口径 */
    var html = '<div class="gold-heading">♻ 拆解回收 · ' + U.escape(it.name) + '</div>';
    html += '<div class="attr"><span class="k">将回收</span><span class="v good">' + (mtx.join('、') || '—') + '</span></div>';
    html += '<div class="attr"><span class="k">这件装备</span><span class="v" style="color:var(--red-light);">销毁（不可撤销）</span></div>';
    html += '<div class="note">拆解后该件从背包消失，只回收 40% 打造材料。想留着就点<b>取消</b>。</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="salvage-equip-do" data-key="' + key + '">确定拆解</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };
  /* v90.55（老板）：出售装备二次确认 —— 该件从背包消失、换回旧币（入当前城）。 */
  ui.openSellConfirm = function (ref) {
    var inst = GAME.eqFind(ref);
    if (!inst) { ui.toast('背包中没有这件装备'); return; }
    var itemId = GAME.eqId(inst), it = DATA.EQUIP[itemId];
    if (!it) { ui.toast('无此装备'); return; }
    var price = GAME.equipSellPrice(itemId);
    var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : itemId;
    var city = GAME.currentCity();
    var html = '<div class="gold-heading">💰 出售 · ' + U.escape(GAME.eqLabel(inst)) + '</div>';
    html += '<div class="attr"><span class="k">可得</span><span class="v good">' + U.fmt(price) + ' 旧币</span></div>';
    html += '<div class="attr"><span class="k">入账</span><span class="v">' + (city ? U.escape(city.name) : '当前城') + '</span></div>';
    html += '<div class="note">售出后该件从背包消失（不可撤销）。想换成材料请改用<b>拆解回收</b>。</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn gold" data-action="sell-equip-do" data-key="' + key + '">确定出售</button>'
      + '<button class="btn" data-action="close-modal">取消</button></div>';
    ui.openModal(html);
  };
  /* 撤回采集（无收益）—— 兵力归还、本轮采集作废 */
  /* ============================================================
   * ⛔ v89.138（老板 0）：`ui.openGatherAbandonAsk`（撤回采集队确认面板）整条退役 ——
   * 老板：「召回不是从采集变成驻军，而是**采集中的军队回到城市**」。
   * 采集与驻军在 v89.136 已合并（兵在驻军 · 原地开工），"撤回采集队"与"撤回驻军"
   * 本就是同一件事 —— 全站「召回」统一走 `wild-withdraw`（撤回驻军 = 停采 + 兵将回城），
   * 并带**两段确认**（上膛式，见 main.js）。
   * 域侧 `GAME.abandonGather`（单纯停采）**保留**：`doWildWithdraw` 内部照旧调用它
   * （满 1 小时先自动收获，不足 1 小时直接停）。
   * 如需恢复：本段代码见 `backup/v89138/ui.js`。 */

  /* 取消建造 / 升级 —— 按剩余进度返还 80%（已投入的 20% 与已耗时间不返还） */
  ui.openCancelBuildAsk = function (kind, idx) {
    var info = GAME.cancelRefundOf ? GAME.cancelRefundOf(kind, idx) : { ok: false, msg: '' };
    if (!info.ok) { ui.toast(info.msg || '没有进行中的建造'); return; }
    var isUp = (info.q.type === 'upgrade' || info.q.type === 'ext_upgrade');
    var kn = kind === 'ext' ? '城外' + (isUp ? '升级' : '建造') : (isUp ? '升级' : '建造');
    var html = '<div class="gold-heading">⏹ 取消' + kn + '</div>';
    html += '<div class="attr"><span class="k">按剩余进度返还</span><span class="v good">'
      + U.fmt(info.total) + ' 资源（' + Math.round(info.remainRatio * 80) + '%）</span></div>';
    html += '<div class="note">已投入的 20% 与已耗时间<b>不返还</b>。取消后地块空出，是否确定？</div>';
    html += '<div class="panel-foot">'
      + '<button class="btn red" data-action="cancel-build-do" data-kind="' + kind + '" data-idx="' + idx + '">确定取消</button>'   /* v89.128：'wall' 原样透传（旧写法把非数字洗成 0） */
      + '<button class="btn" data-action="close-modal">继续施工</button></div>';
    ui.openModal(html);
  };

  /* ⛔ v90.92 退役：随机任务换新弹窗（openRerollRandAsk / openRerollAllAsk）随任务系统删除。 */

  ui.openEqSlot = function (genId, slot) {
    var s = GAME.state, g = null;
    s.generals.forEach(function (x) { if (x.id === genId) g = x; });
    if (!g) { ui.toast('英雄不存在'); return; }
    var isLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var bag = (isLing ? g.lingEquip : g.equip) || {};
    var curInst = bag[slot];
    var cur = curInst ? DATA.EQUIP[GAME.eqId(curInst)] : null;
    var cand = (s.inventory || []).filter(function (x) {
      var it = DATA.EQUIP[GAME.eqId(x)];
      return it && it.slot === slot && (!!it.ling === isLing);   /* v88：只列本套件 */
    });
    /* v79：候选是一次**件**（同名各列各的，带 +N 与 甲/乙/丙 序号） */
    cand.sort(function (x, y) {
      var ix = DATA.EQUIP[GAME.eqId(x)], iy = DATA.EQUIP[GAME.eqId(y)];
      return (GAME.systems.equipScore(iy) - GAME.systems.equipScore(ix)) || (GAME.eqEnhOf(y) - GAME.eqEnhOf(x));
    });
    var slotName2 = ((isLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES) || {})[slot] || slot;
    var html = '<div class="gold-heading">' + slotName2 + ' · 更换' + (isLing ? '（🧬 基因）' : '（⚙ 机甲）') + '</div>';
    html += '<div class="attr"><span class="k">当前</span><span class="v' + (cur ? ' good' : '') + '">'
      + (cur ? U.escape(GAME.eqLabel(curInst)) + '（' + U.escape(GAME.equipDescOf(curInst)) + '）' : '未着') + '</span></div>';
    if (cur) {
      html += '<div style="text-align:center;margin:8px 0;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">';
      html += '<button class="btn red" data-action="gen-unequip" data-gen="' + genId + '" data-slot="' + slot + '">卸下当前</button>';
      if (isLing) {
        /* v88：基因强化件就地调校（与机甲「熔铸强化」同位置的平行操作） */
        var lvT = GAME.eqEnhOf(curInst);
        if (lvT < GAME.lingTemperMax()) {
          var tcost = GAME.lingTemperCost(curInst);
          var tkey = GAME.eqUidOf(curInst) != null ? GAME.eqUidOf(curInst) : GAME.eqId(curInst);
          html += '<button class="btn gold" data-action="ling-temper-item" data-key="' + tkey + '">☯ 调校 +' + (lvT + 1) + '（精华 ' + tcost + '）</button>';
        } else {
          html += '<span class="op-done" style="align-self:center;">调校已圆满 +' + lvT + '</span>';
        }
      }
      html += '</div>';
    }
    if (!cand.length) {
      html += '<div class="note">背包中没有该部位的' + (isLing ? '改造' : '') + '装备。</div>';
      /* v90.56（老板）：该部位无货 → 直接引到**制造厂**、并定位到本部位。 */
      if (!isLing) {
        html += '<div style="text-align:center;margin-top:10px;">'
          + '<button class="btn gold" data-action="forge-open-slot" data-slot="' + slot + '">'
          + '⚒ 去制造厂打造「' + slotName2 + '」</button></div>';
      }
    } else {
      html += '<div class="bag-sec">背包可选 <span class="n">' + cand.length + ' 件</span></div>';
      html += '<div class="bag-grid">' + cand.map(function (inst) {
        var id = GAME.eqId(inst), it = DATA.EQUIP[id];
        var better = !cur || GAME.systems.equipScore(it) > GAME.systems.equipScore(cur);
        var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : id;
        return ui.bagCell({
          cls: 'q' + it.q, ico: GAME.icons.forEquip ? GAME.icons.forEquip(it.slot) : '',
          name: GAME.eqLabel(inst), q: it.q,
          title: GAME.eqLabel(inst) + (better ? '（优于当前）' : ''),
          lore: (GAME.qNameOf ? GAME.qNameOf(it) : '') + ' · 估值 ' + U.fmt(GAME.itemValue(id)),
          attr: GAME.equipDescOf(inst),
          /* v89.214（老板 1）：悬停分行 + 增量缀色 */
          attrHTML: ui.equipStatsHTML(inst),
          noteHTML: ui.equipEnhNoteHTML(inst),
          act: 'gen-equip-item', key: key, gen: genId,
        });
      }).join('') + '</div>';
    }
    html += '<div class="panel-foot"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html);
  };



  /* --------- 装备 --------- */
  ui._equipGen = null;
  /* v89.112（老板：「条目过多的分页」）：本函数**视图/弹窗双用** ——
       · 视图（setView('equip')）：分页条走屏幕底部条（pagerHTML）；
       · 弹窗（openEquipPanel）：底部条会被 modal-mask 盖住、**点不到**（旧账本 bug），
         改走 ui.modalPage 弹窗内分页。
     入参 inModal 由调用方声明（openPanel 的 equip 分支传 true）。 */
  ui.EQUIP_PER = 8;    /* v89.112c：装备背包每页 8 件 —— 4 列 = 2 行（10 件时 3 行，
                          实测多出 85px 溢出；8 件恰好两行满排） */
  ui.equipHTML = function (inModal) {
    var s = GAME.state;
    var g = null;
    s.generals.forEach(function (x) { if (x.id === ui._equipGen) g = x; });
    if (!g && s.generals.length) g = s.generals[0];
    if (!g) return '<div class="ui-page"><div class="gold-heading">🎽 装备</div><div class="q-empty">暂无英雄</div></div>';
    ui._equipGen = g.id;
    var bonus = GAME.systems.genEquipBonus(g);
    /* v66：算"装备把全军生命推到哪儿"要两个池子 —— 带装与裸装。
       都用 genAttrs（唯一取值口），不自己拼 staBaseMax + sta。 */
    var aEq = GAME.genAttrs(g);
    var aBare = GAME.genAttrs({
      level: g.level, tong: g.tong, yw: g.yw, zm: g.zm, nz: g.nz, speed: g.speed,
      attack: g.attack, defense: g.defense, rank: g.rank, style: g.style,
      perm: g.perm || {}, equip: {},
    });
    /* v88：总览按**当前生效套**（槽名/装备/背包候选全同步） */
    var gIsLing = (g.equipOn === 'ling') && GAME.canCultivate(g);
    var gBag = (gIsLing ? g.lingEquip : g.equip) || {};
    var gSlotNames = gIsLing ? DATA.LING_SLOT_NAMES : DATA.EQUIP_SLOT_NAMES;
    /* v90.11：机甲 19 槽 / 基因 12 槽 —— 总览按当前套取槽列表 */
    var slotRows = (gIsLing ? DATA.LING_SLOTS_ID : DATA.EQUIP_SLOTS).map(function (slot) {
      var inst = gBag[slot];
      var item = inst ? DATA.EQUIP[GAME.eqId(inst)] : null;
      return '<div class="res-line"><span class="lbl">' + (gSlotNames[slot] || slot) + '</span>' +
        '<span class="val">' + (item ? U.escape(GAME.eqLabel(inst)) + (item.set ? ' <span style="color:var(--hero-tag);">[' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) + ']</span>' : '') +
        (item.slot === 'weapon' && item.atk ? ' 攻' + Math.round(item.atk * (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1)) : '')
          + (item.spd ? ' 速' + Math.round(item.spd * (GAME.eqEnhMulOf ? GAME.eqEnhMulOf(inst) : 1)) : '') : '—') + '</span>' +
        (item ? '<button class="btn sm red" data-action="unequip-item" data-gen="' + g.id + '" data-slot="' + slot + '" style="margin-left:6px;">卸</button>' : '') + '</div>';
    }).join('');
    /* v19：装备背包会随攻城/打造不断增长 → 接分页（每页 10） */
    var invAll = (s.inventory || []).filter(function (x) {
      var it3 = DATA.EQUIP[GAME.eqId(x)];
      return !!it3 && (!!it3.ling === gIsLing);   /* v88：候选只列当前套 */
    });
    var pgE = ui.pageOf('equip', invAll.length, ui.EQUIP_PER);
    var eqSlice = invAll.slice(pgE.from, pgE.to), eqPager = '';
    if (inModal) {
      var pgM = ui.modalPage('equip', invAll, ui.EQUIP_PER, function () { ui.openEquipPanel(); });
      eqSlice = pgM.slice; eqPager = pgM.pager;
    } else {
      ui.pagerHTML('equip', invAll.length, ui.EQUIP_PER);   /* 视图：底部条 */
    }
    var inv = eqSlice.map(function (inst, i) {
      var item = DATA.EQUIP[GAME.eqId(inst)];
      if (!item) return '';
      var key = GAME.eqUidOf(inst) != null ? GAME.eqUidOf(inst) : GAME.eqId(inst);
      return '<div class="troop-card" style="cursor:pointer;" data-action="equip-item" data-gen="' + g.id + '" data-item="' + key + '">' +
        '<div class="tname">' + U.escape(GAME.eqLabel(inst)) + '</div>' +
        '<div class="tstat">' + (gSlotNames[item.slot] || item.slot) + (item.set ? ' · ' + (DATA.SETS[item.set] ? DATA.SETS[item.set].name : item.set) : '') + '</div>' +
        '<div class="tstat">' + GAME.equipDescOf(inst) + '</div></div>';
    }).join('') || '<div style="color:var(--text-dim);font-size:var(--fs-sub);text-align:center;padding:10px;">背包暂无装备（占领名城/任务可获得）</div>';
    return '<div class="ui-page">' +
      /* v89.112c：弹窗模式**不重复标题** —— openPanel 的外层已有「装备」，
         内层再来一个 34px 的金头就是纯占位（还顶出一截滚动）。
         视图模式（setView('equip')）没有外层标题，保留。 */
      (inModal ? '' : '<div class="gold-heading">🎽 装备 · ' + U.escape(g.name) + '</div>') +
      '<div style="margin-bottom:8px;"><div class="ui-sub" style="margin-bottom:4px;">选择英雄 · 当前 <b style="color:var(--gold-light);">' + U.escape(g.name) + '</b></div>' +
        ui.genChips({ store: '_equipGen', refresh: 'view', value: g.id || (ui._equipGen || ''),
          per: 12, modal: true, key: 'gchips_eq', wide: true }) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">已装配（' + Object.keys(gBag).length + '/' + (gIsLing ? 12 : 19) + '）' + (gIsLing ? '　🧬 基因' : '　⚙ 机甲') + '</div>' + slotRows + '</div>' +
        '<div><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">加成汇总</div>' +
          '<div class="res-line"><span class="lbl">指挥</span><span class="val">+' + bonus.tong + '</span></div>' +
          '<div class="res-line"><span class="lbl">武力</span><span class="val">+' + bonus.yw + '</span></div>' +
          '<div class="res-line"><span class="lbl">谋略</span><span class="val">+' + bonus.zm + '</span></div>' +
          '<div class="res-line"><span class="lbl">治理</span><span class="val">+' + bonus.nz + '</span></div>' +
          '<div class="res-line"><span class="lbl">攻击/防御</span><span class="val">+' + bonus.atk + '/+' + bonus.def + '</span></div>' +
          '<div class="res-line"><span class="lbl">速度</span><span class="val">+' + bonus.spd + '</span></div>' +
          /* v66：这一行现在是**真·体力**（并进体力上限），不再是"全军生命 +N%"的第二套说法。
             括号里顺手给出它把全军生命推到哪儿 —— 用 GAME.staHpPct 现算，
             不写第二份双曲公式。 */
          '<div class="res-line"><span class="lbl">体力</span><span class="val">+' + Math.round(bonus.sta || 0) +
            ' <span class="cap">全军生命 +' + Math.round((GAME.staHpPct(aEq.staMax) - GAME.staHpPct(aBare.staMax)) * 100) +
            '%</span></span></div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:12px;"><div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">装备背包（点击穿戴）</div>' +
      /* v90.18：自适应列宽铺满 —— 满幅弹窗（1424px）下 4 列会留大片空白，改 auto-fill 依宽度铺开。 */
      '<div class="troop-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));">' + inv + '</div>' +
      eqPager + '</div>' +

      '</div>';
  };
  GAME.equipDesc = function (item) {
    var parts = [];
    if (item.tong) parts.push('统+' + item.tong);
    if (item.nz) parts.push('政+' + item.nz);
    if (item.yw) parts.push('勇+' + item.yw);
    if (item.zm) parts.push('智+' + item.zm);
    if (item.atk) parts.push('攻+' + item.atk);
    if (item.def) parts.push('防+' + item.def);
    if (item.spd) parts.push('速+' + item.spd);
    if (item.sta) parts.push('体+' + item.sta);
    if (item.lingv) parts.push('灵+' + item.lingv);   /* v88：机能（探索战力） */
    return parts.join(' ') || '—';
  };
  /* v89.211（老板 1）：**按件**装备描述（唯一出口）—— 与 equipDesc 同格式，
     但把熔铸/调校后的真实数值呈出来：六维/攻防/速/体读 eqEnhMulOf（与 genEquipBonus
     同源）、机能读 eqLingMulOf（与 lingPowerOf 同源）。无强化时与 equipDesc 逐字一致。
     改前所有按件展示点都读原值 —— 老板"+10 了属性没动"的观感就出在这里
     （数值链本身是通的，断在展示一手；见 docs/_史料/交付/v89211-强化链修复与占城补齐与器械工位.md 探针实证）。

     v89.214（老板 1）：升级为**结构化分行** —— 唯一数据出口 `equipStatRowsOf`：
       每条 = { k, label, short, base, val, add, src }
         base = 原始属性（表值）· val = 现值（含强化/调校）· add = val − base · src = 增强来源
         src: 'enh' = 熔铸（机甲 +8%/级）· 'ling' = 调校（基因强化件 +12%~+20% 递增/级）· '' = 未增强
       一行文本（equipDescOf）与分行浮层（ui.equipStatsHTML）都由它派生 ——
       数值口径与配色口径都只此一份（改乘链只改上面那两个乘数出口）。
     行序（攻防 → 六维 → 机能）：攻击 防御 指挥 武力 谋略 治理 速度 体力 机能 ——
     攻防置顶（玩家挑装备第一眼看的就是它），六维保持连续成块（老板要的"六维分行"）。
     无强化时 add 恒 0，浮层只画白值 —— 与 equipDesc 的观感一致。 */
  GAME.EQUIP_STAT_DEFS = [
    ['atk', '攻击', '攻'], ['def', '防御', '防'],
    ['tong', '指挥', '统'], ['yw', '武力', '勇'], ['zm', '谋略', '智'], ['nz', '治理', '政'],
    ['spd', '速度', '速'], ['sta', '体力', '体'],
    ['lingv', '机能', '灵'],
  ];
  GAME.equipStatRowsOf = function (x) {
    var it = DATA.EQUIP[GAME.eqId(x)];
    if (!it) return [];
    var lv = GAME.eqEnhOf(x);
    var mu = lv ? ((GAME.eqEnhMulOf && GAME.eqEnhMulOf(x)) || 1) : 1;
    var ml = lv ? ((GAME.eqLingMulOf && GAME.eqLingMulOf(x)) || 1) : 1;
    var src = lv ? (it.ling ? 'ling' : 'enh') : '';
    var rows = [];
    GAME.EQUIP_STAT_DEFS.forEach(function (p) {
      var b = it[p[0]] || 0;
      if (!b) return;
      var m = (p[0] === 'lingv') ? ml : mu;
      var v = Math.round(b * m);
      rows.push({ k: p[0], label: p[1], short: p[2], base: b, val: v, add: Math.max(0, v - b), src: src });
    });
    return rows;
  };
  GAME.equipDescOf = function (x) {
    var rows = GAME.equipStatRowsOf(x);
    return rows.length ? rows.map(function (r) { return r.short + '+' + r.val; }).join(' ') : '—';
  };
  /* 分行属性浮层 HTML（悬停 / 详情共用 —— v89.214 老板 1 · v89.219 老板 2 校正）：
     **白字 = 原始值（base）· 金/青 = 增量（add = 现值 − 原始值）**。
     改前白字画的是"现值"：+10 的件白字 = 原始×1.8、金增量 = 原始×0.8，
     玩家拿白值验算 80% 得 44%（"数值对不上"）。现值可由「白 + 增量」自算，
     与脚注「新增值 = 原始值 × 80%」自洽（与老板原话"原始属性数字白色"一致）。 */
  ui.equipStatsHTML = function (x) {
    var rows = GAME.equipStatRowsOf(x);
    if (!rows.length) return '<div class="tip-l">—</div>';
    return rows.map(function (r) {
      return '<div class="tip-l eqv-line"><span class="eqv-k">' + r.label + '</span>' +
        '<span class="eqv-b">' + r.base + '</span>' +
        (r.add > 0 ? '<span class="eqv-d' + (r.src === 'ling' ? '2' : '1') + '">+' + r.add + '</span>' : '') +
        '</div>';
    }).join('');
  };
  /* 增量的来源说明行（浮层底部一行小注；有强化才给）—— 让颜色有出处可查。 */
  ui.equipEnhNoteHTML = function (x) {
    var lv = GAME.eqEnhOf(x), it = DATA.EQUIP[GAME.eqId(x)];
    if (!lv || !it) return '';
    /* v91.59：基因件走递增曲线（+12%→+20%），机甲件走熔铸恒定 perLv —— 本件**累计**乘数照实报。 */
    var mul = it.ling ? GAME.lingTemperMulOf(lv) : (1 + lv * ((DATA.ENHANCE || {}).perLv || 0.08));
    var tot = Math.round((mul - 1) * 100);
    return '<div class="tip-l eqv-note"><span class="eqv-d' + (it.ling ? '2' : '1') + '">+</span> ' +
      (it.ling ? '调校' : '熔铸') + ' +' + lv + ' 级 · ' +
      (it.ling ? ('每级 +12%~+20% 递增') : ('每级 +' + Math.round(((DATA.ENHANCE || {}).perLv || 0.08) * 100) + '%')) +
      '（对原始值线性叠加 · 本件共 +' + tot + '%）</div>';
  };

  /* --------- 科技 --------- */
  ui.techHTML = function (inModal) {
    var s = GAME.state, c = GAME.currentCity();
    var bookLv = GAME.buildingLevel(c, 'shuyuan') || 0;
    var cur = GAME.systems.researching();
    /* v89.191（老板 3-④）：科技按城 —— 读本城等级与上限（主城 20 / 别城 10，唯一出口 techCapOf）。 */
    var cap = GAME.techCapOf ? GAME.techCapOf(c) : (DATA.TECH_MAX_LV || 10);
    var isMain = GAME.isMainCity && GAME.isMainCity(c);
    var mainCap = DATA.TECH_MAX_LV_MAIN || 20;
    var rowOf = function (t, capOverride) {
      var _cap = capOverride == null ? cap : capOverride;
      var lv = GAME.systems.techLevel(t.id, c);
      var locked = bookLv < t.lv;
      var full = lv >= _cap;
      /* v89.191（老板 3-③）：**建筑不达标则无法研究** —— 缺哪个建筑、差多少，逐一列明。 */
      var miss = [];
      var req = t.req || {};
      Object.keys(req).forEach(function (b) {
        var bl = GAME.buildingLevel(c, b);
        if (bl < req[b]) miss.push(((DATA.BUILDINGS[b] || {}).name || b) + ' Lv' + req[b] + '（现 ' + bl + '）');
      });
      var cost = DATA.techCost(t, lv + 1);
      var btn = full ? '<span style="color:var(--text-dim);">已满级</span>' :
        locked ? '<span style="color:var(--red-light);">需科研中心Lv' + t.lv + '</span>' :
        miss.length ? '<span style="color:var(--red-light);">需' + miss.join('、') + '</span>' :
        /* v90.44（老板）：「耗费资源的操作不要直接显示数额，改为悬停显示」——
           研究按钮文字去掉「(旧币 N)」，费用全在 title 悬停（GAME.costString 唯一渲染口）。 */
        '<button class="btn sm" data-action="tech-research" data-tech="' + t.id + '"'
          + ' title="需 ' + GAME.costString(cost) + '"'
          + (cur ? ' disabled data-why="本城科研中心正在研究其他科技（每城同时仅 1 项）"' : '') + '>研究</button>';
      return '<tr><td>' + t.name + '</td><td class="ctr">' + lv + '/' + _cap + '</td>' +
        '<td style="font-size:var(--fs-sub);color:var(--text-dim);">' + t.desc + '</td>' +
        '<td class="ctr">' + btn + '</td></tr>';
    };
    /* v89.231（老板「调整科技体系」）：**分组渲染** —— 按 DATA.TECH_CATS 分节
       （唯一分组源；分组缺失/空组自动跳过，兜底不吞行）。 */
    var rows = (DATA.TECH_CATS || [{ key: null, name: '' }]).map(function (cat) {
      var inner = DATA.TECH.filter(function (t) { return cat.key == null || t.cat === cat.key; })
        .map(function (t) { return rowOf(t); }).join('');
      if (!inner) return '';
      var head = cat.name ? '<tr class="tech-cat"><td colspan="4">' + cat.name + '</td></tr>' : '';
      return head + inner;
    }).join('');
    /* v91.72（老板）：「给主城设计独特的 5 个科技，独立生效显示主城的独特优势」——
       独立成组排在常规 24 项之后；只有主城可研（别城整组置灰并说明）。
       v91.72b（老板）：「科研中心的科技界面，这个顶上的标题应该是重复的」——
       **弹窗/视图外层已有标题**，正文不再重复同一条金头。 */
    var mainRows = (DATA.TECH_MAIN || []).map(function (t) {
      var tr = rowOf(t, GAME.techCapOfMain());
      if (isMain) return tr;
      return '<tr style="opacity:.55;"><td>' + U.escape(t.name) + '</td><td class="ctr">—</td>' +
        '<td style="font-size:var(--fs-sub);color:var(--text-dim);">' + U.escape(t.desc) + '</td>' +
        '<td class="ctr"><span style="color:var(--text-dim);">仅主城</span></td></tr>';
    }).join('');
    if (mainRows) {
      rows += '<tr class="tech-cat"><td colspan="4">' +
        U.escape((DATA.TECH_MAIN_CAT || {}).name || '主城独有') +
        (isMain ? '' : '（本城不是主城 —— 设为主城后可研究）') + '</td></tr>' + mainRows;
    }
    return '<div class="ui-page">' +
      (inModal ? '' : '<div class="gold-heading">📜 科研中心科技（' + bookLv + '级科研中心 · ' +
        (DATA.TECH.length + (DATA.TECH_MAIN || []).length) + '项）</div>') +
      /* v89.191：上限按城提示（主城 20 / 别城 10）—— 玩家一眼知道本城的天花板与出路。 */
      '<div style="text-align:center;color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:4px;">'
        + (isMain
          ? '主城科技上限 Lv' + cap + '　·　主城独有科技上限 Lv' + GAME.techCapOfMain() + '（11 级起花费急剧升高）'
          : '本城科技上限 Lv' + cap + '　·　设为主城可提升至 Lv' + mainCap + '（并解锁主城独有 5 项）') + '</div>' +
      (cur ? '<div style="text-align:center;color:var(--green-ok);font-size:var(--fs-body);margin-bottom:8px;">🔬 研究中：' + (function(){ var n=cur.techId; DATA.TECH.forEach(function(x){if(x.id===cur.techId)n=x.name;}); return n; })()
        + (function(){ var qc = cur.cityId && GAME.cityById(cur.cityId); return qc ? '（' + qc.name + '）' : ''; })() + ' ' + Math.min(100, Math.floor(cur.elapsed / cur.totalTime * 100)) + '%' +
        /* v89.179b·P2-9：科技提速按钮显价（与 rush-build/rush-ext 同档） */
        (function () {
          var _c = GAME.queueRushCost(cur);
          return '　<button class="btn sm gold" data-action="rush-tech"'
            + ' title="花旧币立即完成（研究费 20% × 剩余比例，约 ' + U.fmt(_c) + ' 旧币）">⚡ 提速</button>';
        })() + '</div>' : '') +
      '<table class="tbl"><thead><tr><th>科技</th><th>等级</th><th>效果</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</div>';
  };

  /* --------- 宝物 --------- */
  ui.itemsHTML = function () {
    var s = GAME.state;
    /* v22：原先**每个宝物各带一个下拉框**（一屏 N 个），
       现在改为弹窗顶部选一次「使用对象」，所有物品共用。 */
    if (!ui._itemGen || !s.generals.some(function (g) { return g.id === ui._itemGen; })) {
      ui._itemGen = s.generals[0] ? s.generals[0].id : '';
    }
    var rows = Object.keys(s.items || {}).map(function (itemId) {
      var item = GAME.systems.itemInfo(itemId);
      if (!item) return '';
      var n = s.items[itemId];
      var needGen = ['jewel', 'attr_buff', 'exp', 'stamina', 'perm', 'mount_buff', 'rank_up'].indexOf(item.type) >= 0;
      /* 需要指定对象的宝物：直接用顶部选定的对象
         （按钮不再带 data-gen → main.js 回退到 ui._itemGen） */
      var btn = '<button class="btn sm" data-action="use-item" data-item="' + itemId + '">使用</button>';
      return '<div style="background:rgba(var(--sh-rgb),.22);border:1px solid #1d2028;border-radius:8px;padding:10px;margin-bottom:8px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">' +
          '<span style="font-weight:700;color:var(--gold-light);font-size:var(--fs-lead);">' + item.name + ' ×' + n + '</span>' +
          '<span style="display:flex;gap:6px;align-items:center;">' + btn + '</span>' +
        '</div>' +
        '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-top:4px;">' + item.desc + '</div>' +
      '</div>';
    }).join('') || '<div class="q-empty">背包暂无宝物</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">💎 宝物背包</div>' +
      (s.generals.length
        ? '<div style="margin-bottom:10px;"><div class="ui-sub" style="margin-bottom:4px;">使用对象</div>' +
          ui.genChips({ store: '_itemGen', value: ui._itemGen,
            per: 16, key: 'gchips_item', wide: true }) + '</div>'
        : '') +
      rows + '</div>';
  };

  /* v77：威望区块（rankBlock）已并入新的君主面板（左列表 / 右信息表），退役。 */

    ui.rankHTML = function () {
    var s = GAME.state;
    var cur = GAME.systems.rankInfo(s.rank);
    var next = GAME.systems.nextRank();
    var chk = next ? GAME.systems.canPromote() : null;
    var rows = DATA.RANK.map(function (r, i) {
      var isCur = i === s.rank;
      var jewelStr = Object.keys(r.jewel).length ? Object.keys(r.jewel).map(function (j) {
        var name = GAME.systems.itemInfo(j) ? GAME.systems.itemInfo(j).name : j;
        return name + '×' + r.jewel[j];
      }).join(' ') : '—';
      return '<tr' + (isCur ? ' style="background:rgba(201,162,75,.15);"' : '') + '>' +
        '<td>' + r.name + (isCur ? ' <span style="color:var(--green-ok);">←当前</span>' : '') + '</td>' +
        '<td class="ctr">' + r.city + '</td>' +
        '<td class="num">' + U.fmt(r.rep) + '</td>' +
        '<td class="num">' + U.fmt(r.gold) + '</td>' +
        '<td style="font-size:var(--fs-sub);">' + jewelStr + '</td>' +
        '<td class="num">' + U.fmt(r.salary) + '/h</td>' +
        /* v79（老板「威望加成」）：食邑列（一直是死数据）退役，改列真实加成 */
        '<td style="font-size:var(--fs-sub);">' + GAME.rankBonusText(i) + '</td></tr>';
    }).join('');
    var promoteBtn = next ? '<button class="btn gold lg" data-action="promote"' + (chk && chk.ok ? '' : ' disabled data-why="' + U.escape((chk && chk.msg) || '晋升条件未满足') + '"') + '>晋升：' + next.name + '</button>' : '<div style="color:var(--gold-light);">已登顶「废土之王」</div>';
    return '<div class="ui-page">' +
      '<div class="gold-heading">👑 威望 · 当前：' + cur.name + '</div>' +
      (next ? '<div style="background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;margin-bottom:12px;">' +
        '<div style="color:var(--gold-light);font-weight:700;margin-bottom:6px;">下一级：' + next.name + '</div>' +
        '<div class="res-line"><span class="lbl">声望</span><span class="val" style="color:' + (s.rep >= next.rep ? 'var(--green-ok)' : 'inherit') + ';">' + U.fmt(s.rep) + '/' + U.fmt(next.rep) + '</span></div>' +
        /* v89.108（老板）：城市数现在是**硬上限**（随威望解封）——
           这一行同时是"晋升门槛进度"与"领地上限"（cap = next.city，二者天然同值）。 */
        '<div class="res-line"><span class="lbl">城市（领地上限）</span><span class="val" style="color:' + ((GAME.empireCityCount ? GAME.empireCityCount() : s.cities.length) >= cur.city ? 'var(--green-ok)' : 'inherit') + ';">' + (GAME.empireCityCount ? GAME.empireCityCount() : s.cities.length) + '/' + cur.city + '</span></div>' +
        /* v91.22（老板 3）：星球门槛行（每 4 档 +1 星球）。 */
        '<div class="res-line"><span class="lbl">占领星球</span><span class="val" style="color:' + ((GAME.planetsOwnedCount ? GAME.planetsOwnedCount() : 1) >= (cur.planet || 1) ? 'var(--green-ok)' : 'inherit') + ';">' + (GAME.planetsOwnedCount ? GAME.planetsOwnedCount() : 1) + '/' + (cur.planet || 1) + '</span></div>' +
        '<div class="res-line"><span class="lbl">旧币</span><span class="val" style="color:' + ((s.res.gold || 0) >= next.gold ? 'var(--green-ok)' : 'inherit') + ';">' + U.fmt(s.res.gold || 0) + '/' + U.fmt(next.gold) + '</span></div>' +
        (chk && chk.msg && !chk.ok ? '<div style="color:var(--red-light);font-size:var(--fs-sub);margin-top:6px;">' + chk.msg + '</div>' : '') +
        '<div style="text-align:center;margin-top:12px;">' + promoteBtn + '</div></div>'
        /* v89.108：满档（无下一级）时也要看得到领地上限 */
        : '<div style="background:rgba(var(--sh-rgb),.25);border-radius:8px;padding:12px;margin-bottom:12px;color:var(--gold-light);">已登顶「' + cur.name + '」　·　领地上限 ' + GAME.cityCapOf() + ' 座（封顶）</div>') +
      '<table class="tbl"><thead><tr><th>威望</th><th>管理城市</th><th>声望</th><th>旧币</th><th>珠宝需求</th><th>俸禄</th><th>加成</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="note">加成说明：产 = 全境产量 · 税 = 税收 · 储 = 仓储 · 造 = 同时建造 · 野 = 附属野地上限 · 席 = 每城英雄席位。<br>' +
        '<b>领地上限随威望解封</b>：管理城市数 = 幸存者 9 座，每晋一档 +1（封顶 30 座）—— 打满本档上限即达晋升门槛。</div>' +
      '</div>';
  };

  /* --------- 地图 --------- */

  /* ================= 地图（12×8 观察框 + 导航） =================
     v26（需求 4）：由 12×12 放宽为 12×8 —— 格子从 44px 放大到 52px。
     实数校验（平板基准 1024×768）：中央可用宽 702 - 28(padding) = 674 ≥ 12×52=624；
     高 530 - 28(padding) - 78(浮标让位) = 424 ≥ 8×52=416。 */
  /* v29（需求 1）：观察框**随窗口自适应**，目标是"尽量满屏"。
     ------------------------------------------------------------
     旧实现把观察框写死 12×8、格距上限 68。实测 1440 宽窗口：
     中央可用宽 ≈ 1048px，而画布只有 12×68 = 816px —— 右侧空出近 300px，
     地图明明有空间却不长。现在改成：
       ① 按理想格距 TARGET 估算能放几行几列（有上限，避免格子小到看不清）；
       ② 再用**实际可用空间回算格距**，把这块地方填满。
     无布局环境（jsdom / 测试）下 viewBoxSize 返回基准值，估算出的行列
     仍是 MAP_SPAN_X × MAP_SPAN_Y，所以测试结果保持确定性。 */
  /* v50：地块改为**菱形等距排布** —— 画布仍是 cols×rows 个"格距"，
     但每块地是宽 cell、高 cell/2 的菱形。于是：
       · 同一块画布能看到 cols 个菱形宽、2×rows 个菱形高；
       · 估行列时的目标格距要放大到 1.41 倍 —— 菱形面积只有同宽正方形的一半
         （cell²/4），不放大就成了"满地碎菱"，既看不清也点不准。 */
  var MAP_SPAN_X = 12, MAP_SPAN_Y = 6;
  /* v90.88（老板）：方向键退役（地图由拖拽/缩放/球系坐标输入导航）——MAP_STEP_X/Y 已删。 */
  /* 格距按窗口算；jsdom 无布局时回落到基准值 */
  var MAP_CELL = 52;
  ui.MAP_TARGET_CELL = 88;       /* 正方形时代的理想格距（保留：图标尺寸仍按它对齐） */
  ui.MAP_TARGET_CELL_ISO = 124;  /* v50 菱形等距的理想格距 = 88 × 1.41 */
  ui.MAP_CELL_MIN = 34;          /* 小屏下限：再小就点不准了 */
  /* v89.52（老板：单一地块仍太大 → 整体再缩小为 1/2~1/3）：格距上限由 128 压到 44。
     大屏此前常驻 ~104px，现在最多 44px —— 单一地块约 0.34~0.42 倍（落在 1/2~1/3 区间）。
     配合下方 span 上限放大，画布仍能铺满界面，于是「同屏可见地块数」约 ×4，等于整体缩小了一档视野。 */
  /* v89.104（老板）：「地图能不能放大 20%（视野窄一点，画面大一点），现在感觉太细了没质感」
     —— 口径 = 一个**缩放倍率**同时作用在两处（只放大格距会留白、只收视野会变小图）：
       · 格距上限 ×1.2（44 → 53）：单格更大、图标与文字更清楚；
       · 观察框下限 ÷1.2（12×8 → 10×7）：同屏块数减少 → 视野更窄、画面更满。
     两处都由 `ui.MAP_ZOOM` 派生（改倍率只改一个数）。 */
  /* ============================================================
   * v89.138（老板 1）：「现在地图没有铺满界面，放大一点（不是视窗视野放大，
   *   而是**整体图像放大**）」——
   * 病根（探针实测 · probe_v89138_base.js）：v89.104 的 ZOOM 是**事后**缩放
   *   `cell = min(CELL_MAX, round(cell × ZOOM))`，而 CELL_MAX 本身已含 ZOOM
   *   （= round(44×1.2) = 53）→ 搜索出的 52 × 1.2 = 62 **被同一上限钳回 53**，
   *   只有 cols/rows 的 ÷ZOOM 生效 —— 结果是"视野窄了、格子没大、还留白"
   *   （1680×1000 实测：22×12@53 · 画布 1166×636 · 覆盖率仅 83%/81%）。
   * 修法：ZOOM 抬到 **2.0**（CELL_MAX = 88），并把 fitMapCell 的评分改成
   *   **"先铺满（覆盖率 ≥ 95%），铺满者取格距最大"**（见下）——
   *   铺满与放大同时满足，不再是二选一。
   * ============================================================ */
  ui.MAP_ZOOM = 2.0;
  ui.MAP_CELL_MAX = Math.round(44 * ui.MAP_ZOOM);
  ui.MAP_MIN_COLS = Math.max(8, Math.round(MAP_SPAN_X / ui.MAP_ZOOM));
  ui.MAP_MIN_ROWS = Math.max(5, Math.round(MAP_SPAN_Y / ui.MAP_ZOOM));
  /* 缩小后单格更小，把观察框上限放宽，让更多地块填进同一块画布（仍受 MAP_CELL_MAX 钳住格距）。 */
  ui.MAP_SPAN_MAX_X = 32, ui.MAP_SPAN_MAX_Y = 20;   /* 观察框最大范围 */
  ui.mapFrame = { spanX: MAP_SPAN_X, spanY: MAP_SPAN_Y, cell: MAP_CELL, iso: true };
  /* v85（老板）：「地图目前没有占满界面，建议占满，然后稍微放大一点图像」——
     旧口径"先按理想格距估行列、再回算格距"在 1440 屏给出 12×6@104：
     画布 1248×624 vs 可用 1376×733（右空 154 / 下空 157，且格距被 MAX 卡住）。
     改为**小搜索**：枚举 cols∈[12,22] × rows∈[6,14]，cell = min(availW/cols,
     availH/rows) 钳 [MIN, MAX]；score = 宽/高覆盖率的较小者（留白最均衡地最小）。
     先取 score 最高者；score 差 ≤1.2pp 时取格距更大者（"占满"与"放大"的折中）。
     1440 屏实测输出 13×7@104：画布 1352×728（覆盖 98%/99%，面积 +26%）；
     jsdom 基准下输出见测试（保持确定性）。 */
  ui.fitMapCell = function () {
    var box = ui.viewBoxSize();
    /* v76（老板）：地图导航迁入底部条 —— 不再为右下浮标让位（78 → 10，只留呼吸） */
    var pad = 28, extraH = 10, breath = 16;
    var availW = box.w - pad - breath;
    var availH = box.h - extraH - pad - breath;
    var best = null;
    /* ============================================================
     * v89.138（老板 1）：评分从"覆盖率最高"改为 **"铺满优先 → 铺满者取格距最大"**。
     * ------------------------------------------------------------
     * 旧评分（cov 最大、并列取 cell 更大）在 CELL_MAX 是硬闸时会把格数顶到上限
     * ——覆盖率高但格子小，且 ZOOM 一乘就被钳死（见上）。
     * 新评分两段：
     *   ① 先滤掉"铺不满"的组合（min(宽/高覆盖率) < FILL_MIN = 0.95）；
     *   ② 在铺满的候选里取 **cell 最大**（并列取覆盖面更大者）。
     * 这样 1680×1000 会选 17×9@80（≈99%/98%）而不是 22×12@53（83%/81%）。
     * 兜底：若 window 极端（无任何组合 ≥95%）→ 退化为旧口径（覆盖率最高）。
     * ============================================================ */
    var FILL_MIN = 0.95;
    var fallback = null;
    for (var cols = ui.MAP_MIN_COLS; cols <= ui.MAP_SPAN_MAX_X; cols++) {
      for (var rows = ui.MAP_MIN_ROWS; rows <= ui.MAP_SPAN_MAX_Y; rows++) {
        var raw = Math.min(availW / cols, availH / rows);
        if (raw < ui.MAP_CELL_MIN) continue;              /* 塞不下：该行列组合不可行 */
        var cell = Math.min(ui.MAP_CELL_MAX, Math.floor(raw));
        var cw = cols * cell, ch = rows * cell;
        var cov = Math.min(cw >= availW ? 1 : cw / availW, ch >= availH ? 1 : ch / availH);
        /* 兜底榜（旧口径）：不论铺不铺满，留白最均衡者 */
        if (!fallback || cov > fallback.cov + 0.012
            || (Math.abs(cov - fallback.cov) <= 0.012 && cell > fallback.cell)) {
          fallback = { cols: cols, rows: rows, cell: cell, cov: cov };
        }
        if (cov < FILL_MIN) continue;                     /* ① 铺不满 → 不进主榜 */
        var better = !best || cell > best.cell
          || (cell === best.cell && cov > best.cov);
        if (better) best = { cols: cols, rows: rows, cell: cell, cov: cov };
      }
    }
    if (!best) best = fallback;
    if (!best) {   /* 兜底（理论上不可达）：极端窗口下也要有解 */
      best = { cols: ui.MAP_MIN_COLS, rows: ui.MAP_MIN_ROWS,
        cell: Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX,
          Math.floor(Math.min(availW / ui.MAP_MIN_COLS, availH / ui.MAP_MIN_ROWS)))) };
    }
    var cols = best.cols, rows = best.rows, cell = best.cell;
    /* ============================================================
     * v89.104（老板）：「地图能不能放大 20%（视野窄一点，画面大一点），
     * 现在感觉太细了没质感」
     * ------------------------------------------------------------
     * 直接抬格距上限**没用**（实测：fitMapCell 为了"占满"会一直选小格
     * ——1680×1000 下仍是 20×17@41，上限 44→53 根本没被碰到）。
     * 所以放大作用在**搜索结果**上：格距 ×MAP_ZOOM、行列 ÷MAP_ZOOM ——
     * 于是单格更大（更清楚）、同屏块数更少（视野更窄），画布尺寸基本不变
     * （仍铺得满，不会留大片空白）。上/下限照旧夹在 MAP_CELL_MIN/MAX。
     * ============================================================ */
    /* v89.138：ZOOM 已并入上面的"格距上限"（CELL_MAX = 44 × ZOOM），
       这里**不再**对结果做第二次缩放（那正是"格子没大、还留白"的病根）——
       只保留一个幂等护栏：若历史调用方传进来 ZOOM ≠ 2.0 且缩放后仍铺得满，照做。 */
    if (ui.MAP_ZOOM && ui.MAP_ZOOM !== 2.0) {
      var zc = Math.max(ui.MAP_CELL_MIN, Math.min(ui.MAP_CELL_MAX, Math.round(cell * ui.MAP_ZOOM / 2.0)));
      var zcols = Math.max(ui.MAP_MIN_COLS, Math.round(cols * 2.0 / ui.MAP_ZOOM));
      var zrows = Math.max(ui.MAP_MIN_ROWS, Math.round(rows * 2.0 / ui.MAP_ZOOM));
      var zcov = Math.min(zcols * zc >= availW ? 1 : zcols * zc / availW,
        zrows * zc >= availH ? 1 : zrows * zc / availH);
      if (zcov >= 0.95) { cell = zc; cols = zcols; rows = zrows; }
    }
    ui.mapFrame = { spanX: cols, spanY: rows, cell: cell, iso: true };
    MAP_CELL = cell;
    return cell;
  };
  /* v50：mapView 的语义由"视口左上角格"改为**视野中心格** ——
     菱形网格在屏幕上是斜的，"左上角"不再对应任何有意义的格。 */
  ui.mapView = { x: null, y: null };
  /* v89.52（老板：底部导航栏最左按钮一键显示建筑/野地名称与等级）：标注层总开关。
     默认开（沿用野地名称常显），点按在底部条「🏷 名称」上切换；关时整层不画，地图更干净。 */
  ui._mapShowLabels = true;
  /* v89.61（老板「名称按钮应同时控制 城市内 / 城外建筑 / 地图地块 这 3 大部分」）：
     总开关的**唯一出口** —— 一次切换管三处，别再在别处写第二份判断：
       ① 大地图 canvas 标注层（**野地 / 据点**）→ map.render 收 showLabels；
       ② 城内视图（城市）与 ③ 城外视图的建筑名（.tile-label）+ 等级角标（.tile-badge）
          → 由 body.labels-off 一处 CSS 关掉（DOM 节点保留，只是 display:none，
            这样按 id/类名取节点的既有断言与点击逻辑都不受影响）。
     为什么 DOM 侧走 CSS 而不是重渲染：切视图时重渲染会丢选中态、且要碰 4 处调用点；
     加一个根类名是"一处生效、任何视图立即跟随"，也符合"把约束力放在环境上"。

     ⚠️ v89.67（老板「名城的名称永不消失（左下角名称菜单不影响名城的显示，不然地图上看不见了）」）
     —— 三处**例外**，它们**不受**这个开关控制：
       · 大地图上的**城市**名称 + 等级角标 + 旧都/首府档位药丸（地图骨架，收掉就认不出哪座是哪座）；
       · 满界面缩略图的**城名层**（那层画的全是名城名称，同上理）；
       · （城内/城外视图不变 —— 那里画的是自家城市的建筑，与名城无关。） */
  ui.applyLabelSwitch = function () {
    var on = ui._mapShowLabels !== false;
    if (document.body && document.body.classList) document.body.classList.toggle('labels-off', !on);
    var btn = document.querySelector('.bb-label-toggle');
    if (btn) btn.classList.toggle('on', on);
  };

})();

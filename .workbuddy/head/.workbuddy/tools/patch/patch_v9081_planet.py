# -*- coding: utf-8 -*-
import io
f = 'js/ui.js'
s = io.open(f, encoding='utf-8').read()
start = s.index('  ui.openPlanetGen = function () {')
end = s.index('  /* --------- 英雄 --------- */', start)
new = r'''  ui.openPlanetGen = function () {
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
        '<div class="attr"><span class="k">奇观</span><span class="v"><b style="color:var(--gold-light);">✨ ' + U.escape(GAME.sphere.artifactOf ? GAME.sphere.artifactOf() : '—') + '</b>　<span class="ui-sub">本星球必产 1 处</span></span></div>' +
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
        slider('pg-spin', 'spinSec', '自转周期', 4, 30, 1, 10, '秒（无操作自转）') +
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
    var body = tab === 'list' ? ('<div class="op-zone"><div class="op-zone-t">星球副本（单副本渲染 · 只载入当前球）</div>' + listRows + '</div>' + curHTML)
      : tab === 'classic' ? clHTML
      : (curHTML + genHTML);
    var tabBtn = function(id, label, on) {
      return '<button class="btn' + (on ? ' gold' : ' sm') + '" data-action="planet-tab" data-tab="' + id + '">' + label + '</button>';
    };
    ui.openModal(
      '<div class="gold-heading">🪐 星球菜单</div>' +
      '<div style="text-align:center;margin-bottom:8px;">' +
        tabBtn('gen', '生成', tab === 'gen') + tabBtn('list', '副本', tab === 'list') + tabBtn('classic', '经典生态', tab === 'classic') +
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
      ecoNature: f.ecoNature, ecoCiv: f.ecoCiv, ecoMood: f.ecoCiv === undefined ? '' : f.ecoMood
    };
  };
  ui._planetSeedFrom = function () {
    var f = ui._planetFormCollect();
    return Math.round(Number(f.seed)) || ((U.now() % 900000) || 1);
  };
'''
s = s[:start] + new + s[end:]
io.open(f, 'w', encoding='utf-8', newline='\n').write(s)
print("patched", len(new))

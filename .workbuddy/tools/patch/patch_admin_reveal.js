/* v156.24：把「首府视野」从「13 州(NPC_CITIES.state)」换到**地图真正的省/市/区**
 * （`map3d._settle` 的 provOf/marketOf/districtOf，UI 下拉就是它）。
 *
 * 为什么换：
 *   · 老板原话 = "省市区"，地图检索栏逐字就是「选择行省 / 选择城市 / 选择区」；
 *   · `genSettlements()` 产出的行政中心城 `M.admCities` 带 admLevel（prov/market/district），
 *     且 map3d.js:126 明确 `kind==='adm' → ui.openAttackModal(ref)` —— **本来就能打**；
 *   · 而 DATA.NPC_CITIES 的 state 是"母星出生区"(13 州)，与地图上的省市区是两套。
 * 上一版（stateField/revealState）整块撤除 —— 一套需求只留一套语义，不留双轨。
 *
 * 用法：node .workbuddy/tools/patch/patch_admin_reveal.js
 */
'use strict';
var fs = require('fs');

function read(p) { return fs.readFileSync(p, 'utf8'); }
function write(p, s) { fs.writeFileSync(p, s, 'utf8'); }

/* ============ 1) map.js：撤掉 stateField 那套，换成 adminCiList ============ */
(function () {
  var p = 'js/map.js', s = read(p);
  /* 1a) 删旧块 */
  var a = s.indexOf('  /* ============================================================\n   * v156.23（老板「占领省市区首府');
  if (a >= 0) {
    var b = s.indexOf('  /* 聚落 ci → 该聚落城的**近邻重镇**（同州最近 jun，按聚落缓存）。O(1) 摊还。 */', a);
    if (b < 0) { console.error('map: end anchor missing'); process.exit(1); }
    s = s.slice(0, a) + s.slice(b);
    console.log('map.js: 旧 stateField 块已撤除');
  }
  /* 1b) 加新块（幂等） */
  if (s.indexOf('GAME.map.adminCiList = function') < 0) {
    var anchor = `  /* 聚落 ci → 该聚落城的**近邻重镇**（同州最近 jun，按聚落缓存）。O(1) 摊还。 */`;
    if (s.indexOf(anchor) < 0) { console.error('map: anchor missing'); process.exit(1); }
    var block = `  /* ============================================================
   * v156.24（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
   * ------------------------------------------------------------
   * **行政区 → 格清单** 的唯一出口。数据源是地图真正的省/市/区：
   *   \`GAME.map3d._settle\`（\`genSettlements()\` 生成，UI 检索栏那三个下拉就是它）：
   *     provOf / marketOf / districtOf  = 每个格属于哪个省 / 市 / 区（-1 = 不属）
   *   · prov 覆盖**全球（陆+海）**；market/district 只划在陆地 —— 见 genSettlements 注释。
   * 为什么要一个"出口"而不是各处直接读 \`_settle\`：
   *   ① 没有 three 的环境（node 门禁）里 \`_settle\` 为 null，这里统一返回 null，
   *      调用方不必到处 try/catch；
   *   ② 索引口径只有一处（下面是**顶点/格索引**，与 sphere.cells、fog 的 ci 同一套编号）。
   * ============================================================ */
  GAME.map.adminFields = function () {
    var S = GAME.map3d && GAME.map3d._settle;
    if (!S || !S.provOf) return null;
    return { prov: S.provOf, market: S.marketOf, district: S.districtOf, table: S.table };
  };

  /* level: 'prov' | 'market' | 'district'；index: 该级序号。返回格索引数组（可能为空数组）。 */
  GAME.map.adminCiList = function (level, index) {
    var f = GAME.map.adminFields();
    if (!f || index == null || index < 0) return null;
    var arr = level === 'prov' ? f.prov : level === 'market' ? f.market : level === 'district' ? f.district : null;
    if (!arr) return null;
    var out = [];
    for (var i = 0; i < arr.length; i++) if (arr[i] === index) out.push(i);
    return out;
  };

  /* 格 → 所属行政区（{level,index,name,prov,market,district}；无归属 → null）。 */
  GAME.map.adminOf = function (ci) {
    var f = GAME.map.adminFields();
    if (!f || ci == null || ci < 0 || ci >= f.prov.length) return null;
    var T = f.table || {}, pi = f.prov[ci], mi = f.market[ci], di = f.district[ci];
    if (pi < 0) return null;
    var pn = (T.prov && T.prov[pi]) ? T.prov[pi].name : '';
    var mn2 = (mi >= 0 && T.market && T.market[mi]) ? T.market[mi].name : '';
    var dn = (di >= 0 && T.district && T.district[di]) ? T.district[di].name : '';
    return { provIndex: pi, marketIndex: mi, districtIndex: di, prov: pn, market: mn2, district: dn };
  };

`;
    s = s.replace(anchor, block + anchor);
    console.log('map.js: adminFields / adminCiList / adminOf 已加入');
  }
  write(p, s);
})();

/* ============ 2) fog.js：revealState → revealAdmin ============ */
(function () {
  var p = 'js/fog.js', s = read(p);
  /* 2a) 换掉 revealState 块 */
  var a = s.indexOf('  /* ============================================================\n   * v156.23（老板「占领省市区首府');
  if (a >= 0) {
    var b = s.indexOf('  F.revealCity = function (city, r) {', a);
    if (b < 0) { console.error('fog: revealCity anchor missing'); process.exit(1); }
    s = s.slice(0, a) + s.slice(b);
    console.log('fog.js: 旧 revealState 块已撤除');
  }
  if (s.indexOf('F.revealAdmin = function') < 0) {
    var anchor = `  F.revealCity = function (city, r) {`;
    var block = `  /* ============================================================
   * v156.24（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
   * ------------------------------------------------------------
   * 占据一个**行政区首府** → 该行政区下辖的每一格全明。
   *   · 省府（prov）  → 全省（含下辖的所有市/区）
   *   · 市府（market）→ 全市（含下辖的所有区）
   *   · 区（district）→ 本区
   *
   * 为什么"首府 = 下辖地视野"讲得通：首府是建制的神经中枢 —— 驿传、户籍、
   *   田册、山川图志都在那儿。打下它，你接手的不只是城墙，还有**它管辖的那片地**。
   * 与既有规则的分工：
   *   · 普通城仍只按 \`radiusOf()\` 点亮身边几格（探索度换视野）；
   *   · 首府给的是**辖地**，不随探索度缩放 —— 它不是"探得更远"，是"接手了一张图"。
   * 数据来源唯一：\`GAME.map.adminCiList\`（provOf/marketOf/districtOf）。
   * 幂等：只升不降（重复调用返回 0）；level 写错 / index 越界 → 返回 0，
   *   绝不静默点亮半张图。
   * ============================================================ */
  F.revealAdmin = function (level, index) {
    F.ensure();
    if (!_n) return 0;
    var M = GAME.map;
    if (!M || !M.adminCiList) return 0;
    var list = M.adminCiList(level, index);
    if (!list || !list.length) return 0;
    var hit = 0;
    for (var i = 0; i < list.length; i++) if (F.bump(list[i], ALL)) hit++;
    return hit;
  };

`;
    s = s.replace(anchor, block + anchor);
    console.log('fog.js: revealAdmin 已加入');
  }
  /* 2b) revealOwned 里的段落换成 adm 版 */
  var oa = s.indexOf('    /* v156.23：**已占首府 → 该州辖地全明**');
  if (oa >= 0) {
    var ob = s.indexOf('    /* 我方前哨（据点被拔除后占据） */', oa);
    if (ob < 0) { console.error('fog: revealOwned anchor missing'); process.exit(1); }
    var adv = `    /* v156.24：**已占的省府/市府/区 → 其下辖地全明**
       ⚠️ 必须放在 revealOwned 里（而不是只在占领那一下点一次）：
         ① 读档后 fog 包是重建的，只在占领时点亮 = 一出游戏就丢；
         ② \`decay()\` 会把全明褪成半明，然后调 revealOwned "把家门口点回来" ——
            首府带来的辖地视野属于"建制内"，理应和城周围一样不被淡忘。
       幂等：已全明的格 \`bump\` 直接返回 false，不产生写入。 */
    (st.cities || []).forEach(function (c) {
      if (!c || c.npc || !c.admLevel || c.admIndex == null) return;
      hit += F.revealAdmin(c.admLevel, c.admIndex);
    });
`;
    s = s.slice(0, oa) + adv + s.slice(ob);
    console.log('fog.js: revealOwned 已改为 adm 版');
  }
  write(p, s);
})();

/* ============ 3) battle.js：挂钩换 admLevel，并给新城保留 admLevel/admIndex ============ */
(function () {
  var p = 'js/battle.js', s = read(p);
  var a = s.indexOf(`
    /* ============================================================
     * v156.23（老板「占领省市区首府`);
  if (a >= 0) {
    var endMark = `npcCity.type === 'capital')) {
      var _stName = npcCity.state || '';
      var _stHit = 0;
      try { _stHit = GAME.fog.revealState(_stName); } catch (eSt) { _stHit = 0; }
      if (_stHit > 0) {
        GAME.log.war('🏛 ' + npcCity.name + '既下 —— ' + _stName + '下辖 ' + _stHit + ' 格视野尽开');
        /* 这是"看得见"级别的收获，值得一条独立提示（别混进占领那行长文案里） */
        if (GAME.ui && GAME.ui.notify) {
          GAME.ui.notify('success', _stName + ' 全境在望：视野 +' + _stHit + ' 格');
        }
      }
    }`;
    var b = s.indexOf(endMark, a);
    if (b < 0) { console.error('battle: 旧挂钩尾锚 missing'); process.exit(1); }
    b += endMark.length;
    s = s.slice(0, a) + s.slice(b);
    console.log('battle.js: 旧 zhou/capital 挂钩已撤除');
  }

  if (s.indexOf('revealAdmin') < 0) {
    var anchor = `    GAME.log.war('占领新城市：' + npcCity.name + '！（威望 +' + repGain + '）');`;
    if (s.indexOf(anchor) < 0) { console.error('battle: log anchor missing'); process.exit(1); }
    var block = anchor + `

    /* ============================================================
     * v156.24（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
     * ------------------------------------------------------------
     * 打下一座**行政区中心城** → 该行政区下辖地全境在望。
     *   · admLevel='prov'     省府 → 全省（连带下辖所有市/区）
     *   · admLevel='market'   市府 → 全市
     *   · admLevel='district' 区   → 本区
     * 门槛就一条：\`npcCity.admLevel\` 存在（只有 genSettlements 产的行政城才有）。
     *   ⚠️ 不按 \`type\` 判：type 是**档位**（zhou/jun/county，决定等级与岁贡），
     *     而"这是哪一级行政中心"是 \`admLevel\` —— 两者同值但语义不同，
     *     拿 type 判会在"打了座 zhou 档的名城"时误触发（它不是任何省的中心）。
     * 点亮逻辑只有一处（GAME.fog.revealAdmin），这里只负责"什么时候点"和"怎么说"。
     * ============================================================ */
    if (GAME.fog && GAME.fog.revealAdmin && npcCity.admLevel && npcCity.admIndex != null) {
      var _adLv = npcCity.admLevel;
      var _adName = { prov: '省', market: '市', district: '区' }[_adLv] || '行政区';
      var _adHit = 0;
      try { _adHit = GAME.fog.revealAdmin(_adLv, npcCity.admIndex); } catch (eAd) { _adHit = 0; }
      if (_adHit > 0) {
        GAME.log.war('🏛 ' + npcCity.name + '既下 —— 该' + _adName + '下辖 ' + _adHit + ' 格视野尽开');
        /* "看得见"本身就是主要收获，单独一条提示（别混进占领那行长文案） */
        if (GAME.ui && GAME.ui.notify) {
          GAME.ui.notify('success', npcCity.name + ' 既下：该' + _adName + '视野 +' + _adHit + ' 格');
        }
      }
    }`;
    s = s.replace(anchor, block);
    console.log('battle.js: revealAdmin 挂钩已加入');
  }

  /* 新城必须留住 admLevel/admIndex —— 否则 revealOwned 读档后无法补点亮 */
  var cityAnchor = `    newCity.state = npcCity.state;      // 所属区
    newCity.origId = npcCity.id;        // 原 NPC id`;
  if (s.indexOf('newCity.admLevel = npcCity.admLevel') < 0 && s.indexOf(cityAnchor) >= 0) {
    s = s.replace(cityAnchor, cityAnchor + `
    /* v156.24：**行政中心身份跟着城走** —— 读档/月回访时
       \`fog.revealOwned\` 靠这两个字段把"该省/市/区下辖地"重新点亮。
       丢了它 = 一出游戏再进来，视野就退回占领前（功能只在当次有效）。
       普通名城（无 admLevel）不受影响，仍按 radiusOf 点亮。 */
    if (npcCity.admLevel) { newCity.admLevel = npcCity.admLevel; newCity.admIndex = npcCity.admIndex; }`);
    console.log('battle.js: newCity 保留 admLevel/admIndex');
  }
  write(p, s);
})();

console.log('DONE');

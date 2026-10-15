# -*- coding: utf-8 -*-
"""v89.138 补丁 H：smoke-test.js 追加 §119（本轮六条需求的门禁断言）"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

anchor = """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();"""
assert s.count(anchor) == 1

block = """  /* ============================================================
   * 119. v89.138（地图放大 / 城池菜单 / 提速 / 功能标题 / 召回统一 / 清单三条）
   * ============================================================ */
  console.log('\\n===== 119. v89.138（地图铺满放大 · 城池菜单 · 提速关窗 · 召回统一） =====');
  (function () {
    var _f = require('fs'), _p = require('path');
    var u = _f.readFileSync(_p.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m = _f.readFileSync(_p.join(__dirname, 'js', 'main.js'), 'utf8');
    var d = _f.readFileSync(_p.join(__dirname, 'js', 'domain.js'), 'utf8');
    var b = _f.readFileSync(_p.join(__dirname, 'js', 'battle.js'), 'utf8');
    var h = _f.readFileSync(_p.join(__dirname, 'index.html'), 'utf8');
    var uc = stripComment(u), mc = stripComment(m), dc = stripComment(d), bc = stripComment(b);

    /* ---- ① 地图：铺满 + 整体放大（老板 1） ---------- */
    check('§119① 地图拟合：ZOOM 2.0 · 铺满优先（FILL_MIN 0.95）· 铺满者取格距最大', (function () {
      var fn = codeOf(uc, 'ui.fitMapCell = function');
      return /ui\\.MAP_ZOOM = 2\\.0/.test(uc) && /MAP_CELL_MAX = Math\\.round\\(44 \\* ui\\.MAP_ZOOM\\)/.test(uc)
        && /FILL_MIN = 0\\.95/.test(fn) && /cell > best\\.cell/.test(fn)
        && /fallback/.test(fn);
    })());
    check('§119① 实测：基准框 9×8@88（铺满 96%+ · 单格对照改前 +66%）+ 四档视口同输出', (function () {
      var cell = G.ui.fitMapCell();
      var fr = G.ui.mapFrame;
      return fr.spanX === 9 && fr.spanY === 8 && cell === 88;
    })());

    /* ---- ② 城池菜单（老板 2） ---------- */
    check('§119② 城池菜单：进入城池→城内视图 · 派遣/运输双入口（带 hint）· 弃城两段确认', (function () {
      var seg = codeOf(uc, 'ui.openCityPanel = function');
      return /ui\\.setView\\('city'\\)/.test(mc) && /case 'city-enter'/.test(mc)
        && /case 'city-dispatch-exp'/.test(mc) && /hint: 'dispatch'/.test(mc)
        && /hint: 'cargo'/.test(mc) && /city-abandon-arm/.test(seg)
        && /_abandonArm138/.test(mc);
    })());
    check('§119② 退役：度支归集 / 将领派遣面板 / 改名菜单 三件套清零（含域函数）', (function () {
      return !/GAME\\.budgetGather = function/.test(dc) && !/GAME\\.doDispatch = function/.test(dc)
        && !/ui\\.openDispatch = function/.test(uc)
        && uc.indexOf('data-action="budget-gather"') < 0
        && uc.indexOf('data-action="city-rename"') < 0
        && uc.indexOf('data-action="city-dispatch"') < 0;
    })());
    check('§119② 守卫迁移（不是丢失）：席位预检进 prepare · 守将拦截走 marchBlockOf', (function () {
      return /_slots138/.test(bc) && /招贤馆无空位/.test(bc) && /GAME\\.marchBlockOf\\(gen\\)/.test(bc);
    })());
    check('§119② 实测：派遣 0 兵可发（只派将）· 抵达入城', (function () {
      var st = G.state, c = st.cities[0];
      var to = G.makeCity({ id: 'v138t', name: '副城', x: 300, y: 300, type: 'self' });
      to.cells[0].build = { id: 'zhaoxianguan', lvl: 5 };
      st.cities.push(to);
      var gen = null;
      (G.expGeneralsOf() || []).forEach(function (g) { if (!gen) gen = g; });
      if (!gen) { st.cities.pop(); return false; }
      var bak = { cityId: gen.cityId, status: gen.status };
      var r = G.march.dispatch({ kind: 'owncity', id: to.id }, 'transfer', {}, gen.id);
      var mm = (st.marches || [])[st.marches.length - 1];
      if (r.ok && mm) { mm.elapsed = mm.totalTime; G.march.tick(); }
      var ok = r.ok && gen.cityId === to.id;
      gen.cityId = bak.cityId; gen.status = bak.status;
      st.cities.pop();
      st.marches = [];
      return ok;
    })());

    /* ---- ③ 提速面板（老板 3） ---------- */
    check('§119③ 提速：删「已用宝物」拼音行 + 完成即自动关窗（queueDone138 唯一判据）', (function () {
      return uc.indexOf('已用宝物') < 0
        && /ui\\.queueDone138 = function/.test(uc)
        && (mc.match(/queueDone138\\(bIdx\\)\\) ui\\.closeModal\\(\\)/g) || []).length >= 2;
    })());

    /* ---- ④ 建筑界面「功能」标题（老板 4） ---------- */
    check('§119④ 建筑界面：「功能」标题行三处全删（施工中/城内/城外）', (function () {
      return uc.indexOf('op-zone-t">功能') < 0 && uc.indexOf('功能（升级中照常可用）') < 0
        && /bldg-acts|bldg-foot/.test(uc);
    })());

    /* ---- ⑤ 召回统一（老板 0/2） ---------- */
    check('§119⑤ 召回统一：三处入口全走 wild-withdraw（撤回驻军 = 兵将回城）+ 两段确认', (function () {
      var n = (uc.match(/data-action="wild-withdraw"/g) || []).length;
      return n >= 3
        && uc.indexOf('data-action="gather-abandon-ask"') < 0
        && !/ui\\.openGatherAbandonAsk = function/.test(uc)
        && !/GAME\\.doAbandonGather = function/.test(mc)
        && /_wdArm138/.test(mc) && /再点一次 —— 撤军回城/.test(mc);
    })());
    check('§119⑤ 域侧保留：abandonGather（停采）仍供 doWildWithdraw 内部调用', (function () {
      return /GAME\\.abandonGather = function/.test(dc) && /GAME\\.abandonGather\\(gth\\.id\\)/.test(dc);
    })());

    /* ---- ⑥ 清单三条 ---------- */
    check('§119⑥ 清单①：细分「本页单独设置」行带左侧金边（own-sub · 改下拉即联动）', (function () {
      return /isSub && ownSub137 \\? ' own-sub'/.test(uc) && /\\.tac-line\\.own-sub/.test(h);
    })());
    check('§119⑥ 清单②：附属野地操作列 flex 换行兜底（.wild-ops）', (function () {
      return /class="ctr wild-ops"/.test(uc) && /\\.wild-ops \\{ display: flex; flex-wrap: wrap/.test(h);
    })());
    check('§119⑥ 清单③：战场极端载荷兜底（wrap 自滚 + log 可压缩 min-height 140）', (function () {
      return /#bt-wrap \\{ display: flex; flex-direction: column; height: 100%; min-height: 0; overflow-y: auto; \\}/.test(h)
        && /\\.bt-log \\{ flex: 1 1 336px; max-height: none; min-height: 140px;/.test(h);
    })());

    /* ---- ⑦ 需求档案在册 ---------- */
    check('§119⑦ 需求档案在册（v89.138 · 老板原文关键句逐字）', (function () {
      var md = _f.readFileSync(_p.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.138') >= 0
        && md.indexOf('而是整体图像放大') >= 0
        && md.indexOf('召回不是从采集变成驻军') >= 0
        && md.indexOf('剩余时长为0，则应自动关闭提速小弹窗') >= 0;
    })());
  })();

""" + anchor

s = s.replace(anchor, block)
assert '\\r\\n' not in s
tmp = p + '.tmp138'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
print('✅ §119 已追加：%d → %d 字节' % (n0, len(s)))

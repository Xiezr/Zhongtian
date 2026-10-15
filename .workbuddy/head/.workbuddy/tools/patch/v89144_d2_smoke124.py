# -*- coding: utf-8 -*-
"""v89.144 —— smoke-test.js 新增 §124 门禁节（老板 4 条各一条 + 档案在册）"""
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)

ANCHOR = """      } finally { DATA.DUEL.chance = ch; }
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
"""
assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))

SECTION = r"""      } finally { DATA.DUEL.chance = ch; }
    })());
  })();

  /* ═══════════════════════════════════════════════════════════
   * §124（v89.144）：老板 4 条 —— 斗将顶部固定行 / 上限清空入行 /
   *   军队校场扩容独立页签 / 目标下拉固定统一
   * ═══════════════════════════════════════════════════════════ */
  (function () {
    var fs124 = require('fs'), p124 = require('path');
    var rd124 = function (f) { return fs124.readFileSync(p124.join(__dirname, 'js', f), 'utf8'); };
    var strip124 = function (x) { return x.replace(/\/\*[\s\S]*?\*\//g, ''); };
    var u124 = strip124(rd124('ui.js')), m124 = strip124(rd124('main.js'));
    var h124 = fs124.readFileSync(p124.join(__dirname, 'index.html'), 'utf8');

    /* ---- ① 斗将顶部固定行（老板 1） ---- */
    check('§124① 斗将结果**顶部固定一行**（btDuelBarHTML 排在 bt-top 之前 · 文案唯一出口 btDuelLine）', (function () {
      var okSrc = /ui\.btDuelLine = function/.test(u124)
        && /ui\.btDuelBarHTML = function/.test(u124)
        && /return ui\.btDuelBarHTML\(rec\) \+ ui\.btTopHTML\(rec, snap\)/.test(u124)
        && /\.bt-duelbar \{/.test(h124);
      var g = (GAME.state.generals || [])[0];
      if (!g) return false;
      var foe = G.makeGeneral('顶部行测乙', 22, 'guard', null, false);
      var ch = DATA.DUEL.chance;
      DATA.DUEL.chance = 1;                      /* 必触发（用完还原） */
      try {
        var d = GAME.battle.rollDuel(g, foe, 's144');
        var line = G.ui.btDuelLine({ sim: { duel: d } });
        var bar = G.ui.btDuelBarHTML({ sim: { duel: d } });
        var log = G.ui.btDuelHTML({ sim: { duel: d } });
        var none = G.ui.btDuelBarHTML({ sim: {} }) + G.ui.btDuelLine(null) + G.ui.btDuelBarHTML(null);
        return okSrc && line.indexOf('战前斗将') >= 0
          && bar.indexOf('bt-duelbar') >= 0 && bar.indexOf('战前斗将') >= 0
          && log.indexOf('bt-ev duel') >= 0
          && none === '';                        /* 未触发 / 无会话 → 顶部不占位 */
      } finally { DATA.DUEL.chance = ch; }
    })());

    /* ---- ② 行内 [上限][清空]（老板 2） ---- */
    var _r124b = '';
    check('§124② 兵力第 4 列 = 每行 [上限][清空]（标题栏已无全局键 · 真渲染行数 = 全兵种数）', (function () {
      var keepState = GAME.state, keepTab = G.ui._marchTab, keepPick = G.ui._actPick;
      var ok = false, why = '';
      try {
        var npc = (GAME.state.map && GAME.state.map.cities || [])[0];
        if (!npc) { why = 'no npc city'; }
        else {
          G.ui.closeAllModals();
          G.ui.openExpModal({ kind: 'city', id: npc.id, npc: npc });
          var html = (global.document.querySelector('#modal-root') || {}).innerHTML || '';
          var nTroop = Object.keys(DATA.TROOPS).length;
          var nMax = (html.match(/data-action="exp-max"/g) || []).length;
          var nZero = (html.match(/data-action="exp-zero"/g) || []).length;
          var srcOk = !/data-action="exp-fill-all"/.test(u124) && !/data-action="exp-clear-all"/.test(u124)
            && /case 'exp-zero'/.test(m124) && /case 'exp-max'/.test(m124)
            && /ui\.expTroopTipOf\(c, id, ui\._expMode\)/.test(u124);
          ok = srcOk && nTroop > 0 && nMax === nTroop && nZero === nTroop
            && html.indexOf('>上限</button>') >= 0 && html.indexOf('>清空</button>') >= 0
            && html.indexOf('派遣兵力 · 兵种数量</div>') >= 0;   /* 标题后不再挂按钮 */
          if (!ok) why = 'srcOk=' + srcOk + ' nMax=' + nMax + ' nZero=' + nZero + ' nTroop=' + nTroop;
          G.ui.closeAllModals();
        }
      } catch (e) { why = 'ERR:' + (e && e.message); }
      finally { GAME.state = keepState; G.ui._marchTab = keepTab; G.ui._actPick = keepPick; }
      _r124b = why;
      return ok;
    })(), _r124b);

    /* ---- ③ 军队校场扩容独立页签（老板 3） ---- */
    check('§124③ 军队校场扩容：独立页签（军务总览右边）· 容量与节钺入口在册 · 出征页已无此卡', (function () {
      var keys = G.ui.MARCH_TABS.map(function (x) { return x[0]; });
      var okOrder = keys.indexOf('expand') === 1 && keys[0] === 'over';
      var h = G.ui.marchExpandHTML();
      var hact = G.ui.marchActHTML();
      var okSrc = /ui\.marchExpandHTML = function/.test(u124)
        && /if \(tab === 'expand'\) return/.test(u124);
      return okOrder && okSrc
        && h.indexOf('军队校场扩容') >= 0 && h.indexOf('data-action="jieyue-xc"') >= 0
        && h.indexOf('出征容量') >= 0 && h.indexOf('人马') >= 0
        && hact.indexOf('军队校场扩容') < 0 && hact.indexOf('jieyue-xc') < 0
        && hact.indexOf('作战能力') < 0;
    })(), G.ui.MARCH_TABS.map(function (x) { return x[1]; }).join('|'));

    /* ---- ④ 目标下拉固定统一（老板 4） ---- */
    var _r124d = '';
    check('§124④ 目标下拉：默认空（不再兜底选第一项）· 5 行定宽（label 108px / select 20em）· 去「共 N」备注 · 换行选择旧行消失', (function () {
      var st = GAME.state;
      var c = GAME.currentCity() || (st.cities || [])[0];
      if (!c) return false;
      var bkPick = G.ui._actPick, bkWilds = st.wilds;
      var ok = false, why = '';
      try {
        /* 非平凡解防护：先保证"我方野地"组真有目标（若全空，判据会平凡通过） */
        st.wilds = (st.wilds || []).slice();
        var wx = c.x + 3, wy = c.y + 3;
        st.wilds.push({ x: wx, y: wy, type: 'plain', level: 2, garrison: null, day: 0 });
        var groups = G.ui.actTargetGroups(c);
        var own = groups.filter(function (g) { return g.key === 'ownwild'; })[0];
        var seg = function (h, key) {
          var i = h.indexOf('data-grp="' + key + '"');
          if (i < 0) return '';
          return h.slice(i, h.indexOf('</select>', i));
        };
        /* ① 默认空：不设 _actPick → actPickOf() 为 null；渲染里没有"选中 idx0"的 option */
        G.ui._actPick = null;
        var pickNull = G.ui.actPickOf() === null;
        var h0 = G.ui.marchActHTML();
        var okEmpty = pickNull && seg(h0, 'ownwild').indexOf('<option value="0"') < 0
          && !/共 \d+ · 列最近/.test(h0) && h0.indexOf('列最近') < 0;
        /* ② 选中 → 该行 selected；随后"在另一行选" → 原来那一行回到空 */
        G.ui._actPick = { grp: 'ownwild', idx: 0 };
        var h1 = G.ui.marchActHTML();
        var okSel = seg(h1, 'ownwild').indexOf('<option value="0" selected>') >= 0;
        G.ui._actPick = { grp: 'npc', idx: 0 };
        var h2 = G.ui.marchActHTML();
        var okMove = seg(h2, 'ownwild').indexOf('<option value="0" selected>') < 0;
        /* ③ 定宽 CSS（label 以我方城池为基准 / select 20 个中文）+ 选定后 live 刷新源码 */
        var okCss = /\.exp-sel\.act-row > label \{ min-width: 108px; \}/.test(h124)
          && /\.exp-sel\.act-row > select\.act-sel \{ flex: 0 0 auto; width: 20em; max-width: 20em; \}/.test(h124);
        var okLive = /var g144 = el\.dataset\.grp/.test(m124) && /GAME\.refreshView\(\);/.test(m124)
          && /if \(el\.value === ''\)/.test(m124);
        var okSrc = /if \(!ui\._actPick\) return null;/.test(u124)
          && /case 'exp-act-pick'/.test(m124);
        ok = !!(own && own.targets.length >= 1) && okEmpty && okSel && okMove
          && okCss && okLive && okSrc;
        if (!ok) why = 'anyOwn=' + !!(own && own.targets.length) + ' empty=' + okEmpty
          + ' sel=' + okSel + ' move=' + okMove + ' css=' + okCss + ' live=' + okLive + ' src=' + okSrc;
      } catch (e) { why = 'ERR:' + (e && e.message); }
      finally { st.wilds = bkWilds; G.ui._actPick = bkPick; }
      _r124d = why;
      return ok;
    })(), _r124d);

    /* ---- ⑤ 档案在册（§26/§31 的规矩） ---- */
    check('§124⑤ 需求档案在册（v89.144 · 老板四条关键词）', (function () {
      var a = fs124.readFileSync(p124.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.144') >= 0
        && a.indexOf('顶部固定一行') >= 0
        && a.indexOf('军队校场扩容') >= 0
        && a.indexOf('对单独兵种数量进行操作') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
"""

s = s.replace(ANCHOR, SECTION)
assert '\r\n' not in s
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('§124 inserted · len ' + str(orig_len) + ' -> ' + str(len(s)))

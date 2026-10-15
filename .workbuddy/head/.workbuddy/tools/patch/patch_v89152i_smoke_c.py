# -*- coding: utf-8 -*-
# v89.152i：smoke-test.js 新增 §152 节（老档换算 / 面板实测 / 档案在册）
import io

P = 'E:/Deepseekdb/smoke-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)

NEW_SEC = u"""  /* ============================================================
   * 152. v89.152（珠宝体系重设 / 未占野地产出行 / 老档等值换算）
   * ============================================================ */
  console.log('\\n===== 152. v89.152（珠宝重设 · 产出行 · 老档换算） =====');
  (function () {
    var fs152 = require('fs'), p152 = require('path');
    var u152 = fs152.readFileSync(p152.join(__dirname, 'js', 'ui.js'), 'utf8');
    var d152 = fs152.readFileSync(p152.join(__dirname, 'js', 'domain.js'), 'utf8');
    var uc152 = stripComment(u152), dc152 = stripComment(d152);

    /* 共用小工具：找一块"未占的可采地形"格 / 渲染野地面板（捕获 HTML） */
    function findSpot152() {
      GAME.map.generate();
      var c0 = GAME.currentCity();
      GAME.ui._cityId = c0.id;
      for (var r = 1; r <= 20; r++) {
        for (var dx = -r; dx <= r; dx++) {
          for (var dy = -r; dy <= r; dy++) {
            var x = c0.x + dx, y = c0.y + dy;
            var tl = GAME.map.tile(x, y);
            if (!tl || !tl.terrain || tl.terrain === 'plain' || tl.terrain === 'city') continue;
            if (GAME.map.wildAt(x, y)) continue;
            return { x: x, y: y };
          }
        }
      }
      return null;
    }
    function render152(x, y) {
      var html = '';
      var _om = GAME.ui.openModal;
      GAME.ui.openModal = function (hh) { html = hh; };
      try { GAME.ui.openLandModal(x, y); } catch (e) { html = 'ERR:' + e.message; }
      GAME.ui.openModal = _om;
      return html;
    }

    /* ---- ① 老档等值换算（真造旧档数据 → 迁移 → 逐项核对 → 幂等） ---- */
    check('§152② 老档珠宝换算：14 键等值搬运 + 夜明珠转正 + 幂等（先摘后写）', (function () {
      var st = GAME.state;
      var bk = st.items, bkMig = st.jewelMig152, hadMig = ('jewelMig152' in st);
      st.items = { zhenzhu: 10, shanhu: 5, liuli: 3, hupo: 7, manao: 2, shuijing: 4, feicui: 6, yushi: 8,
        yemingzhu: 9, xueshanhu: 1, longyan: 1, lantianyu: 1, fengyu: 1, heshibi: 1, chuanguo: 1,
        chenxiang: 2 };
      delete st.jewelMig152;
      var n = GAME.migrateJewels152();
      var exp = { bengzhu: 10, mila: 5, meiyu: 3, puyu: 7, lvsongshi: 2, yusui: 4, yinchenmu: 6, cuiyu: 8,
        yemingzhu: 10, jiaorenlei: 1, tianzhu: 1, longxianxiang: 1, chenxiang: 3, dushanyu: 1 };
      var ok = (n === 51);
      Object.keys(exp).forEach(function (k) { if ((st.items[k] || 0) !== exp[k]) ok = false; });
      ok = ok && !st.items.zhenzhu && !st.items.chuanguo && !st.items.heshibi && !st.items.xueshanhu
        && !st.items.danbaishi && !st.items.zijin;
      var n2 = GAME.migrateJewels152();
      ok = ok && n2 === 0 && st.items.chenxiang === 3;
      st.items = bk;
      if (hadMig) st.jewelMig152 = bkMig; else delete st.jewelMig152;
      return ok;
    })());

    /* ---- ② 未占野地：产出行 4 行（源码 + 真渲染） ---- */
    check('§152③ 未占野地面板：产出行 4 行 · 无「占领/掠夺」备注 · 「占领」不带"并驻守"（源码级）', (function () {
      return /op-zone-t">产出<\\/div>/.test(uc152)
        && /<span class="k">资源<\\/span>/.test(uc152)
        && /<span class="k">产量加成<\\/span>/.test(uc152)
        && /<span class="k">材料<\\/span>/.test(uc152)
        && /<span class="k">珠宝<\\/span>/.test(uc152)
        && uc152.indexOf('打下来后军队就地驻守') < 0
        && uc152.indexOf('Lv0 无驻军位') < 0
        && uc152.indexOf('此地可采') < 0
        && /data-mode="occupy">🚩 占领<\\/button>/.test(uc152)
        && uc152.indexOf('data-mode="occupy">🚩 占领并驻守') < 0;
    })());
    check('§152③ 实测：未占面板真渲染（4 行齐备 · 备注不在 · 三键落底）', (function () {
      var spot = findSpot152();
      if (!spot) return false;
      var html = render152(spot.x, spot.y);
      return html.indexOf('<div class="op-zone-t">产出</div>') >= 0
        && html.indexOf('>资源<') >= 0 && html.indexOf('>产量加成<') >= 0
        && html.indexOf('>材料<') >= 0 && html.indexOf('>珠宝<') >= 0
        && html.indexOf('打下来后军队就地驻守') < 0 && html.indexOf('此地可采') < 0
        && html.indexOf('data-mode="occupy">🚩 占领</button>') >= 0
        && html.lastIndexOf('data-mode="scout"') > html.lastIndexOf('op-zone-t">产出');
    })());

    /* ---- ③ 已占野地不显示产出行（老板 5） ---- */
    check('§152④ 已占野地不显示产出行（老板 5）—— 真渲染（记录临时造/还原）', (function () {
      var st = GAME.state;
      var spot = findSpot152();
      if (!spot) return false;
      var tl = GAME.map.tile(spot.x, spot.y);
      st.wilds = st.wilds || [];
      st.wilds.push({ x: spot.x, y: spot.y, type: tl.terrain, level: 5, day: 0, startDay: 0 });
      var html = render152(spot.x, spot.y);
      st.wilds = st.wilds.filter(function (z) { return !(z.x === spot.x && z.y === spot.y); });
      return html.indexOf('op-zone-t">产出') < 0 && html.indexOf('>产量加成<') < 0
        && html.indexOf('此地可采') < 0 && html.indexOf('>材料<') < 0 && html.indexOf('>珠宝<') < 0
        && html.indexOf('op-zone-t">驻军') >= 0;
    })());

    /* ---- ④ 需求档案在册（v89.152） ---- */
    check('§152⑤ 需求档案在册（v89.152 · 珠宝重设 / 产出行 / 不带并驻守）', (function () {
      var a = fs152.readFileSync(p152.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.152') >= 0 && a.indexOf('每种野地根据常理设计3种珠宝') >= 0
        && a.indexOf('不用占领并驻守') >= 0 && a.indexOf('已占领的野地无需显示野地产出') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

OLD = u"""  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert S.count(OLD) == 1, 'anchor count=' + str(S.count(OLD))
if u'152. v89.152（珠宝体系重设' not in S:
    S = S.replace(OLD, NEW_SEC)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    print('OK sec152 inserted, len %d -> %d' % (orig, len(S)))
else:
    print('skip (already)')

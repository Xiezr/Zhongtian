# -*- coding: utf-8 -*-
"""v89.39 总补丁
① state.js：SG.ACT 表挂 miscTags + actPool 并入世事（misc）池
② index.html：+7 script（vol-78~84）
③ smoke-test.js：+7 require + v89.39 断言（并入核验 + pin 触发 + 走满）
④ e2e-test.js：VOL89 表 +7 行 + block F 追加世事触发块
幂等：已应用则 SKIP。
"""
import io, os, sys

R = r'E:\Deepseekdb'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    t = p + '.tmp8939'
    io.open(t, 'w', encoding='utf-8', newline='').write(s)
    os.replace(t, p)


def edit(p, old, new, tag):
    src = read(p)
    if new in src and old not in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    assert new in read(p), '落盘回查失败：' + tag
    print('OK  ' + tag)


# ---------- ① state.js：ACT 表 + miscTags 块 ----------
MT_BLOCK = u"""      anchors: [['building', 'guanfu'], ['building', 'honglusi'], ['building', 'minfang']]
    }
  };

  /* v89.39：世事（misc/any）并入动作触发池 —— 每键配「题材标签」，
     精确匹配世事篇 tags 的第二词（如 凯旋 / 策勋 / 迁治）——
     动作做完偶遇「事后的回响」（与 v89.29 点击奇遇、v89.31 动作触发同族）。 */
  (function () {
    var MT = {
      'battle-win': ['凯旋', '献俘', '犒军', '策勋', '追赠'],
      'battle-lose': ['收葬', '抚孤', '追赠'],
      'occupy-city': ['献俘', '凯旋', '赐第', '策勋'],
      'occupy-wild': ['追赠', '收葬'],
      'build-done': ['筑基', '建仓', '立市', '浚河'],
      'move-city': ['迁治', '修路', '去思碑'],
      'build-city': ['筑基', '立市', '迁治'],
      'train-done': ['犒军', '乡射'],
      'tech-done': ['奏对', '元日', '立春', '秋尝', '保举', '致仕', '授馆'],
      'heal-wounded': ['赈粥', '抚孤', '大傩', '腊祭', '雪赈'],
      'recruit-hero': ['保举', '赐服'],
      'market-trade': ['立市', '质剂', '岁贡', '贡差', '回赐', '勘合', '通事'],
      'gather-done': ['建仓', '质剂'],
      'promote': ['策勋', '铁券', '月俸', '朝会', '赐服', '奏对', '大赦', '赎刑', '旌表']
    };
    Object.keys(MT).forEach(function (k) {
      if (GAME.SG.ACT[k]) GAME.SG.ACT[k].miscTags = MT[k];
    });
  })();
"""
edit(R + r'\js\state.js',
     u"""      anchors: [['building', 'guanfu'], ['building', 'honglusi'], ['building', 'minfang']]
    }
  };
""",
     MT_BLOCK, 'state.js ACT 表 +miscTags')

# ---------- ① state.js：actPool 并入 ----------
edit(R + r'\js\state.js',
     u"""    list.forEach(function (a) {
      if (!a) return;
      GAME.SG.anchor(a[0], a[1]).forEach(function (r) {
        if (seen[r.st.id]) return;
        seen[r.st.id] = 1; total += 1;
        if ((r.done || []).length < (r.st.endings || []).length) fresh.push(r); else done.push(r);
      });
    });
    return { fresh: fresh, done: done, total: total, act: act };
""",
     u"""    list.forEach(function (a) {
      if (!a) return;
      GAME.SG.anchor(a[0], a[1]).forEach(function (r) {
        if (seen[r.st.id]) return;
        seen[r.st.id] = 1; total += 1;
        if ((r.done || []).length < (r.st.endings || []).length) fresh.push(r); else done.push(r);
      });
    });
    /* v89.39：世事（misc）并入 —— 与该键题材标签（miscTags）精确匹配的世事篇（tags 第二词） */
    if (act.miscTags && act.miscTags.length) {
      GAME.SG.anchor('misc', 'any').forEach(function (r) {
        if (seen[r.st.id]) return;
        var tg = r.st.tags || [];
        var hit = false;
        for (var i = 0; i < tg.length; i++) {
          if (act.miscTags.indexOf(tg[i]) >= 0) { hit = true; break; }
        }
        if (!hit) return;
        seen[r.st.id] = 1; total += 1;
        if ((r.done || []).length < (r.st.endings || []).length) fresh.push(r); else done.push(r);
      });
    }
    return { fresh: fresh, done: done, total: total, act: act };
""",
     'state.js actPool 并入 misc')

# ---------- ② index.html：+7 script ----------
edit(R + r'\index.html',
     u'<script src="story/vol-76.js"></script>\n<script src="story/vol-77.js"></script>',
     u'<script src="story/vol-76.js"></script>\n<script src="story/vol-77.js"></script>\n'
     u'<script src="story/vol-78.js"></script>\n<script src="story/vol-79.js"></script>\n'
     u'<script src="story/vol-80.js"></script>\n<script src="story/vol-81.js"></script>\n'
     u'<script src="story/vol-82.js"></script>\n<script src="story/vol-83.js"></script>\n'
     u'<script src="story/vol-84.js"></script>',
     'index.html +vol-78~84')

# ---------- ③ smoke：+7 require ----------
edit(R + r'\smoke-test.js',
     u"  require('./story/vol-77.js');\n",
     u"  require('./story/vol-77.js');\n"
     u"  require('./story/vol-78.js');\n  require('./story/vol-79.js');\n  require('./story/vol-80.js');\n"
     u"  require('./story/vol-81.js');\n  require('./story/vol-82.js');\n  require('./story/vol-83.js');\n"
     u"  require('./story/vol-84.js');\n",
     'smoke +require ×7')

# ---------- ③ smoke：v89.39 断言 ----------
V8939 = u"""  /* v89.39：世事（misc）并入动作触发池（40 篇 · 题材标签匹配 · pin 触发 · 走满） */
  check('故事库：世事 40 篇并入动作池（标签匹配 · pin 触发 · 走满）', (function () {
    var miscAll = GAME.SG.anchor('misc', 'any');
    if (miscAll.length < 40) return false;
    var inPool = function (key, sid) {
      var p = GAME.SG.actPool(key);
      var all = p.fresh.concat(p.done);
      for (var i = 0; i < all.length; i++) if (all[i].st.id === sid) return true;
      return false;
    };
    /* 并入核验：研习《奏对》· 晋升《策勋》· 胜仗《凯旋》· 市易《岁贡》 */
    var ok1 = inPool('tech-done', 'misc-06') && inPool('promote', 'misc-01')
      && inPool('battle-win', 'misc-07') && inPool('market-trade', 'misc-19');
    /* pin 触发：promote → misc-01 */
    var T = GAME.SG.TRIG;
    var bkPin = T.pin, bkAt = T._actAt;
    T.pin = 'misc-01'; T._actAt = {};
    var r = GAME.SG.rollAct('promote', {}, Date.now());
    T.pin = bkPin; T._actAt = bkAt;
    var ok2 = r.fire === true && r.sid === 'misc-01';
    /* 走满至 e1 */
    var st = GAME.SG.one('misc-01');
    var pathTo = function (st2, endId) {
      var idx = {}, first = (st2.nodes || [])[0];
      (st2.nodes || []).forEach(function (n) { idx[n.id] = n; });
      if (!first) return null;
      var seen = {}, q = [[first.id, []]];
      seen[first.id] = 1;
      while (q.length) {
        var cur = q.shift(), node = idx[cur[0]], path = cur[1];
        if (!node) continue;
        var ops = node.o || [];
        for (var i = 0; i < ops.length; i++) {
          if (ops[i].to === endId) return path.concat(i);
          if (idx[ops[i].to] && !seen[ops[i].to]) {
            seen[ops[i].to] = 1;
            q.push([ops[i].to, path.concat(i)]);
          }
        }
      }
      return null;
    };
    var path = st ? pathTo(st, 'e1') : null;
    var ok3 = false;
    if (path) {
      var rb = GAME.SG.begin('misc-01');
      if (rb.ok) {
        for (var i2 = 0; i2 < path.length; i2++) GAME.SG.choose(path[i2]);
        ok3 = !!GAME.SG._run && GAME.SG._run.phase === 'end' && GAME.SG._run.ending.id === 'e1';
      }
    }
    return ok1 && ok2 && ok3;
  })());

})();
"""
edit(R + r'\smoke-test.js',
     u"""    var w1 = walkTo('city-county-43', 'e1');
    var w2 = walkTo('city-county-50', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1';
  })());

})();
""",
     u"""    var w1 = walkTo('city-county-43', 'e1');
    var w2 = walkTo('city-county-50', 'e1');
    return !!w1 && w1.phase === 'end' && w1.ending.id === 'e1'
      && !!w2 && w2.phase === 'end' && w2.ending.id === 'e1';
  })());

""" + V8939, 'smoke v89.39 断言')

# ---------- ④ e2e：VOL89 表 +7 行 ----------
edit(R + r'\e2e-test.js',
     u"      ['v89.38', 'city-county-43'], ['v89.38', 'city-jun-34'], ['v89.38', 'ext-farm-10'],\n"
     u"      ['v89.38', 'city-county-49'], ['v89.38', 'city-zhou-27'], ['v89.38', 'city-county-50']\n    ];",
     u"      ['v89.38', 'city-county-43'], ['v89.38', 'city-jun-34'], ['v89.38', 'ext-farm-10'],\n"
     u"      ['v89.38', 'city-county-49'], ['v89.38', 'city-zhou-27'], ['v89.38', 'city-county-50'],\n"
     u"      ['v89.39', 'misc-01'], ['v89.39', 'misc-07'], ['v89.39', 'misc-13'], ['v89.39', 'misc-19'],\n"
     u"      ['v89.39', 'misc-25'], ['v89.39', 'misc-33'], ['v89.39', 'misc-40']\n    ];",
     'e2e VOL89 +7 行')

# ---------- ④ e2e：block F 追加世事触发块 ----------
edit(R + r'\e2e-test.js',
     u"""    sgOff89(); G.SG.TRIG._actAt = {};
    G.onActionDone('train-done');
    await sleep(30);
    check('★ v89.31：动作触发 · 默认阈值下不打扰（rng 恒 0.999）', fx.style.display === 'none');

    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();
""",
     u"""    sgOff89(); G.SG.TRIG._actAt = {};
    G.onActionDone('train-done');
    await sleep(30);
    check('★ v89.31：动作触发 · 默认阈值下不打扰（rng 恒 0.999）', fx.style.display === 'none');

    /* v89.39：世事（misc）并入动作池 —— 研习完成 → 世事篇开卷（真实链路） */
    var pM39 = G.SG.actPool('tech-done');
    var hasM39 = false;
    pM39.fresh.concat(pM39.done).forEach(function (r) { if (r.st.id === 'misc-06') hasM39 = true; });
    check('★ v89.39：世事并入动作池（tech-done 含《奏对》misc-06）', hasM39);
    sgPin89('misc-06'); G.SG.TRIG._actAt = {};
    G.onActionDone('tech-done');
    await sleep(40);
    check('★ v89.39：动作偶遇世事 · 研习完成 → 开卷（misc-06）',
      fx.style.display !== 'none' && !!G.SG._run && G.SG._run.st.id === 'misc-06');
    var exM39 = fx.querySelector('[data-action="story-exit"]');
    if (exM39) { click(exM39); await sleep(30); }
    check('★ v89.39：掩卷收起', fx.style.display === 'none');
    sgOff89(); G.SG.TRIG._actAt = {};

    /* 收尾：恢复测试默认（随机永不触发） */
    sgOff89();
""",
     'e2e block F +世事触发')

print('ALL OK')

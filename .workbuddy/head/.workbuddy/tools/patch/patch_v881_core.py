# -*- coding: utf-8 -*-
"""v88.1 整合（state.js）：删 wildScene 组（3 函数）→ 并入 jianghuDo 的 scene 分支。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\state.js'
d = io.open(P, encoding='utf-8', newline='').read()
dirty = False

# ============ 1) 删除 wildSceneOf / wildSceneCheck / wildSceneDo（含 v87 注释头） ============
if 'GAME.wildSceneDo' not in d:
    print('SKIP 1/2 wildScene 组已删除')
else:
    i = d.find("  /* ============================================================\n   * v87（老板「为各类野地设计专属弹窗场景」）：野地专属场景 —— 唯一出口组")
    j = d.find("    return { ok: true, name: out.t, text: texts.join('、'), bad: bad };\n  };\n")
    assert i > 0, 'v87 注释头未找到'
    assert j > i, 'wildSceneDo 结尾未找到'
    j_end = j + len("    return { ok: true, name: out.t, text: texts.join('、'), bad: bad };\n  };\n")
    REPL = ("  /* v87「野地专属场景」-> v88.1 整合：\n"
            "     wildSceneOf / wildSceneCheck / wildSceneDo 三函数已并入下方「江湖游历」出口组\n"
            "     （GAME.jianghuCheck / GAME.jianghuDo 的 kind:'scene' 分支）——\n"
            "     数据、锁（s.jianghu）、扣费、种子化、UI 入口全部统一走江湖游历。 */\n")
    d = d[:i] + REPL + d[j_end:]
    dirty = True
    print('OK 1/2 wildScene 组已删（留说明注释）')

# ============ 2) jianghuDo 加 scene 分支（产出逻辑自 wildSceneDo 原样移植） ============
if "a.kind === 'scene'" in d:
    print('SKIP 2/2 scene 分支已存在')
else:
    ANCHOR = """      GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + name0 + '（' + body0 + '）');
      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false };
    }"""
    SCENE = """      GAME.log('☯ ' + a.icon + ' ' + a.name + '：' + name0 + '（' + body0 + '）');
      return { ok: true, name: a.name + ' · ' + name0, text: (ev ? ev.text : '') + '（' + body0 + '）', bad: false };
    } else if (a.kind === 'scene') {
      /* 地形专属（v87 -> v88.1 整合）：产出原样（金/粮/材料/珠宝/道具/豪杰）。
         扣费与锁已在上文统一完成 —— 这里只做「种子化抽结果 + 发奖」。 */
      var outs2 = a.outcomes || [];
      var tot2 = 0;
      for (var oi2 = 0; oi2 < outs2.length; oi2++) tot2 += outs2[oi2].w;
      var rr2 = roll('scene_roll') * tot2;
      var acc2 = 0, out2 = outs2[outs2.length - 1];
      for (var oj2 = 0; oj2 < outs2.length; oj2++) {
        acc2 += outs2[oj2].w;
        if (rr2 < acc2) { out2 = outs2[oj2]; break; }
      }
      var home2 = GAME.currentCity();
      var gift = function (id, n) {
        s.items[id] = (s.items[id] || 0) + n;
        var it0 = (DATA.ITEMS || []).filter(function (x2) { return x2.id === id; })[0];
        texts.push((it0 ? it0.name : id) + '×' + n);
      };
      if (out2.gold && home2) {
        var gn2 = rnd('gold', out2.gold[0], out2.gold[1]);
        GAME.res(home2).gold = (GAME.res(home2).gold || 0) + gn2;
        texts.push('黄金 +' + gn2);
      }
      if (out2.grain && home2) {
        var gr2 = rnd('grain', out2.grain[0], out2.grain[1]);
        GAME.res(home2).grain = (GAME.res(home2).grain || 0) + gr2;
        texts.push('粮食 +' + gr2);
      }
      if (out2.mats) {
        var tbl2 = DATA.WILD_MATERIAL[tile.terrain] || {};
        var keys2 = Object.keys(tbl2);
        if (keys2.length) {
          var n2 = rnd('matn', out2.mats[0], out2.mats[1]);
          var bag2 = {};                        /* 同 id 合并，避免"兽筋×2、兽筋×2" */
          for (var mi2 = 0; mi2 < n2; mi2++) {
            var mk2 = keys2[Math.floor(roll('mk' + mi2) * keys2.length) % keys2.length];
            var mn2 = 1 + Math.floor(roll('mn' + mi2) * 2);
            bag2[mk2] = (bag2[mk2] || 0) + mn2;
          }
          for (var bk3 in bag2) {
            s.items[bk3] = (s.items[bk3] || 0) + bag2[bk3];
            var mm2 = DATA.MATERIAL_BY_ID[bk3];
            texts.push((mm2 ? mm2.name : bk3) + '×' + bag2[bk3]);
          }
        }
      }
      if (out2.jewel) {
        var jewels2 = (DATA.ITEMS || []).filter(function (x2) { return x2.type === 'jewel'; });
        var jn2 = (out2.jewel === 1) ? 1 : rnd('jn', out2.jewel.n[0], out2.jewel.n[1]);
        for (var ji2 = 0; ji2 < jn2; ji2++) {
          var jl2 = jewels2[Math.floor(roll('jl' + ji2) * Math.min(4, jewels2.length)) % Math.min(4, jewels2.length)];
          if (jl2) gift(jl2.id, 1);
        }
      }
      if (out2.item) gift(out2.item, 1);
      if (out2.hero) {
        var sn2 = DATA.NPC_GUARD_SURNAME || ['王'], gv2 = DATA.NPC_GUARD_GIVEN || ['虎'];
        var hname2 = null;
        for (var hi2 = 0; hi2 < 6 && !hname2; hi2++) {
          var cand2 = sn2[Math.floor(roll('hn' + hi2) * sn2.length) % sn2.length] +
            gv2[Math.floor(roll('hg' + hi2) * gv2.length) % gv2.length];
          var dup2 = (s.generals || []).some(function (gg2) { return gg2.name === cand2; });
          if (!dup2) hname2 = cand2;
        }
        if (hname2) {
          var base22 = 58 + Math.floor(roll('ht') * 20);
          var hh2 = { name: hname2, tong: base22, nz: base22, yw: base22, zm: base22 };
          var gg3 = GAME.makeHero(hh2, 30);
          gg3.loyalty = 60;
          if (home2) gg3.cityId = home2.id;
          s.generals.push(gg3);
          texts.push('「' + hname2 + '」慕名来投，愿效犬马之劳');
        } else {
          gift('zhenzhu', 1);       /* 重名兜底：换成一枚珍珠 */
          texts.push('（豪杰名讳与麾下相重，留下贺礼一份）');
        }
      }
      if (out2.wound) {
        GAME.setStaNow(gen, Math.max(0, GAME.staNow(gen) - out2.wound));
        texts.push(gen.name + ' 负伤，体力 −' + out2.wound);
        bad = true;
      }
      if (!texts.length) { texts.push('此行无所获'); bad = true; }
      var line2 = a.icon + ' ' + a.name + '：' + out2.t + '（' + texts.join('、') + '）';
      GAME.log('🏕️ ' + ((DATA.TERRAIN[tile.terrain] || {}).name || '') + ' · ' + line2);
      return { ok: true, name: out2.t, text: texts.join('、'), bad: bad };
    }"""
    assert d.count(ANCHOR) == 1, 'visit 分支锚点 %d 次' % d.count(ANCHOR)
    d = d.replace(ANCHOR, SCENE, 1)
    dirty = True
    print('OK 2/2 scene 分支已并入 jianghuDo')

if dirty:
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('落盘完成')
else:
    print('全部跳过（幂等）')

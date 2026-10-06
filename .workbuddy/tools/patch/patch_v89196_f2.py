# -*- coding: utf-8 -*-
"""v89.196 批次F2：4 条红的修复与诊断
F2a §196② 锚修正（注释查 raw、代码查 stripped）
F2b §196③ 加 extra（诊断项全打）
F2c §196④ 加 extra
F2d §194④ 集齐系列加 extra（定位哪一步红）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

# ---------------- F2a §196② 锚修正 ----------------
F2A_OLD = """    check('§196② 放手清拔除登记（源码锚 · 行为在 §195② 名额闭环内）', (function () {
      return /if \\(s\\.fortsTaken\\) delete s\\.fortsTaken\\[key\\];/.test(dS196)
        && /可重新占据/.test(dS196);
    })());"""
F2A_NEW = """    check('§196② 放手清拔除登记（源码锚 · 行为在 §195② 名额闭环内）', (function () {
      /* "可重新占据"在注释里 → 查 raw；可执行形态查剥注释版。 */
      return /if \\(s\\.fortsTaken\\) delete s\\.fortsTaken\\[key\\];/.test(dS196)
        && /可重新占据/.test(raw196('domain.js'));
    })());"""
rep('smoke-test.js', 'F2a §196② 锚修正', F2A_OLD, F2A_NEW, '查 raw；可执行形态查剥注释版')

# ---------------- F2b §196③ 加 extra ----------------
F2B_OLD = """        G.battle.autoBattle(rec.id);
        var jd = G._battleJustDone;
        if (!jd || !jd.ok || !jd.report) return false;
        var sb = G.battle.sandboxOf(jd.report);
        return !!sb && sb.frames.length > 0 && sb.rounds > 0
          && jd.report === st.reports[0];
      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })());"""
F2B_NEW = """        G.battle.autoBattle(rec.id);
        var jd = G._battleJustDone;
        if (!jd || !jd.ok || !jd.report) { global.__d196c = 'jd=' + JSON.stringify({ ok: jd && jd.ok, rep: !!(jd && jd.report) }); return false; }
        var sb = G.battle.sandboxOf(jd.report);
        global.__d196c = 'frames=' + (sb ? sb.frames.length : -1) + ' rounds=' + (sb ? sb.rounds : -1)
          + ' same=' + (jd.report === st.reports[0]) + ' n=' + n;
        return !!sb && sb.frames.length > 0 && sb.rounds > 0
          && jd.report === st.reports[0];
      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })());"""
rep('smoke-test.js', 'F2b §196③ extra', F2B_OLD, F2B_NEW, "global.__d196c = 'frames='")
rep('smoke-test.js', 'F2b2 §196③ 第三参', """      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })());""", """      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })(), global.__d196c || '');""", "G._battleJustDone = bkJD; }\n    })(), global.__d196c")

# ---------------- F2c §196④ 加 extra ----------------
F2C_OLD = """    check('§196④ fortRingOf 唯一出口：R1=12 段手算锚 + 段=环 + 缓存同对象', (function () {
      var r1 = G.map.fortRingOf(1);
      var r3 = G.map.fortRingOf(3);
      return r1.segs.length === 12 && r1.ring.length === 12
        && r3.segs.length === r3.ring.length && r3.segs.length >= 24
        && G.map.fortRingOf(3) === r3;
    })());"""
F2C_NEW = """    check('§196④ fortRingOf 唯一出口：R1=12 段手算锚 + 段=环 + 缓存同对象', (function () {
      var r1 = G.map.fortRingOf(1);
      var r3 = G.map.fortRingOf(3);
      global.__d196d = 'r1=' + r1.segs.length + '/' + r1.ring.length
        + ' r3=' + r3.segs.length + '/' + r3.ring.length
        + ' cache=' + (G.map.fortRingOf(3) === r3);
      return r1.segs.length === 12 && r1.ring.length === 12
        && r3.segs.length === r3.ring.length && r3.segs.length >= 24
        && G.map.fortRingOf(3) === r3;
    })());"""
rep('smoke-test.js', 'F2c §196④ extra', F2C_OLD, F2C_NEW, "global.__d196d = 'r1='")
rep('smoke-test.js', 'F2c2 §196④ 第三参', """        && G.map.fortRingOf(3) === r3;
    })());""", """        && G.map.fortRingOf(3) === r3;
    })(), global.__d196d || '');""", "&& G.map.fortRingOf(3) === r3;\n    })(), global.__d196d")

# ---------------- F2d §194④ 集齐系列加 extra ----------------
F2D_OLD = """        var repA = st.rep || 0;
        G.collectBuy(sr.items[0].id);         /* 重复 → 拒 */
        var idem = (st.rep || 0) === repA;
        return got && d.done === true && chron >= 1 && bonus
          && stAll.have === stAll.total && idem;
      } finally { G.state = bk; }
    })());"""
F2D_NEW = """        var repA = st.rep || 0;
        G.collectBuy(sr.items[0].id);         /* 重复 → 拒 */
        var idem = (st.rep || 0) === repA;
        /* v89.196 诊断：全收集若失败，列出未入藏件与其未过的条件 */
        var miss = [];
        (DATA.COLLECT.series || []).forEach(function (s3) {
          (s3.items || []).forEach(function (it) {
            if (!G.collectHaveOf(it.id)) miss.push(it.id);
          });
        });
        global.__d194c = JSON.stringify({ got: got, done: d.done, chron: chron, bonus: bonus,
          have: stAll.have, total: stAll.total, idem: idem, missN: miss.length,
          miss0: miss.slice(0, 3) });
        return got && d.done === true && chron >= 1 && bonus
          && stAll.have === stAll.total && idem;
      } finally { G.state = bk; }
    })());"""
rep('smoke-test.js', 'F2d §194④ extra', F2D_OLD, F2D_NEW, 'global.__d194c = JSON.stringify')
rep('smoke-test.js', 'F2d2 §194④ 第三参', """          && stAll.have === stAll.total && idem;
      } finally { G.state = bk; }
    })());""", """          && stAll.have === stAll.total && idem;
      } finally { G.state = bk; }
    })(), global.__d194c || '');""", "} finally { G.state = bk; }\n    })(), global.__d194c")

print('批次F2 完成')

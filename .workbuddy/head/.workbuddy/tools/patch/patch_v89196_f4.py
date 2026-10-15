# -*- coding: utf-8 -*-
"""v89.196 批次F4：§196③ 兼容两种结算走向（挂起→autoBattle / 直接自动结算）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

F4_OLD = """        if (!w) { global.__d196c = 'no-wild'; return false; }
        st.marches = st.marches || [];
        var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
        if (!r.ok) { global.__d196c = 'dispatch: ' + r.msg; return false; }
        var n = 0;
        while (st.marches.length && n < 400) { G.march.tick(); n++; if (st.battles && st.battles.length) break; }
        var rec = (st.battles || [])[0];
        if (!rec) { global.__d196c = 'no-battle marches=' + st.marches.length + ' n=' + n; return false; }
        G.battle.autoBattle(rec.id);
        var jd = G._battleJustDone;
        if (!jd || !jd.ok || !jd.report) { global.__d196c = 'jd=' + JSON.stringify({ ok: jd && jd.ok, rep: !!(jd && jd.report) }); return false; }
        var sb = G.battle.sandboxOf(jd.report);
        global.__d196c = 'frames=' + (sb ? sb.frames.length : -1) + ' rounds=' + (sb ? sb.rounds : -1)
          + ' same=' + (jd.report === st.reports[0]) + ' n=' + n;
        return !!sb && sb.frames.length > 0 && sb.rounds > 0
          && jd.report === st.reports[0];
      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })(), global.__d196c || '');"""
F4_NEW = """        if (!w) { global.__d196c = 'no-wild'; return false; }
        st.marches = st.marches || [];
        var r0 = (st.reports || []).length;
        var r = G.march.dispatch({ kind: 'wild', x: w.x, y: w.y }, 'raid', { yibing: 60000 }, lord.id);
        if (!r.ok) { global.__d196c = 'dispatch: ' + r.msg; return false; }
        var n = 0;
        while (st.marches.length && n < 400) { G.march.tick(); n++; if (st.battles && st.battles.length) break; }
        /* v89.196：抵达后有两种走向 —— ① 战斗挂起（待指挥）→ autoBattle 打完
           （结束回执 _battleJustDone.report 直通）；② 直接自动结算（依设置）→ 战报已生成。
           两种都要能拿到"可回看"的 report（老板"不管哪种情形都能看全程"）。 */
        var rec = (st.battles || [])[0];
        var rep = null, via = '';
        if (rec) {
          G.battle.autoBattle(rec.id);
          var jd = G._battleJustDone;
          if (jd && jd.ok && jd.report && jd.report === st.reports[0]) { rep = jd.report; via = 'jd'; }
        } else {
          if ((st.reports || []).length > r0) { rep = st.reports[0]; via = 'auto'; }
        }
        if (!rep) {
          global.__d196c = 'no-report via=' + via + ' battles=' + (st.battles || []).length
            + ' reports=' + (st.reports || []).length + '/' + r0 + ' n=' + n;
          return false;
        }
        var sb = G.battle.sandboxOf(rep);
        global.__d196c = 'via=' + via + ' frames=' + (sb ? sb.frames.length : -1)
          + ' rounds=' + (sb ? sb.rounds : -1) + ' n=' + n;
        return !!sb && sb.frames.length > 0 && sb.rounds > 0;
      } finally { G.state = bk; G._battleJustDone = bkJD; }
    })(), global.__d196c || '');"""
rep('smoke-test.js', 'F4 §196③ 双走向', F4_OLD, F4_NEW, '抵达后有两种走向')

print('批次F4 完成')

# -*- coding: utf-8 -*-
"""
v89.89 · C3 门派晋升曲线校准（老板拍板：加来源 + 重估到 2-3 个月）

① data.js：
   · DATA.SECT_RANKS 重估：0/2000/12000/60000/300000 → 0/1000/6000/25000/60000
     （长老：纯任务 625 天 → 任务+占城双来源下约 60~90 天可达）
   · 新增 DATA.SECT_CONQUER_REP（占城一次性门派声望分档）
② domain.js：
   · 新增 GAME.sectRepGain(src, n) —— 门派声望唯一发放出口（含晋升检测）
   · doSectTask 改走该出口（行为一致，晋升文案改由返回值驱动）
③ battle.js：
   · onConquer 加占城 → 门派声望（未入派自动拒）
④ smoke-test.js：
   · v89.74 门槛断言同步新值（原值断言会红）
"""
import io, sys

R = 'E:\\Deepseekdb\\'
ok_all = True

def patch(path, pairs, tag):
    global ok_all
    s = io.open(path, encoding='utf-8', newline='').read()
    for old, new in pairs:
        n = s.count(old)
        if n != 1:
            print('[FAIL] %s 锚点命中 %d 次（应 1）：%s' % (tag, n, old[:80].replace('\n', '\\n')))
            ok_all = False
            return
        s = s.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    print('[OK] %s' % tag)

# ============================================================
# ① data.js
# ============================================================
patch(R + 'js\\data.js', [
    # --- 门槛重估 ---
    ("""  /* 五阶：门槛按"升阶难度极大"定（拍板），自 0 递增 6 倍量级 */
  DATA.SECT_RANKS = [
    { id: 'r1', name: '门客',     rep: 0 },
    { id: 'r2', name: '外门弟子', rep: 2000 },
    { id: 'r3', name: '内门弟子', rep: 12000 },
    { id: 'r4', name: '真传弟子', rep: 60000 },
    { id: 'r5', name: '长老',     rep: 300000 },
  ];""",
     """  /* 五阶门槛（v89.89 · 老板拍板 C3「加来源 + 重估到 2-3 个月」）——
     原 0/2000/12000/60000/300000：声望唯一来源是门派任务（480/日封顶），
     长老 = 625 天现实时间（100+ 轮实玩实测），长线玩家永远够不着。
     重估依据：任务（480+/日）+ 占城（SECT_CONQUER_REP 分档）双来源下——
       · 纯杂役：60000 / 480 ≈ 125 天（最慢路径）
       · 带占城（90 天内占 10~20 城）：约 65~90 天跨过长老线 ✅ 目标区间
     保留"逐阶递增、后段最难"的结构（×6 → ×4.2 → ×2.4，后段靠占城加速）。 */
  DATA.SECT_RANKS = [
    { id: 'r1', name: '门客',     rep: 0 },
    { id: 'r2', name: '外门弟子', rep: 1000 },
    { id: 'r3', name: '内门弟子', rep: 6000 },
    { id: 'r4', name: '真传弟子', rep: 25000 },
    { id: 'r5', name: '长老',     rep: 60000 },
  ];
  /* v89.89（老板拍板 · C3）：占城 → 门派声望（一次性，按城档）。
     门派系统规则 §六"声望来源"的"占城"一条落地（另一条"江湖游历"随 C1 保持剥离）。
     未入派者不给（走 GAME.sectRepGain 唯一出口，无门派自动拒）。 */
  DATA.SECT_CONQUER_REP = { county: 1500, jun: 4000, zhou: 12000, capital: 30000 };"""),
], 'data.js 门槛重估 + 占城分档')

# ============================================================
# ② domain.js：sectRepGain 唯一出口 + doSectTask 改走
# ============================================================
patch(R + 'js\\domain.js', [
    # --- 新出口（插在 doSectTask 之前） ---
    ("""  GAME.doSectTask = function (tid) {""",
     """  /* v89.89（老板拍板 · C3）：门派声望**唯一发放出口** ——
     门派系统规则 §六："声望来源（全部走 sectRepGain，逐条给权重，便于审计）"。
     来源标识 src：'task'（门派任务）/ 'conquer'（开疆拓土）……
     返回 { ok, gain, rankUp }：rankUp = 本次跨过新阶门槛时的品阶名（无则 null）。
     未入派一律不给（没有门派，哪来门派声望）。 */
  GAME.sectRepGain = function (src, n) {
    var st = GAME.sectState();
    n = Math.max(0, Math.round(Number(n) || 0));
    if (!st.id || !n) return { ok: false, gain: 0, rankUp: null };
    var before = GAME.sectRankIndex();
    st.rep += n;
    var after = GAME.sectRankIndex();
    return {
      ok: true, gain: n,
      rankUp: (after > before) ? ((DATA.SECT_RANKS || [])[after] || {}).name : null,
    };
  };

  GAME.doSectTask = function (tid) {"""),
    # --- doSectTask 改走出口 ---
    ("""    /* 开山祖师：任务声望 ×1.5（拍板里"立派"与"入派"的唯一实质差别，P0 只此一项） */
    var gain = st.founder ? Math.round(def.rep * 1.5) : def.rep;
    var day = GAME.questDayIndex();
    st.rep += gain; st.tasks[day] = (st.tasks[day] || 0) + 1;
    var up = '';
    var nx = GAME.sectNextRankOf();
    if (nx && st.rep >= nx.rep) up = '　🎉 晋升「' + nx.name + '」';
    return { ok: true, msg: def.name + '　声望 +' + gain + '（共 ' + U.fmt(st.rep) + '）' + up, rep: gain };""",
     """    /* 开山祖师：任务声望 ×1.5（拍板里"立派"与"入派"的唯一实质差别，P0 只此一项） */
    var gain = st.founder ? Math.round(def.rep * 1.5) : def.rep;
    var day = GAME.questDayIndex();
    /* v89.89（C3）：声望发放与晋升检测统一走 sectRepGain（与占城同一出口） */
    var g = GAME.sectRepGain('task', gain);
    st.tasks[day] = (st.tasks[day] || 0) + 1;
    var up = g.rankUp ? '　🎉 晋升「' + g.rankUp + '」' : '';
    return { ok: true, msg: def.name + '　声望 +' + gain + '（共 ' + U.fmt(st.rep) + '）' + up, rep: gain };"""),
], 'domain.js sectRepGain + doSectTask')

# ============================================================
# ③ battle.js：onConquer 占城给门派声望
# ============================================================
patch(R + 'js\\battle.js', [
    ("""    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1)
      * (1 + GAME.artifactBonusNum('repPct')));   /* v79：传国玉玺 —— 声望获得 +5%/级 */
    s.rep += repGain;""",
     """    var repGain = Math.round((npcCity.rep || 10) * (GAME.story && GAME.story.repMult ? GAME.story.repMult() : 1)
      * (1 + GAME.artifactBonusNum('repPct')));   /* v79：传国玉玺 —— 声望获得 +5%/级 */
    s.rep += repGain;
    /* v89.89（老板拍板 · C3）：开疆拓土 → **门派声望**（门派系统规则 §六"占城"来源）。
       一次性按城档发（DATA.SECT_CONQUER_REP），未入派自动拒（sectRepGain 内部守卫）。 */
    var _sg = GAME.sectRepGain ? GAME.sectRepGain('conquer',
      (DATA.SECT_CONQUER_REP || {})[npcCity.type] || 0) : { ok: false };
    if (_sg.ok) {
      GAME.log('🎋 门派声望 +' + _sg.gain + '（开疆拓土 · ' + npcCity.name + '）'
        + (_sg.rankUp ? '　🎉 晋升「' + _sg.rankUp + '」' : ''));
    }"""),
], 'battle.js onConquer 占城声望')

# ============================================================
# ④ smoke-test.js：v89.74 门槛断言同步
# ============================================================
patch(R + 'smoke-test.js', [
    ("""    if (R[0].rep !== 0 || R[1].rep !== 2000 || R[2].rep !== 12000 || R[3].rep !== 60000 || R[4].rep !== 300000) return false;""",
     """    /* v89.89（C3）：门槛重估后同步（0/1000/6000/25000/60000） —— 逐阶递增校验 */
    if (R[0].rep !== 0 || R[1].rep !== 1000 || R[2].rep !== 6000 || R[3].rep !== 25000 || R[4].rep !== 60000) return false;
    if (!(R[0].rep < R[1].rep && R[1].rep < R[2].rep && R[2].rep < R[3].rep && R[3].rep < R[4].rep)) return false;"""),
    ("""    /* ⑦ 品阶**不存档、由声望实时推**（拍板）：直接改 rep 就能看到品阶跟着走 */
    st.rep = 300000;
    var rk = G.sectRankOf();""",
     """    /* ⑦ 品阶**不存档、由声望实时推**（拍板）：直接改 rep 就能看到品阶跟着走 */
    st.rep = 60000;                       /* v89.89（C3）：新长老门槛 */
    var rk = G.sectRankOf();"""),
], 'smoke-test.js v89.74 断言同步')

print('DONE' if ok_all else 'HAS-FAILURES')
sys.exit(0 if ok_all else 1)

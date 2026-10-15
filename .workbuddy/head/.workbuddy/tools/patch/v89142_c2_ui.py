# v89.142 C2：ui.js + main.js + state.js —— 收编按钮/规则文案与守城文案
# 跑法：python .workbuddy/tools/patch/v89142_c2_ui.py
import io
PU = 'E:/Deepseekdb/js/ui.js'
PM = 'E:/Deepseekdb/js/main.js'
PT = 'E:/Deepseekdb/js/state.js'
bu = io.open('E:/Deepseekdb/backup/v89142/ui.js.before', encoding='utf-8', newline='').read()
bm = io.open('E:/Deepseekdb/backup/v89142/main.js.before', encoding='utf-8', newline='').read()
bt = io.open('E:/Deepseekdb/backup/v89142/state.js.before', encoding='utf-8', newline='').read()

def patch(P, bak, pairs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in pairs:
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        print('OK ' + tag)
    assert '\r\n' not in s
    assert (s.count('{') - s.count('}')) == (bak.count('{') - bak.count('}')), '花括号盈亏[' + P + ']'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('WROTE ' + P + ' len ' + str(len(s)))

# ---------- ui.js：campCard 俘虏区 ----------
patch(PU, bu, [
 ("""    /* 俘虏营 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var cPop = (GAME.captivePopOf ? GAME.captivePopOf(s.captives) : cn);
    var rep = Math.max(1, Math.round(cn / 50));
    return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
      '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中<b>不限量</b>）　·　' +
        '<b>收编为民</b>：收编这一刻才加人口，增量 = 俘虏总人口（兵种人数 × 兵种人口）　·　' +
        '<b>释放</b>：不添人口，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (cn ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (cn ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cPop, 0) + '）</button>' +
        '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
        (cn ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';""",
  """    /* 俘虏营 —— v89.142（老板 5）：收编 = **直接转入本城相应兵种** + 支金（造价 50%）；
       花费与明细一律读唯一出口 conscriptPlanOf（界面不自己折算，防两处漂移）。 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var plan = GAME.conscriptPlanOf ? GAME.conscriptPlanOf(s.captives) : { men: cn, cost: 0, pct: 0.5 };
    var pctN = Math.round((plan.pct == null ? 0.5 : plan.pct) * 100);
    var goldN = (s.res && s.res.gold) || 0;
    var afford = cn > 0 && goldN >= plan.cost;
    var kkN = Object.keys(plan.byType || {}).length;
    var rep = Math.max(1, Math.round(cn / 50));
    return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
      '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里', null, { textOnly: true }) +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) +
        ' 人 —— 营中<b>不限量</b>）　·　' +
        '<b>收编入军</b>：**逐兵种直接转入本城军队**（数量 +N，共 ' + kkN + ' 类）；' +
        '支金 = 各兵种造价的 <b>' + pctN + '%</b>（资源按市场平价折金）　·　' +
        '<b>释放</b>：不添兵，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (afford ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (afford ? '' : ' disabled') + ' title="' + (cn
          ? (goldN >= plan.cost ? '逐兵种转入本城军队' : '黄金不足：需 ' + U.numText(plan.cost, 0) + '，现有 ' + U.numText(goldN, 0))
          : '俘虏营为空') + '">收编入军（兵 ' + U.numText(cn, 0) + ' · 费 ' + U.numText(plan.cost, 0) + ' 金）</button>' +
        '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
        (cn ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';""",
  'u-campCard俘虏'),
])

# ---------- main.js：case 注释 ----------
patch(PM, bm, [
 ("""      /* v89.116：俘虏营的两个出口（收编为民 / 释放） */""",
  """      /* v89.116：俘虏营的两个出口（收编入军 / 释放）
         v89.142（老板 5）：收编 = 逐兵种转入本城军队 + 支金（造价 50%）—— 不再加人口 */""",
  'm-注释'),
])

# ---------- state.js：守城俘获文案 ----------
patch(PT, bt, [
 ("""          GAME.log.war('🪶 俘获溃卒：' + city.name + ' +' + U.fmt(_cap113.gain) + ' 人（收编为民）');""",
  """          GAME.log.war('🪶 俘获溃卒：' + city.name + ' +' + U.fmt(_cap113.gain) + ' 人（入俘虏营 · 可收编入军）');""",
  't-守城日志'),
 ("""        + '　·　军务处·俘虏营可收编为民');""",
  """        + '　·　军务处·俘虏营可收编入军（费金 = 兵种造价的 50%）');""",
  't-守城战报'),
])
print('ALL OK')

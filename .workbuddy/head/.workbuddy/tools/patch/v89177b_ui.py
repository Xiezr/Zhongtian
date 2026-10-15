# v89.177 补丁 B：界面层 —— ① 官府弹窗「民心/民怨」段 + 两措施按钮
#   ② 君主面板五关考验清单 ③ main.js 动作与税率重算 ④ smoke 初始民心断言升级
import io

ROOT = 'E:/Deepseekdb/'
def read(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def write(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)

def rep(f, tag, old, new):
    s = read(f)
    for cand in ['heartsBox177', '_trialHTML177', 'hearts-boost', '调税即时重算民心']:
        if cand in new and cand in s:
            print('[skip] ' + tag + '（已在）'); return
    c = s.count(old)
    assert c == 1, tag + ' 锚点命中 ' + str(c) + ' 次'
    s = s.replace(old, new)
    write(f, s)
    print('[ok] ' + tag)

U = 'js/ui.js'
J = 'js/main.js'
K = 'smoke-test.js'

# ============================================================
# B1 ui.js：heartsBox177 定义（官府段之前）
# ============================================================
rep(U, 'B1 heartsBox177 定义',
"""    /* v89.174（老板 1）：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和剩余时间」""",
"""    /* ============================================================
     * v89.177（老板「官府界面增加鼓舞民心，消减民怨的措施各 1 个，标题就叫民心/民怨，
     *   显示其值」）：「民心 / 民怨」段 —— 官府要务之下、在建队列之上。
     * 值走唯一出口（heartsOf/minyuanOf，民心=100−税率×100+安抚）；
     * 两个措施各每日一次、耗金币（doHeartsAction 出口，界面不预判可行性——
     * 按了不可行会返回原因并 toast；按钮只按"本日是否已行"置灰）。
     * ============================================================ */
    var heartsBox177 = '';
    if (GAME.heartsOf && GAME.heartsActionOf) {
      var hb177 = GAME.heartsOf(), my177 = GAME.minyuanOf();
      var mkAct177 = function (a) {
        if (!a) return '';
        var nm177 = a.id === 'soothe' ? '🕊️ 消减民怨' : '🎺 鼓舞民心';
        return '<button class="btn sm' + (a.ready ? ' gold' : '') + '"' + (a.ready ? '' : ' disabled')
          + ' data-action="hearts-' + a.id + '" title="每日一次 · 消耗 ' + U.fmt(a.cost)
          + ' 金 · 安抚 +' + a.add + '（民心 / 民怨同步变化）">'
          + nm177 + '（-' + U.fmt(a.cost) + ' 金 · +' + a.add + '）'
          + (a.ready ? '' : ' · 本日已行') + '</button>';
      };
      heartsBox177 = '<div class="op-zone"><div class="op-zone-t">民心 / 民怨</div>' +
        '<div class="attr"><span class="k">民心 / 民怨</span><span class="v"><b>'
          + Math.round(hb177) + '</b> / <b>' + Math.round(my177) + '</b>'
          + '<span class="ui-sub">　税率 ' + Math.round((s.tax || 0) * 100) + '% → 基准 '
          + Math.round(GAME.heartsBaseOf()) + '　安抚 ' + Math.round(GAME.heartsComfortOf())
          + '（随时间回落）</span></span></div>' +
        '<div class="attr"><span class="k">措施</span><span class="v">'
          + mkAct177(GAME.heartsActionOf('boost')) + ' ' + mkAct177(GAME.heartsActionOf('soothe'))
          + '</span></div>' +
        '</div>';
    }
    /* v89.174（老板 1）：「在城池的官方界面，官府要务的下方，显示本城在建的建筑队列和剩余时间」""")

rep(U, 'B1b 拼接',
"""        guanfuBox + queueBox174 +     /* v89.135：官府升级期间，改名/主城/秘境照常可用；v89.174：其下接「在建队列」 */""",
"""        guanfuBox + heartsBox177 + queueBox174 +     /* v89.135：官府升级期间，改名/主城/秘境照常可用；v89.174：其下接「在建队列」；v89.177：「民心/民怨」段居中 */""")

# ============================================================
# B2 ui.js：君主面板五关考验清单
# ============================================================
rep(U, 'B2 君主面板考验',
"""            var bCap = GAME.genLevelCap(lg), bNeed = GAME.lordCultivNeed(lg);
            var bCur = Math.round(lg.cultiv || 0), atTop = (lg.level || 1) >= bCap;
            var canBreak = atTop && bNeed != null && bCur >= bNeed;""",
"""            var bCap = GAME.genLevelCap(lg), bNeed = GAME.lordCultivNeed(lg);
            var bCur = Math.round(lg.cultiv || 0), atTop = (lg.level || 1) >= bCap;
            var canBreak = atTop && bNeed != null && bCur >= bNeed;
            /* v89.177（老板「综合考验」）：五关进度（政/城/军/资/宝）——未过项红字。
               口径 = GAME.lordTrialOf（唯一出口）；按钮高亮仍只看修为（界面不预判全部门槛）。 */
            var _trial177 = GAME.lordTrialOf ? GAME.lordTrialOf(lg) : null;
            var _trialHTML177 = _trial177 ? ('<div class="ui-sub">突破考验（第 ' + _trial177.n + ' 次 · '
              + (_trial177.ok ? '五关俱过' : '未过') + '）：'
              + _trial177.rows.map(function (r2) {
                return '<span style="color:' + (r2.ok ? 'var(--green-ok)' : 'var(--red-light)') + ';">'
                  + r2.label + ' ' + U.fmt(r2.cur) + '/' + U.fmt(r2.goal) + (r2.ok ? '✓' : '✗') + '</span>';
              }).join('　') + '</div>') : '';""")

rep(U, 'B2b 清单挂载',
"""              '<div class="ui-sub">每 ' + DATA.LORD_BREAK.step + ' 级一段：练功攒修为，段顶须突破方可续升' +
              (bNeed == null ? '　·　已至天授上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div></td></tr>';""",
"""              '<div class="ui-sub">每 ' + DATA.LORD_BREAK.step + ' 级一段：练功攒修为，段顶须突破方可续升' +
              (bNeed == null ? '　·　已至天授上限' : ('（下一段 Lv' + (bCap + DATA.LORD_BREAK.step) + ' 需修为 ' + U.fmt(bNeed) + '）')) +
              '</div>' + _trialHTML177 +
              '</td></tr>';""")

# ============================================================
# B3 main.js：doSetTax 重算 + 两个动作 case
# ============================================================
rep(J, 'B3a doSetTax',
"""  GAME.doSetTax = function (v) {
    GAME.state.tax = v / 100;
    ui.toast('税率：' + v + '%');
    GAME.refreshAll();
  };""",
"""  GAME.doSetTax = function (v) {
    GAME.state.tax = v / 100;
    /* v89.177（老板「民心=100-税率*100」）：调税即时重算民心（公式口径） */
    if (GAME.applyHearts) GAME.applyHearts();
    ui.toast('税率：' + v + '%　民心 ' + Math.round(GAME.heartsOf()) + ' / 民怨 ' + Math.round(GAME.minyuanOf()));
    GAME.refreshAll();
  };""")

rep(J, 'B3b 措施 case',
"""      case 'city-opt': {
        var coR = GAME.doCityOpt(el.dataset.city, el.dataset.opt);
        ui.toast(coR.msg);
        if (coR.ok) { GAME.refreshAll(); ui.openCityPanel(GAME.cityById(el.dataset.city)); }
        break;
      }""",
"""      case 'city-opt': {
        var coR = GAME.doCityOpt(el.dataset.city, el.dataset.opt);
        ui.toast(coR.msg);
        if (coR.ok) { GAME.refreshAll(); ui.openCityPanel(GAME.cityById(el.dataset.city)); }
        break;
      }
      /* v89.177（老板「官府界面…鼓舞民心 / 消减民怨」）：两个安抚措施（每日一次 · 耗金币） */
      case 'hearts-boost':
      case 'hearts-soothe': {
        var hId177 = name === 'hearts-soothe' ? 'soothe' : 'boost';
        var hR177 = GAME.doHeartsAction(hId177);
        ui.toast(hR177.msg);
        if (hR177.ok) GAME.refreshAll();
        break;
      }""")

# ============================================================
# B4 smoke：初始民心断言升级（旧口径"100" → 公式口径"50"）
# ============================================================
rep(K, 'B4 smoke 断言',
"""  check('民心初始100', s.hearts === 100);""",
"""  /* v89.177 升级：民心 = 100−税率×100+安抚（默认税 50% → 基准 50）；
     旧断言"初始 100"是旧口径（税率>50% 才衰减）——随公式口径升级。 */
  check('民心 = 100−税率×100（默认税 50% → 50）· 缓存与出口一致',
    s.hearts === 50 && G.heartsOf() === 50);""")

print('DONE-B177')

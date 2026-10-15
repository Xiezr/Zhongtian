# -*- coding: utf-8 -*-
"""v89.117 补丁 B —— 俘虏营/伤兵营可见化 + 规则上桌面（老板需求 1）
   v89.117 补丁 C —— 城主 / 守将不得出征（老板需求 2）

B（需求 1「还是没有俘虏营或者降兵营，目前俘虏设置是什么，要让玩家看得到」）：
  两营其实已在「军务 · 军务处」，但两处不达标（诊断见 probe/实机）：
    ① 军务默认页签是「军务总览」——玩家点进军务根本看不到两营；
    ② 俘虏规则（8% / 单场上限 3000 / 来源 / 收编口径）只写在**悬停提示**里。
  改：① 总览页 ⑤ 区同时列两营（紧凑卡，含明细与入口）；
      ② 两营卡各带一段**可见的规则行**（数字读 DATA.CAPTIVE / healFeeOf 等唯一出口）；
      ③ 军务页签「军务处」挂两营合计角标（有货才显示）。
  组件收敛为**唯一出口** `ui.campCard(kind, {compact})`。

C（需求 2「城主和守将不能执行出征动作」）：
  病根：出征面板 `#exp-gen` 用 `s.generals.map` **全量列出**，缺省还取 `s.generals[0]`
  —— 城主/守将可以被选为出征主将。
  改：唯一出口 `GAME.marchBlockOf(g)` / `GAME.canMarch(g)` / `GAME.expGeneralsOf()`：
    · 界面按它置灰 + 写明原因；
    · `battle.prepare` 按同一判据**硬拦**（绕不过界面）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点匹配 %d 次' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


# ================================================================ domain.js（C：唯一出口）
load('js/domain.js')
edit('js/domain.js', """  GAME.assignGeneral = function (genId, role, cityId) {""",
     """  /* ============================================================
   * v89.117（老板「城主和守将不能执行出征动作」）
   * ------------------------------------------------------------
   * 出征主将的**唯一出口**：谁走不开，只有一个地方说了算（界面置灰 + 硬拦都读它）。
   *   · 城主（mayor）：驻城理政 —— 内政/智谋加成与守城加成都在本城，走不开；
   *   · 守将（guard）：镇守本城 —— 战时对阵要靠他，走不开；
   *   · 出征中（march）/ 采集中（gather）：本来就不在城里。
   * 返回 null = 可出征；返回字符串 = **不可出征的原因**（界面直接显示这句）。
   * 与 `GAME.assignGeneral`（任命）同族：一个人的 status 是单值，故互斥天然成立。
   * ============================================================ */
  GAME.marchBlockOf = function (g) {
    if (!g) return '帐下无此将领';
    var st = g.status || 'idle';
    if (st === 'march') return '出征中';
    if (st === 'gather') return '采集中';
    if (st === 'mayor') return '城主（驻城理政，不可出征）';
    if (st === 'guard') return '守将（镇守本城，不可出征）';
    return null;
  };
  GAME.canMarch = function (g) { return !GAME.marchBlockOf(g); };
  /* 可出征将领（保持原顺序）—— 出征面板的缺省主将也从这里取 */
  GAME.expGeneralsOf = function () {
    return ((GAME.state && GAME.state.generals) || []).filter(function (g) { return GAME.canMarch(g); });
  };

  GAME.assignGeneral = function (genId, role, cityId) {""",
     'domain.js marchBlockOf/expGeneralsOf')

# ================================================================ battle.js（C：硬拦）
load('js/battle.js')
edit('js/battle.js', """    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    if (!gen) return { ok: false, msg: '请选择出征将领' };""",
     """    var gen = null;
    for (var i = 0; i < s.generals.length; i++) if (s.generals[i].id === genId) gen = s.generals[i];
    if (!gen) return { ok: false, msg: '请选择出征将领' };
    /* v89.117（老板「城主和守将不能执行出征动作」）：与界面**同一判据**（唯一出口
       GAME.marchBlockOf）—— 界面置灰只是提示，这里才是拦得住的那道闸
       （自动出征 / 脚本 / 老档里的旧配置都会经过 prepare）。 */
    var _mb = GAME.marchBlockOf(gen);
    if (_mb) return { ok: false, msg: gen.name + ' 不可出征：' + _mb };""",
     'battle.prepare 出征资格硬拦')

# ================================================================ ui.js（B + C）
u = load('js/ui.js')

# ---- C① 出征将领下拉：唯一出口 + 置灰 ----
edit('js/ui.js', """    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select">';
    html += s.generals.map(function (g) {
      var a = GAME.genAttrs(g);
      /* v89.59（老板需求 2）：主将选项展示**六维** —— 统率 / 勇武 / 智谋 / 内政 / 速度 / 体力 */
      var six = '统' + (a.tong || 0) + ' 勇' + (a.yw || 0) + ' 智' + (a.zm || 0) + ' 政' + (a.nz || 0) +
        ' 速' + (a.spd || 0) + ' 体' + (a.staMax || 0);
      return '<option value="' + g.id + '"' + (g.id === ui._expGen ? ' selected' : '') + '>' +
        U.escape(g.name) + '（' + six + '）</option>';
    }).join('');
    html += '</select></div>';""",
     """    html += '<div class="exp-gen-row"><select id="exp-gen" class="exp-gen-select">';
    html += s.generals.map(function (g) {
      var a = GAME.genAttrs(g);
      /* v89.59（老板需求 2）：主将选项展示**六维** —— 统率 / 勇武 / 智谋 / 内政 / 速度 / 体力 */
      var six = '统' + (a.tong || 0) + ' 勇' + (a.yw || 0) + ' 智' + (a.zm || 0) + ' 政' + (a.nz || 0) +
        ' 速' + (a.spd || 0) + ' 体' + (a.staMax || 0);
      /* v89.117（老板「城主和守将不能执行出征动作」）：不可出征者**列出来但置灰**
         （比"藏起来"好：玩家一眼看出"他在当城主"）。判据走唯一出口 GAME.marchBlockOf。 */
      var blk = GAME.marchBlockOf ? GAME.marchBlockOf(g) : null;
      return '<option value="' + g.id + '"' + (g.id === ui._expGen ? ' selected' : '') +
        (blk ? ' disabled' : '') + '>' +
        U.escape(g.name) + (blk ? '（' + U.escape(blk) + '）' : '（' + six + '）') + '</option>';
    }).join('');
    html += '</select></div>';""",
     'C：出征将领下拉置灰')

# ---- C② 缺省主将：只从可出征者里取 ----
edit('js/ui.js', """    if (!ui._expGen || !s.generals.some(function (g) { return g.id === ui._expGen; })) {
      ui._expGen = s.generals[0] ? s.generals[0].id : '';
    }""",
     """    if (!ui._expGen || !s.generals.some(function (g) { return g.id === ui._expGen; })) {
      ui._expGen = s.generals[0] ? s.generals[0].id : '';
    }
    /* v89.117：缺省主将**必须可出征** —— 旧口径取 generals[0]，若那位正在当城主/守将，
       玩家一开面板就"默认选中一个不能出征的人"（点出征才报错，很别扭）。
       这里把不可出征的缺省换成第一位可出征者（一个都没有时保持原样，交给下游报错）。 */
    var _curGen = null;
    s.generals.forEach(function (g) { if (g.id === ui._expGen) _curGen = g; });
    if (GAME.marchBlockOf && GAME.marchBlockOf(_curGen)) {
      var _okGen = GAME.expGeneralsOf()[0];
      if (_okGen) ui._expGen = _okGen.id;
    }""",
     'C：缺省主将只取可出征者')

# ---- B：两营唯一组件（替代军务处里那两块 story-card）----
edit('js/ui.js', """  ui.marchAffairsHTML = function () {""",
     """  /* ============================================================
   * v89.117（老板「还是没有俘虏营或者降兵营，目前俘虏设置是什么，要让玩家看得到」）
   * ------------------------------------------------------------
   * 伤兵营 / 俘虏营的**唯一落点**仍是「军务 · 军务处」，但两处不达标（本轮诊断）：
   *   ① 军务的默认页签是「军务总览」—— 玩家点进军务**看不到两营**；
   *   ② 俘虏规则（8% / 单场上限 3000 / 来源 / 收编口径）只写在**悬停提示**里，
   *      不悬停就看不见（老板原话：「目前俘虏设置是什么，要让玩家看得到」）。
   * 改：本函数收成**唯一组件** —— 军务处 full / 总览 compact 两种密度，
   *     规则一律**可见文字**，数字读唯一出口（DATA.CAPTIVE / healFeeOf），不抄文案。
   * ============================================================ */
  ui.campCard = function (kind, opts) {
    var o = opts || {};
    var s = GAME.state;
    var compact = !!o.compact;
    var C = DATA.CAPTIVE || {};
    var ratePct = Math.round((C.rate == null ? 0.08 : C.rate) * 100);
    var capN = C.cap == null ? 3000 : C.cap;
    var srcNames = { wild: '野地', fort: '据点', city: '名城', defense: '守城得手' };
    var srcTxt = (C.kinds || []).map(function (k) { return srcNames[k] || k; }).join(' / ');
    if (kind === 'wounded') {
      var wn = s.wounded || 0;
      var fee = GAME.healFeeOf ? GAME.healFeeOf(wn) : wn * 10;
      var wr = Math.round(((DATA.EXPEDITION || {}).woundedRate || 0.45) * 100);
      if (compact) {
        return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🏥 伤兵营</span>' +
          '<span class="wb-n">' + U.numText(wn, 0) + ' 名</span></div>' +
          ui.armyBreakdownRows(s.woundedArmy, '（营中无伤兵）') +
          '<div class="camp-rule">来源：战斗阵亡者的 ' + wr + '% 折为伤兵（`DATA.EXPEDITION.woundedRate`）　·　' +
            '治疗：花黄金一次性归队（逐兵种加回本城）</div>' +
          '<div class="auto-line"><button class="btn' + (wn ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
            (wn ? '' : ' disabled') + '>治疗伤兵</button>' +
            '<span class="ui-sub">治疗费 ' + U.numText(fee, 0) + ' 金</span></div></div>';
      }
      return '<div class="story-card"><div class="gold-heading">🏥 伤兵营（本境）' +
        ui.help('伤兵随战斗产生（阵亡者按回收率折为伤兵，**兵种构成也记账**）。\\n' +
          '「治疗」走既有出口 heal-wounded（花黄金，一次治完归队 —— 逐兵种加回当前城池）。\\n' +
          '这里是伤兵营的**唯一落点**：校场 / 行军 / 行军弹窗只留一行指引。') + '</div>' +
        '<div class="res-line"><span class="lbl">在营养伤</span><span class="val">' + U.numText(wn, 0) + ' 人</span></div>' +
        ui.armyBreakdownRows(s.woundedArmy, '伤兵营已空 —— 打完仗有了伤兵会列在这里') +
        '<div class="camp-rule"><b>规则</b>　来源：战斗阵亡者按 <b>' + wr + '%</b> 折为伤兵（受伤者不当场消失）　·　' +
          '归队：花黄金一次性治疗，按兵种加回本城　·　自动化：可在「自动化 · 治疗伤兵」开启自动治疗</div>' +
        '<div class="auto-line"><button class="btn' + (wn > 0 ? ' gold' : ' dim') + '" data-action="heal-wounded"' +
          (wn > 0 ? '' : ' disabled') + '>治疗伤兵（归队）</button>' +
          '<span class="ui-sub">治疗费 ' + U.numText(fee, 0) + ' 金　·　无伤兵时无需治疗</span></div></div>';
    }
    /* 俘虏营 */
    var cn = GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0;
    var rep = Math.max(1, Math.round(cn / 50));
    if (compact) {
      return '<div class="camp-card"><div class="wb-head"><span class="wb-t">🪶 俘虏营</span>' +
        '<span class="wb-n">' + U.numText(cn, 0) + ' 名</span></div>' +
        ui.armyBreakdownRows(s.captives, '（营中无俘虏）') +
        '<div class="camp-rule">来源：' + U.escape(srcTxt) + '　·　折算：敌军逐兵种损失的 <b>' + ratePct +
          '%</b>（单场上限 ' + U.numText(capN, 0) + '）　·　收编为民 = 并入住民；释放 = 换声望</div>' +
        '<div class="auto-line"><button class="btn' + (cn ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
          (cn ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cn, 0) + '）</button>' +
          '<button class="btn' + (cn ? '' : ' dim') + '" data-action="release-captives"' +
          (cn ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button></div></div>';
    }
    return '<div class="story-card"><div class="gold-heading">🪶 俘虏营（本境）' +
      ui.help('俘虏来源：野地 / 据点 / 名城 / 守城得手 —— 按**敌军逐兵种损失**折算（DATA.CAPTIVE：'
        + ratePct + '% · 单场上限 ' + U.numText(capN, 0) + '）。\\n'
        + '收编为民：全部并入住民（人口 +N）；释放：不添人口，换一点声望。\\n'
        + '两处都会清空俘虏营 —— 先看清兵种再决定。') + '</div>' +
      '<div class="res-line"><span class="lbl">在营俘虏</span><span class="val">' + U.numText(cn, 0) + ' 人</span></div>' +
      ui.armyBreakdownRows(s.captives, '俘虏营已空 —— 战果里有俘获就会列在这里') +
      '<div class="camp-rule"><b>规则</b>　来源：' + U.escape(srcTxt) + '　·　' +
        '折算：敌军逐兵种损失 × <b>' + ratePct + '%</b>（不足 10 不收；单场上限 ' + U.numText(capN, 0) + ' 人）　·　' +
        '<b>收编为民</b>：俘虏并入住民（人口 +N）　·　<b>释放</b>：不添人口，换声望（每 50 人 +1）</div>' +
      '<div class="auto-line"><button class="btn' + (cn > 0 ? ' gold' : ' dim') + '" data-action="conscript-captives"' +
        (cn > 0 ? '' : ' disabled') + '>收编为民（人口 +' + U.numText(cn, 0) + '）</button>' +
        '<button class="btn' + (cn > 0 ? '' : ' dim') + '" data-action="release-captives"' +
        (cn > 0 ? '' : ' disabled') + '>释放（声望 +' + rep + '）</button>' +
        '</div></div>';
  };
  /* 两营合计（页签角标 + 总览摘要共读的唯一出口） */
  ui.campBadgeN = function () {
    var s = GAME.state || {};
    return Math.max(0, s.wounded || 0) + (GAME.captivesTotalOf ? GAME.captivesTotalOf() : 0);
  };

  ui.marchAffairsHTML = function () {""",
     'B：ui.campCard 唯一组件')

# ---- B：军务处两张卡改走组件：见 patch_v89117b2_affairs.py（切片法） ----

for p, s in files.items():
    assert '<<<<<<<' not in s and '>>>>>>>' not in s, p
    tmp = R + p + '.tmp117b'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 B+C 完成')

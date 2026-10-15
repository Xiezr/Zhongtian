# -*- coding: utf-8 -*-
"""
patch_v89118b_invasion_auto.py — v89.118 需求 3

老板令：「增加一个外敌来犯的自动化功能到自动化设置下，可手动设置是否接受外地来犯。
        相应介绍和烽火流水迁移到这里。军务·烽火仅保留预警和布防」

落法：
  · 唯一出口 GAME.invasionAcceptOn()（state.js）—— invasionDueAt / invasionTick 都读它；
    settings.invasion === false 的语义收口在这里（不再散落比较式）。
  · GAME.doToggleInvasionAccept()（main.js，与其它 doToggle 同区）+ 动作 toggle-auto-invasion。
  · ui.AUTO_ITEMS 加「🔥 外敌来犯」项；autoOnOf / autoMsgOf / autoPaneHTML 三处加分支。
  · 新增唯一出口 ui.invasionRulesHTML()（规则块，从烽火页迁移）
    + ui.beaconFlowHTML()（烽火流水，从烽火页迁移）。
  · marchBeaconHTML：删 ⓪ 规则块与 ③ 流水段，只留 ① 预警 ② 布防 + 一行指路。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    if p not in files:
        files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(path, old, new, tag):
    s = load(path)
    n = s.count(old)
    if n != 1:
        print('!! [%s] 锚点匹配 %d 次（应为 1）→ 中止' % (tag, n))
        sys.exit(1)
    files[path] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


def cut(path, a, b, new, tag):
    """起止标记切片：用 a 定位起点、b 定位终点（b 之后保留），整体替换为 new"""
    s = load(path)
    i0 = s.find(a)
    i1 = s.find(b)
    if i0 < 0 or i1 < 0 or i1 <= i0:
        print('!! [%s] 切片定位失败 i0=%d i1=%d → 中止' % (tag, i0, i1))
        sys.exit(1)
    if s.count(a) != 1 or s.count(b) != 1:
        print('!! [%s] 标记重复 a=%d b=%d → 中止' % (tag, s.count(a), s.count(b)))
        sys.exit(1)
    files[path] = s[:i0] + new + s[i1:]
    print('  ✓ %s' % tag)


# ================================================================
# 1. state.js —— invasionAcceptOn 唯一出口 + 两处收口
# ================================================================
edit('js/state.js',
"""  /* 现实时间唯一出口（毫秒）—— 测试/探针可覆写 `GAME._realNowOf` 拨钟 */
  GAME.realNow = function () { return GAME._realNowOf ? GAME._realNowOf() : U.now(); };""",
"""  /* 现实时间唯一出口（毫秒）—— 测试/探针可覆写 `GAME._realNowOf` 拨钟 */
  GAME.realNow = function () { return GAME._realNowOf ? GAME._realNowOf() : U.now(); };
  /* v89.118（老板需求 3）：「是否接受外敌来犯」的**唯一出口**。
     默认接受；`settings.invasion === false` 即"拒战"（自动化 · 外敌来犯 的开关写它）。
     —— 语义收口在此：invasionDueAt / invasionTick / 界面开关全读这一个函数，
     不再散落 `settings.invasion === false` 的比较式（两处已改读本出口）。 */
  GAME.invasionAcceptOn = function () {
    var s = GAME.state || {};
    return !(s.settings && s.settings.invasion === false);
  };""",
'C1 state.js invasionAcceptOn')

edit('js/state.js',
"""    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || (s.settings && s.settings.invasion === false)) return 0;
    var list = s.cities || [];""",
"""    var need = I.unlockCities == null ? 2 : I.unlockCities;
    if (!I.enabled || !GAME.invasionAcceptOn()) return 0;
    var list = s.cities || [];""",
'C2 invasionDueAt 收口')

edit('js/state.js',
"""    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (s.settings && s.settings.invasion === false) return 0;""",
"""    var s = GAME.state, I = DATA.INVASION || {};
    if (!s || !I.enabled) return 0;
    if (!GAME.invasionAcceptOn()) return 0;""",
'C3 invasionTick 收口')

# ================================================================
# 2. main.js —— doToggleInvasionAccept + 动作 case
# ================================================================
edit('js/main.js',
"""  /* v89.115：自动治疗开关（与其它开关同形：开启即试一次，关闭只清状态） */
  GAME.doToggleAutoHeal = function () {""",
"""  /* v89.118（老板需求 3）：「外敌来犯」开关 —— 与其它自动化开关同形。
     开 = 接受来犯（按现实时间轮番来袭）；关 = 拒战（烽火无排期、敌军不来、也无守城俘获）。 */
  GAME.doToggleInvasionAccept = function () {
    var s = GAME.state;
    if (!s) return;
    s.settings = s.settings || {};
    var wasOn = GAME.invasionAcceptOn();
    s.settings.invasion = wasOn;          /* 反置：原本接受 → 写 false（拒战） */
    GAME.log.beacon(wasOn
      ? '🛡 已拒战：自此烽火无警（「自动化 · 外敌来犯」可随时重开）'
      : '🔥 已接受外敌来犯：诸方势力按期而来（「自动化 · 外敌来犯」可关）');
    ui.toast(wasOn ? '已拒战（外敌不来犯）' : '已接受外敌来犯');
    GAME.refreshView();
  };
  /* v89.115：自动治疗开关（与其它开关同形：开启即试一次，关闭只清状态） */
  GAME.doToggleAutoHeal = function () {""",
'C4 main.js doToggleInvasionAccept')

edit('js/main.js',
"""      case 'toggle-auto-heal': GAME.doToggleAutoHeal(); break;""",
"""      case 'toggle-auto-heal': GAME.doToggleAutoHeal(); break;
      case 'toggle-auto-invasion': GAME.doToggleInvasionAccept(); break;   /* v89.118：外敌来犯 */
      case 'go-beacon': ui._marchTab = 'beacon'; ui.setView('marches'); break;   /* 自动化 → 烽火页 */""",
'C5 main.js case')

# ================================================================
# 3. ui.js —— AUTO_ITEMS / autoOnOf / autoMsgOf
# ================================================================
edit('js/ui.js',
"""    { id: 'recruit', icon: '🧲', name: '自动招募', act: 'auto-recruit-toggle' },
    { id: 'heal', icon: '🏥', name: '自动治疗', act: 'toggle-auto-heal' },
  ];""",
"""    { id: 'recruit', icon: '🧲', name: '自动招募', act: 'auto-recruit-toggle' },
    { id: 'heal', icon: '🏥', name: '自动治疗', act: 'toggle-auto-heal' },
    /* v89.118（老板需求 3）：外敌来犯的**接受开关** + 介绍 + 烽火流水（从军务·烽火迁来） */
    { id: 'invasion', icon: '🔥', name: '外敌来犯', act: 'toggle-auto-invasion' },
  ];""",
'C6 AUTO_ITEMS 加项')

edit('js/ui.js',
"""    if (id === 'heal') return !!(s.settings && s.settings.autoHeal);
    return false;
  };""",
"""    if (id === 'heal') return !!(s.settings && s.settings.autoHeal);
    if (id === 'invasion') return GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
    return false;
  };""",
'C7 autoOnOf 分支')

edit('js/ui.js',
"""    if (id === 'heal') return (s.autoHealState && s.autoHealState.msg) || '未开启';
    return '';
  };""",
"""    if (id === 'heal') return (s.autoHealState && s.autoHealState.msg) || '未开启';
    if (id === 'invasion') {
      if (!(GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true)) return '已拒战 —— 外敌不来犯';
      var soon = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soon || due < soon) soon = due;
      });
      if (!soon) return '已接受 · 暂无排期（城池数不够）';
      return '已接受 · 下一场 ' +
        U.dur(Math.max(0, Math.round((soon - GAME.realNow()) / 1000))) + ' 后（现实时间）';
    }
    return '';
  };""",
'C8 autoMsgOf 分支')

# ================================================================
# 4. ui.js —— invasionRulesHTML / beaconFlowHTML（从烽火页迁出的两段）
# ================================================================
edit('js/ui.js',
"""  ui.marchBeaconHTML = function () {""",
"""  /* ============================================================
   * v89.118（老板需求 3）：「外敌来犯」的**介绍（触发与规则）**与**烽火流水**——
   *   原先在「军务 · 烽火」页（v89.113 落的），本轮迁到「自动化 · 外敌来犯」：
   *   烽火页只留**预警（排期表）+ 布防**；规则与流水跟"开关"同页
   *   （管开不开的人，才最需要知道规则与历史）。
   * 字段全部动态引用 DATA.INVASION（改数值这里自动跟，不抄第二份）。
   * ============================================================ */
  ui.invasionRulesHTML = function () {
    var I = DATA.INVASION || {};
    var rMin0 = (I.realMin == null ? 30 : I.realMin);
    var wMin0 = (I.warnMin == null ? 5 : I.warnMin);
    var lo0 = Math.round((I.ratioMin == null ? 0.28 : I.ratioMin) * 100);
    var hi0 = Math.round((I.ratioMax == null ? 0.45 : I.ratioMax) * 100);
    return '<div class="story-card" style="margin-top:var(--sp-4);">' +
      '<div class="gold-heading">📜 来犯 · 触发与规则' +
      ui.help('本栏为「外敌来犯」的全局规则（与开关同页）。\\n' +
        '各城排期与布防见「军务 · 烽火」。\\n' +
        '规则字段与 DATA.INVASION 同源（改数据这里自动跟）。') + '</div>' +
      '<div class="res-line"><span class="lbl">触发点</span><span class="val">' +
        U.escape((I.sources || ['流寇']).join(' ／ ')) + '　（诸方势力轮番来犯）</span></div>' +
      '<div class="res-line"><span class="lbl">开战门槛</span><span class="val">拥有 <b>' +
        (I.unlockCities == null ? 2 : I.unlockCities) + '</b> 座以上城池后，始有兵戈之扰</span></div>' +
      '<div class="res-line"><span class="lbl">时机</span><span class="val">每 <b>' + rMin0 +
        ' 分钟</b>一场（<b>现实时间</b> —— 与本作倍速无关）；目标城<b>按场轮转</b> —— 人人有份，可预判</span></div>' +
      '<div class="res-line"><span class="lbl">规模</span><span class="val">来袭战力约为全境战力的 <b>' +
        lo0 + '%~' + hi0 + '%</b> —— 兵收拢、墙修高，便守得住</span></div>' +
      '<div class="res-line"><span class="lbl">预警</span><span class="val">提前 <b>' + wMin0 +
        ' 分钟</b>（现实时间）烽火一次；烽火台越高，警讯里的敌情越细</span></div>' +
      '<div class="res-line"><span class="lbl">离线</span><span class="val">离城期间最多补算 <b>' +
        (I.catchUpMax == null ? 3 : I.catchUpMax) + ' 场</b>，其余敌军自行散去（不翻旧账）</span></div>' +
      '<div class="res-line"><span class="lbl">底线</span><span class="val">' +
        (I.loseCity ? '城破丢城' : '<b style="color:var(--green-ok);">城破不丢城</b>') +
        ' —— 只损资源 / 兵力 / 城墙等级</span></div>' +
      '<div class="ui-sub" style="margin-top:6px;">防御三件套：驻军 · 城墙箭塔 · 城主（智谋加到城防）与守将（战时对阵）。' +
        '布防（空城计 / 坚壁清野）在「军务 · 烽火」。</div>' +
      '</div>';
  };
  /* 烽火流水（唯一落点：自动化 · 外敌来犯 —— 与开关同页） */
  ui.beaconFlowHTML = function () {
    var flow = GAME.msgsOf('beacon').slice(0, ui.BEACON_FLOW);
    if (!flow.length) return '';
    return ui.sealH('烽火流水', '最近 ' + flow.length + ' 条 · 烽火与来犯消息的唯一落点（军务·烽火 只留预警与布防）') +
      '<div class="msg-log">' + flow.map(function (m) {
        var d = new Date(m.t);
        return '<div class="bb-line beacon"><span class="bl-t">' + U.pad(d.getHours()) + ':' +
          U.pad(d.getMinutes()) + '</span>' + U.escape(m.msg) + '</div>';
      }).join('') + '</div>';
  };

  ui.marchBeaconHTML = function () {""",
'C9 两个新出口')

# ================================================================
# 5. ui.js —— marchBeaconHTML 删 ⓪ 与 ③（切片法）
# ================================================================
cut('js/ui.js',
"""    /* ⓪ 来犯规则（v89.113 · 老板「在公文·烽火界面上方列出流寇之类自动来袭的触发点和其他规则」）——
       **字段全部动态引用 DATA.INVASION**（改数值这里自动跟，不抄第二份）。 */""",
"""    /* ① 预警 —— v89.115（老板「为啥每分钟都被打一次」）：改**现实时间**节奏（每 realMin 分钟一场） */""",
"""    /* ⓪ v89.118（老板需求 3）：规则块与烽火流水**已迁至「自动化 · 外敌来犯」**——
       本页只留「预警（排期表）+ 布防」，此处给一行指路（信息不丢，位置换了）。 */
    out += '<div class="ui-sub" style="text-align:center;margin:-2px 0 8px;">' +
      '📜 来犯的触发与规则、烽火流水 → 「自动化 · 外敌来犯」（本页只留预警与布防）</div>';
""",
'C10 删 ⓪ 规则块')

cut('js/ui.js',
"""    /* ③ 流水 */
    var flow = GAME.msgsOf('beacon').slice(0, ui.BEACON_FLOW);""",
"""    return out;
  };

  ui.marchesHTML = function () {""",
"""    /* ③ v89.118（老板需求 3）：流水**已迁至「自动化 · 外敌来犯」**（与开关同页）——
       函数 ui.beaconFlowHTML() 是它的新家，本页不再渲染。 */
""",
'C11 删 ③ 流水段')

# ================================================================
# 6. ui.js —— autoPaneHTML 的 invasion 分支
# ================================================================
edit('js/ui.js',
"""        ui.autoHealLogHTML();
    }
    return head + body;
  };""",
"""        ui.autoHealLogHTML();
    } else if (it.id === 'invasion') {
      var acc = GAME.invasionAcceptOn ? GAME.invasionAcceptOn() : true;
      /* 最近一场（多城取最早）—— 与烽火页、预警同一批出口，界面不另算一份 */
      var soonCt = null, soonDue = 0;
      (s.cities || []).forEach(function (ct) {
        var due = GAME.invasionDueAt ? GAME.invasionDueAt(ct) : 0;
        if (!due) return;
        if (!soonDue || due < soonDue) { soonDue = due; soonCt = ct; }
      });
      var need0 = (DATA.INVASION || {}).unlockCities == null ? 2 : DATA.INVASION.unlockCities;
      body = '<div class="auto-line" style="margin-top:2px;">' +
          '<span class="ui-sub">' + (acc
            ? (soonCt
              ? '最近一场：<b>' + U.escape(soonCt.name) + '</b> · 剩余 <b>' +
                U.dur(Math.max(0, Math.round((soonDue - GAME.realNow()) / 1000))) + '</b>（现实时间）'
              : '已接受 · 暂无排期（拥有 <b>' + need0 + '</b> 座以上城池后开始）')
            : '已拒战：烽火无排期、敌军不来（随时可重开）') + '</span>' +
          '<button class="btn" data-action="go-beacon">🔥 去烽火页看预警与布防</button></div>' +
        '<div class="auto-note"><b>开关含义</b>：<b>开启</b> = 接受外敌来犯 —— ' +
          '诸方势力按<b>现实时间</b>轮番来袭；被击破会损资源 / 兵力 / 城墙等级，' +
          '守城得手则有俘获。' +
          '<b>关闭</b> = 拒战 —— 不再有任何来犯与预警（也没有守城俘获）。' +
          (acc ? '' : '<br><b style="color:var(--red-light);">当前：拒绝来犯</b> —— 想恢复历练点上面的按钮重开。') +
        '</div>' +
        ui.invasionRulesHTML() +
        ui.beaconFlowHTML();
    }
    return head + body;
  };""",
'C12 autoPaneHTML invasion 分支')

# ================================================================
# 7. ui.js —— "六项" 文案 → "七项"
# ================================================================
edit('js/ui.js',
"""   *   左 = 六项自动化的**清单**（图标 + 名称 + 开/关圆点 + 一行摘要）—— 简洁；""",
"""   *   左 = 七项自动化的**清单**（图标 + 名称 + 开/关圆点 + 一行摘要）—— 简洁；""",
'C13 六项→七项（注释）')

edit('js/ui.js',
"""          '六项彼此独立；「暂停」只发生在资源/条件不足时 —— 开关不会自己关掉。\\n' +""",
"""          '七项彼此独立；「暂停」只发生在资源/条件不足时 —— 开关不会自己关掉。\\n' +""",
'C14 六项→七项（help）')

# ================================================================
# 落盘（原子 + 自检）
# ================================================================
base = {}
for p in files:
    base[p] = io.open(R + '.workbuddy/backup/v89118/' + os.path.basename(p), encoding='utf-8').read()

for p, s in files.items():
    assert '<<<<<<<' not in s, p
    d0 = (s.count('{') - s.count('}')) - (base[p].count('{') - base[p].count('}'))
    if d0 != 0:
        print('!! %s 花括号净变化 %+d → 中止' % (p, d0))
        sys.exit(1)
    tmp = R + p + '.tmp118b'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s（净 %+d）' % (p, d0))
print('补丁 C 完成')

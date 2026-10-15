# -*- coding: utf-8 -*-
"""v79-B · UI 层：爵位加成展示 / 主城标识与设置入口 / 神器面板。

-

- state.js：rankBonusText（爵位加成文案，界面/表格共用）
- ui.js：cityLabelHTML 加【主城】 · 城池下拉选项加【主城】· 爵位表「食邑」列改「加成」·
  官府 head 加「设为主城」 · 君主面板（左列主城标 + 右表爵位加成/主城/神器行 + 神器入口）·
  新增 ui.openArtifacts（神器面板）
- index.html：神器面板与主城标样式
- main.js：set-main-city / open-artifacts 分发
"""
import io
import sys

ST = r'E:\Deepseekdb\js\state.js'
UI = r'E:\Deepseekdb\js\ui.js'
HTML = r'E:\Deepseekdb\index.html'
MAIN = r'E:\Deepseekdb\js\main.js'


def patch(path, old, new, tag):
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    if old in t:
        old2, new2 = old, new
    elif old.replace('\n', '\r\n') in t:
        old2, new2 = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    else:
        print('  ✗ %s：锚点不匹配，拒绝写盘' % tag)
        sys.exit(1)
    if t.count(old2) != 1:
        print('  ✗ %s：锚点命中 %d 次（须唯一），拒绝写盘' % (tag, t.count(old2)))
        sys.exit(1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t.replace(old2, new2, 1))
    print('  ✓ %s' % tag)


print('== S. state.js 文案助手 ==')
patch(ST,
"""  /* 汇总：名城档位 + 爵位 + 主城 + 神器（四层相加，唯一出口） */""",
"""  /* 爵位加成文案（爵位表 / 君主面板共用） */
  GAME.rankBonusText = function (i) {
    var b = GAME.rankBonusOf(i);
    var parts = [];
    if (b.prodPct) parts.push('产+' + Math.round(b.prodPct * 100) + '%');
    if (b.taxPct) parts.push('税+' + Math.round(b.taxPct * 100) + '%');
    if (b.storePct) parts.push('储+' + Math.round(b.storePct * 100) + '%');
    if (b.buildSlot) parts.push('造+' + b.buildSlot);
    if (b.wildCap) parts.push('野+' + b.wildCap);
    if (b.genCap) parts.push('席+' + b.genCap);
    return parts.join(' ') || '—';
  };
  /* 汇总：名城档位 + 爵位 + 主城 + 神器（四层相加，唯一出口） */""",
'S1 rankBonusText')

print()
print('== U. ui.js ==')
# U1 · 主城标识入 cityLabelHTML
patch(UI,
"""    var name = short ? U.escape(c.name) : U.escape(GAME.cityFullName(c));
    return name + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '');
  };""",
"""    var name = short ? U.escape(c.name) : U.escape(GAME.cityFullName(c));
    /* v79（老板）：「主城名称后有【主城】标识」—— 全站走这一个出口 */
    var mt = (GAME.isMainCity && GAME.isMainCity(c)) ? '<span class="city-tier mt">主城</span>' : '';
    return name + (tn ? '<span class="city-tier">[' + tn + ']</span>' : '') + mt;
  };""",
'U1 cityLabelHTML 主城标')

# U2 · 城池下拉：选项与签名
patch(UI,
"""      s.cities.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' +
          U.escape(GAME.cityFullName(x)) + ' ' + U.escape(GAME.coordText(x)) + '</option>';
      }).join('') +""",
"""      s.cities.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' +
          U.escape(GAME.cityFullName(x))
          + ((GAME.isMainCity && GAME.isMainCity(x)) ? '【主城】' : '')
          + ' ' + U.escape(GAME.coordText(x)) + '</option>';
      }).join('') +""",
'U2a 下拉选项主城标')
patch(UI,
"""    var sig = (s.cities || []).map(function (x) {
      return x.id + ':' + (x.name || '') + ':' + x.x + ',' + x.y;
    }).join(',') + '|' + c.id;""",
"""    var sig = (s.cities || []).map(function (x) {
      return x.id + ':' + (x.name || '') + ':' + x.x + ',' + x.y;
    }).join(',') + '|' + c.id + '|' + (s.mainCityId || '');   /* v79：主城变更也要刷新 */""",
'U2b 下拉签名含主城')

# U3 · 爵位表：食邑列 → 加成列
patch(UI,
"""        '<td class="num">' + U.fmt(r.salary) + '/h</td>' +
        '<td class="num">' + U.fmt(r.shiyi) + '</td></tr>';""",
"""        '<td class="num">' + U.fmt(r.salary) + '/h</td>' +
        /* v79（老板「爵位加成」）：食邑列（一直是死数据）退役，改列真实加成 */
        '<td style="font-size:var(--fs-sub);">' + GAME.rankBonusText(i) + '</td></tr>';""",
'U3a 爵位表列')
patch(UI,
"""      '<table class="tbl"><thead><tr><th>爵位</th><th>城池</th><th>声望</th><th>黄金</th><th>珠宝需求</th><th>俸禄</th><th>食邑</th></tr></thead><tbody>' + rows + '</tbody></table>' +""",
"""      '<table class="tbl"><thead><tr><th>爵位</th><th>城池</th><th>声望</th><th>黄金</th><th>珠宝需求</th><th>俸禄</th><th>加成</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="note">加成说明：产 = 全境产量 · 税 = 税收 · 储 = 仓储 · 造 = 同时建造 · 野 = 附属野地上限 · 席 = 每城将领席位。</div>' +""",
'U3b 爵位表头')

# U4 · 官府 head：设为主城
patch(UI,
"""    var head = '<div class="gold-heading">🏯 官府 · Lv' + lv + '</div>' +""",
"""    /* v79（老板）：「每人可有 1 个主城，在官府界面中设置，主城名称后有【主城】标识」 */
    var mainBtn = GAME.isMainCity(c)
      ? ' <span class="city-tier mt">主城</span>'
      : ' <button class="btn sm" data-action="set-main-city" title="' +
          U.escape('主城吃驻跸加成：' + (DATA.MAIN_CITY.desc || '').replace('君主驻跸：', '')
            + (GAME.mainCityOf()
                ? '　（迁都需 ' + U.fmt(((DATA.MAIN_CITY || {}).moveCost || {}).gold || 0) + ' 金）'
                : '　（首设免费）')) +
        '">设为主城</button>';
    var head = '<div class="gold-heading">🏯 官府 · Lv' + lv + '</div>' +""",
'U4a 官府主城变量')
patch(UI,
"""        ' <button class="btn sm' + (rn.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
        (rn.ok ? '' : ' disabled') + ' title="' +
        U.escape(rn.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn.msg) +
        '">✎ 重命名</button>' +""",
"""        ' <button class="btn sm' + (rn.ok ? '' : ' dim') + '" data-action="open-rename-city"' +
        (rn.ok ? '' : ' disabled') + ' title="' +
        U.escape(rn.ok ? '改名会同步到地图 / 侧栏 / 统计 / 战报抬头等所有引用处' : rn.msg) +
        '">✎ 重命名</button>' + mainBtn +""",
'U4b 官府主城按钮')

# U5 · 君主面板：左列主城标 + 右表三行 + 神器入口
patch(UI,
"""                return '<div class="lord-city' + (c2.id === curCity.id ? ' cur' : '') + '">' +
                  '<span class="ls-nm">🏯 ' + U.escape(c2.name) + '</span>' +""",
"""                return '<div class="lord-city' + (c2.id === curCity.id ? ' cur' : '') + '">' +
                  '<span class="ls-nm">🏯 ' + U.escape(c2.name) +
                    (GAME.isMainCity(c2) ? ' <span class="city-tier mt">主城</span>' : '') + '</span>' +""",
'U5a 君主左列主城标')
patch(UI,
"""          '<tr><td class="k">声望</td><td style="color:var(--green-ok);">' + U.fmt(s.rep) + '</td></tr>' +""",
"""          /* v79（老板）：爵位加成 / 主城 / 神器 —— 三条新系统的入口与现况 */
          '<tr><td class="k">爵位加成</td><td style="color:var(--green-ok);">' + GAME.rankBonusText() + '</td></tr>' +
          '<tr><td class="k">主城</td><td>' + (function () {
            var mc = GAME.mainCityOf();
            return mc
              ? ('🏯 ' + U.escape(mc.name) + ' <span class="ui-sub">（' + (DATA.CITY_TIER[mc.type] || '自建城') + ' · 驻跸加成中）</span>')
              : '<span class="ui-sub">未设 —— 到目标城的官府点「设为主城」</span>';
          })() + '</td></tr>' +
          '<tr><td class="k">神器</td><td>供奉 ' + U.fmt(GAME.artPts()) + '　' +
            (DATA.ARTIFACTS || []).map(function (a) {
              return a.icon + a.name.slice(0, 2) + ' Lv' + GAME.artLevelOf(a.id);
            }).join(' · ') +
            '　<button class="btn sm gold" data-action="open-artifacts">查看</button></td></tr>' +
          '<tr><td class="k">声望</td><td style="color:var(--green-ok);">' + U.fmt(s.rep) + '</td></tr>' +""",
'U5b 君主右表三行')

print()
print('== X. 神器面板 ==')
patch(UI,
"""    /* ============================================================
   * 募兵加速（v28 · 需求 8）""",
"""    /* ============================================================
   * 神器面板（v79 · 老板「神器加成（养成，主要依靠游戏时长和特殊活动逐渐提升），
   * 神器界面在君主菜单中」）
   * ------------------------------------------------------------
   * 三件神器**共用一池供奉值**（s.artifacts.pts）：
   *   · 游戏时长（主要）—— 主循环与离线补算各推一次（GAME.artTick）
   *   · 特殊活动（加速）—— 攻占城池 / 爵位晋升大额入账（GAME.artGain）
   * 等级 = 供奉值翻过的门槛数（DATA.ARTIFACT.pts）；加成走 GAME.artifactBonusNum。
   * ============================================================ */
  ui.openArtifacts = function () {
    var pts = GAME.artPts();
    var A = DATA.ARTIFACT || {};
    var maxLv = A.maxLv || 10;
    var lv = GAME.artLevelOf();
    var next = lv < maxLv ? (A.pts || [])[lv] : null;
    var pct = next ? Math.min(100, Math.floor(pts / next * 100)) : 100;
    var rows = (DATA.ARTIFACTS || []).map(function (a) {
      var l = GAME.artLevelOf(a.id);
      return '<div class="art-row">' +
        '<div class="art-ic">' + a.icon + '</div>' +
        '<div class="art-main">' +
          '<div class="art-nm">' + U.escape(a.name) + ' <span class="art-lv">Lv' + l + '</span>' +
            ' <span class="ui-sub">' + U.escape(a.theme || '') + '</span></div>' +
          '<div class="ui-sub">' + U.escape(a.desc || '') + '</div>' +
          '<div class="ui-sub" style="color:var(--gold-light);">现效力：' + GAME.artEffText(a, l) + '</div>' +
        '</div>' +
        '<div class="art-side">满级 Lv' + maxLv + '</div>' +
        '</div>';
    }).join('');
    var srcLine = '供奉来源：游戏时长 +' + (A.perGameHour || 0) + '/游戏小时（主）　·　攻占城池 '
      + '（县 ' + ((A.capturePts || {}).county || 0) + ' / 郡 ' + ((A.capturePts || {}).jun || 0)
      + ' / 州 ' + ((A.capturePts || {}).zhou || 0) + ' / 都城 ' + ((A.capturePts || {}).capital || 0)
      + '）　·　爵位晋升 +' + (A.promotePts || 0);
    ui.openModal('<div class="gold-heading">🏺 神器 · 供奉值 ' + U.fmt(pts) + '</div>' +
      '<div class="ui-sub" style="text-align:center;">' + srcLine + '</div>' +
      '<div class="pbar" style="margin:8px 0 2px;"><i style="width:' + pct + '%;"></i></div>' +
      '<div class="ui-sub" style="text-align:center;">' +
        (next ? ('距 Lv' + (lv + 1) + '：' + U.fmt(pts) + ' / ' + U.fmt(next)) : '已至最高 Lv' + lv) +
      '</div>' +
      rows +
      '<div class="note">三件神器共用一池供奉值，随游戏时间自动积累（离线同口径），攻占城池与爵位晋升可大额加速。</div>' +
      '<div class="modal-foot"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xl' });
  };

    /* ============================================================
   * 募兵加速（v28 · 需求 8）""",
'X1 openArtifacts')

print()
print('== Y. index.html 样式 ==')
patch(HTML,
"""  .city-tier { color: var(--gold-light); opacity: .85; font-size: var(--fs-cap); font-weight: 400; margin-left: 2px; }""",
"""  .city-tier { color: var(--gold-light); opacity: .85; font-size: var(--fs-cap); font-weight: 400; margin-left: 2px; }
  /* v79：【主城】标识（与档位标同族、金色描边更亮） */
  .city-tier.mt { color: #fff2c8; opacity: 1; border: 1px solid var(--gold-light);
    border-radius: 4px; padding: 0 4px; margin-left: 5px; font-weight: 700; }
  /* v79：神器面板（君主菜单 → 🏺 神器） */
  .art-row { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; margin-top: 8px;
    border: 1px solid var(--line-strong); border-radius: 8px; background: rgba(var(--sh-rgb), .22); }
  .art-ic { font-size: 30px; line-height: 1.25; }
  .art-main { flex: 1; min-width: 0; }
  .art-nm { color: var(--gold-light); font-weight: 700; margin-bottom: 2px; }
  .art-lv { color: var(--green-ok); margin-left: 4px; }
  .art-side { color: var(--text-dim); font-size: var(--fs-cap); white-space: nowrap; }""",
'Y1 主城标与神器样式')

print()
print('== Z. main.js 分发 ==')
patch(MAIN,
"""      case 'open-lord': ui.openLordInfo(); break;""",
"""      case 'open-lord': ui.openLordInfo(); break;
      /* v79（老板）：主城（官府里设；首设免费、迁都收成本） / 神器面板（君主菜单） */
      case 'set-main-city': {
        var mc = GAME.currentCity();
        var mr = GAME.setMainCity(mc ? mc.id : null);
        ui.toast(mr.msg);
        if (mr.ok) { GAME.refreshAll(); ui.openGuanfu(); }
        break;
      }
      case 'open-artifacts': ui.openArtifacts(); break;""",
'Z1 分发')

print()
print('全部完成。')

# -*- coding: utf-8 -*-
# v89.157 补丁 E：ui.js —— ① station 隐三块 ② 无相克隐藏 ③ 公文铺满（布局 px 常量）
#                     ④ 消息徽章/图标 ⑤ 官府城墙要求行 ⑥ 逐回合文字复盘入口 ⑦ 文案
import io
P = 'E:/Deepseekdb/js/ui.js'

def rd():
    return io.open(P, encoding='utf-8', newline='').read()

def rep(tag, old, new, marks):
    s = rd()
    if old in s:
        assert s.count(old) == 1, tag + ' count=' + str(s.count(old))
        io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(old, new))
        print(tag + ' OK')
        return True
    for mk in marks:
        if mk in s:
            print(tag + ' skip（已落盘：' + mk + '）')
            return False
    raise AssertionError(tag + ' anchor missing')

# ---------- ① station 也隐接战三块（老板：扩展到己方野地驻守） ----------
s = rd()
N1 = s.count(u'    if (!ui._expOwn) {')
assert N1 == 3, 'E1 count=' + str(N1)
s = s.replace(u'    if (!ui._expOwn) {',
              u'    /* v89.157（老板 1）：己方野地驻守（station）同样不接战 —— 接战三块一并隐（与调运同规） */\n'
              u'    if (!ui._expOwn && !isOwnWild137) {')
io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('E1 OK（3 处）')

# ---------- ② 无相克：整行不显示 ----------
rep('E2',
    u"""      if (!c.beats.length && !c.resists.length && !c.beaten.length) {
        h += '<div class="tip-l">无相克（凭硬实力对拼）</div>';
      }
""",
    u"""      /* v89.157（老板「无相克不显示」）：三者皆无时**整行不显示** ——
         旧版补一行"无相克（凭硬实力对拼）"，在浮层里只是噪音。 */
""",
    [u'无相克不显示'])

# ---------- ③ 公文铺满：常量改布局 px（旧值混入视觉 px，与 clientHeight 不同尺 → 少排 4 行） ----------
rep('E3-comment',
    u"""   * 实测（1600×1000 实机 · 布局值，v89.155 量）：
   *   #view-container 高 787px；标题+页签+chips 合计头高 ≈127px；
   *   系统页消息行高 24.65px（任务摘要区另占 ≈104px）；
   *   战报/侦查行（.doc-bar）高 33.33px；底注（"共 N 条"）保留 28px。
   * → 系统页默认（含摘要）= (787−127−104−28)/24.65 = 21 条；
   *   切到单主题标签（无摘要）= 25 条；战报页 = (787−127−28)/33.33 = 18 份。
   * 口径：per = floor((视图高 − 头 − 底注 − 摘要) / 行高)，下限 8 / 上限 60；
   *   拿不到布局（桩 / jsdom）→ 回落 MSG_PER / DOC_PER（旧值保留为兜底）。
   *   ⚠️ 头/摘要/底注是**实测量值** —— 改公文版式后重跑量测并更新（改动点集中在本段）。""",
    u"""   * ⛔ v89.157（老板 1「底部还是不到边」）**单位口径修正**：
   *   旧常量 127/104/28/24.65 是**视觉 px**（含 #app-scale 的 1.111 缩放），
   *   而 `vc.clientHeight` 是**布局 px**（不受 transform 影响）—— 两把尺混算，
   *   预算被低估 ≈11% → 每页少排 4 行、底部空 127px（实测）。
   * 实测（1600×1000 实机 · **布局值**，v89.157 重量）：
   *   #view-container 高 787px；标题+页签+chips 到消息区顶 = 114px；
   *   系统页消息行高 22.4px（任务摘要区另占 ≈93px）；
   *   战报/侦查行（.doc-bar）高 30.0px；底注（"共 N 条"）保留 19px。
   * → 系统页默认（含摘要）= (787−114−19−93−18)/22.4 = 24 条；
   *   切到单主题标签（无摘要）= 28 条；战报页 = (787−114−19−18)/30 = 21 份。
   * 口径：per = floor((视图高 − 头 − 底注 − 摘要 − 铺满留边) / 行高)，下限 8 / 上限 60；
   *   铺满留边 18px = 防止字体度量抖动时撑出滚动条（目标：底距 < 1 行高）。
   *   拿不到布局（桩 / jsdom）→ 回落 MSG_PER / DOC_PER（旧值保留为兜底）。
   *   ⚠️ 头/摘要/底注是**实测量值** —— 改公文版式后重跑量测并更新（改动点集中在本段）。""",
    [u'单位口径修正'])

rep('E3-const',
    u"""  ui.DOC_HEAD_H = 127;      /* 标题 + 页签 + chips 合计（实测 126.7） */
  ui.DOC_TASK_H = 104;      /* 任务摘要区（实测 103.1，仅「全部/任务」标签出现） */
  ui.DOC_FOOT_H = 28;       /* 底注"共 N 条"保留高度 */
  ui.DOC_LINE_H = { sys: 24.65, war: 33.33, scout: 33.33 };   /* 行高（实测） */""",
    u"""  ui.DOC_HEAD_H = 114;      /* 标题 + 页签 + chips 到消息区顶（布局 px · 实测 113.7） */
  ui.DOC_TASK_H = 93;       /* 任务摘要区（布局 px · 实测 92.8，仅「全部/任务」标签出现） */
  ui.DOC_FOOT_H = 19;       /* 底注"共 N 条"保留高度（布局 px） */
  ui.DOC_GUARD_H = 18;      /* 铺满留边（防字体度量抖动溢出；目标：底距 < 1 行高） */
  ui.DOC_LINE_H = { sys: 22.4, war: 30.0, scout: 30.0 };   /* 行高（布局 px · 实机重量） */""",
    [u'ui.DOC_GUARD_H'])

rep('E3-formula',
    u"""    var avail = vcH - ui.DOC_HEAD_H - ui.DOC_FOOT_H;
    if (kind === 'sys' && (ui._msgTag === 'all' || ui._msgTag === 'task')) avail -= ui.DOC_TASK_H;
    if (avail < 120) return fb;                       /* 布局异常（窗口畸形）→ 兜底 */""",
    u"""    var avail = vcH - ui.DOC_HEAD_H - ui.DOC_FOOT_H - (ui.DOC_GUARD_H || 0);
    if (kind === 'sys' && (ui._msgTag === 'all' || ui._msgTag === 'task')) avail -= ui.DOC_TASK_H;
    if (avail < 120) return fb;                       /* 布局异常（窗口畸形）→ 兜底 */""",
    [u'- (ui.DOC_GUARD_H || 0)'])

# ---------- ④ 消息行：主题徽章 + 左竖条 + 图标（区分度） ----------
rep('E4-order',
    u"""  ui.MSG_TAG_ORDER = ['war', 'task', 'era', 'weather', 'build', 'gather', 'sys'];""",
    u"""  /* v89.157：标签序 = 军情 → 任务 → 人事 → 内政 → 建造 → 采集收获 → 市易 → 改元 → 天时 → 系统 */
  ui.MSG_TAG_ORDER = ['war', 'task', 'staff', 'admin', 'build', 'gather', 'trade', 'era', 'weather', 'sys'];""",
    [u"'staff', 'admin', 'build'"])

rep('E4-helpers',
    u"""  /* 一条系统页消息行：时刻 + 文本，**字体颜色 = 主题色**（老板 2「字体颜色不同」） */
  ui.msgLineHTML = function (l) {
    var d = new Date(l.t);
    return '<div class="bb-line" style="color:' + ui.msgTagColorOf(GAME.msgSubOf(l)) + '">' +
      '<span class="bl-t">' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      U.escape(l.msg) + '</div>';
  };""",
    u"""  /* 主题色 → rgba（徽章底色用；hex 一律 #rrggbb，来自 DATA.MSG_SUBS/TAG_COLOR）。
     var(--xxx) 之类解析失败 → 回落灰（不 throw）。 */
  ui.colorA = function (hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return 'rgba(168,167,175,' + a + ')';
    var n = parseInt(m[1], 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };
  ui.msgTagIconOf = function (tag) {
    if (DATA.MSG_SUB_BY[tag]) return DATA.MSG_SUB_BY[tag].icon || '';
    return (DATA.MSG_TAG_ICON || {})[tag] || '';
  };
  /* 一条系统页消息行（v89.157 老板 1：「各类消息没有有效区分，或区分度不强」）——
     三处同时上色：① 左侧 3px 主题色竖条 ② 主题徽章（图标 + 名）③ 行文本（沿用 v89.153 字体色）。 */
  ui.msgLineHTML = function (l) {
    var d = new Date(l.t);
    var tag = GAME.msgSubOf(l);
    var c = ui.msgTagColorOf(tag);
    return '<div class="bb-line bb-sub" style="color:' + c + ';border-left-color:' + c + ';">' +
      '<span class="bl-t">' + U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()) + '</span>' +
      '<span class="ml-tag" style="color:' + c + ';background:' + ui.colorA(c, 0.12) +
        ';border-color:' + ui.colorA(c, 0.45) + ';">' +
        U.escape(ui.msgTagIconOf(tag) + ' ' + ui.msgTagNameOf(tag)) + '</span>' +
      U.escape(l.msg) + '</div>';
  };""",
    [u'ui.msgLineHTML = function (l) {\n    var d = new Date(l.t);\n    var tag'])

rep('E4-chips',
    u"""      h += '<span class="ch' + (ui._msgTag === t ? ' active' : '') + '" data-action="msg-tag" data-v="' + t +
        '" style="color:' + ui.msgTagColorOf(t) + '">' + ui.msgTagNameOf(t) + '</span>';""",
    u"""      h += '<span class="ch' + (ui._msgTag === t ? ' active' : '') + '" data-action="msg-tag" data-v="' + t +
        '" style="color:' + ui.msgTagColorOf(t) + '">' +
        U.escape(ui.msgTagIconOf(t) + ' ' + ui.msgTagNameOf(t)) + '</span>';""",
    [u'U.escape(ui.msgTagIconOf(t)'])

# ---------- ⑤ 官府面板：城墙要求行 ----------
rep('E5',
    u"""      if (b.id === 'majiu') extra = '<div class="attr"><span class="k">骑兵解锁</span><span class="v">轻骑需1级 · 铁骑/突骑需3级 · 虎豹/西凉需4级</span></div>';""",
    u"""      if (b.id === 'majiu') extra = '<div class="attr"><span class="k">骑兵解锁</span><span class="v">轻骑需1级 · 铁骑/突骑需3级 · 虎豹/西凉需4级</span></div>';
      /* v89.157（老板 3）：「城墙等级不能低于官府超过 2 级」—— 面板显式给出"下一级要的城墙等级"，
         判据与升级拦截**同一出口**（buildPrereqOf 的 wallGate），不各算一份。 */
      if (b.id === 'guanfu') {
        var wl157 = GAME.buildingLevel(c, 'chengqiang');
        var need157 = Math.max(0, (cell.build.lvl + 1) - 2);
        var ok157 = wl157 >= need157;
        extra += '<div class="attr"><span class="k">城墙要求</span><span class="v' + (ok157 ? ' good' : '') + '">' +
          (need157 <= 0
            ? ('升 Lv' + (cell.build.lvl + 1) + ' 无城墙要求')
            : ('升 Lv' + (cell.build.lvl + 1) + ' 需城墙 ≥ Lv' + need157 + '（当前 Lv' + wl157 + (ok157 ? ' ✓' : ' ✗') + '）')) +
          '</span></div>';
      }""",
    [u'need157'])

# ---------- ⑥ 战报：逐回合文字复盘入口 + 弹窗 ----------
rep('E6-btn',
    u"""    if (r.sandbox) {
      html = '<div style="text-align:center;margin:0 0 8px;">' +
        '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>' +
        '</div>' + html;
    }""",
    u"""    if (r.sandbox) {
      /* v89.157（老板「逐回合文字复盘」）：与沙盘并列的**文字**入口 ——
         数据走唯一出口 GAME.battle.roundLinesOf（与关键帧摘要同源）；
         正文页仍只有 战斗总结 / 战斗收获 / 兵种损耗 三块，文字复盘在独立弹窗里分页。 */
      var _rl157 = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
      html = '<div style="text-align:center;margin:0 0 8px;">' +
        '<button class="btn gold" data-action="open-sandbox" data-rid="' + rid + '">🎬 打开沙盘回放（逐兵种逐帧）</button>' +
        (_rl157.length >= 2
          ? '　<button class="btn" data-action="report-rounds" data-rid="' + rid + '">📜 逐回合文字复盘（' +
            _rl157.length + ' 回合）</button>' : '') +
        '</div>' + html;
    }""",
    [u"data-action=\"report-rounds\""])

rep('E6-open',
    u"""  /* v89.102：战报入口路由 —— 战斗类公文（有沙盘配方）直接进**大沙盘**；
     侦查/旧档及其它仍走正文页。两页之间可互相跳（正文页顶部有沙盘按钮）。 */""",
    u"""  /* v89.157（老板「逐回合文字复盘」）：**逐回合文字**的独立弹窗 ——
     每回合一行（唯一出口 GAME.battle.roundLinesOf），弹窗内分页（每页 12 回合）；
     与正文页三块互不干扰（老板 v89.150：「不要分回合回放、回合纪要这 2 个板块」）。 */
  ui.REPORT_ROUND_PER = 12;
  ui.openReportRounds = function (rid) {
    var r = GAME.repByRid(rid);
    if (!r) return;
    var lines = (GAME.battle.roundLinesOf ? GAME.battle.roundLinesOf(r) : []) || [];
    if (!lines.length) { ui.toast('这份战报没有逐回合记录（旧档战报或非战斗类）'); return; }
    var pg = ui.modalPage('rtr' + rid, lines, ui.REPORT_ROUND_PER, function () { ui.openReportRounds(rid); });
    var html = '<div class="gold-heading">📜 逐回合文字复盘</div>' +
      '<div style="color:var(--text-dim);font-size:var(--fs-sub);margin-bottom:10px;text-align:center;">' +
        U.escape(r.title) + '　·　共 ' + lines.length + ' 回合（一回合一行 · 措辞与关键帧同源）</div>' +
      '<div class="rt-rounds">' +
        pg.slice.map(function (t) {
          return '<div class="rt-round">' + U.escape(t) + '</div>';
        }).join('') +
      '</div>' + pg.pager +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>';
    ui.openModal(html, { size: 'xl' });
  };

  /* v89.102：战报入口路由 —— 战斗类公文（有沙盘配方）直接进**大沙盘**；
     侦查/旧档及其它仍走正文页。两页之间可互相跳（正文页顶部有沙盘按钮）。 */""",
    [u'ui.openReportRounds = function'])

# ---------- ⑦ 文案：帮助里的小标签清单 + 地块落位注释 ----------
rep('E7-help',
    u"""          '系统页按小标签筛选：军情 / 任务 / 改元 / 天时 / 建造 / 采集收获。\\n' +""",
    u"""          '系统页按小标签筛选：军情 / 任务 / 人事 / 内政 / 建造 / 采集收获 / 市易 / 改元 / 天时（只列有消息的）。\\n' +""",
    [u'人事 / 内政 / 建造 / 采集收获 / 市易'])

rep('E8-comment',
    u"""       地块落位走 GAME.extSlotOrder（**中心扩散螺旋**）—— 新增地块总是从界面中间长出来、
       向周边有序扩散；尚未解锁的位置画**暗格**（将来会长到这里）。""",
    u"""       地块落位走 GAME.extSlotOrder（**居中矩形逐圈扩张** · v89.157 老板「地块按建议」）——
       首档 12 块 = 规整 4×3 居中矩形（旧为"缺左上角的半环"）；尚未解锁的位置画**暗格**。""",
    [u'居中矩形逐圈扩张'])

chk = rd()
assert chk.count(u'!isOwnWild137') >= 3
assert u'ui.colorA = function' in chk and u'ui.openReportRounds = function' in chk
assert chk.count(u'{') == chk.count(u'}')
print('patch E ALL DONE, len =', len(chk))

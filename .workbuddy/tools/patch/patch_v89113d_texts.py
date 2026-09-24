# -*- coding: utf-8 -*-
"""
v89.113d · ⑤ 烽火页「来犯规则」块 + 16 条建筑文案（历史感）
--------------------------------------------------------------
老板令：
 「在公文·烽火界面上方列出流寇之类自动来袭的触发点和其他规则」
 「在各建筑名称下合适的地方写一个简要的说明，该建筑的主要功能，规则和作用
   （写得有历史感，大气沧桑一点？）」
"""
import io, os, shutil, re

R = r'E:/Deepseekdb'
BK = os.path.join(R, '.workbuddy', 'backup')

def sub_txt(s, a, b, tag):
    n = s.count(a)
    assert n == 1, '锚点 %s 命中 %d 次：%s' % (tag, n, a[:80])
    return s.replace(a, b, 1)

def rw(p, s, name):
    shutil.copy2(p, os.path.join(BK, name))
    io.open(p + '.tmp', 'w', encoding='utf-8', newline='').write(s)
    os.replace(p + '.tmp', p)

# ============================================================
# A. data.js —— 16 条建筑 desc 重写（文风：历史感；功能要点逐字保留）
# ============================================================
dp = os.path.join(R, 'js', 'data.js')
d = io.open(dp, encoding='utf-8').read()

DESCS = [
  ("desc: '管理中心：每级 +1 附属野地上限、+3 城外空地。'",
   "desc: '一城枢机 —— 升堂理政、课税安民。每级 +1 附属野地上限、+3 城外空地。'", '官府'),
  ("desc: '提供人口上限。'",
   "desc: '编户齐民，烟火所聚 —— 提供人口上限。'", '民房'),
  ("desc: '科技研究。等级决定可研究的科技上限（每城同时研究1项）。'",
   "desc: '聚士讲学，稽古治典 —— 等级决定可研究的科技上限（每城同时研究 1 项）。'", '书院'),
  ("desc: '训练军队。等级决定可训练兵种。'",
   "desc: '募兵练卒之所 —— 等级决定可训练的兵种。'", '军营'),
  ("desc: '出征队列与兵力上限：N级=N队、每队N×1万人马（按人数，不按人口）。'",
   "desc: '点兵演武之地 —— N 级 = N 支出征队列，每队 N×1 万人马（按人数计，不占人口）。'", '校场'),
  ("desc: '交易四种资源与黄金。等级越高折损越小（无市场也可交易，只是折损最大）。'",
   "desc: '通有无、平物价 —— 交易四种资源与黄金；等级越高折损越小（无市场亦可交易，折损最重）。'", '市场'),
  ("desc: '保护资源不被掠夺。被占领攻破则保护失效。'",
   "desc: '仓廪实而后安 —— 保护资源不被掠夺；一旦城破，护佑即失。'", '仓库'),
  ("desc: '耐久=100×N万，守军防御+10N%，远程射程+3N%。'",
   "desc: '高墙深池，御敌于外 —— 耐久 100×N 万，守军防御 +10N%，远程射程 +3N%。'", '城墙'),
  ("desc: '己方/联盟城池间行军提速（1.5倍起步）。'",
   "desc: '置驿传命，通达四方 —— 己方城池间行军提速（1.5 倍起步）。'", '驿站'),
  ("desc: '侦察：8级看兵力、9级看将领、10级看科技；10级+27×27范围内行军+50%。'",
   "desc: '烽燧相望，警讯千里 —— 侦察：8 级看兵力、9 级看将领、10 级看科技；满级 27×27 范围内行军 +50%。'", '烽火台'),
  ("desc: '养马与坐骑培育，骑兵与坐骑必备。'",
   "desc: '牧养战马，蓄力千里 —— 养马与坐骑培育，骑兵与坐骑必备。'", '马厩'),
  ("desc: '招募将领（每级+1停留将领），市井传闻查名将坐标。'",
   "desc: '招贤纳士，广听市井 —— 招募将领（每级 +1 停留将领）；市井传闻可查名将坐标。'", '客栈'),
  ("desc: '将领居所（每级+1房间），无空房不可招新。'",
   "desc: '筑馆延宾，礼贤下士 —— 将领居所（每级 +1 房间），无空房不可招新。'", '招贤馆'),
  ("desc: '江湖门派所在。入派习武、结交同道，五阶声望由门派任务累积。'",
   "desc: '江湖门墙，习武论道 —— 入派修习、结交同道；五阶声望由门派任务累积。'", '门派驻地'),
  ("desc: '打造武器与装备强化。'",
   "desc: '炉火照夜，锻铁成兵 —— 打造武器与装备强化。'", '铁匠铺'),
  ("desc: '制造攻守城器械。'",
   "desc: '百工群集，匠心营器 —— 制造攻守城器械。'", '工匠作坊'),
]
for a, b, nm in DESCS:
    d = sub_txt(d, a, b, 'desc-' + nm)
rw(dp, d, 'data.v89113b.js')
print('A. data.js：16 条建筑文案已重写')

# ============================================================
# B. ui.js —— 烽火页「来犯 · 触发与规则」块（动态引用，防漂移）
# ============================================================
up = os.path.join(R, 'js', 'ui.js')
u = io.open(up, encoding='utf-8').read()

a = """  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* ① 预警 —— v89.111（老板）：每日 9 时一场（目标轮转）；警讯显示**来袭剩余时间** */"""
b = """  ui.marchBeaconHTML = function () {
    var s = GAME.state, c = GAME.currentCity();
    var now = (s.world && s.world.elapsed) || 0;
    var out = '';
    /* ⓪ 来犯规则（v89.113 · 老板「在公文·烽火界面上方列出流寇之类自动来袭的触发点和其他规则」）——
       **字段全部动态引用 DATA.INVASION**（改数值这里自动跟，不抄第二份）。 */
    (function () {
      var I = DATA.INVASION || {};
      var AH0 = (I.attackHour == null ? 9 : I.attackHour);
      var wH0 = (I.warnHours == null ? 4 : I.warnHours);
      var lo0 = Math.round((I.ratioMin == null ? 0.28 : I.ratioMin) * 100);
      var hi0 = Math.round((I.ratioMax == null ? 0.45 : I.ratioMax) * 100);
      out += '<div class="story-card"><div class="gold-heading">📜 来犯 · 触发与规则' +
        ui.help('此页为「外敌来犯」的全局规则；各城排期与布防见下方各卡。\\n' +
          '规则字段与 DATA.INVASION 同源（改数据这里自动跟）。') + '</div>' +
        '<div class="res-line"><span class="lbl">触发点</span><span class="val">' +
          U.escape((I.sources || ['流寇']).join(' ／ ')) + '　（诸方势力轮番来犯）</span></div>' +
        '<div class="res-line"><span class="lbl">开战门槛</span><span class="val">拥有 <b>' +
          (I.unlockCities == null ? 2 : I.unlockCities) + '</b> 座以上城池后，始有兵戈之扰</span></div>' +
        '<div class="res-line"><span class="lbl">时机</span><span class="val">每日 <b>' + AH0 +
          ' 时</b>一场（游戏时间）；目标城<b>按日轮转</b> —— 人人有份，可预判</span></div>' +
        '<div class="res-line"><span class="lbl">规模</span><span class="val">来袭战力约为全境战力的 <b>' +
          lo0 + '%~' + hi0 + '%</b> —— 兵收拢、墙修高，便守得住</span></div>' +
        '<div class="res-line"><span class="lbl">预警</span><span class="val">提前 <b>' + wH0 +
          ' 游戏时</b>烽火一次；烽火台越高，警讯里的敌情越细</span></div>' +
        '<div class="res-line"><span class="lbl">底线</span><span class="val">' +
          (I.loseCity ? '城破丢城' : '<b style="color:var(--green-ok);">城破不丢城</b>') +
          ' —— 只损资源 / 兵力 / 城墙等级</span></div>' +
        '<div class="ui-sub" style="margin-top:6px;">防御三件套：驻军 · 城墙箭塔 · 城主（智谋加到城防）与守将（战时对阵）。' +
          '布防（空城计 / 坚壁清野）详见下方。</div>' +
        '</div>';
    })();
    /* ① 预警 —— v89.111（老板）：每日 9 时一场（目标轮转）；警讯显示**来袭剩余时间** */"""
u = sub_txt(u, a, b, 'B 烽火规则块')
rw(up, u, 'ui.v89113b.js')
print('B. ui.js：烽火规则块已落盘')

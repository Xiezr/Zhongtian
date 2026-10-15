# -*- coding: utf-8 -*-
# v89.153f：smoke 新增 §153 节（公文重构 + 收获明细）
import io

P = 'E:/Deepseekdb/smoke-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)

SEC = u"""  /* ============================================================
   * 153. v89.153（公文页签重排 / 系统页三源合一 + 小标签 / 采集收获明细）
   * ============================================================ */
  console.log('\\n===== 153. v89.153（系统页 / 小标签 / 收获明细） =====');
  (function () {
    var fs153 = require('fs'), p153 = require('path');
    var u153 = fs153.readFileSync(p153.join(__dirname, 'js', 'ui.js'), 'utf8');
    var d153 = fs153.readFileSync(p153.join(__dirname, 'js', 'domain.js'), 'utf8');

    /* ---- ① 页签顺序（老板 1） ---- */
    check('§153① 页签顺序 系统/战报/侦查 · 默认页 = 系统（老板原话排序）', (function () {
      var ids = G.ui.docKinds().map(function (k) { return k.id; });
      return ids.join(',') === 'sys,war,scout'
        && /ui\\._docTab = 'sys'/.test(u153)
        && GAME.msgFeedOf && GAME.msgSubOf && DATA.MSG_SUBS.length === 4;
    })());

    /* ---- ② 主题体系 + 两个唯一出口 ---- */
    check('§153② 主题表：4 主题各有 id/name/color · msgSubOf 兜底链 · msgFeedOf 三源合一', (function () {
      var okSub = DATA.MSG_SUBS.every(function (k) {
        return k.id && k.name && k.color && (DATA.MSG_SUB_BY[k.id] === k);
      });
      GAME.log('§153 测天时', 'sys', 'weather');
      GAME.log('§153 测改元', 'task', 'era');
      var feed = GAME.msgFeedOf();
      var hitW = feed.filter(function (r) { return GAME.msgSubOf(r) === 'weather'; }).length;
      var hitE = feed.filter(function (r) { return GAME.msgSubOf(r) === 'era'; }).length;
      return okSub && hitW >= 1 && hitE >= 1
        && GAME.msgSubOf({ k: 'war' }) === 'war'          /* kind 兜底 = 军情 */
        && GAME.msgSubOf({ k: 'task' }) === 'task'
        && GAME.msgSubOf({ k: 'sys' }) === 'sys';
    })());

    /* ---- ③ 系统页渲染：chips + 主题色 + 任务摘要 + 筛选 ---- */
    check('§153③ 系统页：小标签（全部 + 有消息的）· 字体色 = 主题色 · 任务摘要 · 切标签生效', (function () {
      var body = G.ui.docBodyHTML('sys');
      var colorOk = body.indexOf('style="color:' + DATA.MSG_SUB_BY.era.color) >= 0
        && body.indexOf('style="color:' + DATA.MSG_TAG_COLOR.war) >= 0;
      var bkTag = G.ui._msgTag;
      GAME.ui._msgTag = 'era';
      var eraBody = G.ui.docBodyHTML('sys');
      G.ui._msgTag = bkTag;
      return body.indexOf('data-action="msg-tag" data-v="all"') >= 0
        && body.indexOf('任务 · 可领取') >= 0 && colorOk
        && eraBody.indexOf('任务 · 可领取') < 0;          /* 切标签后摘要不显示（只在 全部/任务） */
    })());

    /* ---- ④ 采集收获明细（老板 3）---- */
    check('§153④ 收获明细唯一出口（rewardText）：地形 + 逐项带数量 · 自动收获同读', (function () {
      return /_gains153\\.join\\('；'\\)/.test(d153)
        && /rewardText: rewardText/.test(d153)
        && /r\\.rewardText \\|\\|/.test(d153)                       /* 自动收获读同一段 */
        && /采集收获（' \\+ _ter153 \\+ ' Lv'/.test(d153);
    })());
    check('§153④ 实测：收获 msg 结构化（湖泊 LvN：资源 + …；珠宝 …×N），珠宝带数量', (function () {
      var st = GAME.state, c = GAME.currentCity();
      st.wilds = st.wilds || [];
      var wk = { x: c.x + 7, y: c.y + 7 };
      st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
      st.wilds.push({ x: wk.x, y: wk.y, type: 'lake', level: 8, day: 0, startDay: 0 });
      var gen = st.generals[0];
      var bak = { status: gen.status, cityId: gen.cityId };
      GAME.map.wildAt(wk.x, wk.y).garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
      var ok = false, sawJewel = false;
      for (var i = 0; i < 12 && !sawJewel; i++) {              /* 34% 概率；每次重开采集 */
        GAME.startGather(wk.x, wk.y, { changqiang: 5000 }, { cityId: c.id });
        var g = GAME.gatherList().filter(function (x) { return x.x === wk.x && x.y === wk.y; })[0];
        if (!g) break;
        g.elapsed = 24 * 3600;
        var r = GAME.finishGather(g.id);
        if (r.ok) {
          ok = /^采集收获（湖泊 Lv8）：/.test(r.msg) && r.msg.indexOf('粮食 +') >= 0
            && typeof r.rewardText === 'string' && r.rewardText.length > 0;
          if (r.jewel) sawJewel = /珠宝 .+×\\d+/.test(r.msg);   /* 数量形态「蚌珠×2」 */
        }
      }
      GAME.map.wildAt(wk.x, wk.y).garrison = null;
      st.wilds = st.wilds.filter(function (z) { return !(z.x === wk.x && z.y === wk.y); });
      gen.status = bak.status; gen.cityId = bak.cityId;
      return ok && sawJewel;
    })());

    /* ---- ⑤ 需求档案在册 ---- */
    check('§153⑤ 需求档案在册（v89.153 · 菜单排序 / 采集收获看不到珠宝数量）', (function () {
      var a = fs153.readFileSync(p153.join(__dirname, '需求档案.md'), 'utf8');
      return a.indexOf('v89.153') >= 0 && a.indexOf('菜单排序为系统，战报，侦查') >= 0
        && a.indexOf('采集收获看不到珠宝数量') >= 0;
    })());
  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""

OLD = u"""  })();

  })();

  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"""
assert S.count(OLD) == 1, 'anchor count=' + str(S.count(OLD))
if u'153. v89.153（公文页签重排' not in S:
    S = S.replace(OLD, u"""  })();

""" + SEC)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    print('OK sec153 inserted, len %d -> %d' % (orig, len(S)))
else:
    print('skip (already)')

# -*- coding: utf-8 -*-
"""v89.230 批次 B：smoke-test.js ——
① §130①② / §131② 类名换代（walk/ride/craft）
② 六处 `cat` 恒真断言换代（§131⑨ / §163×2 / §164②③）—— 不删不放宽，按新三态重写
③ §199④ 版本正则 → v89.230；§229c⑧ 版本子句放宽（现行版本由 §199④ 逐轮锁）
④ 文件尾插入 §230 守卫段（五条）
"""

import io

def rd(p):
    return io.open(p, encoding='utf-8', newline='').read()

def wr(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

P = 'smoke-test.js'
REPORT = []

def rep(tag, old, new, cnt=1):
    s = rd(P)
    if new in s and s.count(old) == 0:
        REPORT.append('[skip] %s（已落盘）' % tag)
        return
    c = s.count(old)
    assert c == cnt, '%s count=%d（期望 %d）' % (tag, c, cnt)
    wr(P, s.replace(old, new))
    REPORT.append('[ok] %s' % tag)

# ---------- ① §130① 形态判定 + CSS 三档 ----------
rep('s130a', 
"""    check('§130① 兵牌三档（步 inf 28 / 机车 cav 32 / 器械 siege 36）+ 形态唯一出口 troopShapeOf', (function () {
      var okFn = /GAME\\.troopShapeOf = function/.test(d130)
        && /if \\(t\\.craft\\) return 'siege';/.test(d130)
        && /if \\(t\\.ride\\) return 'cav';/.test(d130)
        && d130.indexOf("t.cat === 'cav'") < 0;      /* v89.229：cat 退役 → ride 显式字段 */
      var okCss = /\\.bt-unit \\{ --u-w: 36px;/.test(h130)
        && /\\.bt-unit\\.inf \\{ --u-w: 28px; \\}/.test(h130)
        && /\\.bt-unit\\.cav \\{ --u-w: 32px; \\}/.test(h130)
        && /\\.bt-unit\\.siege \\{ --u-w: 36px; \\}/.test(h130)
        && /\\.bt-field\\.dense \\.bt-unit \\{ height: 24px; width: calc\\(var\\(--u-w\\) \\* \\.8\\)/.test(h130);
      /* 战场背景稍淡（老板 1）：中间那道深色带 .42 → .26 */
      var okBg = /rgba\\(var\\(--sh-rgb\\), \\.26\\) 50%/.test(h130) && h130.indexOf('rgba(var(--sh-rgb), .42) 50%') < 0;
      /* 形态判定实测：步行机=inf / 伏击车=cav / 无人轰炸机=siege（读数据表字段，不是名单） */
      var sh = [G.troopShapeOf('buxingji'), G.troopShapeOf('fujiche'), G.troopShapeOf('wuren')];
      _r130a = '形态 ' + sh.join('/') + ' · 背景 ' + (okBg ? '已淡' : '未变');
      return okFn && okCss && okBg && sh.join('/') === 'inf/cav/siege';
    })(), _r130a);""",
"""    check('§130① 兵牌三档（徒步 walk 28 / 机车 ride 32 / 器械 craft 36）+ 形态唯一出口 troopShapeOf（v89.230 类名同步）', (function () {
      var okFn = /GAME\\.troopShapeOf = function/.test(d130)
        && /if \\(t\\.craft\\) return 'craft';/.test(d130)
        && /if \\(t\\.ride\\) return 'ride';/.test(d130)
        && d130.indexOf("t.c" + "at === 'cav'") < 0;   /* v89.229：cat 退役（拆串防 §230③ 自命中） */
      var okCss = /\\.bt-unit \\{ --u-w: 36px;/.test(h130)
        && /\\.bt-unit\\.walk \\{ --u-w: 28px; \\}/.test(h130)
        && /\\.bt-unit\\.ride \\{ --u-w: 32px; \\}/.test(h130)
        && /\\.bt-unit\\.craft \\{ --u-w: 36px; \\}/.test(h130)
        && /\\.bt-field\\.dense \\.bt-unit \\{ height: 24px; width: calc\\(var\\(--u-w\\) \\* \\.8\\)/.test(h130)
        && !/\\.bt-unit\\.(inf|cav|siege)\\s*\\{/.test(h130);   /* v89.230：旧类名零残留 */
      /* 战场背景稍淡（老板 1）：中间那道深色带 .42 → .26 */
      var okBg = /rgba\\(var\\(--sh-rgb\\), \\.26\\) 50%/.test(h130) && h130.indexOf('rgba(var(--sh-rgb), .42) 50%') < 0;
      /* 形态判定实测：步行机=walk / 伏击车=ride / 无人轰炸机=craft（读数据表字段，不是名单） */
      var sh = [G.troopShapeOf('buxingji'), G.troopShapeOf('fujiche'), G.troopShapeOf('wuren')];
      _r130a = '形态 ' + sh.join('/') + ' · 背景 ' + (okBg ? '已淡' : '未变');
      return okFn && okCss && okBg && sh.join('/') === 'walk/ride/craft';
    })(), _r130a);""")

# ---------- ② §130① 真挂类 + §131② CSS ----------
rep('s130b',
"""    check('§130① 兵牌真挂形态类（btFieldHTML 输出含 inf/cav/siege 三档）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'buxingji', name: '步行机', count: 100, adv: 100 },
          { id: 'fujiche', name: '伏击车', count: 100, adv: 100 },
          { id: 'wuren', name: '无人轰炸机', count: 100, adv: 100 }],
        def: [{ id: 'buxingji', name: '步行机', count: 80, adv: 100 }] };
      var h = G.ui.btFieldHTML(snap);
      _r130a = 'bt-unit 类 = ' + (h.match(/bt-unit [a-z]+ (inf|cav|siege)/g) || []).join(' | ');
      return /bt-unit atk inf/.test(h) && /bt-unit atk cav/.test(h) && /bt-unit atk siege/.test(h);
    })(), _r130a);""",
"""    check('§130① 兵牌真挂形态类（btFieldHTML 输出含 walk/ride/craft 三档 · v89.230）', (function () {
      var snap = { field: 1400, towers: null,
        atk: [{ id: 'buxingji', name: '步行机', count: 100, adv: 100 },
          { id: 'fujiche', name: '伏击车', count: 100, adv: 100 },
          { id: 'wuren', name: '无人轰炸机', count: 100, adv: 100 }],
        def: [{ id: 'buxingji', name: '步行机', count: 80, adv: 100 }] };
      var h = G.ui.btFieldHTML(snap);
      _r130a = 'bt-unit 类 = ' + (h.match(/bt-unit [a-z]+ (walk|ride|craft)/g) || []).join(' | ');
      return /bt-unit atk walk/.test(h) && /bt-unit atk ride/.test(h) && /bt-unit atk craft/.test(h)
        && !/bt-unit (atk|def) (inf|cav|siege)\\b/.test(h);
    })(), _r130a);""")

rep('s131b',
"""    check('§131② 兵牌三档维持 28/32/36（老板「按目前」· 三种形态 CSS 在册）', (function () {
      return /\\.bt-unit\\.inf \\{ --u-w: 28px;/.test(h131)
        && /\\.bt-unit\\.cav \\{ --u-w: 32px;/.test(h131)
        && /\\.bt-unit\\.siege \\{ --u-w: 36px;/.test(h131);
    })());""",
"""    check('§131② 兵牌三档维持 28/32/36（老板「按目前」· 三种形态 CSS 在册 · v89.230 类名同步）', (function () {
      return /\\.bt-unit\\.walk \\{ --u-w: 28px;/.test(h131)
        && /\\.bt-unit\\.ride \\{ --u-w: 32px;/.test(h131)
        && /\\.bt-unit\\.craft \\{ --u-w: 36px;/.test(h131);
    })());""")

# ---------- ③ §131⑨ 机车族 hp/pop 最高（cat → ride） ----------
rep('s131c',
"""        if ((T[id].cat || '') !== 'cav') return;         /* 只与机车族比（自行火炮等器械不算） */""",
"""        if (!T[id].ride) return;                          /* 只与机车族比（v89.230：cat 退役 → ride；器械/徒步不算） */""")

# ---------- ④ §163 两条时长上限（cat → 三态） ----------
rep('s163a',
"""    check('§163 征兵时长：步兵（inf）全部 ≤ 60 秒（1 分钟）', (function () {
      var bad = [];
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'inf' && t.time > 60) bad.push(t.name + '=' + t.time);
      });
      return bad.length === 0;
    })(), '步行机 ' + DATA.TROOPS.buxingji.time + ' · 导弹车 ' + DATA.TROOPS.daodanche.time);""",
"""    check('§163 征兵时长：徒步（无 ride/craft）全部 ≤ 60 秒（1 分钟 · v89.230 三态换代）', (function () {
      var bad = [], n = 0;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.craft || t.ride) return;              /* v89.230：cat 退役 → 三态按 ride/craft 判定 */
        n++;
        if (t.time > 60) bad.push(t.name + '=' + t.time);
      });
      window.__r163w = 'n=' + n + (bad.length ? (' · ' + bad.join(',')) : '');
      return bad.length === 0 && n >= 4;             /* 基数自证：防"筛不到人 = 全绿"的平凡解 */
    })(), '徒步 ' + (window.__r163w || '?'));""")

rep('s163b',
"""    check('§163 征兵时长：机车（cav）全部 ≤ 300 秒（5 分钟）', (function () {
      var bad = [];
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'cav' && t.time > 300) bad.push(t.name + '=' + t.time);
      });
      return bad.length === 0;
    })(), '武装直升机 ' + DATA.TROOPS.wuzhi.time + ' · 泰坦机甲 ' + DATA.TROOPS.taitan.time);""",
"""    check('§163 征兵时长：机车（ride）全部 ≤ 300 秒（5 分钟 · v89.230 三态换代）', (function () {
      var bad = [], n = 0;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (!t.ride || t.craft) return;
        n++;
        if (t.time > 300) bad.push(t.name + '=' + t.time);
      });
      window.__r163r = 'n=' + n + (bad.length ? (' · ' + bad.join(',')) : '');
      return bad.length === 0 && n >= 1;
    })(), '机车 ' + (window.__r163r || '?'));""")

rep('s163c',
"""    check('§163 器械（craft：无人轰炸机/自行火炮/自行火炮）时间未动（仍 ≥1000）', (function () {
      return DATA.TROOPS.wuren.time >= 1000 && DATA.TROOPS.huopao.time >= 1000
        && DATA.TROOPS.huopao.time >= 1000;
    })());""",
"""    check('§163 器械（craft：无人轰炸机/自行火炮）时间未动（仍 ≥1000）', (function () {
      return DATA.TROOPS.wuren.time >= 1000 && DATA.TROOPS.huopao.time >= 1000;
    })());""")

# ---------- ⑤ §164② 上限口径（cat → 三态） ----------
rep('s164b',
"""    check('§164② 上限口径保持（步兵 ≤60 · 机车 ≤300 · 器械未动）', (function () {
      var bad = 0;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.cat === 'inf' && t.time > 60) bad++;
        if (t.cat === 'cav' && t.time > 300) bad++;
      });
      return bad === 0 && DATA.TROOPS.wuren.time >= 1000;
    })());""",
"""    check('§164② 上限口径保持（徒步 ≤60 · 机车 ≤300 · 器械未动 · v89.230 三态换代）', (function () {
      var bad = 0, nW = 0, nR = 0;
      Object.keys(DATA.TROOPS).forEach(function (k) {
        var t = DATA.TROOPS[k];
        if (t.craft) return;
        if (t.ride) { nR++; if (t.time > 300) bad++; }
        else { nW++; if (t.time > 60) bad++; }
      });
      return bad === 0 && nW >= 4 && nR >= 1 && DATA.TROOPS.wuren.time >= 1000;
    })());""")

# ---------- ⑥ §164③ 目标表覆盖（cat → ride） ----------
rep('s164c',
"""        if (DATA.TROOPS[k].cat === 'cav' && k !== 'yunshu' && !P.targets[k]) ok = false;""",
"""        if (DATA.TROOPS[k].ride && k !== 'yunshu' && !P.targets[k]) ok = false;   /* v89.230：cat 退役 → ride */""")

# ---------- ⑦ §199④ 版本正则 ----------
rep('s199d',
"""      return /GAME\\.VERSION = 'v89\\.229'/.test(mS199)   /* v89.223：版本号每轮迭代更新（本条随轮升级） */""",
"""      return /GAME\\.VERSION = 'v89\\.230'/.test(mS199)   /* v89.223：版本号每轮迭代更新（本条随轮升级） */""")

# ---------- ⑧ §229c⑧ 版本子句放宽 ----------
rep('s229c8',
"""      return /GAME\\.VERSION = 'v89\\.229'/.test(m229)
        && a229.indexOf('v89.229') >= 0 && a229.indexOf('兵种重构') >= 0""",
"""      return /GAME\\.VERSION = 'v89\\.\\d+'/.test(m229)   /* 现行版本号由 §199④ 逐轮锁（v89.230 起本处置宽松 · 只证"在册"） */
        && a229.indexOf('v89.229') >= 0 && a229.indexOf('兵种重构') >= 0""")

# ---------- ⑨ 文件尾插入 §230 守卫段 ----------
SEC230 = """  /* ============================================================
   * §230（v89.230 · 兵种链路拍板落地批）——回归哨兵
   * ------------------------------------------------------------
   * 老板拍板（v89.229 交付四问）：「2.同步」·「贴图将另外处理，先考虑兵种名称和
   *   其相关依赖和被引。确保链路通畅，方便挂载/去除特定兵种，形成可复用流程」。
   * 本段守四类：
   *   ① 形态类名同步（walk/ride/craft · 旧 inf/cav/siege 零残留）
   *   ② 兵种链体检全绿（**唯一实现在工具** audit_v89229b_troopchain —— 本段只裁决结论）
   *   ③ 测试面 `cat` 字段零消费（六处恒真断言的反向守卫 · 拆串防自命中）
   *   ④ 挂载/去除流程文档在册 + 版本与档案在册
   * ============================================================ */
  console.log('\\n===== §230 兵种链路（类名同步 · 链体检 · 挂载/去除流程）=====');
  (function () {
    var fs230 = require('fs'), path230 = require('path');
    var m230 = fs230.readFileSync(path230.join(__dirname, 'js', 'main.js'), 'utf8');
    var d230 = fs230.readFileSync(path230.join(__dirname, 'js', 'domain.js'), 'utf8');
    var h230 = fs230.readFileSync(path230.join(__dirname, 'index.html'), 'utf8');
    var self230 = fs230.readFileSync(path230.join(__dirname, 'smoke-test.js'), 'utf8');
    var a230 = fs230.readFileSync(path230.join(__dirname, '需求档案.md'), 'utf8');
    function strip230(x) { return x.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/^\\s*\\/\\/.*$/gm, ''); }

    /* ① 类名同步：新三档在册 + 旧类名可执行形态零残留 */
    check('§230① 形态类名同步：walk/ride/craft 在册 · 旧 .bt-unit.inf/.cav/.siege 零残留（剥注释）', (function () {
      var hS = strip230(h230), dS = strip230(d230);
      var okNew = /\\.bt-unit\\.walk \\{ --u-w: 28px; \\}/.test(h230)
        && /\\.bt-unit\\.ride \\{ --u-w: 32px; \\}/.test(h230)
        && /\\.bt-unit\\.craft \\{ --u-w: 36px; \\}/.test(h230)
        && /if \\(t\\.craft\\) return 'craft';/.test(dS)
        && /if \\(t\\.ride\\) return 'ride';/.test(dS);
      var okOld = !/\\.bt-unit\\.(inf|cav|siege)\\s*\\{/.test(hS)
        && dS.indexOf("return 'siege'") < 0
        && dS.indexOf("return 'cav'") < 0;
      var sh = [G.troopShapeOf('buxingji'), G.troopShapeOf('fujiche'), G.troopShapeOf('wuren')];
      window.__r230a = sh.join('/') + ' · 旧类名' + (okOld ? '零残留' : '有残留');
      return okNew && okOld && sh.join('/') === 'walk/ride/craft';
    })(), window.__r230a || '');

    /* ② 链体检：唯一实现在工具里（smoke 只裁决结论 —— 防"两处各判一份"） */
    check('§230② 兵种链体检全绿（14 兵种 × 依赖/被引 · 工具唯一实现）', (function () {
      var out;
      try {
        var TC = require(path230.join(__dirname, '.workbuddy', 'tools', 'audit', 'audit_v89229b_troopchain.js'));
        out = TC.auditTroopChain(G, DATA);
      } catch (e) { window.__r230b = 'ERR:' + String(e.message).slice(0, 140); return false; }
      window.__r230b = 'n=' + out.rows.length + ' 错' + out.errors.length + ' 警' + out.warnings.length
        + (out.errors.length ? (' · ' + out.errors.slice(0, 3).join('；')) : '');
      return out.rows.length === 14 && out.errors.length === 0;
    })(), window.__r230b || '');

    /* ③ 测试面 `cat` 字段零消费（拆串防自命中；本次六处修复的回归守卫） */
    check('§230③ 测试面 `cat` 字段零消费（旧恒真断言不再回归 · 拆串写法）', (function () {
      var head = self230.slice(0, self230.indexOf('§230'));
      var ndlA = 't.c' + 'at === ';                 /* 旧形态判定式（如 t.cat === 'inf'） */
      var ndlB = 'DATA.TROOPS[k].c' + 'at';         /* §164③ 旧读法 */
      var ndlC = '(T[id].c' + 'at';                 /* §131⑨ 旧读法 */
      window.__r230c = '在册 ' + head.length + ' 字节 · 旧读法 ' + [ndlA, ndlB, ndlC].map(function (n) { return head.indexOf(n) >= 0 ? 1 : 0; }).join('');
      return head.indexOf(ndlA) < 0 && head.indexOf(ndlB) < 0 && head.indexOf(ndlC) < 0
        && head.length > 100000;                    /* 切片自证：防"扫了半截"的平凡解 */
    })(), window.__r230c || '');

    /* ④ 挂载/去除流程文档在册（可复用流程的落地物） */
    check('§230④ 挂载/去除流程文档在册（挂载四步 · 去除四步 · 链体检用法）', (function () {
      var doc = '';
      try { doc = fs230.readFileSync(path230.join(__dirname, 'docs', 'v89230-兵种链路与挂载流程.md'), 'utf8'); }
      catch (e) { return false; }
      return doc.indexOf('挂载一个新兵种') >= 0 && doc.indexOf('去除一个兵种') >= 0
        && doc.indexOf('audit_v89229b_troopchain.js') >= 0 && doc.indexOf('链体检') >= 0
        && doc.length > 1500;
    })());

    /* ⑤ 版本与档案在册（v89.230 · 老板原话关键句逐字） */
    check('§230⑤ 版本与档案在册（v89.230 · 老板原话逐字）', (function () {
      var self2 = self230.slice(0, self230.indexOf('§230'));
      return /GAME\\.VERSION = 'v89\\.230'/.test(m230)
        && a230.indexOf('v89.230') >= 0
        && a230.indexOf('确保链路通畅') >= 0
        && a230.indexOf('方便挂载/去除特定兵种') >= 0
        && a230.indexOf('形成可复用流程') >= 0
        && self2.length > 100000;
    })());
  })();

"""

rep('sec230',
"""  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""",
SEC230 + """  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');
  process.exit(FAIL ? 1 : 0);
})();""")

for line in REPORT:
    print(line)
print('批次 B 完成')

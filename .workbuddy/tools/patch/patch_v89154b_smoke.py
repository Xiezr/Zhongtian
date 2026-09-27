# -*- coding: utf-8 -*-
"""v89.154 smoke 补丁：① 6411 行两段确认断言升级（do → arm）
② §118④ 四按钮 → 五按钮  ③ 文件末尾插 §154 节（先数清闭合层数，插完 node --check）"""
import io

R = 'E:/Deepseekdb/'
def rd(p): return io.open(R + p, encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

P = 'smoke-test.js'
s = rd(P)
done = []

# ---- ① 升级「放弃不可逆 → 有二次确认弹窗」（6411 行） ----
A1 = u"""  check('放弃不可逆 → 有二次确认弹窗', /ui\\.openAbandonWildAsk = function/.test(uS36)
    && /case 'wild-abandon-ask'/.test(mS36) && /case 'wild-abandon-do'/.test(mS36));"""
N1 = u"""  /* v89.154（老板 1）：放弃野地升级**上膛式**（二次确认 + 窗内连点两次才执行），与弃城同规 */
  check('放弃不可逆 → 两段确认弹窗 + 上膛式（连点两次才执行 · v89.154）', /ui\\.openAbandonWildAsk = function/.test(uS36)
    && /case 'wild-abandon-ask'/.test(mS36) && /case 'wild-abandon-arm'/.test(mS36)
    && !/case 'wild-abandon-do':/.test(mS36));"""
if u'上膛式（连点两次才执行 · v89.154）' in s:
    done.append('1 skip')
else:
    assert s.count(A1) == 1, '1 anchor count=' + str(s.count(A1))
    s = s.replace(A1, N1)
    done.append('1 OK')

# ---- ② §118④ 四按钮 → 五按钮 ----
A2 = u"""    check('§118④ 附属野地：操作列四按钮（派驻/采集/收获/召回）齐备且同一条唯一入口', (function () {
      var seg = uc.slice(uc.indexOf('ui.openWilds = function'), uc.indexOf('ui.openWilds = function') + 5200);
      return /<th class="ctr">操作<\\/th>/.test(seg)
        && seg.indexOf('data-action="wild-garrison-open"') >= 0
        && seg.indexOf('data-action="wild-garrison-gather"') >= 0
        && seg.indexOf('data-action="gather-finish"') >= 0
        && seg.indexOf('data-action="wild-withdraw"') >= 0
        && seg.indexOf('_gy137.ready') >= 0;     /* 收获判据与 gather-finish 同源 */
    })());"""
N2 = u"""    check('§118④ 附属野地：操作列五按钮（派驻/采集/收获/召回/放弃）齐备且同一条唯一入口', (function () {
      var seg = uc.slice(uc.indexOf('ui.openWilds = function'), uc.indexOf('ui.openWilds = function') + 5200);
      return /<th class="ctr">操作<\\/th>/.test(seg)
        && seg.indexOf('data-action="wild-garrison-open"') >= 0
        && seg.indexOf('data-action="wild-garrison-gather"') >= 0
        && seg.indexOf('data-action="gather-finish"') >= 0
        && seg.indexOf('data-action="wild-withdraw"') >= 0
        && seg.indexOf('data-action="wild-abandon-ask"') >= 0   /* v89.154（老板 1）：第 5 颗「放弃」 */
        && seg.indexOf('_gy137.ready') >= 0;     /* 收获判据与 gather-finish 同源 */
    })());"""
if u'操作列五按钮' in s:
    done.append('2 skip')
else:
    assert s.count(A2) == 1, '2 anchor count=' + str(s.count(A2))
    s = s.replace(A2, N2)
    done.append('2 OK')

# ---- ③ 末尾插 §154 节 ----
SEC = u"""
  /* ============================================================
   * 154. v89.154（附属野地：放弃按钮 / 排序 · 改建回大界面）
   * ============================================================ */
  console.log('\\n===== 154. v89.154（附属野地：放弃按钮 / 排序 · 改建回大界面） =====');
  (function () {
    var fs154 = require('fs'), p154 = require('path');
    var u154 = fs154.readFileSync(p154.join(__dirname, 'js', 'ui.js'), 'utf8');
    var m154 = fs154.readFileSync(p154.join(__dirname, 'js', 'main.js'), 'utf8');

    /* ---- ① 排序出口（唯一 + 两处调用） ---- */
    check('§154① 排序出口 ui.wildSortedOf：定义唯一 · 两处调用（面板 + 下拉框，下标语义一致）', (function () {
      return (u154.match(/ui\\.wildSortedOf = function/g) || []).length === 1
        && (u154.match(/ui\\.wildSortedOf\\(/g) || []).length === 2;
    })(), 'def=' + (u154.match(/ui\\.wildSortedOf = function/g) || []).length
      + ' call=' + (u154.match(/ui\\.wildSortedOf\\(/g) || []).length);

    /* ---- ② 实测 + ③ 渲染（一次造局两判据） ---- */
    var R154 = (function () {
      var st = G.state, c = G.currentCity();
      var keep = { wilds: st.wilds, gathers: st.gathers };
      var gen = st.generals[0];
      var bakGen = { status: gen.status, cityId: gen.cityId };
      var out = { seq: '', gatherOk: false, rowOrder: false, hasDrop: false, noArmInList: false, hasAsk: false, askHtml: '' };
      var wA = null, wB = null;
      try {
        /* ⚠ 造局序**故意打乱**（914→910 倒序）：若出口退化成"不排序直接返回"，
           判据必须能抓住（期望输出是升序 910..914，与原序不同 = 防平凡解）。 */
        st.wilds = [
          { x: 914, y: 914, type: 'hill', level: 4, day: 0, startDay: 0 },     /* 山 4 */
          { x: 913, y: 913, type: 'hill', level: 9, day: 0, startDay: 0 },     /* 山 9 */
          { x: 912, y: 912, type: 'desert', level: 7, day: 0, startDay: 0 },   /* 荒漠 7 */
          { x: 911, y: 911, type: 'caoyuan', level: 5, day: 0, startDay: 0 },  /* 驻军 */
          { x: 910, y: 910, type: 'lake', level: 3, day: 0, startDay: 0 }      /* 采集 */
        ];
        st.gathers = [];
        wA = st.wilds[4]; wB = st.wilds[3];
        gen.status = 'garrison';
        wA.garrison = { troops: { changqiang: 5000 }, cityId: c.id, genId: gen.id };
        G.startGather(910, 910, { changqiang: 5000 }, { cityId: c.id });
        out.gatherOk = !!G.gatherAt(910, 910);
        wB.garrison = { troops: { changqiang: 500 }, cityId: c.id };
        out.seq = G.ui.wildSortedOf(st.wilds).map(function (w) { return w.x; }).join(',');
        /* 渲染：面板行序（首现坐标 = 行位置）+ 放弃按钮 */
        var html = '', _om = G.ui.openModal;
        G.ui.openModal = function (h) { html = h; };
        try { G.ui.openWilds(); } catch (e) { html = 'ERR:' + e.message; }
        G.ui.openModal = _om;
        var iA = html.indexOf('data-x="910" data-y="910"');
        var iB = html.indexOf('data-x="911" data-y="911"');
        var iC = html.indexOf('data-x="912" data-y="912"');
        var iD = html.indexOf('data-x="913" data-y="913"');
        var iE = html.indexOf('data-x="914" data-y="914"');
        out.rowOrder = iA >= 0 && iA < iB && iB < iC && iC < iD && iD < iE;
        out.hasDrop = html.indexOf('data-action="wild-abandon-ask"') >= 0
          && html.indexOf('wild-drop') >= 0
          && html.indexOf('data-action="wild-withdraw"') < html.indexOf('data-action="wild-abandon-ask"');
        out.noArmInList = html.indexOf('wild-abandon-arm') < 0;
        /* ask 弹窗（上膛 + 不可撤销） */
        html = '';
        G.ui.openModal = function (h) { html = h; };
        try { G.ui.openAbandonWildAsk(910, 910); } catch (e) { html = 'ERR:' + e.message; }
        G.ui.openModal = _om;
        out.askHtml = html;
        out.hasAsk = html.indexOf('data-action="wild-abandon-arm"') >= 0 && html.indexOf('不可撤销') >= 0;
      } catch (e) { out.err = String(e && e.message); }
      finally {
        if (wA) wA.garrison = null;
        if (wB) wB.garrison = null;
        st.wilds = keep.wilds; st.gathers = keep.gathers;
        gen.status = bakGen.status; gen.cityId = bakGen.cityId;
      }
      return out;
    })();
    check('§154② 实测：采集中 > 有驻军 > 无驻军（地形表序 → 同级地形按等级降序）',
      R154.seq === '910,911,912,913,914' && R154.gatherOk,
      'seq=' + R154.seq + ' gatherOk=' + R154.gatherOk + ' err=' + (R154.err || '-'));
    check('§154③ 面板行序与出口一致（910→911→912→913→914）', R154.rowOrder);

    /* ---- ④ 操作列「放弃」按钮：防误触四层（ask 两段式 + 列表不直接执行） ---- */
    check('§154④ 操作列第 5 颗「放弃」：wild-drop 间距分组 + 只触发 ask（列表无 arm）',
      R154.hasDrop && R154.noArmInList);
    check('§154④ ask 弹窗：上膛按钮（wild-abandon-arm）+ 明写「不可撤销」',
      R154.hasAsk, R154.askHtml ? R154.askHtml.slice(0, 80) : '(空)');

    /* ---- ⑤ 上膛链路实测：两次 GAME.action ---- */
    check('§154⑤ 实测：放弃野地上膛式（第一次只上膛 / 第二次才执行 / 执行后标志清零）', (function () {
      var st = G.state;
      var keep = { wilds: st.wilds, gathers: st.gathers };
      var ok = false, dbg = '';
      try {
        st.wilds = st.wilds.concat([{ x: 920, y: 920, type: 'forest', level: 2, day: 0, startDay: 0 }]);
        var el = { dataset: { x: '920', y: '920' }, innerHTML: '确定放弃' };
        G.ui._wildArm154 = null;
        G.action('wild-abandon-arm', el);
        var arm1 = /再点一次/.test(el.innerHTML) && G.ui._wildArm154 === '920,920' && !!G.map.wildAt(920, 920);
        G.action('wild-abandon-arm', el);
        var arm2 = !G.map.wildAt(920, 920) && G.ui._wildArm154 === null
          && st.wilds.filter(function (w) { return w.x === 920; }).length === 0;
        ok = arm1 && arm2;
        dbg = 'arm1=' + arm1 + ' arm2=' + arm2;
      } catch (e) { dbg = String(e && e.message); }
      finally { st.wilds = keep.wilds; st.gathers = keep.gathers; }
      return ok;
    })());
    check('§154⑤ 打开 ask 即复位上膛标志（关窗重开必须重新上膛）',
      /ui\\._wildArm154 = null;      \\/\\* v89\\.154：打开即复位/.test(u154));

    /* ---- ⑥ 改建完成 → 直接回城外大界面 ---- */
    check('§154⑥ 改建完成 → closeAllModals（一次关净回大界面，不再弹回地块面板）', (function () {
      var i = m154.indexOf("case 'ext-convert': (function () {");
      if (i < 0) return false;
      var seg = m154.slice(i, i + 700);
      return seg.indexOf('ui.closeAllModals()') >= 0 && seg.indexOf('ui.closeModal()') < 0;
    })());

    /* ---- ⑦ 需求档案在册 ---- */
    check('§154⑦ 需求档案在册（v89.154 · 老板原文关键句逐字）', (function () {
      var md = fs154.readFileSync(p154.join(__dirname, '需求档案.md'), 'utf8');
      return md.indexOf('v89.154') >= 0
        && md.indexOf('操作栏中增加一个放弃野地按钮') >= 0
        && md.indexOf('完成改建后，应直接回到城外大界面') >= 0
        && md.indexOf('无驻军的野地按地形，等级（高到低）排序') >= 0;
    })());
  })();
"""
ANCH = u"  })();\n\n  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
if u'154. v89.154' in s:
    done.append('3 skip')
else:
    assert s.count(ANCH) == 1, '3 anchor count=' + str(s.count(ANCH))
    NEW = u"  })();\n" + SEC + u"\n  })();\n\n  console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
    s = s.replace(ANCH, NEW)
    done.append('3 OK')

wr(P, s)
s2 = rd(P)
_bk = io.open(R + 'backup/v89154/smoke-test.js.before', encoding='utf-8', newline='').read()

def strip_js(t):
    """剥注释 + 字符串 + **转义括号**后再计数。
    教训两枚：字符串里的花括号（§48.2）、正则里的 `\\(` `\\)`（转义括号不属于语法结构）。"""
    import re as _re
    t = t.replace('\\(', '').replace('\\)', '').replace('\\{', '').replace('\\}', '')
    t = _re.sub(r'/\*[\s\S]*?\*/', '', t)
    t = _re.sub(r'//[^\n]*', '', t)
    t = _re.sub(r"'(?:[^'\\\n]|\\.)*'", "''", t)
    t = _re.sub(r'"(?:[^"\\\n]|\\.)*"', '""', t)
    return t

_sa, _sb = strip_js(s2), strip_js(_bk)
assert (_sa.count(u'{') - _sa.count(u'}')) == (_sb.count(u'{') - _sb.count(u'}')), \
    'brace imbalance (code): %d -> %d' % (_sb.count(u'{') - _sb.count(u'}'), _sa.count(u'{') - _sa.count(u'}'))
assert (_sa.count(u'(') - _sa.count(u')')) == (_sb.count(u'(') - _sb.count(u')')), \
    'paren imbalance (code): %d -> %d' % (_sb.count(u'(') - _sb.count(u')'), _sa.count(u'(') - _sa.count(u')'))
print('brace/paren OK (code-only): brace %d, paren %d' % (_sa.count(u'{') - _sa.count(u'}'), _sa.count(u'(') - _sa.count(u')')))
print('smoke done:', done, 'len', len(_bk), '->', len(s2))

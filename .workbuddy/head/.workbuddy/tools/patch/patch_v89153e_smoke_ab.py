# -*- coding: utf-8 -*-
# v89.153e：smoke 断言升级（⑨-1/⑨-2/⑨-6 · §116 两条 · 新增 §153 节）
import io, re

P = 'E:/Deepseekdb/smoke-test.js'
S = io.open(P, encoding='utf-8', newline='').read()
orig = len(S)
n = 0

def rep(tag, old, new, guard):
    global S, n
    if guard in S:
        print('  skip ' + tag); return
    c = S.count(old)
    assert c == 1, tag + ' count=' + str(c)
    S = S.replace(old, new)
    io.open(P, 'w', encoding='utf-8', newline='').write(S)
    n += 1
    print('  OK   ' + tag)

# ---------- ① ⑨-1 类别表（顺序 + doc:false 两个） ----------
rep('s9-1',
    u"""    check('⑨-1 类别表齐备：五类各有 id/name/icon/desc，id 唯一', (function () {
      var K = DATA.MSG_KINDS || [];
      if (K.length !== 5) return false;
      var ids = K.map(function (k) { return k.id; });
      if (ids.join(',') !== 'war,scout,beacon,task,sys') return false;   /* 顺序 = 页签顺序 */
      return K.every(function (k) {
        return k.id && k.name && k.icon && k.desc && (DATA.MSG_KIND_BY[k.id] === k);
      });
    })());""",
    u"""    check('⑨-1 类别表齐备：五类各有 id/name/icon/desc，id 唯一（v89.153：顺序 系统/战报/侦查）', (function () {
      var K = DATA.MSG_KINDS || [];
      if (K.length !== 5) return false;
      var ids = K.map(function (k) { return k.id; });
      if (ids.join(',') !== 'sys,war,scout,beacon,task') return false;   /* 顺序 = 页签顺序（老板 1） */
      /* v89.153：两个不出页签的类别（烽火在军务 · 烽火；任务并入系统页） */
      var off = K.filter(function (k) { return k.doc === false; }).map(function (k) { return k.id; });
      if (off.join(',') !== 'beacon,task') return false;
      return K.every(function (k) {
        return k.id && k.name && k.icon && k.desc && (DATA.MSG_KIND_BY[k.id] === k);
      });
    })());""",
    guard=u'v89.153：顺序 系统/战报/侦查')

# ---------- ② ⑨-2 发射点白名单（含主题命名空间） ----------
rep('s9-2',
    u"""      var bad = [], n = 0;
      ['state', 'domain', 'battle', 'systems', 'story', 'ui', 'main'].forEach(function (f) {
        var src = fsx.readFileSync(px.join(__dirname, 'js', f + '.js'), 'utf8');
        var re = /GAME\\.log\\.([a-z]+)\\(/g, m;
        while ((m = re.exec(src))) {
          n++;
          if (!DATA.MSG_KIND_BY[m[1]]) bad.push(f + '.js: ' + m[1]);
        }
      });""",
    u"""      var bad = [], n = 0;
      ['state', 'domain', 'battle', 'systems', 'story', 'ui', 'main'].forEach(function (f) {
        var src = fsx.readFileSync(px.join(__dirname, 'js', f + '.js'), 'utf8');
        var re = /GAME\\.log\\.([a-z]+)\\(/g, m;
        while ((m = re.exec(src))) {
          n++;
          /* v89.153：命名空间含水**主题**（GAME.log.gather 等）—— 白名单 = 大类 ∪ 主题 */
          if (!DATA.MSG_KIND_BY[m[1]] && !DATA.MSG_SUB_BY[m[1]]) bad.push(f + '.js: ' + m[1]);
        }
      });""",
    guard=u'白名单 = 大类 ∪ 主题')

# ---------- ③ ⑨-6 战报页 vs 系统页 ----------
rep('s9-6',
    u"""    /* 战报页是**两段**：上=战报（报告 · 全量留档 + 分页 + 筛选），下=军情流水（滚动窗）。
       为什么必须两段：军情（行军/调防/缴获/驻守 40+ 个发射点）若没有落点，
       分类之后就会"谁都不显示"—— 消息一旦不可达，等于丢失。 */
    check('⑨-6 战报页两段：战报（报告）在上、军情流水在下（消息不许无处可看）', (function () {
      var seg = u4.slice(u4.indexOf("if (id === 'war') {"), u4.indexOf("if (id === 'scout') {"));
      return /ui\\.warFlowOf/.test(u4) && /sealH\\('军情'/.test(seg)
        && /ui\\.docRepRowHTML/.test(seg) && /ui\\.docPagerReg/.test(u4);
    })());""",
    u"""    /* v89.153（老板 2）：「将战报中的军情……整合到系统菜单下」——
       战报页 = **只留战报**（报告 · 全量留档 + 分页 + 筛选）；
       军情（war 消息）落**系统页**（三源合一 + 「军情」小标签）。
       为什么军情必须有落点：40+ 个军事发射点若无人显示 = 消息丢失。 */
    check('⑨-6 战报页只列战报；军情流水落「系统」页（三源合一 · 消息不许无处可看）', (function () {
      var seg = u4.slice(u4.indexOf("if (id === 'war') {"), u4.indexOf("if (id === 'scout') {"));
      return /ui\\.docRepRowHTML/.test(seg) && /ui\\.docPagerReg/.test(u4)
        && seg.indexOf("sealH('军情'") < 0                       /* 战报页不再有军情段 */
        && u4.indexOf('ui.warFlowOf = function') < 0             /* 旧出口已退役（查可执行形态） */
        && /GAME\\.msgFeedOf\\(\\)/.test(u4)                       /* 系统页读三源合一 */
        && /ui\\.msgTagChipsHTML = function/.test(u4)             /* 小标签 */
        && /ui\\.msgLineHTML = function/.test(u4);                /* 主题色行 */
    })());""",
    guard=u'战报页只列战报；军情流水落「系统」页')

# ---------- ④ §116 两条 ----------
rep('s116-4',
    u"""    check('⑥ 类别表标记 doc:false；公文页签只剩四类（不含烽火）', (function () {
      var bk = D96.MSG_KIND_BY.beacon;
      var kinds = G.ui.docKinds().map(function (k) { return k.id; });
      return !!bk && bk.doc === false && kinds.length === 4
        && kinds.join(',') === 'war,scout,task,sys';
    })());""",
    u"""    check('⑥ 类别表标记 doc:false；公文页签只剩三类（烽火 + 任务都不出页签 · v89.153）', (function () {
      var bk = D96.MSG_KIND_BY.beacon, tk = D96.MSG_KIND_BY.task;
      var kinds = G.ui.docKinds().map(function (k) { return k.id; });
      return !!bk && bk.doc === false && !!tk && tk.doc === false && kinds.length === 3
        && kinds.join(',') === 'sys,war,scout';
    })());""",
    guard=u'公文页签只剩三类（烽火 + 任务都不出页签')

rep('s116-5',
    u"""    check('⑥ 直调烽火正文 → 只给"已移出公文"的指引；切换被拒 → 回落战报', (function () {
      var bkTab = G.ui._docTab;
      try {
        var body = G.ui.docBodyHTML('beacon');
        G.ui.setDocTab('beacon');
        return /已移出公文/.test(body) && body.indexOf('bb-line beacon') < 0
          && G.ui._docTab === 'war';
      } finally { G.ui._docTab = bkTab; }
    })());""",
    u"""    check('⑥ 直调已移出类别 → 给指引；切换被拒 → 回落系统页（v89.153）', (function () {
      var bkTab = G.ui._docTab;
      try {
        var body = G.ui.docBodyHTML('beacon');
        var bodyT = G.ui.docBodyHTML('task');
        G.ui.setDocTab('beacon');
        return /已移出公文/.test(body) && body.indexOf('bb-line beacon') < 0
          && /已并入「系统」页/.test(bodyT)
          && G.ui._docTab === 'sys';
      } finally { G.ui._docTab = bkTab; }
    })());""",
    guard=u'直调已移出类别 → 给指引；切换被拒 → 回落系统页')

io.open(P, 'w', encoding='utf-8', newline='').write(S)
print('PART-A/B done (%d), len %d -> %d' % (n, orig, len(S)))

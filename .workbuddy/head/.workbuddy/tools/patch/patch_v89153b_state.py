# -*- coding: utf-8 -*-
# v89.153b：state.js —— GAME.log 第三参数(sub) / 主题命名空间 / msgSubOf / msgFeedOf / 建造消息打标
import io, re

P = 'E:/Deepseekdb/js/state.js'
s = io.open(P, encoding='utf-8', newline='').read()
orig = len(s)
n = 0

def rep(tag, old, new, guard):
    global s, n
    if guard in s:
        print('  skip ' + tag); return
    c = s.count(old)
    assert c == 1, tag + ' count=' + str(c)
    s = s.replace(old, new)
    n += 1
    print('  OK   ' + tag)

# ---------- ① GAME.log 加第三参数 ----------
rep('log-sig',
    u"""  GAME.log = function (msg, kind) {
    var s = GAME.state;
    if (!s) return;
    s.log.unshift({ t: U.now(), msg: msg });
    if (s.log.length > 40) s.log.pop();
    var gt = (s.world && s.world.elapsed) || 0;
    /* v89.107：消息**类别在发射点声明**（第二参数），落库为 k。
       未声明 / 写错 → 落 sys（系统消息）：分类值域见 DATA.MSG_KINDS（唯一来源）。 */
    var k = (kind && DATA.MSG_KIND_BY && DATA.MSG_KIND_BY[kind]) ? kind : 'sys';
    var rec = { t: U.now(), gt: gt, msg: msg, k: k };""",
    u"""  GAME.log = function (msg, kind, sub) {
    var s = GAME.state;
    if (!s) return;
    s.log.unshift({ t: U.now(), msg: msg });
    if (s.log.length > 40) s.log.pop();
    var gt = (s.world && s.world.elapsed) || 0;
    /* v89.107：消息**类别在发射点声明**（第二参数），落库为 k。
       未声明 / 写错 → 落 sys（系统消息）：分类值域见 DATA.MSG_KINDS（唯一来源）。 */
    var k = (kind && DATA.MSG_KIND_BY && DATA.MSG_KIND_BY[kind]) ? kind : 'sys';
    var rec = { t: U.now(), gt: gt, msg: msg, k: k };
    /* v89.153（老板 2）：第三参数 = **主题**（改元/天时/建造/采集收获……）——
       系统页小标签按它筛（读取走唯一出口 GAME.msgSubOf）；非法值不落库（宁缺勿错）。 */
    if (sub && DATA.MSG_SUB_BY && DATA.MSG_SUB_BY[sub]) rec.sub = sub;""",
    guard=u'v89.153（老板 2）：第三参数 = **主题**')

# ---------- ② 主题命名空间 ----------
rep('log-ns',
    u"""  ['war', 'scout', 'beacon', 'task', 'sys'].forEach(function (k) {
    GAME.log[k] = function (msg) { return GAME.log(msg, k); };
  });""",
    u"""  ['war', 'scout', 'beacon', 'task', 'sys'].forEach(function (k) {
    GAME.log[k] = function (msg) { return GAME.log(msg, k); };
  });
  /* v89.153：**主题**命名空间 —— `GAME.log.gather(msg, 'sys')` 等价于第三参数传 'gather'
     （kind 缺省落 sys；军事类主题可显式传 'war'）。 */
  ['era', 'weather', 'build', 'gather'].forEach(function (sub) {
    GAME.log[sub] = function (msg, kind) { return GAME.log(msg, kind || 'sys', sub); };
  });""",
    guard=u'v89.153：**主题**命名空间')

# ---------- ③ msgSubOf + msgFeedOf（插在 msgsOf 之后） ----------
ANCHOR = u"""  /* 公文页取用：按类别过滤（页签、计数、正文三处同源，别再各筛一遍） */
  GAME.msgsOf = function (kind) {"""
ADD = u"""  /* ============================================================
   * v89.153：消息**主题**与**系统页池**（两个唯一出口）
   * ------------------------------------------------------------
   *   · `GAME.msgSubOf(rec)` —— 一条消息在系统页里属于哪个小标签：
   *       有 sub 按 sub（改元 / 天时 / 建造 / 采集收获）；
   *       否则按 kind：war → 军情 · task → 任务 · sys → 系统。
   *     标签 id **就是返回值**（era/weather/build/gather/war/task/sys）——
   *     界面 chips、筛选、颜色三处全读它，不另立映射表。
   *   · `GAME.msgFeedOf()` —— 系统页的消息池：军情 + 任务 + 系统**三源合一**、
   *     按时间倒序（scout / beacon 不入：前者有自己的页签，后者在军务 · 烽火）。
   * ============================================================ */
  GAME.msgSubOf = function (rec) {
    if (!rec) return 'sys';
    if (rec.sub && DATA.MSG_SUB_BY && DATA.MSG_SUB_BY[rec.sub]) return rec.sub;
    return GAME.msgKindOf(rec);
  };
  GAME.msgFeedOf = function () {
    var out = [], list = GAME.msgLog();
    for (var i = 0; i < list.length; i++) {
      var k = GAME.msgKindOf(list[i]);
      if (k === 'war' || k === 'task' || k === 'sys') out.push(list[i]);
    }
    return out.reverse();                     /* 新消息在前 */
  };
"""
if u'GAME.msgFeedOf = function' not in s:
    assert s.count(ANCHOR) == 1, 'anchor count=' + str(s.count(ANCHOR))
    s = s.replace(ANCHOR, ADD + ANCHOR)
    n += 1
    print('  OK   msgSubOf/msgFeedOf')
else:
    print('  skip msgSubOf/msgFeedOf')

# ---------- ④ 建造消息打标（'build'） ----------
rep('build-1',
    u"""      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel));""",
    u"""      GAME.log('城外' + (DATA.EXT_BUILDINGS[q.buildId] ? DATA.EXT_BUILDINGS[q.buildId].name : '建筑') + (q.type === 'ext_build' ? '建造完成' : '升级至 Lv' + q.targetLevel), 'sys', 'build');""",
    guard=u"'建造完成' : '升级至 Lv' + q.targetLevel), 'sys', 'build')")
rep('build-2',
    u"""    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''));""",
    u"""    GAME.log('建筑完成：' + (DATA.BUILDINGS[q.buildId] ? DATA.BUILDINGS[q.buildId].name : q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''), 'sys', 'build');""",
    guard=u"q.buildId) + (q.type === 'upgrade' ? ' 升级' : ''), 'sys', 'build')")

# ---------- 写盘 + 自检 ----------
def cb(t):
    return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
_bk = io.open(P, encoding='utf-8', newline='').read()
assert (cb(s)[0] - cb(s)[1]) == (cb(_bk)[0] - cb(_bk)[1]), 'brace imbalance'
io.open(P, 'w', encoding='utf-8', newline='').write(s)
chk = io.open(P, encoding='utf-8', newline='').read()
assert chk.count(u'GAME.msgSubOf = function') == 1 and chk.count(u'GAME.msgFeedOf = function') == 1
assert chk.count(u"'sys', 'build')") == 2
print('OK len %d -> %d (segs %d)' % (orig, len(chk), n))

# -*- coding: utf-8 -*-
# v89.153c：story.js（天时/改元打标）+ domain.js（采集收获明细重写 · 采集消息打标 · 自动升级打标）
import io, re

def run(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    orig = len(s)
    n = 0
    for tag, old, new, guard in segs:
        if guard in s:
            print('  skip ' + tag); continue
        c = s.count(old)
        assert c == 1, tag + ' count=' + str(c)
        s = s.replace(old, new); n += 1
        print('  OK   ' + tag)
    def cb(t):
        return (len(re.findall(r'(?<![\\^])\{', t)), len(re.findall(r'(?<![\\^])\}', t)))
    assert (cb(s)[0] - cb(s)[1]) == (cb(io.open(P, encoding='utf-8', newline='').read())[0]
                                     - cb(io.open(P, encoding='utf-8', newline='').read())[1]), 'brace'
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
    print('%s: len %d -> %d (segs %d)' % (P, orig, len(s), n))

# ================= story.js =================
run('E:/Deepseekdb/js/story.js', [
  ('tian-shi',
   u"""    if (changed && !silent && GAME.log) GAME.log('天时：' + pick.name + '（' + pick.desc + '）');""",
   u"""    /* v89.153（老板 2）：主题 = 天时（系统页小标签） */
    if (changed && !silent && GAME.log) GAME.log('天时：' + pick.name + '（' + pick.desc + '）', 'sys', 'weather');""",
   u"'sys', 'weather');"),
  ('gai-yuan',
   u"""    if (GAME.log) GAME.log.task('🎏 改元 ' + era.name + '：' + era.boon.text);""",
   u"""    /* v89.153（老板 2）：主题 = 改元（系统页小标签；大类仍是 task——任务并入系统页） */
    if (GAME.log) GAME.log('🎏 改元 ' + era.name + '：' + era.boon.text, 'task', 'era');""",
   u"'task', 'era');"),
])

# ================= domain.js =================
run('E:/Deepseekdb/js/domain.js', [
  # ① 开始采集
  ('start-gather',
   u"""    GAME.log('⛏️ 驻军（' + (_genName136 || '无将') + '带队）' + troops + ' 兵开采 ' + tn
      + ' Lv' + rec.level + '（满 1 小时方有收成，24 小时封顶）');""",
   u"""    GAME.log('⛏️ 驻军（' + (_genName136 || '无将') + '带队）' + troops + ' 兵开采 ' + tn
      + ' Lv' + rec.level + '（满 1 小时方有收成，24 小时封顶）', 'sys', 'gather');""",
   u"'（满 1 小时方有收成，24 小时封顶）', 'sys', 'gather');"),
  # ② 不足 1 小时
  ('short-gather',
   u"""      GAME.log('采集不足 1 小时，无功而返（计时重新开始）');""",
   u"""      GAME.log('采集不足 1 小时，无功而返（计时重新开始）', 'sys', 'gather');""",
   u"'（计时重新开始）', 'sys', 'gather');"),
  # ③ 收获明细重写（老板 3 的核心）
  ('finish-gather',
   u"""    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === y.res) resName = r.name; });
    var msg = '采集收获：' + (resName || '无') + ' +' + U.fmt(y.amount) + (got ? '，另得宝物「' + got + '」' : '')
      + (jewelGot ? '，另得珠宝「' + jewelGot + '」' : '')
      + (seedGot.length ? '，另得 ' + seedGot.join('、') : '')
      + (essGot.length ? '，另得 ' + essGot.join('、') : '');
    GAME.log('📦 ' + msg);
    return { ok: true, msg: msg, res: y.res, amount: y.amount, treasure: got, jewel: jewelGot,
      seeds: seedGot, essence: essGot };""",
   u"""    var resName = '';
    DATA.RESOURCES.forEach(function (r) { if (r.key === y.res) resName = r.name; });
    /* v89.153（老板 3）：「为啥现在的采集收获看不到珠宝数量的，按野地采集产出显示所有收获」
       —— 收获明细**逐项列出、各带数量**（资源 / 宝物 / 珠宝 / 种子 / 灵气精华）。
       所有出口（toast / 公文 / 自动采集 / 试玩工具）都读这一段 —— **收获明细只有一个出口**。 */
    var _ter153 = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : '野地';
    var _gains153 = [(resName || '资源') + ' +' + U.fmt(y.amount)];
    if (got) _gains153.push('宝物「' + got + '」');
    if (jewelGot) _gains153.push('珠宝 ' + jewelGot);      /* jewelGot 已是「蚌珠×2」形状 */
    if (seedGot.length) _gains153.push(seedGot.join('、'));
    if (essGot.length) _gains153.push(essGot.join('、'));
    var rewardText = _gains153.join('；');
    var msg = '采集收获（' + _ter153 + ' Lv' + (g.level || 0) + '）：' + rewardText;
    GAME.log('📦 ' + msg, 'sys', 'gather');
    return { ok: true, msg: msg, rewardText: rewardText, res: y.res, amount: y.amount,
      treasure: got, jewel: jewelGot, seeds: seedGot, essence: essGot };""",
   u'收获明细只有一个出口'),
  # ④ 自动收获明细
  ('auto-gather',
   u"""      if (y && y.capReached) {
        var r = GAME.finishGather(g.id);
        if (r && r.ok) done.push('收 ' + U.fmt(r.amount || 0));
      }""",
   u"""      if (y && y.capReached) {
        var r = GAME.finishGather(g.id);
        if (r && r.ok) {
          /* v89.153（老板 3）：自动收获也**列全产出**（改前只写"收 X"——珠宝看不见） */
          var _tn153b = DATA.TERRAIN[g.type] ? DATA.TERRAIN[g.type].name : '野地';
          done.push(_tn153b + ' Lv' + (g.level || 0) + ' ' + (r.rewardText || ('+' + U.fmt(r.amount || 0))));
        }
      }""",
   u'自动收获也**列全产出**'),
  # ⑤ 停止开采 / 撤回
  ('stop-gather',
   u"""    GAME.log(g.origin === 'garrison' ? '停止驻军开采（驻军原地保留）' : '撤回采集队（无收益）');""",
   u"""    GAME.log(g.origin === 'garrison' ? '停止驻军开采（驻军原地保留）' : '撤回采集队（无收益）', 'sys', 'gather');""",
   u"'撤回采集队（无收益）', 'sys', 'gather');"),
  # ⑥ 自动升级（建造主题）
  ('auto-upgrade',
   u"""        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1));""",
   u"""        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1), 'sys', 'build');""",
   u"→ Lv' + (c.lv + 1), 'sys', 'build');"),
])

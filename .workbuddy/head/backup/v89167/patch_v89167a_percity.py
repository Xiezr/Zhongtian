# -*- coding: utf-8 -*-
"""v89.167 patch：自动升级 —— **每城独立建造位**（逐城遍历、各自排满）。
   改前病根：闸门 = 全境队列总数 vs buildSlots(当前城) → 全境只排 3 条就"队列已满"。
   运行：python .workbuddy/tools/patch/patch_v89167a_percity.py"""
import io

R = 'E:/Deepseekdb/'


def rd(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def wr(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def rep(p, tag, old, new, guard):
    s = rd(p)
    if guard in s:
        print('  [skip] ' + tag + '（新特征已在）')
        return
    c = s.count(old)
    assert c == 1, '%s 锚点计数=%d（应为 1）' % (tag, c)
    s = s.replace(old, new)
    wr(p, s)
    print('  [ ok ] ' + tag)


D = 'js/domain.js'

# ═══ A1. 全局闸门 → 每城独立（cityRoomOf）═══
rep(D, 'A1 闸门改每城独立',
    """    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;

    var slots = GAME.buildSlots(city);   /* v60：按该城算（名城 perk 是城属性） */
    if ((s.queues.build || []).length >= slots) {
      s.autoState = { paused: false, msg: '队列已满（' + slots + '）' };
      return null;
    }""",
    """    var city = GAME.currentCity() || s.cities[0];
    if (!city) return null;

    /* v89.167（老板）：「自动升级建造，应该每个城池均遍历，分别升级，而不是所有城池一起，
       总共只升级 3 个建筑」——
       改前闸门 = **全境队列总数** vs `buildSlots(当前城)`：全境一共只排 3 条
       （3 = 单城基础建造位）就报"队列已满"，其余城池永远轮不上。
       改后 = **每城独立**：各城在办数 vs 各城自己的建造位（buildQueueUsed / buildSlots
       两个既有出口）；一次调用把所有城的空位尽量排满（逐城遍历、各自封顶）。 */
    var cityRoomOf = function (ct) {
      return GAME.buildQueueUsed(ct.id) < GAME.buildSlots(ct);
    };
    if (!(s.cities || []).some(cityRoomOf)) {
      var totSlots167 = 0;
      (s.cities || []).forEach(function (ct) { totSlots167 += GAME.buildSlots(ct); });
      s.autoState = { paused: false, msg: '各城队列已满（合 ' + totSlots167 + ' 位在办）' };
      return null;
    }""",
    guard='var cityRoomOf = function (ct) {')

# ═══ A2a. 候选收集 · 城内：跳过"位满"的城 ═══
rep(D, 'A2a 城内候选跳满城',
    """    (s.cities || []).forEach(function (ct) {
      var gfFirst = -1;""",
    """    (s.cities || []).forEach(function (ct) {
      if (!cityRoomOf(ct)) return;   /* v89.167：该城本轮位满 → 整城跳过（不是失败） */
      var gfFirst = -1;""",
    guard='/* v89.167：该城本轮位满 → 整城跳过（不是失败） */\n      var gfFirst = -1;')

# ═══ A2b. 候选收集 · 城外：同上 ═══
rep(D, 'A2b 城外候选跳满城',
    """    (s.cities || []).forEach(function (ct) {
      (ct.extGrid || []).forEach(function (e, idx) {""",
    """    (s.cities || []).forEach(function (ct) {
      if (!cityRoomOf(ct)) return;   /* v89.167：同上（城外候选） */
      (ct.extGrid || []).forEach(function (e, idx) {""",
    guard='/* v89.167：同上（城外候选） */')

# ═══ A3. 试建循环：第一条成功就 return → 排满各城空位 ═══
rep(D, 'A3 循环排满',
    """    var blocked160 = null;   /* 第一处"资源不足"（全部试遍后用它做暂停文案） */
    var lastFail160 = '';    /* 最后一个失败原因（非资源类，供状态行显示） */
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      /* v89.104：预算闸门退役（见函数群注释）—— 资源不足只跳过当项 */
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : GAME.upgradeAt(c.cityId || city.id, c.idx);
      if (r && r.ok) {
        s.autoState = { paused: false, last: c.name, msg: '正在升级 ' + c.name + ' → Lv' + (c.lv + 1) };
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1), 'sys', 'build');
        return { ok: true, target: c };
      }""",
    """    var blocked160 = null;   /* 第一处"资源不足"（全部试遍后用它做暂停文案） */
    var lastFail160 = '';    /* 最后一个失败原因（非资源类，供状态行显示） */
    /* v89.167（老板 2 · 每城分别升级）：试建循环从"第一条成功就 return"改为**把各城空位排满** ——
       成功一项继续试下一项（upgradeAt 内部自带按城位检查 checkBuildSlot，"排满"天然按城封顶）；
       某城本轮排满后，其后续候选直接跳过（不算失败，不污染 lastFail160）。 */
    var first167 = null, last167 = null, doneN167 = 0;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var cCty167 = GAME.cityById(c.cityId);
      if (cCty167 && !cityRoomOf(cCty167)) continue;      /* 该城本轮已排满 → 跳过（非失败） */
      /* v89.104：预算闸门退役（见函数群注释）—— 资源不足只跳过当项 */
      var r = c.kind === 'ext' ? GAME.upgradeExt(c.idx, c.cityId)
        : GAME.upgradeAt(c.cityId || city.id, c.idx);
      if (r && r.ok) {
        doneN167++;
        if (!first167) first167 = c;
        last167 = c;
        GAME.log('自动升级：' + c.name + ' → Lv' + (c.lv + 1), 'sys', 'build');
        continue;                                          /* v89.167：继续试下一项（排满各城空位） */
      }""",
    guard='var first167 = null, last167 = null, doneN167 = 0;')

# ═══ A4. 循环后：done 分支（本轮排入 N 项）═══
rep(D, 'A4 done 分支',
    """      if (r && !r.ok && /不足/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };
      if (r && !r.ok) lastFail160 = r.msg || '';
    }
    if (blocked160) {""",
    """      if (r && !r.ok && /不足/.test(r.msg) && !blocked160) blocked160 = { reason: r.msg, target: c };
      if (r && !r.ok) lastFail160 = r.msg || '';
    }
    /* v89.167：本轮有排入 → 报"本轮排入 N 项（各城独立建造位）"；
       target 仍取**第一条成功**（兼容老断言语义），新增 last / count 供界面与测试使用。 */
    if (doneN167 > 0) {
      s.autoState = { paused: false, last: last167.name,
        msg: '本轮排入 ' + doneN167 + ' 项（各城独立建造位）· 最新：' + last167.name + ' → Lv' + (last167.lv + 1) };
      return { ok: true, target: first167, last: last167, count: doneN167 };
    }
    if (blocked160) {""",
    guard="msg: '本轮排入 ' + doneN167 + ' 项（各城独立建造位）")

# ═══ B. 自动化面板说明文案 ═══
rep('js/ui.js', 'B 面板说明',
    """      body = '<div class="auto-note">按等级从低到高（<b>不再区分城内城外</b>）；受建造队列上限约束。' +
        '某项资源不足就<b>顺延试下一项</b>，全部试遍都升不动才暂停（开关不关，资源恢复后自动继续）；' +
        '全部满级则停止。只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';""",
    """      body = '<div class="auto-note">按等级从低到高（<b>不再区分城内城外</b>）；' +
        '<b>每城独立建造位</b> —— 逐城遍历、各自排满（不会几座城合抢一个额度）。' +
        '某项资源不足就<b>顺延试下一项</b>，全部试遍都升不动才暂停（开关不关，资源恢复后自动继续）；' +
        '全部满级则停止。只升级已有建筑，不会替你新建（免得程序改动你的布局）。</div>';""",
    guard='<b>每城独立建造位</b> —— 逐城遍历、各自排满')

# ═══ C. 开启提示 toast ═══
rep('js/main.js', 'C 开启提示',
    """      ui.toast('🔨 自动升级已开启（按等级从低到高；某项不足则顺延下一项）');""",
    """      ui.toast('🔨 自动升级已开启（每城独立建造位 · 逐城排满；某项不足则顺延下一项）');""",
    guard='每城独立建造位 · 逐城排满；某项不足则顺延下一项')

print('\n补丁 A~C 完成')

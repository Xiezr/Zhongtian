# -*- coding: utf-8 -*-
"""v89.159 补丁 A：① 将领升级回满体力/精力（唯一升级出口）
② 民房等"多座建筑"的升级门槛用**本座**目标等级（老板实测 bug）
③ 官府总闸改**严格 ≤ 官府等级**（老板拍板：其他建造等级不能超过官府等级）
分段落盘（每段改完立刻写盘）+ 幂等守卫 + 写后自检。"""
import io, os, sys

R = 'E:/Deepseekdb/'
FILES = ['js/domain.js', 'js/ui.js', 'js/battle.js']


def read(p):
    return io.open(R + p, 'r', encoding='utf-8', newline='').read()


def write(p, s):
    io.open(R + p, 'w', encoding='utf-8', newline='').write(s)


def log(*a):
    print(*a)
    sys.stdout.flush()


def rep(path, tag, old, new, guard):
    """guard：已落盘时存在的特征串（幂等）。old/new 均为唯一替身。"""
    s = read(path)
    if guard and guard in s:
        log('  [skip] %-46s 已落盘' % tag)
        return
    n = s.count(old)
    assert n == 1, '%s 锚点命中 %d 次（应为 1）' % (tag, n)
    s = s.replace(old, new)
    assert new in s, '%s 落盘失败' % tag
    write(path, s)
    log('  [ ok ] %-46s （命中 1/1 · 已写盘）' % tag)


# ─────────────────────────────────────────────────────────────
# ① domain.js · buildCapOf：总闸严格 = 官府等级（去掉 + lift）
# ─────────────────────────────────────────────────────────────
OLD1 = """    /* v68 · 逐步探索：城内建筑（含城墙）等级不得超过官府等级。
       - 官府自身、城外建筑、以及"没有官府的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。
       v89.102：总闸随爵位**同步抬升**（官府等级 + 爵位解锁）——
         否则主城"解锁了上限、却仍被官府按在原级"，等于没解锁。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv + lift);
    }
    return cap;"""
NEW1 = """    /* v68 · 逐步探索：城内建筑（含城墙）等级**不得超过官府等级**。
       - 官府自身、城外建筑、以及"没有官府的城"（异常数据/测试构造）不受此闸；
       - 与 DATA.BUILD_PREREQ 分工：这里管**等级上限**，那里管**建造前置**。
       v89.102：爵位解锁（lift）抬的是**所有建筑的上限**（官府也在其中）。
       ⛔ v89.159（老板 2「关于官府的等级，有一条应该是其他建造等级不能超过官府等级吧」
         → 拍板「严格 ≤ 官府」）：本闸**严格 = 官府等级**，不再 `+ lift`。
         改前口径（其他建筑 = 官府 + lift）会让主城建筑**超前官府 N 级**，
         与这条规则相悖；爵位解锁的作用改为"先抬官府上限、由官府带动
         （官府可升到 base + 档位 + lift，其他建筑随官府同步上去）"。 */
    if (bid && DATA.BUILDINGS[bid] && bid !== 'guanfu') {
      var govLv = GAME.buildingLevel(city, 'guanfu');
      if (govLv > 0) cap = Math.min(cap, govLv);
    }
    return cap;"""
rep('js/domain.js', 'domain · buildCapOf 严格 ≤ 官府', OLD1, NEW1,
    '本闸**严格 = 官府等级**，不再 `+ lift`')

# ─────────────────────────────────────────────────────────────
# ② domain.js · buildPrereqOf：门槛 next 严格 = 官府等级；升级要传本座等级
# ─────────────────────────────────────────────────────────────
OLD2 = """      /* nextLv：本次动作要到达的等级。
         新建（buildAt）显式传 1 —— 可多建建筑（仓库/民房…）已有等级时，
         不能用 buildingLevel+1，否则"新建第二座"会被当成"升到 N+1"误拦。
         升级（upgradeAt）不传，默认 lvl+1。 */
      var next = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* govLv < govCap：官府还没到自己的顶，"再升官府"是真实可执行的下一步；
         官府已到顶时不报 gate，让等级硬顶去报「已达最高等级」。
         门槛同样扣掉爵位解锁（要够到 next 级，官府只需到 next − lift 级）。 */
      if (govLv > 0 && next > govLv + lift && govLv < govCap) {
        list.push({ bid: 'guanfu', name: '官府',
          need: Math.max(govLv + 1, Math.min(next - lift, govCap)), cur: govLv, gate: true });
      }"""
NEW2 = """      /* nextLv：本次动作要到达的等级。
         新建（buildAt）显式传 1 —— 可多建建筑（仓库/民房…）已有等级时，
         不能用 buildingLevel+1，否则"新建第二座"会被当成"升到 N+1"误拦。
         ⛔ v89.159（老板 2 的真 bug）：**升级必须传"本座的目标等级"** ——
         不传时 `buildingLevel` 取的是全城**最高**一座（民房/军营/仓库可多建），
         于是"另一座已 Lv4、本座 Lv3"时被按 4→5 的门槛拦下（报「需官府 Lv5」）。 */
      var next = nextLv || (GAME.buildingLevel(city, bid) + 1);
      /* v89.159（老板 2 拍板「严格 ≤ 官府」）：要升到 next 级，官府必须 ≥ next。
         · 官府已到自己的顶（govLv ≥ govCap，下一句 next ≤ govCap 自动排除）；
         · next 超出官府可达上限（永远到不了）时**不报此闸** ——
           交给等级硬顶去报「已达最高等级」，报一个到不了的数字是误导。 */
      if (govLv > 0 && next > govLv && next <= govCap) {
        list.push({ bid: 'guanfu', name: '官府', need: next, cur: govLv, gate: true });
      }"""
rep('js/domain.js', 'domain · buildPrereqOf 门槛严格化', OLD2, NEW2,
    '要升到 next 级，官府必须 ≥ next')

OLD3 = """    /* v68 · 逐步探索：前置（含官府总闸）优先于等级硬顶 ——
       两者都不满足时，报"升官府可解锁"比报"已达最高等级"更接近玩家的下一步动作。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id);"""
NEW3 = """    /* v68 · 逐步探索：前置（含官府总闸）优先于等级硬顶 ——
       两者都不满足时，报"升官府可解锁"比报"已达最高等级"更接近玩家的下一步动作。
       v89.159（老板 2）：next 传**本座**的目标等级（cell.build.lvl + 1）——
       可多建建筑各处等级不同，"全城最高级 + 1"会把低的那座误拦
       （老板实测：民房 Lv3 · 官府 Lv4 却报「需官府 Lv5」，另一座民房已 Lv4）。 */
    var pre = GAME.buildPrereqOf(city, cell.build.id, cell.build.lvl + 1);"""
rep('js/domain.js', 'domain · upgradeAt 传本座目标等级', OLD3, NEW3,
    'next 传**本座**的目标等级（cell.build.lvl + 1）')

# ─────────────────────────────────────────────────────────────
# ③ ui.js · 建筑面板：门槛提示同样按本座等级 + 上限行写清"谁在限制"
# ─────────────────────────────────────────────────────────────
OLD4 = """      var preUp = GAME.buildPrereqOf(c, cell.build.id);"""
NEW4 = """      /* v89.159（老板 2）：与 upgradeAt 同一把尺 —— 传本座目标等级，
         否则面板会显示"需官府 Lv5"而内核（修好后）放行，界面与执行分裂。 */
      var preUp = GAME.buildPrereqOf(c, cell.build.id, cell.build.lvl + 1);"""
rep('js/ui.js', 'ui · 面板升级门槛按本座等级', OLD4, NEW4,
    '与 upgradeAt 同一把尺 —— 传本座目标等级')

OLD5 = """      var _lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(c) : 0;
      if (_lift > 0) {
        var _cap = GAME.buildCapOf(c, b.id);
        extra += '<div class="attr"><span class="k">等级上限</span><span class="v good">Lv' + _cap +
          '<span style="color:var(--text-dim);">（档位 ' + (DATA.MAX_BLEVEL + GAME.cityBuildBonus(c)) +
          ' + <b>爵位解锁 +' + _lift + '</b>）</span></span></div>';
      }"""
NEW5 = """      var _lift = GAME.rankBuildCapOf ? GAME.rankBuildCapOf(c) : 0;
      if (_lift > 0) {
        var _cap = GAME.buildCapOf(c, b.id);
        /* v89.159（老板 2）：官府总闸（其他建筑 ≤ 官府等级）会先于"档位 + 爵位"生效 ——
           上限被官府压住时把**真正在限制它的那一条**写出来，
           否则玩家看到 Lv12 却读到"档位 24 + 爵位解锁 +3"，数字对不上账。 */
        var _theo = DATA.MAX_BLEVEL + GAME.cityBuildBonus(c) + _lift;
        var _govNow = GAME.buildingLevel(c, 'guanfu');
        var _why = (b.id !== 'guanfu' && _govNow > 0 && _cap <= _govNow && _govNow < _theo)
          ? ('受官府 Lv' + _govNow + ' 限制 · <b>升官府可提升</b>')
          : ('档位 ' + (DATA.MAX_BLEVEL + GAME.cityBuildBonus(c)) + ' + <b>爵位解锁 +' + _lift + '</b>');
        extra += '<div class="attr"><span class="k">等级上限</span><span class="v good">Lv' + _cap +
          '<span style="color:var(--text-dim);">（' + _why + '）</span></span></div>';
      }"""
rep('js/ui.js', 'ui · 等级上限行写清限制来源', OLD5, NEW5,
    '受官府 Lv\' + _govNow + \' 限制')

# ─────────────────────────────────────────────────────────────
# ④ battle.js · checkLevelUp：升级即回满体力 / 精力（唯一升级出口）
# ─────────────────────────────────────────────────────────────
OLD6 = """      GAME.log.sys('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level +
        '（自动加点 +' + step + ' · 自由点 +' + step + '）');
    }
    var capped = gen.level >= capLv;"""
NEW6 = """      GAME.log.sys('⭐ 将领 ' + gen.name + ' 升至 Lv' + gen.level +
        '（自动加点 +' + step + ' · 自由点 +' + step + '）');
    }
    /* v89.159（老板 1）：「升级时将领刷新状态，恢复所有体力、精力」——
       将领**自身升级**（战斗/侦察/练功/经验道具…凡经 gainExp 的路径）即回满
       体力与精力、状态焕然一新。写在本函数 = **升级的唯一出口**：
       不在各调用点各写一遍 —— 否则又会出现"某条路升级不回满"
       （同 v89.151「打包点漏字段」的教训）。多级连升只回一次（幂等）。 */
    if (gen.level > from) {
      if (GAME.setStaNow) GAME.setStaNow(gen, GAME.staMax(gen));
      if (GAME.setEnergyNow) GAME.setEnergyNow(gen, GAME.energyMaxOf(gen));
      GAME.log.sys('✨ ' + gen.name + ' 升级刷新：体力 ' + Math.round(GAME.staNow(gen)) + '/'
        + Math.round(GAME.staMax(gen)) + ' · 精力 ' + Math.round(GAME.energyNowOf(gen)) + '/'
        + Math.round(GAME.energyMaxOf(gen)) + '（已回满）');
    }
    var capped = gen.level >= capLv;"""
rep('js/battle.js', 'battle · 升级回满体力/精力', OLD6, NEW6,
    '升级刷新：体力')

log('\n补丁 A 全部完成。')

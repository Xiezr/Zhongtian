# -*- coding: utf-8 -*-
"""v89.202 批次B：收藏条件"达到过即永久解锁"（峰值记录）
—— domain.js（注释 + 取值出口改峰值 + 新增 collectPeakOf/Sweep + 拒绝文案）
   state.js（tickOnce 挂扫掠）
   ui.js（锁定行"最高"文案 + help 说明）

规范：锚点唯一断言 count==1 · 幂等 guard = 新特征计数 · newline='' 写盘。"""
import io

R = 'E:/Deepseekdb/'

def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()

def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)

def rep(tag, path, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, tag + ' old count=' + str(c)
    s = s.replace(old, new)
    wr(path, s)
    print('[ok] ' + tag)

p_dom = R + 'js/domain.js'

# ============================================================
# B1 · domain.js：COLLECT 注释更新（现值 → 历史最高）
# ============================================================
rep('B1 注释更新', p_dom,
    "   * 全部取值来自**单调累计**（stats 计数 / 幂等计数）或明确可读的当前值 ——\n"
    "   *   仅 rank/rep/lordLv/bldg 为现值（花掉会回落；条件文案写明当前进度）。",
    "   * 全部取值来自**单调累计**（stats 计数 / 幂等计数）或**历史最高**（v89.202 起统一\n"
    "   *   走 collectPeakOf）—— 达到过即永久解锁：数值回落（材料用掉 / 将领解雇 /\n"
    "   *   前哨放手 / 官府改建）不会让已解锁的藏品重新上锁。",
    "或**历史最高**（v89.202 起统一")

# ============================================================
# B2 · domain.js：collectCondValOf 整段替换（switch→cur + 接峰值）+ 新增两出口
# ============================================================
s = rd(p_dom)
if s.count('GAME.collectPeakSweep = function') >= 1:
    print('[skip] B2 取值出口改峰值')
else:
    i0 = s.index('  GAME.collectCondValOf = function (type) {')
    i1 = s.index('\n  };\n', i0) + len('\n  };\n')
    old_seg = s[i0:i1]
    assert "'buildDone': return" in old_seg and 'collectPeakOf' not in old_seg and len(old_seg) < 2000, \
        'seg len=' + str(len(old_seg))
    NEW = r'''  /* v89.202（老板 3「按建议进行」· 达到过即永久解锁）：
     取值统一走**历史最高**（collectPeakOf）——条件达成过就不会因数值回落而重新锁上
     （如：材料品种被消耗、将领被解雇、前哨被放手、官府被改建）。
     读即记录（惰性）；主循环另挂 collectPeakSweep（10 游戏秒节流）扫掠。 */
  GAME.collectCondValOf = function (type) {
    var s = GAME.state;
    if (!s) return 0;
    var cur = 0;
    switch (type) {
      case 'win': cur = GAME.stat('wins'); break;
      case 'conquer': cur = GAME.stat('conquer'); break;
      case 'wild': cur = GAME.stat('wilds'); break;
      case 'gather': cur = GAME.stat('gathers'); break;
      case 'scout': cur = GAME.stat('scouts'); break;
      case 'fort': cur = GAME.stat('forts'); break;
      case 'rank': cur = (s.rank || 0); break;
      case 'lordLv': var lg = GAME.lordGeneralOf ? GAME.lordGeneralOf() : null; cur = lg ? (lg.level || 1) : 0; break;
      case 'bldg': cur = GAME.questMetric ? GAME.questMetric('bldLevel', 'guanfu') : 0; break;
      case 'rep': cur = (s.rep || 0); break;
      case 'itemKind': cur = Object.keys(s.items || {}).length; break;
      case 'recruited': cur = GAME.stat('recruited'); break;
      case 'trades': cur = GAME.stat('trades'); break;
      case 'forged': cur = GAME.stat('forgedCount'); break;
      case 'trained': cur = GAME.stat('trained'); break;
      case 'buildDone': cur = GAME.stat('buildDone'); break;
    }
    return GAME.collectPeakOf(type, cur);
  };
  /* v89.202：峰值记录（随档 s.collectPeak）——读到更高值即写回；返回"历史最高"。 */
  GAME.collectPeakOf = function (type, cur) {
    var s = GAME.state;
    if (!s || !type) return cur || 0;
    cur = cur || 0;
    s.collectPeak = s.collectPeak || {};
    if (cur > (s.collectPeak[type] || 0)) s.collectPeak[type] = cur;
    return s.collectPeak[type] || 0;
  };
  /* v89.202：扫掠出口（tickOnce 每 10 游戏秒一次）——玩家不打开收藏页也照记峰值。
     force=true 无视节流（测试/探针用）。 */
  GAME.collectPeakSweep = function (force) {
    var s = GAME.state;
    if (!s) return;
    var now = (s.world && s.world.elapsed) || 0;
    if (!force && now - (s.collectPeakAt || 0) < 10) return;
    s.collectPeakAt = now;
    for (var k in GAME.COLLECT_COND_TYPES) GAME.collectCondValOf(k);
  };
'''
    s = s[:i0] + NEW + s[i1:]
    wr(p_dom, s)
    print('[ok] B2 取值出口改峰值（seg %d → %d 字符）' % (len(old_seg), len(NEW)))

# ============================================================
# B3 · domain.js：collectBuy 拒绝文案（当前 → 最高）
# ============================================================
rep('B3 未解锁文案', p_dom,
    "        + '（当前 ' + U.fmt(_cd196.cur) + '）—— 达成条件后再花金激活' };",
    "        + '（最高 ' + U.fmt(_cd196.cur) + '）—— 达成条件后再花金激活' };",
    "（最高 ' + U.fmt(_cd196.cur)")

# ============================================================
# B4 · state.js：tickOnce 挂扫掠
# ============================================================
rep('B4 tickOnce 挂扫掠', R + 'js/state.js',
    "    /* v89.190（老板 2）：自动征兵（逐城判别补单 · 节流在域层里 · 开关关闭时零开销） */\n"
    "    if (GAME.autoTrainTick) GAME.autoTrainTick();",
    "    /* v89.190（老板 2）：自动征兵（逐城判别补单 · 节流在域层里 · 开关关闭时零开销） */\n"
    "    if (GAME.autoTrainTick) GAME.autoTrainTick();\n"
    "    /* v89.202（老板 3）：收藏条件峰值扫掠（10 游戏秒节流 · 达到过即永久解锁） */\n"
    "    if (GAME.collectPeakSweep) GAME.collectPeakSweep();",
    "if (GAME.collectPeakSweep) GAME.collectPeakSweep();")

# ============================================================
# B5 · ui.js：收藏卡锁定行文案（进度显示与判定同源 · "最高"）
# ============================================================
rep('B5 锁定行文案', R + 'js/ui.js',
    "        tail = '<div class=\"col-lock\">🔒 ' + U.escape(cd.name) + ' ≥ ' + U.fmt(cd.n) +\n"
    "          '<i>' + U.fmt(cd.cur) + ' / ' + U.fmt(cd.n) + '</i></div>';",
    "        /* v89.202：进度显示与判定同源（历史最高）——\"最高\"二字防误读为现值 */\n"
    "        tail = '<div class=\"col-lock\">🔒 ' + U.escape(cd.name) + ' ≥ ' + U.fmt(cd.n) +\n"
    "          '<i>最高 ' + U.fmt(cd.cur) + ' / ' + U.fmt(cd.n) + '</i></div>';",
    "<i>最高 ' + U.fmt(cd.cur)")

# ============================================================
# B6 · ui.js：藏珍阁 help 说明补一句（解锁口径）
# ============================================================
rep('B6 help 文案', R + 'js/ui.js',
    "        ui.help('成就型收藏：完成特定任务后藏品【解锁】，再花金币【激活】入藏。\\n' +\n"
    "          '藏品纯为荣誉（不给战斗属性）；集齐一系得该系声望，' +",
    "        ui.help('成就型收藏：完成特定任务后藏品【解锁】，再花金币【激活】入藏。\\n' +\n"
    "          '解锁按历史最高判定 —— 达成过即永久解锁（数值回落不会重新上锁）。\\n' +\n"
    "          '藏品纯为荣誉（不给战斗属性）；集齐一系得该系声望，' +",
    "解锁按历史最高判定")

print('批次B 完成')

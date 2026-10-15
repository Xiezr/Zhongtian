# -*- coding: utf-8 -*-
"""v89.137 补丁 M：main.js + domain.js
  main：① wild-garrison-open → 出征界面  ② wg-* / wild-garrison-do / doWildGarrisonDo 退役
        ③ doExpConfirm：己方野地已有驻将 → 不带将、不带计
  domain：④ GAME.doWildGarrison 退役（墓碑 · 入口统一到出征界面后不再有第二出口）
"""
import io, sys, os

ROOT = 'E:/Deepseekdb'
ok = []

# ══════════ ① main.js ══════════
p = os.path.join(ROOT, 'js', 'main.js')
s = io.open(p, 'r', encoding='utf-8', newline='').read()
n0 = len(s)

def rep(old, new, tag):
    global s
    if s.count(old) != 1:
        print('❌ [%s] 锚点命中 %d 次' % (tag, s.count(old))); sys.exit(1)
    s = s.replace(old, new)
    ok.append(tag)

rep(
"""      /* v89.83：派驻面板（兵种 + 数量）—— 加减 / 全带 / 装满 / 清空，
         全部走 ui.wg* 纯界面助手（只改值与合计文字，不重绘）。 */
      case 'wg-step': ui.wgStep(el); break;
      case 'wg-max': ui.wgMax(el); break;
      case 'wg-fill': ui.wgFill(); break;
      case 'wg-clear': ui.wgClear(); break;
      case 'wild-garrison-do': GAME.doWildGarrisonDo(); break;""",
"""      /* ⛔ v89.137（老板 7）：case wg-step / wg-max / wg-fill / wg-clear / wild-garrison-do
         随派驻面板整条退役（面板已删，见 ui.js 同款墓碑）；
         「派驻 / 增派驻军」入口改走 case 'wild-garrison-open'（下方向征界面下发）。 */""",
'wg-* 退役')

rep(
"""      /* v26（需求 5）：城内/城外 改由顶栏 data-view 切换，city-sub 已无触发点 */
      case 'bag-tab': ui.setBagTab(el.dataset.v); break;""",
"""      /* v26（需求 5）：城内/城外 改由顶栏 data-view 切换，city-sub 已无触发点 */
      case 'bag-tab': ui.setBagTab(el.dataset.v); break;""",
'占位校验')  # 不改，仅确保文件结构；此段命中 1 次

rep(
"""      case 'wild-garrison-open': ui.openWildGarrison(Number(el.dataset.x), Number(el.dataset.y)); break;""",
"""      case 'wild-garrison-open':
        /* ============================================================
         * v89.137（老板 7）：「派驻弹出出征界面（即侦察/掠夺/占领界面）…
         *   所有军队操作均以出征界面进行」——
         * 三个入口（地块界面「派驻/增派驻军」· 军务总览「增派」· 附属野地「派驻」）
         * 共用这一个动作 → 一律打开出征界面；方式是己方野地自动落「驻守 · 增援」。
         * ============================================================ */
        ui.openExpModal({ kind: 'wild', x: Number(el.dataset.x), y: Number(el.dataset.y) });
        break;""",
'wild-garrison-open 改造')

# doWildGarrisonDo 退役
i0 = s.find('  /* 派军驻守：读取面板输入 → 调 domain（v23 · 需求 1） */')
if i0 < 0:
    print('❌ 找不到 doWildGarrisonDo 注释头'); sys.exit(1)
j0 = s.find('GAME.doWildGarrisonDo = function', i0)
k0 = s.find('{', j0)
depth, m = 0, k0
while m < len(s):
    if s[m] == '{':
        depth += 1
    elif s[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e0 = s.find(';', m)
assert e0 > 0 and (e0 - m) < 4
tomb = """  /* ⛔ v89.137（老板 7）：`GAME.doWildGarrisonDo` 随派驻面板退役 ——
     读 #wg-* 输入框的提交端已无面板可读；派驻统一走出征界面（dispatch → station）。 */"""
s = s[:i0] + tomb + s[e0 + 1:]
ok.append('doWildGarrisonDo 退役')

# doExpConfirm：已有驻将 → 不带将 + 不带计
rep(
"""    var _ops94 = GAME.opsIdOf(ui._expOps);
    var _opsIssue94 = GAME.opsConfigIssueOf(_ops94, ui._expRes, ui._expScheme || null);
    if (_opsIssue94) { ui.toast('⚠️ ' + _opsIssue94); return; }
    var r = GAME.march.dispatch(target, mode, atk, genSel.value, ui._expScheme || null, _ops94);""",
"""    var _ops94 = GAME.opsIdOf(ui._expOps);
    var _opsIssue94 = GAME.opsConfigIssueOf(_ops94, ui._expRes, ui._expScheme || null);
    if (_opsIssue94) { ui.toast('⚠️ ' + _opsIssue94); return; }
    /* ============================================================
     * v89.137（老板 7）：己方野地 + 已有驻将 → **纯增援**（不带将、不带计）。
     * 判据与 prepare 的硬闸同源（目标野地 garrison.genId）；这里先一步把 genId 传空，
     * 让"界面显示不带将"与"实际执行"从入口就一致（prepare 的硬闸是兜底）。
     * ============================================================ */
    var _stGen137m = false;
    if (ui._expRes && ui._expRes.kind === 'wild') {
      var _wm137 = GAME.map.wildAt(ui._expRes.x, ui._expRes.y);
      _stGen137m = !!(_wm137 && _wm137.garrison && _wm137.garrison.genId);
    }
    var _genSend137 = _stGen137m ? '' : genSel.value;
    var _schemeSend137 = _stGen137m ? null : (ui._expScheme || null);
    var r = GAME.march.dispatch(target, mode, atk, _genSend137, _schemeSend137, _ops94);""",
'doExpConfirm 增援')

assert '\r\n' not in s, '行尾混入 CRLF'
tmp = p + '.tmp137'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, p)
chk = io.open(p, 'r', encoding='utf-8', newline='').read()
import re as _re
_code = _re.sub(r'/\*[\s\S]*?\*/', '', chk)
assert 'GAME.doWildGarrisonDo = function' not in _code, 'doWildGarrisonDo 残留'
assert 'ui.wgStep' not in _code, 'wgStep 残留'
assert '_genSend137' in chk, '新段未落盘'
assert chk.count('{') == chk.count('}'), 'main 花括号不配平'
print('✅ main.js：%d → %d 字节 · 段: %s' % (n0, len(chk), ' / '.join(ok)))

# ══════════ ② domain.js：doWildGarrison 退役 ══════════
p2 = os.path.join(ROOT, 'js', 'domain.js')
s2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
n2 = len(s2)
i1 = s2.find('  /* 派军驻守：从城池扣兵 → 写入野地 garrison */')
if i1 < 0:
    print('❌ 找不到 doWildGarrison 注释头'); sys.exit(1)
j1 = s2.find('GAME.doWildGarrison = function', i1)
k1 = s2.find('{', j1)
depth, m = 0, k1
while m < len(s2):
    if s2[m] == '{':
        depth += 1
    elif s2[m] == '}':
        depth -= 1
        if depth == 0:
            break
    m += 1
e1 = s2.find(';', m)
assert e1 > 0 and (e1 - m) < 4
print('domain 退役片段 %d 字节（doWildGarrison）' % (e1 + 1 - i1))
tomb2 = """  /* ============================================================
   * ⛔ v89.137（老板 7）：`GAME.doWildGarrison`（派军驻守 · 即时直补）整条退役 ——
   * 老板：「所有军队操作均以出征界面进行」——派驻/增援统一走
   * `march.dispatch(target, 'station')`，出发前由 `prepare` 预检驻军上限 + 无将硬闸，
   * 抵达由 expedition 的 station 分支写 `wildGarrisonAdd`（同一写入出口，兵不丢）。
   * 删净：本函数 + main.js 的 `GAME.doWildGarrisonDo` / `case 'wild-garrison-do'` +
   * ui.js 的派驻面板（同款墓碑）。
   * 如需恢复：本段代码见 `backup/v89137/domain.js`（判据：`GAME.doWildGarrison = function`）。
   * ============================================================ */"""
s2 = s2[:i1] + tomb2 + s2[e1 + 1:]
assert '\r\n' not in s2, '行尾混入 CRLF'
tmp2 = p2 + '.tmp137'
io.open(tmp2, 'w', encoding='utf-8', newline='').write(s2)
os.replace(tmp2, p2)
chk2 = io.open(p2, 'r', encoding='utf-8', newline='').read()
_code2 = _re.sub(r'/\*[\s\S]*?\*/', '', chk2)
assert 'GAME.doWildGarrison = function' not in _code2, 'doWildGarrison 残留'
assert chk2.count('{') == chk2.count('}'), 'domain 花括号不配平'
print('✅ domain.js：%d → %d 字节 · doWildGarrison 退役' % (n2, len(chk2)))

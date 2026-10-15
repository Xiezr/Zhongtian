# -*- coding: utf-8 -*-
"""修 audit_v89165_live.js：hasLive 递归化 + 豁免表补全。
   运行：python .workbuddy/tools/audit/fix_v89165_audit.py"""
import io

p = 'E:/Deepseekdb/.workbuddy/tools/audit/audit_v89165_live.js'
s = io.open(p, 'r', encoding='utf-8', newline='').read()

# ── ① hasLive 递归化（含 `xxx.live = function` 形态） ──
old1 = "function hasLive(body) { return /live:\\s*function|live:\\s*ui\\./.test(body); }"
assert s.count(old1) == 1, 'old1 count=%d' % s.count(old1)
new1 = (
    "/* live 判定：**递归沿调用链**（openTroops → openPanel 的 live 算已覆盖）；\n"
    "   识别三种写法：`live: function` / `live: ui.x` / `o165.live = function`。 */\n"
    "function hasLive(body, depth, seen) {\n"
    "  if (/live\\s*[:=]\\s*function|live\\s*[:=]\\s*ui\\./.test(body)) return true;\n"
    "  if (depth <= 0) return false;\n"
    "  var re = /ui\\.([A-Za-z0-9_]+)\\(/g, m, found = false;\n"
    "  while ((m = re.exec(body)) !== null) {\n"
    "    var cn = m[1];\n"
    "    if (seen[cn] || !BODY[cn] || EXCLUDE[cn]) continue;\n"
    "    seen[cn] = 1;\n"
    "    if (hasLive(BODY[cn], depth - 1, seen)) { found = true; break; }\n"
    "  }\n"
    "  return found;\n"
    "}"
)
s = s.replace(old1, new1)

old2 = "  if (hasLive(body)) { withLive.push(n + '  \u27e8' + feats.join(' \u00b7 ') + '\u27e9'); return; }"
assert s.count(old2) == 1, 'old2 count=%d' % s.count(old2)
new2 = ("  var seenL = {}; seenL[n] = 1;\n"
        "  if (hasLive(body, 3, seenL)) { withLive.push(n + '  \u27e8' + feats.join(' \u00b7 ') + ' \u27e9'); return; }")
s = s.replace(old2, new2)

# ── ② 豁免表：在 openExtModal 行后追加 5 条 ──
old3 = "  openExtModal: '\u65bd\u5de5\u8fdb\u5ea6\u8d70 data-modal-progress + data-build-bar\uff08updateProgress \u6bcf\u79d2\u539f\u5730\u5237\uff09',"
assert s.count(old3) == 1, 'old3 count=%d' % s.count(old3)
add = (
    "\n  openFarm: '\u79cd\u7530 attr\uff08data-farm-left / data-farm-bar\uff09\u7531 updateProgress \u539f\u5730\u5237\uff08\u6210\u719f\u8fd8\u4f1a\u81ea\u52a8\u6362\u6536\u83b7\u952e\uff09',"
    "\n  openExpModal: '\u51fa\u5f81\u9762\u677f\u7684 durExact \u662f**\u51fa\u53d1\u524d\u9759\u6001\u9884\u4f30**\uff08\u4e0d\u968f\u65f6\u95f4\u8d70\uff09\uff0c\u975e\u8bfb\u79d2',"
    "\n  openAutoMarch: '\u540c\u4e0a\uff08amEstHTML = \u81ea\u52a8\u51fa\u5f81\u7684\u9759\u6001\u9884\u4f30\u884c\uff09',"
    "\n  openEquipPanel: 'equip \u5206\u652f\u7eaf\u9759\u6001\uff1b\u7279\u5f81\u6765\u81ea openPanel \u7684**\u5176\u4ed6\u5206\u652f**\uff08troops/ext\uff0c\u8fd0\u884c\u65f6\u4e0d\u4f1a\u6e32\u67d3\uff09',"
    "\n  openItemsPanel: '\u8f6c\u53d1\u80cc\u5305\uff08\u7eaf\u9759\u6001\uff09\uff1b\u7279\u5f81\u6765\u6e90\u540c\u4e0a',"
)
s = s.replace(old3, old3 + add)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('audit v2 written')

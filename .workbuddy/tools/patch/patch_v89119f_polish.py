# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119f_polish.py — 配对文案统一为「对方X反击」（v89.119）
# ----------------------------------------------------------------
# 老板原句：「我方移动，出手，**对方反击**（如有）」——"对方"是他的用词。
# 行里只写「（长枪兵反击 歼 35）」时，读者要自己推"这个长枪兵是敌方"；
# 写成「（对方长枪兵反击 歼 35）」一眼就懂（同名兵种互射时尤其重要）。
# 三处（行 / 纪要 / 回放帧）统一；兜底的**独立段**保持原样（它自带 (我)/(敌) 标注）。
# 同时：修 shot_v89119.js 的 ②，接上沙盘的「📜 战报正文」入口（回合纪要在那一页）。
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
BAK = R + '.workbuddy/backup/v89119/'
files = {}


def load(rel):
    p = R + rel
    files[p] = io.open(p, encoding='utf-8').read()
    return files[p]


def sub(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点 %d 次 → 中止' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ ' + tag)


def pc(s):
    return s.count('{') - s.count('}')


# ---------- ① ui.js 行内 ----------
load('js/ui.js')
sub(R + 'js/ui.js',
    "            return c.name + '反击 歼 ' + U.numText(c.kill, 0);",
    "            return '对方' + c.name + '反击 歼 ' + U.numText(c.kill, 0);",
    '① ui.js 行内加「对方」')

# ---------- ② tactic.js 纪要 ----------
load('js/tactic.js')
sub(R + 'js/tactic.js',
    "          var piece = e.name + '反击 杀伤 ' + U.numText(e.kill, 0);",
    "          var piece = '对方' + e.name + '反击 杀伤 ' + U.numText(e.kill, 0);",
    '② tactic.js 纪要加「对方」')

# ---------- ③ battle.js 回放帧 ----------
load('js/battle.js')
sub(R + 'js/battle.js',
    "          if (hi != null) parts[hi] += '（' + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';",
    "          if (hi != null) parts[hi] += '（对方' + (e.name || '') + '反击 杀 ' + U.numText(e.kill || 0, 0) + '）';",
    '③ battle.js 回放帧加「对方」')

# ---------- ④ smoke §100 断言同步 ----------
load('smoke-test.js')
sub(R + 'smoke-test.js',
    "        && /义兵反击 歼 12/.test(L) && L.indexOf('（') >= 0;",
    "        && /对方义兵反击 歼 12/.test(L) && L.indexOf('（') >= 0;",
    '④ §100 ① 断言同步')
sub(R + 'smoke-test.js',
    "        && /进 30/.test(atkLine) && /→ 义兵 歼 40/.test(atkLine) && /（义兵反击 歼 9）/.test(atkLine)",
    "        && /进 30/.test(atkLine) && /→ 义兵 歼 40/.test(atkLine) && /（对方义兵反击 歼 9）/.test(atkLine)",
    '④ §100 ② 攻方行断言同步')
sub(R + 'smoke-test.js',
    "        && /进 10/.test(defLine) && /→ 长枪兵 歼 8/.test(defLine) && /（长枪兵反击 歼 7）/.test(defLine);",
    "        && /进 10/.test(defLine) && /→ 长枪兵 歼 8/.test(defLine) && /（对方长枪兵反击 歼 7）/.test(defLine);",
    '④ §100 ② 守方行断言同步')

# ---------- ⑤ smoke §100 加一条「文案对齐老板原词」的判定 ----------
sub(R + 'smoke-test.js',
    "    /* ⑧ 兜底：找不到宿主的孤立 counter 独立成格（不静默丢事件） */",
    "    /* ⑧ 文案：配对段用老板原词「对方X反击」（同名兵种互射时不会误读成自己） */\n"
    "    check('⑧ 文案：配对段写作「（对方X反击 歼 N）」——与老板原句「对方反击」对齐', (function () {\n"
    "      return /'对方' \\+ c\\.name \\+ '反击 歼 '/.test(u99)\n"
    "        && /var piece = '对方' \\+ e\\.name \\+ '反击 杀伤 '/.test(t99)\n"
    "        && /parts\\[hi\\] \\+= '（对方'/.test(b99);\n"
    "    })());\n\n"
    "    /* ⑨ 兜底：找不到宿主的孤立 counter 独立成格（不静默丢事件） */",
    '⑤ §100 加文案断言')
sub(R + 'smoke-test.js',
    "    check('⑧ 兜底：孤立 counter（无宿主）独立成格，不静默丢事件', (function () {",
    "    check('⑨ 兜底：孤立 counter（无宿主）独立成格，不静默丢事件', (function () {",
    '⑤ §100 ⑧→⑨ 编号')

# ---------- ⑥ shot_v89119.js：② 接上「📜 战报正文」 ----------
load('.workbuddy/tools/show/shot_v89119.js')
sub(R + '.workbuddy/tools/show/shot_v89119.js',
    "    'snippet:(i<0?\"(无)\":all.slice(Math.max(0,i-80),i+64))};})()');",
    "    'snippet:(i<0?\"(无)\":all.slice(Math.max(0,i-80),i+64))};})()',\n"
    "    /* after：沙盘弹窗 → 点「📜 战报正文」→ 正文页（回合纪要在那一页） */\n"
    "    '(function(){var b=document.querySelector(\"#modal-root [data-action=\\\\\"sd-text\\\\\"]\");if(b)b.click();})()',\n"
    "    900);",
    '⑥ shot ② 接战报正文入口')

# ---------- 落盘 ----------
print('\n落盘：')
for p, s in files.items():
    if '<<<<<<<' in s or '>>>>>>>' in s:
        print('!! 冲突标记：%s' % p); sys.exit(1)
    bak = BAK + os.path.basename(p)
    if os.path.exists(bak):
        b = io.open(bak, encoding='utf-8').read()
        print('  → %s（相对备份净 { } = %+d）' % (os.path.basename(p), pc(s) - pc(b)))
    else:
        print('  → %s（无备份基线，跳过净括号对比）' % os.path.basename(p))
    tmp = p + '.tmp119f'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
print('补丁 F 完成')

# -*- coding: utf-8 -*-
# ================================================================
# patch_v89119h_tall.py — 战报正文页专属加高档（v89.119）
# ----------------------------------------------------------------
# 实机量（1000 高视口 / 13 回合 / 7 兵种载荷）：该页在 850px 下仍溢 41px
#   （此前已做：剥简报里的【兵种损耗】重复文本段 + 回合纪要 5→3 行/页）。
# 处置：给**这一页**加 `modal-tall`（920px），不动 xxl 本体（1200×850 冻结点）。
#   · ui.openModal 支持 `opts.tall`（sizeCls 追加 ' modal-tall'）；
#     已开窗分支用 className 全量覆盖 → 从 tall 页跳普通页会自动摘掉 ✔；
#     层级栈快照存的是完整 className → 回退时 tall 一起还原 ✔。
#   · 顺带清掉 index.html 里 **两处完全相同的 .modal-xxl 重复定义**（后者空转）。
# ================================================================
import io, os, sys

R = 'E:/Deepseekdb/'
BAK = R + '.workbuddy/backup/v89119/'
files = {}


def load(rel):
    p = R + rel
    files[p] = io.open(p, encoding='utf-8').read()
    return files[p]


def sub(p, old, new, tag, expect=1):
    s = files[p]
    n = s.count(old)
    if n != expect:
        print('!! %s 锚点 %d 次（期望 %d）→ 中止' % (tag, n, expect))
        sys.exit(1)
    files[p] = s.replace(old, new, 1 if expect == 1 else n)
    print('  ✓ ' + tag)


def pc(s):
    return s.count('{') - s.count('}')


# ---------- ① index.html：清重复定义 + 加 modal-tall ----------
load('index.html')
sub(R + 'index.html',
    """      —— 它用真实试玩存档压出"哪些面板还会冒滚动条"。 */
  .modal-xxl { width: 1200px; height: 850px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }""",
    """      —— 它用真实试玩存档压出"哪些面板还会冒滚动条"。
     ⚠️ 本档的规则体只在**上一处**（本注释上方那条 .modal-xxl）；v89.119 清掉了
        此处原先的重复定义（两处一字不差，后者空转、只添乱）。 */
  /* v89.119：**战报正文页**（信息流页：回放 + 回合纪要 + 兵种损耗表）专属加高 ——
     该页在"13 回合 / 7 兵种"的真实载荷下 850px 仍溢 41px（实机量），
     放开到 min(920px, calc(100vh - 40px))：1000 高视口 → 920px（零溢出并留余量）。
     ⚠️ 只对这一页生效（modal-tall 由 ui.openModal 的 opts.tall 注入）——**不动 xxl 本体**。 */
  .modal.modal-xxl.modal-tall { height: min(920px, calc(100vh - 40px)); }""",
    '① index.html 去重复 + 加 modal-tall')

# ---------- ② ui.openModal 支持 opts.tall ----------
load('js/ui.js')
sub(R + 'js/ui.js',
    """    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档""",
    """    var sizeCls = o.size ? (' modal-' + o.size) : '';
    if (o.size === 'md') sizeCls = '';                 // 'md' 就是默认档
    /* v89.119：opts.tall —— 在档位基础上**放开高度**（战报正文页专属，见 index.html 的
       `.modal.modal-tall` 规则）。已开窗分支用 className 全量覆盖 → 跳回普通页自动摘掉；
       层级栈存完整 className → 回退时一起还原。 */
    if (o.tall) sizeCls += ' modal-tall';""",
    '② openModal 支持 opts.tall')

# ---------- ③ viewReportText 传 tall ----------
sub(R + 'js/ui.js',
    "    ui.openModal(html, 'xxl');",
    "    ui.openModal(html, { size: 'xxl', tall: true });   /* v89.119：正文页信息流长 → 专属加高 */",
    '③ viewReportText 传 tall')

# ---------- ④ smoke §100 加 ⑪ 断言 ----------
load('smoke-test.js')
sub(R + 'smoke-test.js',
    "    /* ⑩ 战报正文页去重：简报里的【兵种损耗】文本段被剥离（结构化表仍在） */",
    """    /* ⑪ 战报正文页专属加高（modal-tall）：xxl 本体不动 + 重复定义已清 */
    check('⑪ 战报正文页专属加高（modal-tall；xxl 本体仍 1200×850 且只定义一次）', (function () {
      var h = _fs99.readFileSync(_p99.join(__dirname, 'index.html'), 'utf8');
      var dup = (h.match(/\\.modal-xxl \\{ width: 1200px; height: 850px;/g) || []).length;
      return /\\.modal\\.modal-xxl\\.modal-tall \\{ height: min\\(920px, calc\\(100vh - 40px\\)\\); \\}/.test(h)
        && dup === 1                                  /* 重复定义已清（v89.119 前是 2） */
        && /if \\(o\\.tall\\) sizeCls \\+= ' modal-tall';/.test(u99)
        && /ui\\.openModal\\(html, \\{ size: 'xxl', tall: true \\}\\)/.test(u99);
    })());

    /* ⑩ 战报正文页去重：简报里的【兵种损耗】文本段被剥离（结构化表仍在） */""",
    '④ §100 加 ⑪ 断言')

# ---------- 落盘 ----------
print('\n落盘：')
for p, s in files.items():
    if '<<<<<<<' in s or '>>>>>>>' in s:
        print('!! 冲突标记：%s' % p); sys.exit(1)
    bak = BAK + os.path.basename(p)
    if os.path.exists(bak):
        b = io.open(bak, encoding='utf-8').read()
        print('  → %s（相对备份净 { } = %+d）' % (os.path.basename(p), pc(s) - pc(b)))
    tmp = p + '.tmp119i'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, p)
print('补丁 H 完成')

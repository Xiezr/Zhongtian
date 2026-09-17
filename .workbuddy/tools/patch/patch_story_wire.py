#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""patch_story_wire.py -- wire the text game into main.js / index.html / smoke-test.js

  main.js      : 4 dispatch cases (story-list / story-open / story-pick / story-exit)
  index.html   : <script src="story/vol-01.js"> + .sgr-* styles
  smoke-test.js: require('./story/vol-01.js') so the headless suite sees the data

Style discipline: only token-based font sizing (var(--fs-*)), weights 400/700 only,
no bare px font sizes, no letter-spacing:4px.

No backslash escapes (newlines via chr(10)) -- nothing can be eaten on the way to disk.
Idempotent: each target checks for its own marker first.
"""
import io

MAIN = r'E:\Deepseekdb\js\main.js'
HTML = r'E:\Deepseekdb\index.html'
SMOKE = r'E:\Deepseekdb\smoke-test.js'
A = chr(10)

MAIN_OLD = u"""      case 'sxf-exit': ui.closeSceneFx(); break;"""
MAIN_NEW = u"""      case 'sxf-exit': ui.closeSceneFx(); break;
      /* 文字游戏（story/）：清单 / 开卷 / 选择 / 收起 */
      case 'story-list': ui.openStoryList(el.dataset.kind, el.dataset.id, el.dataset.name); break;
      case 'story-open': ui.openStory(el.dataset.sid); break;
      case 'story-pick': ui.sgPick(Number(el.dataset.i)); break;
      case 'story-exit': ui.sgClose(); break;"""

HTML_OLD_SCRIPT = u"""<script src="js/story.js"></script>"""
HTML_NEW_SCRIPT = u"""<script src="js/story.js"></script>
<!-- 文字游戏故事库（story/）：数据追加到 window.STORY_DATA；卷文件按需增补 -->
<script src="story/vol-01.js"></script>"""

HTML_CSS = u"""
  /* ================= 文字游戏 · 阅读器（story/） =================
     取色/字号全部走主题令牌；标题沿用共享规则内的既有类（.gold-heading / .side-title）。
     .sgr-text 用 pre-wrap 保留正文换行（数据里的换行即段落，不转 <br>）。 */
  #story-fx .sgr-wrap { max-width: 880px; margin: 0 auto; padding: var(--sp-6) var(--sp-5) 72px; }
  .sgr-banner { display: flex; align-items: center; gap: var(--sp-3);
    border-bottom: 1px solid var(--sep-gold); padding-bottom: var(--sp-3); margin-bottom: var(--sp-5); }
  .sgr-title { flex: 1 1 auto; }
  .sgr-text { font-size: var(--fs-lead); line-height: 2; white-space: pre-wrap; color: var(--text); }
  .sgr-ops { display: flex; flex-direction: column; gap: var(--sp-3); margin-top: var(--sp-5); }
  .sgr-opt { display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-1);
    height: auto; text-align: left; padding: var(--sp-3) var(--sp-4); line-height: 1.6; }
  .sgr-l { font-weight: 700; color: var(--text-strong); }
  .sgr-d { font-size: var(--fs-sub); color: var(--text-dim); font-weight: 400; }
  .sgr-end { border: 1px solid var(--sep-gold); border-radius: var(--r-lg);
    padding: var(--sp-5); background: var(--panel-bg); }
  .sgr-g-win { border-color: var(--gold); }
  .sgr-g-lose { border-color: var(--red); }
  .sgr-got { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-4);
    margin-top: var(--sp-4); padding-top: var(--sp-3); border-top: 1px solid var(--line); }
  .sgr-gv { color: var(--gold-light); font-weight: 700; }
  .sgr-gv i { font-style: normal; color: var(--text-dim); font-weight: 400; margin-right: var(--sp-1); }
  .sgr-note { color: var(--text-dim); font-size: var(--fs-cap); }
</style>"""

SMOKE_OLD = u"""  require('./js/story.js');"""
SMOKE_NEW = u"""  require('./js/story.js');
  /* 文字游戏故事库（story/）：与 index.html 同序 —— 数据先行，ui/main 后取 */
  require('./story/vol-01.js');"""


def patch(path, edits, marker):
    src = io.open(path, encoding='utf-8', newline='').read()
    if marker in src:
        print('%-14s already patched -- skip' % path.rsplit(chr(92), 1)[-1])
        return True
    for i, (old, new) in enumerate(edits, 1):
        n = src.count(old)
        if n != 1:
            print('  ANCHOR %d in %s matched %d times (expected 1) -- aborted' % (i, path, n))
            return False
        src = src.replace(old, new)
    io.open(path, 'w', encoding='utf-8', newline='').write(src)
    chk = io.open(path, encoding='utf-8', newline='').read()
    ok = marker in chk
    print('%-14s written (%d chars) -- verify %s' % (path.rsplit(chr(92), 1)[-1], len(chk), 'PASS' if ok else 'FAIL'))
    return ok


all_ok = True
all_ok &= patch(MAIN, [(MAIN_OLD, MAIN_NEW)], u"case 'story-open'")
all_ok &= patch(HTML, [(HTML_OLD_SCRIPT, HTML_NEW_SCRIPT), (u'</style>', HTML_CSS.lstrip(chr(10)))], u'.sgr-text')
all_ok &= patch(SMOKE, [(SMOKE_OLD, SMOKE_NEW)], u"require('./story/vol-01.js')")
print('ALL %s' % ('PASS' if all_ok else 'FAIL'))
raise SystemExit(0 if all_ok else 1)

# -*- coding: utf-8 -*-
# v89.150（老板 3）：回放动作 case 退役（main.js）+ 回放/纪要 CSS 退役 + 三块新样式（index.html）
import io, re


def patch(P, segs):
    s = io.open(P, encoding='utf-8', newline='').read()
    for old, new, tag in segs:
        _cands = sorted([l.strip() for l in new.split('\n')
                         if l.strip() and re.search(r'[A-Za-z\u4e00-\u9fff]', l)], key=len, reverse=True)
        mark = None
        for _c in _cands:
            if s.count(_c) == 0 or (s.count(_c) == 1 and old not in s):
                mark = _c; break
        assert mark, '找不到幂等特征 [' + tag + ']'
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag)
    return s


# ============ ① main.js：回放控制 case 整条退役 ============
patch('E:/Deepseekdb/js/main.js', [
("""      /* v89.94（B2 · E3）：战报回放控制（逐帧 / 播放 / 关键帧跳转） */
      case 'rep-prev': ui.replayStep(-1); break;
      case 'rep-next': ui.replayStep(1); break;
      case 'rep-play': ui.replayToggle(); break;
      case 'rep-jump': ui.replayJump(Number(el.dataset.v)); break;
""",
 """      /* ⛔ v89.150（老板 3）：`rep-prev / rep-next / rep-play / rep-jump`
         （战报「分回合回放」的逐帧/播放/关键帧控制）随该板块一并退役 —— 四个 case 全删。
         「沙盘回放」（open-sandbox → sd-* 系列动作）是另一个功能，不受影响。 */
""",
 '① main.js 回放 case 退役'),
])

# ============ ② index.html：回放/纪要 CSS 退役 + 三块新样式 ============
patch('E:/Deepseekdb/index.html', [
("""  .rp-ev { color: var(--text-dim); font-size: var(--fs-cap); line-height: var(--lh-body);
    padding: var(--sp-0) 0 var(--sp-2) var(--sp-7); border-bottom: 1px dotted rgba(var(--gold-rgb),.12); }
  .rp-ctl { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin: var(--sp-2) 0 var(--sp-1); }
  .rp-range { flex: 1; min-width: 120px; accent-color: var(--gold-dark); }
  .rp-pos { flex: none; color: var(--text-dim); font-size: var(--fs-cap);
    font-variant-numeric: tabular-nums; }
  .rp-keys { display: flex; gap: var(--sp-2); flex-wrap: wrap; align-items: center;
    color: var(--text-dim); font-size: var(--fs-cap); margin-bottom: var(--sp-1); }
  .rp-key { cursor: pointer; }
  .rp-under { color: var(--gold-light); font-size: var(--fs-sub); text-align: center;
    padding: var(--sp-1) 0 var(--sp-0); }""",
 """  /* ⛔ v89.150（老板 3）：`.rp-ev / .rp-ctl / .rp-keys / .rp-key`（战报「分回合回放」专用）
     随该板块一并退役。`.rp-range / .rp-pos` **保留** —— 战报沙盘（sd-*）的帧滑杆还在用。
     v89.150 新增：正文页三块（战斗总结 / 战斗收获 / 兵种损耗）的排版 ——
       总结**逐行**、收获**两列（类别 │ 内容）**，一行一类，扫读即可。 */
  .rp-range { flex: 1; min-width: 120px; accent-color: var(--gold-dark); }
  .rp-pos { flex: none; color: var(--text-dim); font-size: var(--fs-cap);
    font-variant-numeric: tabular-nums; }
  .rp-under { color: var(--gold-light); font-size: var(--fs-sub); text-align: center;
    padding: var(--sp-1) 0 var(--sp-0); }
  .rp-lines { display: flex; flex-direction: column; gap: var(--sp-1);
    font-size: var(--fs-lead); line-height: var(--lh-body); }
  .rp-line { padding: 1px 0; }
  .rp-lines.rp-evts .rp-line { color: var(--gold-light); }
  .rp-gain { display: grid; grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--sp-hair) var(--sp-4); font-size: var(--fs-lead); line-height: var(--lh-body); }
  .rp-glabel { color: var(--text-dim); text-align: right; white-space: nowrap; }
  .rp-glabel:empty::before { content: '·'; opacity: .35; }
  .rp-gtext { min-width: 0; }""",
 '②-1 新三块样式 + 回放 CSS 退役'),

("""  /* v89.112：战报详情 · 回合纪要专用容器。
     ⚠️ 与上面 .bt-log（沙盘"战斗中实时日志"小窗）**不是一回事**：那是地图上浮窗，
     168px 是设计；这里是弹窗详情页，配 ui.modalPage 翻页，无中间高度。 */
  .rp-log { display: flex; flex-direction: column; gap: var(--sp-hair); }""",
 """  /* ⛔ v89.150（老板 3）：`.rp-log`（战报详情·回合纪要专用容器）随「回合纪要」板块一并退役。
     上面 `.bt-log`（沙盘"战斗中实时日志"小窗）**不受影响** —— 那是另一处。 */""",
 '②-2 .rp-log 退役'),
])

print('ALL OK')

# -*- coding: utf-8 -*-
"""v89.1 CSS：index.html 追加 .sxf-* 剧本视觉化样式与两段动效（插入 </style> 前）。探针幂等。"""
import io

P = r'E:\Deepseekdb\index.html'
d = io.open(P, encoding='utf-8', newline='').read()

CSS = r'''
  /* ---------- v89.1 全屏剧本视觉化（幕景横幅 / 幕题 / 徽章 / 结算卡） ---------- */
  .sxf-wrap { max-width: 860px; margin: 0 auto; padding: var(--sp-6) var(--sp-5) 72px;
    animation: sxfIn .38s ease-out both; }
  .sxf-hero { position: relative; overflow: hidden; border: 1px solid var(--sep-gold);
    border-radius: var(--r-xl); padding: var(--sp-5) var(--sp-6) var(--sp-4); background: var(--panel-bg); }
  .sxf-hero-art { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
    font-size: 118px; line-height: 1; opacity: .10; pointer-events: none; }
  .sxf-hero-top { position: relative; display: flex; align-items: center; gap: 10px; }
  .sxf-act-ic { font-size: 40px; line-height: 1; }
  .sxf-hero-name { font-size: var(--fs-h1); font-weight: 800; color: var(--gold-light); }
  .sxf-hero-kind { color: var(--text-dim); font-size: var(--fs-cap); border: 1px solid var(--line-strong);
    border-radius: 999px; padding: 1px 8px; }
  .sxf-hero-lord { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .sxf-lord-meta { display: flex; flex-direction: column; align-items: flex-end; }
  .sxf-lord-meta b { color: var(--text-strong); }
  .sxf-lord-sub { color: var(--text-dim); font-size: var(--fs-cap); white-space: nowrap; }
  .sxf-hero-meta { position: relative; color: var(--text-dim); font-size: var(--fs-sub); margin-top: 6px; }
  .sxf-hero-foot { position: relative; display: flex; align-items: center; margin-top: var(--sp-4);
    border-top: 1px solid var(--line); padding-top: var(--sp-4); }
  .sxf-dots { letter-spacing: 5px; }
  .sxf-dot { color: var(--text-dim); }
  .sxf-dot.on { color: var(--gold); }
  .sxf-hero-foot .btn { margin-left: auto; }
  .sxf-timeline { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: var(--sp-4);
    color: var(--text-dim); font-size: var(--fs-sub); }
  .sxf-tl-cap { color: var(--gold-light); }
  .sxf-tl-item { color: var(--text-strong); }
  .sxf-tl-l { color: var(--text-dim); margin-left: 4px; }
  .sxf-tl-sep { color: var(--text-dim); }
  .sxf-stage { margin-top: var(--sp-4); }
  .sxf-stage-tag { display: flex; align-items: baseline; gap: 10px; margin-bottom: var(--sp-3); }
  .sxf-stage-no { color: var(--gold-light); font-size: var(--fs-sub); letter-spacing: 1px; }
  .sxf-stage-tt { color: var(--text-strong); font-size: var(--fs-h3); font-weight: 700; }
  .sxf-narr { background: var(--panel-bg); border: 1px solid var(--sep-gold); border-radius: var(--r-lg);
    padding: var(--sp-5) var(--sp-6); font-size: var(--fs-lead); line-height: 1.95; color: var(--text); }
  .sxf-q { color: var(--gold-light); }
  .sxf-opts { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
  .btn.sxf-opt { display: flex; align-items: center; gap: 10px; text-align: left; padding: 11px 14px;
    font-size: var(--fs-lead); }
  .sxf-opt-l { flex: 1 1 auto; min-width: 0; }
  .sxf-opt-l b { color: var(--gold-light); }
  .sxf-opt-d { color: var(--text-dim); font-weight: 400; margin-left: 10px; font-size: var(--fs-sub); }
  .sxf-opt-b { flex: 0 0 auto; display: inline-flex; gap: 6px; }
  .sxf-bdg { border: 1px solid; border-radius: 999px; padding: 1px 7px; font-size: var(--fs-cap);
    white-space: nowrap; line-height: 1.6; }
  .sxf-note { margin-top: var(--sp-4); color: var(--text-dim); font-size: var(--fs-cap); }
  .sxf-result { text-align: center; margin-top: var(--sp-5); }
  .sxf-emblem { width: 96px; height: 96px; margin: 0 auto; display: flex; align-items: center;
    justify-content: center; font-size: var(--sxf-emb-sz); border: 1px solid; border-radius: 50%;
    background: var(--panel-bg); box-shadow: 0 0 26px rgba(var(--gold-rgb), .18);
    animation: sxfPop .5s cubic-bezier(.2,.9,.3,1.35) both; }
  .sxf-exit-t { font-size: var(--fs-h1); font-weight: 800; margin-top: var(--sp-4); }
  .sxf-exit-s { color: var(--text-dim); font-size: var(--fs-sub); margin-top: 4px; }
  .sxf-loot { background: var(--panel-bg); border: 1px solid var(--sep-gold); border-radius: var(--r-lg);
    padding: var(--sp-4) var(--sp-6); margin-top: var(--sp-5); text-align: left; }
  .sxf-loot-hd { color: var(--text-dim); font-size: var(--fs-body); margin-bottom: 6px; }
  .sxf-loot-row { font-size: var(--fs-lead); line-height: 2; color: var(--green-ok); }
  .sxf-loot-row.bad { color: var(--red-light); }
  .sxf-loot-row::before { content: '◆ '; font-size: var(--fs-cap); }
  .sxf-cost { color: var(--text-dim); font-size: var(--fs-cap); margin-top: var(--sp-4); }
  .sxf-exit-row { margin-top: var(--sp-6); }
  @keyframes sxfIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes sxfPop { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
'''

i = d.find('</style>')
assert i > 0, '</style> 未找到'

if '.sxf-wrap {' in d:
    print('SKIP v89.1 CSS 已存在')
else:
    d = d[:i] + CSS.lstrip('\n') + '\n' + d[i:]
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.1 CSS 已写入')

# —— 幂等复查 ——
d2 = io.open(P, encoding='utf-8', newline='').read()
css2 = d2.split('<style>')[1].split('</style>')[0]
import re
px = re.findall(r'font-size:\s*[0-9.]+px', css2)
print('.sxf 规则数:', len(re.findall(r'\.sxf-[a-z-]+', css2)), '| 裸px字号:', len(px), px)
print('rgba255 残留:', len(re.findall(r'rgba\(255,\s*255,\s*255,', css2)),
      '| color:# 计数:', len(re.findall(r'(?<![-\w])color:\s*#[0-9a-fA-F]{3,6}', css2)),
      '| keyframes:', len(re.findall(r'@keyframes', css2)))

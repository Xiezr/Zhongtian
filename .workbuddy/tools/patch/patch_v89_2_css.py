# -*- coding: utf-8 -*-
"""v89.2 CSS：场景画布 / 热点点选 / 时机条 / 选项图标 + sxfPing 脉冲。插入 </style> 前。探针幂等。"""
import io

P = r'E:\Deepseekdb\index.html'
d = io.open(P, encoding='utf-8', newline='').read()

CSS = r'''
  /* ---------- v89.2 场景化（场景画布 / 热点点选 / 时机条） ---------- */
  .sxf-scene { position: relative; margin-top: var(--sp-4); border: 1px solid var(--sep-gold);
    border-radius: var(--r-xl); overflow: hidden; background: var(--slab-1);
    box-shadow: inset 0 0 44px rgba(var(--sh-rgb), .30); animation: sxfIn .4s ease-out both; }
  .sxf-canvas { display: block; width: 100%; height: auto; }
  .sxf-scene.is-done .sxf-canvas { opacity: .84; filter: saturate(.85); }
  .sxf-spots { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
  .btn.sxf-opt.sxf-spot { position: absolute; transform: translate(-50%, -50%);
    display: inline-flex; flex-direction: column; align-items: center; gap: 4px;
    width: auto; padding: 0; background: none; border: none; box-shadow: none; }
  .sxf-spot-hit { width: 22px; height: 22px; border-radius: 50%;
    background: rgba(var(--gold-rgb), .92); border: 2px solid rgba(var(--hl-rgb), .85);
    box-shadow: 0 0 0 0 rgba(var(--gold-rgb), .55), 0 2px 6px rgba(var(--sh-rgb), .5);
    animation: sxfPing 1.8s ease-out infinite; }
  .btn.sxf-opt.sxf-spot:hover .sxf-spot-hit { background: var(--gold); }
  .sxf-spot-lb { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    background: rgba(var(--sh-rgb), .62); border: 1px solid var(--sep-gold);
    border-radius: 999px; padding: 2px 10px; font-size: var(--fs-cap); color: var(--parchment); }
  .sxf-spot-lb b { color: var(--gold-light); }
  .sxf-sc-tip { position: absolute; left: var(--sp-4); bottom: var(--sp-3); z-index: 2;
    font-size: var(--fs-cap); color: var(--parchment); background: rgba(var(--sh-rgb), .55);
    border-radius: 999px; padding: 2px 10px; letter-spacing: 1px; }
  .sxf-timing { margin-top: var(--sp-4); background: var(--panel-bg); border: 1px solid var(--sep-gold);
    border-radius: var(--r-lg); padding: var(--sp-4) var(--sp-5); }
  .sxf-tk { position: relative; height: 26px; border-radius: 999px; overflow: hidden;
    background: linear-gradient(180deg, rgba(var(--sh-rgb), .55), rgba(var(--sh-rgb), .30));
    border: 1px solid var(--line-strong); }
  .sxf-zone { position: absolute; top: 0; height: 100%; }
  .sxf-zone-g { left: 28%; width: 44%; background: rgba(var(--hl-rgb), .08); }
  .sxf-zone-p { left: 44%; width: 12%; background: rgba(var(--gold-rgb), .38); }
  .sxf-mark { position: absolute; top: 2px; left: 4%; width: 4px; height: 20px; border-radius: 3px;
    background: var(--gold-light); box-shadow: 0 0 8px rgba(var(--gold-rgb), .8); }
  .sxf-tm-row { display: flex; align-items: center; gap: var(--sp-4); margin-top: var(--sp-3); }
  .sxf-tm-hint { flex: 1 1 auto; color: var(--text-dim); font-size: var(--fs-cap); }
  .sxf-opt-ic { flex: 0 0 auto; width: 26px; height: 26px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(var(--hl-rgb), .08); font-size: var(--fs-body); }
  @keyframes sxfPing {
    0% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb), .55), 0 2px 6px rgba(var(--sh-rgb), .5); }
    70% { box-shadow: 0 0 0 14px rgba(var(--gold-rgb), 0), 0 2px 6px rgba(var(--sh-rgb), .5); }
    100% { box-shadow: 0 0 0 0 rgba(var(--gold-rgb), 0), 0 2px 6px rgba(var(--sh-rgb), .5); }
  }
'''

i = d.find('</style>')
assert i > 0, '</style> 未找到'

if '.sxf-scene {' in d:
    print('SKIP v89.2 CSS 已存在')
else:
    d = d[:i] + CSS.lstrip('\n') + '\n' + d[i:]
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.2 CSS 已写入')

d2 = io.open(P, encoding='utf-8', newline='').read()
css2 = d2.split('<style>')[1].split('</style>')[0]
import re
px = re.findall(r'font-size:\s*[0-9.]+px', css2)
print('.sxf 规则:', len(re.findall(r'\.sxf-[a-z-]+', css2)), '| 裸px字号:', len(px), '(≤9)', px)
print('rgba255 残留:', len(re.findall(r'rgba\(255,\s*255,\s*255,', css2)),
      '| color:#:', len(re.findall(r'(?<![-\w])color:\s*#[0-9a-fA-F]{3,6}', css2)), '(≤8)',
      '| keyframes:', len(re.findall(r'@keyframes', css2)))

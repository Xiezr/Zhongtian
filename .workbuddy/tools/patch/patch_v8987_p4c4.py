# -*- coding: utf-8 -*-
"""v89.87 需求4c-4：战场界面 CSS + BUILD 版本升级（8985→8987）"""
import io

P = r'E:\Deepseekdb\index.html'
s = io.open(P, encoding='utf-8', newline='').read()

CSS = """  /* ============================================================
   * 战场界面（v89.87 · 老板需求 4）：实时观战 + 逐回合指挥
   * ------------------------------------------------------------
   * 距离轴：左我军 / 右敌军；单位卡绝对定位，`transition: left` 即位移演出。
   * 主题兼容：底色一律用 rgba(var(--sh-rgb),…) / 金色变量，浅深主题都不打架。
   * ============================================================ */
  .bt-top { display: flex; align-items: center; gap: 16px; padding: 4px 2px 8px;
    font-size: var(--fs-sub); color: var(--text-dim); flex-wrap: wrap; }
  .bt-top .bt-cd b { color: var(--gold-light); font-size: 17px; }
  .bt-top .bt-hint { margin-left: auto; opacity: .72; font-size: var(--fs-cap); }
  .bt-field { position: relative; min-height: 120px; margin: 2px 0 8px; border-radius: 10px;
    border: 1px solid rgba(232, 206, 136, .18); overflow: hidden;
    background: linear-gradient(90deg, rgba(232, 206, 136, .06), rgba(var(--sh-rgb), .42) 50%, rgba(190, 84, 74, .08)); }
  .bt-field::after { content: ''; position: absolute; left: 50%; top: 8%; bottom: 8%; width: 1px;
    background: var(--text-dim); opacity: .3; }
  .bt-unit { position: absolute; transform: translateX(-50%); display: flex; align-items: center;
    gap: 5px; padding: 3px 9px; border-radius: 8px; font-size: var(--fs-sub); white-space: nowrap;
    transition: left .55s cubic-bezier(.4, .8, .4, 1); }
  .bt-unit .bt-ico svg { width: 20px; height: 20px; vertical-align: middle; }
  .bt-unit .bt-n { color: var(--gold-light); }
  .bt-unit.atk { background: rgba(232, 206, 136, .16); border: 1px solid rgba(232, 206, 136, .5); }
  .bt-unit.def { background: rgba(190, 84, 74, .16); border: 1px solid rgba(190, 84, 74, .48); }
  .bt-unit.def .bt-n { color: #e8a49b; }
  .bt-unit.hit { animation: btHit .36s ease; }
  @keyframes btHit { 0%, 100% { filter: none; } 40% { filter: brightness(1.9) saturate(1.6); } }
  .bt-castle { position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    font-size: var(--fs-sub); color: var(--gold-light); opacity: .92; }
  .bt-log { max-height: 118px; overflow-y: auto; background: rgba(var(--sh-rgb), .3);
    border-radius: 8px; padding: 6px 10px; font-size: var(--fs-sub); line-height: 1.75; }
  .bt-ev.attack { color: #d99a4e; }
  .bt-ev.counter { color: #6fa8d8; }
  .bt-ev.tower, .bt-ev.wall { color: var(--gold-light); }
  .bt-cmd { margin-top: 8px; }
  .bt-cmd-h { font-size: var(--fs-cap); color: var(--text-dim); margin: 2px 0 4px; }
  .bt-cmdrow { display: flex; align-items: center; gap: 8px; padding: 3px 0; flex-wrap: wrap; }
  .bt-cmdrow .bt-ico svg { width: 18px; height: 18px; vertical-align: middle; }
  .bt-cmdnm { min-width: 62px; font-size: var(--fs-sub); }
  .bt-cmdst { display: inline-flex; gap: 4px; }
  .bt-btn { padding: 2px 11px; border-radius: 6px; cursor: pointer; font-size: var(--fs-cap);
    border: 1px solid rgba(232, 206, 136, .32); background: rgba(var(--sh-rgb), .42);
    color: var(--text-dim); }
  .bt-btn:hover { color: var(--gold-light); border-color: rgba(232, 206, 136, .6); }
  .bt-btn.on { color: var(--ink-on-gold); background: linear-gradient(180deg, #e8ce88, #c9a24b);
    border-color: #c9a24b; }
  .bt-sel { background: rgba(var(--sh-rgb), .5); color: var(--text); border-radius: 6px;
    border: 1px solid rgba(232, 206, 136, .32); padding: 2px 6px; font-size: var(--fs-cap); }
  .bt-end { text-align: center; padding: 18px 8px; }
  .bt-end-t { font-size: var(--fs-h2); color: var(--gold-light); margin-bottom: 8px; }
  .bt-end-s { font-size: var(--fs-sub); color: var(--text-dim); line-height: 1.9; }
</style>"""

assert s.count('</style>') == 1, ('style', s.count('</style>'))
s = s.replace('</style>', CSS, 1)

# BUILD 版本：8985 → 8987（99 处 ?v= 与 BUILD 标记同版）
n = s.count('v=8985')
assert n == 99, ('vcount', n)
s = s.replace('v=8985', 'v=8987')
assert s.count('<!-- BUILD 8985 -->') == 1
s = s.replace('<!-- BUILD 8985 -->', '<!-- BUILD 8987 -->')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK index.html CSS + BUILD 8987（%d 处版本号）' % n)

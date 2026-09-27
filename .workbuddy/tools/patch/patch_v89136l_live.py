# -*- coding: utf-8 -*-
# v89.136 批6：live 续铺（上轮清单①）+ 将领视图秒刷（上轮清单②）
import io

ROOT = 'E:/Deepseekdb/'
def rd(p): return io.open(ROOT + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(ROOT + p, 'w', encoding='utf-8', newline='').write(s)
def rep1(s, old, new, tag):
    n = s.count(old)
    assert n == 1, tag + ' 锚点 = ' + str(n)
    return s.replace(old, new)

# ============================================================
# ① main.js 主循环：将领视图秒刷（带滚动保持）
# ============================================================
m = rd('js/main.js')
old1 = """        if (ui.view === 'map') ui.renderMapCanvas();
      }
    }, 1000);"""
new1 = """        /* v89.136（上轮未完成清单②）：**将领视图逐秒刷新**（带滚动保持）——
           体力/精力随现实时间回复、经验/忠诚/状态变化即时可见（与军务总览同款守卫）。 */
        if (ui.view === 'generals') {
          var _ae136 = document.activeElement;
          if (!_ae136 || ['INPUT', 'SELECT', 'TEXTAREA'].indexOf(_ae136.tagName) < 0) {
            var _vc136 = document.getElementById('view-container');
            var _st136 = _vc136 ? _vc136.scrollTop : 0;
            ui.renderView('generals');
            if (_vc136) _vc136.scrollTop = _st136;
          }
        }
        if (ui.view === 'map') ui.renderMapCanvas();
      }
    }, 1000);"""
m = rep1(m, old1, new1, '① 主循环 generals')
wr('js/main.js', m)
print('OK · main.js', len(m))

# ============================================================
# ② ui.js：live 续铺 5 处
# ============================================================
u = rd('js/ui.js')

# 铁匠铺（主线 openShell）
old2 = """    ui.openShell({
      title: '⚒️ 铁匠铺 · Lv' + lv,"""
new2 = """    ui.openShell({
      /* v89.136（上轮清单① live 续铺）：逐秒刷新（黄金/铁/木/石随打造即时变） */
      live: function () { ui.openForge(); },
      title: '⚒️ 铁匠铺 · Lv' + lv,"""
u = rep1(u, old2, new2, '②a 铁匠铺')

# 客栈（主线 openShell）
old3 = """    ui.openShell({
      title: '🍶 客栈 · Lv' + lv,"""
new3 = """    ui.openShell({
      /* v89.136（清单①）：逐秒刷新（候选/空位/刷新次数实时） */
      live: function () { ui.openInn(); },
      title: '🍶 客栈 · Lv' + lv,"""
u = rep1(u, old3, new3, '②b 客栈')

# 门派
old4 = """    ui.openModal(html, { size: 'xxl' });   /* v89.105：六派两列后实测 790px */"""
new4 = """    ui.openModal(html, { size: 'xxl', live: function () { ui.openSect(); } });
    /* v89.105：六派两列后实测 790px；v89.136（清单①）：live 逐秒刷新（声望/任务/冷却实时） */"""
u = rep1(u, old4, new4, '②c 门派')

# 市场（openModal 尾 · 带独特上下文）
old5 = """        '<button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：内容实测 786px（两段表格纵向叠放）—— lg(600) 装不下、xl(700) 差 90、
         xxl(800) 才容得下。选档依据写在 docs/v89105，改内容时**重新量**再选档。 */
      'xxl'
    );
  };"""
new5 = """        '<button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.105：内容实测 786px（两段表格纵向叠放）—— lg(600) 装不下、xl(700) 差 90、
         xxl(800) 才容得下。选档依据写在 docs/v89105，改内容时**重新量**再选档。
         v89.136（清单①）：live 逐秒刷新（报价 / 折损 / 库存随交易即时变）。 */
      { size: 'xxl', live: function () { ui.openMarket(); } }
    );
  };"""
u = rep1(u, old5, new5, '②d 市场')

# 野地总览（openWilds 尾）
old6 = """      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      { size: 'xxl' }"""
new6 = """      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',
      /* v89.136（清单①）：live 逐秒刷新（产量加成/等级衰减随日推进实时） */
      { size: 'xxl', live: function () { ui.openWilds(); } }"""
u = rep1(u, old6, new6, '②e 野地总览')

wr('js/ui.js', u)
print('OK · ui.js', len(u))

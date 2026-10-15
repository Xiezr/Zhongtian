# -*- coding: utf-8 -*-
"""v89.195 批次C：等级高功能强（档位一览表）
C1 ui.js  openOutposts 底部加「等级档位一览」（读 DATA.FORT_AURA.tiers 唯一表）"""
import io

R = 'E:/Deepseekdb/'

def rd(p): return io.open(R + p, 'r', encoding='utf-8', newline='').read()
def wr(p, s): io.open(R + p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if s.count(mark) >= 1:
        print('[skip] ' + tag); return
    c = s.count(old)
    assert c == cnt, tag + ' count=' + str(c)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)

C1_OLD = """      (list.length > 13 ? pgW.pager : '') +
      (cityLine ? '<div class="wild-total" style="margin-top:8px;">' + cityLine + '</div>' : '') +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',"""
C1_NEW = """      (list.length > 13 ? pgW.pager : '') +
      (cityLine ? '<div class="wild-total" style="margin-top:8px;">' + cityLine + '</div>' : '') +
      /* v89.195（老板 2）：「等级高功能强」——**等级档位一览**（口径直读唯一表
         DATA.FORT_AURA.tiers）：把五档完整护持摆给玩家看，给"去打高级据点"一个
         明确的目标；档位边界由表派生（第 i 档下限 = 上一档 lv + 1），不另写一份。 */
      (function () {
        var tiers195 = (DATA.FORT_AURA || {}).tiers || [];
        if (!tiers195.length) return '';
        var rows195 = tiers195.map(function (t, i) {
          var lo = (i === 0) ? 1 : ((tiers195[i - 1].lv || 2) + 1);
          return '<tr><td class="ctr">Lv' + lo + '–' + t.lv + '</td>' +
            '<td class="ctr">' + t.radius + ' 格</td>' +
            '<td class="ctr">×' + t.gatherMul + '</td>' +
            '<td class="ctr">+' + Math.round(t.treasureAdd * 100) + '%</td>' +
            '<td class="ctr">×' + t.garrisonCapMul + '</td>' +
            '<td class="ctr">' + (t.intel === 'full' ? '确凿' : '半明') + '</td>' +
            '<td class="ctr">' + t.tax + ' 金/日</td></tr>';
        }).join('');
        return '<div style="margin-top:8px;">' +
          '<div class="ui-sub" style="text-align:center;margin-bottom:4px;">📶 等级档位一览' +
          '（前哨等级 = 占据时据点等级 · 等级越高护持越强）</div>' +
          '<table class="tbl"><thead><tr><th class="ctr">档位</th><th class="ctr">辐射</th>' +
          '<th class="ctr">采集</th><th class="ctr">宝物</th><th class="ctr">驻军上限</th>' +
          '<th class="ctr">情报</th><th class="ctr">商税</th></tr></thead>' +
          '<tbody>' + rows195 + '</tbody></table></div>';
      })() +
      '<div style="text-align:center;margin-top:12px;"><button class="btn" data-action="close-modal">关闭</button></div>',"""
rep('js/ui.js', 'C1 outposts-tier-table', C1_OLD, C1_NEW, '📶 等级档位一览')

print('批次C 完成')

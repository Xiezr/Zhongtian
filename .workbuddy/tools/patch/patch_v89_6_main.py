# -*- coding: utf-8 -*-
"""v89.6 main.js 补丁：do-wonder / open-journal / journal-go 接线"""
import io

P = r'E:\Deepseekdb\js\main.js'
d = io.open(P, encoding='utf-8', newline='').read()

OLD = """      case 'sxf-exit': ui.closeSceneFx(); break;"""
NEW = """      case 'sxf-exit': ui.closeSceneFx(); break;
      /* v89.6：奇遇 · 见闻录 */
      case 'do-wonder': ui.doWonder(Number(el.dataset.x), Number(el.dataset.y)); break;
      case 'open-journal': ui.openJournal(); break;
      case 'journal-go':
        ui.closeModal();
        if (ui.view !== 'map') ui.setView('map');
        ui.mapCenterOn(Number(el.dataset.x), Number(el.dataset.y));
        ui.toast('已至线索所指（' + el.dataset.x + ',' + el.dataset.y + '）—— 点该格探奇');
        break;"""
assert d.count(OLD) == 1, ('main 锚点', d.count(OLD))
d = d.replace(OLD, NEW, 1)
io.open(P, 'w', encoding='utf-8', newline='').write(d)
print('OK main.js: 探奇/见闻录/前往 接线 已写入')

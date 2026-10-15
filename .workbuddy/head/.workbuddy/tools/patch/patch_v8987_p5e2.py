# -*- coding: utf-8 -*-
"""v89.87 需求2 收尾：出征面板过滤调派类（panel:false）+ e2e 采集段适配"""
import io

# ---------- ① data.js：三个调派 mode 加 panel:false ----------
P1 = r'E:\Deepseekdb\js\data.js'
s1 = io.open(P1, encoding='utf-8', newline='').read()
old1 = """      { id: 'transfer', name: '调兵', icon: '🚚', stamina: 0, energy: 0, battle: false, occupy: false,
        desc: '兵力调往本境他城：走行军通道，抵城入编（主将随军入驻新城）。' },
      { id: 'station', name: '驻守', icon: '🛡️', stamina: 0, energy: 0, battle: true, station: true,
        desc: '向已属我方的野地增派驻军：走行军通道，抵达即驻（守地不衰减，直至召回）。' },
      { id: 'gather', name: '采集', icon: '⛏️', stamina: 6, energy: 0, battle: false, occupy: false,
        desc: '开赴己方野地开采：走行军通道，抵达后开始采集（满 1 小时方有收成）。' },"""
new1 = """      { id: 'transfer', name: '调兵', icon: '🚚', stamina: 0, energy: 0, battle: false, occupy: false,
        panel: false,   /* v89.87：调派类**不列出征方式下拉**（各有自己的入口） */
        desc: '兵力调往本境他城：走行军通道，抵城入编（主将随军入驻新城）。' },
      { id: 'station', name: '驻守', icon: '🛡️', stamina: 0, energy: 0, battle: true, station: true,
        panel: false,
        desc: '向已属我方的野地增派驻军：走行军通道，抵达即驻（守地不衰减，直至召回）。' },
      { id: 'gather', name: '采集', icon: '⛏️', stamina: 6, energy: 0, battle: false, occupy: false,
        panel: false,
        desc: '开赴己方野地开采：走行军通道，抵达后开始采集（满 1 小时方有收成）。' },"""
assert s1.count(old1) == 1, ('modes-panel', s1.count(old1))
io.open(P1, 'w', encoding='utf-8', newline='').write(s1.replace(old1, new1, 1))
print('OK data.js panel:false')

# ---------- ② ui.js：出征方式下拉过滤 ----------
P2 = r'E:\Deepseekdb\js\ui.js'
s2 = io.open(P2, encoding='utf-8', newline='').read()
old2 = """    var modes = (DATA.EXPEDITION && DATA.EXPEDITION.modes) || [];
    /* v89.58（老板「出征界面采用下拉框，三张卡片占位置太大」）：
       出征方式由三张大卡片 → 紧凑下拉框（与目标/站位/计略同款 .exp-sel 行）。 */"""
new2 = """    /* v89.87（需求 2）：调派类（调兵/驻守/采集）**不列出征面板** ——
       三者各有自己的入口（城池间操作 / 派驻面板 / 采集面板），
       混进"出征方式"只会让每次出征都要先跳过三个无关项。 */
    var modes = ((DATA.EXPEDITION && DATA.EXPEDITION.modes) || []).filter(function (m) {
      return m.panel !== false;
    });
    /* v89.58（老板「出征界面采用下拉框，三张卡片占位置太大」）：
       出征方式由三张大卡片 → 紧凑下拉框（与目标/站位/计略同款 .exp-sel 行）。 */"""
assert s2.count(old2) == 1, ('ui-modes', s2.count(old2))
io.open(P2, 'w', encoding='utf-8', newline='').write(s2.replace(old2, new2, 1))
print('OK ui.js 过滤')

# ---------- ③ e2e：采集段适配（行军推进 + 将领就绪） ----------
P3 = r'E:\Deepseekdb\e2e-test.js'
s3 = io.open(P3, encoding='utf-8', newline='').read()
old3 = """      const before20 = city20.army.yibing;
      const sb20 = document.querySelector('#modal-root [data-action="gather-start"]');
      check('采集弹窗有开始按钮', !!sb20);
      if (sb20) {
        click(sb20);
        await sleep(140);
        const rec = G.gatherAt(g20.x, g20.y);
        check('采集队已派出', !!rec, rec ? ('兵力 ' + rec.troops) : '无');"""
new3 = """      const before20 = city20.army.yibing;
      const sb20 = document.querySelector('#modal-root [data-action="gather-start"]');
      check('采集弹窗有开始按钮', !!sb20);
      if (sb20) {
        /* v89.87（需求 2）：采集走行军 —— 将领须空闲、派兵后需推进到抵达才有采集记录 */
        const gsel20 = document.querySelector('#gather-gen') || document.querySelector('#modal-root #gather-gen');
        if (gsel20 && gsel20.value) {
          const gg20 = s.generals.find((x) => x.id === gsel20.value);
          if (gg20) { gg20.status = 'idle'; gg20.cityId = city20.id; }
        }
        click(sb20);
        await sleep(140);
        const gmr20 = (s.marches || []).find((m) => m.modeId === 'gather');
        if (gmr20) { gmr20.elapsed = gmr20.totalTime; G.march.tick(); }
        const rec = G.gatherAt(g20.x, g20.y);
        check('采集队已派出（行军抵达后成队）', !!rec, rec ? ('兵力 ' + rec.troops) : '无');"""
assert s3.count(old3) == 1, ('e2e-gather', s3.count(old3))
io.open(P3, 'w', encoding='utf-8', newline='').write(s3.replace(old3, new3, 1))
print('OK e2e 采集段')

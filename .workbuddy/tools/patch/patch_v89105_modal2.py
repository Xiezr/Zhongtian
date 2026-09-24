# -*- coding: utf-8 -*-
"""
v89.105 弹窗整备 · 收尾三处（市场 / 自动出征配置 / 门派）
============================================================
复量后只剩三处：市场 9px、自动出征 40px、门派 235px。
两个手段，都不牺牲信息：

  ① **xxl 档微调**：980×800 → 1020×830（画布 1440×900，仍留 30px 天地方寸）。
     xxl 是"大面板"这一档，客栈/市场/日志/出征/君主都在这档上，实测都差 9~40px
     —— 差在档位不差在内容。
  ② **说明折进 ui.help**：三处"整行的解释文字"（比价细则 / 派将规则 / 目标搜索规则）
     改成标题旁的 ? 芯片，文字一字不少，但不再各占 17~55px 版面。
     这是"内容紧凑有序"的正确做法：**信息不删，只是收进层级**。
"""
import io, os

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
H = os.path.join(R, 'index.html')
U = os.path.join(R, 'js', 'ui.js')
h = io.open(H, encoding='utf-8').read()
u = io.open(U, encoding='utf-8').read()
log = []

# ── ① xxl 档：980×800 → 1020×830
old = """  .modal-xxl { width: 980px; height: 800px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
new = """  .modal-xxl { width: 1020px; height: 830px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }
  /* v89.105（基调统一 · 弹窗整备）：xxl 由 980×800 调到 1020×830。
     依据是**实测**：坐在这一档的面板（客栈/市场/见闻日志/出征/自动出征/君主）
     内容高 690~830px，800 高时正文区只有 780 —— 差 9~40px 就装不下，
     于是有的冒滚动条、有的被挤掉一行。画布 1440×900，830 仍留 30px 天地。
     ⚠️ 再改这一档要**重新量**（node .workbuddy/tools/audit/audit_v89105_modals.js）。 */
  .modal-xxl { width: 1020px; height: 830px;
    max-width: calc(100vw - 20px); max-height: calc(100vh - 20px); }"""
assert old in h
h = h.replace(new, old, 1) if False else h.replace(old, new, 1)
log.append('  ✓ H-① xxl 档 980×800 → 1020×830（实测驱动）')

# ── ② 市场：比价细则两行 → 标题旁 ?
old = """      '<div class="ms-note">比价 <b>粮 1 : 木 2 : 石 3 : 铁 4</b>（粮最便宜）' +
        '　·　卖出折损后系数 <b>×' + rate.toFixed(2) + '</b>（市场等级越高折损越小）' +
        '　·　买入再扣 <b>' + loss + '%</b>（金 → 物资吃亏，' +
        '<b>城池间运输更划算</b>，市场只作应急）' +
        (lv > 0 ? '' : '　·　<b>未建市场</b>：折损最大，建市场可提高折损系数') + '</div>' +"""
new = """      /* v89.105：比价细则原为两行（38px）—— 市集是"两段表格"的大面板，
         多这两行就到不了头。压成一行摘要，细则挂标题旁的 ?（信息一字不删）。 */
      '<div class="ms-note">比价 <b>粮 1 : 木 2 : 石 3 : 铁 4</b>（粮最便宜）' +
        ui.help('卖出折损后系数 ×' + rate.toFixed(2) + '（市场等级越高折损越小）\\n'
          + '买入再扣 ' + loss + '%（金 → 物资吃亏，城池间运输更划算，市场只作应急）'
          + (lv > 0 ? '' : '\\n未建市场：折损最大，建市场可提高折损系数')) + '</div>' +"""
assert old in u
u = u.replace(old, new, 1)
log.append('  ✓ U-② 市场：比价细则折进 ui.help（省 19px）')

# ── ③ 自动出征配置：两条规则说明 → 分区标题旁 ?
old = """          '<div class="exp-sec"><div class="exp-sec-t">执行将领</div>' + sel('am-gen', '将领', genOpts) +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">只派空闲将领；' +
            '出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）</div></div>' +"""
new = """          /* v89.105：这条规则原占一整行（17px）—— 挂到分区标题的 ? 上 */
          '<div class="exp-sec"><div class="exp-sec-t">执行将领' +
            ui.help('只派空闲将领；出征中／守将／采集中一律跳过（现空闲 ' + idle.length + ' 位）') +
            '</div>' + sel('am-gen', '将领', genOpts) + '</div>' +"""
assert old in u
u = u.replace(old, new, 1)
old = """          '<div class="exp-sec"><div class="exp-sec-t">目标</div>' +
            sel('am-target', '类型', tgtOpts) + sel('am-level', '等级', lvOpts) + sel('am-radius', '距离', radOpts) +
            '<div class="exp-info exp-info-l" style="color:var(--text-dim);margin-bottom:0;">以「' +
            (city ? U.escape(GAME.cityLabel(city)) : '—') + '」为起点，' + rad +
            ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）</div></div>' +"""
new = """          '<div class="exp-sec"><div class="exp-sec-t">目标' +
            ui.help('以「' + (city ? GAME.cityLabel(city) : '—') + '」为起点，' + rad +
              ' 格内取最近目标（' + (cfg.target === 'city' ? '名城不在坐标里找，取最近一座' : '切比雪夫距离') + '）') +
            '</div>' + sel('am-target', '类型', tgtOpts) + sel('am-level', '等级', lvOpts) + sel('am-radius', '距离', radOpts) + '</div>' +"""
assert old in u
u = u.replace(old, new, 1)
log.append('  ✓ U-③ 自动出征配置：两条规则说明折进 ui.help（省 34px）')

# ── ④ 门派：声望说明（55px）→ 标题旁 ?；尺寸 → xxl
old = """    var html = '<div class="gold-heading">⚔️ 门派驻地' + (lv ? ' · Lv' + lv : '') + '</div>';
    html += '<div class="q-empty" style="margin-bottom:8px;">门派声望与君主声望<b>各记各的</b>：前者定你在门中的品阶，不参与爵位。</div>';"""
new = """    /* v89.105：这条说明原占 55px（整段 q-empty）—— 门派面板本就"六派 + 开山"两节，
       多这 55px 就装不下。收进标题旁的 ?；面板同时升到 xxl（两列后 790px）。 */
    var html = '<div class="gold-heading">⚔️ 门派驻地' + (lv ? ' · Lv' + lv : '') +
      ui.help('门派声望与君主声望各记各的：前者定你在门中的品阶，不参与爵位。') + '</div>';"""
assert old in u
u = u.replace(old, new, 1)
old = """    ui.openModal(html);
  };"""
# 只改门派那一处 —— 先定位 openSect 的收尾
i = u.index('ui.openSect = function')
j = u.index('ui.openModal(html);', i)
u = u[:j] + "ui.openModal(html, { size: 'xxl' });   /* v89.105：六派两列后实测 790px */" + u[j + len('ui.openModal(html);'):]
log.append('  ✓ U-④ 门派：说明折进 ui.help（省 55px）+ 升到 xxl')

io.open(H, 'w', encoding='utf-8', newline='').write(h)
io.open(U, 'w', encoding='utf-8', newline='').write(u)
print('===== v89.105 收尾三处 =====')
print('\n'.join(log))
print('  index.html 花括号 %d/%d' % (h.count('{'), h.count('}')))

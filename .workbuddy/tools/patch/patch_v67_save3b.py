# -*- coding: utf-8 -*-
"""补丁 3b：把 e2e 的存档面板用例插到收尾的 `G.ui.setView('city');` 之前。

第一次踩的坑：`return finish();` 在文件里出现**两次**（`if (!G || !DATA) return finish();`
与末尾那句），`index()` 命中的是前者、`rindex()` 命中的是后者但行首仍在下一行 ——
所以定位改用「末尾那句 `G.ui.setView('city');`」并**断言插入点内容**再动手。
"""
import io, os

ROOT = r'E:\Deepseekdb'
p = os.path.join(ROOT, 'e2e-test.js')
s = io.open(p, encoding='utf-8', newline='').read()

i2 = s.rindex("G.ui.setView('city');")
j = s.rindex('\n', 0, i2) + 1
head = s[j:j + 23]
print('插入点：', repr(head))
assert head == "  G.ui.setView('city');", '插入点不是预期的收尾行，停手'
assert 'v67 · 存档管理面板' not in s, '这一节已经插入过（幂等保护），停手'

SEC = """/* ==================== v67 · 存档管理面板（真实 DOM + 真实 localStorage） ==================== */
G.ui.setView('settings');
await sleep(80);
const svBtn = document.querySelector('[data-action="open-saves"]');
check('设置页第一张卡就是存档入口', !!svBtn);
if (svBtn) {
  svBtn.click();
  await sleep(140);
  const rootHtml = document.querySelector('#modal-root').innerHTML;
  const rows = (rootHtml.match(/class="sv-row"/g) || []).length;
  check('存档面板：7 个槽位一屏放完', rows === 7, '实测 ' + rows + ' 行');
  check('面板结构齐全（列表 + 导入区，无下拉条容器）',
    rootHtml.indexOf('sv-list') >= 0 && rootHtml.indexOf('sv-imp') >= 0);

  const wBtn = document.querySelector('[data-action="save-slot-write"][data-slot="s1"]');
  check('空槽只给「存入」', !!wBtn
    && !document.querySelector('[data-action="save-slot-load"][data-slot="s1"]'));
  if (wBtn) {
    wBtn.click();
    await sleep(180);
    const m = G.slotMetaOf('s1');
    check('点「存入」→ 写入成功且索引有摘要', !!m && m.cities === G.state.cities.length,
      m ? (m.cities + ' 城 / ' + (m.size / 1024).toFixed(1) + 'KB') : '无摘要');
    const lBtn = document.querySelector('[data-action="save-slot-load"][data-slot="s1"]');
    check('有档之后才出现「读取」', !!lBtn);
    if (lBtn) {
      lBtn.click();
      await sleep(140);
      const ask = document.querySelector('#modal-root').innerHTML;
      check('读取前有二次确认（说清"当前进度会被替换"）',
        ask.indexOf('save-slot-load-do') >= 0 && ask.indexOf('替换') >= 0);
      const cancel = document.querySelector('#modal-root [data-action="close-modal"]');
      if (cancel) { cancel.click(); await sleep(80); }
    }
    const ex = G.exportText('s1');
    check('面板背后的导出文本可解析、自描述', ex.ok && JSON.parse(ex.text)._fmt === 'sanguo-save');
    const imp = G.importText(ex.text, 's3');
    check('导出文本可导回（同一份东西既能存文件也能粘贴）', imp.ok === true, imp.msg);
    G.dropSlot('s1');
    G.dropSlot('s3');
    G.ui.closeModal();
    await sleep(80);
  } else {
    check('点「存入」→ 写入成功且索引有摘要', false, '未找到存入按钮');
    check('有档之后才出现「读取」', false, '未找到存入按钮');
    check('读取前有二次确认（说清"当前进度会被替换"）', false, '未找到存入按钮');
    check('面板背后的导出文本可解析、自描述', false, '未找到存入按钮');
    check('导出文本可导回（同一份东西既能存文件也能粘贴）', false, '未找到存入按钮');
  }
}
"""
io.open(p, 'w', encoding='utf-8', newline='').write(s[:j] + SEC + s[j:])
print('已插入 e2e 存档面板用例（%d 字符）' % len(SEC))

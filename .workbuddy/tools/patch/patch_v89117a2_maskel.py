# -*- coding: utf-8 -*-
"""v89.117 补丁 A2 —— 弹窗栈的**能力判据**修正（smoke DOM 桩适配）

补丁 A 首跑 smoke 26 条翻红：smoke 的 DOM 桩把 `querySelector` 实现成
"永远返回一个假元素"，于是 `root.querySelector('.modal-mask')` 恒为真
→ 代码以为"已经有弹窗"，永远走替换分支，从不建 mask（`#modal-root` 的
innerHTML 一直是空的）。这是项目里反复出现的"桩 DOM ≠ 真 DOM"坑。

正解：**能力判据** —— 我们**手持**建出来的那个 mask（`ui._maskEl`），
第二次开窗时只看它 `isConnected === true`（真 DOM 才有这个属性；
假元素没有 → 自动走重建路径，桩下行为与旧版一致）。
"""
import io, os, sys

R = 'E:/Deepseekdb/'
files = {}


def load(p):
    files[p] = io.open(R + p, encoding='utf-8').read()
    return files[p]


def edit(p, old, new, tag):
    s = files[p]
    n = s.count(old)
    if n != 1:
        print('!! %s 锚点匹配 %d 次' % (tag, n))
        sys.exit(1)
    files[p] = s.replace(old, new, 1)
    print('  ✓ %s' % tag)


u = load('js/ui.js')

edit('js/ui.js', """  ui._modalStack = [];
  ui._modalTitle = null;""",
     """  ui._modalStack = [];
  ui._modalTitle = null;
  /* ⚠️ 能力判据：`mask` 只认**我们亲手建的那一个**（`ui._maskEl`），
     且必须 `isConnected === true` 才算"现场可用"。
     原因：smoke 的 DOM 桩把 querySelector 实现成"永远返回一个假元素"——
     靠 `root.querySelector('.modal-mask')` 判"有没有开窗"会永远判真
     （首版就这么写的，26 条断言当场翻红）。假元素没有 isConnected → 走重建路径。 */
  ui._maskEl = null;""",
     '能力判据字段')

edit('js/ui.js', """    var shelled = /class="m-head"/.test(body);
    var title = ui.modalTitleOf(body);
    var mask = root.querySelector('.modal-mask');
    if (!mask) {
      /* 从无到有：建 mask，播一次入场动画（此后同级重绘不再重建 → 不闪） */
      ui._modalStack = [];
      root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
        '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn + '</div></div>';
      ui._modalTitle = title;
    } else {
      var box = mask.querySelector('.modal');""",
     """    var shelled = /class="m-head"/.test(body);
    var title = ui.modalTitleOf(body);
    var mask = (ui._maskEl && ui._maskEl.isConnected) ? ui._maskEl : null;
    if (!mask) {
      /* 从无到有：建 mask，播一次入场动画（此后同级重绘不再重建 → 不闪） */
      ui._modalStack = [];
      root.innerHTML = '<div class="modal-mask"><div class="modal wood-frame' + sizeCls + '">' +
        '<div class="inner-panel' + (shelled ? ' inner-shell' : '') + '">' + body + '</div>' + xBtn + '</div></div>';
      ui._modalTitle = title;
      ui._maskEl = (root.querySelector && root.querySelector('.modal-mask')) || null;
    } else {
      var box = mask.querySelector('.modal');""",
     'openModal 能力判据')

edit('js/ui.js', """    var _root = $('#modal-root');
    var _st = ui._modalStack || [];
    if (_st.length) {
      var lv = _st.pop();
      var _mask = _root.querySelector('.modal-mask');
      if (_mask) {""",
     """    var _root = $('#modal-root');
    var _st = ui._modalStack || [];
    if (_st.length) {
      var lv = _st.pop();
      var _mask = (ui._maskEl && ui._maskEl.isConnected) ? ui._maskEl : null;
      if (_mask) {""",
     'closeModal 能力判据')

edit('js/ui.js', """    ui._sd = null;
    _root.innerHTML = '';
    ui._visible = false;
    ui._modalStack = [];
    ui._modalTitle = null;""",
     """    ui._sd = null;
    _root.innerHTML = '';
    ui._visible = false;
    ui._modalStack = [];
    ui._modalTitle = null;
    ui._maskEl = null;""",
     'closeModal 清手持 mask')

# _paintModalX 加防御（桩可能没有 addEventListener，但 setAttribute 有）
edit('js/ui.js', """  ui._paintModalX = function () {
    var x = document.querySelector('#modal-root .modal-x');
    if (!x) return;
    var st = ui._modalStack || [];
    var top = st.length ? st[st.length - 1] : null;
    x.setAttribute('title', top ? ('返回《' + (top.title || '上一级') + '》') : '关闭');
  };""",
     """  ui._paintModalX = function () {
    var x = document.querySelector('#modal-root .modal-x');
    if (!x || !x.setAttribute) return;
    var st = ui._modalStack || [];
    var top = st.length ? st[st.length - 1] : null;
    x.setAttribute('title', top ? ('返回《' + (top.title || '上一级') + '》') : '关闭');
    if (x.classList && x.classList.toggle) x.classList.toggle('has-up', !!top);
  };""",
     'paintModalX 防御')

for p, s in files.items():
    tmp = R + p + '.tmp117a2'
    io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
    os.replace(tmp, R + p)
    print('  → 落盘 %s' % p)
print('补丁 A2 完成')

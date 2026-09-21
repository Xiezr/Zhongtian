# -*- coding: utf-8 -*-
"""v89.86 · smoke 环境：makeEl 补 querySelector/querySelectorAll（故事阅读器 sgRender 要读子元素）"""
import io
import os

SM = r'E:\Deepseekdb\smoke-test.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8986'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(old, new, tag):
    src = read(SM)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        raise SystemExit(1)
    write(SM, src.replace(old, new, 1))
    assert new in read(SM), '落盘回查失败：' + tag
    print('OK  ' + tag)


edit("""      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },""",
     """      addEventListener: function () {}, appendChild: function () {}, setAttribute: function (k, v) { this._attrs[k] = v; },
      getAttribute: function (k) { return this._attrs[k] || null; },
      /* v89.86：故事阅读器（ui.sgRender）等界面函数会读子元素 —— stub 补子查询，
         .sgr-bg 固定两张（壁画双层），与真实骨架一致。 */
      querySelector: function (sel) { this._q = this._q || {}; if (!this._q[sel]) this._q[sel] = makeEl('DIV'); return this._q[sel]; },
      querySelectorAll: function (sel) { return sel === '.sgr-bg' ? [makeEl('DIV'), makeEl('DIV')] : []; },""",
     'makeEl 子查询')

print('DONE')

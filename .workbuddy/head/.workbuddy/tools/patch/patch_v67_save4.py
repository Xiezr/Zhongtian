# -*- coding: utf-8 -*-
"""补丁 4：把 smoke 那条"面板 7 行"从"查 CSS 存在"改成"查渲染源"。

破坏测试第 ⑦ 类（把面板渲染 `list.map(...)` 改成 `list.slice(0,6).map(...)`）在 smoke 里
**零反应** —— 因为原断言只 `/\.sv-row\b/.test(hSrc)`，看的是样式类在不在，
根本没看**渲染了几行**。名字骗人、断言装饰，这正是一直要防的那种情况。
（e2e 那条是真的数了 7 行，所以线上还有一层网；但 smoke 这层不该虚设。）
"""
import io, os

ROOT = r'E:\Deepseekdb'
p = os.path.join(ROOT, 'smoke-test.js')
s = io.open(p, encoding='utf-8', newline='').read()

# ① 补 uiSrc（section 里只声明了 stSrc / mainSrc / hSrc）
old_decl = """    var mainSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'main.js'), 'utf8'));
    var hSrc = fsSv.readFileSync(pathSv.join(__dirname, 'index.html'), 'utf8');"""
new_decl = """    var mainSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'main.js'), 'utf8'));
    var uiSrc = stripComment(fsSv.readFileSync(pathSv.join(__dirname, 'js', 'ui.js'), 'utf8'));
    var hSrc = fsSv.readFileSync(pathSv.join(__dirname, 'index.html'), 'utf8');"""
assert s.count(old_decl) == 1, s.count(old_decl)
s = s.replace(old_decl, new_decl, 1)

# ② 把虚的那条换成"渲染源"断言
old_chk = """    check('面板 7 行槽位且**样式不带给自身滚动条**（老板的硬规矩）',
      /\\.sv-row\\b/.test(hSrc) && !/sv-list[^}]*overflow/.test(hSrc));"""
new_chk = """    check('面板逐行渲染**全部**槽位（行数来自槽位表，不许写死/偷工减料）', (function () {
      var fn = codeOf(uiSrc, 'ui.openSaveManager = function');
      if (fn.length < 400) return false;
      /* 判据：渲染源是 slotList 全量 + 没有"取前 N 个"的写法。
         ⚠️ 上一版这里只查 `.sv-row` 样式类在不在 —— 破坏测试注入
         `list.slice(0,6)` 时**零反应**，等于没测。 */
      return /list\\.map\\(ui\\.svRowHTML\\)/.test(fn)
        && fn.indexOf('.slice(') < 0
        && fn.indexOf('sv-list') >= 0
        && fn.indexOf('sv-imp') >= 0;
    })());
    check('面板样式不给自己加滚动条（弹窗内禁止下拉条）',
      /\\.sv-row\\b/.test(hSrc) && !/sv-list[^}]*overflow/.test(hSrc));"""
assert s.count(old_chk) == 1, s.count(old_chk)
s = s.replace(old_chk, new_chk, 1)

io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('✓ smoke 断言已补强：从"查 CSS"改成"查渲染源（不许 slice）"')

# ③ 破坏测试脚本：⑤ 的锚点唯一化
b = os.path.join(ROOT, '.workbuddy', 'tools', 'break_v67_save.py')
t = io.open(b, encoding='utf-8', newline='').read()
o = """    ('⑤ saveGame 又自己 stringify（序列化两个出口）', 'js/state.js',
     "      var json = GAME.savePayload();",
     "      var json = JSON.stringify(GAME.state);"),"""
n = """    ('⑤ saveGame 又自己 stringify（序列化两个出口）', 'js/state.js',
     "      var json = GAME.savePayload();\\n      localStorage.setItem(SAVE_KEY, json);",
     "      var json = JSON.stringify(GAME.state);\\n      localStorage.setItem(SAVE_KEY, json);"),"""
assert t.count(o) == 1, '⑤ 锚点未命中'
t = t.replace(o, n, 1)
o2 = """    ('⑦ 面板槽位少一行（7 → 6）', 'js/ui.js',"""
n2 = """    ('⑦ 面板只渲染前 6 个槽位（偷工减料）', 'js/ui.js',"""
assert t.count(o2) == 1
t = t.replace(o2, n2, 1)
io.open(b, 'w', encoding='utf-8', newline='').write(t)
print('✓ 破坏测试：⑤ 锚点唯一化 · ⑦ 描述更新')

# -*- coding: utf-8 -*-
# v89.150（老板 2）：smoke 旧口径断言升级 —— vw/vh → 画布单位、fixed → absolute、pick 换算
import io

P = 'E:/Deepseekdb/smoke-test.js'
s = io.open(P, encoding='utf-8', newline='').read()


def patch(segs):
    global s
    for old, new, tag, _m in segs:
        # ✅ 幂等特征 = **new 独有**的那一撮行里最长的一条
        #    （不能只看"new 的最长行"：不同段常共享同一行，会互相撞车 → 假报重复插入）
        _cands = [l.strip() for l in new.split('\n') if l.strip()]
        _only = [c for c in _cands if c not in old]
        mark = max(_only or _cands, key=len)
        if s.count(mark) >= 1 and old not in s:
            print('SKIP(已落) ' + tag); continue
        if s.count(mark) >= 1:
            raise AssertionError('重复插入风险 [' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF 污染 [' + tag + ']'
        assert s.count(mark) == 1, '新特征落盘数 != 1 [' + tag + ']'
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag + '  (len=' + str(len(s)) + ')')


patch([
# ---------- ① map.pick：多加一层缩放换算 ----------
("""    return /canvas\\.clientWidth \\|\\| rect\\.width/.test(mapSrc22)
      && /var bl = Math\\.max\\(0, \\(rect\\.width - cw\\) \\/ 2\\)/.test(mapSrc22)
      && /clientX - rect\\.left - bl/.test(mapSrc22);""",
 """    /* v89.150（老板 2）：整体缩放后再加一层 —— 边框厚度改读 offsetWidth−clientWidth
       （布局值）、相对偏移先除以缩放比 k 再扣边框。三条判据锁住新形态。 */
    return /canvas\\.clientWidth \\|\\| rect\\.width \\/ _k150/.test(mapSrc22)
      && /var bl = Math\\.max\\(0, \\(\\(canvas\\.offsetWidth \\|\\| cw\\) - cw\\) \\/ 2\\)/.test(mapSrc22)
      && /\\(clientX - rect\\.left\\) \\/ _k150 - bl/.test(mapSrc22);""",
 '① pick 换算断言', '/ _k150 - bl/'),

# ---------- ② #11 尺寸档位 ----------
("""  check('#11 尺寸档位固定（sm/lg/xl 三档，固定 px + 极小窗口兜底）',
    /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS16)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\); \\}/.test(hS16)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\); \\}/.test(hS16));""",
 """  check('#11 尺寸档位固定（sm/lg/xl 三档，固定 px + **画布**兜底 · v89.150）',
    /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS16)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\); max-height: calc\\(var\\(--app-h\\) - 20px\\); \\}/.test(hS16)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\); max-height: calc\\(var\\(--app-h\\) - 20px\\); \\}/.test(hS16));""",
 '② #11 尺寸档', 'calc\\(var\\(--app-w\\) - 20px\\); max-height: calc\\(var\\(--app-h\\) - 20px\\); \\}/\\.test(hS16)'),

# ---------- ③ v74 弹窗固定 px（hS30） ----------
("""    var css = hS30.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /\\.modal \\{[\\s\\S]{0,220}max-width: calc\\(100vw - 20px\\); max-height: calc\\(100vh - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css)
      && !/max-width: 96vw/.test(css);""",
 """    var css = hS30.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    /* v89.150（老板 2）：兜底口径由"视口"改"画布" —— 整幅画面统一缩放后，
       视口对界面不再存在；弹窗任何情况下都不会超出 1440×900 的画布。 */
    return /\\.modal \\{[\\s\\S]{0,220}max-width: calc\\(var\\(--app-w\\) - 20px\\); max-height: calc\\(var\\(--app-h\\) - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css)
      && !/max-width: 96vw/.test(css);""",
 '③ v74 hS30', 'max-width: calc\\(var\\(--app-w\\) - 20px\\); max-height: calc\\(var\\(--app-h\\) - 20px\\)/.test(css)\n      && !/@media \\(max-height: 860px\\)'),

# ---------- ④ 四档固定尺寸齐备（hS31） ----------
("""    /\\.modal \\{[\\s\\S]{0,200}width: 660px; height: 620px/.test(hS31)
    && /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS31)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS31)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS31));""",
 """    /\\.modal \\{[\\s\\S]{0,200}width: 660px; height: 620px/.test(hS31)
    && /\\.modal-sm \\{ width: \\d+px; height: \\d+px; \\}/.test(hS31)
    && /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(hS31)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(hS31));""",
 '④ 四档齐备', 'max-width: calc\\(var\\(--app-w\\) - 20px\\)/\\.test(hS31)'),

# ---------- ⑤ v74 固定 px + 兜底（hS31） ----------
("""    var css = hS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /max-width: calc\\(100vw - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css) && !/max-width: 96vw/.test(css);""",
 """    var css = hS31.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
    return /max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(css)
      && !/@media \\(max-height: 860px\\)/.test(css) && !/max-width: 96vw/.test(css);""",
 '⑤ hS31 兜底', 'return /max-width: calc\\(var\\(--app-w\\) - 20px\\)/\\.test(css)'),

# ---------- ⑥ v74 弹窗宽度固定 px（hS38） ----------
("""    /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS38)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(hS38));""",
 """    /\\.modal-lg \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(hS38)
    && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(hS38));""",
 '⑥ hS38', 'max-width: calc\\(var\\(--app-w\\) - 20px\\)/\\.test(hS38)'),

# ---------- ⑦ 悬停浮层（fixed → absolute + 容器内） ----------
("""  check('悬停浮层为全站唯一层（position:fixed + 最高层级）',
    /\\.tip-layer \\{[\\s\\S]{0,200}position: fixed/.test(hS38)
    && /\\.tip-layer \\{[\\s\\S]{0,200}z-index: 9000/.test(hS38));""",
 """  check('悬停浮层为全站唯一层（v89.150：absolute + 画布坐标系 + 最高层级）',
    /\\.tip-layer \\{[\\s\\S]{0,600}position: absolute/.test(hS38)
    && /\\.tip-layer \\{[\\s\\S]{0,200}z-index: 9000/.test(hS38));""",
 '⑦ tip-layer', 'v89.150：absolute + 画布坐标系 + 最高层级'),

# ---------- ⑧ openForge 的 xl 兜底 ----------
("""      && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(100vw - 20px\\)/.test(h)
      && /height: 700px/.test(h)""",
 """      && /\\.modal-xl \\{ width: \\d+px; height: \\d+px;[\\s\\S]{0,120}max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(h)
      && /height: 700px/.test(h)""",
 '⑧ openForge xl', 'max-width: calc\\(var\\(--app-w\\) - 20px\\)/\\.test(h)\n      && /height: 700px/'),

# ---------- ⑨ ② 弹窗尺寸固定 px（hSc） ----------
("""  check('② 弹窗尺寸固定 px（不再 vw/vh 缩放）；仅留极小窗口兜底',
    !/max-width: 9\\dvw/.test(hSc) && !/max-height: 8\\dvh/.test(hSc)
      && (hSc.match(/calc\\(100vw - 20px\\)/g) || []).length >= 2);""",
 """  check('② 弹窗尺寸固定 px（不再 vw/vh 缩放）；兜底改**画布单位**（v89.150）',
    !/max-width: 9\\dvw/.test(hSc) && !/max-height: 8\\dvh/.test(hSc)
      && (hSc.match(/calc\\(var\\(--app-w\\) - 20px\\)/g) || []).length >= 2);""",
 '⑨ hSc 兜底', 'calc\\(var\\(--app-w\\) - 20px\\)/g) || \\[\\]\\)\\.length >= 2'),

# ---------- ⑩ xxl 档（hS1） ----------
("""    var b = cssBlock(hS1, '.modal-xxl {');
    return /width: 1200px; height: 850px/.test(b) && /max-width: calc\\(100vw - 20px\\)/.test(b);""",
 """    var b = cssBlock(hS1, '.modal-xxl {');
    return /width: 1200px; height: 850px/.test(b) && /max-width: calc\\(var\\(--app-w\\) - 20px\\)/.test(b);""",
 '⑩ xxl 档', 'width: 1200px; height: 850px/.test(b) && /max-width: calc\\(var\\(--app-w\\) - 20px\\)'),

# ---------- ⑪ modal-tall（hS99） ----------
("""      return /\\.modal\\.modal-xxl\\.modal-tall \\{ height: min\\(920px, calc\\(100vh - 40px\\)\\); \\}/.test(h)""",
 """      return /\\.modal\\.modal-xxl\\.modal-tall \\{ height: min\\(920px, calc\\(var\\(--app-h\\) - 40px\\)\\); \\}/.test(h)""",
 '⑪ modal-tall', 'calc\\(var\\(--app-h\\) - 40px\\)\\); \\}/\\.test(h)'),
])

print('ALL OK · len=' + str(len(s)))

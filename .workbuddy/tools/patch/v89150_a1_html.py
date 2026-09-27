# -*- coding: utf-8 -*-
# v89.150（老板 2）：整体等比例缩放 —— index.html（容器 + CSS 全量改固定像素）
# ⚠️ 幂等判据 = 每段自带**新特征串**（mark）——不能靠 `old not in s`：
#    "old 恰是新内容的子串"时它永远为真（§56.2 的老坑，本补丁第一版就栽在这）。
import io, re

P = 'E:/Deepseekdb/index.html'
s = io.open(P, encoding='utf-8', newline='').read()


def patch(segs):
    """逐段落盘（§57.3）：每段替换后立刻写 —— 中途失败不会吞掉已落的段"""
    global s
    for old, new, tag, mark in segs:
        if s.count(mark) >= 1 and old not in s:      # 幂等：新特征在、旧锚点已消失
            print('SKIP(已落) ' + tag)
            continue
        if s.count(mark) >= 1:                       # 新特征在、旧锚点也在 = 有重复插入风险
            raise AssertionError('重复插入风险（新特征已在且锚点仍在）[' + tag + ']')
        n = s.count(old)
        assert n == 1, '锚点不唯一/缺失 [' + tag + '] count=' + str(n)
        s = s.replace(old, new)
        assert '\r\n' not in s, 'CRLF 污染 [' + tag + ']'
        m = s.count(mark)
        assert m == 1, '新特征落盘数 != 1 [' + tag + '] count=' + str(m)
        io.open(P, 'w', encoding='utf-8', newline='').write(s)
        print('OK ' + tag + '  (len=' + str(len(s)) + ')')


# ============ ① CSS：画布令牌 + 缩放容器 ============
patch([
("""  html { --app-w: 1440px; --app-h: 900px; }""",
 """  html { --app-w: 1440px; --app-h: 900px; --app-k: 1; }""",
 '①-1 --app-k 令牌', '--app-k: 1; }'),

("""  /* v74：游戏画布 = 固定像素（见 --app-w / --app-h 注释）；水平居中、垂直靠上 */
  #screen-game { width: var(--app-w); height: var(--app-h); margin: 0 auto;
    display: flex; flex-direction: column; }""",
 """  /* ============================================================
   * v89.150（老板 2）：「所有弹窗界面，目前如果缩放浏览器显示比例的话，界面就会发生溢出。
   *   能不能整体画面，包括城内，城外，野地，各类大菜单弹窗，建筑弹窗，小功能弹窗。
   *   统一设置为等比例变动，字体字号边框比例固定呈现。让玩家面对的游戏画面如同图片一样整体缩放」
   * ------------------------------------------------------------
   * 改前：画布尺寸**随视口变**（fitAppSize 把 --app-w/h 拉到 innerWidth/Height ——
   *   大屏重排、小屏出滚动条）+ 弹窗固定像素（1200×850），视口一小就被
   *   `max-width: calc(100vw - 20px)` 压小 → 内容溢出、冒下拉条。
   * 改后：画布**永远 1440×900**，整幅画面（画布 + 城内/城外/野地 + 全部弹窗 + 浮层）
   *   装进 `#app-scale` 统一 `transform: scale(var(--app-k))` —— 如同图片缩放：
   *   布局一格不重排、字号/边框/间距**同比**变。
   *   · `--app-k` = min(视口宽 ÷ 1440, 视口高 ÷ 900)，由 main.js 的 fitAppSize 写入
   *     （桩环境无 #app-scale 时保持 1 —— 测试口径不变）；
   *   · `#app-fit` 用**缩放后的视觉尺寸**参与文档流（画布居中、不裁不滚）；
   *   · 弹窗遮罩 / 浮层 / 提示条全部 `absolute` 相对 `#app-scale`（= 画布坐标系），
   *     "视口比画布小"这类溢出**从结构上消失**（不再有 vw/vh 兜底）。
   * ============================================================ */
  #app-fit { width: calc(var(--app-w) * var(--app-k, 1));
    height: calc(var(--app-h) * var(--app-k, 1));
    margin: 0 auto; overflow: hidden; }
  #app-scale { position: relative; width: var(--app-w); height: var(--app-h);
    transform: scale(var(--app-k, 1)); transform-origin: top left; }

  /* v74：游戏画布 = 固定像素（见 --app-w / --app-h 注释）；水平居中、垂直靠上 */
  #screen-game { width: var(--app-w); height: var(--app-h); margin: 0 auto;
    display: flex; flex-direction: column; }""",
 '①-2 缩放容器 CSS', '#app-fit { width: calc(var(--app-w) * var(--app-k, 1));'),

# ============ ② 遮罩 / 尺寸兜底：视口单位 → 画布单位 ============
("""  .modal-mask {
    position: fixed; inset: 0; background: rgba(var(--sh-rgb),.65);""",
 """  .modal-mask {
    /* v89.150（老板 2）：`fixed` → `absolute` —— 遮罩改挂**画布坐标系**（#app-scale 是
       transform 容器，绝对定位相对它）。理由：整幅画面统一缩放后，"视口"这个概念
       对界面不再存在（画布 = 唯一坐标系）；继续用 fixed 会让弹窗在缩放后错位/溢出。 */
    position: absolute; inset: 0; background: rgba(var(--sh-rgb),.65);""",
 '②-1 mask absolute', '遮罩改挂**画布坐标系**'),

("""  .modal.modal-xxl.modal-tall { height: min(920px, calc(100vh - 40px)); }""",
 """  .modal.modal-xxl.modal-tall { height: min(920px, calc(var(--app-h) - 40px)); }""",
 '②-3 modal-tall', '.modal.modal-xxl.modal-tall { height: min(920px, calc(var(--app-h) - 40px)); }'),

("""  .modal-max { width: calc(100vw - 16px); height: calc(100vh - 16px);
    max-width: none; max-height: none; }""",
 """  .modal-max { width: calc(var(--app-w) - 16px); height: calc(var(--app-h) - 16px);
    max-width: none; max-height: none; }""",
 '②-4 modal-max', '.modal-max { width: calc(var(--app-w) - 16px);'),

("""    position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%) translateY(16px);""",
 """    /* v89.150（老板 2）：提示条改挂画布坐标系（absolute 相对 #app-scale）——
       视口再小也不会跑到画布外面；字号随整体缩放同比。 */
    position: absolute; left: 50%; bottom: 30px; transform: translateX(-50%) translateY(16px);""",
 '②-5 toast absolute', '提示条改挂画布坐标系'),

("""  .tip-layer {
    position: fixed; left: 0; top: 0; z-index: 9000;""",
 """  .tip-layer {
    /* v89.150（老板 2）：悬停浮层同挂画布坐标系（坐标由 ui.tipPlace 换算，见 js/ui.js）。
       ⚠️ 它仍在**最外层容器**里（#app-scale 是 transform 容器的根，不存在"被祖先裁切"
       的问题）—— 旧注释说的"父级 transform 会裁切"指的是画布**内部**的容器，
       这里是全站最外层的缩放根，z-index 9000 依然压得住所有弹窗。 */
    position: absolute; left: 0; top: 0; z-index: 9000;""",
 '②-6 tip-layer absolute', '悬停浮层同挂画布坐标系'),

("""  .float-gain {
    position: fixed; z-index: 2100; pointer-events: none; font-size: var(--fs-lead); font-weight: 800;""",
 """  .float-gain {
    /* v89.150（老板 2）：数值浮字同挂画布坐标系（坐标由 ui.floatGain 换算）。 */
    position: absolute; z-index: 2100; pointer-events: none; font-size: var(--fs-lead); font-weight: 800;""",
 '②-7 float-gain absolute', '数值浮字同挂画布坐标系'),

("""  #moment-fx { position: fixed; inset: 0; z-index: 1400; pointer-events: none; display: none; }""",
 """  #moment-fx { position: absolute; inset: 0; z-index: 1400; pointer-events: none; display: none; }""",
 '②-8 moment-fx absolute', '#moment-fx { position: absolute; inset: 0;'),

# ============ ③ 其余 vw/vh（三处） ============
("""    width: min(500px, 68vw); height: auto; aspect-ratio: 1 / 1;""",
 """    width: min(500px, calc(var(--app-w) * .68)); height: auto; aspect-ratio: 1 / 1;""",
 '③-1 68vw', 'width: min(500px, calc(var(--app-w) * .68));'),

("""    width: min(100%, calc(100vh - 190px)); height: auto; aspect-ratio: 1 / 1;""",
 """    width: min(100%, calc(var(--app-h) - 190px)); height: auto; aspect-ratio: 1 / 1;""",
 '③-2 100vh-190', 'width: min(100%, calc(var(--app-h) - 190px));'),

("""    display: flex; flex-direction: column; gap: var(--sp-1); max-width: min(560px, 86vw);""",
 """    display: flex; flex-direction: column; gap: var(--sp-1); max-width: min(560px, calc(var(--app-w) * .86));""",
 '③-3 86vw', 'max-width: min(560px, calc(var(--app-w) * .86));'),

# ============ ④ HTML：容器包裹（三块 + toast + tip 层全进画布坐标系） ============
("""<body>

<!-- 创建角色界面 -->""",
 """<body>

<!-- ============================================================
     v89.150（老板 2）：整幅画面统一缩放的外壳。
       · #app-fit  —— 参与文档流的**缩放后尺寸**（画布居中、不裁不滚）；
       · #app-scale —— 固定 1440×900 的**画布坐标系**（transform: scale(--app-k)）。
     从此"视口"对界面不再存在：城内 / 城外 / 野地 / 大菜单 / 建筑弹窗 / 小功能弹窗 /
     悬停浮层 / 提示条 / 数值浮字 **全部**在这一个坐标系里，同比缩放。
     ============================================================ -->
<div id="app-fit">
<div id="app-scale">

<!-- 创建角色界面 -->""",
 '④-1 容器开标签', '<div id="app-fit">'),

("""<div id="modal-root"></div>

<!-- BUILD""",
 """<div id="modal-root"></div>

</div><!-- /#app-scale -->
</div><!-- /#app-fit -->

<!-- BUILD""",
 '④-2 容器闭标签', '</div><!-- /#app-fit -->'),
])

# ②-2：四处 vh 兜底（幂等）
n_vh = s.count('max-width: calc(100vw - 20px); max-height: calc(100vh - 20px)')
n_new = s.count('max-width: calc(var(--app-w) - 20px); max-height: calc(var(--app-h) - 20px)')
assert n_vh == 4 or (n_vh == 0 and n_new == 4), 'vh 兜底处数 = ' + str(n_vh) + '/' + str(n_new)
if n_vh:
    s = s.replace('max-width: calc(100vw - 20px); max-height: calc(100vh - 20px)',
                  'max-width: calc(var(--app-w) - 20px); max-height: calc(var(--app-h) - 20px)')
    assert '\r\n' not in s
    io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('OK ②-2 弹窗尺寸兜底 ×4 → 画布单位')

# ============ 写后自检（剥注释查 vw/vh） ============
_code = re.sub(r'/\*[\s\S]*?\*/', '', s)
_html = re.sub(r'<!--[\s\S]*?-->', '', _code)
assert 'calc(100vw' not in _html, '仍有裸 100vw（非注释）'
assert 'calc(100vh' not in _html, '仍有裸 100vh（非注释）'
assert s.count('<div id="app-fit">') == 1 and s.count('</div><!-- /#app-fit -->') == 1
assert s.count('id="app-scale"') == 1 and s.count('</div><!-- /#app-scale -->') == 1
assert '#app-fit { width: calc(var(--app-w) * var(--app-k, 1));' in s
assert s.index('<div id="app-fit">') < s.index('class="create-screen"')
assert s.index('</div><!-- /#app-scale -->') > s.index('<div id="modal-root">')
assert '\r\n' not in s
print('ALL OK · len=' + str(len(s)))

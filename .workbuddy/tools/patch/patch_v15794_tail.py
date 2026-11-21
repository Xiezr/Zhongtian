# -*- coding: utf-8 -*-
"""v157.94 收尾：断言 §589l + 版本 v157.91 + 档案补录"""
import io

# ---------- 1) 断言 ----------
p = 'smoke-test.js'
s = io.open(p, encoding='utf-8', newline='').read()
anchor = "      '图集 + aFace + 系数 + 缓存 + 半纹素内缩');"
assert s.count(anchor) == 1, 'anchor'

NEW = """      '图集 + aFace + 系数 + 缓存 + 半纹素内缩');

    /* ⑫ 明暗也逐像素（v157.94 · 老板「为什么之前没有这个问题」）
       实测答案：把起伏明暗关掉，色块边界立刻变柔和 —— 所以锯齿是**逐顶点明暗**把每格切成
       「一格一档」的亮度台阶，不是配色本身的问题。
       改法：烘法线图集（RGB 法线 + A 曲率遮蔽），片元按像素算受光；法线夸张搬进烘焙。
       反向证据：差分必须**边缘单边**（首版用 %N 环绕 → 把地球另一侧当邻居 → 六个面各一条黑线）。*/
    check('§589l 明暗逐像素：法线图集在岗 · uNrmTex 采样 · 曲率进 alpha · 边缘单边差分（无环绕）',
      /M\\.RELIEF_TEX = true/.test(mp)
      && /M\\._nrmTex = ntex;/.test(mp)
      && /texture2D\\(uNrmTex, vAUv\\)/.test(mp)
      && /float _shadeV = 0\\.74 \\+ _nt\\.a \\* 0\\.32;/.test(mp)
      && /var xm = xx > 0 \\? xx - 1 : xx/.test(mp)
      && (mp.match(/\\(xx - 1 \\+ N\\) % N/g) || []).length === 0,
      '法线图集 + 曲率 alpha + 单边差分 + 无 %N 环绕');"""
s = s.replace(anchor, NEW)
assert s.count('§589l') == 1
assert '\r\n' not in s
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('§589l added')

# ---------- 2) 版本 ----------
m = 'js/main.js'
t = io.open(m, encoding='utf-8', newline='').read()
assert t.count("  GAME.VERSION = 'v157.90';") == 1
t = t.replace("  GAME.VERSION = 'v157.90';", "  GAME.VERSION = 'v157.91';")
io.open(m, 'w', encoding='utf-8', newline='').write(t)
print('version v157.91')

# ---------- 3) 档案：总览行 ----------
q = '需求档案.md'
a = io.open(q, encoding='utf-8', newline='').read()
a = a.replace('\r\n', '\n')

ROW = ('| v157.91 | 2026-11-21 | **明暗也改逐像素（治「涂色锯齿」真正成因）**：老板「为什么之前没有这个问题」'
       '→ 实测给出答案：同视角把**起伏明暗关掉**，色块边界立刻变柔和 ⇒ 锯齿不是配色造成的，'
       '是 **v157.89 加的逐顶点明暗**把每格切成「一格一档」的亮度台阶（配色一直是每格一色，'
       '相邻色值接近，读起来像渐变）。改法：烘**法线图集**（与配色同布局，RGB=物体空间法线、'
       'A=曲率遮蔽），片元按像素算 dot(N,sun)；法线夸张（tanθ\'=2·tanθ）搬进烘焙，立体感不退化'
       '（实测开/关像素差 6.5、亮度 91.5 vs 95.3）。踩坑：① 片元里 modelMatrix 未声明 → 显式声明；'
       '② 差分用 %N 环绕 → 面边缘把地球另一侧当邻居 → 六个面各一条细黑线 → 改**边缘单边差分**。'
       '断言 `§589l`。GAME.VERSION v157.90 → v157.91。详见 `docs/_史料/交付/v15791-明暗逐像素.md` |\n')

if '| v157.91 |' not in a:
    key = '\n| v157.90 |'
    i = a.index(key) + 1
    j = a.index('\n', i) + 1
    a = a[:j] + ROW + a[j:]
    print('row ok')

DET = """
## v157.91 · 2026-11-21 · 明暗也改逐像素

### 一、起因

老板问「为什么之前没有这个问题」。不靠推测，做实验：同视角把起伏明暗关掉 → 色块边界立刻变柔和。
⇒ 锯齿的成因是 **v157.89 加的逐顶点明暗**，不是配色本身（配色一直每格一色，相邻色值接近，读起来像渐变）。

### 二、改法

| 项 | 内容 |
|---|---|
| 法线图集 | 与配色同布局（4N×4N，6 格）：RGB = 物体空间法线，A = 曲率遮蔽 |
| 求法线 | 复用配色烘焙时已算出的高度场 h，**差分**求梯度（不重复调 sphElev，烘焙不翻倍） |
| 夸张 | `tanθ' = 2·tanθ` 搬进烘焙（否则逐像素的真实法线比网格法线温和，立体感会退） |
| 采样 | 片元 `dot(N, sun)`；`modelMatrix` 显式声明后转世界 |

### 三、两个坑

1. 片元里 `modelMatrix` **不是内建**（three 只在顶点前缀声明）→ 显式 `uniform mat4 modelMatrix;`。
2. 差分首版用 `(xx-1+N)%N` 环绕 → 面边缘把**地球另一侧**当邻居 → 六个面各一条细黑线。改**边缘单边差分**。

### 四、实测

- 烘焙 1.5~1.6 秒（配色 + 法线一次烘完），按种子+精度缓存。
- 明暗生效：开/关 平均像素差 **6.5**，亮度 91.5 / 95.3。
- 实机三视角：色块边界平滑、面间无黑线、山体明暗在岗、页面异常 0。

### 五、诚实说明

1. 海岸线锯齿仍在 —— 那是**水面网格**（按水格六边形拼）的多边形边，需按高程等值线裁剪水面。
2. `M.RELIEF_TEX = false` 可退回逐顶点明暗（保命/对照）。
3. 逐像素明暗依赖烘焙分辨率：N=256 时每纹素 1.84 世界单位；N=512 更细但烘焙约 6 秒。
"""
if '## v157.91 · 2026-11-21' not in a:
    a = a.rstrip('\n') + '\n' + DET
    print('detail ok')
assert '157.91' in a
io.open(q, 'w', encoding='utf-8', newline='').write(a)
print('archive ok')

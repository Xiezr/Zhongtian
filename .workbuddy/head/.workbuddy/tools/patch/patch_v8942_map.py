# -*- coding: utf-8 -*-
"""v89.42 补丁 1/2：map.js —— 野地贴图回归 + 逐格镜像变体
① ART_MAX 192 → 256：地形贴图 256px 现在与采样窗≈1:1，不再经 192 中转二次缩放
② 平地不再跳过贴图阶段（卫兵下移到矢量兜底前；素材缺席时留白语义不变）
③ 新增 texVariant（确定性逐格镜像：0/1/2/3 = 原/横/竖/双），贴图走轴对齐线性变换
"""
import io, os, sys

R = r'E:\Deepseekdb'
M = R + r'\js\map.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8941'
    io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
    os.replace(tmp, p)


def edit(p, old, new, tag):
    src = read(p)
    if old not in src and new in src:
        print('SKIP  ' + tag + '（已应用）')
        return
    n = src.count(old)
    if n != 1:
        print('FAIL [%s] 命中 %d 次' % (tag, n))
        sys.exit(1)
    write(p, src.replace(old, new, 1))
    back = read(p)
    assert new in back, '落盘回查失败：' + tag
    print('OK  ' + tag)


# ============ ① ART_MAX 192 → 256 ============
edit(M, r"""  var ART_MAX = 192;          /* 预缩放边长：≥ 2× 最大格边长（96） */""",
     r"""  /* v89.42：192 → 256 —— v85 自适应格距后 cell 最大 128（旧的"96 的 2 倍"口径过期）。
     地形贴图本身 256px：预缩放不再缩小它，采样窗（中心 45%）≈ 显示尺寸（104×52），
     整条链路只经一次 drawImage 重采样，像素风细节不再被二次缩放磨掉。 */
  var ART_MAX = 256;""",
     'map.js · ART_MAX 192→256')

# ============ ② 新增 texVariant（插在 blitArtRect 之前） ============
edit(M, r"""  /* 按**任意矩形**铺图（cover：只裁不缩，保持素材长宽比）。""",
     r"""  /* v89.42：逐格贴图镜像变体（0 原样 / 1 横镜像 / 2 竖镜像 / 3 双镜像）。
     确定性 hash —— 同一格每次渲染的变体固定（截图与回归可复现）；
     目的只是打破"同地形相邻格贴图一模一样"的墙纸感。
     ⚠️ 只用**轴对齐线性变换**（translate + scale(±1)），不引入旋转/仿射 ——
     理由同 blitArtRect 的注释：真仿射会把沙纹 / 水波这类方向性纹理拧歪。 */
  function texVariant(gx, gy) {
    var h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
    return (h >>> 5) & 3;
  }

  /* 按**任意矩形**铺图（cover：只裁不缩，保持素材长宽比）。""",
     'map.js · 新增 texVariant')

# ============ ③-a 平地卫兵：从函数头下移（贴图阶段不再跳过平地） ============
edit(M, r"""    drawList.forEach(function (d) {
      if (d.terrain === 'city') return;
      /* v41（需求 5）：平地不放图形 —— 只靠浅青绿底色表达 */
      if (d.terrain === 'plain') return;
      var ab = diaBox(d.gx, d.gy, d.el, IN);""",
     r"""    drawList.forEach(function (d) {
      if (d.terrain === 'city') return;
      var ab = diaBox(d.gx, d.gy, d.el, IN);""",
     'map.js · 平地卫兵上移（贴图阶段纳入平地）')

# ============ ③-b 贴图绘制加镜像变体；卫兵落到矢量兜底前 ============
edit(M, r"""        blitArtRect(ctx, 'terrain_' + d.terrain, ab.x, ab.y, ab.w, ab.h);
        ctx.restore();
        return;
      }
      /* 位图缺席时才走矢量兜底（立着的小树/山，尺寸按菱形外接框收） */""",
     r"""        /* v89.42：逐格镜像变体 —— 在 clip 之内做轴对齐镜像（clip 区域在 clip() 时刻
           已定格于设备空间，之后的 transform 不影响裁剪形状）。 */
        var tv = texVariant(d.gx, d.gy);
        if (tv & 1) { ctx.translate(2 * ab.x + ab.w, 0); ctx.scale(-1, 1); }
        if (tv & 2) { ctx.translate(0, 2 * ab.y + ab.h); ctx.scale(1, -1); }
        blitArtRect(ctx, 'terrain_' + d.terrain, ab.x, ab.y, ab.w, ab.h);
        ctx.restore();
        return;
      }
      /* v41（需求 5）：平地不放图形 —— 只靠浅青绿底色表达。
         v89.42：卫兵从"进函数即拦"下移到**矢量兜底之前** —— 平地现在也铺贴图
         （整片野地要有质感）；素材缺席时留白语义原样保留。 */
      if (d.terrain === 'plain') return;
      /* 位图缺席时才走矢量兜底（立着的小树/山，尺寸按菱形外接框收） */""",
     'map.js · 镜像变体 + 平地卫兵下移')

print('--- 语法检查 ---')
import subprocess
r = subprocess.run(['node', '--check', M], capture_output=True, text=True)
print('node --check rc=%d %s' % (r.returncode, (r.stderr or '').strip()[:300]))

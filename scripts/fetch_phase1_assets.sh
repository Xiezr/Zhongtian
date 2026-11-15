#!/usr/bin/env bash
# ============================================================
# Phase 1 · 拉取更好的自然件 3D 资产（Kenney / Quaternius，均 CC0）
# ------------------------------------------------------------
# 用途：老板嫌当前地表景物（锥形树 / 二十面体石）太糙，换更好的低模。
#       本脚本在你**本地有网机器**跑（沙箱网络被掐，curl 拉不动）。
#
# ⚠️ 关键约束（来自 GTF.parse）：本项目解析器只吃 **GLB**（校验 0x46546C67 magic），
#    不吃 .gltf。所以：
#      · Kenney Nature Kit 直出 **GLB** → 零转换，直接丢进 assets/nature/ 即可（首选）。
#      · Quaternius 多为 .glTF/.FBX → 需先转 GLB（脚本末尾给了 gltf-transform 一行命令）。
#        下面的 Simple Nature 镜像虽然直链可得，但是 .gltf，仅作"管线能吃"的探针样本。
#
# 建议落地顺序（与路线方案第 8 节一致）：
#   1) 先换自然件（树/石）—— 零风险，立刻提升观感；
#   2) 城堡等地标件留到 Phase 2（AutoSprite 单体地标机制）。
# ============================================================
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/assets/phase1_pilot"
NATURE="$ROOT/assets/nature"
mkdir -p "$DST/trees" "$DST/rocks" "$DST/grass" "$DST/bush" "$NATURE"

# ----------------------------------------------------------
# 【A】Quaternius Simple Nature —— GitHub 镜像直链（已验证可得，作探针样本）
#     内容：4 树 / 3 石 / 3 草 / 3 灌（.glTF，需转 GLB 才进游戏）
# ----------------------------------------------------------
SIMPLE_ZIP="https://github.com/Loppansson/quaternius-simple-nature-pack/archive/ef20f92a4739d6fccdd6a9987dcc6e2ee991429a.zip"
echo "【A】下载 Quaternius Simple Nature（GitHub 镜像，.glTF 样本）..."
if command -v curl >/dev/null 2>&1; then
  curl -L --max-time 120 -o "$DST/simple_nature.zip" "$SIMPLE_ZIP" \
    && echo "  ✓ 下载完成 -> $DST/simple_nature.zip" \
    || echo "  ✗ 下载失败（检查网络 / 代理）"
else
  echo "  ✗ 找不到 curl，请手动下载：$SIMPLE_ZIP"
fi
if [ -f "$DST/simple_nature.zip" ]; then
  ( command -v unzip >/dev/null 2>&1 && unzip -o -q "$DST/simple_nature.zip" -d "$DST/simple_nature_tmp" \
    && echo "  ✓ 解压完成（.glTF 在 $DST/simple_nature_tmp/，需转 GLB 才进游戏）" \
    || echo "  ✗ 解压失败：请装 unzip 或手动解压" )
fi

# ----------------------------------------------------------
# 【B】Kenney Nature Kit —— 真正的 drop-in（329 个 GLB，CC0）
#     直出 GLB，本项目解析器直接吃，零转换。
#     下载：浏览器打开 https://kenney.nl/assets/nature-kit → 点 Download 拿到 zip。
#     把那个 zip 的**直链**填到下面 KENNEY_ZIP 即可自动拉取；留空则跳过本步。
# ----------------------------------------------------------
KENNEY_ZIP=""   # ← 在此粘贴 Kenney Nature Kit 的 zip 直链（留空=手动下载后解压）
echo ""
echo "【B】Kenney Nature Kit（GLB 直读，首选）..."
if [ -n "$KENNEY_ZIP" ]; then
  curl -L --max-time 180 -o "$DST/kenney_nature.zip" "$KENNEY_ZIP" \
    && echo "  ✓ 下载完成" || echo "  ✗ 下载失败"
else
  echo "  · KENNEY_ZIP 未填 → 跳过自动下载。"
  echo "    手动：浏览器下载 https://kenney.nl/assets/nature-kit 的 zip，"
  echo "    解压后把 Models/GLTF/ 下的 *.glb 拷到：$NATURE/"
fi
if [ -f "$DST/kenney_nature.zip" ]; then
  ( command -v unzip >/dev/null 2>&1 && unzip -o -q "$DST/kenney_nature.zip" -d "$DST/kenney_tmp" \
    && echo "  ✓ 解压完成" || echo "  ✗ 解压失败" )
  # Kenney 的 GLB 通常在 Models/GLTF/ 下，统一收口到 assets/nature/
  find "$DST/kenney_tmp" -iname '*.glb' -exec cp -n {} "$NATURE/" \; 2>/dev/null
  cnt=$(find "$NATURE" -iname '*.glb' | wc -l)
  echo "  → assets/nature/ 现有 GLB 数：$cnt"
fi

# ----------------------------------------------------------
# 【C】探针验收：管线能吃这些 GLB / glTF 吗？（PBR 通道统计）
# ----------------------------------------------------------
echo ""
echo "【C】跑探针（node scripts/phase1_probe_glb.js）..."
node "$ROOT/scripts/phase1_probe_glb.js" "$DST" "$NATURE" 2>&1 | tail -20

# ----------------------------------------------------------
# 【D】glTF → GLB 转换（仅当要用 Quaternius .glTF 样本时）
#     需本地有 node + npx（联网装一次 @gltf-transform/cli）：
# ----------------------------------------------------------
echo ""
echo "【D】如需把 .glTF 转 GLB（Quaternius 样本用）："
echo "    npx -y @gltf-transform/cli@latest glb $DST/simple_nature_tmp/**/*.gltf $NATURE/"
echo ""
echo "完成。下一步：把 assets/nature/*.glb 经 GAME.gltf.parse 接入地表散点（见改造清单）。"

#!/usr/bin/env bash
# Phase 1 pilot · 下载 Quaternius 植被 + 3dassets 城堡模块（需本地有网环境执行）
#
# 背景：Quaternius / 3dassets 下载页为 JS 渲染 + zip 包，无稳定直链，
#       sandbox 无法自动抓取。本脚本给出「半自动」流程：从官网拿到直链后填入即可。
# 城堡形态决策（方案第八节）：单体地标（AutoSprite，快但不可拆）——代码层 AutoSprite 机制
#       尚在实现中，pilot 先用现有 assets/wonders/*.glb（ark/temple/forge 等单体 GLB）验证接入路径。
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/assets/phase1_pilot"
mkdir -p "$DST/trees" "$DST/castle"
echo "目标目录: $DST"
echo ""
echo "【1】Quaternius Stylized Nature MegaKit (CC0) — 取 1 棵树 GLB（植被样本）"
echo "  手动: 浏览器打开 https://quaternius.com/packs/stylizednaturemegakit.html"
echo "  下载 zip → 解压 → 选 1 个 Tree_*.glb 放到: $DST/trees/"
echo "  若有直链，取消下行注释并填入:"
# curl -L -o "$DST/trees/tree.glb" "在此粘贴直链"
echo ""
echo "【2】3dassets.dev 城堡模块 (CC0) — 取 1 个城门 GLB（城堡模块样本）"
echo "  手动: 浏览器打开 3dassets.dev 城堡分类，下载 1 个 GLB 放到: $DST/castle/"
# curl -L -o "$DST/castle/gate.glb" "在此粘贴直链"
echo ""
echo "【3】重跑探针验证管线能吃这种 GLB:"
node "$ROOT/scripts/phase1_probe_glb.js" "$DST"
echo ""
echo "【4】浏览器实机验证: 将 GLB 经 GAME.gltf.parse 加载到地表/测试场景，"
echo "    确认 PBR 通道（ORM/normal/AO/emissive）+ v157.61 地表 env 反射生效。"
echo "完成。"

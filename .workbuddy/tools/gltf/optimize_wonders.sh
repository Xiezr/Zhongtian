#!/usr/bin/env bash
# 奇观 glb 优化（832MB 原始 → 20MB 运行版）+ base64 模块生成。
# 前置：原始 9 个 .glb 放 assets/wonders/_raw/（gitignore）；本目录 npm install。
# 用法：bash .workbuddy/tools/gltf/optimize_wonders.sh
set -e
cd "$(dirname "$0")/../../.."    # 仓根
BIN=.workbuddy/tools/gltf/node_modules/.bin/gltf-transform
declare -A M=([01]=mothership [02]=dyson [03]=temple [04]=crystal [05]=ark [06]=pillars [07]=crater [08]=forge [09]=chairring)
for n in 01 02 03 04 05 06 07 08 09; do
  src=$(ls assets/wonders/_raw/${n}\ *.glb 2>/dev/null | head -1)
  [ -z "$src" ] && { echo "skip $n (no _raw)"; continue; }
  "$BIN" optimize "$src" "assets/wonders/${M[$n]}.glb" \
    --texture-size 512 --texture-compress webp --simplify-ratio 0.008 --simplify-error 0.002 --compress false
done
# base64 模块（双击 file:// 兜底）
node -e 'var fs=require("fs");fs.readdirSync("assets/wonders").filter(function(f){return /\.glb$/.test(f);}).forEach(function(f){var id=f.replace(".glb","");fs.writeFileSync("assets/wonders/"+id+".glb.js","(window.__WONDER_GLB=window.__WONDER_GLB||{})[\""+id+"\"]=\""+fs.readFileSync("assets/wonders/"+f).toString("base64")+"\";\n");});'
echo "done"

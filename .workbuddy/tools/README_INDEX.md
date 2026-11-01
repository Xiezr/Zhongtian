# `.workbuddy/tools/` 索引

> 开发期工具，**不进游戏运行期**。目录就是分组；本文件由 `gen/gen_tools_index.py` 自动生成。
> 归属判据与总地图见 `docs/项目地图.md`。**新增脚本请放进对应目录**（放在根目录会被列进"未归类"）。
> **退役标注**：带 `〔一次性 · 已退役（保留备查）〕` = 一轮用完即退役的一次性脚本，留档只为让交付文档的复现命令可回查（不复用、不当口径来源）；**不带此标 = 在岗**。
> 判据在 `gen_tools_index.py` 的 `is_one_off()` 里（可审、可改），不靠人记忆。

| 目录 | 个数 | 干什么 |
|---|---|---|
| `asset/` | 116 | 抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。 |
| `audit/` | 40 | 结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。 |
| `break/` | 22 | 逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。 |
| `gen/` | 10 | 素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。 |
| `git/` | 4 | **收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。 |
| `git/hooks/` | 2 | 存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 `install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。 |
| `gltf/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/.bin/` | 12 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/examples/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/lib/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/lib/custom/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/lib/maps/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/lib/system/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@colors/colors/themes/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/.github/workflows/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/adapters/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/browser/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/logger/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/modifiers/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@dabh/diagnostics/node/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/argument/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/argument/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/command/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/command/__fixtures__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/command/__tests__/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/config/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/error/` | 14 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/error/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/help/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/help/__tests__/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/help/templates/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/logger/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/logger/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/option/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/option/__tests__/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/parser/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/parser/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/program/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/program/__tests__/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/utils/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/utils/__tests__/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/utils/web/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/validator/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@donmccurdy/caporal/dist/validator/__tests__/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@emnapi/runtime/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@emnapi/runtime/dist/` | 13 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/bin/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/src/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/src/transforms/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/src/types/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/cli/src/utils/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/dist/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/src/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/src/io/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/src/properties/` | 20 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/src/types/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/core/src/utils/` | 12 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/dist/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-mesh-features/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-mesh-gpu-instancing/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-meshopt-compression/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-structural-metadata/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-texture-avif/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/ext-texture-webp/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-accessor-float16/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-accessor-float64/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-draco-mesh-compression/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-lights-punctual/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-anisotropy/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-clearcoat/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-diffuse-transmission/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-dispersion/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-emissive-strength/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-ior/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-iridescence/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-pbr-specular-glossiness/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-sheen/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-specular/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-transmission/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-unlit/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-variants/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-materials-volume/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-mesh-primitive-restart/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-mesh-quantization/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-node-visibility/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-texture-basisu/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-texture-transform/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/extensions/src/khr-xmp-json-ld/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/functions/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/functions/dist/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/functions/src/` | 49 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@gltf-transform/functions/src/types/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@img/colour/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@img/sharp-wasm32/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@img/sharp-wasm32/lib/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@img/sharp-win32-x64/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@img/sharp-win32-x64/lib/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/build/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/build/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/node_modules/emoji-regex/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/node_modules/emoji-regex/es2015/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@isaacs/cliui/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@pkgjs/parseargs/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@pkgjs/parseargs/examples/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@pkgjs/parseargs/internal/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@so-ric/colorspace/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@so-ric/colorspace/dist/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/braces/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/glob/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/lodash/` | 310 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/lodash/common/` | 12 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/lodash/fp/` | 386 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/micromatch/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/minimatch/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/ndarray/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/` | 49 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/assert/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/dns/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/fs/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/readline/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/stream/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/timers/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/` | 46 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/assert/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/dns/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/fs/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/readline/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/stream/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/node/ts4.8/timers/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/prompts/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/table/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/tmp/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/triple-beam/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/@types/wrap-ansi/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/lib/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/lib/compile/` | 10 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/lib/dot/` | 30 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/lib/dotjs/` | 27 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/lib/refs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ajv/scripts/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ansi-escapes/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ansi-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ansi-styles/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/astral-regex/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/async/` | 109 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/async/dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/async/internal/` | 25 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/balanced-match/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/balanced-match/.github/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/brace-expansion/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/brace-expansion/.github/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/braces/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/braces/lib/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/chalk/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/chalk/source/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-cursor/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-table3/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-table3/src/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-truncate/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-truncate/node_modules/emoji-regex/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cli-truncate/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color-convert/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color-name/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color-string/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color-string/node_modules/color-name/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color/node_modules/color-convert/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/color/node_modules/color-name/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/colorette/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cross-spawn/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cross-spawn/lib/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cross-spawn/lib/util/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/dist/cjs/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/dist/esm/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/dist/iife/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/dist/umd/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/lib/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/lib/api/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/csv-stringify/lib/utils/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cwise-compiler/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/cwise-compiler/lib/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/detect-libc/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/detect-libc/lib/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/draco3dgltf/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/eastasianwidth/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/emoji-regex/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/emoji-regex/es2015/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/enabled/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/environment/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/eventemitter3/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/eventemitter3/dist/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-deep-equal/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-deep-equal/es6/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-json-stable-stringify/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-json-stable-stringify/.github/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-json-stable-stringify/benchmark/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-json-stable-stringify/example/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fast-json-stable-stringify/test/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fecha/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fecha/dist/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fecha/lib/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fecha/src/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fill-range/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/fn.name/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/foreground-child/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/foreground-child/dist/commonjs/` | 17 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/foreground-child/dist/esm/` | 17 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/get-east-asian-width/` | 8 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/glob/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/glob/dist/commonjs/` | 29 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/glob/dist/esm/` | 33 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/gltf-validator/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/has-flag/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/inherits/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/iota-array/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/is-buffer/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/is-buffer/test/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/is-fullwidth-code-point/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/is-number/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/is-stream/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/isexe/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/isexe/test/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/jackspeak/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/jackspeak/dist/commonjs/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/jackspeak/dist/esm/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/json-schema-traverse/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/json-schema-traverse/spec/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/json-schema-traverse/spec/fixtures/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/keyframe-resample/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/keyframe-resample/assembly/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/keyframe-resample/dist/` | 17 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/keyframe-resample/src/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/kleur/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ktx-parse/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ktx-parse/dist/` | 15 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ktx-parse/src/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/kuler/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/dist/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/node_modules/ansi-styles/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/node_modules/emoji-regex/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/listr2/node_modules/wrap-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/lodash/` | 636 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/lodash/fp/` | 415 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/ansi-styles/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/emoji-regex/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/is-fullwidth-code-point/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/slice-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/log-update/node_modules/wrap-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/` | 30 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/dist/` | 21 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/examples/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/lib/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/lib/custom/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/lib/maps/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/lib/system/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/logform/node_modules/@colors/colors/themes/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/lru-cache/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/lru-cache/dist/commonjs/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/lru-cache/dist/esm/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/meshoptimizer/` | 24 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/micromatch/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/mikktspace/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/mikktspace/dist/main/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/mikktspace/dist/module/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/mimic-function/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minimatch/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minimatch/dist/commonjs/` | 25 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minimatch/dist/esm/` | 25 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minipass/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minipass/dist/commonjs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/minipass/dist/esm/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ms/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/dist/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/dist/src/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/dist/vendor/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/src/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-lanczos/vendor/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-ops/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-pixels/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-pixels/dist/` | 8 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/ndarray-pixels/src/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/one-time/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/onetime/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/package-json-from-dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/package-json-from-dist/dist/commonjs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/package-json-from-dist/dist/esm/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/path-key/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/path-scurry/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/path-scurry/dist/commonjs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/path-scurry/dist/esm/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/picomatch/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/picomatch/lib/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/dist/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/dist/dateparts/` | 10 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/dist/elements/` | 11 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/dist/util/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/lib/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/lib/dateparts/` | 10 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/lib/elements/` | 11 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/prompts/lib/util/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/property-graph/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/property-graph/dist/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/property-graph/src/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/punycode/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/readable-stream/` | 10 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/readable-stream/lib/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/readable-stream/lib/internal/streams/` | 10 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/restore-cursor/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/rfdc/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/rfdc/.github/workflows/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/rfdc/test/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/safe-buffer/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/safe-stable-stringify/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/safe-stable-stringify/esm/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/bin/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/classes/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/functions/` | 25 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/internal/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/semver/ranges/` | 11 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sharp/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sharp/dist/` | 28 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sharp/install/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sharp/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sharp/src/` | 14 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/shebang-command/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/shebang-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/signal-exit/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/signal-exit/dist/cjs/` | 13 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/signal-exit/dist/mjs/` | 13 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sisteransi/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/sisteransi/src/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/slice-ansi/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/slice-ansi/node_modules/ansi-styles/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/stack-trace/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/stack-trace/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width-cjs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width-cjs/node_modules/ansi-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width-cjs/node_modules/is-fullwidth-code-point/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width-cjs/node_modules/strip-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width/node_modules/ansi-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width/node_modules/is-fullwidth-code-point/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string-width/node_modules/strip-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string_decoder/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/string_decoder/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/strip-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/strip-ansi-cjs/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/strip-ansi-cjs/node_modules/ansi-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/supports-color/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/dist/` | 73 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/dist/schemas/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/ansi-regex/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/ansi-styles/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/color-convert/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/color-name/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/emoji-regex/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/emoji-regex/es2015/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/is-fullwidth-code-point/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/slice-ansi/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/string-width/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/table/node_modules/strip-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/text-hex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/tmp/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/tmp/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/to-regex-range/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/triple-beam/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/triple-beam/.nyc_output/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/triple-beam/.nyc_output/processinfo/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/triple-beam/config/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/tslib/` | 11 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/tslib/modules/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uniq/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uniq/test/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uri-js/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uri-js/dist/es5/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uri-js/dist/esnext/` | 15 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/uri-js/dist/esnext/schemes/` | 21 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/util-deprecate/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/watlas/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/watlas/dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/which/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/which/bin/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston-transport/` | 11 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston-transport/.nyc_output/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston-transport/.nyc_output/processinfo/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston-transport/dist/` | 3 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/dist/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/dist/winston/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/dist/winston/config/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/dist/winston/transports/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/lib/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/lib/winston/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/lib/winston/config/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/winston/lib/winston/transports/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi-cjs/` | 4 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi-cjs/node_modules/ansi-regex/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi-cjs/node_modules/strip-ansi/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi/node_modules/ansi-styles/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi/node_modules/emoji-regex/` | 9 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi/node_modules/emoji-regex/es2015/` | 6 | **待归类**：确认用途后放进上面的某个目录。 |
| `gltf/node_modules/wrap-ansi/node_modules/string-width/` | 5 | **待归类**：确认用途后放进上面的某个目录。 |
| `map/` | 2 | **动手前的第一站**：`gen_index.js` 扫源码生成 `js/modules.json`（唯一权威模块清单）与 `.workbuddy/index/project-index.json`（符号/断言/资产/标定表）；`who.js <关键词>` 反查"改哪里、波及什么、跑哪条验证"。铁律：索引必须被构建与审计消费，过期由 smoke §591 报红。 |
| `mem/` | 10 | MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。 |
| `patch/` | 1258 | **事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。 |
| `play/` | 1 | **不在 gate 三件套内，按需手动跑**。`lifecycle_v89121.js` = 全玩法链路体检（渠道 / 锻造 / 宝物等分组核验，交付文档的复现命令指向它 → **视同在岗**）；`repro_v89174*` = 三条一次性复现。 |
| `playtest/` | 1 | v89.x 时代的 600×/1× 长时压测与收益分析（`play_600x.js` 等，单次几分钟到几十分钟）。结论已沉淀进交付文档；**不复用为口径**，新压测请基于 `probe/` 的在岗模板重写。 |
| `probe/` | 16 | jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。**其余带版本号的（`probe_v89101_explore.js` 等）= 一次性探针**，判据见 `is_one_off()`：名字里带版本号就是"一轮用完即退役"。 |
| `prof/` | 7 | **待归类**：确认用途后放进上面的某个目录。 |
| `show/` | 239 | 给老板看的对照图 / 曲线校准 / 素材巡视。 |
| `show/reports/` | 2 | **待归类**：确认用途后放进上面的某个目录。 |
| `sim/` | 1 | **待归类**：确认用途后放进上面的某个目录。 |
| **合计** | **5928** | |

## asset/（素材处理）

抠底必须连通域洪水填充（BFS）；**绝不用 CSS 滤镜染色**，一律像素级 HSL 重映射写进 PNG。

- `avatar_atlas.py`（8KB）　— 头像图集体检 + 切分 + 抠底。
- `build_atlas_src.py`（2KB）　— v89.107 建筑图标重绘 · 第一步：把 4 张原图拼成 2×2 图集（白底），
- `check_v89103_shots.js`（4KB）
- `check_v89116_shots.js`（3KB）
- `check_v89117_shots.js`（4KB）
- `check_v89118_shots.js`（3KB）
- `check_v89119_shots.js`（3KB）　— v89.150：⛔「回合纪要」板块已退役（老板 3）—— 本脚本第 ② 项的判据（下半区=纪要）不再成立，
- `check_v89120_shots.js`（4KB）　— v89.150：⛔「回合纪要」板块已退役（老板 3）—— 本脚本第 ② 项的判据（下半区=纪要）不再成立，
- `check_v89121_flags_on_screen.py`（2KB）　— v89121 · 实机截图里的族旗可见性：找高饱和像素簇（旗布）+ 报告颜色与位置
- `check_v89132_shots.js`（6KB）
- `check_v89134_shots.js`（3KB）
- `check_v89135_shots.js`（3KB）
- `check_v89136_shots.js`（3KB）
- `check_v89137_shots.js`（6KB）
- `check_v89138_shots.js`（5KB）
- `check_v89139_shots.js`（2KB）　— v89.139 像素体检（轻量）：图非空 + 关键区域有内容
- `check_v89142_board.js`（4KB）　— v89.142 像素体检：城外地块 12×8 棋盘 —— 用**亮度矩阵**当眼睛
- `check_v89143_shots.js`（3KB）　— v89.143 像素体检（轻量）：商城铺满的"下半屏内容量"对照（改前 vs 改后）
- `check_v89144_shots.js`（4KB）　— v89.144 像素体检：4 张实机图 —— ① 非空 ② 关键区域真有色
- `check_v89145_shots.js`（4KB）　— v89.145 像素体检：3 张实机图 —— 非空 + 关键区域真有色（模型读不了图，用统计当眼睛）
- `check_v89147_shots.js`（3KB）　— v89.147 像素体检：2 张实机图（装备页 / 宝物页）——
- `check_v89148_shots.js`（3KB）　— v89.148 像素体检：战斗界面（v89148-bt-after.png）——
- `check_v89149_shots.js`（4KB）　— v89.149 像素体检：战场条「拉到回合记录的上方」（改前 / 改后 对照）
- `check_v89152_shots.js`（4KB）　— v89.152 像素体检（先量后定 · §59.3）：未占野地"产出 4 行" vs 已占"无产出"
- `check_v89153_shots.js`（5KB）　— v89.153 像素体检（先量后定）：公文系统页主题色 / 小标签筛选 / 收获 toast
- `check_v89154_shots.js`（5KB）　— v89.154 像素体检（先量后定 · 判据取自实测值并留余量）：
- `check_v89155_shots.js`（4KB）　— v89.155 像素体检（先量后定 · 判据取自实测值并留余量）：
- `check_v89156_shots.js`（4KB）
- `check_v89157_shots.js`（4KB）　— v89.157 像素体检：公文徽章/铺满 · 将领条 · 围墙要求 · 逐回合弹窗 · 地块 4×3
- `check_v89158_shots.js`（3KB）　— v89.158 像素体检：悬停保持图 + 仓库面板拆账图
- `check_v89159_shots.js`（4KB）　— v89.159 像素体检：升级键在/不在（对照）· 上限行 · 公文升级刷新行
- `check_v89160_shots.js`（3KB）　— v89.160 像素体检：仓库面板折损行（琥珀警示）· 公文灾种行（内政青主题色）· 自动化面板说明
- `check_v89161_shots.js`（3KB）　— v89.161 像素体检：资源栏金行（真渲染）· 仓库折损行（现实换算）
- `check_v89162_shots.js`（4KB）　— v89.162 像素体检：三张图（六维表 / 城池面板 / 旧币 tip）
- `check_v89163_shots.js`（3KB）　— v89.163 像素体检：两图（指挥战斗清单 / 募兵卡 tip）
- `check_v89164_shots.js`（3KB）　— v89.164 像素体检：两图（出征战术下拉 / 战场智能指示）
- `check_v89165_shots.js`（4KB）　— v89.165 像素体检：三张实机图（判据按 tmp/measure_v89165.js 实测值定 · §59.3 先量后定）
- `check_v89166_shots.js`（3KB）　— v89.166 像素体检：两图（城池面板 / 点击后城内大界面）
- `check_v89167_shots.js`（3KB）　— v89.167 像素体检：两图（自动化面板状态行 / 主城多格施工）
- `check_v89169_shots.js`（3KB）　— v89.169 像素体检：围墙 0 级虚影环（三图对照）
- `check_v89170_charts.js`（4KB）　— v89.170 图表的程序化体检（本机模型读不了图 → 用 bbox 当眼睛）
- `check_v89171_shots.js`（3KB）　— v89.171 像素体检：选择窗三段态（Lv1 可用 / 用后 / Lv60 全到线）
- `check_v89173_shots.js`（3KB）　— v89.173 像素体检：选择窗三态（Lv1 卡面 / 用后 Lv49 / Lv60 仍可用）
- `check_v89174_shots.js`（5KB）　— v89.174 体检：① 两图像素基线；② 弹窗**无滚动条**复量（官府「在建队列」灌满 3 条 —— 铁律：弹窗内不许滚动条）
- `check_v89176_shots.js`（2KB）　— v89.176 像素体检（快速）：两张实机图非空 + 暗色主题基线 + 结构带亮度
- `check_v89180_shots.js`（2KB）　— v89.180 像素体检：战场图（v89180-battle）· 悬停图（v89180-tip）
- `check_v89186_shots.js`（3KB）　— v89.186 截图像素体检：非空 + 暗色主题基线（均亮/亮像素）+ 各图关键色带。
- `check_v89187_shots.js`（2KB）　— v89.187 截图像素体检（3 张：合成区 / 合成后 / 据点情报）
- `check_v89188_shots.js`（4KB）　— v89.188 截图像素体检（3 张：将领界面 / 官府民心段 / 改建面板）
- `check_v89189_shots.js`（3KB）　— v89.189 截图像素体检（3 张：受阻弹窗 ×2 / 城池视图）
- `check_v89190_shots.js`（3KB）　— v89.190 截图像素体检（3 张：将领界面 / 自动征兵面板 / 据点情报弹窗）
- `check_v89191_shots.js`（3KB）　— v89.191 截图像素体检（5 张：数值框面板 / 将领错开 / 科技面板 / 宝具入口 / 宝具选择窗）
- `check_v89192_shots.js`（4KB）　— v89.192 截图像素体检（3 张：地图导航 / 战场回合记录 / 沙盘铺满）
- `check_v89193_shots.js`（4KB）　— v89.193 截图像素体检（5 张：跳变补算 / 总览空态 / 总览行 / 前哨面板 / 满员受阻）
- `check_v89194_shots.js`（3KB）　— v89.194 截图像素体检（3 张：雷达圈 / 藏珍阁 / 将领详情）
- `check_v89195_shots.js`（4KB）　— v89.195 截图像素体检（5 张：总览 / 确认窗 / 放手后地图 / 面板 / 升档）
- `check_v89196_shots.js`（3KB）　— v89.196 截图像素体检（6 张：雷达折线 / 战场结束 / 沙盘回看 / 收藏锁 / 收藏解锁 / 升档）
- `check_v89197_shots.js`（3KB）　— v89.197 截图像素体检（4 张：出征面板 / 悬停浮层 / 围困估算 / 战法行特写）
- `check_v89198_shots.js`（2KB）　— v89.198 截图像素体检（2 张：出征面板 / 管理弹窗）
- `check_v89199_shots.js`（3KB）　— v89.199 截图像素体检（2 张：自动征兵修复后 / 设置页版本行）
- `check_v89200_shots.js`（2KB）　— v89.200 截图像素体检（2 张：出征面板改后 / 据点估算无围攻行）
- `check_v89201_shots.js`（3KB）　— v89.201 截图像素体检（3 张：侦查单页 / 多选打造 / 百炼专属界面）
- `check_v89202_shots.js`（3KB）　— v89.202 截图像素体检（4 张：蕴养同款 / 侦查单页 / 侦查极端屏 / 收藏峰值）
- `check_v89203_shots.js`（3KB）　— v89.203 截图像素体检（3 张：toast 中上 / 占领后城池一览 / 爵位管理城池列）
- `check_v89204_shots.js`（6KB）　— v89.204 截图像素体检（4 张：强化面板 / 商城底栏分页 / 侧栏民心 / 失城后）
- `check_v89205_shots.js`（3KB）　— v89.205 像素体检：挂件行退役 + 卸下迁入选择窗（三图）
- `check_v89207_shots.js`（3KB）　— v89.207 像素体检：toast 合并 / 增速档 / 离线纪要 / 沙盘推演（四图）
- `check_v89209_shots.js`（3KB）　— v89.209 像素体检：三张实机图（先量后定 —— 判据来自 dump209pix 实测）
- `check_v89210_shots.js`（6KB）　— v89.210 像素体检：键盘流 / 状态条 / 战前推演 / 睡眠等价
- `check_v89211_shots.js`（5KB）　— v89.211 像素体检：装备显示对照 / 占城视图 / 器械提交（先量后定）
- `check_v89212_shots.js`（4KB）　— v89.212 像素体检：四图（资源悬停 / 仓库面板 / 城外面板 / 出征面板）
- `check_v89213_shots.js`（5KB）　— v89.213 像素体检：分页条「整体居中」（底栏 + 弹窗）
- `check_v89214_shots.js`（3KB）　— v89.214 像素体检：装备悬停三色 + 换皮画面（程序化"眼睛"—— 判据先量后定）
- `check_v89215_shots.js`（3KB）　— v89.215 像素体检：驻军栏全兵种固定序（有兵城 / 空城全 0）
- `check_v89218_shots.js`（3KB）　— v89.217/v89.218 像素体检：四张实机图（创建 / 顶栏 / 地图 / 城池）
- `check_v89219_shots.js`（3KB）　— v89.219 像素体检：悬停浮层（白值+金增量）/ 百炼面板（整套键）/ 缩略图（新机构词）
- `check_v89220_shots.js`（3KB）　— v89.220 像素体检：四张实机图（基因实验室 / 政务厅按钮 / 调运不限 / 拆后升级）
- `check_v89221_shots.js`（3KB）　— v89.221 像素体检：创建 chip 标签 / 任务页签闪烁（两帧对照）/ 车库行 / 任务视图
- `crop_city.py`（3KB）　— v89.43：城池贴图裁切流水线（与 crop_terrain.py 同一套铁律）。
- `crop_pd3.py`（6KB）　— 裁切 v3（定稿）：**从上往下裁，只去掉顶部留白**。
- `crop_terrain.py`（6KB）　— v89.42：地形贴图裁切流水线（从即梦参考图裁切 → 归一化 → 落位 assets/icons/ui/）。
- `cut_quads.py`（3KB）　— 四格图 → 地形/城池贴图（**整块压缩法**）。
- `diag_bldg_materials.py`（4KB）　— 诊断：原图（_gold_backup）与现图，各自的**图内色相结构** ——
- `diag_v89214_ascii.js`（1KB）
- `diag_v89214_tip.js`（1KB）
- `flag_bldg_icons.py`（8KB）　— ⛔ v89.225 已退役：族旗管线（本文件运行即退出，代码仅作历史追溯）。
- `flatten_block.py`（3KB）　— 形态校正：把 isometric 立体块的**顶面菱形**反投影成正方形材质（256×256），
- `gallery31.js`（4KB）　— 图标画廊截图：把全部图标以 96px 网格渲染成单页，便于统一评估设计感
- `gallery33.js`（6KB）　— v33 最终验收：99 图标几何验证（getBoundingClientRect，不受承台干扰）+ 总览图 + 城内统计
- `gen_names_v9017.py`（3KB）　— v90.17（老板 4）：套装部件名多元化 —— 14 槽 × 3 侧重各给专属名（占=战斗/治=测控/体=重装），
- `gen_sets_eff_v9016.py`（2KB）　— v90.16 套装六维重算：每级(件数档)总六维 = 凡品 500，逐级 ×1.5。
- `gen_sets_v9014.py`（6KB）　— v90.14 套装重设：6 档 × 3 侧重 = 18 套 · 每套 19 件。去散件。
- `gen_v9016_full.py`（4KB）　— v90.16 完整重生成：18 套 × 19 件，**每件都给六维加成**（按侧重分配），
- `grade_tiles.py`（4KB）　— 废土调色 —— 给现有地图贴图统一上「废土·余烬纪元」色调（**只变色，不动几何**）。
- `make_portrait_refs.py`（4KB）　— 将领肖像 · 参考图套件生成。
- `matte.js`（3KB）　— v35-b：AI 生成图的背景检测 + 抠底（四角采样 → 距离阈值 → alpha 归零）
- `mecha_clean_split.py`（4KB）　— 去白底（更干净：把抗锯齿灰边一并算背景）+ 机甲整体 / 披风左右分割导出。
- `mecha_data_finish.py`（4KB）　— data.js 收尾：19 槽锻造蓝本 + 锻造材料映射 + 基因槽列表解耦。
- `mecha_gen_equip.py`（3KB）　— 为每套机甲装备生成缺失的 7 槽件（右臂/右前臂/右脚 + 左·右大腿 + 左·右小腿）。
- `mecha_label13.py`（3KB）　— 机甲部件切分 · 第四步：在原图上叠 13 部位名称（供老板确认对应关系）
- `mecha_split13.py`（5KB）　— 机甲部件切分 · 第三步：13 部位（小腿/脚掌在脚踝处再切）+ 命名对照图
- `mecha_split_export.py`（2KB）　— 机甲部件切分 · 第二步：把各连通域导出为透明 PNG + 拼对照图（供老板确认）
- `mecha_split_probe.py`（2KB）　— 机甲部件切分 · 第一步：去白底 + 连通域标注 + 出对照图（供老板确认）
- `portrait_gallery.js`（2KB）　— 头像画廊：渲染多种资质+性别的程序化头像
- `portrait_pool.py`（5KB）　— 英雄肖像建池 —— 去背景（**凸包保留半身**）+ 缩 512 WebP + 分类打标。
- `rebalance_wasteland.py`（2KB）　— v90.12（老板 1）：废土化资源重设 —— 建筑/兵种「少木料、重废钢」。
- `redesign_themes_v9019.py`（4KB）　— v90.19：四主题重设计 —— 保留令牌角色，只换色值（每主题一套完整调色板）。
- `redesign_themes_v9021.py`（4KB）　— v90.21：四主题改用**公认配色**（非自创）——只换色值，保留令牌角色。
- `rename_matte.js`（3KB）　— v35-c：AI 原图 → 按 id 重命名 → 抠底 → 输出 ui/；并做风格一致性复检
- `scan_asset_vs_source.py`（11KB）
- `split_atlas.py`（6KB）　— v89.107 建筑图标重绘 · 第二步：图集 → 体检 → 切分 → 抠底 → 统一裁切 → 出对照图。
- `verify_v89102_troop_icons.js`（4KB）
- `verify_v89106_screen.js`（11KB）
- `verify_wasteland.js`（8KB）　— verify_wasteland.js —— 废土换皮 · 素材层校验（穷举业务 id 的 layerOf + 登记表 vs 磁盘）
- `wasteland_batches.json`（13KB）
- `wasteland_rollback.py`（2KB）　— 一键回滚 —— 把 assets/icons/ui/ 全部还原到换皮开工前的快照。

## audit/（审计与核对）

结构 / 颜色 / 落盘 / 引用 / 删除 的核对工具。`verify_v66_edits.py` = **落盘核验**模板；`audit_refs.py` = 搬迁前查引用点；`read_recycle.py` = 解析回收站 `$I` 元数据核实删了什么；`trash_paths.py` = 逐项+回查的删除模板。

- `_v89179c_dataset.txt`（5KB）
- `audit_colors.js`（5KB）　— 配色审计：把 index.html 里 4 套主题的关键变量解析出来，
- `audit_refs.py`（3KB）　— 搬迁前普查：谁引用了 DESIGN.md / docs 里的文件 / tools 里的脚本。
- `audit_v125b_perf_ui.js`（15KB）　— v131：`distOf` 上界从 20 放到 40 —— 它现在是 **O(视野环内格数)**，
- `audit_v125b_playtest_dist.js`（8KB）　— 分布检验 v2 —— **沿用 fun-audit 的 harness**（补满将领 + withBoost 半科技 + 同一守军坐标），
- `audit_v89105_chains.js`（25KB）
- `audit_v89105_css_tokens.js`（10KB）　— 取 <style> 段（含多条 style）
- `audit_v89105_modals.js`（15KB）
- `audit_v89112_pressure.js`（13KB）
- `audit_v89116_refs.js`（4KB）　— 白名单：动态挂载 / 测试或工具注入 / 平台/浏览器提供 / 本项目约定的外部注入点
- `audit_v89117_fonts.js`（7KB）　— 剥注释：说明文字里提到 font-size 不算数（本项目踩过多次）
- `audit_v89121_inventory.js`（7KB）
- `audit_v89134_tables.js`（14KB）　— 白名单（每条必须有理由） ----------
- `audit_v89159_review.py`（6KB）　— v89.159 复核取证器（只读）：把「未完成 / 从未实现」清单逐条在代码里核一遍。
- `audit_v89165_live.js`（5KB）　— v89.165 清点器（递归版）：**实时读秒类弹窗** —— 含硬时序特征（进度条/读秒/attr）
- `audit_v89179c_dataset_refs.js`（6KB）
- `audit_v89206_codemap.js`（6KB）　— v89.206 代码梳理 · 量化脚本（codemap）
- `audit_v89206_systemmatrix.js`（6KB）　— v89.206 玩法功能梳理 · 四链核对脚本（systemmatrix）
- `audit_v89206_ux.js`（4KB）　— v89.206 体验梳理 · 交互面盘点脚本（ux）
- `audit_v89207_icontitle.js`（2KB）　— v89.207 快赢①：纯图标按钮 title 审计 —— 扫全仓（js 字符串 + index.html），
- `audit_v89207_icontitle2.js`（1KB）　— v89.207 快赢① 升级版：跨行匹配 <button ...>...</button>，剥离 JS 拼接符后看可见文本。
- `audit_v89208_codemap.js`（12KB）　— v89.208 代码梳理 · 量化 + 一致性/健壮性探针（codemap）
- `audit_v89208_cover.js`（6KB）　— v89.208 · 全面评价体系 · 维度⑧「测试体系的覆盖盲区」（元层）
- `audit_v89208_systemmatrix.js`（12KB）　— v89.208 玩法功能梳理 · 四链核对 + 入口面/关停清单（systemmatrix）
- `audit_v89208_ux.js`（9KB）　— v89.208 体验梳理 · 交互面盘点（ux）
- `audit_v89214_namescan.py`（3KB）　— v89.214：换皮前的影响面扫描 —— 统计"中文名词"在 产品代码/测试 里的出现（剥注释后）
- `audit_v89229b_troopchain.js`（22KB）
- `check_v89214_risk.py`（1KB）　— 换皮前置安全检查：把高风险词的**全部出现上下文**打印出来（人眼过一遍误伤）
- `consolidate_docs.py`（9KB）　— 集中存放 · 第一步：docs 分档 + 拆 DESIGN.md + 引用转接。
- `consolidate_docs2.py`（5KB）　— 集中存放 · 第二步：引用转接 + 终检（docs 分档与 DESIGN 拆分已在第一步完成）。
- `consolidate_tools.py`（5KB）　— 集中存放 · 第三步：tools 分子目录 + 引用转接 + 重写索引生成器。
- `diag_v89105_overflow.js`（3KB）　— 诊断：7 个溢出弹窗的**高度分布**（哪个块把窗口撑爆了）
- `economy_audit.js`（8KB）　— 经济审计：旧币收入构成（v68 · 老板「审计一下」）
- `fix_v89165_audit.py`（3KB）　— 修 audit_v89165_live.js：hasLive 递归化 + 豁免表补全。
- `ladder_audit.js`（6KB）　— 数值阶梯审计 —— 回答一个问题：**从开局到灰烬城，这条路走得通吗？
- `read_recycle.py`（2KB）　— 解析 E: 回收站的 $I 元数据，列出"刚刚被删的原始路径"。
- `survey_project.py`（5KB）　— 项目全景盘点：产物清单 + 规则分布 + 引用关系（为"是否完整/精简/集中"提供证据）。
- `survey_project2.py`（3KB）　— 补充盘点：素材分解 · 记忆体量 · 项目自建技能 · 测试规模。
- `trash_paths.py`（3KB）　— 把「无用图标」逐项送进回收站 —— 逐项回查，遇错不中断。
- `verify_v66_edits.py`（5KB）　— v66 改动落盘核验（第二版：正/反向分开写，标记与真实源码一致）。

## break/（破坏测试）

逐类注入故障，确认断言**真的会红**（红不了的就是装饰）。铁律：先校验断言在文件里、注入后连"是否中断"一起看、收尾 md5 比对还原。

- `break_build_gate.py`（5KB）　— 破坏测试：确认第 54 节（建造前置 · 逐步探索）的三条核心断言**真的会红**。
- `break_dialog_unify.py`（5KB）　— 破坏测试：确认第 56 节（弹窗统一规范）的核心守卫**真的会红**。
- `break_gate.py`（2KB）　— 破坏测试：确认 git/gate.py 的判据**真的会红**（红不了的就是装饰）。
- `break_gov_center.py`（4KB）　— 破坏测试：确认第 55 节（官府居中 + 迁移）的核心断言**真的会红**。
- `break_hooks.py`（3KB）　— 端到端破坏测试：确认 pre-commit 钩子**真的会拦住**坏提交（拦不住就是装饰）。
- `break_invasion.py`（5KB）　— 破坏测试：确认第 53 节（定期来袭）的三条核心断言**真的会红**。
- `break_map3d.py`（3KB）　— v90.61 破坏测试：往 3D 主地图注入 bug，验证 §map3d 护栏**真的会红**。
- `break_quest_ready.py`（5KB）　— 破坏测试：确认第 57 节（可领取任务置顶 + 行内领取）的核心断言**真的会红**。
- `break_v60.py`（7KB）　— v60 破坏测试：往生产代码注入 15 类 bug，验证新护栏**逐条变红**。
- `break_v61.py`（5KB）　— v61 破坏测试：注入 10 类 bug，验证护栏逐条变红。
- `break_v62.py`（4KB）　— v62 破坏测试：注入 9 类 bug，验证护栏逐条变红。
- `break_v63.py`（6KB）　— v63 破坏测试：逐条注入 bug，确认新护栏**真的会红**（而不是恒真装饰）。
- `break_v64.py`（7KB）　— v64 破坏测试（带备份与完整性校验）。
- `break_v65.py`（10KB）　— v65 破坏测试（带备份与完整性校验）。
- `break_v66.py`（6KB）　— v66 破坏测试：逐条注入"退回改前写法"，确认对应断言真的变红。
- `break_v67.py`（5KB）　— v67 破坏测试：注入"退回改前写法"，确认对应断言真的变红。
- `break_v67_save.py`（6KB）　— v67 存档系统 · 破坏测试：逐类注入故障，确认新断言**真的会红**。
- `break_v70.py`（5KB）　— 破坏测试：确认第 58 节（v70 五项需求）的核心断言**真的会红**。
- `break_v8986.py`（6KB）　— v89.86 破坏测试：对整改 21 条 + 门派 P1 的 smoke §85 断言逐一注入，确认**变红**（可翻转）。
- `break_v8987.py`（7KB）　— v89.87 破坏测试：对四需求（快购/派兵统一/战斗规则/观战）的 §87 断言逐一注入，
- `break_v8988.py`（7KB）　— v89.88 破坏测试：对「野外城池改造 + 地图悬浮」的 §88/§⑦ 断言逐一注入，确认**变红**。
- `break_v8989.py`（7KB）　— v89.89 破坏测试：对「v6 期待清单八条（A2/A3/A4/B1/C3/C4/D4/E3）」的 §89 断言逐一注入，

## gen/（生成器与索引）

素材/索引的**唯一来源**。`gen_bitmaps.js` 扫描 `assets/icons/ui/` 生成 `js/bitmaps.js`（勿手改产物）；`gen_tools_index.py` 生成本索引。

- `atlas_split.js`（6KB）　— v35-e：图集切分流水线 —— 一张 2×2 图集切成 4 个标准透明图标
- `gen_bitmaps.js`（3KB）　— v35-g：扫描 assets/icons/ui/ 生成 js/bitmaps.js（位图素材登记表）
- `gen_gicons.js`（14KB）　— 从 @iconify-json/game-icons 提取项目所需的 81 个图标，生成 js/gicons.js
- `gen_tables_index.js`（6KB）　— ① 拿盘点结果（require 共享模块 —— 沙箱下 spawn 子进程会 EBUSY） ----------
- `gen_tools_index.py`（11KB）　— 生成 `.workbuddy/tools/README_INDEX.md` —— 按**目录**分组（v67 起目录就是分组）。
- `gen_v89125_build_times.js`（9KB）　— v89.125：生成 docs/v89125-建筑建造时间表.md
- `gen_v89194_price_table.js`（3KB）　— v89.194 生成器：道具价格表（docs/v89194-道具价格表.md）
- `gen_v8950_content.js`（20KB）
- `wasteland_batch.py`（26KB）　— 废土·余烬纪元 · 位图替换**批驱动 + 装前门禁**（阶段 3）。
- `wasteland_prompts.py`（21KB）　— 傻瓜式出图 prompt 生成器 —— 一次打印一批的**可直接复制**提示词。

## git/（Git 同步与门禁）

**收尾同步的唯一入口**。`sync.py` 默认干跑、`--apply` 才落盘（干跑先行是本项目铁律）；`gate.py` 是三件套门禁的**唯一出口**（pre-commit 钩子与 sync 都调它）；`install_hooks.py` 把 `hooks/` 里的钩子装进 `.git/hooks/`。

- `gate.py`（21KB）　— 三件套门禁 —— 提交前跑 audit / smoke / e2e，红了就不许提交。
- `install_hooks.py`（4KB）　— 安装 / 卸载 / 检查本仓的两个 git 钩子。
- `sync.py`（12KB）　— 收尾一键同步 —— 汇总改动 → 过门禁 → 提交 → 推送到 GitHub。
- `test_gate_baseline.py`（4KB）　— 门禁基线判定的单元测试（判据自己也要能测）。

## git/hooks/（Git 钩子本体）

存这里是为了**进版本库** —— `.git/hooks/` 不被 git 跟踪，换台机器克隆后必须跑 `install_hooks.py` 重装。⚠️ **行尾必须 LF**，CRLF 会让 `#!/bin/sh` 失效。

- `post-commit`（2KB）　— Deepseekdb-managed-hook v1 —— 提交后自动推送到 GitHub
- `pre-commit`（1KB）　— Deepseekdb-managed-hook v1 —— 提交前跑三件套门禁

## gltf/（未归类）

待归类：请确认用途后归档。

- `optimize_wonders.sh`（1KB）　— 奇观 glb 优化（832MB 原始 → 20MB 运行版）+ base64 模块生成。
- `package-lock.json`（87KB）
- `package.json`（0KB）

## gltf/node_modules/（未归类）

待归类：请确认用途后归档。

- `.package-lock.json`（72KB）

## gltf/node_modules/.bin/（未归类）

待归类：请确认用途后归档。

- `glob`（0KB）
- `glob.cmd`（0KB）
- `glob.ps1`（1KB）
- `gltf-transform`（0KB）
- `gltf-transform.cmd`（0KB）
- `gltf-transform.ps1`（1KB）
- `node-which`（0KB）
- `node-which.cmd`（0KB）
- `node-which.ps1`（1KB）
- `semver`（0KB）
- `semver.cmd`（0KB）
- `semver.ps1`（1KB）

## gltf/node_modules/@colors/colors/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— @colors/colors ("colors.js")
- `index.d.ts`（3KB）　— Type definitions for @colors/colors 1.4+
- `package.json`（1KB）
- `safe.d.ts`（2KB）　— Type definitions for Colors.js 1.2
- `safe.js`（0KB）　— Remark: Requiring this file will use the "safe" colors API,

## gltf/node_modules/@colors/colors/examples/（未归类）

待归类：请确认用途后归档。

- `normal-usage.js`（2KB）
- `safe-string.js`（2KB）

## gltf/node_modules/@colors/colors/lib/（未归类）

待归类：请确认用途后归档。

- `colors.js`（6KB）
- `extendStringPrototype.js`（3KB）
- `index.js`（0KB）
- `styles.js`（2KB）

## gltf/node_modules/@colors/colors/lib/custom/（未归类）

待归类：请确认用途后归档。

- `trap.js`（2KB）
- `zalgo.js`（3KB）　— please no

## gltf/node_modules/@colors/colors/lib/maps/（未归类）

待归类：请确认用途后归档。

- `america.js`（0KB）
- `rainbow.js`（0KB）
- `random.js`（0KB）
- `zebra.js`（0KB）

## gltf/node_modules/@colors/colors/lib/system/（未归类）

待归类：请确认用途后归档。

- `has-flag.js`（1KB）
- `supports-colors.js`（4KB）

## gltf/node_modules/@colors/colors/themes/（未归类）

待归类：请确认用途后归档。

- `generic-logging.js`（0KB）

## gltf/node_modules/@dabh/diagnostics/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（1KB）　— CHANGELOG
- `DISTRIBUTION.md`（0KB）　— DABH distribution
- `LICENSE`（1KB）
- `README.md`（14KB）　— `diagnostics`
- `diagnostics.js`（4KB）
- `package.json`（2KB）

## gltf/node_modules/@dabh/diagnostics/.github/workflows/（未归类）

待归类：请确认用途后归档。

- `ci.yml`（0KB）

## gltf/node_modules/@dabh/diagnostics/adapters/（未归类）

待归类：请确认用途后归档。

- `hash.js`（0KB）
- `index.js`（0KB）
- `localstorage.js`（0KB）
- `process.env.js`（0KB）

## gltf/node_modules/@dabh/diagnostics/browser/（未归类）

待归类：请确认用途后归档。

- `development.js`（1KB）
- `index.js`（0KB）　— Select the correct build version depending on the environment.
- `override.js`（0KB）　— No way to override `debug` with `diagnostics` in the browser.
- `production.js`（1KB）

## gltf/node_modules/@dabh/diagnostics/logger/（未归类）

待归类：请确认用途后归档。

- `console.js`（1KB）

## gltf/node_modules/@dabh/diagnostics/modifiers/（未归类）

待归类：请确认用途后归档。

- `namespace-ansi.js`（1KB）
- `namespace.js`（1KB）

## gltf/node_modules/@dabh/diagnostics/node/（未归类）

待归类：请确认用途后归档。

- `development.js`（1KB）
- `index.js`（0KB）　— Select the correct build version depending on the environment.
- `override.js`（0KB）　— Override the existing `debug` call so it will use `diagnostics` instead
- `production.js`（1KB）

## gltf/node_modules/@donmccurdy/caporal/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）
- `package.json`（3KB）

## gltf/node_modules/@donmccurdy/caporal/dist/（未归类）

待归类：请确认用途后归档。

- `caporal.modern.js`（76KB）
- `index.d.ts`（2KB）
- `types.d.ts`（10KB）
- `web.d.ts`（0KB）　— <amd-module name="@caporal/core" />

## gltf/node_modules/@donmccurdy/caporal/dist/__tests__/（未归类）

待归类：请确认用途后归档。

- `issue-163.spec.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/argument/（未归类）

待归类：请确认用途后归档。

- `find.d.ts`（0KB）
- `index.d.ts`（0KB）
- `synopsis.d.ts`（0KB）
- `validate.d.ts`（1KB）

## gltf/node_modules/@donmccurdy/caporal/dist/argument/__tests__/（未归类）

待归类：请确认用途后归档。

- `argument.spec.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/command/（未归类）

待归类：请确认用途后归档。

- `find.d.ts`（0KB）
- `import.d.ts`（0KB）
- `index.d.ts`（6KB）
- `scan.d.ts`（0KB）
- `validate-call.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/command/__fixtures__/（未归类）

待归类：请确认用途后归档。

- `example-cmd.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/command/__tests__/（未归类）

待归类：请确认用途后归档。

- `command.spec.d.ts`（0KB）
- `find.test.d.ts`（0KB）
- `import.test.d.ts`（0KB）
- `scan.test.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/config/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/error/（未归类）

待归类：请确认用途后归档。

- `action.d.ts`（0KB）
- `base.d.ts`（0KB）
- `fatal.d.ts`（0KB）
- `index.d.ts`（0KB）
- `invalid-validator.d.ts`（0KB）
- `missing-argument.d.ts`（0KB）
- `missing-flag.d.ts`（0KB）
- `multi-validation.d.ts`（0KB）
- `no-action.d.ts`（0KB）
- `option-synopsis-syntax.d.ts`（0KB）
- `too-many-arguments.d.ts`（0KB）
- `unknown-command.d.ts`（0KB）
- `unknown-option.d.ts`（0KB）
- `validation.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/error/__tests__/（未归类）

待归类：请确认用途后归档。

- `fatal.spec.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/help/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `types.d.ts`（1KB）
- `utils.d.ts`（1KB）

## gltf/node_modules/@donmccurdy/caporal/dist/help/__tests__/（未归类）

待归类：请确认用途后归档。

- `help.spec.d.ts`（0KB）
- `help.test.d.ts`（0KB）
- `utils.test.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/help/templates/（未归类）

待归类：请确认用途后归档。

- `command.d.ts`（0KB）
- `custom.d.ts`（0KB）
- `header.d.ts`（0KB）
- `index.d.ts`（0KB）
- `program.d.ts`（0KB）
- `usage.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/logger/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/logger/__tests__/（未归类）

待归类：请确认用途后归档。

- `logger.spec.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/option/（未归类）

待归类：请确认用途后归档。

- `find.d.ts`（0KB）
- `index.d.ts`（2KB）
- `mapping.d.ts`（0KB）
- `utils.d.ts`（1KB）
- `validate.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/option/__tests__/（未归类）

待归类：请确认用途后归档。

- `global.test.d.ts`（0KB）
- `option.test.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/parser/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/parser/__tests__/（未归类）

待归类：请确认用途后归档。

- `parser.spec.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/program/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（11KB）　— <reference types="node" />

## gltf/node_modules/@donmccurdy/caporal/dist/program/__tests__/（未归类）

待归类：请确认用途后归档。

- `program.test.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/utils/（未归类）

待归类：请确认用途后归档。

- `colorize.d.ts`（0KB）
- `fs.d.ts`（0KB）
- `levenshtein.d.ts`（0KB）
- `suggest.d.ts`（0KB）
- `version.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/utils/__tests__/（未归类）

待归类：请确认用途后归档。

- `fs.test.d.ts`（0KB）
- `levenshtein.test.d.ts`（0KB）
- `suggest.test.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/utils/web/（未归类）

待归类：请确认用途后归档。

- `process.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/validator/（未归类）

待归类：请确认用途后归档。

- `array.d.ts`（0KB）
- `caporal.d.ts`（1KB）
- `function.d.ts`（0KB）
- `regexp.d.ts`（0KB）
- `utils.d.ts`（1KB）
- `validate.d.ts`（0KB）

## gltf/node_modules/@donmccurdy/caporal/dist/validator/__tests__/（未归类）

待归类：请确认用途后归档。

- `array.test.d.ts`（0KB）
- `caporal.spec.d.ts`（0KB）
- `function.spec.d.ts`（0KB）
- `regexp.test.d.ts`（0KB）
- `utils.spec.d.ts`（0KB）
- `validate.spec.d.ts`（0KB）

## gltf/node_modules/@emnapi/runtime/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）
- `index.js`（0KB）
- `package.json`（1KB）

## gltf/node_modules/@emnapi/runtime/dist/（未归类）

待归类：请确认用途后归档。

- `emnapi.cjs.js`（43KB）
- `emnapi.cjs.min.d.ts`（21KB）
- `emnapi.cjs.min.js`（21KB）
- `emnapi.d.mts`（21KB）
- `emnapi.d.ts`（21KB）
- `emnapi.esm-bundler.js`（52KB）　— @public
- `emnapi.iife.d.ts`（14KB）
- `emnapi.iife.js`（60KB）
- `emnapi.js`（61KB）
- `emnapi.min.d.mts`（21KB）
- `emnapi.min.js`（26KB）
- `emnapi.min.mjs`（21KB）
- `emnapi.mjs`（42KB）

## gltf/node_modules/@gltf-transform/cli/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（2KB）　— @gltf-transform/cli
- `package.json`（2KB）

## gltf/node_modules/@gltf-transform/cli/bin/（未归类）

待归类：请确认用途后归档。

- `cli.js`（0KB）

## gltf/node_modules/@gltf-transform/cli/dist/（未归类）

待归类：请确认用途后归档。

- `cli.d.mts`（9KB）　— #region src/program.d.ts
- `cli.mjs`（103KB）
- `cli.mjs.map`（187KB）

## gltf/node_modules/@gltf-transform/cli/src/（未归类）

待归类：请确认用途后归档。

- `cli.ts`（66KB）
- `config.ts`（2KB）
- `constants.ts`（0KB）　— Constants.
- `inspect.ts`（5KB）
- `program.ts`（5KB）
- `session.ts`（4KB）　— Helper class for managing a CLI command session.
- `validate.ts`（2KB）

## gltf/node_modules/@gltf-transform/cli/src/transforms/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `ktxdecompress.ts`（4KB）
- `ktxfix.ts`（1KB）
- `merge.ts`（3KB）
- `toktx.ts`（15KB）
- `xmp.ts`（11KB）

## gltf/node_modules/@gltf-transform/cli/src/types/（未归类）

待归类：请确认用途后归档。

- `global.d.ts`（0KB）　— See: https://github.com/KhronosGroup/glTF-Validator/issues/114

## gltf/node_modules/@gltf-transform/cli/src/utils/（未归类）

待归类：请确认用途后归档。

- `format.ts`（3KB）
- `gzip.ts`（0KB）
- `log.ts`（0KB）
- `match.ts`（0KB）　— Using 'micromatch' because 'contains: true' did not work as expected with
- `p-limit.ts`（1KB）
- `process.ts`（2KB）　— Mocks for tests.

## gltf/node_modules/@gltf-transform/core/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（1KB）　— @gltf-transform/core
- `package.json`（1KB）

## gltf/node_modules/@gltf-transform/core/dist/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（207KB）
- `index.cjs.map`（424KB）
- `index.d.cts`（135KB）　— #region src/constants.d.ts
- `index.d.ts`（135KB）　— #region src/constants.d.ts
- `index.js`（205KB）　— #region src/constants.ts
- `index.js.map`（424KB）

## gltf/node_modules/@gltf-transform/core/src/（未归类）

待归类：请确认用途后归档。

- `constants.ts`（4KB）
- `document.ts`（9KB）
- `extension.ts`（7KB）
- `index.ts`（1KB）
- `json-document.ts`（1KB）

## gltf/node_modules/@gltf-transform/core/src/io/（未归类）

待归类：请确认用途后归档。

- `deno-io.ts`（1KB）
- `index.ts`（0KB）
- `node-io.ts`（6KB）
- `platform-io.ts`（12KB）
- `reader-context.ts`（2KB）
- `reader.ts`（23KB）
- `web-io.ts`（2KB）
- `writer-context.ts`（10KB）
- `writer.ts`（30KB）

## gltf/node_modules/@gltf-transform/core/src/properties/（未归类）

待归类：请确认用途后归档。

- `accessor.ts`（19KB）
- `animation-channel.ts`（4KB）
- `animation-sampler.ts`（4KB）
- `animation.ts`（3KB）
- `buffer.ts`（4KB）
- `camera.ts`（5KB）
- `extensible-property.ts`（2KB）
- `extension-property.ts`（1KB）
- `index.ts`（1KB）
- `material.ts`（16KB）
- `mesh.ts`（3KB）
- `node.ts`（9KB）
- `primitive-target.ts`（2KB）
- `primitive.ts`（8KB）
- `property.ts`（10KB）
- `root.ts`（8KB）
- `scene.ts`（3KB）
- `skin.ts`（3KB）
- `texture-info.ts`（5KB）
- `texture.ts`（3KB）

## gltf/node_modules/@gltf-transform/core/src/types/（未归类）

待归类：请确认用途后归档。

- `gltf.ts`（18KB）

## gltf/node_modules/@gltf-transform/core/src/utils/（未归类）

待归类：请确认用途后归档。

- `buffer-utils.ts`（3KB）
- `color-utils.ts`（2KB）
- `file-utils.ts`（1KB）
- `get-bounds.ts`（2KB）　— @hidden Implemented in /core for use by /extensions, publicly exported from /functions.
- `http-utils.ts`（2KB）　— Need a placeholder domain to construct a URL from a relative path. We only
- `image-utils.ts`（5KB）　— Implements support for an image format in the {@link ImageUtils} class.
- `index.ts`（0KB）
- `is-plain-object.ts`（1KB）　— Reference: https://github.com/jonschlinkert/is-plain-object
- `logger.ts`（2KB）　— Logger verbosity thresholds.
- `math-utils.ts`（5KB）　— @hidden
- `property-utils.ts`（3KB）
- `uuid.ts`（1KB）

## gltf/node_modules/@gltf-transform/extensions/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（1KB）　— @gltf-transform/extensions
- `package.json`（1KB）

## gltf/node_modules/@gltf-transform/extensions/dist/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（259KB）
- `index.cjs.map`（453KB）
- `index.d.cts`（137KB）　— #region src/constants.d.ts
- `index.d.ts`（137KB）　— #region src/constants.d.ts
- `index.js`（252KB）　— #region src/constants.ts
- `index.js.map`（448KB）

## gltf/node_modules/@gltf-transform/extensions/src/（未归类）

待归类：请确认用途后归档。

- `constants.ts`（2KB）
- `index.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-mesh-features/（未归类）

待归类：请确认用途后归档。

- `feature-id-texture.ts`（2KB）
- `feature-id.ts`（2KB）
- `features.ts`（1KB）
- `index.ts`（0KB）
- `mesh-features.ts`（8KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-mesh-gpu-instancing/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `instanced-mesh.ts`（2KB）
- `mesh-gpu-instancing.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-meshopt-compression/（未归类）

待归类：请确认用途后归档。

- `constants.ts`（1KB）
- `decoder.ts`（1KB）
- `encoder.ts`（8KB）
- `index.ts`（0KB）
- `meshopt-compression.ts`（18KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-structural-metadata/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `metadata.ts`（26KB）
- `structural-metadata.ts`（37KB）
- `types.ts`（0KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-texture-avif/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `texture-avif.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/ext-texture-webp/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `texture-webp.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-accessor-float16/（未归类）

待归类：请确认用途后归档。

- `accessor-float16.ts`（2KB）
- `index.ts`（0KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-accessor-float64/（未归类）

待归类：请确认用途后归档。

- `accessor-float64.ts`（2KB）
- `index.ts`（0KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-draco-mesh-compression/（未归类）

待归类：请确认用途后归档。

- `decoder.ts`（4KB）
- `draco-mesh-compression.ts`（19KB）
- `encoder.ts`（6KB）
- `index.ts`（0KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-lights-punctual/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `light.ts`（4KB）
- `lights-punctual.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-anisotropy/（未归类）

待归类：请确认用途后归档。

- `anisotropy.ts`（3KB）
- `index.ts`（0KB）
- `materials-anisotropy.ts`（6KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-clearcoat/（未归类）

待归类：请确认用途后归档。

- `clearcoat.ts`（6KB）
- `index.ts`（0KB）
- `materials-clearcoat.ts`（6KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-diffuse-transmission/（未归类）

待归类：请确认用途后归档。

- `diffuse-transmission.ts`（5KB）
- `index.ts`（0KB）
- `materials-diffuse-transmission.ts`（6KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-dispersion/（未归类）

待归类：请确认用途后归档。

- `dispersion.ts`（1KB）
- `index.ts`（0KB）
- `materials-dispersion.ts`（4KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-emissive-strength/（未归类）

待归类：请确认用途后归档。

- `emissive-strength.ts`（1KB）
- `index.ts`（0KB）
- `materials-emissive-strength.ts`（5KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-ior/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `ior.ts`（1KB）
- `materials-ior.ts`（3KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-iridescence/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `iridescence.ts`（5KB）
- `materials-iridescence.ts`（7KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-pbr-specular-glossiness/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-pbr-specular-glossiness.ts`（6KB）
- `pbr-specular-glossiness.ts`（4KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-sheen/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-sheen.ts`（5KB）
- `sheen.ts`（4KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-specular/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-specular.ts`（5KB）
- `specular.ts`（4KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-transmission/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-transmission.ts`（5KB）
- `transmission.ts`（3KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-unlit/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-unlit.ts`（3KB）
- `unlit.ts`（1KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-variants/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `mapping-list.ts`（1KB）
- `mapping.ts`（2KB）
- `materials-variants.ts`（7KB）
- `variant.ts`（1KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-materials-volume/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `materials-volume.ts`（6KB）
- `volume.ts`（4KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-mesh-primitive-restart/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `mesh-primitive-restart.ts`（3KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-mesh-quantization/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `mesh-quantization.ts`（2KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-node-visibility/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `node-visibility.ts`（2KB）
- `visibility.ts`（1KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-texture-basisu/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `texture-basisu.ts`（8KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-texture-transform/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `texture-transform.ts`（4KB）
- `transform.ts`（2KB）

## gltf/node_modules/@gltf-transform/extensions/src/khr-xmp-json-ld/（未归类）

待归类：请确认用途后归档。

- `index.ts`（0KB）
- `packet.ts`（5KB）
- `xmp.ts`（7KB）

## gltf/node_modules/@gltf-transform/functions/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（1KB）　— @gltf-transform/functions
- `package.json`（1KB）

## gltf/node_modules/@gltf-transform/functions/dist/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（233KB）
- `index.cjs.map`（532KB）
- `index.d.cts`（71KB）　— #region src/center.d.ts
- `index.d.ts`（71KB）　— #region src/center.d.ts
- `index.js`（226KB）　— #region src/utils.ts
- `index.js.map`（528KB）

## gltf/node_modules/@gltf-transform/functions/src/（未归类）

待归类：请确认用途后归档。

- `center.ts`（2KB）　— Options for the {@link center} function.
- `clean-primitive.ts`（1KB）
- `clear-node-parent.ts`（1KB）
- `clear-node-transform.ts`（1KB）　— biome-ignore format: Readability.
- `compact-primitive.ts`（6KB）
- `convert-primitive-mode.ts`（5KB）
- `dedup.ts`（13KB）
- `dequantize.ts`（3KB）
- `document-utils.ts`（12KB）
- `draco.ts`（3KB）
- `flatten.ts`（3KB）　— Options for the {@link flatten} function.
- `get-bounds.ts`（0KB）
- `get-texture-color-space.ts`（1KB）
- `get-vertex-count.ts`（9KB）
- `hash-table.ts`（3KB）　— Flags 'empty' values in a Uint32Array index.
- `index.ts`（2KB）
- `inspect.ts`（9KB）
- `instance.ts`（6KB）
- `join-primitives.ts`（6KB）
- `join.ts`（9KB）
- `list-node-scenes.ts`（1KB）
- `list-texture-channels.ts`（2KB）
- `list-texture-info.ts`（2KB）
- `list-texture-slots.ts`（1KB）
- `meshopt.ts`（3KB）
- `metal-rough.ts`（5KB）
- `normals.ts`（3KB）　— Options for the {@link normals} function.
- `palette.ts`（12KB）
- `partition.ts`（4KB）
- `prune.ts`（17KB）
- `quantize.ts`（22KB）
- `reorder.ts`（5KB）　— Options for the {@link reorder} function.
- `resample.ts`（7KB）
- `sequence.ts`（3KB）
- `simplify.ts`（8KB）
- `sort-primitive-weights.ts`（7KB）
- `sparse.ts`（2KB）　— Options for the {@link sparse} function.
- `tangents.ts`（6KB）
- `texture-compress.ts`（14KB）
- `transform-mesh.ts`（2KB）
- `transform-primitive.ts`（6KB）
- `uninstance.ts`（5KB）
- `unlit.ts`（0KB）
- `unpartition.ts`（1KB）
- `unweld.ts`（3KB）
- `unwrap.ts`（12KB）
- `utils.ts`（12KB）
- `vertex-color-space.ts`（2KB）　— Options for the {@link vertexColorSpace} function.
- `weld.ts`（6KB）

## gltf/node_modules/@gltf-transform/functions/src/types/（未归类）

待归类：请确认用途后归档。

- `.gitkeep`（0KB）

## gltf/node_modules/@img/colour/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（4KB）　— Licensing
- `README.md`（1KB）　— `@img/colour`
- `color.cjs`（44KB）
- `index.cjs`（0KB）
- `index.d.ts`（21KB）　— Generated by dts-bundle-generator v9.5.1
- `package.json`（1KB）

## gltf/node_modules/@img/sharp-wasm32/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（10KB）
- `README.md`（4KB）　— `@img/sharp-wasm32`
- `index.cjs`（0KB）
- `package.json`（1KB）
- `versions.json`（0KB）

## gltf/node_modules/@img/sharp-wasm32/lib/（未归类）

待归类：请确认用途后归档。

- `sharp-wasm32-0.35.5.node.js`（156KB）
- `sharp-wasm32-0.35.5.node.wasm`（8936KB）

## gltf/node_modules/@img/sharp-win32-x64/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（10KB）
- `README.md`（5KB）　— `@img/sharp-win32-x64`
- `index.cjs`（0KB）
- `package.json`（1KB）
- `versions.json`（1KB）

## gltf/node_modules/@img/sharp-win32-x64/lib/（未归类）

待归类：请确认用途后归档。

- `libvips-42.dll`（18572KB）
- `libvips-cpp-8.18.7.dll`（326KB）
- `sharp-win32-x64-0.35.5.node`（434KB）

## gltf/node_modules/@isaacs/cliui/（未归类）

待归类：请确认用途后归档。

- `LICENSE.txt`（1KB）
- `README.md`（3KB）　— @isaacs/cliui
- `index.mjs`（0KB）　— Bootstrap cliui with ESM dependencies:
- `package.json`（2KB）

## gltf/node_modules/@isaacs/cliui/build/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（10KB）
- `index.d.cts`（1KB）

## gltf/node_modules/@isaacs/cliui/build/lib/（未归类）

待归类：请确认用途后归档。

- `index.js`（10KB）

## gltf/node_modules/@isaacs/cliui/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（4KB）　— emoji-regex [![Build status](https://travis-ci.org/mathiasbynens/emoji-regex.svg?branch=…
- `RGI_Emoji.d.ts`（0KB）
- `RGI_Emoji.js`（13KB）
- `index.d.ts`（0KB）
- `index.js`（15KB）
- `package.json`（1KB）
- `text.d.ts`（0KB）
- `text.js`（14KB）

## gltf/node_modules/@isaacs/cliui/node_modules/emoji-regex/es2015/（未归类）

待归类：请确认用途后归档。

- `RGI_Emoji.d.ts`（0KB）
- `RGI_Emoji.js`（14KB）
- `index.d.ts`（0KB）
- `index.js`（17KB）
- `text.d.ts`（0KB）
- `text.js`（15KB）

## gltf/node_modules/@isaacs/cliui/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— string-width

## gltf/node_modules/@pkgjs/parseargs/（未归类）

待归类：请确认用途后归档。

- `.editorconfig`（0KB）　— EditorConfig is awesome: http://EditorConfig.org
- `CHANGELOG.md`（7KB）　— Changelog
- `LICENSE`（11KB）
- `README.md`（13KB）
- `index.js`（13KB）
- `package.json`（1KB）
- `utils.js`（6KB）

## gltf/node_modules/@pkgjs/parseargs/examples/（未归类）

待归类：请确认用途后归档。

- `is-default-value.js`（1KB）　— This example shows how to understand if a default value is used or not.
- `limit-long-syntax.js`（1KB）　— This is an example of using tokens to add a custom behaviour.
- `negate.js`（1KB）　— This example is used in the documentation.
- `no-repeated-options.js`（1KB）　— This is an example of using tokens to add a custom behaviour.
- `ordered-options.mjs`（1KB）　— This is an example of using tokens to add a custom behaviour.
- `simple-hard-coded.js`（1KB）　— This example is used in the documentation.

## gltf/node_modules/@pkgjs/parseargs/internal/（未归类）

待归类：请确认用途后归档。

- `errors.js`（1KB）
- `primordials.js`（12KB）
- `util.js`（0KB）　— This is a placeholder for util.js in node.js land.
- `validators.js`（2KB）　— This file is a proxy of the original file located at:

## gltf/node_modules/@so-ric/colorspace/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（0KB）　— CHANGELOG
- `LICENSE.md`（1KB）
- `README.md`（1KB）
- `index.js`（1KB）
- `package.json`（1KB）
- `rollup.config.js`（1KB）

## gltf/node_modules/@so-ric/colorspace/dist/（未归类）

待归类：请确认用途后归档。

- `index.cjs.js`（46KB）

## gltf/node_modules/@types/braces/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（4KB）
- `package.json`（1KB）

## gltf/node_modules/@types/glob/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（3KB）　— Type definitions for glob 8.1
- `package.json`（1KB）

## gltf/node_modules/@types/lodash/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `add.d.ts`（0KB）
- `after.d.ts`（0KB）
- `ary.d.ts`（0KB）
- `assign.d.ts`（0KB）
- `assignIn.d.ts`（0KB）
- `assignInWith.d.ts`（0KB）
- `assignWith.d.ts`（0KB）
- `at.d.ts`（0KB）
- `attempt.d.ts`（0KB）
- `before.d.ts`（0KB）
- `bind.d.ts`（0KB）
- `bindAll.d.ts`（0KB）
- `bindKey.d.ts`（0KB）
- `camelCase.d.ts`（0KB）
- `capitalize.d.ts`（0KB）
- `castArray.d.ts`（0KB）
- `ceil.d.ts`（0KB）
- `chain.d.ts`（0KB）
- `chunk.d.ts`（0KB）
- `clamp.d.ts`（0KB）
- `clone.d.ts`（0KB）
- `cloneDeep.d.ts`（0KB）
- `cloneDeepWith.d.ts`（0KB）
- `cloneWith.d.ts`（0KB）
- `compact.d.ts`（0KB）
- `concat.d.ts`（0KB）
- `cond.d.ts`（0KB）
- `conforms.d.ts`（0KB）
- `conformsTo.d.ts`（0KB）
- `constant.d.ts`（0KB）
- `countBy.d.ts`（0KB）
- `create.d.ts`（0KB）
- `curry.d.ts`（0KB）
- `curryRight.d.ts`（0KB）
- `debounce.d.ts`（0KB）
- `deburr.d.ts`（0KB）
- `defaultTo.d.ts`（0KB）
- `defaults.d.ts`（0KB）
- `defaultsDeep.d.ts`（0KB）
- `defer.d.ts`（0KB）
- `delay.d.ts`（0KB）
- `difference.d.ts`（0KB）
- `differenceBy.d.ts`（0KB）
- `differenceWith.d.ts`（0KB）
- `divide.d.ts`（0KB）
- `drop.d.ts`（0KB）
- `dropRight.d.ts`（0KB）
- `dropRightWhile.d.ts`（0KB）
- `dropWhile.d.ts`（0KB）
- `each.d.ts`（0KB）
- `eachRight.d.ts`（0KB）
- `endsWith.d.ts`（0KB）
- `entries.d.ts`（0KB）
- `entriesIn.d.ts`（0KB）
- `eq.d.ts`（0KB）
- `escape.d.ts`（0KB）
- `escapeRegExp.d.ts`（0KB）
- `every.d.ts`（0KB）
- `extend.d.ts`（0KB）
- `extendWith.d.ts`（0KB）
- `fill.d.ts`（0KB）
- `filter.d.ts`（0KB）
- `find.d.ts`（0KB）
- `findIndex.d.ts`（0KB）
- `findKey.d.ts`（0KB）
- `findLast.d.ts`（0KB）
- `findLastIndex.d.ts`（0KB）
- `findLastKey.d.ts`（0KB）
- `first.d.ts`（0KB）
- `flatMap.d.ts`（0KB）
- `flatMapDeep.d.ts`（0KB）
- `flatMapDepth.d.ts`（0KB）
- `flatten.d.ts`（0KB）
- `flattenDeep.d.ts`（0KB）
- `flattenDepth.d.ts`（0KB）
- `flip.d.ts`（0KB）
- `floor.d.ts`（0KB）
- `flow.d.ts`（0KB）
- `flowRight.d.ts`（0KB）
- `forEach.d.ts`（0KB）
- `forEachRight.d.ts`（0KB）
- `forIn.d.ts`（0KB）
- `forInRight.d.ts`（0KB）
- `forOwn.d.ts`（0KB）
- `forOwnRight.d.ts`（0KB）
- `fp.d.ts`（357KB）　— AUTO-GENERATED: do not modify this file directly.
- `fromPairs.d.ts`（0KB）
- `functions.d.ts`（0KB）
- `functionsIn.d.ts`（0KB）
- `get.d.ts`（0KB）
- `groupBy.d.ts`（0KB）
- `gt.d.ts`（0KB）
- `gte.d.ts`（0KB）
- `has.d.ts`（0KB）
- `hasIn.d.ts`（0KB）
- `head.d.ts`（0KB）
- `identity.d.ts`（0KB）
- `inRange.d.ts`（0KB）
- `includes.d.ts`（0KB）
- `index.d.ts`（1KB）　— <reference path="./common/common.d.ts" />
- `indexOf.d.ts`（0KB）
- `initial.d.ts`（0KB）
- `intersection.d.ts`（0KB）
- `intersectionBy.d.ts`（0KB）
- `intersectionWith.d.ts`（0KB）
- `invert.d.ts`（0KB）
- `invertBy.d.ts`（0KB）
- `invoke.d.ts`（0KB）
- `invokeMap.d.ts`（0KB）
- `isArguments.d.ts`（0KB）
- `isArray.d.ts`（0KB）
- `isArrayBuffer.d.ts`（0KB）
- `isArrayLike.d.ts`（0KB）
- `isArrayLikeObject.d.ts`（0KB）
- `isBoolean.d.ts`（0KB）
- `isBuffer.d.ts`（0KB）
- `isDate.d.ts`（0KB）
- `isElement.d.ts`（0KB）
- `isEmpty.d.ts`（0KB）
- `isEqual.d.ts`（0KB）
- `isEqualWith.d.ts`（0KB）
- `isError.d.ts`（0KB）
- `isFinite.d.ts`（0KB）
- `isFunction.d.ts`（0KB）
- `isInteger.d.ts`（0KB）
- `isLength.d.ts`（0KB）
- `isMap.d.ts`（0KB）
- `isMatch.d.ts`（0KB）
- `isMatchWith.d.ts`（0KB）
- `isNaN.d.ts`（0KB）
- `isNative.d.ts`（0KB）
- `isNil.d.ts`（0KB）
- `isNull.d.ts`（0KB）
- `isNumber.d.ts`（0KB）
- `isObject.d.ts`（0KB）
- `isObjectLike.d.ts`（0KB）
- `isPlainObject.d.ts`（0KB）
- `isRegExp.d.ts`（0KB）
- `isSafeInteger.d.ts`（0KB）
- `isSet.d.ts`（0KB）
- `isString.d.ts`（0KB）
- `isSymbol.d.ts`（0KB）
- `isTypedArray.d.ts`（0KB）
- `isUndefined.d.ts`（0KB）
- `isWeakMap.d.ts`（0KB）
- `isWeakSet.d.ts`（0KB）
- `iteratee.d.ts`（0KB）
- `join.d.ts`（0KB）
- `kebabCase.d.ts`（0KB）
- `keyBy.d.ts`（0KB）
- `keys.d.ts`（0KB）
- `keysIn.d.ts`（0KB）
- `last.d.ts`（0KB）
- `lastIndexOf.d.ts`（0KB）
- `lowerCase.d.ts`（0KB）
- `lowerFirst.d.ts`（0KB）
- `lt.d.ts`（0KB）
- `lte.d.ts`（0KB）
- `map.d.ts`（0KB）
- `mapKeys.d.ts`（0KB）
- `mapValues.d.ts`（0KB）
- `matches.d.ts`（0KB）
- `matchesProperty.d.ts`（0KB）
- `max.d.ts`（0KB）
- `maxBy.d.ts`（0KB）
- `mean.d.ts`（0KB）
- `meanBy.d.ts`（0KB）
- `memoize.d.ts`（0KB）
- `merge.d.ts`（0KB）
- `mergeWith.d.ts`（0KB）
- `method.d.ts`（0KB）
- `methodOf.d.ts`（0KB）
- `min.d.ts`（0KB）
- `minBy.d.ts`（0KB）
- `mixin.d.ts`（0KB）
- `multiply.d.ts`（0KB）
- `negate.d.ts`（0KB）
- `noConflict.d.ts`（0KB）
- `noop.d.ts`（0KB）
- `now.d.ts`（0KB）
- `nth.d.ts`（0KB）
- `nthArg.d.ts`（0KB）
- `omit.d.ts`（0KB）
- `omitBy.d.ts`（0KB）
- `once.d.ts`（0KB）
- `orderBy.d.ts`（0KB）
- `over.d.ts`（0KB）
- `overArgs.d.ts`（0KB）
- `overEvery.d.ts`（0KB）
- `overSome.d.ts`（0KB）
- `package.json`（2KB）
- `pad.d.ts`（0KB）
- `padEnd.d.ts`（0KB）
- `padStart.d.ts`（0KB）
- `parseInt.d.ts`（0KB）
- `partial.d.ts`（0KB）
- `partialRight.d.ts`（0KB）
- `partition.d.ts`（0KB）
- `pick.d.ts`（0KB）
- `pickBy.d.ts`（0KB）
- `property.d.ts`（0KB）
- `propertyOf.d.ts`（0KB）
- `pull.d.ts`（0KB）
- `pullAll.d.ts`（0KB）
- `pullAllBy.d.ts`（0KB）
- `pullAllWith.d.ts`（0KB）
- `pullAt.d.ts`（0KB）
- `random.d.ts`（0KB）
- `range.d.ts`（0KB）
- `rangeRight.d.ts`（0KB）
- `rearg.d.ts`（0KB）
- `reduce.d.ts`（0KB）
- `reduceRight.d.ts`（0KB）
- `reject.d.ts`（0KB）
- `remove.d.ts`（0KB）
- `repeat.d.ts`（0KB）
- `replace.d.ts`（0KB）
- `rest.d.ts`（0KB）
- `result.d.ts`（0KB）
- `reverse.d.ts`（0KB）
- `round.d.ts`（0KB）
- `runInContext.d.ts`（0KB）
- `sample.d.ts`（0KB）
- `sampleSize.d.ts`（0KB）
- `set.d.ts`（0KB）
- `setWith.d.ts`（0KB）
- `shuffle.d.ts`（0KB）
- `size.d.ts`（0KB）
- `slice.d.ts`（0KB）
- `snakeCase.d.ts`（0KB）
- `some.d.ts`（0KB）
- `sortBy.d.ts`（0KB）
- `sortedIndex.d.ts`（0KB）
- `sortedIndexBy.d.ts`（0KB）
- `sortedIndexOf.d.ts`（0KB）
- `sortedLastIndex.d.ts`（0KB）
- `sortedLastIndexBy.d.ts`（0KB）
- `sortedLastIndexOf.d.ts`（0KB）
- `sortedUniq.d.ts`（0KB）
- `sortedUniqBy.d.ts`（0KB）
- `split.d.ts`（0KB）
- `spread.d.ts`（0KB）
- `startCase.d.ts`（0KB）
- `startsWith.d.ts`（0KB）
- `stubArray.d.ts`（0KB）
- `stubFalse.d.ts`（0KB）
- `stubObject.d.ts`（0KB）
- `stubString.d.ts`（0KB）
- `stubTrue.d.ts`（0KB）
- `subtract.d.ts`（0KB）
- `sum.d.ts`（0KB）
- `sumBy.d.ts`（0KB）
- `tail.d.ts`（0KB）
- `take.d.ts`（0KB）
- `takeRight.d.ts`（0KB）
- `takeRightWhile.d.ts`（0KB）
- `takeWhile.d.ts`（0KB）
- `tap.d.ts`（0KB）
- `template.d.ts`（0KB）
- `throttle.d.ts`（0KB）
- `thru.d.ts`（0KB）
- `times.d.ts`（0KB）
- `toArray.d.ts`（0KB）
- `toFinite.d.ts`（0KB）
- `toInteger.d.ts`（0KB）
- `toLength.d.ts`（0KB）
- `toLower.d.ts`（0KB）
- `toNumber.d.ts`（0KB）
- `toPairs.d.ts`（0KB）
- `toPairsIn.d.ts`（0KB）
- `toPath.d.ts`（0KB）
- `toPlainObject.d.ts`（0KB）
- `toSafeInteger.d.ts`（0KB）
- `toString.d.ts`（0KB）
- `toUpper.d.ts`（0KB）
- `transform.d.ts`（0KB）
- `trim.d.ts`（0KB）
- `trimEnd.d.ts`（0KB）
- `trimStart.d.ts`（0KB）
- `truncate.d.ts`（0KB）
- `unary.d.ts`（0KB）
- `unescape.d.ts`（0KB）
- `union.d.ts`（0KB）
- `unionBy.d.ts`（0KB）
- `unionWith.d.ts`（0KB）
- `uniq.d.ts`（0KB）
- `uniqBy.d.ts`（0KB）
- `uniqWith.d.ts`（0KB）
- `uniqueId.d.ts`（0KB）
- `unset.d.ts`（0KB）
- `unzip.d.ts`（0KB）
- `unzipWith.d.ts`（0KB）
- `update.d.ts`（0KB）
- `updateWith.d.ts`（0KB）
- `upperCase.d.ts`（0KB）
- `upperFirst.d.ts`（0KB）
- `values.d.ts`（0KB）
- `valuesIn.d.ts`（0KB）
- `without.d.ts`（0KB）
- `words.d.ts`（0KB）
- `wrap.d.ts`（0KB）
- `xor.d.ts`（0KB）
- `xorBy.d.ts`（0KB）
- `xorWith.d.ts`（0KB）
- `zip.d.ts`（0KB）
- `zipObject.d.ts`（0KB）
- `zipObjectDeep.d.ts`（0KB）
- `zipWith.d.ts`（0KB）

## gltf/node_modules/@types/lodash/common/（未归类）

待归类：请确认用途后归档。

- `array.d.ts`（74KB）　— Helper types to reject readonly arrays
- `collection.d.ts`（66KB）
- `common.d.ts`（16KB）　— eslint-disable-next-line @definitelytyped/strict-export-declare-modifiers
- `date.d.ts`（1KB）
- `function.d.ts`（63KB）
- `lang.d.ts`（48KB）　— eslint-disable-next-line @definitelytyped/strict-export-declare-modifiers, @typescript-e…
- `math.d.ts`（11KB）
- `number.d.ts`（4KB）
- `object.d.ts`（100KB）
- `seq.d.ts`（5KB）
- `string.d.ts`（24KB）
- `util.d.ts`（41KB）

## gltf/node_modules/@types/lodash/fp/（未归类）

待归类：请确认用途后归档。

- `F.d.ts`（0KB）
- `T.d.ts`（0KB）
- `__.d.ts`（0KB）
- `add.d.ts`（0KB）
- `after.d.ts`（0KB）
- `all.d.ts`（0KB）
- `allPass.d.ts`（0KB）
- `always.d.ts`（0KB）
- `any.d.ts`（0KB）
- `anyPass.d.ts`（0KB）
- `apply.d.ts`（0KB）
- `ary.d.ts`（0KB）
- `assign.d.ts`（0KB）
- `assignAll.d.ts`（0KB）
- `assignAllWith.d.ts`（0KB）
- `assignIn.d.ts`（0KB）
- `assignInAll.d.ts`（0KB）
- `assignInAllWith.d.ts`（0KB）
- `assignInWith.d.ts`（0KB）
- `assignWith.d.ts`（0KB）
- `assoc.d.ts`（0KB）
- `assocPath.d.ts`（0KB）
- `at.d.ts`（0KB）
- `attempt.d.ts`（0KB）
- `before.d.ts`（0KB）
- `bind.d.ts`（0KB）
- `bindAll.d.ts`（0KB）
- `bindKey.d.ts`（0KB）
- `camelCase.d.ts`（0KB）
- `capitalize.d.ts`（0KB）
- `castArray.d.ts`（0KB）
- `ceil.d.ts`（0KB）
- `chunk.d.ts`（0KB）
- `clamp.d.ts`（0KB）
- `clone.d.ts`（0KB）
- `cloneDeep.d.ts`（0KB）
- `cloneDeepWith.d.ts`（0KB）
- `cloneWith.d.ts`（0KB）
- `compact.d.ts`（0KB）
- `complement.d.ts`（0KB）
- `compose.d.ts`（0KB）
- `concat.d.ts`（0KB）
- `cond.d.ts`（0KB）
- `conforms.d.ts`（0KB）
- `conformsTo.d.ts`（0KB）
- `constant.d.ts`（0KB）
- `contains.d.ts`（0KB）
- `convert.d.ts`（0KB）
- `countBy.d.ts`（0KB）
- `create.d.ts`（0KB）
- `curry.d.ts`（0KB）
- `curryN.d.ts`（0KB）
- `curryRight.d.ts`（0KB）
- `curryRightN.d.ts`（0KB）
- `debounce.d.ts`（0KB）
- `deburr.d.ts`（0KB）
- `defaultTo.d.ts`（0KB）
- `defaults.d.ts`（0KB）
- `defaultsAll.d.ts`（0KB）
- `defaultsDeep.d.ts`（0KB）
- `defaultsDeepAll.d.ts`（0KB）
- `defer.d.ts`（0KB）
- `delay.d.ts`（0KB）
- `difference.d.ts`（0KB）
- `differenceBy.d.ts`（0KB）
- `differenceWith.d.ts`（0KB）
- `dissoc.d.ts`（0KB）
- `dissocPath.d.ts`（0KB）
- `divide.d.ts`（0KB）
- `drop.d.ts`（0KB）
- `dropLast.d.ts`（0KB）
- `dropLastWhile.d.ts`（0KB）
- `dropRight.d.ts`（0KB）
- `dropRightWhile.d.ts`（0KB）
- `dropWhile.d.ts`（0KB）
- `each.d.ts`（0KB）
- `eachRight.d.ts`（0KB）
- `endsWith.d.ts`（0KB）
- `entries.d.ts`（0KB）
- `entriesIn.d.ts`（0KB）
- `eq.d.ts`（0KB）
- `equals.d.ts`（0KB）
- `escape.d.ts`（0KB）
- `escapeRegExp.d.ts`（0KB）
- `every.d.ts`（0KB）
- `extend.d.ts`（0KB）
- `extendAll.d.ts`（0KB）
- `extendAllWith.d.ts`（0KB）
- `extendWith.d.ts`（0KB）
- `fill.d.ts`（0KB）
- `filter.d.ts`（0KB）
- `find.d.ts`（0KB）
- `findFrom.d.ts`（0KB）
- `findIndex.d.ts`（0KB）
- `findIndexFrom.d.ts`（0KB）
- `findKey.d.ts`（0KB）
- `findLast.d.ts`（0KB）
- `findLastFrom.d.ts`（0KB）
- `findLastIndex.d.ts`（0KB）
- `findLastIndexFrom.d.ts`（0KB）
- `findLastKey.d.ts`（0KB）
- `first.d.ts`（0KB）
- `flatMap.d.ts`（0KB）
- `flatMapDeep.d.ts`（0KB）
- `flatMapDepth.d.ts`（0KB）
- `flatten.d.ts`（0KB）
- `flattenDeep.d.ts`（0KB）
- `flattenDepth.d.ts`（0KB）
- `flip.d.ts`（0KB）
- `floor.d.ts`（0KB）
- `flow.d.ts`（0KB）
- `flowRight.d.ts`（0KB）
- `forEach.d.ts`（0KB）
- `forEachRight.d.ts`（0KB）
- `forIn.d.ts`（0KB）
- `forInRight.d.ts`（0KB）
- `forOwn.d.ts`（0KB）
- `forOwnRight.d.ts`（0KB）
- `fromPairs.d.ts`（0KB）
- `functions.d.ts`（0KB）
- `functionsIn.d.ts`（0KB）
- `get.d.ts`（0KB）
- `getOr.d.ts`（0KB）
- `groupBy.d.ts`（0KB）
- `gt.d.ts`（0KB）
- `gte.d.ts`（0KB）
- `has.d.ts`（0KB）
- `hasIn.d.ts`（0KB）
- `head.d.ts`（0KB）
- `identical.d.ts`（0KB）
- `identity.d.ts`（0KB）
- `inRange.d.ts`（0KB）
- `includes.d.ts`（0KB）
- `includesFrom.d.ts`（0KB）
- `indexBy.d.ts`（0KB）
- `indexOf.d.ts`（0KB）
- `indexOfFrom.d.ts`（0KB）
- `init.d.ts`（0KB）
- `initial.d.ts`（0KB）
- `intersection.d.ts`（0KB）
- `intersectionBy.d.ts`（0KB）
- `intersectionWith.d.ts`（0KB）
- `invert.d.ts`（0KB）
- `invertBy.d.ts`（0KB）
- `invertObj.d.ts`（0KB）
- `invoke.d.ts`（0KB）
- `invokeArgs.d.ts`（0KB）
- `invokeArgsMap.d.ts`（0KB）
- `invokeMap.d.ts`（0KB）
- `isArguments.d.ts`（0KB）
- `isArray.d.ts`（0KB）
- `isArrayBuffer.d.ts`（0KB）
- `isArrayLike.d.ts`（0KB）
- `isArrayLikeObject.d.ts`（0KB）
- `isBoolean.d.ts`（0KB）
- `isBuffer.d.ts`（0KB）
- `isDate.d.ts`（0KB）
- `isElement.d.ts`（0KB）
- `isEmpty.d.ts`（0KB）
- `isEqual.d.ts`（0KB）
- `isEqualWith.d.ts`（0KB）
- `isError.d.ts`（0KB）
- `isFinite.d.ts`（0KB）
- `isFunction.d.ts`（0KB）
- `isInteger.d.ts`（0KB）
- `isLength.d.ts`（0KB）
- `isMap.d.ts`（0KB）
- `isMatch.d.ts`（0KB）
- `isMatchWith.d.ts`（0KB）
- `isNaN.d.ts`（0KB）
- `isNative.d.ts`（0KB）
- `isNil.d.ts`（0KB）
- `isNull.d.ts`（0KB）
- `isNumber.d.ts`（0KB）
- `isObject.d.ts`（0KB）
- `isObjectLike.d.ts`（0KB）
- `isPlainObject.d.ts`（0KB）
- `isRegExp.d.ts`（0KB）
- `isSafeInteger.d.ts`（0KB）
- `isSet.d.ts`（0KB）
- `isString.d.ts`（0KB）
- `isSymbol.d.ts`（0KB）
- `isTypedArray.d.ts`（0KB）
- `isUndefined.d.ts`（0KB）
- `isWeakMap.d.ts`（0KB）
- `isWeakSet.d.ts`（0KB）
- `iteratee.d.ts`（0KB）
- `join.d.ts`（0KB）
- `juxt.d.ts`（0KB）
- `kebabCase.d.ts`（0KB）
- `keyBy.d.ts`（0KB）
- `keys.d.ts`（0KB）
- `keysIn.d.ts`（0KB）
- `last.d.ts`（0KB）
- `lastIndexOf.d.ts`（0KB）
- `lastIndexOfFrom.d.ts`（0KB）
- `lowerCase.d.ts`（0KB）
- `lowerFirst.d.ts`（0KB）
- `lt.d.ts`（0KB）
- `lte.d.ts`（0KB）
- `map.d.ts`（0KB）
- `mapKeys.d.ts`（0KB）
- `mapValues.d.ts`（0KB）
- `matches.d.ts`（0KB）
- `matchesProperty.d.ts`（0KB）
- `max.d.ts`（0KB）
- `maxBy.d.ts`（0KB）
- `mean.d.ts`（0KB）
- `meanBy.d.ts`（0KB）
- `memoize.d.ts`（0KB）
- `merge.d.ts`（0KB）
- `mergeAll.d.ts`（0KB）
- `mergeAllWith.d.ts`（0KB）
- `mergeWith.d.ts`（0KB）
- `method.d.ts`（0KB）
- `methodOf.d.ts`（0KB）
- `min.d.ts`（0KB）
- `minBy.d.ts`（0KB）
- `multiply.d.ts`（0KB）
- `nAry.d.ts`（0KB）
- `negate.d.ts`（0KB）
- `noConflict.d.ts`（0KB）
- `noop.d.ts`（0KB）
- `now.d.ts`（0KB）
- `nth.d.ts`（0KB）
- `nthArg.d.ts`（0KB）
- `omit.d.ts`（0KB）
- `omitAll.d.ts`（0KB）
- `omitBy.d.ts`（0KB）
- `once.d.ts`（0KB）
- `orderBy.d.ts`（0KB）
- `over.d.ts`（0KB）
- `overArgs.d.ts`（0KB）
- `overEvery.d.ts`（0KB）
- `overSome.d.ts`（0KB）
- `pad.d.ts`（0KB）
- `padChars.d.ts`（0KB）
- `padCharsEnd.d.ts`（0KB）
- `padCharsStart.d.ts`（0KB）
- `padEnd.d.ts`（0KB）
- `padStart.d.ts`（0KB）
- `parseInt.d.ts`（0KB）
- `partial.d.ts`（0KB）
- `partialRight.d.ts`（0KB）
- `partition.d.ts`（0KB）
- `path.d.ts`（0KB）
- `pathEq.d.ts`（0KB）
- `pathOr.d.ts`（0KB）
- `paths.d.ts`（0KB）
- `pick.d.ts`（0KB）
- `pickAll.d.ts`（0KB）
- `pickBy.d.ts`（0KB）
- `pipe.d.ts`（0KB）
- `placeholder.d.ts`（0KB）
- `pluck.d.ts`（0KB）
- `prop.d.ts`（0KB）
- `propEq.d.ts`（0KB）
- `propOr.d.ts`（0KB）
- `property.d.ts`（0KB）
- `propertyOf.d.ts`（0KB）
- `props.d.ts`（0KB）
- `pull.d.ts`（0KB）
- `pullAll.d.ts`（0KB）
- `pullAllBy.d.ts`（0KB）
- `pullAllWith.d.ts`（0KB）
- `pullAt.d.ts`（0KB）
- `random.d.ts`（0KB）
- `range.d.ts`（0KB）
- `rangeRight.d.ts`（0KB）
- `rangeStep.d.ts`（0KB）
- `rangeStepRight.d.ts`（0KB）
- `rearg.d.ts`（0KB）
- `reduce.d.ts`（0KB）
- `reduceRight.d.ts`（0KB）
- `reject.d.ts`（0KB）
- `remove.d.ts`（0KB）
- `repeat.d.ts`（0KB）
- `replace.d.ts`（0KB）
- `rest.d.ts`（0KB）
- `restFrom.d.ts`（0KB）
- `result.d.ts`（0KB）
- `reverse.d.ts`（0KB）
- `round.d.ts`（0KB）
- `runInContext.d.ts`（0KB）
- `sample.d.ts`（0KB）
- `sampleSize.d.ts`（0KB）
- `set.d.ts`（0KB）
- `setWith.d.ts`（0KB）
- `shuffle.d.ts`（0KB）
- `size.d.ts`（0KB）
- `slice.d.ts`（0KB）
- `snakeCase.d.ts`（0KB）
- `some.d.ts`（0KB）
- `sortBy.d.ts`（0KB）
- `sortedIndex.d.ts`（0KB）
- `sortedIndexBy.d.ts`（0KB）
- `sortedIndexOf.d.ts`（0KB）
- `sortedLastIndex.d.ts`（0KB）
- `sortedLastIndexBy.d.ts`（0KB）
- `sortedLastIndexOf.d.ts`（0KB）
- `sortedUniq.d.ts`（0KB）
- `sortedUniqBy.d.ts`（0KB）
- `split.d.ts`（0KB）
- `spread.d.ts`（0KB）
- `spreadFrom.d.ts`（0KB）
- `startCase.d.ts`（0KB）
- `startsWith.d.ts`（0KB）
- `stubArray.d.ts`（0KB）
- `stubFalse.d.ts`（0KB）
- `stubObject.d.ts`（0KB）
- `stubString.d.ts`（0KB）
- `stubTrue.d.ts`（0KB）
- `subtract.d.ts`（0KB）
- `sum.d.ts`（0KB）
- `sumBy.d.ts`（0KB）
- `symmetricDifference.d.ts`（0KB）
- `symmetricDifferenceBy.d.ts`（0KB）
- `symmetricDifferenceWith.d.ts`（0KB）
- `tail.d.ts`（0KB）
- `take.d.ts`（0KB）
- `takeLast.d.ts`（0KB）
- `takeLastWhile.d.ts`（0KB）
- `takeRight.d.ts`（0KB）
- `takeRightWhile.d.ts`（0KB）
- `takeWhile.d.ts`（0KB）
- `tap.d.ts`（0KB）
- `template.d.ts`（0KB）
- `throttle.d.ts`（0KB）
- `thru.d.ts`（0KB）
- `times.d.ts`（0KB）
- `toArray.d.ts`（0KB）
- `toFinite.d.ts`（0KB）
- `toInteger.d.ts`（0KB）
- `toLength.d.ts`（0KB）
- `toLower.d.ts`（0KB）
- `toNumber.d.ts`（0KB）
- `toPairs.d.ts`（0KB）
- `toPairsIn.d.ts`（0KB）
- `toPath.d.ts`（0KB）
- `toPlainObject.d.ts`（0KB）
- `toSafeInteger.d.ts`（0KB）
- `toString.d.ts`（0KB）
- `toUpper.d.ts`（0KB）
- `transform.d.ts`（0KB）
- `trim.d.ts`（0KB）
- `trimChars.d.ts`（0KB）
- `trimCharsEnd.d.ts`（0KB）
- `trimCharsStart.d.ts`（0KB）
- `trimEnd.d.ts`（0KB）
- `trimStart.d.ts`（0KB）
- `truncate.d.ts`（0KB）
- `unapply.d.ts`（0KB）
- `unary.d.ts`（0KB）
- `unescape.d.ts`（0KB）
- `union.d.ts`（0KB）
- `unionBy.d.ts`（0KB）
- `unionWith.d.ts`（0KB）
- `uniq.d.ts`（0KB）
- `uniqBy.d.ts`（0KB）
- `uniqWith.d.ts`（0KB）
- `uniqueId.d.ts`（0KB）
- `unnest.d.ts`（0KB）
- `unset.d.ts`（0KB）
- `unzip.d.ts`（0KB）
- `unzipWith.d.ts`（0KB）
- `update.d.ts`（0KB）
- `updateWith.d.ts`（0KB）
- `upperCase.d.ts`（0KB）
- `upperFirst.d.ts`（0KB）
- `useWith.d.ts`（0KB）
- `values.d.ts`（0KB）
- `valuesIn.d.ts`（0KB）
- `where.d.ts`（0KB）
- `whereEq.d.ts`（0KB）
- `without.d.ts`（0KB）
- `words.d.ts`（0KB）
- `wrap.d.ts`（0KB）
- `xor.d.ts`（0KB）
- `xorBy.d.ts`（0KB）
- `xorWith.d.ts`（0KB）
- `zip.d.ts`（0KB）
- `zipAll.d.ts`（0KB）
- `zipObj.d.ts`（0KB）
- `zipObject.d.ts`（0KB）
- `zipObjectDeep.d.ts`（0KB）
- `zipWith.d.ts`（0KB）

## gltf/node_modules/@types/micromatch/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（22KB）　— TypeScript Version: 2.2
- `package.json`（1KB）

## gltf/node_modules/@types/minimatch/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（9KB）　— Type definitions for minimatch 5.1
- `package.json`（1KB）

## gltf/node_modules/@types/ndarray/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（2KB）
- `package.json`（1KB）

## gltf/node_modules/@types/node/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）　— Installation
- `assert.d.ts`（40KB）
- `async_hooks.d.ts`（22KB）
- `buffer.d.ts`（105KB）
- `child_process.d.ts`（67KB）
- `cluster.d.ts`（20KB）
- `console.d.ts`（18KB）
- `constants.d.ts`（1KB）　— @deprecated since v6.3.0 - use constants property exposed by the relevant module instead…
- `crypto.d.ts`（180KB）
- `dgram.d.ts`（26KB）
- `diagnostics_channel.d.ts`（8KB）
- `dns.d.ts`（29KB）
- `dom-events.d.ts`（5KB）
- `domain.d.ts`（8KB）
- `events.d.ts`（36KB）
- `fs.d.ts`（180KB）
- `globals.d.ts`（10KB）　— Declare "static" methods in Error
- `globals.global.d.ts`（0KB）
- `http.d.ts`（77KB）
- `http2.d.ts`（111KB）
- `https.d.ts`（23KB）
- `index.d.ts`（6KB）　— Type definitions for non-npm package Node.js 20.5
- `inspector.d.ts`（122KB）　— eslint-disable-next-line @definitelytyped/dt-header
- `module.d.ts`（10KB）
- `net.d.ts`（40KB）
- `os.d.ts`（18KB）
- `package.json`（7KB）
- `path.d.ts`（8KB）
- `perf_hooks.d.ts`（24KB）
- `process.d.ts`（72KB）
- `punycode.d.ts`（5KB）
- `querystring.d.ts`（6KB）
- `readline.d.ts`（22KB）
- `repl.d.ts`（19KB）
- `stream.d.ts`（79KB）
- `string_decoder.d.ts`（3KB）
- `test.d.ts`（57KB）
- `timers.d.ts`（12KB）
- `tls.d.ts`（55KB）
- `trace_events.d.ts`（8KB）
- `tty.d.ts`（10KB）
- `url.d.ts`（39KB）
- `util.d.ts`（83KB）
- `v8.d.ts`（26KB）
- `vm.d.ts`（38KB）
- `wasi.d.ts`（7KB）
- `worker_threads.d.ts`（33KB）
- `zlib.d.ts`（19KB）

## gltf/node_modules/@types/node/assert/（未归类）

待归类：请确认用途后归档。

- `strict.d.ts`（0KB）

## gltf/node_modules/@types/node/dns/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（17KB）

## gltf/node_modules/@types/node/fs/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（53KB）

## gltf/node_modules/@types/node/readline/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（6KB）

## gltf/node_modules/@types/node/stream/（未归类）

待归类：请确认用途后归档。

- `consumers.d.ts`（1KB）
- `promises.d.ts`（2KB）
- `web.d.ts`（13KB）

## gltf/node_modules/@types/node/timers/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（3KB）

## gltf/node_modules/@types/node/ts4.8/（未归类）

待归类：请确认用途后归档。

- `assert.d.ts`（40KB）
- `async_hooks.d.ts`（22KB）
- `buffer.d.ts`（105KB）
- `child_process.d.ts`（67KB）
- `cluster.d.ts`（20KB）
- `console.d.ts`（18KB）
- `constants.d.ts`（1KB）　— @deprecated since v6.3.0 - use constants property exposed by the relevant module instead…
- `crypto.d.ts`（180KB）
- `dgram.d.ts`（26KB）
- `diagnostics_channel.d.ts`（8KB）
- `dns.d.ts`（29KB）
- `dom-events.d.ts`（5KB）
- `domain.d.ts`（8KB）
- `events.d.ts`（36KB）
- `fs.d.ts`（180KB）
- `globals.d.ts`（10KB）　— Declare "static" methods in Error
- `globals.global.d.ts`（0KB）
- `http.d.ts`（77KB）
- `http2.d.ts`（111KB）
- `https.d.ts`（23KB）
- `index.d.ts`（4KB）　— NOTE: These definitions support NodeJS and TypeScript 4.8 and earlier.
- `inspector.d.ts`（122KB）　— eslint-disable-next-line @definitelytyped/dt-header
- `module.d.ts`（10KB）
- `net.d.ts`（40KB）
- `os.d.ts`（18KB）
- `path.d.ts`（8KB）
- `perf_hooks.d.ts`（24KB）
- `process.d.ts`（72KB）
- `punycode.d.ts`（5KB）
- `querystring.d.ts`（6KB）
- `readline.d.ts`（22KB）
- `repl.d.ts`（19KB）
- `stream.d.ts`（70KB）
- `string_decoder.d.ts`（3KB）
- `test.d.ts`（57KB）
- `timers.d.ts`（12KB）
- `tls.d.ts`（55KB）
- `trace_events.d.ts`（8KB）
- `tty.d.ts`（10KB）
- `url.d.ts`（39KB）
- `util.d.ts`（83KB）
- `v8.d.ts`（26KB）
- `vm.d.ts`（38KB）
- `wasi.d.ts`（7KB）
- `worker_threads.d.ts`（33KB）
- `zlib.d.ts`（19KB）

## gltf/node_modules/@types/node/ts4.8/assert/（未归类）

待归类：请确认用途后归档。

- `strict.d.ts`（0KB）

## gltf/node_modules/@types/node/ts4.8/dns/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（17KB）

## gltf/node_modules/@types/node/ts4.8/fs/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（53KB）

## gltf/node_modules/@types/node/ts4.8/readline/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（6KB）

## gltf/node_modules/@types/node/ts4.8/stream/（未归类）

待归类：请确认用途后归档。

- `consumers.d.ts`（1KB）
- `promises.d.ts`（2KB）
- `web.d.ts`（13KB）

## gltf/node_modules/@types/node/ts4.8/timers/（未归类）

待归类：请确认用途后归档。

- `promises.d.ts`（3KB）

## gltf/node_modules/@types/prompts/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（4KB）　— <reference types="node" />
- `package.json`（2KB）

## gltf/node_modules/@types/table/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（2KB）　— Type definitions for table 5.0
- `package.json`（1KB）

## gltf/node_modules/@types/tmp/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（7KB）
- `package.json`（1KB）

## gltf/node_modules/@types/triple-beam/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（0KB）
- `package.json`（1KB）

## gltf/node_modules/@types/wrap-ansi/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— Installation
- `index.d.ts`（1KB）
- `package.json`（1KB）

## gltf/node_modules/ajv/（未归类）

待归类：请确认用途后归档。

- `.tonic_example.js`（0KB）
- `LICENSE`（1KB）
- `README.md`（85KB）
- `package.json`（3KB）

## gltf/node_modules/ajv/dist/（未归类）

待归类：请确认用途后归档。

- `ajv.bundle.js`（267KB）
- `ajv.min.js`（117KB）　— ajv 6.14.0: Another JSON Schema Validator
- `ajv.min.js.map`（146KB）

## gltf/node_modules/ajv/lib/（未归类）

待归类：请确认用途后归档。

- `ajv.d.ts`（13KB）
- `ajv.js`（15KB）
- `cache.js`（0KB）
- `data.js`（1KB）
- `definition_schema.js`（1KB）
- `keyword.js`（4KB）

## gltf/node_modules/ajv/lib/compile/（未归类）

待归类：请确认用途后归档。

- `async.js`（3KB）
- `equal.js`（0KB）　— do NOT remove this file - it would break pre-compiled schemas
- `error_classes.js`（1KB）
- `formats.js`（12KB）
- `index.js`（11KB）
- `resolve.js`（8KB）
- `rules.js`（2KB）
- `schema_obj.js`（0KB）
- `ucs2length.js`（1KB）　— https://mathiasbynens.be/notes/javascript-encoding
- `util.js`（7KB）

## gltf/node_modules/ajv/lib/dot/（未归类）

待归类：请确认用途后归档。

- `_limit.jst`（4KB）
- `_limitItems.jst`（0KB）
- `_limitLength.jst`（0KB）
- `_limitProperties.jst`（0KB）
- `allOf.jst`（1KB）
- `anyOf.jst`（1KB）
- `coerce.def`（2KB）
- `comment.jst`（0KB）
- `const.jst`（0KB）
- `contains.jst`（1KB）
- `custom.jst`（5KB）
- `defaults.def`（1KB）
- `definitions.def`（4KB）
- `dependencies.jst`（2KB）
- `enum.jst`（1KB）
- `errors.def`（8KB）
- `format.jst`（3KB）
- `if.jst`（2KB）
- `items.jst`（3KB）
- `missing.def`（1KB）
- `multipleOf.jst`（1KB）
- `not.jst`（1KB）
- `oneOf.jst`（1KB）
- `pattern.jst`（1KB）
- `properties.jst`（8KB）
- `propertyNames.jst`（1KB）
- `ref.jst`（2KB）
- `required.jst`（3KB）
- `uniqueItems.jst`（2KB）
- `validate.jst`（8KB）

## gltf/node_modules/ajv/lib/dotjs/（未归类）

待归类：请确认用途后归档。

- `README.md`（0KB）
- `_limit.js`（7KB）
- `_limitItems.js`（3KB）
- `_limitLength.js`（3KB）
- `_limitProperties.js`（3KB）
- `allOf.js`（1KB）
- `anyOf.js`（3KB）
- `comment.js`（1KB）
- `const.js`（2KB）
- `contains.js`（3KB）
- `custom.js`（10KB）
- `dependencies.js`（8KB）
- `enum.js`（3KB）
- `format.js`（5KB）
- `if.js`（4KB）
- `index.js`（1KB）　— all requires must be explicit because browserify won't work with dynamic requires
- `items.js`（6KB）
- `multipleOf.js`（3KB）
- `not.js`（3KB）
- `oneOf.js`（3KB）
- `pattern.js`（3KB）
- `properties.js`（15KB）
- `propertyNames.js`（4KB）
- `ref.js`（5KB）
- `required.js`（12KB）
- `uniqueItems.js`（4KB）
- `validate.js`（20KB）

## gltf/node_modules/ajv/lib/refs/（未归类）

待归类：请确认用途后归档。

- `data.json`（1KB）
- `json-schema-draft-04.json`（4KB）
- `json-schema-draft-06.json`（4KB）
- `json-schema-draft-07.json`（5KB）
- `json-schema-secure.json`（3KB）

## gltf/node_modules/ajv/scripts/（未归类）

待归类：请确认用途后归档。

- `.eslintrc.yml`（0KB）
- `bundle.js`（2KB）
- `compile-dots.js`（2KB）　— compile doT templates to js functions
- `info`（0KB）
- `prepare-tests`（0KB）
- `publish-built-version`（1KB）
- `travis-gh-pages`（1KB）

## gltf/node_modules/ansi-escapes/（未归类）

待归类：请确认用途后归档。

- `base.d.ts`（7KB）　— From https://github.com/sindresorhus/type-fest
- `base.js`（5KB）
- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（6KB）　— ansi-escapes

## gltf/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— ansi-regex

## gltf/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（6KB）
- `index.js`（4KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（4KB）　— ansi-styles [![Build Status](https://travis-ci.org/chalk/ansi-styles.svg?branch=master)]…

## gltf/node_modules/astral-regex/（未归类）

待归类：请确认用途后归档。

- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— astral-regex [![Build Status](https://travis-ci.org/kevva/astral-regex.svg?branch=master…

## gltf/node_modules/async/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（33KB）　— v3.2.5
- `LICENSE`（1KB）
- `README.md`（3KB）
- `all.js`（3KB）
- `allLimit.js`（2KB）
- `allSeries.js`（2KB）
- `any.js`（4KB）
- `anyLimit.js`（2KB）
- `anySeries.js`（2KB）
- `apply.js`（0KB）
- `applyEach.js`（2KB）
- `applyEachSeries.js`（1KB）
- `asyncify.js`（4KB）
- `auto.js`（12KB）
- `autoInject.js`（7KB）
- `bower.json`（0KB）
- `cargo.js`（3KB）
- `cargoQueue.js`（3KB）
- `compose.js`（2KB）
- `concat.js`（4KB）
- `concatLimit.js`（2KB）
- `concatSeries.js`（1KB）
- `constant.js`（0KB）
- `detect.js`（3KB）
- `detectLimit.js`（2KB）
- `detectSeries.js`（2KB）
- `dir.js`（1KB）
- `doDuring.js`（2KB）
- `doUntil.js`（2KB）
- `doWhilst.js`（2KB）
- `during.js`（2KB）
- `each.js`（4KB）
- `eachLimit.js`（2KB）
- `eachOf.js`（6KB）
- `eachOfLimit.js`（2KB）
- `eachOfSeries.js`（1KB）
- `eachSeries.js`（2KB）
- `ensureAsync.js`（2KB）
- `every.js`（3KB）
- `everyLimit.js`（2KB）
- `everySeries.js`（2KB）
- `filter.js`（3KB）
- `filterLimit.js`（2KB）
- `filterSeries.js`（2KB）
- `find.js`（3KB）
- `findLimit.js`（2KB）
- `findSeries.js`（2KB）
- `flatMap.js`（4KB）
- `flatMapLimit.js`（2KB）
- `flatMapSeries.js`（1KB）
- `foldl.js`（5KB）
- `foldr.js`（1KB）
- `forEach.js`（4KB）
- `forEachLimit.js`（2KB）
- `forEachOf.js`（6KB）
- `forEachOfLimit.js`（2KB）
- `forEachOfSeries.js`（1KB）
- `forEachSeries.js`（2KB）
- `forever.js`（2KB）
- `groupBy.js`（4KB）
- `groupByLimit.js`（2KB）
- `groupBySeries.js`（1KB）
- `index.js`（19KB）
- `inject.js`（5KB）
- `log.js`（1KB）
- `map.js`（4KB）
- `mapLimit.js`（2KB）
- `mapSeries.js`（1KB）
- `mapValues.js`（4KB）
- `mapValuesLimit.js`（2KB）
- `mapValuesSeries.js`（1KB）
- `memoize.js`（3KB）
- `nextTick.js`（1KB）
- `package.json`（2KB）
- `parallel.js`（5KB）
- `parallelLimit.js`（1KB）
- `priorityQueue.js`（1KB）
- `queue.js`（1KB）
- `race.js`（2KB）
- `reduce.js`（5KB）
- `reduceRight.js`（1KB）
- `reflect.js`（2KB）
- `reflectAll.js`（2KB）
- `reject.js`（3KB）
- `rejectLimit.js`（2KB）
- `rejectSeries.js`（1KB）
- `retry.js`（5KB）
- `retryable.js`（2KB）
- `select.js`（3KB）
- `selectLimit.js`（2KB）
- `selectSeries.js`（2KB）
- `seq.js`（3KB）
- `series.js`（6KB）
- `setImmediate.js`（1KB）
- `some.js`（4KB）
- `someLimit.js`（2KB）
- `someSeries.js`（2KB）
- `sortBy.js`（6KB）
- `timeout.js`（3KB）
- `times.js`（1KB）
- `timesLimit.js`（1KB）
- `timesSeries.js`（1KB）
- `transform.js`（5KB）
- `tryEach.js`（2KB）
- `unmemoize.js`（1KB）
- `until.js`（2KB）
- `waterfall.js`（3KB）
- `whilst.js`（2KB）
- `wrapSync.js`（4KB）

## gltf/node_modules/async/dist/（未归类）

待归类：请确认用途后归档。

- `async.js`（220KB）
- `async.min.js`（21KB）
- `async.mjs`（196KB）

## gltf/node_modules/async/internal/（未归类）

待归类：请确认用途后归档。

- `DoublyLinkedList.js`（2KB）
- `Heap.js`（2KB）
- `applyEach.js`（1KB）
- `asyncEachOfLimit.js`（2KB）
- `awaitify.js`（1KB）
- `breakLoop.js`（0KB）
- `consoleFunc.js`（1KB）
- `createTester.js`（1KB）
- `eachOfLimit.js`（3KB）
- `filter.js`（2KB）
- `getIterator.js`（0KB）
- `initialParams.js`（0KB）
- `isArrayLike.js`（0KB）
- `iterator.js`（1KB）
- `map.js`（1KB）
- `once.js`（0KB）
- `onlyOnce.js`（0KB）
- `parallel.js`（1KB）
- `promiseCallback.js`（1KB）
- `queue.js`（8KB）
- `range.js`（0KB）
- `reject.js`（1KB）
- `setImmediate.js`（1KB）
- `withoutIndex.js`（0KB）
- `wrapAsync.js`（1KB）

## gltf/node_modules/balanced-match/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（3KB）　— balanced-match
- `index.js`（1KB）
- `package.json`（1KB）

## gltf/node_modules/balanced-match/.github/（未归类）

待归类：请确认用途后归档。

- `FUNDING.yml`（0KB）

## gltf/node_modules/brace-expansion/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（5KB）　— brace-expansion
- `index.js`（12KB）
- `package.json`（1KB）

## gltf/node_modules/brace-expansion/.github/（未归类）

待归类：请确认用途后归档。

- `FUNDING.yml`（0KB）

## gltf/node_modules/braces/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（21KB）　— braces [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.pay…
- `index.js`（4KB）
- `package.json`（2KB）

## gltf/node_modules/braces/lib/（未归类）

待归类：请确认用途后归档。

- `compile.js`（1KB）
- `constants.js`（2KB）
- `expand.js`（3KB）
- `parse.js`（7KB）
- `stringify.js`（1KB）
- `utils.js`（2KB）

## gltf/node_modules/chalk/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（8KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（12KB）

## gltf/node_modules/chalk/source/（未归类）

待归类：请确认用途后归档。

- `index.js`（6KB）
- `templates.js`（3KB）
- `util.js`（1KB）

## gltf/node_modules/cli-cursor/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— cli-cursor

## gltf/node_modules/cli-table3/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（8KB）
- `index.d.ts`（2KB）
- `index.js`（0KB）
- `package.json`（2KB）

## gltf/node_modules/cli-table3/src/（未归类）

待归类：请确认用途后归档。

- `cell.js`（13KB）
- `debug.js`（0KB）
- `layout-manager.js`（7KB）
- `table.js`（3KB）
- `utils.js`（8KB）

## gltf/node_modules/cli-truncate/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（3KB）
- `index.js`（3KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— cli-truncate

## gltf/node_modules/cli-truncate/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（4KB）　— emoji-regex [![Build status](https://github.com/mathiasbynens/emoji-regex/actions/workfl…
- `index.d.ts`（0KB）
- `index.js`（14KB）
- `index.mjs`（14KB）
- `package.json`（1KB）

## gltf/node_modules/cli-truncate/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— string-width

## gltf/node_modules/color/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（8KB）　— color
- `index.d.ts`（5KB）
- `index.js`（11KB）　— To be honest, I don't really feel like keyword belongs in color convert, but eh.
- `package.json`（1KB）

## gltf/node_modules/color-convert/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（1KB）　— 1.0.0 - 2016-01-07
- `LICENSE`（1KB）
- `README.md`（3KB）　— color-convert
- `conversions.js`（17KB）　— MIT license
- `index.js`（2KB）
- `package.json`（1KB）
- `route.js`（2KB）

## gltf/node_modules/color-name/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）
- `index.js`（5KB）
- `package.json`（1KB）

## gltf/node_modules/color-string/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）　— color-string
- `index.d.ts`（1KB）
- `index.js`（6KB）　— Create a list of reverse color names
- `package.json`（1KB）

## gltf/node_modules/color-string/node_modules/color-name/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）　— color-name
- `index.js`（4KB）
- `package.json`（1KB）

## gltf/node_modules/color/node_modules/color-convert/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— color-convert
- `conversions.js`（20KB）　— MIT license
- `index.d.ts`（16KB）
- `index.js`（2KB）
- `package.json`（1KB）
- `route.js`（2KB）

## gltf/node_modules/color/node_modules/color-name/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）　— color-name
- `index.js`（4KB）
- `package.json`（1KB）

## gltf/node_modules/colorette/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（4KB）　— 🌈Colorette
- `index.cjs`（5KB）
- `index.d.ts`（2KB）
- `index.js`（3KB）
- `package.json`（1KB）

## gltf/node_modules/cross-spawn/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— cross-spawn
- `index.js`（1KB）
- `package.json`（2KB）

## gltf/node_modules/cross-spawn/lib/（未归类）

待归类：请确认用途后归档。

- `enoent.js`（1KB）
- `parse.js`（3KB）

## gltf/node_modules/cross-spawn/lib/util/（未归类）

待归类：请确认用途后归档。

- `escape.js`（1KB）　— See http://www.robvanderwoude.com/escapechars.php
- `readShebang.js`（1KB）
- `resolveCommand.js`（2KB）

## gltf/node_modules/csv-stringify/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（3KB）　— CSV stringifier for Node.js and the web
- `package.json`（3KB）

## gltf/node_modules/csv-stringify/dist/cjs/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（27KB）
- `index.d.cts`（7KB）　— <reference types="node" />
- `sync.cjs`（25KB）　— Lodash implementation of `get`
- `sync.d.cts`（0KB）

## gltf/node_modules/csv-stringify/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（7KB）　— <reference types="node" />
- `index.js`（168KB）　— This constructor is used to store event handlers. Instantiating this is
- `sync.d.ts`（0KB）
- `sync.js`（78KB）

## gltf/node_modules/csv-stringify/dist/iife/（未归类）

待归类：请确认用途后归档。

- `index.js`（178KB）　— This constructor is used to store event handlers. Instantiating this is
- `sync.js`（107KB）

## gltf/node_modules/csv-stringify/dist/umd/（未归类）

待归类：请确认用途后归档。

- `index.js`（178KB）
- `sync.js`（107KB）

## gltf/node_modules/csv-stringify/lib/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（7KB）　— <reference types="node" />
- `index.js`（3KB）
- `sync.d.ts`（0KB）
- `sync.js`（1KB）

## gltf/node_modules/csv-stringify/lib/api/（未归类）

待归类：请确认用途后归档。

- `CsvError.js`（1KB）
- `index.js`（12KB）　— True when appending `separator` after `value` would let `parse` find
- `normalize_columns.js`（1KB）
- `normalize_options.js`（9KB）　— Merge with user options

## gltf/node_modules/csv-stringify/lib/utils/（未归类）

待归类：请确认用途后归档。

- `get.js`（2KB）　— Lodash implementation of `get`
- `is_object.js`（0KB）
- `underscore.js`（0KB）

## gltf/node_modules/cwise-compiler/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）
- `compiler.js`（4KB）
- `package.json`（1KB）

## gltf/node_modules/cwise-compiler/lib/（未归类）

待归类：请确认用途后归档。

- `compile.js`（14KB）　— This function generates very simple loops analogous to how you typically traverse arrays…
- `thunk.js`（4KB）　— The function below is called when constructing a cwise function object, and does the fol…

## gltf/node_modules/detect-libc/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（11KB）
- `README.md`（3KB）　— detect-libc
- `index.d.ts`（0KB）　— Copyright 2017 Lovell Fuller and others.
- `package.json`（1KB）

## gltf/node_modules/detect-libc/lib/（未归类）

待归类：请确认用途后归档。

- `detect-libc.js`（7KB）　— Copyright 2017 Lovell Fuller and others.
- `elf.js`（1KB）　— Copyright 2017 Lovell Fuller and others.
- `filesystem.js`（1KB）　— Copyright 2017 Lovell Fuller and others.
- `process.js`（1KB）　— Copyright 2017 Lovell Fuller and others.

## gltf/node_modules/draco3dgltf/（未归类）

待归类：请确认用途后归档。

- `README.md`（2KB）
- `bunny.drc`（118KB）
- `draco3dgltf.js`（0KB）
- `draco_decoder_gltf.wasm`（188KB）
- `draco_decoder_gltf_nodejs.js`（57KB）
- `draco_encoder.wasm`（362KB）
- `draco_encoder_gltf_nodejs.js`（48KB）
- `draco_nodejs_example.js`（6KB）　— Copyright 2017 The Draco Authors.
- `package.json`（1KB）

## gltf/node_modules/eastasianwidth/（未归类）

待归类：请确认用途后归档。

- `README.md`（1KB）　— East Asian Width
- `eastasianwidth.js`（12KB）
- `package.json`（0KB）

## gltf/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（3KB）　— emoji-regex [![Build status](https://travis-ci.org/mathiasbynens/emoji-regex.svg?branch=…
- `index.d.ts`（0KB）
- `index.js`（10KB）
- `package.json`（1KB）
- `text.js`（10KB）

## gltf/node_modules/emoji-regex/es2015/（未归类）

待归类：请确认用途后归档。

- `index.js`（11KB）
- `text.js`（11KB）

## gltf/node_modules/enabled/（未归类）

待归类：请确认用途后归档。

- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（2KB）　— enabled
- `index.js`（1KB）
- `package.json`（1KB）
- `test.js`（1KB）

## gltf/node_modules/environment/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（2KB）
- `index.js`（2KB）　— globals WorkerGlobalScope, DedicatedWorkerGlobalScope, SharedWorkerGlobalScope, ServiceW…
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— environment

## gltf/node_modules/eventemitter3/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（3KB）　— EventEmitter3
- `index.d.ts`（3KB）
- `index.js`（9KB）
- `index.mjs`（0KB）
- `package.json`（1KB）

## gltf/node_modules/eventemitter3/dist/（未归类）

待归类：请确认用途后归档。

- `eventemitter3.esm.js`（10KB）
- `eventemitter3.esm.min.js`（3KB）
- `eventemitter3.esm.min.js.map`（14KB）
- `eventemitter3.umd.js`（11KB）
- `eventemitter3.umd.min.js`（3KB）
- `eventemitter3.umd.min.js.map`（14KB）

## gltf/node_modules/fast-deep-equal/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（3KB）　— fast-deep-equal
- `index.d.ts`（0KB）
- `index.js`（1KB）　— do not edit .js files directly - edit src/index.jst
- `package.json`（1KB）
- `react.d.ts`（0KB）
- `react.js`（1KB）　— do not edit .js files directly - edit src/index.jst

## gltf/node_modules/fast-deep-equal/es6/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（2KB）　— do not edit .js files directly - edit src/index.jst
- `react.d.ts`（0KB）
- `react.js`（2KB）　— do not edit .js files directly - edit src/index.jst

## gltf/node_modules/fast-json-stable-stringify/（未归类）

待归类：请确认用途后归档。

- `.eslintrc.yml`（1KB）
- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（3KB）　— fast-json-stable-stringify
- `index.d.ts`（0KB）
- `index.js`（2KB）
- `package.json`（1KB）

## gltf/node_modules/fast-json-stable-stringify/.github/（未归类）

待归类：请确认用途后归档。

- `FUNDING.yml`（0KB）

## gltf/node_modules/fast-json-stable-stringify/benchmark/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）　— 'JSON.stringify': JSON.stringify,
- `test.json`（4KB）

## gltf/node_modules/fast-json-stable-stringify/example/（未归类）

待归类：请确认用途后归档。

- `key_cmp.js`（0KB）
- `nested.js`（0KB）
- `str.js`（0KB）
- `value_cmp.js`（0KB）

## gltf/node_modules/fast-json-stable-stringify/test/（未归类）

待归类：请确认用途后归档。

- `cmp.js`（0KB）
- `nested.js`（1KB）
- `str.js`（1KB）
- `to-json.js`（1KB）

## gltf/node_modules/fecha/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（7KB）　— fecha [![Build Status](https://travis-ci.org/taylorhakes/fecha.svg?branch=master)](https…
- `package.json`（1KB）

## gltf/node_modules/fecha/dist/（未归类）

待归类：请确认用途后归档。

- `fecha.min.js`（6KB）
- `fecha.min.js.map`（23KB）

## gltf/node_modules/fecha/lib/（未归类）

待归类：请确认用途后归档。

- `fecha.d.ts`（2KB）
- `fecha.js`（14KB）
- `fecha.js.map`（28KB）
- `fecha.umd.js`（15KB）
- `fecha.umd.js.map`（28KB）

## gltf/node_modules/fecha/src/（未归类）

待归类：请确认用途后归档。

- `fecha.ts`（14KB）

## gltf/node_modules/fill-range/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（7KB）　— fill-range [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www…
- `index.js`（6KB）
- `package.json`（2KB）

## gltf/node_modules/fn.name/（未归类）

待归类：请确认用途后归档。

- `.gitattributes`（0KB）
- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）　— fn.name
- `index.js`（1KB）
- `package.json`（1KB）
- `test.js`（2KB）

## gltf/node_modules/foreground-child/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— foreground-child
- `package.json`（3KB）

## gltf/node_modules/foreground-child/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `all-signals.d.ts`（0KB）
- `all-signals.d.ts.map`（0KB）
- `all-signals.js`（2KB）
- `all-signals.js.map`（2KB）
- `index.d.ts`（3KB）
- `index.d.ts.map`（2KB）
- `index.js`（4KB）
- `index.js.map`（10KB）
- `package.json`（0KB）
- `proxy-signals.d.ts`（0KB）
- `proxy-signals.d.ts.map`（0KB）
- `proxy-signals.js`（1KB）
- `proxy-signals.js.map`（2KB）
- `watchdog.d.ts`（0KB）
- `watchdog.d.ts.map`（0KB）
- `watchdog.js`（2KB）　— this spawns a child process that listens for SIGHUP when the
- `watchdog.js.map`（2KB）

## gltf/node_modules/foreground-child/dist/esm/（未归类）

待归类：请确认用途后归档。

- `all-signals.d.ts`（0KB）
- `all-signals.d.ts.map`（0KB）
- `all-signals.js`（1KB）
- `all-signals.js.map`（2KB）
- `index.d.ts`（3KB）
- `index.d.ts.map`（2KB）
- `index.js`（4KB）　— c8 ignore start
- `index.js.map`（10KB）
- `package.json`（0KB）
- `proxy-signals.d.ts`（0KB）
- `proxy-signals.d.ts.map`（0KB）
- `proxy-signals.js`（1KB）
- `proxy-signals.js.map`（2KB）
- `watchdog.d.ts`（0KB）
- `watchdog.d.ts.map`（0KB）
- `watchdog.js`（1KB）　— this spawns a child process that listens for SIGHUP when the
- `watchdog.js.map`（2KB）

## gltf/node_modules/get-east-asian-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（2KB）
- `index.js`（1KB）
- `license`（1KB）
- `lookup-data.js`（5KB）　— Generated by scripts/build.js
- `lookup.js`（3KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— get-east-asian-width
- `utilities.js`（1KB）

## gltf/node_modules/glob/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（47KB）　— Glob
- `package.json`（3KB）

## gltf/node_modules/glob/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `glob.d.ts`（14KB）
- `glob.d.ts.map`（4KB）
- `glob.js`（8KB）
- `glob.js.map`（28KB）
- `has-magic.d.ts`（1KB）
- `has-magic.d.ts.map`（0KB）
- `has-magic.js`（1KB）
- `has-magic.js.map`（1KB）
- `ignore.d.ts`（1KB）
- `ignore.d.ts.map`（1KB）
- `ignore.js`（4KB）　— give it a pattern, and it'll be able to tell you if
- `ignore.js.map`（7KB）
- `index.d.ts`（6KB）
- `index.d.ts.map`（4KB）
- `index.js`（3KB）
- `index.js.map`（8KB）
- `package.json`（0KB）
- `pattern.d.ts`（2KB）
- `pattern.d.ts.map`（1KB）
- `pattern.js`（7KB）　— this is just a very light wrapper around 2 arrays with an offset index
- `pattern.js.map`（13KB）
- `processor.d.ts`（2KB）
- `processor.d.ts.map`（2KB）
- `processor.js`（11KB）　— synchronous utility for filtering entries and calculating subwalks
- `processor.js.map`（19KB）
- `walker.d.ts`（4KB）
- `walker.d.ts.map`（4KB）
- `walker.js`（13KB）
- `walker.js.map`（27KB）

## gltf/node_modules/glob/dist/esm/（未归类）

待归类：请确认用途后归档。

- `bin.d.mts`（0KB）
- `bin.d.mts.map`（0KB）
- `bin.mjs`（12KB）
- `bin.mjs.map`（18KB）
- `glob.d.ts`（14KB）
- `glob.d.ts.map`（4KB）
- `glob.js`（8KB）　— if no process global, just call it linux.
- `glob.js.map`（28KB）
- `has-magic.d.ts`（1KB）
- `has-magic.d.ts.map`（0KB）
- `has-magic.js`（1KB）
- `has-magic.js.map`（1KB）
- `ignore.d.ts`（1KB）
- `ignore.d.ts.map`（1KB）
- `ignore.js`（4KB）　— give it a pattern, and it'll be able to tell you if
- `ignore.js.map`（7KB）
- `index.d.ts`（6KB）
- `index.d.ts.map`（4KB）
- `index.js`（2KB）
- `index.js.map`（8KB）
- `package.json`（0KB）
- `pattern.d.ts`（2KB）
- `pattern.d.ts.map`（1KB）
- `pattern.js`（7KB）　— this is just a very light wrapper around 2 arrays with an offset index
- `pattern.js.map`（13KB）
- `processor.d.ts`（2KB）
- `processor.d.ts.map`（2KB）
- `processor.js`（10KB）　— synchronous utility for filtering entries and calculating subwalks
- `processor.js.map`（19KB）
- `walker.d.ts`（4KB）
- `walker.d.ts.map`（4KB）
- `walker.js`（12KB）
- `walker.js.map`（27KB）

## gltf/node_modules/gltf-validator/（未归类）

待归类：请确认用途后归档。

- `ISSUES.md`（17KB）　— glTF 2.0 Validation Issues
- `LICENSE`（11KB）
- `NOTICES`（22KB）
- `README.md`（7KB）　— gltf-validator
- `gltf_validator.dart.js`（301KB）
- `index.js`（3KB）
- `module.mjs`（3KB）
- `package.json`（1KB）
- `validation.schema.json`（11KB）

## gltf/node_modules/has-flag/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— has-flag [![Build Status](https://travis-ci.org/sindresorhus/has-flag.svg?branch=master)…

## gltf/node_modules/inherits/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）
- `inherits.js`（0KB）
- `inherits_browser.js`（1KB）
- `package.json`（1KB）

## gltf/node_modules/iota-array/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）　— iota-array
- `iota.js`（0KB）
- `package.json`（1KB）

## gltf/node_modules/is-buffer/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）　— is-buffer [![travis][travis-image]][travis-url] [![npm][npm-image]][npm-url] [![download…
- `index.js`（1KB）　— The _isBuffer check is for Safari 5-7 support, because it's missing
- `package.json`（1KB）

## gltf/node_modules/is-buffer/test/（未归类）

待归类：请确认用途后归档。

- `basic.js`（1KB）

## gltf/node_modules/is-fullwidth-code-point/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）　— eslint-disable yoda
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— is-fullwidth-code-point

## gltf/node_modules/is-number/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（6KB）　— is-number [![NPM version](https://img.shields.io/npm/v/is-number.svg?style=flat)](https:…
- `index.js`（0KB）
- `package.json`（2KB）

## gltf/node_modules/is-stream/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（2KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— is-stream

## gltf/node_modules/isexe/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）　— isexe
- `index.js`（1KB）
- `mode.js`（1KB）
- `package.json`（1KB）
- `windows.js`（1KB）

## gltf/node_modules/isexe/test/（未归类）

待归类：请确认用途后归档。

- `basic.js`（5KB）

## gltf/node_modules/jackspeak/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（2KB）　— Blue Oak Model License
- `README.md`（11KB）　— jackspeak
- `package.json`（2KB）

## gltf/node_modules/jackspeak/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（12KB）　— <reference types="node" />
- `index.d.ts.map`（8KB）
- `index.js`（36KB）
- `index.js.map`（79KB）
- `package.json`（0KB）
- `parse-args-cjs.cjs.map`（2KB）
- `parse-args-cjs.d.cts.map`（0KB）
- `parse-args.d.ts`（0KB）　— <reference types="node" />
- `parse-args.js`（2KB）

## gltf/node_modules/jackspeak/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（12KB）　— <reference types="node" resolution-mode="require"/>
- `index.d.ts.map`（8KB）
- `index.js`（35KB）　— it's a tiny API, just cast it inline, it's fine
- `index.js.map`（79KB）
- `package.json`（0KB）
- `parse-args.d.ts`（0KB）　— <reference types="node" resolution-mode="require"/>
- `parse-args.d.ts.map`（0KB）
- `parse-args.js`（1KB）
- `parse-args.js.map`（2KB）

## gltf/node_modules/json-schema-traverse/（未归类）

待归类：请确认用途后归档。

- `.eslintrc.yml`（1KB）
- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（3KB）　— json-schema-traverse
- `index.js`（2KB）　— Legacy support for v0.3.1 and earlier.
- `package.json`（1KB）

## gltf/node_modules/json-schema-traverse/spec/（未归类）

待归类：请确认用途后归档。

- `.eslintrc.yml`（0KB）
- `index.spec.js`（6KB）

## gltf/node_modules/json-schema-traverse/spec/fixtures/（未归类）

待归类：请确认用途后归档。

- `schema.js`（5KB）

## gltf/node_modules/keyframe-resample/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（2KB）　— Blue Oak Model License
- `README.md`（5KB）　— keyframe-resample-wasm
- `package.json`（3KB）

## gltf/node_modules/keyframe-resample/assembly/（未归类）

待归类：请确认用途后归档。

- `resample.ts`（5KB）　— Types and constants
- `tsconfig.json`（0KB）

## gltf/node_modules/keyframe-resample/dist/（未归类）

待归类：请确认用途后归档。

- `bindings.d.ts`（0KB）
- `constants.d.ts`（0KB）
- `index.d.ts`（0KB）
- `keyframe-resample-browser.cjs`（11KB）
- `keyframe-resample-browser.modern.js`（10KB）
- `keyframe-resample-compat.cjs`（19KB）
- `keyframe-resample-compat.modern.js`（18KB）
- `keyframe-resample-node.cjs`（10KB）
- `keyframe-resample-node.modern.js`（10KB）
- `release.d.ts`（1KB）
- `release.js`（4KB）
- `release.wasm`（6KB）
- `release.wat`（53KB）
- `resampleDebug.d.ts`（0KB）
- `wasm.browser.d.ts`（0KB）　— WASM loader for Web environments.
- `wasm.compat.d.ts`（0KB）
- `wasm.node.d.ts`（0KB）

## gltf/node_modules/keyframe-resample/src/（未归类）

待归类：请确认用途后归档。

- `bindings.ts`（6KB）　— WASM API
- `constants.ts`（0KB）
- `global.d.ts`（0KB）　— placeholder
- `index.ts`（0KB）
- `resampleDebug.ts`（4KB）
- `wasm.browser.ts`（0KB）　— WASM loader for Web environments.
- `wasm.compat.ts`（0KB）　— WASM loader using an inline Data URI.
- `wasm.env.ts`（0KB）
- `wasm.node.ts`（0KB）　— WASM loader for Node.js environments.

## gltf/node_modules/kleur/（未归类）

待归类：请确认用途后归档。

- `index.js`（2KB）
- `kleur.d.ts`（1KB）　— Originally by: Rogier Schouten <https://github.com/rogierschouten>
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（5KB）

## gltf/node_modules/ktx-parse/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（0KB）　— Changelog
- `LICENSE`（1KB）
- `README.md`（4KB）　— ktx-parse
- `package.json`（2KB）

## gltf/node_modules/ktx-parse/dist/（未归类）

待归类：请确认用途后归档。

- `buffer-reader.d.ts`（0KB）
- `constants-internal.d.ts`（0KB）
- `constants.d.ts`（22KB）
- `container.d.ts`（4KB）
- `create-default-container.d.ts`（0KB）
- `index.d.ts`（0KB）
- `ktx-parse.cjs`（48KB）　— KTX2 Header.
- `ktx-parse.cjs.map`（93KB）
- `ktx-parse.esm.js`（39KB）　— KTX2 Header.
- `ktx-parse.esm.js.map`（92KB）
- `ktx-parse.modern.js`（40KB）　— KTX2 Header.
- `ktx-parse.modern.js.map`（92KB）
- `read.d.ts`（0KB）
- `util.d.ts`（2KB）　— Encodes text to an ArrayBuffer.
- `write.d.ts`（1KB）

## gltf/node_modules/ktx-parse/src/（未归类）

待归类：请确认用途后归档。

- `buffer-reader.ts`（2KB）
- `constants-internal.ts`（1KB）　— Common.
- `constants.ts`（21KB）　— KTX2 Header.
- `container.ts`（4KB）
- `create-default-container.ts`（1KB）
- `index.ts`（0KB）
- `read.ts`（8KB）
- `util.ts`（7KB）
- `write.ts`（9KB）

## gltf/node_modules/kuler/（未归类）

待归类：请确认用途后归档。

- `.travis.yml`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）　— kuler
- `index.js`（2KB）
- `package.json`（1KB）
- `test.js`（1KB）

## gltf/node_modules/listr2/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（1KB）　— listr2
- `package.json`（2KB）

## gltf/node_modules/listr2/dist/（未归类）

待归类：请确认用途后归档。

- `index.cjs`（77KB）
- `index.d.cts`（57KB）
- `index.d.ts`（57KB）
- `index.js`（73KB）　— src/constants/ansi-escape-codes.constants.ts

## gltf/node_modules/listr2/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（5KB）
- `index.js`（5KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（5KB）　— ansi-styles

## gltf/node_modules/listr2/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（4KB）　— emoji-regex [![Build status](https://github.com/mathiasbynens/emoji-regex/actions/workfl…
- `index.d.ts`（0KB）
- `index.js`（14KB）
- `index.mjs`（14KB）
- `package.json`（1KB）

## gltf/node_modules/listr2/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— string-width

## gltf/node_modules/listr2/node_modules/wrap-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（6KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— wrap-ansi

## gltf/node_modules/lodash/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（2KB）
- `README.md`（1KB）　— lodash v4.18.1
- `_DataView.js`（0KB）
- `_Hash.js`（1KB）
- `_LazyWrapper.js`（1KB）
- `_ListCache.js`（1KB）
- `_LodashWrapper.js`（1KB）
- `_Map.js`（0KB）
- `_MapCache.js`（1KB）
- `_Promise.js`（0KB）
- `_Set.js`（0KB）
- `_SetCache.js`（1KB）
- `_Stack.js`（1KB）
- `_Symbol.js`（0KB）　— Built-in value references.
- `_Uint8Array.js`（0KB）　— Built-in value references.
- `_WeakMap.js`（0KB）
- `_apply.js`（1KB）
- `_arrayAggregator.js`（1KB）
- `_arrayEach.js`（1KB）
- `_arrayEachRight.js`（1KB）
- `_arrayEvery.js`（1KB）
- `_arrayFilter.js`（1KB）
- `_arrayIncludes.js`（1KB）
- `_arrayIncludesWith.js`（1KB）
- `_arrayLikeKeys.js`（2KB）
- `_arrayMap.js`（1KB）
- `_arrayPush.js`（0KB）
- `_arrayReduce.js`（1KB）
- `_arrayReduceRight.js`（1KB）
- `_arraySample.js`（0KB）
- `_arraySampleSize.js`（0KB）
- `_arrayShuffle.js`（0KB）
- `_arraySome.js`（1KB）
- `_asciiSize.js`（0KB）
- `_asciiToArray.js`（0KB）
- `_asciiWords.js`（0KB）　— Used to match words composed of alphanumeric characters.
- `_assignMergeValue.js`（1KB）
- `_assignValue.js`（1KB）
- `_assocIndexOf.js`（0KB）
- `_baseAggregator.js`（1KB）
- `_baseAssign.js`（0KB）
- `_baseAssignIn.js`（0KB）
- `_baseAssignValue.js`（1KB）
- `_baseAt.js`（1KB）
- `_baseClamp.js`（1KB）
- `_baseClone.js`（5KB）
- `_baseConforms.js`（0KB）
- `_baseConformsTo.js`（1KB）
- `_baseCreate.js`（1KB）　— Built-in value references.
- `_baseDelay.js`（1KB）　— Error message constants.
- `_baseDifference.js`（2KB）
- `_baseEach.js`（0KB）
- `_baseEachRight.js`（0KB）
- `_baseEvery.js`（1KB）
- `_baseExtremum.js`（1KB）
- `_baseFill.js`（1KB）
- `_baseFilter.js`（1KB）
- `_baseFindIndex.js`（1KB）
- `_baseFindKey.js`（1KB）
- `_baseFlatten.js`（1KB）
- `_baseFor.js`（1KB）
- `_baseForOwn.js`（0KB）
- `_baseForOwnRight.js`（0KB）
- `_baseForRight.js`（0KB）
- `_baseFunctions.js`（1KB）
- `_baseGet.js`（1KB）
- `_baseGetAllKeys.js`（1KB）
- `_baseGetTag.js`（1KB）
- `_baseGt.js`（0KB）
- `_baseHas.js`（1KB）　— Used for built-in method references.
- `_baseHasIn.js`（0KB）
- `_baseInRange.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_baseIndexOf.js`（1KB）
- `_baseIndexOfWith.js`（1KB）
- `_baseIntersection.js`（2KB）
- `_baseInverter.js`（1KB）
- `_baseInvoke.js`（1KB）
- `_baseIsArguments.js`（0KB）
- `_baseIsArrayBuffer.js`（0KB）
- `_baseIsDate.js`（0KB）
- `_baseIsEqual.js`（1KB）
- `_baseIsEqualDeep.js`（3KB）
- `_baseIsMap.js`（0KB）
- `_baseIsMatch.js`（2KB）
- `_baseIsNaN.js`（0KB）
- `_baseIsNative.js`（1KB）
- `_baseIsRegExp.js`（0KB）
- `_baseIsSet.js`（0KB）
- `_baseIsTypedArray.js`（2KB）
- `_baseIteratee.js`（1KB）
- `_baseKeys.js`（1KB）
- `_baseKeysIn.js`（1KB）
- `_baseLodash.js`（0KB）
- `_baseLt.js`（0KB）
- `_baseMap.js`（1KB）
- `_baseMatches.js`（1KB）
- `_baseMatchesProperty.js`（1KB）
- `_baseMean.js`（1KB）　— Used as references for various `Number` constants.
- `_baseMerge.js`（1KB）
- `_baseMergeDeep.js`（3KB）
- `_baseNth.js`（0KB）
- `_baseOrderBy.js`（2KB）
- `_basePick.js`（0KB）
- `_basePickBy.js`（1KB）
- `_baseProperty.js`（0KB）
- `_basePropertyDeep.js`（0KB）
- `_basePropertyOf.js`（0KB）
- `_basePullAll.js`（1KB）
- `_basePullAt.js`（1KB）
- `_baseRandom.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_baseRange.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_baseReduce.js`（1KB）
- `_baseRepeat.js`（1KB）　— Used as references for various `Number` constants.
- `_baseRest.js`（1KB）
- `_baseSample.js`（0KB）
- `_baseSampleSize.js`（1KB）
- `_baseSet.js`（1KB）
- `_baseSetData.js`（0KB）
- `_baseSetToString.js`（1KB）
- `_baseShuffle.js`（0KB）
- `_baseSlice.js`（1KB）
- `_baseSome.js`（1KB）
- `_baseSortBy.js`（1KB）
- `_baseSortedIndex.js`（1KB）
- `_baseSortedIndexBy.js`（2KB）　— Used as references for the maximum length and index of an array.
- `_baseSortedUniq.js`（1KB）
- `_baseSum.js`（1KB）
- `_baseTimes.js`（0KB）
- `_baseToNumber.js`（1KB）　— Used as references for various `Number` constants.
- `_baseToPairs.js`（1KB）
- `_baseToString.js`（1KB）
- `_baseTrim.js`（0KB）　— Used to match leading whitespace.
- `_baseUnary.js`（0KB）
- `_baseUniq.js`（2KB）
- `_baseUnset.js`（2KB）
- `_baseUpdate.js`（1KB）
- `_baseValues.js`（1KB）
- `_baseWhile.js`（1KB）
- `_baseWrapperValue.js`（1KB）
- `_baseXor.js`（1KB）
- `_baseZipObject.js`（1KB）
- `_cacheHas.js`（0KB）
- `_castArrayLikeObject.js`（0KB）
- `_castFunction.js`（0KB）
- `_castPath.js`（1KB）
- `_castRest.js`（0KB）
- `_castSlice.js`（1KB）
- `_charsEndIndex.js`（1KB）
- `_charsStartIndex.js`（1KB）
- `_cloneArrayBuffer.js`（0KB）
- `_cloneBuffer.js`（1KB）　— Detect free variable `exports`.
- `_cloneDataView.js`（0KB）
- `_cloneRegExp.js`（0KB）　— Used to match `RegExp` flags from their coerced string values.
- `_cloneSymbol.js`（1KB）　— Used to convert symbols to primitives and strings.
- `_cloneTypedArray.js`（1KB）
- `_compareAscending.js`（1KB）
- `_compareMultiple.js`（2KB）
- `_composeArgs.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_composeArgsRight.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_copyArray.js`（0KB）
- `_copyObject.js`（1KB）
- `_copySymbols.js`（0KB）
- `_copySymbolsIn.js`（0KB）
- `_coreJsData.js`（0KB）　— Used to detect overreaching core-js shims.
- `_countHolders.js`（0KB）
- `_createAggregator.js`（1KB）
- `_createAssigner.js`（1KB）
- `_createBaseEach.js`（1KB）
- `_createBaseFor.js`（1KB）
- `_createBind.js`（1KB）
- `_createCaseFirst.js`（1KB）
- `_createCompounder.js`（1KB）
- `_createCtor.js`（1KB）
- `_createCurry.js`（1KB）
- `_createFind.js`（1KB）
- `_createFlow.js`（2KB）
- `_createHybrid.js`（3KB）
- `_createInverter.js`（0KB）
- `_createMathOperation.js`（1KB）
- `_createOver.js`（1KB）
- `_createPadding.js`（1KB）
- `_createPartial.js`（1KB）
- `_createRange.js`（1KB）
- `_createRecurry.js`（2KB）
- `_createRelationalOperation.js`（1KB）
- `_createRound.js`（1KB）
- `_createSet.js`（0KB）
- `_createToPairs.js`（1KB）
- `_createWrap.js`（4KB）
- `_customDefaultsAssignIn.js`（1KB）　— Used for built-in method references.
- `_customDefaultsMerge.js`（1KB）
- `_customOmitClone.js`（0KB）
- `_deburrLetter.js`（3KB）　— Used to map Latin Unicode letters to basic Latin letters.
- `_defineProperty.js`（0KB）
- `_equalArrays.js`（3KB）
- `_equalByTag.js`（4KB）
- `_equalObjects.js`（3KB）　— Used to compose bitmasks for value comparisons.
- `_escapeHtmlChar.js`（0KB）　— Used to map characters to HTML entities.
- `_escapeStringChar.js`（1KB）　— Used to escape characters for inclusion in compiled string literals.
- `_flatRest.js`（0KB）
- `_freeGlobal.js`（0KB）　— Detect free variable `global` from Node.js.
- `_getAllKeys.js`（0KB）
- `_getAllKeysIn.js`（0KB）
- `_getData.js`（0KB）
- `_getFuncName.js`（1KB）　— Used for built-in method references.
- `_getHolder.js`（0KB）
- `_getMapData.js`（0KB）
- `_getMatchData.js`（1KB）
- `_getNative.js`（0KB）
- `_getPrototype.js`（0KB）　— Built-in value references.
- `_getRawTag.js`（1KB）　— Used for built-in method references.
- `_getSymbols.js`（1KB）
- `_getSymbolsIn.js`（1KB）
- `_getTag.js`（2KB）
- `_getValue.js`（0KB）
- `_getView.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_getWrapDetails.js`（0KB）　— Used to match wrap detail comments.
- `_hasPath.js`（1KB）
- `_hasUnicode.js`（1KB）　— Used to compose unicode character classes.
- `_hasUnicodeWord.js`（0KB）　— Used to detect strings that need a more robust regexp to match words.
- `_hashClear.js`（0KB）
- `_hashDelete.js`（0KB）
- `_hashGet.js`（1KB）　— Used to stand-in for `undefined` hash values.
- `_hashHas.js`（1KB）　— Used for built-in method references.
- `_hashSet.js`（1KB）　— Used to stand-in for `undefined` hash values.
- `_initCloneArray.js`（1KB）　— Used for built-in method references.
- `_initCloneByTag.js`（2KB）
- `_initCloneObject.js`（0KB）
- `_insertWrapDetails.js`（1KB）　— Used to match wrap detail comments.
- `_isFlattenable.js`（1KB）
- `_isIndex.js`（1KB）　— Used as references for various `Number` constants.
- `_isIterateeCall.js`（1KB）
- `_isKey.js`（1KB）
- `_isKeyable.js`（0KB）
- `_isLaziable.js`（1KB）
- `_isMaskable.js`（0KB）
- `_isMasked.js`（1KB）　— Used to detect methods masquerading as native.
- `_isPrototype.js`（0KB）　— Used for built-in method references.
- `_isStrictComparable.js`（0KB）
- `_iteratorToArray.js`（0KB）
- `_lazyClone.js`（1KB）
- `_lazyReverse.js`（0KB）
- `_lazyValue.js`（2KB）
- `_listCacheClear.js`（0KB）
- `_listCacheDelete.js`（1KB）　— Used for built-in method references.
- `_listCacheGet.js`（0KB）
- `_listCacheHas.js`（0KB）
- `_listCacheSet.js`（1KB）
- `_mapCacheClear.js`（0KB）
- `_mapCacheDelete.js`（0KB）
- `_mapCacheGet.js`（0KB）
- `_mapCacheHas.js`（0KB）
- `_mapCacheSet.js`（0KB）
- `_mapToArray.js`（0KB）
- `_matchesStrictComparable.js`（1KB）
- `_memoizeCapped.js`（1KB）　— Used as the maximum memoize cache size.
- `_mergeData.js`（3KB）
- `_metaMap.js`（0KB）　— Used to store function metadata.
- `_nativeCreate.js`（0KB）　— Built-in method references that are verified to be native.
- `_nativeKeys.js`（0KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_nativeKeysIn.js`（0KB）
- `_nodeUtil.js`（1KB）　— Detect free variable `exports`.
- `_objectToString.js`（1KB）　— Used for built-in method references.
- `_overArg.js`（0KB）
- `_overRest.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `_parent.js`（0KB）
- `_reEscape.js`（0KB）　— Used to match template delimiters.
- `_reEvaluate.js`（0KB）　— Used to match template delimiters.
- `_reInterpolate.js`（0KB）　— Used to match template delimiters.
- `_realNames.js`（0KB）　— Used to lookup unminified function names.
- `_reorder.js`（1KB）
- `_replaceHolders.js`（1KB）　— Used as the internal argument placeholder.
- `_root.js`（0KB）　— Detect free variable `self`.
- `_safeGet.js`（0KB）
- `_setCacheAdd.js`（0KB）　— Used to stand-in for `undefined` hash values.
- `_setCacheHas.js`（0KB）
- `_setData.js`（1KB）
- `_setToArray.js`（0KB）
- `_setToPairs.js`（0KB）
- `_setToString.js`（0KB）
- `_setWrapToString.js`（1KB）
- `_shortOut.js`（1KB）　— Used to detect hot functions by number of calls within a span of milliseconds.
- `_shuffleSelf.js`（1KB）
- `_stackClear.js`（0KB）
- `_stackDelete.js`（0KB）
- `_stackGet.js`（0KB）
- `_stackHas.js`（0KB）
- `_stackSet.js`（1KB）
- `_strictIndexOf.js`（1KB）
- `_strictLastIndexOf.js`（1KB）
- `_stringSize.js`（0KB）
- `_stringToArray.js`（0KB）
- `_stringToPath.js`（1KB）　— Used to match property names within property paths.
- `_toKey.js`（1KB）　— Used as references for various `Number` constants.
- `_toSource.js`（1KB）　— Used for built-in method references.
- `_trimmedEndIndex.js`（1KB）　— Used to match a single whitespace character.
- `_unescapeHtmlChar.js`（0KB）　— Used to map HTML entities to characters.
- `_unicodeSize.js`（2KB）　— Used to compose unicode character classes.
- `_unicodeToArray.js`（2KB）　— Used to compose unicode character classes.
- `_unicodeWords.js`（3KB）　— Used to compose unicode character classes.
- `_updateWrapDetails.js`（1KB）
- `_wrapperClone.js`（1KB）
- `add.js`（0KB）
- `after.js`（1KB）　— Error message constants.
- `array.js`（2KB）
- `ary.js`（1KB）　— Used to compose bitmasks for function metadata.
- `assign.js`（2KB）
- `assignIn.js`（1KB）
- `assignInWith.js`（1KB）
- `assignWith.js`（1KB）
- `at.js`（1KB）
- `attempt.js`（1KB）
- `before.js`（1KB）　— Error message constants.
- `bind.js`（2KB）
- `bindAll.js`（1KB）
- `bindKey.js`（2KB）
- `camelCase.js`（1KB）
- `capitalize.js`（1KB）
- `castArray.js`（1KB）
- `ceil.js`（0KB）
- `chain.js`（1KB）
- `chunk.js`（1KB）
- `clamp.js`（1KB）
- `clone.js`（1KB）　— Used to compose bitmasks for cloning.
- `cloneDeep.js`（1KB）　— Used to compose bitmasks for cloning.
- `cloneDeepWith.js`（1KB）　— Used to compose bitmasks for cloning.
- `cloneWith.js`（1KB）　— Used to compose bitmasks for cloning.
- `collection.js`（1KB）
- `commit.js`（1KB）
- `compact.js`（1KB）
- `concat.js`（1KB）
- `cond.js`（2KB）
- `conforms.js`（1KB）
- `conformsTo.js`（1KB）
- `constant.js`（1KB）
- `core.js`（113KB）
- `core.min.js`（13KB）
- `countBy.js`（1KB）
- `create.js`（1KB）
- `curry.js`（2KB）　— Used to compose bitmasks for function metadata.
- `curryRight.js`（1KB）　— Used to compose bitmasks for function metadata.
- `date.js`（0KB）
- `debounce.js`（6KB）
- `deburr.js`（2KB）
- `defaultTo.js`（1KB）
- `defaults.js`（2KB）
- `defaultsDeep.js`（1KB）
- `defer.js`（1KB）
- `delay.js`（1KB）
- `difference.js`（1KB）
- `differenceBy.js`（1KB）
- `differenceWith.js`（1KB）
- `divide.js`（0KB）
- `drop.js`（1KB）
- `dropRight.js`（1KB）
- `dropRightWhile.js`（1KB）
- `dropWhile.js`（1KB）
- `each.js`（0KB）
- `eachRight.js`（0KB）
- `endsWith.js`（1KB）
- `entries.js`（0KB）
- `entriesIn.js`（0KB）
- `eq.js`（1KB）
- `escape.js`（1KB）
- `escapeRegExp.js`（1KB）
- `every.js`（2KB）
- `extend.js`（0KB）
- `extendWith.js`（0KB）
- `fill.js`（1KB）
- `filter.js`（2KB）
- `find.js`（1KB）
- `findIndex.js`（2KB）
- `findKey.js`（1KB）
- `findLast.js`（1KB）
- `findLastIndex.js`（2KB）
- `findLastKey.js`（1KB）
- `first.js`（0KB）
- `flatMap.js`（1KB）
- `flatMapDeep.js`（1KB）
- `flatMapDepth.js`（1KB）
- `flatten.js`（0KB）
- `flattenDeep.js`（1KB）　— Used as references for various `Number` constants.
- `flattenDepth.js`（1KB）
- `flip.js`（1KB）　— Used to compose bitmasks for function metadata.
- `floor.js`（1KB）
- `flow.js`（1KB）
- `flowRight.js`（1KB）
- `forEach.js`（1KB）
- `forEachRight.js`（1KB）
- `forIn.js`（1KB）
- `forInRight.js`（1KB）
- `forOwn.js`（1KB）
- `forOwnRight.js`（1KB）
- `fp.js`（0KB）
- `fromPairs.js`（1KB）
- `function.js`（1KB）
- `functions.js`（1KB）
- `functionsIn.js`（1KB）
- `get.js`（1KB）
- `groupBy.js`（1KB）
- `gt.js`（1KB）
- `gte.js`（1KB）
- `has.js`（1KB）
- `hasIn.js`（1KB）
- `head.js`（0KB）
- `identity.js`（0KB）
- `inRange.js`（1KB）
- `includes.js`（2KB）
- `index.js`（0KB）
- `indexOf.js`（1KB）
- `initial.js`（0KB）
- `intersection.js`（1KB）
- `intersectionBy.js`（1KB）
- `intersectionWith.js`（1KB）
- `invert.js`（1KB）
- `invertBy.js`（2KB）
- `invoke.js`（1KB）
- `invokeMap.js`（1KB）
- `isArguments.js`（1KB）
- `isArray.js`（0KB）
- `isArrayBuffer.js`（1KB）
- `isArrayLike.js`（1KB）
- `isArrayLikeObject.js`（1KB）
- `isBoolean.js`（1KB）
- `isBuffer.js`（1KB）
- `isDate.js`（1KB）
- `isElement.js`（1KB）
- `isEmpty.js`（2KB）
- `isEqual.js`（1KB）
- `isEqualWith.js`（1KB）
- `isError.js`（1KB）
- `isFinite.js`（1KB）　— Built-in method references for those with the same name as other `lodash` methods.
- `isFunction.js`（1KB）
- `isInteger.js`（1KB）
- `isLength.js`（1KB）　— Used as references for various `Number` constants.
- `isMap.js`（1KB）
- `isMatch.js`（1KB）
- `isMatchWith.js`（1KB）
- `isNaN.js`（1KB）
- `isNative.js`（1KB）
- `isNil.js`（0KB）
- `isNull.js`（0KB）
- `isNumber.js`（1KB）
- `isObject.js`（1KB）
- `isObjectLike.js`（1KB）
- `isPlainObject.js`（2KB）
- `isRegExp.js`（1KB）
- `isSafeInteger.js`（1KB）　— Used as references for various `Number` constants.
- `isSet.js`（1KB）
- `isString.js`（1KB）
- `isSymbol.js`（1KB）
- `isTypedArray.js`（1KB）
- `isUndefined.js`（0KB）
- `isWeakMap.js`（1KB）
- `isWeakSet.js`（1KB）
- `iteratee.js`（2KB）
- `join.js`（1KB）　— Used for built-in method references.
- `kebabCase.js`（1KB）
- `keyBy.js`（1KB）
- `keys.js`（1KB）
- `keysIn.js`（1KB）
- `lang.js`（2KB）
- `last.js`（0KB）
- `lastIndexOf.js`（1KB）
- `lodash.js`（533KB）
- `lodash.min.js`（72KB）
- `lowerCase.js`（1KB）
- `lowerFirst.js`（0KB）
- `lt.js`（1KB）
- `lte.js`（1KB）
- `map.js`（2KB）
- `mapKeys.js`（1KB）
- `mapValues.js`（1KB）
- `matches.js`（1KB）
- `matchesProperty.js`（1KB）
- `math.js`（0KB）
- `max.js`（1KB）
- `maxBy.js`（1KB）
- `mean.js`（0KB）
- `meanBy.js`（1KB）
- `memoize.js`（2KB）　— Error message constants.
- `merge.js`（1KB）
- `mergeWith.js`（1KB）
- `method.js`（1KB）
- `methodOf.js`（1KB）
- `min.js`（1KB）
- `minBy.js`（1KB）
- `mixin.js`（2KB）
- `multiply.js`（1KB）
- `negate.js`（1KB）　— Error message constants.
- `next.js`（1KB）
- `noop.js`（0KB）
- `now.js`（1KB）
- `nth.js`（1KB）
- `nthArg.js`（1KB）
- `number.js`（0KB）
- `object.js`（2KB）
- `omit.js`（2KB）
- `omitBy.js`（1KB）
- `once.js`（1KB）
- `orderBy.js`（2KB）
- `over.js`（1KB）
- `overArgs.js`（2KB）
- `overEvery.js`（1KB）
- `overSome.js`（1KB）
- `package.json`（1KB）
- `pad.js`（1KB）
- `padEnd.js`（1KB）
- `padStart.js`（1KB）
- `parseInt.js`（1KB）
- `partial.js`（2KB）
- `partialRight.js`（2KB）
- `partition.js`（1KB）
- `pick.js`（1KB）
- `pickBy.js`（1KB）
- `plant.js`（1KB）
- `property.js`（1KB）
- `propertyOf.js`（1KB）
- `pull.js`（1KB）
- `pullAll.js`（1KB）
- `pullAllBy.js`（1KB）
- `pullAllWith.js`（1KB）
- `pullAt.js`（1KB）
- `random.js`（3KB）
- `range.js`（1KB）
- `rangeRight.js`（1KB）
- `rearg.js`（1KB）
- `reduce.js`（2KB）
- `reduceRight.js`（1KB）
- `reject.js`（1KB）
- `remove.js`（1KB）
- `repeat.js`（1KB）
- `replace.js`（1KB）
- `rest.js`（1KB）
- `result.js`（1KB）
- `reverse.js`（1KB）　— Used for built-in method references.
- `round.js`（0KB）
- `sample.js`（1KB）
- `sampleSize.js`（1KB）
- `seq.js`（0KB）
- `set.js`（1KB）
- `setWith.js`（1KB）
- `shuffle.js`（1KB）
- `size.js`（1KB）
- `slice.js`（1KB）
- `snakeCase.js`（1KB）
- `some.js`（2KB）
- `sortBy.js`（2KB）
- `sortedIndex.js`（1KB）
- `sortedIndexBy.js`（1KB）
- `sortedIndexOf.js`（1KB）
- `sortedLastIndex.js`（1KB）
- `sortedLastIndexBy.js`（1KB）
- `sortedLastIndexOf.js`（1KB）
- `sortedUniq.js`（1KB）
- `sortedUniqBy.js`（1KB）
- `split.js`（2KB）
- `spread.js`（2KB）
- `startCase.js`（1KB）
- `startsWith.js`（1KB）
- `string.js`（1KB）
- `stubArray.js`（0KB）
- `stubFalse.js`（0KB）
- `stubObject.js`（0KB）
- `stubString.js`（0KB）
- `stubTrue.js`（0KB）
- `subtract.js`（0KB）
- `sum.js`（0KB）
- `sumBy.js`（1KB）
- `tail.js`（0KB）
- `take.js`（1KB）
- `takeRight.js`（1KB）
- `takeRightWhile.js`（1KB）
- `takeWhile.js`（1KB）
- `tap.js`（1KB）
- `template.js`（11KB）
- `templateSettings.js`（2KB）
- `throttle.js`（3KB）
- `thru.js`（1KB）
- `times.js`（1KB）
- `toArray.js`（1KB）
- `toFinite.js`（1KB）　— Used as references for various `Number` constants.
- `toInteger.js`（1KB）
- `toIterator.js`（0KB）
- `toJSON.js`（0KB）
- `toLength.js`（1KB）
- `toLower.js`（1KB）
- `toNumber.js`（1KB）
- `toPairs.js`（1KB）
- `toPairsIn.js`（1KB）
- `toPath.js`（1KB）
- `toPlainObject.js`（1KB）
- `toSafeInteger.js`（1KB）
- `toString.js`（1KB）
- `toUpper.js`（1KB）
- `transform.js`（2KB）
- `trim.js`（1KB）
- `trimEnd.js`（1KB）
- `trimStart.js`（1KB）
- `truncate.js`（3KB）
- `unary.js`（0KB）
- `unescape.js`（1KB）
- `union.js`（1KB）
- `unionBy.js`（1KB）
- `unionWith.js`（1KB）
- `uniq.js`（1KB）
- `uniqBy.js`（1KB）
- `uniqWith.js`（1KB）
- `uniqueId.js`（1KB）　— Used to generate unique IDs.
- `unset.js`（1KB）
- `unzip.js`（1KB）
- `unzipWith.js`（1KB）
- `update.js`（1KB）
- `updateWith.js`（1KB）
- `upperCase.js`（1KB）
- `upperFirst.js`（0KB）
- `util.js`（1KB）
- `value.js`（0KB）
- `valueOf.js`（0KB）
- `values.js`（1KB）
- `valuesIn.js`（1KB）
- `without.js`（1KB）
- `words.js`（1KB）
- `wrap.js`（1KB）
- `wrapperAt.js`（1KB）
- `wrapperChain.js`（1KB）
- `wrapperLodash.js`（7KB）
- `wrapperReverse.js`（1KB）
- `wrapperValue.js`（0KB）
- `xor.js`（1KB）
- `xorBy.js`（1KB）
- `xorWith.js`（1KB）
- `zip.js`（1KB）
- `zipObject.js`（1KB）
- `zipObjectDeep.js`（1KB）
- `zipWith.js`（1KB）

## gltf/node_modules/lodash/fp/（未归类）

待归类：请确认用途后归档。

- `F.js`（0KB）
- `T.js`（0KB）
- `__.js`（0KB）
- `_baseConvert.js`（16KB）
- `_convertBrowser.js`（1KB）
- `_falseOptions.js`（0KB）
- `_mapping.js`（10KB）　— Used to map aliases to their real names.
- `_util.js`（1KB）
- `add.js`（0KB）
- `after.js`（0KB）
- `all.js`（0KB）
- `allPass.js`（0KB）
- `always.js`（0KB）
- `any.js`（0KB）
- `anyPass.js`（0KB）
- `apply.js`（0KB）
- `array.js`（0KB）
- `ary.js`（0KB）
- `assign.js`（0KB）
- `assignAll.js`（0KB）
- `assignAllWith.js`（0KB）
- `assignIn.js`（0KB）
- `assignInAll.js`（0KB）
- `assignInAllWith.js`（0KB）
- `assignInWith.js`（0KB）
- `assignWith.js`（0KB）
- `assoc.js`（0KB）
- `assocPath.js`（0KB）
- `at.js`（0KB）
- `attempt.js`（0KB）
- `before.js`（0KB）
- `bind.js`（0KB）
- `bindAll.js`（0KB）
- `bindKey.js`（0KB）
- `camelCase.js`（0KB）
- `capitalize.js`（0KB）
- `castArray.js`（0KB）
- `ceil.js`（0KB）
- `chain.js`（0KB）
- `chunk.js`（0KB）
- `clamp.js`（0KB）
- `clone.js`（0KB）
- `cloneDeep.js`（0KB）
- `cloneDeepWith.js`（0KB）
- `cloneWith.js`（0KB）
- `collection.js`（0KB）
- `commit.js`（0KB）
- `compact.js`（0KB）
- `complement.js`（0KB）
- `compose.js`（0KB）
- `concat.js`（0KB）
- `cond.js`（0KB）
- `conforms.js`（0KB）
- `conformsTo.js`（0KB）
- `constant.js`（0KB）
- `contains.js`（0KB）
- `convert.js`（1KB）
- `countBy.js`（0KB）
- `create.js`（0KB）
- `curry.js`（0KB）
- `curryN.js`（0KB）
- `curryRight.js`（0KB）
- `curryRightN.js`（0KB）
- `date.js`（0KB）
- `debounce.js`（0KB）
- `deburr.js`（0KB）
- `defaultTo.js`（0KB）
- `defaults.js`（0KB）
- `defaultsAll.js`（0KB）
- `defaultsDeep.js`（0KB）
- `defaultsDeepAll.js`（0KB）
- `defer.js`（0KB）
- `delay.js`（0KB）
- `difference.js`（0KB）
- `differenceBy.js`（0KB）
- `differenceWith.js`（0KB）
- `dissoc.js`（0KB）
- `dissocPath.js`（0KB）
- `divide.js`（0KB）
- `drop.js`（0KB）
- `dropLast.js`（0KB）
- `dropLastWhile.js`（0KB）
- `dropRight.js`（0KB）
- `dropRightWhile.js`（0KB）
- `dropWhile.js`（0KB）
- `each.js`（0KB）
- `eachRight.js`（0KB）
- `endsWith.js`（0KB）
- `entries.js`（0KB）
- `entriesIn.js`（0KB）
- `eq.js`（0KB）
- `equals.js`（0KB）
- `escape.js`（0KB）
- `escapeRegExp.js`（0KB）
- `every.js`（0KB）
- `extend.js`（0KB）
- `extendAll.js`（0KB）
- `extendAllWith.js`（0KB）
- `extendWith.js`（0KB）
- `fill.js`（0KB）
- `filter.js`（0KB）
- `find.js`（0KB）
- `findFrom.js`（0KB）
- `findIndex.js`（0KB）
- `findIndexFrom.js`（0KB）
- `findKey.js`（0KB）
- `findLast.js`（0KB）
- `findLastFrom.js`（0KB）
- `findLastIndex.js`（0KB）
- `findLastIndexFrom.js`（0KB）
- `findLastKey.js`（0KB）
- `first.js`（0KB）
- `flatMap.js`（0KB）
- `flatMapDeep.js`（0KB）
- `flatMapDepth.js`（0KB）
- `flatten.js`（0KB）
- `flattenDeep.js`（0KB）
- `flattenDepth.js`（0KB）
- `flip.js`（0KB）
- `floor.js`（0KB）
- `flow.js`（0KB）
- `flowRight.js`（0KB）
- `forEach.js`（0KB）
- `forEachRight.js`（0KB）
- `forIn.js`（0KB）
- `forInRight.js`（0KB）
- `forOwn.js`（0KB）
- `forOwnRight.js`（0KB）
- `fromPairs.js`（0KB）
- `function.js`（0KB）
- `functions.js`（0KB）
- `functionsIn.js`（0KB）
- `get.js`（0KB）
- `getOr.js`（0KB）
- `groupBy.js`（0KB）
- `gt.js`（0KB）
- `gte.js`（0KB）
- `has.js`（0KB）
- `hasIn.js`（0KB）
- `head.js`（0KB）
- `identical.js`（0KB）
- `identity.js`（0KB）
- `inRange.js`（0KB）
- `includes.js`（0KB）
- `includesFrom.js`（0KB）
- `indexBy.js`（0KB）
- `indexOf.js`（0KB）
- `indexOfFrom.js`（0KB）
- `init.js`（0KB）
- `initial.js`（0KB）
- `intersection.js`（0KB）
- `intersectionBy.js`（0KB）
- `intersectionWith.js`（0KB）
- `invert.js`（0KB）
- `invertBy.js`（0KB）
- `invertObj.js`（0KB）
- `invoke.js`（0KB）
- `invokeArgs.js`（0KB）
- `invokeArgsMap.js`（0KB）
- `invokeMap.js`（0KB）
- `isArguments.js`（0KB）
- `isArray.js`（0KB）
- `isArrayBuffer.js`（0KB）
- `isArrayLike.js`（0KB）
- `isArrayLikeObject.js`（0KB）
- `isBoolean.js`（0KB）
- `isBuffer.js`（0KB）
- `isDate.js`（0KB）
- `isElement.js`（0KB）
- `isEmpty.js`（0KB）
- `isEqual.js`（0KB）
- `isEqualWith.js`（0KB）
- `isError.js`（0KB）
- `isFinite.js`（0KB）
- `isFunction.js`（0KB）
- `isInteger.js`（0KB）
- `isLength.js`（0KB）
- `isMap.js`（0KB）
- `isMatch.js`（0KB）
- `isMatchWith.js`（0KB）
- `isNaN.js`（0KB）
- `isNative.js`（0KB）
- `isNil.js`（0KB）
- `isNull.js`（0KB）
- `isNumber.js`（0KB）
- `isObject.js`（0KB）
- `isObjectLike.js`（0KB）
- `isPlainObject.js`（0KB）
- `isRegExp.js`（0KB）
- `isSafeInteger.js`（0KB）
- `isSet.js`（0KB）
- `isString.js`（0KB）
- `isSymbol.js`（0KB）
- `isTypedArray.js`（0KB）
- `isUndefined.js`（0KB）
- `isWeakMap.js`（0KB）
- `isWeakSet.js`（0KB）
- `iteratee.js`（0KB）
- `join.js`（0KB）
- `juxt.js`（0KB）
- `kebabCase.js`（0KB）
- `keyBy.js`（0KB）
- `keys.js`（0KB）
- `keysIn.js`（0KB）
- `lang.js`（0KB）
- `last.js`（0KB）
- `lastIndexOf.js`（0KB）
- `lastIndexOfFrom.js`（0KB）
- `lowerCase.js`（0KB）
- `lowerFirst.js`（0KB）
- `lt.js`（0KB）
- `lte.js`（0KB）
- `map.js`（0KB）
- `mapKeys.js`（0KB）
- `mapValues.js`（0KB）
- `matches.js`（0KB）
- `matchesProperty.js`（0KB）
- `math.js`（0KB）
- `max.js`（0KB）
- `maxBy.js`（0KB）
- `mean.js`（0KB）
- `meanBy.js`（0KB）
- `memoize.js`（0KB）
- `merge.js`（0KB）
- `mergeAll.js`（0KB）
- `mergeAllWith.js`（0KB）
- `mergeWith.js`（0KB）
- `method.js`（0KB）
- `methodOf.js`（0KB）
- `min.js`（0KB）
- `minBy.js`（0KB）
- `mixin.js`（0KB）
- `multiply.js`（0KB）
- `nAry.js`（0KB）
- `negate.js`（0KB）
- `next.js`（0KB）
- `noop.js`（0KB）
- `now.js`（0KB）
- `nth.js`（0KB）
- `nthArg.js`（0KB）
- `number.js`（0KB）
- `object.js`（0KB）
- `omit.js`（0KB）
- `omitAll.js`（0KB）
- `omitBy.js`（0KB）
- `once.js`（0KB）
- `orderBy.js`（0KB）
- `over.js`（0KB）
- `overArgs.js`（0KB）
- `overEvery.js`（0KB）
- `overSome.js`（0KB）
- `pad.js`（0KB）
- `padChars.js`（0KB）
- `padCharsEnd.js`（0KB）
- `padCharsStart.js`（0KB）
- `padEnd.js`（0KB）
- `padStart.js`（0KB）
- `parseInt.js`（0KB）
- `partial.js`（0KB）
- `partialRight.js`（0KB）
- `partition.js`（0KB）
- `path.js`（0KB）
- `pathEq.js`（0KB）
- `pathOr.js`（0KB）
- `paths.js`（0KB）
- `pick.js`（0KB）
- `pickAll.js`（0KB）
- `pickBy.js`（0KB）
- `pipe.js`（0KB）
- `placeholder.js`（0KB）
- `plant.js`（0KB）
- `pluck.js`（0KB）
- `prop.js`（0KB）
- `propEq.js`（0KB）
- `propOr.js`（0KB）
- `property.js`（0KB）
- `propertyOf.js`（0KB）
- `props.js`（0KB）
- `pull.js`（0KB）
- `pullAll.js`（0KB）
- `pullAllBy.js`（0KB）
- `pullAllWith.js`（0KB）
- `pullAt.js`（0KB）
- `random.js`（0KB）
- `range.js`（0KB）
- `rangeRight.js`（0KB）
- `rangeStep.js`（0KB）
- `rangeStepRight.js`（0KB）
- `rearg.js`（0KB）
- `reduce.js`（0KB）
- `reduceRight.js`（0KB）
- `reject.js`（0KB）
- `remove.js`（0KB）
- `repeat.js`（0KB）
- `replace.js`（0KB）
- `rest.js`（0KB）
- `restFrom.js`（0KB）
- `result.js`（0KB）
- `reverse.js`（0KB）
- `round.js`（0KB）
- `sample.js`（0KB）
- `sampleSize.js`（0KB）
- `seq.js`（0KB）
- `set.js`（0KB）
- `setWith.js`（0KB）
- `shuffle.js`（0KB）
- `size.js`（0KB）
- `slice.js`（0KB）
- `snakeCase.js`（0KB）
- `some.js`（0KB）
- `sortBy.js`（0KB）
- `sortedIndex.js`（0KB）
- `sortedIndexBy.js`（0KB）
- `sortedIndexOf.js`（0KB）
- `sortedLastIndex.js`（0KB）
- `sortedLastIndexBy.js`（0KB）
- `sortedLastIndexOf.js`（0KB）
- `sortedUniq.js`（0KB）
- `sortedUniqBy.js`（0KB）
- `split.js`（0KB）
- `spread.js`（0KB）
- `spreadFrom.js`（0KB）
- `startCase.js`（0KB）
- `startsWith.js`（0KB）
- `string.js`（0KB）
- `stubArray.js`（0KB）
- `stubFalse.js`（0KB）
- `stubObject.js`（0KB）
- `stubString.js`（0KB）
- `stubTrue.js`（0KB）
- `subtract.js`（0KB）
- `sum.js`（0KB）
- `sumBy.js`（0KB）
- `symmetricDifference.js`（0KB）
- `symmetricDifferenceBy.js`（0KB）
- `symmetricDifferenceWith.js`（0KB）
- `tail.js`（0KB）
- `take.js`（0KB）
- `takeLast.js`（0KB）
- `takeLastWhile.js`（0KB）
- `takeRight.js`（0KB）
- `takeRightWhile.js`（0KB）
- `takeWhile.js`（0KB）
- `tap.js`（0KB）
- `template.js`（0KB）
- `templateSettings.js`（0KB）
- `throttle.js`（0KB）
- `thru.js`（0KB）
- `times.js`（0KB）
- `toArray.js`（0KB）
- `toFinite.js`（0KB）
- `toInteger.js`（0KB）
- `toIterator.js`（0KB）
- `toJSON.js`（0KB）
- `toLength.js`（0KB）
- `toLower.js`（0KB）
- `toNumber.js`（0KB）
- `toPairs.js`（0KB）
- `toPairsIn.js`（0KB）
- `toPath.js`（0KB）
- `toPlainObject.js`（0KB）
- `toSafeInteger.js`（0KB）
- `toString.js`（0KB）
- `toUpper.js`（0KB）
- `transform.js`（0KB）
- `trim.js`（0KB）
- `trimChars.js`（0KB）
- `trimCharsEnd.js`（0KB）
- `trimCharsStart.js`（0KB）
- `trimEnd.js`（0KB）
- `trimStart.js`（0KB）
- `truncate.js`（0KB）
- `unapply.js`（0KB）
- `unary.js`（0KB）
- `unescape.js`（0KB）
- `union.js`（0KB）
- `unionBy.js`（0KB）
- `unionWith.js`（0KB）
- `uniq.js`（0KB）
- `uniqBy.js`（0KB）
- `uniqWith.js`（0KB）
- `uniqueId.js`（0KB）
- `unnest.js`（0KB）
- `unset.js`（0KB）
- `unzip.js`（0KB）
- `unzipWith.js`（0KB）
- `update.js`（0KB）
- `updateWith.js`（0KB）
- `upperCase.js`（0KB）
- `upperFirst.js`（0KB）
- `useWith.js`（0KB）
- `util.js`（0KB）
- `value.js`（0KB）
- `valueOf.js`（0KB）
- `values.js`（0KB）
- `valuesIn.js`（0KB）
- `where.js`（0KB）
- `whereEq.js`（0KB）
- `without.js`（0KB）
- `words.js`（0KB）
- `wrap.js`（0KB）
- `wrapperAt.js`（0KB）
- `wrapperChain.js`（0KB）
- `wrapperLodash.js`（0KB）
- `wrapperReverse.js`（0KB）
- `wrapperValue.js`（0KB）
- `xor.js`（0KB）
- `xorBy.js`（0KB）
- `xorWith.js`（0KB）
- `zip.js`（0KB）
- `zipAll.js`（0KB）
- `zipObj.js`（0KB）
- `zipObject.js`（0KB）
- `zipObjectDeep.js`（0KB）
- `zipWith.js`（0KB）

## gltf/node_modules/log-update/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（2KB）
- `index.js`（2KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— log-update

## gltf/node_modules/log-update/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（5KB）
- `index.js`（5KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（5KB）　— ansi-styles

## gltf/node_modules/log-update/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（4KB）　— emoji-regex [![Build status](https://github.com/mathiasbynens/emoji-regex/actions/workfl…
- `index.d.ts`（0KB）
- `index.js`（14KB）
- `index.mjs`（14KB）
- `package.json`（1KB）

## gltf/node_modules/log-update/node_modules/is-fullwidth-code-point/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— is-fullwidth-code-point

## gltf/node_modules/log-update/node_modules/slice-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（4KB）　— \x1b and \x9b
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— slice-ansi [![XO: Linted](https://img.shields.io/badge/xo-linted-blue.svg)](https://gith…

## gltf/node_modules/log-update/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— string-width

## gltf/node_modules/log-update/node_modules/wrap-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（6KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— wrap-ansi

## gltf/node_modules/logform/（未归类）

待归类：请确认用途后归档。

- `.babelrc`（0KB）
- `.eslintrc`（0KB）
- `.gitattributes`（0KB）
- `CHANGELOG.md`（10KB）　— CHANGELOG
- `LICENSE`（1KB）
- `README.md`（18KB）　— logform
- `align.js`（0KB）
- `browser.js`（2KB）
- `cli.js`（1KB）
- `colorize.js`（3KB）　— Fix colors not appearing in non-tty environments
- `combine.js`（2KB）
- `errors.js`（1KB）　— eslint no-undefined: 0
- `format.js`（1KB）
- `index.d.ts`（6KB）　— Type definitions for logform 2.x
- `index.js`（2KB）
- `json.js`（1KB）
- `label.js`（0KB）
- `levels.js`（0KB）
- `logstash.js`（1KB）
- `metadata.js`（1KB）
- `ms.js`（0KB）
- `package.json`（1KB）
- `pad-levels.js`（3KB）　— eslint no-unused-vars: 0
- `pretty-print.js`（1KB）
- `printf.js`（1KB）
- `simple.js`（1KB）　— eslint no-undefined: 0
- `splat.js`（4KB）
- `timestamp.js`（1KB）
- `tsconfig.json`（0KB）
- `uncolorize.js`（1KB）

## gltf/node_modules/logform/dist/（未归类）

待归类：请确认用途后归档。

- `align.js`（0KB）
- `browser.js`（2KB）
- `cli.js`（3KB）
- `colorize.js`（5KB）
- `combine.js`（2KB）
- `errors.js`（2KB）　— eslint no-undefined: 0
- `format.js`（5KB）
- `index.js`（2KB）
- `json.js`（1KB）
- `label.js`（0KB）
- `levels.js`（0KB）
- `logstash.js`（1KB）
- `metadata.js`（2KB）
- `ms.js`（0KB）
- `pad-levels.js`（6KB）　— eslint no-unused-vars: 0
- `pretty-print.js`（1KB）
- `printf.js`（2KB）
- `simple.js`（1KB）　— eslint no-undefined: 0
- `splat.js`（7KB）
- `timestamp.js`（1KB）
- `uncolorize.js`（1KB）

## gltf/node_modules/logform/node_modules/@colors/colors/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— @colors/colors ("colors.js")
- `index.d.ts`（4KB）　— Type definitions for @colors/colors 1.4+
- `package.json`（1KB）
- `safe.d.ts`（3KB）　— Type definitions for Colors.js 1.2
- `safe.js`（0KB）　— Remark: Requiring this file will use the "safe" colors API,

## gltf/node_modules/logform/node_modules/@colors/colors/examples/（未归类）

待归类：请确认用途后归档。

- `normal-usage.js`（2KB）
- `safe-string.js`（2KB）

## gltf/node_modules/logform/node_modules/@colors/colors/lib/（未归类）

待归类：请确认用途后归档。

- `colors.js`（6KB）
- `extendStringPrototype.js`（3KB）
- `index.js`（0KB）
- `styles.js`（2KB）

## gltf/node_modules/logform/node_modules/@colors/colors/lib/custom/（未归类）

待归类：请确认用途后归档。

- `trap.js`（2KB）
- `zalgo.js`（3KB）　— please no

## gltf/node_modules/logform/node_modules/@colors/colors/lib/maps/（未归类）

待归类：请确认用途后归档。

- `america.js`（0KB）
- `rainbow.js`（0KB）
- `random.js`（0KB）
- `zebra.js`（0KB）

## gltf/node_modules/logform/node_modules/@colors/colors/lib/system/（未归类）

待归类：请确认用途后归档。

- `has-flag.js`（1KB）
- `supports-colors.js`（4KB）

## gltf/node_modules/logform/node_modules/@colors/colors/themes/（未归类）

待归类：请确认用途后归档。

- `generic-logging.js`（0KB）

## gltf/node_modules/lru-cache/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（11KB）　— lru-cache
- `package.json`（3KB）

## gltf/node_modules/lru-cache/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（53KB）
- `index.d.ts.map`（14KB）
- `index.js`（54KB）
- `index.js.map`（133KB）
- `index.min.js`（17KB）
- `index.min.js.map`（116KB）
- `package.json`（0KB）

## gltf/node_modules/lru-cache/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（53KB）
- `index.d.ts.map`（14KB）
- `index.js`（54KB）
- `index.js.map`（133KB）
- `index.min.js`（17KB）
- `index.min.js.map`（116KB）
- `package.json`（0KB）

## gltf/node_modules/meshoptimizer/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（1KB）
- `README.md`（32KB）　— meshoptimizer.js
- `benchmark.js`（4KB）
- `index.d.ts`（0KB）
- `index.js`（0KB）
- `meshopt_clusterizer.d.ts`（2KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_clusterizer.js`（31KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_clusterizer.test.js`（4KB）
- `meshopt_decoder.cjs`（29KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_decoder.d.ts`（1KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_decoder.mjs`（28KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_decoder.test.js`（16KB）
- `meshopt_decoder_reference.js`（15KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_encoder.d.ts`（1KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_encoder.js`（24KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_encoder.test.js`（8KB）
- `meshopt_simplifier.d.ts`（2KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_simplifier.js`（54KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_simplifier.test.js`（6KB）
- `meshopt_tangents.d.ts`（1KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_tangents.js`（10KB）　— This file is part of meshoptimizer library and is distributed under the terms of MIT Lic…
- `meshopt_tangents.test.js`（2KB）
- `package.json`（1KB）
- `wasi_trace.js`（1KB）　— Usage:

## gltf/node_modules/micromatch/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（38KB）　— micromatch [![NPM version](https://img.shields.io/npm/v/micromatch.svg?style=flat)](http…
- `index.js`（14KB）
- `package.json`（3KB）

## gltf/node_modules/mikktspace/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（5KB）　— mikktspace-wasm
- `package.json`（1KB）

## gltf/node_modules/mikktspace/dist/main/（未归类）

待归类：请确认用途后归档。

- `mikktspace_main.d.ts`（0KB）　— tslint:disable
- `mikktspace_main.js`（4KB）
- `mikktspace_main_bg.wasm`（41KB）
- `mikktspace_main_bg.wasm.d.ts`（0KB）　— tslint:disable

## gltf/node_modules/mikktspace/dist/module/（未归类）

待归类：请确认用途后归档。

- `mikktspace_module.d.ts`（0KB）　— tslint:disable
- `mikktspace_module.js`（0KB）
- `mikktspace_module_bg.js`（3KB）
- `mikktspace_module_bg.wasm`（41KB）
- `mikktspace_module_bg.wasm.d.ts`（0KB）　— tslint:disable

## gltf/node_modules/mimic-function/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（3KB）　— `Function#length` should reflect the parameters of `to` not `from` since we keep its bod…
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）

## gltf/node_modules/minimatch/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（18KB）　— minimatch
- `package.json`（2KB）

## gltf/node_modules/minimatch/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `assert-valid-pattern.d.ts`（0KB）
- `assert-valid-pattern.d.ts.map`（0KB）
- `assert-valid-pattern.js`（0KB）
- `assert-valid-pattern.js.map`（1KB）
- `ast.d.ts`（1KB）
- `ast.d.ts.map`（1KB）
- `ast.js`（27KB）　— parse a single path portion
- `ast.js.map`（51KB）
- `brace-expressions.d.ts`（0KB）
- `brace-expressions.d.ts.map`（0KB）
- `brace-expressions.js`（6KB）　— translate the various posix character classes into unicode properties
- `brace-expressions.js.map`（10KB）
- `escape.d.ts`（1KB）
- `escape.d.ts.map`（0KB）
- `escape.js`（1KB）
- `escape.js.map`（1KB）
- `index.d.ts`（4KB）
- `index.d.ts.map`（3KB）
- `index.js`（39KB）
- `index.js.map`（73KB）
- `package.json`（0KB）
- `unescape.d.ts`（1KB）
- `unescape.d.ts.map`（0KB）
- `unescape.js`（1KB）
- `unescape.js.map`（1KB）

## gltf/node_modules/minimatch/dist/esm/（未归类）

待归类：请确认用途后归档。

- `assert-valid-pattern.d.ts`（0KB）
- `assert-valid-pattern.d.ts.map`（0KB）
- `assert-valid-pattern.js`（0KB）
- `assert-valid-pattern.js.map`（1KB）
- `ast.d.ts`（1KB）
- `ast.d.ts.map`（1KB）
- `ast.js`（27KB）　— parse a single path portion
- `ast.js.map`（51KB）
- `brace-expressions.d.ts`（0KB）
- `brace-expressions.d.ts.map`（0KB）
- `brace-expressions.js`（5KB）　— translate the various posix character classes into unicode properties
- `brace-expressions.js.map`（10KB）
- `escape.d.ts`（1KB）
- `escape.d.ts.map`（0KB）
- `escape.js`（1KB）
- `escape.js.map`（1KB）
- `index.d.ts`（4KB）
- `index.d.ts.map`（3KB）
- `index.js`（37KB）
- `index.js.map`（73KB）
- `package.json`（0KB）
- `unescape.d.ts`（1KB）
- `unescape.d.ts.map`（0KB）
- `unescape.js`（1KB）
- `unescape.js.map`（1KB）

## gltf/node_modules/minipass/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（2KB）　— Blue Oak Model License
- `README.md`（27KB）　— minipass
- `package.json`（2KB）

## gltf/node_modules/minipass/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（19KB）
- `index.d.ts.map`（47KB）
- `index.js`（33KB）
- `index.js.map`（65KB）
- `package.json`（0KB）

## gltf/node_modules/minipass/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（19KB）
- `index.d.ts.map`（47KB）
- `index.js`（33KB）
- `index.js.map`（65KB）
- `package.json`（0KB）

## gltf/node_modules/ms/（未归类）

待归类：请确认用途后归档。

- `index.js`（3KB）
- `license.md`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）

## gltf/node_modules/ndarray/（未归类）

待归类：请确认用途后归档。

- `.travis.yml`（0KB）
- `CHANGELOG.md`（0KB）　— Changelog
- `LICENSE`（1KB）
- `README.md`（9KB）
- `ndarray.js`（10KB）
- `package.json`（1KB）

## gltf/node_modules/ndarray-lanczos/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）　— ndarray-lanczos
- `package.json`（2KB）

## gltf/node_modules/ndarray-lanczos/dist/（未归类）

待归类：请确认用途后归档。

- `ndarray-lanczos.cjs`（2KB）
- `ndarray-lanczos.cjs.map`（12KB）
- `ndarray-lanczos.modern.js`（2KB）
- `ndarray-lanczos.modern.js.map`（12KB）

## gltf/node_modules/ndarray-lanczos/dist/src/（未归类）

待归类：请确认用途后归档。

- `convolve.d.ts`（0KB）
- `index.d.ts`（0KB）

## gltf/node_modules/ndarray-lanczos/dist/vendor/（未归类）

待归类：请确认用途后归档。

- `filters.d.ts`（1KB）

## gltf/node_modules/ndarray-lanczos/src/（未归类）

待归类：请确认用途后归档。

- `convolve.ts`（2KB）
- `index.ts`（2KB）

## gltf/node_modules/ndarray-lanczos/vendor/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）　— Lanczos TypeScript Implementation
- `filters.ts`（3KB）

## gltf/node_modules/ndarray-ops/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `LICENSE`（1KB）
- `README.md`（6KB）
- `ndarray-ops.js`（13KB）
- `package.json`（1KB）

## gltf/node_modules/ndarray-pixels/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（4KB）　— ndarray-pixels
- `package.json`（2KB）

## gltf/node_modules/ndarray-pixels/dist/（未归类）

待归类：请确认用途后归档。

- `ndarray-pixels-browser.cjs`（6KB）
- `ndarray-pixels-browser.d.cts`（1KB）　— #region src/index.browser.d.ts
- `ndarray-pixels-browser.d.ts`（1KB）　— #region src/index.browser.d.ts
- `ndarray-pixels-browser.js`（4KB）　— #region src/get-pixels.browser.ts
- `ndarray-pixels-node.cjs`（5KB）
- `ndarray-pixels-node.d.cts`（1KB）　— #region src/index.node.d.ts
- `ndarray-pixels-node.d.mts`（1KB）　— #region src/index.node.d.ts
- `ndarray-pixels-node.mjs`（4KB）　— #region src/get-pixels.node.ts

## gltf/node_modules/ndarray-pixels/src/（未归类）

待归类：请确认用途后归档。

- `common.ts`（2KB）
- `get-pixels.browser.ts`（1KB）
- `get-pixels.node.ts`（1KB）
- `index.browser.ts`（2KB）
- `index.node.ts`（2KB）
- `save-pixels.browser.ts`（1KB）
- `save-pixels.node.ts`（1KB）

## gltf/node_modules/one-time/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（2KB）　— one-time
- `async.js`（1KB）
- `index.js`（1KB）
- `package.json`（1KB）

## gltf/node_modules/onetime/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— onetime

## gltf/node_modules/package-json-from-dist/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（2KB）
- `README.md`（3KB）　— package-json-from-dist
- `package.json`（2KB）

## gltf/node_modules/package-json-from-dist/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（3KB）
- `index.d.ts.map`（0KB）
- `index.js`（5KB）
- `index.js.map`（7KB）
- `package.json`（0KB）

## gltf/node_modules/package-json-from-dist/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（3KB）
- `index.d.ts.map`（0KB）
- `index.js`（4KB）
- `index.js.map`（7KB）
- `package.json`（0KB）

## gltf/node_modules/path-key/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）　— <reference types="node" />
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— path-key [![Build Status](https://travis-ci.org/sindresorhus/path-key.svg?branch=master)…

## gltf/node_modules/path-scurry/（未归类）

待归类：请确认用途后归档。

- `LICENSE.md`（2KB）　— Blue Oak Model License
- `README.md`（22KB）　— path-scurry
- `package.json`（2KB）

## gltf/node_modules/path-scurry/dist/commonjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（39KB）　— <reference types="node" />
- `index.d.ts.map`（18KB）
- `index.js`（65KB）
- `index.js.map`（128KB）
- `package.json`（0KB）

## gltf/node_modules/path-scurry/dist/esm/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（39KB）　— <reference types="node" resolution-mode="require"/>
- `index.d.ts.map`（18KB）
- `index.js`（63KB）　— TODO: test perf of fs/promises realpath vs realpathCB,
- `index.js.map`（129KB）
- `package.json`（0KB）

## gltf/node_modules/picomatch/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（27KB）
- `index.js`（0KB）
- `package.json`（2KB）

## gltf/node_modules/picomatch/lib/（未归类）

待归类：请确认用途后归档。

- `constants.js`（4KB）
- `parse.js`（33KB）
- `picomatch.js`（10KB）
- `scan.js`（9KB）
- `utils.js`（2KB）

## gltf/node_modules/prompts/（未归类）

待归类：请确认用途后归档。

- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（28KB）

## gltf/node_modules/prompts/dist/（未归类）

待归类：请确认用途后归档。

- `index.js`（7KB）
- `prompts.js`（9KB）

## gltf/node_modules/prompts/dist/dateparts/（未归类）

待归类：请确认用途后归档。

- `datepart.js`（1KB）
- `day.js`（1KB）
- `hours.js`（1KB）
- `index.js`（0KB）
- `meridiem.js`（0KB）
- `milliseconds.js`（1KB）
- `minutes.js`（0KB）
- `month.js`（1KB）
- `seconds.js`（0KB）
- `year.js`（0KB）

## gltf/node_modules/prompts/dist/elements/（未归类）

待归类：请确认用途后归档。

- `autocomplete.js`（9KB）
- `autocompleteMultiselect.js`（5KB）
- `confirm.js`（2KB）
- `date.js`（7KB）
- `index.js`（0KB）
- `multiselect.js`（7KB）
- `number.js`（7KB）
- `prompt.js`（2KB）
- `select.js`（5KB）
- `text.js`（6KB）
- `toggle.js`（3KB）

## gltf/node_modules/prompts/dist/util/（未归类）

待归类：请确认用途后归档。

- `action.js`（1KB）
- `clear.js`（2KB）
- `entriesToDisplay.js`（1KB）
- `figures.js`（1KB）
- `index.js`（0KB）
- `lines.js`（0KB）
- `strip.js`（0KB）
- `style.js`（1KB）
- `wrap.js`（1KB）

## gltf/node_modules/prompts/lib/（未归类）

待归类：请确认用途后归档。

- `index.js`（3KB）
- `prompts.js`（9KB）

## gltf/node_modules/prompts/lib/dateparts/（未归类）

待归类：请确认用途后归档。

- `datepart.js`（1KB）
- `day.js`（1KB）
- `hours.js`（1KB）
- `index.js`（0KB）
- `meridiem.js`（0KB）
- `milliseconds.js`（1KB）
- `minutes.js`（0KB）
- `month.js`（1KB）
- `seconds.js`（0KB）
- `year.js`（0KB）

## gltf/node_modules/prompts/lib/elements/（未归类）

待归类：请确认用途后归档。

- `autocomplete.js`（8KB）
- `autocompleteMultiselect.js`（5KB）
- `confirm.js`（2KB）
- `date.js`（6KB）
- `index.js`（0KB）
- `multiselect.js`（7KB）
- `number.js`（6KB）
- `prompt.js`（2KB）
- `select.js`（5KB）
- `text.js`（5KB）
- `toggle.js`（3KB）

## gltf/node_modules/prompts/lib/util/（未归类）

待归类：请确认用途后归档。

- `action.js`（1KB）
- `clear.js`（0KB）
- `entriesToDisplay.js`（1KB）
- `figures.js`（1KB）
- `index.js`（0KB）
- `lines.js`（0KB）
- `strip.js`（0KB）
- `style.js`（1KB）　— rendering user input.
- `wrap.js`（1KB）

## gltf/node_modules/property-graph/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（5KB）　— property-graph
- `package.json`（2KB）

## gltf/node_modules/property-graph/dist/（未归类）

待归类：请确认用途后归档。

- `index.d.mts`（13KB）　— #region src/graph-edge.d.ts
- `index.mjs`（16KB）　— #region src/event-dispatcher.ts

## gltf/node_modules/property-graph/src/（未归类）

待归类：请确认用途后归档。

- `constants.ts`（1KB）　— TypeScript utility for nullable types.
- `event-dispatcher.ts`（2KB）
- `graph-edge.ts`（2KB）
- `graph-node.ts`（13KB）　— eslint-disable @typescript-eslint/no-explicit-any
- `graph.ts`（3KB）
- `index.ts`（0KB）
- `refs.ts`（3KB）

## gltf/node_modules/punycode/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（6KB）　— Punycode.js [![punycode on npm](https://img.shields.io/npm/v/punycode)](https://www.npmj…
- `package.json`（1KB）
- `punycode.es6.js`（12KB）　— Highest positive signed 32-bit float value
- `punycode.js`（12KB）　— Highest positive signed 32-bit float value

## gltf/node_modules/readable-stream/（未归类）

待归类：请确认用途后归档。

- `CONTRIBUTING.md`（1KB）　— Developer's Certificate of Origin 1.1
- `GOVERNANCE.md`（5KB）　— ## Streams Working Group
- `LICENSE`（2KB）
- `README.md`（5KB）　— readable-stream
- `errors-browser.js`（4KB）
- `errors.js`（4KB）
- `experimentalWarning.js`（0KB）
- `package.json`（2KB）
- `readable-browser.js`（0KB）
- `readable.js`（1KB）

## gltf/node_modules/readable-stream/lib/（未归类）

待归类：请确认用途后归档。

- `_stream_duplex.js`（4KB）　— Copyright Joyent, Inc. and other Node contributors.
- `_stream_passthrough.js`（2KB）　— Copyright Joyent, Inc. and other Node contributors.
- `_stream_readable.js`（35KB）　— Copyright Joyent, Inc. and other Node contributors.
- `_stream_transform.js`（8KB）　— Copyright Joyent, Inc. and other Node contributors.
- `_stream_writable.js`（21KB）　— Copyright Joyent, Inc. and other Node contributors.

## gltf/node_modules/readable-stream/lib/internal/streams/（未归类）

待归类：请确认用途后归档。

- `async_iterator.js`（6KB）
- `buffer_list.js`（7KB）
- `destroy.js`（3KB）　— undocumented cb() API, needed for core, not for public API
- `end-of-stream.js`（3KB）　— Ported from https://github.com/mafintosh/end-of-stream with
- `from-browser.js`（0KB）
- `from.js`（4KB）
- `pipeline.js`（2KB）　— Ported from https://github.com/mafintosh/pump with
- `state.js`（1KB）
- `stream-browser.js`（0KB）
- `stream.js`（0KB）

## gltf/node_modules/restore-cursor/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（0KB）　— restore-cursor

## gltf/node_modules/rfdc/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `default.js`（0KB）
- `index.d.ts`（0KB）
- `index.js`（6KB）
- `index.test-d.ts`（0KB）
- `package.json`（2KB）
- `readme.md`（5KB）　— rfdc

## gltf/node_modules/rfdc/.github/workflows/（未归类）

待归类：请确认用途后归档。

- `ci.yml`（0KB）

## gltf/node_modules/rfdc/test/（未归类）

待归类：请确认用途后归档。

- `index.js`（12KB）

## gltf/node_modules/safe-buffer/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（19KB）　— safe-buffer [![travis][travis-image]][travis-url] [![npm][npm-image]][npm-url] [![downlo…
- `index.d.ts`（9KB）
- `index.js`（2KB）　— ! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource>
- `package.json`（1KB）

## gltf/node_modules/safe-stable-stringify/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `index.d.ts`（1KB）
- `index.js`（19KB）　— @ts-expect-error
- `package.json`（2KB）
- `readme.md`（6KB）　— safe-stable-stringify

## gltf/node_modules/safe-stable-stringify/esm/（未归类）

待归类：请确认用途后归档。

- `package.json`（0KB）
- `wrapper.d.ts`（0KB）
- `wrapper.js`（0KB）

## gltf/node_modules/semver/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（25KB）
- `index.js`（3KB）　— just pre-load all the stuff that index.js lazily exports
- `package.json`（2KB）
- `preload.js`（0KB）　— XXX remove in v8 or beyond
- `range.bnf`（1KB）

## gltf/node_modules/semver/bin/（未归类）

待归类：请确认用途后归档。

- `semver.js`（5KB）　— Standalone semver comparison program.

## gltf/node_modules/semver/classes/（未归类）

待归类：请确认用途后归档。

- `comparator.js`（4KB）　— hoisted class for cyclic dependency
- `index.js`（0KB）
- `range.js`（15KB）　— hoisted class for cyclic dependency
- `semver.js`（10KB）

## gltf/node_modules/semver/functions/（未归类）

待归类：请确认用途后归档。

- `clean.js`（0KB）
- `cmp.js`（1KB）
- `coerce.js`（2KB）
- `compare-build.js`（0KB）
- `compare-loose.js`（0KB）
- `compare.js`（0KB）
- `diff.js`（1KB）
- `eq.js`（0KB）
- `gt.js`（0KB）
- `gte.js`（0KB）
- `inc.js`（0KB）
- `lt.js`（0KB）
- `lte.js`（0KB）
- `major.js`（0KB）
- `minor.js`（0KB）
- `neq.js`（0KB）
- `parse.js`（0KB）
- `patch.js`（0KB）
- `prerelease.js`（0KB）
- `rcompare.js`（0KB）
- `rsort.js`（0KB）
- `satisfies.js`（0KB）
- `sort.js`（0KB）
- `truncate.js`（1KB）
- `valid.js`（0KB）

## gltf/node_modules/semver/internal/（未归类）

待归类：请确认用途后归档。

- `constants.js`（1KB）　— Note: this is the semver.org version of the spec that it implements
- `debug.js`（0KB）
- `identifiers.js`（1KB）
- `lrucache.js`（1KB）
- `parse-options.js`（0KB）　— parse out just the options we care about
- `re.js`（8KB）

## gltf/node_modules/semver/ranges/（未归类）

待归类：请确认用途后归档。

- `gtr.js`（0KB）　— Determine if version is greater than all the versions possible in the range.
- `intersects.js`（0KB）
- `ltr.js`（0KB）　— Determine if version is less than all the versions possible in the range
- `max-satisfying.js`（1KB）
- `min-satisfying.js`（1KB）
- `min-version.js`（1KB）
- `outside.js`（2KB）
- `simplify.js`（1KB）　— given a set of versions and a range, create a "simplified" range
- `subset.js`（7KB）　— Complex range `r1 || r2 || ...` is a subset of `R1 || R2 || ...` iff:
- `to-comparators.js`（0KB）　— Mostly just for testing and legacy API reasons
- `valid.js`（0KB）

## gltf/node_modules/sharp/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（10KB）
- `README.md`（3KB）　— sharp
- `package.json`（8KB）

## gltf/node_modules/sharp/dist/（未归类）

待归类：请确认用途后归档。

- `channel.cjs`（5KB）
- `channel.mjs`（5KB）
- `colour.cjs`（5KB）
- `colour.mjs`（5KB）
- `composite.cjs`（9KB）
- `composite.mjs`（9KB）
- `constructor.cjs`（20KB）
- `constructor.mjs`（20KB）
- `index.cjs`（1KB）
- `index.d.cts`（91KB）　— SPDX-License-Identifier: MIT
- `index.d.mts`（86KB）　— SPDX-License-Identifier: MIT
- `index.mjs`（1KB）
- `input.cjs`（33KB）
- `input.mjs`（33KB）
- `is.cjs`（3KB）
- `is.mjs`（3KB）
- `libvips.cjs`（6KB）
- `libvips.mjs`（6KB）
- `operation.cjs`（32KB）
- `operation.mjs`（32KB）
- `output.cjs`（64KB）
- `output.mjs`（64KB）
- `resize.cjs`（22KB）
- `resize.mjs`（22KB）
- `sharp.cjs`（6KB）
- `sharp.mjs`（6KB）
- `utility.cjs`（10KB）
- `utility.mjs`（10KB）

## gltf/node_modules/sharp/install/（未归类）

待归类：请确认用途后归档。

- `build.js`（1KB）

## gltf/node_modules/sharp/lib/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（91KB）　— SPDX-License-Identifier: MIT

## gltf/node_modules/sharp/src/（未归类）

待归类：请确认用途后归档。

- `binding.gyp`（11KB）　— Copyright 2013 Lovell Fuller and others.
- `common.cc`（41KB）
- `common.h`（11KB）
- `metadata.cc`（15KB）
- `metadata.h`（2KB）
- `operations.cc`（17KB）
- `operations.h`（4KB）
- `pipeline.cc`（90KB）
- `pipeline.h`（10KB）
- `sharp.cc`（1KB）
- `stats.cc`（7KB）
- `stats.h`（1KB）
- `utilities.cc`（9KB）
- `utilities.h`（1KB）

## gltf/node_modules/shebang-command/（未归类）

待归类：请确认用途后归档。

- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（0KB）　— shebang-command [![Build Status](https://travis-ci.org/kevva/shebang-command.svg?branch=…

## gltf/node_modules/shebang-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— shebang-regex [![Build Status](https://travis-ci.org/sindresorhus/shebang-regex.svg?bran…

## gltf/node_modules/signal-exit/（未归类）

待归类：请确认用途后归档。

- `LICENSE.txt`（1KB）
- `README.md`（2KB）　— signal-exit
- `package.json`（3KB）

## gltf/node_modules/signal-exit/dist/cjs/（未归类）

待归类：请确认用途后归档。

- `browser.d.ts`（0KB）
- `browser.d.ts.map`（0KB）
- `browser.js`（0KB）
- `browser.js.map`（1KB）
- `index.d.ts`（2KB）　— <reference types="node" />
- `index.d.ts.map`（0KB）
- `index.js`（9KB）
- `index.js.map`（17KB）
- `package.json`（0KB）
- `signals.d.ts`（1KB）　— <reference types="node" />
- `signals.d.ts.map`（0KB）
- `signals.js`（2KB）
- `signals.js.map`（2KB）

## gltf/node_modules/signal-exit/dist/mjs/（未归类）

待归类：请确认用途后归档。

- `browser.d.ts`（0KB）
- `browser.d.ts.map`（0KB）
- `browser.js`（0KB）
- `browser.js.map`（1KB）
- `index.d.ts`（2KB）　— <reference types="node" />
- `index.d.ts.map`（0KB）
- `index.js`（9KB）　— Note: since nyc uses this module to output coverage, any lines
- `index.js.map`（17KB）
- `package.json`（0KB）
- `signals.d.ts`（1KB）　— <reference types="node" />
- `signals.d.ts.map`（0KB）
- `signals.js`（1KB）
- `signals.js.map`（2KB）

## gltf/node_modules/sisteransi/（未归类）

待归类：请确认用途后归档。

- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— sister ANSI [![Version](https://img.shields.io/npm/v/sisteransi.svg)](https://www.npmjs.…

## gltf/node_modules/sisteransi/src/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）
- `sisteransi.d.ts`（1KB）

## gltf/node_modules/slice-ansi/（未归类）

待归类：请确认用途后归档。

- `index.js`（3KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— slice-ansi [![XO: Linted](https://img.shields.io/badge/xo-linted-blue.svg)](https://gith…

## gltf/node_modules/slice-ansi/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（5KB）
- `index.js`（5KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（5KB）　— ansi-styles

## gltf/node_modules/stack-trace/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `License`（1KB）
- `Makefile`（0KB）
- `Readme.md`（4KB）　— stack-trace
- `package.json`（1KB）

## gltf/node_modules/stack-trace/lib/（未归类）

待归类：请确认用途后归档。

- `stack-trace.js`（3KB）

## gltf/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— string-width

## gltf/node_modules/string-width-cjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— string-width

## gltf/node_modules/string-width-cjs/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— ansi-regex

## gltf/node_modules/string-width-cjs/node_modules/is-fullwidth-code-point/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）　— eslint-disable yoda
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— is-fullwidth-code-point [![Build Status](https://travis-ci.org/sindresorhus/is-fullwidth…

## gltf/node_modules/string-width-cjs/node_modules/strip-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— strip-ansi [![Build Status](https://travis-ci.org/chalk/strip-ansi.svg?branch=master)](h…

## gltf/node_modules/string-width/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— ansi-regex

## gltf/node_modules/string-width/node_modules/is-fullwidth-code-point/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（2KB）　— eslint-disable yoda
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— is-fullwidth-code-point [![Build Status](https://travis-ci.org/sindresorhus/is-fullwidth…

## gltf/node_modules/string-width/node_modules/strip-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— strip-ansi [![Build Status](https://travis-ci.org/chalk/strip-ansi.svg?branch=master)](h…

## gltf/node_modules/string_decoder/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（2KB）
- `README.md`（2KB）　— string_decoder
- `package.json`（1KB）

## gltf/node_modules/string_decoder/lib/（未归类）

待归类：请确认用途后归档。

- `string_decoder.js`（9KB）　— Copyright Joyent, Inc. and other Node contributors.

## gltf/node_modules/strip-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— strip-ansi

## gltf/node_modules/strip-ansi-cjs/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— strip-ansi [![Build Status](https://travis-ci.org/chalk/strip-ansi.svg?branch=master)](h…

## gltf/node_modules/strip-ansi-cjs/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— ansi-regex

## gltf/node_modules/supports-color/（未归类）

待归类：请确认用途后归档。

- `browser.js`（0KB）
- `index.js`（3KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— supports-color [![Build Status](https://travis-ci.org/chalk/supports-color.svg?branch=ma…

## gltf/node_modules/table/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（18KB）
- `package.json`（2KB）

## gltf/node_modules/table/dist/（未归类）

待归类：请确认用途后归档。

- `alignString.js`（3KB）
- `alignString.js.flow`（2KB）
- `alignString.js.map`（4KB）
- `alignTableData.js`（1KB）
- `alignTableData.js.flow`（0KB）
- `alignTableData.js.map`（1KB）
- `calculateCellHeight.js`（1KB）
- `calculateCellHeight.js.flow`（1KB）
- `calculateCellHeight.js.map`（1KB）
- `calculateCellWidthIndex.js`（1KB）
- `calculateCellWidthIndex.js.flow`（0KB）
- `calculateCellWidthIndex.js.map`（1KB）
- `calculateMaximumColumnWidthIndex.js`（1KB）
- `calculateMaximumColumnWidthIndex.js.flow`（1KB）
- `calculateMaximumColumnWidthIndex.js.map`（1KB）
- `calculateRowHeightIndex.js`（1KB）
- `calculateRowHeightIndex.js.flow`（1KB）
- `calculateRowHeightIndex.js.map`（2KB）
- `createStream.js`（4KB）
- `createStream.js.flow`（3KB）
- `createStream.js.map`（6KB）
- `drawBorder.js`（2KB）
- `drawBorder.js.flow`（2KB）
- `drawBorder.js.map`（4KB）
- `drawRow.js`（1KB）
- `drawRow.js.flow`（0KB）
- `drawRow.js.map`（1KB）
- `drawTable.js`（1KB）
- `drawTable.js.flow`（1KB）
- `drawTable.js.map`（2KB）
- `getBorderCharacters.js`（2KB）
- `getBorderCharacters.js.flow`（2KB）　— eslint-disable sort-keys
- `getBorderCharacters.js.map`（5KB）
- `index.js`（1KB）
- `index.js.flow`（0KB）
- `index.js.map`（0KB）
- `makeConfig.js`（3KB）
- `makeConfig.js.flow`（2KB）
- `makeConfig.js.map`（4KB）
- `makeStreamConfig.js`（3KB）
- `makeStreamConfig.js.flow`（2KB）
- `makeStreamConfig.js.map`（4KB）
- `mapDataUsingRowHeightIndex.js`（1KB）
- `mapDataUsingRowHeightIndex.js.flow`（1KB）
- `mapDataUsingRowHeightIndex.js.map`（2KB）
- `padTableData.js`（1KB）
- `padTableData.js.flow`（0KB）
- `padTableData.js.map`（1KB）
- `stringifyTableData.js`（0KB）
- `stringifyTableData.js.flow`（0KB）
- `stringifyTableData.js.map`（1KB）
- `table.js`（4KB）
- `table.js.flow`（3KB）
- `table.js.map`（4KB）
- `truncateTableData.js`（1KB）
- `truncateTableData.js.flow`（0KB）
- `truncateTableData.js.map`（1KB）
- `validateConfig.js`（24KB）
- `validateConfig.js.flow`（1KB）　— eslint-disable-next-line import/default
- `validateConfig.js.map`（2KB）
- `validateStreamConfig.js`（23KB）
- `validateTableData.js`（2KB）
- `validateTableData.js.flow`（1KB）
- `validateTableData.js.map`（2KB）
- `wrapCell.js`（1KB）
- `wrapCell.js.flow`（1KB）
- `wrapCell.js.map`（2KB）
- `wrapString.js`（1KB）
- `wrapString.js.flow`（1KB）
- `wrapString.js.map`（1KB）
- `wrapWord.js`（1KB）
- `wrapWord.js.flow`（1KB）
- `wrapWord.js.map`（2KB）

## gltf/node_modules/table/dist/schemas/（未归类）

待归类：请确认用途后归档。

- `config.json`（3KB）
- `streamConfig.json`（3KB）

## gltf/node_modules/table/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— ansi-regex [![Build Status](https://travis-ci.org/chalk/ansi-regex.svg?branch=master)](h…

## gltf/node_modules/table/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.js`（3KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（4KB）　— ansi-styles [![Build Status](https://travis-ci.org/chalk/ansi-styles.svg?branch=master)]…

## gltf/node_modules/table/node_modules/color-convert/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（1KB）　— 1.0.0 - 2016-01-07
- `LICENSE`（1KB）
- `README.md`（3KB）　— color-convert
- `conversions.js`（16KB）　— MIT license
- `index.js`（2KB）
- `package.json`（1KB）
- `route.js`（2KB）

## gltf/node_modules/table/node_modules/color-name/（未归类）

待归类：请确认用途后归档。

- `.eslintrc.json`（1KB）
- `.npmignore`（1KB）　— this will affect all the git repos
- `LICENSE`（1KB）
- `README.md`（0KB）
- `index.js`（5KB）
- `package.json`（1KB）
- `test.js`（0KB）

## gltf/node_modules/table/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（3KB）　— emoji-regex [![Build status](https://travis-ci.org/mathiasbynens/emoji-regex.svg?branch=…
- `index.d.ts`（0KB）
- `index.js`（7KB）
- `package.json`（1KB）
- `text.js`（7KB）

## gltf/node_modules/table/node_modules/emoji-regex/es2015/（未归类）

待归类：请确认用途后归档。

- `index.js`（8KB）
- `text.js`（8KB）

## gltf/node_modules/table/node_modules/is-fullwidth-code-point/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）　— eslint-disable yoda
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— is-fullwidth-code-point [![Build Status](https://travis-ci.org/sindresorhus/is-fullwidth…

## gltf/node_modules/table/node_modules/slice-ansi/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— slice-ansi [![Build Status](https://travis-ci.org/chalk/slice-ansi.svg?branch=master)](h…

## gltf/node_modules/table/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（1KB）　— string-width [![Build Status](https://travis-ci.org/sindresorhus/string-width.svg?branch…

## gltf/node_modules/table/node_modules/strip-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— strip-ansi [![Build Status](https://travis-ci.org/chalk/strip-ansi.svg?branch=master)](h…

## gltf/node_modules/text-hex/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（0KB）　— text-hex
- `index.js`（0KB）
- `package.json`（1KB）
- `test.js`（0KB）

## gltf/node_modules/tmp/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（12KB）
- `package.json`（1KB）

## gltf/node_modules/tmp/lib/（未归类）

待归类：请确认用途后归档。

- `tmp.js`（25KB）

## gltf/node_modules/to-regex-range/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（13KB）　— to-regex-range [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https:/…
- `index.js`（6KB）
- `package.json`（2KB）

## gltf/node_modules/triple-beam/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（0KB）　— CHANGELOG
- `LICENSE`（1KB）
- `README.md`（1KB）　— triple-beam
- `index.js`（1KB）
- `package.json`（1KB）

## gltf/node_modules/triple-beam/.nyc_output/（未归类）

待归类：请确认用途后归档。

- `c579bf8f-6820-47a5-b2da-a11267eb8435.json`（3KB）

## gltf/node_modules/triple-beam/.nyc_output/processinfo/（未归类）

待归类：请确认用途后归档。

- `c579bf8f-6820-47a5-b2da-a11267eb8435.json`（1KB）
- `index.json`（1KB）

## gltf/node_modules/triple-beam/config/（未归类）

待归类：请确认用途后归档。

- `cli.js`（1KB）
- `index.js`（1KB）
- `npm.js`（1KB）
- `syslog.js`（1KB）

## gltf/node_modules/tslib/（未归类）

待归类：请确认用途后归档。

- `CopyrightNotice.txt`（1KB）
- `LICENSE.txt`（1KB）
- `README.md`（4KB）　— tslib
- `SECURITY.md`（3KB）
- `package.json`（1KB）
- `tslib.d.ts`（18KB）
- `tslib.es6.html`（0KB）
- `tslib.es6.js`（19KB）
- `tslib.es6.mjs`（17KB）
- `tslib.html`（0KB）
- `tslib.js`（23KB）

## gltf/node_modules/tslib/modules/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）　— Note: named reexports are used instead of `export *` because
- `index.js`（1KB）
- `package.json`（0KB）

## gltf/node_modules/uniq/（未归类）

待归类：请确认用途后归档。

- `.npmignore`（0KB）
- `LICENSE`（1KB）
- `README.md`（1KB）
- `package.json`（1KB）
- `uniq.js`（1KB）

## gltf/node_modules/uniq/test/（未归类）

待归类：请确认用途后归档。

- `test.js`（0KB）

## gltf/node_modules/uri-js/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（6KB）　— URI.js
- `package.json`（2KB）
- `yarn.lock`（102KB）　— THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

## gltf/node_modules/uri-js/dist/es5/（未归类）

待归类：请确认用途后归档。

- `uri.all.d.ts`（2KB）
- `uri.all.js`（56KB）　— @license URI.js v4.4.1 (c) 2011 Gary Court. License: http://github.com/garycourt/uri-js
- `uri.all.js.map`（100KB）
- `uri.all.min.d.ts`（2KB）
- `uri.all.min.js`（17KB）　— @license URI.js v4.4.1 (c) 2011 Gary Court. License: http://github.com/garycourt/uri-js
- `uri.all.min.js.map`（81KB）

## gltf/node_modules/uri-js/dist/esnext/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（1KB）
- `index.js.map`（1KB）
- `regexps-iri.d.ts`（0KB）
- `regexps-iri.js`（0KB）
- `regexps-iri.js.map`（0KB）
- `regexps-uri.d.ts`（0KB）
- `regexps-uri.js`（8KB）
- `regexps-uri.js.map`（8KB）
- `uri.d.ts`（2KB）
- `uri.js`（20KB）
- `uri.js.map`（19KB）
- `util.d.ts`（0KB）
- `util.js`（1KB）
- `util.js.map`（2KB）

## gltf/node_modules/uri-js/dist/esnext/schemes/（未归类）

待归类：请确认用途后归档。

- `http.d.ts`（0KB）
- `http.js`（1KB）
- `http.js.map`（1KB）
- `https.d.ts`（0KB）
- `https.js`（0KB）
- `https.js.map`（0KB）
- `mailto.d.ts`（0KB）
- `mailto.js`（8KB）　— RFC 3986
- `mailto.js.map`（7KB）
- `urn-uuid.d.ts`（0KB）
- `urn-uuid.js`（1KB）　— RFC 4122
- `urn-uuid.js.map`（1KB）
- `urn.d.ts`（0KB）
- `urn.js`（2KB）　— RFC 2141
- `urn.js.map`（2KB）
- `ws.d.ts`（0KB）
- `ws.js`（2KB）
- `ws.js.map`（2KB）
- `wss.d.ts`（0KB）
- `wss.js`（0KB）
- `wss.js.map`（0KB）

## gltf/node_modules/util-deprecate/（未归类）

待归类：请确认用途后归档。

- `History.md`（0KB）
- `LICENSE`（1KB）
- `README.md`（2KB）
- `browser.js`（2KB）
- `node.js`（0KB）
- `package.json`（1KB）

## gltf/node_modules/watlas/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（5KB）　— # watlas
- `package.json`（0KB）

## gltf/node_modules/watlas/dist/（未归类）

待归类：请确认用途后归档。

- `watlas.d.ts`（4KB）　— Copyright (c) 2025 Brandon Jones
- `watlas.js`（88KB）
- `watlas.wasm`（220KB）

## gltf/node_modules/which/（未归类）

待归类：请确认用途后归档。

- `CHANGELOG.md`（3KB）　— Changes
- `LICENSE`（1KB）
- `README.md`（1KB）　— which
- `package.json`（1KB）
- `which.js`（3KB）

## gltf/node_modules/which/bin/（未归类）

待归类：请确认用途后归档。

- `node-which`（1KB）

## gltf/node_modules/winston/（未归类）

待归类：请确认用途后归档。

- `LICENSE`（1KB）
- `README.md`（34KB）　— winston
- `index.d.ts`（6KB）　— Type definitions for winston 3.0
- `package.json`（2KB）

## gltf/node_modules/winston-transport/（未归类）

待归类：请确认用途后归档。

- `.babelrc`（0KB）
- `.eslintrc`（0KB）
- `.gitattributes`（0KB）
- `CHANGELOG.md`（4KB）　— CHANGELOG
- `LICENSE`（1KB）
- `README.md`（1KB）　— winston-transport
- `index.d.ts`（1KB）　— Type definitions for winston-transport 3.0
- `index.js`（0KB）　— Expose modern transport directly as the export
- `legacy.js`（4KB）
- `modern.js`（7KB）
- `package.json`（1KB）

## gltf/node_modules/winston-transport/.nyc_output/（未归类）

待归类：请确认用途后归档。

- `68e78020-c804-4f37-a68a-a967c6380da9.json`（22KB）

## gltf/node_modules/winston-transport/.nyc_output/processinfo/（未归类）

待归类：请确认用途后归档。

- `68e78020-c804-4f37-a68a-a967c6380da9.json`（1KB）
- `index.json`（0KB）

## gltf/node_modules/winston-transport/dist/（未归类）

待归类：请确认用途后归档。

- `index.js`（0KB）　— Expose modern transport directly as the export
- `legacy.js`（4KB）
- `modern.js`（7KB）

## gltf/node_modules/winston/dist/（未归类）

待归类：请确认用途后归档。

- `winston.js`（4KB）

## gltf/node_modules/winston/dist/winston/（未归类）

待归类：请确认用途后归档。

- `common.js`（1KB）
- `container.js`（6KB）
- `create-logger.js`（7KB）
- `exception-handler.js`（9KB）
- `exception-stream.js`（5KB）
- `logger.js`（26KB）
- `profiler.js`（3KB）
- `rejection-handler.js`（9KB）
- `tail-file.js`（3KB）

## gltf/node_modules/winston/dist/winston/config/（未归类）

待归类：请确认用途后归档。

- `index.js`（1KB）

## gltf/node_modules/winston/dist/winston/transports/（未归类）

待归类：请确认用途后归档。

- `console.js`（8KB）　— eslint-disable no-console
- `file.js`（27KB）　— eslint-disable complexity,max-statements
- `http.js`（13KB）
- `index.js`（1KB）
- `stream.js`（6KB）

## gltf/node_modules/winston/lib/（未归类）

待归类：请确认用途后归档。

- `winston.js`（4KB）

## gltf/node_modules/winston/lib/winston/（未归类）

待归类：请确认用途后归档。

- `common.js`（1KB）
- `container.js`（3KB）
- `create-logger.js`（3KB）
- `exception-handler.js`（7KB）
- `exception-stream.js`（1KB）
- `logger.js`（19KB）
- `profiler.js`（1KB）
- `rejection-handler.js`（7KB）
- `tail-file.js`（3KB）

## gltf/node_modules/winston/lib/winston/config/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（2KB）　— Type definitions for winston 3.0
- `index.js`（1KB）

## gltf/node_modules/winston/lib/winston/transports/（未归类）

待归类：请确认用途后归档。

- `console.js`（3KB）　— eslint-disable no-console
- `file.js`（20KB）　— eslint-disable complexity,max-statements
- `http.js`（7KB）
- `index.d.ts`（3KB）　— Type definitions for winston 3.0
- `index.js`（1KB）
- `stream.js`（2KB）

## gltf/node_modules/wrap-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（6KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— wrap-ansi

## gltf/node_modules/wrap-ansi-cjs/（未归类）

待归类：请确认用途后归档。

- `index.js`（6KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— wrap-ansi [![Build Status](https://travis-ci.com/chalk/wrap-ansi.svg?branch=master)](htt…

## gltf/node_modules/wrap-ansi-cjs/node_modules/ansi-regex/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（3KB）　— ansi-regex

## gltf/node_modules/wrap-ansi-cjs/node_modules/strip-ansi/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（0KB）
- `index.js`（0KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— strip-ansi [![Build Status](https://travis-ci.org/chalk/strip-ansi.svg?branch=master)](h…

## gltf/node_modules/wrap-ansi/node_modules/ansi-styles/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（5KB）
- `index.js`（5KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（5KB）　— ansi-styles

## gltf/node_modules/wrap-ansi/node_modules/emoji-regex/（未归类）

待归类：请确认用途后归档。

- `LICENSE-MIT.txt`（1KB）
- `README.md`（4KB）　— emoji-regex [![Build status](https://travis-ci.org/mathiasbynens/emoji-regex.svg?branch=…
- `RGI_Emoji.d.ts`（0KB）
- `RGI_Emoji.js`（13KB）
- `index.d.ts`（0KB）
- `index.js`（15KB）
- `package.json`（1KB）
- `text.d.ts`（0KB）
- `text.js`（14KB）

## gltf/node_modules/wrap-ansi/node_modules/emoji-regex/es2015/（未归类）

待归类：请确认用途后归档。

- `RGI_Emoji.d.ts`（0KB）
- `RGI_Emoji.js`（14KB）
- `index.d.ts`（0KB）
- `index.js`（17KB）
- `text.d.ts`（0KB）
- `text.js`（15KB）

## gltf/node_modules/wrap-ansi/node_modules/string-width/（未归类）

待归类：请确认用途后归档。

- `index.d.ts`（1KB）
- `index.js`（1KB）
- `license`（1KB）
- `package.json`（1KB）
- `readme.md`（2KB）　— string-width

## map/（项目索引（指哪打哪））

**动手前的第一站**：`gen_index.js` 扫源码生成 `js/modules.json`（唯一权威模块清单）与 `.workbuddy/index/project-index.json`（符号/断言/资产/标定表）；`who.js <关键词>` 反查"改哪里、波及什么、跑哪条验证"。铁律：索引必须被构建与审计消费，过期由 smoke §591 报红。

- `gen_index.js`（26KB）　— 小工具 ----------------
- `who.js`（15KB）

## mem/（记忆维护）

MEMORY.md 必须 < 9600 字符（超出会被会话注入截断，尾部规则等于不存在）。`slim_memory_template.py` = 把超限整段 cut 到 `docs/` 的模板。

- `distill_log_0913.py`（3KB）　— 蒸馏 2026-09-13 日志（82KB）。
- `finalize_v67.py`（4KB）　— 收口：日志空行 · MEMORY 同步整改结论 · 定位浏览器 store（存档位置）。
- `fix_log_0913.py`（3KB）　— 回填蒸馏误删的 4 行 + 用**实测结论**替换那个错误的说明头。
- `measure_dialog.py`（2KB）　— 量"本次对话的记录"有多少与 docs 重复（决定压缩能删多少、以及会不会丢信息）。
- `memory_v67c.py`（4KB）　— v67 第三轮记忆：项目盘点 + 地图 + 判断（追加日志；MEMORY.md 只加一行索引）。
- `slim_and_locate.py`（4KB）　— MEMORY 超限 256 字符 → 精修（内容不丢，只收紧句子）＋ 定位浏览器 store。
- `slim_memory_template.py`（7KB）　— 最后一次瘦身：把「素材与图标」「配色细则」整段迁到 docs/AI工作备忘.md，
- `slim_memory_v67.py`（25KB）　— v67 记忆整理：MEMORY.md 压回注入上限内，明细下移到 docs/AI工作备忘.md。
- `trim_last.py`（1KB）　— MEMORY 还差 37 字符：三处收紧（不删任何规则）。
- `wrapup_v67.py`（4KB）　— 收尾：日志追加 · 刷新工具索引（本轮新增的脚本要入册）。

## patch/（变更日志（补丁脚本））

**事实上的变更日志**：按断言名 `grep -rl "<断言名>" tools/patch/` 就能找到当初是哪次改的。"同一条消息里对同一文件的多次 Edit 会互相覆盖"，所以补丁一律脚本化并留档。

- `add_smoke_589.js`（3KB）　— 一次性补丁：在 §588 之后插入 §589（海面波形"必须非周期"的源码级守卫）。
- `add_smoke_590.js`（6KB）　— v156.23：新增门禁 §590「占领首府 → 该州辖地全境在望」
- `add_smoke_590b.js`（4KB）　— v156.23：§590 追加两条 —— ⑥真实占领链路 ⑦挂钩在册（源码级）
- `add_smoke_590c.js`（1KB）　— v156.24c：§590 追加一条 —— 已占行政城不再画成紫色敌方城（源码级防回归）
- `add_smoke_591.py`（6KB）　— 在 smoke 里插入 §591：项目索引（单一清单）的 5 条断言。
- `apply_abandon.py`（14KB）　— v67 补丁 B：放弃城池（唯一入口 + 城池关联数据登记表 + 界面入口）。
- `apply_cols.py`（6KB）　— v67 补丁 A：侧栏「资源 / 驻军」两列数字各自成列、拉开间距。
- `build_bundle.py`（10KB）　— v91.61 地基第 1 期 —— bundle 构建器（确定性 · 离线可用 · 不依赖 esbuild）。
- `bump_version.py`（6KB）　— 发版脚本（v90.94 治理版）：一次同步三处版本标识里的「代码侧两处」。
- `check_v89226_confirm.py`（2KB）　— v89.226 复核：素材层三证复跑（apply 完整性 + 切分确定性）。
- `check_v89226_themes.py`（4KB）　— v89.226 复核：地块染色 4 主题 × 8 族 全量逐字节复验。
- `check_v9094_cachebust_compare.py`（1KB）　— 对照实验：证明旧 cachebust.js 的正则前缀约束 (js|story)/ 会漏掉 vendor/three.min.js。
- `clean_gate_dupes.py`（3KB）　— 清理 gate.py 的叠加式腐化：`_gate_timeout` 与 `run_one` 各被定义两次。
- `clean_v9095_oneoff.py`（3KB）
- `design_v89225_plot.py`（6KB）　— v89.225 地块色设计 · ΔE00 矩阵实测（**v1 草稿** —— 保留作迭代起点）
- `design_v89227_plot.py`（5KB）　— v89.227 城内地块族色 v2 设计：8 族 → 4 族 + 整体降饱和（老板：「族有点多了」「太显眼，视觉负担大」）。
- `design_v89229_block.py`（5KB）　— v89.229 设计脚本：城内地块文字色块配色（4 族 × 4 主题）
- `design_v89229_block3.py`（3KB）　— v89.229 设计脚本 v3：色块最终矩阵（族间 ΔE00 / 离地 / 白字对比）
- `diag_a4_anchor.py`（1KB）　— 诊断 v2：直接对比 file 段与补丁 old 段
- `dump_v89222_ab.py`（1KB）　— v89.222 · 兵牌简称 troopAbOf 现状 + 相关区段
- `dump_v89222_final.py`（2KB）　— v89.222 · 收尾取证：档案原文 / 灰岗用法 / 杂项上下文
- `dump_v89222_last.py`（2KB）　— v89.222 · 最后取证：§179/§164 区段原文 + 版本号 + 计数
- `dump_v89222_regions.py`（1KB）　— v89.222 · 关键区段原文 dump（供定级）
- `extract_check.py`（2KB）　— 按 check 名字片段抽取 smoke-test.js 里整块 check(...) 源码（括号配平）。
- `finalize_v89222.py`（2KB）　— v89.222 · 收尾：记忆追加 + 技能沉淀（§132 + §131.3 决议标注）
- `finalize_v89223.py`（2KB）　— v89.223 收尾：工作记忆 + 技能沉淀（§133 + §131.3 补注）。
- `finalize_v89225.py`（8KB）　— v89.225 收尾：档案总览行 + 明细段 · 工作记忆 · 技能 §135（各自幂等）
- `finalize_v89226.py`（4KB）　— v89.226 复核 · 工作记忆 + 技能 §136 沉淀。
- `finalize_v89227_b.py`（8KB）　— v89.227 收尾 B：需求档案 + 工作记忆 + 技能 §137 + 设计脚本注。
- `finalize_v89227_map.py`（5KB）　— v89.227 收尾 A：废土术语映射表更新（批次二销账 + 执行明细 + 新长尾 + 本轮记录）。
- `finalize_v89228.py`（4KB）　— v89.228 收尾：工作记忆 + 技能沉淀（§138）。
- `finish_cleanup_v67.py`（8KB）　— v67 清理收尾：
- `finish_cleanup_v67b.py`（8KB）　— v67 清理收尾（第二次执行 —— 上一轮在「合并旧文档」处被中断）。
- `finish_cleanup_v67c.py`（9KB）　— v67 清理收尾 · 第三次（补齐上一轮崩溃点之后的剩余动作）。
- `fix214_archive_scope.py`（3KB）　— v89.214 收口 2：把"误还原"的产品断言回改成新名。
- `fix216_archive_revert.py`（3KB）　— v89.216：把**读档案的断言**里被换皮词表改过的串，还原成老板原文（档案不参与换皮）。
- `fix8940_smoke_lord.py`（3KB）　— 修正 smoke 的君主运行时断言：现场补临时君主/对照将（打完移除），保证不放空。
- `fix_probe_cam.js`（5KB）　— ① 机位：用省府城所在格定向（省府必在陆地），而不是辖地陆地质心（该省半数是海）
- `fix_smoke_591_fresh.py`（2KB）　— 修 §591④：把"索引新鲜度"从"跟 bundle.hash 比"改成"跟**当前源码**重算比"。
- `fixnum_v89228.py`（1KB）　— v89.228 口径修正：docs 同步量 1260 → 1380 处（实测 711+270+83+141+23+19+17+7+18+2+9+0=1300 + C2 77 =…
- `patchC2_core.py`（14KB）　— v90.93 批次C2：全屏剧本（荒野场景流程）整条退役。
- `patchC2_deadcfg.py`（8KB）　— v90.93 批次C1/C2 遗留清理：
- `patchC2_e2e.py`（10KB）　— v90.93 批次C2：e2e 剧本用例段 → 一次性结算 + 退役守卫
- `patchC2_smokefix.py`（6KB）　— v90.93 批次C2：修 smoke 两条越界守卫
- `patchC2_tests.py`（11KB）　— v90.93 批次C2 配套：smoke 口径同步（全屏剧本退役）。
- `patch_adm_marker_own.js`（2KB）　— v156.24c：已被我方占据的行政中心城，不再画成紫色敌方城。
- `patch_admin_pure.js`（3KB）　— v156.24b：把 adminCiList 的过滤逻辑抽成**纯函数** `adminCisOf(fields, level, index)`，
- `patch_admin_reveal.js`（12KB）　— v156.24：把「首府视野」从「13 州(NPC_CITIES.state)」换到**地图真正的省/市/区
- `patch_audit_modules.py`（2KB）　— audit.js 的两份模块清单改从 js/modules.json 读（单一来源）。
- `patch_axis_note.js`（3KB）　— v156.25：把「转身轴」的判据写进 seatProp 与 surfaceQuad 两处，防止未来各改一半导致分叉。
- `patch_build_gate.py`（11KB）　— v68 · 逐步探索：建造前置规则（老板 2026-09-14 需求）
- `patch_build_gate_fix.py`（8KB）　— v68 修正：buildPrereqOf 支持"新建语义"，并适配受影响的既有测试。
- `patch_build_gate_fix2.py`（3KB）　— v68 修正 2：govMax 作用域提升。
- `patch_build_gate_fix3.py`（2KB）　— v68 修正 3：第 54 节测试自身的 bug —— free54 需能"避开已在用的格"。
- `patch_build_gate_test.py`（10KB）　— v68 · 建造前置：e2e 适配 + smoke 第 54 节断言。
- `patch_build_layout.py`（3KB）　— 让 build_bundle.py 从 js/modules.json 的 layout 读顺序与分包。
- `patch_city_attr_slim.py`（13KB）　— v71 · 城池属性只显示城池命名（侧栏短名 + 下拉框带坐标；配套 patch_city_attr_slim2.py）
- `patch_city_attr_slim2.py`（11KB）　— v71 续 · 城池下拉框单城也保留 + 选项显示州郡县坐标（配套 patch_city_attr_slim.py）
- `patch_conquer_state.js`（2KB）　— v156.23：占领首府 → 该州辖地全境在望（挂到 GAME.onConquer，唯一占领出口）
- `patch_dialog_doc.py`（7KB）　— v68 · 弹窗统一：smoke 第 56 节守卫 + docs/设计规范.md §11。
- `patch_dialog_unify.py`（23KB）　— v68 · 弹窗统一（老板 2026-09-14：「点击建筑出来的弹窗……尽量统一」）
- `patch_fog_state.js`（3KB）　— v156.23：在 fog.js 加 `revealState`，并让「已占首府」在 revealOwned 里幂等重刷。
- `patch_gate_baseline.py`（7KB）　— v156.26 · 门禁「已知失败基线」——把 9 条历史红从"每次人工判断"变成"机器判断"。
- `patch_gate_baseline_cli.py`（4KB）　— v156.26b：给 gate.py 接上 `--update-baseline`（人工显式更新基线）。
- `patch_gate_judge_order.py`（2KB）　— v156.26d · 修 judge() 的判据顺序 bug —— 基线之所以没生效，就卡在这里。
- `patch_gate_retry.py`（5KB）　— v156.26e · 门禁「失败复跑」——把"并发抖动"和"真回归"分开。
- `patch_git_docs.py`（7KB）　— 补丁：把「版本库 + 自动同步」写进 docs/项目地图.md，并订正被我改旧的数字。
- `patch_gold_v2.py`（4KB）　— v89.91 patch v2：修黄金脑「购书过度购买」bug + 补日志。
- `patch_gov_center.py`（16KB）　— v68 · 官府居中（老板 2026-09-14）：
- `patch_gov_center_fix.py`（5KB）　— v68 官府居中 · 修正：剩余 4 处断言适配。
- `patch_guanfu_dlg_ico.py`（6KB）　— v72 · 修：官府（及城外建筑）「升级中」弹窗被 1024px 位图撑爆（老板：
- `patch_invasion.py`（15KB）　— 第 2 期 · 防守（定期被攻打）—— 核心机制落地。
- `patch_invasion_dedupe.py`（4KB）　— 补丁 7：删掉重复的 `GAME.resName`，并补防回退断言。
- `patch_invasion_docs.py`（6KB）　— 补丁 6（收尾）：三份文档同步 —— 登记新出口 + 标注第 2 期落地 + 更正第 1 期误判。
- `patch_invasion_resname.py`（3KB）　— 补丁 3/3：修 `DATA.RESOURCES` 的取值方式。
- `patch_invasion_severity.py`（3KB）　— 补丁 5：修 severity 的返回口径。
- `patch_invasion_test.py`（8KB）　— 补丁 4：给「定期来袭」补 smoke 断言（第 53 节）。
- `patch_invasion_ui.py`（4KB）　— 补丁 2/2：把「定期来袭」的输出值接进界面（照断粮警示的成例）。
- `patch_ladder_doc.py`（6KB）　— 补丁：更正「数值断层」这条过期结论。
- `patch_lib_plan.py`（5KB）　— v1：设计文档加 3.6 扩充池 + 规划 §十八 补素材库索引。幂等。
- `patch_ling_plan.py`（4KB）　— v1：玩法扩展规划.md §十八 追加（修炼装备·灵气 + 江湖游历设计挂钩）。幂等。
- `patch_plan_rxsg.py`（16KB）　— 规划文档补丁：第四轮 —— 热血三国玩法对照 · 缺口清单与可行性（2026-09-16）。
- `patch_play2_doc.py`（18KB）　— 把老板第二轮玩法清单（9 项）并入 docs/玩法扩展规划.md。
- `patch_play3_doc.py`（6KB）　— 第三轮：把拍板结果与落地清单并入 docs/玩法扩展规划.md（追加第十六章）。
- `patch_play4_doc.py`（3KB）　— 第四轮：追加 16.6（官府居中）+ 16.7（弃城核实结论）到 docs/玩法扩展规划.md。
- `patch_play_600x_v2.py`（11KB）　— patch_play_600x_v2.py — 修复驾驶舱 v1 的三处逻辑缺陷并落盘（python 定点替换）。
- `patch_play_600x_v3.py`（10KB）　— patch_play_600x_v3.py — 幂等修复驾驶舱（每项：已有→跳过；缺失→替换）。
- `patch_play_600x_v4.py`（5KB）　— patch_play_600x_v4.py — 幂等补丁：采集前置（须自家野地）+ 持续占领 + 里程碑时序。
- `patch_play_600x_v5.py`（11KB）　— patch_play_600x_v5.py — 幂等补丁（v4）：真人操作补齐。
- `patch_play_600x_v6.py`（3KB）　— patch_play_600x_v6.py — 幂等终修（正式跑前的最后补丁）。
- `patch_play_exit.py`（1KB）
- `patch_play_farm2.py`（5KB）　— 生成 play_farm2_600x.js：与 play_gold_600x.js 逐字同骨架，
- `patch_play_gold.py`（8KB）　— v89.91：从 play_600x.js fork 出 play_gold_600x.js（黄金流对照驾驶舱）。
- `patch_quest_ready.py`（24KB）　— v69：任务列表 —— 可领取的自动置顶 + 行右侧直接「领取」。
- `patch_quest_ready_e2efix.py`（4KB）　— v69 修正（e2e）：领取按钮按 **rq57 自己的 id** 取，不取"第一个"。
- `patch_quest_ready_fix.py`（3KB）　— v69 修正：① 第 57 节 withState 跨节不可见 → 用本地 helper
- `patch_quest_ready_live.py`（6KB）　— v69 补缺：让「达标即置顶」是**真·自动**。
- `patch_slice_first.js`（1KB）
- `patch_slice_greedy.js`（3KB）　— v156.26：给 smoke_slice.js 的非连续拼装加「逐段试编」——保证生成的切片一定能跑。
- `patch_slice_run.js`（4KB）　— v156.26c：给 smoke_slice 加两件事，让它"崩了也说清楚崩在哪"：
- `patch_slice_tail.js`（4KB）　— v156.26b：修 smoke_slice 的收尾判定 ——
- `patch_smoke_uiall.js`（4KB）　— v156.27c：给 smoke 一个统一入口 `__uiAll()`，把所有「读 js/ui.js 源码」收口。
- `patch_split_hoist.js`（6KB）　— v156.27b：让 split_ui.js 自动处理「跨功能的顶层局部变量」。
- `patch_split_safe.js`（3KB）　— 修 split_ui.js 的切点判定：**用试编译证明切点在顶层**，不再靠缩进猜。
- `patch_state_field.js`（4KB）　— v156.23（老板「占领省市区首府，可以看到该省市区下辖地的视野」）
- `patch_story_engine.py`（6KB）　— patch_story_engine.py —— 把「文字游戏 · 故事库引擎」挂进 js/state.js
- `patch_story_final.py`（5KB）　— patch_story_final.py -- (a) wild entry for UNOWNED tiles, (b) e2e section 81
- `patch_story_smoke.py`（5KB）　— patch_story_smoke.py -- add smoke section 81 (text game / story library)
- `patch_story_smoke2.py`（2KB）　— patch_story_smoke2.py -- fix smoke 81 assertion semantics
- `patch_story_ui.py`（9KB）　— patch_story_ui.py -- wire the text-game reader into js/ui.js
- `patch_story_vol01.py`（2KB）　— patch_story_vol01.py —— 补足 vol-01 三处幕文字数（每幕 >= 250 判据）
- `patch_story_wire.py`（5KB）　— patch_story_wire.py -- wire the text game into main.js / index.html / smoke-test.js
- `patch_test_rc.py`（1KB）
- `patch_ui_order.js`（3KB）　— v156.27：把 ui.js 拆出的 18 个文件接进**所有模块清单**。
- `patch_v67_save.py`（23KB）　— v67 · 补一套存档系统（老板：「补一个存档，看什么存档设计合适」）。
- `patch_v67_save2.py`（9KB）　— v67 · 存档系统 补丁 2/2：对话框 · 导出导入 · 首页入口 · 样式。
- `patch_v67_save3.py`（19KB）　— v67 · 存档系统 补丁 3/3：修 audit 死函数 · 更新受影响的断言 · 补新护栏。
- `patch_v67_save3b.py`（4KB）　— 补丁 3b：把 e2e 的存档面板用例插到收尾的 `G.ui.setView('city');` 之前。
- `patch_v67_save4.py`（4KB）　— 补丁 4：把 smoke 那条"面板 7 行"从"查 CSS 存在"改成"查渲染源"。
- `patch_v67_terrain.py`（3KB）　— 收口：退役最后一张地形位图 ai_terrain_city.png + 重生成注册表 + 收紧断言。
- `patch_v70_adapt.py`（5KB）　— v70 适配：让既有测试跟上「君主也是将领」这一新事实（不改测试意图，只改口径）。
- `patch_v70_city_lord.py`（25KB）　— v70 · 第 2 块（坐标与迁址）+ 第 3 块（君主将领）。
- `patch_v70_create.py`（18KB）　— v70 · 第 4 块：创建界面（老板需求 5）。
- `patch_v70_geo.py`（16KB）　— v70 · 第 1 块：州郡县标识 + 城外满配数量表 + 城内仓库 4 座。
- `patch_v70_test.py`（22KB）　— v70 测试：smoke 第 58 节（五项需求的断言）+ e2e 追加（真实 DOM 走查）。
- `patch_v73_core.py`（21KB）　— v73 核心层补丁：黄金闸门 / 资质再降10倍 / 种田秘境（数据 + 域 + 系统）
- `patch_v73_docs.py`（12KB）　— v73 文档补丁：设计规范 §11 修订 + §14 新增 / AI工作备忘 §16 / 需求档案 v73 登记
- `patch_v73_tests.py`（26KB）　— v73 测试补丁：口径修正（prodBreakdown）+ smoke/e2e 守卫更新 + 新增 v73 断言节
- `patch_v73_ui.py`（21KB）　— v73 UI 层补丁：将领界面头部 / 建筑弹窗去顶图+吸底 / 种田秘境界面 / 官府入口
- `patch_v74_core.py`（9KB）　— v74 核心层补丁：①取消人口加成 / ⑤按类型成长 + 自由属性点
- `patch_v74_docs.py`（8KB）　— v74 文档补丁：设计规范 §15 + AI工作备忘 §17 + 需求档案 v74 登记
- `patch_v74_fix.py`（12KB）　— v74 收尾修复：rankOf 补发路径 / 创建界面固定画布 / vh 换算 / 注释校准 / 测试口径收口
- `patch_v74_tests.py`（27KB）　— v74 测试补丁：守卫翻转（16 处）+ 新增第 60 节（v74 七条）
- `patch_v74_ui.py`（32KB）　— v74 UI 层补丁：③④⑤⑥ 将领档案改造 + ⑦ 出征界面完善 + ② 固定像素画布
- `patch_v75_docs.py`（8KB）　— v75 · 客栈招募界面 —— 文档补丁
- `patch_v75_fix.py`（6KB）　— v75 修 · 客栈候选行紧凑几何（行高 52 → 36）
- `patch_v75_tests.py`（9KB）　— v75 · 客栈招募界面 —— 测试补丁（e2e 两处翻转 + smoke 新增第 61 节）
- `patch_v75_ui.py`（16KB）　— v75 · 客栈招募界面（老板五条）—— UI 层补丁
- `patch_v76_docs.py`（11KB）　— v76 · 文档补丁
- `patch_v76_fix.py`（5KB）　— v76 修 · 三处真机验收抓出的偏差（均已落盘，本脚本留档；重跑全跳过）
- `patch_v76_tests.py`（24KB）　— v76 · 四条 —— 测试补丁（smoke 8 处 + e2e 3 处翻转/重做）
- `patch_v76_ui.py`（28KB）　— v76 · 四条（布局 / 地图导航 / 将领分页 / 建筑弹窗）—— 代码+样式补丁
- `patch_v77_core.py`（27KB）　— v77 · 核心层：月俸体系（7 游戏日结算）+ 百炼强化 + 内功 + 宝箱/徭役令数据。
- `patch_v77_docs.py`（11KB）　— v77 · 文档补丁：设计规范 §18 / AI工作备忘 §20 / 需求档案 v77。
- `patch_v77_fix.py`（7KB）　— v77 · 修复补丁：SHOP_CATS 补新货 / §62 转义修正 / 六处守卫收窄。
- `patch_v77_tests.py`（21KB）　— v77 · 测试补丁：翻转旧守卫（五处）+ 新增 smoke 第 62 节 + e2e 三处更新。
- `patch_v77_ui.py`（37KB）　— v77 · UI 层：客栈表格 / 君主面板分栏 / 野地下拉框 / 三按钮退役 / 百炼强化 / 内功显示。
- `patch_v78_core.py`（21KB）　— v78 · 核心层：灵草时序拉长 + 种子改为活动获得（去黄金） + 隐藏「灵淬」升档加成。
- `patch_v78_docs.py`（7KB）　— v78 · 文档补丁：设计规范 §19（新增）/ AI工作备忘 §二十一 / 需求档案 v78。
- `patch_v78_tests.py`（11KB）　— v78 · 测试层：smoke §59 链条改种子制 + 新增 §63（灵草时序/种子经济/灵淬）+ e2e 三处。
- `patch_v78_ui.py`（13KB）　— v78 · UI 层：选种改种子制 / 在手种子一览 / 种子背包行（去播种）/ 装备详情撤「穿给谁」。
- `patch_v79_a.py`（16KB）　— v79-A · 核心层：爵位加成 + 主城 + 神器（数据 / 状态 / 消费点）。
- `patch_v79_b.py`（13KB）　— v79-B · UI 层：爵位加成展示 / 主城标识与设置入口 / 神器面板。
- `patch_v79_c.py`（24KB）　— v79-C · 装备单件化：实例模型 { u, id, enh } + 同名 甲/乙 序号 + 按件强化。
- `patch_v79_d.py`（26KB）　— v79-D · UI 层：装备单件化显示（背包 / 详情 / 强化 / 换装 / 人形）。
- `patch_v79_e.py`（14KB）　— v79-E · 测试新增：smoke §64（v79 四条）+ e2e v79 真实 DOM 段。
- `patch_v80_docs.py`（11KB）　— v80 · 文档层：设计规范（§11.2/11.3 更新 + §16.4 + §21）/ AI工作备忘 §二十三 / 需求档案 v80。
- `patch_v80_tests.py`（16KB）　— v80 · 测试层：smoke 三处翻转 + 两处守卫升级 + 新增 §65；e2e 一处翻转 + 新增 v80 段。
- `patch_v80_ui.py`（16KB）　— v80 · UI 层：客栈固定表 / 建筑吸底操作区 / 兵营步兵骑兵分页与数量直输。
- `patch_v81_docs.py`（5KB）　— v81 · 文档补丁：设计规范 §22 / AI工作备忘 §二十四 / 需求档案 v81。
- `patch_v81_fix.py`（4KB）　— v81 · 修复补丁：五处 smoke 老测试给 troopsHTML() 先切步兵页。
- `patch_v81_tests.py`（13KB）　— v81 · 测试补丁：smoke 两处守卫演进 + 新增 §66；e2e 六处跟进 + v81 新段。
- `patch_v81_ui.py`（11KB）　— v81 · 主补丁：君主卡名称并入信息表首行 / 兵营三页制（队列 · 步兵 · 骑兵）。
- `patch_v82_core.py`（5KB）　— v82 · 核心层：君主凡品开局（①）/ 官府征收整段退役（③）。
- `patch_v82_css.py`（14KB）　— v82 · 字体统一（老板④）：各级标题 / 文字 / 备注的格式（族）、大小（七档）、粗细（三档）。
- `patch_v82_docs.py`（7KB）　— v82 · 文档补丁：设计规范 §23 / 备忘 §二十五 / 需求档案 v82。
- `patch_v82_fix.py`（4KB）　— v82 · 修复补丁：extraLand 退役（防 audit 零引用）+ 两处重复语句收编。
- `patch_v82_tests.py`（15KB）　— v82 · 测试补丁：老守卫跟进（征收退役 / 文案 / 字体共享规则）+ 新增 §67 + e2e 两处。
- `patch_v82_ui.py`（9KB）　— v82 · UI 层：官府面板重做（去征收 / 城名居中）/ 君主面板去档位文字 / 建筑弹窗去野地行 / 改名弹窗去原名。
- `patch_v83_core.py`（7KB）　— v83 · 核心层：野地经验惩罚机制（每 12 级一个台阶 · 掠夺 / 占领野地时生效）。
- `patch_v83_docs.py`（4KB）　— v83 · 文档补丁：设计规范 §24 / 备忘 §二十六 / 需求档案 v83。
- `patch_v83_fix.py`（3KB）　— v83 · 夹具修复：§57 任务置顶夹具的存量 flake（r18 与 g01/g02 同指标冲突）。
- `patch_v83_tests.py`（8KB）　— v83 · 测试补丁：smoke 新增 §68（台阶 / 系数 / 战报 / 出征全链路）+ e2e 小段。
- `patch_v84_core.py`（4KB）　— v84 · 核心层：兵种卡去「拥有」行 / 辎重车→骑兵、斥候→步兵。
- `patch_v84_docs.py`（6KB）　— v84 · 文档：设计规范 §25 / AI工作备忘 §二十七 / 需求档案 v84。
- `patch_v84_fix.py`（3KB）　— v84 · 顺手修存量 flake：e2e 第 23 节「出征弹窗行军预估」的固定偏移坐标。
- `patch_v84_tests.py`（7KB）　— v84 · 测试补丁：smoke 改判 v37 卡面行数断言（2 → 1）+ 新增 §69；e2e 新增 v84 段。
- `patch_v85_core.py`（5KB）　— v85 · 核心层（I）：民房去人口统计入口 / 地图占满+放大（fitMapCell 搜索式自适应）。
- `patch_v85_css.py`（3KB）　— v85 · CSS：底部缩略地图（条尾 40px）+ 天下大势面板（方形缩略图 + 图例）。
- `patch_v85_docs.py`（7KB）　— v85 · 文档：设计规范 §26 / AI工作备忘 §二十八 / 需求档案 v85。
- `patch_v85_fix.py`（4KB）　— v85 · 修复：两处存量守卫的兼容（smoke 首跑 2158/2 定位）。
- `patch_v85_fix2.py`（9KB）　— v85.1 · 全面复核修复：缩略地图「城点 × 州色块」零错位。
- `patch_v85_fix2_docs.py`（5KB）　— v85.1 · 文档补丁：复核修正记录（设计规范 §26.3 / 备忘 §28.5 / 档案 v85 复核段）。
- `patch_v85_fix2_tests.py`（2KB）　— v85.1 · 测试补丁：新增「174 城零错位」断言（复核修复的关键不变量）。
- `patch_v85_mini.py`（13KB）　— v85 · 核心层（II）：缩略地图 —— 数据派生（map.js）+ 渲染/面板/底部条（ui.js）。
- `patch_v85_tests.py`（10KB）　— v85 · 测试补丁：e2e 两处旧断言改判（12×6 → 13×11 / 动态）+ e2e v85 段 + smoke §70。
- `patch_v86_battle.py`（11KB）　— v86 · 核心层（II）：battle.js —— 计谋效果接线（全部作用于入参/结算，不改引擎）。
- `patch_v86_data.py`（5KB）　— v86 · 数据层：DATA.SCHEMES（计谋八计）+ 锦囊道具。
- `patch_v86_docs.py`（8KB）　— v86 · 文档补丁：设计规范 §27 / 备忘 §二十九 / 需求档案 v86 段。
- `patch_v86_state.py`（9KB）　— v86 · 核心层（I）：state.js —— 计谋出口组 + invasion 接线（空城计/坚壁清野）。
- `patch_v86_tests.py`（17KB）　— v86 · 测试补丁：smoke §71（九条 · 结构+行为）+ e2e v86 段（真实 DOM）。
- `patch_v86_ui.py`（13KB）　— v86 · UI 层：出征面板计略行 + 计略选择弹窗 + 城池布防 + 商城分类 + 事件分发。
- `patch_v86_ui2.py`（9KB）　— v86 · UI 改造（II）：计略选择由"子弹窗"改为**出征面板内嵌展开区**。
- `patch_v87_core.py`（14KB）　— v87 · 数据层 + 核心层：野地专属场景（老板「2.为各类野地设计专属弹窗场景」）。
- `patch_v87_docs.py`（7KB）　— v87 · 文档补丁：设计规范 §28 / 备忘 §三十 / 需求档案 v87 段。
- `patch_v87_tests.py`（9KB）　— v87 · 测试补丁：smoke §72（五条）+ e2e v87 段（真实 DOM）。
- `patch_v87_ui.py`（7KB）　— v87 · UI 层：野地弹窗「地形专属场景」区块（未占/已占两分支）+ 执行 + 分发。
- `patch_v881_core.py`（6KB）　— v88.1 整合（state.js）：删 wildScene 组（3 函数）→ 并入 jianghuDo 的 scene 分支。探针幂等。
- `patch_v881_data.py`（6KB）　— v88.1 整合（data.js）：六地形场景并入 LING_ACT（kind scene）+ 删除 WILD_SCENES 表。探针幂等。
- `patch_v881_docs.py`（5KB）　— v88.1 文档：设计规范 §28 批注 + §29.6 / 档案 v88.1 段 / 备忘 §31.4。行尾适配 + 探针幂等。
- `patch_v881_tests.py`（7KB）　— v88.1 测试更新：smoke §72 改写为「场景整合」+ e2e v87 段替换为 v88.1 段。标记切割。
- `patch_v881_ui.py`（7KB）　— v88.1 整合（ui.js + main.js）：删 wildSceneHTML/doWildScene / 接线永删 / scene 置顶 / 分发删除。
- `patch_v88_data.py`（11KB）　— v88 数据层：灵气装备（双轨修炼侧）+ 蕴养表 + 江湖活动 + 灵气精华。探针幂等。
- `patch_v88_docs.py`（8KB）　— v88 文档：设计规范 §29 / 备忘 §三十一 / 档案 v88 段 / 规划 §十八补记。探针幂等 + 行尾适配。
- `patch_v88_e2e.py`（5KB）　— v88 e2e 段：双轨切换 / 蕴养面板 / 江湖游历（真实 DOM）。探针幂等。
- `patch_v88_main.py`（2KB）　— v88 main.js：事件分发 4 条 + do* 包装 2 个。探针幂等。
- `patch_v88_state.py`（10KB）　— v88 状态层（state.js）：双轨切换 + 灵力出口 + 江湖游历出口组。探针幂等。
- `patch_v88_systems.py`（10KB）　— v88 核心分流（systems.js）：equipBagOf 唯一出口 + 9 处双轨改造。探针幂等。
- `patch_v88_tests.py`（7KB）　— v88 测试：smoke §73 段（双轨/蕴养/江湖）。探针幂等。
- `patch_v88_tools.py`（7KB）　— v88 工具层（domain.js）：双轨装备寻址兼容 + 品质名 + 蕴养函数组。探针幂等。
- `patch_v88_tools2.py`（3KB）　— v88 工具层补充（domain.js）：军装强化/拆解对灵气件的防护。探针幂等。
- `patch_v88_ui.py`（13KB）　— v88 UI 第一批（ui.js）：品质色到6 / 描述加灵力 / 两袋寻址 / genPane 双轨 / dollSlot 重写 + 修复 / dollLingPanel。探…
- `patch_v88_ui2.py`（15KB）　— v88 UI 第二批（ui.js）：openEqSlot 双轨 / openLingTemper / jianghuHTML / 弹窗接线 / 装备总览页。探针幂等。
- `patch_v8910.py`（6KB）　— patch_v8910.py —— v89.10 接线：卷 03~05 装载 + 新锚点断言
- `patch_v89100_a_consign.py`（10KB）　— v89.100-A：道具寄售通道（按购买价 75% 回收）
- `patch_v89100_b_smoke.py`（5KB）　— v89.100-B：冒烟第 100 节（道具寄售验收钉子）
- `patch_v89100_c_rush.py`（8KB）　— v89.100-C：推演脑 econ / loot 两模式（对 play_rush_1x.js 的增量，幂等）
- `patch_v89100_d_fix.py`（3KB）　— v89.100-D：三处修复（首测暴露）
- `patch_v89100_e_consign_only.py`（5KB）　— v89.100-E：寄售通道支持类型白名单（only）+ 脑改为只卖战利品
- `patch_v89101_d_span.py`（5KB）　— patch_v89101_d_span.py — v89.101 城流跨越（span 模式）
- `patch_v89101_e_span2.py`（3KB）　— patch_v89101_e_span2.py — v89.101b 城流跨越 · 校准版
- `patch_v89101_f_span3.py`（3KB）　— patch_v89101_f_span3.py — v89.101c 城流跨越 · 二校准
- `patch_v89101_g_span4.py`（2KB）　— patch_v89101_g_span4.py — v89.101d 城流跨越 · 三校准（官府总闸）
- `patch_v89105_alias.py`（9KB）
- `patch_v89105_asserts.py`（6KB）
- `patch_v89105_e2e_restore1.py`（6KB）
- `patch_v89105_e2e_restore2.py`（3KB）　— v89.105 事故复建 · 批次 2：统计页退役 / 战报两页 / 整叠使用 / 商城 / 故事集
- `patch_v89105_e2e_restore2b.py`（4KB）
- `patch_v89105_e2e_restore3.py`（7KB）
- `patch_v89105_fix_selfref.py`（2KB）
- `patch_v89105_fix_selfref2.py`（2KB）
- `patch_v89105_modal.py`（11KB）
- `patch_v89105_modal2.py`（7KB）
- `patch_v89105_surfaces.py`（6KB）
- `patch_v89105_tokens.py`（12KB）
- `patch_v89107_docpage.py`（2KB）　— v89.107 公文页重做：把 ui.js 的「消息频道」整段换成「五类独立页签」。
- `patch_v89107_msgkind.py`（4KB）　— v89.107 消息分类打标：把"发射点声明类别"落到 GAME.log 调用点上。
- `patch_v89107_msgkind2.py`（1KB）　— v89.107 打标 · 第二批（行号按 state.js 插入后的新编号重取）。
- `patch_v89109_fix.py`（5KB）　— v89.109 收尾：data-tside 改名（避 audit 的 data-side 约定）+ 在途"再出征"入口 + 断言更新
- `patch_v89109_fix3.py`（3KB）　— v89.109 收尾3：invasionArmyOf 最小分配 bug + 坚壁清野断言场景（兵力在别城）
- `patch_v89109_invasion.py`（13KB）　— v89.109：state.js —— 来袭防御战战斗化（战报+回放）+ 掠夺 gate + 城墙口径对齐
- `patch_v89109_jianbi.py`（3KB）　— v89.109 收尾2：坚壁清野对兵损同样生效 + 断言改到破防场景
- `patch_v89109_loot_checks.py`（4KB）　— v89.109：更新两条 loot 断言（假想档位 → 真实关系）
- `patch_v89109_loot_fix2.py`（1KB）　— v89.109 fix2：断言1 的县城量纲折算（粮食单项 → 合计）
- `patch_v89109_lootgate.py`（4KB）　— v89.109：battle.js —— lootGateOf（掠夺前置闸·唯一出口）+ raid 落账接线
- `patch_v89109_tactic2.py`（2KB）　— v89.109：tactic.js —— playerDef 透传（我方城防御读玩家战术）+ 出城部队起/余统计
- `patch_v89109_tactic_sortie.py`（4KB）　— v89.109：tactic.js 接 sortie（出城迎战）—— 常量 + 展开 + 墙保护 + 拦拆墙
- `patch_v89109_tactics.py`（6KB）　— v89.109：domain.js 战术段重写 —— 分侧（atk/def）+ sortie（出城迎战）+ 老档迁移
- `patch_v89109_ui.py`（13KB）　— v89.109：UI 层 —— 战术分侧渲染 + 军务出征/防守页改造 + main 动作支持 side
- `patch_v8910_docs.py`（11KB）　— patch_v8910_docs.py —— v89.10 文档：README 进度 / 需求档案 / 设计规范 §40 / AI工作备忘 §42+§43
- `patch_v89110_danger.py`（25KB）
- `patch_v89110_tests.py`（15KB）
- `patch_v89111_inv.py`（27KB）
- `patch_v89111_tests.py`（13KB）
- `patch_v89112_modals.py`（16KB）
- `patch_v89112b_modals.py`（8KB）
- `patch_v89112c_modals.py`（2KB）　— v89.112c · 弹窗整改收尾：装备 -217 / 战报 -67 的最后一轮压缩
- `patch_v89113_mayor.py`（19KB）
- `patch_v89113b_ui_tests.py`（15KB）　— v89.113b · 城主收尾：城池面板/烽火页显示 + 文案 + smoke 升级
- `patch_v89113c_inv.py`（9KB）
- `patch_v89113d_texts.py`（8KB）
- `patch_v89114a_load.py`（4KB）
- `patch_v89115a_smoke92.py`（6KB）
- `patch_v89115b_smoke_tail.py`（6KB）
- `patch_v89115c_smoke_fix.py`（4KB）　— patch_v89115c_smoke_fix.py — 修 4 条失败：① 取轮转城；②-4 自证判据；④ 显式重置 s.inv。
- `patch_v89115d_auto.py`（18KB）
- `patch_v89115e_bag.py`（15KB）
- `patch_v89115f_bag_tests.py`（3KB）　— patch_v89115f_bag_tests.py — 背包四类 → 两类（装备/宝物）+ 二级分类的测试升级
- `patch_v89115g_guard.py`（3KB）　— patch_v89115g_guard.py — 需求 1：守将属性对守城全军加成（全覆盖）
- `patch_v89115h_duel.py`（11KB）　— patch_v89115h_duel.py — 需求 2：斗将战（战前 · 50% · 胜者将领属性 +10% 临时）
- `patch_v89115i_bag_e2e.py`（9KB）　— patch_v89115i_bag_e2e.py — ① ui.openBag / bagHTML 支持旧页签值迁移；② e2e 断言升级
- `patch_v89115j_smoke95.py`（11KB）　— patch_v89115j_smoke95.py — 新增 smoke §95：本轮五件的新断言
- `patch_v89116a_bugs.py`（10KB）　— v89.116 补丁 A：三个小 bug —— ①守将函数名笔误 ②显示比例无监听 ③快购按用途过滤
- `patch_v89116b_defsandbox.py`（19KB）　— v89.116 补丁 B：守城战报接**真沙盘**（老板需求 4）
- `patch_v89116c_sdview.py`（7KB）　— v89.116 补丁 C：沙盘视角的收尾（sdLine / sdPaint / sdSimEnd / 推演入口 / 打开提示）
- `patch_v89116d2_captive_state.py`（2KB）　— v89.116 补丁 D2：守城侧的俘虏明细（补 D 里漏掉的两处）
- `patch_v89116d_captive.py`（14KB）　— v89.116 补丁 D：俘虏营（按兵种） + 自动治疗触发记录（老板需求 3 / 7）
- `patch_v89116e_affairs.py`（14KB）　— v89.116 补丁 E：军务处「伤兵营 / 俘虏营」（逐兵种）+ 自动治疗触发记录（UI 层）
- `patch_v89116f_sg_doc.py`（13KB）　— v89.116 补丁 F：待阅逸闻 6×5 + 翻页（需求 1） · 公文去掉烽火页签（需求 6）
- `patch_v89116g_battleui.py`（23KB）　— v89.116 补丁 G：实时战斗界面重排（老板需求 8）+ 敌方默认目标口径
- `patch_v89116h_btcss.py`（8KB）　— v89.116 补丁 H：战场新布局的 CSS + 退役 btCmdHTML / bt-cmd* 样式
- `patch_v89116i_tests.py`（15KB）　— v89.116 补丁 I：测试适配（10 处旧口径）+ 新增 §96（九条需求各一条断言）
- `patch_v89116j_stats.py`（3KB）　— v89.116 补丁 J：兵种数值梳理（老板需求 9）
- `patch_v89116k_sec96fix.py`（5KB）　— v89.116 §96 断言修正（五处）：剥注释取 CSS / 篇名计数 / 快购用途判据 / autoHeal 出口 / 退役判据
- `patch_v89116l_sec96fix2.py`（2KB）　— v89.116 §96 断言修正（续）：日志窗行数判据容错 + 退役判据改查"定义式"
- `patch_v89116m_sec96fix3.py`（6KB）　— v89.116 §96 修正（三）：btRoundLine 返回行文本（可测）+ 两条判据按"源码可查的事实"重写
- `patch_v89116n_refs.py`（6KB）　— v89.116 补丁 N：**同族 bug 一次清干净** —— "引用了不存在的成员" 五个修复
- `patch_v89116o2_auditfix.py`（2KB）　— v89.116 补丁 O2：audit.js ⑥ 节 —— 补本地 stripComment + 扩全模块扫描清单
- `patch_v89116o_auditrefs.py`（6KB）　— v89.116 补丁 O：把"未定义引用"审计**接进 audit.js**（同族 bug 的制度性防护）
- `patch_v89116p_sec96refs.py`（2KB）　— v89.116 补丁 P：§96 追加"同族 bug 清剿 + 未定义引用审计"三条断言
- `patch_v89117a2_maskel.py`（5KB）　— v89.117 补丁 A2 —— 弹窗栈的**能力判据**修正（smoke DOM 桩适配）
- `patch_v89117a_modalstack.py`（12KB）　— v89.117 补丁 A —— 弹窗**层级栈** + 同级重绘去闪（老板需求 6）
- `patch_v89117b2_affairs.py`（3KB）　— v89.117 补丁 B2（重写）—— 军务处两卡改走 ui.campCard
- `patch_v89117b_camps.py`（14KB）　— v89.117 补丁 B —— 俘虏营/伤兵营可见化 + 规则上桌面（老板需求 1）
- `patch_v89117d_fonts.py`（8KB）　— v89.117 补丁 D —— 字体体系统一：字号 / 字重 / 行高 / 角色（老板需求 3）
- `patch_v89117f2_smokefix.py`（1KB）　— 修复 smoke-test.js 里被 heredoc 吃掉反斜杠的三处（v89.117 · 第二轮）
- `patch_v89117f_smokefix.py`（2KB）　— 修复 smoke-test.js 里被 heredoc 吃掉反斜杠的两处（v89.117）
- `patch_v89117g_forge.py`（11KB）　— v89.117 补丁 E —— 铁匠铺：打造键收敛到底部 + 具体套装筛选（老板需求 4）
- `patch_v89117h_bag.py`（15KB）　— v89.117 补丁 F —— 背包装备页：列全（含穿戴）+ 细分类（老板需求 5）
- `patch_v89117i_battle.py`（13KB）　— v89.117 补丁 G —— 战斗界面再压缩 + 阵亡变暗 + 逐兵种回合行（老板需求 7）
- `patch_v89117j_smoke_bt.py`（5KB）　— v89.117 补丁 H1 —— 两条 v89.116 战斗界面断言升级到新口径（需求 7）
- `patch_v89117k_e2e.py`（10KB）　— v89.117 补丁 H2 —— 弹窗栈引入后的 e2e 适配 + 铁匠铺新口径
- `patch_v89117l_e2e2.py`（4KB）　— v89.117 补丁 H3 —— e2e 最后两条
- `patch_v89117m_archive.py`（33KB）　— v89.117 补档 —— 需求档案：补录 v89.92 ~ v89.117（老板需求 0「注意记录前述的所有需求」）
- `patch_v89117n_fix6.py`（5KB）　— v89.117 补丁 H4 —— 六条断言/样式适配（§97 首跑 + 两条旧口径 + 标尺）
- `patch_v89117o_e2e3.py`（3KB）　— v89.117 补丁 H5 —— e2e 两条 v21/v89.86 断言升级（军务总览 ⑤ 段）
- `patch_v89118a_captive_elephant.py`（15KB）
- `patch_v89118b_invasion_auto.py`（17KB）
- `patch_v89118c_tests.py`（11KB）
- `patch_v89118d_playtest.py`（17KB）
- `patch_v89118f_boost.py`（13KB）
- `patch_v89118g_cockpit.py`（4KB）
- `patch_v89118h_cockpit2.py`（4KB）
- `patch_v89118i_cockpit3.py`（5KB）
- `patch_v89118m_archive.py`（7KB）
- `patch_v89119a2_battle_fix.py`（3KB）　— patch_v89119a2_battle_fix.py — 补上 battle.js evLine 的函数收尾（v89.119）
- `patch_v89119a_counter_order.py`（13KB）　— patch_v89119a_counter_order.py — 反击记录配对（v89.119）
- `patch_v89119b_sec100.py`（1KB）　— 把 §100 片段插到 smoke-test.js 的汇总行之前（短脚本：读→改→原子落盘→自检）
- `patch_v89119c_sec100fix.py`（1KB）　— 修 §100 ⑥ 的源码级正则：battle.js 用中间变量 hk/hi（与 tactic/ui 的内联写法不同）
- `patch_v89119d_checkfn.py`（4KB）　— patch_v89119d_checkfn.py — 修「把函数当布尔传」的恒真断言（v89.119）
- `patch_v89119e_audit77.py`（5KB）　— patch_v89119e_audit77.py — audit.js 加第 ⑦ 节：恒真断言扫描（v89.119）
- `patch_v89119f_polish.py`（5KB）　— patch_v89119f_polish.py — 配对文案统一为「对方X反击」（v89.119）
- `patch_v89119g_report_dedup.py`（5KB）　— patch_v89119g_report_dedup.py — 战报正文页去重与收高（v89.119）
- `patch_v89119h_tall.py`（5KB）　— patch_v89119h_tall.py — 战报正文页专属加高档（v89.119）
- `patch_v89119i_archive.py`（6KB）　— patch_v89119i_archive.py — 需求档案补 v89.119 + smoke 档案断言
- `patch_v89120a_report_rid.py`（14KB）　— v89.120 补丁 A：战报身份 rid 化（根治「战报异常跳转」）
- `patch_v89120b_sim_btn_log.py`（14KB）　— v89.120 补丁 B：需求 2（回放态设定即生效）+ 需求 3（三键上移读秒行）+ 需求 4（回合记录倒叙）
- `patch_v89120c_tests.py`（6KB）　— v89.120 补丁 C：测试适配 + §101 新断言 + e2e 真 DOM 增补
- `patch_v89120d_sec101fix.py`（5KB）　— v89.120 补丁 D：修 §101 两处断言写法（都是断言自己的问题，代码无 bug）
- `patch_v89120e_e2e.py`（2KB）　— v89.120 补丁 E：e2e D4 收藏用例升级（dataset.i → dataset.rid）
- `patch_v89120f_archive.py`（6KB）　— v89.120 补档案：总览表 + 逐轮明细 + 遗留更新（老板「注意记录前述的所有需求」）
- `patch_v89126a_pop_cfg.py`（3KB）　— v89.126 补丁 A：人口增速改「固定 2 小时补满（现实时间）」
- `patch_v89126b_pop_rate.py`（5KB）　— v89.126 补丁 B：人口增速口径落地（domain/state/ui 三处）
- `patch_v89126c_smoke.py`（5KB）　— v89.126 补丁 C：smoke 断言升级
- `patch_v89126d_labor.py`（10KB）　— v89.126 补丁 D：劳作占用人口（需求 2）
- `patch_v89126e_smoke_labor.py`（5KB）　— v89.126 补丁 E：smoke 新增 §106（劳作占用：满配 12.5% / 比例 / 可征 / 守卫真调）
- `patch_v89126f_smoke_fix.py`（2KB）　— v89.126 补丁 F：修 §106② 判据（占用比 = 级数比，而不是"级数减半"）
- `patch_v89126g1_wall_state.py`（9KB）　— v89.126 补丁 G1：城墙并入建筑体系（data / state / battle）
- `patch_v89126g2_wall_code.py`（12KB）　— v89.126 补丁 G2：城墙并入建筑体系（domain / ui / main）
- `patch_v89126h_smoke_wall1.py`（7KB）　— v89.126 补丁 H：smoke 城墙专区断言升级（批次 1）
- `patch_v89126i2_citydef.py`（3KB）　— v89.126 补丁 I2：citydef 折扣接线（仅 ③）
- `patch_v89126i_wall_fix.py`（6KB）　— v89.126 补丁 I：
- `patch_v89126j_smoke_auto.py`（6KB）　— v89.126 补丁 J：重写「①城墙纳入自动建造」断言段（v64 旧口径 → v89.126 占格口径）
- `patch_v89126k_smoke_wall2.py`（6KB）　— v89.126 补丁 K：smoke 城墙消费类断言升级
- `patch_v89126l_final.py`（8KB）　— v89.126 补丁 L：收尾批
- `patch_v89126m_e2e.py`（5KB）　— v89.126 补丁 M：e2e 城墙断言升级
- `patch_v89126n_e2e2.py`（3KB）　— v89.126 补丁 N：e2e 点墙环 —— 前置先跑、再取 wallHit（防 refreshAll 重建 DOM 后引用失效）
- `patch_v89126o_diag.py`（1KB）　— v89.126 补丁 O（临时诊断）：给点墙环断言加 DBG 输出
- `patch_v89126p_e2e3.py`（2KB）　— v89.126 补丁 P：e2e 点墙环断言定稿（打开建造菜单 + 翻页见「城墙」）
- `patch_v89126q_gen.py`（5KB）　— v89.126 补丁 Q：
- `patch_v89127a_tips_fmt.py`（4KB）
- `patch_v89127b_smoke.py`（4KB）　— v89.127 补丁 B：smoke 断言 —— U.fmt 千级逗号 + §107 城墙入城迁移提示（3 条）
- `patch_v89128a_domain.py`（7KB）　— v89.128 补丁 A（domain.js）：城墙回环城槽 —— 槽访问唯一出口 cellOf / wallSlotOf
- `patch_v89128b2_state.py`（2KB）　— v89.128 补丁 B2（state.js）：清理三处残留
- `patch_v89128b_state.py`（9KB）　— v89.128 补丁 B（state.js）：城墙回环城槽
- `patch_v89128c_ui.py`（15KB）　— v89.128 补丁 C：城墙回环城槽 —— 界面层与转正提取
- `patch_v89128d_smoke.py`（12KB）　— v89.128 补丁 D：smoke 城墙断言升级（占格 → 环城槽）
- `patch_v89128e_smoke2.py`（9KB）　— v89.128 补丁 E：smoke 剩余 8 条红点升级（转正提取 / 迁移口径 / 正则可升级）
- `patch_v89128f_e2e.py`（8KB）　— v89.128 补丁 F：e2e 城墙断言升级（环城视觉=建筑外观 / 环城槽面板 / 自动升级）
- `patch_v89128g_buildtime.py`（7KB）　— v89.128 补丁 G：需求 3+4 —— 建造时间重设计
- `patch_v89128h_smoke3.py`（10KB）　— v89.128 补丁 H（smoke）：§104 口径升级（哨兵 0 → 曲线）+ 新增 §108（12 级循环/≤24h/区分度）
- `patch_v89128j_leftbar.py`（16KB）　— v89.128 补丁 J：需求 7+8 左栏统计改造
- `patch_v89128k_gather.py`（12KB）　— v89.128 补丁 K：需求 5 —— 自动采集/自动收获 + 野地驻军规则
- `patch_v89129a_wall_time.py`（6KB）　— patch_v89129a_wall_time.py —— v89.129 需求 1：城墙独立建造时间 + 资源重排。
- `patch_v89129b_fort_guard.py`（7KB）　— patch_v89129b_fort_guard.py —— v89.129 需求 2：据点守将（唯一缺口）。
- `patch_v89129c_recgen.py`（7KB）　— patch_v89129c_recgen.py —— v89.129 需求 2：相称尺子 + 出征面板建议行。
- `patch_v89129d_smoke.py`（9KB）　— patch_v89129d_smoke.py —— v89.129：smoke §111 断言（插在"结果："行之前）。
- `patch_v89130_archive.py`（9KB）　— patch_v89130_archive.py —— 档案：① 总览补 v89.121~130 ② v89.128 逐字原文
- `patch_v89131a_data.py`（6KB）　— v89.131 补丁 A：data.js
- `patch_v89131b2_domain.py`（3KB）　— v89.131 补丁 B2：domain.js —— 精力公式拆成"零件唯一出口"（energyPartsOf）
- `patch_v89131b_domain.py`（3KB）　— v89.131 补丁 B：domain.js —— 精力三出口（上限 / 当前 / 写入）
- `patch_v89131c_systems.py`（2KB）　— v89.131 补丁 C：systems.js —— useItem 新增 'energy' 分支（对照 stamina 分支）
- `patch_v89131d_state.py`（5KB）　— v89.131 补丁 D：state.js —— 回复口径改「现实时间百分比（24h 满）」
- `patch_v89131e1_ui_pane.py`（12KB）　— v89.131 补丁 E1：ui.js —— genPane 状态区改造
- `patch_v89131e2_ui_picker.py`（8KB）　— v89.131 补丁 E2：体力/精力道具选择窗 + 动作派发 + 商城页签 + 提示表
- `patch_v89131f_css.py`（7KB）　— v89.131 补丁 F：index.html —— 将领档案版面改造
- `patch_v89131g_smoke.py`（16KB）　— v89.131 补丁 G：smoke-test.js 升级 8 处 + 新增 §112
- `patch_v89132a_march.py`（12KB）　— v89.132 补丁 A：军务处重构（老板需求 0/1/2）
- `patch_v89132b_minimap.py`（15KB）　— v89.132 补丁 B：缩略地图（老板需求 0 · v89.128 第二批第 12 条）
- `patch_v89132c_jieyue.py`（20KB）　— v89.132 补丁 C：节钺开拓（老板需求 3「节钺设计再开拓一下」）
- `patch_v89132d_tests.py`（20KB）　— v89.132 补丁 D：测试断言更新（smoke + e2e）
- `patch_v89132e_fix.py`（3KB）　— v89.132 补丁 E：补丁 D 漏掉的三处（smoke 实测抓出）
- `patch_v89132f_fix2.py`（3KB）　— v89.132 补丁 F：§113 两条断言口径修正（smoke 实测抓出）
- `patch_v89132g_order.py`（4KB）　— v89.132 补丁 G：我城（红点 + 名称）压最后一层
- `patch_v89132h_grid.py`（3KB）　— v89.132 补丁 H：军务处两列被撑偏的修复（实机量测抓出）
- `patch_v89132i_archive.py`（5KB）　— v89.132：需求档案追加（总览表 + 明细段）
- `patch_v89133a2_main.py`（4KB）　— v89.133 补丁 P1a-2：main.js（P1a 的 ui.js 部分已落盘，本补丁只动 main.js）
- `patch_v89133a_march.py`（16KB）　— v89.133 补丁 P1a：军务页签体系 + 出征页（第 9/11 条）+ 校场退役（第 10 条）
- `patch_v89133b2_main.py`（5KB）　— v89.133 补丁 P1b-2：main.js（P1b 的 ui.js 部分已落盘，本补丁只动 main.js）
- `patch_v89133b_expdef.py`（18KB）　— v89.133 补丁 P1b：出征战术页（第 13 条）+ 防守双小页（第 14 条）+ 烽火（第 15 条）
- `patch_v89133c_pane.py`（6KB）　— v89.133 补丁 P2：将领面板状态三行（老板本轮需求 2）
- `patch_v89133d_smoke.py`（19KB）　— v89.133 补丁 P3：smoke 断言更新（10 处）+ 下拉白名单 + 新增 §114
- `patch_v89134a_data.py`（10KB）　— v89.134 补丁 1 —— data.js 数据表修正：
- `patch_v89134b_wire.py`（4KB）　— v89.134 补丁 2 —— 接线：
- `patch_v89134c_smoke.py`（8KB）　— v89.134 补丁 4 —— smoke-test.js：
- `patch_v89136a_gather.py`（15KB）　— v89.136 批0-a：domain.js —— 驻军丢失修复 + 采集体系合并（唯一形态=带将驻军原地开工）
- `patch_v89136b_arrive.py`（4KB）　— v89.136 批0-b：battle.js —— arrive 的 gather 分支改"老档在途并入"（不再有新的 gather 出发）
- `patch_v89136c_ui.py`（11KB）　— v89.136 批0-c：ui.js —— openGatherModal/openGathers 退役 + 地块界面新增「采集」区 + 野地总览按钮清
- `patch_v89136d_main.py`（5KB）　— v89.136 批0-d：main.js —— 采集相关 case 清理 + doStartGather 退役 + doFinish/doAbandon 改刷新方式
- `patch_v89136e1_smoke.py`（20KB）　— v89.136 批0-e1：smoke-test.js 采集相关断言全面升级 + main.js gather-locate case 清理
- `patch_v89136e2_e2e.py`（9KB）　— v89.136 批0-e2：e2e-test.js —— 野地采集用例改写为"带将驻军原地开工 + 地块界面操作"
- `patch_v89136f_pane3.py`（6KB）　— v89.136 批2-a：ui.js 三行同构（体力/精力/忠诚）+ index.html CSS（数值列固定 · 进度条等长）
- `patch_v89136g_pane3tests.py`（6KB）　— v89.136 批2-b：smoke/e2e 三行同构断言更新（只显示当前值 · 忠诚行 ＋ · 数值定宽）
- `patch_v89136h_bt.py`（10KB）　— v89.136 批3/4-a：ui.js —— 战斗界面双方将领（悬停六维）+ 反击文案/白色 + 结束不弹窗
- `patch_v89136i_tac.py`（7KB）　— v89.136 批5-a：domain.js —— 出征战术细分（掠夺/占领）+ 校场练兵域函数退役
- `patch_v89136j_tacui.py`（8KB）　— v89.136 批5-c：ui.js —— 出征战术细分（掠夺/占领两小页）+ 练兵块退役 + 弹窗细分
- `patch_v89136k_tactests.py`（10KB）　— v89.136 批5-e：smoke/e2e 练兵退役 + 战术细分 断言更新 + §117 新增
- `patch_v89136l_live.py`（4KB）　— v89.136 批6：live 续铺（上轮清单①）+ 将领视图秒刷（上轮清单②）
- `patch_v89137a_mastery_data.py`（5KB）　— v89.137 补丁 A：data.js —— 建筑专精三档表（DATA.MASTERY_TIERS）与文案更名
- `patch_v89137b_mastery_domain.py`（10KB）　— v89.137 补丁 B：domain.js —— 建筑专精三档唯一出口 + 消费点升级
- `patch_v89137c_battle.py`（12KB）　— v89.137 补丁 C：battle.js
- `patch_v89137d_store.py`（2KB）　— v89.137 补丁 D：data.js —— 都城库藏基准跟三档重算（6.48亿 → 8.64亿）
- `patch_v89137e_ui_a.py`（10KB）　— v89.137 补丁 E：ui.js（批一）—— 建筑专精文案/三档显示 + 官府要务段（主城常显 / 删全境营造 / 规格统一）
- `patch_v89137f_domain_ov.py`（3KB）　— v89.137 补丁 F：domain.js —— 全境营造总览数据层整条退役（墓碑）
- `patch_v89137g_ov_ui_main.py`（4KB）　— v89.137 补丁 G：ui.js + main.js —— 全境营造总览退役（面板函数 / 三个动作 case）
- `patch_v89137h_smoke.py`（10KB）　— v89.137 补丁 H：smoke-test.js —— 专精三档断言升级 + 全境营造总览退役断言 + 两处旧锚点跟随
- `patch_v89137i_pane_tier.py`（3KB）　— v89.137 补丁 I：ui.js 专精行 tier0 文案 + smoke 实测断言升级（三档两态）
- `patch_v89137j_battle_ui.py`（7KB）　— v89.137 补丁 J：
- `patch_v89137k_station_pre.py`（4KB）　— v89.137 补丁 K：battle.js —— station 出发前预检（驻军上限）+ 无将硬闸 + 计谋护栏
- `patch_v89137l_exp_ui.py`（11KB）　— v89.137 补丁 L：ui.js
- `patch_v89137m_main_domain.py`（8KB）　— v89.137 补丁 M：main.js + domain.js
- `patch_v89137n_smoke_dispatch.py`（4KB）　— v89.137 补丁 N：smoke-test.js —— 派驻三条断言改走新唯一入口（march.dispatch）
- `patch_v89137o_smoke_settle.py`（9KB）　— v89.137 补丁 O：smoke-test.js —— 派驻面板退役断言 + §110③ 新语义 + BT_LOG_MAX 跟随
- `patch_v89137p_arrive_gen.py`（2KB）　— v89.137 补丁 P：battle.js —— arrive 的 gen 空引用修复（无将增援抵达必崩 · 探针实测抓出）
- `patch_v89137r_backlog.py`（7KB）　— v89.137 补丁 R：需求 1 积压 —— ① 采集可见性（资源区下拉 + 大地图） ② 细分"跟随通用"标记
- `patch_v89137s_smoke118.py`（11KB）　— v89.137 补丁 S：smoke-test.js 追加 §118 段（本轮七条需求的门禁断言）
- `patch_v89138a_map.py`（7KB）　— v89.138 补丁 A：ui.js —— 地图拟合修复（需求 1：铺满 + 整体放大）
- `patch_v89138b_city.py`（17KB）　— v89.138 补丁 B：ui.js + main.js —— 城池菜单（老板 2）
- `patch_v89138c_domain_retire.py`（8KB）　— v89.138 补丁 C：domain.js 退役（度支归集 / 将领派遣域函数）+ battle.js 席位守卫迁移
- `patch_v89138d_boost_recall.py`（12KB）　— v89.138 补丁 D：提速面板（老板 3）+ 建筑「功能」标题（老板 4）+ 采集召回统一（老板 0）
- `patch_v89138e_smoke.py`（7KB）　— v89.138 补丁 E：smoke-test.js —— 退役跟随（采集召回统一 / 功能标题 / 城池菜单 / 将领派遣新链路）
- `patch_v89138h_smoke119.py`（7KB）　— v89.138 补丁 H：smoke-test.js 追加 §119（本轮六条需求的门禁断言）
- `patch_v89139a_data.py`（5KB）　— v89.139 批一：data.js —— 珠宝产出重排（含夜明珠）+ 等级门槛 + 数量 + 采集负重系数
- `patch_v89139b_domain.py`（6KB）　— v89.139 批二：domain.js —— 采集收成关联负重（唯一出口）+ 珠宝按等级门槛/数量产出
- `patch_v89139c_tactic.py`（8KB）　— v89.139 批三：tactic.js —— 战场距离口径（最远射程 + 双方最快速度 × 最少接敌回合）
- `patch_v89139d_bt2col.py`（8KB）　— v89.139 批四-1：ui.js —— 战场侧栏 2 列（全兵种列出·参战亮/未战灰）+ 去掉副标题备注
- `patch_v89139e_btcss.py`（4KB）　— v89.139 批四-2：index.html —— 战场两侧 2 列网格 CSS + 列宽调整
- `patch_v89139f_panel.py`（13KB）　— v89.139 批四-3：ui.js openLandModal —— 己方野地面板（老板 3）：
- `patch_v89139g_mini.py`（4KB）　— v89.139 批五：ui.js 缩略图「我城」档 + 默认只标当前城（老板 6）
- `patch_v89139h_main_map.py`（5KB）　— v89.139 批六：main.js（采集不重开 + 大屏铺满）+ map.js（去掉视野外方向箭头）
- `patch_v89139i_smoke.py`（9KB）　— v89.139 批七：tactic.js 恢复 stepsToWall（smoke 在用）+ smoke 三条断言升级（箭头退役/距离新口径）
- `patch_v89139j_smoke2.py`（4KB）　— v89.139 批八：smoke 五条断言跟随（斥候速度项 / 纯近战接敌 / 箭塔判据 / CSS 两处列宽）
- `patch_v89139k_dist.py`（4KB）　— v89.139 批九：tactic.js 距离口径修正（MARCH_ROUNDS_MIN 3→2 + FIELD_MIN 恢复 1400）
- `patch_v89139l_smoke120.py`（14KB）　— v89.139 批十：smoke 追加 §120（本轮 8 条需求的守护断言）
- `patch_v89139m_jewel3.py`（8KB）　— v89.139 批十一：珠宝三档重排（每地形 Lv1 都有产出 + 高档仍需高等级野地）+ 挑选唯一出口
- `patch_v8914.py`（16KB）　— patch_v8914.py — v89.14：卷 09~18 接线（60 篇）+ 残留清理 + 校验器判据 11/12
- `patch_v89140a_jewel_status.py`（5KB）　— v89.140 批一：data.js（夜明珠全地形）+ domain.js（挑选出口 + 状态锁扩充）
- `patch_v89140b_battle.py`（11KB）　— v89.140 批二：战场（距离 × 系数 / 侧栏去图标两行制只列在场 / 战场放宽 / log 降高）
- `patch_v89140c_marches.py`（12KB）　— v89.140 批三：军务总览（去驻守野地/采集队块 + 去统计行 + 城内表改兵种表头）+ 校场关菜单
- `patch_v89140d_forge_shop_bag.py`（11KB）　— v89.140 批四（重写）：铁匠铺（多按钮/分页到底/固定卡）· 商城（简介悬停）· 背包宝物（7 列格）
- `patch_v89140e_autoexp_wilds.py`（12KB）　— v89.140 批五：自动出征（按兵种配置取兵 · 去单次兵力 · 去播报）+ 附属野地（将领/驻军列）
- `patch_v89140f_ui_autoexp.py`（9KB）　— v89.140 批五-b：ui.js 自动出征面板（编成 3 列 + 去单次兵力 + 去播报）+ 附属野地两列
- `patch_v89140g_smoke.py`（16KB）　— v89.140 批六：smoke 断言跟随（23 条：口径变更 / 结构重排 / 退役件）
- `patch_v89140h_smoke121.py`（10KB）　— v89.140 批七：smoke 追加 §121（本轮 10 条需求的守护断言）
- `patch_v89141a_data_domain.py`（9KB）　— v89.141 批 A1：12×9 封顶 + 城外露天容量 + FIELD_MARGIN 清理
- `patch_v89141b_rebytier.py`（3KB）　— v89.141 批 A2：resByTier 随"城外露天容量"重算（连带数值 · 主动声明）
- `patch_v89141c_ui_main.py`（8KB）　— v89.141 批 B：UI 层
- `patch_v89141d_smoke.py`（13KB）　— v89.141 批 C：smoke 断言跟随（9 条）+ 新增 §122
- `patch_v89141e_review_fix.py`（4KB）　— v89.141 批 D（复核修复）：
- `patch_v8914_docs.py`（14KB）　— patch_v8914_docs.py — v89.14 文档补录
- `patch_v89152a_data_jewels.py`（14KB）　— v89.152a：data.js 珠宝体系重设（18 种新珠宝 / 地形表 / 门槛 / RANK / 迁移表 / 初始物品 / 删旧6行）
- `patch_v89152b_icons.py`（2KB）　— v89.152b：icons.js GEM_PAL —— 9 组 -> 18 组（新珠宝配色，按宝石本色）
- `patch_v89152c_domain.py`（3KB）　— v89.152c：domain.js —— 新增 GAME.migrateJewels152（老档珠宝换算，幂等）+ 更新 collect 注释
- `patch_v89152d_state.py`（2KB）　— v89.152d：state.js —— 两处调用点（loadGame 之后 + tickOnce 兜底）
- `patch_v89152e_ui_landmodal.py`（10KB）　— v89.152e：ui.js openLandModal —— 产出行拆 4 行 / 删备注行 / 按钮文案 / 已占不显示产出
- `patch_v89152f_fix_ids.py`（7KB）　— v89.152f：修理 id/名 冲突 —— 青玉→璞玉(puyu)、和田玉→独山玉(dushanyu)；迁移表收敛为 14 行（夜明珠转正保留）
- `patch_v89152g_smoke_a.py`（7KB）　— v89.152g：smoke-test.js 断言升级（珠宝新体系 + 面板产出行 + 迁移节）
- `patch_v89152h_smoke_b.py`（9KB）　— v89.152h：smoke-test.js 断言升级 PART-B（§120⑤/⑥ 升级 · §121① · §131⑩ · 新增 §152 节）
- `patch_v89152i_smoke_c.py`（6KB）　— v89.152i：smoke-test.js 新增 §152 节（老档换算 / 面板实测 / 档案在册）
- `patch_v89152j_e2e.py`（3KB）　— v89.152j：e2e-test.js 野地面板断言升级（产出行 4 行 / 已占无产出）
- `patch_v89153a_data.py`（7KB）　— v89.153a：data.js —— MSG_KINDS 重排（系统/战报/侦查 + task 并入）、新增 MSG_SUBS/标签色表、
- `patch_v89153b_state.py`（6KB）　— v89.153b：state.js —— GAME.log 第三参数(sub) / 主题命名空间 / msgSubOf / msgFeedOf / 建造消息打标
- `patch_v89153c_story_domain.py`（6KB）　— v89.153c：story.js（天时/改元打标）+ domain.js（采集收获明细重写 · 采集消息打标 · 自动升级打标）
- `patch_v89153d_ui.py`（17KB）　— v89.153d：ui.js —— 公文重构（默认系统页 / 战报去军情流水 / 系统页三合一 + 小标签 + 主题色）
- `patch_v89153e_smoke_ab.py`（7KB）　— v89.153e：smoke 断言升级（⑨-1/⑨-2/⑨-6 · §116 两条 · 新增 §153 节）
- `patch_v89153f_smoke_c.py`（6KB）　— v89.153f：smoke 新增 §153 节（公文重构 + 收获明细）
- `patch_v89154a_core.py`（13KB）　— v89.154 核心补丁：附属野地（放弃按钮 + 排序）/ 改建回大界面 / CSS。
- `patch_v89154b_smoke.py`（12KB）　— v89.154 smoke 补丁：① 6411 行两段确认断言升级（do → arm）
- `patch_v89154c_e2e.py`（6KB）　— v89.154 e2e 补丁：附属野地（排序行序 / 放弃按钮两段确认+上膛）+ 改建完成回大界面。
- `patch_v89155a_data.py`（4KB）　— v89.155 补丁 A：data.js —— ① EXT_BUILDINGS 补 desc（悬停 undefined 修复）
- `patch_v89155b_ui.py`（18KB）　— v89.155 补丁 B：ui.js ——
- `patch_v89155c_md.py`（7KB）　— v89.155 补丁 C+D：main.js（召回上膛三态 case）+ domain.js（extStoreCapOneOf + 采集消息归位）。
- `patch_v89155d_html.py`（2KB）　— v89.155 补丁 E：index.html —— .btn.green（野地召回「无驻军绿」）+ --green-deep 令牌。
- `patch_v89155e_smoke.py`（12KB）　— v89.155 smoke 补丁：① 5 处旧断言升级 ② 文件末尾插 §155 节（先数清闭合层数，插完 node --check）。
- `patch_v89155f_e2e.py`（6KB）　— v89.155 e2e 补丁：① MSG_PER 断言升级（铺满）② 末尾追加 §155 用例（召回三态真点击 + 商城排序）。
- `patch_v89156a_stack.py`（4KB）　— v89.156 patch A：ui.js —— 弹窗层级栈修复（live 重绘不压栈 / sameAs 接线 / 弹栈即新数据）
- `patch_v89156b_abandon.py`（6KB）　— v89.156 patch B（幂等版）：放弃野地改「一击执行」——上膛式（_wildArm154 / -arm）整条退役
- `patch_v89156c2_exp2.py`（3KB）　— v89.156 patch C2：main.js「可用道具」动作改名 + index.html 四块改单列
- `patch_v89156c_exp.py`（16KB）　— v89.156 patch C：出征界面改造（老板 2 + 3）
- `patch_v89156d_scout.py`（10KB）　— v89.156 patch D：侦察可能失败（老板 4「视双方将领资质和等级差设计」）
- `patch_v89156e2_smoke_sec.py`（9KB）　— v89.156 patch E2：smoke-test.js 追加 §156 节（插在外层闭合前 —— 尾锚点组合保证唯一）
- `patch_v89156e_smoke.py`（7KB）　— v89.156 patch E：smoke-test.js 升级（6 处旧断言 + 新增 §156 节）
- `patch_v89156f2_smoke_fix2.py`（3KB）　— v89.156 patch F2（稳健版）：smoke ⑤ v89.66 升级
- `patch_v89156f_smoke_fix.py`（4KB）　— v89.156 patch F：smoke 侦察用例摆前置（v89.156 侦察可失败 → 验别处的用例固定随机为成功）
- `patch_v89156g_e2e.py`（8KB）　— v89.156 patch G：e2e-test.js —— 侦察用例摆前置 + v89.154①组升级（一击执行+层级栈回归）+ 侦察失败真路径
- `patch_v89156h_transfer.py`（2KB）　— v89.156 patch H：调运（transfer · 不接战）不渲染接战专属三块 —— 修"本境调运面板溢出 141px"
- `patch_v89157a_data.py`（5KB）　— v89.157 补丁 A：data.js —— 侦察基础 50%（余下按资质/等级差匹配）+ 消息主题扩容（人事/内政/市易 + 图标）
- `patch_v89157b_domain.py`（6KB）　— v89.157 补丁 B：domain.js —— ① extSlotOrder 改"居中矩形逐圈扩张" ② 官府升级需城墙 ≥ 目标-2
- `patch_v89157c_state.py`（6KB）　— v89.157 补丁 C：state.js —— 产量加成改"各自作用于基础产量再相加"（含黄金与分解口径）
- `patch_v89157d2_battle.py`（3KB）　— v89.157 补丁 D2：battle.js —— 程序化抓段（evLine → evTextOf 提取 + roundLinesOf）
- `patch_v89157d_battle.py`（5KB）　— v89.157 补丁 D：battle.js —— 事件措辞抽唯一出口 evTextOf + 新增逐回合文字 roundLinesOf
- `patch_v89157e_ui.py`（14KB）　— v89.157 补丁 E：ui.js —— ① station 隐三块 ② 无相克隐藏 ③ 公文铺满（布局 px 常量）
- `patch_v89157fg_main_html.py`（4KB）　— v89.157 补丁 F：main.js —— report-rounds 动作接线  /  补丁 G：index.html —— 进度条缩短 + 消息徽章/复盘样式
- `patch_v89157h_tags.py`（3KB）　— v89.157 补丁 H：给指定发射点补第三参（主题）—— 人事 / 内政 / 市易
- `patch_v89157i_smoke.py`（7KB）　— v89.157 补丁 I：smoke-test.js —— 9 处升级 + 新增 §157 节
- `patch_v89157j_e2e.py`（6KB）　— v89.157 补丁 J：e2e-test.js —— 无相克断言升级 + 新增 §157 用例（逐回合弹窗 / station / 徽章）
- `patch_v89158a_domain.py`（6KB）　— v89.158 补丁 A：domain.js —— 仓容分账唯一出口 GAME.storePartsOf
- `patch_v89158b_state.py`（4KB）　— v89.158 补丁 B：state.js —— 三处"削顶"改"只封自然增长、不削已有存量"
- `patch_v89158c_ui.py`（13KB）　— v89.158 补丁 C：ui.js —— 悬停保护出口 + 9 处接入 + 容量账目三处显示
- `patch_v89158d_main.py`（3KB）　— v89.158 补丁 D：main.js —— 主循环"周期性重绘窗口"(_tickPaint) + 两处视图刷新悬停保护
- `patch_v89158e_smoke.py`（6KB）　— v89.158 补丁 E：smoke-test.js —— 7 处口径升级（削顶→不削 / storePartsOf / 新文案）
- `patch_v89159a_core.py`（12KB）　— v89.159 补丁 A：① 将领升级回满体力/精力（唯一升级出口）
- `patch_v89159b_smoke.py`（18KB）　— v89.159 补丁 B：升级 smoke 三段旧断言（爵位解锁口径）+ 新增 §159 节（3 条需求各自的断言）。
- `patch_v89159c_archive.py`（7KB）　— v89.159 补丁 C：需求档案
- `patch_v89159d_smoke_fix.py`（5KB）　— v89.159 补丁 D：修 §159②/③ 用例的资源摆放（s.res 是**当前城**的 getter ——
- `patch_v89159e_e2e.py`（5KB）　— v89.159 补丁 E：e2e 新增 §159 节（真实 DOM）
- `patch_v89159f_gather.py`（6KB）　— v89.159 补丁 F：复核轮抓出的真 bug —— 采集收获是**唯一 clamp 的奖励入账**，
- `patch_v89159g_smoke2.py`（3KB）　— v89.159 补丁 G：smoke §159 追加"奖励入账唯一出口"三条断言（复核轮真 bug 的回归守卫）。
- `patch_v89160ab_core.py`（14KB）　— v89.160 补丁 A：数据表（DATA.OVERFLOW）
- `patch_v89160d_ui.py`（5KB）　— v89.160 补丁 D：界面出口（逾溢折损可见）+ 自动升级文案（取消城内优先 / 顺延）
- `patch_v89160e_smoke.py`（10KB）　— v89.160 补丁 E：smoke —— ① 升级旧"同级城内优先"结构断言（口径退役）
- `patch_v89160f_archive.py`（5KB）　— v89.160 补丁 F：需求档案（总览行 + 明细）
- `patch_v89160g_e2e.py`（5KB）　— v89.160 补丁 G：e2e 新增 §160（真 DOM + 真 tick）
- `patch_v89161ab_core.py`（19KB）　— v89.161 补丁 A：黄金上收**玩家层级**（唯一存储 s.gold + 各城 res.gold 访问器）
- `patch_v89161d_ui.py`（5KB）　— v89.161 补丁 D：界面出口（金"全境通用"· 费用悬停注 · 折损周期的现实时间换算）
- `patch_v89161e_smoke.py`（12KB）　— v89.161 补丁 E：smoke —— ① 四条旧断言随口径升级（花费按城 / 金不通运）
- `patch_v89161f_archive.py`（6KB）　— v89.161 补丁 F：需求档案（总览行 + 明细）
- `patch_v89162a_core.py`（8KB）　— v89.162 补丁 A（核心）：
- `patch_v89162b_ui.py`（4KB）　— v89.162 补丁 B（界面）：
- `patch_v89162c_smoke.py`（7KB）　— v89.162 补丁 C：smoke 加 §162 段（内政→税收 · 分解对齐 · 界面文案 · 档案在册）
- `patch_v89162d_archive.py`（4KB）　— v89.162 补丁 D：需求档案补 v89.162（总览行 + 明细段）
- `patch_v89162e_e2e.py`（2KB）　— v89.162 补丁 E：e2e 城主段加两条（黄金分解出现「城主内政」+ 与结算对齐）
- `patch_v89163a_data.py`（3KB）　— v89.163 补丁 A：data.js 征兵时长压缩
- `patch_v89163b_smoke.py`（6KB）　— v89.163 补丁 B：smoke 加 §163 段
- `patch_v89163c_e2e.py`（3KB）　— v89.163 补丁 C：e2e 加 v89.163 用例（清单含行军 + 召回宿主跟走 + 时长数据）
- `patch_v89163d_archive.py`（4KB）　— v89.163 补丁 D：需求档案补 v89.163（总览行 + 明细段）
- `patch_v89164a_curve.py`（8KB）　— v89.164 补丁 A（核心）：城主六维加成改「分段减半曲线」
- `patch_v89164b_smart.py`（8KB）　— v89.164 补丁 B（智能战斗 · 核心）：
- `patch_v89164c_ui.py`（5KB）　— v89.164 补丁 C（界面）：
- `patch_v89164d_smoke.py`（10KB）　— v89.164 补丁 D：smoke 加 §164 段（曲线 / 时长对齐 / 智能战斗）
- `patch_v89164e_archive.py`（6KB）　— v89.164 补丁 E：需求档案补 v89.164（总览行 + 明细段 · 含逐回合表现样例）
- `patch_v89165a_live.py`（6KB）　— v89.165 patch：**实时读秒全量排查** —— 五处漏网接入每秒刷新。
- `patch_v89165b_smoke.py`（6KB）　— v89.165b：smoke 插入 §165（实时读秒五处 live 接入 + 真调 + 档案）。
- `patch_v89165c_archive.py`（6KB）　— v89.165c：需求档案补录（总览行 + 明细段）。
- `patch_v89165d_e2e.py`（3KB）　— v89.165d：e2e 插入 §165（指挥战斗清单 live 的真 DOM 验证）。
- `patch_v89166a_enter.py`（2KB）　— v89.166 patch：「进入城池」→ 菜单全关 + 直接显示城内大界面（两入口统一出口）。
- `patch_v89166b_e2e.py`（4KB）　— v89.166b：e2e 插入 §166（进入城池 → 菜单全关 + 城内大界面 · 点真按钮）。
- `patch_v89166c_smoke_archive.py`（7KB）　— v89.166c：smoke §166（源码级顺序断言）+ 需求档案补录。
- `patch_v89166d_memory.py`（6KB）　— v89.166 收尾：备份 after + 工作记忆 + 技能 §80。
- `patch_v89167a_percity.py`（8KB）　— v89.167 patch：自动升级 —— **每城独立建造位**（逐城遍历、各自排满）。
- `patch_v89167b_smoke_upgrade.py`（4KB）　— v89.167b：smoke 旧断言升级（自动升级"一次排满各城"新口径）。
- `patch_v89167c_smoke_archive.py`（10KB）　— v89.167c：smoke §167（源码 + 真调三城）+ 需求档案补录。
- `patch_v89167d_e2e.py`（3KB）　— v89.167d：e2e 插入 §167（自动升级每城独立 · 真实 DOM 真调）。
- `patch_v89167e_memory.py`（7KB）　— v89.167 收尾：备份 after + 工作记忆 + 技能 §81。
- `patch_v89169a_core.py`（7KB）　— v89.169 补丁 A：城墙 0 级虚影环（js/ui.js 四处）
- `patch_v89169b_tests.py`（11KB）　— v89.169 补丁 B：测试与档案
- `patch_v89170a_curve.py`（10KB）　— v89.170 核心补丁：经验曲线「前期上抬 · 全程低于线性 · 单段幂律」
- `patch_v89170b_smoke.py`（8KB）　— v89.170 smoke 补丁：4 处旧断言随曲线口径升级（+ 注释同步）
- `patch_v89170c_h170.py`（6KB）　— v89.170 smoke §170 段：经验曲线上抬 · 道具不再一步登天
- `patch_v89170d_archive.py`（6KB）　— v89.170 需求档案补录：总览行 + 逐轮明细段（追加到文件尾）
- `patch_v89170e_memory.py`（8KB）　— v89.170 收尾：工作记忆 + 技能 §83
- `patch_v89171a_core.py`（15KB）　— v89.171 补丁 A（核心）：
- `patch_v89171b_ui.py`（8KB）　— v89.171 补丁 B（界面）：经验道具选择窗 —— 逐档显示培养上限、到线的档位变暗、
- `patch_v89171c_smoke.py`（14KB）　— v89.171 补丁 C（smoke）：
- `patch_v89171d_e2e.py`（5KB）　— v89.171 补丁 D（e2e）：
- `patch_v89171e_archive.py`（6KB）　— v89.171 补丁 E（需求档案）：总览行 + 逐轮明细。
- `patch_v89194_a.py`（10KB）　— v89.194 批次A：S1 建筑升级金成本 + S4 欠俸降忠诚（data/domain）
- `patch_v89194_a2.py`（6KB）　— v89.194 批次A2：缺料提示唯一出口 GAME.costLackMsg（金加入成本后的跟进）
- `patch_v89194_arc.py`（7KB）　— v89.194 档案补录：总览行 + 明细段（两处各自 guard）
- `patch_v89194_b.py`（4KB）　— v89.194 批次B：口径变更的判据跟进（autoUpgrade 资源类判定 + costJewelText 复用）
- `patch_v89194_c.py`（6KB）　— v89.194 批次C：smoke 断言跟进（金门槛造局补前置 + 缺料提示新口径）
- `patch_v89194_d.py`（10KB）　— v89.194 批次D：将领详情三处 + 月俸 1.5 倍 + 前哨辐射改欧氏圆（显示=判定）
- `patch_v89194_e.py`（4KB）　— v89.194 批次E：己方前哨雷达辐射圈（map.js）
- `patch_v89194_f1.py`（14KB）　— v89.194 批次F1：藏珍阁数据表（DATA.COLLECT 18 系列 · 71 件）+ 导航图标
- `patch_v89194_f2.py`（6KB）　— v89.194 批次F2：藏珍阁出口组（domain.js）
- `patch_v89194_f3.py`（11KB）　— v89.194 批次F3：藏珍阁 UI（collectHTML）+ renderView 分支 + main.js 动作 + index.html（tab/CSS）
- `patch_v89194_g.py`（14KB）　— v89.194 批次G：smoke §194 断言段（本轮五条需求 + UI 三处 + 雷达圈）
- `patch_v89194_h.py`（4KB）　— v89.194 批次H：e2e §194 断言段（藏珍阁视图 + 购买 + 一键集齐 + 将领页两处）
- `patch_v89195_a.py`（9KB）　— v89.195 批次A：前哨可放手（老板 1）
- `patch_v89195_b.py`（7KB）　— v89.195 批次B：为将领资质补全属性（老板 3）
- `patch_v89195_b5.py`（6KB）　— v89.195 批次B5：老档攻防补发（rankOf 两条路径）+ guardFillOf 攻防段加固
- `patch_v89195_c.py`（3KB）　— v89.195 批次C：等级高功能强（档位一览表）
- `patch_v89195_d.py`（2KB）　— v89.195 批次D：smoke 旧断言适配新机制（2 处）
- `patch_v89195_e.py`（6KB）　— v89.195 收尾补丁 E：需求档案补录 + smoke §195 段插入
- `patch_v89195_f.py`（1KB）　— v89.195 补丁F：e2e §195 段插入（前哨放手真点全链 + 档位一览）
- `patch_v89195_g.py`（1KB）　— v89.195 补丁G：前哨总览分页 13→8（档位一览表占高，防溢出）
- `patch_v89196_a.py`（7KB）　— v89.196 批次A：为将领资质补全属性 v2（老板 1）
- `patch_v89196_b.py`（6KB）　— v89.196 批次B：放手后可重新占据（老板 2）
- `patch_v89196_c.py`（7KB）　— v89.196 批次C：战斗回看三情形（老板 4）
- `patch_v89196_d.py`（8KB）　— v89.196 批次D：雷达圈改地块边界折线（静态）（老板 6）
- `patch_v89196_e1.py`（2KB）　— v89.196 批次E1：DATA.COLLECT 18 系加成就解锁条件（老板 7）
- `patch_v89196_e2.py`（7KB）　— v89.196 批次E2：成就型收藏 —— 条件出口组 + 两段式闸（老板 7）
- `patch_v89196_e3.py`（7KB）　— v89.196 批次E3/E4：藏珍阁三态 UI（老板 7）
- `patch_v89196_f.py`（7KB）　— v89.196 批次F：旧断言适配新机制（5 条红单）
- `patch_v89196_f2.py`（6KB）　— v89.196 批次F2：4 条红的修复与诊断
- `patch_v89196_f3.py`（6KB）　— v89.196 批次F3：三红修复
- `patch_v89196_f4.py`（4KB）　— v89.196 批次F4：§196③ 兼容两种结算走向（挂起→autoBattle / 直接自动结算）
- `patch_v89196_f5.py`（6KB）　— v89.196 批次F5：e2e 适配与新增
- `patch_v89196_g.py`（8KB）　— v89.196 收尾补丁 G：需求档案补录 + smoke §196 段插入
- `patch_v89197_a.py`（13KB）　— v89.197 批次A：S2 经验道具两档制 + 战法可见性（估算计入 + 战报【战法】行）
- `patch_v89197_arc.py`（8KB）　— v89.197 档案补录：总览行 + 明细段（幂等）
- `patch_v89197_b.py`（9KB）　— v89.197 批次B：据点等级分布改权重表（老板 2：5级以上占80% · 等级越高比例越高）
- `patch_v89197_c.py`（4KB）　— v89.197 批次C：A批红单修复
- `patch_v89197_d.py`（17KB）　— v89.197 批次D：出征界面规范（老板 3/4/5）
- `patch_v89197_e.py`（5KB）　— v89.197 批次E：全局悬停规范（老板 5）
- `patch_v89198_a.py`（8KB）　— v89.198 批次A：data.js 战法表退役 + domain.js 出口退役 + index.html CSS 退役
- `patch_v89198_b.py`（11KB）　— v89.198 批次B：battle.js 战法全链清退（校验/效果/打包/重放/战报/队列/日志/dispatch）
- `patch_v89198_c.py`（27KB）　— v89.198 批次C：ui.js —— ① 战法块全清 ② 备注四项（阵位/精力体力/相称建议/锦囊）
- `patch_v89198_d.py`（3KB）　— v89.198 批次D：main.js 战法动作/校验退役
- `patch_v89198_e.py`（22KB）　— v89.198 批次E：smoke-test.js —— §94 E1/E2 升级 · §197 升级 · 新增 §198
- `patch_v89198_f.py`（10KB）　— v89.198 批次F：e2e-test.js —— §197 升级 + 新增 §198（真 DOM）
- `patch_v89198_g.py`（3KB）　— v89.198 批次G：修补被本轮改动打穿的 4 条旧断言
- `patch_v89198_h.py`（7KB）　— v89.198 批次H：四条红修复（domain 辎重真 bug + smoke 三条口径）
- `patch_v89198_i.py`（5KB）　— v89.198 批次I：① smoke §198⑤ 档案在册断言 ② 需求档案补录（v89.198）
- `patch_v89199_arc.py`（5KB）　— v89.199 需求档案补录：总览行 + 明细段
- `patch_v89199_p1.py`（5KB）　— v89.199 批次 P1：自动征兵「整页逐渐放大」布局根因修复
- `patch_v89199_p2.py`（15KB）　— v89.199 批次 P2：时间跳变补偿加固（唯一出口 loopPulse + 唤醒通道 + 版本标识）
- `patch_v89200_a.py`（7KB）　— v89.200 批次 A：睡眠/离线期间自动打（挂起战斗自动打完）
- `patch_v89200_arc.py`（7KB）　— v89.200 需求档案补录（总览行 + 明细段 · 幂等）
- `patch_v89200_b.py`（6KB）　— v89.200 批次 B：出征界面三改（围攻行下线 / 预估移左列下方 / 统一行右侧 10 字 + 两块固定 2 行高）
- `patch_v89200_c.py`（4KB）　— v89.200 批次 C：旧断言升级（4 处）+ §200 段插入
- `patch_v89201_a.py`（7KB）　— v89.201 批次A：侦查报告单页化（去分页 + 四板块 + 编制三栏 + xxl/tall 档）
- `patch_v89201_b.py`（13KB）　— v89.201 批次B：铁匠铺多选打造（_forgeSelList + 全选/清空 + doForge 多件）+ reopenKeepScroll 通用出口
- `patch_v89201_c.py`（4KB）　— v89.201 批次C：百炼强化专属界面（网格卡 + 筛选 + 底键）+ 滚动回顶修复
- `patch_v89201_d.py`（6KB）　— v89.201 批次D：smoke§201 + e2e§201 插入 + e2e 措辞升级 + 档案补录
- `patch_v89201_e.py`（3KB）　— v89.201 批次E：三条红修复（v79 面板判据升级 / §180⑥ 选择器升级 / §201⑦ 前缀撞车修复）
- `patch_v89202_a.py`（12KB）　— v89.202 批次A：蕴养同款（面板改网格专属界面 + main 接线 + CSS 退役 + key 出口注释）
- `patch_v89202_b.py`（8KB）　— v89.202 批次B：收藏条件"达到过即永久解锁"（峰值记录）
- `patch_v89202_c.py`（5KB）　— v89.202 批次C：断言升级 + 版本号 + 侦查面板注释留档
- `patch_v89202_d.py`（12KB）　— v89.202 批次D：新增 §202 段落（smoke 结构+行为 · e2e 真渲染+真点）
- `patch_v89203_a.py`（10KB）　— v89.203 批次A：防守默认全员前进（野地/据点/名城统一 · 撤销攻城"防御"特例）
- `patch_v89203_b.py`（12KB）　— v89.203 批次B：爵位管理城池数（平民 9 · 每级 +1 · 封顶 30）
- `patch_v89203_c.py`（6KB）　— v89.203 批次C：规则变更连带断言重写（§0.7 三件套）
- `patch_v89203_d.py`（4KB）　— v89.203 批次D：① 弹窗打开时 toast 上浮屏幕中上部（老板 1）② onConquer 拒绝补 toast（老板 3 反馈）
- `patch_v89203_e.py`（12KB）　— v89.203 批次E：版本号 + §203 断言段（smoke 结构/行为 · e2e 真渲染）
- `patch_v89204_a.py`（4KB）　— v89.204 批次 A：data.js —— 民心占领机制数据层
- `patch_v89204_arch.py`（5KB）　— v89.204：需求档案补录（总览行 + 明细段）
- `patch_v89204_b.py`（3KB）　— v89.204 批次 B：state.js —— 玩家城"战争创伤"民心出口组（唯一出口）
- `patch_v89204_c.py`（8KB）　— v89.204 批次 C：domain.js
- `patch_v89204_d.py`（6KB）　— v89.204 批次 D：battle.js —— 围攻段改制（仅胜扣 20 / 文案民心）
- `patch_v89204_e.py`（5KB）　— v89.204 批次 E：state.js —— 守城结算接线
- `patch_v89204_f.py`（4KB）　— v89.204 批次 F：ui.js —— 民心显示按城 + 文案（守备→民心）
- `patch_v89204_f2.py`（1KB）　— v89.204 批次 F2：main.js —— 调税 toast 民心按当前城
- `patch_v89204_f3.py`（2KB）　— v89.204 批次 F3：state.js —— 税收按城级民心（结算 + 分解两处同源）
- `patch_v89204_g.py`（8KB）　— v89.204 批次 G：smoke-test.js —— 7 处旧断言按新口径升级（不删 · §0.7 规则变更三件套）
- `patch_v89204_h.py`（11KB）　— v89.204 批次 H：ui.js —— 需求 2
- `patch_v89204_i.py`（5KB）　— v89.204 批次 I：index.html —— 需求 2 样式
- `patch_v89204_i2.py`（1KB）　— v89.204 批次 I2：main.js —— case 'forge-setinfo' 墓碑
- `patch_v89204_j.py`（8KB）　— v89.204 批次 J：断言升级（smoke 7 处 + e2e 1 处）
- `patch_v89204_k.py`（1KB）　— v89.204：插入 §204 段（smoke + e2e）—— 长内容走文件（§12.5）
- `patch_v89204_skill.py`（5KB）　— v89.204：SKILL 沉淀追加 §116
- `patch_v89205_a.py`（7KB）　— v89.205 批次 A：挂件行（将领名称信息下的「🔮 宝具」行）整行退役 + 卸下迁入选择窗
- `patch_v89205_b.py`（12KB）　— v89.205 批次 B：测试升级（§191⑦b / §194⑥ 两条连带翻红）+ 新增 §205 段（smoke + e2e）
- `patch_v89205_skill.py`（3KB）　— v89.205：SKILL.md 追加 §117（UI 行退役 + 入口迁移定式）
- `patch_v89206_skill.py`（3KB）　— v89.206：SKILL.md 追加 §118（三向梳理评估方法论）
- `patch_v89207_a.py`（16KB）　— v89.207 批次 A：快赢五条 + 离线/睡眠报告化 + 战斗增速档（代码）
- `patch_v89207_b1.py`（3KB）　— v89.207 批次 B1：三条连带断言升级（§193① §193② §193③ §200①）
- `patch_v89207_b2.py`（11KB）　— v89.207 批次 B2：新增 §207 段（smoke + e2e）+ 版本号 v89.207
- `patch_v89207_skill.py`（3KB）　— v89.207：SKILL.md 追加 §119（快赢类执行 + 报告化改造 + 口径漂移）
- `patch_v89209_a.py`（8KB）　— v89.209 · v89.208 评估缺陷链修复（state.js 五段）
- `patch_v89209_b.py`（11KB）　— v89.209 · 补丁 B：版本号 + §199④ 随轮升级 + smoke/e2e 新增 §209 段
- `patch_v89209_d.py`（5KB）　— v89.209 · 补丁 D：需求档案（总览行 + 明细段）
- `patch_v89209_e.py`（6KB）　— v89.209 · 收尾补丁 E：
- `patch_v89210_a.py`（6KB）　— v89.210 补丁 A —— battle.js：
- `patch_v89210_b.py`（25KB）　— v89.210 补丁 B —— ui.js：
- `patch_v89210_c.py`（4KB）　— v89.210 补丁 C —— main.js：
- `patch_v89210_d.py`（2KB）　— v89.210 补丁 D —— index.html：环境状态条 chips 样式（插在 .nav-sky .ns-k 之后）
- `patch_v89210_e.py`（1KB）　— v89.210 补丁 E —— smoke-test.js：插入 §210 段 + §199④ 版本升级
- `patch_v89210_f.py`（5KB）　— v89.210 补丁 F —— 需求档案.md：总览行 + v89.210 明细段
- `patch_v89210_g.py`（1KB）　— v89.210 补丁 G —— e2e-test.js：插入 §210 段
- `patch_v89210_skill.py`（4KB）　— v89.210 SKILL 沉淀：§121（键盘流 / 唯一出口重构对照法 / 信息重复自查 / 拨钟等价）
- `patch_v89211_a.py`（8KB）　— v89.211 补丁 A：强化乘数收敛（domain 出口 + systems 结算/评分）
- `patch_v89211_arch.py`（5KB）　— v89.211 档案补丁：总览行 + 明细段
- `patch_v89211_b.py`（4KB）　— v89.211 补丁 B：state.js
- `patch_v89211_c.py`（2KB）　— v89.211 补丁 C：battle.js onConquer 释放块 → 补建民房
- `patch_v89211_d.py`（8KB）　— v89.211 补丁 D：ui.js
- `patch_v89211_e.py`（3KB）　— v89.211 补丁 E：main.js
- `patch_v89211_f.py`（2KB）　— v89.211 补丁 F：domain.js GAME.train 域侧防御回落
- `patch_v89211_g.py`（18KB）　— v89.211 补丁 G：测试升级（规则变更重写 + §211 新段）
- `patch_v89211_skill.py`（3KB）　— v89.211 SKILL 沉淀 §122（append 脚本，防 Edit 撞字符）
- `patch_v89212_a.py`（7KB）　— v89.212（老板 1）：城外堆场**按资源分账** —— domain.js 出口组与消费点
- `patch_v89212_arch.py`（5KB）　— v89.212：需求档案补录 + 版本号（main.js）+ 版本断言随轮升级（smoke §199④）
- `patch_v89212_b.py`（4KB）　— v89.212（老板 1）：城外堆场按资源分账 —— state.js 三处资源循环（按资源封顶）
- `patch_v89212_g.py`（9KB）　— v89.212：测试升级（规则变更的连带断言按 §0.7 重写）+ §212 新段（smoke + e2e）
- `patch_v89212_g2.py`（3KB）　— v89.212：测试升级（续）—— §159⑤ ×2 / §160① ×2 改按资源口径
- `patch_v89212_g3.py`（9KB）　— v89.212：§212 新段（smoke）+ §212e 新段（e2e）
- `patch_v89212_h.py`（3KB）　— v89.212：e2e 里 §158/§160 用例改按资源口径（规则变更连带）
- `patch_v89212_skill.py`（4KB）　— 沉淀 SKILL §123（append 模式，防 Edit 撞字符差异）
- `patch_v89213_a.py`（4KB）　— v89.213 补丁 A：分页条改「整体居中 flex」（三栏 grid 退役）
- `patch_v89213_b.py`（2KB）　— v89.213 补丁 B：ui.js 两处分页出口注释改口径（三栏 → 整体居中）
- `patch_v89213_c.py`（1KB）　— v89.213 补丁 C：.bottombar padding 对称化（左 92/右 12 → 左右 92）
- `patch_v89213_d.py`（3KB）　— v89.213 补丁 D（smoke）：① §204⑦ 重写（三栏 → 整体居中口径）② §199④ 版本升级
- `patch_v89213_e.py`（4KB）　— v89.213 补丁 E（e2e）：① §204① 标题措辞更新（三栏 → 三段，判据不变）
- `patch_v89213_f.py`（4KB）　— v89.213 补丁 F：① shot_v89204_gates.js 两处"页码居中"判据 → 内容块居中（v89.213 口径）
- `patch_v89213_g.py`（4KB）　— v89.213 档案补丁：总览行 + 明细段（双 guard 防重跑重复）
- `patch_v89213_skill.py`（4KB）　— v89.213 SKILL 沉淀：§124 追加
- `patch_v89214a_terms.py`（5KB）　— v89.214 换皮 PART A：名词层**机械替换**（唯一出口式：一份映射、全仓同改）
- `patch_v89214b_desc.py`（17KB）　— v89.214 换皮 PART B：定向重写（描述/表名/人物/羁绊/年号/圣物/称号/战技）
- `patch_v89214c_archive.py`（2KB）　— v89.214 收口：把 smoke 里**引用历史档案**的 md.indexOf('…') 串还原成老板原文
- `patch_v89217a_ling.py`（13KB）　— v89.216 换皮第二批 PART C：江湖-修炼线 → 荒野-改造线（机械词表 + 表驱动名 + 场景文案）
- `patch_v89217a_names.py`（18KB）　— v89.217 · 州名 / 城池名 → 架空命名（废土 · 余烬纪元）
- `patch_v89217b_tests.py`（12KB）　— v89.217 · 命名替换的测试与界面连带（smoke/e2e/ui 按钮）
- `patch_v89217c_archive.py`（6KB）　— v89.217 / v89.218 需求档案补录（总览行 + 明细段；两处各自幂等守卫）
- `patch_v89217c_story.py`（4KB）　— v89.216 换皮第二批 PART E：**故事库**（story/vol-*.js · 84 卷）术语对齐
- `patch_v89217d_items.py`（9KB）　— v89.216 换皮第二批 PART A：长尾名词 —— 物品 214 / 材料 24 / 珠宝 18 / 套装 7 / 收藏 18 系 73 件
- `patch_v89217e_icons.py`（9KB）　— v89.216 换皮视觉层（程序化图标）：① 调色板「荒原化」（材质与色相：青瓦→锈铁顶/琉璃→旧铜/
- `patch_v89218a_story_core.py`（25KB）　— v89.218 · 故事系统退役（产品代码）
- `patch_v89218b_smoke.py`（27KB）　— v89.218 · 故事系统退役 —— smoke-test.js 断言改写
- `patch_v89218c_e2e.py`（8KB）　— v89.218 · 故事系统退役 —— e2e-test.js 断言改写
- `patch_v89219a_words.py`（10KB）　— v89.219-a：机构词更换（产品 + 测试 **同映射同改**）
- `patch_v89219b_rest.py`（7KB）　— v89.219-b：机构词收尾（缩略图标签后缀 / 紧凑枚举）+ 装备悬停"白值=原始值"校正（老板 2）
- `patch_v89219c_enh.py`（15KB）
- `patch_v89219d_tests.py`（3KB）　— v89.219-d：版本号升级 + data.js 注释换代 + 插入 smoke §219 段 / e2e §219E 段
- `patch_v89219e_archive.py`（5KB）　— v89.219 需求档案：总览行 + 明细段（幂等）
- `patch_v89219f_coll.py`（9KB）　— v89.219-f：收藏表换皮补完（v89.216 第二批遗漏）——
- `patch_v89220a_gene.py`（4KB）　— v89.220 补丁 A：温室农场 → 基因实验室（老板 1）。
- `patch_v89220b_transfer.py`（7KB）　— v89.220 补丁 B：调兵（transfer/派驻）不再受目标城练兵场容量限制（老板 2）。
- `patch_v89220c_techhi.py`（14KB）　— v89.220 补丁 C：分城/占领城建筑的"科技闸存量宽限"三件套（老板 3）。
- `patch_v89220e_archive.py`（6KB）　— v89.220 档案补录：总览行 + 明细段（幂等）。
- `patch_v89221a_inst.py`（22KB）　— v89.221a · 注释过一遍（一）：机构词 + 旧城名 + 创建界面 chip 标签
- `patch_v89221b_troops.py`（16KB）　— v89.221b · 注释过一遍（二）：旧兵种缩写对齐（产品侧）
- `patch_v89221c_hao.py`（3KB）　— v89.221c · 绰号更换：WILD_LORD_TITLE → 末日废土称呼
- `patch_v89221d_badge.py`（6KB）　— v89.221d · 任务页签：去数字徽标，改公文同款闪烁
- `patch_v89221e_tests.py`（5KB）　— v89.221e · 测试面：插入 §221 断言段 + 版本号升级
- `patch_v89221f_archive.py`（4KB）　— v89.221 需求档案：总览行 + 明细段（幂等）
- `patch_v89222a_smoke.py`（9KB）　— v89.222a · 用例文件旧词全面更换（smoke-test.js）
- `patch_v89222b_e2e.py`（2KB）　— v89.222b · 用例文件旧词全面更换（e2e-test.js）
- `patch_v89222c_ui.py`（2KB）　— v89.222c · 产品侧收尾：ui.js 三处旧城名引述 + 一处旧城名引语；main.js 版本号
- `patch_v89222d_sec.py`（1KB）　— v89.222d · 向 smoke 插入 §222 零残留守卫段（片段文件读取，防转义事故）
- `patch_v89222e_archive.py`（1KB）　— v89.222e · 需求档案补录（总览行 + 明细段；两处各自幂等）
- `patch_v89223a_ab.py`（2KB）　— v89.223a：兵牌简称（ab）换代 —— js/data.js 15 步（含两组换位链）+ 终态序列校验。
- `patch_v89223b_misc.py`（3KB）　— v89.223b：产品侧旧词收尾（注释/文案 15 处 · 机制零变化）。
- `patch_v89223c_smoke.py`（2KB）　— v89.223c：smoke —— §129③/§151 镜像与 §199④ 版本正则修正 + §223 守卫段插入。
- `patch_v89223e2_playtest.py`（1KB）　— v89.223e2：playtest 显示词与注释同步（义兵→民兵 / 轻骑→摩托游骑 / 铁骑→装甲战车）。
- `patch_v89223e_tools.py`（2KB）　— v89.223e：活工具夹具同步 —— cityName 许都→灰岗（17 文件）+ 显示词（audit 链）。
- `patch_v89223f_archive.py`（5KB）　— v89.223f：需求档案补录（总览行 + v89.222 观察项销项注 + 明细段）。
- `patch_v89223g_fixdoc.py`（2KB）　— v89.223g：文档口径校正（记忆/档案：活工具同步范围 + 收尾计数 16）。
- `patch_v89224a2_guardfix.py`（2KB）　— v89.224a2：修复三个被误扫的"需求档案逐字守卫"（回改档案原文），并导出全量档案守卫掩码清单。
- `patch_v89224a_names.py`（3KB）　— v89.224a：将领→英雄 · 商城→游商（全站换代 · 唯一映射源见 docs/废土术语映射表.md）
- `patch_v89224b1_data.py`（10KB）　— v89.224b 结构补丁：建筑→基因实验室 · 实验室去播种化 · 血清/项目更名 · 种子体系退役。
- `patch_v89224b2_code.py`（24KB）　— v89.224b2：ui/domain/systems/main/state/battle/index 结构补丁（实验室迁移 + 去播种化）。
- `patch_v89224b2b_misc.py`（4KB）　— v89.224b2b：注释残留清理 + seedLv→dropLv 变量修复（b2 遗留）。
- `patch_v89224b3_tests.py`（22KB）　— v89.224b3：smoke / e2e 用例改写（实验室迁移 + 去播种化 · 按新规则重写，不删不放宽）。
- `patch_v89224b4_e2e.py`（5KB）　— v89.224b4：e2e 实验室段改写（入口迁建筑格 + 立项制）。
- `patch_v89224b5_fix.py`（5KB）　— v89.224b5：smoke 10 失败修复 + SHOP_CATS seed 页签退役。
- `patch_v89224b8_init.py`（4KB）　— v89.224b8：初始前置拆表（BUILD_PREREQ_INIT 只拦"新建"）—— 修 §191④/§220③c。
- `patch_v89224b9_guard.py`（13KB）　— v89.224b9：smoke §224 守卫段 + 需求档案补录。
- `patch_v89224c1_equip.py`（18KB）　— v89.224c：装备双轨换代 —— 军中→机甲部件 · 改造→基因强化（器官化）· 品质名工业档。
- `patch_v89224c2_sweep.py`（3KB）　— v89.224c2：装备双轨扫尾 + 资质五档 + 六维四项（全局·带档案守卫掩码）。
- `patch_v89224ef2_finish.py`（9KB）　— v89.224ef2：ef 补丁收尾 —— 修正"建材料"误伤 + 补齐 ui 粮草行 + 遗迹注释 + 依赖链表。
- `patch_v89224ef_res_deps.py`（10KB）　— v89.224e+f：资源 4 种重定义（建材→碎石 · 粮草→净水显示收口）+ 建筑依赖链双层闸。
- `patch_v89225a_data_css.py`（10KB）　— v89.225 补丁 A：DATA.SERIES 地块色/recruit 族 + index.html 8 条染色 CSS + 版本号
- `patch_v89225b_smoke.py`（14KB）　— v89.225 补丁 B：smoke 断言升级（族旗退役 → 地块染色）
- `patch_v89226_archive.py`（4KB）　— v89.226 复核 · 需求档案补录：
- `patch_v89226_smoke.py`（3KB）　— v89.226 复核补丁：smoke §225③b —— 其余三主题（light/bamboo/dark2）逐字节对齐断言。
- `patch_v89226_tools.py`（5KB）　— v89.226 复核补丁 · 工具卫生五项：
- `patch_v89227a_family.py`（9KB）　— v89.227 P1：城内族色 8→4 + 降饱和（data.js + index.html + main.js 版本）。
- `patch_v89227b_mats.py`（8KB）　— v89.227 P2：批次二 · 材料体系汉化 —— 24 名核查清理 + 六大系列名/use + 特产 lore + 描述去古风。
- `patch_v89227c_names.py`（17KB）　— v89.227 P3（v2 · 幂等版）：专名逐件评估落地 ——
- `patch_v89227d_tests.py`（14KB）　— v89.227 P4：测试同步 —— smoke（族色段 + §225 段重写 + 版本正则 + 材料名）+ e2e 连带。
- `patch_v89228a_craft.py`（4KB）　— v89.228 批 A：装备名录长尾换代（craft 8 处 + 神兵连带 2 处 + e2e 断言同步）。
- `patch_v89228b_rename.py`（5KB）　— v89.228 批 B：黄金→旧币 / 人口→幸存者 全站换代（js + index + smoke + e2e）。
- `patch_v89228c2_fix.py`（6KB）　— v89.228 批 C2：docs 同步修正（C 批的伪影修复 + 补充映射）。
- `patch_v89228c_docs.py`（7KB）　— v89.228 批 C：docs 活文档同步（术语按《废土术语映射表》全量对齐）。
- `patch_v89228d1_smoke.py`（1KB）　— v89.228 批 D1：smoke 插入 §228 段 + 版本正则三连（v89.227→v89.228）。
- `patch_v89228d2_arc_map.py`（11KB）　— v89.228 批 D2：需求档案补录（总览行 + 明细段）+ 废土术语映射表更新。
- `patch_v89229a1_html.py`（11KB）　— v89.229 批 a1：index.html —— 地块去族色（统一浅废土底）+ 名称/等级顶部色块 + 4 主题新色值
- `patch_v89229a2_data.py`（5KB）　— v89.229 批 a2：data.js —— SERIES plot 更新（新色块色）+ 注释沿革
- `patch_v89229a3_ui.py`（2KB）　— v89.229 批 a3：ui.js —— isoCell：badge 并入名称行（名称/等级都在格顶）
- `patch_v89229a4_smoke.py`（14KB）　— v89.229 批 a4：smoke-test.js —— 既有断言口径更新 + 新增 §229a 段（城视图文字色块）
- `patch_v89229a5_fix.py`（3KB）　— v89.229 批 a5：修正 —— ① data.js plot 用 node 精确解（渲染逐字节复现尾数）② index.html 裸 #fff → 令牌
- `patch_v89229b1_data.py`（13KB）　— v89.229 批 b1：data.js —— 资源四类重定义（生物质/净水/电能/废钢 + 四产地建筑）
- `patch_v89229b2_chain.py`（8KB）　— v89.229 批 b2：questdata / ui / state / battle / domain / index.html —— 资源换代文案全链
- `patch_v89229b3_tests.py`（6KB）　— v89.229 批 b3：smoke / e2e —— 资源换代断言更新
- `patch_v89229b4_sec.py`（5KB）　— v89.229 批 b4：main.js 漏网修复 + smoke §229b 守卫段
- `patch_v89229c10_bitmaps.py`（4KB）　— v89.229c10：兵种位图随 18→14 换代（原型继承 · 一次性搬运 + 登记表重生成）
- `patch_v89229c11_tail.py`（5KB）　— v89.229c11：smoke 收尾 7 处（闸门变量名 / 卡计数 / 夹具去重 / 机动判据 / 搬运夹具）
- `patch_v89229c12_page.py`（7KB）　— v89.229c12：分页残留（_trainTab='inf' / _trainFilter）+ §164② 器械豁免 + §223④ 文案
- `patch_v89229c13_last.py`（4KB）　— v89.229c13：最后一批残留（侦察夹具 2 处 · v81 队列页 · v84 三页对照）
- `patch_v89229c14_sec.py`（10KB）　— v89.229c14：新增 §229c 守卫段（兵种重构的回归哨兵）+ 版本号三连升级
- `patch_v89229c14b_sec_fix.py`（10KB）　— v89.229c14b：修复 §229c 段（引号转义 + 简化 ④ + BITMAPS 取全局）
- `patch_v89229c15_final.py`（6KB）　— v89.229c15：① gicons 兵种名册换代 ② §229c③ 幂等标记判据 ③ 旧轮版本 pin 放宽 ④ 需求档案补录
- `patch_v89229c16_comments.py`（3KB）　— v89.229c16：产品侧注释随兵种重构换代（长词优先 · 沿革注释豁免 · 逐行打印供复核）
- `patch_v89229c17_e2e.py`（11KB）　— v89.229c17：e2e 红单按新口径重写（14 兵种 · 四页分页 · 统一面板）+ 产品侧无 idx 默认队列页
- `patch_v89229c18_e2e2.py`（3KB）　— v89.229c18：e2e 尾批（标题两处 / §163 时长口径 / §211e② 缩进）
- `patch_v89229c19_docs.py`（7KB）　— v89.229c19：活文档同步（兵种 18→14 · 位图改名 · 术语映射表补录）
- `patch_v89229c1_troops.py`（9KB）　— v89.229 批 c1：data.js —— TROOPS 表重构（18→14 · 三组分页 · cat 退役 → grp · ride 显式化）
- `patch_v89229c2_data2.py`（9KB）　— v89.229 批 c2：data.js 余项 —— troopOrder / WILD_DEFENSE / garrisonMix / SMART_PLAN.targets
- `patch_v89229c3b_chain.py`（14KB）　— v89.229 批 c3：state/battle/main/questdata/icons/data/ui —— 兵种引用全链换代 + 老档迁移
- `patch_v89229c4a_ui.py`（18KB）　— v89.229 批 c4a：ui.js —— 训练面板统一化（三组分页 · 工位按兵种解析 · filter 退役）
- `patch_v89229c5a_swap.py`（2KB）　— v89.229 批 c5a：smoke / e2e —— 旧兵种显示名 + id 全量替换（词边界 · 数量报告）
- `patch_v89229c6_jsnames.py`（3KB）　— v89.229 批 c6：产品 js/*.js —— 旧兵种显示名全量替换（历史标定注释掩码保护）
- `patch_v89229c9_smoke_fix.py`（45KB）　— v89.229c9：smoke 红单按新口径重写（兵种重构 18→14 · 三组分页 · cat 退役）
- `patch_v89229c9b_smoke3.py`（7KB）　— v89.229c9b：补齐 c9 三段（锚点缩进写错为 4 空格，实际 6 空格）
- `patch_v89230a_core.py`（11KB）　— v89.230 批次 A：产品侧 ——
- `patch_v89230b_smoke.py`（17KB）　— v89.230 批次 B：smoke-test.js ——
- `patch_v89230c_tools.py`（12KB）　— v89.230 批次 C：活工具同步（兵种 id 换代）——
- `patch_v89230d_archive.py`（4KB）　— v89.230 需求档案补录：总览行（插在 v89.229 行后）+ 文件尾明细段。双 guard 幂等。
- `patch_v89230e_life.py`（4KB）　— v89.230 批次 E：lifecycle 工具同族修复（4 处）——
- `patch_v89230f_mem.py`（1KB）　— v89.230 收尾：技能 §139 + 工作记忆 追加（双 guard 幂等）。
- `patch_v89231a_data.py`（7KB）　— v89.231 批次 a：js/data.js —— 科技 24 项术语换代 + 分组（TECH_CATS）
- `patch_v89231b_ui.py`（3KB）　— v89.231 批次 b：ui.js 分组渲染 + 文案换代 + index.html 分组样式
- `patch_v89231c_core.py`（2KB）　— v89.231 批次 c：battle.js / domain.js / main.js / systems.js / tactic.js
- `patch_v89231d1_tests.py`（2KB）　— v89.231 批次 d1：smoke-test.js / e2e-test.js —— 词替换（掩码-替换-恢复）
- `patch_v89231d2_sec.py`（9KB）　— v89.231 批次 d2：smoke §231 守卫段 + 版本三连（v89.231）
- `patch_v89231e_docs.py`（9KB）　— v89.231 批次 e：活文档同步 + gen 工具 + 映射表补节 + 档案补录
- `patch_v89231f_joinfix.py`（0KB）　— 修复 smoke-test.js 的 join 断行（真换行 → 字面 \\n 两字符）
- `patch_v89232a_visible.py`（7KB）　— v89.232 批次 A：产品可见面废土化收尾（39 处）
- `patch_v89232b_tests.py`（3KB）　— v89.232 批次 A2（ui 标题修正）+ 批次 B（测试面同步）
- `patch_v89232c_tools.py`（6KB）　— v89.232 批次 C：活工具面废土化收尾（22 件 · 术语换代 + 展示文本对齐）
- `patch_v89232e_docs.py`（6KB）　— v89.232 批次 E：术语映射表补节 + 需求档案补录
- `patch_v89233a_jin.py`（3KB）　— v89.233 批 1：货币「金」→「旧币」统一 —— dry-run / apply
- `patch_v89233b_smoke.py`（3KB）　— v89.233 批 1 测试面同步：货币「金→旧币」相关的 5 条断言按新口径重写（§0.7 规则变更）。
- `patch_v89233c_quest.py`（9KB）　— v89.233 批 2：任务文风废土化（g01~g50 + r01~r36 的 title/desc 重写）
- `patch_v89233d_smoke2.py`（2KB）　— v89.233 批 2 测试面同步：任务文案换代 → 4 处断言/注释按新口径重写。
- `patch_v89233e_semantic.py`（4KB）　— v89.233 批 3：语义描述改 —— 垂钓/行猎产出顺滑 · 旧钱→旧币 · analyze 正则对齐。
- `patch_v89233f_comments.py`（11KB）　— v89.233 批 4（产品侧）：注释改 —— 历史标定段压缩 + 单点旧词换代。
- `patch_v89233g_toolcmt.py`（3KB）　— v89.233 批 4（工具面）：活工具 + 历史实机脚本的注释/输出文字旧词清理。
- `patch_v89233h_tooljin.py`（3KB）　— v89.233 批 4（工具面·货币「金」）：活工具与历史脚本的叙述/输出层"金"→"旧币"。
- `patch_v89233i_sec.py`（8KB）　— v89.233 批 5：守卫段 §233 插入 + 版本三连升级（v89.231 → v89.233）。
- `patch_v89233j_archive.py`（6KB）　— v89.233 批 5：需求档案补录 ——
- `patch_v89233k_tail.py`（5KB）　— v89.233 收尾：工作记忆追加 + 技能 §142 沉淀（各自幂等）。
- `patch_v89233s_map_sync.py`（8KB）　— patch_v89233s_map_sync.py —— v89.233 封样轮：菱形域断言同步
- `patch_v89234_cleanup.py`（7KB）　— patch_v89234_cleanup.py —— v89.234 清账轮
- `patch_v89234b_archive.py`（4KB）　— patch_v89234b_archive.py —— v89.234 需求档案补录（总览行 + 明细段）
- `patch_v89235a_core.py`（4KB）　— patch_v89235a_core.py —— 需求 2 内核：城外资源建筑等级 ≤ 政务厅等级
- `patch_v89235b_ui.py`（3KB）　— patch_v89235b_ui.py —— 需求 1（政务厅角标）+ 需求 2 界面同尺
- `patch_v89235c_smoke.py`（4KB）　— patch_v89235c_smoke.py —— smoke 按新口径重写（§0.7）
- `patch_v89235d_sec.py`（9KB）　— patch_v89235d_sec.py —— §235 守卫段 + 版本三连（v89.234 → v89.235）
- `patch_v89235e_archive.py`（6KB）　— patch_v89235e_archive.py —— 需求档案补录 v89.235（总览行 + 明细段）
- `patch_v89236_exec.py`（9KB）　— v89.236 执行：文档分类整合与清理（备份已完成 → .workbuddy/backup/v89236-docs/）
- `patch_v89236b_smoke.py`（8KB）　— v89.236：smoke 修复（两条连带红按新口径重写）+ 新增 §236 守卫段。
- `patch_v89236c_archive.py`（6KB）　— patch_v89236c_archive.py —— 需求档案补录 v89.236（总览行 + 明细段）
- `patch_v89237_archive.py`（4KB）　— v89.237 档案补录：总览行 + 明细段（幂等双守）
- `patch_v89238_archive.py`（3KB）　— v89.238 需求档案补录：总览行 + 明细段（LF 保持 · 幂等 · 写后自检）
- `patch_v89239_archive.py`（5KB）　— v89.239 档案补录：总览表行 + 明细段
- `patch_v89240_archive.py`（4KB）　— v89.240 档案补录：总览表行 + 明细段
- `patch_v8928_theme_check.py`（2KB）　— v89.28 题材线（江湖 / 修炼 / 四夷）· check.py 判据 12 扩展
- `patch_v8928_theme_docs.py`（17KB）　— v89.28 题材线文档补录（README / 需求档案 / 设计规范 / 工作备忘 / 工作记忆）
- `patch_v8928_theme_wire.py`（10KB）　— v89.28 题材线接线：index.html 装载 + smoke 断言 + e2e 真实点击
- `patch_v8929_docs.py`（11KB）　— v89.29 文档补录：README（入口改版）/ 需求档案 / 设计规范 / 工作备忘 / 工作记忆
- `patch_v8929_e2e.py`（10KB）　— v89.29 e2e 补丁：守卫 + §81 故事区整体重写
- `patch_v8929_engine.py`（13KB）　— v89.29 逸闻入口改版：列表菜单 → 概率奇遇
- `patch_v8929_smoke.py`（9KB）　— v89.29 smoke 补丁：概率奇遇（引擎口径 / 接线 / 叠层 / ext）+ 测试期默认关随机
- `patch_v8930_docs.py`（13KB）　— v89.30 文档补录：README §九 + 需求档案 + 设计规范 + 工作备忘（§43 表 + §51）+ 工作记忆
- `patch_v8930_wire.py`（7KB）　— v89.30 接线补丁：卷 39~44（36 篇）装载 + smoke 断言 + e2e VOL89 表
- `patch_v8931_docs.py`（12KB）　— v89.31 文档补录：README §八/§九 + 需求档案 + 设计规范 §45 + 工作备忘 §52 + 工作记忆
- `patch_v8931_engine.py`（19KB）　— v89.31 动作触发补丁（引擎 + UI + 挂点）
- `patch_v8931_tests.py`（11KB）　— v89.31 测试补丁：smoke（引擎 + 接线）· e2e（战事触发链 + 动作触发块）
- `patch_v8932_docs.py`（14KB）　— v89.32 文档补录：README §九（进度表/合计/可玩路径）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8932_wire.py`（6KB）　— v89.32 接线：铺量七批（卷 45~50 · 36 篇）
- `patch_v8933_docs.py`（13KB）　— v89.33 文档补录：README §九（进度表/合计/可玩路径/亮点/待办19）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8933_wire.py`（6KB）　— v89.33 接线：志异线样张三卷（vol-51 练功 / vol-52 灵异 / vol-53 志怪 · 18 篇）
- `patch_v8934_docs.py`（14KB）　— v89.34 文档补录：README §九 + 待办 + 需求档案 + 设计规范 + AI工作备忘 + 工作记忆。
- `patch_v8934_wire.py`（8KB）　— v89.34 接线补丁：铺量批（卷 54~59 · 36 篇 · 四线齐发）接入 index.html / smoke / e2e。
- `patch_v8935_docs.py`（11KB）　— v89.35 文档补录：README（进度表/合计/可玩路径/待办）+ 需求档案 + 设计规范 + 工作备忘 + 工作记忆
- `patch_v8935_wire.py`（6KB）　— v89.35 接线补丁：index.html 装载 / smoke 卷断言 / e2e VOL89 表（卷 60~65 · 36 篇）
- `patch_v8936_army.py`（20KB）　— v89.36：军粮口径改造（老板「维持军队无需耗粮食，相应招募提供耗粮3倍」）
- `patch_v8936_tests.py`（15KB）　— v89.36 测试补丁：smoke-test.js 旧军粮断言 → 新口径（维持退役 / 募兵×3 / 烽火接链）
- `patch_v8937_docs.py`（14KB）　— 文档补录：v89.36（军粮口径改造）+ v89.37（故事库铺量八批 卷 66~71）
- `patch_v8937_wire.py`（6KB）　— v89.37 接线：故事库卷 66~71（36 篇）入位后的四处接线
- `patch_v8938_docs.py`（10KB）　— v89.38 文档补录：README（进度表/合计/可玩路径/待办）+ 需求档案 + 设计规范 + 备忘
- `patch_v8938_wire.py`（6KB）　— v89.38 故事库接线：卷 72~77（35 篇 · 地理锚点收官批）
- `patch_v8939_docs.py`（12KB）　— v89.39 文档补录：README（进度表/合计/可玩路径/入口/待办）+ 需求档案 + 设计规范 + 备忘 + 记忆
- `patch_v8939_misc.py`（10KB）　— v89.39 总补丁
- `patch_v8940_docs.py`（6KB）　— v89.40 补丁 3/3：文档层（需求档案 / 设计规范 / 工作备忘 / 工作记忆）
- `patch_v8940_points_loyalty.py`（11KB）　— v89.40 补丁 1/3：代码层
- `patch_v8940_tests.py`（9KB）　— v89.40 补丁 2/3：测试层
- `patch_v8941_close.py`（12KB）　— v89.41 会话收尾补丁：
- `patch_v8942_docs.py`（13KB）　— v89.42 补丁 4/4：文档同步（五处）
- `patch_v8942_docs2.py`（2KB）　— v89.42 补丁 4b：项目地图 · 工具计数与截图数（精确锚点重试）
- `patch_v8942_map.py`（5KB）　— v89.42 补丁 1/2：map.js —— 野地贴图回归 + 逐格镜像变体
- `patch_v8942_tests.py`（5KB）　— v89.42 补丁 2/2：smoke-test.js —— v67 地形位图护栏改写为新不变量
- `patch_v8942_tex_mix.py`（3KB）　— v89.42 补丁 3：texVariant 换 32 位混合哈希
- `patch_v897.py`（18KB）
- `patch_v897_docs.py`（6KB）
- `patch_v897b.py`（1KB）　— v89.7 补丁修正 b：ui.js 君主面板「头像」行补 IIFE 收尾 `})() +`
- `patch_v8986_audit_cleanup.py`（4KB）　— v89.86 顺手修复 · audit 两告警（均由 v89.4x~8x 未提交改动引入，非本批新增）
- `patch_v8986_docs.py`（8KB）　— v89.86 · 文档同步：开发整改清单（状态）/ 试玩测评报告（banner）/ 需求档案 /
- `patch_v8986_docs2.py`（9KB）　— v89.86 · 文档同步（续）：设计规范 §98 / AI工作备忘 §106 / 门派系统规则 §十七
- `patch_v8986_docs3.py`（3KB）　— v89.86 · 备忘 §十一 登记新增出口（项目铁律：「新增出口必须登记」）
- `patch_v8986_e2e_add.py`（5KB）　— v89.86 · e2e 增量：整改清单关键 UI 触点（真实 DOM）
- `patch_v8986_e2e_fix.py`（8KB）　— v89.86 · e2e 存量失败修复（全部由 v89.4x~v89.85 未提交改动引入，与整改 21 条无关）
- `patch_v8986_e2e_fix2.py`（3KB）　— v89.86 · e2e 收尾两条（存量口径问题，非本次整改引入）
- `patch_v8986_e2e_fix3.py`（4KB）　— v89.86 · e2e 收尾：① P-06 战事触发块（阅读器元素须重查 —— 该用例里是首次创建）；
- `patch_v8986_p02_p15_p26.py`（7KB）　— v89.86 整改 · P-02 favicon + P-15 客栈空位引导 + P-26 新城裸城提示
- `patch_v8986_p03_p08.py`（8KB）　— v89.86 整改 · P-03 任务「前往」按钮 + P-08 随机任务可达性过滤
- `patch_v8986_p06.py`（8KB）　— v89.86 整改 · P-06 故事「稍后阅读」
- `patch_v8986_p06_tests.py`（10KB）　— v89.86 · P-06 测试同步：触发语义从「命中即开卷」→「入待阅 · 从待阅开卷」
- `patch_v8986_p07.py`（10KB）　— v89.86 整改 · P-07 黄金消耗出口：建造 / 科技队列的花金提速
- `patch_v8986_p12_p13.py`（7KB）　— v89.86 整改 · P0 显示缺陷：
- `patch_v8986_p15_fix.py`（2KB）　— v89.86 补 · P-15 引导链补上"官府压顶"分支（v68 规则：城内建筑 ≤ 官府等级）
- `patch_v8986_p17.py`（9KB）　— v89.86 整改 · P-17 离线推进上限
- `patch_v8986_p18.py`（15KB）　— v89.86 整改 · P-18 自动化预算闸门
- `patch_v8986_p1_texts.py`（13KB）　— v89.86 整改 · P1 文案与前置提示四项：
- `patch_v8986_p20.py`（10KB）　— v89.86 整改 · P-20 军务总览页
- `patch_v8986_p20_tests.py`（2KB）　— v89.86 · P-20 测试同步：军务总览（全境口径 + 五段结构）
- `patch_v8986_p21.py`（5KB）　— v89.86 整改 · P-21 门派任务连做（×10 / 一键做完）
- `patch_v8986_p23_train.py`（16KB）　— v89.86 整改 · P-23 兵力悬殊二次确认 + P-19 募兵上限归因 + P-05 人口占用说明
- `patch_v8986_p25.py`（7KB）　— v89.86 整改 · P0 竞态：P-25 行军抵达「军账守恒」
- `patch_v8986_questid_fix.py`（2KB）　— v89.86 顺手修复（真 bug · 存量数据）：随机任务 r07 / r09 的兵种 id 对不上
- `patch_v8986_sect_p1.py`（11KB）　— v89.86 · 门派 P1 · 六派被动加成实装（老板拍板；走既有消费链，不新增战斗公式）
- `patch_v8986_smoke.py`（17KB）　— v89.86 · smoke 增量：把整改清单 21 条 + 门派 P1 的**关键不变量**固化进回归网。
- `patch_v8986_smoke_fix2.py`（2KB）　— v89.86 · smoke 三处断言修复（以 .py 文件执行 —— heredoc 会改写反斜杠）
- `patch_v8986_smoke_stub.py`（2KB）　— v89.86 · smoke 环境：makeEl 补 querySelector/querySelectorAll（故事阅读器 sgRender 要读子元素）
- `patch_v8987_docs.py`（7KB）　— v89.87：文档同步（设计规范 §99 · 工作备忘 §107 · 需求档案 v89.87 段）
- `patch_v8987_e2e90.py`（4KB）　— v89.87：e2e §90 战场界面（真实 DOM：挂起→界面→指令→完成→自动→战果）
- `patch_v8987_p1.py`（13KB）　— v89.87 需求1：就地快购（组件 + 六接入点 + 种子开售/页签）—— SHOP_CATS 在 ui.js
- `patch_v8987_p3.py`（7KB）　— v89.87 需求3：战斗单目标攻击 + 30% 溢出溅射（老板拍板）
- `patch_v8987_p4a.py`（6KB）　— v89.87 需求4a：战斗引擎会话步进 API（机械重构，行为一致）
- `patch_v8987_p4b1.py`（12KB）　— v89.87 需求4b：战斗观战会话 —— battle.js 核心（挂起/推进/落账重放/恢复）
- `patch_v8987_p4b2.py`（5KB）　— v89.87 需求4b2：观战接入点 —— 设置项 / 初始 state / 主循环 / boot / 测试引导
- `patch_v8987_p4c1.py`（2KB）　— v89.87 需求4c-1：快照数据补全（towers / maxRounds / gapLast）
- `patch_v8987_p4c2.py`（15KB）　— v89.87 需求4c-2：战场观战界面（ui.js）——渲染 / 指令 / 动画 / 倒计时 / 结束面板
- `patch_v8987_p4c3.py`（5KB）　— v89.87 需求4c-3：接线（closeModal 拆装 / 军务征战中段 / main 动作分发 / onMarchArrive）
- `patch_v8987_p4c4.py`（4KB）　— v89.87 需求4c-4：战场界面 CSS + BUILD 版本升级（8985→8987）
- `patch_v8987_p4c5.py`（3KB）　— v89.87 需求4c-5：按项目 UI 规约修正 —— 色走变量 / 图标容器含 img / 下拉框实名在册
- `patch_v8987_p4c6.py`（3KB）　— v89.87 需求4c-6：audit 清零 —— data-side→data-bside（避保留名）/ pendingCount 接线
- `patch_v8987_p5_core.py`（19KB）　— v89.87 需求2：派兵统一走行军通道（data/battle/domain 核心）
- `patch_v8987_p5_core2.py`（10KB）　— v89.87 需求2：domain.js 三函数（承 p5_core：data/battle 已落盘）
- `patch_v8987_p5d.py`（8KB）　— v89.87 需求2：UI 接线（调兵/驻守面板加将领 · 采集改 dispatch）+ 白名单
- `patch_v8987_p5e1.py`（4KB）　— v89.87 需求2：smoke 三处断言更新（模态数 / 驻军走行军 / 上限断言补抵达）
- `patch_v8987_p5e2.py`（5KB）　— v89.87 需求2 收尾：出征面板过滤调派类（panel:false）+ e2e 采集段适配
- `patch_v8987_smoke87.py`（8KB）　— v89.87：smoke §87 固化断言（四需求）—— 插在结果输出前
- `patch_v8988_docs.py`（8KB）　— v89.88 文档同步：设计规范 §100 / 工作备忘 §108 / 需求档案 v89.88。
- `patch_v8988_e2e.py`（5KB）　— v89.88：e2e 增量 —— §91 大地图悬浮浮层（真实 DOM）。
- `patch_v8988_fort.py`（11KB）　— v89.88（老板需求 1~3）：野外城池（据点）改造 —— 等级分布 / 守军×10 / 满配。
- `patch_v8988_hover.py`（6KB）　— v89.88（老板需求 4）：大地图悬浮浮层 —— 地块「坐标 + 等级」。
- `patch_v8988_loot.py`（2KB）　— v89.88（老板需求 3「资源满配」）：battle.js 两处 ——
- `patch_v8988_smoke.py`（17KB）　— v89.88：smoke-test.js 更新 + 新增 §88 断言块。
- `patch_v8988_ui.py`（5KB）　— v89.88（老板需求 5）：界面打磨（审计先行 —— 只补真缺口）。
- `patch_v8989_a2.py`（9KB）
- `patch_v8989_a3a4.py`（9KB）
- `patch_v8989_b1d4.py`（10KB）
- `patch_v8989_c3.py`（8KB）
- `patch_v8989_c4e3.py`（10KB）
- `patch_v8989_docs.py`（9KB）　— v89.89 文档同步：设计规范 §101 · 工作备忘 §109 · 需求档案 v89.89 段
- `patch_v8989_e2e92.py`（7KB）　— v89.89 · e2e §92 段（真实 DOM：A2 归来报告 / B1 一键全领 / C4 故事集 / D4 战报筛选收藏 / E3 三段条）
- `patch_v8989_smoke89.py`（10KB）
- `patch_v898_code.py`（27KB）
- `patch_v898_tests.py`（13KB）
- `patch_v899.py`（8KB）　— patch_v899.py —— v89.9 接线：卷 02 装载 + 空态断言动态化 + e2e 新锚点用例
- `patch_v8991_docs.py`（4KB）　— ── ① 需求档案 v89.91 ──
- `patch_v8992_strat.py`（17KB）　— patch_v8992_strat.py — 由 play_gold_600x.js 生成 play_strat_600x.js（v89.92 多策略驾驶舱）
- `patch_v8994_a_data.py`（5KB）　— v89.94（B2 战斗三件套）Patch A —— 数据层：DATA.SIEGE / DATA.OPS / DATA.REPLAY。
- `patch_v8994_b_domain.py`（7KB）　— v89.94 Patch B —— js/domain.js：围攻守备值核心 + 战法唯一出口。
- `patch_v8994_c1_battle.py`（14KB）　— v89.94 Patch C1 —— js/battle.js：
- `patch_v8994_c2_battle.py`（8KB）　— v89.94 Patch C2 —— js/battle.js：回放关键帧 / 以少胜多 / 行军通道带 ops。
- `patch_v8994_d_ui.py`（19KB）　— v89.94 Patch D —— js/ui.js：
- `patch_v8994_e2_main.py`（6KB）　— v89.94 Patch E（补）—— js/main.js 四处改动（上一版脚本的写盘块被误删）。
- `patch_v8994_e_main.py`（8KB）　— v89.94 Patch E —— js/main.js：战法 chip / 撤退 / 回放控制 三个动作 + 确认闸改保守口径。
- `patch_v8994_g_smoke.py`（17KB）　— v89.94 Patch G —— smoke-test.js 第 97 节：B2 战斗三件套的验收断言。
- `patch_v8995_a_market.py`（10KB）　— v89.95 Patch A —— 经济：黄金兑换比递减（物多价贱）+ 通商券真通道。
- `patch_v8995_b2_speed.py`（5KB）　— v89.95 Patch B2 —— 速度受控成长：每 5 级 +1（自然成长）+ 自由点投放上限。
- `patch_v8995_b2b_speed.py`（3KB）　— v89.95 Patch B2b —— genAttrs（domain.js）与 addFreePoint（state.js）分开打。
- `patch_v8995_b_tactic.py`（8KB）　— v89.95 Patch B —— 战斗核心：取消溅射（一击一目标）+ 战场纵深/推进上限 + 速度受控成长。
- `patch_v8995_h2_rename.py`（2KB）　— v89.95 Patch H2 —— 稀缺资源改名：虎符 → **节钺**（虎符之名已被商城符类占用，实测撞名）。
- `patch_v8995_h_hufu.py`（12KB）　— v89.95 Patch H —— A1 虎符：黄金买不到的稀缺资源（发展限制器）。
- `patch_v8995_t2_smoke.py`（9KB）　— v89.95 Patch T2 —— 末条断言对齐 + 新增第 98 节（经济：虎符 / 折价 / 通商券）。
- `patch_v8995_t_smoke.py`（8KB）　— v89.95 Patch T —— smoke 断言对齐（去溅射 / 纵深 / 速度受控 / 伤害系数）。
- `patch_v8996_a_src.py`（19KB）　— patch_v8996_a_src.py — v89.96 伤害链源头标定（撤末端系数；幂等可复跑）
- `patch_v8996_b_sync.py`（10KB）　— patch_v8996_b_sync.py — v89.96 同步（UI 文案 / battle 注释 / smoke 断言；幂等可复跑）
- `patch_v8996_c_final.py`（6KB）　— patch_v8996_c_final.py — v89.96 定稿批（幂等可复跑）
- `patch_v8996_d_assert.py`（6KB）　— patch_v8996_d_assert.py — v89.96 断言同步（第三批；幂等可复跑）
- `patch_v8996_e_rounds.py`（3KB）　— patch_v8996_e_rounds.py — v89.96 回合上限断言定稿（幂等）
- `patch_v8998_rush.py`（33KB）
- `patch_v8999_a_pop.py`（15KB）　— v89.99-A 主补丁：人口经济四件套（幂等；锚点缺失即报错退出）
- `patch_v8999_b_smoke.py`（9KB）　— v89.99-B 冒烟第 99 节：人口经济四件套的验收断言（幂等）
- `patch_v8999_c_fix.py`（2KB）　— v89.99-C 三处登记修复（幂等）：
- `patch_v8999_d_rush.py`（15KB）　— v89.99-D 推演脑：阶段自适应 + 人口银行 + 增民令/税制策略（幂等）
- `patch_v8999_e_tune.py`（3KB）　— v89.99-E 脑校准（幂等）：保留线回落 / 增民令绝对门槛 / 税制阈值 / 放人节流
- `patch_v8999_f_tune2.py`（1KB）　— v89.99-F 脑校准（幂等）：体力药剂门槛 —— 围攻的燃料优先于金（条件驱动）
- `patch_v8999_g_tune3.py`（2KB）　— v89.99-G 脑校准（幂等）：体力药剂改"备弹制度" —— 围攻波次上限的最后一根钉子
- `patch_v8999_h_tune4.py`（3KB）　— v89.99-H 脑校准（幂等）：① 收割队随军力伸缩（否则门槛永远够不着）② 放人全城扫描
- `patch_v899_docs.py`（10KB）　— patch_v899_docs.py —— v89.9 文档补录：README 进度 / 项目地图 / 需求档案 / 设计规范 / 工作备忘
- `patch_v899b.py`（4KB）　— patch_v899b.py —— v89.9 接线修正：建筑逸闻块脱三元（无功能建筑漏入口）
- `patch_v89_1_css.py`（6KB）　— v89.1 CSS：index.html 追加 .sxf-* 剧本视觉化样式与两段动效（插入 </style> 前）。探针幂等。
- `patch_v89_1_data.py`（3KB）　— v89.1 数据：SCENE_FLOW 每活动加幕景水印 art、每幕加幕题 s（插入式；原文案零改动）。探针幂等。
- `patch_v89_1_docs.py`（7KB）　— v89.1 文档：设计规范 §31 · 备忘 §33 · 需求档案 v89.1 · 规划补记 · 设计文档 v1.3。探针幂等。
- `patch_v89_1_fix.py`（3KB）　— v89.1 修补：① e2e 两处「精力严格相等」断言改容差版（浮点再生脆弱点）
- `patch_v89_1_tests.py`（7KB）　— v89.1 测试：smoke §75（幕景/幕题/徽章/对白/样式）+ e2e 剧本视觉断言（横幅/时间线/结算卡）。探针幂等。
- `patch_v89_1_ui.py`（9KB）　— v89.1 UI：sceneFxHTML 视觉升级（幕景横幅 / 行程时间线 / 幕题条 / 对白高亮 / 倾向徽章 / 结算卡）。
- `patch_v89_2_css.py`（4KB）　— v89.2 CSS：场景画布 / 热点点选 / 时机条 / 选项图标 + sxfPing 脉冲。插入 </style> 前。探针幂等。
- `patch_v89_2_data.py`（9KB）　— v89.2 数据：① 12 活动各配一幅场景画（scene 字段）② 12 处关键幕改为「时机判定」（t2 + 三档结局）。
- `patch_v89_2_docs.py`（7KB）　— v89.2 文档：设计规范 §32 · 备忘 §34 · 需求档案 v89.2 · 规划二十·补记 · 设计文档 v1.4。探针幂等。
- `patch_v89_2_fix_trig.py`（2KB）　— v89.2 修复：古阵光圈的刻度用**预置单位圆表**，不调用 Math.sin/cos
- `patch_v89_2_scene.py`（29KB）　— v89.2 场景插画（map.js）：12 活动各一幅程序化风景画 + GAME.map.paintScene 出口。
- `patch_v89_2_tests.py`（11KB）　— v89.2 测试：① sxfTimingStop 防误触守卫 ② smoke §76（场景/时机/交互） ③ e2e 三处流程改「停手」+ 新断言。探针幂等。
- `patch_v89_2_ui.py`（15KB）　— v89.2 UI：sceneFxHTML 场景化改造 —— 场景画布 + 热点点选（spot）+ 时机条（timing）+ 选项图标。
- `patch_v89_3_copy.py`（10KB）　— v89.3 文案统一 · 灵物志 —— js/data.js
- `patch_v89_3_css.py`（1KB）　— v89.3 样式 —— index.html：.sxf-hero-alias（雅名金色小字）
- `patch_v89_3_docs.py`（7KB）　— v89.3 文档补丁 —— 五份文档追加（设计规范 §33 / 备忘 §35 / 规划二十一 / 档案 v89.3 / 设计文档 v1.5）
- `patch_v89_3_tests.py`（6KB）　— v89.3 测试 —— smoke-test.js §77 + e2e-test.js 横幅断言
- `patch_v89_3_ui.py`（1KB）　— v89.3 横幅接线 —— js/ui.js：雅名（alias）+ 门类章（cat 兜底 kind）
- `patch_v89_4_data.py`（2KB）　— v89.4 数据 —— js/data.js：DATA.JH_SPREAD（野地生态参数）
- `patch_v89_4_docs.py`（7KB）　— v89.4 文档补丁 —— 五份文档追加（设计规范 §34 / 备忘 §36 / 规划二十二 / 档案 v89.4 / 设计文档 v1.6）
- `patch_v89_4_state.py`（4KB）　— v89.4 引擎 —— js/state.js：
- `patch_v89_4_tests.py`（15KB）　— v89.4 测试 —— smoke（找格升级 + §78）+ e2e（找格升级 + 荒僻/有事格新块）
- `patch_v89_4_ui.py`（3KB）　— v89.4 UI —— js/ui.js：jianghuHTML 按 (x,y) 取分布 + 荒僻空态 + 等级收益行
- `patch_v89_5_data.py`（1KB）　— v89.5 数据补丁：DATA.JH_MARK（灵机之地阈值）
- `patch_v89_5_docs.py`（7KB）　— v89.5 文档补丁 —— 五份文档追加（设计规范 §35 / 备忘 §37 / 规划二十三 / 档案 v89.5 / 设计文档 v1.7）
- `patch_v89_5_map.py`（3KB）　— v89.5 地图补丁：drawJhPennant（江湖旗画笔）+ 野地信息层接线
- `patch_v89_5_state.py`（1KB）　— v89.5 引擎补丁：GAME.jianghuSpotInfo（灵机之地判定，唯一出口）
- `patch_v89_5_tests.py`（10KB）　— v89.5 测试补丁：smoke §79（灵机语义/阈值/记录式渲染/点选）+ e2e 19b（悬旗接线）
- `patch_v89_5_ui.py`（1KB）　— v89.5 UI 补丁：mapPickText 补江湖事后缀（有事报数/灵机加标/荒僻明示）
- `patch_v89_6_css.py`（4KB）　— v89.6 CSS 补丁：--wonder 语义色（四主题）+ 奇遇/见闻录样式
- `patch_v89_6_data.py`（21KB）　— v89.6 数据补丁：DATA.WONDER（奇遇配置）+ DATA.WONDERS（24 条奇遇剧本）
- `patch_v89_6_docs.py`（9KB）　— v89.6 文档补丁 —— 五份文档追加（设计规范 §36 / 备忘 §38 / 规划二十四 / 档案 v89.6 / 设计文档 v1.8）
- `patch_v89_6_flakefix.py`（5KB）　— v89.6 顺手修存量 flake：e2e「达标后无需手动刷新」（门禁环境 2/3 假红，两处合修）
- `patch_v89_6_main.py`（1KB）　— v89.6 main.js 补丁：do-wonder / open-journal / journal-go 接线
- `patch_v89_6_map.py`（3KB）　— v89.6 地图补丁：drawWonderStar（奇缘星）+ 渲染接线
- `patch_v89_6_state.py`（18KB）　— v89.6 引擎补丁：奇遇点位生成 / 线索 / 探奇三段 + 场景机共用（sceneBegin）
- `patch_v89_6_tests.py`（16KB）　— v89.6 测试补丁：smoke §80（奇遇册/点位/线索/探奇/图鉴/渲染）+ e2e 19c（全流程）
- `patch_v89_6_ui.py`（10KB）　— v89.6 UI 补丁：奇遇横幅/结算线索行/野地探奇入口/见闻录面板/探察提示
- `patch_v89_data.py`（17KB）　— v89 数据层：全屏江湖场景剧本 DATA.SCENE_FLOW（12 活动 · 对话/事件导向 · 专属退出）。探针幂等。
- `patch_v89_docs.py`（7KB）　— v89 文档：设计规范 §30 · 备忘 §32 · 需求档案 v89 · 规划补记 · 设计文档 v1.2。探针幂等。
- `patch_v89_e2e.py`（10KB）　— v89 e2e（e2e-test.js）：v88.1/v88 段剧本化改造 + v89 新段（君主专属 + 全屏交互）。探针幂等。
- `patch_v89_flow.py`（13KB）　— v89 流程引擎（state.js）：jianghuDo 拆 Check/Spend/Roll + sceneStart/Pick/Escape + mods 接线。探针幂等。
- `patch_v89_lord.py`（15KB）　— v89 君主专属收口：修炼线（装备/蕴养/游历）唯一闸门 GAME.canCultivate + 老档迁移。探针幂等。
- `patch_v89_main.py`（2KB）　— v89 事件（main.js）：sxf-choice / sxf-escape / sxf-exit 分发 + doScene 包装。探针幂等。
- `patch_v89_tests.py`（10KB）　— v89 测试（smoke-test.js）：§73 君主化（generals[0] -> 君主） + §74 新段（君主闸门 + 全屏剧本）。探针幂等。
- `patch_v89_ui.py`（9KB）　— v89 全屏场景 UI（ui.js）：活动按钮 → 全屏剧本 → 专属退出结算屏。探针幂等。
- `patch_v9080a_state.py`（5KB）　— v90.80 奇遇系统退役 · 脚本 A：js/state.js
- `patch_v9080b_data_map_main.py`（5KB）　— v90.80 奇遇系统退役 · 脚本 B：js/data.js + js/map.js + js/main.js
- `patch_v9080c_ui.py`（6KB）　— v90.80 奇遇系统退役 · 脚本 C：js/ui.js
- `patch_v9080d_html.py`（2KB）　— v90.80 奇遇系统退役 · 脚本 D：index.html（CSS 四族 + BUILD 9147→9158）
- `patch_v9080e_smoke.py`（6KB）　— v90.80 奇遇系统退役 · 脚本 E：smoke-test.js（§80 十一条 → 零残留守卫七条）
- `patch_v9080f_e2e.py`（3KB）　— v90.80 奇遇系统退役 · 脚本 F：e2e-test.js（19c 段退役 + OVER_CASES 去项）
- `patch_v9080g_tools.py`（3KB）　— v90.80 奇遇系统退役 · 脚本 G：四个审计工具同步
- `patch_v9080h_docs.py`（6KB）　— v90.80 奇遇系统退役 · 脚本 H：需求档案.md（总览行 + 明细段）+ 台账（回合节）
- `patch_v9081_planet.py`（10KB）
- `patch_v9087_audit_loadlist.py`（4KB）
- `patch_v9087_chains_arrive.py`（2KB）　— v90.87 复核：chains ③ 出征链改为走真实抵达出口 march.arrive。
- `patch_v9087_chains_sphere.py`（1KB）　— v90.87 复核：chains 工具补加载 sphere.js（v90.73 新增模块，工具未跟上）。
- `patch_v9087_chains_tick.py`（2KB）　— v90.87 复核：chains ③ 链抵达结算改走 march.tick（唯一推进出口 · 先出队再结算）。
- `patch_v9087_lifecycle_boostdrop.py`（5KB）
- `patch_v9087_lifecycle_forgelv.py`（4KB）
- `patch_v9087_lifecycle_loadlist.py`（3KB）
- `patch_v9094_archive.py`（20KB）　— P1：三份档案补录 v90.87 / v90.87b / v90.92 / v90.93 / v90.94 版本行（含详细章节）。
- `patch_v9094_docs.py`（6KB）　— v90.94：活文档同步 —— 发版脚本已从 .workbuddy/tmp/ 迁至 tools/patch/，文档必须跟上。
- `patch_v9094_e2elord.py`（3KB）　— v90.94：e2e 补一条「练功条在面板最下方 + 真点一步」真 DOM 用例（清单第 6 条）。
- `patch_v9094_fill.py`（4KB）　— v90.94：把门禁终跑数字回填档案与交付文档（并销掉两条已完成的挂账）。
- `patch_v9094_guards.py`（4KB）　— v90.94：版本守卫升级。
- `patch_v9094_lianTiao.py`（3KB）　— v90.94 补丁2：练功条从「右栏最下方」挪到「整个面板最下方（横贯）」
- `patch_v9094_lordbreak.py`（20KB）　— v90.94 批次D：练功移位 + 突破改爵位门槛
- `patch_v9094_verreg.py`（1KB）　— v90.94：把「版本与档案在册」一组守卫里的版本正则由 v89\\.\\d+ 放宽为 v\\d+\\.\\d+。
- `patch_v9094_wuguan.py`（2KB）
- `patch_v9095_prestige_rename.py`（7KB）
- `patch_v9096_sphere_factory.py`（2KB）　— v90.96：把 sphere.js 从**单例**改成**可多实例工厂 makeSphere()**。
- `patch_v9126_rename.py`（1KB）　— v91.26 旧词改名（A+B 组）：城池→城市 等。产品代码 + 测试同映射同改（不碰 docs/需求档案）。保 LF。
- `patch_v9129_bldg_rename.py`（1KB）　— v91.29 建筑改名（显示名）：补给站→传送站 · 车库→载具研究所 · 货仓→战储仓 ·
- `patch_water_fs.js`（5KB）　— 海面第二刀：细浪从"顶点位移"改到"像素级法线扰动"。
- `patch_water_vs.js`（4KB）　— 一次性补丁：把海面顶点着色器的"5 条正弦"换成"值噪声 fbm + 噪声域扭曲"。
- `precheck_v89223.py`（6KB）　— v89.223 锚点预检：所有补丁锚点逐条计数 + repr（逐字节）。
- `probe_v89223a_ab.py`（6KB）　— v89.223 探针 A：兵牌简称（ab）现状 + 产品侧旧词粗扫 + 工具目录计数。
- `probe_v89223b_ctx.py`（5KB）　— v89.223 探针 B：上下文取证 + 产品广扫 + 工具目录分类 + 版本线索。
- `probe_v89223c_final.py`（4KB）　— v89.223 探针 C：候选修改点完整原文 + smoke 守卫依赖 + 活工具明细。
- `probe_v89223d_mirror.py`（4KB）　— v89.223 探针 D：ab 镜像全量扫描 + 保留/修改判定所需的最后取证。
- `probe_v89224_cmp.js`（4KB）　— probe_v89224_cmp.js — 22-56-35 四象限 vs 现行/旧版地形 比色（v89.224）
- `probe_v89224_debug.js`（2KB）　— probe_v89224_debug.js — 复现 §191④(pB) 与 §220③c（借用 smoke 的桩头）
- `probe_v89224_final_match.js`（3KB）　— probe_v89224_final_match.js — 16 象限 × 全资产匹配（v89.224 · 终局判定）
- `probe_v89224_inv.py`（3KB）　— probe_v89224_inv.py — v89.224 术语/系统全量盘点（1-6 号任务取证）
- `probe_v89224_match.js`（4KB）　— probe_v89224_match.js — 结构对照：四象限 vs 现行/旧版地形贴图（v89.224）
- `probe_v89224_raw.js`（3KB）　— probe_v89224_raw.js — 量化 raw/ 与 atlas 素材（像素统计当眼睛 · v89.224）
- `probe_v89224_raw2.js`（2KB）　— probe_v89224_raw2.js — 四张 A_2x2 老图的四象限内容分析（v89.224）
- `probe_v89224_sib.js`（3KB）　— probe_v89224_sib.js — ui vs ui_normalized 对比 + 3 张兄弟图高保真（v89.224）
- `probe_v89224_style.js`（3KB）　— probe_v89224_style.js — 22-56-35 画风判定 + 高保真 ASCII（v89.224）
- `probe_v89225a_dot.py`（1KB）　— v89.225 探针 A：找"建筑前边的带颜色棋子"的真身
- `probe_v89225b_cell.py`（1KB）　— v89.225 探针 B：城视图建筑格渲染 + 族旗/色标消费点
- `probe_v89225c_series.py`（1KB）　— v89.225 探针 C：SERIES 定义 + ser- 类 CSS + forBuilding 渲染 + 旗/色标
- `probe_v89225d_buildings.py`（2KB）　— v89.225 探针 D：建筑 series 归属全表 + ser- 消费点 + 旗/图标素材现状
- `probe_v89225e_icons.js`（3KB）
- `probe_v89225f_ascii.js`（3KB）
- `probe_v89225g_bldngs.py`（1KB）　— v89.225 探针 G：建筑表全量 dump（多行条目）+ 酒馆/招募站/训练营/练兵场 定位
- `probe_v89225h_flagcensus.js`（3KB）　— 族旗色（DATA.SERIES[].flag，h/s/l）→ HSL 转 RGB
- `probe_v89225i_alpha.js`（3KB）　— 检查旗区域透明性：旗是不是画在透明底上（决定"去旗"是否安全）
- `probe_v89225j_alphamask.js`（1KB）
- `probe_v89225k_flagstat.js`（2KB）
- `probe_v89227a_groups.py`（3KB）　— v89.227 探针 A：城内族色精简 —— 分组依据取证。
- `probe_v89227b_func.py`（2KB）　— v89.227 探针 B：BLDG_FUNC（建筑功能按钮表）+ SERIES 消费行精确原文。
- `probe_v89227c_yizhan.py`（2KB）　— v89.227 探针 C：yizhan/fenghuotai/chengqiang 的操作面 + 其余按钮渲染路径。
- `probe_v89227d_mats.py`（2KB）　— v89.227 探针 D：批次二范围取证 —— 材料 24 名 + 系列 + use 文案 + 专名。
- `probe_v89227e2.py`（2KB）　— v89.227 探针 E2：DATA.MATERIALS 全量 + MAT_SERIES（修正数组配平）。
- `probe_v89227e_matfull.py`（2KB）　— v89.227 探针 E：DATA.MATERIALS 全量 + MAT_SERIES + use 文案 + 名将套/藏珍阁上下文。
- `probe_v89227f_sets.py`（2KB）　— v89.227 探针 F：DATA.SETS 全量 + 名将套所在段 + 材料 series.name 消费面。
- `probe_v89227g_terms.py`（1KB）　— v89.227 探针 G：百炼 / 藏珍阁 全量逐行（五文件）—— 分类：界面词 / 老板引述 / 历史注释 / 代码符号。
- `probe_v89227h.py`（4KB）　— v89.227 探针 H：tone 消费 + 离地逐族值 + 测试内材料/专名占用。
- `probe_v89227i.py`（2KB）　— v89.227 探针 I：藏珍阁导航标签 + 名将套测试占用 + 注释块原文。
- `probe_v89227j.py`（1KB）　— v89.227 探针 J：旧 key 残留面 + 八族/七族字样 + §225 段原文 + smoke 材料名行。
- `probe_v89229a_city.py`（1KB）　— v89.229 探针 A：城视图建筑格渲染现状（名称/等级位置 + 地块色）
- `probe_v89229b2.py`（3KB）　— v89.229 批 b 探针 2：icon/color 消费 + 残留词 + emoji
- `probe_v89229b_res.py`（3KB）　— v89.229 批 b 探针：① 旧脚本加失效注 ② 资源名/建筑名消费面全量
- `probe_v89229b_troops.py`（3KB）　— v89.229 探针 B：兵种体系全貌（18 现状 → 14 目标）
- `probe_v89229c2.py`（2KB）　— v89.229 批 c 侦察 2：troop 图标 / L57 / quest 引用 / smoke 段
- `probe_v89229c3.py`（2KB）　— v89.229 批 c 侦察 3：TR 表 / smoke 结构段 / smoke 引用分布
- `probe_v89229c4.py`（3KB）　— v89.229 批 c 侦察 4：持久容器形状（迁移面）
- `probe_v89229c_recon.py`（2KB）　— v89.229 批 c 侦察：doTrain / 兵种 id 引用 / forTroop / 持久结构 / 迁面
- `probe_v89229c_train.py`（2KB）　— v89.229 探针 C：训练/解锁链 + 兵种 UI + cat 消费面
- `probe_v89229d2.py`（2KB）　— v89.229 探针 D2：18 兵种 id 引用面（写盘版）
- `probe_v89229d_refs.py`（1KB）　— v89.229 探针 D：18 兵种 id 的引用面（迁移风险评估）
- `probe_v89229e_ui.py`（2KB）　— v89.229 探针 E：募兵 UI + 兵种标记消费面 + 资源/建筑
- `probe_v89229f_trainfilter.py`（3KB）　— v89.229 探针 F：_trainFilter/_trainTab 消费面 + canTrain/解锁链 + newGame 初始兵
- `rewrite_smoke_590.js`（7KB）　— v156.24：重写 §590 —— 口径从「13 州(state)」换成「地图省/市/区(_settle)」
- `samples_v89223.py`（3KB）　— v89.223 改前/改后对照样本 v2（换位链与守卫段引用已校正）。
- `scan_v89222_full.py`（2KB）　— v89.222 · 细扫：全量命中行原文 + 概念词/单字弓的现行口径
- `scan_v89222_sweep.py`（3KB）　— v89.222 · 全面反扫 v2：只做文本解析（不 import 补丁脚本！）
- `scan_v89222_terms.py`（2KB）　— v89.222 · 扫描器：用例文件（smoke/e2e）里三族旧词残留全量枚举
- `scan_v89222_verify.py`（1KB）　— v89.222 · 残留验证：旧词在用例文件里的最终分布（对照保留面）
- `scan_v89223_e2.py`（1KB）　— v89.223 E2 预扫：playtest 目录旧词明细（为显示词同步定范围）。
- `scan_v89223_verify.py`（3KB）　— v89.223 终态残留验证：产品侧（js/+index.html）旧词分布 = 预期保留面？
- `scan_v89228_docs.py`（4KB）　— v89.228 批次三：docs 全量映射命中扫描（只读，不改任何文件）。
- `split_ui.js`（10KB）　— ui.js 拆分 —— **纯搬运**：所有 `ui.xxx` 定义及其先后顺序一字不改，只是换文件。
- `tune_v89227_plot.py`（4KB）　— v89.227 色值调优：多候选批量评估。
- `v26-j.py`（14KB）　— v26 批九：smoke 第 39 节 —— v26 五项需求的防回退断言
- `v89116_sec96.js`（21KB）
- `v89117_sec97.js`（18KB）
- `v89118_sec98.js`（9KB）
- `v89119_sec100.js`（10KB）
- `v89120_sec101.js`（9KB）
- `v89142_a1_data.py`（3KB）　— v89.142 A1：data.js —— 城外地块 12×8（96 封顶）+ 网格常量
- `v89142_a2_domain.py`（4KB）　— v89.142 A2：domain.js —— extCap 注释/兜底 + 新增 extSlotOrder（中心扩散序，唯一出口）
- `v89142_a3_ui_ext.py`（4KB）　— v89.142 A3：ui.js —— 城外地块固定 12×8 棋盘 + 中心扩散落位 + 未解锁暗格
- `v89142_a6_smoke.py`（11KB）　— v89.142 A6：smoke-test.js —— 升级 12×9 旧断言到 12×8（含"末行居中"退役重写）
- `v89142_b1_ui_march.py`（18KB）　— v89.142 B1：ui.js —— 军务出征页目标 5 类分行 + 底部按钮；两战术页小页按钮移到底部
- `v89142_b2_main.py`（2KB）　— v89.142 B2：main.js —— 目标下拉落库（exp-act-pick）+ 进入军事行动读唯一出口
- `v89142_b3_tests.py`（4KB）　— v89.142 B3：smoke/e2e —— §114 目标入口断言升级（5 类分组）
- `v89142_c1_conscript.py`（10KB）　— v89.142 C1：data.js + battle.js —— 收编转兵 + 黄金支出（唯一出口三件套）
- `v89142_c2_ui.py`（6KB）　— v89.142 C2：ui.js + main.js + state.js —— 收编按钮/规则文案与守城文案
- `v89142_c3_smoke.py`（9KB）　— v89.142 C3：smoke-test.js —— 收编断言升级（§98 两条 + §99 两条）
- `v89142_c4_smoke2.py`（4KB）　— v89.142 C4：smoke-test.js —— 两条出口/规则行断言升级到 v89.142 口径
- `v89142_d1_fill_duel.py`（15KB）　— v89.142 D1：需求 6（全带→上限）+ 需求 7（斗将播报与 rec.sim 修复）
- `v89142_e1_smoke123.py`（10KB）　— v89.142 E1：smoke-test.js —— 新增 §123（本轮 7 条需求的门禁断言）
- `v89142_e2_archive.py`（7KB）　— v89.142 E2：需求档案追加 v89.142（总览行 + 逐轮明细）
- `v89142_e3_memory.py`（4KB）　— v89.142 E3：工作区记忆追加（append-only）
- `v89143_f1_bag.py`（10KB）　— v89.143 F1：ui.js —— 背包宝物各分类统一 7 列（.bag-grid）+ 删「全部」分类
- `v89143_f2_shop.py`（4KB）　— v89.143 F2：商城 4 行铺满（.ui-page.shop-page + .shop-rows.shop-fill）
- `v89143_f3_smoke.py`（6KB）　— v89.143 F3：smoke-test.js —— 5 条断言升级到 7 列 / 无「全部」/ 商城铺满
- `v89143_f4_e2e.py`（5KB）　— v89.143 F4：e2e-test.js —— 材料页分页（28/页）+ 宝物页按"实际类型"切分类（无「全部」）
- `v89144_a_ui.py`（21KB）　— v89.144 老板 4 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
- `v89144_b_main.py`（5KB）　— v89.144 老板 4 条 —— main.js 补丁（分段落盘 · 幂等守卫）
- `v89144_c_css.py`（3KB）　— v89.144 老板 4 条 —— index.html CSS 补丁
- `v89144_d1_smoke.py`（8KB）　— v89.144 —— smoke-test.js 断言升级（D1：5 条打穿面）
- `v89144_d2_smoke124.py`（9KB）　— v89.144 —— smoke-test.js 新增 §124 门禁节（老板 4 条各一条 + 档案在册）
- `v89144_e_e2e.py`（3KB）　— v89.144 —— e2e-test.js 断言升级
- `v89144_f_archive.py`（5KB）　— v89.144 —— 需求档案追加（总览行 + 逐轮明细）
- `v89145_a_ui.py`（4KB）　— v89.145 老板 2 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
- `v89145_b_css.py`（4KB）　— v89.145 老板 2 条 —— index.html CSS 补丁
- `v89145_c_smoke125.py`（6KB）　— v89.145 —— smoke-test.js 新增 §125 门禁节（老板 2 条）
- `v89145_d_archive.py`（5KB）　— v89.145 —— 需求档案追加（总览行 + 逐轮明细）
- `v89146_a_smoke.py`（4KB）　— v89.146 —— smoke：§125④ CSS 串更新 + 新增 §126（行高 = 按 4 行均分口径）
- `v89146_b_archive.py`（4KB）　— v89.146 —— 需求档案追加（总览行 + 逐轮明细：撑满口径修正）
- `v89147_a_ui.py`（9KB）　— v89.147 老板 3 条 —— ui.js 补丁（分段落盘 · 幂等守卫）
- `v89147_b_smoke.py`（6KB）　— v89.147 —— smoke：更新 §97⑤ 名字 + 新增 §127 门禁节
- `v89147_c_archive.py`（4KB）　— v89.147 —— 需求档案追加（总览行 + 逐轮明细）
- `v89148_a_store.py`（5KB）　— v89.148 需求 1 —— 城外资源建筑容量改口径：等同同级仓库容量的 1/6
- `v89148_b_css.py`（5KB）　— v89.148 需求 2/3 —— index.html CSS 补丁
- `v89148_c_smoke.py`（11KB）　— v89.148 —— smoke 断言升级（需求 2/3 的口径变化）
- `v89148_d_archive.py`（5KB）　— v89.148 —— 需求档案追加（总览行 + 逐轮明细）
- `v89149_a_data.py`（4KB）　— v89.149 批 A：data.js —— ① 兵种一字简称（ab）② 战斗声望规则表（REP_RULE）
- `v89149_b_domain.py`（3KB）　— v89.149 批 B：domain.js —— 兵种一字简称唯一出口 `GAME.troopAbOf`
- `v89149_c_battle.py`（8KB）　— v89.149 批 C：battle.js —— ① 战斗声望唯一出口（repGainOf / battleRepView / grantBattleRep）
- `v89149_d_state.py`（2KB）　— v89.149 批 D：state.js —— 守城落账段发声望（守方视角 · 读 atkLossBy）
- `v89149_e1_ui_side.py`（6KB）　— v89.149 批 E1：ui.js 战场侧栏 —— ① 兵种一字简称 ② 目标选项去"目标："前缀 + 默认"同兵种"
- `v89149_e2_ui_field.py`（10KB）　— v89.149 批 E2：ui.js 战场版面与读数 ——
- `v89149_e3_ui_sd.py`（6KB）　— v89.149 批 E3：把"间距"整套文案统一为「最近距离」（沙盘面板 + 回放帧 + 事件行）
- `v89149_e4_css.py`（5KB）　— v89.149 批 E4：index.html CSS —— ① 战场条填满 board 行（拉到回合记录上方）
- `v89149_f_default_tgt.py`（5KB）　— v89.149 批 F：默认目标 = 同兵种（引擎层，两侧同规）
- `v89149_g1_smoke.py`（6KB）　— v89.149 批 G1：升级 4 条被打穿的旧断言（都是口径升级，不是回归）
- `v89149_g2_smoke129.py`（14KB）　— v89.149 批 G2：smoke 新增 §129 门禁节（七条需求各一组 + 档案在册）
- `v89149_g3_e2e.py`（5KB）　— v89.149 批 G3：e2e 真 DOM 补断言（每回合可重设 · 一字简称 · 同兵种默认 · 去前缀 ·
- `v89149_h_archive.py`（7KB）　— v89.149 批 H：需求档案追加（总览行 + 逐轮明细）
- `v89150_a1_html.py`（10KB）　— v89.150（老板 2）：整体等比例缩放 —— index.html（容器 + CSS 全量改固定像素）
- `v89150_a2_main.py`（4KB）　— v89.150（老板 2）：fitAppSize 改为「固定画布 + 等比缩放」—— main.js
- `v89150_a3_ui.py`（11KB）　— v89.150（老板 2）：ui.js —— 浮层挂载唯一出口 + 坐标换算 + 画布尺寸出口
- `v89150_a4_map.py`（3KB）　— v89.150（老板 2）：map.pick 的坐标换算 —— 整体缩放后 rect 是视觉坐标，要还原成布局坐标
- `v89150_b1_smoke.py`（9KB）　— v89.150（老板 2）：smoke 旧口径断言升级 —— vw/vh → 画布单位、fixed → absolute、pick 换算
- `v89150_b2_smoke.py`（3KB）　— v89.150（老板 2）：smoke 收尾 —— tip-layer 距离放宽 + §120① 改缩放口径
- `v89150_c1_troopshape.py`（6KB）　— v89.150（老板 1）：兵牌外框按兵种三档（步/骑/器械）+ 战场背景稍淡
- `v89150_d1_report.py`（12KB）　— v89.150（老板 3）：战报正文三块（战斗总结 / 战斗收获 / 兵种损耗）——
- `v89150_d2_retire.py`（5KB）　— v89.150（老板 3）：回放动作 case 退役（main.js）+ 回放/纪要 CSS 退役 + 三块新样式（index.html）
- `v89150_d3_smoke.py`（5KB）　— v89.150（老板 3）：smoke 旧断言升级 —— 正文三块口径 + 回放 UI 退役
- `v89150_d4_smoke.py`（6KB）　— v89.150（老板 3）：smoke 收尾 4 条 —— 回放退役后的判据调整
- `v89150_e1_fix.py`（6KB）　— v89.150（老板 3）收尾：reportSectOf 事件白名单 / _repId 初始化回归 / smoke 三条判据
- `v89150_f1_battle.py`（8KB）　— v89.150（老板 4/5/6）：战场铺满（modal-max + 侧栏定宽）/ 战斗待指挥清单 / 关闭回大界面
- `v89150_g1_cols130.py`（15KB）　— v89.150：列宽断言升级（3 条）+ §130 门禁节（本轮 6 条需求 + 档案）
- `v89150_h1_fix.py`（5KB）　— v89.150 收尾：战斗清单目标名解析 + 收获拆行改「括号感知」
- `v89150_i1_e2e.py`（5KB）　— v89.150：e2e 升级 —— 战报正文三块 + 抵达弹清单（点观战才进战场）
- `v89150_j1_archive.py`（7KB）　— v89.150 需求档案追加（总览行 + 明细段）
- `v89151_a_data.py`（3KB）　— v89.151 批 A：data.js 三处（声望封顶 500 / 逐回合关键帧 / 缩放限幅配置）
- `v89151_b_tactic.py`（3KB）　— v89.151 批 B：tactic.js —— snapUnits 的 cp() 补全引擎消费字段（血 NaN 根因）
- `v89151_c_battle.py`（2KB）　— v89.151 批 C：battle.js —— unitFinalOf 字段兜底 + totalDef（悬停"全军防御"）
- `v89151_d1_ui_tip.py`（8KB）　— v89.151 批 D1：ui.js —— 克制反查出口 + btUnitTip 重写为富浮层 + 兵牌/侧栏接入
- `v89151_d2_ui_bar.py`（7KB）　— v89.151 批 D2：ui.js —— 距离读数 / 底栏指挥战斗 / 野地面板按钮
- `v89151_e_main.py`（3KB）　— v89.151 批 E：main.js —— battle-list-open case / 主循环闪烁 / 缩放限幅
- `v89151_f_css.py`（8KB）　— v89.151 批 F：index.html —— 底栏按钮 / 侧栏版式 / 操作按钮规格 / 浮层克制色
- `v89151_g1_smoke.py`（6KB）　— v89.151 批 G1：smoke 五处断言升级（悬停富浮层 / 采集按钮 / 声望封顶 / 简称同宽 / 距离读数）
- `v89151_g2_e2e.py`（3KB）　— v89.151 批 G2：e2e 三处断言升级（采集按钮 / 悬停富浮层 / 距离读数）
- `v89151_g3_smoke131.py`（11KB）　— v89.151 批 G3：smoke 新增 §131 门禁节（本轮 8 条 + 3 条旧账）
- `v89151_h_archive.py`（7KB）　— v89.151 批 H：需求档案 + 交付文档
- `v89173a_items.py`（18KB）　— v89.173a · 经验道具：撤等级限制（capLv 退役）+ 固定整数面额
- `v89173c_tests.py`（24KB）　— v89.173c · 测试与档案：smoke/e2e 断言随口径升级 + 需求档案在册
- `v89173d_smoke_fix.py`（5KB）　— v89.173d · 修 smoke 六处：v83 惩罚旧数值断言随 decay 0.8 升级 + 出口断言改 three-points + §173⑤c 收窄
- `v89174a_core.py`（14KB）　— v89.174a · 建造读秒与弹窗（老板 2 的症状）+ 「在建队列」段（老板 1）—— 主逻辑
- `v89174b_tests.py`（16KB）　— v89174b · 测试与档案：v89.174 断言（读秒 ceil / 弹窗 live / 在建队列 / 脏标记）+ 需求档案
- `v89175a_smart.py`（11KB）　— v89175a · 智能战术升级（数据+战斗层）：策略库 + 开战赛马 + 每回合调整明细
- `v89175b_ui_tests.py`（22KB）　— v89175b · 智能战术升级（界面+测试+档案）
- `v89176a_engine.py`（9KB）　— v89.176 补丁 A：引擎层 —— ① SMART_PLAN 扩展（阵型模式库 + 撤退线）
- `v89176b_smart.py`（14KB）　— v89.176 补丁 B：战斗层 —— smartStanceOf 加阵型模式 / smartApply 传 mode
- `v89176c_ui.py`（17KB）　— v89.176 补丁 C：界面层 —— ① 战场/沙盘三线+标尺抽共享出口（统一化）
- `v89176d_tests.py`（12KB）　— v89.176 补丁 D：测试断言 —— smoke §176（14 条）+ e2e §176（3 条）
- `v89176e_arcfix.py`（6KB）　— v89.176 档案修复：截断被污染的 v89.176 明细段，重写正确内容
- `v89176f_e2efix.py`（1KB）　— v89.176 修复：e2e §176 段搬到 main 作用域（§175 段之后）——原位置 G 未定义
- `v89176g_numfix.py`（2KB）　— v89.176 档案数字同步：预测对账最终口径（81.7% / 62.5%）
- `v89177a_core.py`（15KB）　— v89.177 补丁 A：引擎层 —— ① 民心公式（HEARTS 表 + 出口组 + tick 改造）
- `v89177b_ui.py`（8KB）　— v89.177 补丁 B：界面层 —— ① 官府弹窗「民心/民怨」段 + 两措施按钮
- `v89177c_fix.py`（1KB）　— v89.177 修复：① 两处 guanfuBox 拼接插 heartsBox177（施工态 + 正常态互斥）
- `v89177d_tests.py`（3KB）　— v89.177 补丁 C：断言升级 —— ① v89.65 突破断言（加"综合考验"闸：先拒后过）
- `v89177e_asserts.py`（9KB）　— v89.177 补丁 E：断言 —— smoke §177（12 条）+ e2e §177（2 条）
- `v89177f_arc.py`（6KB）　— v89.177 档案：总览行（插 v89.176 后）+ 明细段（文末追加）
- `v89177g_e2efix.py`（1KB）　— v89.177 修复：e2e §177 段从顶层（ABORTED 前）移到 §176 段之后（main 作用域）
- `v89178a_counter.py`（6KB）　— v89.178 补丁 A：克制系数全表降档（data.js）
- `v89178b_ui.py`（4KB）　— v89.178 补丁 B：出征界面预估区文案精简（ui.js）
- `v89178c_smoke.py`（11KB）　— v89.178 补丁 C：smoke 断言升级（6 处口径变更）+ 新增 §178 段
- `v89178d_arc.py`（5KB）　— v89.178 补丁 D：需求档案（总览行 + 明细段）
- `v89179a_remove.py`（20KB）　— v89.179a —— 克制系统全撤（老板：「得了，不算了，取消所有克制关系，
- `v89179b_tests.py`（24KB）　— v89.179b —— 测试升级：克制全撤后的断言口径（smoke 多处升级 + §179 新段 + e2e 文案）
- `v89179c_arc.py`（4KB）　— v89179c —— 需求档案补录：v89.179（总览行 + 明细段）
- `v89180a_mech.py`（8KB）　— v89.180a 补丁：拆械特性（data.js 标签+字段 / tactic.js fireOnce / battle.js 评分器 / ui.js 两处展示）
- `v89180b_kite.py`（5KB）　— v89180b 补丁：风筝（kite）—— 智能战斗 v3 的"远程保持距离"（老板 3/4）
- `v89180c_tests.py`（8KB）　— v89180c 补丁：测试断言 —— smoke §180（拆械 + 风筝）+ e2e §180（真 DOM：床弩卡 + live 滚动）
- `v89180d_arc.py`（7KB）　— v89180d 补丁：需求档案 —— v89.180 总览行 + 明细段
- `v89181a_hubao.py`（4KB）　— v89181a 补丁：虎豹骑"稍微加强"（hp 4800→5400 / def 250→280）+ 表头注释 + perHp 注释修正
- `v89181b_tests.py`（3KB）　— v89181b 补丁：smoke §181（虎豹新值 / 两向胜 / 血量护栏哨兵 / 档案）
- `v89181c_arc.py`（8KB）　— v89181c 补丁：档案 —— 修正 v89.180 三处"平手"错账 + 追加 v89.181 行与段
- `v89184a_sta.py`（7KB）　— v89184a —— 方案A 落地：体力→生命曲线改「分段」（前段双曲 + 后段线性续增）
- `v89184c_boostasserts.py`（5KB）　— v89184c —— 升级两条「训练提速」旧断言到 v89.179 BOOST_CAP 新口径。
- `v89184d_arc.py`（9KB）　— v89184d —— 需求档案补录：v89.182 / v89.183 / v89.184（三行总览 + 三段明细）。
- `v89185a_reqlog.py`（4KB）　— v89.185（老板第 0 条）：记录本轮 7 条新增需求入需求档案（先登记，交付后更新状态）。
- `v89185b_data.py`（6KB）　— v89.185 批次1 · data.js —— 六维不封口曲线表 + 守将体系表 + 衰减表。
- `v89185c_domain.py`（16KB）　— v89.185 批次1 · domain.js —— 不封口曲线 / 衰减-2 / 守将成型 / 民心人口。
- `v89185d_statemap.py`（5KB）　— v89.185 批次1 · state.js + map.js —— 人口有效上限接线 / 守将成型接线。
- `v89185e_uisys.py`（3KB）　— v89.185 批次1 · ui.js + systems.js —— 人口有效上限显示接线。
- `v89185f_smoke.py`（12KB）　— v89.185 批次1 · smoke-test.js —— 15 条口径断言升级（曲线不封口 / 衰减-2 / 人口有效上限 / 守将体系）。
- `v89185g_retreat.py`（3KB）　— v89.185b · battle.js —— 修复：主动撤退（智能保兵 v89.176 / 手动）与沙盘重跑不同源。
- `v89185h_fold.py`（6KB）　— v89.185 · 守将折损旋钮：DATA.GUARD_FOLD（wild/fort 折半；npcCityGuard 不折保持既有平衡）。
- `v89185i_weak.py`（3KB）　— v89.185 · 第7条：智能目标规则库 +`weak`（击其脆弱）——探针实测 infHeavy 我损 -16%。
- `v89185j_asserts.py`（10KB）　— v89.185 · 新增 §185 断言段（smoke + e2e）——六维不封口 / 守将体系 / 衰减-2 / 民心人口 / weak / 撤退沙盘同源。
- `v89185k_arc.py`（7KB）　— v89.185 · 需求档案：追加 v89.185 总览行（v89.184 行后）+ 明细段（文件尾）。幂等。
- `v89185m_mem.py`（3KB）　— v89.185 · 工作记忆追加。
- `v89222_arc.txt`（4KB）
- `v89222_mem.txt`（2KB）
- `v89222_sec_smoke.txt`（4KB）　— §222-guard
- `v89222_skill132.txt`（4KB）　— # §132. 用例层「历史标题/引述」批清理的定式 + 两条硬纪律（v89.222）
- `v89223_mem.txt`（3KB）　— # v89.223 · 兵牌简称（ab）换代 + 产品侧旧词收尾
- `v89223_sec_smoke.txt`（4KB）　— §223-guard
- `v89223_skill133.txt`（2KB）　— # §133. 兵牌简称（ab）换代 + 「全仓旧词收尾」的三层边界（v89.223）
- `v89225_sec_smoke.txt`（4KB）
- `v89228_sec_smoke.txt`（6KB）

## play/（生命周期与复现）

**不在 gate 三件套内，按需手动跑**。`lifecycle_v89121.js` = 全玩法链路体检（渠道 / 锻造 / 宝物等分组核验，交付文档的复现命令指向它 → **视同在岗**）；`repro_v89174*` = 三条一次性复现。

- `lifecycle_v89121.js`（37KB）

## playtest/（长时压测（一次性 · 已退役 · 保留备查））

v89.x 时代的 600×/1× 长时压测与收益分析（`play_600x.js` 等，单次几分钟到几十分钟）。结论已沉淀进交付文档；**不复用为口径**，新压测请基于 `probe/` 的在岗模板重写。

本区 1 件：**在岗 0 件 · 一次性 1 件**（后者标 `〔一次性 · 已退役（保留备查）〕`）。

- `analyze_600.py`（12KB）　〔一次性 · 已退役（保留备查）〕　— analyze_600.py — 600× 全量推演数据分析器。

## probe/（探针（几何 / 界面 / 存档））

jsdom 没有布局引擎 → 尺寸/重叠/溢出/折行只能在**真浏览器**量。`probe60_geom.js` 是可复用模板，`probe66_ui.js` 有"逐行折行"量法，`probe67_save3.js` 量存档体积与配额。**其余带版本号的（`probe_v89101_explore.js` 等）= 一次性探针**，判据见 `is_one_off()`：名字里带版本号就是"一轮用完即退役"。

- `probe.js`（1KB）
- `probe60_geom.js`（5KB）　— v60 真实浏览器几何探针：老板的硬规矩（弹窗不许出现滚动条、内容不许溢出）
- `probe61_board.js`（5KB）　— v61 几何探针：**攻占后城格数按等级变小**（6×4 / 8×4 / 8×5）
- `probe62_geom.js`（3KB）
- `probe63_geom.js`（7KB）
- `probe64_geom.js`（6KB）
- `probe65_geom.js`（9KB）
- `probe66_sta.js`（6KB）
- `probe66_ui.js`（9KB）
- `probe67_after.js`（4KB）
- `probe67_cols.js`（4KB）
- `probe67_save.js`（5KB）
- `probe67_save2.js`（6KB）
- `probe67_save3.js`（5KB）
- `probe67_save_ui.js`（3KB）
- `probe67_tbl.js`（3KB）

## prof/（未归类）

待归类：请确认用途后归档。

- `analyze_ui.js`（5KB）　— ui.js 结构分析：为拆分定边界（只读，不改文件）
- `audit_arch.js`（5KB）　— 架构体检：一次性量化「清爽度」的五个维度，输出可核对的数据。
- `find_shared_vars.js`（3KB）　— 找出「跨功能的顶层局部变量」—— 拆分后它们会变成未定义。
- `gen_head_prof.js`（3KB）　— 性能探针：把 smoke-test.js 截成"前 N 段"并在 newGame/ensure 上装计时钩子，
- `smoke_slice.js`（14KB）　— smoke 快切片 —— 支持两种用法：
- `snapshot_ui_fns.js`（5KB）　— ui 函数快照：把 js/ui*.js 里每个 `ui.xxx = …` 定义的源码切片并哈希，
- `top_cpu.js`（2KB）　— 读 .cpuprofile，按"自身耗时(self time)"排出前 N 个函数。

## show/（展示与校准）

给老板看的对照图 / 曲线校准 / 素材巡视。

- `audit_v149_player.js`（5KB）　— v149 玩家视角视觉巡检：从"第一次打开"走到"打完一场远征"，逐屏截图
- `bake_bigmap.js`（4KB）　— 大地图烘焙 + 改前基线实机图
- `bigmap_rollback.py`（3KB）　— 大地图 LOD 改动一键回滚（干跑先行 · 本项目铁律）。
- `calib_actor_fit.js`（4KB）　— 资产尺寸标定：渲染 → 读像素 → 反推"模型在世界里有多高" → 给出"缩到 1 单位"的系数
- `compare34.js`（9KB）　— v34 风格对比：同一批元素，四种画风 —— 现状(西方奇幻金属) / 中国色木刻 / MingCute / IconPark
- `dbg_v89191_autotrain.js`（5KB）　— v89.191 实机取证（真浏览器 · 真点真填）：
- `deep_soak_v9137.js`（12KB）
- `diag_height.js`（3KB）
- `diag_tex.js`（2KB）
- `diag_v15616_lastobj.js`（3KB）　— v156.16 诊断③：**抓"最后一个开始渲染的对象"** —— 报错就是它（或紧跟它的那个）
- `diag_v15616_rendererr.js`（5KB）　— v156.16 诊断：地图 3D 每帧抛 "Cannot read properties of undefined (reading 'x')"
- `diag_v15616_scan.js`（3KB）　— v156.16 诊断②：把 scene 里**所有** material.uniforms 扫一遍，找出 value 为 null/undefined 的项
- `diag_v89132_grid.js`（2KB）　— 诊断：军务处两营 grid 列宽为何不等（1098 vs 272）
- `diag_v89132_reddot.js`（3KB）　— 诊断：满界面缩略图上我城红点为什么读不到（v89132）
- `diag_v89133_probe.js`（4KB）　— v89.133 取证：将领面板行（老板点名三处）+ 军务页现状
- `diag_v89135_march.js`（3KB）　— 诊断：军务全页签现状 dump（找"军务处没改完"的真身）
- `diag_v89135b_btns.js`（6KB）　— 诊断 v2：军务处三个按钮真点验证（治疗伤兵 / 收编为民 / 释放）
- `diag_v89202_scout.js`（8KB）　— v89.202 诊断：侦查报告「可下拉」现状量测
- `diag_v89203_occupy.js`（8KB）　— v89.203 诊断：① 防守默认阵位（sieging 守方）② 占领名城全流程 ③ 城池一览 DOM
- `diag_v89213_pager.js`（5KB）　— v89.213 诊断：底栏分页条三栏布局 → 与左右相邻菜单（bb-tools / 缩略图）重叠实况
- `make_v89121_flag_matrix.py`（3KB）　— v89121 · 七族旗色对照图（回答"图标上的旗是什么"）
- `measure_v89139_arrow.js`（2KB）　— v89.139 箭头对照量测（单场景）：视野移到地图角落 → 数边缘环带暖黄像素
- `measure_v89139_before.js`（8KB）　— v89.139 实机量测（改前基线）：大屏留白 / 战场侧栏 / 缩略图红点 / 地图箭头
- `measure_v89188_gen.js`（7KB）　— v89.188 实机量测（真浏览器 · 只读量测，不改产品）：
- `measure_v89190_btns.js`（6KB）　— v89.190 实机量测（真浏览器 · 只读量测，不改产品）：
- `measure_v89191_btns.js`（3KB）　— v89.191 实机量测（真浏览器）：解雇/晋升 两按钮的几何 —— 老板「稍微错开，上下不重叠，等下点错了」
- `measure_v89192_panes.js`（6KB）　— v89.192 量测：沙盘弹窗 vs 战场界面（铺满参考）· 含极端载荷（8 兵种）
- `probe_actor_look.js`（4KB）　— 单角色渲染体检：把 Soldier / RobotExpressive 各自单独摆到原点，
- `probe_adm_marker.js`（3KB）　— 占领省府后，地图上那一格"长什么样"：等真实渲染循环重建标记后再读，
- `probe_admin_reveal.js`（7KB）　— 省/市/区首府 → 下辖地视野：完整验收 + 同机位前后对照图
- `probe_anim_scale.js`（3KB）
- `probe_axis_equiv.js`（5KB）　— 验证：seatProp 的「setFromUnitVectors + rotateY」与 surfaceQuad 是否数学等价。
- `probe_bind_order.js`（2KB）　— 绑定顺序实验：normalize:false 载入后，手动给根节点做旋转/缩放（**不重绑**），
- `probe_bone_move.js`（2KB）
- `probe_bonenames.js`（1KB）
- `probe_box_cmp.js`（2KB）
- `probe_castle_ci.js`（3KB）　— 决定性探针：拿 ci → 现算 dir/pos/quat，与实例矩阵里的值逐一比对
- `probe_castle_quat.js`（3KB）　— 数值探针：逐实例打印 局部+Y vs 径向 的点积、以及原始矩阵元素
- `probe_castle_side.js`（5KB）　— 城堡朝向「侧视图」诊断：把实例的几何+矩阵搬到独立场景，
- `probe_compose.js`（2KB）　— 在页面里原样复现那 5 行摆放代码，看是哪一步把朝向算歪
- `probe_conquer_state.js`（3KB）　— 真实占领链路：直接调 GAME.onConquer 占领某州首府，检查
- `probe_duel3d.js`（3KB）　— 3D 斗将舞台独立验证：建一个 520×268 的容器直接 mount，等角色加载后连拍三帧
- `probe_duel3d2.js`（3KB）　— 3D 斗将舞台独立验证 v2：清场后单独拍舞台 + 打印角色包围盒（判断比例/朝向/贴地）
- `probe_galaxy.js`（1KB）
- `probe_load.js`（1KB）
- `probe_matrix_writers.js`（2KB）　— 抓现行：给 InstancedMesh.setMatrixAt 装钩子，记录所有写入者的调用栈
- `probe_meta.js`（1KB）
- `probe_scale_tracks.js`（1KB）
- `probe_soldier_rot.js`（3KB）　— 定点实验：把 Soldier 用 4 个固定根旋转各渲染一张，肉眼判定"哪个朝向是站着的"。
- `probe_stand_candidates.js`（3KB）　— 立姿候选体检：不归一化加载，逐候选根旋转报告「骨骼 Y 跨度 / Box3 Y 跨度 / 骨骼数」，
- `probe_state_reveal.js`（5KB）　— 州辖地视野：同机位「点亮前 / 点亮后」对照出图 + 数值验收
- `probe_v9124_build.js`（3KB）　— v91.24 探针2：端到端筑城坐标链（不在原格 & 球面/平面往返一致性）
- `probe_v9124_coord.js`（3KB）　— v91.24 探针：球面 cell 的 (x,y) ↔ ci 往返稳定性（筑城坐标飞走根因）
- `probe_v9124_fix.js`（2KB）　— v91.24 探针3：验证修法方向 —— 拾取 x,y 换成「北在上」后地形是否对上
- `probe_water2.js`（2KB）
- `probe_water_ab.js`（3KB）　— 水面 A/B：同一机位，uAmp=3.2（现状）与 uAmp=0（关浪）各拍一张，
- `probe_water_fps.js`（3KB）　— 水面着色器性能：在"看得见海"的视角下统计 90 帧的平均帧时间
- `probe_water_state.js`（2KB）
- `render3d.js`（8KB）　— 真·3D 地形渲染（用游戏地图的真实地形数据）
- `render3d_full.js`（9KB）　— 全量 500×500 真·3D 地形渲染（每格细分 2×2 = 1000×1000 面片）
- `review_guide.py`（4KB）　— v89.42 定稿验收图：改前/改后 + 2x 放大 + 7 块贴图 + 中文说明，合成单图。
- `review_guide_b.py`（5KB）　— v89.42b 验收指南：v89.42a(推翻) vs v89.42b(重做) + 2x 放大 + 7 块新贴图，合成单图。
- `sample_height.js`（7KB）　— 地形高度风格小样对比（离线渲染）
- `scan6.js`（4KB）
- `shot_ab.js`（2KB）
- `shot_bigmap_lod.js`（3KB）　— 大地图 LOD 远景层 —— 实机对照（默认关 / 开启）
- `shot_castle_look.js`（3KB）　— 城堡朝向实拍：对准一座己方城，围绕它转三个角度拍特写（修复前后对比用）
- `shot_castle_look2.js`（3KB）　— 城堡朝向实拍 v2：从"实际渲染出来的实例"里挑一座（必然不过雾），
- `shot_castle_orient.js`（4KB）　— 城堡朝向诊断：把镜头怼到一座城上拍特写 + 数值核对"基座是否 ⟂ 半径"
- `shot_compare.py`（7KB）　— v89.42 前后对比：逐格"两翼"采样（避开等级角标/名称条）→ 报告 + 拼图。
- `shot_height.js`（2KB）　— 主地图 · 高度模式实机截图
- `shot_lord_globe.js`（2KB）　— 前传：君主站在球面的姿态核对（applyQuad 重构后）
- `shot_map3d.js`（2KB）
- `shot_ocean.js`（3KB）　— 海面观感探针 v2：对准大片水域，按 3 档距离（轨道 / 中景 / 近景）各拍一张，
- `shot_scene3d_player.js`（2KB）　— 采集场景玩家（Soldier）外观核对：进入 scene3d 的野外场景，截一张
- `shot_v145_colony.js`（4KB）　— v145 实机：空间站 + 星际投送面板（选母舰 / 选星球 / 带人带兵 / 启航）
- `shot_v146_fleet.js`（4KB）　— v146 实机：空间站「深空远征」面板（选舰 / 选目标 / 编成 / 出港 / 战报）
- `shot_v147_preview.js`（2KB）　— v147 实机：建造预览（D 期）—— 候选卡片「先看看」→ 3D 单栋预览
- `shot_v15615_mapbar.js`（8KB）　— v156.15 实机：地图手势条（⚔️出征 / 🔍侦查 / 📜详情）
- `shot_v89102_sandbox.js`（7KB）
- `shot_v89102b_rankcap.js`（4KB）
- `shot_v89103.js`（9KB）
- `shot_v89103b_field.js`（8KB）
- `shot_v89104_views.js`（5KB）
- `shot_v89105_ui.js`（4KB）
- `shot_v89106_bldg.js`（6KB）
- `shot_v89107_beacon.js`（6KB）
- `shot_v89107_doc.js`（7KB）
- `shot_v89108_cap_inn.js`（7KB）
- `shot_v89109_def.js`（7KB）
- `shot_v89110_danger.js`（10KB）
- `shot_v89111_inv.js`（6KB）
- `shot_v89112_modals.js`（6KB）
- `shot_v89113_mayor_inv.js`（7KB）
- `shot_v89114.js`（12KB）
- `shot_v89115.js`（9KB）
- `shot_v89116.js`（14KB）
- `shot_v89117.js`（14KB）
- `shot_v89118.js`（6KB）
- `shot_v89119.js`（11KB）　— v89.150（老板 3）：⛔ 本脚本验的「回合纪要里的反击同段」随**回合纪要板块整条退役** ——
- `shot_v89120.js`（13KB）
- `shot_v89121_shop.js`（3KB）
- `shot_v89122_invasion.js`（4KB）
- `shot_v89123_rate.js`（4KB）
- `shot_v89124_pop.js`（4KB）
- `shot_v89125_migration.js`（4KB）
- `shot_v89126_three.js`（8KB）
- `shot_v89128_final.js`（3KB）　— v89.128 实机图：① 自动化面板（新增自动采集/收获）② 营造总览（新时长：官府 11→12 = 18h）
- `shot_v89128_leftbar.js`（4KB）　— v89.128 需求 7/8 实机图：左栏统计（幸存者行/按钮统一/野地行/幸存者道具弹窗）+ 对齐复验
- `shot_v89128_wall.js`（4KB）　— v89.128 需求 6 实机图：围墙环城结构（未建不画 / 修上画环 / 点环城开面板）
- `shot_v89129_three.js`（7KB）　— v89.129 实机图（三个场景）：
- `shot_v89131_pane.js`（9KB）　— v89.131 实机脚本：将领档案版面（自带判定）+ 截图
- `shot_v89132_three.js`（13KB）　— v89.132 实机脚本：军务处 / 缩略地图 / 节钺开拓（自带判定 + 截图）
- `shot_v89133_march_pane.js`（13KB）　— v89.133 实机脚本：军务重构一（出征/出征战术/防守战术/练兵场）+ 将领面板三行
- `shot_v89134_tables.js`（5KB）　— v89.134 实机脚本：数据表梳理后的「游戏照常」验证（长跑 + 截图 + 量测）
- `shot_v89135_wide.js`（12KB）　— v89.135 实机脚本：11 条需求的可见面验证（自带判定 + 截图）
- `shot_v89136_wide.js`（15KB）　— v89.136 实机脚本：四条需求的可见面验证（自带判定 + 截图）
- `shot_v89137_guanfu.js`（3KB）　— v89.137 官府面板：改前/改后对照 + 按钮规格量测
- `shot_v89137_wide.js`（15KB）　— v89.137 实机脚本：七条需求的可见面验证（自带判定 + 截图）
- `shot_v89138_wide.js`（14KB）　— v89.138 实机脚本：六条需求的可见面验证（自带判定 + 截图）
- `shot_v89139_wide.js`（14KB）　— v89.139 实机验证（真浏览器）：大屏铺满 · 地图无箭头 · 战场 2 列 · 采集静默 ·
- `shot_v89140_wide.js`（15KB）　— v89.140 实机验证：战场两行制 / 军务兵种表 / 练兵场关菜单 / 铁匠铺双按钮 / 商城固定
- `shot_v89141_wide.js`（13KB）　— v89.141 实机验证（真浏览器）：城外 12 列 / 108 封顶 / 宝物右键批量 / 记录框上限 / 露天容量
- `shot_v89142a_ext.js`（8KB）　— v89.142 实机验证（真浏览器）：城外地块 12×8（96）+ 中心扩散 + 暗格 + 铺满率对照
- `shot_v89142b_ui.js`（9KB）　— v89.142 实机验证（真浏览器）：需求 2/3/4 军务界面 + 需求 6 上限填入 + 需求 7 斗将播报
- `shot_v89142c_duel.js`（5KB）　— v89.142 实机验证（真浏览器）：需求 7 —— 战前斗将在回合战况播报
- `shot_v89143_bag_shop.js`（8KB）　— v89.143 实机验证（真浏览器）：背包宝物各分类统一 7 列 + 无「全部」；商城 4 行铺满
- `shot_v89144a_march.js`（14KB）　— v89.144 实机验证 A（真浏览器）：需求 2/3/4 —— 军务三处
- `shot_v89144b_duel.js`（5KB）　— v89.144 实机验证 B（真浏览器）：斗将播报 —— ⛔ **v89.148 改口径**：
- `shot_v89145_scroll.js`（12KB）　— v89.145 + v89.146 实机验证 C（真浏览器 + 真布局）：老板 2 条 ——
- `shot_v89147_bagfilters.js`（6KB）　— v89.147 实机验证（真浏览器 + 真布局）：老板 3 条 ——
- `shot_v89148_bt.js`（8KB）　— v89.148 实机验证（真浏览器 + 真布局）：老板 3 条 ——
- `shot_v89149_battle.js`（12KB）　— v89.149 实机验收（真浏览器 · 1680×1000）—— 老板 7 条：
- `shot_v89150a_scale.js`（11KB）　— v89.150 实机验证 A（真浏览器）：老板 2 —— **整幅画面等比例整体缩放
- `shot_v89150b_troopfield.js`（8KB）　— v89.150 实机验证 B（真浏览器）：老板 1 / 4 / 6 ——
- `shot_v89150c_report.js`（8KB）　— v89.150 实机验证 C（真浏览器）：老板 3 / 5 ——
- `shot_v89151a_battle.js`（11KB）　— v89.151 实机验证 A（真浏览器）：底栏两按钮 + 指挥战斗闪烁 + 悬停富浮层 + 侧栏版式 + 距离读数
- `shot_v89151b_wild.js`（8KB）　— v89.151 实机验证 B（真浏览器）：野地面板按钮（采集文案/等长/规格）+ 建筑弹窗按钮 + 缩放限幅
- `shot_v89152_jewels.js`（6KB）　— v89.152 实机验证（真浏览器）：未占野地产出行 4 行 / 无备注行 / 三键落底 · 已占无产出。
- `shot_v89153_doc.js`（8KB）　— v89.153 实机验证：公文系统页（三源合一 + 小标签 + 主题色）+ 采集收获明细 toast
- `shot_v89154_wild.js`（9KB）　— v89.154 实机验证（真浏览器）：
- `shot_v89155_five.js`（10KB）　— v89.155 实机验证（真浏览器）：
- `shot_v89156a_wilds.js`（5KB）
- `shot_v89156b_exp.js`（10KB）
- `shot_v89157_five.js`（13KB）　— v89.157 实机：① 公文系统页（徽章+铺满）② 将领条单行 ③ 围墙门槛 ④ 逐回合弹窗 ⑤ 地块 4×3
- `shot_v89158_hover.js`（7KB）　— v89.158 实机验证：悬停保护（真浏览器 · 真悬停 3 秒不被打断）+ 容量分账渲染
- `shot_v89159_three.js`（9KB）　— v89.159 实机验证（真浏览器）：
- `shot_v89160_two.js`（7KB）　— v89.160 实机验证（真浏览器）：
- `shot_v89161_gold.js`（8KB）　— v89.161 实机验证（真浏览器）：
- `shot_v89162_mayor.js`（9KB）　— v89.162 实机验证（真浏览器）：
- `shot_v89163_two.js`（9KB）　— v89.163 实机验证（真浏览器）：
- `shot_v89164_smart.js`（7KB）　— v89.164 实机验证（真浏览器）：
- `shot_v89165_live.js`（8KB）　— v89.165 实机验证（真浏览器 · 老板场景直接复现）：
- `shot_v89166_enter.js`（7KB）　— v89.166 实机验证（真浏览器）：
- `shot_v89167_percity.js`（7KB）　— v89.167 实机验证（真浏览器）：
- `shot_v89169_wall.js`（5KB）　— v89.169 实机验证（真浏览器）：围墙 0 级虚影环
- `shot_v89171_items.js`（6KB）　— v89.171 实机验证（真浏览器）：经验道具「前期化」三段态
- `shot_v89173_items.js`（7KB）　— v89.173 实机验证（真浏览器）：经验道具「撤等级限制 + 固定面额」
- `shot_v89174_queue.js`（6KB）　— v89.174 实机验证（真浏览器）：
- `shot_v89175_smart.js`（6KB）　— v89.175 实机验证（真浏览器 · 真开战）：智能战斗每回合可见
- `shot_v89176_gates.js`（7KB）　— v89.176 实机验证（真浏览器）：
- `shot_v89177_hearts.js`（5KB）　— v89.177 实机验证（真浏览器）：
- `shot_v89178_counter.js`（7KB）　— v89.178 实机验证（真浏览器）：
- `shot_v89179_hover.js`（7KB）　— v89.179 实机验证（真浏览器）：「克制全撤」后的战场兵牌悬停
- `shot_v89180_part.js`（6KB）　— v89.180 实机验证（真浏览器）：
- `shot_v89181_hubao.js`（5KB）　— v89.181 实机验证（真浏览器）：
- `shot_v89185_gates.js`（7KB）　— v89.185 实机验证（真浏览器）：
- `shot_v89186_gates.js`（12KB）　— v89.186 实机验证（真浏览器）：
- `shot_v89187_gates.js`（8KB）　— v89.187 实机验证（真浏览器）：
- `shot_v89188_gates.js`（10KB）　— v89.188 实机验证（真浏览器 · 只读量测 + 真点）：
- `shot_v89189_gates.js`（7KB）　— v89.189 实机验证（真浏览器）：
- `shot_v89190_gates.js`（10KB）　— v89.190 实机验证（真浏览器 + 截图）：
- `shot_v89191_gates.js`（9KB）　— v89.191 实机验证（真浏览器 · 真点真填）：
- `shot_v89192_gates.js`（10KB）　— v89.192 实机验证：① 回本城按钮 ② 观战补历史 ③ 沙盘显示复核 ④ 射程修复回放
- `shot_v89193_gates.js`（9KB）
- `shot_v89194_gates.js`（9KB）　— v89.194 实机验收：前哨雷达圈 / 藏珍阁 / 将领详情三处
- `shot_v89195_gates.js`（8KB）　— v89.195 实机验收：① 总览（13 前哨满页 + 档位一览表 · 不溢出）② 行内放手 → 确认窗
- `shot_v89196_gates.js`（11KB）　— v89.196 实机验收：
- `shot_v89197_gates.js`（7KB）　— v89.197 实机验收：
- `shot_v89198_gates.js`（5KB）　— v89.198 实机验收：① 出征面板（战法全撤 + 备注四项） ② 管理弹窗（统一行）
- `shot_v89199_gates.js`（7KB）　— v89.199 实机验收：
- `shot_v89200_gates.js`（9KB）　— v89.200 实机验收：出征布局三改（几何量测）+ 围攻行下线 + 睡眠自动打（拨钟）
- `shot_v89201_gates.js`（10KB）　— v89.201 实机验收：① 侦查单页（四板块 over=0）② 多选打造（真点两卡一次打造）
- `shot_v89202_gates.js`（13KB）　— v89.202 实机验收：① 蕴养同款（网格卡/筛选/底键真点）② 侦查可下拉（常规零滚动 + 极端可滚）
- `shot_v89203_gates.js`（8KB）　— v89.203 实机验收：① toast 中上（弹窗内不挡底键 / 无弹窗回底部 · 几何真量）
- `shot_v89204_gates.js`（9KB）　— v89.204 实机验收：① 强化面板分页条（页码居中 · 几何真量）② 强化卡面（成本悬停 · 无 .ec-cost · 高 84）
- `shot_v89205_gates.js`（7KB）　— v89.205 实机验收：将领面板挂件行退役 + 卸下迁入选择窗
- `shot_v89207_gates.js`（10KB）　— v89.207 实机验收：快赢五条 + 离线纪要 + 沙盘推演链路
- `shot_v89209_gates.js`（8KB）　— v89.209 实机验收：存档缺陷链修复（真浏览器 + 真 UI 链路）
- `shot_v89210_gates.js`（10KB）　— v89.210 实机验收：键盘流 · 状态条 · 战前推演（真浏览器 + 真 UI 链路）
- `shot_v89210_night.js`（4KB）　— v89.210 实机验收 · 睡眠补偿等价验证（真浏览器 · 拨钟法）
- `shot_v89211_gates.js`（9KB）　— v89.211 实机验收：强化显示链 · 占城空格补齐 · 器械工位归一（真浏览器 + 真 UI 链路）
- `shot_v89212_gates.js`（7KB）　— v89.212 实机验收：城外堆场按资源分账（资源悬停 / 仓库面板 / 城外面板）+ 出征行序（真 DOM）
- `shot_v89213_gates.js`（10KB）　— v89.213 实机验收：分页条「整体居中」（底栏 + 弹窗两条路）
- `shot_v89213_pre.js`（2KB）　— v89.213 改前图（换备份法专用）：同一场景截三张（底栏商场 / 弹窗 / 满页）
- `shot_v89214_gates.js`（10KB）　— v89.214 实机验收：装备悬停「分行 + 三色」+ 世界观换皮（废土 · 余烬纪元）
- `shot_v89214_skin.js`（2KB）　— v89.214 换皮实机图（第二组）：军务·出征（兵种） / 威望（爵位阶梯） / 城池（建筑）
- `shot_v89215_gates.js`（8KB）　— v89.215 实机验收：侧栏驻军栏 —— 去下拉 · 全兵种固定序 · 暂无记 0
- `shot_v89216_gates.js`（5KB）　— v89.216 实机验收：① 分页条「页码文本严格居中」（v89.213 挂账 36px 归零）
- `shot_v89218_gates.js`（7KB）　— v89.217/v89.218 实机验收：
- `shot_v89219_gates.js`（7KB）　— v89.219 实机验收：机构词（缩略图/岁贡/城档）+ 悬停白值=原始值 + 整套键
- `shot_v89220_gates.js`（6KB）　— v89.220 实机验收：① 基因实验室（面板+政务厅按钮）② 本境调运「不设上限」
- `shot_v89221_gates.js`（8KB）　— v89.221 实机验收：① 创建界面 chip 标签=新区名 ② 任务页签 .fresh 闪烁（两帧对照）
- `shot_v89223_ab.js`（5KB）　— v89.223 实机验证：兵牌简称换代（真浏览器读 .bt-rnm 全量简称）
- `shot_v89225_city.js`（4KB）　— v89.225 实机探针：城视图现状（建筑旗渲染 + 地块底色）
- `shot_v89225_series.js`（5KB）　— v89.225 实机验证：城内地块按"族"染色（8 族实测色值）+ 无旗
- `shot_v89227_family.js`（6KB）　— v89.227 实机验证：城内地块 4 族降饱和（官府/民生/军事/城务）+ 实测渲染色
- `shot_v89228_rename.js`（5KB）　— v89.228 实机验证：黄金→旧币 · 人口→幸存者 · 装备名录换代（真浏览器）
- `shot_v89229_family.js`（7KB）　— v89.229 实机验证：城视图 —— 地块统一浅废土底 · 名称/等级都在格顶 · 名称文字色块承载族色
- `shot_v89229c_troops.js`（11KB）　— v89.229c 实机验证：兵种重构（14 兵种 · 三组分页）· 资源四类 · 据点守军非空
- `shot_v89231_tech.js`（7KB）　— v89.231 实机验证：科技体系调整（24 项术语换代 · 5 组分节渲染 · 引用链文案）
- `shot_v89233_four.js`（5KB）　— v89.233 实机验证：① 货币「旧币」显示（商城/侧栏）② 任务页新文风（86 条）
- `shot_v89235_gov.js`（7KB）　— v89.235 实机验证：① 政务厅格等级角标位置（与普通格子同构 · 都在格顶名称行内）
- `shot_v89238_doll.js`（4KB）　— v89.238 实机脚本：英雄页 people 部件栏（doll）人形图与背景亮度 —— 改前/改后对照
- `shot_v89239_after.js`（2KB）　— v89.239 定档后实机图（读【真文件】CSS · 无注入）——与 v89238 对照图同机位同局
- `shot_v89240_after.js`（2KB）　— v89.239 定档后实机图（读【真文件】CSS · 无注入）——与 v89238 对照图同机位同局
- `shot_v9080_wonderless.js`（4KB）　— v90.80 实机验证：奇遇系统退役后的真实渲染（真浏览器）
- `sweep_v89239_bright.js`（4KB）　— v89.239 亮度对比 v2（干净版）：全量覆盖 opacity+filter，各档稳定 700ms；
- `sweep_v89240_bright.js`（4KB）　— v89.240 三档调亮扫描：当前 .80+b1.15（live）之上再探 6 档
- `three3d.js`（8KB）　— Three.js 真 3D 地形原型（用游戏真实地形数据）
- `tile_show.js`（3KB）　— v35-f：批量拼图（可复用）—— 传 id:中文列表，输出总览图
- `tune_actor_fit.js`（3KB）　— 端到端标定：直接调 GAME.gltf.FIT[asset].scale 的候选值，
- `verify_v9069_buildcity.js`（4KB）　— v90.69 实机验收：3D 星球主地图 + 附属平地「建城」按钮（需求 1/2）+ 球面地形口径。
- `verify_v9097.js`（7KB）　— v90.97 实机验收：行政菜单 + 君主收窄 + 英雄仅本城 + 双球面切图（读真文件 · 无注入）
- `verify_v9098_zoom.js`（4KB）　— v90.98 实机验收：地图视野缩放条（底栏右侧 · 仅地图视图）
- `verify_v9099.js`（5KB）　— v90.99 实机验收：① 别星地图 回主城/回本城/灰烬城 断开  ② 每颗星球独立的省市区
- `verify_v9100_modal.js`（4KB）　— v91.00 实机验收：① 否决性弹窗变小（xs）② 点弹窗外关闭 ③ noClose 窗不关
- `verify_v9100_sphereci.js`（2KB）　— v90.100 球系化 实机验收：地图/城池面板无运行时错误 + 球系往返自洽
- `verify_v9101_feel.js`（3KB）　— v91.01 实机验收：按压反馈统一（:active 下压/轻缩）—— 匹配风格 · 改善交互
- `verify_v9102_hero.js`（4KB）　— v91.02 实机验收：① 英雄页仅本城 ② grantBeauty 归属城修复 ③ 政务厅含本城英雄列表
- `verify_v9104_admcat.js`（3KB）　— v91.04 实机验收：行政右栏改「分类清单 + 选中列表」（参考募兵界面）
- `verify_v9105_flags.js`（2KB）　— v91.05 实机验收：地图上为己方据点/野地插小旗
- `verify_v9124_repro.js`（4KB）　— v91.24 复现：行政菜单 + 英雄派遣（城池面板→派遣→出征界面）崩溃
- `verify_v9130_body.js`（2KB）
- `verify_v9130_wonder.js`（2KB）
- `verify_v9134.js`（5KB）　— v91.34 验收：侧栏（城名行按钮/驻军缩写+渐变条）+ 奇观倒计时 + 奇观贴地
- `verify_v9135.js`（4KB）　— v91.35 验收：分帧预建（遮罩 + 各步耗时）+ 平原建城修复
- `verify_v9172.js`（11KB）　— v91.72 实机验收：B 期蓝图 + 本批 UI/系统改动
- `verify_v9174_globalworld.js`（4KB）　— v91.74 实机验证：世界数据归一 —— 切星球后背景星球的队列/产出是否继续推进

## show/reports/（未归类）

待归类：请确认用途后归档。

- `deep_soak.json`（6KB）
- `全面评测-20261016.md`（5KB）　— 全面评测报告 · 《我在废土有座城》v91.37（2026-10-16）

## sim/（未归类）

待归类：请确认用途后归档。

- `sim-run.js`（8KB）　— 长跑探针：跑 N 个游戏月，看这个废土是不是"活"的。

---

**跑测试**：`node audit.js` · `node smoke-test.js` · `NODE_PATH='…\node\workspace\node_modules' node e2e-test.js`

**跑工具**（路径含子目录）：`node .workbuddy/tools/gen/gen_bitmaps.js`（.js 用 node、.py 用 python）。

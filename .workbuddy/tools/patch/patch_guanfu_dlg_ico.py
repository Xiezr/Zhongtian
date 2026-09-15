# -*- coding: utf-8 -*-
"""v72 · 修：官府（及城外建筑）「升级中」弹窗被 1024px 位图撑爆（老板：
"官府在升级过程中点击时，界面内容很大，出现下拉框和左右拉框"）

根因链（已用真浏览器复现并实测，脚本见会话目录 _shot_guanfu_up.js）：
  · v63 图标同步把两处「升级中」弹窗的图标换成 GAME.icons.forBuilding() 位图；
  · span 上只有 `font-size:40px`（对 emoji 有效、对 <img> 无效）；
  · 位图 <img class="ico"> 没有任何容器尺寸规则（全站 .ico 尺寸都靠
    `.tile-art .ico` / `.ticon .ico` 这类容器选择器）→ 回退**固有尺寸 1024px**；
  · 弹窗 660×620 的内容实测变 1036×1349 —— `.inner-panel{overflow-y:auto}`
    单轴 auto 使另一轴也 auto → **上下 + 左右滚动条同时出现**（dx=388 dy=741）。

修法：两处「升级中」弹窗的图标收进新尺寸盒 `.dlg-ico`（容器负责尺寸，1em=40px；
与 .tile-art/.ticon 同口径 —— 项目自己的教训"图标容器一律用 .ico 类选择器写尺寸"）。

改动：
  ① js/ui.js · 城内「升级中」弹窗：图标 span 加 class="dlg-ico" + 补 emoji 兜底
  ② js/ui.js · 城外「升级中」弹窗：同上
  ③ index.html · 新增 .dlg-ico 规则（含根因注释）
  ④ smoke-test.js · 结构守卫：两处弹窗必须用 .dlg-ico 且 CSS 有 1em 尺寸盒
  ⑤ e2e-test.js · 升级中面板必须带尺寸盒（真实 DOM 断言）

幂等 + 锚点唯一校验 + 落盘核验。
"""
import io, sys

UI    = r'E:\Deepseekdb\js\ui.js'
HTML  = r'E:\Deepseekdb\index.html'
SMOKE = r'E:\Deepseekdb\smoke-test.js'
E2E   = r'E:\Deepseekdb\e2e-test.js'

n_ok = 0
def patch(path, old, new, tag):
    global n_ok
    t = io.open(path, encoding='utf-8', newline='').read()
    if new in t:
        print('  · %s：已改过（跳过）' % tag)
        return
    c = t.count(old)
    if c != 1:
        print('  ✗ %s：锚点命中 %d 次（要求恰 1 次），拒绝写盘' % (tag, c))
        sys.exit(1)
    t = t.replace(old, new, 1)
    io.open(path, 'w', encoding='utf-8', newline='').write(t)
    print('  ✓ %s' % tag)
    n_ok += 1

# ① 城内「升级中」弹窗
patch(UI,
"""      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' +
          GAME.icons.forBuilding(isUpgrade ? cell.build.id : cell.pending.buildId) + '</span></div>' +""",
"""      /* v72（老板报障）：「官府升级中点击 → 界面内容很大，出现下拉框和左右拉框」——
         图标收进尺寸盒 .dlg-ico：位图 <img class="ico"> 没有容器尺寸规则时按**固有尺寸
         1024px** 渲染，把弹窗（660×620）撑成 1036×1349，上下 + 左右滚动条同时出现。
         位图 / 矢量 / emoji 三种回退都收进盒内（.dlg-ico .ico { 1em }）。 */
      var icB = GAME.icons.forBuilding(isUpgrade ? cell.build.id : cell.pending.buildId)
        || (isUpgrade ? (DATA.BUILDINGS[cell.build.id] || {}).icon : (pb2 || {}).icon) || '';
      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span class="dlg-ico" style="font-size:40px;">' +
          icB + '</span></div>' +""",
'① 城内升级中弹窗（.dlg-ico + emoji 兜底）')

# ② 城外「升级中」弹窗
patch(UI,
"""      ui.openModal(
        '<div style="text-align:center;margin-bottom:8px;"><span style="font-size:40px;">' +
          (GAME.icons.forExt(e.type) || (DATA.EXT_BUILDINGS[e.type] || {}).icon) + '</span></div>' +""",
"""      ui.openModal(
        /* v72（老板报障）：同城内「升级中」—— 图标收进尺寸盒 .dlg-ico（位图防 1024px 固有尺寸撑爆） */
        '<div style="text-align:center;margin-bottom:8px;"><span class="dlg-ico" style="font-size:40px;">' +
          (GAME.icons.forExt(e.type) || (DATA.EXT_BUILDINGS[e.type] || {}).icon) + '</span></div>' +""",
'② 城外升级中弹窗（.dlg-ico）')

# ③ index.html CSS
patch(HTML,
"""  /* 弹窗内表格统一外框（避免贴边） */
  .m-body .tbl { margin-top: 4px; }""",
"""  /* 弹窗内表格统一外框（避免贴边） */
  .m-body .tbl { margin-top: 4px; }
  /* 弹窗身份图标尺寸盒（v72 · 老板报障「官府升级中点击 → 内容很大、下拉+左右拉框」）：
     位图 <img class="ico"> 缺容器尺寸规则时按**固有尺寸 1024px** 渲染，把弹窗撑爆。
     口径与 .tile-art/.ticon 一致：容器负责尺寸：1em 跟随 span 的内联图标字号（"仅剩图标"的裸像素用法，见 smoke 审计）。 */
  .dlg-ico { display: inline-block; line-height: 1; }
  .dlg-ico .ico { width: 1em; height: 1em; display: inline-block; vertical-align: middle; }""",
'③ CSS .dlg-ico 尺寸盒')

# ④ smoke 结构守卫（安在 v63 图标守卫之后）
patch(SMOKE,
"""  check('结构：图标有固定高度（位图/矢量两条路径才不会把卡片撑成高低不一）',
    /height: 84px/.test(cssBlock(hS, '.troop-card.bldg-pick .ticon')));""",
"""  check('结构：图标有固定高度（位图/矢量两条路径才不会把卡片撑成高低不一）',
    /height: 84px/.test(cssBlock(hS, '.troop-card.bldg-pick .ticon')));
  /* v72（老板报障）：两处「升级中」弹窗的图标必须收进 .dlg-ico 尺寸盒 ——
     位图缺容器规则会按固有尺寸 1024px 把弹窗撑出上下+左右滚动条（几何实测 1036×1349）。 */
  check('v72：升级中弹窗图标有尺寸盒（.dlg-ico，位图不再按 1024px 固有尺寸撑爆弹窗）', (function () {
    return (uS.match(/class="dlg-ico"/g) || []).length >= 2
      && /class="dlg-ico" style="font-size:40px;"/.test(uS)
      && /width: 1em/.test(cssBlock(hS, '.dlg-ico .ico'))
      && /height: 1em/.test(cssBlock(hS, '.dlg-ico .ico'));
  })());""",
'④ smoke 结构守卫')

# ⑤ e2e 升级中面板断言
patch(E2E,
"""    check('升级中面板可取消升级', !!document.querySelector('#modal-root [data-action="cancel-build"]'));""",
"""    check('升级中面板可取消升级', !!document.querySelector('#modal-root [data-action="cancel-build"]'));
    /* v72（老板报障「官府升级中点击被撑爆」）：图标必须带尺寸盒（.dlg-ico .ico）——
       1024px 位图溢出在 jsdom 量不出，靠这条钉结构 + 真浏览器几何脚本兜底。 */
    check('v72：升级中面板图标有尺寸盒（.dlg-ico .ico）',
      !!document.querySelector('#modal-root .dlg-ico .ico'));""",
'⑤ e2e 尺寸盒断言')

print()
print('✓ 补丁完成：%d 处改动落盘' % n_ok)

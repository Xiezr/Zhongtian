# -*- coding: utf-8 -*-
"""v90.96：把 sphere.js 从**单例**改成**可多实例工厂 makeSphere()**。
#3（城市/地图解耦）需要两份球面：GAME.sphere（逻辑）+ GAME.mapSphere（地图）。
机械改动：把 IIFE 体包进 function makeSphere(){ var SP = {}; ... return SP; }，
导出 GAME.createSphere + GAME.sphere（默认实例）。全部可变态随实例走（每份独立）。
"""
import io, re
f = 'js/sphere.js'
s = io.open(f, encoding='utf-8').read()

old_head = """(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  var SP = GAME.sphere = {};
"""
new_head = """(function () {
  'use strict';
  var GAME = window.GAME = window.GAME || {};
  /* ============================================================
   * v90.96（老板 · 城市/地图解耦）：**可多实例工厂** —— 同一份拓扑/地形代码可造**多颗球面**：
   *   · GAME.sphere     = **逻辑球面**（当前"经营城"所在星球）—— 城市/建造/科技/募兵/距离 读它；
   *   · GAME.mapSphere  = **地图球面**（地图正在看的星球）—— map3d 渲染/拾取/出征选址 读它。
   * 两者**各带全套可变态**（PLANET / _seedOverride / _seaCache / _built* / _grid / _xyCi / _dArr…），
   * 故切地图星球不碰逻辑球面（城市界面保持）。纯函数（h3/n3/fbm3/icoSpheres…）各实例各一份，无副作用。
   * ============================================================ */
  function makeSphere() {
    var SP = {};
"""
if old_head not in s:
    raise SystemExit('HEAD 不匹配')
s = s.replace(old_head, new_head, 1)

old_tail = "\n})();\n"
if not s.rstrip().endswith('})();'):
    raise SystemExit('TAIL 不匹配（结尾不是 })();）')
# 结尾：把最后的 })(); 换成 return + 导出
idx = s.rstrip().rfind('})();')
s = s[:idx] + "    return SP;\n  }\n\n  GAME.createSphere = makeSphere;\n  GAME.sphere = makeSphere();   /* 逻辑球面默认实例（地图球面由启动/切换时创建）*/\n})();\n"

io.open(f, 'w', encoding='utf-8', newline='\n').write(s)
print("patched sphere.js")

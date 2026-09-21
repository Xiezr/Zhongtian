# -*- coding: utf-8 -*-
"""v89.42 补丁 2/2：smoke-test.js —— v67 地形位图护栏改写为新不变量
旧：地形位图一张都不剩 / 12 个 key 都无素材（v67 决定）
新：① 七张 256×256 贴图就位 ② 七张两两不同 ③ 城池/据点 5 key 仍无素材
    ④ 登记表同步（BITMAPS.fileOf）⑤ 逐格镜像变体存在且轴对齐 ⑥ 平地卫兵下移
"""
import io, os, sys, subprocess

R = r'E:\Deepseekdb'
T = R + r'\smoke-test.js'


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


OLD = r"""  check('不变量：地形位图一张都不剩（地形全走程序化绘制，不留一半贴图一半手绘）', (function () {
    var ui = path.join(__dirname, 'assets', 'icons', 'ui');
    var left = fs.readdirSync(ui).filter(function (f) { return f.indexOf('ai_terrain_') === 0; });
    return left.length === 0;
  })());
  check('已按决定删除：地图/城池那 12 个 key 都没有素材文件',
    ['terrain_plain', 'terrain_caoyuan', 'terrain_zhaoze', 'terrain_lake', 'terrain_forest',
      'terrain_desert', 'terrain_hill', 'fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));"""

NEW = r"""  /* ⚠️ v89.42（老板）：从即梦三图（老三国像素风）裁切七地形贴图，野地 UI 重回位图质感。
     v67 的"一张都不剩"不变量随新决定退役，改护**新不变量**：
     ① 七张地形贴图在（256×256 方形 PNG）；② 城池 / 据点 5 个 key 仍无素材（保持绘图）。 */
  var TERRAIN_7 = ['plain', 'caoyuan', 'zhaoze', 'lake', 'forest', 'desert', 'hill'];
  function terrainTexPath(t) { return path.join(__dirname, 'assets', 'icons', 'ui', 'ai_terrain_' + t + '.png'); }
  check('v89.42：七张地形贴图就位（256×256 PNG —— 即梦像素风裁切成果）', (function () {
    return TERRAIN_7.every(function (t) {
      var p = terrainTexPath(t);
      if (!fs.existsSync(p)) return false;
      var b = fs.readFileSync(p);
      if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return false;    /* PNG 魔数 */
      return b.readUInt32BE(16) === 256 && b.readUInt32BE(20) === 256;        /* IHDR 宽高 */
    });
  })(), (function () {
    var n = 0;
    TERRAIN_7.forEach(function (t) { if (fs.existsSync(terrainTexPath(t))) n++; });
    return n + '/7 张';
  })());
  check('v89.42：七张贴图两两不同（防误拷贝同图）', (function () {
    var crypto = require('crypto'), seen = {};
    for (var i = 0; i < TERRAIN_7.length; i++) {
      var p = terrainTexPath(TERRAIN_7[i]);
      if (!fs.existsSync(p)) return false;
      var hmd = crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex');
      if (seen[hmd]) return false;
      seen[hmd] = 1;
    }
    return true;
  })());
  check('v89.42：城池 / 据点 5 个 key 保持无素材（仍走程序化绘制，不随野地一起回归）',
    ['fort', 'city_county', 'city_jun', 'city_zhou', 'city_capital']
      .every(function (k) { return !fs.existsSync(path.join(__dirname, 'assets', 'icons', 'ui', 'ai_' + k + '.png')); }));
  check('v89.42：位图登记表已同步（BITMAPS 认得七张地形贴图）', (function () {
    if (typeof BITMAPS === 'undefined' || !BITMAPS.has || !BITMAPS.fileOf) return false;
    return TERRAIN_7.every(function (t) { return !!BITMAPS.fileOf('terrain', t); });
  })());
  check('v89.42：逐格镜像变体存在、走轴对齐线性变换（不引入旋转 / 仿射）', (function () {
    return /function texVariant\(gx, gy\)/.test(MP)
      && /ctx\.scale\(-1, 1\)/.test(MP) && /ctx\.scale\(1, -1\)/.test(MP)
      && !/ctx\.rotate\(/.test(MP) && !/setTransform/.test(MP);
  })());
  check('v89.42：平地的「不铺贴图」卫兵下移到矢量兜底前（贴图阶段不再跳过平地）', (function () {
    var tex = MP.indexOf("if (ART['terrain_' + d.terrain])");
    var guard = MP.indexOf("if (d.terrain === 'plain') return;");
    return tex >= 0 && guard > tex;
  })());"""

edit(T, OLD, NEW, 'smoke-test.js · v67 地形护栏 → v89.42 新不变量')

print('--- 语法检查 ---')
r = subprocess.run(['node', '--check', T], capture_output=True, text=True)
print('node --check rc=%d %s' % (r.returncode, (r.stderr or '').strip()[:300]))

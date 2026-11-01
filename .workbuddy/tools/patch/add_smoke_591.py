# -*- coding: utf-8 -*-
"""在 smoke 里插入 §591：项目索引（单一清单）的 5 条断言。

为什么要有这几条：
  索引如果**过期**（改了源码没重跑），who.js 会给出过时的答案 —— 比没有更糟；
  索引如果**没被消费**（构建又抄回一份清单），它只是第 9 份废纸。
  这两件事都必须由门禁来守，不能靠"记得"。
"""
import io
import re

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

if '§591' in s:
    print('SKIP：已经插过')
    raise SystemExit(0)

BLOCK = '''  /* ===================== §591 项目索引（唯一清单） =====================
   * 老板 2026-11-01：「是否可以建立一个资产链，或者逻辑对应表，或者项目树，
   *   或者其他还有助于指哪打哪的方式」
   * ---------------------------------------------------------------------
   * 索引（js/modules.json + .workbuddy/index/project-index.json）由
   *   node .workbuddy/tools/map/gen_index.js 生成，who.js 消费。
   * 这里守两件事：
   *   ① **不过期**：索引的源码指纹必须与当前构建一致，否则 who.js 在骗人；
   *   ② **不被抄回去**：构建/审计脚本必须从它读，不能再自带一份清单 ——
   *      历史上同一个清单有 8 份副本，加一个模块改 8 处，漏一处就假红/假绿。
   * ===================================================================== */
  (function () {
    var fsx = require('fs'), pth = require('path');
    var MF = pth.join(__dirname, 'js', 'modules.json');
    var okExist = fsx.existsSync(MF);
    var MD = okExist ? JSON.parse(fsx.readFileSync(MF, 'utf8')) : null;

    check('§591① 权威清单 js/modules.json 存在且带 layout', !!(
      MD && MD.layout && MD.layout.order && MD.layout.order.length
    ), okExist ? ('模块 ' + (MD.modules || []).length) : '文件不存在，跑 node .workbuddy/tools/map/gen_index.js');
    if (!MD || !MD.layout || !MD.layout.order) return;

    /* 磁盘上的真实模块（排除构建产物 bundle-* 与审计镜像 ui-all.js） */
    var disk = fsx.readdirSync(pth.join(__dirname, 'js')).filter(function (f) {
      return /\\.js$/.test(f) && !/^bundle-/.test(f) && f !== 'ui-all.js';
    }).map(function (f) { return f.replace(/\\.js$/, ''); });

    /* ② 双向相等：漏一个 → 不进 bundle（假绿）；多一个 → 构建就炸（假红）。
       同时用"下限"防平凡解：模块数不可能少于 50（当前 86），
       否则一个空清单 + 空磁盘也能"完美相等"。 */
    var missing = disk.filter(function (n) { return MD.layout.order.indexOf(n) < 0; });
    var extra = MD.layout.order.filter(function (n) { return disk.indexOf(n) < 0; });
    check('§591② layout.order 与磁盘双向相等（且非平凡：≥50 模块）',
      missing.length === 0 && extra.length === 0 && MD.layout.order.length >= 50,
      'order=' + MD.layout.order.length + ' disk=' + disk.length
      + (missing.length ? ' 漏=' + missing.join(',') : '')
      + (extra.length ? ' 多=' + extra.join(',') : ''));

    /* ③ 三个分包不重不漏：和必须等于总模块数（漏一个 → 它在任何包里都不出现；
          重一个 → 同一模块被打进两个包，运行时后加载的会覆盖前者） */
    var bags = MD.bundles || {};
    var union = (bags.core || []).concat(bags.war || [], bags.ui || []);
    var dup = union.filter(function (v, i, a) { return a.indexOf(v) !== i; });
    check('§591③ 分包不重不漏（core+war+ui = 全部模块）',
      union.length === MD.layout.order.length && dup.length === 0,
      'sum=' + union.length + ' / ' + MD.layout.order.length
      + (dup.length ? ' 重复=' + dup.join(',') : ''));

    /* ④ 不过期：索引里的源码指纹必须等于构建产物记录的指纹。
         两者不等 = 改完源码后只做了其中一步（忘记重跑索引，或忘记构建）。 */
    var bh = '';
    try { bh = fsx.readFileSync(pth.join(__dirname, 'js', 'bundle.hash'), 'utf8').trim().slice(0, 16); } catch (e) { }
    check('§591④ 索引与构建同步（sourceHash == bundle.hash）',
      !!bh && MD.sourceHash === bh,
      'index=' + MD.sourceHash + ' bundle=' + (bh || '(无)')
      + '（源码改了就重跑 gen_index.js 再 build_bundle.py）');

    /* ⑤ 防止"清单再被抄回去"：构建脚本必须从 modules.json 读，不能再写死 ORDER；
          audit 的模块列表同理。这条是"单一来源"真正落地的判据 ——
          没有它，下次有人图省事复制一份数组，索引就退化成第 9 份清单。 */
    var bb = '', au = '';
    try { bb = fsx.readFileSync(pth.join(__dirname, '.workbuddy', 'tools', 'patch', 'build_bundle.py'), 'utf8'); } catch (e) { }
    try { au = fsx.readFileSync(pth.join(__dirname, 'audit.js'), 'utf8'); } catch (e) { }
    var bbReadsJson = bb.indexOf('_load_layout') >= 0 && bb.indexOf("'modules.json'") >= 0;
    var bbNoHard = !/^ORDER = \\[/m.test(bb);
    var auReadsJson = au.indexOf("require('./js/modules.json')") >= 0;
    check('§591⑤ 构建与审计都从 modules.json 读（不再自带清单）',
      bbReadsJson && bbNoHard && auReadsJson,
      'build读=' + bbReadsJson + ' build无硬编码=' + bbNoHard + ' audit读=' + auReadsJson);
  })();

'''

anchor = "console.log('结果：' + PASS + ' 通过 / ' + FAIL + ' 失败');"
assert anchor in s, '汇总行锚点没找到'
s = s.replace(anchor, BLOCK + anchor, 1)

io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ smoke 已插入 §591（5 条）')

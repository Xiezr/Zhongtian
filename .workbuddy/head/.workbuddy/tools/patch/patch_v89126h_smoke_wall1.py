# -*- coding: utf-8 -*-
"""v89.126 补丁 H：smoke 城墙专区断言升级（批次 1）
① 3090-3096 基础三条 → v89.126 新口径三条
② 4132-4141 #1 四条 → 新口径四条（含真调 applyBuildDone）
③ CORE_API：wallCost → wallCellIdxOf
④ 1423 优先升级断言（城墙未建不参与候选）
"""
import io, os, subprocess

R = r'E:/Deepseekdb'
P = os.path.join(R, 'smoke-test.js')
s = io.open(P, encoding='utf-8').read()

# ① 基础三条
old1 = """  check('城墙不占城内格（不在建造列表）', DATA.BUILD_ORDER.indexOf('chengqiang') < 0);
  check('城墙等级存于 city.wallLv（buildingLevel 特判）',
    /if \\(bid === 'chengqiang'\\) return city\\.wallLv \\|\\| 0;/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8')));
  check('城墙可修建/升级/取消施工',
    /GAME\\.buildWall = function/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'))
    && /GAME\\.upgradeWall = function/.test(require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8'))
    && /ui\\.openWallModal = function/.test(uiS));"""
new1 = """  /* v89.126（老板）：「将城墙与其他建筑并列管理，只是一个有特殊功能的建筑」——
     城墙占一格、进建造列表；等级在 cells；建造/升级走通用出口。 */
  check('城墙**占城内一格**（进建造列表，与其它建筑并列）', DATA.BUILD_ORDER.indexOf('chengqiang') >= 0);
  check('城墙等级在 cells 里（buildingLevel 无特判 + wallCellIdxOf 唯一出口）', (function () {
    var srcW = require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8');
    var cW = G.makeCity({ id: 'w1b126', name: 'W' });
    cW.cells.push({ build: { id: 'chengqiang', lvl: 4 } });
    return !/if \\(bid === 'chengqiang'\\) return city\\.wallLv/.test(srcW)
      && G.buildingLevel(cW, 'chengqiang') === 4
      && G.wallCellIdxOf(cW) === cW.cells.length - 1;
  })());
  check('城墙走通用建造/升级出口（独立出口与独立面板已退役）', (function () {
    var srcW2 = require('fs').readFileSync(require('path').join(__dirname, 'js', 'domain.js'), 'utf8');
    return typeof G.buildAt === 'function' && typeof G.upgradeAt === 'function'
      && !/GAME\\.buildWall = function/.test(srcW2) && !/GAME\\.upgradeWall = function/.test(srcW2)
      && !/ui\\.openWallModal = function/.test(uiS);
  })());"""
assert s.count(old1) == 1, '锚点①计数 %d' % s.count(old1)
s = s.replace(old1, new1)

# ② #1 四条
old2 = """  check('#1 城墙不占城内地块', DATA.BUILD_ORDER.indexOf('chengqiang') < 0 && !/chengqiang: 1 \\}/.test(dS16));
  check('#1 城墙为窄带描边（不占格、不遮建筑）', /iso-wall/.test(uS16) && /ui\\.isoWallSVG = function/.test(uS16) && /ui\\.WALL_PX/.test(uS16));
  check('#1 城墙等级存 city.wallLv', (function () {
    var c = G.makeCity({ id: 'w1', name: 'W' });
    c.wallLv = 4;
    return G.buildingLevel(c, 'chengqiang') === 4;
  })());
  check('#1 城墙可修建/升级/取消', typeof G.buildWall === 'function' && typeof G.upgradeWall === 'function'
    && /ui\\.openWallModal = function/.test(uS16) && /cancel-build-ask" data-kind="wall"/.test(uS16));
  check('#1 城墙施工完成写回 wallLv', /wc\\.wallLv = q\\.targetLevel/.test(stS16));"""
new2 = """  check('#1 城墙占城内一格（v89.126 起与其它建筑并列管理）', DATA.BUILD_ORDER.indexOf('chengqiang') >= 0);
  check('#1 城墙为窄带描边（视觉保留：环城一圈不遮建筑）', /iso-wall/.test(uS16) && /ui\\.isoWallSVG = function/.test(uS16) && /ui\\.WALL_PX/.test(uS16));
  check('#1 城墙等级在 cells（buildingLevel 统一读法 + wallCellIdxOf）', (function () {
    var cW3 = G.makeCity({ id: 'w1', name: 'W' });
    cW3.cells.push({ build: { id: 'chengqiang', lvl: 4 } });
    return G.buildingLevel(cW3, 'chengqiang') === 4 && G.wallCellIdxOf(cW3) >= 0;
  })());
  check('#1 城墙走通用建造/升级/取消（无独立出口与专有动作）', (function () {
    return typeof G.buildAt === 'function' && typeof G.upgradeAt === 'function'
      && !/GAME\\.buildWall = function/.test(dS16) && !/GAME\\.upgradeWall = function/.test(dS16)
      && !/data-action="wall-build"/.test(uS16) && !/data-action="rush-wall"/.test(uS16);
  })());
  check('#1 城墙升级完成走通用 upgrade 分支（真调 applyBuildDone 写回格内等级）', (function () {
    var keepW = G.state;
    var stW = G.newGame({ name: 'tw1', cityName: '许都' });
    G.state = stW;
    var ccW = stW.cities[0];
    var idxW = 47;
    ccW.cells[idxW] = { build: { id: 'chengqiang', lvl: 3 },
      pending: { buildId: 'chengqiang', targetLevel: 4 } };
    G.applyBuildDone({ type: 'upgrade', cityId: ccW.id, gridIndex: idxW, buildId: 'chengqiang', targetLevel: 4 });
    var okW = ccW.cells[idxW].build.lvl === 4 && !ccW.cells[idxW].pending;
    G.state = keepW;
    return okW;
  })());"""
assert s.count(old2) == 1, '锚点②计数 %d' % s.count(old2)
s = s.replace(old2, new2)

# ③ CORE_API
old3 = "    ['GAME.storeCap', G.storeCap], ['GAME.wallCost', G.wallCost],"
new3 = "    ['GAME.storeCap', G.storeCap], ['GAME.wallCellIdxOf', G.wallCellIdxOf],"
assert s.count(old3) == 1, '锚点③计数 %d' % s.count(old3)
s = s.replace(old3, new3)

# ④ 优先升级断言
old4 = """  check('优先升级等级最低者（城墙 Lv0 时最先修城墙）', (function () {
    if (!(au1 && au1.target) || au1.target.lv !== wantLv) return false;
    /* v64：城墙 0 级 → 它必然是最低等级，第一个就该轮到它（老板："纳入自动建筑"） */
    var wallLow = S21.cities.some(function (ct) { return !(ct.wallLv || 0); });
    return wallLow ? (au1.target.kind === 'wall' && au1.target.lv === 0) : true;
  })(), '目标 ' + (au1 && au1.target ? (au1.target.kind + ' Lv' + au1.target.lv) : '?')
    + '（当前最低 Lv' + wantLv + '）');"""
new4 = """  check('优先升级等级最低者（v89.126：城墙占格后，未建不参与候选 —— 与其它建筑一致）', (function () {
    if (!(au1 && au1.target) || au1.target.lv !== wantLv) return false;
    /* 旧口径：城墙"永远存在（Lv0）"必然最低 → 自动升级先修墙；
       新口径：城墙占格、未建则不在候选里（和书院/校场等一样，需玩家先建）——
       自动升级只做"升级"，不代建未建建筑。 */
    var anyWallCell = S21.cities.some(function (ct) {
      return (ct.cells || []).some(function (x) { return x.build && x.build.id === 'chengqiang'; });
    });
    return anyWallCell ? true : (au1.target.kind !== 'wall');
  })(), '目标 ' + (au1 && au1.target ? (au1.target.kind + ' Lv' + au1.target.lv) : '?')
    + '（当前最低 Lv' + wantLv + '）');"""
assert s.count(old4) == 1, '锚点④计数 %d' % s.count(old4)
s = s.replace(old4, new4)

tmp = P + '.tmp_v89126'
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(s)
os.replace(tmp, P)
r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
assert r.returncode == 0, 'node --check 失败：' + r.stderr[:400]
print('✓ smoke 补丁 H 完成（批次 1：4 组断言升级）')

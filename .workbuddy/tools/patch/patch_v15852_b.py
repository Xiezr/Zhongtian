# -*- coding: utf-8 -*-
"""v158.52 B：placeCamera 第三人称战舰机位 + main.js 键位（←→/↑↓）+ HUD 文案。
   幂等 mark：_flyCam / FLYK_v15852；读-改-写分离；newline=''。"""
import io

MAP = 'E:/Deepseekdb/js/map3d.js'
MAIN = 'E:/Deepseekdb/js/main.js'
UI = 'E:/Deepseekdb/js/ui-mapui.js'


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


def rep(path, tag, old, new, mark, cnt=1):
    s = rd(path)
    if mark in s:
        print('[skip] ' + tag)
        return
    c = s.count(old)
    assert c == cnt, '%s count=%d (want %d)' % (tag, c, cnt)
    wr(path, s.replace(old, new))
    print('[ok] ' + tag)


# ---------- 1. placeCamera：飞行态覆盖轨道机位/朝向 ----------
OLD_CAM = '''    var _lpEff = camO.lookPitch;
    if (camO.lookYaw || _lpEff) {
      cam.quaternion.multiply(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.max(-1.55, Math.min(1.55, _lpEff)), camO.lookYaw, 0, 'YXZ')));
    }
    cam.updateMatrixWorld();'''
NEW_CAM = '''    var _lpEff = camO.lookPitch;
    if (M._fly && M._fly.active && !M._surf && M._fly.pos && M._fly.head && cam.lookAt) {
      /* v158.52：第三人称战舰机位 —— 覆盖轨道"看球心"姿态。
         机位在战舰后方 + 径向抬高；up 恒径向 = 脚底永远朝星球；
         注视战舰前方（机头方向），所以"前进就是画面往前"，不是转星球。
         右键 lookYaw/lookPitch 作为相对机头的转头偏移保留。 */
      var _sp = _flyVec(M._fly.pos);
      var _hd = _flyVec(M._fly.head).normalize();
      var _upR = _sp.clone().normalize();
      cam.position.copy(_sp).addScaledVector(_hd, -(M.FLY_CAM_BACK || 18))
        .addScaledVector(_upR, (M.FLY_CAM_UP || 6));
      cam.up.copy(_upR);
      var _tg = _sp.clone().addScaledVector(_hd, (M.FLY_CAM_LOOK || 42));
      if (camO.lookYaw || _lpEff) {
        var _fq = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          Math.max(-1.55, Math.min(1.55, _lpEff)), camO.lookYaw, 0, 'YXZ'));
        _tg.sub(_sp).applyQuaternion(_fq).add(_sp);
      }
      cam.lookAt(_tg);
      M._flyCam = { pos: cam.position.toArray(), up: _upR.toArray() };
    } else {
      cam.quaternion.copy(camO.quat);
      if (camO.lookYaw || _lpEff) {
        cam.quaternion.multiply(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.max(-1.55, Math.min(1.55, _lpEff)), camO.lookYaw, 0, 'YXZ')));
      }
    }
    cam.updateMatrixWorld();'''
rep(MAP, 'map3d placeCamera flight view', OLD_CAM, NEW_CAM, 'M._flyCam =')

# ---------- 2. main.js keydown：方向键专用通道 ----------
OLD_KD = '''        if (!_mkAv.FOLLOW && !_mkAv._surf
            && (/^Key[WASDQE]$/.test(_avCode) || AV_KEY_ALIAS[_avCode])
            && !(_mkAv.DISTRICT && GAME.district && GAME.district.active)
            && !(GAME.vehicle && GAME.vehicle.mounted)) {
          if (!GAME._flyKeys) GAME._flyKeys = {};
          GAME._flyKeys[AV_KEY_ALIAS[_avCode] || _avCode.charAt(3).toLowerCase()] = 1;
          e.preventDefault();
          return;
        }'''
NEW_KD = '''        /* v158.52：←→ 加减速、↑↓ 升降（替代 Q/E）；W/S 俯仰、A/D 转向。
           方向键在地表仍走走路通道（上面分支已 return），高空单独映射。 */
        var _flyK52 = null;
        if (_avCode === 'ArrowLeft') _flyK52 = 'left';
        else if (_avCode === 'ArrowRight') _flyK52 = 'right';
        else if (_avCode === 'ArrowUp') _flyK52 = 'up';
        else if (_avCode === 'ArrowDown') _flyK52 = 'down';
        else if (/^Key[WASD]$/.test(_avCode)) _flyK52 = _avCode.charAt(3).toLowerCase();
        if (!_mkAv.FOLLOW && !_mkAv._surf && _flyK52
            && !(_mkAv.DISTRICT && GAME.district && GAME.district.active)
            && !(GAME.vehicle && GAME.vehicle.mounted)) {
          if (!GAME._flyKeys) GAME._flyKeys = {};
          GAME._flyKeys[_flyK52] = 1;
          e.preventDefault();
          return;
        }'''
rep(MAIN, 'main keydown arrows', OLD_KD, NEW_KD, '_flyK52 =')

# ---------- 3. main.js keyup：方向键反解（不能用 AV_KEY_ALIAS 归一后的 _c） ----------
OLD_KU = '''      if (/^Key[WASDQE]$/.test(_c) && GAME._flyKeys) {
        GAME._flyKeys[_c.charAt(3).toLowerCase()] = 0;
      }'''
NEW_KU = '''      /* v158.52：先按**原始 code** 判方向键 —— _c 已被 AV_KEY_ALIAS 归一成 KeyA/D/W/S，
         拿它判不到 ArrowLeft/Right/Up/Down（老坑复现）。 */
      var _fc52 = _c0 === 'ArrowLeft' ? 'left' : _c0 === 'ArrowRight' ? 'right'
        : _c0 === 'ArrowUp' ? 'up' : _c0 === 'ArrowDown' ? 'down'
        : (/^Key[WASD]$/.test(_c) ? _c.charAt(3).toLowerCase() : null);
      if (_fc52 && GAME._flyKeys) GAME._flyKeys[_fc52] = 0;'''
rep(MAIN, 'main keyup arrows', OLD_KU, NEW_KU, '_fc52 =')

# ---------- 4. HUD 文案 ----------
OLD_HUD = "'<span style=\"opacity:.6;font-weight:600;margin-left:8px;\">E 加速 · Q 减速 · W/S 俯仰 · A/D 转向</span>';"
NEW_HUD = "'<span style=\"opacity:.6;font-weight:600;margin-left:8px;\">←→ 加减速 · ↑↓ 升降 · W/S 俯仰 · A/D 转向</span>';"
rep(UI, 'fly hud keys', OLD_HUD, NEW_HUD, '←→ 加减速')

OLD_HUD2 = "el.innerHTML = '<span style=\"opacity:.9;\">🚀 空天飞机 · </span>'"
NEW_HUD2 = "el.innerHTML = '<span style=\"opacity:.9;\">🚀 空天战舰 · </span>'"
rep(UI, 'fly hud name', OLD_HUD2, NEW_HUD2, '🚀 空天战舰 ·')

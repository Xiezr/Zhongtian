# -*- coding: utf-8 -*-
"""v158.52 C：修复飞行态滚轮被覆盖（无法降落）的真 bug。
   _tickFlight 每帧先消费 _zoomTarget（滚轮写入）再写回，↑↓ 与滚轮共存。"""
import io

P = 'E:/Deepseekdb/js/map3d.js'
MARK = 'v158.52 · 滚轮与升降共存'
OLD = '''    var pos = _flyVec(fly.pos), head = _flyVec(fly.head), vel = _flyVec(fly.vel);
    var radial = pos.clone().normalize();
    /* ① 速度标量：←→ 是唯一的"发动机力"，无输入恒速（牛顿第一定律） */'''
NEW = '''    var pos = _flyVec(fly.pos), head = _flyVec(fly.head), vel = _flyVec(fly.vel);
    var radial = pos.clone().normalize();
    /* v158.52 · 滚轮与升降共存：滚轮写的是 _zoomTarget（目标海拔），
       旧版这里无条件把 _zoomTarget 覆盖成当前半径 → 飞行态滚轮彻底失效、
       无法滚回地表（探针⑨抓出）。正解：先消费滚轮目标（差 > 1cm 才动），
       再让 ↑↓ 在其上叠加，最后统一写回锚点。 */
    var _zt = (_zoomTarget != null && isFinite(_zoomTarget)) ? _zoomTarget : (pos.length() - R);
    var _rWheel = R + Math.max(0.6, _zt);
    if (Math.abs(_rWheel - pos.length()) > 0.01) {
      pos.setLength(_rWheel);
      radial = pos.clone().normalize();
    }
    /* ① 速度标量：←→ 是唯一的"发动机力"，无输入恒速（牛顿第一定律） */'''
s = io.open(P, 'r', encoding='utf-8', newline='').read()
if MARK in s:
    print('[skip] v158.52 C already applied')
else:
    c = s.count(OLD)
    assert c == 1, 'count=%d' % c
    io.open(P, 'w', encoding='utf-8', newline='').write(s.replace(OLD, NEW))
    print('[ok] v158.52 C applied')

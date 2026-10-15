# -*- coding: utf-8 -*-
"""v89.2 场景插画（map.js）：12 活动各一幅程序化风景画 + GAME.map.paintScene 出口。
   复用本模块画师原语（drawTree/mountain/grassTuft/flower/dot/seg），与地图同一套笔法。探针幂等。"""
import io

P = r'E:\Deepseekdb\js\map.js'
d = io.open(P, encoding='utf-8', newline='').read()

SEC = r'''  /* ============================================================
   * v89.2：**场景插画**（老板「我想看见个湖，而不是一行字」）
   * ------------------------------------------------------------
   * 每个活动一幅程序化风景（12 种），画在 860×260 逻辑画布上，
   * 由 ui.js 的 <canvas class="sxf-canvas"> 承载（DPR 2 倍绘制）。
   * 全部复用本模块的画师原语（drawTree / mountain / grassTuft /
   * flower / dot / seg），与地图是同一套笔法 —— 风格天然一致。
   * 种子传格子坐标 → 同一地点每次打开画得一样（确定性）。
   * ============================================================ */
  var SCENE_W = 860, SCENE_H = 260;

  function sSky(ctx, c0, c1) {
    var g = ctx.createLinearGradient(0, 0, 0, SCENE_H);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, SCENE_W, SCENE_H);
  }
  function sSun(ctx, x, y, r, col, halo) {
    if (halo) {
      var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3);
      g.addColorStop(0, halo); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    dot(ctx, x, y, r, col);
  }
  function sCloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    var p = [[0, 0, 1.0], [0.72, 0.16, 0.74], [-0.7, 0.18, 0.7], [0.34, -0.28, 0.58], [-0.3, -0.22, 0.52]];
    for (var i = 0; i < p.length; i++) {
      ctx.beginPath();
      ctx.ellipse(x + p[i][0] * 30 * s, y + p[i][1] * 30 * s, 22 * s * p[i][2], 13 * s * p[i][2], 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  /* 远山折线（baseY 处起峰，amp 高度；种子化） */
  function sRidge(ctx, baseY, amp, col, seed) {
    var r = U.rng((seed | 0) * 7 + 13);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-12, SCENE_H);
    var x = -12;
    while (x < SCENE_W + 12) {
      var w = 96 + r() * 140, hh = amp * (0.5 + r() * 0.8);
      ctx.lineTo(x + w * 0.5, baseY - hh);
      ctx.lineTo(x + w, baseY - amp * 0.10 * (0.4 + r()));
      x += w;
    }
    ctx.lineTo(SCENE_W + 12, SCENE_H);
    ctx.closePath(); ctx.fill();
  }
  function sGround(ctx, y, c0, c1) {
    var g = ctx.createLinearGradient(0, y, 0, SCENE_H);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fillRect(0, y, SCENE_W, SCENE_H - y);
  }
  /* 竖立的鹘形旗（杆 + 三角旗） */
  function sFlag(ctx, x, yBase, h, col, poleCol) {
    seg(ctx, x, yBase, x, yBase - h, poleCol || '#5c4a30', 3);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, yBase - h);
    ctx.lineTo(x + 34, yBase - h + 9);
    ctx.lineTo(x, yBase - h + 19);
    ctx.closePath(); ctx.fill();
  }

  var SCENE_PAINT = {
    /* 湖 · 垂钓（老板点名的那个湖：芦苇 / 湖心石 / 柳荫 三处钓位） */
    lake: function (ctx, sd) {
      sSky(ctx, '#cfe7f4', '#f6fbfd');
      sSun(ctx, 694, 50, 19, '#fdf3cf', 'rgba(255,246,214,.5)');
      sCloud(ctx, 186, 50, 1.1, 'rgba(255,255,255,.85)');
      sCloud(ctx, 508, 32, 0.78, 'rgba(255,255,255,.7)');
      sCloud(ctx, 782, 68, 0.6, 'rgba(255,255,255,.6)');
      sRidge(ctx, 126, 44, '#b3cbd8', sd);
      sRidge(ctx, 136, 24, '#98b7c9', sd + 5);
      var wg = ctx.createLinearGradient(0, 124, 0, SCENE_H);
      wg.addColorStop(0, '#8ec6e3'); wg.addColorStop(0.55, '#5d9ec6'); wg.addColorStop(1, '#2e6b95');
      ctx.fillStyle = wg; ctx.fillRect(0, 124, SCENE_W, SCENE_H - 124);
      ctx.strokeStyle = 'rgba(255,255,255,.48)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (var i = 0; i < 8; i++) {
        var rx = 60 + i * 106, ry = 146 + (i % 3) * 32;
        ctx.beginPath(); ctx.arc(rx, ry, 24 + (i % 2) * 9, Math.PI * 1.14, Math.PI * 1.86); ctx.stroke();
      }
      /* 左：沙岸 + 芦苇荡 */
      ctx.fillStyle = '#d9c78e';
      ctx.beginPath(); ctx.ellipse(0, 236, 190, 62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9b478';
      ctx.beginPath(); ctx.ellipse(150, 246, 130, 30, 0, 0, Math.PI * 2); ctx.fill();
      var reeds = [[64, 210], [88, 202], [112, 214], [76, 224], [140, 218]];
      for (var r2 = 0; r2 < reeds.length; r2++) {
        var rx2 = reeds[r2][0], ry2 = reeds[r2][1];
        seg(ctx, rx2, ry2, rx2 - 5, ry2 - 40, 'rgba(84,112,48,.95)', 2.4);
        seg(ctx, rx2 + 6, ry2, rx2 + 12, ry2 - 34, 'rgba(96,124,54,.9)', 2);
        dot(ctx, rx2 - 6, ry2 - 42, 3.4, '#a8894a');
        dot(ctx, rx2 + 13, ry2 - 36, 3, '#b3945a');
      }
      /* 中：湖心石 */
      ctx.fillStyle = '#8d949c';
      ctx.beginPath(); ctx.ellipse(452, 190, 30, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a6adb4';
      ctx.beginPath(); ctx.ellipse(448, 184, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(452, 196, 36, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      /* 中：浮漂（钓鱼的那一点红） */
      dot(ctx, 560, 176, 4.2, '#d8493a');
      dot(ctx, 560, 181, 3, '#f2f2ee');
      /* 右：栈桥 + 柳树 */
      ctx.fillStyle = '#8a6236';
      ctx.fillRect(660, 168, 200, 9);
      for (var p2 = 0; p2 < 5; p2++) ctx.fillRect(672 + p2 * 36, 177, 8, 34);
      ctx.fillStyle = '#6f4d28';
      ctx.fillRect(660, 208, 200, 6);
      seg(ctx, 792, 172, 792, 96, '#6a4a28', 7);
      ctx.strokeStyle = 'rgba(74,124,52,.9)'; ctx.lineWidth = 2.2;
      for (var w2 = 0; w2 < 7; w2++) {
        var wx = 792 + (w2 - 3) * 16;
        ctx.beginPath();
        ctx.moveTo(792, 108);
        ctx.quadraticCurveTo(wx + 6, 128, wx + (w2 - 3) * 5, 150);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(74,124,52,.85)';
      ctx.beginPath(); ctx.ellipse(792, 96, 52, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(96,150,64,.8)';
      ctx.beginPath(); ctx.ellipse(770, 88, 30, 15, 0, 0, Math.PI * 2); ctx.fill();
      /* 天空飞鸟 */
      seg(ctx, 300, 62, 312, 56, 'rgba(70,90,110,.6)', 2);
      seg(ctx, 312, 56, 324, 62, 'rgba(70,90,110,.6)', 2);
      seg(ctx, 356, 78, 365, 73, 'rgba(70,90,110,.5)', 1.7);
      seg(ctx, 365, 73, 374, 78, 'rgba(70,90,110,.5)', 1.7);
    },

    /* 山寨 · 讨伐（栅栏寨门 + 望楼 + 火把） */
    fort: function (ctx, sd) {
      sSky(ctx, '#e6d2a8', '#f7ecd2');
      sSun(ctx, 168, 60, 22, '#ffdda2', 'rgba(255,214,150,.45)');
      sCloud(ctx, 560, 46, 0.9, 'rgba(255,252,240,.6)');
      sRidge(ctx, 120, 52, '#8d7d5e', sd);
      sRidge(ctx, 134, 30, '#796a4e', sd + 3);
      sGround(ctx, 138, '#77854f', '#5d6b3c');
      /* 栅栏墙：尖头木桩 */
      for (var i = 0; i < 22; i++) {
        var x = 120 + i * 28, h = 46 + (i % 3) * 5;
        ctx.fillStyle = i % 2 ? '#8a6236' : '#7d5730';
        ctx.fillRect(x, 186 - h, 10, h);
        ctx.beginPath();
        ctx.moveTo(x, 186 - h); ctx.lineTo(x + 5, 186 - h - 9); ctx.lineTo(x + 10, 186 - h);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#6f4d28';
      ctx.fillRect(112, 186, 640, 7);
      /* 寨门（左 0.30 附近加高 + 望楼） */
      ctx.fillStyle = '#7a5430';
      ctx.fillRect(246, 100, 86, 86);
      ctx.fillStyle = '#8a6236';
      ctx.fillRect(238, 92, 102, 12);
      ctx.fillStyle = '#3c2a16';
      ctx.fillRect(272, 130, 34, 56);
      sFlag(ctx, 258, 92, 42, '#b5453a');
      sFlag(ctx, 690, 186, 58, '#b5453a');
      /* 火把两处 */
      dot(ctx, 216, 152, 5, '#f2a03c');
      dot(ctx, 216, 152, 10, 'rgba(242,160,60,.25)');
      dot(ctx, 392, 150, 5, '#f2a03c');
      dot(ctx, 392, 150, 10, 'rgba(242,160,60,.25)');
      /* 右侧侧坡小路（迂回） */
      ctx.strokeStyle = 'rgba(198,168,112,.75)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(640, 214); ctx.quadraticCurveTo(700, 178, 762, 196); ctx.stroke();
      mountain(ctx, 786, 168, 66, 74, '#b3a37f', '#8b7b5b');
    },

    /* 古阵 · 试炼（石柱 + 阵纹光圈） */
    array: function (ctx, sd) {
      sSky(ctx, '#5d6b7e', '#a6b4c0');
      sSun(ctx, 700, 52, 16, 'rgba(226,236,244,.85)', 'rgba(214,228,240,.3)');
      sCloud(ctx, 240, 44, 0.8, 'rgba(222,230,238,.35)');
      sRidge(ctx, 122, 40, '#6d7686', sd);
      sGround(ctx, 132, '#565b4c', '#42463a');
      /* 阵纹光圈（两环 + 刻度） */
      ctx.strokeStyle = 'rgba(111,208,232,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(430, 208, 210, 44, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(111,208,232,.4)';
      ctx.beginPath(); ctx.ellipse(430, 208, 150, 31, 0, 0, Math.PI * 2); ctx.stroke();
      for (var i = 0; i < 12; i++) {
        var a = Math.PI * 2 * i / 12;
        seg(ctx, 430 + Math.cos(a) * 204, 208 + Math.sin(a) * 42,
          430 + Math.cos(a) * 214, 208 + Math.sin(a) * 46, 'rgba(111,208,232,.5)', 2);
      }
      /* 石柱（四根，高低错落） */
      var pil = [[112, 92], [306, 74], [560, 80], [742, 96]];
      for (var p = 0; p < pil.length; p++) {
        var px = pil[p][0], ph = pil[p][1];
        ctx.fillStyle = p % 2 ? '#8d9199' : '#7d8189';
        ctx.fillRect(px, 206 - ph, 26, ph);
        ctx.fillStyle = '#a2a6ae';
        ctx.fillRect(px, 206 - ph, 26, 8);
        seg(ctx, px + 9, 206 - ph + 18, px + 18, 206 - ph + 30, 'rgba(50,54,60,.45)', 2);
        seg(ctx, px + 16, 206 - ph + 40, px + 8, 206 - ph + 54, 'rgba(50,54,60,.4)', 2);
      }
      /* 雾气 */
      ctx.fillStyle = 'rgba(214,222,226,.16)';
      ctx.fillRect(0, 150, SCENE_W, 26);
      ctx.fillStyle = 'rgba(214,222,226,.12)';
      ctx.fillRect(0, 186, SCENE_W, 18);
      dot(ctx, 430, 208, 6, 'rgba(111,208,232,.5)');
    },

    /* 山野 · 采集（草坡 + 溪 + 崖边 + 林缘） */
    meadow: function (ctx, sd) {
      sSky(ctx, '#cfe3ea', '#f8f5e2');
      sSun(ctx, 640, 48, 18, '#fdf0c0', 'rgba(255,244,200,.45)');
      sCloud(ctx, 220, 40, 0.9, 'rgba(255,255,255,.8)');
      sRidge(ctx, 116, 38, '#b0bd92', sd);
      sGround(ctx, 126, '#9cb163', '#7a9448');
      /* 左：崖壁 */
      ctx.fillStyle = '#9d9078';
      ctx.beginPath();
      ctx.moveTo(0, 126); ctx.lineTo(120, 126); ctx.lineTo(96, 210); ctx.lineTo(0, 226);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b0a289';
      ctx.beginPath();
      ctx.moveTo(0, 126); ctx.lineTo(64, 126); ctx.lineTo(50, 186); ctx.lineTo(0, 198);
      ctx.closePath(); ctx.fill();
      seg(ctx, 22, 150, 58, 142, 'rgba(84,76,58,.35)', 2);
      seg(ctx, 30, 172, 72, 164, 'rgba(84,76,58,.3)', 2);
      /* 中：溪流 */
      ctx.fillStyle = '#8fc2dd';
      ctx.beginPath();
      ctx.moveTo(330, 260); ctx.quadraticCurveTo(392, 208, 430, 168);
      ctx.quadraticCurveTo(448, 148, 470, 132);
      ctx.lineTo(500, 132); ctx.quadraticCurveTo(478, 152, 462, 172);
      ctx.quadraticCurveTo(430, 212, 396, 260);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(378, 232); ctx.quadraticCurveTo(408, 202, 442, 168); ctx.stroke();
      /* 右：林缘两三棵树 */
      drawTree(ctx, 742, 196, 1.05);
      drawTree(ctx, 802, 202, 0.86);
      drawTree(ctx, 676, 200, 0.72);
      /* 草簇与花 */
      var tufts = [[150, 238, 1.1], [214, 226, 0.95], [280, 244, 1.05], [352, 200, 0.8],
        [560, 238, 1.1], [620, 224, 0.9], [700, 246, 1.0], [840, 232, 0.9], [480, 252, 1.05]];
      for (var t = 0; t < tufts.length; t++) grassTuft(ctx, tufts[t][0], tufts[t][1], tufts[t][2]);
      var fls = [[186, 232], [246, 214], [316, 238], [586, 226], [648, 240], [764, 236], [516, 244]];
      for (var f = 0; f < fls.length; f++) flower(ctx, fls[f][0], fls[f][1], 1);
      /* 蝴蝶 */
      dot(ctx, 400, 180, 2.4, '#e8e2f0'); dot(ctx, 406, 176, 2.2, '#e8e2f0');
      dot(ctx, 620, 166, 2.2, '#f0e2d0'); dot(ctx, 626, 162, 2, '#f0e2d0');
    },

    /* 林间 · 修炼（层林 + 光柱 + 石台） */
    grove: function (ctx, sd) {
      sSky(ctx, '#c9dcc9', '#eff4dd');
      sSun(ctx, 700, 44, 16, '#fff6d2', 'rgba(255,248,214,.5)');
      /* 光柱 */
      ctx.fillStyle = 'rgba(255,250,220,.18)';
      ctx.beginPath(); ctx.moveTo(650, 0); ctx.lineTo(760, 0); ctx.lineTo(600, SCENE_H); ctx.lineTo(470, SCENE_H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,220,.12)';
      ctx.beginPath(); ctx.moveTo(420, 0); ctx.lineTo(478, 0); ctx.lineTo(360, SCENE_H); ctx.lineTo(300, SCENE_H); ctx.closePath(); ctx.fill();
      sRidge(ctx, 120, 34, '#a9bb96', sd);
      sGround(ctx, 132, '#6d884a', '#55703a');
      drawTree(ctx, 96, 196, 1.25);
      drawTree(ctx, 240, 186, 1.0);
      drawTree(ctx, 396, 200, 1.15);
      drawTree(ctx, 560, 190, 1.3);
      drawTree(ctx, 700, 200, 0.95);
      drawTree(ctx, 812, 192, 1.1);
      /* 中央石台（打坐处） */
      ctx.fillStyle = '#9aa08a';
      ctx.beginPath(); ctx.ellipse(470, 224, 62, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#adb3a0';
      ctx.beginPath(); ctx.ellipse(470, 216, 54, 15, 0, 0, Math.PI * 2); ctx.fill();
      /* 苔点与蕨叶 */
      var moss = [[150, 240], [300, 232], [640, 244], [770, 236], [560, 240]];
      for (var m = 0; m < moss.length; m++) dot(ctx, moss[m][0], moss[m][1], 4, 'rgba(58,96,44,.55)');
      for (var q = 0; q < 3; q++) {
        var qx = 560 + q * 60;
        seg(ctx, qx, 250, qx - 10, 236, 'rgba(74,110,50,.8)', 2);
        seg(ctx, qx, 250, qx + 8, 234, 'rgba(74,110,50,.7)', 2);
      }
    },

    /* 柴扉 · 拜访（茅屋 + 竹篱 + 炊烟） */
    cottage: function (ctx, sd) {
      sSky(ctx, '#d6dfe6', '#f6f0e2');
      sSun(ctx, 210, 54, 17, '#fdf0c8', 'rgba(255,242,204,.4)');
      sCloud(ctx, 620, 44, 0.85, 'rgba(255,255,255,.75)');
      sRidge(ctx, 122, 36, '#a8b0a2', sd);
      sGround(ctx, 132, '#8fa05e', '#748a48');
      /* 茅屋 */
      ctx.fillStyle = '#cbb98f';
      ctx.beginPath();
      ctx.moveTo(300, 208); ctx.lineTo(300, 150); ctx.lineTo(470, 150); ctx.lineTo(470, 208);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#b99a5c';
      ctx.beginPath();
      ctx.moveTo(282, 152); ctx.lineTo(385, 96); ctx.lineTo(488, 152);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,94,52,.55)';
      ctx.beginPath();
      ctx.moveTo(282, 152); ctx.lineTo(385, 96); ctx.lineTo(385, 152);
      ctx.closePath(); ctx.fill();
      seg(ctx, 300, 138, 470, 138, 'rgba(110,86,48,.5)', 3);
      ctx.fillStyle = '#5f452a';
      ctx.fillRect(360, 168, 40, 40);
      ctx.fillStyle = '#8a6a3c';
      ctx.fillRect(322, 164, 24, 22);
      seg(ctx, 334, 164, 334, 186, 'rgba(80,60,32,.7)', 2);
      seg(ctx, 322, 175, 346, 175, 'rgba(80,60,32,.7)', 2);
      /* 炊烟 */
      dot(ctx, 424, 92, 7, 'rgba(240,240,235,.5)');
      dot(ctx, 436, 78, 9, 'rgba(240,240,235,.36)');
      dot(ctx, 452, 62, 11, 'rgba(240,240,235,.24)');
      /* 竹篱（前景） */
      for (var i = 0; i < 18; i++) {
        var x = 60 + i * 44;
        ctx.fillStyle = i % 2 ? '#9a7a48' : '#8d6e40';
        ctx.fillRect(x, 210, 7, 44);
        ctx.beginPath();
        ctx.moveTo(x, 210); ctx.lineTo(x + 3.5, 203); ctx.lineTo(x + 7, 210);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#8d6e40';
      ctx.fillRect(60, 222, 780, 5);
      ctx.fillRect(60, 236, 780, 4);
      /* 右侧树与石径 */
      drawTree(ctx, 760, 196, 1.0);
      ctx.strokeStyle = 'rgba(194,173,128,.8)'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(560, 258); ctx.quadraticCurveTo(600, 234, 640, 216); ctx.stroke();
    },

    /* 山道 · 绿林（两壁夹道 + 远处寨门） */
    road: function (ctx, sd) {
      sSky(ctx, '#c9d4dc', '#f0ead8');
      sSun(ctx, 700, 50, 16, '#fdf0c8', 'rgba(255,242,204,.35)');
      sCloud(ctx, 240, 42, 0.8, 'rgba(255,255,255,.7)');
      sRidge(ctx, 116, 42, '#98a08e', sd);
      sGround(ctx, 128, '#7f8b56', '#66743f');
      /* 左崖 */
      ctx.fillStyle = '#8d8168';
      ctx.beginPath();
      ctx.moveTo(0, 128); ctx.lineTo(230, 128); ctx.lineTo(180, 206); ctx.lineTo(96, 236); ctx.lineTo(0, 240);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a3967c';
      ctx.beginPath();
      ctx.moveTo(0, 128); ctx.lineTo(150, 128); ctx.lineTo(120, 190); ctx.lineTo(60, 214); ctx.lineTo(0, 218);
      ctx.closePath(); ctx.fill();
      /* 右崖 */
      ctx.fillStyle = '#847860';
      ctx.beginPath();
      ctx.moveTo(860, 128); ctx.lineTo(640, 128); ctx.lineTo(700, 210); ctx.lineTo(790, 236); ctx.lineTo(860, 240);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9a8e74';
      ctx.beginPath();
      ctx.moveTo(860, 128); ctx.lineTo(716, 128); ctx.lineTo(756, 196); ctx.lineTo(820, 216); ctx.lineTo(860, 218);
      ctx.closePath(); ctx.fill();
      /* 山道（两段折线带） */
      ctx.strokeStyle = '#c2ad80'; ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(400, 258); ctx.quadraticCurveTo(430, 208, 428, 176); ctx.stroke();
      ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(428, 180); ctx.quadraticCurveTo(426, 152, 400, 132); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,98,60,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(392, 246); ctx.quadraticCurveTo(416, 210, 414, 178); ctx.stroke();
      /* 松树点缀 */
      drawTree(ctx, 250, 156, 0.7);
      drawTree(ctx, 620, 158, 0.72);
      drawTree(ctx, 96, 148, 0.6);
      /* 远处寨门（细看才见） */
      ctx.fillStyle = 'rgba(90,66,38,.85)';
      ctx.fillRect(392, 118, 26, 18);
      ctx.fillStyle = 'rgba(120,92,52,.85)';
      ctx.fillRect(388, 114, 34, 6);
      dot(ctx, 405, 108, 3, '#b5453a');
    },

    /* 沼泽 · 寻宝（水洼 + 枯木 + 雾带） */
    marsh: function (ctx, sd) {
      sSky(ctx, '#9fae9a', '#dadec6');
      sSun(ctx, 660, 52, 15, 'rgba(240,238,214,.8)', 'rgba(235,235,214,.3)');
      sRidge(ctx, 118, 30, '#7f8f76', sd);
      sGround(ctx, 128, '#5e6b47', '#48543a');
      var pools = [[130, 200, 96, 26], [400, 226, 120, 30], [660, 204, 104, 27], [780, 244, 90, 22]];
      for (var p = 0; p < pools.length; p++) {
        var po = pools[p];
        ctx.fillStyle = '#557064';
        ctx.beginPath(); ctx.ellipse(po[0], po[1], po[2], po[3], 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4a6357';
        ctx.beginPath(); ctx.ellipse(po[0], po[1] + 3, po[2] * 0.72, po[3] * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(po[0] - po[2] * 0.2, po[1], po[2] * 0.4, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      }
      /* 芦苇丛（三处） */
      var cl = [[70, 224], [310, 196], [730, 214]];
      for (var c = 0; c < cl.length; c++) {
        for (var i = 0; i < 4; i++) {
          var rx = cl[c][0] + i * 13, ry = cl[c][1] + (i % 2) * 6;
          seg(ctx, rx, ry, rx - 4, ry - 40 - (i % 3) * 8, 'rgba(88,116,52,.9)', 2.2);
          dot(ctx, rx - 5, ry - 42 - (i % 3) * 8, 3, '#a8894a');
        }
      }
      /* 枯木 */
      seg(ctx, 560, 216, 566, 128, '#6a5a42', 7);
      seg(ctx, 564, 176, 528, 150, '#6a5a42', 4);
      seg(ctx, 565, 156, 604, 136, '#6a5a42', 4);
      seg(ctx, 530, 150, 512, 138, '#6a5a42', 2.5);
      seg(ctx, 604, 136, 622, 122, '#6a5a42', 2.5);
      /* 雾带 */
      ctx.fillStyle = 'rgba(226,232,222,.22)';
      ctx.fillRect(0, 148, SCENE_W, 22);
      ctx.fillStyle = 'rgba(226,232,222,.14)';
      ctx.fillRect(0, 184, SCENE_W, 16);
      /* 锈戟（插在泥里的旧兵器） */
      seg(ctx, 226, 224, 238, 168, 'rgba(90,84,74,.9)', 3);
      ctx.fillStyle = 'rgba(120,110,96,.9)';
      ctx.beginPath(); ctx.moveTo(238, 168); ctx.lineTo(250, 174); ctx.lineTo(236, 182); ctx.closePath(); ctx.fill();
    },

    /* 地宫 · 探险（沙丘 + 石门 + 断柱） */
    ruin: function (ctx, sd) {
      sSky(ctx, '#e8d9a8', '#f9efd8');
      sSun(ctx, 690, 46, 20, '#fff2cc', 'rgba(255,242,204,.5)');
      sCloud(ctx, 200, 38, 0.7, 'rgba(255,255,255,.5)');
      /* 沙丘两层 */
      ctx.fillStyle = '#e2c98c';
      ctx.beginPath(); ctx.moveTo(-10, 200);
      ctx.quadraticCurveTo(180, 116, 420, 196);
      ctx.quadraticCurveTo(650, 250, 870, 186);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d9bd7d';
      ctx.beginPath(); ctx.moveTo(-10, 232);
      ctx.quadraticCurveTo(240, 178, 520, 236);
      ctx.quadraticCurveTo(700, 268, 870, 228);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      /* 沙纹 */
      ctx.strokeStyle = 'rgba(160,124,56,.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(70, 224); ctx.quadraticCurveTo(110, 218, 150, 224); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(600, 214); ctx.quadraticCurveTo(640, 208, 680, 214); ctx.stroke();
      /* 石门（半埋） */
      ctx.fillStyle = '#b7a37e';
      ctx.fillRect(316, 118, 128, 96);
      ctx.fillStyle = '#3f3a33';
      ctx.beginPath();
      ctx.moveTo(344, 214); ctx.lineTo(344, 152);
      ctx.quadraticCurveTo(380, 122, 416, 152);
      ctx.lineTo(416, 214); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8d7c5c';
      ctx.fillRect(308, 108, 144, 14);
      /* 门前石阶 */
      ctx.fillStyle = '#c8b48c';
      ctx.fillRect(330, 214, 100, 9);
      ctx.fillStyle = '#b7a37e';
      ctx.fillRect(322, 223, 116, 9);
      /* 断柱两根 */
      ctx.fillStyle = '#a89676';
      ctx.fillRect(560, 158, 22, 60);
      ctx.fillStyle = '#bda98a';
      ctx.fillRect(560, 150, 22, 10);
      seg(ctx, 564, 182, 578, 194, 'rgba(70,60,44,.4)', 2);
      ctx.fillStyle = '#a89676';
      ctx.fillRect(672, 186, 20, 42);
      ctx.fillStyle = '#bda98a';
      ctx.fillRect(672, 180, 20, 8);
      /* 散落石块 */
      dot(ctx, 250, 236, 7, '#c0aa80'); dot(ctx, 470, 244, 9, '#c0aa80');
      dot(ctx, 740, 238, 6, '#c0aa80'); dot(ctx, 120, 244, 8, '#c0aa80');
    },

    /* 行猎 · 森林（密林 + 兽迹 + 光斑） */
    hunt: function (ctx, sd) {
      sSky(ctx, '#bcd0b0', '#eaf2dc');
      sSun(ctx, 180, 42, 15, '#fff6d2', 'rgba(255,248,214,.45)');
      sRidge(ctx, 118, 30, '#8ea585', sd);
      sGround(ctx, 128, '#5f7a3c', '#4b6430');
      drawTree(ctx, 70, 150, 0.85);
      drawTree(ctx, 190, 142, 0.95);
      drawTree(ctx, 320, 148, 0.8);
      drawTree(ctx, 470, 140, 1.0);
      drawTree(ctx, 620, 148, 0.88);
      drawTree(ctx, 760, 142, 0.98);
      drawTree(ctx, 130, 210, 1.2);
      drawTree(ctx, 400, 216, 1.3);
      drawTree(ctx, 700, 212, 1.15);
      /* 光斑 */
      ctx.fillStyle = 'rgba(255,250,214,.16)';
      ctx.beginPath(); ctx.moveTo(300, 0); ctx.lineTo(380, 0); ctx.lineTo(260, SCENE_H); ctx.lineTo(196, SCENE_H); ctx.closePath(); ctx.fill();
      /* 鹿（中景剪影） */
      ctx.fillStyle = '#6b4f2f';
      ctx.beginPath(); ctx.ellipse(604, 196, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(622, 190); ctx.lineTo(636, 172); ctx.lineTo(644, 174);
      ctx.lineTo(632, 194); ctx.closePath(); ctx.fill();
      ctx.fillRect(586, 204, 4, 18); ctx.fillRect(600, 204, 4, 18);
      ctx.fillRect(616, 204, 4, 18); ctx.fillRect(626, 204, 4, 16);
      seg(ctx, 638, 172, 646, 162, '#6b4f2f', 2);
      seg(ctx, 644, 172, 652, 164, '#6b4f2f', 2);
      /* 兽迹 */
      dot(ctx, 262, 240, 3, 'rgba(70,54,30,.55)');
      dot(ctx, 278, 232, 2.6, 'rgba(70,54,30,.5)');
      dot(ctx, 296, 228, 2.6, 'rgba(70,54,30,.45)');
      dot(ctx, 316, 224, 2.2, 'rgba(70,54,30,.4)');
    },

    /* 草原 · 牧马（大天 + 草浪 + 马群剪影） */
    steppe: function (ctx, sd) {
      sSky(ctx, '#a8cbe4', '#ecf6fa');
      sSun(ctx, 700, 46, 17, '#fffbe0', 'rgba(255,251,224,.4)');
      sCloud(ctx, 180, 44, 1.25, 'rgba(255,255,255,.9)');
      sCloud(ctx, 470, 30, 0.95, 'rgba(255,255,255,.8)');
      sCloud(ctx, 740, 58, 0.7, 'rgba(255,255,255,.7)');
      /* 两道草浪 */
      ctx.fillStyle = '#b6c88e';
      ctx.beginPath(); ctx.moveTo(-10, 170);
      ctx.quadraticCurveTo(220, 132, 470, 168);
      ctx.quadraticCurveTo(690, 198, 870, 160);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a2b871';
      ctx.beginPath(); ctx.moveTo(-10, 208);
      ctx.quadraticCurveTo(260, 178, 520, 210);
      ctx.quadraticCurveTo(720, 234, 870, 204);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8ea757';
      ctx.beginPath(); ctx.moveTo(-10, 244);
      ctx.quadraticCurveTo(300, 224, 560, 248);
      ctx.quadraticCurveTo(760, 264, 870, 246);
      ctx.lineTo(870, SCENE_H); ctx.lineTo(-10, SCENE_H);
      ctx.closePath(); ctx.fill();
      /* 马群剪影（三匹，远小近大） */
      function horse(x, y, s, col) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(x, y, 22 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 16 * s, y - 5 * s); ctx.lineTo(x + 30 * s, y - 19 * s);
        ctx.lineTo(x + 36 * s, y - 15 * s); ctx.lineTo(x + 24 * s, y + 1 * s);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 16 * s, y + 6 * s, 3.4 * s, 15 * s);
        ctx.fillRect(x - 6 * s, y + 7 * s, 3.4 * s, 14 * s);
        ctx.fillRect(x + 6 * s, y + 6 * s, 3.4 * s, 15 * s);
        ctx.fillRect(x + 15 * s, y + 6 * s, 3.2 * s, 14 * s);
        seg(ctx, x + 34 * s, y - 17 * s, x + 40 * s, y - 27 * s, col, 2 * s);
      }
      horse(150, 214, 0.7, 'rgba(74,84,104,.72)');
      horse(216, 222, 0.9, 'rgba(66,76,96,.85)');
      horse(700, 218, 0.8, 'rgba(74,84,104,.8)');
      horse(626, 232, 1.05, 'rgba(58,68,88,.92)');
      /* 草簇 */
      var t2 = [[70, 256, 1.1], [320, 250, 1.0], [470, 244, 0.9], [560, 254, 1.05], [800, 248, 1.0], [360, 258, 1.1]];
      for (var i = 0; i < t2.length; i++) grassTuft(ctx, t2[i][0], t2[i][1], t2[i][2]);
      /* 飞鸟 */
      seg(ctx, 260, 70, 272, 64, 'rgba(70,90,110,.55)', 2);
      seg(ctx, 272, 64, 284, 70, 'rgba(70,90,110,.55)', 2);
      seg(ctx, 316, 84, 326, 79, 'rgba(70,90,110,.45)', 1.7);
      seg(ctx, 326, 79, 336, 84, 'rgba(70,90,110,.45)', 1.7);
    },

    /* 演武场 · 切磋（夯土场 + 兵器架 + 木桩 + 旗） */
    yard: function (ctx, sd) {
      sSky(ctx, '#d8d2c0', '#f4efe2');
      sSun(ctx, 660, 48, 17, '#fdf0c8', 'rgba(255,242,204,.4)');
      sCloud(ctx, 230, 40, 0.8, 'rgba(255,255,255,.7)');
      sRidge(ctx, 120, 30, '#a8a08c', sd);
      sGround(ctx, 130, '#b6a67c', '#9c8c64');
      /* 场边矮墙 */
      ctx.fillStyle = '#a2946c';
      ctx.fillRect(0, 168, SCENE_W, 26);
      ctx.fillStyle = '#8f8159';
      ctx.fillRect(0, 190, SCENE_W, 6);
      /* 兵器架 ×2 */
      function rack(x, y) {
        seg(ctx, x, y, x, y - 54, '#6b4f2c', 5);
        seg(ctx, x + 46, y, x + 46, y - 54, '#6b4f2c', 5);
        seg(ctx, x - 6, y - 40, x + 52, y - 40, '#7a5a33', 5);
        for (var i = 0; i < 3; i++) {
          var sx = x + 6 + i * 16;
          seg(ctx, sx, y - 38, sx - 5, y - 74, 'rgba(96,88,76,.95)', 3);
          dot(ctx, sx - 5, y - 76, 3, '#9aa0a8');
        }
      }
      rack(218, 226); rack(636, 226);
      /* 木桩（人形靶） */
      ctx.fillStyle = '#7a5a33';
      ctx.fillRect(392, 176, 14, 66);
      ctx.fillRect(360, 192, 78, 10);
      dot(ctx, 399, 168, 15, '#c9b06a');
      seg(ctx, 380, 200, 372, 190, 'rgba(90,66,36,.8)', 3);
      /* 旗杆 */
      sFlag(ctx, 762, 226, 96, '#b5453a', '#5c4a30');
      /* 地面磨痕 */
      ctx.strokeStyle = 'rgba(120,100,64,.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(420, 236, 66, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(430, 246, 90, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    },
  };

  /* 对外出口：把 12 种场景画到任意 2D 上下文上。
     seed 传格子坐标（确定性）；ctx 缺失（测试桩）时静默跳过。 */
  GAME.map.SCENE_KEYS = ['lake', 'fort', 'array', 'meadow', 'grove', 'cottage',
    'road', 'marsh', 'ruin', 'hunt', 'steppe', 'yard'];
  GAME.map.paintScene = function (ctx, scene, seed) {
    if (!ctx) return false;
    var fn = SCENE_PAINT[scene] || SCENE_PAINT.meadow;
    if (!fn) return false;
    /* DPR 2 倍绘制：save + scale + restore（不用仿射矩阵与旋转变换 ——
       v50 守卫规定等距绘制必须正交铺贴 + 菱形裁切，误差不许靠变换累积） */
    if (ctx.save) ctx.save();
    if (ctx.scale) ctx.scale(2, 2);
    ctx.clearRect(0, 0, SCENE_W, SCENE_H);
    fn(ctx, (seed | 0) || 7);
    if (ctx.restore) ctx.restore();
    return true;
  };
  GAME.map.SCENE_W = SCENE_W;
  GAME.map.SCENE_H = SCENE_H;

'''

anchor = "  /* 距离（曼哈顿） */\n})();"
assert d.count(anchor) == 1, '锚点命中 %d 次' % d.count(anchor)

if 'GAME.map.paintScene' in d:
    print('SKIP v89.2 场景插画已存在')
else:
    d = d.replace(anchor, SEC + anchor, 1)
    io.open(P, 'w', encoding='utf-8', newline='').write(d)
    print('OK v89.2 场景插画已写入')

d2 = io.open(P, encoding='utf-8', newline='').read()
print('paintScene:', d2.count('GAME.map.paintScene'), '| 场景数:', d2.count('SCENE_PAINT[') + len(__import__('re').findall(r"\n    [a-z]+: function \(ctx, sd\)", d2)))
print('map.js 行数:', d2.count(chr(10)) + 1)

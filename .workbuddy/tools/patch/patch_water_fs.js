/* 海面第二刀：细浪从"顶点位移"改到"像素级法线扰动"。
 *
 * 为什么：水面网格是**每格 7 个顶点**（六边形中心 + 6 个沿），比一格还小的浪
 *   在几何上根本表达不出来，只会被采样成"整格一个大斜面"→ 屏幕上就是大块软斑
 *   （老板说的"太规整太明显"）。几何留给**涌浪**（大尺度），细浪交给片元着色器
 *   逐像素算法线扰动 —— 分辨率够了，也不会再有"斑点阵列"。
 * 代价：片元里 3 次 1 阶值噪声（≈24 次哈希），只在有水像素上跑。
 *
 * 用法：node .workbuddy/tools/patch/patch_water_fs.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var P = path.join(ROOT, 'js', 'map3d.js');
var s = fs.readFileSync(P, 'utf8');
var changed = 0;

function rep(from, to) {
  if (s.indexOf(from) < 0) { console.error('!! 锚点缺失：' + from.slice(0, 40)); return; }
  s = s.replace(from, to);
  changed++;
}

/* ① 顶点着色器：把世界位置传给片元 */
rep(
  "        'varying vec3 vN; varying vec3 vView;',\n        /* ============================================================\n         * v155d",
  "        'varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vFar;',\n        /* ============================================================\n         * v155d"
);
rep(
  "        '  vCoast = uCoast;',\n        '  vec3 P  = surf(d, uCoast);',",
  "        '  vCoast = uCoast;',\n        '  vFar = uFar;',\n        '  vec3 P  = surf(d, uCoast);',\n        '  vW = P;',"
);

/* ② 片元着色器：重写 —— 细浪在像素级做法线扰动 */
var fstart = s.indexOf("      var marineFS = [");
var fend = s.indexOf("      ].join('\\n');", fstart);
if (fstart < 0 || fend < 0) { console.error('!! 找不到 marineFS'); process.exit(1); }

var L = [];
function q(x) { L.push("        '" + x + "',"); }
L.push('      var marineFS = [');
q('uniform vec3 uColor;');
q('uniform float uTime;');
q('varying vec3 vN; varying vec3 vView; varying vec3 vW; varying float vFar;');
q('');
q('/* 与顶点着色器同一套哈希噪声（GLSL 不能 include，只能各写一份） */');
q('float hash13(vec3 p){');
q('  p = fract(p * 0.1031);');
q('  p += dot(p, p.yzx + 33.33);');
q('  return fract((p.x + p.y) * p.z);');
q('}');
q('float vn(vec3 x){');
q('  vec3 i = floor(x), f = fract(x);');
q('  f = f * f * (3.0 - 2.0 * f);');
q('  float n000 = hash13(i),                      n100 = hash13(i + vec3(1.0, 0.0, 0.0));');
q('  float n010 = hash13(i + vec3(0.0, 1.0, 0.0)),  n110 = hash13(i + vec3(1.0, 1.0, 0.0));');
q('  float n001 = hash13(i + vec3(0.0, 0.0, 1.0)),  n101 = hash13(i + vec3(1.0, 0.0, 1.0));');
q('  float n011 = hash13(i + vec3(0.0, 1.0, 1.0)),  n111 = hash13(i + vec3(1.0, 1.0, 1.0));');
q('  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),');
q('             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);');
q('}');
q('/* 细浪高度场：两层不同尺度、不同流速 —— 非周期，不会出现"斑点阵列" */');
q('float rip(vec3 p){');
q('  float a = vn(p * 0.62 + vec3(0.0, 0.0, uTime * 0.55));');
q('  float b = vn(p * 1.55 - vec3(0.0, 0.0, uTime * 0.83) + 13.7);');
q('  return a * 0.65 + b * 0.35;');
q('}');
q('');
q('void main(){');
q('  vec3 N = normalize(vN);');
q('  vec3 V = normalize(-vView);');
q('  /* 切平面基：在球面上 perturN 必须沿切向做，否则会被当成"法线歪了" */');
q('  vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.0) + vec3(0.0001)));');
q('  vec3 B = cross(N, T);');
q('  /* 像素级细浪：三采样求梯度（正中央 + 沿 T/B 各一步） */');
q('  float e = 0.55;');
q('  float h0 = rip(vW);');
q('  float hT = rip(vW + T * e);');
q('  float hB = rip(vW + B * e);');
q('  /* vFar：远景把细浪淡掉（否则整片海在闪 = 又变成"规整的噪点"） */');
q('  float amp = 0.42 * clamp(vFar, 0.0, 1.0);');
q('  N = normalize(N - (hT - h0) / e * T * amp - (hB - h0) / e * B * amp);');
q('  /* 主光：画面左上方（与场景太阳一致的方向感） */');
q('  vec3 Ld = normalize(vec3(0.45, 0.80, 0.40));');
q('  float diff = max(dot(N, Ld), 0.0);');
q('  /* 镜面：浪脊上的反光才是"水"的读法（只有 diffuse 会像一块布） */');
q('  vec3 H = normalize(Ld + V);');
q('  float spec = pow(max(dot(N, H), 0.0), 42.0);');
q('  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);');
q('  vec3 col = uColor * (0.55 + 0.55 * diff);');
q('  col += vec3(0.95, 0.97, 1.00) * spec * 0.34;');
q('  col += vec3(0.12, 0.20, 0.28) * fres;');
q('  gl_FragColor = vec4(col, 1.0);');
q('}');
L.push("      ].join('\\n');");

s = s.slice(0, fstart) + L.join('\n') + '\n' + s.slice(fend);

fs.writeFileSync(P, s, 'utf8');
console.log('片元着色器已重写 · 替换点数=' + changed);

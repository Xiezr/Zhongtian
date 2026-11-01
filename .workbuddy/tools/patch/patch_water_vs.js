/* 一次性补丁：把海面顶点着色器的"5 条正弦"换成"值噪声 fbm + 噪声域扭曲"。
 * 只在 v156.22 用；改完保留本文件当"当时怎么换的"的证据。
 * 用法：node .workbuddy/tools/patch/patch_water_vs.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..', '..');
var P = path.join(ROOT, 'js', 'map3d.js');
var s = fs.readFileSync(P, 'utf8');

var A = s.indexOf('        /* ============================================================\n         * v155g（老板：「波浪现在是规律性的」）');
var B = s.indexOf("        'void main(){',", A);
if (A < 0 || B < 0) { console.error('锚点没找到 A=' + A + ' B=' + B); process.exit(1); }

var L = [];
function q(x) { L.push("        '" + x + "',"); }

L.push('        /* ============================================================');
L.push('         * v156.22（老板：「海波还是有点太规整太明显了」）');
L.push('         * ------------------------------------------------------------');
L.push('         * 实测 A/B（同机位、只把 uAmp 从 3.2 改 0）：关浪是一片干净深蓝；开浪则整片');
L.push('         * 海面浮着一层**规则的大斑块**。根因不是振幅，是**形状**：');
L.push('         *   · 5 条固定方向的正弦叠加 → 相位线性 → 等相位线是**平行直线**；');
L.push('         *   · 域扭曲用的也是 3 条慢正弦（周期 300+ 单位）→ 扭曲本身同样规则，');
L.push('         *     只是把"直条纹"弯成"弯条纹"，规律感一点没少。');
L.push('         * 正解：换**值噪声 fbm**（哈希噪声，天生非周期），并让噪声自己扭曲自己。');
L.push('         *   GLSL 里哈希噪声比三角函数还便宜（只有乘加、没有 sin），13 万顶点撑得住。');
L.push('         * 分层：base(涌浪 ~12 单位) + mid(~5) + chop(~2.2)，权重递减；');
L.push('         *   振幅再乘 uFar（按镜头距离轻微衰减）—— 远景本就不该看得见小浪。');
L.push('         * ============================================================ */');
q('float hash13(vec3 p){');
q('  p = fract(p * 0.1031);');
q('  p += dot(p, p.yzx + 33.33);');
q('  return fract((p.x + p.y) * p.z);');
q('}');
q('float vn(vec3 x){');
q('  vec3 i = floor(x), f = fract(x);');
q('  f = f * f * (3.0 - 2.0 * f);');
q('  float n000 = hash13(i),                     n100 = hash13(i + vec3(1.0, 0.0, 0.0));');
q('  float n010 = hash13(i + vec3(0.0, 1.0, 0.0)), n110 = hash13(i + vec3(1.0, 1.0, 0.0));');
q('  float n001 = hash13(i + vec3(0.0, 0.0, 1.0)), n101 = hash13(i + vec3(1.0, 0.0, 1.0));');
q('  float n011 = hash13(i + vec3(0.0, 1.0, 1.0)), n111 = hash13(i + vec3(1.0, 1.0, 1.0));');
q('  return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),');
q('             mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);');
q('}');
q('float fbm2(vec3 p){ return 0.62 * vn(p) + 0.38 * vn(p * 2.13 + 7.3); }');
L.push('        /* 域扭曲：用噪声推噪声（不是用正弦推正弦）—— "不规整"的关键就是这一步 */');
q('vec3 warp(vec3 q, float t){');
q('  return q + (vec3(');
q('    vn(q * 0.55 + vec3(0.0, 0.0, t * 0.050)),');
q('    vn(q * 0.55 + vec3(5.2, 1.3, -t * 0.045)),');
q('    vn(q * 0.55 + vec3(11.7, 9.1, t * 0.038))) - 0.5) * 1.35;');
q('}');
q('float h(vec3 P, float t){');
q('  vec3 Q = warp(P * 0.085, t);');
q('  float base = fbm2(Q) - 0.5;');
q('  float mid  = vn(Q * 2.40 + vec3(0.0, 0.0, t * 0.120)) - 0.5;');
q('  float chop = vn(Q * 6.10 - vec3(0.0, 0.0, t * 0.210)) - 0.5;');
q('  return (base + mid * 0.45 + chop * 0.18) * 2.0;');
q('}');
L.push('        /* 快波：求法线用（少一层 chop，视觉无差别） */');
q('float hf(vec3 P, float t){');
q('  vec3 Q = warp(P * 0.085, t);');
q('  float base = fbm2(Q) - 0.5;');
q('  float mid  = vn(Q * 2.40 + vec3(0.0, 0.0, t * 0.120)) - 0.5;');
q('  return (base + mid * 0.45) * 2.0;');
q('}');
q('vec3 surfF(vec3 d, float c, float t){ vec3 P = d * uR; float k = smoothstep(0.0, 0.55, c); return d * (uR + hf(P, t) * uAmp * k * uFar); }');
q('vec3 surf(vec3 d, float c){ vec3 P = d * uR; float k = smoothstep(0.0, 0.55, c); return d * (uR + h(P, uTime) * uAmp * k * uFar); }');
L.push('');

s = s.slice(0, A) + L.join('\n') + '\n' + s.slice(B);
fs.writeFileSync(P, s, 'utf8');
console.log('已替换波形函数（' + L.length + ' 行）');

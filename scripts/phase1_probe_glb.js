#!/usr/bin/env node
// Phase 1 pilot · GLB PBR 通道探针
// 验证 v157.58 解析器（js/gltf.js GTF.parse）能识别的 PBR 通道：
//   base = baseColorTexture
//   mr   = metallicRoughnessTexture（ORM 合一，v157.58 从中拆 metalnessMap/roughnessMap）
//   normal / ao(occlusionTexture) / emissive(emissiveTexture) / emissiveF(emissiveFactor)
// 用法：node scripts/phase1_probe_glb.js [额外路径...]
// 带下限校验（files.length 打印），避免空目录产生「全绿」平凡解。
const fs = require('fs'), path = require('path');
const ROOT = __dirname.replace(/[\\/]scripts$/, '');
function walk(d, out) {
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (/\.glb$/i.test(e.name) || /\.gltf$/i.test(e.name)) out.push(p);
    }
  } catch (e) {}
  return out;
}
/* .gltf（JSON + 外部 .bin / 贴图）：只解析 JSON 抽 PBR 通道，不校验外部资源是否齐 */
function probeGltf(p) {
  let json;
  try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { file: p, err: 'json parse' }; }
  const mats = json.materials || [];
  const ext = (json.extensionsUsed || []).join(',');
  const hit = {};
  mats.forEach(m => {
    const pbr = m.pbrMetallicRoughness || {};
    if (pbr.baseColorTexture) hit.base = 1;
    if (pbr.metallicRoughnessTexture) hit.mr = 1;
    if (m.normalTexture) hit.normal = 1;
    if (m.occlusionTexture) hit.ao = 1;
    if (m.emissiveTexture) hit.emissive = 1;
    const ef = m.emissiveFactor || [];
    if (ef[0] || ef[1] || ef[2]) hit.emissiveF = 1;
  });
  const imgs = json.images || [];
  return { file: p.replace(ROOT, ''), meshes: mats.length, ext: 'gltf:' + ext,
    channels: Object.keys(hit).join('+') || 'none', note: imgs.length + ' imgs(外部资源需齐)' };
}
function probe(p) {
  if (/\.gltf$/i.test(p)) return probeGltf(p);
  let b;
  try { b = fs.readFileSync(p); } catch (e) { return { file: p, err: 'read fail' }; }
  if (b.length < 20 || b.readUInt32LE(0) !== 0x46546C67) return { file: p, err: 'not glb' };
  const clen = b.readUInt32LE(12), ctype = b.readUInt32LE(16);
  if (ctype !== 0x4E4F534A) return { file: p, err: 'no JSON chunk' };
  let json;
  try { json = JSON.parse(b.slice(20, 20 + clen).toString('utf8')); } catch (e) { return { file: p, err: 'json parse' }; }
  const mats = json.materials || [];
  const ext = (json.extensionsUsed || []).join(',');
  const hit = {};
  mats.forEach(m => {
    const pbr = m.pbrMetallicRoughness || {};
    if (pbr.baseColorTexture) hit.base = 1;
    if (pbr.metallicRoughnessTexture) hit.mr = 1;
    if (m.normalTexture) hit.normal = 1;
    if (m.occlusionTexture) hit.ao = 1;
    if (m.emissiveTexture) hit.emissive = 1;
    const ef = m.emissiveFactor || [];
    if (ef[0] || ef[1] || ef[2]) hit.emissiveF = 1;
  });
  return { file: p.replace(ROOT, ''), meshes: mats.length, ext, channels: Object.keys(hit).join('+') || 'none' };
}
const extra = process.argv.slice(2);
let files = walk(path.join(ROOT, 'assets'), []);
extra.forEach(a => {
  if (fs.existsSync(a)) {
    const s = fs.statSync(a);
    files = s.isDirectory() ? walk(a, files) : files.concat(a);
  }
});
console.log('GLB 文件数:', files.length);
console.log('file | meshes | extensions | PBR channels (v157.58 GTF.parse 可抽取)');
console.log('---');
let nBase = 0, nMr = 0, nNormal = 0, nAo = 0, nEmis = 0;
files.forEach(f => {
  const r = probe(f);
  if (r.err) { console.log(r.file, 'ERR:', r.err); return; }
  console.log([r.file, r.meshes, r.ext, r.channels, r.note || ''].join(' | '));
  if (r.channels.includes('base')) nBase++;
  if (r.channels.includes('mr')) nMr++;
  if (r.channels.includes('normal')) nNormal++;
  if (r.channels.includes('ao')) nAo++;
  if (r.channels.includes('emissive')) nEmis++;
});
console.log('---');
console.log(`汇总: base=${nBase} mr(ORM)=${nMr} normal=${nNormal} ao=${nAo} emissive=${nEmis} / 共 ${files.length}`);
console.log('注: v157.58 解析器抽 metalnessMap/roughnessMap(来自 mr) + aoMap + emissiveMap + normalMap；');
console.log('    现有资产多含 mr+normal，ao/emissive 为空则该通道降级（不报错）。');
console.log('    纹理多为 EXT_texture_webp，浏览器原生解码，无需解析器特判。');

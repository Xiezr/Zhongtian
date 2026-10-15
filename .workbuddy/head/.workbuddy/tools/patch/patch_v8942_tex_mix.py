# -*- coding: utf-8 -*-
"""v89.42 补丁 3：texVariant 换 32 位混合哈希
旧式 (gx*A)^(gy*B) 实测呈 4 周期对角规律（3,2,1,0 循环）——会形成新的规律感；
换 Math.imul 乘-异或-右移混合（伪随机、确定性、跨引擎一致）。
"""
import io, os, sys, subprocess

R = r'E:\Deepseekdb'
M = R + r'\js\map.js'


def read(p):
    return io.open(p, encoding='utf-8', newline='').read()


def write(p, s):
    tmp = p + '.tmp8942b'
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


edit(M, r"""  function texVariant(gx, gy) {
    var h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
    return (h >>> 5) & 3;
  }""",
     r"""  function texVariant(gx, gy) {
    /* 32 位混合哈希（Math.imul = 精确 32 位乘法，无浮点精度损耗）：
       乘-异或-右移两轮 —— 伪随机、确定性、跨引擎一致。
       （首版 (gx*A)^(gy*B) 实测呈 4 周期对角规律，等于把"墙纸感"换成了"条纹感"。） */
    var h = Math.imul(gx, 0x27d4eb2d) ^ Math.imul(gy, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x2545f491);
    return ((h ^ (h >>> 13)) >>> 4) & 3;
  }""",
     'map.js · texVariant 混合哈希')

print('--- 语法检查 ---')
r = subprocess.run(['node', '--check', M], capture_output=True, text=True)
print('node --check rc=%d %s' % (r.returncode, (r.stderr or '').strip()[:200]))

# 分布与周期性核验
probe = r"""
function texVariant(gx, gy) {
  var h = Math.imul(gx, 0x27d4eb2d) ^ Math.imul(gy, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 4) & 3;
}
var dist = [0,0,0,0], n = 0, sameRight = 0;
for (var y = 0; y < 500; y += 3) for (var x = 0; x < 500; x += 3) {
  dist[texVariant(x,y)]++; n++;
  if (x < 499 && texVariant(x,y) === texVariant(x+1,y)) sameRight++;
}
console.log('dist=' + JSON.stringify(dist) + ' n=' + n);
console.log('右邻同变体率=' + (sameRight / n * 100).toFixed(1) + '%（理论 25%）');
var row = [];
for (var x = 30; x < 60; x++) row.push(texVariant(x, 40));
console.log('样例行 y=40 x30..59: ' + row.join(','));
"""
io.open(R + r'\.workbuddy\tmp\_vcheck.js', 'w', encoding='utf-8').write(probe)
r2 = subprocess.run(['node', R + r'\.workbuddy\tmp\_vcheck.js'], capture_output=True, text=True)
print(r2.stdout)

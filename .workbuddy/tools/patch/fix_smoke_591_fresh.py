# -*- coding: utf-8 -*-
"""修 §591④：把"索引新鲜度"从"跟 bundle.hash 比"改成"跟**当前源码**重算比"。

踩到的坑（必须记进注释）：
  第一版写 `MD.sourceHash === bundle.hash`。两个值都是**上一次**的快照 ——
  改了源码却既没重跑索引、也没重新构建时，它们依然相等，断言照样绿。
  这是典型的平凡解：比较两个陈旧值，只能证明"它们一样旧"。
  正确判据必须引入**外部真值**：拿当前源码现场重算一遍。
"""
import io

P = 'smoke-test.js'
s = io.open(P, encoding='utf-8', newline='\n').read()

start_mark = '    /* ④ 不过期：'
end_mark = "      + '（源码改了就重跑 gen_index.js 再 build_bundle.py）');"

i = s.find(start_mark)
assert i >= 0, '④ 段没找到'
j = s.find(end_mark, i)
assert j >= 0, '④ 段结尾没找到'
j += len(end_mark)

NEW = '''    /* ④ 不过期 —— 判据必须是"和**当前源码**比"，不是"和 bundle.hash 比"。
         踩过的坑：第一版写 `MD.sourceHash === bundle.hash`，两个都是上一次的快照，
         改了源码却既不重跑索引也不重新构建时，它们**依然相等**，断言照样绿。
         比较两个陈旧值只能证明"它们一样旧" —— 平凡解。
         现在现场把 86 个文件重算一遍（约 100ms），与索引里记的指纹对。 */
    var crypto = require('crypto');
    var hh = crypto.createHash('sha256');
    MD.layout.order.forEach(function (n) {
      var fp = pth.join(__dirname, 'js', n + '.js');
      if (!fsx.existsSync(fp)) return;
      hh.update(n, 'utf8');
      hh.update('\\0');
      hh.update(fsx.readFileSync(fp).toString('utf8').replace(/\\r\\n/g, '\\n'), 'utf8');
    });
    var nowHash = hh.digest('hex').slice(0, 16);
    check('§591④ 索引未过期（sourceHash == 当前源码重算值）',
      nowHash === MD.sourceHash,
      'index=' + MD.sourceHash + ' now=' + nowHash
      + (nowHash === MD.sourceHash ? '' : '　← 源码改过，跑 node .workbuddy/tools/map/gen_index.js'));'''

s = s[:i] + NEW + s[j:]
io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
print('✓ §591④ 改成对当前源码重算')

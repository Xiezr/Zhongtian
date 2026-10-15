# -*- coding: utf-8 -*-
"""
v89.105 修复：令牌自引用（第一轮按值替换误伤 :root 定义）
============================================================
病根：间距/圆角那两趟是按**属性名**白名单走的（`--sp-1: 4px;` 的属性名是 `--sp-1`，
不在白名单里，天然安全）；但**颜色那趟是按值替换**（把 `#5c1a10` 换成
`var(--red-deep)`），于是 `:root { --red-deep: #5c1a10; }` 被改成
`--red-deep: var(--red-deep);` —— **自引用令牌**，CSS 里等于没有值。

教训：**"按值替换"必须排除定义块**。本脚本从备份把原值取回，做定点修复；
同时把这条规矩写进第二轮脚本（跳过 :root 段）。
"""
import io, os, re

R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SRC = os.path.join(R, 'index.html')
BAK = os.path.join(R, '.workbuddy', 'backup', 'index.v89105-before-tokens.html')

cur = io.open(SRC, encoding='utf-8').read()
ori = io.open(BAK, encoding='utf-8').read()

# 原档的令牌值表
root = re.search(r':root\s*\{(.*?)\n  \}', ori, re.S).group(1)
orig_tok = {}
for mm in re.finditer(r'--([a-z0-9-]+)\s*:\s*([^;]+);', root):
    orig_tok[mm.group(1)] = mm.group(2).strip()
print('原档令牌 %d 个' % len(orig_tok))

# 找自引用：--X: var(--X);
bad = []
def fix(mm):
    name = mm.group(1)
    if name in orig_tok:
        bad.append((name, orig_tok[name]))
        return '    --%s: %s;' % (name, orig_tok[name])
    return mm.group(0)

cur2 = re.sub(r'[ \t]*--([a-z0-9-]+)\s*:\s*var\(--\1\)\s*;', fix, cur)

print('修复自引用 %d 处：' % len(bad))
for n, v in bad:
    print('  --%s ← %s' % (n, v))

if bad:
    if cur2.count('{') == cur2.count('}'):
        io.open(SRC, 'w', encoding='utf-8', newline='').write(cur2)
        print('已写入（括号配平 ✅）')
    else:
        print('❌ 括号不配平，未写盘')
else:
    print('无自引用，未改动')

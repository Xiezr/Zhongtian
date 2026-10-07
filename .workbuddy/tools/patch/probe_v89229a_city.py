# -*- coding: utf-8 -*-
# v89.229 探针 A：城视图建筑格渲染现状（名称/等级位置 + 地块色）
import io, re
BASE = 'E:/Deepseekdb/'

def rd(p): return io.open(BASE + p, encoding='utf-8', newline='').read()

u = rd('js/ui.js')
h = rd('index.html')

print('=' * 30, 'A1 城内格渲染函数', '=' * 30)
# 找 isoCell / buildCell 类函数
for m in re.finditer(r"(ui\.\w*(?:Cell|Tile|Iso)\w* = function[^\n]*|function \w*(?:isoCell|cellHTML|buildCell)\w*[^\n]*)", u):
    print('  @%d  %s' % (u[:m.start()].count('\n') + 1, m.group(0).strip()[:120]))

print()
print('=' * 30, 'A2 .tile-face CSS 现状', '=' * 30)
for m in re.finditer(r'[^\n]*\.tile-face[^\n]*\{[^}]*\}', h):
    ln = h[:m.start()].count('\n') + 1
    print('  L%d  %s' % (ln, m.group(0).replace('\n', ' ')[:220]))

print()
print('=' * 30, 'A3 ser- 规则区（v89.225/227 染色）', '=' * 30)
for m in re.finditer(r'[^\n]*ser-[a-z]+[^\n]*\{[^}]*\}', h):
    ln = h[:m.start()].count('\n') + 1
    print('  L%d  %s' % (ln, m.group(0).replace('\n', ' ')[:200]))

print()
print('=' * 30, 'A4 建筑名称/等级的渲染位置', '=' * 30)
# 在 ui.js 里找建筑名+等级怎么渲染
idx = 0
hits = []
for m in re.finditer(r'.{0,90}(建筑|bldm|b-name|b-lv|tilename|tile-name|bname)[^\n]{0,90}', u):
    s = m.group(0)
    if re.search(r"'  *\+|innerHTML|html \+=|\.name|等级|lvl", s) and re.search(r"name|Lv|lv\b", s):
        hits.append((u[:m.start()].count('\n') + 1, s.strip()))
for ln, s in hits[:40]:
    print('  L%-6d %s' % (ln, s[:170]))

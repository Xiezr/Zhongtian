# -*- coding: utf-8 -*-
"""v89.229c15：① gicons 兵种名册换代 ② §229c③ 幂等标记判据 ③ 旧轮版本 pin 放宽 ④ 需求档案补录"""
import io, os, re, sys, json

ROOT = r'E:\Deepseekdb'
P = os.path.join(ROOT, 'smoke-test.js')
G = os.path.join(ROOT, 'js', 'gicons.js')
A = os.path.join(ROOT, '需求档案.md')


def rd(p):
    with io.open(p, 'r', encoding='utf-8', newline='') as f:
        return f.read()


def wr(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(s)


LOG = []

# ---------------------------------------------------------------- ① gicons 兵种名册
g = rd(G)
i = g.index('    "troop": {')
j = g.index('    "mat": {')
seg = g[i:j]
PROTO = {
    'banche': 'minfu', 'fujiche': 'qingji', 'zhencha': 'chihou', 'yunshu': 'zhouche',
    'buxingji': 'changqiang', 'dunwei': 'daodun', 'daodanche': 'gongjian', 'wuzhi': 'tuqibing',
    'zhuzhan': 'xiliangtieqi', 'kuanglie': 'hubaoqi', 'dianci': 'tengjiabing',
    'huopao': 'toudan', 'wuren': 'chuangnu', 'taitan': 'nanjiangxiangbing',
}
entries = {}
for m in re.finditer(r'"([a-z_]+)":\s*\[\s*"([^"]+)",\s*"([^"]+)"\s*\]', seg):
    entries[m.group(1)] = (m.group(2), m.group(3))
LOG.append('旧 troop 段解析出 %d 项' % len(entries))
missp = [k for k, v in PROTO.items() if v not in entries]
if missp:
    LOG.append('!!! 缺原型 %s' % missp)

# 生成新段（保持 JSON 风格缩进）
lines = ['    "troop": {']
order = ['banche', 'fujiche', 'zhencha', 'yunshu', 'buxingji', 'dunwei', 'daodanche', 'wuzhi',
         'zhuzhan', 'kuanglie', 'dianci', 'huopao', 'wuren', 'taitan']
for n, new in enumerate(order):
    ic, tn = entries[PROTO[new]]
    lines.append('      "%s": [' % new)
    lines.append('        "%s",' % ic)
    lines.append('        "%s"' % tn)
    lines.append('      ]' + (',' if n < len(order) - 1 else ''))
lines.append('    },')
new_seg = '\n'.join(lines) + '\n'
wr(G, g[:i] + new_seg + g[j:])
LOG.append('[ok]   gicons troop 段换代 14 项（原型继承图标名）')

# ---------------------------------------------------------------- ② §229c③ 幂等标记
s = rd(P)
old = "&& JSON.stringify(a1) === JSON.stringify(a2) && st.troopMig229 === true"
new = "&& JSON.stringify(a1) === JSON.stringify(a2) && !!st.troopMig229"
assert s.count(old) == 1, 'count=' + str(s.count(old))
wr(P, s.replace(old, new)); LOG.append('[ok]   §229c③ 幂等标记判据（= 1 而非 === true）')

# ---------------------------------------------------------------- ③ 旧轮版本 pin 放宽
s = rd(P)
n = 0
for ver in ['v89\\.223', 'v89\\.224', 'v89\\.228']:
    o = "/GAME\\.VERSION = '" + ver + "'/"
    t = "/GAME\\.VERSION = 'v89\\.\\d+'/"
    c = s.count(o)
    if c:
        s = s.replace(o, t); n += c
wr(P, s)
LOG.append('[ok]   旧轮版本 pin 放宽 %d 处（精确版本由 §199④ 独家守）' % n)

# ---------------------------------------------------------------- ④ 需求档案补录
a = rd(A)
if '| v89.229 |' in a:
    LOG.append('[skip] 档案总览行')
else:
    # 总览表：找最后一行 v89.x
    m = list(re.finditer(r'^\| v89\.\d+ \|.*$', a, re.M))
    if not m:
        LOG.append('!!! 未找到总览表行')
    else:
        last = m[-1]
        row = ('| v89.229 | 兵种重构（18→14 三分组）· 城视图统一底 + 名称色块 · 资源四类换代 | '
               '兵种表重建 + 三分组分页 + 老档迁移 + 位图/名册随换代 | '
               '`docs/v89229-*.md`（本轮交付文档） |')
        a = a[:last.end()] + '\n' + row + a[last.end():]
        LOG.append('[ok]   档案总览行补录')
        wr(A, a)

a = rd(A)
if '## v89.229' in a:
    LOG.append('[skip] 档案明细段')
else:
    SEC = u'''

---

## v89.229 兵种重构 · 城视图统一底 · 资源四类换代

**老板原话（逐字）**：

> 1.能否去掉城内地块颜色，统一废土底色（浅一点），建筑名称和等级都放顶部，建筑名称的文字色块行高调高，并以此此文字色块区分各系建筑。目前各系颜色晦暗，不好区分
> 2.兵种重构，不再按步兵骑兵区分，合并，按分页显示，缩减兵种数量，保留可增加框架：
> 1	2	3	4
> 板车	伏击车	侦察单元 (小巧飞行器） 	运输平台
> 5	6	7	8	9
> 步行机	盾卫	导弹车 	武装直升机 	主战机甲
> 10	11	12	13	14
> 狂猎  电磁盾卫 	自行火炮 	无人轰炸机 	泰坦机甲
> 3.结合废土背景和兵种，资源类型可以分为生物质（水培温室），净水（净化厂），电能（发电站），废钢（电弧熔炉）

**交付**：

| 批 | 内容 | 状态 |
|---|---|---|
| a | 城视图：地块染色退役 → 统一浅废土底；族色编码迁到**建筑名称文字色块**（名称+等级都在格顶 · 色块行高升档） | 已落地（§229a 八条） |
| b | 资源四类换代：净水/生物质/电能/废钢 + 产地建筑 净化厂/水培温室/发电站/电弧熔炉（key 不动 · 老档零迁移） | 已落地（§229b 三条） |
| c | 兵种重构 18→14：`cat` 退役 → `grp`（三组分页）+ `ride` 显式字段；老档迁移映射表 `TROOP_MAP_229` | 已落地（§229c 八条） |

**由需求引出的真 bug（本轮抓到的两处）**：

1. **`js/map.js` 的 `fortGarrison` 五键全是退役 id** —— 据点守军整支为空：
   引擎拿到 0 防守单位，战斗 0 回合结束、`defLoss` 恒 0（俘获/战功/战报全空），
   "兵力悬殊二次确认"因比值算不出而永不触发；旧档迁移**救不了**它（运行时派生，每次现算）。
2. **AI 位图按旧 id 命名**（`ai_yibing.png` 等 18 张）→ 14 个新 id 全查不到位图，
   静默回退矢量层（观感退化）。已按原型继承重命名并重生成登记表。

**映射表（18→14 · 唯一来源 `GAME.TROOP_MAP_229`）**：搬运工→板车 · 摩托游骑→伏击车 ·
侦察兵→侦察单元 · 运输车→运输平台 · 民兵/长矛手/旧军残部→步行机 · 盾卫→盾卫 ·
弩手→导弹车 · 突击摩托→武装直升机 · 装甲战车/重甲战车→主战机甲 · 王牌战车→狂猎 ·
防暴甲兵→电磁盾卫 · 破门车/迫击炮→自行火炮 · 重弩车→无人轰炸机 · 变异巨兽→泰坦机甲。
'''
    with io.open(A, 'a', encoding='utf-8', newline='') as f:
        f.write(SEC)
    LOG.append('[ok]   档案明细段补录')

with io.open(os.path.join(ROOT, '.workbuddy', 'tmp', 'p229c15_report.txt'), 'w',
             encoding='utf-8', newline='') as f:
    f.write('\n'.join(LOG))
sys.stdout.write('\n'.join(LOG) + '\n')

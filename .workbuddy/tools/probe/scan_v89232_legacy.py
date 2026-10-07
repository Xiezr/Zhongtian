# -*- coding: utf-8 -*-
"""v89.232 全面漏网体检：历轮废土化旧词 × 活面 扫描
活面 = 产品 js/ + index.html + smoke/e2e + 活工具（非 patch/probe/tmp/backup）+ 活文档
输出：每文件命中（词 + 行号 + 抽样），供分类定性。
"""
import io, os

# 词表（按历轮换代收集；单字/泛词也收，靠抽样行定性）
WORDS = [
    # 六维旧名（v89.224d）
    '统率', '内政', '勇武', '智谋',
    # 资质五档（v89.224b）
    '凡品', '良材', '英杰', '名世', '天授',
    # 页面/系统（v89.224a/b）
    '将领', '商城', '派系驻地', '播种', '种子', '灵田', '藏珍阁', '百炼',
    # 资源（v89.224e / v89.228 / v89.229）
    '木料', '碎石', '废铁', '黄金', '金币', '万金', '人口', '粮草', '耗粮', '粮',
    # 装备体系（v89.224c / v89.227）
    '军中装备', '改造装备', '名将套', '神武', '倚天', '游侠', '陷阵', '守御', '天策',
    # 材料（v89.227）
    '泰坦筋', '河石', '青玉', '羊脂玉', '昆山玉', '织锦', '云缎', '玉系', '丝系',
    # 旧建筑（v89.224 / v89.228）
    '民房', '仓库', '校场', '客栈', '书院', '城墙', '兵营',
    # 旧兵种显示名（v89.228 / v89.229 及更早）
    '搬运工', '摩托游骑', '侦察兵', '长矛手', '旧军残部', '刀盾', '弩手', '突击摩托',
    '装甲战车', '重甲战车', '王牌战车', '防暴甲兵', '迫击炮', '破门车', '重弩车', '变异巨兽',
    '辎重车', '床弩', '冲车', '投石兵', '民夫', '义兵', '斥候', '象兵', '铁骑',
    # 道具（v89.228）
    '虎符', '文曲星符', '武曲星符', '智多星符',
    # 血清（v89.224b）
    '活性血清', '强化血清', '跃迁血清', '天选血清',
    # 实验室作物（v89.224b）
    '铁英树', '云缎桑',
    # 旧城名（v89.217）
    '弘农', '高陵', '蓟县', '高柳', '涿县', '上谷', '琅琊', '汉寿', '宛县', '肤施', '雁门', '乐安', '许昌', '赤壁',
    # 科技 24 旧名（v89.231 复查）
    '练兵技巧', '战斗技巧', '打造技巧', '侦察技巧', '防护技巧', '负重技巧', '行军技巧', '抛射技巧',
    '驾驭技巧', '建筑技术', '储存技术', '补给技巧', '统帅能力', '城防技术', '维修技术', '抢掠技巧',
    '合成技巧', '车轮技术', '机修技巧', '研究技巧',
    # 世界观（更早批次）
    '大汉', '汉室', '朝廷', '陛见', '郡守', '县令', '征召', '征兵',
]

ROOTS = ['E:/Deepseekdb']
SKIP_DIRS = ['.git', 'backup', 'node_modules', '.workbuddy/backup', '.workbuddy/tmp',
             '.workbuddy/tools/patch', '.workbuddy/tools/probe', '.workbuddy/tools/tmp',
             '.workbuddy/tools/break', 'docs/_参考', 'docs/_史料']
SKIP_FILES = ['scan_v89232', 'patch_v8923', 'dump_v8923']

def rel(p):
    return p.replace('\\', '/').replace('E:/Deepseekdb/', '')

files = []
for root, dirs, fs in os.walk('E:/Deepseekdb'):
    r = root.replace('\\', '/')
    if any(x in r for x in SKIP_DIRS):
        continue
    for f in fs:
        if not f.endswith(('.js', '.html', '.md')):
            continue
        if any(x in f for x in SKIP_FILES):
            continue
        p = os.path.join(root, f)
        rp = rel(p)
        # 只扫：产品 js / index / 测试 / 活工具 / 活文档 + 档案（参考）
        if (rp.startswith('js/') or rp == 'index.html' or rp in ('smoke-test.js', 'e2e-test.js')
                or rp.startswith('.workbuddy/tools/') or rp.startswith('docs/')
                or rp == '需求档案.md'):
            files.append(p)

print('扫描文件数:', len(files))
IN_DOCS = ('docs/v89', 'docs/_', '需求档案.md')
tot = 0
for p in sorted(files):
    s = io.open(p, encoding='utf-8', errors='replace').read()
    rows = []
    for w in WORDS:
        pos = 0
        cnt = 0
        first = ''
        while True:
            i = s.find(w, pos)
            if i < 0:
                break
            cnt += 1
            if not first:
                ln = s.count('\n', 0, i) + 1
                a = s.rfind('\n', 0, max(0, i - 60))
                b = s.find('\n', i + 60)
                first = 'L%d %s' % (ln, s[a + 1:b].strip()[:130])
            pos = i + len(w)
        if cnt:
            rows.append((w, cnt, first))
    if rows:
        tag = '【史档参考】' if rel(p).startswith(IN_DOCS) else ''
        print('\n##### %s %s (%d 词)' % (rel(p), tag, len(rows)))
        for w, cnt, first in rows:
            print('  %-10s x%-4d %s' % (w, cnt, first))
        tot += len(rows)
print('\n合计命中词对：', tot)

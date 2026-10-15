# -*- coding: utf-8 -*-
"""v89.214：换皮前的影响面扫描 —— 统计"中文名词"在 产品代码/测试 里的出现（剥注释后）"""
import io, re, os, sys
R = 'E:/Deepseekdb/'
WORDS = ['官府','民房','书院','军营','校场','市场','仓库','城墙','驿站','烽火台','马厩','客栈','招贤馆','门派驻地','铁匠铺','工匠作坊',
         '民夫','义兵','斥候','长枪兵','刀盾兵','弓箭手','轻骑兵','铁骑兵','辎重车','床弩','冲车','投石车','青州兵','藤甲兵','突骑兵','虎豹骑','西凉铁骑','南疆象兵',
         '凡品','良材','英杰','名世','天授',
         '平民','公士','上造','簪袅','不更','大夫','官大夫','公大夫','公乘','五大夫','左庶长','右庶长','左更','中更','右更','少上造','大上造','驷车庶长','大庶长',
         '玄鹤门','青锋阁','百草堂','虎啸营','玄机阁','牧云庄',
         '倚天套','名将套','神武套','游侠套','陷阵套','守御套','天策套',
         '孙子兵法','太公六韬','五禽戏','越女剑经','吴子','司马法','三略','尉缭子',
         '粮食','木料','石料','铁矿','黄金','人口',
         '农田','伐木场','采石场','铁矿场',
         '玉犀符','铜雀令','青囊玉枢','白虎符节','八卦羽扇','虎头盘蛟枪','赤霄剑','传国玉玺',
         '洛阳','长安','许昌','建业','成都','邺城','并州','幽州','凉州','扬州','荆州','益州','交州','司隶','冀州','兖州','豫州','青州','徐州']

def strip_js(s):
    # 去块注释、行注释、字符串内容（保长度占位）
    out = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i+1 < n and s[i+1] == '*':
            j = s.find('*/', i+2)
            j = n if j < 0 else j+2
            out.append(' ' * (j-i)); i = j; continue
        if c == '/' and i+1 < n and s[i+1] == '/':
            j = s.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j-i)); i = j; continue
        if c in '\'"`':
            q = c; j = i+1
            while j < n:
                if s[j] == '\\': j += 2; continue
                if s[j] == q: j += 1; break
                j += 1
            # 保留字符串内容（我们要统计字符串里的中文），但把引号去掉
            out.append(' ' + s[i+1:j-1] + ' '); i = j; continue
        out.append(c); i += 1
    return ''.join(out)

def scan(path, label):
    s = io.open(path, encoding='utf-8', errors='replace').read()
    code = strip_js(s)
    res = {}
    for w in WORDS:
        c = code.count(w)
        if c:
            res[w] = c
    return res

files = {
    'smoke': R+'smoke-test.js',
    'e2e': R+'e2e-test.js',
}
prod = {}
for f in ['data','state','domain','battle','tactic','ui','main','systems','story','map','questdata','icons']:
    prod[f] = scan(R+'js/'+f+'.js', f)

# 汇总每个词在测试里的"代码态"出现
print('=== 词 · 测试(代码态) · 产品(代码态) ===')
allw = set()
for r in prod.values(): allw.update(r.keys())
tests = {}
for k, p in files.items():
    tests[k] = scan(p, k)
    allw.update(tests[k].keys())
for w in WORDS:
    t = (tests['smoke'].get(w,0), tests['e2e'].get(w,0))
    p = sum(prod[f].get(w,0) for f in prod)
    if t[0] or t[1] or p:
        print('%-8s smoke=%-4d e2e=%-4d prod=%-5d' % (w, t[0], t[1], p))
print()
print('（注：字符串内容保留统计 —— 断言里的中文名会计入）')

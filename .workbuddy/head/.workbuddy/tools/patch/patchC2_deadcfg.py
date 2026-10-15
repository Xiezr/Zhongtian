# -*- coding: utf-8 -*-
"""v90.93 批次C1/C2 遗留清理：
  ① js/data.js —— 两处「声明了但零读点」的死配置（年号纪元退役的连带残留）
       a) DATA.CALENDAR 的「每季检查里程碑」开关（唯一读点 checkEra 已退役）
       b) DATA.POWER 的三键（资源折合可动员战力 / 建筑系数 / 科技系数；唯一读点 eraGoalProgress 已退役）
  ② .workbuddy/tools/audit/audit_v89208_systemmatrix.js —— 「纪事剧本」整系统退役，
       四链核对行 + 动作面路由项移除（同 v90.80 奇观/奇遇、v90.92 门派先例）
手法：逐行精确匹配（assert）→ 删除/替换 → 原子落盘 → 幂等重跑
"""
import io, os, sys, shutil

ROOT = r'E:\Deepseekdb'
BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.93C')


def load(p):
    return io.open(p, 'r', encoding='utf-8', newline='').read()


def save(p, s, n0):
    tmp = p + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(s)
    os.replace(tmp, p)
    print('  [write] %s  %d -> %d 字节' % (os.path.basename(p), n0, os.path.getsize(p)))


def drop_exact_lines(path, targets):
    """按整行精确匹配删除（每行必须唯一命中）"""
    s = load(path); n0 = os.path.getsize(path)
    lines = s.split('\n')
    for t in targets:
        idx = [i for i, L in enumerate(lines) if L == t]
        if len(idx) != 1:
            if len(idx) == 0 and t not in s:
                print('  [skip] 未命中（可能已删）：%r' % t[:50]); continue
            print('  !! 行不唯一/异常 count=%d：%r' % (len(idx), t[:60])); sys.exit(2)
        lines[idx[0]] = None
        print('  [del] %r' % t[:60])
    s2 = '\n'.join(L for L in lines if L is not None)
    save(path, s2, n0)


# ==================== ①a DATA.CALENDAR ====================
P_DATA = os.path.join(ROOT, 'js', 'data.js')
print('== ①a DATA.CALENDAR 死开关 ==')
drop_exact_lines(P_DATA, [
    '    chronicleEverySeason: true, // \u6bcf\u5b63\u68c0\u67e5\u4e00\u6b21\u91cc\u7a0b\u7891',
])

# ==================== ①b DATA.POWER 三键 ====================
print('== ①b DATA.POWER 三键 ==')
drop_exact_lines(P_DATA, [
    '    /* \u8d44\u6e90\u6298\u5408"\u53ef\u52a8\u5458\u6218\u529b"\uff1a\u5404\u7c7b\u8d44\u6e90\u6309\u52df\u5175\u6210\u672c\u6298\u7b97\u6210\u53ef\u517b\u5175\u529b */',
    '    /* \u4ee5\u6b65\u884c\u673a\u5355\u4f4d\u6210\u672c(\u7cae240/\u6728100/\u94c150 \u00b7 v89.36 \u52df\u5175\u8017\u7cae \u00d73)\u4e3a\u57fa\u51c6\uff0c',
    '       \u9664\u4ee5\u8d44\u6e90\u79cd\u7c7b\u6570\u505a\u52a0\u6743\u5e73\u5747\uff0c\u4f7f"\u53ef\u52a8\u5458\u6218\u529b"\u8d34\u8fd1\u5b9e\u9645\u80fd\u517b\u591a\u5c11\u5175\uff0c\u907f\u514d\u9ad8\u4f30 */',
    '    resToTroop: { grain: 1 / 720, wood: 1 / 300, iron: 1 / 150, stone: 1 / 500, gold: 1 / 400 },',
    '    /* \u5efa\u7b51\u4e0e\u79d1\u6280\u7684\u6218\u529b\u7cfb\u6570 */',
    '    buildingBonus: 0.01,        // \u6bcf\u5ea7\u5efa\u7b51 +1%',
    '    techBonus: 0.02,            // \u6bcf\u7ea7\u79d1\u6280 +2%',
])

# ① 两段头注释改写（精确子串替换 + 墓碑）
s = load(P_DATA); n0 = os.path.getsize(P_DATA)
CAL_HDR = '  /* ---------------- \u2462c \u65f6\u95f4\u5386\u6cd5\uff081 \u6e38\u620f\u5e74 = 8 \u73b0\u5b9e\u5206\u949f @120\u00d7\uff09 ---------------- */\n  DATA.CALENDAR = {\n    secPerYear: 57600,          // \u6e38\u620f\u79d2/\u5e74\uff08= 480 \u73b0\u5b9e\u79d2 @120\u00d7\uff09\n    seasonsPerYear: 4,\n  };'
CAL_NEW = ('  /* ---------------- \u2462c \u65f6\u95f4\u5386\u6cd5\uff081 \u6e38\u620f\u5e74 = 8 \u73b0\u5b9e\u5206\u949f @120\u00d7\uff09 ---------------- */\n'
           '  DATA.CALENDAR = {\n'
           '    secPerYear: 57600,          // \u6e38\u620f\u79d2/\u5e74\uff08= 480 \u73b0\u5b9e\u79d2 @120\u00d7\uff09\n'
           '    seasonsPerYear: 4,\n'
           '  };\n'
           '  /* \u23d4 v90.93 \u9000\u5f79\uff1a\u539f\u672c\u8868\u5185\u7684\u300c\u6bcf\u5b63\u68c0\u67e5\u4e00\u6b21\u91cc\u7a0b\u7891\u300d\u5f00\u5173\u6574\u6761\u5220\u9664 \u2014\u2014\n'
           '     \u5b83\u7684\u552f\u4e00\u8bfb\u70b9\u662f story.js \u7684 checkEra\uff08\u968f\u5e74\u53f7\u7eaa\u5143\u9000\u5f79\uff09\uff0c\u7559\u4e4b\u5373\u6210\u300c\u58f0\u660e\u4e86\u4f46\u6ca1\u63a5\u7ebf\u300d\u7684\u6b7b\u914d\u7f6e\u3002 */')
if CAL_HDR not in s:
    print('  [skip] CALENDAR 头未命中（可能已改）')
else:
    s = s.replace(CAL_HDR, CAL_NEW, 1)
    print('  [patch] CALENDAR 头 + 墓碑')

POW_HDR = ('  /* ---------------- \u2462d \u8d44\u6e90\u2192\u6218\u529b\u6298\u7b97\uff08\u8bc4\u4f30\u5bb6\u5e95\u4e0e\u65f6\u4ee3\u76ee\u6807\uff09 ---------------- */\n'
           '  DATA.POWER = {\n'
           '    /* \u5355\u5175\u57fa\u7840\u6218\u529b\u6743\u91cd\uff08\u6309\u5175\u79cd\u5c5e\u6027\u5f52\u4e00\uff09 */\n'
           '    troopWeight: { hp: 0.004, atk: 0.60, def: 0.40, spd: 0.02 },\n'
           '  };')
POW_NEW = ('  /* ---------------- \u2462d \u5355\u5175\u6218\u529b\u6743\u91cd\uff08\u6218\u529b\u5c3a\u57fa\u51c6 \u00b7 story.troopPower \u552f\u4e00\u8bfb\u70b9\uff09 ----------------\n'
           '     \u23d4 v90.93 \u9000\u5f79\uff1a\u539f\u300c\u8bc4\u4f30\u5bb6\u5e95\u4e0e\u65f6\u4ee3\u76ee\u6807\u300d\u7528\u7684\u4e09\u9879\u7cfb\u6570\uff08\u8d44\u6e90\u6298\u5408\u53ef\u52a8\u5458\u6218\u529b \u00b7 \u5efa\u7b51\u7cfb\u6570 \u00b7\n'
           '     \u79d1\u6280\u7cfb\u6570\uff09\u6574\u6761\u5220\u9664 \u2014\u2014 \u5b83\u4eec\u7684\u552f\u4e00\u8bfb\u70b9\u662f story.js \u7684 eraGoalProgress\uff08\u968f\u5e74\u53f7\u7eaa\u5143\u9000\u5f79\uff09\u3002\n'
           '     \u4fdd\u7559\u7684 troopWeight \u4ecd\u5728\u5c97\uff1astory.troopPower \u8bfb\u5b83\uff0cbattle / state \u590d\u7528\u540c\u4e00\u628a\u5c3a\u3002 */\n'
           '  DATA.POWER = {\n'
           '    /* \u5355\u5175\u57fa\u7840\u6218\u529b\u6743\u91cd\uff08\u6309\u5175\u79cd\u5c5e\u6027\u5f52\u4e00\uff09 */\n'
           '    troopWeight: { hp: 0.004, atk: 0.60, def: 0.40, spd: 0.02 },\n'
           '  };')
if POW_HDR not in s:
    print('  [skip] POWER 头未命中（可能已改）')
else:
    s = s.replace(POW_HDR, POW_NEW, 1)
    print('  [patch] POWER 头 + 墓碑')
save(P_DATA, s, n0)

# ==================== ② systemmatrix ====================
print('== ② 系统矩阵：纪事剧本行移除 ==')
P_SM = os.path.join(ROOT, '.workbuddy', 'tools', 'audit', 'audit_v89208_systemmatrix.js')
s = load(P_SM); n0 = os.path.getsize(P_SM)
OLD_ROW = "  { n: '\u7eaa\u4e8b\u5267\u672c', d: ['CHRONICLE_RULES', 'ERAS'], g: ['chronicle'], u: ['chronicle', '\u7eaa\u4e8b'], t: ['\u7eaa\u4e8b'] },\n"
NEW_ROW = ("  /* v90.93\uff1a\u300c\u7eaa\u4e8b\u5267\u672c\u300d\u6574\u7cfb\u7edf\u9000\u5f79\uff08\u4efb\u52a1\u7cfb\u7edf v90.92 + \u5168\u5c4f\u5267\u672c / \u5e74\u53f7\u7eaa\u5143 v90.93\uff09\u2014\u2014\n"
           "     \u56db\u94fe\u6838\u5bf9\u884c\u79fb\u9664\uff08\u9632\u91cd\u8dd1\u8bef\u62a5\u5047\u7f3a\u53e3\uff0c\u540c v90.80 \u5947\u89c2/\u5947\u9047\u3001v90.92 \u95e8\u6d3e\u5148\u4f8b\uff09\u3002 */\n")
OLD_CK = "  '\u7eaa\u4e8b\u5267\u672c': /^story|^chronicle/,   /* v90.92\uff1a\u4efb\u52a1\u7cfb\u7edf\u9000\u5f79 \u2192 'quest' \u8def\u7531\u9879\u79fb\u9664 */\n"
NEW_CK = "  /* v90.93\uff1a'\u7eaa\u4e8b\u5267\u672c' \u52a8\u4f5c\u9762\u8def\u7531\u9879\u79fb\u9664\uff08story-* / chronicle-* \u5df2\u65e0\u53d1\u5c04\u70b9\uff09 */\n"
for old, new, tag in ((OLD_ROW, NEW_ROW, 'SYS 四链行'), (OLD_CK, NEW_CK, 'SYS_CK 路由项')):
    c = s.count(old)
    if c == 0:
        print('  [skip] %s 未命中（可能已改）' % tag); continue
    if c != 1:
        print('  !! %s 不唯一 count=%d' % (tag, c)); sys.exit(3)
    s = s.replace(old, new, 1)
    print('  [patch] %s' % tag)
save(P_SM, s, n0)
print('DONE')

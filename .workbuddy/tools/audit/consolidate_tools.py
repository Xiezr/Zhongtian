# -*- coding: utf-8 -*-
"""集中存放 · 第三步：tools 分子目录 + 引用转接 + 重写索引生成器。

分组靠**目录**（不再靠文件名前缀猜）：
  patch/ 变更日志（补丁脚本）   break/ 破坏测试        probe/ 探针（几何/界面/存档）
  gen/   生成器与索引            asset/ 素材处理        audit/ 审计与核对
  mem/   记忆维护                show/  展示与校准
⚠️ 每个文件必须**恰好**归一组；未归组的直接报错退出（不许静默漏掉）。
"""
import io, os, re, glob, shutil

ROOT = r'E:\Deepseekdb'
T = os.path.join(ROOT, '.workbuddy', 'tools')
MEM = r'C:\Users\18811\WorkBuddy\2026-08-29-22-25-02\.workbuddy\memory'
TEXT = ('.md', '.html', '.js', '.json', '.txt')

GROUPS = {
    'patch': ['apply_abandon.py', 'apply_cols.py', 'patch_v67_save.py', 'patch_v67_save2.py',
              'patch_v67_save3.py', 'patch_v67_save3b.py', 'patch_v67_save4.py',
              'patch_v67_terrain.py', 'finish_cleanup_v67.py', 'finish_cleanup_v67b.py',
              'finish_cleanup_v67c.py', 'v26-j.py'],
    'break': ['break_v60.py', 'break_v61.py', 'break_v62.py', 'break_v63.py', 'break_v64.py',
              'break_v65.py', 'break_v66.py', 'break_v67.py', 'break_v67_save.py'],
    'probe': ['probe.js', 'probe_v43.js', 'probe60_geom.js', 'probe61_board.js', 'probe62_geom.js',
              'probe63_geom.js', 'probe64_geom.js', 'probe65_geom.js', 'probe66_sta.js',
              'probe66_ui.js', 'probe67_after.js', 'probe67_cols.js', 'probe67_save.js',
              'probe67_save2.js', 'probe67_save3.js', 'probe67_save_ui.js', 'probe67_tbl.js'],
    'gen': ['gen_bitmaps.js', 'gen_gicons.js', 'atlas_split.js', 'gen_tools_index.py'],
    'asset': ['recolor_buildings.py', 'avatar_atlas.py', 'crop_pd3.py', 'matte.js', 'rename_matte.js',
              'portrait_gallery.js', 'gallery31.js', 'gallery33.js'],
    'audit': ['audit_colors.js', 'verify_v66_edits.py', 'read_recycle.py', 'trash_paths.py',
              'survey_project.py', 'survey_project2.py', 'audit_refs.py',
              'consolidate_docs.py', 'consolidate_docs2.py'],
    'mem': ['slim_memory_template.py', 'slim_memory_v67.py', 'memory_v67c.py'],
    'show': ['calib_series.js', 'compare34.js', 'scan6.js', 'tile_show.js'],
}

# ---------- 0 校验：不重不漏 ----------
present = set(f for f in os.listdir(T) if os.path.isfile(os.path.join(T, f)))
assigned = [f for g in GROUPS.values() for f in g]
dup = [f for f in set(assigned) if assigned.count(f) > 1]
extra = sorted(present - set(assigned) - {'README_INDEX.md'})
missing = sorted(set(assigned) - present)
print('tools 现有文件 %d 个' % len(present))
if dup:
    raise SystemExit('❌ 重复归类：%s' % dup)
if missing:
    raise SystemExit('❌ 清单里有但磁盘上没有：%s' % missing)
print('   未归类：%s' % (extra or '无 ✅'))

# ---------- 1 建目录 + 搬 ----------
for g in GROUPS:
    os.makedirs(os.path.join(T, g), exist_ok=True)
if os.path.exists(os.path.join(T, 'README_INDEX.md')):
    shutil.move(os.path.join(T, 'README_INDEX.md'), os.path.join(T, 'README_INDEX.md.bak'))
moved = []
for g, fs in GROUPS.items():
    for f in fs:
        shutil.move(os.path.join(T, f), os.path.join(T, g, f))
        moved.append('%s/%s' % (g, f))
if os.path.exists(os.path.join(T, 'README_INDEX.md.bak')):
    os.remove(os.path.join(T, 'README_INDEX.md.bak'))
print('\n① 搬入 8 个子目录，共 %d 个' % len(moved))
for g, fs in GROUPS.items():
    print('   %-7s %2d 个' % (g, len(fs)))

# ---------- 2 引用转接 ----------
TARGETS = []
for pat in [os.path.join(ROOT, 'docs', '**', '*'), os.path.join(ROOT, '*.md'),
            os.path.join(ROOT, 'js', '*.js'), os.path.join(MEM, '*.md'),
            r'C:\Users\18811\.workbuddy\skills\vanilla-js-bulk-refactor\SKILL.md',
            r'C:\Users\18811\.workbuddy\skills\frontend-e2e-jsdom-verification\SKILL.md']:
    TARGETS += glob.glob(pat, recursive=True)
TARGETS = [t for t in TARGETS if os.path.isfile(t) and t.lower().endswith(TEXT)]
GROUP_OF = {f: g for g, fs in GROUPS.items() for f in fs}

n = 0
touched = {}
for fp in TARGETS:
    c = io.open(fp, encoding='utf-8', errors='ignore', newline='').read()
    o = c
    for f, g in GROUP_OF.items():
        c = c.replace('.workbuddy/tools/' + f, '.workbuddy/tools/%s/%s' % (g, f))
        c = c.replace('.workbuddy\\tools\\' + f, '.workbuddy/tools/%s/%s' % (g, f))
        # 裸名（反引号包裹的）也补上目录，避免"知道名字找不到文件"
        c = c.replace('`%s`' % f, '`%s/%s`' % (g, f))
    if c != o:
        io.open(fp, 'w', encoding='utf-8', newline='').write(c)
        n += 1
        touched[os.path.basename(fp)] = touched.get(os.path.basename(fp), 0) + 1
print('\n② 引用转接：%d 份文件' % n)
for k, v in sorted(touched.items()):
    print('   %-34s' % k)

# ---------- 3 终检 ----------
bad = []
for fp in TARGETS:
    c = io.open(fp, encoding='utf-8', errors='ignore', newline='').read()
    for f, g in GROUP_OF.items():
        if ('.workbuddy/tools/' + f) in c:
            bad.append('%s 仍写 .workbuddy/tools/%s' % (os.path.basename(fp), f))
        if ('`%s`' % f) in c:
            bad.append('%s 仍写裸名 `%s`' % (os.path.basename(fp), f))
print('\n③ 终检残留：%d 处' % len(bad))
for x in bad[:15]:
    print('   ' + x)

print('\n④ tools 新结构')
for r, ds, fs in os.walk(T):
    rel = os.path.relpath(r, T)
    if rel == '.':
        print('   tools/（%s）' % '、'.join(sorted(ds)))
    else:
        print('   tools/%-8s %2d 个' % (rel + '/', len(fs)))

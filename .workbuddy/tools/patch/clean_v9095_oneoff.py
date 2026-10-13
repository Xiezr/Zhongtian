# -*- coding: utf-8 -*-
"""
v90.95 · 一次性脚本清理（老板 2026-10-14 授权：「确认的一次性脚本可清理，可复用的可以保留」）

判据：复用 .workbuddy/tools/gen/gen_tools_index.py 的 is_one_off()（与工具索引完全同源）——
  playtest/ 全组 · tmp/ 全组 · probe/ 名字带 v\\d（或 _/. 开头、dbg 开头）· play/repro_*
保留：play/lifecycle_v89121.js（交付文档复现命令指向它 → 视同在岗）、各可复用模板。

安全三件套：① 先 tar 全量备份 ② 删除清单落盘 ③ 删后重跑索引 + git status 核对。
补充保险：所有被删文件本就入库（git 历史永久可回查）；史料文档中的复现命令指向已删文件时，
以 git 历史为准（报备项，不改动料）。
"""
import io, os, re, shutil, subprocess, sys, tarfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
assert os.path.exists(os.path.join(ROOT, 'index.html')), 'ROOT 推导错误: ' + ROOT
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, '.workbuddy', 'tools', 'gen'))
from gen_tools_index import is_one_off, ONE_OFF_DIRS  # noqa: E402

BK = os.path.join(ROOT, '.workbuddy', 'backup', 'v90.95-oneoff')

def main():
    apply = '--apply' in sys.argv
    # ① 盘点
    victims = []
    for g in ONE_OFF_DIRS:
        gd = os.path.join(ROOT, '.workbuddy', 'tools', g)
        if not os.path.isdir(gd):
            continue
        for f in sorted(os.listdir(gd)):
            p = os.path.join(gd, f)
            if os.path.isfile(p) and is_one_off(g, f):
                victims.append(os.path.relpath(p, ROOT).replace(os.sep, '/'))
    print('① 判定为一次性：%d 件' % len(victims))
    byg = {}
    for v in victims:
        byg[v.split('/')[2]] = byg.get(v.split('/')[2], 0) + 1
    for k in sorted(byg):
        print('   %s: %d' % (k, byg[k]))
    # 保留哨兵
    keep = '.workbuddy/tools/play/lifecycle_v89121.js'
    assert keep not in victims, '哨兵文件在删除清单里，中止！'
    assert os.path.exists(os.path.join(ROOT, keep)), '哨兵文件不存在，中止！'

    if not apply:
        print('② 干跑 —— 加 --apply 执行（tar 备份 → 删除 → 重跑索引）')
        for v in victims[:10]:
            print('   例:', v)
        print('   …（共 %d 件）' % len(victims))
        return 0

    # ② tar 备份
    os.makedirs(BK, exist_ok=True)
    tar_path = os.path.join(BK, time.strftime('oneoff-%Y%m%d-%H%M%S.tar.gz'))
    with tarfile.open(tar_path, 'w:gz') as tf:
        for v in victims:
            tf.add(os.path.join(ROOT, v), arcname=v)
    print('② 已备份 %d 件 → %s (%.1f KB)' % (len(victims), os.path.relpath(tar_path, ROOT),
                                             os.path.getsize(tar_path) / 1024))

    # ③ 清单落盘 + 删除
    lst = os.path.join(BK, 'deleted-list.txt')
    with io.open(lst, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(victims) + '\n')
    for v in victims:
        os.remove(os.path.join(ROOT, v))
    print('③ 已删除 %d 件（清单 %s）' % (len(victims), os.path.relpath(lst, ROOT)))

    # ④ 重跑索引
    r = subprocess.run([sys.executable, os.path.join(ROOT, '.workbuddy', 'tools', 'gen', 'gen_tools_index.py')],
                       capture_output=True, text=True, encoding='utf-8')
    print(r.stdout.strip())
    assert r.returncode == 0, '索引重生成失败'
    return 0

if __name__ == '__main__':
    sys.exit(main())

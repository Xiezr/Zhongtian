# -*- coding: utf-8 -*-
"""对照实验：证明旧 cachebust.js 的正则前缀约束 (js|story)/ 会漏掉 vendor/three.min.js。
   只换"前缀约束"这一个变量，其余流程（先剥后挂）完全相同。"""
import io
import re

P = r'E:\Deepseekdb\.workbuddy\backup\v90.94-lordbreak\index.html.preVer'
t = io.open(P, encoding='utf-8', newline='').read()


def run(strip_pat, attach_pat, build):
    o = re.sub(strip_pat, r'\1\2', t)
    o = re.sub(attach_pat, lambda m: '<script src="%s?v=%s"></script>' % (m.group(1), build), o)
    tags = re.findall(r'<script src="([^"]*)"></script>', o)
    vers = sorted(set(re.findall(r'\?v=([0-9]+)', ' '.join(tags))))
    return len(tags), vers


n_old, v_old = run(r'(<script src="(?:js|story)/[^"]+\.js)\?v=\d+(")',
                   r'<script src="((?:js|story)/[^"]+\.js)"></script>', '9173')
n_new, v_new = run(r'(<script src="[^"]+\.js)\?v=\d+(")',
                   r'<script src="([^"]+\.js)"></script>', '9173')

print('旧 cachebust.js 正则 (js|story)/ ：脚本 %d 个 - ?v= 种类 %s' % (n_old, v_old))
print('新 bump_version.py 正则 (任意)  ：脚本 %d 个 - ?v= 种类 %s' % (n_new, v_new))
print('结论：旧正则 -> 混版（自检会报不自洽，但文件已写坏）；新正则 -> 单版本自洽。')

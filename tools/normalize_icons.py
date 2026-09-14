# -*- coding: utf-8 -*-
"""幂等图标归一化批处理：erase -> matting -> enhance。

对热血三国 UI 图标做"归一化"（非重绘）：
  1) erase   —— 擦掉右上角"图集"等水印（干净图也安全，无变化则保持）
  2) matting —— 抠干净透明底（修复 enhance 吃透明底变黑底的 bug）
  3) enhance —— 统一亮度/对比/清晰度，保持 alpha 通道

输入 : assets/icons/ui/*.png   （bitmaps.js 注册表对应的 91 张原图）
输出 : assets/icons/ui_normalized/<同名>.png  （已存在则幂等跳过）

用法：
  python tools/normalize_icons.py <clientTempToken> [workers=3] [limit=0] [contains=""]

token 过期时脚本停止并报告；上层重取 token 后续跑即可，已完成项自动跳过。
路径基于本脚本位置推导，不依赖具体机器盘符。
"""
import subprocess, json, os, sys, glob
from concurrent.futures import ThreadPoolExecutor, as_completed

# 脚本位于 <repo>/tools/normalize_icons.py，BASE 即仓库根
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "assets", "icons", "ui")
OUT = os.path.join(BASE, "assets", "icons", "ui_normalized")

# 本机 WorkBuddy 内置图像处理能力（环境相关，可改为环境变量覆盖）
SCRIPT = os.environ.get(
    "BUDDY_IMG_SCRIPT",
    r"E:\Workbuddy1\resources\app.asar.unpacked\resources\plugins\workbuddy-builtin\skills\buddy-image-processing\scripts\buddy-image-processing.py",
)
PY = os.environ.get(
    "WORKBUDDY_PY",
    r"C:\Users\18811\.workbuddy\binaries\python\versions\3.13.12\python.exe",
)

ERASE_PROMPT = "Remove any small text watermark or logo in the top-right corner if present, otherwise keep the image completely unchanged"
ENHANCE_PROMPT = "Unify brightness and contrast, improve clarity and tonal consistency, keep original style and colors"


def run(op, src, token, prompt=""):
    cmd = [PY, SCRIPT, "image-edit", "--operation", op,
           "--image-file", src, "--token", token]
    if prompt:
        cmd += ["--prompt", prompt]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=OUT, timeout=300)
    except subprocess.TimeoutExpired:
        return None, "TIMEOUT"
    try:
        data = json.loads(r.stdout)
    except Exception:
        return None, "PARSE_FAIL:" + (r.stdout[-300:] if r.stdout else r.stderr[-300:])
    status = data.get("status")
    if status == "failed":
        return None, "FAILED:" + json.dumps(data.get("error", {}), ensure_ascii=False)
    if status != "completed":
        return None, "NOT_COMPLETED:" + str(status)
    files = data.get("result_files") or []
    return (files[0].get("path") if files else None), "OK"


def process_one(name, token):
    src = os.path.join(SRC, name)
    target = os.path.join(OUT, name)
    if os.path.exists(target):
        return name, "SKIP_DONE"
    # 1) erase watermark (safe on clean images)
    p1, msg = run("erase", src, token, ERASE_PROMPT)
    if not p1:
        return name, "FAIL_ERASE:" + msg
    # 2) matting -> clean alpha
    p2, msg = run("matting", p1, token)
    if not p2:
        return name, "FAIL_MATTING:" + msg
    # 3) enhance -> tone (keeps alpha)
    p3, msg = run("enhance", p2, token, ENHANCE_PROMPT)
    if not p3:
        return name, "FAIL_ENHANCE:" + msg
    try:
        os.replace(p3, target)
        for t in (p1, p2):
            try:
                os.remove(t)
            except OSError:
                pass
    except OSError as e:
        return name, "FAIL_WRITE:" + str(e)
    return name, "OK"


def main():
    token = sys.argv[1]
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    only = sys.argv[4] if len(sys.argv) > 4 else ""

    os.makedirs(OUT, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, "*.png")))
    files = [os.path.basename(f) for f in files]
    if only:
        files = [f for f in files if only in f]
    if limit:
        files = files[:limit]

    print(f"[INFO] base={BASE} total={len(files)} workers={workers} token_prefix={token[:8]}...")

    done = fail = skip = 0
    auth_bad = False
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(process_one, n, token): n for n in files}
        for fut in as_completed(futs):
            name, result = fut.result()
            if result == "SKIP_DONE":
                skip += 1
                continue
            if result == "OK":
                done += 1
                print(f"[OK] {name} ({done} done, {fail} fail, {skip} skip)")
            else:
                fail += 1
                print(f"[FAIL] {name}: {result}")
                if "AUTH" in result or "401" in result:
                    auth_bad = True
    print(f"[SUMMARY] done={done} fail={fail} skip={skip} auth_bad={auth_bad}")


if __name__ == "__main__":
    main()

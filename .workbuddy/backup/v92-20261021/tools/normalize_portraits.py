# -*- coding: utf-8 -*-
"""幂等将领头像归一化批处理：erase -> matting -> enhance -> to_webp。

对热血三国将领头像（WebP）做"归一化"（非重绘）：
  1) erase   —— 擦掉右上角水印（干净图也安全，无变化则保持）
  2) matting —— 抠干净透明底（修复 enhance 吃透明底变黑底的 bug）
  3) enhance —— 统一亮度/对比/清晰度，保持 alpha 通道
  4) to_webp —— 工具固定输出 PNG，这里用 Pillow 转回 WebP（lossless，保透明）
               游戏 portraits.js 硬引用 .webp 后缀，必须保持 WebP 输出

输入 : assets/portraits/*.webp (30) + assets/portraits/pool/*.webp (40) = 70 张
输出 : assets/portraits_normalized/*.webp + assets/portraits_normalized/pool/*.webp
       （已存在则幂等跳过；确认质量后由上层原子替换回 assets/portraits/）

用法 :
  python tools/normalize_portraits.py <clientTempToken> [workers=3] [limit=0] [contains=""]

token 过期时脚本停止并报告；上层重取 token 后续跑即可，已完成项自动跳过。
路径基于本脚本位置推导，不依赖具体机器盘符。
"""
import subprocess, json, os, sys, glob
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (源目录, 输出目录)
PAIRS = [
    (os.path.join(BASE, "assets", "portraits"),
     os.path.join(BASE, "assets", "portraits_normalized")),
    (os.path.join(BASE, "assets", "portraits", "pool"),
     os.path.join(BASE, "assets", "portraits_normalized", "pool")),
]

SCRIPT = os.environ.get(
    "BUDDY_IMG_SCRIPT",
    r"E:\Workbuddy1\resources\app.asar.unpacked\resources\plugins\workbuddy-builtin\skills\buddy-image-processing\scripts\buddy-image-processing.py",
)
PY = os.environ.get(
    "WORKBUDDY_PY",
    r"C:\Users\18811\.workbuddy\binaries\python\versions\3.13.12\python.exe",
)
# 隔离 venv 里的 Pillow（转 WebP 用）
PIL_PY = os.environ.get(
    "PIL_PY",
    r"C:\Users\18811\.workbuddy\binaries\python\envs\default\Scripts\python.exe",
)

ERASE_PROMPT = "Remove any small text watermark or logo in the top-right corner if present, otherwise keep the image completely unchanged"
ENHANCE_PROMPT = "Unify brightness and contrast, improve clarity and tonal consistency, keep original style and colors"


def run(op, src, token, prompt=""):
    cmd = [PY, SCRIPT, "image-edit", "--operation", op,
           "--image-file", src, "--token", token]
    if prompt:
        cmd += ["--prompt", prompt]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
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


CONVERT_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "webp_convert.py")


def to_webp(png_path, webp_path):
    """用隔离 venv 的 Pillow 把 PNG(带alpha) 转 WebP(lossless)，返回 (ok, msg)。"""
    r = subprocess.run([PIL_PY, CONVERT_SCRIPT, png_path, webp_path],
                       capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        return False, "CONV_FAIL:" + (r.stderr[-300:] or r.stdout[-300:])
    return True, "OK"


def process_one(src, out_dir, token):
    name = os.path.basename(src)
    base = os.path.splitext(name)[0]
    target = os.path.join(out_dir, base + ".webp")
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
    # 4) PNG -> WebP (lossless, keep alpha)
    ok, m = to_webp(p3, target)
    if not ok:
        return name, "FAIL_WEBP:" + m
    # cleanup temp pngs
    for t in (p1, p2, p3):
        try:
            os.remove(t)
        except OSError:
            pass
    return name, "OK"


def main():
    token = sys.argv[1]
    workers = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    only = sys.argv[4] if len(sys.argv) > 4 else ""

    tasks = []  # (src, out_dir)
    for src_dir, out_dir in PAIRS:
        os.makedirs(out_dir, exist_ok=True)
        for f in sorted(glob.glob(os.path.join(src_dir, "*.webp"))):
            tasks.append((f, out_dir))
    if only:
        tasks = [t for t in tasks if only in os.path.basename(t[0])]
    if limit:
        tasks = tasks[:limit]

    print(f"[INFO] base={BASE} total={len(tasks)} workers={workers} token_prefix={token[:8]}...")

    done = fail = skip = 0
    auth_bad = False
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(process_one, s, o, token): s for s, o in tasks}
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

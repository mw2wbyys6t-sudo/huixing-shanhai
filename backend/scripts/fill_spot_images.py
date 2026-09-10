# -*- coding: utf-8 -*-
"""
为 images 为空的景区补充 Wikimedia Commons 真实图片
- 按景区中文名在 Commons 检索文件，逐个验证可访问（Special:FilePath HEAD 200）
- 直连失败自动切换本地代理（Clash 7897）
- 结果同步写入 data/scenic_spots.json 与 frontend/lib/scenic_data.json
"""
import json
import os
import subprocess
import time
from pathlib import Path
from urllib.parse import quote

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROXY = "http://127.0.0.1:7897"
SPOTS_PATH = BASE_DIR / "data" / "scenic_spots.json"
FE_PATH = BASE_DIR / "frontend" / "lib" / "scenic_data.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) huixing-crawler/1.0"


def curl(url: str, head: bool = False, timeout: int = 20) -> int:
    """直连失败自动走代理，返回最终 HTTP 状态码"""
    for use_proxy in (False, True):
        cmd = ["curl", "-s", "--max-time", str(timeout), "-o", os.devnull, "-w", "%{http_code}",
               "-A", UA, "-L"]
        if use_proxy:
            cmd += ["-x", PROXY]
        if head:
            cmd += ["-I"]
        cmd.append(url)
        try:
            code = subprocess.check_output(cmd, timeout=timeout + 10).decode().strip()
            if code.isdigit() and int(code) > 0:
                return int(code)
        except (subprocess.SubprocessError, OSError):
            continue
    return 0


def commons_image(query: str) -> str | None:
    api = ("https://commons.wikimedia.org/w/api.php?action=query&list=search"
           f"&srsearch={quote(query)}&srnamespace=6&srlimit=6&format=json")
    code, body = _curl_body(api)
    if code != 200:
        return None
    try:
        hits = json.loads(body)["query"]["search"]
    except (json.JSONDecodeError, KeyError):
        return None
    for hit in hits:
        title = hit.get("title", "")
        if title.lower().rsplit(".", 1)[-1] not in ("jpg", "jpeg", "png"):
            continue
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{quote(title[5:])}?width=800"
        vcode = curl(url, head=True, timeout=25)
        if vcode == 200:
            return url
        time.sleep(0.3)
    return None


def _curl_body(url: str) -> tuple[int, bytes]:
    for use_proxy in (False, True):
        cmd = ["curl", "-s", "--max-time", "20", "-A", UA, "-L"]
        if use_proxy:
            cmd += ["-x", PROXY]
        cmd.append(url)
        try:
            raw = subprocess.check_output(cmd, timeout=30)
            first = raw[:200].lstrip()
            if first.startswith(b"{") or first.startswith(b"["):
                return 200, raw
        except (subprocess.SubprocessError, OSError):
            continue
    return 0, b""



def main():
    spots = json.loads(SPOTS_PATH.read_text(encoding="utf-8"))
    fe = json.loads(FE_PATH.read_text(encoding="utf-8"))
    fe_by_id = {s["id"]: s for s in fe}

    todo = [s for s in spots if not s.get("images")]
    print(f"待补图片: {len(todo)} 个景区")
    done = 0
    for i, spot in enumerate(todo):
        img = commons_image(spot["name"])
        if img:
            spot["images"] = [img]
            if spot["id"] in fe_by_id:
                fe_by_id[spot["id"]]["images"] = [img]
            done += 1
            print(f"[{i+1}/{len(todo)}] {spot['name']}: ✓ {img.split('/')[-1][:50]}")
        else:
            print(f"[{i+1}/{len(todo)}] {spot['name']}: ✗ 未找到")
        # 每处理完 8 个落盘一次（中断不丢进度）
        if (i + 1) % 8 == 0 or i == len(todo) - 1:
            SPOTS_PATH.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
            FE_PATH.write_text(json.dumps(fe, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(0.5)

    print(f"\n完成: 补图 {done}/{len(todo)}")


if __name__ == "__main__":
    main()

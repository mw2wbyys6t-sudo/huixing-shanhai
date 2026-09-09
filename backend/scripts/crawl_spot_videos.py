# -*- coding: utf-8 -*-
"""
景区宣传视频采集（哔哩哔哩公开数据）
- 每个景区搜索「名称 宣传片/航拍」，按综合排序取首个合适视频
- 视频详情 API 二次验证（标题/UP主/时长），过滤直播回放与超短视频
- 仅采集公开元数据（BV号/标题/UP主/时长/封面），前端用 B站官方外链播放器嵌入
- 请求间隔 1.5s，cookie 失效自动重取

用法：python backend/scripts/crawl_spot_videos.py
输出：data/scenic_videos.json  {spot_id: {bvid, title, author, mid, url, pic, duration}}
"""
import json
import re
import subprocess
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent  # 仓库根
SPOTS_PATH = BASE_DIR / "data" / "scenic_spots.json"
OUT_PATH = BASE_DIR / "data" / "scenic_videos.json"
COOKIE_PATH = Path(__file__).resolve().parent / ".bili_cookies.txt"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
SEARCH_INTERVAL = 1.5  # 秒，限速防风控
MIN_DURATION = 30      # 过滤 <30s 碎片
MAX_DURATION = 1200    # 过滤 >20min 长视频（纪录片/合集）

# 标题里出现即跳过（非宣传片内容）
BLACKLIST = ["直播回放", "录播", "攻略", "避雷", "排队", "vlog", "VLOG", "打卡路线"]


def curl_json(url: str, referer: str = "https://www.bilibili.com") -> dict:
    """带浏览器头与 cookie 的 GET，返回 JSON；cookie 失效（-412）自动重取一次"""
    for attempt in range(2):
        cmd = [
            "curl", "-s", "--max-time", "15",
            "-A", UA,
            "-H", f"Referer: {referer}",
            "-H", "Accept: application/json",
        ]
        if COOKIE_PATH.exists():
            cmd += ["-b", str(COOKIE_PATH)]
        cmd.append(url)
        try:
            raw = subprocess.check_output(cmd, timeout=25).decode("utf-8", "ignore")
        except (subprocess.SubprocessError, OSError):
            time.sleep(3)
            continue
        if not raw.strip().startswith("{"):
            time.sleep(3)  # HTML 风控页 → 刷新 cookie 重试
            refresh_cookies()
            continue
        data = json.loads(raw)
        if data.get("code") == -412:
            refresh_cookies()
            time.sleep(3)
            continue
        return data
    return {}


def refresh_cookies():
    """访问 B站首页取访客 cookie（bvid3 等），绕过无 cookie 风控"""
    try:
        subprocess.check_output([
            "curl", "-s", "--max-time", "15", "-c", str(COOKIE_PATH),
            "-A", UA, "https://www.bilibili.com/", "-o", str(Path(__file__).parent / ".bili_home.html"),
        ], timeout=25)
    except (subprocess.SubprocessError, OSError):
        pass


def pick_video(result: dict) -> dict | None:
    """从搜索结果里挑第一个合格的宣传片"""
    for item in (result.get("data", {}) or {}).get("result", [])[:10]:
        title = re.sub(r"<[^>]+>", "", item.get("title", ""))  # 去掉高亮 <em class=...>
        bvid = item.get("bvid", "")
        author = item.get("author", "")
        duration = item.get("duration", "")  # "5:36" 或 "1:02:11"
        if not bvid or not author:
            continue
        if any(b in title for b in BLACKLIST):
            continue
        secs = _duration_to_secs(duration)
        if secs is None or not (MIN_DURATION <= secs <= MAX_DURATION):
            continue
        return {"bvid": bvid, "title": title, "author": author, "mid": item.get("mid", 0), "duration": secs}
    return None


def _duration_to_secs(text: str) -> int | None:
    parts = text.strip().split(":")
    if not all(p.isdigit() for p in parts) or len(parts) > 3:
        return None
    secs = 0
    for p in parts:
        secs = secs * 60 + int(p)
    return secs


def main():
    spots = json.loads(SPOTS_PATH.read_text(encoding="utf-8"))
    existing = {}
    if OUT_PATH.exists():
        try:
            existing = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            existing = {}

    refresh_cookies()
    time.sleep(1)

    done, missed = 0, []
    for i, spot in enumerate(spots):
        sid, name = spot["id"], spot["name"]
        if sid in existing and existing[sid].get("bvid"):
            done += 1
            continue

        # 依次尝试两组关键词
        video = None
        for kw in (f"{name} 宣传片", f"{name} 航拍风光"):
            from urllib.parse import quote
            url = ("https://api.bilibili.com/x/web-interface/search/type"
                   f"?search_type=video&keyword={quote(kw)}&page=1")
            result = curl_json(url, referer="https://search.bilibili.com")
            if result.get("code") == 0:
                video = pick_video(result)
                if video:
                    break
            time.sleep(SEARCH_INTERVAL)

        if not video:
            missed.append(f"{sid} {name}")
            print(f"[{i+1}/{len(spots)}] {name}: 未找到合适视频")
            continue

        # 详情 API 验证 + 补全字段（封面/准确标题）
        detail = curl_json(f"https://api.bilibili.com/x/web-interface/view?bvid={video['bvid']}")
        if detail.get("code") == 0:
            d = detail["data"]
            video["title"] = d.get("title", video["title"])
            video["pic"] = d.get("pic", "")
            video["duration"] = d.get("duration", video["duration"])
        else:
            print(f"[{i+1}/{len(spots)}] {name}: 详情验证失败({detail.get('code')})，跳过")
            missed.append(f"{sid} {name}")
            continue

        existing[sid] = {
            "bvid": video["bvid"],
            "title": video["title"],
            "author": video["author"],
            "mid": video["mid"],
            "url": f"https://www.bilibili.com/video/{video['bvid']}",
            "pic": video.get("pic", ""),
            "duration": video["duration"],
        }
        done += 1
        print(f"[{i+1}/{len(spots)}] {name}: {video['title'][:40]} @ {video['author']}")

        OUT_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=1), encoding="utf-8")
        time.sleep(SEARCH_INTERVAL)

    print(f"\n完成：{done}/{len(spots)}，未找到：{len(missed)}")
    for m in missed:
        print("  -", m)


if __name__ == "__main__":
    main()

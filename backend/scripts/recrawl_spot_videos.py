# -*- coding: utf-8 -*-
"""
视频重爬：对首次搜索匹配不合格的 16 个国际景区，用定制关键词重新采集
- 每景区按顺序尝试多个关键词，命中即停
- 强化黑名单：过滤动漫混剪/教程/企业品牌片/影视盘点等
- 仍然逐条经 B站详情 API 验证
"""
import json
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).parent))
import crawl_spot_videos as base

VIDEOS_PATH = BASE_DIR / "data" / "scenic_videos.json"

# 强化黑名单（在基础黑名单上追加）
base.BLACKLIST += ["综漫", "动漫", "考研", "手绘", "教程", "公开课", "开箱", "桌游",
                   "片头曲", "主题曲", "MV", "企业", "品牌形象", "舞台剧", "占卜", "灵签",
                   "名场面", "被毁", "省流", "拼出", "新闻", "热搜"]

# 不合格景区 → 定制关键词（按序尝试）
REDO = {
    "GL-0001": ["埃菲尔铁塔 航拍 4K", "巴黎埃菲尔铁塔 风光"],
    "GL-0003": ["凡尔赛宫 4K 风光", "凡尔赛宫 航拍"],
    "GL-0004": ["罗马斗兽场 航拍", "罗马斗兽场 4K 风光"],
    "GL-0006": ["新天鹅堡 航拍 4K", "德国新天鹅堡 风光"],
    "GL-0007": ["圣托里尼 航拍 4K", "圣托里尼 风光"],
    "GL-0013": ["富士山 航拍 4K", "富士山 风光 日本"],
    "GL-0014": ["京都金阁寺 4K", "京都金阁寺 风光"],
    "GL-0016": ["东京浅草寺 散步 4K", "浅草寺 风光"],
    "GL-0017": ["首尔景福宫", "景福宫 换岗"],
    "GL-0018": ["吴哥窟 航拍", "吴哥窟 4K 风光"],
    "GL-0023": ["美国大峡谷 航拍", "Grand Canyon 航拍 大峡谷"],
    "GL-0026": ["金门大桥 航拍 4K", "金门大桥 风光 旧金山"],
    "GL-0028": ["里约热内卢 基督像 航拍", "基督救世主 里约 航拍"],
    "GL-0029": ["埃及金字塔 航拍 4K", "吉萨金字塔 风光"],
    "GL-0031": ["大堡礁 航拍", "大堡礁 浮潜 风光"],
    "GL-0032": ["乌鲁鲁 航拍", "艾尔斯岩 乌鲁鲁 日落"],
}


def main():
    videos = json.loads(VIDEOS_PATH.read_text(encoding="utf-8"))
    spots = {s["id"]: s["name"] for s in json.loads(
        (BASE_DIR / "data" / "scenic_spots.json").read_text(encoding="utf-8"))}

    # 清掉不合格条目，强制重爬
    for sid in REDO:
        videos.pop(sid, None)

    base.refresh_cookies()
    time.sleep(1)

    fixed, still_missing = 0, []
    for i, (sid, keywords) in enumerate(REDO.items(), 1):
        name = spots[sid]
        video = None
        from urllib.parse import quote
        for kw in keywords:
            url = ("https://api.bilibili.com/x/web-interface/search/type"
                   f"?search_type=video&keyword={quote(kw)}&page=1")
            result = base.curl_json(url, referer="https://search.bilibili.com")
            if result.get("code") == 0:
                video = base.pick_video(result)
                if video:
                    break
            time.sleep(base.SEARCH_INTERVAL)

        if not video:
            still_missing.append(sid)
            print(f"[{i}/{len(REDO)}] {name}: 关键词用尽仍无合格视频")
            continue

        detail = base.curl_json(f"https://api.bilibili.com/x/web-interface/view?bvid={video['bvid']}")
        if detail.get("code") == 0:
            d = detail["data"]
            video["title"] = d.get("title", video["title"])
            video["pic"] = d.get("pic", "")
            video["duration"] = d.get("duration", video["duration"])
        else:
            still_missing.append(sid)
            continue

        videos[sid] = {
            "bvid": video["bvid"], "title": video["title"], "author": video["author"],
            "mid": video["mid"], "url": f"https://www.bilibili.com/video/{video['bvid']}",
            "pic": video.get("pic", ""), "duration": video["duration"],
        }
        fixed += 1
        print(f"[{i}/{len(REDO)}] {name}: {video['title'][:40]} @ {video['author']}")
        time.sleep(base.SEARCH_INTERVAL)

    VIDEOS_PATH.write_text(json.dumps(videos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n重爬成功 {fixed}/{len(REDO)}，仍未找到：{still_missing}")


if __name__ == "__main__":
    main()

"""
为 images 为空的景区补充 Commons 真实图片
- 复用 expand_spots.py 中的关键词映射
- 文件名黑名单过滤地图/徽标类杂图
- 不逐张验证（Commons 搜索结果必然存在；Special:FilePath 重定向链路在部分网络下超时会误杀）
"""
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent))
from expand_spots import NEW_SPOTS, COMMONS_API, FILE_PATH  # noqa: E402

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
SPOTS_PATH = DATA_DIR / "scenic_spots.json"

# 文件名黑名单：这类文件不是风景照
BAD_WORDS = ("map", "logo", "icon", "flag", "coat", "emblem", "seal", "chart", "diagram",
             "plan", "stamp", "banner", "sign", "ticket", "badge")

KEYWORD_BY_NAME = {m["name"]: m["_img_keyword"] for m in NEW_SPOTS if "_img_keyword" in m}


def pick_image(client: httpx.Client, keyword: str) -> str | None:
    try:
        r = client.get(COMMONS_API, params={
            "action": "query",
            "list": "search",
            "srsearch": f"{keyword} filetype:bitmap",
            "srnamespace": 6,
            "srlimit": 8,
            "format": "json",
        }, timeout=20)
        results = r.json().get("query", {}).get("search", [])
        # 第一轮：优先文件名含关键词的
        candidates = []
        for item in results:
            filename = item.get("title", "").replace("File:", "")
            lower = filename.lower()
            if not lower.endswith((".jpg", ".jpeg", ".png")):
                continue
            if any(bad in lower for bad in BAD_WORDS):
                continue
            score = 0 if keyword.split()[0].lower() in lower else 1
            candidates.append((score, filename))
        if not candidates:
            return None
        candidates.sort(key=lambda c: c[0])
        filename = candidates[0][1]
        import urllib.parse
        quoted = urllib.parse.quote(filename)
        return f"{FILE_PATH}{quoted}?width=800"
    except Exception as e:
        print(f"  [warn] {keyword}: {e}")
        return None


def main():
    spots = json.loads(SPOTS_PATH.read_text(encoding="utf-8"))
    need = [s for s in spots if not s.get("images") and s["name"] in KEYWORD_BY_NAME]
    print(f"待补图景区: {len(need)} 个\n")

    client = httpx.Client(headers={"User-Agent": "HuixingShanhai/1.0 (travel demo; contact: local)"})
    ok, fail = 0, []
    for i, s in enumerate(need):
        keyword = KEYWORD_BY_NAME[s["name"]]
        print(f"[{i+1}/{len(need)}] {s['name']} ({keyword}) ...", end=" ")
        url = pick_image(client, keyword)
        if url:
            s["images"] = [url]
            ok += 1
            print("✓")
        else:
            fail.append(s["name"])
            print("✗")
        time.sleep(2.5)

    SPOTS_PATH.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n补图成功 {ok} 个，失败 {len(fail)} 个")
    if fail:
        print("仍无图:", ", ".join(fail))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""
景区扩充构建器：合并新批次景区数据到 data/scenic_spots.json 与 frontend/lib/scenic_data.json
- 新景区统一 level=5A，id 沿 CN 编号顺延
- 按名称去重（与既有库冲突的跳过）
- rating/review_count/avoid 由确定性哈希生成（可复现，非随机）
- images 初始为空，由 Commons 图片爬虫补充
"""
import hashlib
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from spots_east import SPOTS as EAST  # noqa: E402
from spots_central import SPOTS as CENTRAL  # noqa: E402
from spots_west import SPOTS as WEST  # noqa: E402
from spots_extra import SPOTS as EXTRA  # noqa: E402

ALL = EAST + CENTRAL + WEST + EXTRA


def h(key: str, lo: float, hi: float) -> float:
    """确定性哈希取 [lo, hi] 浮点"""
    v = int(hashlib.md5(key.encode("utf-8")).hexdigest(), 16)
    return round(lo + (v % 1000) / 1000 * (hi - lo), 1)


def build_spot(idx: int, raw: tuple) -> dict:
    name, province, city, lat, lng, stype, season, tags, desc = raw
    key = f"CN-{idx:04d}"
    return {
        "id": key,
        "name": name,
        "province": province,
        "city": city,
        "type": stype,
        "level": "5A",
        "rating": h("r" + key, 4.3, 4.8),
        "review_count": f"{h('v' + key, 1.2, 9.6)}w".replace(".0w", "w"),
        "description": desc,
        "images": [],
        "latitude": lat,
        "longitude": lng,
        "best_season": season,
        "tags": tags,
        "avoid": {
            "avoid_index": h("a" + key, 1.8, 2.9),
            "avoid_tags": ["旺季人多", "提前订票", "关注天气"],
            "best_time": season,
            "tips": "热门时段建议提前在官方渠道实名预约购票，错峰出行体验更佳。",
        },
    }


def main():
    spots_path = BASE_DIR / "data" / "scenic_spots.json"
    fe_path = BASE_DIR / "frontend" / "lib" / "scenic_data.json"

    spots = json.loads(spots_path.read_text(encoding="utf-8"))
    fe = json.loads(fe_path.read_text(encoding="utf-8"))
    existing_names = {s["name"] for s in spots}
    next_id = 61 + sum(1 for s in spots if s["id"].startswith("CN-") and int(s["id"].split("-")[1]) >= 61)
    # 现有 CN 编号最大值 +1
    cn_nums = [int(s["id"].split("-")[1]) for s in spots if s["id"].startswith("CN-")]
    next_id = max(cn_nums) + 1

    added, skipped = [], []
    for raw in ALL:
        name = raw[0]
        if name in existing_names:
            skipped.append(name)
            continue
        spot = build_spot(next_id, raw)
        spots.append(spot)
        fe.append(json.loads(json.dumps(spot)))
        existing_names.add(name)
        added.append(f"{spot['id']} {name}")
        next_id += 1

    spots_path.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
    fe_path.write_text(json.dumps(fe, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"新增 {len(added)} 条，跳过重名 {len(skipped)}：{skipped}")
    print(f"总景区数: {len(spots)}（国内 {sum(1 for s in spots if s['id'].startswith('CN-'))} + 国际 {sum(1 for s in spots if s['id'].startswith('GL-'))}）")
    for line in added:
        print(" -", line)


if __name__ == "__main__":
    main()

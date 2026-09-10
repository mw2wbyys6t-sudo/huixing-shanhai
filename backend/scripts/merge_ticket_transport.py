# -*- coding: utf-8 -*-
"""门票与交通数据合并：ticket/transport 字段写入双端景区 JSON"""
import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tickets_a import DATA as A  # noqa: E402
from tickets_b import DATA as B  # noqa: E402
from tickets_c import DATA as C  # noqa: E402
from tickets_gl import DATA as GL  # noqa: E402

ALL = {**A, **B, **C, **GL}


def main():
    spots_path = BASE_DIR / "data" / "scenic_spots.json"
    fe_path = BASE_DIR / "frontend" / "lib" / "scenic_data.json"

    spots = json.loads(spots_path.read_text(encoding="utf-8"))
    fe = json.loads(fe_path.read_text(encoding="utf-8"))
    fe_by_id = {s["id"]: s for s in fe}

    filled, missed = 0, []
    for s in spots:
        entry = ALL.get(s["id"])
        if not entry:
            missed.append(s["id"])
            continue
        s["ticket"] = entry[0]
        s["transport"] = entry[1]
        f = fe_by_id.get(s["id"])
        if f:
            f["ticket"] = entry[0]
            f["transport"] = entry[1]
        filled += 1

    spots_path.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
    fe_path.write_text(json.dumps(fe, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"已填入 {filled} 条门票与交通数据；未覆盖 {len(missed)}：{missed}")
    print(f"总景区数: {len(spots)}")


if __name__ == "__main__":
    main()

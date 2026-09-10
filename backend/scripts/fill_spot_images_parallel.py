# -*- coding: utf-8 -*-
"""
并行版图片补全：5 线程并发检索 Commons（每线程独立 curl 进程，无共享冲突）
- 只处理 images 为空的景区，断点续跑
- 结果带锁写入，每 10 个落盘一次
"""
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from fill_spot_images import commons_image

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SPOTS_PATH = BASE_DIR / "data" / "scenic_spots.json"
FE_PATH = BASE_DIR / "frontend" / "lib" / "scenic_data.json"

lock = threading.Lock()
progress = {"done": 0, "ok": 0}


def worker(spot: dict) -> None:
    img = commons_image(spot["name"])
    with lock:
        spot["images"] = [img] if img else []
        progress["done"] += 1
        progress["ok"] += 1 if img else 0
        done, ok = progress["done"], progress["ok"]
        if img:
            print(f"[{done}] {spot['name']}: ✓", flush=True)
        else:
            print(f"[{done}] {spot['name']}: ✗ 未找到", flush=True)
        if done % 10 == 0:
            _flush()


def _flush():
    global spots_ref, fe_ref
    SPOTS_PATH.write_text(json.dumps(spots_ref, ensure_ascii=False, indent=2), encoding="utf-8")
    FE_PATH.write_text(json.dumps(fe_ref, ensure_ascii=False, indent=2), encoding="utf-8")


spots_ref = fe_ref = None


def main():
    global spots_ref, fe_ref
    spots = json.loads(SPOTS_PATH.read_text(encoding="utf-8"))
    fe = json.loads(FE_PATH.read_text(encoding="utf-8"))
    fe_by_id = {s["id"]: s for s in fe}
    todo = [s for s in spots if not s.get("images")]
    print(f"待补图片: {len(todo)}", flush=True)
    spots_ref, fe_ref = spots, fe

    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(worker, s): s for s in todo}
        for f in as_completed(futures):
            f.result()

    _flush()
    print(f"\n完成: 补图 {progress['ok']}/{len(todo)}", flush=True)


if __name__ == "__main__":
    main()

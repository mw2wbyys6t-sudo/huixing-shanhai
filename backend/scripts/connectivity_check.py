"""
全链路连通性检查
覆盖：后端全部端点、数据库、静态文件服务、DeepSeek、高德（地理编码/天气）、外部依赖状态。

用法：
  python scripts/connectivity_check.py          # 基础检查（不调 LLM）
  python scripts/connectivity_check.py --full   # 含 DeepSeek 真实调用验证
"""
import io
import os
import re
import struct
import sys
import tempfile
import time
import zlib
import secrets
from pathlib import Path

_tmp_db = Path(tempfile.mkdtemp()) / "conn_check.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.as_posix()}"

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402

PASSED, FAILED, SKIPPED = [], [], []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        PASSED.append(name)
        print(f"  ✓ {name}" + (f"  ({detail})" if detail else ""))
    else:
        FAILED.append(f"{name} {detail}")
        print(f"  ✗ {name}  {detail}")


def skip(name: str, reason: str):
    SKIPPED.append(name)
    print(f"  - {name}  (跳过: {reason})")


def make_tiny_png() -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * 8 for _ in range(8))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def main():
    full = "--full" in sys.argv
    phone = f"136{int(time.time()) % 10000000000:08d}"[:11]
    TEST_PASSWORD = secrets.token_hex(8)  # 每次运行随机生成，避免硬编码

    print("=" * 62)
    print("慧行山海 · 全链路连通性检查")
    print("=" * 62)

    with TestClient(app_module := __import__("app.main", fromlist=["app"]).app) as client:
        # ---------- 后端核心接口 ----------
        print("\n[后端 · 景区数据]")
        r = client.get("/api/stats")
        check("统计 /api/stats", r.status_code == 200 and (r.json().get("total_spots") or 0) >= 60)
        r = client.get("/api/spots?page_size=5")
        check("列表 /api/spots", r.status_code == 200 and len(r.json().get("items", [])) == 5)
        r = client.get("/api/spots/CN-0004")
        check("详情 /api/spots/{id}", r.status_code == 200 and r.json().get("name"))
        r = client.get("/api/spots/search", params={"q": "山"})
        check("搜索 /api/spots/search", r.status_code == 200)
        r = client.get("/api/spots/recommend")
        check("推荐 /api/spots/recommend", r.status_code == 200)
        r = client.get("/api/provinces")
        check("省份 /api/provinces", r.status_code == 200 and r.json().get("total", 0) >= 5)
        r = client.get("/api/avoid/batch")
        check("批量避雷 /api/avoid/batch", r.status_code == 200 and (r.json().get("count") or 0) >= 60)
        r = client.get("/api/avoid/batch/CN-0004")
        check("单景区避雷 /api/avoid/batch/{id}", r.status_code == 200 and r.json().get("success"))

        print("\n[后端 · 认证与用户]")
        r = client.post("/api/auth/send-code", params={"phone": phone})
        code = ""
        if r.status_code == 200:
            m = re.search(r"\b(\d{6})\b", r.json().get("message", ""))
            code = m.group(1) if m else ""
        check("发送验证码", r.status_code == 200 and bool(code))
        r = client.post("/api/auth/register", json={"phone": phone, "code": code, "password": TEST_PASSWORD})
        token = r.json().get("token", "")
        check("注册", r.status_code == 200 and bool(token))
        headers = {"Authorization": f"Bearer {token}"}
        r = client.get("/api/auth/user", params={"token": token})
        check("token 换取用户", r.status_code == 200)

        print("\n[后端 · 评价与 UGC]")
        r = client.post("/api/reviews/submit", data={
            "spot_id": "CN-0004", "spot_name": "盘山风景名胜区", "user_name": "连通检查",
            "rating": 4, "content": "连通性检查评价",
        })
        check("提交评价", r.status_code == 200)
        r = client.get("/api/reviews/CN-0004")
        ok = r.status_code == 200 and r.json().get("data_source") == "internal" and r.json().get("summary", {}).get("total_reviews", 0) >= 1
        check("评价聚合（站内真实统计）", ok)
        r = client.get("/api/reviews/list/CN-0004")
        check("评价列表", r.status_code == 200)

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0004", "spot_name": "盘山风景名胜区", "rating": "5", "description": "连通检查",
        }, files={"file": ("c.png", io.BytesIO(make_tiny_png()), "image/png")}, headers=headers)
        image_url = r.json().get("image_url", "")
        check("上传实拍（需登录）", r.status_code == 200 and image_url.startswith("/uploads/"))
        r = client.get(image_url)
        check("静态文件服务 /uploads", r.status_code == 200 and r.content[:4] == b"\x89PNG")
        r = client.get("/api/ugc/photos/CN-0004")
        check("UGC 实拍列表", r.status_code == 200 and r.json().get("total", 0) >= 1)
        r = client.get("/api/workflow/logs")
        check("工作流日志 /api/workflow/logs", r.status_code == 200)

        print("\n[后端 · 避雷分析]")
        r = client.post("/api/avoid/analyze", json={"spot_id": "CN-0004", "spot_name": "盘山", "reviews": []})
        check("避雷分析 · 无评价诚实空态", r.status_code == 200 and r.json().get("success") is False)

        print("\n[外部依赖 · 高德]")
        r = client.get("/api/weather", params={"city": "北京"})
        if r.status_code == 200 and r.json().get("temperature"):
            w = r.json()
            check("高德天气（经后端）", True, f"{w['city']} {w['temperature']}°C {w['weather']}")
        else:
            check("高德天气（经后端）", False, r.json().get("detail", "")[:60])

        r = client.get("/api/spots/CN-0001/food")
        if r.status_code == 200 and r.json().get("items"):
            first = r.json()["items"][0]
            check("高德周边美食（经后端）", True, f"{first['name']} · {first.get('distance')}m")
        else:
            check("高德周边美食（经后端）", False, r.json().get("detail", "")[:60])

        r = client.get("/api/food/city", params={"city": "成都"})
        if r.status_code == 200 and r.json().get("items"):
            first = r.json()["items"][0]
            check("高德城市美食（经后端）", True, first["name"])
        else:
            check("高德城市美食（经后端）", False, r.json().get("detail", "")[:60])

        print("\n[外部依赖 · DeepSeek]")
        if full:
            try:
                resp = httpx.post(
                    f"{config.DEEPSEEK_BASE_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {config.DEEPSEEK_API_KEY}"},
                    json={"model": config.DEEPSEEK_MODEL, "messages": [{"role": "user", "content": "回复OK"}], "max_tokens": 4},
                    timeout=20,
                )
                ok = resp.status_code == 200 and resp.json()["choices"][0]["message"]["content"]
                check("DeepSeek API", ok, resp.json()["choices"][0]["message"]["content"][:10] if ok else resp.text[:60])
            except Exception as e:
                check("DeepSeek API", False, str(e)[:80])
        else:
            check("DeepSeek API Key 已配置", bool(config.DEEPSEEK_API_KEY), "加 --full 参数验证真实调用")

        print("\n[外部依赖 · 美团]")
        skip("美团评价聚合", "需企业资质且无公开API——已改为站内真实评价统计")

    # ---------- 前端产物（静态文件存在性） ----------
    print("\n[前端产物]")
    fe = Path(__file__).parent.parent.parent / "frontend"
    checks = [
        ("首页", fe / "out" / "index.html", "需先 npm run build"),
        ("sitemap.xml", fe / "public" / "sitemap.xml", None),
        ("robots.txt", fe / "public" / "robots.txt", None),
        ("favicon", fe / "app" / "icon.svg", None),
        ("地球贴图(蓝 marble)", fe / "public" / "textures" / "earth-blue-marble.jpg", None),
        ("地球贴图(云层2K)", fe / "public" / "textures" / "clouds.png", None),
        ("本地景区数据", fe / "lib" / "scenic_data.json", None),
    ]
    for name, path, note in checks:
        if path.exists():
            check(f"前端 {name}", True, f"{path.stat().st_size // 1024}KB")
        elif note:
            skip(f"前端 {name}", note)
        else:
            check(f"前端 {name}", False, "文件缺失")

    # ---------- 汇总 ----------
    print("\n" + "=" * 62)
    print(f"通过 {len(PASSED)} · 失败 {len(FAILED)} · 跳过 {len(SKIPPED)}")
    if FAILED:
        print("失败项：")
        for f in FAILED:
            print("  ✗", f)
        sys.exit(1)
    print("全链路连通 ✓")


if __name__ == "__main__":
    main()

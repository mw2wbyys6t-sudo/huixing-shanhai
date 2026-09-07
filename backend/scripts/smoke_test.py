"""
后端冒烟测试
覆盖：景区接口、认证闭环（注册/登录/用户/登出/密码登录/演示账号）、
上传（含校验）、UGC 列表、评价、分页校验、静态文件服务。

不含 LLM 依赖的工作流端点（/api/workflow/*）——它们需要真实 DeepSeek 调用，另行验证。
运行：python scripts/smoke_test.py
"""
import io
import os
import re
import sys
import time
import tempfile
import struct
import zlib
import secrets
from pathlib import Path

# 使用独立的临时数据库，避免污染开发数据
_tmp_db = Path(tempfile.mkdtemp()) / "smoke_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db.as_posix()}"

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

PASSED = []
FAILED = []


def check(name: str, cond: bool, detail: str = ""):
    if cond:
        PASSED.append(name)
        print(f"  ✓ {name}")
    else:
        FAILED.append(f"{name} {detail}")
        print(f"  ✗ {name}  {detail}")


def make_tiny_png() -> bytes:
    """构造一个 8x8 的合法 PNG（带 IHDR/IDAT/IEND），通过魔数校验"""
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\x00\x00" * 8 for _ in range(8))
    idat = zlib.compress(raw)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    with TestClient(app) as client:
        # ========== 景区接口 ==========
        print("\n[景区接口]")
        r = client.get("/api/spots")
        data = r.json()
        check("GET /api/spots 200", r.status_code == 200)
        check("景区总数 >= 60", (data.get("total") or 0) >= 60)
        check("分页字段完整", all(k in data for k in ("page", "page_size", "total_pages", "items")))

        r = client.get("/api/spots", params={"province": "北京市", "page_size": 5})
        check("省份筛选生效", r.json().get("total") == 2)

        r = client.get("/api/spots/CN-0001")
        check("景区详情", r.status_code == 200 and r.json().get("name") == "故宫博物院")
        check("详情含避雷数据", isinstance(r.json().get("avoid", {}).get("avoid_index"), (int, float)))

        r = client.get("/api/spots/CN-9999")
        check("不存在景区 404", r.status_code == 404)

        r = client.get("/api/spots/search", params={"q": "故宫"})
        check("搜索命中", r.status_code == 200 and r.json().get("total") >= 1)

        r = client.get("/api/spots/recommend", params={"limit": 3})
        check("推荐接口", r.status_code == 200 and len(r.json().get("items", [])) == 3)

        r = client.get("/api/stats")
        check("统计接口", r.status_code == 200 and (r.json().get("total_spots") or 0) >= 60)

        # ========== 认证闭环 ==========
        print("\n[认证闭环]")
        phone = "13900001111"
        TEST_PASSWORD = secrets.token_hex(8)  # 每次运行随机生成，避免硬编码
        r = client.post("/api/auth/send-code", params={"phone": phone})
        check("发送验证码", r.status_code == 200 and r.json().get("success") is True)
        code_match = re.search(r"\b(\d{6})\b", r.json().get("message", ""))
        check("验证码可获取(演示模式)", bool(code_match))
        code = code_match.group(1) if code_match else "000000"

        r = client.post("/api/auth/register", json={
            "phone": phone, "code": code, "password": TEST_PASSWORD, "username": "冒烟测试员",
        })
        check("注册成功", r.status_code == 200 and r.json().get("token"))
        token = r.json()["token"]
        check("注册返回用户名", r.json()["user"]["username"] == "冒烟测试员")

        r = client.get("/api/auth/user", params={"token": token})
        check("token 换取用户信息", r.status_code == 200 and r.json().get("username") == "冒烟测试员")

        # 重复注册：验证码冷却生效中，直接注入验证码完成二次注册尝试
        from app.main import MOCK_CODES  # noqa: E402
        MOCK_CODES[phone] = {"code": "123456", "expires_at": time.time() + 300}
        r = client.post("/api/auth/register", json={
            "phone": phone, "code": "123456", "password": "x" * 6,
        })
        check("重复注册 409", r.status_code == 409)

        r = client.post("/api/auth/login", json={"account": "冒烟测试员", "password": TEST_PASSWORD})
        check("密码登录(用户名)", r.status_code == 200 and r.json().get("token"))
        check("登录响应不含密码字段", "password" not in (r.json().get("user") or {}))

        r = client.post("/api/auth/login", json={"account": "冒烟测试员", "password": "wrong"})
        check("错误密码 401", r.status_code == 401)

        r = client.post("/api/auth/logout", params={"token": token})
        check("登出成功", r.status_code == 200)
        # 无状态签名 token：服务端不吊销，由客户端清除凭证（文档化设计）
        r = client.get("/api/auth/user", params={"token": token})
        check("无状态token登出后仍可解析", r.status_code == 200)

        # 验证码登录：冷却期内直接注入验证码
        from app.main import MOCK_CODES as _CODES  # noqa: E402
        _CODES[phone] = {"code": "654321", "expires_at": time.time() + 300}
        r = client.post("/api/auth/login/code", json={"phone": phone, "code": "654321"})
        check("验证码登录", r.status_code == 200 and r.json().get("token"))

        r = client.post("/api/auth/login", json={"account": "13800138000", "password": "123456"})
        check("演示账号登录", r.status_code == 200)

        # ========== 评价 ==========
        print("\n[评价]")
        r = client.post("/api/reviews/submit", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "user_name": "冒烟测试员",
            "rating": 4.5, "content": "Smoke test review：值得一看。",
        })
        check("提交评价", r.status_code == 200 and r.json().get("success"))

        r = client.get("/api/reviews/list/CN-0001")
        check("评价列表", r.status_code == 200 and r.json().get("total") >= 1)

        r = client.post("/api/reviews/submit", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "rating": 9.9, "content": "越界评分",
        })
        check("评分越界 400", r.status_code == 400)

        # ========== 上传 ==========
        print("\n[上传与静态服务]")
        png = make_tiny_png()

        # 登录态上传（新机制：无状态签名 token + Authorization 头）
        r = client.post("/api/auth/login", json={"account": "冒烟测试员", "password": TEST_PASSWORD})
        user_token = r.json().get("token", "")
        check("登录获取签名token", bool(user_token))
        auth_headers = {"Authorization": f"Bearer {user_token}"}

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "user_name": "冒烟测试员",
            "description": "冒烟测试实拍", "rating": "5",
        }, files={"file": ("test.png", io.BytesIO(png), "image/png")})
        check("匿名上传 401", r.status_code == 401)

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "user_name": "冒烟测试员",
            "description": "冒烟测试实拍", "rating": "5",
        }, files={"file": ("test.png", io.BytesIO(png), "image/png")}, headers=auth_headers)
        check("登录后上传 PNG 成功", r.status_code == 200 and r.json().get("success"))
        image_url = r.json().get("image_url", "")
        check("返回 /uploads 路径", image_url.startswith("/uploads/"))

        r = client.get(image_url)
        check("静态文件可访问", r.status_code == 200 and r.content[:4] == b"\x89PNG")

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "rating": "5",
        }, files={"file": ("evil.html", io.BytesIO(b"<script>alert(1)</script>"), "text/html")}, headers=auth_headers)
        check("非白名单扩展 400", r.status_code == 400)

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "rating": "5",
        }, files={"file": ("fake.png", io.BytesIO(b"this is not an image at all........"), "image/png")}, headers=auth_headers)
        check("魔数不符 400", r.status_code == 400)

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-0001", "spot_name": "故宫博物院", "rating": "9",
        }, files={"file": ("ok.png", io.BytesIO(png), "image/png")}, headers=auth_headers)
        check("评分越界 400", r.status_code == 400)

        r = client.post("/api/upload/photo", data={
            "spot_id": "CN-9999", "spot_name": "未知", "rating": "5",
        }, files={"file": ("ok.png", io.BytesIO(png), "image/png")}, headers=auth_headers)
        check("未知景区 400", r.status_code == 400)

        r = client.get("/api/ugc/photos/CN-0001")
        photos = r.json().get("photos", [])
        check("UGC 列表含新照片", r.status_code == 200 and len(photos) >= 1)
        check("UGC 记录含登录用户名", any(p.get("user_name") == "冒烟测试员" for p in photos))

        # ========== 参数校验 ==========
        print("\n[参数校验]")
        r = client.get("/api/ugc/list/CN-0001", params={"page_size": 999999})
        check("page_size 超限 422", r.status_code == 422)

        r = client.get("/api/ugc/list/CN-0001", params={"page": 0})
        check("page=0 拒绝 422", r.status_code == 422)

        r = client.get("/api/workflow/logs", params={"page_size": 50})
        check("工作流日志接口", r.status_code == 200)

        # ========== 首页与文档 ==========
        print("\n[其他]")
        r = client.get("/")
        check("根路径 API 信息", r.status_code == 200 and "慧行山海" in r.json().get("name", ""))

        r = client.get("/docs")
        check("Swagger 文档", r.status_code == 200)

        # ========== 限流与安全 ==========
        print("\n[限流与安全]")
        # 验证码冷却：第二次同号发送应 429
        r = client.post("/api/auth/send-code", params={"phone": "13700000001"})
        check("首次发送验证码", r.status_code == 200)
        r = client.post("/api/auth/send-code", params={"phone": "13700000001"})
        check("60秒冷却 429", r.status_code == 429)

        # 篡改 token 应 401
        r = client.get("/api/auth/user", params={"token": user_token[:-4] + "aaaa"})
        check("篡改token 401", r.status_code == 401)

    # 汇总
    print("\n" + "=" * 50)
    print(f"通过 {len(PASSED)} 项，失败 {len(FAILED)} 项")
    if FAILED:
        print("失败项：")
        for f in FAILED:
            print("  -", f)
        sys.exit(1)
    print("冒烟测试全部通过 ✓")


if __name__ == "__main__":
    main()

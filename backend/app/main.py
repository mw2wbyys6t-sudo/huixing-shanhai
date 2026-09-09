"""
慧行山海 - FastAPI 后端入口
基于 AI 与电子地图的一站式旅游规划导览平台
"""
import json
import os
import asyncio
import logging
import secrets
import time
import uuid
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# 导入服务
from app import config
from app.security import rate_limiter, create_signed_token, verify_signed_token
from app.services.deepseek_client import deepseek_client
# 美团开放平台评价接口需企业资质且无公开 API，已改为站内真实评价统计（meituan_client.py 保留备查）
from app.services.langgraph_workflow import run_langgraph_workflow
from app.services.auth_service import (
    get_user_by_account,
    get_user_by_id,
    get_user_by_phone,
    create_user,
    update_password,
    user_to_dict,
    verify_password,
    is_hashed,
)
from app.database import get_db, init_db, SessionLocal
from app.models import Review, UGCPhoto, WorkflowLog, UserPrefs
from fastapi import Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# ==================== 日志 ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("huixing")

# ==================== 配置 ====================
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"

# 高德地图 API 配置（统一从 backend/.env 读取）
AMAP_KEY = config.AMAP_KEY
AMAP_SECURITY_CODE = config.AMAP_SECURITY_CODE

# ==================== 数据模型 ====================
class AvoidIndex(BaseModel):
    avoid_index: float
    avoid_tags: List[str]
    best_time: str
    tips: str

class ScenicSpot(BaseModel):
    id: str
    name: str
    province: str
    city: str
    type: str
    level: str
    rating: float
    review_count: str
    description: str
    images: List[str]
    latitude: float
    longitude: float
    best_season: str
    tags: List[str]
    avoid: AvoidIndex

class WeatherInfo(BaseModel):
    city: str
    temperature: str
    weather: str
    wind: str
    humidity: str
    report_time: str

# ==================== 用户认证模型 ====================
class User(BaseModel):
    id: str
    phone: Optional[str] = None
    email: Optional[str] = None
    username: str
    avatar: Optional[str] = None
    created_at: str

class LoginRequest(BaseModel):
    account: str
    password: str

class CodeLoginRequest(BaseModel):
    phone: str
    code: str

class RegisterRequest(BaseModel):
    phone: str
    code: str
    password: str
    username: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    phone: str
    code: str
    new_password: str

class LoginResponse(BaseModel):
    token: str
    user: User

class SendCodeResponse(BaseModel):
    success: bool
    message: str
    expires_in: int = 300

# 模拟用户存储（演示账号；数据库用户优先）
MOCK_USERS = {
    "13800138000": {
        "id": "user_001",
        "phone": "13800138000",
        "email": "demo@huixing.com",
        "username": "旅行达人",
        "password": "123456",
        "avatar": None,
        "created_at": "2026-01-01T00:00:00Z",
    }
}

# 模拟验证码存储：phone -> {code, expires_at}
MOCK_CODES = {}

# 会话令牌：HMAC 签名（无状态），多 worker / 重启后仍可校验
if not config.SECRET_KEY:
    # 开发兜底：进程级随机密钥（仅单进程可用；部署必须配置 SECRET_KEY）
    config.SECRET_KEY = secrets.token_hex(32)
    logger.warning("未配置 SECRET_KEY，已生成进程级随机密钥（多 worker 部署将无法互通会话）")


def generate_token(user_id: str) -> str:
    """生成签名会话 token（7 天有效期）"""
    return create_signed_token(user_id, days=7)


def verify_token(token: str, db: Session) -> Optional[dict]:
    """校验签名 token 并返回用户信息（数据库用户优先，兼容演示账号）"""
    user_id = verify_signed_token(token)
    if not user_id:
        return None
    try:
        db_user = get_user_by_id(db, int(user_id))
    except (TypeError, ValueError):
        db_user = None
    if db_user:
        return user_to_dict(db_user)
    for user in MOCK_USERS.values():
        if user["id"] == user_id:
            return user
    return None


def client_ip(request: Request) -> str:
    """取客户端 IP（限流维度）"""
    return request.client.host if request.client else "unknown"


def require_rate_limit(request: Request, key: str, limit: int, window_sec: float):
    """限流检查，超限抛 429"""
    if not rate_limiter.allow(f"{key}:{client_ip(request)}", limit, window_sec):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")


def get_optional_user(request: Request, db: Session) -> Optional[dict]:
    """从 Authorization: Bearer <token> 解析当前用户（可为匿名）"""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return verify_token(auth[7:], db)

# ==================== 数据加载 ====================
def load_scenic_spots() -> List[dict]:
    """加载景区数据"""
    data_file = DATA_DIR / "scenic_spots.json"
    if not data_file.exists():
        return []
    with open(data_file, "r", encoding="utf-8") as f:
        return json.load(f)

SCENIC_SPOTS = load_scenic_spots()
logger.info(f"已加载 {len(SCENIC_SPOTS)} 个景区数据")

# ==================== FastAPI 应用 ====================
app = FastAPI(
    title="慧行山海 API",
    description="基于 AI 与电子地图的一站式旅游规划导览平台 - 后端 API",
    version="1.0.0",
)

# CORS 配置（白名单来自 backend/.env 的 ALLOWED_ORIGINS/FRONTEND_URL）
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """应用启动时初始化数据库表"""
    init_db()

# ==================== API 路由 ====================

@app.get("/")
async def root():
    """根路径 - API 信息"""
    return {
        "name": "慧行山海 API",
        "version": "1.0.0",
        "description": "基于 AI 与电子地图的一站式旅游规划导览平台",
        "endpoints": {
            "景区列表": "/api/spots",
            "景区详情": "/api/spots/{id}",
            "景区搜索": "/api/spots/search?q=关键词",
            "天气查询": "/api/weather?city=城市名",
            "避雷指数": "/api/spots/{id}/avoid",
            "推荐景区": "/api/spots/recommend?province=省份",
            "周边美食": "/api/spots/{id}/food",
            "城市美食": "/api/food/city?city=城市名",
        }
    }

@app.get("/api/spots")
async def get_spots(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    province: Optional[str] = None,
    type: Optional[str] = None,
    level: Optional[str] = None,
):
    """获取景区列表（支持分页和筛选）"""
    filtered = SCENIC_SPOTS
    
    if province:
        filtered = [s for s in filtered if province in s.get("province", "")]
    if type:
        filtered = [s for s in filtered if type in s.get("type", "")]
    if level:
        filtered = [s for s in filtered if level in s.get("level", "")]
    
    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    items = filtered[start:end]
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": items,
    }

# 注意：search / recommend 等固定路径必须声明在 {spot_id} 动态路由之前，
# 否则会被动态路由吞掉（如 /api/spots/search 会被解析为 spot_id="search"）

@app.get("/api/spots/search")
async def search_spots(q: str = Query(..., min_length=1)):
    """搜索景区（按名称、省份、城市、描述搜索）"""
    q_lower = q.lower()
    results = [
        s for s in SCENIC_SPOTS
        if q_lower in s["name"].lower()
        or q_lower in s["province"].lower()
        or q_lower in s["city"].lower()
        or q_lower in s["description"].lower()
    ]
    return {
        "query": q,
        "total": len(results),
        "items": results,
    }

@app.get("/api/spots/recommend")
async def recommend_spots(
    province: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = Query(5, ge=1, le=20),
):
    """推荐景区（按评分排序，可按省份/城市筛选）"""
    filtered = SCENIC_SPOTS
    if province:
        filtered = [s for s in filtered if province in s.get("province", "")]
    if city:
        filtered = [s for s in filtered if city in s.get("city", "")]

    # 按评分降序排序
    sorted_spots = sorted(filtered, key=lambda x: x.get("rating", 0), reverse=True)
    return {
        "total": len(sorted_spots),
        "items": sorted_spots[:limit],
    }

@app.get("/api/spots/{spot_id}")
async def get_spot_detail(spot_id: str):
    """获取景区详情"""
    spot = next((s for s in SCENIC_SPOTS if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail=f"未找到 ID 为 {spot_id} 的景区")
    return spot

@app.get("/api/spots/{spot_id}/avoid")
async def get_avoid_index(spot_id: str):
    """获取景区避雷指数"""
    spot = next((s for s in SCENIC_SPOTS if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail=f"未找到 ID 为 {spot_id} 的景区")
    return spot.get("avoid", {})

@app.get("/api/weather")
async def get_weather(city: str = Query(..., min_length=1)):
    """查询城市天气（高德天气 API）"""
    try:
        # 先用高德地理编码获取城市 adcode
        geo_url = "https://restapi.amap.com/v3/geocode/geo"
        async with httpx.AsyncClient() as client:
            geo_resp = await client.get(geo_url, params={"address": city, "key": AMAP_KEY}, timeout=10)
            geo_data = geo_resp.json()

            if geo_data.get("status") != "1" or not geo_data.get("geocodes"):
                # 常见故障：Key 平台类型不匹配（天气/地理编码 REST 接口需要"Web服务"类型 Key）
                info = geo_data.get("info", "")
                if geo_data.get("infocode") == "10009" or "PLAT_NOMATCH" in info:
                    logger.error("高德 Key 平台类型不匹配（10009）：请在高德控制台创建「Web服务」类型 Key 并更新 AMAP_KEY")
                    raise HTTPException(
                        status_code=503,
                        detail="天气服务配置有误：AMAP_KEY 需为「Web服务」类型（当前 Key 是网页地图类型）。请到高德控制台创建 Web 服务 Key。",
                    )
                raise HTTPException(status_code=404, detail=f"未找到城市 {city}")

            adcode = geo_data["geocodes"][0]["adcode"]

            # 查询天气
            weather_url = "https://restapi.amap.com/v3/weather/weatherInfo"
            weather_resp = await client.get(
                weather_url,
                params={"city": adcode, "key": AMAP_KEY, "extensions": "base"},
                timeout=10,
            )
            weather_data = weather_resp.json()
            
            if weather_data.get("status") != "1" or not weather_data.get("lives"):
                raise HTTPException(status_code=500, detail="天气查询失败")
            
            live = weather_data["lives"][0]
            return {
                "city": live.get("city", city),
                "temperature": live.get("temperature", ""),
                "weather": live.get("weather", ""),
                "wind": live.get("winddirection", "") + live.get("windpower", ""),
                "humidity": live.get("humidity", ""),
                "report_time": live.get("reporttime", ""),
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="天气 API 请求超时")
    except HTTPException:
        raise  # 已构造的 HTTPException（如 Key 类型错误 503）直接透传，不被二次包装
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"天气查询失败: {str(e)}")


# ==================== 周边美食（高德 POI 餐饮类目） ====================
# POI 数据变化慢，按坐标缓存 6 小时
_food_cache: dict = {}
_FOOD_CACHE_TTL = 6 * 3600
_FOOD_CACHE_MAX = 256


def _amap_poi_items(pois: list) -> List[dict]:
    """把高德 POI 列表转成精简的美食条目（高德缺失字段可能返回 []/list，统一兜底）"""
    items = []
    for poi in pois:
        photos = poi.get("photos") or []
        biz = poi.get("biz_ext") or {}
        tel = poi.get("tel")
        address = poi.get("address")
        atag = poi.get("atag") or ""
        distance = str(poi.get("distance", ""))
        cost = biz.get("cost")
        if isinstance(cost, list):  # 高德缺失字段可能返回空列表
            cost = cost[0] if cost else None
        cost = None if cost in (None, "") else (int(cost) if str(cost).isdigit() else cost)
        items.append({
            "id": poi.get("id", ""),
            "name": poi.get("name", ""),
            "address": address if isinstance(address, str) else "",
            "distance": int(distance) if distance.isdigit() else None,
            "tel": tel if isinstance(tel, str) else "",
            "image": photos[0].get("url") if photos and isinstance(photos[0], dict) else None,
            "tags": [t for t in atag.replace(",", ";").split(";") if t][:3],
            "rating": biz.get("rating") or None,
            "cost": cost,
            "type": (poi.get("type") or "").split(";")[-1],  # 末级类目：火锅店/日本料理…
            "location": poi.get("location", ""),  # "lng,lat"，供生成导航链接
        })
    return items


def _cache_food(key: str, data: dict):
    """写入美食缓存，容量过半时按时间淘汰最旧一半"""
    if len(_food_cache) >= _FOOD_CACHE_MAX:
        oldest = sorted(_food_cache.items(), key=lambda kv: kv[1][0])[: _FOOD_CACHE_MAX // 2]
        for k, _ in oldest:
            _food_cache.pop(k, None)
    _food_cache[key] = (time.time(), data)


@app.get("/api/spots/{spot_id}/food")
async def get_spot_food(request: Request, spot_id: str, radius: int = Query(2000, ge=500, le=10000)):
    """景区周边美食推荐（高德 POI，按景区坐标 2km 内搜索）"""
    require_rate_limit(request, "food", 30, 60)

    spot = next((s for s in SCENIC_SPOTS if s["id"] == spot_id), None)
    if not spot:
        raise HTTPException(status_code=404, detail=f"未找到 ID 为 {spot_id} 的景区")
    lng, lat = spot.get("longitude"), spot.get("latitude")
    if not lng or not lat:
        raise HTTPException(status_code=404, detail="该景区缺少坐标信息")

    cache_key = f"{lng},{lat}:{radius}"
    cached = _food_cache.get(cache_key)
    if cached and time.time() - cached[0] < _FOOD_CACHE_TTL:
        return cached[1]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://restapi.amap.com/v3/place/around",
                params={
                    "location": f"{lng},{lat}",
                    "types": "050000",  # 餐饮服务
                    "radius": radius,
                    "offset": 10,
                    "sortrule": "weight",
                    "key": AMAP_KEY,
                },
                timeout=10,
            )
            data = resp.json()

        if data.get("status") != "1":
            if data.get("infocode") == "10009":
                raise HTTPException(
                    status_code=503,
                    detail="美食服务配置有误：AMAP_KEY 需为「Web服务」类型 Key",
                )
            raise HTTPException(status_code=500, detail=f"美食查询失败: {data.get('info', '')}")

        result = {"total": len(data.get("pois", [])), "items": _amap_poi_items(data.get("pois", []))}
        if result["items"]:
            _cache_food(cache_key, result)
        return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="美食 API 请求超时")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"美食查询失败: {str(e)}")


@app.get("/api/food/city")
async def get_city_food(request: Request, city: str = Query(..., min_length=1, max_length=20)):
    """城市特色美食搜索（高德 POI，用于规划页的目的地美食推荐）"""
    require_rate_limit(request, "food-city", 30, 60)

    cache_key = f"city:{city}"
    cached = _food_cache.get(cache_key)
    if cached and time.time() - cached[0] < _FOOD_CACHE_TTL:
        return cached[1]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://restapi.amap.com/v3/place/text",
                params={
                    "keywords": "美食",
                    "city": city,
                    "citylimit": "true",
                    "types": "050000",
                    "offset": 10,
                    "key": AMAP_KEY,
                },
                timeout=10,
            )
            data = resp.json()

        if data.get("status") != "1":
            if data.get("infocode") == "10009":
                raise HTTPException(
                    status_code=503,
                    detail="美食服务配置有误：AMAP_KEY 需为「Web服务」类型 Key",
                )
            raise HTTPException(status_code=500, detail=f"美食查询失败: {data.get('info', '')}")

        pois = data.get("pois", [])
        # 高德按相关性排序时同名门店可能重复出现，按名称去重
        seen: set = set()
        unique_pois = []
        for p in pois:
            name = p.get("name", "").split("(")[0]
            if name in seen:
                continue
            seen.add(name)
            unique_pois.append(p)

        result = {"city": city, "total": len(unique_pois), "items": _amap_poi_items(unique_pois)}
        if result["items"]:
            _cache_food(cache_key, result)
        return result
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="美食 API 请求超时")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"美食查询失败: {str(e)}")

@app.get("/api/provinces")
async def get_provinces():
    """获取所有省份列表"""
    provinces = sorted(set(s["province"] for s in SCENIC_SPOTS))
    return {
        "total": len(provinces),
        "items": provinces,
    }

@app.get("/api/stats")
async def get_stats():
    """获取统计信息"""
    provinces = set(s["province"] for s in SCENIC_SPOTS)
    cities = set(s["city"] for s in SCENIC_SPOTS)
    types = set(s["type"] for s in SCENIC_SPOTS)
    avg_rating = sum(s["rating"] for s in SCENIC_SPOTS) / len(SCENIC_SPOTS) if SCENIC_SPOTS else 0
    avg_avoid = sum(s["avoid"]["avoid_index"] for s in SCENIC_SPOTS) / len(SCENIC_SPOTS) if SCENIC_SPOTS else 0
    
    return {
        "total_spots": len(SCENIC_SPOTS),
        "total_provinces": len(provinces),
        "total_cities": len(cities),
        "total_types": len(types),
        "avg_rating": round(avg_rating, 2),
        "avg_avoid_index": round(avg_avoid, 2),
        "provinces": sorted(list(provinces)),
        "types": sorted(list(types)),
    }

# ==================== 用户认证 API ====================
@app.post("/api/auth/send-code", response_model=SendCodeResponse)
async def send_verification_code(request: Request, phone: str = Query(..., description="手机号")):
    """发送短信验证码（MVP阶段返回模拟验证码）"""
    if not phone or len(phone) != 11 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="请输入正确的手机号")

    # 同一手机号 60 秒冷却；单 IP 每小时最多 10 次（防刷短信）
    if not rate_limiter.check_only(f"code-cooldown:{phone}", 1, 60):
        raise HTTPException(status_code=429, detail="发送过于频繁，请 1 分钟后再试")
    require_rate_limit(request, "send-code", 10, 3600)

    # 生成6位验证码
    code = str(uuid.uuid4().int)[-6:]
    MOCK_CODES[phone] = {
        "code": code,
        "expires_at": time.time() + 300,  # 5分钟有效
    }
    rate_limiter.allow(f"code-cooldown:{phone}", 1, 60)  # 记录冷却

    # 清理过期验证码，避免内存累积
    now = time.time()
    for p in [p for p, rec in MOCK_CODES.items() if rec["expires_at"] < now]:
        del MOCK_CODES[p]

    logger.info(f"[模拟短信] 发送验证码到 {phone}")

    return SendCodeResponse(
        success=True,
        message=f"验证码已发送到 {phone}（演示模式，验证码为 {code}）",
        expires_in=300,
    )

@app.post("/api/auth/login", response_model=LoginResponse)
async def login_with_password(request: Request, login_req: LoginRequest, db: Session = Depends(get_db)):
    """账号密码登录"""
    require_rate_limit(request, "login", 10, 60)
    account = login_req.account.strip()
    password = login_req.password

    if not account or not password:
        raise HTTPException(status_code=400, detail="请输入账号和密码")

    # 从数据库查找用户（支持手机号/邮箱/用户名登录）
    db_user = get_user_by_account(db, account)

    if db_user:
        user = user_to_dict(db_user)
        if not user.get("password"):
            raise HTTPException(status_code=400, detail="该账号未设置密码，请使用验证码登录")
        if not verify_password(password, user["password"]):
            raise HTTPException(status_code=401, detail="密码错误")
        # 历史明文密码在登录成功后透明升级为哈希存储
        if not is_hashed(user["password"]):
            update_password(db, db_user, password)
    else:
        # 兼容演示账号
        user = None
        for u in MOCK_USERS.values():
            if u.get("phone") == account or u.get("email") == account or u.get("username") == account:
                user = u
                break
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在，请先注册")
        if user.get("password") != password:
            raise HTTPException(status_code=401, detail="密码错误")

    # 生成 token
    token = generate_token(user["id"])

    return LoginResponse(
        token=token,
        user=User(
            id=user["id"],
            phone=user.get("phone"),
            email=user.get("email"),
            username=user["username"],
            avatar=user.get("avatar"),
            created_at=user["created_at"],
        ),
    )

@app.post("/api/auth/login/code", response_model=LoginResponse)
async def login_with_code(request: Request, code_login: CodeLoginRequest, db: Session = Depends(get_db)):
    """验证码登录"""
    require_rate_limit(request, "login", 10, 60)
    phone = code_login.phone.strip()
    code = code_login.code.strip()
    
    if not phone or not code:
        raise HTTPException(status_code=400, detail="请输入手机号和验证码")
    
    # 验证验证码
    code_record = MOCK_CODES.get(phone)
    if not code_record:
        raise HTTPException(status_code=400, detail="请先获取验证码")
    
    if code_record["expires_at"] < time.time():
        raise HTTPException(status_code=400, detail="验证码已过期，请重新获取")
    
    if code_record["code"] != code:
        raise HTTPException(status_code=400, detail="验证码错误")
    
    # 从数据库查找或创建用户
    db_user = get_user_by_phone(db, phone)
    if not db_user:
        # 新用户自动注册到数据库
        username = f"用户{phone[-4:]}"
        db_user = create_user(db, phone=phone, username=username, password=None)
    
    user = user_to_dict(db_user)

    # 生成 token
    token = generate_token(user["id"])

    # 清除已使用的验证码
    del MOCK_CODES[phone]

    return LoginResponse(
        token=token,
        user=User(
            id=user["id"],
            phone=user.get("phone"),
            email=user.get("email"),
            username=user["username"],
            avatar=user.get("avatar"),
            created_at=user["created_at"],
        ),
    )

@app.post("/api/auth/register", response_model=LoginResponse)
async def register(request: Request, reg: RegisterRequest, db: Session = Depends(get_db)):
    """用户注册"""
    require_rate_limit(request, "register", 5, 300)
    phone = reg.phone.strip()
    code = reg.code.strip()
    password = reg.password
    
    if not phone or not code or not password:
        raise HTTPException(status_code=400, detail="请填写完整信息")
    
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于6位")
    
    # 验证验证码
    code_record = MOCK_CODES.get(phone)
    if not code_record or code_record["code"] != code or code_record["expires_at"] < time.time():
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    
    # 检查用户是否已存在（数据库）
    if get_user_by_phone(db, phone):
        raise HTTPException(status_code=409, detail="该手机号已注册，请直接登录")
    
    # 创建新用户到数据库
    username = reg.username or f"用户{phone[-4:]}"
    db_user = create_user(db, phone=phone, username=username, password=password)
    user = user_to_dict(db_user)

    # 生成 token
    token = generate_token(user["id"])

    # 清除已使用的验证码
    del MOCK_CODES[phone]
    
    return LoginResponse(
        token=token,
        user=User(
            id=user["id"],
            phone=user.get("phone"),
            email=user.get("email"),
            username=user["username"],
            avatar=user.get("avatar"),
            created_at=user["created_at"],
        ),
    )

@app.post("/api/auth/reset-password")
async def reset_password(request: Request, reset: ResetPasswordRequest, db: Session = Depends(get_db)):
    """重置密码（通过手机号验证码）"""
    require_rate_limit(request, "reset-pwd", 5, 300)
    phone = reset.phone.strip()
    code = reset.code.strip()
    new_password = reset.new_password

    if not phone or not code or not new_password:
        raise HTTPException(status_code=400, detail="请填写完整信息")

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于6位")

    # 验证验证码
    code_record = MOCK_CODES.get(phone)
    if not code_record or code_record["code"] != code or code_record["expires_at"] < time.time():
        raise HTTPException(status_code=400, detail="验证码错误或已过期")

    # 从数据库查找用户
    db_user = get_user_by_phone(db, phone)
    if not db_user:
        raise HTTPException(status_code=404, detail="该手机号未注册")

    # 更新密码
    update_password(db, db_user, new_password)

    # 清除已使用的验证码
    if phone in MOCK_CODES:
        del MOCK_CODES[phone]

    return {"success": True, "message": "密码重置成功，请使用新密码登录"}

@app.get("/api/auth/user")
async def get_user_info(    token: str = Query(..., description="登录token"),
    db: Session = Depends(get_db),
):
    """获取当前用户信息"""
    user = verify_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")

    return User(
        id=user["id"],
        phone=user.get("phone"),
        email=user.get("email"),
        username=user["username"],
        avatar=user.get("avatar"),
        created_at=user["created_at"],
    )

@app.post("/api/auth/logout")
async def logout(token: str = Query(..., description="登录token")):
    """退出登录（无状态签名 token 由客户端清除，服务端无需吊销）"""
    return {"success": True, "message": "已退出登录"}

# ==================== AI 智能助手 API ====================
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    history: Optional[list] = None

class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    type: str = "text"
    data: Optional[dict] = None

# ==================== 用户偏好同步 API（心愿单/足迹云端持久化） ====================
class UserPrefsRequest(BaseModel):
    favorites: List[str] = []
    history: List[dict] = []


def _require_login_user(request: Request, db: Session) -> dict:
    """从 Authorization 头解析登录用户，未登录抛 401"""
    user = get_optional_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录")
    return user


@app.get("/api/user/prefs")
async def get_user_prefs(request: Request, db: Session = Depends(get_db)):
    """拉取当前用户的心愿单与浏览足迹"""
    user = _require_login_user(request, db)
    row = db.query(UserPrefs).filter(UserPrefs.user_id == user["id"]).first()
    return {"success": True, "prefs": row.to_dict() if row else {"favorites": [], "history": []}}


@app.put("/api/user/prefs")
async def put_user_prefs(request: Request, prefs_req: UserPrefsRequest, db: Session = Depends(get_db)):
    """保存当前用户的心愿单与浏览足迹（整包覆盖，由前端在合并后调用）"""
    user = _require_login_user(request, db)
    row = db.query(UserPrefs).filter(UserPrefs.user_id == user["id"]).first()
    if not row:
        row = UserPrefs(user_id=user["id"])
        db.add(row)
    row.favorites = json.dumps(prefs_req.favorites[:100], ensure_ascii=False)
    row.history = json.dumps(prefs_req.history[:20], ensure_ascii=False)
    db.commit()
    return {"success": True}

# 模拟 AI 响应库
MOCK_AI_RESPONSES = {
    "推荐": "根据你的需求，我推荐以下几个适合3天短途游的目的地：\n\n1. **杭州** - 西湖+灵隐寺+宋城，3天刚好能深度体验\n2. **苏州** - 园林+古镇+太湖，人文与自然结合\n3. **南京** - 历史文化名城，中山陵+夫子庙+总统府\n\n你更倾向于自然风光还是人文历史？我可以帮你做详细的行程规划。",
    "时令": "9月去九寨沟非常合适！这是九寨沟的最佳旅游季节之一：\n\n**优势：**\n- 气温适宜（10-20°C），不冷不热\n- 秋季彩林开始变色，层林尽染\n- 水量充沛，瀑布壮观\n- 游客相对暑期较少\n\n**注意事项：**\n- 早晚温差大，需带厚外套\n- 高原地区，注意高反\n- 景区内步行较多，穿舒适的鞋子\n- 建议提前预订门票和住宿\n\n需要我帮你规划具体的行程吗？",
    "规划": "带父母去云南5天预算8000，我建议这样安排：\n\n**行程概览：**\n- Day1：抵达昆明，滇池+翠湖公园\n- Day2：昆明→大理，洱海环湖\n- Day3：大理古城+崇圣寺三塔\n- Day4：大理→丽江，丽江古城+束河古镇\n- Day5：玉龙雪山（可选）+返程\n\n**预算分配（2人）：**\n- 交通：2500\n- 住宿：2000\n- 餐饮：1500\n- 门票：1000\n- 其他：1000\n\n**带父母注意：**\n- 行程节奏要慢，每天不超过2个景点\n- 选择有电梯的酒店\n- 准备常用药品\n\n需要我生成详细的逐日行程吗？",
    "避雷": "三亚旅游需要注意以下几个坑：\n\n**交通坑：**\n- 机场打车容易被宰，建议用网约车\n- 景区之间距离远，租车或报一日游更划算\n\n**餐饮坑：**\n- 第一市场海鲜加工要货比三家\n- 不要在景区内吃海鲜，价格贵且不新鲜\n\n**购物坑：**\n- 不要在景区买特产，价格虚高\n- 珍珠、水晶等饰品谨慎购买\n\n**游玩坑：**\n- 蜈支洲岛项目贵，建议选择性游玩\n- 天涯海角期望值不要太高\n- 注意防晒，三亚紫外线很强\n\n需要我帮你规划具体的三亚行程吗？",
}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_with_ai(request: Request, chat_req: ChatRequest):
    """AI 智能助手对话接口（使用 DeepSeek API）"""
    require_rate_limit(request, "chat", 10, 60)
    message = chat_req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="消息不能为空")

    try:
        # 构建历史消息
        messages = []
        if chat_req.history:
            for msg in chat_req.history[-10:]:  # 只保留最近10条历史
                if isinstance(msg, dict) and "role" in msg and "content" in msg:
                    messages.append({"role": msg["role"], "content": msg["content"]})

        # 添加当前用户消息
        messages.append({"role": "user", "content": message})

        # 调用 DeepSeek API
        response = await deepseek_client.chat(messages, temperature=0.7, max_tokens=2000)
        reply = response["choices"][0]["message"]["content"]

        conversation_id = chat_req.conversation_id or f"conv_{uuid.uuid4().hex[:12]}"

        return ChatResponse(
            reply=reply,
            conversation_id=conversation_id,
            type="text",
        )
    except httpx.HTTPStatusError as e:
        # API调用失败，返回友好提示
        error_msg = f"AI服务暂时不可用（HTTP {e.response.status_code}），请稍后重试。"
        return ChatResponse(
            reply=error_msg,
            conversation_id=chat_req.conversation_id or f"conv_{uuid.uuid4().hex[:12]}",
            type="text",
        )
    except Exception as e:
        # 其他错误
        error_msg = f"AI服务暂时不可用，请稍后重试。错误信息：{str(e)[:100]}"
        return ChatResponse(
            reply=error_msg,
            conversation_id=chat_req.conversation_id or f"conv_{uuid.uuid4().hex[:12]}",
            type="text",
        )

# ==================== 避雷分析 API ====================
class AvoidAnalysisRequest(BaseModel):
    spot_id: Optional[str] = None
    spot_name: Optional[str] = None
    reviews: List[str] = []

# 分析结果缓存：相同评价输入直接命中，避免重复烧 DeepSeek 调用（key=评价指纹）
_avoid_cache: dict = {}
_AVOID_CACHE_MAX = 128


def _reviews_fingerprint(reviews: List[str], spot_id: Optional[str]) -> str:
    joined = (spot_id or "") + "|" + "\n".join(sorted(reviews))
    return hashlib.md5(joined.encode("utf-8")).hexdigest()


@app.post("/api/avoid/analyze")
async def analyze_avoid(request: Request, analysis_req: AvoidAnalysisRequest):
    """避雷分析接口（使用 DeepSeek 进行 NLP 情感分析，相同输入命中缓存）"""
    require_rate_limit(request, "avoid", 6, 60)
    if not analysis_req.reviews:
        # 无评价时不编造输入：直接返回失败态，由前端展示诚实空态
        return {
            "success": False,
            "spot_name": analysis_req.spot_name,
            "analysis": {
                "avoid_index": 2.5,
                "positive_keywords": [],
                "negative_keywords": [],
                "avoid_tags": [],
                "authenticity_score": 80,
                "summary": "暂无真实评价数据",
                "suggestions": [],
            },
            "review_count": 0,
        }

    # 缓存命中检查
    fp = _reviews_fingerprint(analysis_req.reviews, analysis_req.spot_id)
    if fp in _avoid_cache:
        cached = _avoid_cache[fp]
        return {
            "success": True,
            "spot_name": analysis_req.spot_name,
            "analysis": cached,
            "review_count": len(analysis_req.reviews),
            "cached": True,
        }

    try:
        # 调用 DeepSeek 进行避雷分析
        result = await deepseek_client.analyze_avoid(
            reviews=analysis_req.reviews,
            spot_name=analysis_req.spot_name or "该景区",
        )

        # 写入缓存（超上限时淘汰最早条目）
        if len(_avoid_cache) >= _AVOID_CACHE_MAX:
            _avoid_cache.pop(next(iter(_avoid_cache)))
        _avoid_cache[fp] = result

        return {
            "success": True,
            "spot_name": analysis_req.spot_name,
            "analysis": result,
            "review_count": len(analysis_req.reviews),
        }
    except Exception as e:
        # 分析失败：诚实返回失败态（不编造关键词/指数），由前端展示失败+重试
        logger.error(f"避雷分析失败: {e}")
        return {
            "success": False,
            "spot_name": analysis_req.spot_name,
            "analysis": {
                "avoid_index": 2.5,
                "positive_keywords": [],
                "negative_keywords": [],
                "avoid_tags": [],
                "authenticity_score": 80,
                "summary": "AI 分析暂时不可用，请稍后重试",
                "suggestions": [],
            },
            "review_count": len(analysis_req.reviews),
        }

# ==================== UGC 实拍上传 API ====================
class UGCReviewRequest(BaseModel):
    spot_id: str
    user_id: Optional[str] = None
    user_name: str = "匿名用户"
    rating: int = 5
    content: str = ""
    images: List[str] = []

@app.post("/api/ugc/review")
async def submit_ugc_review(request: UGCReviewRequest):
    """提交UGC实拍评价（MVP阶段，返回成功响应）"""
    if not request.content and not request.images:
        raise HTTPException(status_code=400, detail="评价内容或照片不能为空")

    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="评分必须在1-5之间")

    # MVP阶段：返回成功响应，实际应存入数据库
    review_id = f"ugc_{uuid.uuid4().hex[:12]}"

    return {
        "success": True,
        "review_id": review_id,
        "message": "实拍评价发布成功！",
        "data": {
            "spot_id": request.spot_id,
            "user_name": request.user_name,
            "rating": request.rating,
            "content": request.content,
            "image_count": len(request.images),
            "created_at": datetime.now().isoformat(),
        },
    }

@app.get("/api/ugc/list/{spot_id}")
async def get_ugc_list(
    spot_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取景区UGC实拍列表（MVP阶段，返回模拟数据）"""
    # MVP阶段：返回模拟数据
    mock_ugc = [
        {
            "id": f"ugc_{i}",
            "user_name": f"用户{i+1}",
            "avatar": None,
            "rating": 5 - (i % 2),
            "content": f"这是一条模拟的实拍评价内容，描述了景区的真实游玩体验。",
            "images": [],
            "likes": 100 + i * 20,
            "created_at": f"2026-09-{10 - i:02d}",
        }
        for i in range(min(page_size, 8))
    ]

    return {
        "spot_id": spot_id,
        "page": page,
        "page_size": page_size,
        "total": 50,
        "items": mock_ugc,
    }

@app.post("/api/ugc/like/{review_id}")
async def like_ugc_review(review_id: str):
    """点赞UGC实拍评价"""
    return {
        "success": True,
        "review_id": review_id,
        "likes": 101,
        "message": "点赞成功",
    }

# ==================== 多 Agent 工作流 API ====================
class WorkflowRequest(BaseModel):
    message: str
    max_feedback_rounds: int = Field(2, ge=0, le=3)


def _persist_workflow_log(db: Session, state: dict) -> None:
    """将工作流执行结果写入数据库日志（失败不阻塞主流程）"""
    try:
        log = WorkflowLog(
            session_id=state["session_id"],
            user_input=state["user_input"],
            intent=state["intent"],
            intent_confidence=state["intent_confidence"],
            extracted_entities=state["extracted_entities"],
            agent_results=state["agent_results"],
            final_output=state["final_output"],
            quality_score=state["quality_score"],
            feedback_rounds=state["feedback_rounds"],
            total_time=state["total_time"],
            status="completed",
        )
        db.add(log)
        db.commit()
        # 清理历史：仅保留最近 500 条，防止表无限增长
        try:
            stale = (
                db.query(WorkflowLog.id)
                .order_by(WorkflowLog.id.desc())
                .offset(500)
                .all()
            )
            if stale:
                db.query(WorkflowLog).filter(
                    WorkflowLog.id.in_([row[0] for row in stale])
                ).delete(synchronize_session=False)
                db.commit()
        except Exception:
            db.rollback()
    except Exception as e:
        logger.warning(f"保存工作流日志失败: {e}")
        db.rollback()


def _summarize_agents(state: dict) -> list:
    """将各 Agent 执行结果整理为响应摘要"""
    summaries = []
    for name, result in state["agent_results"].items():
        summaries.append({
            "name": name,
            "success": result.get("success", False),
            "execution_time": round(result.get("execution_time", 0), 2),
            "content_preview": (result.get("content") or "")[:100],
            "error": result.get("error"),
        })
    return summaries


@app.post("/api/workflow/plan")
async def workflow_plan(request: Request, wf_req: WorkflowRequest, db: Session = Depends(get_db)):
    """多 Agent 协同旅行规划（统一由 LangGraph 引擎执行：意图解析→并行执行→汇聚→质量评估→反馈循环）"""
    require_rate_limit(request, "workflow", 3, 300)
    try:
        state = await run_langgraph_workflow(user_input=wf_req.message)
        _persist_workflow_log(db, state)

        return {
            "success": True,
            "engine": "langgraph",
            "session_id": state["session_id"],
            "intent": state["intent"],
            "intent_confidence": state["intent_confidence"],
            "extracted_entities": state["extracted_entities"],
            "quality_score": state["quality_score"],
            "feedback_rounds": state["feedback_rounds"],
            "total_time": round(state["total_time"], 2),
            "agent_count": len(state["agent_results"]),
            "agents": _summarize_agents(state),
            "final_output": state["final_output"],
            "errors": state["errors"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"工作流执行失败: {str(e)}")

# ==================== 批量避雷分析结果 API ====================
@app.get("/api/avoid/batch")
async def get_batch_avoid_analysis():
    """获取批量避雷分析结果（20个景区）"""
    try:
        analysis_path = Path(__file__).parent.parent.parent / "data" / "avoid_analysis.json"
        if analysis_path.exists():
            with open(analysis_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {
                "success": True,
                "count": len(data),
                "results": data,
            }
        else:
            return {
                "success": False,
                "message": "批量分析结果不存在，请先运行批量分析脚本",
                "count": 0,
                "results": [],
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取分析结果失败: {str(e)}")

@app.get("/api/avoid/batch/{spot_id}")
async def get_single_avoid_analysis(spot_id: str):
    """获取单个景区的批量避雷分析结果"""
    try:
        analysis_path = Path(__file__).parent.parent.parent / "data" / "avoid_analysis.json"
        if analysis_path.exists():
            with open(analysis_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            result = next((r for r in data if r["spot_id"] == spot_id), None)
            if result:
                return {"success": True, "result": result}
            else:
                return {"success": False, "message": "未找到该景区的分析结果"}
        else:
            return {"success": False, "message": "批量分析结果不存在"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取分析结果失败: {str(e)}")

# ==================== 评价聚合 API（站内真实数据） ====================
@app.get("/api/reviews/{spot_id}")
async def get_reviews(spot_id: str, db: Session = Depends(get_db)):
    """
    景区评价聚合（站内真实评价统计）。

    说明：第三方平台（美团等）的评价接口需企业资质且无公开 API，
    本端点只返回站内真实用户评价的统计与内容，不编造平台数据。
    """
    query = db.query(Review).filter(Review.spot_id == spot_id)
    total = query.count()
    recent = query.order_by(Review.created_at.desc()).limit(10).all()

    avg_rating = (sum(r.rating for r in recent) / len(recent)) if recent else 0.0
    positive = [r for r in recent if r.rating >= 4]
    negative = [r for r in recent if r.rating < 4]

    return {
        "spot_id": spot_id,
        "data_source": "internal",
        "summary": {
            "avg_rating": round(avg_rating, 2),
            "total_reviews": total,
            "positive_count": len(positive),
            "negative_count": len(negative),
        },
        "reviews": [r.to_dict() for r in recent],
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
    }

# ==================== LangGraph 工作流 API（官方库） ====================
class LangGraphRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

@app.post("/api/workflow/langgraph")
async def langgraph_workflow_plan(request: Request, lg_req: LangGraphRequest, db: Session = Depends(get_db)):
    """使用 LangGraph 官方库的多 Agent 协同旅行规划"""
    require_rate_limit(request, "workflow", 3, 300)
    try:
        # 执行工作流
        state = await run_langgraph_workflow(
            user_input=lg_req.message,
            session_id=lg_req.session_id,
        )

        # 保存工作流日志到数据库
        _persist_workflow_log(db, state)

        return {
            "success": True,
            "engine": "langgraph",
            "session_id": state["session_id"],
            "intent": state["intent"],
            "intent_confidence": state["intent_confidence"],
            "extracted_entities": state["extracted_entities"],
            "quality_score": state["quality_score"],
            "feedback_rounds": state["feedback_rounds"],
            "total_time": round(state["total_time"], 2),
            "agent_count": len(state["agent_results"]),
            "agents": _summarize_agents(state),
            "final_output": state["final_output"],
            "errors": state["errors"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LangGraph工作流执行失败: {str(e)}")

# ==================== 流式响应 API（SSE） ====================
@app.post("/api/workflow/stream")
async def workflow_stream(request: Request, stream_req: LangGraphRequest):
    """工作流流式响应（SSE），实时推送执行进度并落库日志"""
    require_rate_limit(request, "workflow", 3, 300)

    async def event_generator():
        # FastAPI 0.106+ 会在流式响应执行前关闭 Depends 注入的 session，
        # 因此 generator 内部自建数据库会话
        db = SessionLocal()
        try:
            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'message': '工作流开始执行'}, ensure_ascii=False)}\n\n"

            # 执行工作流（推送进度提示后执行真实工作流）
            steps = [
                ("intent", "意图解析中..."),
                ("weather", "天气分析中..."),
                ("attraction", "景点推荐中..."),
                ("budget", "预算规划中..."),
                ("avoid", "避雷分析中..."),
                ("itinerary", "行程生成中..."),
                ("validator", "质量评估中..."),
            ]

            for step_name, step_desc in steps:
                yield f"data: {json.dumps({'type': 'progress', 'step': step_name, 'message': step_desc}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.3)

            # 执行真实工作流
            state = await run_langgraph_workflow(
                user_input=stream_req.message,
                session_id=stream_req.session_id,
            )

            # 保存工作流日志
            _persist_workflow_log(db, state)

            # 发送完成事件
            yield f"data: {json.dumps({'type': 'complete', 'data': {
                'intent': state['intent'],
                'quality_score': state['quality_score'],
                'feedback_rounds': state['feedback_rounds'],
                'total_time': round(state['total_time'], 2),
                'final_output': state['final_output'],
            }}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"工作流流式执行失败: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': '工作流执行失败，请稍后重试'}, ensure_ascii=False)}\n\n"
        finally:
            db.close()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )

# ==================== 文件上传 API ====================
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 挂载静态文件服务，使上传的图片可通过 /uploads/xxx 访问
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def _looks_like_image(data: bytes) -> bool:
    """通过魔数判断常见图片格式（不信任客户端声明的类型）"""
    return (
        data.startswith(b"\xff\xd8\xff")                 # JPEG
        or data.startswith(b"\x89PNG\r\n\x1a\n")         # PNG
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")  # WebP
    )


@app.post("/api/upload/photo")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    spot_id: str = Form(...),
    spot_name: str = Form(...),
    user_name: str = Form("匿名用户"),
    description: str = Form(""),
    rating: int = Form(5),
    db: Session = Depends(get_db),
):
    """上传UGC实拍照片（需登录；白名单扩展名 + 大小限制 + 魔数校验 + 限流）"""
    require_rate_limit(request, "upload", 10, 3600)
    user = get_optional_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="请先登录后再上传实拍")
    # 登录用户名优先于表单声明的昵称
    user_name = user.get("username") or user_name or "匿名用户"
    file_path: Optional[Path] = None
    try:
        # 校验景区存在
        if not any(s["id"] == spot_id for s in SCENIC_SPOTS):
            raise HTTPException(status_code=400, detail="未知景区，禁止上传")

        # 校验评分与字段长度
        if not 1 <= rating <= 5:
            raise HTTPException(status_code=400, detail="评分必须在1-5之间")
        user_name = (user_name or "匿名用户")[:50]
        spot_name = (spot_name or "")[:100]
        description = (description or "")[:500]

        # 校验扩展名白名单（不信任用户文件名）
        orig_ext = os.path.splitext(file.filename or "")[1].lower()
        if orig_ext not in config.UPLOAD_ALLOWED_EXTS:
            raise HTTPException(status_code=400, detail="仅支持 jpg/jpeg/png/webp 格式图片")

        # 读取并校验大小
        contents = await file.read()
        max_bytes = config.UPLOAD_MAX_SIZE_MB * 1024 * 1024
        if len(contents) > max_bytes:
            raise HTTPException(status_code=400, detail=f"文件大小不能超过 {config.UPLOAD_MAX_SIZE_MB}MB")
        if len(contents) < 64 or not _looks_like_image(contents):
            raise HTTPException(status_code=400, detail="文件内容不是有效的图片")

        # 文件名完全由服务端生成，统一使用白名单扩展名
        # file_name 完全由服务端生成的 [时间戳_uuid白名单后缀] 构成，不含任何用户输入
        ext_map = {".jpg": ".jpg", ".jpeg": ".jpeg", ".png": ".png", ".webp": ".webp"}
        safe_ext = ext_map.get(orig_ext, ".jpg")
        safe_name = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{safe_ext}"
        file_path_str = os.path.join(str(UPLOAD_DIR.resolve()), safe_name)
        Path(file_path_str).write_bytes(contents)

        # 保存到数据库
        photo = UGCPhoto(
            spot_id=spot_id,
            spot_name=spot_name,
            user_name=user_name,
            image_url=f"/uploads/{safe_name}",
            description=description,
            rating=rating,
        )
        db.add(photo)
        db.commit()
        db.refresh(photo)

        return {
            "success": True,
            "photo_id": photo.id,
            "image_url": photo.image_url,
            "message": "照片上传成功",
        }
    except HTTPException:
        if file_path and file_path.exists():
            file_path.unlink(missing_ok=True)
        raise
    except Exception as e:
        db.rollback()
        if file_path and file_path.exists():
            file_path.unlink(missing_ok=True)
        logger.error(f"照片上传失败: {e}")
        raise HTTPException(status_code=500, detail="上传失败，请稍后重试")

@app.get("/api/ugc/photos/{spot_id}")
async def get_ugc_photos(
    spot_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取景区UGC实拍照片列表"""
    try:
        query = db.query(UGCPhoto).filter(UGCPhoto.spot_id == spot_id, UGCPhoto.is_approved == 1)
        total = query.count()
        photos = query.order_by(UGCPhoto.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        return {
            "success": True,
            "spot_id": spot_id,
            "total": total,
            "page": page,
            "page_size": page_size,
            "photos": [p.to_dict() for p in photos],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取照片失败: {str(e)}")

# ==================== 评价数据库 API ====================
@app.post("/api/reviews/submit")
async def submit_review(
    request: Request,
    spot_id: str = Form(...),
    spot_name: str = Form(...),
    user_name: str = Form("匿名用户"),
    rating: float = Form(...),
    content: str = Form(...),
    platform: str = Form("慧行山海"),
    db: Session = Depends(get_db),
):
    """提交评价到数据库"""
    require_rate_limit(request, "review", 5, 60)
    # 输入校验
    if not 0 <= rating <= 5:
        raise HTTPException(status_code=400, detail="评分必须在0-5之间")
    if not content.strip():
        raise HTTPException(status_code=400, detail="评价内容不能为空")
    content = content.strip()[:1000]
    user_name = (user_name or "匿名用户")[:50]
    spot_name = (spot_name or "")[:100]
    platform = (platform or "慧行山海")[:50]

    try:
        review = Review(
            spot_id=spot_id,
            spot_name=spot_name,
            user_name=user_name,
            rating=rating,
            content=content,
            platform=platform,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

        return {
            "success": True,
            "review_id": review.id,
            "message": "评价提交成功",
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"提交评价失败: {str(e)}")

@app.get("/api/reviews/list/{spot_id}")
async def get_reviews_list(
    spot_id: str,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """从数据库获取评价列表"""
    try:
        query = db.query(Review).filter(Review.spot_id == spot_id)
        total = query.count()
        reviews = query.order_by(Review.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        return {
            "success": True,
            "spot_id": spot_id,
            "total": total,
            "page": page,
            "page_size": page_size,
            "reviews": [r.to_dict() for r in reviews],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取评价失败: {str(e)}")

# ==================== 工作流日志 API ====================
@app.get("/api/workflow/logs")
async def get_workflow_logs(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取工作流执行日志"""
    try:
        query = db.query(WorkflowLog)
        total = query.count()
        logs = query.order_by(WorkflowLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "logs": [log.to_dict() for log in logs],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日志失败: {str(e)}")

# ==================== 启动 ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

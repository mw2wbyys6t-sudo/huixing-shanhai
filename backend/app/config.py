"""
集中配置管理
从 backend/.env 加载环境变量，代码中不再出现任何真实密钥
"""
import os
from pathlib import Path

from dotenv import load_dotenv

# backend/ 目录（config.py 位于 backend/app/config.py）
BACKEND_DIR = Path(__file__).resolve().parent.parent
# 项目根目录（huixing-shanhai/）
PROJECT_ROOT = BACKEND_DIR.parent

# 加载 backend/.env（存在才加载，不存在则依赖系统环境变量）
load_dotenv(BACKEND_DIR / ".env")

# ==================== 高德地图 ====================
AMAP_KEY = os.getenv("AMAP_KEY", "")
AMAP_SECURITY_CODE = os.getenv("AMAP_SECURITY_CODE", "")

# ==================== DeepSeek ====================
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")


# ==================== 服务配置 ====================
PORT = int(os.getenv("PORT", "8000"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# 会话签名密钥：多 worker / 重启后 token 仍可校验；未配置时生成进程级随机值（仅限单进程开发）
SECRET_KEY = os.getenv("SECRET_KEY", "")

# CORS 白名单：逗号分隔，默认放行本地前端
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        f"{FRONTEND_URL},http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

# 上传限制
UPLOAD_MAX_SIZE_MB = int(os.getenv("UPLOAD_MAX_SIZE_MB", "10"))
UPLOAD_ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

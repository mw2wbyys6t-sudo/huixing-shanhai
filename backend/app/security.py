"""
安全模块：内存滑动窗口限流器 + 无状态签名 Token

Token 采用 HMAC-SHA256 签名（uid + 过期时间），不依赖进程内存，
多 worker 部署 / 服务重启后依然可校验（需在 backend/.env 配置 SECRET_KEY）。
"""
import base64
import hashlib
import hmac
import json
import time
from collections import defaultdict, deque
from typing import Optional

from app import config


# ==================== 限流器（滑动窗口，进程内存级） ====================
class RateLimiter:
    def __init__(self):
        self._hits: dict = defaultdict(deque)

    def allow(self, key: str, limit: int, window_sec: float) -> bool:
        """允许则记录并返回 True；超出窗口内限额返回 False"""
        now = time.time()
        q = self._hits[key]
        while q and now - q[0] > window_sec:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True

    def check_only(self, key: str, limit: int, window_sec: float) -> bool:
        """仅检查不记录（用于冷却判断）"""
        now = time.time()
        q = self._hits[key]
        while q and now - q[0] > window_sec:
            q.popleft()
        return len(q) < limit


rate_limiter = RateLimiter()


# ==================== 签名 Token ====================
def _sign(raw: str) -> str:
    return hmac.new(config.SECRET_KEY.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()


def create_signed_token(user_id: str, days: int = 7) -> str:
    """生成无状态会话 token：base64(payload).hmac 签名"""
    payload = json.dumps(
        {"uid": str(user_id), "exp": int(time.time() + days * 86400)},
        separators=(",", ":"),
    )
    raw = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8").rstrip("=")
    return f"{raw}.{_sign(raw)}"


def verify_signed_token(token: str) -> Optional[str]:
    """校验签名与有效期，返回 user_id；无效返回 None"""
    try:
        raw, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(_sign(raw), sig):
            return None
        pad = "=" * (-len(raw) % 4)
        data = json.loads(base64.urlsafe_b64decode(raw + pad))
        if data.get("exp", 0) < time.time():
            return None
        return str(data.get("uid", ""))
    except Exception:
        return None

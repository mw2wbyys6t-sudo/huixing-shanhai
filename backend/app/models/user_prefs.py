"""
用户偏好模型（心愿单收藏 + 浏览足迹的云端同步）
"""
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class UserPrefs(Base):
    """每用户一行：favorites/history 均为 JSON 字符串。

    user_id 为字符串以同时兼容数据库用户（数字 id）与演示账号（user_001）。
    """
    __tablename__ = "user_prefs"

    user_id = Column(String(50), primary_key=True)
    favorites = Column(Text, nullable=True, default="[]")  # JSON: ["CN-0001", ...]
    history = Column(Text, nullable=True, default="[]")    # JSON: [{id,name,image,visitedAt}, ...]
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        import json
        return {
            "favorites": json.loads(self.favorites) if self.favorites else [],
            "history": json.loads(self.history) if self.history else [],
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

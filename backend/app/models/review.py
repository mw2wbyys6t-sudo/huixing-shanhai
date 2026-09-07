"""
评价模型
"""
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Review(Base):
    """景区评价表"""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    spot_id = Column(String(50), index=True, nullable=False)
    spot_name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(50), nullable=False)
    platform = Column(String(50), default="慧行山海")
    rating = Column(Float, nullable=False)
    content = Column(Text, nullable=False)
    images = Column(Text, nullable=True)  # JSON数组
    likes = Column(Integer, default=0)
    is_verified = Column(Integer, default=1)  # 1=已验证, 0=未验证
    sentiment = Column(String(20), nullable=True)  # positive/negative/neutral
    avoid_tags = Column(Text, nullable=True)  # JSON数组
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "spot_id": self.spot_id,
            "spot_name": self.spot_name,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "platform": self.platform,
            "rating": self.rating,
            "content": self.content,
            "images": json.loads(self.images) if self.images else [],
            "likes": self.likes,
            "is_verified": self.is_verified,
            "sentiment": self.sentiment,
            "avoid_tags": json.loads(self.avoid_tags) if self.avoid_tags else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

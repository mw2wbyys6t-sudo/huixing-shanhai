"""
UGC 实拍照片模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class UGCPhoto(Base):
    """用户实拍照片表"""
    __tablename__ = "ugc_photos"

    id = Column(Integer, primary_key=True, index=True)
    spot_id = Column(String(50), index=True, nullable=False)
    spot_name = Column(String(100), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(50), nullable=False)
    image_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    likes = Column(Integer, default=0)
    views = Column(Integer, default=0)
    is_approved = Column(Integer, default=1)  # 1=已审核, 0=待审核
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "spot_id": self.spot_id,
            "spot_name": self.spot_name,
            "user_id": self.user_id,
            "user_name": self.user_name,
            "image_url": self.image_url,
            "thumbnail_url": self.thumbnail_url,
            "description": self.description,
            "rating": self.rating,
            "likes": self.likes,
            "views": self.views,
            "is_approved": self.is_approved,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

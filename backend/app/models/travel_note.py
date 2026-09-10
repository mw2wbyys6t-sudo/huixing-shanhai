# -*- coding: utf-8 -*-
"""游记/攻略社区数据模型"""
from sqlalchemy import Column, Integer, String, Text, DateTime, func

from app.database import Base


class TravelNote(Base):
    """游记/攻略文章"""
    __tablename__ = "travel_notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    type = Column(String(10), nullable=False, default="游记")  # 游记 / 攻略
    spot_id = Column(String(50), index=True, nullable=True)    # 关联景区（可选）
    spot_name = Column(String(100), nullable=True)
    user_id = Column(Integer, nullable=True)
    user_name = Column(String(50), nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NoteComment(Base):
    """游记评论"""
    __tablename__ = "note_comments"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(Integer, index=True, nullable=False)
    user_id = Column(Integer, nullable=True)
    user_name = Column(String(50), nullable=False)
    content = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

"""
数据库配置
支持 PostgreSQL（生产）和 SQLite（开发/测试）
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据库配置
# 生产环境使用 PostgreSQL，开发环境默认使用 SQLite
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./huixing_shanhai.db"
)

# 创建引擎
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False,
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False,
    )

# 会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 基类
Base = declarative_base()


def get_db():
    """获取数据库会话（依赖注入）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库表"""
    # 导入所有模型，确保它们被注册
    from app.models.user import User
    from app.models.review import Review
    from app.models.ugc_photo import UGCPhoto
    from app.models.workflow_log import WorkflowLog
    from app.models.user_prefs import UserPrefs
    from app.models.travel_note import TravelNote, NoteComment

    Base.metadata.create_all(bind=engine)
    print("数据库表初始化完成")

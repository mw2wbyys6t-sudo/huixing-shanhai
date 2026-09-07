"""
认证服务模块
封装用户认证相关的数据库操作与密码哈希
"""
import hashlib
import secrets
import time
from sqlalchemy.orm import Session
from app.models.user import User as DBUser

_PBKDF2_ITERATIONS = 100_000
_HASH_PREFIX = "pbkdf2$"


def hash_password(password: str) -> str:
    """使用 PBKDF2-SHA256 生成带盐哈希"""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS)
    return f"{_HASH_PREFIX}{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """校验密码；兼容历史明文数据（返回 True 由调用方决定是否透明升级）"""
    if not stored:
        return False
    if stored.startswith(_HASH_PREFIX):
        try:
            _, salt, digest = stored.split("$", 2)
        except ValueError:
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS)
        return secrets.compare_digest(dk.hex(), digest)
    return password == stored


def is_hashed(stored: str) -> bool:
    """判断存储的是否已是哈希格式"""
    return bool(stored) and stored.startswith(_HASH_PREFIX)


def get_user_by_phone(db: Session, phone: str):
    """根据手机号查询用户"""
    return db.query(DBUser).filter(DBUser.phone == phone).first()


def get_user_by_account(db: Session, account: str):
    """根据账号（手机号/邮箱/用户名）查询用户"""
    return db.query(DBUser).filter(
        (DBUser.phone == account) |
        (DBUser.email == account) |
        (DBUser.username == account)
    ).first()


def get_user_by_id(db: Session, user_id: int):
    """根据ID查询用户"""
    return db.query(DBUser).filter(DBUser.id == user_id).first()


def create_user(db: Session, phone: str, username: str, password: str = None, email: str = None):
    """创建新用户（验证码注册的账号允许暂无密码）"""
    user = DBUser(
        phone=phone,
        username=username,
        password_hash=hash_password(password) if password else None,
        email=email,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_password(db: Session, user: DBUser, new_password: str):
    """更新用户密码"""
    user.password_hash = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user


def user_to_dict(user: DBUser) -> dict:
    """将数据库用户对象转换为字典格式（password 字段仅服务端内部使用，禁止返回给客户端）"""
    return {
        "id": str(user.id),
        "phone": user.phone,
        "email": user.email,
        "username": user.username,
        "password": user.password_hash,
        "avatar": user.avatar,
        "created_at": user.created_at.isoformat() if user.created_at else time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

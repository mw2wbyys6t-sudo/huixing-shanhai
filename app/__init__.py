"""仓库根目录引导包：让 `uvicorn app.main:app` 在仓库根目录直接可用。

Render 等平台以仓库根为工作目录时，真实应用位于 backend/app。
本包把 backend 目录加入 sys.path 后，用真实包替换自身，
保证模块内 `from app.xxx import ...` 的绝对导入全部指向真实实现。
"""

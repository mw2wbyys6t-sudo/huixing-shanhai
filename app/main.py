# -*- coding: utf-8 -*-
"""根目录启动引导：转发到 backend/app/main，详见 app/__init__.py 说明。"""
import importlib
import os
import sys

_BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

# 摘掉根目录引导包自身（app 与 app.main 都要摘，否则重新 import 会拿到未初始化的本模块）
sys.modules.pop("app", None)
sys.modules.pop("app.main", None)
_real = importlib.import_module("app.main")
app = _real.app

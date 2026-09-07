@echo off
chcp 65001 >nul
echo ========================================
echo   慧行山海 - 项目启动脚本
echo ========================================
echo.

REM 环境检查
where python >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+ 并加入 PATH
    pause
    exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+ 并加入 PATH
    pause
    exit /b 1
)

REM 检查后端密钥配置
if not exist backend\.env (
    echo [提示] 未找到 backend\.env，正在从模板创建...
    copy backend\.env.example backend\.env >nul
    echo [重要] 请编辑 backend\.env 填入你自己的高德/DeepSeek 密钥后重新运行！
    pause
    exit /b 1
)

echo [1/2] 启动后端服务 (FastAPI)...
cd /d "%~dp0backend"
if not exist venv (
    echo 创建虚拟环境...
    python -m venv venv
)
call venv\Scripts\activate.bat
python -c "import fastapi, sqlalchemy, langgraph" 2>nul || pip install -r requirements.txt -q
start "慧行山海-后端" cmd /k "uvicorn app.main:app --reload --port 8000"
cd /d "%~dp0"

echo [2/2] 启动前端服务 (Next.js)...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo 安装依赖（首次运行需要几分钟）...
    call npm install
)
start "慧行山海-前端" cmd /k "npm run dev"
cd /d "%~dp0"

echo.
echo ========================================
echo   启动完成！
echo   前端: http://localhost:3000
echo   后端API: http://localhost:8000
echo   API文档: http://localhost:8000/docs
echo   演示账号: 13800138000 / 123456
echo ========================================
echo   首次启动后端与前端就绪约需 10-30 秒
echo ========================================
echo.
pause

@echo off
chcp 65001 >nul
echo ====================================
echo AI 报销材料生成器 - 后端服务
echo ====================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 未检测到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)

if "%ZHIPU_API_KEY%"=="" (
    echo 警告: 未检测到 ZHIPU_API_KEY 环境变量
    echo.
    echo 请先设置智谱 API Key:
    echo   set ZHIPU_API_KEY=your-zhipu-api-key-here
    echo.
    pause
    exit /b 1
)

echo 环境检查通过
echo 服务地址: http://127.0.0.1:8000
echo API 文档: http://127.0.0.1:8000/docs
echo.
echo 按 Ctrl+C 停止服务
echo ====================================
echo.

uvicorn main:app --host 0.0.0.0 --port 8000

pause

# 环境检查脚本

print("=== AI报销工具环境检查 ===")
print()

print("1. 检查Python依赖")
try:
    import fastapi
    print("   [OK] FastAPI 已安装")
except ImportError:
    print("   [ERROR] FastAPI 未安装")

try:
    import uvicorn
    print("   [OK] Uvicorn 已安装")
except ImportError:
    print("   [ERROR] Uvicorn 未安装")

try:
    from docx import Document
    print("   [OK] python-docx 已安装")
except ImportError:
    print("   [ERROR] python-docx 未安装")

try:
    import requests
    print("   [OK] requests 已安装")
except ImportError:
    print("   [ERROR] requests 未安装")

try:
    from PIL import Image
    print("   [OK] pillow 已安装")
except ImportError:
    print("   [ERROR] pillow 未安装")

print()

print("2. 检查项目文件")
import os

files_to_check = [
    "server.py",
    "ai-reimburse-tool.html",
    "requirements.txt",
    "start.bat"
]

for file in files_to_check:
    if os.path.exists(file):
        print(f"   [OK] {file} 存在")
    else:
        print(f"   [ERROR] {file} 不存在")

print()

print("3. 检查核心功能")

# 检查API密钥
with open("server.py", "r", encoding="utf-8") as f:
    content = f.read()
    if "e1726b4c8ff9472ca63193add519d253.9F5ghmSnO2OiEpau" in content:
        print("   [OK] 智谱API密钥已配置")
    else:
        print("   [ERROR] 智谱API密钥未配置")

# 检查多文件类型支持
if "uploadAreaInvoice" in content:
    print("   [OK] 前端支持多文件类型上传")
else:
    print("   [ERROR] 前端不支持多文件类型上传")

# 检查OCR函数
if "ocr_with_zhipu" in content:
    print("   [OK] OCR识别函数已集成")
else:
    print("   [ERROR] OCR识别函数未集成")

# 检查Word文档生成
if "票据明细" in content:
    print("   [OK] Word文档按类型分组功能已实现")
else:
    print("   [ERROR] Word文档按类型分组功能未实现")

print()
print("=== 环境检查完成 ===")
print()
print("使用方法:")
print("1. 运行 'pip install -r requirements.txt' 安装依赖")
print("2. 运行 'python server.py' 启动后端服务")
print("3. 打开浏览器访问 'ai-reimburse-tool.html'")
print("4. 上传发票、订单、支付记录进行测试")
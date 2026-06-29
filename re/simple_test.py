#!/usr/bin/env python3
"""
简单的测试脚本
"""

print("=== AI报销工具测试 ===")
print()

print("1. 测试后端服务启动")
try:
    import fastapi
    print("   ✓ FastAPI 已安装")
except ImportError:
    print("   ✗ FastAPI 未安装")

try:
    import uvicorn
    print("   ✓ Uvicorn 已安装")
except ImportError:
    print("   ✗ Uvicorn 未安装")

try:
    from docx import Document
    print("   python-docx 已安装")
except ImportError:
    print("   ✗ python-docx 未安装")

print()

print("2. 文件检查")
import os

files_to_check = [
    "server.py",
    "ai-reimburse-tool.html",
    "requirements.txt",
    "start.bat"
]

for file in files_to_check:
    if os.path.exists(file):
        print(f"   ✓ {file} 存在")
    else:
        print(f"   ✗ {file} 不存在")

print()

print("3. 功能特性检查")

# 检查API密钥
with open("server.py", "r", encoding="utf-8") as f:
    content = f.read()
    if "e1726b4c8ff9472ca63193add519d253.9F5ghmSnO2OiEpau" in content:
        print("   ✓ 智谱API密钥已配置")
    else:
        print("   ✗ 智谱API密钥未配置")

# 检查多文件类型支持
if "uploadAreaInvoice" in content:
    print("   ✓ 前端支持多文件类型上传")
else:
    print("   ✗ 前端不支持多文件类型上传")

# 检查OCR函数
if "ocr_with_zhipu" in content:
    print("   ✓ OCR识别函数已集成")
else:
    print("   ✗ OCR识别函数未集成")

print()
print("=== 测试完成 ===")
print()
print("使用方法:")
print("1. 运行 'python server.py' 启动后端服务")
print("2. 打开浏览器访问 'ai-reimburse-tool.html'")
print("3. 上传发票、订单、支付记录进行测试")
#!/usr/bin/env python3
"""
快速启动脚本
"""

import os
import sys
import subprocess
import time
import requests
from threading import Thread

def check_dependencies():
    """检查依赖是否安装"""
    print("检查依赖...")
    try:
        import fastapi
        import uvicorn
        from docx import Document
        import requests
        from PIL import Image
        print("✓ 所有依赖已安装")
        return True
    except ImportError as e:
        print(f"✗ 缺少依赖: {e}")
        print("请运行: pip install -r requirements.txt")
        return False

def start_server():
    """启动服务器"""
    print("\n启动服务器...")
    try:
        # 使用subprocess运行server.py
        process = subprocess.Popen(
            [sys.executable, "server.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        # 等待几秒让服务器启动
        time.sleep(3)

        # 检查服务器是否启动成功
        try:
            response = requests.get("http://localhost:8000/", timeout=2)
            if response.status_code == 200:
                print("✓ 服务器启动成功!")
                print(f"  服务地址: http://localhost:8000/")
                return True, process
        except:
            pass

        # 如果检查失败，查看输出
        stdout, stderr = process.communicate()
        if stderr:
            print("服务器启动错误:")
            print(stderr)

        return False, None

    except Exception as e:
        print(f"启动失败: {e}")
        return False, None

def main():
    """主函数"""
    print("=== AI报销工具快速启动 ===\n")

    # 检查文件是否存在
    if not os.path.exists("server.py"):
        print("错误: 找不到 server.py 文件")
        return

    if not os.path.exists("ai-reimburse-tool.html"):
        print("错误: 找不到 ai-reimburse-tool.html 文件")
        return

    # 检查依赖
    if not check_dependencies():
        return

    # 启动服务器
    success, process = start_server()

    if success:
        print("\n=== 使用说明 ===")
        print("1. 用浏览器打开 ai-reimburse-tool.html 文件")
        print("2. 填写基本信息并上传发票、订单、支付记录")
        print("3. 点击'生成报销Word'按钮")
        print("\n按 Ctrl+C 停止服务器")

        try:
            # 保持程序运行
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n正在停止服务器...")
            if process:
                process.terminate()
            print("服务器已停止")
    else:
        print("\n服务器启动失败，请检查错误信息")

if __name__ == "__main__":
    main()
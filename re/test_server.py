#!/usr/bin/env python3
"""
测试后端服务器启动
"""

import sys
import os
import subprocess
import time
import requests

def check_requirements():
    """检查依赖是否安装"""
    print("检查依赖...")
    required_packages = [
        'fastapi',
        'uvicorn',
        'python-docx',
        'requests',
        'pillow'
    ]

    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✓ {package}")
        except ImportError:
            print(f"  ✗ {package}")
            missing.append(package)

    if missing:
        print(f"\n请安装缺失的包: pip install {' '.join(missing)}")
        return False

    print("\n所有依赖已安装")
    return True

def start_server():
    """启动服务器"""
    print("\n启动服务器...")

    # 检查端口是否被占用
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 8000))
        sock.close()
        if result == 0:
            print("  端口 8000 已被占用")
            print("  请先停止占用该端口的服务")
            return False
    except:
        pass

    # 启动服务器
    try:
        # 在Windows上使用pythonw避免控制台窗口
        if os.name == 'nt':
            subprocess.Popen([sys.executable, 'server.py'])
        else:
            subprocess.Popen([sys.executable, 'server.py'])

        print("  服务器启动中...")
        time.sleep(3)  # 等待服务器启动

        return True
    except Exception as e:
        print(f"  启动失败: {e}")
        return False

def test_server():
    """测试服务器是否响应"""
    print("\n测试服务器...")

    try:
        response = requests.get('http://localhost:8000/', timeout=5)
        if response.status_code == 200:
            print("  ✓ 服务器正常运行")
            return True
        else:
            print(f"  ✗ 服务器返回状态码: {response.status_code}")
            return False
    except Exception as e:
        print(f"  ✗ 无法连接到服务器: {e}")
        return False

def main():
    """主函数"""
    print("=== AI报销工具后端测试 ===\n")

    # 检查当前目录
    if not os.path.exists('server.py'):
        print("错误: 在当前目录下找不到 server.py")
        print("请确保在正确的目录下运行此脚本")
        return

    # 检查依赖
    if not check_requirements():
        return

    # 启动服务器
    if not start_server():
        return

    # 测试服务器
    if test_server():
        print("\n✓ 服务器测试通过!")
        print("\n现在可以:")
        print("1. 打开浏览器访问 ai-reimburse-tool.html")
        print("2. 上传文件进行测试")
    else:
        print("\n✗ 服务器测试失败")
        print("\n请检查:")
        print("1. server.py 文件是否正确")
        print("2. 网络连接是否正常")
        print("3. 防火墙是否阻止了连接")

if __name__ == "__main__":
    main()
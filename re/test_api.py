#!/usr/bin/env python3
"""
测试AI报销工具的API接口
"""

import requests
import json
import base64

# 配置
API_BASE = "http://localhost:8000"
API_KEY = "e1726b4c8ff9472ca63193add519d253.9F5ghmSnO2OiEpau"

def test_api_status():
    """测试API是否正常运行"""
    try:
        response = requests.get(f"{API_BASE}/")
        if response.status_code == 200:
            print("✓ API服务正常运行")
            return True
        else:
            print(f"✗ API服务异常: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ 无法连接到API服务: {str(e)}")
        return False

def test_process_endpoint():
    """测试处理接口"""
    print("\n=== 测试处理接口 ===")

    # 准备测试数据
    test_data = {
        "purpose": "测试报销申请",
        "reimburse_type": "现金报销",
        "user_name": "张三",
        "student_id": "20240001",
        "phone": "13800138000",
        "activity_date": "2026-06-24"
    }

    try:
        # 注意：这个测试需要实际的图片文件
        # 这里只测试表单数据部分
        response = requests.post(
            f"{API_BASE}/api/v1/reimburse/process",
            data=test_data
        )

        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print("✓ 处理接口响应正常")
                print(f"  消息: {result.get('message')}")
                return True
            else:
                print(f"✗ 处理失败: {result.get('message')}")
                return False
        else:
            print(f"✗ 接口返回错误: {response.status_code}")
            return False

    except Exception as e:
        print(f"✗ 测试失败: {str(e)}")
        return False

def test_export_endpoint():
    """测试导出接口"""
    print("\n=== 测试导出接口 ===")

    # 测试数据
    test_data = {
        "activity": "测试报销申请",
        "reimburse_type": "现金报销",
        "user": {
            "name": "张三",
            "student_id": "20240001",
            "phone": "13800138000"
        },
        "activity_date": "2026-06-24",
        "invoices": [],
        "orders": [],
        "payments": [],
        "all_files": [],
        "total_amount": 0,
        "validation_results": {
            "complete": [],
            "missing": [],
            "risks": []
        },
        "file_summary": {
            "invoices": 0,
            "orders": 0,
            "payments": 0,
            "total_files": 0
        },
        "processed_at": "2026-06-24T00:00:00"
    }

    try:
        response = requests.post(
            f"{API_BASE}/api/v1/reimburse/export",
            json=test_data,
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            print("✓ 导出接口响应正常")
            print(f"  内容类型: {response.headers.get('content-type')}")
            print(f"  文件大小: {len(response.content)} 字节")

            # 保存测试文件
            with open("test_export.docx", "wb") as f:
                f.write(response.content)
            print("✓ 测试文件已保存为 test_export.docx")

            return True
        else:
            print(f"✗ 导出失败: {response.status_code}")
            return False

    except Exception as e:
        print(f"✗ 测试失败: {str(e)}")
        return False

def main():
    """运行所有测试"""
    print("开始测试AI报销工具API...")

    # 测试API状态
    if not test_api_status():
        return

    # 测试处理接口（需要实际文件）
    test_process_endpoint()

    # 测试导出接口
    test_export_endpoint()

    print("\n测试完成！")

if __name__ == "__main__":
    main()
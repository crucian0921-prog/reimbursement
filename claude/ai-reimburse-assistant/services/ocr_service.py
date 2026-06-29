# -*- coding: utf-8 -*-
"""
OCR识别模块 + AI结构化模块 —— 对应 PRD 4.2 / 4.3

设计成"双模式"：
- 没有配置 OPENAI_API_KEY 时：返回 mock 数据，保证整条流程在本地无需任何 AI Key 就能跑通、便于开发和演示。
- 配置了 OPENAI_API_KEY 时：真实调用 GPT-4o Vision 对图片做识别。

如果你们学校/团队更想用 Claude 而不是 GPT-4o，把 call_gpt4o_vision() 换成调用
Anthropic /v1/messages（传图片 base64 + image content block）即可，输出格式保持一致就行，
其他模块（validator / docx_generator）不需要改。
"""
import base64
import os
import random
import json

USE_MOCK = os.environ.get("OPENAI_API_KEY") is None

# ---------- Mock 数据：方便不接真实 AI 也能跑通流程 ----------
_MOCK_INVOICE_POOL = [
    {"merchant": "某餐饮服务中心", "amount": 420.00, "date": "2024-03-15",
     "items": [{"name": "会议午餐（工作套餐）", "unit_price": 35.00, "quantity": 12}]},
    {"merchant": "某文具用品店", "amount": 57.00, "date": "2024-03-15",
     "items": [{"name": "A4打印纸（500张/包）", "unit_price": 28.50, "quantity": 2}]},
]


def _mock_ocr_one(file_type: str, index: int) -> dict:
    if file_type == "invoice":
        data = _MOCK_INVOICE_POOL[index % len(_MOCK_INVOICE_POOL)]
        return {
            "file_type": "invoice",
            "merchant": data["merchant"],
            "amount": data["amount"],
            "date": data["date"],
            "items": data["items"],
            "raw_text": f"[mock OCR] 发票 {index + 1}：{data['merchant']} 共计 ¥{data['amount']:.2f}",
        }
    if file_type == "order":
        return {
            "file_type": "order",
            "merchant": "线上订单",
            "amount": None,
            "date": "2024-03-15",
            "items": [],
            "raw_text": "[mock OCR] 订单截图：包含商品清单与金额（用于核对明细）",
        }
    if file_type == "payment":
        total = sum(i["amount"] for i in _MOCK_INVOICE_POOL)
        return {
            "file_type": "payment",
            "merchant": "微信/银行转账",
            "amount": round(total + random.choice([0, 0, 3.0]), 2),  # 偶尔故意造一点偏差，演示风险项
            "date": "2024-03-15",
            "items": [],
            "raw_text": "[mock OCR] 支付记录：转账成功",
        }
    return {"file_type": file_type, "merchant": None, "amount": None, "date": None,
            "items": [], "raw_text": "[mock OCR] 已识别"}


def run_ocr(file_records: list) -> list:
    """
    file_records: [{"file_type": "invoice"|"order"|"payment"|"approval", "path": str, "filename": str}, ...]
    返回每个文件的 OCR 结果列表
    """
    results = []
    type_counters = {}
    for rec in file_records:
        ftype = rec["file_type"]
        idx = type_counters.get(ftype, 0)
        type_counters[ftype] = idx + 1

        if USE_MOCK:
            result = _mock_ocr_one(ftype, idx)
        else:
            result = call_gpt4o_vision(rec["path"], ftype)

        result["source_file"] = rec["filename"]
        results.append(result)
    return results


def call_gpt4o_vision(image_path: str, file_type: str) -> dict:
    """
    真实调用 GPT-4o Vision 做识别。需要 pip install openai 并设置 OPENAI_API_KEY。
    返回结构需要和 _mock_ocr_one 保持一致，下游模块才不用改。
    """
    from openai import OpenAI  # 延迟 import，没装 openai 包也不影响 mock 模式运行
    client = OpenAI()

    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    prompt = (
        "你是财务报销OCR助手。请从这张图片中提取信息，只返回JSON，不要任何多余文字。"
        '字段：{"merchant": "商户名称", "amount": 数字或null, "date": "YYYY-MM-DD或null", '
        '"items": [{"name": "", "unit_price": 数字, "quantity": 数字}]}。'
        f"图片类型为：{file_type}（invoice=发票，order=订单截图，payment=支付记录）。"
    )

    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ],
        }],
        temperature=0,
    )
    raw = resp.choices[0].message.content
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {"merchant": None, "amount": None, "date": None, "items": []}

    parsed["file_type"] = file_type
    parsed["raw_text"] = raw
    return parsed


def merge_structured_data(basic_info: dict, ocr_results: list, purpose: str) -> dict:
    """
    对应 PRD 4.3：合并用户表单数据 + OCR结果 -> 统一结构
    """
    items = []
    for r in ocr_results:
        for it in r.get("items", []):
            unit_price = it.get("unit_price") or 0
            quantity = it.get("quantity") or 0
            items.append({
                "name": it.get("name", ""),
                "unit_price": unit_price,
                "quantity": quantity,
                "subtotal": round(unit_price * quantity, 2),
            })

    total_amount = round(sum(i["subtotal"] for i in items), 2) if items else 0.0
    # 如果明细算出来的总额是 0（比如订单截图没拆出明细），就退而求其次用发票OCR金额
    if total_amount == 0:
        invoice_amounts = [r["amount"] for r in ocr_results
                            if r.get("file_type") == "invoice" and r.get("amount")]
        if invoice_amounts:
            total_amount = round(sum(invoice_amounts), 2)

    invoice_status = any(r.get("file_type") == "invoice" for r in ocr_results)

    return {
        "basic_info": basic_info,
        "items": items,
        "total_amount": total_amount,
        "purpose": purpose,
        "ocr_results": ocr_results,
        "invoice_status": invoice_status,
    }

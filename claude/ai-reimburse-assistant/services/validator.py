# -*- coding: utf-8 -*-
"""
合规性校验模块 —— 对应 PRD 4.4
规则逻辑（先用纯规则跑通流程；后续可以把 AI 辅助判断接到这里，
比如让模型对"用途说明是否合理"做语义判断，而不是只判断是否为空）。
"""

APPROVAL_AMOUNT_THRESHOLD = 200  # 超过此金额需要审批截图，对应原型图里的提示


def run_validation(structured_data: dict, uploaded_files: dict) -> dict:
    """
    structured_data: 见 ocr_service.merge_structured_data 的输出
    uploaded_files: { "invoices": [...], "orders": [...], "payments": [...], "approval": [...] }

    返回结构：
    {
      "complete": [{"label": str, "detail": str}],
      "missing":  [{"label": str, "detail": str, "action": str}],
      "risk":     [{"label": str, "detail": str, "action": str}],
    }
    """
    complete, missing, risk = [], [], []

    basic = structured_data.get("basic_info", {})
    items = structured_data.get("items", [])
    purpose = structured_data.get("purpose", "")
    total_amount = structured_data.get("total_amount", 0) or 0
    ocr_results = structured_data.get("ocr_results", [])

    # 1. 是否存在发票
    if uploaded_files.get("invoices"):
        complete.append({
            "label": "发票真伪查验已通过",
            "detail": f"共识别 {len(uploaded_files['invoices'])} 张发票图片",
        })
    else:
        missing.append({
            "label": "缺少发票",
            "detail": "未检测到任何发票图片，请上传至少一张发票",
            "action": "去上传",
        })

    # 2. 金额是否完整 / 金额是否匹配（发票金额 vs 支付记录金额）
    invoice_amounts = [r["amount"] for r in ocr_results
                        if r.get("file_type") == "invoice" and r.get("amount")]
    payment_amounts = [r["amount"] for r in ocr_results
                        if r.get("file_type") == "payment" and r.get("amount")]

    if invoice_amounts and payment_amounts:
        invoice_total = sum(invoice_amounts)
        payment_total = sum(payment_amounts)
        if abs(invoice_total - payment_total) < 0.01:
            complete.append({
                "label": "金额匹配",
                "detail": f"发票金额 ¥{invoice_total:.2f} 与支付记录一致",
            })
        else:
            risk.append({
                "label": "金额偏差提示",
                "detail": f"发票总额 ¥{invoice_total:.2f} 与支付凭证 ¥{payment_total:.2f} 不匹配",
                "action": "人工核正",
            })
    elif invoice_amounts and not uploaded_files.get("payments"):
        missing.append({
            "label": "缺少支付记录",
            "detail": "已识别发票金额，但未上传支付记录用于核对",
            "action": "去上传",
        })

    # 3. 是否缺少用途说明
    if purpose and purpose.strip():
        complete.append({
            "label": "用途说明完整",
            "detail": "已填写活动策划与购买说明",
        })
    else:
        missing.append({
            "label": "缺少用途说明",
            "detail": "请补充活动策划与购买说明，用于证明材料生成",
            "action": "去填写",
        })

    # 4. 是否缺少明细
    if items:
        complete.append({
            "label": "材料明细完整",
            "detail": f"共 {len(items)} 项明细，合计 ¥{total_amount:.2f}",
        })
    else:
        missing.append({
            "label": "缺少材料明细",
            "detail": "未识别到任何商品/服务明细，请检查发票或手动补充",
            "action": "去补充",
        })

    # 5. 是否符合校内财务抬头信息（姓名/学号/联系方式/报销事由）
    required_fields = {
        "payer_name": "报销人姓名",
        "student_id": "学号",
        "contact": "联系方式",
        "reimburse_reason": "报销事由",
    }
    missing_fields = [label for key, label in required_fields.items() if not basic.get(key)]
    if not missing_fields:
        complete.append({
            "label": "抬头信息完整",
            "detail": "姓名/学号/联系方式/报销事由均已填写",
        })
    else:
        missing.append({
            "label": "基础信息缺失",
            "detail": f"缺少：{ '、'.join(missing_fields) }",
            "action": "去填写",
        })

    # 6. 金额超过阈值需要审批截图（对应原型图中的"缺少审批截图"提示）
    if total_amount > APPROVAL_AMOUNT_THRESHOLD and not uploaded_files.get("approval"):
        missing.append({
            "label": "缺少审批截图",
            "detail": f"报销金额超过 {APPROVAL_AMOUNT_THRESHOLD} 元需上传审批流程截图",
            "action": "立即补全",
        })

    return {"complete": complete, "missing": missing, "risk": risk}

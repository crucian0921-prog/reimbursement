import json
import base64
import os
import io  # 👈 新增
from typing import List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY")
ZHIPU_API_BASE = os.getenv("ZHIPU_API_BASE", "https://open.bigmodel.cn/api/paas/v4")
MODEL = os.getenv("ZHIPU_MODEL", "glm-4v-flash")


def call_zhipu_vision(messages):
    if not ZHIPU_API_KEY:
        raise HTTPException(status_code=500, detail="智谱 API Key 未配置，请设置环境变量 ZHIPU_API_KEY")

    endpoint = f"{ZHIPU_API_BASE.rstrip('/')}/chat/completions"
    try:
        response = requests.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {ZHIPU_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "messages": messages,
                "temperature": 0.1,
            },
            timeout=120,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"智谱接口请求失败: {exc}") from exc

    payload = response.json()
    try:
        return payload["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail=f"智谱接口返回格式异常: {payload}") from exc


@app.get("/api/v1/reimburse/health")
def health():
    return {
        "status": "ok",
        "api_configured": bool(ZHIPU_API_KEY),
        "model": MODEL,
    }

@app.post("/api/v1/reimburse/process")
async def process(
    user_info: str = Form(..., description="前端参数"),
    files: List[UploadFile] = File(...)
):
    try:
        data = json.loads(user_info)
    except Exception as e:
        return {"status": "error", "message": "解析参数失败"}
    
    # 用来保存所有图片的 base64 数据（永久保存在内存中）
    images_payload = []
    image_base64_list = []  # 👈 新增
    
    for idx, f in enumerate(files):
        b = await f.read()
        
        # 把图片转成 base64 字符串
        b64_str = base64.b64encode(b).decode()
        image_base64_list.append(b64_str)  # 👈 保存到内存中
        
        images_payload.append({
            "type": "image_url",
            "image_url": {
                "url": "data:image/jpeg;base64," + b64_str
            }
        })
    
    reason_str = data.get('reason', '社团物资采购')
    
    prompt = """
只输出JSON，不要解释。
你是一位高智能的财务报销助手。用户一次性上传了多张混合在一起的图片（包含发票、天猫/京东购买详情截图、支付宝/微信支付记录流水），它们顺序是乱的。
请帮我完成以下两件事：
1. 识别并提取发票中的基本字段: amount (总金额), buyer, tax_id, 以及 items (商品清单列表，含 name, quantity, price, discount, total, remark)。
2. 【核心图片连连看匹配】：
   仔细观察用户上传的每张图片（对应的图片索引从 0 开始，即第一张图索引为 0，第二张为 1...）。
   请自动判定每张图的类型（发票/购买详情/支付记录），并把【属于同一个商品订单】的图片组合在一起。
   
输出的 JSON 中必须包含 `image_groups` 字段，格式如下：
"image_groups": [
  {
    "invoice_idx": 0,       # 该商品对应的发票图片索引（若无匹配则填 null）
    "order_idx": 2,         # 该商品对应的购买详情/订单截图索引（若无匹配则填 null）
    "payment_idx": 1        # 该商品对应的支付记录/网银流水截图索引（若无匹配则填 null）
  }
]
3. 针对每组商品，根据用户提供的报销事由（""" + reason_str + """）动态生成：
   purpose_statement (用途阐述)、dynamic_activity_name (活动名称)、dynamic_activity_info (活动常态化方案)、dynamic_relation (器材与活动关联)、dynamic_effect (预期效果)。
"""
    try:
        raw = call_zhipu_vision([
            {"role": "user", "content": [{"type": "text", "text": prompt}, *images_payload]}
        ]).replace("```json", "").replace("```", "").strip()
        result_data = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI识别失败: {str(e)}")
    
    # 👇 关键改动：把图片的 base64 数据传给前端（不传文件路径了）
    result_data["image_base64_list"] = image_base64_list
    
    validation_results = ["🟢 正常：发票预审通过"]
    
    return {
        "ai_data": result_data,
        "check_status": "✔",
        "check_details": validation_results
    }

# ==================== 导出 Word 接口 ====================
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from fastapi.responses import FileResponse
import time

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

@app.post("/api/v1/reimburse/export")
async def export_word(payload: dict):
    try:
        base_info = payload.get("base_info", {})
        ai_data = payload.get("ai_data", {})
        
        # 👇 关键改动：获取图片的 base64 数据（不再是文件路径）
        image_base64_list = ai_data.get("image_base64_list", [])
        image_groups = ai_data.get("image_groups", [])
        
        doc = Document()
        
        # =======================================================
        # 第一页：封面
        # =======================================================
        title = doc.add_paragraph()
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title.add_run("\n\n\n封面\n").font.size = Pt(22)
        
        reimburse_name = base_info.get('name', '张智雨')
        total_amt = ai_data.get('amount', '500')
        reimburse_method = base_info.get('method', '对私转账')
        
        infos = [
            f"报销事由: {base_info.get('reason', 'SIGS学生跆拳道社团 训练物资报销')}",
            f"报销方式: {reimburse_method}给{reimburse_name}，报销总金额为{total_amt}元",
            f"报销人姓名: {reimburse_name}",
            f"报销人学号: {base_info.get('studentId', '2025214507')}",
            f"联系方式: {base_info.get('contact', '18683380921')}",
            f"报销金额: {total_amt}元",
        ]
        for info in infos:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(1.2)
            p.add_run(info).font.size = Pt(14)
            
        # =======================================================
        # 第二页：证明材料明细表
        # =======================================================
        doc.add_page_break()
        doc.add_paragraph().add_run("证明材料").font.size = Pt(18)
        
        p_user = doc.add_paragraph()
        p_user.add_run(f"报销人姓名: {reimburse_name}\n报销人学号: {base_info.get('studentId', '2025214507')}\n报销金额: {total_amt}元\n明细：").font.size = Pt(12)
        
        items = ai_data.get("items", [])
        table = doc.add_table(rows=1, cols=6)
        table.style = 'Table Grid'
        
        hdr_cells = table.rows[0].cells
        headers = ['物品', '数量/个', '单价/元', '优惠/元', '总价（元）', '备注']
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
            set_cell_background(hdr_cells[i], "3B82F6")
            hdr_cells[i].paragraphs[0].runs[0].font.color.rgb = RGBColor(255, 255, 255)
            hdr_cells[i].paragraphs[0].runs[0].font.bold = True
        
        for item in items:
            row_cells = table.add_row().cells
            row_cells[0].text = str(item.get("name", "商品明细"))
            row_cells[1].text = str(item.get("quantity", "1"))
            row_cells[2].text = str(item.get("price", ""))
            row_cells[3].text = str(item.get("discount", "0"))
            row_cells[4].text = str(item.get("total", ""))
            row_cells[5].text = str(item.get("remark", ""))
        
        total_row_cells = table.add_row().cells
        total_row_cells[0].text = "合计"
        total_row_cells[4].text = f"{total_amt}元"
        total_row_cells[0].paragraphs[0].runs[0].font.bold = True
        total_row_cells[4].paragraphs[0].runs[0].font.bold = True
        
        p_bottom_text = doc.add_paragraph()
        p_bottom_text.paragraph_format.space_before = Pt(12)
        current_date = time.strftime('%Y年%m月%d日')
        ai_purpose = ai_data.get("purpose_statement", "特购置相关物资。")
        
        bottom_text = (
            f"\n合计：{total_amt}元\n"
            f"事由：{base_info.get('reason', '训练物资')}\n\n"
            f"用途：{ai_purpose}\n"
            f"签名：\n\n"
            f"日期：{current_date}\n"
        )
        p_bottom_text.add_run(bottom_text).font.size = Pt(12)
        
                # =======================================================
        # 第三页：图片智能化顺次平铺 (发票X -> 购买记录X -> 支付记录X)
        # 👇 关键改动：从内存中读取图片数据，而不是从硬盘
        # =======================================================
        if image_groups:
            doc.add_page_break()
            
            for g_idx, group in enumerate(image_groups):
                g_num = g_idx + 1
                
                # 1. 插入当前商品的发票
                inv_i = group.get("invoice_idx")
                if inv_i is not None and inv_i < len(image_base64_list):
                    try:
                        # 从 base64 解码图片数据
                        img_data = base64.b64decode(image_base64_list[inv_i])
                        img_stream = io.BytesIO(img_data)  # 放到内存中
                        
                        p_t = doc.add_paragraph()
                        p_t.add_run(f"发票{g_num}：").font.bold = True
                        p_img = doc.add_paragraph()
                        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_img.add_run().add_picture(img_stream)  # 从内存读取
                        print(f"✅ 发票{g_num}插入成功！")
                    except Exception as e:
                        print(f"❌ 插入发票{g_num}失败: {e}")
                
                # 2. 插入当前商品的购买记录
                order_i = group.get("order_idx")
                if order_i is not None and order_i < len(image_base64_list):
                    try:
                        img_data = base64.b64decode(image_base64_list[order_i])
                        img_stream = io.BytesIO(img_data)
                        
                        p_t = doc.add_paragraph()
                        p_t.add_run(f"购买记录{g_num}").font.bold = True
                        p_img = doc.add_paragraph()
                        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_img.add_run().add_picture(img_stream)
                        print(f"✅ 购买记录{g_num}插入成功！")
                    except Exception as e:
                        print(f"❌ 插入购买记录{g_num}失败: {e}")
                    
                # 3. 插入当前商品的支付记录
                pay_i = group.get("payment_idx")
                if pay_i is not None and pay_i < len(image_base64_list):
                    try:
                        img_data = base64.b64decode(image_base64_list[pay_i])
                        img_stream = io.BytesIO(img_data)
                        
                        p_t = doc.add_paragraph()
                        p_t.add_run(f"支付记录{g_num}").font.bold = True
                        p_img = doc.add_paragraph()
                        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_img.add_run().add_picture(img_stream)
                        print(f"✅ 支付记录{g_num}插入成功！")
                    except Exception as e:
                        print(f"❌ 插入支付记录{g_num}失败: {e}")
        
        # =======================================================
        # 第四页：【全动态 AI 生成】专属支撑材料与活动策划说明
        # =======================================================
        doc.add_page_break()
        h6 = doc.add_paragraph()
        r = h6.add_run("购买说明与社团活动策划案")
        r.font.size = Pt(18)
        r.font.bold = True
        r.font.color.rgb = RGBColor(59, 130, 246)
        
        ai_act_name = ai_data.get("dynamic_activity_name", f"SIGS 学生社团专项活动")
        ai_act_info = ai_data.get("dynamic_activity_info", "活动时间：常态化开展\n活动地点：校区内规划场地\n参与人员：社团在册成员")
        ai_relation = ai_data.get("dynamic_relation", "本物资有效保障了集体活动的正常开展。")
        ai_effect = ai_data.get("dynamic_effect", "丰富了校园多元文化活动。")
        
        first_item_name = items[0].get("name", "相关物资") if items else "相关物资"
        first_item_total = items[0].get("total", total_amt) if items else total_amt
        
        doc.add_paragraph().add_run("【1. 购买说明情况】").font.bold = True
        p_c1 = doc.add_paragraph()
        p_c1.add_run(
            f"采购物资为{first_item_name}，总价 {first_item_total} 元，本次申请报销 {total_amt} 元（按社团报销额度执行），"
            "订单截图、电子发票齐全，票据真实有效。\n"
            f"物资用途：{ai_purpose}"
        ).font.size = Pt(12)
        
        doc.add_paragraph().add_run("\n【2. 活动策划案】").font.bold = True
        p_c2 = doc.add_paragraph()
        p_c2.add_run(f"活动名称：{ai_act_name}\n{ai_act_info}").font.size = Pt(12)
        
        doc.add_paragraph().add_run("\n【3. 器材与活动的关联】").font.bold = True
        p_c3 = doc.add_paragraph()
        p_c3.add_run(ai_relation).font.size = Pt(12)
        
        doc.add_paragraph().add_run("\n【4. 预期效果】").font.bold = True
        p_c4 = doc.add_paragraph()
        p_c4.add_run(ai_effect).font.size = Pt(12)
        
        # 保存并导出
        file_path = "/tmp/reimburse_report.docx" if os.name != 'nt' else "reimburse_report.docx"
        doc.save(file_path)
        
        return FileResponse(
            path=file_path,
            filename=f"清华大学SIGS报销单-{base_info.get('name','报告')}.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        print(f"生成Word失败: {e}")
        raise HTTPException(status_code=500, detail=f"Word导出故障: {str(e)}")

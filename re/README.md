# AI Reimburse Assistant - 智能报销材料生成器

一个基于智谱GLM-4V的校内报销自动化工具，通过OCR识别发票、订单和支付记录，自动生成标准Word报销材料。

## ✨ 更新内容

### v1.1 - 真实AI OCR支持
- 🔥 **集成智谱GLM-4V OCR API**：真实的图片识别能力
- 📁 **三路文件上传**：独立的发票、订单、支付记录上传区域
- 📄 **智能分组显示**：Word文档按文件类型分组展示
- 🎯 **精确提取信息**：自动识别金额、商户、商品明细等

## 功能特点

一个基于AI的校内报销自动化工具，通过OCR识别发票、自动生成标准Word报销材料。

## 功能特点

- 📱 **极简界面**：遵循财务系统严谨风格，操作简单直观
- 🤖 **智能识别**：使用AI技术自动识别发票金额、商户、商品明细
- ✅ **自动校验**：内置财务规则，确保报销材料完整合规
- 📄 **Word导出**：一键生成符合校内财务标准的Word文档
- 🎯 **高效流程**：填表 + 上传 → AI处理 → Word生成

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python server.py
```

或者直接运行批处理文件：
```bash
start.bat
```

### 3. 访问应用

打开浏览器访问：`ai-reimburse-tool.html`（无需运行服务器页面）

## 📋 使用方法

### 1. **填写基本信息**
   - 报销事由
   - 报销方式（现金报销/银行转账/公务卡）
   - 报销人信息（姓名、学号、联系方式）
   - 活动时间

### 2. **上传材料**
   **发票上传区域（蓝色）**
   - 上传发票图片
   - 系统自动识别：金额、商户、开票日期、商品明细
   
   **订单上传区域（绿色）**
   - 上传订单截图
   - 系统自动识别：商品名称、数量、单价、总金额
   
   **支付记录上传区域（紫色）**
   - 上传支付截图
   - 系统自动识别：支付金额、支付时间、收款方

### 3. **AI自动处理**
   - OCR识别：使用智谱GLM-4V识别图片内容
   - 数据结构化：将识别结果转化为结构化数据
   - 合规校验：检查报销材料是否完整

### 4. **查看结果**
   - 实时显示处理进度
   - 展示校验结果（完整/缺失/风险项）
   - 查看所有识别出的票据信息

### 5. **导出Word文档**
   - 一键生成标准报销材料
   - 文档包含：
     - 基本信息
     - 票据明细（按文件类型分组）
     - 签领表

## 使用方法

1. **填写基本信息**
   - 报销事由
   - 报销方式
   - 报销人信息（姓名、学号、联系方式）
   - 活动时间

2. **上传发票材料**
   - 支持拖拽或点击上传
   - 可同时上传多张发票、订单截图、支付记录
   - 支持 JPG、PNG、PDF 等格式

3. **AI自动处理**
   - 系统自动识别发票内容
   - 智能提取金额、商户、商品信息
   - 进行合规性校验

4. **查看结果**
   - 实时显示处理进度
   - 展示校验结果（完整/缺失/风险项）
   - 一键生成Word报销材料

5. **导出文档**
   - 下载生成的Word文档
   - 文档包含封面、明细表、签领表等标准格式

## 技术架构

### 前端
- HTML5 + CSS3
- TailwindCSS
- 原生JavaScript

### 后端
- FastAPI (Python)
- python-docx (文档生成)
- PIL (图像处理)
- OCR引擎（可接入智谱GLM等AI服务）

### 数据流程
```
前端表单 → 后端API → OCR识别 → 数据校验 → Word生成 → 文件下载
```

## API接口

### 1. 处理报销申请
```
POST /api/v1/reimburse/process
Content-Type: multipart/form-data
```

参数：
- purpose: 报销事由
- reimburse_type: 报销方式
- user_name: 报销人姓名
- student_id: 学号
- phone: 联系方式
- activity_date: 活动时间
- files: 发票文件

### 2. 导出Word文档
```
POST /api/v1/reimburse/export
Content-Type: application/json
```

## 项目结构

```
├── ai-reimburse-tool.html    # 前端工具页面
├── server.py                # 后端API服务
├── requirements.txt         # Python依赖
├── start.bat               # 启动脚本
├── README.md               # 说明文档
└── uploads/               # 临时文件目录（自动创建）
```

## 开发说明

### 添加AI OCR服务

当前使用的是模拟数据，如需接入真实的OCR服务，请修改`server.py`中的`process_reimbursement`函数：

```python
# 使用智谱GLM-4.5多模态API
def ocr_invoice(image_base64):
    headers = {
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    }
    
    data = {
        "model": "glm-4v",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "请识别这张发票，提取金额、商户、商品明细等关键信息，以JSON格式返回。"
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_base64}"
                        }
                    }
                ]
            }
        ]
    }
    
    response = requests.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', 
                           headers=headers, json=data)
    return response.json()
```

### 自定义Word模板

可以通过修改`export_reimbursement`函数中的Word生成逻辑，自定义符合学校要求的模板格式。

## 注意事项

1. 确保Python环境版本为3.8或以上
2. 上传的文件大小建议不超过5MB
3. 支持的图片格式：JPG, PNG, GIF, WebP
4. 生成Word文档需要时间，请耐心等待
5. 建议使用Chrome或Firefox浏览器以获得最佳体验

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进这个项目。
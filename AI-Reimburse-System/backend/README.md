# AI报销材料生成器 - 后端服务

基于 FastAPI + GPT-4o Vision 的智能报销材料处理系统。

## 快速开始

### 1. 安装依赖

```bash
pip install fastapi uvicorn openai python-multipart
```

### 2. 配置 API Key

**方式一：使用环境变量（推荐）**

Windows CMD:
```cmd
set OPENAI_API_KEY=sk-your-api-key-here
```

Windows PowerShell:
```powershell
$env:OPENAI_API_KEY="sk-your-api-key-here"
```

Linux/Mac:
```bash
export OPENAI_API_KEY=sk-your-api-key-here
```

**方式二：使用 .env 文件**

1. 复制 `.env.example` 为 `.env`
2. 编辑 `.env` 文件，填入你的 API Key

### 3. 启动服务

```bash
python main.py
```

服务将在 `http://127.0.0.1:8000` 启动。

### 4. 访问 API 文档

打开浏览器访问：`http://127.0.0.1:8000/docs`

## API 接口说明

### 1. 健康检查

```
GET /api/v1/reimburse/health
```

返回示例：
```json
{
  "status": "ok",
  "api_configured": true,
  "model": "gpt-4o",
  "cached_files": 0
}
```

### 2. 文件上传

```
POST /api/v1/reimburse/upload
Content-Type: multipart/form-data
```

参数：
- `files`: 上传的文件列表（支持多文件）

返回示例：
```json
{
  "success": true,
  "file_count": 2,
  "message": "成功上传 2 个文件",
  "file_names": ["invoice1.jpg", "invoice2.png"]
}
```

### 3. 报销处理（核心接口）

```
POST /api/v1/reimburse/process
Content-Type: multipart/form-data
```

参数：
- `formData`: JSON 字符串，包含报销基础信息
- `files`: 发票/订单截图文件列表

formData 示例：
```json
{
  "name": "张三",
  "studentId": "20260001",
  "contact": "13800138000",
  "reason": "2026年春季学术研讨会午餐及物料采购"
}
```

返回示例：
```json
{
  "activity": "2026年春季学术研讨会",
  "user": {
    "name": "张三",
    "student_id": "20260001",
    "phone": "13800138000"
  },
  "amount": 258.50,
  "items": [
    {
      "item_name": "A4打印纸",
      "quantity": 2,
      "unit_price": 25.00,
      "discount": 0.00,
      "total_price": 50.00,
      "remark": "用于打印活动资料"
    }
  ],
  "invoice_status": true,
  "validation_results": {
    "missing_items": [],
    "risks": [],
    "calculated_total": 258.50,
    "amount_match": true
  }
}
```

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| OPENAI_API_KEY | 是 | - | OpenAI API Key |
| OPENAI_API_BASE | 否 | https://api.openai.com/v1 | API 端点（用于国内中转） |
| MODEL_NAME | 否 | gpt-4o | 使用的模型名称 |

## 常见问题

### 1. API Key 未配置错误

错误信息：`API Key 未配置，请设置环境变量 OPENAI_API_KEY`

解决方法：按照上述步骤配置环境变量

### 2. API Key 无效错误

错误信息：`API Key 无效，请检查 OPENAI_API_KEY 环境变量是否正确配置`

解决方法：
- 检查 API Key 是否正确
- 确认 API Key 是否有效（未过期、有余额）
- 如果使用国内中转，检查 OPENAI_API_BASE 是否正确

### 3. 跨域问题

后端已配置 CORS，允许所有来源访问。如果仍有问题，请检查前端请求地址是否正确。

## 开发说明

- 后端框架：FastAPI (Python 3.10+)
- AI模型：OpenAI GPT-4o Vision
- 文档：自动生成 Swagger UI 和 ReDoc

## 下一步计划

- [ ] 接入 CLM-5.1 API（国内大模型）
- [ ] 完善校验规则引擎
- [ ] 添加 Word 生成功能
- [ ] 添加数据库持久化

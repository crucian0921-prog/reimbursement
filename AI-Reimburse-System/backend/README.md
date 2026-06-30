# AI 报销材料生成器 - 后端服务

基于 FastAPI + 智谱 GLM 视觉模型的报销材料处理服务。

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置智谱 API Key

Windows CMD:

```cmd
set ZHIPU_API_KEY=your-zhipu-api-key-here
```

Windows PowerShell:

```powershell
$env:ZHIPU_API_KEY="your-zhipu-api-key-here"
```

Linux/Mac:

```bash
export ZHIPU_API_KEY=your-zhipu-api-key-here
```

也可以复制 `.env.example` 为 `.env` 后填写。

### 3. 启动服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

服务地址：`http://127.0.0.1:8000`
API 文档：`http://127.0.0.1:8000/docs`

## Railway 部署

项目根目录已有 `railway.json`，会让 Railway 使用 `backend` 目录构建，并执行：

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Railway Variables 里至少需要配置：

| 变量名 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ZHIPU_API_KEY` | 是 | - | 智谱 API Key |
| `ZHIPU_API_BASE` | 否 | `https://open.bigmodel.cn/api/paas/v4` | 智谱 API 地址 |
| `ZHIPU_MODEL` | 否 | `glm-4v-flash` | 智谱视觉模型 |

健康检查地址：`/api/v1/reimburse/health`

## API

### 健康检查

```http
GET /api/v1/reimburse/health
```

### 报销识别

```http
POST /api/v1/reimburse/process
Content-Type: multipart/form-data
```

字段：

- `user_info`: JSON 字符串，包含 `reason`、`name`、`studentId`、`contact`
- `files`: 图片文件列表

### 导出 Word

```http
POST /api/v1/reimburse/export
Content-Type: application/json
```

## 前端连接后端

前端默认本地访问：`http://当前主机:8000`。

生产环境建议在前端部署平台配置：

```text
NEXT_PUBLIC_API_BASE_URL=https://你的后端域名
```

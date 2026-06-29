# AI Reimburse Assistant —— 智能报销材料生成器（脚手架 v0.1）

这是根据 PRD + 原型图搭建的**可立即跑通**的全栈脚手架。目标是先把"填表 → 上传 → AI识别 → 校验 → 生成Word → 下载"的完整流程跑通，再逐步替换成正式架构。

## 一、为什么用 Flask，而不是 PRD 里写的 Next.js + FastAPI？

PRD 6.1 推荐的是 Next.js + FastAPI 两个独立服务，这是更标准的正式架构，后面建议按那个方向演进。
但 Next.js / FastAPI 都需要联网装一堆依赖（npm install / pip install），为了让你**现在就能在自己电脑上一条命令跑起来、不卡在环境安装上**，这一版先用：

- 后端：**Flask**（单进程，零额外服务）
- 前端：**原生 HTML + CSS + JS**（不需要 npm / 构建步骤，浏览器直接打开页面用）

两者由同一个 Flask 进程提供，所以「跑通流程」这件事现在就是真的：本仓库已经在沙箱里完整跑过一遍 创建session→填表→上传→OCR(mock)→结构化→校验→生成Word→下载，生成的 `.docx` 内容结构跟 PRD 4.5 节完全对应（封面/证明材料/发票凭证/垫付事由/签领表/活动策划六个部分都有）。

业务逻辑全部放在 `services/` 三个模块里，和 Web 框架无关，所以**之后要迁移到 FastAPI 完全是把路由层重写一遍，OCR/校验/Word生成三个模块可以原样照搬**，详见第五节。

## 二、目录结构

```
ai-reimburse-assistant/
├── app.py                     # Flask 主入口：路由 + session 管理
├── requirements.txt
├── services/
│   ├── ocr_service.py         # OCR识别 + AI结构化（对应PRD 4.2/4.3）
│   ├── validator.py           # 合规性校验规则引擎（对应PRD 4.4）
│   └── docx_generator.py      # Word文档生成（对应PRD 4.5）
├── templates/
│   └── index.html             # 单页面，还原原型图五个分区
├── static/
│   ├── style.css              # 视觉规范取自 PRD 5.1（白底/浅卡片/弱边框）+ 原型图强调色
│   └── script.js              # 前端交互：上传预览、状态轮转、校验结果渲染、生成/下载
├── uploads/                    # 运行期上传文件暂存（按 session 分目录）
└── outputs/                    # 生成的 .docx 输出目录
```

## 三、怎么跑起来

```bash
cd ai-reimburse-assistant
pip install -r requirements.txt
python app.py
```

打开 http://127.0.0.1:5000 即可看到页面：填基础信息 → 上传发票/订单/支付截图 → 点「生成报销 Word」→ 右侧会依次显示 OCR识别/AI结构化/校验规则执行的状态，校验结果区会列出完整项/缺失项/风险项 → 完成后「下载 Word」按钮可用。

**默认是 Mock OCR 模式**（没配置 `OPENAI_API_KEY` 时），用模拟数据演示完整流程，方便不接真实 AI 也能看到效果。界面右上角会有提示。

## 四、接入真实 GPT-4o Vision OCR

1. `pip install openai`（取消 requirements.txt 里的注释）
2. 设置环境变量：`export OPENAI_API_KEY=sk-xxxx`
3. 重启服务，`services/ocr_service.py` 里的 `USE_MOCK` 会自动变成 `False`，走真实的 `call_gpt4o_vision()` 逻辑

如果你们更想用 Claude 来做 OCR（毕竟现在就在用 Claude），把 `call_gpt4o_vision()` 换成调用 Anthropic `/v1/messages`（图片用 `image` content block）即可，输出字段保持一致，其他模块不需要改。

## 五、后续迁移到 PRD 正式架构（Next.js + FastAPI）的路径

1. **后端**：把 `app.py` 里每个 `@app.route` 路由，用同样的路径和参数改写成 FastAPI 的 `@app.post`，`services/` 三个模块直接复制过去，不用改业务逻辑。Session 状态建议从内存字典换成 Redis 或数据库（虽然 PRD 第7节说 MVP 不需要数据库，但 session 状态总要有个地方存）。
2. **前端**：`templates/index.html` 的五个卡片区域，原样拆成 Next.js 的 5 个组件（`BasicInfoCard` / `UploadCard` / `AIStatusCard` / `ValidationCard` / `ExportCard`），`script.js` 里的 fetch 调用逻辑搬进对应组件的 `useState` + `useEffect`，接口路径不变。
3. CSS 变量在 `static/style.css` 顶部的 `:root` 里，直接照搬进 Tailwind 的 `tailwind.config.js` 自定义颜色即可。

## 六、跟原型图相比，我做了 1 个小补充

原型图的"缺失项"里有一条"缺少审批截图（报销金额超过200元需上传审批流程图）"，但材料上传区只画了发票/订单/支付三个上传框。为了让这条校验规则真的能触发/解除，我在上传区下面加了一个轻量的"审批截图"行内上传入口（非必填，超过200元才会提示）。如果你们想要更明确的设计（比如做成第四个 dropzone），告诉我我再调整。

## 七、已知的简化 / 待办（如实告知，避免你以为这是成品）

- Mock OCR 的识别结果是固定的示例数据，不是真的"看图识别"，接入真 GPT-4o Vision 后才是真实效果
- 没有做登录/数据库/多用户（符合 PRD 第7节 MVP 约束）
- "AI 智能优化说明"那个按钮（原型图里证明材料卡片右上角）目前还没接，后续可以做成调用 LLM 把用户写的活动说明润色得更规范
- 生产部署需要换掉 Flask 自带的开发服务器（比如用 gunicorn），并加上文件大小限制、上传类型校验等基础安全措施

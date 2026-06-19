# Checklist - AI 知识蒸馏站

> **关联文档**：[PRD.md](./PRD.md) | [Design.md](./Design.md) | [Plan.md](./Plan.md) | [tasks.md](./tasks.md)
> **用途**：系统性验证实施结果是否符合规格要求

---

## 阶段 1：项目脚手架与基础设施

- [ ] Monorepo 结构正确创建（`apps/web`, `apps/extension`, `packages/shared`, `services/media-processor`）
- [ ] `pnpm-workspace.yaml` 和 `turbo.json` 配置正确
- [ ] Next.js 14 应用可正常启动（`pnpm dev`）
- [ ] Tailwind CSS 和 shadcn/ui 配置完成，样式生效
- [ ] Prisma Schema 已创建并迁移成功（数据库表存在）
- [ ] Prisma 客户端单例可正常连接数据库
- [ ] NextAuth.js 配置完成，GitHub OAuth 登录可用
- [ ] 邮箱密码登录可用（如配置了邮件服务）
- [ ] 未登录访问 `(dashboard)` 路由被重定向到登录页
- [ ] 工作区布局（侧边栏 + 顶栏）渲染正常
- [ ] `.env.example` 包含所有必需环境变量
- [ ] 共享类型包 `packages/shared` 可被 `apps/web` 正确导入
- [ ] Python 媒体处理服务目录结构创建完整（`services/media-processor/app/`）
- [ ] `requirements.txt` 包含所有 Python 依赖（fastapi, yt-dlp, ffmpeg-python, opendataloader-pdf, openai-whisper, beautifulsoup4）
- [ ] `pyproject.toml` 配置 ruff + black（强制 PEP 8）
- [ ] `py -m uvicorn app.main:app --reload` 可启动 Python 服务
- [ ] `GET /health` 返回 200
- [ ] 系统依赖已安装：Java 11+（opendataloader-pdf 依赖）、ffmpeg
- [ ] `docker-compose.yml` 可一键启动 web + media-processor + postgres
- [ ] Python 服务 Dockerfile 构建成功（含 Java + ffmpeg）

## 阶段 2：AI 供应商适配器 + 蒸馏核心

- [ ] `AIProvider` 统一接口定义完整（`chat` + `streamChat`）
- [ ] 5 个供应商适配器全部实现（OpenAI/Anthropic/Qwen/DeepSeek/Zhipu）
- [ ] 每个适配器支持 JSON Mode 或等效的 JSON 输出引导
- [ ] `AIProviderFactory` 可根据用户配置创建对应适配器
- [ ] AES-256-GCM 加密工具实现正确（`encrypt`/`decrypt` 可逆）
- [ ] 蒸馏 Prompt 模板定义完整（system + user）
- [ ] 蒸馏结果 Zod Schema 校验生效
- [ ] `DistillService` 完整实现蒸馏流水线（提取→清洗→AI→结构化→入库）
- [ ] `POST /api/distill` 可创建蒸馏任务
- [ ] `GET /api/distill/[id]` 可查询蒸馏状态
- [ ] 设置页可添加/编辑/删除 API 配置
- [ ] API Key 在数据库中加密存储
- [ ] 可切换默认供应商
- [ ] 首页快速蒸馏功能可用：粘贴文本 → 蒸馏 → 展示结构化结果
- [ ] 蒸馏结果包含：摘要、关键点、大纲、实体、推荐标签
- [ ] 蒸馏结果自动保存到数据库
- [ ] 单次蒸馏耗时 < 10 秒（文本输入）
- [ ] LLM API 调用失败时有重试机制
- [ ] LLM 输出非 JSON 时有降级处理

## 阶段 3：知识库管理 + 搜索

- [ ] `GET /api/knowledge` 支持分页 + 过滤（标签、时间、来源）
- [ ] `GET /api/knowledge/[id]` 返回完整详情
- [ ] `PATCH /api/knowledge/[id]` 可更新标题、标签、笔记
- [ ] `DELETE /api/knowledge/[id]` 执行软删除
- [ ] `GET /api/search` 支持全文搜索（ILIKE）
- [ ] 搜索支持关键词高亮
- [ ] `GET/POST/DELETE /api/tags` 标签管理功能完整
- [ ] 知识库列表页正常渲染（卡片视图 + 列表视图）
- [ ] 视图切换功能正常
- [ ] `TagFilter` 组件可按标签过滤
- [ ] 分页功能正常
- [ ] 空状态、加载态、错误态显示正确
- [ ] 知识详情页展示所有字段（摘要、关键点、大纲、标签、原文）
- [ ] 详情页可编辑标题和标签
- [ ] 详情页删除功能带确认弹窗
- [ ] 详情页展示关联知识
- [ ] 搜索页可输入关键词并返回结果
- [ ] 搜索结果高亮关键词
- [ ] 搜索过滤器（标签、时间、来源）正常工作
- [ ] 知识库列表加载 < 500ms
- [ ] 全文搜索响应 < 200ms

## 阶段 4：浏览器插件

- [ ] `manifest.json` 符合 Manifest V3 规范
- [ ] 插件可在 Chrome 开发者模式加载
- [ ] 点击插件图标可打开 Side Panel
- [ ] Content Script 可提取页面正文（Readability）
- [ ] 提取内容包括标题、作者、发布时间、正文
- [ ] Side Panel 显示页面预览（标题、字数、阅读时间）
- [ ] 点击"一键蒸馏"可调用后端 API
- [ ] 蒸馏进度实时展示（轮询）
- [ ] 蒸馏结果在 Side Panel 完整展示
- [ ] 可编辑推荐标签
- [ ] 点击"保存"可入库
- [ ] 右键菜单"蒸馏选中内容"功能可用
- [ ] 未登录时引导用户到 Web 端登录
- [ ] 登录态通过 `chrome.storage.local` 持久化
- [ ] 网页蒸馏耗时 < 10 秒
- [ ] 蒸馏结果在 Web 端知识库可见

## 阶段 5：知识图谱

- [ ] `calculateRelationWeight` 函数正确计算关联强度（实体 + 标签）
- [ ] `createConnections` 在蒸馏完成后自动调用
- [ ] 仅创建 weight > 0.3 的关联
- [ ] `GET /api/graph` 返回 `{ nodes, edges }` 结构
- [ ] 支持 `tag` 和 `timeRange` 过滤参数
- [ ] 节点包含 `degree`（连接数）
- [ ] 图谱页面正常渲染（React Flow）
- [ ] 力导向布局自动排列节点
- [ ] 节点大小反映连接数
- [ ] 边粗细反映关联强度
- [ ] 点击节点跳转到知识详情
- [ ] 边悬停显示关联强度
- [ ] 标签过滤器正常工作
- [ ] 时间范围过滤器正常工作
- [ ] 关联强度阈值滑块正常工作
- [ ] 蒸馏 5+ 篇相关文章后图谱显示有意义的关联
- [ ] 图谱渲染（100 节点）< 1 秒

## 阶段 6：PDF + 抖音/小红书媒体蒸馏

### 6.A PDF 蒸馏（opendataloader-pdf）

- [ ] `POST /api/upload` 接受 multipart/form-data
- [ ] 文件大小限制 20MB 生效
- [ ] 文件类型限制（pdf, txt, md）生效
- [ ] 文件保存到 `uploads/` 目录
- [ ] Python 服务 `POST /pdf/extract` 端点可调用
- [ ] opendataloader-pdf 正确提取 PDF 为 Markdown
- [ ] Hybrid 模式可处理扫描件（OCR）
- [ ] Hybrid 模式可处理复杂表格
- [ ] `tests/test_pdf.py` 测试通过
- [ ] Next.js 端 `extractPdf()` 可调用 Python 服务
- [ ] 大 PDF 分块蒸馏正常工作
- [ ] 多块蒸馏结果合并正确
- [ ] 50 页 PDF 蒸馏 < 30 秒

### 6.B 抖音视频蒸馏

- [ ] `downloader.py` 可下载抖音视频（yt-dlp）
- [ ] 提取视频元数据（标题、作者、时长）正确
- [ ] 支持 Cookie 配置（反爬）
- [ ] `audio_extractor.py` 可从视频分离音频（ffmpeg）
- [ ] 音频输出为 16kHz 单声道 wav
- [ ] `asr_provider.py` 抽象基类定义完整
- [ ] `WhisperLocalProvider` 可本地转写
- [ ] `CloudASRProvider` 可调用云端 ASR
- [ ] `get_asr_provider()` 工厂函数正常
- [ ] `tests/test_douyin.py` 测试通过
- [ ] `tests/test_asr.py` 测试通过
- [ ] Python 服务 `POST /media/douyin` 端点可调用
- [ ] 完整流程：下载 → 分离音频 → ASR → 返回转写文本
- [ ] 临时文件处理完成后立即删除
- [ ] 链接无效时返回清晰错误
- [ ] 视频删除时返回清晰错误
- [ ] 无语音视频返回清晰错误
- [ ] Next.js 端 `processDouyinVideo()` 可调用 Python 服务
- [ ] `distill.service` 的 `douyin` 分支正常工作
- [ ] 媒体元数据保存到 `Knowledge.mediaMeta`
- [ ] 短视频（< 5 分钟）蒸馏 < 60 秒
- [ ] 长视频（> 10 分钟）蒸馏 < 3 分钟

### 6.C 小红书笔记蒸馏

- [ ] `xhs_extractor.py` 可提取小红书图文笔记
- [ ] `xhs_extractor.py` 可识别视频笔记并返回视频 URL
- [ ] 提取标题、正文、图片 URL 正确
- [ ] 支持 Cookie 配置
- [ ] `tests/test_xiaohongshu.py` 测试通过
- [ ] Python 服务 `POST /media/xiaohongshu` 端点可调用
- [ ] 图文笔记：直接返回文本
- [ ] 视频笔记：复用抖音视频处理流程
- [ ] Next.js 端 `processXiaohongshuNote()` 可调用 Python 服务
- [ ] `distill.service` 的 `xiaohongshu` 分支正常工作
- [ ] 笔记删除/设为私密时返回清晰错误

### 6.D 统一 UI 与体验优化

- [ ] 首页支持多 Tab 切换（文本/PDF/抖音链接/小红书链接）
- [ ] `FileUpload` 组件支持拖拽 + 点击
- [ ] `LinkInput` 组件可自动识别抖音/小红书链接
- [ ] 上传进度显示
- [ ] 蒸馏进度显示（各阶段：下载中 → 分离音频中 → 识别中 → 蒸馏中）
- [ ] SSE 流式进度反馈正常
- [ ] 移动端响应式适配正常
- [ ] 加载骨架屏显示
- [ ] 错误重试机制可用
- [ ] 视频蒸馏结果展示媒体元数据（作者、时长、平台）

## 阶段 7：打磨与部署

- [ ] 所有页面的加载态、空状态、错误态统一
- [ ] 微交互动画流畅
- [ ] 移动端（≥ 375px）适配正常
- [ ] 数据库索引优化完成
- [ ] 无 N+1 查询问题
- [ ] 速率限制生效（蒸馏 20 次/小时，API 60 次/分钟）
- [ ] 所有 API 输入有 Zod 校验
- [ ] XSS 防护（用户输入转义）
- [ ] SQL 注入防护（Prisma 参数化查询）
- [ ] 用户数据隔离（A 用户无法访问 B 用户数据）
- [ ] API Key 加密存储验证
- [ ] `Dockerfile` 构建成功
- [ ] `docker-compose.yml` 可启动完整服务
- [ ] 生产环境变量配置完整
- [ ] `README.md` 包含启动指南
- [ ] Chrome 扩展可打包（`pnpm build`）
- [ ] 完整用户旅程跑通：注册 → 配置 API → 蒸馏 → 知识库 → 图谱

## 跨阶段验证

- [ ] TypeScript 严格模式无类型错误
- [ ] ESLint 无错误
- [ ] Prettier 格式统一
- [ ] 关键服务有单元测试
- [ ] API 端点有集成测试
- [ ] 无控制台错误
- [ ] 无未处理的 Promise rejection
- [ ] 环境变量未硬编码
- [ ] 敏感信息（API Key、密码）未记录到日志

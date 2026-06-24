# ASR Key 用户配置 + Minimax LLM 集成设计

## 背景

抖音/小红书蒸馏依赖媒体服务的 ASR（语音识别）能力。当前 ASR Key 只能在 Render 环境变量全局配置，用户无法自定义，导致：
1. 用户没有 Key 时无法使用（报错"云端 ASR 未配置 API Key"）
2. 共享 Key 有额度限制和隐私顾虑

## 目标

1. 用户可在设置页配置自己的 ASR Key（Groq/OpenAI）
2. Minimax 作为 LLM 供应商加入蒸馏环节
3. 向后兼容：服务端默认 Key 作为 fallback

## 架构

```
浏览器设置页 → Next.js API → 数据库（AES 加密存储）
                            ↓
抖音蒸馏时 → Next.js 读取用户 ASR 配置 → 解密
                            ↓
          → HTTP header 传递给媒体服务
                            ↓
媒体服务 → 优先用 header 凭证，fallback 环境变量 → 调用 Groq/OpenAI
```

## 数据库变更

`ApiConfig` 表新增 `configType` 字段：

```prisma
configType String @default("llm")  // "llm" | "asr"
```

- 现有数据自动填充为 "llm"，向后兼容
- 唯一约束：`@@unique([userId, configType, provider, label])`
- 索引：`@@index([userId, configType, isActive])`

## ASR Provider 选项

| Provider | 默认 API URL | 默认 Model | 免费额度 |
|----------|-------------|-----------|---------|
| Groq | https://api.groq.com/openai/v1/audio/transcriptions | whisper-large-v3 | 288 分钟/天 |
| OpenAI | https://api.openai.com/v1/audio/transcriptions | whisper-1 | 付费 |

## LLM Provider 扩展

新增 Minimax：
- Base URL: https://api.minimaxi.com/v1
- Model: MiniMax-Text-01
- 兼容 OpenAI 协议

## 媒体服务 Header 协议

```
X-ASR-Provider: groq | openai
X-ASR-Api-Key: <解密后的 Key>
X-ASR-Api-Url: <API 端点>
X-ASR-Model: <模型名>
```

优先级：Header > 环境变量 > 报错

## 实施步骤

1. 数据库 migration
2. 前端设置页新增 ASR 配置区 + Minimax LLM 选项
3. Next.js /api/distill 读取 ASR 配置并通过 header 传递
4. 媒体服务支持从 header 读取 ASR 凭证
5. 提交推送

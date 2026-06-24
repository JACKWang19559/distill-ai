-- Add configType field to ApiConfig to distinguish LLM and ASR configurations.
-- Allows users to configure both AI providers (LLM) and ASR providers (Groq/OpenAI) separately.

-- 1. 添加 configType 列，默认值为 'llm'（向后兼容已有数据）
ALTER TABLE "ApiConfig" ADD COLUMN IF NOT EXISTS "configType" TEXT NOT NULL DEFAULT 'llm';

-- 2. 创建复合唯一索引（userId + configType + provider + name）
DROP INDEX IF EXISTS "ApiConfig_userId_provider_name_key";
CREATE UNIQUE INDEX "ApiConfig_userId_configType_provider_name_key" ON "ApiConfig"("userId", "configType", "provider", "name");

-- 3. 创建复合索引（userId + configType + isActive）用于快速查找激活配置
CREATE INDEX IF NOT EXISTS "ApiConfig_userId_configType_isActive_idx" ON "ApiConfig"("userId", "configType", "isActive");

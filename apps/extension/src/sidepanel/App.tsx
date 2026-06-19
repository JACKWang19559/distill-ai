/**
 * Side Panel 主应用组件。
 *
 * 管理视图状态机：
 * loading → login（未登录） / preview（已登录，已提取内容）
 * preview → distilling（点击蒸馏） → result（完成） / error（失败）
 *
 * 同时处理来自 background 的 DISTILL_SELECTION 消息（右键菜单触发）。
 */

import { useEffect, useState, useCallback } from "react";
import { LoginView } from "@/components/LoginView.tsx";
import { DistillPanel } from "@/components/DistillPanel.tsx";
import { ResultView } from "@/components/ResultView.tsx";
import { isLoggedIn, getCurrentUser, logout } from "@/lib/auth.ts";
import { getApiBaseUrl } from "@/lib/storage.ts";
import {
  createDistillTask,
  pollDistillStatus,
  getDistillStatus,
} from "@/lib/api.ts";
import type { PageContent, DistillResult, ExtensionMessage } from "@/types/messages.ts";

/** 视图状态 */
type View = "loading" | "login" | "preview" | "distilling" | "result" | "error";

/** 蒸馏进度阶段 */
type DistillStage = "creating" | "processing" | "polling";

/** 蒸馏阶段文案 */
const STAGE_TEXT: Record<DistillStage, { text: string; subtext: string }> = {
  creating: { text: "正在创建蒸馏任务...", subtext: "准备分析内容" },
  processing: { text: "AI 正在蒸馏...", subtext: "提取摘要、关键点和大纲" },
  polling: { text: "AI 正在蒸馏...", subtext: "提取摘要、关键点和大纲" },
};

/**
 * Side Panel 主应用。
 */
export function App() {
  const [view, setView] = useState<View>("loading");
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [distillResult, setDistillResult] = useState<DistillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<DistillStage>("creating");
  const [user, setUser] = useState<{ name: string | null; email: string } | null>(null);
  const [extractMode, setExtractMode] = useState<"page" | "selection" | "smart">("page");

  /**
   * 提取当前页面内容。
   *
   * 通过 background 向 content script 发送消息。
   */
  const extractContent = useCallback(async (mode: "page" | "selection" | "smart" = "page") => {
    setExtractMode(mode);
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_CURRENT_TAB_CONTENT",
        source: mode,
      });

      if (response?.error) {
        setError(response.error);
        setView("error");
        return;
      }

      if (response?.data) {
        setPageContent(response.data);
        setView("preview");
      } else {
        setError(
          mode === "selection"
            ? "未选中有效内容，请选中一段文字后重试"
            : mode === "smart"
            ? "无法识别页面主内容，请尝试使用整页模式"
            : "无法提取当前页面内容"
        );
        setView("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提取失败");
      setView("error");
    }
  }, []);

  /**
   * 初始化：检查登录态。
   *
   * 已登录则提取当前页面内容，未登录则显示登录视图。
   */
  useEffect(() => {
    const init = async () => {
      const loggedIn = await isLoggedIn();
      if (!loggedIn) {
        setView("login");
        return;
      }

      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser({ name: currentUser.name, email: currentUser.email });
      }

      await extractContent("page");
    };

    init();
  }, [extractContent]);

  /**
   * 监听来自 background 的消息（右键菜单触发选区蒸馏）。
   */
  useEffect(() => {
    const listener = (message: ExtensionMessage) => {
      if (message.type === "DISTILL_SELECTION") {
        extractContent("selection");
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [extractContent]);

  /**
   * 登录成功回调。
   */
  const handleLogin = async () => {
    const currentUser = await getCurrentUser();
    if (currentUser) {
      setUser({ name: currentUser.name, email: currentUser.email });
    }
    await extractContent("page");
  };

  /**
   * 执行蒸馏。
   *
   * 1. 创建蒸馏任务
   * 2. 轮询任务状态
   * 3. 完成后展示结果
   *
   * 如果轮询过程中出错，会尝试最后一次状态查询，
   * 如果任务实际已完成，仍然展示成功页面。
   */
  const handleDistill = async () => {
    if (!pageContent) return;

    setView("distilling");
    setStage("creating");
    setError(null);

    let taskId: string | null = null;

    try {
      // 1. 创建蒸馏任务
      const taskResult = await createDistillTask({
        sourceType: "text",
        content: `# ${pageContent.title}\n\n来源：${pageContent.url}\n${pageContent.author ? `作者：${pageContent.author}\n` : ""}${pageContent.publishedTime ? `发布时间：${pageContent.publishedTime}\n` : ""}\n${pageContent.content}`,
      });
      taskId = taskResult.taskId;

      setStage("processing");

      // 2. 轮询任务状态
      const result = await pollDistillStatus(
        taskId,
        (update) => {
          console.log("[Distill] 轮询更新:", update.status);
          if (update.status === "processing") {
            setStage("polling");
          }
        },
        2000,
        180000
      );

      // 3. 展示结果
      console.log("[Distill] 蒸馏完成，result:", JSON.stringify(result, null, 2));
      setDistillResult(result);
      setView("result");
    } catch (err) {
      console.error("[Distill] 蒸馏过程出错:", err);

      // 如果有 taskId，尝试最后一次查询，可能任务实际已完成
      if (taskId) {
        try {
          const finalResult = await getDistillStatus(taskId);
          console.log("[Distill] 最终状态查询:", finalResult.status);

          if (finalResult.status === "completed") {
            setDistillResult(finalResult);
            setView("result");
            return;
          }
        } catch (retryErr) {
          console.error("[Distill] 最终状态查询也失败:", retryErr);
        }
      }

      setError(err instanceof Error ? err.message : "蒸馏失败");
      setView("error");
    }
  };

  /**
   * 在 Web 端查看。
   */
  const handleViewInWeb = async () => {
    const baseUrl = await getApiBaseUrl();
    // 如果有 knowledgeId，跳转到详情页；否则跳转到知识库列表
    const knowledgeId = distillResult?.knowledge?.id ?? distillResult?.knowledgeId;
    const url = knowledgeId
      ? `${baseUrl}/knowledge/${knowledgeId}`
      : `${baseUrl}/library`;
    chrome.tabs.create({ url });
  };

  /**
   * 蒸馏下一篇。
   */
  const handleContinue = () => {
    setDistillResult(null);
    setPageContent(null);
    extractContent("page");
  };

  /**
   * 返回首页（预览状态）。
   */
  const handleBack = () => {
    setDistillResult(null);
    setPageContent(null);
    extractContent("page");
  };

  /**
   * 登出。
   */
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setView("login");
  };

  // ========== 渲染 ==========

  if (view === "loading") {
    return (
      <div className="app">
        <div className="progress-view">
          <div className="spinner"></div>
          <div className="progress-text">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* 顶栏 */}
      {view !== "login" && (
        <div className="app-header">
          <div className="logo">
            <div className="logo-icon">D</div>
            <span>Distill</span>
          </div>
          {user && (
            <div className="user-menu">
              <div className="user-avatar">
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <button
                className="btn btn-ghost"
                onClick={handleLogout}
                style={{ padding: "4px 8px", fontSize: "12px" }}
              >
                登出
              </button>
            </div>
          )}
        </div>
      )}

      <div className="app-content">
        {view === "login" && <LoginView onLogin={handleLogin} />}

        {view === "preview" && pageContent && (
          <DistillPanel
            pageContent={pageContent}
            onDistill={handleDistill}
            onRefresh={(mode) => extractContent(mode)}
          />
        )}

        {view === "distilling" && (
          <div className="progress-view">
            <div className="spinner"></div>
            <div className="progress-text">{STAGE_TEXT[stage].text}</div>
            <div className="progress-subtext">{STAGE_TEXT[stage].subtext}</div>
          </div>
        )}

        {view === "result" && distillResult && (
          <ResultView
            result={distillResult}
            onContinue={handleContinue}
            onViewInWeb={handleViewInWeb}
            onBack={handleBack}
          />
        )}

        {view === "error" && (
          <div className="error-view">
            <div className="error-icon">⚠️</div>
            <div className="error-text">出错了</div>
            <div className="error-subtext">{error}</div>
            <div className="result-actions">
              <button
                className="btn btn-primary btn-block"
                onClick={() => extractContent(extractMode)}
              >
                重试
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={handleBack}
              >
                🏠 返回首页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

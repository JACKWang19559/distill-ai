/**
 * Background Service Worker。
 *
 * 职责：
 * 1. 监听 action.onClicked → 打开 Side Panel
 * 2. 创建右键菜单（蒸馏选中内容）
 * 3. 消息路由
 */

/** 右键菜单 ID */
const CONTEXT_MENU_ID = "distill-selection";

/**
 * 初始化：创建右键菜单。
 *
 * 在 chrome.runtime.onInstalled 时创建，避免重复创建。
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "蒸馏选中内容",
    contexts: ["selection"],
  });
  console.log("[Distill] 插件已安装");
});

/**
 * 监听插件图标点击 → 打开 Side Panel。
 *
 * 使用 activeTab 权限，为当前标签页打开 side panel。
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id !== undefined && tab.windowId !== undefined) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    // 设置 side panel 仅在当前标签页激活时显示
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: "src/sidepanel/index.html",
      enabled: true,
    });
  }
});

/**
 * 监听右键菜单点击 → 打开 Side Panel 并触发选区蒸馏。
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && tab?.id !== undefined && tab.windowId !== undefined) {
    // 打开 side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });

    // 通知 side panel 使用选区模式
    // 延迟发送，确保 side panel 已就绪
    setTimeout(() => {
      chrome.runtime
        .sendMessage({
          type: "DISTILL_SELECTION",
          tabId: tab.id,
        })
        .catch(() => {
          // side panel 可能还没准备好，忽略错误
        });
    }, 500);
  }
});

/**
 * 检查页面 URL 是否支持 content script 注入。
 *
 * 浏览器内部页面（chrome://, edge://, about:）和扩展商店页面
 * 不允许注入脚本，需要提前过滤。
 *
 * @param url - 标签页 URL
 * @returns 是否可注入
 */
function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  // 仅允许 http/https/file 协议
  return /^https?:\/\//.test(url) || /^file:\/\//.test(url);
}

/**
 * 向 content script 发送消息，失败时动态注入 content script 后重试。
 *
 * 解决 "Receiving end does not exist" 错误：
 * - 页面刚加载，content script 尚未就绪
 * - 页面导航后 content script 未重新注入
 *
 * @param tabId - 目标标签页 ID
 * @param message - 要发送的消息
 * @returns content script 的响应
 */
async function sendMessageWithFallback<T>(
  tabId: number,
  message: { type: string; source?: "page" | "selection" }
): Promise<T> {
  // 第一次尝试：直接发送消息（content script 可能已存在）
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // content script 不存在，尝试动态注入
    const manifest = chrome.runtime.getManifest();
    const contentScriptFiles = manifest.content_scripts?.[0]?.js ?? [];

    if (contentScriptFiles.length === 0) {
      throw new Error("插件配置错误：未找到 content script");
    }

    // 动态注入 content script 文件
    await chrome.scripting.executeScript({
      target: { tabId },
      files: contentScriptFiles,
    });

    // 注入后重试发送消息
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

/**
 * 消息路由：处理来自 side panel 的请求。
 *
 * - GET_CURRENT_TAB_CONTENT: 获取当前标签页内容（通过 content script）
 * - OPEN_SIDEPANEL: 打开 side panel
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_CURRENT_TAB_CONTENT") {
    // 查询当前活跃标签页
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ data: null, error: "无法获取当前标签页" });
        return;
      }

      // 检查页面 URL 是否支持注入
      if (!isInjectableUrl(tab.url)) {
        sendResponse({
          data: null,
          error: "当前页面不支持内容提取（浏览器内部页面无法注入脚本），请切换到普通网页后重试",
        });
        return;
      }

      try {
        // 向 content script 发送提取请求（带 fallback 动态注入）
        const response = await sendMessageWithFallback<{
          data: unknown;
          error?: string;
        }>(tab.id, {
          type: "EXTRACT_PAGE",
          source: message.source ?? "page",
        });
        sendResponse(response);
      } catch (err) {
        sendResponse({
          data: null,
          error:
            err instanceof Error
              ? `无法连接到页面：${err.message}`
              : "无法连接到页面，请刷新后重试",
        });
      }
    });

    return true; // 异步响应
  }

  return false;
});

// Service Worker 导出（保持模块化）
export {};

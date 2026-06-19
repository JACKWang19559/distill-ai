/**
 * 蒸馏面板组件。
 *
 * 展示当前页面预览信息，提供"一键蒸馏"按钮。
 * 支持整页模式和智能识别模式切换，切换时重新提取对应内容。
 */

import type { PageContent } from "@/types/messages.ts";

interface DistillPanelProps {
  /** 提取的页面内容 */
  pageContent: PageContent;
  /** 蒸馏按钮回调 */
  onDistill: () => void;
  /** 重新提取回调（传入 mode 切换提取模式） */
  onRefresh: (mode: "page" | "selection" | "smart") => void;
}

/**
 * 蒸馏面板。
 */
export function DistillPanel({ pageContent, onDistill, onRefresh }: DistillPanelProps) {
  const currentMode = pageContent.source;

  return (
    <div className="distill-panel">
      <div className="mode-toggle">
        <button
          className={currentMode === "page" ? "active" : ""}
          onClick={() => onRefresh("page")}
        >
          整页内容
        </button>
        <button
          className={currentMode === "smart" ? "active" : ""}
          onClick={() => onRefresh("smart")}
        >
          智能识别
        </button>
      </div>

      <div className="page-preview">
        <div className="preview-title">{pageContent.title}</div>
        <div className="preview-meta">
          {pageContent.siteName && (
            <span className="meta-item">📍 {pageContent.siteName}</span>
          )}
          <span className="meta-item">📝 {pageContent.wordCount} 字</span>
          <span className="meta-item">⏱️ {pageContent.readingTime} 分钟</span>
          {pageContent.author && (
            <span className="meta-item">👤 {pageContent.author}</span>
          )}
        </div>
        <div className="preview-excerpt">
          {pageContent.content.slice(0, 200)}...
        </div>
        {(pageContent.images?.length || pageContent.videos?.length) && (
          <div className="preview-media">
            {pageContent.images && pageContent.images.length > 0 && (
              <span className="meta-item">🖼️ {pageContent.images.length} 张图片</span>
            )}
            {pageContent.videos && pageContent.videos.length > 0 && (
              <span className="meta-item">🎬 {pageContent.videos.length} 个视频</span>
            )}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-block" onClick={onDistill}>
        ⚡ 一键蒸馏
      </button>
    </div>
  );
}

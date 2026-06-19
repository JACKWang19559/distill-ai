/**
 * 蒸馏结果展示组件。
 *
 * 展示蒸馏结果（摘要、关键点、大纲、标签）。
 * 蒸馏完成时知识已自动入库，提供"在 Web 端查看"、"蒸馏下一篇"和"返回首页"入口。
 */

import type { DistillResult } from "@/types/messages.ts";

interface ResultViewProps {
  /** 蒸馏结果 */
  result: DistillResult;
  /** 继续蒸馏下一篇回调 */
  onContinue: () => void;
  /** 在 Web 端查看回调 */
  onViewInWeb: () => void;
  /** 返回首页回调 */
  onBack: () => void;
}

/**
 * 蒸馏结果展示。
 */
export function ResultView({ result, onContinue, onViewInWeb, onBack }: ResultViewProps) {
  const knowledge = result.knowledge;

  // 即使 knowledge 为 null，也显示成功提示（任务确实完成了）
  if (!knowledge) {
    return (
      <div className="result-view">
        <div className="success-banner">
          <div className="success-icon">🎉</div>
          <div className="success-text">
            <div className="success-title">蒸馏成功！</div>
            <div className="success-desc">已保存到知识库</div>
          </div>
        </div>
        <div className="result-actions">
          <button className="btn btn-primary btn-block" onClick={onViewInWeb}>
            🌐 在 Web 端查看
          </button>
          <div className="action-row">
            <button className="btn btn-ghost" onClick={onContinue}>
              📄 蒸馏下一篇
            </button>
            <button className="btn btn-ghost" onClick={onBack}>
              🏠 返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { summary, keyPoints, outline } = knowledge.distilledData;
  const tags = knowledge.tags ?? [];

  /**
   * 将 Markdown 大纲字符串解析为带层级的列表项。
   *
   * 支持格式：
   *   - 一级项目
   *     - 二级项目
   *       - 三级项目
   *
   * @param outlineText - Markdown 格式的大纲字符串
   * @returns 解析后的列表项数组
   */
  function parseOutline(outlineText: string): Array<{ title: string; level: number }> {
    const lines = outlineText.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // 计算缩进层级：每 2 个空格或 1 个 tab 为一级
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].replace(/\t/g, "  ").length : 0;
      const level = Math.floor(indent / 2) + 1;
      // 去除列表标记（-、*、+）和前导空格
      const title = line.replace(/^\s*[-*+]\s*/, "").trim();
      return { title, level };
    }).filter((item) => item.title);
  }

  const outlineItems = outline ? parseOutline(outline) : [];

  return (
    <div className="result-view">
      <div className="success-banner">
        <div className="success-icon">🎉</div>
        <div className="success-text">
          <div className="success-title">蒸馏成功！</div>
          <div className="success-desc">已保存到知识库</div>
        </div>
      </div>

      <div className="result-section">
        <h3>标题</h3>
        <div className="section-content">{knowledge.title}</div>
      </div>

      {summary && (
        <div className="result-section">
          <h3>摘要</h3>
          <div className="section-content">{summary}</div>
        </div>
      )}

      {keyPoints && keyPoints.length > 0 && (
        <div className="result-section">
          <h3>关键要点</h3>
          <div className="section-content">
            <ul>
              {keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {outlineItems.length > 0 && (
        <div className="result-section">
          <h3>大纲</h3>
          <div className="section-content">
            <ul>
              {outlineItems.map((item, i) => (
                <li
                  key={i}
                  style={{ paddingLeft: `${(item.level - 1) * 16 + 20}px` }}
                >
                  {item.title}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="result-section">
          <h3>标签</h3>
          <div className="tag-list">
            {tags.map((tag) => (
              <span key={tag.id} className="tag">
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="result-actions">
        <button className="btn btn-primary btn-block" onClick={onViewInWeb}>
          🌐 在 Web 端查看
        </button>
        <div className="action-row">
          <button className="btn btn-ghost" onClick={onContinue}>
            📄 蒸馏下一篇
          </button>
          <button className="btn btn-ghost" onClick={onBack}>
            🏠 返回首页
          </button>
        </div>
      </div>
    </div>
  );
}

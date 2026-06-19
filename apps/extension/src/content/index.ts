/**
 * Content Script 入口。
 *
 * 监听来自 background/side panel 的消息，提取当前页面内容。
 * 在 document_idle 时注入，避免影响页面加载。
 *
 * 使用 Mozilla Readability 提取正文，并提取元数据（标题、作者、发布时间）。
 * 支持整页提取和选区提取两种模式。
 * 选区提取支持图片识别，整页提取支持小红书等特殊站点。
 */

import { Readability } from "@mozilla/readability";

/** 页面内容提取结果（内联类型，避免跨文件导入） */
interface PageContent {
  title: string;
  content: string;
  html?: string;
  url: string;
  author?: string;
  publishedTime?: string;
  wordCount: number;
  readingTime: number;
  source: "page" | "selection" | "smart";
  siteName?: string;
  /** 提取的图片 URL 列表 */
  images?: string[];
  /** 提取的视频 URL 列表（用于小红书等视频站点） */
  videos?: string[];
}

/**
 * 从选区中提取所有图片 URL。
 *
 * 遍历 Selection 的所有 Range，收集范围内的 img 元素。
 *
 * @param selection - 浏览器选区
 * @returns 图片 URL 数组
 */
function extractImagesFromSelection(selection: Selection): string[] {
  const images: string[] = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const fragment = range.cloneContents();
    fragment.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-original");
      if (src && src.startsWith("http")) {
        images.push(src);
      }
    });
  }
  return images;
}

/**
 * 提取小红书页面的笔记图片。
 *
 * 小红书笔记图片通常在 .media-container、.swiper-slide 等容器中，
 * 与正文文字分离。此函数专门提取这些容器中的图片。
 *
 * @returns 图片 URL 数组
 */
function extractXiaohongshuImages(): string[] {
  const images: string[] = [];
  const selectors = [
    '.media-container img',
    '.swiper-slide img',
    '[class*="note-image"] img',
    'img[class*="note"]',
    '.note-slider img',
    '.image-container img',
  ];
  document.querySelectorAll(selectors.join(",")).forEach((el) => {
    const img = el as HTMLImageElement;
    const src =
      img.src ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-original") ||
      img.getAttribute("srcset")?.split(" ")[0];
    if (src && src.startsWith("http") && !images.includes(src)) {
      images.push(src);
    }
  });
  return images;
}

/**
 * 提取小红书页面的视频 URL。
 *
 * 小红书视频通常在 video 标签或通过 JSON 数据嵌入。
 *
 * @returns 视频 URL 数组
 */
function extractXiaohongshuVideos(): string[] {
  const videos: string[] = [];

  // 1. 查找 video 标签
  document.querySelectorAll("video").forEach((video) => {
    const videoEl = video as HTMLVideoElement;
    const sourceEl = videoEl.querySelector("source") as HTMLSourceElement | null;
    const src = videoEl.src || sourceEl?.src;
    if (src && src.startsWith("http")) {
      videos.push(src);
    }
  });

  // 2. 查找小红书视频容器中的视频 URL
  const videoContainer = document.querySelector(
    '.media-container video, .video-player video, [class*="video"] video'
  );
  if (videoContainer instanceof HTMLVideoElement && videoContainer.src) {
    if (!videos.includes(videoContainer.src)) {
      videos.push(videoContainer.src);
    }
  }

  return videos;
}

/**
 * 提取页面中的所有图片 URL。
 *
 * 优先提取正文区域的图片，过滤掉图标、头像等小图。
 *
 * @returns 图片 URL 数组
 */
function extractPageImages(): string[] {
  const images: string[] = [];
  document.querySelectorAll("img").forEach((img) => {
    const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-original");
    if (src && src.startsWith("http")) {
      // 过滤小图标（宽高小于 100px 的）
      const width = parseInt(img.getAttribute("width") || "0", 10);
      const height = parseInt(img.getAttribute("height") || "0", 10);
      if ((width === 0 || width >= 100) && (height === 0 || height >= 100)) {
        images.push(src);
      }
    }
  });
  return images;
}

/**
 * 判断是否为小红书页面。
 */
function isXiaohongshuPage(): boolean {
  return location.hostname.includes("xiaohongshu.com");
}

/**
 * 提取整页内容。
 *
 * 使用 Readability 解析正文，同时提取元数据。
 * 对于小红书等特殊站点，额外提取视频和图片信息。
 */
function extractPageContent(): PageContent | null {
  try {
    // 小红书特殊处理：Readability 可能无法提取正文，需要 fallback
    if (isXiaohongshuPage()) {
      return extractXiaohongshuContent();
    }

    const doc = document.cloneNode(true) as Document;
    const article = new Readability(doc, {
      charThreshold: 100,
      keepClasses: false,
    }).parse();

    if (!article || !article.textContent) {
      return null;
    }

    const content = article.textContent.trim();
    if (content.length < 50) {
      return null;
    }

    const title = article.title || document.title || "无标题";
    const wordCount = countWords(content);
    const readingTime = Math.max(1, Math.ceil(wordCount / 300));
    const images = extractPageImages();

    return {
      title,
      content,
      html: article.content ?? undefined,
      url: location.href,
      author: article.byline ?? extractAuthor() ?? undefined,
      publishedTime: extractPublishedTime() ?? undefined,
      wordCount,
      readingTime,
      source: "page",
      siteName: extractSiteName() ?? undefined,
      images: images.length > 0 ? images : undefined,
    };
  } catch (err) {
    console.error("[Distill] 页面内容提取失败:", err);
    return null;
  }
}

/**
 * 提取小红书页面内容。
 *
 * 小红书页面的正文在特定容器中，Readability 可能无法正确识别。
 * 此函数手动提取笔记内容、图片和视频。
 */
function extractXiaohongshuContent(): PageContent | null {
  try {
    // 提取标题
    const titleEl =
      document.querySelector("#detail-title") ||
      document.querySelector(".title") ||
      document.querySelector('[class*="note-content"] .title');
    const title = titleEl?.textContent?.trim() || document.title || "小红书笔记";

    // 提取正文内容
    const contentEl =
      document.querySelector("#detail-desc") ||
      document.querySelector(".note-text") ||
      document.querySelector('[class*="note-content"] .desc') ||
      document.querySelector(".content");
    const content = contentEl?.textContent?.trim() || "";

    // 提取作者
    const authorEl =
      document.querySelector(".author-wrapper .name") ||
      document.querySelector('[class*="author"] .name') ||
      document.querySelector(".username");
    const author = authorEl?.textContent?.trim() || extractAuthor() || undefined;

    // 提取图片
    const images = extractXiaohongshuImages();

    // 提取视频
    const videos = extractXiaohongshuVideos();

    // 组合内容（包含图片和视频链接）
    let fullContent = content;
    if (images.length > 0) {
      fullContent += "\n\n图片：\n" + images.map((url) => `![图片](${url})`).join("\n");
    }
    if (videos.length > 0) {
      fullContent += "\n\n视频：\n" + videos.map((url) => `[视频](${url})`).join("\n");
    }

    if (fullContent.length < 20 && images.length === 0 && videos.length === 0) {
      // fallback 到 Readability
      const doc = document.cloneNode(true) as Document;
      const article = new Readability(doc, { charThreshold: 50 }).parse();
      if (article?.textContent) {
        fullContent = article.textContent.trim();
      }
    }

    const wordCount = countWords(fullContent);
    const readingTime = Math.max(1, Math.ceil(wordCount / 300));

    return {
      title,
      content: fullContent,
      url: location.href,
      author,
      publishedTime: extractPublishedTime() ?? undefined,
      wordCount,
      readingTime,
      source: "page",
      siteName: "小红书",
      images: images.length > 0 ? images : undefined,
      videos: videos.length > 0 ? videos : undefined,
    };
  } catch (err) {
    console.error("[Distill] 小红书内容提取失败:", err);
    // fallback 到通用提取
    const doc = document.cloneNode(true) as Document;
    const article = new Readability(doc, { charThreshold: 50 }).parse();
    if (article?.textContent) {
      const content = article.textContent.trim();
      return {
        title: article.title || document.title || "小红书笔记",
        content,
        url: location.href,
        wordCount: countWords(content),
        readingTime: Math.max(1, Math.ceil(countWords(content) / 300)),
        source: "page" as const,
        siteName: "小红书",
        images: extractPageImages().length > 0 ? extractPageImages() : undefined,
        videos: extractXiaohongshuVideos().length > 0 ? extractXiaohongshuVideos() : undefined,
      };
    }
    return null;
  }
}

/**
 * 提取页面中的所有视频 URL。
 *
 * 通用视频提取，查找 video 标签和 source 标签。
 *
 * @returns 视频 URL 数组
 */
function extractPageVideos(): string[] {
  const videos: string[] = [];
  document.querySelectorAll("video").forEach((video) => {
    const videoEl = video as HTMLVideoElement;
    const sourceEl = videoEl.querySelector("source") as HTMLSourceElement | null;
    const src = videoEl.src || sourceEl?.src;
    if (src && src.startsWith("http") && !videos.includes(src)) {
      videos.push(src);
    }
  });
  return videos;
}

/**
 * 智能识别主内容。
 *
 * 自动识别页面的主要内容区域，提取文字、图片和视频。
 * 无需用户手动选中，适用于小红书、微信公众号、知乎等特殊站点。
 *
 * 策略：
 * 1. 小红书：使用专门的提取逻辑
 * 2. 其他站点：Readability 提取正文 + 图片 + 视频
 */
function extractSmartContent(): PageContent | null {
  try {
    // 小红书特殊处理
    if (isXiaohongshuPage()) {
      return extractXiaohongshuContent();
    }

    // 通用智能识别：Readability + 图片 + 视频
    const doc = document.cloneNode(true) as Document;
    const article = new Readability(doc, {
      charThreshold: 50,
      keepClasses: false,
    }).parse();

    const images = extractPageImages();
    const videos = extractPageVideos();

    // 如果 Readability 提取到正文，使用它
    if (article?.textContent && article.textContent.trim().length >= 20) {
      const content = article.textContent.trim();
      const title = article.title || document.title || "无标题";
      const wordCount = countWords(content);
      const readingTime = Math.max(1, Math.ceil(wordCount / 300));

      let fullContent = content;
      if (images.length > 0) {
        fullContent += "\n\n图片：\n" + images.map((url) => `![图片](${url})`).join("\n");
      }
      if (videos.length > 0) {
        fullContent += "\n\n视频：\n" + videos.map((url) => `[视频](${url})`).join("\n");
      }

      return {
        title,
        content: fullContent,
        html: article.content ?? undefined,
        url: location.href,
        author: article.byline ?? extractAuthor() ?? undefined,
        publishedTime: extractPublishedTime() ?? undefined,
        wordCount,
        readingTime,
        source: "smart",
        siteName: extractSiteName() ?? undefined,
        images: images.length > 0 ? images : undefined,
        videos: videos.length > 0 ? videos : undefined,
      };
    }

    // Readability 失败时，尝试从主内容区域提取
    const mainContent =
      document.querySelector("article") ||
      document.querySelector("main") ||
      document.querySelector('[role="main"]') ||
      document.querySelector(".post-content, .article-content, .entry-content, .content");

    if (mainContent) {
      const content = mainContent.textContent?.trim() || "";
      if (content.length >= 20) {
        const title = document.title || "无标题";
        const wordCount = countWords(content);
        const readingTime = Math.max(1, Math.ceil(wordCount / 300));

        let fullContent = content;
        if (images.length > 0) {
          fullContent += "\n\n图片：\n" + images.map((url) => `![图片](${url})`).join("\n");
        }
        if (videos.length > 0) {
          fullContent += "\n\n视频：\n" + videos.map((url) => `[视频](${url})`).join("\n");
        }

        return {
          title,
          content: fullContent,
          url: location.href,
          author: extractAuthor() ?? undefined,
          publishedTime: extractPublishedTime() ?? undefined,
          wordCount,
          readingTime,
          source: "smart",
          siteName: extractSiteName() ?? undefined,
          images: images.length > 0 ? images : undefined,
          videos: videos.length > 0 ? videos : undefined,
        };
      }
    }

    return null;
  } catch (err) {
    console.error("[Distill] 智能识别失败:", err);
    return null;
  }
}

/**
 * 提取选区内容。
 *
 * 除了选中的文本，还会提取选区范围内的图片。
 */
function extractSelectionContent(): PageContent | null {
  try {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }

    const text = selection.toString().trim();
    let images = extractImagesFromSelection(selection);

    // 小红书特殊处理：笔记图片与文字分离，选区可能只包含文字。
    // 当选区内无图片时，回退提取页面上的笔记图片。
    if (images.length === 0 && isXiaohongshuPage()) {
      images = extractXiaohongshuImages();
    }

    // 文本和图片都为空时返回 null
    if (text.length < 20 && images.length === 0) {
      return null;
    }

    const title = document.title || "选区内容";
    const wordCount = countWords(text);
    const readingTime = Math.max(1, Math.ceil(wordCount / 300));

    // 组合内容（包含图片链接）
    let fullContent = text;
    if (images.length > 0) {
      fullContent += "\n\n图片：\n" + images.map((url) => `![图片](${url})`).join("\n");
    }

    // 小红书选区也尝试提取视频
    let videos: string[] | undefined;
    if (isXiaohongshuPage()) {
      const vids = extractXiaohongshuVideos();
      if (vids.length > 0) {
        videos = vids;
        fullContent += "\n\n视频：\n" + vids.map((url) => `[视频](${url})`).join("\n");
      }
    }

    return {
      title,
      content: fullContent,
      url: location.href,
      author: extractAuthor() ?? undefined,
      publishedTime: extractPublishedTime() ?? undefined,
      wordCount,
      readingTime,
      source: "selection",
      siteName: extractSiteName() ?? undefined,
      images: images.length > 0 ? images : undefined,
      videos,
    };
  } catch (err) {
    console.error("[Distill] 选区内容提取失败:", err);
    return null;
  }
}

/** 统计字数（中文按字符计，英文按单词计） */
function countWords(text: string): number {
  const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCount = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseCount + englishCount;
}

/** 提取作者信息 */
function extractAuthor(): string | null {
  const metaAuthor =
    document.querySelector('meta[name="author"]')?.getAttribute("content") ||
    document
      .querySelector('meta[property="article:author"]')
      ?.getAttribute("content");
  if (metaAuthor) return metaAuthor.trim();

  const authorEl = document.querySelector(".author, .post-author, [rel=author]");
  if (authorEl) return authorEl.textContent?.trim() ?? null;

  return null;
}

/** 提取发布时间 */
function extractPublishedTime(): string | null {
  const metaTime =
    document
      .querySelector('meta[property="article:published_time"]')
      ?.getAttribute("content") ||
    document.querySelector('meta[name="date"]')?.getAttribute("content");
  if (metaTime) return metaTime;

  const timeEl = document.querySelector("time[datetime]");
  if (timeEl) return timeEl.getAttribute("datetime");

  return null;
}

/** 提取站点名称 */
function extractSiteName(): string | null {
  const metaSite = document
    .querySelector('meta[property="og:site_name"]')
    ?.getAttribute("content");
  if (metaSite) return metaSite;

  return location.hostname;
}

/**
 * 消息监听器。
 *
 * 处理 EXTRACT_PAGE 消息，返回提取的页面内容。
 */
chrome.runtime.onMessage.addListener(
  (
    message: { type: string; source?: "page" | "selection" | "smart" },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { data: PageContent | null; error?: string }) => void
  ) => {
    if (message.type === "EXTRACT_PAGE") {
      try {
        let content: PageContent | null = null;

        if (message.source === "selection") {
          content = extractSelectionContent();
        } else if (message.source === "smart") {
          content = extractSmartContent();
        } else {
          content = extractPageContent();
        }

        if (!content) {
          sendResponse({
            data: null,
            error:
              message.source === "selection"
                ? "未选中有效内容，请选中一段文字后重试"
                : message.source === "smart"
                ? "无法识别页面主内容，请尝试使用整页模式"
                : "无法提取当前页面内容，请尝试手动复制内容",
          });
        } else {
          sendResponse({ data: content });
        }
      } catch (err) {
        sendResponse({
          data: null,
          error: err instanceof Error ? err.message : "提取失败",
        });
      }
    }

    return true;
  }
);

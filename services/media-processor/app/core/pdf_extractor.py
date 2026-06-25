"""PDF 解析模块。

使用 opendataloader-pdf 引擎解析 PDF，输出 Markdown 文本。

opendataloader-pdf 特性：
- 本地确定性模式：快速解析标准数字 PDF（0.02s/页）
- Hybrid 模式：AI 辅助解析复杂表格、扫描件 OCR、数学公式
- Apache 2.0 开源协议
- Benchmark #1：0.907 总体准确率

依赖：
- Python 3.10+
- Java 11+（opendataloader-pdf 内部依赖 JVM）
- pip install opendataloader-pdf（基础模式）
- pip install "opendataloader-pdf[hybrid]"（Hybrid 模式）
"""

import logging
from pathlib import Path
from typing import Any

from ..config import settings

logger = logging.getLogger(__name__)


def extract_pdf_text(
    pdf_path: Path,
    output_dir: Path,
    use_hybrid: bool | None = None,
    hybrid_backend: str | None = None,
) -> dict[str, Any]:
    """使用 opendataloader-pdf 提取 PDF 文本。

    Args:
        pdf_path: PDF 文件路径
        output_dir: 输出目录（Markdown 文件将生成在此目录）
        use_hybrid: 是否启用 Hybrid 模式。
                    None 表示使用配置默认值。
        hybrid_backend: Hybrid 后端引擎（如 docling-fast）。
                        None 表示使用配置默认值。

    Returns:
        包含以下字段的字典：
        - markdown: 提取的 Markdown 文本
        - page_count: 页数
        - format: 输出格式
        - used_hybrid: 是否使用了 Hybrid 模式
        - output_path: Markdown 文件路径

    Raises:
        FileNotFoundError: PDF 文件不存在
        ImportError: opendataloader-pdf 未安装
        Exception: PDF 解析失败
    """
    pdf_path = Path(pdf_path)
    output_dir = Path(output_dir)

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF 文件不存在: {pdf_path}")

    # 确定是否使用 Hybrid 模式
    if use_hybrid is None:
        use_hybrid = settings.PDF_HYBRID_MODE
    if hybrid_backend is None:
        hybrid_backend = settings.PDF_HYBRID_BACKEND

    logger.info(
        "开始解析 PDF: %s (Hybrid: %s, Backend: %s)",
        pdf_path.name,
        use_hybrid,
        hybrid_backend if use_hybrid else "N/A",
    )

    try:
        import opendataloader_pdf
    except ImportError as e:
        raise ImportError(
            "opendataloader-pdf 未安装，请运行: pip install opendataloader-pdf"
        ) from e

    # 确保输出目录存在
    output_dir.mkdir(parents=True, exist_ok=True)

    # 文件大小检查：大文件直接使用 PyMuPDF，避免 Java OOM
    # Render 免费计划 512MB RAM，Java JVM + 大 PDF 容易导致 OOM 杀死整个进程
    file_size = pdf_path.stat().st_size
    # 5MB 以上文件使用轻量级解析器
    LARGE_FILE_THRESHOLD = 5 * 1024 * 1024

    if file_size > LARGE_FILE_THRESHOLD:
        logger.info(
            "文件较大 (%d KB > %d KB)，直接使用 PyMuPDF 轻量级解析（避免 Java OOM）",
            file_size // 1024,
            LARGE_FILE_THRESHOLD // 1024,
        )
        markdown_content = _extract_with_pymupdf(pdf_path)
        page_count = _get_page_count_from_pdf(pdf_path)
        return {
            "markdown": markdown_content,
            "page_count": page_count,
            "format": "markdown",
            "used_hybrid": False,
            "output_path": str(pdf_path),
        }

    # 构建 opendataloader-pdf 调用参数
    convert_kwargs: dict[str, Any] = {
        "input_path": [str(pdf_path)],
        "output_dir": str(output_dir),
        "format": "markdown",
    }

    # Hybrid 模式参数
    # 参考: https://github.com/opendataloader-project/opendataloader-pdf
    # 必须显式传入 hybrid 参数，否则 opendataloader-pdf 可能默认使用 Hybrid 模式
    if use_hybrid:
        convert_kwargs["hybrid"] = hybrid_backend
    else:
        # 显式禁用 Hybrid 模式
        convert_kwargs["hybrid"] = None

    # 调用 opendataloader-pdf 进行转换
    # 注意：每次 convert() 调用会启动一个 JVM 进程，
    # 批量处理时应一次性传入所有文件以提高效率
    #
    # Render 免费计划只有 512MB RAM，Java JVM 解析大 PDF 可能导致 OOM
    # 设置 Java 堆内存上限为 256MB，避免 OOM 杀死整个服务进程
    import os

    # 限制 Java 堆内存，防止 OOM（通过 _JAVA_OPTIONS 环境变量）
    # _JAVA_OPTIONS 会被所有 Java 进程继承
    existing_java_opts = os.environ.get("_JAVA_OPTIONS", "")
    if "-Xmx" not in existing_java_opts:
        os.environ["_JAVA_OPTIONS"] = f"{existing_java_opts} -Xmx256m".strip()

    try:
        opendataloader_pdf.convert(**convert_kwargs)
    except Exception as opendataloader_err:
        # opendataloader-pdf 失败（OOM、超时、Java 崩溃等）
        # 降级到 PyMuPDF 轻量级解析
        logger.warning(
            "opendataloader-pdf 解析失败: %s，降级到 PyMuPDF 轻量级解析",
            opendataloader_err,
        )
        markdown_content = _extract_with_pymupdf(pdf_path)
        page_count = _get_page_count_from_pdf(pdf_path)
        return {
            "markdown": markdown_content,
            "page_count": page_count,
            "format": "markdown",
            "used_hybrid": False,
            "output_path": str(pdf_path),
        }

    # 查找生成的 Markdown 文件
    # opendataloader-pdf 输出文件名通常为 {原文件名}.md
    md_file = output_dir / f"{pdf_path.stem}.md"

    # 如果按 stem 找不到，尝试查找目录下唯一的 .md 文件
    if not md_file.exists():
        md_files = list(output_dir.glob("*.md"))
        if not md_files:
            raise FileNotFoundError(
                f"PDF 解析完成但未找到 Markdown 输出文件，输出目录: {output_dir}"
            )
        md_file = md_files[0]

    # 读取 Markdown 内容
    markdown_content = md_file.read_text(encoding="utf-8")

    # 使用 pypdf 直接从 PDF 文件获取页数（可靠方式）
    page_count = _get_page_count_from_pdf(pdf_path)

    result = {
        "markdown": markdown_content,
        "page_count": page_count,
        "format": "markdown",
        "used_hybrid": use_hybrid,
        "output_path": str(md_file),
    }

    logger.info(
        "PDF 解析完成: %s (页数: %d, 文本长度: %d, Hybrid: %s)",
        pdf_path.name,
        page_count,
        len(markdown_content),
        use_hybrid,
    )

    return result


def _get_page_count_from_pdf(pdf_path: Path) -> int:
    """使用 pypdf 直接从 PDF 文件获取页数。

    相比从 opendataloader-pdf 的 JSON 输出中解析页数，
    直接读取 PDF 文件元数据更可靠（不依赖输出格式配置）。

    Args:
        pdf_path: PDF 文件路径

    Returns:
        页数，读取失败时返回 0
    """
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        page_count = len(reader.pages)
        logger.debug("pypdf 读取页数成功: %s (%d 页)", pdf_path.name, page_count)
        return page_count
    except Exception as e:
        logger.warning("pypdf 读取页数失败: %s，将返回 0", e)
        return 0


def _extract_with_pymupdf(pdf_path: Path) -> str:
    """使用 PyMuPDF (fitz) 提取 PDF 文本作为 fallback。

    PyMuPDF 是轻量级纯 C 语言实现的 PDF 解析库，
    不依赖 Java，内存占用低（~50MB vs Java 的 ~300MB+），
    适合在内存受限的环境（如 Render 免费计划 512MB）中使用。

    Args:
        pdf_path: PDF 文件路径

    Returns:
        提取的 Markdown 格式文本

    Raises:
        ImportError: PyMuPDF 未安装
        Exception: PDF 解析失败
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise ImportError(
            "PyMuPDF 未安装，请运行: pip install PyMuPDF"
        ) from e

    pdf_path = Path(pdf_path)
    logger.info("使用 PyMuPDF 解析 PDF: %s", pdf_path.name)

    doc = fitz.open(str(pdf_path))
    try:
        parts = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text")

            # 转换为简单的 Markdown 格式
            if text.strip():
                # 添加页码标记
                parts.append(f"\n\n--- 第 {page_num + 1} 页 ---\n\n")
                parts.append(text.strip())
                parts.append("\n")

        markdown = "".join(parts).strip()
        logger.info(
            "PyMuPDF 解析完成: %s (%d 页, %d 字符)",
            pdf_path.name,
            len(doc),
            len(markdown),
        )
        return markdown
    finally:
        doc.close()


def _get_page_count(output_dir: Path, stem: str) -> int:
    """从 opendataloader-pdf 的 JSON 输出中提取页数（已弃用，保留向后兼容）。

    .. deprecated::
        改用 :func:`_get_page_count_from_pdf` 直接从 PDF 文件读取页数。

    Args:
        output_dir: 输出目录
        stem: PDF 文件名（不含扩展名）

    Returns:
        页数，读取失败时返回 0
    """
    import json

    json_file = output_dir / f"{stem}.json"
    if not json_file.exists():
        # 尝试查找目录下唯一的 .json 文件
        json_files = list(output_dir.glob("*.json"))
        if not json_files:
            return 0
        json_file = json_files[0]

    try:
        data = json.loads(json_file.read_text(encoding="utf-8"))
        # opendataloader-pdf JSON 结构：元素列表，每个元素有 "page number" 字段
        if isinstance(data, list):
            pages = {item.get("page number", 0) for item in data if isinstance(item, dict)}
            return len(pages) if pages else 0
        elif isinstance(data, dict):
            # 某些版本可能返回 {"pages": [...]} 结构
            pages = data.get("pages", [])
            return len(pages) if isinstance(pages, list) else 0
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning("读取 PDF 页数失败: %s", e)

    return 0


def extract_pdf_text_simple(pdf_path: Path) -> str:
    """简化的 PDF 文本提取接口。

    仅返回 Markdown 文本，不包含元数据。
    使用默认配置（非 Hybrid 模式）。

    Args:
        pdf_path: PDF 文件路径

    Returns:
        提取的 Markdown 文本

    Raises:
        Exception: PDF 解析失败
    """
    output_dir = pdf_path.parent / f"{pdf_path.stem}_output"
    result = extract_pdf_text(pdf_path, output_dir, use_hybrid=False)
    return result["markdown"]

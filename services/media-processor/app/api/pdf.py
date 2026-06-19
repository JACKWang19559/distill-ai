"""PDF 解析 API 路由。

使用 opendataloader-pdf 引擎解析 PDF，输出 Markdown 文本。
支持标准数字 PDF 和扫描件（Hybrid 模式）。
"""

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..config import settings
from ..core.pdf_extractor import extract_pdf_text
from ..schemas.media import PDFExtractResponse
from ..utils.cleanup import cleanup_temp_files, get_task_temp_dir

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pdf", tags=["PDF 解析"])

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {".pdf"}

# 最大文件大小（50MB）
MAX_FILE_SIZE = 50 * 1024 * 1024


@router.post("/extract", response_model=PDFExtractResponse)
async def extract_pdf(
    file: UploadFile = File(..., description="PDF 文件"),
    use_hybrid: bool = Form(False, description="是否启用 Hybrid 模式（扫描件/复杂表格）"),
) -> PDFExtractResponse:
    """解析 PDF 文件并提取 Markdown 文本。

    使用 opendataloader-pdf 引擎：
    - 标准模式：快速解析数字 PDF（0.02s/页）
    - Hybrid 模式：AI 辅助解析复杂表格、扫描件 OCR、公式

    Args:
        file: 上传的 PDF 文件
        use_hybrid: 是否启用 Hybrid 模式

    Returns:
        PDFExtractResponse: 包含 Markdown 文本和元数据的响应

    Raises:
        HTTPException 400: 文件格式不支持或文件过大
        HTTPException 500: PDF 解析失败
    """
    # 校验文件扩展名
    filename = file.filename or "unknown.pdf"
    file_ext = Path(filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {file_ext}，仅支持 PDF",
        )

    # 生成任务 ID 和临时目录
    task_id = f"pdf_{uuid.uuid4().hex[:8]}"
    task_dir = get_task_temp_dir(task_id, prefix="pdf")

    try:
        # 保存上传的文件
        pdf_path = task_dir / filename
        logger.info("[%s] 保存上传文件: %s", task_id, filename)

        with pdf_path.open("wb") as f:
            # 流式写入，避免大文件占用内存
            total_size = 0
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                total_size += len(chunk)
                if total_size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail=f"文件大小超过限制 {MAX_FILE_SIZE // 1024 // 1024}MB",
                    )
                f.write(chunk)

        logger.info("[%s] 文件保存完成, 大小: %d KB", task_id, total_size // 1024)

        # 调用 opendataloader-pdf 解析
        output_dir = task_dir / "output"
        result = extract_pdf_text(
            pdf_path=pdf_path,
            output_dir=output_dir,
            use_hybrid=use_hybrid,
        )

        logger.info("[%s] PDF 解析完成", task_id)

        return PDFExtractResponse(
            markdown=result["markdown"],
            page_count=result["page_count"],
            format=result["format"],
            used_hybrid=result["used_hybrid"],
        )

    except HTTPException:
        raise
    except ImportError as e:
        logger.error("opendataloader-pdf 未安装: %s", e)
        raise HTTPException(
            status_code=500,
            detail="PDF 解析服务未正确配置，请联系管理员安装 opendataloader-pdf",
        )
    except FileNotFoundError as e:
        logger.error("文件未找到: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.exception("[%s] PDF 解析失败", task_id)
        raise HTTPException(status_code=500, detail=f"PDF 解析失败: {e}")
    finally:
        # 清理临时文件
        cleanup_temp_files(task_dir)


@router.post("/extract-from-path", response_model=PDFExtractResponse)
async def extract_pdf_from_path(
    file_path: str = Form(..., description="服务端 PDF 文件路径"),
    use_hybrid: bool = Form(False, description="是否启用 Hybrid 模式"),
) -> PDFExtractResponse:
    """从服务端文件路径解析 PDF。

    适用于文件已存在于服务端的场景（如通过其他方式上传）。

    Args:
        file_path: PDF 文件的服务端绝对路径
        use_hybrid: 是否启用 Hybrid 模式

    Returns:
        PDFExtractResponse: 包含 Markdown 文本和元数据的响应

    Raises:
        HTTPException 400: 路径为空
        HTTPException 404: 文件不存在
        HTTPException 500: 解析失败
    """
    if not file_path or not file_path.strip():
        raise HTTPException(status_code=400, detail="文件路径不能为空")

    pdf_path = Path(file_path)
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"PDF 文件不存在: {pdf_path}")

    if pdf_path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")

    task_id = f"pdf_path_{uuid.uuid4().hex[:8]}"
    task_dir = get_task_temp_dir(task_id, prefix="pdf")

    try:
        output_dir = task_dir / "output"
        result = extract_pdf_text(
            pdf_path=pdf_path,
            output_dir=output_dir,
            use_hybrid=use_hybrid,
        )

        return PDFExtractResponse(
            markdown=result["markdown"],
            page_count=result["page_count"],
            format=result["format"],
            used_hybrid=result["used_hybrid"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("PDF 解析失败: %s", file_path)
        raise HTTPException(status_code=500, detail=f"PDF 解析失败: {e}")
    finally:
        cleanup_temp_files(task_dir)

"""临时文件清理工具模块。

负责清理下载的视频、分离的音频、PDF 中间产物等临时文件，
避免磁盘空间泄漏。
"""

import logging
import shutil
import time
from pathlib import Path

from ..config import settings

logger = logging.getLogger(__name__)


def cleanup_temp_files(path: Path) -> None:
    """清理指定路径的临时文件或目录。

    安全删除：如果路径不存在则跳过，删除失败仅记录日志不抛异常。

    Args:
        path: 待清理的文件或目录路径
    """
    if not path.exists():
        logger.debug("路径不存在，跳过清理: %s", path)
        return

    try:
        if path.is_file():
            path.unlink()
            logger.info("已删除临时文件: %s", path)
        elif path.is_dir():
            shutil.rmtree(path)
            logger.info("已删除临时目录: %s", path)
    except OSError as e:
        # 清理失败不影响主流程，仅记录警告
        logger.warning("清理临时文件失败 %s: %s", path, e)


def cleanup_expired_files() -> int:
    """清理过期的临时文件。

    扫描临时目录，删除修改时间超过 TEMP_FILE_TTL 的文件。

    Returns:
        清理的文件数量
    """
    temp_dir = Path(settings.TEMP_DIR)
    if not temp_dir.exists():
        return 0

    now = time.time()
    ttl = settings.TEMP_FILE_TTL
    cleaned = 0

    for item in temp_dir.iterdir():
        try:
            mtime = item.stat().st_mtime
            if now - mtime > ttl:
                cleanup_temp_files(item)
                cleaned += 1
        except OSError as e:
            logger.warning("检查文件过期失败 %s: %s", item, e)

    if cleaned > 0:
        logger.info("已清理 %d 个过期临时文件", cleaned)

    return cleaned


def get_task_temp_dir(task_id: str, prefix: str = "") -> Path:
    """获取任务专属的临时目录。

    为每个任务创建独立的子目录，避免文件冲突。

    Args:
        task_id: 任务 ID
        prefix: 目录前缀（如 douyin/xiaohongshu/pdf）

    Returns:
        任务临时目录路径
    """
    dir_name = f"{prefix}_{task_id}" if prefix else task_id
    task_dir = Path(settings.TEMP_DIR) / dir_name
    task_dir.mkdir(parents=True, exist_ok=True)
    return task_dir

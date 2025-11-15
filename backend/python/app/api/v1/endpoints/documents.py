"""
文档管理端点 - 简化版
"""
import os
import uuid
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.document import Document
from app.services.file_processor import FileProcessor
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
file_processor = FileProcessor(upload_dir=settings.UPLOAD_DIR)


async def process_document_content(document_id: int, file_path: str, db: AsyncSession):
    """后台处理文档内容"""
    try:
        # 更新状态为处理中
        await db.execute(
            update(Document).where(Document.id == document_id).values(status="processing")
        )
        await db.commit()

        # 解析文档内容
        result = file_processor.process_file(file_path)

        # 更新文档信息
        title = ""
        if result.get('metadata'):
            try:
                metadata = json.loads(result['metadata']) if isinstance(result['metadata'], str) else result['metadata']
                title = metadata.get('title', Path(file_path).stem)
            except:
                title = os.path.splitext(os.path.basename(file_path))[0]

        content = result.get('content', '')
        if len(content) > 50000:  # 限制内容长度
            content = content[:50000]

        await db.execute(
            update(Document).where(Document.id == document_id).values(
                status="completed",
                title=title,
                content=content,
                doc_metadata=result.get('metadata', '{}')
            )
        )
        await db.commit()

        logger.info(f"文档处理完成: {document_id}")

    except Exception as e:
        logger.error(f"文档处理失败 {document_id}: {str(e)}", exc_info=True)
        # 更新状态为失败
        await db.execute(
            update(Document).where(Document.id == document_id).values(
                status="failed",
                error_message=str(e)
            )
        )
        await db.commit()


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    workspace_id: int = 1,
    db: AsyncSession = Depends(get_db)
):
    """上传文档"""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件名不能为空"
        )

    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件类型: {file_ext}"
        )

    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="文件大小超过限制"
        )

    # 保存文件
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(content)

    # 保存到数据库
    document = Document(
        filename=filename,
        original_filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        file_type=file_ext[1:],
        workspace_id=workspace_id,
        status="uploaded"
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    # 启动后台处理
    background_tasks.add_task(process_document_content, document.id, file_path, db)

    return {
        "id": document.id,
        "filename": document.filename,
        "original_filename": document.original_filename,
        "file_size": document.file_size,
        "status": document.status,
        "message": "文件上传成功，正在后台处理内容..."
    }


@router.get("/")
async def get_documents(
    workspace_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """获取文档列表"""
    query = select(Document).offset(skip).limit(limit)

    if workspace_id:
        query = query.where(Document.workspace_id == workspace_id)

    result = await db.execute(query)
    documents = result.scalars().all()

    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "original_filename": doc.original_filename,
            "file_size": doc.file_size,
            "file_type": doc.file_type,
            "status": doc.status,
            "title": doc.title,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        }
        for doc in documents
    ]


@router.get("/{document_id}")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取文档详情"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    return {
        "id": document.id,
        "filename": document.filename,
        "original_filename": document.original_filename,
        "file_size": document.file_size,
        "file_type": document.file_type,
        "status": document.status,
        "title": document.title,
        "content": document.content,
        "metadata": json.loads(document.doc_metadata) if document.doc_metadata else {},
        "created_at": document.created_at.isoformat() if document.created_at else None,
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除文档"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="文档不存在"
        )

    # 删除文件
    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except Exception as e:
            logger.warning(f"删除文件失败: {e}")

    # 删除数据库记录
    await db.execute(delete(Document).where(Document.id == document_id))
    await db.commit()

    return {"message": "文档已删除"}


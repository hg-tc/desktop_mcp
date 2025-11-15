"""
工作区管理端点
"""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.workspace import Workspace

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_workspaces(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    """获取工作区列表"""
    result = await db.execute(
        select(Workspace).where(Workspace.is_active == True).offset(skip).limit(limit)
    )
    workspaces = result.scalars().all()

    return [
        {
            "id": ws.id,
            "name": ws.name,
            "description": ws.description,
            "is_active": ws.is_active,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
        }
        for ws in workspaces
    ]


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取工作区详情"""
    result = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    workspace = result.scalar_one_or_none()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="工作区不存在"
        )

    return {
        "id": workspace.id,
        "name": workspace.name,
        "description": workspace.description,
        "is_active": workspace.is_active,
        "settings": workspace.settings,
        "created_at": workspace.created_at.isoformat() if workspace.created_at else None,
    }


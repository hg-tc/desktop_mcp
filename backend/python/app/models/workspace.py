"""
工作区模型
"""
from sqlalchemy import Column, String, Text, Integer, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base, BaseModel


class Workspace(BaseModel):
    """工作区表"""
    __tablename__ = "workspaces"

    name = Column(String, nullable=False, default="Default Workspace")
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    settings = Column(Text)  # JSON格式的工作区设置

    # 关系
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Workspace(id={self.id}, name={self.name})>"


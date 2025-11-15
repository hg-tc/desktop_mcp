"""
对话模型
"""
from sqlalchemy import Column, String, Text, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base, BaseModel


class Conversation(BaseModel):
    """对话表"""
    __tablename__ = "conversations"

    title = Column(String)
    messages = Column(Text)  # JSON格式的消息列表
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, default=1)

    # 关系
    workspace = relationship("Workspace", back_populates="conversations")

    def __repr__(self):
        return f"<Conversation(id={self.id}, title={self.title}, workspace_id={self.workspace_id})>"


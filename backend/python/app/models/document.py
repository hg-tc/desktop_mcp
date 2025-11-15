"""
文档模型
"""
from sqlalchemy import Column, String, Text, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base, BaseModel


class Document(BaseModel):
    """文档表"""
    __tablename__ = "documents"

    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf, docx, xlsx, pptx等

    # 文档内容
    title = Column(String)
    content = Column(Text)  # 提取的文本内容
    doc_metadata = Column(Text)  # JSON格式的元数据

    # 处理状态
    status = Column(String, default="uploaded")  # uploaded, processing, completed, failed
    error_message = Column(Text)

    # 向量化状态（可选）
    is_vectorized = Column(Boolean, default=False)
    vector_count = Column(Integer, default=0)

    # 所属工作区
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=False, default=1)

    # 关系
    workspace = relationship("Workspace", back_populates="documents")

    def __repr__(self):
        return f"<Document(id={self.id}, filename={self.filename}, workspace_id={self.workspace_id})>"


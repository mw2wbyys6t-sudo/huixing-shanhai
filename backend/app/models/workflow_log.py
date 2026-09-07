"""
工作流日志模型
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class WorkflowLog(Base):
    """工作流执行日志表"""
    __tablename__ = "workflow_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True, nullable=False)
    user_input = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    intent_confidence = Column(Float, nullable=True)
    extracted_entities = Column(JSON, nullable=True)
    agent_results = Column(JSON, nullable=True)  # 各Agent执行结果
    final_output = Column(Text, nullable=True)
    quality_score = Column(Float, nullable=True)
    feedback_rounds = Column(Integer, default=0)
    total_time = Column(Float, nullable=True)  # 总执行时间（秒）
    status = Column(String(20), default="completed")  # completed/failed
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "user_input": self.user_input,
            "intent": self.intent,
            "intent_confidence": self.intent_confidence,
            "extracted_entities": self.extracted_entities,
            "agent_results": self.agent_results,
            "final_output": self.final_output,
            "quality_score": self.quality_score,
            "feedback_rounds": self.feedback_rounds,
            "total_time": self.total_time,
            "status": self.status,
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

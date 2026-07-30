"""Pydantic contracts shared by the parser-service HTTP adapters and use cases."""

from pydantic import BaseModel, Field, field_validator

from .settings import validate_course_id


class UploadResponse(BaseModel):
    status: str
    source_id: str
    filename: str
    chunks_stored: int


class ChatRequest(BaseModel):
    course_id: str
    source_ids: list[str] = Field(max_length=500)
    query: str = Field(max_length=2000)

    @field_validator("course_id")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return validate_course_id(value)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str]


class QuizRequest(BaseModel):
    course_id: str
    source_ids: list[str] = Field(max_length=500)
    weak_topics: list[str] = Field(min_length=1)

    @field_validator("course_id")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return validate_course_id(value)


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer_index: int = Field(ge=0, le=3)


class QuizResponse(BaseModel):
    questions: list[QuizQuestion] = Field(min_length=5, max_length=5)


class DeleteDocumentRequest(BaseModel):
    course_id: str
    source_id: str = Field(min_length=1, max_length=100)

    @field_validator("course_id")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return validate_course_id(value)


class QuizQuestionPayload(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer_index: int = Field(ge=0, le=3)


class QuizPayload(BaseModel):
    questions: list[QuizQuestionPayload] = Field(min_length=5, max_length=5)

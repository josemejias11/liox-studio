"""Pydantic contracts shared by the parser-service HTTP adapters and use cases."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .settings import validate_course_id


class UploadResponse(BaseModel):
    status: str
    source_id: str
    filename: str
    chunks_stored: int


class AssistantCitation(BaseModel):
    source_id: str = Field(alias="sourceId", min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=255)
    excerpt: str = Field(min_length=1, max_length=1000)


class AssistantQaDraft(BaseModel):
    question_variants: list[str] = Field(alias="questionVariants", min_length=1, max_length=12)
    matching_keywords: list[str] = Field(alias="matchingKeywords", max_length=30)
    approved_answer: str = Field(alias="approvedAnswer", min_length=1, max_length=4000)
    citations: list[AssistantCitation] = Field(min_length=1, max_length=12)


class AssistantQaRequest(BaseModel):
    course_id: str
    source_ids: list[str] = Field(min_length=1, max_length=500)

    @field_validator("course_id")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return validate_course_id(value)


class AssistantQaResponse(BaseModel):
    drafts: list[AssistantQaDraft] = Field(min_length=1, max_length=30)


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


class StrictContract(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class GeneratedAssetPlaceholder(StrictContract):
    role: Literal[
        "cover",
        "primary-media",
        "supporting-image",
        "video",
        "interaction-background",
        "quiz-image",
    ]
    description: str = Field(min_length=1, max_length=500)
    alt_text: str = Field(alias="altText", min_length=1, max_length=300)


class GeneratedInteractionDraft(StrictContract):
    kind: Literal["callout", "hotspot", "stage-point", "drag-item", "scroll-step", "color-variant"]
    label: str = Field(min_length=1, max_length=160)
    instruction: str = Field(min_length=1, max_length=1000)
    feedback: str | None = Field(default=None, min_length=1, max_length=1000)


class GeneratedQuizSuggestion(StrictContract):
    question: str = Field(min_length=1, max_length=1000)
    options: list[str] = Field(min_length=2, max_length=6)
    suggested_correct_answer_index: int = Field(alias="suggestedCorrectAnswerIndex", ge=0)
    rationale: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_answer_index(self) -> "GeneratedQuizSuggestion":
        if self.suggested_correct_answer_index >= len(self.options):
            raise ValueError("Suggested answer must reference an available option.")
        return self


class GeneratedCourseLesson(StrictContract):
    lesson_type: Literal[
        "content",
        "interaction",
        "stage",
        "video",
        "quiz",
        "canvas",
        "colorSwitcher",
        "splitScreen",
        "dragDrop",
        "scrollStory",
    ] = Field(alias="lessonType")
    headline: str = Field(min_length=1, max_length=180)
    body: str = Field(min_length=1, max_length=12000)
    interaction_drafts: list[GeneratedInteractionDraft] = Field(
        alias="interactionDrafts", max_length=20
    )
    asset_placeholders: list[GeneratedAssetPlaceholder] = Field(
        alias="assetPlaceholders", max_length=20
    )
    quiz_suggestions: list[GeneratedQuizSuggestion] = Field(alias="quizSuggestions", max_length=10)


class GeneratedCourseChapter(StrictContract):
    title: str = Field(min_length=1, max_length=180)
    estimated_duration: int = Field(alias="estimatedDuration", ge=1, le=180)
    lessons: list[GeneratedCourseLesson] = Field(min_length=1, max_length=20)


class GeneratedCourseGraph(StrictContract):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=2000)
    objectives: list[str] = Field(min_length=1, max_length=12)
    chapters: list[GeneratedCourseChapter] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def validate_lesson_count(self) -> "GeneratedCourseGraph":
        if sum(len(chapter.lessons) for chapter in self.chapters) > 100:
            raise ValueError("A generated course may contain at most 100 lessons.")
        return self


class CourseGenerationRequest(BaseModel):
    course_id: str
    source_ids: list[str] = Field(min_length=1, max_length=500)
    brief: str = Field(min_length=1, max_length=4000)
    prompt_template_version: str = Field(min_length=1, max_length=100)

    @field_validator("course_id")
    @classmethod
    def validate_course(cls, value: str) -> str:
        return validate_course_id(value)


class CourseGenerationResponse(BaseModel):
    graph: GeneratedCourseGraph
    model_identifier: str
    prompt_template_version: str

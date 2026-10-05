from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.llm_service import llm_service

router = APIRouter()


class FormatPromptRequest(BaseModel):
    topic: str = Field(..., description="Topic for generating prompt", example="FastAPI and LangChain architecture")


class FormatPromptResponse(BaseModel):
    topic: str
    formatted_prompt: str


@router.get("/health")
def health_check():
    return {"status": "ok", "message": "Service is healthy"}


@router.post("/format-prompt", response_model=FormatPromptResponse)
def format_prompt(payload: FormatPromptRequest):
    formatted = llm_service.format_prompt(payload.topic)
    return FormatPromptResponse(topic=payload.topic, formatted_prompt=formatted)

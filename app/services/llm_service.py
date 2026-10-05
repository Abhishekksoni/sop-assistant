from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class LLMService:
    @staticmethod
    def create_prompt_template(system_template: str, human_template: str) -> ChatPromptTemplate:
        """Create a standard ChatPromptTemplate."""
        return ChatPromptTemplate.from_messages([
            ("system", system_template),
            ("human", human_template),
        ])

    @staticmethod
    def format_prompt(topic: str) -> str:
        """Example helper demonstrating LangChain prompt formatting."""
        prompt = ChatPromptTemplate.from_template("Provide a concise summary on: {topic}")
        return prompt.format(topic=topic)


llm_service = LLMService()

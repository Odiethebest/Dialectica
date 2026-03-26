from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    tavily_api_key: str = ""
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gpt-4o-mini"
    synthesis_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    max_rounds: int = 2
    cors_origins: list[str] = ["https://odieyang.com", "http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = {"env_file": ".env"}


settings = Settings()

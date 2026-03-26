# backend/app/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str
    tavily_api_key: str = ""
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gpt-4o-mini"
    synthesis_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    max_rounds: int = 2
    cors_origins_str: str = "https://odieyang.com,https://www.odieyang.com"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_str.split(",")]

    class Config:
        env_file = ".env"

settings = Settings()
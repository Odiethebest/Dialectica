from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    openai_api_key: str = ""
    tavily_api_key: str = ""
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gpt-4o-mini"
    synthesis_model: str = "gpt-4o"
    max_rounds: int = 2
    cors_origins: list[str] = ["https://odieyang.com", "http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()

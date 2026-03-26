from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_api_key: str = ""
    tavily_api_key: str = ""
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gemini-2.0-flash"
    synthesis_model: str = "gemini-2.0-flash"
    embedding_model: str = "models/gemini-embedding-001"
    max_rounds: int = 2
    cors_origins: list[str] = ["https://odieyang.com", "http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()

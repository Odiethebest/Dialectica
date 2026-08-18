# backend/app/config.py
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str
    tavily_api_key: str = ""
    admin_key: str = ""            # gates POST /admin/build-index; empty = endpoint disabled
    chroma_db_path: str = "./chroma_db"
    default_model: str = "gpt-4o-mini"
    synthesis_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    max_rounds: int = 2

    # Kept as a plain str: pydantic-settings parses list[str] env vars as JSON,
    # and a comma-separated value is not valid JSON. The alias accepts the
    # documented CORS_ORIGINS as well as the legacy CORS_ORIGINS_STR.
    cors_origins_str: str = Field(
        default="https://odieyang.com,https://www.odieyang.com",
        validation_alias=AliasChoices("CORS_ORIGINS", "CORS_ORIGINS_STR"),
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_str.split(",") if o.strip()]


settings = Settings()

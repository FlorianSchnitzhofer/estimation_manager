"""Application settings, read from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "ReqPOOL Estimation Manager"
    database_url: str = "sqlite:///./estimation_manager.db"

    # Entra ID (OIDC). When unset, only the auto-login bypass works.
    entra_tenant_id: str = ""
    entra_client_id: str = ""
    entra_audience: str = ""  # defaults to api://<client_id> when empty

    # Dev/demo bypass: this user is signed in automatically with the Admin role.
    # Set to an empty string to disable for production.
    auto_login_user: str = "florian@bingro.com"
    auto_login_name: str = "Florian Bingro"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

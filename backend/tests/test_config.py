import pytest
from pydantic import ValidationError
import os
from app.core.config import Settings

def test_development_config_works():
    # In development, the default secret is allowed
    settings = Settings(ENVIRONMENT="development")
    assert settings.ENVIRONMENT == "development"
    assert settings.SECRET_KEY == "supersecretkey_please_change_in_production"

def test_production_config_rejects_default_secret():
    # If environment is production, default secret is rejected
    with pytest.raises(ValidationError, match="In production, SECRET_KEY must be overridden"):
        Settings(ENVIRONMENT="production")

def test_production_config_rejects_empty_secret():
    with pytest.raises(ValidationError, match="In production, SECRET_KEY must be overridden"):
        Settings(ENVIRONMENT="production", SECRET_KEY="")

def test_production_config_rejects_short_secret():
    with pytest.raises(ValidationError, match="must be at least 32 characters long"):
        Settings(ENVIRONMENT="production", SECRET_KEY="short_secret_here")

def test_production_config_accepts_strong_secret():
    valid_secret = "a_very_long_and_secure_secret_that_is_over_32_chars"
    settings = Settings(ENVIRONMENT="production", SECRET_KEY=valid_secret)
    assert settings.SECRET_KEY == valid_secret

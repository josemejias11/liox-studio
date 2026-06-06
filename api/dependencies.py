import os
from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

_APP_KEY = os.environ.get("DECK_API_KEY", "")
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(x_api_key: str = Security(_api_key_header)):
    """Validates X-API-Key header against DECK_API_KEY env var. No-op when DECK_API_KEY is unset (dev mode)."""
    if not _APP_KEY:
        return
    if x_api_key != _APP_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
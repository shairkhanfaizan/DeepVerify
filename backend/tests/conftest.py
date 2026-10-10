import pytest_asyncio
from app.db.database import engine

@pytest_asyncio.fixture(autouse=True)
async def dispose_global_engine():
    yield
    await engine.dispose()

import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.database import Base
from app.core.config import settings
from app.api.deps import get_db
import uuid

TEST_DATABASE_URL = settings.DATABASE_URL

@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def db_session(test_engine):
    async_session_maker = async_sessionmaker(test_engine, expire_on_commit=False)
    async with async_session_maker() as session:
        yield session

@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_register(client: AsyncClient):
    email = f"test_{uuid.uuid4()}@example.com"
    response = await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == email
    assert "id" in data
    assert "password" not in data
    assert "hashed_password" not in data

@pytest.mark.asyncio
async def test_register_duplicate(client: AsyncClient):
    email = f"test_{uuid.uuid4()}@example.com"
    # Register first
    await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    # Register duplicate
    response = await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_login_and_me(client: AsyncClient):
    email = f"test_{uuid.uuid4()}@example.com"
    # Register first
    await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    
    # Test Login
    response = await client.post(
        f"{settings.API_V2_STR}/auth/login",
        json={"email": email, "password": "securepassword"}
    )
    assert response.status_code == 200
    assert "access_token" in response.cookies
    
    # Test /me
    response_me = await client.get(f"{settings.API_V2_STR}/auth/me")
    assert response_me.status_code == 200
    data = response_me.json()
    assert data["email"] == email

@pytest.mark.asyncio
async def test_me_unauthorized(client: AsyncClient):
    # Clear cookies
    client.cookies.clear()
    response = await client.get(f"{settings.API_V2_STR}/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    email = f"test_{uuid.uuid4()}@example.com"
    # Register first
    await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    
    # Login first
    await client.post(
        f"{settings.API_V2_STR}/auth/login",
        json={"email": email, "password": "securepassword"}
    )
    
    # Logout
    response = await client.post(f"{settings.API_V2_STR}/auth/logout")
    assert response.status_code == 200
    
    # Token should be cleared (or expired) from cookies
    assert "access_token" not in response.cookies or not response.cookies.get("access_token")
    
    # Try to access /me with cleared cookie
    client.cookies.clear()
    response_me = await client.get(f"{settings.API_V2_STR}/auth/me")
    assert response_me.status_code == 401

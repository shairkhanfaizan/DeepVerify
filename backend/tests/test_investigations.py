import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.api.deps import get_db
from app.core.config import settings
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
async def test_investigation_lifecycle(client: AsyncClient):
    # Register and Login
    email = f"test_inv_{uuid.uuid4()}@example.com"
    await client.post(
        f"{settings.API_V2_STR}/auth/register",
        json={"email": email, "password": "securepassword"}
    )
    login_response = await client.post(
        f"{settings.API_V2_STR}/auth/login",
        json={"email": email, "password": "securepassword"}
    )
    assert login_response.status_code == 200

    # 1. Create Investigation
    inv_res = await client.post(
        f"{settings.API_V2_STR}/investigations/",
        json={"title": "Test Case 1", "notes": "Initial notes"}
    )
    assert inv_res.status_code == 201
    inv_data = inv_res.json()
    inv_id = inv_data["id"]
    assert inv_data["title"] == "Test Case 1"

    # 2. List Investigations
    list_res = await client.get(f"{settings.API_V2_STR}/investigations/")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert len(list_data) == 1
    assert list_data[0]["id"] == inv_id

    # 3. Get Investigation
    get_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Test Case 1"
    
    # 4. Create Evidence (Needs a dummy image)
    import io
    from PIL import Image
    
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    files = {"file": ("test.png", img_bytes, "image/png")}
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence",
        files=files
    )
    assert ev_res.status_code == 202
    assert "evidence_id" in ev_res.json()
    ev_id = ev_res.json()["evidence_id"]
    
    # 5. Trigger Analysis (mocking background task to avoid immediate failure setting it back to FAILED)
    from unittest.mock import patch
    with patch("app.api.v2.endpoints.investigations.process_analysis_job"):
        analyze_res = await client.post(
            f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/analyze",
            json={"policy": "ensemble-v1.0"}
        )
        assert analyze_res.status_code == 202
        assert "job_id" in analyze_res.json()
        
        # 6. Prevent Duplicate Analysis
        duplicate_res = await client.post(
            f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/analyze",
            json={"policy": "ensemble-v1.0"}
        )
        assert duplicate_res.status_code == 400

@pytest.mark.asyncio
async def test_unauthorized_investigation_access(client: AsyncClient):
    # Without login, it should be rejected
    inv_res = await client.post(
        f"{settings.API_V2_STR}/investigations/",
        json={"title": "Test Case 1", "notes": "Initial notes"}
    )
    assert inv_res.status_code == 401

@pytest.mark.asyncio
async def test_cross_user_isolation(client: AsyncClient):
    # Register User A
    email_a = f"test_a_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_a, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_a, "password": "securepassword"})
    
    # User A creates Investigation
    inv_res = await client.post(
        f"{settings.API_V2_STR}/investigations/",
        json={"title": "User A Investigation", "notes": ""}
    )
    inv_id = inv_res.json()["id"]
    
    # Register User B
    email_b = f"test_b_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_b, "password": "securepassword"})
    # Login as User B
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_b, "password": "securepassword"})
    
    # User B tries to get User A's investigation
    get_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}")
    assert get_res.status_code == 404
    
    # User B tries to upload evidence to User A's investigation
    import io
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    files = {"file": ("test.png", img_bytes, "image/png")}
    
    ev_res = await client.post(f"{settings.API_V2_STR}/investigations/{inv_id}/evidence", files=files)
    assert ev_res.status_code == 404

@pytest.mark.asyncio
async def test_cross_user_isolation_downloads(client: AsyncClient):
    # Register User A
    email_a = f"test_a_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_a, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_a, "password": "securepassword"})
    
    inv_res = await client.post(
        f"{settings.API_V2_STR}/investigations/",
        json={"title": "User A Investigation", "notes": ""}
    )
    inv_id = inv_res.json()["id"]
    
    import io
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    files = {"file": ("test.png", img_bytes, "image/png")}
    
    ev_res = await client.post(f"{settings.API_V2_STR}/investigations/{inv_id}/evidence", files=files)
    ev_id = ev_res.json()["evidence_id"]
    
    # User A can download
    dl_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/download")
    assert dl_res.status_code == 200
    
    # Register and Login as User B
    email_b = f"test_b_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_b, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_b, "password": "securepassword"})
    
    # User B tries to download User A's evidence
    b_dl_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/download")
    assert b_dl_res.status_code == 404
    
    # User B tries to download User A's heatmap
    b_hm_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/heatmap")
    assert b_hm_res.status_code == 404

@pytest.mark.asyncio
async def test_cross_investigation_evidence_mismatch(client: AsyncClient):
    # Single user owns both investigations, but evidence ID is swapped across investigations
    email = f"test_swap_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "securepassword"})
    
    # Create Investigation 1
    res1 = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Case 1", "notes": ""})
    inv1_id = res1.json()["id"]
    
    # Create Investigation 2
    res2 = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Case 2", "notes": ""})
    inv2_id = res2.json()["id"]
    
    import io
    from PIL import Image
    img = Image.new('RGB', (50, 50), color = 'blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    ev_res2 = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv2_id}/evidence",
        files={"file": ("test2.png", img_bytes, "image/png")}
    )
    ev2_id = ev_res2.json()["evidence_id"]
    
    # User tries to access evidence 2 under investigation 1 URL
    mismatch_dl = await client.get(f"{settings.API_V2_STR}/investigations/{inv1_id}/evidence/{ev2_id}/download")
    assert mismatch_dl.status_code == 404
    
    mismatch_hm = await client.get(f"{settings.API_V2_STR}/investigations/{inv1_id}/evidence/{ev2_id}/heatmap")
    assert mismatch_hm.status_code == 404
    
    # Accessing under correct investigation 2 succeeds
    correct_dl = await client.get(f"{settings.API_V2_STR}/investigations/{inv2_id}/evidence/{ev2_id}/download")
    assert correct_dl.status_code == 200

@pytest.mark.asyncio
async def test_comparison_cross_user_isolation(client: AsyncClient):
    # User A creates Case A
    email_a = f"test_comp_a_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_a, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_a, "password": "securepassword"})
    
    res_a = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Case A", "notes": ""})
    case_a_id = res_a.json()["id"]
    
    # User B creates Case B
    email_b = f"test_comp_b_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_b, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_b, "password": "securepassword"})
    
    res_b = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Case B", "notes": ""})
    case_b_id = res_b.json()["id"]
    
    # User B (acting as client) attempts to fetch Case A to compare against Case B
    tampered_fetch = await client.get(f"{settings.API_V2_STR}/investigations/{case_a_id}")
    assert tampered_fetch.status_code == 404

@pytest.mark.asyncio
async def test_analyze_evidence_invalid_policy(client: AsyncClient):
    email = f"test_inv_pol_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "securepassword"})
    
    inv_res = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Test Case", "notes": ""})
    inv_id = inv_res.json()["id"]
    
    import io
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    files = {"file": ("test.png", img_bytes, "image/png")}
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence",
        files=files
    )
    ev_id = ev_res.json()["evidence_id"]
    
    analyze_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/analyze",
        json={"policy": "unsupported-fake-policy"}
    )
    assert analyze_res.status_code == 400
    assert "Unsupported analysis configuration" in analyze_res.json()["detail"]

@pytest.mark.asyncio
async def test_analyze_evidence_valid_spatial_only(client: AsyncClient):
    email = f"test_val_pol_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "securepassword"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "securepassword"})
    
    inv_res = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Test Case", "notes": ""})
    inv_id = inv_res.json()["id"]
    
    import io
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    files = {"file": ("test.png", img_bytes, "image/png")}
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence",
        files=files
    )
    ev_id = ev_res.json()["evidence_id"]
    
    analyze_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/analyze",
        json={"policy": "spatial-only-v1.0"}
    )
    assert analyze_res.status_code == 202
    assert "job_id" in analyze_res.json()


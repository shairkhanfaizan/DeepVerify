import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
import uuid
import json
import io
from PIL import Image

from app.main import app
from app.db.database import AsyncSessionLocal
from app.api.deps import get_db
from app.core.config import settings
from app.services.assistant import build_offline_synthesis, stream_assistant_response
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

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

def test_offline_synthesis_logic():
    sample_context = {
        "evidence": {
            "id": "ev-12345",
            "file_hash": "a1b2c3d4e5f67890",
            "mime_type": "image/png"
        },
        "observations": [
            {
                "signal_type": "IMAGE_DIMENSIONS",
                "value": "1024x1024",
                "representation": "Width: 1024px, Height: 1024px",
                "provenance": "PIL.Image"
            },
            {
                "signal_type": "IMAGE_FORMAT",
                "value": "PNG",
                "representation": "Color Mode: RGB",
                "provenance": "PIL.Image"
            }
        ],
        "signals": [
            {
                "signal_type": "SPATIAL_PROBABILITY_REAL",
                "value": "0.852",
                "confidence_semantics": "PROBABILITY_OF_REAL",
                "model_id": "deepverify-spatial-v1",
                "model_version": "1.0.0",
                "provenance": "deepverify-spatial-v1"
            },
            {
                "signal_type": "FREQUENCY_PROBABILITY_REAL",
                "value": "0.420",
                "confidence_semantics": "PROBABILITY_OF_REAL",
                "model_id": "deepverify-frequency-v1",
                "model_version": "1.0.0",
                "provenance": "deepverify-frequency-v1"
            }
        ],
        "analysis_results": [
            {
                "verdict": "LIKELY_AUTHENTIC",
                "ensemble_score": 0.679,
                "policy_version": "ensemble-v1.0"
            }
        ],
        "investigator_notes": "Suspected synthetic manipulation from social feed."
    }

    synthesis = build_offline_synthesis(sample_context, "Why do the signals diverge?")
    
    # Assert critical grounding rules and content
    assert "ev-12345" in synthesis
    assert "a1b2c3d4e5f67890" in synthesis
    assert "1024x1024" in synthesis
    assert "85.2% Real" in synthesis
    assert "42.0% Real" in synthesis
    assert "ensemble-v1.0" in synthesis
    assert "Suspected synthetic manipulation from social feed." in synthesis
    assert "Grad-CAM Topography" in synthesis
    assert "receptive-field" in synthesis
    assert "divergent" in synthesis.lower() or "diverge" in synthesis.lower()

@pytest.mark.asyncio
async def test_stream_assistant_chunks():
    sample_context = {
        "evidence": {"id": "ev-test", "file_hash": "12345", "mime_type": "image/jpeg"},
        "observations": [],
        "signals": [],
        "analysis_results": []
    }
    chunks = []
    async for chunk in stream_assistant_response(sample_context, "Summarize"):
        chunks.append(chunk)
    assert len(chunks) > 0
    full_text = "".join(chunks)
    assert "ev-test" in full_text

@pytest.mark.asyncio
async def test_stream_google_provider():
    from unittest.mock import patch
    from app.services.assistant import _stream_google
    
    mock_sse_lines = [
        'data: {"candidates": [{"content": {"parts": [{"text": "Based on "}]}}]}\n\n',
        'data: {"candidates": [{"content": {"parts": [{"text": "grounded signals."}]}}]}\n\n',
        'data: [DONE]\n\n'
    ]
    
    class MockStreamResponse:
        status_code = 200
        async def aiter_lines(self):
            for l in mock_sse_lines:
                yield l
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        def stream(self, method, url, json=None, headers=None):
            return MockStreamResponse()
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("httpx.AsyncClient", side_effect=MockAsyncClient):
        with patch.object(settings, "GOOGLE_API_KEY", "test-google-key"):
            chunks = []
            async for chunk in _stream_google({"evidence": {"id": "1"}}, "test query"):
                chunks.append(chunk)
            assert "".join(chunks) == "Based on grounded signals."


@pytest.mark.asyncio
async def test_patch_investigation_notes(client: AsyncClient):
    email = f"notes_test_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "password123"})
    
    # Create investigation
    create_res = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Notes Test Case"})
    inv_id = create_res.json()["id"]
    
    # Patch notes
    patch_res = await client.patch(
        f"{settings.API_V2_STR}/investigations/{inv_id}",
        json={"notes": "Updated hypothesis: High-frequency artifact detected."}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["notes"] == "Updated hypothesis: High-frequency artifact detected."
    
    # Verify persistence via GET
    get_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}")
    assert get_res.status_code == 200
    assert get_res.json()["notes"] == "Updated hypothesis: High-frequency artifact detected."

@pytest.mark.asyncio
async def test_assistant_api_endpoint_and_isolation(client: AsyncClient):
    # Register and login User A
    email_a = f"user_a_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_a, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_a, "password": "password123"})
    
    create_res = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Assistant Case A"})
    inv_id_a = create_res.json()["id"]
    
    # Upload evidence
    img = Image.new('RGB', (60, 60), color='green')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id_a}/evidence",
        files={"file": ("test.png", buf.getvalue(), "image/png")}
    )
    ev_id_a = ev_res.json()["evidence_id"]
    
    # Call Assistant endpoint as User A
    assistant_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id_a}/evidence/{ev_id_a}/assistant",
        json={"question": "Explain the forensic signals"}
    )
    assert assistant_res.status_code == 200
    assert "text/event-stream" in assistant_res.headers["content-type"]
    
    body = assistant_res.text
    assert "data: " in body
    assert "[DONE]" in body
    
    # User B tries to access User A's assistant
    email_b = f"user_b_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_b, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_b, "password": "password123"})
    
    unauthorized_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id_a}/evidence/{ev_id_a}/assistant",
        json={"question": "Attacker probe"}
    )
    assert unauthorized_res.status_code == 404

    # User B cannot patch User A's investigation notes
    patch_forbidden = await client.patch(
        f"{settings.API_V2_STR}/investigations/{inv_id_a}",
        json={"notes": "Tampered notes by User B"}
    )
    assert patch_forbidden.status_code == 404

@pytest.mark.asyncio
async def test_validate_key_endpoint(client: AsyncClient):
    from unittest.mock import patch, MagicMock
    
    email = f"val_test_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "password123"})
    
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {"candidates": []}
    
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        async def post(self, url, *args, **kwargs):
            return mock_res
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("httpx.AsyncClient", side_effect=MockAsyncClient):
        val_res = await client.post(
            f"{settings.API_V2_STR}/investigations/assistant/validate-key",
            json={"google_api_key": "ai-test-key-12345", "gemini_model": "gemini-2.5-flash"}
        )
        assert val_res.status_code == 200
        val_data = val_res.json()
        assert val_data["valid"] is True
        assert val_data["model"] == "gemini-2.5-flash"

@pytest.mark.asyncio
async def test_assistant_gemini_error_fallback(client: AsyncClient):
    from unittest.mock import patch

    email = f"fb_test_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email, "password": "password123"})

    create_res = await client.post(f"{settings.API_V2_STR}/investigations/", json={"title": "Fallback Test Case"})
    inv_id = create_res.json()["id"]

    img = Image.new('RGB', (60, 60), color='blue')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence",
        files={"file": ("test.png", buf.getvalue(), "image/png")}
    )
    ev_id = ev_res.json()["evidence_id"]

    # Simulate Google API network/quota crash
    class FailingAsyncClient:
        def __init__(self, *args, **kwargs):
            pass
        def stream(self, *args, **kwargs):
            raise RuntimeError("QuotaExceeded429")
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("httpx.AsyncClient", side_effect=FailingAsyncClient):
        assistant_res = await client.post(
            f"{settings.API_V2_STR}/investigations/{inv_id}/evidence/{ev_id}/assistant",
            json={"question": "Summarize", "google_api_key": "valid-format-key-12345"}
        )
        assert assistant_res.status_code == 200
        body = assistant_res.text

        # Verify fallback event was emitted to notify client
        assert '{"provider": "offline-fallback", "fallback": true}' in body

        # Reassemble chunks from SSE frames
        full_text = ""
        for line in body.split("\n\n"):
            if line.startswith("data: "):
                payload = line[6:].strip()
                if payload != "[DONE]":
                    try:
                        data = json.loads(payload)
                        if "chunk" in data:
                            full_text += data["chunk"]
                    except Exception:
                        pass

        # Verify safe fallback notice in reassembled stream content
        assert "Google Gemini unavailable" in full_text
        assert "Falling back to DeepVerify offline scientific engine" in full_text
        # Verify offline synthesis content is generated
        assert "Deterministic Media Observations" in full_text
        assert "[DONE]" in body



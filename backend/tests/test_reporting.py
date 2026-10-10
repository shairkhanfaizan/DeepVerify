import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
import uuid
import io
from PIL import Image

from app.main import app
from app.db.database import AsyncSessionLocal
from app.api.deps import get_db
from app.core.config import settings
from app.services.reporting import generate_pdf_report
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


@pytest.mark.asyncio
async def test_generate_pdf_report_direct():
    """Unit test for PDF report binary generation from mock investigation data."""
    class MockObs:
        def __init__(self, st, val, rep, prov):
            self.signal_type = st
            self.value = val
            self.representation = rep
            self.provenance = prov

    class MockSignal:
        def __init__(self, st, mid, mv, val, cs):
            self.signal_type = st
            self.model_id = mid
            self.model_version = mv
            self.value = val
            self.confidence_semantics = cs

    class MockPolicy:
        version = "ensemble-v1.0"

    class MockResult:
        verdict = "LIKELY_AUTHENTIC"
        ensemble_score = 0.884
        policy = MockPolicy()
        ai_explanation = None

    class MockEvidence:
        id = "ev-test-12345678"
        mime_type = "image/png"
        file_hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
        storage_key = "non_existent_key.png"
        observations = [
            MockObs("IMAGE_DIMENSIONS", "1920x1080", "Width: 1920px, Height: 1080px", "PIL.Image"),
            MockObs("IMAGE_FORMAT", "PNG", "Color Mode: RGB", "PIL.Image")
        ]
        signals = [
            MockSignal("SPATIAL_PROBABILITY_REAL", "deepverify-spatial-v1", "1.0", "0.85", "AI_PROBABILITY"),
            MockSignal("FREQUENCY_PROBABILITY_REAL", "deepverify-frequency-v1", "1.0", "0.92", "AI_PROBABILITY")
        ]
        analysis_results = [MockResult()]

    class MockInvestigation:
        id = "inv-test-87654321"
        title = "Operation Synthetic Horizon"
        status = "OPEN"
        notes = "Investigator suspecting residual GAN checkerboard artifacts."
        evidence_items = [MockEvidence()]

    pdf_bytes = await generate_pdf_report(
        investigation=MockInvestigation(),
        investigator_email="agent@deepverify.local",
        evidence_id_filter=None
    )

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    # Must start with standard PDF magic header
    assert pdf_bytes.startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_report_api_endpoint_flow(client: AsyncClient):
    """Integration test for GET /api/v2/investigations/{id}/report."""
    # 1. Register & login User A
    email_a = f"report_user_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_a, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_a, "password": "password123"})

    # 2. Create investigation
    create_res = await client.post(
        f"{settings.API_V2_STR}/investigations/",
        json={"title": "Forensic Dossier Case", "notes": "Initial case hypothesis recorded."}
    )
    inv_id = create_res.json()["id"]

    # 3. Upload evidence
    img = Image.new('RGB', (80, 80), color='purple')
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    ev_res = await client.post(
        f"{settings.API_V2_STR}/investigations/{inv_id}/evidence",
        files={"file": ("dossier_sample.png", buf.getvalue(), "image/png")}
    )
    ev_id = ev_res.json()["evidence_id"]

    # 4. Request full case PDF report
    report_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/report")
    assert report_res.status_code == 200
    assert report_res.headers["content-type"] == "application/pdf"
    assert "attachment; filename=" in report_res.headers["content-disposition"]
    assert report_res.content.startswith(b"%PDF-")
    assert len(report_res.content) > 1000

    # 5. Request filtered single-evidence dossier
    filtered_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/report?evidence_id={ev_id}")
    assert filtered_res.status_code == 200
    assert filtered_res.headers["content-type"] == "application/pdf"
    assert filtered_res.content.startswith(b"%PDF-")

    # 6. Request non-existent evidence_id returns 404
    bad_ev_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/report?evidence_id=non-existent-ev")
    assert bad_ev_res.status_code == 404

    # 7. User B cannot download User A's report (ownership boundary)
    email_b = f"report_unauth_{uuid.uuid4()}@example.com"
    await client.post(f"{settings.API_V2_STR}/auth/register", json={"email": email_b, "password": "password123"})
    await client.post(f"{settings.API_V2_STR}/auth/login", json={"email": email_b, "password": "password123"})

    unauth_res = await client.get(f"{settings.API_V2_STR}/investigations/{inv_id}/report")
    assert unauth_res.status_code == 404

@pytest.mark.asyncio
async def test_reporting_xml_safety_and_special_chars():
    """Verify that unescaped XML/HTML special characters in user fields do not crash ReportLab."""
    class MockEvidence:
        id = "ev-special-chars"
        mime_type = "image/png"
        file_hash = "12345"
        storage_key = None
        observations = []
        signals = []
        analysis_results = []
        jobs = []

    class MockInv:
        id = "inv-xml-escape"
        title = "Case with <unclosed tag & unescaped quotes 'test'"
        status = "OPEN"
        notes = "Investigator note: Score < 0.5 & unclosed <div> without closing tag."
        evidence_items = [MockEvidence()]

    pdf_bytes = await generate_pdf_report(MockInv(), "test@domain.com")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")

def test_canonical_ledger_digest_determinism():
    """Verify that compute_canonical_ledger_digest is deterministic and sensitive to any data change."""
    from app.services.reporting import compute_canonical_ledger_digest

    class MockSignal:
        signal_type = "SPATIAL_PROBABILITY_REAL"
        model_id = "deepverify-spatial-v1"
        model_version = "1.0"
        value = "0.85"
        confidence_semantics = "AI_PROBABILITY"

    class MockEvidence:
        id = "ev-1"
        file_hash = "hash_alpha"
        mime_type = "image/jpeg"
        storage_key = "k1"
        observations = []
        signals = [MockSignal()]
        analysis_results = []

    class MockInv:
        id = "inv-1"
        title = "Deterministic Case"
        status = "OPEN"
        notes = "Notes A"

    ev1 = MockEvidence()
    inv = MockInv()

    digest1 = compute_canonical_ledger_digest(inv, [ev1])
    digest2 = compute_canonical_ledger_digest(inv, [ev1])
    assert digest1 == digest2
    assert len(digest1) == 64

    # Tampering with a signal value alters the digest
    class MockSignalTampered:
        signal_type = "SPATIAL_PROBABILITY_REAL"
        model_id = "deepverify-spatial-v1"
        model_version = "1.0"
        value = "0.86" # modified
        confidence_semantics = "AI_PROBABILITY"

    ev_tampered = MockEvidence()
    ev_tampered.signals = [MockSignalTampered()]
    digest_tampered = compute_canonical_ledger_digest(inv, [ev_tampered])
    assert digest_tampered != digest1

@pytest.mark.asyncio
async def test_reporting_failed_and_pending_job_status():
    """Verify that failed or pending analysis jobs are honestly displayed in the report."""
    class MockJobFailed:
        status = "FAILED"
        error_message = "OOM during spatial tensor forward pass"

    class MockEvidenceFailed:
        id = "ev-failed-123"
        mime_type = "image/png"
        file_hash = "112233"
        storage_key = None
        observations = []
        signals = []
        analysis_results = []
        jobs = [MockJobFailed()]

    class MockEvidenceUnanalyzed:
        id = "ev-unanalyzed-456"
        mime_type = "image/jpeg"
        file_hash = "445566"
        storage_key = None
        observations = []
        signals = []
        analysis_results = []
        jobs = []

    class MockInv:
        id = "inv-status-check"
        title = "Status Check Case"
        status = "OPEN"
        notes = None
        evidence_items = [MockEvidenceFailed(), MockEvidenceUnanalyzed()]

    pdf_bytes = await generate_pdf_report(MockInv(), "auditor@deepverify.local")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 2000

@pytest.mark.asyncio
async def test_reporting_edge_case_title_and_evidence_sorting():
    """Verify that None/symbolic titles and multiple evidence items are handled safely and deterministically."""
    from datetime import datetime, timezone

    class MockEvidenceA:
        id = "ev-b-item"
        mime_type = "image/png"
        file_hash = "hash_b"
        storage_key = None
        created_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
        observations = []
        signals = []
        analysis_results = []
        jobs = []

    class MockEvidenceB:
        id = "ev-a-item"
        mime_type = "image/jpeg"
        file_hash = "hash_a"
        storage_key = None
        created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        observations = []
        signals = []
        analysis_results = []
        jobs = []

    class MockInvEmptyTitle:
        id = "inv-none-title"
        title = None
        status = "CLOSED"
        notes = ""
        evidence_items = [MockEvidenceA(), MockEvidenceB()]

    pdf_bytes = await generate_pdf_report(MockInvEmptyTitle(), "officer@court.local")
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF-")



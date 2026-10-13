import pytest
import os
import shutil
from pathlib import Path
from app.core.storage import LocalStorageProvider

@pytest.fixture
def temp_storage_dir():
    test_dir = "test_storage_tmp"
    yield test_dir
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)

@pytest.mark.asyncio
async def test_local_storage_provider(temp_storage_dir):
    provider = LocalStorageProvider(base_dir=temp_storage_dir)
    
    file_hash = "abc123def456"
    content = b"test content"
    extension = "jpg"
    
    # Save
    path = await provider.save_file(file_hash, content, extension)
    assert os.path.exists(path)
    assert path == str(Path(temp_storage_dir) / f"{file_hash}.{extension}")
    
    # Get
    retrieved = await provider.get_file(path)
    assert retrieved == content
    
    # Delete
    deleted = await provider.delete_file(path)
    assert deleted is True
    assert not os.path.exists(path)

@pytest.mark.asyncio
async def test_local_storage_path_traversal(temp_storage_dir):
    provider = LocalStorageProvider(base_dir=temp_storage_dir)
    
    # Try to access a file outside the base_dir
    with pytest.raises(ValueError, match="Path traversal detected"):
        await provider.get_file("../../../etc/passwd")
        
    with pytest.raises(ValueError, match="Path traversal detected"):
        await provider.delete_file("../../../etc/passwd")

@pytest.mark.asyncio
async def test_local_storage_failed_write(temp_storage_dir, monkeypatch):
    provider = LocalStorageProvider(base_dir=temp_storage_dir)
    file_hash = "err_test"
    
    # Force aiofiles open to fail
    def mock_open(*args, **kwargs):
        raise IOError("Disk full")
    
    import aiofiles
    monkeypatch.setattr(aiofiles, "open", mock_open)
    
    with pytest.raises(IOError, match="Disk full"):
        await provider.save_file(file_hash, b"content", "jpg")
        
    # Verify cleanup (it shouldn't exist)
    expected_path = Path(temp_storage_dir) / f"{file_hash}.jpg"
    assert not expected_path.exists()

@pytest.mark.asyncio
async def test_r2_storage_provider():
    from unittest.mock import MagicMock
    import io
    from app.core.storage import R2StorageProvider

    mock_s3 = MagicMock()
    # Mock get_object response
    mock_body = MagicMock()
    mock_body.read.return_value = b"image_data_bytes"
    mock_s3.get_object.return_value = {"Body": mock_body}

    provider = R2StorageProvider(
        account_id="fake_account_id",
        access_key_id="fake_key",
        secret_access_key="fake_secret",
        bucket_name="deepverify-evidence",
        public_url="https://media.deepverify.app",
        s3_client=mock_s3,
    )

    # Test save
    key = await provider.save_file("hash123", b"image_data_bytes", "jpg")
    assert key == "evidence/hash123.jpg"
    mock_s3.put_object.assert_called_once_with(
        Bucket="deepverify-evidence",
        Key="evidence/hash123.jpg",
        Body=b"image_data_bytes",
        ContentType="image/jpeg",
    )

    # Test get
    content = await provider.get_file(key)
    assert content == b"image_data_bytes"
    mock_s3.get_object.assert_called_once_with(
        Bucket="deepverify-evidence",
        Key="evidence/hash123.jpg",
    )

    # Test delete
    deleted = await provider.delete_file(key)
    assert deleted is True
    mock_s3.delete_object.assert_called_once_with(
        Bucket="deepverify-evidence",
        Key="evidence/hash123.jpg",
    )

    # Test public URL
    assert provider.get_public_url(key) == "https://media.deepverify.app/evidence/hash123.jpg"

@pytest.mark.asyncio
async def test_supabase_storage_provider():
    from unittest.mock import AsyncMock, MagicMock
    from app.core.storage import SupabaseStorageProvider

    mock_client = AsyncMock()
    mock_post_resp = MagicMock(status_code=200)
    mock_client.post.return_value = mock_post_resp

    mock_get_resp = MagicMock(status_code=200, content=b"supabase_image_bytes")
    mock_client.get.return_value = mock_get_resp

    mock_del_resp = MagicMock(status_code=200)
    mock_client.delete.return_value = mock_del_resp

    provider = SupabaseStorageProvider(
        url="https://testproj.supabase.co",
        key="test_anon_key",
        bucket_name="deepverify-evidence",
        http_client=mock_client,
    )

    # Save
    key = await provider.save_file("hash456", b"supabase_image_bytes", "jpg")
    assert key == "evidence/hash456.jpg"
    mock_client.post.assert_awaited_once()

    # Get
    content = await provider.get_file(key)
    assert content == b"supabase_image_bytes"
    mock_client.get.assert_awaited_once()

    # Delete
    deleted = await provider.delete_file(key)
    assert deleted is True
    mock_client.delete.assert_awaited_once()

    # Public url
    assert provider.get_public_url(key) == "https://testproj.supabase.co/storage/v1/object/public/deepverify-evidence/evidence/hash456.jpg"

@pytest.mark.asyncio
async def test_storage_provider_factory(monkeypatch):
    from app.core.config import settings
    from app.core.storage import get_storage_provider, LocalStorageProvider, R2StorageProvider, SupabaseStorageProvider

    # Default settings -> LocalStorageProvider
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "SUPABASE_URL", None)
    monkeypatch.setattr(settings, "SUPABASE_KEY", None)
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", None)
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", None)
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", None)
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", None)

    provider = get_storage_provider()
    assert isinstance(provider, LocalStorageProvider)

    # Supabase configured -> SupabaseStorageProvider
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://xyz.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "secret_key")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET_NAME", "deepverify-evidence")

    supa_provider = get_storage_provider()
    assert isinstance(supa_provider, SupabaseStorageProvider)
    assert supa_provider.bucket == "deepverify-evidence"
    assert supa_provider.base_url == "https://xyz.supabase.co"

    # Reset Supabase, R2 configured -> R2StorageProvider
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "SUPABASE_URL", None)
    monkeypatch.setattr(settings, "SUPABASE_KEY", None)
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "acc123")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key123")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "sec123")
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", "my-bucket")

    r2_provider = get_storage_provider()
    assert isinstance(r2_provider, R2StorageProvider)
    assert r2_provider.bucket == "my-bucket"
    assert r2_provider.account_id == "acc123"



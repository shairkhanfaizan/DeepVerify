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

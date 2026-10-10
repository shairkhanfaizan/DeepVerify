from typing import Protocol
import os
import aiofiles
from pathlib import Path
from app.core.config import settings

class StorageInterface(Protocol):
    async def save_file(self, file_hash: str, content: bytes, extension: str) -> str:
        """Saves a file and returns its path or URI."""
        ...
        
    async def get_file(self, file_path: str) -> bytes:
        """Retrieves a file's content by path or URI."""
        ...
        
    async def delete_file(self, file_path: str) -> bool:
        """Deletes a file by path or URI."""
        ...

class LocalStorageProvider:
    def __init__(self, base_dir: str = "storage"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
    async def save_file(self, file_hash: str, content: bytes, extension: str) -> str:
        file_path = self.base_dir / f"{file_hash}.{extension}"
        try:
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            return str(file_path)
        except Exception as e:
            if file_path.exists():
                file_path.unlink()
            raise e
        
    async def get_file(self, file_path: str) -> bytes:
        target_path = Path(file_path).resolve()
        if not str(target_path).startswith(str(self.base_dir.resolve())):
            raise ValueError("Path traversal detected.")
            
        async with aiofiles.open(target_path, 'rb') as f:
            return await f.read()
            
    async def delete_file(self, file_path: str) -> bool:
        target_path = Path(file_path).resolve()
        if not str(target_path).startswith(str(self.base_dir.resolve())):
            raise ValueError("Path traversal detected.")
            
        if target_path.exists():
            target_path.unlink()
            return True
        return False

def get_storage_provider() -> StorageInterface:
    storage_dir = getattr(settings, 'STORAGE_DIR', 'storage')
    return LocalStorageProvider(base_dir=storage_dir)

from typing import Protocol, Optional, Any, Union
import os
import io
import asyncio
import mimetypes
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

class R2StorageProvider:
    """
    Cloudflare R2 Object Storage Provider.
    Implements S3-compatible API with 10 GB free tier and zero egress fees.
    """
    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: Optional[str] = None,
        s3_client: Optional[Any] = None,
    ):
        self.account_id = account_id
        self.access_key_id = access_key_id
        self.secret_access_key = secret_access_key
        self.bucket = bucket_name
        self.public_url = public_url.rstrip("/") if public_url else None
        self.endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        self._client = s3_client

    def _get_client(self):
        if self._client is None:
            import boto3
            from botocore.config import Config
            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
                region_name="auto",
                config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
            )
        return self._client

    async def save_file(self, file_hash: str, content: bytes, extension: str) -> str:
        ext = extension.lstrip(".")
        if file_hash.startswith(("evidence/", "heatmaps/")):
            key = file_hash if file_hash.endswith(f".{ext}") else f"{file_hash}.{ext}"
        else:
            key = f"evidence/{file_hash}.{ext}"

        content_type = mimetypes.guess_type(f"file.{ext}")[0] or "application/octet-stream"

        def _put():
            client = self._get_client()
            client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType=content_type,
            )

        await asyncio.to_thread(_put)
        return key

    async def get_file(self, file_path: str) -> bytes:
        # Hybrid/legacy fallback: if file exists on disk, read it directly
        if os.path.isfile(file_path):
            async with aiofiles.open(file_path, "rb") as f:
                return await f.read()

        def _get():
            client = self._get_client()
            resp = client.get_object(Bucket=self.bucket, Key=file_path)
            return resp["Body"].read()

        return await asyncio.to_thread(_get)

    async def delete_file(self, file_path: str) -> bool:
        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

        def _delete():
            client = self._get_client()
            client.delete_object(Bucket=self.bucket, Key=file_path)
            return True

        return await asyncio.to_thread(_delete)

    def get_public_url(self, key: str) -> Optional[str]:
        if self.public_url:
            return f"{self.public_url}/{key}"
        return None

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        client = self._get_client()
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

def get_storage_provider() -> StorageInterface:
    has_r2 = bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )
    if settings.STORAGE_BACKEND == "r2" or (settings.STORAGE_BACKEND != "local" and has_r2):
        if not has_r2:
            raise ValueError(
                "STORAGE_BACKEND is configured as 'r2', but required Cloudflare R2 "
                "credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are missing."
            )
        return R2StorageProvider(
            account_id=settings.R2_ACCOUNT_ID,
            access_key_id=settings.R2_ACCESS_KEY_ID,
            secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            bucket_name=settings.R2_BUCKET_NAME,
            public_url=settings.R2_PUBLIC_URL,
        )
    storage_dir = getattr(settings, 'STORAGE_DIR', 'storage')
    return LocalStorageProvider(base_dir=storage_dir)

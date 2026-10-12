from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

def _build_async_engine(database_url: str):
    parsed = urlparse(database_url)
    query_params = parse_qs(parsed.query)
    
    connect_args = {}
    if "sslmode" in query_params or "ssl" in query_params:
        query_params.pop("sslmode", None)
        query_params.pop("ssl", None)
        connect_args["ssl"] = True

    new_query = urlencode(query_params, doseq=True)
    clean_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    return create_async_engine(clean_url, connect_args=connect_args, echo=False)

engine = _build_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()

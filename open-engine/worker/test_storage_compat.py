import importlib.util
import os
from pathlib import Path


def test_legacy_minio_compat_uses_supabase_path_endpoint():
    os.environ.setdefault("DATABASE_URL", "postgresql://postgres.test:pw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres")
    module_path = Path(__file__).with_name("minio.py")
    spec = importlib.util.spec_from_file_location("geoacademic_minio_compat", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    client = module.Minio(
        "example.storage.supabase.co/storage/v1/s3",
        access_key="test",
        secret_key="test",
        secure=True,
    )
    assert client.endpoint_url == "https://example.storage.supabase.co/storage/v1/s3"
    assert client.region == "eu-west-1"

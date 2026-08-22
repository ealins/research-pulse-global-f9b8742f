"""Compatibility shim for legacy MinIO-style calls backed by boto3.

The open-engine originally used the MinIO Python client. Supabase Storage exposes
an S3-compatible API below /storage/v1/s3, and the MinIO client rejects endpoint
URLs containing a path. This module preserves the tiny subset of the MinIO API
used by processor.py and snapshotter.py while routing requests through boto3,
which supports Supabase's endpoint format and path-style addressing.
"""

from __future__ import annotations

import os
import re
import urllib.parse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def _infer_region() -> str:
    explicit = os.getenv("S3_REGION")
    if explicit:
        return explicit
    database_url = os.getenv("DATABASE_URL", "")
    db_host = urllib.parse.urlsplit(database_url).hostname or ""
    match = re.match(r"^aws-\d+-(.+?)\.pooler\.supabase\.com$", db_host)
    if match:
        return match.group(1)
    return "us-east-1"


def _normalize_endpoint(endpoint: str, secure: bool) -> str:
    endpoint = endpoint.rstrip("/")
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return f"{'https' if secure else 'http'}://{endpoint}"


class _ObjectResponse:
    def __init__(self, body):
        self._body = body

    def read(self, *args, **kwargs):
        return self._body.read(*args, **kwargs)

    def close(self):
        return self._body.close()

    def release_conn(self):
        # urllib3-specific in MinIO; boto3 StreamingBody only needs close().
        return None


class Minio:
    """Subset of minio.Minio used by the GeoAcademic workers."""

    def __init__(
        self,
        endpoint: str,
        *,
        access_key: str,
        secret_key: str,
        secure: bool = True,
        **_kwargs,
    ):
        self.region = _infer_region()
        self.endpoint_url = _normalize_endpoint(endpoint, secure)
        self._client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=self.region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def bucket_exists(self, bucket_name: str) -> bool:
        try:
            self._client.head_bucket(Bucket=bucket_name)
            return True
        except ClientError as exc:
            code = str(exc.response.get("Error", {}).get("Code", ""))
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in {"404", "NoSuchBucket", "NotFound"} or status == 404:
                return False
            raise

    def make_bucket(self, bucket_name: str):
        kwargs = {"Bucket": bucket_name}
        if self.region != "us-east-1":
            kwargs["CreateBucketConfiguration"] = {
                "LocationConstraint": self.region
            }
        return self._client.create_bucket(**kwargs)

    def put_object(
        self,
        bucket_name: str,
        object_name: str,
        data,
        length: int,
        *,
        content_type: str | None = None,
        metadata: dict | None = None,
        **_kwargs,
    ):
        request = {
            "Bucket": bucket_name,
            "Key": object_name,
            "Body": data,
            "ContentLength": length,
        }
        if content_type:
            request["ContentType"] = content_type
        if metadata:
            metadata_copy = {str(k): str(v) for k, v in metadata.items()}
            cache_control = metadata_copy.pop("Cache-Control", None)
            if cache_control is None:
                cache_control = metadata_copy.pop("cache-control", None)
            if cache_control:
                request["CacheControl"] = cache_control
            if metadata_copy:
                request["Metadata"] = metadata_copy
        return self._client.put_object(**request)

    def get_object(self, bucket_name: str, object_name: str):
        response = self._client.get_object(Bucket=bucket_name, Key=object_name)
        return _ObjectResponse(response["Body"])

"""
Free-tier GitHub semantic discovery for GeoAcademic.
Queries the public GitHub API to find relevant geospatial projects
and researchers without requiring paid search credits.
"""
import httpx
import asyncpg
import urllib.parse
from datetime import datetime, timezone, timedelta
import os

DOMAIN_QUERIES = [
    "photogrammetry",
    "remote sensing",
    "earth observation",
    "geoinformatics",
    "lidar point cloud",
    "spatial data infrastructure"
]

async def run_github_discovery(pool: asyncpg.Pool, max_queries: int = 5) -> int:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GeoAcademic-IngestionBot/1.0"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    inserted = 0
    # Search for repos updated in the last 30 days
    recent_date = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')
    
    async with httpx.AsyncClient(headers=headers, timeout=20.0) as client:
        for query in DOMAIN_QUERIES[:max_queries]:
            q = urllib.parse.quote(f'"{query}" pushed:>{recent_date}')
            url = f"https://api.github.com/search/repositories?q={q}&sort=updated&order=desc&per_page=10"
            
            try:
                resp = await client.get(url)
                if resp.status_code == 403:
                    print("GitHub API rate limited (403). Try adding GITHUB_TOKEN.")
                    break
                resp.raise_for_status()
                data = resp.json()
                
                items = data.get("items", [])
                for item in items:
                    repo_url = item.get("html_url")
                    name = item.get("full_name")
                    desc = item.get("description") or ""
                    
                    if not repo_url or not name:
                        continue
                        
                    async with pool.acquire() as conn:
                        exists = await conn.fetchval("SELECT id FROM source_registry WHERE url = $1", repo_url)
                        if not exists:
                            await conn.execute("""
                                INSERT INTO source_registry (url, name, source_type, entity_hint, trust_level, notes)
                                VALUES ($1, $2, 'project', 'PROJECT', 'standard', $3)
                                ON CONFLICT (url) DO NOTHING
                            """, repo_url, name, f"GitHub Discovery: {desc[:200]}")
                            inserted += 1
                            
            except Exception as e:
                print(f"GitHub search failed for '{query}': {e}")
                
    return inserted

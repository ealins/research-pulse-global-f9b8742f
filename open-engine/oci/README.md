# Oracle Cloud Shell bootstrap

This is the shortest path from a new Oracle Cloud account to a running GeoAcademic open engine.

## One unavoidable manual step

Create/sign in to an Oracle Cloud account and open **Cloud Shell** from the Oracle Console. Account creation itself cannot be automated from the repository because Oracle requires the account owner's identity/billing verification.

Oracle Cloud Shell is browser-based and already contains a pre-authenticated OCI CLI, so no API key or local OCI configuration is required.

## Run

In Oracle Cloud Shell:

```bash
git clone https://github.com/ealins/research-pulse-global-f9b8742f.git
cd research-pulse-global-f9b8742f
bash open-engine/oci/bootstrap-cloud-shell.sh
```

The script creates or configures:

- a GeoAcademic VCN and regional public subnet,
- an Internet Gateway and firewall rules for 22/80/443,
- one `VM.Standard.A1.Flex` instance sized to the current Always Free allowance (2 OCPU / 12 GB RAM),
- a private `geoacademic-evidence` Object Storage bucket,
- S3-compatible Object Storage credentials for the open-engine workers,
- a generated database password and internal maintenance token,
- an SSH deployment key stored only in your Cloud Shell home directory,
- Docker and Git on the VM,
- the GeoAcademic `open-engine` Docker Compose stack,
- the degraded-mode `public/latest.json` snapshot,
- an object-specific read-only pre-authenticated URL for that snapshot.

The script is resumable. Infrastructure identifiers are stored in `~/.geoacademic/oci-state.env`; generated credentials are stored separately in `~/.geoacademic/oci-secrets.env`, both with restrictive permissions.

## What the script cannot change automatically

It prints the Oracle VM's public IP. Create this DNS record wherever `geoacademic.app` DNS is managed:

```text
Type: A
Name: api
Value: <Oracle VM public IP>
```

After DNS resolves, `https://api.geoacademic.app/health` should become available through Caddy HTTPS.

Only after the API is healthy should Lovable receive:

```text
VITE_GEOACADEMIC_API_URL=https://api.geoacademic.app
VITE_GEOACADEMIC_SNAPSHOT_URL=<the object-specific snapshot URL printed by bootstrap>
```

Do not put `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, database passwords, Object Storage credentials, or `INTERNAL_API_TOKEN` into Lovable browser variables.

## AI keys

The engine deploys successfully with no AI key. Deterministic JSON-LD extraction continues to work. Later, add one or both backend-only values to `/home/ubuntu/research-pulse-global-f9b8742f/open-engine/.env.oracle` on the Oracle VM and redeploy:

```text
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=...
NVIDIA_API_KEY=...
NVIDIA_MODEL=...
```

OpenRouter is tried first; direct NVIDIA is the independent fallback. Weak AI-only records remain out of public feeds until verification criteria are met.

## If Oracle says `Out of host capacity`

The bootstrap tries every availability domain in the tenancy. If all fail, no duplicate VM is created and the resource IDs remain saved. Rerun the same command later; it resumes from the saved state.

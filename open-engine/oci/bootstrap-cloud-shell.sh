#!/usr/bin/env bash
set -euo pipefail

# GeoAcademic Oracle Cloud bootstrap.
# Run this only inside OCI Cloud Shell. Cloud Shell already has a pre-authenticated OCI CLI.

REPO_URL="https://github.com/ealins/research-pulse-global-f9b8742f.git"
INSTANCE_NAME="${INSTANCE_NAME:-geoacademic-engine}"
VCN_NAME="${VCN_NAME:-geoacademic-vcn}"
SUBNET_NAME="${SUBNET_NAME:-geoacademic-public-subnet}"
BUCKET_NAME="${BUCKET_NAME:-geoacademic-evidence}"
VCN_CIDR="${VCN_CIDR:-10.42.0.0/16}"
SUBNET_CIDR="${SUBNET_CIDR:-10.42.1.0/24}"
STATE_DIR="${HOME}/.geoacademic"
STATE_FILE="${STATE_DIR}/oci-state.env"
SECRET_FILE="${STATE_DIR}/oci-secrets.env"
SSH_KEY="${STATE_DIR}/geoacademic_oracle"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
touch "$STATE_FILE"
chmod 600 "$STATE_FILE"

log() { printf '\n==> %s\n' "$*"; }
die() { echo "ERROR: $*" >&2; exit 1; }
save_state() {
  local key="$1" value="$2"
  grep -v "^${key}=" "$STATE_FILE" > "${STATE_FILE}.tmp" || true
  printf '%s=%q\n' "$key" "$value" >> "${STATE_FILE}.tmp"
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
  chmod 600 "$STATE_FILE"
}

command -v oci >/dev/null || die "OCI CLI not found. Run this script in Oracle Cloud Shell."
command -v python3 >/dev/null || die "python3 is required"
command -v ssh >/dev/null || die "ssh is required"
command -v openssl >/dev/null || die "openssl is required"

# Cloud Shell normally exposes a pre-authenticated config in /etc/oci/config.
OCI_CONFIG="${OCI_CLI_CONFIG_FILE:-/etc/oci/config}"
[ -f "$OCI_CONFIG" ] || die "OCI config not found at $OCI_CONFIG. Open this from OCI Cloud Shell."

config_value() {
  local key="$1"
  awk -F= -v k="$key" '$1==k {gsub(/^[ \t]+|[ \t]+$/, "", $2); print $2; exit}' "$OCI_CONFIG"
}

TENANCY_OCID="${TENANCY_OCID:-$(config_value tenancy)}"
USER_OCID="${USER_OCID:-$(config_value user)}"
REGION="${OCI_REGION:-$(config_value region)}"
COMPARTMENT_OCID="${COMPARTMENT_OCID:-$TENANCY_OCID}"

[ -n "$TENANCY_OCID" ] || die "Could not determine tenancy OCID"
[ -n "$USER_OCID" ] || die "Could not determine user OCID"
[ -n "$REGION" ] || die "Could not determine OCI region"

# Resume a previous partial bootstrap if present.
# shellcheck disable=SC1090
source "$STATE_FILE" || true

log "Using OCI region: $REGION"
log "Using compartment: $COMPARTMENT_OCID"

if [ ! -f "$SSH_KEY" ]; then
  log "Generating deployment SSH key"
  ssh-keygen -q -t ed25519 -N '' -f "$SSH_KEY" -C geoacademic-oracle
  chmod 600 "$SSH_KEY"
fi

if [ -z "${VCN_ID:-}" ]; then
  log "Creating VCN"
  VCN_ID=$(oci network vcn create \
    --compartment-id "$COMPARTMENT_OCID" \
    --cidr-blocks "[\"$VCN_CIDR\"]" \
    --display-name "$VCN_NAME" \
    --dns-label geoacademic \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)
  save_state VCN_ID "$VCN_ID"
fi

ROUTE_TABLE_ID="${ROUTE_TABLE_ID:-$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-route-table-id"' --raw-output)}"
SECURITY_LIST_ID="${SECURITY_LIST_ID:-$(oci network vcn get --vcn-id "$VCN_ID" --query 'data."default-security-list-id"' --raw-output)}"
save_state ROUTE_TABLE_ID "$ROUTE_TABLE_ID"
save_state SECURITY_LIST_ID "$SECURITY_LIST_ID"

if [ -z "${IGW_ID:-}" ]; then
  log "Creating Internet Gateway"
  IGW_ID=$(oci network internet-gateway create \
    --compartment-id "$COMPARTMENT_OCID" \
    --vcn-id "$VCN_ID" \
    --is-enabled true \
    --display-name geoacademic-internet-gateway \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)
  save_state IGW_ID "$IGW_ID"
fi

log "Configuring public route"
cat > "${STATE_DIR}/route-rules.json" <<JSON
[
  {
    "destination": "0.0.0.0/0",
    "destinationType": "CIDR_BLOCK",
    "networkEntityId": "$IGW_ID",
    "description": "GeoAcademic public internet route"
  }
]
JSON
oci network route-table update \
  --rt-id "$ROUTE_TABLE_ID" \
  --route-rules "file://${STATE_DIR}/route-rules.json" \
  --force >/dev/null

log "Configuring firewall rules for SSH, HTTP and HTTPS"
cat > "${STATE_DIR}/ingress-rules.json" <<'JSON'
[
  {
    "protocol": "6",
    "source": "0.0.0.0/0",
    "sourceType": "CIDR_BLOCK",
    "description": "SSH key-only administration",
    "tcpOptions": {"destinationPortRange": {"min": 22, "max": 22}}
  },
  {
    "protocol": "6",
    "source": "0.0.0.0/0",
    "sourceType": "CIDR_BLOCK",
    "description": "HTTP for Caddy ACME redirect/challenge",
    "tcpOptions": {"destinationPortRange": {"min": 80, "max": 80}}
  },
  {
    "protocol": "6",
    "source": "0.0.0.0/0",
    "sourceType": "CIDR_BLOCK",
    "description": "HTTPS GeoAcademic API",
    "tcpOptions": {"destinationPortRange": {"min": 443, "max": 443}}
  }
]
JSON
cat > "${STATE_DIR}/egress-rules.json" <<'JSON'
[
  {
    "protocol": "all",
    "destination": "0.0.0.0/0",
    "destinationType": "CIDR_BLOCK",
    "description": "Outbound internet for crawlers and APIs"
  }
]
JSON
oci network security-list update \
  --security-list-id "$SECURITY_LIST_ID" \
  --ingress-security-rules "file://${STATE_DIR}/ingress-rules.json" \
  --egress-security-rules "file://${STATE_DIR}/egress-rules.json" \
  --force >/dev/null

if [ -z "${SUBNET_ID:-}" ]; then
  log "Creating regional public subnet"
  SUBNET_ID=$(oci network subnet create \
    --compartment-id "$COMPARTMENT_OCID" \
    --vcn-id "$VCN_ID" \
    --cidr-block "$SUBNET_CIDR" \
    --display-name "$SUBNET_NAME" \
    --dns-label app \
    --route-table-id "$ROUTE_TABLE_ID" \
    --security-list-ids "[\"$SECURITY_LIST_ID\"]" \
    --prohibit-public-ip-on-vnic false \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)
  save_state SUBNET_ID "$SUBNET_ID"
fi

NAMESPACE="${NAMESPACE:-$(oci os ns get --query data --raw-output)}"
save_state NAMESPACE "$NAMESPACE"
S3_ENDPOINT="https://${NAMESPACE}.compat.objectstorage.${REGION}.oraclecloud.com"
save_state S3_ENDPOINT "$S3_ENDPOINT"

if ! oci os bucket get --bucket-name "$BUCKET_NAME" >/dev/null 2>&1; then
  log "Creating private Object Storage bucket"
  oci os bucket create \
    --compartment-id "$COMPARTMENT_OCID" \
    --name "$BUCKET_NAME" \
    --public-access-type NoPublicAccess \
    --storage-tier Standard >/dev/null
fi
save_state BUCKET_NAME "$BUCKET_NAME"

if [ -f "$SECRET_FILE" ]; then
  # shellcheck disable=SC1090
  source "$SECRET_FILE"
else
  log "Creating S3-compatible Object Storage credentials"
  existing=$(oci iam customer-secret-key list --user-id "$USER_OCID" --all \
    --query 'data[?"display-name"==`GeoAcademic S3`].id | [0]' --raw-output 2>/dev/null || true)
  if [ -n "$existing" ] && [ "$existing" != "null" ]; then
    die "A 'GeoAcademic S3' customer secret already exists, but its secret value cannot be retrieved. Delete that key in OCI or restore $SECRET_FILE before rerunning."
  fi
  key_json=$(oci iam customer-secret-key create --display-name "GeoAcademic S3" --user-id "$USER_OCID")
  S3_ACCESS_KEY=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["id"])' <<<"$key_json")
  S3_SECRET_KEY=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["key"])' <<<"$key_json")
  POSTGRES_PASSWORD=$(openssl rand -hex 24)
  INTERNAL_API_TOKEN=$(openssl rand -hex 32)
  cat > "$SECRET_FILE" <<EOF
S3_ACCESS_KEY=$(printf %q "$S3_ACCESS_KEY")
S3_SECRET_KEY=$(printf %q "$S3_SECRET_KEY")
POSTGRES_PASSWORD=$(printf %q "$POSTGRES_PASSWORD")
INTERNAL_API_TOKEN=$(printf %q "$INTERNAL_API_TOKEN")
EOF
  chmod 600 "$SECRET_FILE"
fi

if [ -z "${INSTANCE_ID:-}" ]; then
  log "Finding Always Free-compatible Ubuntu ARM image"
  IMAGE_ID=$(oci compute image list \
    --compartment-id "$COMPARTMENT_OCID" \
    --operating-system "Canonical Ubuntu" \
    --operating-system-version "24.04" \
    --shape VM.Standard.A1.Flex \
    --sort-by TIMECREATED \
    --sort-order DESC \
    --limit 1 \
    --query 'data[0].id' --raw-output)
  [ -n "$IMAGE_ID" ] && [ "$IMAGE_ID" != "null" ] || die "Could not find an Ubuntu 24.04 A1 image in this region"
  save_state IMAGE_ID "$IMAGE_ID"

  log "Launching Always Free A1 instance (2 OCPU / 12 GB RAM)"
  mapfile -t ADS < <(oci iam availability-domain list --compartment-id "$TENANCY_OCID" --query 'data[].name' --raw-output | tr -d '[],' | tr '"' '\n' | sed '/^[[:space:]]*$/d;s/^[[:space:]]*//;s/[[:space:]]*$//')
  [ "${#ADS[@]}" -gt 0 ] || die "No availability domains found"

  launch_error=""
  for AD in "${ADS[@]}"; do
    echo "Trying availability domain: $AD"
    set +e
    launch_output=$(oci compute instance launch \
      --compartment-id "$COMPARTMENT_OCID" \
      --availability-domain "$AD" \
      --subnet-id "$SUBNET_ID" \
      --display-name "$INSTANCE_NAME" \
      --shape VM.Standard.A1.Flex \
      --shape-config '{"ocpus":2,"memoryInGBs":12}' \
      --image-id "$IMAGE_ID" \
      --assign-public-ip true \
      --ssh-authorized-keys-file "${SSH_KEY}.pub" \
      --wait-for-state RUNNING \
      --query 'data.id' --raw-output 2>&1)
    rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then
      INSTANCE_ID="$launch_output"
      save_state INSTANCE_ID "$INSTANCE_ID"
      save_state AVAILABILITY_DOMAIN "$AD"
      break
    fi
    launch_error="$launch_output"
  done
  [ -n "${INSTANCE_ID:-}" ] || die "A1 instance could not be allocated. Oracle may be temporarily out of Always Free A1 capacity. Last error: $launch_error"
fi

if [ -z "${PUBLIC_IP:-}" ]; then
  log "Resolving instance public IP"
  VNIC_ID=$(oci compute vnic-attachment list \
    --compartment-id "$COMPARTMENT_OCID" \
    --instance-id "$INSTANCE_ID" \
    --query 'data[0]."vnic-id"' --raw-output)
  PUBLIC_IP=$(oci network vnic get --vnic-id "$VNIC_ID" --query 'data."public-ip"' --raw-output)
  [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] || die "Instance has no public IP"
  save_state VNIC_ID "$VNIC_ID"
  save_state PUBLIC_IP "$PUBLIC_IP"
fi

log "Waiting for SSH on $PUBLIC_IP"
for _ in $(seq 1 60); do
  if ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 \
      -i "$SSH_KEY" "ubuntu@$PUBLIC_IP" true >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 \
  -i "$SSH_KEY" "ubuntu@$PUBLIC_IP" true >/dev/null 2>&1 || die "SSH did not become available"

log "Installing Docker and Git on Oracle VM"
ssh -i "$SSH_KEY" "ubuntu@$PUBLIC_IP" 'bash -s' <<'REMOTE'
set -euo pipefail
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi
sudo usermod -aG docker ubuntu
REMOTE

# Reconnect so the new docker group membership is active.
sleep 2

log "Deploying GeoAcademic open engine"
ssh -i "$SSH_KEY" "ubuntu@$PUBLIC_IP" 'bash -s' <<REMOTE
set -euo pipefail
if [ ! -d "\$HOME/research-pulse-global-f9b8742f/.git" ]; then
  git clone "$REPO_URL" "\$HOME/research-pulse-global-f9b8742f"
else
  cd "\$HOME/research-pulse-global-f9b8742f"
  git fetch origin main
  git checkout main
  git reset --hard origin/main
fi
cd "\$HOME/research-pulse-global-f9b8742f/open-engine"
cat > .env.oracle <<'ENVEOF'
API_DOMAIN=api.geoacademic.app
PUBLIC_CORS_ORIGINS=https://geoacademic.app
POSTGRES_DB=geoacademic
POSTGRES_USER=geoacademic
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
DB_POOL_MAX=12
S3_ENDPOINT=$S3_ENDPOINT
S3_ACCESS_KEY=$S3_ACCESS_KEY
S3_SECRET_KEY=$S3_SECRET_KEY
S3_BUCKET=$BUCKET_NAME
PUBLIC_SNAPSHOT_KEY=public/latest.json
SNAPSHOT_INTERVAL_SECONDS=900
INTERNAL_API_TOKEN=$INTERNAL_API_TOKEN
WORKER_CONCURRENCY=4
FETCH_TIMEOUT_SECONDS=25
SCHEDULER_INTERVAL_SECONDS=300
SCHEDULER_ENQUEUE_LIMIT=500
TASK_STALE_AFTER_MINUTES=30
VERIFY_INTERVAL_SECONDS=600
VERIFY_MIN_AGE_HOURS=6
VERIFY_LIMIT=500
VERIFY_MIN_CONFIDENCE=0.78
AI_FALLBACK_ENABLED=true
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
NVIDIA_API_KEY=
NVIDIA_MODEL=
ENVEOF
chmod 600 .env.oracle
chmod +x deploy-oracle.sh
./deploy-oracle.sh
REMOTE

log "Waiting for degraded-mode snapshot object"
for _ in $(seq 1 30); do
  if oci os object head --bucket-name "$BUCKET_NAME" --name public/latest.json >/dev/null 2>&1; then
    break
  fi
  sleep 10
done

if [ -z "${PUBLIC_SNAPSHOT_URL:-}" ]; then
  if oci os object head --bucket-name "$BUCKET_NAME" --name public/latest.json >/dev/null 2>&1; then
    log "Creating object-specific pre-authenticated snapshot URL"
    EXPIRY="2036-01-01T00:00:00Z"
    par_json=$(oci os preauth-request create \
      --bucket-name "$BUCKET_NAME" \
      --name geoacademic-public-latest \
      --access-type ObjectRead \
      --object-name public/latest.json \
      --time-expires "$EXPIRY")
    ACCESS_URI=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["access-uri"])' <<<"$par_json")
    PUBLIC_SNAPSHOT_URL="https://objectstorage.${REGION}.oraclecloud.com${ACCESS_URI}"
    save_state PUBLIC_SNAPSHOT_URL "$PUBLIC_SNAPSHOT_URL"
  fi
fi

cat <<EOF

============================================================
GeoAcademic Oracle bootstrap completed.
============================================================

Oracle VM public IP:
  $PUBLIC_IP

DNS record you still need to create at your domain/DNS provider:
  Type: A
  Name: api
  Value: $PUBLIC_IP

After DNS resolves, verify:
  https://api.geoacademic.app/health

Lovable environment variable after API verification:
  VITE_GEOACADEMIC_API_URL=https://api.geoacademic.app
EOF

if [ -n "${PUBLIC_SNAPSHOT_URL:-}" ]; then
  cat <<EOF

Lovable degraded-mode snapshot variable:
  VITE_GEOACADEMIC_SNAPSHOT_URL=$PUBLIC_SNAPSHOT_URL
EOF
fi

cat <<EOF

Secrets were written only to:
  $SECRET_FILE

Infrastructure state was written to:
  $STATE_FILE

Keep both Cloud Shell files private. Raw evidence remains in a private OCI bucket.
EOF

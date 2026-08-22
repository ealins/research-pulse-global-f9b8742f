#!/usr/bin/env bash
set -euo pipefail

# Resume a GeoAcademic bootstrap that stopped at OCI A1 "Out of host capacity".
# Reuses the VCN/subnet/image/SSH state already created by bootstrap-cloud-shell.sh.

STATE_DIR="${HOME}/.geoacademic"
STATE_FILE="${STATE_DIR}/oci-state.env"
SSH_KEY="${STATE_DIR}/geoacademic_oracle"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

[ -f "$STATE_FILE" ] || { echo "Missing $STATE_FILE. Run cloud-shell-env.sh first." >&2; exit 1; }
# shellcheck disable=SC1090
source "$STATE_FILE"

TENANCY_OCID="${TENANCY_OCID:-${OCI_TENANCY:-}}"
COMPARTMENT_OCID="${COMPARTMENT_OCID:-$TENANCY_OCID}"

[ -n "${TENANCY_OCID:-}" ] || { echo "Could not determine tenancy OCID." >&2; exit 1; }
[ -n "${SUBNET_ID:-}" ] || { echo "SUBNET_ID is missing from $STATE_FILE." >&2; exit 1; }
[ -n "${IMAGE_ID:-}" ] || { echo "IMAGE_ID is missing from $STATE_FILE." >&2; exit 1; }
[ -f "${SSH_KEY}.pub" ] || { echo "Missing ${SSH_KEY}.pub." >&2; exit 1; }

save_state() {
  local key="$1" value="$2"
  grep -v "^${key}=" "$STATE_FILE" > "${STATE_FILE}.tmp" || true
  printf '%s=%q\n' "$key" "$value" >> "${STATE_FILE}.tmp"
  mv "${STATE_FILE}.tmp" "$STATE_FILE"
  chmod 600 "$STATE_FILE"
}

if [ -n "${INSTANCE_ID:-}" ]; then
  echo "An Oracle instance is already recorded: $INSTANCE_ID"
  exec bash "$SCRIPT_DIR/cloud-shell-env.sh"
fi

mapfile -t ADS < <(
  oci iam availability-domain list \
    --compartment-id "$TENANCY_OCID" \
    --query 'data[].name' --raw-output \
  | tr -d '[],' | tr '"' '\n' \
  | sed '/^[[:space:]]*$/d;s/^[[:space:]]*//;s/[[:space:]]*$//'
)

[ "${#ADS[@]}" -gt 0 ] || { echo "No availability domains found." >&2; exit 1; }

# 1 OCPU / 6 GB remains inside Always Free A1 limits and is sufficient for
# GeoAcademic in low-concurrency mode. It can be resized to 2/12 later.
OCPUS="${A1_OCPUS:-1}"
MEMORY_GB="${A1_MEMORY_GB:-6}"
INSTANCE_NAME="${INSTANCE_NAME:-geoacademic-engine}"

printf 'Trying smaller Always Free A1 allocation: %s OCPU / %s GB RAM\n' "$OCPUS" "$MEMORY_GB"
last_error=""

for AD in "${ADS[@]}"; do
  echo "Trying availability domain: $AD"
  set +e
  output=$(oci compute instance launch \
    --compartment-id "$COMPARTMENT_OCID" \
    --availability-domain "$AD" \
    --subnet-id "$SUBNET_ID" \
    --display-name "$INSTANCE_NAME" \
    --shape VM.Standard.A1.Flex \
    --shape-config "{\"ocpus\":${OCPUS},\"memoryInGBs\":${MEMORY_GB}}" \
    --image-id "$IMAGE_ID" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "${SSH_KEY}.pub" \
    --wait-for-state RUNNING \
    --query 'data.id' --raw-output 2>&1)
  rc=$?
  set -e

  if [ "$rc" -eq 0 ]; then
    INSTANCE_ID="$output"
    save_state INSTANCE_ID "$INSTANCE_ID"
    save_state AVAILABILITY_DOMAIN "$AD"
    save_state INSTANCE_OCPUS "$OCPUS"
    save_state INSTANCE_MEMORY_GB "$MEMORY_GB"
    echo "Allocated A1 instance: $INSTANCE_ID"
    echo "Continuing GeoAcademic deployment..."
    exec bash "$SCRIPT_DIR/cloud-shell-env.sh"
  fi

  last_error="$output"
done

cat >&2 <<EOF
No A1 capacity was available even for ${OCPUS} OCPU / ${MEMORY_GB} GB RAM.
Your VCN, subnet, Object Storage bucket and credentials are preserved.
Oracle documents this as temporary capacity exhaustion; rerun this helper later.

Last OCI error:
$last_error
EOF
exit 3

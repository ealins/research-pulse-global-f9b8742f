#!/usr/bin/env bash
set -euo pipefail

# Normalize Oracle Cloud Shell identity variables for the main bootstrap.
# Oracle Cloud Shell exposes OCI_CS_USER_OCID / OCI_TENANCY / OCI_REGION.

if [ -z "${USER_OCID:-}" ]; then
  RAW_USER_OCID="${OCI_CS_USER_OCID:-${OCI_CLI_USER:-}}"
  if [[ "$RAW_USER_OCID" == ocid1.user.* ]]; then
    export USER_OCID="$RAW_USER_OCID"
  elif [ -n "$RAW_USER_OCID" ]; then
    echo "Cloud Shell identity is federated rather than a direct user OCID: $RAW_USER_OCID" >&2
    echo "Open OCI Console -> Profile -> User settings and copy the User OCID, then run:" >&2
    echo "  export USER_OCID='ocid1.user.oc1..YOUR_OCID'" >&2
    exit 2
  fi
fi

if [ -z "${TENANCY_OCID:-}" ] && [ -n "${OCI_TENANCY:-}" ]; then
  export TENANCY_OCID="$OCI_TENANCY"
fi

if [ -z "${OCI_REGION:-}" ] && [ -n "${OCI_CLI_REGION:-}" ]; then
  export OCI_REGION="$OCI_CLI_REGION"
fi

if [ -z "${USER_OCID:-}" ]; then
  echo "Could not determine USER_OCID automatically." >&2
  echo "Oracle Cloud Shell normally provides OCI_CS_USER_OCID." >&2
  echo "Check it with: echo \"$OCI_CS_USER_OCID\"" >&2
  exit 2
fi

# Oracle Cloud Shell may run with FIPS restrictions that reject ED25519 keys.
# Pre-create the deployment key as RSA-3072 so the main bootstrap can reuse it.
STATE_DIR="${HOME}/.geoacademic"
SSH_KEY="${STATE_DIR}/geoacademic_oracle"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

if [ ! -s "$SSH_KEY" ] || [ ! -s "${SSH_KEY}.pub" ]; then
  rm -f "$SSH_KEY" "${SSH_KEY}.pub"
  echo "==> Generating FIPS-compatible RSA deployment SSH key"
  ssh-keygen -q -t rsa -b 3072 -N '' -f "$SSH_KEY" -C geoacademic-oracle
  chmod 600 "$SSH_KEY"
  chmod 644 "${SSH_KEY}.pub"
fi

exec bash "$(dirname "$0")/bootstrap-cloud-shell.sh" "$@"

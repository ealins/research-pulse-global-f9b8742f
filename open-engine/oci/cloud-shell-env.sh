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

exec bash "$(dirname "$0")/bootstrap-cloud-shell.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

python /app/cloudrun/batch_runner.py "$@"
python /app/cloudrun/qa_database.py

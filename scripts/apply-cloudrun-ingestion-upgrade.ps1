# Applies the production Cloud Run ingestion upgrade using the authenticated gcloud CLI.
$ErrorActionPreference = "Stop"

$Project = "geoacademic-506304"
$Region = "europe-west3"
$Job = "geoacademic-ingestion"
$Scheduler = "geoacademic-ingestion-2h"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Image = "$Region-docker.pkg.dev/$Project/geoacademic/geoacademic-ingestion:latest"

function Invoke-Gcloud {
    param([Parameter(Mandatory=$true)][string[]]$Args)
    & gcloud @Args
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud failed (exit $LASTEXITCODE): gcloud $($Args -join ' ')"
    }
}

Write-Host "==> Checking gcloud authentication/project"
$activeProject = (& gcloud config get-value project 2>$null).Trim()
if ($activeProject -ne $Project) {
    throw "Active gcloud project is '$activeProject'. Expected '$Project'."
}

$account = (& gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null).Trim()
if (-not $account) {
    throw "No active gcloud account. Authenticate with gcloud before running this script."
}
Write-Host "Authenticated as: $account"

Write-Host "==> Exporting current Cloud Run job configuration"
& gcloud run jobs describe $Job --region=$Region --project=$Project --format=export |
    Set-Content -Encoding UTF8 "$RepoRoot/cloudrun-ingestion-live-before-upgrade.yaml"

Write-Host "==> Pausing the 2-hour scheduler during deployment"
Invoke-Gcloud @("scheduler","jobs","pause",$Scheduler,"--location=$Region","--project=$Project","--quiet")

try {
    Write-Host "==> Building the updated ingestion image"
    Invoke-Gcloud @(
        "builds","submit","$RepoRoot/open-engine",
        "--config","$RepoRoot/open-engine/cloudrun/cloudbuild-ingestion.yaml",
        "--substitutions","_IMAGE=$Image",
        "--project=$Project",
        "--quiet"
    )

    Write-Host "==> Updating Cloud Run: 2 vCPU / 2 GiB / concurrency 8 / 200+200+10"
    Invoke-Gcloud @(
        "run","jobs","update",$Job,
        "--image=$Image",
        "--region=$Region",
        "--project=$Project",
        "--update-env-vars","WORKER_CONCURRENCY=8",
        "--args=all,--max-fetch=200,--max-process=200,--max-ats-sources=10",
        "--cpu=2",
        "--memory=2Gi",
        "--tasks=1",
        "--quiet"
    )

    Write-Host "==> Executing one production verification run"
    Invoke-Gcloud @(
        "run","jobs","execute",$Job,
        "--region=$Region",
        "--project=$Project",
        "--wait"
    )
}
finally {
    Write-Host "==> Resuming the 2-hour scheduler"
    Invoke-Gcloud @("scheduler","jobs","resume",$Scheduler,"--location=$Region","--project=$Project","--quiet")
}

Write-Host "==> Final Cloud Run configuration"
Invoke-Gcloud @("run","jobs","describe",$Job,"--region=$Region","--project=$Project","--format=yaml")

Write-Host "==> Recent executions"
Invoke-Gcloud @("run","jobs","executions","list","--job=$Job","--region=$Region","--project=$Project","--limit=3")

Write-Host ""
Write-Host "Cloud Run ingestion upgrade completed."

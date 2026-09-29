$ErrorActionPreference = "Stop"

$Project = "geoacademic-506304"
$Region = "europe-west3"
$Job = "geoacademic-ingestion"
$OldScheduler = "geoacademic-ingestion-2h"
$Scheduler = "geoacademic-dispatcher-5m"
$Prefix = "geoacademic"
$Root = Split-Path -Parent $PSScriptRoot
$Image = "$Region-docker.pkg.dev/$Project/geoacademic/geoacademic-distributed:latest"
$OpenEngine = Join-Path $Root "open-engine"
$BuildConfig = Join-Path $OpenEngine "cloudrun/cloudbuild-distributed.yaml"
$Dockerfile = Join-Path $OpenEngine "cloudrun/Dockerfile.distributed"

function Assert-Prerequisites {
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
        throw "gcloud CLI was not found on PATH. Install Google Cloud CLI and restart PowerShell."
    }
    foreach ($path in @($OpenEngine, $BuildConfig, $Dockerfile)) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Required deployment path is missing: $path"
        }
    }
    $activeProject = (& gcloud config get-value project 2>$null).Trim()
    if ($activeProject -and $activeProject -ne $Project) {
        Write-Warning "gcloud active project is '$activeProject'; deployment will explicitly use '$Project'."
    }
}


function Invoke-Gcloud {
    param([string[]]$GcloudArgs)
    & gcloud @GcloudArgs
    if ($LASTEXITCODE -ne 0) { throw "gcloud failed: gcloud $($GcloudArgs -join ' ')" }
}

function Ensure-Sa {
    param([string]$Id,[string]$DisplayName)
    $email = "$Id@$Project.iam.gserviceaccount.com"
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & gcloud iam service-accounts describe $email --project=$Project 2>$null | Out-Null
    $exists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $old
    if (-not $exists) {
        Invoke-Gcloud @("iam","service-accounts","create",$Id,"--display-name=$DisplayName","--project=$Project")
    }
    return $email
}

function Runtime-Args {
    param([string[]]$RuntimeArgs)
    $jobJson = (& gcloud run jobs describe $Job --region=$Region --project=$Project --format=json 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $jobJson) {
        throw "Required legacy Cloud Run Job '$Job' was not found in project '$Project' / region '$Region'. It is used as the source of the runtime service account and Secret Manager environment bindings."
    }
    $job = ($jobJson -join [Environment]::NewLine) | ConvertFrom-Json
    $template = $job.template.template
    $runtime = [string]$template.serviceAccount
    if (-not $runtime) { $runtime = "geoacademic-run@$Project.iam.gserviceaccount.com" }
    $RuntimeArgs += "--service-account=$runtime"
    $container = @($template.containers)[0]
    $secretPairs = [System.Collections.Generic.List[string]]::new()
    foreach ($item in @($container.env)) {
        if ($null -ne $item.valueSource -and $null -ne $item.valueSource.secretKeyRef -and $item.valueSource.secretKeyRef.name) {
            $secretPairs.Add("$($item.name)=$($item.valueSource.secretKeyRef.name):latest")
        } elseif ($null -ne $item.value) {
            $RuntimeArgs += "--set-env-vars=$($item.name)=$($item.value)"
        }
    }
    if ($secretPairs.Count -gt 0) { $RuntimeArgs += "--set-secrets=$($secretPairs -join ",")" }
    return @{ Args=$RuntimeArgs; ServiceAccount=$runtime }
}

function Deploy-Service {
    param([string]$Name,[string]$Stage,[int]$Max,[int]$Concurrency,[string]$Extra,[string]$Module)
    $args = @(
        "run","deploy",$Name,
        "--image=$Image","--region=$Region","--project=$Project",
        "--port=8080","--cpu=2","--memory=2Gi","--timeout=900",
        "--concurrency=$Concurrency","--min=0","--max=$Max",
        "--no-allow-unauthenticated"
    )
    if ($Module) {
        $args += "--command=uvicorn"
        $args += "--args=$Module`:app,--host=0.0.0.0,--port=8080,--app-dir=/app/cloudrun"
    }
    $runtime = Runtime-Args -RuntimeArgs $args
    $args = $runtime.Args
    $args += "--set-env-vars=PUBSUB_PROJECT_ID=$Project"
    $args += "--set-env-vars=PUBSUB_TOPIC_PREFIX=$Prefix"
    if ($Stage) { $args += "--set-env-vars=WORKER_STAGE=$Stage" }
    if ($Extra) { $args += "--set-env-vars=$Extra" }
    Invoke-Gcloud -GcloudArgs $args
    return $runtime.ServiceAccount
}

Assert-Prerequisites

Write-Host "==> Building distributed image"
Invoke-Gcloud @(
    "builds","submit",$OpenEngine,
    "--config=$BuildConfig",
    "--substitutions=_IMAGE=$Image","--project=$Project","--quiet"
)

$runtimeSa = Deploy-Service -Name "geoacademic-dispatcher" -Stage "" -Max 3 -Concurrency 4 -Extra "DISPATCH_LIMIT=500,REVIEW_TICKS=4" -Module "distributed_dispatcher"
Deploy-Service -Name "geoacademic-fetch-worker" -Stage "FETCH" -Max 20 -Concurrency 8 -Extra "WORKER_CONCURRENCY=4" | Out-Null
Deploy-Service -Name "geoacademic-extract-worker" -Stage "EXTRACT" -Max 12 -Concurrency 4 -Extra "" | Out-Null
Deploy-Service -Name "geoacademic-review-worker" -Stage "REVIEW" -Max 8 -Concurrency 2 -Extra "REVIEW_LEASE_LIMIT=16,REVIEW_CONCURRENCY=8" | Out-Null

$pushSa = Ensure-Sa -Id "geoacademic-pubsub-invoker" -DisplayName "GeoAcademic Pub/Sub Cloud Run invoker"
$schedulerSa = Ensure-Sa -Id "geoacademic-dispatcher-scheduler" -DisplayName "GeoAcademic dispatcher scheduler"

$projectNumber = (& gcloud projects describe $Project --format="value(projectNumber)").Trim()
$pubsubAgent = "service-$projectNumber@gcp-sa-pubsub.iam.gserviceaccount.com"
Invoke-Gcloud @("projects","add-iam-policy-binding",$Project,"--member=serviceAccount:$runtimeSa","--role=roles/pubsub.publisher")
Invoke-Gcloud @("projects","add-iam-policy-binding",$Project,"--member=serviceAccount:$pubsubAgent","--role=roles/iam.serviceAccountTokenCreator")

foreach ($service in @("geoacademic-fetch-worker","geoacademic-extract-worker","geoacademic-review-worker")) {
    Invoke-Gcloud @(
        "run","services","add-iam-policy-binding",$service,
        "--region=$Region","--project=$Project",
        "--member=serviceAccount:$pushSa","--role=roles/run.invoker"
    )
}

function Ensure-Topic {
    param([string]$Name)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & gcloud pubsub topics describe $Name --project=$Project 2>$null | Out-Null
    $exists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $old
    if (-not $exists) { Invoke-Gcloud @("pubsub","topics","create",$Name,"--project=$Project") }
}

function Ensure-Subscription {
    param([string]$Name,[string]$Topic,[string]$Endpoint)
    $old = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & gcloud pubsub subscriptions describe $Name --project=$Project 2>$null | Out-Null
    $exists = ($LASTEXITCODE -eq 0)
    $ErrorActionPreference = $old
    $common = @(
        "--project=$Project","--push-endpoint=$Endpoint/pubsub",
        "--push-auth-service-account=$pushSa",
        "--push-auth-token-audience=$Endpoint",
        "--ack-deadline=600"
    )
    if (-not $exists) {
        Invoke-Gcloud (@("pubsub","subscriptions","create",$Name,"--topic=$Topic") + $common)
    } else {
        Invoke-Gcloud (@("pubsub","subscriptions","modify-push-config",$Name) + $common)
    }
}

foreach ($stage in @("fetch","extract","review")) {
    Ensure-Topic "$Prefix-$stage"
}

$fetchUrl = (& gcloud run services describe geoacademic-fetch-worker --region=$Region --project=$Project --format="value(status.url)").Trim()
$extractUrl = (& gcloud run services describe geoacademic-extract-worker --region=$Region --project=$Project --format="value(status.url)").Trim()
$reviewUrl = (& gcloud run services describe geoacademic-review-worker --region=$Region --project=$Project --format="value(status.url)").Trim()
$dispatcherUrl = (& gcloud run services describe geoacademic-dispatcher --region=$Region --project=$Project --format="value(status.url)").Trim()

Ensure-Subscription "$Prefix-fetch-sub" "$Prefix-fetch" $fetchUrl
Ensure-Subscription "$Prefix-extract-sub" "$Prefix-extract" $extractUrl
Ensure-Subscription "$Prefix-review-sub" "$Prefix-review" $reviewUrl

Invoke-Gcloud @(
    "run","services","add-iam-policy-binding","geoacademic-dispatcher",
    "--region=$Region","--project=$Project",
    "--member=serviceAccount:$schedulerSa","--role=roles/run.invoker"
)

$old = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& gcloud scheduler jobs describe $Scheduler --location=$Region --project=$Project 2>$null | Out-Null
$exists = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = $old

$schedArgs = @(
    "--location=$Region","--project=$Project",
    "--schedule=*/5 * * * *","--uri=$dispatcherUrl/tick",
    "--http-method=POST","--oidc-service-account-email=$schedulerSa",
    "--oidc-token-audience=$dispatcherUrl","--attempt-deadline=540s"
)
if ($exists) {
    Invoke-Gcloud (@("scheduler","jobs","update","http",$Scheduler) + $schedArgs)
} else {
    Invoke-Gcloud (@("scheduler","jobs","create","http",$Scheduler) + $schedArgs)
}

Write-Host "==> Pausing the old monolithic scheduler"
Invoke-Gcloud @("scheduler","jobs","pause",$OldScheduler,"--location=$Region","--project=$Project","--quiet")

Write-Host "Distributed ingestion deployment complete."
Write-Host "Dispatcher: $dispatcherUrl"
Write-Host "Fetch:      $fetchUrl"
Write-Host "Extract:    $extractUrl"
Write-Host "Review:     $reviewUrl"

<#
.SYNOPSIS
    Assemble a clean Hugging Face Space folder for the SIARA Flask ML service.

.DESCRIPTION
    Copies ONLY the Python ML service + the model artifacts it actually loads
    (no Node backend code, no secrets, no redundant model copies) into an output
    folder, together with the Dockerfile / README.md / .dockerignore /
    .gitattributes / .gitignore from this directory. The result is ready to push
    to a Hugging Face Docker Space, or to `docker build` locally.

.PARAMETER OutDir
    Destination folder. Default: <this dir>\space-build

.PARAMETER IncludeSpamModel
    Phase 2: also copy best_fakeddit_model.pt if it exists (and you must then add
    torch/CLIP to requirements.txt and drop the *.pt rule from .dockerignore).

.EXAMPLE
    pwsh ./assemble-space.ps1
    cd space-build
    docker build -t siara-ml .
    docker run --rm -p 8000:8000 siara-ml
#>
[CmdletBinding()]
param(
    [string]$OutDir,
    [switch]$IncludeSpamModel
)

$ErrorActionPreference = 'Stop'
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Definition }
if (-not $OutDir) { $OutDir = Join-Path $ScriptDir 'space-build' }
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir '..\..')).Path
$Api = Join-Path $RepoRoot 'api'

if (-not (Test-Path $Api)) { throw "Cannot find api/ at $Api" }

Write-Host "Repo root : $RepoRoot"
Write-Host "API dir   : $Api"
Write-Host "Output    : $OutDir"
Write-Host ''

# --- Files the ML service needs at runtime (paths relative to api/) ---
$mlFiles = @(
    'requirements.txt',
    'contollers/Model/ml_service.py',
    'services/__init__.py',
    'services/quiz_explainer.py',
    'anomaly-detection/report_spam_model.py',
    'anomaly-detection/report_validator.py',
    'anomaly-detection/SiaraSentinelDZ_v2.joblib',
    'anomaly-detection/report_validator_model.joblib',
    'anomaly-detection/report_validator_metadata.json',
    'driver-quiz-model/driver_model.joblib',
    'driver-quiz-model/driver_model_raw.joblib',
    'driver-quiz-model/metadata.json',
    'siara_multiclass_severity_artifacts_fixed/base_lightgbm_multiclass.joblib',
    'siara_multiclass_severity_artifacts_fixed/siara_multiclass_severity_metadata.json',
    'danger-zone-model/siara_v1_artifacts/siara_severe_metadata.json',
    'occurrence-model/occurrence_betav1_final/calibrator.joblib',
    'occurrence-model/occurrence_betav1_final/feature_list.json',
    'occurrence-model/occurrence_betav1_final/metrics.json',
    'occurrence-model/occurrence_betav1_final/training_manifest.json',
    'occurrence-model/occurrence_betav1_final/shap_top_features.csv',
    'occurrence-model/occurrence_betav1_final/feature_importance.csv'
)

# --- Deployment files shipped from THIS directory ---
$deployFiles = @('Dockerfile', '.dockerignore', 'README.md', '.gitattributes', '.gitignore')

# Fresh output dir
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Copy-Into {
    param([string]$SrcRoot, [string]$Rel, [string]$DstRoot)
    $src = Join-Path $SrcRoot $Rel
    if (-not (Test-Path $src)) { return $false }
    $dst = Join-Path $DstRoot $Rel
    $dstParent = Split-Path $dst -Parent
    if (-not (Test-Path $dstParent)) { New-Item -ItemType Directory -Force -Path $dstParent | Out-Null }
    Copy-Item -LiteralPath $src -Destination $dst -Force
    return $true
}

$missing = @()
$copied = 0
foreach ($rel in $mlFiles) {
    if (Copy-Into -SrcRoot $Api -Rel $rel -DstRoot $OutDir) {
        $copied++
        Write-Host "  + $rel"
    } else {
        $missing += $rel
        Write-Warning "  MISSING: api/$rel"
    }
}

foreach ($f in $deployFiles) {
    if (Copy-Into -SrcRoot $ScriptDir -Rel $f -DstRoot $OutDir) {
        Write-Host "  + $f (deploy)"
    } else {
        Write-Warning "  MISSING deploy file: $f"
    }
}

# Phase 2: optional spam-model weights
$pt = 'anomaly-detection/best_fakeddit_model.pt'
if ($IncludeSpamModel) {
    if (Copy-Into -SrcRoot $Api -Rel $pt -DstRoot $OutDir) {
        Write-Host "  + $pt (Phase 2 weights)"
        Write-Warning "Phase 2: add torch/CLIP/Pillow to requirements.txt and remove the *.pt rule from .dockerignore before building."
    } else {
        Write-Warning "  -IncludeSpamModel set but api/$pt not found; skipping."
    }
}

Write-Host ''
Write-Host "Assembled $copied/$($mlFiles.Count) ML files into $OutDir"
if ($missing.Count -gt 0) {
    Write-Warning "The following MANDATORY-or-optional files were missing:"
    $missing | ForEach-Object { Write-Warning "    api/$_" }
    Write-Warning "Mandatory ones (driver_model*.joblib, metadata.json, base_lightgbm_multiclass.joblib, siara_multiclass_severity_metadata.json) MUST exist or the service will not start."
}
Write-Host ''
Write-Host "Next:"
Write-Host "  cd `"$OutDir`""
Write-Host "  docker build -t siara-ml ."
Write-Host "  docker run --rm -p 8000:8000 siara-ml"

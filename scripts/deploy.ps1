param([switch]$BuildOnly,[switch]$SkipInstall)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    if (-not $SkipInstall) { npm ci --no-audit --no-fund; if($LASTEXITCODE -ne 0){throw 'npm ci failed'} }
    npm run check; if($LASTEXITCODE -ne 0){throw 'Game check failed'}
    npm test; if($LASTEXITCODE -ne 0){throw 'Game tests failed'}
    npm run build; if($LASTEXITCODE -ne 0){throw 'Game build failed'}
    npm run audit:secrets; if($LASTEXITCODE -ne 0){throw 'Credentials audit failed'}
    $python=Join-Path $root '.venv/Scripts/python.exe'
    if(-not(Test-Path -LiteralPath $python)){throw 'Run python -m venv .venv and install requirements.txt first.'}
    & $python -m unittest discover -s tests -p test_*.py; if($LASTEXITCODE -ne 0){throw 'Deployment tests failed'}
    if($BuildOnly){Write-Host 'Build-only complete; no remote connection.';return}
    & $python (Join-Path $root 'scripts/deploy.py'); if($LASTEXITCODE -ne 0){throw 'Deployment failed'}
} finally {Pop-Location}

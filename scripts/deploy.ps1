param([Alias('Game')][string]$Games='all',[switch]$BuildOnly,[switch]$SkipInstall)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
 if(-not $SkipInstall){npm ci --no-audit --no-fund;if($LASTEXITCODE -ne 0){throw 'npm ci failed'}}
 npm run check;if($LASTEXITCODE -ne 0){throw 'Game checks failed'}
 npm test;if($LASTEXITCODE -ne 0){throw 'Game tests failed'}
 npm run build -- --games $Games;if($LASTEXITCODE -ne 0){throw 'Build failed'}
 npm run audit:secrets;if($LASTEXITCODE -ne 0){throw 'Credential audit failed'}
 $python=Join-Path $root '.venv/Scripts/python.exe'
 if(-not(Test-Path -LiteralPath $python)){throw 'Prepare .venv and requirements.txt first.'}
 & $python -m unittest discover -s tests -p test_*.py;if($LASTEXITCODE -ne 0){throw 'Deployment tests failed'}
 if($BuildOnly){Write-Host 'Local gates passed; no remote connection.';return}
 & $python scripts/deploy.py --games $Games;if($LASTEXITCODE -ne 0){throw 'Deploy failed'}
}finally{Pop-Location}

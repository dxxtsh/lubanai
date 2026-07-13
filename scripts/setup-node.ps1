param(
    [string]$TargetDir
)

if (-not $TargetDir) {
    Write-Error "Usage: setup-node.ps1 -TargetDir <path>"
    exit 1
}

# Ensure TargetDir uses proper separators
$TargetDir = $TargetDir.Replace('/', '\')

Write-Host "   Fetching latest Node.js LTS version..."

try {
    # Get latest LTS version info
    $json = Invoke-RestMethod "https://nodejs.org/dist/index.json"
    $lts = $json | Where-Object { $_.lts } | Select-Object -First 1
    if (-not $lts) {
        Write-Error "Cannot find LTS version in Node.js release index"
        exit 1
    }

    $ver = $lts.version
    Write-Host "   Latest LTS: $ver"

    $url = "https://nodejs.org/dist/$ver/node-$ver-win-x64.zip"
    $zip = Join-Path $env:TEMP "node-setup.zip"

    Write-Host "   Downloading..."
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

    Write-Host "   Extracting..."
    # Clean up existing runtime
    if (Test-Path $TargetDir) {
        Remove-Item -Recurse -Force $TargetDir -ErrorAction Stop
    }
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

    # Extract
    $extractDir = Join-Path $env:TEMP "node-extract"
    if (Test-Path $extractDir) {
        Remove-Item -Recurse -Force $extractDir -ErrorAction Stop
    }
    Expand-Archive -Path $zip -DestinationPath $extractDir -Force

    $extracted = Get-ChildItem $extractDir -Directory | Select-Object -First 1
    if (-not $extracted) {
        Write-Error "Extraction failed: no directory found in zip"
        exit 1
    }

    # Copy all files to runtime directory
    Copy-Item -Recurse -Force "$($extracted.FullName)\*" $TargetDir

    # Cleanup temp
    Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
    Remove-Item -Force $zip -ErrorAction SilentlyContinue

    if (Test-Path (Join-Path $TargetDir "node.exe")) {
        Write-Host "   [OK] Node.js installed"
    } else {
        Write-Error "node.exe not found after extraction"
        exit 1
    }
} catch {
    Write-Error "Failed: $_"
    exit 1
}

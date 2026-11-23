param(
    [string]$TargetDir
)

if (-not $TargetDir) {
    Write-Error "Usage: setup-node.ps1 -TargetDir <path>"
    exit 1
}

# Ensure TargetDir uses proper separators
$TargetDir = $TargetDir.Replace('/', '\')

$ver = "v24.15.0"
Write-Host "   Using pinned Node.js version: $ver"

try {
    $url = "https://npmmirror.com/mirrors/node/$ver/node-$ver-win-x64.zip"
    $zip = Join-Path $env:TEMP "node-setup.zip"

    Write-Host "   Downloading from mirror: $url..."
    if (Test-Path $zip) {
        Remove-Item -Force $zip -ErrorAction SilentlyContinue
    }
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

    Write-Host "   Verifying archive integrity..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zipArchive = [System.IO.Compression.ZipFile]::OpenRead($zip)
    $hasNodeExe = $false
    foreach ($entry in $zipArchive.Entries) {
        if ($entry.Name -eq "node.exe") {
            $hasNodeExe = $true
            break
        }
    }
    $zipArchive.Dispose()

    if (-not $hasNodeExe) {
        Write-Error "Downloaded archive is corrupted or missing node.exe"
        if (Test-Path $zip) { Remove-Item -Force $zip -ErrorAction SilentlyContinue }
        exit 1
    }

    Write-Host "   Extracting..."
    # Only clean up existing runtime after download & verification succeed
    if (Test-Path $TargetDir) {
        Remove-Item -Recurse -Force $TargetDir -ErrorAction Stop
    }
    New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

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
        Write-Host "   [OK] Node.js $ver installed successfully"
    } else {
        Write-Error "node.exe not found after extraction"
        exit 1
    }
} catch {
    Write-Error "Failed: $_"
    exit 1
}

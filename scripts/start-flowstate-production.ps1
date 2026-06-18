param(
  [int]$Port = 3002,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Logs = Join-Path $Root "logs"
$PidFile = Join-Path $Logs "flowstate-server.pid"
$OutLog = Join-Path $Logs "flowstate-server.out.log"
$ErrLog = Join-Path $Logs "flowstate-server.err.log"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

function Get-LiveProcessFromPidFile {
  if (!(Test-Path $PidFile)) {
    return $null
  }

  $rawPid = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (!$rawPid) {
    return $null
  }

  try {
    return Get-Process -Id ([int]$rawPid) -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-ListeningPid {
  param([int]$ListeningPort)

  $pattern = "\sTCP\s+\S+:$ListeningPort\s+\S+\s+LISTENING\s+(\d+)"
  $line = netstat -ano | Select-String -Pattern $pattern | Select-Object -First 1
  if ($line -and $line.Matches.Count -gt 0) {
    return [int]$line.Matches[0].Groups[1].Value
  }

  return $null
}

$existing = Get-LiveProcessFromPidFile
if ($existing) {
  Write-Host "FlowState is already running on http://127.0.0.1:$Port (PID $($existing.Id))."
  Write-Host "Logs: $OutLog"
  exit 0
}

try {
  $existingHealth = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 2
  if ($existingHealth.StatusCode -ge 200 -and $existingHealth.StatusCode -lt 500) {
    $existingPid = Get-ListeningPid -ListeningPort $Port
    if ($existingPid) {
      Set-Content -Path $PidFile -Value $existingPid
      Write-Host "FlowState is already running on http://127.0.0.1:$Port (PID $existingPid)."
      Write-Host "Logs: $OutLog"
    } else {
      Write-Host "FlowState is already serving on http://127.0.0.1:$Port."
    }
    exit 0
  }
} catch {
  # Nothing healthy is listening on this port, so this launcher can start it.
}

Push-Location $Root
try {
  if (!$SkipBuild) {
    Write-Host "Building FlowState frontend for production..."
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend build failed with exit code $LASTEXITCODE."
    }

    Write-Host "Building FlowState server for production..."
    npm.cmd run build:server
    if ($LASTEXITCODE -ne 0) {
      throw "Server build failed with exit code $LASTEXITCODE."
    }
  }

  Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue

  Write-Host "Starting FlowState in the background..."
  $serverCommand = "cd /d `"$($Root.Path)`" && set NODE_ENV=production&& set PORT=$Port&& node dist-server\server.js > `"$OutLog`" 2> `"$ErrLog`""
  & $env:ComSpec /c start "FlowState" /min cmd.exe /c $serverCommand

  $healthy = $false
  try {
    for ($i = 0; $i -lt 20; $i++) {
      Start-Sleep -Seconds 1
      try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 3
        if ($health.StatusCode -ge 200 -and $health.StatusCode -lt 500) {
          $healthy = $true
          break
        }
      } catch {
        # Keep waiting until the server finishes booting.
      }
    }
  } catch {}

  $processId = Get-ListeningPid -ListeningPort $Port
  if ($processId) {
    Set-Content -Path $PidFile -Value $processId
  }

  if ($healthy) {
    Write-Host "FlowState is running: http://127.0.0.1:$Port"
  } else {
    Write-Host "FlowState launch command was sent, but health check is not ready yet."
  }

  if ($processId) {
    Write-Host "PID: $processId"
  }
  Write-Host "Logs: $OutLog"
  Write-Host "Errors: $ErrLog"
} finally {
  Pop-Location
}

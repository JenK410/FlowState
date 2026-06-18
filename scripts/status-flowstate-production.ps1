param(
  [int]$Port = 3002
)

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Logs = Join-Path $Root "logs"
$PidFile = Join-Path $Logs "flowstate-server.pid"
$TunnelPidFile = Join-Path $Logs "flowstate-public-tunnel.pid"

function Get-PidStatus {
  param([string]$Path)

  if (!(Test-Path $Path)) {
    return $null
  }

  $rawPid = (Get-Content -Path $Path -ErrorAction SilentlyContinue | Select-Object -First 1)
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

$server = Get-PidStatus -Path $PidFile
if ($server) {
  Write-Host "FlowState server: running (PID $($server.Id))"
  Write-Host "Local URL: http://127.0.0.1:$Port"
} else {
  $listenerPid = Get-ListeningPid -ListeningPort $Port
  if ($listenerPid) {
    Set-Content -Path $PidFile -Value $listenerPid
    Write-Host "FlowState server: running (PID $listenerPid)"
    Write-Host "Local URL: http://127.0.0.1:$Port"
  } else {
    Write-Host "FlowState server: not running from this launcher"
  }
}

try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/health" -UseBasicParsing -TimeoutSec 5
  Write-Host "Health check: HTTP $($health.StatusCode)"
} catch {
  Write-Host "Health check: unavailable"
}

$tunnel = Get-PidStatus -Path $TunnelPidFile
if ($tunnel) {
  Write-Host "Public tunnel: running (PID $($tunnel.Id))"
  $TunnelLog = Join-Path $Logs "flowstate-public-tunnel.out.log"
  if (Test-Path $TunnelLog) {
    $url = Select-String -Path $TunnelLog -Pattern "https://[^\s]+" | Select-Object -Last 1
    if ($url) {
      Write-Host "Latest public URL: $($url.Matches[0].Value)"
    } else {
      Write-Host "Public URL: still starting; check $TunnelLog"
    }
  }
} else {
  Write-Host "Public tunnel: not running from this launcher"
}

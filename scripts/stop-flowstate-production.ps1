param(
  [int]$Port = 3002,
  [switch]$IncludeTunnel
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Logs = Join-Path $Root "logs"
$PidFile = Join-Path $Logs "flowstate-server.pid"
$TunnelPidFile = Join-Path $Logs "flowstate-public-tunnel.pid"

function Stop-FromPidFile {
  param(
    [string]$Path,
    [string]$Name
  )

  if (!(Test-Path $Path)) {
    Write-Host "$Name is not running from this launcher."
    return
  }

  $rawPid = (Get-Content -Path $Path -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (!$rawPid) {
    Remove-Item -Path $Path -Force -ErrorAction SilentlyContinue
    Write-Host "$Name did not have a valid PID file."
    return
  }

  try {
    $process = Get-Process -Id ([int]$rawPid) -ErrorAction Stop
    Stop-Process -Id $process.Id -Force
    Write-Host "Stopped $Name (PID $($process.Id))."
  } catch {
    Write-Host "$Name was not running."
  }

  Remove-Item -Path $Path -Force -ErrorAction SilentlyContinue
}

function Stop-ListenerOnPort {
  param([int]$ListeningPort)

  $pattern = "\sTCP\s+\S+:$ListeningPort\s+\S+\s+LISTENING\s+(\d+)"
  $line = netstat -ano | Select-String -Pattern $pattern | Select-Object -First 1
  if (!$line -or $line.Matches.Count -eq 0) {
    return
  }

  $listenerPid = [int]$line.Matches[0].Groups[1].Value
  try {
    Stop-Process -Id $listenerPid -Force
    Write-Host "Stopped listener on port $ListeningPort (PID $listenerPid)."
  } catch {
    Write-Host "Could not stop listener on port $ListeningPort (PID $listenerPid)."
  }
}

if ($IncludeTunnel) {
  Stop-FromPidFile -Path $TunnelPidFile -Name "FlowState public tunnel"
}

Stop-FromPidFile -Path $PidFile -Name "FlowState server"
Stop-ListenerOnPort -ListeningPort $Port

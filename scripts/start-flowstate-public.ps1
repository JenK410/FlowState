param(
  [int]$Port = 3002
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Logs = Join-Path $Root "logs"
$TunnelPidFile = Join-Path $Logs "flowstate-public-tunnel.pid"
$TunnelOutLog = Join-Path $Logs "flowstate-public-tunnel.out.log"
$TunnelErrLog = Join-Path $Logs "flowstate-public-tunnel.err.log"

New-Item -ItemType Directory -Force -Path $Logs | Out-Null

& (Join-Path $PSScriptRoot "start-flowstate-production.ps1") -Port $Port

if (Test-Path $TunnelPidFile) {
  $rawPid = Get-Content -Path $TunnelPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($rawPid) {
    try {
      $existing = Get-Process -Id ([int]$rawPid) -ErrorAction Stop
      Write-Host "Public tunnel is already running (PID $($existing.Id))."
      exit 0
    } catch {
      Remove-Item -Path $TunnelPidFile -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host "Starting public tunnel in the background..."
$tunnelCommand = "cd /d `"$($Root.Path)`" && npx.cmd localtunnel --port $Port > `"$TunnelOutLog`" 2> `"$TunnelErrLog`""
& $env:ComSpec /c start "FlowState Public Tunnel" /min cmd.exe /c $tunnelCommand
Write-Host "Tunnel logs: $TunnelOutLog"

for ($i = 0; $i -lt 20; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $TunnelOutLog) {
    $url = Select-String -Path $TunnelOutLog -Pattern "https://[^\s]+" | Select-Object -Last 1
    if ($url) {
      Write-Host "Public URL: $($url.Matches[0].Value)"
      exit 0
    }
  }
}

Write-Host "Public tunnel is still starting. Run npm run status:background to see the latest URL."

$ErrorActionPreference = "Stop"
$bin = "D:\Tools\pgsql\bin"
$data = "D:\PostgresData\phantom-trace"
$log = Join-Path $data "server.log"

if (-not (Test-Path (Join-Path $bin "pg_ctl.exe"))) {
  throw "PostgreSQL binaries were not found at $bin"
}
if (-not (Test-Path $data)) {
  throw "Database data directory was not initialized at $data"
}

& (Join-Path $bin "pg_ctl.exe") -D $data status *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "PHANTOM TRACE database is already running on 127.0.0.1:54329"
  exit 0
}

& (Join-Path $bin "pg_ctl.exe") -D $data -l $log -o "-p 54329 -h 127.0.0.1" -w start
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "PHANTOM TRACE database started on 127.0.0.1:54329"

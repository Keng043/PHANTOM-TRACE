$ErrorActionPreference = "Stop"
$bin = "D:\Tools\pgsql\bin"
$data = "D:\PostgresData\phantom-trace"
& (Join-Path $bin "pg_ctl.exe") -D $data -m fast -w stop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "PHANTOM TRACE database stopped."

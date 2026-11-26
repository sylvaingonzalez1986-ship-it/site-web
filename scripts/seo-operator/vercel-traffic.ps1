[CmdletBinding()]
param(
    [ValidateSet('Refresh', 'RefreshIfDue', 'Report', 'Status')]
    [string]$Action = 'Report',
    [string]$StateDir = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LCB\SeoOperator\state'),
    [string]$ConfigPath,
    [string]$Node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'
if (-not $ConfigPath) { $ConfigPath = Join-Path $PSScriptRoot 'vercel-traffic.json' }
Add-Type -AssemblyName System.Security
$protection = [Security.Cryptography.DataProtectionScope]::CurrentUser
$statePath = Join-Path $StateDir 'vercel-traffic.dpapi'

function Read-TrafficState {
    if (-not (Test-Path -LiteralPath $statePath)) { return $null }
    $cipher = [IO.File]::ReadAllBytes($statePath)
    $bytes = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, $protection)
    return ([Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json)
}

function Write-TrafficState($State) {
    $plain = [Text.Encoding]::UTF8.GetBytes(($State | ConvertTo-Json -Depth 14 -Compress))
    $cipher = [Security.Cryptography.ProtectedData]::Protect($plain, $null, $protection)
    $temporary = "$statePath.$([Guid]::NewGuid().ToString('N')).tmp"
    $backup = "$temporary.bak"
    try {
        [IO.File]::WriteAllBytes($temporary, $cipher)
        if (Test-Path -LiteralPath $statePath) { [IO.File]::Replace($temporary, $statePath, $backup) }
        else { [IO.File]::Move($temporary, $statePath) }
    } finally {
        foreach ($path in $temporary, $backup) {
            if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
        }
    }
}

function Show-Report($Report) {
    if (-not $Report) { Write-Output 'Vercel Web Analytics - agrégats indisponibles.'; return }
    if ($Json) { $Report | ConvertTo-Json -Depth 14; return }
    Write-Output 'Vercel Web Analytics - production (UTC)'
    foreach ($key in 'last28', 'previous28', 'baseline90') {
        $item = $Report.periods.$key
        $label = @{ last28 = '28 jours'; previous28 = '28 jours précédents'; baseline90 = '90 jours' }[$key]
        if ($item.total) {
            Write-Output ("{0} ({1} au {2}) - {3} pages vues, {4} visiteurs estimés." -f $label, $item.from.Substring(0,10),
                $item.through.Substring(0,10), $item.total.pageviews, $item.total.visitors)
        }
    }
    $hosts = @($Report.periods.last28.references | Sort-Object pageviews -Descending | Select-Object -First 4)
    foreach ($item in $hosts) { Write-Output ("- {0} - {1} pages vues avec ce référent." -f $item.hostname, $item.pageviews) }
    Write-Output 'Les référents indiquent une arrivée déclarée par le navigateur.'
}

$stage = 'read'
try {
    if ($Action -in 'Report', 'Status') {
        $record = Read-TrafficState
        if ($Action -eq 'Report') { Show-Report $record.report }
        else { [ordered]@{ vercelTraffic = $record.status; slot = $record.slot; attempts = $record.attempts; fetchedAt = $record.report.collectedAt } | ConvertTo-Json -Compress }
        return
    }
    $paris = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'Romance Standard Time')
    $monday = $paris.Date.AddDays(-((( [int]$paris.DayOfWeek ) + 6) % 7))
    if ($Action -eq 'RefreshIfDue' -and $paris.Date -eq $monday -and $paris.TimeOfDay -lt [TimeSpan]'07:30') { return }
    $slot = $monday.ToString('yyyy-MM-dd')
    $stage = 'prepare'
    New-Item -ItemType Directory -Path $StateDir -Force | Out-Null
    $modeFile = Join-Path $StateDir 'mode.json'
    if ((Test-Path -LiteralPath $modeFile) -and ((Get-Content -LiteralPath $modeFile -Raw | ConvertFrom-Json).mode -ne 'active')) { return }
    try {
        $lease = [IO.File]::Open((Join-Path $StateDir 'vercel-traffic.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] { return }
    try {
        $previous = Read-TrafficState
        if ($previous.slot -eq $slot -and ($previous.status -eq 'completed' -or $previous.attempts -ge 2)) { return }
        $attempts = if ($previous.slot -eq $slot) { $previous.attempts + 1 } else { 1 }
        $record = [ordered]@{ slot = $slot; status = 'running'; attempts = $attempts; report = $previous.report }
        Write-TrafficState $record
        $stage = 'aggregate'
        $runner = Join-Path $PSScriptRoot 'vercel-traffic.mjs'
        $ErrorActionPreference = 'Continue'
        try { $raw = (& $Node $runner $ConfigPath 2>$null | Out-String).Trim() }
        finally { $ErrorActionPreference = 'Stop' }
        if ($LASTEXITCODE -ne 0 -or -not $raw) {
            $record.status = 'unavailable'
            Write-TrafficState $record
            throw 'Vercel traffic unavailable'
        }
        $record.report = $raw | ConvertFrom-Json
        $record.status = 'completed'
        $stage = 'save'
        Write-TrafficState $record
    } finally { $lease.Dispose() }
} catch {
    Write-Error "Vercel traffic report unavailable ($stage)." -ErrorAction Continue
    exit 1
}

[CmdletBinding()]
param(
    [ValidateSet('Install', 'Status', 'Report', 'Tick', 'Pause', 'Resume', 'Stop', 'Start', 'VercelRefresh', 'VercelReport')]
    [string]$Action = 'Status',
    [ValidateSet('daily', 'weekly', 'monthly')]
    [string]$Cadence = 'daily',
    [switch]$Json,
    [string]$InstallRoot = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LCB\SeoOperator'),
    [switch]$EnableCodexDrafts,
    [switch]$EnableVercelTraffic,
    [string]$VercelRepositoryLink
)

$ErrorActionPreference = 'Stop'
$taskName = 'LCB SEO Operator'
$install = [IO.Path]::GetFullPath($InstallRoot)
$bin = Join-Path $install 'bin'
$state = Join-Path $install 'state'
$operator = Join-Path $bin 'operator.mjs'
$backlog = Join-Path $bin 'backlog.json'
$traffic = Join-Path $bin 'vercel-traffic.ps1'
$trafficConfig = Join-Path $bin 'vercel-traffic.json'
$sourceBacklog = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'docs\seo-operator\backlog.json'
$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
$power = (Get-Command powershell.exe -CommandType Application).Source

function Quote-PowerShell([string]$Literal) {
    return "'" + $Literal.Replace("'", "''") + "'"
}

function Invoke-Operator([string]$Command) {
    & $node $operator $Command --state-dir $state
    if ($LASTEXITCODE -ne 0) { throw "SEO operator returned exit code $LASTEXITCODE" }
}

function Invoke-Traffic([string]$Command) {
    if (-not (Test-Path -LiteralPath $traffic)) { throw 'Vercel traffic is not installed.' }
    $trafficArguments = @('-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-File', $traffic,
        '-Action', $Command, '-StateDir', $state, '-Node', $node)
    if ($Json -and $Command -eq 'Report') { $trafficArguments += '-Json' }
    & $power @trafficArguments
    if ($LASTEXITCODE -ne 0) { throw "Vercel traffic returned exit code $LASTEXITCODE" }
}

if ($Action -eq 'Install') {
    $sources = [ordered]@{
        'operator.mjs' = (Join-Path $PSScriptRoot 'operator.mjs')
        'crawl.mjs' = (Join-Path $PSScriptRoot 'crawl.mjs')
        'draft.mjs' = (Join-Path $PSScriptRoot 'draft.mjs')
        'backlog.json' = $sourceBacklog
    }
    $codexArgument = ''
    if ($EnableCodexDrafts) {
        $codex = (Get-Command codex.exe -CommandType Application | Select-Object -First 1).Source
        $ErrorActionPreference = 'Continue'
        try { $login = (& $codex login status 2>&1 | Out-String) }
        finally { $ErrorActionPreference = 'Stop' }
        if ($LASTEXITCODE -ne 0 -or $login -notmatch 'Logged in using ChatGPT') { throw 'Authenticated ChatGPT CLI required for drafts.' }
        $codexArgument = ' --codex-exe ' + (Quote-PowerShell $codex)
    }
    New-Item -ItemType Directory -Path $bin, $state -Force | Out-Null
    $trafficLaunch = @()
    if ($EnableVercelTraffic) {
        if (-not $VercelRepositoryLink) { throw 'Specify the existing linked Vercel repository file.' }
        $link = Get-Content -LiteralPath $VercelRepositoryLink -Raw -Encoding UTF8 | ConvertFrom-Json
        $projects = @($link.projects | Where-Object { $_.directory -in '.', './', '' })
        if ($projects.Count -ne 1 -or $projects[0].id -notmatch '^prj_[a-zA-Z0-9]+$' -or $projects[0].orgId -notmatch '^team_[a-zA-Z0-9]+$') {
            throw 'A single linked Vercel root project is required.'
        }
        $npmCache = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'npm-cache\_npx'
        $package = Get-ChildItem -LiteralPath $npmCache -Directory | ForEach-Object {
            $manifest = Join-Path $_.FullName 'node_modules\vercel\package.json'
            if (Test-Path -LiteralPath $manifest) { Get-Item -LiteralPath $manifest }
        } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $package) { throw 'Install requires an existing Vercel CLI package.' }
        $manifest = Get-Content -LiteralPath $package.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($manifest.name -ne 'vercel' -or -not $manifest.bin.vercel) { throw 'Invalid Vercel CLI package.' }
        $cli = [IO.Path]::GetFullPath((Join-Path $package.DirectoryName $manifest.bin.vercel))
        $insidePackage = $cli.StartsWith(($package.DirectoryName + [IO.Path]::DirectorySeparatorChar), [StringComparison]::OrdinalIgnoreCase)
        if (-not $insidePackage -or -not (Test-Path -LiteralPath $cli -PathType Leaf)) { throw 'Vercel CLI executable not found.' }
        @{ cli = $cli; projectId = $projects[0].id; teamId = $projects[0].orgId } | ConvertTo-Json -Compress |
            Set-Content -LiteralPath $trafficConfig -Encoding UTF8
        $sources['vercel-traffic.ps1'] = Join-Path $PSScriptRoot 'vercel-traffic.ps1'
        $sources['vercel-traffic.mjs'] = Join-Path $PSScriptRoot 'vercel-traffic.mjs'
        $trafficCommand = '& ' + (Quote-PowerShell $power) + ' -NoProfile -NonInteractive -WindowStyle Hidden -File ' + (Quote-PowerShell $traffic)
        $trafficCommand += ' -Action RefreshIfDue -StateDir ' + (Quote-PowerShell $state) + ' -Node ' + (Quote-PowerShell $node)
        $trafficLaunch = @(
            '$operatorExit = $LASTEXITCODE'
            $trafficCommand
            'if ($operatorExit -ne 0) { exit $operatorExit }'
        )
    }
    $checks = foreach ($name in $sources.Keys) {
        $source = Get-Item -LiteralPath $sources[$name]
        if ($source.PSIsContainer -or $source.LinkType) { throw "Unexpected SEO source file: $name" }
        $snapshot = Join-Path $bin $name
        Copy-Item -LiteralPath $source.FullName -Destination $snapshot -Force
        $hash = (Get-FileHash -LiteralPath $snapshot -Algorithm SHA256).Hash
        $location = Quote-PowerShell $snapshot
        "if ((Get-FileHash -LiteralPath $location -Algorithm SHA256).Hash -ne '$hash') { exit 85 }"
    }
    if ($EnableVercelTraffic) {
        $checks += "if ((Get-FileHash -LiteralPath $(Quote-PowerShell $trafficConfig) -Algorithm SHA256).Hash -ne '$((Get-FileHash -LiteralPath $trafficConfig -Algorithm SHA256).Hash)') { exit 85 }"
    }
    $launch = @(
        '$ErrorActionPreference = ''Stop'''
        $checks
        ('& ' + (Quote-PowerShell $node) + ' ' + (Quote-PowerShell $operator) + ' tick --state-dir ' + (Quote-PowerShell $state) + ' --backlog ' + (Quote-PowerShell $backlog) + $codexArgument)
        $trafficLaunch
        'exit $LASTEXITCODE'
    ) -join "`r`n"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($launch))
    $engine = [System.Security.SecurityElement]::Escape($power)
    $directory = [System.Security.SecurityElement]::Escape($bin)
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $current = Get-Date
    $today = $current.Date
    $next = $today.AddMinutes(15 * [Math]::Floor($current.TimeOfDay.TotalMinutes / 15 + 1))
    $timeBoundary = $next.ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture)
    $xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Releves publics et brouillons SEO LCB, horaires Europe/Paris, aucune publication.</Description></RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <Repetition><Interval>PT15M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>
      <StartBoundary>$timeBoundary</StartBoundary><Enabled>true</Enabled>
    </TimeTrigger>
    <LogonTrigger><Enabled>true</Enabled><UserId>$identity</UserId></LogonTrigger>
  </Triggers>
  <Principals><Principal id="Operator"><UserId>$identity</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <Enabled>true</Enabled><Hidden>false</Hidden>
    <ExecutionTimeLimit>PT12M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Operator"><Exec><Command>$engine</Command><Arguments>-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encoded</Arguments><WorkingDirectory>$directory</WorkingDirectory></Exec></Actions>
</Task>
"@
    Register-ScheduledTask -TaskName $taskName -Xml $xml -Force | Select-Object TaskName, State
    return
}

switch ($Action) {
    'Status' {
        $task = Get-ScheduledTask -TaskName $taskName
        $info = Get-ScheduledTaskInfo -TaskName $taskName
        [ordered]@{
            task = $task.TaskName; state = $task.State.ToString(); lastResult = $info.LastTaskResult
            lastRun = $info.LastRunTime.ToString('o'); nextRun = $info.NextRunTime.ToString('o'); missed = $info.NumberOfMissedRuns
        } | ConvertTo-Json -Compress
        Invoke-Operator 'status'
        if (Test-Path -LiteralPath $traffic) { Invoke-Traffic 'Status' }
    }
    'Report' {
        $reportArguments = @('report', $Cadence, '--state-dir', $state)
        if ($Json) { $reportArguments += '--json' }
        & $node $operator @reportArguments
        if ($LASTEXITCODE -ne 0) { throw "SEO report returned exit code $LASTEXITCODE" }
        if ($Cadence -eq 'weekly' -and -not $Json -and (Test-Path -LiteralPath $traffic)) { Invoke-Traffic 'Report' }
    }
    'VercelRefresh' { Invoke-Traffic 'Refresh' }
    'VercelReport' { Invoke-Traffic 'Report' }
    'Tick' { Start-ScheduledTask -TaskName $taskName }
    'Pause' { Invoke-Operator 'pause' }
    'Resume' { Invoke-Operator 'resume'; Start-ScheduledTask -TaskName $taskName }
    'Stop' { Invoke-Operator 'stop'; Disable-ScheduledTask -TaskName $taskName | Out-Null }
    'Start' { Invoke-Operator 'start'; Enable-ScheduledTask -TaskName $taskName | Out-Null; Start-ScheduledTask -TaskName $taskName }
}

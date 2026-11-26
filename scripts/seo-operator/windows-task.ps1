[CmdletBinding()]
param(
    [ValidateSet('Install', 'Status', 'Report', 'Tick', 'Pause', 'Resume', 'Stop', 'Start')]
    [string]$Action = 'Status',
    [ValidateSet('daily', 'weekly', 'monthly')]
    [string]$Cadence = 'daily',
    [switch]$Json,
    [string]$InstallRoot = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'LCB\SeoOperator'),
    [switch]$EnableCodexDrafts
)

$ErrorActionPreference = 'Stop'
$taskName = 'LCB SEO Operator'
$install = [IO.Path]::GetFullPath($InstallRoot)
$bin = Join-Path $install 'bin'
$state = Join-Path $install 'state'
$operator = Join-Path $bin 'operator.mjs'
$backlog = Join-Path $bin 'backlog.json'
$sourceBacklog = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) 'docs\seo-operator\backlog.json'
$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source

function Quote-PowerShell([string]$Literal) {
    return "'" + $Literal.Replace("'", "''") + "'"
}

function Invoke-Operator([string]$Command) {
    & $node $operator $Command --state-dir $state
    if ($LASTEXITCODE -ne 0) { throw "SEO operator returned exit code $LASTEXITCODE" }
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
    $checks = foreach ($name in $sources.Keys) {
        $source = Get-Item -LiteralPath $sources[$name]
        if ($source.PSIsContainer -or $source.LinkType) { throw "Unexpected SEO source file: $name" }
        $snapshot = Join-Path $bin $name
        Copy-Item -LiteralPath $source.FullName -Destination $snapshot -Force
        $hash = (Get-FileHash -LiteralPath $snapshot -Algorithm SHA256).Hash
        $location = Quote-PowerShell $snapshot
        "if ((Get-FileHash -LiteralPath $location -Algorithm SHA256).Hash -ne '$hash') { exit 85 }"
    }
    $launch = @(
        '$ErrorActionPreference = ''Stop'''
        $checks
        ('& ' + (Quote-PowerShell $node) + ' ' + (Quote-PowerShell $operator) + ' tick --state-dir ' + (Quote-PowerShell $state) + ' --backlog ' + (Quote-PowerShell $backlog) + $codexArgument)
        'exit $LASTEXITCODE'
    ) -join "`r`n"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($launch))
    $engine = [System.Security.SecurityElement]::Escape((Get-Command powershell.exe -CommandType Application).Source)
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
    }
    'Report' {
        $reportArguments = @('report', $Cadence, '--state-dir', $state)
        if ($Json) { $reportArguments += '--json' }
        & $node $operator @reportArguments
        if ($LASTEXITCODE -ne 0) { throw "SEO report returned exit code $LASTEXITCODE" }
    }
    'Tick' { Start-ScheduledTask -TaskName $taskName }
    'Pause' { Invoke-Operator 'pause' }
    'Resume' { Invoke-Operator 'resume'; Start-ScheduledTask -TaskName $taskName }
    'Stop' { Invoke-Operator 'stop'; Disable-ScheduledTask -TaskName $taskName | Out-Null }
    'Start' { Invoke-Operator 'start'; Enable-ScheduledTask -TaskName $taskName | Out-Null; Start-ScheduledTask -TaskName $taskName }
}

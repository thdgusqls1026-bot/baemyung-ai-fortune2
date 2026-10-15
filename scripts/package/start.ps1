# AI 운세 영수증 - 원터치 실행 스크립트 (시작하기.bat 이 이 파일을 실행합니다)
param(
  [string]$ApiKey = '',      # 키를 미리 넘기면 입력 창을 건너뜁니다 (자동화/점검용)
  [switch]$NoBrowser,        # 인터넷 창을 자동으로 열지 않습니다
  [switch]$SkipKeyCheck,     # 키를 인터넷으로 확인하지 않습니다
  [int]$BasePort = 3000      # 이 번호부터 비어 있는 포트를 찾습니다
)
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
try { $Host.UI.RawUI.WindowTitle = 'AI 운세 영수증 서버 - 이 창을 닫으면 꺼져요' } catch {}

$app        = $PSScriptRoot
$root       = Split-Path $app -Parent
$node       = Join-Path $app 'node\node.exe'
$envFile    = Join-Path $app '.env'
$logDir     = Join-Path $app 'logs'
$dataDir    = Join-Path $root '순위기록'
$keyPattern = '^sk-ant-[A-Za-z0-9_\-]{20,}$'
$utf8NoBom  = New-Object Text.UTF8Encoding($false)
$utf8Bom    = New-Object Text.UTF8Encoding($true)

function Say([string]$text, [string]$color = 'White') { Write-Host $text -ForegroundColor $color }
function Fail([string]$text) {
  Write-Host ''
  Write-Host $text -ForegroundColor Red
  Write-Host ''
  try { Read-Host 'Enter 키를 누르면 이 창이 닫혀요' | Out-Null } catch {}
  exit 1
}

if (-not (Test-Path $node)) {
  Fail '프로그램 파일이 부족해요. 압축 파일을 우클릭해서 "모두 풀기"로 푼 다음, 풀린 폴더에서 다시 실행해 주세요. (압축 파일 안에서 바로 실행하면 안 돼요)'
}
# 인터넷에서 받은 파일에 붙는 "차단" 표시를 풀어 두면 Windows 경고창이 덜 떠요.
Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

function Get-EnvValue([string]$name) {
  if (-not (Test-Path $envFile)) { return '' }
  foreach ($line in Get-Content $envFile -Encoding UTF8) {
    if ($line -match "^\s*$name\s*=\s*(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
  }
  return ''
}
function Get-EnvOr([string]$name, [string]$default) {
  $value = Get-EnvValue $name
  if ($value) { return $value } else { return $default }
}
# 'valid' / 'invalid' / 'unknown'(인터넷이 안 되는 등 확인할 수 없음)
function Test-ApiKey([string]$key) {
  try {
    Invoke-WebRequest 'https://api.anthropic.com/v1/models' -UseBasicParsing -TimeoutSec 15 `
      -Headers @{ 'x-api-key' = $key; 'anthropic-version' = '2023-06-01' } | Out-Null
    return 'valid'
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 401 -or $code -eq 403) { return 'invalid' }
    return 'unknown'
  }
}

# ---------- 처음 한 번: API 키 받기 ----------
$key = Get-EnvValue 'ANTHROPIC_API_KEY'
$hasKey = $key -match $keyPattern
$needsWrite = $false

if (-not $hasKey) {
  Clear-Host
  Say '============================================================' 'Cyan'
  Say '  AI 운세 영수증 - 처음 한 번만 하는 설정이에요' 'Cyan'
  Say '============================================================' 'Cyan'
  Say ''
  Say '  Anthropic API 키가 필요해요. ("sk-ant-" 로 시작하는 긴 글자예요)'
  Say '  받아 둔 키를 복사한 뒤, 아래 줄에서 마우스 오른쪽 버튼을 누르면 붙여넣어져요.'
  Say '  붙여넣고 Enter 키를 누르세요.'
  Say ''
  $candidate = $ApiKey
  for ($try = 0; $try -lt 5 -and -not $hasKey; $try++) {
    if (-not $candidate) {
      try { $candidate = Read-Host '  API 키' } catch { break }
      if ($null -eq $candidate) { break }   # 입력 창이 닫힌 경우
    }
    $candidate = "$candidate".Trim().Trim('"').Trim("'")
    if ($candidate -notmatch $keyPattern) {
      Say '  -> "sk-ant-" 로 시작하는 키가 아닌 것 같아요. 처음부터 끝까지 다시 복사해 주세요.' 'Yellow'
      $candidate = ''
      continue
    }
    if (-not $SkipKeyCheck) {
      Say '  키가 맞는지 확인하는 중... (몇 초 걸려요)' 'Gray'
      $status = Test-ApiKey $candidate
      if ($status -eq 'invalid') {
        Say '  -> 이 키는 사용할 수 없대요. 키를 만든 사람에게 다시 확인해 주세요.' 'Yellow'
        $candidate = ''
        continue
      }
      if ($status -eq 'unknown') {
        Say '  -> 지금은 키를 확인하지 못했어요 (인터넷이 느리거나 끊겼을 수 있어요). 일단 이대로 진행할게요.' 'Yellow'
      }
    }
    $key = $candidate
    $hasKey = $true
  }
  if (-not $hasKey) { Fail '키를 입력하지 못해서 종료할게요. 「시작하기」를 다시 더블클릭해서 처음부터 해 주세요.' }
  $needsWrite = $true
}

if ($needsWrite -or -not (Test-Path $envFile)) {
  $lines = @(
    "ANTHROPIC_API_KEY=$key",
    "ANTHROPIC_MODEL=$(Get-EnvOr 'ANTHROPIC_MODEL' 'claude-haiku-5-5')",
    "DAILY_API_LIMIT=$(Get-EnvOr 'DAILY_API_LIMIT' '200')",
    "IP_LIMIT_PER_15MIN=$(Get-EnvOr 'IP_LIMIT_PER_15MIN' '200')"
  )
  [IO.File]::WriteAllText($envFile, (($lines -join "`r`n") + "`r`n"), $utf8NoBom) # BOM이 있으면 서버가 첫 줄을 못 읽어요
  Say ''
  Say '  설정을 저장했어요. 다음부터는 이 과정 없이 바로 켜져요.' 'Green'
  Start-Sleep -Seconds 1
}

# ---------- 포트 정하기 / 이미 켜져 있는지 확인 ----------
# 주의: "localhost"는 PowerShell 5.1에서 IPv6를 먼저 시도하다 2초 제한에 걸려 실패해요. 서버 확인은 꼭 127.0.0.1 로 해요.
function Test-AppRunning([int]$p) {
  try { return ((Invoke-RestMethod "http://127.0.0.1:$p/api/health" -TimeoutSec 3).ok -eq $true) } catch { return $false }
}
function Test-PortBusy([int]$p) {
  return [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
}
$port = $null
for ($p = $BasePort; $p -lt $BasePort + 20; $p++) {
  if (-not (Test-PortBusy $p)) { $port = $p; break }
  if (Test-AppRunning $p) {
    Say ''
    Say "  이미 켜져 있어요! 인터넷 창만 열어 드릴게요. (주소: http://localhost:$p)" 'Green'
    if (-not $NoBrowser) { Start-Process "http://localhost:$p" }
    Start-Sleep -Seconds 3
    exit 0
  }
}
if (-not $port) { Fail '사용할 수 있는 포트를 찾지 못했어요. 컴퓨터를 다시 시작한 뒤 시도해 주세요.' }

# ---------- 서버 켜기 ----------
New-Item -ItemType Directory -Force $logDir, $dataDir | Out-Null
$env:PORT = "$port"
$env:DATA_DIR = $dataDir
$env:EXIT_WITH_PARENT_PID = "$PID"   # 이 창이 사라지면 서버도 몇 초 안에 스스로 꺼져요
$outLog = Join-Path $logDir 'server.log'
$errLog = Join-Path $logDir 'server-error.log'
# 서버 출력은 파일로 보내요. 검은 창을 마우스로 클릭해도 서버가 멈추지 않게 하려는 거예요.
$proc = Start-Process -FilePath $node -ArgumentList @('--env-file-if-exists=.env', 'server.mjs') `
  -WorkingDirectory $app -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog

# 행사 중 컴퓨터가 절전 모드로 들어가지 않게 해요 (이 창이 열려 있는 동안만)
try {
  Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
  [Win.Power]::SetThreadExecutionState(0x80000001) | Out-Null
} catch {}

$up = $false
for ($i = 0; $i -lt 30 -and -not $up; $i++) {
  if ($proc.HasExited) { break }
  Start-Sleep -Milliseconds 500
  $up = Test-AppRunning $port
}
if (-not $up) {
  $detail = ''
  if (Test-Path $errLog) { $detail = (Get-Content $errLog -Tail 5 -ErrorAction SilentlyContinue) -join "`n" }
  Fail "서버를 켜지 못했어요.`n$detail`n이 화면을 사진으로 찍어서 만든 사람에게 보내 주세요."
}

$phoneUrls = @()
try {
  $phoneUrls = @(Get-NetIPConfiguration -ErrorAction Stop |
    Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object { "http://$($_.IPv4Address.IPAddress):$port" })
} catch {}

Clear-Host
Say '============================================================' 'Green'
Say '  켜졌어요!  이 검은 창을 닫으면 꺼져요. (행사 중에는 닫지 마세요)' 'Green'
Say '============================================================' 'Green'
Say ''
Say "  이 컴퓨터에서 보기   : http://localhost:$port" 'White'
if ($phoneUrls.Count -gt 0) {
  foreach ($u in $phoneUrls) { Say "  휴대폰에서 보기      : $u   (컴퓨터와 같은 와이파이일 때)" 'Yellow' }
} else {
  Say '  휴대폰에서 보기      : 와이파이에 연결되어 있지 않아서 주소를 찾지 못했어요' 'Yellow'
}
Say "  순위 보기            : http://localhost:$port/admin" 'White'
Say '                         비밀번호 없이 열려요. 접속한 누구나 전체 순위를 볼 수 있어요.' 'Yellow'
Say ''
Say '  - 처음에 Windows 방화벽 창이 뜨면 [액세스 허용]을 눌러야 휴대폰에서 접속돼요.' 'Gray'
Say '  - 끝낼 때는 순위 화면에서 [CSV 저장]으로 기록을 저장한 뒤 이 창을 닫으세요.' 'Gray'
Say ''
if (-not $NoBrowser) { Start-Process "http://localhost:$port" }

$proc.WaitForExit()
Say ''
Say '  서버가 멈췄어요.' 'Yellow'
if (Test-Path $errLog) {
  $tail = (Get-Content $errLog -Tail 5 -ErrorAction SilentlyContinue) -join "`n"
  if ($tail) { Say $tail 'Gray' }
}
try { Read-Host '  Enter 키를 누르면 이 창이 닫혀요' | Out-Null } catch {}

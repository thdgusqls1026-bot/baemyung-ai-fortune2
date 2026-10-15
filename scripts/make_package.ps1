# Builds the one-touch Windows package:  dist\<name>.zip   (name = AI-unse-yeongsujeung-wonteochi, in Korean)
#
#   powershell -ExecutionPolicy Bypass -File scripts\make_package.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\make_package.ps1 -NodeZip C:\path\node-v22.23.3-win-x64.zip
#
# The zip contains the app, a portable node.exe and the launcher files from scripts\package.
# It never contains .env, API keys, ranking data or logs.
# This file is ASCII-only on purpose: Windows PowerShell 5.1 misreads UTF-8 files that have no BOM.
param(
  [string]$NodeVersion = 'v22.23.3',   # Node 22 LTS (the app needs Node 22 or newer)
  [string]$NodeZip = ''                # optional: an already downloaded node-vX.Y.Z-win-x64.zip
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$project  = Split-Path $PSScriptRoot -Parent
$dist     = Join-Path $project 'dist'
$cache    = Join-Path $dist 'cache'
$stage    = Join-Path $dist 'stage'
$template = Join-Path $PSScriptRoot 'package'
$zipName  = [regex]::Unescape('AI\uC6B4\uC138\uC601\uC218\uC99D-\uC6D0\uD130\uCE58') + '.zip'
$zipPath  = Join-Path $dist $zipName
$utf8Bom  = New-Object Text.UTF8Encoding($true)
$utf8NoBom = New-Object Text.UTF8Encoding($false)

# 1) portable Node, verified against the checksum nodejs.org publishes
$nodeZipName = "node-$NodeVersion-win-x64.zip"
if (-not $NodeZip) {
  $NodeZip = Join-Path $cache $nodeZipName
  if (-not (Test-Path $NodeZip)) {
    New-Item -ItemType Directory -Force $cache | Out-Null
    Write-Host "Downloading $nodeZipName from nodejs.org ..."
    Invoke-WebRequest "https://nodejs.org/dist/$NodeVersion/$nodeZipName" -OutFile $NodeZip -UseBasicParsing
  }
} else {
  $nodeZipName = Split-Path $NodeZip -Leaf
}
$sums = (Invoke-WebRequest "https://nodejs.org/dist/$NodeVersion/SHASUMS256.txt" -UseBasicParsing).Content
$line = ($sums -split "`n") | Where-Object { $_ -match ([regex]::Escape($nodeZipName) + '\s*$') } | Select-Object -First 1
$expected = if ($line) { ($line -split '\s+')[0].ToLower() } else { '' }
$actual = (Get-FileHash $NodeZip -Algorithm SHA256).Hash.ToLower()
if (-not $expected -or $actual -ne $expected) { throw "Checksum mismatch or unknown file for $NodeZip" }
Write-Host "Node checksum OK ($NodeVersion)"

# 2) stage the files
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
$appDir  = Join-Path $stage 'app'
$nodeDir = Join-Path $appDir 'node'
New-Item -ItemType Directory -Force $appDir, $nodeDir | Out-Null
foreach ($f in 'server.mjs', 'ranking.mjs', 'package.json') { Copy-Item (Join-Path $project $f) $appDir }
Copy-Item (Join-Path $project 'public') (Join-Path $appDir 'public') -Recurse

function Write-Template([string]$src, [string]$dst, $encoding) {
  $text = [IO.File]::ReadAllText($src, [Text.Encoding]::UTF8) -replace "`r?`n", "`r`n"
  [IO.File]::WriteAllText($dst, $text, $encoding)
}
foreach ($f in Get-ChildItem $template -File) {
  switch ($f.Extension) {
    '.ps1' { Write-Template $f.FullName (Join-Path $appDir $f.Name) $utf8Bom }
    '.bat' { Write-Template $f.FullName (Join-Path $stage $f.Name) $utf8NoBom }
    '.txt' { Write-Template $f.FullName (Join-Path $stage $f.Name) $utf8Bom }
  }
}

$zip = [IO.Compression.ZipFile]::OpenRead($NodeZip)
try {
  foreach ($e in $zip.Entries) {
    if ($e.FullName -eq "node-$NodeVersion-win-x64/node.exe") {
      [IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path $nodeDir 'node.exe'), $true)
    } elseif ($e.FullName -eq "node-$NodeVersion-win-x64/LICENSE") {
      [IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path $nodeDir 'node-LICENSE.txt'), $true)
    }
  }
} finally { $zip.Dispose() }
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) { throw 'node.exe was not found inside the Node zip' }

# 3) safety checks: never ship secrets or runtime data
$leaks = Get-ChildItem $stage -Recurse -Force | Where-Object { $_.Name -in '.env', 'data', 'entries.jsonl', 'logs' -or $_.Extension -eq '.log' }
if ($leaks) { throw "Refusing to package: $($leaks.FullName -join ', ')" }
$keyLike = Get-ChildItem $stage -Recurse -File | Where-Object { $_.Name -ne 'node.exe' } |
  Select-String -Pattern 'sk-ant-[A-Za-z0-9_-]{30,}' -List
if ($keyLike) { throw "Something that looks like an API key is inside: $($keyLike.Path -join ', ')" }

# 4) zip (no extra top-level folder: Windows "Extract All" already creates one named after the zip)
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
# Entry by entry with "/" separators: CreateFromDirectory in Windows PowerShell 5.1 writes "\", which non-Windows unzippers mangle.
$archive = [IO.Compression.ZipFile]::Open($zipPath, [IO.Compression.ZipArchiveMode]::Create)
try {
  $base = (Resolve-Path $stage).Path.TrimEnd('\') + '\'
  foreach ($file in Get-ChildItem $stage -Recurse -File) {
    $entryName = $file.FullName.Substring($base.Length).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
Remove-Item $stage -Recurse -Force
$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host "Done: $zipPath  ($mb MB)"

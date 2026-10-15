# Builds dist\github-upload : a folder with ONLY the files that are safe to put on GitHub.
# Drag the contents of that folder into the GitHub "Upload files" page (the web upload ignores .gitignore,
# so dragging the whole project folder would also upload your .env with the API key).
#
#   powershell -ExecutionPolicy Bypass -File scripts\make_github_upload.ps1
#
# ASCII-only on purpose: Windows PowerShell 5.1 misreads UTF-8 files that have no BOM.
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$out = Join-Path $project 'dist\github-upload'

$files = 'server.mjs', 'ranking.mjs', 'package.json', '.gitignore', '.env.example', 'README.md', 'HANDOFF.md', 'PROMPT_FOR_NEXT_AI.md'
$folders = 'public', 'scripts', 'test'

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null
foreach ($f in $files) { Copy-Item (Join-Path $project $f) $out }
foreach ($d in $folders) { Copy-Item (Join-Path $project $d) (Join-Path $out $d) -Recurse }

# safety checks: never ship secrets or runtime data
$leaks = Get-ChildItem $out -Recurse -Force | Where-Object { $_.Name -in '.env', 'data', 'dist', 'node_modules', 'entries.jsonl', 'logs' -or $_.Extension -eq '.log' }
if ($leaks) { throw "Refusing: $($leaks.FullName -join ', ')" }
$keyLike = Get-ChildItem $out -Recurse -File | Select-String -Pattern 'sk-ant-[A-Za-z0-9_-]{30,}' -List
if ($keyLike) { throw "Something that looks like an API key is inside: $($keyLike.Path -join ', ')" }

$count = (Get-ChildItem $out -Recurse -File).Count
Write-Host "Done: $out  ($count files). No .env, no API key, no ranking data."

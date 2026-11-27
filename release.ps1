# Publica una versión nueva de PadHub en GitHub Releases.
# Uso:  .\release.ps1 -Version 0.1.1 -Notes "Qué cambia en esta versión"
#
# 1. Pone la versión en tauri.conf.json y Cargo.toml
# 2. Compila el instalador firmado (clave privada en %USERPROFILE%\.tauri\padhub.key)
# 3. Genera latest.json (lo que consultan las apps para saber si hay versión nueva)
# 4. Hace commit + tag, sube a GitHub y crea la release con los archivos

param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Notes = ""
)
# 'Continue': en PowerShell 5.1, con 'Stop', los mensajes informativos que cargo/gh
# escriben por stderr se tratan como errores. Los fallos se comprueban con $LASTEXITCODE.
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$repo = 'IvannPerezz/PadHub'
$cargo = "$env:USERPROFILE\.cargo\bin\cargo.exe"
$keyPath = "$env:USERPROFILE\.tauri\padhub.key"
if (-not (Test-Path $keyPath)) { throw "No encuentro la clave de firma en $keyPath" }

# 1. Versión
$utf8 = New-Object Text.UTF8Encoding $false
$conf = "$root\src-tauri\tauri.conf.json"
$t = [IO.File]::ReadAllText($conf) -replace '"version": "[^"]+"', "`"version`": `"$Version`""
[IO.File]::WriteAllText($conf, $t, $utf8)
$toml = "$root\src-tauri\Cargo.toml"
$t = [IO.File]::ReadAllText($toml) -replace '(?m)^version = "[^"]+"', "version = `"$Version`""
[IO.File]::WriteAllText($toml, $t, $utf8)

# 2. Compilar y firmar
$env:TAURI_SIGNING_PRIVATE_KEY = [IO.File]::ReadAllText($keyPath)
Push-Location $root
try { & $cargo tauri build; if ($LASTEXITCODE) { throw "La compilación ha fallado" } } finally { Pop-Location }
Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY

$nsis = "$root\src-tauri\target\release\bundle\nsis"
$setup = Get-ChildItem $nsis -Filter "*_${Version}_x64-setup.exe" | Select-Object -First 1
if (-not $setup) { throw "No encuentro el instalador de la versión $Version en $nsis" }
$sig = [IO.File]::ReadAllText("$($setup.FullName).sig").Trim()
$assetName = "PadHub_${Version}_x64-setup.exe"

# 3. latest.json
$latest = [ordered]@{
  version   = $Version
  notes     = $Notes
  pub_date  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  platforms = @{
    'windows-x86_64' = @{
      signature = $sig
      url       = "https://github.com/$repo/releases/download/v$Version/$assetName"
    }
  }
}
$latestPath = "$nsis\latest.json"
[IO.File]::WriteAllText($latestPath, ($latest | ConvertTo-Json -Depth 5), $utf8)
$dist = "$nsis\$assetName"
if ($setup.FullName -ne $dist) { Copy-Item $setup.FullName $dist -Force }

# 4. Git + release
Push-Location $root
try {
  git add -A
  git commit -m "Versión $Version" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  git tag "v$Version"
  git push origin HEAD --tags
  if ($LASTEXITCODE) { throw "No se pudo subir a GitHub" }
  $n = if ($Notes) { $Notes } else { "PadHub $Version" }
  gh release create "v$Version" $dist "$($setup.FullName).sig" $latestPath --repo $repo --title "PadHub $Version" --notes $n
  if ($LASTEXITCODE) { throw "No se pudo crear la release" }
} finally { Pop-Location }
Write-Host "Publicada la versión $Version"

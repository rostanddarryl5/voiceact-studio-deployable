param(
  [int]$MinimumFreeGB = 20,
  [switch]$AllowLowDisk
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot ".env"

function Find-Docker {
  $Command = Get-Command "docker.exe" -ErrorAction SilentlyContinue
  if ($Command) { return $Command.Source }

  $DesktopDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
  if (Test-Path $DesktopDocker) { return $DesktopDocker }

  throw "Docker est introuvable. Installez ou demarrez Docker avant le deploiement."
}

function Read-EnvironmentValue([string]$Name) {
  $Line = Get-Content $EnvironmentFile | Where-Object {
    $_ -match "^$([regex]::Escape($Name))="
  } | Select-Object -Last 1
  if (-not $Line) { return $null }
  return ($Line -split "=", 2)[1].Trim()
}

Write-Host "VoiceAct - controle de preproduction" -ForegroundColor Cyan

$Drive = [System.IO.DriveInfo]::new((Split-Path -Qualifier $ProjectRoot))
$FreeGB = [math]::Round($Drive.AvailableFreeSpace / 1GB, 2)
Write-Host "Espace libre : $FreeGB Go"
if (-not $AllowLowDisk -and $FreeGB -lt $MinimumFreeGB) {
  throw "Espace insuffisant : $MinimumFreeGB Go libres sont requis pour construire app + WhisperX."
}

if (-not (Test-Path $EnvironmentFile)) {
  throw "Le fichier .env manque. Copiez .env.docker.example vers .env puis remplacez les valeurs d'exemple."
}

$Token = Read-EnvironmentValue "VOICEACT_INTERNAL_TOKEN"
if ([string]::IsNullOrWhiteSpace($Token) -or $Token.Length -lt 32 -or $Token -match "remplacez|changez|secret") {
  throw "VOICEACT_INTERNAL_TOKEN doit etre un secret aleatoire d'au moins 32 caracteres."
}

$Release = Read-EnvironmentValue "VOICEACT_RELEASE"
if ([string]::IsNullOrWhiteSpace($Release) -or $Release -in @("latest", "local")) {
  throw "VOICEACT_RELEASE doit etre une version immuable, par exemple 0.1.0."
}

$Docker = Find-Docker
& $Docker version --format "Docker client={{.Client.Version}} server={{.Server.Version}}"
if ($LASTEXITCODE -ne 0) { throw "Le daemon Docker ne repond pas." }

Push-Location $ProjectRoot
try {
  & $Docker compose config --quiet
  if ($LASTEXITCODE -ne 0) { throw "La configuration Compose est invalide." }
} finally {
  Pop-Location
}

Write-Host "Preflight reussi pour VoiceAct $Release." -ForegroundColor Green

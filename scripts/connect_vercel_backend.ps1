param(
  [Parameter(Mandatory = $true)]
  [string]$BackendUrl,

  [Parameter(Mandatory = $true)]
  [string]$InternalToken,

  [string]$VercelProjectDir = "C:\Users\Rostand JK\Desktop\Voice act\voiceact-vercel-deploy",
  [string]$VercelCli = "C:\Users\Rostand JK\Desktop\Voice act\voiceact-studio\node_modules\.bin\vercel.cmd"
)

$ErrorActionPreference = "Stop"

function Normalize-BackendUrl([string]$Url) {
  $Clean = $Url.Trim().TrimEnd("/")
  if (-not ($Clean.StartsWith("https://") -or $Clean.StartsWith("http://"))) {
    throw "BackendUrl doit commencer par https:// ou http://"
  }
  return $Clean
}

function Assert-Tooling {
  if (-not (Test-Path -LiteralPath $VercelCli)) {
    throw "Vercel CLI introuvable : $VercelCli"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $VercelProjectDir ".vercel\project.json"))) {
    throw "Projet Vercel non lié : $VercelProjectDir"
  }
}

function Test-BackendReady([string]$Url) {
  Write-Host "Verification du backend vocal : $Url/health/ready" -ForegroundColor Cyan
  try {
    $Response = Invoke-RestMethod -Uri "$Url/health/ready" -TimeoutSec 30
    if ($Response.status -ne "ready") {
      Write-Host "Le backend repond, mais son statut n'est pas ready." -ForegroundColor Yellow
    }
  } catch {
    throw "Le backend ne repond pas encore sur /health/ready. Attends la fin du deploy Render puis relance."
  }
}

function Set-VercelEnv([string]$Name, [string]$Value) {
  $TempFile = New-TemporaryFile
  try {
    Set-Content -LiteralPath $TempFile -Value $Value -NoNewline -Encoding UTF8
    Push-Location $VercelProjectDir
    try {
      & $VercelCli env rm $Name production --yes 2>$null | Out-Null
      cmd.exe /c "type `"$TempFile`" | `"$VercelCli`" env add $Name production"
      if ($LASTEXITCODE -ne 0) {
        throw "Impossible d'ajouter la variable Vercel $Name"
      }
    } finally {
      Pop-Location
    }
  } finally {
    Remove-Item -LiteralPath $TempFile -Force -ErrorAction SilentlyContinue
  }
}

Assert-Tooling
$BackendUrl = Normalize-BackendUrl $BackendUrl
Test-BackendReady $BackendUrl

Set-VercelEnv "VOICEACT_TRANSCRIPTION_PROVIDER" "local"
Set-VercelEnv "VOICEACT_SPEECH_SERVICE_URL" $BackendUrl
Set-VercelEnv "VOICEACT_SPEECH_SERVICE_TOKEN" $InternalToken
Set-VercelEnv "VOICEACT_ALLOW_OPENAI_FALLBACK" "false"

Push-Location $VercelProjectDir
try {
  Write-Host "Redeploiement Vercel avec le backend vocal..." -ForegroundColor Cyan
  & $VercelCli deploy --prod --yes
  if ($LASTEXITCODE -ne 0) {
    throw "Le redeploiement Vercel a echoue."
  }
} finally {
  Pop-Location
}

Write-Host "VoiceAct est raccorde au backend vocal public." -ForegroundColor Green

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$androidDirectory = Join-Path $repositoryRoot "android-twa"
$passwordPath = Join-Path $repositoryRoot ".secrets\onoprop-upload-keystore-password.txt"
$keyStorePath = Join-Path $repositoryRoot ".secrets\onoprop-upload.keystore"
$gradlePropertiesPath = Join-Path $androidDirectory "gradle.properties"
$keyAlias = "onoprop-upload"

if (-not (Test-Path -LiteralPath $passwordPath)) {
    throw "No se encontró la contraseña local de la clave de carga."
}

$password = [IO.File]::ReadAllText($passwordPath).Trim()
if ($password.Length -lt 6) {
    throw "La contraseña local de la clave de carga no es válida."
}

if (-not (Select-String -LiteralPath $gradlePropertiesPath -SimpleMatch "android.overridePathCheck=true" -Quiet)) {
    Add-Content -LiteralPath $gradlePropertiesPath -Value "`n# La ruta del repositorio contiene caracteres no ASCII.`nandroid.overridePathCheck=true"
}

$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
$javaHome = "C:\PROGRA~1\Java\jdk-17.0.1"
$jarSigner = Join-Path $javaHome "bin\jarsigner.exe"
$androidSdk = Join-Path $env:USERPROFILE ".bubblewrap\android_sdk"
$buildTools = Get-ChildItem -LiteralPath (Join-Path $androidSdk "build-tools") -Directory |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
$apkSigner = Join-Path $buildTools.FullName "apksigner.bat"
$unsignedApk = Join-Path $androidDirectory "app-release-unsigned-aligned.apk"
$signedApk = Join-Path $androidDirectory "app-release-signed.apk"
$unsignedBundle = Join-Path $androidDirectory "app\build\outputs\bundle\release\app-release.aab"
$signedBundle = Join-Path $androidDirectory "app-release-bundle.aab"

$previousStorePassword = $env:ONOPROP_ANDROID_STORE_PASSWORD
$previousKeyPassword = $env:ONOPROP_ANDROID_KEY_PASSWORD

try {
    $env:ONOPROP_ANDROID_STORE_PASSWORD = $password
    $env:ONOPROP_ANDROID_KEY_PASSWORD = $password
    Push-Location $androidDirectory
    & $npx --yes '@bubblewrap/cli' build --skipSigning
    if ($LASTEXITCODE -ne 0) {
        throw "Bubblewrap no pudo generar los paquetes Android sin firmar."
    }

    & $apkSigner sign `
        --ks $keyStorePath `
        --ks-key-alias $keyAlias `
        --ks-pass env:ONOPROP_ANDROID_STORE_PASSWORD `
        --key-pass env:ONOPROP_ANDROID_KEY_PASSWORD `
        --out $signedApk `
        $unsignedApk
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo firmar el APK."
    }

    & $jarSigner `
        -keystore $keyStorePath `
        -storepass:env ONOPROP_ANDROID_STORE_PASSWORD `
        -keypass:env ONOPROP_ANDROID_KEY_PASSWORD `
        -signedjar $signedBundle `
        $unsignedBundle `
        $keyAlias
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo firmar el App Bundle."
    }

    & $apkSigner verify --verbose --print-certs $signedApk
    if ($LASTEXITCODE -ne 0) {
        throw "La verificación de firma del APK falló."
    }

    & $jarSigner -verify $signedBundle
    if ($LASTEXITCODE -ne 0) {
        throw "La verificación de firma del App Bundle falló."
    }
} finally {
    Pop-Location
    $env:ONOPROP_ANDROID_STORE_PASSWORD = $previousStorePassword
    $env:ONOPROP_ANDROID_KEY_PASSWORD = $previousKeyPassword
    $password = $null
}

Write-Output "Paquetes Android de lanzamiento generados en $androidDirectory."

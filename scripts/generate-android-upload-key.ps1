param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$secretDirectory = Join-Path $repositoryRoot ".secrets"
$keyStorePath = Join-Path $secretDirectory "onoprop-upload.keystore"
$passwordPath = Join-Path $secretDirectory "onoprop-upload-keystore-password.txt"
$keyAlias = "onoprop-upload"

if (-not $Force -and ((Test-Path -LiteralPath $keyStorePath) -or (Test-Path -LiteralPath $passwordPath))) {
    throw "La clave de carga o su archivo de recuperación ya existen. No se sobrescribieron."
}

if ($Force) {
    Remove-Item -LiteralPath $keyStorePath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $passwordPath -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null

$alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".ToCharArray()
$password = -join (1..40 | ForEach-Object {
    $alphabet[[Security.Cryptography.RandomNumberGenerator]::GetInt32($alphabet.Length)]
})

$keyTool = (Get-Command keytool.exe -ErrorAction Stop).Source

& $keyTool `
    -genkeypair `
    -alias $keyAlias `
    -keyalg RSA `
    -keysize 4096 `
    -validity 10000 `
    -storetype PKCS12 `
    -keystore $keyStorePath `
    -storepass $password `
    -keypass $password `
    -dname "CN=ONO Prop, OU=Android, O=ONO Prop, L=Cordoba, ST=Cordoba, C=AR" `
    -noprompt

if ($LASTEXITCODE -ne 0) {
    throw "keytool no pudo generar la clave de carga."
}

[IO.File]::WriteAllText(
    $passwordPath,
    $password,
    [Text.UTF8Encoding]::new($false)
)

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($protectedPath in @($keyStorePath, $passwordPath)) {
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $currentIdentity,
        [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $protectedPath -AclObject $acl
}

Write-Output "Clave de carga creada fuera de Git."
Write-Output "Keystore: $keyStorePath"
Write-Output "Recuperación: $passwordPath"
Write-Output "Respaldá ambos archivos en una ubicación segura y separada."

& $keyTool -list -v -keystore $keyStorePath -alias $keyAlias -storepass $password

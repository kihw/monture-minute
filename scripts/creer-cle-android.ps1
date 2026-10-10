# Crée la clé de signature Android de l'app et l'enregistre dans les secrets du dépôt GitHub.
# À lancer UNE SEULE FOIS, par le propriétaire du dépôt (nécessite Java et `gh` connecté).
#
#   powershell -ExecutionPolicy Bypass -File scripts/creer-cle-android.ps1
#
# La clé est conservée dans %USERPROFILE%\.dodinde\ : sauvegarde ce dossier. Sans la même clé,
# les APK suivants ne pourront plus s'installer par-dessus les précédents.

$ErrorActionPreference = 'Stop'
$depot = 'kihw/DoDinde'
$dossier = Join-Path $env:USERPROFILE '.dodinde'
$cle = Join-Path $dossier 'dodinde-release.keystore'
$alias = 'dodinde'

if (Test-Path $cle) {
  Write-Host "Une clé existe déjà : $cle — rien n'est recréé." -ForegroundColor Yellow
  exit 1
}
New-Item -ItemType Directory -Force $dossier | Out-Null

# Mot de passe aléatoire (32 caractères alphanumériques), jamais affiché.
$octets = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($octets)
$motDePasse = ([Convert]::ToBase64String($octets) -replace '[^A-Za-z0-9]', '').Substring(0, 32)

keytool -genkeypair -v -keystore $cle -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $motDePasse -keypass $motDePasse -dname "CN=Dofus Elevage, O=kihw"

# Le mot de passe est rangé à côté de la clé, pour la sauvegarde.
Set-Content -Path (Join-Path $dossier 'mot-de-passe.txt') -Value $motDePasse -Encoding utf8

# --body transmet la valeur exacte (un pipe ajouterait un retour à la ligne).
gh secret set ANDROID_KEYSTORE_BASE64 --repo $depot --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes($cle)))
gh secret set ANDROID_KEYSTORE_PASSWORD --repo $depot --body $motDePasse
gh secret set ANDROID_KEY_PASSWORD --repo $depot --body $motDePasse
gh secret set ANDROID_KEY_ALIAS --repo $depot --body $alias

Write-Host "Clé créée dans $dossier et secrets enregistrés sur $depot." -ForegroundColor Green
Write-Host "Sauvegarde ce dossier : il est indispensable pour publier les mises à jour Android."

# Fait reconnaitre la signature de Alcora sur CE PC.
#
#   powershell -ExecutionPolicy Bypass -File scripts\confiance.ps1
#
# Sans cela, la signature existe mais n'est reconnue par personne : Windows continue
# d'annoncer un editeur inconnu.
#
# Le certificat est installe a deux endroits, pour deux raisons differentes :
#   Root             il est sa propre autorite : sans cela la chaine ne se verifie pas ;
#   TrustedPublisher marque l'editeur comme approuve, ce qui evite les demandes.
#
# En administrateur, l'installation vaut pour toute la machine. Sans elevation, elle vaut
# pour le compte courant, ce qui suffit des lors que c'est ce compte qui lance
# l'application. On evite ainsi d'imposer une elevation a quelqu'un qui doit juste cliquer.
#
# CE QUE CELA NE FAIT PAS : cela ne desarme pas le pare-feu applicatif d'une suite de
# securite. Bitdefender, notamment, peut continuer de bloquer la sortie reseau d'un
# programme qu'il ne connait pas. Voir docs/installation-poste.md.

$ErrorActionPreference = 'Stop'

$cer = Join-Path (Split-Path $PSScriptRoot -Parent) 'signature\Alcora-signature.cer'
if (-not (Test-Path $cer)) {
  Write-Host "Certificat introuvable : $cer" -ForegroundColor Red
  Write-Host "Copie ici le fichier « Alcora-signature.cer » produit par scripts\certificat.ps1."
  exit 1
}

$estAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$portee = if ($estAdmin) { 'LocalMachine' } else { 'CurrentUser' }

foreach ($magasin in 'Root', 'TrustedPublisher') {
  Import-Certificate -FilePath $cer -CertStoreLocation "Cert:\$portee\$magasin" | Out-Null
  Write-Host "Installe dans $portee\$magasin."
}

Write-Host ''
if ($estAdmin) {
  Write-Host 'Termine. Alcora est reconnu comme signe pour tous les comptes de ce PC.'
} else {
  Write-Host 'Termine. Alcora est reconnu comme signe pour le compte Windows courant.'
  Write-Host '(Pour toute la machine, relance ce script en administrateur.)'
}

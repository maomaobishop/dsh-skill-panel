# 从 DSH profile 里撤掉 dsh-skill-panel。
#
#   .\uninstall.ps1                   # 处理默认的 desktop profile
#   .\uninstall.ps1 -Profile web
#
# 会删掉 <profile>\node_modules\ 下的 junction、<profile>\plugins\ 下的副本，
# 并把 dsh-skill-panel 从 profile 的 package.json（dependencies / bundles）里摘掉。
# 若脚本本身就跑在安装目录里（仓库就地安装），只解链接、不删源码。

param(
  [string]$Profile = 'desktop',
  [string]$ProfileRoot = (Join-Path $env:USERPROFILE '.dsh\profiles')
)

$ErrorActionPreference = 'Stop'
$profileDir = Join-Path $ProfileRoot $Profile
$manifestPath = Join-Path $profileDir 'package.json'
$target = Join-Path $profileDir 'plugins\dsh-skill-panel'
$link = Join-Path $profileDir 'node_modules\dsh-skill-panel'

if (-not (Test-Path $manifestPath)) {
  throw "找不到 profile：$profileDir"
}

# 1. 解掉 node_modules 里的链接
if (Test-Path $link) {
  $existing = Get-Item $link -Force
  if ($existing.LinkType) { $existing.Delete() } else { Remove-Item $link -Recurse -Force }
  Write-Host '已删除 node_modules\dsh-skill-panel 链接'
}

# 2. 删掉插件副本；仓库就地安装时不删，只提示自行删除
$scriptPath = (Resolve-Path $PSScriptRoot).Path
$installedPath = if (Test-Path $target) { (Resolve-Path $target).Path } else { $null }
if ($null -ne $installedPath) {
  if ($scriptPath -eq $installedPath) {
    Write-Host "安装目录就是本仓库（$installedPath），未删除源码；不需要时手动删掉这个目录即可。"
  } else {
    Remove-Item $target -Recurse -Force
    Write-Host '已删除 plugins\dsh-skill-panel'
  }
}

# 3. 从 package.json 里摘掉登记
Copy-Item $manifestPath "$manifestPath.bak-skill-panel-uninstall" -Force
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($null -ne $manifest.dependencies -and $manifest.dependencies.PSObject.Properties.Name -contains 'dsh-skill-panel') {
  $manifest.dependencies.PSObject.Properties.Remove('dsh-skill-panel')
}
if ($null -ne $manifest.dsh -and $null -ne $manifest.dsh.profile -and $null -ne $manifest.dsh.profile.bundles) {
  $kept = @($manifest.dsh.profile.bundles) | Where-Object { $_ -ne 'dsh-skill-panel' }
  $manifest.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue $kept -Force
}
$manifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $manifestPath

Write-Host '已从 profile 的 package.json 摘掉 dsh-skill-panel'
Write-Host '重启 DeepSeek Harness 后，「技能」按钮就会消失。'

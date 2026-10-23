# 把 dsh-skill-panel 装进一个 DSH profile。
#
#   .\install.ps1                     # 装进默认的 desktop profile
#   .\install.ps1 -Profile web        # 装进 web profile
#   .\install.ps1 -Profile web -ProfileRoot 'D:\dsh\profiles'
#
# 做的事只有三件：把包文件复制到 <profile>\plugins\、在 <profile>\node_modules\ 下
# 建一个指向它的 junction、在 profile 的 package.json 里登记 dependencies 与 bundles。
# 改完必须重启 DSH（bundles 是启动期组合）。

param(
  [string]$Profile = 'desktop',
  [string]$ProfileRoot = (Join-Path $env:USERPROFILE '.dsh\profiles')
)

$ErrorActionPreference = 'Stop'
$source = $PSScriptRoot
$profileDir = Join-Path $ProfileRoot $Profile
$manifestPath = Join-Path $profileDir 'package.json'
$target = Join-Path $profileDir 'plugins\dsh-skill-panel'
$link = Join-Path $profileDir 'node_modules\dsh-skill-panel'

if (-not (Test-Path $manifestPath)) {
  throw "找不到 profile：$profileDir（先让 DSH 用这个 profile 启动一次，或用 -ProfileRoot 指定目录）"
}

# 1. 复制包文件。仓库本身就在安装位置时跳过，避免自己删自己。
if ((Resolve-Path $source).Path -ne (Resolve-Path $profileDir).Path + '\plugins\dsh-skill-panel') {
  if (Test-Path $target) { Remove-Item $target -Recurse -Force }
  New-Item -ItemType Directory -Force $target | Out-Null
  foreach ($item in @('lib', 'cordis.patch.yml', 'package.json', 'README.md', 'LICENSE')) {
    $from = Join-Path $source $item
    if (Test-Path $from) { Copy-Item $from (Join-Path $target $item) -Recurse -Force }
  }
}

# 2. node_modules 下的链接（只删链接，不跟随到真实目录）
New-Item -ItemType Directory -Force (Split-Path $link) | Out-Null
if (Test-Path $link) {
  $existing = Get-Item $link -Force
  if ($existing.LinkType) { $existing.Delete() } else { Remove-Item $link -Recurse -Force }
}
cmd /c mklink /J "$link" "$target" | Out-Null

# 3. 登记到 profile 的 package.json
Copy-Item $manifestPath "$manifestPath.bak-skill-panel" -Force
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

if ($null -eq $manifest.dependencies) {
  $manifest | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) -Force
}
$manifest.dependencies | Add-Member -NotePropertyName 'dsh-skill-panel' -NotePropertyValue 'file:./plugins/dsh-skill-panel' -Force

if ($null -eq $manifest.dsh) {
  $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force
}
if ($null -eq $manifest.dsh.profile) {
  $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force
}
$bundles = @($manifest.dsh.profile.bundles)
if ($bundles -notcontains 'dsh-skill-panel') {
  $manifest.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue ($bundles + 'dsh-skill-panel') -Force
}

$manifest | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $manifestPath

Write-Host "已安装到 $target"
Write-Host "已登记到 $manifestPath（备份：package.json.bak-skill-panel）"
Write-Host '重启 DeepSeek Harness 后，侧边栏底部会出现「技能」按钮。'

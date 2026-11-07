# 一键把 OpsToolbox 推到 GitHub（可选脚本，PowerShell 5.1+ / 7 均可）
# 用法（在本机没有 pwsh 时用 powershell）：
#   powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -Owner 你的GitHub用户名
#   powershell -ExecutionPolicy Bypass -File tools\publish.ps1 -Owner 你的GitHub用户名 -Repo ops-toolbox -Visibility public
# 不带 -Owner 时会尝试用 gh 登录的账号自动推断。

[CmdletBinding()]
param(
  [string]$Owner = "",
  [string]$Repo = "ops-toolbox",
  [ValidateSet("public", "private")]
  [string]$Visibility = "public",
  [string]$Message = "chore: 初始化 OpsToolbox"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Write-Step([string]$Text) { Write-Host $Text -ForegroundColor Cyan }

if (-not (Test-Command "git")) {
  Write-Host "没有找到 git，先把 git 装上：" -ForegroundColor Yellow
  Write-Host "  winget install --id Git.Git -e --source winget"
  Write-Host "  https://git-scm.com/download/win"
  exit 1
}

# 1) 推断账号，顺手把 README / package.json 里的占位用户名替换掉
if (-not $Owner -and (Test-Command "gh")) {
  try { $Owner = (gh api user -q .login 2>$null).Trim() } catch { $Owner = "" }
}

if ($Owner) {
  $touched = @()
  foreach ($file in @("README.md", "package.json")) {
    if (Test-Path $file) {
      $raw = Get-Content $file -Raw -Encoding UTF8
      if ($raw -like "*your-github-name*") {
        $raw.Replace("your-github-name", $Owner) | Set-Content $file -Encoding UTF8 -NoNewline
        $touched += $file
      }
    }
  }
  if ($touched.Count -gt 0) {
    Write-Host ("已把占位用户名换成 " + $Owner + "：" + ($touched -join "、")) -ForegroundColor Green
  }
} else {
  Write-Host "没推断出 GitHub 用户名，README 里的 your-github-name 需要你手动替换。" -ForegroundColor Yellow
}

# 2) 初始化 + 提交
if (-not (Test-Path ".git")) {
  Write-Step "初始化本地仓库…"
  git init -b main | Out-Null
}

$defaultName = if ($Owner) { $Owner } else { "ops-toolbox" }
if (-not (git config user.name)) { git config user.name $defaultName }
if (-not (git config user.email)) { git config user.email "$defaultName@users.noreply.github.com" }

git add -A
$pending = git status --porcelain
if ($pending) {
  git commit -m $Message | Out-Null
  Write-Host "已提交：$Message" -ForegroundColor Green
} else {
  Write-Host "没有需要提交的改动。" -ForegroundColor DarkGray
}

# 3) 远端
$remotes = git remote
if ($remotes -notcontains "origin") {
  if (Test-Command "gh") {
    $full = if ($Owner) { "$Owner/$Repo" } else { $Repo }
    Write-Step "用 GitHub CLI 创建仓库 $full …"
    gh repo create $full --$Visibility --source . --remote origin --push
    Write-Host "完成：https://github.com/$full" -ForegroundColor Green

    Write-Step "尝试开启 GitHub Pages（Actions 方式）…"
    try {
      gh api -X POST "repos/$full/pages" -f "build_type=workflow" | Out-Null
      Write-Host "Pages 已开启，推送到 main 后会自动发布。" -ForegroundColor Green
    } catch {
      Write-Host "自动开启 Pages 失败（可能已开启或权限不足），手动点一下即可：" -ForegroundColor DarkYellow
      Write-Host "  仓库 Settings → Pages → Source 选 GitHub Actions"
    }
  } else {
    Write-Host "没有找到 GitHub CLI（gh），手动完成最后两步：" -ForegroundColor Yellow
    Write-Host "  1) 打开 https://github.com/new 创建仓库（不要勾选 README）"
    Write-Host "  2) git remote add origin https://github.com/<你的用户名>/$Repo.git"
    Write-Host "     git push -u origin main"
  }
} else {
  Write-Step "origin 已存在，直接推送…"
  git push -u origin main
}

Write-Host ""
$siteOwner = if ($Owner) { $Owner } else { "<你的用户名>" }
Write-Host "站点地址（Pages 发布后）：https://$siteOwner.github.io/$Repo/" -ForegroundColor Cyan

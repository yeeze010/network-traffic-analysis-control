$ErrorActionPreference = "Stop"

$requiredFiles = @(
  "README.md",
  "docs/README.md",
  "docs/requirements/project-scope.md",
  "docs/requirements/functional-structure.md",
  "docs/requirements/business-process.md",
  "docs/design/ui-page-plan.md",
  "docs/design/permissions-metrics-matrix.md",
  "docs/architecture/system-architecture.md",
  "docs/architecture/data-model.md",
  "docs/api/api-plan.md",
  "docs/test/test-plan.md",
  "docs/deployment/deployment-plan.md",
  "docs/deployment/git-github-engineering.md",
  "docs/acceptance/acceptance-plan.md",
  "docs/acceptance/iteration-2026-06-05.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug-report.yml",
  ".github/ISSUE_TEMPLATE/feature-request.yml",
  ".github/workflows/docs-governance.yml"
)

$missing = @()
foreach ($file in $requiredFiles) {
  if (-not (Test-Path $file)) {
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Missing required files:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

$emptyFiles = @()
foreach ($file in $requiredFiles) {
  $item = Get-Item $file
  if ($item.Length -eq 0) {
    $emptyFiles += $file
  }
}

if ($emptyFiles.Count -gt 0) {
  Write-Host "Empty files detected:" -ForegroundColor Red
  $emptyFiles | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
  exit 1
}

Write-Host "Documentation baseline validation passed." -ForegroundColor Green

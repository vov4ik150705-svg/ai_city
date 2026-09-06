$blender = "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
$script = Join-Path $PSScriptRoot "factory.py"
# One Blender process per id: Eevee Next leaks shadow pages across frames in-process.
$ids = if ($args.Count -eq 0) {
  @("energy_plant")
} elseif ($args[0] -eq "all") {
  @("energy_plant", "city_hall", "ai_research_center", "finance_tower", "logistics_hub", "exchange", "robotics_lab")
} else {
  $args
}
$failed = 0
foreach ($id in $ids) {
  & $blender --background --python $script -- --id $id
  if ($LASTEXITCODE -ne 0) { $failed += 1 }
}
if ($failed -gt 0) { exit 1 }

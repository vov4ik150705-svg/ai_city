param(
  [Parameter(Mandatory=$true)][string]$RenderPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [double]$MarkHeight = 56.0,
  [double]$MarkTop = 34.0,
  [string]$RobinhoodLogoPath = '',
  [double]$RobinhoodX = 1398.0,
  [double]$RobinhoodY = 42.0,
  [double]$RobinhoodWidth = 222.0
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$sourcePath = 'C:/Users/sk640/ai_city/media/corporator_logo/logo solo.png'
$source = [System.Drawing.Bitmap]::new($sourcePath)
$left = $source.Width
$right = 0
$top = $source.Height
$bottom = 0
# Isolate the original monogram above the separate token wordmark.
$scanHeight = [int]($source.Height * 0.62)
for ($y = 0; $y -lt $scanHeight; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    $pixel = $source.GetPixel($x, $y)
    if ($pixel.R -lt 175 -and $pixel.G -lt 175 -and $pixel.B -lt 175) {
      if ($x -lt $left) { $left = $x }
      if ($x -gt $right) { $right = $x }
      if ($y -lt $top) { $top = $y }
      if ($y -gt $bottom) { $bottom = $y }
    }
  }
}
if ($right -le $left -or $bottom -le $top) { throw 'Original monogram could not be isolated.' }
$crop = [System.Drawing.Rectangle]::new($left - 2, $top - 2, $right - $left + 5, $bottom - $top + 5)
$mark = $source.Clone($crop, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $mark.Height; $y++) {
  for ($x = 0; $x -lt $mark.Width; $x++) {
    $pixel = $mark.GetPixel($x, $y)
    if ($pixel.R -gt 220 -and $pixel.G -gt 220 -and $pixel.B -gt 220) {
      $mark.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
    }
  }
}
$render = [System.Drawing.Bitmap]::new($RenderPath)
$canvas = [System.Drawing.Bitmap]::new($render.Width, $render.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.DrawImageUnscaled($render, 0, 0)
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$scale = $render.Width / 1672.0
$targetHeight = $MarkHeight * $scale
$targetWidth = $targetHeight * $mark.Width / $mark.Height
$targetX = 82.5 * $scale - $targetWidth / 2.0
$targetY = $MarkTop * $scale
$destination = [System.Drawing.RectangleF]::new([single]$targetX, [single]$targetY, [single]$targetWidth, [single]$targetHeight)
$graphics.DrawImage($mark, $destination)
if ($RobinhoodLogoPath) {
  # Place the unmodified official transparent wordmark, including its feather.
  $robinhood = [System.Drawing.Bitmap]::new($RobinhoodLogoPath)
  $robinhoodTargetWidth = $RobinhoodWidth * $scale
  $robinhoodTargetHeight = $robinhoodTargetWidth * $robinhood.Height / $robinhood.Width
  $robinhoodDestination = [System.Drawing.RectangleF]::new(
    [single]($RobinhoodX * $scale), [single]($RobinhoodY * $scale),
    [single]$robinhoodTargetWidth, [single]$robinhoodTargetHeight
  )
  $graphics.DrawImage($robinhood, $robinhoodDestination)
  $robinhood.Dispose()
}
$canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$canvas.Dispose()
$render.Dispose()
$mark.Dispose()
$source.Dispose()
Get-Item -LiteralPath $OutputPath | Select-Object Name, Length

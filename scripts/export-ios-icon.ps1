# Render the existing SVG logo as an opaque store icon (Windows only).
Add-Type -AssemblyName System.Drawing
$taskRoot = Split-Path $PSScriptRoot -Parent
[xml]$taskSvg = Get-Content -LiteralPath (Join-Path $taskRoot 'apps/app/assets/topout-icon.svg') -Raw
$taskBitmap = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$taskGraphics = [System.Drawing.Graphics]::FromImage($taskBitmap)
$taskPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
$taskPen = [System.Drawing.Pen]::new(
    [System.Drawing.ColorTranslator]::FromHtml($taskSvg.svg.path.stroke),
    [single]$taskSvg.svg.path.'stroke-width' * 16
)
try {
    $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $taskGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml($taskSvg.svg.rect.fill))
    # The logo is a move followed by a polyline, expressed in a 64-unit viewBox.
    $taskCoordinates = [regex]::Matches($taskSvg.svg.path.d, '\d+(?:\.\d+)?')
    $taskPoints = for ($taskIndex = 0; $taskIndex -lt $taskCoordinates.Count; $taskIndex += 2) {
        [System.Drawing.PointF]::new(
            [single]$taskCoordinates[$taskIndex].Value * 16,
            [single]$taskCoordinates[$taskIndex + 1].Value * 16
        )
    }
    $taskPath.AddLines([System.Drawing.PointF[]]$taskPoints)
    $taskPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Square
    $taskPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Square
    $taskPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Miter
    $taskGraphics.DrawPath($taskPen, $taskPath)
    $taskBitmap.Save(
        (Join-Path $taskRoot 'apps/app/assets/topout-ios-icon.png'),
        [System.Drawing.Imaging.ImageFormat]::Png
    )
} finally {
    $taskPen.Dispose()
    $taskPath.Dispose()
    $taskGraphics.Dispose()
    $taskBitmap.Dispose()
}

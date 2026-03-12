$filePath = 'd:\toanthang\web\src\components\warehouse\FlexibleZoneGrid.tsx'
$c = Get-Content $filePath -Raw

# 1. Update Container for Grid and Section (restore Dashboard visibility)
$brokenContainer = 'className={`flex items-center gap-2 print:hidden ${(!isPrintPage || isCapturing) ? "hidden" : ""}`}'
$fixedContainer = 'className={`flex items-center gap-2 print:hidden ${isCapturing ? "hidden" : ""}`}'
$c = $c.Replace($brokenContainer, $fixedContainer)

# 2. Add isPrintPage condition to "Gộp ô" button
# We look for the button content and prefix it with isPrintPage &&
$c = $c -replace '(?s)(\{isGrouped && \(isLevelUnderBin \|\| isBigBin\))', '{isPrintPage && $1'

# 3. Add isPrintPage condition to "Ngắt trang" button
$c = $c -replace '(?s)(\{onTogglePageBreak &&)', '{isPrintPage && $1'

# 4. Add !isPrintPage condition to "In sơ đồ" button
# Looking for {onPrintZone && (
$c = $c -replace '(?s)(\{onPrintZone && \()', '{!isPrintPage && $1'

$c | Set-Content $filePath

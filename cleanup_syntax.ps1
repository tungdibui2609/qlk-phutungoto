$filePath = 'd:\toanthang\web\src\components\warehouse\FlexibleZoneGrid.tsx'
$c = Get-Content $filePath -Raw

# Remove double braces introduced by previous script
$c = $c -replace '\{isPrintPage && \{', '{isPrintPage && '
$c = $c -replace '\{!isPrintPage && \{', '{!isPrintPage && '

$c | Set-Content $filePath

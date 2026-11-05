$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$docPath = Join-Path $taskRoot 'docs/FORME_Project_Architecture_and_Feature_Guide.docx'
$pdfPath = Join-Path $PSScriptRoot 'FORME_QA.pdf'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $document = $word.Documents.Open($docPath, $false, $true)
    $document.Repaginate()
    Write-Output ('Pages: ' + $document.ComputeStatistics(2))
    $document.ExportAsFixedFormat($pdfPath, 17)
    $document.Close(0)
    Write-Output $pdfPath
} finally {
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}

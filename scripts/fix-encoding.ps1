<#
  Finds source files saved with a byte-order mark or as UTF-16 — the cause of
  "error at line 1, column 1" build failures. Node and TypeScript expect UTF-8
  with no BOM; Notepad and some Office editors do not write that by default.

  Run from the project root:
      powershell -ExecutionPolicy Bypass -File .\fix-encoding.ps1          # report only
      powershell -ExecutionPolicy Bypass -File .\fix-encoding.ps1 -Fix     # rewrite them
#>
param([switch]$Fix)

$root = (Get-Location).Path
$skip = '\\(node_modules|\.next|\.git|out|dist|build)\\'
$exts = @('.json','.ts','.tsx','.js','.jsx','.mjs','.cjs','.css','.md','.mts')

$bad = @()

Get-ChildItem -Path $root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $exts -contains $_.Extension -and $_.FullName -notmatch $skip } |
  ForEach-Object {
    $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
    if ($bytes.Length -lt 2) { return }

    $kind = $null
    if     ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $kind = 'UTF-8 BOM' }
    elseif ($bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) { $kind = 'UTF-16 LE' }
    elseif ($bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) { $kind = 'UTF-16 BE' }
    if (-not $kind) { return }

    $rel = $_.FullName.Substring($root.Length).TrimStart('\')
    $bad += [pscustomobject]@{ File = $rel; Encoding = $kind }

    if ($Fix) {
      switch ($kind) {
        'UTF-8 BOM' { $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3) }
        'UTF-16 LE' { $text = [System.Text.Encoding]::Unicode.GetString($bytes) }
        'UTF-16 BE' { $text = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes) }
      }
      $text = $text.TrimStart([char]0xFEFF)
      # UTF8Encoding($false) = no BOM on write.
      [System.IO.File]::WriteAllBytes(
        $_.FullName,
        (New-Object System.Text.UTF8Encoding($false)).GetBytes($text)
      )
    }
  }

if ($bad.Count -eq 0) {
  Write-Host "Clean - no BOM or UTF-16 files found." -ForegroundColor Green
} else {
  $bad | Format-Table -AutoSize
  if ($Fix) {
    Write-Host "$($bad.Count) file(s) rewritten as UTF-8 without a BOM." -ForegroundColor Yellow
  } else {
    Write-Host "$($bad.Count) file(s) would break the build. Re-run with -Fix to repair them." -ForegroundColor Yellow
  }
}

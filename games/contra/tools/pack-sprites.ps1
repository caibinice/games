param([Parameter(Mandatory=$true)][string]$SourceDirectory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$out=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/assets'))
$files=Get-ChildItem -LiteralPath $SourceDirectory -File | Where-Object {$_.Extension -in '.png','.gif'} | Sort-Object Name
if($files.Count -ne 186){throw 'Expected the 186 recorded original sprites'}
$atlas=[Drawing.Bitmap]::new(1280,960,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics=[Drawing.Graphics]::FromImage($atlas)
$graphics.Clear([Drawing.Color]::Transparent)
$graphics.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
$rects=[ordered]@{}
try{
 for($i=0;$i -lt $files.Count;$i++){
  $source=[Drawing.Bitmap]::new($files[$i].FullName)
  try{
   if($source.Width -gt 80 -or $source.Height -gt 80){throw 'Sprite exceeds packing cell'}
   $x=($i%16)*80;$y=[int][Math]::Floor($i/16)*80
   $graphics.DrawImageUnscaled($source,$x,$y)
   for($sy=0;$sy -lt $source.Height;$sy++){for($sx=0;$sx -lt $source.Width;$sx++){
    $pixel=$source.GetPixel($sx,$sy)
    if($pixel.A -gt 0 -and $atlas.GetPixel($x+$sx,$y+$sy).ToArgb() -ne $pixel.ToArgb()){throw 'Visible source pixel changed'}
   }}
   $rects[$files[$i].BaseName]=[ordered]@{x=$x;y=$y;w=$source.Width;h=$source.Height}
  }finally{$source.Dispose()}
 }
 $atlas.Save((Join-Path $out 'sprites.png'),[Drawing.Imaging.ImageFormat]::Png)
 $rects | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $out 'sprites.json') -Encoding utf8NoBOM
 Write-Output "Packed $($files.Count) sprites; all visible original pixels verified unchanged"
}finally{$graphics.Dispose();$atlas.Dispose()}

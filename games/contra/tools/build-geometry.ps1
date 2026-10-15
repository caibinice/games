$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assets=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../public/assets'))
$crops=Get-Content -LiteralPath (Join-Path $assets 'map-crops.json') -Raw | ConvertFrom-Json
$levels=[ordered]@{}
foreach($level in @(3,5,6,7,8)){
 $crop=$crops[$level-1];$bitmap=[Drawing.Bitmap]::new((Join-Path $assets $crop.file))
 $platforms=[Collections.Generic.List[object]]::new()
 try{
  $cols=[int][Math]::Floor($crop.width/16)
  $last=@{};$cells=@{}
  for($y=0;$y -lt $crop.height;$y++){
   for($col=0;$col -lt $cols;$col++){
    if($last.ContainsKey($col) -and ($y-$last[$col]) -lt 16){continue}
    $count=0
    if($level -eq 5){
     if($y%16 -ne 0){continue}
     for($dy=0;$dy -lt 16;$dy+=2){for($dx=0;$dx -lt 16;$dx+=2){
      $color=$bitmap.GetPixel($crop.x+$col*16+$dx,$crop.y+$y+$dy).ToArgb().ToString('X8')
      if($color -in @('FFBCBCBC','FFFCFCFC','FF008088')){$count++}
     }}
     $qualifies=$count -ge 38
    }else{
     $wanted=switch($level){3{'FF00A800'}6{'FF00A800'}7{'FFFC9838'}8{'FFA40000'}}
     for($dx=0;$dx -lt 16;$dx++){
      if($bitmap.GetPixel($crop.x+$col*16+$dx,$crop.y+$y).ToArgb().ToString('X8') -eq $wanted){$count++}
     }
     $qualifies=$count -ge 7
    }
    if($qualifies){
     # Ice blocks merge vertically; only their exposed top is a landing edge.
     if($level -eq 5 -and $cells.ContainsKey("$col,$($y-16)")){$cells["$col,$y"]=$true;continue}
     $cells["$col,$y"]=$true;$last[$col]=$y
     $platforms.Add([pscustomobject]@{x=$col*16;y=$y;w=16;h=8})
    }
   }
  }
  # Hangar's long grey walkways have no orange lip. Recover their exposed
  # block tops as well, without treating the rail artwork as invisible floor.
  if($level -eq 7){
   $solid=@{}
   for($gy=0;$gy -lt 14;$gy++){for($col=0;$col -lt $cols;$col++){
    $count=0
    for($dy=0;$dy -lt 16;$dy+=2){for($dx=0;$dx -lt 16;$dx+=2){
     $color=$bitmap.GetPixel($crop.x+$col*16+$dx,$crop.y+$gy*16+$dy).ToArgb().ToString('X8')
     if($color -in @('FF747474','FFBCBCBC','FFFCFCFC')){$count++}
    }}
    if($count -ge 32){$solid["$col,$gy"]=$true;if(!$solid.ContainsKey("$col,$($gy-1)")){$platforms.Add([pscustomobject]@{x=$col*16;y=$gy*16;w=16;h=8})}}
   }}
  }
  $merged=[Collections.Generic.List[object]]::new()
  foreach($row in ($platforms|Group-Object y)){
   $current=$null
   foreach($p in ($row.Group|Sort-Object x)){
    if($null -ne $current -and $current.x+$current.w -eq $p.x){$current.w+=16}
    else{if($null -ne $current){$merged.Add($current)};$current=[ordered]@{x=$p.x;y=$p.y;w=16;h=8}}
   }
   if($null -ne $current){$merged.Add($current)}
  }
  $levels["$level"]=[ordered]@{width=$crop.width;height=$crop.height;platforms=@($merged.ToArray());source='Landing edges annotated from the native pixel-map palette; see tools/build-geometry.ps1'}
  Write-Output "Stage $level : $($merged.Count) native-map landing edges"
 }finally{$bitmap.Dispose()}
}
$levels | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath (Join-Path $assets 'geometry.json') -Encoding utf8NoBOM

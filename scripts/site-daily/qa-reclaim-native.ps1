param([Parameter(Mandatory=$true)][string]$Request)
$ErrorActionPreference='Stop'
$spec=Get-Content -LiteralPath $Request -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class QaReclaimNative {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetCompressedFileSizeW(string path,out uint high);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFileW(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool DeviceIoControl(SafeFileHandle h,uint code,IntPtr input,int inputSize,byte[] output,int outputSize,out int returned,IntPtr overlapped);
 [StructLayout(LayoutKind.Sequential)] struct Info {public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Creation;public System.Runtime.InteropServices.ComTypes.FILETIME Access;public System.Runtime.InteropServices.ComTypes.FILETIME Write;public uint Volume;public uint SizeHigh;public uint SizeLow;public uint Links;public uint IndexHigh;public uint IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out Info info);
 public static uint Links(string path) {using(var h=CreateFileW(path,0,7,IntPtr.Zero,3,0,IntPtr.Zero)){Info i;if(h.IsInvalid||!GetFileInformationByHandle(h,out i))throw new IOException("file-link-query-failed");return i.Links;}}
 public static long Allocated(string path) {uint hi;uint lo=GetCompressedFileSizeW(path,out hi);int error=Marshal.GetLastWin32Error();if(lo==UInt32.MaxValue&&error!=0)throw new System.ComponentModel.Win32Exception(error);return ((long)hi<<32)|lo;}
 public static uint ReparseTag(string path) {if((File.GetAttributes(path)&FileAttributes.ReparsePoint)==0)return 0;using(var h=CreateFileW(path,0,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)){if(h.IsInvalid)throw new IOException("reparse-open-failed");byte[] b=new byte[16384];int n;if(!DeviceIoControl(h,0x000900a8,IntPtr.Zero,0,b,b.Length,out n,IntPtr.Zero))throw new IOException("reparse-query-failed");return BitConverter.ToUInt32(b,0);}}
}
'@
function Get-QaProcesses {
 @((Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='chrome.exe' OR Name='chromium.exe'" -OperationTimeoutSec 10 -ErrorAction Stop) | Where-Object {
  $_.ProcessId -ne $spec.ignorePid -and $_.CommandLine -and $_.CommandLine -match '(?i)(scripts[\\/]site-daily[\\/](?:scoped-native|runner)\.mjs|scripts[\\/]companion-qa[\\/]runner\.mjs|playwright[^\r\n]*(?:test|\.scratch)|(?:next|next-server)[^\r\n]*(?:build|dev|start)|next-server)'
 } | ForEach-Object { @{pid=$_.ProcessId;reason='active-qa-or-fixture-process'} })
}
function Assert-SafeCache([string]$file,[bool]$cacheRoot=$false) {
 $full=[IO.Path]::GetFullPath($file);$base=[IO.Path]::GetFullPath($spec.root).TrimEnd('\')+'\'
 if(-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'native-outside-project'}
 $rel=$full.Substring($base.Length).Replace('\','/')
 $pattern='^(?:\.scratch-pw|\.scratch\d{2,})/(?:[^/]+/)+workspace/\.next/cache'
 if($cacheRoot){$pattern+='\z'}else{$pattern+='/.+\z'}
 if($rel -notmatch $pattern -or $rel -match '(?i)(?:^|/)(?:\.git|\.env(?:\.[^/]*)?|node_modules|art-src|public|assets|originals?|references?|backups?|recovery|secrets?|credentials?|sessions?|cookies?|private|analytics|telemetry|api-cache|login)(?:/|$)' -or $rel -match '(?:^|/)(?:\.|\.\.)(?:/|$)' -or $rel -match '[:*?]'){throw 'native-unsafe-cache-path'}
 $parent=$full
 if(-not $cacheRoot){$parent=[IO.Path]::GetDirectoryName($full)}
 while($parent -and $parent.StartsWith($base.TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){
  if(([IO.File]::GetAttributes($parent) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'native-linked-parent'}
  if($parent -eq $base.TrimEnd('\')){break};$parent=[IO.Path]::GetDirectoryName($parent)
 }
 if(-not $cacheRoot){$tag=[QaReclaimNative]::ReparseTag($full);if($tag -ne 0 -and $tag -ne [uint32]2147483671){throw 'native-linked-cache-file'}}
 $full
}
function File-Info([string]$file) {
 try {
  $full=Assert-SafeCache $file;$item=Get-Item -LiteralPath $full -Force
  if($item.PSIsContainer){throw 'native-regular-cache-file-required'}
  $tag=[QaReclaimNative]::ReparseTag($full)
  @{path=$full;size=[long]$item.Length;nlink=[QaReclaimNative]::Links($full);allocatedBytes=[QaReclaimNative]::Allocated($full);unsafeReparse=($tag -ne 0 -and $tag -ne [uint32]2147483671);mtimeTicks=$item.LastWriteTimeUtc.Ticks}
 }catch{ @{path=$file;error=$_.Exception.Message} }
}
function Hash-Stream([IO.Stream]$stream) {
 $algorithm=[Security.Cryptography.SHA256]::Create()
 try {$stream.Position=0;[BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}
 finally {$algorithm.Dispose()}
}
function Hash-File([string]$file) {
 $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try {Hash-Stream $stream}finally{$stream.Dispose()}
}
function Assert-Protections {
 foreach($state in $spec.states){
  if($state.missing){if(Test-Path -LiteralPath $state.path){throw 'state-created-during-reclaim'}}
  elseif((Hash-File $state.path) -ne $state.sha256){throw 'state-mutated-during-reclaim'}
 }
 foreach($reference in $spec.references){if((Hash-File $reference.path) -ne $reference.sha256){throw 'reference-mutated-during-reclaim'}}
 if(@(Get-QaProcesses).Count -gt 0){throw 'active-qa-during-reclaim'}
}
$drive=New-Object IO.DriveInfo([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($spec.root)))
$result=@{fileSystem=$drive.DriveFormat;activeProcesses=@(Get-QaProcesses);files=@();caches=@();failure=$null;freeBytesBefore=$drive.AvailableFreeSpace}
if($spec.mode -eq 'inspect'){foreach($file in $spec.paths){$result.files+=,(File-Info $file)}}
elseif($spec.mode -eq 'remove-cache'){
 foreach($cache in $spec.caches){
  $event=@{path=$cache.path;status='not-executed';files=@($cache.files).Count;allocatedBefore=0L};$handles=New-Object 'System.Collections.Generic.List[System.IO.FileStream]'
  try{
   if($drive.DriveFormat -ne 'NTFS'){throw 'native-ntfs-required'}
   if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$spec.deadline){$event.status='budget-deferred';throw 'reclaim-budget-ended'}
   Assert-Protections
   $target=Assert-SafeCache ([IO.Path]::Combine($spec.root,$cache.path.Replace('/','\'))) $true
   foreach($control in $cache.controls){if((Hash-File ([IO.Path]::Combine($spec.root,$control.path.Replace('/','\')))) -ne $control.sha256){throw 'control-mutated-before-reclaim'}}
   # Keep read/delete-only handles open through removal: concurrent writes fail,
   # and only files already pinned in the plan may occur in the cache tree.
   foreach($row in $cache.files){
    $full=Assert-SafeCache ([IO.Path]::Combine($spec.root,$row.path.Replace('/','\')))
    $stream=[IO.File]::Open($full,[IO.FileMode]::Open,[IO.FileAccess]::Read,([IO.FileShare]::Read -bor [IO.FileShare]::Delete));$handles.Add($stream)
    $info=File-Info $full
    if($info.error -or $info.unsafeReparse -or $info.nlink -ne 1 -or $info.size -ne $row.size -or (Hash-Stream $stream) -ne $row.sha256){throw 'native-cache-file-mutated'}
    $event.allocatedBefore+=[long]$info.allocatedBytes
   }
   $all=@(Get-ChildItem -LiteralPath $target -Force -Recurse -ErrorAction Stop)
   if(@($all|Where-Object {($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -and ($_.PSIsContainer -or [QaReclaimNative]::ReparseTag($_.FullName) -ne [uint32]2147483671)}).Count){throw 'native-cache-tree-linked'}
   $expected=@($cache.files|ForEach-Object {[IO.Path]::GetFullPath([IO.Path]::Combine($spec.root,$_.path.Replace('/','\'))).ToLowerInvariant()}|Sort-Object)
   $actual=@($all|Where-Object {-not $_.PSIsContainer}|ForEach-Object {$_.FullName.ToLowerInvariant()}|Sort-Object)
   if(($expected -join "`n") -ne ($actual -join "`n")){throw 'native-cache-file-set-mutated'}
   $expectedDirs=@($cache.directories|ForEach-Object {[IO.Path]::GetFullPath([IO.Path]::Combine($spec.root,$_.path.Replace('/','\'))).ToLowerInvariant()}|Sort-Object)
   $actualDirs=@(@($target.ToLowerInvariant())+@($all|Where-Object {$_.PSIsContainer}|ForEach-Object {$_.FullName.ToLowerInvariant()})|Sort-Object)
   if(($expectedDirs -join "`n") -ne ($actualDirs -join "`n")){throw 'native-cache-directory-set-mutated'}
   Assert-Protections
   # Target was resolved and verified above; use one shell and literal native
   # PowerShell removal only. No source, build output or raw failure is removed.
   Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
   if(Test-Path -LiteralPath $target){throw 'native-cache-still-present'}
   $event.status='removed';$event.preDeletionHashesVerified=$true
  }catch{$event.error=$_.Exception.Message;if($event.status -ne 'budget-deferred'){$event.status='failed';$result.failure=$event.error}}
  finally{
   foreach($handle in $handles){$handle.Dispose()}
   $result.caches+=,$event
   [IO.File]::AppendAllText($spec.journal,(ConvertTo-Json -InputObject $event -Depth 8 -Compress)+"`n",(New-Object Text.UTF8Encoding($false)))
  }
  if($result.failure -or $event.status -eq 'budget-deferred'){break}
 }
}elseif($spec.mode -ne 'environment'){throw 'unknown-reclaim-native-mode'}
$drive=New-Object IO.DriveInfo($drive.Name);$result.freeBytesAfter=$drive.AvailableFreeSpace
[IO.File]::WriteAllText($spec.output,(ConvertTo-Json -InputObject $result -Depth 12),(New-Object Text.UTF8Encoding($false)))

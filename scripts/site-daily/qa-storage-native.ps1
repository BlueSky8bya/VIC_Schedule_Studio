param([Parameter(Mandatory=$true)][string]$Request)
$ErrorActionPreference='Stop'
$spec=Get-Content -LiteralPath $Request -Raw -Encoding UTF8 | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class QaStorageNative {
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
 } | ForEach-Object { @{pid=$_.ProcessId;reason='active-qa-or-owned-fixture-process'} })
}
function Assert-SafeFile([string]$file) {
 $full=[IO.Path]::GetFullPath($file);$base=[IO.Path]::GetFullPath($spec.root).TrimEnd('\')+'\'
 if(-not $full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'native-outside-project'}
 $rel=$full.Substring($base.Length).Replace('\','/')
 if($rel -notmatch '^(?:\.scratch-pw|\.scratch\d{2,})/' -or $rel -like '.scratch-pw/site-daily/storage/*' -or $rel -match '(?i)(?:^|/)(?:\.git|\.env(?:\.[^/]*)?|node_modules|art-src|public|assets|originals?|references?|backups?|recovery|secrets?|credentials?|sessions?|cookies?|private|analytics|telemetry|api-cache|login)(?:/|$)'){throw 'native-unsafe-qa-path'}
 $parent=[IO.Path]::GetDirectoryName($full)
 while($parent -and $parent.StartsWith($base.TrimEnd('\'),[StringComparison]::OrdinalIgnoreCase)){
  if(([IO.File]::GetAttributes($parent) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'native-linked-parent'}
  if($parent -eq $base.TrimEnd('\')){break};$parent=[IO.Path]::GetDirectoryName($parent)
 }
 $tag=[QaStorageNative]::ReparseTag($full)
 if($tag -ne 0 -and $tag -ne [uint32]2147483671){throw 'native-unsafe-reparse-file'}
 $full
}
function File-Info([string]$file) {
 try {
  $full=Assert-SafeFile $file;$item=Get-Item -LiteralPath $full -Force
  if($item.PSIsContainer){throw 'native-regular-file-required'}
  $tag=[QaStorageNative]::ReparseTag($full)
  @{path=$full;size=[long]$item.Length;nlink=[QaStorageNative]::Links($full);allocatedBytes=[QaStorageNative]::Allocated($full);wof=($tag -eq [uint32]2147483671);unsafeReparse=($tag -ne 0 -and $tag -ne [uint32]2147483671);encrypted=(($item.Attributes -band [IO.FileAttributes]::Encrypted) -ne 0);mtimeTicks=$item.LastWriteTimeUtc.Ticks}
 }catch{ @{path=$file;error=$_.Exception.Message} }
}
function Hash-File([string]$file) {
 $stream=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 $algorithm=[Security.Cryptography.SHA256]::Create()
 try { [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
 finally { $algorithm.Dispose();$stream.Dispose() }
}
$drive=New-Object IO.DriveInfo([IO.Path]::GetPathRoot([IO.Path]::GetFullPath($spec.root)))
$result=@{fileSystem=$drive.DriveFormat;activeProcesses=@(Get-QaProcesses);files=@();failure=$null}
if($spec.mode -eq 'inspect') { foreach($file in $spec.paths){$result.files+=,(File-Info $file)} }
elseif($spec.mode -eq 'compress') {
 $lastProcessCheck=0L
 foreach($row in $spec.files){
  $event=@{path=$row.path;size=[long]$row.size;status='not-executed'}
  try {
   if([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$spec.deadline){$event.status='budget-deferred';throw 'storage-budget-ended'}
   if($drive.DriveFormat -ne 'NTFS'){throw 'native-ntfs-required'}
   foreach($state in $spec.states){
    if($state.missing){if(Test-Path -LiteralPath $state.path){throw 'state-created-during-maintenance'}}
    elseif((Hash-File $state.path) -ne $state.sha256){throw 'state-mutated-during-maintenance'}
   }
   $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
   if($now-$lastProcessCheck -ge 5000){if(@(Get-QaProcesses).Count -gt 0){throw 'active-qa-process-during-maintenance'};$lastProcessCheck=$now}
   $before=File-Info $row.path
   if($before.error -or $before.encrypted -or $before.unsafeReparse -or $before.nlink -ne 1){throw 'native-candidate-unsafe'}
   if($before.wof -or $before.allocatedBytes+4096 -lt $before.size){$event.status='already-compressed';continue}
   if($before.size -ne $row.size -or (Hash-File $row.path) -ne $row.sha256){throw 'native-candidate-mutated'}
   $event.allocatedBefore=$before.allocatedBytes;$event.sha256Before=$row.sha256
   # Explicit single file: no /S recursion, wildcard, deletion, relocation or lossy encoding.
   $childLog=$spec.journal+'.compact-'+[Guid]::NewGuid().ToString()
   $startInfo=New-Object Diagnostics.ProcessStartInfo
   $startInfo.FileName="$env:SystemRoot\System32\compact.exe";$startInfo.Arguments='/C /EXE:LZX /I /Q "'+$row.path+'"'
   $startInfo.UseShellExecute=$false;$startInfo.CreateNoWindow=$true;$startInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
   $startInfo.RedirectStandardOutput=$true;$startInfo.RedirectStandardError=$true
   $compact=New-Object Diagnostics.Process;$compact.StartInfo=$startInfo
   if(-not $compact.Start()){throw 'native-compact-start-failed'}
   $stdoutTask=$compact.StandardOutput.ReadToEndAsync();$stderrTask=$compact.StandardError.ReadToEndAsync()
   $waitMs=[int][Math]::Max(1,[Math]::Min(60000,[long]$spec.deadline-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()))
   $timedOut=-not $compact.WaitForExit($waitMs)
   if($timedOut){$compact.Kill();$compact.WaitForExit()}else{$compact.WaitForExit()}
   [IO.File]::WriteAllText(($childLog+'.stdout.log'),$stdoutTask.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
   [IO.File]::WriteAllText(($childLog+'.stderr.log'),$stderrTask.GetAwaiter().GetResult(),(New-Object Text.UTF8Encoding($false)))
   $code=$compact.ExitCode;$after=File-Info $row.path;$afterHash=Hash-File $row.path
   $event.compactPid=$compact.Id;$event.compactTimedOut=$timedOut
   $event.compactExitCode=$code;$event.allocatedAfter=$after.allocatedBytes;$event.sha256After=$afterHash
   if($afterHash -ne $row.sha256 -or $after.size -ne $row.size -or $after.mtimeTicks -ne $before.mtimeTicks){throw 'native-post-compression-content-or-mtime-mismatch'}
   if($timedOut){throw 'native-owned-compact-timeout'}
   if($code -ne 0){throw 'native-compact-command-failed'}
   $event.status='compressed';$event.contentVerified=$true;$event.wof=$after.wof
  }catch{
   $event.error=$_.Exception.Message
   if($event.status -ne 'budget-deferred'){$event.status='failed';$result.failure=$event.error}
  }finally{
   $result.files+=,$event
   $line=ConvertTo-Json -InputObject $event -Depth 8 -Compress
   [IO.File]::AppendAllText($spec.journal,$line+"`n",(New-Object Text.UTF8Encoding($false)))
  }
  if($result.failure -or $event.status -eq 'budget-deferred'){break}
 }
}
elseif($spec.mode -ne 'environment'){throw 'unknown-storage-native-mode'}
$json=ConvertTo-Json -InputObject $result -Depth 12
[IO.File]::WriteAllText($spec.output,$json,(New-Object Text.UTF8Encoding($false)))

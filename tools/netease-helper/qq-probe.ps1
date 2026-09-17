$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new()
$player=Get-Process QQMusic -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
if (!$player) { @{outcome='unavailable';code='not-open'} | ConvertTo-Json -Compress; exit }
try {
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 $root=[System.Windows.Automation.AutomationElement]::FromHandle($player.MainWindowHandle)
 $children=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
 if ($children.Count -eq 0) { @{outcome='unavailable';code='no-controls'} | ConvertTo-Json -Compress; exit }
 @{outcome='unknown';code='unverified-controls'} | ConvertTo-Json -Compress
} catch {
 @{outcome='unknown';code='inspection-failed'} | ConvertTo-Json -Compress
}

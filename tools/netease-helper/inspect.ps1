Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
[Console]::OutputEncoding=[Text.UTF8Encoding]::new()
$process=Get-Process cloudmusic -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
if(!$process){'NO WINDOW';exit}
$condition=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$process.Id)
$window=[System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,$condition)
if(!$window){'NO UIA ROOT';exit}
'WINDOW: '+$window.Current.Name
$all=$window.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$count=[Math]::Min($all.Count,300)
for($i=0;$i -lt $count;$i++){
 $element=$all.Item($i)
 $name=$element.Current.Name
 if($name.Length -gt 100){$name=$name.Substring(0,100)}
 if($name -or $element.Current.ControlType -eq [System.Windows.Automation.ControlType]::Edit){'{0}: {1} | {2} | {3}' -f $i,$element.Current.ControlType.ProgrammaticName,$name,$element.Current.AutomationId}
}

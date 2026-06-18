$log = "C:\Users\rubih\tasufull-article\.tmp-admin-network-setup.log"
"=== START $(Get-Date -Format o) ===" | Out-File $log -Encoding utf8
try {
  Set-NetConnectionProfile -InterfaceAlias "イーサネット" -NetworkCategory Private -ErrorAction Stop
  "Set-NetConnectionProfile: OK" | Out-File $log -Append -Encoding utf8
} catch {
  "Set-NetConnectionProfile: FAIL - $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
}
Get-NetConnectionProfile -InterfaceAlias "イーサネット" | Format-List Name, InterfaceAlias, NetworkCategory | Out-File $log -Append -Encoding utf8
try {
  $existing = Get-NetFirewallRule -DisplayName "Vite Dev Server 5174" -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule -DisplayName "Vite Dev Server 5174" -Direction Inbound -Protocol TCP -LocalPort 5174 -Action Allow -Profile Private,Public -ErrorAction Stop | Out-Null
    "New-NetFirewallRule: OK" | Out-File $log -Append -Encoding utf8
  } else {
    "New-NetFirewallRule: already exists" | Out-File $log -Append -Encoding utf8
  }
} catch {
  "New-NetFirewallRule: FAIL - $($_.Exception.Message)" | Out-File $log -Append -Encoding utf8
}
Get-NetFirewallRule -DisplayName "Vite Dev Server 5174" -ErrorAction SilentlyContinue | Format-List DisplayName, Enabled, Direction, Action, Profile | Out-File $log -Append -Encoding utf8
"=== END ===" | Out-File $log -Append -Encoding utf8

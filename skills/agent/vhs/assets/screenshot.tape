# A composed still uses Screenshot, not Output image.png.
Require bash
Set Shell "bash"
Set Columns 64
Set Rows 12
Set FontSize 24
Set Padding 20
Set CursorBlink false
Set Framerate 20
Set TypingSpeed 0ms
Set WaitTimeout 10s
Set WaitPattern /^>\s*$/

Hide
Wait
Ctrl+L
Sleep 200ms
Show
Type "printf '%s\n' 'Terminal screenshot' 'Status: ready'"
Enter
Wait+Screen /(?m)^Status: ready$/
Wait
Sleep 200ms
Screenshot "screenshot.png"
Sleep 300ms

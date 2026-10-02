# Run from a writable scratch directory with Bash, ttyd, and FFmpeg installed.
Output "artifacts/demo.gif"
Output "artifacts/demo.mp4"
Output "artifacts/demo.webm"
Output "artifacts/demo.ascii"
Require bash
Set Shell "bash"
Set Width 960
Set Height 540
Set FontSize 24
Set Padding 24
Set Margin 16
Set MarginFill "#243040"
Set WindowBar Colorful
Set WindowBarSize 30
Set BorderRadius 12
Set CursorBlink false
Set Framerate 20
Set TypingSpeed 35ms
Set WaitTimeout 10s
Set WaitPattern /^>\s*$/
Env DEMO_LABEL "VHS demo"

Hide
Type@0ms "mkdir -p artifacts"
Enter
Wait
Ctrl+L
Sleep 200ms
Show
Sleep 300ms
Type `printf '%s\n' "$DEMO_LABEL"`
Enter
Wait+Screen /(?m)^VHS demo$/
Wait
Sleep 1s
Screenshot "artifacts/demo.png"
Sleep 300ms

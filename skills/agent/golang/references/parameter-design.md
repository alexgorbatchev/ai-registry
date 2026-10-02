# Parameter Design Examples

## Callback Last

Use this argument order when designing a callback-taking API. The examples compare proposed signatures; they do not assert that an existing library supports both orders.

```go
status := frame.Text("Indexing…")
header := frame.Style{Foreground: frame.White, Background: frame.Red, Bold: true}

// BAD — status dangles after the multiline callback.
cmd.Header(3, func(c *frame.Canvas, s frame.Snapshot) {
	c.Fill(header)
	y := c.Height() / 2
	c.Text(2, y, fmt.Sprintf("Editor · PID %d", s.Child.PID), header)
	c.TextRight(c.Width()-2, y, status.String(), header)
}, status)

// GOOD — put state before the callback in the API signature.
cmd.Header(3, status, func(c *frame.Canvas, s frame.Snapshot) {
	c.Fill(header)
	y := c.Height() / 2
	c.Text(2, y, fmt.Sprintf("Editor · PID %d", s.Child.PID), header)
	c.TextRight(c.Width()-2, y, status.String(), header)
})
```

## Multiline Composite Literal Last

Apply the same argument-order rule when designing an API that accepts a struct value:

```go
// BAD — enabled dangles after the multiline struct literal.
Configure(Options{
	Foreground: White,
	Background: Red,
}, enabled)

// GOOD — put the ordinary argument before the multiline value.
Configure(enabled, Options{
	Foreground: White,
	Background: Red,
})
```

For an external API whose signature cannot change, bind the callback or composite literal to a named local and pass it in the required position.

## Options Struct for Parameter Count

```go
// GOOD
type ServerConfig struct {
	Addr         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	MaxConns     int
	TLSConfig    *tls.Config
}

func NewServer(cfg ServerConfig) (*Server, error) { ... }

// BAD
func NewServer(addr string, readTimeout, writeTimeout time.Duration, maxConns int, tlsCfg *tls.Config) (*Server, error) { ... }
```

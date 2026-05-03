package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var ptyUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(_ *http.Request) bool { return true },
}

type winResizeMsg struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func PtyWS() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !validateWsToken(c.Query("token")) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		conn, err := ptyUpgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("pty ws upgrade: %v", err)
			return
		}
		defer conn.Close()

		workDir := "/tmp/investigation"
		if err := os.MkdirAll(workDir, 0755); err != nil {
			log.Printf("pty: cannot create workdir: %v", err)
			workDir = "/tmp"
		}

		cmd := exec.Command("/bin/bash", "--norc", "--noprofile")
		cmd.Dir = workDir
		cmd.Env = []string{
			"TERM=xterm-256color",
			"COLORTERM=truecolor",
			`PS1=\[\033[01;31m\]┌──(\[\033[01;31m\]root\[\033[00m\]㉿\[\033[01;34m\]kali\[\033[01;31m\])-[\[\033[01;31m\]~\[\033[01;31m\]]\[\033[00m\]\n\[\033[01;31m\]└─\[\033[01;31m\]#\[\033[00m\] `,
			"HOME=/tmp/investigation",
			"USER=root",
			"LOGNAME=root",
			"SHELL=/bin/bash",
			"PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
			"LANG=en_US.UTF-8",
			"LC_ALL=en_US.UTF-8",
			"HOSTNAME=kali",
		}

		ptmx, err := pty.Start(cmd)
		if err != nil {
			// Windows/Mac local — PTY yo'q, frontend simulatsiyaga o'tadi
			log.Printf("pty: bash start failed (non-Linux platform): %v", err)
			_ = conn.WriteMessage(websocket.TextMessage, []byte("__PTY_UNAVAILABLE__\r\n"))
			return
		}
		defer func() {
			_ = ptmx.Close()
			_ = cmd.Process.Kill()
		}()

		errCh := make(chan error, 1)
		ptyCh := make(chan error, 1)

		// WebSocket → PTY
		go func() {
			for {
				msgType, data, err := conn.ReadMessage()
				if err != nil {
					errCh <- err
					return
				}
				if msgType == websocket.TextMessage {
					var r winResizeMsg
					if json.Unmarshal(data, &r) == nil && r.Type == "resize" {
						_ = pty.Setsize(ptmx, &pty.Winsize{Rows: r.Rows, Cols: r.Cols})
						continue
					}
				}
				if _, err := ptmx.Write(data); err != nil {
					errCh <- err
					return
				}
			}
		}()

		// PTY → WebSocket
		go func() {
			buf := make([]byte, 32*1024)
			for {
				n, err := ptmx.Read(buf)
				if n > 0 {
					if werr := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); werr != nil {
						ptyCh <- werr
						return
					}
				}
				if err != nil {
					if err != io.EOF {
						ptyCh <- err
					} else {
						ptyCh <- nil
					}
					return
				}
			}
		}()

		select {
		case <-errCh:
		case <-ptyCh:
		}
	}
}

func validateWsToken(tokenStr string) bool {
	if tokenStr == "" {
		return false
	}
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "detective-secret-key"
	}
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	return err == nil && tok.Valid
}
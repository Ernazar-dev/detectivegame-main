package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func JWTSecret() []byte {
	s := os.Getenv("SESSION_SECRET")
	if s == "" {
		s = "detective-secret-key"
	}
	return []byte(s)
}

type Claims struct {
	UserID uint   `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func parseToken(c *gin.Context) (*Claims, bool) {
	authHeader := c.GetHeader("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, false
	}
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	tok, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return JWTSecret(), nil
	})
	if err != nil || !tok.Valid {
		return nil, false
	}
	claims, ok := tok.Claims.(*Claims)
	return claims, ok
}

func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := parseToken(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		c.Set("userId", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func RequireTeacher() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := parseToken(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		if claims.Role != "teacher" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Teacher access required"})
			return
		}
		c.Set("userId", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

func GetUserID(c *gin.Context) uint {
	v, _ := c.Get("userId")
	id, _ := v.(uint)
	return id
}

func GetRole(c *gin.Context) string {
	v, _ := c.Get("role")
	r, _ := v.(string)
	return r
}

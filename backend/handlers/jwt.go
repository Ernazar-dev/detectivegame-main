package handlers

import (
	"os"
	"time"

	"detective-backend/models"

	"github.com/golang-jwt/jwt/v5"
)

// handlerClaims — handlers paketi ichida token yaratish uchun.
// middleware.Claims bilan bir xil tuzilma, lekin import siklini oldini oladi.
type handlerClaims struct {
	UserID uint   `json:"userId"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// jwtSecretKey — SESSION_SECRET env o'zgaruvchisini o'qiydi.
// middleware.JWTSecret() bilan bir xil mantiq.
func jwtSecretKey() []byte {
	s := os.Getenv("SESSION_SECRET")
	if s == "" {
		s = "detective-secret-key"
	}
	return []byte(s)
}

// signToken — User uchun 7 kunlik JWT token yaratadi va imzolaydi.
func signToken(user models.User) (string, error) {
	claims := handlerClaims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecretKey())
}

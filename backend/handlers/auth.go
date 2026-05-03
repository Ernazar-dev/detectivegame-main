package handlers

import (
	"net/http"
	"strings"

	"detective-backend/middleware"
	"detective-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

type loginReq struct {
	Phone    string `json:"phone"    binding:"required"`
	Password string `json:"password" binding:"required"`
}

func Login(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var user models.User
		if err := db.Where("phone = ?", req.Phone).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный номер телефона или пароль"})
			return
		}
		if user.Password != HashPassword(req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Неверный номер телефона или пароль"})
			return
		}
		signed, err := signToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ошибка подписи токена"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"token": signed, "user": user})
	}
}

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

func Me(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := middleware.GetUserID(c)
		var user models.User
		if err := db.First(&user, uid).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Пользователь не найден"})
			return
		}
		c.JSON(http.StatusOK, user)
	}
}

// ---------------------------------------------------------------------------
// Register  (public — JWT talab qilinmaydi)
// ---------------------------------------------------------------------------

type registerReq struct {
	Name     string `json:"name"     binding:"required"`
	Phone    string `json:"phone"    binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

func Register(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req registerReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		req.Phone = strings.TrimSpace(req.Phone)
		req.Name = strings.TrimSpace(req.Name)

		// Telefon band emasligini tekshirish
		var existing models.User
		if err := db.Where("phone = ?", req.Phone).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Этот номер телефона уже зарегистрирован"})
			return
		}

		user := models.User{
			Name:     req.Name,
			Phone:    req.Phone,
			Password: HashPassword(req.Password),
			Role:     "student",
		}
		if err := db.Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания аккаунта"})
			return
		}
		db.Create(&models.Activity{
			Type:     "student_joined",
			Message:  user.Name + " зарегистрировался",
			UserID:   &user.ID,
			UserName: &user.Name,
		})

		// Ro'yxatdan o'tgach darhol JWT beramiz — login sahifasiga qaytmaydi
		signed, err := signToken(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания токена"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"token": signed, "user": user})
	}
}

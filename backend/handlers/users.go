package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"detective-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createUserReq struct {
	Name     string `json:"name"     binding:"required"`
	Phone    string `json:"phone"    binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role"     binding:"required"`
}

func ListUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		q := db
		if role := c.Query("role"); role != "" {
			q = q.Where("role = ?", role)
		}
		q.Find(&users)
		c.JSON(http.StatusOK, users)
	}
}

func CreateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createUserReq
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		u := models.User{
			Name: req.Name, Phone: req.Phone,
			Password: HashPassword(req.Password), Role: req.Role,
		}
		if err := db.Create(&u).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		db.Create(&models.Activity{
			Type: "student_joined", Message: u.Name + " " + u.Role + " sifatida qo'shildi",
			UserID: &u.ID, UserName: &u.Name,
		})
		c.JSON(http.StatusCreated, u)
	}
}

func GetUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var u models.User
		if err := db.First(&u, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Foydalanuvchi topilmadi"})
			return
		}
		c.JSON(http.StatusOK, u)
	}
}

func UpdateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var u models.User
		if err := db.First(&u, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Foydalanuvchi topilmadi"})
			return
		}
		body := map[string]any{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		delete(body, "id")
		delete(body, "createdAt")
		delete(body, "xp")
		delete(body, "level")
		delete(body, "role")

		// Parol — hash qilib saqlaymiz
		if pw, ok := body["password"].(string); ok && pw != "" {
			body["password"] = HashPassword(pw)
		}

		// Avatar — GORM *string nil/empty ni skip qilishi mumkin,
		// shuning uchun alohida db.Model(&u).Update() ishlatamiz
		if avatarVal, ok := body["avatar"]; ok {
			delete(body, "avatar")
			avatarStr, _ := avatarVal.(string)
			avatarStr = strings.TrimSpace(avatarStr)
			if avatarStr != "" {
				if err := db.Model(&u).Update("avatar", avatarStr).Error; err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Avatar saqlashda xatolik"})
					return
				}
			}
		}

		// Qolgan maydonlar
		if len(body) > 0 {
			if err := db.Model(&u).Updates(body).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}

		// Yangilangan user ni qaytaramiz
		db.First(&u, id)
		c.JSON(http.StatusOK, u)
	}
}

func DeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		db.Where("student_id = ?", id).Delete(&models.Submission{})
		db.Where("student_id = ?", id).Delete(&models.TaskAssignment{})
		if err := db.Delete(&models.User{}, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Foydalanuvchi topilmadi"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

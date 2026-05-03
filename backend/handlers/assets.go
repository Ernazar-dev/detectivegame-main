package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"detective-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// uploadsDir — main.go dan SetUploadsDir orqali o'rnatiladi.
// Barcha fayl operatsiyalari shu absolute path orqali ishlaydi.
var uploadsDir string

// SetUploadsDir — main.go tomonidan startup da chaqiriladi.
func SetUploadsDir(dir string) {
	uploadsDir = dir
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

func uploadImage(c *gin.Context, subDir, prefix string) (string, bool) {
	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Изображение не выбрано"})
		return "", false
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Принимаются только JPG, PNG и WEBP"})
		return "", false
	}
	maxSize := int64(8 * 1024 * 1024)
	if file.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Размер изображения не должен превышать 8 МБ"})
		return "", false
	}

	dir := filepath.Join(uploadsDir, subDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка создания папки: " + err.Error()})
		return "", false
	}

	filename := fmt.Sprintf("%s%d%s", prefix, time.Now().UnixNano(), ext)
	dst := filepath.Join(dir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения изображения: " + err.Error()})
		return "", false
	}

	// URL qaytarish — always /api/uploads/subDir/filename
	url := "/api/uploads/" + subDir + "/" + filename
	return url, true
}

// ─── Upload handlers ──────────────────────────────────────────────────────────

func UploadCharacterImage() gin.HandlerFunc {
	return func(c *gin.Context) {
		url, ok := uploadImage(c, "characters", "char_custom_")
		if ok {
			c.JSON(http.StatusOK, gin.H{"url": url})
		}
	}
}

func UploadLocationImage() gin.HandlerFunc {
	return func(c *gin.Context) {
		url, ok := uploadImage(c, "locations", "loc_custom_")
		if ok {
			c.JSON(http.StatusOK, gin.H{"url": url})
		}
	}
}

// ─── Personajlar ──────────────────────────────────────────────────────────────

type charBody struct {
	Name     string `json:"name"`
	Role     string `json:"role"`
	ImageURL string `json:"imageUrl"`
}

func ListCharacters(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rows []models.CharacterAsset
		db.Order("id").Find(&rows)
		c.JSON(http.StatusOK, rows)
	}
}

func CreateCharacter(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b charBody
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		b.Name = strings.TrimSpace(b.Name)
		b.Role = strings.TrimSpace(b.Role)
		b.ImageURL = strings.TrimSpace(b.ImageURL)
		if b.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо указать имя"})
			return
		}
		if b.ImageURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо загрузить изображение"})
			return
		}
		key := fmt.Sprintf("custom_%d", time.Now().UnixNano())
		row := models.CharacterAsset{Key: key, Name: b.Name, RoleHint: b.Role, ImageURL: b.ImageURL}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func UpdateCharacter(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var row models.CharacterAsset
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Персонаж не найден"})
			return
		}
		var b charBody
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if v := strings.TrimSpace(b.Name); v != "" {
			row.Name = v
		}
		if v := strings.TrimSpace(b.Role); v != "" {
			row.RoleHint = v
		}
		if v := strings.TrimSpace(b.ImageURL); v != "" {
			row.ImageURL = v
		}
		if err := db.Save(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func DeleteCharacter(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		if db.Delete(&models.CharacterAsset{}, id).RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Персонаж не найден"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// ─── Joylashuvlar ─────────────────────────────────────────────────────────────

type locBody struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	ImageURL string `json:"imageUrl"`
}

func ListLocations(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var rows []models.LocationAsset
		db.Order("id").Find(&rows)
		c.JSON(http.StatusOK, rows)
	}
}

func CreateLocation(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var b locBody
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		b.Name = strings.TrimSpace(b.Name)
		b.Type = strings.TrimSpace(b.Type)
		b.ImageURL = strings.TrimSpace(b.ImageURL)
		if b.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо указать название"})
			return
		}
		if b.Type == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо выбрать тип"})
			return
		}
		if b.ImageURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Необходимо загрузить изображение"})
			return
		}
		key := fmt.Sprintf("loc_custom_%d", time.Now().UnixNano())
		row := models.LocationAsset{Key: key, Name: b.Name, Type: b.Type, ImageURL: b.ImageURL}
		if err := db.Create(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения"})
			return
		}
		c.JSON(http.StatusCreated, row)
	}
}

func UpdateLocation(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var row models.LocationAsset
		if err := db.First(&row, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Локация не найдена"})
			return
		}
		var b locBody
		if err := c.ShouldBindJSON(&b); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if v := strings.TrimSpace(b.Name); v != "" {
			row.Name = v
		}
		if v := strings.TrimSpace(b.Type); v != "" {
			row.Type = v
		}
		if v := strings.TrimSpace(b.ImageURL); v != "" {
			row.ImageURL = v
		}
		if err := db.Save(&row).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения"})
			return
		}
		c.JSON(http.StatusOK, row)
	}
}

func DeleteLocation(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		if db.Delete(&models.LocationAsset{}, id).RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Локация не найдена"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// UploadAvatarImage — foydalanuvchi profil rasmi (barcha login qilganlar uchun)
func UploadAvatarImage() gin.HandlerFunc {
	return func(c *gin.Context) {
		url, ok := uploadImage(c, "avatars", "avatar_")
		if ok {
			c.JSON(http.StatusOK, gin.H{"url": url})
		}
	}
}

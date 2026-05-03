package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"os"

	"detective-backend/models"

	"gorm.io/gorm"
)

func HashPassword(password string) string {
	h := sha256.Sum256([]byte(password))
	return hex.EncodeToString(h[:])
}

func SeedAll(db *gorm.DB) error {
	if err := SeedUsers(db); err != nil {
		return err
	}
	if err := SeedAssets(db); err != nil {
		return err
	}
	if err := SeedFilesystem(); err != nil {
		return err
	}
	if err := SeedTasks(db); err != nil {
		return err
	}
	return nil
}

// ── SeedUsers ─────────────────────────────────────────────────────────────────

func SeedUsers(db *gorm.DB) error {
	teacherPhone := os.Getenv("TEACHER_PHONE")
	teacherPassword := os.Getenv("TEACHER_PASSWORD")
	teacherName := os.Getenv("TEACHER_NAME")

	hashedPw := HashPassword(teacherPassword)

	// Teacher — mavjud bo'lsa yangilaymiz, yo'q bo'lsa yaratamiz
	var teachers []models.User
	db.Where("role = ?", "teacher").Order("id asc").Find(&teachers)

	if len(teachers) == 0 {
		t := models.User{Name: teacherName, Phone: teacherPhone, Password: hashedPw, Role: "teacher"}
		if err := db.Create(&t).Error; err != nil {
			return err
		}
	} else {
		// Birinchi teacherni yangilaymiz
		db.Exec("UPDATE users SET name=?, phone=?, password=? WHERE id=?",
			teacherName, teacherPhone, hashedPw, teachers[0].ID)
		// Ortiqcha teacherlarni o'chiramiz
		for _, extra := range teachers[1:] {
			db.Exec("UPDATE tasks SET created_by=? WHERE created_by=?", teachers[0].ID, extra.ID)
			db.Delete(&extra)
		}
	}

	// Demo student — faqat student yo'q bo'lsa
	var sCount int64
	db.Model(&models.User{}).Where("role=?", "student").Count(&sCount)
	if sCount == 0 {
		demo := models.User{Name: "Demo Student", Phone: "1111111111", Password: HashPassword("student123"), Role: "student"}
		db.Create(&demo)
	}
	return nil
}

// ── SeedFilesystem ────────────────────────────────────────────────────────────

func SeedFilesystem() error {
	// Faqat papkalarni yaratamiz — mavjud fayllarni TEGMAYMIZ
	for _, dir := range []string{"uploads/characters", "uploads/locations", "uploads/avatars"} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// ── SeedAssets ────────────────────────────────────────────────────────────────

func SeedAssets(db *gorm.DB) error {
	// ── Personajlar ───────────────────────────────────────────────────────────
	// Avval barcha mavjud personajlarni o'chiramiz (eski default personajlar)
	// va faqat 5 ta yangi personajni qo'shamiz.
	// Bu har restartda to'g'ri holatni kafolatlaydi.

	wantedKeys := []string{"biznesmen", "olim_laborant", "doktor", "police", "jurnalist"}

	newChars := []models.CharacterAsset{
		{Key: "biznesmen", Name: "Бизнесмен", RoleHint: "Корпоративный руководитель", ImageURL: "/api/uploads/characters/char_biznesmen.png"},
		{Key: "olim_laborant", Name: "Учёный-лаборант", RoleHint: "Научный сотрудник", ImageURL: "/api/uploads/characters/char_olim_laborant.png"},
		{Key: "doktor", Name: "Доктор", RoleHint: "Медицинский специалист", ImageURL: "/api/uploads/characters/char_doktor.png"},
		{Key: "police", Name: "Полицейский", RoleHint: "Сотрудник правопорядка", ImageURL: "/api/uploads/characters/char_police.png"},
		{Key: "jurnalist", Name: "Журналист", RoleHint: "Медиапредставитель", ImageURL: "/api/uploads/characters/char_jurnalist.png"},
	}

	// Kerak bo'lmagan barcha personajlarni o'chiramiz
	db.Where("key NOT IN ?", wantedKeys).Delete(&models.CharacterAsset{})

	// Har bir yangi personajni upsert qilamiz
	for _, nc := range newChars {
		var existing models.CharacterAsset
		if err := db.Where("key = ?", nc.Key).First(&existing).Error; err != nil {
			// Yo'q — yaratamiz
			db.Create(&nc)
		} else {
			// Bor — yangilaymiz
			db.Model(&existing).Updates(map[string]any{
				"name":      nc.Name,
				"role_hint": nc.RoleHint,
				"image_url": nc.ImageURL,
			})
		}
	}

	// Eski key/URL referencelarni yangi URL larga almashtiramiz
	oldToNew := map[string]string{
		"tech_genius":         "/api/uploads/characters/char_biznesmen.png",
		"corporate_ceo":       "/api/uploads/characters/char_biznesmen.png",
		"police_officer":      "/api/uploads/characters/char_police.png",
		"security_guard":      "/api/uploads/characters/char_police.png",
		"forensic_scientist":  "/api/uploads/characters/char_olim_laborant.png",
		"it_specialist":       "/api/uploads/characters/char_olim_laborant.png",
		"professor":           "/api/uploads/characters/char_doktor.png",
		"university_student":  "/api/uploads/characters/char_jurnalist.png",
		"construction_worker": "/api/uploads/characters/char_police.png",
		"office_employee":     "/api/uploads/characters/char_biznesmen.png",
		"janitor":             "/api/uploads/characters/char_police.png",
		"delivery_courier":    "/api/uploads/characters/char_jurnalist.png",
		"gritty_detective":    "/api/uploads/characters/char_biznesmen.png",
		"street_informant":    "/api/uploads/characters/char_jurnalist.png",
	}
	for old, newURL := range oldToNew {
		db.Exec("UPDATE scenes SET character_asset=? WHERE character_asset=?", newURL, old)
		db.Exec("UPDATE suspects SET character_asset_id=? WHERE character_asset_id=?", newURL, old)
	}

	// ── Joylashuvlar ─────────────────────────────────────────────────────────
	locs := []models.LocationAsset{
		{Key: "cyber_neon_street", Name: "Неоновая киберулица", Type: "Tashqari", ImageURL: "/api/uploads/locations/loc_cyber_neon_street.png"},
		{Key: "glass_office", Name: "Стеклянный пентхаус", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_glass_office.png"},
		{Key: "crime_lab", Name: "Подземная технолаборатория", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_crime_lab.png"},
		{Key: "classroom", Name: "Современный класс", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_classroom.png"},
		{Key: "security_room", Name: "Комната контроля безопасности", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_security_room.png"},
		{Key: "coffee_shop", Name: "Современная кофейня", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_coffee_shop.png"},
		{Key: "minimalist_office", Name: "Минималистский офис", Type: "Ichkari", ImageURL: "/api/uploads/locations/loc_minimalist_office.png"},
		{Key: "parking_lot", Name: "Современная парковка", Type: "Ochiq", ImageURL: "/api/uploads/locations/loc_parking_lot.png"},
		{Key: "smart_street", Name: "Улица умного города", Type: "Ochiq", ImageURL: "/api/uploads/locations/loc_smart_street.png"},
		{Key: "campus_entrance", Name: "Вход в университетский кампус", Type: "Ochiq", ImageURL: "/api/uploads/locations/loc_campus_entrance.png"},
	}
	for _, l := range locs {
		var ex models.LocationAsset
		if err := db.Where("key = ?", l.Key).First(&ex).Error; err != nil {
			db.Create(&l)
		} else {
			db.Model(&ex).Updates(map[string]any{"name": l.Name, "type": l.Type, "image_url": l.ImageURL})
		}
	}
	return nil
}

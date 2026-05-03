package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"detective-backend/middleware"
	"detective-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ── Helpers ──────────────────────────────────────────────────────────────────

func parseEvidenceIDs(s string) []uint {
	if strings.TrimSpace(s) == "" {
		return []uint{}
	}
	var out []uint
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return []uint{}
	}
	return out
}

func encodeEvidenceIDs(ids []uint) string {
	if ids == nil {
		ids = []uint{}
	}
	b, err := json.Marshal(ids)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// parseProgress / encodeProgress — PlaySession.SuspectProgress JSON map
func parseProgress(s string) map[string]int {
	out := map[string]int{}
	if strings.TrimSpace(s) == "" {
		return out
	}
	_ = json.Unmarshal([]byte(s), &out)
	return out
}

func encodeProgress(m map[string]int) string {
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func validateMatchType(mt string) string {
	mt = strings.ToLower(strings.TrimSpace(mt))
	if mt != "exact" && mt != "prefix" && mt != "regex" {
		return "exact"
	}
	return mt
}

// terminalCommandDTO — frontend uchun qulay format
type terminalCommandDTO struct {
	ID               uint    `json:"id"`
	TaskID           uint    `json:"taskId"`
	SuspectID        *uint   `json:"suspectId"`
	Command          string  `json:"command"`
	MatchType        string  `json:"matchType"`
	Output           string  `json:"output"`
	EvidenceIDs      []uint  `json:"evidenceIds"`
	Hint             string  `json:"hint"`
	Order            int     `json:"order"`
	IsFinalStep      bool    `json:"isFinalStep"`
	EvidenceImageURL *string `json:"evidenceImageUrl"`
}

func toTerminalCommandDTO(t models.TerminalCommand) terminalCommandDTO {
	return terminalCommandDTO{
		ID: t.ID, TaskID: t.TaskID, SuspectID: t.SuspectID,
		Command: t.Command, MatchType: t.MatchType,
		Output: t.Output, EvidenceIDs: parseEvidenceIDs(t.EvidenceIDs),
		Hint: t.Hint, Order: t.SortOrder,
		IsFinalStep: t.IsFinalStep, EvidenceImageURL: t.EvidenceImageURL,
	}
}

// matchSingle — bitta buyruqni input bilan taqqoslaydi.
func matchSingle(cmd models.TerminalCommand, input string) bool {
	in := strings.ToLower(strings.TrimSpace(input))
	pat := strings.ToLower(strings.TrimSpace(cmd.Command))
	switch cmd.MatchType {
	case "prefix":
		return pat != "" && strings.HasPrefix(in, pat)
	case "regex":
		re, err := regexp.Compile("(?i)" + cmd.Command)
		if err != nil {
			return false
		}
		return re.MatchString(input)
	default: // exact
		return in == pat
	}
}

// matchCommand — eski erkin rejim (faqat suspectId yo'q buyruqlar uchun).
func matchCommand(cmds []models.TerminalCommand, input string) *models.TerminalCommand {
	if strings.TrimSpace(input) == "" {
		return nil
	}
	for _, mt := range []string{"exact", "prefix", "regex"} {
		for i := range cmds {
			if cmds[i].MatchType == mt && matchSingle(cmds[i], input) {
				return &cmds[i]
			}
		}
	}
	return nil
}

// ── Terminal commands CRUD ───────────────────────────────────────────────────

// ListTerminalCommands — GET /tasks/:id/terminal-commands (eski mantiq)
func ListTerminalCommands(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID, _ := strconv.Atoi(c.Param("id"))
		var cmds []models.TerminalCommand
		db.Where("task_id = ?", taskID).
			Order("sort_order ASC, id ASC").Find(&cmds)
		out := make([]terminalCommandDTO, 0, len(cmds))
		for _, t := range cmds {
			out = append(out, toTerminalCommandDTO(t))
		}
		c.JSON(http.StatusOK, out)
	}
}

// ListTerminalCommandsBySuspect — GET /suspects/:id/terminal-commands (yangi)
func ListTerminalCommandsBySuspect(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, _ := strconv.Atoi(c.Param("id"))
		var cmds []models.TerminalCommand
		db.Where("suspect_id = ?", sid).
			Order("sort_order ASC, id ASC").Find(&cmds)
		out := make([]terminalCommandDTO, 0, len(cmds))
		for _, t := range cmds {
			out = append(out, toTerminalCommandDTO(t))
		}
		c.JSON(http.StatusOK, out)
	}
}

type createTerminalCommandReq struct {
	Command     string `json:"command" binding:"required"`
	MatchType   string `json:"matchType"`
	Output      string `json:"output"`
	EvidenceIDs []uint `json:"evidenceIds"`
	Hint        string `json:"hint"`
	Order       int    `json:"order"`
	IsFinalStep bool   `json:"isFinalStep"`
}

// CreateTerminalCommand — POST /tasks/:id/terminal-commands (eski rejim)
func CreateTerminalCommand(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID, _ := strconv.Atoi(c.Param("id"))
		var t models.Task
		if err := db.First(&t, taskID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
			return
		}
		var in createTerminalCommandReq
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		mt := validateMatchType(in.MatchType)
		if mt == "regex" {
			if _, err := regexp.Compile(in.Command); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный regex: " + err.Error()})
				return
			}
		}
		cmd := models.TerminalCommand{
			TaskID:      uint(taskID),
			Command:     strings.TrimSpace(in.Command),
			MatchType:   mt,
			Output:      in.Output,
			EvidenceIDs: encodeEvidenceIDs(in.EvidenceIDs),
			Hint:        in.Hint,
			SortOrder:   in.Order,
			IsFinalStep: in.IsFinalStep,
		}
		if err := db.Create(&cmd).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, toTerminalCommandDTO(cmd))
	}
}

// CreateTerminalCommandForSuspect — POST /suspects/:id/terminal-commands (yangi rejim)
func CreateTerminalCommandForSuspect(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, _ := strconv.Atoi(c.Param("id"))
		var s models.Suspect
		if err := db.First(&s, sid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Подозреваемый не найден"})
			return
		}
		var in createTerminalCommandReq
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		mt := validateMatchType(in.MatchType)
		if mt == "regex" {
			if _, err := regexp.Compile(in.Command); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный regex: " + err.Error()})
				return
			}
		}
		// Avtomatik order — agar 0 bo'lsa, oxirgisidan keyin
		order := in.Order
		if order == 0 {
			var count int64
			db.Model(&models.TerminalCommand{}).Where("suspect_id = ?", sid).Count(&count)
			order = int(count)
		}
		susID := s.ID
		cmd := models.TerminalCommand{
			TaskID:      s.TaskID,
			SuspectID:   &susID,
			Command:     strings.TrimSpace(in.Command),
			MatchType:   mt,
			Output:      in.Output,
			EvidenceIDs: encodeEvidenceIDs(in.EvidenceIDs),
			Hint:        in.Hint,
			SortOrder:   order,
			IsFinalStep: in.IsFinalStep,
		}
		if err := db.Create(&cmd).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, toTerminalCommandDTO(cmd))
	}
}

// UpdateTerminalCommand — PATCH /terminal-commands/:id
func UpdateTerminalCommand(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var cmd models.TerminalCommand
		if err := db.First(&cmd, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Команда не найдена"})
			return
		}
		var in struct {
			Command     *string `json:"command"`
			MatchType   *string `json:"matchType"`
			Output      *string `json:"output"`
			EvidenceIDs *[]uint `json:"evidenceIds"`
			Hint        *string `json:"hint"`
			Order       *int    `json:"order"`
			IsFinalStep *bool   `json:"isFinalStep"`
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		updates := map[string]any{}
		if in.Command != nil {
			updates["command"] = strings.TrimSpace(*in.Command)
		}
		if in.MatchType != nil {
			updates["match_type"] = validateMatchType(*in.MatchType)
		}
		if in.Output != nil {
			updates["output"] = *in.Output
		}
		if in.EvidenceIDs != nil {
			updates["evidence_ids"] = encodeEvidenceIDs(*in.EvidenceIDs)
		}
		if in.Hint != nil {
			updates["hint"] = *in.Hint
		}
		if in.Order != nil {
			updates["sort_order"] = *in.Order
		}
		if in.IsFinalStep != nil {
			updates["is_final_step"] = *in.IsFinalStep
		}
		// Regex tekshiruvi
		mt, _ := updates["match_type"].(string)
		if mt == "" {
			mt = cmd.MatchType
		}
		cmdStr, _ := updates["command"].(string)
		if cmdStr == "" {
			cmdStr = cmd.Command
		}
		if mt == "regex" {
			if _, err := regexp.Compile(cmdStr); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Неверный regex: " + err.Error()})
				return
			}
		}
		if err := db.Model(&cmd).Updates(updates).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		db.First(&cmd, id)
		c.JSON(http.StatusOK, toTerminalCommandDTO(cmd))
	}
}

// DeleteTerminalCommand — DELETE /terminal-commands/:id
func DeleteTerminalCommand(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		if err := db.Delete(&models.TerminalCommand{}, id).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	}
}

// UploadTerminalCommandImage — POST /terminal-commands/:id/image (multipart)
// Yuklangan rasmni saqlaydi va shu buyruqni IsFinalStep=true qilib belgilaydi.
func UploadTerminalCommandImage(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var cmd models.TerminalCommand
		if err := db.First(&cmd, id).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Команда не найдена"})
			return
		}
		file, err := c.FormFile("image")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Файл не выбран"})
			return
		}
		ext := strings.ToLower(filepath.Ext(file.Filename))
		switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".gif":
			// ok
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Только jpg/png/webp/gif"})
			return
		}
		if file.Size > 10*1024*1024 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Файл больше 10 MB"})
			return
		}
		dir := filepath.Join(uploadsDir, "evidence")
		if err := os.MkdirAll(dir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Папка не создана"})
			return
		}
		fname := fmt.Sprintf("tcmd_%d_%d%s", id, time.Now().UnixNano(), ext)
		dst := filepath.Join(dir, fname)
		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить: " + err.Error()})
			return
		}
		url := "/api/uploads/evidence/" + fname
		db.Model(&cmd).Updates(map[string]any{
			"evidence_image_url": url,
			"is_final_step":      true,
		})
		db.First(&cmd, id)
		c.JSON(http.StatusOK, toTerminalCommandDTO(cmd))
	}
}

// ── Default scenario seed ─────────────────────────────────────────────────────

func slugify(name string) string {
	result := strings.ToLower(strings.TrimSpace(name))
	re := regexp.MustCompile(`[^a-z0-9]+`)
	result = re.ReplaceAllString(result, "-")
	result = strings.Trim(result, "-")
	if result == "" {
		result = "suspect"
	}
	return result
}

// SeedSuspectDefaults — POST /suspects/:id/terminal-defaults
// Gumonlanuvchi uchun 4 qadamli standart forensik stsenariy yaratadi.
// Agar buyruqlar allaqachon mavjud bo'lsa — o'zgartirmaydi.
func SeedSuspectDefaults(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, _ := strconv.Atoi(c.Param("id"))
		var s models.Suspect
		if err := db.First(&s, sid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Подозреваемый не найден"})
			return
		}

		var count int64
		db.Model(&models.TerminalCommand{}).Where("suspect_id = ?", s.ID).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Команды уже существуют. Сначала удалите их."})
			return
		}

		susID := s.ID

		defaults := []models.TerminalCommand{
			{
				TaskID:    s.TaskID,
				SuspectID: &susID,
				Command:   `(?i)(подключ|открыт|проверить|kira).*(камер|cctv|видеонаблюд)`,
				MatchType: "regex",
				Hint:      "Получите доступ к камере наблюдения, фиксировавшей подозреваемого.",
				Output:    "Видеозапись извлечена. Силуэт у подъезда, таймкод 22:14.",
				SortOrder: 0,
			},
			{
				TaskID:    s.TaskID,
				SuspectID: &susID,
				Command:   `(?i)(телефон|звонк|смс|перепис)`,
				MatchType: "regex",
				Hint:      "Изучите телефонную активность подозреваемого за вечер преступления.",
				Output:    "Журнал: 3 исходящих на номер 192-XX-77 в период 22:00–23:00.",
				SortOrder: 1,
			},
			{
				TaskID:    s.TaskID,
				SuspectID: &susID,
				Command:   `(?i)(банк|финанс|перевод|транзак)`,
				MatchType: "regex",
				Hint:      "Проверьте финансовые операции подозреваемого.",
				Output:    "Перевод 847 000 ₽ на счёт неизвестного получателя в день преступления.",
				SortOrder: 2,
			},
			{
				TaskID:      s.TaskID,
				SuspectID:   &susID,
				Command:     `(?i)(ключ|финал|улик|итог|вскр)`,
				MatchType:   "regex",
				Hint:        "Сопоставьте все улики и извлеките ключевое доказательство.",
				Output:      "★ Ключевое доказательство извлечено — смотрите панель справа.",
				SortOrder:   3,
				IsFinalStep: true,
			},
		}

		for i := range defaults {
			if err := db.Create(&defaults[i]).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Ошибка сохранения: " + err.Error()})
				return
			}
		}

		out := make([]terminalCommandDTO, 0, len(defaults))
		for _, cmd := range defaults {
			out = append(out, toTerminalCommandDTO(cmd))
		}
		c.JSON(http.StatusCreated, gin.H{"created": len(defaults), "commands": out})
	}
}

// ── Play sessions ─────────────────────────────────────────────────────────────

type createPlaySessionReq struct {
	TaskID uint `json:"taskId" binding:"required"`
}

// CreatePlaySession — POST /play-sessions { taskId }
func CreatePlaySession(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := middleware.GetUserID(c)
		var in createPlaySessionReq
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var t models.Task
		if err := db.First(&t, in.TaskID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
			return
		}
		s := models.PlaySession{
			TaskID:          in.TaskID,
			StudentID:       uid,
			StartedAt:       time.Now(),
			SuspectProgress: "{}",
		}
		if err := db.Create(&s).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"id":        s.ID,
			"taskId":    s.TaskID,
			"studentId": s.StudentID,
			"startedAt": s.StartedAt,
		})
	}
}

// ── Terminal execute ─────────────────────────────────────────────────────────

type terminalExecuteReq struct {
	Command   string `json:"command" binding:"required"`
	SuspectID *uint  `json:"suspectId"`
}

// ExecuteTerminal — POST /sessions/:sessionId/terminal-execute
//
// Yangi (per-suspect step) rejim — agar SuspectID berilsa:
//   - Gumonlanuvchining buyruqlarini order bo'yicha o'qiydi
//   - Sessiyadan joriy step indeksini oladi
//   - Faqat shu qadamga mos kelishni tekshiradi (qattiy tartib!)
//   - Mos kelsa: step++ va {matched, output, isFinalStep, evidenceImageUrl, ...}
//   - Aks holda: {matched: false, output: "bash: ...: command not found"}
//
// Eski (erkin) rejim — SuspectID nil bo'lsa:
//   - Eskidagidek erkin matchCommand ishlaydi (suspect_id IS NULL bo'lgan buyruqlar)
func ExecuteTerminal(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		sid, _ := strconv.Atoi(c.Param("sessionId"))
		uid := middleware.GetUserID(c)

		var session models.PlaySession
		if err := db.First(&session, sid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Сессия не найдена"})
			return
		}
		if session.StudentID != uid {
			c.JSON(http.StatusForbidden, gin.H{"error": "Нет доступа к этой сессии"})
			return
		}

		var in terminalExecuteReq
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input := strings.TrimSpace(in.Command)
		if input == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "empty command"})
			return
		}

		// ── YANGI: per-suspect step rejimi ────────────────────────────────
		if in.SuspectID != nil {
			var cmds []models.TerminalCommand
			db.Where("suspect_id = ?", *in.SuspectID).
				Order("sort_order ASC, id ASC").Find(&cmds)

			progress := parseProgress(session.SuspectProgress)
			key := strconv.FormatUint(uint64(*in.SuspectID), 10)
			step := progress[key]
			total := len(cmds)

			if total == 0 {
				log := models.SessionTerminalLog{
					SessionID: session.ID, Command: input,
					EvidenceUnlockedIDs: "[]", ExecutedAt: time.Now(),
				}
				db.Create(&log)
				c.JSON(http.StatusOK, gin.H{
					"matched":     false,
					"output":      "[i] No commands configured for this suspect yet.",
					"evidenceIds": []uint{},
					"stepIndex":   0, "totalSteps": 0,
				})
				return
			}

			if step >= total {
				c.JSON(http.StatusOK, gin.H{
					"matched":     false,
					"output":      "[i] All steps completed for this suspect. Investigation closed.",
					"evidenceIds": []uint{},
					"stepIndex":   step, "totalSteps": total,
					"completed": true,
				})
				return
			}

			expected := cmds[step]
			if !matchSingle(expected, input) {
				log := models.SessionTerminalLog{
					SessionID: session.ID, Command: input,
					EvidenceUnlockedIDs: "[]", ExecutedAt: time.Now(),
				}
				db.Create(&log)
				c.JSON(http.StatusOK, gin.H{
					"matched":     false,
					"output":      "",
					"evidenceIds": []uint{},
					"stepIndex":   step, "totalSteps": total,
					"progressPercent": int(step * 100 / total),
					"progressColor":   "red",
				})
				return
			}

			// Match — keyingi qadamga o'tamiz
			progress[key] = step + 1
			session.SuspectProgress = encodeProgress(progress)
			db.Model(&session).Update("suspect_progress", session.SuspectProgress)

			isFinal := expected.IsFinalStep || (step+1 == total)
			evIDs := parseEvidenceIDs(expected.EvidenceIDs)
			cmdID := expected.ID
			log := models.SessionTerminalLog{
				SessionID: session.ID, Command: input,
				MatchedCommandID:    &cmdID,
				EvidenceUnlockedIDs: expected.EvidenceIDs,
				ExecutedAt:          time.Now(),
			}
			db.Create(&log)

			c.JSON(http.StatusOK, gin.H{
				"matched":          true,
				"output":           expected.Output,
				"evidenceIds":      evIDs,
				"hint":             expected.Hint,
				"stepIndex":        step + 1,
				"totalSteps":       total,
				"isFinalStep":      isFinal,
				"evidenceImageUrl": expected.EvidenceImageURL,
				"suspectId":        *in.SuspectID,
				"progressPercent":  int((step + 1) * 100 / total),
				"progressColor":    "green",
			})
			return
		}

		// ── ESKI: erkin match rejimi (suspect_id IS NULL) ─────────────────
		var cmds []models.TerminalCommand
		db.Where("task_id = ? AND suspect_id IS NULL", session.TaskID).
			Order("sort_order ASC, id ASC").Find(&cmds)

		matched := matchCommand(cmds, input)
		log := models.SessionTerminalLog{
			SessionID: session.ID, Command: input,
			EvidenceUnlockedIDs: "[]", ExecutedAt: time.Now(),
		}
		if matched == nil {
			db.Create(&log)
			c.JSON(http.StatusOK, gin.H{
				"matched":     false,
				"output":      "",
				"evidenceIds": []uint{},
			})
			return
		}
		log.MatchedCommandID = &matched.ID
		evIDs := parseEvidenceIDs(matched.EvidenceIDs)
		log.EvidenceUnlockedIDs = matched.EvidenceIDs
		db.Create(&log)
		c.JSON(http.StatusOK, gin.H{
			"matched":     true,
			"output":      matched.Output,
			"evidenceIds": evIDs,
			"hint":        matched.Hint,
		})
	}
}

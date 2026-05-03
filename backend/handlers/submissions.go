package handlers

import (
        "encoding/json"
        "fmt"
        "net/http"
        "regexp"
        "strconv"
        "strings"
        "time"

        "detective-backend/middleware"
        "detective-backend/models"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

func formatSub(db *gorm.DB, s models.Submission) gin.H {
        var t models.Task
        var u models.User
        var sp models.Suspect
        db.First(&t, s.TaskID)
        db.First(&u, s.StudentID)
        db.First(&sp, s.SelectedSuspectID)
        return gin.H{
                "id": s.ID, "taskId": s.TaskID, "studentId": s.StudentID,
                "selectedSuspectId": s.SelectedSuspectID, "explanation": s.Explanation,
                "status": s.Status, "suspectScore": s.SuspectScore, "explanationScore": s.ExplanationScore,
                "totalScore": s.TotalScore, "botFeedback": s.BotFeedback, "teacherFeedback": s.TeacherFeedback,
                "submittedAt": s.SubmittedAt, "approvedAt": s.ApprovedAt,
                "bonusScore":       s.BonusScore,
                "keyEvidenceFound": s.KeyEvidenceFound,
                "keyEvidenceTotal": s.KeyEvidenceTotal,
                "task":             t, "student": u, "suspect": sp,
        }
}

// parseUintList — JSON "[1,5,7]" → []uint. Xato bo'lsa bo'sh slice.
func parseUintList(s string) []uint {
        if strings.TrimSpace(s) == "" {
                return []uint{}
        }
        var out []uint
        if err := json.Unmarshal([]byte(s), &out); err != nil {
                return []uint{}
        }
        return out
}

func ListSubmissions(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                uid := middleware.GetUserID(c)
                role := middleware.GetRole(c)
                var subs []models.Submission
                q := db
                if role == "student" {
                        q = q.Where("student_id = ?", uid)
                }
                if v := c.Query("taskId"); v != "" {
                        q = q.Where("task_id = ?", v)
                }
                if v := c.Query("studentId"); v != "" {
                        q = q.Where("student_id = ?", v)
                }
                if v := c.Query("status"); v != "" {
                        q = q.Where("status = ?", v)
                }
                q.Order("submitted_at DESC").Find(&subs)
                out := make([]gin.H, 0, len(subs))
                for _, s := range subs {
                        out = append(out, formatSub(db, s))
                }
                c.JSON(http.StatusOK, out)
        }
}

type createSubReq struct {
        TaskID              uint   `json:"taskId" binding:"required"`
        SelectedSuspectID   uint   `json:"selectedSuspectId" binding:"required"`
        Explanation         string `json:"explanation" binding:"required"`
        UnlockedEvidenceIDs []uint `json:"unlockedEvidenceIds"`
}

func CreateSubmission(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                uid := middleware.GetUserID(c)
                var req createSubReq
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                // Bir o'quvchi bir ishga faqat bir marta javob yubora oladi
                var existing models.Submission
                if err := db.Where("task_id = ? AND student_id = ?", req.TaskID, uid).First(&existing).Error; err == nil {
                        c.JSON(http.StatusConflict, gin.H{"error": "Вы уже отправили ответ на это задание"})
                        return
                }
                // UnlockedEvidenceIDs ni JSON ko'rinishida saqlaymiz
                unlockedJSON := "[]"
                if len(req.UnlockedEvidenceIDs) > 0 {
                        if b, err := json.Marshal(req.UnlockedEvidenceIDs); err == nil {
                                unlockedJSON = string(b)
                        }
                }
                s := models.Submission{
                        TaskID: req.TaskID, StudentID: uid, SelectedSuspectID: req.SelectedSuspectID,
                        Explanation: req.Explanation, Status: "submitted", SubmittedAt: time.Now(),
                        UnlockedEvidenceIDs: unlockedJSON,
                }
                if err := db.Create(&s).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                var t models.Task
                var u models.User
                db.First(&t, s.TaskID)
                db.First(&u, s.StudentID)
                db.Create(&models.Activity{
                        Type: "submission", Message: u.Name + ` отправил ответ на задание «` + t.Title + `»`,
                        UserID: &u.ID, UserName: &u.Name,
                })
                c.JSON(http.StatusCreated, formatSub(db, s))
        }
}

func GetSubmission(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var s models.Submission
                if err := db.First(&s, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Ответ не найден"})
                        return
                }
                uid := middleware.GetUserID(c)
                role := middleware.GetRole(c)
                if role == "student" && s.StudentID != uid {
                        c.JSON(http.StatusForbidden, gin.H{"error": "Нет доступа к этому ответу"})
                        return
                }
                c.JSON(http.StatusOK, formatSub(db, s))
        }
}

var wordRe = regexp.MustCompile(`\W+`)

func calcSimilarity(student, correct string) float64 {
        if strings.TrimSpace(correct) == "" {
                return 25
        }
        if strings.TrimSpace(student) == "" {
                return 0
        }
        splitWords := func(s string) map[string]bool {
                m := map[string]bool{}
                for _, w := range wordRe.Split(strings.ToLower(s), -1) {
                        if len(w) > 3 {
                                m[w] = true
                        }
                }
                return m
        }
        sw := splitWords(student)
        cw := splitWords(correct)
        if len(cw) == 0 {
                return 25
        }
        match := 0
        for w := range cw {
                if sw[w] {
                        match++
                }
        }
        return float64(match) / float64(len(cw)) * 70
}

// AnalyzeSubmission — faqat suspect to'g'ri/noto'g'riligini aniqlaydi (50/0).
// Xulosa ballini ustoz o'zi qo'yadi — bu yerda faqat tavsiya sifatida hisoblanadi.
func AnalyzeSubmission(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var s models.Submission
                if err := db.First(&s, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Ответ не найден"})
                        return
                }
                var t models.Task
                if err := db.First(&t, s.TaskID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
                        return
                }

                // Suspect to'g'ri/noto'g'ri — ob'ektiv, avtomatik
                correct := t.CorrectSuspectID != nil && *t.CorrectSuspectID == s.SelectedSuspectID
                var sScore float64
                if correct {
                        sScore = 30
                }

                // Xulosa o'xshashligi — faqat ustoz uchun tavsiya, ball emas
                corrReason := ""
                if t.CorrectReasoning != nil {
                        corrReason = *t.CorrectReasoning
                }
                suggestedEScore := calcSimilarity(s.Explanation, corrReason)

                // ── Terminal-driven asosiy dalil bonusi ─────────────────────────────
                // Talaba topib olgan dalillar ichidan IsKeyEvidence=true bo'lganlarini
                // sanaymiz. Har biri uchun +10 bonus ball.
                var keyTotal int64
                db.Model(&models.Evidence{}).
                        Where("task_id = ? AND is_key_evidence = ?", t.ID, true).
                        Count(&keyTotal)

                unlockedIDs := parseUintList(s.UnlockedEvidenceIDs)
                var keyFound int64
                if len(unlockedIDs) > 0 {
                        db.Model(&models.Evidence{}).
                                Where("task_id = ? AND is_key_evidence = ? AND id IN ?", t.ID, true, unlockedIDs).
                                Count(&keyFound)
                }
                bonusScore := float64(keyFound) * 10.0

                var fb string
                if correct {
                        fb = fmt.Sprintf(
                                "✅ Верный подозреваемый — автоматически начислено 30 баллов. "+
                                        "Анализ заключения: ориентировочно %.0f/70 баллов (учитель устанавливает сам). "+
                                        "Ключевые улики: %d/%d (бонус +%.0f).",
                                suggestedEScore, keyFound, keyTotal, bonusScore,
                        )
                } else {
                        fb = fmt.Sprintf(
                                "❌ Неверный подозреваемый — баллов за подозреваемого: 0/30. "+
                                        "Анализ заключения: ориентировочно %.0f/70 баллов (учитель устанавливает сам). "+
                                        "Ключевые улики: %d/%d (бонус +%.0f).",
                                suggestedEScore, keyFound, keyTotal, bonusScore,
                        )
                }

                // TotalScore hali belgilanmaydi — ustoz approve qilganda qo'yadi
                s.Status = "pending_approval"
                s.SuspectScore = &sScore
                s.ExplanationScore = &suggestedEScore // tavsiya sifatida, ustoz o'zgartira oladi
                s.BotFeedback = &fb
                s.BonusScore = &bonusScore
                kf := int(keyFound)
                kt := int(keyTotal)
                s.KeyEvidenceFound = &kf
                s.KeyEvidenceTotal = &kt
                // TotalScore ni null qoldiramiz — ustoz approve qilguncha
                s.TotalScore = nil
                db.Save(&s)
                c.JSON(http.StatusOK, formatSub(db, s))
        }
}

// approveReq — ustoz tomonidan to'ldiriladi:
// - approved: true = tasdiqlash, false = qaytarish
// - explanationScore: ustoz qo'ygan xulosa bali (0–50)
// - teacherFeedback: ixtiyoriy izoh
type approveReq struct {
        Approved         bool    `json:"approved"`
        ExplanationScore float64 `json:"explanationScore"` // ustoz qo'yadi: 0–50
        TeacherFeedback  *string `json:"teacherFeedback"`
}

func ApproveSubmission(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var req approveReq
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }

                var s models.Submission
                if err := db.First(&s, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Ответ не найден"})
                        return
                }

                if req.Approved {
                        // Ustoz qo'ygan explanationScore ni 0–50 oralig'ida cheklaymiz
                        eScore := req.ExplanationScore
                        if eScore < 0 {
                                eScore = 0
                        }
                        if eScore > 70 {
                                eScore = 70
                        }

                        // suspectScore oldindan AnalyzeSubmission tomonidan belgilangan
                        var sScore float64
                        if s.SuspectScore != nil {
                                sScore = *s.SuspectScore
                        }
                        // Terminal-driven asosiy dalil bonusi (AnalyzeSubmission belgilagan)
                        var bScore float64
                        if s.BonusScore != nil {
                                bScore = *s.BonusScore
                        }

                        total := sScore + eScore + bScore

                        s.Status = "approved"
                        now := time.Now()
                        s.ApprovedAt = &now
                        s.ExplanationScore = &eScore
                        s.TotalScore = &total

                        db.Save(&s)

                        // XP — ustoz belgilagan umumiy ballga qarab
                        xpGain := int(total + 0.5)
                        var u models.User
                        if err := db.First(&u, s.StudentID).Error; err == nil {
                                u.XP += xpGain
                                u.Level = u.XP/100 + 1
                                db.Save(&u)
                                var t models.Task
                                db.First(&t, s.TaskID)
                                db.Create(&models.Activity{
                                        Type:     "approval",
                                        Message:  fmt.Sprintf(`%s подтвердил задание «%s» — %.0f баллов`, u.Name, t.Title, total),
                                        UserID:   &u.ID,
                                        UserName: &u.Name,
                                })
                        }
                } else {
                        // Qaytarish — status reset, scorlar tozalanadi
                        s.Status = "submitted"
                        s.ApprovedAt = nil
                        s.TotalScore = nil
                        s.ExplanationScore = nil
                        s.SuspectScore = nil
                        s.BotFeedback = nil
                        db.Save(&s)
                }

                s.TeacherFeedback = req.TeacherFeedback
                db.Save(&s)

                c.JSON(http.StatusOK, formatSub(db, s))
        }
}
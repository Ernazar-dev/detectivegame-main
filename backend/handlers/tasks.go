package handlers

import (
        "net/http"
        "os"
        "path/filepath"
        "strconv"
        "strings"

        "detective-backend/middleware"
        "detective-backend/models"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

func ListTasks(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                uid := middleware.GetUserID(c)
                role := middleware.GetRole(c)
                var tasks []models.Task
                if role == "student" {
                        var assignments []models.TaskAssignment
                        db.Where("student_id = ?", uid).Find(&assignments)
                        ids := make([]uint, 0, len(assignments))
                        for _, a := range assignments {
                                ids = append(ids, a.TaskID)
                        }
                        db.Where("status = ?", "published").Find(&tasks)
                        filtered := make([]models.Task, 0)
                        for _, t := range tasks {
                                if t.AssignedToAll {
                                        filtered = append(filtered, t)
                                        continue
                                }
                                for _, id := range ids {
                                        if id == t.ID {
                                                filtered = append(filtered, t)
                                                break
                                        }
                                }
                        }
                        tasks = filtered
                } else {
                        db.Where("created_by = ?", uid).Find(&tasks)
                }
                if d := c.Query("difficulty"); d != "" {
                        out := make([]models.Task, 0)
                        for _, t := range tasks {
                                if t.Difficulty == d {
                                        out = append(out, t)
                                }
                        }
                        tasks = out
                }
                c.JSON(http.StatusOK, tasks)
        }
}

func CreateTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                uid := middleware.GetUserID(c)
                var t models.Task
                if err := c.ShouldBindJSON(&t); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                t.CreatedBy = uid
                if err := db.Create(&t).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                db.Create(&models.Activity{
                        Type: "task_created", Message: `Создано новое задание «` + t.Title + `»`, UserID: &uid,
                })
                c.JSON(http.StatusCreated, t)
        }
}

// isAssetURL — qiymat URL ekanligini tekshiradi
func isAssetURL(s string) bool {
        return strings.HasPrefix(s, "/") || strings.HasPrefix(s, "http")
}

// findOnDisk — uploadsDir ichida key ga mos faylni qidiradi (extension noma'lum bo'lsa)
// prefix: "char_custom_" yoki "loc_custom_"
func findOnDisk(subDir, prefix, key string) string {
        base := filepath.Join(uploadsDir, subDir)
        for _, ext := range []string{".png", ".jpg", ".jpeg", ".webp"} {
                path := filepath.Join(base, prefix+key+ext)
                if _, err := os.Stat(path); err == nil {
                        return "/api/uploads/" + subDir + "/" + prefix + key + ext
                }
        }
        return ""
}

// Eski default character key → yangi character URL (migration fallback)
var legacyCharMap = map[string]string{
        "tech_genius":         "/api/uploads/characters/char_biznesmen.png",
        "corporate_ceo":       "/api/uploads/characters/char_biznesmen.png",
        "office_employee":     "/api/uploads/characters/char_biznesmen.png",
        "gritty_detective":    "/api/uploads/characters/char_biznesmen.png",
        "police_officer":      "/api/uploads/characters/char_police.png",
        "security_guard":      "/api/uploads/characters/char_police.png",
        "construction_worker": "/api/uploads/characters/char_police.png",
        "janitor":             "/api/uploads/characters/char_police.png",
        "forensic_scientist":  "/api/uploads/characters/char_olim_laborant.png",
        "it_specialist":       "/api/uploads/characters/char_olim_laborant.png",
        "professor":           "/api/uploads/characters/char_doktor.png",
        "university_student":  "/api/uploads/characters/char_jurnalist.png",
        "delivery_courier":    "/api/uploads/characters/char_jurnalist.png",
        "street_informant":    "/api/uploads/characters/char_jurnalist.png",
}

// resolveChar — character key yoki URL ni haqiqiy URL ga aylantiradi
func resolveChar(val *string, charMap map[string]string) *string {
        if val == nil || *val == "" {
                return val
        }
        v := *val
        // 1. Allaqachon URL
        if isAssetURL(v) {
                return val
        }
        // 2. DB dan imageUrl
        if url, ok := charMap[v]; ok && isAssetURL(url) {
                return &url
        }
        // 3. Disk dan qidirish
        if found := findOnDisk("characters", "char_", v); found != "" {
                return &found
        }
        // 4. Eski default key → yangi URL (migration fallback)
        if url, ok := legacyCharMap[v]; ok {
                return &url
        }
        // 5. Hech narsa topilmasa nil qaytaramiz (404 oldini olish)
        return nil
}

// resolveLoc — location key yoki URL ni haqiqiy URL ga aylantiradi
func resolveLoc(val *string, locMap map[string]string) *string {
        if val == nil || *val == "" {
                return val
        }
        v := *val
        if isAssetURL(v) {
                return val
        }
        if url, ok := locMap[v]; ok && isAssetURL(url) {
                return &url
        }
        if found := findOnDisk("locations", "loc_", v); found != "" {
                return &found
        }
        return val
}

func GetTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var t models.Task
                if err := db.First(&t, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
                        return
                }

                // Asset map: key → imageUrl
                charMap := map[string]string{}
                var cas []models.CharacterAsset
                db.Find(&cas)
                for _, ca := range cas {
                        charMap[ca.Key] = ca.ImageURL
                }
                locMap := map[string]string{}
                var las []models.LocationAsset
                db.Find(&las)
                for _, la := range las {
                        locMap[la.Key] = la.ImageURL
                }

                var scenes []models.Scene
                db.Where("task_id = ?", t.ID).Order("scene_order").Find(&scenes)
                scenesOut := make([]gin.H, 0, len(scenes))
                for _, sc := range scenes {
                        scenesOut = append(scenesOut, gin.H{
                                "id": sc.ID, "taskId": sc.TaskID, "order": sc.Order,
                                "title": sc.Title, "body": sc.Body,
                                "imageAsset":     resolveLoc(sc.ImageAsset, locMap),
                                "characterAsset": resolveChar(sc.CharacterAsset, charMap),
                                "createdAt":      sc.CreatedAt,
                        })
                }

                var suspects []models.Suspect
                db.Where("task_id = ?", t.ID).Find(&suspects)
                role := middleware.GetRole(c)
                // Bir martalik dalillar yuklamasi (N+1 ni oldini olamiz)
                var allEv []models.Evidence
                db.Where("task_id = ?", t.ID).Order("suspect_id ASC, sort_order ASC").Find(&allEv)
                evBySuspect := map[uint][]gin.H{}
                for _, e := range allEv {
                        body := e.Body
                        locked := e.Locked
                        if role == "student" && locked {
                                body = "" // shifrlangan, frontend decrypt bilan ochadi
                        }
                        evBySuspect[e.SuspectID] = append(evBySuspect[e.SuspectID], gin.H{
                                "id": e.ID, "taskId": e.TaskID, "suspectId": e.SuspectID,
                                "kind": e.Kind, "fileName": e.FileName, "title": e.Title,
                                "body": body, "hint": e.Hint, "locked": locked,
                                "order": e.SortOrder, "createdAt": e.CreatedAt,
                                "mediaUrl": e.MediaURL, "mediaType": e.MediaType, "relevance": e.Relevance, "command": e.Command,
                        })
                }
                susOut := make([]gin.H, 0, len(suspects))
                for _, s := range suspects {
                        var qs []models.Question
                        db.Where("suspect_id = ?", s.ID).Find(&qs)
                        alibi := s.SecretAlibi
                        if role == "student" {
                                alibi = nil
                        }
                        ev := evBySuspect[s.ID]
                        if ev == nil {
                                ev = []gin.H{}
                        }
                        susOut = append(susOut, gin.H{
                                "id": s.ID, "taskId": s.TaskID,
                                "characterAssetId": resolveChar(s.CharacterAssetID, charMap),
                                "suspectStatus":    s.SuspectStatus, "name": s.Name, "avatar": s.Avatar,
                                "role": s.Role, "description": s.Description, "behaviorTraits": s.BehaviorTraits,
                                "secretAlibi": alibi, "createdAt": s.CreatedAt, "questions": qs,
                                "evidence": ev,
                        })
                }

                var assignments []models.TaskAssignment
                db.Where("task_id = ?", t.ID).Find(&assignments)
                assignedIds := make([]uint, 0, len(assignments))
                for _, a := range assignments {
                        assignedIds = append(assignedIds, a.StudentID)
                }

                c.JSON(http.StatusOK, gin.H{
                        "id": t.ID, "title": t.Title, "difficulty": t.Difficulty, "scenario": t.Scenario,
                        "timerMinutes": t.TimerMinutes, "correctSuspectId": t.CorrectSuspectID,
                        "correctReasoning": t.CorrectReasoning, "evidenceReferences": t.EvidenceReferences,
                        "locationAssetId": resolveLoc(t.LocationAssetID, locMap),
                        "assignedToAll":   t.AssignedToAll,
                        "createdBy":       t.CreatedBy, "status": t.Status, "createdAt": t.CreatedAt,
                        "scenes": scenesOut, "suspects": susOut, "assignedStudentIds": assignedIds,
                })
        }
}

func UpdateTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var t models.Task
                if err := db.First(&t, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
                        return
                }
                body := map[string]any{}
                if err := c.ShouldBindJSON(&body); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                delete(body, "id")
                delete(body, "createdAt")
                delete(body, "createdBy")
                // remap camelCase JSON keys to snake_case columns
                mapping := map[string]string{
                        "timerMinutes": "timer_minutes", "correctSuspectId": "correct_suspect_id",
                        "correctReasoning": "correct_reasoning", "evidenceReferences": "evidence_references",
                        "locationAssetId": "location_asset_id", "assignedToAll": "assigned_to_all",
                }
                updates := map[string]any{}
                for k, v := range body {
                        if nk, ok := mapping[k]; ok {
                                updates[nk] = v
                        } else {
                                updates[k] = v
                        }
                }
                if err := db.Model(&t).Updates(updates).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                db.First(&t, id)
                c.JSON(http.StatusOK, t)
        }
}

func DeleteTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                db.Where("task_id = ?", id).Delete(&models.TaskAssignment{})
                db.Where("task_id = ?", id).Delete(&models.Scene{})
                var suspects []models.Suspect
                db.Where("task_id = ?", id).Find(&suspects)
                for _, s := range suspects {
                        db.Where("suspect_id = ?", s.ID).Delete(&models.Question{})
                }
                db.Where("task_id = ?", id).Delete(&models.Suspect{})
                if err := db.Delete(&models.Task{}, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
                        return
                }
                c.Status(http.StatusNoContent)
        }
}

type assignReq struct {
        AssignAll  bool   `json:"assignAll"`
        StudentIDs []uint `json:"studentIds"`
}

func AssignTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var req assignReq
                c.ShouldBindJSON(&req)
                if req.AssignAll {
                        db.Model(&models.Task{}).Where("id = ?", id).Update("assigned_to_all", true)
                } else if len(req.StudentIDs) > 0 {
                        db.Where("task_id = ?", id).Delete(&models.TaskAssignment{})
                        for _, sid := range req.StudentIDs {
                                db.Create(&models.TaskAssignment{TaskID: uint(id), StudentID: sid})
                        }
                }
                c.JSON(http.StatusOK, gin.H{"success": true, "message": "Задание назначено"})
        }
}

// Scenes
func ListScenes(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var scenes []models.Scene
                db.Where("task_id = ?", id).Order("scene_order").Find(&scenes)
                c.JSON(http.StatusOK, scenes)
        }
}

func CreateScene(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var s models.Scene
                if err := c.ShouldBindJSON(&s); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                s.TaskID = uint(id)
                if err := db.Create(&s).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusCreated, s)
        }
}

type reorderReq struct {
        SceneIDs []uint `json:"sceneIds"`
}

func ReorderScenes(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var req reorderReq
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                var existing []models.Scene
                db.Where("task_id = ?", id).Find(&existing)
                if len(req.SceneIDs) != len(existing) {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "количество ID сцен не совпадает"})
                        return
                }
                for i, sid := range req.SceneIDs {
                        db.Model(&models.Scene{}).Where("id = ? AND task_id = ?", sid, id).Update("scene_order", i+1)
                }
                var out []models.Scene
                db.Where("task_id = ?", id).Order("scene_order").Find(&out)
                c.JSON(http.StatusOK, out)
        }
}

func UpdateScene(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                sceneID, _ := strconv.Atoi(c.Param("sceneId"))
                var s models.Scene
                if err := db.First(&s, sceneID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Сцена не найдена"})
                        return
                }
                body := map[string]any{}
                if err := c.ShouldBindJSON(&body); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                delete(body, "id")
                delete(body, "taskId")
                delete(body, "createdAt")
                mapping := map[string]string{
                        "imageAsset":     "image_asset",
                        "characterAsset": "character_asset",
                }
                updates := map[string]any{}
                for k, v := range body {
                        if nk, ok := mapping[k]; ok {
                                updates[nk] = v
                        } else {
                                updates[k] = v
                        }
                }
                if err := db.Model(&s).Updates(updates).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                db.First(&s, sceneID)
                c.JSON(http.StatusOK, s)
        }
}

func DeleteScene(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                sceneID, _ := strconv.Atoi(c.Param("sceneId"))
                if err := db.Delete(&models.Scene{}, sceneID).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Сцена не найдена"})
                        return
                }
                c.Status(http.StatusNoContent)
        }
}

// Suspects
func ListSuspects(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var sus []models.Suspect
                db.Where("task_id = ?", id).Find(&sus)
                role := middleware.GetRole(c)
                if role == "student" {
                        for i := range sus {
                                sus[i].SecretAlibi = nil
                        }
                }
                c.JSON(http.StatusOK, sus)
        }
}

func CreateSuspect(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var s models.Suspect
                if err := c.ShouldBindJSON(&s); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                s.TaskID = uint(id)
                if err := db.Create(&s).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusCreated, s)
        }
}

func UpdateSuspect(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var s models.Suspect
                if err := db.First(&s, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Подозреваемый не найден"})
                        return
                }
                body := map[string]any{}
                c.ShouldBindJSON(&body)
                delete(body, "id")
                delete(body, "createdAt")
                mapping := map[string]string{
                        "taskId": "task_id", "characterAssetId": "character_asset_id",
                        "suspectStatus": "suspect_status", "behaviorTraits": "behavior_traits",
                        "secretAlibi": "secret_alibi",
                }
                updates := map[string]any{}
                for k, v := range body {
                        if nk, ok := mapping[k]; ok {
                                updates[nk] = v
                        } else {
                                updates[k] = v
                        }
                }
                db.Model(&s).Updates(updates)
                db.First(&s, id)
                c.JSON(http.StatusOK, s)
        }
}

func DeleteSuspect(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                db.Where("suspect_id = ?", id).Delete(&models.Question{})
                if err := db.Delete(&models.Suspect{}, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Подозреваемый не найден"})
                        return
                }
                c.Status(http.StatusNoContent)
        }
}

// Questions
func ListQuestions(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var qs []models.Question
                db.Where("suspect_id = ?", id).Find(&qs)
                c.JSON(http.StatusOK, qs)
        }
}

func CreateQuestion(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var q models.Question
                if err := c.ShouldBindJSON(&q); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                q.SuspectID = uint(id)
                if err := db.Create(&q).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusCreated, q)
        }
}

func UpdateQuestion(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("qid"))
                var q models.Question
                if err := db.First(&q, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Вопрос не найден"})
                        return
                }
                type updateReq struct {
                        Question string `json:"question"`
                        Answer   string `json:"answer"`
                }
                var req updateReq
                if err := c.ShouldBindJSON(&req); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                updates := map[string]any{}
                if req.Question != "" {
                        updates["question_text"] = req.Question
                }
                if req.Answer != "" {
                        updates["answer_text"] = req.Answer
                }
                if err := db.Model(&q).Updates(updates).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                db.First(&q, id)
                c.JSON(http.StatusOK, q)
        }
}

func DeleteQuestion(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("qid"))
                if err := db.Delete(&models.Question{}, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Вопрос не найден"})
                        return
                }
                c.Status(http.StatusNoContent)
        }
}

package handlers

import (
        "crypto/sha1"
        "encoding/hex"
        "fmt"
        "net/http"
        "os"
        "path/filepath"
        "strconv"
        "strings"
        "time"
        "unicode"

        "detective-backend/middleware"
        "detective-backend/models"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────────────────────────
// EVIDENCE GENERATOR
//
// Har bir gumonlanuvchi uchun deterministik ravishda 3 ta dalil + 1 ta
// shifrlangan "vault" (alibi) generatsiya qilamiz. Kontent gumonlanuvchining
// mavjud maydonlaridan (description, behaviorTraits, secretAlibi) olinadi,
// shuning uchun ssenariy buzilmaydi — bizz faqat mavjud ma'lumotni yangi
// "kanal"larda qayta paketlaymiz (kamera, audio, telefon, foto, ekspertiza).
// ─────────────────────────────────────────────────────────────────────────────

type evidenceTemplate struct {
        Kind     string
        FileExt  string
        Title    string // %s = suspect name
        Body     string // %s = derived content
        Hint     string
}

// "Personal" pool — har bir gumonlanuvchi uchun mos keladigan turlar
var personalEvidencePool = []evidenceTemplate{
        {
                Kind:    "audio",
                FileExt: "wav",
                Title:   "Аудиозапись: %s",
                Body:    "[00:00] ▓▓░░░░░░░░░░░░░░░░░░░  длительность 01:47\n\nПерехваченная запись (источник: радионяня в соседней комнате):\n\n«… %s …»\n\nГолос идентифицирован экспертизой как принадлежащий подозреваемому. На фоне слышен звук закрывающейся двери и шаги.",
                Hint:    "audio fragment, voice match ✓",
        },
        {
                Kind:    "phone",
                FileExt: "log",
                Title:   "Телефонные звонки: %s",
                Body:    "── ВЫГРУЗКА БИЛЛИНГА (последние 24 часа) ──\n\n21:47  →  потерпевший          00:43  ✓\n22:11  ←  неизвестный (burner)  01:12  ✓\n22:58  →  потерпевший          00:08  ✗ (сброшен)\n23:14  →  +7 (***) ***-12-08    02:31  ✓\n\nПримечание оператора: %s",
                Hint:    "call log, last 24h",
        },
        {
                Kind:    "photo",
                FileExt: "jpg",
                Title:   "Фотофиксация: %s",
                Body:    "┌──────── EXIF ────────┐\n│ Камера: iPhone 13     │\n│ Дата:   за 2 ч до ЧП  │\n│ GPS:    место событий │\n└───────────────────────┘\n\nНа снимке: %s\n\nФото получено из облачного хранилища подозреваемого по запросу.",
                Hint:    "photo + EXIF metadata",
        },
        {
                Kind:    "message",
                FileExt: "msg",
                Title:   "Восстановленные сообщения: %s",
                Body:    "── Telegram, чат «Личное» (удалено пользователем, восстановлено) ──\n\n[21:33]  Я: %s\n[21:34]  Я: не отвечай никому\n[21:36]  Я: всё под контролем\n[21:51]  Я: [сообщение удалено]\n[22:02]  Собеседник: ты понимаешь что делаешь?\n[22:02]  Я: да\n",
                Hint:    "deleted msgs, recovered",
        },
}

// "Forensic" pool — joydagi ekspertiza dalillari
var forensicEvidencePool = []evidenceTemplate{
        {
                Kind:    "fingerprint",
                FileExt: "afis",
                Title:   "Дактилоскопия: совпадение по %s",
                Body:    "AFIS совпадение: 14 точек схожести (порог 12)\n\nСлед обнаружен на: %s\n\n░░▓▓░░▓▓░░\n░▓██▓▓██▓░\n▓██▓▓▓▓██▓\n▓██▓░░▓██▓\n░▓██▓▓██▓░\n░░▓▓░░▓▓░░\n\nВывод эксперта: отпечаток принадлежит подозреваемому с вероятностью 99.7%%",
                Hint:    "AFIS match, 14 points",
        },
        {
                Kind:    "dna",
                FileExt: "dna",
                Title:   "ДНК-экспертиза: образец %s",
                Body:    "Образец: микрочастицы кожи / волос\nМесто изъятия: %s\n\nПрофиль СТР (16 локусов):\nD8S1179: 13,14   D21S11:  29,31\nD7S820:  10,11   CSF1PO:  11,12\nD3S1358: 15,16   TH01:    7,9.3\nD13S317: 11,13   D16S539: 11,12\nD2S1338: 19,23   D19S433: 14,15\n\nСовпадение с образцом подозреваемого: 1 на 7.2 млрд",
                Hint:    "STR profile, 16 loci",
        },
        {
                Kind:    "financial",
                FileExt: "txn",
                Title:   "Банковская выписка: %s",
                Body:    "── Карта **** **** **** 4019 ──\n\n−   2 500 ₽  Аптека «Ригла»            (за день до ЧП)\n−  47 000 ₽  Перевод на анонимный кошелёк\n+ 250 000 ₽  Поступление от ООО «Авангард»\n−   1 200 ₽  Такси, маршрут к месту ЧП    (час Х)\n\nКомментарий аналитика: %s",
                Hint:    "bank statement, suspicious",
        },
        {
                Kind:    "document",
                FileExt: "pdf",
                Title:   "Документ: %s",
                Body:    "┌─── СЛУЖЕБНАЯ ЗАПИСКА ───┐\n│  Уровень доступа: 2     │\n└─────────────────────────┘\n\nФрагмент:\n\n«%s»\n\nДокумент изъят при обыске. На полях — рукописные пометки, экспертиза почерка ведётся.",
                Hint:    "document, 1 page",
        },
}

// chooseTpl — hash(suspectID, salt) % len(pool) bo'yicha deterministik tanlov
func chooseTpl(pool []evidenceTemplate, suspectID uint, salt string) evidenceTemplate {
        h := sha1.Sum([]byte(fmt.Sprintf("%d:%s", suspectID, salt)))
        idx := int(h[0]) % len(pool)
        return pool[idx]
}

// excerpt — string dan tasodifiy bo'lmagan, ammo deterministik fragment olish
func excerpt(s string, max int) string {
        s = strings.TrimSpace(s)
        if s == "" {
                return "— нет данных —"
        }
        r := []rune(s)
        if len(r) <= max {
                return s
        }
        cut := string(r[:max])
        if i := strings.LastIndexAny(cut, ".!?,;"); i > max/2 {
                cut = cut[:i+1]
        }
        return cut + "…"
}

// firstSentence — birinchi gapni qaytaradi (yoki butun matn)
func firstSentence(s string) string {
        s = strings.TrimSpace(s)
        for _, sep := range []string{". ", "! ", "? ", ".\n", "!\n", "?\n"} {
                if i := strings.Index(s, sep); i > 0 {
                        return s[:i+1]
                }
        }
        return excerpt(s, 180)
}

// passwordFromName — gumonlanuvchi familiyasidan kichik harfli, transliteratsiya parol yasaydi
// (vault dalillari uchun). Ssenariyni buzmasligi uchun aynan ism asos qilib olinadi.
func passwordFromName(name string) string {
        name = strings.TrimSpace(name)
        if name == "" {
                return "secret"
        }
        parts := strings.Fields(name)
        last := parts[len(parts)-1]
        mapRu := map[rune]string{
                'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
                'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
                'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
                'ф': "f", 'х': "h", 'ц': "ts", 'ч': "ch", 'ш': "sh", 'щ': "sch",
                'ъ': "", 'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
        }
        var b strings.Builder
        for _, r := range last {
                r = unicode.ToLower(r)
                if v, ok := mapRu[r]; ok {
                        b.WriteString(v)
                } else if r >= 'a' && r <= 'z' {
                        b.WriteRune(r)
                } else if r >= '0' && r <= '9' {
                        b.WriteRune(r)
                }
        }
        out := b.String()
        if out == "" {
                out = "secret"
        }
        return out
}

// surnameInitials — masalan "Александр Волков" → "AV" (faqat hint uchun)
func surnameInitials(name string) string {
        parts := strings.Fields(strings.TrimSpace(name))
        if len(parts) == 0 {
                return "??"
        }
        var out []rune
        for _, p := range parts {
                for _, r := range p {
                        out = append(out, unicode.ToUpper(r))
                        break
                }
        }
        if len(out) > 3 {
                out = out[:3]
        }
        return string(out)
}

// generateForSuspect — bitta gumonlanuvchi uchun 3 ta + 1 vault dalil yaratadi
func generateForSuspect(s models.Suspect, idx int) []models.Evidence {
        now := time.Now()
        traits := s.BehaviorTraits
        if traits == "" {
                traits = "поведение в день инцидента не зафиксировано"
        }
        desc := s.Description
        if desc == "" {
                desc = "профиль не заполнен"
        }

        // 1) Camera — har doim mavjud
        camTitle := fmt.Sprintf("Камера #%02d — %s", idx+1, s.Name)
        camBody := fmt.Sprintf(
                "┌─── ЗАПИСЬ ВИДЕОНАБЛЮДЕНИЯ ───┐\n│  Камера: CAM-%02d (вход)        │\n│  Время:  21:%02d:%02d — 22:%02d:%02d   │\n└──────────────────────────────┘\n\nНа записи зафиксирован объект «%s» (%s).\n\nПоведенческий анализ оператора:\n%s\n\nДополнительно: %s",
                idx+1,
                (int(s.ID)*7)%60, (int(s.ID)*13)%60,
                (int(s.ID)*7+11)%60, (int(s.ID)*13+27)%60,
                s.Name, s.Role,
                excerpt(traits, 280),
                firstSentence(desc),
        )
        cam := models.Evidence{
                TaskID: s.TaskID, SuspectID: s.ID, Kind: "camera",
                FileName:  fmt.Sprintf("cam-%02d.feed", idx+1),
                Title:     camTitle,
                Body:      camBody,
                Hint:      "video stream, 02:14",
                SortOrder: 1,
                CreatedAt: now,
        }

        // 2) Personal — pool dan tanlov
        p := chooseTpl(personalEvidencePool, s.ID, "personal")
        pBody := ""
        switch p.Kind {
        case "audio":
                pBody = fmt.Sprintf(p.Body, excerpt(traits, 220))
        case "phone":
                pBody = fmt.Sprintf(p.Body, excerpt(firstSentence(desc), 160))
        case "photo":
                pBody = fmt.Sprintf(p.Body, excerpt(firstSentence(traits), 200))
        case "message":
                pBody = fmt.Sprintf(p.Body, excerpt(firstSentence(desc), 80))
        }
        personal := models.Evidence{
                TaskID: s.TaskID, SuspectID: s.ID, Kind: p.Kind,
                FileName:  fmt.Sprintf("%s-%02d.%s", p.Kind, idx+1, p.FileExt),
                Title:     fmt.Sprintf(p.Title, s.Name),
                Body:      pBody,
                Hint:      p.Hint,
                SortOrder: 2,
                CreatedAt: now,
        }

        // 3) Forensic — pool dan tanlov
        f := chooseTpl(forensicEvidencePool, s.ID, "forensic")
        fBody := ""
        switch f.Kind {
        case "fingerprint", "dna":
                place := "место происшествия"
                if t := firstSentence(desc); t != "" {
                        place = excerpt(t, 100)
                }
                fBody = fmt.Sprintf(f.Body, place)
        case "financial":
                fBody = fmt.Sprintf(f.Body, excerpt(firstSentence(traits), 160))
        case "document":
                fBody = fmt.Sprintf(f.Body, excerpt(firstSentence(traits), 220))
        }
        forensic := models.Evidence{
                TaskID: s.TaskID, SuspectID: s.ID, Kind: f.Kind,
                FileName:  fmt.Sprintf("%s-%02d.%s", f.Kind, idx+1, f.FileExt),
                Title:     fmt.Sprintf(f.Title, s.Name),
                Body:      fBody,
                Hint:      f.Hint,
                SortOrder: 3,
                CreatedAt: now,
        }

        // 4) Vault — secretAlibi (shifrlangan)
        out := []models.Evidence{cam, personal, forensic}
        if s.SecretAlibi != nil && strings.TrimSpace(*s.SecretAlibi) != "" {
                pwd := passwordFromName(s.Name)
                hashHint := sha1.Sum([]byte(pwd))
                vaultBody := fmt.Sprintf(
                        "┌──────────── ЗАШИФРОВАННЫЙ ФАЙЛ ────────────┐\n│  Алгоритм: AES-256-CBC                      │\n│  Подсказка: %-30s │\n└─────────────────────────────────────────────┘\n\n>>> ПОСЛЕ РАСШИФРОВКИ <<<\n\n%s",
                        fmt.Sprintf("инициалы %s, ник=фам.", surnameInitials(s.Name)),
                        *s.SecretAlibi,
                )
                vault := models.Evidence{
                        TaskID: s.TaskID, SuspectID: s.ID, Kind: "vault",
                        FileName:  fmt.Sprintf("alibi-%02d.enc", idx+1),
                        Title:     fmt.Sprintf("СЕЙФ: личное алиби — %s", s.Name),
                        Body:      vaultBody,
                        Hint:      "encrypted, sha1=" + hex.EncodeToString(hashHint[:4]),
                        Locked:    true,
                        Password:  pwd,
                        SortOrder: 4,
                        CreatedAt: now,
                }
                out = append(out, vault)
        }
        return out
}

// SeedEvidenceForAllTasks — har bir bo'sh task uchun dalillarni yaratadi.
// Allaqachon dalillari bo'lgan tasklarni o'tkazib yuboradi (idempotent).
func SeedEvidenceForAllTasks(db *gorm.DB) error {
        var tasks []models.Task
        if err := db.Find(&tasks).Error; err != nil {
                return err
        }
        for _, t := range tasks {
                var existing int64
                db.Model(&models.Evidence{}).Where("task_id = ?", t.ID).Count(&existing)
                if existing > 0 {
                        continue
                }
                var suspects []models.Suspect
                db.Where("task_id = ?", t.ID).Order("id").Find(&suspects)
                for i, s := range suspects {
                        for _, ev := range generateForSuspect(s, i) {
                                if err := db.Create(&ev).Error; err != nil {
                                        return err
                                }
                        }
                }
        }
        return nil
}

// regenerateForSuspect — bitta gumonlanuvchi uchun dalillarni qaytadan yaratadi
func regenerateForSuspect(db *gorm.DB, s models.Suspect, idx int) error {
        db.Where("suspect_id = ?", s.ID).Delete(&models.Evidence{})
        for _, ev := range generateForSuspect(s, idx) {
                if err := db.Create(&ev).Error; err != nil {
                        return err
                }
        }
        return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

type evidenceDTO struct {
        ID            uint      `json:"id"`
        TaskID        uint      `json:"taskId"`
        SuspectID     uint      `json:"suspectId"`
        Kind          string    `json:"kind"`
        FileName      string    `json:"fileName"`
        Title         string    `json:"title"`
        Body          string    `json:"body"`
        Hint          string    `json:"hint"`
        Locked        bool      `json:"locked"`
        Order         int       `json:"order"`
        MediaURL      *string   `json:"mediaUrl"`
        MediaType     string    `json:"mediaType"`
        Relevance     string    `json:"relevance"`
        Command       string    `json:"command"`
        CreatedAt     time.Time `json:"createdAt"`
        IsKeyEvidence bool      `json:"isKeyEvidence"`
        TerminalOnly  bool      `json:"terminalOnly"`
}

func toDTO(e models.Evidence, hideBodyIfLocked bool) evidenceDTO {
        body := e.Body
        if hideBodyIfLocked && e.Locked {
                body = ""
        }
        return evidenceDTO{
                ID: e.ID, TaskID: e.TaskID, SuspectID: e.SuspectID, Kind: e.Kind,
                FileName: e.FileName, Title: e.Title, Body: body, Hint: e.Hint,
                Locked: e.Locked, Order: e.SortOrder,
                MediaURL: e.MediaURL, MediaType: e.MediaType, Relevance: e.Relevance,
                Command: e.Command, CreatedAt: e.CreatedAt,
                IsKeyEvidence: e.IsKeyEvidence, TerminalOnly: e.TerminalOnly,
        }
}

// UploadEvidenceMedia — POST /evidence/:id/media (teacher)
// Dalil uchun media fayl (rasm, audio, video) yuklaydi.
func UploadEvidenceMedia(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var ev models.Evidence
                if err := db.First(&ev, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Dalil topilmadi"})
                        return
                }
                file, err := c.FormFile("media")
                if err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Media fayl tanlanmadi"})
                        return
                }
                ext := strings.ToLower(filepath.Ext(file.Filename))
                var mediaType string
                switch ext {
                case ".jpg", ".jpeg", ".png", ".webp", ".gif":
                        mediaType = "image"
                case ".mp3", ".wav", ".ogg", ".m4a", ".aac":
                        mediaType = "audio"
                case ".mp4", ".webm", ".mov":
                        mediaType = "video"
                default:
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Qo'llab-quvvatlanmaydigan format (jpg/png/mp3/wav/mp4)"})
                        return
                }
                if file.Size > 50*1024*1024 {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "Fayl hajmi 50 MB dan oshmasin"})
                        return
                }
                dir := filepath.Join(uploadsDir, "evidence")
                if err := os.MkdirAll(dir, 0755); err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Papka yaratilmadi"})
                        return
                }
                fname := fmt.Sprintf("ev_%d_%d%s", id, time.Now().UnixNano(), ext)
                dst := filepath.Join(dir, fname)
                if err := c.SaveUploadedFile(file, dst); err != nil {
                        c.JSON(http.StatusInternalServerError, gin.H{"error": "Fayl saqlanmadi: " + err.Error()})
                        return
                }
                url := "/api/uploads/evidence/" + fname
                db.Model(&ev).Updates(map[string]any{"media_url": url, "media_type": mediaType})
                db.First(&ev, id)
                c.JSON(http.StatusOK, toDTO(ev, false))
        }
}

// ListEvidenceByTask — GET /tasks/:id/evidence
func ListEvidenceByTask(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var evs []models.Evidence
                db.Where("task_id = ?", id).Order("suspect_id ASC, sort_order ASC").Find(&evs)
                role := middleware.GetRole(c)
                hideLocked := role == "student"
                out := make([]evidenceDTO, 0, len(evs))
                for _, e := range evs {
                        out = append(out, toDTO(e, hideLocked))
                }
                c.JSON(http.StatusOK, out)
        }
}

// ListEvidenceBySuspect — GET /suspects/:id/evidence
func ListEvidenceBySuspect(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var evs []models.Evidence
                db.Where("suspect_id = ?", id).Order("sort_order ASC").Find(&evs)
                role := middleware.GetRole(c)
                hideLocked := role == "student"
                out := make([]evidenceDTO, 0, len(evs))
                for _, e := range evs {
                        out = append(out, toDTO(e, hideLocked))
                }
                c.JSON(http.StatusOK, out)
        }
}

// UnlockEvidence — POST /evidence/:id/unlock { password }
// Locked dalil uchun password ni tekshirib, to'liq Body qaytaradi.
func UnlockEvidence(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var ev models.Evidence
                if err := db.First(&ev, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Файл не найден"})
                        return
                }
                var body struct {
                        Password string `json:"password"`
                }
                c.ShouldBindJSON(&body)
                if !ev.Locked {
                        c.JSON(http.StatusOK, gin.H{"ok": true, "body": ev.Body, "title": ev.Title, "fileName": ev.FileName})
                        return
                }
                if strings.TrimSpace(strings.ToLower(body.Password)) != strings.TrimSpace(strings.ToLower(ev.Password)) {
                        c.JSON(http.StatusForbidden, gin.H{"ok": false, "error": "decrypt: bad password"})
                        return
                }
                c.JSON(http.StatusOK, gin.H{"ok": true, "body": ev.Body, "title": ev.Title, "fileName": ev.FileName})
        }
}

// CreateEvidence — POST /suspects/:id/evidence (teacher)
func CreateEvidence(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                sid, _ := strconv.Atoi(c.Param("id"))
                var s models.Suspect
                if err := db.First(&s, sid).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Подозреваемый не найден"})
                        return
                }
                var in struct {
                        Kind          string `json:"kind"`
                        FileName      string `json:"fileName"`
                        Title         string `json:"title"`
                        Body          string `json:"body"`
                        Hint          string `json:"hint"`
                        Locked        bool   `json:"locked"`
                        Password      string `json:"password"`
                        Command       string `json:"command"`
                        IsKeyEvidence bool   `json:"isKeyEvidence"`
                        TerminalOnly  bool   `json:"terminalOnly"`
                }
                if err := c.ShouldBindJSON(&in); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                if in.Kind == "" || in.Title == "" {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "kind и title обязательны"})
                        return
                }
                if in.FileName == "" {
                        in.FileName = fmt.Sprintf("%s-extra-%d", in.Kind, time.Now().Unix()%10000)
                }
                ev := models.Evidence{
                        TaskID: s.TaskID, SuspectID: s.ID, Kind: in.Kind,
                        FileName: in.FileName, Title: in.Title, Body: in.Body, Hint: in.Hint,
                        Locked: in.Locked, Password: in.Password, SortOrder: 99, Command: in.Command,
                        IsKeyEvidence: in.IsKeyEvidence, TerminalOnly: in.TerminalOnly,
                }
                if err := db.Create(&ev).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusCreated, toDTO(ev, false))
        }
}

// UpdateEvidence — PATCH /evidence/:id (teacher)
func UpdateEvidence(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var ev models.Evidence
                if err := db.First(&ev, id).Error; err != nil {
                        c.JSON(http.StatusNotFound, gin.H{"error": "Не найдено"})
                        return
                }
                var in map[string]any
                if err := c.ShouldBindJSON(&in); err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                // camelCase → snake_case (GORM .Updates ustun nomlarini map kalitidan oladi)
                camelToSnake := map[string]string{
                        "isKeyEvidence": "is_key_evidence",
                        "terminalOnly":  "terminal_only",
                        "mediaUrl":      "media_url",
                        "mediaType":     "media_type",
                        "fileName":      "file_name",
                }
                for camel, snake := range camelToSnake {
                        if v, ok := in[camel]; ok {
                                in[snake] = v
                                delete(in, camel)
                        }
                }
                if err := db.Model(&ev).Updates(in).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusOK, toDTO(ev, false))
        }
}

// DeleteEvidence — DELETE /evidence/:id (teacher)
func DeleteEvidence(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                if err := db.Delete(&models.Evidence{}, id).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                        return
                }
                c.JSON(http.StatusOK, gin.H{"ok": true})
        }
}

// RegenerateEvidence — POST /tasks/:id/evidence/regenerate (teacher)
// Task ichidagi barcha dalillarni qaytadan yaratadi (bo'sh suspectlar uchun).
func RegenerateEvidence(db *gorm.DB) gin.HandlerFunc {
        return func(c *gin.Context) {
                id, _ := strconv.Atoi(c.Param("id"))
                var suspects []models.Suspect
                db.Where("task_id = ?", id).Order("id").Find(&suspects)
                for i, s := range suspects {
                        if err := regenerateForSuspect(db, s, i); err != nil {
                                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                                return
                        }
                }
                c.JSON(http.StatusOK, gin.H{"ok": true, "suspectCount": len(suspects)})
        }
}

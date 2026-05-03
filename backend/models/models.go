package models

import "time"

type User struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        Name      string    `gorm:"not null" json:"name"`
        Phone     string    `gorm:"not null;unique" json:"phone"`
        Password  string    `gorm:"not null" json:"-"`
        Role      string    `gorm:"not null;default:student" json:"role"` // teacher | student
        Avatar    *string   `json:"avatar"`
        XP        int       `gorm:"not null;default:0" json:"xp"`
        Level     int       `gorm:"not null;default:1" json:"level"`
        CreatedAt time.Time `json:"createdAt"`
}

type Task struct {
        ID                 uint      `gorm:"primaryKey" json:"id"`
        Title              string    `gorm:"not null" json:"title"`
        Difficulty         string    `gorm:"not null;default:easy" json:"difficulty"`
        Scenario           string    `gorm:"not null" json:"scenario"`
        TimerMinutes       int       `gorm:"not null;default:30" json:"timerMinutes"`
        CorrectSuspectID   *uint     `json:"correctSuspectId"`
        CorrectReasoning   *string   `json:"correctReasoning"`
        EvidenceReferences *string   `json:"evidenceReferences"`
        LocationAssetID    *string   `json:"locationAssetId"` // preset key or URL
        AssignedToAll      bool      `gorm:"not null;default:false" json:"assignedToAll"`
        CreatedBy          uint      `gorm:"not null" json:"createdBy"`
        Status             string    `gorm:"not null;default:draft" json:"status"`
        CreatedAt          time.Time `json:"createdAt"`
}

type TaskAssignment struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        TaskID    uint      `gorm:"not null;index" json:"taskId"`
        StudentID uint      `gorm:"not null;index" json:"studentId"`
        CreatedAt time.Time `json:"createdAt"`
}

type Scene struct {
        ID             uint      `gorm:"primaryKey" json:"id"`
        TaskID         uint      `gorm:"not null;index" json:"taskId"`
        Order          int       `gorm:"column:scene_order;not null;default:0" json:"order"`
        Title          string    `gorm:"not null;default:''" json:"title"`
        Body           string    `gorm:"not null;default:''" json:"body"`
        ImageAsset     *string   `json:"imageAsset"`
        CharacterAsset *string   `json:"characterAsset"`
        CreatedAt      time.Time `json:"createdAt"`
}

type Suspect struct {
        ID               uint      `gorm:"primaryKey" json:"id"`
        TaskID           uint      `gorm:"not null;index" json:"taskId"`
        CharacterAssetID *string   `json:"characterAssetId"`
        SuspectStatus    string    `gorm:"not null;default:suspect" json:"suspectStatus"`
        Name             string    `gorm:"not null" json:"name"`
        Avatar           *string   `json:"avatar"`
        Role             string    `gorm:"not null;default:''" json:"role"`
        Description      string    `gorm:"not null;default:''" json:"description"`
        BehaviorTraits   string    `gorm:"not null;default:''" json:"behaviorTraits"`
        SecretAlibi      *string   `json:"secretAlibi"`
        CreatedAt        time.Time `json:"createdAt"`
}

type Question struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        SuspectID uint      `gorm:"not null;index" json:"suspectId"`
        Question  string    `gorm:"column:question_text;not null" json:"question"`
        Answer    string    `gorm:"column:answer_text;not null" json:"answer"`
        CreatedAt time.Time `json:"createdAt"`
}

type Submission struct {
        ID                uint       `gorm:"primaryKey" json:"id"`
        TaskID            uint       `gorm:"not null;index" json:"taskId"`
        StudentID         uint       `gorm:"not null;index" json:"studentId"`
        SelectedSuspectID uint       `gorm:"not null" json:"selectedSuspectId"`
        Explanation       string     `gorm:"not null" json:"explanation"`
        Status            string     `gorm:"not null;default:submitted" json:"status"`
        SuspectScore      *float64   `json:"suspectScore"`
        ExplanationScore  *float64   `json:"explanationScore"`
        TotalScore        *float64   `json:"totalScore"`
        BotFeedback       *string    `json:"botFeedback"`
        TeacherFeedback   *string    `json:"teacherFeedback"`
        SubmittedAt       time.Time  `json:"submittedAt"`
        ApprovedAt        *time.Time `json:"approvedAt"`

        // ── Terminal-driven evidence bonus ─────────────────────────────────────
        // Talaba topshirgan vaqtda topib olgan dalil ID lari (JSON: "[1,5,7]").
        // AnalyzeSubmission ulardan key evidence sonini hisoblaydi va
        // BonusScore ni qo'shadi.
        UnlockedEvidenceIDs string   `gorm:"type:text;not null;default:'[]'" json:"-"`
        BonusScore          *float64 `json:"bonusScore"`
        KeyEvidenceFound    *int     `json:"keyEvidenceFound"`
        KeyEvidenceTotal    *int     `json:"keyEvidenceTotal"`
}

type Activity struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        Type      string    `gorm:"not null" json:"type"`
        Message   string    `gorm:"not null" json:"message"`
        UserID    *uint     `json:"userId"`
        UserName  *string   `json:"userName"`
        CreatedAt time.Time `json:"createdAt"`
}

type CharacterAsset struct {
        ID          uint      `gorm:"primaryKey" json:"id"`
        Key         string    `gorm:"not null;unique" json:"key"`
        Name        string    `gorm:"not null" json:"name"`
        RoleHint    string    `gorm:"not null" json:"roleHint"`
        Description string    `gorm:"not null;default:''" json:"description"`
        ImageURL    string    `gorm:"not null" json:"imageUrl"`
        CreatedAt   time.Time `json:"createdAt"`
}

type LocationAsset struct {
        ID        uint      `gorm:"primaryKey" json:"id"`
        Key       string    `gorm:"not null;unique" json:"key"`
        Name      string    `gorm:"not null" json:"name"`
        Type      string    `gorm:"not null" json:"type"`
        ImageURL  string    `gorm:"not null" json:"imageUrl"`
        CreatedAt time.Time `json:"createdAt"`
}

// Evidence — terminal orqali topiladigan dalil.
// Kind: camera | audio | phone | photo | message | dna | fingerprint |
//       document | financial | vault
// Locked: agar true bo'lsa, frontend `decrypt <file> <password>` orqali ochadi.
// FileName: terminal filesystem-dagi fayl nomi (cam-01.feed, audio-03.wav ...)
// Hint: ls -l da ko'rsatiladigan ipucu (masalan, "shifr ≈ familiya")
type Evidence struct {
        ID         uint      `gorm:"primaryKey" json:"id"`
        TaskID     uint      `gorm:"not null;index" json:"taskId"`
        SuspectID  uint      `gorm:"not null;index" json:"suspectId"`
        Kind       string    `gorm:"not null" json:"kind"`
        FileName   string    `gorm:"not null" json:"fileName"`
        Title      string    `gorm:"not null" json:"title"`
        Body       string    `gorm:"not null" json:"body"`
        Hint       string    `gorm:"not null;default:''" json:"hint"`
        Locked     bool      `gorm:"not null;default:false" json:"locked"`
        Password   string    `gorm:"not null;default:''" json:"-"`
        SortOrder  int       `gorm:"column:sort_order;not null;default:0" json:"order"`
        MediaURL   *string   `json:"mediaUrl"`
        MediaType  string    `gorm:"not null;default:''" json:"mediaType"`
        Relevance  string    `gorm:"not null;default:'neutral'" json:"relevance"`
        Command    string    `gorm:"not null;default:''" json:"command"`
        CreatedAt  time.Time `json:"createdAt"`

        // IsKeyEvidence — bu dalil "asosiy" hisoblanadi va topilsa BonusScore beradi.
        // TerminalOnly — dalil faqat terminal orqali topilishi mumkin (ro'yxatda
        // ko'rinmaydi). Hozircha frontend bu flag ni meta-buyruqlardagi `evidence`
        // ko'rinishini boshqarish uchun ishlatadi.
        IsKeyEvidence bool `gorm:"not null;default:false" json:"isKeyEvidence"`
        TerminalOnly  bool `gorm:"not null;default:false" json:"terminalOnly"`
}

package models

import "time"

// PlaySession — talabaning bitta task ustida ishlash sessiyasi.
// Terminal command audit log uchun ishlatiladi. (taskId, studentId) bo'yicha
// ko'p sessiya bo'lishi mumkin (har bir play urinishi alohida).
//
// SuspectProgress — har bir gumonlanuvchi uchun joriy qadam indeksi.
// JSON map ko'rinishida saqlanadi: {"<suspectId>": <stepIndex>, ...}.
type PlaySession struct {
	ID              uint       `gorm:"primaryKey" json:"id"`
	TaskID          uint       `gorm:"not null;index" json:"taskId"`
	StudentID       uint       `gorm:"not null;index" json:"studentId"`
	StartedAt       time.Time  `json:"startedAt"`
	EndedAt         *time.Time `json:"endedAt"`
	SuspectProgress string     `gorm:"type:text;not null;default:'{}'" json:"-"`
}

// TerminalCommand — o'qituvchi yaratgan terminal buyrug'i.
//
// Ikki rejim:
//   1) Per-suspect step rejimi (yangi):
//      - SuspectID belgilangan
//      - O'quvchi ushbu gumonlanuvchi uchun buyruqlarni AYNAN tartibda kiritishi shart
//      - IsFinalStep=true bo'lgan oxirgi qadamda EvidenceImageURL ochiladi
//   2) Erkin rejim (eski, backward compat):
//      - SuspectID nil
//      - Har qanday vaqtda mos kelgan buyruq ishlaydi
//
// MatchType:
//   - "exact"  — to'liq teng (case-insensitive, trim)
//   - "prefix" — kiritilgan satrning boshlanishi
//   - "regex"  — Go regexp sintaksisi
//
// EvidenceIDs — JSON-massiv: "[1,5,7]" (eski rejim uchun).
// Hint — talabaga ko'rsatiladigan maslahat.
type TerminalCommand struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	TaskID           uint      `gorm:"not null;index" json:"taskId"`
	SuspectID        *uint     `gorm:"index" json:"suspectId"`
	Command          string    `gorm:"not null" json:"command"`
	MatchType        string    `gorm:"not null;default:'exact'" json:"matchType"`
	Output           string    `gorm:"type:text;not null" json:"output"`
	EvidenceIDs      string    `gorm:"type:text;not null;default:'[]'" json:"evidenceIds"`
	Hint             string    `gorm:"not null;default:''" json:"hint"`
	SortOrder        int       `gorm:"column:sort_order;not null;default:0" json:"order"`
	IsFinalStep      bool      `gorm:"not null;default:false" json:"isFinalStep"`
	EvidenceImageURL *string   `gorm:"column:evidence_image_url" json:"evidenceImageUrl"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// SessionTerminalLog — har kiritilgan buyruqning auditi.
// Mos buyruq topilmasa MatchedCommandID nil bo'ladi.
type SessionTerminalLog struct {
	ID                  uint      `gorm:"primaryKey" json:"id"`
	SessionID           uint      `gorm:"not null;index" json:"sessionId"`
	Command             string    `gorm:"not null" json:"command"`
	MatchedCommandID    *uint     `json:"matchedCommandId"`
	EvidenceUnlockedIDs string    `gorm:"type:text;not null;default:'[]'" json:"evidenceUnlockedIds"`
	ExecutedAt          time.Time `json:"executedAt"`
}

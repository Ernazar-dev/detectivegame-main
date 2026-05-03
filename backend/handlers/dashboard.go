package handlers

import (
	"net/http"
	"strconv"
	"time"

	"detective-backend/middleware"
	"detective-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func TeacherDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := middleware.GetUserID(c)

		var students []models.User
		db.Where("role = ?", "student").Find(&students)

		// Faqat shu o'qituvchining ishlari
		var tasks []models.Task
		db.Where("created_by = ?", uid).Find(&tasks)

		// Faqat shu o'qituvchining ishlariga tegishli javoblar
		taskIDs := make([]uint, 0, len(tasks))
		for _, t := range tasks {
			taskIDs = append(taskIDs, t.ID)
		}
		var subs []models.Submission
		if len(taskIDs) > 0 {
			db.Where("task_id IN ?", taskIDs).Find(&subs)
		}

		activeMap := map[uint]bool{}
		for _, s := range subs {
			activeMap[s.StudentID] = true
		}
		completedMap := map[string]bool{}
		pending := 0
		for _, s := range subs {
			if s.Status == "approved" {
				completedMap[strconv.Itoa(int(s.TaskID))+"-"+strconv.Itoa(int(s.StudentID))] = true
			}
			if s.Status == "pending_approval" {
				pending++
			}
		}

		now := time.Now()
		weekly := make([]gin.H, 7)
		days := []string{"Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"}
		for i := 0; i < 7; i++ {
			day := now.AddDate(0, 0, -(6 - i))
			cnt := 0
			for _, s := range subs {
				if s.SubmittedAt.Day() == day.Day() && s.SubmittedAt.Month() == day.Month() {
					cnt++
				}
			}
			weekly[i] = gin.H{"label": days[day.Weekday()], "value": cnt}
		}

		diffOut := []gin.H{}
		for _, d := range []string{"easy", "medium", "hard"} {
			cnt := 0
			for _, t := range tasks {
				if t.Difficulty == d {
					cnt++
				}
			}
			label := string(d[0]-32) + d[1:]
			diffOut = append(diffOut, gin.H{"label": label, "value": cnt})
		}

		c.JSON(http.StatusOK, gin.H{
			"totalStudents":     len(students),
			"activeStudents":    len(activeMap),
			"totalTasks":        len(tasks),
			"completedTasks":    len(completedMap),
			"pendingApprovals":  pending,
			"weeklySubmissions": weekly,
			"tasksByDifficulty": diffOut,
		})
	}
}

func StudentDashboard(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := middleware.GetUserID(c)
		var u models.User
		if err := db.First(&u, uid).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Пользователь не найден"})
			return
		}
		var subs []models.Submission
		db.Where("student_id = ?", uid).Order("submitted_at DESC").Find(&subs)
		approved := []models.Submission{}
		pending := 0
		var sumScore float64
		for _, s := range subs {
			if s.Status == "approved" {
				approved = append(approved, s)
				if s.TotalScore != nil {
					sumScore += *s.TotalScore
				}
			}
			if s.Status == "submitted" || s.Status == "checking" || s.Status == "pending_approval" {
				pending++
			}
		}
		avg := 0.0
		if len(approved) > 0 {
			avg = sumScore / float64(len(approved))
		}

		var students []models.User
		db.Where("role = ?", "student").Order("xp DESC").Find(&students)
		rank := 0
		for i, s := range students {
			if s.ID == uid {
				rank = i + 1
				break
			}
		}

		badges := []gin.H{}
		if len(approved) >= 1 {
			badges = append(badges, gin.H{"id": "first_case", "name": "Первое дело", "description": "Первое задание выполнено"})
		}
		if len(approved) >= 5 {
			badges = append(badges, gin.H{"id": "veteran", "name": "Опытный детектив", "description": "Выполнено 5 заданий"})
		}
		for _, s := range approved {
			if s.TotalScore != nil && *s.TotalScore >= 90 {
				badges = append(badges, gin.H{"id": "perfect", "name": "Безупречное заключение", "description": "В одном задании набрано 90+ баллов"})
				break
			}
		}
		if rank > 0 && rank <= 3 {
			badges = append(badges, gin.H{"id": "top3", "name": "Элитный детектив", "description": "Вошёл в топ-3"})
		}

		recent := []gin.H{}
		take := 5
		if len(subs) < take {
			take = len(subs)
		}
		for i := 0; i < take; i++ {
			recent = append(recent, formatSub(db, subs[i]))
		}

		c.JSON(http.StatusOK, gin.H{
			"totalTasks":        len(subs),
			"completedTasks":    len(approved),
			"pendingTasks":      pending,
			"averageScore":      float64(int(avg*10)) / 10,
			"xp":                u.XP,
			"level":             u.Level,
			"rank":              rank,
			"badges":            badges,
			"recentSubmissions": recent,
		})
	}
}

func ActivityFeed(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := 10
		if v, err := strconv.Atoi(c.Query("limit")); err == nil && v > 0 {
			limit = v
		}
		var acts []models.Activity
		db.Order("created_at DESC").Limit(limit).Find(&acts)
		c.JSON(http.StatusOK, acts)
	}
}

func Rankings(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Frontend o'zi page qiladi — limit katta qilamiz
		limit := 500
		var students []models.User
		db.Where("role = ?", "student").Find(&students)
		var subs []models.Submission
		db.Where("status = ?", "approved").Find(&subs)
		type entry struct {
			Rank           int     `json:"rank"`
			UserID         uint    `json:"userId"`
			Name           string  `json:"name"`
			Avatar         *string `json:"avatar"`
			TotalScore     float64 `json:"totalScore"`
			CompletedTasks int     `json:"completedTasks"`
			XP             int     `json:"xp"`
			Level          int     `json:"level"`
		}
		entries := []entry{}
		for _, st := range students {
			var ts float64
			cnt := 0
			for _, s := range subs {
				if s.StudentID == st.ID {
					if s.TotalScore != nil {
						ts += *s.TotalScore
					}
					cnt++
				}
			}
			entries = append(entries, entry{UserID: st.ID, Name: st.Name, Avatar: st.Avatar, TotalScore: ts, CompletedTasks: cnt, XP: st.XP, Level: st.Level})
		}
		// sort by totalScore DESC, xp DESC
		for i := 0; i < len(entries); i++ {
			for j := i + 1; j < len(entries); j++ {
				if entries[j].TotalScore > entries[i].TotalScore || (entries[j].TotalScore == entries[i].TotalScore && entries[j].XP > entries[i].XP) {
					entries[i], entries[j] = entries[j], entries[i]
				}
			}
		}
		if len(entries) > limit {
			entries = entries[:limit]
		}
		for i := range entries {
			entries[i].Rank = i + 1
		}
		c.JSON(http.StatusOK, entries)
	}
}

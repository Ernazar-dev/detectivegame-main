package main

import (
	"bufio"
	"log"
	"os"
	"path/filepath"
	"strings"

	"detective-backend/handlers"
	"detective-backend/middleware"
	"detective-backend/models"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// loadEnv — .env faylini o'qib, os.Setenv bilan o'rnatadi.
// Mavjud env o'zgaruvchilarini qayta yozmaydi (docker/systemd uchun muhim).
func loadEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return // .env yo'q — muammo emas, env to'g'ridan belgilanishi mumkin
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		if os.Getenv(key) == "" { // mavjudni qayta yozmaymiz
			os.Setenv(key, val)
		}
	}
}

func main() {
	// ── .env yuklash ─────────────────────────────────────────────────────────
	loadEnv(".env")

	// ── Absolute uploads directory ────────────────────────────────────────────
	uploadsDir := os.Getenv("UPLOADS_DIR")
	if uploadsDir == "" {
		exDir, err := os.Getwd()
		if err != nil {
			log.Fatalf("cannot get working dir: %v", err)
		}
		uploadsDir = filepath.Join(exDir, "uploads")
	}

	for _, sub := range []string{"characters", "locations", "evidence"} {
		if err := os.MkdirAll(filepath.Join(uploadsDir, sub), 0755); err != nil {
			log.Fatalf("cannot create uploads/%s: %v", sub, err)
		}
	}
	log.Printf("Uploads directory: %s", uploadsDir)
	handlers.SetUploadsDir(uploadsDir)

	// ── Database ──────────────────────────────────────────────────────────────
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "detective.db"
	}
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	if err := db.AutoMigrate(
		&models.User{}, &models.Task{}, &models.TaskAssignment{},
		&models.Scene{}, &models.Suspect{}, &models.Question{},
		&models.Submission{}, &models.Activity{},
		&models.CharacterAsset{}, &models.LocationAsset{},
		&models.Evidence{},
		// Terminal architecture
		&models.TerminalCommand{}, &models.PlaySession{}, &models.SessionTerminalLog{},
	); err != nil {
		log.Fatalf("auto migrate failed: %v", err)
	}
	if err := handlers.SeedAll(db); err != nil {
		log.Fatalf("seed failed: %v", err)
	}
	// NOTE: Avtomatik dalillar generatori (SeedEvidenceForAllTasks) endi
	// ishga tushirilmaydi. O'qituvchi har bir gumonlanuvchi uchun dalillarni
	// va ularning Linux buyruqlarini admin paneldan o'zi kiritadi.
	// Eski tasklar uchun dalillar kerak bo'lsa, admin /api/tasks/:id/evidence/regenerate
	// endpointini chaqirib qo'lda generatsiya qilishi mumkin.

	// ── Router ────────────────────────────────────────────────────────────────
	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
	}))

	r.Static("/api/uploads", uploadsDir)

	api := r.Group("/api")
	api.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })

	// Real bash shell — xterm.js bilan WebSocket (token query-param orqali)
	api.GET("/ws/pty", handlers.PtyWS())

	api.POST("/auth/login", handlers.Login(db))
	api.POST("/auth/register", handlers.Register(db))
	api.GET("/auth/me", middleware.RequireAuth(), handlers.Me(db))

	auth := api.Group("/")
	auth.Use(middleware.RequireAuth())
	{
		auth.GET("/users", handlers.ListUsers(db))
		auth.POST("/users", handlers.CreateUser(db))
		auth.GET("/users/:id", handlers.GetUser(db))
		auth.PATCH("/users/:id", handlers.UpdateUser(db))
		auth.DELETE("/users/:id", handlers.DeleteUser(db))

		auth.GET("/tasks", handlers.ListTasks(db))
		auth.POST("/tasks", handlers.CreateTask(db))
		auth.GET("/tasks/:id", handlers.GetTask(db))
		auth.PATCH("/tasks/:id", handlers.UpdateTask(db))
		auth.DELETE("/tasks/:id", handlers.DeleteTask(db))
		auth.POST("/tasks/:id/assign", handlers.AssignTask(db))

		auth.GET("/tasks/:id/scenes", handlers.ListScenes(db))
		auth.POST("/tasks/:id/scenes", handlers.CreateScene(db))
		auth.PATCH("/tasks/:id/scenes/reorder", handlers.ReorderScenes(db))
		auth.PATCH("/tasks/:id/scenes/:sceneId", handlers.UpdateScene(db))
		auth.DELETE("/tasks/:id/scenes/:sceneId", handlers.DeleteScene(db))

		auth.GET("/tasks/:id/suspects", handlers.ListSuspects(db))
		auth.POST("/tasks/:id/suspects", handlers.CreateSuspect(db))
		auth.PATCH("/suspects/:id", handlers.UpdateSuspect(db))
		auth.DELETE("/suspects/:id", handlers.DeleteSuspect(db))

		auth.GET("/suspects/:id/questions", handlers.ListQuestions(db))
		auth.POST("/suspects/:id/questions", handlers.CreateQuestion(db))
		auth.PATCH("/questions/:qid", handlers.UpdateQuestion(db))
		auth.DELETE("/questions/:qid", handlers.DeleteQuestion(db))

		// Evidence (eski — backward compat)
		auth.GET("/tasks/:id/evidence", handlers.ListEvidenceByTask(db))
		auth.GET("/suspects/:id/evidence", handlers.ListEvidenceBySuspect(db))
		auth.POST("/evidence/:id/unlock", handlers.UnlockEvidence(db))
		auth.POST("/suspects/:id/evidence", handlers.CreateEvidence(db))
		auth.PATCH("/evidence/:id", handlers.UpdateEvidence(db))
		auth.DELETE("/evidence/:id", handlers.DeleteEvidence(db))
		auth.POST("/tasks/:id/evidence/regenerate", handlers.RegenerateEvidence(db))
		auth.POST("/evidence/:id/media", handlers.UploadEvidenceMedia(db))

		// ── Terminal commands (eski + yangi per-suspect) ──────────────────
		auth.GET("/tasks/:id/terminal-commands", handlers.ListTerminalCommands(db))
		auth.POST("/tasks/:id/terminal-commands", handlers.CreateTerminalCommand(db))
		auth.GET("/suspects/:id/terminal-commands", handlers.ListTerminalCommandsBySuspect(db))
		auth.POST("/suspects/:id/terminal-commands", handlers.CreateTerminalCommandForSuspect(db))
		auth.POST("/suspects/:id/terminal-defaults", handlers.SeedSuspectDefaults(db))
		auth.POST("/tasks/:id/terminal-demo", handlers.SeedDemoScenario(db))
		auth.PATCH("/terminal-commands/:id", handlers.UpdateTerminalCommand(db))
		auth.DELETE("/terminal-commands/:id", handlers.DeleteTerminalCommand(db))
		auth.POST("/terminal-commands/:id/image", handlers.UploadTerminalCommandImage(db))

		// ── Play sessions + terminal execute ──────────────────────────────
		auth.POST("/play-sessions", handlers.CreatePlaySession(db))
		auth.POST("/sessions/:sessionId/terminal-execute", handlers.ExecuteTerminal(db))

		auth.GET("/submissions", handlers.ListSubmissions(db))
		auth.POST("/submissions", handlers.CreateSubmission(db))
		auth.GET("/submissions/:id", handlers.GetSubmission(db))
		auth.POST("/submissions/:id/analyze", handlers.AnalyzeSubmission(db))
		auth.POST("/submissions/:id/approve", handlers.ApproveSubmission(db))

		auth.GET("/dashboard/teacher", handlers.TeacherDashboard(db))
		auth.GET("/dashboard/student", handlers.StudentDashboard(db))
		auth.GET("/dashboard/activity", handlers.ActivityFeed(db))
		auth.GET("/rankings", handlers.Rankings(db))

		auth.POST("/uploads/avatar", handlers.UploadAvatarImage())
	}

	api.GET("/assets/characters", handlers.ListCharacters(db))
	api.GET("/assets/locations", handlers.ListLocations(db))
	teach := api.Group("/")
	teach.Use(middleware.RequireTeacher())
	{
		teach.POST("/assets/characters/upload", handlers.UploadCharacterImage())
		teach.POST("/assets/characters", handlers.CreateCharacter(db))
		teach.PATCH("/assets/characters/:id", handlers.UpdateCharacter(db))
		teach.DELETE("/assets/characters/:id", handlers.DeleteCharacter(db))
		teach.POST("/assets/locations/upload", handlers.UploadLocationImage())
		teach.POST("/assets/locations", handlers.CreateLocation(db))
		teach.PATCH("/assets/locations/:id", handlers.UpdateLocation(db))
		teach.DELETE("/assets/locations/:id", handlers.DeleteLocation(db))
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Detective backend listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}

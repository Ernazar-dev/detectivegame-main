package handlers

// SeedDemoScenario — POST /tasks/:id/terminal-demo
//
// «ТАЙНАЯ УТЕЧКА» — полный готовый сценарий.
// Создаёт 3 подозреваемых, для каждого 4 шага терминала и SVG-доказательство.

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

// ─── SVG-доказательства ───────────────────────────────────────────────────────

const svgAlisher = `<svg width="900" height="580" xmlns="http://www.w3.org/2000/svg">
<rect width="900" height="580" fill="#0d1117"/>
<rect width="900" height="38" fill="#161b22"/>
<rect x="0" y="37" width="900" height="1" fill="#30363d"/>
<circle cx="18" cy="19" r="6" fill="#ff5f57"/><circle cx="38" cy="19" r="6" fill="#febc2e"/><circle cx="58" cy="19" r="6" fill="#28c840"/>
<text x="80" y="24" fill="#8b949e" font-family="monospace" font-size="12">forensic@case-net — /forensic/logs/transfer_log.txt</text>
<text x="16" y="68" fill="#58a6ff" font-family="monospace" font-size="12">$ cat /forensic/logs/transfer_log.txt</text>
<text x="16" y="96" fill="#7cffb2" font-family="monospace" font-size="12">══════════════════════════════════════════════════════════════</text>
<text x="16" y="114" fill="#7cffb2" font-family="monospace" font-size="13" font-weight="bold">  ЖУРНАЛ ПЕРЕДАЧИ ФАЙЛОВ — SogliQLab Внутренняя Система</text>
<text x="16" y="132" fill="#7cffb2" font-family="monospace" font-size="12">  Дата: 2025-11-04  |  Экспорт: Отдел IT-безопасности</text>
<text x="16" y="150" fill="#7cffb2" font-family="monospace" font-size="12">══════════════════════════════════════════════════════════════</text>
<text x="16" y="180" fill="#74e0ff" font-family="monospace" font-size="12">Время                 Пользователь        Действие         Файл</text>
<text x="16" y="196" fill="#30363d" font-family="monospace" font-size="12">──────────────────────────────────────────────────────────────</text>
<text x="16" y="216" fill="#8b949e" font-family="monospace" font-size="12">2025-11-04 08:14:22   a.karimov           ЧТЕНИЕ           formula_v6.xlsx</text>
<text x="16" y="234" fill="#8b949e" font-family="monospace" font-size="12">2025-11-04 11:33:07   m.toshmatova        ЧТЕНИЕ           otchet_Q3.pdf</text>
<text x="16" y="252" fill="#8b949e" font-family="monospace" font-size="12">2025-11-04 14:22:51   a.karimov           ЧТЕНИЕ           formula_v7.xlsx</text>
<text x="16" y="270" fill="#8b949e" font-family="monospace" font-size="12">2025-11-04 20:01:38   a.karimov           ЧТЕНИЕ           sintez_protokol.docx</text>
<text x="16" y="296" fill="#30363d" font-family="monospace" font-size="11">— — — — — — — — — — — — — — — — — ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ — — — — —</text>
<text x="16" y="320" fill="#ffd66b" font-family="monospace" font-size="12">▶  2025-11-04 23:11:14   a.karimov       КОПИРОВАНИЕ      formula_v7.xlsx → /dev/sdb1</text>
<text x="16" y="338" fill="#ffd66b" font-family="monospace" font-size="12">▶  2025-11-04 23:12:03   a.karimov       КОПИРОВАНИЕ      sintez_protokol.docx → /dev/sdb1</text>
<text x="16" y="356" fill="#ff5577" font-family="monospace" font-size="12">▶  2025-11-04 23:13:45   a.karimov       КОПИРОВАНИЕ      analiz_soedinenij.xlsx → /dev/sdb1</text>
<text x="16" y="374" fill="#ff5577" font-family="monospace" font-size="12">▶  2025-11-04 23:14:08   a.karimov       КОПИРОВАНИЕ      baza_issledovanij.sql → /dev/sdb1</text>
<text x="16" y="392" fill="#ff5577" font-family="monospace" font-size="13" font-weight="bold">▶  2025-11-04 23:14:38   a.karimov       ИЗВЛЕЧЕНИЕ       /dev/sdb1  [847 МБ передано]</text>
<rect x="16" y="412" width="868" height="72" fill="#ff557718" rx="4"/>
<rect x="16" y="412" width="868" height="72" fill="none" stroke="#ff5577" stroke-width="1" rx="4"/>
<text x="28" y="434" fill="#ff5577" font-family="monospace" font-size="12" font-weight="bold">⚠  АНОМАЛИЯ: 847 МБ скопировано на внешний USB-диск в 23:14</text>
<text x="28" y="452" fill="#ff5577" font-family="monospace" font-size="12">   Пользователь: Алишер Каримов (a.karimov)</text>
<text x="28" y="470" fill="#ff5577" font-family="monospace" font-size="12">   Устройство: SanDisk Ultra 3.1  [S/N: DL-7X9P2-2025]</text>
<text x="16" y="544" fill="#30363d" font-family="monospace" font-size="10">CASE-NET FORENSIC EXPORT — СЕКРЕТНО — Дело №2025-F-0441 — SogliQLab Investigation</text>
</svg>`

const svgMalika = `<svg width="900" height="580" xmlns="http://www.w3.org/2000/svg">
<rect width="900" height="580" fill="#111827"/>
<rect width="900" height="52" fill="#1f2937"/>
<rect x="0" y="51" width="900" height="1" fill="#374151"/>
<text x="16" y="22" fill="#9ca3af" font-family="monospace" font-size="11">📱 TELEGRAM — Зашифрованные сообщения восстановлены</text>
<text x="16" y="40" fill="#6b7280" font-family="monospace" font-size="11">Период: 2025-11-03 — 2025-11-04  |  Криминалистический клон #MT-4429</text>
<rect x="16" y="64" width="780" height="1" fill="#374151"/>
<text x="16" y="86" fill="#60a5fa" font-family="monospace" font-size="12" font-weight="bold">💬 НЕИЗВЕСТНЫЙ КОНТАКТ (+7 9XX XXX XX XX)</text>
<text x="16" y="104" fill="#374151" font-family="monospace" font-size="11">──────────────────────────────────────────────────────────</text>
<rect x="16" y="114" width="480" height="44" fill="#1e3a5f" rx="8"/>
<text x="28" y="132" fill="#93c5fd" font-family="monospace" font-size="12">Неизвестный:  Малика, договорились по цене?</text>
<text x="28" y="150" fill="#6b7280" font-family="monospace" font-size="10">2025-11-03  18:22</text>
<rect x="404" y="168" width="480" height="44" fill="#065f46" rx="8"/>
<text x="416" y="186" fill="#6ee7b7" font-family="monospace" font-size="12">Малика:  Да. 8000 долларов. Половину вперёд.</text>
<text x="416" y="204" fill="#6b7280" font-family="monospace" font-size="10">2025-11-03  18:47  ✓✓</text>
<rect x="16" y="222" width="540" height="44" fill="#1e3a5f" rx="8"/>
<text x="28" y="240" fill="#93c5fd" font-family="monospace" font-size="12">Неизвестный:  Нужно сегодня ночью. Готовься.</text>
<text x="28" y="258" fill="#6b7280" font-family="monospace" font-size="10">2025-11-03  19:15</text>
<rect x="404" y="276" width="480" height="44" fill="#065f46" rx="8"/>
<text x="416" y="294" fill="#6ee7b7" font-family="monospace" font-size="12">Малика:  Охрану я решу. Не волнуйся.</text>
<text x="416" y="312" fill="#6b7280" font-family="monospace" font-size="10">2025-11-03  19:33  ✓✓</text>
<rect x="16" y="330" width="480" height="44" fill="#1e3a5f" rx="8"/>
<text x="28" y="348" fill="#93c5fd" font-family="monospace" font-size="12">Неизвестный:  4000$ переведено. Остальное завтра.</text>
<text x="28" y="366" fill="#6b7280" font-family="monospace" font-size="10">2025-11-04  23:41</text>
<rect x="404" y="384" width="480" height="44" fill="#065f46" rx="8"/>
<text x="416" y="402" fill="#6ee7b7" font-family="monospace" font-size="12">Малика:  Получила. Материал у вас. ✓</text>
<text x="416" y="420" fill="#6b7280" font-family="monospace" font-size="10">2025-11-04  23:58  ✓✓</text>
<rect x="16" y="448" width="868" height="60" fill="#7f1d1d30" rx="4"/>
<rect x="16" y="448" width="868" height="60" fill="none" stroke="#ef4444" stroke-width="1" rx="4"/>
<text x="28" y="468" fill="#ef4444" font-family="monospace" font-size="12" font-weight="bold">⚠  ВЫВОД: М. Тошматова договорилась о продаже формулы за $8 000</text>
<text x="28" y="488" fill="#ef4444" font-family="monospace" font-size="12">   Предоплата: $4 000 получена  |  Перевод: 2025-11-04 23:41</text>
<text x="16" y="548" fill="#374151" font-family="monospace" font-size="10">CASE-NET FORENSIC EXPORT — СЕКРЕТНО — Дело №2025-F-0441  |  Telegram DB v5.1 decrypt</text>
</svg>`

const svgBobur = `<svg width="900" height="580" xmlns="http://www.w3.org/2000/svg">
<rect width="900" height="580" fill="#0a0f1e"/>
<rect width="900" height="42" fill="#0d1529"/>
<rect x="0" y="41" width="900" height="1" fill="#1e3a5f"/>
<text x="16" y="16" fill="#4ade80" font-family="monospace" font-size="11" font-weight="bold">🔐 SECUREWATCH PRO v7.2 — Система управления камерами</text>
<text x="16" y="32" fill="#166534" font-family="monospace" font-size="10">SogliQLab — Корпус A, этаж B  |  Администратор: admin@soglilab.ru</text>
<text x="16" y="62" fill="#4ade80" font-family="monospace" font-size="12">═══ ЖУРНАЛ СОСТОЯНИЯ КАМЕР — 2025-11-04 ══════════════════════</text>
<text x="16" y="84" fill="#16a34a" font-family="monospace" font-size="11">ID_КАМ   Расположение           22:00     23:00     00:00</text>
<text x="16" y="100" fill="#15803d" font-family="monospace" font-size="11">──────────────────────────────────────────────────────────────</text>
<text x="16" y="120" fill="#4ade80" font-family="monospace" font-size="11">КАМ-01   Вход / Выход           [●ВКЛ]    [●ВКЛ]    [●ВКЛ]</text>
<text x="16" y="138" fill="#4ade80" font-family="monospace" font-size="11">КАМ-02   Приёмная               [●ВКЛ]    [●ВКЛ]    [●ВКЛ]</text>
<text x="16" y="164" fill="#ffd66b" font-family="monospace" font-size="12">КАМ-03   Коридор корпуса A      [●ВКЛ]    [○ВЫКЛ]   [●ВКЛ]</text>
<text x="16" y="182" fill="#ffd66b" font-family="monospace" font-size="12">КАМ-04   Вход в лабораторию     [●ВКЛ]    [○ВЫКЛ]   [●ВКЛ]</text>
<text x="16" y="200" fill="#ff5577" font-family="monospace" font-size="12">КАМ-05   Основная лаборатория   [●ВКЛ]    [○ВЫКЛ]   [●ВКЛ]</text>
<text x="16" y="226" fill="#4ade80" font-family="monospace" font-size="11">КАМ-06   Серверная              [●ВКЛ]    [●ВКЛ]    [●ВКЛ]</text>
<text x="16" y="244" fill="#4ade80" font-family="monospace" font-size="11">КАМ-07   Запасной выход         [●ВКЛ]    [●ВКЛ]    [●ВКЛ]</text>
<text x="16" y="272" fill="#ffd66b" font-family="monospace" font-size="12">══════════════ СОБЫТИЯ ОТКЛЮЧЕНИЯ ════════════════════════════</text>
<text x="16" y="296" fill="#74e0ff" font-family="monospace" font-size="11">Время         Пользователь     Действие               Камеры</text>
<text x="16" y="312" fill="#1e3a5f" font-family="monospace" font-size="11">──────────────────────────────────────────────────────────────</text>
<text x="16" y="332" fill="#ff5577" font-family="monospace" font-size="12" font-weight="bold">23:09:14      b.xasanov        РУЧНОЕ_ОТКЛЮЧЕНИЕ      КАМ-03, КАМ-04, КАМ-05</text>
<text x="16" y="350" fill="#ff5577" font-family="monospace" font-size="12">23:09:15      СИСТЕМА          Предупреждение → ОТКЛОНЕНО (b.xasanov)</text>
<text x="16" y="368" fill="#8b949e" font-family="monospace" font-size="11">23:27:44      b.xasanov        РУЧНОЕ_ВКЛЮЧЕНИЕ       КАМ-03, КАМ-04, КАМ-05</text>
<text x="16" y="386" fill="#6b7280" font-family="monospace" font-size="11">            → Время отключения: 18 минут 30 секунд</text>
<rect x="16" y="410" width="868" height="88" fill="#7f1d1d22" rx="4"/>
<rect x="16" y="410" width="868" height="88" fill="none" stroke="#ff5577" stroke-width="1" rx="4"/>
<text x="28" y="432" fill="#ff5577" font-family="monospace" font-size="12" font-weight="bold">⚠  ВАЖНО: КАМ-03, КАМ-04, КАМ-05 — камеры на пути к лаборатории</text>
<text x="28" y="450" fill="#ff5577" font-family="monospace" font-size="12">   Отключены: 23:09:14  (за 2 минуты до начала копирования файлов!)</text>
<text x="28" y="468" fill="#ff5577" font-family="monospace" font-size="12">   Включены:  23:27:44  (через 13 минут после извлечения USB)</text>
<text x="28" y="486" fill="#ffd66b" font-family="monospace" font-size="12">   Исполнитель: Бобур Хасанов (b.xasanov) — Сотрудник охраны</text>
<text x="16" y="548" fill="#1e3a5f" font-family="monospace" font-size="10">CASE-NET FORENSIC EXPORT — СЕКРЕТНО — Дело №2025-F-0441  |  SecureWatch DB dump</text>
</svg>`

// ─── Определения команд ────────────────────────────────────────────────────

type cmdDef struct {
	command   string
	matchType string
	output    string
	hint      string
	isFinal   bool
}

type suspectDef struct {
	name        string
	role        string
	description string
	cmds        []cmdDef
	svgContent  string
	svgFname    string
}

func buildDemoSuspects() []suspectDef {
	return []suspectDef{
		{
			name:        "Алишер Каримов",
			role:        "Лаборант",
			description: "5 лет опыта работы. Имеет полный доступ к файлам формулы.",
			svgContent:  svgAlisher,
			svgFname:    "demo_evidence_alisher.svg",
			cmds: []cmdDef{
				{
					command:   "connect alisher@casenet.local",
					matchType: "prefix",
					output: strings.Join([]string{
						"Установка защищённого соединения...",
						"┌─ ИЗЪЯТОЕ УСТРОЙСТВО ─────────────────────────────────┐",
						"│  Владелец:     Алишер Каримов                        │",
						"│  Модель:       Lenovo ThinkPad E15 (2024)            │",
						"│  MAC:          A4:C3:F0:88:2D:11                     │",
						"│  Статус:       ИЗЪЯТО КАК ДОКАЗАТЕЛЬСТВО             │",
						"│  Последняя активность: 3 дня назад  (23:14:38)      │",
						"└──────────────────────────────────────────────────────┘",
						"Доступ разрешён. Список файлов: ls -la",
					}, "\n"),
					hint: "Введите: ls -la",
				},
				{
					command:   "ls -la",
					matchType: "exact",
					output: strings.Join([]string{
						"итого 94",
						"drwxr-xr-x  Документы/",
						"drwxr-xr-x  Загрузки/",
						"drwxr-xr-x  .Секретное/",
						"-rw-r--r--  formula_v7.xlsx           2.1 МБ",
						"-rw-r--r--  sintez_protokol.docx      890 КБ",
						"-rw-r--r--  transfer_log.txt          18.7 КБ",
						"-rw-------  formula_backup.bin       ЗАШИФРОВАНО",
						"",
						"[!] Обнаружена история подключения внешнего диска.",
					}, "\n"),
					hint: "Введите: cat transfer_log.txt",
				},
				{
					command:   "cat transfer_log.txt",
					matchType: "exact",
					output: strings.Join([]string{
						"[2025-11-04 23:11:14]  КОПИРОВАНИЕ  formula_v7.xlsx → /dev/sdb1",
						"[2025-11-04 23:12:03]  КОПИРОВАНИЕ  sintez_protokol.docx → /dev/sdb1",
						"[2025-11-04 23:13:45]  КОПИРОВАНИЕ  analiz_soedinenij.xlsx → /dev/sdb1",
						"[2025-11-04 23:14:08]  КОПИРОВАНИЕ  baza_issledovanij.sql → /dev/sdb1",
						"[2025-11-04 23:14:38]  ИЗВЛЕЧЕНИЕ   /dev/sdb1  ← 847 МБ",
						"",
						"[!] 847 МБ скопировано на USB-диск в 23:14",
						"    Устройство: SanDisk Ultra 3.1  [S/N: DL-7X9P2-2025]",
						"    Расшифровать архив: decrypt -f formula_backup.bin",
					}, "\n"),
					hint: "Введите: decrypt -f formula_backup.bin",
				},
				{
					command:   "decrypt -f formula_backup.bin",
					matchType: "prefix",
					output: strings.Join([]string{
						"Загрузка модуля дешифрования...",
						"Применяется ключ дела: CASE-2025-F-0441",
						"......... [████████████████████] 100%",
						"",
						"УСПЕШНО — зашифрованное доказательство открыто.",
						"[★] Журнал передачи файлов извлечён — смотрите панель справа →",
					}, "\n"),
					isFinal: true,
				},
			},
		},
		{
			name:        "Малика Тошматова",
			role:        "Секретарь",
			description: "Секретарь директора. Управляет контактами с внешними партнёрами.",
			svgContent:  svgMalika,
			svgFname:    "demo_evidence_malika.svg",
			cmds: []cmdDef{
				{
					command:   "connect malika@casenet.local",
					matchType: "prefix",
					output: strings.Join([]string{
						"Установка защищённого соединения...",
						"┌─ ИЗЪЯТОЕ УСТРОЙСТВО ─────────────────────────────────┐",
						"│  Владелец:     Малика Тошматова                      │",
						"│  Модель:       Samsung Galaxy S24 Ultra              │",
						"│  IMEI:         358491-10-823741-2                    │",
						"│  Статус:       ИЗЪЯТО КАК ДОКАЗАТЕЛЬСТВО             │",
						"│  Последняя активность: 3 дня назад  (23:58:12)      │",
						"└──────────────────────────────────────────────────────┘",
						"Доступ разрешён. Список файлов: ls -la",
					}, "\n"),
					hint: "Введите: ls -la",
				},
				{
					command:   "ls -la",
					matchType: "exact",
					output: strings.Join([]string{
						"итого 61",
						"drwxr-xr-x  DCIM/",
						"drwxr-xr-x  Telegram/",
						"drwxr-xr-x  .удалённое/",
						"-rw-r--r--  kontakty.db               4.2 КБ",
						"-rw-r--r--  inbox.msg                  31 КБ",
						"-rw-------  telegram_secret.db       ЗАШИФРОВАНО",
						"",
						"[!] Обнаружено восстановление удалённых сообщений.",
					}, "\n"),
					hint: "Введите: cat inbox.msg",
				},
				{
					command:   "cat inbox.msg",
					matchType: "exact",
					output: strings.Join([]string{
						"[Telegram — Неизвестный +7 9XX XXX XX XX]",
						"",
						"Неизвестный  18:22  → Малика, договорились по цене?",
						"Малика       18:47  → Да. 8000 долларов. Половину вперёд.",
						"Неизвестный  19:15  → Нужно сегодня ночью. Готовься.",
						"Малика       19:33  → Охрану я решу. Не волнуйся.",
						"Неизвестный  23:41  → 4000$ переведено. Остальное завтра.",
						"Малика       23:58  → Получила. Материал у вас. ✓",
						"",
						"[!] Зафиксирован перевод $4 000 — полная переписка: decrypt -f telegram_secret.db",
					}, "\n"),
					hint: "Введите: decrypt -f telegram_secret.db",
				},
				{
					command:   "decrypt -f telegram_secret.db",
					matchType: "prefix",
					output: strings.Join([]string{
						"Загрузка модуля дешифрования...",
						"Применяется ключ дела: CASE-2025-F-0441",
						"......... [████████████████████] 100%",
						"",
						"УСПЕШНО — база данных Telegram открыта.",
						"[★] Полная переписка извлечена — смотрите панель справа →",
					}, "\n"),
					isFinal: true,
				},
			},
		},
		{
			name:        "Бобур Хасанов",
			role:        "Сотрудник охраны",
			description: "Дежурил в ночную смену. Имеет полный доступ к системе видеонаблюдения.",
			svgContent:  svgBobur,
			svgFname:    "demo_evidence_bobur.svg",
			cmds: []cmdDef{
				{
					command:   "connect bobur@casenet.local",
					matchType: "prefix",
					output: strings.Join([]string{
						"Установка защищённого соединения...",
						"┌─ ИЗЪЯТОЕ УСТРОЙСТВО ─────────────────────────────────┐",
						"│  Владелец:     Бобур Хасанов                         │",
						"│  Модель:       Xiaomi Redmi Note 13 Pro              │",
						"│  IMEI:         861423-07-198234-1                    │",
						"│  Статус:       ИЗЪЯТО КАК ДОКАЗАТЕЛЬСТВО             │",
						"│  Последняя активность: 3 дня назад  (23:29:05)      │",
						"└──────────────────────────────────────────────────────┘",
						"Доступ разрешён. Список файлов: ls -la",
					}, "\n"),
					hint: "Введите: ls -la",
				},
				{
					command:   "ls -la",
					matchType: "exact",
					output: strings.Join([]string{
						"итого 38",
						"drwxr-xr-x  Смены/",
						"drwxr-xr-x  .скрытое/",
						"-rw-r--r--  otchet_smeny.txt          8.4 КБ",
						"-rw-r--r--  cam_override.log          5.1 КБ",
						"-rw-r--r--  zhurnal_dostupa.txt      12.3 КБ",
						"-rw-------  .скрытое/instrukcia.enc  ЗАШИФРОВАНО",
						"",
						"[!] Обнаружены события ручного отключения в системе камер.",
					}, "\n"),
					hint: "Введите: cat cam_override.log",
				},
				{
					command:   "cat cam_override.log",
					matchType: "exact",
					output: strings.Join([]string{
						"SecureWatch Pro v7.2 — Журнал переопределения камер",
						"Корпус A, этаж B — 2025-11-04",
						"",
						"23:09:14  b.xasanov  РУЧНОЕ_ОТКЛЮЧЕНИЕ  КАМ-03, КАМ-04, КАМ-05",
						"23:09:15  СИСТЕМА     ПРЕДУПРЕЖДЕНИЕ     → ОТКЛОНЕНО (b.xasanov)",
						"23:27:44  b.xasanov  РУЧНОЕ_ВКЛЮЧЕНИЕ   КАМ-03, КАМ-04, КАМ-05",
						"          → Время отключения: 18 минут 30 секунд",
						"",
						"[!] КАМ-03/04/05 — камеры на пути к лаборатории",
						"    Выключены: 23:09 (за 2 минуты до начала копирования!)",
						"    Включены:  23:27 (через 13 минут после извлечения USB)",
						"    Прочитать инструкцию: decrypt -f .скрытое/instrukcia.enc",
					}, "\n"),
					hint: "Введите: decrypt -f .скрытое/instrukcia.enc",
				},
				{
					command:   "decrypt -f .скрытое/instrukcia.enc",
					matchType: "prefix",
					output: strings.Join([]string{
						"Загрузка модуля дешифрования...",
						"Применяется ключ дела: CASE-2025-F-0441",
						"......... [████████████████████] 100%",
						"",
						"УСПЕШНО — зашифрованная инструкция открыта.",
						"[★] Журнал отключения камер извлечён — смотрите панель справа →",
					}, "\n"),
					isFinal: true,
				},
			},
		},
	}
}

// ─── Обработчик ───────────────────────────────────────────────────────────────

// SeedDemoScenario — POST /tasks/:id/terminal-demo
func SeedDemoScenario(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		taskID, _ := strconv.Atoi(c.Param("id"))
		var task models.Task
		if err := db.First(&task, taskID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Задание не найдено"})
			return
		}

		dir := filepath.Join(uploadsDir, "evidence")
		if err := os.MkdirAll(dir, 0755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать папку загрузок"})
			return
		}

		defs := buildDemoSuspects()
		type result struct {
			Name     string `json:"name"`
			Role     string `json:"role"`
			Steps    int    `json:"steps"`
			ImageURL string `json:"imageUrl"`
		}
		var results []result

		for _, sd := range defs {
			fname := fmt.Sprintf("demo_%d_%s_%d.svg", taskID, sd.svgFname, time.Now().UnixNano())
			dst := filepath.Join(dir, fname)
			if err := os.WriteFile(dst, []byte(sd.svgContent), 0644); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось сохранить изображение: " + err.Error()})
				return
			}
			imageURL := "/api/uploads/evidence/" + fname

			suspect := models.Suspect{
				TaskID:        uint(taskID),
				Name:          sd.name,
				Role:          sd.role,
				Description:   sd.description,
				SuspectStatus: "suspect",
			}
			if err := db.Create(&suspect).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать подозреваемого: " + err.Error()})
				return
			}

			susID := suspect.ID

			for i, cd := range sd.cmds {
				imgPtr := (*string)(nil)
				if cd.isFinal {
					imgPtr = &imageURL
				}
				cmd := models.TerminalCommand{
					TaskID:           uint(taskID),
					SuspectID:        &susID,
					Command:          cd.command,
					MatchType:        cd.matchType,
					Output:           cd.output,
					Hint:             cd.hint,
					EvidenceIDs:      "[]",
					SortOrder:        i,
					IsFinalStep:      cd.isFinal,
					EvidenceImageURL: imgPtr,
				}
				if err := db.Create(&cmd).Error; err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Не удалось создать команду: " + err.Error()})
					return
				}
			}

			results = append(results, result{
				Name:     sd.name,
				Role:     sd.role,
				Steps:    len(sd.cmds),
				ImageURL: imageURL,
			})
		}

		c.JSON(http.StatusCreated, gin.H{
			"case":     "ТАЙНАЯ УТЕЧКА — Кража формулы SogliQLab",
			"taskId":   taskID,
			"suspects": results,
		})
	}
}

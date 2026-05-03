# Detektiv o'yin — Terminal & Dalillar moduli (v2 — backend bilan)

Ushbu patch oldingi v1 (faqat frontend Linux-terminal interfeysi) ustiga
**backend tomonida real dalillar tizimi**ni qo'shadi. Endi terminalda chiqadigan
dalillar (audio, telefon, foto, kamera, ekspertiza, hujjat, shifrlangan alibi)
to'liq backend'da saqlanadi va bir necha endpoint orqali boshqariladi.

## ✦ Yangiliklar — backend (Go + GORM + SQLite)

### 1. Yangi model — `models.Evidence`
Har bir gumonlanuvchi (`Suspect`) uchun bir nechta dalil. Maydonlar:

| maydon       | tavsif                                                            |
|--------------|-------------------------------------------------------------------|
| `kind`       | `camera \| audio \| phone \| photo \| message \| dna \| fingerprint \| document \| financial \| vault` |
| `fileName`   | terminalda ko'rinadigan fayl nomi (`audio-03.wav`, `cam-01.feed`) |
| `title`      | inson o'qiy oladigan sarlavha (`"Аудиозапись: Александр"`)        |
| `body`       | dalilning to'liq matni (UI'da `cat` bilan ko'riladi)              |
| `hint`       | `ls -l`'da ko'rinadigan ipucu                                     |
| `locked`     | `true` bo'lsa — `decrypt <file> <pwd>` talab qilinadi             |
| `password`   | server-only (JSON'ga chiqmaydi); `decrypt` validatsiyasi uchun    |
| `sortOrder`  | bitta gumonlanuvchi ichida tartib                                  |

DB jadval avtomatik yaratiladi (`AutoMigrate` ga qo'shildi).

### 2. Avtomatik dalillar generatori — `handlers/evidence.go`
Server birinchi marta ishga tushganda har bir gumonlanuvchi uchun
**4 ta dalil** deterministik ravishda yaratiladi (gumonlanuvchining ID asosida hash):

1. **CCTV kamera** — har kim uchun (behaviorTraits asosida);
2. **Shaxsiy** dalil — `audio | phone | photo | message` ichidan biri;
3. **Ekspertiza** — `dna | fingerprint | document | financial` ichidan biri;
4. **Vault (alibi.enc)** — shifrlangan; password = familiyaning lotinchada
   kichik harfli transliteratsiyasi (masalan, "Александр Волков" → `volkov`).

Kontent gumonlanuvchining mavjud `description`, `behaviorTraits`, `secretAlibi`
maydonlaridan olinadi — **ssenariy buzilmaydi**, faqat ma'lumot yangi
"kanal"larda qayta paketlanadi.

Generator **idempotent**: agar tasknta dalil bo'lsa, qayta yaratmaydi.

### 3. Yangi REST endpointlar
Hammasi `RequireAuth()` bilan himoyalangan:

| metod   | yo'l                                       | ruxsat       | tavsif                       |
|---------|--------------------------------------------|--------------|------------------------------|
| `GET`   | `/api/tasks/:id/evidence`                  | har kim      | task ichidagi barcha dalillar |
| `GET`   | `/api/suspects/:id/evidence`               | har kim      | bitta gumonlanuvchining dalillari |
| `POST`  | `/api/evidence/:id/unlock`                 | har kim      | `{password}` → `{ok, body}`  |
| `POST`  | `/api/suspects/:id/evidence`               | o'qituvchi   | qo'lda yangi dalil qo'shish  |
| `PATCH` | `/api/evidence/:id`                        | o'qituvchi   | dalilni tahrirlash           |
| `DELETE`| `/api/evidence/:id`                        | o'qituvchi   | dalilni o'chirish            |
| `POST`  | `/api/tasks/:id/evidence/regenerate`       | o'qituvchi   | task uchun barcha dalillarni qayta generatsiya qilish |

> **Eslatma**: o'quvchi (`student`) `GET` orqali olganda, `locked=true`
> dalillarning `body` maydoni bo'sh keladi. Faqat `decrypt` (POST `/unlock`)
> orqali to'g'ri parol kiritilgandan keyin server `body`ni qaytaradi.

### 4. `GetTask` o'zgarishi
`GET /api/tasks/:id` javobida endi har bir `suspect` ichida `evidence: [...]`
massivi mavjud. Mijoz bitta so'rovda hamma narsani oladi — qo'shimcha so'rov
shart emas.

## ✦ Yangiliklar — frontend (React + Vite + axios)

### `src/lib/types.ts`
- Yangi tip: `Evidence`, `EvidenceKind`.
- `Suspect` ga `evidence?: Evidence[]` qo'shildi.

### `src/components/EvidenceTerminal.tsx`
Terminal endi **backend dalillaridan** virtual filesystem quradi. Yangi papkalar:

```
/cameras    — kamera yozuvlari
/audio      — perehvachilangan audio
/phone      — biling/qo'ng'iroqlar jurnali
/photos     — fotofiksatsiya (EXIF bilan)
/messages   — tiklangan xabarlar
/forensics  — DNK, barmoq izlari
/docs       — hujjatlar va moliya
/vault      — shifrlangan alibi
/archive    — gumonlanuvchilar dosyesi (har doim mavjud)
/logs       — tizim jurnali
```

Yangi terminal komandalari:
- `play <fayl>` — audio/qo'ng'iroqni eshitish (waveform animatsiyasi);
- `view <fayl>` — fotoni ko'rish (JPEG render animatsiyasi);
- `forensics <fayl>` — DNK/barmoq izi ekspertizasini o'qish;
- `decrypt <fayl> <parol>` — endi backend `/unlock` endpointini chaqiradi.

Mavjud `cat`, `ls`, `cd`, `scan`, `collect`, `evidence`, `clear`, `help` va
boshqa komandalar oldingidek ishlaydi. Yig'ilgan dalillar topshiriqning
`explanation` maydoniga avtomatik biriktiriladi (Play.tsx orqali).

### `src/pages/student/Play.tsx`
v1'dagi qo'shimcha o'zgarishsiz qoldi (terminal endi avtomatik ravishda
backend dalillarini ko'radi).

## ✦ O'rnatish

1. ZIP ichidagi 7 ta faylni o'z papkalariga ustiga yozing:
   ```
   backend/main.go
   backend/models/models.go
   backend/handlers/tasks.go
   backend/handlers/evidence.go            ← yangi
   frontend/src/lib/types.ts
   frontend/src/components/EvidenceTerminal.tsx
   frontend/src/pages/student/Play.tsx     ← v1'dan o'zgarmagan
   ```

2. Backend ni qayta ishga tushiring:
   ```bash
   cd backend && go run .
   ```
   Birinchi ishga tushishida har bir mavjud task'ning gumonlanuvchilari uchun
   avtomatik dalillar yaratiladi (idempotent — qayta-qayta xavfsiz).

3. Frontend ni qayta build qiling:
   ```bash
   cd frontend && npm install && npm run build
   ```

## ✦ Tekshirish

1. O'qituvchi sifatida kirib, mavjud topshiriqni oching → `GET /api/tasks/:id`
   javobida har bir `suspect.evidence[]` to'la kelganini ko'rasiz.
2. O'quvchi sifatida o'yinni boshlang, **TERMINAL** tugmasini bosing:
   - `ls /` — barcha papkalarni ko'rasiz;
   - `ls /audio` — gumonlanuvchilarning audio yozuvlarini;
   - `cat audio-01.wav` — yozuvni o'qish (avtomatik dalillarga qo'shiladi);
   - `play audio-01.wav` — animatsiya bilan;
   - `ls -l /vault` — shifrlangan alibi fayllarini va parol ipuchlarini;
   - `decrypt alibi-01.enc volkov` — to'g'ri parol bilan ochish.
3. Topshiriqni yuborganda `explanation` ostida `— УЛИКИ ИЗ ТЕРМИНАЛА —` bloki
   bilan barcha yig'ilgan dalillar o'qituvchiga jo'natiladi.

## ✦ Texnik tekshirish (avtomatik o'tdi ✓)
- `go build ./...` — xatosiz;
- `npx tsc -b` — xatosiz;
- `npx vite build` — xatosiz (Play chunk ~71 KB);
- 12 gumonlanuvchi → 48 ta dalil avtomatik yaratildi (har biriga 4 ta).

---
**Versiya**: v2 (backend integratsiyasi)
**Sana**: 2026-04-28

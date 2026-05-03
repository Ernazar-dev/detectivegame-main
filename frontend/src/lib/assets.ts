const locKeys = [
  "cyber_neon_street","glass_office","crime_lab","classroom",
  "security_room","coffee_shop","minimalist_office",
  "parking_lot","smart_street","campus_entrance",
];

// Yangi 5 ta personaj keylari
const charKeys = ["biznesmen","olim_laborant","doktor","police","jurnalist"];

// Eski default keylar → yangi URL (migration fallback)
const legacyCharKeys: Record<string, string> = {
  tech_genius:         "/api/uploads/characters/char_biznesmen.png",
  corporate_ceo:       "/api/uploads/characters/char_biznesmen.png",
  office_employee:     "/api/uploads/characters/char_biznesmen.png",
  gritty_detective:    "/api/uploads/characters/char_biznesmen.png",
  police_officer:      "/api/uploads/characters/char_police.png",
  security_guard:      "/api/uploads/characters/char_police.png",
  construction_worker: "/api/uploads/characters/char_police.png",
  janitor:             "/api/uploads/characters/char_police.png",
  forensic_scientist:  "/api/uploads/characters/char_olim_laborant.png",
  it_specialist:       "/api/uploads/characters/char_olim_laborant.png",
  professor:           "/api/uploads/characters/char_doktor.png",
  university_student:  "/api/uploads/characters/char_jurnalist.png",
  delivery_courier:    "/api/uploads/characters/char_jurnalist.png",
  street_informant:    "/api/uploads/characters/char_jurnalist.png",
};

export function resolveAsset(value?: string | null): string | undefined {
  if (!value) return undefined;
  // Allaqachon URL bo'lsa — o'zgartirilmaydi
  if (value.startsWith("http") || value.startsWith("data:") || value.startsWith("/")) return value;
  // Joylashuv key
  if (locKeys.includes(value)) return `/api/uploads/locations/loc_${value}.png`;
  // Yangi personaj key
  if (charKeys.includes(value)) return `/api/uploads/characters/char_${value}.png`;
  // Eski personaj key → yangi URL
  if (legacyCharKeys[value]) return legacyCharKeys[value];
  // Noma'lum key — undefined qaytaramiz (404 bo'lmaydi)
  return undefined;
}

export const charPresetKeys = charKeys;
export const locPresetKeys  = locKeys;
export const allPresetKeys  = [...charKeys, ...locKeys];
export type Difficulty = "easy" | "medium" | "hard";

export type Scene = {
  id: number;
  taskId: number;
  scene_order?: number;
  title: string;
  body: string;
  imageAsset?: string | null;
  characterAsset?: string | null;
};

export type Question = {
  id: number;
  suspectId: number;
  question: string;
  answer: string;
};

export type EvidenceKind =
  | "camera"
  | "audio"
  | "phone"
  | "photo"
  | "message"
  | "dna"
  | "fingerprint"
  | "document"
  | "financial"
  | "vault"
  | "image";

export type Evidence = {
  id: number;
  taskId: number;
  suspectId: number;
  kind: EvidenceKind;
  fileName: string;
  title: string;
  body: string;
  hint: string;
  locked: boolean;
  order: number;
  mediaUrl?: string | null;
  mediaType?: string | null;
  relevance?: string | null;
  createdAt?: string;
  // Terminal-driven asosiy dalil sifatida belgilangan (bonus ball uchun).
  isKeyEvidence?: boolean;
  // Faqat terminal orqali topilishi mumkin (ro'yxatlarda yashiriladi).
  terminalOnly?: boolean;
};

// O'qituvchi tomonidan task uchun yaratilgan terminal buyrug'i.
export type TerminalCommandMatchType = "exact" | "prefix" | "regex";

export type TerminalCommand = {
  id: number;
  taskId: number;
  // Per-suspect step rejimi: qaysi gumonlanuvchining zanjiriga tegishli (null bo'lsa eski rejim).
  suspectId?: number | null;
  command: string;
  matchType: TerminalCommandMatchType;
  output: string;
  evidenceIds: number[];
  hint: string;
  order: number;
  // Bu zanjirning oxirgi qadamimi (rasm ochiladi).
  isFinalStep?: boolean;
  // IsFinalStep=true bo'lsa, ko'rsatiladigan dalil rasmi.
  evidenceImageUrl?: string | null;
};

export type PlaySession = {
  id: number;
  taskId: number;
  studentId: number;
  startedAt: string;
};

// Terminal-execute javob shakli.
export type TerminalExecuteResult = {
  matched: boolean;
  output: string;
  evidenceIds: number[];
  hint?: string;
  // Per-suspect rejim uchun qo'shimcha maydonlar:
  stepIndex?: number;
  totalSteps?: number;
  isFinalStep?: boolean;
  evidenceImageUrl?: string | null;
  suspectId?: number;
  completed?: boolean;
  // Progress bar uchun:
  progressPercent?: number;
  progressColor?: "green" | "red";
};

export type Suspect = {
  id: number;
  taskId: number;
  characterAssetId?: string | null;
  suspectStatus?: string | null;
  name: string;
  avatar?: string | null;
  role?: string | null;
  description?: string | null;
  behaviorTraits?: string | null;
  secretAlibi?: string | null;
  questions?: Question[];
  evidence?: Evidence[];
};

export type Task = {
  id: number;
  title: string;
  difficulty: Difficulty;
  scenario: string;
  timerMinutes?: number | null;
  correctSuspectId?: number | null;
  correctReasoning?: string | null;
  evidenceReferences?: string | null;
  locationAssetId?: string | null;
  assignedToAll: boolean;
  status: "draft" | "published";
  createdBy: number;
  createdAt: string;
  scenes?: Scene[];
  suspects?: Suspect[];
  assignedStudentIds?: number[];
};

export type Submission = {
  id: number;
  taskId: number;
  studentId: number;
  selectedSuspectId: number;
  explanation: string;
  status: "submitted" | "checking" | "pending_approval" | "approved";
  suspectScore?: number | null;
  explanationScore?: number | null;
  totalScore?: number | null;
  botFeedback?: string | null;
  teacherFeedback?: string | null;
  submittedAt: string;
  approvedAt?: string | null;
  // Terminal-driven asosiy dalil bonusi.
  bonusScore?: number | null;
  keyEvidenceFound?: number | null;
  keyEvidenceTotal?: number | null;
  task?: Task;
  student?: { id: number; name: string };
  suspect?: Suspect;
};

export type CharacterAsset = {
  id: number;
  key: string;
  name: string;
  roleHint: string;
  description?: string;
  imageUrl: string;
};

export type LocationAsset = {
  id: number;
  key: string;
  name: string;
  type: string;
  imageUrl: string;
};
// Enums — точное соответствие backend/prisma/schema.prisma

export type UserRole = 'admin' | 'specialist' | 'viewer';
export type OrgType = 'customer' | 'participant';
export type SubscriptionPlan = 'free' | 'pro' | 'business' | 'enterprise';
export type ProcurementStatus = 'active' | 'draft' | 'completed' | 'cancelled';
export type DocumentType = 'law' | 'regulation' | 'template' | 'court_practice' | 'etp_rules';
export type ChatRole = 'user' | 'assistant' | 'system';
export type AnalysisStatus = 'processing' | 'completed' | 'failed';
export type NotificationType = 'deadline' | 'update' | 'violation' | 'system';

// ── Основные модели ──────────────────────────────────────────

export interface OrgDocument {
  id: string;
  name: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface OrgSettings {
  ogrn?: string;
  legalAddress?: string;
  actualAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  director?: string;
  description?: string;
  activities?: string;
  bankName?: string;
  bankAccount?: string;
  correspondentAccount?: string;
  bik?: string;
  orgDocuments?: OrgDocument[];
}

export interface Organization {
  id: string;
  name: string;
  inn: string;
  kpp: string;
  orgType: OrgType;
  settings: OrgSettings | null;
  subscriptionPlan: SubscriptionPlan;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId: string;
  createdAt: string;
  lastLogin: string | null;
  organization?: Organization;
}

export interface ETPPlatform {
  id: string;
  name: string;
  code: string;
  apiEndpoint: string;
  isActive: boolean;
  credentials: Record<string, unknown> | null;
}

export interface Procurement {
  id: string;
  number: string;
  title: string;
  status: ProcurementStatus;
  statusLabel?: string | null;
  procedureType?: string | null;
  summingUpDate?: string | null;
  biddingProcedures?: string | null;
  summingUpPlace?: string | null;
  summingUpOrder?: string | null;
  etpId: string;
  customerId: string;
  initialPrice: string; // Prisma Decimal сериализуется как строка
  currency: string;
  publicationDate: string; // ISO 8601
  applicationDeadline: string; // ISO 8601
  documentationUrl: string | null;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
  isFavoriteCustomer?: boolean;
  etp?: Pick<ETPPlatform, 'name' | 'code'>;
  customer?: Pick<Organization, 'id' | 'name' | 'inn'>;
}

export interface FavoriteOrg {
  id: string;
  name: string;
  inn: string;
  kpp: string;
  favId: string;
  since: string;
}

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  filePath: string;
  fileSize: number;
  pagesCount: number | null;
  tags: string[];
  isActual: boolean;
  actualDate: string | null;
  sourceUrl: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  procurementId: string | null;
  role: ChatRole;
  content: string;
  sources: unknown | null;
  tokensUsed: number;
  createdAt: string;
}

export type ChatDocStatus = 'processing' | 'ready' | 'failed';

export interface ChatDocument {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: ChatDocStatus;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface DocumentAnalysis {
  id: string;
  originalFileName: string | null;
  analysisResult: { textLength?: number; rawAiResponse?: string; wasTruncated?: boolean; originalLength?: number; analyzedLength?: number } | null;
  violations: Array<{ message: string }> | null;
  recommendations: string[] | null;
  status: AnalysisStatus;
  createdAt: string;
  _cached?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

// ── Auth ─────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  emailVerified?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  orgType: OrgType;
  organization: {
    name: string;
    inn: string;
    kpp: string;
  };
}

// ── Assistant ─────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  procurementId?: string;
}

export interface ChatResponse {
  content: string;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

// ── Pagination wrapper ────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  counts?: { active: number; completed: number; cancelled: number };
}

// ── Dashboard ─────────────────────────────────────────────────

export interface DashboardStats {
  totalProcurements: number;
  activeProcurements: number;
  deadlinesThisWeek: number;
  nextDeadline: string | null;
  completedAnalyses: number;
}

// ── API error ─────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

// ── Admin ─────────────────────────────────────────────────────

export interface AdminUser extends User {
  emailVerified: boolean;
}

export interface AdminStats {
  users: number;
  procurements: number;
  documents: number;
}

export interface SystemInfo {
  ai: {
    provider: string;
    model: string;
    configured: boolean;
    temperature: number;
    maxTokens: number;
  };
  email: {
    configured: boolean;
    host: string | null;
    from: string | null;
  };
  billing: {
    yookassaConfigured: boolean;
  };
  storage: {
    s3Configured: boolean;
    uploadPath: string;
    maxFileSizeMb: number;
  };
  security: {
    bcryptRounds: number;
    accessTokenTtl: string;
    refreshTokenTtl: string;
    maxSessions: number;
    corsOrigin: string;
  };
  nodeVersion: string;
  environment: string;
}

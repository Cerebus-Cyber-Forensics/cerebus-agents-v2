export type UserRole = 'admin' | 'team_leader' | 'agent';

export type UserAccountStatus = 'active' | 'disabled' | 'archived';

export type IdDocumentType =
  | 'National ID'
  | 'Passport'
  | "Driver's License"
  | 'Asylum / Permit';

export type TShirtStyle = 'Male' | 'Female';

export type TShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL';

export type AccountType =
  | 'Cheque / Current'
  | 'Savings'
  | 'Transmission'
  | 'Business';

export type AgentStatus = 'active' | 'inactive' | 'pending_review';

export type VerificationStatus =
  | 'pending'
  | 'confirmed'
  | 'late_flagged'
  | 'verified'
  | 'rejected';

export type ActionKind = 'confirmed_existing' | 'updated_banking';

export type DocCategory =
  | 'bank_statement'
  | 'id_passport'
  | 'contract'
  | 'profile_photo';

export type AuditActionType =
  | 'agent_created'
  | 'personal_info_updated'
  | 'banking_updated'
  | 'monthly_confirmed'
  | 'document_uploaded'
  | 'payment_verified'
  | 'payment_rejected'
  | 'role_updated'
  | 'user_status_updated';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  teamLeaderName?: string;
  linkedAgentId?: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastSignInAt?: unknown;
  accountStatus?: UserAccountStatus;
}

export interface AgentRecord {
  agentId: string;
  ownerUid: string;
  createdByUid: string;
  timestamp: unknown;
  updatedAt: unknown;
  emailAddress: string;
  cerebusAgentCode: string;
  geographicArea: string;
  cerebusTeamLeader: string;
  firstName: string;
  middleNames: string;
  surname: string;
  nationality: string;
  idDocumentType: IdDocumentType;
  idPassportNumber: string;
  cellphoneNumber: string;
  whatsappNumber: string;
  email: string;
  tShirtStyle: TShirtStyle;
  tShirtSize: TShirtSize;
  yourComments: string;
  bankNameAndCode: string;
  accountHolderName: string;
  accountType: AccountType;
  accountNumber: string;
  latestBankCycle?: string;
  latestBankDocId?: string;
  latestBankDocName?: string;
  idDocId?: string;
  idDocName?: string;
  contractDocId?: string;
  contractDocName?: string;
  photoDocId?: string;
  photoDocName?: string;
  photoThumbUrl?: string;
  status: AgentStatus;
}

export interface MonthlyConfirmation {
  confirmationId: string;
  agentId: string;
  ownerUid: string;
  agentCode: string;
  agentName: string;
  emailAddress: string;
  cerebusTeamLeader: string;
  geographicArea: string;
  cycleMonth: string;
  cutoffDate: string;
  isLateAfterCutoff: boolean;
  actionKind: ActionKind;
  bankNameAndCode: string;
  accountHolderName: string;
  accountType: AccountType;
  accountNumber: string;
  previousBankSummary?: string;
  bankDocId?: string;
  bankDocName?: string;
  verificationStatus: VerificationStatus;
  submittedByUid: string;
  submittedByName: string;
  submittedAt: unknown;
  updatedAt: unknown;
  verifiedByUid?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  reviewerNotes?: string;
}

export interface AgentDocument {
  docId: string;
  agentId: string;
  ownerUid: string;
  emailAddress: string;
  cerebusTeamLeader: string;
  docCategory: DocCategory;
  cycleMonth: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: unknown;
}

export interface AuditChangeItem {
  field: string;
  previousValue: string;
  newValue: string;
}

export interface AuditLogEntry {
  logId: string;
  timestamp: unknown;
  actorUid: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole;
  agentId: string;
  ownerUid: string;
  emailAddress: string;
  agentCode: string;
  agentName: string;
  cerebusTeamLeader: string;
  actionType: AuditActionType;
  cycleMonth: string;
  isLateAfterCutoff: boolean;
  summary: string;
  changes: AuditChangeItem[];
}

export interface ProcessedUploadFile {
  fileName: string;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
}

export interface ProcessedProfilePhoto extends ProcessedUploadFile {
  thumbDataUrl: string;
}

export const FIELD_LIMITS = {
  email: 200,
  cerebusAgentCode: 40,
  geographicArea: 120,
  cerebusTeamLeader: 120,
  firstName: 80,
  middleNames: 120,
  surname: 80,
  nationality: 80,
  idPassportNumber: 60,
  phone: 40,
  yourComments: 1000,
  bankNameAndCode: 120,
  accountHolderName: 120,
  accountNumber: 40,
  reviewerNotes: 500,
  summary: 500,
} as const;

export const ID_DOCUMENT_TYPES: IdDocumentType[] = [
  'National ID',
  'Passport',
  "Driver's License",
  'Asylum / Permit',
];

export const TSHIRT_STYLES: TShirtStyle[] = ['Male', 'Female'];

export const TSHIRT_SIZES: TShirtSize[] = [
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
];

export const ACCOUNT_TYPES: AccountType[] = [
  'Cheque / Current',
  'Savings',
  'Transmission',
  'Business',
];

export const BOOTSTRAPPED_ADMIN_EMAIL = 'sikhosana.ts@gmail.com';
export const ADMIN_LOGIN_EMAIL = 'admin@cerebus.co.za';
export const AGENT_LOGIN_DOMAIN = 'agent.cerebus.co.za';
export const ADMIN_ACTIVATION_EMAILS = [
  BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase(),
  ADMIN_LOGIN_EMAIL.toLowerCase(),
];

export interface GeneratedAgentCredentials {
  loginUsername: string;
  authEmail: string;
  tempPassword: string;
}

export interface CreateAgentResult {
  agentId: string;
  credentials: GeneratedAgentCredentials | null;
}

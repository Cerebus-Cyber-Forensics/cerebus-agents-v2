# Security Specification — Cerebus Payment & Compliance Ledger

## 1. Data Invariants

1. **Authenticated & Verified Identity**: All reads and writes require an authenticated Firebase user with `request.auth.token.email_verified == true`.
2. **Default Deny Safety Net**: Any collection or path not explicitly declared is denied by `match /{document=**} { allow read, write: if false; }`.
3. **Self-Assigned Role Prevention**: Users registering in `/users/{uid}` may only create their own record (`uid == request.auth.uid`) with `role == 'agent'` (unless bootstrapped admin `sikhosana.ts@gmail.com`). Only an `admin` may elevate or change `role` or `teamLeaderName`.
4. **PII & Banking Isolation**: Agents may only read, create, and update their own `/agents/{agentId}` dossier (`ownerUid == request.auth.uid` or verified `emailAddress == request.auth.token.email`). Team Leaders may read/verify records assigned to their `cerebusTeamLeader`. Admins have full operational access.
5. **Action-Scoped Updates & Protected Verification State**:
   - Agents updating their own `/agents/{agentId}` record cannot overwrite `ownerUid`, `createdByUid`, `timestamp`, or `status`.
   - Agents submitting `/monthly_confirmations/{confirmationId}` cannot self-set `verificationStatus` to `'verified'` or `'rejected'`, nor tamper with `verifiedByUid` / `verifiedAt`. Only Admins or assigned Team Leaders can perform payment verification actions.
6. **Immutable Audit Paper Trail**: `/audit_logs/{logId}` is strictly append-only (`allow update, delete: if false;`). `actorUid` must equal `request.auth.uid` and `timestamp` must equal `request.time`.
7. **Strict Temporal & Boundary Enforcement**: Creation timestamps (`timestamp`, `createdAt`, `submittedAt`, `uploadedAt`) and update timestamps (`updatedAt`) must equal `request.time`. Every string field has strict `.size()` caps, IDs match `^[a-zA-Z0-9_\-]+$`, and `changes` arrays are bounded (`<= 30`).

## 2. Dirty Dozen Adversarial Payloads

1. **Privilege Escalation on Signup**: User creates `/users/{uid}` with `role: 'admin'`. -> Expect `PERMISSION_DENIED`.
2. **Role Self-Promotion on Update**: Agent updates `/users/{uid}` changing `role` from `'agent'` to `'admin'`. -> Expect `PERMISSION_DENIED`.
3. **Unverified Email Spoofing**: Request with `email == 'sikhosana.ts@gmail.com'` and `email_verified == false`. -> Expect `PERMISSION_DENIED`.
4. **Cross-Agent PII Read**: Agent A attempts `get` on Agent B's `/agents/{agentBId}`. -> Expect `PERMISSION_DENIED`.
5. **Blanket List Scraping**: Agent attempts unauthenticated or non-owner `list` on `/agents` without matching ownership. -> Expect `PERMISSION_DENIED`.
6. **Ghost Field Injection (Shadow Update)**: Agent updates `/agents/{id}` with an extra undeclared field `isSuperVerified: true`. -> Expect `PERMISSION_DENIED`.
7. **Self-Verification Bypass**: Agent creates or updates `/monthly_confirmations/{id}` with `verificationStatus: 'verified'`. -> Expect `PERMISSION_DENIED`.
8. **Backdated Timestamp Spoofing**: User submits confirmation with `submittedAt` set to a past date before the 2nd cutoff instead of `request.time`. -> Expect `PERMISSION_DENIED`.
9. **Audit Log Tampering**: User attempts `update` or `delete` on `/audit_logs/{logId}`. -> Expect `PERMISSION_DENIED`.
10. **Actor Impersonation in Audit Log**: User creates `/audit_logs/{logId}` with `actorUid` set to another user's UID. -> Expect `PERMISSION_DENIED`.
11. **Oversized ID Poisoning**: User attempts write to `/agents/AAAA...` (>140 chars or invalid characters). -> Expect `PERMISSION_DENIED`.
12. **Unbounded Array Exhaustion**: User creates `/audit_logs/{logId}` with `changes` array exceeding 30 items. -> Expect `PERMISSION_DENIED`.

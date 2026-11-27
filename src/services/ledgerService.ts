import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  serverTimestamp,
  setDoc,
  terminate,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  AccountType,
  ActionKind,
  AGENT_LOGIN_DOMAIN,
  AgentDocument,
  AgentRecord,
  AgentStatus,
  AuditActionType,
  AuditChangeItem,
  BOOTSTRAPPED_ADMIN_EMAIL,
  CreateAgentResult,
  DocCategory,
  FIELD_LIMITS,
  GeneratedAgentCredentials,
  IdDocumentType,
  MonthlyConfirmation,
  ProcessedProfilePhoto,
  ProcessedUploadFile,
  TShirtSize,
  TShirtStyle,
  UserAccount,
  UserAccountStatus,
  UserRole,
  VerificationStatus,
} from '../types';
import {
  buildFieldDiffs,
  getAgentFullName,
  getCutoffDateString,
  toMillis,
} from '../utils/cycleUtils';

function sanitizeStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

export const PERSONAL_FIELD_LABELS: Record<string, string> = {
  emailAddress: 'Email Address',
  cerebusAgentCode: 'Cerebus agent code',
  geographicArea: 'Geographic area',
  cerebusTeamLeader: 'Cerebus team leader',
  firstName: 'First name',
  middleNames: 'Middle names',
  surname: 'Surname',
  nationality: 'Nationality',
  idDocumentType: 'ID document type',
  idPassportNumber: 'ID/Passport number',
  cellphoneNumber: 'Cellphone number',
  whatsappNumber: 'Whatsapp number',
  email: 'Email',
  tShirtStyle: 'T-shirt style',
  tShirtSize: 'T-shirt size',
  yourComments: 'Your comments',
  status: 'Agent status',
};

export const BANKING_FIELD_LABELS: Record<string, string> = {
  bankNameAndCode: 'Bank name and code',
  accountHolderName: 'Account holder name',
  accountType: 'Account type',
  accountNumber: 'Account number',
};

export function normalizeAccountNumber(accountNumber: string): string {
  return (accountNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

export async function computeBankRegistryKey(
  accountNumber: string,
): Promise<string> {
  const normalized = normalizeAccountNumber(accountNumber);
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `bk_${hashHex}`;
}

export interface DuplicateBankCheckResult {
  isDuplicate: boolean;
  normalizedAccountNumber: string;
  bankKey: string;
  matchedAgentId?: string;
  matchedAgentCode?: string;
  matchedBankName?: string;
  reason?: string;
}

export async function checkDuplicateBankDetails(
  _bankNameAndCode: string,
  accountNumber: string,
  options?: {
    excludeAgentId?: string;
    actorRole?: UserRole;
    teamLeaderName?: string;
    includeCollectionScan?: boolean;
  },
): Promise<DuplicateBankCheckResult> {
  const normalized = normalizeAccountNumber(accountNumber);
  if (normalized.length < 4) {
    return {
      isDuplicate: false,
      normalizedAccountNumber: normalized,
      bankKey: '',
    };
  }

  const bankKey = await computeBankRegistryKey(normalized);

  try {
    const regSnap = await getDoc(doc(db, 'bank_registry', bankKey));
    if (regSnap.exists()) {
      const reg = regSnap.data() as { agentId?: string };
      if (!options?.excludeAgentId || reg.agentId !== options.excludeAgentId) {
        let matchedAgentCode: string | undefined;
        let matchedBankName: string | undefined;

        if (
          reg.agentId &&
          (options?.actorRole === 'admin' || options?.actorRole === 'team_leader')
        ) {
          try {
            const agentSnap = await getDoc(doc(db, 'agents', reg.agentId));
            if (agentSnap.exists()) {
              const matched = agentSnap.data() as AgentRecord;
              matchedAgentCode = matched.cerebusAgentCode;
              matchedBankName = matched.bankNameAndCode;
            }
          } catch {
            // Non-readable cross-team agent; omit PII details
          }
        }

        const detailSuffix = matchedAgentCode
          ? ` (assigned to ${matchedAgentCode}${matchedBankName ? ` · ${matchedBankName}` : ''})`
          : '';

        return {
          isDuplicate: true,
          normalizedAccountNumber: normalized,
          bankKey,
          matchedAgentId: reg.agentId,
          matchedAgentCode,
          matchedBankName,
          reason: `Duplicate bank details detected: this account number is already registered in the added banks${detailSuffix}.`,
        };
      }
    }
  } catch {
    // If registry check fails transiently, fall through to collection scan when permitted
  }

  if (options?.includeCollectionScan && auth.currentUser) {
    try {
      if (options.actorRole === 'admin') {
        const agentsSnap = await getDocs(collection(db, 'agents'));
        for (const docSnap of agentsSnap.docs) {
          const existingAgent = docSnap.data() as AgentRecord;
          if (
            options.excludeAgentId &&
            existingAgent.agentId === options.excludeAgentId
          ) {
            continue;
          }
          if (normalizeAccountNumber(existingAgent.accountNumber) === normalized) {
            return {
              isDuplicate: true,
              normalizedAccountNumber: normalized,
              bankKey,
              matchedAgentId: existingAgent.agentId,
              matchedAgentCode: existingAgent.cerebusAgentCode,
              matchedBankName: existingAgent.bankNameAndCode,
              reason: `Duplicate bank details detected: this account number is already registered in the added banks (${existingAgent.cerebusAgentCode} · ${existingAgent.bankNameAndCode}).`,
            };
          }
        }
      } else if (
        options.actorRole === 'team_leader' &&
        options.teamLeaderName
      ) {
        const agentsSnap = await getDocs(
          query(
            collection(db, 'agents'),
            where('cerebusTeamLeader', '==', options.teamLeaderName),
          ),
        );
        for (const docSnap of agentsSnap.docs) {
          const existingAgent = docSnap.data() as AgentRecord;
          if (
            options.excludeAgentId &&
            existingAgent.agentId === options.excludeAgentId
          ) {
            continue;
          }
          if (normalizeAccountNumber(existingAgent.accountNumber) === normalized) {
            return {
              isDuplicate: true,
              normalizedAccountNumber: normalized,
              bankKey,
              matchedAgentId: existingAgent.agentId,
              matchedAgentCode: existingAgent.cerebusAgentCode,
              matchedBankName: existingAgent.bankNameAndCode,
              reason: `Duplicate bank details detected: this account number is already registered in the added banks (${existingAgent.cerebusAgentCode} · ${existingAgent.bankNameAndCode}).`,
            };
          }
        }
      }
    } catch {
      // Ignore unauthorized collection scan fallback
    }
  }

  return {
    isDuplicate: false,
    normalizedAccountNumber: normalized,
    bankKey,
  };
}

export async function ensureUserProfile(
  firebaseUser: User,
): Promise<UserAccount> {
  const uid = firebaseUser.uid;
  const email = sanitizeStr(
    (firebaseUser.email || '').toLowerCase(),
    FIELD_LIMITS.email,
  );
  const displayName = sanitizeStr(
    firebaseUser.displayName || email.split('@')[0] || 'Cerebus User',
    120,
  );
  const userRef = doc(db, 'users', uid);

  const parsedSignInMs = firebaseUser.metadata.lastSignInTime
    ? Date.parse(firebaseUser.metadata.lastSignInTime)
    : Date.now();
  const authSignInMs = Number.isFinite(parsedSignInMs)
    ? parsedSignInMs
    : Date.now();
  const authSignInTs = Timestamp.fromMillis(authSignInMs);

  let account: UserAccount;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      account = snap.data() as UserAccount;
      if (
        account.accountStatus === 'disabled' ||
        account.accountStatus === 'archived'
      ) {
        return account;
      }

      const shouldPromoteBootstrappedAdmin =
        firebaseUser.emailVerified &&
        email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() &&
        account.role !== 'admin';
      const existingSignInMs = account.lastSignInAt
        ? toMillis(account.lastSignInAt)
        : 0;
      const shouldSyncLastSignIn =
        !account.lastSignInAt ||
        Math.abs(authSignInMs - existingSignInMs) >= 1000;

      if (shouldPromoteBootstrappedAdmin || shouldSyncLastSignIn) {
        const patch: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };
        if (shouldPromoteBootstrappedAdmin) {
          patch.role = 'admin';
        }
        if (shouldSyncLastSignIn) {
          patch.lastSignInAt = authSignInTs;
        }
        await updateDoc(userRef, patch);
        account = {
          ...account,
          ...(shouldPromoteBootstrappedAdmin ? { role: 'admin' as UserRole } : {}),
          ...(shouldSyncLastSignIn ? { lastSignInAt: authSignInTs } : {}),
        };
      }
    } else {
      const initialRole: UserRole =
        firebaseUser.emailVerified &&
        email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
          ? 'admin'
          : 'agent';
      const newProfile = {
        uid,
        email,
        displayName,
        role: initialRole,
        teamLeaderName: '',
        linkedAgentId: '',
        accountStatus: 'active' as UserAccountStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastSignInAt: authSignInTs,
      };
      await setDoc(userRef, newProfile);
      account = newProfile as unknown as UserAccount;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  // Attempt to auto-link an existing agent record by email if verified and not linked yet
  if (
    firebaseUser.emailVerified &&
    account.role === 'agent' &&
    !account.linkedAgentId &&
    email
  ) {
    try {
      const q = query(
        collection(db, 'agents'),
        where('emailAddress', '==', email),
        limit(1),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const agentDoc = snap.docs[0];
        const agentData = agentDoc.data() as AgentRecord;
        const batch = writeBatch(db);
        if (agentData.ownerUid !== uid) {
          batch.update(doc(db, 'agents', agentData.agentId), {
            ownerUid: uid,
            updatedAt: serverTimestamp(),
          });
        }
        batch.update(userRef, {
          linkedAgentId: agentData.agentId,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        account = { ...account, linkedAgentId: agentData.agentId };
      }
    } catch {
      // Non-fatal if no matching record exists
    }
  }

  return account;
}

export interface AgentFormInput {
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
  status: AgentStatus;
  cycleMonth: string;
  bankFile?: ProcessedUploadFile | null;
  idFile?: ProcessedUploadFile | null;
  contractFile?: ProcessedUploadFile | null;
  photoFile?: ProcessedProfilePhoto | null;
  contractTermsAcceptedAt?: string;
}

function randomInt(maxExclusive: number): number {
  const arr = new Uint32Array(1);
  window.crypto.getRandomValues(arr);
  return arr[0] % maxExclusive;
}

function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;

  const chars: string[] = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];
  for (let i = chars.length; i < length; i++) {
    chars.push(all[randomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

function buildAgentLoginUsername(agentCode: string, suffix?: string): string {
  const base =
    agentCode
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 32) || 'agent';
  return suffix ? `${base}-${suffix}` : base;
}

interface ProvisionedAgentSession {
  secondaryApp: FirebaseApp;
  secondaryAuth: Auth;
  secondaryDb: Firestore;
  user: User;
  credentials: GeneratedAgentCredentials;
}

async function provisionAgentAuthAccount(
  agentCode: string,
  fullName: string,
): Promise<ProvisionedAgentSession> {
  const appName = `provision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, appName);
  const secondaryAuth = getAuth(secondaryApp);
  let secondaryDb: Firestore | null = null;

  const tempPassword = generateTempPassword(12);
  let createdUser: User | null = null;
  let loginUsername = '';
  let authEmail = '';

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const suffix =
        attempt === 0
          ? undefined
          : Math.random().toString(36).slice(2, 6);
      loginUsername = buildAgentLoginUsername(agentCode, suffix);
      authEmail = `${loginUsername}@${AGENT_LOGIN_DOMAIN}`;
      try {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          authEmail,
          tempPassword,
        );
        createdUser = cred.user;
        break;
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'auth/email-already-in-use' && attempt < 3) {
          continue;
        }
        if (code === 'auth/operation-not-allowed') {
          throw new Error(
            'Email/Password sign-in must be enabled in Firebase Console (Authentication → Sign-in method) to generate agent logins.',
          );
        }
        throw err;
      }
    }

    if (!createdUser) {
      throw new Error('Could not generate a unique agent login username.');
    }

    await updateProfile(createdUser, {
      displayName: sanitizeStr(fullName, 120),
    }).catch(() => {});

    await secondaryAuth.authStateReady();
    await createdUser.getIdToken(true);
    secondaryDb = getFirestore(
      secondaryApp,
      firebaseConfig.firestoreDatabaseId,
    );

    return {
      secondaryApp,
      secondaryAuth,
      secondaryDb,
      user: createdUser,
      credentials: {
        loginUsername,
        authEmail,
        tempPassword,
      },
    };
  } catch (err) {
    await signOut(secondaryAuth).catch(() => {});
    if (secondaryDb) {
      await terminate(secondaryDb).catch(() => {});
    }
    await deleteApp(secondaryApp).catch(() => {});
    throw err;
  }
}

export async function createAgentWithDocsAndLog(
  input: AgentFormInput,
  actor: UserAccount,
  options?: { selfSignup?: boolean; publicSignup?: boolean },
): Promise<CreateAgentResult> {
  const agentId = makeId('agt');
  const emailAddress = sanitizeStr(
    input.emailAddress.toLowerCase(),
    FIELD_LIMITS.email,
  );
  const fullName = getAgentFullName(input);
  const cycleMonth = input.cycleMonth;

  const dupCheck = await checkDuplicateBankDetails(
    input.bankNameAndCode,
    input.accountNumber,
    {
      actorRole: options?.publicSignup ? undefined : actor.role,
      teamLeaderName: actor.teamLeaderName,
      includeCollectionScan: !options?.publicSignup && !options?.selfSignup,
    },
  );
  if (dupCheck.isDuplicate) {
    throw new Error(
      dupCheck.reason ||
        'Duplicate bank details detected: this account number is already registered in the added banks.',
    );
  }

  const shouldProvisionLogin = !options?.selfSignup;
  const provisioned = shouldProvisionLogin
    ? await provisionAgentAuthAccount(input.cerebusAgentCode, fullName)
    : null;

  const ownerUid = provisioned ? provisioned.user.uid : actor.uid;
  const actorUid =
    options?.publicSignup && provisioned ? provisioned.user.uid : actor.uid;
  const targetDb =
    options?.publicSignup && provisioned ? provisioned.secondaryDb : db;
  const effectiveActorName = sanitizeStr(
    options?.publicSignup ? fullName : actor.displayName,
    120,
  );
  const effectiveActorEmail = sanitizeStr(
    options?.publicSignup
      ? provisioned?.credentials.authEmail || emailAddress
      : actor.email,
    FIELD_LIMITS.email,
  );

  const docWrites: Array<{ id: string; payload: Record<string, unknown> }> = [];

  let idDocId = '';
  let idDocName = '';
  if (input.idFile) {
    idDocId = makeId('doc_id');
    idDocName = sanitizeStr(input.idFile.fileName, 200);
    docWrites.push({
      id: idDocId,
      payload: {
        docId: idDocId,
        agentId,
        ownerUid,
        emailAddress,
        cerebusTeamLeader: sanitizeStr(
          input.cerebusTeamLeader,
          FIELD_LIMITS.cerebusTeamLeader,
        ),
        docCategory: 'id_passport' as DocCategory,
        cycleMonth: '',
        fileName: idDocName,
        mimeType: sanitizeStr(input.idFile.mimeType, 100),
        fileSize: input.idFile.fileSize,
        dataUrl: input.idFile.dataUrl,
        uploadedByUid: actorUid,
        uploadedByName: effectiveActorName,
        uploadedAt: serverTimestamp(),
      },
    });
  }

  let contractDocId = '';
  let contractDocName = '';
  if (input.contractFile) {
    contractDocId = makeId('doc_ct');
    contractDocName = sanitizeStr(input.contractFile.fileName, 200);
    docWrites.push({
      id: contractDocId,
      payload: {
        docId: contractDocId,
        agentId,
        ownerUid,
        emailAddress,
        cerebusTeamLeader: sanitizeStr(
          input.cerebusTeamLeader,
          FIELD_LIMITS.cerebusTeamLeader,
        ),
        docCategory: 'contract' as DocCategory,
        cycleMonth: '',
        fileName: contractDocName,
        mimeType: sanitizeStr(input.contractFile.mimeType, 100),
        fileSize: input.contractFile.fileSize,
        dataUrl: input.contractFile.dataUrl,
        uploadedByUid: actorUid,
        uploadedByName: effectiveActorName,
        uploadedAt: serverTimestamp(),
      },
    });
  }

  let bankDocId = '';
  let bankDocName = '';
  if (input.bankFile) {
    bankDocId = makeId('doc_bk');
    bankDocName = sanitizeStr(input.bankFile.fileName, 200);
    docWrites.push({
      id: bankDocId,
      payload: {
        docId: bankDocId,
        agentId,
        ownerUid,
        emailAddress,
        cerebusTeamLeader: sanitizeStr(
          input.cerebusTeamLeader,
          FIELD_LIMITS.cerebusTeamLeader,
        ),
        docCategory: 'bank_statement' as DocCategory,
        cycleMonth,
        fileName: bankDocName,
        mimeType: sanitizeStr(input.bankFile.mimeType, 100),
        fileSize: input.bankFile.fileSize,
        dataUrl: input.bankFile.dataUrl,
        uploadedByUid: actorUid,
        uploadedByName: effectiveActorName,
        uploadedAt: serverTimestamp(),
      },
    });
  }

  let photoDocId = '';
  let photoDocName = '';
  let photoThumbUrl = '';
  if (input.photoFile) {
    photoDocId = makeId('doc_ph');
    photoDocName = sanitizeStr(input.photoFile.fileName, 200);
    photoThumbUrl = sanitizeStr(input.photoFile.thumbDataUrl, 80000);
    docWrites.push({
      id: photoDocId,
      payload: {
        docId: photoDocId,
        agentId,
        ownerUid,
        emailAddress,
        cerebusTeamLeader: sanitizeStr(
          input.cerebusTeamLeader,
          FIELD_LIMITS.cerebusTeamLeader,
        ),
        docCategory: 'profile_photo' as DocCategory,
        cycleMonth: '',
        fileName: photoDocName,
        mimeType: sanitizeStr(input.photoFile.mimeType, 100),
        fileSize: input.photoFile.fileSize,
        dataUrl: input.photoFile.dataUrl,
        uploadedByUid: actorUid,
        uploadedByName: effectiveActorName,
        uploadedAt: serverTimestamp(),
      },
    });
  }

  const agentPayload = {
    agentId,
    ownerUid,
    createdByUid: actorUid,
    timestamp: serverTimestamp(),
    updatedAt: serverTimestamp(),
    emailAddress,
    cerebusAgentCode: sanitizeStr(
      input.cerebusAgentCode.toUpperCase(),
      FIELD_LIMITS.cerebusAgentCode,
    ),
    geographicArea: sanitizeStr(
      input.geographicArea,
      FIELD_LIMITS.geographicArea,
    ),
    cerebusTeamLeader: sanitizeStr(
      input.cerebusTeamLeader,
      FIELD_LIMITS.cerebusTeamLeader,
    ),
    firstName: sanitizeStr(input.firstName, FIELD_LIMITS.firstName),
    middleNames: sanitizeStr(input.middleNames, FIELD_LIMITS.middleNames),
    surname: sanitizeStr(input.surname, FIELD_LIMITS.surname),
    nationality: sanitizeStr(input.nationality, FIELD_LIMITS.nationality),
    idDocumentType: input.idDocumentType,
    idPassportNumber: sanitizeStr(
      input.idPassportNumber,
      FIELD_LIMITS.idPassportNumber,
    ),
    cellphoneNumber: sanitizeStr(input.cellphoneNumber, FIELD_LIMITS.phone),
    whatsappNumber: sanitizeStr(input.whatsappNumber, FIELD_LIMITS.phone),
    email: sanitizeStr(input.email.toLowerCase(), FIELD_LIMITS.email),
    tShirtStyle: input.tShirtStyle,
    tShirtSize: input.tShirtSize,
    yourComments: sanitizeStr(input.yourComments, FIELD_LIMITS.yourComments),
    bankNameAndCode: sanitizeStr(
      input.bankNameAndCode,
      FIELD_LIMITS.bankNameAndCode,
    ),
    accountHolderName: sanitizeStr(
      input.accountHolderName,
      FIELD_LIMITS.accountHolderName,
    ),
    accountType: input.accountType,
    accountNumber: sanitizeStr(input.accountNumber, FIELD_LIMITS.accountNumber),
    latestBankCycle: input.bankFile ? cycleMonth : '',
    latestBankDocId: bankDocId,
    latestBankDocName: bankDocName,
    idDocId,
    idDocName,
    contractDocId,
    contractDocName,
    photoDocId,
    photoDocName,
    photoThumbUrl,
    status: options?.selfSignup || options?.publicSignup ? 'active' : input.status,
  };

  const confirmationId = `${agentId}_${cycleMonth}`;
  const verificationStatus: VerificationStatus = 'confirmed';

  const confirmationPayload = {
    confirmationId,
    agentId,
    ownerUid,
    agentCode: agentPayload.cerebusAgentCode,
    agentName: sanitizeStr(fullName, 200),
    emailAddress,
    cerebusTeamLeader: agentPayload.cerebusTeamLeader,
    geographicArea: agentPayload.geographicArea,
    cycleMonth,
    cutoffDate: getCutoffDateString(cycleMonth),
    isLateAfterCutoff: false,
    actionKind: 'confirmed_existing' as ActionKind,
    bankNameAndCode: agentPayload.bankNameAndCode,
    accountHolderName: agentPayload.accountHolderName,
    accountType: agentPayload.accountType,
    accountNumber: agentPayload.accountNumber,
    previousBankSummary: '',
    bankDocId,
    bankDocName,
    verificationStatus,
    submittedByUid: actorUid,
    submittedByName: effectiveActorName,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    verifiedByUid: '',
    verifiedByName: '',
    verifiedAt: '',
    reviewerNotes: '',
  };

  const logId = makeId('log');
  const changes: AuditChangeItem[] = [
    {
      field: 'Cerebus agent code',
      previousValue: '(new)',
      newValue: agentPayload.cerebusAgentCode,
    },
    {
      field: 'Bank name and code',
      previousValue: '(new)',
      newValue: agentPayload.bankNameAndCode,
    },
    {
      field: 'Account number',
      previousValue: '(new)',
      newValue: agentPayload.accountNumber,
    },
  ];
  if (idDocName) {
    changes.push({
      field: 'Upload ID/passport',
      previousValue: '(none)',
      newValue: idDocName,
    });
  }
  if (contractDocName) {
    changes.push({
      field: 'Upload contract',
      previousValue: '(none)',
      newValue: contractDocName,
    });
  }
  if (bankDocName) {
    changes.push({
      field: 'Upload bank statement',
      previousValue: '(none)',
      newValue: bankDocName,
    });
  }
  if (photoDocName) {
    changes.push({
      field: 'Agent face photo',
      previousValue: '(none)',
      newValue: photoDocName,
    });
  }
  if (provisioned) {
    changes.push({
      field: 'Agent portal login',
      previousValue: '(new)',
      newValue: provisioned.credentials.loginUsername,
    });
  }

  let currentWritePath = `agents/${agentId}`;
  try {
    // Commit 1: Core agent record + user profile (keeps Firestore rule lookups minimal)
    const coreBatch = writeBatch(targetDb);
    coreBatch.set(doc(targetDb, 'agents', agentId), agentPayload);
    if (options?.publicSignup && provisioned) {
      coreBatch.set(doc(targetDb, 'users', provisioned.user.uid), {
        uid: provisioned.user.uid,
        email: provisioned.credentials.authEmail,
        displayName: sanitizeStr(fullName, 120),
        role: 'agent',
        teamLeaderName: '',
        linkedAgentId: agentId,
        accountStatus: 'active' as UserAccountStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (
      options?.selfSignup &&
      !options?.publicSignup &&
      actor.role === 'agent'
    ) {
      coreBatch.update(doc(targetDb, 'users', actor.uid), {
        linkedAgentId: agentId,
        updatedAt: serverTimestamp(),
      });
    }
    await coreBatch.commit();

    // If staff created this agent, register the newly provisioned portal login doc on secondaryDb
    if (!options?.publicSignup && provisioned) {
      currentWritePath = `users/${provisioned.user.uid}`;
      await setDoc(doc(provisioned.secondaryDb, 'users', provisioned.user.uid), {
        uid: provisioned.user.uid,
        email: provisioned.credentials.authEmail,
        displayName: sanitizeStr(fullName, 120),
        role: 'agent',
        teamLeaderName: '',
        linkedAgentId: agentId,
        accountStatus: 'active' as UserAccountStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Commit 2: Compliance documents (chunked at 3 docs max per batch so rule lookups stay well under 20)
    for (let i = 0; i < docWrites.length; i += 3) {
      const chunk = docWrites.slice(i, i + 3);
      currentWritePath = `agent_documents/${chunk[0].id}`;
      const docsBatch = writeBatch(targetDb);
      for (const entry of chunk) {
        docsBatch.set(doc(targetDb, 'agent_documents', entry.id), entry.payload);
      }
      await docsBatch.commit();
    }

    // Commit 3: Bank uniqueness index + initial confirmation + audit log (<= 3 docs)
    currentWritePath = `monthly_confirmations/${confirmationId}`;
    const ledgerBatch = writeBatch(targetDb);
    if (dupCheck.bankKey) {
      ledgerBatch.set(doc(targetDb, 'bank_registry', dupCheck.bankKey), {
        bankKey: dupCheck.bankKey,
        agentId,
        ownerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    ledgerBatch.set(
      doc(targetDb, 'monthly_confirmations', confirmationId),
      confirmationPayload,
    );
    ledgerBatch.set(doc(targetDb, 'audit_logs', logId), {
      logId,
      timestamp: serverTimestamp(),
      actorUid,
      actorName: effectiveActorName,
      actorEmail: effectiveActorEmail,
      actorRole: options?.publicSignup ? 'agent' : actor.role,
      agentId,
      ownerUid,
      emailAddress,
      agentCode: agentPayload.cerebusAgentCode,
      agentName: sanitizeStr(fullName, 200),
      cerebusTeamLeader: agentPayload.cerebusTeamLeader,
      actionType: 'agent_created' as AuditActionType,
      cycleMonth,
      isLateAfterCutoff: false,
      summary: sanitizeStr(
        options?.publicSignup
          ? `${fullName} submitted onboarding registration for ${agentPayload.cerebusAgentCode} via public signup link.`
          : `${actor.displayName} onboarded agent ${agentPayload.cerebusAgentCode} (${fullName}).`,
        FIELD_LIMITS.summary,
      ),
      changes: changes.slice(0, 30),
    });
    await ledgerBatch.commit();

    return {
      agentId,
      credentials: provisioned?.credentials ?? null,
    };
  } catch (error) {
    if (provisioned) {
      await provisioned.user.delete().catch(() => {});
    }
    throw handleFirestoreError(error, OperationType.WRITE, currentWritePath);
  } finally {
    if (provisioned) {
      await signOut(provisioned.secondaryAuth).catch(() => {});
      await terminate(provisioned.secondaryDb).catch(() => {});
      await deleteApp(provisioned.secondaryApp).catch(() => {});
    }
  }
}

export async function updateAgentPersonalInfoAndDocs(
  existingAgent: AgentRecord,
  updates: Partial<AgentFormInput>,
  actor: UserAccount,
): Promise<void> {
  const batch = writeBatch(db);
  const agentRef = doc(db, 'agents', existingAgent.agentId);

  const nextPersonal: Record<string, unknown> = {
    geographicArea: sanitizeStr(
      updates.geographicArea ?? existingAgent.geographicArea,
      FIELD_LIMITS.geographicArea,
    ),
    firstName: sanitizeStr(
      updates.firstName ?? existingAgent.firstName,
      FIELD_LIMITS.firstName,
    ),
    middleNames: sanitizeStr(
      updates.middleNames ?? existingAgent.middleNames,
      FIELD_LIMITS.middleNames,
    ),
    surname: sanitizeStr(
      updates.surname ?? existingAgent.surname,
      FIELD_LIMITS.surname,
    ),
    nationality: sanitizeStr(
      updates.nationality ?? existingAgent.nationality,
      FIELD_LIMITS.nationality,
    ),
    idDocumentType: updates.idDocumentType ?? existingAgent.idDocumentType,
    idPassportNumber: sanitizeStr(
      updates.idPassportNumber ?? existingAgent.idPassportNumber,
      FIELD_LIMITS.idPassportNumber,
    ),
    cellphoneNumber: sanitizeStr(
      updates.cellphoneNumber ?? existingAgent.cellphoneNumber,
      FIELD_LIMITS.phone,
    ),
    whatsappNumber: sanitizeStr(
      updates.whatsappNumber ?? existingAgent.whatsappNumber,
      FIELD_LIMITS.phone,
    ),
    email: sanitizeStr(
      (updates.email ?? existingAgent.email).toLowerCase(),
      FIELD_LIMITS.email,
    ),
    tShirtStyle: updates.tShirtStyle ?? existingAgent.tShirtStyle,
    tShirtSize: updates.tShirtSize ?? existingAgent.tShirtSize,
    yourComments: sanitizeStr(
      updates.yourComments ?? existingAgent.yourComments,
      FIELD_LIMITS.yourComments,
    ),
  };

  if (actor.role === 'admin') {
    nextPersonal.emailAddress = sanitizeStr(
      (updates.emailAddress ?? existingAgent.emailAddress).toLowerCase(),
      FIELD_LIMITS.email,
    );
    nextPersonal.cerebusAgentCode = sanitizeStr(
      (updates.cerebusAgentCode ?? existingAgent.cerebusAgentCode).toUpperCase(),
      FIELD_LIMITS.cerebusAgentCode,
    );
    nextPersonal.cerebusTeamLeader = sanitizeStr(
      updates.cerebusTeamLeader ?? existingAgent.cerebusTeamLeader,
      FIELD_LIMITS.cerebusTeamLeader,
    );
    nextPersonal.status = updates.status ?? existingAgent.status;
  } else if (actor.role === 'team_leader') {
    nextPersonal.status = updates.status ?? existingAgent.status;
  }

  const changes = buildFieldDiffs(
    existingAgent as unknown as Record<string, unknown>,
    nextPersonal,
    PERSONAL_FIELD_LABELS,
  );

  if (updates.idFile) {
    const idDocId = makeId('doc_id');
    const idDocName = sanitizeStr(updates.idFile.fileName, 200);
    batch.set(doc(db, 'agent_documents', idDocId), {
      docId: idDocId,
      agentId: existingAgent.agentId,
      ownerUid: existingAgent.ownerUid,
      emailAddress: existingAgent.emailAddress,
      cerebusTeamLeader: existingAgent.cerebusTeamLeader,
      docCategory: 'id_passport' as DocCategory,
      cycleMonth: '',
      fileName: idDocName,
      mimeType: sanitizeStr(updates.idFile.mimeType, 100),
      fileSize: updates.idFile.fileSize,
      dataUrl: updates.idFile.dataUrl,
      uploadedByUid: actor.uid,
      uploadedByName: sanitizeStr(actor.displayName, 120),
      uploadedAt: serverTimestamp(),
    });
    nextPersonal.idDocId = idDocId;
    nextPersonal.idDocName = idDocName;
    changes.push({
      field: 'Upload ID/passport',
      previousValue: existingAgent.idDocName || '(none)',
      newValue: idDocName,
    });
  }

  if (updates.contractFile) {
    const contractDocId = makeId('doc_ct');
    const contractDocName = sanitizeStr(updates.contractFile.fileName, 200);
    batch.set(doc(db, 'agent_documents', contractDocId), {
      docId: contractDocId,
      agentId: existingAgent.agentId,
      ownerUid: existingAgent.ownerUid,
      emailAddress: existingAgent.emailAddress,
      cerebusTeamLeader: existingAgent.cerebusTeamLeader,
      docCategory: 'contract' as DocCategory,
      cycleMonth: '',
      fileName: contractDocName,
      mimeType: sanitizeStr(updates.contractFile.mimeType, 100),
      fileSize: updates.contractFile.fileSize,
      dataUrl: updates.contractFile.dataUrl,
      uploadedByUid: actor.uid,
      uploadedByName: sanitizeStr(actor.displayName, 120),
      uploadedAt: serverTimestamp(),
    });
    nextPersonal.contractDocId = contractDocId;
    nextPersonal.contractDocName = contractDocName;
    changes.push({
      field: 'Upload contract',
      previousValue: existingAgent.contractDocName || '(none)',
      newValue: contractDocName,
    });
  }

  if (updates.photoFile) {
    const photoDocId = makeId('doc_ph');
    const photoDocName = sanitizeStr(updates.photoFile.fileName, 200);
    const photoThumbUrl = sanitizeStr(updates.photoFile.thumbDataUrl, 80000);
    batch.set(doc(db, 'agent_documents', photoDocId), {
      docId: photoDocId,
      agentId: existingAgent.agentId,
      ownerUid: existingAgent.ownerUid,
      emailAddress: existingAgent.emailAddress,
      cerebusTeamLeader: existingAgent.cerebusTeamLeader,
      docCategory: 'profile_photo' as DocCategory,
      cycleMonth: '',
      fileName: photoDocName,
      mimeType: sanitizeStr(updates.photoFile.mimeType, 100),
      fileSize: updates.photoFile.fileSize,
      dataUrl: updates.photoFile.dataUrl,
      uploadedByUid: actor.uid,
      uploadedByName: sanitizeStr(actor.displayName, 120),
      uploadedAt: serverTimestamp(),
    });
    nextPersonal.photoDocId = photoDocId;
    nextPersonal.photoDocName = photoDocName;
    nextPersonal.photoThumbUrl = photoThumbUrl;
    changes.push({
      field: 'Agent face photo',
      previousValue: existingAgent.photoDocName || '(none)',
      newValue: photoDocName,
    });
  }

  if (changes.length === 0) return;

  if (actor.role === 'agent' && existingAgent.ownerUid !== actor.uid) {
    nextPersonal.ownerUid = actor.uid;
  }

  batch.update(agentRef, {
    ...nextPersonal,
    updatedAt: serverTimestamp(),
  });

  const fullName = getAgentFullName({
    firstName: String(nextPersonal.firstName),
    middleNames: String(nextPersonal.middleNames),
    surname: String(nextPersonal.surname),
  });

  const hasOnlyDocs =
    changes.every(
      (c) =>
        c.field === 'Upload ID/passport' ||
        c.field === 'Upload contract' ||
        c.field === 'Agent face photo',
    ) && changes.length > 0;

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.displayName, 120),
    actorEmail: sanitizeStr(actor.email, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: existingAgent.agentId,
    ownerUid:
      actor.role === 'agent' ? actor.uid : existingAgent.ownerUid,
    emailAddress: existingAgent.emailAddress,
    agentCode: existingAgent.cerebusAgentCode,
    agentName: sanitizeStr(fullName, 200),
    cerebusTeamLeader: existingAgent.cerebusTeamLeader,
    actionType: (hasOnlyDocs
      ? 'document_uploaded'
      : 'personal_info_updated') as AuditActionType,
    cycleMonth: '',
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      `${actor.displayName} updated ${changes.length} personal/document field(s) for ${existingAgent.cerebusAgentCode}.`,
      FIELD_LIMITS.summary,
    ),
    changes: changes.slice(0, 30),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `agents/${existingAgent.agentId}`,
    );
  }
}

export interface MonthlyBankingSubmission {
  agent: AgentRecord;
  cycleMonth: string;
  actionKind: ActionKind;
  bankNameAndCode: string;
  accountHolderName: string;
  accountType: AccountType;
  accountNumber: string;
  bankFile?: ProcessedUploadFile | null;
  existingConfirmation?: MonthlyConfirmation | null;
}

export interface WritePermissionCheckResult {
  allowed: boolean;
  path: string;
  reason?: string;
  liveConfirmation?: MonthlyConfirmation | null;
}

const VALID_DOC_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export async function validateConfirmationWritePermission(
  agent: AgentRecord,
  cycleMonth: string,
  existingConfirmation: MonthlyConfirmation | null | undefined,
  actor: UserAccount,
): Promise<WritePermissionCheckResult> {
  const confirmationId = `${agent.agentId}_${cycleMonth}`;
  const path = `monthly_confirmations/${confirmationId}`;
  const currentUser = auth.currentUser;

  if (!currentUser || currentUser.uid !== actor.uid) {
    return {
      allowed: false,
      path,
      reason: 'Your session has expired. Please sign in again before confirming.',
    };
  }

  if (
    !VALID_DOC_ID_REGEX.test(agent.agentId) ||
    !/^\d{6}$/.test(cycleMonth) ||
    !VALID_DOC_ID_REGEX.test(confirmationId) ||
    confirmationId.length > 140
  ) {
    return {
      allowed: false,
      path,
      reason: 'Invalid agent or cycle path identifier.',
    };
  }

  let liveAgent: AgentRecord;
  try {
    const agentSnap = await getDoc(doc(db, 'agents', agent.agentId));
    if (!agentSnap.exists()) {
      return {
        allowed: false,
        path: `agents/${agent.agentId}`,
        reason: 'This agent dossier no longer exists in the ledger.',
      };
    }
    liveAgent = agentSnap.data() as AgentRecord;
  } catch {
    return {
      allowed: false,
      path: `agents/${agent.agentId}`,
      reason: 'You are not authorized to access or update this agent record.',
    };
  }

  if (actor.role === 'team_leader') {
    if (liveAgent.cerebusTeamLeader !== (actor.teamLeaderName || '')) {
      return {
        allowed: false,
        path,
        reason: `You are only authorized to confirm banking details for agents assigned to ${actor.teamLeaderName || 'your team'}.`,
      };
    }
  } else if (actor.role === 'agent') {
    const verifiedEmailMatch =
      Boolean(currentUser.emailVerified) &&
      Boolean(currentUser.email) &&
      liveAgent.emailAddress.toLowerCase() === currentUser.email!.toLowerCase();
    const ownsAgent = liveAgent.ownerUid === actor.uid || verifiedEmailMatch;
    if (!ownsAgent) {
      return {
        allowed: false,
        path,
        reason:
          'Your signed-in account is not linked as the owner of this agent dossier.',
      };
    }
  }

  let liveConfirmation: MonthlyConfirmation | null = existingConfirmation ?? null;
  try {
    const confSnap = await getDoc(doc(db, 'monthly_confirmations', confirmationId));
    liveConfirmation = confSnap.exists()
      ? (confSnap.data() as MonthlyConfirmation)
      : null;
  } catch {
    return {
      allowed: false,
      path,
      reason: `You do not have write permission for ${path}.`,
    };
  }

  if (
    liveConfirmation?.verificationStatus === 'verified' &&
    actor.role === 'agent'
  ) {
    return {
      allowed: false,
      path,
      liveConfirmation,
      reason: 'Banking details are already verified and cannot be modified by an agent.',
    };
  }

  return {
    allowed: true,
    path,
    liveConfirmation,
  };
}

export async function submitMonthlyBankConfirmation(
  payload: MonthlyBankingSubmission,
  actor: UserAccount,
): Promise<void> {
  const { agent, cycleMonth, actionKind, existingConfirmation } = payload;
  const confirmationId = `${agent.agentId}_${cycleMonth}`;
  const confirmationRef = doc(db, 'monthly_confirmations', confirmationId);

  const permCheck = await validateConfirmationWritePermission(
    agent,
    cycleMonth,
    existingConfirmation,
    actor,
  );
  if (!permCheck.allowed) {
    throw new Error(
      permCheck.reason ||
        `You are not authorized to write to ${permCheck.path}.`,
    );
  }

  const resolvedExisting = permCheck.liveConfirmation ?? null;

  const nextBank = {
    bankNameAndCode: sanitizeStr(
      payload.bankNameAndCode,
      FIELD_LIMITS.bankNameAndCode,
    ),
    accountHolderName: sanitizeStr(
      payload.accountHolderName,
      FIELD_LIMITS.accountHolderName,
    ),
    accountType: payload.accountType,
    accountNumber: sanitizeStr(
      payload.accountNumber,
      FIELD_LIMITS.accountNumber,
    ),
  };

  const bankDiffs = buildFieldDiffs(
    agent as unknown as Record<string, unknown>,
    nextBank,
    BANKING_FIELD_LABELS,
  );

  const actualActionKind: ActionKind =
    bankDiffs.length > 0 ? 'updated_banking' : actionKind;

  const dupCheck = await checkDuplicateBankDetails(
    nextBank.bankNameAndCode,
    nextBank.accountNumber,
    {
      excludeAgentId: agent.agentId,
      actorRole: actor.role,
      teamLeaderName: actor.teamLeaderName,
      includeCollectionScan:
        actor.role === 'admin' || actor.role === 'team_leader',
    },
  );
  if (dupCheck.isDuplicate) {
    throw new Error(
      dupCheck.reason ||
        'Duplicate bank details detected: this account number is already registered in the added banks.',
    );
  }

  const batch = writeBatch(db);
  const agentFullName = sanitizeStr(
    getAgentFullName(agent) || agent.emailAddress || agent.cerebusAgentCode,
    200,
  );
  const actorDisplayName = sanitizeStr(
    actor.displayName || actor.email || agentFullName,
    120,
  );
  const resolvedOwnerUid =
    actor.role === 'agent' ? actor.uid : agent.ownerUid;

  let bankDocId = resolvedExisting?.bankDocId || '';
  let bankDocName = resolvedExisting?.bankDocName || '';

  if (payload.bankFile) {
    bankDocId = makeId('doc_bk');
    bankDocName = sanitizeStr(payload.bankFile.fileName, 200);
    batch.set(doc(db, 'agent_documents', bankDocId), {
      docId: bankDocId,
      agentId: agent.agentId,
      ownerUid: resolvedOwnerUid,
      emailAddress: agent.emailAddress,
      cerebusTeamLeader: agent.cerebusTeamLeader,
      docCategory: 'bank_statement' as DocCategory,
      cycleMonth,
      fileName: bankDocName,
      mimeType: sanitizeStr(payload.bankFile.mimeType, 100),
      fileSize: payload.bankFile.fileSize,
      dataUrl: payload.bankFile.dataUrl,
      uploadedByUid: actor.uid,
      uploadedByName: actorDisplayName,
      uploadedAt: serverTimestamp(),
    });
    bankDiffs.push({
      field: 'Upload bank proof',
      previousValue: resolvedExisting?.bankDocName || '(none)',
      newValue: bankDocName,
    });
  }

  const verificationStatus: VerificationStatus = 'confirmed';

  const previousBankSummary =
    bankDiffs.some((d) => !d.field.startsWith('Upload bank'))
      ? sanitizeStr(
          `${agent.bankNameAndCode} · ${agent.accountType} · ${agent.accountNumber}`,
          240,
        )
      : resolvedExisting?.previousBankSummary || '';

  if (resolvedExisting) {
    batch.update(confirmationRef, {
      ownerUid: resolvedOwnerUid,
      actionKind: actualActionKind,
      isLateAfterCutoff: false,
      ...nextBank,
      previousBankSummary,
      bankDocId,
      bankDocName,
      verificationStatus,
      submittedByUid: actor.uid,
      submittedByName: actorDisplayName,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(confirmationRef, {
      confirmationId,
      agentId: agent.agentId,
      ownerUid: resolvedOwnerUid,
      agentCode: agent.cerebusAgentCode,
      agentName: agentFullName,
      emailAddress: agent.emailAddress,
      cerebusTeamLeader: agent.cerebusTeamLeader,
      geographicArea: agent.geographicArea,
      cycleMonth,
      cutoffDate: getCutoffDateString(cycleMonth),
      isLateAfterCutoff: false,
      actionKind: actualActionKind,
      ...nextBank,
      previousBankSummary,
      bankDocId,
      bankDocName,
      verificationStatus,
      submittedByUid: actor.uid,
      submittedByName: actorDisplayName,
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      verifiedByUid: '',
      verifiedByName: '',
      verifiedAt: '',
      reviewerNotes: '',
    });
  }

  // Only update master agent record when banking fields, latest bank proof, or ownerUid changed
  const needsOwnerSync = actor.role === 'agent' && agent.ownerUid !== actor.uid;
  const hasBankingValueChanges =
    nextBank.bankNameAndCode !== agent.bankNameAndCode ||
    nextBank.accountHolderName !== agent.accountHolderName ||
    nextBank.accountType !== agent.accountType ||
    nextBank.accountNumber !== agent.accountNumber;

  if (hasBankingValueChanges || payload.bankFile || needsOwnerSync) {
    const agentUpdate: Record<string, unknown> = {
      ...nextBank,
      updatedAt: serverTimestamp(),
    };
    if (needsOwnerSync) {
      agentUpdate.ownerUid = actor.uid;
    }
    if (payload.bankFile) {
      agentUpdate.latestBankCycle = cycleMonth;
      agentUpdate.latestBankDocId = bankDocId;
      agentUpdate.latestBankDocName = bankDocName;
    }
    batch.update(doc(db, 'agents', agent.agentId), agentUpdate);
  }

  if (dupCheck.bankKey) {
    const oldBankKey =
      normalizeAccountNumber(agent.accountNumber).length >= 4
        ? await computeBankRegistryKey(agent.accountNumber)
        : '';

    const newRegSnap = await getDoc(doc(db, 'bank_registry', dupCheck.bankKey));
    if (!newRegSnap.exists()) {
      batch.set(doc(db, 'bank_registry', dupCheck.bankKey), {
        bankKey: dupCheck.bankKey,
        agentId: agent.agentId,
        ownerUid: resolvedOwnerUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (oldBankKey && oldBankKey !== dupCheck.bankKey) {
      const oldRegSnap = await getDoc(doc(db, 'bank_registry', oldBankKey));
      if (
        oldRegSnap.exists() &&
        (oldRegSnap.data() as { agentId?: string }).agentId === agent.agentId
      ) {
        batch.delete(doc(db, 'bank_registry', oldBankKey));
      }
    }
  }

  const auditChanges: AuditChangeItem[] =
    bankDiffs.length > 0
      ? bankDiffs
      : [
          {
            field: 'Banking Attestation',
            previousValue: resolvedExisting?.verificationStatus || 'pending',
            newValue: `Confirmed existing (${nextBank.bankNameAndCode} · ${nextBank.accountNumber})`,
          },
        ];

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: actorDisplayName,
    actorEmail: sanitizeStr(actor.email || agent.emailAddress, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: agent.agentId,
    ownerUid: resolvedOwnerUid,
    emailAddress: agent.emailAddress,
    agentCode: agent.cerebusAgentCode,
    agentName: agentFullName,
    cerebusTeamLeader: agent.cerebusTeamLeader,
    actionType: (actualActionKind === 'updated_banking'
      ? 'banking_updated'
      : 'monthly_confirmed') as AuditActionType,
    cycleMonth,
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      actualActionKind === 'updated_banking'
        ? `${actorDisplayName} updated banking details for ${agent.cerebusAgentCode}.`
        : `${actorDisplayName} confirmed existing banking details for ${agent.cerebusAgentCode}.`,
      FIELD_LIMITS.summary,
    ),
    changes: auditChanges.slice(0, 30),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `monthly_confirmations/${confirmationId}`,
    );
  }
}

export async function verifyOrRejectMonthlyPayment(
  confirmation: MonthlyConfirmation,
  decision: 'verified' | 'rejected',
  reviewerNotes: string,
  actor: UserAccount,
): Promise<void> {
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString().slice(0, 19) + 'Z';
  const notes = sanitizeStr(reviewerNotes, FIELD_LIMITS.reviewerNotes);

  batch.update(doc(db, 'monthly_confirmations', confirmation.confirmationId), {
    verificationStatus: decision,
    verifiedByUid: actor.uid,
    verifiedByName: sanitizeStr(actor.displayName, 120),
    verifiedAt: nowIso,
    reviewerNotes: notes,
    updatedAt: serverTimestamp(),
  });

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.displayName, 120),
    actorEmail: sanitizeStr(actor.email, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: confirmation.agentId,
    ownerUid: confirmation.ownerUid,
    emailAddress: confirmation.emailAddress,
    agentCode: confirmation.agentCode,
    agentName: confirmation.agentName,
    cerebusTeamLeader: confirmation.cerebusTeamLeader,
    actionType: (decision === 'verified'
      ? 'payment_verified'
      : 'payment_rejected') as AuditActionType,
    cycleMonth: confirmation.cycleMonth,
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      decision === 'verified'
        ? `${actor.displayName} verified banking details for ${confirmation.agentCode}.`
        : `${actor.displayName} flagged ${confirmation.agentCode} for banking correction: ${notes || 'Details require update'}.`,
      FIELD_LIMITS.summary,
    ),
    changes: [
      {
        field: 'Verification status',
        previousValue: confirmation.verificationStatus,
        newValue: decision,
      },
      ...(notes
        ? [
            {
              field: 'Reviewer notes',
              previousValue: confirmation.reviewerNotes || '(none)',
              newValue: notes,
            },
          ]
        : []),
    ],
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `monthly_confirmations/${confirmation.confirmationId}`,
    );
  }
}

export async function batchVerifyMonthlyPayments(
  confirmations: MonthlyConfirmation[],
  actor: UserAccount,
  notesByConf: Record<string, string> = {},
): Promise<number> {
  const uniquePending = Array.from(
    new Map(
      confirmations
        .filter((c) => c.verificationStatus !== 'verified')
        .map((c) => [c.confirmationId, c]),
    ).values(),
  );

  if (uniquePending.length === 0) {
    return 0;
  }

  const nowIso = new Date().toISOString().slice(0, 19) + 'Z';
  const actorName = sanitizeStr(actor.displayName, 120);
  const actorEmail = sanitizeStr(actor.email, FIELD_LIMITS.email);

  // 2 Firestore writes per confirmation (update confirmation + create audit log); chunk at 4 (8 ops <= 20 rule lookup limit)
  const CHUNK_SIZE = 4;
  for (let i = 0; i < uniquePending.length; i += CHUNK_SIZE) {
    const chunk = uniquePending.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const confirmation of chunk) {
      const rawNote =
        notesByConf[confirmation.confirmationId] ??
        confirmation.reviewerNotes ??
        '';
      const notes = sanitizeStr(rawNote.trim(), FIELD_LIMITS.reviewerNotes);

      batch.update(
        doc(db, 'monthly_confirmations', confirmation.confirmationId),
        {
          verificationStatus: 'verified',
          verifiedByUid: actor.uid,
          verifiedByName: actorName,
          verifiedAt: nowIso,
          reviewerNotes: notes,
          updatedAt: serverTimestamp(),
        },
      );

      const logId = makeId('log');
      batch.set(doc(db, 'audit_logs', logId), {
        logId,
        timestamp: serverTimestamp(),
        actorUid: actor.uid,
        actorName,
        actorEmail,
        actorRole: actor.role,
        agentId: confirmation.agentId,
        ownerUid: confirmation.ownerUid,
        emailAddress: confirmation.emailAddress,
        agentCode: confirmation.agentCode,
        agentName: confirmation.agentName,
        cerebusTeamLeader: confirmation.cerebusTeamLeader,
        actionType: 'payment_verified' as AuditActionType,
        cycleMonth: confirmation.cycleMonth,
        isLateAfterCutoff: false,
        summary: sanitizeStr(
          `${actor.displayName} batch-verified banking details for ${confirmation.agentCode}.`,
          FIELD_LIMITS.summary,
        ),
        changes: [
          {
            field: 'Verification status',
            previousValue: confirmation.verificationStatus,
            newValue: 'verified',
          },
          ...(notes
            ? [
                {
                  field: 'Reviewer notes',
                  previousValue: confirmation.reviewerNotes || '(none)',
                  newValue: notes,
                },
              ]
            : []),
        ],
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `monthly_confirmations/${chunk[0]?.confirmationId || 'batch'}`,
      );
    }
  }

  return uniquePending.length;
}

export async function updateUserRole(
  targetUser: UserAccount,
  role: UserRole,
  teamLeaderName: string,
  actor: UserAccount,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUser.uid), {
    role,
    teamLeaderName: sanitizeStr(teamLeaderName, 120),
    updatedAt: serverTimestamp(),
  });

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.displayName, 120),
    actorEmail: sanitizeStr(actor.email, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: targetUser.linkedAgentId || 'system_access',
    ownerUid: targetUser.uid,
    emailAddress: targetUser.email,
    agentCode: 'ACCESS',
    agentName: targetUser.displayName,
    cerebusTeamLeader: sanitizeStr(teamLeaderName || 'Operations', 120),
    actionType: 'role_updated' as AuditActionType,
    cycleMonth: '',
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      `${actor.displayName} set ${targetUser.email} role to ${role}${teamLeaderName ? ` (${teamLeaderName})` : ''}.`,
      FIELD_LIMITS.summary,
    ),
    changes: [
      {
        field: 'Access role',
        previousValue: targetUser.role,
        newValue: role,
      },
      ...(teamLeaderName !== (targetUser.teamLeaderName || '')
        ? [
            {
              field: 'Assigned team leader',
              previousValue: targetUser.teamLeaderName || '(none)',
              newValue: teamLeaderName || '(none)',
            },
          ]
        : []),
    ],
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `users/${targetUser.uid}`,
    );
  }
}

function assertMutableTargetUser(targetUser: UserAccount, actor: UserAccount) {
  if (actor.role !== 'admin') {
    throw new Error('Only Administrators can manage user accounts.');
  }
  if (targetUser.uid === actor.uid) {
    throw new Error('You cannot disable, archive, or delete your own active admin account.');
  }
  if (
    targetUser.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  ) {
    throw new Error('The primary bootstrapped administrator account is protected.');
  }
}

export async function updateUserAccountStatus(
  targetUser: UserAccount,
  nextStatus: UserAccountStatus,
  actor: UserAccount,
): Promise<void> {
  assertMutableTargetUser(targetUser, actor);
  const previousStatus: UserAccountStatus = targetUser.accountStatus || 'active';
  if (previousStatus === nextStatus) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', targetUser.uid), {
    accountStatus: nextStatus,
    updatedAt: serverTimestamp(),
  });

  const actionLabel =
    nextStatus === 'disabled'
      ? 'disabled'
      : nextStatus === 'archived'
        ? 'archived'
        : 'restored to active';

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.displayName, 120),
    actorEmail: sanitizeStr(actor.email, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: targetUser.linkedAgentId || 'system_access',
    ownerUid: targetUser.uid,
    emailAddress: targetUser.email,
    agentCode: 'ACCESS',
    agentName: targetUser.displayName,
    cerebusTeamLeader: sanitizeStr(
      targetUser.teamLeaderName || 'Operations',
      120,
    ),
    actionType: 'user_status_updated' as AuditActionType,
    cycleMonth: '',
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      `${actor.displayName} ${actionLabel} user account ${targetUser.email}.`,
      FIELD_LIMITS.summary,
    ),
    changes: [
      {
        field: 'Account status',
        previousValue: previousStatus,
        newValue: nextStatus,
      },
    ],
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.UPDATE,
      `users/${targetUser.uid}`,
    );
  }
}

export async function deleteUserAccount(
  targetUser: UserAccount,
  actor: UserAccount,
): Promise<void> {
  assertMutableTargetUser(targetUser, actor);

  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', targetUser.uid));

  const logId = makeId('log');
  batch.set(doc(db, 'audit_logs', logId), {
    logId,
    timestamp: serverTimestamp(),
    actorUid: actor.uid,
    actorName: sanitizeStr(actor.displayName, 120),
    actorEmail: sanitizeStr(actor.email, FIELD_LIMITS.email),
    actorRole: actor.role,
    agentId: targetUser.linkedAgentId || 'system_access',
    ownerUid: targetUser.uid,
    emailAddress: targetUser.email,
    agentCode: 'ACCESS',
    agentName: targetUser.displayName,
    cerebusTeamLeader: sanitizeStr(
      targetUser.teamLeaderName || 'Operations',
      120,
    ),
    actionType: 'user_status_updated' as AuditActionType,
    cycleMonth: '',
    isLateAfterCutoff: false,
    summary: sanitizeStr(
      `${actor.displayName} deleted user account ${targetUser.email} (${targetUser.role}).`,
      FIELD_LIMITS.summary,
    ),
    changes: [
      {
        field: 'User account',
        previousValue: `${targetUser.email} (${targetUser.accountStatus || 'active'})`,
        newValue: 'deleted',
      },
    ],
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.DELETE,
      `users/${targetUser.uid}`,
    );
  }
}

export async function fetchDocumentById(
  docId: string,
): Promise<AgentDocument | null> {
  try {
    const snap = await getDoc(doc(db, 'agent_documents', docId));
    if (!snap.exists()) return null;
    return snap.data() as AgentDocument;
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.GET,
      `agent_documents/${docId}`,
    );
  }
}

const LEGACY_PRESET_AGENT_IDS = [
  'agt_crb_0104',
  'agt_crb_0118',
  'agt_crb_0129',
  'agt_crb_0142',
  'agt_crb_0155',
  'agt_crb_0167',
];

export async function purgeLegacySeededData(): Promise<number> {
  const checks = await Promise.all([
    ...LEGACY_PRESET_AGENT_IDS.map((id) => getDoc(doc(db, 'agents', id))),
    ...LEGACY_PRESET_AGENT_IDS.map((id) =>
      getDoc(doc(db, 'audit_logs', `log_seed_${id}`)),
    ),
  ]);

  const hasLegacyRecords = checks.some((snap) => snap.exists());
  if (!hasLegacyRecords) return 0;

  const batch = writeBatch(db);
  for (const agentId of LEGACY_PRESET_AGENT_IDS) {
    batch.delete(doc(db, 'agents', agentId));
    batch.delete(doc(db, 'monthly_confirmations', `${agentId}_202609`));
    batch.delete(doc(db, 'monthly_confirmations', `${agentId}_202611`));
    batch.delete(doc(db, 'monthly_confirmations', `${agentId}_202612`));
    batch.delete(doc(db, 'agent_documents', `doc_id_${agentId}`));
    batch.delete(doc(db, 'agent_documents', `doc_ct_${agentId}`));
    batch.delete(doc(db, 'agent_documents', `doc_bk_202609_${agentId}`));
    batch.delete(doc(db, 'agent_documents', `doc_bk_202611_${agentId}`));
    batch.delete(doc(db, 'audit_logs', `log_seed_${agentId}`));
  }

  try {
    await batch.commit();
    return LEGACY_PRESET_AGENT_IDS.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'agents/legacy_preset');
  }
}

export interface ResetLedgerResult {
  deletedAgents: number;
  deletedConfirmations: number;
  deletedDocuments: number;
  deletedLogs: number;
  deletedAgentUsers: number;
}

export async function resetAllLedgerData(
  actor: UserAccount,
): Promise<ResetLedgerResult> {
  if (actor.role !== 'admin') {
    throw new Error('Only Administrators can clear the ledger database.');
  }

  try {
    const [
      agentsSnap,
      confsSnap,
      docsSnap,
      logsSnap,
      agentUsersSnap,
      bankRegistrySnap,
    ] = await Promise.all([
      getDocs(collection(db, 'agents')),
      getDocs(collection(db, 'monthly_confirmations')),
      getDocs(collection(db, 'agent_documents')),
      getDocs(collection(db, 'audit_logs')),
      getDocs(query(collection(db, 'users'), where('role', '==', 'agent'))),
      getDocs(collection(db, 'bank_registry')),
    ]);

    const refs = [
      ...agentsSnap.docs.map((d) => d.ref),
      ...confsSnap.docs.map((d) => d.ref),
      ...docsSnap.docs.map((d) => d.ref),
      ...logsSnap.docs.map((d) => d.ref),
      ...agentUsersSnap.docs.map((d) => d.ref),
      ...bankRegistrySnap.docs.map((d) => d.ref),
    ];

    const BATCH_LIMIT = 450;
    for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
      const chunk = refs.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    return {
      deletedAgents: agentsSnap.size,
      deletedConfirmations: confsSnap.size,
      deletedDocuments: docsSnap.size,
      deletedLogs: logsSnap.size,
      deletedAgentUsers: agentUsersSnap.size,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'agents/reset_demo');
  }
}

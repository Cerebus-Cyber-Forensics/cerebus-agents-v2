import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  FileUp,
  KeyRound,
  Loader2,
  User,
  X,
} from 'lucide-react';
import {
  checkDuplicateBankDetails,
  createAgentWithDocsAndLog,
  DuplicateBankCheckResult,
  updateAgentPersonalInfoAndDocs,
} from '../services/ledgerService';
import {
  ACCOUNT_TYPES,
  AccountType,
  AgentRecord,
  AgentStatus,
  FIELD_LIMITS,
  GeneratedAgentCredentials,
  ID_DOCUMENT_TYPES,
  IdDocumentType,
  ProcessedProfilePhoto,
  ProcessedUploadFile,
  TSHIRT_SIZES,
  TSHIRT_STYLES,
  TShirtSize,
  TShirtStyle,
  UserAccount,
} from '../types';
import { getAgentFullName, getCutoffStatus } from '../utils/cycleUtils';
import { processProfilePhotoFile, processUploadFile } from '../utils/fileUtils';
import { ContractTermsModal } from './ContractTermsModal';
import {
  ExpandedPhotoTarget,
  PhotoLightboxModal,
} from './PhotoLightboxModal';

interface AgentFormModalProps {
  mode: 'create' | 'edit';
  initialAgent?: AgentRecord | null;
  activeCycle: string;
  actor?: UserAccount | null;
  selfSignup?: boolean;
  publicSignup?: boolean;
  initialTeamLeader?: string;
  initialGeographicArea?: string;
  onClose?: () => void;
  onSuccess: (message: string) => void;
  onSubmitted?: (details: {
    agentId: string;
    agentCode: string;
    fullName: string;
    cycleMonth: string;
    isLateAfterCutoff: boolean;
    credentials?: GeneratedAgentCredentials | null;
  }) => void;
}

export function AgentFormModal({
  mode,
  initialAgent,
  activeCycle,
  actor,
  selfSignup = false,
  publicSignup = false,
  initialTeamLeader = '',
  initialGeographicArea = '',
  onClose,
  onSuccess,
  onSubmitted,
}: AgentFormModalProps) {
  const isEdit = mode === 'edit' && Boolean(initialAgent);
  const canEditAdminFields = !isEdit || actor?.role === 'admin';
  const isInlineSignup = (selfSignup || publicSignup) && !onClose;

  const [emailAddress, setEmailAddress] = useState(
    initialAgent?.emailAddress ||
      (selfSignup && !publicSignup && actor ? actor.email : ''),
  );
  const [cerebusAgentCode, setCerebusAgentCode] = useState(
    initialAgent?.cerebusAgentCode || '',
  );
  const [geographicArea, setGeographicArea] = useState(
    initialAgent?.geographicArea || initialGeographicArea || '',
  );
  const [cerebusTeamLeader, setCerebusTeamLeader] = useState(
    initialAgent?.cerebusTeamLeader ||
      initialTeamLeader ||
      actor?.teamLeaderName ||
      '',
  );
  const [firstName, setFirstName] = useState(
    initialAgent?.firstName ||
      (selfSignup && !publicSignup && actor
        ? actor.displayName.split(' ')[0] || ''
        : ''),
  );
  const [middleNames, setMiddleNames] = useState(
    initialAgent?.middleNames || '',
  );
  const [surname, setSurname] = useState(
    initialAgent?.surname ||
      (selfSignup && !publicSignup && actor
        ? actor.displayName.split(' ').slice(1).join(' ')
        : ''),
  );
  const [nationality, setNationality] = useState(
    initialAgent?.nationality || 'South African',
  );
  const [idDocumentType, setIdDocumentType] = useState<IdDocumentType>(
    initialAgent?.idDocumentType || 'National ID',
  );
  const [idPassportNumber, setIdPassportNumber] = useState(
    initialAgent?.idPassportNumber || '',
  );
  const [cellphoneNumber, setCellphoneNumber] = useState(
    initialAgent?.cellphoneNumber || '',
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    initialAgent?.whatsappNumber || '',
  );
  const [email, setEmail] = useState(
    initialAgent?.email ||
      (selfSignup && !publicSignup && actor ? actor.email : ''),
  );
  const [tShirtStyle, setTShirtStyle] = useState<TShirtStyle>(
    initialAgent?.tShirtStyle && TSHIRT_STYLES.includes(initialAgent.tShirtStyle)
      ? initialAgent.tShirtStyle
      : 'Male',
  );
  const [tShirtSize, setTShirtSize] = useState<TShirtSize>(
    initialAgent?.tShirtSize || 'M',
  );
  const [yourComments, setYourComments] = useState(
    initialAgent?.yourComments || '',
  );
  const [bankNameAndCode, setBankNameAndCode] = useState(
    initialAgent?.bankNameAndCode || '',
  );
  const [accountHolderName, setAccountHolderName] = useState(
    initialAgent?.accountHolderName || '',
  );
  const [accountType, setAccountType] = useState<AccountType>(
    initialAgent?.accountType || 'Cheque / Current',
  );
  const [accountNumber, setAccountNumber] = useState(
    initialAgent?.accountNumber || '',
  );
  const [status, setStatus] = useState<AgentStatus>(
    initialAgent?.status || 'active',
  );

  const [bankFile, setBankFile] = useState<ProcessedUploadFile | null>(null);
  const [idFile, setIdFile] = useState<ProcessedUploadFile | null>(null);
  const [photoFile, setPhotoFile] = useState<ProcessedProfilePhoto | null>(
    null,
  );
  const [busyUpload, setBusyUpload] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [showContractPopup, setShowContractPopup] = useState(false);
  const [fileFlag, setFileFlag] = useState('');
  const [error, setError] = useState('');
  const [checkingDuplicateBank, setCheckingDuplicateBank] = useState(false);
  const [duplicateBankResult, setDuplicateBankResult] =
    useState<DuplicateBankCheckResult | null>(null);
  const [createdReceipt, setCreatedReceipt] = useState<{
    agentCode: string;
    fullName: string;
    credentials: GeneratedAgentCredentials;
  } | null>(null);
  const [copiedField, setCopiedField] = useState('');
  const [expandedPhoto, setExpandedPhoto] =
    useState<ExpandedPhotoTarget | null>(null);

  useEffect(() => {
    if (isEdit) return;
    const trimmed = accountNumber.trim();
    if (trimmed.length < 4) {
      setDuplicateBankResult(null);
      setCheckingDuplicateBank(false);
      return;
    }

    let active = true;
    setCheckingDuplicateBank(true);
    const timer = window.setTimeout(() => {
      void checkDuplicateBankDetails(bankNameAndCode, trimmed, {
        actorRole: publicSignup ? undefined : actor?.role,
        teamLeaderName: actor?.teamLeaderName,
        includeCollectionScan: !publicSignup && !selfSignup,
      })
        .then((res) => {
          if (!active) return;
          setDuplicateBankResult(res);
          setCheckingDuplicateBank(false);
        })
        .catch(() => {
          if (!active) return;
          setCheckingDuplicateBank(false);
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    isEdit,
    bankNameAndCode,
    accountNumber,
    publicSignup,
    selfSignup,
    actor?.role,
    actor?.teamLeaderName,
  ]);

  const copyCredential = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(''), 2200);
    } catch {
      // Clipboard may be unavailable
    }
  };

  const handleUpload = async (
    slot: 'bank' | 'id' | 'photo',
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const normalizedName = file.name.trim().toLowerCase();
    const otherSlots: { slot: string; label: string; name: string }[] = [
      {
        slot: 'bank',
        label: 'Bank Statement',
        name: bankFile?.fileName || '',
      },
      {
        slot: 'id',
        label: 'ID / Passport',
        name: idFile?.fileName || initialAgent?.idDocName || '',
      },
      {
        slot: 'photo',
        label: 'Agent Face Picture',
        name: photoFile?.fileName || initialAgent?.photoDocName || '',
      },
    ];

    const duplicate = otherSlots.find(
      (entry) =>
        entry.slot !== slot &&
        entry.name &&
        entry.name.trim().toLowerCase() === normalizedName,
    );

    if (duplicate) {
      const msg = `"${file.name}" has the same file name as your ${duplicate.label} upload. File names cannot be the same — please rename or upload the correct separate file.`;
      setFileFlag(msg);
      setError(msg);
      return;
    }

    setBusyUpload(slot);
    setFileFlag('');
    setError('');
    try {
      if (slot === 'photo') {
        const processedPhoto = await processProfilePhotoFile(file);
        setPhotoFile(processedPhoto);
      } else {
        const processed = await processUploadFile(file);
        if (slot === 'bank') setBankFile(processed);
        if (slot === 'id') setIdFile(processed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process file.');
    } finally {
      setBusyUpload(null);
    }
  };

  const executeSubmission = async (acceptedAt?: string) => {
    setError('');
    setSubmitting(true);
    try {
      if (isEdit && initialAgent && actor) {
        await updateAgentPersonalInfoAndDocs(
          initialAgent,
          {
            emailAddress,
            cerebusAgentCode,
            geographicArea,
            cerebusTeamLeader,
            firstName,
            middleNames,
            surname,
            nationality,
            idDocumentType,
            idPassportNumber,
            cellphoneNumber,
            whatsappNumber,
            email,
            tShirtStyle,
            tShirtSize,
            yourComments,
            status,
            idFile,
            photoFile,
          },
          actor,
        );
        onSuccess(
          `Updated personal details and documentation for ${initialAgent.cerebusAgentCode}.`,
        );
      } else {
        const computedFullName =
          getAgentFullName({ firstName, middleNames, surname }) ||
          emailAddress.trim();
        const effectiveActor: UserAccount =
          !publicSignup && actor
            ? actor
            : {
                uid: 'public_signup',
                email: emailAddress.trim().toLowerCase(),
                displayName: computedFullName,
                role: 'agent',
                teamLeaderName: '',
                linkedAgentId: '',
                createdAt: null,
                updatedAt: null,
              };

        const createdResult = await createAgentWithDocsAndLog(
          {
            emailAddress,
            cerebusAgentCode,
            geographicArea,
            cerebusTeamLeader,
            firstName,
            middleNames,
            surname,
            nationality,
            idDocumentType,
            idPassportNumber,
            cellphoneNumber,
            whatsappNumber,
            email,
            tShirtStyle,
            tShirtSize,
            yourComments,
            bankNameAndCode,
            accountHolderName,
            accountType,
            accountNumber,
            status,
            cycleMonth: activeCycle,
            bankFile,
            idFile,
            photoFile,
            contractTermsAcceptedAt: acceptedAt,
          },
          effectiveActor,
          { selfSignup, publicSignup },
        );
        const cutoff = getCutoffStatus(activeCycle);
        setShowContractPopup(false);
        const upperCode = cerebusAgentCode.trim().toUpperCase();
        onSuccess(
          selfSignup || publicSignup
            ? 'Your Cerebus agent profile has been registered and logged.'
            : `Added agent ${upperCode} and generated portal login credentials.`,
        );
        if (onSubmitted) {
          onSubmitted({
            agentId: createdResult.agentId,
            agentCode: upperCode,
            fullName: computedFullName,
            cycleMonth: activeCycle,
            isLateAfterCutoff: cutoff.isAfterCutoff,
            credentials: createdResult.credentials,
          });
          onClose?.();
          return;
        }
        if (createdResult.credentials && !publicSignup && !selfSignup) {
          setCreatedReceipt({
            agentCode: upperCode,
            fullName: computedFullName,
            credentials: createdResult.credentials,
          });
          return;
        }
      }
      onClose?.();
    } catch (err) {
      setShowContractPopup(false);
      setError(err instanceof Error ? err.message : 'Failed to save agent record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAttemptedSubmit(true);

    if (!/^[A-Za-z0-9\-_]{2,40}$/.test(cerebusAgentCode.trim())) {
      setError(
        'Cerebus agent code must be 2–40 characters using letters, numbers, hyphens, or underscores.',
      );
      return;
    }

    if (!isEdit && !photoFile) {
      const msg =
        'Agent face picture is strictly required. Please upload a clear photo of the agent.';
      setFileFlag(msg);
      setError(msg);
      return;
    }

    if (!isEdit && !bankFile) {
      const msg =
        'Bank statement upload is strictly required. Please attach a bank statement file.';
      setFileFlag(msg);
      setError(msg);
      return;
    }

    if (!idFile && (!isEdit || !initialAgent?.idDocId)) {
      const msg =
        'ID / Passport upload is strictly required. Please attach an ID or passport document.';
      setFileFlag(msg);
      setError(msg);
      return;
    }

    const uploadedNames = [
      photoFile?.fileName.trim().toLowerCase(),
      bankFile?.fileName.trim().toLowerCase(),
      idFile?.fileName.trim().toLowerCase(),
    ].filter(Boolean) as string[];
    if (new Set(uploadedNames).size !== uploadedNames.length) {
      const msg =
        'Uploaded file names cannot be the same. Please upload distinct files for face picture, bank statement, and ID/passport.';
      setFileFlag(msg);
      setError(msg);
      return;
    }

    if (!isEdit) {
      setCheckingDuplicateBank(true);
      try {
        const dup = await checkDuplicateBankDetails(
          bankNameAndCode,
          accountNumber,
          {
            actorRole: publicSignup ? undefined : actor?.role,
            teamLeaderName: actor?.teamLeaderName,
            includeCollectionScan: !publicSignup && !selfSignup,
          },
        );
        setDuplicateBankResult(dup);
        if (dup.isDuplicate) {
          setError(
            dup.reason ||
              'Duplicate bank details detected: this account number is already registered in the added banks.',
          );
          return;
        }
      } finally {
        setCheckingDuplicateBank(false);
      }

      setShowContractPopup(true);
      return;
    }

    await executeSubmission();
  };

  const photoPreviewSrc =
    photoFile?.thumbDataUrl || initialAgent?.photoThumbUrl || '';

  const formContent = (
    <form
      onSubmit={handleSubmit}
      className={`p-6 space-y-6 ${
        isInlineSignup ? '' : 'flex-1 overflow-y-auto'
      }`}
    >
      {/* Section 1: Identity & Cerebus Assignment */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            01. Cerebus Assignment & Personal Identity
          </h3>
        </div>

        {/* Agent Face Picture Upload */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border ${
            attemptedSubmit && !photoFile && !isEdit
              ? 'border-red-300 bg-red-50/50'
              : 'border-slate-200 bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-4 min-w-0">
            {photoPreviewSrc ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedPhoto({
                    title:
                      getAgentFullName({ firstName, middleNames, surname }) ||
                      'Agent Face Picture',
                    subtitle:
                      photoFile?.fileName || initialAgent?.photoDocName || '',
                    inlineUrl: photoFile?.dataUrl,
                    docId: photoFile ? undefined : initialAgent?.photoDocId,
                    fallbackThumbUrl: photoPreviewSrc,
                    fileName:
                      photoFile?.fileName || initialAgent?.photoDocName,
                  })
                }
                title="Click to expand whole profile picture"
                className="w-16 h-16 rounded-full overflow-hidden border border-slate-300 bg-white shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0812B8] transition-all"
              >
                <img
                  src={photoPreviewSrc}
                  alt="Agent face preview"
                  className="w-full h-full object-cover"
                />
              </button>
            ) : (
              <div className="w-16 h-16 rounded-full border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-slate-900">
                Agent Face Picture{' '}
                {!isEdit && <span className="text-red-600">*</span>}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {busyUpload === 'photo'
                  ? 'Processing photo...'
                  : photoFile
                    ? photoFile.fileName
                    : initialAgent?.photoDocName
                      ? `Current: ${initialAgent.photoDocName}`
                      : 'Upload a clear headshot photo (PNG, JPG, WebP)'}
              </p>
            </div>
          </div>

          <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#0812B8] bg-white border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0">
            <Camera className="w-3.5 h-3.5" />
            <span>
              {photoFile || initialAgent?.photoDocName
                ? 'Replace Picture'
                : 'Upload Picture'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => handleUpload('photo', e)}
              className="sr-only"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              {publicSignup ? 'Email Address' : 'Email Address (Login)'}
            </label>
            <input
              type="email"
              required
              disabled={!canEditAdminFields || (selfSignup && !publicSignup)}
              maxLength={FIELD_LIMITS.email}
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="agent@cerebus.example"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {selfSignup && !publicSignup && (
              <p className="text-[11px] text-slate-500 mt-1">
                Verified via Google sign-in
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cerebus agent code
            </label>
            <input
              type="text"
              required
              disabled={!canEditAdminFields}
              maxLength={FIELD_LIMITS.cerebusAgentCode}
              value={cerebusAgentCode}
              onChange={(e) => setCerebusAgentCode(e.target.value.toUpperCase())}
              placeholder="CRB-0201"
              className="w-full px-3 py-2 text-sm font-mono uppercase border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Geographic area
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.geographicArea}
              value={geographicArea}
              onChange={(e) => setGeographicArea(e.target.value)}
              placeholder="Gauteng · Sandton"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cerebus team leader
            </label>
            <input
              type="text"
              required
              disabled={!canEditAdminFields}
              maxLength={FIELD_LIMITS.cerebusTeamLeader}
              value={cerebusTeamLeader}
              onChange={(e) => setCerebusTeamLeader(e.target.value)}
              placeholder="Thabo Ndlovu"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              First name
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.firstName}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Middle names
            </label>
            <input
              type="text"
              maxLength={FIELD_LIMITS.middleNames}
              value={middleNames}
              onChange={(e) => setMiddleNames(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Surname
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.surname}
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Nationality
            </label>
            <input
              type="text"
              required
              maxLength={FIELD_LIMITS.nationality}
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ID document type
            </label>
            <select
              value={idDocumentType}
              onChange={(e) =>
                setIdDocumentType(e.target.value as IdDocumentType)
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {ID_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              ID/Passport number
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={FIELD_LIMITS.idPassportNumber}
              value={idPassportNumber}
              onChange={(e) => setIdPassportNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          {actor && actor.role !== 'agent' && !selfSignup && !publicSignup && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Agent Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgentStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="active">Active</option>
                <option value="pending_review">Pending Review</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Contact, Uniform & Comments */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-semibold text-slate-900">
            02. Contact Channels, T-Shirt Kit & Comments
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cellphone number
            </label>
            <input
              type="tel"
              required
              minLength={5}
              maxLength={FIELD_LIMITS.phone}
              value={cellphoneNumber}
              onChange={(e) => setCellphoneNumber(e.target.value)}
              placeholder="+27 82 000 0000"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Whatsapp number
            </label>
            <input
              type="tel"
              maxLength={FIELD_LIMITS.phone}
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+27 82 000 0000"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email (Contact / Payslip)
            </label>
            <input
              type="email"
              required
              maxLength={FIELD_LIMITS.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              T-shirt style
            </label>
            <select
              value={tShirtStyle}
              onChange={(e) => setTShirtStyle(e.target.value as TShirtStyle)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {TSHIRT_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              T-shirt size
            </label>
            <select
              value={tShirtSize}
              onChange={(e) => setTShirtSize(e.target.value as TShirtSize)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {TSHIRT_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Your comments
            </label>
            <textarea
              rows={2}
              maxLength={FIELD_LIMITS.yourComments}
              value={yourComments}
              onChange={(e) => setYourComments(e.target.value)}
              placeholder="Optional notes regarding uniform delivery, availability, or payout instructions..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Banking Details (only on initial creation — banking updates go through Monthly Confirm flow for audit integrity) */}
      {!isEdit && (
        <section className="space-y-4">
          <div className="border-b border-slate-200 pb-2">
            <h3 className="text-sm font-semibold text-slate-900">
              03. Payout Banking Details
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bank name and code
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.bankNameAndCode}
                value={bankNameAndCode}
                onChange={(e) => setBankNameAndCode(e.target.value)}
                placeholder="FNB · 250655"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account holder name
              </label>
              <input
                type="text"
                required
                maxLength={FIELD_LIMITS.accountHolderName}
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="As registered on bank statement"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account type
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Account number
              </label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={FIELD_LIMITS.accountNumber}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className={`w-full px-3 py-2 text-sm font-mono tabular-nums border rounded-lg bg-white focus:outline-none focus:ring-2 ${
                  duplicateBankResult?.isDuplicate
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-blue-600'
                }`}
              />
            </div>
          </div>

          {checkingDuplicateBank && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Checking added banks for duplicate account number...</span>
            </div>
          )}

          {!checkingDuplicateBank && duplicateBankResult?.isDuplicate && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Duplicate bank detected:</span>{' '}
                {duplicateBankResult.reason}
              </div>
            </div>
          )}

          {!checkingDuplicateBank &&
            duplicateBankResult &&
            !duplicateBankResult.isDuplicate &&
            duplicateBankResult.bankKey && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  No duplicate found — this bank account number is unique in the ledger.
                </span>
              </div>
            )}
        </section>
      )}

      {/* Section 4: Compliance Document Uploads */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            {isEdit
              ? '03. Update Compliance Documents'
              : '04. Compliance Documentation'}
          </h3>
          <span className="text-xs font-medium text-red-700">
            All document uploads are required *
          </span>
        </div>
        <div
          className={`grid grid-cols-1 gap-4 ${
            isEdit ? '' : 'sm:grid-cols-2'
          }`}
        >
          {!isEdit && (
            <label
              className={`flex flex-col justify-between gap-2 p-3.5 border border-dashed rounded-lg transition-colors cursor-pointer ${
                attemptedSubmit && !bankFile
                  ? 'border-red-400 bg-red-50/50 hover:bg-red-50'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
              }`}
            >
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-900 block">
                  Upload bank statement <span className="text-red-600">*</span>
                </span>
                <span className="text-xs text-slate-500 block truncate">
                  {busyUpload === 'bank'
                    ? 'Processing...'
                    : bankFile
                      ? bankFile.fileName
                      : 'Required · PDF, PNG, JPG'}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <FileUp className="w-3.5 h-3.5" />
                {bankFile ? 'Replace File' : 'Select File'}
              </span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => handleUpload('bank', e)}
                className="sr-only"
              />
            </label>
          )}

          <label
            className={`flex flex-col justify-between gap-2 p-3.5 border border-dashed rounded-lg transition-colors cursor-pointer ${
              attemptedSubmit && !idFile && (!isEdit || !initialAgent?.idDocId)
                ? 'border-red-400 bg-red-50/50 hover:bg-red-50'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100/70'
            }`}
          >
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-900 block">
                Upload ID/passport <span className="text-red-600">*</span>
              </span>
              <span className="text-xs text-slate-500 block truncate">
                {busyUpload === 'id'
                  ? 'Processing...'
                  : idFile
                    ? idFile.fileName
                    : initialAgent?.idDocName
                      ? `Current: ${initialAgent.idDocName}`
                      : 'Required · PDF, PNG, JPG'}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
              <FileUp className="w-3.5 h-3.5" />
              {idFile || initialAgent?.idDocName ? 'Replace ID' : 'Select File'}
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => handleUpload('id', e)}
              className="sr-only"
            />
          </label>
        </div>

        {fileFlag && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Flagged:</span> {fileFlag}
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={
            submitting ||
            busyUpload !== null ||
            (!isEdit &&
              (checkingDuplicateBank || Boolean(duplicateBankResult?.isDuplicate)))
          }
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0812B8] hover:bg-[#060E94] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>
            {isEdit
              ? 'Save Personal Info & Docs'
              : selfSignup || publicSignup
                ? 'Submit Agent Registration'
                : 'Create Agent Record'}
          </span>
        </button>
      </div>
    </form>
  );

  const contractPopup = (
    <ContractTermsModal
      open={showContractPopup}
      submitting={submitting}
      agentCode={cerebusAgentCode.trim().toUpperCase()}
      fullName={getAgentFullName({ firstName, middleNames, surname })}
      idPassportNumber={idPassportNumber}
      geographicArea={geographicArea}
      teamLeader={cerebusTeamLeader}
      bankNameAndCode={bankNameAndCode}
      accountType={accountType}
      accountNumber={accountNumber}
      cycleMonth={activeCycle}
      onCancel={() => setShowContractPopup(false)}
      onAccept={() => void executeSubmission(new Date().toISOString())}
    />
  );

  if (isInlineSignup) {
    return (
      <>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Cerebus Agent Onboarding Form
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete your personal details, uniform sizing, payout banking account, and compliance documents for cycle {activeCycle}.
            </p>
          </div>
          {formContent}
        </div>
        {contractPopup}
        <PhotoLightboxModal
          target={expandedPhoto}
          onClose={() => setExpandedPhoto(null)}
        />
      </>
    );
  }

  if (createdReceipt) {
    const portalUrl = window.location.origin;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Agent Created · Login Credentials Generated
                </h2>
                <p className="text-xs text-slate-500">
                  {createdReceipt.fullName} ({createdReceipt.agentCode})
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-[#0B1120] text-white rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Share this one-time <span className="text-white font-medium">User Login</span> and{' '}
                    <span className="text-white font-medium">Temporary Password</span> with the agent so they can sign in later.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void copyCredential(
                      'all',
                      `Portal URL: ${portalUrl}\nUser Login: ${createdReceipt.credentials.loginUsername}\nTemp Password: ${createdReceipt.credentials.tempPassword}`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#1420D8] rounded-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All</span>
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 block">User Login</span>
                    <span className="font-mono font-semibold text-sm text-white">
                      {createdReceipt.credentials.loginUsername}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential(
                        'login',
                        createdReceipt.credentials.loginUsername,
                      )
                    }
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  >
                    {copiedField === 'login' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 block">
                      Temporary Password
                    </span>
                    <span className="font-mono font-semibold text-sm text-amber-300">
                      {createdReceipt.credentials.tempPassword}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void copyCredential(
                        'password',
                        createdReceipt.credentials.tempPassword,
                      )
                    }
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {isEdit
                  ? `Edit Personal Info & Docs · ${initialAgent?.cerebusAgentCode}`
                  : 'Signup / Add Cerebus Agent'}
              </h2>
              {isEdit && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Changes to personal fields or uploaded documents are logged to the immutable audit trail.
                </p>
              )}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {formContent}
        </div>
      </div>
      {contractPopup}
      <PhotoLightboxModal
        target={expandedPhoto}
        onClose={() => setExpandedPhoto(null)}
      />
    </>
  );
}

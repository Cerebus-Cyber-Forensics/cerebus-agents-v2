import { useState } from 'react';
import {
  CreditCard,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  History,
  User,
  X,
} from 'lucide-react';
import {
  AgentRecord,
  AuditLogEntry,
  MonthlyConfirmation,
} from '../types';
import {
  formatTimestamp,
  getAgentFullName,
  maskAccountNumber,
  toMillis,
} from '../utils/cycleUtils';
import { VerificationStatusLabel } from './StatusLabel';
import { ExpandedPhotoTarget } from './PhotoLightboxModal';

interface AgentDossierDrawerProps {
  agent: AgentRecord;
  confirmations: MonthlyConfirmation[];
  auditLogs: AuditLogEntry[];
  activeCycle: string;
  onClose: () => void;
  onEditPersonal: (agent: AgentRecord) => void;
  onConfirmBanking: (
    agent: AgentRecord,
    cycleMonth: string,
    existingConf?: MonthlyConfirmation | null,
  ) => void;
  onPreviewDoc: (docId: string, title: string) => void;
  onExpandPhoto: (photo: ExpandedPhotoTarget) => void;
}

type DossierTab = 'profile' | 'banking' | 'docs' | 'audit';

export function AgentDossierDrawer({
  agent,
  confirmations,
  auditLogs,
  activeCycle,
  onClose,
  onEditPersonal,
  onConfirmBanking,
  onPreviewDoc,
  onExpandPhoto,
}: AgentDossierDrawerProps) {
  const [tab, setTab] = useState<DossierTab>('profile');
  const [revealAcct, setRevealAcct] = useState(false);

  const fullName = getAgentFullName(agent);
  const agentConfirmations = confirmations
    .filter((c) => c.agentId === agent.agentId)
    .sort((a, b) => b.cycleMonth.localeCompare(a.cycleMonth));

  const agentLogs = auditLogs
    .filter((l) => l.agentId === agent.agentId)
    .sort((a, b) => toMillis(b.timestamp) - toMillis(a.timestamp));

  const activeCycleConf =
    agentConfirmations.find((c) => c.cycleMonth === activeCycle) || null;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex justify-end">
      <div className="bg-white border-l border-slate-200 w-full max-w-2xl h-full flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {agent.photoThumbUrl || agent.photoDocId ? (
              <button
                type="button"
                onClick={() =>
                  onExpandPhoto({
                    title: fullName,
                    subtitle: `${agent.cerebusAgentCode} · ${agent.geographicArea}`,
                    docId: agent.photoDocId,
                    fallbackThumbUrl: agent.photoThumbUrl,
                    fileName: agent.photoDocName,
                  })
                }
                title="Click to expand whole profile picture"
                className="group relative shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:ring-2 hover:ring-[#0812B8] transition-all"
              >
                {agent.photoThumbUrl ? (
                  <img
                    src={agent.photoThumbUrl}
                    alt={fullName}
                    className="w-16 h-16 object-cover group-hover:opacity-90 transition-opacity"
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center text-slate-500">
                    <User className="w-7 h-7" />
                  </div>
                )}
              </button>
            ) : (
              <div className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                <User className="w-7 h-7" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                <span className="font-mono tabular-nums font-medium text-slate-700">
                  {agent.cerebusAgentCode}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{agent.geographicArea}</span>
                <span aria-hidden="true">·</span>
                <span>TL: {agent.cerebusTeamLeader}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1 truncate">
                {fullName}
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Onboarded {formatTimestamp(agent.timestamp)} · Updated{' '}
                {formatTimestamp(agent.updatedAt)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close agent dossier"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('profile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'profile'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => setTab('banking')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'banking'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Banking & Cycles
            </button>
            <button
              type="button"
              onClick={() => setTab('docs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'docs'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Documents
            </button>
            <button
              type="button"
              onClick={() => setTab('audit')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Logs ({agentLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEditPersonal(agent)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Info & Docs
            </button>
            <button
              type="button"
              onClick={() =>
                onConfirmBanking(agent, activeCycle, activeCycleConf)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Confirm Banking
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Identity & Territory
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-slate-100 pt-3">
                  <div>
                    <dt className="text-xs text-slate-500">Email Address</dt>
                    <dd className="text-slate-900 font-medium break-all">
                      {agent.emailAddress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Cerebus agent code</dt>
                    <dd className="font-mono tabular-nums text-slate-900 font-medium">
                      {agent.cerebusAgentCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Geographic area</dt>
                    <dd className="text-slate-900">{agent.geographicArea}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Cerebus team leader</dt>
                    <dd className="text-slate-900">{agent.cerebusTeamLeader}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">First name</dt>
                    <dd className="text-slate-900">{agent.firstName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Middle names</dt>
                    <dd className="text-slate-900">{agent.middleNames || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Surname</dt>
                    <dd className="text-slate-900">{agent.surname}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Nationality</dt>
                    <dd className="text-slate-900">{agent.nationality}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">ID document type</dt>
                    <dd className="text-slate-900">{agent.idDocumentType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">ID/Passport number</dt>
                    <dd className="font-mono tabular-nums text-slate-900">
                      {agent.idPassportNumber}
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Contact & Uniform Kit
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-slate-100 pt-3">
                  <div>
                    <dt className="text-xs text-slate-500">Cellphone number</dt>
                    <dd className="font-mono tabular-nums text-slate-900">
                      {agent.cellphoneNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Whatsapp number</dt>
                    <dd className="font-mono tabular-nums text-slate-900">
                      {agent.whatsappNumber || '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Email</dt>
                    <dd className="text-slate-900 break-all">{agent.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">T-shirt style & size</dt>
                    <dd className="text-slate-900">
                      {agent.tShirtStyle} · {agent.tShirtSize}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Your comments</dt>
                    <dd className="text-slate-700 mt-0.5">
                      {agent.yourComments || 'No comments recorded.'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {tab === 'banking' && (
            <div className="space-y-6">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Current Registered Bank Account
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRevealAcct((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                  >
                    {revealAcct ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide Number
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Reveal Number
                      </>
                    )}
                  </button>
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Bank name and code</dt>
                    <dd className="font-medium text-slate-900">
                      {agent.bankNameAndCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Account holder name</dt>
                    <dd className="font-medium text-slate-900">
                      {agent.accountHolderName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Account type</dt>
                    <dd className="text-slate-900">{agent.accountType}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Account number</dt>
                    <dd className="font-mono tabular-nums font-medium text-slate-900">
                      {revealAcct
                        ? agent.accountNumber
                        : maskAccountNumber(agent.accountNumber)}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Banking Confirmations
                </h3>
                {agentConfirmations.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No banking confirmations recorded yet.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                    {agentConfirmations.map((conf) => (
                      <div
                        key={conf.confirmationId}
                        className="p-4 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-900">
                              {conf.actionKind === 'updated_banking'
                                ? 'Banking Updated'
                                : 'Confirmed Existing'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatTimestamp(conf.updatedAt || conf.submittedAt)}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800">
                            {conf.bankNameAndCode} ·{' '}
                            <span className="font-mono tabular-nums">
                              {revealAcct
                                ? conf.accountNumber
                                : maskAccountNumber(conf.accountNumber)}
                            </span>
                          </p>
                          {conf.previousBankSummary && (
                            <p className="text-xs text-amber-700">
                              Previous: {conf.previousBankSummary}
                            </p>
                          )}
                          {conf.reviewerNotes && (
                            <p className="text-xs text-slate-600">
                              Reviewer note: {conf.reviewerNotes}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-1.5">
                          <VerificationStatusLabel
                            status={conf.verificationStatus}
                            isLateAfterCutoff={conf.isLateAfterCutoff}
                          />
                          {conf.bankDocId && (
                            <div>
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewDoc(conf.bankDocId!, 'Bank Proof')
                                }
                                className="text-xs font-medium text-blue-700 hover:underline cursor-pointer"
                              >
                                View Bank Proof
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'docs' && (
            <div className="space-y-3">
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {agent.photoThumbUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          onExpandPhoto({
                            title: fullName,
                            subtitle: `${agent.cerebusAgentCode} · Face Photo`,
                            docId: agent.photoDocId,
                            fallbackThumbUrl: agent.photoThumbUrl,
                            fileName: agent.photoDocName,
                          })
                        }
                        title="Click to expand whole profile picture"
                        className="rounded-full overflow-hidden border border-slate-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-[#0812B8] transition-all"
                      >
                        <img
                          src={agent.photoThumbUrl}
                          alt={fullName}
                          className="w-10 h-10 object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        Agent Face Photo
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {agent.photoDocName || 'Not uploaded yet'}
                      </p>
                    </div>
                  </div>
                  {agent.photoDocId || agent.photoThumbUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        onExpandPhoto({
                          title: fullName,
                          subtitle: `${agent.cerebusAgentCode} · Face Photo`,
                          docId: agent.photoDocId,
                          fallbackThumbUrl: agent.photoThumbUrl,
                          fileName: agent.photoDocName,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Expand Photo
                    </button>
                  ) : (
                    <span className="text-xs text-red-700">Missing</span>
                  )}
                </div>

                <div className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      ID / Passport Document
                    </p>
                    <p className="text-xs text-slate-500">
                      {agent.idDocName || 'Not uploaded yet'}
                    </p>
                  </div>
                  {agent.idDocId ? (
                    <button
                      type="button"
                      onClick={() =>
                        onPreviewDoc(agent.idDocId!, 'ID / Passport Document')
                      }
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Preview ID
                    </button>
                  ) : (
                    <span className="text-xs text-red-700">Missing</span>
                  )}
                </div>

                {agentConfirmations
                  .filter((c) => Boolean(c.bankDocId))
                  .map((c) => (
                    <div
                      key={c.confirmationId}
                      className="p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Bank Statement / Proof
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.bankDocName}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onPreviewDoc(c.bankDocId!, 'Bank Proof')
                        }
                        className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Preview
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-3">
              {agentLogs.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No audit events recorded for this agent yet.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-200">
                  {agentLogs.map((log) => (
                    <div key={log.logId} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          <span className="font-medium text-slate-900">
                            {log.actorName}
                          </span>{' '}
                          ({log.actorRole.replace('_', ' ')})
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-800">{log.summary}</p>
                      {log.changes.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-slate-200">
                              {log.changes.map((chg, idx) => (
                                <tr key={idx}>
                                  <td className="px-3 py-1.5 font-medium text-slate-700 w-1/3">
                                    {chg.field}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-500 line-through w-1/3 break-all">
                                    {chg.previousValue}
                                  </td>
                                  <td className="px-3 py-1.5 text-slate-900 font-medium w-1/3 break-all">
                                    {chg.newValue}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  ExternalLink,
  History,
  LayoutDashboard,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AgentDossierDrawer } from './components/AgentDossierDrawer';
import { AgentFormModal } from './components/AgentFormModal';
import { AgentsDirectoryView } from './components/AgentsDirectoryView';
import { AgentSelfServiceView } from './components/AgentSelfServiceView';
import { AuditTrailView } from './components/AuditTrailView';
import { CerebusLoader } from './components/CerebusLoader';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InviteSignupPortal } from './components/InviteSignupPortal';
import { LoginGate } from './components/LoginGate';
import { MonthlyConfirmModal } from './components/MonthlyConfirmModal';
import { OverviewView } from './components/OverviewView';
import { PaymentVerificationView } from './components/PaymentVerificationView';
import {
  ExpandedPhotoTarget,
  PhotoLightboxModal,
} from './components/PhotoLightboxModal';
import { SignupLinkModal } from './components/SignupLinkModal';
import { TeamAccessView } from './components/TeamAccessView';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ensureUserProfile,
  purgeLegacySeededData,
  resetAllLedgerData,
} from './services/ledgerService';
import {
  ADMIN_ACTIVATION_EMAILS,
  AgentRecord,
  AuditLogEntry,
  MonthlyConfirmation,
  UserAccount,
} from './types';
import { formatCycleLabel, getCurrentCycleMonth, getCycleOptions } from './utils/cycleUtils';

type NavView = 'overview' | 'agents' | 'verify' | 'audit' | 'access';

function LedgerDashboard() {
  const isInviteSignupMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get('signup') === 'agent' || params.get('mode') === 'signup'
    );
  }, []);

  const [authReady, setAuthReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [authError, setAuthError] = useState('');

  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [confirmations, setConfirmations] = useState<MonthlyConfirmation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [platformUsers, setPlatformUsers] = useState<UserAccount[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [cleanupChecked, setCleanupChecked] = useState(false);

  const [activeView, setActiveView] = useState<NavView>('overview');
  const [activeCycle, setActiveCycle] = useState<string>(() =>
    getCurrentCycleMonth(),
  );
  const cycleOptions = useMemo(() => getCycleOptions(), []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Modal & Drawer states
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<{
    mode: 'create' | 'edit';
    agent?: AgentRecord | null;
  } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    agent: AgentRecord;
    cycleMonth: string;
    existingConf?: MonthlyConfirmation | null;
  } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    docId: string;
    title: string;
  } | null>(null);
  const [expandedPhoto, setExpandedPhoto] =
    useState<ExpandedPhotoTarget | null>(null);
  const [signupLinkOpen, setSignupLinkOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingDb, setResettingDb] = useState(false);
  const [resetError, setResetError] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(''), 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    if (isInviteSignupMode) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUserAccount(null);
        setAgents([]);
        setConfirmations([]);
        setAuditLogs([]);
        setPlatformUsers([]);
        setAuthReady(true);
        setDataLoading(false);
        return;
      }

      setAuthError('');
      try {
        const profile = await ensureUserProfile(fbUser);
        setUserAccount(profile);
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Unable to load user profile.',
        );
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, [isInviteSignupMode]);

  // Firestore real-time listeners (only attached once authenticated in dashboard mode)
  useEffect(() => {
    if (!userAccount || isInviteSignupMode) return;

    setDataLoading(true);
    const unsubs: (() => void)[] = [];

    const buildQuery = (colName: string) => {
      const colRef = collection(db, colName);
      if (userAccount.role === 'admin') {
        return colRef;
      }
      if (userAccount.role === 'team_leader') {
        return query(
          colRef,
          where('cerebusTeamLeader', '==', userAccount.teamLeaderName || '__none__'),
        );
      }
      if (auth.currentUser?.emailVerified) {
        return query(
          colRef,
          where('emailAddress', '==', userAccount.email.toLowerCase()),
        );
      }
      return query(colRef, where('ownerUid', '==', userAccount.uid));
    };

    if (userAccount.role === 'admin' && !cleanupChecked) {
      setCleanupChecked(true);
      void purgeLegacySeededData().then((purged) => {
        if (purged > 0) {
          showToast('Removed legacy preset records from database.');
        }
      });
    }

    unsubs.push(
      onSnapshot(
        buildQuery('agents'),
        (snap) => {
          const list = snap.docs.map((d) => d.data() as AgentRecord);
          setAgents(list);
          setDataLoading(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'agents'),
      ),
    );

    unsubs.push(
      onSnapshot(
        buildQuery('monthly_confirmations'),
        (snap) => {
          setConfirmations(
            snap.docs.map((d) => d.data() as MonthlyConfirmation),
          );
        },
        (err) =>
          handleFirestoreError(
            err,
            OperationType.LIST,
            'monthly_confirmations',
          ),
      ),
    );

    unsubs.push(
      onSnapshot(
        buildQuery('audit_logs'),
        (snap) => {
          setAuditLogs(snap.docs.map((d) => d.data() as AuditLogEntry));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs'),
      ),
    );

    if (userAccount.role === 'admin') {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setPlatformUsers(snap.docs.map((d) => d.data() as UserAccount));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
        ),
      );
    } else if (
      ADMIN_ACTIVATION_EMAILS.includes(userAccount.email.toLowerCase())
    ) {
      unsubs.push(
        onSnapshot(
          doc(db, 'users', userAccount.uid),
          (snap) => {
            if (snap.exists()) {
              const updated = snap.data() as UserAccount;
              if (updated.role !== userAccount.role) {
                setUserAccount(updated);
              }
            }
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.GET,
              `users/${userAccount.uid}`,
            ),
        ),
      );
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [userAccount, cleanupChecked, isInviteSignupMode]);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agentId === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  const teamLeaderOptions = useMemo(
    () =>
      Array.from(
        new Set(agents.map((a) => a.cerebusTeamLeader).filter(Boolean)),
      ).sort(),
    [agents],
  );

  const selfAgent = useMemo(() => {
    if (!userAccount || userAccount.role !== 'agent') return null;
    return (
      agents.find(
        (a) =>
          a.ownerUid === userAccount.uid ||
          a.emailAddress.toLowerCase() === userAccount.email.toLowerCase(),
      ) || null
    );
  }, [agents, userAccount]);

  if (isInviteSignupMode) {
    return <InviteSignupPortal />;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <CerebusLoader label="Authenticating Cerebus Session..." />
      </div>
    );
  }

  if (!userAccount) {
    return <LoginGate />;
  }

  const isStaff =
    userAccount.role === 'admin' || userAccount.role === 'team_leader';

  const navItems: { id: NavView; label: string; icon: typeof LayoutDashboard }[] =
    isStaff
      ? [
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'agents', label: 'Agents', icon: Users },
          { id: 'verify', label: 'Verify Payments', icon: ClipboardCheck },
          { id: 'audit', label: 'Audit Trail', icon: History },
          ...(userAccount.role === 'admin'
            ? [{ id: 'access' as const, label: 'Team Access', icon: Shield }]
            : []),
        ]
      : [{ id: 'overview', label: 'My Dossier', icon: UserCheck }];

  const currentNavTitle =
    navItems.find((item) => item.id === activeView)?.label || 'Overview';

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleConfirmResetDb = async () => {
    if (!userAccount || userAccount.role !== 'admin') return;
    setResetError('');
    setResettingDb(true);
    try {
      const result = await resetAllLedgerData(userAccount);
      setSelectedAgentId(null);
      setResetModalOpen(false);
      showToast(
        `Database cleared: removed ${result.deletedAgents} agent(s), ${result.deletedConfirmations} confirmation(s), ${result.deletedDocuments} document(s), and ${result.deletedLogs} audit log(s).`,
      );
    } catch (err) {
      setResetError(
        err instanceof Error ? err.message : 'Unable to clear database.',
      );
    } finally {
      setResettingDb(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[248px] lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center">
          <img
            src="/assets/aistudio/image_3b1feb10.png"
            alt="Cerebus Cyber Forensics"
            referrerPolicy="no-referrer"
            className="h-9 w-auto object-contain"
          />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#0812B8]/8 text-[#0812B8]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              {userAccount.displayName}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {userAccount.email}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Role:{' '}
              <span className="font-medium text-slate-900 capitalize">
                {userAccount.role.replace('_', ' ')}
              </span>
              {userAccount.teamLeaderName
                ? ` · ${userAccount.teamLeaderName}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/40 flex">
          <div className="w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <img
                src="/assets/aistudio/image_3b1feb10.png"
                alt="Cerebus Cyber Forensics"
                referrerPolicy="no-referrer"
                className="h-8 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg cursor-pointer ${
                      active
                        ? 'bg-[#0812B8]/8 text-[#0812B8]'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-[248px] flex flex-col min-w-0">
        {/* Contextual Top Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">
                Operations
              </span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <h1 className="font-semibold text-slate-900 truncate">
                {currentNavTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              value={activeCycle}
              onChange={(e) => setActiveCycle(e.target.value)}
              aria-label="Select payment cycle"
              className="px-3 py-2 text-xs font-mono tabular-nums font-medium border border-slate-200 rounded-lg bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {cycleOptions.map((c) => (
                <option key={c} value={c}>
                  {formatCycleLabel(c)}
                </option>
              ))}
            </select>

            {isStaff && (
              <>
                <button
                  type="button"
                  onClick={() => setSignupLinkOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Link2 className="w-3.5 h-3.5 text-[#0812B8]" />
                  <span className="hidden sm:inline">Signup Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormModal({ mode: 'create', agent: null })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Agent</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto space-y-6">
          {authError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {authError}
            </div>
          )}

          {dataLoading ? (
            <CerebusLoader label="Synchronizing Agent & Payment Ledger..." />
          ) : isStaff ? (
            <>
              {activeView === 'overview' && (
                <OverviewView
                  agents={agents}
                  confirmations={confirmations}
                  auditLogs={auditLogs}
                  activeCycle={activeCycle}
                  onNavigate={setActiveView}
                  onSelectAgent={(agent) => setSelectedAgentId(agent.agentId)}
                />
              )}

              {activeView === 'agents' && (
                <AgentsDirectoryView
                  agents={agents}
                  confirmations={confirmations}
                  activeCycle={activeCycle}
                  onAddAgent={() =>
                    setFormModal({ mode: 'create', agent: null })
                  }
                  onOpenSignupLink={() => setSignupLinkOpen(true)}
                  onViewAgent={(agent) => setSelectedAgentId(agent.agentId)}
                  onExpandPhoto={(photo) => setExpandedPhoto(photo)}
                  onConfirmBanking={(agent, cycleMonth, existingConf) =>
                    setConfirmModal({ agent, cycleMonth, existingConf })
                  }
                />
              )}

              {activeView === 'verify' && (
                <PaymentVerificationView
                  agents={agents}
                  confirmations={confirmations}
                  activeCycle={activeCycle}
                  actor={userAccount}
                  onPreviewDoc={(docId, title) =>
                    setPreviewDoc({ docId, title })
                  }
                  onSelectAgent={(agent) => setSelectedAgentId(agent.agentId)}
                  onToast={showToast}
                />
              )}

              {activeView === 'audit' && (
                <AuditTrailView
                  auditLogs={auditLogs}
                  isAdmin={userAccount.role === 'admin'}
                  onResetDatabase={() => {
                    setResetError('');
                    setResetModalOpen(true);
                  }}
                />
              )}

              {activeView === 'access' && userAccount.role === 'admin' && (
                <TeamAccessView
                  users={platformUsers}
                  actor={userAccount}
                  teamLeaderOptions={teamLeaderOptions}
                  agentCount={agents.length}
                  logCount={auditLogs.length}
                  onResetDatabase={() => {
                    setResetError('');
                    setResetModalOpen(true);
                  }}
                  onToast={showToast}
                />
              )}
            </>
          ) : ADMIN_ACTIVATION_EMAILS.includes(
              userAccount.email.toLowerCase(),
            ) ? (
            <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900">
                <Shield className="w-5 h-5 text-[#0812B8]" />
                <span>Grant Admin Role in Firestore</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Signed in as{' '}
                <span className="font-medium text-slate-900">
                  {userAccount.email}
                </span>
                . Because Email/Password sign-in has no email verification, Firestore security rules require setting your{' '}
                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">
                  role
                </code>{' '}
                field to{' '}
                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">
                  "admin"
                </code>{' '}
                once in Firebase Console. This screen will unlock automatically as soon as you save it.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                <span className="text-xs font-mono text-slate-800 break-all">
                  users/{userAccount.uid}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(userAccount.uid)
                      .then(() => showToast('Copied user UID to clipboard.'));
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy UID</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`https://console.firebase.google.com/project/grand-shadow-5f900/firestore/databases/ai-studio-c0c531e2-5306-4249-b62f-f7845f7dc03e/data/~2Fusers~2F${encodeURIComponent(userAccount.uid)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0812B8] hover:bg-[#060E94] rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Open User Doc in Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Reload Dashboard
                </button>
              </div>
            </div>
          ) : (
            <AgentSelfServiceView
              agent={selfAgent}
              confirmations={confirmations}
              auditLogs={auditLogs}
              activeCycle={activeCycle}
              actor={userAccount}
              onEditPersonal={(agent) => setFormModal({ mode: 'edit', agent })}
              onConfirmBanking={(agent, cycleMonth, existingConf) =>
                setConfirmModal({ agent, cycleMonth, existingConf })
              }
              onPreviewDoc={(docId, title) => setPreviewDoc({ docId, title })}
              onExpandPhoto={(photo) => setExpandedPhoto(photo)}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Modals & Drawers */}
      {selectedAgent && (
        <AgentDossierDrawer
          agent={selectedAgent}
          confirmations={confirmations}
          auditLogs={auditLogs}
          activeCycle={activeCycle}
          onClose={() => setSelectedAgentId(null)}
          onEditPersonal={(agent) => setFormModal({ mode: 'edit', agent })}
          onConfirmBanking={(agent, cycleMonth, existingConf) =>
            setConfirmModal({ agent, cycleMonth, existingConf })
          }
          onPreviewDoc={(docId, title) => setPreviewDoc({ docId, title })}
          onExpandPhoto={(photo) => setExpandedPhoto(photo)}
        />
      )}

      {formModal && (
        <AgentFormModal
          mode={formModal.mode}
          initialAgent={formModal.agent}
          activeCycle={activeCycle}
          actor={userAccount}
          onClose={() => setFormModal(null)}
          onSuccess={showToast}
        />
      )}

      {confirmModal && (
        <MonthlyConfirmModal
          agent={confirmModal.agent}
          cycleMonth={confirmModal.cycleMonth}
          existingConfirmation={confirmModal.existingConf}
          actor={userAccount}
          onClose={() => setConfirmModal(null)}
          onSuccess={showToast}
        />
      )}

      <DocumentPreviewModal
        docId={previewDoc?.docId || null}
        docTitle={previewDoc?.title}
        onClose={() => setPreviewDoc(null)}
      />

      <PhotoLightboxModal
        target={expandedPhoto}
        onClose={() => setExpandedPhoto(null)}
      />

      {signupLinkOpen && (
        <SignupLinkModal
          activeCycle={activeCycle}
          teamLeaderOptions={teamLeaderOptions}
          onClose={() => setSignupLinkOpen(false)}
          onToast={showToast}
        />
      )}

      {resetModalOpen && userAccount.role === 'admin' && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Reset Database for Clean Demo
                </h3>
              </div>
              <button
                type="button"
                disabled={resettingDb}
                onClick={() => setResetModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                This will permanently delete all current test data so you can run your demo on a clean database:
              </p>
              <ul className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                <li>
                  • <span className="font-semibold text-slate-900">{agents.length}</span> agent profile{agents.length === 1 ? '' : 's'}
                </li>
                <li>
                  • <span className="font-semibold text-slate-900">{confirmations.length}</span> monthly confirmation{confirmations.length === 1 ? '' : 's'} & uploaded documents
                </li>
                <li>
                  • <span className="font-semibold text-slate-900">{auditLogs.length}</span> audit trail log entr{auditLogs.length === 1 ? 'y' : 'ies'}
                </li>
              </ul>
              <p className="text-xs text-slate-500">
                Admin and Team Leader user accounts remain intact.
              </p>
              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {resetError}
                </div>
              )}
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={resettingDb}
                  onClick={() => setResetModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resettingDb}
                  onClick={() => void handleConfirmResetDb()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg cursor-pointer"
                >
                  {resettingDb ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{resettingDb ? 'Clearing...' : 'Delete All Agents & Logs'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl border border-slate-700 flex items-center gap-2.5 max-w-md shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LedgerDashboard />
    </ErrorBoundary>
  );
}

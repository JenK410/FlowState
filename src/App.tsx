import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Settings, 
  Calendar, 
  CheckCircle2, 
  Circle, 
  Zap, 
  BarChart3, 
  Coffee, 
  Brain,
  ChevronRight,
  RefreshCw,
  Sun,
  Moon,
  CloudRain,
  Menu,
  X,
  LayoutDashboard,
  ArrowRightLeft,
  Scissors,
  Waves,
  Loader2,
  Smartphone,
  Tablet,
  Share,
  Info,
  TrendingUp,
  PieChart as PieChartIcon,
  Building2,
  Users,
  Link as LinkIcon,
  Trash2,
  ClipboardList,
  Utensils,
  Dumbbell,
  Target,
  Briefcase,
  Flower2,
  Bell,
  BellOff,
  Check,
  SlidersHorizontal,
  Filter,
  ArrowUpDown,
  Landmark,
  GitFork,
  CheckSquare,
  FileText,
  WalletCards,
  Sliders,
  KeyRound
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  adminId: string;
  joinCode: string;
  joinCodeEnabled?: boolean;
  workspaceAnalyticsSubscription?: boolean;
  workspaceAnalyticsSubscriptionStatus?: string;
  workspaceAnalyticsSeatCount?: number | null;
  workspaceAnalyticsMonthlyAmountCents?: number | null;
  createdAt: any;
}

interface WorkspaceCodeLookup {
  orgId: string;
  orgName: string;
  enabled: boolean;
}

interface Membership {
  id: string;
  userId: string;
  orgId: string;
  name?: string;
  jobTitle?: string;
  role: 'admin' | 'worker';
  joinedAt: any;
}

interface Invite {
  id: string;
  orgId: string;
  orgName: string;
  name: string;
  email?: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined';
  invitedBy: string;
  expiresAt: any;
  createdAt: any;
  role?: 'worker' | 'admin';
  jobTitle?: string;
}

type WorkScheduleMode = 'consistent' | 'alternating' | 'custom4';

interface WorkScheduleWeekForm {
  days: number[];
  start: string;
  end: string;
}

const defaultWorkWeekForm: WorkScheduleWeekForm = {
  days: [1, 2, 3, 4, 5],
  start: '09:00',
  end: '17:00',
};
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, addDays, isSameDay, parse, startOfWeek, subDays } from 'date-fns';
import { auth, createEmailAccount, db, signInWithEmail, signInWithGoogle, testConnection } from './lib/firebase';
import { onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, setDoc, serverTimestamp, deleteDoc, getDoc, getDocFromServer, getDocs, getDocsFromServer, writeBatch, documentId } from 'firebase/firestore';
import { Task, UserSettings, generateDailySchedule } from './lib/scheduler';
import { parseTask } from './services/api';
import { CRMModule } from './components/CRMModule';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DOMAIN_CONFIG: Record<string, { color: string; bg: string; text: string; light: string; border: string; iconBg: string }> = {
  Work: { color: '#64748b', bg: 'bg-slate-500', text: 'text-slate-700', light: 'bg-slate-50', border: 'border-slate-100', iconBg: 'bg-slate-100/50' },
  Development: { color: '#0ea5e9', bg: 'bg-sky-500', text: 'text-sky-700', light: 'bg-sky-50', border: 'border-sky-100', iconBg: 'bg-sky-100/50' },
  Admin: { color: '#8b5cf6', bg: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50', border: 'border-violet-100', iconBg: 'bg-violet-100/50' },
  Health: { color: '#ef4444', bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50', border: 'border-rose-100', iconBg: 'bg-rose-100/50' },
  Wellness: { color: '#14b8a6', bg: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-50', border: 'border-teal-100', iconBg: 'bg-teal-100/50' },
  Meals: { color: '#f97316', bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100/50' },
  Leisure: { color: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', border: 'border-amber-100', iconBg: 'bg-amber-100/50' },
  Personal: { color: '#ec4899', bg: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-50', border: 'border-pink-100', iconBg: 'bg-pink-100/50' },
  Wealth: { color: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100/50' },
  Sleep: { color: '#6366f1', bg: 'bg-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50', border: 'border-indigo-100', iconBg: 'bg-indigo-100/50' },
};

const ANALYTICS_PLANS = {
  mainframe: {
    title: 'Mainframe Analytics',
    price: '$2.99/month',
    description: 'Personal performance analytics, focus velocity, balance reports, and hidden optimization signals.'
  },
  workspace: {
    title: 'Workspace Analytics',
    price: 'From $4.99/month',
    description: 'Workspace reports, team signals, customer flow insights, and shared performance analytics. Pricing increases $1/month for every additional 15 employees.'
  }
} as const;

const getWorkspaceAnalyticsPriceCents = (memberCount: number) => {
  const normalizedCount = Math.max(1, Math.floor(memberCount || 1));
  const tierIndex = Math.max(0, Math.ceil(normalizedCount / 15) - 1);
  return 499 + tierIndex * 100;
};

const formatMonthlyPrice = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}/month`;

const getWorkspaceAnalyticsTierLabel = (memberCount: number) => {
  const normalizedCount = Math.max(1, Math.floor(memberCount || 1));
  const tierIndex = Math.max(0, Math.ceil(normalizedCount / 15) - 1);
  return `${tierIndex * 15 + 1}-${(tierIndex + 1) * 15} employees`;
};

const getDomainIcon = (domain: string, size = 12, className?: string) => {
  switch (domain) {
    case 'Work': return <Briefcase size={size} className={className} />;
    case 'Development': return <Zap size={size} className={className} />;
    case 'Admin': return <ClipboardList size={size} className={className} />;
    case 'Health': return <Dumbbell size={size} className={className} />;
    case 'Wellness': return <Flower2 size={size} className={className} />;
    case 'Meals': return <Utensils size={size} className={className} />;
    case 'Leisure': return <Coffee size={size} className={className} />;
    case 'Personal': return <Users size={size} className={className} />;
    case 'Wealth': return <TrendingUp size={size} className={className} />;
    case 'Sleep': return <Moon size={size} className={className} />;
    default: return <Target size={size} className={className} />;
  }
};

// --- Components ---

const InstallModal = ({ isOpen, onClose, isIOS, deferredPrompt, onInstall }: { 
  isOpen: boolean; 
  onClose: () => void; 
  isIOS: boolean; 
  deferredPrompt: any;
  onInstall: () => void;
}) => {
  if (!isOpen) return null;

  const isIframe = window.self !== window.top;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-500/20 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-md p-5 sm:p-8 shadow-2xl relative border-4 border-mint safe-scroll-panel">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-dove hover:text-ink transition-colors"
        >
          <X size={24} />
        </button>

        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto">
            <Smartphone className="text-mint" size={40} />
          </div>
          
          <h3 className="text-3xl font-elegant font-black italic text-ink">Install FlowState</h3>
          
          <p className="text-slate-500 font-elegant font-bold leading-relaxed">
            {isIframe 
              ? "To install FlowState on your device, you'll need to open it directly in your browser first."
              : isIOS
                ? "Add FlowState to your home screen for a seamless, app-like experience."
                : "Install FlowState for offline access and a faster, cleaner interface."
            }
          </p>

          <div className="space-y-4">
            {isIframe ? (
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 px-4 sm:px-8 bg-mint text-ink rounded-[2rem] font-elegant font-black text-xs sm:text-sm uppercase tracking-[0.12em] sm:tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                Open in Browser
              </a>
            ) : deferredPrompt ? (
              <button 
                onClick={() => { onInstall(); onClose(); }}
                className="w-full flex items-center justify-center gap-3 py-4 sm:py-5 px-4 sm:px-8 bg-mint text-ink rounded-[2rem] font-elegant font-black text-xs sm:text-sm uppercase tracking-[0.12em] sm:tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
              >
                Install Now
              </button>
            ) : isIOS ? (
              <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                    <Share className="text-slate-400" size={18} />
                  </div>
                  <p className="text-xs font-elegant leading-relaxed text-slate-600">
                    1. Tap the <span className="font-black text-ink">Share</span> button in Safari
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-slate-400 rounded-sm flex items-center justify-center">
                      <span className="text-[8px] font-black">+</span>
                    </div>
                  </div>
                  <p className="text-xs font-elegant leading-relaxed text-slate-600">
                    2. Select <span className="font-black text-ink">Add to Home Screen</span>
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-elegant italic text-slate-400">
                Opening your browser's menu and selecting "Install" or "Add to Home Screen" works best on your device.
              </p>
            )}
            
            <button 
              onClick={onClose}
              className="text-dove text-xs font-elegant font-bold uppercase tracking-widest hover:text-ink transition-colors mt-2"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardPreview = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 lg:opacity-40 flex items-center justify-center p-4">
    <div className="w-full max-w-5xl grid grid-cols-12 gap-4 blur-[3px] scale-110 lg:scale-100 transition-all">
      {/* Mock Timeline */}
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 flex items-center gap-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Zap className="text-mint" size={20} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-100 rounded-full w-2/3" />
              <div className="h-2 bg-slate-50 rounded-full w-1/3" />
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-50 border border-dashed border-slate-200" />
          </div>
        ))}
      </div>
      {/* Mock Sidebar Elements */}
      <div className="hidden lg:block lg:col-span-4 space-y-4">
        <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-mint/20 h-48 flex flex-col justify-end">
           <div className="h-6 bg-white/50 rounded-full w-1/2 mb-2" />
           <div className="h-4 bg-white/30 rounded-full w-1/3" />
        </div>
        <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200 h-64 flex flex-col gap-4">
           {[1, 2].map(i => <div key={i} className="h-12 bg-white rounded-2xl shadow-sm" />)}
        </div>
      </div>
    </div>
    <div className="absolute inset-0 bg-gradient-to-b from-soft-purple via-transparent to-soft-purple pointer-events-none" />
  </div>
);

const Button = ({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button 
    className={cn("px-5 py-2.5 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm", className)} 
    {...props}
  >
    {children}
  </button>
);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  const errString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errString);
}

const getAppBaseUrl = (): string => {
  // Always prefer window.location.origin when running in the browser to ensure the URL
  // matches the active host environment (dev vs. shared prebuilt). This also completely prevents
  // issues with incorrect/truncated custom environment variables like 'flowstate-88050491406.us-east'.
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (origin.startsWith('http://') || origin.startsWith('https://')) {
      return origin;
    }
  }
  const envUrl = import.meta.env.VITE_APP_URL;
  if (envUrl && typeof envUrl === 'string' && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl;
  }
  return '';
};

const getMobileShellFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mobileShell') === '1';
};

const buildAppLink = (params: Record<string, string>): string => {
  const baseUrl = getAppBaseUrl();
  const searchParams = new URLSearchParams(params);
  if (getMobileShellFlag()) {
    searchParams.set('mobileShell', '1');
  }
  return `${baseUrl}/?${searchParams.toString()}`;
};

const normalizeWorkspaceCode = (code: string): string => code.trim().toUpperCase();

const resolveWorkspaceCode = async (code: string): Promise<WorkspaceCodeLookup | null> => {
  const normalizedCode = normalizeWorkspaceCode(code);
  if (!normalizedCode) return null;

  const codeSnap = await getDoc(doc(db, 'workspaceCodes', normalizedCode));
  if (codeSnap.exists()) {
    const codeData = codeSnap.data();
    if (codeData.enabled === false) return null;
    return {
      orgId: codeData.orgId,
      orgName: codeData.orgName || 'Workspace',
      enabled: codeData.enabled !== false,
    };
  }

  // Backward-compatible fallback for workspaces created before workspaceCodes existed.
  const q = query(collection(db, 'organizations'), where('joinCode', '==', normalizedCode));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const orgDoc = snap.docs[0];
  const orgData = orgDoc.data();
  if (orgData.joinCodeEnabled === false) return null;

  return {
    orgId: orgDoc.id,
    orgName: orgData.name || 'Workspace',
    enabled: true,
  };
};

const generateWorkspaceCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getProfileSetupKey = (uid: string) => `flowstate_profile_setup_${uid}`;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(localStorage.getItem('flowstate_guest') === 'true');
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [guestTasks, setGuestTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('flowstate_guest_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<UserSettings>({
    sleepStart: '23:00',
    sleepEnd: '07:00',
    morningRoutine: 0,
    eveningRoutine: 0,
    alarmEnabled: false,
    alarmTime: '07:00',
    mainframeAnalyticsSubscription: false
  });
  const [guestSettings, setGuestSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('flowstate_guest_settings');
    const defaults = {
      sleepStart: '23:00',
      sleepEnd: '07:00',
      morningRoutine: 0,
      eveningRoutine: 0,
      alarmEnabled: false,
      alarmTime: '07:00',
      mainframeAnalyticsSubscription: false
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  });
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [guestCheckIns, setGuestCheckIns] = useState<any[]>(() => {
    const saved = localStorage.getItem('flowstate_guest_checkins');
    return saved ? JSON.parse(saved) : [];
  });
  const [inputText, setInputText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditingSleep, setIsEditingSleep] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<UserSettings>(settings);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isEmailAuthLoading, setIsEmailAuthLoading] = useState(false);
  const [paymentLoadingScope, setPaymentLoadingScope] = useState<'mainframe' | 'workspace' | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'crm' | 'workspaces'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'workspaces' || tab === 'dashboard' || tab === 'analytics') {
      return tab as any;
    }
    return 'dashboard';
  });
  const [vibeMood, setVibeMood] = useState<number | null>(null);
  const [vibeEnergy, setVibeEnergy] = useState<number | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [isMembershipsLoaded, setIsMembershipsLoaded] = useState(false);
  const [activeOrgMembers, setActiveOrgMembers] = useState<Membership[]>([]);
  const [memberSort, setMemberSort] = useState<'alphabetical' | 'alphabetical-desc' | 'role-admin' | 'role-worker'>('alphabetical');
  const [memberFilterRole, setMemberFilterRole] = useState<'all' | 'admin' | 'worker'>('all');
  const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('workspaceId') || localStorage.getItem('flowstate_active_org');
  });
  const [workspaceModule, setWorkspaceModule] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('module') || 'reports';
  });

  const [hasProfile, setHasProfile] = useState(false);
  const profileSaveInFlight = useRef(false);
  const handledPaymentReturnRef = useRef(false);
  const [onboardingJoinCode, setOnboardingJoinCode] = useState('');
  const [isOnboardingJoining, setIsOnboardingJoining] = useState(false);
  const [onboardingJoinError, setOnboardingJoinError] = useState<string | null>(null);
  const isMobileShell = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mobileShell') === '1';
  }, []);

  const getMemberDisplayName = (fallback: string) => {
    const savedName = localStorage.getItem('flowstate_member_name');
    return user?.displayName || savedName || user?.email?.split('@')[0] || fallback;
  };

  useEffect(() => {
    if (activeOrgId) localStorage.setItem('flowstate_active_org', activeOrgId);
    else localStorage.removeItem('flowstate_active_org');
  }, [activeOrgId]);

  // URL state synchronization router effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab) {
      params.set('tab', activeTab);
    } else {
      params.delete('tab');
    }

    if (activeTab === 'workspaces' && activeOrgId) {
      params.set('workspaceId', activeOrgId);
    } else {
      params.delete('workspaceId');
      params.delete('module');
    }

    if (activeTab === 'workspaces' && activeOrgId && workspaceModule) {
      params.set('module', workspaceModule);
    } else {
      params.delete('module');
    }

    const pendingInvite = params.get('invite');
    const pendingJoin = params.get('join');

    const searchStr = params.toString();
    const newUrl = searchStr ? `?${searchStr}` : window.location.pathname;
    
    if (window.location.search.substring(1) !== searchStr && !pendingInvite && !pendingJoin) {
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [activeTab, activeOrgId, workspaceModule]);

  useEffect(() => {
    if (activeOrgId && activeTab === 'workspaces') {
      // Do not reset tab, keeping user on workspaces view
    } else if (!activeOrgId && activeTab === 'crm') {
      setActiveTab('dashboard');
    }
  }, [activeOrgId, activeTab]);

  const [inviteInfo, setInviteInfo] = useState<{ orgName: string; invitedName: string } | null>(null);
  const [pendingJoinData, setPendingJoinData] = useState<{
    orgId: string;
    orgName: string;
    invitedName?: string;
    inviteId?: string;
    inviteToken?: string;
    joinCode?: string;
    role?: 'admin' | 'worker';
    jobTitle?: string;
  } | null>(null);
  const [now, setNow] = useState(new Date());
  const [urlParams, setUrlParams] = useState(new URLSearchParams(window.location.search));

  useEffect(() => {
    const handleLocationChange = () => {
      setUrlParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handleLocationChange);
    // Listen to custom event for programmatic URL changes without reload
    window.addEventListener('locationchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    const join = params.get('join');
    // Use localStorage so it persists across login redirects
    if (invite) localStorage.setItem('pending_invite_token', invite);
    if (join) localStorage.setItem('pending_join_code', join);
  }, []);

  // Check for invite info or join code even when unauthenticated to show a better login screen
  useEffect(() => {
    const fetchInviteInfo = async () => {
      const inviteToken = urlParams.get('invite') || localStorage.getItem('pending_invite_token');
      const joinCode = urlParams.get('join') || localStorage.getItem('pending_join_code');

      if (inviteToken) {
        try {
          // Use direct doc lookup by token (token is the doc ID now)
          const inviteRef = doc(db, 'invites', inviteToken);
          const inviteSnap = await getDoc(inviteRef);
          
          if (inviteSnap.exists()) {
            const inviteData = inviteSnap.data();
            // Use denormalized orgName if available, else try fetching (logged in only)
            if (inviteData.orgName) {
              setInviteInfo({ 
                orgName: inviteData.orgName, 
                invitedName: inviteData.name 
              });
            } else {
              // Fallback for old invites
              try {
                const orgDoc = await getDoc(doc(db, 'organizations', inviteData.orgId));
                if (orgDoc.exists()) {
                  setInviteInfo({ 
                    orgName: orgDoc.data().name, 
                    invitedName: inviteData.name 
                  });
                }
              } catch (err) {
                // If can't fetch org (logged out), still show invited name if possible
                setInviteInfo({
                  orgName: "Organization",
                  invitedName: inviteData.name
                });
              }
            }
          } else {
            // Check legacy query fallback just in case
            const inviteQ = query(collection(db, 'invites'), where('token', '==', inviteToken));
            const legacySnap = await getDocs(inviteQ);
            if (!legacySnap.empty) {
              const inviteData = legacySnap.docs[0].data();
              setInviteInfo({ 
                orgName: inviteData.orgName || "Organization", 
                invitedName: inviteData.name 
              });
            } else {
              setInviteInfo(null);
            }
          }
        } catch (e) {
          console.error("Error fetching invite info:", e);
        }
      } else if (joinCode) {
        try {
          const workspace = await resolveWorkspaceCode(joinCode);
          if (workspace) {
            setInviteInfo({
              orgName: workspace.orgName,
              invitedName: "Team Member"
            });
          } else {
            setInviteInfo(null);
          }
        } catch (e) {
          console.error("Error fetching join code info:", e);
          setInviteInfo(null);
        }
      } else {
        setInviteInfo(null);
      }
    };
    fetchInviteInfo();
  }, [urlParams]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const sentNotifications = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        new Notification("FlowState Notifications Active", {
          body: "We'll ping you 5 minutes before your next task.",
        });
      }
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      // Delay to allow network/auth to settle
      await new Promise(r => setTimeout(r, 2000));
      const ok = await testConnection();
      if (!ok) {
        console.warn("[FlowState] Firestore connection pending. If tasks don't load, please refresh.");
      }
    };
    checkConnection();
  }, []);

  const [isJoining, setIsJoining] = useState(false);
  const [joinedOrgIds, setJoinedOrgIds] = useState<string[]>([]);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [isSavingOnboardingProfile, setIsSavingOnboardingProfile] = useState(false);

  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [taskAssignmentMode, setTaskAssignmentMode] = useState<'anyone' | 'everyone' | 'person' | 'department'>('anyone');
  const [taskAssignmentTarget, setTaskAssignmentTarget] = useState<string>('');
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);

  // Logic for strict team vs personal separation
  useEffect(() => {
    if (activeOrgId) {
      // Validate that the user is actually a member of this org
      const isMember = memberships.some(m => m.orgId === activeOrgId) || joinedOrgIds.includes(activeOrgId);
      // Skip validation if we are in the middle of joining an org to avoid race conditions
      if (isMembershipsLoaded && !isMember && !isJoining) {
        console.warn("[FlowState] Stale activeOrgId detected (not joining), resetting to personal space.", { activeOrgId, membershipsCount: memberships.length });
        setActiveOrgId(null);
        return;
      }
      localStorage.setItem('flowstate_active_org', activeOrgId);
    } else {
      localStorage.removeItem('flowstate_active_org');
      setSelectedWorkerId(null); // Clear worker selection when going personal
    }
  }, [activeOrgId, memberships, isJoining, joinedOrgIds, isMembershipsLoaded]);

  // Force personal mode for guests
  useEffect(() => {
    if (isGuest && activeOrgId) {
      setActiveOrgId(null);
    }
  }, [isGuest]);
  const [newOrgName, setNewOrgName] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'worker'>('worker');
  const [newInviteJobTitle, setNewInviteJobTitle] = useState('');
  const [lastCreatedLink, setLastCreatedLink] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberTitle, setEditMemberTitle] = useState('');
  const [editMemberRole, setEditMemberRole] = useState<'admin' | 'worker'>('worker');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showManualInstall, setShowManualInstall] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const [selectedAddDays, setSelectedAddDays] = useState<number[]>([]);
  const [selectedAddDates, setSelectedAddDates] = useState<string[]>([]);
  const [isWorkScheduleOpen, setIsWorkScheduleOpen] = useState(false);
  const [workScheduleMode, setWorkScheduleMode] = useState<WorkScheduleMode>('consistent');
  const [workScheduleName, setWorkScheduleName] = useState('Work');
  const [workScheduleWeeks, setWorkScheduleWeeks] = useState(4);
  const [workWeekA, setWorkWeekA] = useState<WorkScheduleWeekForm>(defaultWorkWeekForm);
  const [workWeekB, setWorkWeekB] = useState<WorkScheduleWeekForm>({
    ...defaultWorkWeekForm,
    days: [2, 3, 4, 5, 6],
  });
  const [workWeekC, setWorkWeekC] = useState<WorkScheduleWeekForm>({
    ...defaultWorkWeekForm,
    days: [1, 3, 5],
  });
  const [workWeekD, setWorkWeekD] = useState<WorkScheduleWeekForm>({
    ...defaultWorkWeekForm,
    days: [2, 4],
  });
  const toggleAddDay = (day: number) => {
    setSelectedAddDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  const toggleAddDate = (date: string) => {
    setSelectedAddDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };
  const toggleWorkScheduleDay = (week: 'A' | 'B' | 'C' | 'D', day: number) => {
    const updateWeek = (current: WorkScheduleWeekForm) => ({
      ...current,
      days: current.days.includes(day)
        ? current.days.filter(d => d !== day)
        : [...current.days, day].sort((a, b) => a - b)
    });

    if (week === 'A') {
      setWorkWeekA(updateWeek);
    } else if (week === 'B') {
      setWorkWeekB(updateWeek);
    } else if (week === 'C') {
      setWorkWeekC(updateWeek);
    } else {
      setWorkWeekD(updateWeek);
    }
  };

  const updateWorkWeek = (week: 'A' | 'B' | 'C' | 'D', patch: Partial<WorkScheduleWeekForm>) => {
    if (week === 'A') {
      setWorkWeekA(prev => ({ ...prev, ...patch }));
    } else if (week === 'B') {
      setWorkWeekB(prev => ({ ...prev, ...patch }));
    } else if (week === 'C') {
      setWorkWeekC(prev => ({ ...prev, ...patch }));
    } else {
      setWorkWeekD(prev => ({ ...prev, ...patch }));
    }
  };

  const [recentCompletions, setRecentCompletions] = useState<Record<string, number>>({});

  // Persistence for Guest Mode
  useEffect(() => {
    if (isGuest) {
      localStorage.setItem('flowstate_guest_tasks', JSON.stringify(guestTasks));
    }
  }, [guestTasks, isGuest]);

  useEffect(() => {
    if (isGuest) {
      localStorage.setItem('flowstate_guest_settings', JSON.stringify(guestSettings));
    }
  }, [guestSettings, isGuest]);

  useEffect(() => {
    if (isGuest) {
      localStorage.setItem('flowstate_guest_checkins', JSON.stringify(guestCheckIns));
    }
  }, [guestCheckIns, isGuest]);

  // Unified Data Access
  const isDateMatch = (taskDate: string | undefined, targetDate: string) => {
    if (!taskDate) return false;
    if (taskDate === targetDate) return true;
    try {
      // Comparison via normalization
      const d = new Date(targetDate + 'T00:00:00');
      const tDate = new Date(taskDate + 'T00:00:00');
      return tDate.getFullYear() === d.getFullYear() && 
             tDate.getMonth() === d.getMonth() && 
             tDate.getDate() === d.getDate();
    } catch {
      return false;
    }
  };

  const activeTasks = useMemo(() => isGuest ? guestTasks : tasks, [isGuest, guestTasks, tasks]);
  const activeSettings = useMemo(() => isGuest ? guestSettings : settings, [isGuest, guestSettings, settings]);
  const activeCheckIns = useMemo(() => isGuest ? guestCheckIns : checkIns, [isGuest, guestCheckIns, checkIns]);

  const analyticsData = useMemo(() => {
    let baseTasks = activeTasks;
    if (activeOrgId && selectedWorkerId) {
      baseTasks = baseTasks.filter(t => t.workerId === selectedWorkerId);
    }

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayTasks = baseTasks.filter(t => isDateMatch(t.date, dateStr));
      const dayCheckIn = activeCheckIns.find(c => c.date === dateStr);
      const completed = dayTasks.filter(t => t.status === 'complete');
      const totalMins = completed.reduce((sum, t) => sum + t.duration, 0);
      
      // Domain breakdown
      const domains = dayTasks.reduce((acc, t) => {
        if (t.status === 'complete') acc[t.domain] = (acc[t.domain] || 0) + t.duration;
        return acc;
      }, {} as Record<string, number>);

      return {
        date: dateStr,
        label: format(d, 'EEE'),
        focusMinutes: totalMins,
        tasks: completed.length,
        domains,
        mood: dayCheckIn?.mood || null,
        energy: dayCheckIn?.energy || null
      };
    });

    const domainTotals = baseTasks
      .filter(t => t.status === 'complete')
      .reduce((acc, t) => {
        acc[t.domain] = (acc[t.domain] || 0) + t.duration;
        return acc;
      }, {} as Record<string, number>);

    const pieData = Object.entries(domainTotals).map(([name, value]) => ({ name, value }));
    const COLORS = pieData.map(d => DOMAIN_CONFIG[d.name]?.color || '#94a3b8');

    return { last7Days, pieData, COLORS };
  }, [activeTasks, activeOrgId, selectedWorkerId, activeCheckIns]);

  // Role visibility logic
  const currentMembership = useMemo(() => {
    if (!user || !activeOrgId) return null;
    return memberships.find(m => m.orgId === activeOrgId);
  }, [memberships, activeOrgId, user]);

  const sortedAndFilteredMembers = useMemo(() => {
    let result = [...activeOrgMembers];

    // Filter by role (if admin asks for it)
    if (currentMembership?.role === 'admin' && memberFilterRole !== 'all') {
      result = result.filter(m => m.role === memberFilterRole);
    }

    // Sort
    result.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase() || 'anonymous';
      const nameB = (b.name || '').toLowerCase() || 'anonymous';

      if (memberSort === 'alphabetical') {
        return nameA.localeCompare(nameB);
      }
      if (memberSort === 'alphabetical-desc') {
        return nameB.localeCompare(nameA);
      }
      if (memberSort === 'role-admin') {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return nameA.localeCompare(nameB); // fallback secondary sort
      }
      if (memberSort === 'role-worker') {
        if (a.role === 'worker' && b.role !== 'worker') return -1;
        if (a.role !== 'worker' && b.role === 'worker') return 1;
        return nameA.localeCompare(nameB); // fallback secondary sort
      }
      return 0;
    });

    return result;
  }, [activeOrgMembers, currentMembership, memberSort, memberFilterRole]);

  const workspaceDepartments = useMemo(() => {
    const names = activeOrgMembers
      .map(member => (member.jobTitle || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [activeOrgMembers]);

  const getTaskAssignmentTargets = () => {
    if (!activeOrgId) return [null];
    if (taskAssignmentMode === 'anyone') return [null];
    if (taskAssignmentMode === 'person') return taskAssignmentTarget ? [taskAssignmentTarget] : [null];
    if (taskAssignmentMode === 'department') {
      const departmentMembers = activeOrgMembers
        .filter(member => (member.jobTitle || '').trim() === taskAssignmentTarget)
        .map(member => member.userId);
      return departmentMembers.length > 0 ? departmentMembers : [null];
    }
    const memberIds = activeOrgMembers.map(member => member.userId);
    return memberIds.length > 0 ? memberIds : [null];
  };

  useEffect(() => {
    if (!activeOrgId) {
      setTaskAssignmentMode('anyone');
      setTaskAssignmentTarget('');
      return;
    }

    if (taskAssignmentMode === 'person' && !activeOrgMembers.some(member => member.userId === taskAssignmentTarget)) {
      setTaskAssignmentTarget(activeOrgMembers[0]?.userId || '');
    }

    if (taskAssignmentMode === 'department' && !workspaceDepartments.includes(taskAssignmentTarget)) {
      setTaskAssignmentTarget(workspaceDepartments[0] || '');
    }
  }, [activeOrgId, activeOrgMembers, taskAssignmentMode, taskAssignmentTarget, workspaceDepartments]);

  const hasTeamTasksToday = useMemo(() => {
    if (!activeOrgId || !user) return false;
    return activeTasks.some(t => t.orgId === activeOrgId && isDateMatch(t.date, selectedDate) && t.workerId === user.uid);
  }, [activeTasks, activeOrgId, user, selectedDate, isDateMatch]);

  const hasAnyTeamTasksToday = useMemo(() => {
    if (!activeOrgId) return false;
    return activeTasks.some(t => t.orgId === activeOrgId && isDateMatch(t.date, selectedDate));
  }, [activeTasks, activeOrgId, selectedDate, isDateMatch]);

  const showTeamUI = false;
  const showWorkspaceContext = activeTab === 'workspaces' && !!activeOrgId;
  const activeOrganization = useMemo(() => organizations.find(o => o.id === activeOrgId) || null, [organizations, activeOrgId]);
  const hasMainframeAnalyticsSubscription = !!activeSettings.mainframeAnalyticsSubscription;
  const hasWorkspaceAnalyticsSubscription = !!activeOrganization?.workspaceAnalyticsSubscription;

  // Auth
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setIsGuest(false); // Disable guest if signed in
        localStorage.removeItem('flowstate_guest');
      } else {
        setIsMembershipsLoaded(false);
        setIsSettingsLoaded(false);
      }
      setLoading(false);
    });
  }, []);

  // Membership Sync Verification Hook (Explicit network re-fetch on auth settle)
  useEffect(() => {
    let isMounted = true;
    const forceSyncMemberships = async () => {
      if (!user || isGuest) return;
      console.log("[FlowState] [MEMBERSHIP_SYNC] Auth settled. Forcing explicit network re-fetch of memberships...");
      try {
        const q = query(collection(db, 'memberships'), where('userId', '==', user.uid));
        let snap;
        try {
          // Bypass local cache completely to retrieve the absolute latest team memberships from the server
          snap = await getDocsFromServer(q);
        } catch (serverErr) {
          console.warn("[FlowState] [MEMBERSHIP_SYNC] Explicit server re-fetch failed, falling back to local cache/network standard getDocs...", serverErr);
          snap = await getDocs(q);
        }
        if (!isMounted) return;
        const fetchedMemberships = snap.docs.map(d => ({ id: d.id, ...d.data() } as Membership));
        console.log("[FlowState] [MEMBERSHIP_SYNC] Explicit memberships fetched:", fetchedMemberships.length);
        
        // Update local state directly to ensure UI updates dynamically with new workspace and team boards
        setMemberships(fetchedMemberships);
        setIsMembershipsLoaded(true);
      } catch (err) {
        console.error("[FlowState] [MEMBERSHIP_SYNC] Both server and cached membership re-fetch failed:", err);
        if (isMounted) {
          setIsMembershipsLoaded(true);
        }
      }
    };

    forceSyncMemberships();

    return () => {
      isMounted = false;
    };
  }, [user, isGuest]);

  const handleSignIn = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        setUser(result.user);
      }
    } catch (e: any) {
      // Gracefully handle the popup closed by user error
      if (e?.code === 'auth/popup-closed-by-user' || e?.message?.includes('popup-closed-by-user')) {
        console.log("Sign-in popup was closed by the user.");
        return;
      }
      if (
        e?.code === 'auth/unauthorized-domain' ||
        e?.message?.includes('unauthorized-domain') ||
        e?.message?.includes('requested action is invalid')
      ) {
        alert(
          `Google sign-in is blocked for this address.\n\nAdd this URL/domain to Firebase Authentication > Settings > Authorized domains:\n\n${window.location.hostname}\n\nOn phones, Google sign-in may also require a native Expo auth flow instead of the web popup.`
        );
        return;
      }
      if (
        e?.code === 'auth/popup-blocked' ||
        e?.message?.includes('popup-blocked') ||
        /webview|useragent|user agent/i.test(e?.message || '')
      ) {
        alert(
          "Google sign-in was blocked inside the mobile app browser. Continue as guest for now, or use the desktop browser until native mobile Google sign-in is added."
        );
        return;
      }
      console.error(e);
      alert(e?.message || "Google sign-in failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getAuthErrorMessage = (error: any) => {
    switch (error?.code) {
      case 'auth/email-already-in-use':
        return 'That email already has an account. Try signing in instead.';
      case 'auth/invalid-email':
        return 'Enter a valid email address.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email or password is incorrect.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled yet in Firebase Authentication.';
      case 'auth/password-does-not-meet-requirements':
        return 'Use a stronger password with at least 6 characters. Firebase may require uppercase, lowercase, a number, or a symbol.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a bit, then try again.';
      default:
        return error?.message || 'Email authentication failed. Please try again.';
    }
  };

  const handleEmailAuth = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (isEmailAuthLoading) return;

    const email = authEmail.trim();
    const password = authPassword;
    const name = authName.trim();

    if (!email || !password || (authMode === 'signup' && !name)) {
      setAuthError(authMode === 'signup' ? 'Name, email, and password are required.' : 'Email and password are required.');
      return;
    }

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsEmailAuthLoading(true);
    setAuthError(null);
    try {
      const result = authMode === 'signup'
        ? await createEmailAccount(email, password, name)
        : await signInWithEmail(email, password);
      localStorage.setItem('flowstate_member_name', result.user.displayName || name || email.split('@')[0]);
      localStorage.removeItem('flowstate_guest');
      setIsGuest(false);
      setUser(result.user);
    } catch (e: any) {
      console.error(e);
      const message = getAuthErrorMessage(e);
      setAuthError(message);
      alert(message);
    } finally {
      setIsEmailAuthLoading(false);
    }
  };

  const shiftDate = (amount: number) => {
    const d = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const nextDate = addDays(d, amount);
    setSelectedDate(format(nextDate, 'yyyy-MM-dd'));
  };

  const totalFocusMinutes = useMemo(() => {
    return activeTasks
      .filter(t => isDateMatch(t.date, selectedDate))
      .reduce((sum, t) => sum + t.duration, 0);
  }, [activeTasks, selectedDate, isDateMatch]);

  const focusStr = useMemo(() => {
    const h = Math.floor(totalFocusMinutes / 60);
    const m = totalFocusMinutes % 60;
    return `${h}h ${m}m`;
  }, [totalFocusMinutes]);

  const isTodayStatus = useMemo(() => {
    return selectedDate === format(new Date(), 'yyyy-MM-dd');
  }, [selectedDate]);

  const relativeDateString = useMemo(() => {
    try {
      const d = parse(selectedDate, 'yyyy-MM-dd', new Date());
      const today = startOfDay(new Date());
      if (isSameDay(d, today)) return 'Today';
      if (isSameDay(d, addDays(today, 1)) ) return 'Tomorrow';
      if (isSameDay(d, addDays(today, -1))) return 'Yesterday';
      return format(d, 'MMM d');
    } catch (e) {
      return 'Today';
    }
  }, [selectedDate]);

  // Data Fetching
  useEffect(() => {
    if (!user || isGuest) return;

    const qTasks = activeOrgId 
      ? query(collection(db, 'tasks'), where('orgId', '==', activeOrgId))
      : query(collection(db, 'tasks'), where('userId', '==', user.uid));

    const unsubTasks = onSnapshot(qTasks, (snap) => {
      let t = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      if (!activeOrgId) {
        t = t.filter(task => !task.orgId);
      }
      setTasks(t);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `tasks`);
    });

    const unsubMemberships = onSnapshot(query(collection(db, 'memberships'), where('userId', '==', user.uid)), (snap) => {
      const m = snap.docs.map(d => ({ id: d.id, ...d.data() } as Membership));
      setMemberships(m);
      setIsMembershipsLoaded(true);
    }, (error) => {
      console.error("[FlowState] memberships snapshot error:", error);
      setIsMembershipsLoaded(true); // fall-through so we do not lock UI
    });

    let unsubActiveOrgMembers = () => {};
    let unsubActiveOrgInvites = () => {};
    if (activeOrgId) {
      unsubActiveOrgMembers = onSnapshot(query(collection(db, 'memberships'), where('orgId', '==', activeOrgId)), (snap) => {
        setActiveOrgMembers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Membership)));
      }, (error) => {
        console.error("[FlowState] activeOrgMembers snapshot error:", error);
        setActiveOrgMembers([]);
      });

      unsubActiveOrgInvites = onSnapshot(query(collection(db, 'invites'), where('orgId', '==', activeOrgId), where('status', '==', 'pending')), (snap) => {
        setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invite)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'invites');
      });
    } else {
      setActiveOrgMembers([]);
      setInvites([]);
    }

    const unsubSettings = onSnapshot(doc(db, 'userSettings', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings({
          sleepStart: data.sleepStart || '23:00',
          sleepEnd: data.sleepEnd || '07:00',
          morningRoutine: typeof data.morningRoutine === 'number' ? data.morningRoutine : 0,
          eveningRoutine: typeof data.eveningRoutine === 'number' ? data.eveningRoutine : 0,
          individualMode: !!data.individualMode,
          alarmEnabled: !!data.alarmEnabled,
          alarmTime: data.alarmTime || data.sleepEnd || '07:00',
          mainframeAnalyticsSubscription: !!data.mainframeAnalyticsSubscription
        });
        setHasProfile(true);
        localStorage.setItem(getProfileSetupKey(user.uid), 'true');
        setOnboardingError(null);
      } else {
        const hasLocalProfile = localStorage.getItem(getProfileSetupKey(user.uid)) === 'true';
        setHasProfile(profileSaveInFlight.current || hasLocalProfile);
      }
      setIsSettingsLoaded(true);
    }, (error) => {
      console.error("[FlowState] userSettings snapshot error:", error);
      setIsSettingsLoaded(true);
    });

    const unsubCheck = onSnapshot(query(collection(db, 'checkIns'), where('userId', '==', user.uid)), (snap) => {
      setCheckIns(snap.docs.map(d => d.data()));
    }, (error) => {
      console.error("[FlowState] checkIns snapshot error:", error);
    });

    return () => {
      unsubTasks();
      unsubMemberships();
      unsubActiveOrgMembers();
      unsubActiveOrgInvites();
      unsubSettings();
      unsubCheck();
    };
  }, [user, activeOrgId, isGuest]);

  useEffect(() => {
    if (memberships.length > 0) {
      const orgIds = Array.from(new Set(memberships.map(m => m.orgId)));
      const qOrgs = query(collection(db, 'organizations'), where(documentId(), 'in', orgIds));
      return onSnapshot(qOrgs, (snap) => {
        setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'organizations');
      });
    } else {
      setOrganizations([]);
    }
  }, [memberships]);

  // Handle Join & Invite Deep Links and Post-Auth LocalStorage Recovery
  useEffect(() => {
    const handleJoin = async () => {
      if (!user) return;
      if (!isMembershipsLoaded) return;
      
      const joinCode = urlParams.get('join') || localStorage.getItem('pending_join_code');
      const inviteToken = urlParams.get('invite') || localStorage.getItem('pending_invite_token');
      
      if (!joinCode && !inviteToken) return;
      if (isJoining || pendingJoinData) return;
      
      setIsJoining(true);
      try {
        console.log("[FlowState] [HANDLE_JOIN] Processing link/localStorage tokens:", { joinCode, inviteToken });
        let orgId: string | null = null;
        let orgName: string | null = null;
        let inviteId: string | null = null;
        let invitedName: string | null = null;
        let inviteAlreadyUsed = false;
        let invitedRole: 'admin' | 'worker' | undefined = undefined;
        let invitedJobTitle: string | undefined = undefined;

        if (inviteToken) {
          console.log("[FlowState] [HANDLE_JOIN] Verifying invite token:", inviteToken);
          const inviteRef = doc(db, 'invites', inviteToken);
          let inviteSnap = await getDoc(inviteRef);
          
          if (!inviteSnap.exists()) {
            console.log("[FlowState] [HANDLE_JOIN] Invite token not ID, searching via legacy collection query...");
            const inviteQ = query(collection(db, 'invites'), where('token', '==', inviteToken));
            const legacySnap = await getDocs(inviteQ);
            if (!legacySnap.empty) {
              inviteSnap = legacySnap.docs[0] as any;
            }
          }

          if (inviteSnap.exists()) {
            const inviteData = inviteSnap.data() as Invite;
            const expiresAt = (inviteData.expiresAt as any)?.toDate ? (inviteData.expiresAt as any).toDate() : new Date(inviteData.expiresAt as any);
            const isExpired = expiresAt && expiresAt < new Date();

            if (isExpired) {
              console.warn("[FlowState] [HANDLE_JOIN] Invite token has expired.");
              alert("This invite link has expired. Please ask for a new one.");
              localStorage.removeItem('pending_invite_token');
              window.history.replaceState({}, document.title, window.location.pathname);
              window.dispatchEvent(new Event('locationchange'));
              return;
            }

            inviteId = inviteSnap.id;
            orgId = inviteData.orgId;
            invitedName = inviteData.name;
            inviteAlreadyUsed = inviteData.status !== 'pending';
            invitedRole = inviteData.role;
            invitedJobTitle = inviteData.jobTitle;
            orgName = inviteData.orgName || (inviteData as any).orgName || null;
            
            if (!orgName && orgId) {
              try {
                const orgDoc = await getDoc(doc(db, 'organizations', orgId));
                if (orgDoc.exists()) orgName = orgDoc.data().name;
              } catch (err) {
                console.error("[FlowState] [HANDLE_JOIN] Failed to fetch organization info:", err);
              }
            }
            if (!orgName) orgName = "New Workspace";
          } else {
            console.warn("[FlowState] [HANDLE_JOIN] Invite token not found in FireStore:", inviteToken);
          }
        } else if (joinCode) {
          const normalizedJoinCode = normalizeWorkspaceCode(joinCode);
          console.log("[FlowState] [HANDLE_JOIN] Verifying join code:", normalizedJoinCode);
          const workspace = await resolveWorkspaceCode(normalizedJoinCode);
          if (workspace) {
            orgId = workspace.orgId;
            orgName = workspace.orgName;
          } else {
            console.warn("[FlowState] [HANDLE_JOIN] Join code not found:", normalizedJoinCode);
          }
        }

        if (orgId && orgName) {
          const exists = memberships.some(m => m.orgId === orgId);

          if (!exists) {
            if (inviteToken && inviteAlreadyUsed) {
              console.warn("[FlowState] [HANDLE_JOIN] Invite is no longer pending.");
              alert("This unique invite link has already been used by someone else.");
              localStorage.removeItem('pending_invite_token');
              window.history.replaceState({}, document.title, window.location.pathname);
              window.dispatchEvent(new Event('locationchange'));
              return;
            }

            console.log("[FlowState] [HANDLE_JOIN] Prompting registration modal.");
            setPendingJoinData({
              orgId,
              orgName,
              invitedName: invitedName || undefined,
              inviteId: inviteId || undefined,
              inviteToken: inviteToken || undefined,
              joinCode: joinCode || undefined,
              role: invitedRole,
              jobTitle: invitedJobTitle
            });
          } else {
            console.log("[FlowState] [HANDLE_JOIN] User already a member. Transitioning workspace view.");
            setActiveOrgId(orgId);
            localStorage.setItem('flowstate_active_org', orgId);
            alert(`Welcome back to ${orgName}!`);
            localStorage.removeItem('pending_join_code');
            localStorage.removeItem('pending_invite_token');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.dispatchEvent(new Event('locationchange'));
          }
        } else {
          console.error("[FlowState] [HANDLE_JOIN] Workspace verification failed.");
          if (inviteToken || joinCode) {
            alert("Sorry, that link is invalid, expired, or the workspace was deleted.");
            localStorage.removeItem('pending_join_code');
            localStorage.removeItem('pending_invite_token');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.dispatchEvent(new Event('locationchange'));
          }
        }
      } catch (err) {
        console.error("[FlowState] [HANDLE_JOIN] Global error during verification hook:", err);
      } finally {
        setIsJoining(false);
      }
    };
    handleJoin();
  }, [user, urlParams, isMembershipsLoaded, memberships]);

  const confirmJoin = async () => {
    if (!user || !pendingJoinData) return;
    setIsJoining(true); // Re-use isJoining for loading state
    try {
      const { orgId, orgName, invitedName, inviteId, inviteToken, role, jobTitle } = pendingJoinData;
      const membershipDocId = `${user.uid}_${orgId}`;
      
      console.log("[FlowState] Joining workspace:", orgName);
      await setDoc(doc(db, 'memberships', membershipDocId), {
        userId: user.uid,
        orgId: orgId,
        role: role || 'worker',
        name: invitedName || getMemberDisplayName('Team Member'),
        jobTitle: jobTitle || '',
        joinedAt: serverTimestamp()
      });
      
      if (inviteId && inviteToken) {
        await updateDoc(doc(db, 'invites', inviteId), { status: 'accepted' });
      }
      
      console.log("[FlowState] Successfully joined! Transitioning...");
      setJoinedOrgIds(prev => [...prev, orgId]);
      setActiveOrgId(orgId);
      localStorage.setItem('flowstate_active_org', orgId);
      setIsSidebarOpen(true); // Open sidebar so they see the workspace
      
      // Cleanup
      setPendingJoinData(null);
      setInviteInfo(null);
      localStorage.removeItem('pending_join_code');
      localStorage.removeItem('pending_invite_token');
      
      alert(`Welcome to ${orgName}! You have successfully joined the workspace.`);
      
      window.history.replaceState({}, document.title, window.location.pathname);
      window.dispatchEvent(new Event('locationchange'));
      
    } catch (e) {
      console.error("[FlowState] Join confirmation error:", e);
      alert("Failed to join workspace. Please try again.");
      setIsJoining(false);
    } finally {
      // Hold the joins flag for 3s to let memberships sync
      setTimeout(() => {
        setIsJoining(false);
      }, 3000);
    }
  };

  const declineJoin = async () => {
    if (pendingJoinData?.inviteId) {
      try {
        await updateDoc(doc(db, 'invites', pendingJoinData.inviteId), { status: 'declined' });
      } catch (e) {
        console.error("Failed to decline invite properly:", e);
      }
    }
    setPendingJoinData(null);
    localStorage.removeItem('pending_join_code');
    localStorage.removeItem('pending_invite_token');
    window.history.replaceState({}, document.title, window.location.pathname);
    window.dispatchEvent(new Event('locationchange'));
  };

  const createOrganization = async () => {
    const currentName = newOrgName.trim();
    const currentUser = auth.currentUser || user;

    if (!currentName) {
      setOrgError("Workspace name cannot be empty.");
      return;
    }

    if (isGuest) {
      setOrgError("Guest mode cannot create shared workspaces. Create or sign into a secure account first.");
      return;
    }
    
    if (!currentUser) {
      setOrgError("You must be authenticated to create a workspace.");
      return;
    }

    if (isCreatingOrg) {
      return;
    }
    
    setIsCreatingOrg(true);
    setOrgError(null);
    
    const safetyTimer = setTimeout(() => {
      setIsCreatingOrg(false);
      setOrgError("Handshake taking a while... please wait or refresh.");
    }, 15000);

    try {
      const orgId = doc(collection(db, 'organizations')).id;
      const membershipDocId = `${currentUser.uid}_${orgId}`;
      const code = generateWorkspaceCode();

      const optimisticOrg: Organization = {
        id: orgId,
        name: currentName,
        adminId: currentUser.uid,
        joinCode: code,
        joinCodeEnabled: true,
        workspaceAnalyticsSubscription: false,
        createdAt: serverTimestamp()
      };

      const optimisticMembership: any = {
        userId: currentUser.uid,
        orgId: orgId,
        role: 'admin',
        name: getMemberDisplayName('Team Owner'),
        jobTitle: 'Workspace Owner',
        joinedAt: serverTimestamp()
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'organizations', orgId), optimisticOrg);
      batch.set(doc(db, 'memberships', membershipDocId), optimisticMembership);
      batch.set(doc(db, 'workspaceCodes', code), {
        orgId,
        orgName: currentName,
        enabled: true,
        adminId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      await batch.commit();

      if (settings.individualMode) {
        await saveSettings({
          ...settings,
          individualMode: false
        });
      }

      setJoinedOrgIds(prev => prev.includes(orgId) ? prev : [...prev, orgId]);
      setActiveOrgId(orgId);
      localStorage.setItem('flowstate_active_org', orgId);
      setIsSidebarOpen(false);
      
      clearTimeout(safetyTimer);
      setIsCreatingOrg(false);
      setIsOrgModalOpen(false);
      setNewOrgName('');
      
      alert(`Workspace "${optimisticOrg.name}" created successfully!\n\nYour unique team join code is: ${code}\n\nYou can find, share, or manage this code at any time under settings.`);

    } catch (error: any) {
      clearTimeout(safetyTimer);
      setIsCreatingOrg(false);
      const errMsg = error.code ? `${error.code}: ${error.message}` : error.message || String(error);
      console.error("[FlowState] Workspace creation error:", error);
      setOrgError(errMsg || "Failed to create workspace");
      alert("Workspace creation failed: " + errMsg);
    }
  };

  const joinWorkspaceWithCode = async (code: string): Promise<{ success: boolean; error?: string; orgName?: string }> => {
    const trimmedCode = normalizeWorkspaceCode(code);
    if (!trimmedCode) return { success: false, error: "Please enter a valid workspace code." };
    if (!user) return { success: false, error: "You must be signed in to join a workspace." };

    try {
      const workspace = await resolveWorkspaceCode(trimmedCode);
      if (!workspace) {
        return { success: false, error: "The entered workspace code is invalid or does not exist." };
      }

      const orgId = workspace.orgId;
      const orgName = workspace.orgName;

      // Prevent duplicate memberships
      const membershipDocId = `${user.uid}_${orgId}`;
      const membershipRef = doc(db, 'memberships', membershipDocId);
      
      const alreadyMember = memberships.some(m => m.orgId === orgId);
      if (!alreadyMember) {
        await setDoc(membershipRef, {
          userId: user.uid,
          orgId: orgId,
          role: 'worker',
          name: getMemberDisplayName('Team Member'),
          jobTitle: 'Team Member',
          joinedAt: serverTimestamp()
        });
      }

      // Set active workspace
      setJoinedOrgIds(prev => prev.includes(orgId) ? prev : [...prev, orgId]);
      setActiveOrgId(orgId);
      localStorage.setItem('flowstate_active_org', orgId);

      // Disable individual mode if joining a workspace
      if (settings.individualMode) {
        await saveSettings({
          ...settings,
          individualMode: false
        });
      }

      return { success: true, orgName };
    } catch (e: any) {
      console.error("[FlowState] Error in joinWorkspaceWithCode:", e);
      const message = e.message || String(e);
      if (message.toLowerCase().includes('database') && message.toLowerCase().includes('not found')) {
        return { success: false, error: "Firebase Firestore is not created yet. Create the Firestore database in Firebase Console, then try the code again." };
      }
      if (e.code === 'permission-denied' || message.toLowerCase().includes('permission')) {
        return { success: false, error: "Firebase security rules are blocking workspace codes. Publish the updated Firestore rules, then try again." };
      }
      return { success: false, error: message || "An unexpected error occurred while joining the workspace." };
    }
  };

  const updateMembership = async () => {
    if (!editingMemberId || !user) return;
    try {
      await updateDoc(doc(db, 'memberships', editingMemberId), {
        name: editMemberName,
        jobTitle: editMemberTitle,
        role: editMemberRole
      });
      setEditingMemberId(null);
    } catch (e) {
      console.error(e);
    }
  };

  const createInvite = async () => {
    const inviteEmail = newInviteEmail.trim().toLowerCase();
    if (!activeOrgId || !newInviteName.trim() || isCreatingInvite || !user) return;
    if (inviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      alert("Please enter a valid email address for the invite.");
      return;
    }
    setIsCreatingInvite(true);
    
    // Fail-safe timeout for invite creation
    const inviteTimer = setTimeout(() => setIsCreatingInvite(false), 10000);

    try {
      let org = organizations.find(o => o.id === activeOrgId);
      
      if (!org && activeOrgId) {
        const orgDoc = await getDoc(doc(db, 'organizations', activeOrgId));
        if (orgDoc.exists()) {
          org = { id: orgDoc.id, ...orgDoc.data() } as Organization;
        }
      }

      if (!org) throw new Error("Workspace not found. Please wait for workspaces to load.");

      const inviteToken = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID().split('-')[0] // Shorter but still unique enough for doc ID + index
        : Math.random().toString(36).substring(2, 8);
      
      const inviteData = {
        orgId: activeOrgId,
        orgName: org.name,
        name: newInviteName.trim(),
        email: inviteEmail || null,
        token: inviteToken,
        status: 'pending',
        invitedBy: user.uid,
        role: newInviteRole,
        jobTitle: newInviteJobTitle.trim(),
        expiresAt: addDays(new Date(), 7), 
        createdAt: serverTimestamp()
      };

      // Use token as the document ID for direct access without generic list permissions
      await setDoc(doc(db, 'invites', inviteToken), inviteData);
      
      const link = buildAppLink({ invite: inviteToken });
      setLastCreatedLink(link);

      let emailResult: { sent: boolean; mailtoUrl?: string; reason?: string } | null = null;
      if (inviteEmail) {
        emailResult = await sendInviteEmail({
          email: inviteEmail,
          name: inviteData.name,
          orgName: inviteData.orgName,
          inviteLink: link,
          role: inviteData.role,
          jobTitle: inviteData.jobTitle,
        });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(link);
      }

      setNewInviteName('');
      setNewInviteEmail('');
      setNewInviteRole('worker');
      setNewInviteJobTitle('');

      if (emailResult?.sent) {
        alert(`Invite email sent to ${inviteEmail}.`);
      } else if (emailResult?.mailtoUrl) {
        alert(`Invite created. Your email app was opened because no server email provider is configured yet.`);
      } else {
        alert(`Invite created. The link was copied to your clipboard:\n\n${link}`);
      }
    } catch (e: any) {
      console.error("[FlowState] Invite error:", e);
      alert(e.message || "Failed to create invite. Make sure you are an admin.");
    } finally {
      clearTimeout(inviteTimer);
      setIsCreatingInvite(false);
    }
  };

  const deleteInvite = async (inviteId: string) => {
    if (!inviteId) return;
    try {
      await deleteDoc(doc(db, 'invites', inviteId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateOrgName = async (newName: string) => {
    if (!activeOrgId || !newName.trim()) return;
    try {
      await updateDoc(doc(db, 'organizations', activeOrgId), {
        name: newName.trim()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const sendInviteEmail = async (invite: {
    email: string;
    name: string;
    orgName: string;
    inviteLink: string;
    role: 'admin' | 'worker';
    jobTitle?: string;
  }) => {
    const response = await fetch('/api/send-invite-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || 'Invite email could not be sent.');
    }

    if (result.mailtoUrl) {
      window.open(result.mailtoUrl, '_blank');
    }

    return result as { sent: boolean; mailtoUrl?: string; reason?: string };
  };

  // Derived State
  const scheduleResult = useMemo(() => {
    const d = parse(selectedDate, 'yyyy-MM-dd', new Date());
    
    // Robust date filtering and workspace isolation using the isDateMatch helper
    let dayTasks = activeTasks.filter(t => {
      const taskOrgId = t.orgId || null;
      return isDateMatch(t.date, selectedDate) && taskOrgId === (activeOrgId || null);
    });
    
    // Filter by worker if one is selected in team mode
    if (activeOrgId && selectedWorkerId) {
      dayTasks = dayTasks.filter(t => t.workerId === selectedWorkerId);
    }
    
    return generateDailySchedule(dayTasks, activeSettings, d);
  }, [activeTasks, activeSettings, selectedDate, activeOrgId, selectedWorkerId]);

  const sleepStartToday = useMemo(() => parse(activeSettings.sleepStart, 'HH:mm', now), [activeSettings.sleepStart, now]);
  const minutesUntilSleep = useMemo(() => Math.floor((sleepStartToday.getTime() - now.getTime()) / 60000), [sleepStartToday, now]);
  const isInWindDown = useMemo(() => isTodayStatus && minutesUntilSleep > 0 && minutesUntilSleep <= 90, [isTodayStatus, minutesUntilSleep]);

  const flow = useMemo(() => ({
    scheduled: scheduleResult.schedule,
    overflow: scheduleResult.overflow
  }), [scheduleResult]);

  useEffect(() => {
    if (!notificationsEnabled || !isTodayStatus) return;

    const interval = setInterval(() => {
      const currentTime = new Date();
      if (activeSettings.alarmEnabled && activeSettings.alarmTime) {
        const alarmTime = parse(activeSettings.alarmTime, 'HH:mm', selectedDate);
        const alarmId = `alarm-${selectedDate}-${activeSettings.alarmTime}`;
        if (
          currentTime >= alarmTime &&
          currentTime < new Date(alarmTime.getTime() + 60000) &&
          !sentNotifications.current.has(alarmId)
        ) {
          new Notification('FlowState Alarm', {
            body: 'Time to wake up and start your flow.',
            tag: 'flowstate-wake-alarm',
            icon: '/icon-192x192.png'
          });
          sentNotifications.current.add(alarmId);
        }
      }
      
      flow.scheduled.forEach((item) => {
        if (item.type !== 'task' || !item.task) return;

        // Strictly verify that this task belongs to the CURRENT user if in an org context
        // and that it matches the active workspace to prevent cross-workspace notifications in multi-tabs
        const taskOrgId = item.task.orgId || null;
        if (activeOrgId !== taskOrgId) return;
        
        // If it's a team task, only notify if assigned to us
        if (activeOrgId && item.task.workerId && item.task.workerId !== user?.uid) return;

        // Notification for task start (5 minutes before)
        const fiveMinsBeforeStart = new Date(item.start.getTime() - 5 * 60000);
        if (currentTime >= fiveMinsBeforeStart && currentTime < item.start) {
          const id = `start-${item.task.id}-${item.start.getTime()}`;
          if (!sentNotifications.current.has(id)) {
            const orgTitle = showWorkspaceContext ? (organizations.find(o => o.id === activeOrgId)?.name || 'Workspace') : 'Personal';
            new Notification(`[${orgTitle}] Upcoming: ${item.task.title}`, {
              body: `Starts at ${format(item.start, 'HH:mm')}. Get ready!`,
              tag: 'flowstate-task-start',
              icon: '/icon-192x192.png'
            });
            sentNotifications.current.add(id);
          }
        }

        // Notification for task end (exactly at end)
        const endTime = new Date(item.end.getTime());
        if (currentTime >= endTime && currentTime < new Date(item.end.getTime() + 60000)) {
          const id = `end-${item.task.id}-${item.end.getTime()}`;
          if (!sentNotifications.current.has(id)) {
             const orgTitle = showWorkspaceContext ? (organizations.find(o => o.id === activeOrgId)?.name || 'Workspace') : 'Personal';
             new Notification(`[${orgTitle}] Time's up: ${item.task.title}`, {
              body: `Take a beat. Check your next flow item.`,
              tag: 'flowstate-task-end',
              icon: '/icon-192x192.png'
            });
            sentNotifications.current.add(id);
          }
        }
      });
    }, 30000); 

    return () => clearInterval(interval);
  }, [notificationsEnabled, flow.scheduled, isTodayStatus, activeOrgId, user?.uid, organizations, showWorkspaceContext, activeSettings.alarmEnabled, activeSettings.alarmTime, selectedDate]);
  
  const flowTime = useMemo(() => activeTasks.filter(t => t.status === 'complete').reduce((acc, t) => acc + t.duration, 0), [activeTasks]);
  
  const flowScore = useMemo(() => {
    const todayTasks = activeTasks.filter(t => isDateMatch(t.date, selectedDate));
    if (todayTasks.length === 0) return 0;
    const totalPotential = todayTasks.reduce((acc, t) => acc + (4 - (t.priority || 2)), 0);
    const completedScore = todayTasks.filter(t => t.status === 'complete').reduce((acc, t) => acc + (4 - (t.priority || 2)), 0);
    return totalPotential > 0 ? Math.round((completedScore / totalPotential) * 100) : 0;
  }, [activeTasks, selectedDate]);

  const capitalize = (str: string) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const formatTaskAcknowledgement = (taskList: any[]) => {
    const titles = taskList
      .map(task => capitalize(String(task.title || 'Untitled Task').slice(0, 40)))
      .filter(Boolean);
    if (titles.length === 0) return 'Tasks acknowledged. Planning your day...';
    if (titles.length <= 3) return `Acknowledged: ${titles.join(', ')}. Planning around your day...`;
    return `Acknowledged ${titles.length} tasks: ${titles.slice(0, 3).join(', ')} +${titles.length - 3} more. Planning around your day...`;
  };

  const isGenericWorkScheduleInput = (task: any) => {
    const title = String(task.title || '').trim().toLowerCase();
    const description = String(task.description || '').trim().toLowerCase();
    const text = `${title} ${description}`.trim();
    const looksLikeWorkBlock =
      task.source === 'workSchedule' ||
      /^(work|job|shift|work shift|my shift|clock in|clock out)$/i.test(title) ||
      /\b(work schedule|work shift|my shift|scheduled shift|clock in|clock out)\b/i.test(text) ||
      /\bwork\s+(from|until|to|at)\b/i.test(text);
    const looksLikeSpecificTask =
      /\b(email|call|meeting|client|report|presentation|project|code|coding|debug|invoice|quote|proposal|paperwork|follow up|follow-up)\b/i.test(text);

    return looksLikeWorkBlock && !looksLikeSpecificTask;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (parseError) setParseError(null);
    if (parsingStatus && !isParsing) setParsingStatus(null);
  };

  const handleInputFocus = () => {
    if (parsingStatus && !isParsing) setParsingStatus(null);
  };

  const minutesFromTimeRange = (start: string, end: string) => {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (minutes <= 0) minutes += 24 * 60;
    return Math.max(15, Math.min(720, minutes));
  };

  const handleCreateWorkSchedule = async () => {
    if (!user && !isGuest) {
      setIsGuest(true);
      localStorage.setItem('flowstate_guest', 'true');
    }

    const effectiveIsGuest = isGuest || !user;
    const customWeeks = [workWeekA, workWeekB, workWeekC, workWeekD];
    const weeksToCreate = workScheduleMode === 'custom4' ? 4 : Math.max(1, Math.min(12, workScheduleWeeks || 1));
    const baseDate = parse(selectedDate, 'yyyy-MM-dd', new Date());
    const baseWeekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
    const scheduleName = (workScheduleName || 'Work').trim();
    const workBlocks: any[] = [];

    for (let weekOffset = 0; weekOffset < weeksToCreate; weekOffset++) {
      const weekForm = workScheduleMode === 'custom4'
        ? customWeeks[weekOffset]
        : workScheduleMode === 'alternating' && weekOffset % 2 === 1
          ? workWeekB
          : workWeekA;
      const duration = minutesFromTimeRange(weekForm.start, weekForm.end);

      weekForm.days.forEach(dayIndex => {
        const date = format(addDays(baseWeekStart, weekOffset * 7 + dayIndex), 'yyyy-MM-dd');
        const alreadyExists = activeTasks.some(task => {
          const taskOrgId = task.orgId || null;
          return task.title === scheduleName &&
            task.date === date &&
            task.fixedTime === weekForm.start &&
            taskOrgId === (activeOrgId || null);
        });

        if (!alreadyExists) {
          workBlocks.push({
            title: scheduleName,
            description: workScheduleMode === 'alternating'
              ? `Alternating week ${weekOffset % 2 === 0 ? 'A' : 'B'} work schedule`
              : workScheduleMode === 'custom4'
                ? `Custom week ${weekOffset + 1} work schedule`
              : 'Consistent weekly work schedule',
            duration,
            domain: 'Work',
            priority: 1,
            fixedTime: weekForm.start,
            source: 'workSchedule',
            status: 'pending',
            date,
            userId: user?.uid || 'guest',
            workerId: activeOrgId ? (user?.uid || null) : null,
            orgId: activeOrgId || null,
          });
        }
      });
    }

    if (workBlocks.length === 0) {
      alert('Those work blocks are already on your calendar.');
      return;
    }

    try {
      if (effectiveIsGuest) {
        setGuestTasks(prev => [
          ...prev,
          ...workBlocks.map(block => ({
            id: Math.random().toString(36).slice(2, 11),
            ...block,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        ]);
      } else {
        const batches: any[] = [];
        for (let i = 0; i < workBlocks.length; i += 500) {
          const batch = writeBatch(db);
          workBlocks.slice(i, i + 500).forEach(block => {
            const newDocRef = doc(collection(db, 'tasks'));
            batch.set(newDocRef, {
              ...block,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          batches.push(batch.commit());
        }
        await Promise.all(batches);
      }

      setIsWorkScheduleOpen(false);
      setParsingStatus(`Added ${workBlocks.length} work block${workBlocks.length === 1 ? '' : 's'} to your calendar.`);
      setTimeout(() => setParsingStatus(null), 2500);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'work schedule');
    }
  };

  // Actions
  const handleParse = async () => {
    if (!inputText.trim() || isParsing) return;
    setParseError(null);
    setParsingStatus("FlowState is reading your mind...");
    
    let effectiveIsGuest = isGuest;
    // Auto-enable guest mode if not logged in
    if (!user && !isGuest) {
      setIsGuest(true);
      localStorage.setItem('flowstate_guest', 'true');
      effectiveIsGuest = true;
    }

    setIsParsing(true);
    try {
      console.log("[FlowState] Starting parse for:", inputText.slice(0, 100));
      const response = await parseTask(inputText, selectedDate);
      
      // Defensively extract tasks
      let tasksFromServer: any[] = [];
      if (Array.isArray(response)) {
        tasksFromServer = response;
      } else if (response && Array.isArray(response.tasks)) {
        tasksFromServer = response.tasks;
      } else if (response && response.error) {
        throw new Error(response.error);
      }
      
      if (tasksFromServer.length === 0) {
        setParseError("Could not identify any tasks. Try listing them clearly (e.g., '9am Meeting, 10am Code').");
        setIsParsing(false);
        setParsingStatus(null);
        return;
      }

      // Success in parsing - clear input early to provide immediate "accepted" feedback
      setInputText("");
      setIsParsing(false);
      setParsingStatus(formatTaskAcknowledgement(tasksFromServer));
      
      // Determine target dates
      const baseDate = parse(selectedDate, 'yyyy-MM-dd', new Date());
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 0 });
      const dayOfWeekDates = selectedAddDays.map(dayIndex => format(addDays(weekStart, dayIndex), 'yyyy-MM-dd'));
      
      // Filter out any non-string junk that might have crept into UI state
      const validAddDates = selectedAddDates.filter(d => typeof d === 'string' && d.includes('-'));
      const combinedTargetDates = Array.from(new Set([...dayOfWeekDates, ...validAddDates]));
      const uiTargetDates = combinedTargetDates.length > 0 ? combinedTargetDates : [selectedDate];

      const newGuestTasks: Task[] = [];
      const firestoreTasks: any[] = [];
      const assignmentTargets = getTaskAssignmentTargets();
      let autoWorkScheduleCount = 0;
      let skippedUntimedWorkCount = 0;

      for (const t of tasksFromServer) {
        // If Gemini provided a date that is DIFFERENT from the reference date, 
        // we assume the user specifically meant that day, so we don't duplicate it.
        const hasSpecificDate = t.date && !isDateMatch(t.date, selectedDate);
        const taskDates = hasSpecificDate ? [t.date] : uiTargetDates;
        const genericWorkScheduleInput = isGenericWorkScheduleInput(t);
        const hasUsableWorkScheduleTime = !!t.fixedTime && Math.floor(Math.max(1, Math.min(480, Number(t.duration) || 30))) >= 60;

        if (genericWorkScheduleInput && !hasUsableWorkScheduleTime) {
          skippedUntimedWorkCount += taskDates.length * assignmentTargets.length;
          continue;
        }

        for (const date of taskDates) {
          for (const assignmentTarget of assignmentTargets) {
            const isAutoWorkSchedule = genericWorkScheduleInput && hasUsableWorkScheduleTime;
            const taskData: any = {
              title: isAutoWorkSchedule ? capitalize(String(t.title || 'Work').slice(0, 100)) : capitalize(String(t.title || "Untitled Task").slice(0, 100)),
              description: isAutoWorkSchedule
                ? [t.description ? String(t.description).slice(0, 900) : null, 'Auto-added to Work Schedule from timed work input.'].filter(Boolean).join(' ')
                : t.description ? String(t.description).slice(0, 1000) : null,
              duration: Math.floor(Math.max(1, Math.min(480, Number(t.duration) || 30))),
              domain: isAutoWorkSchedule ? 'Work' : String(t.domain || 'Work'),
              priority: Math.min(3, Math.max(1, Number(t.priority) || 2)),
              fixedTime: t.fixedTime || null,
              source: isAutoWorkSchedule ? 'workSchedule' : t.source || null,
              status: 'pending',
              date: String(date),
              userId: user?.uid || 'guest',
              workerId: activeOrgId ? assignmentTarget : null,
              orgId: activeOrgId || null,
            };

            if (isAutoWorkSchedule) {
              autoWorkScheduleCount += 1;
            }

            if (effectiveIsGuest) {
              newGuestTasks.push({ 
                id: Math.random().toString(36).substr(2, 9), 
                ...taskData,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            } else {
              firestoreTasks.push(taskData);
            }
          }
        }
      }

      if (effectiveIsGuest) {
        setGuestTasks(prev => [...prev, ...newGuestTasks]);
      } else if (firestoreTasks.length > 0) {
        setParsingStatus(`Syncing...`);
        // Prepare batches
        const batches: any[] = [];
        for (let i = 0; i < firestoreTasks.length; i += 500) {
          const chunk = firestoreTasks.slice(i, i + 500);
          const batch = writeBatch(db);
          chunk.forEach(task => {
            const newDocRef = doc(collection(db, 'tasks'));
            batch.set(newDocRef, {
              ...task,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
          batches.push(batch.commit());
        }
        
        // Execute all batches in parallel
        await Promise.all(batches);
      }

      // Snappy Reset remains here for other fields, but inputText is already cleared
      setSelectedAddDays([]);
      setSelectedAddDates([]);
      setParseError(null);
      const addedCount = newGuestTasks.length + firestoreTasks.length;
      if (addedCount === 0 && skippedUntimedWorkCount > 0) {
        setParsingStatus('Work was not added because no start and end time were included. Tap Work Schedule, or type something like "Work 9am-5pm".');
      } else {
        const statusParts = [`Added ${addedCount} item${addedCount === 1 ? '' : 's'} and rebuilt the day plan.`];
        if (autoWorkScheduleCount > 0) {
          statusParts.push(`Converted ${autoWorkScheduleCount} timed work block${autoWorkScheduleCount === 1 ? '' : 's'} into Work Schedule.`);
        }
        if (skippedUntimedWorkCount > 0) {
          statusParts.push(`Skipped ${skippedUntimedWorkCount} untimed work item${skippedUntimedWorkCount === 1 ? '' : 's'}; use Work Schedule or include start and end times.`);
        }
        setParsingStatus(statusParts.join(' '));
      }
      
      // Auto-clear message and focus
      setTimeout(() => {
        setParsingStatus(prev => prev?.startsWith('Added ') ? null : prev);
      }, skippedUntimedWorkCount > 0 ? 6000 : 3000);
      
      // Force focus
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } catch (err: any) {
      console.error("Parse Error:", err);
      const is503 = err.message?.includes('503') || err.message?.includes('UNAVAILABLE');
      const msg = is503 
        ? "Gemini is overwhelmed right now. Please try again in 1 minute or with a shorter list." 
        : (err.message || "Failed to process tasks");
      setParseError(msg);
      setParsingStatus(null);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!user && !isGuest) return;
    const becomingComplete = currentStatus !== 'complete';
    
    if (becomingComplete) {
      setRecentCompletions(prev => ({ ...prev, [taskId]: Date.now() }));
    } else {
      setRecentCompletions(prev => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }

    if (isGuest) {
      setGuestTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: becomingComplete ? 'complete' : 'pending', updatedAt: Date.now() } : t));
    } else {
      try {
        await updateDoc(doc(db, 'tasks', taskId), {
          status: becomingComplete ? 'complete' : 'pending',
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      }
    }
  };

  const exchangeTask = async (activeTask: Task, overflowTask: Task) => {
    if (!user && !isGuest) return;
    
    // Calculate new priorities. 
    // To ensure a definite swap even if priorities are the same, 
    // we give the overflow task a tiny boost if needed.
    let pNewActive = overflowTask.priority;
    let pNewOverflow = activeTask.priority;

    if (pNewActive === pNewOverflow) {
      // If they are equal, give the one moving into the schedule a cumulative boost
      // We aim for 0.1 increments to avoid precision issues for a while
      pNewActive = Math.max(1, pNewActive - 0.1);
      pNewOverflow = Math.min(3, pNewOverflow + 0.1);
    }

    if (isGuest) {
      setGuestTasks(prev => prev.map(t => {
        if (t.id === activeTask.id) return { ...t, priority: pNewOverflow, updatedAt: Date.now() };
        if (t.id === overflowTask.id) return { ...t, priority: pNewActive, updatedAt: Date.now() };
        return t;
      }));
    } else {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'tasks', activeTask.id), {
          priority: pNewOverflow,
          updatedAt: serverTimestamp()
        });
        batch.update(doc(db, 'tasks', overflowTask.id), {
          priority: pNewActive,
          updatedAt: serverTimestamp()
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks`);
      }
    }
  };

  const promoteTask = async (overflowTask: Task) => {
    // 1. Try to find a task with EXPLICITLY lower priority first (higher number)
    let target = flow.scheduled.find(item => 
      item.type === 'task' && 
      item.task && 
      item.task.priority > overflowTask.priority
    );
    
    // 2. If no lower priority task, find first task with EQUAL priority
    if (!target) {
      target = flow.scheduled.find(item => 
        item.type === 'task' && 
        item.task && 
        item.task.priority === overflowTask.priority
      );
    }
    
    if (target?.task) {
      await exchangeTask(target.task, overflowTask);
    } else {
      // If no candidate for exchange (e.g. all scheduled tasks are already higher priority),
      // strictly push this one to High Priority (1)
      if (isGuest) {
        setGuestTasks(prev => prev.map(t => t.id === overflowTask.id ? { ...t, priority: 1, updatedAt: Date.now() } : t));
      } else {
        await updateDoc(doc(db, 'tasks', overflowTask.id), { priority: 1, updatedAt: serverTimestamp() });
      }
    }
  };

  const splitTask = async (task: Task) => {
    if (!user && !isGuest) return;
    if (task.duration < 10) return;

    const halfDuration = Math.floor(task.duration / 2);
    const remainingDuration = task.duration - halfDuration;

    if (isGuest) {
      const newId = Math.random().toString(36).substr(2, 9);
      const newTask: Task = {
         id: newId,
         title: `${task.title} (Part 2)`,
         duration: remainingDuration,
         domain: task.domain,
         priority: task.priority,
         status: 'pending',
         date: task.date,
         userId: 'guest',
         createdAt: Date.now(),
         updatedAt: Date.now(),
      };

      setGuestTasks(prev => {
        const updated = prev.map(t => {
          if (t.id === task.id) return { ...t, duration: halfDuration, updatedAt: Date.now() };
          return t;
        });
        return [...updated, newTask];
      });
    } else {
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'tasks', task.id), {
          duration: halfDuration,
          updatedAt: serverTimestamp()
        });

        const newTaskRef = doc(collection(db, 'tasks'));
        batch.set(newTaskRef, {
          userId: user!.uid,
          orgId: activeOrgId || null,
          workerId: task.workerId || null,
          title: `${task.title} (Part 2)`,
          duration: remainingDuration,
          domain: task.domain,
          priority: task.priority,
          status: 'pending',
          date: task.date,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `tasks`);
      }
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user && !isGuest) return;
    if (isGuest) {
      setGuestTasks(prev => prev.filter(t => t.id !== taskId));
    } else {
      try {
         await deleteDoc(doc(db, 'tasks', taskId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
      }
    }
  };

  const clearAllTasks = async () => {
    if (!user && !isGuest) return;
    if (isGuest) {
      setGuestTasks(prev => prev.filter(t => !isDateMatch(t.date, selectedDate)));
    } else {
      try {
        let todayTasks = tasks.filter(t => isDateMatch(t.date, selectedDate));
        
        // If we are in an org and a worker is selected, only clear those tasks
        if (activeOrgId && selectedWorkerId) {
          todayTasks = todayTasks.filter(t => t.workerId === selectedWorkerId);
        }

        const batch = writeBatch(db);
        todayTasks.forEach(t => {
          batch.delete(doc(db, 'tasks', t.id));
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `tasks`);
      }
    }
  };

  const logCheckIn = async (mood: number, energy: number) => {
    if (!user && !isGuest) return;
    if (isGuest) {
      setGuestCheckIns(prev => {
        const filtered = prev.filter(c => c.date !== selectedDate);
        return [...filtered, { date: selectedDate, mood, energy, userId: 'guest', createdAt: Date.now() }];
      });
    } else {
      try {
        await setDoc(doc(db, 'checkIns', selectedDate), {
          date: selectedDate,
          mood,
          energy,
          userId: user!.uid,
          createdAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `checkIns/${selectedDate}`);
      }
    }
  };

  const saveSettings = async (newSettings: UserSettings) => {
    if (!user && !isGuest) return;
    if (isGuest) {
      setGuestSettings(prev => ({ ...prev, ...newSettings }));
      setIsEditingSleep(false);
    } else {
      const normalizedSettings = {
        ...settings,
        ...newSettings
      };
      setSettings(normalizedSettings);
      setHasProfile(true);
      profileSaveInFlight.current = true;
      localStorage.setItem(getProfileSetupKey(user!.uid), 'true');
      try {
        await setDoc(doc(db, 'userSettings', user!.uid), {
          ...normalizedSettings,
          updatedAt: serverTimestamp()
        });
        setIsEditingSleep(false);
      } catch (error) {
        localStorage.removeItem(getProfileSetupKey(user!.uid));
        setHasProfile(false);
        handleFirestoreError(error, OperationType.WRITE, `userSettings/${user!.uid}`);
      } finally {
        profileSaveInFlight.current = false;
      }
    }
  };

  const isAuthOrStateLoading = loading || (user && !isGuest && (!isMembershipsLoaded || !isSettingsLoaded));

  useEffect(() => {
    if (handledPaymentReturnRef.current || loading) return;
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    if (!paymentStatus) return;

    handledPaymentReturnRef.current = true;
    const scope = params.get('payment_scope') === 'workspace' ? 'workspace analytics' : 'mainframe analytics';
    const sessionId = params.get('session_id');
    const cleanupPaymentParams = () => {
      params.delete('payment');
      params.delete('payment_scope');
      params.delete('session_id');
      const nextQuery = params.toString();
      window.history.replaceState({}, document.title, `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`);
    };

    const confirmPayment = async () => {
      if (paymentStatus === 'cancelled') {
        window.alert(`Stripe checkout was cancelled. ${scope} is still locked.`);
        cleanupPaymentParams();
        return;
      }

      if (paymentStatus !== 'success') {
        cleanupPaymentParams();
        return;
      }

      if (!user || isGuest || !sessionId) {
        window.alert(`Stripe returned successfully, but FlowState needs you signed in to confirm ${scope}.`);
        cleanupPaymentParams();
        return;
      }

      try {
        setPaymentLoadingScope(params.get('payment_scope') === 'workspace' ? 'workspace' : 'mainframe');
        const response = await fetch('/api/confirm-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            idToken: await user.getIdToken(),
          }),
        });
        const data = await response.json().catch(() => ({} as { error?: string }));
        if (!response.ok) {
          throw new Error(data.error || 'Stripe payment confirmation failed.');
        }
        window.alert(`Payment confirmed. ${scope} is active.`);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : 'Stripe payment confirmation failed.');
      } finally {
        setPaymentLoadingScope(null);
        cleanupPaymentParams();
      }
    };

    void confirmPayment();
  }, [loading, user, isGuest]);

  const requestAnalyticsPayment = async (scope: 'mainframe' | 'workspace') => {
    if (!user || isGuest) {
      window.alert('Sign in with an email account before starting a paid subscription.');
      return;
    }

    if (scope === 'workspace') {
      if (!activeOrgId) {
        window.alert('Open a workspace before starting workspace analytics.');
        return;
      }
      if (currentMembership?.role !== 'admin') {
        window.alert('Only workspace admins can start workspace analytics billing.');
        return;
      }
    }

    try {
      setPaymentLoadingScope(scope);
      const cleanReturnUrl = new URL(window.location.href);
      cleanReturnUrl.searchParams.delete('payment');
      cleanReturnUrl.searchParams.delete('payment_scope');
      cleanReturnUrl.searchParams.delete('session_id');

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          orgId: scope === 'workspace' ? activeOrgId : undefined,
          idToken: await user.getIdToken(),
          returnUrl: cleanReturnUrl.toString(),
        }),
      });
      const data = await response.json().catch(() => ({} as { error?: string; url?: string }));

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Unable to start Stripe Checkout.');
      }

      window.location.assign(data.url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to start Stripe Checkout.');
    } finally {
      setPaymentLoadingScope(null);
    }
  };

  const AnalyticsSubscriptionGate = ({
    scope,
    canActivate = true,
  }: {
    scope: 'mainframe' | 'workspace';
    canActivate?: boolean;
  }) => {
    const plan = ANALYTICS_PLANS[scope];
    const workspaceMemberCount = Math.max(1, activeOrgMembers.length || 1);
    const workspacePrice = formatMonthlyPrice(getWorkspaceAnalyticsPriceCents(workspaceMemberCount));
    const displayPrice = scope === 'workspace' ? workspacePrice : plan.price;
    const tierLabel = scope === 'workspace' ? getWorkspaceAnalyticsTierLabel(workspaceMemberCount) : null;
    const isOpeningCheckout = paymentLoadingScope === scope;

    return (
    <div className="w-full max-w-3xl mx-auto mt-8 bg-white rounded-[2.5rem] border-[0.5px] border-slate-100 shadow-2xl shadow-slate-100 p-5 sm:p-8 lg:p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      <div className="w-14 h-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center mx-auto mb-5 shadow-xl">
        <BarChart3 size={24} />
      </div>
      <h2 className="text-2xl font-elegant italic font-black text-ink mb-2">
        {plan.title}
      </h2>
      <p className="text-xs text-dove font-bold uppercase tracking-widest leading-relaxed max-w-xl mx-auto mb-6">
        {scope === 'mainframe'
          ? 'Unlock personal trend charts, focus velocity, life balance, and biological velocity.'
          : 'Unlock reports and analytics for this workspace only. The rest of the workspace stays open.'}
      </p>
      <div className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-1">Subscription Payment</p>
        <p className="text-3xl font-black text-slate-950 leading-none">{displayPrice}</p>
        {tierLabel && (
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mt-2">
            {tierLabel}
          </p>
        )}
        <p className="text-[10px] font-bold text-emerald-800/70 mt-2 leading-relaxed">{plan.description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-7">
        {[
          ['Focus Trends', 'See momentum across days'],
          ['Balance Reports', 'Compare time by domain'],
          ['Team Signals', scope === 'workspace' ? 'Workspace-level reporting' : 'Personal performance view']
        ].map(([title, body]) => (
          <div key={title} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-1">{title}</p>
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void requestAnalyticsPayment(scope)}
        disabled={!canActivate || isOpeningCheckout}
        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-40"
      >
        {isOpeningCheckout ? 'Opening Stripe Checkout...' : canActivate ? `Subscribe ${displayPrice}` : 'Admin Required'}
      </button>
    </div>
    );
  };

  if (isAuthOrStateLoading) return (
    <div className="safe-screen w-full flex items-center justify-center bg-soft-purple">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
      >
        <RefreshCw className="text-mint w-8 h-8" />
      </motion.div>
    </div>
  );

  if (!user && !isGuest) return (
    <div className="safe-screen fit-screen flex flex-col items-center justify-start sm:justify-center bg-soft-purple px-3 min-[380px]:px-4 sm:px-6 py-3 min-[380px]:py-5 sm:py-8 lg:py-10 relative overflow-y-auto">
      <DashboardPreview />
      
      {/* Refined Glass Card - Light Version */}
      <div className="relative z-10 w-full max-w-md bg-white/70 backdrop-blur-3xl border border-white/30 rounded-[2rem] sm:rounded-[3rem] p-4 min-[380px]:p-5 sm:p-8 lg:p-10 shadow-2xl shadow-slate-200/50 flex flex-col items-center text-center animate-in fade-in zoom-in duration-1000">
        
        {/* Subtle Branding */}
        <div className="mb-5 sm:mb-8 lg:mb-10 text-slate-900">
          <div className="relative inline-block">
            <img src="/logo.png" alt="FlowState Logo" className="block mx-auto w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 mb-4 sm:mb-6 drop-shadow-xl rounded-[1.5rem] sm:rounded-[2rem] border-2 border-white object-cover object-center" />
            <motion.div 
              className="absolute -inset-2 bg-mint/30 blur-xl rounded-full -z-10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-sans font-bold tracking-tight mb-2">FlowState</h1>
          <p className="text-emerald-600/80 font-black tracking-wide uppercase text-xs">Precision Day Planning</p>
        </div>

        {/* Tagline Section */}
        {inviteInfo ? (
          <div className="mb-8 lg:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-emerald-100 mx-auto">
               <Users size={12} />
               <span>Invitation Active</span>
             </div>
             <h2 className="text-2xl font-black text-ink mb-1">Welcome, {inviteInfo.invitedName}</h2>
             <p className="text-slate-500 font-medium text-sm">You've been invited to join <span className="font-bold text-emerald-600">"{inviteInfo.orgName}"</span></p>
             <p className="text-[10px] text-dove mt-4 uppercase tracking-[0.2em] font-black opacity-40">Sign in to confirm your spot</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3 lg:space-y-4 mb-5 sm:mb-8 lg:mb-12 text-slate-600">
            <p className="text-sm sm:text-base lg:text-xl font-bold leading-tight">
              The easiest way to plan your day.
            </p>
            <div className="h-px w-12 bg-slate-200 mx-auto" />
            <p className="text-[11px] sm:text-xs lg:text-sm italic font-medium">
              "We do the math, you do the work."
            </p>
          </div>
        )}

        {/* Account Form */}
        <div className="w-full space-y-2.5 sm:space-y-3">
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setAuthError(null);
              }}
              className={cn(
                "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                authMode === 'signin' ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
              className={cn(
                "h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                authMode === 'signup' ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-2 text-left">
            {authMode === 'signup' && (
              <input
                type="text"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className="w-full h-11 sm:h-12 bg-white/90 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-mint/10"
              />
            )}
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="w-full h-11 sm:h-12 bg-white/90 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-mint/10"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full h-11 sm:h-12 bg-white/90 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-mint/10"
            />
            {authError && (
              <p className="text-[10px] font-black text-rose-500 leading-relaxed px-1">{authError}</p>
            )}
            <Button
              type="submit"
              disabled={isEmailAuthLoading}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] h-12 sm:h-14 rounded-2xl font-black transition-all shadow-md border border-slate-800"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isEmailAuthLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-mint" />
                    Securing Account
                  </>
                ) : authMode === 'signup' ? (
                  "Create Secure Account"
                ) : (
                  "Sign In Securely"
                )}
              </span>
            </Button>
          </form>

          {!isMobileShell && (
            <Button 
              onClick={handleSignIn}
              className="w-full bg-white text-slate-800 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98] h-12 rounded-2xl font-black transition-all shadow-md border border-slate-200"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">Use Google Instead</span>
            </Button>
          )}
          
          <button 
            onClick={() => {
              setIsGuest(true);
              localStorage.setItem('flowstate_guest', 'true');
            }}
            className="w-full h-12 sm:h-14 rounded-2xl border-[0.5px] border-slate-200 hover:bg-slate-50 transition-all font-black text-slate-500 text-sm active:scale-[0.98]"
          >
            Continue as Guest
          </button>

          <p className="text-[9px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center px-4 pt-2">
            Workspaces require a secure account. Guest mode stays local and cannot join shared workspaces.
          </p>
        </div>

        {/* Install Button */}
        {!isStandalone && (
          <button 
            onClick={() => setShowManualInstall(true)}
            className="mt-6 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors py-2 px-4 rounded-full hover:bg-white/50"
          >
            <Smartphone size={14} />
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Add to Home Screen</span>
          </button>
        )}
      </div>

      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-mint/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full" />
      <InstallModal 
        isOpen={showManualInstall}
        onClose={() => setShowManualInstall(false)}
        isIOS={isIOS}
        deferredPrompt={deferredPrompt}
        onInstall={handleInstallClick}
      />
    </div>
  );

  // Show full-screen Onboarding Wizard if user is authenticated (not guest)
  // and has not completed profile setup or has no workspace (and no pending invite being processed).
  const hasWorkspace = memberships.length > 0 || joinedOrgIds.length > 0;
  const isIndividual = settings.individualMode === true;
  const showOnboarding = user && !isGuest && isMembershipsLoaded && isSettingsLoaded && !pendingJoinData && (!hasProfile || (!hasWorkspace && !isIndividual));

  if (showOnboarding) {
    return (
    <div className="safe-screen fit-screen flex flex-col items-center justify-start sm:justify-center bg-soft-purple px-3 min-[380px]:px-4 sm:px-6 py-3 min-[380px]:py-5 sm:py-8 lg:py-10 relative overflow-y-auto">
        {/* Onboarding Bento-styled Card */}
        <div className="relative z-10 w-full max-w-lg bg-white/85 backdrop-blur-3xl border border-white/30 rounded-[2rem] sm:rounded-[3rem] p-5 min-[380px]:p-7 lg:p-10 shadow-2xl shadow-slate-200/50 flex flex-col text-center animate-in fade-in zoom-in duration-500 safe-scroll-panel">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-mint via-lavender to-mint shadow-[0_0_10px_rgba(45,212,191,0.5)] rounded-t-[2rem] sm:rounded-t-[3rem]" />
          
          {/* Logo / Header */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 mb-5 min-[380px]:mb-8 text-center sm:text-left">
            <img src="/logo.png" alt="FlowState Logo" className="w-12 h-12 drop-shadow-md rounded-2xl border object-cover object-center flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-ink leading-tight">FlowState Onboarding</h1>
              <p className="text-[10px] font-black tracking-wider text-emerald-600 uppercase leading-tight">Step {!hasProfile ? "1: Set Up Sleep Profile" : "2: Create or Join Workspace"}</p>
            </div>
          </div>

          {!hasProfile ? (
            /* STEP 1: Sleep Profile Settings */
            <div className="space-y-4 min-[380px]:space-y-6">
              <div>
                <h2 className="text-lg min-[380px]:text-xl font-black text-ink mb-1 leading-tight">Create Your Sleep Profile</h2>
                <p className="text-xs text-dove font-medium leading-relaxed">
                  Tell us when you rest so we can build your optimal daily focus block cycles.
                </p>
              </div>

              {onboardingError && (
                <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-rose-600">
                  {onboardingError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 min-[380px]:gap-4">
                <div className="space-y-1.5">
                  <label className="text-[7px] min-[380px]:text-[8px] font-black text-dove uppercase tracking-widest flex items-center justify-center gap-1 text-center">
                    <Moon size={10} /> Sleep Starts At
                  </label>
                  <input 
                    type="time" 
                    defaultValue="23:00"
                    id="onboard_sleep_start"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 min-[380px]:px-4 py-3 text-xs font-black italic text-center focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[7px] min-[380px]:text-[8px] font-black text-dove uppercase tracking-widest flex items-center justify-center gap-1 text-center">
                    <Sun size={10} /> Sleep Ends At
                  </label>
                  <input 
                    type="time" 
                    defaultValue="07:00"
                    id="onboard_sleep_end"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 min-[380px]:px-4 py-3 text-xs font-black italic text-center focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 min-[380px]:gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[7px] min-[380px]:text-[8px] font-black text-dove uppercase tracking-widest text-center">
                    Morning Routine (mins)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="180"
                    defaultValue="0"
                    id="onboard_morning_routine"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 min-[380px]:px-4 py-3 text-xs font-black italic text-center focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[7px] min-[380px]:text-[8px] font-black text-dove uppercase tracking-widest text-center">
                    Evening Routine (mins)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    max="180"
                    defaultValue="0"
                    id="onboard_evening_routine"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 min-[380px]:px-4 py-3 text-xs font-black italic text-center focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                id="onboard_save_profile_btn"
                onClick={async () => {
                  const startInput = document.getElementById("onboard_sleep_start") as HTMLInputElement;
                  const endInput = document.getElementById("onboard_sleep_end") as HTMLInputElement;
                  const morningInput = document.getElementById("onboard_morning_routine") as HTMLInputElement;
                  const eveningInput = document.getElementById("onboard_evening_routine") as HTMLInputElement;

                  const sleepStart = startInput?.value || "23:00";
                  const sleepEnd = endInput?.value || "07:00";
                  const morningRoutine = Math.max(0, parseInt(morningInput?.value || "0"));
                  const eveningRoutine = Math.max(0, parseInt(eveningInput?.value || "0"));

                  setIsSavingOnboardingProfile(true);
                  setOnboardingError(null);
                  try {
                    await saveSettings({
                      sleepStart,
                      sleepEnd,
                      morningRoutine,
                      eveningRoutine
                    });
                  } catch (error: any) {
                    const message = error?.message || String(error);
                    setOnboardingError(message);
                    alert("Profile setup failed: " + message);
                  } finally {
                    setIsSavingOnboardingProfile(false);
                  }
                }}
                disabled={isSavingOnboardingProfile}
                className="w-full bg-slate-950 text-white h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isSavingOnboardingProfile ? (
                  <RefreshCw size={14} className="animate-spin text-mint" />
                ) : (
                  <Check size={14} className="text-mint" />
                )}
                <span>{isSavingOnboardingProfile ? "Saving Profile..." : "Save Profile & Continue"}</span>
              </button>
            </div>
          ) : (
            /* STEP 2: Workspace Setup */
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-ink mb-1">Set Up Your Workspace</h2>
                <p className="text-xs text-dove font-medium leading-relaxed">
                  FlowState requires a workspace. Choose either to launch a new workspace, or input an invitation code.
                </p>
              </div>

              {/* Path 1: Create a new Organization */}
              <div className="border border-slate-150 rounded-2xl p-5 bg-white space-y-3 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={16} className="text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Option A: Launch a New Workspace</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-dove uppercase tracking-widest ml-1">Workspace Name</label>
                  <input 
                    type="text" 
                    value={newOrgName || ''}
                    id="onboard_org_name"
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g. Acme Studio"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black italic focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
                
                {orgError && <p className="text-[10px] font-black text-rose-500 mt-1">{orgError}</p>}

                <button 
                  id="onboard_create_org_btn"
                  onClick={createOrganization}
                  disabled={isCreatingOrg || !newOrgName.trim()}
                  className="w-full h-12 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-extrabold uppercase text-[10px] tracking-widest leading-none active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingOrg ? (
                    <RefreshCw size={14} className="animate-spin text-mint" />
                  ) : "Create Workspace"}
                </button>
              </div>

              {/* Spacer / OR separator */}
              <div className="flex items-center gap-4 text-center">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">OR</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Path 2: Join Code */}
              <div className="border border-slate-150 rounded-2xl p-5 bg-white space-y-3 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound size={16} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Option B: Enter Workspace Join Code</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-dove uppercase tracking-widest ml-1">6-Letter Code</label>
                  <input 
                    type="text" 
                    maxLength={6}
                    value={onboardingJoinCode || ''}
                    id="onboard_join_code_input"
                    onChange={(e) => {
                      setOnboardingJoinCode(e.target.value.toUpperCase());
                      setOnboardingJoinError(null);
                    }}
                    placeholder="XYZ123"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold tracking-wider text-center uppercase focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>

                {onboardingJoinError && <p className="text-[10px] font-black text-rose-500 mt-1">{onboardingJoinError}</p>}

                <button 
                  id="onboard_join_org_btn"
                  onClick={async () => {
                    if (!onboardingJoinCode || onboardingJoinCode.length < 5 || isOnboardingJoining) return;
                    setIsOnboardingJoining(true);
                    setOnboardingJoinError(null);
                    const result = await joinWorkspaceWithCode(onboardingJoinCode);
                    setIsOnboardingJoining(false);
                    
                    if (result.success) {
                      setIsSidebarOpen(true);
                      alert(`Welcome to ${result.orgName || 'your new workspace'}!`);
                      window.history.replaceState({}, document.title, window.location.pathname);
                      window.dispatchEvent(new Event('locationchange'));
                    } else {
                      setOnboardingJoinError(result.error || "Join code not found. Please try again.");
                    }
                  }}
                  disabled={isOnboardingJoining || onboardingJoinCode.length < 5}
                  className="w-full h-12 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold uppercase text-[10px] tracking-widest leading-none active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isOnboardingJoining ? (
                    <RefreshCw size={14} className="animate-spin text-mint" />
                  ) : "Join Workspace"}
                </button>
              </div>

              {/* Spacer / OR separator 2 */}
              <div className="flex items-center gap-4 text-center">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">OR</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Path 3: Continue Solo */}
              <div className="border border-slate-150 rounded-2xl p-5 bg-white space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sliders size={16} className="text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">Option C: Continue Solo (Individual Mode)</span>
                </div>
                <p className="text-xs text-dove font-medium leading-relaxed">
                  Avoid workspaces entirely. Work in an isolated Solo Space. You can still create or join collaborative workspaces later.
                </p>
                <button
                  id="onboard_individual_btn"
                  onClick={async () => {
                    await saveSettings({
                      ...settings,
                      individualMode: true
                    });
                  }}
                  className="w-full h-12 rounded-xl bg-slate-950 text-white hover:bg-slate-900 font-extrabold uppercase text-[10px] tracking-widest leading-none active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Continue Solo Mode
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Decorative background elements */}
        <div className="absolute top-1/4 left-0 w-64 h-64 bg-mint/10 blur-[100px] rounded-full animate-pulse flex items-center justify-center" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full animate-pulse flex items-center justify-center" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] w-full max-w-full overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar - Desktop & Tablet */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-[min(16rem,88vw)] max-w-[88vw] bg-slate-50 border-r-[0.5px] border-slate-100 flex flex-col p-5 sm:p-6 shadow-2xl z-50 transition-transform duration-500 ease-in-out lg:relative lg:w-64 lg:translate-x-0 lg:shadow-none overflow-y-auto",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1.5 text-dove hover:text-ink"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-4 mt-1 lg:mt-0">
          <LayoutDashboard className="text-mint" size={14} />
          <h2 className="text-[10px] font-elegant italic font-black text-ink uppercase tracking-[0.1em]">
            {showTeamUI ? 'Group Progress' : 'Your Progress'}
          </h2>
        </div>
        
        <nav className="flex-1 space-y-3 overflow-y-auto scrollbar-hide">
          <div>
            <label className="text-[8px] uppercase tracking-widest font-bold text-dove mb-1.5 block">App Status</label>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-mint shadow-[0_0_6px_rgba(45,212,191,0.6)] animate-pulse" />
                <span className="text-[10px] font-medium tracking-tight">Focus Mode On</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-lavender" />
                <span className="text-[10px] font-medium tracking-tight">Life Sync Active</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[8px] uppercase tracking-widest font-bold text-dove mb-1.5 block">Daily Stats</label>
            <div className="grid grid-cols-1 gap-1.5 bg-slate-50 rounded-lg p-2">
              <div>
                <div className="text-[9px] text-dove leading-none mb-1">Focus Score</div>
                <div className="text-lg font-black text-ink">{flowScore}%</div>
              </div>
              <div className="pt-1.5 border-t-[0.5px] border-white/50">
                <div className="text-[9px] text-dove leading-none mb-1">Busy Time</div>
                <div className="text-lg font-black text-ink">{Math.floor(flowTime / 60)}h {flowTime % 60}m</div>
              </div>
            </div>
          </div>

              <div className="pt-2 border-t-[0.5px] border-slate-100">
                <nav className="space-y-1">
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all",
                      activeTab === 'dashboard' ? "bg-mint text-ink" : "text-dove hover:bg-slate-50"
                    )}
                  >
                    <LayoutDashboard size={14} />
                    <span>Dashboard</span>
                  </button>
                  <button 
                    onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all",
                      activeTab === 'analytics' ? "bg-mint text-ink" : "text-dove hover:bg-slate-50"
                    )}
                  >
                    <BarChart3 size={14} />
                    <span>Analytics</span>
                  </button>

                  <button 
                    onClick={() => { setActiveTab('workspaces'); setIsSidebarOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold transition-all",
                      activeTab === 'workspaces' ? "bg-mint text-ink font-semibold" : "text-dove hover:bg-slate-50"
                    )}
                  >
                    <Building2 size={14} />
                    <span>Workspaces</span>
                  </button>
                </nav>
              </div>

              <div className="pt-4 border-t-[0.5px] border-slate-100 mt-auto">
                <button 
                  onClick={requestNotifications}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-3 rounded-2xl transition-all border shadow-sm",
                    notificationsEnabled 
                      ? "bg-mint/5 border-mint/20 text-mint" 
                      : "bg-white border-slate-100 text-dove hover:border-mint/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {notificationsEnabled ? <Bell size={14} className="animate-bounce" /> : <BellOff size={14} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {notificationsEnabled ? 'Alerts On' : 'Enable Alerts'}
                    </span>
                  </div>
                  {notificationsEnabled && <div className="w-1.5 h-1.5 rounded-full bg-mint shadow-[0_0_8px_rgba(45,212,191,1)]" />}
                </button>
                <p className="text-[8px] text-slate-400 mt-2 text-center uppercase tracking-tighter font-bold opacity-40">Transitions & Deep Work Pings</p>
              </div>
        </nav>
      </aside>

      {/* Overlay for mobile sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-400/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col relative bg-soft-purple w-full max-w-full h-full overflow-x-hidden overflow-y-auto">
        {/* Pinned Action Buttons (Top Right) */}
        <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))] lg:top-4 lg:right-6 flex items-center gap-1 z-[60]">
           <button 
             onClick={() => { setTempSettings(activeSettings); setIsSettingsOpen(true); }}
             className="p-2 bg-white/80 backdrop-blur shadow-lg rounded-xl text-dove hover:text-mint transition-all border-[0.5px] border-white hover:scale-110 active:scale-95"
           >
             <Settings size={18} />
           </button>
        </div>

        <div className="max-w-7xl mx-auto w-full min-w-0 flex flex-col p-1.5 min-[380px]:p-2 lg:p-4">
          {/* Top Bar / Input */}
          <header className="px-1.5 min-[380px]:px-2 lg:px-6 pt-0.5 pb-2 flex flex-col items-center gap-1 z-30 bg-soft-purple/80 backdrop-blur-md border-b-[0.5px] border-slate-50 flex-shrink-0 w-full min-w-0">
            {/* Guest Invitation Banner */}
            {isGuest && inviteInfo && (
              <div className="mx-2 lg:mx-6 mb-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                    <Users size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Pending Invitation</p>
                    <p className="text-sm font-bold text-ink">Join <span className="text-emerald-700">"{inviteInfo.orgName}"</span></p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsGuest(false);
                    localStorage.removeItem('flowstate_guest');
                  }}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap"
                >
                  Sign In to Join
                </button>
              </div>
            )}

            {/* Logo Center Bar */}
            <div className="flex items-center justify-center w-full relative min-h-10 lg:min-h-12 mt-2 mb-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden absolute left-0 p-2 text-ink hover:bg-slate-50 rounded-full"
              >
                <Menu size={20} />
              </button>
              
              <div className="logo-outline flex flex-col items-center">
                <h1 className="bubble-text text-3xl min-[380px]:text-4xl lg:text-5xl px-10 lg:px-6 pt-3 pb-1 leading-none">FlowState</h1>
                {showWorkspaceContext && organizations.some(o => o.id === activeOrgId) && (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 mb-2 animate-in fade-in zoom-in duration-500">
                    <Building2 size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-widest truncate max-w-[120px]">
                      {organizations.find(o => o.id === activeOrgId)?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Input and Context Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-center lg:justify-start gap-3 lg:gap-6 w-full min-w-0 pt-1 pb-2">
              <div className="flex flex-col items-center lg:items-start lg:min-w-[180px]">
                <div className="flex items-center gap-2">
                  <div className="text-2xl lg:text-3xl font-elegant italic font-black text-ink whitespace-nowrap tracking-tight text-center lg:text-left">
                       {(() => {
                          try {
                            const [y, m, d] = selectedDate.split('-').map(Number);
                            const dateObj = new Date(y, m - 1, d, 12, 0, 0);
                            return format(dateObj, 'EEE, MMM d');
                          } catch (e) {
                            return selectedDate;
                          }
                       })()}
                    </div>
                </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-black text-mint text-center lg:text-left">{focusStr} focus</div>
              </div>

              <div className="relative flex-1 min-w-0 group w-full flex flex-col gap-2">
                <div className="relative">
                    <textarea 
                      ref={inputRef}
                      value={inputText || ''}
                      onChange={handleInputChange}
                      onFocus={handleInputFocus}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleParse();
                        }
                      }}
                      placeholder="e.g. Gym 1h, Meditate 15m, Work on project 3h..."
                      className={cn(
                        "w-full bg-slate-50/80 backdrop-blur rounded-2xl py-2 lg:py-2.5 pl-3 pr-3 min-[420px]:pr-24 shadow-inner border-[0.5px] focus:outline-none focus:ring-8 transition-all text-sm lg:text-base font-medium placeholder:text-slate-300 min-h-[50px] resize-none",
                        parseError ? "border-rose-400 focus:ring-rose-400/5" : "border-slate-200/50 focus:ring-mint/5"
                      )}
                    />
                    <div className="min-[420px]:absolute min-[420px]:right-3 min-[420px]:top-1/2 min-[420px]:-translate-y-1/2 flex items-center justify-end gap-2 mt-2 min-[420px]:mt-0">
                       {(isParsing || (parsingStatus && !parseError)) && (
                        <div className="flex items-center gap-1.5 mr-2 animate-in fade-in slide-in-from-right-1">
                          {isParsing ? <RefreshCw size={12} className="text-mint animate-spin" /> : <div className="w-1 h-1 rounded-full bg-mint shadow-[0_0_8px_rgba(45,212,191,1)]" />}
                        </div>
                       )}
                       <button 
                         onClick={handleParse}
                         disabled={isParsing || !inputText}
                         className="bg-mint text-ink rounded-md px-3 py-2.5 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform shadow-lg hover:shadow-xl disabled:grayscale z-10 max-w-full"
                       >
                         {showTeamUI ? "Add Group Tasks" : "Add Tasks"}
                       </button>
                    </div>
                </div>
                {parseError && (
                  <div className="text-[10px] text-rose-500 font-bold uppercase tracking-wider px-2 animate-in slide-in-from-top-1 fade-in">
                    {parseError}
                  </div>
                )}

                {showTeamUI && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 px-1">
                    <div className="rounded-2xl border border-emerald-100 bg-white/80 p-3 shadow-sm space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700 mr-1">Assign New Tasks:</span>
                        {[
                          ['anyone', 'Anyone'],
                          ['everyone', 'Everyone'],
                          ['person', 'Person'],
                          ['department', 'Department']
                        ].map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              const nextMode = mode as typeof taskAssignmentMode;
                              setTaskAssignmentMode(nextMode);
                              if (nextMode === 'person') setTaskAssignmentTarget(activeOrgMembers[0]?.userId || '');
                              if (nextMode === 'department') setTaskAssignmentTarget(workspaceDepartments[0] || '');
                              if (nextMode === 'anyone' || nextMode === 'everyone') setTaskAssignmentTarget('');
                            }}
                            disabled={mode === 'department' && workspaceDepartments.length === 0}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all disabled:opacity-40",
                              taskAssignmentMode === mode ? "bg-emerald-500 text-white border-emerald-500 shadow-md" : "bg-emerald-50/50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {taskAssignmentMode === 'person' && (
                        <select
                          value={taskAssignmentTarget}
                          onChange={(e) => setTaskAssignmentTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-mint/10"
                        >
                          {activeOrgMembers.map(member => (
                            <option key={member.userId} value={member.userId}>
                              {member.userId === user?.uid ? 'Me' : member.name || member.userId.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      )}

                      {taskAssignmentMode === 'department' && (
                        <select
                          value={taskAssignmentTarget}
                          onChange={(e) => setTaskAssignmentTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-mint/10"
                        >
                          {workspaceDepartments.length === 0 ? (
                            <option value="">Add job titles to members to create departments</option>
                          ) : workspaceDepartments.map(department => (
                            <option key={department} value={department}>
                              {department} ({activeOrgMembers.filter(member => (member.jobTitle || '').trim() === department).length})
                            </option>
                          ))}
                        </select>
                      )}

                      <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
                        Anyone creates one unassigned task. Everyone and Department create a copy for each matching member.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mr-1 self-center">View:</span>
                       <button 
                         onClick={() => setSelectedWorkerId(null)}
                         className={cn(
                           "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all",
                           selectedWorkerId === null ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                         )}
                       >
                         All Tasks
                       </button>
                       {activeOrgMembers.map(m => (
                         <button 
                           key={m.userId}
                           onClick={() => setSelectedWorkerId(m.userId)}
                           className={cn(
                             "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all",
                             selectedWorkerId === m.userId ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100"
                           )}
                         >
                           {m.userId === user?.uid ? 'Me' : (m.name || m.userId.slice(0, 8))}
                         </button>
                       ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 transition-all duration-300">
                  <button
                    type="button"
                    onClick={() => setIsWorkScheduleOpen(true)}
                    className="h-8 px-3 rounded-xl bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    title="Add fixed work schedule"
                  >
                    <Briefcase size={11} />
                    Work Schedule
                  </button>

                  <div className="h-4 w-[1px] bg-slate-100 mx-1" />

                  <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider mr-1">Repeat:</span>
                  <div className="flex items-center gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => toggleAddDay(i)}
                        className={cn(
                          "w-6 h-6 rounded-md text-[9px] font-black transition-all flex items-center justify-center border-[0.5px]",
                          selectedAddDays.includes(i) 
                            ? "bg-mint border-mint text-ink shadow-sm shadow-mint/20 scale-110" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-mint/30"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>

                  <div className="h-4 w-[1px] bg-slate-100 mx-1" />

                  <div className="flex flex-wrap items-center gap-1">
                    <div className="relative">
                      <input 
                        type="date"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          if (e.target.value) {
                            toggleAddDate(e.target.value);
                            e.target.value = ''; 
                          }
                        }}
                      />
                      <button className="w-6 h-6 rounded-md bg-white border border-slate-100 text-slate-400 hover:border-mint/30 flex items-center justify-center transition-all">
                        <Calendar size={10} />
                      </button>
                    </div>

                    {selectedAddDates.map(date => (
                      <button
                        key={date}
                        onClick={() => toggleAddDate(date)}
                        className="px-2 py-0.5 rounded-md bg-mint/10 border border-mint/20 text-emerald-700 text-[8px] font-black flex items-center gap-1 animate-in zoom-in-95"
                      >
                        {(() => {
                           try {
                             return format(parse(date, 'yyyy-MM-dd', new Date()), 'MMM d');
                           } catch (e) { return date; }
                        })()}
                        <X size={6} />
                      </button>
                    ))}
                  </div>

                  {(selectedAddDays.length > 0 || selectedAddDates.length > 0) && (
                    <button 
                      onClick={() => {
                        setSelectedAddDays([]);
                        setSelectedAddDates([]);
                      }}
                      className="text-[8px] font-black uppercase text-red-300 hover:text-red-400 ml-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-1 bg-white rounded-xl border-[0.5px] border-slate-100 shadow-sm p-1 w-full sm:w-auto">
                <button 
                  onClick={() => shiftDate(-1)}
                  title="Previous Day"
                  className="p-2 text-dove hover:text-mint active:scale-90 transition-transform bg-slate-50/50 rounded-lg flex items-center justify-center"
                >
                  <ChevronRight className="rotate-180" size={18} />
                </button>
                
                <button 
                  onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.15em] transition-all min-w-[100px]",
                    isTodayStatus 
                      ? "bg-mint text-ink shadow-md shadow-mint/20" 
                      : "bg-slate-50 text-dove hover:text-ink"
                  )}
                >
                  {relativeDateString}
                </button>

                <button 
                  onClick={() => shiftDate(1)}
                  title="Next Day"
                  className="p-2 text-dove hover:text-mint active:scale-90 transition-transform bg-slate-50/50 rounded-lg flex items-center justify-center"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </header>

        <div className="px-1.5 min-[380px]:px-2 sm:px-3 lg:px-4 mt-0 flex-1 min-w-0 max-w-full">
          {activeTab === 'workspaces' && !activeOrgId && (
              <div className="max-w-5xl mx-auto w-full min-w-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 scrollbar-hide text-left">
              <div className="text-center md:text-left mb-6">
                <h2 className="text-3xl font-elegant italic font-black text-slate-800 tracking-tight">Workspaces Portal</h2>
                <p className="text-xs text-dove font-medium mt-1">Connect with your organizations, launch unified projects, and access workspace dashboards.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left column: List of Workspaces */}
                <div className="md:col-span-8 space-y-4">
                  <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 border-[0.5px] border-slate-100 shadow-xl shadow-slate-100/10">
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-4 font-sans">Your Active Workspaces</h3>
                    
                    {organizations.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {organizations.map(org => {
                          const m = memberships.find(mem => mem.orgId === org.id);
                          const isActive = activeOrgId === org.id;
                          return (
                            <div 
                              key={org.id} 
                              className={cn(
                                "group/orgCard relative p-5 rounded-3xl border transition-all duration-300 shadow-sm flex flex-col justify-between min-h-[140px]",
                                isActive 
                                  ? "bg-emerald-50/30 border-emerald-200/50 shadow-emerald-50/20" 
                                  : "bg-slate-50 hover:bg-emerald-50/50 border-slate-100 hover:border-emerald-200/50"
                              )}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="p-2.5 bg-white rounded-2xl text-emerald-600 border border-slate-100 group-hover/orgCard:border-emerald-100 group-hover/orgCard:text-emerald-700 transition-all shadow-sm">
                                    <Building2 size={20} />
                                  </div>
                                  <div className="flex gap-1">
                                    {isActive && (
                                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-mint/20 text-emerald-900 border border-mint/30 rounded-lg">Active</span>
                                    )}
                                    {m?.role === 'admin' ? (
                                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg">Admin</span>
                                    ) : (
                                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg">Member</span>
                                    )}
                                  </div>
                                </div>
                                <h4 className="text-base font-black text-slate-800 truncate leading-snug">{org.name}</h4>
                                <p className="text-[10px] text-dove font-medium truncate mt-0.5">Code: {org.joinCode}</p>
                              </div>

                              {isActive ? (
                                <button
                                  onClick={() => {
                                    setActiveOrgId(null);
                                    setWorkspaceModule('reports');
                                  }}
                                  className="w-full mt-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <span>Exit Collaboration</span>
                                  <ArrowRightLeft size={12} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActiveOrgId(org.id);
                                    setActiveTab('workspaces');
                                    setWorkspaceModule('reports');
                                  }}
                                  className="w-full mt-4 py-2.5 bg-slate-900 group-hover/orgCard:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <span>Activate Workspace</span>
                                  <ChevronRight size={12} className="group-hover/orgCard:translate-x-1 transition-transform" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 px-6">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                          <Building2 size={28} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700">No Custom Workspaces</h4>
                        <p className="text-xs text-dove max-w-sm mx-auto mt-1">You are currently operating in your private Solo Space. Create a workspace to collaborate with roommates, colleagues, or partners.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right column: Create / Join actions */}
                <div className="md:col-span-4 space-y-6 text-left">
                  {/* Create Workspace Panel */}
                  <div className="bg-white rounded-[2.5rem] p-6 border-[0.5px] border-slate-100 shadow-xl shadow-slate-100/10 flex flex-col justify-between">
                    <div>
                      <div className="p-3 bg-mint/10 rounded-2xl text-mint w-fit mb-4">
                        <Plus size={20} />
                      </div>
                      <h3 className="text-base font-black text-slate-800 leading-snug">Launch Workspace</h3>
                      <p className="text-[11px] text-dove leading-relaxed mt-1 mb-6">Create a shared workspace to manage collective calendars, tasks, and align timelines.</p>
                    </div>
                    <button
                      onClick={() => setIsOrgModalOpen(true)}
                      className="w-full py-3 bg-mint hover:bg-mint/90 text-ink rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 shadow-lg active:scale-95"
                    >
                      Start Workspace
                    </button>
                  </div>

                  {/* Join Workspace Panel */}
                  <div className="bg-white rounded-[2.5rem] p-6 border-[0.5px] border-slate-100 shadow-xl shadow-slate-100/10">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 w-fit mb-4">
                      <Users size={20} />
                    </div>
                    <h3 className="text-base font-black text-slate-800 leading-snug">Join Workspace</h3>
                    <p className="text-[11px] text-dove leading-relaxed mt-1 mb-4">Enter a 6-character workspace code or paste an invitation link to enter an active collaboration.</p>
                    
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = form.elements.namedItem('join_code_hub') as HTMLInputElement;
                      const val = input?.value?.trim()?.toUpperCase();
                      if (val) {
                        try {
                          const result = await joinWorkspaceWithCode(val);
                          if (result.success) {
                            alert(`Success! Welcome to "${result.orgName}".`);
                            input.value = '';
                          } else {
                            alert(result.error || "Failed to join workspace.");
                          }
                        } catch (err: any) {
                          alert(err.message || "An error occurred.");
                        }
                      }
                    }} className="space-y-2">
                      <input 
                        name="join_code_hub"
                        type="text" 
                        maxLength={6}
                        placeholder="e.g. AB12CD" 
                        onChange={(ev) => {
                          ev.target.value = ev.target.value.toUpperCase();
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black uppercase text-center focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all placeholder:normal-case"
                      />
                      <button
                        type="submit"
                        className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300"
                      >
                        Submit Code
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspaces' && activeOrgId && (
              // Our Active Workspace Suite Container
              <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6 animate-in fade-in duration-300 text-left pb-20 font-sans">
                {/* 1. Header Control Panel */}
                <div className="bg-white rounded-[2rem] p-4 sm:p-6 border-[0.5px] border-slate-100 shadow-md flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 min-w-0">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase tracking-widest bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-lg">Active Workspace</span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">CODE: {organizations.find(o => o.id === activeOrgId)?.joinCode || '------'}</span>
                      </div>
                      <h2 className="text-2xl font-black text-slate-900 mt-1 leading-tight break-words">
                        {organizations.find(o => o.id === activeOrgId)?.name || 'E-Suite Workspace'}
                      </h2>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveOrgId(null);
                      setWorkspaceModule('reports');
                    }}
                    className="p-3 px-5 bg-slate-150 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 border whitespace-normal text-center"
                  >
                    <ArrowRightLeft size={14} /> Back to Directory
                  </button>
                </div>

                {/* 2. Workspace Two-Column Suite */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                  
                  {/* Sidebar Navigation */}
                  <div className="bg-white rounded-[2.5rem] p-4 border-[0.5px] border-slate-100 shadow-lg shadow-slate-100/10 space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-3 py-2">Workspace Menu</p>
                    
                    {[
                      { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
                      { id: 'customers', label: 'Customers & Contacts', icon: Users },
                      { id: 'accounts', label: 'Accounts & Enterprise', icon: Landmark },
                      { id: 'leads', label: 'Leads Pipeline', icon: GitFork },
                      { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
                      { id: 'activities', label: 'Activities & Tasks', icon: CheckSquare },
                      { id: 'calendar', label: 'Calendar Planner', icon: Calendar },
                      { id: 'quotes', label: 'Proposals & Quotes', icon: FileText },
                      { id: 'invoices', label: 'Fiscal Invoices', icon: WalletCards },
                      { id: 'settings', label: 'Settings & Admin', icon: Sliders },
                    ].map(moduleItem => {
                      const IconComp = moduleItem.icon;
                      const isActiveModule = workspaceModule === moduleItem.id;
                      return (
                        <button
                          key={moduleItem.id}
                          onClick={() => setWorkspaceModule(moduleItem.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-left",
                            isActiveModule 
                              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          )}
                        >
                          <IconComp size={14} />
                          <span>{moduleItem.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right hand details screen container */}
                  <div className="lg:col-span-3">
                    {workspaceModule !== 'settings' ? (
                      workspaceModule === 'reports' && !hasWorkspaceAnalyticsSubscription ? (
                        <AnalyticsSubscriptionGate
                          scope="workspace"
                          canActivate={currentMembership?.role === 'admin'}
                        />
                      ) : (
                        <CRMModule
                          orgId={activeOrgId}
                          workspaceTab={workspaceModule as any}
                          userId={user?.uid || ''}
                          userEmail={user?.email || ''}
                          userName={user?.displayName || user?.email || 'User'}
                          members={activeOrgMembers}
                          role={activeOrgMembers.find(m => m.userId === user?.uid)?.role || 'worker'}
                        />
                      )
                    ) : (
                      <div className="space-y-6">
                        {/* Workspace Admin Settings Block */}
                        <div className="bg-white rounded-[2.5rem] p-6 lg:p-8 border-[0.5px] border-slate-100 shadow-xl shadow-slate-100/10">
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 pl-1 font-sans">Workspace Master Control Configuration</h3>
                          <p className="text-[10px] text-slate-400 pl-1 mb-6">Manage administrative permissions, rename your workspace, or archive your dataset permanently.</p>
                          
                          {/* Render Organization Admin rename flow */}
                          {currentMembership?.role === 'admin' ? (
                            <div className="space-y-4 text-left border bg-slate-50/20 p-5 rounded-[2rem]">
                              <div className="flex items-center gap-2 mb-2 border-b pb-3">
                                <Sliders size={15} className="text-slate-600" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Administrative Actions</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Workspace Name</label>
                                  <input 
                                    type="text"
                                    id="workspaceNameInput"
                                    className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs font-extrabold focus:outline-none"
                                    defaultValue={organizations.find(o => o.id === activeOrgId)?.name || ''}
                                  />
                                </div>
                                <div className="space-y-1 flex items-end">
                                  <button
                                    onClick={async () => {
                                      const newVal = (document.getElementById('workspaceNameInput') as HTMLInputElement)?.value?.trim();
                                      if (newVal && activeOrgId) {
                                        try {
                                          const org = organizations.find(o => o.id === activeOrgId);
                                          const batch = writeBatch(db);
                                          batch.update(doc(db, 'organizations', activeOrgId), { name: newVal });
                                          if (org?.joinCode) {
                                            batch.set(doc(db, 'workspaceCodes', org.joinCode), {
                                              orgId: activeOrgId,
                                              orgName: newVal,
                                              enabled: org.joinCodeEnabled !== false,
                                              adminId: org.adminId,
                                              createdAt: serverTimestamp()
                                            }, { merge: true });
                                          }
                                          await batch.commit();
                                          alert("Workspace renamed successfully!");
                                        } catch (err) {
                                          console.error("Rename failed", err);
                                        }
                                      }
                                    }}
                                    className="p-2.5 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                  >
                                    Apply Rename
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-slate-100/20 border text-slate-500 rounded-2xl text-[10px] font-mono italic text-center">
                              Only Administrators can alter workspace configurations.
                            </div>
                          )}
                        </div>

                        {/* Traditional Dashboard grid of active collaborators */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="md:col-span-12">
                     <div className="flex items-center gap-2 mb-1">
                       <Building2 size={16} className="text-emerald-600" />
                       <h3 className="text-xl font-elegant font-black italic text-slate-800">
                         Collaboration Dashboard: <span className="text-emerald-700">"{organizations.find(o => o.id === activeOrgId)?.name || 'Active Workspace'}"</span>
                       </h3>
                     </div>
                     <p className="text-[10px] text-dove font-bold uppercase tracking-widest">Workspace members, roles, boarding invitations, and administrative tasks</p>
                  </div>

                  {/* Active Collaborators Panel */}
                  <div className="md:col-span-6 bg-white border-[0.5px] border-emerald-100 rounded-[2.5rem] p-6 shadow-xl shadow-emerald-100/10 flex flex-col">
                     <div className="flex items-center justify-between mb-4">
                       <div className="flex items-center gap-2">
                         <div className="p-2 bg-emerald-50 rounded-xl">
                           <Users className="text-emerald-500 w-4 h-4" />
                         </div>
                         <h3 className="text-lg font-black tracking-tight font-elegant italic text-emerald-900">Active Collaborators</h3>
                       </div>
                       <button 
                          onClick={async () => {
                            const org = organizations.find(o => o.id === activeOrgId);
                            if (org) {
                              const link = buildAppLink({ join: org.joinCode });
                              try {
                                if (navigator.clipboard) {
                                  await navigator.clipboard.writeText(link);
                                  alert("Access link copied to clipboard!");
                                } else {
                                  prompt("Copy this access link:", link);
                                }
                              } catch (err) {
                                prompt("Copy this access link:", link);
                              }
                            }
                          }}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all active:scale-95 border border-mint/10"
                          title="Share Access Link"
                        >
                          <Share size={14} />
                        </button>
                     </div>

                     {currentMembership?.role === 'admin' && (
                       <div className="flex flex-col gap-2 p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100/50 mb-4 text-left">
                         <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                           <SlidersHorizontal size={10} />
                           <span>Organize Members</span>
                         </div>
                         <div className="grid grid-cols-2 gap-2">
                           <div className="flex flex-col gap-1">
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Role Filter</span>
                             <div className="relative">
                                <select
                                 value={memberFilterRole || 'all'}
                                 onChange={(e) => setMemberFilterRole(e.target.value as 'all' | 'admin' | 'worker')}
                                 className="w-full bg-white border border-emerald-100 text-[10px] font-black text-emerald-950 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner appearance-none cursor-pointer pr-6 text-left"
                               >
                                 <option value="all">All Roles</option>
                                 <option value="admin">Admins Only</option>
                                 <option value="worker">Workers Only</option>
                               </select>
                               <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-emerald-600">
                                 <Filter size={10} />
                               </div>
                             </div>
                           </div>

                           <div className="flex flex-col gap-1">
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Sort By</span>
                             <div className="relative">
                               <select
                                 value={memberSort || 'alphabetical'}
                                 onChange={(e) => setMemberSort(e.target.value as 'alphabetical' | 'alphabetical-desc' | 'role-admin' | 'role-worker')}
                                 className="w-full bg-white border border-emerald-100 text-[10px] font-black text-emerald-950 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner appearance-none cursor-pointer pr-6 text-left"
                               >
                                 <option value="alphabetical">A - Z Name</option>
                                 <option value="alphabetical-desc">Z - A Name</option>
                                 <option value="role-admin">Admin First</option>
                                 <option value="role-worker">Worker First</option>
                               </select>
                               <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-emerald-600">
                                 <ArrowUpDown size={10} />
                               </div>
                             </div>
                           </div>
                         </div>
                       </div>
                     )}

                     <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-1">
                        {sortedAndFilteredMembers.map(member => {
                          const isAdmin = currentMembership?.role === 'admin';
                          const isSelf = member.userId === user?.uid;
                          return (
                            <div key={member.id} className="group/member flex items-center justify-between p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-emerald-105 hover:bg-white transition-all shadow-sm relative">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-750 font-black text-sm border border-emerald-100/30">
                                  {member.name?.[0] || 'U'}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-ink truncate leading-none mb-1 text-left">
                                    {member.name || (isSelf ? 'You' : 'Member')}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-dove uppercase tracking-wider truncate opacity-60">
                                      {member.jobTitle || 'Role Pending'}
                                    </p>
                                    {member.role === 'admin' && (
                                      <span className="text-[8px] font-black uppercase text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">Admin</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {(isSelf || isAdmin) && (
                                <button 
                                  onClick={() => {
                                    setEditingMemberId(member.id);
                                    setEditMemberName(member.name || '');
                                    setEditMemberTitle(member.jobTitle || '');
                                    setEditMemberRole(member.role || 'worker');
                                  }}
                                  className="opacity-100 sm:opacity-0 group-hover/member:opacity-100 p-1.5 text-dove hover:text-ink transition-opacity"
                                >
                                  <Settings size={12} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                     </div>
                  </div>

                  {/* Invitations & Boarding Panel */}
                  <div className="md:col-span-6 bg-white border-[0.5px] border-emerald-100 rounded-[2.5rem] p-6 shadow-xl shadow-emerald-100/10 flex flex-col space-y-4">
                     <div className="flex items-center gap-2">
                       <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                         <Share size={16} />
                       </div>
                       <h3 className="text-lg font-black tracking-tight font-elegant italic text-emerald-950">Onboarding & Invitations</h3>
                     </div>

                     {currentMembership?.role === 'admin' ? (
                       <>
                         <div className="bg-emerald-50/85 rounded-2xl p-4 border border-emerald-100/50 shadow-sm relative overflow-hidden text-left">
                            {isCreatingInvite && (
                              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                                 <RefreshCw size={16} className="text-emerald-600 animate-spin" />
                              </div>
                            )}
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <Users size={12} />
                              Create Boarding Invitation
                            </p>
                             <div className="space-y-3 mb-3">
                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                               <input 
                                 type="text"
                                 placeholder="Member Name"
                                 value={newInviteName || ''}
                                 onChange={(e) => setNewInviteName(e.target.value)}
                                 className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400"
                               />
                               <input 
                                 type="email"
                                 placeholder="Email Address (optional)"
                                 value={newInviteEmail || ''}
                                 onChange={(e) => setNewInviteEmail(e.target.value)}
                                 className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400"
                               />
                               <input 
                                 type="text"
                                 placeholder="Job Title (e.g. Engineer, PM)"
                                 value={newInviteJobTitle || ''}
                                 onChange={(e) => setNewInviteJobTitle(e.target.value)}
                                  className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400 sm:col-span-2"
                               />
                               </div>
                               
                               <div className="flex flex-wrap items-center gap-2">
                                 <span className="text-[9px] font-black uppercase text-emerald-800/60 mr-1">Role:</span>
                                 <button
                                   type="button"
                                   onClick={() => setNewInviteRole('worker')}
                                   className={cn(
                                     "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                                     newInviteRole === 'worker' 
                                       ? "bg-slate-900 border-slate-900 text-white shadow-sm font-black"
                                       : "bg-white border-emerald-100 text-slate-500 hover:bg-slate-50"
                                   )}
                                 >
                                   Worker
                                 </button>
                                 <button
                                   type="button"
                                   onClick={() => setNewInviteRole('admin')}
                                   className={cn(
                                     "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                                     newInviteRole === 'admin' 
                                       ? "bg-emerald-600 border-emerald-600 text-white shadow-sm font-black"
                                       : "bg-white border-emerald-100 text-slate-500 hover:bg-slate-50"
                                   )}
                                 >
                                   Admin
                                 </button>
                                 
                                 <button 
                                   onClick={createInvite}
                                   disabled={!newInviteName.trim() || isCreatingInvite}
                                   className="ml-auto bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                                 >
                                   Create Invite
                                 </button>
                               </div>
                             </div>
                             
                             {lastCreatedLink && (
                               <div className="mt-2 p-2 bg-white rounded-lg border border-emerald-105 animate-in zoom-in slide-in-from-top-2">
                                 <p className="text-[8px] font-black text-emerald-650 uppercase tracking-widest mb-1">Link Generated!</p>
                                 <div className="flex items-center gap-2">
                                   <code className="text-[9px] font-mono bg-slate-50 p-1 rounded flex-1 truncate">{lastCreatedLink}</code>
                                   <button 
                                     onClick={() => {
                                       navigator.clipboard.writeText(lastCreatedLink);
                                       alert("Copied!");
                                     }}
                                     className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                   >
                                     <LinkIcon size={12} />
                                   </button>
                                 </div>
                               </div>
                             )}
                             <p className="text-[8px] text-emerald-800/40 leading-tight italic font-medium mt-2">Creates a secure boarding link valid for 7 days.</p>
                         </div>

                         {invites.length > 0 && (
                           <div className="space-y-2 mt-4 text-left">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900/40 px-1">Active Boarding Links ({invites.length})</p>
                              <div className="max-h-[150px] overflow-y-auto space-y-2 pr-1">
                                {invites.map(invite => (
                                  <div key={invite.id} className="flex items-center justify-between p-2.5 bg-emerald-50/30 rounded-xl border border-emerald-100/30 group/invite">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                      <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-emerald-600 border border-emerald-100 flex-shrink-0">
                                        {invite.name?.[0]}
                                      </div>
                                      <span className="text-[11px] font-bold text-emerald-900 truncate">{invite.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button 
                                        onClick={async () => {
                                          const link = buildAppLink({ invite: invite.token });
                                          try {
                                            if (navigator.clipboard) {
                                              await navigator.clipboard.writeText(link);
                                              alert("Link copied!");
                                            }
                                          } catch (err) {
                                            prompt("Copy link:", link);
                                          }
                                        }}
                                        className="p-1 text-emerald-600 hover:bg-white rounded shadow-sm"
                                        title="Copy Link"
                                      >
                                        <LinkIcon size={12} />
                                      </button>
                                      <button 
                                        onClick={() => deleteInvite(invite.id)}
                                        className="p-1 text-rose-400 hover:bg-white rounded shadow-sm"
                                        title="Revoke"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                           </div>
                         )}
                       </>
                     ) : (
                       <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                          <Info size={24} className="mx-auto text-slate-300 mb-2" />
                          <h4 className="text-xs font-black uppercase tracking-wider mb-1">Standard Access Only</h4>
                          <p className="text-[10px] leading-relaxed">Only Administrators can issue invitations and onboard new workers to this workspace.</p>
                       </div>
                     )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {activeTab === 'analytics' && (
      hasMainframeAnalyticsSubscription ? (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 scrollbar-hide">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Domain Chart */}
                 <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-slate-100 border-[0.5px] border-slate-50">
                    <div className="flex items-center gap-2 mb-6">
                      <PieChartIcon className="text-mint" size={18} />
                      <h3 className="text-lg font-black text-ink">Life Balance</h3>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analyticsData.pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analyticsData.pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={analyticsData.COLORS[index % analyticsData.COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 {/* Focus Chart */}
                 <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-slate-100 border-[0.5px] border-slate-50">
                    <div className="flex items-center gap-2 mb-6">
                      <TrendingUp className="text-lavender" size={18} />
                      <h3 className="text-lg font-black text-ink">Focus Velocity</h3>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.last7Days}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="focusMinutes" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
               </div>

               {/* Vibe Trends */}
               <div className="bg-white rounded-[3rem] p-8 shadow-2xl shadow-slate-100 border-[0.5px] border-slate-50">
                  <div className="flex items-center gap-2 mb-6">
                    <Waves className="text-mint" size={18} />
                    <h3 className="text-lg font-black text-ink">Biological Velocity</h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsData.last7Days}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} domain={[0, 5]} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="mood" stroke="#2dd4bf" strokeWidth={3} dot={{ stroke: '#2dd4bf', strokeWidth: 2, r: 4, fill: '#fff' }} name="Mood" />
                        <Line type="monotone" dataKey="energy" stroke="#818cf8" strokeWidth={3} dot={{ stroke: '#818cf8', strokeWidth: 2, r: 4, fill: '#fff' }} name="Energy" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
      ) : (
        <AnalyticsSubscriptionGate
          scope="mainframe"
        />
      )
          )}

          {activeTab !== 'workspaces' && activeTab !== 'analytics' && (
          <div className="max-w-7xl mx-auto w-full min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5 lg:gap-4 pb-4">
            {/* Countdown Section */}
            {isTodayStatus && (
              <div className="lg:col-span-12 w-full animate-in fade-in slide-in-from-top-4 duration-500">
                {(() => {
                  const items = flow.scheduled;
                  const nextTask = items.find(item => item.start > now && item.type === 'task');
                  const lastTask = [...items].reverse().find(item => item.type === 'task');
                  const currentTask = items.find(item => item.start <= now && item.end > now && item.type === 'task');

                  const minutesUntilNext = nextTask ? Math.floor((nextTask.start.getTime() - now.getTime()) / 60000) : null;
                  const minutesUntilEnd = lastTask ? Math.floor((lastTask.end.getTime() - now.getTime()) / 60000) : null;

                  if ((!nextTask || (minutesUntilNext !== null && minutesUntilNext > 60)) && (!minutesUntilEnd || minutesUntilEnd > 120 || minutesUntilEnd <= 0)) return null;

                  return (
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                      {minutesUntilNext !== null && minutesUntilNext <= 30 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "flex-1 p-5 rounded-[2.5rem] flex items-center justify-between border shadow-2xl transition-all duration-500",
                            minutesUntilNext <= 5 
                              ? "bg-rose-50 border-rose-200 text-rose-900 shadow-rose-200/50 animate-pulse" 
                              : minutesUntilNext <= 15
                                ? "bg-amber-50 border-amber-200 text-amber-900 shadow-amber-200/50"
                                : cn(
                                    "bg-white border-slate-100 text-slate-900 shadow-slate-200/50",
                                    nextTask && DOMAIN_CONFIG[nextTask.task?.domain || '']?.light,
                                    nextTask && DOMAIN_CONFIG[nextTask.task?.domain || '']?.border
                                  )
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                              minutesUntilNext <= 5 
                                ? "bg-rose-100" 
                                : minutesUntilNext <= 15 
                                  ? "bg-amber-100" 
                                  : nextTask ? DOMAIN_CONFIG[nextTask.task?.domain || '']?.iconBg : "bg-slate-50"
                            )}>
                              <Zap size={24} className={cn(
                                minutesUntilNext <= 5 
                                  ? "text-rose-500" 
                                  : minutesUntilNext <= 15 
                                    ? "text-amber-500" 
                                    : nextTask ? DOMAIN_CONFIG[nextTask.task?.domain || '']?.text : "text-mint"
                              )} />
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">Next Task In</div>
                              <div className="text-3xl font-elegant italic font-black leading-none">{minutesUntilNext}m</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">
                              {nextTask?.task?.domain || 'Starts At'}
                            </div>
                            <div className="text-lg font-elegant italic font-black leading-none">{format(nextTask!.start, 'HH:mm')}</div>
                          </div>
                        </motion.div>
                      )}

                      {minutesUntilEnd !== null && minutesUntilEnd > 0 && minutesUntilEnd <= 120 && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex-1 p-5 rounded-[2.5rem] flex items-center justify-between border border-slate-100 bg-white text-slate-900 shadow-2xl shadow-slate-200/50 transition-all duration-500"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-inner">
                              <CheckCircle2 size={24} className="text-mint" />
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">Finish Line</div>
                              <div className="text-3xl font-elegant italic font-black leading-none">{minutesUntilEnd}m</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1 leading-none">Day Ends</div>
                            <div className="text-lg font-elegant italic font-black leading-none">{format(lastTask!.end, 'HH:mm')}</div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            
            {/* Timeline Column */}
            <section className="order-2 lg:order-1 lg:col-span-8 min-w-0 flex flex-col bg-white border-[0.5px] border-slate-50 shadow-2xl shadow-slate-100 rounded-[2rem] sm:rounded-[3rem] p-3 sm:p-4 lg:px-7 lg:py-8 overflow-hidden">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between mb-6 lg:mb-8 gap-4 px-1 sm:px-2 lg:px-0 flex-shrink-0 min-w-0">
                <div className="flex flex-col items-start lg:items-end lg:flex-row gap-3 min-w-0">
                    <div className="text-center lg:text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="group relative">
                            <Info size={12} className="text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-4 bg-white rounded-2xl shadow-2xl border border-slate-100 hidden group-hover:block z-50 animate-in fade-in zoom-in duration-200">
                              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2 underline decoration-indigo-200 decoration-2 underline-offset-4">📋 New Task Controls</div>
                              <div className="space-y-2.5">
                                <div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-ink uppercase mb-0.5">
                                    <ArrowRightLeft size={10} className="text-indigo-400" /> Exchange
                                  </div>
                                  <p className="text-[8.5px] font-medium text-dove/80 leading-relaxed">
                                    <span className="font-bold text-indigo-400">In Schedule:</span> Swaps priority with top overflow task to pull it in.<br/>
                                    <span className="font-bold text-indigo-400">In Overflow:</span> Promotes task by swapping with lower-priority scheduled task.
                                  </p>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-ink uppercase mb-0.5">
                                    <Scissors size={10} className="text-indigo-400" /> Split
                                  </div>
                                  <p className="text-[8.5px] font-medium text-dove/80 leading-relaxed">
                                    Cuts any task (10m+) into two equal sessions. Perfect for fitting tasks into smaller blocks.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <h2 className="text-[10px] lg:text-[8px] uppercase tracking-widest font-black text-slate-400 mb-0 leading-none">
                            {showWorkspaceContext ? 'Collaborative' : 'Personal'}
                          </h2>
                        </div>
                      <div className="text-3xl sm:text-4xl lg:text-3xl font-elegant italic font-black text-slate-800 leading-tight break-words">
                        {showTeamUI ? (organizations.find(o => o.id === activeOrgId)?.name || 'Group Flow') : 'Current Flow'}
                      </div>
                    </div>
                    {activeTasks.filter(t => isDateMatch(t.date, selectedDate) && (!activeOrgId || !selectedWorkerId || t.workerId === selectedWorkerId)).length > 0 && (
                     <button 
                       onClick={clearAllTasks}
                       className="text-[9px] lg:text-[8px] font-black uppercase text-red-300 hover:text-red-500 transition-colors mb-1"
                     >
                       Clear All
                     </button>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] lg:text-[9px] font-bold text-dove/60 bg-white shadow-sm px-4 py-2 rounded-2xl sm:rounded-full border-[0.5px] border-slate-100">
                   <div className="flex items-center gap-1.5">
                     <div className="w-2.5 h-2.5 rounded-full bg-mint" />
                     <span className="uppercase tracking-wider">Flow Locked</span>
                   </div>
                   <div className="flex items-center gap-1.5 border-l-[0.5px] border-slate-100 pl-3">
                     <div className="w-2.5 h-2.5 rounded-full bg-lavender" />
                     <span className="uppercase tracking-wider">Dream Zone</span>
                   </div>
                </div>
              </div>

              <div className="pr-0 sm:pr-1 space-y-6 pb-10 min-w-0">
                {/* Active Tasks */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {flow.scheduled.filter(t => !(t.type === 'task' && t.task?.status === 'complete')).map((item, idx) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ 
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                          delay: idx * 0.05 
                        }}
                        key={item.type === 'task' ? `${item.task?.id}-${item.start.getTime()}` : `item-${idx}-${item.start.getTime()}`}
                        className="relative group"
                      >
                        {item.type === 'gap' ? (
                          <div className="flex items-center gap-2.5 py-4 group/gap pl-12 lg:pl-12">
                             <div className="w-12 text-right">
                               <div className="text-[10px] font-black text-slate-200 uppercase tracking-widest">{format(item.start, 'HH:mm')}</div>
                             </div>
                             <div className={cn(
                               "flex-1 h-[2px] rounded-full transition-all duration-500",
                               item.title === 'Passed Time' ? "bg-slate-50" : "bg-slate-100 group-hover/gap:bg-indigo-100"
                             )} />
                             <div className="flex flex-col items-start gap-0.5">
                               <span className={cn(
                                 "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                 item.title === 'Passed Time' ? "bg-slate-50 text-slate-300" : "bg-indigo-50 text-indigo-400"
                               )}>
                                 {item.title} • {Math.round((item.end.getTime() - item.start.getTime()) / 60000)}m
                               </span>
                               {item.title === 'Passed Time' && (
                                 <span className="text-[8px] font-medium text-slate-300 italic ml-1">Cannot schedule in history</span>
                               )}
                             </div>
                             <div className={cn(
                               "flex-[0.5] h-[2px] rounded-full transition-all duration-500",
                               item.title === 'Passed Time' ? "bg-slate-50" : "bg-slate-100 group-hover/gap:bg-indigo-100"
                             )} />
                          </div>
                        ) : (
                          <div className="flex items-start sm:items-center gap-2.5 py-2 group min-w-0">
                            {/* Time Handle */}
                            <div className="w-12 text-right flex-shrink-0">
                              <div className="text-sm font-elegant italic font-black text-ink leading-none">{format(item.start, 'HH:mm')}</div>
                              <div className="text-[10px] font-black text-dove uppercase tracking-wider opacity-30 mt-1">{Math.round((item.end.getTime() - item.start.getTime()) / 60000)}m</div>
                            </div>

                            {/* Task Card */}
                            <div className={cn(
                              "flex-1 min-w-0 bg-white rounded-2xl py-3 pl-3 pr-3 sm:pr-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border-[0.5px] border-slate-100/60 transition-all relative overflow-hidden",
                              item.type === 'task' && "hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.06)] hover:border-mint/20 hover:-translate-y-0.5",
                              item.type === 'task' && DOMAIN_CONFIG[item.task!.domain]?.light
                            )}>
                            {/* Category Accent */}
                            {item.type === 'task' && (
                              <div className={cn("absolute left-0 top-0 bottom-0 w-1", DOMAIN_CONFIG[item.task!.domain]?.bg || 'bg-slate-200')} />
                            )}
                            
                            <div className="flex items-start sm:items-center gap-3 lg:gap-4 relative z-10 w-full min-w-0">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1 min-w-0">
                                  <span className={cn(
                                    "text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider shadow-sm flex items-center gap-1",
                                    item.type === 'task' ? (
                                      `bg-white ${DOMAIN_CONFIG[item.task!.domain]?.text} border-[0.5px] ${DOMAIN_CONFIG[item.task!.domain]?.border}`
                                    ) : "bg-slate-50 text-slate-400"
                                  )}>
                                    {item.type === 'task' && getDomainIcon(item.task!.domain, 10)}
                                    {item.type === 'task' ? item.task?.domain : item.type}
                                  </span>

                        </div>
                        <h3 className="text-base font-bold tracking-tight text-ink transition-all break-words leading-tight">
                          {capitalize(item.title)}
                        </h3>
                      </div>

                              {/* Checkbox Icon - Right Aligned */}
                              {item.type === 'task' ? (
                                <button 
                                  onClick={() => toggleTaskStatus(item.task!.id, item.task!.status)}
                                  className="w-9 h-9 lg:w-8 lg:h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md transition-all active:scale-90 border-[0.5px] bg-white border-slate-100 text-slate-200 hover:border-mint/30 hover:text-mint/40"
                                >
                                  <CheckCircle2 size={16} strokeWidth={2} />
                                </button>
                              ) : (
                                <div className="w-9 h-9 lg:w-8 lg:h-8 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-50 text-slate-200 border-[0.5px] border-slate-100">
                                   {item.type === 'sleep' ? <Moon size={16} /> : <Coffee size={16} />}
                                </div>
                              )}
                            </div>

                              {item.type === 'task' && (
                                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-50 opacity-60 group-hover:opacity-100 transition-all">
                                  {flow.overflow.length > 0 && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); exchangeTask(item.task!, flow.overflow[0]); }}
                                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-indigo-50/50 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all active:scale-95"
                                    >
                                      <ArrowRightLeft size={12} strokeWidth={2.5} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Exchange</span>
                                    </button>
                                  )}
                                  {item.task!.duration >= 10 && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); splitTask(item.task!); }}
                                      className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                                    >
                                      <Scissors size={12} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Split</span>
                                    </button>
                                  )}
                                  <div className="flex-1" />
                                  <button 
                                    onClick={() => deleteTask(item.task!.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Completed Subsection */}
                {flow.scheduled.some(t => t.type === 'task' && t.task?.status === 'complete') && (
                  <div className="pt-4 border-t-[0.5px] border-dashed border-slate-100">
                    <div className="flex items-center justify-between mb-4 px-2">
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-dove">Current Progress</h3>
                       <div className="flex-1 h-px bg-slate-100 ml-4" />
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {flow.scheduled.filter(t => t.type === 'task' && t.task?.status === 'complete').map((item) => {
                          const task = item.task!;
                          const isRecent = recentCompletions[task.id];
                          const secondsLeft = isRecent ? Math.max(0, 10 - Math.floor((Date.now() - isRecent) / 1000)) : 0;
                          
                          return (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, x: 20 }}
                              key={`${task.id}-${item.start.getTime()}`}
                              className="group flex items-center gap-3 pl-16 pr-1"
                            >
                              <div className={cn(
                                "flex-1 flex items-center justify-between bg-slate-50/50 rounded-xl p-2.5 px-4 border-[0.5px] border-transparent transition-all relative overflow-hidden",
                                DOMAIN_CONFIG[task.domain]?.light,
                                isRecent && "border-mint/20 ring-1 ring-mint/10"
                              )}>
                                {/* Category Accent */}
                                <div className={cn("absolute left-0 top-0 bottom-0 w-1 opacity-50", DOMAIN_CONFIG[task.domain]?.bg || 'bg-slate-200')} />
                                
                                <div className="flex items-center gap-3 min-w-0 relative z-10">
                                  <div className={cn("p-1 rounded-md", DOMAIN_CONFIG[task.domain]?.iconBg)}>
                                    {getDomainIcon(task.domain, 12, DOMAIN_CONFIG[task.domain]?.text)}
                                  </div>
                                  <span className="text-sm font-bold text-dove/60 line-through decoration-dove/30 break-words">{task.title}</span>
                                </div>
                                
                                {isRecent && (
                                  <button 
                                    onClick={() => toggleTaskStatus(task.id, 'complete')}
                                    className="flex items-center gap-2 bg-mint text-slate-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-mint/80 transition-all active:scale-95 shadow-sm"
                                  >
                                    <RefreshCw size={10} className="animate-spin-slow" />
                                    Undo {secondsLeft}s
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}


                {flow.scheduled.filter(t => t.type !== 'gap' && !(t.type === 'task' && t.task?.status === 'complete')).length === 0 && 
                 !flow.scheduled.some(t => t.type === 'task' && t.task?.status === 'complete') && (
                  <div className="py-20 text-center border-[0.5px] border-dashed border-slate-100 rounded-[3rem] bg-white/30 backdrop-blur-sm animate-in fade-in zoom-in duration-500">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-50">
                      <Brain size={32} className="text-mint/40" />
                    </div>
                    <div className="text-slate-800 text-2xl mb-2 font-elegant italic font-black">Ready to build</div>
                    <p className="text-dove text-xs max-w-[200px] mx-auto font-medium leading-relaxed">Your flow is clear. Add a task above to generate your precision schedule.</p>
                  </div>
                )}

                {/* Integrated Overflow (Backlog) */}
                {flow.overflow.length > 0 && (
                  <div className="pt-8 border-t-[0.5px] border-slate-100">
                    <div className="flex items-center justify-between mb-4 px-2">
                       <div className="flex items-center gap-2">
                          <div className="group relative">
                            <Info size={12} className="text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                            <div className="absolute left-0 bottom-full mb-2 w-64 p-4 bg-white rounded-2xl shadow-2xl border border-slate-100 hidden group-hover:block z-50 animate-in fade-in zoom-in duration-200">
                              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2 underline decoration-indigo-200 decoration-2 underline-offset-4">📋 New Task Controls</div>
                              <div className="space-y-2.5">
                                <div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-ink uppercase mb-0.5">
                                    <ArrowRightLeft size={10} className="text-indigo-400" /> Exchange
                                  </div>
                                  <p className="text-[8.5px] font-medium text-dove/80 leading-relaxed">
                                    <span className="font-bold text-indigo-400">In Schedule:</span> Swaps priority with top overflow task to pull it in.<br/>
                                    <span className="font-bold text-indigo-400">In Overflow:</span> Promotes task by swapping with lower-priority scheduled task.
                                  </p>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-ink uppercase mb-0.5">
                                    <Scissors size={10} className="text-indigo-400" /> Split
                                  </div>
                                  <p className="text-[8.5px] font-medium text-dove/80 leading-relaxed">
                                    Cuts any task (10m+) into two equal sessions. Perfect for fitting tasks into smaller blocks.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Rest of the List</h3>
                          <span className="bg-slate-50 text-[10px] font-black px-2 py-0.5 rounded-full text-dove border-[0.5px] border-slate-100">{flow.overflow.length} left</span>
                       </div>
                       <div className="flex-1 h-px bg-slate-50 ml-4" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
                      {flow.overflow.map(task => (
                        <div key={task.id} className={cn(
                          "p-4 rounded-2xl border-[0.5px] border-slate-100 hover:border-mint/30 transition-all hover:shadow-lg hover:shadow-slate-100 group/overflow relative overflow-hidden min-w-0",
                          DOMAIN_CONFIG[task.domain]?.light || "bg-white"
                        )}>
                          {/* Category Accent */}
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1", DOMAIN_CONFIG[task.domain]?.bg || 'bg-slate-200')} />
                          
                          <div className="flex items-center justify-between mb-2">
                            <span className={cn(
                              "text-[8px] uppercase font-black px-2 py-0.5 rounded-md shadow-sm border-[0.5px] flex items-center gap-1",
                              DOMAIN_CONFIG[task.domain]?.light,
                              DOMAIN_CONFIG[task.domain]?.text,
                              DOMAIN_CONFIG[task.domain]?.border
                            )}>
                              {getDomainIcon(task.domain, 10)}
                              {task.domain}
                            </span>
                            <span className="text-[10px] font-black text-slate-300 group-hover/overflow:text-mint transition-colors">{task.duration}M</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
                            <h4 className="text-sm font-bold tracking-tight text-slate-600 break-words flex-1 min-w-0 group-hover/overflow:text-ink">{capitalize(task.title)}</h4>
                            <div className="flex flex-wrap items-center gap-2 opacity-60 group-hover/overflow:opacity-100 transition-all">
                              <button 
                                onClick={(e) => { e.stopPropagation(); promoteTask(task); }}
                                className="h-9 px-3 rounded-xl flex items-center gap-2 bg-white border-[0.5px] border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-95 shadow-sm"
                              >
                                <ArrowRightLeft size={14} strokeWidth={2.5} />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Exchange</span>
                              </button>
                              {task.duration >= 10 && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); splitTask(task); }}
                                  className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border-[0.5px] border-slate-100 text-slate-400 hover:text-indigo-500 hover:border-indigo-100 transition-all active:scale-95 shadow-sm"
                                  title="Split in half"
                                >
                                  <Scissors size={13} />
                                </button>
                              )}
                              <button 
                                onClick={() => toggleTaskStatus(task.id, task.status)}
                                className="w-9 h-9 rounded-xl flex items-center justify-center bg-white border-[0.5px] border-slate-100 text-slate-200 hover:text-mint hover:border-mint/30 transition-all active:scale-95 shadow-sm"
                                title="Complete"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Side Column */}
            <aside className="order-1 lg:order-2 lg:col-span-4 flex flex-col gap-4 pb-5 lg:pb-0 scrollbar-hide">
              
               {/* Team Section (Org Mode) or Vibe Check (Personal Mode) */}
               {showTeamUI ? (
                 <div className="flex-shrink-0 bg-white border-[0.5px] border-emerald-100 rounded-[2.5rem] p-6 shadow-xl shadow-emerald-100/10 relative overflow-hidden flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-50 rounded-xl">
                          <Users className="text-emerald-500 w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-black tracking-tight font-elegant italic text-emerald-900">Collaborator Status</h3>
                      </div>
                      <button 
                         onClick={async () => {
                           const org = organizations.find(o => o.id === activeOrgId);
                           if (org) {
                             const link = buildAppLink({ join: org.joinCode });
                             try {
                               if (navigator.clipboard) {
                                 await navigator.clipboard.writeText(link);
                                 alert("Access link copied to clipboard!");
                               } else {
                                 prompt("Copy this access link:", link);
                               }
                             } catch (err) {
                               prompt("Copy this access link:", link);
                             }
                           }
                         }}
                         className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all active:scale-95 border border-mint/10"
                         title="Share Access Link"
                       >
                         <Share size={14} />
                       </button>
                    </div>

                    {currentMembership?.role === 'admin' && (
                      <div className="flex flex-col gap-2 p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100/50 mb-4 animate-in slide-in-from-top-1 fade-in text-left">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                          <SlidersHorizontal size={10} />
                          <span>Organize Members</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Filter by Role */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Role Filter</span>
                            <div className="relative">
                              <select
                                value={memberFilterRole || 'all'}
                                onChange={(e) => setMemberFilterRole(e.target.value as 'all' | 'admin' | 'worker')}
                                className="w-full bg-white border border-emerald-100 text-[10px] font-black text-emerald-950 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner appearance-none cursor-pointer pr-6 text-left"
                              >
                                <option value="all">All Roles</option>
                                <option value="admin">Admins Only</option>
                                <option value="worker">Workers Only</option>
                              </select>
                              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-emerald-600">
                                <Filter size={10} />
                              </div>
                            </div>
                          </div>

                          {/* Sort Order */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pl-1">Sort By</span>
                            <div className="relative">
                              <select
                                value={memberSort || 'alphabetical'}
                                onChange={(e) => setMemberSort(e.target.value as 'alphabetical' | 'alphabetical-desc' | 'role-admin' | 'role-worker')}
                                className="w-full bg-white border border-emerald-100 text-[10px] font-black text-emerald-950 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner appearance-none cursor-pointer pr-6 text-left"
                              >
                                <option value="alphabetical">A - Z Name</option>
                                <option value="alphabetical-desc">Z - A Name</option>
                                <option value="role-admin">Admin First</option>
                                <option value="role-worker">Worker First</option>
                              </select>
                              <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-emerald-600">
                                <ArrowUpDown size={10} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 mb-6">
                       {sortedAndFilteredMembers.map(member => {
                          const isAdmin = currentMembership?.role === 'admin';
                         const isSelf = member.userId === user?.uid;
                         return (
                           <div key={member.id} className="group/member flex items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-transparent hover:border-emerald-100 hover:bg-white transition-all shadow-sm relative">
                             <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-sm border border-mint/10">
                               {member.name?.[0] || 'U'}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-black text-ink truncate leading-none mb-1 text-left">
                                 {member.name || (isSelf ? 'You' : 'Member')}
                               </p>
                               <div className="flex items-center gap-2">
                                 <p className="text-[10px] font-bold text-dove uppercase tracking-wider truncate opacity-60">
                                   {member.jobTitle || 'Role Pending'}
                                 </p>
                                 {member.role === 'admin' && (
                                   <span className="text-[8px] font-black uppercase text-emerald-600 bg-white px-1 py-0.5 rounded border border-mint/20">Admin</span>
                                 )}
                               </div>
                             </div>
                             
                             {(isSelf || isAdmin) && (
                               <button 
                                 onClick={() => {
                                   setEditingMemberId(member.id);
                                   setEditMemberName(member.name || '');
                                   setEditMemberTitle(member.jobTitle || '');
                                   setEditMemberRole(member.role || 'worker');
                                 }}
                                 className="opacity-0 group-hover/member:opacity-100 p-1.5 text-dove hover:text-ink transition-opacity"
                               >
                                 <Settings size={12} />
                               </button>
                             )}
                           </div>
                         );
                       })}
                    </div>

                    <div className="mt-auto space-y-4">
                      {/* Unique Invites List - ADMIN ONLY */}
                      {currentMembership?.role === 'admin' && (
                        <>
                          {invites.length > 0 && (
                            <div className="space-y-2">
                               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800/40 px-1 text-left">Active Boarding Links</p>
                               {invites.map(invite => (
                                 <div key={invite.id} className="flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50 group/invite">
                                   <div className="flex items-center gap-2 overflow-hidden">
                                     <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center text-[10px] font-black text-emerald-600 border border-emerald-100 flex-shrink-0">
                                       {invite.name?.[0]}
                                     </div>
                                     <span className="text-[11px] font-bold text-emerald-900 truncate">{invite.name}</span>
                                   </div>
                                   <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/invite:opacity-100 transition-opacity">
                                     <button 
                                       onClick={async () => {
                                         const link = buildAppLink({ invite: invite.token });
                                         try {
                                           if (navigator.clipboard) {
                                             await navigator.clipboard.writeText(link);
                                             alert("Link copied!");
                                           }
                                         } catch (err) {
                                           prompt("Copy link:", link);
                                         }
                                       }}
                                       className="p-1 text-emerald-600 hover:bg-white rounded shadow-sm"
                                       title="Copy Link"
                                     >
                                       <LinkIcon size={12} />
                                     </button>
                                     <button 
                                       onClick={() => deleteInvite(invite.id)}
                                       className="p-1 text-rose-400 hover:bg-white rounded shadow-sm"
                                       title="Revoke"
                                     >
                                       <X size={12} />
                                     </button>
                                   </div>
                                 </div>
                               ))}
                            </div>
                          )}

                          <div className="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-100 shadow-sm relative overflow-hidden">
                             {isCreatingInvite && (
                               <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                                  <RefreshCw size={16} className="text-emerald-600 animate-spin" />
                               </div>
                             )}
                             <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-3 flex items-center gap-2 text-left">
                               <Users size={12} />
                               Invite Member
                             </p>
                              <div className="space-y-3 mb-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input 
                                    type="text"
                                    placeholder="Member Name"
                                    value={newInviteName || ''}
                                    onChange={(e) => setNewInviteName(e.target.value)}
                                    className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400"
                                  />
                                  <input 
                                    type="email"
                                    placeholder="Email Address (optional)"
                                    value={newInviteEmail || ''}
                                    onChange={(e) => setNewInviteEmail(e.target.value)}
                                    className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400"
                                  />
                                  <input 
                                    type="text"
                                    placeholder="Job Title (e.g. Engineer, PM)"
                                    value={newInviteJobTitle || ''}
                                    onChange={(e) => setNewInviteJobTitle(e.target.value)}
                                    className="bg-white border border-emerald-100 rounded-xl px-4 py-3 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner w-full text-ink placeholder-slate-400 md:col-span-2"
                                  />
                                </div>
                                
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[9px] font-black uppercase text-emerald-800/60 mr-1">Role:</span>
                                  <button
                                    type="button"
                                    onClick={() => setNewInviteRole('worker')}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                                      newInviteRole === 'worker' 
                                        ? "bg-slate-900 border-slate-900 text-white shadow-sm font-black"
                                        : "bg-white border-emerald-100 text-slate-500 hover:bg-slate-50"
                                    )}
                                  >
                                    Worker
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setNewInviteRole('admin')}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                                      newInviteRole === 'admin' 
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm font-black"
                                        : "bg-white border-emerald-100 text-slate-500 hover:bg-slate-50"
                                    )}
                                  >
                                    Admin
                                  </button>
                                  
                                  <button 
                                    onClick={createInvite}
                                    disabled={!newInviteName.trim() || isCreatingInvite}
                                    className="ml-auto bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                                  >
                                    Create Invite
                                  </button>
                                </div>
                              </div>
                              
                              {false && <div className="flex gap-2 mb-3" id="invite-form-container">
                               <input 
                                 type="text"
                                 placeholder="Member Name"
                                 value={newInviteName || ''}
                                 onChange={(e) => setNewInviteName(e.target.value)}
                                 onKeyDown={(e) => e.key === 'Enter' && createInvite()}
                                 className="flex-1 bg-white border border-emerald-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner"
                               />
                               <button 
                                 onClick={createInvite}
                                 disabled={!newInviteName.trim() || isCreatingInvite}
                                 className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                               >
                                 Create
                               </button>
                             </div>}
                             
                             {lastCreatedLink && (
                               <div className="mt-2 p-2 bg-white rounded-lg border border-emerald-100 animate-in zoom-in slide-in-from-top-2">
                                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 text-left">Link Generated!</p>
                                 <div className="flex items-center gap-2">
                                   <code className="text-[9px] font-mono bg-slate-50 p-1 rounded flex-1 truncate">{lastCreatedLink}</code>
                                   <button 
                                     onClick={() => {
                                       navigator.clipboard.writeText(lastCreatedLink);
                                       alert("Copied!");
                                     }}
                                     className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                   >
                                     <LinkIcon size={12} />
                                   </button>
                                 </div>
                               </div>
                             )}
                             <p className="text-[8px] text-emerald-800/40 leading-tight italic font-medium mt-2 text-left">Creates a secure link valid for 7 days.</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                <div className="flex-shrink-0 bg-white border-[0.5px] border-mint/20 rounded-[2.5rem] p-6 text-slate-900 shadow-xl shadow-mint/5 relative overflow-hidden group flex flex-col items-center text-center">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-mint/50" />
                  <div className="p-2 bg-mint/5 rounded-2xl mb-3 shadow-sm">
                     <Waves className="text-mint w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight mb-1 font-elegant italic text-slate-800">Vibe Check</h3>
                  <p className="text-[10px] text-dove font-medium leading-relaxed max-w-[280px] mb-4 italic">Assess your vitality to optimize focus windows.</p>
                  
                  {(() => {
                    const savedCheckIn = activeCheckIns.find(c => c.date === selectedDate);
                    const showResult = !!savedCheckIn || (vibeMood !== null && vibeEnergy !== null);
                    
                    if (showResult) {
                      const displayMood = vibeMood || savedCheckIn?.mood;
                      const displayEnergy = vibeEnergy || savedCheckIn?.energy;
                      
                      return (
                        <div className="animate-in fade-in slide-in-from-bottom-1 w-full flex flex-col items-center gap-3">
                          <div className="flex justify-center gap-3">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border-[0.5px] border-slate-100 shadow-sm transition-all hover:scale-105">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mood</span>
                               <span className="text-base">
                                 {(['😓','😐','🧘','⚡','👑'])[displayMood - 1] || '🧘'}
                               </span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border-[0.5px] border-slate-100 shadow-sm transition-all hover:scale-105">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Energy</span>
                               <span className="text-sm font-black text-mint">
                                 {displayEnergy ? (displayEnergy * 20) + '%' : '0%'}
                               </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setVibeMood(null);
                              setVibeEnergy(null);
                              if (isGuest) {
                                setGuestCheckIns(prev => prev.filter(c => c.date !== selectedDate));
                              } else {
                                deleteDoc(doc(db, 'checkIns', selectedDate));
                              }
                            }}
                            className="text-[9px] font-black uppercase text-slate-300 hover:text-slate-500 transition-colors"
                          >
                            Recalibrate
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4 w-full animate-in fade-in slide-in-from-bottom-1">
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-mint uppercase tracking-[0.2em]">Mindset State</p>
                        <div className="flex justify-center gap-1.5">
                          {[1,2,3,4,5].map(n => (
                            <button 
                              key={n}
                              onClick={() => setVibeMood(n)}
                              className={cn(
                                "w-10 h-10 rounded-2xl border-[0.5px] transition-all text-xl flex items-center justify-center shadow-md active:scale-90",
                                vibeMood === n 
                                  ? "bg-mint border-mint border-[0.5px] text-slate-900 scale-110" 
                                  : "bg-white border-slate-100 border-[0.5px] hover:border-mint/30"
                              )}
                            >
                              {(['😓','😐','🧘','⚡','👑'])[n-1]}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-lavender uppercase tracking-[0.2em]">Energy Level</p>
                        <div className="flex justify-center gap-1.5">
                          {[1,2,3,4,5].map(n => (
                            <button 
                              key={n}
                              onClick={() => setVibeEnergy(n)}
                              className={cn(
                                "w-10 h-10 rounded-2xl border-[0.5px] transition-all font-black text-xs flex items-center justify-center shadow-md active:scale-90",
                                vibeEnergy === n 
                                  ? "bg-lavender border-lavender border-[0.5px] text-slate-900 scale-110" 
                                  : "bg-white border-slate-100 border-[0.5px] text-slate-900 hover:border-lavender/30"
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        disabled={!vibeMood || !vibeEnergy}
                        onClick={() => {
                          if (vibeMood && vibeEnergy) {
                            logCheckIn(vibeMood, vibeEnergy);
                          }
                        }}
                        className="w-full bg-mint text-slate-900 py-3 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-mint/20 active:scale-95 transition-all mt-2"
                      >
                        Log Analysis
                      </button>
                    </div>
                  );
                })()}
              </div>
               )}
 
               {/* Sleep Protection & Countdown - Lavender Theme */}
               <div className={cn(
                 "flex-shrink-0 border-[0.5px] rounded-3xl p-5 relative shadow-xl transition-all duration-700 overflow-hidden group/sleep",
                 isInWindDown 
                  ? "bg-indigo-50 border-indigo-200 shadow-indigo-100/50 scale-[1.02]" 
                  : "bg-white border-lavender/30 shadow-lavender/5"
               )}>
                  {isInWindDown && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0.05, 0.1, 0.05] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="absolute inset-0 bg-indigo-500 pointer-events-none"
                    />
                  )}
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-lavender/5 -skew-x-12 translate-x-1/2 pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-xl transition-colors",
                        isInWindDown ? "bg-indigo-100 text-indigo-600" : "bg-lavender/10 text-lavender"
                      )}>
                        <Moon size={16} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[10px] uppercase tracking-widest font-black text-ink leading-none">
                          {isInWindDown ? 'Wind Down Active' : 'Sleep Protection'}
                        </h3>
                        {isInWindDown && (
                          <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter mt-1">Deep Recovery Approaching</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => { setTempSettings(activeSettings); setIsSettingsOpen(true); }} className="hover:text-lavender p-1 transition-colors">
                      <Settings size={12} className="text-lavender/40 hover:text-lavender" />
                    </button>
                  </div>
  
                  <div className="flex items-end justify-between relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl font-black text-ink">{activeSettings.sleepStart}</span>
                        <span className="text-slate-300 font-bold">—</span>
                        <span className="text-2xl font-black text-ink">{activeSettings.sleepEnd}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 bg-slate-100 rounded-full w-24 overflow-hidden">
                          {minutesUntilSleep > 0 && minutesUntilSleep <= 360 && (
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(0, Math.min(100, (1 - minutesUntilSleep / 360) * 100))}%` }}
                              className="h-full bg-indigo-400"
                            />
                          )}
                        </div>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Hard Bound</span>
                      </div>
                    </div>

                    {isTodayStatus && minutesUntilSleep > 0 && minutesUntilSleep <= 180 && (
                      <div className="text-right">
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Countdown</div>
                        <div className="text-3xl font-elegant italic font-black text-indigo-900 leading-none">
                          {Math.floor(minutesUntilSleep / 60)}h {minutesUntilSleep % 60}m
                        </div>
                      </div>
                    )}
                  </div>

                  {isInWindDown && (
                    <div className="mt-4 pt-4 border-t border-indigo-100/50 relative z-10">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                        <p className="text-[10px] font-bold italic">Schedule locked for sleep transition.</p>
                      </div>
                    </div>
                  )}
               </div>
             </aside>
          </div>
          )}
        </div>
      </div>
    </main>

      {/* Organization Creation Modal */}
      <AnimatePresence>
        {isOrgModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-500/20 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-md p-5 sm:p-8 lg:p-10 shadow-2xl relative border-[0.5px] border-slate-100 safe-scroll-panel"
            >
              <button 
                onClick={() => setIsOrgModalOpen(false)}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 text-dove hover:text-ink transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-mint">
                  <Building2 size={32} />
                </div>
                <h3 className="text-2xl font-elegant font-black italic text-ink mb-2">Create Organization</h3>
                <p className="text-[10px] text-dove font-bold uppercase tracking-widest px-4">Launch a collaborative environment</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-dove uppercase tracking-[0.2em] ml-2">Organization Name</label>
                  <input 
                    type="text" 
                    value={newOrgName || ''}
                    onChange={(e) => {
                      setNewOrgName(e.target.value);
                      if (orgError) setOrgError(null);
                    }}
                    placeholder="e.g. Design Studio, Marketing Hub..."
                    className="w-full bg-slate-50/80 border-[0.5px] border-slate-100 rounded-2xl px-6 py-4 text-sm font-elegant italic font-black focus:ring-8 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                  {orgError && (
                    <p className="text-[10px] text-red-500 font-bold px-2 mt-1 animate-in fade-in slide-in-from-top-1">
                      Error: {orgError}
                    </p>
                  )}
                </div>

                <div className="p-4 bg-soft-purple rounded-2xl border-[0.5px] border-lavender/20">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-lavender shadow-sm shrink-0">
                      <LinkIcon size={14} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-ink uppercase tracking-tight">Auto-Join Link</p>
                      <p className="text-[10px] text-dove leading-relaxed">System will generate a unique link for your employees to join instantly.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={createOrganization}
                  disabled={!newOrgName.trim() || isCreatingOrg}
                  className="w-full bg-mint text-ink py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-mint/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreatingOrg ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Launching...
                    </>
                  ) : (
                    "Confirm & Launch"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Profile Modal */}
      <AnimatePresence>
        {editingMemberId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-sm p-5 sm:p-8 shadow-2xl relative border border-slate-100 safe-scroll-panel"
            >
              <button 
                onClick={() => setEditingMemberId(null)}
                className="absolute top-6 right-6 p-2 text-dove hover:text-ink transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3 text-mint border border-mint/20">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-elegant font-black italic text-ink mb-1">Your Profile</h3>
                <p className="text-[8px] text-dove font-bold uppercase tracking-widest">How you appear to partners</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-dove uppercase tracking-widest ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={editMemberName || ''}
                    onChange={(e) => setEditMemberName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black italic focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-dove uppercase tracking-widest ml-1">Job Title</label>
                  <input 
                    type="text" 
                    value={editMemberTitle || ''}
                    onChange={(e) => setEditMemberTitle(e.target.value)}
                    placeholder="e.g. Lead Designer"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-black italic focus:ring-4 focus:ring-mint/5 focus:outline-none transition-all"
                  />
                </div>

                {currentMembership?.role === 'admin' ? (
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-dove uppercase tracking-widest ml-1">Member Role</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMemberRole('worker')}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-[0.98]",
                          editMemberRole === 'worker' 
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm font-black"
                            : "bg-slate-50 border-slate-200 text-dove hover:bg-slate-100"
                        )}
                      >
                        Worker
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditMemberRole('admin')}
                        className={cn(
                          "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all active:scale-[0.98]",
                          editMemberRole === 'admin' 
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm font-black"
                            : "bg-slate-50 border-slate-200 text-dove hover:bg-slate-100"
                        )}
                      >
                        Admin
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 bg-slate-50 border border-slate-150 rounded-xl p-3 text-left">
                    <label className="text-[6px] font-black text-dove uppercase tracking-widest block">Active Member Role</label>
                    <p className="text-[10px] font-black uppercase text-ink flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full", editMemberRole === 'admin' ? "bg-mint" : "bg-slate-400")} />
                      {editMemberRole}
                    </p>
                  </div>
                )}

                <button 
                  onClick={updateMembership}
                  className="w-full bg-mint text-ink py-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-mint/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-2"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Work Schedule Modal */}
      <AnimatePresence>
        {isWorkScheduleOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-slate-500/20 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] w-full max-w-2xl p-4 sm:p-6 lg:p-8 shadow-2xl relative border-[0.5px] border-slate-100 text-left safe-scroll-panel"
            >
              <button
                onClick={() => setIsWorkScheduleOpen(false)}
                className="absolute top-6 right-6 p-2 text-dove hover:text-ink transition-colors"
              >
                <X size={22} />
              </button>

              <div className="mb-6 pr-10">
                <div className="flex items-center gap-2 text-slate-900 mb-2">
                  <Briefcase size={20} />
                  <h3 className="text-2xl font-elegant font-black italic text-ink">Work Schedule</h3>
                </div>
                <p className="text-[10px] text-dove font-black uppercase tracking-widest">
                  Generates fixed work blocks on matching calendar dates
                </p>
              </div>

              <div className="space-y-5 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Schedule Name</label>
                    <input
                      value={workScheduleName}
                      onChange={(e) => setWorkScheduleName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-mint/10"
                      placeholder="Work, School, Clinicals..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Weeks</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={workScheduleMode === 'custom4' ? 4 : workScheduleWeeks}
                      onChange={(e) => setWorkScheduleWeeks(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                      disabled={workScheduleMode === 'custom4'}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-mint/10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-1 border border-slate-100">
                  {[
                    ['consistent', 'Consistent Week'],
                    ['alternating', 'Alternating Weeks'],
                    ['custom4', '4 Custom Weeks']
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setWorkScheduleMode(mode as WorkScheduleMode);
                        if (mode === 'custom4') setWorkScheduleWeeks(4);
                      }}
                      className={cn(
                        "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        workScheduleMode === mode ? "bg-white text-slate-950 shadow-sm" : "text-slate-400 hover:text-slate-700"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {((workScheduleMode === 'custom4'
                  ? ['A', 'B', 'C', 'D']
                  : ['A', ...(workScheduleMode === 'alternating' ? ['B'] : [])]) as Array<'A' | 'B' | 'C' | 'D'>).map((weekKey, weekIndex) => {
                  const week = weekKey === 'A' ? workWeekA : weekKey === 'B' ? workWeekB : weekKey === 'C' ? workWeekC : workWeekD;
                  return (
                    <section key={weekKey} className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4 shadow-sm">
                      <div className="flex flex-col min-[460px]:flex-row min-[460px]:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-800">
                            {workScheduleMode === 'custom4'
                              ? `Week ${weekIndex + 1}`
                              : workScheduleMode === 'alternating'
                                ? `Week ${weekKey}`
                                : 'Weekly Pattern'}
                          </h4>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">
                            Starts from the week containing {(() => {
                              try {
                                return format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'MMM d');
                              } catch {
                                return selectedDate;
                              }
                            })()}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full min-[460px]:w-40">
                          <input
                            type="time"
                            value={week.start}
                            onChange={(e) => updateWorkWeek(weekKey, { start: e.target.value })}
                            className="min-w-0 bg-slate-50 border border-slate-100 rounded-lg px-2 py-2 text-xs font-black focus:outline-none"
                          />
                          <input
                            type="time"
                            value={week.end}
                            onChange={(e) => updateWorkWeek(weekKey, { end: e.target.value })}
                            className="min-w-0 bg-slate-50 border border-slate-100 rounded-lg px-2 py-2 text-xs font-black focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                          <button
                            key={`${weekKey}-${day}`}
                            type="button"
                            onClick={() => toggleWorkScheduleDay(weekKey, i)}
                            className={cn(
                              "w-12 h-9 rounded-lg text-[9px] font-black uppercase tracking-wide border transition-all",
                              week.days.includes(i)
                                ? "bg-mint border-mint text-ink shadow-sm"
                                : "bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-700"
                            )}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}

                <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4 text-[10px] text-emerald-800 font-bold leading-relaxed">
                  Work blocks are added as fixed commitments on their real dates. The optimizer will build meals, tasks, workouts, buffers, and wind-down around them.
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsWorkScheduleOpen(false)}
                  className="sm:w-36 py-4 rounded-2xl border border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateWorkSchedule}
                  className="flex-1 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 active:scale-[0.98] transition-all"
                >
                  Add Work Blocks To Calendar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 lg:p-6 bg-slate-500/20 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-lg p-5 sm:p-8 lg:p-10 shadow-2xl relative border-[0.5px] border-slate-100 safe-scroll-panel"
            >
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2 text-dove hover:text-ink transition-colors"
              >
                <X size={24} />
              </button>

              <div className="mb-8">
                <h3 className="text-3xl font-elegant font-black italic text-ink mb-2">
                  {showWorkspaceContext ? 'Organization Settings' : 'Control Center'}
                </h3>
                <p className="text-xs text-dove font-bold uppercase tracking-widest">
                  {showWorkspaceContext ? 'Management & Configuration' : 'Calibrate your flow experience'}
                </p>
              </div>

              <div className="space-y-6 sm:space-y-8 overflow-y-auto pr-1 sm:pr-2">
                {/* Workspace Management (Admins Only) */}
                {showWorkspaceContext && currentMembership?.role === 'admin' && (
                  <section className="space-y-6 pt-2">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Building2 size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Organization Core</h4>
                    </div>
                    
                    <div className="space-y-4 bg-emerald-50/50 rounded-3xl p-6 border border-emerald-100/50">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-emerald-800 uppercase tracking-wider ml-1">Organization Name</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            defaultValue={organizations.find(o => o.id === activeOrgId)?.name || ''}
                            onBlur={(e) => handleUpdateOrgName(e.target.value)}
                            placeholder="e.g. Acme Studio"
                            className="flex-1 bg-white border-[0.5px] border-emerald-100 rounded-2xl px-5 py-4 text-sm font-elegant italic font-black focus:ring-4 focus:ring-emerald-500/10 focus:outline-none transition-all" 
                          />
                        </div>
                      </div>

                      {/* Join Code Management Block */}
                      <div className="pt-4 border-t border-emerald-100/50 space-y-3 text-left">
                        <label className="text-[9px] font-black text-emerald-800 uppercase tracking-wider ml-1 block">Join Code & Permissions</label>
                        <div className="bg-white rounded-2xl p-4 border border-emerald-100/30 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-black text-slate-800 tracking-wider">
                                {organizations.find(o => o.id === activeOrgId)?.joinCode || '------'}
                              </span>
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full select-none",
                                organizations.find(o => o.id === activeOrgId)?.joinCodeEnabled !== false
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              )}>
                                {organizations.find(o => o.id === activeOrgId)?.joinCodeEnabled !== false ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-snug">
                              General code for workers to join.
                            </p>
                          </div>
                          
                          <div className="flex gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                const org = organizations.find(o => o.id === activeOrgId);
                                if (org) {
                                  navigator.clipboard.writeText(org.joinCode);
                                  alert("Join code copied to clipboard!");
                                }
                              }}
                              className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all active:scale-95"
                              title="Copy Code Only"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const org = organizations.find(o => o.id === activeOrgId);
                                if (org) {
                                  const confirmed = confirm("Are you sure you want to regenerate the join code? Any old codes or general join links will immediately be invalidated.");
                                  if (confirmed) {
                                    try {
                                      const newCode = generateWorkspaceCode();
                                      const batch = writeBatch(db);
                                      batch.update(doc(db, 'organizations', org.id), {
                                        joinCode: newCode
                                      });
                                      batch.delete(doc(db, 'workspaceCodes', org.joinCode));
                                      batch.set(doc(db, 'workspaceCodes', newCode), {
                                        orgId: org.id,
                                        orgName: org.name,
                                        enabled: org.joinCodeEnabled !== false,
                                        adminId: org.adminId,
                                        createdAt: serverTimestamp()
                                      });
                                      await batch.commit();
                                      alert(`New join code generated: ${newCode}`);
                                    } catch (err: any) {
                                      alert("Failed to regenerate code: " + err.message);
                                    }
                                  }
                                }
                              }}
                              className="p-2 text-slate-500 hover:text-indigo-700 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all active:scale-95"
                              title="Regenerate Code"
                            >
                              <RefreshCw size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                const org = organizations.find(o => o.id === activeOrgId);
                                if (org) {
                                  const currentlyEnabled = org.joinCodeEnabled !== false;
                                  try {
                                    const batch = writeBatch(db);
                                    batch.update(doc(db, 'organizations', org.id), {
                                      joinCodeEnabled: !currentlyEnabled
                                    });
                                    batch.set(doc(db, 'workspaceCodes', org.joinCode), {
                                      orgId: org.id,
                                      orgName: org.name,
                                      enabled: !currentlyEnabled,
                                      adminId: org.adminId,
                                      createdAt: serverTimestamp()
                                    }, { merge: true });
                                    await batch.commit();
                                  } catch (err: any) {
                                    alert("Failed to update status: " + err.message);
                                  }
                                }
                              }}
                              className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-xl border transition-all active:scale-95",
                                organizations.find(o => o.id === activeOrgId)?.joinCodeEnabled !== false
                                  ? "text-red-600 hover:bg-red-50 border-red-100"
                                  : "text-emerald-600 hover:bg-emerald-50 border-emerald-100"
                              )}
                            >
                              {organizations.find(o => o.id === activeOrgId)?.joinCodeEnabled !== false ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-emerald-100/50">
                        <div className="flex items-center justify-between mb-4">
                           <label className="text-[9px] font-black text-emerald-800 uppercase tracking-wider ml-1">Members</label>
                           <button 
                             onClick={() => {
                               const org = organizations.find(o => o.id === activeOrgId);
                               if (org) {
                                 navigator.clipboard.writeText(buildAppLink({ join: org.joinCode }));
                                 alert("Invite link copied to clipboard!");
                               }
                             }}
                             className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-white px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-all active:scale-95"
                           >
                             Copy Invite Link
                           </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {activeOrgMembers.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-emerald-100/30">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-black text-emerald-600">
                                  {member.name?.[0] || 'U'}
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-xs font-black text-slate-800">{member.name || 'Anonymous User'}</span>
                                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{member.jobTitle || member.role}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingMemberId(member.id);
                                  setEditMemberName(member.name || '');
                                  setEditMemberTitle(member.jobTitle || '');
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                              >
                                <Settings size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-emerald-100/50">
                        <button 
                          onClick={async () => {
                            const org = organizations.find(o => o.id === activeOrgId);
                            if (org && confirm(`Are you sure you want to delete ${org.name}? This will remove all members and data.`)) {
                              try {
                                const msSnap = await getDocs(query(collection(db, 'memberships'), where('orgId', '==', org.id)));
                                const batch = writeBatch(db);
                                msSnap.docs.forEach(d => batch.delete(d.ref));
                                batch.delete(doc(db, 'organizations', org.id));
                                await batch.commit();
                                setActiveOrgId(null);
                                setIsSettingsOpen(false);
                              } catch (e) { console.error(e); }
                            }
                          }}
                          className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all border border-dashed border-red-100"
                        >
                          Delete Collaboration permanently
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Workspaces for Individual / Switch Org */}
                {activeTab === 'workspaces' && (!activeOrgId || isIndividual) && (
                  <section className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 text-indigo-700">
                      <Building2 size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Workspaces</h4>
                    </div>
                    
                    <div className="space-y-3 bg-indigo-50/30 border border-indigo-100 rounded-3xl p-6 text-left">
                      <p className="text-[11px] text-slate-500 leading-relaxed font-bold uppercase tracking-wide">
                        You are in <span className="text-indigo-600 font-extrabold">Solo Space (Individual Mode)</span>. Switch to or create a collaborative workspace to synchronize goals with your team.
                      </p>
                      
                      <div className="flex flex-col min-[420px]:flex-row gap-2.5 pt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSettingsOpen(false);
                            setIsOrgModalOpen(true);
                          }}
                          className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Plus size={10} />
                          Create Org
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setIsSettingsOpen(false);
                            setActiveTab('workspaces');
                          }}
                          className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Users size={10} />
                          Join Org
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                {/* Sleep Schedule Section */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-violet-700">
                    <Moon size={18} />
                    <h4 className="text-xs font-black uppercase tracking-widest">Sleep & Routines</h4>
                  </div>
                  <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Bedtime</label>
                      <input 
                        type="time" 
                        value={tempSettings.sleepStart || '23:00'} 
                        onChange={(e) => setTempSettings({...tempSettings, sleepStart: e.target.value})} 
                        className="w-full bg-slate-50/80 border-[0.5px] border-slate-100 rounded-2xl px-5 py-4 text-sm font-elegant italic font-black focus:ring-4 focus:ring-lavender/10 focus:outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Wake Up</label>
                      <input 
                        type="time" 
                        value={tempSettings.sleepEnd || '07:00'} 
                        onChange={(e) => {
                          const nextWake = e.target.value;
                          setTempSettings({
                            ...tempSettings,
                            sleepEnd: nextWake,
                            alarmTime: (!tempSettings.alarmTime || tempSettings.alarmTime === tempSettings.sleepEnd) ? nextWake : tempSettings.alarmTime
                          });
                        }} 
                        className="w-full bg-slate-50/80 border-[0.5px] border-slate-100 rounded-2xl px-5 py-4 text-sm font-elegant italic font-black focus:ring-4 focus:ring-lavender/10 focus:outline-none transition-all" 
                      />
                    </div>
                    <div className="min-[380px]:col-span-2 rounded-2xl bg-violet-50/60 border border-violet-100 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-violet-800">
                          <Bell size={15} />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest">Wake Alarm</p>
                            <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wide">Wake-up is an alert, not a task</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTempSettings({
                            ...tempSettings,
                            alarmEnabled: !tempSettings.alarmEnabled,
                            alarmTime: tempSettings.alarmTime || tempSettings.sleepEnd || '07:00'
                          })}
                          className={cn(
                            "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                            tempSettings.alarmEnabled
                              ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                              : "bg-white border-violet-100 text-violet-400"
                          )}
                        >
                          {tempSettings.alarmEnabled ? 'On' : 'Off'}
                        </button>
                      </div>
                      {tempSettings.alarmEnabled && (
                        <input
                          type="time"
                          value={tempSettings.alarmTime || tempSettings.sleepEnd || '07:00'}
                          onChange={(e) => setTempSettings({ ...tempSettings, alarmTime: e.target.value })}
                          className="w-full bg-white border border-violet-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-4 focus:ring-violet-500/10 focus:outline-none transition-all"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Morning Routine (min)</label>
                      <input 
                        type="number" 
                        value={tempSettings.morningRoutine ?? 0} 
                        onChange={(e) => setTempSettings({...tempSettings, morningRoutine: Math.max(0, parseInt(e.target.value) || 0)})} 
                        className="w-full bg-slate-50/80 border-[0.5px] border-slate-100 rounded-2xl px-5 py-4 text-sm font-elegant italic font-black focus:ring-4 focus:ring-lavender/10 focus:outline-none transition-all" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-dove uppercase tracking-wider ml-1">Evening Routine (min)</label>
                      <input 
                        type="number" 
                        value={tempSettings.eveningRoutine ?? 0} 
                        onChange={(e) => setTempSettings({...tempSettings, eveningRoutine: Math.max(0, parseInt(e.target.value) || 0)})} 
                        className="w-full bg-slate-50/80 border-[0.5px] border-slate-100 rounded-2xl px-5 py-4 text-sm font-elegant italic font-black focus:ring-4 focus:ring-lavender/10 focus:outline-none transition-all" 
                      />
                    </div>
                  </div>
                </section>

                {/* Account Section */}
                <section className="space-y-4 pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <LayoutDashboard size={18} />
                    <h4 className="text-xs font-black uppercase tracking-widest">Account Status</h4>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {user ? (
                        <div className="flex items-center gap-3 min-w-0">
                          {user.photoURL ? (
                            <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="Avatar" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-ink font-black">{user.displayName?.[0] || 'U'}</div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-black text-ink">{user.displayName || 'Developer'}</p>
                            <p className="text-[10px] text-dove font-medium truncate">{user.email}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-black">?</div>
                          <div>
                            <p className="text-sm font-black text-ink">Guest Explorer</p>
                            <p className="text-[10px] text-dove font-medium">Local Data Only</p>
                          </div>
                        </div>
                      )}
                    </div>
                    {user ? (
                      <button 
                        onClick={async () => {
                          try {
                            localStorage.removeItem('flowstate_guest');
                            localStorage.removeItem('flowstate_active_org');
                            setIsGuest(false);
                            await auth.signOut();
                          } catch (err) {
                            console.error("Sign out error:", err);
                          }
                        }}
                        className="text-[10px] font-black uppercase text-red-400 hover:text-red-500 transition-colors"
                      >
                        Sign Out
                      </button>
                    ) : (
                      <button 
                        onClick={handleSignIn}
                        className="bg-mint text-ink px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:scale-105 active:scale-95 transition-all"
                      >
                        Unlock Cloud
                      </button>
                    )}
                  </div>
                </section>

                {/* Quick Actions */}
                {isGuest && (
                  <section className="space-y-4 pt-6 border-t border-slate-50">
                     <div className="flex items-center gap-2 text-slate-400">
                      <Scissors size={18} />
                      <h4 className="text-xs font-black uppercase tracking-widest">Danger Zone</h4>
                    </div>
                    <button 
                      onClick={() => {
                        if (confirm("Delete all guest data? This cannot be undone.")) {
                          localStorage.clear();
                          window.location.reload();
                        }
                      }}
                      className="w-full py-4 rounded-2xl border border-red-100 text-red-400 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                      <X size={14} />
                      Wipe Local Storage
                    </button>
                  </section>
                )}
              </div>

              <div className="mt-10">
                <button 
                  onClick={() => {
                    saveSettings(tempSettings);
                    setIsSettingsOpen(false);
                  }}
                  className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-xl hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Lock In Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Workspace Invitation Popup */}
      <AnimatePresence>
        {pendingJoinData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-sm p-6 sm:p-10 shadow-2xl relative border border-white/20 text-center overflow-hidden safe-scroll-panel"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-mint via-lavender to-mint shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
              
              <div className="mb-8">
                <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-mint border-2 border-emerald-100/50 shadow-inner relative group">
                   <div className="absolute inset-0 bg-mint/5 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                   <Building2 size={36} className="relative transition-transform duration-500 hover:rotate-6" />
                </div>
                <h3 className="text-2xl font-black text-ink mb-2 leading-tight">Workspace Invite</h3>
                <p className="text-sm text-dove font-medium leading-relaxed px-2">
                  {pendingJoinData.invitedName ? `${pendingJoinData.invitedName}, you've` : "You've"} been invited to join <span className="font-black text-emerald-600">"{pendingJoinData.orgName}"</span> as a workspace member.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmJoin}
                  disabled={isJoining}
                  className="w-full bg-slate-900 text-white h-16 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isJoining ? (
                    <>
                      <RefreshCw size={14} className="animate-spin text-mint" />
                      <span>Joining workspace...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Join Workspace
                    </>
                  )}
                </button>
                
                <button 
                  onClick={declineJoin}
                  disabled={isJoining}
                  className="w-full h-16 rounded-2xl text-dove font-bold text-sm uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
                >
                  Decline
                </button>
              </div>

              <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
                Authorized by Workspace Admin
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
);
}

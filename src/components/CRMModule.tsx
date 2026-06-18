import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  CRMContact, 
  CRMAccount, 
  CRMLead, 
  CRMOpportunity, 
  CRMActivity, 
  CRMAppointment, 
  CRMQuoteInvoice, 
  CRMAuditLog 
} from '../lib/crmTypes';
interface Membership {
  id: string;
  userId: string;
  orgId: string;
  name?: string;
  jobTitle?: string;
  role: 'admin' | 'worker';
  joinedAt: any;
}
import { 
  Users, 
  Building2, 
  Target, 
  DollarSign, 
  Briefcase, 
  Activity, 
  Calendar as CalendarIcon, 
  FileText, 
  ShieldCheck, 
  TrendingUp, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  UserPlus, 
  Phone, 
  Mail, 
  Clock, 
  FileCheck, 
  ArrowRight, 
  ChevronRight,
  Sparkles,
  BarChart2,
  CalendarDays,
  UserCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

interface CRMModuleProps {
  orgId: string;
  userId: string;
  userEmail: string;
  userName: string;
  members: Membership[];
  role: 'admin' | 'worker';
  workspaceTab?: 'customers' | 'leads' | 'opportunities' | 'accounts' | 'activities' | 'calendar' | 'quotes' | 'invoices' | 'reports';
}

type TabType = 'dashboard' | 'contacts' | 'pipeline' | 'calendar' | 'quotes' | 'audit';

export function CRMModule({ orgId, userId, userEmail, userName, members, role, workspaceTab }: CRMModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<TabType>('dashboard');
  
  // Real-time Firestore Sync State
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [appointments, setAppointments] = useState<CRMAppointment[]>([]);
  const [quotesInvoices, setQuotesInvoices] = useState<CRMQuoteInvoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<CRMAuditLog[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  // Modal / Form trigger States
  const [showContactModal, setShowContactModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Form Field States
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', accountId: '', status: 'active' as 'active' | 'inactive' });
  const [accountForm, setAccountForm] = useState({ name: '', industry: '', website: '', phone: '', status: 'active' as 'active' | 'inactive' });
  const [leadForm, setLeadForm] = useState({ title: '', estimateValue: 0, contactId: '', accountId: '', stage: 'new' as 'new' | 'contacted' | 'qualified' | 'lost', confidence: 50, source: 'Web', assignedWorkerId: '', notes: '' });
  const [oppForm, setOppForm] = useState({ title: '', value: 0, leadId: '', stage: 'qualification' as 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost', probability: 50, closeDate: '', assignedWorkerId: '' });
  const [activityForm, setActivityForm] = useState({ type: 'call' as 'call' | 'email' | 'meeting' | 'task', subject: '', description: '', entityType: 'contact' as 'contact' | 'lead' | 'opportunity' | 'account', entityId: '', status: 'completed' as 'completed' | 'scheduled', date: '' });
  const [appointmentForm, setAppointmentForm] = useState({ title: '', description: '', start: '', end: '', contactId: '', attendeeEmails: '' });
  const [quoteForm, setQuoteForm] = useState({ type: 'quote' as 'quote' | 'invoice', number: '', title: '', customerId: '', customerType: 'contact' as 'contact' | 'account', tax: 5, discount: 0, status: 'draft' as 'draft' | 'sent' | 'paid' | 'expired', date: '', dueDate: '' });
  const [quoteItems, setQuoteItems] = useState<{ description: string; quantity: number; price: number }[]>([{ description: '', quantity: 1, price: 0 }]);

  // Selection Detail target
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(null);
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);

  // Sync activeSubTab and selections with workspaceTab
  useEffect(() => {
    if (workspaceTab) {
      if (workspaceTab === 'customers') {
        setActiveSubTab('contacts');
      } else if (workspaceTab === 'accounts') {
        setActiveSubTab('contacts');
      } else if (workspaceTab === 'leads') {
        setActiveSubTab('pipeline');
      } else if (workspaceTab === 'opportunities') {
        setActiveSubTab('pipeline');
      } else if (workspaceTab === 'activities') {
        setActiveSubTab('contacts');
      } else if (workspaceTab === 'calendar') {
        setActiveSubTab('calendar');
      } else if (workspaceTab === 'quotes') {
        setActiveSubTab('quotes');
      } else if (workspaceTab === 'invoices') {
        setActiveSubTab('quotes');
      } else if (workspaceTab === 'reports') {
        setActiveSubTab('dashboard');
      }
    }
  }, [workspaceTab]);

  // Sync Data on OrgID mount
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);

    const unsubscribes = [
      // 1. Sync Contacts
      onSnapshot(
        query(collection(db, 'crm_contacts'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMContact));
          setContacts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_contacts')
      ),
      // 2. Sync Accounts
      onSnapshot(
        query(collection(db, 'crm_accounts'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMAccount));
          setAccounts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_accounts')
      ),
      // 3. Sync Leads
      onSnapshot(
        query(collection(db, 'crm_leads'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMLead));
          setLeads(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_leads')
      ),
      // 4. Sync Opportunities
      onSnapshot(
        query(collection(db, 'crm_opportunities'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMOpportunity));
          setOpportunities(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_opportunities')
      ),
      // 5. Sync Activities
      onSnapshot(
        query(collection(db, 'crm_activities'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMActivity));
          setActivities(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_activities')
      ),
      // 6. Sync Appointments
      onSnapshot(
        query(collection(db, 'crm_appointments'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMAppointment));
          setAppointments(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_appointments')
      ),
      // 7. Sync Quotes & Invoices
      onSnapshot(
        query(collection(db, 'crm_quotes_invoices'), where('orgId', '==', orgId)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMQuoteInvoice));
          setQuotesInvoices(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_quotes_invoices')
      ),
      // 8. Sync Audit Logs
      onSnapshot(
        query(collection(db, 'crm_audit_logs'), where('orgId', '==', orgId), limit(100)),
        (snap) => {
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CRMAuditLog));
          // Sort client-side to avoid requiring manual composite index creation in Firebase
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAuditLogs(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'crm_audit_logs')
      )
    ];

    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [orgId]);

  // Write immutable security CRM audit log helper
  const logCRMAction = async (action: string, entityType: string, entityId: string, previousState?: any, newState?: any) => {
    try {
      await addDoc(collection(db, 'crm_audit_logs'), {
        orgId,
        action,
        userId,
        userEmail,
        userName,
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        previousState: previousState ? JSON.stringify(previousState) : '',
        newState: newState ? JSON.stringify(newState) : ''
      });
    } catch (e) {
      console.error("[CRM Audit] Failed to record audit log: ", e);
    }
  };

  // CRUD handlers
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: Omit<CRMContact, 'id'> = {
        orgId,
        ...contactForm,
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_contacts'), payload);
      await logCRMAction('CREATE_CONTACT', 'CRMContact', docRef.id, null, payload);
      setShowContactModal(false);
      setContactForm({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', accountId: '', status: 'active' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_contacts');
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: Omit<CRMAccount, 'id'> = {
        orgId,
        ...accountForm,
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_accounts'), payload);
      await logCRMAction('CREATE_ACCOUNT', 'CRMAccount', docRef.id, null, payload);
      setShowAccountModal(false);
      setAccountForm({ name: '', industry: '', website: '', phone: '', status: 'active' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_accounts');
    }
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: Omit<CRMLead, 'id'> = {
        orgId,
        ...leadForm,
        estimateValue: Number(leadForm.estimateValue),
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_leads'), payload);
      await logCRMAction('CREATE_LEAD', 'CRMLead', docRef.id, null, payload);
      setShowLeadModal(false);
      setLeadForm({ title: '', estimateValue: 0, contactId: '', accountId: '', stage: 'new', confidence: 50, source: 'Web', assignedWorkerId: '', notes: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_leads');
    }
  };

  const handleAddOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: Omit<CRMOpportunity, 'id'> = {
        orgId,
        ...oppForm,
        value: Number(oppForm.value),
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_opportunities'), payload);
      await logCRMAction('CREATE_OPPORTUNITY', 'CRMOpportunity', docRef.id, null, payload);
      setShowOppModal(false);
      setOppForm({ title: '', value: 0, leadId: '', stage: 'qualification', probability: 50, closeDate: '', assignedWorkerId: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_opportunities');
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const payload: Omit<CRMActivity, 'id'> = {
        orgId,
        ...activityForm,
        workerId: userId,
        workerName: userName,
        createdAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_activities'), payload);
      await logCRMAction('CREATE_ACTIVITY', 'CRMActivity', docRef.id, null, payload);
      setShowActivityModal(false);
      setActivityForm({ type: 'call', subject: '', description: '', entityType: 'contact', entityId: '', status: 'completed', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_activities');
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const emails = appointmentForm.attendeeEmails.split(',').map(em => em.trim()).filter(Boolean);
      const payload: Omit<CRMAppointment, 'id'> = {
        orgId,
        title: appointmentForm.title,
        description: appointmentForm.description,
        start: appointmentForm.start,
        end: appointmentForm.end,
        contactId: appointmentForm.contactId || undefined,
        attendeeEmails: emails,
        workerId: userId,
        createdAt: now
      };
      const docRef = await addDoc(collection(db, 'crm_appointments'), payload);
      await logCRMAction('CREATE_APPOINTMENT', 'CRMAppointment', docRef.id, null, payload);
      setShowAppointmentModal(false);
      setAppointmentForm({ title: '', description: '', start: '', end: '', contactId: '', attendeeEmails: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_appointments');
    }
  };

  const handleAddQuoteInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const now = new Date().toISOString();
      const parsedItems = quoteItems.map((item, i) => ({ id: `${Date.now()}-${i}`, ...item }));
      const baseSubtotal = parsedItems.reduce((acc, current) => acc + (current.quantity * current.price), 0);
      const taxAmount = (baseSubtotal * (Number(quoteForm.tax) / 100));
      const discountAmount = Number(quoteForm.discount);
      const finalVal = Math.max(0, baseSubtotal + taxAmount - discountAmount);

      const payload: Omit<CRMQuoteInvoice, 'id'> = {
        orgId,
        type: quoteForm.type,
        number: quoteForm.number || `Q-${Date.now().toString().slice(-6)}`,
        title: quoteForm.title,
        customerId: quoteForm.customerId,
        customerType: quoteForm.customerType,
        amount: finalVal,
        tax: Number(quoteForm.tax),
        discount: Number(quoteForm.discount),
        items: parsedItems,
        status: quoteForm.status,
        date: quoteForm.date || now.split('T')[0],
        dueDate: quoteForm.dueDate || now.split('T')[0],
        createdAt: now
      };

      const docRef = await addDoc(collection(db, 'crm_quotes_invoices'), payload);
      await logCRMAction(`CREATE_${quoteForm.type.toUpperCase()}`, 'CRMQuoteInvoice', docRef.id, null, payload);
      setShowQuoteModal(false);
      setQuoteForm({ type: 'quote', number: '', title: '', customerId: '', customerType: 'contact', tax: 5, discount: 0, status: 'draft', date: '', dueDate: '' });
      setQuoteItems([{ description: '', quantity: 1, price: 0 }]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'crm_quotes_invoices');
    }
  };

  // State Transition functions
  const handleTransitionLead = async (leadId: string, nextStage: CRMLead['stage']) => {
    try {
      const target = leads.find(l => l.id === leadId);
      if (!target) return;
      
      const updated = { ...target, stage: nextStage, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'crm_leads', leadId), { stage: nextStage, updatedAt: new Date().toISOString() });
      await logCRMAction('UPDATE_LEAD_STAGE', 'CRMLead', leadId, target, updated);

      // If transition lands on "qualified", propose to create a new Opportunity automatically!
      if (nextStage === 'qualified') {
        setOppForm({
          title: `Deal: ${target.title}`,
          value: target.estimateValue,
          leadId: leadId,
          stage: 'qualification',
          probability: 20,
          closeDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          assignedWorkerId: target.assignedWorkerId || userId
        });
        setShowOppModal(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crm_leads/${leadId}`);
    }
  };

  const handleTransitionOpp = async (oppId: string, nextStage: CRMOpportunity['stage']) => {
    try {
      const target = opportunities.find(o => o.id === oppId);
      if (!target) return;
      const updated = { ...target, stage: nextStage, updatedAt: new Date().toISOString() };
      await updateDoc(doc(db, 'crm_opportunities', oppId), { stage: nextStage, updatedAt: new Date().toISOString() });
      await logCRMAction('UPDATE_OPP_STAGE', 'CRMOpportunity', oppId, target, updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crm_opportunities/${oppId}`);
    }
  };

  const handleUpdateQuoteStatus = async (quoteId: string, newStatus: CRMQuoteInvoice['status']) => {
    try {
      const target = quotesInvoices.find(q => q.id === quoteId);
      if (!target) return;
      await updateDoc(doc(db, 'crm_quotes_invoices', quoteId), { status: newStatus });
      await logCRMAction(`UPDATE_${target.type.toUpperCase()}_STATUS`, 'CRMQuoteInvoice', quoteId, target, { ...target, status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crm_quotes_invoices/${quoteId}`);
    }
  };

  const handleDeleteEntity = async (collectionName: string, id: string) => {
    if (role !== 'admin') {
      alert("Access Denied: Only Workspace Admins can delete records.");
      return;
    }
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      await logCRMAction(`DELETE_${collectionName.toUpperCase().replace('CRM_', '')}`, collectionName, id, null, null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  // KPIs Calculations
  const metrics = useMemo(() => {
    const totalSales = opportunities
      .filter(o => o.stage === 'won')
      .reduce((sum, current) => sum + current.value, 0);

    const openPipeline = opportunities
      .filter(o => o.stage !== 'won' && o.stage !== 'lost')
      .reduce((sum, current) => sum + current.value, 0);

    const wonCount = opportunities.filter(o => o.stage === 'won').length;
    const totalClosed = opportunities.filter(o => o.stage === 'won' || o.stage === 'lost').length;
    const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    const leadNew = leads.filter(l => l.stage === 'new').length;
    const leadContacted = leads.filter(l => l.stage === 'contacted').length;
    const leadQualified = leads.filter(l => l.stage === 'qualified').length;
    const leadLost = leads.filter(l => l.stage === 'lost').length;
    const totalLeads = leads.length;
    const leadConversionRate = totalLeads > 0 ? Math.round((leadQualified / totalLeads) * 100) : 0;

    return {
      totalSales,
      openPipeline,
      winRate,
      leadConversionRate,
      leadStatus: { new: leadNew, contacted: leadContacted, qualified: leadQualified, lost: leadLost }
    };
  }, [opportunities, leads]);

  // Chart data preparing
  const chartsData = useMemo(() => {
    // 1. Pipeline by Stage
    const stagesDict: Record<CRMOpportunity['stage'], number> = {
      qualification: 0,
      proposal: 0,
      negotiation: 0,
      won: 0,
      lost: 0
    };
    opportunities.forEach(o => {
      if (stagesDict[o.stage] !== undefined) {
        stagesDict[o.stage] += o.value;
      }
    });
    const pipelineData = Object.entries(stagesDict).map(([stage, val]) => ({
      name: stage.substring(0, 1).toUpperCase() + stage.substring(1),
      value: val
    }));

    // 2. Lead stage Distribution
    const sourcesDict: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || 'Other';
      sourcesDict[src] = (sourcesDict[src] || 0) + 1;
    });
    const sourceData = Object.entries(sourcesDict).map(([name, value]) => ({
      name,
      value
    }));

    const COLORS_PIPELINE = ['#34d399', '#60a5fa', '#f59e0b', '#10b981', '#ef4444'];
    const COLORS_SOURCES = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

    return { pipelineData, sourceData, COLORS_PIPELINE, COLORS_SOURCES };
  }, [opportunities, leads]);

  // Filtering list items
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      const nameMatch = `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = (c.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || emailMatch;
    });
  }, [contacts, searchTerm]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (l.source || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchStage = stageFilter === 'all' || l.stage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [leads, searchTerm, stageFilter]);

  return (
    <div className={workspaceTab ? "text-slate-800 text-left animate-in fade-in duration-500 max-w-full overflow-x-hidden" : "bg-white border-[0.5px] border-slate-100 rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-6 lg:p-8 shadow-2xl shadow-slate-100 max-w-7xl mx-auto mb-10 text-slate-800 text-left animate-in fade-in duration-500 max-w-full overflow-x-hidden"}>
      
      {/* Header with quick summary */}
      {!workspaceTab && (
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b-[0.5px] border-slate-150 pb-6 mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 px-2.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                Dynamics Business Engine
              </span>
              <span className="text-slate-400 font-mono text-[9px]">v1.4 Enterprise</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <TrendingUp size={28} className="text-emerald-500" />
              CRM & Workspace Operations
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Microsoft Dynamics–style core. Manage customer relationships, pipelines, generate live invoicing, and keep an unified workflow history.
            </p>
          </div>

          {/* Quick Tabs Selector */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto max-w-full">
            {(['dashboard', 'contacts', 'pipeline', 'calendar', 'quotes', 'audit'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`p-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider font-extrabold transition-all flex items-center gap-1.5 ${
                  activeSubTab === tab 
                    ? 'bg-white text-slate-900 shadow-md scale-[1.02]' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'dashboard' && <Activity size={12} />}
                {tab === 'contacts' && <Users size={12} />}
                {tab === 'pipeline' && <Target size={12} />}
                {tab === 'calendar' && <CalendarIcon size={12} />}
                {tab === 'quotes' && <FileText size={12} />}
                {tab === 'audit' && <ShieldCheck size={12} />}
                <span>{tab}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-emerald-500/25 border-t-emerald-600 rounded-full animate-spin"></div>
          <span className="font-mono text-xs text-slate-400">Loading enterprise datasets...</span>
        </div>
      ) : (
        <>
          {/* 1. DASHBOARD AND REPORTING */}
          {((workspaceTab ? workspaceTab === 'reports' : activeSubTab === 'dashboard')) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Stat Bento Grid */}
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100/80">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">Total Sales (Won)</span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    ${metrics.totalSales.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <Sparkles size={11} /> Qualified Success
                  </span>
                </div>

                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100/80">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">Active Pipeline</span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    ${metrics.openPipeline.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    Ready opportunities
                  </span>
                </div>

                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100/80">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">Opportunity Win-Rate</span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {metrics.winRate}%
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${metrics.winRate}%` }}></div>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100/80">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-extrabold block mb-1">Lead Conversion</span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {metrics.leadConversionRate}%
                  </div>
                  <div className="w-full bg-slate-200 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${metrics.leadConversionRate}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Dynamic Interactive Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Pipeline value by stage */}
                <div className="bg-slate-55 pb-4 p-6 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 size={16} className="text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Opportunities Stage Capitalization</h3>
                  </div>
                  
                  {opportunities.length === 0 ? (
                    <div className="h-64 flex items-center justify-center border-[0.5px] border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                      <span className="text-[10px] font-mono text-slate-400">Assemble opportunities to forecast charts</span>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartsData.pipelineData}>
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <RechartsTooltip formatter={(v) => `$${v}`} />
                          <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Lead source distribution */}
                <div className="bg-slate-55 pb-4 p-6 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Prospect Sources Contribution</h3>
                  </div>
                  
                  {leads.length === 0 ? (
                    <div className="h-64 flex items-center justify-center border-[0.5px] border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
                      <span className="text-[10px] font-mono text-slate-400">Establish leads to verify marketing channels</span>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col justify-between">
                      <ResponsiveContainer width="100%" height="90%">
                        <PieChart>
                          <Pie
                            data={chartsData.sourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {chartsData.sourceData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={chartsData.COLORS_SOURCES[index % chartsData.COLORS_SOURCES.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* CRM Live Audit ledger Timeline */}
              <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={14} className="text-slate-500" />
                    Immutable CRM Security Audit Trail
                  </h3>
                  <span className="text-[9px] text-slate-400 font-mono">Viewing last 4 transactions</span>
                </div>

                {auditLogs.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-4">No security logs cataloged yet.</p>
                ) : (
                  <div className="space-y-3">
                    {auditLogs.slice(0, 4).map(log => (
                      <div key={log.id} className="flex text-[11px] items-center justify-between bg-white/70 p-3 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="p-1 px-2 text-[8px] font-mono font-black bg-slate-900 text-white rounded-lg uppercase">
                            {log.action}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-800">{log.userName}</span>
                            <span className="text-slate-400"> modified {log.entityType}</span>
                          </div>
                        </div>
                        <span className="font-mono text-[9px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. CONTACTS & COMPANY ACCOUNTS */}
          {((workspaceTab ? workspaceTab === 'customers' : activeSubTab === 'contacts')) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Header actions */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-50 p-4 rounded-3xl">
                <div className="relative flex-1 w-full max-w-md">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search by contact name, email..."
                    value={searchTerm || ''}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {!workspaceTab && (
                    <button
                      onClick={() => setShowAccountModal(true)}
                      className="p-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all"
                    >
                      <Building2 size={13} /> Add Account / Company
                    </button>
                  )}
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="p-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                  >
                    <Plus size={13} /> Add Contact
                  </button>
                </div>
              </div>

              {/* Master Split Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Contacts List Panel */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" /> Contacts Catalog ({filteredContacts.length})
                  </h3>

                  {filteredContacts.length === 0 ? (
                    <div className="p-12 border-[0.5px] border-dashed border-slate-200 bg-slate-50/50 rounded-[2rem] text-center">
                      <p className="text-xs text-slate-500 mb-2">No CRM contacts logged under this workspace.</p>
                      <button onClick={() => setShowContactModal(true)} className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Create contacts</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {filteredContacts.map(c => {
                        const associatedAccount = accounts.find(a => a.id === c.accountId);
                        return (
                          <div 
                            key={c.id} 
                            onClick={() => setSelectedContact(c)}
                            className={`p-4 bg-white hover:bg-emerald-50/10 cursor-pointer border rounded-3xl transition-all flex flex-col justify-between h-36 ${
                              selectedContact?.id === c.id ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/5' : 'border-slate-150'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{c.jobTitle || 'Industry target'}</span>
                                <h4 className="text-sm font-extrabold text-slate-900">
                                  {c.firstName} {c.lastName}
                                </h4>
                              </div>
                              <span className={`p-1 px-2 text-[8px] font-black uppercase rounded-lg ${
                                c.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {c.status}
                              </span>
                            </div>

                            <div className="space-y-1 my-2">
                              {c.email && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <Mail size={12} /> <span className="truncate max-w-[170px]">{c.email}</span>
                                </div>
                              )}
                              {c.phone && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <Phone size={12} /> <span>{c.phone}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                              <span>{associatedAccount ? associatedAccount.name : 'No corporate record'}</span>
                              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleDeleteEntity('crm_contacts', c.id)} className="text-slate-400 hover:text-red-500">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Account / Company list panel */}
                <div className="space-y-4">
                  {!workspaceTab ? (
                    <>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                        <Building2 size={14} className="text-slate-400" /> Target Corporate Accounts ({accounts.length})
                      </h3>

                      {accounts.length === 0 ? (
                        <div className="p-8 border-[0.5px] border-dashed border-slate-200 bg-slate-50/50 rounded-[2rem] text-center">
                          <p className="text-xs text-slate-500 mb-2 font-mono">No accounts defined</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {accounts.map(a => (
                            <div key={a.id} className="p-4 bg-slate-50/50 hover:bg-slate-50 rounded-2xl border border-slate-100">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-xs font-black text-slate-900">{a.name}</h4>
                                <span className="text-[8px] font-black uppercase text-slate-500 bg-slate-200 p-1 px-1.5 rounded-md">
                                  {a.status}
                                </span>
                              </div>
                              
                              <div className="text-[10px] text-slate-500 space-y-0.5">
                                <div>Industry: <strong className="text-slate-700">{a.industry || 'Tech'}</strong></div>
                                {a.website && <div className="truncate">Web: <a href={`https://${a.website}`} target="_blank" className="text-emerald-600 underline">{a.website}</a></div>}
                              </div>

                              <div className="flex justify-end gap-2 border-t border-white/50 pt-2 mt-2">
                                <button onClick={() => handleDeleteEntity('crm_accounts', a.id)} className="text-slate-400 hover:text-red-500">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}

                  {/* Sidebar micro activity timelines */}
                  {selectedContact ? (
                    <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[11px] font-black uppercase text-emerald-900 tracking-wider">
                          Timeline: {selectedContact.firstName}
                        </h4>
                        <button 
                          onClick={() => {
                            setActivityForm(prev => ({ ...prev, entityType: 'contact', entityId: selectedContact.id }));
                            setShowActivityModal(true);
                          }}
                          className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-700 flex items-center gap-1"
                        >
                          <Plus size={10} /> Add Activity
                        </button>
                      </div>

                      <div className="space-y-2">
                        {activities.filter(a => a.entityType === 'contact' && a.entityId === selectedContact.id).length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No scheduled activities. Add emails or calls above.</p>
                        ) : (
                          activities
                            .filter(a => a.entityType === 'contact' && a.entityId === selectedContact.id)
                            .map(act => (
                              <div key={act.id} className="p-2.5 bg-white rounded-xl border border-emerald-100/50 text-[10px]">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <strong className="text-slate-800 uppercase text-[9px] font-mono">{act.type}</strong>
                                  <span className="text-[8px] text-slate-400">{act.date}</span>
                                </div>
                                <div className="font-extrabold text-slate-700">{act.subject}</div>
                                <p className="text-slate-500 mt-0.5">{act.description}</p>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  ) : (
                    workspaceTab === 'customers' && (
                      <div className="p-12 border-[0.5px] border-dashed border-slate-200 bg-slate-50/55 rounded-[2.5rem] text-center">
                        <Users size={24} className="mx-auto text-slate-350 mb-2" />
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Customer Timeline Inspector</p>
                        <p className="text-[10px] text-slate-400 mt-1">Select any registered context catalog to inspect its full activity thread tracker log.</p>
                      </div>
                    )
                  )}
                </div>

              </div>
            </div>
          )}

          {/* Mapped to workspaceTab === 'accounts' */}
          {workspaceTab === 'accounts' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-100/50 p-4 rounded-3xl border">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest pl-1">Target Corporate Accounts ({accounts.length})</h3>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">Configure client organizations, company profiles, and industries.</p>
                </div>
                <div>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="p-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                  >
                    <Building2 size={13} /> Add Account / Company
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.length === 0 ? (
                  <div className="col-span-full p-12 border-[0.5px] border-dashed border-slate-200 bg-slate-50/50 rounded-[2rem] text-center">
                    <p className="text-xs text-slate-500 mb-2 font-mono">No accounts defined</p>
                    <button onClick={() => setShowAccountModal(true)} className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">+ Add Workspace Account</button>
                  </div>
                ) : (
                  accounts.map(a => (
                    <div key={a.id} className="p-5 bg-white rounded-3xl border border-slate-150 hover:shadow-md transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="p-1 px-2.5 rounded-full bg-emerald-500/10 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                            {a.industry || 'General'}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {a.status}
                          </span>
                        </div>
                        <h4 className="text-base font-black text-slate-900 leading-tight mb-2">{a.name}</h4>
                        {a.website && (
                          <div className="text-xs text-emerald-600 truncate mb-4">
                            <a href={`https://${a.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {a.website}
                            </a>
                          </div>
                        )}
                        {a.phone && <span className="text-xs text-slate-500 block">Tel: {a.phone}</span>}
                      </div>
                      
                      <div className="flex justify-end gap-2 border-t border-slate-50 pt-3 mt-4">
                        <button onClick={() => handleDeleteEntity('crm_accounts', a.id)} className="p-1 px-2.5 text-xs text-rose-500 hover:text-red-650 font-extrabold uppercase hover:bg-rose-50 rounded-lg flex items-center gap-1 transition-all">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mapped to workspaceTab === 'activities' */}
          {workspaceTab === 'activities' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-100/50 p-4 rounded-3xl border">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest pl-1 flex items-center gap-1.5">
                    <Activity size={16} className="text-emerald-500" /> Unified Client Interactions Log ({activities.length})
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1 pl-1">A consolidated log of all emails, calls, tasks, and meetings across contacts.</p>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setActivityForm({
                        type: 'call',
                        subject: '',
                        description: '',
                        entityType: 'contact',
                        entityId: contacts[0]?.id || '',
                        status: 'completed',
                        date: new Date().toISOString().split('T')[0]
                      });
                      setShowActivityModal(true);
                    }}
                    className="p-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                  >
                    <Plus size={13} /> Log Interaction
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-150 p-6 shadow-sm">
                {activities.length === 0 ? (
                  <div className="p-12 border-[0.5px] border-dashed border-slate-200 bg-slate-50/50 rounded-[2rem] text-center">
                    <p className="text-xs text-slate-500 mb-2">No interaction history registered inside this workspace yet.</p>
                    <button 
                      onClick={() => setShowActivityModal(true)} 
                      className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider"
                    >
                      + Register First Interaction
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {activities.map(act => {
                      const relatedContact = contacts.find(c => c.id === act.entityId);
                      const relatedAccount = accounts.find(a => a.id === act.entityId);
                      const relatedLead = leads.find(l => l.id === act.entityId);
                      const relatedOpp = opportunities.find(o => o.id === act.entityId);

                      let entityLabel = "Workspace Entity";
                      if (act.entityType === 'contact' && relatedContact) {
                        entityLabel = `Customer: ${relatedContact.firstName} ${relatedContact.lastName}`;
                      } else if (act.entityType === 'account' && relatedAccount) {
                        entityLabel = `Account: ${relatedAccount.name}`;
                      } else if (act.entityType === 'lead' && relatedLead) {
                        entityLabel = `Lead: ${relatedLead.title}`;
                      } else if (act.entityType === 'opportunity' && relatedOpp) {
                        entityLabel = `Deal: ${relatedOpp.title}`;
                      }

                      return (
                        <div key={act.id} className="p-4 rounded-3xl border border-slate-150 hover:bg-slate-50/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className={`p-2 rounded-2xl ${
                              act.type === 'call' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              act.type === 'email' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                              act.type === 'meeting' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              'bg-slate-50 text-slate-700 border border-slate-100'
                            } uppercase font-black text-[9px] min-w-[56px] text-center`}>
                              {act.type}
                            </span>
                            <div>
                              <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{act.subject}</h4>
                              <p className="text-xs text-slate-500 mt-1">{act.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2 items-center">
                                <span className="p-1 px-2 bg-slate-100 text-slate-700 text-[9px] font-black rounded-lg uppercase">
                                  {entityLabel}
                                </span>
                                <span className={`p-1 px-2 text-[9px] font-black rounded-lg uppercase ${
                                  act.status === 'completed' ? 'bg-emerald-150 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {act.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="font-mono text-[10px] font-bold text-slate-400">{act.date}</span>
                            <button onClick={() => handleDeleteEntity('crm_activities', act.id)} className="text-slate-350 hover:text-red-500 p-1">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. SALES LEADS, OPPORTUNITIES & DRAG PIPELINE */}
          {((workspaceTab ? workspaceTab === 'leads' : activeSubTab === 'pipeline')) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-50 p-4 rounded-3xl">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                    <Filter size={12} /> Filter Stages
                  </div>
                  <select
                    value={stageFilter || 'all'}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="bg-white border rounded-lg p-1 px-2.5 text-[11px] font-medium"
                  >
                    <option value="all">All Stages</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLeadModal(true)}
                    className="p-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                  >
                    <Plus size={13} /> Add Lead / Prospect
                  </button>
                </div>
              </div>

              {/* CRM Leads and Deal Board columns */}
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Target size={14} className="text-slate-400" /> Dynamics Pipeline Kanban Stages
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(['new', 'contacted', 'qualified', 'lost'] as const).map(col => {
                    const colLeads = leads.filter(l => l.stage === col);
                    const colSum = colLeads.reduce((acc, curr) => acc + curr.estimateValue, 0);

                    return (
                      <div key={col} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col min-h-[400px]">
                        
                        {/* Column Header */}
                        <div className="flex items-center justify-between border-b pb-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${
                              col === 'new' ? 'bg-blue-500' : 
                              col === 'contacted' ? 'bg-amber-500' :
                              col === 'qualified' ? 'bg-emerald-500' : 'bg-red-500'
                            }`} />
                            <span className="text-[10px] font-black uppercase text-slate-900 tracking-wider">
                              {col}
                            </span>
                          </div>
                          
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            ${colSum.toLocaleString()}
                          </span>
                        </div>

                        {/* List items block */}
                        <div className="space-y-2 flex-1 flex flex-col">
                          {colLeads.length === 0 ? (
                            <div className="text-center py-10 my-auto text-[10px] text-slate-400 italic font-mono">
                              No deals here
                            </div>
                          ) : (
                            colLeads.map(l => (
                              <div 
                                key={l.id} 
                                className="p-3.5 bg-white border border-slate-205 rounded-2xl shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between"
                              >
                                <div className="flex items-start justify-between">
                                  <span className="text-[8px] font-mono p-1 px-1.5 bg-slate-100 rounded text-slate-600 font-black">
                                    Con: {l.confidence}%
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-700 font-mono">
                                    ${l.estimateValue.toLocaleString()}
                                  </span>
                                </div>

                                <h4 className="text-xs font-black text-slate-900 my-1.5 tracking-tight">
                                  {l.title}
                                </h4>

                                <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                                  {l.notes || 'No description provided.'}
                                </p>

                                <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 mt-2.5">
                                  
                                  {/* Quick Action transitions */}
                                  <div className="flex items-center gap-1">
                                    {col !== 'lost' && (
                                      <button 
                                        onClick={() => handleTransitionLead(l.id, 'lost')} 
                                        className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100"
                                        title="Mark Lost"
                                      >
                                        <X size={10} />
                                      </button>
                                    )}

                                    {col === 'new' && (
                                      <button 
                                        onClick={() => handleTransitionLead(l.id, 'contacted')} 
                                        className="p-1 px-2 text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-800 rounded flex items-center gap-0.5"
                                        title="Advance"
                                      >
                                        Qualify <ChevronRight size={8} />
                                      </button>
                                    )}

                                    {col === 'contacted' && (
                                      <button 
                                        onClick={() => handleTransitionLead(l.id, 'qualified')} 
                                        className="p-1 px-2 text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-800 rounded flex items-center gap-0.5"
                                        title="Advance"
                                      >
                                        Qualify <ChevronRight size={8} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleDeleteEntity('crm_leads', l.id)} className="text-slate-350 hover:text-red-550">
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Deal Pipeline (Opportunities table view) */}
              {!workspaceTab && (
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase size={14} className="text-indigo-500" /> Advanced Workspace Opportunities ({opportunities.length})
                    </h3>
                    <button 
                      onClick={() => setShowOppModal(true)}
                      className="text-[10px] uppercase font-black text-emerald-700 tracking-wider hover:underline"
                    >
                      + Create Opportunity Deal
                    </button>
                  </div>

                  {opportunities.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic py-4">No deals are in proposal or negotiation stages yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8px] tracking-widest bg-white/50">
                            <th className="p-3">Deal Title</th>
                            <th className="p-3">Weighted Value</th>
                            <th className="p-3">Sales Stage</th>
                            <th className="p-3">Probability</th>
                            <th className="p-3">Expected Close</th>
                            <th className="p-3">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {opportunities.map(o => ( o && (
                            <tr key={o.id} className="border-b border-slate-200/50 hover:bg-white transition-all">
                              <td className="p-3 min-w-[200px] font-black text-slate-900">{o.title}</td>
                              <td className="p-3 font-mono font-bold text-indigo-700">${o.value.toLocaleString()}</td>
                              <td className="p-3">
                                <span className={`p-1 px-2 text-[8px] font-mono uppercase font-black tracking-wider rounded-lg ${
                                  o.stage === 'won' ? 'bg-emerald-100 text-emerald-800' :
                                  o.stage === 'lost' ? 'bg-red-500/10 text-red-700' :
                                  'bg-slate-200 text-slate-700'
                                }`}>
                                  {o.stage}
                                </span>
                              </td>
                              <td className="p-3 font-mono font-black">{o.probability}%</td>
                              <td className="p-3 text-slate-500">{o.closeDate}</td>
                              <td className="p-3 flex items-center gap-1">
                                {o.stage !== 'won' && (
                                  <button 
                                    onClick={() => handleTransitionOpp(o.id, 'won')}
                                    className="text-[9px] uppercase tracking-wider font-extrabold bg-emerald-100 text-emerald-800 p-1 px-1.5 rounded-md hover:bg-emerald-200"
                                  >
                                    Mark Won
                                  </button>
                                )}
                                <button onClick={() => handleDeleteEntity('crm_opportunities', o.id)} className="text-slate-400 hover:text-red-500 p-1">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Mapped to workspaceTab === 'opportunities' */}
          {workspaceTab === 'opportunities' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Deal Pipeline (Opportunities table view) */}
              <div className="p-6 bg-slate-100/30 rounded-[2rem] border">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 pb-3 border-b border-slate-200/50 gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase size={14} className="text-indigo-500" /> Advanced Workspace Opportunities ({opportunities.length})
                    </h3>
                    <p className="text-[10px] text-slate-400">Track high-value prospects, proposal terms, and sales pipeline stage progressions.</p>
                  </div>
                  <button 
                    onClick={() => setShowOppModal(true)}
                    className="p-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] uppercase font-black tracking-wider transition-all shadow-md shadow-emerald-500/10"
                  >
                    + Create Opportunity Deal
                  </button>
                </div>

                {opportunities.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-16 text-center bg-white/50 rounded-2xl border">No deals are in proposal or negotiation stages yet.</p>
                ) : (
                  <div className="overflow-x-auto bg-white rounded-2xl border">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-400 font-extrabold uppercase text-[8px] tracking-widest bg-slate-50">
                          <th className="p-3 pl-4">Deal Title</th>
                          <th className="p-3">Weighted Value</th>
                          <th className="p-3">Sales Stage</th>
                          <th className="p-3">Probability</th>
                          <th className="p-3">Expected Close</th>
                          <th className="p-3 pr-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opportunities.map(o => (
                          <tr key={o.id} className="border-b border-slate-200/50 hover:bg-slate-50 transition-all">
                            <td className="p-3 pl-4 font-black text-slate-900">{o.title}</td>
                            <td className="p-3 font-mono font-bold text-indigo-700">${o.value.toLocaleString()}</td>
                            <td className="p-3">
                              <select 
                                value={o.stage || 'qualification'} 
                                onChange={(e) => handleTransitionOpp(o.id, e.target.value as CRMOpportunity['stage'])}
                                className={`text-[9px] uppercase font-black px-2 py-1.5 border rounded-lg ${
                                  o.stage === 'won' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                  o.stage === 'lost' ? 'bg-red-50 border-red-200 text-red-800' :
                                  'bg-indigo-50 border-indigo-200 text-indigo-800'
                                }`}
                              >
                                <option value="qualification">Qualification</option>
                                <option value="proposal">Proposal</option>
                                <option value="negotiation">Negotiation</option>
                                <option value="won">Won (Closed)</option>
                                <option value="lost">Lost</option>
                              </select>
                            </td>
                            <td className="p-3 font-mono font-black">{o.probability}%</td>
                            <td className="p-3 text-slate-500">{o.closeDate}</td>
                            <td className="p-3 pr-4 text-right">
                              <button onClick={() => handleDeleteEntity('crm_opportunities', o.id)} className="text-slate-400 hover:text-red-500 p-1">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. CRM CALENDAR & AD-HOC APPOINTMENTS */}
          {((workspaceTab ? workspaceTab === 'calendar' : activeSubTab === 'calendar')) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual mini-scheduler */}
                <div className="lg:col-span-2 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays size={14} className="text-emerald-600" /> Complete Shared Workspace Agenda
                    </h3>
                    <button
                      onClick={() => setShowAppointmentModal(true)}
                      className="text-[9px] uppercase font-bold p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 transition-all rounded-lg text-white"
                    >
                      + Schedule Setup
                    </button>
                  </div>

                  {appointments.length === 0 ? (
                    <div className="p-16 border-[0.5px] border-dashed border-slate-200 bg-white rounded-2xl text-center">
                      <p className="text-xs text-slate-400 font-mono mb-2">No CRM appointments scheduled</p>
                      <button onClick={() => setShowAppointmentModal(true)} className="text-[10px] text-emerald-600 font-extrabold uppercase">Setup initial meeting</button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                      {appointments.map(appt => {
                        const assContact = contacts.find(c => c.id === appt.contactId);
                        const cleanStart = appt.start.includes('T') ? appt.start.split('T')[1].slice(0, 5) : appt.start;
                        const cleanEnd = appt.end.includes('T') ? appt.end.split('T')[1].slice(0, 5) : appt.end;

                        return (
                          <div key={appt.id} className="p-4 bg-white hover:bg-emerald-50/5 border border-slate-150 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-emerald-700 font-black mb-1">
                                <Clock size={11} />
                                <span>{appt.start.split('T')[0]}  ({cleanStart} — {cleanEnd})</span>
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-900">{appt.title}</h4>
                              {appt.description && <p className="text-[11px] text-slate-500 mt-1">{appt.description}</p>}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {assContact && (
                                <span className="text-[10px] p-1 px-2 bg-emerald-50 text-emerald-950 font-bold rounded-lg uppercase">
                                  Attendee: {assContact.firstName}
                                </span>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <button onClick={() => handleDeleteEntity('crm_appointments', appt.id)} className="text-slate-350 hover:text-red-500">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>

                {/* Shared calendar team targets */}
                <div className="space-y-4">
                  <div className="p-5 bg-white border border-slate-205 rounded-[1.8rem]">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-slate-400" /> Account Representatives
                    </h3>
                    
                    <div className="space-y-3">
                      {members.map(member => (
                        <div key={member.userId} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="font-extrabold text-slate-800">{member.name || 'Anonymous User'}</span>
                            <div className="text-[10px] text-slate-400 font-mono italic">{member.jobTitle || 'Representative'}</div>
                          </div>
                          <span className={`p-1 px-1.5 text-[8px] font-black uppercase rounded-lg ${
                            member.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {member.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* 5. QUOTES & INVOICES SYSTEM */}
          {((workspaceTab ? (workspaceTab === 'quotes' || workspaceTab === 'invoices') : activeSubTab === 'quotes')) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Quotes dashboard actions */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-slate-100/50 p-4 rounded-3xl border">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider pl-1 font-sans">
                    {workspaceTab === 'quotes' ? 'Workspace Proposals & Quotes' : workspaceTab === 'invoices' ? 'Billing & Invoicing Ledger' : 'Quote Invoicing Control Panel'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1 pl-1 font-sans">
                    {workspaceTab === 'quotes' ? 'Emit formal development proposals & cost estimations.' : workspaceTab === 'invoices' ? 'Manage fiscal ledgers and customer payments.' : 'Emit transaction quotes & real-time invoices instantly.'}
                  </p>
                </div>

                <div className="flex gap-2">
                  {(!workspaceTab || workspaceTab === 'quotes') && (
                    <button
                      onClick={() => {
                        setQuoteForm(prev => ({ ...prev, type: 'quote' }));
                        setShowQuoteModal(true);
                      }}
                      className="p-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all"
                    >
                      <Plus size={13} /> Draft Quote
                    </button>
                  )}
                  {(!workspaceTab || workspaceTab === 'invoices') && (
                    <button
                      onClick={() => {
                        setQuoteForm(prev => ({ ...prev, type: 'invoice' }));
                        setShowQuoteModal(true);
                      }}
                      className="p-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-wider font-extrabold rounded-2xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                    >
                      <Plus size={13} /> Issue Invoice
                    </button>
                  )}
                </div>
              </div>

              {/* Quotes database grid */}
              {quotesInvoices.filter(doc => {
                if (workspaceTab === 'quotes') return doc.type === 'quote';
                if (workspaceTab === 'invoices') return doc.type === 'invoice';
                return true;
              }).length === 0 ? (
                <div className="p-16 border-[0.5px] border-dashed border-slate-200 rounded-[2rem] text-center bg-slate-50/20">
                  <p className="text-xs text-slate-400 font-mono mb-2">No documents generated</p>
                  <button onClick={() => setShowQuoteModal(true)} className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Initialize business record</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {quotesInvoices.filter(doc => {
                    if (workspaceTab === 'quotes') return doc.type === 'quote';
                    if (workspaceTab === 'invoices') return doc.type === 'invoice';
                    return true;
                  }).map(doc => {
                    const cleanCust = contacts.find(c => c.id === doc.customerId)?.firstName || 
                      accounts.find(a => a.id === doc.customerId)?.name || 'Valued Enterprise Client';

                    return (
                      <div key={doc.id} className="p-5 bg-white border border-slate-150 rounded-[1.8rem] hover:shadow-md transition-all flex flex-col justify-between">
                        
                        <div className="flex items-start justify-between border-b border-slate-50 pb-3">
                          <div>
                            <span className="p-1 text-[8px] tracking-widest font-black uppercase bg-slate-900 text-white rounded-md mr-1.5">
                              {doc.type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">{doc.number}</span>
                            <h4 className="text-sm font-black text-slate-900 mt-1 max-w-[200px] truncate">{doc.title}</h4>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-slate-900 font-mono">${doc.amount.toLocaleString()}</span>
                            <select
                              value={doc.status || 'draft'}
                              onChange={(e) => handleUpdateQuoteStatus(doc.id, e.target.value as CRMQuoteInvoice['status'])}
                              className={`text-[9px] uppercase font-black tracking-wider border rounded-lg p-1.5 py-1 ${
                                doc.status === 'paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                doc.status === 'sent' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
                                'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              <option value="draft">Draft</option>
                              <option value="sent">Sent</option>
                              <option value="paid">Paid</option>
                              <option value="expired">Expired</option>
                            </select>
                          </div>
                        </div>

                        {/* Customer & due data */}
                        <div className="py-3 text-[11px] text-slate-500 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                          <div>Client: <strong className="text-slate-800 uppercase text-[9px]">{cleanCust}</strong></div>
                          <div className="text-right">Issued: <strong className="text-slate-700">{doc.date}</strong></div>
                          <div>Due: <strong className="text-slate-700">{doc.dueDate}</strong></div>
                          <div className="text-right font-mono" onClick={() => handleDeleteEntity('crm_quotes_invoices', doc.id)}>
                            <button className="text-slate-350 hover:text-red-500">
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* 6. IMMUTABLE SECURITY AUDIT LEDGER */}
          {activeSubTab === 'audit' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100/80">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" /> Dynamics Master Integrity Ledger
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Immutable historic audit transactions on this CRM workspace</p>
                  </div>
                  <span className="p-1 px-2.5 rounded-full bg-slate-900 text-white text-[9px] font-mono uppercase tracking-wider">
                    Total: {auditLogs.length} events
                  </span>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-16 text-center text-xs text-slate-400 italic">
                    No transactions registered in the ledger database yet.
                  </div>
                ) : (
                  <div className="space-y-3 mt-4 max-h-[500px] overflow-y-auto pr-2">
                    {auditLogs.map(log => (
                      <div key={log.id} className="p-4 bg-white rounded-2xl border border-slate-150/70 text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start gap-3">
                          <span className="p-1.5 px-2 text-[8px] font-mono leading-none font-black bg-slate-900 text-white rounded uppercase mt-0.5">
                            {log.action}
                          </span>
                          <div>
                            <div className="font-extrabold text-slate-955">{log.action.replaceAll('_', ' ')}</div>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              User: <strong>{log.userName} ({log.userEmail})</strong> updated dataset entity <strong>{log.entityType}</strong> (Reference: #{log.entityId})
                            </p>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end font-mono text-[9px] text-slate-400">
                          <span>{log.timestamp.replaceAll('T', ' ').substring(0, 19)}</span>
                          <span className="text-[8px] bg-slate-50 text-slate-500 rounded p-0.5 mt-1">ID: ...{log.id.slice(-8)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </>
      )}

      {/* --- ADD MODALS --- */}
      
      {/* 1. Add Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <UserPlus size={18} className="text-emerald-600" /> CRM Contact Profiler
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-4">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">First Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.firstName || ''}
                    onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                    className="p-2 border border-slate-205 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Last Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.lastName || ''}
                    onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                    className="p-2 border border-slate-201 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Email Address</label>
                <input
                  type="email"
                  value={contactForm.email || ''}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={contactForm.phone || ''}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Job Title</label>
                  <input
                    type="text"
                    value={contactForm.jobTitle || ''}
                    onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Corporate Account</label>
                <select
                  value={contactForm.accountId || ''}
                  onChange={(e) => setContactForm({ ...contactForm, accountId: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">No Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Register CRM Contact
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Building2 size={18} className="text-emerald-700" /> Workspace Account Details
              </h3>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Corporate Name</label>
                <input
                  type="text"
                  required
                  value={accountForm.name || ''}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Industry</label>
                  <input
                    type="text"
                    value={accountForm.industry || ''}
                    onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Phone</label>
                  <input
                    type="text"
                    value={accountForm.phone || ''}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Website URL</label>
                <input
                  type="text"
                  value={accountForm.website || ''}
                  onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Assemble Corporate Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Lead Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Target size={18} className="text-emerald-600" /> Dynamics Opportunity Lead
              </h3>
              <button onClick={() => setShowLeadModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Project / Lead Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ERP Cloud Integration"
                  value={leadForm.title || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Estimate Value ($)</label>
                  <input
                    type="number"
                    required
                    value={leadForm.estimateValue ?? 0}
                    onChange={(e) => setLeadForm({ ...leadForm, estimateValue: Number(e.target.value) })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Lead Source</label>
                  <select
                    value={leadForm.source || 'Web'}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Web">Web Portal</option>
                    <option value="Referral">Partner Referral</option>
                    <option value="Cold Call">Cold Outreach</option>
                    <option value="Ad Campaign">Ad Campaign</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Contact Person</label>
                  <select
                    value={leadForm.contactId || ''}
                    onChange={(e) => setLeadForm({ ...leadForm, contactId: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">No Contact Linked</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Workforce Assignment</label>
                  <select
                    value={leadForm.assignedWorkerId || ''}
                    onChange={(e) => setLeadForm({ ...leadForm, assignedWorkerId: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.name || 'Team member'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Summary notes</label>
                <textarea
                  value={leadForm.notes || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Log Enterprise Lead
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Add Opportunity Modal */}
      {showOppModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Briefcase size={18} className="text-indigo-650" /> Transition: Qualified Opportunity
              </h3>
              <button onClick={() => setShowOppModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddOpp} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Opportunity Deal Name</label>
                <input
                  type="text"
                  required
                  value={oppForm.title || ''}
                  onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Deal Value ($)</label>
                  <input
                    type="number"
                    required
                    value={oppForm.value ?? 0}
                    onChange={(e) => setOppForm({ ...oppForm, value: Number(e.target.value) })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Success Probability (%)</label>
                  <input
                    type="number"
                    value={oppForm.probability ?? 50}
                    onChange={(e) => setOppForm({ ...oppForm, probability: Math.min(100, Number(e.target.value)) })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Expected Close</label>
                  <input
                    type="date"
                    required
                    value={oppForm.closeDate || ''}
                    onChange={(e) => setOppForm({ ...oppForm, closeDate: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Assigned Account Exe</label>
                  <select
                    value={oppForm.assignedWorkerId || ''}
                    onChange={(e) => setOppForm({ ...oppForm, assignedWorkerId: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.name || 'Team member'}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/10"
              >
                Launch Pipeline Deal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Add Activity Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <Activity size={18} className="text-emerald-600" /> Log Workspace Activity
              </h3>
              <button onClick={() => setShowActivityModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-4">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Activity Type</label>
                  <select
                    value={activityForm.type || 'call'}
                    onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="call">Call</option>
                    <option value="email">Email</option>
                    <option value="meeting">Meeting</option>
                    <option value="task font-sans">Task</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Date Actioned</label>
                  <input
                    type="date"
                    required
                    value={activityForm.date || ''}
                    onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phone call to verify cloud requirements"
                  value={activityForm.subject || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Description</label>
                <textarea
                  value={activityForm.description || ''}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs h-20 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Post Activity Entry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Add Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-md border shadow-2xl text-left animate-in zoom-in-95 duration-200 safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
                <CalendarIcon size={18} className="text-emerald-600" /> Dynamics Scheduler Setup
              </h3>
              <button onClick={() => setShowAppointmentModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddAppointment} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Demo or Contract negotiation"
                  value={appointmentForm.title || ''}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Starts At</label>
                  <input
                    type="datetime-local"
                    required
                    value={appointmentForm.start || ''}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, start: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Ends At</label>
                  <input
                    type="datetime-local"
                    required
                    value={appointmentForm.end || ''}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, end: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Associated CRM Contact</label>
                <select
                  value={appointmentForm.contactId || ''}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, contactId: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">No Contact Linked</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Invited Attendees (Emails, comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. client@gmail.com, executive@org.com"
                  value={appointmentForm.attendeeEmails || ''}
                  onChange={(e) => setAppointmentForm({ ...appointmentForm, attendeeEmails: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Schedule Appointment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. Add Quote / Invoice Modal */}
      {showQuoteModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-2xl border shadow-2xl text-left animate-in zoom-in-95 duration-200 my-auto safe-scroll-panel">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-1.5 animate-pulse">
                <FileCheck size={18} className="text-emerald-600" /> GeneralQuote & Invoice Builder
              </h3>
              <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddQuoteInvoice} className="space-y-4">
              <div className="grid grid-cols-1 min-[520px]:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Document Type</label>
                  <select
                    value={quoteForm.type || 'quote'}
                    onChange={(e) => setQuoteForm({ ...quoteForm, type: e.target.value as any })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="quote">Quote Offer</option>
                    <option value="invoice">Invoice Ticket</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Document Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026-001"
                    value={quoteForm.number || ''}
                    onChange={(e) => setQuoteForm({ ...quoteForm, number: e.target.value })}
                    className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Status</label>
                  <select
                    value={quoteForm.status || 'draft'}
                    onChange={(e) => setQuoteForm({ ...quoteForm, status: e.target.value as any })}
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Document title / description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software licenses & consulting services"
                  value={quoteForm.title || ''}
                  onChange={(e) => setQuoteForm({ ...quoteForm, title: e.target.value })}
                  className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Billed Customer</label>
                  <select
                    value={quoteForm.customerId || ''}
                    onChange={(e) => setQuoteForm({ ...quoteForm, customerId: e.target.value, customerType: 'contact' })}
                    required
                    className="p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Choose Corporate Client</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.firstName} {c.lastName} (Contact)</option>
                    ))}
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} (Corporate Account)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Issue Date</label>
                    <input
                      type="date"
                      value={quoteForm.date || ''}
                      onChange={(e) => setQuoteForm({ ...quoteForm, date: e.target.value })}
                      className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400">Due Date</label>
                    <input
                      type="date"
                      value={quoteForm.dueDate || ''}
                      onChange={(e) => setQuoteForm({ ...quoteForm, dueDate: e.target.value })}
                      className="p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items manager */}
              <div className="border-[0.5px] border-slate-150 p-4 rounded-3xl bg-slate-50/50">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider">Services / Products Line Items</h4>
                  <button
                    type="button"
                    onClick={() => setQuoteItems([...quoteItems, { description: '', quantity: 1, price: 0 }])}
                    className="text-[9px] font-extrabold text-emerald-700 uppercase"
                  >
                    + Add Item Row
                  </button>
                </div>

                <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
                  {quoteItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <input
                          type="text"
                          required
                          placeholder="Item description"
                          value={item.description || ''}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[index].description = e.target.value;
                            setQuoteItems(updated);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          required
                          placeholder="Qty"
                          value={item.quantity ?? 1}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[index].quantity = Math.max(1, Number(e.target.value));
                            setQuoteItems(updated);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-center focus:outline-none"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          required
                          placeholder="Price ($)"
                          value={item.price ?? 0}
                          onChange={(e) => {
                            const updated = [...quoteItems];
                            updated[index].price = Math.max(0, Number(e.target.value));
                            setQuoteItems(updated);
                          }}
                          className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-right focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (quoteItems.length === 1) return;
                            setQuoteItems(quoteItems.filter((_, i) => i !== index));
                          }}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoicing calculations summary */}
              <div className="grid grid-cols-1 min-[520px]:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-3xl text-xs font-mono">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-extrabold uppercase text-slate-400">Subtotal</label>
                  <strong className="text-slate-800">
                    ${quoteItems.reduce((acc, c) => acc + (c.quantity * c.price), 0).toLocaleString()}
                  </strong>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-extrabold uppercase text-slate-400">Estimated Tax (%)</label>
                  <input
                    type="number"
                    value={quoteForm.tax ?? 0}
                    onChange={(e) => setQuoteForm({ ...quoteForm, tax: Number(e.target.value) })}
                    className="p-1 border border-slate-200 bg-white rounded-lg text-center font-mono font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[8px] font-extrabold uppercase text-slate-400">Discount Off ($)</label>
                  <input
                    type="number"
                    value={quoteForm.discount ?? 0}
                    onChange={(e) => setQuoteForm({ ...quoteForm, discount: Number(e.target.value) })}
                    className="p-1 border border-slate-200 bg-white rounded-lg text-center font-mono font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-500/10"
              >
                Issue Commercial Invoicing Reference
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}



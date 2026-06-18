export interface CRMContact {
  id: string;
  orgId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  accountId: string; // Associated Account ID
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CRMAccount {
  id: string;
  orgId: string;
  name: string;
  industry: string;
  website: string;
  phone: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CRMLead {
  id: string;
  orgId: string;
  title: string;
  estimateValue: number;
  contactId: string;
  accountId: string;
  stage: 'new' | 'contacted' | 'qualified' | 'lost';
  confidence: number; // 0-100
  source: string;
  assignedWorkerId: string; // worker from workspace
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMOpportunity {
  id: string;
  orgId: string;
  title: string;
  value: number;
  leadId: string;
  stage: 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';
  probability: number; // percentage (0 - 100)
  closeDate: string; // yyyy-MM-dd
  assignedWorkerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMActivity {
  id: string;
  orgId: string;
  type: 'call' | 'email' | 'meeting' | 'task';
  subject: string;
  description: string;
  entityType: 'contact' | 'lead' | 'opportunity' | 'account';
  entityId: string;
  workerId: string; // creator
  workerName: string;
  date: string; // yyyy-MM-dd
  status: 'completed' | 'scheduled';
  createdAt: string;
}

export interface CRMAppointment {
  id: string;
  orgId: string;
  title: string;
  description: string;
  start: string; // ISO date string
  end: string;   // ISO date string
  contactId?: string;
  attendeeEmails: string[];
  workerId: string;
  createdAt: string;
}

export interface CRMQuoteInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
}

export interface CRMQuoteInvoice {
  id: string;
  orgId: string;
  type: 'quote' | 'invoice';
  number: string; // e.g. INV-2026-001
  title: string;
  customerId: string; // contactId or accountId
  customerType: 'contact' | 'account';
  amount: number;
  tax: number;
  discount: number;
  items: CRMQuoteInvoiceItem[];
  status: 'draft' | 'sent' | 'paid' | 'expired';
  date: string; // yyyy-MM-dd
  dueDate: string; // yyyy-MM-dd
  createdAt: string;
}

export interface CRMAuditLog {
  id: string;
  orgId: string;
  action: string; // e.g., 'CREATE_LEAD', 'UPDATE_STAGE'
  userId: string;
  userEmail: string;
  userName: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  previousState?: string; // JSON or text
  newState?: string;      // JSON or text
}

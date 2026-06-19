import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { format } from "date-fns";
import cors from "cors";
import Stripe from "stripe";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import type { App as FirebaseAdminApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

dotenv.config({ path: ".env.local" });
dotenv.config();

let genAI: GoogleGenAI | null = null;
let stripeClient: Stripe | null = null;
let firebaseAdminApp: FirebaseAdminApp | null = null;
const DEFAULT_FIRESTORE_DATABASE_ID = "ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f";

type AnalyticsScope = "mainframe" | "workspace";

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getPublicErrorMessage(error: any, fallback: string) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");

  if (code.includes("not-found") || code === "5" || message.includes("5 NOT_FOUND") || message.includes("NOT_FOUND")) {
    return "Firebase could not find the configured Firestore database. Confirm Render has FIRESTORE_DATABASE_ID=ai-studio-96491054-260f-4ee7-b4d2-c73b2a6faa0f and that the Firebase service account belongs to project gen-lang-client-0683642806.";
  }

  if (message.includes("Firebase Admin credentials are not configured")) {
    return "Firebase Admin credentials are missing on Render. Add FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_KEY, then redeploy.";
  }

  return message || fallback;
}

const ANALYTICS_PRODUCT_CONFIG: Record<AnalyticsScope, {
  name: string;
  envPriceId?: string;
  unitAmount: number;
}> = {
  mainframe: {
    name: "FlowState Mainframe Analytics",
    envPriceId: "STRIPE_MAINFRAME_PRICE_ID",
    unitAmount: 299,
  },
  workspace: {
    name: "FlowState Workspace Suite",
    unitAmount: 499,
  },
};

function getWorkspaceAnalyticsAmountCents(memberCount: number) {
  const normalizedCount = Math.max(1, Math.floor(memberCount || 1));
  const tierIndex = Math.max(0, Math.ceil(normalizedCount / 15) - 1);
  return 499 + (tierIndex * 100);
}

function getWorkspaceAnalyticsTierLabel(memberCount: number) {
  const normalizedCount = Math.max(1, Math.floor(memberCount || 1));
  const tierIndex = Math.max(0, Math.ceil(normalizedCount / 15) - 1);
  const start = tierIndex * 15 + 1;
  const end = (tierIndex + 1) * 15;
  return `${start}-${end} employees`;
}

function isAnalyticsScope(value: unknown): value is AnalyticsScope {
  return value === "mainframe" || value === "workspace";
}

function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function getFirebaseAdminApp() {
  if (firebaseAdminApp) return firebaseAdminApp;
  const existing = getApps()[0];
  if (existing) {
    firebaseAdminApp = existing;
    return firebaseAdminApp;
  }

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const base64ServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (rawServiceAccount || base64ServiceAccount) {
    const decodedServiceAccount = rawServiceAccount || Buffer.from(String(base64ServiceAccount), "base64").toString("utf8");
    const serviceAccount = JSON.parse(decodedServiceAccount);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = String(serviceAccount.private_key).replace(/\\n/g, "\n");
    }
    firebaseAdminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    });
    return firebaseAdminApp;
  }

  const serviceAccountFromFile = loadServiceAccountFromFile();
  if (serviceAccountFromFile) {
    firebaseAdminApp = initializeApp({
      credential: cert(serviceAccountFromFile),
      projectId: serviceAccountFromFile.project_id || projectId,
    });
    return firebaseAdminApp;
  }

  if (projectId && clientEmail && privateKey) {
    firebaseAdminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
    return firebaseAdminApp;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    firebaseAdminApp = initializeApp({
      credential: applicationDefault(),
      projectId,
    });
    return firebaseAdminApp;
  }

  throw new Error(
    "Firebase Admin credentials are not configured. Add firebase-admin-service-account.json, FIREBASE_SERVICE_ACCOUNT_FILE, FIREBASE_SERVICE_ACCOUNT_KEY, FIREBASE_SERVICE_ACCOUNT_BASE64, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  );
}

function getAdminDb(): Firestore {
  const databaseId = process.env.VITE_FIRESTORE_DATABASE_ID || process.env.FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;
  const app = getFirebaseAdminApp();
  return getFirestore(app, databaseId);
}

function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

function loadServiceAccountFromFile() {
  const candidateFiles = [
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), "firebase-admin-service-account.json"),
    path.join(process.cwd(), "firebase-service-account.json"),
  ].filter(Boolean) as string[];

  for (const filePath of candidateFiles) {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) continue;
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));
    if (serviceAccount.private_key) {
      serviceAccount.private_key = String(serviceAccount.private_key).replace(/\\n/g, "\n");
    }
    return serviceAccount;
  }

  return null;
}

function buildStripeLineItem(scope: AnalyticsScope, workspaceMemberCount = 1): Stripe.Checkout.SessionCreateParams.LineItem {
  const plan = ANALYTICS_PRODUCT_CONFIG[scope];
  const priceId = plan.envPriceId ? process.env[plan.envPriceId] : undefined;
  if (priceId) {
    return {
      price: priceId,
      quantity: 1,
    };
  }

  const unitAmount = scope === "workspace"
    ? getWorkspaceAnalyticsAmountCents(workspaceMemberCount)
    : plan.unitAmount;
  const tierLabel = scope === "workspace"
    ? getWorkspaceAnalyticsTierLabel(workspaceMemberCount)
    : undefined;

  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: unitAmount,
      recurring: { interval: "month" },
      product_data: {
        name: plan.name,
        description: tierLabel,
      },
    },
  };
}

function normalizeReturnUrl(rawUrl: unknown, req: express.Request) {
  const fallback = process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || `${req.protocol}://${req.get("host") || "localhost:3000"}`;
  const candidate = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : req.get("origin") || fallback;

  try {
    return new URL(candidate, fallback).toString();
  } catch {
    return fallback;
  }
}

function appendCheckoutParams(rawUrl: string, params: Record<string, string>) {
  const separator = rawUrl.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => {
      const encodedValue = value === "{CHECKOUT_SESSION_ID}" ? value : encodeURIComponent(value);
      return `${encodeURIComponent(key)}=${encodedValue}`;
    })
    .join("&");
  return `${rawUrl}${separator}${query}`;
}

async function findWorkspaceMembership(db: Firestore, userId: string, orgId: string) {
  const direct = await db.doc(`memberships/${userId}_${orgId}`).get();
  if (direct.exists) return direct.data();

  const byFields = await db.collection("memberships")
    .where("userId", "==", userId)
    .where("orgId", "==", orgId)
    .limit(1)
    .get();

  return byFields.docs[0]?.data();
}

async function assertWorkspaceAdmin(userId: string, orgId: string) {
  const membership = await findWorkspaceMembership(getAdminDb(), userId, orgId);
  if (!membership || membership.role !== "admin") {
    throw new HttpError(403, "Only workspace admins can start the workspace analytics subscription.");
  }
}

async function getWorkspaceMemberCount(orgId: string) {
  const snapshot = await getAdminDb().collection("memberships")
    .where("orgId", "==", orgId)
    .get();
  return Math.max(1, snapshot.size);
}

async function writeAnalyticsSubscription(params: {
  scope: AnalyticsScope;
  active: boolean;
  status: string;
  userId?: string;
  orgId?: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  workspaceSeatCount?: number;
  monthlyAmountCents?: number;
}) {
  const db = getAdminDb();
  const payload = {
    updatedAt: FieldValue.serverTimestamp(),
    stripeCustomerId: params.stripeCustomerId || null,
    stripeSubscriptionId: params.stripeSubscriptionId || null,
  };

  if (params.scope === "mainframe") {
    if (!params.userId) throw new Error("Missing userId for mainframe subscription.");
    await db.doc(`userSettings/${params.userId}`).set({
      ...payload,
      mainframeAnalyticsSubscription: params.active,
      mainframeAnalyticsSubscriptionStatus: params.status,
    }, { merge: true });
    return;
  }

  if (!params.orgId) throw new Error("Missing orgId for workspace subscription.");
  await db.doc(`organizations/${params.orgId}`).set({
    ...payload,
    workspaceAnalyticsSubscription: params.active,
    workspaceAnalyticsSubscriptionStatus: params.status,
    workspaceAnalyticsSeatCount: params.workspaceSeatCount || null,
    workspaceAnalyticsMonthlyAmountCents: params.monthlyAmountCents || null,
  }, { merge: true });
}

function stripeId(value: string | { id?: string } | null | undefined) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

function getGenAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    console.log("Gemini API Key present:", !!key);
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set. Please add it in the Secrets panel.");
    }
    genAI = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

const VALID_DOMAINS = [
  "Work",
  "Development",
  "Admin",
  "Health",
  "Wellness",
  "Meals",
  "Leisure",
  "Personal",
  "Wealth",
  "Sleep",
] as const;

function normalizeParsedTasks(rawTasks: any[], referenceDate: string) {
  const isSleepBoundaryTask = (task: any) => {
    const title = String(task.title || "").trim();
    const text = `${title} ${task.description || ""}`.toLowerCase();
    if (/\b(nap|power nap)\b/.test(text)) return false;
    return task.domain === "Sleep" ||
      /^(sleep|go to sleep|get in bed|bedtime|wake up|wakeup|waking up|get up)$/i.test(title) ||
      /\b(wake up|wakeup|go to sleep|get in bed)\b/.test(text);
  };

  const intendedMinute = (task: any) => {
    if (typeof task.fixedTime === "string" && /^\d{2}:\d{2}$/.test(task.fixedTime)) {
      const [hour, minute] = task.fixedTime.split(":").map(Number);
      return hour * 60 + minute;
    }

    const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();
    if (/\b(wake|waking|wake up|morning|breakfast)\b/.test(text)) return 7 * 60;
    if (/\b(lunch|noon|midday)\b/.test(text)) return 12 * 60;
    if (task.domain === "Health" || /\b(workout|exercise|gym|walk|run)\b/.test(text)) return 17 * 60;
    if (/\b(dinner|supper)\b/.test(text)) return 18 * 60;
    if (/\b(before bed|bedtime|night|evening|wind down)\b/.test(text)) return 21 * 60;
    if (task.domain === "Work" || task.domain === "Development") return 10 * 60;
    if (task.domain === "Admin" || task.domain === "Wealth") return 14 * 60;
    if (task.domain === "Leisure" || /\b(tv|movie|relax|game)\b/.test(text)) return 19 * 60;
    return Number.POSITIVE_INFINITY;
  };

  return rawTasks
    .filter((t: any) => !isSleepBoundaryTask(t))
    .map((t: any, index: number) => ({
    ...t,
    __inputOrder: index,
    title: String(t.title || "Untitled").slice(0, 100),
    description: t.description ? String(t.description).slice(0, 500) : null,
    duration: Math.floor(Math.max(1, Math.min(480, Number(t.duration) || 30))),
    domain: VALID_DOMAINS.includes(t.domain) ? t.domain : "Personal",
    priority: Math.min(3, Math.max(1, Number(t.priority) || 2)),
    date: t.date || referenceDate,
    fixedTime: t.fixedTime || undefined,
    everyHours: t.everyHours ? Number(t.everyHours) : undefined,
    }))
    .sort((a: any, b: any) => {
      const dateCompare = String(a.date).localeCompare(String(b.date));
      if (dateCompare !== 0) return dateCompare;
      const timeCompare = intendedMinute(a) - intendedMinute(b);
      if (timeCompare !== 0) return timeCompare;
      return a.__inputOrder - b.__inputOrder;
    })
    .map(({ __inputOrder, ...task }: any) => task);
}

function parseTaskLocally(input: string, referenceDate: string) {
  const domainPatterns: Array<[typeof VALID_DOMAINS[number], RegExp]> = [
    ["Development", /\b(code|coding|develop|build|debug|deploy|github|app|website|software)\b/i],
    ["Work", /\b(work|meeting|client|email|report|presentation|call|project)\b/i],
    ["Admin", /\b(admin|paperwork|invoice|schedule|calendar|errand|forms?)\b/i],
    ["Health", /\b(workout|exercise|run|walk|gym|doctor|meds?|medicine)\b/i],
    ["Wellness", /\b(meditate|journal|therapy|mindful|stretch|yoga|brush teeth|brush my teeth|floss|hygiene)\b/i],
    ["Meals", /\b(breakfast|lunch|dinner|meal|cook|eat|snack|grocer)\b/i],
    ["Leisure", /\b(read|game|movie|tv|television|relax|hobby|music)\b/i],
    ["Wealth", /\b(budget|bank|finance|invest|tax|bill)\b/i],
    ["Sleep", /\b(sleep|nap|bedtime|rest)\b/i],
  ];

  const formatTime = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const parseTimeParts = (hourRaw: string, minuteRaw?: string, meridiemRaw?: string, assumedMeridiem?: string) => {
    let hour = Number(hourRaw);
    const minute = Number(minuteRaw || 0);
    const meridiem = (meridiemRaw || assumedMeridiem || "")?.toLowerCase();
    if (hour > 23 || minute > 59) return undefined;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    return { hour, minute, value: formatTime(hour, minute) };
  };

  const parseTimeRange = (text: string) => {
    const match = text.match(/\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|until|through)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!match) return undefined;
    const end = parseTimeParts(match[4], match[5], match[6]);
    const start = parseTimeParts(match[1], match[2], match[3], match[3] || match[6]);
    if (!start || !end) return undefined;
    let duration = (end.hour * 60 + end.minute) - (start.hour * 60 + start.minute);
    if (duration <= 0) duration += 24 * 60;
    return { fixedTime: start.value, duration, text: match[0] };
  };

  const parseFixedTime = (text: string) => {
    const range = parseTimeRange(text);
    if (range) return range.fixedTime;

    const match = text.match(/\b(?:at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(\d{1,2}):(\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm))\b/i);
    if (!match) return undefined;
    const parsed = parseTimeParts(match[1] || match[4] || match[7], match[2] || match[5], match[3] || match[6] || match[8]);
    return parsed?.value;
  };

  const inferDuration = (text: string, domain: typeof VALID_DOMAINS[number]) => {
    if (/\b(all day|for the day|whole day)\b/i.test(text)) return 480;
    if (/\b(charge phone|plug in phone)\b/i.test(text)) return 1;
    if (/\b(set alarm|set alarms)\b/i.test(text)) return 2;
    if (/\b(brush teeth|brush my teeth|floss)\b/i.test(text)) return 3;
    if (/\b(medication|meds|take pills|vitamins)\b/i.test(text)) return 3;
    if (/\b(wash face)\b/i.test(text)) return 5;
    if (/\b(pack bag|packing bag|pack lunch|packing lunch)\b/i.test(text)) return 5;
    if (/\b(get dressed|dressed)\b/i.test(text)) return 10;
    if (/\b(skin care|skincare|prepare clothes|lay out clothes)\b/i.test(text)) return 10;
    if (/\b(quick tidy|tidy up|quick clean)\b/i.test(text)) return 15;
    if (/\b(quick|brief|small|short)\b/i.test(text)) return 15;
    if (/\b(pray|prayer|journal|breathing)\b/i.test(text)) return 10;
    if (/\b(shower|bathe)\b/i.test(text)) return 20;
    if (/\b(workout|exercise|gym|run)\b/i.test(text)) return 60;
    if (/\b(meeting|appointment|call)\b/i.test(text)) return 30;
    if (/\b(deep work|code|coding|develop|build|job applications?|apply for jobs?)\b/i.test(text)) return 90;
    if (domain === "Meals") return 45;
    if (domain === "Admin") return 30;
    return 30;
  };

  const expandTimingCues = (piece: string) => {
    const hasMorningCue = /\b(wake|waking|wake up|morning|breakfast)\b/i.test(piece);
    const hasBedCue = /\b(before bed|bedtime|night|evening|wind down)\b/i.test(piece);

    if (hasMorningCue && hasBedCue && /\b(and|&|plus)\b/i.test(piece)) {
      const base = piece
        .replace(/\b(when|after|upon)\s+waking\s+up\b/ig, "")
        .replace(/\b(when|after|upon)\s+wake\s+up\b/ig, "")
        .replace(/\bin the morning\b/ig, "")
        .replace(/\bbefore bed\b/ig, "")
        .replace(/\bat bedtime\b/ig, "")
        .replace(/\bat night\b/ig, "")
        .replace(/\band\b/ig, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/^[-:]+|[-:]+$/g, "")
        .trim();
      const title = base || piece;
      return [`${title} after waking up`, `${title} before bed`];
    }

    return [piece];
  };

  const pieces = input
    .split(/\r?\n|;|,(?=\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|[a-z]))/i)
    .map((piece) => piece.trim())
    .flatMap(expandTimingCues)
    .filter(Boolean);

  return normalizeParsedTasks(pieces.map((piece) => {
    const timeRange = parseTimeRange(piece);
    const recurrenceMatch = piece.match(/\bevery\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i);
    const durationMatch = [...piece.matchAll(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi)]
      .find((match) => !/\bevery\s+$/i.test(piece.slice(Math.max(0, match.index - 8), match.index)));
    const duration = timeRange
      ? timeRange.duration
      : durationMatch
      ? Number(durationMatch[1]) * (/^h|hour/i.test(durationMatch[2]) ? 60 : 1)
      : undefined;
    const domain = domainPatterns.find(([, pattern]) => pattern.test(piece))?.[0] || "Personal";
    const priority = /\b(urgent|asap|important|high priority)\b/i.test(piece)
      ? 1
      : /\b(maybe|if there is time|low priority|optional)\b/i.test(piece)
        ? 3
        : 2;
    const title = piece
      .replace(timeRange?.text || "__NO_TIME_RANGE__", "")
      .replace(/\bevery\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h)\b/i, "")
      .replace(/\b(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i, "")
      .replace(/\b\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/i, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/^[-:]+|[-:]+$/g, "")
      .trim();

    return {
      title: title || piece,
      duration: duration ?? inferDuration(piece, domain),
      domain,
      priority,
      date: referenceDate,
      fixedTime: timeRange?.fixedTime || parseFixedTime(piece),
      source: domain === "Work" && /\b(work|shift|job|clock in|clock out)\b/i.test(piece) && timeRange ? "workSchedule" : undefined,
      everyHours: recurrenceMatch ? Number(recurrenceMatch[1]) : undefined,
    };
  }), referenceDate);
}

function buildInviteEmailHtml(params: {
  name: string;
  orgName: string;
  inviteLink: string;
  role: string;
  jobTitle?: string;
}) {
  const safeName = params.name.replace(/[<>&]/g, '');
  const safeOrg = params.orgName.replace(/[<>&]/g, '');
  const safeRole = params.role.replace(/[<>&]/g, '');
  const safeJobTitle = (params.jobTitle || '').replace(/[<>&]/g, '');
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
      <h2 style="margin:0 0 12px">You're invited to FlowState</h2>
      <p>Hi ${safeName || 'there'},</p>
      <p>You've been invited to join <strong>${safeOrg}</strong> as a <strong>${safeRole}</strong>${safeJobTitle ? ` (${safeJobTitle})` : ''}.</p>
      <p>
        <a href="${params.inviteLink}" style="display:inline-block;background:#10b981;color:#052e16;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px">
          Join Workspace
        </a>
      </p>
      <p style="font-size:13px;color:#64748b">If the button does not work, copy and paste this link:</p>
      <p style="font-size:13px;word-break:break-all;color:#0f766e">${params.inviteLink}</p>
      <p style="font-size:12px;color:#94a3b8">This invite expires in 7 days.</p>
    </div>
  `;
}

function buildInviteEmailText(params: {
  name: string;
  orgName: string;
  inviteLink: string;
  role: string;
  jobTitle?: string;
}) {
  const title = params.jobTitle ? ` (${params.jobTitle})` : '';
  return `Hi ${params.name || 'there'},

You've been invited to join ${params.orgName} on FlowState as a ${params.role}${title}.

Join here:
${params.inviteLink}

This invite expires in 7 days.`;
}

async function startServer() {
  console.log("Server starting process initiated...");
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  console.log("Mode:", process.env.NODE_ENV || 'development');

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const signature = req.headers["stripe-signature"];

      if (!webhookSecret) {
        return res.status(500).send("STRIPE_WEBHOOK_SECRET is not configured.");
      }
      if (!signature) {
        return res.status(400).send("Missing Stripe signature.");
      }

      const event = getStripe().webhooks.constructEvent(req.body, signature, webhookSecret);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const scope = session.metadata?.scope;

        if (isAnalyticsScope(scope) && session.mode === "subscription") {
          await writeAnalyticsSubscription({
            scope,
            active: true,
            status: "active",
            userId: session.metadata?.userId || undefined,
            orgId: session.metadata?.orgId || undefined,
            stripeCustomerId: stripeId(session.customer),
            stripeSubscriptionId: stripeId(session.subscription),
            workspaceSeatCount: Number(session.metadata?.workspaceMemberCount) || undefined,
            monthlyAmountCents: Number(session.metadata?.monthlyAmountCents) || undefined,
          });
        }
      }

      if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        const scope = subscription.metadata?.scope;

        if (isAnalyticsScope(scope)) {
          const active = event.type !== "customer.subscription.deleted" && ["active", "trialing"].includes(subscription.status);
          await writeAnalyticsSubscription({
            scope,
            active,
            status: subscription.status,
            userId: subscription.metadata?.userId || undefined,
            orgId: subscription.metadata?.orgId || undefined,
            stripeCustomerId: stripeId(subscription.customer),
            stripeSubscriptionId: subscription.id,
            workspaceSeatCount: Number(subscription.metadata?.workspaceMemberCount) || undefined,
            monthlyAmountCents: Number(subscription.metadata?.monthlyAmountCents) || undefined,
          });
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("[FlowState] Stripe webhook failed:", error);
      res.status(400).send(`Webhook error: ${error.message || "Unknown error"}`);
    }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { scope, orgId, idToken, returnUrl } = req.body || {};
      let workspaceMemberCount = 1;
      let monthlyAmountCents = ANALYTICS_PRODUCT_CONFIG.mainframe.unitAmount;

      if (!isAnalyticsScope(scope)) {
        return res.status(400).json({ error: "A valid analytics subscription scope is required." });
      }

      if (!idToken || typeof idToken !== "string") {
        return res.status(401).json({ error: "Sign in before starting a subscription." });
      }

      const decodedToken = await getAdminAuth().verifyIdToken(idToken);
      const userRecord = await getAdminAuth().getUser(decodedToken.uid).catch(() => null);
      const customerEmail = userRecord?.email || (typeof decodedToken.email === "string" ? decodedToken.email : undefined);

      if (scope === "workspace") {
        if (!orgId || typeof orgId !== "string") {
          return res.status(400).json({ error: "Workspace analytics requires a workspace." });
        }
        await assertWorkspaceAdmin(decodedToken.uid, orgId);
        workspaceMemberCount = await getWorkspaceMemberCount(orgId);
        monthlyAmountCents = getWorkspaceAnalyticsAmountCents(workspaceMemberCount);
      }

      const baseReturnUrl = normalizeReturnUrl(returnUrl, req);
      const paymentScope = scope;
      const successUrl = appendCheckoutParams(baseReturnUrl, {
        payment: "success",
        payment_scope: paymentScope,
        session_id: "{CHECKOUT_SESSION_ID}",
      });
      const cancelUrl = appendCheckoutParams(baseReturnUrl, {
        payment: "cancelled",
        payment_scope: paymentScope,
      });

      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [buildStripeLineItem(scope, workspaceMemberCount)],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        allow_promotion_codes: true,
        managed_payments: {
          enabled: true,
        },
        metadata: {
          scope,
          userId: decodedToken.uid,
          orgId: scope === "workspace" ? orgId : "",
          workspaceMemberCount: scope === "workspace" ? String(workspaceMemberCount) : "",
          monthlyAmountCents: String(monthlyAmountCents),
        },
        subscription_data: {
          metadata: {
            scope,
            userId: decodedToken.uid,
            orgId: scope === "workspace" ? orgId : "",
            workspaceMemberCount: scope === "workspace" ? String(workspaceMemberCount) : "",
            monthlyAmountCents: String(monthlyAmountCents),
          },
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("[FlowState] Checkout session failed:", error);
      const status = error instanceof HttpError ? error.status : 500;
      res.status(status).json({ error: getPublicErrorMessage(error, "Unable to start checkout.") });
    }
  });

  app.post("/api/confirm-checkout-session", async (req, res) => {
    try {
      const { sessionId, idToken } = req.body || {};
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({ error: "A Stripe checkout session ID is required." });
      }
      if (!idToken || typeof idToken !== "string") {
        return res.status(401).json({ error: "Sign in before confirming a subscription." });
      }

      const decodedToken = await getAdminAuth().verifyIdToken(idToken);
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      const scope = session.metadata?.scope;

      if (!isAnalyticsScope(scope)) {
        return res.status(400).json({ error: "This checkout session is not a FlowState analytics subscription." });
      }
      if (session.metadata?.userId !== decodedToken.uid) {
        return res.status(403).json({ error: "This checkout session belongs to a different user." });
      }
      if (session.mode !== "subscription" || session.status !== "complete" || !["paid", "no_payment_required"].includes(session.payment_status || "")) {
        return res.status(402).json({ error: "Stripe has not confirmed payment for this subscription yet." });
      }

      if (scope === "workspace") {
        const orgId = session.metadata?.orgId;
        if (!orgId) return res.status(400).json({ error: "This workspace checkout session is missing its workspace." });
        await assertWorkspaceAdmin(decodedToken.uid, orgId);
      }

      await writeAnalyticsSubscription({
        scope,
        active: true,
        status: "active",
        userId: session.metadata?.userId || undefined,
        orgId: session.metadata?.orgId || undefined,
        stripeCustomerId: stripeId(session.customer),
        stripeSubscriptionId: stripeId(session.subscription),
        workspaceSeatCount: Number(session.metadata?.workspaceMemberCount) || undefined,
        monthlyAmountCents: Number(session.metadata?.monthlyAmountCents) || undefined,
      });

      res.json({ active: true, scope });
    } catch (error: any) {
      console.error("[FlowState] Checkout confirmation failed:", error);
      const status = error instanceof HttpError ? error.status : 500;
      res.status(status).json({ error: getPublicErrorMessage(error, "Unable to confirm checkout.") });
    }
  });

  app.post("/api/send-invite-email", async (req, res) => {
    try {
      const { email, name, orgName, inviteLink, role, jobTitle } = req.body || {};
      if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "A valid invite email address is required." });
      }
      if (!inviteLink || typeof inviteLink !== 'string' || !inviteLink.startsWith('http')) {
        return res.status(400).json({ error: "A valid invite link is required." });
      }

      const invite = {
        name: String(name || 'there'),
        orgName: String(orgName || 'your workspace'),
        inviteLink,
        role: String(role || 'worker'),
        jobTitle: jobTitle ? String(jobTitle) : '',
      };
      const subject = `You're invited to join ${invite.orgName} on FlowState`;
      const text = buildInviteEmailText(invite);
      const html = buildInviteEmailHtml(invite);

      const resendApiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'FlowState <onboarding@resend.dev>';

      if (!resendApiKey) {
        const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
        return res.json({
          sent: false,
          reason: 'missing_email_provider',
          mailtoUrl,
        });
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject,
          html,
          text,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('[FlowState] Invite email send failed:', data);
        return res.status(502).json({
          error: data?.message || 'Email provider rejected the invite email.',
          provider: data,
        });
      }

      res.json({ sent: true, id: data?.id || null });
    } catch (error: any) {
      console.error('[FlowState] Invite email endpoint failed:', error);
      res.status(500).json({ error: error.message || 'Invite email failed.' });
    }
  });

  async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = error.message?.includes('503') || 
                         error.message?.includes('UNAVAILABLE') || 
                         error.message?.includes('429') || 
                         error.status === 503 || 
                         error.status === 429;
      
      if (!isRetryable || i === maxRetries - 1) {
        throw error;
      }
      
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Gemini API retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

  app.post("/api/parse-task", async (req, res) => {
    console.log("[FlowState] Received parse-task request");
    try {
      const { input, date: passedDate } = req.body;
      if (!input) {
        console.warn("[FlowState] Missing input for parse-task");
        return res.status(400).json({ error: "Input is required" });
      }

      const now = new Date();
      const defaultToday = format(now, "yyyy-MM-dd");
      const referenceDate = passedDate || defaultToday;

      if (!process.env.GEMINI_API_KEY) {
        console.warn("[FlowState] GEMINI_API_KEY missing; using local parser fallback.");
        return res.json(parseTaskLocally(input, referenceDate));
      }

      console.log("[FlowState] Initializing GenAI...");
      const ai = getGenAI();

      console.log(`[FlowState] Calling Gemini for input (${input.length} chars) at refDate: ${referenceDate}`);

      const systemInstruction = `Today is ${now.toISOString()}. 
        The context date being viewed is ${referenceDate}.
        
        Extract EVERY discrete task from the user's input.
        
        Domain Enums: 
        - Work, Health, Wellness, Meals, Sleep, Development, Admin, Personal, Leisure, Wealth.
        
        Rules:
        1. PRESERVE TITLES: Use the exact words provided for task names.
        2. Assign a Domain from the list above.
        3. Extract durations in minutes from phrases like "for an hour", "30 minutes", "all day", or "quick". If a time range is written, calculate the duration from the range. Examples: "meeting 1pm-2:30pm" is fixedTime "13:00" and duration 90; "work from 9 to 11am" is fixedTime "09:00" and duration 120. If no duration is stated, infer a realistic duration from the task type: brush teeth 2-3, wash face 2-5, get dressed 5-10, pack bag or pack lunch 5, set alarm 1-2, charge phone 1, quick tidy 10-15, shower 10-20, medication 2-3, quick admin 15-30, calls/meetings 30-60, eating 15-30, cooking or meal prep 20-45, workouts 45-90, deep work/development/job applications 60-120.
        4. Priority: 1 (High), 2 (Medium), 3 (Low). Phrases like "if there is time", "maybe", or "low priority" should be assigned Priority 3.
        5. Date: Use ${referenceDate} unless another day is explicitly mentioned.
        6. RECURRING TASKS: If a user says "every X hours" or "every X hrs", extract the interval as "everyHours" (number).
        7. SPECIFIC TIMES: If the user mentions an exact start time ("at 3pm", "9:30", "noon", "midnight") or a time range ("2pm-4pm", "from 9 to 11am"), set fixedTime in 24-hour HH:mm. Do not confuse a duration ("for 3 hours") or recurrence ("every 3 hours") with a start time.
        8. MULTIPLE TIMING CUES: If one phrase contains multiple intended times of day, create separate tasks. Example: "brush teeth when waking up and before bed" should become "brush teeth after waking up" and "brush teeth before bed".
        9. NATURAL TIMING: Use the domain and wording to support smart scheduling. Meals should be Meals, naps should be Sleep, workouts should be Health, coding/building should be Development, forms/emails/paperwork should be Admin or Work. Keep phrases like "after waking up", "morning", "before bed", or "at night" in the title/description when they are timing cues and not exact times. These cues must be relative to the user's own wake/sleep rhythm, not default social clock times.
        10. MEAL TIMING: Breakfast belongs near the start of the user's awake period, lunch around the middle of that user's awake period, and dinner/supper in the later part of that user's awake period. Do not force meals into conventional 7am/noon/6pm slots unless the user explicitly gives those times.
        11. SLEEP/WAKE BOUNDARIES: Do not create tasks for standalone "sleep", "go to sleep", "get in bed", "wake up", or "get up". Those are handled by the user's sleep schedule and alarm option. Keep true naps as schedulable tasks.
        12. TOP 1% DAILY PLANNING: Extract tasks for an elite, realistic, human daily schedule. Essentials must be protected first: hygiene, medication, meals, fixed commitments, commute, work/school, health, money tasks, and preparation for tomorrow. Nice-to-have tasks should be priority 3 when the wording makes them optional.
        13. WORK SCHEDULE BOUNDARY: Generic work/shift input is handled as Work Schedule, not as a normal task. If the user gives a generic work or shift time range, such as "work 9am-5pm" or "shift 10pm-6am", set domain "Work", fixedTime to the start, duration to the range length, and source "workSchedule". If generic work/shift is mentioned without both start and end times, still extract it without fixedTime so the app can skip it and point the user to Work Schedule. Do not invent work times. Specific work tasks like emails, calls, meetings, reports, client work, presentations, coding, or projects should remain normal tasks.
        14. PLAN TASKS IN RELATION TO EACH OTHER: Preserve dependency clues in titles/descriptions. Prep/packing/getting dressed should come before leaving, commute should come before work/school/appointments, meals should fit around fixed commitments, recovery/breaks should follow long blocks, and wind-down/prep-for-tomorrow should come after evening essentials. This must be general, not only for work: keep phrases like "before class", "after work", "before dinner", "after appointment", "before bed", and "after waking up" so the scheduler can anchor tasks to the correct event.
        15. OPTIMIZATION: If the user asks to "optimize", "fit everything", or "arrange best", preserve the user's explicit times and durations. Optimization may choose smart times only for non-work tasks without explicit start times. Do not move, rename away, merge, or shorten explicit-time tasks in the extracted output. Focus on logic, timing, and dependencies rather than mentioning an output format.
        16. USER PREFERENCES ARE SCHEDULING CUES: Preference statements are not standalone tasks. Apply them by keeping useful preference wording on relevant tasks, such as "preference: evening workout", "preference: no late meals", "preference: needs breaks", or "preference: study in morning". Do not turn preferences into fake chores.
        17. CHRONOLOGICAL OUTPUT: Return tasks in chronological order by explicit time, date, natural timing cue, or dependency order when known.
        18. Provide a JSON object with a "tasks" array.`;

      const result = await withRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ parts: [{ text: input }] }],
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            temperature: 0.1,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      duration: { type: Type.INTEGER },
                      domain: {
                        type: Type.STRING,
                        enum: [
                          "Work",
                          "Development",
                          "Admin",
                          "Health",
                          "Wellness",
                          "Meals",
                          "Leisure",
                          "Personal",
                          "Wealth",
                          "Sleep",
                        ],
                      },
                      priority: { type: Type.INTEGER },
                      date: { type: Type.STRING },
                      fixedTime: {
                        type: Type.STRING,
                        description: "HH:mm format (24h) if a specific time was mentioned, otherwise omit",
                      },
                      everyHours: {
                        type: Type.NUMBER,
                        description:
                          "Recurrence interval in hours if mentioned (e.g. 'every 2 hours'), otherwise omit",
                      },
                      source: {
                        type: Type.STRING,
                        description:
                          "Use workSchedule only for generic timed work or shift blocks, otherwise omit",
                      },
                    },
                    required: ["title", "duration", "domain", "priority", "date"],
                  },
                },
              },
              required: ["tasks"],
            },
          },
        })
      );

      console.log("[FlowState] Gemini API call completed successfully");
      let text = result.text;
      if (!text) {
        console.error("[FlowState] Empty response from Gemini");
        throw new Error("No response generated by the AI");
      }

      console.log("[FlowState] Gemini raw response text length:", text.length);

      // Extract JSON content between first { and last }
      // This is safer if the AI includes any preamble or tail
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.substring(firstBrace, lastBrace + 1);
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.error("[FlowState] JSON Parse Error. Content:", text);
        // If content is very large, don't throw everything in error message but log it
        throw new Error("The AI provided a response that couldn't be parsed. Please try a simpler list.");
      }

      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        console.error("[FlowState] Missing tasks array in response:", parsed);
        throw new Error("AI failed to generate a list of tasks in the correct format.");
      }

      console.log(`[FlowState] Gemini successfully extracted ${parsed.tasks.length} tasks`);
      const tasks = normalizeParsedTasks(parsed.tasks, referenceDate);
      res.json(tasks);
    } catch (error: any) {
      console.error("[FlowState] Gemini API Failure:", error);
      const statusCode = error.status || 500;
      res.status(statusCode).json({ 
        error: error.message || "Gemini failed to respond. The list might be too long or complex.",
        code: statusCode
      });
    }
  });

  app.post("/api/sync-calendar", async (req, res) => {
    console.log("Received sync-calendar request");
    try {
      const { accessToken, date } = req.body;
      const timeMin = new Date(date);
      timeMin.setHours(0, 0, 0, 0);
      const timeMax = new Date(date);
      timeMax.setHours(23, 59, 59, 999);

      // 1. Get List of all calendars
      const listUrl = `https://www.googleapis.com/calendar/v3/users/me/calendarList`;
      const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error("Failed to fetch calendar list:", errorText);
        throw new Error('Failed to fetch calendar list');
      }

      const listData = await listResponse.json();
      const calendars = listData.items || [{ id: 'primary' }];

      // 2. Fetch events from each calendar
      const allTasks = [];
      for (const calendar of calendars) {
        try {
          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`;
          
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!response.ok) continue;

          const data = await response.json();
          const events = data.items || [];

          const tasks = events.map((event: any) => {
            try {
              const start = event.start?.dateTime || event.start?.date;
              const end = event.end?.dateTime || event.end?.date;
              if (!start || !end) return null;

              const startDate = new Date(start);
              const endDate = new Date(end);

              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

              const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

              return {
                title: event.summary || "Untitled Event",
                description: event.description || "",
                duration: Math.max(15, isNaN(duration) ? 30 : duration),
                domain: "Admin", 
                priority: 2,
                date: date,
                fixedTime: event.start.dateTime ? format(startDate, 'HH:mm') : null,
                externalId: event.id
              };
            } catch (e) {
              return null;
            }
          }).filter((t: any) => t !== null);
          
          allTasks.push(...tasks);
        } catch (calendarError) {
          console.error(`Error fetching calendar ${calendar.id}:`, calendarError);
        }
      }

      // Deduplicate by externalId if multiple calendars have the same event (unlikely but possible)
      const seen = new Set();
      const uniqueTasks = allTasks.filter(t => {
        if (seen.has(t.externalId)) return false;
        seen.add(t.externalId);
        return true;
      });

      res.json(uniqueTasks);
    } catch (error: any) {
      console.error("Calendar Sync Error:", error);
      res.status(500).json({ error: error.message || "Failed to sync calendar" });
    }
  });

  // Proxy for external calendars (ICS)
  app.get("/api/calendar/url", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar from URL: ${response.statusText}`);
      }

      const icsContent = await response.text();
      
      // Simple VEVENT parser
      const events: any[] = [];
      const eventBlocks = icsContent.split('BEGIN:VEVENT');
      eventBlocks.shift(); // Remove content before first VEVENT

      for (const block of eventBlocks) {
        const summaryMatch = block.match(/SUMMARY:(.*)/);
        const startMatch = block.match(/DTSTART(?:;VALUE=DATE)?:(.*)/);
        const endMatch = block.match(/DTEND(?:;VALUE=DATE)?:(.*)/);
        const descriptionMatch = block.match(/DESCRIPTION:(.*)/);

        if (summaryMatch && startMatch && endMatch) {
          const title = summaryMatch[1].trim();
          const startRaw = startMatch[1].trim();
          const endRaw = endMatch[1].trim();
          
          // Parse basic iCal dates (YYYYMMDDTHHMMSSZ or YYYYMMDD)
          const parseIcalDate = (raw: string) => {
            // Remove any parameters like ;TZID=... 
            const cleanRaw = raw.split(':').pop() || '';
            const year = parseInt(cleanRaw.substring(0, 4));
            const month = parseInt(cleanRaw.substring(4, 6)) - 1;
            const day = parseInt(cleanRaw.substring(6, 8));
            if (cleanRaw.includes('T')) {
              const hour = parseInt(cleanRaw.substring(9, 11));
              const minute = parseInt(cleanRaw.substring(11, 13));
              return new Date(Date.UTC(year, month, day, hour, minute));
            }
            return new Date(year, month, day);
          };

          try {
            const startDate = parseIcalDate(startRaw);
            const endDate = parseIcalDate(endRaw);
            const duration = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

            events.push({
              title,
              description: descriptionMatch ? descriptionMatch[1].trim() : "",
              duration: Math.max(15, isNaN(duration) ? 30 : duration),
              domain: "Admin",
              priority: 2,
              date: format(startDate, 'yyyy-MM-dd'),
              fixedTime: startRaw.includes('T') ? format(startDate, 'HH:mm') : null,
              externalId: `url-${startDate.getTime()}-${title.substring(0, 10)}`
            });
          } catch (e) {
            // Skip invalid events
          }
        }
      }

      res.json(events);
    } catch (error: any) {
      console.error("URL Sync Error:", error);
      res.status(500).json({ error: error.message || "Failed to sync URL" });
    }
  });

  // Vite middleware for development
  const distPath = path.join(process.cwd(), 'dist');
  const isDevCommand = process.env.npm_lifecycle_event === "dev";
  const shouldServeStatic = process.env.NODE_ENV === "production" || (!isDevCommand && fs.existsSync(path.join(distPath, 'index.html')));

  if (!shouldServeStatic) {
    console.log("Initializing Vite server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    console.log("Vite server initialized");
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

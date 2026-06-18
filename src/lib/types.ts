export type TaskDomain = 'Development' | 'Admin' | 'Leisure' | 'Personal' | 'Wealth' | 'Health';
export type TaskPriority = 1 | 2 | 3;
export type TaskStatus = 'pending' | 'complete' | 'overflow';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  duration: number;
  domain: TaskDomain;
  priority: TaskPriority;
  status: TaskStatus;
  date: string;
  fixedTime?: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserSettings {
  sleepStart: string;
  sleepEnd: string;
  morningRoutine: number;
  eveningRoutine: number;
  alarmEnabled?: boolean;
  alarmTime?: string;
  mainframeAnalyticsSubscription?: boolean;
}

export interface CheckIn {
  id?: string;
  userId: string;
  date: string;
  mood: number;
  energy: number;
  createdAt: any;
}

import { addMinutes, format, parse, isAfter, isBefore, startOfDay, endOfDay, addDays } from 'date-fns';

export interface Task {
  id: string;
  title: string;
  description?: string;
  duration: number;
  domain: 'Work' | 'Development' | 'Admin' | 'Health' | 'Wellness' | 'Meals' | 'Leisure' | 'Personal' | 'Wealth' | 'Sleep';
  priority: number;
  status: 'pending' | 'complete' | 'overflow';
  date: string;
  userId: string;
  orgId?: string | null;
  workerId?: string | null;
  createdAt?: any;
  updatedAt?: any;
  fixedTime?: string; // HH:mm
  everyHours?: number; // recurrence interval in hours
  source?: string;
}

export interface UserSettings {
  sleepStart: string; // HH:mm
  sleepEnd: string; // HH:mm
  morningRoutine: number;
  eveningRoutine: number;
  individualMode?: boolean;
  alarmEnabled?: boolean;
  alarmTime?: string; // HH:mm
  mainframeAnalyticsSubscription?: boolean;
}

export interface ScheduledItem {
  task?: Task;
  type: 'task' | 'sleep' | 'routine' | 'gap';
  start: Date;
  end: Date;
  title: string;
}

export interface ScheduleResult {
  schedule: ScheduledItem[];
  overflow: Task[];
}

const overlaps = (start: Date, end: Date, item: ScheduledItem) => isBefore(start, item.end) && isAfter(end, item.start);
const maxDate = (...dates: Date[]) => new Date(Math.max(...dates.map(date => date.getTime())));
const minDate = (...dates: Date[]) => new Date(Math.min(...dates.map(date => date.getTime())));
const minutesBetween = (start: Date, end: Date) => (end.getTime() - start.getTime()) / 60000;

function isSleepBoundaryTask(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase().trim();
  if (/\b(nap|power nap)\b/.test(text)) return false;
  return task.domain === 'Sleep' ||
    /^(sleep|go to sleep|get in bed|bedtime|wake up|wakeup|waking up|get up)$/i.test(task.title.trim()) ||
    /\b(wake up|wakeup|go to sleep|get in bed)\b/.test(text);
}

function isWorkScheduleBlock(task: Task) {
  return task.source === 'workSchedule' || /\b(work schedule|school schedule|shift schedule|custom week|consistent weekly|alternating week)\b/i.test(task.description || '');
}

function isBeforeAnchorTask(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  return /\b(before|prior to|ahead of|prep for|prepare for|pack for|leave for|commute to|drive to|ride to|walk to|bus to|train to|get ready for)\b/.test(text);
}

function isAfterAnchorTask(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  return /\b(after|following|right after|post)\b/.test(text);
}

function isWorkBoundTask(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (isBeforeAnchorTask(task) || isAfterAnchorTask(task)) return false;
  return task.domain === 'Work' || task.domain === 'Development' || /\b(work|client|email|report|presentation|project|code|coding|develop|build|debug)\b/.test(text);
}

function getRelativeTaskOrder(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (/\b(pack|prepare|prep|bag|lunch|uniform|clothes)\b/.test(text)) return 1;
  if (/\b(get dressed|dress|shower|wash face|brush teeth|hygiene)\b/.test(text)) return 2;
  if (/\b(leave|commute|drive|ride|bus|train)\b/.test(text)) return 3;
  return 2;
}

function getAnchorKind(task: Task): string | null {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (/\b(work|shift|office|client)\b/.test(text) || isWorkScheduleBlock(task)) return 'work';
  if (/\b(school|class|campus|lecture)\b/.test(text)) return 'school';
  if (/\b(doctor|appointment|meeting|interview)\b/.test(text)) return 'appointment';
  if (/\b(workout|gym|exercise|run)\b/.test(text) || task.domain === 'Health') return 'workout';
  if (/\b(breakfast)\b/.test(text)) return 'breakfast';
  if (/\b(lunch)\b/.test(text)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(text)) return 'dinner';
  if (/\b(wake|waking|wake up|morning)\b/.test(text)) return 'wake';
  if (/\b(bed|bedtime|sleep|wind down)\b/.test(text)) return 'bed';
  return null;
}

function getReferencedAnchorKind(task: Task): string | null {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (/\b(work|shift|office|client)\b/.test(text)) return 'work';
  if (/\b(school|class|campus|lecture)\b/.test(text)) return 'school';
  if (/\b(doctor|appointment|meeting|interview)\b/.test(text)) return 'appointment';
  if (/\b(workout|gym|exercise|run)\b/.test(text)) return 'workout';
  if (/\b(breakfast)\b/.test(text)) return 'breakfast';
  if (/\b(lunch)\b/.test(text)) return 'lunch';
  if (/\b(dinner|supper)\b/.test(text)) return 'dinner';
  if (/\b(wake|waking|wake up|morning)\b/.test(text)) return 'wake';
  if (/\b(bed|bedtime|sleep|wind down)\b/.test(text)) return 'bed';
  return null;
}

function buildGaps(schedule: ScheduledItem[], dayStart: Date, dayEnd: Date) {
  const sorted = [...schedule].sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: { start: Date; end: Date }[] = [];
  let currentGapTime = dayStart;

  for (const item of sorted) {
    if (isAfter(item.start, currentGapTime)) {
      gaps.push({ start: currentGapTime, end: item.start });
    }
    if (isAfter(item.end, currentGapTime)) {
      currentGapTime = item.end;
    }
  }

  if (isBefore(currentGapTime, dayEnd)) {
    gaps.push({ start: currentGapTime, end: dayEnd });
  }

  return gaps;
}

function consumeGap(gaps: { start: Date; end: Date }[], gapIdx: number, start: Date, duration: number) {
  const gap = gaps[gapIdx];
  const end = addMinutes(start, duration);

  if (start.getTime() <= gap.start.getTime()) {
    gap.start = end;
  } else if (end.getTime() >= gap.end.getTime()) {
    gap.end = start;
  } else {
    const originalEnd = gap.end;
    gap.end = start;
    gaps.splice(gapIdx + 1, 0, { start: end, end: originalEnd });
  }

  for (let i = gaps.length - 1; i >= 0; i--) {
    if (gaps[i].start.getTime() >= gaps[i].end.getTime()) {
      gaps.splice(i, 1);
    }
  }
}

function getBufferDuration(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (task.duration < 30 || /\b(brush teeth|floss|medication|meds|pray|prayer|alarm|charge phone)\b/.test(text)) return 0;
  if (task.duration >= 120) return 10;
  if (task.duration >= 45 || ['Work', 'Development', 'Health', 'Meals'].includes(task.domain)) return 5;
  return 0;
}

function getTaskCriticality(task: Task) {
  const text = `${task.title} ${task.description || ''}`.toLowerCase();
  if (/\b(medication|meds|doctor|appointment|meeting|class)\b/.test(text)) return 0;
  if (/\b(pack|prepare|prep|get dressed|dress|uniform|bag|lunch|leave|commute|drive|ride|bus|train)\b/.test(text)) return 1;
  if (task.domain === 'Meals' || /\b(breakfast|lunch|dinner|eat|meal)\b/.test(text)) return 1;
  if (/\b(work|school|shift)\b/.test(text)) return 2;
  if (task.domain === 'Health' || /\b(workout|exercise|gym|walk|run)\b/.test(text)) return 3;
  if (task.domain === 'Wellness' || /\b(brush teeth|shower|wash face|skincare|prayer|pray|wind down)\b/.test(text)) return 3;
  if (task.domain === 'Wealth' || /\b(pay|budget|bill|money|finance|job application)\b/.test(text)) return 5;
  if (task.domain === 'Development' || task.domain === 'Work') return 6;
  if (task.domain === 'Admin') return 6;
  return 7;
}

function scheduleTaskWithBuffer(
  scheduledTasks: ScheduledItem[],
  gaps: { start: Date; end: Date }[],
  gapIdx: number,
  task: Task,
  start: Date,
  title = task.title
) {
  const gap = gaps[gapIdx];
  const taskEnd = addMinutes(start, task.duration);
  const desiredBuffer = getBufferDuration(task);
  const canAddBuffer = desiredBuffer > 0 && addMinutes(taskEnd, desiredBuffer).getTime() <= gap.end.getTime();
  const bufferDuration = canAddBuffer ? desiredBuffer : 0;

  scheduledTasks.push({
    type: 'task',
    task,
    start,
    end: taskEnd,
    title
  });

  if (bufferDuration > 0) {
    scheduledTasks.push({
      type: 'gap',
      start: taskEnd,
      end: addMinutes(taskEnd, bufferDuration),
      title: 'Buffer'
    });
  }

  consumeGap(gaps, gapIdx, start, task.duration + bufferDuration);
}

export function generateDailySchedule(tasks: Task[], settings: UserSettings, targetDate: Date): ScheduleResult {
  const schedulableTasks = tasks.filter(task => !isSleepBoundaryTask(task));
  const unscheduledWorkTasks = schedulableTasks
    .filter(task => !task.fixedTime && isWorkBoundTask(task) && !isWorkScheduleBlock(task))
    .map(task => ({ ...task, status: 'overflow' as const }));
  const scheduleEligibleTasks = schedulableTasks.filter(task => !unscheduledWorkTasks.some(workTask => workTask.id === task.id));
  if (isNaN(targetDate.getTime())) {
    return { schedule: [], overflow: scheduleEligibleTasks };
  }
  const schedule: ScheduledItem[] = [];
  
  // 1. Define bounds
  const dayStart = startOfDay(targetDate);

  // 2. Add Sleep
  const wakeUpTime = parse(settings.sleepEnd, 'HH:mm', targetDate);
  const rawSleepTime = parse(settings.sleepStart, 'HH:mm', targetDate);

  if (isNaN(wakeUpTime.getTime()) || isNaN(rawSleepTime.getTime())) {
    return { schedule: [], overflow: scheduleEligibleTasks };
  }

  const awakeWindowCrossesMidnight = !isAfter(rawSleepTime, wakeUpTime);
  const sleepTime = awakeWindowCrossesMidnight ? addDays(rawSleepTime, 1) : rawSleepTime;
  const dayEnd = awakeWindowCrossesMidnight ? sleepTime : endOfDay(targetDate);
  const awakeDurationMinutes = Math.max(1, minutesBetween(wakeUpTime, sleepTime));

  const parseClockTimeInAwakeDay = (time: string) => {
    const parsedTime = parse(time, 'HH:mm', targetDate);
    if (awakeWindowCrossesMidnight && isBefore(parsedTime, wakeUpTime)) {
      return addDays(parsedTime, 1);
    }
    return parsedTime;
  };

  if (isAfter(wakeUpTime, dayStart)) {
    schedule.push({
      type: 'sleep',
      start: dayStart,
      end: wakeUpTime,
      title: `Sleep Protection until ${settings.sleepEnd}`
    });
  }

  if (isBefore(sleepTime, dayEnd)) {
    schedule.push({
      type: 'sleep',
      start: sleepTime,
      end: dayEnd,
      title: `Sleep Protection from ${settings.sleepStart}`
    });
  }

  const overflow: Task[] = [];
  const displacedFixedTasks: Task[] = [];
  const isToday = format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const now = new Date();

  // 3. Fixed Time Tasks (Exact placement)
  const fixedTasks = scheduleEligibleTasks
    .filter(t => t.fixedTime && t.status !== 'overflow')
    .sort((a, b) => {
      const aTime = parseClockTimeInAwakeDay(a.fixedTime!).getTime();
      const bTime = parseClockTimeInAwakeDay(b.fixedTime!).getTime();
      if (aTime !== bTime) return aTime - bTime;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    });

  fixedTasks.forEach(t => {
    const start = parseClockTimeInAwakeDay(t.fixedTime!);
    if (isNaN(start.getTime())) return;
    
    const end = addMinutes(start, t.duration);
    const collidesWithUnavailableTime = isBefore(start, wakeUpTime) || isAfter(end, sleepTime);
    const conflictsWithExistingItem = schedule.some(item => overlaps(start, end, item));

    if (collidesWithUnavailableTime || conflictsWithExistingItem) {
      displacedFixedTasks.push(t);
    } else {
      schedule.push({
        type: 'task',
        task: t,
        start,
        end,
        title: t.title
      });
    }
  });

  const fixedTaskItems = schedule.filter((item): item is ScheduledItem & { task: Task } => item.type === 'task' && !!item.task);
  fixedTaskItems.forEach(item => {
    const bufferDuration = getBufferDuration(item.task);
    if (bufferDuration <= 0) return;

    const bufferStart = item.end;
    const bufferEnd = addMinutes(bufferStart, bufferDuration);
    const collides = schedule.some(existing => existing !== item && overlaps(bufferStart, bufferEnd, existing));

    if (!collides && !isAfter(bufferEnd, sleepTime)) {
      schedule.push({
        type: 'gap',
        start: bufferStart,
        end: bufferEnd,
        title: 'Buffer'
      });
    }
  });

  // 4. Add Routines (Flexible around fixed tasks)
  if (settings.morningRoutine > 0) {
    let mStart = wakeUpTime;
    let mEnd = addMinutes(mStart, settings.morningRoutine);
    
    // Shift morning routine if it hits a fixed task
    while (schedule.some(i => overlaps(mStart, mEnd, i))) {
      const conflict = schedule.find(i => overlaps(mStart, mEnd, i))!;
      mStart = addMinutes(conflict.end, 5);
      mEnd = addMinutes(mStart, settings.morningRoutine);
    }
    
    if (isBefore(mEnd, sleepTime)) {
      schedule.push({ type: 'routine', start: mStart, end: mEnd, title: 'Morning Routine' });
    }
  }

  const windDownDuration = Math.max(0, settings.eveningRoutine || 0);
  let wEnd = sleepTime;
  let wStart = addMinutes(wEnd, -windDownDuration);

  // Shift wind down earlier if it hits a fixed task
  while (windDownDuration > 0 && schedule.some(i => overlaps(wStart, wEnd, i))) {
    const conflict = schedule.find(i => overlaps(wStart, wEnd, i))!;
    wEnd = addMinutes(conflict.start, -5);
    wStart = addMinutes(wEnd, -windDownDuration);
  }

  const windDownStart = wStart; // For recurring tasks logic
  if (windDownDuration > 0 && isAfter(wStart, wakeUpTime)) {
    schedule.push({ type: 'routine', start: wStart, end: wEnd, title: 'Wind Down' });
  }

  // 4.5 handle Recurring/Interval Tasks (e.g. "every 2 hours")
  const recurringTasks = scheduleEligibleTasks.filter(t => !t.fixedTime && t.everyHours && t.status === 'pending');
  
  recurringTasks.forEach(task => {
    let currentRecurrence = addMinutes(wakeUpTime, 15); // Start a bit after wakeup
    const intervalMins = task.everyHours! * 60;

    while (isBefore(currentRecurrence, windDownStart)) {
      const start = currentRecurrence;
      const end = addMinutes(start, task.duration);

      // Check for overlap with existing schedule
      const conflict = schedule.find(item => overlaps(start, end, item));

      if (conflict) {
        // Shift it to just after the conflicting item
        currentRecurrence = addMinutes(conflict.end, 5);
        // If it pushed past wind down, stop
        if (isAfter(addMinutes(currentRecurrence, task.duration), windDownStart)) break;
        continue; 
      }

      // If it fits, add it
      schedule.push({
        type: 'task',
        task: task,
        start,
        end,
        title: `${task.title} (Recurring)`
      });

      // Move to next planned interval
      currentRecurrence = addMinutes(start, intervalMins);
    }
  });

  // Sort by start time
  schedule.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 5. Identify Gaps
  const gaps = buildGaps(schedule, dayStart, dayEnd);

  // 6. Pack Floating Tasks
  const awakeOffset = (minutes: number) => {
    const boundedMinutes = Math.max(0, Math.min(awakeDurationMinutes, Math.round(minutes)));
    return addMinutes(wakeUpTime, boundedMinutes);
  };

  const phaseWindow = (startRatio: number, endRatio: number, weight: number) => {
    const start = awakeOffset(awakeDurationMinutes * startRatio);
    let end = awakeOffset(awakeDurationMinutes * endRatio);
    if (!isAfter(end, start)) {
      end = awakeOffset(awakeDurationMinutes);
    }
    return { start, end, weight };
  };

  const fromWakeWindow = (startMinutes: number, endMinutes: number, weight: number) => {
    const start = awakeOffset(startMinutes);
    let end = awakeOffset(Math.max(endMinutes, startMinutes + 15));
    if (!isAfter(end, start)) {
      end = awakeOffset(awakeDurationMinutes);
    }
    return { start, end, weight };
  };

  const beforeSleepWindow = (minutesBeforeSleep: number, weight: number) => {
    const start = maxDate(wakeUpTime, addMinutes(sleepTime, -Math.min(minutesBeforeSleep, awakeDurationMinutes)));
    return { start, end: sleepTime, weight };
  };

  const domainPreferences: Record<string, { start: Date; end: Date; weight: number }> = {
    Development: phaseWindow(0.12, 0.38, 1.5), // Strong focus window after the user's day has started
    Work: phaseWindow(0.18, 0.65, 1.2),        // User-day core, not default office hours
    Admin: phaseWindow(0.45, 0.68, 1.0),       // Lower-friction middle portion of the user's day
    Health: phaseWindow(0.12, 0.35, 1.1),      // Early energy by default unless the user prefers later
    Wealth: phaseWindow(0.2, 0.45, 1.0),
    Wellness: phaseWindow(0.05, 0.95, 1.0),
    Personal: phaseWindow(0.6, 0.85, 1.1),
    Leisure: phaseWindow(0.75, 0.98, 1.0),
    Meals: phaseWindow(0.15, 0.88, 1.0),
    Sleep: beforeSleepWindow(120, 2.0),
  };

  const getTaskPreference = (task: Task) => {
    const text = `${task.title} ${task.description || ''}`.toLowerCase();

    if (/\b(after work|evening workout|workout in evening|workout after work|gym after work|exercise after work)\b/.test(text)) {
      return phaseWindow(0.68, 0.88, 2.2);
    }

    if (/\b(early|first thing|start of day)\b/.test(text)) {
      return fromWakeWindow(0, Math.min(120, awakeDurationMinutes * 0.18), 1.8);
    }

    if (/\b(breakfast)\b/.test(text)) {
      return fromWakeWindow(15, Math.min(150, awakeDurationMinutes * 0.22), 2.0);
    }

    if (/\b(wake|waking|wake up|morning)\b/.test(text)) {
      return fromWakeWindow(0, Math.min(120, awakeDurationMinutes * 0.2), 1.6);
    }

    if (/\b(before bed|bedtime|night|evening|wind down)\b/.test(text)) {
      return beforeSleepWindow(120, 1.6);
    }

    if (/\b(lunch|noon|midday)\b/.test(text)) {
      return phaseWindow(0.38, 0.56, 1.4);
    }

    if (/\b(dinner|supper)\b/.test(text)) {
      const avoidsLateMeals = /\b(no late meals|not too late|early dinner|dinner early|meal not late)\b/.test(text);
      return avoidsLateMeals ? phaseWindow(0.62, 0.78, 2.4) : phaseWindow(0.68, 0.88, 2.0);
    }

    return domainPreferences[task.domain] || phaseWindow(0.2, 0.7, 1.0);
  };

  // Sorting for packing: essentials first, then user priority, then larger focus blocks.
  let floatingTasks = scheduleEligibleTasks.filter(t => !t.fixedTime && t.status === 'pending' && !t.everyHours)
    .sort((a, b) => {
      const criticality = getTaskCriticality(a) - getTaskCriticality(b);
      if (criticality !== 0) return criticality;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.duration - a.duration;
    });

  const scheduledTasks: ScheduledItem[] = [];
  const remainingFloating: Task[] = [...overflow, ...unscheduledWorkTasks];

  // 6.1 Reschedule blocked fixed-time tasks only when their intended slot cannot work.
  // They get first claim on awake/free time before flexible optimization.
  displacedFixedTasks.forEach(task => {
    const intendedStart = parseClockTimeInAwakeDay(task.fixedTime!);
    let bestGapIdx = -1;
    let bestStartTime: Date | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i];
      const earliestStart = isToday && isBefore(gap.start, now) ? addMinutes(now, 2) : gap.start;
      const latestStart = addMinutes(gap.end, -task.duration);
      if (isAfter(earliestStart, latestStart)) continue;

      const clampedStart = minDate(maxDate(intendedStart, earliestStart), latestStart);
      const distance = Math.abs(minutesBetween(intendedStart, clampedStart));

      if (distance < bestDistance) {
        bestDistance = distance;
        bestGapIdx = i;
        bestStartTime = clampedStart;
      }
    }

    if (bestGapIdx !== -1 && bestStartTime) {
      scheduleTaskWithBuffer(scheduledTasks, gaps, bestGapIdx, task, bestStartTime, `${task.title} (Rescheduled)`);
    } else {
      remainingFloating.push({ ...task, status: 'overflow' });
    }
  });

  // 6.5 Keep track of what's already scheduled to prefer clustering
  const getPrevDomainAtTime = (time: Date) => {
    // Look at all currently fixed/scheduled items that end at or near this time
    const items = [...schedule, ...scheduledTasks];
    const match = items.find(i => Math.abs(i.end.getTime() - time.getTime()) < 5 * 60000); // 5 min window
    return match?.task?.domain;
  };

  const getAnchorItems = () => {
    const taskAnchors = [...schedule, ...scheduledTasks]
      .filter((item): item is ScheduledItem & { task: Task } => item.type === 'task' && !!item.task)
      .map(item => ({ kind: getAnchorKind(item.task), start: item.start, end: item.end }))
      .filter((item): item is { kind: string; start: Date; end: Date } => !!item.kind);

    return [
      ...taskAnchors,
      { kind: 'wake', start: wakeUpTime, end: wakeUpTime },
      { kind: 'bed', start: sleepTime, end: sleepTime }
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  const scheduleRelativeTaskSequences = (direction: 'before' | 'after') => {
    const relationFilter = direction === 'before' ? isBeforeAnchorTask : isAfterAnchorTask;
    const grouped = new Map<string, Task[]>();

    floatingTasks
      .filter(task => relationFilter(task) && getReferencedAnchorKind(task))
      .forEach(task => {
        const kind = getReferencedAnchorKind(task)!;
        const group = grouped.get(kind) || [];
        group.push(task);
        grouped.set(kind, group);
      });

    const consumedIds = new Set<string>();

    grouped.forEach((tasksForAnchor, anchorKind) => {
      const anchor = getAnchorItems().find(item => item.kind === anchorKind);
      if (!anchor) {
        tasksForAnchor.forEach(task => {
          remainingFloating.push({ ...task, status: 'overflow' });
          consumedIds.add(task.id);
        });
        return;
      }

      const orderedTasks = [...tasksForAnchor].sort((a, b) => {
        const order = getRelativeTaskOrder(a) - getRelativeTaskOrder(b);
        if (order !== 0) return order;
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.duration - b.duration;
      });
      const totalDuration = orderedTasks.reduce((sum, task) => sum + task.duration, 0);
      const targetGap = gaps.reduce<{ idx: number; start: Date } | null>((best, gap, idx) => {
        const start = direction === 'before'
          ? addMinutes(anchor.start, -totalDuration)
          : maxDate(anchor.end, gap.start, isToday ? addMinutes(now, 2) : gap.start);
        const end = direction === 'before' ? anchor.start : addMinutes(start, totalDuration);

        if (isBefore(start, gap.start) || isAfter(end, gap.end)) return best;
        if (isToday && isBefore(start, addMinutes(now, 2))) return best;
        if (!best || start.getTime() < best.start.getTime()) return { idx, start };
        return best;
      }, null);

      if (!targetGap) {
        orderedTasks.forEach(task => {
          remainingFloating.push({ ...task, status: 'overflow' });
          consumedIds.add(task.id);
        });
        return;
      }

      let cursor = targetGap.start;
      orderedTasks.forEach(task => {
        scheduledTasks.push({
          type: 'task',
          task,
          start: cursor,
          end: addMinutes(cursor, task.duration),
          title: task.title
        });
        cursor = addMinutes(cursor, task.duration);
        consumedIds.add(task.id);
      });
      consumeGap(gaps, targetGap.idx, targetGap.start, totalDuration);
    });

    if (consumedIds.size > 0) {
      floatingTasks = floatingTasks.filter(task => !consumedIds.has(task.id));
    }
  };

  scheduleRelativeTaskSequences('before');
  scheduleRelativeTaskSequences('after');

  for (const task of floatingTasks) {
    let bestGapIdx = -1;
    let bestStartTime: Date | null = null;
    let highestScore = -1;

    const pref = getTaskPreference(task);
    const prefStart = pref.start;
    const prefEnd = pref.end;

    for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        
        const earliestStart = isToday && isBefore(gap.start, now) ? addMinutes(now, 2) : gap.start;
        const latestStart = addMinutes(gap.end, -task.duration);
        if (isAfter(earliestStart, latestStart)) {
            continue;
        }

        const preferredStart = maxDate(earliestStart, prefStart);
        const feasibleStart = isAfter(preferredStart, latestStart) ? earliestStart : preferredStart;
        const taskEnd = addMinutes(feasibleStart, task.duration);
        const alignedMinutes = Math.max(0, (minDate(taskEnd, prefEnd).getTime() - maxDate(feasibleStart, prefStart).getTime()) / 60000);
        const alignmentRatio = Math.min(1, alignedMinutes / task.duration);
        const gapDuration = (gap.end.getTime() - earliestStart.getTime()) / 60000;

        // Calculate "Optimization Score"
        let score = 0; 
        
        // 1. Time Preference Alignment (Strongest factor)
        score += ((50 + 150 * alignmentRatio) * pref.weight) / task.priority;

        // 2. Clustering Preference: Group similar tasks
        const prevDomain = getPrevDomainAtTime(feasibleStart);
        if (prevDomain === task.domain) {
          score += 50;
        }

        // 3. Efficiency: Minimize scattering (prefer start of gaps)
        const gapWait = (feasibleStart.getTime() - earliestStart.getTime()) / 60000;
        score += Math.max(0, 40 - gapWait);

        // 4. Tightness: Prefer smaller gaps for large tasks to maximize space utility
        const remainingSpace = gapDuration - task.duration;
        score += Math.max(0, 30 - (remainingSpace / 10)); // Reward tight fits

        if (score > highestScore) {
          highestScore = score;
          bestGapIdx = i;
          bestStartTime = feasibleStart;
        }
    }

    if (bestGapIdx !== -1 && bestStartTime) {
      scheduleTaskWithBuffer(scheduledTasks, gaps, bestGapIdx, task, bestStartTime);
    } else if (task.duration >= 20) {
      // OPTIMIZATION: Try Auto-Splitting if the task doesn't fit in any single gap
      // Split into two parts (50/50)
      const part1Duration = Math.ceil(task.duration / 2);
      const part2Duration = task.duration - part1Duration;

      let part1Fit = false;
      let part2Fit = false;
      let p1Start: Date | null = null;
      let p2Start: Date | null = null;
      let p1GapIdx = -1;
      let p2GapIdx = -1;

      // Find first gap for Part 1
      for (let i = 0; i < gaps.length; i++) {
        const gap = gaps[i];
        let fs = gap.start;
        if (isToday && isBefore(fs, now)) fs = addMinutes(now, 2);
        if (isBefore(fs, gap.end) && (gap.end.getTime() - fs.getTime()) / 60000 >= part1Duration) {
          p1Start = fs;
          p1GapIdx = i;
          part1Fit = true;
          break;
        }
      }

      if (part1Fit && p1Start) {
        // Temporarily adjust gap to find Part 2 in remaining space
        const originalGap = { ...gaps[p1GapIdx] };
        gaps[p1GapIdx].start = addMinutes(p1Start, part1Duration);

        for (let i = 0; i < gaps.length; i++) {
          const gap = gaps[i];
          let fs = gap.start;
          if (isToday && isBefore(fs, now)) fs = addMinutes(now, 2);
          if (isBefore(fs, gap.end) && (gap.end.getTime() - fs.getTime()) / 60000 >= part2Duration) {
            p2Start = fs;
            p2GapIdx = i;
            part2Fit = true;
            break;
          }
        }

        if (part2Fit && p2Start) {
           // Success! Schedule both parts
           scheduledTasks.push({
             type: 'task',
             task: task,
             start: p1Start,
             end: addMinutes(p1Start, part1Duration),
             title: `${task.title} (Part 1/2)`
           });
           scheduledTasks.push({
             type: 'task',
             task: task,
             start: p2Start,
             end: addMinutes(p2Start, part2Duration),
             title: `${task.title} (Part 2/2)`
           });

           // Finalize gap updates - we must be careful with indexes if both are in same gap
           // or if splicing shifts things.
           // Easiest is to update both starts and then filter out empty gaps
           gaps[p1GapIdx].start = addMinutes(p1Start, part1Duration);
           if (p1GapIdx !== p2GapIdx) {
             gaps[p2GapIdx].start = addMinutes(p2Start, part2Duration);
           } else {
             // If they were in the same gap, the first part shifted the start, 
             // and since p2 was searched *after* that shift, p2Start is already valid
             // for the *new* state. We just shift it again for the duration of part 2.
             gaps[p2GapIdx].start = addMinutes(p2Start, part2Duration);
           }

           // Clean up empty gaps
           for (let j = gaps.length - 1; j >= 0; j--) {
             if (gaps[j].start.getTime() >= gaps[j].end.getTime()) {
               gaps.splice(j, 1);
             }
           }
        } else {
          // Revert p1 gap change if p2 didn't fit
          gaps[p1GapIdx] = originalGap;
          remainingFloating.push(task);
        }
      } else {
        remainingFloating.push(task);
      }
    } else {
      remainingFloating.push(task);
    }
  }

  // 7. Merge and finalize schedule
  const finalSchedule: ScheduledItem[] = [...schedule, ...scheduledTasks]
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Fill remaining gaps with "Free Time" markers
  const completeSchedule: ScheduledItem[] = [];
  let lastTime = dayStart;

  for (const item of finalSchedule) {
    if (isAfter(item.start, lastTime)) {
        const gapStart = lastTime;
        const gapEnd = item.start;
        
        // If it's today and the gap is partially or fully in the past, split it
        if (isToday && isBefore(gapStart, now)) {
            if (isBefore(gapEnd, now)) {
                // Entirely in the past
                completeSchedule.push({
                    type: 'gap',
                    start: gapStart,
                    end: gapEnd,
                    title: 'Passed Time'
                });
            } else {
                // Spans across 'now'
                completeSchedule.push({
                    type: 'gap',
                    start: gapStart,
                    end: now,
                    title: 'Passed Time'
                });
                completeSchedule.push({
                    type: 'gap',
                    start: now,
                    end: gapEnd,
                    title: 'Free Time'
                });
            }
        } else {
            completeSchedule.push({
                type: 'gap',
                start: gapStart,
                end: gapEnd,
                title: 'Free Time'
            });
        }
    }
    completeSchedule.push(item);
    lastTime = item.end;
  }

  if (isBefore(lastTime, dayEnd)) {
    const gapStart = lastTime;
    const gapEnd = dayEnd;
    
    if (isToday && isBefore(gapStart, now)) {
        if (isBefore(gapEnd, now)) {
            completeSchedule.push({
                type: 'gap',
                start: gapStart,
                end: gapEnd,
                title: 'Passed Time'
            });
        } else {
            completeSchedule.push({
                type: 'gap',
                start: gapStart,
                end: now,
                title: 'Passed Time'
            });
            completeSchedule.push({
                type: 'gap',
                start: now,
                end: gapEnd,
                title: 'Free Time'
            });
        }
    } else {
        completeSchedule.push({
            type: 'gap',
            start: gapStart,
            end: gapEnd,
            title: 'Free Time'
        });
    }
  }

  return {
    schedule: completeSchedule,
    overflow: remainingFloating
  };
}

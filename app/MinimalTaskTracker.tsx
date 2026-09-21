"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Battery,
  Beer,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Cloud,
  Diamond,
  Ellipsis,
  Clock,
  Clock3,
  CalendarDays,
  Coffee,
  Eye,
  Flag,
  FileText,
  Flame,
  Frown,
  Gauge,
  Gem,
  GraduationCap,
  Heart,
  HeartPulse,
  Laugh,
  Layers,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Mail,
  Martini,
  MessageCircle,
  Meh,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pill as PillIcon,
  Plane,
  Plus,
  Shield,
  Shapes,
  Snowflake,
  Smile,
  Sparkles,
  Star,
  Sun,
  Sprout,
  Target,
  Timer,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
  UserRound,
  Users,
  WandSparkles,
  Waves,
  Wind,
  Wine,
  Zap,
} from "lucide-react";
import {
  categoryDisplayLabel,
  createCategory,
  fallbackCategories,
  loadCategories,
  type Category,
  updateCategory,
  updateCategoryArchived,
} from "./categoryStore";
import { getTaskStore, isDemoMode } from "./taskStore";
import { normalizeTask, uid } from "./taskStore/taskNormalization";
import {
  deleteTimeLog as deleteSupabaseTimeLog,
  loadTimeLogs,
  saveTimeLog as saveSupabaseTimeLog,
} from "./timeLogStore/supabaseTimeLogStore";
import {
  deleteCalendarEvent,
  loadCalendarEvents,
  saveCalendarEvent,
} from "./calendarEventStore/supabaseCalendarEventStore";
import {
  createCalendarEventId,
  type CalendarEvent,
  type CalendarEventType,
} from "./calendarEventStore/calendarEventTypes";
import {
  type CalendarDaypart,
  type CalendarTimeMode,
  calendarEventIntersectsWeek,
  eventDateSpan,
  eventLocalDate,
  formatPlannerEventTime,
  formatPlannerMonthLabel,
  formatPlannerThreeMonthLabel,
  formatPlannerWeekRange,
  formatPlannerYearLabel,
  getCalendarEventDaypart,
  getCalendarEventTimeMode,
  isCalendarDaypart,
  plannerMonthsVisibleRange,
  plannerAllDaySpanKey,
  plannerAllDaySpansForDays,
  plannerDaypartAnchorMinutes,
  plannerItemDateSpan,
  plannerItemPrefix,
  plannerItemTimingLabel,
  plannerItemsForDate,
  plannerItemTitle,
  plannerMonthDaysForAnchor,
  plannerMonthWeeksForDays,
  plannerThreeMonthsForAnchor,
  plannerWeekDaysForAnchor,
  plannerYearItemEventType,
  plannerYearMonthsForAnchor,
  type PlannerDateItem,
  type PlannerMonthDay,
  type PlannerYearMonth,
  withCalendarTimingMetadata,
} from "./planner/plannerDomain";
import {
  deleteMedicationEntry,
  loadMedicationEntries,
  saveMedicationEntry,
  updateMedicationEntry,
} from "./medicationStore/supabaseMedicationStore";
import {
  createMedicationEntryId,
  type FeelingDaypart,
  type FeelingIntensity,
  type FeelingValence,
  type MedicationEntry,
  type MedicationKind,
} from "./medicationStore/medicationTypes";
import { loadAlcoholEntries, saveAlcoholEntry } from "./signalEntryStore/supabaseSignalEntryStore";
import { createAlcoholEntryId, type AlcoholEntry } from "./signalEntryStore/alcoholEntryTypes";
import {
  calculateTimeLogDurationHours,
  isClosedTimeLog,
  isOpenTimeLog,
  isTimeLogISODate,
  timeLogTimeToMinutes,
} from "./taskStore/taskTypes";
import type {
  ActivityType,
  BackupSnapshot,
  DeadlineMode,
  EffortLevel,
  Priority,
  Status,
  Task,
  TaskStore,
  TimeLog,
  VisionHorizon,
} from "./taskStore/taskTypes";

const TIME_LOGS_STORAGE_KEY = isDemoMode ? "task_tracker_demo_time_logs_v1" : "yasmine_time_logs_v1";
const TASKS_LOCAL_CACHE_KEY = isDemoMode ? "task_tracker_demo_tasks_cache_v1" : "yasmine_tasks_local_cache_v1";
const BACKUP_KEY_PREFIX = isDemoMode ? "task_tracker_demo_backup_" : "yasmine_backup_";
const ACTIVE_TAB_STORAGE_KEY = isDemoMode ? "task_tracker_demo_active_tab" : "yasmine_active_tab";
const SIDEBAR_COLLAPSED_STORAGE_KEY = isDemoMode
  ? "task_tracker_demo_sidebar_collapsed"
  : "yasmine_sidebar_collapsed";
const ATTENTION_CATEGORY_SCOPE_KEY = isDemoMode
  ? "task_tracker_demo_attention_category_scope_v1"
  : "yasmine_attention_category_scope_v1";
const SYNC_CODE = isDemoMode ? "DEMO-TASKS" : "YAS-TEST-001";

type ViewMode = "board" | "planner" | "list" | "logger" | "meds";
type PlannerView = "week" | "month" | "three_month" | "year";
type MedsView = "today" | "history" | "tracker";
type MedicationModalMode = "dose" | "feeling" | "alcohol";
type PlannerEventModalMode = "create" | "edit";
type PlannerWhenChoice =
  | "any_time"
  | "all_day"
  | "morning"
  | "noon"
  | "afternoon"
  | "evening"
  | "night"
  | "at_time"
  | "time_range";
type PlannerActiveIntensity = "low" | "mid" | "high";
type PlannerEventDraft = {
  id: string;
  eventType: CalendarEventType;
  title: string;
  allDay: boolean;
  timeMode: CalendarTimeMode;
  daypart: CalendarDaypart | "";
  activeIntensity: PlannerActiveIntensity | "";
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  taskId: string;
  description: string;
  who: string;
  location: string;
  videoUrl: string;
  origin: string;
  destination: string;
  notes: string;
  timezone: string;
  repeat: "none" | "weekly";
  recurrenceWeekday: number;
  recurrenceStartDate: string;
  recurrenceEndDate: string;
  recurrenceApplyScope: "this" | "future" | "all";
  recurrenceParentId: string | null;
  recurrenceExceptionDate: string | null;
  metadata: Record<string, unknown>;
};
type PlannerWeekInteraction = {
  kind: "move" | "resize";
  eventId: string;
  originalEvent: CalendarEvent;
  previewEvent: CalendarEvent;
  pointerStartX: number;
  pointerStartY: number;
  gridLeft: number;
  dayWidth: number;
  originalStartMinutes: number;
  originalEndMinutes: number;
  originalDurationMinutes: number;
  hasMoved: boolean;
};
type PlannerWorkResolutionStatus = "logged" | "skipped";
type PlannerTemporalState = "past" | "today" | "future";
type PlannerMonthGridData = {
  month: PlannerYearMonth;
  eventsByDate: Record<string, PlannerDateItem[]>;
  weeks: PlannerMonthDay[][];
  allDaySpansByWeek: ReturnType<typeof plannerAllDaySpansForDays>[];
};
type SmartImportRecurrence = "none" | "weekly";
type SmartImportProposal = {
  id: string;
  sourceText: string;
  include: boolean;
  savedEventId?: string;
  title: string;
  eventType: CalendarEventType;
  recurrence: SmartImportRecurrence;
  allDay: boolean;
  date: string;
  endDate: string;
  weekday: number;
  startTime: string;
  endTime: string;
  location: string;
  origin: string;
  destination: string;
  notes: string;
  warnings: string[];
};
type LoggerValueMode = "hours" | "times";
type LoggerRangeMode = "day" | "week" | "month" | "year" | "custom";
type LoggerTimeOfDayBucket = "morning" | "afternoon" | "evening" | "night";
type LoggerBreakdownMode = "tasks" | "categories";
type ListFilterMenu = "category" | "status" | "priority" | "difficulty" | "timeLeft";
type AppNavItem = {
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};
type MedicationCurvePoint = {
  hour: number;
  value: number;
};
type MedsLevelRange = "now" | "24h" | "2d" | "week";
type MedsChartPoint = { x: number; y: number };
type MedsChartDot = { key: string; x: number; y: number; label: string; sublabel?: string };
type FeelingValenceStable = "good" | "neutral" | "bad";
type FeelingCategory = "state" | "symptom";
type FeelingIconKey =
  | "target"
  | "waves"
  | "zap"
  | "trending"
  | "smile"
  | "minus"
  | "moon"
  | "activity"
  | "alert"
  | "flame"
  | "cloud"
  | "heart"
  | "heartPulse"
  | "brain"
  | "sparkles"
  | "sun"
  | "circle"
  | "eye"
  | "frown"
  | "laugh"
  | "gauge"
  | "battery"
  | "wind"
  | "shield"
  | "star"
  | "timer"
  | "messageCircle"
  | "utensils"
  | "utensilsCrossed";
type FeelingDefinition = {
  id: string;
  name: string;
  icon: FeelingIconKey;
  valence: FeelingValenceStable;
  category: FeelingCategory;
  active: boolean;
  custom?: boolean;
};
type FeelingLogSnapshot = {
  id: string;
  name: string;
  icon: FeelingIconKey;
  valence: FeelingValenceStable;
  intensity: number;
};
type SelectedFeelingLog = {
  intensity: number;
};
type CaffeineDrinkId =
  | "espresso"
  | "americano"
  | "iced_americano"
  | "cappuccino"
  | "latte"
  | "iced_latte"
  | "cortado"
  | "flat_white"
  | "homemade_coffee"
  | "matcha_latte"
  | "espresso_martini"
  | "custom";
type AttentionWeights = {
  time: number;
  duration: number;
  difficulty: number;
};

const DEFAULT_ATTENTION_WEIGHTS: AttentionWeights = { time: 50, duration: 15, difficulty: 15 };
const FIXED_PRIORITY_WEIGHT = 20;
const COMPLETED_RECOVERY_DAYS = 30;
const RECENTLY_DELETED_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const VISION_HORIZONS: { id: VisionHorizon; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "mid", label: "Mid" },
  { id: "long", label: "Long" },
];
const ACTIVITY_TYPES: { id: ActivityType; label: string }[] = [
  { id: "correspondence", label: "Correspondence" },
  { id: "activity", label: "Activity" },
  { id: "uni_work", label: "Uni work" },
];
const EFFORT_LEVELS: { id: EffortLevel; label: string }[] = [
  { id: "quick", label: "Quick" },
  { id: "moderate", label: "Moderate" },
  { id: "extensive", label: "Extensive" },
];
const EFFORT_RUNWAY_FACTORS: Record<EffortLevel, number> = {
  quick: 0.7,
  moderate: 1.4,
  extensive: 2.8,
};
const CATEGORY_COLOURS = [
  { id: "slate", label: "Slate", swatch: "bg-slate-300" },
  { id: "sky", label: "Sky", swatch: "bg-sky-300" },
  { id: "violet", label: "Violet", swatch: "bg-violet-300" },
  { id: "emerald", label: "Emerald", swatch: "bg-emerald-300" },
  { id: "amber", label: "Amber", swatch: "bg-amber-300" },
  { id: "rose", label: "Rose", swatch: "bg-rose-300" },
  { id: "navy", label: "Navy", swatch: "bg-[#35557F]" },
  { id: "blue", label: "Blue", swatch: "bg-blue-400" },
  { id: "cyan", label: "Cyan", swatch: "bg-cyan-400" },
  { id: "teal", label: "Teal", swatch: "bg-teal-400" },
  { id: "mint", label: "Mint", swatch: "bg-green-300" },
  { id: "lime", label: "Lime", swatch: "bg-lime-400" },
  { id: "yellow", label: "Yellow", swatch: "bg-yellow-400" },
  { id: "orange", label: "Orange", swatch: "bg-orange-400" },
  { id: "coral", label: "Coral", swatch: "bg-[#F4775C]" },
  { id: "pink", label: "Pink", swatch: "bg-pink-400" },
];
const LOGGER_TIME_OF_DAY_BUCKETS: { id: LoggerTimeOfDayBucket; label: string; timeLabel: string }[] = [
  { id: "morning", label: "Morning", timeLabel: "05:00–12:00" },
  { id: "afternoon", label: "Afternoon", timeLabel: "12:00–17:00" },
  { id: "evening", label: "Evening", timeLabel: "17:00–22:00" },
  { id: "night", label: "Night", timeLabel: "22:00–05:00" },
];
const LOGGER_DAY_TIMELINE_START_MINUTES = 5 * 60;
const LOGGER_DAY_TIMELINE_PX_PER_HOUR = 30;
const LOGGER_DAY_TIMELINE_HEIGHT = 24 * LOGGER_DAY_TIMELINE_PX_PER_HOUR;

const STATUSES: { id: Status; label: string }[] = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const LIST_STATUS_OPTIONS: { id: Status; label: string }[] = [
  { id: "to_do", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "frozen", label: "Frozen" },
  { id: "completed", label: "Completed" },
];

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

const DIFFICULTY_FILTERS = ["1", "2", "3", "4", "5"];
const TIME_LEFT_MIN = 0;
const TIME_LEFT_MAX = 365;
const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 24;
const PLANNER_HOUR_HEIGHT = 56;
const PLANNER_SNAP_MINUTES = 15;
const PLANNER_EVENT_TYPES: { id: CalendarEventType; label: string }[] = [
  { id: "work", label: "Work" },
  { id: "class", label: "Class" },
  { id: "meeting", label: "Meeting" },
  { id: "deadline", label: "Deadline" },
  { id: "personal", label: "Personal" },
  { id: "travel", label: "Travel" },
  { id: "date", label: "Date" },
  { id: "social", label: "Social" },
  { id: "active", label: "Active" },
  { id: "admin", label: "Admin" },
];
const PLANNER_LEGACY_EVENT_TYPES: { id: CalendarEventType; label: string }[] = [
  { id: "milestone", label: "Milestone" },
];
const PLANNER_EVENT_PALETTE: Record<CalendarEventType, { label: string; color: string }> = {
  work: { label: "Denim", color: "#5FA9FF" },
  class: { label: "Eggplant", color: "#C29EFF" },
  meeting: { label: "Pumpkin", color: "#FCB100" },
  deadline: { label: "Lava", color: "#FE7877" },
  personal: { label: "Mint", color: "#88E18E" },
  travel: { label: "Ice", color: "#04E6F7" },
  date: { label: "Peach", color: "#FC889F" },
  social: { label: "Sky", color: "#55CDFF" },
  active: { label: "Veggie", color: "#2DCC70" },
  admin: { label: "Metal", color: "#8293B9" },
  milestone: { label: "Tangerine", color: "#FD925E" },
};
const PLANNER_DAYPART_OPTIONS: { id: CalendarDaypart; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "noon", label: "Noon" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];
const PLANNER_WHEN_OPTIONS: { id: PlannerWhenChoice; label: string }[] = [
  { id: "any_time", label: "Any time" },
  { id: "all_day", label: "All day" },
  ...PLANNER_DAYPART_OPTIONS,
  { id: "at_time", label: "At time" },
  { id: "time_range", label: "Time range" },
];
const PLANNER_ACTIVE_INTENSITY_OPTIONS: { id: PlannerActiveIntensity; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "mid", label: "Mid" },
  { id: "high", label: "High" },
];
const PLANNER_WEEKDAY_OPTIONS = [
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
  { id: 7, label: "Sunday" },
];
const APP_NAV_ITEMS: AppNavItem[] = [
  { id: "board", label: "Dashboard", icon: LayoutDashboard },
  { id: "planner", label: "Planner", icon: CalendarDays },
  { id: "list", label: "Tasks", icon: ListChecks },
  { id: "logger", label: "Logger", icon: Clock3 },
  { id: "meds", label: "Meds", icon: PillIcon },
];
const MEDICATION_OPTIONS: { id: MedicationKind; label: string; unit: string }[] = [
  { id: "Vyvanse", label: "Vyvanse", unit: "mg" },
  { id: "Prozac", label: "Prozac", unit: "mg" },
  { id: "Coffee", label: "Coffee", unit: "cup" },
  { id: "Custom", label: "+ Custom", unit: "" },
];
const MEDS_RANGE_CONFIG: Record<MedsLevelRange, { label: string; durationHours: number; futureHours: number }> = {
  now: { label: "Now", durationHours: 12, futureHours: 0 },
  "24h": { label: "24h", durationHours: 24, futureHours: 0 },
  "2d": { label: "2 Days", durationHours: 48, futureHours: 0 },
  week: { label: "Week", durationHours: 24 * 7, futureHours: 0 },
};
const MEDS_CURRENT_WINDOW_FUTURE_HOURS = 6;
const VYVANSE_VISUAL_MODEL = {
  absorptionRatePerHour: 0.664,
  halfLifeHours: 10.5,
  visibleHours: 36,
  referenceDoseMg: 30,
  defaultChartMaxPercent: 125,
};
const CAFFEINE_VISUAL_MODEL = {
  absorptionRatePerHour: 4,
  halfLifeHours: 5,
  visibleHours: 30,
  referenceMg: 100,
  defaultChartMaxPercent: 200,
};
const CAFFEINE_DRINK_DEFAULTS: {
  id: CaffeineDrinkId;
  label: string;
  mg: number;
  shots?: number;
}[] = [
  { id: "espresso", label: "Espresso", mg: 65, shots: 1 },
  { id: "americano", label: "Americano", mg: 130, shots: 2 },
  { id: "iced_americano", label: "Iced Americano", mg: 130, shots: 2 },
  { id: "cappuccino", label: "Cappuccino", mg: 120, shots: 2 },
  { id: "latte", label: "Latte", mg: 120, shots: 2 },
  { id: "iced_latte", label: "Iced latte", mg: 120, shots: 2 },
  { id: "cortado", label: "Cortado", mg: 60, shots: 1 },
  { id: "flat_white", label: "Flat white", mg: 130, shots: 2 },
  { id: "homemade_coffee", label: "Homemade coffee", mg: 95 },
  { id: "matcha_latte", label: "Matcha latte", mg: 70 },
  { id: "espresso_martini", label: "Espresso martini", mg: 65, shots: 1 },
  { id: "custom", label: "Custom", mg: 100 },
];
const ALCOHOL_DRINK_TYPES = [
  { id: "Wine", Icon: Wine },
  { id: "Beer", Icon: Beer },
  { id: "Cider", Icon: Beer },
  { id: "Vodka", Icon: Martini },
  { id: "Gin", Icon: Martini },
  { id: "Rum", Icon: Martini },
  { id: "Tequila", Icon: Martini },
  { id: "Whisky", Icon: Martini },
  { id: "Cocktail", Icon: Martini },
  { id: "Other", Icon: Wine },
] as const;
type AlcoholDrinkType = (typeof ALCOHOL_DRINK_TYPES)[number]["id"];
const ALCOHOL_DRINK_DEFAULTS: Record<AlcoholDrinkType, { servingSizeMl: string; abvPercent: string }> = {
  Wine: { servingSizeMl: "150", abvPercent: "12" },
  Beer: { servingSizeMl: "330", abvPercent: "5" },
  Cider: { servingSizeMl: "330", abvPercent: "5" },
  Vodka: { servingSizeMl: "25", abvPercent: "40" },
  Gin: { servingSizeMl: "25", abvPercent: "40" },
  Rum: { servingSizeMl: "25", abvPercent: "40" },
  Tequila: { servingSizeMl: "25", abvPercent: "40" },
  Whisky: { servingSizeMl: "25", abvPercent: "40" },
  Cocktail: { servingSizeMl: "150", abvPercent: "15" },
  Other: { servingSizeMl: "", abvPercent: "" },
};
const DEFAULT_FEELING_DEFINITIONS: FeelingDefinition[] = [
  { id: "focused", name: "Focused", icon: "target", valence: "good", category: "state", active: true },
  { id: "distracted", name: "Distracted", icon: "eye", valence: "bad", category: "state", active: true },
  { id: "brain_fog", name: "Brain fog", icon: "cloud", valence: "neutral", category: "state", active: true },
  { id: "motivated", name: "Motivated", icon: "trending", valence: "good", category: "state", active: true },
  { id: "energetic", name: "Energetic", icon: "zap", valence: "good", category: "state", active: true },
  { id: "tired", name: "Tired", icon: "battery", valence: "neutral", category: "state", active: true },
  { id: "calm", name: "Calm", icon: "wind", valence: "good", category: "state", active: true },
  { id: "anxious", name: "Anxious", icon: "activity", valence: "bad", category: "state", active: true },
  { id: "stressed", name: "Stressed", icon: "gauge", valence: "bad", category: "state", active: true },
  { id: "happy", name: "Happy", icon: "smile", valence: "good", category: "state", active: true },
  { id: "low", name: "Low", icon: "frown", valence: "bad", category: "state", active: true },
  { id: "irritable", name: "Irritable", icon: "flame", valence: "bad", category: "state", active: true },
  { id: "wired", name: "Wired", icon: "sparkles", valence: "neutral", category: "state", active: true },
  { id: "socially_weird", name: "Socially weird", icon: "messageCircle", valence: "neutral", category: "state", active: true },
  { id: "neutral", name: "Neutral", icon: "minus", valence: "neutral", category: "state", active: true },
  { id: "low_appetite", name: "Low appetite", icon: "utensils", valence: "bad", category: "symptom", active: true },
  { id: "no_appetite", name: "No appetite", icon: "utensilsCrossed", valence: "bad", category: "symptom", active: true },
  { id: "sleepy", name: "Sleepy", icon: "moon", valence: "neutral", category: "symptom", active: true },
  { id: "jittery", name: "Jittery", icon: "waves", valence: "bad", category: "symptom", active: true },
  { id: "headache", name: "Headache", icon: "brain", valence: "bad", category: "symptom", active: true },
  { id: "palpitations", name: "Palpitations", icon: "heartPulse", valence: "bad", category: "symptom", active: true },
  { id: "insomnia", name: "Insomnia", icon: "timer", valence: "bad", category: "symptom", active: true },
];
const LEGACY_DEFAULT_FEELING_IDS = new Set(["overstimulated"]);
const FEELING_ICON_OPTIONS: { id: FeelingIconKey; label: string }[] = [
  { id: "target", label: "Target" },
  { id: "waves", label: "Waves" },
  { id: "zap", label: "Bolt" },
  { id: "trending", label: "Up" },
  { id: "smile", label: "Smile" },
  { id: "minus", label: "Neutral" },
  { id: "moon", label: "Moon" },
  { id: "activity", label: "Active" },
  { id: "alert", label: "Alert" },
  { id: "flame", label: "Flame" },
  { id: "cloud", label: "Cloud" },
  { id: "heart", label: "Heart" },
  { id: "heartPulse", label: "Heart pulse" },
  { id: "brain", label: "Brain" },
  { id: "sparkles", label: "Sparkles" },
  { id: "sun", label: "Sun" },
  { id: "circle", label: "Circle" },
  { id: "eye", label: "Eye" },
  { id: "frown", label: "Frown" },
  { id: "laugh", label: "Laugh" },
  { id: "gauge", label: "Gauge" },
  { id: "battery", label: "Battery" },
  { id: "wind", label: "Wind" },
  { id: "shield", label: "Shield" },
  { id: "star", label: "Star" },
  { id: "timer", label: "Timer" },
  { id: "messageCircle", label: "Conversation" },
  { id: "utensils", label: "Appetite" },
  { id: "utensilsCrossed", label: "No appetite" },
];
const FEELING_VALENCE_OPTIONS: { id: FeelingValenceStable; label: string }[] = [
  { id: "good", label: "Good" },
  { id: "neutral", label: "Neutral" },
  { id: "bad", label: "Bad" },
];
const FEELING_DEFINITIONS_SOURCE = "meds_feeling_definitions";
const FEELING_DEFINITIONS_MARKER = "__feeling_definitions__";

function statusLabel(id: Status) {
  return STATUSES.find((s) => s.id === id)?.label ?? id;
}

function priorityLabel(id: Priority) {
  return PRIORITIES.find((p) => p.id === id)?.label ?? id;
}

function statusPill(status?: string) {
  switch (status) {
    case "in_progress":
      return "border border-orange-100 bg-orange-50 text-orange-700";
    case "to_do":
      return "border border-slate-200 bg-slate-100 text-slate-700";
    case "frozen":
      return "border border-sky-100 bg-sky-50 text-sky-700";
    case "completed":
      return "border border-green-100 bg-green-50 text-green-700";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-600";
  }
}



function priorityRank(p: Priority | undefined) {
  if (p === "high") return 0;
  if (p === "normal") return 1;
  return 2;
}

function isCompleted(t: Task) {
  return t.status === "completed";
}

function applyTaskStatus(task: Task, status: Status, completedAt = new Date().toISOString()): Task {
  if (status === "completed") {
    return {
      ...task,
      status,
      completedAt: task.status === "completed" && task.completedAt ? task.completedAt : completedAt,
    };
  }

  return {
    ...task,
    status,
    completedAt: null,
  };
}

function isRecoverableCompleted(task: Task, nowMs: number) {
  if (task.status !== "completed") return false;
  if (!task.completedAt) return true;

  const completedMs = new Date(task.completedAt).getTime();
  if (!Number.isFinite(completedMs)) return true;

  return nowMs - completedMs < COMPLETED_RECOVERY_DAYS * DAY_MS;
}

function frozenTaskClass(task: Task) {
  return task.status === "frozen" ? "opacity-60" : "";
}

function frozenTitleClass(task: Task) {
  return task.status === "frozen" ? "italic text-slate-400" : "";
}

function openCount(list: Task[]) {
  return list.filter((t) => !isCompleted(t)).length;
}

function daysLeftFromISO(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);

  const due = new Date(Date.UTC(yyyy, mm - 1, dd));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diffMs = due.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function timeLeftLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1d left";
  return `${days}d left`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function optionalFiniteNumber(raw: string) {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function normalizeAttentionWeights(raw: unknown): AttentionWeights {
  if (!raw || typeof raw !== "object") return DEFAULT_ATTENTION_WEIGHTS;
  const candidate = raw as Partial<Record<keyof AttentionWeights, unknown>>;
  return {
    time: Number.isFinite(Number(candidate.time)) ? Number(candidate.time) : DEFAULT_ATTENTION_WEIGHTS.time,
    duration: Number.isFinite(Number(candidate.duration)) ? Number(candidate.duration) : DEFAULT_ATTENTION_WEIGHTS.duration,
    difficulty: Number.isFinite(Number(candidate.difficulty)) ? Number(candidate.difficulty) : DEFAULT_ATTENTION_WEIGHTS.difficulty,
  };
}

function toggleFilterValue<T extends string>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function taskMatchesTimeLeftFilter(task: Task, range: { min: number; max: number } | null) {
  if (!range) return true;
  if (!task.due) return false;

  const days = daysLeftFromISO(task.due);
  if (days === null) return false;

  const filterDays = Math.max(0, days);
  return filterDays >= range.min && filterDays <= range.max;
}

function formatHourInput(hours: number) {
  if (!Number.isFinite(hours)) return "";
  return String(hours);
}

function createTimeLogId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (
      Number(char) ^
      (Math.random() * 16) >> (Number(char) / 4)
    ).toString(16)
  );
}

function parseTimeLogHours(raw: string) {
  const hours = parseFloat(raw);
  return Number.isFinite(hours) && hours > 0 ? hours : null;
}

function resolveTimeLogHours(raw: string, calculatedHours: number | null) {
  return calculatedHours !== null ? calculatedHours : parseTimeLogHours(raw);
}

function resolveClosedTimeLogHours(raw: string, calculatedHours: number | null, startTime: string, endTime: string) {
  if (startTime && endTime) return calculatedHours;
  return resolveTimeLogHours(raw, calculatedHours);
}

function todayISO() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  return d.toISOString().slice(0, 10);
}

function isValidISODate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function addDaysISO(iso: string, offset: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + offset));
  return d.toISOString().slice(0, 10);
}

function isoParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

function addMonthsISO(iso: string, offset: number) {
  const { year, month, day } = isoParts(iso);
  const endOfTargetMonth = new Date(Date.UTC(year, month - 1 + offset + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(year, month - 1 + offset, Math.min(day, endOfTargetMonth)));
  return d.toISOString().slice(0, 10);
}

function addYearsISO(iso: string, offset: number) {
  const { year, month, day } = isoParts(iso);
  const endOfTargetMonth = new Date(Date.UTC(year + offset, month, 0)).getUTCDate();
  const d = new Date(Date.UTC(year + offset, month - 1, Math.min(day, endOfTargetMonth)));
  return d.toISOString().slice(0, 10);
}

function startOfLoggerWeek(iso: string) {
  const date = new Date(iso + "T00:00:00");
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDaysISO(iso, -mondayOffset);
}

function plannerHourLabels() {
  return Array.from({ length: PLANNER_END_HOUR - PLANNER_START_HOUR + 1 }, (_, index) => {
    const hour = PLANNER_START_HOUR + index;
    return `${String(hour).padStart(2, "0")}:00`;
  });
}

function localDateISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function localMinutesFromTimestamp(timestamp?: string | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToTimeInput(minutes: number) {
  const clamped = clamp(Math.round(minutes), 0, 24 * 60);
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isoFromLocalDateMinutes(date: string, minutes: number) {
  if (!isValidISODate(date)) return null;
  const { year, month, day } = isoParts(date);
  const parsed = new Date(year, month - 1, day, 0, minutes, 0, 0);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function zonedOffsetMs(utcMs: number, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const localAsUTC = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return localAsUTC - utcMs;
  } catch {
    return new Date().getTimezoneOffset() * -60000;
  }
}

function zonedDateTimeToUtcISO(date: string, time: string, timezone: string) {
  if (!isValidISODate(date) || timeToMinutes(time) === null) return null;
  const { year, month, day } = isoParts(date);
  const [hours, minutes] = time.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - zonedOffsetMs(utcMs, timezone);
  utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0) - zonedOffsetMs(utcMs, timezone);
  const parsed = new Date(utcMs);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function snapPlannerMinutes(minutes: number) {
  return Math.round(minutes / PLANNER_SNAP_MINUTES) * PLANNER_SNAP_MINUTES;
}

function timeInputFromTimestamp(timestamp?: string | null) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "";

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localTimeInput(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid";
}

type WeeklyRecurrenceRule = {
  freq: "weekly";
  weekday: number;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
};

function parseWeeklyRecurrenceRule(raw?: string | null): WeeklyRecurrenceRule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WeeklyRecurrenceRule>;
    if (
      parsed.freq !== "weekly" ||
      typeof parsed.weekday !== "number" ||
      !isValidISODate(parsed.startDate ?? "") ||
      !isValidISODate(parsed.endDate ?? "") ||
      typeof parsed.startTime !== "string" ||
      typeof parsed.endTime !== "string" ||
      timeToMinutes(parsed.startTime) === null ||
      timeToMinutes(parsed.endTime) === null ||
      typeof parsed.timezone !== "string"
    ) {
      return null;
    }
    return parsed as WeeklyRecurrenceRule;
  } catch {
    return null;
  }
}

function stringifyWeeklyRecurrenceRule(rule: WeeklyRecurrenceRule) {
  return JSON.stringify(rule);
}

function isoWeekday(iso: string) {
  const date = new Date(iso + "T00:00:00");
  return ((date.getDay() + 6) % 7) + 1;
}

function nextDateForIsoWeekday(startDate: string, weekday: number) {
  const current = isoWeekday(startDate);
  const offset = (weekday - current + 7) % 7;
  return addDaysISO(startDate, offset);
}

function plannerEventTypeLabel(eventType: CalendarEventType) {
  return (
    [...PLANNER_EVENT_TYPES, ...PLANNER_LEGACY_EVENT_TYPES].find((option) => option.id === eventType)
      ?.label ?? "Event"
  );
}

function plannerEventTypeOptionsForDraft(draft: PlannerEventDraft) {
  return draft.eventType === "milestone"
    ? [...PLANNER_LEGACY_EVENT_TYPES, ...PLANNER_EVENT_TYPES]
    : PLANNER_EVENT_TYPES;
}

function isPlannerActiveIntensity(value: unknown): value is PlannerActiveIntensity {
  return value === "low" || value === "mid" || value === "high";
}

function defaultPlannerEventDraft(eventType: CalendarEventType, date: string): PlannerEventDraft {
  const resolvedDate = isValidISODate(date) ? date : todayISO();
  const allDay = eventType === "milestone";
  const startsTimed = eventType === "work" || eventType === "class" || eventType === "meeting";
  const startsSingleTime = eventType === "date" || eventType === "social" || eventType === "admin";
  const daypart = "";
  const timeMode: CalendarTimeMode = allDay
    ? "all_day"
    : startsTimed
      ? "time_range"
      : startsSingleTime
        ? "single_time"
        : daypart
          ? "daypart"
          : "date_only";
  const timezone = browserTimezone();

  return {
    id: createCalendarEventId(),
    eventType,
    title: "",
    allDay,
    timeMode,
    daypart,
    activeIntensity: "",
    date: resolvedDate,
    endDate: resolvedDate,
    startTime: startsTimed || startsSingleTime ? "09:00" : "",
    endTime: startsTimed ? "10:00" : "",
    taskId: "",
    description: "",
    who: "",
    location: "",
    videoUrl: "",
    origin: "",
    destination: "",
    notes: "",
    timezone,
    repeat: "none",
    recurrenceWeekday: isoWeekday(resolvedDate),
    recurrenceStartDate: resolvedDate,
    recurrenceEndDate: resolvedDate,
    recurrenceApplyScope: "this",
    recurrenceParentId: null,
    recurrenceExceptionDate: null,
    metadata: {},
  };
}

function plannerDraftFromEvent(event: CalendarEvent): PlannerEventDraft {
  const metadata = event.metadata ?? {};
  const recurrenceRule = parseWeeklyRecurrenceRule(event.recurrenceRule);
  const parentId = parentIdForPlannerOccurrence(event);
  const occurrenceDate = occurrenceDateForPlannerEvent(event);
  const isVirtualOccurrence = isVirtualRecurringOccurrence(event);
  const timeMode = getCalendarEventTimeMode(event);
  const daypart = getCalendarEventDaypart(event) ?? "";
  const activeIntensity = isPlannerActiveIntensity(metadata.intensity) ? metadata.intensity : "";
  const usesExactTime = timeMode === "single_time" || timeMode === "time_range";
  const startDate = event.allDay
    ? event.startDate ?? todayISO()
    : eventLocalDate(event.startAt) ?? todayISO();
  const endDate = event.allDay
    ? event.endDate ?? startDate
    : eventLocalDate(event.endAt) ?? startDate;

  return {
    id: isVirtualOccurrence ? createCalendarEventId() : event.id,
    eventType: event.eventType,
    title: event.title,
    allDay: timeMode === "all_day" || timeMode === "multi_day",
    timeMode,
    daypart,
    activeIntensity,
    date: startDate,
    endDate,
    startTime: usesExactTime ? timeInputFromTimestamp(event.startAt) : "",
    endTime: timeMode === "time_range" ? timeInputFromTimestamp(event.endAt) : "",
    taskId: event.taskId ?? "",
    description: event.description ?? "",
    who: typeof metadata.who === "string" ? metadata.who : "",
    location: event.location ?? "",
    videoUrl: event.videoUrl ?? "",
    origin: typeof metadata.origin === "string" ? metadata.origin : "",
    destination: typeof metadata.destination === "string" ? metadata.destination : "",
    notes: event.notes ?? "",
    timezone: event.timezone || browserTimezone(),
    repeat: recurrenceRule ? "weekly" : "none",
    recurrenceWeekday: recurrenceRule?.weekday ?? isoWeekday(startDate),
    recurrenceStartDate: recurrenceRule?.startDate ?? startDate,
    recurrenceEndDate: recurrenceRule?.endDate ?? endDate,
    recurrenceApplyScope: parentId ? "this" : "all",
    recurrenceParentId: parentId ?? null,
    recurrenceExceptionDate: occurrenceDate ?? null,
    metadata: { ...metadata },
  };
}

function plannerDraftTimeMode(draft: PlannerEventDraft): CalendarTimeMode {
  const endDate = isValidISODate(draft.endDate) ? draft.endDate : draft.date;
  const hasStart = Boolean(draft.startTime);
  const hasEnd = Boolean(draft.endTime);

  if (draft.daypart) return "daypart";
  if (draft.allDay || draft.eventType === "milestone") {
    return endDate > draft.date ? "multi_day" : "all_day";
  }
  if (!hasStart && !hasEnd) return endDate > draft.date ? "multi_day" : "date_only";
  if (hasStart && hasEnd) return "time_range";
  return "single_time";
}

function plannerWhenChoiceFromDraft(draft: PlannerEventDraft): PlannerWhenChoice {
  if (draft.daypart) return draft.daypart;
  if (draft.allDay || draft.eventType === "milestone") return "all_day";
  if (draft.startTime && draft.endTime) return "time_range";
  if (draft.startTime) return "at_time";
  return "any_time";
}

function plannerDraftWithWhenChoice(draft: PlannerEventDraft, choice: PlannerWhenChoice): PlannerEventDraft {
  if (choice === "any_time") {
    return { ...draft, allDay: false, daypart: "", startTime: "", endTime: "" };
  }
  if (choice === "all_day") {
    return { ...draft, allDay: true, daypart: "", startTime: "", endTime: "" };
  }
  if (isCalendarDaypart(choice)) {
    return { ...draft, allDay: false, daypart: choice, startTime: "", endTime: "" };
  }
  if (choice === "at_time") {
    return {
      ...draft,
      allDay: false,
      daypart: "",
      startTime: draft.startTime || "09:00",
      endTime: "",
    };
  }
  return {
    ...draft,
    allDay: false,
    daypart: "",
    startTime: draft.startTime || "09:00",
    endTime: draft.endTime || "10:00",
  };
}

function plannerDraftWithEventType(draft: PlannerEventDraft, eventType: CalendarEventType): PlannerEventDraft {
  const startsTimed = eventType === "work" || eventType === "class" || eventType === "meeting";
  const startsSingleTime = eventType === "date" || eventType === "social" || eventType === "admin";
  const forceAllDay = eventType === "milestone";
  return {
    ...draft,
    eventType,
    allDay: forceAllDay ? true : draft.allDay,
    daypart: forceAllDay ? "" : draft.daypart,
    startTime:
      forceAllDay || draft.daypart ? "" : draft.startTime || (startsTimed || startsSingleTime ? "09:00" : ""),
    endTime: forceAllDay || draft.daypart ? "" : draft.endTime || (startsTimed ? "10:00" : ""),
    repeat: eventType === "class" ? draft.repeat : "none",
    taskId: eventType === "work" || eventType === "deadline" ? draft.taskId : "",
    activeIntensity: eventType === "active" ? draft.activeIntensity : "",
  };
}

function plannerDraftHasMoreDetails(draft: PlannerEventDraft) {
  return Boolean(
    draft.description.trim() ||
      draft.location.trim() ||
      draft.videoUrl.trim() ||
      draft.notes.trim() ||
      draft.repeat === "weekly"
  );
}

function plannerEventRendersAsAllDaySpan(event: CalendarEvent) {
  return event.allDay && getCalendarEventTimeMode(event) !== "daypart";
}

function plannerMetadataFromDraft(
  draft: PlannerEventDraft,
  timeMode: CalendarTimeMode
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    ...(draft.metadata ?? {}),
    timeMode,
  };
  delete metadata.virtualOccurrence;
  delete metadata.parentEventId;
  delete metadata.occurrenceDate;
  const who = draft.who.trim();
  const origin = draft.origin.trim();
  const destination = draft.destination.trim();

  if (who) metadata.who = who;
  else delete metadata.who;

  if (origin) metadata.origin = origin;
  else delete metadata.origin;

  if (destination) metadata.destination = destination;
  else delete metadata.destination;

  if (timeMode === "daypart" && draft.daypart) {
    metadata.daypart = draft.daypart;
  } else {
    delete metadata.daypart;
  }

  if (draft.eventType === "active" && draft.activeIntensity) {
    metadata.intensity = draft.activeIntensity;
  } else {
    delete metadata.intensity;
  }

  return metadata;
}

function calendarEventFromDraft(draft: PlannerEventDraft): { event: CalendarEvent | null; error: string | null } {
  const title = draft.title.trim();
  if (!title) return { event: null, error: "Title is required." };
  if (!isValidISODate(draft.date)) return { event: null, error: "A valid date is required." };

  const timeMode = plannerDraftTimeMode(draft);
  const endDate = isValidISODate(draft.endDate) ? draft.endDate : draft.date;
  const timezone = draft.timezone || browserTimezone();
  const metadata = plannerMetadataFromDraft(draft, timeMode);
  const baseEvent = {
    id: draft.id,
    eventType: draft.eventType,
    title,
    description: draft.description.trim() || null,
    timezone,
    taskId: draft.taskId || null,
    categoryId: null,
    location: draft.location.trim() || null,
    videoUrl: draft.videoUrl.trim() || null,
    notes: draft.notes.trim() || null,
    metadata,
    recurrenceParentId: draft.recurrenceParentId,
    recurrenceExceptionDate: draft.recurrenceExceptionDate,
    recurrenceStatus: draft.recurrenceParentId ? "moved" : null,
  };

  if (draft.eventType === "class" && draft.repeat === "weekly" && timeMode !== "time_range") {
    return { event: null, error: "Recurring classes need a start and end time for now." };
  }

  if (timeMode === "all_day" || timeMode === "multi_day" || timeMode === "date_only" || timeMode === "daypart") {
    if (endDate < draft.date) return { event: null, error: "End date cannot be before start date." };
    if (timeMode === "daypart" && !draft.daypart) return { event: null, error: "Choose a valid daypart." };

    return {
      error: null,
      event: {
        ...baseEvent,
        allDay: true,
        startAt: null,
        endAt: null,
        startDate: draft.date,
        endDate: timeMode === "multi_day" ? endDate : null,
        recurrenceRule: null,
      },
    };
  }

  if (!draft.startTime) return { event: null, error: "Start time is required." };
  if (draft.endTime && !draft.startTime) return { event: null, error: "Start time is required when an end time is set." };

  const startAt = zonedDateTimeToUtcISO(draft.date, draft.startTime, timezone);
  const endAt = timeMode === "time_range" ? zonedDateTimeToUtcISO(endDate, draft.endTime, timezone) : null;
  if (!startAt) return { event: null, error: "Start time is invalid." };
  if (timeMode === "time_range" && !endAt) return { event: null, error: "End time is invalid." };
  if (endAt && Date.parse(endAt) <= Date.parse(startAt)) {
    return { event: null, error: "End time must be after start time." };
  }
  const weeklyRule =
    draft.eventType === "class" && draft.repeat === "weekly" && !draft.recurrenceParentId
      ? {
          freq: "weekly" as const,
          weekday: draft.recurrenceWeekday,
          startDate: draft.recurrenceStartDate,
          endDate: draft.recurrenceEndDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
          timezone,
        }
      : null;

  if (weeklyRule) {
    if (
      weeklyRule.weekday < 1 ||
      weeklyRule.weekday > 7 ||
      !isValidISODate(weeklyRule.startDate) ||
      !isValidISODate(weeklyRule.endDate) ||
      weeklyRule.endDate < weeklyRule.startDate
    ) {
      return { event: null, error: "A valid weekly date range is required." };
    }
  }

  return {
    error: null,
    event: {
      ...baseEvent,
      allDay: false,
      startAt,
      endAt,
      startDate: null,
      endDate: null,
      recurrenceRule: weeklyRule ? stringifyWeeklyRecurrenceRule(weeklyRule) : null,
    },
  };
}

function plannerTimedEventSegment(event: CalendarEvent, day: string) {
  const timeMode = getCalendarEventTimeMode(event);
  const daypart = getCalendarEventDaypart(event);
  if (timeMode === "daypart" && daypart) {
    const eventDate = event.startDate ?? eventLocalDate(event.startAt);
    if (eventDate !== day) return null;
    const startMinutes = plannerDaypartAnchorMinutes(daypart);
    const endMinutes = Math.min(PLANNER_END_HOUR * 60, startMinutes + 30);

    return {
      event,
      startMinutes,
      endMinutes,
      top: ((startMinutes - PLANNER_START_HOUR * 60) / 60) * PLANNER_HOUR_HEIGHT,
      height: Math.max(26, ((endMinutes - startMinutes) / 60) * PLANNER_HOUR_HEIGHT),
      displayOnly: true,
    };
  }

  if (!event.startAt) return null;

  const start = new Date(event.startAt);
  if (!Number.isFinite(start.getTime())) return null;

  const fallbackMinutes = getCalendarEventTimeMode(event) === "single_time" ? 15 : 60;
  const fallbackEnd = new Date(start.getTime() + fallbackMinutes * 60 * 1000);
  const parsedEnd = event.endAt ? new Date(event.endAt) : fallbackEnd;
  const end = Number.isFinite(parsedEnd.getTime()) && parsedEnd > start ? parsedEnd : fallbackEnd;
  const dayStart = new Date(day + "T00:00:00");
  const visibleStart = new Date(dayStart.getTime() + PLANNER_START_HOUR * 60 * 60 * 1000);
  const visibleEnd = new Date(dayStart.getTime() + PLANNER_END_HOUR * 60 * 60 * 1000);
  const segmentStart = new Date(Math.max(start.getTime(), visibleStart.getTime()));
  const segmentEnd = new Date(Math.min(end.getTime(), visibleEnd.getTime()));

  if (segmentEnd <= segmentStart) return null;

  const startMinutes = (segmentStart.getTime() - dayStart.getTime()) / 60000;
  const endMinutes = (segmentEnd.getTime() - dayStart.getTime()) / 60000;

  return {
    event,
    startMinutes,
    endMinutes,
    top: ((startMinutes - PLANNER_START_HOUR * 60) / 60) * PLANNER_HOUR_HEIGHT,
    height: Math.max(26, ((endMinutes - startMinutes) / 60) * PLANNER_HOUR_HEIGHT),
    displayOnly: false,
  };
}

function layoutPlannerTimedEvents(events: CalendarEvent[], day: string) {
  const segments = events
    .map((event) => plannerTimedEventSegment(event, day))
    .filter((segment): segment is NonNullable<ReturnType<typeof plannerTimedEventSegment>> =>
      Boolean(segment)
    )
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const columnEnds: number[] = [];
  const positioned = segments.map((segment) => {
    const columnIndex = columnEnds.findIndex((end) => end <= segment.startMinutes);
    const resolvedColumnIndex = columnIndex === -1 ? columnEnds.length : columnIndex;
    columnEnds[resolvedColumnIndex] = segment.endMinutes;
    return { ...segment, columnIndex: resolvedColumnIndex };
  });
  const columnCount = Math.max(1, columnEnds.length);

  return positioned.map((segment) => ({ ...segment, columnCount }));
}

function buildPlannerMonthGridData(
  month: PlannerYearMonth,
  calendarEventsForRender: CalendarEvent[],
  taskDeadlinesByDate: Record<string, Task[]>
): PlannerMonthGridData {
  const eventsByDate = month.days.reduce<Record<string, PlannerDateItem[]>>((groups, day) => {
    groups[day.date] = plannerItemsForDate(
      day.date,
      calendarEventsForRender,
      taskDeadlinesByDate
    );
    return groups;
  }, {});
  const weeks = plannerMonthWeeksForDays(month.days);
  const allDaySpansByWeek = weeks.map((week) => {
    const days = week.map((day) => day.date);
    const weekStart = days[0];
    const weekEnd = days[days.length - 1];
    const items: PlannerDateItem[] = calendarEventsForRender
      .filter((event) => {
        if (!plannerEventRendersAsAllDaySpan(event) || !event.startDate || !weekStart || !weekEnd) return false;
        const endDate = event.endDate || event.startDate;
        return event.startDate <= weekEnd && endDate >= weekStart;
      })
      .map((event) => ({ sourceType: "calendar_event" as const, event }));

    return plannerAllDaySpansForDays(days, items);
  });

  return {
    month,
    eventsByDate,
    weeks,
    allDaySpansByWeek,
  };
}

function recurringOccurrenceMetadata(parent: CalendarEvent, occurrenceDate: string) {
  return {
    ...(parent.metadata ?? {}),
    virtualOccurrence: true,
    parentEventId: parent.id,
    occurrenceDate,
  };
}

function isVirtualRecurringOccurrence(event: CalendarEvent) {
  return event.metadata?.virtualOccurrence === true && typeof event.metadata.parentEventId === "string";
}

function parentIdForPlannerOccurrence(event: CalendarEvent) {
  return typeof event.metadata?.parentEventId === "string" ? event.metadata.parentEventId : event.recurrenceParentId;
}

function occurrenceDateForPlannerEvent(event: CalendarEvent) {
  return typeof event.metadata?.occurrenceDate === "string"
    ? event.metadata.occurrenceDate
    : event.recurrenceExceptionDate;
}

function exceptionEventForPlannerOccurrence(event: CalendarEvent) {
  const parentId = parentIdForPlannerOccurrence(event);
  const occurrenceDate = occurrenceDateForPlannerEvent(event);
  if (!parentId || !occurrenceDate) return event;

  const metadata = { ...(event.metadata ?? {}) };
  delete metadata.virtualOccurrence;
  delete metadata.parentEventId;
  delete metadata.occurrenceDate;

  return {
    ...event,
    id: isVirtualRecurringOccurrence(event) ? createCalendarEventId() : event.id,
    recurrenceRule: null,
    recurrenceParentId: parentId,
    recurrenceExceptionDate: occurrenceDate,
    recurrenceStatus: "moved",
    metadata,
  };
}

function expandRecurringPlannerEvents(events: CalendarEvent[], rangeStart: string, rangeEnd: string) {
  const exceptionsByParentAndDate = new Map<string, CalendarEvent[]>();

  events.forEach((event) => {
    if (!event.recurrenceParentId || !event.recurrenceExceptionDate) return;
    const key = `${event.recurrenceParentId}:${event.recurrenceExceptionDate}`;
    exceptionsByParentAndDate.set(key, [...(exceptionsByParentAndDate.get(key) ?? []), event]);
  });

  const expanded: CalendarEvent[] = [];

  events.forEach((event) => {
    if (event.recurrenceParentId) {
      if (event.recurrenceStatus !== "cancelled") expanded.push(event);
      return;
    }

    const rule = parseWeeklyRecurrenceRule(event.recurrenceRule);
    if (!rule) {
      expanded.push(event);
      return;
    }

    const start = rule.startDate > rangeStart ? rule.startDate : rangeStart;
    const end = rule.endDate < rangeEnd ? rule.endDate : rangeEnd;
    if (start > end) return;

    let occurrenceDate = nextDateForIsoWeekday(start, rule.weekday);
    while (occurrenceDate <= end) {
      const exceptionKey = `${event.id}:${occurrenceDate}`;
      const exceptions = exceptionsByParentAndDate.get(exceptionKey) ?? [];
      const hasCancellation = exceptions.some((exception) => exception.recurrenceStatus === "cancelled");

      if (!hasCancellation && !exceptions.some((exception) => exception.recurrenceStatus === "moved")) {
        const startAt = zonedDateTimeToUtcISO(occurrenceDate, rule.startTime, rule.timezone);
        const endAt = zonedDateTimeToUtcISO(occurrenceDate, rule.endTime, rule.timezone);
        if (startAt && endAt) {
          expanded.push({
            ...event,
            id: `${event.id}::${occurrenceDate}`,
            startAt,
            endAt,
            startDate: null,
            endDate: null,
            recurrenceParentId: event.id,
            recurrenceExceptionDate: occurrenceDate,
            recurrenceStatus: "active",
            metadata: recurringOccurrenceMetadata(event, occurrenceDate),
          });
        }
      }

      occurrenceDate = addDaysISO(occurrenceDate, 7);
    }
  });

  return expanded;
}

const IMPORT_MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const IMPORT_WEEKDAYS: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
};

function smartImportContextYear(anchorDate: string) {
  return isoParts(isValidISODate(anchorDate) ? anchorDate : todayISO()).year;
}

function smartImportDate(year: number, monthName: string, dayText: string) {
  const month = IMPORT_MONTHS[monthName.toLowerCase()];
  const day = Number(dayText.replace(/(?:st|nd|rd|th)$/i, ""));
  if (!month || !Number.isFinite(day)) return "";
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidISODate(iso) ? iso : "";
}

function smartImportTimeToken(token: string, inheritedMeridiem?: "am" | "pm") {
  const match = token.trim().toLowerCase().match(/^(\d{1,2})(?:(?::|\.)(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = (match[3] as "am" | "pm" | undefined) ?? inheritedMeridiem;
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function smartImportTimeRange(text: string) {
  const match = text.match(
    /\b(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?)\b/i
  );
  if (!match) return { startTime: "", endTime: "" };

  const endMeridiem = match[2].toLowerCase().match(/(am|pm)/)?.[1] as "am" | "pm" | undefined;
  const startTime = smartImportTimeToken(match[1], endMeridiem);
  const endTime = smartImportTimeToken(match[2]);

  return { startTime: startTime ?? "", endTime: endTime ?? "" };
}

function smartImportSingleTime(text: string) {
  const match = text.match(/\b(?:at\s+)?(\d{1,2}(?:(?::|\.)\d{2})\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i);
  return match ? smartImportTimeToken(match[1]) ?? "" : "";
}

function inferSmartImportEventType(text: string): CalendarEventType {
  const lower = text.toLowerCase();
  if (/\b(class|studio|seminar|lecture)\b/.test(lower)) return "class";
  if (/\b(meeting|tutorial|supervision)\b/.test(lower)) return "meeting";
  if (/\b(deadline|submission|due)\b/.test(lower)) return "deadline";
  if (/\b(flight|train|travel)\b/.test(lower)) return "travel";
  if (/\b(dentist|doctor|appointment)\b/.test(lower)) return "personal";
  if (/\b(london|paris|madrid|zurich|barcelona|rome|berlin)\b/.test(lower) && /\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[a-z]+/i.test(text)) {
    return "travel";
  }
  return "personal";
}

function smartImportTitle(text: string) {
  return text
    .replace(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b.*$/i, "")
    .replace(/\bbetween\s+.*$/i, "")
    .replace(/\bfrom\s+.*$/i, "")
    .replace(/\bat\s+\d{1,2}.*$/i, "")
    .replace(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s+[a-z]+.*$/i, "")
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}.*$/i, "")
    .replace(/\b\d{1,2}(?:(?::|\.)\d{2})?\s*(?:am|pm)?\s*(?:-|–|to)\s*\d{1,2}.*$/i, "")
    .trim();
}

function smartImportOrdinalDateMatch(text: string) {
  return text.match(
    /\b(?:(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i
  );
}

function smartImportRoute(text: string) {
  const airportRoute = text.match(/\b([A-Z]{3})\s*(?:to|→|->|–|-)\s*([A-Z]{3})\b/);
  if (airportRoute) {
    return { origin: airportRoute[1], destination: airportRoute[2], confident: true };
  }

  const namedRoute = text.match(/\b([A-Z][A-Za-z]+)\s+to\s+([A-Z][A-Za-z]+)\b/);
  if (namedRoute) {
    return { origin: namedRoute[1], destination: namedRoute[2], confident: false };
  }

  return { origin: "", destination: "", confident: false };
}

function smartImportTravelTitle(text: string, origin: string, destination: string) {
  if (/\bflight\b/i.test(text) && origin && destination) return `Flight ${origin} → ${destination}`;
  if (/\btrain\b/i.test(text) && origin && destination) return `Train ${origin} → ${destination}`;
  if (origin && destination) return `${origin} → ${destination}`;
  return smartImportTitle(text);
}

function smartImportLocation(text: string) {
  const match = text.match(/\b(?:room|rm)\s+([a-z0-9 -]+)/i);
  if (match) return `Room ${match[1].trim().replace(/\s+(between|from|until|every)\b.*$/i, "")}`;
  const inMatch = text.match(/\bin\s+([^,]+?)(?=\s+(?:from|between|until|every|at)\b|$)/i);
  return inMatch ? inMatch[1].trim() : "";
}

function splitSmartImportInput(raw: string) {
  return raw
    .split(/\n+|;/)
    .flatMap((line) =>
      line.split(/\s+and\s+(?=[A-Z][^,\n]*(?:\bevery\b|\bclass\b|\bmeeting\b|\bdentist\b|\bdeadline\b|\bstudio\b|\bflight\b|\btrain\b|\btravel\b|\b[A-Z][a-z]+\s+\d{1,2}\b|\b[A-Z][a-z]+\s+\d{1,2}\s*[-–]\s*\d{1,2}\b))/)
    )
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSmartScheduleImport(raw: string, contextYear: number): SmartImportProposal[] {
  return splitSmartImportInput(raw).map((sourceText) => {
    const lower = sourceText.toLowerCase();
    const eventType = inferSmartImportEventType(sourceText);
    const weeklyMatch = lower.match(/\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thurs|fri|sat|sun)\b/i);
    const recurrence: SmartImportRecurrence = weeklyMatch ? "weekly" : "none";
    const weekday = weeklyMatch ? IMPORT_WEEKDAYS[weeklyMatch[1].toLowerCase()] ?? 1 : 1;
    const betweenMatch = sourceText.match(
      /\b(?:between|from)\s+([a-z]+)\s+(\d{1,2})\s+(?:and|until|to)\s+([a-z]+)\s+(\d{1,2})/i
    );
    const dateRangeMatch = sourceText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\b/i);
    const ordinalDateMatch = smartImportOrdinalDateMatch(sourceText);
    const singleDateMatch = sourceText.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})\b/i
    );
    const timeRange = smartImportTimeRange(sourceText);
    const singleTime = timeRange.startTime ? "" : smartImportSingleTime(sourceText);
    const hasSpecificTime = Boolean(timeRange.startTime || singleTime);
    const allDay =
      (eventType === "travel" && !hasSpecificTime) ||
      eventType === "milestone" ||
      (eventType === "deadline" && !hasSpecificTime);
    const route = smartImportRoute(sourceText);
    const warnings: string[] = [];
    let date = "";
    let endDate = "";

    if (betweenMatch) {
      date = smartImportDate(contextYear, betweenMatch[1], betweenMatch[2]);
      endDate = smartImportDate(contextYear, betweenMatch[3], betweenMatch[4]);
    } else if (dateRangeMatch) {
      date = smartImportDate(contextYear, dateRangeMatch[3], dateRangeMatch[1]);
      endDate = smartImportDate(contextYear, dateRangeMatch[3], dateRangeMatch[2]);
    } else if (ordinalDateMatch) {
      date = smartImportDate(contextYear, ordinalDateMatch[3], ordinalDateMatch[2]);
      endDate = date;
    } else if (singleDateMatch) {
      date = smartImportDate(contextYear, singleDateMatch[1], singleDateMatch[2]);
      endDate = date;
    }

    const statedWeekday = ordinalDateMatch?.[1]?.toLowerCase();
    if (statedWeekday && date) {
      const expectedWeekday = IMPORT_WEEKDAYS[statedWeekday];
      if (expectedWeekday && isoWeekday(date) !== expectedWeekday) {
        warnings.push("Weekday does not match parsed date");
      }
    }

    if (recurrence === "weekly" && !date) warnings.push("Date range missing");
    if (recurrence === "weekly" && date && !endDate) warnings.push("Series end missing");
    if (!date && recurrence === "none") warnings.push("Date missing");
    if (!allDay && !timeRange.startTime && !singleTime) warnings.push("Start time missing");
    if (!allDay && !timeRange.endTime) warnings.push("End time missing");
    if (timeRange.startTime && timeRange.endTime && timeRange.endTime <= timeRange.startTime) {
      warnings.push("End time needs review");
    }

    const title =
      eventType === "travel"
        ? smartImportTravelTitle(sourceText, route.origin, route.destination)
        : smartImportTitle(sourceText) || sourceText.split(/\s+/).slice(0, 4).join(" ");
    if (!title) warnings.push("Title missing");

    return {
      id: createCalendarEventId(),
      sourceText,
      include: warnings.length === 0,
      title,
      eventType,
      recurrence,
      allDay,
      date,
      endDate: endDate || date,
      weekday,
      startTime: timeRange.startTime || singleTime,
      endTime: timeRange.endTime,
      location: smartImportLocation(sourceText),
      origin: route.origin,
      destination: route.destination,
      notes: "",
      warnings,
    };
  });
}

function validateSmartImportProposal(proposal: SmartImportProposal) {
  const warnings: string[] = [];
  if (!proposal.title.trim()) warnings.push("Title missing");
  if (!isValidISODate(proposal.date)) warnings.push("Date missing");
  if (proposal.endDate && !isValidISODate(proposal.endDate)) warnings.push("End date invalid");
  if (proposal.endDate && proposal.date && proposal.endDate < proposal.date) warnings.push("End date before start date");
  if (proposal.recurrence === "weekly") {
    if (proposal.weekday < 1 || proposal.weekday > 7) warnings.push("Weekday missing");
    if (!isValidISODate(proposal.endDate)) warnings.push("Series end missing");
  }
  if (!proposal.allDay) {
    if (!proposal.startTime || timeToMinutes(proposal.startTime) === null) warnings.push("Start time missing");
    if (!proposal.endTime || timeToMinutes(proposal.endTime) === null) warnings.push("End time missing");
    if (proposal.startTime && proposal.endTime && proposal.endTime <= proposal.startTime) {
      warnings.push("End time must be after start time");
    }
  }
  return warnings;
}

function smartImportProposalToCalendarEvent(
  proposal: SmartImportProposal,
  timezone: string
): CalendarEvent | null {
  const warnings = validateSmartImportProposal(proposal);
  if (warnings.length) return null;

  const allDay = proposal.allDay;
  const startAt = allDay ? null : zonedDateTimeToUtcISO(proposal.date, proposal.startTime, timezone);
  const endAt = allDay ? null : zonedDateTimeToUtcISO(proposal.date, proposal.endTime, timezone);
  if (!allDay && (!startAt || !endAt)) return null;

  const recurrenceRule =
    proposal.recurrence === "weekly"
      ? stringifyWeeklyRecurrenceRule({
          freq: "weekly",
          weekday: proposal.weekday,
          startDate: proposal.date,
          endDate: proposal.endDate,
          startTime: proposal.startTime,
          endTime: proposal.endTime,
          timezone,
        })
      : null;

  return {
    id: proposal.savedEventId ?? createCalendarEventId(),
    eventType: proposal.eventType,
    title: proposal.title.trim(),
    description: null,
    allDay,
    startAt,
    endAt,
    startDate: allDay ? proposal.date : null,
    endDate: allDay && proposal.endDate !== proposal.date ? proposal.endDate : null,
    timezone,
    taskId: null,
    categoryId: null,
    location: proposal.location.trim() || null,
    videoUrl: null,
    notes: proposal.notes.trim() || null,
    metadata: {
      importedFrom: "smart_schedule_import",
      origin: proposal.origin.trim() || undefined,
      destination: proposal.destination.trim() || undefined,
    },
    recurrenceRule,
    recurrenceParentId: null,
    recurrenceExceptionDate: null,
    recurrenceStatus: null,
  };
}

function smartImportDuplicateWarning(proposal: SmartImportProposal, events: CalendarEvent[]) {
  const candidateTitle = proposal.title.trim().toLowerCase();
  if (!candidateTitle || !proposal.date) return false;

  return events.some((event) => {
    const eventTitle = event.title.trim().toLowerCase();
    const sameTitle = eventTitle === candidateTitle || eventTitle.includes(candidateTitle) || candidateTitle.includes(eventTitle);
    if (!sameTitle) return false;

    const rule = parseWeeklyRecurrenceRule(event.recurrenceRule);
    if (proposal.recurrence === "weekly" || rule) {
      return Boolean(
        proposal.recurrence === "weekly" &&
          rule &&
          rule.weekday === proposal.weekday &&
          rule.startTime === proposal.startTime &&
          rule.endTime === proposal.endTime
      );
    }

    const eventDate = event.allDay ? event.startDate : eventLocalDate(event.startAt);
    const eventTime = event.allDay ? "" : timeInputFromTimestamp(event.startAt);
    return eventDate === proposal.date && eventTime === proposal.startTime;
  });
}

function plannerTemporalStateForDate(date: string | null | undefined, today: string | null | undefined): PlannerTemporalState {
  if (!date || !today || !isValidISODate(date) || !isValidISODate(today)) return "future";
  if (date < today) return "past";
  if (date === today) return "today";
  return "future";
}

function plannerTemporalStateForSpan(
  start: string | null | undefined,
  end: string | null | undefined,
  today: string | null | undefined
): PlannerTemporalState {
  if (!start || !today || !isValidISODate(start) || !isValidISODate(today)) return "future";
  const safeEnd = end && isValidISODate(end) ? end : start;
  if (safeEnd < today) return "past";
  if (start <= today && today <= safeEnd) return "today";
  return "future";
}

function plannerEventTemporalState(event: CalendarEvent, today: string | null | undefined): PlannerTemporalState {
  const span = eventDateSpan(event);
  return plannerTemporalStateForSpan(span?.start, span?.end, today);
}

function plannerItemTemporalState(
  item: PlannerDateItem,
  today: string | null | undefined,
  fallbackDate?: string
): PlannerTemporalState {
  if (item.sourceType === "task_deadline") {
    return plannerTemporalStateForDate(item.date ?? fallbackDate, today);
  }
  return plannerEventTemporalState(item.event, today);
}

function plannerPastSoftening(temporalState: PlannerTemporalState) {
  if (temporalState === "past") return "saturate-[0.72] text-slate-500";
  if (temporalState === "today") return "ring-1 ring-inset ring-slate-900/10";
  return "";
}

function plannerYearMarkerTone(_eventType: CalendarEventType, temporalState: PlannerTemporalState = "future") {
  if (temporalState === "past") return "opacity-70 saturate-[0.72]";
  if (temporalState === "today") return "ring-1 ring-inset ring-slate-900/10";
  return "";
}

function plannerYearPillTone(eventType: CalendarEventType, temporalState: PlannerTemporalState = "future") {
  const temporal = plannerPastSoftening(temporalState);
  const today = temporalState === "today" ? " ring-1 ring-inset ring-slate-900/10" : "";
  if (eventType === "work") return `border-[#5FA9FF]/30 bg-[#5FA9FF]/10 text-[#2D6FAF] ${temporal}${today}`;
  if (eventType === "class") return `border-[#C29EFF]/35 bg-[#C29EFF]/12 text-[#6F4CB8] ${temporal}${today}`;
  if (eventType === "meeting") return `border-[#FCB100]/38 bg-[#FCB100]/14 text-[#9B6900] ${temporal}${today}`;
  if (eventType === "deadline") return `border-[#FE7877]/50 bg-[#FE7877]/16 text-[#B33F3E] font-semibold ${temporal}${today}`;
  if (eventType === "milestone") return `border-[#FD925E]/38 bg-[#FD925E]/14 text-[#A94F20] ${temporal}${today}`;
  if (eventType === "personal") return `border-[#88E18E]/35 bg-[#88E18E]/12 text-[#2F7E39] ${temporal}${today}`;
  if (eventType === "travel") return `border-[#04E6F7]/40 bg-[#04E6F7]/12 text-[#067F89] ${temporal}${today}`;
  if (eventType === "date") return `border-[#FC889F]/35 bg-[#FC889F]/12 text-[#AE3E56] ${temporal}${today}`;
  if (eventType === "social") return `border-[#55CDFF]/35 bg-[#55CDFF]/12 text-[#167BA8] ${temporal}${today}`;
  if (eventType === "active") return `border-[#2DCC70]/35 bg-[#2DCC70]/12 text-[#197C45] ${temporal}${today}`;
  return `border-[#8293B9]/35 bg-[#8293B9]/12 text-[#465777] ${temporal}${today}`;
}

function PlannerYearMarkerIcon({ eventType }: { eventType: CalendarEventType }) {
  return <PlannerEventTypeIcon eventType={eventType} />;
}

function plannerDeadlineTone(task: Task, temporalState: PlannerTemporalState = "future") {
  const temporal = plannerPastSoftening(temporalState);
  const today = temporalState === "today" ? " ring-1 ring-inset ring-[#F04A2D]/15" : "";
  return task.status === "frozen"
    ? `border-[#F04A2D]/25 border-l-2 border-l-[#F04A2D]/45 bg-[#F04A2D]/10 text-[#B93822] font-semibold ${temporal}${today}`
    : `border-[#F04A2D]/35 border-l-2 border-l-[#F04A2D]/65 bg-[#F04A2D]/14 text-[#B93822] font-semibold ${temporal}${today}`;
}

function plannerWorkResolutionStatus(event: CalendarEvent): PlannerWorkResolutionStatus | null {
  const status = event.metadata?.plannerResolutionStatus;
  return status === "logged" || status === "skipped" ? status : null;
}

function withPlannerWorkResolution(
  event: CalendarEvent,
  status: PlannerWorkResolutionStatus,
  loggedTimeLogId: string | null = null
): CalendarEvent {
  const metadata: Record<string, unknown> = {
    ...(event.metadata ?? {}),
    plannerResolutionStatus: status,
    resolvedAt: new Date().toISOString(),
  };
  if (loggedTimeLogId) {
    metadata.loggedTimeLogId = loggedTimeLogId;
  } else {
    delete metadata.loggedTimeLogId;
  }

  return {
    ...event,
    metadata,
  };
}

async function savePlannerCalendarEvent(event: CalendarEvent) {
  const eventToSave = withCalendarTimingMetadata(event);
  const saved = await saveCalendarEvent(eventToSave, SYNC_CODE);
  return saved ? eventToSave : null;
}

function isPastUnresolvedPlannerWorkEvent(event: CalendarEvent, nowMs: number | null) {
  if (event.eventType !== "work" || event.allDay || !event.startAt || !event.endAt || !nowMs) {
    return false;
  }

  if (plannerWorkResolutionStatus(event)) return false;

  const endMs = Date.parse(event.endAt);
  return Number.isFinite(endMs) && endMs < nowMs;
}

function plannedWorkTimeLogFromEvent(event: CalendarEvent): TimeLog | null {
  if (event.eventType !== "work" || !event.taskId || !event.startAt || !event.endAt) return null;

  const date = eventLocalDate(event.startAt);
  const startTime = timeInputFromTimestamp(event.startAt);
  const endTime = timeInputFromTimestamp(event.endAt);
  const startMs = Date.parse(event.startAt);
  const endMs = Date.parse(event.endAt);
  const hours = (endMs - startMs) / (60 * 60 * 1000);

  if (!date || !startTime || !endTime || !Number.isFinite(hours) || hours <= 0) return null;

  return {
    id: createTimeLogId(),
    taskId: event.taskId,
    date,
    startTime,
    endTime,
    hours,
    note: `Logged from planned work: ${event.title}`,
  };
}

function startOfLoggerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function endOfLoggerMonth(iso: string) {
  const { year, month } = isoParts(iso);
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

function startOfLoggerYear(iso: string) {
  return `${iso.slice(0, 4)}-01-01`;
}

function endOfLoggerYear(iso: string) {
  return `${iso.slice(0, 4)}-12-31`;
}

function loggerDateRangeForMode(
  mode: LoggerRangeMode,
  anchorDate: string,
  customStartDate: string,
  customEndDate: string
) {
  const anchor = isValidISODate(anchorDate) ? anchorDate : todayISO();

  if (mode === "week") {
    const start = startOfLoggerWeek(anchor);
    return { start, end: addDaysISO(start, 6) };
  }

  if (mode === "day") {
    return { start: anchor, end: anchor };
  }

  if (mode === "month") {
    return { start: startOfLoggerMonth(anchor), end: endOfLoggerMonth(anchor) };
  }

  if (mode === "year") {
    return { start: startOfLoggerYear(anchor), end: endOfLoggerYear(anchor) };
  }

  const start = isValidISODate(customStartDate) ? customStartDate : anchor;
  const end = isValidISODate(customEndDate) ? customEndDate : start;
  return start <= end ? { start, end } : { start: end, end: start };
}

function loggerDaysForRange(range: { start: string; end: string }) {
  if (!isValidISODate(range.start) || !isValidISODate(range.end) || range.start > range.end) {
    return [];
  }

  const days: string[] = [];
  let cursor = range.start;

  while (cursor <= range.end) {
    days.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }

  return days;
}

function formatLoggerPeriod(
  mode: LoggerRangeMode,
  range: { start: string; end: string },
  anchorDate: string
) {
  const dateFormatter = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const monthFormatter = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

  if (mode === "week") {
    const start = new Date(range.start + "T00:00:00");
    const end = new Date(range.end + "T00:00:00");
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) {
      return `${start.getDate()}-${end.getDate()} ${new Intl.DateTimeFormat("en", {
        month: "short",
        year: "numeric",
      }).format(end)}`;
    }
    return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
  }

  if (mode === "day") {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(range.start + "T00:00:00"));
  }

  if (mode === "month") {
    return monthFormatter.format(new Date(range.start + "T00:00:00"));
  }

  if (mode === "year") {
    return anchorDate.slice(0, 4);
  }

  return `${dateFormatter.format(new Date(range.start + "T00:00:00"))} - ${dateFormatter.format(
    new Date(range.end + "T00:00:00")
  )}`;
}

function timeToMinutes(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function durationHoursFromTimes(startTime: string, endTime: string) {
  return calculateTimeLogDurationHours("2000-01-01", startTime, "2000-01-01", endTime);
}

function formatDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatLoggedTime(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "0m";
  return formatDuration(hours);
}

function formatLoggerDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

function formatLoggerWeekday(iso: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(iso + "T00:00:00"));
}

function formatOpenSessionStarted(log: TimeLog) {
  const weekday = formatLoggerWeekday(log.date);
  return `Started ${weekday} ${log.startTime ?? ""}`.trim();
}

function exactTimeLogDuration(log: TimeLog) {
  if (!isClosedTimeLog(log) || !log.startTime || !log.endTime) return null;
  return calculateTimeLogDurationHours(log.date, log.startTime, log.endDate || log.date, log.endTime);
}

function isExactTimedTimeLog(log: TimeLog) {
  return exactTimeLogDuration(log) !== null;
}

function timeOfDayBucketFromMinutes(minutes: number): LoggerTimeOfDayBucket {
  if (minutes >= 5 * 60 && minutes < 12 * 60) return "morning";
  if (minutes >= 12 * 60 && minutes < 17 * 60) return "afternoon";
  if (minutes >= 17 * 60 && minutes < 22 * 60) return "evening";
  return "night";
}

function timeOfDayBucketForLog(log: TimeLog) {
  const minutes = timeLogTimeToMinutes(log.startTime);
  return minutes === null ? null : timeOfDayBucketFromMinutes(minutes);
}

function loggerCategoryTone(colour?: string | null) {
  switch (colour) {
    case "sky":
      return {
        accent: "bg-sky-400",
        border: "border-sky-100",
        bg: "bg-sky-50/70",
        text: "text-sky-800",
        muted: "text-sky-600",
      };
    case "violet":
      return {
        accent: "bg-violet-400",
        border: "border-violet-100",
        bg: "bg-violet-50/70",
        text: "text-violet-800",
        muted: "text-violet-600",
      };
    case "emerald":
      return {
        accent: "bg-emerald-400",
        border: "border-emerald-100",
        bg: "bg-emerald-50/70",
        text: "text-emerald-800",
        muted: "text-emerald-600",
      };
    case "amber":
      return {
        accent: "bg-amber-400",
        border: "border-amber-100",
        bg: "bg-amber-50/70",
        text: "text-amber-800",
        muted: "text-amber-600",
      };
    case "rose":
      return {
        accent: "bg-rose-400",
        border: "border-rose-100",
        bg: "bg-rose-50/70",
        text: "text-rose-800",
        muted: "text-rose-600",
      };
    case "navy":
      return { accent: "bg-[#35557F]", border: "border-[#D8E2EF]", bg: "bg-[#F2F5F9]", text: "text-[#284260]", muted: "text-[#58708D]" };
    case "blue":
      return { accent: "bg-blue-400", border: "border-blue-100", bg: "bg-blue-50/70", text: "text-blue-800", muted: "text-blue-600" };
    case "cyan":
      return { accent: "bg-cyan-400", border: "border-cyan-100", bg: "bg-cyan-50/70", text: "text-cyan-800", muted: "text-cyan-600" };
    case "teal":
      return { accent: "bg-teal-400", border: "border-teal-100", bg: "bg-teal-50/70", text: "text-teal-800", muted: "text-teal-600" };
    case "mint":
      return { accent: "bg-green-300", border: "border-green-100", bg: "bg-green-50/70", text: "text-green-800", muted: "text-green-600" };
    case "lime":
      return { accent: "bg-lime-400", border: "border-lime-100", bg: "bg-lime-50/70", text: "text-lime-800", muted: "text-lime-700" };
    case "yellow":
      return { accent: "bg-yellow-400", border: "border-yellow-100", bg: "bg-yellow-50/70", text: "text-yellow-900", muted: "text-yellow-700" };
    case "orange":
      return { accent: "bg-orange-400", border: "border-orange-100", bg: "bg-orange-50/70", text: "text-orange-800", muted: "text-orange-600" };
    case "coral":
      return { accent: "bg-[#F4775C]", border: "border-[#FAD8D0]", bg: "bg-[#FFF3F0]", text: "text-[#9A3F2D]", muted: "text-[#C35B45]" };
    case "pink":
      return { accent: "bg-pink-400", border: "border-pink-100", bg: "bg-pink-50/70", text: "text-pink-800", muted: "text-pink-600" };
    default:
      return {
        accent: "bg-slate-300",
        border: "border-slate-200",
        bg: "bg-slate-50",
        text: "text-slate-800",
        muted: "text-slate-500",
      };
  }
}

function loggerCellTone(hours: number) {
  if (hours <= 0) return "bg-transparent text-transparent";
  if (hours < 1) return "bg-violet-50/70 text-violet-700";
  if (hours < 2) return "bg-violet-100/80 text-violet-800";
  if (hours < 4) return "bg-violet-200/80 text-violet-900";
  return "bg-violet-300/80 text-violet-950";
}

function loggerCountCellTone(count: number) {
  if (count <= 0) return "bg-transparent text-transparent";
  if (count === 1) return "bg-violet-50/70 text-violet-700";
  if (count === 2) return "bg-violet-100/80 text-violet-800";
  if (count <= 4) return "bg-violet-200/80 text-violet-900";
  return "bg-violet-300/80 text-violet-950";
}

function formatGridHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "";
  return formatDuration(hours);
}

function loggerActivityCellTone(colour: string | null | undefined, level: number) {
  const safeLevel = clamp(Math.round(level), 0, 4);
  const palettes: Record<string, string[]> = {
    sky: ["bg-white border-sky-100", "bg-sky-50 border-sky-100", "bg-sky-100 border-sky-100", "bg-sky-200 border-sky-200", "bg-sky-400 border-sky-400"],
    violet: ["bg-white border-violet-100", "bg-violet-50 border-violet-100", "bg-violet-100 border-violet-100", "bg-violet-200 border-violet-200", "bg-violet-400 border-violet-400"],
    emerald: ["bg-white border-emerald-100", "bg-emerald-50 border-emerald-100", "bg-emerald-100 border-emerald-100", "bg-emerald-200 border-emerald-200", "bg-emerald-400 border-emerald-400"],
    amber: ["bg-white border-amber-100", "bg-amber-50 border-amber-100", "bg-amber-100 border-amber-100", "bg-amber-200 border-amber-200", "bg-amber-400 border-amber-400"],
    rose: ["bg-white border-rose-100", "bg-rose-50 border-rose-100", "bg-rose-100 border-rose-100", "bg-rose-200 border-rose-200", "bg-rose-400 border-rose-400"],
    navy: ["bg-white border-[#E0E7F0]", "bg-[#F0F4F8] border-[#D8E2EF]", "bg-[#D8E2EF] border-[#C2D1E3]", "bg-[#9CB2CC] border-[#9CB2CC]", "bg-[#35557F] border-[#35557F]"],
    blue: ["bg-white border-blue-100", "bg-blue-50 border-blue-100", "bg-blue-100 border-blue-100", "bg-blue-200 border-blue-200", "bg-blue-400 border-blue-400"],
    cyan: ["bg-white border-cyan-100", "bg-cyan-50 border-cyan-100", "bg-cyan-100 border-cyan-100", "bg-cyan-200 border-cyan-200", "bg-cyan-400 border-cyan-400"],
    teal: ["bg-white border-teal-100", "bg-teal-50 border-teal-100", "bg-teal-100 border-teal-100", "bg-teal-200 border-teal-200", "bg-teal-400 border-teal-400"],
    mint: ["bg-white border-green-100", "bg-green-50 border-green-100", "bg-green-100 border-green-100", "bg-green-200 border-green-200", "bg-green-400 border-green-400"],
    lime: ["bg-white border-lime-100", "bg-lime-50 border-lime-100", "bg-lime-100 border-lime-100", "bg-lime-200 border-lime-200", "bg-lime-400 border-lime-400"],
    yellow: ["bg-white border-yellow-100", "bg-yellow-50 border-yellow-100", "bg-yellow-100 border-yellow-100", "bg-yellow-200 border-yellow-200", "bg-yellow-400 border-yellow-400"],
    orange: ["bg-white border-orange-100", "bg-orange-50 border-orange-100", "bg-orange-100 border-orange-100", "bg-orange-200 border-orange-200", "bg-orange-400 border-orange-400"],
    coral: ["bg-white border-[#FBE2DC]", "bg-[#FFF3F0] border-[#FBE2DC]", "bg-[#FDDDD5] border-[#FDD1C7]", "bg-[#F9AC9A] border-[#F9AC9A]", "bg-[#F4775C] border-[#F4775C]"],
    pink: ["bg-white border-pink-100", "bg-pink-50 border-pink-100", "bg-pink-100 border-pink-100", "bg-pink-200 border-pink-200", "bg-pink-400 border-pink-400"],
  };
  const palette = palettes[colour ?? ""] ?? ["bg-white border-slate-100", "bg-slate-100 border-slate-100", "bg-slate-200 border-slate-200", "bg-slate-300 border-slate-300", "bg-slate-500 border-slate-500"];
  return palette[safeLevel];
}

function loggerActivityLevel(hours: number, thresholds: number[]) {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  if (!thresholds.length) return 1;
  if (hours <= thresholds[0]) return 1;
  if (hours <= thresholds[1]) return 2;
  if (hours <= thresholds[2]) return 3;
  return 4;
}

function loggerActivityThresholds(values: number[]) {
  const nonZero = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!nonZero.length) return [];
  if (nonZero.length === 1) return [nonZero[0], nonZero[0], nonZero[0]];

  const unique = Array.from(new Set(nonZero.map((value) => Number(value.toFixed(4)))));
  if (unique.length === 1) {
    const value = unique[0];
    return [value * 0.5, value, value * 1.5];
  }

  function quantile(position: number) {
    const index = Math.min(nonZero.length - 1, Math.max(0, Math.ceil(position * nonZero.length) - 1));
    return nonZero[index];
  }

  return [quantile(0.25), quantile(0.5), quantile(0.75)];
}

function normalizeTimeLogs(value: unknown): TimeLog[] {
  if (!Array.isArray(value)) return [];

  const logs: TimeLog[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Partial<TimeLog>;
    const taskId = String(raw.taskId ?? "");
    const date = typeof raw.date === "string" ? raw.date : "";
    const startTime = timeLogTimeToMinutes(raw.startTime) !== null ? raw.startTime : undefined;
    const endDate = typeof raw.endDate === "string" && isTimeLogISODate(raw.endDate) ? raw.endDate : null;
    const endTime = timeLogTimeToMinutes(raw.endTime) !== null ? raw.endTime : undefined;
    const hours = raw.hours === null ? null : Number(raw.hours ?? 0);

    if (!taskId || taskId.startsWith("logger-") || !isTimeLogISODate(date)) {
      continue;
    }

    const next: TimeLog = {
      id: String(raw.id ?? uid()),
      taskId,
      date,
      startTime,
      endDate,
      endTime,
      hours,
      note: typeof raw.note === "string" ? raw.note : "",
    };

    const hasAnyTime = Boolean(next.startTime || next.endTime);
    const isValidTimedClosedLog =
      isClosedTimeLog(next) &&
      (!hasAnyTime ||
        (Boolean(next.startTime) &&
          Boolean(next.endTime) &&
          calculateTimeLogDurationHours(next.date, next.startTime ?? "", endDate ?? next.date, next.endTime ?? "") !== null));

    if (isValidTimedClosedLog || isOpenTimeLog(next)) {
      logs.push(next);
    }
  }

  return logs;
}

function backupStorageKey(date: Date) {
  return `${BACKUP_KEY_PREFIX}${date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "")}`;
}

function getLocalBackupKeys() {
  if (typeof window === "undefined") return [];
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(BACKUP_KEY_PREFIX))
    .sort()
    .reverse();
}

function createLocalBackup(tasks: Task[], timeLogs: TimeLog[] = []) {
  if (typeof window === "undefined") return null;

  const createdAt = new Date().toISOString();
  const snapshot: BackupSnapshot = { createdAt, tasks, timeLogs };
  const key = backupStorageKey(new Date(createdAt));
  localStorage.setItem(key, JSON.stringify(snapshot));

  const keys = getLocalBackupKeys();
  for (const oldKey of keys.slice(20)) {
    localStorage.removeItem(oldKey);
  }

  return { key, snapshot };
}

function loadLocalTaskCache() {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(TASKS_LOCAL_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((task) => normalizeTask(task));
  } catch (error) {
    console.warn("Failed to load local task cache:", error);
    return [];
  }
}

function saveLocalTaskCache(tasks: Task[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TASKS_LOCAL_CACHE_KEY, JSON.stringify(tasks));
}

function getLatestLocalBackupLabel() {
  if (typeof window === "undefined") return { label: "Never", count: 0 };
  const keys = getLocalBackupKeys();
  if (!keys.length) return { label: "Never", count: 0 };

  const raw = localStorage.getItem(keys[0]);
  if (!raw) return { label: "Unknown", count: keys.length };

  try {
    const parsed = JSON.parse(raw) as Partial<BackupSnapshot>;
    return {
      label: parsed.createdAt ? new Date(parsed.createdAt).toLocaleString() : "Unknown",
      count: keys.length,
    };
  } catch {
    return { label: "Unknown", count: keys.length };
  }
}

function modeToStoredTab(mode: ViewMode) {
  return mode === "board" ? "dashboard" : mode;
}

function storedTabToMode(value: string | null): ViewMode {
  if (value === "planner" || value === "list" || value === "logger" || value === "meds") return value;
  return "board";
}

function modeLabel(mode: ViewMode) {
  return APP_NAV_ITEMS.find((item) => item.id === mode)?.label ?? "Dashboard";
}

function modeSubtitle(mode: ViewMode) {
  if (mode === "board") return "What needs attention, then everything by category.";
  if (mode === "planner") return "Calendar structure and scheduled blocks.";
  if (mode === "logger") return "Actual time spent and working cadence.";
  if (mode === "meds") return "Lightweight medication and feeling notes.";
  return "Search, filter and maintain task details.";
}

function formatMedicationTime(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatMedicationDate(timestamp: string) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
  }).format(date).toUpperCase();
}

function medicationLocalDate(entry: MedicationEntry) {
  const date = new Date(entry.timestamp);
  if (!Number.isFinite(date.getTime())) return "";
  return localDateISO(date);
}

function normalizeFeelingDefinitions(value: unknown): FeelingDefinition[] {
  if (!Array.isArray(value)) return DEFAULT_FEELING_DEFINITIONS;
  const storedDefinitions = value
    .map((raw): FeelingDefinition | null => {
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Record<string, unknown>;
      const id = typeof candidate.id === "string" ? candidate.id : "";
      const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const icon = typeof candidate.icon === "string" ? candidate.icon : "smile";
      const valence = typeof candidate.valence === "string" ? candidate.valence : "neutral";
      const category = candidate.category === "symptom" ? "symptom" : "state";
      if (!id || !name) return null;
      return {
        id,
        name,
        icon: FEELING_ICON_OPTIONS.some((option) => option.id === icon) ? (icon as FeelingIconKey) : "smile",
        valence: valence === "good" || valence === "bad" ? valence : "neutral",
        category,
        active: candidate.active !== false,
        custom: candidate.custom === true,
      };
    })
    .filter((definition): definition is FeelingDefinition => Boolean(definition));
  if (!storedDefinitions.length) return DEFAULT_FEELING_DEFINITIONS;

  const storedById = new Map(storedDefinitions.map((definition) => [definition.id, definition]));
  const defaults = DEFAULT_FEELING_DEFINITIONS.map((definition) => {
    const stored = storedById.get(definition.id);
    return stored ? { ...stored, category: definition.category } : definition;
  });
  const compatibilityDefinitions = storedDefinitions
    .filter((definition) => !DEFAULT_FEELING_DEFINITIONS.some((candidate) => candidate.id === definition.id))
    .map((definition) =>
      LEGACY_DEFAULT_FEELING_IDS.has(definition.id) ? { ...definition, active: false } : definition
    );
  return [...defaults, ...compatibilityDefinitions];
}

function isFeelingDefinitionsEntry(entry: MedicationEntry) {
  return (
    entry.entryType === "observation" &&
    entry.feeling === FEELING_DEFINITIONS_MARKER &&
    entry.metadata?.source === FEELING_DEFINITIONS_SOURCE
  );
}

function feelingIconComponent(icon: FeelingIconKey) {
  const icons: Record<FeelingIconKey, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
    target: Target,
    waves: Waves,
    zap: Zap,
    trending: TrendingUp,
    smile: Smile,
    minus: Meh,
    moon: Moon,
    activity: Activity,
    alert: CircleAlert,
    flame: Flame,
    cloud: Cloud,
    heart: Heart,
    heartPulse: HeartPulse,
    brain: Brain,
    sparkles: Sparkles,
    sun: Sun,
    circle: Circle,
    eye: Eye,
    frown: Frown,
    laugh: Laugh,
    gauge: Gauge,
    battery: Battery,
    wind: Wind,
    shield: Shield,
    star: Star,
    timer: Timer,
    messageCircle: MessageCircle,
    utensils: Utensils,
    utensilsCrossed: UtensilsCrossed,
  };
  return icons[icon] ?? HeartPulse;
}

function FeelingIconPicker({
  value,
  onChange,
}: {
  value: FeelingIconKey;
  onChange: (icon: FeelingIconKey) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
      {FEELING_ICON_OPTIONS.map((option) => {
        const Icon = feelingIconComponent(option.id);
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.label}
            aria-label={option.label}
            className={`grid h-10 min-w-0 place-items-center rounded-[14px] border transition-colors ${
              selected
                ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

function FeelingSelectionGrid({
  definitions,
  selectedFeelingLogs,
  onToggle,
}: {
  definitions: FeelingDefinition[];
  selectedFeelingLogs: Record<string, SelectedFeelingLog>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid w-full max-w-[352px] grid-cols-4 gap-2 justify-self-center">
      {definitions.map((definition) => {
        const selected = Boolean(selectedFeelingLogs[definition.id]);
        const Icon = feelingIconComponent(definition.icon);
        const iconColor = feelingVisualIconColor(definition);
        return (
          <button
            key={definition.id}
            type="button"
            onClick={() => onToggle(definition.id)}
            className={`relative flex h-[78px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] border px-1.5 py-2.5 text-center transition-colors ${
              selected
                ? "border-slate-700 bg-slate-200/80 text-slate-950"
                : "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200/70"
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center">
              <Icon className={`h-6 w-6 ${iconColor}`} aria-hidden />
            </span>
            <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-slate-900">{definition.name}</span>
            {selected ? (
              <span className="absolute right-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-slate-800 text-white">
                <Check className="h-2.5 w-2.5" aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function feelingValenceTone(valence: FeelingValenceStable) {
  if (valence === "good") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (valence === "bad") return "border-rose-100 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function feelingVisualIconColor(definition: Pick<FeelingDefinition, "id" | "name" | "valence">) {
  const palettes: Record<FeelingValenceStable, string[]> = {
    good: ["text-teal-500", "text-emerald-500", "text-cyan-500", "text-blue-500"],
    neutral: ["text-slate-500", "text-blue-400", "text-violet-400", "text-slate-600"],
    bad: ["text-orange-500", "text-rose-500", "text-red-500", "text-pink-500"],
  };
  const palette = palettes[definition.valence];
  const key = `${definition.id}-${definition.name}`;
  const hash = Array.from(key).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function legacyFeelingValence(value?: FeelingValence | FeelingValenceStable | null): FeelingValenceStable {
  if (value === "positive" || value === "good") return "good";
  if (value === "negative" || value === "bad") return "bad";
  return "neutral";
}

function legacyFeelingIntensityValue(value?: FeelingIntensity | number | null) {
  if (typeof value === "number" && Number.isFinite(value)) return clamp(Math.round(value), 1, 5);
  if (value === "low") return 2;
  if (value === "high") return 4;
  return 3;
}

function feelingLogsFromEntry(entry: MedicationEntry): FeelingLogSnapshot[] {
  const rawLogs = entry.metadata?.feelingLogs;
  if (Array.isArray(rawLogs)) {
    return rawLogs
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const candidate = raw as Record<string, unknown>;
        const id =
          typeof candidate.feelingId === "string"
            ? candidate.feelingId
            : typeof candidate.id === "string"
              ? candidate.id
              : "";
        const name =
          typeof candidate.nameSnapshot === "string"
            ? candidate.nameSnapshot
            : typeof candidate.name === "string"
              ? candidate.name
              : "";
        const icon =
          typeof candidate.iconSnapshot === "string"
            ? candidate.iconSnapshot
            : typeof candidate.icon === "string"
              ? candidate.icon
              : "smile";
        const valence =
          typeof candidate.valenceSnapshot === "string"
            ? candidate.valenceSnapshot
            : typeof candidate.valence === "string"
              ? candidate.valence
              : "neutral";
        const intensity = Number(candidate.intensity);
        if (!id || !name) return null;
        return {
          id,
          name,
          icon: FEELING_ICON_OPTIONS.some((option) => option.id === icon) ? (icon as FeelingIconKey) : "smile",
          valence: valence === "good" || valence === "bad" ? valence : "neutral",
          intensity: Number.isFinite(intensity) ? clamp(Math.round(intensity), 1, 5) : 3,
        };
      })
      .filter((log): log is FeelingLogSnapshot => Boolean(log));
  }

  if (!entry.feeling) return [];
  return [
    {
      id: String(entry.feeling).toLowerCase().replace(/[^a-z0-9]+/g, "_") || "legacy_feeling",
      name: entry.feeling,
      icon: "smile" as FeelingIconKey,
      valence: legacyFeelingValence(entry.valence),
      intensity: legacyFeelingIntensityValue(entry.intensity),
    },
  ];
}

function medicationLabel(entry: MedicationEntry) {
  if (entry.entryType === "input") {
    return [entry.medication, entry.amount ? formatMedicationAmount(entry.amount) : "", entry.unit ?? ""]
      .filter(Boolean)
      .join(" ");
  }

  const logs = feelingLogsFromEntry(entry);
  return logs.length
    ? logs.map((log) => `${log.name} · ${log.intensity}/5`).join(" · ")
    : entry.feeling ?? "Feeling";
}

function formatMedicationAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(3)));
}

function titleCase(value: string) {
  return value ? value.slice(0, 1).toUpperCase() + value.slice(1) : value;
}

function medicationTimestampFromInputs(date: string, time: string) {
  if (!isValidISODate(date) || timeToMinutes(time) === null) return null;
  const { year, month, day } = isoParts(date);
  const [hours, minutes] = time.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function medicationMetadataValue(entry: MedicationEntry, key: string) {
  const value = entry.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isVyvanseEntry(entry: MedicationEntry) {
  return entry.entryType === "input" && (entry.medication ?? "").toLowerCase().includes("vyvanse");
}

function isCaffeineEntry(entry: MedicationEntry) {
  if (entry.entryType !== "input") return false;
  const medication = (entry.medication ?? "").toLowerCase();
  const source = medicationMetadataValue(entry, "source").toLowerCase();
  return medication.includes("coffee") || medication.includes("caffeine") || source.includes("caffeine");
}

function isProzacEntry(entry: MedicationEntry) {
  if (entry.entryType !== "input") return false;
  const medication = (entry.medication ?? "").toLowerCase();
  return medication.includes("prozac") || medication.includes("fluoxetine");
}

type MedicationTrackerDay = {
  date: string;
  count: number;
  amount: number | null;
  unit: string | null;
  intensity: number;
};

type MedicationTrackerSubstance = {
  key: string;
  label: string;
  color: string;
  days: Map<string, MedicationTrackerDay>;
};

const MEDICATION_TRACKER_CUSTOM_COLORS = ["#2098D4", "#7045D8", "#43C995", "#43D4DC", "#D43BD8"];

function medicationTrackerIdentity(entry: MedicationEntry) {
  if (entry.entryType !== "input" || !entry.medication?.trim()) return null;
  if (isCaffeineEntry(entry)) return { key: "caffeine", label: "Caffeine" };
  if (isVyvanseEntry(entry)) return { key: "vyvanse", label: "Vyvanse" };
  if (isProzacEntry(entry)) return { key: "prozac", label: "Prozac" };
  const label = entry.medication.trim();
  return { key: label.toLocaleLowerCase(), label };
}

function medicationTrackerColor(key: string) {
  if (key === "vyvanse") return "#ff6b1a";
  if (key === "caffeine") return "#f2aa12";
  if (key === "prozac") return "#7045D8";
  const hash = Array.from(key).reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
  return MEDICATION_TRACKER_CUSTOM_COLORS[hash % MEDICATION_TRACKER_CUSTOM_COLORS.length];
}

function medicationTrackerDateLabel(date: string) {
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`)
  );
}

function MedsTrackerGrid({
  substance,
  dates,
  mobile = false,
}: {
  substance: MedicationTrackerSubstance;
  dates: string[];
  mobile?: boolean;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weekCount = Math.ceil(dates.length / 7);
  const monthLabels = dates.reduce<Array<{ label: string; column: number }>>((labels, date, index) => {
    const monthKey = date.slice(0, 7);
    if (labels.some((label) => label.label === monthKey)) return labels;
    labels.push({ label: monthKey, column: Math.floor(index / 7) + 1 });
    return labels;
  }, []);
  const selectedDay = selectedDate ? substance.days.get(selectedDate) : null;
  const tooltip = (date: string, day?: MedicationTrackerDay) => {
    if (!day) return `${medicationTrackerDateLabel(date)} · No intake`;
    const amount = day.amount !== null ? ` · ${formatMedicationAmount(day.amount)}${day.unit ? ` ${day.unit}` : ""}` : "";
    const entries = day.count > 1 ? ` · ${day.count} entries` : "";
    return `${medicationTrackerDateLabel(date)} · ${substance.label}${amount}${entries}`;
  };

  return (
    <section className="min-w-0 max-w-full border-b border-slate-200/70 pb-4 last:border-b-0 sm:pb-5">
      <h2 className="mb-2 text-sm font-semibold text-slate-950">{substance.label}</h2>
      <div className={`w-full max-w-full pb-1 ${mobile ? "overflow-x-hidden" : "overflow-x-auto overscroll-x-contain"}`}>
        <div className={mobile ? "w-full max-w-full" : "min-w-max"}>
          <div
            className="mb-1 grid h-4 gap-0.5 text-[10px] text-slate-400"
            style={{ gridTemplateColumns: mobile ? `repeat(${weekCount}, minmax(0, 1fr))` : `repeat(${weekCount}, 11px)` }}
          >
            {monthLabels.map(({ label, column }) => (
              <span key={label} className="whitespace-nowrap" style={{ gridColumnStart: column }}>
                {new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${label}-01T00:00:00`))}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-0.5"
            style={mobile ? { gridTemplateColumns: `repeat(${weekCount}, minmax(0, 1fr))` } : undefined}
            aria-label={`${substance.label} intake activity`}
          >
            {dates.map((date) => {
              const day = substance.days.get(date);
              const isToday = date === todayISO();
              const opacity = day ? [0, 0.24, 0.42, 0.65, 0.88][day.intensity] : 1;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  title={tooltip(date, day)}
                  aria-label={tooltip(date, day)}
                  className={`${mobile ? "aspect-square h-auto w-full max-w-[18px] justify-self-center" : "h-[11px] w-[11px]"} rounded-[3px] border transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-slate-500 ${
                    day ? "border-transparent" : "border-slate-200/70 bg-slate-100"
                  } ${isToday ? "ring-1 ring-slate-500 ring-offset-1" : ""}`}
                  style={day ? { backgroundColor: substance.color, opacity } : undefined}
                />
              );
            })}
          </div>
        </div>
      </div>
      {selectedDate ? (
        <div className="mt-2 min-h-4 text-[11px] text-slate-500">{tooltip(selectedDate, selectedDay)}</div>
      ) : null}
      <div className="mt-2 flex items-center justify-start gap-1 text-[10px] text-slate-400 sm:justify-end">
        <span>Less</span>
        {[0.18, 0.32, 0.5, 0.7, 0.9].map((opacity) => (
          <span
            key={opacity}
            className="h-2.5 w-2.5 rounded-[3px] border border-slate-200/60"
            style={{ backgroundColor: substance.color, opacity }}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

function caffeineDrinkLabel(entry: MedicationEntry) {
  const label = medicationMetadataValue(entry, "drinkLabel");
  if (label) return label;
  if (entry.medication === "Coffee") return "Coffee";
  return entry.medication ?? "Caffeine";
}

function medicationChartX(timestampMs: number, startMs: number, endMs: number) {
  if (endMs <= startMs) return 36;
  return 36 + clamp((timestampMs - startMs) / (endMs - startMs), 0, 1) * 278;
}

function medicationChartY(value: number, maxPercent: number) {
  return 132 - clamp(value / Math.max(1, maxPercent), 0, 1) * 104;
}

function eliminationRateFromHalfLife(halfLifeHours: number) {
  return Math.log(2) / halfLifeHours;
}

function batemanRelativeLevel(elapsedHours: number, absorptionRatePerHour: number, eliminationRatePerHour: number) {
  if (elapsedHours < 0) return 0;
  const ka = absorptionRatePerHour;
  const ke = eliminationRatePerHour;
  if (!Number.isFinite(ka) || !Number.isFinite(ke) || ka <= 0 || ke <= 0) return 0;

  if (Math.abs(ka - ke) < 1e-6) {
    return Math.max(0, ka * elapsedHours * Math.exp(-ke * elapsedHours));
  }

  return Math.max(0, (ka / (ka - ke)) * (Math.exp(-ke * elapsedHours) - Math.exp(-ka * elapsedHours)));
}

function batemanPeakTimeHours(absorptionRatePerHour: number, eliminationRatePerHour: number) {
  if (Math.abs(absorptionRatePerHour - eliminationRatePerHour) < 1e-6) {
    return 1 / eliminationRatePerHour;
  }

  return Math.log(absorptionRatePerHour / eliminationRatePerHour) / (absorptionRatePerHour - eliminationRatePerHour);
}

const VYVANSE_ELIMINATION_RATE = eliminationRateFromHalfLife(VYVANSE_VISUAL_MODEL.halfLifeHours);
const VYVANSE_REFERENCE_PEAK_HOURS = batemanPeakTimeHours(
  VYVANSE_VISUAL_MODEL.absorptionRatePerHour,
  VYVANSE_ELIMINATION_RATE
);
const VYVANSE_REFERENCE_PEAK_LEVEL = batemanRelativeLevel(
  VYVANSE_REFERENCE_PEAK_HOURS,
  VYVANSE_VISUAL_MODEL.absorptionRatePerHour,
  VYVANSE_ELIMINATION_RATE
);
const CAFFEINE_ELIMINATION_RATE = eliminationRateFromHalfLife(CAFFEINE_VISUAL_MODEL.halfLifeHours);
const CAFFEINE_REFERENCE_PEAK_HOURS = batemanPeakTimeHours(
  CAFFEINE_VISUAL_MODEL.absorptionRatePerHour,
  CAFFEINE_ELIMINATION_RATE
);
const CAFFEINE_REFERENCE_PEAK_LEVEL = batemanRelativeLevel(
  CAFFEINE_REFERENCE_PEAK_HOURS,
  CAFFEINE_VISUAL_MODEL.absorptionRatePerHour,
  CAFFEINE_ELIMINATION_RATE
);

function chartScaleMaxPercent(kind: "vyvanse" | "caffeine", maxValue: number) {
  const defaultMax = kind === "vyvanse"
    ? VYVANSE_VISUAL_MODEL.defaultChartMaxPercent
    : CAFFEINE_VISUAL_MODEL.defaultChartMaxPercent;
  if (maxValue <= defaultMax) return defaultMax;
  return Math.ceil(maxValue / 25) * 25;
}

function vyvanseContribution(entry: MedicationEntry, sampleMs: number) {
  const doseMs = Date.parse(entry.timestamp);
  if (!Number.isFinite(doseMs) || sampleMs < doseMs) return 0;
  const elapsedHours = (sampleMs - doseMs) / (60 * 60 * 1000);
  if (elapsedHours > VYVANSE_VISUAL_MODEL.visibleHours) return 0;

  const amount = entry.amount && Number.isFinite(entry.amount) ? entry.amount : VYVANSE_VISUAL_MODEL.referenceDoseMg;
  const doseScale = amount / VYVANSE_VISUAL_MODEL.referenceDoseMg;
  const relativeLevel = batemanRelativeLevel(
    elapsedHours,
    VYVANSE_VISUAL_MODEL.absorptionRatePerHour,
    VYVANSE_ELIMINATION_RATE
  );
  return VYVANSE_REFERENCE_PEAK_LEVEL > 0 ? 100 * doseScale * (relativeLevel / VYVANSE_REFERENCE_PEAK_LEVEL) : 0;
}

function caffeineContribution(entry: MedicationEntry, sampleMs: number) {
  const intakeMs = Date.parse(entry.timestamp);
  if (!Number.isFinite(intakeMs) || sampleMs < intakeMs) return 0;
  const elapsedHours = (sampleMs - intakeMs) / (60 * 60 * 1000);
  if (elapsedHours > CAFFEINE_VISUAL_MODEL.visibleHours) return 0;

  const mg = entry.amount && Number.isFinite(entry.amount) ? entry.amount : CAFFEINE_VISUAL_MODEL.referenceMg;
  const amountScale = mg / CAFFEINE_VISUAL_MODEL.referenceMg;
  const relativeLevel = batemanRelativeLevel(
    elapsedHours,
    CAFFEINE_VISUAL_MODEL.absorptionRatePerHour,
    CAFFEINE_ELIMINATION_RATE
  );
  return CAFFEINE_REFERENCE_PEAK_LEVEL > 0 ? 100 * amountScale * (relativeLevel / CAFFEINE_REFERENCE_PEAK_LEVEL) : 0;
}

function buildMedsRange(range: MedsLevelRange, offset: number, nowMs: number) {
  const config = MEDS_RANGE_CONFIG[range];
  const durationMs = config.durationHours * 60 * 60 * 1000;
  const normalizedOffset = Math.max(0, offset);
  if (normalizedOffset === 0) {
    const futureMs = MEDS_CURRENT_WINDOW_FUTURE_HOURS * 60 * 60 * 1000;
    return { startMs: nowMs - durationMs, endMs: nowMs + futureMs, durationMs: durationMs + futureMs };
  }
  const endMs = nowMs - normalizedOffset * durationMs;
  return { startMs: endMs - durationMs, endMs, durationMs };
}

function buildMedsCurveSeries({
  entries,
  startMs,
  endMs,
  kind,
}: {
  entries: MedicationEntry[];
  startMs: number;
  endMs: number;
  kind: "vyvanse" | "caffeine";
}) {
  const samples = 56;
  const raw = Array.from({ length: samples }, (_, index) => {
    const sampleMs = startMs + ((endMs - startMs) * index) / (samples - 1);
    const value = entries.reduce(
      (sum, entry) => sum + (kind === "vyvanse" ? vyvanseContribution(entry, sampleMs) : caffeineContribution(entry, sampleMs)),
      0
    );
    return { sampleMs, value };
  });
  const maxPercent = chartScaleMaxPercent(kind, Math.max(0, ...raw.map((point) => point.value)));

  return {
    points: raw.map((point) => ({
      x: medicationChartX(point.sampleMs, startMs, endMs),
      y: medicationChartY(point.value, maxPercent),
    })),
    maxPercent,
  };
}

function medChartDots({
  entries,
  startMs,
  endMs,
  kind,
  maxPercent,
}: {
  entries: MedicationEntry[];
  startMs: number;
  endMs: number;
  kind: "vyvanse" | "caffeine";
  maxPercent: number;
}): MedsChartDot[] {
  return entries
    .filter((entry) => {
      const timestamp = Date.parse(entry.timestamp);
      return Number.isFinite(timestamp) && timestamp >= startMs && timestamp <= endMs;
    })
    .slice(-6)
    .map((entry) => {
      const timestamp = Date.parse(entry.timestamp);
      const contribution = kind === "vyvanse" ? vyvanseContribution(entry, timestamp + 60 * 60 * 1000) : caffeineContribution(entry, timestamp + 35 * 60 * 1000);
      return {
        key: entry.id,
        x: medicationChartX(timestamp, startMs, endMs),
        y: medicationChartY(Math.max(contribution, maxPercent * 0.06), maxPercent),
        label:
          kind === "vyvanse"
            ? `${formatMedicationAmount(entry.amount ?? VYVANSE_VISUAL_MODEL.referenceDoseMg)}${entry.unit ?? "mg"}`
            : caffeineDrinkLabel(entry),
        sublabel:
          kind === "vyvanse"
            ? formatMedicationTime(entry.timestamp)
            : `${formatMedicationTime(entry.timestamp)}\n~${formatMedicationAmount(entry.amount ?? CAFFEINE_VISUAL_MODEL.referenceMg)}mg`,
      };
    });
}

function medsCurvePath(points: MedsChartPoint[]) {
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      const previous = points[index - 1];
      const controlX = (previous.x + point.x) / 2;
      return `Q ${controlX.toFixed(1)} ${previous.y.toFixed(1)} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function medsAreaPath(points: MedsChartPoint[]) {
  if (!points.length) return "";
  const curve = medsCurvePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${curve} L ${last.x.toFixed(1)} 132 L ${first.x.toFixed(1)} 132 Z`;
}

function formatMedsRangeTimeLabel(timestampMs: number, range: MedsLevelRange) {
  const date = new Date(timestampMs);
  if (!Number.isFinite(date.getTime())) return "";
  if (range === "week") {
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { hour: "numeric", hour12: true }).format(date).replace(" ", "");
}

function MedsChartCard({
  title,
  subtitle,
  meta,
  tone,
  softTone,
  icon,
  points,
  dots,
  nowX,
  axisLabels,
  maxPercent,
}: {
  title: string;
  subtitle: string;
  meta: string;
  tone: string;
  softTone: string;
  icon: React.ReactNode;
  points: MedsChartPoint[];
  dots: MedsChartDot[];
  nowX: number | null;
  axisLabels: string[];
  maxPercent: number;
}) {
  const gradientId = `meds-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-fill`;
  const path = medsCurvePath(points);
  const area = medsAreaPath(points);

  return (
    <section className="rounded-[22px] border border-slate-200/80 bg-white px-3 pb-2.5 pt-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)] sm:px-4 sm:pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: softTone, color: tone }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-tight text-slate-950">{title}</div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-right text-xs font-medium text-slate-500">{meta}</div>
      </div>

      <svg
        viewBox="0 0 340 178"
        className="mt-1.5 h-[170px] w-full overflow-visible sm:mt-3 sm:h-[220px]"
        role="img"
        aria-label={`${title} estimated levels`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.22" />
            <stop offset="55%" stopColor={tone} stopOpacity="0.08" />
            <stop offset="100%" stopColor={tone} stopOpacity="0.015" />
          </linearGradient>
        </defs>

        {[40, 70, 100, 130].map((y) => (
          <line key={`grid-y-${y}`} x1="36" y1={y} x2="314" y2={y} stroke="#e2e8f0" strokeOpacity="0.65" />
        ))}
        {[36, 106, 176, 246, 314].map((x) => (
          <line key={`grid-x-${x}`} x1={x} y1="28" x2={x} y2="132" stroke="#e2e8f0" strokeOpacity="0.45" />
        ))}
        {[maxPercent, maxPercent * 0.75, maxPercent * 0.5, maxPercent * 0.25, 0].map((value, index) => (
          <text key={`${title}-axis-${index}`} x="6" y={37 + index * 24} className="fill-slate-400 text-[10px]">
            {`${Math.round(value)}%`}
          </text>
        ))}
        {axisLabels.map((label, index) => (
          <text key={`${label}-${index}`} x={36 + index * 69.5} y="154" textAnchor="middle" className="fill-slate-500 text-[11px]">
            {label}
          </text>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={path} fill="none" stroke={tone} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />

        {nowX !== null ? (
          <>
            <line x1={nowX} y1="16" x2={nowX} y2="139" stroke="#334155" strokeDasharray="4 4" strokeWidth="1.1" />
            <text x={Math.min(nowX + 5, 290)} y="28" className="fill-slate-800 text-[11px] font-semibold">
              Now
            </text>
          </>
        ) : null}

        {dots.map((dot) => (
          <g key={dot.key}>
            <line x1={dot.x} y1={dot.y} x2={dot.x} y2="132" stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity="0.7" />
            <circle cx={dot.x} cy={dot.y} r="5.5" fill={tone} stroke="#fff" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </section>
  );
}

function daysUntil(dueISO?: string | null) {
  if (!dueISO) return null;
  const today = new Date();
  const due = new Date(dueISO + "T00:00:00");
  const ms = due.getTime() - new Date(today.toDateString()).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function urgencyScore(
  t: {
  due?: string | null;
  deadlineMode?: DeadlineMode;
  visionHorizon?: VisionHorizon | null;
  durationHrs?: number | null;
  difficulty?: number | null;
  priority?: Priority;
  mode?: "practice" | "task";
  lastPracticedAt?: number | string;
  },
  weights: AttentionWeights = DEFAULT_ATTENTION_WEIGHTS
) {
  const d = daysUntil(t.due);
  const dur = t.durationHrs ?? 0;
  const diff = t.difficulty ?? 1;
  // adjust difficulty

if (t.mode === "practice") {
  const last =
    typeof t.lastPracticedAt === "string"
      ? daysUntil(t.lastPracticedAt)
      : 30;

  return clamp(last * 3, 0, 60);
}


  // adjust priority
  const priorityScore =
  t.priority === "high" ? 100 : t.priority === "normal" ? 50 : 10;

  // time pressure: 0..70
  const visionPressure =
    t.deadlineMode === "vision"
      ? t.visionHorizon === "short"
        ? 30
        : t.visionHorizon === "mid"
          ? 15
          : t.visionHorizon === "long"
            ? 7
            : 0
      : 0;
  const timePressure =
    d === null
      ? visionPressure
      : d <= 3
      ? 80
      : d >= 14
      ? 5
      : clamp((14 - d) * 7, 5, 80);

  // workload: 0..20 (cap at 6h)
  const workload = clamp((dur / 6) * 20, 0, 20);

  // difficulty: 0..10
  const difficultyScore = clamp(((diff - 1) / 4) * 10, 0, 10);

  const totalWeight =
  weights.time + FIXED_PRIORITY_WEIGHT + weights.duration + weights.difficulty || 1;

const weightedScore =
  (timePressure * weights.time +
    priorityScore * FIXED_PRIORITY_WEIGHT +
    workload * weights.duration +
    difficultyScore * weights.difficulty) /
  totalWeight;

return clamp(weightedScore, 0, 100);
}

function daysBetweenISODates(startISO: string, endISO: string) {
  if (!isValidISODate(startISO) || !isValidISODate(endISO)) return null;
  const start = new Date(startISO + "T00:00:00").getTime();
  const end = new Date(endISO + "T00:00:00").getTime();
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

function resolveAttentionEffort(task: Task) {
  const explicitEffortLevel = task.effortLevel ?? null;
  const legacyDurationHrs =
    task.durationHrs == null || !Number.isFinite(task.durationHrs) ? null : task.durationHrs;
  const legacyEffortLevel = explicitEffortLevel ? null : inferredEffortLevel(legacyDurationHrs);
  const resolvedEffortLevel = explicitEffortLevel ?? legacyEffortLevel;
  const effortSource = explicitEffortLevel ? "explicit" : legacyEffortLevel ? "legacy-duration" : "none";
  const effortFactor = resolvedEffortLevel ? EFFORT_RUNWAY_FACTORS[resolvedEffortLevel] : 0;

  return {
    explicitEffortLevel,
    resolvedEffortLevel,
    effortSource,
    legacyDurationHrs,
    effortFactor,
  };
}

function cadenceStatsForTask(task: Task, timeLogs: TimeLog[]) {
  const today = todayISO();
  const createdAtDate = Number.isFinite(task.createdAt) ? new Date(task.createdAt) : null;
  const taskCreatedDate = createdAtDate
    ? new Date(Date.UTC(
        createdAtDate.getFullYear(),
        createdAtDate.getMonth(),
        createdAtDate.getDate()
      )).toISOString().slice(0, 10)
    : null;
  const daysSinceTaskCreated = taskCreatedDate ? daysBetweenISODates(taskCreatedDate, today) : null;
  const taskLogs = timeLogs.filter((log) => log.taskId === task.id && isValidISODate(log.date) && isClosedTimeLog(log));
  const lastWorkedDate = taskLogs.reduce<string | null>(
    (latest, log) => (!latest || log.date > latest ? log.date : latest),
    null
  );
  const daysSinceLastWorked = lastWorkedDate ? daysBetweenISODates(lastWorkedDate, today) : null;

  function hoursSince(days: number) {
    const start = addDaysISO(today, -(days - 1));
    return taskLogs
      .filter((log) => log.date >= start && log.date <= today)
      .reduce((sum, log) => sum + (log.hours ?? 0), 0);
  }

  const hoursLast7Days = hoursSince(7);
  const hoursLast14Days = hoursSince(14);
  const hoursLast30Days = hoursSince(30);
  const hasFixedDeadline = Boolean(task.due);
  const horizonCadenceDays =
    task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 5
        : task.visionHorizon === "mid"
          ? 10
          : task.visionHorizon === "long"
            ? 18
            : 21
      : hasFixedDeadline
        ? 21
        : 21;
  const priorityCadenceMultiplier =
    task.priority === "high" ? 0.65 : task.priority === "low" ? 1.45 : 1;
  const expectedCadenceDays = horizonCadenceDays * priorityCadenceMultiplier;
  const expectedHours14 =
    (task.priority === "high" ? 6 : task.priority === "low" ? 1.5 : 3) +
    (task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 2
        : task.visionHorizon === "mid"
          ? 1
          : task.visionHorizon === "long"
            ? 0.5
            : 0
      : 0);
  const recentCoverage = clamp(hoursLast14Days / expectedHours14, 0, 1);
  const recentHoursMultiplier = 1 - recentCoverage * 0.65;
  const neverWorkedInitialPressure =
    (task.priority === "high" ? 12 : task.priority === "normal" ? 7 : 3) +
    (task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 5
        : task.visionHorizon === "mid"
          ? 3
          : task.visionHorizon === "long"
            ? 1
            : 0
      : 0);
  const neverWorkedMaturityMax = task.priority === "high" ? 16 : task.priority === "normal" ? 12 : 6;
  const neverWorkedMaturityPressure =
    !lastWorkedDate && !hasFixedDeadline && daysSinceTaskCreated !== null
      ? neverWorkedMaturityMax * (1 - Math.exp(-daysSinceTaskCreated / 28))
      : 0;
  const neverWorkedBasePressure = neverWorkedInitialPressure + neverWorkedMaturityPressure;
  const neglectPressure = lastWorkedDate
    ? 100 * (1 - Math.exp(-(daysSinceLastWorked ?? 0) / (expectedCadenceDays * 1.4)))
    : clamp(neverWorkedBasePressure, 0, 35);
  const fixedDeadlineDamping = hasFixedDeadline ? 0.45 : 1;
  const priorityCap = task.priority === "low" ? 45 : task.priority === "normal" ? 75 : 90;
  const cadencePressureBeforeActivity = clamp(
    neglectPressure * recentHoursMultiplier * fixedDeadlineDamping,
    0,
    priorityCap
  );
  const activityCadenceMultiplier =
    task.activityType === "correspondence"
      ? task.priority === "high" || task.visionHorizon === "short"
        ? 0.65
        : 0.35
      : task.activityType === "activity"
        ? 1
        : task.activityType === "uni_work"
          ? 0.9
          : 1;
  const cadencePressure = clamp(
    cadencePressureBeforeActivity * activityCadenceMultiplier,
    0,
    priorityCap
  );

  return {
    taskCreatedDate,
    daysSinceTaskCreated,
    lastWorkedDate,
    daysSinceLastWorked,
    hoursLast7Days,
    hoursLast14Days,
    hoursLast30Days,
    hasEverBeenWorked: taskLogs.length > 0,
    neverWorkedMaturityPressure,
    neverWorkedBasePressure: lastWorkedDate ? 0 : clamp(neverWorkedBasePressure, 0, 35),
    activityCadenceMultiplier,
    cadencePressureBeforeActivity,
    cadencePressure,
  };
}

function attentionScoreV2(task: Task, timeLogs: TimeLog[] = []) {
  const days = daysUntil(task.due);
  const hasFixedDeadline = days !== null;
  const effectiveDays = days === null ? null : Math.max(0, days);
  const deadlinePressure = hasFixedDeadline
    ? effectiveDays === 0
      ? 100
      : 100 / (1 + Math.pow(effectiveDays / 24, 1.65))
    : 0;
  const deadlineContribution = deadlinePressure * 0.5;
  const intrinsicImportance =
    task.priority === "high" ? 24 : task.priority === "normal" ? 16 : 6;
  const effort = resolveAttentionEffort(task);
  const startPressure =
    hasFixedDeadline && effort.effortFactor > 0
      ? clamp(
          (effort.effortFactor / (Math.pow(Math.max(effectiveDays ?? 0, 0.5), 0.85) + effort.effortFactor)) * 100,
          0,
          100
        )
      : 0;
  const startContribution = startPressure * 0.3;
  const horizonPressure = hasFixedDeadline
    ? 0
    : task.deadlineMode === "vision"
      ? task.visionHorizon === "short"
        ? 12
        : task.visionHorizon === "mid"
          ? 7
          : task.visionHorizon === "long"
            ? 3
            : 0
      : 0;
  const contextModifier = 0;
  const cadence = cadenceStatsForTask(task, timeLogs);
  const cadenceContribution = cadence.cadencePressure * 0.22;
  const rawScore = clamp(
    deadlineContribution +
      intrinsicImportance +
      startContribution +
      horizonPressure +
      contextModifier +
      cadenceContribution,
    0,
    100
  );

  return {
    currentDaysUntilDeadline: days,
    deadlinePressure,
    deadlineContribution,
    intrinsicImportance,
    ...effort,
    startPressure,
    startContribution,
    horizonPressure,
    contextModifier,
    ...cadence,
    cadenceContribution,
    rawScore,
    displayedScore: Math.round(rawScore),
  };
}

type AttentionV2Result = ReturnType<typeof attentionScoreV2>;

function deadlineAttentionReason(days: number | null) {
  if (days === null) return null;
  if (days < 0) return "Deadline overdue";
  if (days <= 1) return "Deadline imminent";
  if (days <= 14) return "Deadline approaching";
  if (days <= 60) return "Deadline pressure building";
  return "Deadline still distant";
}

function horizonAttentionReason(task: Task) {
  if (task.deadlineMode !== "vision") return null;
  if (task.visionHorizon === "short") return "Short-term focus";
  if (task.visionHorizon === "mid") return "Mid-term focus";
  if (task.visionHorizon === "long") return "Long-term background goal";
  return null;
}

function getAttentionReasons(task: Task, v2: AttentionV2Result) {
  const candidates: { text: string; weight: number }[] = [];
  const deadlineReason = deadlineAttentionReason(v2.currentDaysUntilDeadline);

  if (task.priority === "high") {
    candidates.push({ text: "High priority", weight: 95 });
  }

  if (deadlineReason && v2.deadlineContribution > 0) {
    const deadlineWeight =
      v2.currentDaysUntilDeadline !== null && v2.currentDaysUntilDeadline <= 14
        ? 90
        : v2.currentDaysUntilDeadline !== null && v2.currentDaysUntilDeadline <= 60
          ? 82
          : 45;
    candidates.push({ text: deadlineReason, weight: deadlineWeight });
  }

  if (v2.startContribution >= 2.5 && v2.resolvedEffortLevel === "extensive") {
    candidates.push({ text: "Extensive work needs runway", weight: 78 });
  } else if (v2.startContribution >= 2) {
    candidates.push({ text: "Larger task needs an earlier start", weight: 70 });
  }

  if (v2.cadenceContribution >= 8 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: `Not worked on for ${v2.daysSinceLastWorked} days`, weight: 88 });
  } else if (v2.cadenceContribution >= 5 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: "Attention overdue", weight: 74 });
  } else if (v2.cadenceContribution >= 3 && v2.daysSinceLastWorked !== null) {
    candidates.push({ text: "Consistency slipping", weight: 58 });
  }

  if (!v2.hasEverBeenWorked && v2.neverWorkedBasePressure >= 12) {
    candidates.push({ text: "Not started yet", weight: 50 });
  }

  const horizonReason = horizonAttentionReason(task);
  if (horizonReason && v2.horizonPressure > 0) {
    const horizonWeight =
      task.visionHorizon === "short" ? 76 : task.visionHorizon === "mid" ? 62 : 46;
    candidates.push({ text: horizonReason, weight: horizonWeight });
  }

  if (v2.hoursLast7Days >= 3) {
    candidates.push({ text: "Well covered recently", weight: 35 });
  } else if (v2.hoursLast14Days >= 3 && v2.cadenceContribution < 5) {
    candidates.push({ text: "Worked on recently", weight: 32 });
  }

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .map((candidate) => candidate.text)
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
    .slice(0, 2);
}

function urgencyColour(score: number) {
  if (score >= 85) return "bg-rose-500";
  if (score >= 70) return "bg-orange-400";
  if (score >= 55) return "bg-amber-300";
  if (score >= 35) return "bg-lime-300";
  return "bg-emerald-100";
}

function visualAttentionLevel(score: number) {
  if (score >= 85) return "highest";
  if (score >= 70) return "high";
  if (score >= 55) return "elevated";
  if (score >= 35) return "medium";
  return "low";
}

function visualAttentionScores(rawScores: number[]) {
  if (rawScores.length === 0) return [];

  const min = Math.min(...rawScores);
  const max = Math.max(...rawScores);
  const range = max - min;
  const rangeStrength = clamp((range - 1) / 12, 0, 1);
  const relativeWeight = 0.45 * rangeStrength;
  const absoluteWeight = 1 - relativeWeight;

  return rawScores.map((rawScore) => {
    const absoluteScore = clamp((rawScore / 50) * 100, 0, 100);
    const relativePosition = range > 0 ? clamp((rawScore - min) / range, 0, 1) : 0.5;
    const relativeScore = relativePosition * 100;
    const visualScore = clamp(absoluteScore * absoluteWeight + relativeScore * relativeWeight, 18, 100);

    return {
      relativePosition,
      visualAttentionScore: visualScore,
      visualLevel: visualAttentionLevel(visualScore),
    };
  });
}



/* ----------------------------- UI bits ----------------------------- */

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" }) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-none";
  const cls =
    tone === "red"
      ? `${base} border-red-200 bg-red-50 text-red-700`
      : `${base} border-slate-200 bg-white text-slate-600`;
  return <span className={cls}>{children}</span>;
}

function compactDeadlineLabel(task: Task) {
  if (task.due) {
    const days = daysLeftFromISO(task.due);
    if (days === null) return null;
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return "Today";
    return `${days}d`;
  }

  if (task.deadlineMode === "vision" && task.visionHorizon) {
    return VISION_HORIZONS.find((option) => option.id === task.visionHorizon)?.label ?? null;
  }

  return null;
}

function activityTypeLabel(activityType?: ActivityType) {
  return ACTIVITY_TYPES.find((option) => option.id === activityType)?.label ?? null;
}

function deadlinePillTone(task: Task) {
  if (task.due) {
    const days = daysLeftFromISO(task.due);
    if (days === null) return "bg-rose-50/50 text-rose-500";
    if (days <= 1) return "bg-rose-100/80 text-rose-700";
    if (days <= 3) return "bg-rose-100/70 text-rose-600";
    if (days <= 7) return "bg-rose-50 text-rose-600";
    if (days <= 14) return "bg-rose-50/80 text-rose-500";
    return "bg-rose-50/50 text-rose-400";
  }

  return "bg-rose-50/50 text-rose-500";
}

function activityPillTone(activityType: ActivityType) {
  if (activityType === "correspondence") return "bg-indigo-50/70 text-indigo-500";
  if (activityType === "uni_work") return "bg-emerald-50/70 text-emerald-600";
  return "bg-orange-50/70 text-rose-500";
}

function ActivityTypeIcon({ activityType }: { activityType: ActivityType }) {
  if (activityType === "correspondence") return <Mail className="h-3.5 w-3.5" aria-hidden="true" />;
  if (activityType === "uni_work") return <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "in_progress") return <LoaderCircle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "frozen") return <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />;
  if (status === "completed") return <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === "high") return <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />;
  if (priority === "low") return <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
}

function EffortIcon({ effortLevel }: { effortLevel: EffortLevel }) {
  if (effortLevel === "quick") return <Zap className="h-3.5 w-3.5" aria-hidden="true" />;
  if (effortLevel === "extensive") return <Layers className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Gauge className="h-3.5 w-3.5" aria-hidden="true" />;
}

const CATEGORY_TRAILING_EMOJI_PATTERN = /\s*(?:[\p{Extended_Pictographic}\p{Emoji_Presentation}]\uFE0F?)+\s*$/u;
const CATEGORY_EMOJI_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  "📈": TrendingUp,
  "✉": Mail,
  "❄": Snowflake,
  "🌱": Sprout,
  "💎": Gem,
  "🌳": Sprout,
  "🪲": Activity,
  "🦋": Sparkles,
};

const CATEGORY_ICON_OPTIONS = [
  { value: "📈", label: "Growth", Icon: TrendingUp },
  { value: "✉", label: "Mail", Icon: Mail },
  { value: "❄", label: "Snowflake", Icon: Snowflake },
  { value: "🌱", label: "Sprout", Icon: Sprout },
  { value: "💎", label: "Gem", Icon: Gem },
  { value: "🌳", label: "Nature", Icon: Sprout },
  { value: "🪲", label: "Activity", Icon: Activity },
  { value: "🦋", label: "Sparkles", Icon: Sparkles },
] as const;

function categoryHeaderName(category: Pick<Category, "label">) {
  return category.label.replace(CATEGORY_TRAILING_EMOJI_PATTERN, "").trim() || category.label;
}

function categoryHeaderEmoji(category: Pick<Category, "label" | "emoji">) {
  const savedEmoji = category.emoji.trim();
  if (savedEmoji) return savedEmoji.replace(/\uFE0F/g, "");
  const labelEmoji = category.label.match(CATEGORY_TRAILING_EMOJI_PATTERN)?.[0]?.trim() ?? "";
  return labelEmoji.replace(/\uFE0F/g, "");
}

function categoryHeaderColourClass(colour?: string | null) {
  return CATEGORY_COLOURS.find((option) => option.id === colour)?.swatch ?? CATEGORY_COLOURS[0].swatch;
}

function CategoryIdentity({ category, compact = false }: { category: Category; compact?: boolean }) {
  const Icon = CATEGORY_EMOJI_ICON_MAP[categoryHeaderEmoji(category)] ?? Shapes;

  return (
    <span className={`inline-flex min-w-0 items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full ${compact ? "h-5 w-5" : "h-6 w-6"} ${categoryHeaderColourClass(
          category.colour
        )}`}
        aria-hidden="true"
      >
        <Icon className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-white`} aria-hidden />
      </span>
      <span className="truncate">{categoryHeaderName(category)}</span>
    </span>
  );
}

function plannerEventTone(eventType: CalendarEventType, temporalState: PlannerTemporalState = "future") {
  const temporal = plannerPastSoftening(temporalState);
  const today = temporalState === "today" ? " ring-1 ring-inset ring-slate-900/10" : "";
  if (eventType === "work") return `border-[#5FA9FF]/25 bg-[#5FA9FF]/10 text-[#2D6FAF] ${temporal}${today}`;
  if (eventType === "class") return `border-[#C29EFF]/25 bg-[#C29EFF]/10 text-[#6F4CB8] ${temporal}${today}`;
  if (eventType === "meeting") return `border-[#FCB100]/35 bg-[#FCB100]/12 text-[#9B6900] ${temporal}${today}`;
  if (eventType === "deadline") {
    return `border-[#FE7877]/45 border-l-2 border-l-[#FE7877]/75 bg-[#FE7877]/14 text-[#B33F3E] font-semibold ${temporal}${today}`;
  }
  if (eventType === "milestone") return `border-[#FD925E]/30 bg-[#FD925E]/12 text-[#A94F20] ${temporal}${today}`;
  if (eventType === "personal") return `border-[#88E18E]/30 bg-[#88E18E]/12 text-[#2F7E39] ${temporal}${today}`;
  if (eventType === "travel") return `border-[#04E6F7]/35 bg-[#04E6F7]/12 text-[#067F89] ${temporal}${today}`;
  if (eventType === "date") return `border-[#FC889F]/30 bg-[#FC889F]/12 text-[#AE3E56] ${temporal}${today}`;
  if (eventType === "social") return `border-[#55CDFF]/30 bg-[#55CDFF]/12 text-[#167BA8] ${temporal}${today}`;
  if (eventType === "active") return `border-[#2DCC70]/30 bg-[#2DCC70]/12 text-[#197C45] ${temporal}${today}`;
  return `border-[#8293B9]/30 bg-[#8293B9]/12 text-[#465777] ${temporal}${today}`;
}

function PlannerEventTypeIcon({ eventType }: { eventType: CalendarEventType }) {
  const iconClassName = "h-2.5 w-2.5 text-white";
  const iconProps = { className: iconClassName, strokeWidth: 2.4, "aria-hidden": "true" as const };
  let icon: React.ReactNode;

  if (eventType === "work") icon = <BriefcaseBusiness {...iconProps} />;
  else if (eventType === "class") icon = <GraduationCap {...iconProps} />;
  else if (eventType === "meeting") icon = <Users {...iconProps} />;
  else if (eventType === "deadline") icon = <Flag {...iconProps} />;
  else if (eventType === "milestone") icon = <Diamond {...iconProps} />;
  else if (eventType === "travel") icon = <Plane {...iconProps} />;
  else if (eventType === "date") icon = <Heart {...iconProps} />;
  else if (eventType === "social") icon = <Users {...iconProps} />;
  else if (eventType === "active") icon = <Activity {...iconProps} />;
  else if (eventType === "admin") icon = <FileText {...iconProps} />;
  else icon = <UserRound {...iconProps} />;

  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
      style={{ backgroundColor: PLANNER_EVENT_PALETTE[eventType].color }}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

function TaskMetaPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium leading-none ${className}`}>
      {children}
    </span>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
      {children}
    </div>
  );
}

function DeadlineField({
  due,
  deadlineMode,
  visionHorizon,
  onDateChange,
  onVisionChange,
}: {
  due?: string | null;
  deadlineMode?: DeadlineMode;
  visionHorizon?: VisionHorizon | null;
  onDateChange: (due: string) => void;
  onVisionChange: (horizon: VisionHorizon) => void;
}) {
  return (
    <Field label="Deadline">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1.4fr] sm:items-center">
        <input
          type="date"
          value={deadlineMode === "date" ? due ?? "" : ""}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />
        <div className="hidden text-xs text-slate-300 sm:block">or</div>
        <div className="grid grid-cols-3 gap-2">
          {VISION_HORIZONS.map((option) => {
            const selected = deadlineMode === "vision" && visionHorizon === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onVisionChange(option.id)}
                className={`h-10 rounded-full border px-3 text-xs font-medium transition-colors ${
                  selected
                    ? "border-slate-200 bg-slate-100 text-slate-800"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </Field>
  );
}

function ActivityTypeField({
  value,
  onChange,
}: {
  value?: ActivityType;
  onChange: (value: ActivityType | undefined) => void;
}) {
  return (
    <Field label="Activity type">
      <div className="grid gap-2 sm:grid-cols-3">
        {ACTIVITY_TYPES.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(selected ? undefined : option.id)}
              className={`h-10 rounded-full border px-3 text-xs font-medium transition-colors ${
                selected
                  ? "border-slate-200 bg-slate-100 text-slate-800"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <ActivityTypeIcon activityType={option.id} />
                <span>{option.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function inferredEffortLevel(durationHrs?: number | null): EffortLevel | null {
  if (durationHrs == null || !Number.isFinite(durationHrs)) return null;
  if (durationHrs <= 1) return "quick";
  if (durationHrs <= 4) return "moderate";
  return "extensive";
}

function taskDisplayEffortLevel(task: Task): EffortLevel | null {
  return task.effortLevel ?? inferredEffortLevel(task.durationHrs);
}

function effortLabel(value?: EffortLevel | null) {
  return EFFORT_LEVELS.find((option) => option.id === value)?.label ?? "—";
}

function effortRank(value?: EffortLevel | null) {
  if (value === "quick") return 0;
  if (value === "moderate") return 1;
  if (value === "extensive") return 2;
  return 999999;
}

function EffortLevelField({
  value,
  suggestedValue,
  onChange,
}: {
  value?: EffortLevel | null;
  suggestedValue?: EffortLevel | null;
  onChange: (value: EffortLevel) => void;
}) {
  const displayedValue = value ?? suggestedValue ?? null;

  return (
    <Field label="Effort">
      <IconSelectBox<EffortLevel>
        value={displayedValue}
        onChange={onChange}
        options={EFFORT_LEVELS}
        renderIcon={(effortLevel) => <EffortIcon effortLevel={effortLevel} />}
      />
    </Field>
  );
}

function IconSelectBox<T extends string>({
  value,
  onChange,
  options,
  renderIcon,
}: {
  value?: T | null;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  renderIcon: (value: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.id === value) ?? null;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-slate-200"
      >
        {selected ? <span className="shrink-0 text-slate-400">{renderIcon(selected.id)}</span> : null}
        <span className="min-w-0 truncate">{selected?.label ?? "—"}</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-[1000] mt-1 w-full min-w-[132px] overflow-hidden rounded-[16px] border border-slate-200 bg-white py-1 text-sm shadow-xl ring-1 ring-slate-900/5">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50 ${
                option.id === value ? "text-slate-900" : "text-slate-600"
              }`}
            >
              <span className="shrink-0 text-slate-400">{renderIcon(option.id)}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectBox<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ----------------------------- Main ----------------------------- */

export default function MinimalTaskTracker() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [medicationEntries, setMedicationEntries] = useState<MedicationEntry[]>([]);
  const [alcoholEntries, setAlcoholEntries] = useState<AlcoholEntry[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  const [timeLogsLoaded, setTimeLogsLoaded] = useState(false);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const taskStoreRef = useRef<TaskStore | null>(null);
  const hasLoadedFromStore = useRef(false);
  const remoteLoadTrustedForDeleteRef = useRef(false);
  const allowNextEmptySaveRef = useRef(false);
  const allowNextDestructiveSaveRef = useRef(false);
  const deletedTaskIdsRef = useRef<string[]>([]);
  const skipNextTaskSaveRef = useRef(false);
  const skipNextTimeLogSaveRef = useRef(false);
  const timeLogsRef = useRef(timeLogs);
  const [mode, setMode] = useState<ViewMode>("board");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [plannerView, setPlannerView] = useState<PlannerView>("week");
  const [plannerAnchorDate, setPlannerAnchorDate] = useState<string>("");
  const [plannerMobileSelectedDate, setPlannerMobileSelectedDate] = useState<string>("");
  const [plannerEventModalOpen, setPlannerEventModalOpen] = useState(false);
  const [plannerEventModalMode, setPlannerEventModalMode] = useState<PlannerEventModalMode>("create");
  const [plannerEventDraft, setPlannerEventDraft] = useState<PlannerEventDraft | null>(null);
  const [plannerEventMoreDetailsOpen, setPlannerEventMoreDetailsOpen] = useState(false);
  const [plannerEventTypeChooserOpen, setPlannerEventTypeChooserOpen] = useState(false);
  const [plannerEventSaving, setPlannerEventSaving] = useState(false);
  const [plannerEventError, setPlannerEventError] = useState<string | null>(null);
  const [plannerInteraction, setPlannerInteraction] = useState<PlannerWeekInteraction | null>(null);
  const [plannerWorkActionSavingId, setPlannerWorkActionSavingId] = useState<string | null>(null);
  const [plannerLogSourceEventId, setPlannerLogSourceEventId] = useState<string | null>(null);
  const [smartImportOpen, setSmartImportOpen] = useState(false);
  const [smartImportRaw, setSmartImportRaw] = useState("");
  const [smartImportProposals, setSmartImportProposals] = useState<SmartImportProposal[]>([]);
  const [smartImportSaving, setSmartImportSaving] = useState(false);
  const [smartImportMessage, setSmartImportMessage] = useState<string | null>(null);
  const [medsView, setMedsView] = useState<MedsView>("today");
  const [medsDetailsOpen, setMedsDetailsOpen] = useState(false);
  const [medsEntryLauncherOpen, setMedsEntryLauncherOpen] = useState(false);
  const [medsModalMode, setMedsModalMode] = useState<MedicationModalMode | null>(null);
  const [medsSaving, setMedsSaving] = useState(false);
  const [medsError, setMedsError] = useState<string | null>(null);
  const [editingMedicationEntry, setEditingMedicationEntry] = useState<MedicationEntry | null>(null);
  const [medsDeleteConfirm, setMedsDeleteConfirm] = useState(false);
  const [doseMedicationKind, setDoseMedicationKind] = useState<MedicationKind>("Vyvanse");
  const [doseCustomMedication, setDoseCustomMedication] = useState("");
  const [doseAmount, setDoseAmount] = useState("");
  const [doseUnit, setDoseUnit] = useState("mg");
  const [doseWhenMode, setDoseWhenMode] = useState<"now" | "manual">("now");
  const [doseDate, setDoseDate] = useState("");
  const [doseTime, setDoseTime] = useState("");
  const [feelingDefinitions, setFeelingDefinitions] = useState<FeelingDefinition[]>(DEFAULT_FEELING_DEFINITIONS);
  const [feelingDefinitionsEntryId, setFeelingDefinitionsEntryId] = useState<string | null>(null);
  const [selectedFeelingLogs, setSelectedFeelingLogs] = useState<Record<string, SelectedFeelingLog>>({});
  const [feelingManageOpen, setFeelingManageOpen] = useState(false);
  const [customFeelingOpen, setCustomFeelingOpen] = useState(false);
  const [newFeelingName, setNewFeelingName] = useState("");
  const [newFeelingIcon, setNewFeelingIcon] = useState<FeelingIconKey>("smile");
  const [newFeelingValence, setNewFeelingValence] = useState<FeelingValenceStable>("good");
  const [newFeelingCategory, setNewFeelingCategory] = useState<FeelingCategory>("state");
  const [feelingWhenMode, setFeelingWhenMode] = useState<"now" | "manual">("now");
  const [feelingDate, setFeelingDate] = useState("");
  const [feelingTime, setFeelingTime] = useState("");
  const [medsHistoryFilter, setMedsHistoryFilter] = useState<"all" | "Vyvanse" | "Prozac" | "Coffee" | "alcohol" | "feelings">("all");
  const [medsLevelRange, setMedsLevelRange] = useState<MedsLevelRange>("24h");
  const [medsRangeOffset, setMedsRangeOffset] = useState(0);
  const [caffeineDrinkId, setCaffeineDrinkId] = useState<CaffeineDrinkId>("iced_latte");
  const [caffeineSize, setCaffeineSize] = useState<"S" | "M" | "L">("M");
  const [caffeineMg, setCaffeineMg] = useState("120");
  const [caffeineWhenMode, setCaffeineWhenMode] = useState<"now" | "manual">("now");
  const [caffeineDate, setCaffeineDate] = useState("");
  const [caffeineTime, setCaffeineTime] = useState("");
  const [caffeineNote, setCaffeineNote] = useState("");
  const [alcoholDraftId, setAlcoholDraftId] = useState<string | null>(null);
  const [alcoholDrinkType, setAlcoholDrinkType] = useState<AlcoholDrinkType>("Wine");
  const [alcoholQuantity, setAlcoholQuantity] = useState("1");
  const [alcoholServingSizeMl, setAlcoholServingSizeMl] = useState("");
  const [alcoholAbvPercent, setAlcoholAbvPercent] = useState("");
  const [alcoholStartedAt, setAlcoholStartedAt] = useState("");
  const [alcoholEndedAt, setAlcoholEndedAt] = useState("");
  const alcoholQuantityValue = Number(alcoholQuantity);
  const alcoholServingSizeValue = Number(alcoholServingSizeMl);
  const alcoholAbvValue = Number(alcoholAbvPercent);
  const estimatedAlcoholUnits =
    alcoholQuantityValue > 0 && alcoholServingSizeValue > 0 && alcoholAbvValue > 0
      ? (alcoholQuantityValue * alcoholServingSizeValue * alcoholAbvValue) / 1000
      : null;
  const [backupStatus, setBackupStatus] = useState({ label: "—", count: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [attentionCategoryMenuOpen, setAttentionCategoryMenuOpen] = useState(false);
  const [attentionCategoryExcludedIds, setAttentionCategoryExcludedIds] = useState<string[]>([]);
  const [expandedDashboardCategoryIds, setExpandedDashboardCategoryIds] = useState<string[]>([]);

const [weights, setWeights] = useState(() => {
  if (typeof window === "undefined") {
    return DEFAULT_ATTENTION_WEIGHTS;
  }

  const saved = localStorage.getItem("attentionWeights");

  return saved
    ? normalizeAttentionWeights(JSON.parse(saved))
    : DEFAULT_ATTENTION_WEIGHTS;
});

useEffect(() => {
  localStorage.setItem("attentionWeights", JSON.stringify(weights));
}, [weights]);

  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEmoji, setCategoryEmoji] = useState("");
  const [categoryColour, setCategoryColour] = useState<string>("slate");
  const [categorySaving, setCategorySaving] = useState(false);

  // New task modal state
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCourseId, setNewCourseId] = useState<string>(fallbackCategories[0]?.id ?? "");
  const [newStatus, setNewStatus] = useState<Status>("to_do");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newDue, setNewDue] = useState<string>("");
  const [newDeadlineMode, setNewDeadlineMode] = useState<DeadlineMode | undefined>(undefined);
  const [newVisionHorizon, setNewVisionHorizon] = useState<VisionHorizon | null>(null);
  const [newActivityType, setNewActivityType] = useState<ActivityType | undefined>(undefined);
  const [newEffortLevel, setNewEffortLevel] = useState<EffortLevel>("moderate");
  const [newDifficulty, setNewDifficulty] = useState<string>("3");
  const [newNotes, setNewNotes] = useState<string>("");

  // Time log modal state
  const [logOpen, setLogOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logTaskId, setLogTaskId] = useState<string>("");
  const [logDate, setLogDate] = useState<string>("");
  const [logStartTime, setLogStartTime] = useState<string>("");
  const [logEndDate, setLogEndDate] = useState<string>("");
  const [logEndTime, setLogEndTime] = useState<string>("");
  const [logHoursInput, setLogHoursInput] = useState<string>("");
  const [logNote, setLogNote] = useState<string>("");
  const [logSaving, setLogSaving] = useState(false);
  const [endingOpenLogId, setEndingOpenLogId] = useState<string | null>(null);
  const [deletingTimeLogId, setDeletingTimeLogId] = useState<string | null>(null);
  const [loggerActionError, setLoggerActionError] = useState<string | null>(null);
  const [loggerTaskFilter, setLoggerTaskFilter] = useState<string>("all");
  const [loggerValueMode, setLoggerValueMode] = useState<LoggerValueMode>("hours");
  const [loggerRangeMode, setLoggerRangeMode] = useState<LoggerRangeMode>("month");
  const [loggerBreakdownMode, setLoggerBreakdownMode] = useState<LoggerBreakdownMode>("tasks");
  const [loggerBreakdownExpanded, setLoggerBreakdownExpanded] = useState(false);
  const [loggerDetailsOpen, setLoggerDetailsOpen] = useState(false);
  const [loggerAnchorDate, setLoggerAnchorDate] = useState<string>("");
  const [loggerMobileSelectedDate, setLoggerMobileSelectedDate] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [clientToday, setClientToday] = useState<string>("");
  const [clientNowMs, setClientNowMs] = useState<number>(0);
  const loggerGridScrollRef = useRef<HTMLDivElement | null>(null);
  const loggerMonthActivityScrollRef = useRef<HTMLDivElement | null>(null);
  const plannerWeekScrollRef = useRef<HTMLDivElement | null>(null);
  const suppressPlannerEventClickRef = useRef(false);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<Task | null>(null);
  const [editingPlannerTaskDeadline, setEditingPlannerTaskDeadline] = useState(false);

  // List sorting
  const [listSortKey, setListSortKey] = useState<
    "title" | "course" | "status" | "priority" | "due" | "timeLeft" | "effort" | "difficulty"
  >("due");
  const [listSortDir, setListSortDir] = useState<"asc" | "desc">("asc");
  const [openStatusTaskId, setOpenStatusTaskId] = useState<string | null>(null);
  const [openListFilter, setOpenListFilter] = useState<ListFilterMenu | null>(null);
  const [mobileTaskFiltersOpen, setMobileTaskFiltersOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState<Status[]>([]);
  const [priorityFilters, setPriorityFilters] = useState<Priority[]>([]);
  const [difficultyFilters, setDifficultyFilters] = useState<string[]>([]);
  const [timeLeftFilter, setTimeLeftFilter] = useState<{ min: number; max: number } | null>(null);

  // Attention score toggles
  const [scoreUseTime, setScoreUseTime] = useState(true);
  const [scoreUsePriority, setScoreUsePriority] = useState(true);
  const [scoreUseDuration, setScoreUseDuration] = useState(true);
  const [scoreUseDifficulty, setScoreUseDifficulty] = useState(true);

  const searchRef = useRef<HTMLInputElement | null>(null);

useEffect(() => {
  queueMicrotask(() => {
    setHasMounted(true);

    const today = todayISO();
    setClientToday(today);
    setClientNowMs(Date.now());
    setPlannerAnchorDate(today);
    setLoggerAnchorDate(today);
    setCustomStartDate(today);
    setCustomEndDate(today);
    setLogDate(today);
    setLogEndDate(today);
    setDoseDate(today);
    setFeelingDate(today);
    setDoseTime(timeInputFromTimestamp(new Date().toISOString()));
    setFeelingTime(timeInputFromTimestamp(new Date().toISOString()));
    setMode(storedTabToMode(localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)));
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true");
    setSidebarPreferenceLoaded(true);
    setBackupStatus(getLatestLocalBackupLabel());

    const savedAttentionCategoryScope = localStorage.getItem(ATTENTION_CATEGORY_SCOPE_KEY);
    if (savedAttentionCategoryScope) {
      try {
        const parsed = JSON.parse(savedAttentionCategoryScope);
        if (Array.isArray(parsed)) {
          setAttentionCategoryExcludedIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      } catch (error) {
        console.warn("Could not load Attention Score category scope:", error);
      }
    }

    void (async () => {
      const remoteLogs = await loadTimeLogs(SYNC_CODE);

      if (remoteLogs.ok) {
        timeLogsRef.current = remoteLogs.logs;
        skipNextTimeLogSaveRef.current = true;
        setTimeLogs(remoteLogs.logs);
        localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(remoteLogs.logs));
        setTimeLogsLoaded(true);
        return;
      }

      console.warn("Supabase time log load failed. Falling back to local Logger cache.");
      const savedLogs = localStorage.getItem(TIME_LOGS_STORAGE_KEY);
      if (savedLogs) {
        try {
          const restoredLogs = normalizeTimeLogs(JSON.parse(savedLogs));
          timeLogsRef.current = restoredLogs;
          skipNextTimeLogSaveRef.current = true;
          setTimeLogs(restoredLogs);
        } catch (error) {
          console.error("Error loading local cached time logs:", error);
        }
      }
      setTimeLogsLoaded(true);
    })();

    void (async () => {
      const remoteEvents = await loadCalendarEvents(SYNC_CODE);

      if (remoteEvents.ok) {
        setCalendarEvents(remoteEvents.events);
        return;
      }

      console.warn("Supabase calendar event load failed. Preserving current Planner event state.");
    })();

    void (async () => {
      const remoteMedicationEntries = await loadMedicationEntries(SYNC_CODE);

      if (remoteMedicationEntries.ok) {
        setMedicationEntries(remoteMedicationEntries.entries);
        return;
      }

      console.warn("Supabase medication entry load failed. Preserving current Meds state.");
    })();

    void (async () => {
      const remoteAlcoholEntries = await loadAlcoholEntries(SYNC_CODE);

      if (remoteAlcoholEntries.ok) {
        setAlcoholEntries(remoteAlcoholEntries.entries);
        return;
      }

      console.warn("Supabase alcohol entry load failed. Preserving current Alcohol state.");
    })();
  });
}, []);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, modeToStoredTab(mode));
}, [hasMounted, mode]);

useEffect(() => {
  if (!hasMounted || !sidebarPreferenceLoaded) return;
  localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? "true" : "false");
}, [hasMounted, sidebarCollapsed, sidebarPreferenceLoaded]);

useEffect(() => {
  if (!hasMounted) return;
  localStorage.setItem(ATTENTION_CATEGORY_SCOPE_KEY, JSON.stringify(attentionCategoryExcludedIds));
}, [attentionCategoryExcludedIds, hasMounted]);

useEffect(() => {
  if (mode !== "list") setOpenStatusTaskId(null);
}, [mode]);

useEffect(() => {
  if (!openStatusTaskId) return;

  function closeStatusDropdown() {
    setOpenStatusTaskId(null);
  }

  document.addEventListener("click", closeStatusDropdown);
  return () => document.removeEventListener("click", closeStatusDropdown);
}, [openStatusTaskId]);

useEffect(() => {
  if (mode !== "list") setOpenListFilter(null);
  if (mode !== "list") setMobileTaskFiltersOpen(false);
}, [mode]);

useEffect(() => {
  if (!openListFilter) return;

  function closeListFilter() {
    setOpenListFilter(null);
  }

  document.addEventListener("click", closeListFilter);
  return () => document.removeEventListener("click", closeListFilter);
}, [openListFilter]);

useEffect(() => {
  if (!attentionCategoryMenuOpen) return;

  function closeAttentionCategoryMenu() {
    setAttentionCategoryMenuOpen(false);
  }

  document.addEventListener("click", closeAttentionCategoryMenu);
  return () => document.removeEventListener("click", closeAttentionCategoryMenu);
}, [attentionCategoryMenuOpen]);

useEffect(() => {
  let cancelled = false;

  async function fetchCategories() {
    const loaded = await loadCategories(SYNC_CODE);
    if (cancelled) return;

    if (!loaded.ok || loaded.categories.length === 0) {
      console.warn("Using app/courses.ts category fallback.");
      return;
    }

    setCategories(loaded.categories);
  }

  void fetchCategories();

  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  let cancelled = false;

  async function fetchTasks() {
    const store = await getTaskStore();
    if (cancelled) return;

    taskStoreRef.current = store;
    const cachedTasks = loadLocalTaskCache();
    const loaded = await store.loadTasks(SYNC_CODE);
    if (cancelled) return;

    if (!loaded.ok) {
      console.warn("Task load failed. Keeping local task state/cache.");
      if (cachedTasks.length > 0) {
        setTasks(cachedTasks);
        hasLoadedFromStore.current = true;
      }
      setTasksLoaded(true);
      return;
    }

    remoteLoadTrustedForDeleteRef.current = loaded.tasks.length > 0;
    if (!isDemoMode && loaded.tasks.length === 0) {
      console.warn("Remote task load returned empty. Local cached tasks were not overwritten.");
      if (cachedTasks.length > 0) {
        setTasks(cachedTasks);
        hasLoadedFromStore.current = true;
        setTasksLoaded(true);
        return;
      }
    }

    skipNextTaskSaveRef.current = true;
    setTasks(loaded.tasks);
    saveLocalTaskCache(loaded.tasks);
    hasLoadedFromStore.current = true;
    setTasksLoaded(true);
  }

  fetchTasks();

  return () => {
    cancelled = true;
  };
}, []);

function refreshBackupStatus() {
  setBackupStatus(getLatestLocalBackupLabel());
}

useEffect(() => {
  if (!tasksLoaded) return;
  if (skipNextTaskSaveRef.current) {
    skipNextTaskSaveRef.current = false;
    return;
  }

  const allowEmptyOverwrite = allowNextEmptySaveRef.current;
  const allowDestructiveSave = allowNextDestructiveSaveRef.current;
  allowNextEmptySaveRef.current = false;
  allowNextDestructiveSaveRef.current = false;

  async function persistTasks() {
    saveLocalTaskCache(tasks);
    const deletedTaskIds = deletedTaskIdsRef.current;

    const store = taskStoreRef.current ?? (await getTaskStore());
    taskStoreRef.current = store;

    console.info("persistTasks triggered", {
      taskCount: tasks.length,
      deletedTaskIds,
      syncCode: SYNC_CODE,
      sampleTask: tasks[0]
        ? {
            id: tasks[0].id,
            title: tasks[0].title,
            courseId: tasks[0].courseId,
            status: tasks[0].status,
            priority: tasks[0].priority,
          }
        : null,
    });

    const saved = await store.saveTasks(tasks, {
      syncCode: SYNC_CODE,
      timeLogs: timeLogsRef.current,
      allowEmptyOverwrite,
      allowDeleteAll: remoteLoadTrustedForDeleteRef.current || allowEmptyOverwrite || allowDestructiveSave,
      deletedTaskIds,
      onLocalBackup: (backupTasks, backupTimeLogs) => {
        createLocalBackup(backupTasks, backupTimeLogs);
        refreshBackupStatus();
      },
    });

    console.info("persistTasks saveTasks returned", { saved });

    if (saved && deletedTaskIds.length > 0) {
      deletedTaskIdsRef.current = deletedTaskIdsRef.current.filter((id) => !deletedTaskIds.includes(id));
    }

    if (!saved) {
      console.warn("Task save failed. Local task cache was kept, but Supabase was not updated.", {
        taskCount: tasks.length,
        deletedTaskIds,
      });
    }
  }

  void persistTasks();
}, [tasks, tasksLoaded]);

useEffect(() => {
  timeLogsRef.current = timeLogs;
  if (!timeLogsLoaded) return;
  if (skipNextTimeLogSaveRef.current) {
    skipNextTimeLogSaveRef.current = false;
    return;
  }
  localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(timeLogs));
}, [timeLogs, timeLogsLoaded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const isTyping =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable);

      if (isTyping) return;

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }

      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setNewOpen(true);
      }

      if (e.key === "Escape") {
        setNewOpen(false);
        setEditOpen(false);
        setEditingPlannerTaskDeadline(false);
        setLogOpen(false);
        setCategoryModalOpen(false);
        setEditingLogId(null);
        resetCategoryDraft();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCategories = useMemo(() => {
    const active = categories.filter((category) => !category.archived);
    return categories.length > 0 ? active : fallbackCategories.filter((category) => !category.archived);
  }, [categories]);

  const archivedCategories = useMemo(() => {
    return categories.filter((category) => category.archived);
  }, [categories]);

  const firstCategoryId = activeCategories[0]?.id ?? fallbackCategories[0]?.id ?? "";

  const activeTasks = useMemo(() => tasks.filter((task) => !task.deletedAt), [tasks]);

  const attentionIncludedCategoryIds = useMemo(() => {
    return activeCategories
      .map((category) => category.id)
      .filter((id) => !attentionCategoryExcludedIds.includes(id));
  }, [activeCategories, attentionCategoryExcludedIds]);

  const attentionIncludedCategoryIdSet = useMemo(() => {
    return new Set(attentionIncludedCategoryIds);
  }, [attentionIncludedCategoryIds]);

  function courseLabel(id: string) {
    const category =
      categories.find((item) => item.id === id) ??
      fallbackCategories.find((item) => item.id === id);
    return category ? categoryDisplayLabel(category) : id;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeTasks
      .filter((t) => {
        if (t.status === "completed") return false;
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [activeTasks, query, courseFilter]);

  const completedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeTasks
      .filter((t) => {
        if (!isRecoverableCompleted(t, clientNowMs)) return false;
        if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
        if (statusFilters.length > 0 && !statusFilters.includes("completed")) return false;
        if (priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
        if (difficultyFilters.length > 0 && !difficultyFilters.includes(String(t.difficulty ?? ""))) return false;
        if (!taskMatchesTimeLeftFilter(t, timeLeftFilter)) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const ad = a.completedAt ?? "";
        const bd = b.completedAt ?? "";
        if (ad !== bd) return bd.localeCompare(ad);
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
  }, [activeTasks, clientNowMs, courseFilter, difficultyFilters, priorityFilters, query, statusFilters, timeLeftFilter]);

  const recentlyDeletedTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (!task.deletedAt) return false;
        const deletedMs = new Date(task.deletedAt).getTime();
        if (!Number.isFinite(deletedMs)) return false;
        const ageMs = clientNowMs - deletedMs;
        return ageMs >= 0 && ageMs < RECENTLY_DELETED_DAYS * DAY_MS;
      })
      .slice()
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
  }, [clientNowMs, tasks]);

  const listRows = useMemo(() => {
    const rows = filtered.filter((task) => {
      if (statusFilters.length > 0 && !statusFilters.includes(task.status)) return false;
      if (priorityFilters.length > 0 && !priorityFilters.includes(task.priority)) return false;
      if (difficultyFilters.length > 0 && !difficultyFilters.includes(String(task.difficulty ?? ""))) return false;
      if (!taskMatchesTimeLeftFilter(task, timeLeftFilter)) return false;
      return true;
    });
    const dir = listSortDir === "asc" ? 1 : -1;

    function get(t: Task): string | number {
      switch (listSortKey) {
        case "title":
          return (t.title ?? "").toLowerCase();
        case "course":
          return courseLabel(t.courseId).toLowerCase();
        case "status":
          return statusLabel(t.status).toLowerCase();
        case "priority":
          return priorityRank(t.priority);
        case "due":
          return t.due ?? "9999-12-31";
        case "timeLeft": {
          const d = t.due ? daysLeftFromISO(t.due) : null;
          return d === null ? 999999 : d;
        }
        case "effort":
          return effortRank(taskDisplayEffortLevel(t));
        case "difficulty":
          return t.difficulty == null ? 999999 : Number(t.difficulty);
        default:
          return 0;
      }
    }

    rows.sort((a, b) => {
      const av = get(a);
      const bv = get(b);

      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });

    return rows;
  }, [difficultyFilters, filtered, listSortKey, listSortDir, priorityFilters, statusFilters, timeLeftFilter]);

  const activeTaskFilterCount =
    (courseFilter === "all" ? 0 : 1) +
    statusFilters.length +
    priorityFilters.length +
    difficultyFilters.length +
    (timeLeftFilter ? 1 : 0);

  const closedTimeLogs = useMemo(() => timeLogs.filter(isClosedTimeLog), [timeLogs]);
  const feelingDefinitionsEntry = useMemo(
    () => medicationEntries.find(isFeelingDefinitionsEntry) ?? null,
    [medicationEntries]
  );
  const sortedMedicationEntries = useMemo(() => {
    return medicationEntries
      .filter((entry) => !isFeelingDefinitionsEntry(entry))
      .slice()
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [medicationEntries]);
  useEffect(() => {
    if (!feelingDefinitionsEntry) return;
    setFeelingDefinitionsEntryId(feelingDefinitionsEntry.id);
    setFeelingDefinitions(normalizeFeelingDefinitions(feelingDefinitionsEntry.metadata?.definitions));
  }, [feelingDefinitionsEntry]);
  const todaysMedicationEntries = useMemo(() => {
    const today = clientToday || todayISO();
    return sortedMedicationEntries
      .filter((entry) => medicationLocalDate(entry) === today)
      .slice()
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }, [clientToday, sortedMedicationEntries]);
  const medsVisibleRange = useMemo(
    () => buildMedsRange(medsLevelRange, medsRangeOffset, clientNowMs || Date.now()),
    [clientNowMs, medsLevelRange, medsRangeOffset]
  );
  const vyvanseEntries = useMemo(
    () => sortedMedicationEntries.filter(isVyvanseEntry),
    [sortedMedicationEntries]
  );
  const caffeineEntries = useMemo(
    () => sortedMedicationEntries.filter(isCaffeineEntry),
    [sortedMedicationEntries]
  );
  const vyvanseCurveEntries = useMemo(
    () =>
      vyvanseEntries.filter((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= medsVisibleRange.startMs - VYVANSE_VISUAL_MODEL.visibleHours * 60 * 60 * 1000 &&
          timestamp <= medsVisibleRange.endMs
        );
      }),
    [medsVisibleRange.endMs, medsVisibleRange.startMs, vyvanseEntries]
  );
  const caffeineCurveEntries = useMemo(
    () =>
      caffeineEntries.filter((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return (
          Number.isFinite(timestamp) &&
          timestamp >= medsVisibleRange.startMs - CAFFEINE_VISUAL_MODEL.visibleHours * 60 * 60 * 1000 &&
          timestamp <= medsVisibleRange.endMs
        );
      }),
    [caffeineEntries, medsVisibleRange.endMs, medsVisibleRange.startMs]
  );
  const vyvanseChartSeries = useMemo(
    () =>
      buildMedsCurveSeries({
        entries: vyvanseCurveEntries,
        startMs: medsVisibleRange.startMs,
        endMs: medsVisibleRange.endMs,
        kind: "vyvanse",
      }),
    [medsVisibleRange.endMs, medsVisibleRange.startMs, vyvanseCurveEntries]
  );
  const caffeineChartSeries = useMemo(
    () =>
      buildMedsCurveSeries({
        entries: caffeineCurveEntries,
        startMs: medsVisibleRange.startMs,
        endMs: medsVisibleRange.endMs,
        kind: "caffeine",
      }),
    [caffeineCurveEntries, medsVisibleRange.endMs, medsVisibleRange.startMs]
  );
  const vyvanseChartDots = useMemo(
    () =>
      medChartDots({
        entries: vyvanseEntries,
        startMs: medsVisibleRange.startMs,
        endMs: medsVisibleRange.endMs,
        kind: "vyvanse",
        maxPercent: vyvanseChartSeries.maxPercent,
      }),
    [medsVisibleRange.endMs, medsVisibleRange.startMs, vyvanseChartSeries.maxPercent, vyvanseEntries]
  );
  const caffeineChartDots = useMemo(
    () =>
      medChartDots({
        entries: caffeineEntries,
        startMs: medsVisibleRange.startMs,
        endMs: medsVisibleRange.endMs,
        kind: "caffeine",
        maxPercent: caffeineChartSeries.maxPercent,
      }),
    [caffeineChartSeries.maxPercent, caffeineEntries, medsVisibleRange.endMs, medsVisibleRange.startMs]
  );
  const medsNowX =
    clientNowMs >= medsVisibleRange.startMs && clientNowMs <= medsVisibleRange.endMs
      ? medicationChartX(clientNowMs, medsVisibleRange.startMs, medsVisibleRange.endMs)
      : null;
  const medsAxisLabels = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) =>
        formatMedsRangeTimeLabel(
          medsVisibleRange.startMs + ((medsVisibleRange.endMs - medsVisibleRange.startMs) * index) / 4,
          medsLevelRange
        )
      ),
    [medsLevelRange, medsVisibleRange.endMs, medsVisibleRange.startMs]
  );
  const latestVyvanseInRange = useMemo(
    () =>
      vyvanseEntries.find((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return Number.isFinite(timestamp) && timestamp >= medsVisibleRange.startMs && timestamp <= medsVisibleRange.endMs;
      }) ?? null,
    [medsVisibleRange.endMs, medsVisibleRange.startMs, vyvanseEntries]
  );
  const caffeineTotalInRange = useMemo(
    () =>
      caffeineEntries.reduce((sum, entry) => {
        const timestamp = Date.parse(entry.timestamp);
        if (!Number.isFinite(timestamp) || timestamp < medsVisibleRange.startMs || timestamp > medsVisibleRange.endMs) return sum;
        return sum + (entry.amount ?? 0);
      }, 0),
    [caffeineEntries, medsVisibleRange.endMs, medsVisibleRange.startMs]
  );
  const medicationHistoryEntries = useMemo(() => {
    return sortedMedicationEntries.filter((entry) => {
      if (medsHistoryFilter === "all") return true;
      if (medsHistoryFilter === "feelings") return entry.entryType === "observation";
      return entry.entryType === "input" && entry.medication === medsHistoryFilter;
    });
  }, [medsHistoryFilter, sortedMedicationEntries]);
  const medsHistoryItems = useMemo(() => {
    const medicationItems = medicationHistoryEntries.map((entry) => ({
      kind: "medication" as const,
      id: entry.id,
      timestamp: entry.timestamp,
      entry,
    }));
    const alcoholItems = medsHistoryFilter === "all" || medsHistoryFilter === "alcohol"
      ? alcoholEntries.map((entry) => ({
          kind: "alcohol" as const,
          id: entry.id,
          timestamp: entry.startedAt,
          entry,
        }))
      : [];

    return [...medicationItems, ...alcoholItems].sort(
      (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
    );
  }, [alcoholEntries, medicationHistoryEntries, medsHistoryFilter]);
  const medicationTrackerInputEntries = useMemo(
    () => sortedMedicationEntries.filter((entry) => Boolean(medicationTrackerIdentity(entry))),
    [sortedMedicationEntries]
  );
  const medicationTrackerDates = useMemo(() => {
    const inputDates = medicationTrackerInputEntries
      .map(medicationLocalDate)
      .filter((date): date is string => isValidISODate(date))
      .sort();
    const today = isValidISODate(clientToday) ? clientToday : todayISO();
    const latestInputDate = inputDates[inputDates.length - 1];
    const earliestInputDate = inputDates[0];
    const end = latestInputDate && latestInputDate > today ? latestInputDate : today;
    const visibleStart = addDaysISO(end, -364);
    const start = earliestInputDate && earliestInputDate < visibleStart ? earliestInputDate : visibleStart;
    const startDay = new Date(`${start}T00:00:00`).getDay();
    const alignedStart = addDaysISO(start, -((startDay + 6) % 7));
    const dayCount = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${alignedStart}T00:00:00Z`)) / 86400000) + 1;
    return Array.from({ length: dayCount }, (_, index) => addDaysISO(alignedStart, index));
  }, [clientToday, medicationTrackerInputEntries]);
  const medicationTrackerMobileDates = useMemo(() => {
    const today = isValidISODate(clientToday) ? clientToday : todayISO();
    const currentWeekStart = startOfLoggerWeek(today);
    const visibleStart = addDaysISO(currentWeekStart, -15 * 7);
    const dayCount = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${visibleStart}T00:00:00Z`)) / 86400000) + 1;
    return Array.from({ length: dayCount }, (_, index) => addDaysISO(visibleStart, index));
  }, [clientToday]);
  const medicationTrackerSubstances = useMemo<MedicationTrackerSubstance[]>(() => {
    const visibleDates = new Set(medicationTrackerDates);
    const grouped = new Map<string, { label: string; entries: MedicationEntry[] }>();

    medicationTrackerInputEntries.forEach((entry) => {
      const identity = medicationTrackerIdentity(entry);
      if (!identity) return;
      const current = grouped.get(identity.key) ?? { label: identity.label, entries: [] };
      current.entries.push(entry);
      grouped.set(identity.key, current);
    });

    return Array.from(grouped.entries())
      .map(([key, group]) => {
        const visibleEntries = group.entries.filter((entry) => visibleDates.has(medicationLocalDate(entry)));
        const numericEntries = visibleEntries.filter((entry) => typeof entry.amount === "number" && Number.isFinite(entry.amount));
        const units = new Set(numericEntries.map((entry) => (entry.unit ?? "").trim().toLocaleLowerCase()));
        const canAggregateAmounts = visibleEntries.length > 0 && numericEntries.length === visibleEntries.length && units.size === 1;
        const rawDays = new Map<string, Omit<MedicationTrackerDay, "intensity">>();

        visibleEntries.forEach((entry) => {
          const date = medicationLocalDate(entry);
          const existing = rawDays.get(date) ?? {
            date,
            count: 0,
            amount: canAggregateAmounts ? 0 : null,
            unit: canAggregateAmounts ? entry.unit ?? null : null,
          };
          existing.count += 1;
          if (existing.amount !== null && typeof entry.amount === "number") existing.amount += entry.amount;
          rawDays.set(date, existing);
        });

        const values = Array.from(rawDays.values()).map((day) => day.amount ?? day.count).sort((a, b) => a - b);
        const min = values[0] ?? 0;
        const max = values[values.length - 1] ?? 0;
        const nearUniform = max <= min || max - min <= Math.max(0.001, max * 0.05);
        const days = new Map<string, MedicationTrackerDay>();
        rawDays.forEach((day, date) => {
          const value = day.amount ?? day.count;
          const rank = values.filter((candidate) => candidate <= value).length / Math.max(1, values.length);
          days.set(date, { ...day, intensity: nearUniform ? 3 : Math.max(1, Math.min(4, Math.ceil(rank * 4))) });
        });

        return { key, label: group.label, color: medicationTrackerColor(key), days };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [medicationTrackerDates, medicationTrackerInputEntries]);

  function openDoseModal() {
    const now = new Date();
    setMedsError(null);
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setDoseMedicationKind("Vyvanse");
    setDoseCustomMedication("");
    setDoseAmount("");
    setDoseUnit("mg");
    setDoseWhenMode("now");
    setDoseDate(localDateISO(now));
    setDoseTime(timeInputFromTimestamp(now.toISOString()));
    setCaffeineSize("M");
    setCaffeineWhenMode("now");
    setCaffeineDate(localDateISO(now));
    setCaffeineTime(timeInputFromTimestamp(now.toISOString()));
    setCaffeineNote("");
    applyCaffeineDrinkDefaults("iced_latte", "M");
    setMedsModalMode("dose");
  }

  function openCaffeineModal() {
    openDoseModal();
    setDoseMedicationKind("Coffee");
  }

  function openRoutineMedicationModal(medication: "Vyvanse" | "Prozac", amount: number) {
    openDoseModal();
    setDoseMedicationKind(medication);
    setDoseAmount(String(amount));
    setDoseUnit("mg");
  }

  function openAlcoholModal() {
    const now = new Date();
    setMedsError(null);
    setMedsDeleteConfirm(false);
    setAlcoholDraftId(createAlcoholEntryId());
    setAlcoholDrinkType("Wine");
    setAlcoholQuantity("1");
    setAlcoholServingSizeMl(ALCOHOL_DRINK_DEFAULTS.Wine.servingSizeMl);
    setAlcoholAbvPercent(ALCOHOL_DRINK_DEFAULTS.Wine.abvPercent);
    setAlcoholStartedAt(`${localDateISO(now)}T${timeInputFromTimestamp(now.toISOString())}`);
    setAlcoholEndedAt("");
    setMedsModalMode("alcohol");
  }

  async function submitAlcoholEntry() {
    if (medsSaving || !alcoholDraftId) return;

    const quantity = Number(alcoholQuantity);
    const startedAtMs = Date.parse(alcoholStartedAt);
    const endedAtMs = alcoholEndedAt ? Date.parse(alcoholEndedAt) : null;

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(startedAtMs) ||
      (endedAtMs !== null && (!Number.isFinite(endedAtMs) || endedAtMs < startedAtMs))
    ) {
      setMedsError("Add a valid quantity and time range.");
      return;
    }

    const entry: AlcoholEntry = {
      id: alcoholDraftId,
      signalType: "alcohol",
      drinkType: alcoholDrinkType,
      quantity,
      startedAt: new Date(startedAtMs).toISOString(),
      endedAt: endedAtMs === null ? null : new Date(endedAtMs).toISOString(),
      alcoholUnits: estimatedAlcoholUnits,
      feelingsSymptoms: null,
    };

    setMedsSaving(true);
    const saved = await saveAlcoholEntry(entry, SYNC_CODE);
    setMedsSaving(false);

    if (!saved) {
      setMedsError("Could not save alcohol entry. Existing data was kept.");
      return;
    }

    setAlcoholEntries((current) => [entry, ...current.filter((existing) => existing.id !== entry.id)]);
    setMedsModalMode(null);
    setMedsError(null);
    setAlcoholDraftId(null);
  }

  function openFeelingModal() {
    const now = new Date();
    setMedsError(null);
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setSelectedFeelingLogs({});
    setFeelingManageOpen(false);
    setCustomFeelingOpen(false);
    setNewFeelingName("");
    setNewFeelingIcon("smile");
    setNewFeelingValence("good");
    setNewFeelingCategory("state");
    setFeelingWhenMode("now");
    setFeelingDate(localDateISO(now));
    setFeelingTime(timeInputFromTimestamp(now.toISOString()));
    setMedsModalMode("feeling");
  }

  function applyCaffeineDrinkDefaults(drinkId: CaffeineDrinkId, size: "S" | "M" | "L" = caffeineSize) {
    const drink = CAFFEINE_DRINK_DEFAULTS.find((option) => option.id === drinkId) ?? CAFFEINE_DRINK_DEFAULTS[0];
    const sizeMultiplier = size === "S" ? 0.75 : size === "L" ? 1.25 : 1;
    setCaffeineDrinkId(drinkId);
    setCaffeineMg(String(Math.round(drink.mg * sizeMultiplier)));
  }

  async function submitCaffeineEntry() {
    if (medsSaving) return;

    const editingInput = editingMedicationEntry?.entryType === "input" ? editingMedicationEntry : null;
    const drink = CAFFEINE_DRINK_DEFAULTS.find((option) => option.id === caffeineDrinkId) ?? CAFFEINE_DRINK_DEFAULTS[0];
    const mg = Number(caffeineMg);
    const timestamp =
      caffeineWhenMode === "now" ? new Date().toISOString() : medicationTimestampFromInputs(caffeineDate, caffeineTime);

    if (!timestamp || !Number.isFinite(mg) || mg <= 0) {
      setMedsError("Add a valid caffeine amount and time.");
      return;
    }

    const entry: MedicationEntry = {
      id: editingInput?.id ?? createMedicationEntryId(),
      entryType: "input",
      timestamp,
      medication: "Coffee",
      amount: mg,
      unit: "mg",
      metadata: {
        source: "meds_m2_caffeine",
        drinkType: caffeineDrinkId,
        drinkLabel: drink.label,
        size: caffeineSize,
        shots: drink.shots ?? null,
        note: caffeineNote.trim() || null,
      },
    };

    setMedsSaving(true);
    const saved = editingInput
      ? await updateMedicationEntry(entry, SYNC_CODE)
      : await saveMedicationEntry(entry, SYNC_CODE);
    setMedsSaving(false);

    if (!saved) {
      setMedsError(
        editingInput
          ? "Could not update caffeine. Existing Meds history was kept."
          : "Could not save caffeine. Existing Meds history was kept."
      );
      return;
    }

    setMedicationEntries((prev) =>
      editingInput ? prev.map((existing) => (existing.id === entry.id ? entry : existing)) : [entry, ...prev]
    );
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setMedsModalMode(null);
    setMedsError(null);
  }

  function openMedicationEntryEditor(entry: MedicationEntry) {
    const timestamp = new Date(entry.timestamp);
    setMedsError(null);
    setEditingMedicationEntry(entry);
    setMedsDeleteConfirm(false);

    if (entry.entryType === "input") {
      const knownMedication = MEDICATION_OPTIONS.find(
        (option) => option.id !== "Custom" && option.id === entry.medication
      );

      setDoseMedicationKind(knownMedication?.id ?? "Custom");
      setDoseCustomMedication(knownMedication ? "" : entry.medication ?? "");
      setDoseAmount(entry.amount !== null && entry.amount !== undefined ? formatMedicationAmount(entry.amount) : "");
      setDoseUnit(entry.unit ?? knownMedication?.unit ?? "");
      setDoseWhenMode("manual");
      setDoseDate(localDateISO(timestamp));
      setDoseTime(timeInputFromTimestamp(entry.timestamp));
      if (entry.medication === "Coffee" || isCaffeineEntry(entry)) {
        const metadataDrink = medicationMetadataValue(entry, "drinkType") as CaffeineDrinkId;
        const drink = CAFFEINE_DRINK_DEFAULTS.find((option) => option.id === metadataDrink);
        const metadataSize = medicationMetadataValue(entry, "size");
        setCaffeineDrinkId(drink?.id ?? "custom");
        setCaffeineSize(metadataSize === "S" || metadataSize === "M" || metadataSize === "L" ? metadataSize : "M");
        setCaffeineMg(entry.amount !== null && entry.amount !== undefined ? formatMedicationAmount(entry.amount) : "100");
        setCaffeineWhenMode("manual");
        setCaffeineDate(localDateISO(timestamp));
        setCaffeineTime(timeInputFromTimestamp(entry.timestamp));
        setCaffeineNote(medicationMetadataValue(entry, "note"));
      }
      setMedsModalMode("dose");
      return;
    }

    const feelingLogs = feelingLogsFromEntry(entry);
    if (feelingLogs.length) {
      setFeelingDefinitions((currentDefinitions) => {
        const existingIds = new Set(currentDefinitions.map((definition) => definition.id));
        const missingDefinitions = feelingLogs
          .filter((log) => !existingIds.has(log.id))
          .map((log) => ({
            id: log.id,
            name: log.name,
            icon: log.icon,
            valence: log.valence,
            category: "state" as FeelingCategory,
            active: true,
            custom: true,
          }));
        return missingDefinitions.length ? [...currentDefinitions, ...missingDefinitions] : currentDefinitions;
      });
    }
    setSelectedFeelingLogs(Object.fromEntries(feelingLogs.map((log) => [log.id, { intensity: log.intensity }])));
    setFeelingManageOpen(false);
    setNewFeelingName("");
    setNewFeelingIcon("smile");
    setNewFeelingValence("good");
    setNewFeelingCategory("state");
    setFeelingWhenMode("manual");
    setFeelingDate(localDateISO(timestamp));
    setFeelingTime(timeInputFromTimestamp(entry.timestamp));
    setMedsModalMode("feeling");
  }

  function closeMedsModal() {
    if (medsSaving) return;
    setMedsModalMode(null);
    setMedsError(null);
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setAlcoholDraftId(null);
  }

  function toggleStructuredFeeling(id: string) {
    setSelectedFeelingLogs((current) => {
      if (current[id]) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: { intensity: 3 } };
    });
  }

  function setStructuredFeelingIntensity(id: string, intensity: number) {
    setSelectedFeelingLogs((current) => ({
      ...current,
      [id]: { intensity: clamp(intensity, 1, 5) },
    }));
  }

  async function persistFeelingDefinitions(nextDefinitions: FeelingDefinition[]) {
    const id = feelingDefinitionsEntryId ?? feelingDefinitionsEntry?.id ?? createMedicationEntryId();
    const entry: MedicationEntry = {
      id,
      entryType: "observation",
      timestamp: feelingDefinitionsEntry?.timestamp ?? new Date().toISOString(),
      feeling: FEELING_DEFINITIONS_MARKER,
      valence: "neutral",
      metadata: {
        source: FEELING_DEFINITIONS_SOURCE,
        definitions: nextDefinitions,
      },
      createdAt: feelingDefinitionsEntry?.createdAt,
      updatedAt: feelingDefinitionsEntry?.updatedAt,
    };

    setMedsSaving(true);
    const saved = feelingDefinitionsEntry
      ? await updateMedicationEntry(entry, SYNC_CODE)
      : await saveMedicationEntry(entry, SYNC_CODE);
    setMedsSaving(false);

    if (!saved) {
      setMedsError("Could not save feeling settings. Existing Meds history was kept.");
      return false;
    }

    setFeelingDefinitions(nextDefinitions);
    setFeelingDefinitionsEntryId(id);
    setMedicationEntries((prev) =>
      prev.some((existing) => existing.id === id)
        ? prev.map((existing) => (existing.id === id ? entry : existing))
        : [entry, ...prev]
    );
    setMedsError(null);
    return true;
  }

  async function addCustomFeelingDefinition() {
    const name = newFeelingName.trim();
    if (!name) {
      setMedsError("Add a feeling name first.");
      return;
    }

    const id = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now().toString(36)}`;
    const definition: FeelingDefinition = {
      id,
      name,
      icon: newFeelingIcon,
      valence: newFeelingValence,
      category: newFeelingCategory,
      active: true,
      custom: true,
    };
    const saved = await persistFeelingDefinitions([...feelingDefinitions, definition]);
    if (!saved) return;
    setNewFeelingName("");
    setNewFeelingIcon("smile");
    setNewFeelingValence("good");
    setNewFeelingCategory("state");
    setCustomFeelingOpen(false);
    setSelectedFeelingLogs((current) => ({ ...current, [id]: { intensity: 3 } }));
  }

  async function updateFeelingDefinition(id: string, patch: Partial<FeelingDefinition>) {
    const nextDefinitions = feelingDefinitions.map((definition) =>
      definition.id === id ? { ...definition, ...patch } : definition
    );
    await persistFeelingDefinitions(nextDefinitions);
  }

  async function submitDose() {
    if (medsSaving) return;

    const editingInput = editingMedicationEntry?.entryType === "input" ? editingMedicationEntry : null;
    const selected = MEDICATION_OPTIONS.find((option) => option.id === doseMedicationKind);
    const medication = doseMedicationKind === "Custom" ? doseCustomMedication.trim() : doseMedicationKind;
    const unit = doseUnit.trim() || selected?.unit || null;
    const amount = doseAmount.trim() ? Number(doseAmount) : null;
    const timestamp =
      doseWhenMode === "now" ? new Date().toISOString() : medicationTimestampFromInputs(doseDate, doseTime);

    if (!medication || !timestamp || (amount !== null && (!Number.isFinite(amount) || amount <= 0))) {
      setMedsError("Add what you took, and use a valid amount/time.");
      return;
    }

    const entry: MedicationEntry = {
      id: editingInput?.id ?? createMedicationEntryId(),
      entryType: "input",
      timestamp,
      medication,
      amount,
      unit,
      metadata: editingInput?.metadata ?? { source: "meds_v1" },
      createdAt: editingInput?.createdAt,
      updatedAt: editingInput?.updatedAt,
    };

    setMedsSaving(true);
    const saved = editingInput
      ? await updateMedicationEntry(entry, SYNC_CODE)
      : await saveMedicationEntry(entry, SYNC_CODE);
    setMedsSaving(false);

    if (!saved) {
      setMedsError(
        editingInput ? "Could not update dose. Existing Meds history was kept." : "Could not save dose. Existing Meds history was kept."
      );
      return;
    }

    setMedicationEntries((prev) =>
      editingInput ? prev.map((existing) => (existing.id === entry.id ? entry : existing)) : [entry, ...prev]
    );
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setMedsModalMode(null);
  }

  async function submitFeeling() {
    if (medsSaving) return;

    const editingObservation =
      editingMedicationEntry?.entryType === "observation" ? editingMedicationEntry : null;
    const timestamp =
      feelingWhenMode === "now" ? new Date().toISOString() : medicationTimestampFromInputs(feelingDate, feelingTime);
    const selectedLogs = Object.entries(selectedFeelingLogs)
      .map(([id, log]) => {
        const definition = feelingDefinitions.find((item) => item.id === id);
        if (!definition) return null;
        return { definition, intensity: log.intensity };
      })
      .filter((log): log is { definition: FeelingDefinition; intensity: number } => Boolean(log));

    if (!selectedLogs.length || !timestamp) {
      setMedsError("Select at least one feeling and a valid time.");
      return;
    }

    const feelingLogs = selectedLogs.map(({ definition, intensity }) => ({
      feelingId: definition.id,
      nameSnapshot: definition.name,
      iconSnapshot: definition.icon,
      valenceSnapshot: definition.valence,
      intensity,
    }));
    const baseMetadata = {
      source: "meds_structured_feelings",
      feelingLogs,
    };
    const primaryLog = selectedLogs[0];
    const entry: MedicationEntry = {
      id: editingObservation?.id ?? createMedicationEntryId(),
      entryType: "observation",
      timestamp,
      feeling: feelingLogs.map((log) => log.nameSnapshot).join(", "),
      valence:
        primaryLog.definition.valence === "good"
          ? "positive"
          : primaryLog.definition.valence === "bad"
            ? "negative"
            : "neutral",
      intensity: primaryLog.intensity <= 2 ? "low" : primaryLog.intensity >= 4 ? "high" : "medium",
      metadata: baseMetadata,
      createdAt: editingObservation?.createdAt,
      updatedAt: editingObservation?.updatedAt,
    };

    setMedsSaving(true);
    const saved = editingObservation
      ? await updateMedicationEntry(entry, SYNC_CODE)
      : await saveMedicationEntry(entry, SYNC_CODE);
    setMedsSaving(false);

    if (!saved) {
      setMedsError(
        editingObservation
          ? "Could not update feeling. Existing Meds history was kept."
          : "Could not save feeling. Existing Meds history was kept."
      );
      return;
    }

    setMedicationEntries((prev) =>
      editingObservation ? prev.map((existing) => (existing.id === entry.id ? entry : existing)) : [entry, ...prev]
    );
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setMedsModalMode(null);
  }

  async function deleteEditingMedicationEntry() {
    if (!editingMedicationEntry || medsSaving) return;

    setMedsSaving(true);
    const deleted = await deleteMedicationEntry(editingMedicationEntry.id, SYNC_CODE);
    setMedsSaving(false);

    if (!deleted) {
      setMedsError("Could not delete entry. Existing Meds history was kept.");
      return;
    }

    setMedicationEntries((prev) => prev.filter((entry) => entry.id !== editingMedicationEntry.id));
    setEditingMedicationEntry(null);
    setMedsDeleteConfirm(false);
    setMedsError(null);
    setMedsModalMode(null);
  }

  const byCourse = useMemo(() => {
    const map: Record<string, Task[]> = Object.fromEntries(activeCategories.map((c) => [c.id, []]));
    for (const t of filtered.filter((task) => task.status !== "completed")) {
      const key = t.courseId || firstCategoryId;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const aDays = a.due ? daysLeftFromISO(a.due) : null;
        const bDays = b.due ? daysLeftFromISO(b.due) : null;

        const aBucket = aDays === null ? 3 : aDays < 0 ? 0 : aDays <= 2 ? 1 : 2;
        const bBucket = bDays === null ? 3 : bDays < 0 ? 0 : bDays <= 2 ? 1 : 2;

        if (aBucket !== bBucket) return aBucket - bBucket;

        const ad = a.due || "9999-12-31";
        const bd = b.due || "9999-12-31";
        if (ad !== bd) return ad.localeCompare(bd);

        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;

        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      });
    }

    return map;
  }, [activeCategories, filtered, firstCategoryId]);

  const scoredTasks = useMemo(() => {
    if (attentionIncludedCategoryIds.length === 0) return [];

    const scored = filtered
      .filter((task) => task.status !== "frozen")
      .filter((task) => attentionIncludedCategoryIdSet.has(task.courseId))
      .map((task) => {
        const v2 = attentionScoreV2(task, closedTimeLogs);
        return {
          task,
          total: v2.rawScore,
          reasons: getAttentionReasons(task, v2),
        };
      });

    scored.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      const ad = a.task.due || "9999-12-31";
      const bd = b.task.due || "9999-12-31";
      if (ad !== bd) return ad.localeCompare(bd);
      const pr = priorityRank(a.task.priority) - priorityRank(b.task.priority);
      if (pr !== 0) return pr;
      return (b.task.createdAt ?? 0) - (a.task.createdAt ?? 0);
    });

    const visualScores = visualAttentionScores(scored.map((item) => item.total));
    return scored.map((item, index) => ({
      ...item,
      ...visualScores[index],
    }));
  }, [attentionIncludedCategoryIdSet, attentionIncludedCategoryIds.length, closedTimeLogs, filtered]);

  useEffect(() => {
    const target = window as typeof window & {
      yasmineCompareAttentionV2?: () => Array<Record<string, string | number | null>>;
    };

    target.yasmineCompareAttentionV2 = () => {
      const rows = scoredTasks
        .map(({ task, total, relativePosition, visualAttentionScore, visualLevel }) => {
          const v2 = attentionScoreV2(task, closedTimeLogs);
          const reasons = getAttentionReasons(task, v2);
          return {
            task: task.title,
            category: courseLabel(task.courseId),
            status: task.status,
            priority: task.priority,
            deadline: task.due ?? task.visionHorizon ?? "none",
            activityType: task.activityType ?? "none",
            currentScore: Math.round(total),
            v2RawScore: Number(v2.rawScore.toFixed(2)),
            v2DisplayedScore: v2.displayedScore,
            relativePosition: Number(relativePosition.toFixed(3)),
            visualAttentionScore: Number(visualAttentionScore.toFixed(2)),
            visualLevel,
            deadlinePressure: Number(v2.deadlinePressure.toFixed(2)),
            deadlineContribution: Number(v2.deadlineContribution.toFixed(2)),
            intrinsicImportance: v2.intrinsicImportance,
            explicitEffortLevel: v2.explicitEffortLevel ?? "none",
            resolvedEffortLevel: v2.resolvedEffortLevel ?? "none",
            effortSource: v2.effortSource,
            legacyDurationHrs: v2.legacyDurationHrs,
            effortFactor: Number(v2.effortFactor.toFixed(2)),
            startPressure: Number(v2.startPressure.toFixed(2)),
            startContribution: Number(v2.startContribution.toFixed(2)),
            horizonPressure: v2.horizonPressure,
            contextModifier: v2.contextModifier,
            taskCreatedDate: v2.taskCreatedDate ?? "unknown",
            daysSinceTaskCreated: v2.daysSinceTaskCreated,
            lastWorkedDate: v2.lastWorkedDate ?? "never",
            daysSinceLastWorked: v2.daysSinceLastWorked,
            hoursLast7Days: Number(v2.hoursLast7Days.toFixed(2)),
            hoursLast14Days: Number(v2.hoursLast14Days.toFixed(2)),
            hoursLast30Days: Number(v2.hoursLast30Days.toFixed(2)),
            hasEverBeenWorked: v2.hasEverBeenWorked ? "yes" : "no",
            neverWorkedMaturityPressure: Number(v2.neverWorkedMaturityPressure.toFixed(2)),
            neverWorkedBasePressure: Number(v2.neverWorkedBasePressure.toFixed(2)),
            activityCadenceMultiplier: Number(v2.activityCadenceMultiplier.toFixed(2)),
            cadencePressureBeforeActivity: Number(v2.cadencePressureBeforeActivity.toFixed(2)),
            cadencePressure: Number(v2.cadencePressure.toFixed(2)),
            cadenceContribution: Number(v2.cadenceContribution.toFixed(2)),
            reasons: reasons.join(" · "),
          };
        })
        .sort((a, b) => Number(b.v2RawScore) - Number(a.v2RawScore));

      console.table(rows);
      return rows;
    };

    return () => {
      delete target.yasmineCompareAttentionV2;
    };
  }, [closedTimeLogs, courseLabel, scoredTasks]);

  const plannerAnchor = isValidISODate(plannerAnchorDate)
    ? plannerAnchorDate
    : isValidISODate(clientToday)
      ? clientToday
      : "2026-08-23";
  const plannerWeekDays = useMemo(() => plannerWeekDaysForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerWeekLabel = useMemo(() => formatPlannerWeekRange(plannerWeekDays), [plannerWeekDays]);
  const plannerMonthDays = useMemo(() => plannerMonthDaysForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerMonthLabel = useMemo(() => formatPlannerMonthLabel(plannerAnchor), [plannerAnchor]);
  const plannerThreeMonths = useMemo(() => plannerThreeMonthsForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerThreeMonthLabel = useMemo(() => formatPlannerThreeMonthLabel(plannerThreeMonths), [plannerThreeMonths]);
  const plannerThreeMonthVisibleRange = useMemo(() => plannerMonthsVisibleRange(plannerThreeMonths), [plannerThreeMonths]);
  const plannerYearMonths = useMemo(() => plannerYearMonthsForAnchor(plannerAnchor), [plannerAnchor]);
  const plannerYearLabel = useMemo(() => formatPlannerYearLabel(plannerAnchor), [plannerAnchor]);
  const plannerHours = useMemo(() => plannerHourLabels(), []);
  const plannerWeekStart = plannerWeekDays[0] ?? plannerAnchor;
  const plannerWeekEnd = plannerWeekDays[6] ?? plannerAnchor;
  const plannerVisibleRange = useMemo(() => {
    if (plannerView === "week") return { start: plannerWeekStart, end: plannerWeekEnd };
    if (plannerView === "month") {
      return {
        start: plannerMonthDays[0]?.date ?? plannerAnchor,
        end: plannerMonthDays[plannerMonthDays.length - 1]?.date ?? plannerAnchor,
      };
    }
    if (plannerView === "three_month") return plannerThreeMonthVisibleRange;
    return { start: `${plannerYearLabel}-01-01`, end: `${plannerYearLabel}-12-31` };
  }, [
    plannerAnchor,
    plannerMonthDays,
    plannerThreeMonthVisibleRange,
    plannerView,
    plannerWeekEnd,
    plannerWeekStart,
    plannerYearLabel,
  ]);
  const plannerCalendarBaseEventsForRender = useMemo(() => {
    if (!plannerInteraction) return calendarEvents;
    const hasRealEvent = calendarEvents.some((event) => event.id === plannerInteraction.eventId);
    const mapped = calendarEvents.map((event) =>
      event.id === plannerInteraction.eventId ? plannerInteraction.previewEvent : event
    );
    return hasRealEvent ? mapped : [...mapped, plannerInteraction.previewEvent];
  }, [calendarEvents, plannerInteraction]);
  const plannerCalendarEventsForRender = useMemo(() => {
    return expandRecurringPlannerEvents(
      plannerCalendarBaseEventsForRender,
      plannerVisibleRange.start,
      plannerVisibleRange.end
    );
  }, [plannerCalendarBaseEventsForRender, plannerVisibleRange]);
  const plannerTaskDeadlinesByDate = useMemo(() => {
    return activeTasks.reduce<Record<string, Task[]>>((groups, task) => {
      const hasFixedDate =
        task.deadlineMode === "date" || (!task.deadlineMode && Boolean(task.due));
      if (
        task.status === "completed" ||
        !hasFixedDate ||
        !task.due ||
        !isValidISODate(task.due)
      ) {
        return groups;
      }

      groups[task.due] = [...(groups[task.due] ?? []), task];
      return groups;
    }, {});
  }, [activeTasks]);
  const plannerWeekEvents = useMemo(() => {
    return plannerCalendarEventsForRender.filter((event) => calendarEventIntersectsWeek(event, plannerWeekStart, plannerWeekEnd));
  }, [plannerCalendarEventsForRender, plannerWeekEnd, plannerWeekStart]);
  const plannerTaskDeadlinesInWeekByDate = useMemo(() => {
    return plannerWeekDays.reduce<Record<string, Task[]>>((groups, day) => {
      groups[day] = plannerTaskDeadlinesByDate[day] ?? [];
      return groups;
    }, {});
  }, [plannerTaskDeadlinesByDate, plannerWeekDays]);
  const plannerWeekAllDaySpans = useMemo(() => {
    const items: PlannerDateItem[] = [
      ...plannerWeekEvents
        .filter((event) => plannerEventRendersAsAllDaySpan(event) && event.startDate)
        .map((event) => ({ sourceType: "calendar_event" as const, event })),
      ...plannerWeekDays.flatMap((day) =>
        (plannerTaskDeadlinesInWeekByDate[day] ?? []).map((task) => ({
          sourceType: "task_deadline" as const,
          task,
          date: day,
        }))
      ),
    ];
    return plannerAllDaySpansForDays(plannerWeekDays, items);
  }, [plannerTaskDeadlinesInWeekByDate, plannerWeekDays, plannerWeekEvents]);
  const plannerTimedLayoutsByDate = useMemo(() => {
    return plannerWeekDays.reduce<
      Record<string, Array<ReturnType<typeof layoutPlannerTimedEvents>[number]>>
    >((groups, day) => {
      const dayEvents = plannerWeekEvents.filter((event) => {
        if (getCalendarEventTimeMode(event) === "daypart") {
          return event.startDate === day;
        }
        if (event.allDay || !event.startAt) return false;
        const startDate = eventLocalDate(event.startAt);
        const endDate = eventLocalDate(event.endAt) || startDate;
        return Boolean(startDate && endDate && startDate <= day && endDate >= day);
      });
      groups[day] = layoutPlannerTimedEvents(dayEvents, day);
      return groups;
    }, {});
  }, [plannerWeekDays, plannerWeekEvents]);
  const plannerMobileWeekDate = plannerWeekDays.includes(plannerMobileSelectedDate)
    ? plannerMobileSelectedDate
    : plannerWeekDays.includes(clientToday)
      ? clientToday
      : plannerWeekDays[0] ?? plannerAnchor;
  const plannerMobileWeekItems = useMemo(() => {
    return plannerItemsForDate(
      plannerMobileWeekDate,
      plannerCalendarEventsForRender,
      plannerTaskDeadlinesByDate
    );
  }, [plannerCalendarEventsForRender, plannerMobileWeekDate, plannerTaskDeadlinesByDate]);
  const plannerMobileAllDayItems = useMemo(() => {
    return plannerMobileWeekItems.filter((item) => {
      if (item.sourceType === "task_deadline") return true;
      return (
        plannerEventRendersAsAllDaySpan(item.event) ||
        (!item.event.startAt && getCalendarEventTimeMode(item.event) !== "daypart")
      );
    });
  }, [plannerMobileWeekItems]);
  const plannerMobileTimedLayouts = plannerTimedLayoutsByDate[plannerMobileWeekDate] ?? [];
  const plannerMonthGrid = useMemo(() => {
    const month = plannerThreeMonths[0];
    return buildPlannerMonthGridData(
      month,
      plannerCalendarEventsForRender,
      plannerTaskDeadlinesByDate
    );
  }, [plannerCalendarEventsForRender, plannerTaskDeadlinesByDate, plannerThreeMonths]);
  const plannerThreeMonthGrids = useMemo(() => {
    return plannerThreeMonths.map((month) =>
      buildPlannerMonthGridData(month, plannerCalendarEventsForRender, plannerTaskDeadlinesByDate)
    );
  }, [plannerCalendarEventsForRender, plannerTaskDeadlinesByDate, plannerThreeMonths]);
  const plannerYearEventsByDate = useMemo(() => {
    const yearStart = `${plannerYearLabel}-01-01`;
    const yearEnd = `${plannerYearLabel}-12-31`;
    const groups: Record<string, PlannerDateItem[]> = {};

    plannerCalendarEventsForRender.forEach((event) => {
      const span = eventDateSpan(event);
      if (!span || span.end < yearStart || span.start > yearEnd) return;

      let cursor = span.start < yearStart ? yearStart : span.start;
      const end = span.end > yearEnd ? yearEnd : span.end;

      while (cursor <= end) {
        groups[cursor] = [...(groups[cursor] ?? []), { sourceType: "calendar_event", event }];
        cursor = addDaysISO(cursor, 1);
      }
    });

    Object.entries(plannerTaskDeadlinesByDate).forEach(([date, deadlineTasks]) => {
      if (date < yearStart || date > yearEnd) return;
      groups[date] = [
        ...(groups[date] ?? []),
        ...deadlineTasks.map((task) => ({ sourceType: "task_deadline" as const, task, date })),
      ];
    });

    return groups;
  }, [plannerCalendarEventsForRender, plannerTaskDeadlinesByDate, plannerYearLabel]);
  const plannerTaskOptions = useMemo(() => {
    const options = activeTasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const selectedTask = plannerEventDraft?.taskId
      ? activeTasks.find((task) => task.id === plannerEventDraft.taskId)
      : null;

    if (selectedTask && !options.some((task) => task.id === selectedTask.id)) {
      return [selectedTask, ...options];
    }

    return options;
  }, [activeTasks, plannerEventDraft?.taskId]);
  const plannerDraftShowsEndDate = Boolean(
    plannerEventDraft &&
      (plannerEventDraft.eventType === "travel" ||
        plannerEventDraft.endDate > plannerEventDraft.date)
  );
  const plannerIsCurrentWeek = Boolean(clientToday && plannerWeekDays.includes(clientToday));
  const currentTimeTop =
    plannerIsCurrentWeek && clientNowMs
      ? (() => {
          const now = new Date(clientNowMs);
          const minutes = now.getHours() * 60 + now.getMinutes();
          const startMinutes = PLANNER_START_HOUR * 60;
          const endMinutes = PLANNER_END_HOUR * 60;
          if (minutes < startMinutes || minutes > endMinutes) return null;
          return ((minutes - startMinutes) / 60) * PLANNER_HOUR_HEIGHT;
        })()
      : null;

  useEffect(() => {
    if (mode !== "planner" || plannerView !== "week") return;

    plannerWeekScrollRef.current?.scrollTo({
      top: Math.max(0, (9 - PLANNER_START_HOUR) * PLANNER_HOUR_HEIGHT),
    });
  }, [mode, plannerView, plannerWeekDays[0]]);

  useEffect(() => {
    if (!plannerInteraction) return;

    function updatePreview(clientX: number, clientY: number) {
      setPlannerInteraction((current) => {
        if (!current) return current;

        const deltaX = clientX - current.pointerStartX;
        const deltaY = clientY - current.pointerStartY;
        const hasMoved = current.hasMoved || Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
        const visibleStartMinutes = PLANNER_START_HOUR * 60;
        const visibleEndMinutes = PLANNER_END_HOUR * 60;
        const originalStartDate = eventLocalDate(current.originalEvent.startAt) ?? plannerWeekDays[0];
        let nextStartDate = originalStartDate;
        let nextStartMinutes = current.originalStartMinutes;
        let nextEndMinutes = current.originalEndMinutes;

        if (current.kind === "move") {
          const rawDayIndex = Math.floor((clientX - current.gridLeft - 64) / current.dayWidth);
          const dayIndex = clamp(rawDayIndex, 0, plannerWeekDays.length - 1);
          nextStartDate = plannerWeekDays[dayIndex] ?? originalStartDate;
          nextStartMinutes = snapPlannerMinutes(
            current.originalStartMinutes + (deltaY / PLANNER_HOUR_HEIGHT) * 60
          );
          nextStartMinutes = clamp(
            nextStartMinutes,
            visibleStartMinutes,
            visibleEndMinutes - current.originalDurationMinutes
          );
          nextEndMinutes = nextStartMinutes + current.originalDurationMinutes;
        } else {
          nextStartDate = originalStartDate;
          nextEndMinutes = snapPlannerMinutes(
            current.originalEndMinutes + (deltaY / PLANNER_HOUR_HEIGHT) * 60
          );
          nextEndMinutes = clamp(
            nextEndMinutes,
            current.originalStartMinutes + PLANNER_SNAP_MINUTES,
            visibleEndMinutes
          );
        }

        const startAt =
          current.kind === "move"
            ? isoFromLocalDateMinutes(nextStartDate, nextStartMinutes)
            : current.originalEvent.startAt;
        const endAt = isoFromLocalDateMinutes(nextStartDate, nextEndMinutes);

        if (!startAt || !endAt) return { ...current, hasMoved };

        return {
          ...current,
          hasMoved,
          previewEvent: {
            ...current.previewEvent,
            startAt,
            endAt,
          },
        };
      });
    }

    function onPointerMove(event: PointerEvent) {
      updatePreview(event.clientX, event.clientY);
    }

    function onPointerUp() {
      setPlannerInteraction((current) => {
        if (!current) return current;

        if (!current.hasMoved) {
          return null;
        }

        suppressPlannerEventClickRef.current = true;
        setTimeout(() => {
          suppressPlannerEventClickRef.current = false;
        }, 0);

        void (async () => {
          const eventToSave = exceptionEventForPlannerOccurrence(current.previewEvent);
          const savedEvent = await savePlannerCalendarEvent(eventToSave);

          if (!savedEvent) {
            console.warn("Failed to save moved/resized calendar event. Reverting preview.", {
              id: current.eventId,
            });
            return;
          }

          setCalendarEvents((prev) => {
            const exists = prev.some((event) => event.id === savedEvent.id);
            return exists
              ? prev.map((event) => (event.id === savedEvent.id ? savedEvent : event))
              : [...prev, savedEvent];
          });
        })();

        return null;
      });
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [plannerInteraction, plannerWeekDays]);

  const loggerDateRange = useMemo(() => {
    return loggerDateRangeForMode(
      loggerRangeMode,
      loggerAnchorDate,
      customStartDate,
      customEndDate
    );
  }, [customEndDate, customStartDate, loggerAnchorDate, loggerRangeMode]);

  const loggerPeriodLabel = useMemo(() => {
    return formatLoggerPeriod(loggerRangeMode, loggerDateRange, loggerAnchorDate || todayISO());
  }, [loggerAnchorDate, loggerDateRange, loggerRangeMode]);

  const loggerDays = useMemo(() => {
    if (loggerRangeMode === "year") return [];
    return loggerDaysForRange(loggerDateRange);
  }, [loggerDateRange, loggerRangeMode]);
  const loggerMobileDate = loggerDays.includes(loggerMobileSelectedDate)
    ? loggerMobileSelectedDate
    : loggerDays.includes(clientToday)
      ? clientToday
      : loggerDays[0] ?? loggerDateRange.start;
  const useCompactLoggerGrid =
    loggerRangeMode === "month" || (loggerRangeMode === "custom" && loggerDays.length > 7);

  useEffect(() => {
    if (loggerRangeMode === "month" || loggerRangeMode === "custom") {
      loggerGridScrollRef.current?.scrollTo({ left: 0 });
    }
  }, [loggerDateRange.end, loggerDateRange.start, loggerRangeMode]);

  const logsInRange = useMemo(() => {
    return closedTimeLogs.filter((log) => log.date >= loggerDateRange.start && log.date <= loggerDateRange.end);
  }, [closedTimeLogs, loggerDateRange]);

  const openTimeLogs = useMemo(() => {
    return timeLogs
      .filter(isOpenTimeLog)
      .slice()
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.startTime ?? "").localeCompare(a.startTime ?? "");
      });
  }, [timeLogs]);

  const calculatedLogHours = useMemo(() => {
    return calculateTimeLogDurationHours(logDate, logStartTime, logEndDate || logDate, logEndTime);
  }, [logDate, logEndDate, logEndTime, logStartTime]);
  const isCalculatedLogDuration = calculatedLogHours !== null;
  const displayedLogHoursInput = isCalculatedLogDuration
    ? formatHourInput(calculatedLogHours)
    : logHoursInput;

  useEffect(() => {
    if (calculatedLogHours !== null) {
      setLogHoursInput(formatHourInput(calculatedLogHours));
    }
  }, [calculatedLogHours]);

  const loggerTasks = useMemo(() => {
    const taskIdsWithLogs = new Set(closedTimeLogs.map((log) => log.taskId));

    return filtered
      .filter((task) => loggerTaskFilter === "all" || task.id === loggerTaskFilter)
      .filter((task) => taskIdsWithLogs.has(task.id))
      .slice()
      .sort((a, b) => {
        const aHours = closedTimeLogs
            .filter((log) => log.taskId === a.id)
            .reduce((sum, log) => sum + (log.hours ?? 0), 0);
        const bHours = closedTimeLogs
            .filter((log) => log.taskId === b.id)
            .reduce((sum, log) => sum + (log.hours ?? 0), 0);

        if (bHours !== aHours) return bHours - aHours;
        return a.title.localeCompare(b.title);
      });
  }, [closedTimeLogs, filtered, loggerTaskFilter]);

  const taskNameById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task.title]));
  }, [tasks]);

  const taskById = useMemo(() => {
    return Object.fromEntries(tasks.map((task) => [task.id, task]));
  }, [tasks]);

  const categoryById = useMemo(() => {
    return Object.fromEntries([...fallbackCategories, ...categories].map((category) => [category.id, category]));
  }, [categories]);

  function renderCategoryIdentity(categoryId: string, compact = true) {
    const category = categoryById[categoryId];
    return category ? <CategoryIdentity category={category} compact={compact} /> : <span>{categoryId}</span>;
  }

  const logTaskOptions = useMemo(() => {
    const options = activeTasks
      .filter((task) => task.status !== "completed")
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title));
    const selectedTask = logTaskId ? activeTasks.find((task) => task.id === logTaskId) : null;

    if (selectedTask && !options.some((task) => task.id === selectedTask.id)) {
      return [selectedTask, ...options];
    }

    return options;
  }, [activeTasks, logTaskId]);

  const temporalLogRows = useMemo(() => {
    return logsInRange
      .filter((log) => loggerTaskFilter === "all" || log.taskId === loggerTaskFilter)
      .map((log) => {
        const task = taskById[log.taskId] ?? null;
        const category = task ? categoryById[task.courseId] ?? null : null;
        const exactDuration = exactTimeLogDuration(log);
        const startMinutes = timeLogTimeToMinutes(log.startTime);
        const bucket = exactDuration !== null ? timeOfDayBucketForLog(log) : null;
        return {
          log,
          task,
          taskTitle: task?.title ?? "Archived task",
          categoryId: category?.id ?? null,
          categoryLabel: category ? categoryHeaderName(category) : task ? courseLabel(task.courseId) : "Archived task",
          tone: loggerCategoryTone(category?.colour),
          exactDuration,
          startMinutes: startMinutes ?? Number.POSITIVE_INFINITY,
          bucket,
        };
      })
      .sort((a, b) => {
        const dateCompare = a.log.date.localeCompare(b.log.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return a.taskTitle.localeCompare(b.taskTitle);
      });
  }, [categoryById, courseLabel, loggerTaskFilter, logsInRange, taskById]);

  const dayTemporalRows = useMemo(() => {
    const dayRows = temporalLogRows.filter((row) => row.log.date === loggerDateRange.start);
    return {
      timed: dayRows.filter((row) => row.exactDuration !== null),
      exactByBucket: Object.fromEntries(
        LOGGER_TIME_OF_DAY_BUCKETS.map((bucket) => [
          bucket.id,
          dayRows.filter((row) => row.bucket === bucket.id),
        ])
      ) as Record<LoggerTimeOfDayBucket, typeof temporalLogRows>,
      unscheduled: dayRows.filter((row) => row.exactDuration === null),
    };
  }, [loggerDateRange.start, temporalLogRows]);

  const weekTemporalRows = useMemo(() => {
    const days = loggerRangeMode === "week" ? loggerDays : [];
    const daySet = new Set(days);
    const rows = temporalLogRows.filter((row) => daySet.has(row.log.date));
    return {
      days,
      exactByBucketAndDay: Object.fromEntries(
        LOGGER_TIME_OF_DAY_BUCKETS.map((bucket) => [
          bucket.id,
          Object.fromEntries(days.map((day) => [day, rows.filter((row) => row.log.date === day && row.bucket === bucket.id)])),
        ])
      ) as Record<LoggerTimeOfDayBucket, Record<string, typeof temporalLogRows>>,
      unscheduledByDay: Object.fromEntries(
        days.map((day) => [day, rows.filter((row) => row.log.date === day && row.exactDuration === null)])
      ) as Record<string, typeof temporalLogRows>,
    };
  }, [loggerDays, loggerRangeMode, temporalLogRows]);

  const logsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    for (const log of closedTimeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = [...(map[key] ?? []), log];
    }
    return map;
  }, [closedTimeLogs]);

  const openLogsByTaskDate = useMemo(() => {
    const map: Record<string, TimeLog[]> = {};
    for (const log of openTimeLogs) {
      const key = `${log.taskId}:${log.date}`;
      map[key] = [...(map[key] ?? []), log];
    }
    return map;
  }, [openTimeLogs]);

  const editingTimeLog = useMemo(() => {
    return editingLogId ? timeLogs.find((log) => log.id === editingLogId) ?? null : null;
  }, [editingLogId, timeLogs]);
  const logModalTitle = editingTimeLog && isOpenTimeLog(editingTimeLog)
    ? "Add end time"
    : editingLogId
      ? "Edit time log"
      : "Log time";

  const loggerRows = useMemo(() => {
    const visibleDates = new Set(loggerDays);
    return loggerTasks.map((task) => {
      const logs = closedTimeLogs.filter((log) => log.taskId === task.id && visibleDates.has(log.date));
      return {
        task,
        total: logs.reduce((sum, log) => sum + (log.hours ?? 0), 0),
      };
    });
  }, [closedTimeLogs, loggerDays, loggerTasks]);

  const loggerRangeSummary = useMemo(() => {
    const totalHours = logsInRange.reduce((sum, log) => sum + (log.hours ?? 0), 0);
    const activeDates = new Set(logsInRange.map((log) => log.date));
    const averageHoursPerActiveDay = activeDates.size ? totalHours / activeDates.size : 0;
    const taskTotals = new Map<string, number>();
    const categoryTotals = new Map<string, number>();

    for (const log of logsInRange) {
      const taskKey = log.taskId || "archived";
      taskTotals.set(taskKey, (taskTotals.get(taskKey) ?? 0) + (log.hours ?? 0));

      const task = log.taskId ? taskById[log.taskId] : null;
      const categoryKey = task?.courseId ?? "archived";
      categoryTotals.set(categoryKey, (categoryTotals.get(categoryKey) ?? 0) + (log.hours ?? 0));
    }

    const mostWorkedTaskEntry = Array.from(taskTotals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    const mostWorkedCategoryEntry = Array.from(categoryTotals.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
    const mostWorkedTask = mostWorkedTaskEntry
      ? {
          id: mostWorkedTaskEntry[0],
          title: taskById[mostWorkedTaskEntry[0]]?.title ?? "Archived task",
          hours: mostWorkedTaskEntry[1],
        }
      : null;
    const mostWorkedCategory = mostWorkedCategoryEntry
      ? {
          id: mostWorkedCategoryEntry[0],
          label:
            mostWorkedCategoryEntry[0] === "archived"
              ? "Archived category"
              : categoryById[mostWorkedCategoryEntry[0]]
                ? categoryHeaderName(categoryById[mostWorkedCategoryEntry[0]])
                : courseLabel(mostWorkedCategoryEntry[0]),
          hours: mostWorkedCategoryEntry[1],
        }
      : null;

    return {
      totalHours,
      activeDayCount: activeDates.size,
      averageHoursPerActiveDay,
      mostWorkedTask,
      mostWorkedCategory,
    };
  }, [categoryById, courseLabel, logsInRange, taskById]);

  const activityMap = useMemo(() => {
    const end = loggerRangeMode === "month" && isValidISODate(clientToday) ? clientToday : loggerDateRange.end;
    const rawStart = loggerRangeMode === "month" ? addMonthsISO(`${end.slice(0, 7)}-01`, -11) : loggerDateRange.start;
    const sourceLogs = loggerRangeMode === "month"
      ? closedTimeLogs.filter((log) => log.date >= rawStart && log.date <= end)
      : logsInRange;
    const activityLogs = sourceLogs.filter((log) => loggerTaskFilter === "all" || log.taskId === loggerTaskFilter);
    const totals = new Map<string, number>();
    const categoryTotalsByDate = new Map<string, Map<string, number>>();
    const unresolvedCategoryKey = "__unresolved__";
    for (const log of activityLogs) {
      const hours = log.hours ?? 0;
      totals.set(log.date, (totals.get(log.date) ?? 0) + hours);

      if (loggerTaskFilter === "all") {
        const task = taskById[log.taskId] ?? null;
        const category = task ? categoryById[task.courseId] ?? null : null;
        const categoryKey = category?.id ?? unresolvedCategoryKey;
        const dateTotals = categoryTotalsByDate.get(log.date) ?? new Map<string, number>();
        dateTotals.set(categoryKey, (dateTotals.get(categoryKey) ?? 0) + hours);
        categoryTotalsByDate.set(log.date, dateTotals);
      }
    }

    const selectedTask = loggerTaskFilter === "all" ? null : taskById[loggerTaskFilter] ?? null;
    const selectedCategory = selectedTask ? categoryById[selectedTask.courseId] ?? null : null;
    const colour = loggerTaskFilter === "all" ? null : selectedCategory?.colour ?? null;
    const dominantColourForDate = (date: string) => {
      if (loggerTaskFilter !== "all") return colour;
      const dateTotals = categoryTotalsByDate.get(date);
      if (!dateTotals?.size) return null;

      const dominant = Array.from(dateTotals.entries()).sort(([categoryA, hoursA], [categoryB, hoursB]) => {
        if (hoursB !== hoursA) return hoursB - hoursA;
        const orderA = categoryA === unresolvedCategoryKey ? Number.POSITIVE_INFINITY : categoryById[categoryA]?.sortOrder ?? Number.POSITIVE_INFINITY;
        const orderB = categoryB === unresolvedCategoryKey ? Number.POSITIVE_INFINITY : categoryById[categoryB]?.sortOrder ?? Number.POSITIVE_INFINITY;
        if (orderA !== orderB) return orderA - orderB;
        return categoryA.localeCompare(categoryB);
      })[0]?.[0];

      return dominant && dominant !== unresolvedCategoryKey ? categoryById[dominant]?.colour ?? null : null;
    };

    const days = loggerDaysForRange({ start: rawStart, end }).map((date) => ({
      date,
      hours: totals.get(date) ?? 0,
      colour: dominantColourForDate(date),
    }));
    const nonZeroHours = days.map((day) => day.hours).filter((hours) => hours > 0);
    const thresholds = loggerActivityThresholds(nonZeroHours);
    const compact = loggerRangeMode === "year" || days.length > 62;
    const displayMode =
      loggerRangeMode === "week" || (loggerRangeMode === "custom" && days.length <= 14)
        ? "strip"
        : loggerRangeMode === "month" || (loggerRangeMode === "custom" && days.length <= 62)
          ? "month"
          : "contribution";
    const alignStart = displayMode === "strip" ? rawStart : startOfLoggerWeek(rawStart);
    const weeks: { weekStart: string; days: { date: string; hours: number; colour: string | null }[] }[] = [];
    let cursor = alignStart;

    while (cursor <= end || weeks.length === 0) {
      const weekDays = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDaysISO(cursor, dayIndex);
        return {
          date,
          hours: date >= rawStart && date <= end ? totals.get(date) ?? 0 : 0,
          colour: date >= rawStart && date <= end ? dominantColourForDate(date) : null,
        };
      });

      weeks.push({ weekStart: cursor, days: weekDays });
      cursor = addDaysISO(cursor, 7);
    }

    return { rawStart, end, days, weeks, compact, displayMode, thresholds, colour };
  }, [categoryById, clientToday, closedTimeLogs, loggerDateRange, loggerRangeMode, loggerTaskFilter, logsInRange, taskById]);

  useEffect(() => {
    if (mode !== "logger" || loggerRangeMode !== "month") return;
    const frame = window.requestAnimationFrame(() => {
      const scroller = loggerMonthActivityScrollRef.current;
      if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [clientToday, loggerRangeMode, mode]);

  const loggerBreakdown = useMemo(() => {
    const scopedLogs = logsInRange.filter((log) => loggerTaskFilter === "all" || log.taskId === loggerTaskFilter);
    const totalHours = scopedLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
    const taskTotals = new Map<string, number>();
    const categoryTotals = new Map<string, number>();

    for (const log of scopedLogs) {
      const taskKey = log.taskId || "archived";
      taskTotals.set(taskKey, (taskTotals.get(taskKey) ?? 0) + (log.hours ?? 0));

      const task = taskById[log.taskId];
      const categoryKey = task?.courseId ?? "archived";
      categoryTotals.set(categoryKey, (categoryTotals.get(categoryKey) ?? 0) + (log.hours ?? 0));
    }

    const taskRows = Array.from(taskTotals.entries())
      .map(([taskId, hours]) => {
        const task = taskById[taskId];
        const category = task ? categoryById[task.courseId] ?? null : null;
        return {
          id: taskId,
          title: task?.title ?? "Archived task",
          subtitle: category ? categoryHeaderName(category) : task ? courseLabel(task.courseId) : "Archived / unknown category",
          categoryId: category?.id ?? null,
          hours,
          colour: category?.colour ?? null,
        };
      })
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.title.localeCompare(b.title));

    const categoryRows = Array.from(categoryTotals.entries())
      .map(([categoryId, hours]) => {
        const category = categoryById[categoryId] ?? null;
        return {
          id: categoryId,
          title: category ? categoryHeaderName(category) : "Archived / unknown category",
          subtitle: categoryId === "archived" ? "Historical logs" : "Category",
          categoryId: category?.id ?? null,
          hours,
          colour: category?.colour ?? null,
        };
      })
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.title.localeCompare(b.title));

    const rows = loggerBreakdownMode === "tasks" ? taskRows : categoryRows;
    return {
      totalHours,
      rows,
      maxHours: rows[0]?.hours ?? 0,
    };
  }, [categoryById, courseLabel, loggerBreakdownMode, loggerTaskFilter, logsInRange, taskById]);

  useEffect(() => {
    setLoggerBreakdownExpanded(false);
  }, [loggerBreakdownMode, loggerDateRange.end, loggerDateRange.start, loggerTaskFilter]);

  function openNewTaskForCourse(courseId: string) {
    setNewCourseId(courseId);
    setNewOpen(true);
  }

  function resetCategoryDraft() {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryEmoji("");
    setCategoryColour("slate");
    setCategorySaving(false);
  }

  function openAddCategory() {
    resetCategoryDraft();
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategory(category);
    setCategoryName(category.label);
    setCategoryEmoji(category.emoji);
    setCategoryColour(category.colour ?? "slate");
    setCategoryModalOpen(true);
  }

  function makeCategoryId(label: string) {
    const slug =
      label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "category";
    return `${slug}_${uid().slice(0, 8)}`;
  }

  async function submitCategory() {
    const label = categoryName.trim();
    if (!label || categorySaving) return;

    const emoji = categoryEmoji.trim();
    const colour = CATEGORY_COLOURS.some((option) => option.id === categoryColour)
      ? categoryColour
      : "slate";

    setCategorySaving(true);

    if (editingCategory) {
      const saved = await updateCategory(SYNC_CODE, editingCategory.id, {
        label,
        emoji,
        colour,
      });

      if (!saved.ok || !saved.category) {
        setCategorySaving(false);
        window.alert("Category update failed. Existing categories were not changed.");
        return;
      }

      setCategories((prev) =>
        prev.map((category) => (category.id === editingCategory.id ? saved.category as Category : category))
      );
      setCategoryModalOpen(false);
      resetCategoryDraft();
      return;
    }

    const sortOrder =
      categories.reduce((max, category) => Math.max(max, category.sortOrder), -1) + 1;
    const saved = await createCategory(SYNC_CODE, {
      id: makeCategoryId(label),
      label,
      emoji,
      colour,
      sortOrder,
    });

    if (!saved.ok || !saved.category) {
      setCategorySaving(false);
      window.alert("Category creation failed. Existing categories were not changed.");
      return;
    }

    setCategories((prev) =>
      [...prev, saved.category as Category].sort((a, b) => a.sortOrder - b.sortOrder)
    );
    setCategoryModalOpen(false);
    resetCategoryDraft();
  }

  async function archiveCategory(category: Category) {
    if (categorySaving) return;

    const assignedCount = tasks.filter((task) => task.courseId === category.id).length;
    if (assignedCount > 0) {
      const confirmed = window.confirm(
        `This category still has ${assignedCount} tasks. Archiving will hide it from normal use but will not remove those tasks.`
      );
      if (!confirmed) return;
    }

    setCategorySaving(true);
    const saved = await updateCategoryArchived(SYNC_CODE, category.id, true);

    if (!saved.ok || !saved.category) {
      setCategorySaving(false);
      window.alert("Category archive failed. Existing categories and tasks were not changed.");
      return;
    }

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? saved.category as Category : item))
    );
    if (courseFilter === category.id) setCourseFilter("all");
    setCategoryModalOpen(false);
    resetCategoryDraft();
  }

  async function restoreCategory(category: Category) {
    const saved = await updateCategoryArchived(SYNC_CODE, category.id, false);

    if (!saved.ok || !saved.category) {
      window.alert("Category restore failed. Existing categories and tasks were not changed.");
      return;
    }

    setCategories((prev) =>
      prev.map((item) => (item.id === category.id ? saved.category as Category : item))
    );
  }

  function submitNewTask() {
    const title = newTitle.trim();
    if (!title) return;

    const diff = optionalFiniteNumber(newDifficulty);
    const deadlineMode = newDue ? "date" : newVisionHorizon ? "vision" : undefined;

    const t: Task = {
      id: uid(),
      title,
      courseId: newCourseId || firstCategoryId,
      status: newStatus,
      priority: newPriority,
      due: deadlineMode === "date" ? newDue : deadlineMode === "vision" ? null : undefined,
      deadlineMode,
      visionHorizon: deadlineMode === "vision" ? newVisionHorizon : null,
      activityType: newActivityType,
      effortLevel: newEffortLevel,
      notes: newNotes.trim() || undefined,
      durationHrs: null,
      difficulty: diff,
      completedAt: newStatus === "completed" ? new Date().toISOString() : null,
      createdAt: Date.now(),
    };

    setTasks((prev) => [t, ...prev]);

    // reset
    setNewTitle("");
    setNewStatus("to_do");
    setNewPriority("normal");
    setNewDue("");
    setNewDeadlineMode(undefined);
    setNewVisionHorizon(null);
    setNewActivityType(undefined);
    setNewEffortLevel("moderate");
    setNewDifficulty("3");
    setNewNotes("");
    setNewCourseId(firstCategoryId);

    setNewOpen(false);
  }

  function deleteTask(id: string) {
    createLocalBackup(tasks, timeLogsRef.current);
    refreshBackupStatus();
    const deletedAt = new Date().toISOString();
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, deletedAt } : task)));
  }

  function updateTaskStatus(id: string, status: Status) {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? applyTaskStatus(task, status) : task))
    );
    setOpenStatusTaskId(null);
  }

  function completeTask(id: string) {
    updateTaskStatus(id, "completed");
  }

  function restoreTask(id: string) {
    updateTaskStatus(id, "to_do");
  }

  function restoreDeletedTask(id: string) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, deletedAt: null } : task)));
  }

  function movePlannerWeek(direction: -1 | 1) {
    setPlannerAnchorDate(addDaysISO(plannerAnchor, direction * 7));
  }

  function movePlannerMonth(direction: -1 | 1) {
    setPlannerAnchorDate(addMonthsISO(plannerAnchor, direction));
  }

  function movePlannerThreeMonth(direction: -1 | 1) {
    setPlannerAnchorDate(addMonthsISO(plannerAnchor, direction));
  }

  function movePlannerYear(direction: -1 | 1) {
    setPlannerAnchorDate(addYearsISO(plannerAnchor, direction));
  }

  function returnPlannerToToday() {
    const today = todayISO();
    setClientToday(today);
    setClientNowMs(Date.now());
    setPlannerAnchorDate(today);
  }

  function openPlannerEventTypeChooser() {
    setPlannerEventModalMode("create");
    setPlannerEventDraft(defaultPlannerEventDraft("admin", clientToday || plannerWeekDays[0] || todayISO()));
    setPlannerEventMoreDetailsOpen(false);
    setPlannerEventTypeChooserOpen(false);
    setPlannerEventError(null);
    setPlannerEventModalOpen(true);
  }

  function openSmartImport() {
    setSmartImportOpen(true);
    setSmartImportMessage(null);
  }

  function closeSmartImport() {
    if (smartImportSaving) return;
    setSmartImportOpen(false);
    setSmartImportMessage(null);
  }

  function parseSmartImportInput() {
    const contextYear = smartImportContextYear(plannerAnchor);
    const proposals = parseSmartScheduleImport(smartImportRaw, contextYear);
    setSmartImportProposals(proposals);
    setSmartImportMessage(
      proposals.length
        ? `Parsed ${proposals.length} proposed event${proposals.length === 1 ? "" : "s"} using ${contextYear} where a year was not written.`
        : "No schedule items were found."
    );
  }

  function resetSmartImport() {
    if (smartImportSaving) return;
    setSmartImportRaw("");
    setSmartImportProposals([]);
    setSmartImportMessage(null);
  }

  function updateSmartImportProposal(id: string, patch: Partial<SmartImportProposal>) {
    setSmartImportProposals((prev) =>
      prev.map((proposal) => {
        if (proposal.id !== id) return proposal;
        const next = { ...proposal, ...patch };
        return {
          ...next,
          warnings: validateSmartImportProposal(next),
        };
      })
    );
  }

  async function confirmSmartImport() {
    if (smartImportSaving) return;

    const selected = smartImportProposals.filter((proposal) => proposal.include && !proposal.savedEventId);
    const invalid = selected.filter((proposal) => validateSmartImportProposal(proposal).length > 0);
    if (invalid.length) {
      setSmartImportMessage("Some selected events still need missing fields before they can be added.");
      return;
    }

    if (!selected.length) {
      setSmartImportMessage("No unsaved selected events to add.");
      return;
    }

    setSmartImportSaving(true);
    let savedCount = 0;
    const failedIds: string[] = [];
    const timezone = browserTimezone();

    for (const proposal of selected) {
      const event = smartImportProposalToCalendarEvent(proposal, timezone);
      if (!event) {
        failedIds.push(proposal.id);
        continue;
      }

      const savedEvent = await savePlannerCalendarEvent(event);
      if (!savedEvent) {
        failedIds.push(proposal.id);
        continue;
      }

      savedCount += 1;
      setCalendarEvents((prev) => [...prev, savedEvent]);
      setSmartImportProposals((prev) =>
        prev.map((item) =>
          item.id === proposal.id
            ? { ...item, savedEventId: savedEvent.id, include: false }
            : item
        )
      );
    }

    setSmartImportSaving(false);
    setSmartImportMessage(
      failedIds.length
        ? `Added ${savedCount}. ${failedIds.length} item${failedIds.length === 1 ? "" : "s"} failed and can be retried.`
        : `Added ${savedCount} event${savedCount === 1 ? "" : "s"}.`
    );
  }

  function startPlannerEventCreate(eventType: CalendarEventType) {
    setPlannerEventModalMode("create");
    setPlannerEventDraft(defaultPlannerEventDraft(eventType, clientToday || plannerWeekDays[0] || todayISO()));
    setPlannerEventMoreDetailsOpen(false);
    setPlannerEventTypeChooserOpen(false);
    setPlannerEventError(null);
  }

  function openPlannerEventEdit(event: CalendarEvent) {
    const parentId = parentIdForPlannerOccurrence(event);
    const parentEvent = parentId ? calendarEvents.find((item) => item.id === parentId) : null;
    const parentRule = parseWeeklyRecurrenceRule(parentEvent?.recurrenceRule);
    const draft = plannerDraftFromEvent(event);

    setPlannerEventModalMode("edit");
    const nextDraft = parentRule
      ? {
          ...draft,
          repeat: "weekly" as const,
          recurrenceWeekday: parentRule.weekday,
          recurrenceStartDate: parentRule.startDate,
          recurrenceEndDate: parentRule.endDate,
        }
      : draft;

    setPlannerEventDraft(nextDraft);
    setPlannerEventMoreDetailsOpen(plannerDraftHasMoreDetails(nextDraft));
    setPlannerEventTypeChooserOpen(false);
    setPlannerEventError(null);
    setPlannerEventModalOpen(true);
  }

  function closePlannerEventModal() {
    if (plannerEventSaving) return;
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
    setPlannerEventMoreDetailsOpen(false);
    setPlannerEventTypeChooserOpen(false);
    setPlannerEventError(null);
  }

  async function submitPlannerEvent() {
    if (!plannerEventDraft || plannerEventSaving) return;

    const { event, error } = calendarEventFromDraft(plannerEventDraft);
    if (!event || error) {
      setPlannerEventError(error ?? "Could not save this event.");
      return;
    }

    setPlannerEventSaving(true);
    setPlannerEventError(null);

    const parentEvent = plannerEventDraft.recurrenceParentId
      ? calendarEvents.find((item) => item.id === plannerEventDraft.recurrenceParentId)
      : null;
    const parentRule = parseWeeklyRecurrenceRule(parentEvent?.recurrenceRule);

    if (plannerEventDraft.recurrenceParentId && plannerEventDraft.recurrenceApplyScope === "all" && parentEvent) {
      const nextRule = parentRule
        ? stringifyWeeklyRecurrenceRule({
            ...parentRule,
            weekday: plannerEventDraft.recurrenceWeekday,
            startDate: plannerEventDraft.recurrenceStartDate,
            endDate: plannerEventDraft.recurrenceEndDate,
            startTime: plannerEventDraft.startTime,
            endTime: plannerEventDraft.endTime,
            timezone: plannerEventDraft.timezone || parentRule.timezone,
          })
        : parentEvent.recurrenceRule;
      const eventToSave: CalendarEvent = {
        ...event,
        id: parentEvent.id,
        recurrenceParentId: null,
        recurrenceExceptionDate: null,
        recurrenceStatus: null,
        recurrenceRule: nextRule,
      };
      const savedEvent = await savePlannerCalendarEvent(eventToSave);
      setPlannerEventSaving(false);

      if (!savedEvent) {
        setPlannerEventError("Could not save series. Please check the console for details.");
        return;
      }

      setCalendarEvents((prev) => prev.map((item) => (item.id === savedEvent.id ? savedEvent : item)));
      setPlannerEventModalOpen(false);
      setPlannerEventDraft(null);
      return;
    }

    if (
      plannerEventDraft.recurrenceParentId &&
      plannerEventDraft.recurrenceApplyScope === "future" &&
      parentEvent &&
      parentRule &&
      plannerEventDraft.recurrenceExceptionDate
    ) {
      const oldEndDate = addDaysISO(plannerEventDraft.recurrenceExceptionDate, -1);
      if (oldEndDate < parentRule.startDate) {
        setPlannerEventSaving(false);
        setPlannerEventError("Cannot split before the series start.");
        return;
      }

      const oldParent: CalendarEvent = {
        ...parentEvent,
        recurrenceRule: stringifyWeeklyRecurrenceRule({ ...parentRule, endDate: oldEndDate }),
      };
      const newParent: CalendarEvent = {
        ...event,
        id: createCalendarEventId(),
        recurrenceParentId: null,
        recurrenceExceptionDate: null,
        recurrenceStatus: null,
        recurrenceRule: stringifyWeeklyRecurrenceRule({
          ...parentRule,
          startDate: plannerEventDraft.recurrenceExceptionDate,
          endDate: parentRule.endDate,
          weekday: plannerEventDraft.recurrenceWeekday,
          startTime: plannerEventDraft.startTime,
          endTime: plannerEventDraft.endTime,
          timezone: plannerEventDraft.timezone || parentRule.timezone,
        }),
      };

      const savedNew = await savePlannerCalendarEvent(newParent);
      const savedOld = savedNew ? await savePlannerCalendarEvent(oldParent) : null;
      setPlannerEventSaving(false);

      if (!savedNew || !savedOld) {
        if (savedNew) {
          await deleteCalendarEvent(newParent.id, SYNC_CODE);
        }
        setPlannerEventError("Could not split this series safely. Please try again.");
        return;
      }

      setCalendarEvents((prev) => [
        ...prev.map((item) => (item.id === savedOld.id ? savedOld : item)),
        savedNew,
      ]);
      setPlannerEventModalOpen(false);
      setPlannerEventDraft(null);
      return;
    }

    const eventToSave = plannerEventDraft.recurrenceParentId
      ? exceptionEventForPlannerOccurrence(event)
      : event;
    const savedEvent = await savePlannerCalendarEvent(eventToSave);
    setPlannerEventSaving(false);

    if (!savedEvent) {
      setPlannerEventError("Could not save event. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => {
      const exists = prev.some((item) => item.id === savedEvent.id);
      return exists
        ? prev.map((item) => (item.id === savedEvent.id ? savedEvent : item))
        : [...prev, savedEvent];
    });
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  async function removePlannerEvent() {
    if (!plannerEventDraft || plannerEventModalMode !== "edit" || plannerEventSaving) return;

    setPlannerEventSaving(true);
    setPlannerEventError(null);

    const deleted = await deleteCalendarEvent(plannerEventDraft.id, SYNC_CODE);
    setPlannerEventSaving(false);

    if (!deleted) {
      setPlannerEventError("Could not delete event. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => prev.filter((event) => event.id !== plannerEventDraft.id));
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  async function cancelPlannerRecurringOccurrence() {
    if (
      !plannerEventDraft ||
      plannerEventModalMode !== "edit" ||
      !plannerEventDraft.recurrenceParentId ||
      !plannerEventDraft.recurrenceExceptionDate ||
      plannerEventSaving
    ) {
      return;
    }

    const { event, error } = calendarEventFromDraft(plannerEventDraft);
    if (!event || error) {
      setPlannerEventError(error ?? "Could not cancel this occurrence.");
      return;
    }

    const cancellation: CalendarEvent = {
      ...event,
      id: calendarEvents.some((item) => item.id === plannerEventDraft.id)
        ? plannerEventDraft.id
        : createCalendarEventId(),
      recurrenceRule: null,
      recurrenceParentId: plannerEventDraft.recurrenceParentId,
      recurrenceExceptionDate: plannerEventDraft.recurrenceExceptionDate,
      recurrenceStatus: "cancelled",
      metadata: {},
    };

    setPlannerEventSaving(true);
    setPlannerEventError(null);
    const savedEvent = await savePlannerCalendarEvent(cancellation);
    setPlannerEventSaving(false);

    if (!savedEvent) {
      setPlannerEventError("Could not cancel occurrence. Please check the console for details.");
      return;
    }

    setCalendarEvents((prev) => {
      const exists = prev.some((item) => item.id === savedEvent.id);
      return exists
        ? prev.map((item) => (item.id === savedEvent.id ? savedEvent : item))
        : [...prev, savedEvent];
    });
    setPlannerEventModalOpen(false);
    setPlannerEventDraft(null);
  }

  function beginPlannerEventInteraction(
    event: React.PointerEvent<HTMLDivElement>,
    calendarEvent: CalendarEvent,
    kind: "move" | "resize"
  ) {
    if (event.button !== 0 || calendarEvent.allDay || !calendarEvent.startAt || !calendarEvent.endAt) return;

    const startMinutes = localMinutesFromTimestamp(calendarEvent.startAt);
    const endMinutes = localMinutesFromTimestamp(calendarEvent.endAt);
    const startDate = eventLocalDate(calendarEvent.startAt);
    const endDate = eventLocalDate(calendarEvent.endAt);
    const grid = event.currentTarget.closest("[data-planner-week-grid='true']");

    if (
      startMinutes === null ||
      endMinutes === null ||
      !startDate ||
      !endDate ||
      startDate !== endDate ||
      !grid
    ) {
      return;
    }

    const duration = endMinutes - startMinutes;
    const visibleDuration = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 60;
    if (duration < PLANNER_SNAP_MINUTES || duration > visibleDuration) return;

    const gridRect = grid.getBoundingClientRect();
    const dayWidth = (gridRect.width - 64) / 7;
    if (!Number.isFinite(dayWidth) || dayWidth <= 0) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    setPlannerInteraction({
      kind,
      eventId: calendarEvent.id,
      originalEvent: calendarEvent,
      previewEvent: calendarEvent,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      gridLeft: gridRect.left,
      dayWidth,
      originalStartMinutes: startMinutes,
      originalEndMinutes: endMinutes,
      originalDurationMinutes: duration,
      hasMoved: false,
    });
  }

  function openEdit(t: Task) {
    setEditingPlannerTaskDeadline(false);
    setDraft(t);
    setEditOpen(true);
  }

  function openPlannerTaskDeadlineEdit(task: Task) {
    setEditingPlannerTaskDeadline(true);
    setDraft(task);
    setEditOpen(true);
  }

  function closeTaskEdit() {
    setEditOpen(false);
    setDraft(null);
    setEditingPlannerTaskDeadline(false);
  }

  function removeTaskDeadline(id: string) {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? { ...task, due: null, deadlineMode: undefined, visionHorizon: null }
          : task
      )
    );
    closeTaskEdit();
  }

  function saveEdit(next: Task) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === next.id
          ? applyTaskStatus(
              { ...next, completedAt: next.completedAt ?? t.completedAt ?? null },
              next.status
            )
          : t
      )
    );
    closeTaskEdit();
  }

  function openLogTime(taskId?: string, date = clientToday || todayISO(), log?: TimeLog) {
    const selectedTaskId = taskId ?? loggerTasks[0]?.id ?? logTaskOptions[0]?.id ?? "";
    const existing = log ?? null;
    const existingHoursInput = existing && isClosedTimeLog(existing) ? formatHourInput(existing.hours) : "";
    const startDate = existing?.date ?? date;

    setPlannerLogSourceEventId(null);
    setEditingLogId(existing?.id ?? null);
    setLogTaskId(existing?.taskId ?? selectedTaskId);
    setLogDate(startDate);
    setLogStartTime(existing?.startTime ?? "");
    setLogEndDate(existing?.endDate ?? startDate);
    setLogEndTime(existing?.endTime ?? "");
    setLogHoursInput(existingHoursInput);
    setLogNote(existing?.note ?? "");
    setLogOpen(true);
  }

  async function savePlannerWorkResolution(
    event: CalendarEvent,
    status: PlannerWorkResolutionStatus,
  loggedTimeLogId: string | null = null
) {
  const resolvedEvent = withPlannerWorkResolution(event, status, loggedTimeLogId);
  const savedEvent = await savePlannerCalendarEvent(resolvedEvent);

  if (!savedEvent) {
    console.warn("Failed to save Planner work resolution", {
      eventId: event.id,
      status,
        loggedTimeLogId,
      });
      return false;
  }

  setCalendarEvents((prev) =>
    prev.map((item) => (item.id === savedEvent.id ? savedEvent : item))
  );
  return true;
}

  async function logPlannerWorkAsPlanned(event: CalendarEvent) {
    if (plannerWorkActionSavingId || plannerWorkResolutionStatus(event)) return;
    const log = plannedWorkTimeLogFromEvent(event);

    if (!log || !event.taskId || !taskById[event.taskId]) {
      console.warn("Cannot log planned work without a linked task and valid planned time", { eventId: event.id });
      return;
    }

    setPlannerWorkActionSavingId(event.id);
    const savedLog = await saveSupabaseTimeLog(SYNC_CODE, log);

    if (!savedLog) {
      console.warn("Failed to save TimeLog from planned work", { eventId: event.id, logId: log.id });
      setPlannerWorkActionSavingId(null);
      return;
    }

    const savedResolution = await savePlannerWorkResolution(event, "logged", log.id);

    if (!savedResolution) {
      await deleteSupabaseTimeLog(SYNC_CODE, log.id);
      setPlannerWorkActionSavingId(null);
      return;
    }

    setTimeLogs((prev) => [log, ...prev]);
    setPlannerWorkActionSavingId(null);
  }

  function adjustPlannerWorkLog(event: CalendarEvent) {
    if (plannerWorkResolutionStatus(event)) return;
    const log = plannedWorkTimeLogFromEvent(event);

    if (!log || !event.taskId || !taskById[event.taskId]) {
      openPlannerEventEdit(event);
      return;
    }

    setPlannerLogSourceEventId(event.id);
    setEditingLogId(null);
    setLogTaskId(log.taskId);
    setLogDate(log.date);
    setLogStartTime(log.startTime ?? "");
    setLogEndDate(log.endDate ?? log.date);
    setLogEndTime(log.endTime ?? "");
    setLogHoursInput(formatHourInput(log.hours ?? 0));
    setLogNote(log.note);
    setLogOpen(true);
  }

  async function skipPlannerWorkEvent(event: CalendarEvent) {
    if (plannerWorkActionSavingId || plannerWorkResolutionStatus(event)) return;

    setPlannerWorkActionSavingId(event.id);
    await savePlannerWorkResolution(event, "skipped");
    setPlannerWorkActionSavingId(null);
  }

  function setLoggerAnchor(nextAnchor: string) {
    setLoggerAnchorDate(nextAnchor);
  }

  function moveLoggerSelectedRange(direction: -1 | 1) {
    if (loggerRangeMode === "custom") return;

    const anchor = isValidISODate(loggerAnchorDate)
      ? loggerAnchorDate
      : isValidISODate(clientToday)
        ? clientToday
        : todayISO();
    const nextAnchor =
      loggerRangeMode === "day"
        ? addDaysISO(anchor, direction)
        : loggerRangeMode === "week"
        ? addDaysISO(anchor, direction * 7)
        : loggerRangeMode === "month"
          ? addMonthsISO(anchor, direction)
          : addYearsISO(anchor, direction);

    setLoggerAnchor(nextAnchor);
  }

  function returnLoggerRangeToToday() {
    const today = todayISO();
    setClientToday(today);
    setLoggerAnchor(today);
  }

  async function persistTimeLogDraft(next: TimeLog, existing: TimeLog | null, sourcePlannerEvent: CalendarEvent | null) {
    const saved = await saveSupabaseTimeLog(SYNC_CODE, next);

    if (!saved) {
      console.warn("Unexpected Supabase time log save failure:", {
        operation: existing ? "edit" : "create",
        id: next.id,
      });
      if (sourcePlannerEvent) return false;
    }

    if (sourcePlannerEvent) {
      const savedResolution = await savePlannerWorkResolution(sourcePlannerEvent, "logged", next.id);
      if (!savedResolution) {
        await deleteSupabaseTimeLog(SYNC_CODE, next.id);
        return false;
      }
    }

    setTimeLogs((prev) => {
      if (!existing) return [next, ...prev];
      return prev.map((entry) => (entry.id === existing.id ? next : entry));
    });

    setEditingLogId(null);
    setPlannerLogSourceEventId(null);
    setLogOpen(false);
    return true;
  }

  async function submitTimeLog() {
    if (logSaving) return;
    const closingOpenSession = editingTimeLog ? isOpenTimeLog(editingTimeLog) : false;
    const hours = closingOpenSession
      ? calculatedLogHours
      : resolveClosedTimeLogHours(logHoursInput, calculatedLogHours, logStartTime, logEndTime);
    if (!logTaskId || hours === null) return;

    const date = logDate || clientToday || todayISO();
    const existing = editingTimeLog;
    const next: TimeLog = {
      id: existing?.id ?? createTimeLogId(),
      taskId: logTaskId,
      date,
      startTime: logStartTime || undefined,
      endDate: logEndTime ? logEndDate || date : null,
      endTime: logEndTime || undefined,
      hours,
      note: logNote.trim(),
    };

    const sourcePlannerEvent = plannerLogSourceEventId
      ? calendarEvents.find((event) => event.id === plannerLogSourceEventId)
      : null;
    setLogSaving(true);
    try {
      await persistTimeLogDraft(next, existing, sourcePlannerEvent);
    } finally {
      setLogSaving(false);
    }
  }

  async function startOpenTimeLog() {
    if (logSaving) return;
    const date = logDate || clientToday || todayISO();
    if (!logTaskId || !isTimeLogISODate(date) || timeLogTimeToMinutes(logStartTime) === null) return;

    const existing = editingTimeLog;
    const next: TimeLog = {
      id: existing?.id ?? createTimeLogId(),
      taskId: logTaskId,
      date,
      startTime: logStartTime,
      endDate: null,
      endTime: undefined,
      hours: null,
      note: logNote.trim(),
    };

    if (!isOpenTimeLog(next)) return;

    setLogSaving(true);
    try {
      await persistTimeLogDraft(next, existing, null);
    } finally {
      setLogSaving(false);
    }
  }

  async function endOpenTimeLogNow(log: TimeLog) {
    if (endingOpenLogId) return;

    const now = new Date();
    const endDate = localDateISO(now);
    const endTime = localTimeInput(now);
    const hours = calculateTimeLogDurationHours(log.date, log.startTime ?? "", endDate, endTime);

    if (hours === null) {
      setLoggerActionError("Could not end this session safely. Use Adjust to enter the end time.");
      return;
    }

    const next: TimeLog = {
      ...log,
      endDate,
      endTime,
      hours,
    };

    setEndingOpenLogId(log.id);
    setLoggerActionError(null);
    try {
      const saved = await saveSupabaseTimeLog(SYNC_CODE, next);
      if (!saved) {
        setLoggerActionError("Could not end session. The open session was kept.");
        return;
      }
      setTimeLogs((prev) => prev.map((entry) => (entry.id === log.id ? next : entry)));
    } finally {
      setEndingOpenLogId(null);
    }
  }

  async function deleteTimeLog(id: string) {
    if (deletingTimeLogId) return;
    const existing = timeLogs.find((log) => log.id === id);
    if (!existing) return;

    setDeletingTimeLogId(id);
    setLoggerActionError(null);
    const deleted = await deleteSupabaseTimeLog(SYNC_CODE, id);
    setDeletingTimeLogId(null);

    if (!deleted) {
      console.warn("Time log delete failed. Local state was left unchanged.", {
        operation: "delete",
        id,
      });
      setLoggerActionError("Could not delete time log. Existing Logger history was kept.");
      return;
    }

    setTimeLogs((prev) => prev.filter((log) => log.id !== id));
    if (editingLogId === id) {
      setEditingLogId(null);
      setLogOpen(false);
    }
  }

  function exportBackup() {
    const createdAt = new Date().toISOString();
    const backup = {
      createdAt,
      tasks,
      timeLogs,
      attentionWeights: weights,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${isDemoMode ? "demo" : "yasmine"}-task-backup-${createdAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch (error) {
      console.warn("Import backup failed: invalid JSON", error);
      window.alert("That backup file could not be read as JSON.");
      return;
    }

    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { tasks?: unknown }).tasks)) {
      console.warn("Import backup failed: backup does not contain a tasks array");
      window.alert("That backup is missing a tasks array.");
      return;
    }

    const incoming = parsed as {
      tasks: Array<Record<string, unknown>>;
      timeLogs?: unknown;
      attentionWeights?: unknown;
    };
    const nextTasks = incoming.tasks.map((task) => normalizeTask(task));
    const nextTimeLogs = normalizeTimeLogs(incoming.timeLogs);
    const confirmed = window.confirm(
      `Restore ${nextTasks.length} tasks from this backup? Current tasks and logs will be backed up first.`
    );

    if (!confirmed) return;

    createLocalBackup(tasks, timeLogsRef.current);
    refreshBackupStatus();

    if (incoming.attentionWeights && typeof incoming.attentionWeights === "object") {
      const restoredWeights = normalizeAttentionWeights(incoming.attentionWeights);
      setWeights(restoredWeights);
      localStorage.setItem("attentionWeights", JSON.stringify(restoredWeights));
    }

    timeLogsRef.current = nextTimeLogs;
    setTimeLogs(nextTimeLogs);
    localStorage.setItem(TIME_LOGS_STORAGE_KEY, JSON.stringify(nextTimeLogs));

    allowNextEmptySaveRef.current = true;
    allowNextDestructiveSaveRef.current = true;
    remoteLoadTrustedForDeleteRef.current = true;
    saveLocalTaskCache(nextTasks);
    setTasks(nextTasks);
  }

  function renderListFilterMenu<T extends string>({
    id,
    label,
    count,
    options,
    selected,
    onToggle,
  }: {
    id: ListFilterMenu;
    label: string;
    count: number;
    options: { id: T; label: string }[];
    selected: T[];
    onToggle: (value: T) => void;
  }) {
    const isOpen = openListFilter === id;

    return (
      <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`h-9 rounded-xl border px-3 text-sm ${
            count
              ? "border-slate-300 bg-slate-50 text-slate-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusTaskId(null);
            setOpenListFilter((open) => (open === id ? null : id));
          }}
        >
          {label}
          {count ? <span className="text-slate-400"> · {count}</span> : null}
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-full z-[1000] mt-1 min-w-[148px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5">
            {options.map((option) => {
              const active = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`block w-full whitespace-nowrap bg-white px-3 py-2 text-left ${
                    active ? "font-medium text-slate-900" : "text-slate-600"
                  } hover:bg-slate-50`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(option.id);
                  }}
                >
                  {active ? "✓ " : ""}
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function renderCategoryFilter(fullWidth = false) {
    const selectedCategory = courseFilter === "all" ? null : categoryById[courseFilter] ?? null;
    const isOpen = openListFilter === "category";

    return (
      <div className={`relative ${fullWidth ? "w-full" : "inline-flex"}`} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`flex h-9 items-center rounded-xl border px-3 text-sm ${
            fullWidth ? "w-full" : "w-[180px]"
          } ${selectedCategory ? "border-slate-300 bg-slate-50 text-slate-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusTaskId(null);
            setOpenListFilter((open) => (open === "category" ? null : "category"));
          }}
          aria-expanded={isOpen}
        >
          {selectedCategory ? <CategoryIdentity category={selectedCategory} compact /> : "Category"}
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-full z-[1000] mt-1 min-w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5">
            <button
              type="button"
              className={`block w-full whitespace-nowrap px-3 py-2 text-left hover:bg-slate-50 ${
                courseFilter === "all" ? "font-medium text-slate-900" : "text-slate-600"
              }`}
              onClick={() => {
                setCourseFilter("all");
                setOpenListFilter(null);
              }}
            >
              All categories
            </button>
            {activeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`flex w-full items-center px-3 py-2 text-left hover:bg-slate-50 ${
                  courseFilter === category.id ? "font-medium text-slate-900" : "text-slate-600"
                }`}
                onClick={() => {
                  setCourseFilter(category.id);
                  setOpenListFilter(null);
                }}
              >
                <CategoryIdentity category={category} compact />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderRangeFilterMenu({
    id,
    buttonLabel,
    title,
    range,
    defaultRange,
    minValue,
    maxValue,
    formatValue,
    setRange,
    resetLabel,
    step = 1,
  }: {
    id: Extract<ListFilterMenu, "timeLeft">;
    buttonLabel: string;
    title: string;
    range: { min: number; max: number } | null;
    defaultRange: { min: number; max: number };
    minValue: number;
    maxValue: number;
    formatValue: (value: number) => string;
    setRange: React.Dispatch<React.SetStateAction<{ min: number; max: number } | null>>;
    resetLabel: string;
    step?: number;
  }) {
    const isOpen = openListFilter === id;
    const currentRange = range ?? defaultRange;
    const minPercent = ((currentRange.min - minValue) / (maxValue - minValue)) * 100;
    const maxPercent = ((currentRange.max - minValue) / (maxValue - minValue)) * 100;

    function snap(value: number) {
      return Number((Math.round(value / step) * step).toFixed(4));
    }

    function setMin(value: number) {
      const rawMin = snap(clamp(value, minValue, maxValue));
      setRange((current) => {
        const max = current?.max ?? maxValue;
        return { min: Math.min(rawMin, max), max };
      });
    }

    function setMax(value: number) {
      const rawMax = snap(clamp(value, minValue, maxValue));
      setRange((current) => {
        const min = current?.min ?? minValue;
        return { min, max: Math.max(rawMax, min) };
      });
    }

    function valueFromPointer(clientX: number, track: HTMLDivElement) {
      const rect = track.getBoundingClientRect();
      const percent = clamp((clientX - rect.left) / rect.width, 0, 1);
      return snap(minValue + percent * (maxValue - minValue));
    }

    function beginMinDrag(e: React.PointerEvent<HTMLDivElement>) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMin(valueFromPointer(e.clientX, track));
    }

    function beginMaxDrag(e: React.PointerEvent<HTMLDivElement>) {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMax(valueFromPointer(e.clientX, track));
    }

    function dragMin(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMin(valueFromPointer(e.clientX, track));
    }

    function dragMax(e: React.PointerEvent<HTMLDivElement>) {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const track = e.currentTarget.parentElement;
      if (track instanceof HTMLDivElement) setMax(valueFromPointer(e.clientX, track));
    }

    return (
      <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={`h-9 rounded-xl border px-3 text-sm ${
            range
              ? "border-slate-300 bg-slate-50 text-slate-800"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusTaskId(null);
            setOpenListFilter((open) => (open === id ? null : id));
          }}
        >
          {buttonLabel}
        </button>
        {isOpen ? (
          <div className="absolute left-0 top-full z-[1000] mt-1 w-[230px] rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl ring-1 ring-slate-900/5">
            <div className="font-medium text-slate-700">{title}</div>

            <div className="mt-4">
              <div className="mb-2 flex justify-between tabular-nums text-slate-500">
                <span>{formatValue(currentRange.min)}</span>
                <span>{formatValue(currentRange.max)}</span>
              </div>
              <div className="relative h-7">
                <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
                <div
                  className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-slate-900"
                  style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }}
                />
                <div
                  className="absolute top-1/2 z-30 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-slate-900 bg-slate-900 shadow-sm active:cursor-grabbing"
                  style={{ left: `${minPercent}%` }}
                  onPointerDown={beginMinDrag}
                  onPointerMove={dragMin}
                />
                <div
                  className="absolute top-1/2 z-40 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border border-slate-900 bg-slate-900 shadow-sm active:cursor-grabbing"
                  style={{ left: `${maxPercent}%` }}
                  onPointerDown={beginMaxDrag}
                  onPointerMove={dragMax}
                />
                <input
                  type="range"
                  aria-label={`${title} minimum`}
                  min={minValue}
                  max={maxValue}
                  step={step}
                  value={currentRange.min}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="sr-only"
                />
                <input
                  type="range"
                  aria-label={`${title} maximum`}
                  min={minValue}
                  max={maxValue}
                  step={step}
                  value={currentRange.max}
                  onChange={(e) => setMax(Number(e.target.value))}
                  className="sr-only"
                />
              </div>
            </div>

            <button
              type="button"
              className="mt-2 rounded-full px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setRange(null);
              }}
            >
              {resetLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderTimeLeftFilterMenu() {
    const range = timeLeftFilter ?? { min: TIME_LEFT_MIN, max: TIME_LEFT_MAX };
    return renderRangeFilterMenu({
      id: "timeLeft",
      buttonLabel: timeLeftFilter ? `Time left · ${range.min}-${range.max}d` : "Time left",
      title: "Time left",
      range: timeLeftFilter,
      defaultRange: { min: TIME_LEFT_MIN, max: TIME_LEFT_MAX },
      minValue: TIME_LEFT_MIN,
      maxValue: TIME_LEFT_MAX,
      formatValue: (value) => `${value}d`,
      setRange: setTimeLeftFilter,
      resetLabel: "Reset time left",
      step: 1,
    });
  }

  function renderTemporalLogButton(row: (typeof temporalLogRows)[number], density: "day" | "week" | "timeline" = "day") {
    const isWeek = density === "week";
    const isTimeline = density === "timeline";
    const duration = formatDuration(row.log.hours ?? row.exactDuration ?? 0);
    const dayBlockHeight = row.exactDuration === null ? 48 : clamp(row.exactDuration * 48, 48, 184);
    const timelineStartMinutes =
      row.startMinutes < LOGGER_DAY_TIMELINE_START_MINUTES ? row.startMinutes + 24 * 60 : row.startMinutes;
    const timelineTop = ((timelineStartMinutes - LOGGER_DAY_TIMELINE_START_MINUTES) / 60) * LOGGER_DAY_TIMELINE_PX_PER_HOUR;
    const timelineHeight = Math.max(32, (row.exactDuration ?? 0) * LOGGER_DAY_TIMELINE_PX_PER_HOUR);
    const isCompactTimeline = isTimeline && timelineHeight < 64;
    const timeLabel =
      row.log.startTime && row.log.endTime
        ? `${row.log.startTime}-${row.log.endTime}`
        : row.log.startTime
          ? row.log.startTime
          : "Manual";

    return (
      <button
        key={row.log.id}
        type="button"
        onClick={() => openLogTime(row.log.taskId, row.log.date, row.log)}
        className={`group grid w-full grid-cols-[4px_1fr] overflow-hidden rounded-2xl border text-left transition-colors hover:bg-white ${
          row.tone.border
        } ${row.tone.bg} ${isWeek ? "min-h-16" : ""}`}
        style={
          isTimeline
            ? { position: "absolute", top: `${timelineTop}px`, left: 0, right: 0, height: `${timelineHeight}px`, minHeight: "32px" }
            : isWeek
              ? undefined
              : { height: `${dayBlockHeight}px`, minHeight: "48px" }
        }
      >
        <span className={row.tone.accent} aria-hidden="true" />
        <span
          className={
            isWeek
              ? "min-w-0 px-2.5 py-2"
              : isCompactTimeline
                ? "flex min-w-0 items-center gap-2 px-2 py-0"
                : "min-w-0 px-3 py-1"
          }
        >
          {isCompactTimeline ? (
            <>
              <span className={`shrink-0 text-[11px] tabular-nums ${row.tone.muted}`}>{timeLabel}</span>
              <span className={`min-w-0 flex-1 truncate text-xs font-semibold ${row.tone.text}`}>{row.taskTitle}</span>
              <span className="inline-flex min-w-0 max-w-[30%] truncate text-[10px] text-slate-400 sm:max-w-[34%]">
                {row.categoryId ? renderCategoryIdentity(row.categoryId) : row.categoryLabel}
              </span>
              <span className={`ml-auto shrink-0 text-[11px] font-semibold tabular-nums ${row.tone.muted}`}>{duration}</span>
            </>
          ) : isWeek ? (
            <>
              <span className={`block truncate text-xs font-semibold ${row.tone.text}`}>
                {row.taskTitle}
              </span>
              <span className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] tabular-nums ${row.tone.muted}`}>
                <span>{timeLabel}</span>
                <span>{duration}</span>
              </span>
            </>
          ) : (
            <>
              <span className={`flex items-baseline justify-between gap-3 text-xs tabular-nums ${row.tone.muted}`}>
                <span>{timeLabel}</span>
                <span className="font-semibold">{duration}</span>
              </span>
              <span className={`mt-0.5 block truncate text-sm font-semibold leading-tight ${row.tone.text}`}>
                {row.taskTitle}
              </span>
              <span className="mt-0.5 hidden min-w-0 text-[11px] leading-none text-slate-400 sm:inline-flex">
                {row.categoryId ? renderCategoryIdentity(row.categoryId) : row.categoryLabel}
              </span>
            </>
          )}
        </span>
      </button>
    );
  }

  const pageTitle = modeLabel(mode);
  const pageSubtitle = modeSubtitle(mode);

  function renderPlannerEventLegend() {
    return (
      <div className="flex items-center gap-x-3 gap-y-1 overflow-x-auto px-1 pb-1 text-[10px] font-medium text-slate-500 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {PLANNER_EVENT_TYPES.map((option) => (
          <div key={option.id} className="inline-flex shrink-0 items-center gap-1.5">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full ${plannerYearMarkerTone(
                option.id
              )}`}
            >
              <PlannerYearMarkerIcon eventType={option.id} />
            </span>
            <span>{option.label}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderPlannerMonthGrid(grid: PlannerMonthGridData, density: "normal" | "three_month" = "normal") {
    const compact = density === "three_month";
    const visibleLimit = compact ? 3 : 4;

    return (
      <div className="overflow-hidden rounded-[18px] border border-slate-200/70 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100/80 bg-slate-50/40">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((weekday) => (
            <div
              key={`${grid.month.id}-${weekday}`}
              className={`border-r border-slate-100/70 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 last:border-r-0 ${
                compact ? "px-1 py-1.5" : "px-2 py-1.5"
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>

        <div>
          {grid.weeks.map((week, weekIndex) => {
            const weekSpans = grid.allDaySpansByWeek[weekIndex] ?? [];
            return (
              <div key={`${grid.month.id}-week-${week[0]?.date ?? weekIndex}`} className="relative grid grid-cols-7">
                {week.map((day) => {
                  const events = (grid.eventsByDate[day.date] ?? []).filter(
                    (item) =>
                      !(
                        item.sourceType === "calendar_event" &&
                        plannerEventRendersAsAllDaySpan(item.event)
                      )
                  );
                  const visibleEvents = events.slice(0, visibleLimit);
                  const hiddenCount = Math.max(0, events.length - visibleEvents.length);
                  const isToday = day.date === clientToday;
                  const dayTemporalState = plannerTemporalStateForDate(day.date, clientToday);

                  return (
                    <div
                      key={day.date}
                      className={`border-r border-b border-slate-100/70 px-1.5 py-1.5 [&:nth-child(7n)]:border-r-0 ${
                        compact ? "min-h-[82px]" : "min-h-[96px]"
                      } ${
                        isToday
                          ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/80"
                          : day.isCurrentMonth
                            ? "bg-white"
                            : "bg-slate-50/40"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setPlannerAnchorDate(day.date);
                          setPlannerView("week");
                        }}
                        className={`flex items-center justify-center rounded-full font-semibold tabular-nums hover:bg-slate-100 ${
                          compact ? "h-4 w-4 text-[10px]" : "h-5 w-5 text-[11px]"
                        } ${
                          isToday
                            ? "bg-slate-900 text-white hover:bg-slate-800"
                            : day.isCurrentMonth
                              ? dayTemporalState === "past"
                                ? "text-slate-400"
                                : "text-slate-700"
                              : "text-slate-300"
                        }`}
                        aria-label={`Open week containing ${day.date}`}
                      >
                        {Number(day.date.slice(8, 10))}
                      </button>

                      <div
                        className="space-y-0.5"
                        style={{ marginTop: weekSpans.length ? weekSpans.length * (compact ? 16 : 18) + 6 : 4 }}
                      >
                        {visibleEvents.map((item) => {
                          const prefix = plannerItemPrefix(item, day.date);
                          const temporalState = plannerItemTemporalState(item, clientToday, day.date);
                          return (
                            <button
                              key={`${grid.month.id}-${day.date}-${item.sourceType === "calendar_event" ? item.event.id : item.task.id}`}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.sourceType === "calendar_event") openPlannerEventEdit(item.event);
                                else openPlannerTaskDeadlineEdit(item.task);
                              }}
                              className={`flex w-full min-w-0 items-center gap-1 rounded-lg border px-1.5 py-0.5 text-left font-medium leading-4 ${
                                compact ? "text-[9px]" : "text-[10px]"
                              } ${
                                item.sourceType === "calendar_event"
                                  ? plannerEventTone(item.event.eventType, temporalState)
                                  : plannerDeadlineTone(item.task, temporalState)
                              }`}
                              title={plannerItemTitle(item)}
                            >
                              {prefix ? (
                                <span className="shrink-0 tabular-nums opacity-65">{prefix}</span>
                              ) : item.sourceType === "task_deadline" ? (
                                <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                              ) : (
                                <PlannerEventTypeIcon eventType={item.event.eventType} />
                              )}
                              <span className="truncate">{plannerItemTitle(item)}</span>
                            </button>
                          );
                        })}
                        {hiddenCount ? (
                          <div className="px-1 pt-0.5 text-[10px] font-medium text-slate-400">
                            +{hiddenCount} more
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {weekSpans.length ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-y-0.5 px-1.5"
                    style={{ gridTemplateRows: `repeat(${weekSpans.length}, ${compact ? 14 : 16}px)` }}
                  >
                    {weekSpans.map((span, index) => {
                      const timingLabel = plannerItemTimingLabel(span.item);
                      const temporalState = plannerItemTemporalState(span.item, clientToday);
                      return (
                        <button
                          key={plannerAllDaySpanKey(span, `${grid.month.id}-month-${weekIndex}`)}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (span.item.sourceType === "calendar_event") openPlannerEventEdit(span.item.event);
                            else openPlannerTaskDeadlineEdit(span.item.task);
                          }}
                          className={`pointer-events-auto flex min-w-0 items-center gap-1 border px-1.5 py-0.5 text-left font-medium leading-4 ${
                            compact ? "text-[9px]" : "text-[10px]"
                          } ${span.startsBefore ? "rounded-l-sm" : "rounded-l-lg"} ${
                            span.endsAfter ? "rounded-r-sm" : "rounded-r-lg"
                          } ${
                            span.item.sourceType === "calendar_event"
                              ? plannerEventTone(span.item.event.eventType, temporalState)
                              : plannerDeadlineTone(span.item.task, temporalState)
                          }`}
                          style={{
                            gridColumn: `${span.startIndex + 1} / span ${span.span}`,
                            gridRow: index + 1,
                          }}
                          title={plannerItemTitle(span.item)}
                        >
                          {span.item.sourceType === "calendar_event" ? (
                            <PlannerEventTypeIcon eventType={span.item.event.eventType} />
                          ) : (
                            <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                          )}
                          {timingLabel ? (
                            <span className="shrink-0 opacity-70">{timingLabel}</span>
                          ) : null}
                          <span className="truncate">{plannerItemTitle(span.item)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f7f8f8] text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200/80 bg-white/85 py-5 backdrop-blur transition-[width] duration-200 md:flex md:flex-col ${
          sidebarCollapsed ? "w-16 px-2" : "w-60 px-4"
        }`}
      >
        <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-3 px-2"}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-2 gap-0.5">
              <span className="h-2 w-2 rounded-sm bg-slate-900" />
              <span className="h-2 w-2 rounded-sm bg-slate-300" />
              <span className="h-2 w-2 rounded-sm bg-slate-300" />
              <span className="h-2 w-2 rounded-sm bg-slate-900" />
            </div>
          </div>
          {!sidebarCollapsed ? (
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-900">
              {isDemoMode ? "Tracker Playground" : "Yasmine's Tracker"}
            </div>
            <div className="text-[11px] text-slate-400">Personal operating system</div>
          </div>
          ) : null}
        </div>

        <nav className="mt-8 grid gap-1">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`group relative flex h-9 items-center rounded-xl text-sm transition-colors ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                } ${sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"}`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
                {sidebarCollapsed ? (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {item.label}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className={`mt-auto flex h-9 items-center rounded-xl text-sm text-slate-400 transition-colors hover:bg-slate-100/80 hover:text-slate-800 ${
            sidebarCollapsed ? "justify-center px-0" : "gap-2 px-3"
          }`}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
          {!sidebarCollapsed ? <span>Collapse</span> : null}
        </button>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {APP_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] transition-colors ${
                  active ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className={`min-h-screen pb-24 transition-[margin] duration-200 md:pb-8 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"}`}>
        <div className="mx-auto max-w-[1440px] px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 sm:py-5 lg:px-8">
          {mode === "meds" ? null : (
          <div className="border-b border-slate-200/70 pb-4">
            <div className="space-y-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                {isDemoMode ? "Task Tracker Playground" : "Yasmine's Tracker"}
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">{pageTitle}</h1>
              <p className="max-w-xl text-sm text-slate-500">{pageSubtitle}</p>
            </div>
        </div>
          )}

        {/* Main */}
        {mode === "meds" ? (
          <div className={`mx-auto w-full min-w-0 md:mt-2 ${medsView === "tracker" ? "max-w-[920px]" : "max-w-[430px]"}`}>
            <div className="flex items-start justify-between gap-4 pt-2">
              <div>
                <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-slate-950">Meds</h1>
                <p className="mt-1 text-sm text-slate-500">Medication, caffeine and how you feel.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openFeelingModal}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                  aria-label="Log feeling"
                  title="Log feeling"
                >
                  <HeartPulse className="h-5 w-5" aria-hidden />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMedsEntryLauncherOpen((open) => !open)}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm"
                    aria-label="Add entry"
                    title="Add entry"
                    aria-expanded={medsEntryLauncherOpen}
                  >
                    <Plus className="h-6 w-6" aria-hidden />
                  </button>
                  {medsEntryLauncherOpen ? (
                    <div className="absolute right-0 top-full z-30 mt-2 grid min-w-[170px] gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-slate-900/5">
                      <button
                        type="button"
                        onClick={() => {
                          setMedsEntryLauncherOpen(false);
                          openDoseModal();
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <PillIcon className="h-4 w-4 text-orange-500" aria-hidden />
                        Medication
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMedsEntryLauncherOpen(false);
                          openCaffeineModal();
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Coffee className="h-4 w-4 text-amber-500" aria-hidden />
                        Caffeine
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMedsEntryLauncherOpen(false);
                          openAlcoholModal();
                        }}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Wine className="h-4 w-4 text-rose-500" aria-hidden />
                        Alcohol
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-3 rounded-full border border-slate-200 bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.035)]">
                {[
                  { id: "today", label: "Today" },
                  { id: "history", label: "History" },
                  { id: "tracker", label: "Tracker" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMedsView(option.id as MedsView)}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                      medsView === option.id
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {medsView === "today" ? (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold text-slate-500">Quick log</div>
                <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => openRoutineMedicationModal("Vyvanse", 30)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <PillIcon className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                    Vyvanse 30mg
                  </button>
                  <button
                    type="button"
                    onClick={() => openRoutineMedicationModal("Prozac", 20)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <PillIcon className="h-3.5 w-3.5 text-violet-500" aria-hidden />
                    Prozac 20mg
                  </button>
                  <button
                    type="button"
                    onClick={openCaffeineModal}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    <Coffee className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    Iced latte
                  </button>
                </div>
              </div>
            ) : null}

            {medsView === "today" ? (
              <div className="mt-4 space-y-5">
                {medsError ? (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {medsError}
                  </div>
                ) : null}
                <section>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Estimated levels</div>
                    </div>
                    <div className="grid grid-cols-4 rounded-lg bg-slate-100 p-0.5 text-[10px] font-semibold text-slate-600">
                      {(Object.keys(MEDS_RANGE_CONFIG) as MedsLevelRange[]).map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => {
                            setMedsLevelRange(range);
                            setMedsRangeOffset(0);
                          }}
                          className={`rounded-md px-1.5 py-1 ${medsLevelRange === range ? "bg-slate-950 text-white shadow-sm" : ""}`}
                        >
                          {MEDS_RANGE_CONFIG[range].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-2 flex items-center justify-end gap-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setMedsRangeOffset((value) => value + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-base leading-none text-slate-600"
                      aria-label="Previous range"
                      title="Previous"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedsRangeOffset(0)}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm leading-none text-slate-600"
                      aria-label="Current range"
                      title="Current"
                    >
                      •
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedsRangeOffset((value) => Math.max(0, value - 1))}
                      disabled={medsRangeOffset === 0}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-base leading-none text-slate-600 disabled:opacity-40"
                      aria-label="Next range"
                      title="Next"
                    >
                      ›
                    </button>
                  </div>

                  <div className="space-y-3">
                    <MedsChartCard
                      title="Vyvanse"
                      subtitle={
                        latestVyvanseInRange
                          ? `${formatMedicationAmount(latestVyvanseInRange.amount ?? 30)} ${latestVyvanseInRange.unit ?? "mg"} · ${formatMedicationTime(latestVyvanseInRange.timestamp)}`
                          : "No intake in this window"
                      }
                      meta="Estimated · peak ~ 4–6h"
                      tone="#ff6b1a"
                      softTone="#fff0e7"
                      icon={<PillIcon className="h-4 w-4" aria-hidden />}
                      points={vyvanseChartSeries.points}
                      dots={vyvanseChartDots}
                      nowX={medsNowX}
                      axisLabels={medsAxisLabels}
                      maxPercent={vyvanseChartSeries.maxPercent}
                    />

                    <MedsChartCard
                      title="Caffeine"
                      subtitle={caffeineTotalInRange > 0 ? `~ ${Math.round(caffeineTotalInRange)} mg in view` : "No caffeine in this window"}
                      meta="Half-life ~ 5h"
                      tone="#f2aa12"
                      softTone="#fff7df"
                      icon={<Coffee className="h-4 w-4" aria-hidden />}
                      points={caffeineChartSeries.points}
                      dots={caffeineChartDots}
                      nowX={medsNowX}
                      axisLabels={medsAxisLabels}
                      maxPercent={caffeineChartSeries.maxPercent}
                    />
                  </div>
                </section>

                <section className="pb-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-slate-950">Today's log</div>
                  </div>
                  <div className="divide-y divide-slate-200/70">
                    {todaysMedicationEntries.length ? todaysMedicationEntries.map((entry) => {
                      const isCaffeine = isCaffeineEntry(entry);
                      const feelingLogs = entry.entryType === "observation" ? feelingLogsFromEntry(entry) : [];
                      const primaryFeelingLog = feelingLogs[0];
                      const PrimaryFeelingIcon = primaryFeelingLog ? feelingIconComponent(primaryFeelingLog.icon) : HeartPulse;
                      const title = entry.entryType === "observation" ? "Feeling" : isCaffeine ? caffeineDrinkLabel(entry) : entry.medication ?? "Dose";
                      const detail =
                        entry.entryType === "observation"
                          ? ""
                          : isCaffeine
                            ? `Coffee · ~${formatMedicationAmount(entry.amount ?? 0)} mg caffeine`
                            : [entry.amount ? formatMedicationAmount(entry.amount) : "", entry.unit ?? ""].filter(Boolean).join(" ");
                      return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openMedicationEntryEditor(entry)}
                        className="grid w-full grid-cols-[64px_42px_1fr_auto] items-center gap-3 py-3 text-left"
                      >
                        <div className="text-xs tabular-nums text-slate-400">{formatMedicationTime(entry.timestamp)}</div>
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-900">
                          {entry.entryType === "observation" ? (
                            <PrimaryFeelingIcon className="h-5 w-5 text-emerald-600" aria-hidden />
                          ) : isCaffeine ? (
                            <Coffee className="h-5 w-5" aria-hidden />
                          ) : (
                            <PillIcon className="h-5 w-5 text-orange-500" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
                          {entry.entryType === "observation" ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {feelingLogs.length ? feelingLogs.map((log) => {
                                const FeelingIcon = feelingIconComponent(log.icon);
                                return (
                                  <span
                                    key={`${entry.id}-${log.id}`}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${feelingValenceTone(log.valence)}`}
                                  >
                                    <FeelingIcon className="h-3 w-3" aria-hidden />
                                    {log.name} · {log.intensity}/5
                                  </span>
                                );
                              }) : (
                                <span className="text-xs text-slate-500">Feeling</span>
                              )}
                            </div>
                          ) : (
                            <div className="truncate text-xs text-slate-500">{detail}</div>
                          )}
                        </div>
                        <Ellipsis className="h-5 w-5 text-slate-400" aria-hidden />
                      </button>
                      );
                    }) : (
                      <div className="py-5 text-sm text-slate-400">No Meds entries logged today.</div>
                    )}
                  </div>

                </section>
              </div>
            ) : medsView === "history" ? (
              <div className="-mx-1 mt-4 space-y-3 px-1 sm:mx-0 sm:px-0">
                <div className="space-y-2 border-b border-slate-200/70 pb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">History</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                      { id: "all", label: "All" },
                      { id: "Vyvanse", label: "Vyvanse" },
                      { id: "Prozac", label: "Prozac" },
                      { id: "Coffee", label: "Coffee" },
                      { id: "alcohol", label: "Alcohol" },
                      { id: "feelings", label: "Feelings" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMedsHistoryFilter(option.id as typeof medsHistoryFilter)}
                        className={`border-b py-1 text-xs font-medium transition-colors ${
                          medsHistoryFilter === option.id
                            ? "border-slate-900 text-slate-900"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  {medsHistoryItems.length ? (
                    Object.entries(
                      medsHistoryItems.reduce<Record<string, typeof medsHistoryItems>>((groups, item) => {
                        const key = localDateISO(new Date(item.timestamp));
                        groups[key] = [...(groups[key] ?? []), item];
                        return groups;
                      }, {})
                    ).map(([date, items]) => (
                      <div key={date}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {formatMedicationDate(items[0]?.timestamp ?? date)}
                        </div>
                        <div className="mt-2 divide-y divide-slate-200/60 border-t border-slate-200/60">
                          {items
                            .slice()
                            .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
                            .map((item) => {
                              if (item.kind === "alcohol") {
                                const entry = item.entry;
                                const drinkOption = ALCOHOL_DRINK_TYPES.find((option) => option.id === entry.drinkType);
                                const DrinkIcon = drinkOption?.Icon ?? Wine;
                                return (
                                  <div
                                    key={entry.id}
                                    className="grid w-full grid-cols-[48px_1fr] items-center gap-3 rounded-lg px-1 py-2 text-left text-sm"
                                  >
                                    <div className="tabular-nums text-[12px] text-slate-400">
                                      {formatMedicationTime(entry.startedAt)}
                                    </div>
                                    <div className="flex min-w-0 items-center gap-2 text-rose-800">
                                      <DrinkIcon className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />
                                      <div className="min-w-0">
                                        <div className="truncate font-medium">{entry.drinkType}</div>
                                        <div className="truncate text-[11px] text-slate-500">
                                          {entry.quantity} {entry.quantity === 1 ? "drink" : "drinks"}
                                          {entry.endedAt ? ` · ${formatMedicationTime(entry.startedAt)}–${formatMedicationTime(entry.endedAt)}` : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }

                              const entry = item.entry;
                              const feelingLogs = entry.entryType === "observation" ? feelingLogsFromEntry(entry) : [];
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => openMedicationEntryEditor(entry)}
                                  className="grid w-full grid-cols-[48px_1fr] items-center gap-3 rounded-lg px-1 py-2 text-left text-sm transition-colors hover:bg-slate-50/80"
                                >
                                  <div className="tabular-nums text-[12px] text-slate-400">{formatMedicationTime(entry.timestamp)}</div>
                                  {entry.entryType === "input" ? (
                                    <div className="flex min-w-0 items-center gap-2 text-cyan-800">
                                      {entry.medication === "Coffee" ? (
                                        <Coffee className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden />
                                      ) : (
                                        <PillIcon className="h-4 w-4 shrink-0 text-cyan-600" aria-hidden />
                                      )}
                                      <span className="truncate">{medicationLabel(entry)}</span>
                                    </div>
                                  ) : (
                                    <div className="flex min-w-0 flex-wrap gap-1">
                                      {feelingLogs.length ? feelingLogs.map((log) => {
                                        const FeelingIcon = feelingIconComponent(log.icon);
                                        return (
                                          <span
                                            key={`${entry.id}-${log.id}`}
                                            className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${feelingValenceTone(log.valence)}`}
                                          >
                                            <FeelingIcon className="h-3 w-3 shrink-0" aria-hidden />
                                            <span className="truncate">{log.name} · {log.intensity}/5</span>
                                          </span>
                                        );
                                      }) : (
                                        <span className="flex min-w-0 items-center gap-2 text-violet-800">
                                          <HeartPulse className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                                          <span className="truncate">{medicationLabel(entry)}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border-y border-dashed border-slate-200 px-1 py-5 text-sm text-slate-400">
                      No medication history for this filter.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 min-w-0 max-w-full space-y-5 sm:space-y-6">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-950">Medication tracker</h2>
                  <p className="mt-1 text-xs text-slate-500">Daily intake over the last 12 months.</p>
                </div>
                {medicationTrackerSubstances.length ? (
                  <div className="min-w-0 max-w-full space-y-4 sm:space-y-5">
                    {medicationTrackerSubstances.map((substance) => (
                      <React.Fragment key={substance.key}>
                        <div className="block min-w-0 max-w-full sm:hidden">
                          <MedsTrackerGrid substance={substance} dates={medicationTrackerMobileDates} mobile />
                        </div>
                        <div className="hidden sm:block">
                          <MedsTrackerGrid substance={substance} dates={medicationTrackerDates} />
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="border-y border-dashed border-slate-200 py-6 text-sm text-slate-400">
                    No medication or caffeine intake logged yet.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : mode === "list" ? (
          <>
            <div className="mt-5 hidden items-center justify-end gap-2 rounded-[18px] border border-slate-200/70 bg-white p-2 md:flex md:flex-wrap">
              {renderCategoryFilter()}

              {renderListFilterMenu<Status>({
                id: "status",
                label: "Status",
                count: statusFilters.length,
                options: LIST_STATUS_OPTIONS,
                selected: statusFilters,
                onToggle: (value) => setStatusFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderListFilterMenu<Priority>({
                id: "priority",
                label: "Priority",
                count: priorityFilters.length,
                options: PRIORITIES,
                selected: priorityFilters,
                onToggle: (value) => setPriorityFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderListFilterMenu<string>({
                id: "difficulty",
                label: "Difficulty",
                count: difficultyFilters.length,
                options: DIFFICULTY_FILTERS.map((value) => ({ id: value, label: value })),
                selected: difficultyFilters,
                onToggle: (value) => setDifficultyFilters((prev) => toggleFilterValue(prev, value)),
              })}

              {renderTimeLeftFilterMenu()}

              <div className="relative">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search (press /)"
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 lg:w-[260px]"
                />
              </div>

              <button
                onClick={() => setNewOpen(true)}
                className="h-9 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                New
              </button>
            </div>

            <div className="mt-5 md:hidden">
              <div className="flex items-center gap-2">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks"
                  className="h-10 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setMobileTaskFiltersOpen((open) => !open);
                    setOpenListFilter(null);
                  }}
                  className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Filters
                  {activeTaskFilterCount ? <span className="text-slate-400"> · {activeTaskFilterCount}</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setNewOpen(true)}
                  className="h-10 rounded-2xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                >
                  New
                </button>
              </div>

              {mobileTaskFiltersOpen ? (
                <div className="mt-2 rounded-[18px] border border-slate-200 bg-white p-3 shadow-lg ring-1 ring-slate-900/5">
                  <div className="grid gap-2">
                    {renderCategoryFilter(true)}
                    <div className="flex flex-wrap gap-2">
                      {renderListFilterMenu<Status>({
                        id: "status",
                        label: "Status",
                        count: statusFilters.length,
                        options: LIST_STATUS_OPTIONS,
                        selected: statusFilters,
                        onToggle: (value) => setStatusFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderListFilterMenu<Priority>({
                        id: "priority",
                        label: "Priority",
                        count: priorityFilters.length,
                        options: PRIORITIES,
                        selected: priorityFilters,
                        onToggle: (value) => setPriorityFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderListFilterMenu<string>({
                        id: "difficulty",
                        label: "Difficulty",
                        count: difficultyFilters.length,
                        options: DIFFICULTY_FILTERS.map((value) => ({ id: value, label: value })),
                        selected: difficultyFilters,
                        onToggle: (value) => setDifficultyFilters((prev) => toggleFilterValue(prev, value)),
                      })}

                      {renderTimeLeftFilterMenu()}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 divide-y divide-slate-100 rounded-[18px] border border-slate-200/70 bg-white">
                {listRows.length ? (
                  listRows.map((t) => {
                    const days = t.due ? daysLeftFromISO(t.due) : null;
                    const deadlineLabel = days === null ? null : timeLeftLabel(days);
                    const effort = taskDisplayEffortLevel(t);
                    const showPriority = t.priority === "high" || t.priority === "low";
                    const statusMenuOpen = openStatusTaskId === t.id;

                    return (
                      <div
                        key={`mobile-task-${t.id}`}
                        className={`relative cursor-pointer bg-white px-3 py-3 hover:bg-slate-50/70 ${t.status === "frozen" ? "text-slate-400" : ""}`}
                        onClick={() => openEdit(t)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(t);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-medium ${frozenTitleClass(t)}`}>{t.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                              <span className="min-w-0">{renderCategoryIdentity(t.courseId)}</span>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusPill(t.status)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenListFilter(null);
                                  setOpenStatusTaskId((id) => (id === t.id ? null : t.id));
                                }}
                              >
                                {statusLabel(t.status)}
                              </button>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              {deadlineLabel ? (
                                <span className={days !== null && days <= 2 ? "text-rose-600" : ""}>{deadlineLabel}</span>
                              ) : null}
                              {effort ? <span>{effortLabel(effort)}</span> : null}
                              {showPriority ? <span>{priorityLabel(t.priority)}</span> : null}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              completeTask(t.id);
                            }}
                            aria-label="Mark completed"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        {statusMenuOpen ? (
                          <div
                            className="absolute left-3 top-14 z-[1000] min-w-[136px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {LIST_STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="block w-full whitespace-nowrap bg-white px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateTaskStatus(t.id, option.id);
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-8 text-center text-sm text-slate-400">No tasks match these filters.</div>
                )}
              </div>
            </div>

            <div className="mt-5 hidden overflow-x-auto overflow-y-visible rounded-[18px] border border-slate-200/70 bg-white md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-xs text-slate-500">
                  <tr>
                    {([
                      ["title", "Title"],
                      ["course", "Category"],
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["due", "Due"],
                      ["timeLeft", "Time left"],
                      ["effort", "Effort"],
                      ["difficulty", "Difficulty"],
                    ] as Array<[typeof listSortKey, string]>).map(([key, label]) => (
                      <th key={key} className="px-3 py-2 text-left font-medium">
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            if (listSortKey === key) setListSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            else {
                              setListSortKey(key);
                              setListSortDir("asc");
                            }
                          }}
                        >
                          {label} {listSortKey === key ? (listSortDir === "asc" ? "↑" : "↓") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {listRows.map((t) => {
                    const days = t.due ? daysLeftFromISO(t.due) : null;
                    const statusMenuOpen = openStatusTaskId === t.id;
                    return (
                      <tr
                        key={t.id}
                        className={`relative cursor-pointer border-t border-slate-100/80 hover:bg-slate-50/70 ${
                          statusMenuOpen ? "z-50" : "z-0"
                        }`}
                        onClick={() => openEdit(t)}
                      >
                        <td className={`max-w-[420px] truncate px-3 py-2.5 font-medium text-slate-900 ${frozenTitleClass(t)}`}>{t.title}</td>
                        <td className={`px-3 py-2.5 ${t.status === "frozen" ? "text-slate-400" : "text-slate-500"}`}>
                          {renderCategoryIdentity(t.courseId)}
                        </td>
                        <td
                          className={`relative px-3 py-2.5 ${statusMenuOpen ? "z-[120]" : "z-0"}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="relative z-[130] inline-flex">
                            <button
                              type="button"
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusPill(t.status)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenListFilter(null);
                                setOpenStatusTaskId((id) => (id === t.id ? null : t.id));
                              }}
                            >
                              {statusLabel(t.status)}
                            </button>
                            {statusMenuOpen ? (
                              <div
                                className="absolute left-0 top-full z-[999] mt-1 min-w-[136px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-xl ring-1 ring-slate-900/5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {LIST_STATUS_OPTIONS.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className="block w-full whitespace-nowrap bg-white px-3 py-2 text-left text-slate-600 hover:bg-slate-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateTaskStatus(t.id, option.id);
                                    }}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{priorityLabel(t.priority)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">{t.due ?? "—"}</td>
                        <td className={`px-3 py-2.5 tabular-nums ${days !== null && days <= 2 ? "text-red-600" : "text-slate-500"}`}>
                          {days === null ? "—" : timeLeftLabel(days)}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{effortLabel(taskDisplayEffortLevel(t))}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">{t.difficulty == null ? "—" : t.difficulty}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!listRows.length ? (
                <div className="border-t border-slate-100 px-3 py-8 text-center text-sm text-slate-400">
                  No tasks match these filters.
                </div>
              ) : null}
            </div>

            {completedRows.length ? (
              <section className="mt-5 rounded-[18px] border border-slate-200/70 bg-white p-4">
                <div className="text-sm font-semibold text-slate-700">Completed</div>
                <div className="mt-1 text-xs text-slate-400">
                  Recoverable for {COMPLETED_RECOVERY_DAYS} days, then hidden from this list.
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {completedRows.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-2 opacity-70">
                      <button
                        type="button"
                        onClick={() => openEdit(task)}
                        className="min-w-0 text-left"
                      >
                        <div className="truncate text-sm font-medium text-slate-600">{task.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>{renderCategoryIdentity(task.courseId)}</span>
                          <span>{task.completedAt ? `Completed ${task.completedAt.slice(0, 10)}` : "Completed date unknown"}</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => restoreTask(task.id)}
                        className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {recentlyDeletedTasks.length ? (
              <section className="mt-5 rounded-[18px] border border-slate-200/70 bg-white p-4">
                <div className="text-sm font-semibold text-slate-700">Recently Deleted</div>
                <div className="mt-1 text-xs text-slate-400">Recoverable here for 30 days.</div>
                <div className="mt-3 divide-y divide-slate-100">
                  {recentlyDeletedTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-3 py-2 opacity-70">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-600">{task.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                          <span>{renderCategoryIdentity(task.courseId)}</span>
                          <span>
                            Deleted {task.deletedAt ? new Date(task.deletedAt).toLocaleString() : "date unknown"}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => restoreDeletedTask(task.id)}
                        className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : mode === "planner" ? (
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                  {([
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "three_month", label: "3 Months" },
                    { id: "year", label: "Year" },
                  ] as Array<{ id: PlannerView; label: string }>).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPlannerView(option.id)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        plannerView === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSmartImport}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Quick Add
                </button>

                <button
                  type="button"
                  onClick={openPlannerEventTypeChooser}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg leading-none text-slate-700 hover:bg-slate-50"
                  aria-label="Add calendar event"
                >
                  +
                </button>
              </div>
            </div>

            {plannerView === "week" ? (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-slate-500">{plannerWeekLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerWeek(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous week"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerWeek(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next week"
                    >
                      &gt;
                    </button>
	                  </div>
	                </div>
	                <div className="mb-3">{renderPlannerEventLegend()}</div>

	                <div className="md:hidden">
                  <div className="grid grid-cols-7 gap-1">
                    {plannerWeekDays.map((day) => {
                      const date = new Date(day + "T00:00:00");
                      const isToday = day === clientToday;
                      const isSelected = day === plannerMobileWeekDate;
                      const dayTemporalState = plannerTemporalStateForDate(day, clientToday);

                      return (
                        <button
                          key={`mobile-week-${day}`}
                          type="button"
                          onClick={() => setPlannerMobileSelectedDate(day)}
                          className={`rounded-2xl border px-1 py-2 text-center transition-colors ${
                            isSelected
                              ? "border-slate-900 bg-white text-slate-950"
                              : "border-slate-200/80 bg-white/70 text-slate-500 hover:bg-white"
                          }`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-[0.1em]">
                            {new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}
                          </div>
                          <div
                            className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isToday
                                ? "bg-slate-900 text-white"
                                : dayTemporalState === "past"
                                  ? "text-slate-400"
                                  : ""
                            }`}
                          >
                            {date.getDate()}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-[18px] border border-slate-200/70 bg-white p-3">
                    {!plannerMobileAllDayItems.length && !plannerMobileTimedLayouts.length ? (
                      <div className="py-1 text-xs text-slate-400">No events</div>
                    ) : (
                      <>
                        {plannerMobileAllDayItems.length ? (
                          <div className="mb-3 space-y-1.5">
                            {plannerMobileAllDayItems.map((item) => {
                              const timingLabel = plannerItemTimingLabel(item);
                              const temporalState = plannerItemTemporalState(item, clientToday, plannerMobileWeekDate);
                              return (
                                <button
                                  key={`mobile-all-day-${plannerMobileWeekDate}-${item.sourceType === "calendar_event" ? item.event.id : item.task.id}`}
                                  type="button"
                                  onClick={() =>
                                    item.sourceType === "calendar_event"
                                      ? openPlannerEventEdit(item.event)
                                      : openPlannerTaskDeadlineEdit(item.task)
                                  }
                                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-xs font-medium ${
                                    item.sourceType === "calendar_event"
                                      ? plannerEventTone(item.event.eventType, temporalState)
                                      : plannerDeadlineTone(item.task, temporalState)
                                  }`}
                                >
                                  {item.sourceType === "calendar_event" ? (
                                    <PlannerEventTypeIcon eventType={item.event.eventType} />
                                  ) : (
                                    <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  )}
                                  {timingLabel ? (
                                    <span className="shrink-0 opacity-70">{timingLabel}</span>
                                  ) : null}
                                  <span className="truncate">{plannerItemTitle(item)}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          {plannerMobileTimedLayouts.map((layout) => {
                            const timeRange = layout.displayOnly
                              ? ""
                              : `${formatPlannerEventTime(layout.event.startAt)}${
                                  layout.event.endAt ? `-${formatPlannerEventTime(layout.event.endAt)}` : ""
                                }`;
                            const inlineStartTime =
                              !layout.displayOnly && layout.event.startAt && !layout.event.endAt
                                ? formatPlannerEventTime(layout.event.startAt)
                                : "";
                            const temporalState = plannerEventTemporalState(layout.event, clientToday);
                            return (
                              <button
                                key={`mobile-timed-${plannerMobileWeekDate}-${layout.event.id}`}
                                type="button"
                                onClick={() => openPlannerEventEdit(layout.event)}
                                className={`flex w-full min-w-0 items-start gap-2 rounded-2xl border px-3 py-2 text-left text-xs ${plannerEventTone(
                                  layout.event.eventType,
                                  temporalState
                                )}`}
                              >
                                <PlannerEventTypeIcon eventType={layout.event.eventType} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {inlineStartTime ? <span className="mr-1 tabular-nums opacity-70">{inlineStartTime}</span> : null}
                                    {layout.event.title}
                                  </span>
                                  {timeRange && layout.event.endAt ? (
                                    <span className="mt-0.5 block text-[11px] opacity-70">{timeRange}</span>
                                  ) : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="hidden md:block md:overflow-x-auto">
                  <div className="min-w-[860px] overflow-hidden rounded-[18px] border border-slate-200/70 bg-white">
                    <div className="grid grid-cols-[64px_repeat(7,minmax(96px,1fr))] border-b border-slate-100/80 bg-white">
                      <div className="border-r border-slate-100/80" />
                      {plannerWeekDays.map((day) => {
                        const date = new Date(day + "T00:00:00");
                        const isToday = day === clientToday;
                        const dayTemporalState = plannerTemporalStateForDate(day, clientToday);

                        return (
                          <div
                            key={day}
                            className={`border-r border-slate-100/80 px-2 py-3 text-center last:border-r-0 ${
                              isToday ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/80" : ""
                            }`}
                          >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {new Intl.DateTimeFormat("en", { weekday: "short" }).format(date)}
                            </div>
                            <div
                              className={`mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${
                                isToday
                                  ? "bg-slate-900 text-white"
                                  : dayTemporalState === "past"
                                    ? "text-slate-400"
                                    : "text-slate-700"
                              }`}
                            >
                              {date.getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-[64px_1fr] border-b border-slate-100/80 bg-slate-50/30">
                      <div className="border-r border-slate-100/80 px-3 py-3 text-xs font-medium text-slate-400">
                        All day
                      </div>
                      <div
                        className="relative grid grid-cols-7"
                        style={{ minHeight: Math.max(48, 14 + plannerWeekAllDaySpans.length * 26) }}
                      >
                        {plannerWeekDays.map((day) => (
                          <div
                            key={`all-day-bg-${day}`}
                            className={`border-r border-slate-100/80 px-2 py-2 text-center text-sm text-slate-300 last:border-r-0 ${
                              day === clientToday ? "bg-slate-100/60 ring-1 ring-inset ring-slate-200/70" : ""
                            }`}
                          >
                            {!plannerWeekAllDaySpans.length ? "·" : null}
                          </div>
                        ))}
                        {plannerWeekAllDaySpans.length ? (
                          <div
                            className="absolute inset-x-0 top-1.5 grid grid-cols-7 gap-y-1 px-1.5"
                            style={{
                              gridTemplateRows: `repeat(${plannerWeekAllDaySpans.length}, 22px)`,
                            }}
                          >
                            {plannerWeekAllDaySpans.map((span, index) => {
                              const timingLabel = plannerItemTimingLabel(span.item);
                              const temporalState = plannerItemTemporalState(span.item, clientToday);
                              return (
                                <button
                                  key={plannerAllDaySpanKey(span, "week")}
                                  type="button"
                                  onClick={() =>
                                    span.item.sourceType === "calendar_event"
                                      ? openPlannerEventEdit(span.item.event)
                                      : openPlannerTaskDeadlineEdit(span.item.task)
                                  }
                                  className={`flex min-w-0 items-center gap-1 border px-2 py-1 text-left text-[11px] font-medium ${
                                    span.startsBefore ? "rounded-l-sm" : "rounded-l-lg"
                                  } ${span.endsAfter ? "rounded-r-sm" : "rounded-r-lg"} ${
                                    span.item.sourceType === "calendar_event"
                                      ? plannerEventTone(span.item.event.eventType, temporalState)
                                      : plannerDeadlineTone(span.item.task, temporalState)
                                  }`}
                                  style={{
                                    gridColumn: `${span.startIndex + 1} / span ${span.span}`,
                                    gridRow: index + 1,
                                  }}
                                  title={plannerItemTitle(span.item)}
                                >
                                  {span.item.sourceType === "calendar_event" ? (
                                    <PlannerEventTypeIcon eventType={span.item.event.eventType} />
                                  ) : (
                                    <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
                                  )}
                                  {timingLabel ? (
                                    <span className="shrink-0 opacity-70">{timingLabel}</span>
                                  ) : null}
                                  <span className="truncate">{plannerItemTitle(span.item)}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div ref={plannerWeekScrollRef} className="max-h-[620px] overflow-y-auto">
                      <div
                        data-planner-week-grid="true"
                        className="relative grid grid-cols-[64px_repeat(7,minmax(96px,1fr))]"
                        style={{ height: (PLANNER_END_HOUR - PLANNER_START_HOUR) * PLANNER_HOUR_HEIGHT }}
                      >
                        <div className="relative border-r border-slate-100/80 bg-white">
                          {plannerHours.slice(0, -1).map((hour, index) => (
                            <div
                              key={hour}
                              className="absolute right-3 -translate-y-2 text-[10px] tabular-nums text-slate-400"
                              style={{ top: index * PLANNER_HOUR_HEIGHT }}
                            >
                              {hour}
                            </div>
                          ))}
                        </div>

                        {plannerWeekDays.map((day) => (
                          <div
                            key={`timed-${day}`}
                            className={`relative border-r border-slate-100/80 last:border-r-0 ${
                              day === clientToday ? "bg-slate-50/70 ring-1 ring-inset ring-slate-200/70" : "bg-white"
                            }`}
                          >
                            {plannerHours.slice(0, -1).map((hour, index) => (
                              <div
                                key={`${day}-${hour}`}
                                className="absolute left-0 right-0 border-t border-slate-100/80"
                                style={{ top: index * PLANNER_HOUR_HEIGHT }}
                              />
                            ))}
                            {day === clientToday && currentTimeTop !== null ? (
                              <div
                                className="absolute left-2 right-2 z-10 border-t border-rose-300"
                                style={{ top: currentTimeTop }}
                              >
                                <span className="absolute -left-1 -top-1.5 h-2.5 w-2.5 rounded-full bg-rose-300" />
                              </div>
                            ) : null}
                            {(plannerTimedLayoutsByDate[day] ?? []).map((layout) => {
                              const gutter = 8;
                              const width = `calc(${100 / layout.columnCount}% - ${gutter}px)`;
                              const left = `calc(${(layout.columnIndex * 100) / layout.columnCount}% + ${gutter / 2}px)`;
                              const timeRange = layout.displayOnly
                                ? ""
                                : `${formatPlannerEventTime(layout.event.startAt)}${
                                    layout.event.endAt ? `-${formatPlannerEventTime(layout.event.endAt)}` : ""
                                  }`;
                              const inlineStartTime =
                                !layout.displayOnly && layout.event.startAt && !layout.event.endAt
                                  ? formatPlannerEventTime(layout.event.startAt)
                                  : "";
                              const workResolution = plannerWorkResolutionStatus(layout.event);
                              const showWorkResolutionActions = isPastUnresolvedPlannerWorkEvent(
                                layout.event,
                                clientNowMs
                              );
                              const workActionSaving = plannerWorkActionSavingId === layout.event.id;
                              const temporalState = plannerEventTemporalState(layout.event, clientToday);

                              return (
                                <div
                                  key={`${day}-${layout.event.id}`}
                                  role="button"
                                  tabIndex={0}
                                  className={`absolute z-20 select-none overflow-hidden rounded-xl border px-2 py-1.5 text-[11px] ${
                                    layout.displayOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                                  } ${
                                    plannerInteraction?.eventId === layout.event.id ? "ring-2 ring-slate-300" : ""
                                  } ${plannerEventTone(
                                    layout.event.eventType,
                                    temporalState
                                  )}`}
                                  style={{
                                    top: layout.top,
                                    height: layout.height,
                                    left,
                                    width,
                                  }}
                                  title={`${layout.event.title}${timeRange ? ` • ${timeRange}` : ""}`}
                                  onPointerDown={
                                    layout.displayOnly
                                      ? undefined
                                      : (e) => beginPlannerEventInteraction(e, layout.event, "move")
                                  }
                                  onClick={() => {
                                    if (suppressPlannerEventClickRef.current) return;
                                    openPlannerEventEdit(layout.event);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") openPlannerEventEdit(layout.event);
                                  }}
                                >
                                  <div className="flex min-w-0 items-center gap-1 font-medium leading-tight">
                                    <PlannerEventTypeIcon eventType={layout.event.eventType} />
                                    {inlineStartTime ? (
                                      <span className="shrink-0 tabular-nums opacity-70">{inlineStartTime}</span>
                                    ) : null}
                                    <span className="truncate">{layout.event.title}</span>
                                  </div>
                                  {layout.height >= 42 && timeRange ? (
                                    <div className="mt-0.5 truncate text-[10px] opacity-70">{timeRange}</div>
                                  ) : null}
                                  {workResolution ? (
                                    <div className="mt-1 inline-flex w-fit rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                      {workResolution === "logged" ? "Logged" : "Skipped"}
                                    </div>
                                  ) : null}
                                  {showWorkResolutionActions ? (
                                    <div
                                      className="mt-1 flex flex-wrap gap-1"
                                      onPointerDown={(e) => e.stopPropagation()}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {layout.event.taskId && taskById[layout.event.taskId] ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={workActionSaving}
                                            onClick={() => logPlannerWorkAsPlanned(layout.event)}
                                            className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                                          >
                                            Log as planned
                                          </button>
                                          <button
                                            type="button"
                                            disabled={workActionSaving}
                                            onClick={() => adjustPlannerWorkLog(layout.event)}
                                            className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-white disabled:opacity-50"
                                          >
                                            Adjust
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={workActionSaving}
                                          onClick={() => openPlannerEventEdit(layout.event)}
                                          className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                                        >
                                          Link task to log
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        disabled={workActionSaving}
                                        onClick={() => skipPlannerWorkEvent(layout.event)}
                                        className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-white disabled:opacity-50"
                                      >
                                        Skip
                                      </button>
                                    </div>
                                  ) : null}
                                  {!layout.displayOnly ? (
                                    <div
                                      className="absolute inset-x-2 bottom-0 h-2 cursor-ns-resize rounded-full"
                                      onPointerDown={(e) => {
                                        e.stopPropagation();
                                        beginPlannerEventInteraction(e, layout.event, "resize");
                                      }}
                                      aria-hidden="true"
                                    >
                                      <span className="mx-auto mt-1 block h-0.5 w-6 rounded-full bg-current opacity-25" />
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : plannerView === "month" ? (
              <div className="pt-3">
	                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
	                  <div className="px-1 text-xs font-semibold text-slate-600">{plannerMonthLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerMonth(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous month"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerMonth(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next month"
                    >
                      &gt;
                    </button>
	                  </div>
	                </div>
	                <div className="mb-3">{renderPlannerEventLegend()}</div>

	                {renderPlannerMonthGrid(plannerMonthGrid)}
              </div>
            ) : plannerView === "three_month" ? (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="px-1 text-xs font-semibold text-slate-600">{plannerThreeMonthLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerThreeMonth(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous three-month window"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerThreeMonth(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next three-month window"
                    >
                      &gt;
                    </button>
	                  </div>
	                </div>
	                <div className="mb-3">{renderPlannerEventLegend()}</div>

	                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {plannerThreeMonthGrids.map((grid) => (
                    <div key={grid.month.id} className="min-w-0">
                      <div className="mb-1.5 px-1 text-xs font-semibold text-slate-600">
                        {formatPlannerMonthLabel(grid.month.anchorDate)}
                      </div>
                      {renderPlannerMonthGrid(grid, "three_month")}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="pt-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs font-medium text-slate-500">{plannerYearLabel}</div>
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => movePlannerYear(-1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Previous year"
                    >
                      &lt;
                    </button>
                    <button
                      type="button"
                      onClick={returnPlannerToToday}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlannerYear(1)}
                      className="rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      aria-label="Next year"
                    >
                      &gt;
                    </button>
                  </div>
                </div>

	                <div className="mb-3">{renderPlannerEventLegend()}</div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {plannerYearMonths.map((month) => (
                    <div key={month.id} className="rounded-[18px] border border-slate-200/70 bg-white p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPlannerAnchorDate(month.anchorDate);
                          setPlannerView("month");
                        }}
                        className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                      >
                        {month.label}
                      </button>

                      <div className="mt-2 grid grid-cols-7 gap-y-1">
                        {["M", "T", "W", "T", "F", "S", "S"].map((weekday, index) => (
                          <div
                            key={`${month.id}-${weekday}-${index}`}
                            className="text-center text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-300"
                          >
                            {weekday}
                          </div>
                        ))}
                      </div>

                      <div className="mt-1">
                        {Array.from({ length: Math.ceil(month.days.length / 7) }, (_, weekIndex) => {
                          const week = month.days.slice(weekIndex * 7, weekIndex * 7 + 7);
                          const currentMonthDays = week.filter((day) => day.isCurrentMonth);
                          const firstCurrentMonthIndex = week.findIndex((day) => day.isCurrentMonth);
                          const currentMonthDates = currentMonthDays.map((day) => day.date);
                          const monthItems: PlannerDateItem[] = currentMonthDates.flatMap((date) =>
                            (plannerYearEventsByDate[date] ?? []).filter((item) => {
                              const span = plannerItemDateSpan(item);
                              return Boolean(span && span.start < span.end);
                            })
                          );
                          const uniqueSpanItems = Array.from(
                            new Map(
                              monthItems.map((item) => [
                                item.sourceType === "calendar_event" ? item.event.id : item.task.id,
                                item,
                              ])
                            ).values()
                          );
                          const spanItems = plannerAllDaySpansForDays(currentMonthDates, uniqueSpanItems)
                            .filter((span) => span.item.sourceType === "calendar_event")
                            .map((span) => ({
                              ...span,
                              startIndex: firstCurrentMonthIndex + span.startIndex,
                            }));
                          const visibleSpanItems = spanItems.slice(0, 2);

                          return (
                            <div
                              key={`${month.id}-week-${weekIndex}`}
                              className="relative grid grid-cols-7"
                              style={{ minHeight: Math.max(30, 24 + visibleSpanItems.length * 13) }}
                            >
                              {week.map((day) => {
                                const items = (plannerYearEventsByDate[day.date] ?? []).filter((item) => {
                                  const span = plannerItemDateSpan(item);
                                  return !span || span.start === span.end;
                                });
                                const markerTypes = Array.from(new Set(items.map(plannerYearItemEventType))).slice(0, 3);
                                const markerTemporalStates = new Map(
                                  markerTypes.map((eventType) => {
                                    const item = items.find((candidate) => plannerYearItemEventType(candidate) === eventType);
                                    return [eventType, item ? plannerItemTemporalState(item, clientToday, day.date) : plannerTemporalStateForDate(day.date, clientToday)];
                                  })
                                );
                                const isToday = day.date === clientToday;
                                const dayTemporalState = plannerTemporalStateForDate(day.date, clientToday);

                                if (!day.isCurrentMonth) {
                                  return (
                                    <div
                                      key={`${month.id}-${day.date}`}
                                      className="mx-auto h-7 w-7"
                                      aria-hidden="true"
                                    />
                                  );
                                }

                                return (
                                  <button
                                    key={`${month.id}-${day.date}`}
                                    type="button"
                                    onClick={() => {
                                      setPlannerAnchorDate(day.date);
                                      setPlannerView("week");
                                    }}
                                    className={`group relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[10px] tabular-nums hover:bg-slate-100 ${
                                      isToday
                                        ? "bg-slate-900 text-white hover:bg-slate-800"
                                        : dayTemporalState === "past"
                                          ? "text-slate-400"
                                          : "text-slate-600"
                                    }`}
                                    title={
                                      items.length
                                        ? `${day.date}: ${items.length} item${items.length === 1 ? "" : "s"}`
                                        : day.date
                                    }
                                    aria-label={`Open week containing ${day.date}`}
                                  >
                                    {Number(day.date.slice(8, 10))}
                                    {markerTypes.length ? (
                                      <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                                        {markerTypes.map((eventType) => (
                                          <span
                                            key={eventType}
                                            className={`inline-flex ${plannerYearMarkerTone(
                                              eventType,
                                              markerTemporalStates.get(eventType) ?? plannerTemporalStateForDate(day.date, clientToday)
                                            )}`}
                                          >
                                            <PlannerYearMarkerIcon eventType={eventType} />
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                              {visibleSpanItems.map((span, spanIndex) => {
                                const eventType = plannerYearItemEventType(span.item);
                                const temporalState = plannerItemTemporalState(span.item, clientToday);
                                return (
                                  <div
                                    key={plannerAllDaySpanKey(span, `${month.id}-year-${weekIndex}`)}
                                    className={`absolute grid h-3.5 min-w-0 grid-cols-[auto_1fr] items-center gap-0.5 overflow-hidden border px-1 text-[8px] font-medium leading-none ${
                                      span.startsBefore ? "rounded-l-sm" : "rounded-l-full"
                                    } ${span.endsAfter ? "rounded-r-sm" : "rounded-r-full"} ${plannerYearPillTone(eventType, temporalState)}`}
                                    style={{
                                      left: `calc(${(span.startIndex / 7) * 100}% + 2px)`,
                                      right: `calc(${((7 - span.startIndex - span.span) / 7) * 100}% + 2px)`,
                                      top: 25 + spanIndex * 13,
                                    }}
                                    title={plannerItemTitle(span.item)}
                                  >
                                    <PlannerYearMarkerIcon eventType={eventType} />
                                    {span.span >= 3 ? <span className="truncate">{plannerItemTitle(span.item)}</span> : null}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : mode === "logger" ? (
          <div className="mt-3 flex flex-col overflow-x-hidden pb-24 md:mt-4 md:flex md:flex-col md:pb-0">
            <div className="flex flex-col gap-2 rounded-[18px] border border-slate-200/70 bg-white p-2.5 md:gap-3 md:p-3">
              <div className="grid gap-2 xl:flex xl:items-center xl:justify-between">
                <div className="grid gap-2 md:flex md:flex-wrap md:items-center">
                  <div className="order-2 text-center text-xs font-medium text-slate-500 md:order-none md:text-left">
                    {loggerPeriodLabel}
                  </div>
                  <div className="order-1 grid grid-cols-5 rounded-xl border border-slate-200 bg-white p-1 md:order-none md:inline-flex">
                  {[
                    { id: "day", label: "Day" },
                    { id: "week", label: "Week" },
                    { id: "month", label: "Month" },
                    { id: "year", label: "Year" },
                    { id: "custom", label: "Custom" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLoggerRangeMode(option.id as LoggerRangeMode)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium md:px-3 md:text-sm ${
                        loggerRangeMode === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                </div>

                <div className="grid grid-cols-[1fr_auto] items-center gap-2 md:flex md:flex-wrap md:items-center">
                <select
                  value={loggerTaskFilter}
                  onChange={(e) => setLoggerTaskFilter(e.target.value)}
                  className="h-9 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 md:w-[220px]"
                >
                  <option value="all">All tasks</option>
                  {filtered.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => openLogTime()}
                  className="h-9 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800 md:px-4"
                >
                  Log time
                </button>

                <div className="col-span-2 inline-flex h-9 w-full rounded-xl border border-slate-200 bg-white p-1 md:col-span-1 md:w-auto">
                  <button
                    type="button"
                    onClick={() => moveLoggerSelectedRange(-1)}
                    disabled={loggerRangeMode === "custom"}
                    className="flex-1 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 md:flex-none"
                    aria-label="Previous Logger range"
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    onClick={returnLoggerRangeToToday}
                    className="flex-1 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-50 md:flex-none"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => moveLoggerSelectedRange(1)}
                    disabled={loggerRangeMode === "custom"}
                    className="flex-1 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 md:flex-none"
                    aria-label="Next Logger range"
                  >
                    &gt;
                  </button>
                </div>

                </div>
              </div>

            {loggerRangeMode === "custom" ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <label className="flex items-center gap-2">
                  <span>From</span>
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => {
                      const nextStart = e.target.value;
                      if (!isValidISODate(nextStart)) return;
                      setCustomStartDate(nextStart);
                      if (!isValidISODate(customEndDate) || nextStart > customEndDate) {
                        setCustomEndDate(nextStart);
                      }
                    }}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>To</span>
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => {
                      const nextEnd = e.target.value;
                      if (!isValidISODate(nextEnd)) return;
                      setCustomEndDate(nextEnd);
                      if (!isValidISODate(customStartDate) || nextEnd < customStartDate) {
                        setCustomStartDate(nextEnd);
                      }
                    }}
                    className="h-8 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </label>
              </div>
            ) : null}

            </div>

            <div className="order-5 mt-3 rounded-2xl border border-slate-200/70 bg-white px-3 py-2.5 text-sm text-slate-600 md:order-5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold tabular-nums text-slate-900">
                  {formatLoggedTime(loggerRangeSummary.totalHours)} worked
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  {loggerRangeSummary.activeDayCount
                    ? formatLoggedTime(loggerRangeSummary.averageHoursPerActiveDay)
                    : "0m"}{" "}
                  / active day
                </span>
                <span className="text-slate-300">·</span>
                <span>
                  {loggerRangeSummary.activeDayCount} active day
                  {loggerRangeSummary.activeDayCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>
                  Top task:{" "}
                  <span className="text-slate-700">
                    {loggerRangeSummary.mostWorkedTask?.title ?? "—"}
                  </span>
                </span>
                <span>
                  Top category:{" "}
                  <span className="text-slate-700">
                    {loggerRangeSummary.mostWorkedCategory?.id && loggerRangeSummary.mostWorkedCategory.id !== "archived"
                      ? renderCategoryIdentity(loggerRangeSummary.mostWorkedCategory.id)
                      : loggerRangeSummary.mostWorkedCategory?.label ?? "—"}
                  </span>
                </span>
              </div>
            </div>

            {loggerActionError ? (
              <div className="order-2 mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 md:order-2">
                {loggerActionError}
              </div>
            ) : null}

            {openTimeLogs.length ? (
              <div className="order-1 mt-3 rounded-[18px] border border-cyan-100 bg-cyan-50/35 px-2.5 py-2.5 md:order-1 md:px-3 md:py-3">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-700/70">
                  Open sessions
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {openTimeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="grid gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-cyan-700">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">
                            {taskNameById[log.taskId] ?? "Archived task"}
                          </div>
                          <div className="text-xs text-cyan-700">
                            {formatOpenSessionStarted(log)} · Open
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center">
                        <button
                          type="button"
                          onClick={() => endOpenTimeLogNow(log)}
                          disabled={endingOpenLogId === log.id}
                          className="rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-300"
                        >
                          {endingOpenLogId === log.id ? "Ending" : "End now"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openLogTime(log.taskId, log.date, log)}
                          className="rounded-full border border-cyan-100 bg-white px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-50"
                        >
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTimeLog(log.id)}
                          disabled={deletingTimeLogId === log.id}
                          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingTimeLogId === log.id ? "Deleting" : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {loggerRangeMode === "day" ? (
              <section className="order-2 mt-3 rounded-[18px] border border-slate-200/70 bg-white p-3 sm:p-4 md:order-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Temporal map</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Work logged chronologically by time of day.
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-500">{formatLoggerDate(loggerDateRange.start)}</div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div
                    className="grid grid-cols-[92px_1fr] gap-2 sm:grid-cols-[104px_1fr]"
                    style={{ height: `${LOGGER_DAY_TIMELINE_HEIGHT}px` }}
                  >
                    <div className="relative">
                      {LOGGER_TIME_OF_DAY_BUCKETS.map((bucket) => {
                        const bucketStart =
                          bucket.id === "morning" ? 5 * 60 : bucket.id === "afternoon" ? 12 * 60 : bucket.id === "evening" ? 17 * 60 : 22 * 60;
                        const top = ((bucketStart - LOGGER_DAY_TIMELINE_START_MINUTES) / 60) * LOGGER_DAY_TIMELINE_PX_PER_HOUR;
                        return (
                          <div key={`day-temporal-label-${bucket.id}`} className="absolute left-0" style={{ top: `${top}px` }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
                              {bucket.label}
                            </div>
                            <div className="mt-0.5 text-[9px] tabular-nums text-slate-300 sm:text-[10px]">{bucket.timeLabel}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="relative border-l border-slate-100 pl-2"
                      style={{
                        backgroundImage: "repeating-linear-gradient(to bottom, transparent 0, transparent 29px, rgba(226,232,240,0.55) 30px)",
                      }}
                    >
                      {dayTemporalRows.timed.map((row) => renderTemporalLogButton(row, "timeline"))}
                    </div>
                  </div>

                  {dayTemporalRows.unscheduled.length ? (
                    <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[92px_1fr]">
                      <div className="pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Unscheduled
                      </div>
                      <div className="grid gap-2">
                        {dayTemporalRows.unscheduled.map((row) => renderTemporalLogButton(row))}
                      </div>
                    </div>
                  ) : null}

                  {!temporalLogRows.some((row) => row.log.date === loggerDateRange.start) ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                      No closed time logs for this day.
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {loggerRangeMode === "week" ? (
              <section className="order-2 mt-3 rounded-[18px] border border-slate-200/70 bg-white p-3 sm:p-4 md:order-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Temporal map</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      Work grouped by weekday and time of day.
                    </div>
                  </div>
                  <div className="text-xs font-medium text-slate-500">{loggerPeriodLabel}</div>
                </div>

                <div className="mt-4 grid gap-3 md:hidden">
                  {weekTemporalRows.days.map((day) => {
                    const hasLogs =
                      LOGGER_TIME_OF_DAY_BUCKETS.some((bucket) =>
                        Boolean(weekTemporalRows.exactByBucketAndDay[bucket.id]?.[day]?.length)
                      ) || Boolean(weekTemporalRows.unscheduledByDay[day]?.length);
                    return (
                      <div key={`week-temporal-mobile-${day}`} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2">
                        <div className="mb-2 flex items-center justify-between gap-3 px-1">
                          <div className="text-xs font-semibold text-slate-700">
                            {formatLoggerWeekday(day)} {new Date(day + "T00:00:00").getDate()}
                          </div>
                          {day === clientToday ? (
                            <div className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                              Today
                            </div>
                          ) : null}
                        </div>
                        {hasLogs ? (
                          <div className="grid gap-2">
                            {LOGGER_TIME_OF_DAY_BUCKETS.map((bucket) => {
                              const rows = weekTemporalRows.exactByBucketAndDay[bucket.id]?.[day] ?? [];
                              if (!rows.length) return null;
                              return (
                                <div key={`${day}-${bucket.id}-mobile`} className="grid gap-1.5">
                                  <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    {bucket.label}
                                  </div>
                                  {rows.map((row) => renderTemporalLogButton(row))}
                                </div>
                              );
                            })}
                            {(weekTemporalRows.unscheduledByDay[day] ?? []).length ? (
                              <div className="grid gap-1.5">
                                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Unscheduled
                                </div>
                                {(weekTemporalRows.unscheduledByDay[day] ?? []).map((row) => renderTemporalLogButton(row))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="px-1 py-3 text-sm text-slate-300">No logged work</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 hidden overflow-x-auto pb-1 md:block">
                  <div className="min-w-[920px]">
                    <div className="grid grid-cols-[96px_repeat(7,minmax(108px,1fr))] gap-1">
                      <div />
                      {weekTemporalRows.days.map((day) => (
                        <div
                          key={`week-temporal-heading-${day}`}
                          className={`rounded-xl px-2 py-2 text-center ${
                            day === clientToday ? "bg-slate-100 text-slate-900" : "bg-slate-50 text-slate-500"
                          }`}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {formatLoggerWeekday(day)}
                          </div>
                          <div className="mt-0.5 text-sm font-semibold tabular-nums">
                            {new Date(day + "T00:00:00").getDate()}
                          </div>
                        </div>
                      ))}

                      {LOGGER_TIME_OF_DAY_BUCKETS.map((bucket) => (
                        <React.Fragment key={`week-temporal-${bucket.id}`}>
                          <div className="px-1 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {bucket.label}
                          </div>
                          {weekTemporalRows.days.map((day) => {
                            const rows = weekTemporalRows.exactByBucketAndDay[bucket.id]?.[day] ?? [];
                            return (
                              <div
                                key={`${bucket.id}-${day}`}
                                className={`min-h-[84px] rounded-2xl p-1.5 ${
                                  rows.length
                                    ? "bg-slate-50/60"
                                    : "border border-dashed border-slate-100/70 bg-transparent"
                                }`}
                              >
                                <div className="grid gap-1.5">
                                  {rows.map((row) => renderTemporalLogButton(row, "week"))}
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}

                      <div className="px-1 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Unscheduled
                      </div>
                      {weekTemporalRows.days.map((day) => {
                        const rows = weekTemporalRows.unscheduledByDay[day] ?? [];
                        return (
                          <div
                            key={`unscheduled-${day}`}
                            className={`min-h-[70px] rounded-2xl p-1.5 ${
                              rows.length
                                ? "bg-slate-50/60"
                                : "border border-dashed border-slate-100/70 bg-transparent"
                            }`}
                          >
                            <div className="grid gap-1.5">
                              {rows.map((row) => renderTemporalLogButton(row, "week"))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="order-6 mt-3 overflow-hidden rounded-[18px] border border-slate-200/70 bg-white md:order-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setLoggerDetailsOpen((open) => !open)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-950"
                  aria-expanded={loggerDetailsOpen}
                >
                  <ChevronRight
                    className={`h-4 w-4 text-slate-400 transition-transform ${
                      loggerDetailsOpen ? "rotate-90" : ""
                    }`}
                    aria-hidden="true"
                  />
                  Detailed logs
                </button>
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                  {[
                    { id: "hours", label: "Hours" },
                    { id: "times", label: "Times" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLoggerValueMode(option.id as LoggerValueMode)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                        loggerValueMode === option.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {loggerDetailsOpen ? (
                loggerRangeMode === "year" ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">
                    Detailed daily view is available in Week, Month or Custom.
                  </div>
                ) : (
              <>
              <div className="mt-3 md:hidden">
                <div className="overflow-x-auto pb-2">
                  <div className="flex w-max gap-1">
                    {loggerDays.map((day) => {
                      const isSelected = day === loggerMobileDate;
                      const isToday = day === clientToday;
                      return (
                        <button
                          key={`logger-mobile-day-${day}`}
                          type="button"
                          onClick={() => setLoggerMobileSelectedDate(day)}
                          className={`w-14 rounded-2xl border px-2 py-2 text-center transition-colors ${
                            isSelected
                              ? "border-slate-900 bg-white text-slate-950"
                              : "border-slate-200/80 bg-white/70 text-slate-500 hover:bg-white"
                          }`}
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                            {formatLoggerWeekday(day).slice(0, 3)}
                          </div>
                          <div
                            className={`mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                              isToday ? "bg-slate-900 text-white" : ""
                            }`}
                          >
                            {new Date(day + "T00:00:00").getDate()}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-2 divide-y divide-slate-100 rounded-[18px] border border-slate-200/70 bg-white">
                  <div className="px-3 py-2 text-xs font-medium text-slate-500">
                    {formatLoggerDate(loggerMobileDate)}
                  </div>
                  {loggerRows.length ? (
                    loggerRows.map(({ task }) => {
                      const cellLogs = logsByTaskDate[`${task.id}:${loggerMobileDate}`] ?? [];
                      const openCellLogs = openLogsByTaskDate[`${task.id}:${loggerMobileDate}`] ?? [];
                      const hours = cellLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
                      const count = cellLogs.length;
                      const hasValue = loggerValueMode === "hours" ? hours > 0 : count > 0;

                      return (
                        <button
                          key={`logger-mobile-row-${task.id}`}
                          type="button"
                          onClick={() => openLogTime(task.id, loggerMobileDate, cellLogs[0] ?? openCellLogs[0])}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50/70"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">{task.title}</span>
                            <span className="mt-0.5 inline-flex min-w-0 text-xs text-slate-400">
                              {renderCategoryIdentity(task.courseId)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                            {hasValue
                              ? loggerValueMode === "hours"
                                ? formatGridHours(hours)
                                : count
                              : openCellLogs.length
                                ? <Clock3 className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                                : ""}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-slate-400">
                      No tasks have time logs in this view.
                    </div>
                  )}
                </div>
              </div>

              <div
                ref={loggerGridScrollRef}
                className="mt-3 hidden max-w-full overflow-x-auto p-2 md:block"
              >
                <table
                  className={`min-w-max border-separate text-sm ${
                    useCompactLoggerGrid
                      ? "border-spacing-x-0 border-spacing-y-0.5"
                      : "border-spacing-x-0.5 border-spacing-y-0.5"
                  }`}
                >
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th
                        className={`sticky left-0 z-40 bg-white text-left font-medium shadow-[1px_0_0_rgba(148,163,184,0.18)] ${
                          useCompactLoggerGrid
                            ? "w-[232px] min-w-[232px] max-w-[232px] rounded-lg px-3 py-1.5"
                            : "w-64 rounded-xl px-3 py-2"
                        }`}
                      >
                        Task
                      </th>
                      <th
                        className={`sticky z-40 bg-white text-left font-medium text-slate-400 shadow-[1px_0_0_rgba(148,163,184,0.14)] ${
                          useCompactLoggerGrid
                            ? "left-[232px] w-[156px] min-w-[156px] max-w-[156px] rounded-lg px-3 py-1.5"
                            : "left-64 w-44 rounded-xl px-3 py-2"
                        }`}
                      >
                        Category
                      </th>
                      {loggerDays.map((day) => (
                        <th
                          key={day}
                          className={`text-center font-medium ${
                            useCompactLoggerGrid
                              ? "w-12 min-w-12 px-0.5 py-0.5"
                              : "w-16 min-w-16 px-1 py-1"
                          }`}
                        >
                          <div
                            className={`${
                              useCompactLoggerGrid ? "rounded-lg px-1 py-1.5" : "rounded-xl px-2 py-2"
                            } ${
                              day === clientToday ? "bg-slate-100 text-slate-800" : "bg-white text-slate-500"
                            }`}
                          >
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                              {formatLoggerWeekday(day).slice(0, 3)}
                            </div>
                            <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-700">
                              {new Date(day + "T00:00:00").getDate()}
                            </div>
                          </div>
                        </th>
                      ))}
                      <th
                        className={`sticky right-0 z-40 bg-white text-right font-medium shadow-[-1px_0_0_rgba(148,163,184,0.18)] ${
                          useCompactLoggerGrid
                            ? "w-20 min-w-20 rounded-lg px-2 py-1.5"
                            : "w-24 rounded-xl px-3 py-2"
                        }`}
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loggerRows.length ? (
                      loggerRows.map(({ task, total }) => (
                        <tr key={task.id}>
                          <td
                            className={`sticky left-0 z-30 bg-white shadow-[1px_0_0_rgba(148,163,184,0.14)] ${
                              useCompactLoggerGrid
                                ? "w-[232px] min-w-[232px] max-w-[232px] rounded-lg px-3 py-1.5"
                                : "w-64 rounded-xl px-3 py-2"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => openLogTime(task.id)}
                              className={`block truncate text-left font-medium text-slate-800 hover:text-slate-950 ${
                                useCompactLoggerGrid ? "max-w-[208px]" : "max-w-56"
                              }`}
                            >
                              {task.title}
                            </button>
                          </td>
                          <td
                            className={`sticky z-30 bg-white text-xs text-slate-500 shadow-[1px_0_0_rgba(148,163,184,0.1)] ${
                              useCompactLoggerGrid
                                ? "left-[232px] w-[156px] min-w-[156px] max-w-[156px] rounded-lg px-3 py-1.5"
                                : "left-64 w-44 rounded-xl px-3 py-2"
                            }`}
                          >
                            <span className="block min-w-0">{renderCategoryIdentity(task.courseId)}</span>
                          </td>
                          {loggerDays.map((day) => {
                            const cellLogs = logsByTaskDate[`${task.id}:${day}`] ?? [];
                            const openCellLogs = openLogsByTaskDate[`${task.id}:${day}`] ?? [];
                            const hours = cellLogs.reduce((sum, log) => sum + (log.hours ?? 0), 0);
                            const count = cellLogs.length;
                            const hasValue = loggerValueMode === "hours" ? hours > 0 : count > 0;
                            const title = `${task.title} • ${day} • ${
                              loggerValueMode === "hours" ? formatDuration(hours) : `${count} logs`
                            }${openCellLogs.length ? " • Open session" : ""}`;

                            return (
                              <td
                                key={`${task.id}-${day}`}
                                className={`text-center text-xs font-medium tabular-nums ${
                                  useCompactLoggerGrid
                                    ? "h-10 w-12 min-w-12 px-0.5 py-0.5"
                                    : "h-11 w-16 min-w-16 px-1 py-1"
                                }`}
                                title={title}
                              >
                                <button
                                  type="button"
                                  onClick={() => openLogTime(task.id, day, cellLogs[0] ?? openCellLogs[0])}
                                  className={`flex items-center justify-center transition-colors ${
                                    useCompactLoggerGrid ? "h-9 w-11 rounded-lg" : "h-10 w-14 rounded-xl"
                                  } ${
                                    loggerValueMode === "hours"
                                      ? loggerCellTone(hours)
                                      : loggerCountCellTone(count)
                                  } ${hasValue ? "hover:ring-1 hover:ring-violet-200" : "hover:bg-slate-50"}`}
                                  aria-label={title}
                                >
                                  {loggerValueMode === "hours" ? (
                                    formatGridHours(hours) || (openCellLogs.length ? <Clock3 className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" /> : "")
                                  ) : (
                                    count || (openCellLogs.length ? <Clock3 className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" /> : "")
                                  )}
                                </button>
                              </td>
                            );
                          })}
                          <td
                            className={`sticky right-0 z-30 bg-white text-right text-xs font-semibold tabular-nums text-slate-800 shadow-[-1px_0_0_rgba(148,163,184,0.14)] ${
                              useCompactLoggerGrid
                                ? "w-20 min-w-20 rounded-lg px-2 py-1.5"
                                : "w-24 rounded-xl px-3 py-2"
                            }`}
                          >
                            {loggerValueMode === "hours"
                              ? total > 0
                                ? formatLoggedTime(total)
                                : ""
                              : closedTimeLogs.filter((log) => log.taskId === task.id && loggerDays.includes(log.date)).length || ""}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={loggerDays.length + 3}
                          className="px-4 py-8 text-center text-sm text-slate-400"
                        >
                          No tasks have time logs in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
                )
              ) : (
                <div className="px-3 py-3 text-xs text-slate-400">
                  Expand to inspect task-by-day logs and edit individual entries.
                </div>
              )}
            </section>

            <div className="order-4 space-y-4 border-t border-slate-100 px-0 py-3 md:order-4 md:px-4 md:py-4">
              {loggerRangeMode !== "day" && loggerRangeMode !== "week" ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-2 md:px-4 md:py-3">
                <div className="w-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Activity</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <span>Less</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                      <span
                        key={level}
                        className={`h-3 w-3 rounded-[3px] border ${loggerActivityCellTone(activityMap.colour, level)}`}
                        aria-label={`Activity intensity ${level}`}
                      />
                    ))}
                    <span>More</span>
                  </div>
                </div>

                <div className={`mt-2.5 max-w-full pb-0.5 ${activityMap.displayMode === "month" ? "" : "overflow-x-auto overscroll-x-contain"}`}>
                  {activityMap.displayMode === "strip" ? (
                    <div className="mx-auto grid max-w-3xl grid-cols-7 gap-1.5 sm:gap-2">
                      {activityMap.days.map((day) => {
                        const level = loggerActivityLevel(day.hours, activityMap.thresholds);
                        return (
                        <div key={day.date} className="grid min-w-0 gap-1 text-center">
                          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                            {formatLoggerWeekday(day.date).slice(0, 3)}
                          </span>
                          <span
                            className={`mx-auto h-9 w-full max-w-11 rounded-lg border ${loggerActivityCellTone(day.colour, level)} ${
                              day.date === clientToday ? "ring-1 ring-slate-400 ring-offset-1" : ""
                            }`}
                            title={`${formatLoggerDate(day.date)} • ${
                              day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                            }`}
                            aria-label={`${day.date}: ${
                              day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                            }`}
                          />
                          <span className="text-[11px] tabular-nums text-slate-500">
                            {new Date(day.date + "T00:00:00").getDate()}
                          </span>
                        </div>
                        );
                      })}
                    </div>
                  ) : activityMap.displayMode === "month" ? (
                    <div
                      ref={loggerMonthActivityScrollRef}
                      className="max-w-full overflow-x-auto overscroll-x-contain pb-1"
                    >
                      <div className="grid w-max grid-cols-[28px_auto] gap-x-2 md:min-w-full">
                        <div />
                        <div className="flex h-3.5 gap-0.5 text-[9px] text-slate-400 md:h-4 md:justify-between md:text-[10px]">
                          {activityMap.weeks.map((week, index) => {
                            const month = new Date(`${week.weekStart}T00:00:00`).getMonth();
                            const previousMonth = index > 0
                              ? new Date(`${activityMap.weeks[index - 1].weekStart}T00:00:00`).getMonth()
                              : null;
                            return (
                              <div key={week.weekStart} className="relative w-3 shrink-0 md:w-4">
                                {index === 0 || month !== previousMonth ? (
                                  <span className="absolute left-0 whitespace-nowrap">
                                    {new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${week.weekStart}T00:00:00`))}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-rows-7 gap-0.5 pt-0.5 text-[9px] leading-3 text-slate-400 md:leading-4">
                          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
                            <div key={`${label}-${index}`} className="h-3 md:h-4">{label}</div>
                          ))}
                        </div>
                        <div className="flex gap-0.5 md:justify-between">
                          {activityMap.weeks.map((week) => (
                            <div key={week.weekStart} className="grid grid-rows-7 gap-0.5">
                              {week.days.map((day) => {
                                const isInRange = day.date >= activityMap.rawStart && day.date <= activityMap.end;
                                const level = isInRange ? loggerActivityLevel(day.hours, activityMap.thresholds) : 0;
                                return (
                                  <span
                                    key={day.date}
                                    className={`h-3 w-3 rounded-[3px] border md:h-4 md:w-4 md:rounded-[4px] ${
                                      isInRange
                                        ? loggerActivityCellTone(day.colour, level)
                                        : "border-transparent bg-transparent"
                                    } ${isInRange && day.date === clientToday ? "ring-1 ring-slate-400 ring-offset-1" : ""}`}
                                    title={`${formatLoggerDate(day.date)} • ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                    aria-label={`${day.date}: ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={activityMap.displayMode === "contribution" ? "mx-auto w-fit min-w-max" : "w-full"}>
                      <div className="grid grid-cols-[28px_1fr] gap-x-2">
                        <div />
                        <div
                          className="grid h-4 text-[10px] text-slate-400"
                          style={{
                            gridTemplateColumns: `repeat(${activityMap.weeks.length}, ${
                              activityMap.compact ? "12px" : "minmax(0, 1fr)"
                            })`,
                          }}
                        >
                          {activityMap.weeks.map((week, index) => {
                            const month = new Date(week.weekStart + "T00:00:00").getMonth();
                            const previousMonth =
                              index > 0
                                ? new Date(activityMap.weeks[index - 1].weekStart + "T00:00:00").getMonth()
                                : null;
                            return (
                              <div key={week.weekStart} className="relative">
                                {index === 0 || month !== previousMonth ? (
                                  <span className="absolute left-0 whitespace-nowrap">
                                    {new Intl.DateTimeFormat("en", { month: "short" }).format(
                                      new Date(week.weekStart + "T00:00:00")
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div
                          className={`grid grid-rows-7 ${
                            activityMap.compact ? "gap-[3px]" : "gap-1"
                          } pt-[3px] text-[10px] leading-3 text-slate-400`}
                        >
                          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, index) => (
                            <div key={`${label}-${index}`} className={activityMap.compact ? "h-3" : "h-5"}>
                              {label}
                            </div>
                          ))}
                        </div>
                        <div className={`flex ${activityMap.compact ? "gap-[3px]" : "gap-1"}`}>
                          {activityMap.weeks.map((week) => (
                            <div
                              key={week.weekStart}
                              className={`grid grid-rows-7 ${activityMap.compact ? "gap-[3px]" : "gap-1"}`}
                            >
                              {week.days.map((day) => {
                                const isInRange = day.date >= activityMap.rawStart && day.date <= activityMap.end;
                                const level = isInRange ? loggerActivityLevel(day.hours, activityMap.thresholds) : 0;
                                return (
                                  <span
                                    key={day.date}
                                    className={`border ${
                                      activityMap.compact ? "h-3 w-3 rounded-[3px]" : "h-5 w-full rounded-md"
                                    } ${
                                      isInRange ? loggerActivityCellTone(day.colour, level) : "border-transparent bg-transparent"
                                    } ${
                                      isInRange && day.date === clientToday ? "ring-1 ring-slate-400 ring-offset-1" : ""
                                    }`}
                                    title={`${formatLoggerDate(day.date)} • ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                    aria-label={`${day.date}: ${
                                      isInRange && day.hours > 0 ? `${formatLoggedTime(day.hours)} worked` : "No time logged"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Where my time went</div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                    {[
                      { id: "tasks", label: "Tasks" },
                      { id: "categories", label: "Categories" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setLoggerBreakdownMode(option.id as LoggerBreakdownMode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          loggerBreakdownMode === option.id
                            ? "bg-slate-900 text-white"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 max-w-3xl space-y-3 md:max-w-none">
                  {loggerBreakdown.rows.length ? (
                    <>
                      {(loggerBreakdownExpanded ? loggerBreakdown.rows : loggerBreakdown.rows.slice(0, 10)).map((row, index) => {
                        const share = loggerBreakdown.totalHours > 0 ? (row.hours / loggerBreakdown.totalHours) * 100 : 0;
                        const barPercent = loggerBreakdown.maxHours > 0 ? (row.hours / loggerBreakdown.maxHours) * 100 : 0;
                        const tone = loggerCategoryTone(row.colour);
                        return (
                          <div key={row.id} className="grid gap-1.5">
                            <div className="grid grid-cols-[24px_1fr] gap-2 text-xs sm:grid-cols-[28px_1fr_auto_auto] sm:items-baseline sm:gap-3">
                              <div className="tabular-nums text-slate-400">{index + 1}</div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-slate-800">
                                  {loggerBreakdownMode === "categories" && row.categoryId
                                    ? renderCategoryIdentity(row.categoryId)
                                    : row.title}
                                </div>
                                <div className="truncate text-[11px] text-slate-500">
                                  {loggerBreakdownMode === "tasks" && row.categoryId
                                    ? renderCategoryIdentity(row.categoryId)
                                    : row.subtitle}
                                </div>
                              </div>
                              <div className="col-start-2 flex items-center justify-between gap-3 tabular-nums text-slate-600 sm:col-start-auto sm:block">
                                <span>{formatDuration(row.hours)}</span>
                                <span className="sm:hidden">{Math.round(share)}%</span>
                              </div>
                              <div className="hidden tabular-nums text-slate-500 sm:block">{Math.round(share)}%</div>
                            </div>
                            <div className="ml-8 h-2 rounded-full bg-slate-100 sm:ml-10">
                              <div
                                className={`h-2 rounded-full ${tone.accent}`}
                                style={{ width: `${barPercent > 0 ? Math.max(3, barPercent) : 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      {loggerBreakdown.rows.length > 10 ? (
                        <button
                          type="button"
                          onClick={() => setLoggerBreakdownExpanded((expanded) => !expanded)}
                          className="rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        >
                          {loggerBreakdownExpanded
                            ? "Show less"
                            : `Show ${loggerBreakdown.rows.length - 10} more`}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-400">
                      No logged time in this period.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8">
            {/* Attention */}
            <section className="order-1">
              <div className="border-b border-slate-200/70 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-slate-900">Attention score</div>
                    <div className="text-xs text-slate-500">{scoredTasks.length} tasks</div>
                  </div>
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAttentionCategoryMenuOpen((open) => !open);
                      }}
                    >
                      Categories
                      {attentionIncludedCategoryIds.length !== activeCategories.length ? (
                        <span className="text-slate-400"> · {attentionIncludedCategoryIds.length}</span>
                      ) : null}
                    </button>
                    {attentionCategoryMenuOpen ? (
                      <div className="absolute right-0 top-full z-[1000] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 text-xs shadow-xl ring-1 ring-slate-900/5">
                        <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          Categories
                        </div>
                        <div className="mt-1 max-h-56 overflow-auto">
                          {activeCategories.map((category) => {
                            const selected = !attentionCategoryExcludedIds.includes(category.id);
                            return (
                              <button
                                key={category.id}
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-600 hover:bg-slate-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAttentionCategoryExcludedIds((ids) =>
                                    selected
                                      ? Array.from(new Set([...ids, category.id]))
                                      : ids.filter((id) => id !== category.id)
                                  );
                                }}
                              >
                                <span className="flex h-4 w-4 items-center justify-center text-slate-700">
                                  {selected ? <Check className="h-3 w-3" /> : null}
                                </span>
                                <span className="min-w-0 truncate"><CategoryIdentity category={category} compact /></span>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttentionCategoryExcludedIds([]);
                          }}
                        >
                          Select all
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="grid overflow-hidden rounded-[18px] border border-slate-200/70 bg-white sm:grid-cols-2 xl:grid-cols-3">
                  {attentionIncludedCategoryIds.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400 sm:col-span-2 xl:col-span-3">
                      No categories selected
                    </div>
                  ) : null}
                  {attentionIncludedCategoryIds.length > 0 ? scoredTasks.map(({ task, total: score, reasons, visualAttentionScore }, index) => {
                    return (
                      <div
                        key={task.id}
                        className="cursor-pointer border-b border-slate-100/80 p-3 transition-colors hover:bg-slate-50/70 sm:border-r xl:[&:nth-child(3n)]:border-r-0 sm:[&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r"
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openEdit(task);
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="grid min-w-0 grid-cols-[1.5rem_1fr] gap-2">
                            <div className="pt-0.5 text-xs tabular-nums text-slate-300">{index + 1}</div>
                            <div className="min-w-0">
                            <div className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{task.title}</div>
                            <div className="mt-1 inline-flex min-w-0 text-[11px] text-slate-500">
                              {renderCategoryIdentity(task.courseId)}
                            </div>
                            {reasons.length ? (
                              <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">
                                {reasons.join(" · ")}
                              </div>
                            ) : null}
                            </div>
                          </div>

                          <div className="shrink-0 text-xs font-semibold tabular-nums text-slate-700">{Math.round(score)}</div>
                        </div>

                        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${urgencyColour(visualAttentionScore)}`}
                            style={{ width: `${visualAttentionScore}%` }}
                          />
                        </div>
                      </div>
                    );
                  }) : null}
                </div>
              </div>
            </section>

            {/* Category columns */}
            <div className="order-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {activeCategories.map((c) => {
                const categoryTasks = byCourse[c.id] ?? [];
                const isExpanded = expandedDashboardCategoryIds.includes(c.id);
                const visibleTasks = isExpanded ? categoryTasks : categoryTasks.slice(0, 4);
                const remainingTasks = Math.max(0, categoryTasks.length - visibleTasks.length);

                return (
                <div key={c.id} className="self-start rounded-[18px] border border-slate-200/70 bg-white">
                  <div className="border-b border-slate-100/80 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 text-sm font-semibold tracking-tight text-slate-900">
                        <CategoryIdentity category={c} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCategory(c)}
                          className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 px-4 py-4">
                    {categoryTasks.length ? (
                      visibleTasks.map((t) => {
                        const deadlineLabel = compactDeadlineLabel(t);
                        const activityLabel = activityTypeLabel(t.activityType);

                        return (
                          <div
                            key={t.id}
                            onClick={() => openEdit(t)}
                            className={`cursor-pointer rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 transition-colors hover:bg-slate-50/70 ${frozenTaskClass(t)}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") openEdit(t);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className={`truncate text-sm font-medium ${frozenTitleClass(t)}`}>{t.title}</div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {deadlineLabel ? (
                                    <TaskMetaPill className={`${deadlinePillTone(t)} bg-opacity-60`}>
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                      {deadlineLabel}
                                    </TaskMetaPill>
                                  ) : null}
                                  {t.activityType && activityLabel ? (
                                    <TaskMetaPill className={`${activityPillTone(t.activityType)} bg-opacity-60`}>
                                      <ActivityTypeIcon activityType={t.activityType} />
                                      {activityLabel}
                                    </TaskMetaPill>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeTask(t.id);
                                }}
                                aria-label="Mark completed"
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="cursor-pointer rounded-2xl border border-dashed border-slate-200 p-3 text-sm text-slate-400 hover:bg-slate-50"
                        role="button"
                        tabIndex={0}
                        onClick={() => openNewTaskForCourse(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openNewTaskForCourse(c.id);
                        }}
                      >
                        Empty
                      </div>
                    )}
                    {categoryTasks.length > 4 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDashboardCategoryIds((ids) =>
                            isExpanded ? ids.filter((id) => id !== c.id) : [...ids, c.id]
                          )
                        }
                        className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      >
                        {isExpanded ? "Show less" : `Show ${remainingTasks} more`}
                      </button>
                    ) : null}
                  </div>
                </div>
                );
              })}

              <button
                type="button"
                onClick={openAddCategory}
                className="min-h-[150px] rounded-[20px] border border-dashed border-slate-300 bg-white p-4 text-left hover:bg-slate-50"
              >
                <div className="text-sm font-semibold text-slate-700">+ Add category</div>
                <div className="mt-1 text-xs text-slate-400">
                  Create a new category card
                </div>
              </button>

              {archivedCategories.length ? (
                <div className="rounded-[20px] border border-slate-200/70 bg-white p-4 md:col-span-2 xl:col-span-3 2xl:col-span-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold">Archived categories</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Hidden from normal use, still safe for existing tasks
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {archivedCategories.map((category) => (
                      <div
                        key={category.id}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                      >
                        <CategoryIdentity category={category} compact />
                        <button
                          type="button"
                          onClick={() => restoreCategory(category)}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

          </div>
        )}

        {/* Keyboard reminder */}
        {mode !== "meds" ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="font-medium text-slate-900">Keyboard</div>
              <div className="mt-1">
                Press <span className="rounded border px-1">/</span> to search,{" "}
                <span className="rounded border px-1">n</span> to create a task.
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Last local backup: {hasMounted ? backupStatus.label : "—"} · Backups kept:{" "}
                {hasMounted ? backupStatus.count : "—"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportBackup}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export backup
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Import backup
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importBackup(file);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>
        </div>
        ) : null}
        </div>
      </main>

      <Modal open={medsModalMode === "alcohol"} title="Log alcohol" onClose={closeMedsModal}>
        <div className="grid gap-3">
          {medsError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {medsError}
            </div>
          ) : null}

          <Field label="Drink type">
            <div className="grid grid-cols-3 gap-2">
              {ALCOHOL_DRINK_TYPES.map((drinkType) => (
                <button
                  key={drinkType.id}
                  type="button"
                  onClick={() => {
                    const defaults = ALCOHOL_DRINK_DEFAULTS[drinkType.id];
                    setAlcoholDrinkType(drinkType.id);
                    setAlcoholServingSizeMl(defaults.servingSizeMl);
                    setAlcoholAbvPercent(defaults.abvPercent);
                  }}
                  className={`grid min-h-[66px] place-items-center gap-1 rounded-[16px] border px-2 py-2 text-center text-[12px] font-medium transition-colors ${
                    alcoholDrinkType === drinkType.id
                      ? "border-rose-200 bg-rose-50 text-slate-950"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <drinkType.Icon className="h-5 w-5 text-rose-500" aria-hidden />
                  <span>{drinkType.id}</span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Quantity (drinks)">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={alcoholQuantity}
              onChange={(event) => setAlcoholQuantity(event.target.value)}
              className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="Number of drinks"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Serving size (ml)">
              <input
                type="number"
                min="0"
                step="1"
                value={alcoholServingSizeMl}
                onChange={(event) => setAlcoholServingSizeMl(event.target.value)}
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                inputMode="decimal"
              />
            </Field>
            <Field label="ABV (%)">
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={alcoholAbvPercent}
                onChange={(event) => setAlcoholAbvPercent(event.target.value)}
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                inputMode="decimal"
              />
            </Field>
          </div>

          {estimatedAlcoholUnits !== null ? (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">Estimated alcohol</span>
              <span className="text-sm font-semibold text-slate-900">{estimatedAlcoholUnits.toFixed(1)} units</span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start time">
              <input
                type="datetime-local"
                value={alcoholStartedAt}
                onChange={(event) => setAlcoholStartedAt(event.target.value)}
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
            <Field label="End time (optional)">
              <input
                type="datetime-local"
                value={alcoholEndedAt}
                min={alcoholStartedAt || undefined}
                onChange={(event) => setAlcoholEndedAt(event.target.value)}
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeMedsModal}
              disabled={medsSaving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitAlcoholEntry}
              disabled={medsSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {medsSaving ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Medication dose modal */}
      <Modal
        open={medsModalMode === "dose"}
        title={editingMedicationEntry?.entryType === "input" ? "Edit dose" : "Add entry"}
        onClose={closeMedsModal}
      >
        <div className="grid gap-3">
          {medsError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {medsError}
            </div>
          ) : null}

          {doseMedicationKind !== "Coffee" ? (
          <Field label="What">
            <div className="grid grid-cols-2 gap-2">
              {MEDICATION_OPTIONS.filter((option) => option.id !== "Coffee").map((option) => {
                const selected = doseMedicationKind === option.id;
                const tones = {
                  Vyvanse: selected
                    ? "border-orange-200 bg-orange-50/90 text-orange-600"
                    : "border-transparent bg-slate-50 text-orange-500 hover:bg-orange-50/60",
                  Prozac: selected
                    ? "border-violet-200 bg-violet-50/90 text-violet-600"
                    : "border-transparent bg-slate-50 text-violet-500 hover:bg-violet-50/60",
                  Coffee: selected
                    ? "border-amber-200 bg-amber-50/90 text-amber-600"
                    : "border-transparent bg-slate-50 text-amber-500 hover:bg-amber-50/60",
                  Custom: selected
                    ? "border-slate-300 bg-slate-100 text-slate-800"
                    : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100",
                } as const;
                const Icon = option.id === "Custom" ? Plus : PillIcon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setDoseMedicationKind(option.id);
                      setDoseUnit(option.unit);
                    }}
                    className={`flex h-14 items-center gap-3 rounded-[17px] border px-3 text-left transition-colors ${tones[option.id]}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/80 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                      <Icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>
          ) : null}

          {doseMedicationKind === "Custom" ? (
            <Field label="Custom name">
              <input
                value={doseCustomMedication}
                onChange={(e) => setDoseCustomMedication(e.target.value)}
                className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Name"
              />
            </Field>
          ) : null}

          {doseMedicationKind === "Coffee" ? (
            <>
              <Field label="Drink type">
                <div className="grid grid-cols-3 gap-2">
                  {CAFFEINE_DRINK_DEFAULTS.map((drink) => (
                    <button
                      key={drink.id}
                      type="button"
                      onClick={() => applyCaffeineDrinkDefaults(drink.id)}
                      className={`grid min-h-[74px] place-items-center gap-1 rounded-[16px] border px-2 py-2 text-center text-[12px] font-medium ${
                        caffeineDrinkId === drink.id
                          ? "border-amber-300 bg-amber-50 text-slate-950"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <Coffee className="h-5 w-5" aria-hidden />
                      <span>{drink.label}</span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Time">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  {caffeineWhenMode === "manual" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={caffeineDate}
                        onChange={(e) => setCaffeineDate(e.target.value)}
                        className="h-12 min-w-0 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                      <input
                        type="time"
                        value={caffeineTime}
                        onChange={(e) => setCaffeineTime(e.target.value)}
                        className="h-12 min-w-0 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 items-center rounded-[16px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800">
                      {new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date())}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setCaffeineWhenMode((mode) => (mode === "now" ? "manual" : "now"))}
                    className="flex h-12 items-center gap-2 rounded-[16px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                  >
                    <Clock className="h-4 w-4" aria-hidden />
                    {caffeineWhenMode === "now" ? "Choose" : "Now"}
                  </button>
                </div>
              </Field>

            </>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_96px] gap-3">
                <Field label="Amount">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={doseAmount}
                    onChange={(e) => setDoseAmount(e.target.value)}
                    className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="30"
                  />
                </Field>
                <Field label="Unit">
                  <input
                    value={doseUnit}
                    onChange={(e) => setDoseUnit(e.target.value)}
                    className="h-11 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="mg"
                  />
                </Field>
              </div>

              <Field label="When">
                <div className="grid gap-2">
                  <div className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 p-1">
                    {[
                      { id: "now", label: "Now" },
                      { id: "manual", label: "Choose time" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDoseWhenMode(option.id as "now" | "manual")}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          doseWhenMode === option.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {doseWhenMode === "manual" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={doseDate}
                        onChange={(e) => setDoseDate(e.target.value)}
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                      <input
                        type="time"
                        value={doseTime}
                        onChange={(e) => setDoseTime(e.target.value)}
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      />
                    </div>
                  ) : null}
                </div>
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeMedsModal}
              disabled={medsSaving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doseMedicationKind === "Coffee" ? submitCaffeineEntry : submitDose}
              disabled={medsSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {medsSaving ? "Saving" : editingMedicationEntry?.entryType === "input" ? "Save changes" : doseMedicationKind === "Coffee" ? "Log caffeine" : "Save"}
            </button>
          </div>

          {editingMedicationEntry?.entryType === "input" ? (
            <div className="border-t border-slate-100 pt-3">
              {medsDeleteConfirm ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">Delete this entry?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMedsDeleteConfirm(false)}
                      disabled={medsSaving}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={deleteEditingMedicationEntry}
                      disabled={medsSaving}
                      className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-rose-200"
                    >
                      {medsSaving ? "Deleting" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMedsDeleteConfirm(true)}
                  disabled={medsSaving}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                >
                  Delete entry
                </button>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Medication feeling modal */}
      <Modal
        open={medsModalMode === "feeling"}
        title={editingMedicationEntry?.entryType === "observation" ? "Edit feeling" : "Add feeling"}
        onClose={closeMedsModal}
      >
        <div className="grid gap-3">
          {medsError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {medsError}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Feelings</div>
              <div className="mt-0.5 text-xs text-slate-500">Select one or more, then set intensity.</div>
            </div>
            <button
              type="button"
              onClick={() => setFeelingManageOpen((open) => !open)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {feelingManageOpen ? "Done" : "Manage"}
            </button>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Feeling / State</div>
              <FeelingSelectionGrid
                definitions={feelingDefinitions.filter((definition) => definition.active && definition.category === "state")}
                selectedFeelingLogs={selectedFeelingLogs}
                onToggle={toggleStructuredFeeling}
              />
            </div>
            <div className="grid gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Symptoms</div>
              <FeelingSelectionGrid
                definitions={feelingDefinitions.filter((definition) => definition.active && definition.category === "symptom")}
                selectedFeelingLogs={selectedFeelingLogs}
                onToggle={toggleStructuredFeeling}
              />
            </div>
          </div>

          {Object.keys(selectedFeelingLogs).length ? (
            <div className="grid gap-2 rounded-[16px] border border-slate-200/70 bg-slate-50/80 p-2.5">
              <div className="text-xs font-semibold text-slate-500">Selected</div>
              {feelingDefinitions
                .filter((definition) => selectedFeelingLogs[definition.id])
                .map((definition) => {
                  const Icon = feelingIconComponent(definition.icon);
                  const iconColor = feelingVisualIconColor(definition);
                  return (
                    <div key={definition.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200/70">
                          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden />
                        </span>
                        <span className="truncate text-sm font-medium text-slate-800">{definition.name}</span>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((intensity) => (
                          <button
                            key={intensity}
                            type="button"
                            onClick={() => setStructuredFeelingIntensity(definition.id, intensity)}
                            className={`h-7 w-7 rounded-full text-xs font-semibold ${
                              selectedFeelingLogs[definition.id]?.intensity === intensity
                                ? "bg-slate-950 text-white"
                                : "bg-white text-slate-500 ring-1 ring-slate-200"
                            }`}
                          >
                            {intensity}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : null}

          <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-3">
            <button
              type="button"
              onClick={() => setCustomFeelingOpen((open) => !open)}
              className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-600"
            >
              <span>Add custom feeling</span>
              <Plus className={`h-4 w-4 transition-transform ${customFeelingOpen ? "rotate-45" : ""}`} aria-hidden />
            </button>
            {customFeelingOpen ? (
              <div className="mt-3 grid gap-2">
                <input
                  value={newFeelingName}
                  onChange={(e) => setNewFeelingName(e.target.value)}
                  className="h-10 rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  placeholder="Feeling name"
                />
                <FeelingIconPicker value={newFeelingIcon} onChange={setNewFeelingIcon} />
                <div className="grid gap-2">
                  <select
                    value={newFeelingCategory}
                    onChange={(e) => setNewFeelingCategory(e.target.value as FeelingCategory)}
                    className="h-10 rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="state">Feeling / State</option>
                    <option value="symptom">Symptom</option>
                  </select>
                  <select
                    value={newFeelingValence}
                    onChange={(e) => setNewFeelingValence(e.target.value as FeelingValenceStable)}
                    className="h-10 rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    {FEELING_VALENCE_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addCustomFeelingDefinition}
                  disabled={medsSaving}
                  className="h-10 rounded-full bg-white text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  Add feeling
                </button>
              </div>
            ) : null}
          </div>

          {feelingManageOpen ? (
            <div className="rounded-[18px] border border-slate-200 bg-white p-3">
              <div className="text-xs font-semibold text-slate-500">Manage feelings</div>
              <div className="mt-3 grid gap-2">
                {feelingDefinitions.map((definition) => {
                  const Icon = feelingIconComponent(definition.icon);
                  return (
                    <div key={definition.id} className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2">
                      <div className="flex items-center gap-2">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${feelingValenceTone(definition.valence)}`}>
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <input
                          value={definition.name}
                          onChange={(e) => updateFeelingDefinition(definition.id, { name: e.target.value })}
                          className="h-9 min-w-0 flex-1 rounded-[12px] border border-slate-200 bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </div>
                      <FeelingIconPicker
                        value={definition.icon}
                        onChange={(icon) => updateFeelingDefinition(definition.id, { icon })}
                      />
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <select
                          value={definition.category}
                          onChange={(e) => updateFeelingDefinition(definition.id, { category: e.target.value as FeelingCategory })}
                          className="h-9 min-w-0 rounded-[12px] border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          <option value="state">State</option>
                          <option value="symptom">Symptom</option>
                        </select>
                        <select
                          value={definition.valence}
                          onChange={(e) => updateFeelingDefinition(definition.id, { valence: e.target.value as FeelingValenceStable })}
                          className="h-9 rounded-[12px] border border-slate-200 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          {FEELING_VALENCE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateFeelingDefinition(definition.id, { active: !definition.active })}
                          className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                        >
                          {definition.active ? "Archive" : "Enable"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <Field label="Timestamp">
            <div className="grid gap-2">
              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 p-1">
                {[
                  { id: "now", label: "Now" },
                  { id: "manual", label: "Choose time" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFeelingWhenMode(option.id as "now" | "manual")}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                      feelingWhenMode === option.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {feelingWhenMode === "manual" ? (
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={feelingDate}
                    onChange={(e) => setFeelingDate(e.target.value)}
                    className="h-11 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                  <input
                    type="time"
                    value={feelingTime}
                    onChange={(e) => setFeelingTime(e.target.value)}
                    className="h-11 rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              ) : null}
            </div>
          </Field>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeMedsModal}
              disabled={medsSaving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitFeeling}
              disabled={medsSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-300"
            >
              {medsSaving ? "Saving" : editingMedicationEntry?.entryType === "observation" ? "Save changes" : "Save"}
            </button>
          </div>

          {editingMedicationEntry?.entryType === "observation" ? (
            <div className="border-t border-slate-100 pt-3">
              {medsDeleteConfirm ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">Delete this entry?</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMedsDeleteConfirm(false)}
                      disabled={medsSaving}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={deleteEditingMedicationEntry}
                      disabled={medsSaving}
                      className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:bg-rose-200"
                    >
                      {medsSaving ? "Deleting" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMedsDeleteConfirm(true)}
                  disabled={medsSaving}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
                >
                  Delete entry
                </button>
              )}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal open={smartImportOpen} title="Smart schedule import" onClose={closeSmartImport}>
        <div className="grid gap-4">
          <Field label="Paste schedule">
            <textarea
              value={smartImportRaw}
              onChange={(e) => setSmartImportRaw(e.target.value)}
              className="min-h-[150px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Thesis meeting every Tuesday 11-1pm room 103 between October 1 and December 12"
            />
          </Field>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={parseSmartImportInput}
              disabled={!smartImportRaw.trim() || smartImportSaving}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Parse schedule
            </button>
            {smartImportMessage ? (
              <div className="text-right text-xs text-slate-500">{smartImportMessage}</div>
            ) : null}
          </div>

          {smartImportProposals.length || smartImportRaw.trim() ? (
            <div className="flex flex-wrap items-center gap-2">
              {smartImportProposals.length ? (
                <button
                  type="button"
                  onClick={parseSmartImportInput}
                  disabled={!smartImportRaw.trim() || smartImportSaving}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Retry parse
                </button>
              ) : null}
              <button
                type="button"
                onClick={resetSmartImport}
                disabled={smartImportSaving}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                Start over
              </button>
            </div>
          ) : null}

          {smartImportProposals.length ? (
            <div className="grid max-h-[48vh] gap-3 overflow-y-auto pr-1">
              {smartImportProposals.map((proposal) => {
                const warnings = validateSmartImportProposal(proposal);
                const possibleDuplicate = smartImportDuplicateWarning(proposal, calendarEvents);
                return (
                  <div
                    key={proposal.id}
                    className={`rounded-2xl border p-3 ${
                      proposal.savedEventId
                        ? "border-green-100 bg-green-50/60"
                        : warnings.length
                          ? "border-amber-100 bg-amber-50/40"
                          : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={proposal.include}
                          disabled={Boolean(proposal.savedEventId)}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { include: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="truncate">{proposal.title || "Untitled event"}</span>
                      </label>
                      <div className="flex shrink-0 items-center gap-1">
                        {proposal.savedEventId ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                            Added
                          </span>
                        ) : null}
                        {possibleDuplicate && !proposal.savedEventId ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Possible duplicate
                          </span>
                        ) : null}
                        {warnings.length ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Needs review
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Title">
                        <input
                          value={proposal.title}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { title: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label="Type">
                        <select
                          value={proposal.eventType}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              eventType: e.target.value as CalendarEventType,
                              allDay:
                                (e.target.value === "travel" && !proposal.startTime) ||
                                e.target.value === "milestone" ||
                                proposal.allDay,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          {PLANNER_EVENT_TYPES.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Field label="Recurrence">
                        <select
                          value={proposal.recurrence}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              recurrence: e.target.value as SmartImportRecurrence,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        >
                          <option value="none">One-off</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </Field>
                      <Field label={proposal.recurrence === "weekly" ? "Start date" : "Date"}>
                        <input
                          type="date"
                          value={proposal.date}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              date: e.target.value,
                              endDate: proposal.endDate < e.target.value ? e.target.value : proposal.endDate,
                              weekday:
                                proposal.recurrence === "weekly" && isValidISODate(e.target.value)
                                  ? isoWeekday(e.target.value)
                                  : proposal.weekday,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label={proposal.recurrence === "weekly" || proposal.allDay ? "End date" : "End date"}>
                        <input
                          type="date"
                          value={proposal.endDate}
                          min={proposal.date}
                          onChange={(e) =>
                            updateSmartImportProposal(proposal.id, {
                              endDate: e.target.value < proposal.date ? proposal.date : e.target.value,
                            })
                          }
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                    </div>

                    {proposal.recurrence === "weekly" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <Field label="Weekday">
                          <select
                            value={proposal.weekday}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { weekday: Number(e.target.value) })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            {PLANNER_WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { allDay: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        All day
                      </label>
                      <Field label="Start time">
                        <input
                          type="time"
                          value={proposal.startTime}
                          disabled={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { startTime: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </Field>
                      <Field label="End time">
                        <input
                          type="time"
                          value={proposal.endTime}
                          disabled={proposal.allDay}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { endTime: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </Field>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Location">
                        <input
                          value={proposal.location}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { location: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                      <Field label="Notes">
                        <input
                          value={proposal.notes}
                          onChange={(e) => updateSmartImportProposal(proposal.id, { notes: e.target.value })}
                          className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                        />
                      </Field>
                    </div>

                    {proposal.eventType === "travel" ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Field label="Origin">
                          <input
                            value={proposal.origin}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { origin: e.target.value })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                        <Field label="Destination">
                          <input
                            value={proposal.destination}
                            onChange={(e) => updateSmartImportProposal(proposal.id, { destination: e.target.value })}
                            className="h-9 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                      </div>
                    ) : null}

                    <div className="mt-2 text-[11px] text-slate-400">
                      Source: {proposal.sourceText}
                    </div>
                    {warnings.length ? (
                      <div className="mt-2 text-xs text-amber-700">
                        {warnings.join(" · ")}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={closeSmartImport}
              disabled={smartImportSaving}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={confirmSmartImport}
              disabled={
                smartImportSaving ||
                !smartImportProposals.some((proposal) => proposal.include && !proposal.savedEventId) ||
                smartImportProposals.some(
                  (proposal) =>
                    proposal.include &&
                    !proposal.savedEventId &&
                    validateSmartImportProposal(proposal).length > 0
                )
              }
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {smartImportSaving ? "Adding" : "Add selected events"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Planner event modal */}
      <Modal
        open={plannerEventModalOpen}
        title={plannerEventDraft ? (plannerEventModalMode === "edit" ? "Edit event" : "New event") : "New event"}
        onClose={closePlannerEventModal}
      >
        {plannerEventDraft ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setPlannerEventTypeChooserOpen((open) => !open)}
                className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${plannerEventTone(
                  plannerEventDraft.eventType
                )}`}
              >
                <PlannerEventTypeIcon eventType={plannerEventDraft.eventType} />
                <span>{plannerEventTypeLabel(plannerEventDraft.eventType)}</span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${plannerEventTypeChooserOpen ? "rotate-90" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {plannerEventTypeChooserOpen ? (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {plannerEventTypeOptionsForDraft(plannerEventDraft).map((option) => {
                    const selected = plannerEventDraft.eventType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setPlannerEventDraft(plannerDraftWithEventType(plannerEventDraft, option.id));
                          setPlannerEventTypeChooserOpen(false);
                        }}
                        className={`flex min-w-0 items-center gap-1.5 rounded-[14px] border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                          selected
                            ? plannerEventTone(option.id)
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <PlannerEventTypeIcon eventType={option.id} />
                        <span className="truncate">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <Field label="Title">
              <input
                value={plannerEventDraft.title}
                onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, title: e.target.value })}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Event title"
              />
            </Field>

            {plannerEventError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {plannerEventError}
              </div>
            ) : null}

            {plannerEventDraft.recurrenceParentId ? (
              <Field label="Apply changes to">
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  {[
                    { id: "this", label: "This event" },
                    { id: "future", label: "This and future" },
                    { id: "all", label: "All events" },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setPlannerEventDraft({
                          ...plannerEventDraft,
                          recurrenceApplyScope: option.id as PlannerEventDraft["recurrenceApplyScope"],
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        plannerEventDraft.recurrenceApplyScope === option.id
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}

            <Field label="When">
              <div className="flex flex-wrap gap-1.5">
                {PLANNER_WHEN_OPTIONS.map((option) => {
                  const selected = plannerWhenChoiceFromDraft(plannerEventDraft) === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPlannerEventDraft(plannerDraftWithWhenChoice(plannerEventDraft, option.id))}
                      disabled={plannerEventDraft.eventType === "milestone" && option.id !== "all_day"}
                      className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            {plannerDraftShowsEndDate ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={plannerEventDraft.eventType === "travel" || plannerEventDraft.allDay ? "Start date" : "Date"}>
                  <input
                    type="date"
                    value={plannerEventDraft.date}
                    onChange={(e) => {
                      const date = e.target.value;
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        date,
                        endDate: plannerEventDraft.endDate < date ? date : plannerEventDraft.endDate,
                      });
                    }}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="End date">
                  <input
                    type="date"
                    value={plannerEventDraft.endDate}
                    min={plannerEventDraft.date}
                    onChange={(e) =>
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        endDate: e.target.value < plannerEventDraft.date ? plannerEventDraft.date : e.target.value,
                      })
                    }
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : (
              <div className="grid gap-2">
                <Field label="Date">
                  <input
                    type="date"
                    value={plannerEventDraft.date}
                    onChange={(e) => {
                      const date = e.target.value;
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        date,
                        endDate: plannerEventDraft.endDate < date ? date : plannerEventDraft.endDate,
                        recurrenceStartDate:
                          plannerEventDraft.eventType === "class" && plannerEventDraft.repeat === "weekly"
                            ? date
                            : plannerEventDraft.recurrenceStartDate,
                        recurrenceEndDate:
                          plannerEventDraft.eventType === "class" &&
                          plannerEventDraft.repeat === "weekly" &&
                          plannerEventDraft.recurrenceEndDate < date
                            ? date
                            : plannerEventDraft.recurrenceEndDate,
                        recurrenceWeekday:
                          plannerEventDraft.eventType === "class" && isValidISODate(date)
                            ? isoWeekday(date)
                            : plannerEventDraft.recurrenceWeekday,
                      });
                    }}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                {(plannerEventDraft.eventType === "travel" ||
                  plannerEventDraft.allDay ||
                  plannerEventDraft.endDate > plannerEventDraft.date) &&
                plannerEventDraft.eventType !== "milestone" ? (
                  <button
                    type="button"
                    onClick={() => setPlannerEventDraft({ ...plannerEventDraft, endDate: addDaysISO(plannerEventDraft.date, 1) })}
                    className="w-fit rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Add end date
                  </button>
                ) : null}
              </div>
            )}

            {plannerWhenChoiceFromDraft(plannerEventDraft) === "at_time" ? (
              <Field label={plannerEventDraft.eventType === "deadline" ? "Time" : "Time"}>
                <input
                  type="time"
                  value={plannerEventDraft.startTime}
                  onChange={(e) =>
                    setPlannerEventDraft({
                      ...plannerEventDraft,
                      startTime: e.target.value,
                      daypart: "",
                      allDay: false,
                    })
                  }
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            ) : null}

            {plannerWhenChoiceFromDraft(plannerEventDraft) === "time_range" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start time">
                  <input
                    type="time"
                    value={plannerEventDraft.startTime}
                    onChange={(e) =>
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        startTime: e.target.value,
                        daypart: "",
                        allDay: false,
                      })
                    }
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="End time">
                  <input
                    type="time"
                    value={plannerEventDraft.endTime}
                    onChange={(e) =>
                      setPlannerEventDraft({
                        ...plannerEventDraft,
                        endTime: e.target.value,
                        daypart: "",
                        allDay: false,
                      })
                    }
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : null}

            {plannerEventDraft.eventType === "work" ? (
              <Field label="Tracker task">
                <select
                  value={plannerEventDraft.taskId}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, taskId: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">No linked task</option>
                  {plannerTaskOptions.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {plannerEventDraft.eventType === "deadline" ? (
              <Field label="Linked task">
                <select
                  value={plannerEventDraft.taskId}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, taskId: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">No linked task</option>
                  {plannerTaskOptions.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {plannerEventDraft.eventType === "meeting" ? (
              <Field label="Who">
                <input
                  value={plannerEventDraft.who}
                  onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, who: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                />
              </Field>
            ) : null}

            {plannerEventDraft.eventType === "travel" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Origin">
                  <input
                    value={plannerEventDraft.origin}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, origin: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
                <Field label="Destination">
                  <input
                    value={plannerEventDraft.destination}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, destination: e.target.value })}
                    className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : null}

            {plannerEventDraft.eventType === "active" ? (
              <Field label="Intensity">
                <div className="flex flex-wrap gap-1.5">
                  {PLANNER_ACTIVE_INTENSITY_OPTIONS.map((option) => {
                    const selected = plannerEventDraft.activeIntensity === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setPlannerEventDraft({
                            ...plannerEventDraft,
                            activeIntensity: selected ? "" : option.id,
                          })
                        }
                        className={`rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            ) : null}

            <button
              type="button"
              onClick={() => setPlannerEventMoreDetailsOpen((open) => !open)}
              className="flex w-fit items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              More details {plannerEventMoreDetailsOpen ? "▲" : "▼"}
            </button>

            {plannerEventMoreDetailsOpen ? (
              <div className="grid gap-3 border-t border-slate-100 pt-3">
                {plannerEventDraft.eventType === "work" ? (
                  <Field label="Focus">
                    <input
                      value={plannerEventDraft.description}
                      onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, description: e.target.value })}
                      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      placeholder="Optional focus"
                    />
                  </Field>
                ) : null}

                {plannerEventDraft.eventType === "class" ? (
                  <div className="grid gap-3">
                    <Field label="Repeat">
                      <select
                        value={plannerEventDraft.repeat}
                        onChange={(e) => {
                          const repeat = e.target.value as PlannerEventDraft["repeat"];
                          setPlannerEventDraft({
                            ...plannerEventDraft,
                            repeat,
                            recurrenceWeekday: isoWeekday(plannerEventDraft.date),
                            recurrenceStartDate: plannerEventDraft.date,
                            recurrenceEndDate:
                              plannerEventDraft.recurrenceEndDate < plannerEventDraft.date
                                ? plannerEventDraft.date
                                : plannerEventDraft.recurrenceEndDate,
                          });
                        }}
                        className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="none">Does not repeat</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </Field>

                    {plannerEventDraft.repeat === "weekly" ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Weekday">
                          <select
                            value={plannerEventDraft.recurrenceWeekday}
                            onChange={(e) =>
                              setPlannerEventDraft({
                                ...plannerEventDraft,
                                recurrenceWeekday: Number(e.target.value),
                              })
                            }
                            className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          >
                            {PLANNER_WEEKDAY_OPTIONS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Series start">
                          <input
                            type="date"
                            value={plannerEventDraft.recurrenceStartDate}
                            onChange={(e) => {
                              const recurrenceStartDate = e.target.value;
                              setPlannerEventDraft({
                                ...plannerEventDraft,
                                recurrenceStartDate,
                                recurrenceEndDate:
                                  plannerEventDraft.recurrenceEndDate < recurrenceStartDate
                                    ? recurrenceStartDate
                                    : plannerEventDraft.recurrenceEndDate,
                              });
                            }}
                            className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                        <Field label="Series end">
                          <input
                            type="date"
                            value={plannerEventDraft.recurrenceEndDate}
                            min={plannerEventDraft.recurrenceStartDate}
                            onChange={(e) =>
                              setPlannerEventDraft({
                                ...plannerEventDraft,
                                recurrenceEndDate:
                                  e.target.value < plannerEventDraft.recurrenceStartDate
                                    ? plannerEventDraft.recurrenceStartDate
                                    : e.target.value,
                              })
                            }
                            className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {plannerEventDraft.eventType === "class" ||
                plannerEventDraft.eventType === "meeting" ||
                plannerEventDraft.eventType === "personal" ||
                plannerEventDraft.eventType === "date" ||
                plannerEventDraft.eventType === "social" ||
                plannerEventDraft.eventType === "active" ||
                plannerEventDraft.eventType === "admin" ? (
                  <Field label="Location">
                    <input
                      value={plannerEventDraft.location}
                      onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, location: e.target.value })}
                      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                ) : null}

                {plannerEventDraft.eventType === "meeting" ? (
                  <Field label="Video link">
                    <input
                      value={plannerEventDraft.videoUrl}
                      onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, videoUrl: e.target.value })}
                      className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </Field>
                ) : null}

                <Field label="Notes">
                  <textarea
                    value={plannerEventDraft.notes}
                    onChange={(e) => setPlannerEventDraft({ ...plannerEventDraft, notes: e.target.value })}
                    className="min-h-[72px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </Field>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              {plannerEventModalMode === "edit" ? (
                <button
                  type="button"
                  onClick={
                    plannerEventDraft.recurrenceParentId
                      ? cancelPlannerRecurringOccurrence
                      : removePlannerEvent
                  }
                  disabled={plannerEventSaving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {plannerEventDraft.recurrenceParentId ? "Cancel occurrence" : "Delete"}
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePlannerEventModal}
                  disabled={plannerEventSaving}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPlannerEvent}
                  disabled={plannerEventSaving}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {plannerEventSaving ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* New Task modal */}
      <Modal
        open={newOpen}
        title="New task"
        onClose={() => setNewOpen(false)}
      >
        <div className="grid gap-3">
          <Field label="Title">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title (brief)"
              className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNewTask();
                }
              }}
            />
          </Field>

          <SectionHeading>Organisation</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Status">
              <IconSelectBox<Status>
                value={newStatus}
                onChange={setNewStatus}
                options={STATUSES}
                renderIcon={(status) => <StatusIcon status={status} />}
              />
            </Field>

            <Field label="Category">
              <select
                value={newCourseId}
                onChange={(e) => setNewCourseId(e.target.value)}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryDisplayLabel(c)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <SectionHeading>Planning</SectionHeading>
          <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.8fr]">
            <Field label="Priority">
              <IconSelectBox<Priority>
                value={newPriority}
                onChange={setNewPriority}
                options={PRIORITIES}
                renderIcon={(priority) => <PriorityIcon priority={priority} />}
              />
            </Field>

            <Field label="Difficulty (1–5)">
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value)}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              >
                {["1", "2", "3", "4", "5"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <EffortLevelField value={newEffortLevel} onChange={setNewEffortLevel} />
          </div>

          <DeadlineField
            due={newDue}
            deadlineMode={newDeadlineMode}
            visionHorizon={newVisionHorizon}
            onDateChange={(due) => {
              setNewDue(due);
              setNewDeadlineMode(due ? "date" : undefined);
              setNewVisionHorizon(null);
            }}
            onVisionChange={(horizon) => {
              setNewDue("");
              setNewDeadlineMode("vision");
              setNewVisionHorizon(horizon);
            }}
          />

          <SectionHeading>Type</SectionHeading>
          <ActivityTypeField value={newActivityType} onChange={setNewActivityType} />

          <SectionHeading>Notes</SectionHeading>
          <Field label="Notes">
            <textarea
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Any extra context"
              className="min-h-[64px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <SectionHeading>Actions</SectionHeading>
          <div className="flex items-center justify-end gap-2">
            <button
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setNewOpen(false)}
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={submitNewTask}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* Category modal */}
      <Modal
        open={categoryModalOpen}
        title={editingCategory ? "Edit category" : "Add category"}
        onClose={() => {
          if (categorySaving) return;
          setCategoryModalOpen(false);
          resetCategoryDraft();
        }}
      >
        <div className="grid gap-3">
          <Field label="Category name">
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Bloomberg Lab"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <Field label="Icon">
            <div className="flex items-center gap-3">
              <CategoryIdentity
                category={{
                  id: editingCategory?.id ?? "category-preview",
                  label: categoryName || "Category",
                  emoji: categoryEmoji,
                  colour: categoryColour,
                  sortOrder: editingCategory?.sortOrder ?? 0,
                  archived: editingCategory?.archived ?? false,
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_ICON_OPTIONS.map((option) => {
                  const selected = categoryHeaderEmoji({ label: categoryName, emoji: categoryEmoji }) === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={selected}
                      onClick={() => setCategoryEmoji(option.value)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                        selected
                          ? "border-slate-400 bg-slate-100 text-slate-900"
                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      <option.Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          </Field>

          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOURS.map((option) => {
                const selected = categoryColour === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setCategoryColour(option.id)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected
                        ? "border-slate-300 bg-slate-100 text-slate-800"
                        : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-3 w-3 rounded-full ${option.swatch}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            {editingCategory ? (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={categorySaving}
                onClick={() => archiveCategory(editingCategory)}
              >
                Archive
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={categorySaving}
                onClick={() => {
                  setCategoryModalOpen(false);
                  resetCategoryDraft();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={!categoryName.trim() || categorySaving}
                onClick={submitCategory}
              >
                {editingCategory ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Log Time modal */}
      <Modal
        open={logOpen}
        title={logModalTitle}
        onClose={() => {
          setEditingLogId(null);
          setPlannerLogSourceEventId(null);
          setLogOpen(false);
        }}
      >
        <div className="grid gap-3">
          <Field label="Task / project">
            <select
              value={logTaskId}
              onChange={(e) => setLogTaskId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            >
              {!logTaskOptions.length ? <option value="">No tasks available</option> : null}
              {logTaskOptions.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input
                type="date"
                value={logDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setLogDate(nextDate);
                  if (!logEndDate || logEndDate < nextDate) {
                    setLogEndDate(nextDate);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <Field label="Start time">
              <input
                type="time"
                value={logStartTime}
                onChange={(e) => setLogStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTimeLog();
                  }
                }}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="End time">
              <input
                type="time"
                value={logEndTime}
                onChange={(e) => setLogEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitTimeLog();
                  }
                }}
              />
            </Field>

            <Field label="End date">
              <input
                type="date"
                value={logEndDate}
                min={logDate || undefined}
                onChange={(e) => setLogEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>
          </div>

          <Field label="Duration">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={displayedLogHoursInput}
                  readOnly={isCalculatedLogDuration}
                  onChange={(e) => {
                    if (!isCalculatedLogDuration) {
                      setLogHoursInput(e.target.value);
                    }
                  }}
                  placeholder="0.5"
                  className={`w-full rounded-xl border border-slate-200 px-3 py-2 pr-14 text-sm tabular-nums outline-none focus:ring-2 focus:ring-slate-200 ${
                    isCalculatedLogDuration
                      ? "bg-slate-50 text-slate-600"
                      : "bg-white text-slate-900"
                  }`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitTimeLog();
                    }
                  }}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
                  hours
                </span>
              </div>
              {isCalculatedLogDuration ? (
                <p className="mt-1 text-[11px] text-slate-400">Calculated from start and end time</p>
              ) : null}
          </Field>

          <Field label="Note">
            <textarea
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="What moved forward?"
              className="min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
            />
          </Field>

          <div className="flex items-center justify-between gap-2 pt-1">
            {editingLogId ? (
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => deleteTimeLog(editingLogId)}
                disabled={deletingTimeLogId === editingLogId}
              >
                {deletingTimeLogId === editingLogId ? "Deleting" : "Delete"}
              </button>
            ) : (
              <div />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {!plannerLogSourceEventId && (!editingTimeLog || isOpenTimeLog(editingTimeLog)) ? (
                <button
                  className="rounded-full border border-cyan-100 bg-cyan-50/60 px-4 py-2 text-sm font-medium text-cyan-700 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={startOpenTimeLog}
                  disabled={
                    logSaving ||
                    !logTaskId ||
                    !isTimeLogISODate(logDate || clientToday || todayISO()) ||
                    timeLogTimeToMinutes(logStartTime) === null ||
                    Boolean(logEndTime)
                  }
                >
                  {editingLogId ? "Save open session" : "Start open session"}
                </button>
              ) : null}
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setEditingLogId(null);
                  setPlannerLogSourceEventId(null);
                  setLogOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                onClick={submitTimeLog}
                disabled={
                  logSaving ||
                  !logTaskId ||
                  (editingTimeLog && isOpenTimeLog(editingTimeLog)
                    ? calculatedLogHours === null
                    : resolveClosedTimeLogHours(logHoursInput, calculatedLogHours, logStartTime, logEndTime) === null)
                }
              >
                {editingTimeLog && isOpenTimeLog(editingTimeLog) ? "Close session" : editingLogId ? "Save" : "Log time"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        title="Edit task"
        onClose={closeTaskEdit}
      >
        {!draft ? null : (
          <div className="grid gap-3">
            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <SectionHeading>Organisation</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <IconSelectBox<Status>
                  value={draft.status}
                  onChange={(status) => setDraft(applyTaskStatus(draft, status))}
                  options={STATUSES}
                  renderIcon={(status) => <StatusIcon status={status} />}
                />
              </Field>

              <Field label="Category">
                <select
                  value={draft.courseId}
                  onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryDisplayLabel(c)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <SectionHeading>Planning</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_1.8fr]">
              <Field label="Priority">
                <IconSelectBox<Priority>
                  value={draft.priority}
                  onChange={(priority) => setDraft({ ...draft, priority })}
                  options={PRIORITIES}
                  renderIcon={(priority) => <PriorityIcon priority={priority} />}
                />
              </Field>

              <Field label="Difficulty (1–5)">
                <select
                  value={draft.difficulty == null ? "3" : String(draft.difficulty)}
                  onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })}
                  className="h-10 w-full rounded-[16px] border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
                >
                  {["1", "2", "3", "4", "5"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                ))}
              </select>
              </Field>

              <EffortLevelField
                value={draft.effortLevel ?? null}
                suggestedValue={draft.effortLevel ? null : inferredEffortLevel(draft.durationHrs)}
                onChange={(effortLevel) => setDraft({ ...draft, effortLevel })}
              />
            </div>

            <DeadlineField
              due={draft.due}
              deadlineMode={draft.deadlineMode ?? (draft.due ? "date" : undefined)}
              visionHorizon={draft.visionHorizon ?? null}
              onDateChange={(due) =>
                setDraft({
                  ...draft,
                  due: due || undefined,
                  deadlineMode: due ? "date" : undefined,
                  visionHorizon: null,
                })
              }
              onVisionChange={(horizon) =>
                setDraft({
                  ...draft,
                  due: null,
                  deadlineMode: "vision",
                  visionHorizon: horizon,
                })
              }
            />

            <SectionHeading>Type</SectionHeading>
            <ActivityTypeField
              value={draft.activityType}
              onChange={(activityType) => setDraft({ ...draft, activityType })}
            />

            <SectionHeading>Notes</SectionHeading>
            <Field label="Notes">
              <textarea
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="min-h-[64px] w-full rounded-[18px] border border-slate-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              />
            </Field>

            <SectionHeading>Actions</SectionHeading>
            <div className="flex items-center justify-between">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (editingPlannerTaskDeadline) removeTaskDeadline(draft.id);
                  else {
                    deleteTask(draft.id);
                    closeTaskEdit();
                  }
                }}
              >
                {editingPlannerTaskDeadline ? "Remove deadline" : "Delete"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={closeTaskEdit}
                >
                  Cancel
                </button>

                <button
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!draft.title.trim()) return;
                    saveEdit({ ...draft, title: draft.title.trim() });
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

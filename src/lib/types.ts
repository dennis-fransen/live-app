export type ItemKind = "task" | "event";
export type ItemScope = "personal" | "group";
export type RecurrenceType = "none" | "on_completion" | "fixed";
export type IntervalUnit = "day" | "week" | "month";
export type OccurrenceStatus = "open" | "done" | "skipped";

export interface Household {
  id: string;
  name: string;
  timezone: string;
}

export interface Member {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  is_child: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  sort_order: number;
}

export interface TaskDefinition {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  category_id: string | null;
  kind: ItemKind;
  completable: boolean;
  scope: ItemScope;
  owner_member_id: string | null;
  default_assignee_id: string | null;
  recurrence_type: RecurrenceType;
  start_date: string | null;
  interval_count: number | null;
  interval_unit: IntervalUnit | null;
  fixed_rule: FixedRule | null;
  is_active: boolean;
}

export interface FixedRule {
  weekdays?: number[]; // 0=Sun .. 6=Sat
  dates?: string[]; // YYYY-MM-DD
}

export interface TaskOccurrence {
  id: string;
  household_id: string;
  definition_id: string;
  due_date: string; // YYYY-MM-DD
  status: OccurrenceStatus;
  assignee_id: string | null;
  notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

// An occurrence joined with the fields we need from its definition for display.
export interface OccurrenceWithDefinition extends TaskOccurrence {
  definition: Pick<
    TaskDefinition,
    | "title"
    | "notes"
    | "kind"
    | "completable"
    | "scope"
    | "owner_member_id"
    | "category_id"
    | "recurrence_type"
    | "interval_count"
    | "interval_unit"
  >;
}

export interface HouseholdContext {
  household: Household;
  members: Member[];
  categories: Category[];
}

export interface Project {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  room: string | null;
  base_cost: number;
  sort_order: number;
  is_done: boolean;
  created_at: string;
}

export interface ProjectPart {
  id: string;
  household_id: string;
  project_id: string;
  title: string;
  store: string | null;
  url: string | null;
  unit_price: number;
  quantity: number;
  is_bought: boolean;
  sort_order: number;
}

// A project with its parts, as loaded for the board.
export interface ProjectWithParts extends Project {
  parts: ProjectPart[];
}

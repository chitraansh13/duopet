import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { GoalDefinition, GoalStatus } from "@/lib/goal-data";
import type { GoalState } from "@/lib/goal-state";
import { canonicalValue, goalStateFromRows, type CheckInRow } from "./goal-adapters";
import type { UserId } from "@/lib/goal-data";

type Client = SupabaseClient<Database>;

export class GoalRepositoryError extends Error {
  constructor(public readonly userMessage: string) { super(userMessage); }
}

function fail(message: string): never { throw new GoalRepositoryError(message); }
function targets(goal: GoalDefinition): Json {
  return goal.targets.map((target) => ({
    user_id: target.userId,
    target: goal.trackingType === "measured" ? canonicalValue(target.target ?? 0, goal.measurementKind, goal.unit) : null,
  }));
}
function args(goal: GoalDefinition) {
  return {
    p_name: goal.name,
    p_icon_key: goal.icon,
    p_scope: goal.scope,
    p_tracking_type: goal.trackingType,
    p_measurement_kind: goal.measurementKind ?? "",
    p_display_unit: goal.unit ?? "",
    p_notes: goal.notes ?? "",
    p_targets: targets(goal),
  };
}

export async function ensureDefaultGoals(client: Client) {
  const { error } = await client.rpc("seed_default_goals");
  if (error) fail("Your starter goals couldn’t be prepared. Please try again.");
}

export async function loadGoalState(client: Client, duoId: string, date: string): Promise<GoalState> {
  const goalsResult = await client.from("goals").select("*").eq("duo_id", duoId).neq("status", "archived").order("created_at");
  if (goalsResult.error) fail("Your goals couldn’t be loaded. Please refresh and try again.");
  const goalIds = goalsResult.data.map((goal) => goal.id);
  if (!goalIds.length) return { definitions: [], checkIns: [], date };
  const [assignmentsResult, checkInsResult] = await Promise.all([
    client.from("goal_assignments").select("*").in("goal_id", goalIds),
    client.from("goal_checkins").select("*").in("goal_id", goalIds).eq("local_date", date),
  ]);
  if (assignmentsResult.error || checkInsResult.error) fail("Today’s goal progress couldn’t be loaded. Please refresh and try again.");
  return goalStateFromRows(goalsResult.data, assignmentsResult.data, checkInsResult.data, date);
}

export async function createGoal(client: Client, goal: GoalDefinition) {
  const { data, error } = await client.rpc("create_goal", args(goal));
  if (error || !data) fail("This goal couldn’t be saved. Please check the targets and try again.");
  return data;
}

function sameDefinition(a: GoalDefinition, b: GoalDefinition) {
  return a.scope === b.scope && a.trackingType === b.trackingType
    && a.measurementKind === b.measurementKind && a.unit === b.unit;
}

export async function updateGoal(client: Client, original: GoalDefinition, next: GoalDefinition) {
  if (!sameDefinition(original, next)) fail("A goal’s scope and tracking type can’t be changed after it starts. Create a new goal instead.");
  const { error } = await client.rpc("update_goal", {
    p_goal_id: original.id,
    p_name: next.name,
    p_icon_key: next.icon,
    p_notes: next.notes ?? "",
    p_targets: targets(next),
  });
  if (error) fail("This goal couldn’t be updated. Please try again.");
  return original.id;
}

export async function updateOwnTarget(client:Client,goal:GoalDefinition,userId:UserId,target:number,effectiveFrom:string){
  const canonical=canonicalValue(target,goal.measurementKind,goal.unit);
  const {data,error}=await client.rpc("set_my_goal_target",{p_goal_id:goal.id,p_target:canonical,p_effective_from:effectiveFrom});
  if(error||!data)fail("Your target couldn’t be updated. Please try again.");
  return data;
}

export async function setGoalStatus(client: Client, goalId: string, status: GoalStatus | "archived") {
  const { error } = await client.from("goals").update({ status }).eq("id", goalId);
  if (error) fail(status === "archived" ? "This goal couldn’t be removed from your active list." : `This goal couldn’t be ${status === "paused" ? "paused" : "resumed"}.`);
}

export async function saveCheckIn(client: Client, goal: GoalDefinition, date: string, value: number): Promise<CheckInRow> {
  const canonical = canonicalValue(Math.max(0, goal.trackingType === "boolean" ? Number(value >= 1) : value), goal.measurementKind, goal.unit);
  const { data, error } = await client.rpc("set_goal_checkin", { p_goal_id: goal.id, p_local_date: date, p_value: canonical });
  if (error || !data) fail("Your progress couldn’t be updated. Please try again.");
  return data;
}

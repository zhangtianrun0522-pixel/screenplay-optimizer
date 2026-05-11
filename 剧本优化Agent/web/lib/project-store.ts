import { createClient } from "@supabase/supabase-js";
import type { Project, ProjectSummary } from "./types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, data, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listProjects error:", error);
    return [];
  }

  return (data ?? []).map((row: { id: string; name: string; data: Project }) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.data.updatedAt ?? "",
    currentStage: row.data.currentStage ?? 0,
    onboardingStatus: row.data.onboardingStatus ?? "pending_setup",
    originMode: row.data.originMode ?? "original",
  }));
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("data")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return (data as { data: Project }).data;
}

export async function saveProject(project: Project): Promise<void> {
  project.updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("projects")
    .upsert(
      { id: project.id, name: project.name, data: project, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) {
    console.error("saveProject error:", error);
    throw error;
  }
}

export async function deleteProject(id: string): Promise<boolean> {
  const { error, count } = await supabase
    .from("projects")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return false;
  return count !== null && count > 0;
}

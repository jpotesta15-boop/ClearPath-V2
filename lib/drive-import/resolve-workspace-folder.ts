import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedImportFolder = {
  workspaceId: string
  coachId: string
}

/**
 * Match Google Drive folder ID to workspace + primary coach (same logic as resolve-folder API).
 */
export async function resolveWorkspaceForDriveFolder(
  supabase: SupabaseClient,
  folderId: string
): Promise<ResolvedImportFolder | null> {
  const trimmed = folderId.trim()
  if (!trimmed) return null

  let workspaceId: string | null = null
  const { data: exact } = await supabase
    .from('workspaces')
    .select('id')
    .eq('google_drive_import_folder_id', trimmed)
    .maybeSingle()

  if (exact?.id) {
    workspaceId = exact.id
  } else {
    const { data: rows } = await supabase
      .from('workspaces')
      .select('id, google_drive_import_folder_id')
      .not('google_drive_import_folder_id', 'is', null)

    const hit = rows?.find((w) => (w.google_drive_import_folder_id ?? '').trim() === trimmed)
    if (hit) workspaceId = hit.id
  }

  if (!workspaceId) return null

  const { data: coach } = await supabase
    .from('coaches')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .maybeSingle()

  if (!coach?.user_id) return null

  return { workspaceId, coachId: coach.user_id }
}

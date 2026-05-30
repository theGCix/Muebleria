// Client-side auth helper — replaces the server middleware
import { supabase } from "./client";

export async function getAuthenticatedClient() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Unauthorized: No active session");
  return { supabase, userId: session.user.id, session };
}
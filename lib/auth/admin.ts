import { createClient } from "@supabase/supabase-js";
import { isSupabaseServiceConfigured } from "@/lib/auth/config";

export function createSupabaseAdminClient() {
  if (!isSupabaseServiceConfigured()) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false
      }
    }
  );
}

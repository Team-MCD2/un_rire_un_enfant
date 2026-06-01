import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const adminEmail = "admin31@rirepour1enfant.app";
    const adminPassword = "Rodrigo31sang";

    // Check if already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const exists = existingUsers?.users?.find((u) => u.email === adminEmail);

    if (exists) {
      await adminClient.from("user_roles").upsert(
        { user_id: exists.id, role: "admin" },
        { onConflict: "user_id,role" }
      );
      return new Response(JSON.stringify({ message: "Compte ADMIN31 existe déjà", email: adminEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "ADMIN31" },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: "admin" });

    return new Response(JSON.stringify({ message: "Compte ADMIN31 créé avec succès", email: adminEmail }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seed-admin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

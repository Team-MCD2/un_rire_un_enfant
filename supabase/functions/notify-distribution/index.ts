import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description, event_date, event_time, location } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all beneficiaries (beneficiaire or both)
    const { data: beneficiaries, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("member_type", ["beneficiaire", "both"]);

    if (fetchError) throw fetchError;

    if (!beneficiaries || beneficiaries.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifBody = `${title} — ${new Date(event_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} à ${event_time} — ${location}`;

    // Insert notifications for all beneficiaries
    const notifications = beneficiaries.map((b) => ({
      user_id: b.id,
      type: "distribution",
      title: "🍽️ Nouvelle distribution",
      body: notifBody,
      link: "/distribution",
    }));

    await supabaseAdmin.from("notifications").insert(notifications);

    // Send push to each beneficiary
    const pushPromises = beneficiaries.map((b) =>
      supabaseAdmin.functions.invoke("send-push", {
        body: {
          userId: b.id,
          title: "🍽️ Nouvelle distribution",
          body: description ? `${title}: ${description}` : notifBody,
          link: "/distribution",
          tag: "distribution",
        },
      }).catch(() => {})
    );

    await Promise.allSettled(pushPromises);

    return new Response(JSON.stringify({ notified: beneficiaries.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

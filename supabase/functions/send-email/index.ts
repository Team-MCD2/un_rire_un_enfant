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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { type, title, description, event_date, event_time, location } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine recipients based on type
    let memberTypes: string[];
    let emailSubject: string;
    let emailBody: string;

    if (type === "distribution") {
      memberTypes = ["beneficiaire", "both"];
      emailSubject = `🍽️ Nouvelle distribution : ${title}`;
      const dateStr = new Date(event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 30px; color: white; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">🍽️ Nouvelle Distribution</h1>
          </div>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">${title}</h2>
            ${description ? `<p style="color: #555;">${description}</p>` : ""}
            <div style="margin-top: 16px;">
              <p style="color: #333; margin: 8px 0;">📅 <strong>${dateStr}</strong> à <strong>${event_time}</strong></p>
              <p style="color: #333; margin: 8px 0;">📍 <strong>${location}</strong></p>
            </div>
          </div>
          <p style="color: #888; text-align: center; font-size: 13px;">
            Connectez-vous à l'application pour vous inscrire.<br/>
            — L'équipe Rire Pour 1 Enfant
          </p>
        </div>
      `;
    } else if (type === "activity") {
      memberTypes = ["benevole", "both"];
      emailSubject = `🎯 Nouvelle activité : ${title}`;
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 16px; padding: 30px; color: white; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">🎯 Nouvelle Activité</h1>
          </div>
          <div style="background: #f8f9fa; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">${title}</h2>
            ${description ? `<p style="color: #555;">${description}</p>` : ""}
            ${event_date ? `<p style="color: #333; margin: 8px 0;">📅 <strong>${new Date(event_date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</strong></p>` : ""}
            ${location ? `<p style="color: #333; margin: 8px 0;">📍 <strong>${location}</strong></p>` : ""}
          </div>
          <p style="color: #888; text-align: center; font-size: 13px;">
            Connectez-vous à l'application pour plus de détails.<br/>
            — L'équipe Rire Pour 1 Enfant
          </p>
        </div>
      `;
    } else {
      throw new Error("Invalid notification type");
    }

    // Get recipient profiles with their auth emails
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("member_type", memberTypes);

    if (profileError) throw profileError;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get emails from auth.users
    const userIds = profiles.map((p) => p.id);
    const emails: string[] = [];

    // Fetch user emails in batches
    for (let i = 0; i < userIds.length; i += 50) {
      const batch = userIds.slice(i, i + 50);
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (users) {
        users.forEach((u) => {
          if (batch.includes(u.id) && u.email) {
            emails.push(u.email);
          }
        });
      }
      break; // listUsers returns all, no need to loop
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email via Resend (batch, max 50 per call)
    let sent = 0;
    for (let i = 0; i < emails.length; i += 50) {
      const batch = emails.slice(i, i + 50);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Rire Pour 1 Enfant <hterbah31100@gmail.com>",
          to: batch,
          subject: emailSubject,
          html: emailBody,
        }),
      });

      if (res.ok) {
        sent += batch.length;
      } else {
        const errData = await res.text();
        console.error("Resend error:", errData);
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

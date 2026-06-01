import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `Tu es Nino 🤖, l'assistant virtuel de l'association "Rire pour 1 enfant". Tu réponds en français de manière chaleureuse, bienveillante et concise (2-4 phrases max).

Voici les informations clés sur l'association :
- Mission : Œuvrer pour le bien-être des enfants défavorisés via des activités ludiques, éducatives et culturelles.
- Activités : Sorties récréatives, ateliers créatifs, distribution de fournitures, soutien scolaire.
- Soutien : Dons via PayPal, bénévolat, participation aux événements.
- Contact : 07 68 36 04 72

Si la question est hors sujet, redirige poliment vers les sujets de l'association. Utilise des emojis avec modération.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, botInstructions, roomContext, roomId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = BASE_SYSTEM_PROMPT;

    if (botInstructions) {
      systemPrompt += `\n\nINFORMATIONS IMPORTANTES FOURNIES PAR L'ADMINISTRATEUR :\n${botInstructions}`;
    }

    if (roomContext === "benevoles") {
      systemPrompt += `\n\nTu es dans le salon "Bénévoles Étudiants". Aide les bénévoles avec l'organisation, les horaires et le fonctionnement de l'association.`;
    }

    const isRoomBot = !!roomId;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: !isRoomBot,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de demandes, réessayez dans un instant." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Room bot: non-streaming, save to DB
    if (isRoomBot) {
      const result = await response.json();
      const botContent = result.choices?.[0]?.message?.content || "";

      if (botContent) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        await adminClient.from("chat_messages").insert({
          room_id: roomId,
          user_id: "00000000-0000-0000-0000-000000000000",
          user_name: "Nino 🤖",
          content: botContent,
          is_bot: true,
        });
      }

      return new Response(JSON.stringify({ content: botContent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Floating chatbot: streaming
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

const SUPABASE_URL = "https://ocqgahvzygllczwlyrjn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcWdhaHZ6eWdsbGN6d2x5cmpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzA5NzgsImV4cCI6MjA5NTg0Njk3OH0.oAUxi-MI1CmvgOINLk8iWFsNaYsqXv029bMbo9X3n-o";

async function testEmail() {
  console.log("🚀 Lancement du test de la fonction d'envoi d'e-mails...");
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`
      },
      body: JSON.stringify({
        type: "distribution",
        title: "Test de validation technique",
        description: "Ceci est un e-mail de test automatisé généré pour valider l'intégration Resend.",
        event_date: "2026-06-10",
        event_time: "14:00",
        location: "Siège de l'association, Marseille"
      })
    });

    const text = await response.text();
    
    console.log("Statut de la réponse :", response.status);
    console.log("Corps de la réponse :", text);
    
    if (response.ok) {
      console.log("✅ TEST RÉUSSI : La fonction Supabase a été appelée correctement.");
    } else {
      console.error("❌ ÉCHEC DU TEST : Erreur renvoyée par la fonction.");
    }
  } catch (err) {
    console.error("❌ ERREUR RÉSEAU :", err);
  }
}

testEmail();

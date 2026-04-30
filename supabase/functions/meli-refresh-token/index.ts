import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações do SDK Supabase com service_role para contornar RLS
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configurações do Mercado Livre via .env
const MELI_CLIENT_ID = Deno.env.get("MELI_CLIENT_ID");
const MELI_CLIENT_SECRET = Deno.env.get("MELI_CLIENT_SECRET");

// Função Utilitária para Atraso (Backoff)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function refreshTokenTask() {
  if (!MELI_CLIENT_ID || !MELI_CLIENT_SECRET) {
    throw new Error("Missing MELI_CLIENT_ID or MELI_CLIENT_SECRET");
  }

  // 1. Puxar as credenciais atuais sem lock transacional longo
  const { data: authRecord, error: fetchError } = await supabase
    .from("meli_auth")
    .select("refresh_token")
    .eq("id", 1)
    .single();

  if (fetchError || !authRecord) {
    throw new Error(`Failed to fetch auth record: ${fetchError?.message}`);
  }

  const { refresh_token } = authRecord;
  if (!refresh_token || refresh_token === "pending_bootstrap") {
    console.warn("Nenhum refresh_token válido encontrado. É necessário gerar um Bootstrap manual e atualizar a tabela.");
    return { status: 'waiting_bootstrap' };
  }

  // 2. Tentar atualizar com a API do ML (Retry Policy com Exponential Backoff Limitado)
  const MAX_RETRIES = 3;
  let attempt = 0;
  let newTokens = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const response = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: MELI_CLIENT_ID,
          client_secret: MELI_CLIENT_SECRET,
          refresh_token: refresh_token,
        }),
      });

      // Avaliação da Resposta (Graceful Failure)
      if (response.status === 400 || response.status === 401) {
        // Erros fatais (credencial revogada pelo usuário ou desautorizada permanentemente)
        console.error("TOKEN REVOKED OR INVALID:", await response.text());
        // Fazer Graceful degradation: invalidar na base local
        await supabase
          .from("meli_auth")
          .update({ access_token: "REVOKED", refresh_token: "REVOKED_MANUAL_BOOTSTRAP_REQUIRED" })
          .eq("id", 1);
        return { status: 'revoked' };
      }

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} - ${await response.text()}`);
      }

      // Sucesso!
      newTokens = await response.json();
      break;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      if (attempt === MAX_RETRIES) {
        throw new Error("Max retries exceeded while trying to refresh token.");
      }
      // Backoff (2s, 4s...)
      await delay(attempt * 2000);
    }
  }

  // 3. Atualizar as Novas Credenciais no PostgreSQL
  if (newTokens && newTokens.access_token) {
    const { error: updateError } = await supabase
      .from("meli_auth")
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token, // É vital sempre saltar para a corrente do novo refresh_token
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", 1);

    if (updateError) {
      throw new Error(`Failed to update tokens in database: ${updateError.message}`);
    }

    console.log("Tokens renovados com sucesso!");
    return { status: 'success' };
  }
}

// Handler da Edge Function
Deno.serve(async (req) => {
  // Autenticação básica ou chave para disparar via Cron seria excelente em produção
  try {
    const result = await refreshTokenTask();
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Worker Task Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configurações do SDK Supabase com service_role para contornar RLS
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Tratamento de preflight CORS (Browser Options request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Extrair os parâmetros de requisição do frontend (ex: GET parameters ou POST body)
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get("endpoint"); // ex: /sites/MLB/listing_prices
    
    // Suportar req.json() se houver body POST
    let searchBody = null;
    if (req.method === "POST") {
      try {
        searchBody = await req.json();
      } catch (e) {
        /* no body */
      }
    }

    if (!endpoint) {
      return new Response(JSON.stringify({ error: "Parâmetro 'endpoint' ausente na URL." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2. Leitura ultra-rápida do token (Forçando anulação de Warm Starts cache)
    const { data: authRecord, error: fetchError } = await supabase
      .from("meli_auth")
      .select("access_token")
      .eq("id", 1)
      .single();

    if (fetchError || !authRecord) {
      throw new Error("Erro acessando a base de dados de autenticação.");
    }

    const { access_token } = authRecord;

    if (access_token === "REVOKED") {
      return new Response(JSON.stringify({ error: "Login Autorizativo Expirou. Contate o administrador." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    if (access_token === "pending_bootstrap") {
      return new Response(JSON.stringify({ error: "Aplicativo em inicialização. Execute bootstrap primeiro." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503,
      });
    }

    // 3. Montar a requisição e pregar na API Oficial do Mercado Livre
    // Remover a extra barra no final se o front enviou
    const baseUrl = `https://api.mercadolibre.com${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    
    // Repassa os params search url se houver
    const targetUrl = new URL(baseUrl);
    for (const [k, v] of searchParams.entries()) {
      if (k !== 'endpoint') {
        targetUrl.searchParams.append(k, v);
      }
    }

    const meliConfig: RequestInit = {
      method: req.method, // GET ou POST repassado
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD" && searchBody) {
      meliConfig.body = JSON.stringify(searchBody);
    }

    const meliResponse = await fetch(targetUrl.toString(), meliConfig);
    const resultText = await meliResponse.text();

    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch {
      resultJson = { raw: resultText }; // Fallback para não quebrar JSON parse
    }

    // 4. Retornar resposta
    return new Response(JSON.stringify(resultJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: meliResponse.status,
    });

  } catch (err) {
    console.error("Fetch Proxy Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

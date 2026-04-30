import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const MELI_API_URL = "https://api.mercadolibre.com"

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. GET /token - Retorna o Access Token atual válido
    if (path.endsWith('/token') && method === 'GET') {
      const { data: auth, error } = await supabase
        .from('meli_auth')
        .select('*')
        .eq('id', 1)
        .single()

      if (error || !auth) {
        return new Response(JSON.stringify({ error: 'Auth not found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        })
      }

      return new Response(JSON.stringify({ access_token: auth.access_token, expires_at: auth.expires_at }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. POST /exchange - Troca Code por Token (Bootstrap)
    if (path.endsWith('/exchange') && method === 'POST') {
      const { code } = await req.json()
      
      const client_id = Deno.env.get('MERCADOLIBRE_CLIENT_ID')
      const client_secret = Deno.env.get('MERCADOLIBRE_CLIENT_SECRET')
      const redirect_uri = Deno.env.get('MERCADOLIBRE_REDIRECT_URI')

      const response = await fetch(`${MELI_API_URL}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: client_id ?? '',
          client_secret: client_secret ?? '',
          code: code,
          redirect_uri: redirect_uri ?? ''
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return new Response(JSON.stringify({ error: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status
        })
      }

      // Salva no banco
      const { error: dbError } = await supabase
        .from('meli_auth')
        .upsert({
          id: 1,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })

      if (dbError) throw dbError

      return new Response(JSON.stringify({ status: 'success', access_token: data.access_token }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

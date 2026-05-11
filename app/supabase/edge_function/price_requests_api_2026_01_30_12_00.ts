import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, apikey, Content-Type, X-Application-Name',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const method = req.method;
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Extract action and parameters from URL path
    const action = pathSegments[0];
    const id = pathSegments[1];
    const projectId = url.searchParams.get('project_id');

    console.log('Price requests API called:', { method, action, id, projectId, path: url.pathname });

    // GET /list?project_id=xxx - List price requests with quote counts
    if (method === 'GET' && action === 'list' && projectId) {
      console.log('Fetching price requests for project:', projectId);
      
      const { data: requests, error } = await supabaseClient
        .from('project_price_requests_2026_01_25_19_16')
        .select(`
          *,
          quote_count:project_price_quotes_2026_01_25_19_16(count)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching price requests:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform the data to include quote count as a number
      const transformedRequests = requests?.map(request => ({
        ...request,
        quote_count: request.quote_count?.[0]?.count || 0
      })) || [];

      console.log('Returning requests:', transformedRequests.length);
      return new Response(
        JSON.stringify({ data: transformedRequests }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /detail/{id} - Get single request with all quotes and material
    if (method === 'GET' && action === 'detail' && id) {
      console.log('Fetching request detail for ID:', id);
      
      const { data: request, error: requestError } = await supabaseClient
        .from('project_price_requests_2026_01_25_19_16')
        .select(`
          *,
          quotes:project_price_quotes_2026_01_25_19_16(*),
          project_material:project_materials_2026_01_22_00_00(*)
        `)
        .eq('id', id)
        .single();

      if (requestError) {
        console.error('Error fetching price request detail:', requestError);
        return new Response(
          JSON.stringify({ error: requestError.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: request }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /request - Create new price request
    if (method === 'POST' && action === 'request') {
      const body = await req.json();
      console.log('Creating price request:', body);
      
      const { data: request, error } = await supabaseClient
        .from('project_price_requests_2026_01_25_19_16')
        .insert([body])
        .select()
        .single();

      if (error) {
        console.error('Error creating price request:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: request }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /request/{id} - Update price request
    if (method === 'PUT' && action === 'request' && id) {
      const body = await req.json();
      console.log('Updating price request:', id, body);
      
      const { data: request, error } = await supabaseClient
        .from('project_price_requests_2026_01_25_19_16')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating price request:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: request }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /request/{id} - Delete price request (cascades to quotes)
    if (method === 'DELETE' && action === 'request' && id) {
      console.log('Deleting price request:', id);
      
      const { error } = await supabaseClient
        .from('project_price_requests_2026_01_25_19_16')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting price request:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /quote - Create new price quote
    if (method === 'POST' && action === 'quote') {
      const body = await req.json();
      console.log('Creating price quote:', body);
      
      const { data: quote, error } = await supabaseClient
        .from('project_price_quotes_2026_01_25_19_16')
        .insert([body])
        .select()
        .single();

      if (error) {
        console.error('Error creating price quote:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: quote }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT /quote/{id} - Update price quote
    if (method === 'PUT' && action === 'quote' && id) {
      const body = await req.json();
      console.log('Updating price quote:', id, body);
      
      const { data: quote, error } = await supabaseClient
        .from('project_price_quotes_2026_01_25_19_16')
        .update(body)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating price quote:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ data: quote }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE /quote/{id} - Delete price quote
    if (method === 'DELETE' && action === 'quote' && id) {
      console.log('Deleting price quote:', id);
      
      const { error } = await supabaseClient
        .from('project_price_quotes_2026_01_25_19_16')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting price quote:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Invalid endpoint
    console.log('Invalid endpoint called:', { method, action, id, path: url.pathname });
    return new Response(
      JSON.stringify({ error: 'Invalid endpoint or method', path: url.pathname, method, action, id }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
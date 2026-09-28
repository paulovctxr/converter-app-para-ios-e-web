import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

// Scheduled server-to-server task. The secret MUST NOT be exposed in the app.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('COMMUNITY_CLEANUP_SECRET');
  if (!secret || secret.length < 32) return new Response('Cleanup not configured', { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
  const now = new Date().toISOString();
  // Keep reservations for 24h, including failed/hidden uploads, so deleting a story
  // cannot reset the five-per-day quota. Files remain inaccessible once hidden.
  const cutoff = new Date(Date.now()-24*60*60*1000).toISOString();
  let removed = 0;
  // Bounded, retry-safe batches; delete DB rows only after Storage confirms removal.
  for(let batch=0; batch<5; batch++) {
    const { data, error } = await db.from('summer_community_stories').select('id,image_path')
      .lte('created_at',cutoff).or(`expires_at.lte.${now},status.eq.hidden,status.eq.draft`)
      .order('created_at').limit(100);
    if(error) return Response.json({error:'Could not load cleanup queue'}, {status:500});
    if(!data?.length) break;
    const photos = await db.storage.from('summer-stories').remove(data.map(row=>row.image_path));
    if(photos.error) return Response.json({error:'Storage cleanup failed; retry required'}, {status:500});
    const rows = await db.from('summer_community_stories').delete().in('id',data.map(row=>row.id));
    if(rows.error) return Response.json({error:'Metadata cleanup failed; retry required'}, {status:500});
    removed += data.length;
  }
  return Response.json({removed});
});

begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('techstore-push-worker','* * * * *',$job$
 select net.http_post(
 url:='https://jtjnbeywpfdtgohffanl.supabase.co/functions/v1/techstore-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-techstore-worker',techstore_private.push_secret('techstore_push_worker_token',null)),
 body:='{}'::jsonb,timeout_milliseconds:=90000
 );
 delete from public.ts_push_outbox where created_at<now()-interval '7 days';
 delete from public.ts_push_subscriptions s where not exists(select 1 from auth.sessions a where a.id=s.session_id and a.user_id=s.user_id and (a.not_after is null or a.not_after>now()));
$job$);
commit;
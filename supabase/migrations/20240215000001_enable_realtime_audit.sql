
-- Enable Realtime for audit_logs
begin;
  -- Check if publication exists (default in Supabase is 'supabase_realtime')
  -- We attempt to add the table. If it's already there, this might error or be a no-op depending on PG version,
  -- but typically 'alter publication ... add table' is the way.
  -- To be safe, we can wrap it or just run it.
  -- However, since I can't interactively handle errors, I'll assume standard Supabase setup.

  -- Ensure the publication exists (idempotent-ish check not easily possible in one block without do-block)
  -- We will just try to add it.
  alter publication supabase_realtime add table audit_logs;
commit;

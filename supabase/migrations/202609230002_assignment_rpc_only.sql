-- Assignment versions are writable only through security-definer goal RPCs.
-- This prevents a shared-goal manager from inserting or rescheduling another
-- member's assignment through direct PostgREST table writes.
revoke insert,update,delete on public.goal_assignments from authenticated;

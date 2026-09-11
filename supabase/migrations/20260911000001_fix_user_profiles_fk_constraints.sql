-- Fix foreign key constraints referencing public.user_profiles to ON DELETE SET NULL
-- This allows deleting users without violating foreign key constraints while preserving historical records.

ALTER TABLE public.construction_teams DROP CONSTRAINT IF EXISTS construction_teams_created_by_fkey;
ALTER TABLE public.construction_teams ADD CONSTRAINT construction_teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.construction_members DROP CONSTRAINT IF EXISTS construction_members_created_by_fkey;
ALTER TABLE public.construction_members ADD CONSTRAINT construction_members_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.construction_projects DROP CONSTRAINT IF EXISTS construction_projects_manager_id_fkey;
ALTER TABLE public.construction_projects ADD CONSTRAINT construction_projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.construction_projects DROP CONSTRAINT IF EXISTS construction_projects_created_by_fkey;
ALTER TABLE public.construction_projects ADD CONSTRAINT construction_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.construction_phases DROP CONSTRAINT IF EXISTS construction_phases_created_by_fkey;
ALTER TABLE public.construction_phases ADD CONSTRAINT construction_phases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.construction_tasks DROP CONSTRAINT IF EXISTS construction_tasks_created_by_fkey;
ALTER TABLE public.construction_tasks ADD CONSTRAINT construction_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_check_item_logs DROP CONSTRAINT IF EXISTS inventory_check_item_logs_user_id_fkey;
ALTER TABLE public.inventory_check_item_logs ADD CONSTRAINT inventory_check_item_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

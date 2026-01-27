alter table public.inventory_checks
    add column if not exists reviewer_id uuid references public.user_profiles(id),
    add column if not exists reviewed_at timestamp with time zone,
    add column if not exists rejection_reason text,
    add column if not exists approval_status text check (approval_status in ('PENDING', 'APPROVED', 'REJECTED')) default 'PENDING';

-- Update check constraint for status
alter table public.inventory_checks
    drop constraint if exists inventory_checks_status_check;

alter table public.inventory_checks
    add constraint inventory_checks_status_check
    check (status in ('DRAFT', 'IN_PROGRESS', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'CANCELLED', 'REJECTED'));

-- Enable CONSTRUCTION module for the default 'AnyWarehouse' company
INSERT INTO public.company_subscriptions (company_id, module_code, status)
SELECT id, 'CONSTRUCTION', 'active'
FROM public.companies
WHERE code = 'anywarehouse'
ON CONFLICT (company_id, module_code) DO NOTHING;

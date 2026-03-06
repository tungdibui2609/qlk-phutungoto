-- Add DELETE policy for print_queue
CREATE POLICY "Users can delete print jobs for their company"
ON public.print_queue
FOR DELETE
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

-- Restrict the private database export bucket to admins only.
DROP POLICY IF EXISTS "Admins read export objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins insert export objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins update export objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete export objects" ON storage.objects;

CREATE POLICY "Admins read export objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'database_export_11_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert export objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'database_export_11_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update export objects"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'database_export_11_08_26' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'database_export_11_08_26' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete export objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'database_export_11_08_26' AND public.has_role(auth.uid(), 'admin'));
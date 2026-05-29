REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_comprobante_numero(public.comprobante_tipo) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sale(public.comprobante_tipo, UUID, public.payment_method, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(public.comprobante_tipo, UUID, public.payment_method, JSONB, TEXT) TO authenticated;
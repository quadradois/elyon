DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'leads_origem_not_whatsapp_inbound_chk'
	) THEN
		ALTER TABLE "leads"
		ADD CONSTRAINT "leads_origem_not_whatsapp_inbound_chk"
		CHECK (UPPER(COALESCE("origem", '')) <> 'WHATSAPP_INBOUND');
	END IF;
END
$$;

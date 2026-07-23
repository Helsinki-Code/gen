"""admin MFA tables otp_codes and user_mfa

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-13
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.otp_codes (
            id uuid DEFAULT gen_random_uuid() NOT NULL,
            user_id uuid NOT NULL,
            code_hash text NOT NULL,
            method character varying(20) NOT NULL,
            expires_at timestamp with time zone NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            CONSTRAINT otp_codes_pkey PRIMARY KEY (id),
            CONSTRAINT otp_codes_method_check CHECK (
              ((method)::text = ANY ((ARRAY['email'::character varying, 'sms'::character varying])::text[]))
            )
        );

        CREATE TABLE IF NOT EXISTS public.user_mfa (
            id uuid DEFAULT gen_random_uuid() NOT NULL,
            user_id uuid NOT NULL,
            secret_encrypted text,
            enabled boolean DEFAULT true NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            updated_at timestamp with time zone DEFAULT now() NOT NULL,
            method character varying(20) DEFAULT 'totp'::character varying NOT NULL,
            phone character varying(50) DEFAULT NULL::character varying,
            CONSTRAINT user_mfa_pkey PRIMARY KEY (id),
            CONSTRAINT user_mfa_user_id_method_key UNIQUE (user_id, method)
        );

        CREATE INDEX IF NOT EXISTS idx_otp_codes_expires ON public.otp_codes USING btree (expires_at);
        CREATE INDEX IF NOT EXISTS idx_otp_codes_user_method ON public.otp_codes USING btree (user_id, method);
        CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON public.user_mfa USING btree (user_id);
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'otp_codes_user_id_fkey'
          ) THEN
            ALTER TABLE ONLY public.otp_codes
              ADD CONSTRAINT otp_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'user_mfa_user_id_fkey'
          ) THEN
            ALTER TABLE ONLY public.user_mfa
              ADD CONSTRAINT user_mfa_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE IF EXISTS public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_user_id_fkey")
    op.execute("ALTER TABLE IF EXISTS public.user_mfa DROP CONSTRAINT IF EXISTS user_mfa_user_id_fkey")
    op.execute("DROP INDEX IF EXISTS public.idx_user_mfa_user_id")
    op.execute("DROP INDEX IF EXISTS public.idx_otp_codes_user_method")
    op.execute("DROP INDEX IF EXISTS public.idx_otp_codes_expires")
    op.execute("DROP TABLE IF EXISTS public.user_mfa")
    op.execute("DROP TABLE IF EXISTS public.otp_codes")

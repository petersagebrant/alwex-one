-- Vice VD as a first-class app role (same system permissions as VD).
-- ADD VALUE cannot be used in the same transaction as the new enum value,
-- so permission updates live in 20260826120100_vice_vd_permissions.sql.

alter type public.app_role add value if not exists 'vice_vd';

comment on type public.app_role is
  'VD, Vice VD, AO-chef, Administratör, Läsbehörighet';

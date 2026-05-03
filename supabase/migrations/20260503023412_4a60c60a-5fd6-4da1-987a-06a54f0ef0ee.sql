
-- Account status enum
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'banned');

-- Add account_status to profiles
ALTER TABLE public.profiles
  ADD COLUMN account_status public.account_status NOT NULL DEFAULT 'active',
  ADD COLUMN last_login_at timestamptz,
  ADD COLUMN birth_date date;

-- Admin internal notes about users
CREATE TABLE public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user notes"
  ON public.admin_user_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin actions log (warnings, suspensions, bans, verifications)
CREATE TYPE public.admin_action_type AS ENUM (
  'warning_sent','suspended','banned','unsuspended','unbanned',
  'verified','unverified','role_added','role_removed','deleted','note'
);

CREATE TABLE public.admin_user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  action_type public.admin_action_type NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_user_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage user actions"
  ON public.admin_user_actions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view warnings sent to them"
  ON public.admin_user_actions FOR SELECT TO authenticated
  USING (auth.uid() = target_user_id AND action_type = 'warning_sent');

CREATE INDEX idx_admin_user_actions_target ON public.admin_user_actions(target_user_id, created_at DESC);
CREATE INDEX idx_admin_user_notes_target ON public.admin_user_notes(target_user_id, created_at DESC);

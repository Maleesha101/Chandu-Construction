-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('boss', 'admin', 'qs', 'md', 'viewer');

-- Create expense_status enum
CREATE TYPE public.expense_status AS ENUM ('pending', 'approved', 'rejected', 'wd_pending', 'wd_approved', 'wd_rejected');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  balance DECIMAL(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'LKR',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create managing_directors table
CREATE TABLE public.managing_directors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  float_balance DECIMAL(15, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sites table
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  code TEXT UNIQUE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense_records table
CREATE TABLE public.expense_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entered_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  md_id UUID REFERENCES public.managing_directors(id),
  from_bank_account_id UUID REFERENCES public.bank_accounts(id),
  to_name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  site_id UUID REFERENCES public.sites(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT DEFAULT 'cash',
  status expense_status DEFAULT 'pending',
  reference TEXT,
  wd_reason TEXT,
  qs_notes TEXT,
  week_start DATE,
  week_end DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create record_attachments table
CREATE TABLE public.record_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES public.expense_records(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ledger_entries table
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES public.expense_records(id) ON DELETE CASCADE,
  funding_id UUID,
  account_code TEXT,
  description TEXT,
  debit DECIMAL(15, 2) DEFAULT 0,
  credit DECIMAL(15, 2) DEFAULT 0,
  balance_after DECIMAL(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create approvals table for audit trail
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID REFERENCES public.expense_records(id) ON DELETE CASCADE NOT NULL,
  approver_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create funding_transactions table
CREATE TABLE public.funding_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID REFERENCES public.bank_accounts(id) NOT NULL,
  md_id UUID REFERENCES public.managing_directors(id),
  amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  funding_date DATE NOT NULL DEFAULT CURRENT_DATE,
  week_start DATE,
  week_end DATE,
  created_by UUID REFERENCES auth.users(id),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  payload JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create audit_log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managing_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.record_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Boss and admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Boss can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'boss'));

-- Bank accounts policies (boss and admin can view/manage)
CREATE POLICY "Authenticated users can view bank accounts"
  ON public.bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss can manage bank accounts"
  ON public.bank_accounts FOR ALL
  USING (public.has_role(auth.uid(), 'boss'));

-- Supervisors policies
CREATE POLICY "Authenticated users can view MDs"
  ON public.managing_directors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss and admin can manage MDs"
  ON public.managing_directors FOR ALL
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

-- Sites policies
CREATE POLICY "Authenticated users can view sites"
  ON public.sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss and admin can manage sites"
  ON public.sites FOR ALL
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

-- Expense records policies
CREATE POLICY "Users can view expense records based on role"
  ON public.expense_records FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'boss') OR 
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'qs') OR
    entered_by_user_id = auth.uid()
  );

CREATE POLICY "Admin and boss can insert expense records"
  ON public.expense_records FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'boss') OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Boss can update any expense record"
  ON public.expense_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'boss'));

CREATE POLICY "QS can update WD pending records"
  ON public.expense_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'qs') AND status = 'wd_pending');

CREATE POLICY "Admin can update pending records"
  ON public.expense_records FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') AND status = 'pending');

-- Record attachments policies
CREATE POLICY "Authenticated users can view attachments"
  ON public.record_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin and boss can manage attachments"
  ON public.record_attachments FOR ALL
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

-- Ledger entries policies
CREATE POLICY "Boss and admin can view ledger entries"
  ON public.ledger_entries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert ledger entries"
  ON public.ledger_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

-- Approvals policies
CREATE POLICY "Authenticated users can view approvals"
  ON public.approvals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss and QS can insert approvals"
  ON public.approvals FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'boss') OR 
    public.has_role(auth.uid(), 'qs')
  );

-- Funding transactions policies
CREATE POLICY "Boss and admin can view funding"
  ON public.funding_transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Boss can create funding"
  ON public.funding_transactions FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'boss'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Audit log policies
CREATE POLICY "Boss and admin can view audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit log"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_managing_directors_updated_at
  BEFORE UPDATE ON public.managing_directors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expense_records_updated_at
  BEFORE UPDATE ON public.expense_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Add a function to allow users to assign themselves the boss role on first login
-- This is a one-time setup function for initial admin user

CREATE OR REPLACE FUNCTION public.assign_role(_user_id UUID, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user already has a role
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    RAISE EXCEPTION 'User already has a role assigned';
  END IF;
  
  -- Insert the role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role);
END;
$$;

-- Add a policy to allow users to insert their own role if they don't have one yet
-- This is safe because the assign_role function checks if a role already exists
CREATE POLICY "Users can insert their own first role"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

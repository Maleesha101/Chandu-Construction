import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, CheckCircle } from 'lucide-react';

export default function SetupRole() {
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const assignBossRole = async () => {
    if (!user) {
      toast.error('No user logged in');
      return;
    }

    setLoading(true);
    try {
      // Insert the boss role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'boss',
        });

      if (error) {
        console.error('Failed to assign role:', error);
        throw error;
      }

      setSuccess(true);
      toast.success('Boss role assigned successfully! Refreshing page...');
      
      // Wait a bit then reload
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Failed to assign role. You may need to use the Supabase SQL editor to manually assign your role.');
    } finally {
      setLoading(false);
    }
  };

  if (userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Role Already Set</h1>
          <p className="text-muted-foreground mb-6">
            Your role is: <span className="font-semibold text-foreground">{userRole}</span>
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Setup Your Role</h1>
          <p className="text-muted-foreground">
            You need to assign yourself the Boss role to access all features.
          </p>
        </div>

        {!success ? (
          <>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="text-sm">
                <strong>User ID:</strong> {user?.id}
              </p>
              <p className="text-sm mt-2">
                <strong>Email:</strong> {user?.email}
              </p>
            </div>

            <Button 
              onClick={assignBossRole} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Boss Role
            </Button>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              This will give you full access to create expenses, manage users, and approve transactions.
            </p>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Success!</p>
            <p className="text-sm text-muted-foreground">
              Refreshing page...
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

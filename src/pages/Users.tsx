import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Profile, UserRole, AppRole } from '@/lib/types';
import { Users as UsersIcon, Loader2, Shield, Mail } from 'lucide-react';
import { format } from 'date-fns';

const roleColors: Record<AppRole, string> = {
  boss: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  qs: 'bg-purple-100 text-purple-800',
  md: 'bg-emerald-100 text-emerald-800',
  viewer: 'bg-gray-100 text-gray-800',
};

const roleLabels: Record<AppRole, string> = {
  boss: 'Owner',
  admin: 'Admin',
  qs: 'QS Dept',
  md: 'Managing Director',
  viewer: 'Viewer',
};

interface UserWithRole extends Profile {
  role?: AppRole;
}

export default function Users() {
  const { isRole } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: roles } = await supabase
        .from('user_roles')
        .select('*');

      if (profiles && roles) {
        const usersWithRoles = profiles.map((profile) => {
          const userRole = roles.find((r) => r.user_id === profile.id);
          return {
            ...profile,
            role: userRole?.role as AppRole | undefined,
          };
        });
        setUsers(usersWithRoles as UserWithRole[]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isRole('boss')) {
    return (
      <DashboardLayout title="Users">
        <div className="stat-card text-center py-12">
          <p className="text-muted-foreground">You don't have permission to view this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management" description="View and manage system users">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Object.entries(roleLabels).map(([role, label]) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className="stat-card !py-4">
              <p className="text-sm text-muted-foreground">{label}s</p>
              <p className="text-2xl font-semibold">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="stat-card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No users yet</h3>
            <p className="text-muted-foreground">
              Users will appear here once they sign up.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="data-table-row">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {user.full_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="font-medium">{user.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.role ? (
                      <Badge className={roleColors[user.role]}>
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[user.role]}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No Role</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </DashboardLayout>
  );
}

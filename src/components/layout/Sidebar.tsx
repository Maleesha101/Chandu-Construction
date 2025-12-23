import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Receipt,
    CheckCircle,
    FileCheck,
    Wallet,
    BarChart3,
    Building2,
    Users,
    Settings,
    LogOut,
    Bell,
    ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['boss', 'admin', 'qs', 'md'] },
  { name: 'Expenses', href: '/expenses', icon: Receipt, roles: ['boss', 'admin'] },
  { name: 'Approvals', href: '/approvals', icon: CheckCircle, roles: ['boss'] },
  { name: 'QS Queue', href: '/qs-queue', icon: FileCheck, roles: ['qs', 'boss'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['boss', 'admin'] },
  { name: 'Sites', href: '/sites', icon: Building2, roles: ['boss', 'admin'] },
  { name: 'Users', href: '/users', icon: Users, roles: ['boss'] },
];

export function Sidebar() {
  const location = useLocation();
  const { user, userRole, signOut } = useAuth();

  const filteredNavigation = navigation.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
            <Wallet className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-sidebar-foreground">CC</h1>
            <p className="text-xs text-sidebar-foreground/60">Construction Finance</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'nav-link',
                  isActive && 'active'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-medium">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">{userRole || 'User'}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

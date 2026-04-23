import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  BookMarked, 
  Users, 
  History, 
  Settings, 
  LogOut,
  Library
} from 'lucide-react';

const menuItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: BookMarked, label: 'Books', href: '/dashboard/books' },
  { icon: Users, label: 'Members', href: '/dashboard/members' },
  { icon: History, label: 'Transactions', href: '/dashboard/transactions' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <Library className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">Lumina</span>
      </div>
      
      <nav className="flex-1 space-y-1 px-3 py-4">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-primary'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </div>
  );
};

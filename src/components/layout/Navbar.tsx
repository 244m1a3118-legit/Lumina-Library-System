import { Link } from 'react-router-dom';
import { Container } from '@/src/components/ui/Container';
import { Button } from '@/components/ui/button';
import { Library, LogOut, User } from 'lucide-react';
import { useAuth } from '@/src/lib/AuthContext';
import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

export const Navbar = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    logout();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Library className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">Lumina</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">About</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/admin">
                <Button variant="ghost" size="sm">Admin</Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                } />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem render={<Link to="/profile">Profile</Link>} />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      </Container>
    </nav>
  );
};

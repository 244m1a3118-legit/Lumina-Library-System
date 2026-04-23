import { Container } from '@/src/components/ui/Container';

export const Footer = () => {
  return (
    <footer className="border-t bg-muted/30 py-12">
      <Container>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <span className="text-xl font-bold tracking-tight">Lumina</span>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              The next generation of library management systems. Built for speed, security, and ease of use.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Product</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Features</li>
              <li>Pricing</li>
              <li>Demo</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>About</li>
              <li>Blog</li>
              <li>Careers</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>Privacy</li>
              <li>Terms</li>
              <li>Cookie Policy</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Lumina Library Systems. All rights reserved.</p>
        </div>
      </Container>
    </footer>
  );
};

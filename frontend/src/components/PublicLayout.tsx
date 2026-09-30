import type { ReactNode } from 'react';
import { Container } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-layout">
      <Container as="header" className="app-topbar">
        <nav aria-label="Navigation principale">
          <Link to="/" className="app-brand">
            Legacy Todo App
          </Link>
        </nav>
      </Container>
      <main id="main" className="public-main">
        {children}
      </main>
      <Container as="footer" className="app-footer">
        <small>
          Legacy Todo App · <Link to="/privacy">Confidentialité</Link>
        </small>
      </Container>
    </div>
  );
}

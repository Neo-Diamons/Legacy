import { useEffect, useRef } from 'react';
import { Container, Nav } from 'react-bootstrap';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { PublicLayout } from './components/PublicLayout';
import { UserMenu } from './components/UserMenu';
import { NotificationContainer } from './components/NotificationContainer';
import { AppDataProvider } from './context/AppDataProvider';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider } from './services/auth';
import { useAuth } from './services/authContext';

function ProjectsRoute() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  return (
    <ProjectsPage
      selectedProjectId={projectId ?? null}
      onSelectProject={(id) => navigate(id ? `/projects/${id}` : '/projects')}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { loading, user } = useAuth();
  if (loading) return null;
  if (!user)
    return (
      <Routes>
        <Route
          path="/privacy"
          element={
            <PublicLayout>
              <Container>
                <PrivacyPage />
              </Container>
            </PublicLayout>
          }
        />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );

  return <AuthenticatedShell />;
}

function AuthenticatedShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.startsWith('/projects')
    ? 'projects'
    : location.pathname.startsWith('/profile')
      ? 'profile'
      : 'home';

  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to the page heading on navigation so keyboard and screen-reader users land on the new content.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = mainRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    } else {
      mainRef.current?.focus();
    }
  }, [location.pathname]);

  return (
    <AppDataProvider>
      <a href="#main" className="visually-hidden-focusable skip-link">
        Aller au contenu principal
      </a>
      <Container>
        <NotificationContainer />
        <header className="app-topbar">
          <Nav as="nav" variant="pills" activeKey={activeTab}>
            <Nav.Item>
              <Nav.Link as={Link} to="/" eventKey="home" aria-current={activeTab === 'home' ? 'page' : undefined}>
                Accueil
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                as={Link}
                to="/projects"
                eventKey="projects"
                aria-current={activeTab === 'projects' ? 'page' : undefined}
              >
                Projets
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <UserMenu onProfileClick={() => navigate('/profile')} />
        </header>

        <main id="main" ref={mainRef} tabIndex={-1}>
          <Routes>
            <Route path="/" element={<HomePage onSelectProject={(id) => navigate(`/projects/${id}`)} />} />
            <Route path="/projects" element={<ProjectsRoute />} />
            <Route path="/projects/:projectId" element={<ProjectsRoute />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <small>
            Legacy Todo App · <Link to="/privacy">Confidentialité</Link>
          </small>
        </footer>
      </Container>
    </AppDataProvider>
  );
}

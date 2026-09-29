import { Container, Nav } from 'react-bootstrap';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import { UserMenu } from './components/UserMenu';
import { NotificationContainer } from './components/NotificationContainer';
import { AppDataProvider } from './context/AppDataProvider';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectsPage } from './pages/ProjectsPage';

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
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname.startsWith('/projects')
    ? 'projects'
    : location.pathname.startsWith('/profile')
      ? 'profile'
      : 'home';

  return (
    <AppDataProvider>
      <Container>
        <NotificationContainer />
        <header className="app-topbar">
          <Nav as="nav" variant="pills" activeKey={activeTab}>
            <Nav.Item>
              <Nav.Link as={Link} to="/" eventKey="home">
                Accueil
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link as={Link} to="/projects" eventKey="projects">
                Projets
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <UserMenu onProfileClick={() => navigate('/profile')} />
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage onSelectProject={(id) => navigate(`/projects/${id}`)} />} />
            <Route path="/projects" element={<ProjectsRoute />} />
            <Route path="/projects/:projectId" element={<ProjectsRoute />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="app-footer">
          <small>Legacy Todo App</small>
        </footer>
      </Container>
    </AppDataProvider>
  );
}

import { useState } from 'react';
import { Container, Nav } from 'react-bootstrap';

import { UserMenu } from './components/UserMenu';
import { AppDataProvider } from './context/AppDataProvider';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { ProjectsPage } from './pages/ProjectsPage';

type Tab = 'home' | 'projects' | 'profile';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <AppDataProvider>
      <Container>
        <div className="app-topbar">
          <Nav variant="pills" activeKey={tab} onSelect={(key) => setTab((key as Tab) ?? 'home')}>
            <Nav.Item>
              <Nav.Link eventKey="home">Accueil</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="projects">Projets</Nav.Link>
            </Nav.Item>
          </Nav>

          <UserMenu onProfileClick={() => setTab('profile')} />
        </div>

        {tab === 'home' && <HomePage />}
        {tab === 'projects' && <ProjectsPage />}
        {tab === 'profile' && <ProfilePage />}
      </Container>
    </AppDataProvider>
  );
}

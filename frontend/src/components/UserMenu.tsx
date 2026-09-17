import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { Dropdown } from 'react-bootstrap';

import { useAppData } from '../context/appDataContext';
import { initialsOf } from '../utils/format';

const AvatarToggle = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ children, className, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={`user-avatar-toggle ${className ?? ''}`.trim()}
      aria-label="Menu utilisateur"
      {...rest}
    >
      {children}
    </button>
  )
);
AvatarToggle.displayName = 'AvatarToggle';

export function UserMenu({ onProfileClick }: { onProfileClick: () => void }) {
  const { user } = useAppData();

  const handleLogout = () => {
    // TODO(backend): wire this to the real sign-out endpoint once authentication exists.
    window.alert('Déconnexion : fonctionnalité à venir, en attente de l’authentification côté backend.');
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle as={AvatarToggle}>{initialsOf(user.name)}</Dropdown.Toggle>
      <Dropdown.Menu>
        <Dropdown.Item onClick={onProfileClick}>Profil</Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item onClick={handleLogout}>Déconnexion</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

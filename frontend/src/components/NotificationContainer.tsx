import { useAppData } from '../context/appDataContext';
import { NotificationPopUp } from './NotificationPopUp';

export function NotificationContainer() {
  const { notifications, removeNotification } = useAppData();

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
      }}
    >
      {notifications.map((notif) => (
        <NotificationPopUp
          key={notif.id}
          httpCode={notif.httpCode}
          message={notif.message}
          onClose={() => removeNotification(notif.id)}
        />
      ))}
    </div>
  );
}

import { useAppData } from '../context/appDataContext';
import { NotificationPopUp } from './NotificationPopUp';

export function NotificationContainer() {
  const { notifications, removeNotification } = useAppData();

  return (
    <div>
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
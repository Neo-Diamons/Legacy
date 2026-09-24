import '@fortawesome/fontawesome-free/css/all.min.css';

const COLOR_SWATCHES: Record<number, string> = {
  201: '#1fc72d',
  204: '#1fc72d',
  404: '#d9db36',
  422: '#d9db36',
  500: '#4fbf7c',
  502: '#4fbf7c',
};

const ICONS: Record<number, React.ReactNode> = {
  201: <i className="fas fa-check-circle" style={{ marginRight: 8 }}></i>,
  204: <i className="fas fa-check-circle" style={{ marginRight: 8 }}></i>,
  404: <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>,
  422: <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }}></i>,
  500: <i className="fas fa-times-circle" style={{ marginRight: 8 }}></i>,
  502: <i className="fas fa-times-circle" style={{ marginRight: 8 }}></i>,
};

export function NotificationPopUp({httpCode, message, onClose}: {httpCode: number, message: string, onClose: () => void}) {
    const color = COLOR_SWATCHES[httpCode] ?? '#c6d3df';
    return (
        <div
        style={{
            backgroundColor: color,
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 12,
        }}
        onClick={onClose}
        >
            {ICONS[httpCode] ?? <i className="fas fa-info-circle" style={{ marginRight: 8 }}></i>}
            <span>
                <strong>{httpCode}</strong> - {message}
            </span>
        </div>
  );
}
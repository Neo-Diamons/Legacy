import { useState} from 'react';
import {BsCheckCircleFill, BsExclamationTriangleFill, BsXCircleFill, BsInfoCircleFill} from 'react-icons/bs';


const COLOR_SWATCHES: Record<number, string> = {
  201: '#1fc72d',
  404: '#d9db36',
  500: '#4fbf7c',
};

const ICONS: Record<number, React.ReactNode> = {
  201: <BsCheckCircleFill />,
  404: <BsExclamationTriangleFill />,
  500: <BsXCircleFill />,
};;

export function NotificationPopUp({httpCode, message}: {httpCode: number, message: string}) {
    const [show, setShow] = useState(true);
    const color = COLOR_SWATCHES[httpCode] ?? '#6c757d';

    const close = () => {
        setShow(false);
    };

    if (!show) return null;

    return (
        <div
        style={{
            backgroundColor: color,
            color: '#fff',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 12,
        }}
        onClick={close}
        >
            {ICONS[httpCode] ?? <BsInfoCircleFill />}
            <span>
                <strong>{httpCode}</strong> - {message}
            </span>
        </div>
  );
}
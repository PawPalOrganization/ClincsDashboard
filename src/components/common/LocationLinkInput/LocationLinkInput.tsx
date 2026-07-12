import { useState } from 'react';
import Input from '../Input/Input';
import { isShortenedGoogleMapsLink, parseLocationLink } from '../../../utils/parseLocationLink';
import styles from './LocationLinkInput.module.scss';

interface LocationLinkInputProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  disabled?: boolean;
}

export default function LocationLinkInput({ lat, lng, onChange, disabled }: LocationLinkInputProps) {
  const [linkValue, setLinkValue] = useState('');
  const [error, setError] = useState('');

  function handleLinkChange(value: string) {
    setLinkValue(value);

    if (!value.trim()) {
      setError('');
      return;
    }

    if (isShortenedGoogleMapsLink(value)) {
      setError("Shortened links aren't supported — open it in a browser first, then paste the full URL from the address bar.");
      return;
    }

    const parsed = parseLocationLink(value);
    if (parsed) {
      setError('');
      onChange(parsed.lat, parsed.lng);
    } else {
      setError("Couldn't find coordinates in this link. Paste the full Google Maps link (Share → Copy link, or right-click the pin → \"What's here?\").");
    }
  }

  function handleClear() {
    onChange(null, null);
    setLinkValue('');
    setError('');
  }

  const hasLocation = lat != null && lng != null;

  return (
    <div className={styles.wrapper}>
      <Input
        label="Location Link"
        name="locationLink"
        type="text"
        placeholder="https://www.google.com/maps/place/..."
        value={linkValue}
        onChange={(e) => handleLinkChange(e.target.value)}
        error={error}
        icon="bi-link-45deg"
        disabled={disabled}
      />

      <div className={styles.coordsRow}>
        {hasLocation ? (
          <span className={styles.coordsBadge}>
            <i className="bi bi-geo-alt-fill" />
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        ) : (
          <span className={styles.noLocation}>
            <i className="bi bi-geo-alt" />
            No location set
          </span>
        )}

        {hasLocation && !disabled && (
          <button type="button" className={styles.clearBtn} onClick={handleClear}>
            <i className="bi bi-x-lg" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

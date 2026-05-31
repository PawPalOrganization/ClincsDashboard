import { useState, useRef, useEffect } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import styles from './MapPicker.module.scss';

const MAPS_API_KEY = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 }; // Cairo
const PAW_MARKER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="30" fill="#ffffff" stroke="#2563eb" stroke-width="4"/>
  <ellipse cx="18" cy="22" rx="7" ry="9" fill="#2563eb"/>
  <ellipse cx="32" cy="17" rx="7" ry="9" fill="#2563eb"/>
  <ellipse cx="46" cy="22" rx="7" ry="9" fill="#2563eb"/>
  <ellipse cx="24" cy="36" rx="6" ry="8" fill="#2563eb"/>
  <ellipse cx="40" cy="36" rx="6" ry="8" fill="#2563eb"/>
  <path d="M20 48c0-8 6-15 12-15s12 7 12 15c0 5-5 7-12 7s-12-2-12-7z" fill="#2563eb"/>
</svg>`;

function getPawMarkerIcon(): google.maps.Icon {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(PAW_MARKER_SVG)}`,
    scaledSize: new google.maps.Size(28, 28),
    anchor: new google.maps.Point(14, 26),
  };
}

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  disabled?: boolean;
}

export default function MapPicker({ lat, lng, onChange, disabled }: MapPickerProps) {
  const [isOpen, setIsOpen]         = useState(false);
  const [pendingLat, setPendingLat] = useState<number | null>(null);
  const [pendingLng, setPendingLng] = useState<number | null>(null);
  const [loadError, setLoadError]   = useState('');
  const [mapReady, setMapReady]     = useState(false);

  const mapDivRef    = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<google.maps.Map | null>(null);
  const markerRef    = useRef<google.maps.Marker | null>(null);
  const searchRef    = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  function handleOpen() {
    setPendingLat(lat);
    setPendingLng(lng);
    setLoadError('');
    setMapReady(false);
    initializedRef.current = false;
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    mapRef.current = null;
    markerRef.current = null;
  }

  function handleConfirm() {
    onChange(pendingLat, pendingLng);
    setIsOpen(false);
    mapRef.current = null;
    markerRef.current = null;
  }

  function handleClear() {
    onChange(null, null);
  }

  // Initialize the map once the modal DOM is ready
  useEffect(() => {
    if (!isOpen || initializedRef.current || !MAPS_API_KEY) return;

    const timer = setTimeout(async () => {
      if (!mapDivRef.current || initializedRef.current) return;
      initializedRef.current = true;

      try {
        const { setOptions, importLibrary } = await import('@googlemaps/js-api-loader');
        setOptions({ key: MAPS_API_KEY, v: 'weekly' });

        const [mapsLib, placesLib] = await Promise.all([
          importLibrary('maps'),
          importLibrary('places'),
        ]);

        const center = (lat != null && lng != null)
          ? { lat, lng }
          : DEFAULT_CENTER;

        const map = new mapsLib.Map(mapDivRef.current!, {
          center,
          zoom: lat != null ? 15 : 11,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });

        mapRef.current = map;

        // Place existing marker if coords are set
        if (lat != null && lng != null) {
          markerRef.current = new google.maps.Marker({
            map,
            position: { lat, lng },
            icon: getPawMarkerIcon(),
          });
        }

        // Click → place / move marker
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();

          if (markerRef.current) {
            markerRef.current.setPosition(e.latLng);
          } else {
            markerRef.current = new google.maps.Marker({
              map,
              position: e.latLng,
              icon: getPawMarkerIcon(),
            });
          }

          setPendingLat(newLat);
          setPendingLng(newLng);
        });

        // Search box (Places Autocomplete)
        if (searchRef.current) {
          const autocomplete = new placesLib.Autocomplete(searchRef.current, {
            componentRestrictions: { country: 'eg' },
            fields: ['geometry'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;

            const newLat = place.geometry.location.lat();
            const newLng = place.geometry.location.lng();

            map.panTo({ lat: newLat, lng: newLng });
            map.setZoom(16);

            if (markerRef.current) {
              markerRef.current.setPosition(place.geometry.location);
            } else {
              markerRef.current = new google.maps.Marker({
                map,
                position: place.geometry.location,
                icon: getPawMarkerIcon(),
              });
            }

            setPendingLat(newLat);
            setPendingLng(newLng);
          });
        }

        setMapReady(true);
      } catch {
        setLoadError('Failed to load Google Maps. Check your API key and network connection.');
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isOpen, lat, lng]);

  const hasLocation = lat != null && lng != null;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>Location on Map</label>

      <div className={styles.row}>
        {hasLocation ? (
          <span className={styles.coordsBadge}>
            <i className="bi bi-geo-alt-fill" />
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        ) : (
          <span className={styles.noLocation}>
            <i className="bi bi-geo-alt" />
            No location selected
          </span>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.pickBtn}
            onClick={handleOpen}
            disabled={disabled}
          >
            <i className="bi bi-map" />
            {hasLocation ? 'Change Location' : 'Pick on Map'}
          </button>

          {hasLocation && !disabled && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleClear}
              title="Clear location"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Pick Branch Location"
        size="large"
        footer={
          <>
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={pendingLat == null}
            >
              <i className="bi bi-check-lg" /> Confirm Location
            </Button>
          </>
        }
      >
        {!MAPS_API_KEY ? (
          <div className={styles.noKey}>
            <i className="bi bi-exclamation-triangle" />
            <p>
              Google Maps API key is not configured.<br />
              Add <code>VITE_GOOGLE_MAPS_API_KEY=your_key</code> to your <code>.env</code> file.
            </p>
          </div>
        ) : (
          <div className={styles.mapWrapper}>
            <input
              ref={searchRef}
              type="text"
              className={styles.searchInput}
              placeholder="Search for an address or place..."
            />

            {loadError ? (
              <div className={styles.loadError}>
                <i className="bi bi-exclamation-circle" /> {loadError}
              </div>
            ) : (
              <div ref={mapDivRef} className={styles.mapContainer} />
            )}

            <div className={styles.mapHint}>
              {!mapReady && !loadError && (
                <span className={styles.loading}>
                  <i className="bi bi-arrow-repeat" /> Loading map…
                </span>
              )}
              {mapReady && pendingLat == null && (
                <span>Click anywhere on the map to select a location.</span>
              )}
              {pendingLat != null && (
                <span className={styles.selectedCoords}>
                  <i className="bi bi-crosshair" />
                  {' '}{pendingLat.toFixed(6)}, {pendingLng!.toFixed(6)}
                  <em> — click anywhere to adjust</em>
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

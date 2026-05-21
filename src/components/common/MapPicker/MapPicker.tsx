import { useState, useRef, useEffect } from 'react';
import Modal from '../Modal/Modal';
import Button from '../Button/Button';
import styles from './MapPicker.module.scss';

const MAPS_API_KEY = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_GOOGLE_MAPS_API_KEY;
const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 }; // Cairo

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
  const markerRef    = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
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
        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({ apiKey: MAPS_API_KEY, version: 'weekly' });

        const [mapsLib, markerLib, placesLib] = await Promise.all([
          loader.importLibrary('maps'),
          loader.importLibrary('marker'),
          loader.importLibrary('places'),
        ]);

        const center = (lat != null && lng != null)
          ? { lat, lng }
          : DEFAULT_CENTER;

        const map = new mapsLib.Map(mapDivRef.current!, {
          center,
          zoom: lat != null ? 15 : 11,
          mapId: 'PAWCLINICS_MAP',
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });

        mapRef.current = map;

        // Place existing marker if coords are set
        if (lat != null && lng != null) {
          markerRef.current = new markerLib.AdvancedMarkerElement({
            map,
            position: { lat, lng },
          });
        }

        // Click → place / move marker
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();

          if (markerRef.current) {
            markerRef.current.position = e.latLng;
          } else {
            markerRef.current = new markerLib.AdvancedMarkerElement({
              map,
              position: e.latLng,
            });
          }

          setPendingLat(newLat);
          setPendingLng(newLng);
        });

        // Search box (Places Autocomplete)
        if (searchRef.current) {
          const autocomplete = new placesLib.Autocomplete(searchRef.current, {
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
              markerRef.current.position = place.geometry.location;
            } else {
              markerRef.current = new markerLib.AdvancedMarkerElement({
                map,
                position: place.geometry.location,
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
              placeholder="Search for an address or place…"
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

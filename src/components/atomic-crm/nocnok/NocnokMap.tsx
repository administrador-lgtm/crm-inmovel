import { MarkerClusterer } from "@googlemaps/markerclusterer";
import {
  APIProvider,
  InfoWindow,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useGetList, useListContext } from "ra-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

import { type Nocnok, operacionLabel, formatPrecio } from "./types";

interface Point extends Nocnok {
  lat_num: number;
  lng_num: number;
}

type BoundsLiteral = google.maps.LatLngBoundsLiteral;

const CDMX_CENTER = { lat: 19.401, lng: -99.16 };

/** Filter keys that represent a spatial selection (viewport box or polygon).
 *  Living in the shared list filter means the zone applies to BOTH the map and
 *  the list, shows as a chip, and survives switching views. */
const SPATIAL_KEYS = [
  "lat_num@gte",
  "lat_num@lte",
  "lng_num@gte",
  "lng_num@lte",
  "codigo@in",
];

const stripSpatial = (f: Record<string, unknown>) => {
  const next = { ...f };
  SPATIAL_KEYS.forEach((k) => delete next[k]);
  return next;
};

/** Clustered markers for the visible points. Fits the viewport only when no
 *  spatial filter is active (so panning/drawing doesn't yank the view back). */
const MarkersLayer = ({
  points,
  onSelect,
  fit,
}: {
  points: Point[];
  onSelect: (p: Point) => void;
  fit: boolean;
}) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const markers = points.map((p) => {
      const marker = new google.maps.Marker({
        position: { lat: p.lat_num, lng: p.lng_num },
        title: p.title,
      });
      marker.addListener("click", () => onSelect(p));
      return marker;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    if (fit && points.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      points.forEach((p) => bounds.extend({ lat: p.lat_num, lng: p.lng_num }));
      map.fitBounds(bounds, 48);
    }
    return () => {
      clusterer.clearMarkers();
      markers.forEach((m) => m.setMap(null));
    };
  }, [map, points, onSelect, fit]);
  return null;
};

/** Lets the user draw one polygon. Reports the completed polygon up so the
 *  parent can keep it on the map and filter by it. */
const DrawingLayer = ({
  drawing,
  onComplete,
}: {
  drawing: boolean;
  onComplete: (poly: google.maps.Polygon) => void;
}) => {
  const map = useMap();
  const drawingLib = useMapsLibrary("drawing");
  // Ref so the DrawingManager is created once when drawing turns on and is NOT
  // torn down by onComplete changing identity on every render.
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!map || !drawingLib || !drawing) return;
    // @types/google.maps@3.65 reduced DrawingManager to an empty deprecated stub
    // (the drawing library was dropped from the typed API surface) while the
    // runtime still provides it via importLibrary. Re-declare the slice of the
    // legacy API this component uses so tsc stays green without an `any`.
    type LegacyDrawingManager = google.maps.MVCObject & {
      setDrawingMode(mode: string | null): void;
      setMap(map: google.maps.Map | null): void;
    };
    const DrawingManagerCtor = drawingLib.DrawingManager as unknown as new (
      opts: Record<string, unknown>,
    ) => LegacyDrawingManager;
    const manager = new DrawingManagerCtor({
      drawingMode: drawingLib.OverlayType.POLYGON,
      drawingControl: false,
      map,
      polygonOptions: {
        fillColor: "#6366f1",
        fillOpacity: 0.15,
        strokeColor: "#6366f1",
        strokeWeight: 2,
        clickable: false,
        editable: false,
      },
    });
    const listener = manager.addListener(
      "polygoncomplete",
      (poly: google.maps.Polygon) => {
        manager.setDrawingMode(null);
        onCompleteRef.current(poly);
      },
    );
    return () => {
      listener.remove();
      manager.setMap(null);
    };
  }, [map, drawingLib, drawing]);
  return null;
};

/** Google Places autocomplete (colonias / alcaldías, restricted to Mexico).
 *  Picking a place pans+filters the map to that zone. */
const PlaceSearch = ({
  onPlace,
}: {
  onPlace: (place: google.maps.places.PlaceResult) => void;
}) => {
  const placesLib = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;
  useEffect(() => {
    if (!placesLib || !inputRef.current) return;
    const ac = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "mx" },
      fields: ["geometry", "name", "formatted_address"],
      types: ["geocode"],
    });
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (place.geometry) onPlaceRef.current(place);
    });
    return () => listener.remove();
  }, [placesLib]);
  return (
    <input
      ref={inputRef}
      placeholder="Buscar colonia o alcaldía…"
      className="w-64 max-w-[70vw] rounded-md border bg-background px-3 py-2 text-sm shadow"
    />
  );
};

/** Notifies when the user pans/zooms, to surface the "search this area" button. */
const MoveWatcher = ({ onMove }: { onMove: () => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const a = map.addListener("dragend", onMove);
    const b = map.addListener("zoom_changed", onMove);
    return () => {
      a.remove();
      b.remove();
    };
  }, [map, onMove]);
  return null;
};

const MiniFicha = ({ p }: { p: Point }) => {
  const precio = formatPrecio(p.precio);
  return (
    <div className="max-w-[240px] text-sm">
      <p className="font-semibold leading-tight mb-1">{p.title ?? p.codigo}</p>
      <p className="text-xs text-muted-foreground mb-1">
        {operacionLabel(p.operacion)}
        {precio ? ` · ${precio}${p.operacion === "Rent" ? "/mes" : ""}` : ""}
      </p>
      <p className="text-xs mb-2">
        {[
          p.colonia,
          p.type_text,
          p.recamaras ? `${p.recamaras} rec` : null,
          p.m2 ? `${p.m2} m²` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="flex flex-wrap gap-2">
        {p.broker_wa ? (
          <a
            href={p.broker_wa}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            💬 Broker
          </a>
        ) : null}
        {p.url_ficha ? (
          <a
            href={p.url_ficha}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            📄 Ficha
          </a>
        ) : null}
        <Link to={`/nocnok/${p.id}/show`} className="text-primary underline">
          🔎 Resumen
        </Link>
      </div>
    </div>
  );
};

/** The map itself + spatial controls. Rendered inside <APIProvider> so it can
 *  use the map instance for "search this area" and polygon drawing. */
const MapView = ({ allPoints }: { allPoints: Point[] }) => {
  const map = useMap();
  const geometryLib = useMapsLibrary("geometry");
  const { filterValues, setFilters, displayedFilters } = useListContext();

  const [drawing, setDrawing] = useState(false);
  const [showAreaBtn, setShowAreaBtn] = useState(false);
  const [selected, setSelected] = useState<Point | null>(null);
  const polyRef = useRef<google.maps.Polygon | null>(null);

  // Refs keep the spatial callbacks stable so they don't re-bind the map
  // listeners / autocomplete every time the filters change.
  const fvRef = useRef(filterValues);
  fvRef.current = filterValues;
  const dfRef = useRef(displayedFilters);
  dfRef.current = displayedFilters;
  const pointsRef = useRef(allPoints);
  pointsRef.current = allPoints;

  const hasSpatial = SPATIAL_KEYS.some((k) => filterValues?.[k] != null);
  const hasAttr = Object.keys(filterValues ?? {}).some(
    (k) =>
      !SPATIAL_KEYS.includes(k) &&
      filterValues[k] != null &&
      filterValues[k] !== "",
  );

  const onSelect = useCallback((p: Point) => setSelected(p), []);
  const onMove = useCallback(() => setShowAreaBtn(true), []);

  const clearPolygonVisual = () => {
    if (polyRef.current) {
      polyRef.current.setMap(null);
      polyRef.current = null;
    }
  };

  // Apply a bounding box as the shared zone filter (works on list + map).
  const applyBounds = useCallback(
    (b: BoundsLiteral) => {
      clearPolygonVisual();
      setFilters(
        {
          ...stripSpatial(fvRef.current ?? {}),
          "lat_num@gte": b.south,
          "lat_num@lte": b.north,
          "lng_num@gte": b.west,
          "lng_num@lte": b.east,
        },
        dfRef.current,
      );
      setShowAreaBtn(false);
    },
    [setFilters],
  );

  // Place picked from the Google autocomplete: pan + filter to that zone.
  const onPlace = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!map || !place.geometry) return;
      const vp = place.geometry.viewport;
      if (vp) {
        map.fitBounds(vp);
        applyBounds(vp.toJSON());
      } else if (place.geometry.location) {
        map.panTo(place.geometry.location);
        map.setZoom(14);
        setShowAreaBtn(true);
      }
    },
    [map, applyBounds],
  );

  const searchThisArea = () => {
    const b = map?.getBounds()?.toJSON();
    if (b) applyBounds(b);
  };

  // Polygon drawn: filter by the exact ids inside it (shared, so the list shows
  // the same set). Computed client-side over the loaded points.
  const onPolygonComplete = useCallback(
    (poly: google.maps.Polygon) => {
      clearPolygonVisual();
      polyRef.current = poly;
      const ids = geometryLib
        ? pointsRef.current
            .filter((p) =>
              geometryLib.poly.containsLocation(
                new google.maps.LatLng(p.lat_num, p.lng_num),
                poly,
              ),
            )
            .map((p) => p.id)
        : [];
      setFilters(
        {
          ...stripSpatial(fvRef.current ?? {}),
          // sentinel when nothing falls inside, so the query returns 0 cleanly
          "codigo@in": ids.length ? ids : ["__none__"],
        },
        dfRef.current,
      );
      setDrawing(false);
      setShowAreaBtn(false);
    },
    [geometryLib, setFilters],
  );

  const clearSpatial = () => {
    clearPolygonVisual();
    setFilters(stripSpatial(fvRef.current ?? {}), dfRef.current);
    setDrawing(false);
    setShowAreaBtn(false);
  };

  return (
    <div className="relative">
      {/* Controls overlay: place search (left) + spatial actions (right) */}
      <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <PlaceSearch onPlace={onPlace} />
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-2 justify-end">
          {showAreaBtn ? (
            <Button size="sm" onClick={searchThisArea} className="shadow">
              🔍 Buscar en esta zona
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={drawing ? "default" : "secondary"}
            className="shadow"
            onClick={() => {
              clearSpatial();
              setDrawing((d) => !d);
            }}
          >
            {drawing ? "Cancela dibujo" : "✏️ Dibujar zona"}
          </Button>
          {hasSpatial ? (
            <Button
              size="sm"
              variant="outline"
              className="shadow"
              onClick={clearSpatial}
            >
              ✕ Quitar zona
            </Button>
          ) : null}
        </div>
      </div>

      <div className="h-[70vh] w-full rounded-md overflow-hidden border">
        <Map
          defaultCenter={CDMX_CENTER}
          defaultZoom={11}
          gestureHandling="greedy"
          zoomControl={true}
          mapTypeControl={true}
          fullscreenControl={true}
          streetViewControl={false}
          clickableIcons={false}
        >
          <MarkersLayer
            points={allPoints}
            onSelect={onSelect}
            fit={hasAttr && !hasSpatial}
          />
          <DrawingLayer drawing={drawing} onComplete={onPolygonComplete} />
          <MoveWatcher onMove={onMove} />
          {selected ? (
            <InfoWindow
              position={{ lat: selected.lat_num, lng: selected.lng_num }}
              onCloseClick={() => setSelected(null)}
            >
              <MiniFicha p={selected} />
            </InfoWindow>
          ) : null}
        </Map>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {allPoints.length} propiedades en el mapa
        {hasSpatial ? " (en la zona seleccionada)" : ""}
      </p>
    </div>
  );
};

export const NocnokMap = () => {
  const { filterValues } = useListContext();
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const { data } = useGetList<Nocnok>("nocnok", {
    filter: filterValues,
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "status_date", order: "DESC" },
  });

  const allPoints = useMemo<Point[]>(
    () =>
      (data ?? [])
        .map((r) => ({
          ...r,
          lat_num: parseFloat(String(r.lat)),
          lng_num: parseFloat(String(r.lon)),
        }))
        .filter((p) => !Number.isNaN(p.lat_num) && !Number.isNaN(p.lng_num)),
    [data],
  );

  if (!apiKey) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Falta configurar la API key de Google Maps (VITE_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <MapView allPoints={allPoints} />
    </APIProvider>
  );
};

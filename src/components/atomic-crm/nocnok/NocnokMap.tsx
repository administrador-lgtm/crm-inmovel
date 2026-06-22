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

type SpatialMode = "none" | "area" | "polygon";
type BoundsLiteral = google.maps.LatLngBoundsLiteral;

const CDMX_CENTER = { lat: 19.401, lng: -99.16 };

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
  useEffect(() => {
    if (!map || !drawingLib || !drawing) return;
    const manager = new drawingLib.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYGON,
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
        onComplete(poly);
      },
    );
    return () => {
      listener.remove();
      manager.setMap(null);
    };
  }, [map, drawingLib, drawing, onComplete]);
  return null;
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

  const [mode, setMode] = useState<SpatialMode>("none");
  const [areaBounds, setAreaBounds] = useState<BoundsLiteral | null>(null);
  const [polygonPath, setPolygonPath] = useState<
    google.maps.LatLngLiteral[] | null
  >(null);
  const [drawing, setDrawing] = useState(false);
  const [showAreaBtn, setShowAreaBtn] = useState(false);
  const [selected, setSelected] = useState<Point | null>(null);
  const polyRef = useRef<google.maps.Polygon | null>(null);

  const onSelect = useCallback((p: Point) => setSelected(p), []);
  const onMove = useCallback(() => setShowAreaBtn(true), []);

  const visible = useMemo<Point[]>(() => {
    if (mode === "area" && areaBounds) {
      return allPoints.filter(
        (p) =>
          p.lat_num >= areaBounds.south &&
          p.lat_num <= areaBounds.north &&
          p.lng_num >= areaBounds.west &&
          p.lng_num <= areaBounds.east,
      );
    }
    if (mode === "polygon" && polygonPath && geometryLib) {
      const poly = new google.maps.Polygon({ paths: polygonPath });
      return allPoints.filter((p) =>
        geometryLib.poly.containsLocation(
          new google.maps.LatLng(p.lat_num, p.lng_num),
          poly,
        ),
      );
    }
    return allPoints;
  }, [allPoints, mode, areaBounds, polygonPath, geometryLib]);

  const searchThisArea = () => {
    const b = map?.getBounds()?.toJSON();
    if (!b) return;
    clearPolygon();
    setAreaBounds(b);
    setMode("area");
    setShowAreaBtn(false);
  };

  const onPolygonComplete = useCallback((poly: google.maps.Polygon) => {
    polyRef.current = poly;
    setPolygonPath(
      poly
        .getPath()
        .getArray()
        .map((ll) => ll.toJSON()),
    );
    setAreaBounds(null);
    setMode("polygon");
    setDrawing(false);
    setShowAreaBtn(false);
  }, []);

  const clearPolygon = () => {
    if (polyRef.current) {
      polyRef.current.setMap(null);
      polyRef.current = null;
    }
    setPolygonPath(null);
  };

  const clearSpatial = () => {
    clearPolygon();
    setAreaBounds(null);
    setMode("none");
    setDrawing(false);
    setShowAreaBtn(false);
  };

  return (
    <div className="relative">
      {/* Spatial controls overlay */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex flex-wrap gap-2 justify-center">
        {showAreaBtn && mode !== "polygon" ? (
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
        {mode !== "none" ? (
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

      <div className="h-[70vh] w-full rounded-md overflow-hidden border">
        <Map
          defaultCenter={CDMX_CENTER}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
        >
          <MarkersLayer
            points={visible}
            onSelect={onSelect}
            fit={mode === "none"}
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
        {visible.length} propiedades en el mapa
        {mode !== "none" ? " (en la zona seleccionada)" : ""}
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

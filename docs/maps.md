# Maps platform (Mapbox)

KlikCollect maps use **Mapbox GL JS** only. Google Maps appears as outbound deep links.

Visual language matches Obscura: warm canvas, black ink, zero radius, translucent glass (`mapGlass` in `MapChrome`).

## Surfaces

| Route | Audience |
|-------|----------|
| `/maps` | Storefront discovery |
| `/driver` | Courier live map |
| `/app/couriers` | Vendor dispatch |

Shared engine: `components/map/MapCanvas.tsx` · chrome: `components/map/MapChrome.tsx` · APIs: `lib/mapbox-api.ts`

## Map styles (4)

Both `/maps` and `/driver` expose the same presets via `MapChrome`:
- **Street** — branded marketplace streets
- **Perfect** — classic Mapbox Streets (perfect street map)
- **Satellite** — aerial + tilt
- **3D** — terrain / buildings / depth

## Point of view (5 + Free)

Camera presets (independent of basemap):
- **Top** · **Street** · **Bird** · **Cinema** · **Heading**
- **Free** — interactive drag tilt / rotate

## `/maps` — Google-like discovery (Mapbox + Google deep links)

**Always visible**
- **Mapbox Search Box** (`AdvancedMapSearch`) — typeahead streets/POIs/addresses + vendor results, Nairobi bias, ETA when GPS on
- Nearby chips: Food · Cafe · Fuel · Pharmacy · Hotels · Parking · ATM · Parks
- Street / Perfect / Satellite / 3D · POV · zoom / locate · List
- Tap anywhere → select place · What’s here · Street View · Drive/Walk/Cycle
- Place card → Directions · Google Maps · Share · Copy · Street View

**Tucked under More**
- Open / Verified / Offers · radius
- Live traffic overlay
- Alternative routes · isochrone · route from pin · GPS snap
- Turn-by-turn · fit route
- Copy coords · Google · clear pin · offline estimate

Rendering stays Mapbox. Google is used for Street View embeds and outbound Maps links (no Google JS SDK).

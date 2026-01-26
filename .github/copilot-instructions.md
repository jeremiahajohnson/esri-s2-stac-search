# AI Coding Agent Instructions for esri-s2-stac-search

## Project Overview
Web-based satellite imagery viewer combining ArcGIS Maps SDK, STAC API (Sentinel-2), and Cloud Optimized GeoTIFFs. Users search by date/map extent, then view RGB composites with cloud cover indicators on an interactive timeline.

## Architecture & Data Flow

**Three-tier design:**
1. **Backend** (`server.js`): Express CORS proxy for S3 COG requests - only routes through `/sentinel-proxy/cog?url=...` with Range header forwarding for tile requests
2. **Frontend** (`public/app.js`): Esri ArcGIS with URL interceptor rewriting S3 URLs to proxy endpoints
3. **Data**: STAC API searches `sentinel-2-c1-l2a` collection at earth-search.aws.element84.com, returns features with asset HREFs

**Critical flow:**
- Map extent change → auto-triggers `searchSentinel2()` 
- STAC API returns features with datetime + `eo:cloud_cover` property
- Timeline renders circles (blue ≤30% cloud, grey >30%) → click to `selectScene(index)`
- `displayImagery()` chooses visual asset OR builds RGB composite via three ImageryTileLayers with pixel filters
- All S3 requests intercepted and proxied via URL rewrite interceptor

## Key Implementation Patterns

### CORS Proxy Pattern
- Range header forwarding is critical for COG tile requests (partial byte ranges)
- Accept-Ranges response header required to signal COG support
- No custom authentication - relies on S3 public bucket access

### Esri SDK Usage Conventions
- AMD loader (`require([...])`) for module imports at script start
- All UI interactions exposed as `window.` functions for HTML onclick handlers
- URL interceptor registered at app startup, catches ALL S3 URLs via regex pattern
- `esriConfig.apiKey` set early from `CONFIG.esriApiKey` (injected from config.js)
- Projection used to convert Web Mercator extent to WGS84 for STAC bbox

### Sentinel-2 Asset Handling
- If `assets.visual` exists: use directly
- Else if `assets.rendered_preview` exists: use as fallback  
- Else build RGB from individual band HREFs: `assets.red|B04|b04`, etc.
- Each band requires pixelFilter to normalize 12-bit values (max 3000) to 8-bit RGBA
- Blue layer uses `blendMode: "screen"` for proper channel mixing

## Critical Files & Responsibilities

- [server.js](server.js): CORS proxy + static file serving - modify if S3 region or authentication changes
- [public/app.js](public/app.js): Core app logic - search, timeline, imagery display; URL interceptor must match S3 patterns
- [public/index.html](public/index.html): DOM structure; search panel + timeline + map container
- [public/config.js](public/config.js): API key injection (gitignored) - must match template in config.example.js
- [public/styles.css](public/styles.css): Timeline styling + loading overlay

## Developer Workflows

**Local development:**
```bash
npm install
cp public/config.example.js public/config.js  # Add Esri API key
npm start  # Runs Express on :3000, serves static files + proxy
```

**Testing:** Open http://localhost:3000, map loads centered on LA, search auto-triggers, timeline appears with scenes

**Debugging CORS issues:** Check server.js proxy route is returning correct headers; verify S3 URL regex in URL interceptor matches actual asset URLs

## Project-Specific Patterns to Avoid

- ❌ Don't use RasterFunction for RGB composites - use GroupLayer with three ImageryTileLayers (Esri limitation for GeoTIFF)
- ❌ Don't hardcode cloud cover threshold (30%) - already externalized as `currentCloudCoverThreshold` variable
- ❌ Don't call STAC API directly from client without proxy setup - currently works because STAC endpoint allows CORS
- ❌ Don't modify Range header forwarding in proxy - critical for tile-based COG access

## Common Integration Points

- **Map extent changes**: Watched via `view.watch('extent', ...)` - currently triggers auto-search if center moved >20% of width
- **Scene selection**: Calls `selectScene(index)` → `displayImagery(feature)` with async layer loading
- **Layer lifecycle**: New layers added via `map.layers.add()`, old layer removed with `map.remove()` before adding new
- **Loading state**: `showLoading()` / `hideLoading()` manage overlay visibility during async operations

## External Dependencies

- **ArcGIS Maps SDK 4.31**: Loaded from CDN in index.html; provides Map, MapView, ImageryTileLayer, GroupLayer, Graphic, projection utilities
- **STAC API**: earth-search.aws.element84.com v1/search - POST endpoint expects bbox, datetime, collections array
- **AWS S3**: Public Sentinel-2 COG buckets - accessed through proxy to bypass CORS; requires Range header support
- **Express 4.18.2**: Lightweight proxy and static server

## Security Notes

- Client-side API key visible to users - mitigate via Esri key restrictions (HTTP referrer, service whitelist)
- S3 COGs are public; no authentication on proxy endpoint
- For production: move API key to backend environment variable, add auth to proxy endpoint if needed

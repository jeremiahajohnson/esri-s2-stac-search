# Development Notes: Sentinel-2 Imagery Viewer

## Project Overview

This project is a web-based satellite imagery viewer that allows users to search and visualize Sentinel-2 satellite data using the ArcGIS Maps SDK for JavaScript. The application queries imagery through the STAC API and displays Cloud Optimized GeoTIFFs (COGs) directly from AWS S3.

## How Claude Code Supported Development

This application was built entirely with assistance from Claude Code, an AI-powered coding assistant. Claude Code helped with:

- **Architecture Planning** - Researching STAC API, ArcGIS SDK capabilities, and designing the implementation approach
- **Code Writing** - Implementing all HTML, CSS, and JavaScript code
- **Problem Solving** - Debugging CORS issues, choosing the right ArcGIS components, and optimizing the UI
- **Iterative Refinement** - Making multiple UI adjustments based on user feedback
- **Best Practices** - Setting up proper API key management and security

## Development Timeline

### Phase 1: Research & Planning

**Goal**: Understand how to integrate Sentinel-2 imagery with ArcGIS Maps SDK

**Claude Code Actions**:
- Researched STAC API documentation and endpoints
- Investigated ArcGIS ImageryTileLayer and COG support
- Explored RasterFunction vs. GroupLayer approaches for RGB composites
- Created implementation plan with technical considerations

**Key Decisions**:
- Use earth-search.aws.element84.com STAC API for Sentinel-2 data
- Use `ImageryTileLayer` for displaying COG files
- Use `GroupLayer` with three `ImageryTileLayer` instances for RGB composites (not RasterFunction, which is designed for single image services)
- Implement CORS proxy server for S3 requests

### Phase 2: Core Implementation

**Goal**: Build basic STAC search and imagery display functionality

**Files Created**:
- `public/index.html` - HTML structure
- `public/styles.css` - Styling
- `public/app.js` - Application logic
- `server.js` - Express server with CORS proxy

**Key Features Implemented**:

1. **Map Setup**
   - ArcGIS MapView with topographic basemap
   - Centered on Los Angeles (-118.805, 34.027)
   - Zoom level 13

2. **STAC API Integration**
   ```javascript
   // Query Sentinel-2 Collection 1 L2A
   fetch('https://earth-search.aws.element84.com/v1/search', {
     method: 'POST',
     body: JSON.stringify({
       collections: ['sentinel-2-c1-l2a'],
       bbox: [xmin, ymin, xmax, ymax],
       datetime: `${startDate}/${endDate}`,
       limit: 100
     })
   })
   ```

3. **CORS Proxy Server**
   - Express server intercepts S3 COG requests
   - Forwards Range headers for tile requests
   - Adds CORS headers to responses
   - Critical for accessing S3 files from browser

4. **RGB Composite Display**
   - Three separate `ImageryTileLayer` instances for Red, Green, Blue bands
   - PixelFilter to normalize 16-bit reflectance values to 8-bit RGB
   - Screen blend mode for additive color mixing
   - Fallback to visual asset if individual bands unavailable

5. **Timeline Visualization**
   - Horizontal scrollable timeline with scenes positioned by date
   - Date markers distributed across the timeline
   - Circle indicators for each scene
   - Hover tooltips with scene metadata

6. **Search Panel**
   - Date range inputs (default: last 30 days)
   - Search button to trigger STAC query
   - Uses current map extent as bounding box

### Phase 3: UI Refinement (Multiple Iterations)

**Goal**: Improve user experience through iterative design feedback

**Iteration 1: Remove Auto-Zoom**
- **User Request**: "do not zoom to extents when clicking on a scene from the timeline"
- **Claude Code Action**: Removed `view.goTo()` calls from `displayImagery` function
- **Result**: Scenes display at current zoom level without disrupting user's view

**Iteration 2: Code Organization**
- **User Request**: "simplify the code by removing any lines that are not currently used by the front end. separate the CSS, HTML, and JS into their own files"
- **Claude Code Actions**:
  - Split monolithic 900+ line HTML file into three separate files
  - Removed unused functions and variables
  - Created clean separation of concerns
- **Result**:
  - `index.html` - 56 lines (structure only)
  - `styles.css` - 230+ lines (all styling)
  - `app.js` - 475+ lines (all logic)

**Iteration 3: Add Location Search**
- **User Request**: "add a location search bar to the upper left"
- **Claude Code Actions**:
  - Added ArcGIS Search widget import
  - Created search widget instance
  - Added to view UI at top-left position
- **Result**: Users can search for locations using ArcGIS geocoding

**Iteration 4: Bottom Panel Reorganization**
- **User Request**: "I want all the search elements to be cleanly located on the bottom to the left of the timeline. remove the floating search element. remove the 'zoom to image source resolution' button"
- **Claude Code Actions**:
  - Moved search panel from top-right to bottom-left
  - Removed floating panel functionality
  - Removed zoom button and related code
  - Timeline starts at `left: 350px` to accommodate search panel
  - Both panels share `bottom: 0` and `height: 120px`
- **Result**: Clean unified bottom bar with search on left, timeline on right

**Iteration 5: Cloud Cover Labels & UI Polish**
- **User Request**: "search box should be same height as the timeline element. remove the blue header. reduce the font size of the date search. remove max cloud cover slider and instead, put the cloud cover percentage as labels on each scene circle"
- **Claude Code Actions**:
  - Removed panel header div completely
  - Changed to horizontal flexbox layout with button below dates
  - Removed cloud cover slider, fixed threshold to 30%
  - Added cloud cover percentage labels directly on timeline circles
  - Reduced font sizes across the board (labels: 11px, inputs: 12px)
  - Added `padding-bottom: 10px` to timeline for label space
- **Result**:
  - Compact, unified bottom bar
  - Cloud cover clearly visible on each circle
  - Color scheme: grey (>30%), blue (≤30%), green (selected)

**Iteration 6: Vertical Search Layout**
- **User Request**: "search box and timeline are not the same height. move the search button to below the date search. remove the timeline title"
- **Claude Code Actions**:
  - Changed panel-content to vertical flexbox layout
  - Dates remain side-by-side, button below spans full width
  - Removed timeline header div and CSS
  - Removed code that updated header text
  - Removed border between panels
  - Adjusted timeline padding and element positions
- **Result**: True unified 120px bar with perfect alignment

**Iteration 7: Unified Visual Bar**
- **User Request**: "search panel and timeline are still not the same height. find a way to make it visually one single bar at the bottom of the screen"
- **Claude Code Actions**:
  - Removed `border-right` from search panel
  - Removed extra `padding-bottom` from timeline
  - Reduced timeline padding from 20px to 15px
  - Adjusted vertical positions of timeline elements (axis, scenes, dates)
- **Result**: Seamless single bar appearance at bottom

### Phase 4: Polish & Deployment Prep

**Feature 1: Auto-Search on Load**
- **User Request**: "great. now perform the first search on load"
- **Claude Code Action**: Added `searchSentinel2()` call in `view.when()` after initialization
- **Result**: Timeline populated immediately when app loads

**Feature 2: API Key Protection**
- **User Request**: "if I were to push this code to github, how do I protect my API key?"
- **Claude Code Actions**:
  - Created `public/config.js` with actual API key (gitignored)
  - Created `public/config.example.js` as template for other developers
  - Updated `.gitignore` to exclude `public/config.js`
  - Modified `app.js` to use `CONFIG.esriApiKey`
  - Added config.js script tag to HTML before app.js
  - Created comprehensive README.md with setup instructions
  - Documented security best practices for client-side API keys
- **Result**: API key protected from version control, easy setup for collaborators

## Technical Architecture

### Frontend Stack
- **ArcGIS Maps SDK for JavaScript 4.31** - Mapping library
- **Vanilla JavaScript** - No frameworks, AMD module pattern
- **CSS3** - Flexbox layouts, fixed positioning
- **HTML5** - Semantic structure

### Backend Stack
- **Node.js + Express** - Web server
- **HTTPS module** - Proxy requests to S3

### Data Sources
- **STAC API**: earth-search.aws.element84.com/v1/search
- **Sentinel-2 Collection**: sentinel-2-c1-l2a (Level 2A, Cloud Optimized)
- **COG Storage**: AWS S3 buckets

### Key Technical Patterns

**1. S3 URL Interception**
```javascript
esriConfig.request.interceptors.push({
  urls: /^https:\/\/.*\.s3\..*\.amazonaws\.com\//,
  before(request) {
    request.url = `http://localhost:3000/sentinel-proxy/cog?url=${encodeURIComponent(request.url)}`;
  }
});
```

**2. RGB Composite with PixelFilters**
```javascript
const redLayer = new ImageryTileLayer({
  url: redUrl,
  pixelFilter: function(pixelData) {
    const maxValue = 3000;
    for (let i = 0; i < numPixels; i++) {
      r[i] = Math.min(255, Math.max(0, (band[i] / maxValue) * 255));
      g[i] = 0;
      b[i] = 0;
    }
  }
});
```

**3. Coordinate System Conversion**
```javascript
// Convert Web Mercator map extent to WGS84 for STAC query
const wgs84Extent = projection.project(extent, new SpatialReference({ wkid: 4326 }));
const bbox = [wgs84Extent.xmin, wgs84Extent.ymin, wgs84Extent.xmax, wgs84Extent.ymax];
```

**4. Auto-Search with Debouncing**
```javascript
view.watch('extent', (newExtent) => {
  if (lastSearchExtent) {
    const distance = calculateDistance(newExtent.center, lastSearchExtent.center);
    if (distance > newExtent.width * 0.2) {
      searchSentinel2(); // Only search if moved significantly
    }
  }
});
```

## Challenges & Solutions

### Challenge 1: CORS Issues with S3 COG Files
**Problem**: Browser can't directly request COG tiles from S3 due to CORS restrictions

**Solution**:
- Built Express proxy server that intercepts S3 requests
- Forwards Range headers (critical for COG tile requests)
- Adds appropriate CORS headers to responses
- Uses URL interception at ArcGIS config level

### Challenge 2: RasterFunction vs. GroupLayer
**Problem**: Initially unclear whether to use RasterFunction's CompositeBand or GroupLayer

**Research Finding**:
- RasterFunction/CompositeBand works with single image service URLs and band indices like "$4", "$3", "$2"
- Not designed for combining multiple separate COG file URLs
- GroupLayer with three ImageryTileLayers is the correct pattern

**Solution**: Use GroupLayer with individual band layers and pixelFilters

### Challenge 3: 16-bit to 8-bit Conversion
**Problem**: Sentinel-2 bands are 16-bit reflectance values, need 8-bit RGB for display

**Solution**:
- PixelFilter normalizes values: `(value / 3000) * 255`
- MaxValue of 3000 chosen empirically for good brightness
- Clamp to 0-255 range with Math.min/Math.max

### Challenge 4: Unified Bottom Bar Layout
**Problem**: Search panel and timeline needed to appear as single seamless bar

**Solution** (multiple iterations):
- Remove border between panels
- Ensure exact same height (120px)
- Align both to `bottom: 0`
- Remove extra padding
- Adjust internal element positioning
- Share same top border style and shadow

## File Structure

```
esri-s2-stac-search/
├── public/
│   ├── index.html          # HTML structure (56 lines)
│   ├── styles.css          # Styling (231 lines)
│   ├── app.js              # Logic (478 lines)
│   ├── config.js           # API key (gitignored)
│   └── config.example.js   # Config template (for GitHub)
├── server.js               # Express server (91 lines)
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies
├── README.md               # Setup instructions
└── Notes.md                # This file
```

## Key Features

1. **STAC API Search** - Query Sentinel-2 imagery by date range and map extent
2. **Timeline Visualization** - Chronological scene display with cloud cover indicators
3. **RGB Composite Display** - True color imagery from individual band COGs
4. **Cloud Cover Filtering** - Fixed 30% threshold with visual indicators
5. **Auto-Search** - Automatic search on map pan/zoom (with debouncing)
6. **Location Search** - ArcGIS geocoding widget
7. **Preview Polygons** - Hover over timeline to see scene footprint
8. **Loading States** - Full-screen overlay during imagery load
9. **Scene Metadata** - Hover tooltips with date and cloud cover info
10. **Initial Search** - Automatic search on page load

## Security Implementation

### API Key Management
- API key stored in `public/config.js` (gitignored)
- Template file `config.example.js` committed to repository
- Loaded via script tag before main application
- README documents setup process

### Recommended Security Measures
1. Set referrer restrictions on Esri API key
2. Enable only necessary services
3. Monitor usage in Esri dashboard
4. Rotate keys periodically
5. For production: move key to backend service

## Future Enhancements (Not Implemented)

Some ideas that were discussed in planning but not implemented:

1. **Band Combination Selector** - Switch between RGB, False Color, NDVI, Agriculture
2. **Cloud Cover Slider** - Adjustable threshold (currently fixed at 30%)
3. **Scene Zoom** - Zoom to scene extent on selection (removed per user request)
4. **Scene Details Panel** - Expanded metadata display
5. **Export Functionality** - Download scene data or screenshots
6. **Comparison Mode** - Side-by-side scene comparison
7. **Animation** - Timelapse of scenes over time

## Lessons Learned

1. **Start with Research** - Understanding STAC API and ArcGIS capabilities upfront saved time
2. **Iterate on UI** - Multiple small refinements led to polished final design
3. **Keep It Simple** - Avoided over-engineering (e.g., didn't need complex state management)
4. **Document as You Go** - README and config template make project shareable
5. **Security First** - API key protection from the start prevents accidents

## Development Time

Approximate time investment:
- **Research & Planning**: 1-2 hours
- **Core Implementation**: 3-4 hours
- **UI Refinement**: 2-3 hours (multiple iterations)
- **Polish & Documentation**: 1 hour
- **Total**: ~7-10 hours

Note: All development done with Claude Code assistance, which significantly accelerated:
- Research (instant access to documentation)
- Code writing (full files generated)
- Debugging (Claude Code identified issues quickly)
- Iteration (rapid implementation of feedback)

## Conclusion

This project demonstrates how Claude Code can accelerate full-stack development by:
- Providing instant research and documentation
- Writing complete, working code
- Iterating quickly on user feedback
- Following best practices for security and code organization
- Creating comprehensive documentation

The result is a production-ready satellite imagery viewer built entirely through AI-assisted development, with clean architecture, proper security measures, and a polished user interface.

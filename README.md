# Esri Sentinel-2 Imagery Viewer

A web application for viewing Sentinel-2 satellite imagery using the ArcGIS Maps SDK for JavaScript and STAC API.

## Features

- Search Sentinel-2 imagery by date range and map extent
- Timeline visualization with cloud cover indicators
- Color-coded circles: blue (≤30% cloud), grey (>30% cloud), green (selected)
- RGB composite imagery display using Cloud Optimized GeoTIFFs (COG)
- Auto-search on map extent changes
- Location search using ArcGIS Search widget

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API Key

Copy the example config file and add your Esri API key:

```bash
cp public/config.example.js public/config.js
```

Then edit `public/config.js` and replace `YOUR_ESRI_API_KEY_HERE` with your actual API key.

**Get an API key:**
1. Visit [ArcGIS Developers](https://developers.arcgis.com/)
2. Sign in or create an account
3. Go to your dashboard and create a new API key
4. Configure key restrictions (recommended):
   - Add referrer restrictions (e.g., `http://localhost:3000/*`)
   - Enable only required services

### 3. Run the server

```bash
npm start
```

The application will be available at `http://localhost:3000`

## Project Structure

```
esri-s2-stac-search/
├── public/
│   ├── index.html          # Main HTML structure
│   ├── styles.css          # Styling
│   ├── app.js              # Application logic
│   ├── config.js           # API configuration (gitignored)
│   └── config.example.js   # Config template
├── server.js               # Express server with CORS proxy
├── .gitignore              # Git ignore rules
└── package.json            # Dependencies
```

## Security Notes

### Client-Side API Keys

**Important:** This application uses a client-side API key, which means it will be visible in the browser. While we've moved it to a separate file and added it to `.gitignore`, the key is still exposed to users.

**Best practices:**
1. ✅ Use API key restrictions on the Esri developer portal
2. ✅ Restrict by HTTP referrer (domain)
3. ✅ Enable only necessary services
4. ✅ Monitor usage in your Esri dashboard
5. ✅ Rotate keys periodically

### For Production

For production deployments, consider:
- Moving the API key to a backend service
- Using environment variables
- Implementing authentication/authorization
- Using a server-side proxy for all API calls

## Technologies

- **ArcGIS Maps SDK for JavaScript** - Mapping and visualization
- **STAC API** - Sentinel-2 imagery search (earth-search.aws.element84.com)
- **Express** - CORS proxy server for S3 COG files
- **Sentinel-2 Collection 1 L2A** - Satellite imagery

## License

MIT

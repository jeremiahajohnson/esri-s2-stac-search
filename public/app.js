require([
  "esri/config",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/ImageryTileLayer",
  "esri/layers/GraphicsLayer",
  "esri/geometry/Polygon",
  "esri/Graphic",
  "esri/geometry/projection",
  "esri/geometry/SpatialReference",
  "esri/widgets/Search"
], function(esriConfig, Map, MapView, ImageryTileLayer, GraphicsLayer, Polygon, Graphic, projection, SpatialReference, Search) {

  // Set API key from config
  esriConfig.apiKey = CONFIG.esriApiKey;

  // Configure URL rewrite interceptor for ALL S3 requests
  esriConfig.request.interceptors.push({
    urls: /^https:\/\/.*\.s3\..*\.amazonaws\.com\//,
    before(request) {
      const originalUrl = request.url;
      const proxyUrl = `http://localhost:3000/sentinel-proxy/cog?url=${encodeURIComponent(originalUrl)}`;
      console.log('Interceptor rewriting S3 URL:', originalUrl.substring(0, 100) + '...');
      request.url = proxyUrl;
    }
  });

  // Create map
  const map = new Map({
    basemap: "arcgis/topographic"
  });

  // Global variables
  let currentLayer = null;
  let currentFeatures = [];
  let selectedFeature = null;
  let previewGraphicsLayer = null;
  let lastSearchExtent = null;
  let currentCloudCoverThreshold = 30;

  // Create graphics layer for preview polygons
  previewGraphicsLayer = new GraphicsLayer({
    id: 'preview-layer'
  });
  map.add(previewGraphicsLayer);

  // Create MapView
  const view = new MapView({
    container: "viewDiv",
    map: map,
    center: [-118.805, 34.027],
    zoom: 13
  });

  // Add search widget to upper left
  const searchWidget = new Search({
    view: view
  });
  view.ui.add(searchWidget, {
    position: "top-left",
    index: 0
  });

  // Loading overlay functions
  window.showLoading = function(message = 'Loading imagery...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    text.textContent = message;
    overlay.classList.add('visible');
  };

  window.hideLoading = function() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.remove('visible');
  };

  // Initialize
  view.when(async () => {
    await projection.load();

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    document.getElementById('endDate').value = today.toISOString().split('T')[0];
    document.getElementById('startDate').value = thirtyDaysAgo.toISOString().split('T')[0];

    // Auto-search when map extent changes
    view.watch('extent', (newExtent) => {
      if (lastSearchExtent) {
        const extentCenter = newExtent.center;
        const lastCenter = lastSearchExtent.center;
        const distance = Math.sqrt(
          Math.pow(extentCenter.x - lastCenter.x, 2) +
          Math.pow(extentCenter.y - lastCenter.y, 2)
        );
        if (distance > newExtent.width * 0.2) {
          console.log('Map extent changed significantly, auto-searching...');
          searchSentinel2();
        }
      }
    });

    // Perform initial search
    searchSentinel2();
  });

  // Search Sentinel-2 imagery
  window.searchSentinel2 = async function() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const searchBtn = document.getElementById('searchBtn');

    if (!startDate || !endDate) {
      console.warn('No start or end date selected');
      return;
    }

    currentCloudCoverThreshold = 30;

    const extent = view.extent;
    lastSearchExtent = extent;

    const wgs84Extent = projection.project(extent, new SpatialReference({ wkid: 4326 }));
    const bbox = [wgs84Extent.xmin, wgs84Extent.ymin, wgs84Extent.xmax, wgs84Extent.ymax];

    console.log('Map extent (Web Mercator):', extent);
    console.log('Converted extent (WGS84):', wgs84Extent);
    console.log('STAC bbox:', bbox);

    document.getElementById('timelineContainer').classList.remove('visible');

    searchBtn.disabled = true;

    try {
      const response = await fetch('https://earth-search.aws.element84.com/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          collections: ['sentinel-2-c1-l2a'],
          bbox: bbox,
          datetime: `${startDate}T00:00:00Z/${endDate}T23:59:59Z`,
          limit: 100,
          sortby: [
            {
              field: 'properties.datetime',
              direction: 'desc'
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      currentFeatures = data.features || [];

      currentFeatures.sort((a, b) => {
        return new Date(b.properties.datetime) - new Date(a.properties.datetime);
      });

      if (currentFeatures.length === 0) {
        console.log('No results found');
        document.getElementById('timelineContainer').classList.remove('visible');
      } else {
        const matchingCount = currentFeatures.filter(f =>
          f.properties['eo:cloud_cover'] !== undefined &&
          f.properties['eo:cloud_cover'] <= currentCloudCoverThreshold
        ).length;
        console.log(`Found ${currentFeatures.length} scenes total (${matchingCount} match cloud cover ≤${currentCloudCoverThreshold}%)`);
        buildTimeline(currentFeatures);
        document.getElementById('timelineContainer').classList.add('visible');
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      searchBtn.disabled = false;
    }
  };

  // Show preview polygon
  function showPreviewPolygon(feature) {
    previewGraphicsLayer.removeAll();

    const bbox = feature.bbox;
    const polygon = new Polygon({
      rings: [[
        [bbox[0], bbox[1]],
        [bbox[2], bbox[1]],
        [bbox[2], bbox[3]],
        [bbox[0], bbox[3]],
        [bbox[0], bbox[1]]
      ]],
      spatialReference: { wkid: 4326 }
    });

    const graphic = new Graphic({
      geometry: polygon,
      symbol: {
        type: "simple-fill",
        color: [128, 128, 128, 0],
        outline: {
          color: [128, 128, 128, 0.8],
          width: 2
        }
      }
    });

    previewGraphicsLayer.add(graphic);
  }

  // Hide preview polygon
  function hidePreviewPolygon() {
    previewGraphicsLayer.removeAll();
  }

  // Build timeline visualization
  function buildTimeline(features) {
    const timeline = document.getElementById('timeline');

    const existingScenes = timeline.querySelectorAll('.timeline-scene, .timeline-date');
    existingScenes.forEach(el => el.remove());

    if (features.length === 0) return;

    const dates = features.map(f => new Date(f.properties.datetime));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const dateRange = maxDate - minDate;

    const minWidth = Math.max(1200, features.length * 100);
    timeline.style.width = minWidth + 'px';

    const numDateMarkers = Math.floor(minWidth / 150);
    for (let i = 0; i <= numDateMarkers; i++) {
      const fraction = i / numDateMarkers;
      const markerDate = new Date(minDate.getTime() + dateRange * fraction);
      const position = 50 + (minWidth - 100) * fraction;

      const dateMarker = document.createElement('div');
      dateMarker.className = 'timeline-date';
      dateMarker.style.left = position + 'px';
      dateMarker.textContent = markerDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timeline.appendChild(dateMarker);
    }

    features.forEach((feature, index) => {
      const sceneDate = new Date(feature.properties.datetime);
      const fraction = dateRange > 0 ? (sceneDate - minDate) / dateRange : 0;
      const position = 50 + (minWidth - 100) * fraction;

      const sceneEl = document.createElement('div');
      sceneEl.className = 'timeline-scene';
      sceneEl.style.left = (position - 16) + 'px';
      sceneEl.id = `timeline-scene-${index}`;
      sceneEl.onclick = () => selectScene(index);

      sceneEl.addEventListener('mouseenter', () => {
        showPreviewPolygon(feature);
      });
      sceneEl.addEventListener('mouseleave', () => {
        hidePreviewPolygon();
      });

      const cloudCover = feature.properties['eo:cloud_cover'];
      const matchesCriteria = cloudCover !== undefined && cloudCover <= currentCloudCoverThreshold;

      const circle = document.createElement('div');
      circle.className = 'timeline-scene-circle';
      if (!matchesCriteria) {
        circle.classList.add('high-cloud');
      }
      sceneEl.appendChild(circle);

      // Add cloud cover label
      const cloudLabel = document.createElement('div');
      cloudLabel.className = 'cloud-cover-label';
      const cloudCoverText = cloudCover !== undefined ? Math.round(cloudCover) : 'N/A';
      cloudLabel.textContent = `${cloudCoverText}%`;
      sceneEl.appendChild(cloudLabel);

      const info = document.createElement('div');
      info.className = 'timeline-scene-info';
      const matchText = matchesCriteria ? '✓ ≤30% cloud' : '✗ >30% cloud';
      info.innerHTML = `
        <div><strong>${sceneDate.toLocaleDateString()}</strong></div>
        <div>Cloud: ${cloudCoverText}%</div>
        <div style="font-size: 10px; color: ${matchesCriteria ? '#0079c1' : '#999'};">${matchText}</div>
      `;
      sceneEl.appendChild(info);

      timeline.appendChild(sceneEl);
    });
  }

  // Select and display a scene
  window.selectScene = function(index) {
    document.querySelectorAll('.timeline-scene').forEach(item => {
      item.classList.remove('selected');
    });

    const timelineEl = document.getElementById(`timeline-scene-${index}`);
    if (timelineEl) {
      timelineEl.classList.add('selected');
      const container = document.getElementById('timelineContainer');
      const sceneLeft = parseInt(timelineEl.style.left);
      container.scrollLeft = sceneLeft - container.clientWidth / 2 + 16;
    }

    selectedFeature = currentFeatures[index];

    hidePreviewPolygon();

    displayImagery(selectedFeature);
  };

  // Display imagery on map
  async function displayImagery(feature) {
    showLoading('Loading imagery...');

    if (currentLayer) {
      map.remove(currentLayer);
    }

    const assets = feature.assets;
    console.log('Available assets:', Object.keys(assets));

    let imageUrl = null;
    if (assets.visual && assets.visual.href) {
      imageUrl = assets.visual.href;
      console.log('Using visual asset:', imageUrl);
    } else if (assets.rendered_preview && assets.rendered_preview.href) {
      imageUrl = assets.rendered_preview.href;
      console.log('Using rendered_preview asset:', imageUrl);
    } else {
      console.log('No visual asset found, will create RGB composite');
    }

    try {
      if (imageUrl) {
        currentLayer = new ImageryTileLayer({
          url: imageUrl,
          title: 'Sentinel-2 True Color'
        });
      } else {
        require(["esri/layers/GroupLayer"], function(GroupLayer) {
          const redUrl = (assets.red || assets.B04 || assets.b04)?.href;
          const greenUrl = (assets.green || assets.B03 || assets.b03)?.href;
          const blueUrl = (assets.blue || assets.B02 || assets.b02)?.href;

          if (!redUrl || !greenUrl || !blueUrl) {
            hideLoading();
            alert('Unable to find RGB bands for this scene');
            return;
          }

          console.log('Creating RGB composite from:', { red: redUrl, green: greenUrl, blue: blueUrl });

          const redLayer = new ImageryTileLayer({
            url: redUrl,
            title: 'Red',
            pixelFilter: function(pixelData) {
              const pixels = pixelData.pixelBlock.pixels;
              if (!pixels || pixels.length < 1) return;
              const band = pixels[0];
              const numPixels = pixelData.pixelBlock.width * pixelData.pixelBlock.height;
              const r = new Uint8Array(numPixels);
              const g = new Uint8Array(numPixels);
              const b = new Uint8Array(numPixels);
              const maxValue = 3000;
              for (let i = 0; i < numPixels; i++) {
                r[i] = Math.min(255, Math.max(0, (band[i] / maxValue) * 255));
                g[i] = 0;
                b[i] = 0;
              }
              pixelData.pixelBlock.pixels = [r, g, b];
              pixelData.pixelBlock.pixelType = "u8";
            }
          });

          const greenLayer = new ImageryTileLayer({
            url: greenUrl,
            title: 'Green',
            blendMode: "screen",
            pixelFilter: function(pixelData) {
              const pixels = pixelData.pixelBlock.pixels;
              if (!pixels || pixels.length < 1) return;
              const band = pixels[0];
              const numPixels = pixelData.pixelBlock.width * pixelData.pixelBlock.height;
              const r = new Uint8Array(numPixels);
              const g = new Uint8Array(numPixels);
              const b = new Uint8Array(numPixels);
              const maxValue = 3000;
              for (let i = 0; i < numPixels; i++) {
                r[i] = 0;
                g[i] = Math.min(255, Math.max(0, (band[i] / maxValue) * 255));
                b[i] = 0;
              }
              pixelData.pixelBlock.pixels = [r, g, b];
              pixelData.pixelBlock.pixelType = "u8";
            }
          });

          const blueLayer = new ImageryTileLayer({
            url: blueUrl,
            title: 'Blue',
            blendMode: "screen",
            pixelFilter: function(pixelData) {
              const pixels = pixelData.pixelBlock.pixels;
              if (!pixels || pixels.length < 1) return;
              const band = pixels[0];
              const numPixels = pixelData.pixelBlock.width * pixelData.pixelBlock.height;
              const r = new Uint8Array(numPixels);
              const g = new Uint8Array(numPixels);
              const b = new Uint8Array(numPixels);
              const maxValue = 3000;
              for (let i = 0; i < numPixels; i++) {
                r[i] = 0;
                g[i] = 0;
                b[i] = Math.min(255, Math.max(0, (band[i] / maxValue) * 255));
              }
              pixelData.pixelBlock.pixels = [r, g, b];
              pixelData.pixelBlock.pixelType = "u8";
            }
          });

          currentLayer = new GroupLayer({
            title: 'Sentinel-2 True Color',
            layers: [blueLayer, greenLayer, redLayer]
          });

          map.layers.add(currentLayer);

          currentLayer.when(() => {
            console.log('✓ RGB composite ready');
            hideLoading();
          }).catch((error) => {
            console.error('✗ Layer failed:', error);
            hideLoading();
            alert('Failed to load imagery: ' + error.message);
          });
        });
        return;
      }

      map.layers.add(currentLayer);

      currentLayer.when(() => {
        console.log('✓ Layer ready');
        hideLoading();
      }).catch((error) => {
        console.error('✗ Layer failed:', error);
        hideLoading();
        alert('Failed to load imagery: ' + error.message);
      });

    } catch (error) {
      console.error('Error creating/displaying imagery:', error);
      hideLoading();
      alert('Error displaying imagery: ' + error.message);
    }
  }

});

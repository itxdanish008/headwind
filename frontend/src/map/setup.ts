import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw'

// MapLibre 6 does not find its worker under Vite, and the dev server injects its HMR client
// into worker files, so hand it the untouched source as a Blob.
setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })))

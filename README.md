# Headwind

Headwind helps a truck driver pick a route by weather risk, load weight and travel time. You enter an origin, a destination, a departure time and a load. It asks a routing service for three truck routes, works out when the truck will reach each point along every route, checks the forecast for that hour, and recommends the route with the least weather risk.

The weather is checked for the hour the truck actually arrives, not for the hour it leaves. A storm that hits at 2 am only matters if you are there at 2 am.

## What is in the box

- A Django API that plans trips and talks to HERE (routing, geocoding) and Open-Meteo (weather).
- A React app with a landing page, a routes dashboard with a map, and a detail page for each route.
- Risk rules, ranking and time handling written as plain functions with unit tests.
- A corridor heatmap that loads once per trip and is scrubbed entirely in the browser.

The map also shows a forecast heatmap along the trip corridor, with a 0 to 48 hour slider. Dragging the slider or pressing play moves a truck marker along the selected route and recolours the corridor for that hour, without any network calls.

## Running it

You need a free HERE API key. Open-Meteo needs none. The key stays in the backend `.env` and never reaches the browser.

### With make.sh

```
./make.sh setup     # creates .env, installs backend and frontend dependencies
# put your key in .env as HERE_API_KEY=...
./make.sh start     # API on :8000, web app on :5173
```

Open http://localhost:5173. Other commands: `test`, `lint`, `check` (lint then test), `build`, `backend`, `frontend`, `clean`, `package` (a clean submission zip), `docker-build`, `docker-run`, `docker-stop`. Run `./make.sh help` for the list. It needs Python 3.12, Node 20 or newer, and npm.

### With Docker

```
./make.sh docker-run   # builds the image if needed, serves the app on http://localhost:8000
```

The image builds the frontend, installs the Python dependencies, and runs Django under gunicorn, which also serves the built app. Set `SECRET_KEY`, `HERE_API_KEY` and `ALLOWED_HOSTS` through the environment. By hand:

```
docker build -t headwind .
docker run --rm -p 8000:8000 --env-file .env -e DEBUG=0 -e SECRET_KEY=$(openssl rand -hex 32) headwind
```

### Deploying to Fly.io

`fly.toml` is included. With the Fly CLI installed and signed in:

```
fly launch --no-deploy --copy-config
fly secrets set SECRET_KEY=... HERE_API_KEY=... ALLOWED_HOSTS=your-app.fly.dev
fly deploy
```

It runs one small always-on machine, so the in-memory weather and route cache survives between requests. I have not deployed it from this machine, because that needs an account.

### Deploying to Vercel

The root `vercel.json` defines a Django backend service and a Vite frontend service. Import this repository from its root directory in Vercel. The frontend is public at `/`; the backend is public under `/api/*`, which matches the API paths used by the frontend and Django.

Set these environment variables in the Vercel project before deploying:

- `SECRET_KEY`: a unique production secret.
- `HERE_API_KEY`: your HERE API key, required for place search and route planning.
- `ALLOWED_HOSTS`: `.vercel.app` and your custom domain if you add one.

The frontend calls the backend from the browser through the shared `/api/*` path. The services do not make server-to-server calls, so no service binding is needed.

## Checks

```
./make.sh check
```

That runs ruff, mypy, tsc, ESLint and Prettier, then pytest and Vitest. Backend tests include `test_requirements.py`, which checks each line of the brief (three routes, sampling every 10, 25 or 50 miles, weather at the arrival time, the full risk table and load rules, the ranking order, the map payload, and the 48 hour heatmap).

## How a request flows

```
browser (React)
   |  POST /api/v1/plan
   v
planner/api/views.py        validates input (serializers.py), calls build_trip_planner().plan(...)
   v
planner/services.py         TripPlanner: geocoder, router and forecaster are injected
   |-- providers/geocoding  place text to coordinates (HERE)
   |-- providers/routing    three truck routes with per-segment durations (HERE)
   |-- domain/sampling      checkpoints every 10, 25 or 50 miles
   |-- domain/eta           arrival time at each checkpoint, in UTC and local time
   |-- providers/weather    one batched forecast fetch for all checkpoints (Open-Meteo)
   |-- domain/risk          level and driver for each checkpoint
   `-- domain/ranking       route summaries, ordering and the one-line reason
   v
planner/types.py            a frozen TripPlan dataclass
   v
planner/api/serializers.py  rounds values and builds the JSON
```

`domain/` has no network or Django code, so the rules can be tested with plain inputs. `providers/` is the only place that makes HTTP calls. `TripPlanner` takes its collaborators in the constructor and `build_trip_planner()` is the one place that wires the real ones, so tests pass in fakes instead of patching modules. Layers exchange frozen dataclasses, not dicts, and rounding happens only in the serializer. Each failure has its own exception class in `planner/exceptions.py` (404 place not found, 422 no route, 400 bad departure, 502 provider down), and Django's cache holds provider responses, so there is no database.

The frontend keeps the whole trip in the URL, for example
`/routes/dallas-tx/denver-co?depart=2026-10-22T08:00&load=42000&sample=25`.
A link can be shared or refreshed and it replans from the same inputs. Route detail pages add `/route-b`.

## Risk rules

| | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | under 25 | 25 to 34 | 35 to 44 | 45 to 54 | 55 and up |
| Rain (in/hr) | under 0.10 | 0.10 to 0.25 | 0.25 to 0.50 | 0.50 to 1.00 | over 1.00 |
| Snow (in/hr) | under 0.5 | 0.5 to 1.0 | 1.0 to 2.0 | 2.0 to 3.0 | over 3.0 |

Load rules apply to wind only: 45 to 54 mph with more than 30,000 lb is No Travel, and 35 to 44 mph with more than 40,000 lb is Severe. A checkpoint takes the worst of the three conditions, and the app records which one drove the level.

Routes are ranked by No Travel miles, then Severe miles, then High miles, then average risk, then travel time. Average risk is weighted by distance. Miles are compared to the nearest tenth and average risk to two decimals so float noise never decides a tie.

## Where the brief was open, and what I chose

- **Shared range endpoints.** The table ranges touch (rain 0.10 to 0.25 and 0.25 to 0.50). The lower bound is inclusive and the upper bound exclusive, except the top of Severe, which is inclusive because No Travel is defined as strictly greater.
- **No Travel in the ranking.** Ranking by Severe miles alone would let a route with No Travel miles beat one with Severe miles. No Travel comes first instead. If every route has No Travel miles, the best one is still recommended, with a warning.
- **Which wind.** Sustained 10 m wind speed decides the level. Gusts are shown but not used.
- **Which rain and snow.** Rain is `rain + showers`. Snow is depth in inches per hour, not liquid equivalent. Open-Meteo is asked for inches and the response units are checked, so a silent unit change fails loudly.
- **Which hour of forecast.** Open-Meteo stamps precipitation with the end of its hour, so an arrival uses the first stamp at or after it. Wind is a point value and is interpolated between hours.
- **Arrival times.** They come from the routing service's per-segment durations, not from distance divided by an average speed. Times are computed in UTC and shown in each checkpoint's own timezone. Driver rest breaks are not modelled.
- **Mile attribution.** Each checkpoint covers the stretch from the midpoint with the previous checkpoint to the midpoint with the next, so covered miles add up to the route length.
- **Missing forecast.** If an arrival is past the forecast, that checkpoint is Unknown, excluded from averages and flagged. It is never treated as Low.
- **Fewer than three routes.** Provider routes that share more than 90 percent of their length with another are dropped. Missing slots are filled by routing through a point offset from the route midpoint (12.5 percent of the length, then 15 percent, on either side). A forced route is labelled as generated and is discarded if it is more than 1.5 times longer than the first route.
- **Load weight.** The load you enter is cargo. For routing, 33,000 lb for the tractor and trailer is added and the total is sent to HERE in kilograms. Cargo plus that tare must stay at or under 80,000 lb, so the form allows 1,000 to 47,000 lb. Risk rules use the cargo number as entered.
- **Departure window.** Now to 14 days ahead, checked in the browser and again in the API. The form works out "now" in the origin's timezone (from `/api/v1/place`), so the default time, the quick chips and the window are right even when the browser is in another timezone. The window is 14 days so a long trip leaving on the last day still falls inside the 16 day forecast.
- **Place search.** HERE returns its best guess even for nonsense. Matches scoring under 0.7 are treated as not found, so a typo like "Dalas, TX" still works and "zzzqqxx" does not.
- **Recommendation reason.** It names the first criterion that separates the winner from a rival. If another route ties on that criterion, a second sentence says what broke the tie.

## API

Everything is JSON and stateless, under `/api/v1/`.

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/plan` | Origin, destination, local departure time, cargo lb and interval. Returns three routes with checkpoints, a recommendation, a reason and warnings. |
| `POST /api/v1/corridor` | Route geometries and cargo lb. Returns a 49-hour grid of risk levels for the heatmap. |
| `GET /api/v1/geocode?q=` | Place suggestions for autocomplete. |
| `GET /api/v1/place?q=` | One place with coordinates and its IANA timezone. |
| `GET /api/health` | Liveness check. |

Errors come back as `{"detail": "..."}`: 400 for bad input, 404 when a place is not found, 422 when no truck route exists, 502 when a provider is down. Real responses are in `samples/`, and `postman/headwind.postman_collection.json` runs every endpoint, including the error cases, with assertions (`npx newman run postman/headwind.postman_collection.json`).

## How the heatmap stays smooth

`POST /api/v1/corridor` returns a grid of cells along all three routes and a risk level for each of the next 49 hours, as one flat array. The frontend builds a single GeoJSON fill layer with `h0` to `h48` properties on each cell. Changing the hour only swaps the layer's `fill-color` expression, so the data is never re-uploaded. The current hour lives in a small store outside React, which means dragging the slider does not re-render the map. The corridor is fetched once per trip and load, and changing only the sampling interval does not refetch it.

In a measured run in desktop Chrome, scrubbing 97 slider positions made no network calls, and five seconds of playback averaged 108 frames per second with no frame over 17 ms and no long tasks.

## Configuration

Settings come from environment variables with safe defaults. `.env.example` lists them: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `HERE_API_KEY`, `LOG_LEVEL`, and optional overrides such as `HERE_ROUTING_URL`, `HERE_GEOCODE_URL`, `HERE_AUTOCOMPLETE_URL`, `OPEN_METEO_URL`, `HTTP_TIMEOUT_S`, `MAX_DEPARTURE_DAYS`, `TRACTOR_TRAILER_TARE_LB` and `MAX_GROSS_LB`, so a provider can be swapped for a self-hosted one. The tunable numbers live in grouped dicts in `config/settings.py` (`ROUTING`, `WEATHER`, `VEHICLE`, `PLANNER`, `HTTP`). The app refuses to start with `DEBUG=0` and a placeholder secret.

## Caching and limits

Weather is cached for 30 minutes per coordinate rounded to 0.05 degrees, and fetched in concurrent batches of 100 locations. Routes are cached for an hour by trip and weight, so changing only the interval does not call the routing service again. A fresh trip costs roughly 400 weather locations. Against the Docker image with a fresh Chicago to Nashville trip, the first plan took 3.3 seconds, the same plan again 0.09 seconds, and changing only the interval 0.09 seconds. The corridor took 1.2 seconds cold and 0.06 seconds warm.

Open-Meteo's free tier allows 600 calls a minute and 10,000 a day, and it is for non-commercial use. Forecasts are requested for 16 days, so a departure up to 14 days out still has weather at the end of a long trip. It is credited in the app footer under CC BY 4.0. A production deployment needs a commercial plan or a self-hosted weather source.

## How the brief maps to the code

| Requirement | Where |
|---|---|
| Origin, destination, departure time, load | `TripForm`, `PlanRequest` serializer |
| Three route options from a routing API | `providers/routing.py`, with forced alternatives when HERE returns fewer |
| Weather every 10, 25 or 50 miles at the arrival time | `domain/sampling.py`, `domain/eta.py`, `services.plan_trip` |
| Risk table and load rules | `domain/risk.py` |
| Recommendation by Severe, High, average risk, then time | `domain/ranking.py` |
| Routes, checkpoints, risk, ETAs and summaries on a map | `RouteMap`, `RouteList`, `CheckpointPanel` |
| Heatmap with a 0 to 48 hour slider | `services.build_corridor`, `CorridorLayer`, `ForecastSlider` |

## Project layout

```
backend/
  config/            settings and URL routing
  planner/
    api/             views, request and response serializers, URL patterns
    domain/          geometry, sampling, eta, risk, ranking (pure functions)
    providers/       routing, geocoding, weather, shared HTTP client
    services.py      TripPlanner and build_trip_planner()
    types.py         frozen dataclasses passed between layers
    exceptions.py    one exception per failure, each with its HTTP status
    tests/           pytest, with recorded provider responses in fixtures/
  requirements.txt   runtime dependencies (requirements-dev.txt adds test tools)
samples/             real API responses, including error cases
postman/             a collection with assertions for every endpoint
frontend/
  src/
    api/             typed client and query hooks
    components/      form, route cards, map, inspector, pickers
    pages/           home, dashboard, route detail, not found
    map/             layer definitions and map setup
    lib/             formatting, colour, date and clock helpers
```

## Limitations

- The heatmap shows one risk level per 0.25 degree cell, about 17 miles, so it will miss weather smaller than that.
- Arrival times assume continuous driving.
- Forecast skill drops quickly after a few days, and the app shows whatever Open-Meteo returns.
- HERE and Open-Meteo free tiers cap how many fresh trips can be planned in a day.
- Only weight is sent for truck routing. Height, length and hazmat restrictions are not.
- The UI has been checked by hand and with scripted browser runs, but it has no automated component tests. Unit tests cover the domain logic, providers, the API and the frontend helpers.

## What I would do next

1. Test scrubbing on mid-range phones and real touch hardware.
2. Add truck dimensions and rest breaks to the planner.
3. Put a rate limit in front of `/api/v1/plan` to protect the provider quotas.
4. Add component tests for the form and picker.
5. Deploy the container and record a walkthrough.

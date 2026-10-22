import './HighwayScene.css'

export default function HighwayScene() {
  return (
    <div className="scene" aria-hidden="true" inert>
      <div className="scene-sky" />
      <svg className="scene-stars" width="100%" height="420">
        <circle className="hw-star" cx="6%" cy="60" r="1.2" />
        <circle className="hw-star" cx="14%" cy="140" r="1" style={{ animationDelay: '-1s' }} />
        <circle className="hw-star" cx="22%" cy="44" r="1.4" style={{ animationDelay: '-2s' }} />
        <circle className="hw-star" cx="31%" cy="98" r="1" />
        <circle className="hw-star" cx="43%" cy="30" r="1.2" style={{ animationDelay: '-0.5s' }} />
        <circle className="hw-star" cx="52%" cy="170" r="1" style={{ animationDelay: '-1.6s' }} />
        <circle className="hw-star" cx="61%" cy="72" r="1.3" />
        <circle className="hw-star" cx="70%" cy="20" r="1" style={{ animationDelay: '-2.4s' }} />
        <circle className="hw-star" cx="83%" cy="120" r="1.2" style={{ animationDelay: '-0.9s' }} />
        <circle className="hw-star" cx="92%" cy="52" r="1" />
        <circle className="hw-star" cx="97%" cy="190" r="1.3" style={{ animationDelay: '-1.3s' }} />
      </svg>

      <div className="scene-moon" />
      <div className="scene-sun" />
      <div className="scene-cloud scene-cloud-a" />
      <div className="scene-cloud scene-cloud-b" />
      <div className="scene-cloud scene-cloud-c" />

      <svg
        className="scene-mountains"
        viewBox="0 0 1440 340"
        preserveAspectRatio="none"
        width="100%"
        height="340"
      >
        <polygon
          fill="var(--mtn1)"
          points="0,340 0,190 90,150 170,190 260,96 330,150 410,120 520,40 600,120 690,90 780,150 860,70 960,140 1050,100 1140,160 1240,60 1330,130 1440,90 1440,340"
        />
        <polygon
          fill="var(--snow)"
          opacity=".55"
          points="520,40 548,66 536,64 526,76 512,60 500,62"
        />
        <polygon
          fill="var(--snow)"
          opacity=".55"
          points="1240,60 1266,86 1254,82 1242,94 1230,80 1218,84"
        />
        <polygon
          fill="var(--snow)"
          opacity=".45"
          points="860,70 884,94 872,90 862,100 852,88 842,92"
        />
        <polygon
          fill="var(--mtn2)"
          points="0,340 0,250 120,210 220,250 330,190 420,240 540,200 640,250 760,196 880,240 990,210 1110,250 1230,200 1340,236 1440,214 1440,340"
        />
        <polygon
          fill="var(--mtn3)"
          points="0,340 0,300 160,282 320,300 480,280 640,298 800,276 960,296 1120,280 1280,298 1440,284 1440,340"
        />
      </svg>

      <svg className="scene-gusts" width="100%" height="300">
        <path className="hw-gust" d="M-40 60 C 200 30, 380 90, 620 50 S 1000 20, 1500 70" />
        <path
          className="hw-gust"
          d="M-40 140 C 260 110, 460 170, 760 120 S 1180 100, 1500 150"
          style={{ animationDelay: '-1.6s', animationDuration: '5.4s' }}
        />
        <path
          className="hw-gust"
          d="M-40 220 C 300 200, 520 250, 820 210 S 1240 190, 1500 230"
          style={{ animationDelay: '-3s', animationDuration: '6s' }}
        />
      </svg>

      <div className="scene-pole scene-pole-r0" style={{ left: '9%' }}>
        <div className="scene-pill">MP 25 · 11 mph</div>
        <div className="scene-stem" style={{ height: 58 }} />
      </div>
      <div className="scene-pole scene-pole-r1" style={{ left: '34%' }}>
        <div className="scene-pill">MP 125 · 0.18 in/hr</div>
        <div className="scene-stem" style={{ height: 90 }} />
      </div>
      <div className="scene-pole scene-pole-r2" style={{ left: '60%' }}>
        <div className="scene-pill">MP 250 · 39 mph</div>
        <div className="scene-stem" style={{ height: 46 }} />
      </div>
      <div className="scene-pole scene-pole-r3" style={{ left: '86%' }}>
        <div className="scene-pill">MP 300 · 51 mph</div>
        <div className="scene-stem" style={{ height: 74 }} />
      </div>

      <div className="scene-road">
        <div className="scene-road-edge scene-road-edge-top" />
        <div className="scene-road-dash" />
        <div className="scene-road-edge scene-road-edge-bottom" />
      </div>

      <svg width="0" height="0" className="scene-defs">
        <defs>
          <linearGradient id="hwBeam" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--r1-t)" stopOpacity=".55" />
            <stop offset="1" stopColor="var(--r1-t)" stopOpacity="0" />
          </linearGradient>
          <symbol id="hwTruck" viewBox="0 0 400 96">
            <polygon points="258,58 400,30 400,96" fill="url(#hwBeam)" />
            <rect x="4" y="6" width="176" height="60" rx="3" fill="var(--snow)" />
            <rect x="4" y="38" width="176" height="4" fill="var(--accent)" opacity=".9" />
            <rect x="4" y="62" width="176" height="7" fill="var(--faint)" />
            <rect x="2" y="50" width="5" height="10" rx="1" fill="var(--r3)" />
            <rect x="180" y="58" width="10" height="8" fill="var(--mtn1)" />
            <rect x="204" y="6" width="5" height="24" rx="2" fill="var(--metal)" />
            <path
              d="M188 26 H226 Q232 26 236 32 L252 52 Q258 56 258 62 V72 H188 Z"
              fill="var(--time)"
            />
            <path d="M214 32 H228 L243 52 H214 Z" fill="var(--mtn3)" />
            <rect x="248" y="66" width="12" height="6" rx="2" fill="var(--text)" />
            <circle cx="255" cy="61" r="3" fill="var(--r1-t)" />
            <circle
              cx="30"
              cy="76"
              r="11"
              fill="var(--road)"
              stroke="var(--road-edge)"
              strokeWidth="3"
            />
            <circle
              cx="56"
              cy="76"
              r="11"
              fill="var(--road)"
              stroke="var(--road-edge)"
              strokeWidth="3"
            />
            <circle
              cx="200"
              cy="76"
              r="11"
              fill="var(--road)"
              stroke="var(--road-edge)"
              strokeWidth="3"
            />
            <circle
              cx="225"
              cy="76"
              r="11"
              fill="var(--road)"
              stroke="var(--road-edge)"
              strokeWidth="3"
            />
            <circle cx="30" cy="76" r="3" fill="var(--metal)" />
            <circle cx="56" cy="76" r="3" fill="var(--metal)" />
            <circle cx="200" cy="76" r="3" fill="var(--metal)" />
            <circle cx="225" cy="76" r="3" fill="var(--metal)" />
          </symbol>
        </defs>
      </svg>
      <div className="scene-truck scene-truck-far" style={{ animationDelay: '-4s' }}>
        <svg width="300" height="72">
          <use href="#hwTruck" />
        </svg>
      </div>
      <div className="scene-truck scene-truck-far" style={{ animationDelay: '-14s' }}>
        <svg width="300" height="72">
          <use href="#hwTruck" />
        </svg>
      </div>
      <div className="scene-truck scene-truck-near">
        <svg width="380" height="91">
          <use href="#hwTruck" />
        </svg>
      </div>

      <div className="scene-rain" />
      <div className="scene-fade" />
    </div>
  )
}

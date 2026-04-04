import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './DashCamShop.css';

const DASH_CAMS = [
  {
    id: 'vantrue-e1-lite',
    tier: 'Budget Pick',
    name: 'Vantrue E1 Lite',
    price: 79.99,
    image: null,
    resolution: '1080p Full HD',
    highlights: [
      'Wide angle lens for broad coverage',
      'Solid night vision performance',
      'Reliable firmware with regular updates',
      'Clean, consistent video output',
      'Compact and discreet design'
    ],
    bestFor: 'New Civik users who want reliable footage without a big upfront investment. Gets you started capturing incidents and earning rewards right away.',
    specs: {
      resolution: '1920x1080 @ 30fps',
      fieldOfView: '160°',
      nightVision: 'Yes',
      channels: '1 (Front)',
      storage: 'MicroSD up to 512GB',
      gps: 'Built-in'
    },
    affiliateUrl: '#',
    retailer: 'Amazon'
  },
  {
    id: 'garmin-dash-cam-57',
    tier: 'Mid Range',
    name: 'Garmin Dash Cam 57',
    price: 129.99,
    image: null,
    resolution: '1440p QHD',
    highlights: [
      '1440p resolution captures license plates clearly',
      'Excellent low-light performance',
      'Voice control for hands-free operation',
      'Automatic incident detection (G-sensor)',
      'Garmin Drive app for easy clip sharing'
    ],
    bestFor: 'Active reporters who need sharper footage for license plate identification. The bump to 1440p makes a real difference when evidence matters.',
    specs: {
      resolution: '2560x1440 @ 30fps',
      fieldOfView: '140°',
      nightVision: 'Enhanced',
      channels: '1 (Front)',
      storage: 'MicroSD up to 256GB',
      gps: 'Built-in'
    },
    affiliateUrl: '#',
    retailer: 'Amazon',
    popular: true
  },
  {
    id: 'vantrue-n4-pro',
    tier: 'Best Overall',
    name: 'Vantrue N4 Pro',
    price: 199.99,
    image: null,
    resolution: '4K UHD + 3-Channel',
    highlights: [
      '4K front camera with Sony STARVIS sensor',
      'Three channels: front, interior, and rear',
      'Exceptional night vision across all cameras',
      'Complete incident coverage from every angle',
      'Highest evidentiary value for police & insurance'
    ],
    bestFor: 'Power users, gig drivers, and anyone serious about Civik. Multi-angle footage is significantly more credible for insurance claims and law enforcement submissions.',
    specs: {
      resolution: '3840x2160 @ 30fps (front)',
      fieldOfView: '155° front / 165° interior / 160° rear',
      nightVision: 'Sony STARVIS IR',
      channels: '3 (Front + Interior + Rear)',
      storage: 'MicroSD up to 512GB',
      gps: 'Built-in'
    },
    affiliateUrl: '#',
    retailer: 'Amazon'
  }
];

const DATA_SERVICES = [
  {
    icon: '\uD83D\uDCF9',
    title: 'Incident Evidence',
    description: 'Your dash cam footage becomes timestamped, geotagged evidence that can be submitted directly to law enforcement and insurance companies through Civik.'
  },
  {
    icon: '\uD83D\uDDFA\uFE0F',
    title: 'Road Condition Mapping',
    description: 'Dash cam data helps map potholes, faded lane markings, broken signs, and other infrastructure issues. Municipalities use this structured data to prioritize repairs.'
  },
  {
    icon: '\uD83D\uDCC8',
    title: 'Traffic Pattern Analysis',
    description: 'Aggregated and anonymized driving data reveals traffic flow patterns, congestion hotspots, and dangerous intersections — valuable insights for city planners and DOTs.'
  },
  {
    icon: '\uD83D\uDEE1\uFE0F',
    title: 'Insurance Verification',
    description: 'Multi-angle footage provides insurers with clear, timestamped documentation. Reports with dash cam evidence are processed faster and disputed less often.'
  },
  {
    icon: '\uD83E\uDDE0',
    title: 'Structured Data Collection',
    description: 'Every clip is processed into structured data points — location, time, vehicle types, road conditions, weather, violations — creating a rich dataset that improves with every driver.'
  },
  {
    icon: '\uD83D\uDCB0',
    title: 'Earn While You Drive',
    description: 'Opt into the Civik data marketplace and earn credits when your anonymized footage and data points are used by partners. Better cameras generate higher-value data.'
  }
];

function DashCamShop() {
  const { isAuthenticated } = useAuth();
  const [expandedSpecs, setExpandedSpecs] = useState(null);

  const toggleSpecs = (id) => {
    setExpandedSpecs(expandedSpecs === id ? null : id);
  };

  return (
    <div className="dashcam-shop">
      {/* Hero */}
      <section className="shop-hero">
        <div className="container">
          <h1>Dash Cam Shop</h1>
          <p className="hero-subtitle">
            The right dash cam turns your daily commute into actionable data. Whether you're reporting violations,
            earning rewards, or contributing to safer roads — it starts with the camera on your windshield.
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="shop-products">
        <div className="container">
          <h2 className="section-title">Recommended Dash Cams</h2>
          <p className="section-subtitle">
            We've tested dozens of cameras for video clarity, license plate readability, night vision, and build quality.
            These three are the ones we recommend for Civik users.
          </p>

          <div className="products-grid">
            {DASH_CAMS.map((cam) => (
              <div key={cam.id} className={`product-card ${cam.popular ? 'product-card--popular' : ''}`}>
                {cam.popular && <div className="popular-badge">Most Popular</div>}

                <div className="product-tier">{cam.tier}</div>

                <div className="product-image-placeholder">
                  <span className="camera-icon">{'\uD83D\uDCF7'}</span>
                </div>

                <h3 className="product-name">{cam.name}</h3>

                <div className="product-resolution">{cam.resolution}</div>

                <div className="product-price">
                  <span className="price-amount">${cam.price.toFixed(2)}</span>
                </div>

                <ul className="product-highlights">
                  {cam.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>

                <div className="product-best-for">
                  <strong>Best for:</strong> {cam.bestFor}
                </div>

                <button
                  className="specs-toggle"
                  onClick={() => toggleSpecs(cam.id)}
                >
                  {expandedSpecs === cam.id ? 'Hide Specs' : 'View Specs'}
                </button>

                {expandedSpecs === cam.id && (
                  <div className="product-specs">
                    {Object.entries(cam.specs).map(([key, value]) => (
                      <div key={key} className="spec-row">
                        <span className="spec-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                        <span className="spec-value">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                <a
                  href={cam.affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn-buy ${cam.popular ? 'btn-buy--primary' : ''}`}
                >
                  Buy on {cam.retailer}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Services */}
      <section className="shop-services">
        <div className="container">
          <h2 className="section-title">What Your Dash Cam Unlocks</h2>
          <p className="section-subtitle">
            A dash cam isn't just a camera — it's your entry point into the Civik ecosystem.
            Here's what your footage makes possible.
          </p>

          <div className="services-grid">
            {DATA_SERVICES.map((service, i) => (
              <div key={i} className="service-card">
                <div className="service-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="shop-cta">
        <div className="container">
          <div className="cta-card">
            <h2>Already have a dash cam?</h2>
            <p>
              You don't need to buy a new one to get started. Any dash cam that records clear footage works with Civik.
              Sign up, start reporting, and earn rewards today.
            </p>
            {!isAuthenticated ? (
              <div className="cta-buttons">
                <a href="/register" className="btn btn-primary btn-lg">Create Account</a>
                <a href="/get-rewarded" className="btn btn-outline btn-lg">Learn About Rewards</a>
              </div>
            ) : (
              <div className="cta-buttons">
                <a href="/report" className="btn btn-primary btn-lg">Report an Incident</a>
                <a href="/rewards" className="btn btn-outline btn-lg">View Your Rewards</a>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="shop-footer">
        <div className="container">
          <p>
            Civik may earn a small commission from purchases made through these links at no extra cost to you.
            We only recommend products we've tested and trust.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default DashCamShop;

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ReportParkingViolation.css';

const STEPS = [
  { id: 1, name: 'Location', description: 'Detect your GPS location' },
  { id: 2, name: 'Photos', description: 'Take or upload photos' },
  { id: 3, name: 'Violation', description: 'Type of parking violation' },
  { id: 4, name: 'Vehicle', description: 'Vehicle details' },
  { id: 5, name: 'Review & Submit', description: 'Confirm and send' }
];

function ReportParkingViolation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdReport, setCreatedReport] = useState(null);

  // Location
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null, address: '', city: '', state: '', zipCode: '' });
  const [nearestStation, setNearestStation] = useState(null);

  // Photos
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  // Violation types from API
  const [violationTypes, setViolationTypes] = useState([]);

  // Form
  const [formData, setFormData] = useState({
    violationType: '',
    severity: 'moderate',
    description: '',
    licensePlate: '',
    plateState: '',
    make: '',
    model: '',
    color: '',
    vehicleType: ''
  });

  // Fetch violation types
  useEffect(() => {
    api.get('/parking-violations/options/types')
      .then(res => setViolationTypes(res.data))
      .catch(() => {});
  }, []);

  // Auto-detect GPS on mount
  useEffect(() => {
    detectLocation();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));

        // Reverse geocode
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const addr = data.address || {};
          setLocation({
            lat: latitude,
            lng: longitude,
            address: data.display_name || '',
            city: addr.city || addr.town || addr.village || '',
            state: addr.state || '',
            zipCode: addr.postcode || ''
          });
        } catch {
          setLocation(prev => ({ ...prev, lat: latitude, lng: longitude }));
        }

        // Find nearest station
        try {
          const stationRes = await api.get(`/parking-violations/nearest-station?lat=${latitude}&lng=${longitude}`);
          setNearestStation(stationRes.data.station);
        } catch {
          // Station lookup failed, still allow submission
        }

        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        setError('Unable to get your location. Please enable GPS and try again.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      setError('Maximum 5 photos allowed');
      return;
    }

    const newPhotos = [...photos, ...files];
    setPhotos(newPhotos);

    // Generate previews
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
    setError('');
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleViolationSelect = (type) => {
    const selected = violationTypes.find(v => v.value === type);
    setFormData(prev => ({
      ...prev,
      violationType: type,
      severity: selected?.severity || 'moderate'
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return location.lat && location.lng;
      case 2: return photos.length > 0;
      case 3: return formData.violationType;
      case 4: return true; // Vehicle info is optional
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();
      photos.forEach(photo => submitData.append('photos', photo));
      submitData.append('violationType', formData.violationType);
      submitData.append('severity', formData.severity);
      submitData.append('description', formData.description);
      submitData.append('lat', location.lat);
      submitData.append('lng', location.lng);
      submitData.append('address', location.address);
      submitData.append('city', location.city);
      submitData.append('state', location.state);
      submitData.append('zipCode', location.zipCode);
      submitData.append('licensePlate', formData.licensePlate);
      submitData.append('plateState', formData.plateState);
      submitData.append('make', formData.make);
      submitData.append('model', formData.model);
      submitData.append('color', formData.color);
      submitData.append('vehicleType', formData.vehicleType);

      const res = await api.post('/parking-violations', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      setCreatedReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (success && createdReport) {
    return (
      <div className="report-parking">
        <div className="container">
          <div className="success-card">
            <div className="success-icon">&#10003;</div>
            <h2>Report Submitted!</h2>
            <p className="report-number">{createdReport.reportNumber}</p>
            {createdReport.assignedStation && (
              <div className="station-info">
                <p>Assigned to: <strong>{createdReport.assignedStation.name}</strong></p>
                <p>{createdReport.assignedStation.distance} km away</p>
              </div>
            )}
            <div className="bounty-info">
              <p>If approved by the police department, you'll earn a bounty reward in credits!</p>
              <p className="bounty-note">You'll be notified when a decision is made.</p>
            </div>
            <div className="success-actions">
              <button onClick={() => navigate('/my-parking-reports')} className="btn-primary">
                View My Reports
              </button>
              <button onClick={() => { setSuccess(false); setCurrentStep(1); setPhotos([]); setPhotoPreviews([]); }} className="btn-secondary">
                Report Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-parking">
      <div className="container">
        <h1>Report Parking Violation</h1>
        <p className="subtitle">Snap a photo, report it, and get paid if approved</p>

        {/* Progress Steps */}
        <div className="progress-bar">
          {STEPS.map(step => (
            <div
              key={step.id}
              className={`progress-step ${currentStep >= step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
            >
              <div className="step-number">
                {currentStep > step.id ? '\u2713' : step.id}
              </div>
              <span className="step-name">{step.name}</span>
            </div>
          ))}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="step-content">
          {/* Step 1: Location */}
          {currentStep === 1 && (
            <div className="step-panel">
              <h2>Confirm Your Location</h2>
              <p className="step-desc">We need your GPS location to route this report to the nearest police department.</p>

              {locationLoading ? (
                <div className="location-loading">
                  <div className="spinner"></div>
                  <p>Detecting your location...</p>
                </div>
              ) : location.lat ? (
                <div className="location-result">
                  <div className="location-pin">&#128205;</div>
                  <div className="location-details">
                    <p className="location-address">{location.address || `${location.lat}, ${location.lng}`}</p>
                    {location.city && <p className="location-city">{location.city}, {location.state} {location.zipCode}</p>}
                  </div>
                  {nearestStation && (
                    <div className="nearest-station">
                      <h4>Nearest Police Department</h4>
                      <p className="station-name">{nearestStation.name}</p>
                      <p className="station-distance">{nearestStation.distance} km away</p>
                      <p className="station-jurisdiction">{nearestStation.jurisdiction}</p>
                    </div>
                  )}
                  <button onClick={detectLocation} className="btn-outline">
                    Re-detect Location
                  </button>
                </div>
              ) : (
                <div className="location-error">
                  <p>Could not detect location.</p>
                  <button onClick={detectLocation} className="btn-primary">
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Photos */}
          {currentStep === 2 && (
            <div className="step-panel">
              <h2>Take Photos of the Violation</h2>
              <p className="step-desc">Take clear photos showing the vehicle and the parking violation. Include the license plate if visible.</p>

              <div className="photo-grid">
                {photoPreviews.map((preview, index) => (
                  <div key={index} className="photo-item">
                    <img src={preview} alt={`Evidence ${index + 1}`} />
                    <button className="photo-remove" onClick={() => removePhoto(index)}>&times;</button>
                  </div>
                ))}
                {photos.length < 5 && (
                  <div className="photo-add" onClick={() => fileInputRef.current?.click()}>
                    <span className="photo-add-icon">+</span>
                    <span>Add Photo</span>
                    <span className="photo-hint">{photos.length}/5</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                multiple
                onChange={handlePhotoAdd}
                style={{ display: 'none' }}
                capture="environment"
              />

              <div className="photo-tips">
                <h4>Tips for good evidence:</h4>
                <ul>
                  <li>Include the full vehicle and the violation clearly</li>
                  <li>Capture the license plate if possible</li>
                  <li>Show nearby signs (no parking, fire hydrant, etc.)</li>
                  <li>Take from multiple angles if possible</li>
                </ul>
              </div>
            </div>
          )}

          {/* Step 3: Violation Type */}
          {currentStep === 3 && (
            <div className="step-panel">
              <h2>What type of parking violation?</h2>
              <p className="step-desc">Select the violation that best describes what you see.</p>

              <div className="violation-type-grid">
                {violationTypes.map(type => (
                  <div
                    key={type.value}
                    className={`violation-type-card ${formData.violationType === type.value ? 'selected' : ''}`}
                    onClick={() => handleViolationSelect(type.value)}
                  >
                    <span className="type-label">{type.label}</span>
                    <span className={`type-severity severity-${type.severity}`}>{type.severity}</span>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Additional Details (optional)</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the situation (e.g., 'Car has been parked here for 3 hours blocking the driveway')"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 4: Vehicle Info */}
          {currentStep === 4 && (
            <div className="step-panel">
              <h2>Vehicle Information</h2>
              <p className="step-desc">Provide as much detail as you can about the vehicle. License plate helps police take action faster.</p>

              <div className="form-row">
                <div className="form-group">
                  <label>License Plate</label>
                  <input
                    type="text"
                    name="licensePlate"
                    value={formData.licensePlate}
                    onChange={handleChange}
                    placeholder="e.g., ABC1234"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
                <div className="form-group">
                  <label>Plate State</label>
                  <input
                    type="text"
                    name="plateState"
                    value={formData.plateState}
                    onChange={handleChange}
                    placeholder="e.g., CA"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="text"
                    name="color"
                    value={formData.color}
                    onChange={handleChange}
                    placeholder="e.g., Red"
                  />
                </div>
                <div className="form-group">
                  <label>Make</label>
                  <input
                    type="text"
                    name="make"
                    value={formData.make}
                    onChange={handleChange}
                    placeholder="e.g., Toyota"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Model</label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="e.g., Camry"
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select name="vehicleType" value={formData.vehicleType} onChange={handleChange}>
                    <option value="">Select type</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="truck">Truck</option>
                    <option value="van">Van</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="commercial">Commercial</option>
                    <option value="bus">Bus</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="step-panel">
              <h2>Review & Submit</h2>
              <p className="step-desc">Make sure everything looks correct before submitting.</p>

              <div className="review-section">
                <div className="review-block">
                  <h4>Location</h4>
                  <p>{location.address || `${location.lat}, ${location.lng}`}</p>
                  {nearestStation && <p className="review-station">Sending to: {nearestStation.name}</p>}
                </div>

                <div className="review-block">
                  <h4>Photos</h4>
                  <div className="review-photos">
                    {photoPreviews.map((preview, i) => (
                      <img key={i} src={preview} alt={`Evidence ${i + 1}`} className="review-thumb" />
                    ))}
                  </div>
                </div>

                <div className="review-block">
                  <h4>Violation</h4>
                  <p>{violationTypes.find(v => v.value === formData.violationType)?.label || formData.violationType}</p>
                  <span className={`type-severity severity-${formData.severity}`}>{formData.severity}</span>
                  {formData.description && <p className="review-desc">{formData.description}</p>}
                </div>

                {formData.licensePlate && (
                  <div className="review-block">
                    <h4>Vehicle</h4>
                    <p>Plate: {formData.licensePlate} {formData.plateState && `(${formData.plateState})`}</p>
                    {formData.color && <p>{formData.color} {formData.make} {formData.model}</p>}
                  </div>
                )}

                <div className="review-block bounty-preview">
                  <h4>Potential Bounty</h4>
                  <p>If approved by police, you could earn credits for this report!</p>
                  <p className="bounty-amount">Bounties range from $1.00 - $7.50 depending on violation type</p>
                </div>
              </div>

              <div className="consent-section">
                <label className="consent-label">
                  <input type="checkbox" required defaultChecked />
                  I certify this report is truthful and accurate. I accept the Terms of Service.
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="step-navigation">
          {currentStep > 1 && (
            <button
              className="btn-secondary"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={loading}
            >
              Back
            </button>
          )}
          <div className="nav-spacer" />
          {currentStep < 5 ? (
            <button
              className="btn-primary"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
            >
              Next
            </button>
          ) : (
            <button
              className="btn-submit"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReportParkingViolation;

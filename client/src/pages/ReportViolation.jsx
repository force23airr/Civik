import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import './ReportViolation.css';

const STEPS = [
  { id: 1, name: 'Violation Type', description: 'Select the type of violation' },
  { id: 2, name: 'Incident Details', description: 'When and where it happened' },
  { id: 3, name: 'Vehicle Info', description: 'Offending vehicle details' },
  { id: 4, name: 'Evidence', description: 'Upload video or photos' },
  { id: 5, name: 'Description', description: 'Describe what happened' },
  { id: 6, name: 'Legal Consent', description: 'Terms and authorization' },
  { id: 7, name: 'Review', description: 'Review and submit' }
];

function ReportViolation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [createdReport, setCreatedReport] = useState(null);

  // Options from API
  const [violationTypes, setViolationTypes] = useState([]);
  const [severityLevels, setSeverityLevels] = useState([]);
  const [states, setStates] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    violationType: '',
    severity: '',
    offendingVehicle: {
      licensePlate: '',
      plateState: '',
      plateCountry: 'US',
      make: '',
      model: '',
      color: '',
      vehicleType: ''
    },
    location: {
      address: '',
      city: '',
      state: '',
      zipCode: '',
      lat: 0,
      lng: 0,
      roadType: '',
      speedLimit: ''
    },
    incidentDateTime: '',
    description: '',
    reporterVehicle: {
      wasInvolved: false,
      damageDescription: '',
      estimatedDamage: ''
    },
    consent: {
      tosAccepted: false,
      certifyTruthful: false,
      authorizePoliceContact: false,
      authorizeInsuranceReport: false,
      willingToTestify: false
    }
  });

  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [uploadPreviews, setUploadPreviews] = useState([]);

  // Fetch options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [typesRes, severitiesRes, statesRes] = await Promise.all([
          api.get('/violations/options/types'),
          api.get('/violations/options/severities'),
          api.get('/violations/options/states')
        ]);
        setViolationTypes(typesRes.data.violationTypes);
        setSeverityLevels(severitiesRes.data.severityLevels);
        setStates(statesRes.data.states);
      } catch (err) {
        console.error('Error fetching options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          }));
        },
        (err) => console.log('Location error:', err)
      );
    }
  }, []);

  const handleInputChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setEvidenceFiles(prev => [...prev, ...files]);

    // Create previews
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadPreviews(prev => [...prev, {
          name: file.name,
          url: e.target.result,
          type: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index) => {
    setEvidenceFiles(prev => prev.filter((_, i) => i !== index));
    setUploadPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        return formData.violationType && formData.severity;
      case 2:
        return formData.incidentDateTime && formData.location.address && formData.location.lat && formData.location.lng;
      case 3:
        return formData.offendingVehicle.licensePlate && formData.offendingVehicle.plateState;
      case 4:
        return true; // Evidence is optional but recommended
      case 5:
        return formData.description.length >= 50;
      case 6:
        return formData.consent.tosAccepted && formData.consent.certifyTruthful;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
      setError('');
    } else {
      setError('Please fill in all required fields');
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const submitData = new FormData();

      // Add form fields
      submitData.append('violationType', formData.violationType);
      submitData.append('severity', formData.severity);
      submitData.append('offendingVehicle', JSON.stringify(formData.offendingVehicle));
      submitData.append('location', JSON.stringify(formData.location));
      submitData.append('incidentDateTime', formData.incidentDateTime);
      submitData.append('description', formData.description);
      submitData.append('reporterVehicle', JSON.stringify(formData.reporterVehicle));
      submitData.append('consent', JSON.stringify(formData.consent));

      // Add evidence files
      evidenceFiles.forEach(file => {
        submitData.append('evidence', file);
      });

      const response = await api.post('/violations', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setCreatedReport(response.data.violationReport);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="report-violation">
        <div className="container">
          <div className="auth-required">
            <h2>Login Required</h2>
            <p>You must be logged in to report a traffic violation.</p>
            <button onClick={() => navigate('/login')}>Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (success && createdReport) {
    return (
      <div className="report-violation">
        <div className="container">
          <div className="success-message">
            <div className="success-icon">&#10003;</div>
            <h2>Report Submitted Successfully!</h2>
            <p className="report-number">Report Number: <strong>{createdReport.reportNumber}</strong></p>
            <p>Your traffic violation report has been submitted and is now under review.</p>
            <div className="success-actions">
              <button onClick={() => navigate(`/violations/${createdReport._id}`)}>
                View Report
              </button>
              <button className="secondary" onClick={() => navigate('/my-violations')}>
                My Reports
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="report-violation">
      <div className="container">
        <h1>Report Traffic Violation</h1>
        <p className="subtitle">Help keep roads safe by reporting dangerous drivers</p>

        {/* Progress Bar */}
        <div className="progress-bar">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`progress-step ${currentStep >= step.id ? 'active' : ''} ${currentStep === step.id ? 'current' : ''}`}
            >
              <div className="step-number">{step.id}</div>
              <div className="step-info">
                <span className="step-name">{step.name}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-container">
          {/* Step 1: Violation Type */}
          {currentStep === 1 && (
            <div className="step-content">
              <h2>What type of violation did you witness?</h2>

              <div className="violation-type-grid">
                {violationTypes.map((type) => (
                  <div
                    key={type.value}
                    className={`violation-type-card ${formData.violationType === type.value ? 'selected' : ''}`}
                    onClick={() => handleInputChange(null, 'violationType', type.value)}
                  >
                    <span className="violation-label">{type.label}</span>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Severity Level *</label>
                <div className="severity-options">
                  {severityLevels.map((level) => (
                    <div
                      key={level.value}
                      className={`severity-option ${formData.severity === level.value ? 'selected' : ''}`}
                      style={{ '--severity-color': level.color }}
                      onClick={() => handleInputChange(null, 'severity', level.value)}
                    >
                      <span className="severity-label">{level.label}</span>
                      <span className="severity-description">{level.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Incident Details */}
          {currentStep === 2 && (
            <div className="step-content">
              <h2>When and where did the incident occur?</h2>

              <div className="form-group">
                <label>Date and Time *</label>
                <input
                  type="datetime-local"
                  value={formData.incidentDateTime}
                  onChange={(e) => handleInputChange(null, 'incidentDateTime', e.target.value)}
                  max={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="form-group">
                <label>Street Address *</label>
                <input
                  type="text"
                  placeholder="123 Main St or Intersection of Main St & Oak Ave"
                  value={formData.location.address}
                  onChange={(e) => handleInputChange('location', 'address', e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.location.city}
                    onChange={(e) => handleInputChange('location', 'city', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <select
                    value={formData.location.state}
                    onChange={(e) => handleInputChange('location', 'state', e.target.value)}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.code} value={state.code}>{state.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>ZIP Code</label>
                  <input
                    type="text"
                    value={formData.location.zipCode}
                    onChange={(e) => handleInputChange('location', 'zipCode', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.lat}
                    onChange={(e) => handleInputChange('location', 'lat', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.lng}
                    onChange={(e) => handleInputChange('location', 'lng', parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Road Type</label>
                  <select
                    value={formData.location.roadType}
                    onChange={(e) => handleInputChange('location', 'roadType', e.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="highway">Highway/Freeway</option>
                    <option value="arterial">Arterial Road</option>
                    <option value="residential">Residential Street</option>
                    <option value="school_zone">School Zone</option>
                    <option value="construction_zone">Construction Zone</option>
                    <option value="parking_lot">Parking Lot</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Speed Limit (mph)</label>
                  <input
                    type="number"
                    placeholder="e.g., 35"
                    value={formData.location.speedLimit}
                    onChange={(e) => handleInputChange('location', 'speedLimit', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Vehicle Info */}
          {currentStep === 3 && (
            <div className="step-content">
              <h2>Offending Vehicle Information</h2>

              <div className="form-row">
                <div className="form-group">
                  <label>License Plate Number *</label>
                  <input
                    type="text"
                    placeholder="ABC123"
                    value={formData.offendingVehicle.licensePlate}
                    onChange={(e) => handleInputChange('offendingVehicle', 'licensePlate', e.target.value.toUpperCase())}
                    className="license-plate-input"
                  />
                </div>
                <div className="form-group">
                  <label>Plate State *</label>
                  <select
                    value={formData.offendingVehicle.plateState}
                    onChange={(e) => handleInputChange('offendingVehicle', 'plateState', e.target.value)}
                  >
                    <option value="">Select State</option>
                    {states.map((state) => (
                      <option key={state.code} value={state.code}>{state.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Vehicle Make</label>
                  <input
                    type="text"
                    placeholder="e.g., Toyota"
                    value={formData.offendingVehicle.make}
                    onChange={(e) => handleInputChange('offendingVehicle', 'make', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Model</label>
                  <input
                    type="text"
                    placeholder="e.g., Camry"
                    value={formData.offendingVehicle.model}
                    onChange={(e) => handleInputChange('offendingVehicle', 'model', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="text"
                    placeholder="e.g., Red"
                    value={formData.offendingVehicle.color}
                    onChange={(e) => handleInputChange('offendingVehicle', 'color', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Type</label>
                  <select
                    value={formData.offendingVehicle.vehicleType}
                    onChange={(e) => handleInputChange('offendingVehicle', 'vehicleType', e.target.value)}
                  >
                    <option value="">Select Type</option>
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="truck">Truck</option>
                    <option value="van">Van</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="commercial">Commercial Vehicle</option>
                    <option value="bus">Bus</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Evidence */}
          {currentStep === 4 && (
            <div className="step-content">
              <h2>Upload Evidence</h2>
              <p className="step-description">
                Upload dashcam footage or photos of the incident. Evidence helps strengthen your report.
              </p>

              <div className="upload-area">
                <input
                  type="file"
                  id="evidence-upload"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <label htmlFor="evidence-upload" className="upload-label">
                  <span className="upload-icon">+</span>
                  <span>Click to upload or drag files here</span>
                  <span className="upload-hint">Supports: JPG, PNG, MP4, MOV (max 100MB each)</span>
                </label>
              </div>

              {uploadPreviews.length > 0 && (
                <div className="file-previews">
                  {uploadPreviews.map((preview, index) => (
                    <div key={index} className="file-preview">
                      {preview.type.startsWith('video/') ? (
                        <video src={preview.url} className="preview-media" />
                      ) : (
                        <img src={preview.url} alt={preview.name} className="preview-media" />
                      )}
                      <div className="preview-info">
                        <span className="preview-name">{preview.name}</span>
                        <button
                          type="button"
                          className="remove-file"
                          onClick={() => removeFile(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Description */}
          {currentStep === 5 && (
            <div className="step-content">
              <h2>Describe What Happened</h2>

              <div className="form-group">
                <label>Detailed Description * (minimum 50 characters)</label>
                <textarea
                  rows="6"
                  placeholder="Describe the incident in detail. Include what you observed, any near-misses or actual collisions, road conditions, and any other relevant information..."
                  value={formData.description}
                  onChange={(e) => handleInputChange(null, 'description', e.target.value)}
                />
                <span className="char-count">{formData.description.length} / 5000 characters</span>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.reporterVehicle.wasInvolved}
                    onChange={(e) => handleInputChange('reporterVehicle', 'wasInvolved', e.target.checked)}
                  />
                  My vehicle was directly involved in the incident
                </label>
              </div>

              {formData.reporterVehicle.wasInvolved && (
                <>
                  <div className="form-group">
                    <label>Damage Description</label>
                    <textarea
                      rows="3"
                      placeholder="Describe any damage to your vehicle..."
                      value={formData.reporterVehicle.damageDescription}
                      onChange={(e) => handleInputChange('reporterVehicle', 'damageDescription', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Estimated Damage ($)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={formData.reporterVehicle.estimatedDamage}
                      onChange={(e) => handleInputChange('reporterVehicle', 'estimatedDamage', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 6: Legal Consent */}
          {currentStep === 6 && (
            <div className="step-content">
              <h2>Legal Consent & Authorization</h2>

              <div className="consent-section">
                <div className="consent-item required">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.consent.tosAccepted}
                      onChange={(e) => handleInputChange('consent', 'tosAccepted', e.target.checked)}
                    />
                    <span>I accept the Terms of Service *</span>
                  </label>
                  <p className="consent-description">
                    You agree to Civik's terms of service for submitting violation reports.
                  </p>
                </div>

                <div className="consent-item required">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.consent.certifyTruthful}
                      onChange={(e) => handleInputChange('consent', 'certifyTruthful', e.target.checked)}
                    />
                    <span>I certify this report is truthful and accurate *</span>
                  </label>
                  <p className="consent-description">
                    Filing a false report may result in legal consequences. You certify all information provided is accurate to the best of your knowledge.
                  </p>
                </div>

                <div className="consent-item optional">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.consent.authorizePoliceContact}
                      onChange={(e) => handleInputChange('consent', 'authorizePoliceContact', e.target.checked)}
                    />
                    <span>I authorize law enforcement to contact me</span>
                  </label>
                  <p className="consent-description">
                    If selected, police may contact you for additional information about this incident.
                  </p>
                </div>

                <div className="consent-item optional">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.consent.authorizeInsuranceReport}
                      onChange={(e) => handleInputChange('consent', 'authorizeInsuranceReport', e.target.checked)}
                    />
                    <span>I authorize submission to insurance databases</span>
                  </label>
                  <p className="consent-description">
                    This allows the violation to be reported to insurance companies, potentially affecting the offender's rates.
                  </p>
                </div>

                <div className="consent-item optional">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.consent.willingToTestify}
                      onChange={(e) => handleInputChange('consent', 'willingToTestify', e.target.checked)}
                    />
                    <span>I am willing to testify in court if needed</span>
                  </label>
                  <p className="consent-description">
                    Strengthens the case if the violation results in citations or legal action.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Review */}
          {currentStep === 7 && (
            <div className="step-content">
              <h2>Review Your Report</h2>

              <div className="review-section">
                <h3>Violation Details</h3>
                <div className="review-item">
                  <span className="label">Type:</span>
                  <span className="value">{violationTypes.find(t => t.value === formData.violationType)?.label}</span>
                </div>
                <div className="review-item">
                  <span className="label">Severity:</span>
                  <span className={`value severity-badge severity-${formData.severity}`}>
                    {severityLevels.find(s => s.value === formData.severity)?.label}
                  </span>
                </div>
              </div>

              <div className="review-section">
                <h3>Incident Location</h3>
                <div className="review-item">
                  <span className="label">Date/Time:</span>
                  <span className="value">{new Date(formData.incidentDateTime).toLocaleString()}</span>
                </div>
                <div className="review-item">
                  <span className="label">Address:</span>
                  <span className="value">
                    {formData.location.address}
                    {formData.location.city && `, ${formData.location.city}`}
                    {formData.location.state && `, ${formData.location.state}`}
                  </span>
                </div>
                <div className="review-item">
                  <span className="label">GPS:</span>
                  <span className="value">{formData.location.lat}, {formData.location.lng}</span>
                </div>
              </div>

              <div className="review-section">
                <h3>Offending Vehicle</h3>
                <div className="review-item">
                  <span className="label">License Plate:</span>
                  <span className="value license-plate">{formData.offendingVehicle.licensePlate}</span>
                </div>
                <div className="review-item">
                  <span className="label">State:</span>
                  <span className="value">{formData.offendingVehicle.plateState}</span>
                </div>
                {formData.offendingVehicle.make && (
                  <div className="review-item">
                    <span className="label">Vehicle:</span>
                    <span className="value">
                      {[formData.offendingVehicle.color, formData.offendingVehicle.make, formData.offendingVehicle.model]
                        .filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
              </div>

              <div className="review-section">
                <h3>Evidence</h3>
                <div className="review-item">
                  <span className="label">Files:</span>
                  <span className="value">{evidenceFiles.length} file(s) attached</span>
                </div>
              </div>

              <div className="review-section">
                <h3>Description</h3>
                <p className="review-description">{formData.description}</p>
              </div>

              <div className="review-section">
                <h3>Authorizations</h3>
                <ul className="auth-list">
                  {formData.consent.authorizePoliceContact && <li>Police may contact me</li>}
                  {formData.consent.authorizeInsuranceReport && <li>Report to insurance</li>}
                  {formData.consent.willingToTestify && <li>Willing to testify</li>}
                </ul>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="form-navigation">
            {currentStep > 1 && (
              <button type="button" className="btn-secondary" onClick={prevStep}>
                Previous
              </button>
            )}
            {currentStep < STEPS.length ? (
              <button type="button" className="btn-primary" onClick={nextStep}>
                Next
              </button>
            ) : (
              <button
                type="button"
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
    </div>
  );
}

export default ReportViolation;

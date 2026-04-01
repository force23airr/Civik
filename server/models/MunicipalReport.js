import mongoose from 'mongoose';

const municipalReportSchema = new mongoose.Schema({
  incident: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MunicipalDepartment'
    // null = unassigned (no matching dept found yet)
  },
  submissionId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Which protocol was used to submit
  protocol: {
    type: String,
    enum: ['open311', 'email', 'internal'],
    required: true
  },
  status: {
    type: String,
    enum: ['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'unassigned'],
    default: 'submitted'
  },
  // Ticket/case number returned by the city's 311 system
  ticketNumber: String,
  // Notes added by city worker
  workerNotes: String,
  workerAssigned: String,
  resolvedAt: Date,
  reporterNotified: { type: Boolean, default: false },
  // Raw payload sent to the 311 system / email
  submissionPayload: mongoose.Schema.Types.Mixed,
  // Raw response from the 311 system
  responsePayload: mongoose.Schema.Types.Mixed,
  // Status history
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: String
  }]
}, { timestamps: true });

municipalReportSchema.index({ incident: 1 });
municipalReportSchema.index({ reporter: 1, createdAt: -1 });
municipalReportSchema.index({ department: 1, status: 1 });
municipalReportSchema.index({ status: 1 });

export default mongoose.model('MunicipalReport', municipalReportSchema);

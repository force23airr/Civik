import ViolationReport from '../models/ViolationReport.js';
import PoliceStation from '../models/PoliceStation.js';
import PoliceActivity from '../models/PoliceActivity.js';
import User from '../models/User.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

// Get case queue for officer's department
export const getCaseQueue = async (req, res) => {
  try {
    const { status, priority, assignedToMe } = req.query;
    const departmentId = req.department._id;

    // Build query
    const query = {
      'lawEnforcementSubmissions.policeStation': departmentId
    };

    // Filter by status
    if (status) {
      query['lawEnforcementSubmissions.status'] = status;
    } else {
      // Default: show pending and under_review
      query['lawEnforcementSubmissions.status'] = {
        $in: ['pending', 'received', 'under_review']
      };
    }

    // Filter by assigned officer
    if (assignedToMe === 'true') {
      query['lawEnforcementSubmissions.officerAssigned'] = req.user.policeProfile.badgeNumber;
    }

    const cases = await ViolationReport.find(query)
      .populate('reporter', 'username avatar')
      .sort({
        'lawEnforcementSubmissions.submittedAt': priority === 'oldest' ? 1 : -1
      })
      .limit(50);

    // Log activity
    await PoliceActivity.create({
      officer: req.user._id,
      department: departmentId,
      action: 'login',
      details: { casesLoaded: cases.length }
    });

    res.json({
      cases,
      count: cases.length,
      department: req.department.name
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Get single case details
export const getCaseDetails = async (req, res) => {
  try {
    const { caseId } = req.params;

    const violationReport = await ViolationReport.findById(caseId)
      .populate('reporter', 'username avatar');

    if (!violationReport) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Verify this case was submitted to officer's department
    const submission = violationReport.lawEnforcementSubmissions.find(
      sub => sub.policeStation._id.toString() === req.department._id.toString()
    );

    if (!submission) {
      return res.status(403).json({ error: 'Case not in your jurisdiction' });
    }

    // Log activity
    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      violationReport: caseId,
      action: 'viewed_case'
    });

    res.json(violationReport);
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Stream video evidence
export const streamVideo = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;

    const violationReport = await ViolationReport.findById(caseId);
    if (!violationReport) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const evidence = violationReport.evidence.id(evidenceId);
    if (!evidence) {
      return res.status(404).json({ error: 'Evidence file not found' });
    }

    const videoPath = path.normalize(path.resolve(evidence.path));
    // Prevent path traversal — ensure file is within uploads directory
    if (!videoPath.startsWith(path.resolve(UPLOADS_DIR))) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found on server' });
    }

    // Get file stats for range support
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Stream video with range support (for seeking)
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': evidence.mimetype || 'video/mp4'
      });

      file.pipe(res);
    } else {
      // Stream entire video
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': evidence.mimetype || 'video/mp4'
      });

      fs.createReadStream(videoPath).pipe(res);
    }

    // Log video playback
    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      violationReport: caseId,
      action: 'played_video',
      details: { evidenceId }
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Update case status
export const updateCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status, caseNumber, citationNumber, notes } = req.body;

    const violationReport = await ViolationReport.findById(caseId);
    if (!violationReport) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Find submission for this department
    const submission = violationReport.lawEnforcementSubmissions.find(
      sub => sub.policeStation.toString() === req.department._id.toString()
    );

    if (!submission) {
      return res.status(403).json({ error: 'Case not in your jurisdiction' });
    }

    const previousStatus = submission.status;

    // Update submission
    submission.status = status;
    submission.lastUpdated = new Date();
    submission.officerAssigned = req.user.policeProfile.badgeNumber;

    if (caseNumber) submission.caseNumber = caseNumber;
    if (citationNumber) submission.citationNumber = citationNumber;
    if (notes) submission.notes = notes;

    await violationReport.save();

    // Update officer stats
    if (status === 'citation_issued') {
      req.user.policeProfile.stats.citationsIssued += 1;
      req.department.stats.citationsIssued += 1;
    } else if (status === 'dismissed') {
      req.user.policeProfile.stats.casesDismissed += 1;
      req.department.stats.casesDismissed += 1;
    }

    req.user.policeProfile.stats.casesReviewed += 1;
    req.department.stats.totalReviewsCompleted += 1;

    await req.user.save();
    await req.department.save();

    // Log activity
    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      violationReport: caseId,
      action: status === 'citation_issued' ? 'issued_citation' : 'updated_status',
      details: {
        previousStatus,
        newStatus: status,
        caseNumber,
        citationNumber,
        notes
      }
    });

    res.json({
      success: true,
      violationReport,
      message: `Case ${status === 'citation_issued' ? 'citation issued' : 'updated'} successfully`
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Get department stats
export const getDepartmentStats = async (req, res) => {
  try {
    const departmentId = req.department._id;

    // Get case counts by status
    const statusCounts = await ViolationReport.aggregate([
      { $unwind: '$lawEnforcementSubmissions' },
      { $match: { 'lawEnforcementSubmissions.policeStation': departmentId } },
      { $group: {
        _id: '$lawEnforcementSubmissions.status',
        count: { $sum: 1 }
      }}
    ]);

    // Get officer leaderboard
    const officers = await User.find({
      role: 'police_officer',
      'policeProfile.department': departmentId,
      'policeProfile.isActive': true
    }).select('username policeProfile.badgeNumber policeProfile.stats');

    res.json({
      department: req.department.stats,
      statusCounts,
      officers: officers.sort((a, b) =>
        b.policeProfile.stats.casesReviewed - a.policeProfile.stats.casesReviewed
      )
    });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

// Export evidence package (download ZIP)
export const exportEvidence = async (req, res) => {
  try {
    const { caseId } = req.params;

    // Implementation would call EvidencePackager service
    // For now, placeholder

    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      violationReport: caseId,
      action: 'exported_evidence'
    });

    res.json({ message: 'Evidence package generation started' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred' });
  }
};

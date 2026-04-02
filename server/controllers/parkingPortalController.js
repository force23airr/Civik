import ParkingViolation from '../models/ParkingViolation.js';
import PoliceActivity from '../models/PoliceActivity.js';
import { awardParkingViolationBounty } from '../services/rewards/rewardService.js';

/**
 * Get parking violation queue for officer's department
 * GET /api/police-portal/parking
 */
export const getParkingQueue = async (req, res) => {
  try {
    const { status, page = 1, limit = 30 } = req.query;
    const departmentId = req.department._id;
    const safeLimit = Math.min(Math.max(parseInt(limit) || 30, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const query = { assignedStation: departmentId };

    if (status && typeof status === 'string') {
      query['review.status'] = status;
    } else {
      query['review.status'] = { $in: ['pending', 'under_review'] };
    }

    const cases = await ParkingViolation.find(query)
      .populate('reporter', 'username email')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const total = await ParkingViolation.countDocuments(query);

    // Count by status
    const statusCounts = await ParkingViolation.aggregate([
      { $match: { assignedStation: departmentId } },
      { $group: { _id: '$review.status', count: { $sum: 1 } } }
    ]);

    await PoliceActivity.create({
      officer: req.user._id,
      department: departmentId,
      action: 'login',
      details: { parkingCasesLoaded: cases.length }
    });

    res.json({
      cases,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      statusCounts: statusCounts.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
      department: req.department.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single parking violation detail
 * GET /api/police-portal/parking/:id
 */
export const getParkingCaseDetail = async (req, res) => {
  try {
    const report = await ParkingViolation.findById(req.params.id)
      .populate('reporter', 'username email phone')
      .populate('assignedStation', 'name jurisdiction');

    if (!report) {
      return res.status(404).json({ error: 'Parking violation not found' });
    }

    if (report.assignedStation._id.toString() !== req.department._id.toString()) {
      return res.status(403).json({ error: 'Case not in your jurisdiction' });
    }

    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      action: 'viewed_case',
      details: { parkingViolationId: report._id, reportNumber: report.reportNumber }
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Approve or deny a parking violation
 * PUT /api/police-portal/parking/:id/review
 *
 * Body: { decision: 'approved'|'denied', citationNumber, fineAmount, notes, denialReason }
 */
export const reviewParkingViolation = async (req, res) => {
  try {
    const { decision, citationNumber, fineAmount, notes, denialReason } = req.body;

    if (!['approved', 'denied', 'needs_more_info'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approved, denied, or needs_more_info' });
    }

    const report = await ParkingViolation.findById(req.params.id);

    if (!report) {
      return res.status(404).json({ error: 'Parking violation not found' });
    }

    if (report.assignedStation.toString() !== req.department._id.toString()) {
      return res.status(403).json({ error: 'Case not in your jurisdiction' });
    }

    // Prevent self-approval — officer cannot review their own report
    if (report.reporter.toString() === req.user._id.toString()) {
      return res.status(403).json({ error: 'Cannot review your own report' });
    }

    // Prevent re-review of already decided reports
    if (['approved', 'denied'].includes(report.review?.status)) {
      return res.status(400).json({ error: `Report already ${report.review.status}. Cannot re-review.` });
    }

    // Update review
    report.review = {
      status: decision,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      officerBadgeNumber: req.user.policeProfile?.badgeNumber,
      citationIssued: decision === 'approved',
      citationNumber: citationNumber || undefined,
      fineAmount: fineAmount ? parseInt(fineAmount) : undefined,
      denialReason: decision === 'denied' ? denialReason : undefined,
      notes
    };

    // Update status
    report.status = decision === 'approved' ? 'approved' : decision === 'denied' ? 'denied' : 'under_review';

    // Chain of custody
    report.addCustodyEntry(
      decision === 'approved' ? 'approved' : 'denied',
      req.user._id,
      `Officer ${req.user.policeProfile?.badgeNumber} ${decision} the report. ${notes || ''}`
    );

    if (decision === 'approved' && citationNumber) {
      report.addCustodyEntry('citation_issued', req.user._id, `Citation #${citationNumber} issued`);
    }

    // Award bounty to reporter if approved
    if (decision === 'approved' && !report.reward.awarded) {
      try {
        const reward = await awardParkingViolationBounty(report._id, report.reporter, report.violationType);
        report.reward = {
          awarded: true,
          rewardId: reward._id,
          amount: reward.finalAmount,
          awardedAt: new Date()
        };
        report.addCustodyEntry('reward_paid', report.reporter, `${reward.finalAmount} credits awarded to reporter`);
      } catch (rewardError) {
        console.error('[ParkingPortal] Reward error:', rewardError.message);
      }
    }

    await report.save();

    // Update department stats
    if (decision === 'approved') {
      req.department.stats.citationsIssued += 1;
    } else if (decision === 'denied') {
      req.department.stats.casesDismissed += 1;
    }
    req.department.stats.totalReviewsCompleted += 1;
    req.department.stats.lastActivityAt = new Date();
    await req.department.save();

    // Update officer stats
    req.user.policeProfile.stats.casesReviewed += 1;
    if (decision === 'approved') req.user.policeProfile.stats.citationsIssued += 1;
    if (decision === 'denied') req.user.policeProfile.stats.casesDismissed += 1;
    await req.user.save();

    // Log activity
    await PoliceActivity.create({
      officer: req.user._id,
      department: req.department._id,
      action: decision === 'approved' ? 'issued_citation' : 'updated_status',
      details: {
        parkingViolationId: report._id,
        decision,
        citationNumber,
        fineAmount,
        reporterRewarded: report.reward.awarded
      }
    });

    // Notify reporter in real-time
    if (req.io) {
      req.io.emit(`parking-review-${report.reporter}`, {
        reportNumber: report.reportNumber,
        decision,
        rewardAmount: report.reward.amount,
        message: decision === 'approved'
          ? `Your parking violation report ${report.reportNumber} was approved! You earned ${report.reward.amount} credits.`
          : `Your parking violation report ${report.reportNumber} was ${decision}.`
      });
    }

    res.json({
      success: true,
      report,
      message: decision === 'approved'
        ? `Citation issued. Reporter awarded ${report.reward.amount || 0} credits.`
        : `Report ${decision}.`
    });
  } catch (error) {
    console.error('[ParkingPortal] Review error:', error);
    res.status(500).json({ error: error.message });
  }
};

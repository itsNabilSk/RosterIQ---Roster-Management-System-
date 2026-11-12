import { Router } from 'express';
import { Leave, Roster, RosterEntry } from '../models/index.js';
import { toDateStr } from '../engine/utils.js';

const router = Router();

/**
 * Keeps existing generated RosterEntry rows synchronized whenever leaves are
 * created, approved, unapproved, or deleted after roster generation.
 */
async function syncLeaveWithRoster(leaveDoc, isDeleted = false) {
  if (!leaveDoc || !leaveDoc.date || !leaveDoc.employeeId) return;

  const dateStr = toDateStr(leaveDoc.date);
  const [yearStr, monthStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const empId = leaveDoc.employeeId?._id || leaveDoc.employeeId;

  const roster = await Roster.findOne({ year, month });
  if (!roster) return;

  const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

  if (!isDeleted && leaveDoc.status === 'APPROVED') {
    const newStatus = leaveDoc.type === 'COMP_OFF' ? 'COMP_OFF' : 'LEAVE';
    await RosterEntry.findOneAndUpdate(
      { rosterId: roster._id, employeeId: empId, date: dateObj },
      { status: newStatus, source: 'AUTO', note: `Synced from approved ${leaveDoc.type}` },
      { upsert: true }
    );
  } else {
    // If leave is deleted or reverted from APPROVED to PENDING, restore WORKING if currently LEAVE/COMP_OFF
    await RosterEntry.findOneAndUpdate(
      {
        rosterId: roster._id,
        employeeId: empId,
        date: dateObj,
        status: { $in: ['LEAVE', 'COMP_OFF'] },
      },
      { status: 'WORKING', source: 'AUTO', note: '' }
    );
  }
}

// GET all leaves (supports ?employeeId=&status=)
router.get('/', async (req, res, next) => {
  try {
    const { employeeId, status, type } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (type) filter.type = type;

    const leaves = await Leave.find(filter)
      .populate('employeeId', 'name email podId')
      .sort({ date: 1 });

    res.json({ data: leaves });
  } catch (err) {
    next(err);
  }
});

// GET single leave
router.get('/:id', async (req, res, next) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('employeeId', 'name email');
    if (!leave) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave not found' } });
    }
    res.json({ data: leave });
  } catch (err) {
    next(err);
  }
});

// POST create leave
router.post('/', async (req, res, next) => {
  try {
    const { employeeId, date, type, status } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'employeeId and date are required' } });
    }

    const leave = await Leave.create({
      employeeId,
      date: new Date(`${toDateStr(date)}T00:00:00.000Z`),
      type: type || 'PLANNED',
      status: status || 'PENDING',
    });

    await syncLeaveWithRoster(leave);

    const populated = await Leave.findById(leave._id).populate('employeeId', 'name email');
    res.status(201).json({ data: populated });
  } catch (err) {
    next(err);
  }
});

// PUT update leave (e.g. Approve / Reject)
router.put('/:id', async (req, res, next) => {
  try {
    const leave = await Leave.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('employeeId', 'name email');

    if (!leave) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave not found' } });
    }

    await syncLeaveWithRoster(leave);

    res.json({ data: leave });
  } catch (err) {
    next(err);
  }
});

// DELETE leave
router.delete('/:id', async (req, res, next) => {
  try {
    const leave = await Leave.findByIdAndDelete(req.params.id);
    if (!leave) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Leave not found' } });
    }

    await syncLeaveWithRoster(leave, true);

    res.json({ data: { message: 'Leave record deleted', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


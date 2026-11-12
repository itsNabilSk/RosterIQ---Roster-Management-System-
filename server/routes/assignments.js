import { Router } from 'express';
import { Assignment } from '../models/index.js';

const router = Router();

// GET all assignments (supports ?employeeId=&processId=&role=)
router.get('/', async (req, res, next) => {
  try {
    const { employeeId, processId, role } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (processId) filter.processId = processId;
    if (role) filter.role = role;

    const assignments = await Assignment.find(filter)
      .populate('employeeId', 'name email podId')
      .populate({
        path: 'processId',
        select: 'type calendarRule minStaffDefault brandId',
        populate: { path: 'brandId', select: 'name' },
      });

    res.json({ data: assignments });
  } catch (err) {
    next(err);
  }
});

// GET single assignment
router.get('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('employeeId', 'name email')
      .populate({
        path: 'processId',
        populate: { path: 'brandId', select: 'name' },
      });

    if (!assignment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }
    res.json({ data: assignment });
  } catch (err) {
    next(err);
  }
});

// POST create assignment
router.post('/', async (req, res, next) => {
  try {
    const { employeeId, processId, role, allocationPercent } = req.body;
    if (!employeeId || !processId) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'employeeId and processId are required' } });
    }

    const assignment = await Assignment.create({
      employeeId,
      processId,
      role: role || 'primary',
      allocationPercent: allocationPercent !== undefined ? Number(allocationPercent) : 100,
    });

    const populated = await Assignment.findById(assignment._id)
      .populate('employeeId', 'name email')
      .populate({
        path: 'processId',
        populate: { path: 'brandId', select: 'name' },
      });

    res.status(201).json({ data: populated });
  } catch (err) {
    next(err);
  }
});

// PUT update assignment
router.put('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('employeeId', 'name email')
      .populate({
        path: 'processId',
        populate: { path: 'brandId', select: 'name' },
      });

    if (!assignment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }
    res.json({ data: assignment });
  } catch (err) {
    next(err);
  }
});

// DELETE assignment
router.delete('/:id', async (req, res, next) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }
    res.json({ data: { message: 'Assignment deleted successfully', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


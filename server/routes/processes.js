import { Router } from 'express';
import { Process, Assignment } from '../models/index.js';

const router = Router();

// GET all processes (supports ?brandId=&type=)
router.get('/', async (req, res, next) => {
  try {
    const { brandId, type } = req.query;
    const filter = {};
    if (brandId) filter.brandId = brandId;
    if (type) filter.type = type;

    const processes = await Process.find(filter)
      .populate('brandId', 'name active')
      .sort({ 'brandId.name': 1, type: 1 });

    res.json({ data: processes });
  } catch (err) {
    next(err);
  }
});

// GET single process
router.get('/:id', async (req, res, next) => {
  try {
    const process = await Process.findById(req.params.id).populate('brandId', 'name active');
    if (!process) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Process not found' } });
    }
    res.json({ data: process });
  } catch (err) {
    next(err);
  }
});

// POST create process
router.post('/', async (req, res, next) => {
  try {
    const { brandId, type, calendarRule, minStaffDefault, minStaffByWeekday } = req.body;
    if (!brandId || !type) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'brandId and type are required' } });
    }

    const process = await Process.create({
      brandId,
      type,
      calendarRule: calendarRule || { type: 'ALL_EXCEPT_HOLIDAYS' },
      minStaffDefault: minStaffDefault !== undefined ? Number(minStaffDefault) : 1,
      minStaffByWeekday: minStaffByWeekday || {},
    });

    res.status(201).json({ data: process });
  } catch (err) {
    next(err);
  }
});

// PUT update process
router.put('/:id', async (req, res, next) => {
  try {
    const process = await Process.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('brandId', 'name active');

    if (!process) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Process not found' } });
    }
    res.json({ data: process });
  } catch (err) {
    next(err);
  }
});

// DELETE process
router.delete('/:id', async (req, res, next) => {
  try {
    const process = await Process.findByIdAndDelete(req.params.id);
    if (!process) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Process not found' } });
    }
    // Remove assignments to this process
    await Assignment.deleteMany({ processId: req.params.id });
    res.json({ data: { message: 'Process deleted successfully', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


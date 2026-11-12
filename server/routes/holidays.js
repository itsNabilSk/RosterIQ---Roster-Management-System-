import { Router } from 'express';
import { Holiday } from '../models/index.js';

const router = Router();

// GET all holidays
router.get('/', async (req, res, next) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json({ data: holidays });
  } catch (err) {
    next(err);
  }
});

// GET single holiday
router.get('/:id', async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Holiday not found' } });
    }
    res.json({ data: holiday });
  } catch (err) {
    next(err);
  }
});

// POST create holiday
router.post('/', async (req, res, next) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'date and name are required' } });
    }

    const holiday = await Holiday.create({
      date: new Date(date),
      name: name.trim(),
    });

    res.status(201).json({ data: holiday });
  } catch (err) {
    next(err);
  }
});

// DELETE holiday
router.delete('/:id', async (req, res, next) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Holiday not found' } });
    }
    res.json({ data: { message: 'Holiday deleted successfully', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


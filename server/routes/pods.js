import { Router } from 'express';
import { Pod, Employee } from '../models/index.js';

const router = Router();

// GET all pods
router.get('/', async (req, res, next) => {
  try {
    const pods = await Pod.find().populate('leadId', 'name email').sort({ name: 1 });
    res.json({ data: pods });
  } catch (err) {
    next(err);
  }
});

// GET single pod
router.get('/:id', async (req, res, next) => {
  try {
    const pod = await Pod.findById(req.params.id).populate('leadId', 'name email');
    if (!pod) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pod not found' } });
    }
    res.json({ data: pod });
  } catch (err) {
    next(err);
  }
});

// POST create pod
router.post('/', async (req, res, next) => {
  try {
    const { name, leadId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Pod name is required' } });
    }
    const pod = await Pod.create({ name: name.trim(), leadId: leadId || null });
    res.status(201).json({ data: pod });
  } catch (err) {
    next(err);
  }
});

// PUT update pod
router.put('/:id', async (req, res, next) => {
  try {
    const { name, leadId } = req.body;
    const update = {};
    if (name) update.name = name.trim();
    if (leadId !== undefined) update.leadId = leadId;

    const pod = await Pod.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!pod) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pod not found' } });
    }
    res.json({ data: pod });
  } catch (err) {
    next(err);
  }
});

// DELETE pod
router.delete('/:id', async (req, res, next) => {
  try {
    const pod = await Pod.findByIdAndDelete(req.params.id);
    if (!pod) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Pod not found' } });
    }
    // Remove podId from associated employees
    await Employee.updateMany({ podId: req.params.id }, { podId: null });
    res.json({ data: { message: 'Pod deleted successfully', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


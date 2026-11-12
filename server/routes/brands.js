import { Router } from 'express';
import { Brand, Process, Assignment } from '../models/index.js';

const router = Router();

// GET all brands
router.get('/', async (req, res, next) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json({ data: brands });
  } catch (err) {
    next(err);
  }
});

// GET single brand
router.get('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
    }
    const processes = await Process.find({ brandId: brand._id });
    res.json({ data: { ...brand.toObject(), processes } });
  } catch (err) {
    next(err);
  }
});

// POST create brand
router.post('/', async (req, res, next) => {
  try {
    const { name, active } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Brand name is required' } });
    }
    const brand = await Brand.create({
      name: name.trim(),
      active: active !== undefined ? Boolean(active) : true,
    });
    res.status(201).json({ data: brand });
  } catch (err) {
    next(err);
  }
});

// PUT update brand
router.put('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!brand) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
    }
    res.json({ data: brand });
  } catch (err) {
    next(err);
  }
});

// DELETE brand
router.delete('/:id', async (req, res, next) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
    }
    // Delete associated processes and assignments
    const procs = await Process.find({ brandId: req.params.id });
    const procIds = procs.map((p) => p._id);
    await Assignment.deleteMany({ processId: { $in: procIds } });
    await Process.deleteMany({ brandId: req.params.id });

    res.json({ data: { message: 'Brand and associated processes deleted', _id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;


import { Router } from 'express';
import { seedDatabase } from '../seeds/seed.js';
import {
  Roster,
  RosterEntry,
  Employee,
  Brand,
  Process,
  Assignment,
  Leave,
} from '../models/index.js';
import { generateRoster } from '../engine/generator.js';
import { suggestBackups } from '../engine/backupSuggester.js';
import { validate } from '../engine/validator.js';
import { toDateStr } from '../engine/utils.js';

const router = Router();

// POST /api/v1/demo/reset - Re-seeds database idempotently for demo
router.post('/reset', async (req, res, next) => {
  try {
    await seedDatabase();

    // Auto-generate December 2025 roster
    const [employees, pods, brands, processes, assignments, holidays, leaves] =
      await Promise.all([
        Employee.find({ active: true }).lean(),
        Employee.find().distinct('podId'),
        Brand.find().lean(),
        Process.find().lean(),
        Assignment.find().lean(),
        [], // holidays loaded if needed
        Leave.find({ status: 'APPROVED' }).lean(),
      ]);

    const { entries, conflicts } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays: [
        { date: '2025-12-25', name: 'Christmas Day' },
        { date: '2025-12-31', name: "New Year's Eve" },
      ],
      leaves,
      year: 2025,
      month: 12,
    });

    const roster = await Roster.findOneAndUpdate(
      { month: 12, year: 2025 },
      { month: 12, year: 2025, status: 'DRAFT' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const bulkOps = entries.map((e) => ({
      updateOne: {
        filter: {
          rosterId: roster._id,
          employeeId: e.employeeId,
          date: new Date(`${toDateStr(e.date)}T00:00:00.000Z`),
        },
        update: {
          $set: { status: e.status, source: e.source || 'AUTO' },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await RosterEntry.bulkWrite(bulkOps);
    }

    res.json({
      data: {
        message: 'Demo environment reset and December 2025 roster generated.',
        rosterId: roster._id,
        conflictsCount: conflicts.length,
        errorsCount: conflicts.filter((c) => c.severity === 'ERROR').length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/demo/status - Inspects Brand Alpha CS conflict state
router.get('/status', async (req, res, next) => {
  try {
    const alphaBrand = await Brand.findOne({ name: 'Alpha CS' });
    const rahul = await Employee.findOne({ email: 'rahul.sharma@rosteriq.io' });
    const betaBrand = await Brand.findOne({ name: 'Beta Support' });

    const roster = await Roster.findOne({ month: 12, year: 2025 });

    res.json({
      data: {
        alphaBrand,
        rahul,
        betaBrand,
        rosterId: roster?._id,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;


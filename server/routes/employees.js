import { Router } from 'express';
import { Employee, Pod, Assignment, Roster, RosterEntry } from '../models/index.js';

const router = Router();

// GET all employees (supports ?podId=&active=&search=)
router.get('/', async (req, res, next) => {
  try {
    const { podId, active, search } = req.query;
    const filter = {};

    if (podId) filter.podId = podId;
    if (active !== undefined) filter.active = active === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const employees = await Employee.find(filter)
      .populate('podId', 'name')
      .sort({ name: 1 });

    res.json({ data: employees });
  } catch (err) {
    next(err);
  }
});

// GET single employee
router.get('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id).populate('podId', 'name');
    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }
    res.json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// POST create employee
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      email,
      podId,
      isPodLead,
      weeklyOffPreference,
      maxConsecutiveWorkDays,
      active,
    } = req.body;

    const employee = await Employee.create({
      name,
      email,
      podId: podId || null,
      isPodLead: Boolean(isPodLead),
      weeklyOffPreference: weeklyOffPreference || ['Sunday'],
      maxConsecutiveWorkDays: maxConsecutiveWorkDays !== undefined ? Number(maxConsecutiveWorkDays) : 6,
      active: active !== undefined ? Boolean(active) : true,
    });

    res.status(201).json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// PUT update employee
router.put('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('podId', 'name');

    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }
    res.json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// DELETE employee
router.delete('/:id', async (req, res, next) => {
  try {
    const employeeId = req.params.id;

    // Referential integrity: Check if employee is in any PUBLISHED roster
    const publishedRosters = await Roster.find({ status: 'PUBLISHED' }).select('_id');
    const publishedRosterIds = publishedRosters.map((r) => r._id);
    if (publishedRosterIds.length > 0) {
      const hasPublishedEntries = await RosterEntry.exists({
        employeeId,
        rosterId: { $in: publishedRosterIds },
      });
      if (hasPublishedEntries) {
        return res.status(409).json({
          error: {
            code: 'REFERENTIAL_INTEGRITY_VIOLATION',
            message:
              'Cannot delete an employee who is part of a published roster. Deactivate the employee instead (set active: false).',
          },
        });
      }
    }

    const employee = await Employee.findByIdAndDelete(employeeId);
    if (!employee) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Employee not found' } });
    }

    // Clean up draft entries and assignments
    await RosterEntry.deleteMany({ employeeId });
    await Assignment.deleteMany({ employeeId });

    res.json({ data: { message: 'Employee deleted successfully', _id: employeeId } });
  } catch (err) {
    next(err);
  }
});

export default router;


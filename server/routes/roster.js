import { Router } from 'express';
import {
  Roster,
  RosterEntry,
  Employee,
  Pod,
  Brand,
  Process,
  Assignment,
  Holiday,
  Leave,
} from '../models/index.js';
import {
  generateRoster,
  VALID_STRATEGIES,
  comparePlans,
  validate,
  suggestBackups,
  toDateStr,
  getMonthDates,
  processWorksOnDate,
  getMinStaffRequired,
} from '../engine/index.js';

const router = Router();

// Concurrency mutex lock to prevent double-click / parallel generation collisions
const activeGenerations = new Set();

/**
 * Helper to hydrate full engine context from MongoDB
 */
async function hydrateEngineContext(year, month) {
  const [employees, pods, brands, processes, assignments, holidays, leaves] =
    await Promise.all([
      Employee.find({ active: true }).lean(),
      Pod.find().lean(),
      Brand.find({ active: true }).lean(),
      Process.find().lean(),
      Assignment.find().lean(),
      Holiday.find().lean(),
      Leave.find({ status: 'APPROVED' }).lean(),
    ]);

  return {
    employees,
    pods,
    brands,
    processes,
    assignments,
    holidays,
    leaves,
    year: Number(year),
    month: Number(month),
  };
}

// =========================================================================
// POST /api/v1/roster/generate
// =========================================================================
router.post('/generate', async (req, res, next) => {
  const { month = 12, year = 2025, strategy = 'BALANCED' } = req.body;
  const numMonth = Number(month);
  const numYear = Number(year);

  if (!VALID_STRATEGIES.includes(strategy)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_STRATEGY',
        message: `Invalid strategy "${strategy}". Allowed values: ${VALID_STRATEGIES.join(', ')}`,
      },
    });
  }

  const lockKey = `${numYear}-${numMonth}`;

  if (activeGenerations.has(lockKey)) {
    return res.status(409).json({
      error: {
        code: 'GENERATION_IN_PROGRESS',
        message: `Roster generation is currently in progress for ${numMonth}/${numYear}. Please wait for it to complete.`,
      },
    });
  }

  activeGenerations.add(lockKey);

  try {
    // 1. Hydrate DB context
    const context = await hydrateEngineContext(numYear, numMonth);

    // 2. Run pure deterministic scheduling engine
    const { entries, conflicts } = generateRoster(context, { strategy });

    // 3. Upsert Roster document
    const roster = await Roster.findOneAndUpdate(
      { month: numMonth, year: numYear },
      { month: numMonth, year: numYear, status: 'DRAFT', strategy },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 4. Bulk upsert RosterEntry documents
    const bulkOps = entries.map((entry) => ({
      updateOne: {
        filter: {
          rosterId: roster._id,
          employeeId: entry.employeeId,
          date: new Date(`${toDateStr(entry.date)}T00:00:00.000Z`),
        },
        update: {
          $set: {
            status: entry.status,
            source: entry.source || 'AUTO',
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await RosterEntry.bulkWrite(bulkOps);
    }

    // 5. Fetch saved entries populated with employee details
    const savedEntries = await RosterEntry.find({ rosterId: roster._id })
      .populate('employeeId', 'name email podId')
      .lean();

    res.json({
      data: {
        roster,
        strategy,
        entriesCount: savedEntries.length,
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          errors: conflicts.filter((c) => c.severity === 'ERROR').length,
          warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
        },
      },
    });
  } catch (err) {
    next(err);
  } finally {
    activeGenerations.delete(lockKey);
  }
});

// =========================================================================
// POST /api/v1/roster/compare (Dry-run multi-strategy plan comparison)
// =========================================================================
router.post('/compare', async (req, res, next) => {
  try {
    const { month = 12, year = 2025, strategies } = req.body;
    const numMonth = Number(month);
    const numYear = Number(year);

    if (!Number.isInteger(numMonth) || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'month must be an integer between 1 and 12.' },
      });
    }
    if (!Number.isInteger(numYear) || numYear < 2020 || numYear > 2050) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'year must be an integer between 2020 and 2050.' },
      });
    }

    if (strategies !== undefined) {
      if (!Array.isArray(strategies) || strategies.some((s) => !VALID_STRATEGIES.includes(s))) {
        return res.status(400).json({
          error: {
            code: 'INVALID_STRATEGY',
            message: `strategies must be an array of: ${VALID_STRATEGIES.join(', ')}`,
          },
        });
      }
    }

    const [context, existingRoster] = await Promise.all([
      hydrateEngineContext(numYear, numMonth),
      Roster.findOne({ month: numMonth, year: numYear }).lean(),
    ]);

    const comparison = comparePlans(context, strategies);

    res.json({
      data: {
        month: numMonth,
        year: numYear,
        currentRoster: existingRoster
          ? {
              _id: existingRoster._id,
              status: existingRoster.status,
              strategy: existingRoster.strategy || 'BALANCED',
            }
          : null,
        ...comparison,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// GET /api/v1/roster/find?month=&year=
// =========================================================================
router.get('/find', async (req, res, next) => {
  try {
    const { month = 12, year = 2025 } = req.query;
    const roster = await Roster.findOne({ month: Number(month), year: Number(year) });
    if (!roster) {
      return res.json({ data: null });
    }

    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id })
      .populate('employeeId', 'name email podId isPodLead')
      .lean();

    // Run validator on current live state
    const conflicts = validate({
      ...context,
      entries,
    });

    res.json({
      data: {
        roster,
        entries,
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          errors: conflicts.filter((c) => c.severity === 'ERROR').length,
          warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// GET /api/v1/roster/:id
// =========================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const roster = await Roster.findById(req.params.id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id })
      .populate('employeeId', 'name email podId isPodLead')
      .lean();

    const conflicts = validate({
      ...context,
      entries,
    });

    res.json({
      data: {
        roster,
        entries,
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          errors: conflicts.filter((c) => c.severity === 'ERROR').length,
          warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// GET /api/v1/roster/:id/views/:viewType (company, pod, brand, process, employee)
// =========================================================================
router.get('/:id/views/:viewType', async (req, res, next) => {
  try {
    const { id, viewType } = req.params;
    const roster = await Roster.findById(id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id })
      .populate('employeeId', 'name email podId isPodLead weeklyOffPreference')
      .lean();

    const conflicts = validate({ ...context, entries });
    const monthDates = getMonthDates(roster.year, roster.month);

    // Fast indexed working status set: `${eEmpId}:${eDateStr}`
    const workingSet = new Set();
    for (const e of entries) {
      if (e.status === 'WORKING') {
        const eEmpId = (e.employeeId?._id || e.employeeId).toString();
        const eDateStr = toDateStr(e.date);
        workingSet.add(`${eEmpId}:${eDateStr}`);
      }
    }

    // Compute coverage map per process per date: `procId:dateStr` -> { workingCount, minStaff, status }
    const coverageMap = {};
    for (const proc of context.processes) {
      const pId = proc._id.toString();
      const pAssigns = context.assignments.filter(
        (a) => a.processId.toString() === pId
      );
      const assignedEmpIds = pAssigns.map((a) => a.employeeId.toString());

      for (const dStr of monthDates) {
        const worksToday = processWorksOnDate(proc, dStr, context.holidays);
        const minStaff = worksToday ? getMinStaffRequired(proc, dStr) : 0;

        let workingCount = 0;
        if (worksToday) {
          for (const empId of assignedEmpIds) {
            if (workingSet.has(`${empId}:${dStr}`)) {
              workingCount++;
            }
          }
        }

        coverageMap[`${pId}:${dStr}`] = {
          worksToday,
          workingCount,
          minStaff,
          isSufficient: !worksToday || workingCount >= minStaff,
        };
      }
    }

    // Build specific view presentation
    let viewData = {};

    switch (viewType) {
      case 'company': {
        // Flat list of all employees with their entries
        viewData = {
          employees: context.employees,
          entries,
          dates: monthDates,
          coverageMap,
        };
        break;
      }

      case 'pod': {
        // Grouped by Pod
        const podGroups = context.pods.map((pod) => {
          const podEmps = context.employees.filter(
            (e) => e.podId && e.podId.toString() === pod._id.toString()
          );
          return {
            pod,
            employees: podEmps,
          };
        });
        viewData = { podGroups, entries, dates: monthDates, coverageMap };
        break;
      }

      case 'brand': {
        // Grouped by Brand with processes and associated employees
        const brandGroups = context.brands.map((brand) => {
          const bProcs = context.processes.filter(
            (p) => p.brandId.toString() === brand._id.toString()
          );
          const bProcIds = new Set(bProcs.map((p) => p._id.toString()));
          const bAssigns = context.assignments.filter((a) =>
            bProcIds.has(a.processId.toString())
          );
          const bEmpIds = new Set(bAssigns.map((a) => a.employeeId.toString()));
          const bEmps = context.employees.filter((e) => bEmpIds.has(e._id.toString()));

          return {
            brand,
            processes: bProcs,
            employees: bEmps,
          };
        });
        viewData = { brandGroups, entries, dates: monthDates, coverageMap };
        break;
      }

      case 'process': {
        // Grouped by Process Type (CS, ACC, RETENTION, NDR)
        const types = ['CS', 'ACC', 'RETENTION', 'NDR', 'CUSTOM'];
        const brandNameMap = new Map(context.brands.map((b) => [b._id.toString(), b.name]));
        const processGroups = types.map((type) => {
          const procs = context.processes
            .filter((p) => p.type === type)
            .map((p) => ({
              ...p,
              brandId: {
                _id: p.brandId,
                name: brandNameMap.get(p.brandId.toString()) || 'Brand',
              },
            }));
          return {
            type,
            processes: procs,
          };
        });
        viewData = { processGroups, entries, dates: monthDates, coverageMap };
        break;
      }

      case 'employee': {
        // Individual statistics: total work days, off days, leave days
        const employeeStats = context.employees.map((emp) => {
          const empEntries = entries.filter(
            (e) => (e.employeeId?._id || e.employeeId).toString() === emp._id.toString()
          );
          const workingDays = empEntries.filter((e) => e.status === 'WORKING').length;
          const weeklyOffs = empEntries.filter((e) => e.status === 'WEEKLY_OFF').length;
          const leavesCount = empEntries.filter((e) => e.status === 'LEAVE' || e.status === 'COMP_OFF').length;
          const holidaysCount = empEntries.filter((e) => e.status === 'HOLIDAY').length;

          return {
            employee: emp,
            stats: { workingDays, weeklyOffs, leavesCount, holidaysCount },
            entries: empEntries,
          };
        });
        viewData = { employeeStats, dates: monthDates };
        break;
      }

      default:
        return res.status(400).json({ error: { code: 'INVALID_VIEW', message: `Unknown viewType: ${viewType}` } });
    }

    res.json({
      data: {
        roster,
        viewType,
        ...viewData,
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          errors: conflicts.filter((c) => c.severity === 'ERROR').length,
          warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// PATCH /api/v1/roster/:id/entries/:entryId (Manual Cell Edit & Live Re-validate)
// =========================================================================
router.patch('/:id/entries/:entryId', async (req, res, next) => {
  try {
    const { id, entryId } = req.params;
    const { status, note } = req.body;

    const roster = await Roster.findById(id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    // 1. Load pre-edit conflict baseline
    const context = await hydrateEngineContext(roster.year, roster.month);
    const existingEntries = await RosterEntry.find({ rosterId: roster._id }).lean();
    const oldConflicts = validate({ ...context, entries: existingEntries });

    // 2. Update target cell
    const updatedEntry = await RosterEntry.findByIdAndUpdate(
      entryId,
      {
        status,
        source: 'MANUAL',
        note: note !== undefined ? note : undefined,
      },
      { new: true, runValidators: true }
    ).populate('employeeId', 'name email podId');

    if (!updatedEntry) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster entry not found' } });
    }

    // 3. Immediately re-validate entire month
    const refreshedEntries = existingEntries.map((e) =>
      e._id.toString() === entryId ? updatedEntry.toObject() : e
    );
    const newConflicts = validate({ ...context, entries: refreshedEntries });

    // 4. Calculate conflict diff (resolved vs introduced)
    const oldKeys = new Set(oldConflicts.map((c) => `${c.type}:${c.date}:${c.processId || ''}:${c.employeeIds.join(',')}`));
    const newKeys = new Set(newConflicts.map((c) => `${c.type}:${c.date}:${c.processId || ''}:${c.employeeIds.join(',')}`));

    const resolvedCount = [...oldKeys].filter((k) => !newKeys.has(k)).length;
    const introducedCount = [...newKeys].filter((k) => !oldKeys.has(k)).length;

    res.json({
      data: {
        updatedEntry,
        conflicts: newConflicts,
        diff: {
          resolvedCount,
          introducedCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// GET /api/v1/roster/:id/suggestions
// =========================================================================
router.get('/:id/suggestions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, brandId, processId, employeeIds } = req.query;

    const roster = await Roster.findById(id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id }).lean();

    const conflict = {
      date: date || '2025-12-01',
      brandId: brandId || null,
      processId: processId || null,
      employeeIds: employeeIds ? employeeIds.split(',') : [],
    };

    const suggestions = suggestBackups(
      conflict,
      { ...context, entries },
      3
    );

    res.json({ data: suggestions });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// POST /api/v1/roster/:id/assign-backup
// =========================================================================
router.post('/:id/assign-backup', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId, processId, date } = req.body;

    if (!employeeId || !processId || !date) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'employeeId, processId, and date are required' } });
    }

    const roster = await Roster.findById(id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    // 1. Ensure employee has an assignment to this process (create or update)
    await Assignment.findOneAndUpdate(
      { employeeId, processId },
      { employeeId, processId, role: 'primary', allocationPercent: 100 },
      { upsert: true, new: true }
    );

    // 2. Set this employee's roster cell on target date to WORKING
    const dateObj = new Date(`${toDateStr(date)}T00:00:00.000Z`);
    await RosterEntry.findOneAndUpdate(
      { rosterId: roster._id, employeeId, date: dateObj },
      { status: 'WORKING', source: 'MANUAL', note: 'Assigned as coverage backup' },
      { upsert: true, new: true }
    );

    // 3. Re-validate full roster
    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id }).lean();
    const conflicts = validate({ ...context, entries });

    res.json({
      data: {
        message: 'Backup assigned successfully and schedule updated.',
        conflicts,
        summary: {
          totalConflicts: conflicts.length,
          errors: conflicts.filter((c) => c.severity === 'ERROR').length,
          warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// POST /api/v1/roster/:id/publish
// =========================================================================
router.post('/:id/publish', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { publishOverrideReason, publishedBy = 'Operations Manager' } = req.body;

    const roster = await Roster.findById(id);
    if (!roster) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Roster not found' } });
    }

    // Validate current entries
    const context = await hydrateEngineContext(roster.year, roster.month);
    const entries = await RosterEntry.find({ rosterId: roster._id }).lean();
    const conflicts = validate({ ...context, entries });

    const errorConflicts = conflicts.filter((c) => c.severity === 'ERROR');

    // Rule: Publish roster only if there are no ERROR conflicts (or allow override with a written reason)
    if (errorConflicts.length > 0 && (!publishOverrideReason || !publishOverrideReason.trim())) {
      return res.status(409).json({
        error: {
          code: 'PUBLISH_BLOCKED',
          message: `Cannot publish roster with ${errorConflicts.length} unresolved ERROR conflicts without a written override justification.`,
          conflicts: errorConflicts,
        },
      });
    }

    roster.status = 'PUBLISHED';
    roster.publishedBy = publishedBy;
    if (publishOverrideReason) {
      roster.publishOverrideReason = publishOverrideReason.trim();
    }
    await roster.save();

    res.json({
      data: {
        message: 'Roster published successfully.',
        roster,
        conflicts,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;


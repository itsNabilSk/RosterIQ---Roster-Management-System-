import { Router } from 'express';
import employeesRouter from './employees.js';
import podsRouter from './pods.js';
import brandsRouter from './brands.js';
import processesRouter from './processes.js';
import assignmentsRouter from './assignments.js';
import holidaysRouter from './holidays.js';
import leavesRouter from './leaves.js';
import rosterRouter from './roster.js';
import demoRouter from './demo.js';

const router = Router();

router.use('/employees', employeesRouter);
router.use('/pods', podsRouter);
router.use('/brands', brandsRouter);
router.use('/processes', processesRouter);
router.use('/assignments', assignmentsRouter);
router.use('/holidays', holidaysRouter);
router.use('/leaves', leavesRouter);
router.use('/roster', rosterRouter);
router.use('/demo', demoRouter);

export default router;


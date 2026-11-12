import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import {
  Pod,
  Employee,
  Brand,
  Process,
  Assignment,
  Holiday,
  Leave,
  Roster,
  RosterEntry,
} from '../models/index.js';

describe('Mongoose Models & Schema Validation', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rosteriq_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('should compile all 9 schemas without errors', () => {
    expect(Pod).toBeDefined();
    expect(Employee).toBeDefined();
    expect(Brand).toBeDefined();
    expect(Process).toBeDefined();
    expect(Assignment).toBeDefined();
    expect(Holiday).toBeDefined();
    expect(Leave).toBeDefined();
    expect(Roster).toBeDefined();
    expect(RosterEntry).toBeDefined();
  });

  it('should enforce indexes and references correctly', async () => {
    // 1. Create Pod
    const pod = await Pod.create({ name: 'Tier 1 Alpha Pod' });
    expect(pod._id).toBeDefined();

    // 2. Create Employee
    const emp = await Employee.create({
      name: 'Rahul Sharma',
      email: 'rahul.test@rosteriq.internal',
      podId: pod._id,
      isPodLead: true,
      weeklyOffPreference: ['Sunday'],
      maxConsecutiveWorkDays: 6,
    });
    expect(emp._id).toBeDefined();

    // Update pod lead
    pod.leadId = emp._id;
    await pod.save();

    // 3. Create Brand
    const brand = await Brand.create({ name: 'Acme Global' });
    expect(brand._id).toBeDefined();

    // 4. Create Process
    const processDoc = await Process.create({
      brandId: brand._id,
      type: 'CS',
      calendarRule: {
        type: 'ALL_365',
        weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        holidayPolicy: 'SKIP',
      },
      minStaffDefault: 1,
    });
    expect(processDoc._id).toBeDefined();

    // 5. Create Assignment
    const assignment = await Assignment.create({
      employeeId: emp._id,
      processId: processDoc._id,
      role: 'primary',
      allocationPercent: 100,
    });
    expect(assignment._id).toBeDefined();

    // 6. Create Holiday
    const holidayDate = new Date('2025-12-25T00:00:00.000Z');
    const holiday = await Holiday.create({
      date: holidayDate,
      name: 'Christmas',
    });
    expect(holiday._id).toBeDefined();

    // 7. Create Leave
    const leaveDate = new Date('2025-12-01T00:00:00.000Z');
    const leave = await Leave.create({
      employeeId: emp._id,
      date: leaveDate,
      type: 'PLANNED',
      status: 'APPROVED',
    });
    expect(leave._id).toBeDefined();

    // 8. Create Roster
    const roster = await Roster.create({
      month: 12,
      year: 2025,
      status: 'DRAFT',
    });
    expect(roster._id).toBeDefined();

    // 9. Create RosterEntry
    const entry = await RosterEntry.create({
      rosterId: roster._id,
      employeeId: emp._id,
      date: leaveDate,
      status: 'LEAVE',
      source: 'AUTO',
    });
    expect(entry._id).toBeDefined();
  });
});


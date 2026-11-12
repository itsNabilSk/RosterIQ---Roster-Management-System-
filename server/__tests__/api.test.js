import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import app from '../app.js';

describe('RosterIQ REST APIs (api.test.js)', () => {
  let server;
  let baseUrl;
  let testRosterId;
  let testEntryId;

  beforeAll(async () => {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rosteriq_test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
    // Start server on an ephemeral port
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  });

  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  });

  // Step 7 Validation: Health Check
  it('GET /api/v1/health responds with 200 OK', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('RosterIQ API');
  });

  // Step 8 Validation: CRUD Resources
  describe('CRUD Resources', () => {
    const runId = Date.now();
    let createdPodId;
    let createdEmpId;
    let createdBrandId;
    let createdProcId;

    it('POST & GET /pods', async () => {
      const createRes = await fetch(`${baseUrl}/pods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Alpha Test Pod ${runId}` }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.data.name).toBe(`Alpha Test Pod ${runId}`);
      createdPodId = created.data._id;

      const listRes = await fetch(`${baseUrl}/pods`);
      const list = await listRes.json();
      expect(list.data.some((p) => p._id === createdPodId)).toBe(true);
    });

    it('POST & GET /employees', async () => {
      const testEmail = `vikram.${runId}@test.internal`;
      const createRes = await fetch(`${baseUrl}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Vikram Malhotra',
          email: testEmail,
          podId: createdPodId,
          isPodLead: true,
          weeklyOffPreference: ['Sunday'],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.data.email).toBe(testEmail);
      createdEmpId = created.data._id;

      const listRes = await fetch(`${baseUrl}/employees?search=Vikram`);
      const list = await listRes.json();
      expect(list.data.length).toBeGreaterThan(0);
      expect(list.data.some((e) => e.email === testEmail)).toBe(true);
    });

    it('POST & GET /brands & /processes', async () => {
      const brandRes = await fetch(`${baseUrl}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Test Brand 365 ${runId}` }),
      });
      expect(brandRes.status).toBe(201);
      const brandData = await brandRes.json();
      createdBrandId = brandData.data._id;

      const procRes = await fetch(`${baseUrl}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: createdBrandId,
          type: 'CS',
          calendarRule: { type: 'ALL_365' },
          minStaffDefault: 1,
        }),
      });
      expect(procRes.status).toBe(201);
      const procData = await procRes.json();
      createdProcId = procData.data._id;
    });

    it('POST & GET /assignments', async () => {
      const assignRes = await fetch(`${baseUrl}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: createdEmpId,
          processId: createdProcId,
          role: 'primary',
          allocationPercent: 100,
        }),
      });
      expect(assignRes.status).toBe(201);
      const assignData = await assignRes.json();
      expect(assignData.data.role).toBe('primary');
    });

    it('POST & GET /holidays and /leaves', async () => {
      // Pick a globally unique date to guarantee no collision across test runs
      const testHolidayDate = new Date(Date.now() + 100000000000 + Math.floor(Math.random() * 800000000000)).toISOString().slice(0, 10);
      const holidayRes = await fetch(`${baseUrl}/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: testHolidayDate,
          name: `Special Holiday ${runId}`,
        }),
      });
      expect(holidayRes.status).toBe(201);

      const leaveRes = await fetch(`${baseUrl}/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: createdEmpId,
          date: '2025-12-01',
          type: 'PLANNED',
          status: 'APPROVED',
        }),
      });
      expect(leaveRes.status).toBe(201);
    });
  });

  // Step 9 Validation: Roster Generation, Views, Manual Edit, and Publishing
  describe('Roster Generation, Views & Live Edit', () => {
    it('POST /roster/generate creates full roster and detects initial conflicts', async () => {
      const genRes = await fetch(`${baseUrl}/roster/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: 12, year: 2025 }),
      });
      expect(genRes.status).toBe(200);
      const genData = await genRes.json();
      expect(genData.data.roster).toBeDefined();
      expect(genData.data.entriesCount).toBeGreaterThan(0);
      expect(Array.isArray(genData.data.conflicts)).toBe(true);

      testRosterId = genData.data.roster._id;

      // Check that Vikram has LEAVE on Dec 1, which causes COVERAGE_GAP for Test Brand 365
      const gap = genData.data.conflicts.find(
        (c) => c.type === 'COVERAGE_GAP' && c.date === '2025-12-01'
      );
      expect(gap).toBeDefined();
      expect(gap.severity).toBe('ERROR');
    });

    it(
      'GET /roster/:id/views/:viewType returns data for all 5 view layouts',
      async () => {
        const viewTypes = ['company', 'pod', 'brand', 'process', 'employee'];

        for (const viewType of viewTypes) {
          const viewRes = await fetch(`${baseUrl}/roster/${testRosterId}/views/${viewType}`);
          expect(viewRes.status).toBe(200);
          const viewBody = await viewRes.json();
          expect(viewBody.data.viewType).toBe(viewType);
          expect(Array.isArray(viewBody.data.dates)).toBe(true);
        }
      },
      20000
    );

    it('PATCH /roster/:id/entries/:entryId manually updates cell and calculates live diff', async () => {
      // Find an entry to edit
      const viewRes = await fetch(`${baseUrl}/roster/${testRosterId}/views/company`);
      const viewBody = await viewRes.json();
      const entryToEdit = viewBody.data.entries[0];
      testEntryId = entryToEdit._id;

      const editRes = await fetch(`${baseUrl}/roster/${testRosterId}/entries/${testEntryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'WEEKLY_OFF', note: 'Manual swap' }),
      });

      expect(editRes.status).toBe(200);
      const editBody = await editRes.json();
      expect(editBody.data.updatedEntry.status).toBe('WEEKLY_OFF');
      expect(editBody.data.updatedEntry.source).toBe('MANUAL');
      expect(editBody.data.diff).toBeDefined();
    });

    it('GET /roster/:id/suggestions returns ranked backup employees', async () => {
      const suggRes = await fetch(
        `${baseUrl}/roster/${testRosterId}/suggestions?date=2025-12-01`
      );
      expect(suggRes.status).toBe(200);
      const suggBody = await suggRes.json();
      expect(Array.isArray(suggBody.data)).toBe(true);
    });

    it('POST /roster/compare returns alternative strategy plans and rejects invalid strategies', async () => {
      const cmpRes = await fetch(`${baseUrl}/roster/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: 12, year: 2025 }),
      });
      expect(cmpRes.status).toBe(200);
      const cmpBody = await cmpRes.json();
      expect(cmpBody.data.plans).toHaveLength(4);
      expect(cmpBody.data.plans.some((p) => p.isRecommended)).toBe(true);

      const badRes = await fetch(`${baseUrl}/roster/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: 12, year: 2025, strategies: ['UNKNOWN_STRATEGY'] }),
      });
      expect(badRes.status).toBe(400);
    });

    it('POST /roster/generate accepts explicit strategy parameter', async () => {
      const genRes = await fetch(`${baseUrl}/roster/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: 12, year: 2025, strategy: 'FAIR_DISTRIBUTION' }),
      });
      expect(genRes.status).toBe(200);
      const genBody = await genRes.json();
      expect(genBody.data.strategy).toBe('FAIR_DISTRIBUTION');
      expect(genBody.data.roster.strategy).toBe('FAIR_DISTRIBUTION');
    });

    it('POST /roster/:id/publish blocks publish when ERROR conflicts exist without override reason', async () => {
      const pubRes = await fetch(`${baseUrl}/roster/${testRosterId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      // Should block with 409 Conflict
      expect(pubRes.status).toBe(409);
      const pubBody = await pubRes.json();
      expect(pubBody.error.code).toBe('PUBLISH_BLOCKED');
    });

    it('POST /roster/:id/publish succeeds when written override justification is provided', async () => {
      const pubRes = await fetch(`${baseUrl}/roster/${testRosterId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishOverrideReason: 'Approved by VP of Operations for emergency coverage.',
        }),
      });

      expect(pubRes.status).toBe(200);
      const pubBody = await pubRes.json();
      expect(pubBody.data.roster.status).toBe('PUBLISHED');
      expect(pubBody.data.roster.publishOverrideReason).toContain('Approved by VP');
    });
  });
});

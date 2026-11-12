import mongoose from 'mongoose';
import dotenv from 'dotenv';
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
import { connectDB } from '../config/db.js';

dotenv.config();

export async function seedDatabase() {
  console.log('🌱 Starting RosterIQ Database Seeding...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    Pod.deleteMany({}),
    Employee.deleteMany({}),
    Brand.deleteMany({}),
    Process.deleteMany({}),
    Assignment.deleteMany({}),
    Holiday.deleteMany({}),
    Leave.deleteMany({}),
    Roster.deleteMany({}),
    RosterEntry.deleteMany({}),
  ]);
  console.log('  ✓ Cleared existing database records.');

  // ==========================================
  // 1. Create 5 Pods
  // ==========================================
  const podNames = [
    'Pod Titan (Fintech & Payments)',
    'Pod Apex (E-Commerce High Growth)',
    'Pod Horizon (Global SaaS)',
    'Pod Vanguard (Logistics & Ops)',
    'Pod Zenith (Health & Wellness)',
  ];

  const pods = await Pod.insertMany(podNames.map((name) => ({ name })));
  console.log(`  ✓ Created ${pods.length} pods.`);

  // ==========================================
  // 2. Create 32 Employees (5 leads + 27 members)
  // ==========================================
  const employeeData = [
    // Pod 0: Titan (Lead + 5)
    { name: 'Rahul Sharma', email: 'rahul.sharma@rosteriq.io', podId: pods[0]._id, isPodLead: true, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Ananya Iyer', email: 'ananya.iyer@rosteriq.io', podId: pods[0]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Rohan Desai', email: 'rohan.desai@rosteriq.io', podId: pods[0]._id, isPodLead: false, weeklyOffPreference: ['Saturday', 'Sunday'], maxConsecutiveWorkDays: 5 },
    { name: 'Neha Gupta', email: 'neha.gupta@rosteriq.io', podId: pods[0]._id, isPodLead: false, weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
    { name: 'Karthik Nair', email: 'karthik.nair@rosteriq.io', podId: pods[0]._id, isPodLead: false, weeklyOffPreference: ['Tuesday'], maxConsecutiveWorkDays: 6 },
    { name: 'Pooja Joshi', email: 'pooja.joshi@rosteriq.io', podId: pods[0]._id, isPodLead: false, weeklyOffPreference: ['Wednesday'], maxConsecutiveWorkDays: 6 },

    // Pod 1: Apex (Lead + 5)
    { name: 'Priya Patel', email: 'priya.patel@rosteriq.io', podId: pods[1]._id, isPodLead: true, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Deepa Nair', email: 'deepa.nair@rosteriq.io', podId: pods[1]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Arvind Kumar', email: 'arvind.kumar@rosteriq.io', podId: pods[1]._id, isPodLead: false, weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
    { name: 'Shalini Menon', email: 'shalini.menon@rosteriq.io', podId: pods[1]._id, isPodLead: false, weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 5 },
    { name: 'Suresh Pillai', email: 'suresh.pillai@rosteriq.io', podId: pods[1]._id, isPodLead: false, weeklyOffPreference: ['Tuesday'], maxConsecutiveWorkDays: 6 },
    { name: 'Meera Nambiar', email: 'meera.nambiar@rosteriq.io', podId: pods[1]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },

    // Pod 2: Horizon (Lead + 5)
    { name: 'Amit Verma', email: 'amit.verma@rosteriq.io', podId: pods[2]._id, isPodLead: true, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Varun Reddy', email: 'varun.reddy@rosteriq.io', podId: pods[2]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Divya Kulkarni', email: 'divya.kulkarni@rosteriq.io', podId: pods[2]._id, isPodLead: false, weeklyOffPreference: ['Friday'], maxConsecutiveWorkDays: 6 },
    { name: 'Manish Saxena', email: 'manish.saxena@rosteriq.io', podId: pods[2]._id, isPodLead: false, weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 5 },
    { name: 'Tanvi Shah', email: 'tanvi.shah@rosteriq.io', podId: pods[2]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Rajesh Bhat', email: 'rajesh.bhat@rosteriq.io', podId: pods[2]._id, isPodLead: false, weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },

    // Pod 3: Vanguard (Lead + 5)
    { name: 'Sneha Rao', email: 'sneha.rao@rosteriq.io', podId: pods[3]._id, isPodLead: true, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Sanjay Chawla', email: 'sanjay.chawla@rosteriq.io', podId: pods[3]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Ritu Sen', email: 'ritu.sen@rosteriq.io', podId: pods[3]._id, isPodLead: false, weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 6 },
    { name: 'Harish Pandey', email: 'harish.pandey@rosteriq.io', podId: pods[3]._id, isPodLead: false, weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
    { name: 'Kavita Das', email: 'kavita.das@rosteriq.io', podId: pods[3]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Gaurav Kapoor', email: 'gaurav.kapoor@rosteriq.io', podId: pods[3]._id, isPodLead: false, weeklyOffPreference: ['Tuesday'], maxConsecutiveWorkDays: 6 },

    // Pod 4: Zenith (Lead + 7)
    { name: 'Vikram Singh', email: 'vikram.singh@rosteriq.io', podId: pods[4]._id, isPodLead: true, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Swati Mishra', email: 'swati.mishra@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Abhishek Paul', email: 'abhishek.paul@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
    { name: 'Shilpa Hegde', email: 'shilpa.hegde@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 6 },
    { name: 'Manoj Tiwari', email: 'manoj.tiwari@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Wednesday'], maxConsecutiveWorkDays: 6 },
    { name: 'Rekha Sethi', email: 'rekha.sethi@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { name: 'Nitin Goyal', email: 'nitin.goyal@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Thursday'], maxConsecutiveWorkDays: 6 },
    { name: 'Preeti Agarwal', email: 'preeti.agarwal@rosteriq.io', podId: pods[4]._id, isPodLead: false, weeklyOffPreference: ['Friday'], maxConsecutiveWorkDays: 6 },
  ];

  const employees = await Employee.insertMany(employeeData);
  console.log(`  ✓ Created ${employees.length} employees.`);

  // Update Pod Leads
  const podLeadPairs = [
    [pods[0]._id, employees[0]._id],  // Rahul Sharma -> Pod Titan
    [pods[1]._id, employees[6]._id],  // Priya Patel -> Pod Apex
    [pods[2]._id, employees[12]._id], // Amit Verma -> Pod Horizon
    [pods[3]._id, employees[18]._id], // Sneha Rao -> Pod Vanguard
    [pods[4]._id, employees[24]._id], // Vikram Singh -> Pod Zenith
  ];

  for (const [podId, leadId] of podLeadPairs) {
    await Pod.updateOne({ _id: podId }, { leadId });
  }
  console.log('  ✓ Associated 5 Pod Leads to their respective Pods.');

  // ==========================================
  // 3. Create 20 Brands
  // ==========================================
  const brandNames = [
    // 16 Single-Resource Brands (indices 0..15)
    'Alpha CS',          // Demo Brand A: single resource Rahul covers CS, ACC, NDR
    'Nova Retail',
    'SwiftPay',
    'Aura Lifestyle',
    'Zenith Cloud',
    'Pulse Health',
    'Kite Mobility',
    'Orbit Logistics',
    'Lumina Wear',
    'ByteFlow',
    'Echo AI',
    'Peak Nutrition',
    'Solstice Living',
    'Vortex Gaming',
    'Chronos Security',
    'Glide Auto',

    // 4 Multi-Employee Brands (indices 16..19)
    'Beta Support',      // Demo Brand B: 3 employees (Sanjay, Ritu, Harish)
    'Nexus Commerce',    // 2 employees
    'Atlas FinTech',     // 2 employees
    'OmniCare Global',   // 2 employees sharing CS
  ];

  const brands = await Brand.insertMany(brandNames.map((name) => ({ name, active: true })));
  console.log(`  ✓ Created ${brands.length} brands.`);

  // ==========================================
  // 4. Create ~40 Processes across brands
  // ==========================================
  const processes = [];

  // Brand 0: "Alpha CS" (Single Resource - Rahul Sharma handles CS + ACC + NDR)
  processes.push(
    { brandId: brands[0]._id, type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
    { brandId: brands[0]._id, type: 'ACC', calendarRule: { type: 'MON_SAT' }, minStaffDefault: 1 },
    { brandId: brands[0]._id, type: 'NDR', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 }
  );

  // Brands 1..15: Single Resource Brands (1 to 2 processes each with varied calendar rules)
  const calendarTypes = ['ALL_EXCEPT_HOLIDAYS', 'MON_SAT', 'MON_FRI', 'ALL_365'];
  for (let i = 1; i <= 15; i++) {
    const calType = calendarTypes[i % calendarTypes.length];
    processes.push({
      brandId: brands[i]._id,
      type: 'CS',
      calendarRule: { type: calType },
      minStaffDefault: 1,
    });
    if (i % 2 === 0) {
      processes.push({
        brandId: brands[i]._id,
        type: 'RETENTION',
        calendarRule: { type: 'MON_FRI' },
        minStaffDefault: 1,
      });
    }
  }

  // Brand 16: "Beta Support" (Multi-employee demo brand: CS 365 days minStaff 2, ACC Mon-Sat minStaff 1)
  processes.push(
    { brandId: brands[16]._id, type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2 },
    { brandId: brands[16]._id, type: 'ACC', calendarRule: { type: 'MON_SAT' }, minStaffDefault: 1 }
  );

  // Brand 17: "Nexus Commerce" (2 employees)
  processes.push(
    { brandId: brands[17]._id, type: 'CS', calendarRule: { type: 'ALL_EXCEPT_HOLIDAYS' }, minStaffDefault: 1 },
    { brandId: brands[17]._id, type: 'NDR', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 }
  );

  // Brand 18: "Atlas FinTech" (2 employees)
  processes.push(
    { brandId: brands[18]._id, type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
    { brandId: brands[18]._id, type: 'RETENTION', calendarRule: { type: 'MON_SAT' }, minStaffDefault: 1 }
  );

  // Brand 19: "OmniCare Global" (2+ employees sharing CS, custom schedule on ACC)
  processes.push(
    { brandId: brands[19]._id, type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2, minStaffByWeekday: { Monday: 2 } },
    {
      brandId: brands[19]._id,
      type: 'ACC',
      calendarRule: {
        type: 'CUSTOM',
        weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        holidayPolicy: 'SKIP',
      },
      minStaffDefault: 1,
    }
  );

  const insertedProcesses = await Process.insertMany(processes);
  console.log(`  ✓ Created ${insertedProcesses.length} processes with varied calendar rules.`);

  // ==========================================
  // 5. Create Assignments (Many-to-Many)
  // ==========================================
  const assignments = [];

  // Helper to find processes for a brand
  const getBrandProcesses = (brandId) =>
    insertedProcesses.filter((p) => p.brandId.toString() === brandId.toString());

  // Demo Brand A: Alpha CS -> Rahul Sharma (Employee 0) handles all 3 processes
  const alphaProcesses = getBrandProcesses(brands[0]._id);
  for (const proc of alphaProcesses) {
    assignments.push({
      employeeId: employees[0]._id, // Rahul Sharma
      processId: proc._id,
      role: 'primary',
      allocationPercent: 100,
    });
  }

  // Backup assignment for Rahul: Ananya Iyer (Employee 1, same Pod Titan) is backup for Alpha CS
  assignments.push({
    employeeId: employees[1]._id,
    processId: alphaProcesses[0]._id, // Alpha CS
    role: 'backup',
    allocationPercent: 50,
  });

  // Brands 1..15: Assign 1 employee to all processes of that brand
  for (let i = 1; i <= 15; i++) {
    const emp = employees[i];
    const bProcs = getBrandProcesses(brands[i]._id);
    for (const proc of bProcs) {
      assignments.push({
        employeeId: emp._id,
        processId: proc._id,
        role: 'primary',
        allocationPercent: 100,
      });
    }
  }

  // Brand 16: Beta Support -> 3 employees (Sanjay Chawla, Ritu Sen, Harish Pandey)
  // Sanjay (emp 19), Ritu (emp 20), Harish (emp 21)
  const betaProcs = getBrandProcesses(brands[16]._id);
  const betaCS = betaProcs.find((p) => p.type === 'CS');
  const betaACC = betaProcs.find((p) => p.type === 'ACC');

  // All 3 cover CS (minStaff = 2)
  assignments.push(
    { employeeId: employees[19]._id, processId: betaCS._id, role: 'primary', allocationPercent: 100 },
    { employeeId: employees[20]._id, processId: betaCS._id, role: 'primary', allocationPercent: 70 },
    { employeeId: employees[21]._id, processId: betaCS._id, role: 'primary', allocationPercent: 100 }
  );
  // Ritu also covers ACC (70% + 30% = 100% total allocation)
  if (betaACC) {
    assignments.push({
      employeeId: employees[20]._id,
      processId: betaACC._id,
      role: 'primary',
      allocationPercent: 30,
    });
  }

  // Brand 17: Nexus Commerce -> Kavita Das (emp 22) & Gaurav Kapoor (emp 23)
  const nexusProcs = getBrandProcesses(brands[17]._id);
  if (nexusProcs[0]) {
    assignments.push({ employeeId: employees[22]._id, processId: nexusProcs[0]._id, role: 'primary', allocationPercent: 100 });
  }
  if (nexusProcs[1]) {
    assignments.push({ employeeId: employees[23]._id, processId: nexusProcs[1]._id, role: 'primary', allocationPercent: 100 });
  }

  // Brand 18: Atlas FinTech -> Swati Mishra (emp 25) & Abhishek Paul (emp 26)
  const atlasProcs = getBrandProcesses(brands[18]._id);
  if (atlasProcs[0]) {
    assignments.push({ employeeId: employees[25]._id, processId: atlasProcs[0]._id, role: 'primary', allocationPercent: 100 });
  }
  if (atlasProcs[1]) {
    assignments.push({ employeeId: employees[26]._id, processId: atlasProcs[1]._id, role: 'primary', allocationPercent: 100 });
  }

  // Brand 19: OmniCare Global -> Shilpa Hegde (emp 27) & Manoj Tiwari (emp 28) sharing CS, Rekha Sethi (emp 29) on ACC
  const omniProcs = getBrandProcesses(brands[19]._id);
  const omniCS = omniProcs.find((p) => p.type === 'CS');
  const omniACC = omniProcs.find((p) => p.type === 'ACC');
  if (omniCS) {
    assignments.push(
      { employeeId: employees[27]._id, processId: omniCS._id, role: 'primary', allocationPercent: 100 },
      { employeeId: employees[28]._id, processId: omniCS._id, role: 'primary', allocationPercent: 100 }
    );
  }
  if (omniACC) {
    assignments.push({
      employeeId: employees[29]._id,
      processId: omniACC._id,
      role: 'primary',
      allocationPercent: 100,
    });
  }

  // Multi-brand cross-trained backups (Employees 30, 31)
  for (let i = 30; i < employees.length; i++) {
    assignments.push({
      employeeId: employees[i]._id,
      processId: insertedProcesses[i % insertedProcesses.length]._id,
      role: 'backup',
      allocationPercent: 50,
    });
    assignments.push({
      employeeId: employees[i]._id,
      processId: insertedProcesses[(i + 5) % insertedProcesses.length]._id,
      role: 'backup',
      allocationPercent: 50,
    });
  }

  await Assignment.insertMany(assignments);
  console.log(`  ✓ Created ${assignments.length} assignments.`);

  // ==========================================
  // 6. Public Holidays (December 2025 - India)
  // ==========================================
  const holidays = [
    { date: new Date('2025-12-25T00:00:00.000Z'), name: 'Christmas Day' },
    { date: new Date('2025-12-31T00:00:00.000Z'), name: "New Year's Eve (Bank Holiday)" },
  ];

  await Holiday.insertMany(holidays);
  console.log(`  ✓ Created ${holidays.length} public holidays for December 2025.`);

  // ==========================================
  // 7. Approved Leaves & Deliberate Conflict Seed
  // ==========================================
  const leaves = [
    // DELIBERATE CONFLICT:
    // Rahul Sharma (sole employee of Alpha CS, operating ALL_365) is on APPROVED leave on Monday Dec 1, 2025
    {
      employeeId: employees[0]._id,
      date: new Date('2025-12-01T00:00:00.000Z'),
      type: 'PLANNED',
      status: 'APPROVED',
    },

    // MULTI-EMPLOYEE RESILIENCE:
    // Harish Pandey (Beta Support - 1 of 3 staff) is on leave on Monday Dec 1, 2025
    // Sanjay and Ritu remain available -> 2/2 minStaff covered -> NO error
    {
      employeeId: employees[21]._id,
      date: new Date('2025-12-01T00:00:00.000Z'),
      type: 'PLANNED',
      status: 'APPROVED',
    },

    // Additional realistic leaves across the month
    {
      employeeId: employees[3]._id, // Neha Gupta
      date: new Date('2025-12-10T00:00:00.000Z'),
      type: 'COMP_OFF',
      status: 'APPROVED',
    },
    {
      employeeId: employees[7]._id, // Deepa Nair
      date: new Date('2025-12-15T00:00:00.000Z'),
      type: 'PLANNED',
      status: 'APPROVED',
    },
    {
      employeeId: employees[14]._id, // Divya Kulkarni
      date: new Date('2025-12-22T00:00:00.000Z'),
      type: 'PLANNED',
      status: 'PENDING',
    },
  ];

  await Leave.insertMany(leaves);
  console.log(`  ✓ Created ${leaves.length} leaves (including the pre-seeded deliberate conflict on Dec 1).`);

  console.log('🎉 Seed completed successfully!');
  await mongoose.disconnect();
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}


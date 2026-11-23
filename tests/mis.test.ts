// Run with: npm test   (Node 22+, no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketFor, computeMis, type MisTicket } from "../src/lib/mis.ts";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const t = (p: Partial<MisTicket>): MisTicket => ({
  id: Math.random().toString(36), ticket_no: "IT-2026-00001", status: "open", priority: "medium",
  created_at: daysAgo(1), first_response_at: null, resolved_at: null, closed_at: null,
  department: "Accounts", category: "Ginesys Issue", assignee: "Unassigned", ...p,
});

test("ageing buckets have inclusive upper edges", () => {
  assert.equal(bucketFor(0.5), "0-2");
  assert.equal(bucketFor(2), "0-2");
  assert.equal(bucketFor(2.01), "3-7");
  assert.equal(bucketFor(15), "8-15");
  assert.equal(bucketFor(40), "15+");
});

test("pending snapshot ignores the period; turnaround uses resolved_at", () => {
  const from = new Date(NOW - 7 * 86_400_000), to = new Date(NOW + 1);
  const mis = computeMis([
    t({ created_at: daysAgo(40), status: "pending", priority: "high", assignee: "Gita" }),     // old, still pending
    t({ created_at: daysAgo(3), status: "in_progress", department: "Production" }),
    t({ created_at: daysAgo(20), status: "resolved", resolved_at: daysAgo(2) }),             // raised before, fixed in period
    t({ created_at: daysAgo(1), status: "closed", first_response_at: daysAgo(0.5),
        resolved_at: daysAgo(0.75), closed_at: daysAgo(0.5) }),                                // 6h resolution
  ], from, to, NOW);

  assert.equal(mis.kpi.pendingNow, 2);
  assert.equal(mis.kpi.highPendingNow, 1);
  assert.equal(mis.kpi.over7DaysNow, 1);
  assert.equal(mis.kpi.unassignedNow, 1);
  assert.equal(mis.kpi.raised, 2);
  assert.equal(mis.kpi.resolved, 2);
  assert.equal(mis.kpi.closed, 1);
  assert.equal(mis.kpi.avgResponseHours, 12);
  assert.equal(mis.kpi.avgResolutionHours, (18 * 24 + 6) / 2);

  const acc = mis.byDepartment.find((d) => d.department === "Accounts")!;
  assert.equal(acc.pending, 1);
  assert.equal(acc.buckets["15+"], 1);
  assert.equal(acc.resolved, 2);
  assert.equal(mis.byDepartment[0].department, "Accounts"); // most pending first
  assert.equal(mis.ageingByPriority.high["15+"], 1);
  assert.equal(mis.ageingByPriority.medium["3-7"], 1);

  const cat = mis.byCategory[0];
  assert.equal(cat.within48hPct, 50);
});

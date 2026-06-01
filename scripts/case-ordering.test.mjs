import assert from "node:assert/strict";
import test from "node:test";
import {
  applyUpstreamCaseTimestamps,
  inferContentDate,
  sortCasesForDisplay,
} from "./case-ordering.mjs";

test("case display ordering uses latest content time across manual and upstream cases", () => {
  const sorted = sortCasesForDisplay([
    {
      id: "100099",
      title: "Older admin upload",
      createdAt: "2026-05-20T08:00:00.000Z",
    },
    {
      id: "480",
      title: "Latest upstream sync",
      createdAt: "2026-05-31T18:17:00.000Z",
    },
    {
      id: "100100",
      title: "Newest admin upload",
      createdAt: "2026-06-01T04:00:00.000Z",
    },
    {
      id: "479",
      title: "Previous upstream sync",
      createdAt: "2026-05-30T18:17:00.000Z",
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["100100", "480", "479", "100099"],
  );
});

test("upstream case timestamps are preserved for existing ids and stamped for new ids", () => {
  const { cases, timestamps } = applyUpstreamCaseTimestamps(
    [
      { id: "480", imageUrl: "/images/case480.jpg" },
      { id: "481", imageUrl: "/images/case481.jpg" },
    ],
    {
      480: "2026-05-31T18:17:00.000Z",
    },
    {
      now: "2026-06-01T18:17:00.000Z",
    },
  );

  assert.deepEqual(
    cases.map((item) => [item.id, item.createdAt]),
    [
      ["480", "2026-05-31T18:17:00.000Z"],
      ["481", "2026-06-01T18:17:00.000Z"],
    ],
  );
  assert.deepEqual(timestamps, {
    480: "2026-05-31T18:17:00.000Z",
    481: "2026-06-01T18:17:00.000Z",
  });
});

test("content date falls back to the upload filename date", () => {
  assert.equal(
    inferContentDate({
      id: "100050",
      imageUrl: "/uploads/2026-06-01-case-100050-example.jpg",
    }),
    "2026-06-01T00:00:00.000Z",
  );
});

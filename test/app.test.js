"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { readFileSync, existsSync } = require("fs");
const request = require("supertest");

const app = require("../src/server");
const { identifyEligibilityCriteria } = require("../src/server");
const { evaluateBidderAgainstCriteria } = require("../src/server");
const { generateAuditReport } = require("../src/server");
const { formatAuditReport } = require("../src/server");
const { runEligibilityAuditPipeline } = require("../src/server");
const { generateBidderAuditReport } = require("../src/server");

describe("identifyEligibilityCriteria", () => {
  test("extracts financial, certification, and experience criteria from mixed tender text", () => {
    const criteria = identifyEligibilityCriteria(`
      Eligibility Criteria:
      1. Bidder shall have minimum annual turnover of INR 5 crore during the last three financial years.
      2. ISO 9001:2015 certification is mandatory.
      3. The firm should have at least 3 years of experience in similar work.
      4. MSME registration is desirable.
    `);

    assert.equal(criteria.length, 4);
    assert.deepEqual(
      criteria.map((criterion) => criterion.name),
      ["Annual turnover", "Certification", "Experience", "Registration"]
    );
    assert.match(criteria[0].requiredValue, /INR 5 crore/i);
    assert.match(criteria[1].requiredValue, /ISO 9001:2015/i);
    assert.match(criteria[2].requiredValue, /at least 3 years/i);
    assert.equal(criteria[3].mandatory, false);
  });

  test("returns an empty array when no eligibility signals are present", () => {
    assert.deepEqual(identifyEligibilityCriteria("Tender forms can be downloaded from the portal."), []);
  });
});

describe("evaluateBidderAgainstCriteria", () => {
  test("compares extracted criteria with bidder data and explains outcomes", () => {
    const criteria = [
      {
        name: "Annual turnover",
        description: "Bidder shall have minimum annual turnover of INR 5 crore.",
        requiredValue: "INR 5 crore",
        mandatory: true
      },
      {
        name: "Experience",
        description: "The firm should have at least 3 years of experience in similar work.",
        requiredValue: "at least 3 years",
        mandatory: true
      },
      {
        name: "Certification",
        description: "ISO 9001:2015 certification is mandatory.",
        requiredValue: "ISO 9001:2015",
        mandatory: true
      }
    ];

    const results = evaluateBidderAgainstCriteria(criteria, {
      annualTurnover: "6 crore",
      experienceYears: 2,
      certifications: ["ISO 9001:2015", "ISO 14001"]
    });

    assert.deepEqual(
      results.map((result) => result.status),
      ["pass", "fail", "pass"]
    );
    assert.equal(results[0].operator, "greater_than_or_equal");
    assert.match(results[0].reason, /Passed because/i);
    assert.match(results[1].reason, /Failed because/i);
    assert.match(results[2].reason, /containing required value ISO 9001:2015/i);
  });

  test("marks missing bidder data for extracted criteria as review with a reason", () => {
    const results = evaluateBidderAgainstCriteria(
      [
        {
          name: "Net worth",
          description: "Bidder must have positive net worth.",
          requiredValue: "positive",
          mandatory: true
        }
      ],
      {}
    );

    assert.equal(results[0].status, "review");
    assert.match(results[0].reason, /does not include netWorth/i);
  });
});

describe("generateAuditReport", () => {
  test("summarizes evaluated criteria with explanations and review next steps", () => {
    const evaluatedCriteria = [
      {
        name: "Annual turnover",
        fieldName: "annualTurnover",
        requiredValue: "INR 5 crore",
        actualValue: "6 crore",
        operator: "greater_than_or_equal",
        status: "pass",
        reason: "Passed because bidder value 6 crore is greater than or equal to required value INR 5 crore."
      },
      {
        name: "Experience",
        fieldName: "experienceYears",
        requiredValue: "3 years",
        actualValue: 2,
        operator: "greater_than_or_equal",
        status: "fail",
        reason: "Failed because bidder value 2 is greater than or equal to required value 3 years."
      },
      {
        name: "Certification",
        fieldName: "certifications",
        requiredValue: "ISO 9001:2015",
        actualValue: null,
        operator: "contains",
        status: "review",
        reason: "Needs review because bidder data does not include certifications."
      }
    ];

    const report = generateAuditReport(evaluatedCriteria, {
      bidderId: "b1",
      bidderName: "Acme Supplies",
      generatedAt: "2026-05-06T00:00:00.000Z"
    });

    assert.equal(report.overallStatus, "fail");
    assert.deepEqual(report.summary, {
      totalCriteria: 3,
      passed: 1,
      failed: 1,
      needsReview: 1
    });
    assert.equal(report.criteria[0].outcome, "passed");
    assert.match(report.criteria[1].explanation, /Failed because/i);
    assert.match(report.criteria[2].nextSteps.join(" "), /Request a copy of the relevant certificate/i);
    assert.equal(report.formattedReport.ui.criteriaCards[2].highlight, true);
    assert.match(report.formattedReport.download.markdown, /REVIEW REQUIRED/i);
  });

  test("accepts an evaluation object with a results array", () => {
    const report = generateAuditReport({
      results: [
        {
          name: "Net worth",
          fieldName: "netWorth",
          requiredValue: "positive",
          actualValue: null,
          status: "review"
        }
      ]
    });

    assert.equal(report.summary.needsReview, 1);
    assert.match(report.criteria[0].nextSteps.join(" "), /financial statements|bank solvency/i);
  });
});

describe("formatAuditReport", () => {
  test("creates UI-ready cards and downloadable markdown", () => {
    const formatted = formatAuditReport({
      reportTitle: "Eligibility Criteria Audit Report",
      bidderId: "b9",
      bidderName: "Review Corp",
      generatedAt: "2026-05-06T00:00:00.000Z",
      overallStatus: "review",
      summary: {
        totalCriteria: 1,
        passed: 0,
        failed: 0,
        needsReview: 1
      },
      criteria: [
        {
          criterionNumber: 1,
          name: "Certification",
          requiredValue: "ISO 9001:2015",
          actualValue: null,
          operator: "contains",
          mandatory: true,
          status: "review",
          explanation: "Needs review because bidder data does not include certifications.",
          nextSteps: ["Request a copy of the relevant certificate."]
        }
      ]
    });

    assert.equal(formatted.ui.overallStatusLabel, "Needs Review");
    assert.equal(formatted.ui.criteriaCards[0].tone, "warning");
    assert.equal(formatted.ui.reviewHighlights.length, 1);
    assert.equal(formatted.download.fileName, "review-corp-audit-report.md");
    assert.match(formatted.download.markdown, /Status: Needs Review - REVIEW REQUIRED/i);
    assert.match(formatted.download.plainText, /Request a copy of the relevant certificate/i);
  });
});

describe("runEligibilityAuditPipeline", () => {
  test("extracts, evaluates, and reports criteria in sequence", async () => {
    const result = await runEligibilityAuditPipeline(
      `
        Bidder shall have minimum annual turnover of INR 5 crore.
        The firm should have at least 3 years of experience in similar work.
        ISO 9001:2015 certification is mandatory.
      `,
      {
        annualTurnover: "6 crore",
        experienceYears: 2,
        certifications: ["ISO 9001:2015"]
      },
      {
        useModel: false,
        bidderId: "b1",
        bidderName: "Acme Supplies",
        generatedAt: "2026-05-06T00:00:00.000Z"
      }
    );

    assert.equal(result.status, "completed");
    assert.deepEqual(result.steps, {
      extraction: "completed",
      evaluation: "completed",
      reporting: "completed"
    });
    assert.equal(result.criteriaExtraction.engine, "local-rule-parser");
    assert.equal(result.criteria.length, 3);
    assert.deepEqual(
      result.evaluation.results.map((item) => item.status),
      ["pass", "fail", "pass"]
    );
    assert.equal(result.auditReport.bidderName, "Acme Supplies");
    assert.equal(result.auditReport.summary.failed, 1);
    assert.match(result.auditReport.criteria[1].explanation, /Failed because/i);
  });

  test("supports a custom extraction step for modular use", async () => {
    const result = await runEligibilityAuditPipeline(
      "Custom extraction text",
      { annualTurnover: "10 crore" },
      {
        extractCriteria: async () => [
          {
            name: "Annual turnover",
            requiredValue: "5 crore",
            description: "Bidder must have annual turnover above 5 crore."
          }
        ],
        generatedAt: "2026-05-06T00:00:00.000Z"
      }
    );

    assert.equal(result.criteriaExtraction.engine, "custom");
    assert.equal(result.evaluation.status, "pass");
    assert.equal(result.auditReport.overallStatus, "pass");
  });
});

describe("generateBidderAuditReport", () => {
  test("feeds bidder data into the pipeline and returns the final audit report", async () => {
    const report = await generateBidderAuditReport(
      `
        Bidder shall have minimum annual turnover of INR 5 crore.
        The firm should have at least 3 years of experience in similar work.
        ISO 9001:2015 certification is mandatory.
      `,
      {
        annualTurnover: "4 crore",
        experienceYears: 4,
        certifications: []
      },
      {
        useModel: false,
        bidderId: "b2",
        bidderName: "Beta Traders",
        generatedAt: "2026-05-06T00:00:00.000Z"
      }
    );

    assert.equal(report.reportTitle, "Eligibility Criteria Audit Report");
    assert.equal(report.bidderName, "Beta Traders");
    assert.equal(report.overallStatus, "fail");
    assert.deepEqual(report.summary, {
      totalCriteria: 3,
      passed: 1,
      failed: 2,
      needsReview: 0
    });
    assert.deepEqual(
      report.criteria.map((criterion) => criterion.status),
      ["fail", "pass", "fail"]
    );
    assert.match(report.criteria[0].explanation, /Failed because/i);
    assert.equal(report.source.criteriaExtraction.engine, "local-rule-parser");
  });
});

describe("HTTP API", () => {
  test("GET / serves portal HTML", async () => {
    const res = await request(app).get("/").expect(200).expect("Content-Type", /html/i);
    assert.match(res.text, /Document Upload Center|CRPF Tender/i);
  });

  test("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.service, "crpf-tender-upload-server");
  });

  test("POST /evaluate rejects invalid criteria type", async () => {
    const res = await request(app).post("/evaluate").send({ criteria: {}, bidderData: {} }).expect(400);
    assert.ok(res.body.error);
  });

  test("POST /evaluate evaluates bidderData against criteria", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        criteria: [
          { fieldName: "annualTurnover", operator: "greater_than_or_equal", requiredValue: "100000" }
        ],
        bidderData: { annualTurnover: "500000" }
      })
      .expect(200);

    assert.equal(res.body.status, "pass");
    assert.ok(Array.isArray(res.body.results));
  });

  test("POST /evaluate accepts bidders array", async () => {
    const res = await request(app)
      .post("/evaluate")
      .send({
        criteria: [{ fieldName: "x", operator: "exists", requiredValue: "true" }],
        bidders: [{ id: "b1", name: "Co", data: { x: 1 } }]
      })
      .expect(200);

    assert.ok(res.body.bidderVerdicts);
    assert.equal(res.body.bidderVerdicts.length, 1);
    assert.ok(res.body.bidderEvaluation);
  });

  test("POST /pipeline runs extraction, evaluation, and reporting", async () => {
    const res = await request(app)
      .post("/pipeline")
      .send({
        tenderText: "Bidder shall have minimum annual turnover of INR 5 crore. ISO 9001:2015 certification is mandatory.",
        bidderData: {
          annualTurnover: "6 crore",
          certifications: ["ISO 9001:2015"]
        },
        bidderName: "Acme Supplies",
        useModel: false
      })
      .expect(200);

    assert.equal(res.body.status, "completed");
    assert.equal(res.body.criteriaExtraction.engine, "local-rule-parser");
    assert.equal(res.body.evaluation.status, "pass");
    assert.equal(res.body.auditReport.overallStatus, "pass");
    assert.equal(res.body.auditReport.bidderName, "Acme Supplies");
  });

  test("POST /audit-report returns final report from tender text and bidder data", async () => {
    const res = await request(app)
      .post("/audit-report")
      .send({
        tenderText: "Bidder shall have minimum annual turnover of INR 5 crore. ISO 9001:2015 certification is mandatory.",
        bidderData: {
          annualTurnover: "4 crore",
          certifications: ["ISO 9001:2015"]
        },
        bidderName: "Beta Traders",
        useModel: false
      })
      .expect(200);

    assert.equal(res.body.message, "Audit report generated successfully");
    assert.equal(res.body.extraction.engine, "request-body");
    assert.equal(res.body.auditReport.bidderName, "Beta Traders");
    assert.equal(res.body.auditReport.overallStatus, "fail");
    assert.ok(res.body.auditReport.formattedReport.download.markdown);
    assert.match(res.body.auditReport.criteria[0].explanation, /Failed because/i);
  });

  test("POST /audit-report accepts multipart tender document upload", async () => {
    const bidderData = JSON.stringify({
      annualTurnover: "6 crore",
      certifications: ["ISO 9001:2015"]
    });

    const res = await request(app)
      .post("/audit-report")
      .field("bidderData", bidderData)
      .field("bidderName", "Acme Supplies")
      .field("useModel", "false")
      .attach(
        "file",
        Buffer.from("Bidder shall have minimum annual turnover of INR 5 crore. ISO 9001:2015 certification is mandatory."),
        "tender.txt"
      )
      .expect(200);

    assert.equal(res.body.extraction.type, "text");
    assert.equal(res.body.auditReport.overallStatus, "pass");
    assert.equal(res.body.auditReport.formattedReport.ui.criteriaCards.length, 2);
  });

  test("POST /audit-report returns pass results for a qualified sample bidder", async () => {
    const res = await request(app)
      .post("/audit-report")
      .send({
        tenderText: `
          Bidder shall have minimum annual turnover of INR 5 crore.
          The firm should have at least 3 years of experience in similar work.
          ISO 9001:2015 certification is mandatory.
        `,
        bidderData: {
          annualTurnover: "7 crore",
          experienceYears: 5,
          certifications: ["ISO 9001:2015", "ISO 14001"]
        },
        bidderName: "Qualified Sample Bidder",
        useModel: false
      })
      .expect(200);

    assert.equal(res.body.auditReport.overallStatus, "pass");
    assert.deepEqual(
      res.body.auditReport.criteria.map((criterion) => criterion.status),
      ["pass", "pass", "pass"]
    );
    assert.deepEqual(res.body.auditReport.summary, {
      totalCriteria: 3,
      passed: 3,
      failed: 0,
      needsReview: 0
    });
  });

  test("POST /audit-report returns fail results for an unqualified sample bidder", async () => {
    const res = await request(app)
      .post("/audit-report")
      .send({
        tenderText: `
          Bidder shall have minimum annual turnover of INR 5 crore.
          The firm should have at least 3 years of experience in similar work.
          ISO 9001:2015 certification is mandatory.
        `,
        bidderData: {
          annualTurnover: "3 crore",
          experienceYears: 1,
          certifications: []
        },
        bidderName: "Unqualified Sample Bidder",
        useModel: false
      })
      .expect(200);

    assert.equal(res.body.auditReport.overallStatus, "fail");
    assert.deepEqual(
      res.body.auditReport.criteria.map((criterion) => criterion.status),
      ["fail", "fail", "fail"]
    );
    assert.deepEqual(res.body.auditReport.summary, {
      totalCriteria: 3,
      passed: 0,
      failed: 3,
      needsReview: 0
    });
    assert.match(res.body.auditReport.criteria[0].explanation, /Failed because/i);
  });

  test("POST /upload requires file field", async () => {
    const res = await request(app).post("/upload").expect(400);
    assert.ok(res.body.error);
  });

  test("POST /upload with plain text skips extraction (no OpenAI)", async () => {
    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("Synthetic tender text for eligibility."), "notes.txt")
      .expect(201);

    assert.equal(res.body.extraction.status, "skipped");
    assert.equal(res.body.eligibilityAnalysis.status, "skipped");
    assert.ok(res.body.bidderEvaluation);
  });

  test("POST /upload with optional bidders multipart field", async () => {
    const bidders = JSON.stringify([
      { id: "z1", name: "Zenith", data: { annualTurnover: "999999999" } }
    ]);

    const res = await request(app)
      .post("/upload")
      .field("bidders", bidders)
      .attach("file", Buffer.from("Tender snippet only."), "snippet.txt")
      .expect(201);

    assert.equal(res.body.bidderEvaluation.bidderCount, 1);
    assert.ok(Array.isArray(res.body.bidderVerdicts));
  });
});

describe("fixtures (PDF pipeline)", () => {
  test("sample PDF parses when fixture present", async (t) => {
    const pdfPath = path.join(__dirname, "fixtures", "sample.pdf");

    if (!existsSync(pdfPath)) {
      t.skip(`Missing ${pdfPath}`);
      return;
    }

    const pdfBuffer = readFileSync(pdfPath);

    const res = await request(app).post("/upload").attach("file", pdfBuffer, "sample.pdf");

    assert.ok(res.status === 201 || res.status === 422, `unexpected status ${res.status}`);

    if (res.status === 422) {
      assert.ok(res.body.eligibilityAnalysis || res.body.extraction, "422 should include diagnostics");
      return;
    }

    assert.equal(res.body.extraction.status, "completed");
    assert.equal(res.body.extraction.type, "pdf");
    assert.ok(Object.prototype.hasOwnProperty.call(res.body, "eligibilityAnalysis"));
  });
});

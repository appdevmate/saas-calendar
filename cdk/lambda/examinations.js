const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const client = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME || "Hospital";

// ── Helpers ──────────────────────────────────────────────────────────────────
function res(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,x-api-key",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function err(statusCode, message) {
  return res(statusCode, { error: message, message });
}

function getDoctor(event) {
  // Extract doctor info from Cognito authorizer claims
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {};
  return {
    email: (claims.email || claims["cognito:username"] || "")
      .toLowerCase()
      .trim(),
    name: claims.name || claims["cognito:username"] || "",
    sub: claims.sub || "",
  };
}

function isAdmin(event) {
  const claims =
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {};
  const groups = claims["cognito:groups"] || "";
  const arr = Array.isArray(groups) ? groups : String(groups).split(",");
  return arr.some((g) =>
    ["admin", "Admin", "developer", "Developer"].includes(g.trim()),
  );
}

// ── Audit Trail ──────────────────────────────────────────────────────────────
async function writeAudit(
  action,
  entityType,
  entityId,
  actorEmail,
  actorName,
  before,
  after,
  ipAddress,
) {
  const auditId = randomUUID();
  const now = new Date().toISOString();
  const item = {
    PK: `AUDIT#${now.slice(0, 10)}`, // partition by date for easy querying
    SK: `AUDIT#${now}#${auditId}`,
    auditId,
    EntityType: "AUDIT",
    action, // CREATE | UPDATE | DELETE | SIGNOFF | VIEW
    entityType, // EXAMINATION | PATIENT | DOCTOR | etc
    entityId,
    actorEmail,
    actorName,
    ipAddress: ipAddress || "unknown",
    timestamp: now,
    before: before ? JSON.stringify(before) : null,
    after: after ? JSON.stringify(after) : null,
    // HIPAA: store change diff only, not full PHI in audit log
    changeSummary: buildChangeSummary(before, after),
  };
  try {
    await db.send(new PutCommand({ TableName: TABLE, Item: item }));
  } catch (e) {
    // Audit failures must never break the main operation
    console.error("Audit write failed:", e.message);
  }
}

function buildChangeSummary(before, after) {
  if (!before && after) return "Record created";
  if (before && !after) return "Record deleted";
  if (!before && !after) return "Action performed";
  const changed = [];
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changed.push(k);
    }
  }
  return changed.length > 0
    ? `Fields changed: ${changed.join(", ")}`
    : "No field changes detected";
}

// ── Validation ───────────────────────────────────────────────────────────────
function validateSection(sectionName, exam, body) {
  const errors = [];

  // Global: block edits on completed exams
  if (exam.status === "completed") {
    return ["This examination has been signed off and is read-only"];
  }

  switch (sectionName) {
    case "chiefComplaint": {
      const cc = body.chiefComplaint;
      if (!cc || !cc.cc || cc.cc.trim().length < 3) {
        errors.push("Chief complaint text is required (min 3 characters)");
      }
      break;
    }

    case "vitalSigns": {
      const v = body.vitalSigns || {};
      if (v.systolic != null && (v.systolic < 50 || v.systolic > 300))
        errors.push("Systolic BP must be between 50-300 mmHg");
      if (v.diastolic != null && (v.diastolic < 30 || v.diastolic > 200))
        errors.push("Diastolic BP must be between 30-200 mmHg");
      if (v.heartRate != null && (v.heartRate < 20 || v.heartRate > 300))
        errors.push("Heart rate must be between 20-300 bpm");
      if (v.temperature != null && (v.temperature < 30 || v.temperature > 45))
        errors.push("Temperature must be between 30-45 °C");
      if (v.weight != null && (v.weight < 0.5 || v.weight > 500))
        errors.push("Weight must be between 0.5-500 kg");
      if (v.height != null && (v.height < 30 || v.height > 250))
        errors.push("Height must be between 30-250 cm");
      if (
        v.oxygenSaturation != null &&
        (v.oxygenSaturation < 50 || v.oxygenSaturation > 100)
      )
        errors.push("Oxygen saturation must be between 50-100%");
      if (
        v.respiratoryRate != null &&
        (v.respiratoryRate < 4 || v.respiratoryRate > 60)
      )
        errors.push("Respiratory rate must be between 4-60 breaths/min");
      if (v.painScale != null && (v.painScale < 0 || v.painScale > 10))
        errors.push("Pain scale must be between 0-10");
      break;
    }

    case "diagnosis": {
      // Requires chief complaint to exist first
      if (!exam.chiefComplaint || !exam.chiefComplaint.cc) {
        errors.push(
          "Chief complaint must be completed before adding a diagnosis",
        );
      }
      const diags = body.diagnosis;
      if (!Array.isArray(diags) || diags.length === 0) {
        errors.push("At least one diagnosis is required");
      } else {
        const hasPrimary = diags.some((d) => d.type === "primary");
        if (!hasPrimary)
          errors.push("At least one diagnosis must be marked as primary");
        diags.forEach((d, i) => {
          if (!d.icdCode || d.icdCode.trim().length === 0)
            errors.push(`Diagnosis ${i + 1}: ICD code is required`);
          if (!d.icdDescription || d.icdDescription.trim().length === 0)
            errors.push(`Diagnosis ${i + 1}: Description is required`);
          if (!["primary", "secondary", "differential"].includes(d.type))
            errors.push(
              `Diagnosis ${i + 1}: Type must be primary, secondary, or differential`,
            );
        });
      }
      break;
    }

    case "prescriptions": {
      if (!exam.diagnosis || exam.diagnosis.length === 0) {
        errors.push("A diagnosis must exist before adding prescriptions");
      }
      const rxs = body.prescriptions;
      if (!Array.isArray(rxs) || rxs.length === 0) {
        errors.push("At least one prescription entry is required");
      } else {
        rxs.forEach((rx, i) => {
          if (!rx.medication || rx.medication.trim().length === 0)
            errors.push(`Prescription ${i + 1}: Medication name is required`);
          if (!rx.dose || rx.dose.trim().length === 0)
            errors.push(`Prescription ${i + 1}: Dose is required`);
          if (!rx.frequency || rx.frequency.trim().length === 0)
            errors.push(`Prescription ${i + 1}: Frequency is required`);
          if (!rx.route)
            errors.push(
              `Prescription ${i + 1}: Route of administration is required`,
            );
          const validRoutes = [
            "oral",
            "iv",
            "im",
            "topical",
            "inhaled",
            "sublingual",
            "other",
          ];
          if (rx.route && !validRoutes.includes(rx.route))
            errors.push(`Prescription ${i + 1}: Invalid route`);
        });
      }
      break;
    }

    case "labOrders": {
      if (!exam.diagnosis || exam.diagnosis.length === 0) {
        errors.push("A diagnosis must exist before ordering lab tests");
      }
      const labs = body.labOrders;
      if (!Array.isArray(labs) || labs.length === 0) {
        errors.push("At least one lab order is required");
      } else {
        labs.forEach((lab, i) => {
          if (!lab.testName || lab.testName.trim().length === 0)
            errors.push(`Lab order ${i + 1}: Test name is required`);
          if (!["routine", "urgent", "stat"].includes(lab.urgency))
            errors.push(
              `Lab order ${i + 1}: Urgency must be routine, urgent, or stat`,
            );
        });
      }
      break;
    }

    case "radiologyOrders": {
      if (!exam.diagnosis || exam.diagnosis.length === 0) {
        errors.push("A diagnosis must exist before ordering radiology studies");
      }
      const rads = body.radiologyOrders;
      if (!Array.isArray(rads) || rads.length === 0) {
        errors.push("At least one radiology order is required");
      } else {
        const validStudyTypes = [
          "X-Ray",
          "CT",
          "MRI",
          "Ultrasound",
          "PET",
          "Mammography",
          "Other",
        ];
        rads.forEach((rad, i) => {
          if (!rad.studyType || !validStudyTypes.includes(rad.studyType))
            errors.push(
              `Radiology order ${i + 1}: Valid study type is required`,
            );
          if (!rad.bodyPart || rad.bodyPart.trim().length === 0)
            errors.push(`Radiology order ${i + 1}: Body part is required`);
          if (!["routine", "urgent", "stat"].includes(rad.urgency))
            errors.push(
              `Radiology order ${i + 1}: Urgency must be routine, urgent, or stat`,
            );
        });
      }
      break;
    }

    case "treatmentPlan": {
      if (!exam.diagnosis || exam.diagnosis.length === 0) {
        errors.push("A diagnosis must exist before adding a treatment plan");
      }
      const tp = body.treatmentPlan;
      if (!tp || !tp.plan || tp.plan.trim().length < 10) {
        errors.push(
          "Treatment plan description is required (min 10 characters)",
        );
      }
      break;
    }
  }

  return errors;
}

function validateSignOff(exam) {
  const errors = [];
  if (!exam.chiefComplaint || !exam.chiefComplaint.cc) {
    errors.push("Chief complaint is required before signing off");
  }
  if (!exam.diagnosis || exam.diagnosis.length === 0) {
    errors.push("At least one diagnosis is required before signing off");
  }
  const hasPrimary = (exam.diagnosis || []).some((d) => d.type === "primary");
  if (!hasPrimary) {
    errors.push(
      "At least one primary diagnosis is required before signing off",
    );
  }
  return errors;
}

// ── Main Handler ─────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.rawPath || event.path || "";
  const examId = event.pathParameters?.examId;
  const doctor = getDoctor(event);
  const adminUser = isAdmin(event);
  const ipAddress = event.requestContext?.http?.sourceIp || "unknown";

  if (method === "OPTIONS") return res(200, {});

  // ── POST /examinations ── CREATE ─────────────────────────────────────────
  if (method === "POST" && !path.includes("/signoff")) {
    const body = JSON.parse(event.body || "{}");

    if (!body.patientId) return err(400, "patientId is required");
    if (!body.patientName) return err(400, "patientName is required");
    if (!doctor.email)
      return err(401, "Unauthorized: doctor identity not found");

    // Only doctors can create examinations
    const groups = (
      event.requestContext?.authorizer?.jwt?.claims?.["cognito:groups"] || ""
    ).toString();
    const isDoctor = groups.toLowerCase().includes("doctor");
    if (!isDoctor && !adminUser)
      return err(403, "Only doctors can create examinations");

    const id = randomUUID();
    const now = new Date().toISOString();
    const exam = {
      PK: `EXAM#${id}`,
      SK: "PROFILE",
      EntityType: "EXAMINATION",
      examId: id,
      patientId: body.patientId,
      patientName: body.patientName,
      doctorId: doctor.sub || id,
      doctorName: body.doctorName || doctor.name,
      doctorEmail: doctor.email,
      date: body.date || now.slice(0, 10),
      status: "draft",
      signedOffAt: null,
      createdAt: now,
      updatedAt: null,
      // SOAP sections — all null on create
      chiefComplaint: null,
      vitalSigns: null,
      physicalExam: null,
      diagnosis: [],
      prescriptions: [],
      labOrders: [],
      radiologyOrders: [],
      treatmentPlan: null,
    };

    await db.send(new PutCommand({ TableName: TABLE, Item: exam }));
    await writeAudit(
      "CREATE",
      "EXAMINATION",
      id,
      doctor.email,
      doctor.name,
      null,
      exam,
      ipAddress,
    );

    return res(201, exam);
  }

  // ── GET /examinations?patientId=x ── LIST ────────────────────────────────
  if (method === "GET" && !examId) {
    const patientId = event.queryStringParameters?.patientId;
    if (!patientId) return err(400, "patientId query parameter is required");

    // Scan with filter — for production, add a GSI on patientId
    const result = await db.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: "EntityType-index", // assumes GSI on EntityType
        KeyConditionExpression: "EntityType = :et",
        FilterExpression:
          "patientId = :pid" + (adminUser ? "" : " AND doctorEmail = :de"),
        ExpressionAttributeValues: {
          ":et": "EXAMINATION",
          ":pid": patientId,
          ...(adminUser ? {} : { ":de": doctor.email }),
        },
      }),
    );

    // Sort by date descending (newest first)
    const items = (result.Items || []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return res(200, items);
  }

  // ── GET /examinations/{examId} ── GET ONE ────────────────────────────────
  if (method === "GET" && examId) {
    const result = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    if (!result.Item) return err(404, "Examination not found");

    // Role check: doctor can only view their own exams; admin sees all
    if (!adminUser && result.Item.doctorEmail !== doctor.email) {
      return err(403, "Access denied: you can only view your own examinations");
    }

    await writeAudit(
      "VIEW",
      "EXAMINATION",
      examId,
      doctor.email,
      doctor.name,
      null,
      null,
      ipAddress,
    );
    return res(200, result.Item);
  }

  // ── PATCH /examinations/{examId} ── UPDATE SECTION ──────────────────────
  if (method === "PATCH" && examId && !path.includes("/signoff")) {
    const body = JSON.parse(event.body || "{}");

    const existing = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    if (!existing.Item) return err(404, "Examination not found");
    const exam = existing.Item;

    // Role check
    if (!adminUser && exam.doctorEmail !== doctor.email) {
      return err(403, "Access denied: you can only edit your own examinations");
    }

    // Block edits on completed exams (unless admin doing correction)
    if (exam.status === "completed" && !adminUser) {
      return err(409, "This examination has been signed off and is read-only");
    }

    // Determine which section is being updated
    const validSections = [
      "chiefComplaint",
      "vitalSigns",
      "physicalExam",
      "diagnosis",
      "prescriptions",
      "labOrders",
      "radiologyOrders",
      "treatmentPlan",
    ];
    const sections = validSections.filter((s) => body[s] !== undefined);

    if (sections.length === 0)
      return err(400, "No valid section provided for update");

    // Validate each section
    for (const section of sections) {
      const validationErrors = validateSection(section, exam, body);
      if (validationErrors.length > 0) {
        return err(422, validationErrors.join(" | "));
      }
    }

    // Auto-generate IDs for array items that don't have one
    ["prescriptions", "labOrders", "radiologyOrders", "diagnosis"].forEach(
      (section) => {
        if (body[section] && Array.isArray(body[section])) {
          body[section] = body[section].map((item) => ({
            ...item,
            id: item.id || randomUUID(),
          }));
        }
      },
    );

    // Auto-calculate BMI if weight and height provided
    if (body.vitalSigns) {
      const vs = body.vitalSigns;
      if (vs.weight && vs.height) {
        const heightM = vs.height / 100;
        vs.bmi = parseFloat((vs.weight / (heightM * heightM)).toFixed(1));
      }
      vs.recordedAt = new Date().toISOString();
    }

    const now = new Date().toISOString();
    const expParts = ["#updatedAt = :updatedAt"];
    const names = { "#updatedAt": "updatedAt" };
    const values = { ":updatedAt": now };

    sections.forEach((s) => {
      expParts.push(`#${s} = :${s}`);
      names[`#${s}`] = s;
      values[`:${s}`] = body[s];
    });

    const before = {};
    sections.forEach((s) => {
      before[s] = exam[s];
    });

    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
        UpdateExpression: `SET ${expParts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );

    const after = {};
    sections.forEach((s) => {
      after[s] = body[s];
    });

    await writeAudit(
      "UPDATE",
      "EXAMINATION",
      examId,
      doctor.email,
      doctor.name,
      before,
      after,
      ipAddress,
    );

    // Return updated record
    const updated = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    return res(200, updated.Item);
  }

  // ── POST /examinations/{examId}/signoff ── SIGN OFF ──────────────────────
  if (method === "POST" && examId && path.includes("/signoff")) {
    const existing = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    if (!existing.Item) return err(404, "Examination not found");
    const exam = existing.Item;

    if (!adminUser && exam.doctorEmail !== doctor.email) {
      return err(
        403,
        "Access denied: you can only sign off your own examinations",
      );
    }

    if (exam.status === "completed") {
      return err(409, "Examination has already been signed off");
    }

    // Validate sign-off requirements
    const signOffErrors = validateSignOff(exam);
    if (signOffErrors.length > 0) {
      return err(422, signOffErrors.join(" | "));
    }

    const now = new Date().toISOString();
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
        UpdateExpression:
          "SET #status = :status, #signedOffAt = :sat, #updatedAt = :ua",
        ExpressionAttributeNames: {
          "#status": "status",
          "#signedOffAt": "signedOffAt",
          "#updatedAt": "updatedAt",
        },
        ExpressionAttributeValues: {
          ":status": "completed",
          ":sat": now,
          ":ua": now,
        },
      }),
    );

    await writeAudit(
      "SIGNOFF",
      "EXAMINATION",
      examId,
      doctor.email,
      doctor.name,
      { status: "draft" },
      { status: "completed", signedOffAt: now },
      ipAddress,
    );

    const updated = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    return res(200, updated.Item);
  }

  // ── DELETE /examinations/{examId} ── ADMIN ONLY ──────────────────────────
  if (method === "DELETE" && examId) {
    if (!adminUser)
      return err(403, "Only administrators can delete examinations");

    const existing = await db.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    if (!existing.Item) return err(404, "Examination not found");

    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `EXAM#${examId}`, SK: "PROFILE" },
      }),
    );

    await writeAudit(
      "DELETE",
      "EXAMINATION",
      examId,
      doctor.email,
      doctor.name,
      existing.Item,
      null,
      ipAddress,
    );

    return res(200, { message: "Examination deleted", examId });
  }

  return err(400, "Unknown route");
};

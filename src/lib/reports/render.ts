import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { evaluate, parseRuleset } from "@/lib/rules";
import type { ReportModel } from "@/lib/types";
import { InstructorReport } from "./InstructorReport";

export async function renderInstructorPdf(model: ReportModel, now = new Date()): Promise<Buffer> {
  if (!model.track || !model.ruleset) throw new Error("Learner has no permit profile");
  const evaluation = evaluate({ config: parseRuleset(model.ruleset.config), contributions: model.contributions, fields: { permit_issue_date: model.track.permit_issue_date }, now });
  return renderToBuffer(createElement(InstructorReport, { model, evaluation, generatedAt: now }) as unknown as ReactElement<DocumentProps>);
}

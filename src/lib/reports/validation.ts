import { z } from "zod";

export const createIssueReportSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Describe the issue")
    .max(2000, "Keep it under 2000 characters"),
});

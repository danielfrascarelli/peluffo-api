import Joi from "joi";
import type { SheetCapture } from "@/data/extraction.types";

const cellValue = Joi.object({
  stringValue: Joi.string().allow(""),
  numberValue: Joi.number(),
  boolValue: Joi.boolean(),
  formulaValue: Joi.string(),
  errorValue: Joi.object({ type: Joi.string().required(), message: Joi.string().allow("") }),
});

export const sheetCellSchema = Joi.object({
  formattedValue: Joi.string().allow(""),
  effectiveValue: cellValue,
  userEnteredValue: cellValue,
});

const captureSchema = Joi.object({
  capturedAt: Joi.string().isoDate().required(),
  spreadsheetId: Joi.string().required(),
  sheetTitle: Joi.string().required(),
  rows: Joi.array()
    .items(
      Joi.object({
        row: Joi.number().integer().min(1).required(),
        cells: Joi.array().items(sheetCellSchema).required(),
      }),
    )
    .unique("row")
    .required(),
}).required();

export function validateSheetCapture(value: unknown): SheetCapture {
  const result = captureSchema.validate(value, { convert: false });
  if (result.error) throw new Error("Invalid stored Sheet capture");
  return result.value as SheetCapture;
}

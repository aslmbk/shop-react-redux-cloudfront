export interface ValidatedProduct {
  title: string;
  description: string;
  price: number;
  count: number;
}

export type ValidationResult =
  | { ok: true; data: ValidatedProduct }
  | { ok: false; error: string };

export function validateProductBody(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== "string" || obj.title.trim() === "") {
    return {
      ok: false,
      error: "title is required and must be a non-empty string",
    };
  }
  if (
    typeof obj.price !== "number" ||
    !Number.isFinite(obj.price) ||
    obj.price <= 0
  ) {
    return {
      ok: false,
      error: "price is required and must be a positive number",
    };
  }

  let description = "";
  if (obj.description !== undefined) {
    if (typeof obj.description !== "string") {
      return { ok: false, error: "description must be a string" };
    }
    description = obj.description;
  }

  let count = 0;
  if (obj.count !== undefined) {
    if (
      typeof obj.count !== "number" ||
      !Number.isInteger(obj.count) ||
      obj.count < 0
    ) {
      return { ok: false, error: "count must be a non-negative integer" };
    }
    count = obj.count;
  }

  return {
    ok: true,
    data: { title: obj.title.trim(), description, price: obj.price, count },
  };
}

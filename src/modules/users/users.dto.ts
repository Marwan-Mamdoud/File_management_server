import { z } from "zod";
import { paginationSchema } from "../files/query-builder.js";

const roleField = z.enum(["USER", "ADMIN"]);

// ≥1 field required — admins patch only what they send (role/name/isVerified).
export const updateUserDto = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").max(100).optional(),
    role: roleField.optional(),
    isVerified: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field (name, role, isVerified) is required",
  });

export type UpdateUserInput = z.infer<typeof updateUserDto>;

const usersListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  role: roleField.optional(),
  isVerified: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z
    .enum(["createdAt", "updatedAt", "name", "email"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const usersListQuerySchemaWithRanges = usersListQuerySchema.refine(
  (query) =>
    query.from === undefined ||
    query.to === undefined ||
    query.from <= query.to,
  { message: "'from' must be before or equal to 'to'", path: ["from"] },
);

export type UsersListQuery = z.infer<typeof usersListQuerySchemaWithRanges>;

export function parseUsersListQuery(rawQuery: unknown): UsersListQuery {
  return usersListQuerySchemaWithRanges.parse(rawQuery);
}

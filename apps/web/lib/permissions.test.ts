import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("access matrix", () => {
  it("principal reads but cannot manage", () => {
    expect(can(["principal"], "viewMaster")).toBe(true);
    expect(can(["principal"], "manageMaster")).toBe(false);
    expect(can(["principal"], "manageSettings")).toBe(false);
  });
  it("principal verifies staff leave only", () => {
    expect(can(["principal"], "reviewStaffLeave")).toBe(true);
    expect(can(["principal"], "reviewStudentLeave")).toBe(false);
  });
  it("only BK and admin verify discipline", () => {
    expect(can(["counselor"], "reviewDiscipline")).toBe(true);
    expect(can(["principal"], "reviewDiscipline")).toBe(false);
    expect(can(["teacher"], "reviewDiscipline")).toBe(false);
  });
  it("guardians never enter the web app", () => {
    expect(can(["guardian"], "webApp")).toBe(false);
  });
  it("combines the roles someone holds", () => {
    expect(can(["teacher", "counselor"], "reviewDiscipline")).toBe(true);
  });
});

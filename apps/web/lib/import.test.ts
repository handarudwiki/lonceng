import { describe, expect, it } from "vitest";
import { parseGuardians, parseStaff, parseStudents } from "./import";

const groups = new Set(["X IPA 1"]);

describe("parseStudents", () => {
  it("accepts a valid row and normalises the card UID", () => {
    const { rows, errors } = parseStudents([["1001", "Adit", "l", "2010-05-01", "X IPA 1", "04ab", "Bu Adit", "0812", ""]], groups);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ identifier: "1001", gender: "L", cardUid: "04AB" });
  });
  it("reports spreadsheet row numbers, counting the header", () => {
    const { errors } = parseStudents([["1", "A", "", "", "X IPA 1"], ["", "", "", "", ""], ["", "B", "", "", "X IPA 1"]], groups);
    expect(errors).toEqual([{ row: 4, message: "NIS wajib diisi" }]);
  });
  it("rejects unknown class, bad gender and bad date", () => {
    const { errors } = parseStudents([["1", "A", "X", "01/02/2010", "XII"]], groups);
    expect(errors.map((e) => e.message)).toEqual(['Rombel "XII" tidak ditemukan', "Tanggal lahir harus YYYY-MM-DD", "JK harus L atau P"]);
  });
  it("catches duplicates inside the file", () => {
    const { errors } = parseStudents([["1", "A", "", "", "X IPA 1"], ["1", "B", "", "", "X IPA 1"]], groups);
    expect(errors).toEqual([{ row: 3, message: "NIS sama dengan baris 2" }]);
  });
  it("needs a way to reach the guardian", () => {
    const { errors } = parseStudents([["1", "A", "", "", "X IPA 1", "", "Bu A", "", ""]], groups);
    expect(errors[0]!.message).toBe("Wali butuh HP atau email");
  });
});

describe("parseStaff", () => {
  it("requires NIP and name", () => {
    expect(parseStaff([["", "", "L"]]).errors.map((e) => e.message)).toEqual(["NIP wajib diisi", "Nama wajib diisi"]);
  });
});

describe("parseGuardians", () => {
  it("requires a known student and a contact", () => {
    const { errors } = parseGuardians([["Bu A", "", "", "9"]], new Set(["1"]));
    expect(errors.map((e) => e.message)).toEqual(["HP atau email wajib diisi", "NIS 9 tidak ditemukan"]);
  });
  it("defaults the relation", () => {
    expect(parseGuardians([["Bu A", "0812", "", "1"]], new Set(["1"])).rows[0]!.relation).toBe("Wali");
  });
});

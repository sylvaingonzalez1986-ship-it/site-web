import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TERPENE_COMPOUNDS } from "./kanab-quest-school-terpenes-compounds";
import { TERPENE_MOLECULAR_STRUCTURES } from "./kanab-quest-school-terpene-structures";

type ProvenanceEntry = {
  id: string;
  formula: string;
  pubchemCid: number;
  imagePath: string;
  imageSha256: string;
  imageBytes: number;
  stereo: { definedAtomCount: number };
};
const provenance = JSON.parse(readFileSync("docs/bete-de-concours/terpene-structure-provenance.json", "utf8")) as {
  coverage: { corpus: number; depicted: number; absent: number };
  entries: ProvenanceEntry[];
  absent: { id: string; reason: string }[];
};

describe("Verified PubChem terpene depictions", () => {
  it("accounts for every corpus identity without inventing missing structures", () => {
    const corpusIds = TERPENE_COMPOUNDS.map(compound => compound.id);
    const depictedIds = Object.keys(TERPENE_MOLECULAR_STRUCTURES);
    const absentIds = provenance.absent.map(entry => entry.id);
    expect(depictedIds.length).toBeGreaterThanOrEqual(30);
    expect(provenance.coverage).toEqual({ corpus: corpusIds.length, depicted: depictedIds.length, absent: absentIds.length });
    expect([...depictedIds, ...absentIds].sort()).toEqual([...corpusIds].sort());
    expect(provenance.entries.map(entry => entry.id).sort()).toEqual(depictedIds.sort());
    for (const id of ["alpha-farnesene", "alpha-bergamotene", "cis-linalool-oxide", "ylangene", "copaene", "borneol"]) {
      expect(TERPENE_MOLECULAR_STRUCTURES[id], id).toBeUndefined();
      expect(absentIds, id).toContain(id);
    }
  });

  it("ships original PNG bytes with valid dimensions and matching identity provenance", () => {
    for (const entry of provenance.entries) {
      const structure = TERPENE_MOLECULAR_STRUCTURES[entry.id]!;
      expect(structure.formula, entry.id).toBe(entry.formula);
      expect(structure.pubchemCid, entry.id).toBe(entry.pubchemCid);
      expect(structure.sourceUrl, entry.id).toBe(`https://pubchem.ncbi.nlm.nih.gov/compound/${entry.pubchemCid}`);
      expect(`public${structure.structureImage}`, entry.id).toBe(entry.imagePath);
      const bytes = readFileSync(entry.imagePath);
      expect([...bytes.subarray(0, 8)], entry.id).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(bytes.readUInt32BE(16), entry.id).toBe(600);
      expect(bytes.readUInt32BE(20), entry.id).toBe(450);
      expect(bytes.length, entry.id).toBe(entry.imageBytes);
      expect(createHash("sha256").update(bytes).digest("hex"), entry.id).toBe(entry.imageSha256);
      expect(structure.isomerNote.length, entry.id).toBeGreaterThan(40);
      if (entry.stereo.definedAtomCount > 0) {
        expect(structure.depictionScope, entry.id).toBe("specified-isomer");
        expect(structure.isomerNote, entry.id).toContain("n’est pas attribuée aux échantillons");
      }
    }
  });

  it("retains chemical distinctions and leaves collective stereochemistry unspecified", () => {
    const expected: Record<string, [number, string]> = {
      alphapinene: [6654, "C10H16"],
      betapinene: [14896, "C10H16"],
      myrcene: [31253, "C10H16"],
      limonene: [22311, "C10H16"],
      "e-beta-ocimene": [5281553, "C10H16"],
      "z-beta-ocimene": [5320250, "C10H16"],
      "p-cymene": [7463, "C10H14"],
      "o-cymene": [10703, "C10H14"],
      "alpha-bisabolol": [10586, "C15H26O"],
      "caryophyllene-oxide": [1742210, "C15H24O"],
      "geranyl-acetate": [1549026, "C12H20O2"],
      neral: [643779, "C10H16O"],
      nerol: [643820, "C10H18O"],
    };
    for (const [id, [pubchemCid, formula]] of Object.entries(expected)) {
      expect(TERPENE_MOLECULAR_STRUCTURES[id], id).toMatchObject({ pubchemCid, formula });
    }
    expect(TERPENE_MOLECULAR_STRUCTURES["e-beta-ocimene"]!.isomerNote).toContain("3E");
    expect(TERPENE_MOLECULAR_STRUCTURES["z-beta-ocimene"]!.isomerNote).toContain("3Z");
    for (const id of ["alphapinene", "betapinene", "limonene", "linalool", "alpha-bisabolol"]) {
      expect(TERPENE_MOLECULAR_STRUCTURES[id]!.depictionScope, id).toBe("connectivity");
      expect(provenance.entries.find(entry => entry.id === id)!.stereo.definedAtomCount, id).toBe(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { parseCustomerProfilePatch } from "@/lib/account-profile";

describe("account-profile", () => {
  it("parses a valid customer profile patch", () => {
    expect(
      parseCustomerProfilePatch({
        firstName: "Alice",
        lastName: "Martin",
        dateOfBirth: "1990-03-15",
        phone: "+33 6 00 00 00 00",
        address: "1 rue du Chanvre",
        city: "Brest",
        postalCode: "29200",
        country: "France",
      }),
    ).toEqual({
      firstName: "Alice",
      lastName: "Martin",
      dateOfBirth: "1990-03-15",
      phone: "+33 6 00 00 00 00",
      address: "1 rue du Chanvre",
      city: "Brest",
      postalCode: "29200",
      country: "France",
    });
  });

  it("returns an empty patch for null payloads", () => {
    expect(parseCustomerProfilePatch(null)).toEqual({
      firstName: undefined,
      lastName: undefined,
      dateOfBirth: undefined,
      phone: undefined,
      address: undefined,
      city: undefined,
      postalCode: undefined,
      country: undefined,
    });
  });

  it("rejects invalid fields", () => {
    expect(() => parseCustomerProfilePatch({ phone: "abc<script>" })).toThrow(
      "Telephone invalide.",
    );
    expect(() => parseCustomerProfilePatch({ postalCode: "29<script>" })).toThrow(
      "Code postal invalide.",
    );
    expect(() => parseCustomerProfilePatch({ dateOfBirth: "15/03/1990" })).toThrow(
      "Date de naissance invalide.",
    );
  });

  it("rejects overly long fields", () => {
    expect(() => parseCustomerProfilePatch({ firstName: "x".repeat(81) })).toThrow(
      "Prenom trop long.",
    );
    expect(() => parseCustomerProfilePatch({ address: "x".repeat(181) })).toThrow(
      "Adresse trop longue.",
    );
  });
});
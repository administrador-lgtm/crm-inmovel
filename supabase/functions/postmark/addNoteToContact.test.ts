// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addNoteToContact,
  getOrCreateContactFromEmailInfo,
} from "./addNoteToContact";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("addNoteToContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  describe("getOrCreateContactFromEmailInfo", () => {
    const contactParams = {
      email: "alice@acme.com",
      firstName: "Alice",
      lastName: "Smith",
      salesId: 42,
    };

    it("returns the existing contact when it already exists in the database", async () => {
      const existingContact = {
        id: 10,
        first_name: "Alice",
        last_name: "Smith",
      };
      mockFrom.mockReturnValue({
        select: () => ({
          contains: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: existingContact, error: null }),
          }),
        }),
      });

      const result = await getOrCreateContactFromEmailInfo(contactParams);

      expect(result).toEqual(existingContact);
      expect(mockFrom).toHaveBeenCalledWith("contacts");
    });

    it("throws when fetching the contact fails", async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          contains: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: null, error: { message: "DB error" } }),
          }),
        }),
      });

      await expect(
        getOrCreateContactFromEmailInfo(contactParams),
      ).rejects.toThrow(
        "Could not fetch contact from database, email: alice@acme.com, error: DB error",
      );
    });

    it("creates and returns a new contact when it does not exist", async () => {
      const newContact = {
        id: 11,
        first_name: "Alice",
        last_name: "Smith",
      };

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch contact → not found
          select: () => ({
            contains: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: insert contact
          insert: () => ({
            select: () => Promise.resolve({ data: [newContact], error: null }),
          }),
        });

      const result = await getOrCreateContactFromEmailInfo(contactParams);

      expect(result).toEqual(newContact);
      expect(mockFrom).toHaveBeenCalledTimes(2);
    });

    it("throws when creating the contact fails", async () => {
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            contains: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: () => ({
            select: () =>
              Promise.resolve({
                data: null,
                error: { message: "Insert failed" },
              }),
          }),
        });

      await expect(
        getOrCreateContactFromEmailInfo(contactParams),
      ).rejects.toThrow(
        "Could not create contact in database, email: alice@acme.com, error: Insert failed",
      );
    });
  });

  describe("addNoteToContact", () => {
    const baseParams = {
      salesEmail: "sales@company.com",
      email: "alice@acme.com",
      firstName: "Alice",
      lastName: "Smith",
      noteContent: "A note",
      attachments: [],
    };

    it("creates a note and returns undefined on success", async () => {
      const salesRecord = { id: 1, email: "sales@company.com" };
      const existingContact = {
        id: 10,
        first_name: "Alice",
        last_name: "Smith",
      };

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch sales → found
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: salesRecord, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: fetch contact → found
          select: () => ({
            contains: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existingContact, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3rd call: insert note into contact_notes → success
          insert: () => Promise.resolve({ error: null }),
        })
        .mockReturnValueOnce({
          // 4th call: update contacts.last_seen
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        });

      const result = await addNoteToContact(baseParams);

      expect(result).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledTimes(4);
      expect(mockFrom).toHaveBeenNthCalledWith(3, "contact_notes");
      expect(mockFrom).toHaveBeenNthCalledWith(4, "contacts");
    });

    it("returns 500 when inserting the note into contact_notes fails", async () => {
      const salesRecord = { id: 1, email: "sales@company.com" };
      const existingContact = {
        id: 10,
        first_name: "Alice",
        last_name: "Smith",
      };

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch sales → found
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: salesRecord, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: fetch contact → found
          select: () => ({
            contains: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existingContact, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 3rd call: insert note into contact_notes → fails
          insert: () =>
            Promise.resolve({ error: { message: "Insert failed" } }),
        });

      const response = await addNoteToContact(baseParams);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(500);
      expect(await response!.text()).toBe(
        "Could not add note to contact alice@acme.com, sales sales@company.com",
      );
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });

    it("returns 500 when getOrCreateContactFromEmailInfo throws", async () => {
      const salesRecord = { id: 1, email: "sales@company.com" };
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockFrom
        .mockReturnValueOnce({
          // 1st call: fetch sales → found
          select: () => ({
            eq: () => ({
              neq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: salesRecord, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          // 2nd call: fetch contact → DB error, causes getOrCreateContactFromEmailInfo to throw
          select: () => ({
            contains: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: "DB error" } }),
            }),
          }),
        });

      const response = await addNoteToContact(baseParams);

      expect(response).toBeInstanceOf(Response);
      expect(response!.status).toBe(500);
      expect(await response!.text()).toBe(
        "Could not get or create contact from database, email: alice@acme.com, sales: sales@company.com",
      );
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
